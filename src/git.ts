import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { join } from "node:path";
import type { ChangedFile, ChangedFileStatus, GitSnapshot } from "./core/types.js";
import { DIFF_HEAD_TAIL_BYTES, DIFF_TRUNCATE_THRESHOLD_BYTES } from "./core/types.js";
import { utf8Head, utf8Tail } from "./core/bytes.js";

function tryGit(cwd: string, args: string[], input?: string): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "ignore"],
      input,
    }).toString();
  } catch {
    return "";
  }
}

export function isGitRepo(cwd: string): boolean {
  try {
    const out = execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    return out === "true";
  } catch {
    return false;
  }
}

export function getBranch(cwd: string): string {
  return tryGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
}

export function getCommitSha(cwd: string): string {
  return tryGit(cwd, ["rev-parse", "HEAD"]).trim();
}

export function getStatusShort(cwd: string): string {
  // List untracked files one by one (not just their directory) so each can be
  // fingerprinted, and keep non-ASCII paths readable.
  return tryGit(cwd, ["-c", "core.quotePath=false", "status", "--short", "--untracked-files=all"]);
}

// Git's well-known empty tree object, used as the diff base before the first commit.
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

/**
 * Base to diff the working tree against. Diffing against HEAD (not the index)
 * includes both staged and unstaged changes to tracked files.
 */
export function diffBase(cwd: string): string {
  return tryGit(cwd, ["rev-parse", "--verify", "--quiet", "HEAD"]).trim() || EMPTY_TREE;
}

// Above this many paths a pathspec could overflow the OS command-line limit,
// so the diff is left unrestricted.
const MAX_PATHSPEC = 500;

function pathspec(paths?: string[]): string[] {
  if (!paths || paths.length > MAX_PATHSPEC) return [];
  return ["--", ...paths.map((p) => `:(literal)${p}`)];
}

export function getDiffStat(cwd: string, base = diffBase(cwd), paths?: string[]): string {
  return tryGit(cwd, ["diff", base, "--stat", ...pathspec(paths)]);
}

export function getDiffNameStatus(cwd: string, base = diffBase(cwd), paths?: string[]): string {
  return tryGit(cwd, ["diff", base, "--name-status", ...pathspec(paths)]);
}

export function getFullDiff(cwd: string, base = diffBase(cwd), paths?: string[]): string {
  return tryGit(cwd, ["diff", base, ...pathspec(paths)]);
}

const MISSING = "<missing>";

/**
 * Content fingerprint (git blob id) of each path in the working tree, used to
 * tell whether a file that was already dirty at `start` changed during the run.
 */
export function hashFiles(cwd: string, paths: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of paths) out[p] = MISSING;
  const present = paths.filter((p) => {
    try {
      return statSync(join(cwd, p)).isFile();
    } catch {
      return false;
    }
  });
  if (present.length > 0) {
    const hashes = tryGit(cwd, ["hash-object", "--stdin-paths"], present.join("\n") + "\n")
      .split("\n")
      .filter(Boolean);
    if (hashes.length === present.length) {
      present.forEach((p, i) => (out[p] = hashes[i]!));
    }
  }
  return out;
}

/**
 * Files changed during the session: those dirty at stop, minus files that were
 * already dirty at start and are byte-for-byte the same now.
 */
export function sessionChanges(
  initial: GitSnapshot,
  final: GitSnapshot,
): { changed: ChangedFile[]; preExisting: ChangedFile[] } {
  const before = initial.fileHashes ?? {};
  const after = final.fileHashes ?? {};
  const changed: ChangedFile[] = [];
  const preExisting: ChangedFile[] = [];
  for (const f of parseChangedFilesFromStatus(final.statusShort)) {
    const h0 = before[f.path];
    if (h0 !== undefined && h0 === after[f.path]) preExisting.push(f);
    else changed.push(f);
  }
  return { changed, preExisting };
}

export function takeSnapshot(cwd: string, opts: { paths?: string[] } = {}): GitSnapshot {
  if (!isGitRepo(cwd)) {
    return {
      isGitRepo: false,
      statusShort: "",
      diffStat: "",
      diffNameStatus: "",
      fullDiff: "",
      fullDiffTruncated: false,
      fullDiffBytes: 0,
    };
  }
  const statusShort = getStatusShort(cwd);
  const fileHashes = hashFiles(
    cwd,
    parseChangedFilesFromStatus(statusShort).map((f) => f.path),
  );
  const none = opts.paths !== undefined && opts.paths.length === 0;
  const base = diffBase(cwd);
  const fullDiff = none ? "" : getFullDiff(cwd, base, opts.paths);
  const diffStat = none ? "" : getDiffStat(cwd, base, opts.paths);
  const diffNameStatus = none ? "" : getDiffNameStatus(cwd, base, opts.paths);
  const buf = Buffer.from(fullDiff, "utf8");
  const bytes = buf.length;
  const common = { isGitRepo: true, statusShort, diffStat, diffNameStatus, fileHashes };
  if (bytes > DIFF_TRUNCATE_THRESHOLD_BYTES) {
    return {
      ...common,
      fullDiff: "",
      fullDiffTruncated: true,
      fullDiffHead: utf8Head(buf, DIFF_HEAD_TAIL_BYTES),
      fullDiffTail: utf8Tail(buf, DIFF_HEAD_TAIL_BYTES),
      fullDiffBytes: bytes,
    };
  }
  return { ...common, fullDiff, fullDiffTruncated: false, fullDiffBytes: bytes };
}

const C_ESCAPES: Record<string, number> = {
  n: 10, t: 9, r: 13, a: 7, b: 8, f: 12, v: 11, '"': 34, "\\": 92,
};

/** Undo git's C-style quoting of a path, e.g. "a\"b.txt" or "caf\303\251". */
export function unquoteGitPath(p: string): string {
  if (!(p.length >= 2 && p.startsWith('"') && p.endsWith('"'))) return p;
  const body = p.slice(1, -1);
  const bytes: number[] = [];
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!;
    if (ch !== "\\") {
      bytes.push(...Buffer.from(ch, "utf8"));
      continue;
    }
    const next = body[i + 1] ?? "";
    if (/[0-7]/.test(next)) {
      bytes.push(parseInt(body.slice(i + 1, i + 4), 8));
      i += 3;
    } else {
      bytes.push(C_ESCAPES[next] ?? next.charCodeAt(0));
      i += 1;
    }
  }
  return Buffer.from(bytes).toString("utf8");
}

export function parseChangedFilesFromStatus(statusShort: string): ChangedFile[] {
  const out: ChangedFile[] = [];
  for (const raw of statusShort.split("\n")) {
    if (!raw.trim()) continue;
    const xy = raw.slice(0, 2);
    let path = raw.slice(3).trim();
    if (path.includes(" -> ")) {
      const parts = path.split(" -> ");
      path = parts[parts.length - 1]?.trim() ?? path;
    }
    path = unquoteGitPath(path);
    // Hide RunLedger's own working directory from the changed-files view.
    if (path === ".runledger" || path === ".runledger/" || path.startsWith(".runledger/")) continue;
    let code: ChangedFileStatus = "M";
    const s = xy.replace(" ", "");
    if (s.includes("?")) code = "?";
    else if (s.includes("A")) code = "A";
    else if (s.includes("D")) code = "D";
    else if (s.includes("R")) code = "R";
    else if (s.includes("C")) code = "C";
    else if (s.includes("U")) code = "U";
    else if (s.includes("M")) code = "M";
    out.push({ path, status: code });
  }
  return out;
}

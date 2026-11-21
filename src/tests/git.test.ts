import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { takeSnapshot, sessionChanges, parseChangedFilesFromStatus, unquoteGitPath } from "../git.js";

function git(cwd: string, ...args: string[]) {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

describe("takeSnapshot", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "rl-git-"));
    git(dir, "init", "-q");
    git(dir, "config", "user.email", "t@example.com");
    git(dir, "config", "user.name", "t");
    git(dir, "config", "core.autocrlf", "false");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("includes staged changes in the diff", () => {
    writeFileSync(join(dir, "a.txt"), "one\n");
    git(dir, "add", ".");
    git(dir, "commit", "-qm", "init");
    writeFileSync(join(dir, "a.txt"), "two\n");
    git(dir, "add", "a.txt");

    const snap = takeSnapshot(dir);
    expect(snap.fullDiff).toContain("+two");
    expect(snap.diffNameStatus).toContain("a.txt");
    expect(snap.diffStat).toContain("1 file changed");
  });

  it("includes both staged and unstaged changes", () => {
    writeFileSync(join(dir, "a.txt"), "a\n");
    writeFileSync(join(dir, "b.txt"), "b\n");
    git(dir, "add", ".");
    git(dir, "commit", "-qm", "init");
    writeFileSync(join(dir, "a.txt"), "a2\n");
    git(dir, "add", "a.txt");
    writeFileSync(join(dir, "b.txt"), "b2\n");

    const snap = takeSnapshot(dir);
    expect(snap.fullDiff).toContain("+a2");
    expect(snap.fullDiff).toContain("+b2");
  });

  it("works in a repo with no commits yet", () => {
    writeFileSync(join(dir, "new.txt"), "hello\n");
    git(dir, "add", "new.txt");

    const snap = takeSnapshot(dir);
    expect(snap.isGitRepo).toBe(true);
    expect(snap.fullDiff).toContain("+hello");
  });
});

describe("sessionChanges", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "rl-sess-"));
    git(dir, "init", "-q");
    git(dir, "config", "user.email", "t@example.com");
    git(dir, "config", "user.name", "t");
    git(dir, "config", "core.autocrlf", "false");
    writeFileSync(join(dir, "old.txt"), "1\n");
    writeFileSync(join(dir, "touched.txt"), "1\n");
    git(dir, "add", ".");
    git(dir, "commit", "-qm", "init");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("excludes files that were already dirty and untouched by the session", () => {
    // Dirty before the session starts.
    writeFileSync(join(dir, "old.txt"), "dirty before\n");
    writeFileSync(join(dir, "touched.txt"), "dirty before\n");
    writeFileSync(join(dir, "scratch.txt"), "untracked before\n");
    const initial = takeSnapshot(dir);

    // During the session.
    writeFileSync(join(dir, "touched.txt"), "changed during\n");
    writeFileSync(join(dir, "new.txt"), "new\n");
    const final = takeSnapshot(dir);

    const { changed, preExisting } = sessionChanges(initial, final);
    expect(changed.map((f) => f.path).sort()).toEqual(["new.txt", "touched.txt"]);
    expect(preExisting.map((f) => f.path).sort()).toEqual(["old.txt", "scratch.txt"]);

    const limited = takeSnapshot(dir, { paths: changed.map((f) => f.path) });
    expect(limited.fullDiff).toContain("touched.txt");
    expect(limited.fullDiff).not.toContain("old.txt");
  });

  it("parses paths git quotes (spaces, non-ASCII)", () => {
    writeFileSync(join(dir, "my file.txt"), "x\n");
    writeFileSync(join(dir, "café.txt"), "x\n");
    const paths = parseChangedFilesFromStatus(takeSnapshot(dir).statusShort).map((f) => f.path);
    expect(paths).toContain("my file.txt");
    expect(paths).toContain("café.txt");
  });
});

describe("unquoteGitPath", () => {
  it("decodes C-style quoting", () => {
    expect(unquoteGitPath("plain.txt")).toBe("plain.txt");
    expect(unquoteGitPath('"a \\"b\\".txt"')).toBe('a "b".txt');
    expect(unquoteGitPath('"caf\\303\\251.txt"')).toBe("café.txt");
  });
});

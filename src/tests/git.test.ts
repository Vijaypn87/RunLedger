import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { takeSnapshot } from "../git.js";

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

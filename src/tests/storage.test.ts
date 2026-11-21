import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  serializeRun,
  deserializeRun,
  writeRun,
  readRun,
  writeActive,
  readActive,
  clearActive,
  appendCommand,
  withSessionLock,
} from "../core/storage.js";
import type { RunLedgerRun, GitSnapshot } from "../core/types.js";

const blankSnap: GitSnapshot = {
  isGitRepo: true,
  statusShort: "",
  diffStat: "",
  diffNameStatus: "",
  fullDiff: "",
  fullDiffTruncated: false,
  fullDiffBytes: 0,
};

const sampleRun: RunLedgerRun = {
  id: "run_x",
  startTime: "2026-01-01T00:00:00Z",
  endTime: "2026-01-01T00:00:01Z",
  cwd: "/proj",
  branch: "main",
  commitSha: "abc",
  initialGit: blankSnap,
  finalGit: blankSnap,
  commands: [],
  changedFiles: [],
  risks: [],
  schemaVersion: 1,
};

describe("serialize/deserialize", () => {
  it("round-trips a run via JSON", () => {
    const json = serializeRun(sampleRun);
    const back = deserializeRun(json);
    expect(back).toEqual(sampleRun);
  });

  it("throws on bad JSON", () => {
    expect(() => deserializeRun("not json")).toThrow();
  });

  it("throws when schemaVersion is wrong", () => {
    const bad = JSON.stringify({ ...sampleRun, schemaVersion: 99 });
    expect(() => deserializeRun(bad)).toThrow(/schema/i);
  });
});

describe("storage I/O", () => {
  it("writes and reads a run from .runledger", () => {
    const dir = mkdtempSync(join(tmpdir(), "runledger-"));
    try {
      writeRun(dir, sampleRun);
      const back = readRun(dir, sampleRun.id);
      expect(back).toEqual(sampleRun);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writes/reads/clears active session", () => {
    const dir = mkdtempSync(join(tmpdir(), "runledger-"));
    try {
      expect(readActive(dir)).toBeNull();
      writeActive(dir, sampleRun);
      expect(readActive(dir)?.id).toBe(sampleRun.id);
      clearActive(dir);
      expect(readActive(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("session lock", () => {
  const cmd = (command: string) => ({
    command,
    startTime: "2026-01-01T00:00:00Z",
    endTime: "2026-01-01T00:00:01Z",
    durationMs: 1000,
    exitCode: 0,
    stdoutHead: "",
    stdoutTail: "",
    stderrHead: "",
    stderrTail: "",
    stdoutBytes: 0,
    stderrBytes: 0,
    truncated: false,
  });

  it("appendCommand keeps events written by other processes", () => {
    const dir = mkdtempSync(join(tmpdir(), "rl-lock-"));
    try {
      writeActive(dir, { ...sampleRun, commands: [] });
      // Simulates two runs that both read the session before either finished.
      expect(appendCommand(dir, sampleRun.id, cmd("a"))).toBe(true);
      expect(appendCommand(dir, sampleRun.id, cmd("b"))).toBe(true);
      expect(readActive(dir)?.commands.map((c) => c.command)).toEqual(["a", "b"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("appendCommand does not resurrect a stopped session", () => {
    const dir = mkdtempSync(join(tmpdir(), "rl-lock-"));
    try {
      writeActive(dir, { ...sampleRun, commands: [] });
      clearActive(dir);
      expect(appendCommand(dir, sampleRun.id, cmd("late"))).toBe(false);
      expect(readActive(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("withSessionLock releases the lock after an error", () => {
    const dir = mkdtempSync(join(tmpdir(), "rl-lock-"));
    try {
      expect(() =>
        withSessionLock(dir, () => {
          throw new Error("boom");
        }),
      ).toThrow("boom");
      expect(existsSync(join(dir, ".runledger", "active.lock"))).toBe(false);
      expect(withSessionLock(dir, () => 42)).toBe(42);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("ensureRoot", () => {
  it("writes a .gitignore so recordings are never committed", () => {
    const dir = mkdtempSync(join(tmpdir(), "rl-root-"));
    try {
      writeActive(dir, { ...sampleRun, commands: [] });
      const ignore = join(dir, ".runledger", ".gitignore");
      expect(existsSync(ignore)).toBe(true);
      expect(readFileSync(ignore, "utf8")).toMatch(/^\*$/m);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

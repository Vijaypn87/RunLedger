import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  rmSync,
  readdirSync,
  statSync,
  openSync,
  closeSync,
} from "node:fs";
import { join } from "node:path";
import type { CommandEvent, RunLedgerRun } from "./types.js";

export function serializeRun(run: RunLedgerRun): string {
  return JSON.stringify(run, null, 2);
}

export function deserializeRun(json: string): RunLedgerRun {
  const parsed = JSON.parse(json) as unknown;
  if (
    !parsed ||
    typeof parsed !== "object" ||
    (parsed as { schemaVersion?: unknown }).schemaVersion !== 1
  ) {
    throw new Error("Unsupported RunLedger schema version (expected 1).");
  }
  return parsed as RunLedgerRun;
}

function ensureDir(d: string) {
  mkdirSync(d, { recursive: true });
}

function atomicWrite(path: string, contents: string) {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, contents, "utf8");
  renameSync(tmp, path);
}

export function runledgerRoot(cwd: string): string {
  return join(cwd, ".runledger");
}

export function runDir(cwd: string, id: string): string {
  return join(runledgerRoot(cwd), "runs", id);
}

export function writeRun(cwd: string, run: RunLedgerRun): void {
  const dir = runDir(cwd, run.id);
  ensureDir(dir);
  atomicWrite(join(dir, "run.json"), serializeRun(run));
}

export function readRun(cwd: string, id: string): RunLedgerRun {
  const file = join(runDir(cwd, id), "run.json");
  return deserializeRun(readFileSync(file, "utf8"));
}

export function writeActive(cwd: string, run: RunLedgerRun): void {
  ensureDir(runledgerRoot(cwd));
  atomicWrite(join(runledgerRoot(cwd), "active.json"), serializeRun(run));
}

export function readActive(cwd: string): RunLedgerRun | null {
  const file = join(runledgerRoot(cwd), "active.json");
  if (!existsSync(file)) return null;
  return deserializeRun(readFileSync(file, "utf8"));
}

export function clearActive(cwd: string): void {
  const file = join(runledgerRoot(cwd), "active.json");
  if (existsSync(file)) rmSync(file);
}

export function listFinalizedRunIds(cwd: string): string[] {
  const runs = join(runledgerRoot(cwd), "runs");
  if (!existsSync(runs)) return [];
  return readdirSync(runs).filter((name) => {
    try {
      return (
        statSync(join(runs, name)).isDirectory() &&
        existsSync(join(runs, name, "run.json"))
      );
    } catch {
      return false;
    }
  });
}

const LOCK_STALE_MS = 30_000;
const LOCK_TIMEOUT_MS = 10_000;

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Run `fn` while holding an exclusive lock on the session state, so concurrent
 * `runledger run` / `stop` processes don't overwrite each other's writes.
 * A lock older than LOCK_STALE_MS is assumed to belong to a crashed process.
 */
export function withSessionLock<T>(cwd: string, fn: () => T): T {
  ensureDir(runledgerRoot(cwd));
  const lock = join(runledgerRoot(cwd), "active.lock");
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  for (;;) {
    try {
      closeSync(openSync(lock, "wx"));
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      try {
        if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) {
          rmSync(lock, { force: true });
          continue;
        }
      } catch {
        continue; // lock vanished between open and stat; retry
      }
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for RunLedger lock at ${lock}.`);
      }
      sleepSync(25);
    }
  }
  try {
    return fn();
  } finally {
    rmSync(lock, { force: true });
  }
}

/**
 * Append a command to the active session under the lock. Re-reads the session
 * so events from parallel runs are kept. Returns false if the session was
 * stopped (or replaced) while the command was running.
 */
export function appendCommand(cwd: string, runId: string, event: CommandEvent): boolean {
  return withSessionLock(cwd, () => {
    const active = readActive(cwd);
    if (!active || active.id !== runId) return false;
    active.commands.push(event);
    writeActive(cwd, active);
    return true;
  });
}

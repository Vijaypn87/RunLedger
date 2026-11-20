import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  rmSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import type { RunLedgerRun } from "./types.js";

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
  const tmp = `${path}.tmp`;
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

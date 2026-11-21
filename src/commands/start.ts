import { mkdirSync } from "node:fs";
import { resolvePaths, generateRunId } from "../config.js";
import { takeSnapshot, getBranch, getCommitSha } from "../git.js";
import { readActive, writeActive, withSessionLock } from "../core/storage.js";
import type { RunLedgerRun } from "../core/types.js";

/** Begin a session. Returns null if one is already active. */
export function createSession(cwd: string): RunLedgerRun | null {
  return withSessionLock(cwd, () => {
    if (readActive(cwd)) return null;
    mkdirSync(resolvePaths(cwd).runsDir, { recursive: true });
    const run: RunLedgerRun = {
      id: generateRunId(),
      startTime: new Date().toISOString(),
      cwd,
      branch: getBranch(cwd),
      commitSha: getCommitSha(cwd),
      initialGit: takeSnapshot(cwd),
      commands: [],
      changedFiles: [],
      risks: [],
      schemaVersion: 1,
    };
    writeActive(cwd, run);
    return run;
  });
}

export function start(cwd: string): void {
  const run = createSession(cwd);
  if (!run) {
    const p = resolvePaths(cwd);
    console.error(`A RunLedger session is already active.`);
    console.error(
      `Run \`runledger stop\` to finalize it, or remove ${p.activePath} to discard it.`,
    );
    process.exit(1);
  }
  const id = run.id;
  console.log(`▸ RunLedger session started.`);
  console.log(`  Run id: ${id}`);
  console.log(`  Branch: ${run.branch || "(none)"}`);
  console.log(`  Run \`runledger run -- <command>\` to record commands.`);
  console.log(`  Run \`runledger stop\` when finished.`);
}

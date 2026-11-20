import { existsSync, mkdirSync } from "node:fs";
import { resolvePaths, generateRunId } from "../config.js";
import { takeSnapshot, getBranch, getCommitSha } from "../git.js";
import { writeActive } from "../core/storage.js";
import type { RunLedgerRun } from "../core/types.js";

export function start(cwd: string): void {
  const p = resolvePaths(cwd);
  if (existsSync(p.activePath)) {
    console.error(`An RunLedger session is already active.`);
    console.error(
      `Run \`runledger stop\` to finalize it, or remove ${p.activePath} to discard it.`,
    );
    process.exit(1);
  }
  mkdirSync(p.runsDir, { recursive: true });

  const id = generateRunId();
  const run: RunLedgerRun = {
    id,
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
  console.log(`▸ RunLedger session started.`);
  console.log(`  Run id: ${id}`);
  console.log(`  Branch: ${run.branch || "(none)"}`);
  console.log(`  Run \`runledger run -- <command>\` to record commands.`);
  console.log(`  Run \`runledger stop\` when finished.`);
}

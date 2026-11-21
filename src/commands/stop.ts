import { writeFileSync } from "node:fs";
import { resolvePaths } from "../config.js";
import { readActive, writeRun, clearActive, withSessionLock } from "../core/storage.js";
import { takeSnapshot, sessionChanges } from "../git.js";
import { detectRisks } from "../core/risks.js";
import { renderMarkdown } from "../core/summary.js";
import { renderReport } from "../core/report.js";
import type { RunLedgerRun } from "../core/types.js";

export function stop(cwd: string): void {
  // Hold the lock while finalizing so a command finishing in parallel can't
  // write to the session after it has been read here.
  const active = withSessionLock(cwd, () => {
    const a = readActive(cwd);
    if (!a) return null;
    finalize(cwd, a);
    return a;
  });
  if (!active) {
    console.error("No active RunLedger session.");
    process.exit(1);
  }
  const p = resolvePaths(cwd);
  console.log("✓ RunLedger run finalized.");
  console.log(`  Run id: ${active.id}`);
  console.log(`  Report: ${p.reportHtml(active.id)}`);
  console.log(`  Open it: runledger open ${active.id}`);
}

function finalize(cwd: string, active: RunLedgerRun): void {
  const p = resolvePaths(cwd);
  active.endTime = new Date().toISOString();
  // First pass finds what changed during the session; if some dirty files
  // predate it, re-take the diff limited to the session's own files.
  let finalGit = takeSnapshot(cwd);
  const { changed, preExisting } = sessionChanges(active.initialGit, finalGit);
  if (preExisting.length > 0) {
    finalGit = takeSnapshot(cwd, { paths: changed.map((f) => f.path) });
  }
  active.finalGit = finalGit;
  active.changedFiles = changed;
  active.preExistingChanges = preExisting;
  active.risks = detectRisks(active);
  active.markdownSummary = renderMarkdown(active);
  active.reportPath = p.reportHtml(active.id);

  writeRun(cwd, active);
  const html = renderReport(active);
  writeFileSync(p.reportHtml(active.id), html, "utf8");
  clearActive(cwd);
}

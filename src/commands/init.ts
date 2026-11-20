import { mkdirSync, existsSync } from "node:fs";
import { resolvePaths } from "../config.js";

export function init(cwd: string): void {
  const p = resolvePaths(cwd);
  const existed = existsSync(p.root);
  mkdirSync(p.runsDir, { recursive: true });
  if (existed) {
    console.log(`RunLedger already initialized at ${p.root}`);
  } else {
    console.log(`RunLedger initialized at ${p.root}`);
  }
}

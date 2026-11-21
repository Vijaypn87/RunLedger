import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { addHooks, removeHooks, type ClaudeSettings } from "../core/claude-settings.js";
import { init } from "./init.js";

function settingsPath(cwd: string, shared: boolean): string {
  // settings.local.json is personal and not committed; settings.json is shared
  // with the team (everyone then needs RunLedger installed).
  return join(cwd, ".claude", shared ? "settings.json" : "settings.local.json");
}

function readSettings(path: string): ClaudeSettings {
  if (!existsSync(path)) return {};
  const text = readFileSync(path, "utf8");
  if (!text.trim()) return {};
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${path} is not a JSON object; not changing it.`);
  }
  return parsed as ClaudeSettings;
}

function writeSettings(path: string, settings: ClaudeSettings): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(settings, null, 2) + "\n", "utf8");
}

export function hooksInstall(cwd: string, opts: { shared?: boolean }): void {
  const path = settingsPath(cwd, !!opts.shared);
  writeSettings(path, addHooks(readSettings(path)));
  init(cwd);
  console.log(`✓ Claude Code hooks installed in ${path}`);
  console.log("  Each Claude Code session in this project is now recorded automatically:");
  console.log("  a run starts with the session, Bash commands are logged, and the");
  console.log("  report is written when the session ends. See `runledger list`.");
  console.log("  Requires the `runledger` command on your PATH (npm link).");
}

export function hooksUninstall(cwd: string, opts: { shared?: boolean }): void {
  const path = settingsPath(cwd, !!opts.shared);
  if (!existsSync(path)) {
    console.log(`No ${path}; nothing to remove.`);
    return;
  }
  writeSettings(path, removeHooks(readSettings(path)));
  console.log(`✓ RunLedger hooks removed from ${path}`);
}

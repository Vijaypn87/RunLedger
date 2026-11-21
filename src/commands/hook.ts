import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolvePaths } from "../config.js";
import { readActive, appendCommand } from "../core/storage.js";
import { commandFromHook, type ClaudeHookInput } from "../core/hook-event.js";
import { createSession } from "./start.js";

/** Project directory for a hook call: Claude Code's project dir, else the event's cwd. */
function projectDir(input: ClaudeHookInput): string {
  return process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
}

/**
 * Finalize in a detached process: Claude Code gives SessionEnd hooks a very
 * short time budget, and building the report can take longer than that.
 */
function stopInBackground(cwd: string): void {
  const cli = process.argv[1];
  if (!cli) return;
  const child = spawn(process.execPath, [cli, "stop"], {
    cwd,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

export function handleHook(input: ClaudeHookInput): void {
  const cwd = projectDir(input);
  // Only record in projects that opted in with `runledger init` / `hooks install`.
  if (!existsSync(resolvePaths(cwd).root)) return;

  switch (input.hook_event_name) {
    case "SessionStart":
      // Resumed/compacted conversations keep the session that is already open.
      createSession(cwd);
      return;
    case "PostToolUse":
    case "PostToolUseFailure": {
      const event = commandFromHook(input);
      const active = event ? readActive(cwd) : null;
      if (event && active) appendCommand(cwd, active.id, event);
      return;
    }
    case "SessionEnd":
      if (readActive(cwd)) stopInBackground(cwd);
      return;
  }
}

/**
 * `runledger hook`: entry point for Claude Code hooks. Reads the event JSON
 * from stdin. It never fails the agent: errors go to stderr and it exits 0.
 * It prints nothing to stdout, since Claude Code adds SessionStart stdout to
 * the model's context.
 */
export function hook(): void {
  try {
    const raw = readFileSync(0, "utf8");
    handleHook(JSON.parse(raw) as ClaudeHookInput);
  } catch (e) {
    console.error(`runledger hook: ${(e as Error).message}`);
  }
  process.exit(0);
}

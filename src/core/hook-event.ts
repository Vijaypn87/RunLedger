import type { CommandEvent } from "./types.js";
import { STDIO_HEAD_TAIL_BYTES } from "./types.js";
import { utf8Head, utf8Tail } from "./bytes.js";

/** The subset of Claude Code's hook stdin JSON that RunLedger reads. */
export interface ClaudeHookInput {
  hook_event_name?: string;
  cwd?: string;
  session_id?: string;
  source?: string;
  reason?: string;
  tool_name?: string;
  tool_input?: { command?: unknown; run_in_background?: unknown };
  tool_response?: { stdout?: unknown; stderr?: unknown; interrupted?: unknown };
  error?: unknown;
  is_interrupt?: unknown;
  duration_ms?: unknown;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function capture(text: string) {
  const buf = Buffer.from(text, "utf8");
  const bytes = buf.length;
  if (bytes <= STDIO_HEAD_TAIL_BYTES) return { head: text, tail: "", bytes, truncated: false };
  return {
    head: utf8Head(buf, STDIO_HEAD_TAIL_BYTES),
    tail: utf8Tail(buf, STDIO_HEAD_TAIL_BYTES),
    bytes,
    truncated: true,
  };
}

/**
 * Turn a PostToolUse / PostToolUseFailure event for Claude Code's Bash tool
 * into a RunLedger command record. Returns null for any other event or tool.
 *
 * Claude Code reports success via PostToolUse (stdout/stderr, no exit code)
 * and failure via PostToolUseFailure, whose `error` starts with "Exit code N".
 */
export function commandFromHook(input: ClaudeHookInput, now: Date = new Date()): CommandEvent | null {
  const event = input.hook_event_name;
  if (input.tool_name !== "Bash") return null;
  if (event !== "PostToolUse" && event !== "PostToolUseFailure") return null;
  const command = str(input.tool_input?.command);
  if (!command) return null;

  const durationMs = typeof input.duration_ms === "number" ? input.duration_ms : 0;
  const endTime = now.toISOString();
  const startTime = new Date(now.getTime() - durationMs).toISOString();

  let exitCode: number | null;
  let stdout: string;
  let stderr: string;
  let signal: string | undefined;
  if (event === "PostToolUse") {
    const interrupted = input.tool_response?.interrupted === true;
    exitCode = interrupted ? null : 0;
    signal = interrupted ? "interrupted" : undefined;
    stdout = str(input.tool_response?.stdout);
    stderr = str(input.tool_response?.stderr);
  } else {
    const error = str(input.error);
    const m = /^Exit code (-?\d+)\s*(?:\r?\n|$)/.exec(error);
    if (input.is_interrupt === true) {
      exitCode = null;
      signal = "interrupted";
    } else {
      // Not every failure has an exit code (e.g. a timeout); count it as 1.
      exitCode = m ? parseInt(m[1]!, 10) : 1;
    }
    stdout = "";
    stderr = m ? error.slice(m[0].length) : error;
  }

  const out = capture(stdout);
  const err = capture(stderr);
  return {
    command,
    startTime,
    endTime,
    durationMs,
    exitCode,
    signal,
    stdoutHead: out.head,
    stdoutTail: out.tail,
    stderrHead: err.head,
    stderrTail: err.tail,
    stdoutBytes: out.bytes,
    stderrBytes: err.bytes,
    truncated: out.truncated || err.truncated,
  };
}

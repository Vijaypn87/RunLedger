import { spawn } from "node:child_process";
import { constants } from "node:os";
import { readActive, appendCommand } from "../core/storage.js";
import type { CommandEvent } from "../core/types.js";
import { STDIO_HEAD_TAIL_BYTES } from "../core/types.js";
import { utf8Head, utf8Tail } from "../core/bytes.js";
import { buildCommand } from "../core/shell.js";

function captureHeadTail(
  buf: Buffer,
  cap: number,
): { head: string; tail: string; bytes: number; truncated: boolean } {
  const bytes = buf.length;
  if (bytes <= cap) {
    return { head: buf.toString("utf8"), tail: "", bytes, truncated: false };
  }
  return {
    head: utf8Head(buf, cap),
    tail: utf8Tail(buf, cap),
    bytes,
    truncated: true,
  };
}

export async function run(cwd: string, commandArgs: string[]): Promise<void> {
  const active = readActive(cwd);
  if (!active) {
    console.error("No active RunLedger session. Run `runledger start` first.");
    process.exit(1);
  }
  if (commandArgs.length === 0) {
    console.error("Usage: runledger run -- <command>");
    process.exit(1);
  }
  const cmdString = buildCommand(commandArgs);
  const startIso = new Date().toISOString();
  const startMs = Date.now();

  const child = spawn(cmdString, { cwd, shell: true });

  const outChunks: Buffer[] = [];
  const errChunks: Buffer[] = [];

  child.stdout.on("data", (c: Buffer) => {
    outChunks.push(c);
    process.stdout.write(c);
  });
  child.stderr.on("data", (c: Buffer) => {
    errChunks.push(c);
    process.stderr.write(c);
  });

  // The terminal sends Ctrl-C to the child too. Keep RunLedger alive so the
  // interrupted command is still recorded, and let the child decide how to exit.
  const forwarded: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP"];
  const ignore = () => {};
  for (const sig of forwarded) process.on(sig, ignore);

  const result = await new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
    error?: Error;
  }>((resolve) => {
    child.on("error", (error) => resolve({ code: null, signal: null, error }));
    child.on("close", (code, signal) => resolve({ code, signal }));
  });

  for (const sig of forwarded) process.off(sig, ignore);
  if (result.error) {
    errChunks.push(Buffer.from(`runledger: failed to start command: ${result.error.message}
`));
    console.error(`runledger: failed to start command: ${result.error.message}`);
  }

  const endIso = new Date().toISOString();
  const durationMs = Date.now() - startMs;

  const out = captureHeadTail(Buffer.concat(outChunks), STDIO_HEAD_TAIL_BYTES);
  const err = captureHeadTail(Buffer.concat(errChunks), STDIO_HEAD_TAIL_BYTES);

  const event: CommandEvent = {
    command: cmdString,
    startTime: startIso,
    endTime: endIso,
    durationMs,
    exitCode: result.code,
    signal: result.signal ?? undefined,
    stdoutHead: out.head,
    stdoutTail: out.tail,
    stderrHead: err.head,
    stderrTail: err.tail,
    stdoutBytes: out.bytes,
    stderrBytes: err.bytes,
    truncated: out.truncated || err.truncated,
  };

  if (!appendCommand(cwd, active.id, event)) {
    console.error(
      "runledger: the session was stopped while this command ran; it was not recorded.",
    );
  }

  // Mirror the shell convention: killed by signal N -> exit 128 + N.
  const sigNum = result.signal ? constants.signals[result.signal] : undefined;
  process.exit(result.code ?? (sigNum ? 128 + sigNum : 1));
}

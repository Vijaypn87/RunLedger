import { describe, it, expect } from "vitest";
import { commandFromHook } from "../core/hook-event.js";
import { addHooks, removeHooks, HOOK_COMMAND } from "../core/claude-settings.js";

const now = new Date("2026-01-01T00:00:10.000Z");

describe("commandFromHook", () => {
  it("records a successful Bash call from PostToolUse", () => {
    const e = commandFromHook(
      {
        hook_event_name: "PostToolUse",
        tool_name: "Bash",
        tool_input: { command: "npm test" },
        tool_response: { stdout: "ok\n", stderr: "", interrupted: false },
        duration_ms: 2000,
      },
      now,
    );
    expect(e).toMatchObject({
      command: "npm test",
      exitCode: 0,
      durationMs: 2000,
      stdoutHead: "ok\n",
      startTime: "2026-01-01T00:00:08.000Z",
      endTime: "2026-01-01T00:00:10.000Z",
    });
  });

  it("reads the exit code from a PostToolUseFailure error", () => {
    const e = commandFromHook(
      {
        hook_event_name: "PostToolUseFailure",
        tool_name: "Bash",
        tool_input: { command: "npm test" },
        error: "Exit code 2\nError: Cannot find module 'express'",
        is_interrupt: false,
      },
      now,
    );
    expect(e?.exitCode).toBe(2);
    expect(e?.stderrHead).toBe("Error: Cannot find module 'express'");
  });

  it("marks interrupted commands", () => {
    const e = commandFromHook(
      {
        hook_event_name: "PostToolUseFailure",
        tool_name: "Bash",
        tool_input: { command: "sleep 100" },
        error: "Interrupted by user",
        is_interrupt: true,
      },
      now,
    );
    expect(e?.exitCode).toBeNull();
    expect(e?.signal).toBe("interrupted");
  });

  it("counts a failure without an exit code as exit 1", () => {
    const e = commandFromHook(
      {
        hook_event_name: "PostToolUseFailure",
        tool_name: "Bash",
        tool_input: { command: "slow" },
        error: "Command timed out",
      },
      now,
    );
    expect(e?.exitCode).toBe(1);
  });

  it("ignores other tools and events", () => {
    expect(
      commandFromHook({ hook_event_name: "PostToolUse", tool_name: "Write", tool_input: {} }, now),
    ).toBeNull();
    expect(
      commandFromHook(
        { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "ls" } },
        now,
      ),
    ).toBeNull();
  });
});

describe("Claude Code settings merge", () => {
  const other = { type: "command", command: "./lint.sh" };

  it("adds hooks for the four events and keeps the user's own hooks", () => {
    const out = addHooks({
      model: "x",
      hooks: { PostToolUse: [{ matcher: "Write", hooks: [other] }] },
    });
    expect(out.model).toBe("x");
    expect(Object.keys(out.hooks!).sort()).toEqual(
      ["PostToolUse", "PostToolUseFailure", "SessionEnd", "SessionStart"].sort(),
    );
    expect(out.hooks!.PostToolUse).toHaveLength(2);
    expect(out.hooks!.PostToolUse![0]!.hooks).toEqual([other]);
    expect(out.hooks!.PostToolUse![1]).toMatchObject({
      matcher: "Bash",
      hooks: [{ type: "command", command: HOOK_COMMAND }],
    });
  });

  it("is idempotent", () => {
    const once = addHooks({});
    expect(addHooks(once)).toEqual(once);
  });

  it("uninstall removes only RunLedger's hooks", () => {
    const installed = addHooks({ hooks: { PostToolUse: [{ matcher: "Write", hooks: [other] }] } });
    expect(removeHooks(installed)).toEqual({
      hooks: { PostToolUse: [{ matcher: "Write", hooks: [other] }] },
    });
    expect(removeHooks(addHooks({}))).toEqual({});
  });
});

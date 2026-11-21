/** Command Claude Code runs for every RunLedger hook. */
export const HOOK_COMMAND = "runledger hook";

interface Handler {
  type?: string;
  command?: string;
  [k: string]: unknown;
}
interface MatcherGroup {
  matcher?: string;
  hooks?: Handler[];
  [k: string]: unknown;
}
export type ClaudeSettings = { hooks?: Record<string, MatcherGroup[]>; [k: string]: unknown };

/** Events RunLedger listens to, and the tool matcher for each. */
const EVENTS: Array<[string, string | undefined]> = [
  ["SessionStart", undefined],
  ["PostToolUse", "Bash"],
  ["PostToolUseFailure", "Bash"],
  ["SessionEnd", undefined],
];

const isOurs = (h: Handler) => h.type === "command" && h.command === HOOK_COMMAND;

/** Remove RunLedger's handlers, dropping groups and events left empty. Other hooks are untouched. */
export function removeHooks(settings: ClaudeSettings): ClaudeSettings {
  const out: ClaudeSettings = { ...settings };
  if (!settings.hooks) return out;
  const hooks: Record<string, MatcherGroup[]> = {};
  for (const [event, groups] of Object.entries(settings.hooks)) {
    const kept = groups
      .map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((h) => !isOurs(h)) }))
      .filter((g) => g.hooks.length > 0);
    if (kept.length > 0) hooks[event] = kept;
  }
  if (Object.keys(hooks).length > 0) out.hooks = hooks;
  else delete out.hooks;
  return out;
}

/** Add RunLedger's handlers. Idempotent: installing twice gives the same result. */
export function addHooks(settings: ClaudeSettings): ClaudeSettings {
  const out = removeHooks(settings);
  const hooks: Record<string, MatcherGroup[]> = { ...(out.hooks ?? {}) };
  for (const [event, matcher] of EVENTS) {
    const group: MatcherGroup = {
      ...(matcher ? { matcher } : {}),
      hooks: [{ type: "command", command: HOOK_COMMAND, timeout: 30 }],
    };
    hooks[event] = [...(hooks[event] ?? []), group];
  }
  out.hooks = hooks;
  return out;
}

#!/usr/bin/env node
import { Command } from "commander";
import { init } from "./commands/init.js";
import { start } from "./commands/start.js";
import { run } from "./commands/run.js";
import { stop } from "./commands/stop.js";
import { status } from "./commands/status.js";
import { report } from "./commands/report.js";
import { list } from "./commands/list.js";
import { open } from "./commands/open.js";
import { hook } from "./commands/hook.js";
import { hooksInstall, hooksUninstall } from "./commands/hooks-install.js";

const program = new Command();

program
  .name("runledger")
  .description(
    "Open-source observability for AI coding agents. See what your AI coding agent actually did.",
  )
  .version("0.1.0");

program
  .command("init")
  .description("Initialize .runledger/ in the current directory.")
  .action(() => init(process.cwd()));

program
  .command("start")
  .description("Begin a recording session.")
  .action(() => start(process.cwd()));

program
  .command("run")
  .description("Run a shell command and record it into the active session.")
  .argument("[args...]", "Command to run (use `--` to separate RunLedger args from the command).")
  .allowUnknownOption(true)
  .action(async (args: string[]) => {
    await run(process.cwd(), args ?? []);
  });

program
  .command("stop")
  .description("Finalize the active session and generate the report.")
  .action(() => stop(process.cwd()));

program
  .command("status")
  .description("Show whether a session is active and key live stats.")
  .action(() => status(process.cwd()));

program
  .command("report")
  .description("Regenerate the report for the most recent run.")
  .action(() => report(process.cwd()));

program
  .command("list")
  .description("List finalized runs.")
  .action(() => list(process.cwd()));

program
  .command("open")
  .description("Open a run's report in the default browser.")
  .argument("<run-id>", "Run id from `runledger list`.")
  .action((id: string) => open(process.cwd(), id));

program
  .command("hook")
  .description("Entry point for Claude Code hooks (reads the event JSON from stdin).")
  .action(() => hook());

const hooksCmd = program
  .command("hooks")
  .description("Record Claude Code sessions automatically via its hooks.");

hooksCmd
  .command("install")
  .description("Add RunLedger hooks to .claude/settings.local.json in this project.")
  .option("--shared", "Write to .claude/settings.json (committed, shared with the team) instead.")
  .action((opts: { shared?: boolean }) => hooksInstall(process.cwd(), opts));

hooksCmd
  .command("uninstall")
  .description("Remove RunLedger hooks from the Claude Code settings.")
  .option("--shared", "Remove from .claude/settings.json instead.")
  .action((opts: { shared?: boolean }) => hooksUninstall(process.cwd(), opts));

program.addHelpText(
  "after",
  `
Notes:
  runledger run -- <command>  executes through your shell
                              (\`/bin/sh -c "..."\` on Unix, \`cmd.exe /d /s /c\` on Windows).
                              Arguments keep their quoting; pass one quoted string
                              to use shell operators: runledger run -- "a && b"

Examples:
  $ runledger init
  $ runledger start
  $ runledger run -- npm test
  $ runledger run -- npm run build
  $ runledger stop
  $ runledger open run_20260529T144700Z_a1b2c3
`,
);

program.parseAsync(process.argv).catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});

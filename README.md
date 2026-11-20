# RunLedger

**Open-source observability for AI coding agents.**
**See what your AI coding agent actually did.**

RunLedger records an AI coding-agent session and generates a polished local HTML report — what changed, what commands ran, what passed or failed, what looks risky — so you can review the agent's work before committing.

No cloud. No backend. No telemetry. Just a `.runledger/` directory in your project.

---

## Why this exists

AI coding agents are productive — and opaque. They edit dozens of files, run scripts, install dependencies, hit some failures, retry, and hand you back a "done." Reviewing what happened means scrolling through chat transcripts and reconciling them with `git status`.

RunLedger collapses that into one local report: a single HTML page showing every shell command, every file change, every risky touch (env files, lockfiles, migrations, deletions), and a copyable Markdown summary for your PR description.

It's the "look at this before you `git commit -am 'agent stuff'`" tool.

---

## Install

Requires Node.js ≥ 18.

```bash
# from a clone (pre-publish)
git clone <this repo>
cd runledger
npm install
npm run build
npm link
```

Once `npm link`-ed, `runledger` is on your `$PATH`.

---

## Quickstart

```bash
# In the project the agent will work on:
runledger init                              # one-time per project
runledger start                             # begin recording
runledger run -- npm test                   # record any shell command
runledger run -- npm run build
runledger run -- node scripts/migrate.js
runledger stop                              # finalize and generate the report
runledger open <run-id>                     # open the report in your browser
```

The CLI prints the report path on `stop`. You can also regenerate with `runledger report`, list previous runs with `runledger list`, and check live state with `runledger status`.

---

## Commands

| Command | What it does |
|---|---|
| `runledger init` | Create `.runledger/` in the current directory. |
| `runledger start` | Begin a recording session. Fails if one is already active. |
| `runledger run -- <cmd>` | Run a shell command, stream its output, record stdout/stderr summaries + exit code into the active session. |
| `runledger stop` | Finalize the session: capture final git state, detect risks, render the HTML report and Markdown summary. |
| `runledger status` | Show whether a session is active and key live stats (commands recorded, live changed-file count). |
| `runledger report` | Regenerate the report for the most recent run. |
| `runledger list` | List finalized runs (newest first) as a table. |
| `runledger open <run-id>` | Open that run's `report.html` in the default browser. |

`runledger run -- <command>` executes through your shell (`/bin/sh -c "..."` on Unix, `cmd.exe /d /s /c` on Windows). Quote and escape per your shell's rules.

---

## What goes in the report

The HTML report is a single self-contained dark-themed dashboard (no CDN, no fetch on load, responsive down to phone width) with a section navigation sidebar. It contains:

1. **Overview** — "Review before commit" KPI cards (highest risk, changed files, failed commands, dependency/config/secret-like files, tests, duration) plus charts for command outcomes, risk distribution and change types.
2. **Risks** — every risk RunLedger detected, grouped by severity.
3. **Activity log** — chronological timeline: session start, each command with time, duration and verdict, session end.
4. **Shell commands** — expandable stdout/stderr per command, with All / Failed / Passed filters.
5. **Tests** — recorded commands that look like test runs (`npm test`, `vitest`, `pytest`, `cargo test`, `go test`, …) with pass/fail by exit code. This is detected from the command text and exit code only; individual test cases are not parsed.
6. **Git changes** — changed files grouped by status, per-file diff-stat bars, and a collapsible, colour-coded full diff.
7. **Markdown summary** — copyable, for pasting into PR descriptions.

Sections with no data show an explicit empty state instead of being hidden.

### Risk rules

RunLedger flags:

- **High** — `.env`, credentials, `*.pem`, or secret-like files touched. Three or more commands failing.
- **Medium** — `package.json` / lockfile changes. CI config (`.github/workflows/*`, `.gitlab-ci.yml`, `.circleci/*`, `.travis.yml`, `azure-pipelines.yml`) changes. Git config (`.gitignore`, `.gitattributes`, `.gitmodules`). Migration files. Deleted files. Large diff (>500 lines or >20 files). Any failed command.

---

## Storage layout

```
your-project/
  .runledger/
    active.json                       # in-progress run pointer (if any)
    runs/
      run_20260529T144700Z_a1b2c3/
        run.json                      # full recording
        report.html                   # generated report
```

Everything is local. Diffs > 256 KB are stored as a head + tail with a truncation marker (no gzip in v1 — JSON stays human-readable). Per-command stdout/stderr is captured as a 4 KB head + 4 KB tail with a `truncated` flag, so you never silently lose the fact that output was truncated.

Add `.runledger/` to `.gitignore` — these recordings are local artifacts, not source.

---

## Sample output

After running `runledger stop`:

```
✓ RunLedger run finalized.
  Run id: run_20260529T192518Z_cfnq9r
  Report: /path/to/your-project/.runledger/runs/run_20260529T192518Z_cfnq9r/report.html
  Open it: runledger open run_20260529T192518Z_cfnq9r
```

And `runledger list`:

```
ID                              BRANCH        STARTED                   DURATION    CMDS  FILES RISK
run_20260529T192518Z_cfnq9r     main          2026-05-29T19:25:18.269Z  219ms       2     3     high
```

Markdown summary (copyable from the report):

```markdown
# RunLedger Run Summary

Branch: main
Commit: abc1234
Duration: 4m 12s

## What Happened
- Ran 3 commands
- Changed 5 files
- 1 command(s) failed

## Risk Flags
- High: Secret-like file touched
- Medium: package.json changed

## Commands
- npm test — failed in 12s
- npm run build — passed in 31s

## Changed Files
- src/auth.ts
- package.json
```

---

## Roadmap

- Filter / search across runs
- Per-agent attribution (Claude, Cursor, Aider, custom)
- Optional shared dashboard for teams
- Auto-record without an explicit `start` (shell hook integration)
- Configurable risk rules per project

---

## Contributing

```bash
git clone <repo>
cd runledger
npm install
npm test          # run the test suite
npm run build     # compile to dist/
npm run typecheck # type-only check
```

The architecture is intentionally simple — modules under `src/core/` are pure functions over the `RunLedgerRun` data model; everything else (`src/git.ts`, `src/commands/*`) is a thin I/O wrapper. Tests live in `src/tests/` and target the pure layer. See `docs/spec.md` for the full design.

Issues and PRs welcome.

---

## License

MIT. See `LICENSE` and `NOTICE`.

RunLedger is derived from the MIT-licensed project AgentLens; the original copyright notice is retained in `LICENSE`.

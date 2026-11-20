# RunLedger — Design Spec

**Tagline:** See what your AI coding agent actually did.
**Positioning:** Open-source observability for AI coding agents.

RunLedger is a local-first TypeScript CLI that records an AI coding-agent session and produces a polished static HTML report. It surfaces what changed, what commands ran, what passed or failed, and what looks risky — so the developer can review the agent's work before committing.

The product is local-first: no backend, no network calls, no telemetry.

---

## 1. CLI surface

All commands run inside the developer's working directory. RunLedger persists state under `.runledger/` in that directory.

| Command | Purpose |
|---|---|
| `runledger init` | Create `.runledger/` if missing. Idempotent. |
| `runledger start` | Begin a recording session. Errors if one is already active. |
| `runledger run -- <command>` | Execute `<command>` through the user's shell, stream output, capture summary into the active session. |
| `runledger stop` | Finalize the active session, write the HTML report and markdown summary. |
| `runledger status` | Show whether a session is active and key live stats. |
| `runledger report` | Regenerate the report for the most recent run. |
| `runledger list` | List previous runs (newest first). |
| `runledger open <run-id>` | Open that run's `report.html` in the default browser. |

### 1.1 `init`
Creates `.runledger/` and `.runledger/runs/`. Prints the absolute path. Safe to run multiple times.

### 1.2 `start`
Captures the initial environment and writes `.runledger/active.json`. If `.runledger/active.json` already exists, **fail** with a clear message:

```
An RunLedger session is already active (run: <id>).
Run `runledger stop` to finalize it, or remove .runledger/active.json to discard it.
```

No `--force` flag in v1 — overwriting is too dangerous when the value of the tool is preserving an audit trail.

Captures at start time:
- `id` — millisecond timestamp + 6-char random suffix (e.g. `run_20260529T144700Z_a1b2c3`)
- `startTime` — ISO 8601
- `cwd`
- `branch` — `git rev-parse --abbrev-ref HEAD` (empty string if not a git repo)
- `commitSha` — `git rev-parse HEAD` (empty string if not a git repo)
- `initialGit` — `GitSnapshot` taken now

### 1.3 `run -- <command>`
Executes the command **through the user's shell** via `spawn(cmd, { shell: true })`. This is intentional so users can pipe, chain, and use shell features.

> **Note in the docs and `--help` output:** `runledger run -- <command>` runs the command through your shell (`/bin/sh -c "..."` on Unix, `cmd.exe /d /s /c` on Windows). Quoting follows shell rules.

While running:
- stdout streams to the user's terminal in real time
- stderr streams to the user's terminal in real time
- both streams are captured into an in-memory buffer
- start/end timestamps are recorded
- exit code is recorded (signal-killed → exit code 128 + signal number, by Node convention)

If no session is active, fail with:
```
No active RunLedger session. Run `runledger start` first.
```

### 1.4 `stop`
- Captures `finalGit` (GitSnapshot)
- Computes `changedFiles` from final git status
- Runs risk detection (`risks.ts`)
- Generates `markdownSummary` (`summary.ts`)
- Generates `report.html` (`report.ts`)
- Writes `.runledger/runs/<id>/run.json` and `.runledger/runs/<id>/report.html`
- Removes `.runledger/active.json`
- Prints the path to the generated report

If no session is active, fail with a clear message.

### 1.5 `status`
- If active: prints active run id, start time (and "X minutes ago"), cwd, branch, number of recorded commands, and — if inside a git repo — current changed-file count from `git status --short`.
- If not active: prints "No active RunLedger session." and the path to the most recent finalized run, if any.

### 1.6 `report`
Regenerates `report.html` and `markdownSummary` from the most recent finalized run's `run.json`. Does not require an active session.

### 1.7 `list`
Lists finalized runs newest-first as a small table: `id`, `branch`, `startTime`, `duration`, `# commands`, `# changed files`, highest risk level.

### 1.8 `open <run-id>`
Opens `.runledger/runs/<run-id>/report.html` via the platform opener:
- macOS: `open <path>`
- Linux: `xdg-open <path>`
- Windows: `cmd /c start "" <path>`

Errors clearly if the run id doesn't exist.

---

## 2. Storage

```
.runledger/
  active.json                 # pointer to the in-progress run, if any
  runs/
    <run-id>/
      run.json                # full RunLedgerRun record
      report.html             # standalone HTML report
```

- `active.json` contains the in-progress `RunLedgerRun` (so a crash mid-session does not lose recorded commands).
- `run.json` is the finalized record. It is the single source of truth for `report` regeneration.
- Files are written atomically: write to `*.tmp` and `fs.rename` into place.

No SQLite, no databases, no network.

---

## 3. Data model

```ts
// core/types.ts

export interface GitSnapshot {
  isGitRepo: boolean;
  statusShort: string;       // output of `git status --short`
  diffStat: string;          // output of `git diff --stat`
  diffNameStatus: string;    // output of `git diff --name-status`
  fullDiff: string;          // output of `git diff`, see "diff capture" below
  fullDiffTruncated: boolean;
  fullDiffHead?: string;     // present iff fullDiffTruncated
  fullDiffTail?: string;     // present iff fullDiffTruncated
  fullDiffBytes: number;     // bytes of the untruncated diff
}

export interface CommandEvent {
  command: string;
  startTime: string;         // ISO 8601
  endTime: string;           // ISO 8601
  durationMs: number;
  exitCode: number | null;   // null if killed before exit
  signal?: string;           // e.g. "SIGTERM"
  stdoutHead: string;        // first ~4KB of stdout
  stdoutTail: string;        // last ~4KB of stdout (empty if not truncated)
  stderrHead: string;
  stderrTail: string;
  stdoutBytes: number;       // total bytes seen
  stderrBytes: number;
  truncated: boolean;        // true iff either stream exceeded the cap
}

export type RiskLevel = "low" | "medium" | "high";

export interface RiskFlag {
  level: RiskLevel;
  title: string;
  detail: string;
  file?: string;
}

export interface ChangedFile {
  path: string;
  status: "A" | "M" | "D" | "R" | "C" | "U" | "?";
  // Derived from `git status --short` + `git diff --name-status`
}

export interface RunLedgerRun {
  id: string;
  startTime: string;
  endTime?: string;           // set on stop
  cwd: string;
  branch: string;
  commitSha: string;
  initialGit: GitSnapshot;
  finalGit?: GitSnapshot;
  commands: CommandEvent[];
  changedFiles: ChangedFile[];
  risks: RiskFlag[];
  markdownSummary?: string;
  reportPath?: string;        // absolute path to report.html
  schemaVersion: 1;
}
```

### 3.1 Command output capture

- Cap per stream: **4096 bytes** for head and **4096 bytes** for tail.
- If the stream is `≤ 4096` bytes: `stdoutHead = entire output`, `stdoutTail = ""`, `truncated = false` for that stream.
- If larger: `stdoutHead = first 4096 bytes`, `stdoutTail = last 4096 bytes`, `truncated = true`.
- The combined `truncated` boolean on the event is `true` if either stdout or stderr was truncated.
- `stdoutBytes` and `stderrBytes` always reflect the full byte count seen.

### 3.2 Diff capture

- Diff is stored as raw text in `fullDiff`.
- If the raw diff is `> 256 KB`:
  - `fullDiffTruncated = true`
  - `fullDiffHead = first 128 KB`
  - `fullDiffTail = last 128 KB`
  - `fullDiff = ""` (the head + tail carry the content)
- `fullDiffBytes` is the byte length of the untruncated diff.
- **No gzip in v1.** Keeping JSON human-readable is more valuable than the size savings for the first release.

---

## 4. Git capture

All git access goes through `src/git.ts`. Each helper:
- runs `child_process.execFileSync('git', [...], { cwd, encoding: 'utf8' })`
- catches errors and returns sensible empty values
- treats "not a git repo" as a first-class state (no exception), via `git rev-parse --is-inside-work-tree`

Helpers:
- `isGitRepo(cwd): boolean`
- `getBranch(cwd): string`
- `getCommitSha(cwd): string`
- `getStatusShort(cwd): string`
- `getDiffStat(cwd): string`
- `getDiffNameStatus(cwd): string`
- `getFullDiff(cwd): string`
- `takeSnapshot(cwd): GitSnapshot`  — composes the above and applies the truncation rules

For non-git directories, snapshots return `isGitRepo: false` and empty strings. RunLedger still works — it just records commands without diff context, and the report shows an empty-state for changed files.

---

## 5. Risk detection (`core/risks.ts`)

Pure function: `detectRisks(run: RunLedgerRun): RiskFlag[]`. Operates only on the run data; no I/O.

| Rule | Level | When |
|---|---|---|
| `.env`-like file touched | **high** | changed path matches `/(^|/)\.env(\..*)?$/` or `secret`/`credentials`/`key.pem` heuristics |
| `package.json` changed | medium | path ends with `/package.json` |
| Lockfile changed | medium | `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb`, `Cargo.lock`, `poetry.lock`, `Gemfile.lock`, `go.sum` |
| CI config changed | medium | path under `.github/workflows/`, `.gitlab-ci.yml`, `.circleci/`, `.travis.yml`, `azure-pipelines.yml` |
| Git config file changed | medium | `.gitignore`, `.gitattributes`, `.gitmodules` |
| Migration file changed | medium | path contains `/migrations/` or `/migrate/` or matches `*_migration.*` |
| Deleted files | medium | any change with status `D` |
| Large diff | medium | `> 500` added+removed lines (from `diffStat`) OR `> 20` changed files |
| Failed command | medium | any `CommandEvent` with `exitCode != 0` (counts once per failed command) |
| Many failed commands | high | `≥ 3` failed commands |

Each `RiskFlag` carries `level`, `title`, `detail`, and optionally `file`. Duplicates for the same rule + file are deduped. Risks are sorted high → medium → low for rendering.

---

## 6. Static HTML report (`core/report.ts`)

Pure function: `renderReport(run: RunLedgerRun): string`. Returns a single self-contained HTML document. No external assets, no CDN, no fetch on load. Inline CSS, inline JS only for collapsibles and copy-to-clipboard.

### 6.1 Sections (in order)

Layout: sticky sidebar navigation (collapses to a top bar on narrow screens) plus a main column. Style lives in `core/report-styles.ts`.

1. **Header** — `RunLedger` wordmark, run id, branch, commit (short SHA), start time, duration, overall risk verdict badge.
2. **Overview** — "Review before commit" KPI cards (highest risk, changed files, failed commands, "Dependency / config / secret-like files", tests, duration); donut chart of command outcomes, stacked bars for risk distribution and change types; one-line summary.
3. **Risks** — each flag shows level, title, detail and file. Empty state: "No risks detected."
4. **Activity log** — timeline: session start, each command (time, duration, verdict, exit code), session end. Note shown when no commands were recorded.
5. **Shell commands** — expandable stdout/stderr head/tail per command; All / Failed / Passed filter. Empty state: "No commands recorded."
6. **Tests** — commands whose text matches a known test runner (`isTestCommand`), with pass/fail from exit code. Individual test cases are not parsed.
7. **Git changes** — changed files grouped by status, per-file diff-stat bars (parsed from `git diff --stat`), raw diff stat, collapsible colour-coded full diff (head/tail with a truncation marker when `fullDiffTruncated`). Empty states: "No file changes", "No diff stat", "No diff to show".
8. **Markdown summary** — `<pre>` with a "Copy" button.

### 6.2 Design

- Dark theme: near-black/navy background, electric-blue (`#2f7bff`) primary, charcoal cards with thin blue borders, semantic green/amber/red for status.
- System font stack with monospace for code; hover/transition effects honour `prefers-reduced-motion`.
- Responsive: KPI grid auto-fits; chart grids stack below 1020px; sidebar becomes a top nav below 820px.
- Semantic HTML: `<aside>`, `<nav>`, `<main>`, `<header>`, `<section>`, `<details>`, `<time>`.
- Inline CSS and JS only (filters, section highlight, copy-to-clipboard). No external assets.
- Escapes all user-supplied text (commands, file paths, stdout/stderr, diffs) — no XSS surface.

---

## 7. Markdown summary (`core/summary.ts`)

Pure function: `renderMarkdown(run: RunLedgerRun): string`.

Format:

```markdown
# RunLedger Run Summary

Branch: <branch>
Commit: <short-sha>
Duration: <human duration>

## What Happened
- Ran N commands
- Changed N files
- M command(s) failed

## Risk Flags
- High: <title>
- Medium: <title>
(or "- No risks detected." if empty)

## Commands
- <command> — passed in <duration>
- <command> — failed in <duration>
(or "- No commands recorded." if empty)

## Changed Files
- <path>
(or "- No file changes." if empty)
```

Empty states are rendered explicitly so the markdown is always self-explanatory.

---

## 8. CLI UX

- **Success messages** are short and informative. After `stop`:
  ```
  ✓ RunLedger run finalized.
    Run id: run_20260529T144700Z_a1b2c3
    Report:  /abs/path/.runledger/runs/<id>/report.html
    Open it:  runledger open run_20260529T144700Z_a1b2c3
  ```
- **Error messages** state the problem and the fix on the next line.
- **No color libraries.** A tiny inline ANSI helper (bold, green, red, dim) — disabled if `process.stdout.isTTY` is false or `NO_COLOR` is set.
- **No external progress UI.** Output stays line-based and grep-friendly.

### Edge cases handled
- Running `start` twice → error referencing active.json.
- Running `stop` with no active session → error.
- Running `run` with no active session → error.
- Running `run` in a non-git directory → still works, snapshots are empty.
- Running `open <run-id>` for a missing id → error listing what exists.
- `report` with no runs at all → friendly message.
- Long-running command interrupted with Ctrl+C → command is recorded with `signal: "SIGINT"` and `exitCode: null`; control returns to the shell, session stays active.

---

## 9. Tech stack & dependencies

- **Runtime:** Node.js ≥ 18.
- **Language:** TypeScript with `strict: true`, `noUncheckedIndexedAccess: true`.
- **CLI:** `commander`.
- **Tests:** `vitest`.
- **Runtime deps:** only `commander`.
- **Dev deps:** `typescript`, `vitest`, `@types/node`.

No chalk, no ora, no fs-extra. Everything else uses Node stdlib.

---

## 10. Project layout

```
runledger/
  src/
    cli.ts                  # commander entrypoint, dispatches to commands/*
    config.ts               # resolves paths under .runledger/
    git.ts                  # git helpers + takeSnapshot()
    commands/
      init.ts
      start.ts
      run.ts
      stop.ts
      status.ts
      report.ts
      list.ts
      open.ts
    core/
      types.ts
      storage.ts            # read/write active.json, run.json, atomic writes
      risks.ts              # detectRisks()
      summary.ts            # renderMarkdown()
      report.ts             # renderReport() -> HTML string
      time.ts               # formatDuration(), formatRelativeTime()
    tests/
      risks.test.ts
      summary.test.ts
      report.test.ts
      time.test.ts
      storage.test.ts
  docs/
    spec.md
  package.json
  tsconfig.json
  vitest.config.ts
  README.md
  LICENSE
  .gitignore
```

Modules under `core/` are pure transformations on the `RunLedgerRun` model — with one exception: `core/storage.ts` performs atomic JSON file I/O. It is organized as pure `serialize` / `deserialize` helpers plus thin I/O wrappers (`readRun`, `writeRun`, `readActive`, `writeActive`, `clearActive`); only the pure helpers are unit-tested directly, with the I/O wrappers exercised via a tmp directory round-trip. Other side-effect modules (`git.ts`, `commands/*`) are thin wrappers around `core/`.

---

## 11. Testing strategy

Unit tests for the pure layer — `risks`, `summary`, `report`, `time`, and the `serialize` / `deserialize` helpers in `storage`. The `storage` I/O wrappers are exercised by a single round-trip test against a tmp directory.

- `risks.test.ts` — fixtures for each rule (env touched, lockfile, large diff, many failures), and "no risks" path.
- `summary.test.ts` — markdown for full run, empty-state branches (no commands, no changes, no risks).
- `report.test.ts` — generated HTML contains the expected section IDs and escapes `<script>` tags from command strings (XSS smoke test).
- `time.test.ts` — durations under 1s, minutes, hours; relative time formatting.
- `storage.test.ts` — write then read a run, verify deep equality.

Integration tests for `commands/*` and `git.ts` are out of scope for v1 — they require a real filesystem and git binary, and the pure layer covers the high-value logic.

---

## 12. Out of scope (v1)

- Recording without an active session ("auto-record everything").
- Multi-user / multi-session concurrency.
- Server / cloud sync / sharing.
- Dark theme.
- Authenticated AI-agent attribution.
- Diff gzip compression.
- Filtering by date / search.
- Per-command environment variable capture (privacy + storage concerns).

These are sketched in the README roadmap.

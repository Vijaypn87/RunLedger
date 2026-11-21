<div align="center">

# RunLedger

**Every run, on the record.**

Local-first audit reports for AI coding-agent sessions.

[![Tests](https://img.shields.io/badge/tests-68%20passing-2f7bff?style=for-the-badge&labelColor=05070f)](#-testing)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-2f7bff?style=for-the-badge&labelColor=05070f&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-2f7bff?style=for-the-badge&labelColor=05070f&logo=typescript&logoColor=white)](./tsconfig.json)
[![License](https://img.shields.io/badge/license-MIT-2f7bff?style=for-the-badge&labelColor=05070f)](./LICENSE)

[**Live Demo**](https://runledger-web.vercel.app/) &nbsp;·&nbsp; [**Quick start**](#-installation)

</div>

---

## ◆ Tech stack

![TypeScript](https://img.shields.io/badge/TypeScript-05070f?style=flat-square&logo=typescript&logoColor=2f7bff)
![Node.js](https://img.shields.io/badge/Node.js-05070f?style=flat-square&logo=node.js&logoColor=2f7bff)
![Commander](https://img.shields.io/badge/Commander.js-05070f?style=flat-square)
![Vitest](https://img.shields.io/badge/Vitest-05070f?style=flat-square&logo=vitest&logoColor=2f7bff)
![HTML/CSS](https://img.shields.io/badge/HTML%20%2F%20CSS-05070f?style=flat-square&logo=html5&logoColor=2f7bff)

## ◆ About

AI coding agents edit dozens of files, run commands, hit failures and retry, then hand back a "done." RunLedger records the session and writes one self-contained HTML report: every command, every changed file, every risky edit. No cloud, no telemetry; everything stays in `.runledger/` in your project.

## ◆ Features

- **Automatic recording** for Claude Code sessions through its hooks
- **Command tracking:** output, duration and exit code for every command
- **Git changes:** files changed during the session and the full diff
- **Risk flags:** secret files, dependencies, CI config, migrations, deletions, failed commands
- **HTML report** with charts, filters and a Markdown summary for PRs

<p align="center">
  <img src="assets/dashboard-preview.png" alt="RunLedger dashboard showing KPI cards, command outcomes, risk distribution and risk flags" width="900">
</p>

## ◆ Installation

Requires Node.js 18+.

```bash
git clone https://github.com/Vijaypn87/RunLedger.git
cd RunLedger
npm install
npm run build
npm link
```

## ◆ Usage

**With Claude Code (automatic):**

```bash
runledger hooks install     # once per project
```

Every Claude Code session is then recorded, and the report is written when the session ends.

**Manual:**

```bash
runledger start             # begin recording
runledger run -- npm test   # run and record a command
runledger stop              # finalize and write the report
runledger list              # past runs
runledger open <run-id>     # open a report
```

## ◆ Architecture

```mermaid
flowchart LR
    CC["Claude Code hooks"] --> CLI
    CLI["CLI<br/>src/cli.ts + commands/"] --> G["git.ts<br/>snapshots"]
    CLI --> S[("storage.ts<br/>.runledger/")]
    CLI --> R["core/risks.ts"]
    CLI --> H["core/report.ts"]
    H --> P["report.html"]
```

Full design: [`docs/spec.md`](docs/spec.md).

## ◆ Testing

```bash
npm test
```

## ◆ Roadmap

- [ ] Support more agents (Cursor, Aider)
- [ ] Configurable risk rules per project
- [ ] Parse test output into per-test results
- [ ] Publish to npm

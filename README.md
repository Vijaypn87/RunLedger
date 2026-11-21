<div align="center">

# RunLedger

**Audit reports for AI coding-agent sessions.**

![TypeScript](https://img.shields.io/badge/TypeScript-05070f?style=flat-square&logo=typescript&logoColor=2f7bff)
![Node.js](https://img.shields.io/badge/Node.js-05070f?style=flat-square&logo=node.js&logoColor=2f7bff)
![Vitest](https://img.shields.io/badge/Vitest-05070f?style=flat-square&logo=vitest&logoColor=2f7bff)
![License](https://img.shields.io/badge/license-MIT-05070f?style=flat-square)

[Live Demo](https://runledger-web.vercel.app/)

</div>

RunLedger records what an AI coding agent did (every command, changed file and risky edit) and turns it into one HTML report you can review before committing. Everything stays local.

<p align="center">
  <img src="assets/dashboard-preview.png" alt="RunLedger report" width="850">
</p>

## Features

- Automatic recording for Claude Code sessions
- Commands with output, duration and exit code
- Git changes and full diff
- Risk flags for secrets, dependencies, CI config and failures

## Install

```bash
git clone https://github.com/Vijaypn87/RunLedger.git
cd RunLedger
npm install && npm run build && npm link
```

## Usage

```bash
runledger hooks install     # record Claude Code sessions automatically
```

Or record manually:

```bash
runledger start
runledger run -- npm test
runledger stop
runledger open <run-id>
```

## License

MIT

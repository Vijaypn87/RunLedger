import { describe, it, expect } from "vitest";
import { renderReport } from "../core/report.js";
import type { RunLedgerRun, GitSnapshot } from "../core/types.js";

const blankSnap: GitSnapshot = {
  isGitRepo: true,
  statusShort: "",
  diffStat: "",
  diffNameStatus: "",
  fullDiff: "",
  fullDiffTruncated: false,
  fullDiffBytes: 0,
};

const baseRun: RunLedgerRun = {
  id: "run_t",
  startTime: "2026-01-01T00:00:00Z",
  endTime: "2026-01-01T00:00:05Z",
  cwd: "/proj",
  branch: "main",
  commitSha: "deadbeefcafebabe",
  initialGit: blankSnap,
  finalGit: blankSnap,
  commands: [],
  changedFiles: [],
  risks: [],
  schemaVersion: 1,
};

describe("renderReport", () => {
  it("produces a self-contained HTML document", () => {
    const html = renderReport(baseRun);
    expect(html.toLowerCase().startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("</html>");
    expect(html).not.toMatch(/<link[^>]+href=["']https?:/i);
    expect(html).not.toMatch(/<script[^>]+src=["']https?:/i);
  });

  it("renders the RunLedger header and run id", () => {
    const html = renderReport(baseRun);
    expect(html).toContain("RunLedger");
    expect(html).toContain("run_t");
    expect(html).toContain("main");
    expect(html).toContain("deadbee");
  });

  it("renders empty states", () => {
    const html = renderReport(baseRun);
    expect(html).toMatch(/No risks detected/);
    expect(html).toMatch(/No commands recorded/);
    expect(html).toMatch(/No file changes/);
  });

  it("renders Review before commit pills", () => {
    const html = renderReport({
      ...baseRun,
      changedFiles: [
        { path: ".env", status: "M" },
        { path: "src/x.ts", status: "M" },
      ],
      risks: [{ level: "high", title: "Secret-like file touched", detail: "..." }],
      commands: [
        {
          command: "npm test",
          startTime: "",
          endTime: "",
          durationMs: 100,
          exitCode: 1,
          stdoutHead: "",
          stdoutTail: "",
          stderrHead: "",
          stderrTail: "",
          stdoutBytes: 0,
          stderrBytes: 0,
          truncated: false,
        },
      ],
    });
    expect(html).toContain("Review before commit");
    expect(html).toMatch(/Highest risk/);
    expect(html).toMatch(/Changed files/);
    expect(html).toMatch(/Failed commands/);
    expect(html).toMatch(/Dependency.*config.*secret/i);
  });

  it("escapes user-supplied content (XSS smoke test)", () => {
    const html = renderReport({
      ...baseRun,
      commands: [
        {
          command: "<script>alert(1)</script>",
          startTime: "",
          endTime: "",
          durationMs: 1,
          exitCode: 0,
          stdoutHead: "<img src=x onerror=alert(1)>",
          stdoutTail: "",
          stderrHead: "",
          stderrTail: "",
          stdoutBytes: 0,
          stderrBytes: 0,
          truncated: false,
        },
      ],
      changedFiles: [{ path: "<script>x</script>", status: "M" }],
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders a truncated full diff with head/tail markers", () => {
    const html = renderReport({
      ...baseRun,
      finalGit: {
        isGitRepo: true,
        statusShort: "",
        diffStat: "",
        diffNameStatus: "",
        fullDiff: "",
        fullDiffTruncated: true,
        fullDiffHead: "HEAD_PART",
        fullDiffTail: "TAIL_PART",
        fullDiffBytes: 999_999,
      },
    });
    expect(html).toContain("HEAD_PART");
    expect(html).toContain("TAIL_PART");
    expect(html).toMatch(/truncated/i);
  });
});

describe("dashboard helpers", () => {
  it("detects test commands from command text", async () => {
    const { isTestCommand } = await import("../core/report.js");
    for (const c of ["npm test", "npm run test", "pnpm test", "npx vitest run", "pytest -q", "cargo test", "go test ./...", "python -m pytest"]) {
      expect(isTestCommand(c), c).toBe(true);
    }
    for (const c of ["npm run build", "git status", "node scripts/migrate.js", "echo latest"]) {
      expect(isTestCommand(c), c).toBe(false);
    }
  });

  it("parses per-file rows from git diff --stat", async () => {
    const { parseDiffStatRows } = await import("../core/report.js");
    const rows = parseDiffStatRows(
      " src/a.ts | 12 ++++++++----\n docs/b.md |  3 +++\n 2 files changed, 11 insertions(+), 4 deletions(-)\n",
    );
    expect(rows).toEqual([
      { path: "src/a.ts", changes: 12, plus: 8, minus: 4 },
      { path: "docs/b.md", changes: 3, plus: 3, minus: 0 },
    ]);
  });

  it("renders test results, activity log and navigation for a run with commands", () => {
    const cmd = (command: string, exitCode: number | null) => ({
      command, startTime: "2026-01-01T00:00:01Z", endTime: "2026-01-01T00:00:02Z", durationMs: 1000, exitCode,
      stdoutHead: "out", stdoutTail: "", stderrHead: "", stderrTail: "", stdoutBytes: 3, stderrBytes: 0, truncated: false,
    });
    const html = renderReport({ ...baseRun, commands: [cmd("npm test", 0), cmd("npm run build", 1)] });
    expect(html).toContain("Test results");
    expect(html).toContain("Activity log");
    expect(html).toContain('href="#git"');
    expect(html).toContain("Session finalized");
  });

  it("contains no legacy branding and no external resources", () => {
    const html = renderReport(baseRun);
    expect(html).not.toMatch(/agentlens/i);
    expect(html).not.toMatch(/(src|href)=["']https?:/i);
    expect(html).not.toMatch(/url\(["']?https?:/i);
  });
});

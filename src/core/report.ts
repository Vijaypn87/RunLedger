import type { ChangedFile, ChangedFileStatus, CommandEvent, RiskFlag, RiskLevel, RunLedgerRun } from "./types.js";
import { formatDuration } from "./time.js";
import { renderMarkdown } from "./summary.js";
import { REPORT_STYLES } from "./report-styles.js";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Verdict = "pass" | "fail" | "interrupted";

function verdictOf(c: CommandEvent): Verdict {
  if (c.exitCode === 0) return "pass";
  if (c.exitCode === null) return "interrupted";
  return "fail";
}

/** Heuristic: does this command look like a test runner invocation? Based on the command text only. */
export function isTestCommand(command: string): boolean {
  return /(^|[\s/\\])(vitest|jest|mocha|ava|pytest|tox|phpunit|rspec|karma|playwright test|cypress run)(\s|$)|\b(npm|pnpm|yarn|bun)\s+(run\s+)?test\b|\bcargo\s+test\b|\bgo\s+test\b|\bdotnet\s+test\b|\bmvn\s+test\b|\bgradle\s+test\b|\bpython\d?\s+-m\s+(pytest|unittest)\b/i.test(
    command,
  );
}

function highestRisk(risks: RiskFlag[]): RiskLevel | "none" {
  if (risks.some((r) => r.level === "high")) return "high";
  if (risks.some((r) => r.level === "medium")) return "medium";
  if (risks.some((r) => r.level === "low")) return "low";
  return "none";
}

function touchedSensitive(files: ChangedFile[]): boolean {
  return files.some((f) => {
    const base = f.path.split("/").pop() ?? "";
    if (/^\.env(\..*)?$/.test(base)) return true;
    if (base === "package.json") return true;
    if (/(lock|sum)$/i.test(base)) return true;
    if (base === ".gitignore" || base === ".gitattributes") return true;
    return false;
  });
}

const RISK_LABEL: Record<RiskLevel | "none", string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "Clean",
};

const STATUS_NAME: Record<ChangedFileStatus, string> = {
  A: "Added",
  M: "Modified",
  D: "Deleted",
  R: "Renamed",
  C: "Copied",
  U: "Unmerged",
  "?": "Untracked",
};
const STATUS_ORDER: ChangedFileStatus[] = ["A", "M", "D", "R", "C", "U", "?"];

function validTime(iso: string): number | null {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function clock(iso: string): string {
  const t = validTime(iso);
  return t === null ? "—" : new Date(t).toISOString().slice(11, 19) + " UTC";
}

function pct(n: number, total: number): number {
  return total <= 0 ? 0 : (n / total) * 100;
}

/** Per-file rows from `git diff --stat` output. Only what git reported; nothing inferred. */
export function parseDiffStatRows(diffStat: string): Array<{ path: string; changes: number; plus: number; minus: number }> {
  const rows: Array<{ path: string; changes: number; plus: number; minus: number }> = [];
  for (const line of diffStat.split("\n")) {
    const m = line.match(/^\s*(.+?)\s+\|\s+(\d+)\s*([+-]*)\s*$/);
    if (!m) continue;
    const graph = m[3] ?? "";
    rows.push({
      path: m[1] ?? "",
      changes: parseInt(m[2] ?? "0", 10),
      plus: (graph.match(/\+/g) ?? []).length,
      minus: (graph.match(/-/g) ?? []).length,
    });
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* components                                                          */
/* ------------------------------------------------------------------ */

function icon(name: string): string {
  const paths: Record<string, string> = {
    overview: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    risk: '<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 10v4M12 17.5v.01"/>',
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    terminal: '<path d="m4 6 6 6-6 6M12 19h8"/>',
    test: '<path d="M9 3h6M10 3v6.5L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9.5V3"/>',
    git: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 7v10M8 5h4a4 4 0 0 1 4 4v1"/>',
    doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  };
  return `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? ""}</svg>`;
}

function kpi(label: string, value: string, tone: string, hint: string): string {
  return `<div class="kpi tone-${tone}">
        <div class="kpi-label">${label}</div>
        <div class="kpi-value">${value}</div>
        <div class="kpi-hint">${hint}</div>
      </div>`;
}

function donut(segments: Array<{ value: number; cls: string }>, centerValue: string, centerLabel: string): string {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const len = (s.value / total) * c;
      const arc = `<circle class="arc ${s.cls}" cx="70" cy="70" r="${r}" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" />`;
      offset += len;
      return arc;
    })
    .join("");
  return `<svg class="donut" viewBox="0 0 140 140" role="img" aria-label="${esc(centerLabel)}: ${esc(centerValue)}">
        <circle class="track" cx="70" cy="70" r="${r}" />
        <g transform="rotate(-90 70 70)">${arcs}</g>
        <text x="70" y="68" class="donut-v" text-anchor="middle">${esc(centerValue)}</text>
        <text x="70" y="86" class="donut-l" text-anchor="middle">${esc(centerLabel)}</text>
      </svg>`;
}

function legendItem(cls: string, label: string, n: number): string {
  return `<li><span class="sw ${cls}"></span>${label}<b>${n}</b></li>`;
}

function stackBar(parts: Array<{ value: number; cls: string; title: string }>): string {
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (total === 0) return `<div class="stack empty-stack"></div>`;
  return `<div class="stack">${parts
    .filter((p) => p.value > 0)
    .map((p) => `<span class="${p.cls}" style="width:${pct(p.value, total).toFixed(2)}%" title="${esc(p.title)}"></span>`)
    .join("")}</div>`;
}

function empty(title: string, text: string): string {
  return `<div class="empty"><div class="empty-ring"></div><strong>${esc(title)}</strong><p>${esc(text)}</p></div>`;
}

/* ---- overview ---- */

function renderOverview(run: RunLedgerRun, durMs: number, failed: number, tests: CommandEvent[]): string {
  const highest = highestRisk(run.risks);
  const sensitive = touchedSensitive(run.changedFiles);
  const passed = run.commands.filter((c) => verdictOf(c) === "pass").length;
  const interrupted = run.commands.filter((c) => verdictOf(c) === "interrupted").length;
  const total = run.commands.length;

  const riskCounts = {
    high: run.risks.filter((r) => r.level === "high").length,
    medium: run.risks.filter((r) => r.level === "medium").length,
    low: run.risks.filter((r) => r.level === "low").length,
  };
  const fileCounts = STATUS_ORDER.map((k) => ({ k, n: run.changedFiles.filter((f) => f.status === k).length }));

  const cmdCard =
    total === 0
      ? empty("No commands recorded", "Use `runledger run -- <command>` during a session to record commands.")
      : `<div class="donut-wrap">${donut(
          [
            { value: passed, cls: "c-ok" },
            { value: failed, cls: "c-bad" },
            { value: interrupted, cls: "c-warn" },
          ],
          `${passed}/${total}`,
          "passed",
        )}
        <ul class="legend">${legendItem("c-ok", "Passed", passed)}${legendItem("c-bad", "Failed", failed)}${legendItem("c-warn", "Interrupted", interrupted)}</ul></div>`;

  const riskCard =
    run.risks.length === 0
      ? empty("No risks detected", "No risky files, failed commands or oversized diffs were found.")
      : `${stackBar([
          { value: riskCounts.high, cls: "bg-bad", title: `${riskCounts.high} high` },
          { value: riskCounts.medium, cls: "bg-warn", title: `${riskCounts.medium} medium` },
          { value: riskCounts.low, cls: "bg-ok", title: `${riskCounts.low} low` },
        ])}
        <ul class="legend">${legendItem("c-bad", "High", riskCounts.high)}${legendItem("c-warn", "Medium", riskCounts.medium)}${legendItem("c-ok", "Low", riskCounts.low)}</ul>`;

  const fileCard =
    run.changedFiles.length === 0
      ? empty("No file changes", "No changed files were detected in the working tree.")
      : `${stackBar(
          fileCounts.map(({ k, n }) => ({ value: n, cls: `st-${k === "?" ? "U2" : k}`, title: `${n} ${STATUS_NAME[k].toLowerCase()}` })),
        )}
        <ul class="legend">${fileCounts
          .filter((x) => x.n > 0)
          .map((x) => `<li><span class="sw st-${x.k === "?" ? "U2" : x.k}"></span>${STATUS_NAME[x.k]}<b>${x.n}</b></li>`)
          .join("")}</ul>`;

  const testsPassed = tests.filter((c) => verdictOf(c) === "pass").length;
  const testHint =
    tests.length === 0 ? "No test command recorded" : `${testsPassed} of ${tests.length} test run(s) passed`;

  return `<section id="overview" class="panel-section">
    <h2>${icon("overview")}Review before commit</h2>
    <div class="kpis">
      ${kpi("Highest risk", RISK_LABEL[highest], highest, run.risks.length === 0 ? "No flags raised" : `${run.risks.length} flag(s) raised`)}
      ${kpi("Changed files", String(run.changedFiles.length), run.changedFiles.length > 0 ? "info" : "none", run.changedFiles.length === 0 ? "Working tree unchanged" : "In the working tree at stop")}
      ${kpi("Failed commands", String(failed), failed > 0 ? "high" : "none", `${total} command(s) recorded`)}
      ${kpi("Dependency / config / secret-like files", sensitive ? "Yes" : "No", sensitive ? "medium" : "none", sensitive ? "Review these before committing" : "None touched")}
      ${kpi("Tests", tests.length === 0 ? "—" : testsPassed === tests.length ? "Pass" : "Fail", tests.length === 0 ? "dim" : testsPassed === tests.length ? "none" : "high", testHint)}
      ${kpi("Duration", esc(formatDuration(durMs)), "info", "Session start to stop")}
    </div>
    <div class="grid3">
      <article class="card"><h3>Command outcomes</h3>${cmdCard}</article>
      <article class="card"><h3>Risk distribution</h3>${riskCard}</article>
      <article class="card"><h3>Change types</h3>${fileCard}</article>
    </div>
    <article class="card">
      <h3>Summary</h3>
      <p class="lead">Ran <strong>${total}</strong> command(s), changed <strong>${run.changedFiles.length}</strong> file(s), <strong>${failed}</strong> failed. Total duration <strong>${esc(formatDuration(durMs))}</strong>.</p>
    </article>
  </section>`;
}

/* ---- risks ---- */

function renderRisks(risks: RiskFlag[]): string {
  const body =
    risks.length === 0
      ? empty("No risks detected", "Nothing in this run matched a risk rule.")
      : risks
          .map(
            (r) => `<div class="risk risk-${r.level}">
        <span class="badge ${r.level}">${r.level}</span>
        <div class="risk-body">
          <strong>${esc(r.title)}</strong>
          ${r.file ? `<code class="file">${esc(r.file)}</code>` : ""}
          <p>${esc(r.detail)}</p>
        </div>
      </div>`,
          )
          .join("");
  return `<section id="risks" class="panel-section">
    <h2>${icon("risk")}Risk flags <span class="count">${risks.length}</span></h2>
    ${body}
  </section>`;
}

/* ---- activity ---- */

function renderActivity(run: RunLedgerRun, durMs: number): string {
  const items: string[] = [];
  items.push(`<li class="ev ev-start"><span class="node"></span><div class="ev-main"><strong>Session started</strong><span class="dim">${esc(clock(run.startTime))} · branch <code>${esc(run.branch || "(none)")}</code></span></div></li>`);
  for (const c of run.commands) {
    const v = verdictOf(c);
    items.push(`<li class="ev ev-${v}"><span class="node"></span><div class="ev-main"><code class="ev-cmd">${esc(c.command)}</code><span class="dim">${esc(clock(c.startTime))} · ${esc(formatDuration(c.durationMs))} · <span class="badge ${v}">${v}</span>${c.exitCode !== null && c.exitCode !== 0 ? ` <span class="dim">exit ${c.exitCode}</span>` : ""}</span></div></li>`);
  }
  if (run.endTime) {
    items.push(`<li class="ev ev-end"><span class="node"></span><div class="ev-main"><strong>Session finalized</strong><span class="dim">${esc(clock(run.endTime))} · ${esc(formatDuration(durMs))} total</span></div></li>`);
  }
  const note = run.commands.length === 0 ? `<p class="dim note">No commands were recorded in this session.</p>` : "";
  return `<section id="activity" class="panel-section">
    <h2>${icon("activity")}Activity log</h2>
    <article class="card"><ol class="timeline">${items.join("")}</ol>${note}</article>
  </section>`;
}

/* ---- commands ---- */

function streamBlock(label: string, head: string, tail: string): string {
  if (!head && !tail) return "";
  return `<div class="streamlabel">${label}</div><pre class="stream">${esc(head)}${tail ? `\n[…tail…]\n${esc(tail)}` : ""}</pre>`;
}

function renderCommand(c: CommandEvent): string {
  const v = verdictOf(c);
  const trunc = c.truncated ? `<span class="dim"> (truncated)</span>` : "";
  const out = streamBlock("stdout", c.stdoutHead, c.stdoutTail);
  const err = streamBlock("stderr", c.stderrHead, c.stderrTail);
  const none = !out && !err ? `<p class="dim">No output captured.</p>` : "";
  return `<details class="cmd" data-verdict="${v}" data-test="${isTestCommand(c.command) ? "1" : "0"}">
      <summary>
        <span class="status-dot ${v}"></span>
        <code>${esc(c.command)}</code>
        <span class="badge ${v}">${v === "pass" ? "pass" : v === "fail" ? "fail" : "interrupted"}</span>
        <span class="dim">${esc(formatDuration(c.durationMs))}${c.exitCode !== null ? ` · exit ${c.exitCode}` : c.signal ? ` · ${esc(c.signal)}` : ""}</span>
        ${trunc}
      </summary>
      ${out}${err}${none}
    </details>`;
}

function renderCommands(run: RunLedgerRun): string {
  const body =
    run.commands.length === 0
      ? empty("No commands recorded", "Commands run with `runledger run -- <command>` appear here with their output.")
      : `<div class="filters" role="group" aria-label="Filter commands">
        <button type="button" class="chip active" data-filter="all" aria-pressed="true">All <b>${run.commands.length}</b></button>
        <button type="button" class="chip" data-filter="fail" aria-pressed="false">Failed <b>${run.commands.filter((c) => verdictOf(c) !== "pass").length}</b></button>
        <button type="button" class="chip" data-filter="pass" aria-pressed="false">Passed <b>${run.commands.filter((c) => verdictOf(c) === "pass").length}</b></button>
      </div>
      <div id="cmdlist">${run.commands.map(renderCommand).join("")}</div>
      <div id="cmdempty" class="empty" hidden><strong>No matching commands</strong><p>No recorded command matches this filter.</p></div>`;
  return `<section id="commands" class="panel-section">
    <h2>${icon("terminal")}Shell commands <span class="count">${run.commands.length}</span></h2>
    ${body}
  </section>`;
}

/* ---- tests ---- */

function renderTests(tests: CommandEvent[]): string {
  const body =
    tests.length === 0
      ? empty("No test runs detected", "Commands such as `npm test`, `vitest`, `pytest` or `cargo test` recorded via `runledger run` are listed here.")
      : `<article class="card"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Result</th><th>Command</th><th>Duration</th><th>Exit</th></tr></thead>
        <tbody>${tests
          .map((c) => {
            const v = verdictOf(c);
            return `<tr><td><span class="badge ${v}">${v}</span></td><td><code>${esc(c.command)}</code></td><td>${esc(formatDuration(c.durationMs))}</td><td>${c.exitCode === null ? "—" : c.exitCode}</td></tr>`;
          })
          .join("")}</tbody></table></div>
        <p class="dim note">Detected from the command text and exit code only. RunLedger does not parse individual test results.</p></article>`;
  return `<section id="tests" class="panel-section">
    <h2>${icon("test")}Test results <span class="count">${tests.length}</span></h2>
    ${body}
  </section>`;
}

/* ---- git ---- */

function diffLines(raw: string): string {
  return raw
    .split("\n")
    .map((l) => {
      let cls = "";
      if (l.startsWith("+++") || l.startsWith("---") || l.startsWith("diff --git") || l.startsWith("index ")) cls = "d-meta";
      else if (l.startsWith("@@")) cls = "d-hunk";
      else if (l.startsWith("+")) cls = "d-add";
      else if (l.startsWith("-")) cls = "d-del";
      return `<span class="dl ${cls}">${esc(l)}</span>`;
    })
    .join("");
}

function renderFullDiff(run: RunLedgerRun): string {
  const fg = run.finalGit;
  if (!fg) return "";
  if (fg.fullDiffTruncated) {
    return `<details class="card diffbox"><summary>Full diff <span class="dim">(truncated, ${fg.fullDiffBytes.toLocaleString("en-US")} bytes total)</span></summary>
        <pre class="diff">${diffLines(fg.fullDiffHead ?? "")}\n<span class="dl d-hunk">[…truncated…]</span>\n${diffLines(fg.fullDiffTail ?? "")}</pre>
      </details>`;
  }
  if (!fg.fullDiff) return "";
  return `<details class="card diffbox"><summary>Full diff <span class="dim">(${fg.fullDiffBytes.toLocaleString("en-US")} bytes)</span></summary>
      <pre class="diff">${diffLines(fg.fullDiff)}</pre>
    </details>`;
}

function preExistingNote(run: RunLedgerRun): string {
  const pre = run.preExistingChanges ?? [];
  if (pre.length === 0) return "";
  return `<details class="note"><summary class="dim">${pre.length} file(s) were already modified before this session and left unchanged; not counted above.</summary><ul>${pre
    .map((f) => `<li><code>${esc(f.path)}</code></li>`)
    .join("")}</ul></details>`;
}

function renderGit(run: RunLedgerRun): string {
  const files = run.changedFiles;
  const filesBody =
    files.length === 0
      ? empty("No file changes", run.finalGit && !run.finalGit.isGitRepo ? "This directory is not a git repository, so file changes were not tracked." : "No file changes detected.")
      : STATUS_ORDER.filter((k) => files.some((f) => f.status === k))
          .map(
            (k) =>
              `<div class="filegroup"><h4><span class="st st-${k === "?" ? "U2" : k}">${k}</span>${STATUS_NAME[k]} <span class="count">${files.filter((f) => f.status === k).length}</span></h4><ul>${files
                .filter((f) => f.status === k)
                .map((f) => `<li><code>${esc(f.path)}</code></li>`)
                .join("")}</ul></div>`,
          )
          .join("");

  const stat = run.finalGit?.diffStat ?? "";
  const rows = parseDiffStatRows(stat);
  const maxChanges = rows.reduce((m, r) => Math.max(m, r.changes), 0);
  const statBody = !stat.trim()
    ? empty("No diff stat", "Git reported no tracked-file changes. Untracked files are not included in diff stats.")
    : `${
        rows.length > 0
          ? `<div class="statrows">${rows
              .map(
                (r) => `<div class="statrow"><code>${esc(r.path)}</code><span class="statbar"><i class="plus" style="width:${pct(r.plus, Math.max(maxChanges, 1)).toFixed(1)}%"></i><i class="minus" style="width:${pct(r.minus, Math.max(maxChanges, 1)).toFixed(1)}%"></i></span><b>${r.changes}</b></div>`,
              )
              .join("")}</div>`
          : ""
      }<pre class="stat">${esc(stat)}</pre>`;

  return `<section id="git" class="panel-section">
    <h2>${icon("git")}Git changes <span class="count">${files.length}</span></h2>
    <div class="grid2">
      <article class="card"><h3>Changed files</h3>${filesBody}${preExistingNote(run)}</article>
      <article class="card"><h3>Diff stat</h3>${statBody}</article>
    </div>
    ${renderFullDiff(run) || `<article class="card"><h3>Full diff</h3>${empty("No diff to show", "There is no tracked-file diff for this run.")}</article>`}
  </section>`;
}

/* ---- markdown ---- */

function renderMarkdownSection(md: string): string {
  return `<section id="summary" class="panel-section">
    <h2>${icon("doc")}Markdown summary</h2>
    <article class="card">
      <div class="copyrow">
        <span class="dim">Copy and paste into a PR description.</span>
        <button class="copy" id="copyBtn" type="button">Copy</button>
      </div>
      <pre class="markdown" id="md">${esc(md)}</pre>
    </article>
  </section>`;
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

const SCRIPT = `
(function () {
  var btn = document.getElementById('copyBtn');
  var md = document.getElementById('md');
  if (btn && md) {
    btn.addEventListener('click', function () {
      var text = md.textContent || '';
      var done = function () {
        var prev = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(function () { btn.textContent = prev; }, 1200);
      };
      var fallback = function () {
        var range = document.createRange();
        range.selectNodeContents(md);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) {}
        if (ok) { done(); } else { btn.textContent = 'Press Ctrl+C'; setTimeout(function () { btn.textContent = 'Copy'; }, 1800); }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else {
        fallback();
      }
    });
  }
  var chips = document.querySelectorAll('.chip');
  var emptyMsg = document.getElementById('cmdempty');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      chips.forEach(function (c) { c.classList.remove('active'); c.setAttribute('aria-pressed', 'false'); });
      chip.classList.add('active');
      chip.setAttribute('aria-pressed', 'true');
      var f = chip.getAttribute('data-filter');
      var shown = 0;
      document.querySelectorAll('#cmdlist .cmd').forEach(function (el) {
        var v = el.getAttribute('data-verdict');
        var show = f === 'all' || (f === 'pass' && v === 'pass') || (f === 'fail' && v !== 'pass');
        el.hidden = !show;
        if (show) shown++;
      });
      if (emptyMsg) emptyMsg.hidden = shown !== 0;
    });
  });
  var links = document.querySelectorAll('.nav a');
  if ('IntersectionObserver' in window && links.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          links.forEach(function (l) { l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id); });
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    document.querySelectorAll('section.panel-section').forEach(function (s) { io.observe(s); });
  }
})();
`;

export function renderReport(run: RunLedgerRun): string {
  const start = validTime(run.startTime);
  const end = run.endTime ? validTime(run.endTime) : null;
  const durMs = start !== null && end !== null ? end - start : 0;
  const failed = run.commands.filter((c) => c.exitCode !== 0 && c.exitCode !== null).length;
  const tests = run.commands.filter((c) => isTestCommand(c.command));
  const highest = highestRisk(run.risks);
  const md = renderMarkdown(run);

  const shortSha = run.commitSha ? esc(run.commitSha.slice(0, 7)) : "(none)";
  const branchLabel = esc(run.branch || "(none)");

  const nav: Array<[string, string, string, string]> = [
    ["overview", "Overview", "overview", ""],
    ["risks", "Risks", "risk", run.risks.length ? String(run.risks.length) : ""],
    ["activity", "Activity", "activity", ""],
    ["commands", "Commands", "terminal", run.commands.length ? String(run.commands.length) : ""],
    ["tests", "Tests", "test", tests.length ? String(tests.length) : ""],
    ["git", "Git changes", "git", run.changedFiles.length ? String(run.changedFiles.length) : ""],
    ["summary", "Summary", "doc", ""],
  ];
  const navHtml = nav
    .map(
      ([id, label, ic, n], i) =>
        `<a href="#${id}"${i === 0 ? ' class="active"' : ""}>${icon(ic)}<span>${label}</span>${n ? `<em>${n}</em>` : ""}</a>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="dark" />
<title>RunLedger — ${esc(run.id)}</title>
<style>${REPORT_STYLES}</style>
</head>
<body>
<div class="layout">
  <aside class="sidebar">
    <div class="brand">
      <svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><rect x="2" y="2" width="28" height="28" rx="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 11h14M9 16h14M9 21h8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
      <span>RunLedger</span>
    </div>
    <nav class="nav" aria-label="Report sections">${navHtml}</nav>
    <div class="side-run">
      <div class="side-run-label">Run</div>
      <div class="side-run-row"><span>Branch</span><b>${branchLabel}</b></div>
      <div class="side-run-row"><span>Commit</span><b>${shortSha}</b></div>
      <div class="side-run-row"><span>Duration</span><b>${esc(formatDuration(durMs))}</b></div>
    </div>
    <div class="side-foot dim">Local report · no network</div>
  </aside>
  <main>
    <header class="runhdr">
      <div>
        <div class="eyebrow">Run report</div>
        <h1>RunLedger <span class="runid">${esc(run.id)}</span></h1>
        <div class="meta">
          <span>Branch <code>${branchLabel}</code></span>
          <span>Commit <code>${shortSha}</code></span>
          <span>Started <time>${esc(run.startTime)}</time></span>
          <span>Duration <strong>${esc(formatDuration(durMs))}</strong></span>
        </div>
      </div>
      <div class="verdict v-${highest}"><span class="pulse"></span>${highest === "none" ? "Clean run" : `${RISK_LABEL[highest]} risk`}</div>
    </header>
    ${renderOverview(run, durMs, failed, tests)}
    ${renderRisks(run.risks)}
    ${renderActivity(run, durMs)}
    ${renderCommands(run)}
    ${renderTests(tests)}
    ${renderGit(run)}
    ${renderMarkdownSection(md)}
    <footer class="foot dim">Generated by RunLedger · everything in this report was recorded locally.</footer>
  </main>
</div>
<script>${SCRIPT}</script>
</body>
</html>`;
}

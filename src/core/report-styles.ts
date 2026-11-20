/** Inline stylesheet for the self-contained HTML report (no external assets). */
export const REPORT_STYLES = `
:root {
  color-scheme: dark;
  --bg: #03050b;
  --bg-2: #060b18;
  --card: #0c1019;
  --card-2: #0f1522;
  --line: rgba(59,130,246,.22);
  --line-soft: rgba(148,163,184,.12);
  --fg: #e6ecf7;
  --muted: #8d9ab3;
  --dim: #5d6a85;
  --blue: #2f7bff;
  --blue-2: #5b9bff;
  --blue-glow: rgba(47,123,255,.35);
  --ok: #34d399;
  --warn: #f5b546;
  --bad: #ff5470;
  --mono: ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace;
  --r-sm: 8px; --r-md: 12px; --r-lg: 16px;
  --gap: 14px;
  --ease: cubic-bezier(.2,.7,.2,1);
  --sans: Inter, "Segoe UI", system-ui, -apple-system, Roboto, sans-serif;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 20px; }
body {
  margin: 0; color: var(--fg); font-family: var(--sans); line-height: 1.55; -webkit-font-smoothing: antialiased;
  background: var(--bg);
  background-image:
    radial-gradient(900px 480px at 85% -10%, rgba(47,123,255,.16), transparent 60%),
    radial-gradient(700px 420px at -10% 10%, rgba(30,64,175,.14), transparent 60%),
    linear-gradient(180deg, var(--bg-2), var(--bg) 480px);
  background-attachment: fixed;
  font-size: 15px; font-variant-numeric: tabular-nums;
}
body::before { content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: .5;
  background-image: linear-gradient(rgba(91,155,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(91,155,255,.045) 1px, transparent 1px);
  background-size: 44px 44px; -webkit-mask-image: radial-gradient(ellipse at 70% 0%, #000, transparent 70%); mask-image: radial-gradient(ellipse at 70% 0%, #000, transparent 70%); }
.layout { position: relative; z-index: 1; }
code, pre { font-family: var(--mono); }
code { font-size: .86em; background: rgba(47,123,255,.1); border: 1px solid var(--line-soft); padding: 1px 6px; border-radius: 5px; color: #cfe0ff; word-break: break-word; }
.dim { color: var(--muted); font-size: 13px; }
.layout { display: grid; grid-template-columns: 232px minmax(0, 1fr); min-height: 100vh; }

/* sidebar */
.sidebar { position: sticky; top: 0; height: 100vh; padding: 22px 14px; display: flex; flex-direction: column; gap: 22px;
  background: linear-gradient(180deg, rgba(8,13,27,.95), rgba(4,7,14,.95)); border-right: 1px solid var(--line); }
.brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 17px; letter-spacing: -.02em; padding: 0 8px; }
.logo { width: 26px; height: 26px; color: var(--blue-2); filter: drop-shadow(0 0 8px var(--blue-glow)); }
.nav { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.nav a { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 8px; color: var(--muted); text-decoration: none; font-size: 14px;
  border: 1px solid transparent; transition: color .18s, background .18s, border-color .18s, transform .18s; }
.nav a:hover { color: var(--fg); background: rgba(47,123,255,.08); transform: translateX(2px); }
.nav a.active { color: #fff; background: linear-gradient(90deg, rgba(47,123,255,.22), rgba(47,123,255,.04)); border-color: var(--line); }
.nav a em { margin-left: auto; font-style: normal; font-size: 11px; padding: 1px 7px; border-radius: 999px; background: rgba(47,123,255,.18); color: var(--blue-2); }
.ico { width: 17px; height: 17px; flex: none; }
.side-foot { padding: 0 8px; font-size: 12px; }
.side-run { margin-top: auto; padding: 12px; border: 1px solid var(--line); border-radius: var(--r-md); background: rgba(47,123,255,.05); display: grid; gap: 6px; }
.side-run-label { font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--blue-2); }
.side-run-row { display: flex; justify-content: space-between; gap: 10px; font-size: 12.5px; color: var(--muted); min-width: 0; }
.side-run-row b { color: var(--fg); font-weight: 600; font-family: var(--mono); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nav a { position: relative; }
.nav a.active::before { content: ""; position: absolute; left: -14px; top: 22%; bottom: 22%; width: 3px; border-radius: 0 3px 3px 0; background: var(--blue-2); box-shadow: 0 0 10px var(--blue-glow); }

/* main */
main { padding: 30px clamp(18px, 3.5vw, 44px) 80px; max-width: 1180px; width: 100%; }
.runhdr { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; padding-bottom: 22px; margin-bottom: 26px; border-bottom: 1px solid var(--line); }
.eyebrow { font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--blue-2); margin-bottom: 6px; }
h1 { margin: 0 0 10px; font-size: clamp(22px, 3vw, 30px); letter-spacing: -.02em; }
.runid { color: var(--muted); font-family: var(--mono); font-size: .56em; font-weight: 500; margin-left: 4px; word-break: break-all; }
.meta { display: flex; flex-wrap: wrap; gap: 8px 20px; color: var(--muted); font-size: 14px; }
.verdict { display: inline-flex; align-items: center; gap: 9px; padding: 8px 16px; border-radius: 999px; font-weight: 600; font-size: 14px; border: 1px solid var(--line); background: var(--card); }
.pulse { width: 9px; height: 9px; border-radius: 50%; background: var(--ok); animation: pulse 2.4s infinite; color: var(--ok); }
.v-high { color: var(--bad); border-color: rgba(255,84,112,.4); } .v-high .pulse { background: var(--bad); }
.v-medium { color: var(--warn); border-color: rgba(245,181,70,.4); } .v-medium .pulse { background: var(--warn); }
.v-low, .v-none { color: var(--ok); border-color: rgba(52,211,153,.35); }
@keyframes pulse { 0% { box-shadow: 0 0 0 0 currentColor; } 70%, 100% { box-shadow: 0 0 0 9px transparent; } }

.panel-section { margin-bottom: 44px; }
h2 { display: flex; align-items: center; gap: 10px; font-size: 13px; text-transform: uppercase; letter-spacing: .12em; color: var(--fg); margin: 0 0 16px; font-weight: 600; }
h2 .ico { color: var(--blue-2); }
h2::after { content: ""; flex: 1; height: 1px; background: linear-gradient(90deg, var(--line), transparent); }
h3 { margin: 0 0 16px; font-size: 12px; font-weight: 600; color: var(--muted); letter-spacing: .08em; text-transform: uppercase; }
.count { font-size: 11px; background: rgba(47,123,255,.16); color: var(--blue-2); padding: 1px 8px; border-radius: 999px; letter-spacing: 0; }
.card { background: linear-gradient(180deg, var(--card-2), var(--card)); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 20px; transition: border-color .25s var(--ease), box-shadow .25s var(--ease), transform .25s var(--ease); min-width: 0; box-shadow: inset 0 1px 0 rgba(255,255,255,.03); }
.card:hover { border-color: rgba(91,155,255,.5); box-shadow: 0 14px 38px -18px var(--blue-glow), inset 0 1px 0 rgba(255,255,255,.04); transform: translateY(-1px); }
.grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin: 14px 0; }
.grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-bottom: 14px; }
.lead { margin: 0; color: var(--fg); }

/* KPIs */
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
.kpi { position: relative; overflow: hidden; background: linear-gradient(160deg, var(--card-2), var(--card)); border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px;
  transition: transform .2s, border-color .2s, box-shadow .2s; }
.kpi::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--tone, var(--blue)); box-shadow: 0 0 14px var(--tone, var(--blue)); }
.kpi::after { content: ""; position: absolute; right: -30px; top: -30px; width: 90px; height: 90px; border-radius: 50%; background: radial-gradient(circle, color-mix(in srgb, var(--tone, var(--blue)) 22%, transparent), transparent 70%); pointer-events: none; }
.kpi:hover { transform: translateY(-3px); border-color: rgba(91,155,255,.55); box-shadow: 0 14px 30px -18px var(--blue-glow); }
.kpi-label { font-size: 11.5px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); min-height: 2.6em; }
.kpi-value { font-size: 30px; line-height: 1.15; font-weight: 700; letter-spacing: -.02em; margin: 2px 0; color: var(--tone, var(--fg)); }
.kpi-hint { font-size: 12px; color: var(--dim); }
.tone-high { --tone: var(--bad); } .tone-medium { --tone: var(--warn); } .tone-low, .tone-none { --tone: var(--ok); }
.tone-info { --tone: var(--blue-2); } .tone-dim { --tone: var(--dim); }

/* charts */
.donut-wrap { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.donut { width: 132px; height: 132px; flex: none; }
.track { fill: none; stroke: rgba(148,163,184,.12); stroke-width: 14; }
.arc { fill: none; stroke-width: 14; transition: stroke-width .2s; } .arc:hover { stroke-width: 17; }
.arc.c-ok { stroke: var(--ok); } .arc.c-bad { stroke: var(--bad); } .arc.c-warn { stroke: var(--warn); }
.donut-v { fill: var(--fg); font-size: 20px; font-weight: 700; } .donut-l { fill: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: .08em; }
.legend { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--muted); flex: 1; min-width: 120px; }
.donut-wrap .legend { margin: 0; }
.legend li { display: flex; align-items: center; gap: 8px; } .legend b { margin-left: auto; color: var(--fg); }
.sw { width: 10px; height: 10px; border-radius: 3px; flex: none; }
.sw.c-ok, .bg-ok { background: var(--ok); } .sw.c-bad, .bg-bad { background: var(--bad); } .sw.c-warn, .bg-warn { background: var(--warn); }
.stack { display: flex; height: 12px; border-radius: 999px; overflow: hidden; background: rgba(148,163,184,.12); gap: 2px; }
.stack span { display: block; transition: filter .2s; } .stack span:hover { filter: brightness(1.3); }
.st-A { background: var(--ok); } .st-M { background: var(--blue); } .st-D { background: var(--bad); } .st-R { background: #a78bfa; }
.st-C { background: #22d3ee; } .st-U { background: var(--warn); } .st-U2 { background: #64748b; }

/* empty */
.empty { text-align: center; padding: 22px 12px; color: var(--muted); border: 1px dashed var(--line); border-radius: 12px; background: rgba(47,123,255,.03); }
.empty strong { display: block; color: var(--fg); margin-top: 8px; font-size: 14px; } .empty p { margin: 4px 0 0; font-size: 13px; }
.empty-ring { width: 26px; height: 26px; margin: 0 auto; border-radius: 50%; border: 2px solid var(--line); box-shadow: 0 0 14px var(--blue-glow) inset; }
.note { margin: 12px 0 0; }

/* badges */
.badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; border: 1px solid transparent; }
.badge { display: inline-flex; align-items: center; gap: 6px; line-height: 1.5; }
.badge::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.badge.high, .badge.fail { background: rgba(255,84,112,.14); color: var(--bad); border-color: rgba(255,84,112,.3); }
.badge.medium, .badge.interrupted { background: rgba(245,181,70,.14); color: var(--warn); border-color: rgba(245,181,70,.3); }
.badge.low, .badge.pass { background: rgba(52,211,153,.13); color: var(--ok); border-color: rgba(52,211,153,.3); }

/* risks */
.risk { display: flex; gap: 14px; align-items: flex-start; background: linear-gradient(180deg, var(--card-2), var(--card)); border: 1px solid var(--line-soft); border-left: 3px solid var(--dim);
  padding: 14px 16px; border-radius: 12px; margin-bottom: 10px; transition: transform .2s, border-color .2s; }
.risk:hover { transform: translateX(3px); }
.risk-high { border-left-color: var(--bad); } .risk-medium { border-left-color: var(--warn); } .risk-low { border-left-color: var(--ok); }
.risk-body { min-width: 0; } .risk p { margin: 5px 0 0; color: var(--muted); font-size: 14px; } .risk code.file { margin-left: 8px; }

/* timeline */
.timeline { list-style: none; margin: 0; padding: 0 0 0 6px; position: relative; }
.timeline::before { content: ""; position: absolute; left: 11px; top: 6px; bottom: 6px; width: 2px; background: linear-gradient(180deg, var(--blue), rgba(47,123,255,.1)); }
.ev { position: relative; display: flex; gap: 16px; padding: 8px 0; }
.node { width: 12px; height: 12px; border-radius: 50%; background: var(--bg); border: 2px solid var(--blue-2); margin-top: 5px; flex: none; z-index: 1; box-shadow: 0 0 10px var(--blue-glow); }
.ev-pass .node { border-color: var(--ok); } .ev-fail .node { border-color: var(--bad); } .ev-interrupted .node { border-color: var(--warn); }
.ev-main { display: flex; flex-direction: column; gap: 3px; min-width: 0; } .ev-cmd { align-self: flex-start; }

/* commands */
.filters { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.chip { background: var(--card); color: var(--muted); border: 1px solid var(--line-soft); padding: 6px 14px; border-radius: 999px; font: inherit; font-size: 13px; cursor: pointer; transition: all .18s; }
.chip b { color: var(--fg); margin-left: 4px; } .chip:hover { border-color: var(--line); color: var(--fg); }
.chip.active { background: rgba(47,123,255,.2); border-color: var(--blue); color: #fff; }
.cmd { background: linear-gradient(180deg, var(--card-2), var(--card)); border: 1px solid var(--line-soft); border-radius: 12px; padding: 4px 16px; margin-bottom: 8px; transition: border-color .2s; }
.cmd:hover, .cmd[open] { border-color: var(--line); }
.cmd summary { cursor: pointer; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 10px 0; list-style: none; }
.cmd summary::-webkit-details-marker { display: none; }
.cmd summary::after { content: ""; margin-left: auto; width: 7px; height: 7px; border-right: 2px solid var(--dim); border-bottom: 2px solid var(--dim); transform: rotate(45deg); transition: transform .2s var(--ease), border-color .2s; }
.cmd[open] summary::after { transform: rotate(-135deg); border-color: var(--blue-2); }
.cmd:hover summary::after { border-color: var(--blue-2); }
.status-dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.status-dot.pass { background: var(--ok); box-shadow: 0 0 8px var(--ok); } .status-dot.fail { background: var(--bad); box-shadow: 0 0 8px var(--bad); } .status-dot.interrupted { background: var(--warn); }
.stream, pre.stat, pre.diff, pre.markdown { background: #04070f; border: 1px solid var(--line-soft); padding: 12px; border-radius: 10px; overflow: auto; max-height: 380px;
  font-size: 12.5px; line-height: 1.5; margin: 0 0 12px; color: #cbd6ea; }
.stream, pre.markdown { white-space: pre-wrap; word-break: break-word; } pre.stat, pre.diff { white-space: pre; }
.streamlabel { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--dim); margin: 8px 0 4px; }

/* table */
.tbl-wrap { overflow-x: auto; margin: -4px -4px 0; padding: 4px; }
.tbl { min-width: 460px; width: 100%; border-collapse: collapse; font-size: 14px; }
.tbl th { text-align: left; font-size: 11.5px; text-transform: uppercase; letter-spacing: .07em; color: var(--dim); padding: 6px 10px; border-bottom: 1px solid var(--line); }
.tbl td { padding: 10px; border-bottom: 1px solid var(--line-soft); } .tbl tr:last-child td { border-bottom: 0; } .tbl tbody tr { transition: background .15s; } .tbl tbody tr:hover { background: rgba(47,123,255,.06); }

/* git */
.filegroup h4 { display: flex; align-items: center; gap: 8px; margin: 10px 0 6px; font-size: 13px; color: var(--fg); }
.st { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 6px; font-size: 11px; font-weight: 700; color: #04070f; }
.filegroup ul { margin: 0 0 6px; padding: 0; list-style: none; } .filegroup li { padding: 3px 0; }
.statrows { display: grid; gap: 6px; margin-bottom: 12px; }
.statrow { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) auto; gap: 10px; align-items: center; font-size: 13px; }
.statrow code { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.statbar { display: flex; height: 8px; background: rgba(148,163,184,.1); border-radius: 999px; overflow: hidden; }
.statbar .plus { background: var(--ok); } .statbar .minus { background: var(--bad); }
.diffbox summary { cursor: pointer; font-weight: 600; } .diffbox[open] summary { margin-bottom: 12px; }
.dl { display: block; padding: 0 6px; margin: 0 -6px; } .d-add { background: rgba(52,211,153,.1); color: #86efc0; } .d-del { background: rgba(255,84,112,.1); color: #ff9aac; }
.d-hunk { color: var(--blue-2); background: rgba(47,123,255,.1); } .d-meta { color: var(--muted); font-weight: 600; }

.copyrow { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 12px; flex-wrap: wrap; }
button.copy { background: linear-gradient(180deg, var(--blue-2), var(--blue)); color: #fff; border: 0; padding: 7px 16px; border-radius: 8px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
  transition: transform .15s, box-shadow .2s; box-shadow: 0 6px 18px -8px var(--blue-glow); }
button.copy:hover { transform: translateY(-1px); box-shadow: 0 10px 22px -8px var(--blue-glow); } button.copy:active { transform: translateY(0); }
:focus-visible { outline: 2px solid var(--blue-2); outline-offset: 2px; border-radius: 6px; }
.ev-main code { transition: border-color .2s, background .2s; } .ev:hover .ev-main code { border-color: var(--blue); background: rgba(47,123,255,.16); }
.empty { transition: border-color .2s, background .2s; } .empty:hover { border-color: rgba(91,155,255,.45); background: rgba(47,123,255,.06); }
.chip:active, .nav a:active { transform: scale(.97); }
.foot { text-align: center; margin-top: 48px; padding-top: 20px; border-top: 1px solid var(--line-soft); }
::-webkit-scrollbar { width: 10px; height: 10px; } ::-webkit-scrollbar-thumb { background: rgba(91,155,255,.3); border-radius: 8px; } ::-webkit-scrollbar-track { background: transparent; }

@media (max-width: 1020px) { .grid3, .grid2 { grid-template-columns: 1fr; } }
@media (max-width: 820px) {
  .layout { grid-template-columns: minmax(0, 1fr); }
  main { min-width: 0; }
  .sidebar { z-index: 20; height: auto; flex-direction: row; align-items: center; gap: 10px; padding: 10px 12px; border-right: 0; border-bottom: 1px solid var(--line); backdrop-filter: blur(10px); }
  .brand span, .side-foot { display: none; } .brand { padding: 0; }
  .nav { flex-direction: row; overflow-x: auto; gap: 4px; flex: 1; } .nav a { white-space: nowrap; padding: 8px 10px; } .nav a:hover { transform: none; }
  .nav a em { display: none; }
}
@media (max-width: 820px) { .nav a.active::before { display: none; } .side-run { display: none; } main { padding-top: 22px; } h2::after { display: none; } }
@media (max-width: 520px) { .nav a span { display: none; } .nav a.active span { display: inline; } .kpi-label { min-height: 0; } }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }
`;

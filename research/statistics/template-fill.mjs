/* The morning market-discussion template, filled once (F5, 27 Sep 2026).
   node research/statistics/template-fill.mjs --evidence <dir> [--s6b <s6-conditions.json>]
   <dir> holds the live reads as text, captured headless from the deployed pages (see the deliverable):
     live-allocation.txt  allocation.scintillahub.ai — the heat and its voters
     live-hub-board.txt   scintillahub.ai — the board (Liked scope, sorted by Geiger)
     live-hub-events.txt  scintillahub.ai EVENTS — the earnings tape and the upcoming list
     live-reads-captured-utc.txt
   Joins them with data/levels-v3.json (computed from the chart API) and writes data/market-discussion-20260927.json.
   Nothing here predicts; every line names its source and its sample. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2); const opt = (k) => args.includes(k) ? args[args.indexOf(k) + 1] : null;
const EV = opt("--evidence"), S6B = opt("--s6b");
if (!EV) { console.error("--evidence <dir> is required"); process.exit(2); }
const L = JSON.parse(fs.readFileSync(path.join(here, "data/levels-v3.json"), "utf8"));
const read = (f) => fs.readFileSync(path.join(EV, f), "utf8");
const lines = (f) => read(f).split("\n").map((s) => s.trim()).filter(Boolean);
const num = (s) => { if (s == null) return null; const m = String(s).replace(/[,%×$]/g, "").match(/^\(?([+-]?\d+(\.\d+)?)\)?$/); if (!m) return null; const v = +m[1]; return /^\(/.test(String(s)) ? -Math.abs(v) : v; };

/* 1 · the heat and its voters (allocation tool, live) */
const A = lines("live-allocation.txt");
const heatLine = A.find((s) => /^Heat reads /.test(s)) || "";
const heat = { sentence: heatLine.split(". ")[0] + ".", value: num((heatLine.match(/Heat reads ([+-]?\d+\.\d+)/) || [])[1]), voters: [], sources: [] };
const vStart = A.findIndex((s) => /MACRO HEAT — the voters/.test(s)), vEnd = A.findIndex((s) => /^GEIGER DIALS/.test(s));
for (let i = vStart; i < vEnd; i++) if (/^w [\d.]+$/.test(A[i])) {
  const name = A[i - 3], detail = A[i - 2], val = A[i - 1];
  heat.voters.push({ name, detail, value: val === "—" ? null : num(val), weight: +A[i].slice(2) });
}
const srcEnd = A.findIndex((s) => /^THE BRIEF/.test(s));
for (let i = 2; i < srcEnd; i++) { const m = A[i].match(/^(\S+) · (.+)$/); if (m) heat.sources.push({ table: m[1], state: m[2] }); }
heat.weight_total = heat.voters.reduce((s, v) => s + (v.value == null ? 0 : v.weight), 0);
heat.recomputed = heat.weight_total ? heat.voters.reduce((s, v) => s + (v.value == null ? 0 : v.value * v.weight), 0) / heat.weight_total : null;

/* 2 · the board (Liked scope as served, sorted by Geiger) */
const Bd = lines("live-hub-board.txt"); const board = [];
const hdr = Bd.findIndex((s) => s === "MKT"); let chunk = [];
for (let i = hdr + 1; i < Bd.length && board.length < 40; i++) {
  if (Bd[i] === "◎") { if (chunk.length) { const toks = chunk.filter((t) => t !== "♥" && t !== "☆");
      const ri = toks.findIndex((t, k) => k > 3 && /^[a-z]/.test(t));
      if (ri > 3) board.push({ ticker: toks[0], last: num(toks[1]), chg: num(toks[2]), rsi: num(toks[ri - 3]), trend: num(toks[ri - 2]), mom: num(toks[ri - 1]?.replace("◆", "")), read: toks[ri] }); }
    chunk = []; continue; }
  if (/^EARNINGS →|^MACRO →|^ALL →/.test(Bd[i])) break;
  chunk.push(Bd[i]);
}
const boardScope = (Bd.find((s) => /^COHORT GEIGER · /.test(s)) || "").replace("COHORT GEIGER · ", "");
const boardCount = Bd.find((s) => /tickers · usual day/.test(s)) || "";

/* 3 · the earnings tape (Events room, live) */
const E = read("live-hub-events.txt"); const up = [];
const upBlock = E.slice(E.indexOf("UPCOMING · EARNINGS"), E.indexOf("RELEASES")).split("\n").map((s) => s.trim()).filter(Boolean);
for (let i = 1; i + 2 < upBlock.length; i += 3) { const [t, est, when] = upBlock.slice(i, i + 3); const m = when.match(/^(\w{3} \d+)\s*(AMC|BMO)?\s*in (\d+)d/);
  if (m) up.push({ ticker: t, eps_est: num(est.replace("eps est ", "")), date: m[1], time: m[2] || "not stated", in_days: +m[3] }); }
const tapeLine = (E.match(/\|?NOW\|?[\s\S]*?(?=TUECBRS|$)/) || [""])[0];
const tape = []; const seen = new Set();
for (const m of E.matchAll(/(MON|TUE|WED|THU|FRI|IN (\d+) DAYS)([A-Z][A-Z.\-]{0,6})(?=·)/g)) { const t = m[3]; if (seen.has(t)) continue; seen.add(t);
  tape.push({ ticker: t, when: m[1], in_days: m[2] ? +m[2] : ({ MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5 })[m[1]] }); }

/* 4 · the computed lines from levels-v3 */
const S = L.symbols; const r2 = (v) => v == null ? null : Math.round(v * 100) / 100;
const companies = Object.keys(S).filter((s) => !S[s].fund);
const leaders = companies.filter((s) => S[s].today.lead != null).sort((a, b) => S[b].today.lead - S[a].today.lead).slice(0, 15)
  .map((s) => ({ sym: s, lead: r2(S[s].today.lead), rel120: r2(S[s].today.rel120), rsi: r2(S[s].today.rsi.v), rsiP: r2(S[s].today.rsi.p3y), from_high: r2(S[s].pullbacks.current.from_high), vs_usual: r2(S[s].pullbacks.current.vs_usual), branches: S[s].branches }));
const sigmaToday = Object.keys(S).filter((s) => S[s].sigma.today_ratio != null && Math.abs(S[s].sigma.today_ratio) >= 2 && S[s].last_day === L.breadth.date)
  .sort((a, b) => Math.abs(S[b].sigma.today_ratio) - Math.abs(S[a].sigma.today_ratio))
  .map((s) => { const x = S[s], side = x.sigma.today_ratio > 0 ? "up2" : "down2"; return { sym: s, ratio: r2(x.sigma.today_ratio), move: r2(x.today.move), ud: r2(x.today.ud), fund: x.fund, followed: x.sigma[side] }; });
const v3 = (s) => { const x = S[s]; if (!x) return null; const t = x.today;
  return { sym: s, close: x.close, rsi: r2(t.rsi.v), rsiP3y: r2(t.rsi.p3y), rsiLine: r2(x.lines.rsi["3y"]?.q10), rsiLineHi: r2(x.lines.rsi["3y"]?.q90), fixed30: t.rsi.v != null && t.rsi.v <= 30,
    d200: r2(t.d200.v), d200Pall: r2(t.d200.pall), from_high: r2(x.pullbacks.current.from_high), usual_depth: r2(x.pullbacks.all?.depth?.med), vs_usual: r2(x.pullbacks.current.vs_usual),
    usual_rsi_low: r2(x.pullbacks.all?.rsi?.med), lead: r2(t.lead), ratio: r2(x.sigma.today_ratio), ud: r2(t.ud), pullbacks_n: x.pullbacks.n }; };
const atP10 = Object.keys(S).filter((s) => S[s].today.rsi.p3y != null && S[s].today.rsi.p3y <= 10);
const atP90 = Object.keys(S).filter((s) => S[s].today.rsi.p3y != null && S[s].today.rsi.p3y >= 90);
const at30 = Object.keys(S).filter((s) => S[s].today.rsi.v != null && S[s].today.rsi.v <= 30);
const leaderUsual = companies.filter((s) => (S[s].today.lead ?? 0) >= 200 / 3 && (S[s].pullbacks.current.vs_usual ?? 0) >= 1 && S[s].pullbacks.current.high_above_200);
const deepAny = companies.filter((s) => (S[s].pullbacks.current.vs_usual ?? 0) >= 2 && S[s].pullbacks.current.high_above_200);

/* 5 · run-up into the report: names on the live tape inside 20 sessions (≈ 28 calendar days), with S6's own history */
const runup = [...new Map([...up, ...tape].map((u) => [u.ticker, u])).values()].filter((u) => u.in_days <= 28).map((u) => {
  const s6 = L.s6?.names?.[u.ticker] || null; const x = S[u.ticker];
  return { ticker: u.ticker, in_days: u.in_days, date: u.date || null, time: u.time || null, eps_est: u.eps_est ?? null, s6,
    now: x ? { rsiP3y: r2(x.today.rsi.p3y), d200: r2(x.today.d200.v), lead: r2(x.today.lead), from_high: r2(x.pullbacks.current.from_high) } : null };
}).sort((a, b) => a.in_days - b.in_days);
let s6b = null; if (S6B && fs.existsSync(S6B)) { const j = JSON.parse(fs.readFileSync(S6B, "utf8")); s6b = { built_utc: j.built_utc, reports: j.reports, all_reports: j.all_reports, all_ordinary: j.all_ordinary, buckets: j.buckets, confluences: j.confluences, cutoffs: j.cutoffs }; }

const out = { built_utc: new Date().toISOString(), captured_utc: read("live-reads-captured-utc.txt").trim(), bars_through: L.breadth.date,
  heat, board: { scope: boardScope, count_line: boardCount, rows: board }, breadth: L.breadth, rotation: L.rotation, leaders, sigma_today: sigmaToday, sigma_pool: L.sigma_pool,
  rulebook_v3: { focus: L.focus.map(v3).filter(Boolean), at_own_p10: atP10, at_own_p90: atP90, at_fixed_30: at30, leaders_in_usual_pullback: leaderUsual.map(v3), deep_pullbacks_2x: deepAny.length },
  earnings: { upcoming: up, tape, runup, s6_pooled: L.s6?.pooled ?? null }, s6b,
  ai_cycle: { state: null, set_by: null, set_at: null, reason: null, note: "not set: no operator input is stored anywhere yet; the proposal adds operator_inputs (append-only) and the page asks Alan to set it", context: L.rotation.ai_complex } };
fs.writeFileSync(path.join(here, "data", "market-discussion-20260927.json"), JSON.stringify(out, null, 1));
console.log(`heat ${heat.value} (${heat.voters.length} voters, recomputed ${heat.recomputed?.toFixed(3)}); board rows ${board.length}; upcoming ${up.length}, tape ${tape.length}, run-up list ${runup.length}; sigma today ${sigmaToday.length}; at own P10 ${atP10.length}, at 30 ${at30.length}`);

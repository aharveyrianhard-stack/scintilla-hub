/* N9 · the page: deliverables/20260928/point-in-time/POINT-IN-TIME.html — old (today's names) vs new (point-in-time).
   node research/statistics/point-in-time/pit-page.mjs   (reads the JSON the re-runs wrote; no network) */
import fs from "node:fs"; import path from "node:path"; import zlib from "node:zlib"; import { fileURLToPath } from "node:url";
import { PIT_ROOT } from "./build-universe.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../.."), OUT = path.join(ROOT, "deliverables/20260928/point-in-time"), DATA = path.join(OUT, "data");
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const med = (xs) => { const a = xs.filter(Number.isFinite).sort((p, q) => p - q); if (!a.length) return null; const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const f1 = (x) => x == null || !Number.isFinite(x) ? "—" : x.toFixed(1), f2 = (x) => x == null || !Number.isFinite(x) ? "—" : x.toFixed(2);
const sg = (x, d = 2) => x == null || !Number.isFinite(x) ? "—" : (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(x).toFixed(d);
const cls = (x) => x > 0 ? "up" : x < 0 ? "dn" : "";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const table = (head, rows, cl = "") => `<div class="scroll"><table${cl ? ` class="${cl}"` : ""}><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</table></div>`;

export function build() {
  const OLDC = J("deliverables/20260928/leaders/leaders-concentration.json"), NEWC = J("deliverables/20260928/point-in-time/data/pit-concentration.json");
  const OLDT = J("deliverables/20260928/leaders/leaders-traits.json"), NEWT = J("deliverables/20260928/point-in-time/data/pit-traits.json");
  const OLDQ = J("deliverables/20260928/stats-3/data/q1.json"), NEWQ = J("deliverables/20260928/point-in-time/data/pit-q1d.json");
  const OLDP = J("deliverables/20260928/pullback-playbook/data/pullback-playbook.json"), NEWP = J("deliverables/20260928/point-in-time/data/pit-playbook.json");
  const M = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(PIT_ROOT, "membership.json.gz"))).toString()), man = M.manifest;
  const spyCheck = JSON.parse(fs.readFileSync(path.join(PIT_ROOT, "raw/spy-check.json"), "utf8"));

  /* ---------- 1 · concentration ---------- */
  const oldBy = new Map(OLDC.years.map((y) => [y.year, y])), newBy = new Map(NEWC.years.map((y) => [y.year, y]));
  const upYears = OLDC.years.filter((y) => y.index > 0 && !y.partial && y.share?.[10] != null).map((y) => y.year);
  const pre = upYears.filter((y) => y < 2020), post = upYears.filter((y) => y >= 2020);
  const mShare = (by, ys, n) => med(ys.map((y) => by.get(y)?.share?.[n]));
  const pooled = (by, ys, n) => 100 * ys.reduce((a, y) => a + by.get(y).tops[n], 0) / ys.reduce((a, y) => a + by.get(y).index, 0);
  const conc = { pre: { old10: mShare(oldBy, pre, 10), new10: mShare(newBy, pre, 10), old1: mShare(oldBy, pre, 1), new1: mShare(newBy, pre, 1), oldPool: pooled(oldBy, pre, 10), newPool: pooled(newBy, pre, 10) },
    post: { old10: mShare(oldBy, post, 10), new10: mShare(newBy, post, 10), old1: mShare(oldBy, post, 1), new1: mShare(newBy, post, 1) } };
  const trackErr = NEWC.years.filter((y) => !y.partial).map((y) => Math.abs(y.index - y.gspc)), trackMed = med(trackErr), trackMax = Math.max(...trackErr);
  const covOld = OLDC.years.filter((y) => y.coverage).map((y) => y.coverage.weight), covNew = NEWC.years.filter((y) => y.year < 2020).map((y) => y.coverage.memberDaysPriced);

  /* chart 1: top-10 share of each up year's gain, old vs new */
  const chart1 = (() => {
    const W = 1500, H = 420, L = 70, R = 30, T = 50, B = 60, ys = upYears, n = ys.length, bw = (W - L - R) / n, yMax = 120;
    const y = (v) => T + (H - T - B) * (1 - Math.min(v, yMax) / yMax);
    let g = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Share of each up year's gain from the ten biggest contributors, today's names vs point-in-time"><rect width="${W}" height="${H}" fill="#0B0B12"/>`;
    for (const v of [0, 25, 50, 75, 100]) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#1E1E28"/><text x="${L - 8}" y="${y(v) + 4}" fill="#8A8A9A" font-size="13" text-anchor="end" font-family="ui-monospace,Menlo,monospace">${v}%</text>`;
    ys.forEach((yr, i) => {
      const o = oldBy.get(yr).share[10], nw = newBy.get(yr).share[10], x0 = L + i * bw + bw * 0.14, w = bw * 0.34, meas = yr >= 2020;
      g += `<rect x="${x0}" y="${y(o)}" width="${w}" height="${y(0) - y(o)}" rx="3" fill="#4A4A56"><title>${yr} · ${meas ? "SPY holdings (measured)" : "survivor estimate (113 names)"}: ${f1(o)}%</title></rect>`;
      g += `<rect x="${x0 + w + 2}" y="${y(nw)}" width="${w}" height="${y(0) - y(nw)}" rx="3" fill="#B4B4C0"><title>${yr} · point-in-time, every member of the day: ${f1(nw)}%</title></rect>`;
      if (o > yMax || nw > yMax) g += `<text x="${x0 + w}" y="${T - 6}" fill="#9C9CAE" font-size="12" text-anchor="middle">${f1(Math.max(o, nw))}%↑</text>`;
      g += `<text x="${x0 + w}" y="${H - B + 20}" fill="#9C9CAE" font-size="13" text-anchor="middle" font-family="ui-monospace,Menlo,monospace">${yr}</text>`;
    });
    const sx = L + pre.length * bw; g += `<line x1="${sx}" x2="${sx}" y1="${T - 10}" y2="${H - B}" stroke="#3A3A48" stroke-dasharray="4 4"/><text x="${sx + 8}" y="${T + 4}" fill="#9C9CAE" font-size="13">2020 → holdings measured (old) · point-in-time estimate (new)</text>`;
    g += `<rect x="${L}" y="${H - 22}" width="14" height="10" fill="#4A4A56"/><text x="${L + 20}" y="${H - 13}" fill="#B4B4C6" font-size="13">today's names (old study)</text><rect x="${L + 240}" y="${H - 22}" width="14" height="10" fill="#B4B4C0"/><text x="${L + 260}" y="${H - 13}" fill="#B4B4C6" font-size="13">point-in-time (every member of the day)</text>`;
    return g + `<text x="${L}" y="24" fill="#C8C8D2" font-size="16">Share of each up year's gain from its 10 biggest contributors</text></svg>`;
  })();

  /* ---------- 2 · traits ---------- */
  const trRow = (label, P, k) => { const A = P.traits.all; return [label, P.n, f1(P.baseRate) + "%", `${f1(A.T.rs.leaders.med)} vs ${f1(A.T.rs.others.med)}`, `${f1(A.T.rsRank.baseRateAtOrAbove[90])}% (×${f2(A.T.rsRank.baseRateAtOrAbove[90] / P.baseRate)})`, `${f1(A.T.fromHigh.leaders.med)} vs ${f1(A.T.fromHigh.others.med)}`, `${f1(A.T.rsiPct.leaders.med)} vs ${f1(A.T.rsiPct.others.med)}`, A.C.order.map((o) => f1(o.chance)).join(" / ") + "%", `${f2(A.T.w.leaders.med)} vs ${f2(A.T.w.others.med)}`]; };
  const PEo = OLDT.summary.byRegime.estimated, PEn = NEWT.summary.byRegime.estimated, PMo = OLDT.summary.byRegime.measured, PMn = NEWT.summary.byRegime.measured;

  /* ---------- 3 · cap tranches ---------- */
  const tr = ["mega cap (>200bn)", "large cap (10–200bn)", "mid cap (2–10bn)", "small cap (<2bn)"];
  const qo = new Map(OLDQ.byTypeCell.map((b) => [b.type, b])), qn = new Map(NEWQ.byTypeCell.map((b) => [b.type, b]));
  const chart2 = (() => {
    const W = 1500, H = 330, L = 250, R = 60, T = 50, rowH = 64, lo = -20, hi = 5, x = (v) => L + (W - L - R) * (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo);
    let g = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Each tranche's any-day next 63 sessions against SPY, today's cap vs cap on the day"><rect width="${W}" height="${H}" fill="#0B0B12"/>`;
    for (const v of [-20, -15, -10, -5, 0, 5]) g += `<line x1="${x(v)}" x2="${x(v)}" y1="${T - 10}" y2="${T + rowH * 4}" stroke="${v === 0 ? "#3A3A48" : "#1E1E28"}"/><text x="${x(v)}" y="${T + rowH * 4 + 18}" fill="#8A8A9A" font-size="13" text-anchor="middle" font-family="ui-monospace,Menlo,monospace">${v > 0 ? "+" : ""}${v}</text>`;
    tr.forEach((t, i) => {
      const o = qo.get(t)?.x63_base?.med, nw = qn.get(t)?.x63_base?.med, y0 = T + i * rowH;
      g += `<text x="${L - 12}" y="${y0 + 26}" fill="#B4B4C6" font-size="14" text-anchor="end">${t}</text>`;
      for (const [v, dy, op, lab] of [[o, 6, 0.45, "today's cap (old)"], [nw, 30, 1, "cap on the day (new)"]]) {
        if (v == null) continue; const a = x(Math.min(0, v)), b = x(Math.max(0, v));
        g += `<rect x="${a}" y="${y0 + dy}" width="${Math.max(2, b - a)}" height="18" rx="3" fill="${v >= 0 ? "#00FFA3" : "#FF2D55"}" fill-opacity="${op}"><title>${t} · ${lab}: ${sg(v)} pts vs SPY over the next 63 sessions (typical day)</title></rect>`;
        g += `<text x="${v >= 0 ? b + 6 : a - 6}" y="${y0 + dy + 14}" fill="#B4B4C6" font-size="13" text-anchor="${v >= 0 ? "start" : "end"}" font-family="ui-monospace,Menlo,monospace">${sg(v)}${v < lo ? " (bar clipped)" : ""}</text>`;
      }
    });
    return g + `<text x="${L}" y="24" fill="#C8C8D2" font-size="16">Typical stock's next 63 sessions vs SPY, by size — faint bar: typed by today's cap · solid bar: typed by its cap that day</text></svg>`;
  })();

  /* ---------- 4 · tranche back-test on the leaders basket ---------- */
  const LO = OLDP.s4.instruments.LEADERS, LN = NEWP.s4.instruments.LEADERS, strat = ["single", "dca", "fan", "rsi", "all", "state"];
  const pbRows = ["3", "5", "10"].flatMap((d) => strat.filter((s) => LO.byDepth[d].strategies[s]).map((s) => { const a = LO.byDepth[d].strategies[s], b = LN.byDepth[d].strategies[s];
    return [`${d}%`, s, LO.byDepth[d].n, `${sg(a.improvement.med)} → <b>${sg(b.improvement.med)}</b>`, `${sg(a.ret126.med)} → <b>${sg(b.ret126.med)}</b>`, `${sg(a.worst126.med)} → <b>${sg(b.worst126.med)}</b>`]; }));
  const surv = (X) => { const o = new Map(); for (const [d, B] of Object.entries(X.byDepth)) for (const [s, st] of Object.entries(B.strategies)) for (const [k, t] of Object.entries(st.vsSingle ?? {})) o.set(`${d}|${s}|${k}`, t); return o; };
  const so = surv(LO), sn = surv(LN), flips = [...new Set([...so.keys(), ...sn.keys()])].filter((k) => !!so.get(k)?.survives !== !!sn.get(k)?.survives).sort((a, b) => +a.split("|")[0] - +b.split("|")[0]);
  const lvlO = OLDP.s1.depth.LEADERS, lvlN = NEWP.s1.depth.LEADERS, yrs = (Date.parse("2026-09-25") - Date.parse("2007-01-03")) / (365.25 * 864e5);
  const cagr = (v) => 100 * (Math.pow(v / 100, 1 / yrs) - 1);
  const newTop = NEWP.sources.LEADERS.thisYear, oldTop = OLDP.sources.LEADERS.thisYear;
  const bask = JSON.parse(fs.readFileSync(path.join(PIT_ROOT, "pit-leaders-basket.json"), "utf8")).top;
  const oldBask = (() => { const p = path.join(process.env.HOME, "Library/Application Support/scintilla/stats-cache/leaders-fmp-20260928/caps"), caps = {}; for (const f of fs.readdirSync(p)) if (f.endsWith(".json")) caps[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(p, f), "utf8")).sort((a, b) => a.date < b.date ? -1 : 1);
    const out = {}; for (let y = 2007; y <= 2026; y++) { const at = []; for (const [s, rows] of Object.entries(caps)) { if (s === "GOOG") continue; const r = rows.find((x) => x.date >= `${y}-01-01`); if (r && r.date < `${y}-01-15` && r.marketCap > 0) at.push([s.replace("-", "."), r.marketCap]); } out[y] = at.sort((a, b) => b[1] - a[1]).slice(0, 20).map((a) => a[0]); } return out; })();
  const diffs = Object.keys(bask).map((y) => ({ y, in: bask[y].filter((s) => !oldBask[y].includes(s)), out: oldBask[y].filter((s) => !bask[y].includes(s)) })).filter((r) => r.in.length || r.out.length);

  /* ---------- the membership and its gaps ---------- */
  const SP = man.SP500, ND = man.NDX, cov = (x) => f1(100 * x.member_sessions_with_bar / x.member_sessions);
  const lacking = M.lacking.SP500.filter((x) => x.share == null || x.share < 0.95), none = lacking.filter((x) => !x.share);
  const noCap = [...new Set(M.coverage.SP500.filter((c) => !c.hasCap).map((c) => c.sym))];
  const anomalies = [...M.membership.SP500.anomalies.map((a) => ({ ...a, idx: "S&P 500" })), ...M.membership.NDX.anomalies.map((a) => ({ ...a, idx: "Nasdaq-100" }))];
  const flags = NEWC.guardFlags, fk = (k) => [...new Set(flags.filter((f) => f.kind === k).map((f) => f.sym))];

  // small data files next to the page
  fs.writeFileSync(path.join(DATA, "manifest.json"), JSON.stringify(man, null, 1));
  fs.writeFileSync(path.join(DATA, "membership-sp500-ndx.json"), JSON.stringify({ note: "intervals: one row per membership stretch, from/to = first/last member session (null = before 2003-01-02 / still a member). Tickers are FMP's (renamed members carry today's ticker).", SP500: { intervals: M.membership.SP500.intervals, anomalies: M.membership.SP500.anomalies, lackingBars: M.lacking.SP500 }, NDX: { intervals: M.membership.NDX.intervals, anomalies: M.membership.NDX.anomalies, lackingBars: M.lacking.NDX }, spyHoldingsCheck: spyCheck.map((r) => ({ d: r.d, pit: r.pit, pitOnly: r.pitOnly, heldOnly: r.heldOnly })), guardFlags: flags }));

  const RERUN = { growth: !!NEWT.growth, growthText: NEWT.growth ? `before 2020 a growing top line lifted the chance of leading from ${f1(NEWT.growth.estimated.revenueGrowing[1].chance)}% to ${f1(NEWT.growth.estimated.revenueGrowing[0].chance)}% (old: 18.6% → 20.6%); after 2020, on equal terms now, ${f1(NEWT.growth.measured.revenueGrowing[1].chance)}% → ${f1(NEWT.growth.measured.revenueGrowing[0].chance)}%` : null };
  const built = new Date().toISOString().slice(0, 16).replace("T", " ");
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Point-in-time universe · 28 Sep 2026</title>
<style>
body{margin:0;background:#07070C;color:#B4B4C6;font:17px/1.55 -apple-system,"Helvetica Neue",Arial,sans-serif;padding:28px 34px 80px;max-width:1560px}
h1{font-size:34px;margin:0 0 6px;color:#C8C8D2}h2{font-size:26px;margin:48px 0 8px;color:#C8C8D2}h3{font-size:19px;margin:26px 0 6px;color:#C8C8D2}
p,li{max-width:1100px}.q{color:#9C9CAE;font-size:13px}
ol.lead{font-size:19px;color:#C8C8D2;max-width:1140px;padding-left:24px}ol.lead li{margin:0 0 12px}
.status{border:1px solid #2A2A36;border-left:4px solid #8A8A9E;padding:12px 16px;margin:18px 0;max-width:1100px;color:#C8C8D2}
code{font:14px ui-monospace,Menlo,monospace;color:#BEBECE}
.scroll{overflow-x:auto;max-width:100%}
table{border-collapse:collapse;font-size:14px;margin:10px 0;font-variant-numeric:tabular-nums}th,td{border:1px solid #24242E;padding:6px 9px;text-align:left;vertical-align:top}th{color:#A8A8BA;font-weight:600;font-size:13px;font-family:ui-monospace,Menlo,monospace}
td b{color:#C8C8D2}.chg{color:#C8C8D2;font-weight:600}
figure{margin:14px 0 22px}.chart{display:block;width:100%;max-width:1500px;height:auto;border:1px solid #1E1E28;background:#0B0B12}
.up{color:#00FFA3}.dn{color:#FF2D55}
dl{max-width:1140px}dt{color:#C8C8D2;font-weight:600;margin-top:10px}dd{margin:2px 0 0 0}
.small{font-size:13px;color:#9C9CAE}
@media(max-width:600px){.chart{min-width:960px}body{padding:20px 16px 60px;font-size:16px}h1{font-size:26px}h2{font-size:22px}ol.lead{font-size:17px}table{font-size:12px}th,td{padding:5px 6px}code{overflow-wrap:anywhere}}
</style></head><body>
<span data-scnav-slot></span><h1>A survivorship-free universe: who was really in the S&amp;P 500 each day since 2003, and which of today's conclusions change</h1>
<div class="q">Point-in-time · N9 · 28 Sep 2026 · built ${built} UTC · research, not rules · bars to 2026-09-25</div>

<div class="status"><b>STATUS · built and used.</b> The member list of the S&amp;P 500 for every trading day since 2 Jan 2003 (${SP.ever_members} companies were members at some point), the Nasdaq-100 the same way (${ND.ever_members}), month-end market caps, and daily prices for ${cov(SP)}% of all S&amp;P member-days. Three of today's studies were re-run on it and are shown old vs new below. The research copy is on this Mac; the copy in the cloud store (R2) needs one job run by the coordinator — the job is written and tested, not run. Green = up / ahead, red = down / behind.</div>

<h2>What changed, in plain words</h2>
<ol class="lead">
<li><b>Size tranches — the big one. The old finding reverses.</b> Typed by today's size, mega caps looked like they beat SPY by ${sg(qo.get(tr[0]).x63_base.med)} points a quarter and small caps looked doomed at ${sg(qo.get(tr[3]).x63_base.med)}. Typed by their size <i>on the day</i>, among real S&amp;P members, mega caps trailed (${sg(qn.get(tr[0]).x63_base.med)}) and small members led (${sg(qn.get(tr[3]).x63_base.med)}). The old numbers were an artefact: a company is mega today because it rose, small today because it fell. What did <i>not</i> change: inside every size, the "pullback cell" (strong trend, weak momentum) still tracks that size's ordinary day — no size turns it into an edge.</li>
<li><b>Leaders' share of the gains: the old floor was close to the truth.</b> Before 2020 the ten biggest contributors gave a middle ${f1(conc.pre.new10)}% of an up year's gain (old floor: at least ${f1(conc.pre.old10)}%); the single biggest ${f1(conc.pre.new1)}% (old: at least ${f1(conc.pre.old1)}%). Since 2020 it is about two-thirds either way (measured ${f1(conc.post.old10)}%, this rebuild ${f1(conc.post.new10)}%). The conclusion stands and is now a measurement, not a floor: concentration roughly doubled after 2020.</li>
<li><b>What leaders looked like beforehand: mostly unchanged, one small correction.</b> With every member in the pool (not 113 survivors), the chance of a random member leading is ${f1(PEn.baseRate)}%, not ${f1(PEo.baseRate)}%. Cloud order still barely moves the odds. Size is still the trait that recurs. The correction: before 2020 there <i>was</i> a small relative-strength edge (leaders ${sg(PEn.traits.all.T.rs.leaders.med, 1)} vs others ${sg(PEn.traits.all.T.rs.others.med, 1)} points against SPY; the old run saw none), and leaders sat nearer their 52-week high (${f1(PEn.traits.all.T.fromHigh.leaders.med)}% vs ${f1(PEn.traits.all.T.fromHigh.others.med)}%).</li>
<li><b>Buying in tranches on the leaders basket: same answer, a little sharper.</b> The basket of each year's 20 largest members grew about ${f1(cagr(lvlN.close))}% a year since 2007 instead of ${f1(cagr(lvlO.close))}% (AIG was in it for 2007–08; Berkshire was not before it joined the index in 2010). Laddering still never beat buying at once on return; at 5% and 7% pullbacks its cost is now clearer; its one benefit — a smaller worst paper loss at shallow 2–3% pullbacks — holds and is now significant at 2% too.</li>
</ol>

<h2>1 · The universe</h2>
<p><b>How the member list is built.</b> FMP publishes today's list and a log of every addition and removal. Starting from today's list, each change is undone going backwards in time: on a change date the added company leaves and the removed one comes back. That gives one row per stretch of membership (${SP.stretches} stretches for the S&amp;P 500). The count stays between ${SP.member_count_min} and ${SP.member_count_max} every day since 2003 (the index holds 500 companies and ~503 share lines). ${SP.anomalies} records in the S&amp;P log and ${ND.anomalies} in the Nasdaq-100 log do not fit (a company "added" that was never removed, or "removed" twice); they are listed below and left as they are, not fixed silently.</p>
<p><b>Checked against the real index fund.</b> SPY files its holdings every quarter (28 filings, Sep 2019 → Jun 2026). After matching renamed tickers, the rebuilt list and the fund's holdings differ by ${Math.min(...spyCheck.map((r) => r.pitOnly.length))}–${Math.max(...spyCheck.map((r) => r.pitOnly.length))} names per quarter, and nearly all of those are still ticker spellings (FLT→CPAY, FBHS→FBIN, VIAC/PARA→PSKY, LB→BBWI) rather than wrong members. From 2025 the two agree to within one name. Before 2019 there is no holdings file to check against.</p>
${table(["", "S&P 500", "Nasdaq-100"], [
    ["companies that were members since 2003", SP.ever_members, ND.ever_members],
    ["membership stretches", SP.stretches, ND.stretches],
    ["member count, lowest–highest", `${SP.member_count_min}–${SP.member_count_max}`, `${ND.member_count_min}–${ND.member_count_max}`],
    ["member-days with a daily price", `${cov(SP)}% (${SP.member_sessions_with_bar.toLocaleString("en-US")} of ${SP.member_sessions.toLocaleString("en-US")})`, `${cov(ND)}%`],
    ["stretches with ≥95% of days priced / partly / none", `${SP.stretches_full_bars} / ${SP.stretches_partial_bars} / ${SP.stretches_no_bars}`, `${ND.stretches_full_bars} / ${ND.stretches_partial_bars} / ${ND.stretches_no_bars}`],
    ["companies with no market-cap history", SP.names_without_cap, ND.names_without_cap],
    ["records in FMP's log that do not fit", SP.anomalies, ND.anomalies]])}
<p><b>Where the prices came from.</b> ${Object.entries(man.bar_sources).map(([k, v]) => `${v} names from ${k === "massive" ? "Massive by ticker" : k === "fmp-eod" ? "FMP's daily history (renamed or delisted names Massive files under another ticker)" : k === "massive+old-ticker" ? "Massive, old ticker joined in front of the new one (checked continuous)" : "Massive under the old ticker only"}`).join("; ")}. <b>Caps:</b> ${man.cap_sources.fmp} names from FMP's month-end market caps; ${man.cap_sources["price×shares (Massive dated shares)"]} from Massive's dated share counts × price (names FMP no longer carries).</p>
<p><b>Two guards on the prices.</b> (1) A ticker that goes silent for more than 20 days and comes back is usually a different company (MS before 2006 was not Morgan Stanley's ticker; WM before Aug 2009 was Washington Mutual, not Waste Management): history before the hole is dropped (${fk("cut-before-hole").length} names), unless the earlier stretch ends when the company left the index (${fk("hole-kept").length} names kept). (2) A one-day move beyond +80% / −44% that the month-end caps do not confirm is an unadjusted split or spin-off (ABT at the AbbVie spin, GOOG at its 2014 split): that day counts as 0% (${flags.filter((f) => f.kind === "jump-ignored").length} days). Three real 2008 collapses the cap check cannot confirm (Fannie Mae, Freddie Mac, Sovereign) are kept by name.</p>
<p class="small">Members with no daily prices at all (${none.length}): ${esc(none.map((x) => `${x.sym} (${x.from ?? "≤2003"}→${x.to ?? "now"})`).join(", "))}. Members priced on part of their stretch (${lacking.length - none.length}): ${esc(lacking.filter((x) => x.share).map((x) => `${x.sym} ${Math.round(100 * x.share)}%`).join(", "))}. No cap history: ${esc(noCap.join(", "))}.</p>
<p class="small">Log records that do not fit: ${esc(anomalies.map((a) => `${a.idx} ${a.sym} ${a.date} (${a.kind})`).join("; "))}.</p>
<p><b>Stored as.</b> Research cache on this Mac, versioned: <code>~/Library/Application Support/scintilla/stats-cache/point-in-time/v1/</code> — <code>raw/</code> (every pull as pulled, compressed), <code>membership.json.gz</code>, <code>caps-monthly.json.gz</code>, <code>bars-pit.json.gz</code>, <code>manifest.json</code>. Next to this page: <a href="data/manifest.json">manifest.json</a> and <a href="data/membership-sp500-ndx.json">membership-sp500-ndx.json</a> (every stretch, every gap, the SPY check). The cloud copy (<code>research/point_in_time_v1/</code> in R2) is written by the job on branch <code>provider/point-in-time-20260928</code> once the coordinator runs it.</p>

<h2>2 · Leaders' share of the market's gains — old vs new</h2>
<p>Old: 2004–2019 estimated from the 113 large companies that still exist (they covered ${f1(Math.min(...covOld))}–${f1(Math.max(...covOld))}% of the index's weight), so every number was "at least". New: every company that was a member each day, weighted by its full market cap, attributed day by day. The rebuilt index tracks the real S&amp;P 500 within a middle ${f2(trackMed)} points a year (worst ${f2(trackMax)}; the real index weights by free float, this by full cap). Before 2008 fewer member-days carry a cap (${f1(Math.min(...covNew))}% in 2004, rising to ${f1(covNew.at(-1))}% by 2019).</p>
<figure class="scroll">${chart1}</figure>
${table(["", "old (today's names)", "new (point-in-time)"], [
    ["2004–2019 up years: top-10 share, middle year", `at least ${f1(conc.pre.old10)}%`, `<b>${f1(conc.pre.new10)}%</b>`],
    ["2004–2019: top-10 share, all up years pooled", `at least ${f1(conc.pre.oldPool)}%`, `<b>${f1(conc.pre.newPool)}%</b>`],
    ["2004–2019: single biggest name, middle year", `at least ${f1(conc.pre.old1)}%`, `<b>${f1(conc.pre.new1)}%</b>`],
    ["2020–2025 up years: top-10 share, middle year", `${f1(conc.post.old10)}% (SPY holdings, measured)`, `${f1(conc.post.new10)}% (cross-check)`],
    ["2020–2025: single biggest name, middle year", `${f1(conc.post.old1)}%`, `${f1(conc.post.new1)}%`]])}
${table(["year", "S&P 500", "rebuilt", "top-10 share · old", "top-10 share · new", "top 5 names · new"], upYears.map((y) => { const o = oldBy.get(y), n = newBy.get(y); return [y, sg(n.gspc), sg(n.index), f1(o.share[10]) + "%", `<b>${f1(n.share[10])}%</b>`, n.top20.slice(0, 5).map((x) => x.sym).join(" ")]; }))}
<p><b>What changed.</b> Only the pre-2020 numbers, and only a little: the floors were close. The new top-5 lists hold names the survivor list could not see (Bell South in 2006, AIG's collapse in 2008). <b>What did not:</b> after 2020 the top ten give about two-thirds of an up year's gain, roughly twice the 2004–2019 share.</p>

<h2>3 · What leaders looked like the day before their year — old vs new</h2>
<p>Leader = one of a year's 20 biggest contributors (section 2). Old pool before 2020: the 113 survivors; after 2020: SPY's holdings with chart-API bars. New pool: every member that day with a price and a cap. Traits are read on the last close before the year, with the leaders lane's own code (relative strength vs SPY over 252 sessions, distance from the 52-week high, RSI own-history percentile, Station cloud order, index weight). Revenue and profit growth were <b>not</b> re-read: statements exist for 119 names only.</p>
${table(["pool", "company-years", "chance of leading (base)", "relative strength vs SPY, leaders vs others (median, pts)", "top tenth by strength: chance of leading (× base)", "from 52-week high, leaders vs others (%)", "RSI own-history percentile, leaders vs others", "chance by cloud order: bull / mixed / bear", "index weight, leaders vs others (%)"], [
    trRow("2005–2019 · old (113 survivors)", PEo), trRow("2005–2019 · <b>new (every member)</b>", PEn), trRow("2020–2026 · old (SPY holdings with bars)", PMo), trRow("2020–2026 · <b>new (every member)</b>", PMn)])}
<p><b>What changed.</b> Before 2020 the survivor pool hid a small strength edge: leaders were ${sg(PEn.traits.all.T.rs.leaders.med - PEn.traits.all.T.rs.others.med, 1)} points stronger than the rest over the prior year (old: ${sg(PEo.traits.all.T.rs.leaders.med - PEo.traits.all.T.rs.others.med, 1)}), and the strongest tenth led ${f2(PEn.traits.all.T.rsRank.baseRateAtOrAbove[90] / PEn.baseRate)}× as often as a random member (old: ${f2(PEo.traits.all.T.rsRank.baseRateAtOrAbove[90] / PEo.baseRate)}×). It is still small. <b>What did not:</b> cloud order barely moves the odds; the RSI percentile says nothing useful; size is the trait that recurs, because a contribution is weight × return.</p>

<h2>4 · Size tranches (stats 3 §1d) — old vs new</h2>
<p>Same Geiger maths (the Hub's daily rungs and Alan's saved weights, replayed — the replay reproduces stats 3's for AAPL exactly), same percentiles, same date-block ranges. Three changes only: the names are every S&amp;P member since 2003, counted only on days they were members (${NEWQ.names} names with enough history; old: ${OLDQ.names} served names); each name-day is typed by its cap <i>that day</i>; a name that stops trading inside the 63 sessions is scored to its last close (${NEWQ.stoppedTrading} such names), not dropped.</p>
<figure class="scroll">${chart2}</figure>
${table(["size", "names · old → new", "any day: next 63 vs SPY · old", "any day · <b>new</b>", "pullback cell · old", "pullback cell · <b>new</b> (90% range)", "cell minus any day · old → new", "composite ladder slope · old → new"], tr.map((t) => { const o = qo.get(t), n = qn.get(t);
    return [t, `${o.names} → ${n.names}`, `<span class="${cls(o.x63_base.med)}">${sg(o.x63_base.med)}</span>`, `<b class="${cls(n.x63_base.med)}">${sg(n.x63_base.med)}</b>`, `<span class="${cls(o.x63.med)}">${sg(o.x63.med)}</span>`, `<b class="${cls(n.x63.med)}">${sg(n.x63.med)}</b> (${sg(n.x63.lo)} to ${sg(n.x63.hi)})`, `${sg(o.x63.med - o.x63_base.med)} → ${sg(n.x63.med - n.x63_base.med)}`, `${f2(o.ladder_rho)} → ${f2(n.ladder_rho)}`]; }))}
<p><b>What changed.</b> The any-day line of every size. Mega caps go from ${sg(qo.get(tr[0]).x63_base.med)} to ${sg(qn.get(tr[0]).x63_base.med)} points a quarter against SPY, small members from ${sg(qo.get(tr[3]).x63_base.med)} to ${sg(qn.get(tr[3]).x63_base.med)}. The stats 3 page already said the old tranches were biased both ways; this measures how much. It also moves stats 3's reading "mega caps look strong": they do not, once you only know their size at the time. <b>What did not:</b> the pullback cell against its own size's any-day is within about a point everywhere, so it is still not an edge by size; the composite ladder still slopes the wrong way (low rungs, better quarter) for mega and large caps, and is flat for small members.</p>

<h2>5 · Tranche back-test on the leaders basket (pullback playbook §4) — old vs new</h2>
<p>The playbook's own run, unchanged, with one switch (<code>--pit-leaders</code>): the basket's members are each year's 20 largest S&amp;P members by full cap on the prior year's last session, from every member that day; prices from the point-in-time bars. Without the switch the run reproduces the published numbers exactly (checked). SPY, QQQ and the Nasdaq-100 are untouched. The basket ends at ${f1(lvlN.close)} from 100 in Jan 2007 (old ${f1(lvlO.close)}): about ${f1(cagr(lvlN.close))}% a year instead of ${f1(cagr(lvlO.close))}%.</p>
<p class="small">On a phone, swipe a chart sideways to read it. Basket years that differ: ${esc(diffs.map((r) => `${r.y}: ${r.in.length ? "+" + r.in.join(" +") : ""}${r.out.length ? " −" + r.out.join(" −") : ""}`).join(" · "))}. This year's twenty (new): ${esc(newTop.join(" "))}.</p>
${table(["pullback", "way of buying", "campaigns", "entry vs buying at once (%) · old → new", "next 126 sessions (%) · old → new", "worst paper loss in 126 sessions (%) · old → new"], pbRows)}
<p>Comparisons against buying at once that pass the false-discovery check: old ${LO.survivors} of ${LO.tests}, new ${LN.survivors} of ${LN.tests}. Those that flipped:</p>
${table(["pullback", "way", "measure", "old: median difference, passes?", "new"], flips.map((k) => { const [d, s, m] = k.split("|"), a = so.get(k), b = sn.get(k); return [`${d}%`, s, m, `${sg(a?.med)} · ${a?.survives ? "yes" : "no"}`, `${sg(b?.med)} · ${b?.survives ? "<b>yes</b>" : "no"}`]; }))}
<p><b>What changed.</b> At 5% and 7% pullbacks, laddering (fan lines, state-sized) now shows up as a clear cost against buying at once, where before it was not significant. At 7–10% its small benefit to the worst paper loss no longer passes the check; at 2% it now does. <b>What did not:</b> no way of laddering beat buying at once on return at any depth; its one benefit is a slightly smaller worst paper loss on shallow pullbacks.</p>

<h2 id="studies">6 · Every study, and whether it has been re-run on this universe</h2>
<p>This universe is the default for studies from 28 Sep (N9's recommendation, adopted by the coordinator). The list below says, for every study that was published on today's names, whether it has been re-run here and what the re-run found. The re-run of 29 Sep (R4) is written up on its own page: <a href="../pit-rerun/PIT-RERUN.html">point-in-time re-run</a>.</p>
${table(["study · section", "what it read on today's names", "re-run on point-in-time?", "what the re-run found", "where"], [
    ["Leaders §1 · concentration", "top-10 share of an up year's gain (pre-2020 a floor)", "<b>re-run</b> (N9, 28 Sep)", "small correction: the floor was close (33.9% → 36.1%)", "<a href='#studies'>this page §2</a>"],
    ["Leaders §2 · chart traits", "leaders looked no different beforehand", "<b>re-run</b> (N9, 28 Sep)", "small correction: a small strength edge the survivor pool hid", "<a href='#studies'>this page §3</a>"],
    ["Leaders §2 · growth", "a growing top line lifted the chance of leading by under 2.5 points", RERUN.growth ? "<b>re-run</b> (R4, 29 Sep)" : "<b>not yet</b> — needs statements for every member (a keyed pull on Fly; script written)", RERUN.growth ? RERUN.growthText : "—", "<a href='../pit-rerun/PIT-RERUN.html#traits'>re-run page §5</a>"],
    ["Leaders §3 · rotation", "one calm name: a little less pain, a little less return; the basket halves the pain", "<b>re-run</b> (R4, 29 Sep)", "holds; small correction on the cost of moving", "<a href='../pit-rerun/PIT-RERUN.html#rot'>re-run page §4</a>"],
    ["Stats 3 §1d · size tranches", "mega caps beat SPY, small caps doomed", "<b>re-run</b> (N9, 28 Sep)", "<b>reversed</b>", "<a href='#studies'>this page §4</a>"],
    ["Stats 3 §3 · below a falling 200-day", "one in six fell another third; marks at entry; flags; tranches; leaders in the state", "<b>re-run</b> (R4, 29 Sep)", "marks hold; tail a little fatter; <b>flag-count rule reversed</b>; <b>small-cap tranche reversed</b>; persistence smaller", "<a href='../pit-rerun/PIT-RERUN.html#q3'>re-run page §1</a>"],
    ["Stats 3 §4 · leaders after lows", "leaders trail SPY for a quarter; the worst fallers' rebound explains it; sleeve rules", "<b>re-run</b> (R4, 29 Sep)", "the lag holds (clearer); <b>the fallers' year-long rebound reversed</b>; sleeve rules downgraded to leaning", "<a href='../pit-rerun/PIT-RERUN.html#q4'>re-run page §2</a>"],
    ["Stats 3 §5 · USUAL DAY history", "one-sided days say little; sigma days are not triggers; size cells", "<b>re-run</b> (R4, 29 Sep)", "triggers hold; strict one-sided days now clear the check; <b>size cells reversed</b>", "<a href='../pit-rerun/PIT-RERUN.html#q5'>re-run page §3</a>"],
    ["Pullback playbook §4 · tranches on the leaders basket", "laddering never beat buying at once", "<b>re-run</b> (N9, 28 Sep)", "same answer, a little sharper", "<a href='#studies'>this page §5</a>"],
    ["Stats 3 §1a–c, §2, §6 · Geiger widths, confluence, gold", "index-level or fund-level readings", "not needed — no single-company universe in them", "—", "—"],
    ["Statistician 2, RSI history, bottoms, regime, sector rotation", "index, fund and macro series", "not needed — no single-company universe in them", "—", "—"]])}

<h2>Where each number comes from</h2>
<dl>
<dt>Member lists</dt><dd>FMP <code>/stable/sp500-constituent</code>, <code>/stable/historical-sp500-constituent</code> (1,528 records), <code>/stable/nasdaq-constituent</code>, <code>/stable/historical-nasdaq-constituent</code> (451), pulled ${esc(man.sources.membership.match(/pulled ([^ ]+)/)?.[1] ?? "")} inside Fly on the batch machine with its own key (values printed, key never).</dd>
<dt>Market caps</dt><dd>FMP <code>/stable/historical-market-capitalization</code>, last value of each month; Massive <code>/v3/reference/tickers/{T}?date=</code> share counts × price for names FMP lacks (split-corrected with Massive's split list).</dd>
<dt>Daily prices</dt><dd>Massive day bars by ticker (split-adjusted) over each member's window ± ~15 months; Massive ticker-change events for renamed members; FMP <code>historical-price-eod/full</code> where Massive files the history under another ticker. One source per company, chosen by which covers more of its member days.</dd>
<dt>The check</dt><dd>SPY's quarterly N-PORT holdings (FMP, cached by the leaders lane). ^GSPC daily closes (FMP, cached) for the yearly tracking check.</dd>
<dt>Old numbers</dt><dd>Read from the published data files: <code>deliverables/20260928/leaders/leaders-concentration.json</code> and <code>leaders-traits.json</code>, <code>deliverables/20260928/stats-3/data/q1.json</code>, <code>deliverables/20260928/pullback-playbook/data/pullback-playbook.json</code>.</dd>
<dt>Code</dt><dd><code>research/statistics/point-in-time/</code>: <code>pit-core.mjs</code> (the membership walk), <code>build-universe.mjs</code> (stitching, coverage, manifest), <code>pit-data.mjs</code> (reader and the two guards), <code>pit-leaders.mjs</code>, <code>pit-traits.mjs</code>, <code>pit-geiger-replay.mjs</code> + <code>pit-export-daily.mjs</code> + <code>q1d_pit.py</code>, <code>pit-leaders-basket.mjs</code>, this page <code>pit-page.mjs</code>. Tests: <code>tests/point-in-time.test.mjs</code>. New numbers: <code>data/pit-*.json</code>.</dd>
</dl>

<h2>What could be wrong</h2>
<ol>
<li><b>FMP's change log is the only source for who was in.</b> It agrees with SPY's own filings from 2019 on; before 2019 nothing independent was checked. ${SP.anomalies + ND.anomalies} records do not fit and are listed above.</li>
<li><b>Before 2008 fewer member-days carry a cap</b> (75–85%), so early years lean on the companies FMP still carries. The rebuilt index still tracks the real one within about 1–1.5 points a year.</li>
<li><b>Full caps, not free float.</b> The real index weights by float; a few family-controlled giants weigh a little more here.</li>
<li><b>Price repairs are rules, not a data feed.</b> ${flags.filter((f) => f.kind === "jump-ignored").length} one-day jumps were treated as splits; a real crash on a day the caps cannot confirm would be missed (three known ones are kept by name). ${fk("cut-before-hole").length} names lose history before a long gap.</li>
<li><b>Delisted names are scored to their last trade.</b> A buy-out at a premium or a bankruptcy's last print is the end value; later payouts are not in the data.</li>
<li><b>Tranche lines are nominal dollars</b> (as stats 3 used): $200bn was rarer in 2008 than in 2025, so the mega tranche is thin early.</li>
<li><b>The Nasdaq-100 count runs 101–110</b>: its log is missing a few removals, so it is built but not used in any study here.</li>
</ol>

<h2>What was not done</h2>
<ol>
<li>The R2 copy under <code>research/point_in_time_v1/</code> is not written. The job, its research-only writer and tests are on <code>provider/point-in-time-20260928</code>; the coordinator builds the image and runs it (commands in <code>runbooks/POINT-IN-TIME.md</code>). Nothing was deployed.</li>
<li>The R2 grouped-daily mirror (5,770 day files) was not read: Massive by ticker plus FMP filled ${cov(SP)}% of member-days, and the ${none.length} members with no prices are listed above. Reading the mirror for them is a follow-up the job could add.</li>
<li>${RERUN.growth ? "Stats 3 sections 3–5, the leaders rotation study and the growth trait were re-run on 29 Sep (R4): see section 6 and the <a href='../pit-rerun/PIT-RERUN.html'>re-run page</a>." : "Stats 3 sections 3–5 and the leaders rotation study were re-run on 29 Sep (R4): see section 6 and the <a href='../pit-rerun/PIT-RERUN.html'>re-run page</a>. The growth trait is not yet re-run (it needs statements for every member, a keyed pull on Fly; the script is written)."}</li>
<li>No Hub room changed; no page other than this one and the studies index.</li>
</ol>
</body></html>`;
  fs.writeFileSync(path.join(OUT, "POINT-IN-TIME.html"), html);
  return { conc, flips: flips.length, diffs: diffs.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) console.log(JSON.stringify(build()));

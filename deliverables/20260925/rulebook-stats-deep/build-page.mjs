/* Builds RULEBOOK-STATS-DEEP.html from the two data files, so no number on the page is typed by hand.
   node deliverables/20260925/rulebook-stats-deep/build-page.mjs
   Reads research/statistics/data/levels-v3.json and data/market-discussion-20260927.json. Writes the page only. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { SPECS, GROUPS } from "./specs.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "../../..");
const L = JSON.parse(fs.readFileSync(path.join(root, "research/statistics/data/levels-v3.json"), "utf8"));
const M = JSON.parse(fs.readFileSync(path.join(root, "research/statistics/data/market-discussion-20260927.json"), "utf8"));
const S = L.symbols;
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const f = (v, d = 1) => v == null || !Number.isFinite(+v) ? "—" : (+v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const sgn = (v, d = 1, unit = "") => v == null || !Number.isFinite(+v) ? "<span>—</span>" : `<span class="${+v > 0 ? "up" : +v < 0 ? "dn" : ""}">${+v > 0 ? "+" : +v < 0 ? "−" : ""}${f(Math.abs(+v), d)}${unit}</span>`;
const pct = (v, d = 1) => v == null ? "—" : f(v, d) + "%";
const n0 = (v) => v == null ? "—" : (+v).toLocaleString("en-US");
const table = (head, rows, cls = "") => `<div class="tw"><table class="${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td data-l="${esc(String(head[i]).replace(/<[^>]+>/g, ""))}"${i === 0 ? ' class="k"' : ""}>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const FOCUS = L.focus.filter((s) => S[s]);
const cal = L.calibration;
const med = (a) => { const s = a.filter((x) => x != null && Number.isFinite(x)).sort((p, q) => p - q); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const companies = Object.keys(S).filter((s) => !S[s].fund); const funds = Object.keys(S).filter((s) => S[s].fund && s !== "BTCUSD");
const q = (a, p) => { const s = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!s.length) return null; const pos = (s.length - 1) * p, lo = Math.floor(pos), hi = Math.ceil(pos); return s[lo] + (s[hi] - s[lo]) * (pos - lo); };

/* ── numbers used in prose, computed once ── */
const P10c = companies.map((s) => S[s].lines.rsi["3y"]?.q10), P10f = funds.map((s) => S[s].lines.rsi["3y"]?.q10);
const shiftUp = companies.map((s) => S[s].range_shift.above200.q10), shiftDn = companies.map((s) => S[s].range_shift.below200.q10);
const lowRsi = companies.map((s) => S[s].pullbacks.all?.rsi?.med), lowDepth = companies.map((s) => S[s].pullbacks.all?.depth?.med);
const cf = (fam, grp, k) => cal[fam][grp][k];
const never1y = L.never30_1y; const spyE = S.SPY.oos.rsi_low.episodes_last3y;
const LP = L.leader_pullbacks.triggers, LB = L.leader_pullbacks.baseline_every_5th_session;
const b = M.breadth; const H = M.heat; const R = M.rotation;
const d200fund = cf("d200_low", "funds", "fixed"), d200comp = cf("d200_low", "companies", "fixed");
const skew = (list) => med(list.map((s) => (S[s].share.sigma_down.all ?? 0) - (S[s].share.sigma_up.all ?? 0)));

/* ── section: the mapping tables ── */
const calibRows = [];
const famName = { rsi_low: "RSI(14) low · fixed 30", rsi_high: "RSI(14) high · fixed 70", wr_low: "Williams %R low · fixed −80", wr_high: "Williams %R high · fixed −20",
  d200_low: "200-day distance low · fixed −10%", d200_high: "200-day distance high · fixed +10%", sigma_down: "daily move down · fixed −2 usual days", sigma_up: "daily move up · fixed +2 usual days" };
for (const fam of Object.keys(famName)) for (const grp of ["companies", "funds"]) {
  const c = cal[fam][grp]; const cell = (k) => c[k] ? `${pct(c[k].median_share_last3y)}<span class="sub">${pct(c[k].iqr_last3y?.[0], 1)}–${pct(c[k].iqr_last3y?.[1], 1)}</span>` : "—";
  calibRows.push([`${famName[fam]}<span class="sub">${grp} · ${c.fixed?.names ?? "—"} names</span>`, cell("fixed"), cell("p3y"), cell("pall"), cell("z3y"), cell("sig")]);
}
const focusRsiRows = FOCUS.map((s) => { const x = S[s], t = x.today, L3 = x.lines.rsi["3y"], LA = x.lines.rsi.all, o = x.oos.rsi_low.last3y, o1 = x.oos.rsi_low.last1y;
  return [s + (x.fund && s !== "BTCUSD" ? '<span class="sub">fund</span>' : s === "BTCUSD" ? '<span class="sub">7-day, FMP</span>' : ""), f(t.rsi.v), f(t.rsi.p3y, 0), f(L3?.q10), f(LA?.q10), f(L3?.zlo), f(L3?.q5), f(x.range_shift.above200.q10) + " / " + f(x.range_shift.below200.q10),
    `${o1.fixed.d} · ${o1.p3y.d}`, `${o.fixed.d} d · ${o.fixed.e} ep`, `${o.p3y.d} d · ${o.p3y.e} ep`, `${o.z3y.d} d · ${o.z3y.e} ep`, `${o.sig.d} d · ${o.sig.e} ep`]; });
const never1yFunds = never1y.rows.filter((r) => r.fund).map((r) => [r.sym, f(r.rsi_min_1y), f(r.line_today), `${r.p3y_days} days · ${r.p3y_episodes} episodes`, `${r.z_days} days`, `${r.sig_days} days`]);
const epList = (arr) => arr.map((e) => `<span class="ep">${e.date} · ${f(e.v)}${e.line != null && e.line !== 30 ? " under " + f(e.line) : ""}</span>`).join(" ");
const allRows = Object.keys(S).sort().map((s) => { const x = S[s], t = x.today, o = x.oos.rsi_low.last3y, p = x.pullbacks;
  return [s, x.fund ? "fund" : "company", f(t.rsi.v), f(t.rsi.p3y, 0), f(x.lines.rsi["3y"]?.q10), f(x.lines.rsi["3y"]?.q90), pct(x.share.rsi_low["3y"]), `${o.fixed.d} / ${o.p3y.d}`,
    f(x.range_shift.above200.q10) + " / " + f(x.range_shift.below200.q10), p.all ? f(p.all.depth?.med) + "%" : "—", p.all ? f(p.all.rsi?.med) : "—", sgn(p.current.from_high, 1, "%"), x.splice_cut ? "cut " + x.splice_cut.date : x.last_day !== L.breadth.date ? "last bar " + x.last_day : ""]; });

/* ── pullbacks ── */
const pbRows = FOCUS.map((s) => { const p = S[s].pullbacks, a = p.all; if (!a) return [s, n0(p.n), "—", "—", "—", "—", "—", "—", "—", "—"];
  const band = (o, d = 1, u = "") => o ? `${f(o.med, d)}${u}<span class="sub">${f(o.q25, d)} to ${f(o.q75, d)}</span>` : "—";
  return [s + (p.n < 10 ? '<span class="sub">few</span>' : ""), `${p.n}<span class="sub">${p.n_last3y} in 3y</span>`, band(a.depth, 1, "%"), band(a.depthUsual, 1), band(a.rsi), band(a.rsiP, 0), band(a.d200, 1, "%"), band(a.d50, 1, "%"), band(a.sessions, 0),
    `${sgn(p.current.from_high, 1, "%")}<span class="sub">${p.current.vs_usual != null ? "× " + f(p.current.vs_usual, 2) + " of usual" : ""} · high ${p.current.high_date}</span>`]; });
const trigRow = (key, lbl) => ["leader", "middle", "laggard"].map((c) => { const a = LP[`${key}|${c}`].all, d = LP[`${key}|${c}`].discover, k = LP[`${key}|${c}`].confirm;
  return [`${lbl}<span class="sub">${c}</span>`, `${n0(a.n)}<span class="sub">${a.months} months</span>`, pct(a.up60, 0), sgn(a.med60, 1, "%"), sgn(a.mae60_med, 1, "%"), f(a.ret60u_med, 2), f(a.maeu_med, 2), pct(a.regained60, 0),
    `${pct(d.up60, 0)} · ${sgn(d.med60, 1, "%")}<span class="sub">${n0(d.n)}</span>`, `${pct(k.up60, 0)} · ${sgn(k.med60, 1, "%")}<span class="sub">${n0(k.n)}</span>`]; });
const baseRows = ["leader", "middle", "laggard"].map((c) => { const a = LB[c].all, d = LB[c].discover, k = LB[c].confirm;
  return [`any session<span class="sub">${c}</span>`, n0(a.n), pct(a.up60, 0), sgn(a.med60, 1, "%"), sgn(a.mae60_med, 1, "%"), f(a.ret60u_med, 2), f(a.maeu_med, 2), "—", `${pct(d.up60, 0)} · ${sgn(d.med60, 1, "%")}`, `${pct(k.up60, 0)} · ${sgn(k.med60, 1, "%")}`]; });

/* ── S6b worked example ── */
const s6b = M.s6b; const lift = (o) => o.before_report?.n && o.ordinary_20_sessions?.n ? o.before_report.share_up - o.ordinary_20_sessions.share_up : null;
const s6bRows = []; if (s6b) {
  s6bRows.push([`every report<span class="sub">the S6 base</span>`, n0(s6b.all_reports.n), pct(s6b.all_reports.share_up), sgn(s6b.all_reports.median, 2, "%"), n0(s6b.all_ordinary.n), pct(s6b.all_ordinary.share_up), sgn(s6b.all_ordinary.median, 2, "%"), sgn(s6b.all_reports.share_up - s6b.all_ordinary.share_up, 1, " pts")]);
  for (const [g, bk] of Object.entries(s6b.buckets)) for (const [k, o] of Object.entries(bk)) if (/^(a|c) /.test(k) || g === "previous report")
    s6bRows.push([`${esc(k.replace(/^[abc] · /, ""))}<span class="sub">${esc(g)}</span>`, n0(o.before_report.n), pct(o.before_report.share_up), sgn(o.before_report.median, 2, "%"), o.ordinary_20_sessions?.n ? n0(o.ordinary_20_sessions.n) : "—",
      o.ordinary_20_sessions?.n ? pct(o.ordinary_20_sessions.share_up) : "—", o.ordinary_20_sessions?.n ? sgn(o.ordinary_20_sessions.median, 2, "%") : "—", sgn(lift(o), 1, " pts")]);
  for (const [k, o] of Object.entries(s6b.confluences)) s6bRows.push([`<b>${esc(k)}</b><span class="sub">confluence</span>`, n0(o.before_report.n), pct(o.before_report.share_up), sgn(o.before_report.median, 2, "%"),
    o.ordinary_20_sessions?.n ? n0(o.ordinary_20_sessions.n) : "—", o.ordinary_20_sessions?.n ? pct(o.ordinary_20_sessions.share_up) : "—", o.ordinary_20_sessions?.n ? sgn(o.ordinary_20_sessions.median, 2, "%") : "—", sgn(lift(o), 1, " pts")]);
}

/* ── the morning template ── */
const voterRows = H.voters.map((v) => [esc(v.name), `<span class="sub2">${esc(v.detail)}</span>`, v.value == null ? "abstains" : sgn(v.value, 2), f(v.weight, 2), v.value == null || !v.weight ? "—" : sgn(v.value * v.weight / H.weight_total, 3)]);
const cohortRows = R.cohorts.map((c) => [esc(c.id.replace(/_/g, " ").toLowerCase()) + `<span class="sub">${c.members} names</span>`, sgn(c.r5, 1, "%"), sgn(c.r20, 1, "%"), sgn(c.rel20, 1, " pts"), f(c.rel20_p3y, 0), sgn(c.rel60, 1, " pts"), f(c.rsi_p3y, 0), pct(c.above50, 0)]);
const aiRows = [R.ai_core, R.ai_complex].map((c) => [esc(c.id.replace(/_/g, " ").toLowerCase()) + `<span class="sub">${c.members} names</span>`, sgn(c.r5, 1, "%"), sgn(c.r20, 1, "%"), sgn(c.rel20, 1, " pts"), f(c.rel20_p3y, 0), sgn(c.rel60, 1, " pts"), f(c.rsi_p3y, 0), pct(c.above50, 0)]);
const leaderRows = M.leaders.map((l) => [l.sym, f(l.lead, 1), sgn(l.rel120, 0, " pts"), f(l.rsi), f(l.rsiP, 0), sgn(l.from_high, 1, "%"), l.vs_usual == null ? "—" : "× " + f(l.vs_usual, 2), esc((l.branches || []).join(", ").replace(/_/g, " ").toLowerCase())]);
const boardRows = M.board.rows.filter((r) => r.trend != null).slice(0, 12).map((r) => [r.ticker, f(r.last, 2), sgn(r.chg, 2, "%"), r.rsi == null ? "—" : f(r.rsi, 0), sgn(r.trend, 2), sgn(r.mom, 2), esc(r.read)]);
const sigmaRows = M.sigma_today.map((s) => [s.sym, sgn(s.move, 2, "%"), `${sgn(s.ratio, 2)} usual days`, pct(s.ud, 2), `${n0(s.followed.n)} days`, pct(s.followed.up, 0), sgn(s.followed.median, 2, "%")]);
const v3Rows = M.rulebook_v3.focus.map((x) => [x.sym, f(x.rsi), `${f(x.rsiP3y, 0)}<span class="sub">line ${f(x.rsiLine)} · ${f(x.rsiLineHi)}</span>`,
  `${x.stateLine != null ? f(x.stateLine) + " · " + f(x.stateLineHi) : "—"}<span class="sub">${x.state ? x.state + " its 200-day" : ""}</span>`,
  x.rsi != null && x.stateLine != null && x.rsi <= x.stateLine ? "<b>at or under its own 10th for this trend state</b>" : x.rsi != null && x.stateLineHi != null && x.rsi >= x.stateLineHi ? "<b>at or over its own 90th for this trend state</b>" : "inside its own range",
  `${sgn(x.from_high, 1, "%")}<span class="sub">usual ${x.usual_depth != null ? f(x.usual_depth, 1) + "%" : "—"}</span>`, x.vs_usual == null ? "—" : (x.vs_usual >= 1 ? "<b>× " + f(x.vs_usual, 2) + "</b>" : "× " + f(x.vs_usual, 2)),
  x.lead == null ? "—" : f(x.lead, 0), sgn(x.ratio, 2)]);
const runRows = M.earnings.runup.slice(0, 27).map((r) => [r.ticker, `${r.in_days} days${r.date ? `<span class="sub">${r.date} ${r.time && r.time !== "not stated" ? r.time : ""}</span>` : ""}`,
  r.s6 ? n0(r.s6.reports) + (r.s6.reports < 8 ? '<span class="sub">too few to read</span>' : "") : "—", r.s6 && r.s6.reports >= 8 ? pct(r.s6.runup_up, 0) : "—", r.s6 && r.s6.reports >= 8 ? sgn(r.s6.runup_med, 2, "%") : "—", r.s6 && r.s6.reports >= 8 ? `${sgn(r.s6.runup_q25, 1, "%")} to ${sgn(r.s6.runup_q75, 1, "%")}` : "—",
  r.now ? f(r.now.rsiP3y, 0) : "—", r.now ? sgn(r.now.d200, 1, "%") : "—", r.now?.lead != null ? f(r.now.lead, 0) : "—"]);
const leadersInPull = M.rulebook_v3.leaders_in_usual_pullback.sort((a, b) => b.lead - a.lead).slice(0, 18);
const lipRows = leadersInPull.map((x) => [x.sym, f(x.lead, 0), sgn(x.from_high, 1, "%"), `× ${f(x.vs_usual, 2)}<span class="sub">usual ${f(x.usual_depth, 1)}%</span>`, f(x.rsi), f(x.rsiP3y, 0), f(x.usual_rsi_low)]);
const p10names = M.rulebook_v3.at_own_p10; const at30 = M.rulebook_v3.at_fixed_30;
const utilities = new Set([...(Object.values(JSON.parse(fs.readFileSync(path.join(root, "data/taxonomy-20260924.json"), "utf8")).nodes).find((n) => n.id === "BR:AI_POWER")?.members || [])]);

/* ── the studies ── */
const specHtml = GROUPS.map((g) => `<h3 id="g-${g.key}">${esc(g.title)}</h3><p>${g.intro}</p>` + SPECS.filter((s) => s.group === g.key).map((s) => `
<section class="spec" id="${s.id}"><div class="spec-h"><span class="sid">${s.id}</span><h4>${esc(s.title)}</h4><span class="status s-${s.statusKey}">${esc(s.status)}</span></div>
<p class="sq">${s.question}</p>
<dl><dt>inputs</dt><dd>${s.inputs}</dd><dt>history</dt><dd>${s.history}</dd><dt>rule</dt><dd>${s.rule}</dd><dt>verdict</dt><dd>${s.verdict}</dd><dt>display</dt><dd>${s.display}</dd>
<dt>classical source</dt><dd>${s.source}</dd><dt>data we have · data we need</dt><dd>${s.data}</dd><dt>how we could fool ourselves</dt><dd>${s.risk}</dd>${s.measured ? `<dt>measured here</dt><dd>${s.measured}</dd>` : ""}</dl></section>`).join("")).join("");
const feeds = [["the heat and its voters", "R1 · B2 · B3 (the heat itself is the allocation tool's; its own-history percentile needs a stored daily heat)"],
  ["rotation, cohort against the market", "B1 · B4 · L1 (cohort RSI percentile)"], ["the leaders", "L3 · B1 · L2 (× usual pullback)"],
  ["today's sigma events and what usually followed", "L6 · V1 · E2 (a sigma day on a report is a report day)"], ["what rulebook v3 says today", "L1 · L4 · L2 · L3 · K1–K3 when they report"],
  ["the run-up names inside 20 sessions", "E1 (S6, S6b) · S7 entries when they land · E2"], ["the AI cycle read", "R3 (the operator state as a regime column) · B4"], ["news that moves leaders", "R4 (tagged event study)"]];

const tpl = fs.readFileSync(path.join(here, "page-template.tpl"), "utf8");
const vars = {
  BUILT: new Date().toISOString().slice(0, 16).replace("T", " ") + "Z", BARS: L.breadth.date, CAPTURED: M.captured_utc, NAMES: n0(Object.keys(S).length), COMPANIES: n0(companies.length), FUNDS: n0(funds.length),
  MISSING: L.missing.map((m) => `${m.sym} (${m.bars} bars)`).join(", "), CUTS: L.splice_cuts.map((c) => `${c.sym} on ${c.date} (${sgn(c.move_pct, 0, "%")})`).join(", "),
  FIX30_C: pct(cf("rsi_low", "companies", "fixed").median_share_last3y), FIX30_F: pct(cf("rsi_low", "funds", "fixed").median_share_last3y), P10_C: pct(cf("rsi_low", "companies", "p3y").median_share_last3y), P10_F: pct(cf("rsi_low", "funds", "p3y").median_share_last3y),
  FIX30_CF: pct(cf("rsi_low", "companies", "fixed").median_share_full), FIX30_FF: pct(cf("rsi_low", "funds", "fixed").median_share_full),
  WR80_C: pct(cf("wr_low", "companies", "fixed").median_share_last3y), WR20_C: pct(cf("wr_high", "companies", "fixed").median_share_last3y), WR20_F: pct(cf("wr_high", "funds", "fixed").median_share_last3y),
  D200_C: pct(d200comp.median_share_last3y), D200_CI: `${pct(d200comp.iqr_last3y[0])} to ${pct(d200comp.iqr_last3y[1])}`, D200_F: pct(d200fund.median_share_last3y), D200_P3: pct(cf("d200_low", "companies", "p3y").median_share_last3y), D200_P3I: `${pct(cf("d200_low", "companies", "p3y").iqr_last3y[0])} to ${pct(cf("d200_low", "companies", "p3y").iqr_last3y[1])}`,
  D200_PA: pct(cf("d200_low", "companies", "pall").median_share_last3y), D200_PAF: pct(cf("d200_low", "companies", "pall").median_share_full), D200_SIG: pct(cf("d200_low", "companies", "sig").median_share_last3y, 2), D200_SIGF: pct(cf("d200_low", "companies", "sig").median_share_full),
  SIG2_C: pct(cf("sigma_down", "companies", "fixed").median_share_last3y, 2), SIG2_F: pct(cf("sigma_down", "funds", "fixed").median_share_last3y, 2), SIG2U_C: pct(cf("sigma_up", "companies", "fixed").median_share_last3y, 2),
  SIGP_C: pct(cf("sigma_down", "companies", "p3y").median_share_last3y, 2), SKEW_F: f(skew(funds), 2), SKEW_C: f(skew(companies), 2),
  SP_DOWN: pct(L.sigma_pool.down2.up, 1), SP_DOWNM: sgn(L.sigma_pool.down2.median, 2, "%"), SP_DOWNN: n0(L.sigma_pool.down2.n), SP_ANY: pct(L.sigma_pool.any_every5th.up, 1), SP_ANYM: sgn(L.sigma_pool.any_every5th.median, 2, "%"), SP_UP: pct(L.sigma_pool.up2.up, 1), SP_UPM: sgn(L.sigma_pool.up2.median, 2, "%"),
  P10LINE_C: `${f(q(P10c, 0.1))} to ${f(q(P10c, 0.9))}`, P10LINE_CM: f(q(P10c, 0.5)), P10LINE_F: `${f(q(P10f, 0))} to ${f(q(P10f, 1))}`, P10LINE_FM: f(q(P10f, 0.5)),
  SHIFT_UP: f(q(shiftUp, 0.5)), SHIFT_DN: f(q(shiftDn, 0.5)), LOWRSI: `${f(q(lowRsi, 0.1))} to ${f(q(lowRsi, 0.9))}`, LOWRSI_M: f(q(lowRsi, 0.5)), LOWDEPTH: `about ${f(Math.abs(q(lowDepth, 0.9)), 0)}% to ${f(Math.abs(q(lowDepth, 0.1)), 0)}%`, LOWDEPTH_M: f(q(lowDepth, 0.5)),
  RSIWR: f(L.rsi_wr.companies_median, 2), RSIWR_I: `${f(L.rsi_wr.companies_iqr[0], 3)} to ${f(L.rsi_wr.companies_iqr[1], 3)}`, RSIWR_MIN: f(L.rsi_wr.min, 2),
  NEVER1Y: n0(never1y.count), NEVER1Y_F: n0(never1y.funds), NEVER1Y_C: n0(never1y.companies), NEVER3Y: n0(L.never30.count), NEVER3Y_LIST: L.never30.rows.map((r) => r.sym).join(", "),
  SPY_FIX: epList(spyE.fixed), SPY_P10: epList(spyE.p3y), SPY_FIXN: spyE.fixed.length, SPY_P10N: spyE.p3y.length,
  CALIB_TABLE: table(["family · group", "fixed line", "own P · 3y", "own P · all", "Z · 3y", "σ form"], calibRows, "calib"),
  FOCUS_RSI: table(["name", "RSI today", "own pct 3y", "own P10 · 3y", "own P10 · all", "Z line · 3y", "own P5 · 3y", "P10 above / below 200-day", "last year: 30 · P10 days", "last 3y: fixed 30", "own P10 · 3y", "Z ≤ −1.28", "σ form"], focusRsiRows, "wide"),
  NEVER1Y_TABLE: table(["fund", "lowest RSI in the year", "own P10 line today", "own P10 fired instead", "Z fired", "σ fired"], never1yFunds),
  ALL_TABLE: table(["name", "kind", "RSI", "own pct 3y", "own P10", "own P90", "days ≤ 30 · 3y", "last 3y fired: 30 / P10", "P10 above / below 200-day", "usual pullback", "RSI at usual low", "now from high", "note"], allRows, "wide all"),
  PB_TABLE: table(["name", "pullbacks", "usual depth", "depth in usual days", "RSI at the low", "RSI own pct at the low", "200-day distance at the low", "50-day distance at the low", "sessions high to low", "now"], pbRows, "wide"),
  TRIG_TABLE: table(["trigger · class", "count", "higher 60 later", "median 60 later", "median deepest close inside 60", "median 60 later ÷ (usual day·√60)", "deepest ÷ (usual day·√60)", "high regained within 60", "2003–2016", "2017–2026"],
    [...trigRow("own", "its own usual depth"), ...trigRow(5, "5% below the high"), ...trigRow(10, "10% below"), ...trigRow(20, "20% below"), ...trigRow(30, "30% below"), ...baseRows], "wide"),
  OWN_L: LP["own|leader"].all, OWN_G: LP["own|laggard"].all, L5: LP["5|leader"].all, G30: LP["30|laggard"].all, BL: LB.leader.all, BG: LB.laggard.all,
  S6B_TABLE: table(["condition at the start of the 20 sessions", "reports", "higher into the report", "median", "ordinary stretches, same condition", "higher", "median", "report minus ordinary"], s6bRows, "wide"),
  VOTERS: table(["voter", "what it reads", "value", "weight", "share of the heat"], voterRows), HEAT_SENT: esc(H.sentence), HEAT_V: sgn(H.value, 2), HEAT_R: f(H.recomputed, 3), VOTERS_N: H.voters.length, VOTERS_ABST: H.voters.filter((v) => v.value == null || !v.weight).length,
  STALE: H.sources.filter((s) => /STALE|FALLBACK/.test(s.state)).map((s) => `${esc(s.table)} (${esc(s.state)})`).join(", "),
  BR200: pct(b.above200), BR50: pct(b.above50), BR200P: f(b.above200_p3y, 0), BR50P: f(b.above50_p3y, 0), BR200PA: f(b.above200_pall, 0), BR50PA: f(b.above50_pall, 0), BRN: b.names, BR200_5: pct(b.above200_5d_ago), BR50_5: pct(b.above50_5d_ago), BRFIRST: b.first_date,
  SPY20: sgn(R.spy.r20, 1, "%"), SPY5: sgn(R.spy.r5, 1, "%"), SPY60: sgn(R.spy.r60, 1, "%"),
  COHORTS: table(["cohort", "5 sessions", "20 sessions", "20 against SPY", "own pct of that, 3y", "60 against SPY", "cohort RSI own pct", "members over 50-day"], cohortRows, "wide"),
  AI_TABLE: table(["group", "5 sessions", "20 sessions", "20 against SPY", "own pct, 3y", "60 against SPY", "RSI own pct", "over 50-day"], aiRows),
  AI_LEAD: R.ai_complex.leaders_top_third, AI_N: R.ai_complex.names, AI_MEDRSI: f(R.ai_complex.median_rsi_p3y, 0), AI_P10: R.ai_complex.at_or_below_own_p10.filter((s) => utilities.has(s)).length, AI_P10ALL: R.ai_complex.at_or_below_own_p10.length, AI_P90: R.ai_complex.at_or_above_own_p90.join(", ") || "none",
  LEADERS: table(["name", "leader rank", "120 sessions against SPY", "RSI", "own pct 3y", "from its high", "× usual pullback", "cohort"], leaderRows, "wide"),
  BOARD: table(["board · " + esc(M.board.scope), "last", "Friday", "RSI", "trend", "momentum", "read"], boardRows), BOARD_LINE: esc(M.board.count_line),
  SIGMA: sigmaRows.length ? table(["name", "Friday's move", "in its usual days", "its usual day", "its own ≥ 2 usual-day days since start", "higher 5 sessions later", "median 5 later"], sigmaRows) : "<p>No name moved two usual days on Friday.</p>",
  V3: table(["name", "RSI", "own pct 3y (plain)", "v3 line: own 10th · 90th in this trend state", "rulebook v3 reading", "from its high", "× its usual pullback", "leader rank", "Friday in usual days"], v3Rows, "wide"),
  P10N: p10names.length, P10_UTIL: p10names.filter((s) => utilities.has(s)).length, P10_BONDS: p10names.filter((s) => ["TLT", "IEF", "SHY", "LQD", "HYG"].includes(s)).join(", "), AT30N: at30.length, AT90N: M.rulebook_v3.at_own_p90.length, AT90: M.rulebook_v3.at_own_p90.join(", "),
  P10_LIST: p10names.join(", "), LIP: table(["leader", "rank", "from its high", "× its usual pullback", "RSI", "own pct", "RSI at its usual low"], lipRows), LIPN: M.rulebook_v3.leaders_in_usual_pullback.length, DEEP2: M.rulebook_v3.deep_pullbacks_2x,
  RUNUP: table(["name", "reports in", "past reports measured", "higher into the report", "median run-up", "middle half", "RSI own pct now", "200-day now", "leader rank now"], runRows, "wide"),
  S6POOL_UP: pct(M.earnings.s6_pooled?.share_positive), S6POOL_M: sgn(M.earnings.s6_pooled?.median, 2, "%"), S6POOL_N: n0(M.earnings.s6_pooled?.n),
  FEEDS: table(["template line", "fed by"], feeds.map(([a, c]) => [a, c])),
  SPECS: specHtml, SPECN: SPECS.length, TRIGN: n0(L.leader_pullbacks.trigger_count),
  MU: S.MU, MUS6: L.s6?.names?.MU, BTC_P10: f(S.BTCUSD.lines.rsi["3y"].q10), SPY_P10L: f(S.SPY.lines.rsi["3y"].q10), DIA_P10L: f(S.DIA.lines.rsi["3y"].q10),
};
let html = tpl.replace(/\{\{([A-Z0-9_]+)(?:\.([a-zA-Z0-9_.]+))?\}\}/g, (m, k, sub) => {
  let v = vars[k]; if (sub) for (const p of sub.split(".")) v = v?.[p];
  if (v == null) throw new Error("template variable missing: " + m);
  return typeof v === "number" ? f(v, Number.isInteger(v) ? 0 : 1) : String(v);
});
fs.writeFileSync(path.join(here, "RULEBOOK-STATS-DEEP.html"), html);
console.log("wrote RULEBOOK-STATS-DEEP.html", html.length, "bytes;", SPECS.length, "study specs");

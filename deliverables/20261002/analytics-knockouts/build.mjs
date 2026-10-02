/* Scintilla · A1 analytics knockouts (2 Oct) · the pipe's data, read once on today's real sources and written beside this
   file as data-<today>.json. The page reads that file; nothing here is wired into the Hub.
     node deliverables/20261002/analytics-knockouts/build.mjs [sessions=500] [groups=4]
   Sources (named in the file): the chart API (/universe, /v1/scout-geiger?reading=seven for the seven-rung Geiger,
   /geiger for the Hub's own reading on the 590, /candles tf=D for the own-history replay and the rotation); the Hub's
   tables with the page's public key (company_profile, ticker_industry, fmp_peers, peer_sources, fundamentals,
   analyst_estimates, *_history, filer_currency, fx_rates); the tree's fund nodes; the comps mechanic (C4) for the set
   and the comps template (C3) for the ways. Reads only. */
import { readFileSync, writeFileSync } from "node:fs"; import { fileURLToPath } from "node:url"; import path from "node:path";
import { inputs, buildSet, snapshotFromCohort } from "../../20261001/comps-mechanic/read.mjs";
import { readCohort, TABLE } from "../../20261001/comps-template/cohort.mjs";
import { conclusion } from "../../20261001/comps-template/template.mjs";
import { rungReading } from "../../20260927/geiger-review/geiger-replay.mjs";
import { stretchPercentile, aggregate, logReturn, rank, outliers, num } from "./stats.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../..");
const SB = "https://wadinxqplrggagkvrdag.supabase.co", API = "https://scintilla-massive-chart-api.fly.dev", HUB = "https://scintillahub.ai";
const TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const SESSIONS = +(process.argv[2] || 500), NGROUPS = +(process.argv[3] || 4), MIN_SERVED = 5, H_SHORT = 16, H_MEDIUM = 72;
const KEY = (readFileSync(path.join(ROOT, "index.html"), "utf8").match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_.\-]+/) || [])[0];
if (!KEY) throw new Error("the page's public key was not found in index.html");
const pg = async (p) => { const r = await fetch(SB + "/rest/v1/" + p, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } }); if (!r.ok) throw new Error(p.split("?")[0] + " → " + r.status); return r.json(); };
const fetchJson = async (u) => JSON.parse(readFileSync(path.join(ROOT, u), "utf8"));
const api = async (p) => { const r = await fetch(API + p, { headers: { Origin: HUB } }); if (!r.ok) throw new Error(p.split("?")[0] + " → " + r.status); return r.json(); };
const quotes = async (T) => api(`/quotes?symbols=${encodeURIComponent(T.join(","))}`);
const pool = async (items, n, fn) => { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k], k); } catch (e) { out[k] = { error: String(e.message || e) }; } } })); return out; };
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a);
const r3 = (v) => v == null ? null : Math.round(v * 1000) / 1000, r1 = (v) => v == null ? null : Math.round(v * 10) / 10;

/* ---- 1 · the universe, the tables, the tree ------------------------------------------------------------- */
const inp = await inputs({ pg, fetchJson });
const uni = await api("/universe");
const served = uni.symbols.filter((t) => inp.profiles[t] && !inp.profiles[t].is_etf);
log(`served companies ${served.length} of ${uni.count} · tables ${JSON.stringify(inp.tables)} · industry table ${inp.industry_table} · funds ${inp.funds.length}`);

/* ---- 2 · the Geiger today: seven rungs off the Hub for everything, the Hub's own for the 590 ---------------- */
const scout = await api("/v1/scout-geiger?reading=seven");
const cols = scout.row_columns, ci = Object.fromEntries(cols.map((c, i) => [c, i]));
const seven = {}; for (const r of scout.rows) seven[r[ci.ticker]] = { composite: r[ci.composite], trend: r[ci.trend], momentum: r[ci.momentum], rungs: r[ci.rungs_count], session: r[ci.last_session] };
const hub = {}; for (let i = 0; i < uni.symbols.length; i += 100) { const chunk = uni.symbols.slice(i, i + 100); const g = await api(`/geiger?symbols=${chunk.join(",")}`); for (const [t, v] of Object.entries(g.symbols || {})) hub[t] = { composite: v.composite, rungs: v.tf_contributors }; }
log(`seven-rung rows ${Object.keys(seven).length} (as of ${scout.as_of}, run ${scout.run_id}) · Hub readings ${Object.keys(hub).length}`);

/* ---- 3 · daily bars: the own-history replay (daily rung, the Hub's maths) and the rotation ------------------ */
const WINDOW = 230, LIMIT = SESSIONS + WINDOW + 30;
const bars = {};
const got = await pool(["SPY", ...served], 8, async (t) => { const j = await api(`/candles?symbol=${encodeURIComponent(t)}&tf=D&limit=${LIMIT}`); const s = Array.isArray(j.series) ? j.series : []; bars[t] = s.map((b) => ({ d: new Date(b.t).toLocaleDateString("en-CA", { timeZone: "America/New_York" }), c: +b.c, h: +b.h, l: +b.l })); return s.length; });
const barErrors = got.map((g, i) => g && g.error ? ["SPY", ...served][i] + ": " + g.error : null).filter(Boolean);
log(`bars read for ${Object.keys(bars).length} symbols · errors ${barErrors.length}`);
const DATES = bars.SPY.map((b) => b.d).slice(-SESSIONS), LAST = DATES[DATES.length - 1];
const replay = {};   // ticker → composite per session (null where no bar or too short)
for (const [t, b] of Object.entries(bars)) {
  const idx = new Map(b.map((x, i) => [x.d, i])); const s = new Array(DATES.length).fill(null); let n = 0;
  for (let k = 0; k < DATES.length; k++) { const i = idx.get(DATES[k]); if (i == null || i + 1 < WINDOW) continue; const r = rungReading(b.slice(i + 1 - WINDOW, i + 1)); if (r && r.composite != null) { s[k] = r.composite; n++; } }
  replay[t] = { s, n };
}
log(`daily-rung replay: ${DATES.length} sessions ${DATES[0]} → ${LAST}`);
const closes = (t) => (bars[t] || []).filter((b) => b.d <= LAST).map((b) => b.c);
const spyS = logReturn(closes("SPY"), H_SHORT), spyM = logReturn(closes("SPY"), H_MEDIUM);

/* ---- 4 · the nodes: sectors and industry groups, each with its Geiger, stretch and rotation ------------------ */
function nodeOf(id, label, members, kind) {
  const have7 = members.filter((t) => seven[t]), g7 = aggregate(members.map((t) => seven[t] && seven[t].composite));
  const gh = aggregate(members.map((t) => hub[t] && hub[t].composite));
  const series = DATES.map((_, k) => aggregate(members.map((t) => replay[t] && replay[t].s[k])));
  const hist = series.map((a) => a.n >= Math.max(1, Math.ceil(members.length * 0.5)) ? a.value : null);
  const today = hist[hist.length - 1], history = hist.slice(0, -1);
  const stretch = stretchPercentile(history, today);
  const rsS = aggregate(members.map((t) => { const r = logReturn(closes(t), H_SHORT); return r == null || spyS == null ? null : (r - spyS) * 100; }));
  const rsM = aggregate(members.map((t) => { const r = logReturn(closes(t), H_MEDIUM); return r == null || spyM == null ? null : (r - spyM) * 100; }));
  return { id, label, kind, served: members.length, members, geiger: r3(g7.value), geiger_n: g7.n, geiger_hub: r3(gh.value), geiger_hub_n: gh.n, lt7: have7.filter((t) => seven[t].rungs < 7).length,
    daily_today: r3(today), stretch: r1(stretch), history_n: history.filter((x) => x != null).length, history_min: r3(Math.min(...history.filter((x) => x != null))), history_max: r3(Math.max(...history.filter((x) => x != null))),
    rs_short: r1(rsS.value), rs_medium: r1(rsM.value), thin: members.length < MIN_SERVED, sparkline: hist.filter((_, k) => k % 5 === 0).map(r3) };
}
const bySector = {}, byIndustry = {};
for (const t of served) { const p = inp.profiles[t]; (bySector[p.sector || "unknown"] ||= []).push(t); (byIndustry[p.industry || "unknown"] ||= []).push(t); }
const sectors = Object.entries(bySector).map(([s, m]) => nodeOf("S:" + s, s, m, "sector"));
const industries = Object.entries(byIndustry).map(([s, m]) => nodeOf("I:" + s, s, m, "industry"));
for (const t of industries) t.sector = inp.profiles[t.members[0]].sector || "unknown";
for (const list of [sectors, industries]) {
  const rM = rank(list, "rs_medium", -1), rS = rank(list, "rs_short", -1), rG = rank(list, "geiger", -1);
  list.forEach((n, i) => { n.rank_rotation = rM[i]; n.rank_rotation_short = rS[i]; n.rank_geiger = rG[i]; });
}
/* the heat's order: the Geiger now, ties by rotation; "most oversold" = the lowest stretch */
const heatOrder = (list) => list.filter((n) => n.geiger != null).slice().sort((a, b) => b.geiger - a.geiger || (a.rank_rotation ?? 99) - (b.rank_rotation ?? 99));
const qualifying = industries.filter((n) => !n.thin && n.geiger != null && n.stretch != null);
const leaders = heatOrder(qualifying).slice(0, NGROUPS - 1);
const oversold = qualifying.filter((n) => !leaders.includes(n)).slice().sort((a, b) => a.stretch - b.stretch || a.geiger - b.geiger)[0];
const fieldGroups = [...leaders.map((n) => ({ ...n, role: "lead" })), ...(oversold ? [{ ...oversold, role: "balance" }] : [])];
const thinAbove = heatOrder(industries.filter((n) => n.thin)).filter((n) => leaders.length && n.geiger > leaders[leaders.length - 1].geiger).map((n) => ({ label: n.label, served: n.served, geiger: n.geiger }));
log(`field groups: ${fieldGroups.map((g) => g.label + " (" + g.role + ", " + g.served + ")").join(" · ")}`);

/* ---- 5 · the field for each group: the comp set by the rule, the three ways, the 16 measures ------------------ */
const fxStandin = JSON.parse(readFileSync(path.join(ROOT, "deliverables/20261001/comps-template/fx-standin-ecb-2026-10-01.json"), "utf8"));
const fields = [];
for (const g of fieldGroups) {
  const sets = {}; for (const t of g.members) { try { sets[t] = buildSet(t, inp); } catch (e) { sets[t] = { error: String(e.message || e), kept: [] }; } }
  const union = [...new Set(g.members.concat(...g.members.map((t) => sets[t].kept.map((r) => r.ticker))))];
  let ctx = null, subjectErr = [];
  for (const t of g.members) { try { ctx = await readCohort({ ticker: t, today: TODAY, pg, quotes, fxStandin, membersAsked: union, labelAsked: g.label }); break; } catch (e) { subjectErr.push(t + ": " + String(e.message || e)); } }
  if (!ctx) { fields.push({ ...g, error: "no member could anchor the read: " + subjectErr.join(" · "), rows: [] }); continue; }
  const rows = [];
  for (const t of g.members) {
    const set = sets[t], kept = (set.kept || []).map((r) => r.ticker), members = [t, ...kept];
    const ctxT = { ...ctx, ticker: t, members, inputs: ctx.inputs.filter((i) => members.includes(i.ticker)), excluded: ctx.excluded.filter((e) => members.includes(e.ticker)) };
    let row = { ticker: t, name: ctx.names[t] || t, set_n: kept.length, set: kept, set_counts: set.counts || null, set_error: set.error || null, price: null, price_date: null, mcap: inp.profiles[t].market_cap || null, geiger: seven[t] ? r3(seven[t].composite) : null, rungs: seven[t] ? seven[t].rungs : null, geiger_hub: hub[t] ? r3(hub[t].composite) : null,
      stretch: replay[t] && replay[t].n ? r1(stretchPercentile(replay[t].s.slice(0, -1), replay[t].s[replay[t].s.length - 1])) : null, history_n: replay[t] ? replay[t].n : 0, up: { A: null, B: null, C: null }, centre: { A: null, B: null, C: null }, spread: null, measures: {}, dates: null, fx: null, why: null };
    if (kept.length < 2) { row.why = `only ${kept.length} comparable${kept.length === 1 ? "" : "s"} on the rule: the ways cannot be computed`; rows.push(row); continue; }
    try {
      const snap = snapshotFromCohort(ctxT, t), C = conclusion(snap, [], "B");
      row.price = snap.price; row.price_date = snap.price_date; row.price_from = snap.price_from; row.mcap = snap.mcap || row.mcap; row.dates = snap.dates; row.fx = snap.fx && snap.fx.currency && snap.fx.currency !== "USD" ? snap.fx.currency + (snap.fx.converted ? " → USD" : " not converted") : null;
      for (const [k, w] of [["A", "A"], ["B", "B"], ["C", "CW"]]) { const x = C.ways.find((v) => v.way === w); if (x && x.ok) { row.up[k] = r1(x.upside.mid.pct); row.centre[k] = Math.round(x.mid * 100) / 100; } else row.why = (row.why ? row.why + "; " : "") + `way ${k}: ${x ? x.reason : "not computed"}`; }
      const ups = Object.values(row.centre).filter((v) => v != null);
      row.spread = ups.length >= 2 && row.price > 0 ? r1(((Math.max(...ups) - Math.min(...ups)) / row.price) * 100) : null;
      row.rows_priced = snap.rows.filter((r) => r.ok).length;
      for (const m of TABLE) row.measures[m.key] = snap.table.company[m.key] == null ? null : Math.round(snap.table.company[m.key] * 100) / 100;
    } catch (e) { row.why = String(e.message || e); }
    rows.push(row);
  }
  const flat = rows.map((r) => ({ ticker: r.ticker, up_a: r.up.A, up_b: r.up.B, up_c: r.up.C, ...r.measures }));
  const outl = ["up_a", "up_b", "up_c", "rev_g_fy", "eps_g_fy", "om", "fcfm", "nd_ebitda"].flatMap((k) => outliers(flat, k));
  fields.push({ ...g, rows, outliers: outl, union_n: union.length, fx_tables: ctx.fx_tables, quotes_error: ctx.quotes_error || null });
  log(`field ${g.label}: ${rows.length} names, ${rows.filter((r) => r.up.B != null).length} with way B, union ${union.length}`);
}

/* ---- 6 · write ------------------------------------------------------------------------------------------ */
const out = {
  what: "A1 analytics knockouts · the pipe's inputs on today's real data: heat (sectors and industry groups), the field for the chosen groups, the names with the three ways and the 16 measures. The bracket, the swipe and the allocation read run in the page from this file.",
  today: TODAY, taken: new Date().toISOString(), last_session: LAST, sessions: DATES.length, history_from: DATES[0],
  sources: {
    geiger_seven: { what: "the seven-rung Geiger computed off the Hub (3h 4h 6h 12h D 3D W, the Hub's equalizer)", url: API + "/v1/scout-geiger?reading=seven", as_of: scout.as_of, run_id: scout.run_id, computed_utc: scout.computed_utc, rows: scout.rows.length, equalizer_sha: scout.equalizer && scout.equalizer.receipt_sha256 },
    geiger_hub: { what: "the Hub's own Geiger for the 590 served symbols", url: API + "/geiger?symbols=…", rows: Object.keys(hub).length },
    replay: { what: "the daily rung replayed on finished daily bars (the Hub's maths, deliverables/20260927/geiger-review/geiger-replay.mjs, 230-bar window), one reading per SPY session; a group's series is the equal-weight mean of its members' readings on sessions where at least half of them have one; the stretch is today's reading's percentile in that series' own past", url: API + "/candles?symbol=…&tf=D", sessions: DATES.length, from: DATES[0], to: LAST, bar_errors: barErrors },
    rotation: { what: `relative strength: the equal-weight mean of the members' ${H_MEDIUM}-session (medium, one swing cycle per the 28 Sep sector-rotation study) and ${H_SHORT}-session (short, one leg) log returns minus SPY's, in percentage points; rank 1 = strongest`, h_short: H_SHORT, h_medium: H_MEDIUM, spy_short: r1(spyS * 100), spy_medium: r1(spyM * 100) },
    universe: { what: "the served symbols", url: API + "/universe", count: uni.count, companies: served.length, universe_sha256: uni.universe_sha256 },
    tables: { what: "the Hub's tables, read with the page's public key", list: ["company_profile", "ticker_industry", "fmp_peers", "peer_sources", "fundamentals", "analyst_estimates", "fundamentals_history", "cashflow_history", "balance_history", "filer_currency", "fx_rates"], present: inp.tables, industry_table: inp.industry_table, funds_from_tree: inp.funds.length },
    comps: { what: "the comparable set by the universe standard's rule (deliverables/20261001/comps-mechanic/peers.mjs: same industry → market value within ×10 → nearest 10, industry first then size); the ways from the comps template (deliverables/20261001/comps-template/template.mjs): A the range of the medians, B the middle-half band, C the reliability-weighted blend; the 16 measures from the same read" },
    groups: { what: "a GROUP is an FMP industry on the served names (ticker_industry.fmp_industry, else company_profile.industry); a SECTOR is the FMP sector", min_served_for_the_field: MIN_SERVED, chosen: `the ${NGROUPS - 1} groups the heat ranks highest (the seven-rung Geiger now, ties by rotation rank) among groups with at least ${MIN_SERVED} served names, plus the one it ranks most oversold (the lowest stretch against its own history)` },
  },
  sectors: sectors.sort((a, b) => (b.geiger ?? -9) - (a.geiger ?? -9)), industries: industries.sort((a, b) => (b.geiger ?? -9) - (a.geiger ?? -9)),
  field_groups: fieldGroups.map((g) => ({ id: g.id, label: g.label, role: g.role, sector: g.sector, served: g.served })), thin_above: thinAbove,
  fields,
  names: Object.fromEntries(served.map((t) => [t, { sector: inp.profiles[t].sector || null, industry: inp.profiles[t].industry || null, geiger: seven[t] ? r3(seven[t].composite) : null, rungs: seven[t] ? seven[t].rungs : null, stretch: replay[t] && replay[t].n ? r1(stretchPercentile(replay[t].s.slice(0, -1), replay[t].s[replay[t].s.length - 1])) : null }])),
};
const file = path.join(HERE, `data-${TODAY}.json`);
writeFileSync(file, JSON.stringify(out));
log(`wrote ${file} · sectors ${sectors.length} · industries ${industries.length} · fields ${fields.length}`);
console.log(JSON.stringify({ today: TODAY, last_session: LAST, sectors: sectors.slice(0, 5).map((s) => [s.label, s.geiger, s.stretch, s.rank_rotation]), groups: fieldGroups.map((g) => [g.label, g.role, g.served, g.geiger, g.stretch, g.rank_rotation]), thin_above: thinAbove.length, bar_errors: barErrors.length }, null, 1));

/* KO1 · THE FIXED COMPS, RUN OVER EVERY COMPANY WE HOLD FIGURES FOR.
   The comps system exactly as the comps fix left it (business lines → the kept set complemented → price-only outliers →
   the price from the whole field), with every one of its switches ON: memory and storage priced on each other, the
   data-centre landlords on each other, the growth credit, the tighter outlier rule, no sales multiples across margins
   more than twice apart, the company-itself test. Nothing in that code is changed here; this file only calls it.

   WHERE THE FIGURES COME FROM: one snapshot of the Hub's public tables (tools/snapshot.py, read once for the whole
   universe) answered locally by local-pg.mjs, and the settled 6 Oct closes captured from the chart API. So every company
   is priced on the same close and the same figures, and the run needs no network and no key.

   WHAT IS RECORDED PER COMPANY: the range (low · centre · high) and the upside to the centre; how many peers the centre
   is actually built from; THIN when that is fewer than four; FRAGILE when taking one peer out moves the centre more than
   10%; "no peer set" when the company itself is priced far from its group; the reading with every switch off beside it.
   A company that cannot be priced is kept with its reason — nothing is dropped silently.

   Run from the scratch folder (snap/*.json, quotes-all-raw.json):   node <this file> [TICKER …] */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { localPg } from "./local-pg.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), WT = path.resolve(HERE, "../../../..");
const { inputs: c4inputs, readSet, snapshotFromCohort } = await import(WT + "/deliverables/20261001/comps-mechanic/read.mjs");
const { buildSet, lineWords, CP1_LINES_OFF, CP1_LINES_ON, SIM_MIN, SAME_MIN, DUAL } = await import(WT + "/deliverables/20261003/comps-c5/lines.mjs");
const { conclusion6, CP1_ALL, CP1_NONE, CP3_ALL, CUT, CUT2, INFLUENCE } = await import(WT + "/deliverables/20261005/comps-c6/outliers.mjs");
const { CP3_LINES_ON } = await import(WT + "/deliverables/20261003/comps-c5/lines.mjs");
/* CP3 (7 Oct) · two things this run can now be asked for, each by an environment word, so the same file reproduces the
   knockout as it was published and re-runs it on the one forward basis:
     KO1_FORWARD=fiscal-year   the comps reader before CP3 (the nearest fiscal year's estimate). Unset = the dashboard's
                               forward basis, the next four quarters (lib/forward-basis.mjs), which is now the reader's default.
     KO1_FX=cp3                CP1's switches plus the stated same-business sets and the price from the same-business
                               peers on every line (outliers.mjs CP3_ALL). Unset = CP1's switches, as the knockout ran. */
const FORWARD = process.env.KO1_FORWARD || null, CP3 = process.env.KO1_FX === "cp3", LINES_ON = CP3 ? CP3_LINES_ON : CP1_LINES_ON, FX_ON = CP3 ? CP3_ALL : CP1_ALL;
const { isValuation, GROWTH_CREDIT_MAX, MARGIN_GATE } = await import(WT + "/deliverables/20261003/comps-c5/field.mjs");
const { referenceOf, withReference, withReferenceQuotes } = await import(WT + "/deliverables/20261003/comps-c5/reference.mjs");
export const THIN_BELOW = 4;                                   // fewer than four peers with figures behind the centre = THIN
const TODAY = process.env.KO1_TODAY || "2026-10-06", SNAP = process.env.KO1_SNAP || "snap";
const T0 = Date.now(), load = (n) => JSON.parse(readFileSync(path.join(SNAP, n + ".json"), "utf8"));
const TABLES = Object.fromEntries(["company_profile", "ticker_industry", "tickers", "ticker_cohorts", "fmp_peers", "peer_sources", "fundamentals", "analyst_estimates", "fundamentals_history", "cashflow_history", "balance_history", "composite_staged", "filer_currency", "fx_rates", "earnings_events"].map((n) => [n, load(n)]));   /* CP3: earnings_events carries the supplier's dollar estimates (the paired rate for a foreign reporter) */
const META = JSON.parse(readFileSync(path.join(SNAP, "_meta.json"), "utf8"));
const floorOf = (n, col) => { const m = /(?:^|&)(\w+)=gte\.([0-9-]+)/.exec((META[n] || {}).path || ""); return m && m[1] === col ? m[2] : null; };
const FLOORS = Object.fromEntries(["fundamentals_history", "cashflow_history", "balance_history", "analyst_estimates"].map((n) => [n, { fiscal_date: floorOf(n, "fiscal_date") }]).concat([["fx_rates", { date: floorOf("fx_rates", "date") }]]));
const COUNT = {}, pgRaw = localPg(TABLES, { floors: FLOORS, counter: COUNT }), CACHE = new Map();
const pg = async (p) => { if (!CACHE.has(p)) CACHE.set(p, pgRaw(p)); return CACHE.get(p); };
const fetchJson = async (u) => JSON.parse(readFileSync(path.join(WT, u), "utf8"));
/* THE PRICE: the session's own completed close, captured once for the whole universe */
const RAW = JSON.parse(readFileSync("quotes-all-raw.json", "utf8"));
/* a peer is priced as the comps fix priced it: its last completed session's close, else its last trade */
const settle = (q) => (q && q.today_session_close_state === "COMPLETED" && q.today_session_close > 0 ? { price: q.today_session_close, price_observation_utc: q.today_session_et + "T20:00:00Z", price_is: "session close " + q.today_session_et } : q && q.price > 0 ? { price: q.price, price_observation_utc: q.price_observation_utc, price_is: "latest trade" } : null);
/* a company is RUN only when that close is the session the study is dated on */
const closedToday = (q) => !!(q && q.today_session_close_state === "COMPLETED" && q.today_session_close > 0 && q.today_session_et === TODAY);
const quotes = async (T) => ({ quotes: Object.fromEntries(T.map((t) => [t, settle(RAW.quotes[t])]).filter(([, q]) => q)) });
const refDir = WT + "/deliverables/20261003/comps-c5", refFile = readdirSync(refDir).filter((f) => /^reference-peers-facts-.*\.json$/.test(f)).sort().pop() || null;
const FACTS = refFile ? JSON.parse(readFileSync(path.join(refDir, refFile), "utf8")) : null, REF = referenceOf(FACTS);
/* CP3: when the dated facts file is on hand, the comps-only reference peers (SK hynix, Samsung, Kioxia) are answered from it,
   exactly as the feed-fix re-run does — the knockout as first run had no facts file, so they were named and never priced */
const pgRef = FACTS ? withReference(pg, FACTS) : pg, quotesRef = FACTS ? withReferenceQuotes(quotes, FACTS) : quotes;
const fxStandin = JSON.parse(readFileSync(WT + "/deliverables/20261001/comps-template/fx-standin-ecb-2026-10-01.json", "utf8"));
fxStandin.reported = JSON.parse(readFileSync(WT + "/deliverables/20261003/comps-c5b/reporting-currency-fmp-2026-10-03.json", "utf8")).reported;
if (FACTS && FACTS.fx) { fxStandin.rates = { ...(fxStandin.rates || {}) }; for (const [c, rows] of Object.entries(FACTS.fx)) if (rows && rows.length && !(fxStandin.rates[c] && fxStandin.rates[c].length)) fxStandin.rates[c] = rows; for (const [t, c] of Object.entries(REF.peers)) fxStandin.reported[t] = c.currency; }
const inp = await c4inputs({ pg, fetchJson });
inp.segments = JSON.parse(readFileSync(WT + "/deliverables/20261003/comps-c5/segments-2026-10-03.json", "utf8")).companies;
inp.reference = REF.peers;
{ const tree = JSON.parse(readFileSync(WT + "/deliverables/20260929/tree-map/tree.json", "utf8")), nodes = Array.isArray(tree.nodes) ? tree.nodes : Object.values(tree.nodes);
  const top = Object.fromEntries(nodes.filter((n) => n.kind === "fund" && n.holdings).map((n) => [n.ticker, n.holdings]));
  inp.funds = inp.funds.map((f) => { const h = top[f.ticker] || {}; const all = new Map(f.holdings.map(([s, w]) => [String(s).toUpperCase(), w])); for (const r of h.top || []) if (r.ticker) all.set(String(r.ticker).toUpperCase(), r.weight_pct); return { ...f, all: [...all], count: h.count_in_fund || f.holdings.length }; }); }
/* WHO IS RUN: every profile that is a company, not a fund. Each one that is not run says why. */
const FUND_ROWS = new Set(TABLES.fundamentals.map((r) => r.ticker)), served = new Set(Object.keys(RAW.quotes));
const skipped = {}, names = [];
for (const [t, p] of Object.entries(inp.profiles).sort((a, b) => a[0].localeCompare(b[0]))) {
  if (p.is_etf) { skipped[t] = "a fund, not a company"; continue; }
  if (!p.industry) { skipped[t] = "not a company (a coin, a future or an index): no industry on file"; continue; }
  if (DUAL[t] && inp.profiles[DUAL[t]]) { skipped[t] = `the same company as ${DUAL[t]} (one share class is priced)`; continue; }
  if (!served.has(t)) { skipped[t] = "figures on file, but the Hub does not serve it: no settled close to price it on"; continue; }
  if (!closedToday(RAW.quotes[t])) { skipped[t] = RAW.quotes[t] && RAW.quotes[t].today_session_et ? `stopped trading: its last session was ${RAW.quotes[t].today_session_et}` : "stopped trading: no session on file"; continue; }
  if (!FUND_ROWS.has(t)) { skipped[t] = "no fundamentals row"; continue; }
  names.push(t);
}
const ask = process.argv.slice(2).map((s) => s.toUpperCase()), syms = ask.length ? ask : names;
console.log(`inputs ready in ${((Date.now() - T0) / 1000).toFixed(1)}s · profiles ${Object.keys(inp.profiles).length} · companies to run ${names.length} · not run ${Object.keys(skipped).length} · reference facts ${refFile || "none on file"} · closes ${Object.keys(RAW.quotes).length} fetched ${RAW.fetched_utc}`);
const r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100), r1 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
const SNAPS = new Map();
async function snapOf(T, set) {
  const served_ = { ...set, kept: set.kept.filter((r) => !r.reference || r.has_figures) }, key = T + "|" + served_.kept.map((r) => r.ticker).join(",");
  if (SNAPS.has(key)) return SNAPS.get(key);
  const ctx = await readSet(T, served_, { today: TODAY, pg: pgRef, quotes: quotesRef, fxStandin, ...(FORWARD ? { forward: FORWARD } : {}) }), snap = snapshotFromCohort(ctx, T);
  const estRows = await pgRef(`analyst_estimates?select=ticker,fiscal_date,est_eps_avg&period=eq.annual&ticker=in.(${ctx.members.map(encodeURIComponent).join(",")})&fiscal_date=gte.${TODAY}&order=ticker.asc,fiscal_date.asc`);
  const estimates = Object.fromEntries(ctx.inputs.map((i) => [i.ticker, { eps_ttm: i.eps_ttm ?? null, est: estRows.filter((e) => e.ticker === i.ticker).map((e) => ({ fiscal_date: e.fiscal_date, eps: e.est_eps_avg })) }]));
  const v = { snap, estimates }; SNAPS.set(key, v); return v;
}
async function price(T, set, { fx = CP1_NONE, full = false } = {}) {
  const pricedPeers = set.kept.filter((r) => !r.reference || r.has_figures);
  if (!pricedPeers.length) return { ok: false, n_set: 0, reason: "no peers" };
  const { snap, estimates } = await snapOf(T, set);
  const C = conclusion6(snap, [], estimates, TODAY, "C", { set, fx });
  const c6 = C.c6, band = (x) => (x ? { lo: r2(x.lo), centre: r2(x.mid), hi: r2(x.hi) } : null), up = (x) => (x && snap.price > 0 ? r1((x.mid / snap.price - 1) * 100) : null);
  const wayC = (C.ways || []).find((w) => w.way === "C"), pts = wayC && wayC.ok ? wayC.points : [];
  const behind = [...new Set(pts.map((p) => p.ticker))];                         // the peers whose figures the centre is built from
  const mw = C.measureWeights || { weights: {}, parts: {} }, keys = C.rows.filter((r) => isValuation(r.key)).map((r) => r.key);
  const o = { ok: true, price: snap.price, n_set: pricedPeers.length, n_behind: behind.length, behind: behind.sort(), thin: behind.length < THIN_BELOW,
    band: band(C.band), upside_pct: up(C.band), reason: C.reason || null, no_peer_set: !!c6.noPeerSet, self: c6.self && c6.self.n ? c6.self.words : null,
    band_from_peers: band(c6.bandFromPeers), upside_from_peers: up(c6.bandFromPeers),
    priced_on: c6.pricedOn || "set", not_priced: c6.notPriced || [], fragile: c6.fragile ? { n: c6.fragile.n, of: c6.fragile.of, words: c6.fragile.words } : null,
    outliers: c6.outliers || [], business: c6.business ? { line: c6.business.line, same: c6.business.same.length, n: c6.business.n, mostlyDifferent: !!c6.business.mostlyDifferent } : null,
    whole_set_upside: c6.wholeSet ? up(c6.wholeSet.bandFromPeers || c6.wholeSet.band) : null,
    growth_credit: C.cp1 && C.cp1.growth && C.cp1.growth.credit > 1 ? r2(C.cp1.growth.credit) : null, sales_rows_off: !!(C.cp1 && C.cp1.margin && C.cp1.margin.off), reit: !!(C.cp1 && C.cp1.reit) };
  if (full) {
    o.rows = Object.fromEntries(keys.map((k) => { const r = C.rows.find((x) => x.key === k), e = (r && r.ends) || {}; return [k, { own: r2(r.own && r.own.multiple), median: r2(r.band && r.band.median), n: r.n || 0, price: r2(r && r.ok && e.median ? e.median.price : null), weight: r2(mw.weights[k]) }]; }));
    const c = snap.table.company;
    o.own = { rev_g_ttm: r1(c.rev_g_ttm), rev_g_fy: r1(c.rev_g_fy), eps_g_fy: r1(c.eps_g_fy), rev_g_2y: r1(c.rev_g_2y), eps_g_2y: r1(c.eps_g_2y), gm: r1(c.gm), om: r1(c.om), fcfm: r1(c.fcfm), nd_ebitda: r2(c.nd_ebitda), p_ffo: r2(c.p_ffo) };
    o.net_debt = snap.net_debt ?? null; o.ebitda_ttm = snap.ebitda_ttm ?? null; o.forward = snap.forward || "fiscal-year"; o.fwd_label = snap.fwd ? snap.fwd.label : null; o.fwd_flags = snap.fwd ? (snap.fwd.flags || []).map((f) => f.code) : []; o.pe_fwd_annual = r2(snap.pe_fwd_annual);   /* CP3: the debt reading's figures, and which forward basis this row is on */
    o.eps_ttm = r2(snap.eps_ttm); o.eps_fy1 = r2(snap.eps_fy1); o.fy1_date = snap.fy1_date || null; o.mcap = snap.mcap || null; o.shares = snap.shares || null; o.revenue_ttm = snap.revenue_ttm || null;
    o.currency = snap.fx && snap.fx.currency ? snap.fx.currency : "USD"; o.withheld = !!(snap.fx && snap.fx.withheld);
  }
  return o;
}
const OUT = process.env.KO1_OUT || "comps-universe.json", out = existsSync(OUT) && ask.length ? JSON.parse(readFileSync(OUT, "utf8")).names : {};
let k = 0;
for (const T of syms) {
  try {
    const set0 = buildSet(T, inp, { fx: CP1_LINES_OFF }), set1 = buildSet(T, inp, { fx: LINES_ON });
    const BEFORE = await price(T, set0), AFTER = await price(T, set1, { fx: FX_ON, full: true });
    const P = inp.profiles[T] || {};
    out[T] = { ok: true, name: P.name || null, industry: P.industry || null, sector: P.sector || null, country: P.country || null, lines: lineWords(set1.own_lines), lines_source: set1.lines_source, family: set1.own_lines.family || null, line: Object.entries(set1.own_lines.lines).sort((a, b) => b[1] - a[1])[0][0],
      set: set1.kept.map((r) => ({ t: r.ticker, same: !!(r.same_business ?? (r.exact >= SIM_MIN)), added: !!r.added, ref: !!r.reference, fig: r.reference ? !!r.has_figures : true })),
      added: set1.added || [], reference: set1.reference || [], same: set1.same ? { n: set1.same.n, need: set1.same.need, line: set1.same.line, short: set1.same.short } : null,
      after: AFTER, before: { ok: BEFORE.ok, upside_pct: BEFORE.upside_pct ?? null, n_behind: BEFORE.n_behind ?? null, no_peer_set: !!BEFORE.no_peer_set, reason: BEFORE.reason || null } };
  } catch (e) { out[T] = { ok: false, error: String((e && e.message) || e).slice(0, 300) }; }
  if (++k % 50 === 0) console.log(`${k} of ${syms.length} · ${((Date.now() - T0) / 1000).toFixed(0)}s`);
}
const A = Object.values(out).filter((o) => o.ok).map((o) => o.after), priced = A.filter((a) => a.ok && a.band);
writeFileSync(OUT, JSON.stringify({ meta: { run_utc: new Date().toISOString(), today: TODAY, price_is: `the ${TODAY} regular-session close (chart API /quotes: today_session_close, state COMPLETED), captured ${RAW.fetched_utc}`,
  comps_code: CP3 || FORWARD !== "fiscal-year" ? "the comps system on the one forward basis (CP3, hub/cp3-one-basis-20261007)" : "the comps system as the comps fix left it (hub/cp1-comps-cards-20261006 @f198dc6), every switch ON; nothing in it changed", forward: FORWARD || "next-four-quarters", stated_sets: CP3, switches: FX_ON, constants: { THIN_BELOW, SIM_MIN, SAME_MIN, CUT, CUT2, INFLUENCE, GROWTH_CREDIT_MAX, MARGIN_GATE },
  tables: Object.fromEntries(Object.keys(TABLES).map((n) => [n, { rows: TABLES[n].length, read_utc: (META[n] || {}).read_utc || null }])), table_reads_answered_locally: COUNT, reference_facts: refFile,
  counts: { profiles: Object.keys(inp.profiles).length, run: Object.keys(out).length, ok: Object.values(out).filter((o) => o.ok).length, failed: Object.values(out).filter((o) => !o.ok).length, priced: priced.length, no_peer_set: A.filter((a) => a.no_peer_set).length, not_priced_other: A.filter((a) => !a.band && !a.no_peer_set).length, thin: priced.filter((a) => a.thin).length, fragile: priced.filter((a) => a.fragile).length, skipped: Object.keys(skipped).length } },
  skipped, names: out }, null, 1));
console.log("DONE", JSON.stringify(JSON.parse(readFileSync(OUT, "utf8")).meta.counts), `· ${((Date.now() - T0) / 1000).toFixed(0)}s`);

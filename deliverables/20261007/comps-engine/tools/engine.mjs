/* CP4 (7 Oct 2026, 13:20 ET) · THE ONE COMPS ENGINE. One program computes every comps reading — each yardstick, the blend, the
   range, the peers that price it and why, the flags, the debt discount, growth two ways, PEG, the long-term channel and the
   Geiger's own year — and writes ONE artifact that every screen reads: the Hub's COMPS tab (the per-ticker view), the decision
   cards, the knockout and the allocation tool. No screen computes its own (tests/cp4-one-engine.test.mjs fails if one does).

   Alan, 7 Oct ~12:50: "You said one source of truth, but I just found another" · "we need to really set the basis … the football
   field process … needs to be reassessed" · "Peers by method, not by hand" · "a blend also works … to average things out" ·
   "Oracle would be penalized … debt".

   WHAT IS NEW HERE, on top of the comps system as CP3 left it (lines.mjs → outliers.mjs → field.mjs, each a switch, CP4_ALL):
     1 the method's sets, not the eight hand-written ones (lines.mjs CP4_LINES_ON: stated off, equipment makers their own line);
     2 the growth-first prior (field.mjs CP4_PRIOR) and closeness weights (size, growth, margin; adjacent peers at 0.35);
     3 a CONSISTENCY CHECK: a yardstick whose implied price sits more than FAR (×1.5) from the weighted middle of the other
       yardsticks is flagged, its reason said, and its weight halved; the centre is re-read with the halved weight;
     4 EBITDA WITHOUT ONE-OFF GAINS where the knockout's own one-off rule flags them (Alphabet, Amazon): EV/EBITDA re-read;
     5 FOREIGN REPORTERS ON ONE RATE: a foreign reporter's EBITDA, revenue, net debt and earnings are all stated at the supplier's
       own paired rate (TSMC 31.7 Taiwan dollars per dollar) and per ADR; the reading says the rate and the ADR ratio;
     6 THE DEBT DISCOUNT, explicit: net debt ÷ EBITDA at the knockout's own steps (heavy 3%, very heavy 6%, stretched 10%),
       plus 1% per year of free cash flow beyond five that repaying all debt would take (5% when free cash flow cannot repay it);
       interest cover joins the day the column is filled. The headline centre is AFTER the discount; the centre before it is beside;
     7 the long-term channel for EVERY name (the Lab's reviewed rails where on file, else a computed channel that says so);
     8 the Geiger's own year as percentiles, so a screen can place TODAY'S value in TODAY'S year.
   WHERE THE FIGURES COME FROM: the knockout's snapshot of the Hub's public tables (7 Oct 05:50Z; analyst_estimates re-read with
   both periods 7 Oct ~18:00Z), the settled 6 Oct closes, the knockout's Geiger replay and its saved weekly bars. Read-only:
   nothing is written to any table. Run from the scratch folder (snap/, quotes-all-raw.json, geiger-year.json, channels.json):
     node engine.mjs [--out <dir>] [TICKER …]        (no tickers = every company the knockout runs)                        */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)), WT = path.resolve(HERE, "../../../.."), DATA_DEFAULT = path.resolve(HERE, "../data");
const { localPg } = await import(WT + "/deliverables/20261007/knockout/tools/local-pg.mjs");
const { inputs: c4inputs, readSet, snapshotFromCohort } = await import(WT + "/deliverables/20261001/comps-mechanic/read.mjs");
const { buildSet, votesFor, lineWords, CP1_LINES_OFF, CP3_LINES_ON, CP4_LINES_ON, CP3_STATED, REFERENCE_PEERS, SIM_MIN, DUAL } = await import(WT + "/deliverables/20261003/comps-c5/lines.mjs");
const { conclusion6, CP1_NONE, CP3_ALL, CP4_ALL, setCheck, EVERY_LINE_MIN } = await import(WT + "/deliverables/20261005/comps-c6/outliers.mjs");
const { isValuation, wquantile, CP4_PRIOR, CP4_REIT_PRIOR, ADJACENT_WEIGHT, CLOSE_SIZE, CLOSE_GROWTH, CLOSE_MARGIN, GROWTH_CREDIT_MAX } = await import(WT + "/deliverables/20261003/comps-c5/field.mjs");
const { referenceOf, withReference, withReferenceQuotes } = await import(WT + "/deliverables/20261003/comps-c5/reference.mjs");
const { forwardRead, estFxPair, multipleText } = await import(WT + "/lib/forward-basis.mjs");
const { debtReading, DEBT_STEPS, DEBT_TOP } = await import(WT + "/lib/debt-reading.mjs");
export const VERSION = "comps-engine-1";
export const FAR = 1.5, FAR_WEIGHT = 0.5, FCF_YEARS_FREE = 5, FCF_YEARS_CAP = 5, THIN_BELOW = 4;
export const TWELVE = ["GOOGL", "AMZN", "AVGO", "NVDA", "TSM", "VST", "MU", "ORCL", "DLR", "EQIX", "SNDK", "WDC"];
const argv = process.argv.slice(2), opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const OUTDIR = opt("--out", DATA_DEFAULT), TODAY = opt("--today", "2026-10-06"), SNAP = opt("--snap", "snap");
const asked = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && ["--out", "--today", "--snap"].includes(argv[i - 1]))).map((s) => s.toUpperCase());
const J = (p) => JSON.parse(readFileSync(p, "utf8")), load = (n) => J(path.join(SNAP, n + ".json"));
const TABLES = Object.fromEntries(["company_profile", "ticker_industry", "tickers", "ticker_cohorts", "fmp_peers", "peer_sources", "fundamentals", "analyst_estimates", "fundamentals_history", "cashflow_history", "balance_history", "composite_staged", "filer_currency", "fx_rates", "earnings_events"].map((n) => [n, load(n)]));
const META = J(path.join(SNAP, "_meta.json"));
const CACHE = new Map(), pgRaw = localPg(TABLES), pg0 = async (p) => { if (!CACHE.has(p)) CACHE.set(p, pgRaw(p)); return CACHE.get(p); };
const fetchJson = async (u) => J(path.join(WT, u));
const RAW = J("quotes-all-raw.json");
const settle = (q) => (q && q.today_session_close_state === "COMPLETED" && q.today_session_close > 0 ? { price: q.today_session_close, price_observation_utc: q.today_session_et + "T20:00:00Z" } : q && q.price > 0 ? { price: q.price, price_observation_utc: q.price_observation_utc } : null);
const closedToday = (q) => !!(q && q.today_session_close_state === "COMPLETED" && q.today_session_close > 0 && q.today_session_et === TODAY);
const quotes0 = async (T) => ({ quotes: Object.fromEntries(T.map((t) => [t, settle(RAW.quotes[t])]).filter(([, q]) => q)) });
const refDir = WT + "/deliverables/20261003/comps-c5", refFile = readdirSync(refDir).filter((f) => /^reference-peers-facts-.*\.json$/.test(f)).sort().pop() || null;
const FACTS = refFile ? J(path.join(refDir, refFile)) : null, REF = referenceOf(FACTS);
const pg = FACTS ? withReference(pg0, FACTS) : pg0, quotes = FACTS ? withReferenceQuotes(quotes0, FACTS) : quotes0;
const fxStandin = J(WT + "/deliverables/20261001/comps-template/fx-standin-ecb-2026-10-01.json");
fxStandin.reported = J(WT + "/deliverables/20261003/comps-c5b/reporting-currency-fmp-2026-10-03.json").reported;
if (FACTS && FACTS.fx) { fxStandin.rates = { ...(fxStandin.rates || {}) }; for (const [c, rows] of Object.entries(FACTS.fx)) if (rows && rows.length && !(fxStandin.rates[c] && fxStandin.rates[c].length)) fxStandin.rates[c] = rows; for (const [t, c] of Object.entries(REF.peers)) fxStandin.reported[t] = c.currency; }
const inp = await c4inputs({ pg: pg0, fetchJson });
inp.segments = J(WT + "/deliverables/20261003/comps-c5/segments-2026-10-03.json").companies; inp.reference = REF.peers;
{ const tree = J(WT + "/deliverables/20260929/tree-map/tree.json"), nodes = Array.isArray(tree.nodes) ? tree.nodes : Object.values(tree.nodes);
  const top = Object.fromEntries(nodes.filter((n) => n.kind === "fund" && n.holdings).map((n) => [n.ticker, n.holdings]));
  inp.funds = inp.funds.map((f) => { const h = top[f.ticker] || {}; const all = new Map(f.holdings.map(([s, w]) => [String(s).toUpperCase(), w])); for (const r of h.top || []) if (r.ticker) all.set(String(r.ticker).toUpperCase(), r.weight_pct); return { ...f, all: [...all], count: h.count_in_fund || f.holdings.length }; }); }
const KO = existsSync(WT + "/deliverables/20261007/knockout/data/knockout.json") ? J(WT + "/deliverables/20261007/knockout/data/knockout.json") : { names: {} };
const GY = existsSync("geiger-year.json") ? J("geiger-year.json") : { names: {} }, CH = existsSync("channels.json") ? J("channels.json") : { names: {} };
const ZONES_FILE = process.env.CP4_ZONES || WT.replace(/_worktrees\/.*$/, "_worktrees/alloc-cp4-clickthrough-20261007/data/confluence-zones-20261006.json"), ZONES = existsSync(ZONES_FILE) ? J(ZONES_FILE) : null;
const OLD_CARDS = existsSync(WT + "/deliverables/20261007/one-basis/data/cards.json") ? J(WT + "/deliverables/20261007/one-basis/data/cards.json") : { cards: {} };
const r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100), r1 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10), r3 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000);
const nameOf = (t) => (inp.profiles[t] || {}).name || (REFERENCE_PEERS[t] || {}).name || t;
const median = (a) => { const v = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null; };
const inWords = (s) => String(s).replace(/000660\.KS/g, "SK hynix").replace(/005930\.KS/g, "Samsung").replace(/285A\.T/g, "Kioxia");
const LABEL = { pe_ttm: "trailing P/E", pe_fwd: "forward P/E", ev_ebitda: "EV/EBITDA", ev_sales: "EV/sales", ps: "P/S", peg: "PEG (the growth credit)", p_ffo: "P/FFO" };

/* who is run: every profile that is a company the Hub serves and that closed on TODAY (the knockout's own rule) */
const FUND_ROWS = new Set(TABLES.fundamentals.map((r) => r.ticker)), served = new Set(Object.keys(RAW.quotes)), skipped = {}, universe = [];
for (const [t, p] of Object.entries(inp.profiles).sort((a, b) => a[0].localeCompare(b[0]))) {
  if (p.is_etf) { skipped[t] = "a fund, not a company"; continue; } if (!p.industry) { skipped[t] = "not a company (a coin, a future or an index): no industry on file"; continue; }
  if (DUAL[t] && inp.profiles[DUAL[t]]) { skipped[t] = `the same company as ${DUAL[t]} (one share class is priced)`; continue; }
  if (!served.has(t)) { skipped[t] = "figures on file, but the Hub does not serve it: no settled close to price it on"; continue; }
  if (!closedToday(RAW.quotes[t])) { skipped[t] = "stopped trading: no session on the study's date"; continue; } if (!FUND_ROWS.has(t)) { skipped[t] = "no fundamentals row"; continue; }
  universe.push(t);
}
const NAMES = asked.length ? asked : universe;

const SNAPS = new Map();
async function snapOf(T, set, forward) {
  const served_ = { ...set, kept: set.kept.filter((r) => !r.reference || r.has_figures) }, key = forward + "|" + T + "|" + served_.kept.map((r) => r.ticker).join(",");
  if (SNAPS.has(key)) return SNAPS.get(key);
  const ctx = await readSet(T, served_, { today: TODAY, pg, quotes, fxStandin, forward }), snap = snapshotFromCohort(ctx, T);
  const estRows = await pg(`analyst_estimates?select=ticker,fiscal_date,est_eps_avg&period=eq.annual&ticker=in.(${ctx.members.map(encodeURIComponent).join(",")})&fiscal_date=gte.${TODAY}&order=ticker.asc,fiscal_date.asc`);
  const estimates = Object.fromEntries(ctx.inputs.map((i) => [i.ticker, { eps_ttm: i.eps_ttm ?? null, est: estRows.filter((e) => e.ticker === i.ticker).map((e) => ({ fiscal_date: e.fiscal_date, eps: e.est_eps_avg })) }]));
  const v = { ctx, snap, estimates }; SNAPS.set(key, v); return v;
}
async function price(T, set, fx, forward) {
  const pricedPeers = set.kept.filter((r) => !r.reference || r.has_figures); if (!pricedPeers.length) return { ok: false, reason: "no peers" };
  const { ctx, snap, estimates } = await snapOf(T, set, forward), C = conclusion6(snap, [], estimates, TODAY, "C", { set, fx }), c6 = C.c6;
  const wayC = (C.ways || []).find((w) => w.way === "C"), behind = wayC && wayC.ok ? [...new Set(wayC.points.map((p) => p.ticker))].sort() : [];
  return { ok: true, C, ctx, snap, wayC, price: snap.price, n_set: pricedPeers.length, behind, thin: behind.length < THIN_BELOW, band: C.band ? { lo: C.band.lo, centre: C.band.mid, hi: C.band.hi } : null, upside_pct: C.band && snap.price > 0 ? (C.band.mid / snap.price - 1) * 100 : null,
    no_peer_set: !!c6.noPeerSet, reason: C.reason || null, priced_on: c6.pricedOn || "set", business_peers: c6.businessPeers || null, adjacent_peers: c6.adjacentPeers || null, not_priced: c6.notPriced || [], outliers: c6.outliers || [], fragile: c6.fragile ? c6.fragile.words : null, self: c6.self && c6.self.outlier ? c6.self.words : null,
    growth_credit: C.cp1 && C.cp1.growth ? { own: r1(C.cp1.growth.own), peers: r1(C.cp1.growth.peers), n: C.cp1.growth.n, credit: r2(C.cp1.growth.credit), why: C.cp1.growth.why || null } : null, sales_rows_off: !!(C.cp1 && C.cp1.margin && C.cp1.margin.off), margin: C.cp1 && C.cp1.margin ? { own: r1(C.cp1.margin.own), peers: r1(C.cp1.margin.peers) } : null, reit: !!(C.cp1 && C.cp1.reit) };
}
const BAL = new Map();
async function balanceOf(tickers) {
  const need = tickers.filter((t) => !BAL.has(t)); if (need.length) { const since = new Date(Date.parse(TODAY + "T00:00:00Z") - 800 * 86400e3).toISOString().slice(0, 10);
    const rows = await pg(`balance_history?select=ticker,period,fiscal_date,net_debt,total_debt,cash_and_equiv&ticker=in.(${need.map(encodeURIComponent).join(",")})&fiscal_date=gte.${since}&order=fiscal_date.desc`); for (const t of need) BAL.set(t, rows.find((r) => r.ticker === t) || null); }
  return Object.fromEntries(tickers.map((t) => [t, BAL.get(t)]));
}
const isFinancial = (t) => ((inp.profiles[t] || {}).sector || "") === "Financial Services";
/* the one-off gains the knockout's own rule found inside the reported year (per share), for the EBITDA without them */
const oneOffPs = (t) => { const w = ((KO.names[t] || {}).one_off || []).map(String).join(" "), m = /about ([0-9.]+) a share of one-off gains/.exec(w); return m ? Number(m[1]) : null; };
function rowOf(t, T, X, bal) {
  const { snap, ctx, C } = X, own = t === T, tb = own ? snap.table.company : snap.table.peers[t] || {}, i = ctx.inputs.find((x) => x.ticker === t) || {}, note = own ? snap.fwd : snap.fwd_peers[t], fxn = own ? snap.fx : snap.fx_peers[t];
  const m = (k) => { const r = C.rows.find((x) => x.key === k) || snap.rows.find((x) => x.key === k); if (!r) return null; return own ? (r.own ? r.own.multiple : null) : r.values && r.values[t] ? r.values[t].multiple : null; };
  const usdFiler = !(fxn && fxn.currency && fxn.currency !== "USD"), b = usdFiler ? bal[t] || {} : {};
  const debt = debtReading({ net_debt: i.net_debt, total_debt: b.total_debt, cash: b.cash_and_equiv, ebitda: i.ebitda && i.ebitda.now, operating_income: i.oi && i.oi.now, interest_expense: null, fcf: i.fcf && i.fcf.now, mcap: i.mcap, financial: isFinancial(t) });
  return { ticker: t, name: nameOf(t), price: r2(i.price), mcap: i.mcap || null, shares: i.shares || null, revenue_ttm: i.rev ? i.rev.now : null, ebitda_ttm: i.ebitda ? i.ebitda.now : null, net_debt: i.net_debt ?? null,
    pe_ttm: r2(m("pe_ttm")), pe_fwd: r2(m("pe_fwd")), pe_fwd_text: multipleText(m("pe_fwd"), !!(note && note.rate)), ev_ebitda: r2(m("ev_ebitda")), ev_sales: r2(m("ev_sales")), ps: r2(m("ps")), peg: r2(m("peg")), p_ffo: r2(tb.p_ffo),
    growth_reported_to_next: i.eps_ttm > 0 && i.eps_fy1 != null ? r1((i.eps_fy1 / i.eps_ttm - 1) * 100) : null, eps_ttm: r3(i.eps_ttm), eps_next_four: r3(i.eps_fy1), growth_eps: r1(tb.eps_g_fy), growth_rev: r1(tb.rev_g_fy), rev_g_ttm: r1(tb.rev_g_ttm), eps_g_2y: r1(tb.eps_g_2y), gm: r1(tb.gm), om: r1(tb.om), fcfm: r1(tb.fcfm),
    forward: note ? { basis: note.basis, label: note.label, growth_basis: note.growth_basis, flags: (note.flags || []).map((f) => ({ code: f.code, words: f.words })), rate: note.rate || null, withheld: note.withheld_why || null } : null,
    currency: fxn && fxn.currency && fxn.currency !== "USD" ? fxn.currency : "USD", fx_note: fxn && fxn.currency && fxn.currency !== "USD" ? { converted: !!fxn.converted, why: fxn.why || null, adr: fxn.adr || null } : null,
    debt: { net_debt: debt.net_debt, total_debt: debt.total_debt, cash: debt.cash, net_debt_ebitda: r2(debt.net_debt_ebitda), interest_cover: r2(debt.interest_cover), interest_cover_why: debt.interest_cover_why, debt_fcf_years: r1(debt.debt_fcf_years), net_debt_pct_mcap: r1(debt.net_debt_pct_mcap), word: debt.word, points: debt.points, words: debt.words, warn: debt.warn, balance_date: b.fiscal_date || null } };
}
/* THE DEBT DISCOUNT (item 6 above): the knockout's steps as a share off the centre, plus the years of free cash flow */
export function debtDiscount(d) {
  if (!d || d.word === "not read" || d.net_debt_ebitda == null && d.word !== "nothing to carry it") return { pct: 0, words: d && d.word === "not read" ? "no debt discount: a bank's debt is its raw material" : "no debt discount: net debt ÷ EBITDA not on file" };
  const steps = (d.points || 0) * 100; let fcf = 0, why = [];
  if (steps > 0) why.push(`${steps}% for net debt at ${d.net_debt_ebitda != null ? d.net_debt_ebitda + "× EBITDA" : "no EBITDA to carry it"} (${d.word})`);
  if (d.total_debt > 0) { if (d.debt_fcf_years == null || d.debt_fcf_years < 0) { fcf = FCF_YEARS_CAP; why.push(`${fcf}% because today's free cash flow cannot repay the debt`); } else if (d.debt_fcf_years > FCF_YEARS_FREE) { fcf = Math.min(FCF_YEARS_CAP, Math.round(d.debt_fcf_years - FCF_YEARS_FREE)); if (fcf > 0) why.push(`${fcf}% for ${d.debt_fcf_years} years of free cash flow to repay all debt (the first five are free)`); } }
  const pct = steps + fcf;
  return { pct, words: pct > 0 ? `debt discount ${pct}% off the centre: ` + why.join("; ") + (d.interest_cover == null ? " · interest cover not on file" : ` · interest cover ${d.interest_cover}×`) : "no debt discount: " + (d.word === "net cash" ? "net cash" : `net debt ${d.net_debt_ebitda}× EBITDA, ${d.word}`) };
}
/* THE CONSISTENCY CHECK (item 3): each priced yardstick's implied price against the weighted middle of the others */
function consistency(rows, weights, own, X) {
  const priced = rows.filter((r) => isValuation(r.key) && r.ok && r.ends && r.ends.median && r.ends.median.price > 0 && (weights[r.key] || 0) > 0);
  const out = {}; if (priced.length < 3) return out;
  for (const r of priced) {
    const others = priced.filter((o) => o.key !== r.key).map((o) => ({ price: o.ends.median.price, w: weights[o.key] })), ref = wquantile(others, 0.5);
    const ratio = ref > 0 ? r.ends.median.price / ref : null, far = ratio != null && (ratio > FAR || ratio < 1 / FAR);
    let why = null;
    if (far) { const k = r.key, d = own.debt || {};
      if ((k === "ev_ebitda" || k === "ev_sales") && own.currency !== "USD") why = `its statements are in ${own.currency}: enterprise value, EBITDA and revenue are stated at one rate (${own.one_rate ? own.one_rate.words : "the paired rate"}) — a rate or share-count slip shows here first`;
      else if (k === "ev_ebitda" && d.warn) why = "the stored EBITDA carries one-off gains or heavy depreciation (EBITDA far above operating income)";
      else if ((k === "ev_ebitda" || k === "ev_sales") && d.net_debt_ebitda != null && Math.abs(d.net_debt_ebitda) > 2) why = `net debt at ${d.net_debt_ebitda}× EBITDA moves the enterprise value a long way from the market value`;
      else if (k === "ev_sales" || k === "ps") why = X.margin && X.margin.own != null ? `a dollar of its sales is not a dollar of its peers': operating margin ${X.margin.own}% against ${X.margin.peers}%` : "its margin is far from its peers'";
      else if (k === "peg") why = X.growth_credit && X.growth_credit.own != null ? `its growth into the following year (${X.growth_credit.own}%) is far from its peers' (${X.growth_credit.peers}%), so the growth yardstick prices it elsewhere` : "its growth is far from its peers'";
      else if (k === "pe_ttm") why = "the reported year is not the next four quarters: one-off items or a step in earnings sit in the trailing figure";
      else if (k === "pe_fwd") why = "its forward earnings sit far from where its peers' multiples put them";
      else if (k === "p_ffo") why = "funds from operations are approximated from the statements (net income + depreciation)";
      if (!why) why = k === "ev_ebitda" ? "its EBITDA margin sits far from its peers', so EBITDA and earnings price it differently" : "it sits far from the other yardsticks"; }
    const factor = far ? Math.min(FAR_WEIGHT, Math.exp(-2 * Math.abs(Math.log(ratio)))) : 1;
    out[r.key] = { implied: r2(r.ends.median.price), others: r2(ref), ratio: r2(ratio), far, factor: r2(factor), why, words: far ? `${LABEL[r.key] || r.key} implies ${Math.round(r.ends.median.price)} against the other yardsticks' ${Math.round(ref)} — ${why}; its weight is cut to ${Math.round(factor * 100)}%` : null };
  }
  return out;
}
/* EBITDA without the one-off gains: the EV/EBITDA row re-read on the clean figure (own multiple, and every peer point) */
function cleanEbitda(X, own, T) {
  const gain = oneOffPs(T); if (!(gain > 0) || !(own.shares > 0) || !(own.ebitda_ttm > 0)) return null;
  const clean = own.ebitda_ttm - gain * own.shares; if (!(clean > 0)) return null;
  return { gain_ps: gain, gain: gain * own.shares, ebitda: own.ebitda_ttm, ebitda_clean: clean, words: `EBITDA without one-off gains: ${(own.ebitda_ttm / 1e9).toFixed(1)}B stored → ${(clean / 1e9).toFixed(1)}B without about ${gain.toFixed(2)} a share of gains the knockout's rule found in the reported year` };
}
/* a foreign reporter on ONE rate (item 5): the supplier's paired rate and the ADR ratio, stated; the figures the reader converted at statement-date rates are re-stated at it */
function oneRate(own, X, T) {
  if (own.currency === "USD") return null; const note = X.snap.fwd || {}, rate = note.rate && note.rate.f ? 1 / note.rate.f : null, fc = TABLES.filer_currency.find((r) => r.ticker === T) || {}, prof = inp.profiles[T] || {};
  const adrShares = prof.market_cap > 0 && X.snap.price > 0 ? prof.market_cap / X.snap.price : null, local = fc.shares_dil || null, ratio = adrShares && local ? local / adrShares : null;
  return { currency: own.currency, rate: rate ? Number(rate.toPrecision(4)) : null, rate_is: rate ? `the supplier's own paired rate (${own.currency} per dollar), the dashboard's` : "no paired rate: the reader's statement-date rates stand", adr_ratio: ratio ? Number(ratio.toPrecision(3)) : null, per: ratio && Math.abs(ratio - 1) > 0.15 ? `per ADR (1 ADR = ${Math.round(ratio)} shares)` : "per US-listed share (the supplier already serves the ADR count)",
    words: `${own.currency} reporter: earnings, revenue, EBITDA and net debt in dollars${rate ? ` at ${rate.toFixed(1)} ${own.currency} per dollar` : ""}, ${ratio && Math.abs(ratio - 1) > 0.15 ? `per ADR (1 ADR = ${Math.round(ratio)} shares)` : "per US-listed share"}` };
}
function geigerOf(T) { const y = GY.names[T], k = KO.names[T] || {}; if (!y) return k.geiger != null ? { close: k.geiger, pctl_close: k.pctl ?? null, year: null, from: "the knockout" } : null;
  const g = y.last, q = y.q, pct = (v) => { if (v == null || !q) return null; if (v <= q[0]) return 0; if (v >= q[q.length - 1]) return 100; for (let i = 1; i < q.length; i++) if (v <= q[i]) return Math.round(((i - 1) + (v - q[i - 1]) / ((q[i] - q[i - 1]) || 1)) * (100 / (q.length - 1))); return 100; };
  return { close: r2(g), pctl_close: pct(g), year: { n: y.n, from: y.from, to: y.to, q }, rule: "today's Geiger is placed in the same year by interpolating these percentiles (0, 2, 4 … 100) — today's value against today's percentile", from: "the knockout's replay of each evening's Geiger" }; }
function channelOf(T, price) {
  const lv = ZONES && ZONES.names && ZONES.names[T] && ZONES.names[T].levels; let lab = null;
  if (lv && price > 0) for (const tf of ["1W", "2W", "3D"]) { const rail = (k) => lv.find((x) => new RegExp("^" + tf + " B" + k + "\\b").test(x.label)), u = rail(2), m = rail(4), l = rail(6);
    if (!u || !m || !l || !(u.level > m.level && m.level > l.level) || Math.abs(m.level / ((u.level + l.level) / 2) - 1) > 0.01) continue;
    lab = { timeframe: tf, upper: u.level, mid: m.level, lower: l.level, position_pct: r1(((price - l.level) / (u.level - l.level)) * 100), source: "the Lab's reviewed rails (B2 / B4 / B6)" }; break; }
  const c = CH.names[T], comp = c && c.ok && price > 0 ? { upper: c.upper, mid: c.mid, lower: c.lower, position_pct: r1(((price - c.lower) / (c.upper - c.lower)) * 100), slope_pct_year: c.slope_pct_year, sigma_pct: c.sigma_pct, bars: c.bars, from: c.from, to: c.to, source: c.source } : null;
  const use = lab || comp; if (!use) return { lab: null, computed: null, position_pct: null, words: "no long-term channel on file" };
  const p = use.position_pct, w = p < 0 ? `below its long-term channel (${Math.round(-p)}% of its height under the lower rail ${Math.round(use.lower)})` : p > 100 ? `above its long-term channel (${Math.round(p - 100)}% of its height over the upper rail ${Math.round(use.upper)})` : `${Math.round(p)}% of the way up its long-term channel (${Math.round(use.lower)} → ${Math.round(use.upper)})`;
  return { lab, computed: comp, position_pct: p, words: w + " — " + use.source, measure: "(close − lower rail) ÷ (upper rail − lower rail), the channels study's own" };
}

mkdirSync(OUTDIR + "/names", { recursive: true });
const index = { what: "CP4 · the one comps engine's artifact: every reading every screen prints. One program (deliverables/20261007/comps-engine/tools/engine.mjs) wrote this file and names/<TICKER>.json; the Hub's COMPS tab, the cards, the knockout and the allocation tool read them and compute nothing of their own.", version: VERSION, built_utc: new Date().toISOString(), today: TODAY,
  price_is: `the ${TODAY} regular-session close (chart API /quotes, captured ${RAW.fetched_utc}); a screen with a fresh live price divides it by the same earnings and scales the range by price ÷ close`,
  tables: Object.fromEntries(["analyst_estimates", "fundamentals", "fundamentals_history", "balance_history", "cashflow_history", "company_profile", "earnings_events"].map((n) => [n, { rows: TABLES[n].length, read_utc: (META[n] || {}).read_utc || null }])),
  rule: { forward: "price ÷ the next four quarters of consensus EPS (the dashboard's rule, lib/forward-basis.mjs); a foreign reporter's EPS in dollars at the supplier's own paired rate", growth: "the four quarters after the next four ÷ the next four − 1", peg: "that forward P/E ÷ that growth — the PEG ratio, called PEG everywhere",
    prior: { default: CP4_PRIOR, reit: CP4_REIT_PRIOR, words: "growth and PEG weigh most (Alan's rule); each weight on the page is prior × coverage × fit, measured in the set, then halved where the consistency check flags the yardstick" },
    peers: `the four sources vote (FMP peers, Massive related, same industry, shared fund); business lines from the filings decide membership; same-business peers set the price when at least ${EVERY_LINE_MIN} exist and adjacent peers blend in at ${ADJACENT_WEIGHT}; every peer weighed by closeness (size ÷ ${CLOSE_SIZE} decade, growth ÷ ${CLOSE_GROWTH} points, margin ÷ ${CLOSE_MARGIN} points)`,
    consistency: `a yardstick whose implied price is more than ×${FAR} from the weighted middle of the others is flagged with its reason and its weight is cut: to half at ×${FAR}, and by the square of the distance beyond (a tenth at ×3)`, debt: `discount off the centre: ${DEBT_STEPS.map(([x, p]) => `${p * 100}% up to ${x}×`).join(", ")}, ${DEBT_TOP * 100}% above; + 1% per year of free cash flow beyond ${FCF_YEARS_FREE} to repay all debt (cap ${FCF_YEARS_CAP}%)`, growth_credit_max: GROWTH_CREDIT_MAX, thin_below: THIN_BELOW },
  twelve: TWELVE, reference: { file: refFile, carried: Object.keys(REF.peers) }, skipped, names: {} };
let k = 0; const T0 = Date.now();
for (const T of NAMES) {
  try {
    const set0 = buildSet(T, inp, { fx: CP1_LINES_OFF }), set3 = buildSet(T, inp, { fx: CP3_LINES_ON }), set4 = buildSet(T, inp, { fx: CP4_LINES_ON });
    const live = await price(T, set0, CP1_NONE, "fiscal-year"), cp3 = await price(T, set3, CP3_ALL, "next-four-quarters"), X = await price(T, set4, CP4_ALL, "next-four-quarters");
    if (!X.ok) { index.names[T] = { ok: false, name: nameOf(T), why: X.reason }; continue; }
    const members = [T, ...set4.kept.filter((r) => !r.reference || r.has_figures).map((r) => r.ticker)], bal = await balanceOf(members);
    const own = rowOf(T, T, X, bal); own.one_rate = oneRate(own, X, T);
    const outl = new Set(X.outliers || []), same = new Set(X.business_peers || set4.kept.filter((r) => r.same_business).map((r) => r.ticker)), pw = (X.C.peerWeights && X.C.peerWeights.weights) || {}, pwParts = (X.C.peerWeights && X.C.peerWeights.parts) || {};
    const peers = set4.kept.map((r) => { const has = !r.reference || r.has_figures, row = has ? rowOf(r.ticker, T, X, bal) : { ticker: r.ticker, name: nameOf(r.ticker) }, v = votesFor(T, r.ticker, inp, { also: (REFERENCE_PEERS[r.ticker] || {}).also || [] }), part = pwParts[r.ticker] || null;
      return { ...row, same_business: same.has(r.ticker), adjacent: has && !same.has(r.ticker), ratio: r.ratio != null ? r2(r.ratio) : null, reference: !!r.reference, has_figures: has, in_old_set: set0.kept.some((k) => k.ticker === r.ticker), in_cp3_set: set3.kept.some((k) => k.ticker === r.ticker), added_by_method: !!r.added,
        priced: has && X.behind.includes(r.ticker) && !outl.has(r.ticker), outlier: outl.has(r.ticker), weight: has ? r3(pw[r.ticker]) : null, closeness: part ? { size: r2(part.size), growth: r2(part.growth), margin: r2(part.margin), close: r2(part.close), business: part.business } : null,
        votes: { fmp: !!v.fmp, massive: !!v.massive, industry: !!v.industry, fund: !!v.fund, n: v.n }, why: inWords(r.why || "") || null, line: r.shared && r.shared[0] ? r.shared[0].line : (r.sameFamily && r.sameFamily[0] ? "same family: " + r.sameFamily[0].toLowerCase() : null) }; });
    /* the yardsticks as the field priced them */
    const mw = X.C.measureWeights || { weights: {}, parts: {} }, rows = X.C.rows.filter((r) => isValuation(r.key)); let weights = { ...mw.weights }, pts = X.wayC && X.wayC.ok ? X.wayC.points.map((p) => ({ ...p })) : [];
    /* 4 · EBITDA without one-off gains: the EV/EBITDA points re-priced on the clean figure */
    const clean = cleanEbitda(X, own, T);
    if (clean) { for (const p of pts) if (p.key === "ev_ebitda" && own.shares > 0) p.price = (p.multiple * clean.ebitda_clean - (own.net_debt || 0)) / own.shares; const r = rows.find((x) => x.key === "ev_ebitda"); if (r && r.ends && r.ends.median) { r.ends = { ...r.ends, median: { ...r.ends.median, price: (r.ends.median.multiple * clean.ebitda_clean - (own.net_debt || 0)) / own.shares } }; r.own = { ...r.own, multiple: (own.mcap + (own.net_debt || 0)) / clean.ebitda_clean }; } }
    /* 3 · the consistency check, then the weights halved where flagged and the centre re-read */
    const cons = consistency(rows, weights, own, X), flaggedKeys = Object.keys(cons).filter((k) => cons[k].far);
    const centreBefore = pts.length ? wquantile(pts, 0.5) : null;
    if (flaggedKeys.length) { for (const k of flaggedKeys) weights[k] = (weights[k] || 0) * cons[k].factor; const s = Object.values(weights).reduce((a, b) => a + b, 0); if (s > 0) for (const k of Object.keys(weights)) weights[k] /= s; const byKey = {}; for (const p of pts) byKey[p.key] = (byKey[p.key] || 0) + p.w; for (const p of pts) if (byKey[p.key] > 0) p.w = p.w / byKey[p.key] * (weights[p.key] || 0); }
    const lo = pts.length ? wquantile(pts, 0.25) : null, centre = pts.length ? wquantile(pts, 0.5) : null, hi = pts.length ? wquantile(pts, 0.75) : null;
    /* 6 · the debt discount, explicit; the headline centre is after it */
    const disc = debtDiscount(own.debt), centreAfter = centre != null ? centre * (1 - disc.pct / 100) : null;
    const px = X.price, up = (v) => (v != null && px > 0 ? r1((v / px - 1) * 100) : null);
    const yard = Object.fromEntries(rows.map((r) => { const e = r.ends || {}, p = mw.parts[r.key] || {}; return [r.key, { label: LABEL[r.key] || r.label, own: r2(r.own && r.own.multiple), median: r2(r.band && r.band.median), lo: r2(r.band && r.band.min), hi: r2(r.band && r.band.max), n: r.n || 0, implied: r2(r.ok && e.median ? e.median.price : null), upside_pct: up(r.ok && e.median ? e.median.price : null), weight: r3(weights[r.key]), weight_before_check: r3(mw.weights[r.key]), prior: r2(p.prior), coverage: r2(p.coverage), fit: r2(p.fit), credit: p.credit ? r2(p.credit) : null, off: p.off || null, consistency: cons[r.key] || null, basis: r.basis || null }]; }));
    const checkNow = setCheck(set4, [...same]), checkOld = setCheck(set0, null);
    const flags = [...(X.thin ? [`THIN: ${X.behind.length} peers behind the centre`] : []), ...(X.fragile ? ["FRAGILE: " + inWords(X.fragile)] : []), ...(X.no_peer_set ? ["no peer set: " + inWords(X.self || "")] : []), ...(checkNow ? checkNow.flags : []), ...flaggedKeys.map((k) => cons[k].words), ...(clean ? [clean.words] : []), ...(own.one_rate ? [own.one_rate.words] : []), ...((X.snap.fwd && X.snap.fwd.flags) || []).filter((f) => f.code !== "thin").map((f) => f.words)].map(inWords);
    const fw = X.snap.fwd || {}, sits = (key) => { const vals = peers.filter((p) => p.priced).map((p) => p[key]).filter((v) => v != null && v > 0).sort((a, b) => a - b), o = own[key]; return o != null && o > 0 && vals.length ? { place: vals.filter((v) => v < o).length + 1, of: vals.length + 1, median: r2(median(vals)), vs_median_pct: r1((o / median(vals) - 1) * 100) } : null; };
    const reading = { ok: true, ticker: T, name: nameOf(T), price: px, price_is: `session close ${TODAY}`, industry: (inp.profiles[T] || {}).industry || null, sector: (inp.profiles[T] || {}).sector || null, line: lineWords(set4.own_lines), line_source: set4.lines_source, line_from: set4.lines_from, currency: own.one_rate || { currency: "USD" },
      forward: { pe: X.snap.pe_fwd ?? (own.pe_fwd), text: own.pe_fwd_text, eps_usd: X.snap.eps_fy1 ?? null, basis: fw.basis || null, label: fw.label || null, through: fw.through || null, rate: fw.rate || null, flags: (fw.flags || []).map((f) => ({ code: f.code, words: f.words })), fiscal_year_pe: r2(X.snap.pe_fwd_annual) },
      growth: { reported_to_next_pct: own.growth_reported_to_next, next_to_following_pct: own.growth_eps, revenue_following_pct: own.growth_rev, revenue_ttm_pct: own.rev_g_ttm, words: { reported_to_next: "earnings of the last twelve months, as reported → the next four quarters", next_to_following: "the next four quarters → the four after" }, one_off: (KO.names[T] || {}).one_off || [] },
      peg: { value: own.peg, words: "PEG = forward P/E ÷ earnings growth into the following year (in %)", credit: X.growth_credit },
      sets: { old: set0.kept.map((r) => r.ticker), cp3: set3.stated ? set3.stated.peers : null, cp3_kept: set3.kept.map((r) => r.ticker), now: set4.kept.map((r) => r.ticker), same_business: [...same], adjacent: peers.filter((p) => p.adjacent).map((p) => p.ticker), priced: peers.filter((p) => p.priced).map((p) => p.ticker), outliers: [...outl], priced_on: X.priced_on, added_by_method: set4.added || [], reference: set4.reference || [],
        rule: X.priced_on === "blend" ? `${same.size} same-business peers set the price (${EVERY_LINE_MIN} or more); ${peers.filter((p) => p.adjacent).length} adjacent peers blend in at ${ADJACENT_WEIGHT}` : same.size ? `fewer than ${EVERY_LINE_MIN} same-business peers (${same.size}), so the whole set prices it on closeness alone` : "the whole set prices it on closeness", check: { now: checkNow, as_sources_kept: checkOld } },
      peers, yardsticks: yard, weights: Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, r3(v)])), weights_basis: mw.basis,
      blend: { low: r2(lo), centre: r2(centreAfter), high: r2(hi != null ? hi * (1 - disc.pct / 100) : null), low_before_debt: r2(lo), centre_before_debt: r2(centre), high_before_debt: r2(hi), centre_before_check: r2(centreBefore), upside_pct: up(centreAfter), upside_before_debt_pct: up(centre), n_behind: X.behind.length, behind: X.behind, thin: X.thin, fragile: !!X.fragile, no_peer_set: X.no_peer_set, reit: X.reit, sales_rows_off: X.sales_rows_off, growth_credit: X.growth_credit },
      debt: { ...own.debt, discount: disc }, ebitda_clean: clean, consistency: cons, flags, sits: { pe_fwd: sits("pe_fwd"), ev_ebitda: sits("ev_ebitda"), peg: sits("peg"), growth_eps: sits("growth_eps") },
      channel: channelOf(T, px), geiger: geigerOf(T), technicals: KO.names[T] ? { geiger: KO.names[T].geiger, pctl: KO.names[T].pctl, trend: KO.names[T].trend, momentum: KO.names[T].momentum, zone: KO.names[T].zone || null, from: "the knockout's reading of the 6 Oct close" } : null,
      before: { live_as_it_stands: { upside_pct: live.ok ? r1(live.upside_pct) : null, centre: live.ok && live.band ? r2(live.band.centre) : null, words: "the comps system as it stands on the live Hub: every switch off, the fiscal-year forward basis, the sources' own set" }, cp3: { upside_pct: cp3.ok ? r1(cp3.upside_pct) : null, centre: cp3.ok && cp3.band ? r2(cp3.band.centre) : null, priced_on: cp3.ok ? cp3.priced_on : null, words: "CP3: one forward basis, the stated same-business sets" } } };
    writeFileSync(`${OUTDIR}/names/${T}.json`, JSON.stringify(reading));
    index.names[T] = { ok: true, name: reading.name, price: px, line: reading.line, industry: reading.industry, sector: reading.sector, currency: own.currency, forward: { pe: reading.forward.pe, text: reading.forward.text, eps_usd: reading.forward.eps_usd, label: reading.forward.label, fiscal_year_pe: reading.forward.fiscal_year_pe }, growth: reading.growth.next_to_following_pct, growth_reported: reading.growth.reported_to_next_pct, peg: own.peg,
      blend: { low: reading.blend.low, centre: reading.blend.centre, high: reading.blend.high, upside_pct: reading.blend.upside_pct, centre_before_debt: reading.blend.centre_before_debt, upside_before_debt_pct: reading.blend.upside_before_debt_pct, n_behind: X.behind.length, thin: X.thin, fragile: !!X.fragile, no_peer_set: X.no_peer_set, priced_on: X.priced_on },
      weights: reading.weights, debt: { net_debt_ebitda: own.debt.net_debt_ebitda, word: own.debt.word, fcf_years: own.debt.debt_fcf_years, discount_pct: disc.pct }, flags, priced: reading.sets.priced, same_business: reading.sets.same_business, adjacent: reading.sets.adjacent, old_set: reading.sets.old, cp3_set: reading.sets.cp3, channel_pct: reading.channel.position_pct, channel_source: (reading.channel.lab || reading.channel.computed || {}).source || null, geiger: reading.geiger ? { close: reading.geiger.close, pctl_close: reading.geiger.pctl_close } : null, before: reading.before };
    if (TWELVE.includes(T) || asked.length) console.log(`${T.padEnd(5)} ${String(px).padStart(8)} fwd ${own.pe_fwd_text.padStart(7)} g ${String(own.growth_eps).padStart(5)}% PEG ${String(own.peg).padStart(5)} · live ${live.ok ? r1(live.upside_pct) : "—"}% · cp3 ${cp3.ok ? r1(cp3.upside_pct) : "—"}% · NOW ${reading.blend.upside_pct}% (before debt ${reading.blend.upside_before_debt_pct}%, before check ${up(centreBefore)}%) centre ${reading.blend.centre} [${reading.blend.low}–${reading.blend.high}] on ${X.priced_on} ${[...same].join(" ")} | adj ${reading.sets.adjacent.join(" ")} · w ${Object.entries(reading.weights).map(([k, v]) => k + " " + Math.round(v * 100) + "%").join(", ")} · ${flags.filter((f) => /^(THIN|FRAGILE|no peer|set check|.*weight is cut)/.test(f)).map((f) => f.slice(0, 60)).join(" | ")}`);
  } catch (e) { index.names[T] = { ok: false, name: nameOf(T), error: String((e && e.stack) || e).slice(0, 600) }; console.log(`${T.padEnd(5)} FAILED ${index.names[T].error.split("\n")[0]}`); }
  if (++k % 50 === 0) console.log(`${k} of ${NAMES.length} · ${((Date.now() - T0) / 1000).toFixed(0)}s`);
}
index.counts = { run: NAMES.length, ok: Object.values(index.names).filter((n) => n.ok).length, priced: Object.values(index.names).filter((n) => n.ok && n.blend && n.blend.centre != null).length, thin: Object.values(index.names).filter((n) => n.ok && n.blend && n.blend.thin).length, fragile: Object.values(index.names).filter((n) => n.ok && n.blend && n.blend.fragile).length, blend: Object.values(index.names).filter((n) => n.ok && n.blend && n.blend.priced_on === "blend").length, consistency_flagged: Object.values(index.names).filter((n) => n.ok && n.flags.some((f) => /weight is cut/.test(f))).length, debt_discounted: Object.values(index.names).filter((n) => n.ok && n.debt.discount_pct > 0).length };
writeFileSync(OUTDIR + "/comps.json", JSON.stringify(index));
console.log("DONE", JSON.stringify(index.counts), "→", OUTDIR, `· ${((Date.now() - T0) / 1000).toFixed(0)}s`);

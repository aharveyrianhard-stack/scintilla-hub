/* CP1 · the comps system run headless, BEFORE → AFTER, on the same prices and the same figures.
     BEFORE   C5's set (business lines, 12 kept) → C6b price-only outliers → the price from the whole field (way C).
              Every CP1 switch off: this is the comps system exactly as it stands on hub/c6b-outliers-price-only-20261005.
     SET      the same, with only the four LINE fixes on (memory + storage one line, data-centre landlords their own
              line, the kept set complemented, reference peers listed) — what the peer change alone does.
     AFTER    every CP1 switch on (lines + growth credit, reit yardstick, margin gate + the tighter outlier rule and the
              company-itself test).
     SAME     AFTER, with the peers that do not share the business switched off (the comps tab's own peer on/off).
   Read-only: the Hub's public tables through its public read key (a private file in the working folder, never
   committed), the settled closes captured from the chart API's /quotes (quotes-all-raw.json), the committed fixtures.
   Writes only the JSON beside the run. Run from a scratch folder holding `.anon` and `quotes-all-raw.json`:
     node <this file> [TICKER …] */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)), WT = path.resolve(HERE, "../../../..");
const { inputs: c4inputs, readSet, snapshotFromCohort } = await import(WT + "/deliverables/20261001/comps-mechanic/read.mjs");
const { buildSet, lineWords, votesFor, CP1_LINES_OFF, CP1_LINES_ON, REFERENCE_PEERS, SIM_MIN, SAME_MIN } = await import(WT + "/deliverables/20261003/comps-c5/lines.mjs");
const { conclusion6, CP1_ALL, CP1_NONE, CUT, CUT2, INFLUENCE } = await import(WT + "/deliverables/20261005/comps-c6/outliers.mjs");
const { ROWS, isValuation, GROWTH_CREDIT_MAX, MARGIN_GATE, REIT_PRIOR } = await import(WT + "/deliverables/20261003/comps-c5/field.mjs");
const { referenceOf, withReference, withReferenceQuotes, REFERENCE_JOB } = await import(WT + "/deliverables/20261003/comps-c5/reference.mjs");
const SB = "https://wadinxqplrggagkvrdag.supabase.co", KEY = readFileSync(".anon", "utf8").trim(), TODAY = process.env.CP1_TODAY || "2026-10-06";
const CACHE = new Map();
const pg0 = async (p) => { if (CACHE.has(p)) return CACHE.get(p); for (let a = 0; a < 4; a++) { try { const r = await fetch(SB + "/rest/v1/" + p, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } }); if (!r.ok) throw new Error(p.split("?")[0] + " → " + r.status); const j = await r.json(); CACHE.set(p, j); return j; } catch (e) { if (a === 3) throw e; await new Promise((r) => setTimeout(r, 1500 * (a + 1))); } } };
const fetchJson = async (u) => JSON.parse(readFileSync(path.join(WT, u), "utf8"));
/* THE PRICE: the session's own completed close (chart API: today_session_close, state COMPLETED), captured once for the
   whole universe so every set of every name is on the same settled close. */
const RAW = JSON.parse(readFileSync("quotes-all-raw.json", "utf8"));
const settle = (q) => (q && q.today_session_close_state === "COMPLETED" && q.today_session_close > 0 ? { price: q.today_session_close, price_observation_utc: q.today_session_et + "T20:00:00Z", price_is: "session close " + q.today_session_et, last: q.price } : q && q.price > 0 ? { price: q.price, price_observation_utc: q.price_observation_utc, price_is: "latest trade", last: q.price } : null);
const quotes0 = async (T) => ({ quotes: Object.fromEntries(T.map((t) => [t, settle(RAW.quotes[t])]).filter(([, q]) => q)) });
/* the reference peers' facts, when the coordinator has run the Fly job (none on file → they are listed, never priced) */
const refDir = WT + "/deliverables/20261003/comps-c5", refFile = readdirSync(refDir).filter((f) => /^reference-peers-facts-.*\.json$/.test(f)).sort().pop() || null;
const FACTS = refFile ? JSON.parse(readFileSync(path.join(refDir, refFile), "utf8")) : null, REF = referenceOf(FACTS);
const pg = FACTS ? withReference(pg0, FACTS) : pg0, quotes = FACTS ? withReferenceQuotes(quotes0, FACTS) : quotes0;
const fxStandin = JSON.parse(readFileSync(WT + "/deliverables/20261001/comps-template/fx-standin-ecb-2026-10-01.json", "utf8"));
fxStandin.reported = JSON.parse(readFileSync(WT + "/deliverables/20261003/comps-c5b/reporting-currency-fmp-2026-10-03.json", "utf8")).reported;
const inp = await c4inputs({ pg: pg0, fetchJson });
inp.segments = JSON.parse(readFileSync(WT + "/deliverables/20261003/comps-c5/segments-2026-10-03.json", "utf8")).companies;
inp.reference = REF.peers;
/* the funds with EVERY row the holdings file names (served or not), for the shared-fund vote of an unserved peer */
{ const tree = JSON.parse(readFileSync(WT + "/deliverables/20260929/tree-map/tree.json", "utf8")), nodes = Array.isArray(tree.nodes) ? tree.nodes : Object.values(tree.nodes);
  const top = Object.fromEntries(nodes.filter((n) => n.kind === "fund" && n.holdings).map((n) => [n.ticker, n.holdings]));
  inp.funds = inp.funds.map((f) => { const h = top[f.ticker] || {}; const all = new Map(f.holdings.map(([s, w]) => [String(s).toUpperCase(), w])); for (const r of h.top || []) if (r.ticker) all.set(String(r.ticker).toUpperCase(), r.weight_pct); return { ...f, all: [...all], count: h.count_in_fund || f.holdings.length, as_of: h.as_of || null, rows_in_file: h.rows_in_file || null }; }); }
console.log("inputs ready: profiles", Object.keys(inp.profiles).length, "· funds", inp.funds.length, "· reference facts", refFile || "none on file", "· closes", Object.keys(RAW.quotes).length, "fetched", RAW.fetched_utc);
const NAMES = "MU SNDK WDC STX AVGO NVDA LRCX AMAT VST CEG GOOGL AMZN ORCL EQIX DLR IRM LLY JPM BAC NBIS IREN CRWV BE CRDO COHR AME".split(" ");
const syms = process.argv.slice(2).length ? process.argv.slice(2).map((s) => s.toUpperCase()) : NAMES;
const FIXTURES = ["MU", "EQIX", "BE", "GOOGL", "AVGO", "VST"];
const OUT = "comps-before-after.json", out = existsSync(OUT) && process.argv.slice(2).length ? JSON.parse(readFileSync(OUT, "utf8")) : {};
const r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100), r1 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
const SNAPS = new Map();
async function snapOf(T, set) {
  const served = { ...set, kept: set.kept.filter((r) => !r.reference || r.has_figures) }, key = T + "|" + served.kept.map((r) => r.ticker).join(",");
  if (SNAPS.has(key)) return SNAPS.get(key);
  const ctx = await readSet(T, served, { today: TODAY, pg, quotes, fxStandin }), snap = snapshotFromCohort(ctx, T);
  const estRows = await pg(`analyst_estimates?select=ticker,fiscal_date,est_eps_avg&period=eq.annual&ticker=in.(${ctx.members.map(encodeURIComponent).join(",")})&fiscal_date=gte.${TODAY}&order=ticker.asc,fiscal_date.asc`);
  const estimates = Object.fromEntries(ctx.inputs.map((i) => [i.ticker, { eps_ttm: i.eps_ttm ?? null, est: estRows.filter((e) => e.ticker === i.ticker).map((e) => ({ fiscal_date: e.fiscal_date, eps: e.est_eps_avg })) }]));
  const v = { snap, estimates }; SNAPS.set(key, v); return v;
}
const AT = "2026-10-06T23:59:00.000Z";
async function price(T, set, label, { fx = CP1_NONE, off = [] } = {}) {
  const pricedPeers = set.kept.filter((r) => !r.reference || r.has_figures);
  if (!pricedPeers.length) return { label, ok: false, n: 0, reason: "no peers" };
  const { snap, estimates } = await snapOf(T, set);
  const dec = off.map((t) => ({ company: T, peer: t, measure: "ALL", off: true, reason: "not the same business (same-business read)", set_by: "cp1-same", set_at: AT }));
  const C = conclusion6(snap, dec, estimates, TODAY, "C", { set, fx });
  const c6 = C.c6, b = c6.business, band = (x) => (x ? { lo: r2(x.lo), centre: r2(x.mid), hi: r2(x.hi) } : null), up = (x) => (x && snap.price > 0 ? r1((x.mid / snap.price - 1) * 100) : null);
  const mw = C.measureWeights || { weights: {}, parts: {} }, keys = C.rows.filter((r) => isValuation(r.key)).map((r) => r.key);
  return { label, ok: true, price: snap.price, n: pricedPeers.length - off.length, peers_in: c6.peers.length - c6.outliers.length,
    outliers: c6.outliers.map((t) => ({ ticker: t, how: (c6.dominating || []).some((d) => d.ticker === t) ? "dominates" : c6.score[t].consistent ? "consistent" : "rule", words: (c6.dominating || []).some((d) => d.ticker === t) ? `the centre moves ${((c6.dominating.find((d) => d.ticker === t).shift) * 100).toFixed(0)}% without it` : c6.score[t].words })),
    flagged_not_cut: c6.notCut || [], cells_out: (C.outliers || []).filter((o) => o.excluded).map((o) => ({ ticker: o.ticker, key: o.key, multiple: r2(o.multiple), side: o.side })),
    business: b ? { line: b.line, same: b.same.length, n: b.n, mostlyDifferent: !!b.mostlyDifferent } : null,
    band: band(C.band), upside_pct: up(C.band), reason: C.reason || null, no_peer_set: !!c6.noPeerSet, self: c6.self ? { n: c6.self.n, have: c6.self.have, outlier: c6.self.outlier, words: c6.self.words } : null,
    band_from_peers: band(c6.bandFromPeers), upside_from_peers: up(c6.bandFromPeers), band_with_outliers: band(c6.withOutliers && c6.withOutliers.band),
    distances: Object.fromEntries(c6.peers.map((t) => [t, { flags: c6.score[t].n, have: c6.score[t].have, side: c6.score[t].side ?? null, d: Object.fromEntries(Object.entries(c6.cols).filter(([k, c]) => ROWS.includes(k) && c.judged && c.cells[t]).map(([k, c]) => [k, r1(c.cells[t].d)])) }])),
    priced_on: c6.pricedOn || "set", business_peers: c6.businessPeers || null, not_priced: c6.notPriced || [], fragile: c6.fragile ? { n: c6.fragile.n, of: c6.fragile.of, words: c6.fragile.words } : null,
    whole_set: c6.wholeSet ? { band: band(c6.wholeSet.bandFromPeers || c6.wholeSet.band), upside_pct: up(c6.wholeSet.bandFromPeers || c6.wholeSet.band), no_peer_set: !!c6.wholeSet.noPeerSet, self: c6.wholeSet.self ? c6.wholeSet.self.words : null, outliers: c6.wholeSet.outliers || [], fragile: c6.wholeSet.fragile ? c6.wholeSet.fragile.words : null } : null,
    cp1: C.cp1 ? { reit: !!C.cp1.reit, growth: C.cp1.growth ? { own: r1(C.cp1.growth.own), peers: r1(C.cp1.growth.peers), ratio: r2(C.cp1.growth.ratio), credit: r2(C.cp1.growth.credit), why: C.cp1.growth.why || null } : null, margin: C.cp1.margin ? { own: r1(C.cp1.margin.own), peers: r1(C.cp1.margin.peers), ratio: r2(C.cp1.margin.ratio), off: !!C.cp1.margin.off, why: C.cp1.margin.why || null } : null } : null,
    rows: Object.fromEntries(keys.map((k) => { const r = C.rows.find((x) => x.key === k), e = (r && r.ends) || {}, p = mw.parts[k] || {}; const px = (q) => r2(r && r.ok && e[q] ? e[q].price : null);
      return [k, { label: r.label, own: r2(r.own && r.own.multiple), median: r2(r.band && r.band.median), n: r.n || 0, ok: !!r.ok, price: px("median"), q1: px("q1"), q3: px("q3"), weight: r2(mw.weights[k]), prior: r2(p.prior), credit: p.credit ? r2(p.credit) : null, off: p.off || null }]; })),
    multiples: Object.fromEntries([T, ...pricedPeers.map((r) => r.ticker)].map((t) => [t, Object.fromEntries(keys.map((k) => { const r = C.rows.find((x) => x.key === k); return [k, r2(t === T ? (r.own && r.own.multiple) : (r.values && r.values[t] ? r.values[t].multiple : null))]; }))])),
    table: Object.fromEntries([[T, snap.table.company], ...pricedPeers.map((r) => [r.ticker, snap.table.peers[r.ticker] || null])].map(([t, row]) => [t, row ? { rev_g_ttm: r1(row.rev_g_ttm), rev_g_fy: r1(row.rev_g_fy), rev_g_2y: r1(row.rev_g_2y), eps_g_fy: r1(row.eps_g_fy), eps_g_2y: r1(row.eps_g_2y), gm: r1(row.gm), om: r1(row.om), p_ffo: r2(row.p_ffo), ffo_ps: r2(row.ffo_ps), nd_ebitda: r2(row.nd_ebitda) } : null])),
    eps_fy1: r2(snap.eps_fy1), fy1_date: snap.fy1_date || null, eps_fy2: r2(snap.eps_fy2), fy2_date: snap.fy2_date || null, eps_ttm: r2(snap.eps_ttm) };
}
const peerRow = (r) => ({ ticker: r.ticker, name: r.name || (inp.profiles[r.ticker] || {}).name || null, same_business: r.same_business ?? (r.exact >= SIM_MIN), exact: r2(r.exact), sim: r2(r.sim), score: r2(r.score), ratio: r2(r.ratio), added: !!r.added, reference: !!r.reference, has_figures: r.reference ? !!r.has_figures : true, seat: r.seat || null, why: r.why, line_source: r.line_source || null });
async function one(T) {
  try {
    const set0 = buildSet(T, inp, { fx: CP1_LINES_OFF }), set1 = buildSet(T, inp, { fx: CP1_LINES_ON });
    const BEFORE = await price(T, set0, "before"), SETONLY = await price(T, set1, "set only"), AFTER = await price(T, set1, "after", { fx: CP1_ALL });
    const same = set1.kept.filter((r) => r.same_business && (!r.reference || r.has_figures)).map((r) => r.ticker), notSame = set1.kept.filter((r) => !r.same_business && !r.reference).map((r) => r.ticker);
    const SAME = same.length >= 2 ? await price(T, set1, "same business only", { fx: CP1_ALL, off: notSame }) : { label: "same business only", ok: false, n: same.length, reason: same.length ? "one same-business peer: a range needs two" : "no same-business peer in the universe" };
    /* what each fix does ALONE, on top of the peer change (the set as complemented, every other switch off) */
    const alone = {};
    for (const k of ["priceOnBusiness", "growthCredit", "reitYardstick", "marginGate", "cellRule", "consistency", "influence", "selfOutlier"]) { const x = await price(T, set1, k, { fx: { ...CP1_NONE, ...CP1_LINES_ON, [k]: true } }); alone[k] = { upside_pct: x.upside_pct, centre: x.band ? x.band.centre : null, no_peer_set: !!x.no_peer_set, changed: x.upside_pct !== SETONLY.upside_pct || !!x.no_peer_set }; }
    /* the offline fixtures the tests run on (tests/comps-cp1.test.mjs): the two sets with their snapshots and estimates */
    if (FIXTURES.includes(T)) { const b0 = await snapOf(T, set0), a1 = await snapOf(T, set1), sameSnap = b0 === a1; mkdirSync("fixtures", { recursive: true });
      const slim = (set) => ({ ...set, dropped: undefined, members: undefined, named_not_in: undefined, kept: set.kept.map((r) => ({ ticker: r.ticker, exact: r.exact, sim: r.sim, score: r.score, ratio: r.ratio, same_business: r.same_business, added: r.added, reference: r.reference, has_figures: r.has_figures, seat: r.seat })) });
      writeFileSync(`fixtures/set-${T}-cp1-${TODAY}.json`, JSON.stringify({ today: TODAY, ticker: T, set_before: slim(set0), set_after: slim(set1), before: b0, after: sameSnap ? "same as before" : a1, expect: { before_upside_pct: BEFORE.upside_pct, after_upside_pct: AFTER.upside_pct, after_centre: AFTER.band ? AFTER.band.centre : null, no_peer_set: AFTER.no_peer_set, priced_on: AFTER.priced_on } })); }
    const P = inp.profiles[T] || {};
    const votes = Object.fromEntries(set1.kept.filter((r) => r.added || r.reference).map((r) => [r.ticker, votesFor(T, r.ticker, inp, { also: (REFERENCE_PEERS[r.ticker] || {}).also || [] })]));
    out[T] = { ok: true, name: P.name || null, industry: P.industry || null, sector: P.sector || null, market_cap: P.market_cap || null,
      lines_before: lineWords(set0.own_lines), lines_after: lineWords(set1.own_lines), lines_from: set1.lines_from,
      set_before: set0.kept.map((r) => ({ ...peerRow(r), same_business: r.exact >= SIM_MIN })), set_after: set1.kept.map(peerRow), added: set1.added || [], reference: set1.reference || [], same: set1.same || null, votes,
      before: BEFORE, set_only: SETONLY, after: AFTER, same_only: SAME, alone };
    const f = (x) => (x && x.band ? `${x.band.centre} (${x.upside_pct >= 0 ? "+" : ""}${x.upside_pct}%)${x.priced_on === "business" ? "[biz " + x.n + "p]" : ""}${x.fragile ? "[fragile " + x.fragile.n + "]" : ""}` : x && x.no_peer_set ? "NO PEER SET" + (x.band_from_peers ? " (peers say " + x.band_from_peers.centre + ")" : "") : "—");
    console.log(`${T.padEnd(5)} $${BEFORE.price} · before ${BEFORE.n}p ${f(BEFORE)} · set ${SETONLY.n}p ${f(SETONLY)} · after ${AFTER.n}p ${f(AFTER)} · same ${SAME.n}p ${f(SAME)} · added ${(set1.added || []).join(" ") || "none"}${(set1.reference || []).length ? " + ref " + set1.reference.join(" ") : ""} · out ${AFTER.outliers.map((o) => o.ticker + "(" + o.how[0] + ")").join(" ") || "none"} · cells ${AFTER.cells_out.length}${AFTER.cp1 && AFTER.cp1.growth && AFTER.cp1.growth.credit > 1 ? " · PEG×" + AFTER.cp1.growth.credit : ""}${AFTER.cp1 && AFTER.cp1.margin && AFTER.cp1.margin.off ? " · sales rows off" : ""}${AFTER.cp1 && AFTER.cp1.reit ? " · reit" : ""}`);
  } catch (e) { out[T] = { ok: false, error: String((e && e.stack) || e).slice(0, 900) }; console.log(`${T.padEnd(5)} FAILED ${out[T].error}`); }
  writeFileSync(OUT, JSON.stringify(out, null, 1));
}
for (const T of syms) await one(T);
writeFileSync("comps-run-meta.json", JSON.stringify({ run_utc: new Date().toISOString(), today: TODAY, price_is: "the 6 Oct 2026 regular-session close (chart API /quotes: today_session_close, state COMPLETED), captured " + RAW.fetched_utc,
  comps_code: "hub/cp1-comps-cards-20261006 on top of hub/c6b-outliers-price-only-20261005 @3816158 (C5 lines + C5b one currency + C6b price-only outliers)", universe: { count: RAW.universe_count, sha256: RAW.universe_sha256 },
  switches: CP1_ALL, constants: { SIM_MIN, SAME_MIN, CUT, CUT2, INFLUENCE, GROWTH_CREDIT_MAX, MARGIN_GATE, REIT_PRIOR }, reference: { file: refFile, carried: Object.keys(REF.peers), missing: REF.missing, job: REFERENCE_JOB }, names: syms }, null, 1));
console.log("DONE", Object.values(out).filter((o) => o.ok).length, "ok of", Object.keys(out).length);

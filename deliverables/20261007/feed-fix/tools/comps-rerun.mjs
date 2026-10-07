/* FD1 · the comps system re-run, headless, on the same settled closes CP1 used (6 Oct 2026), for two questions:
     ITEM 4  growth measured from one forecast year to the next: each name under CP1's twelve switches (CP1_ALL) and under
             FD1_ALL (the same twelve plus growthForward), with the growth each company and its peers carry both ways.
     ITEM 3  the memory names with the foreign reference peers: pass --facts <reference-peers-facts.json> and SK hynix,
             Samsung and Kioxia are priced beside the set (C5b one currency); without it they are listed, never priced.
   It is CP1's own runner (deliverables/20261006/decision-cards/tools/comps-run.mjs) with the switches as a list:
   the same reads (the Hub's public tables through its public read key), the same closes (quotes-all-raw.json), the
   same code. Read-only. Run from a folder holding `.anon` and CP1's `quotes-all-raw.json`:
     node comps-rerun.mjs --out <file.json> [--facts <facts.json>] [--today 2026-10-06] TICKER … */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)), WT = path.resolve(HERE, "../../../..");
const { inputs: c4inputs, readSet, snapshotFromCohort } = await import(WT + "/deliverables/20261001/comps-mechanic/read.mjs");
const { buildSet, votesFor, CP1_LINES_OFF, CP1_LINES_ON, REFERENCE_PEERS, SIM_MIN } = await import(WT + "/deliverables/20261003/comps-c5/lines.mjs");
const { conclusion6, CP1_ALL, CP1_NONE, FD1_ALL, FD1_ALL_LAST } = await import(WT + "/deliverables/20261005/comps-c6/outliers.mjs");
const { isValuation, pegGrowth, wquantile } = await import(WT + "/deliverables/20261003/comps-c5/field.mjs");
const { referenceOf, withReference, withReferenceQuotes } = await import(WT + "/deliverables/20261003/comps-c5/reference.mjs");
const argv = process.argv.slice(2), opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const OUT = opt("--out", "comps-rerun.json"), TODAY = opt("--today", "2026-10-06"), factsArg = opt("--facts");
const syms = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && ["--out", "--facts", "--today"].includes(argv[i - 1]))).map((s) => s.toUpperCase());
const SB = "https://wadinxqplrggagkvrdag.supabase.co", KEY = readFileSync(".anon", "utf8").trim(), CACHE = new Map();
const pg0 = async (p) => { if (CACHE.has(p)) return CACHE.get(p); for (let a = 0; a < 4; a++) { try { const r = await fetch(SB + "/rest/v1/" + p, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } }); if (!r.ok) throw new Error(p.split("?")[0] + " → " + r.status); const j = await r.json(); CACHE.set(p, j); return j; } catch (e) { if (a === 3) throw e; await new Promise((r) => setTimeout(r, 1500 * (a + 1))); } } };
const fetchJson = async (u) => JSON.parse(readFileSync(path.join(WT, u), "utf8"));
const RAW = JSON.parse(readFileSync("quotes-all-raw.json", "utf8"));
const settle = (q) => (q && q.today_session_close_state === "COMPLETED" && q.today_session_close > 0 ? { price: q.today_session_close, price_observation_utc: q.today_session_et + "T20:00:00Z" } : q && q.price > 0 ? { price: q.price, price_observation_utc: q.price_observation_utc } : null);
const quotes0 = async (T) => ({ quotes: Object.fromEntries(T.map((t) => [t, settle(RAW.quotes[t])]).filter(([, q]) => q)) });
/* the reference peers' facts: the file given, else the newest one beside the comps code, else none */
const refDir = WT + "/deliverables/20261003/comps-c5", refFile = factsArg || (readdirSync(refDir).filter((f) => /^reference-peers-facts-.*\.json$/.test(f)).sort().map((f) => path.join(refDir, f)).pop() || null);
const FACTS = refFile && existsSync(refFile) ? JSON.parse(readFileSync(refFile, "utf8")) : null, REF = referenceOf(FACTS);
const pg = FACTS ? withReference(pg0, FACTS) : pg0, quotes = FACTS ? withReferenceQuotes(quotes0, FACTS) : quotes0;
const fxStandin = JSON.parse(readFileSync(WT + "/deliverables/20261001/comps-template/fx-standin-ecb-2026-10-01.json", "utf8"));
fxStandin.reported = JSON.parse(readFileSync(WT + "/deliverables/20261003/comps-c5b/reporting-currency-fmp-2026-10-03.json", "utf8")).reported;
if (FACTS && FACTS.fx) { fxStandin.rates = { ...(fxStandin.rates || {}) }; for (const [c, rows] of Object.entries(FACTS.fx)) if (rows && rows.length && !(fxStandin.rates[c] && fxStandin.rates[c].length)) fxStandin.rates[c] = rows; for (const [t, c] of Object.entries(REF.peers)) fxStandin.reported[t] = c.currency; }
const inp = await c4inputs({ pg: pg0, fetchJson });
inp.segments = JSON.parse(readFileSync(WT + "/deliverables/20261003/comps-c5/segments-2026-10-03.json", "utf8")).companies; inp.reference = REF.peers;
{ const tree = JSON.parse(readFileSync(WT + "/deliverables/20260929/tree-map/tree.json", "utf8")), nodes = Array.isArray(tree.nodes) ? tree.nodes : Object.values(tree.nodes);
  const top = Object.fromEntries(nodes.filter((n) => n.kind === "fund" && n.holdings).map((n) => [n.ticker, n.holdings]));
  inp.funds = inp.funds.map((f) => { const h = top[f.ticker] || {}; const all = new Map(f.holdings.map(([s, w]) => [String(s).toUpperCase(), w])); for (const r of h.top || []) if (r.ticker) all.set(String(r.ticker).toUpperCase(), r.weight_pct); return { ...f, all: [...all], count: h.count_in_fund || f.holdings.length, as_of: h.as_of || null, rows_in_file: h.rows_in_file || null }; }); }
console.log("inputs ready · profiles", Object.keys(inp.profiles).length, "· reference facts", refFile ? path.basename(refFile) + " (" + Object.keys(REF.peers).join(" ") + (REF.missing.length ? "; missing " + REF.missing.join(" ") : "") + ")" : "none on file", "· closes fetched", RAW.fetched_utc, "· today", TODAY);
const r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100), r1 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
const SNAPS = new Map(), FIXTURES = (process.env.FD1_FIXTURES || "LLY,VST,MU").split(",");   /* the offline sets of tests/fd1-growth-forward.test.mjs; FD1_FIXTURES=… names others */
async function snapOf(T, set) {
  const served = { ...set, kept: set.kept.filter((r) => !r.reference || r.has_figures) }, key = T + "|" + served.kept.map((r) => r.ticker).join(",");
  if (SNAPS.has(key)) return SNAPS.get(key);
  const ctx = await readSet(T, served, { today: TODAY, pg, quotes, fxStandin }), snap = snapshotFromCohort(ctx, T);
  /* the estimate years from the one just reported (400 days back) on: the trailing and forecast rules read only the rows
     from today on, as before; growthFromLastYear reads the newest row before today */
  const since = new Date(Date.parse(TODAY + "T00:00:00Z") - 400 * 86400e3).toISOString().slice(0, 10);
  const estRows = await pg(`analyst_estimates?select=ticker,fiscal_date,est_eps_avg&period=eq.annual&ticker=in.(${ctx.members.map(encodeURIComponent).join(",")})&fiscal_date=gte.${since}&order=ticker.asc,fiscal_date.asc`);
  const estimates = Object.fromEntries(ctx.inputs.map((i) => [i.ticker, { eps_ttm: i.eps_ttm ?? null, est: estRows.filter((e) => e.ticker === i.ticker).map((e) => ({ fiscal_date: e.fiscal_date, eps: e.est_eps_avg })) }]));
  const v = { snap, estimates, ctx }; SNAPS.set(key, v); return v;
}
async function price(T, set, label, fx) {
  const pricedPeers = set.kept.filter((r) => !r.reference || r.has_figures);
  if (!pricedPeers.length) return { label, ok: false, n: 0, reason: "no peers" };
  const { snap, estimates } = await snapOf(T, set), C = conclusion6(snap, [], estimates, TODAY, "C", { set, fx });
  const c6 = C.c6, band = (x) => (x ? { lo: r2(x.lo), centre: r2(x.mid), hi: r2(x.hi) } : null), up = (x) => (x && snap.price > 0 ? r1((x.mid / snap.price - 1) * 100) : null);
  const wayC = (C.ways || []).find((w) => w.way === "C") || null;
  const mw = C.measureWeights || { weights: {}, parts: {} }, keys = C.rows.filter((r) => isValuation(r.key)).map((r) => r.key), peg = C.rows.find((r) => r.key === "peg");
  const foreign = (t) => { const f = t === T ? snap.fx : snap.fx_peers && snap.fx_peers[t]; return !!(f && f.currency && f.currency !== "USD"); };
  const gOf = (t) => { const a = pegGrowth(estimates[t], TODAY, { consensusOnly: foreign(t) }), b = pegGrowth(estimates[t], TODAY, { consensusOnly: true }), c = pegGrowth(estimates[t], TODAY, { consensusOnly: true, fromLast: true }); return { trailing: a ? r1(a.pct) : null, trailing_basis: a ? a.basis : null, forecast: b ? r1(b.pct) : null, forecast_basis: b ? b.basis : null, last_year: c ? r1(c.pct) : null, last_year_basis: c ? c.basis : null }; };
  return { label, ok: true, price: snap.price, n: pricedPeers.length, peers_in: c6.peers.length - c6.outliers.length, priced_on: c6.pricedOn || "set", business_peers: c6.businessPeers || null, not_priced: c6.notPriced || [],
    outliers: c6.outliers, band: band(C.band), upside_pct: up(C.band), no_peer_set: !!c6.noPeerSet, reason: C.reason || null, fragile: c6.fragile ? c6.fragile.words : null,
    whole_set: c6.wholeSet ? { band: band(c6.wholeSet.bandFromPeers || c6.wholeSet.band), upside_pct: up(c6.wholeSet.bandFromPeers || c6.wholeSet.band) } : null,
    growth_credit: C.cp1 && C.cp1.growth ? { own: r1(C.cp1.growth.own), peers: r1(C.cp1.growth.peers), n: C.cp1.growth.n, ratio: r2(C.cp1.growth.ratio), credit: r2(C.cp1.growth.credit), from: C.cp1.growth.from || null, why: C.cp1.growth.why || null } : null,
    peg_basis: peg ? peg.basis : null,
    /* THE READINGS BEHIND THE CENTRE (way C): every priced peer's multiple on every weighed yardstick is one implied price
       for the company, with its weight; the centre is their weighted median. per_peer: the weighted median of ONE peer's
       readings — what the company would be worth on that peer alone. Arithmetic on the figures held; no peer is invented. */
    points: wayC && wayC.ok ? wayC.points.map((p) => ({ key: p.key, peer: p.ticker, multiple: r2(p.multiple), price: r2(p.price), upside_pct: r1((p.price / snap.price - 1) * 100), weight: Math.round(p.w * 1000) / 1000 })).sort((a, b) => a.price - b.price) : [],
    per_peer: wayC && wayC.ok ? Object.fromEntries([...new Set(wayC.points.map((p) => p.ticker))].map((t) => { const mine = wayC.points.filter((p) => p.ticker === t), mid = wquantile(mine, 0.5); return [t, { readings: mine.length, centre: r2(mid), upside_pct: r1((mid / snap.price - 1) * 100), weight: Math.round(mine.reduce((a, p) => a + p.w, 0) * 1000) / 1000 }]; })) : {},
    rows: Object.fromEntries(keys.map((k) => { const r = C.rows.find((x) => x.key === k), e = (r && r.ends) || {}, p = mw.parts[k] || {}; return [k, { label: r.label, own: r2(r.own && r.own.multiple), median: r2(r.band && r.band.median), n: r.n || 0, ok: !!r.ok, price: r2(r && r.ok && e.median ? e.median.price : null), weight: r2(mw.weights[k]), credit: p.credit ? r2(p.credit) : null, off: p.off || null }]; })),
    multiples: Object.fromEntries([T, ...pricedPeers.map((r) => r.ticker)].map((t) => [t, Object.fromEntries(keys.map((k) => { const r = C.rows.find((x) => x.key === k); return [k, r2(t === T ? (r.own && r.own.multiple) : (r.values && r.values[t] ? r.values[t].multiple : null))]; }))])),
    growth: Object.fromEntries([T, ...pricedPeers.map((r) => r.ticker)].map((t) => [t, gOf(t)])),
    fx: Object.fromEntries([T, ...pricedPeers.map((r) => r.ticker)].map((t) => { const f = t === T ? snap.fx : snap.fx_peers && snap.fx_peers[t]; return [t, f && f.currency && f.currency !== "USD" ? { currency: f.currency, converted: !!f.converted, withheld: !!f.withheld, why: f.why || null } : null]; }).filter(([, v]) => v)),
    eps_fy1: r2(snap.eps_fy1), fy1_date: snap.fy1_date || null, eps_fy2: r2(snap.eps_fy2), fy2_date: snap.fy2_date || null, eps_ttm: r2(snap.eps_ttm) };
}
const out = { run_utc: new Date().toISOString(), today: TODAY, price_is: "the 6 Oct 2026 regular-session close (chart API /quotes, captured by CP1 " + RAW.fetched_utc + ")", reference: { file: refFile ? path.basename(refFile) : null, taken: REF.taken, carried: Object.keys(REF.peers), missing: REF.missing }, names: {} };
for (const T of syms) {
  try {
    const set0 = buildSet(T, inp, { fx: CP1_LINES_OFF }), set1 = buildSet(T, inp, { fx: CP1_LINES_ON });
    const before = await price(T, set0, "as the comps system stands (C6b)", CP1_NONE), cp1 = await price(T, set1, "CP1's twelve switches on", CP1_ALL), fd1 = await price(T, set1, "the same, growth from one forecast year to the next", FD1_ALL), last = await price(T, set1, "the same, growth from the year just reported (analysts' basis)", FD1_ALL_LAST);
    if (FIXTURES.includes(T) && !FACTS) { const a1 = await snapOf(T, set1); mkdirSync("fixtures", { recursive: true });
      const slim = (set) => ({ ...set, dropped: undefined, members: undefined, named_not_in: undefined, kept: set.kept.map((r) => ({ ticker: r.ticker, exact: r.exact, sim: r.sim, score: r.score, ratio: r.ratio, same_business: r.same_business, added: r.added, reference: r.reference, has_figures: r.has_figures, seat: r.seat })) });
      writeFileSync(`fixtures/set-${T}-fd1-${TODAY}.json`, JSON.stringify({ today: TODAY, ticker: T, set_after: slim(set1), after: { snap: a1.snap, estimates: a1.estimates }, expect: { cp1_upside_pct: cp1.upside_pct, fd1_upside_pct: fd1.upside_pct, last_upside_pct: last.upside_pct, cp1_credit: cp1.growth_credit, fd1_credit: fd1.growth_credit, last_credit: last.growth_credit } })); }
    const peer = (r) => ({ ticker: r.ticker, name: r.name || (inp.profiles[r.ticker] || {}).name || (REFERENCE_PEERS[r.ticker] || {}).name || null, same_business: r.same_business ?? (r.exact >= SIM_MIN), added: !!r.added, reference: !!r.reference, has_figures: r.reference ? !!r.has_figures : true });
    out.names[T] = { ok: true, name: (inp.profiles[T] || {}).name || null, set_before: set0.kept.map((r) => r.ticker), set_after: set1.kept.map(peer), reference: set1.reference || [], votes: Object.fromEntries(set1.kept.filter((r) => r.reference).map((r) => [r.ticker, votesFor(T, r.ticker, inp, { also: (REFERENCE_PEERS[r.ticker] || {}).also || [] })])), before, cp1, fd1, last };
    const f = (x) => (x && x.band ? `${x.band.centre} (${x.upside_pct >= 0 ? "+" : ""}${x.upside_pct}%)${x.priced_on === "business" ? "[biz " + (x.business_peers || []).join(" ") + "]" : ""}` : x && x.no_peer_set ? "NO PEER SET" : "—");
    console.log(`${T.padEnd(5)} $${before.price} · C6b ${f(before)} · CP1 ${f(cp1)} · FD1 ${f(fd1)} · LAST ${f(last)} (${last.growth_credit ? last.growth_credit.own + " vs " + last.growth_credit.peers + " ×" + last.growth_credit.credit : "—"}) · credit CP1 ${cp1.growth_credit ? cp1.growth_credit.own + " vs " + cp1.growth_credit.peers + " ×" + cp1.growth_credit.credit : "—"} → FD1 ${fd1.growth_credit ? fd1.growth_credit.own + " vs " + fd1.growth_credit.peers + " ×" + fd1.growth_credit.credit : "—"}${(set1.reference || []).length ? " · ref " + set1.kept.filter((r) => r.reference).map((r) => r.ticker + (r.has_figures ? "✓" : "∅")).join(" ") : ""}`);
  } catch (e) { out.names[T] = { ok: false, error: String((e && e.stack) || e).slice(0, 900) }; console.log(`${T.padEnd(5)} FAILED ${out.names[T].error}`); }
  writeFileSync(OUT, JSON.stringify(out, null, 1));
}
console.log("DONE →", OUT);

/* U3 (2 Oct 2026) · the served-set rule, Alan's way — the builder. Reads the dated snapshots in data/ (the same files U2 used,
   plus the daily closes fetched by fetch-returns.mjs), runs maths.mjs, writes measure.json (every chart and table on the
   page) and served-set-v2.json (the rule, the Hub / off-Hub sets, the in / out lists). Nothing live is read or written.
   Usage: node deliverables/20261002/served-set-v2/build.mjs   (from the Hub root) */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { norm, sorted, blend, curve, point, tracks, returnsFit, overlapRule, TOL_CLOSE, TOL_LIVE, PASS_SHARE, R2_CLOSE, R2_LIVE, RETURN_DAYS } from "./maths.mjs";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, "../../..");
const J = (p) => JSON.parse(readFileSync(p, "utf8"));
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);
const r1 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10) / 10);

const SEVEN = J(join(DIR, "data/seven-20261001.json"));
const DAILY = J(join(DIR, "data/daily-three-rung-5d.json"));
const HOLD = J(join(DIR, "data/holdings-20260926.json"));
const HUB = J(join(DIR, "data/hub-geiger-20261002.json"));
const UL = J(join(DIR, "data/universe-and-lists.json"));
const CLOSES = J(join(DIR, "data/daily-closes-20261002.json"));
const TREE = J(join(ROOT, "deliverables/20260929/tree-map/tree.json"));
const U2 = J(join(ROOT, "deliverables/20261002/served-set/served-set.json"));

/* ── readings: the main reading is the seven-rung close composite (1 Oct close); the draws are its seven rungs and the five
      daily three-rung closes, 12 in all — the same draws U2 used ── */
const seven = new Map(); const sevenRow = new Map();
for (const [t, c, tr, mo, ls, kind, rc, rungs] of SEVEN.rows) { const k = norm(t); seven.set(k, c); sevenRow.set(k, { composite: c, last_session: ls, kind, rungs }); }
const RUNG_KEYS = ["3h", "4h", "6h", "12h", "1d", "3d", "1w"];
const rungReading = RUNG_KEYS.map((rk) => { const m = new Map(); for (const [t, , , , , , , rungs] of SEVEN.rows) if (rungs && rungs[rk] != null) m.set(norm(t), rungs[rk]); return (x) => m.get(x) ?? null; });
const dailyReading = DAILY.dates.map((d, i) => { const m = new Map(); for (const [t, arr] of Object.entries(DAILY.rows)) if (arr[i] != null) m.set(norm(t), arr[i]); return (x) => m.get(x) ?? null; });
const draws = [...rungReading, ...dailyReading];
const drawLabels = [...RUNG_KEYS.map((k) => "1 Oct close, rung " + k), ...DAILY.dates.map((d) => "3-rung close " + d)];
const main = (x) => seven.get(x) ?? null;
const closes = CLOSES.closes;

/* ── the tree, the universe, the lists ── */
const nodes = TREE.nodes;
const fundNodes = nodes.filter((n) => n.kind === "fund");
const fundInfo = Object.fromEntries(fundNodes.map((n) => [norm(n.ticker), n]));
const funds = new Set(fundNodes.map((n) => norm(n.ticker)));
const universe = new Set(UL.universe.map(norm));
const todayNames = [...universe].filter((t) => !funds.has(t));
const label = Object.fromEntries(nodes.filter((n) => n.ticker).map((n) => [norm(n.ticker), n.label]));
const lists = { LIKED: UL.liked.map(norm), FAVORITES: UL.favorites.map(norm), RADAR: UL.radar.map(norm) };
const onList = new Map(); for (const [name, arr] of Object.entries(lists)) for (const t of arr) { if (!onList.has(t)) onList.set(t, []); onList.get(t).push(name); }

/* ── which funds follow which rule ── */
const measuredFunds = Object.keys(HOLD.funds).map(norm);
const DECLARED_EQUAL = new Set(["RSP", "QQEW", "XRT", "XHB", "KRE", "KBE", "XOP", "XPH"]);   // equal-weight by construction (issuer method)
const VERY_BROAD = new Set(["IWM"]);                                                        // Alan: "for IWM it would be too many tickers"
const TOTAL_MARKET = new Set(["VTI", "ITOT", "IWV", "VT", "VXUS"]);                         // hold "everything": they do not count as a home in the overlap rule
const SPDR = new Set(["SPY", "DIA", "MDY", "XLB", "XLC", "XLE", "XLF", "XLI", "XLK", "XLP", "XLRE", "XLU", "XLV", "XLY", "XOP", "XRT", "XHB", "XPH", "KRE", "KBE", "SPLV"]);   // State Street (SPLV is Invesco — kept out below)
SPDR.delete("SPLV");
const ISSUER = (t) => (fundInfo[t] || {}).issuer || null;
const FAMILY = (t) => { const f = fundInfo[t]; if (!f) return "OTHER"; if (f.role === "sector") return "SECTOR"; if (f.role === "industry") return "INDUSTRY"; return (f.parents || [])[0] === "US_STYLE" ? "STYLE" : "BROAD"; };
const heldBy = {}; for (const f of measuredFunds) for (const [t] of HOLD.funds[f].h) (heldBy[norm(t)] ||= new Set()).add(f);
const overlapCountFor = (self) => (t) => [...(heldBy[t] || [])].filter((f) => f !== self && !TOTAL_MARKET.has(f)).length;
const MAX_HUB_POINT = 100;
const EQ_SHARE_FLOOR = 30;   // an equal-weight / very broad fund counts as covered only once at least 30% of its weight is in the blend (recommended; 0 and 50 shown beside — decision for Alan)
/* the Geiger yardstick: the blend of ALL the fund's names (the fund's own Geiger, read on the fund's own price, is a different
   quantity — a fund's price moves smoother than its names, so its Geiger sits nearer zero than their blend; it is reported
   beside the blend as a check, never used as the target) */
const target = (f) => { const S = sorted(HOLD.funds[f].h); return { own: blend(S, main).value, ownDraws: draws.map((r) => blend(S, r).value) }; };   // a cap-weighted fund whose coverage point needs more than this many names is "very broad by measurement" and goes to the overlap rule

/* ── 1. the cap-weighted pass ── */
const capRows = [], toOverlap = [];
for (const f of measuredFunds) {
  if (DECLARED_EQUAL.has(f) || VERY_BROAD.has(f)) { toOverlap.push({ fund: f, why: DECLARED_EQUAL.has(f) ? "equal-weight by construction" : "very broad (Alan: too many tickers)" }); continue; }
  const { own, ownDraws } = target(f);
  const c = curve(HOLD.funds[f].h, { readingOf: main, draws, own, ownDraws, fund: f, closes, kmaxReturns: 200 });
  const kClose = point(c.rows, TOL_CLOSE, R2_CLOSE), kLive = point(c.rows, TOL_LIVE, R2_LIVE);
  const S = sorted(HOLD.funds[f].h);
  const row = { fund: f, label: label[f] || f, family: FAMILY(f), issuer: ISSUER(f), spdr: SPDR.has(f), n: c.n, all_names_blend: r3(own), fund_own_geiger: r3(main(f)), fund_vs_blend: r3(main(f) == null || own == null ? null : main(f) - own), own_returns_days: (closes[f] || { c: [] }).c.length,
    k_close: kClose, share_close: kClose ? r1(c.rows[kClose - 1].share) : null, k_live: kLive, share_live: kLive ? r1(c.rows[kLive - 1].share) : null,
    at_close: kClose ? pick(c.rows[kClose - 1]) : null, at_live: kLive ? pick(c.rows[kLive - 1]) : null, whole_fund: pick(c.rows[c.rows.length - 1]),
    curve: c.rows.filter((r, i) => i < 60 || i % Math.max(1, Math.floor(c.rows.length / 120)) === 0 || i === c.rows.length - 1).map((r) => ({ k: r.k, share: r1(r.share), diff: r3(r.diff), r2: r3(r.r2), pass: r.pass_draws, of: r.of_draws })),
    hub_today: S.filter(([t]) => universe.has(t)).length };
  if (kClose == null || kClose > MAX_HUB_POINT) { row.rule = "overlap"; toOverlap.push({ fund: f, why: kClose == null ? `the top-k blend never tracks the all-names blend within ±${TOL_CLOSE} with the returns test passing (whole fund: Geiger gap ${r3(row.whole_fund.diff)}, returns ${r3(row.whole_fund.r2)})` : `the coverage point needs ${kClose} names (more than ${MAX_HUB_POINT})` }); }
  else { row.rule = "cap"; row.hub_names = S.slice(0, kLive ?? kClose).map(([t, w]) => [t, r3(w)]); row.offhub_names = S.slice(kLive ?? kClose, kClose).map(([t, w]) => [t, r3(w)]); }
  capRows.push(row);
}
function pick(r) { return r ? { k: r.k, share: r1(r.share), blend: r3(r.blend), diff: r3(r.diff), pass: r.pass_draws, pass_live: r.pass_live, of: r.of_draws, r2: r3(r.r2), r2_thin: r3(r.r2_thin), returns_share: r3(r.returns_share), te: r3(r.te), days: r.days } : null; }
const capFunds = capRows.filter((r) => r.rule === "cap");

/* ── 2. the Hub and off-Hub sets from the cap pass + the lists ── */
const hub = new Map();   // name → [why]
const off = new Map();
const add = (m, t, why) => { if (!m.has(t)) m.set(t, []); m.get(t).push(why); };
for (const r of capFunds) { r.hub_names.forEach(([t, w], i) => add(hub, t, { fund: r.fund, rank: i + 1, weight: w, side: "hub" })); r.offhub_names.forEach(([t, w], i) => add(off, t, { fund: r.fund, rank: r.hub_names.length + i + 1, weight: w, side: "off" })); }
for (const [t, ls] of onList) if (!funds.has(t)) add(hub, t, { lists: ls });
for (const t of [...off.keys()]) if (hub.has(t)) { for (const w of off.get(t)) add(hub, t, w); off.delete(t); }

/* ── 3. the overlap rule for the equal-weight / very broad funds ── */
const coveredBefore = new Set([...hub.keys(), ...off.keys()]);
const eqRows = [];
for (const { fund: f, why } of toOverlap) {
  const { own, ownDraws } = target(f);
  const o = overlapRule(HOLD.funds[f].h, { covered: coveredBefore, overlapCount: overlapCountFor(f), readingOf: main, draws, own, ownDraws, fund: f, closes, window: 10, minGain: 1.0, maxAdd: 400, minShare: EQ_SHARE_FLOOR });
  const S = sorted(HOLD.funds[f].h);
  eqRows.push({ fund: f, label: label[f] || f, family: FAMILY(f), issuer: ISSUER(f), spdr: SPDR.has(f), why_here: why, n: o.n, all_names_blend: r3(own), fund_own_geiger: r3(main(f)), fund_vs_blend: r3(main(f) == null || own == null ? null : main(f) - own),
    before: st(o.covered_before), after: st(o.covered_after), added: o.added, added_count: o.stop, stopped_because: o.why, candidates: o.candidates, only_here: o.only_here,
    path: o.path.map((p) => ({ added: p.added, ticker: p.ticker, overlap: p.overlap, share: r1(p.share), count: p.count, diff: r3(p.diff), r2: r3(p.r2) })),
    hub_today: S.filter(([t]) => universe.has(t)).length });
  for (const t of o.added) add(hub, t, { fund: f, overlap: overlapCountFor(f)(t), side: "hub-overlap" });
}
function st(p) { return { count: p.count, share: r1(p.share), blend: r3(p.blend), diff: r3(p.diff), pass: p.pass_draws, of: p.of_draws, r2: r3(p.r2), te: r3(p.te) }; }
for (const t of [...off.keys()]) if (hub.has(t)) off.delete(t);
/* the equal-weight funds' final coverage once every addition is in (one fund's additions help another) */
const finalCovered = new Set([...hub.keys(), ...off.keys()]);
for (const r of eqRows) {
  const S = sorted(HOLD.funds[r.fund].h); const have = S.filter(([t]) => finalCovered.has(t));
  const { own, ownDraws } = target(r.fund);
  const b = blend(have, main); let pass = 0, of = 0;
  draws.forEach((x, i) => { const bd = blend(have, x), od = ownDraws[i]; if (bd.value == null || od == null) return; of++; if (Math.abs(bd.value - od) <= TOL_CLOSE) pass++; });
  const fit0 = returnsFit(have, r.fund, closes); const fit = fit0.w_share >= 0.8 ? fit0 : { ...fit0, r2: null };
  r.final = { returns_share: r3(fit0.w_share), count: have.length, share: r1((100 * have.reduce((s, [, w]) => s + w, 0)) / S.reduce((s, [, w]) => s + w, 0)), blend: r3(b.value), diff: r3(b.value == null || own == null ? null : b.value - own), pass, of, r2: r3(fit.r2), te: r3(fit.te) };
}

/* ── 3b. sensitivity: the same overlap pass under three share floors (0 = Alan's words alone, 30, 50) — how many names the Hub ends with ── */
const floorSensitivity = {};
for (const floor of [0, 30, 50]) {
  const h2 = new Set(hub.keys()); for (const r of eqRows) for (const t of r.added) h2.delete(t);   // the Hub before any overlap addition
  for (const t of [...hub.keys()]) if ((hub.get(t) || []).every((w) => w.side === "hub-overlap")) h2.delete(t);
  const cov = new Set([...h2, ...off.keys()]); let added = 0; const per = {};
  for (const { fund: f } of toOverlap) { const { own, ownDraws } = target(f); const o = overlapRule(HOLD.funds[f].h, { covered: cov, overlapCount: overlapCountFor(f), readingOf: main, draws, own, ownDraws, fund: f, closes, window: 10, minGain: 1.0, maxAdd: 400, minShare: floor }); per[f] = o.stop; added += o.stop; for (const t of o.added) h2.add(t); }
  floorSensitivity[floor] = { added, hub_names: h2.size, hub_lines: h2.size + funds.size, per_fund: per };
}

/* ── 4. the names today that no measured fund holds (16): kept as they are, not judged ── */
const heldAnywhere = new Set(Object.keys(heldBy));
const unjudged = todayNames.filter((t) => !heldAnywhere.has(t) && !hub.has(t) && !off.has(t)).sort();

/* ── 5. totals, in / out against today's 590 ── */
const hubNames = [...hub.keys()].sort(), offNames = [...off.keys()].sort();
const out = todayNames.filter((t) => !hub.has(t) && !unjudged.includes(t)).sort();
const outToOff = out.filter((t) => off.has(t)), outGone = out.filter((t) => !off.has(t));
const inn = hubNames.filter((t) => !universe.has(t)).sort();
const fresh = (t) => { const s = sevenRow.get(t); return { geiger: s ? r3(s.composite) : null, session: s ? s.last_session : null, has_returns: !!closes[t] }; };
const detail = (t) => ({ ticker: t, name: label[t] || null, why: hub.get(t) || off.get(t) || [], lists: onList.get(t) || [], held_by: [...(heldBy[t] || [])].filter((f) => !TOTAL_MARKET.has(f)).length, ...fresh(t) });

/* ── 6. Alan's question: with U2's result (574: 436 names), is RSP covered? how much of IWM? ── */
const u2keep = new Set(U2.recommended.keep.map(norm));
function coverBy(f, set) {
  const S = sorted(HOLD.funds[f].h); const have = S.filter(([t]) => set.has(t));
  const { own, ownDraws } = target(f); const b = blend(have, main); let pass = 0, of = 0;
  draws.forEach((x, i) => { const bd = blend(have, x), od = ownDraws[i]; if (bd.value == null || od == null) return; of++; if (Math.abs(bd.value - od) <= TOL_CLOSE) pass++; });
  const fit0 = returnsFit(have, f, closes); const fit = fit0.w_share >= 0.8 ? fit0 : { ...fit0, r2: null };
  return { count: have.length, of: S.length, returns_share: r3(fit0.w_share), share: r1((100 * have.reduce((s, [, w]) => s + w, 0)) / S.reduce((s, [, w]) => s + w, 0)), blend: r3(b.value), all_names_blend: r3(own), fund_own_geiger: r3(main(f)), diff: r3(b.value == null || own == null ? null : b.value - own), pass, draws: of, r2: r3(fit.r2), te: r3(fit.te), tracks: b.value != null && own != null && Math.abs(b.value - own) <= TOL_CLOSE && (of === 0 || pass / of >= PASS_SHARE) && (fit.r2 == null || fit.r2 >= R2_CLOSE) };
}
const alanQ = { rsp_under_u2: coverBy("RSP", u2keep), iwm_under_u2: coverBy("IWM", u2keep), rsp_today: coverBy("RSP", universe), iwm_today: coverBy("IWM", universe), rsp_under_u3_hub: coverBy("RSP", hub), iwm_under_u3_hub: coverBy("IWM", hub), rsp_under_u3_all: coverBy("RSP", finalCovered), iwm_under_u3_all: coverBy("IWM", finalCovered) };

/* ── 7. the SPDR over-service table ── */
const spdrRows = [];
for (const f of measuredFunds) {
  if (!SPDR.has(f)) continue;
  const S = sorted(HOLD.funds[f].h); const today = S.filter(([t]) => universe.has(t));
  const cap = capRows.find((r) => r.fund === f && r.rule === "cap");
  const kHub = cap ? cap.hub_names.length : null;
  const beyond = cap ? today.filter(([t], i) => S.findIndex(([x]) => x === t) >= kHub) : today.filter(([t]) => !hub.has(t));
  const movable = beyond.filter(([t]) => !hub.has(t));
  spdrRows.push({ fund: f, label: label[f] || f, rule: cap ? "cap" : "overlap", n: S.length, hub_today: today.length, hub_point: kHub, share_at_hub_point: cap ? cap.share_live : null, beyond_point: beyond.length, movable_off_hub: movable.length, stay_for_another_reason: beyond.length - movable.length, movable: movable.map(([t]) => t) });
}

/* ── 8. write ── */
const rule = [
  `Cap-weighted funds: take the names in weight order. At each count k, blend the Geiger of the top k (bigger names count more) and compare it with the blend of all the fund's names (the fund's own Geiger, read on the fund's price, is shown beside it: it is a different quantity and sits nearer zero, so it cannot be the target — see 'what could be wrong'); blend their daily returns and compare with the fund's own daily return over the last ${RETURN_DAYS} sessions. The coverage point is the smallest k from which the blend stays within ±${TOL_CLOSE} of the all-names blend on the main reading and on at least ${Math.round(PASS_SHARE * 100)}% of the ${draws.length} draws, and explains at least ${Math.round(R2_CLOSE * 100)}% of the fund's daily moves — and keeps doing so at every larger k. The share of the fund's weight at that k is the statistically relevant share; it is measured, not chosen.`,
  `The split: the Hub point is the same test at the live tolerance (±${TOL_LIVE}, ${Math.round(R2_LIVE * 100)}% of daily moves). The names up to the Hub point are read live on the Hub; the names from there to the coverage point are off-Hub, blended at the close. So the Hub shows the sign and the rough size during the day, and the close firms it up.`,
  "Equal-weight funds (RSP, QQEW, XRT, XHB, KRE, KBE, XOP, XPH), IWM, and any fund the cap pass cannot cover inside 100 names: no cap rule. First measure how much of each the names already chosen cover. Then add only names that live in other funds too — most other homes first, never a name only this fund holds — until the blend tracks the fund at the close tolerance with at least 30% of the fund's weight in (a floor so a handful of names cannot pass for an equal-weight fund; 0 and 50 shown beside), or the next ten names would add under one point of the fund's weight. Where it stopped is stated per fund.",
  "RADAR / FAVORITES / LIKED names are always on the Hub. Adopted cohorts are not a rule (not decided). No fixed cap per fund and no names-per-fund headline.",
  "Every fund on the tree keeps its own line on the Hub — its own Geiger is the check on the blend.",
  "A name today's Hub serves that no fund with a holdings file holds (16) is kept as it is and listed as not judged.",
  "This is a proposal with measurements. Nothing is admitted or removed; the coordinator runs any admission at a closed-market sitting with Alan's word.",
];
const totals = { hub_names: hubNames.length, offhub_names: offNames.length, funds_on_hub: funds.size, hub_lines: hubNames.length + funds.size + unjudged.length, unjudged: unjudged.length,
  today_lines: universe.size, today_names: todayNames.length, today_funds: universe.size - todayNames.length,
  out: out.length, out_to_offhub: outToOff.length, out_gone: outGone.length, in: inn.length,
  hub_from_cap: hubNames.filter((t) => (hub.get(t) || []).some((w) => w.side === "hub")).length, hub_from_lists_only: hubNames.filter((t) => (hub.get(t) || []).every((w) => w.lists)).length, hub_from_overlap: hubNames.filter((t) => (hub.get(t) || []).some((w) => w.side === "hub-overlap")).length,
  u2: { lines: U2.recommended.counts.proposed, names: U2.recommended.counts.names, out: U2.recommended.counts.out, in: U2.recommended.counts.in } };
const servedSet = { artifact_kind: "SCINTILLA_SERVED_SET_PROPOSAL_V2", status: "PROPOSED — measurements only; nothing admitted or removed; no table, universe, Hub page or job touched", built_utc: new Date().toISOString(),
  tolerances: { geiger_close: TOL_CLOSE, geiger_live: TOL_LIVE, pass_share: PASS_SHARE, returns_r2_close: R2_CLOSE, returns_r2_live: R2_LIVE, return_days: RETURN_DAYS, max_hub_point: MAX_HUB_POINT, equal_weight_share_floor: EQ_SHARE_FLOOR }, rule, totals,
  hub: hubNames.map(detail), offhub: offNames.map(detail), out: out.map(detail), in: inn.map(detail), unjudged,
  sources: { seven: { as_of: SEVEN.as_of, computed_utc: SEVEN.computed_utc }, daily_three_rung: DAILY.dates, holdings: HOLD.as_of, closes: { fetched_utc: CLOSES.fetched_utc, symbols: CLOSES.symbols, first: CLOSES.dates[0], last: CLOSES.dates[CLOSES.dates.length - 1], missing: CLOSES.missing.length }, hub_geiger_computed_utc: HUB.computed_utc, universe_sha256: UL.universe_sha256, lists_read: "2 Oct 2026 ~19:20Z (counts re-checked read-only 2 Oct ~21:40 ET: LIKED 141, station_lists 74 = 57 + 17)", tree_built: TREE.built_utc, u2: U2.built_utc } };
const measure = { what: "U3 · the served-set rule, Alan's way · measurements (2 Oct 2026) · PROPOSED", built_utc: servedSet.built_utc, draws: drawLabels, tolerances: servedSet.tolerances,
  limits: [
    "One seven-rung close exists (the 1 Oct close); the 12 draws are its seven rungs and five daily three-rung closes — they are not twelve days.",
    "Holdings exist for 51 of the 138 tree funds (FMP, 26 Sep). The other 87 cannot be measured; their names are not judged.",
    `Daily closes came from the chart API (${CLOSES.symbols} symbols, ${CLOSES.dates[0]} → ${CLOSES.dates[CLOSES.dates.length - 1]}; ${CLOSES.missing.length} symbols had none). The returns test runs on the top 200 of each cap-weighted fund; beyond 200 only the Geiger test speaks.`,
    "Alan's words were 'the Geiger of the blend vs the fund's own'. Measured literally, the fund's own Geiger (read on the fund's price) sits far from the blend of ALL its names on 50 of 51 funds (XLK: fund +0.86, all-names blend +1.28 → gap −0.43; while the same names explain 99% of XLK's daily moves). A fund's price moves smoother than its names, so its Geiger is a different quantity. The Geiger side therefore measures top-k against the all-names blend; the fund's own price is the yardstick on the returns side, which is where 'does the blend track the fund' is answered.",
  ], cap: capRows, equal: eqRows, spdr: spdrRows, alan_question: alanQ, totals, to_overlap: toOverlap, floor_sensitivity: floorSensitivity };
writeFileSync(join(DIR, "measure.json"), JSON.stringify(measure));
writeFileSync(join(DIR, "served-set-v2.json"), JSON.stringify(servedSet, null, 1));
console.log(JSON.stringify({ totals, alanQ, to_overlap: toOverlap, floor_sensitivity: floorSensitivity }, null, 1));
console.log("fund\trule\tn\town\tk_live\tshare_live\tk_close\tshare_close\tdiff@close\tr2@close\twhole_diff\twhole_r2\thub_today");
for (const r of capRows) console.log([r.fund, r.rule, r.n, r.own_geiger, r.k_live, r.share_live, r.k_close, r.share_close, r.at_close && r.at_close.diff, r.at_close && r.at_close.r2, r.whole_fund.diff, r.whole_fund.r2, r.hub_today].join("\t"));
console.log("equal: fund\tn\tbefore(count/share/diff/r2)\tadded\tafter(count/share/diff/r2)\tfinal\tstopped");
for (const r of eqRows) console.log([r.fund, r.n, `${r.before.count}/${r.before.share}/${r.before.diff}/${r.before.r2}`, r.added_count, `${r.after.count}/${r.after.share}/${r.after.diff}/${r.after.r2}`, `${r.final.count}/${r.final.share}/${r.final.diff}/${r.final.r2}`, r.stopped_because].join("\t"));
console.log("spdr:", spdrRows.map((r) => `${r.fund} today ${r.hub_today} point ${r.hub_point} beyond ${r.beyond_point} movable ${r.movable_off_hub}`).join(" | "));

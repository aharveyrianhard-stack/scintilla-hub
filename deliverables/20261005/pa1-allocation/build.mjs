/* Scintilla · PA1 portfolio allocation (5 Oct 2026) · the chain's DATA, read once on today's real sources and written beside this
   file as data-<today>.json. The page runs chain.mjs on that file; nothing here is wired into the Hub; nothing is written to a table.
     node deliverables/20261005/pa1-allocation/build.mjs
   Sources (named in the file): the chart API (/universe, /geiger live for the 590, /quotes, /candles tf=D); the Hub's tables with the
   page's public key (company_profile, ticker_industry, fmp_peers, peer_sources, fundamentals + histories, analyst_estimates,
   analyst_target_news with A4's quality columns, fx); fixtures with their dates: C5 revenue segments (3 Oct), T12 cohorts (3 Oct),
   B1 market bow tie (2 Oct close). Reads only. */
import { readFileSync, writeFileSync } from "node:fs"; import { fileURLToPath } from "node:url"; import path from "node:path";
import { inputs, snapshotFromCohort } from "../../20261001/comps-mechanic/read.mjs";
import { readCohort } from "../../20261001/comps-template/cohort.mjs";
import { buildSet, lineWords } from "../../20261003/comps-c5/lines.mjs";
import { conclusion } from "../../20261003/comps-c5/field.mjs";
import { DIALS, heat, cohortSector, isSound, targetFromNotes, revisionDirection, logReturn, mean, median } from "./chain.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../..");
const SB = "https://wadinxqplrggagkvrdag.supabase.co", API = "https://scintilla-massive-chart-api.fly.dev", HUB = "https://scintillahub.ai";
const TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const H_MED = 72, H_SHORT = 16, BARS = 100, TARGET_DAYS = 183, REV_DAYS = 30;
const KEY = (readFileSync(path.join(ROOT, "index.html"), "utf8").match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_.\-]+/) || [])[0];
if (!KEY) throw new Error("the page's public key was not found in index.html");
let pgCalls = 0, apiCalls = 0;
const pg = async (p) => { pgCalls++; const r = await fetch(SB + "/rest/v1/" + p, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } }); if (!r.ok) throw new Error(p.split("?")[0] + " → " + r.status); return r.json(); };
const fetchJson = async (u) => JSON.parse(readFileSync(path.join(ROOT, u), "utf8"));
const api = async (p) => { apiCalls++; const r = await fetch(API + p, { headers: { Origin: HUB } }); if (!r.ok) throw new Error(p.split("?")[0] + " → " + r.status); return r.json(); };
const quotes = async (T) => api(`/quotes?symbols=${encodeURIComponent(T.join(","))}`);
const pool = async (items, n, fn) => { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k], k); } catch (e) { out[k] = { error: String(e.message || e) }; } } })); return out; };
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a);
const r3 = (v) => v == null ? null : Math.round(v * 1000) / 1000, r1 = (v) => v == null ? null : Math.round(v * 10) / 10, r2 = (v) => v == null ? null : Math.round(v * 100) / 100;

/* ---- the eleven sectors: FMP's name, the compare strip's label, the four fund families (cap-weight ×3, equal-weight), B1's label ---- */
const SECTORS = [
  { key: "Technology", label: "TECH", cw: ["XLK", "IYW", "VGT"], ew: "RSPT", b1: "TECH" },
  { key: "Healthcare", label: "HEALTH", cw: ["XLV", "IYH", "VHT"], ew: "RSPH", b1: "HEALTH" },
  { key: "Financial Services", label: "FINANCIALS", cw: ["XLF", "IYF", "VFH"], ew: "RSPF", b1: "FINANCIALS" },
  { key: "Energy", label: "ENERGY", cw: ["XLE", "IYE", "VDE"], ew: "RSPG", b1: "ENERGY" },
  { key: "Consumer Cyclical", label: "DISCRETIONARY", cw: ["XLY", "IYC", "VCR"], ew: "RSPD", b1: "DISCRET" },
  { key: "Consumer Defensive", label: "STAPLES", cw: ["XLP", "IYK", "VDC"], ew: "RSPS", b1: "STAPLES" },
  { key: "Industrials", label: "INDUSTRIAL", cw: ["XLI", "IYJ", "VIS"], ew: "RSPN", b1: "INDUSTRIAL" },
  { key: "Basic Materials", label: "MATERIALS", cw: ["XLB", "IYM", "VAW"], ew: "RSPM", b1: "MATERIALS" },
  { key: "Utilities", label: "UTILITIES", cw: ["XLU", "IDU", "VPU"], ew: "RSPU", b1: "UTILITIES" },
  { key: "Communication Services", label: "COMMS", cw: ["XLC", "IYZ", "VOX"], ew: "RSPC", b1: "COMMS" },
  { key: "Real Estate", label: "REAL ESTATE", cw: ["XLRE", "IYR", "VNQ"], ew: "RSPR", b1: "REAL ESTATE" },
];
const NOT_COMPANY_COHORTS = /^(FUNDS|INDEXES|MACRO|INTL|WORLD|CRYPTO)$/;

/* ---- 1 · the universe, the tables, the fixtures ------------------------------------------------------------------- */
const t00 = Date.now();
const inp = await inputs({ pg, fetchJson });
inp.segments = JSON.parse(readFileSync(path.join(ROOT, "deliverables/20261003/comps-c5/segments-2026-10-03.json"), "utf8")).companies;
const uni = await api("/universe");
const served = uni.symbols.filter((t) => inp.profiles[t] && !inp.profiles[t].is_etf);
const T12 = JSON.parse(readFileSync(path.join(ROOT, "deliverables/20261003/tree-parts/cohorts-measured.json"), "utf8"));
const B1 = JSON.parse(readFileSync(path.join(HERE, "b1-sectors-20261003.json"), "utf8"));
const fxStandin = JSON.parse(readFileSync(path.join(ROOT, "deliverables/20261001/comps-template/fx-standin-ecb-2026-10-01.json"), "utf8"));
log(`served companies ${served.length} of ${uni.count} · profiles ${Object.keys(inp.profiles).length} · T12 cohorts ${T12.hub_tabs.length + T12.registry.length + T12.candidates.length} · B1 sectors ${B1.sectors.length}`);

/* ---- 2 · the Geiger, live, for the 590 and the 44 sector funds ------------------------------------------------------- */
const FUNDS = [...new Set(SECTORS.flatMap((s) => [...s.cw, s.ew]).concat(["SPY", "RSP"]))];
const want = [...new Set(uni.symbols.concat(FUNDS))], live = {}; let liveAsOf = null;
for (let i = 0; i < want.length; i += 100) { const g = await api(`/geiger?symbols=${want.slice(i, i + 100).join(",")}`); liveAsOf = g.as_of || g.computed_utc || g.updated_utc || g.generated_utc || g.ts || (Object.entries(g).find(([k, v]) => k !== "symbols" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) || [])[1] || liveAsOf; for (const [t, v] of Object.entries(g.symbols || {})) live[t] = { composite: v.composite == null ? null : r3(v.composite), rungs: v.tf_contributors ?? null }; }
log(`live Geiger ${Object.keys(live).length} symbols · as of ${liveAsOf}`);

/* ---- 3 · HEAT: our names · cap-weight funds · equal-weight fund (bow tie) · rotation ---------------------------------- */
const bars = {};
const fundBars = await pool(["SPY", ...FUNDS.filter((f) => f !== "SPY")], 8, async (t) => { const j = await api(`/candles?symbol=${encodeURIComponent(t)}&tf=D&limit=${BARS}`); bars[t] = (j.series || []).map((b) => ({ d: new Date(b.t).toLocaleDateString("en-CA", { timeZone: "America/New_York" }), c: +b.c })); return bars[t].length; });
const closes = (t) => (bars[t] || []).map((b) => b.c), lastBar = (t) => (bars[t] || []).slice(-1)[0]?.d || null;
const spyM = logReturn(closes("SPY"), H_MED), spyS = logReturn(closes("SPY"), H_SHORT);
const rel = (t, h, spy) => { const r = logReturn(closes(t), h); return r == null || spy == null ? null : r1((r - spy) * 100); };
const bySector = {}; for (const t of served) (bySector[inp.profiles[t].sector || "unknown"] ||= []).push(t);
const sectors = SECTORS.map((s) => {
  const members = bySector[s.key] || [], g = members.map((t) => live[t] && live[t].composite).filter((x) => x != null);
  const cwVals = s.cw.map((f) => live[f] && live[f].composite), ewV = live[s.ew] && live[s.ew].composite, cwMean = mean(cwVals);
  const b1 = B1.sectors.find((x) => x.label === s.b1) || null;
  return { key: s.key, label: s.label, served: members.length, members, names: r3(mean(g)), names_n: g.length, up: g.filter((x) => x > 0).length,
    cw_funds: Object.fromEntries(s.cw.map((f, i) => [f, cwVals[i] == null ? null : r3(cwVals[i])])), funds: r3(cwMean), ew_fund: s.ew, ew: ewV == null ? null : r3(ewV), bowtie: ewV == null || cwMean == null ? null : r3(ewV - cwMean),
    rotation: rel(s.cw[0], H_MED, spyM), rotation_short: rel(s.cw[0], H_SHORT, spyS), rotation_ew: rel(s.ew, H_MED, spyM), rotation_fund: s.cw[0], bars_to: lastBar(s.cw[0]),
    b1: b1 ? { ew: b1.ew, cw: b1.cw, bowtie: b1.bowtie, verdict: b1.verdict, n_read: b1.n_read, n_exist: b1.n_exist, mv_share: b1.mv_share, se: b1.se, weak: b1.weak, as_of: B1.as_of.close } : null };
});
const H = heat(sectors, DIALS);
log(`heat: ${H.ranked.map((s) => s.label + " " + s.heat.toFixed(2)).join(" · ")} · hot ${H.hot.join(",")} · cold ${H.cold.join(",")}`);

/* ---- 4 · THEMES × ROTATION: T12's cohorts, their sector, their soundness; the K soundest per hot/cold sector run ------- */
const seen = new Set(), cohorts = [];
for (const [where, list] of [["Hub tab", T12.hub_tabs], ["registry", T12.registry], ["candidate", T12.candidates]]) for (const c of list) {
  const label = String(c.label || c.id).toUpperCase(); if (seen.has(label)) continue; seen.add(label);
  const members = (c.tickers || []).filter((t) => inp.profiles[t] && !inp.profiles[t].is_etf).map((t) => ({ ticker: t, sector: inp.profiles[t].sector || null }));
  const cs = cohortSector(members), m = c.measure || {}; const mixed = cs.share < 0.5;
  const notCompany = NOT_COMPANY_COHORTS.test(label);
  cohorts.push({ id: c.id, label, where, n: (c.tickers || []).length, companies: members.length, members: members.map((x) => x.ticker), sector_key: mixed ? null : cs.sector, sector_top: cs.sector, sector_share: r2(cs.share), mixed, sound: isSound(m) && !notCompany && !mixed, se: m.se ?? null, n_read: m.read ?? null, mean_t12: m.mean ?? null, closes_pass: m.closes_pass ?? null, rules: m.rules || null, purity: m.purity ?? null,
    why_not: notCompany ? "not a company cohort (funds, indexes, macro, world, crypto)" : mixed ? `mixed: only ${Math.round(cs.share * 100)}% of its companies sit in one sector (${cs.sector})` : isSound(m) ? null : m.rules ? Object.entries(m.rules).filter(([, v]) => !v).map(([k]) => ({ enough: "fewer than 8 names read", agree: "standard error above 0.10", steady: "not held on each of the six closes", pure: "biggest industry under 60%" })[k] || k).join("; ") || "not sound" : "not measured",
    geiger: r3(mean(members.map((x) => live[x.ticker] && live[x.ticker].composite))) });
}
const active = new Set([...H.hot, ...H.cold]);
const chosen = [];
for (const sk of active) {
  const list = cohorts.filter((c) => c.sector_key === sk && c.sound && c.companies >= 2).sort((a, b) => (a.se ?? 9) - (b.se ?? 9) || b.companies - a.companies).slice(0, DIALS.cohorts_per_sector);
  if (list.length) { for (const c of list) chosen.push(c); continue; }
  /* FALLBACK: no sound theme in this sector → the sector's own served names run as one cohort, flagged, with its own standard error */
  const S = sectors.find((x) => x.key === sk), g = S.members.map((t) => live[t] && live[t].composite).filter((x) => x != null), gm = mean(g), sd = g.length > 1 ? Math.sqrt(g.reduce((a, x) => a + (x - gm) ** 2, 0) / (g.length - 1)) : null;
  const fb = { id: "SECTOR:" + sk, label: S.label + " · OUR NAMES", where: "fallback", n: S.members.length, companies: S.members.length, members: S.members.slice(), sector_key: sk, sector_top: sk, sector_share: 1, mixed: false, sound: g.length >= 8 && sd != null && sd / Math.sqrt(g.length) <= 0.10, se: sd == null ? null : r3(sd / Math.sqrt(g.length)), n_read: g.length, mean_t12: null, closes_pass: null, rules: null, purity: null, fallback: true,
    why_not: null, note: "no T12-sound theme in this sector today: the sector's served names run as one cohort (live standard error shown; the six-close test is not run)", geiger: r3(gm) };
  cohorts.push(fb); chosen.push(fb);
}
log(`cohorts ${cohorts.length} (${cohorts.filter((c) => c.sound).length} sound) · chosen for the knockout ${chosen.map((c) => c.label + "@" + c.sector_key).join(" · ")}`);
const koNames = [...new Set(chosen.flatMap((c) => c.members))];
await pool(koNames.filter((t) => !bars[t]), 8, async (t) => { const j = await api(`/candles?symbol=${encodeURIComponent(t)}&tf=D&limit=${BARS}`); bars[t] = (j.series || []).map((b) => ({ d: new Date(b.t).toLocaleDateString("en-CA", { timeZone: "America/New_York" }), c: +b.c })); return bars[t].length; });
for (const c of chosen) { const rs = c.members.map((t) => rel(t, H_MED, spyM)).filter((x) => x != null); c.rotation = r1(median(rs)); c.rotation_n = rs.length; c.rotation_short = r1(median(c.members.map((t) => rel(t, H_SHORT, spyS)).filter((x) => x != null)));   /* the MEDIAN member: a crasher or a tripler does not drag the theme */ }
log(`member bars read for ${koNames.length} names`);

/* ---- 5 · the analyst notes (A4-cleaned) for every knockout name --------------------------------------------------------- */
const sinceIso = new Date(Date.parse(TODAY + "T00:00:00Z") - (TARGET_DAYS + 30) * 86400e3).toISOString();
const notes = {}; let noteRows = 0;
for (let i = 0; i < koNames.length; i += 60) {
  const chunk = koNames.slice(i, i + 60); let off = 0;
  for (;;) { const rows = await pg(`analyst_target_news?select=ticker,published_utc,firm,target,adj_target,adj_target_checked,quality&kind=eq.TARGET&or=(quality.is.null,quality.neq.quarantine)&ticker=in.(${chunk.map(encodeURIComponent).join(",")})&published_utc=gte.${encodeURIComponent(sinceIso)}&order=ticker.asc,published_utc.asc&limit=1000&offset=${off}`); for (const r of rows) { const v = r.adj_target_checked ?? r.adj_target ?? r.target; (notes[r.ticker] ||= []).push({ firm: r.firm, published_utc: r.published_utc, target: v == null ? null : +v }); } noteRows += rows.length; if (rows.length < 1000) break; off += 1000; }
}
log(`analyst notes ${noteRows} clean rows for ${Object.keys(notes).length} names`);

/* ---- 6 · KNOCKOUTS: one comps read per cohort over the union of the members' business-first sets ------------------------- */
const knockouts = [], names = {};
for (const c of chosen) {
  const sets = {}; for (const t of c.members) { try { sets[t] = buildSet(t, inp); } catch (e) { sets[t] = { error: String(e.message || e), kept: [] }; } }
  const union = [...new Set(c.members.concat(...c.members.map((t) => sets[t].kept.map((r) => r.ticker))))];
  let ctx = null, err = [];
  for (const t of c.members) { try { ctx = await readCohort({ ticker: t, today: TODAY, pg, quotes, fxStandin, membersAsked: union, labelAsked: c.label }); break; } catch (e) { err.push(t + ": " + String(e.message || e)); } }
  if (!ctx) { knockouts.push({ cohort: c.id, label: c.label, error: "no member could anchor the read: " + err.join(" · "), members: [] }); continue; }
  Object.assign(names, ctx.names || {});
  const estRows = await pg(`analyst_estimates?select=ticker,fiscal_date,est_eps_avg&period=eq.annual&ticker=in.(${union.map(encodeURIComponent).join(",")})&fiscal_date=gte.${TODAY}&order=ticker.asc,fiscal_date.asc`);
  const estimates = Object.fromEntries(ctx.inputs.map((i) => [i.ticker, { eps_ttm: i.eps_ttm ?? null, est: estRows.filter((e) => e.ticker === i.ticker).map((e) => ({ fiscal_date: e.fiscal_date, eps: e.est_eps_avg })) }]));
  const members = [];
  for (const t of c.members) {
    const set = sets[t], kept = (set.kept || []).map((r) => r.ticker), mem = [t, ...kept];
    const row = { ticker: t, name: ctx.names[t] || t, industry: inp.profiles[t].industry || null, mcap: inp.profiles[t].market_cap || null, lines: set.own_lines ? lineWords(set.own_lines) : null, set: kept, set_n: kept.length, price: null, price_date: null, comps_upside: null, comps_centre: null, comps_lo: null, comps_hi: null, comps_outliers: [], comps_why: set.error || null, geiger: live[t] ? live[t].composite : null, rungs: live[t] ? live[t].rungs : null, rotation: rel(t, H_MED, spyM) };
    if (kept.length < 2) row.comps_why = `only ${kept.length} comparable${kept.length === 1 ? "" : "s"} on the business-first rule`;
    else try {
      const ctxT = { ...ctx, ticker: t, members: mem, inputs: ctx.inputs.filter((i) => mem.includes(i.ticker)), excluded: ctx.excluded.filter((e) => mem.includes(e.ticker)) };
      const snap = snapshotFromCohort(ctxT, t), C = conclusion(snap, [], estimates, TODAY, "C");
      row.price = snap.price; row.price_date = snap.price_date || null;
      if (C.band) { row.comps_upside = r1(C.upside.mid.pct); row.comps_centre = r2(C.band.mid); row.comps_lo = r2(C.band.lo); row.comps_hi = r2(C.band.hi); row.comps_points = C.ways.find((w) => w.way === "C")?.n ?? null; row.comps_measures = Object.entries(C.measureWeights.weights).filter(([, w]) => w > 0).map(([k, w]) => k + " " + Math.round(w * 100)).join(" · "); } else row.comps_why = C.reason || "way C not computed";
      row.comps_outliers = C.outliers.filter((o) => o.excluded).map((o) => o.ticker + " " + o.key);
    } catch (e) { row.comps_why = String(e.message || e); }
    const tg = targetFromNotes(notes[t] || [], TODAY, { days: TARGET_DAYS, minFirms: DIALS.min_firms }), rv = revisionDirection(notes[t] || [], TODAY, { recent: REV_DAYS, days: TARGET_DAYS });
    row.target_n = tg.n; row.target_median = r2(tg.median); row.target_lo = r2(tg.lo); row.target_hi = r2(tg.hi); row.target_why = tg.why || null;
    row.target_upside = tg.median != null && row.price > 0 ? r1((tg.median / row.price - 1) * 100) : null;
    row.revision = rv.direction; row.rev_up = rv.up; row.rev_down = rv.down;
    members.push(row);
  }
  knockouts.push({ cohort: c.id, label: c.label, where: c.where, sector_key: c.sector_key, sound: c.sound, se: c.se, geiger: c.geiger, rotation: c.rotation, union_n: union.length, quotes_error: ctx.quotes_error || null, members });
  log(`knockout ${c.label}: ${members.length} names · way C for ${members.filter((m) => m.comps_upside != null).length} · targets for ${members.filter((m) => m.target_upside != null).length}`);
}

/* ---- 7 · write --------------------------------------------------------------------------------------------------------- */
const out = {
  what: "PA1 portfolio allocation · the chain's inputs on today's real data: heat (11 sectors, four legs), the cohorts with T12's soundness, the knockouts' raw readings per member. chain.mjs runs heat → knockout → picks → the discussion view in the page from this file, under the dials.",
  today: TODAY, taken: new Date().toISOString(), dials: DIALS, elapsed_s: Math.round((Date.now() - t00) / 1000), calls: { chart_api: apiCalls, tables: pgCalls },
  sources: {
    geiger_live: { what: "the Hub's live Geiger (composite, 7 rungs) for the 590 served symbols and the 44 sector funds", url: API + "/geiger?symbols=…", as_of: liveAsOf, symbols: Object.keys(live).length },
    bars: { what: `daily bars (${BARS}) for the sector funds, SPY and every knockout name; rotation = the ${H_MED}-session log return minus SPY's, in points (${H_SHORT} short); a cohort's rotation is its MEDIAN member's`, url: API + "/candles?symbol=…&tf=D", to: lastBar("SPY"), spy_medium_pct: r1(spyM * 100), spy_short_pct: r1(spyS * 100) },
    funds: { what: "cap-weight = the mean of three families' sector funds (State Street XLx · iShares IYx · Vanguard Vxx); equal-weight = Invesco RSPx; bow tie = equal-weight − cap-weight", list: FUNDS },
    b1: { what: B1.what, as_of: B1.as_of.close, rule: B1.rule },
    t12: { what: T12.what, rule: T12.rule, dates: T12.dates, file: "deliverables/20261003/tree-parts/cohorts-measured.json" },
    comps: { what: "C5: the business-first set (lines.mjs, revenue segments pulled on Fly 3 Oct), the field with MAD-3 outliers out per measure, PEG from forward growth, way C = the weighted median of every peer's implied price on every priced measure (field.mjs); one table read per cohort over the union of the members' sets", segments_taken: "2026-10-03" },
    targets: { what: `analyst_target_news, kind TARGET, A4-cleaned (quality is null or ≠ quarantine), the split-checked target first; the firms' newest note inside ${TARGET_DAYS} days → median, low, high, count; revision direction = raised − lowered over the firms with a note in the last ${REV_DAYS} days against their previous note`, rows: noteRows, names: Object.keys(notes).length },
    universe: { url: API + "/universe", count: uni.count, companies: served.length, sha256: uni.universe_sha256 || null },
    tables: { present: inp.tables, industry_table: inp.industry_table },
  },
  sectors, heat_now: { hot: H.hot, cold: H.cold, ranked: H.ranked.map((s) => ({ key: s.key, label: s.label, heat: r3(s.heat), heat_rank: s.heat_rank })) },
  cohorts, chosen: chosen.map((c) => c.id), knockouts, names,
};
const file = path.join(HERE, `data-${TODAY}.json`);
writeFileSync(file, JSON.stringify(out)); writeFileSync(path.join(HERE, "data-latest.json"), JSON.stringify(out));   /* the page reads data-latest.json; the dated file is the record */
log(`wrote ${file} · ${Math.round(JSON.stringify(out).length / 1024)} KB · ${out.elapsed_s}s · api ${apiCalls} · tables ${pgCalls}`);
console.log(JSON.stringify({ today: TODAY, live_as_of: liveAsOf, heat: out.heat_now, chosen: chosen.map((c) => [c.label, c.sector_key, c.companies, c.se]), knockouts: knockouts.map((k) => [k.label, k.members.length, k.members.filter((m) => m.comps_upside != null).length, k.members.filter((m) => m.target_upside != null).length, k.error || null]) }, null, 1));

/* U4b (3 Oct 2026) · the admission audit and the per-name facts table — the builder. Reads only the dated snapshots in data/
   (taken read-only on 3 Oct: the chart API's /universe, /geiger and /quotes; a storage walk of every bar object on a throw-away
   Fly machine; the Hub database; Alan's three lists; the comps counts from comps-counts.mjs), the tree (deliverables/20260929/
   tree-map/tree.json) and U3's proposal (deliverables/20261002/served-set-v2/served-set-v2.json). Writes audit.json and
   facts.json beside itself. Nothing live is read or written. FACTS ONLY: no row carries a recommendation.
   Usage (from the Hub root): node deliverables/20261003/u4b-facts/build.mjs */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DIR = dirname(fileURLToPath(import.meta.url)), ROOT = join(DIR, "../../..");
const J = (p) => JSON.parse(readFileSync(join(DIR, p), "utf8"));
const R = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

const UNI = J("data/universe-20261003.json"), BARS = J("data/bars-20261003.json"), HEADS = J("data/heads-20261003.json");
const DEPTH = J("data/depth-20261003.json"), QUOTES = J("data/quotes-20261003.json").quotes, GEIGER = J("data/geiger-20261003.json");
const LISTS = J("data/lists-20261003.json"), DB = J("data/db-20261003.json"), COMPS = J("data/comps-counts-20261003.json");
const ADM = J("data/admission-groups-20261003.json");
const TREE = R("deliverables/20260929/tree-map/tree.json"), U3 = R("deliverables/20261002/served-set-v2/served-set-v2.json");

/* ── the reference session and what "fresh" means per width ─────────────────────────────────────────────────────────── */
export const SESSION = "2026-10-02";   // the last completed session when the walk ran (Sat 3 Oct)
const etDay = (iso) => { if (!iso) return null; const d = new Date(iso); return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d); };
const INTRADAY = ["1m", "2m", "3m", "5m", "10m", "15", "30", "45", "60", "120", "180", "240", "6h", "8h", "12h"];
/* a width's newest bar must START on or after this ET date to count as fresh on the 2 Oct session */
const FRESH_FROM = Object.fromEntries([...INTRADAY.map((w) => [w, SESSION]), ["D", SESSION], ["2D", "2026-10-01"], ["3D", "2026-09-30"], ["W", "2026-09-27"], ["2W", "2026-09-20"], ["M", "2026-10-01"], ["3mo", "2026-10-01"], ["6mo", "2026-07-01"], ["12mo", "2026-01-01"]]);
export const DISPLAY = { "15": "15m", "30": "30m", "45": "45m", "60": "1h", "120": "2h", "180": "3h", "240": "4h", D: "1D", W: "1W", M: "1M", "3mo": "3M", "6mo": "6M", "12mo": "12M" };
const disp = (w) => DISPLAY[w] || w;

/* the newest bar each name is SERVED on each width: the tail when one exists (a chart of ≤ 400 candles reads it), else the
   full object (no scheduled pass rewrites those widths: their newest bar is the end of the window they were last pulled for) */
const tail = {}, full = {}, heads = {};
for (const [s, w, ts, n, first, last, acq, fs, fb, fm] of BARS.rows) { (tail[s] ||= {})[w] = ts === 200 ? { n, first, last, acq } : null; (full[s] ||= {})[w] = fs === 200 ? { bytes: fb, modified: fm } : null; }
for (const [s, w, st, rf, rt, acq, der, n] of HEADS.rows) (heads[s] ||= {})[w] = st === 200 ? { from: rf, to: rt, acq, n } : null;
function barsOf(s) {
  const out = {};
  for (const w of BARS.widths) {
    const t = tail[s] && tail[s][w], f = full[s] && full[s][w], h = heads[s] && heads[s][w];
    if (!f && !t) { out[w] = { state: "MISSING" }; continue; }
    /* untailed widths, and 2m whose tail is older than its full copy: the served end is the full object's requested_to */
    if (h && (!t || etDay(t.last) < h.to)) { const fresh = h.to >= SESSION; out[w] = { state: fresh ? "FRESH" : "STALE", from: "full", newest: h.to, bars: h.n, pulled: h.acq }; continue; }
    if (t) { const d = etDay(t.last); out[w] = { state: d >= FRESH_FROM[w] ? "FRESH" : "STALE", from: "tail", newest: d, bars: t.n, first: etDay(t.first) }; continue; }
    out[w] = { state: "UNKNOWN", from: "full" };
  }
  return out;
}

/* ── lookups ─────────────────────────────────────────────────────────────────────────────────────────────────────────── */
const by = (rows, k = "ticker") => { const m = {}; for (const r of rows || []) (m[r[k]] ||= []).push(r); return m; };
const one = (rows, k = "ticker") => { const m = {}; for (const r of rows || []) m[r[k]] ??= r; return m; };
const PROFILE = one(DB.profile), FUND = one(DB.fundamentals), FHIST = one(DB.fund_hist), EST = one(DB.estimates), NEWS = one(DB.news30);
const TICK = one(DB.tickers), MEMB = by(DB.membership), IMAP = one(DB.instrument_map, "station_symbol"), SCOUT = one(DB.scout_last);
const STAGED = one(DB.composite_staged), IND = one(DB.indicators_all), FMPU = new Set(DB.fmp_full_universe.map((r) => r.ticker)), FILER = one(DB.filer);
const DEP = Object.fromEntries(DEPTH.rows.map(([s, ns, n, f, l]) => [s, ns ? { ns, bars: n, first: etDay(f), last: etDay(l) } : null]));
const uni = new Set(UNI.symbols), geigerOnly = new Set(UNI.tiers.geiger_only || []);
const batchOf = {}; for (const b of ADM.batches) for (const s of b.symbols) batchOf[s] = b.effective_date_et;
const BATCH_WORDS = { "2026-09-24": "v2 · 56 FULL (pulled 24 Sep, live 27 Sep)", "2026-09-27": "v2 · 66 GEIGER-ONLY (27 Sep)", "2026-09-28": "v3 · 104 (live 29 Sep)" };
const lists = {}; for (const L of ["LIKED", "FAVORITES", "RADAR"]) for (const t of LISTS[L]) (lists[t] ||= []).push(L);
const nodes = TREE.nodes, nodeOf = {}; for (const n of nodes) if (n.ticker && (n.kind === "name" || n.kind === "fund")) nodeOf[n.ticker] = n;
const cohortNode = Object.fromEntries(nodes.filter((n) => n.kind === "cohort").map((n) => [n.id, n]));
const u3 = {}; for (const k of ["hub", "offhub", "in", "out", "unjudged"]) for (const r of U3[k] || []) (u3[r.ticker] ||= { sets: [] }).sets.push(k), (u3[r.ticker].row = r);
const isFund = (s) => (nodeOf[s] && nodeOf[s].kind === "fund") || (PROFILE[s] && (PROFILE[s].is_etf === "true" || PROFILE[s].is_fund === "true")) || (TICK[s] && /etf|fund/i.test(TICK[s].type || ""));
const c4n = (s) => (COMPS.c4.used_by[s] || []).length, c5n = (s) => (COMPS.c5 ? (COMPS.c5.used_by[s] || []).length : null);

function cohortsOf(s) {
  const n = nodeOf[s], tree = n ? (n.parents || []).filter((p) => cohortNode[p]).map((p) => ({ id: p.replace(/^COHORT_/, ""), kind: cohortNode[p].ckind || "cohort" })) : [];
  const funds = n ? (n.parents || []).filter((p) => nodeOf[p] && nodeOf[p].kind === "fund") : [];
  const memb = (MEMB[s] || []).map((r) => ({ kind: r.kind, key: r.group_key }));
  return { tree, tree_funds: funds, board_home: TICK[s] ? TICK[s].cohort : null, membership: memb };
}

/* ── per name: every fact ─────────────────────────────────────────────────────────────────────────────────────────── */
function factsOf(s) {
  const p = PROFILE[s], f = FUND[s], fh = FHIST[s], e = EST[s], nw = NEWS[s], q = QUOTES[s], g = GEIGER.symbols[s], d = DEP[s], u = u3[s];
  const why = (u && u.row.why) || [];
  return {
    ticker: s, name: (p && p.name) || (nodeOf[s] && nodeOf[s].label) || (u && u.row.name) || null, kind: isFund(s) ? "fund" : "company",
    today: uni.has(s) ? (geigerOnly.has(s) ? "GEIGER-ONLY" : "FULL") : "not served", admitted: batchOf[s] || (uni.has(s) ? "before 24 Sep (the 364)" : null),
    claude_check: !!ADM.claude_check[s], u3: u ? u.sets.filter((x) => x !== "in" && x !== "out").concat(u.sets.includes("in") ? ["in"] : u.sets.includes("out") ? ["out"] : []).join(" · ") : uni.has(s) ? "kept as is" : null,
    lists: lists[s] || [], hub_point_funds: why.filter((w) => w.side === "hub").map((w) => w.fund), coverage_funds: why.filter((w) => w.side === "off").map((w) => w.fund), held_by: u ? u.row.held_by : null,
    cohorts: cohortsOf(s), comps_c4_peer_of: c4n(s), comps_c5_peer_of: c5n(s),
    comps_c4_set: COMPS.c4.sets[s] ? COMPS.c4.sets[s].length : null, comps_c5_set: COMPS.c5 && COMPS.c5.sets[s] ? COMPS.c5.sets[s].length : null,
    daily: d ? { bars: d.bars, first: d.first, last: d.last, from: d.ns } : null,
    profile: p ? { as_of: (p.facts_as_of || p.upd || "").slice(0, 10) || null, country: p.country, industry: p.industry, market_cap: p.market_cap } : null,
    fundamentals: f ? { as_of: (f.upd || "").slice(0, 10), source: f.source } : null, statements: fh ? { periods: fh.n, quarters: fh.nq, first: fh.first, last: fh.last } : null,
    estimates: e ? { periods: e.n, through: e.last, analysts: e.max_an, as_of: (e.upd || "").slice(0, 10) } : null,
    news: nw ? { d30: nw.n, d7: nw.n7, newest: (nw.newest || "").slice(0, 16) } : { d30: 0, d7: 0 },
    geiger: g ? { composite: g[0], rungs: g[1] } : null, scout_geiger: SCOUT[s] ? SCOUT[s].last : null,
    prev_close: q ? { state: q.previous_close_state, confirmation: q.previous_close_confirmation, session: q.previous_session_et, value: q.previous_close } : null,
    currency: FILER[s] ? { reported: FILER[s].reported_currency, listing: FILER[s].listing_currency, adr: FILER[s].is_adr } : null,
    hub_row: TICK[s] ? { role: TICK[s].role, active: TICK[s].active, type: TICK[s].type, source: TICK[s].source } : null,
    fmp_loaders_reach: FMPU.has(s), geiger_composite_row: !!STAGED[s], board_indicators: IND[s] ? IND[s].n : 0,
    instrument_map: IMAP[s] ? { active: IMAP[s].active, status: IMAP[s].status } : null,
  };
}

/* ── the audit: one row per admitted name, each check GREEN / AMBER / RED with the words that name the cell ─────────── */
const admitted = Object.keys(batchOf).sort();
const G = (why) => ({ v: "GREEN", why }), A = (why) => ({ v: "AMBER", why }), X = (why) => ({ v: "RED", why });
function audit(s) {
  const F = factsOf(s), b = barsOf(s), fund = F.kind === "fund";
  const stale = Object.entries(b).filter(([, x]) => x.state !== "FRESH");
  const staleWords = (() => { const byEnd = {}; for (const [w, x] of stale) (byEnd[x.newest || x.state] ||= []).push(disp(w)); return Object.entries(byEnd).map(([d, ws]) => `${ws.join(" ")} end ${d}`).join("; "); })();
  const c = {};
  c.bars = stale.length ? X(`${24 - stale.length}/24 fresh — ${staleWords}`) : G("24/24 fresh on the 2 Oct session");
  c.geiger = F.geiger && F.geiger.rungs === 7 ? G(`7/7 rungs · ${F.geiger.composite}`) : X(F.geiger ? `${F.geiger.rungs}/7 rungs` : "no Geiger row");
  c.prev_close = F.prev_close && F.prev_close.state === "SETTLED" ? (F.prev_close.confirmation === "PROVIDER_CONFIRMED" ? G(`settled ${F.prev_close.session} · confirmed`) : A(`settled ${F.prev_close.session} · from the daily bar, not confirmed`)) : X(F.prev_close ? F.prev_close.state : "no quote");
  c.profile = F.profile ? G(`profile row · ${F.profile.as_of || "undated"}`) : X("no company_profile row");
  if (fund) { c.facts = G("a fund: statements and estimates do not apply"); c.comps = G("a fund: no comps set"); }
  else {
    const miss = [!F.fundamentals && "no fundamentals row", !F.statements && "no statements", !F.estimates && "no estimates"].filter(Boolean);
    /* the FUNDAMENTALS tab draws from the statements: none = an empty tab (red); a missing fundamentals row or estimates alone = amber */
    c.facts = !F.statements ? X(miss.join(", ")) : miss.length ? A(miss.join(", ")) : G(`statements ${F.statements.quarters}q · estimates to ${F.estimates.through}`);
    const set = F.comps_c4_set, peer = F.comps_c4_peer_of;
    const c5 = F.comps_c5_set != null ? ` (C5: set of ${F.comps_c5_set} · peer of ${F.comps_c5_peer_of})` : "";
    c.comps = set == null ? X("no comps set (no profile)") : set === 0 ? X(`empty C4 set · peer of ${peer}${c5}`) : set < 5 ? A(`C4 set of ${set} · peer of ${peer}${c5}`) : peer === 0 ? A(`C4 set of ${set} · peer of nobody${c5}`) : G(`C4 set of ${set} · peer of ${peer}${c5}`);
  }
  /* the history belongs to this company: the first stored daily bar is not older than its listing (the reused-ticker trap) */
  const lst = PROFILE[s] && PROFILE[s].ipo_date, d0 = F.daily && F.daily.first;
  c.history = !d0 ? X("no daily history stored") : !lst ? A(`from ${d0} · no listing date on file to compare`) : d0 >= lst ? G(`from ${d0} · listed ${lst}`) : (Date.parse(lst) - Date.parse(d0)) / 864e5 > 30 ? X(`bars from ${d0}, listed ${lst}: an earlier holder's bars?`) : G(`from ${d0} · listed ${lst}`);
  c.news = F.news.d30 === 0 ? X("no news in 30 days") : F.news.d7 === 0 ? A(`${F.news.d30} in 30 days, none in 7`) : G(`${F.news.d7} in 7 days · ${F.news.d30} in 30`);
  const tc = F.cohorts.tree, home = F.cohorts.board_home, node = nodeOf[s];
  /* funds do not sit in cohorts on the tree (47 of today's 48 older funds have none): a fund counts as placed when the tree
     carries it under its headings; a company needs a tree cohort, and the board's home alone is amber */
  if (fund) c.cohort = node && (node.parents || []).length ? G(`tree: under ${node.parents.join(", ")}${home ? " · board " + home : ""}`) : X("not on the tree");
  else c.cohort = tc.length ? G(`${tc.map((x) => x.id + (x.kind === "adopted" ? "" : " (" + x.kind + ")")).join(", ")}${home ? " · board " + home : ""}`) : home ? A(`no tree cohort · board ${home}`) : X("no cohort anywhere");
  return { ticker: s, name: F.name, kind: F.kind, batch: F.admitted, batch_words: BATCH_WORDS[F.admitted], tier: F.today, claude_check: F.claude_check, why_admitted: (ADM.info[s] || {}).why || null, checks: c, bars: b };
}
const AUD = admitted.map(audit);
const reds = AUD.flatMap((r) => Object.entries(r.checks).filter(([, x]) => x.v === "RED").map(([k, x]) => ({ ticker: r.ticker, check: k, why: x.why })));
const ambers = AUD.flatMap((r) => Object.entries(r.checks).filter(([, x]) => x.v === "AMBER").map(([k, x]) => ({ ticker: r.ticker, check: k, why: x.why })));
const byCheck = (arr) => arr.reduce((m, r) => ((m[r.check] = (m[r.check] || 0) + 1), m), {});

/* estate context for the bars check: the same walk for today's other 364 names */
const old = UNI.symbols.filter((s) => !batchOf[s]);
const staleWidthsOld = {}; for (const s of old) for (const [w, x] of Object.entries(barsOf(s))) if (x.state !== "FRESH") staleWidthsOld[disp(w)] = (staleWidthsOld[disp(w)] || 0) + 1;
const staleWidthsAdm = {}; for (const r of AUD) for (const [w, x] of Object.entries(r.bars)) if (x.state !== "FRESH") staleWidthsAdm[disp(w)] = (staleWidthsAdm[disp(w)] || 0) + 1;
const phase3D = {}; for (const s of UNI.symbols) { const t = tail[s] && tail[s]["3D"]; const d = t ? etDay(t.last) : null; (phase3D[d] ||= []).push(s); }

writeFileSync(join(DIR, "audit.json"), JSON.stringify({
  artifact_kind: "SCINTILLA_U4B_ADMISSION_AUDIT", built_utc: new Date().toISOString(), session: SESSION, names: AUD.length,
  status: "FACTS — nothing admitted, removed or written live; every snapshot taken read-only on 3 Oct 2026",
  counts: { red_cells: reds.length, amber_cells: ambers.length, names_with_red: new Set(reds.map((r) => r.ticker)).size, red_by_check: byCheck(reds), amber_by_check: byCheck(ambers) },
  estate: { stale_widths_admitted: staleWidthsAdm, stale_widths_other_364: staleWidthsOld, three_day_bar_phase: Object.fromEntries(Object.entries(phase3D).map(([d, a]) => [d, { names: a.length, admitted: a.filter((s) => batchOf[s]).length, by_batch: a.reduce((m, s) => ((m[batchOf[s] || "364"] = (m[batchOf[s] || "364"] || 0) + 1), m), {}) }])) },
  bookmarks_not_admitted: { CLSK: "held 24 Sep and again 28 Sep: one session the provider had and we did not store (gap report, last bar 2026-09-23)", SIVE: "held 24 Sep: no Massive data", TMRC: "held 24 Sep: thin OTC line" },
  reds, ambers, rows: AUD,
}, null, 0));

/* ── the facts table: today's 590 + U3's 242 in + its 151 off-Hub ─────────────────────────────────────────────────── */
const names = [...new Set([...UNI.symbols, ...U3.in.map((r) => r.ticker), ...U3.offhub.map((r) => r.ticker)])];
const FACTS = names.map(factsOf);
writeFileSync(join(DIR, "facts.json"), JSON.stringify({
  artifact_kind: "SCINTILLA_U4B_FACTS", built_utc: new Date().toISOString(),
  status: "FACTS ONLY — no recommendation per name; U5 designs the served set and Alan agrees before anything moves",
  scope: { today: UNI.count, universe_sha256: UNI.universe_sha256, u3_in: U3.in.length, u3_offhub: U3.offhub.length, rows: FACTS.length },
  sources: {
    universe: "chart API /universe 3 Oct 14:29Z", lists: LISTS.what + " · read " + LISTS.read_utc, funds: "U3 served-set-v2.json (2 Oct): hub_point_funds = funds whose live-tolerance Hub point counts the name; coverage_funds = funds whose close-tolerance coverage point counts it (off-Hub side)",
    cohorts: "tree deliverables/20260929/tree-map/tree.json parents (adopted / proposed / fund-set / pseudo cohorts) + public.tickers.cohort (the board's home) + public.ticker_membership",
    comps: `C4 (live) and C5 (${COMPS.c5 ? "hub/c5-comps-method-20261003 @" + COMPS.c5.sha + ", pushed, not live" : "not run"}) run over today's database rows for ${COMPS.companies} served companies — peer_of = how many of those sets keep the name`,
    bars: "deepest stored daily object (Massive deep_v1 D); none = never pulled", database: "Hub database read-only " + DB.read_utc,
  },
  rows: FACTS,
}, null, 0));
console.log(JSON.stringify({ audit: AUD.length, reds: reds.length, ambers: ambers.length, red_by_check: byCheck(reds), amber_by_check: byCheck(ambers), facts: FACTS.length, stale_adm: staleWidthsAdm, stale_old: staleWidthsOld }));

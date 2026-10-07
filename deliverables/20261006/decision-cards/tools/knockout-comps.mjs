/* CP1 · THE KNOCKOUT'S OWN RULE ON THE COMPS TAB'S FIGURES.
   knockout-run.mjs runs the live allocation tool as it is — and shows that its feed ("comps-feed") is not to be trusted
   tonight (Micron's revenue growth reads −59%, every forward P/E is 0, net margins of 85–94%; PA6 saw the same). So the
   same rule (KNOCKOUT-CONCEPT, PA6) is run here on the figures the Hub's comps reader holds (cohort.mjs, C5b one-currency),
   the settled 6 Oct closes, and the business lines of lines.mjs — before (C5's lines) and after (CP1's line fixes).

   THE RULE, as the allocation tool has it: only two companies in the same business line may duel · a company is scored
   on four readings against its line's field (the line's own companies when at least 5 are measured, else its family's),
   the price-outlier peers out first · each reading is 0 at the field's 25th and 1 at its 75th (a missing reading counts
   0.5) · first seed plays last · a duel is won on fundamentals when the scores are at least 0.02 apart, otherwise the
   Geiger decides the timing (the more washed-out name goes through) · champions never duel: they stand on a podium.
   THE FOUR READINGS here are the comps table's nearest columns (the tool's own are P/E or P/S, revenue growth, net margin,
   debt/equity): PRICE = trailing P/E, or P/S for a loss-maker (lower is better) · GROWTH = revenue, two years forward, a
   year: from the trailing twelve months to the consensus for the fiscal year after next (the comps table's "next FY"
   column is FY2 over FY1 and skips the year in progress — Micron +18% there, +55% a year here) · MARGIN = operating
   margin, trailing · LEVERAGE = net debt ÷ EBITDA
   (lower is better; net cash is best). The outlier votes are C6b's on the columns held: P/E (trailing or forward), P/S,
   EV/EBITDA.   node knockout-comps.mjs   (from the scratch folder: .anon, quotes-all-raw.json, cards-data.json) */
import { readFileSync, writeFileSync } from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)), WT = path.resolve(HERE, "../../../..");
const { inputs: c4inputs } = await import(WT + "/deliverables/20261001/comps-mechanic/read.mjs");
const { readCohort, snapshotFromCohort } = await import(WT + "/deliverables/20261001/comps-template/cohort.mjs");
const { linesOf, FAMILY_OF, CP1_LINES_OFF, CP1_LINES_ON, DUAL } = await import(WT + "/deliverables/20261003/comps-c5/lines.mjs");
const SB = "https://wadinxqplrggagkvrdag.supabase.co", KEY = readFileSync(".anon", "utf8").trim(), TODAY = "2026-10-06";
const CACHE = new Map();
const pg = async (p) => { if (CACHE.has(p)) return CACHE.get(p); for (let a = 0; a < 4; a++) { try { const r = await fetch(SB + "/rest/v1/" + p, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } }); if (!r.ok) throw new Error(p.split("?")[0] + " → " + r.status); const j = await r.json(); CACHE.set(p, j); return j; } catch (e) { if (a === 3) throw e; await new Promise((r) => setTimeout(r, 1500 * (a + 1))); } } };
const fetchJson = async (u) => JSON.parse(readFileSync(path.join(WT, u), "utf8"));
const RAW = JSON.parse(readFileSync("quotes-all-raw.json", "utf8")), CARDS = JSON.parse(readFileSync("cards-data.json", "utf8"));
const quotes = async (T) => ({ quotes: Object.fromEntries(T.map((t) => { const q = RAW.quotes[t]; return [t, q && q.today_session_close_state === "COMPLETED" && q.today_session_close > 0 ? { price: q.today_session_close, price_observation_utc: q.today_session_et + "T20:00:00Z" } : q && q.price > 0 ? { price: q.price, price_observation_utc: q.price_observation_utc } : null]; }).filter(([, q]) => q)) });
const fxStandin = JSON.parse(readFileSync(WT + "/deliverables/20261001/comps-template/fx-standin-ecb-2026-10-01.json", "utf8"));
fxStandin.reported = JSON.parse(readFileSync(WT + "/deliverables/20261003/comps-c5b/reporting-currency-fmp-2026-10-03.json", "utf8")).reported;
const inp = await c4inputs({ pg, fetchJson }), SEG = JSON.parse(readFileSync(WT + "/deliverables/20261003/comps-c5/segments-2026-10-03.json", "utf8")).companies;
const NAMES = "MU SNDK WDC STX NVDA AVGO GOOGL AMZN ORCL VST CEG BE NBIS IREN CRWV EQIX DLR IRM".split(" ");
const KO = { minField: 5, even: 0.02 }, PA6_HAND = { AMAT: 1, LRCX: 1, KLAC: 1, ASML: 1 }, CUT = 3.5, MIN_N = 5;
const med = (a) => { const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const FIG = new Map();   /* ticker → the comps table's figures, read once per field */
async function figures(members) {
  const need = members.filter((t) => !FIG.has(t)); if (!need.length) return;
  for (let i = 0; i < need.length; i += 40) {
    /* the reader asks its first name for a board tag (ticker_cohorts) even when the members are given, so every read is
       anchored on Micron, which carries one; the anchor's own figures come from the same read */
    const part = need.slice(i, i + 40), anchor = "MU";
    const ctx = await readCohort({ ticker: anchor, cohortAsked: null, today: TODAY, pg, quotes, fxStandin, membersAsked: [anchor, ...part.filter((t) => t !== anchor)], labelAsked: "knockout field" });
    const snap = snapshotFromCohort(ctx, anchor), m = (t, k) => { const r = snap.rows.find((x) => x.key === k); return t === anchor ? (r.own && r.own.multiple) : (r.values && r.values[t] ? r.values[t].multiple : null); };
    for (const t of part) { const row = t === anchor ? snap.table.company : snap.table.peers[t]; if (!row) { FIG.set(t, null); continue; } FIG.set(t, { pe: m(t, "pe_ttm") ?? null, pe_fwd: m(t, "pe_fwd") ?? null, ps: m(t, "ps") ?? null, ev_ebitda: m(t, "ev_ebitda") ?? null, growth: row.rev_g_2y ?? null, growth_next_fy: row.rev_g_fy ?? null, growth_ttm: row.rev_g_ttm ?? null, margin: row.om ?? null, leverage: row.nd_ebitda ?? null }); }
  }
}
function outliers(members) {   /* C6b on the columns held: P/E (either) · P/S · EV/EBITDA */
  const votes = [["P/E", ["pe", "pe_fwd"]], ["P/S", ["ps"]], ["EV/EBITDA", ["ev_ebitda"]]], cols = {};
  for (const [, keys] of votes) for (const k of keys) { const have = members.map((t) => [t, FIG.get(t) && FIG.get(t)[k]]).filter(([, v]) => v != null && Number.isFinite(v) && v > 0); if (have.length < MIN_N) { cols[k] = null; continue; } const xs = have.map(([, v]) => Math.log(v)), m = med(xs), dev = xs.map((x) => Math.abs(x - m)); let sp = med(dev) * 1.4826; if (!(sp > 0)) sp = dev.reduce((a, b) => a + b, 0) / dev.length * 1.2533; cols[k] = sp > 0 ? Object.fromEntries(have.map(([t], i) => [t, (xs[i] - m) / sp])) : null; }
  const out = new Set();
  for (const t of members) { let have = 0, n = 0; for (const [, keys] of votes) { const j = keys.filter((k) => cols[k] && t in cols[k]); if (!j.length) continue; have++; if (j.some((k) => Math.abs(cols[k][t]) > CUT)) n++; } if (n >= 3 || (n >= 2 && n / have >= 0.5)) out.add(t); }
  return out;
}
const vs = (v, d, dir) => { if (v == null || !Number.isFinite(v) || !d) return null; if (d.q3 <= d.q1) return 0.5; let t = (v - d.q1) / (d.q3 - d.q1); t = Math.max(0, Math.min(1, t)); return dir < 0 ? 1 - t : t; };
function score(sym, members) {
  const c = FIG.get(sym); if (!c) return { score: null, parts: [], n: 0, outliers: [], fieldN: 0 };
  const others = members.filter((m) => m !== sym && FIG.get(m)), O = outliers(others), field = others.filter((m) => !O.has(m));
  const quart = (key, pos) => { const v = field.map((m) => FIG.get(m)[key]).filter((x) => x != null && Number.isFinite(x) && (!pos || x > 0)).sort((a, b) => a - b); if (v.length < 4) return null; const q = (p) => { const i = (v.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (i - lo); }; return { n: v.length, q1: q(0.25), med: q(0.5), q3: q(0.75) }; };
  const parts = [], pk = c.pe > 0 ? "pe" : c.ps > 0 ? "ps" : null, f1 = (x) => (+x).toFixed(1);
  if (pk) { const d = quart(pk, true), t = vs(c[pk], d, -1); if (t != null) parts.push(["price", t, `${pk === "pe" ? "P/E" : "P/S"} ${f1(c[pk])} against the field's ${f1(d.q1)} / ${f1(d.med)} / ${f1(d.q3)} (${d.n})`]); }
  for (const [key, label, dir, unit] of [["growth", "growth", 1, "%"], ["margin", "margin", 1, "%"], ["leverage", "leverage", -1, "×"]]) { if (c[key] == null) continue; const d = quart(key, false), t = vs(c[key], d, dir); if (t == null) continue; const f = (x) => (unit === "%" ? Math.round(x) + "%" : (+x).toFixed(1) + "×"); parts.push([label, t, `${label === "growth" ? "revenue, two years forward, a year" : label === "margin" ? "operating margin" : "net debt ÷ EBITDA"} ${f(c[key])} against ${f(d.q1)} / ${f(d.med)} / ${f(d.q3)} (${d.n})`]); }
  if (!parts.length) return { score: null, parts, n: 0, outliers: [...O], fieldN: field.length };
  return { score: (parts.reduce((t, p) => t + p[1], 0) + 0.5 * (4 - parts.length)) / 4, parts, n: parts.length, outliers: [...O], fieldN: field.length };
}
const G = (t) => (CARDS.names[t] && CARDS.names[t].geiger ? CARDS.names[t].geiger : {});
async function run(fx, label) {
  const LINES = {};
  for (const [t, p] of Object.entries(inp.profiles)) { if (p.is_etf || !p.industry || (DUAL[t] && inp.profiles[DUAL[t]])) continue; let L = linesOf(t, p, SEG[t] || null, fx); if (PA6_HAND[t]) L = { ...L, lines: { "semiconductor equipment": 1 }, family: "SEMIS" }; LINES[t] = L; }
  const dom = (t) => (LINES[t] ? Object.entries(LINES[t].lines).sort((a, b) => b[1] - a[1])[0][0] : null);
  const lineMembers = (ln) => Object.keys(LINES).filter((t) => dom(t) === ln), famMembers = (f) => Object.keys(LINES).filter((t) => FAMILY_OF(dom(t)) === f);
  const groups = {}; for (const t of NAMES) { const ln = dom(t) || "(no business line)"; (groups[ln] ||= []).push(t); }
  const lines = [];
  for (const [ln, ts] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))) {
    const lm = lineMembers(ln); await figures(lm);
    const measured = lm.filter((t) => FIG.get(t) && (FIG.get(t).pe > 0 || FIG.get(t).ps > 0));
    let scale = { level: "line", name: ln, members: lm };
    if (measured.length < KO.minField) { const fam = FAMILY_OF(ln), fm = famMembers(fam); await figures(fm); scale = { level: "family", name: fam, members: fm }; }
    const all = ts.map((t) => { const R = score(t, scale.members), g = G(t); return { sym: t, line: ln, lineShare: LINES[t].lines[ln], score: R.score, n: R.n, parts: R.parts, outliers: R.outliers, fieldN: R.fieldN, g: g.live ?? null, g_pctl: g.pctl ?? null, fig: FIG.get(t) }; });
    const entrants = all.filter((e) => e.score != null && e.n >= 2).sort((a, b) => b.score - a.score || (a.g ?? 0) - (b.g ?? 0)); entrants.forEach((e, i) => (e.seed = i + 1));
    const sitOut = all.filter((e) => !entrants.includes(e)), rounds = []; let round = [...entrants];
    const f2 = (x) => (x == null ? "—" : (x >= 0 ? "+" : "") + x.toFixed(2));
    while (round.length > 1) { const arr = [...round], matches = [], next = [];
      while (arr.length > 1) { const a = arr.shift(), b = arr.pop(), d = a.score - b.score; let m;
        if (Math.abs(d) >= KO.even) { const w = d > 0 ? a : b, l = d > 0 ? b : a, L = Object.fromEntries(l.parts.map((p) => [p[0], p[1]])), on = w.parts.filter((p) => L[p[0]] != null && p[1] > L[p[0]]).map((p) => p[0]); m = { a: a.sym, b: b.sym, winner: w.sym, loser: l.sym, on: "fundamentals", why: `${w.sym} wins on fundamentals, ${w.score.toFixed(2)} against ${l.score.toFixed(2)}${on.length ? " — better on " + on.join(", ") : ""}. The Geiger only says when: ${w.sym} ${f2(w.g)}.` }; next.push(w); }
        else { const w = (a.g ?? 0) <= (b.g ?? 0) ? a : b, l = w === a ? b : a; m = { a: a.sym, b: b.sym, winner: w.sym, loser: l.sym, on: "timing", why: `Even on fundamentals (${a.score.toFixed(2)} and ${b.score.toFixed(2)}, less than ${KO.even} apart), so the Geiger decides the timing: ${w.sym} reads ${f2(w.g)} against ${l.sym} ${f2(l.g)}.` }; next.push(w); }
        matches.push(m); }
      if (arr.length) { matches.push({ a: arr[0].sym, b: null, winner: arr[0].sym, loser: null, on: "bye", why: `${arr[0].sym} has no opponent left this round and goes through.` }); next.push(arr[0]); }
      rounds.push(matches); round = next.sort((x, y) => x.seed - y.seed); }
    lines.push({ line: ln, scale: { level: scale.level, name: scale.name, members: scale.members.length, measured: measured.length }, unopposed: entrants.length === 1, entrants, sitOut, rounds, champion: round[0] ? round[0].sym : null });
  }
  const byName = Object.fromEntries(lines.flatMap((l) => [...l.entrants, ...l.sitOut]).map((e) => [e.sym, e]));
  const podium = lines.filter((l) => l.champion).map((l) => byName[l.champion]).sort((a, b) => b.score - a.score || (a.g ?? 0) - (b.g ?? 0)).map((e) => ({ sym: e.sym, line: e.line, score: e.score, g: e.g, g_pctl: e.g_pctl }));
  const ranked = Object.values(byName).filter((e) => e.score != null).sort((a, b) => b.score - a.score).map((e) => ({ sym: e.sym, line: e.line, score: e.score, n: e.n, g: e.g, g_pctl: e.g_pctl }));
  console.log(label, "· lines", lines.length, "· podium", podium.map((p) => p.sym + " " + p.score.toFixed(2)).join(", "));
  return { label, lines, podium, ranked };
}
const before = await run(CP1_LINES_OFF, "before"), after = await run(CP1_LINES_ON, "after");
/* hot against cold: the name's Geiger against its OWN year (percentile), beside its fundamentals score */
const R = after.ranked.filter((e) => e.g_pctl != null), hot = R.filter((e) => e.g_pctl >= 67), cold = R.filter((e) => e.g_pctl <= 33), mid = R.filter((e) => e.g_pctl > 33 && e.g_pctl < 67), avg = (a) => (a.length ? a.reduce((s, e) => s + e.score, 0) / a.length : null);
const n = R.length, mx = avg(R.map((e) => ({ score: e.g_pctl }))), my = avg(R), cov = R.reduce((s, e) => s + (e.g_pctl - mx) * (e.score - my), 0), vx = R.reduce((s, e) => s + (e.g_pctl - mx) ** 2, 0), vy = R.reduce((s, e) => s + (e.score - my) ** 2, 0);
const hotcold = { hot: hot.map((e) => e.sym), cold: cold.map((e) => e.sym), middle: mid.map((e) => e.sym), hot_avg: avg(hot), cold_avg: avg(cold), middle_avg: avg(mid), n, correlation: vx > 0 && vy > 0 ? cov / Math.sqrt(vx * vy) : null, no_percentile: after.ranked.filter((e) => e.g_pctl == null).map((e) => e.sym), cuts: "hot = at or above the 67th percentile of its own year's Geiger; cold = at or below the 33rd" };
writeFileSync("knockout-comps.json", JSON.stringify({ taken_utc: new Date().toISOString(), today: TODAY, names: NAMES, rule: KO, before, after, hotcold }, null, 1));
console.log("hot", hotcold.hot.join(" "), "avg", hotcold.hot_avg && hotcold.hot_avg.toFixed(2), "· cold", hotcold.cold.join(" "), "avg", hotcold.cold_avg && hotcold.cold_avg.toFixed(2), "· middle", hotcold.middle.join(" "), "avg", hotcold.middle_avg && hotcold.middle_avg.toFixed(2), "· corr", hotcold.correlation && hotcold.correlation.toFixed(2));

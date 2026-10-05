/* Scintilla · PA1 portfolio allocation (5 Oct 2026) · THE CHAIN'S ARITHMETIC, stated once. Pure: no fetch, no DOM, no clock.
   The page and the tests import this same file. METHOD.md is the prose; this is the maths.

   heat → themes × rotation → knockout in a cohort → picks (Alan, 25 Sep). No universal thresholds: every level is a
   rank among its own peers (a RANK SCORE, 0 = worst … 1 = best, the percentile of the members that carry the number),
   and the operator decides the entry level. Every judgement is a dial with a baseline (DIALS). */

export const DIALS = {
  hot_n: 3,                    // how many sectors are HOT (and how many COLD)
  cohorts_per_sector: 3,       // the soundest K cohorts of a hot/cold sector run a knockout
  heat_w: { names: 1, funds: 1, rotation: 1, bowtie: 0 },   // the heat rank's legs (bow tie off by default: it is printed, not ranked)
  ko_w: { comps: 50, target: 20, revision: 10, geiger: 20 }, // the knockout's readings
  outlier_mad: 3,              // a member whose comps upside sits beyond this many MADs from the cohort median is out of the ranking (0 = off)
  survivors: 3,                // how many survive a knockout
  min_firms: 3,                // fewer firms than this = no target reading (a named blank)
  chain_w: { heat: 1, knockout: 2 },   // the discussion view's full-chain score
};
export const num = (v) => (v == null || v === "" || !Number.isFinite(Number(v))) ? null : Number(v);
export const mean = (a) => { const v = (a || []).map(num).filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
export const median = (a) => { const v = (a || []).map(num).filter((x) => x != null).sort((x, y) => x - y); if (!v.length) return null; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };

/** Rank score of each item on key: the share of the OTHER items carrying the number that it beats (ties half). 1 item → 0.5. null → null. */
export function rankScores(items, key, better = "high") {
  const have = items.map((it) => num(it[key]));
  const vals = have.filter((x) => x != null);
  return items.map((_, i) => {
    const x = have[i]; if (x == null) return null;
    if (vals.length < 2) return 0.5;
    let below = 0, eq = 0;
    for (const y of vals) { if (y < x) below++; else if (y === x) eq++; }
    const others = vals.length - 1, beats = below + (eq - 1) / 2;   // eq counts itself once
    const s = beats / others;
    return better === "high" ? s : 1 - s;
  });
}

/** The 72-session (or h) log return of a closing series' last bar; null when too short. */
export function logReturn(closes, h) { const c = (closes || []).map(num); if (c.length <= h) return null; const a = c[c.length - 1 - h], b = c[c.length - 1]; return a > 0 && b > 0 ? Math.log(b / a) : null; }

/** HEAT. sectors: [{ key, names, funds, rotation, bowtie }] → each gets rank scores and a heat score (weighted mean of the legs it has);
    returns { ranked (hot → cold), hot: [keys], cold: [keys] }. A sector with no leg at all has heat null and is neither. */
export function heat(sectors, dials = DIALS) {
  const w = { ...DIALS.heat_w, ...(dials.heat_w || {}) }, n = dials.hot_n ?? DIALS.hot_n;
  const legs = ["names", "funds", "rotation", "bowtie"], rs = Object.fromEntries(legs.map((k) => [k, rankScores(sectors, k, "high")]));
  const out = sectors.map((s, i) => {
    let sw = 0, acc = 0; const scores = {};
    for (const k of legs) { scores[k] = rs[k][i]; if ((w[k] || 0) > 0 && rs[k][i] != null) { acc += w[k] * rs[k][i]; sw += w[k]; } }
    return { ...s, rank_scores: scores, heat: sw > 0 ? acc / sw : null };
  });
  const ranked = out.filter((s) => s.heat != null).sort((a, b) => b.heat - a.heat || String(a.key).localeCompare(String(b.key)));
  ranked.forEach((s, i) => { s.heat_rank = i + 1; });
  const hot = ranked.slice(0, n).map((s) => s.key), cold = ranked.slice(Math.max(n, ranked.length - n)).map((s) => s.key);
  return { ranked, hot, cold, unranked: out.filter((s) => s.heat == null) };
}

/** The sector a cohort belongs to: the one holding the most members (share printed). members: [{ ticker, sector }]. */
export function cohortSector(members) {
  const c = {}; let n = 0;
  for (const m of members || []) if (m && m.sector) { c[m.sector] = (c[m.sector] || 0) + 1; n++; }
  const best = Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return best ? { sector: best[0], share: best[1] / n, counted: n } : { sector: null, share: 0, counted: 0 };
}

/** T12's soundness, as measured (the file carries `sound`); a cohort with no measure is not sound. */
export const isSound = (measure) => !!(measure && measure.sound === true);

/** ANALYST TARGET from A4-cleaned notes. notes: [{ firm, published_utc (ISO), target }] already clean; today: ISO date.
    The firms' newest note inside `days` → { n, median, mean, lo, hi }; fewer than minFirms → reading null (named blank). */
export function targetFromNotes(notes, today, { days = 183, minFirms = DIALS.min_firms } = {}) {
  const t0 = Date.parse(today + "T23:59:59Z"), since = t0 - days * 86400e3, by = new Map();
  for (const r of notes || []) { const ms = Date.parse(r.published_utc), v = num(r.target); if (!(ms > since && ms <= t0) || v == null || v <= 0 || !r.firm) continue; const k = String(r.firm).trim().toLowerCase(); const o = by.get(k); if (!o || o.ms < ms) by.set(k, { ms, v }); }
  const vs = [...by.values()].map((x) => x.v).sort((a, b) => a - b), n = vs.length;
  if (n < Math.max(1, minFirms)) return { n, median: null, mean: null, lo: null, hi: null, why: n ? `only ${n} firm${n === 1 ? "" : "s"} inside ${days} days` : "no clean note" };
  return { n, median: median(vs), mean: mean(vs), lo: vs[0], hi: vs[n - 1] };
}

/** REVISION DIRECTION: among firms with a note in the last `recent` days, raised − lowered against the same firm's previous
    note (any earlier one inside `days`), over the firms that moved: −1 … +1; null when no firm moved. */
export function revisionDirection(notes, today, { recent = 30, days = 183 } = {}) {
  const t0 = Date.parse(today + "T23:59:59Z"), since = t0 - days * 86400e3, rec = t0 - recent * 86400e3, by = {};
  for (const r of notes || []) { const ms = Date.parse(r.published_utc), v = num(r.target); if (!(ms > since && ms <= t0) || v == null || v <= 0 || !r.firm) continue; (by[String(r.firm).trim().toLowerCase()] ||= []).push({ ms, v }); }
  let up = 0, down = 0, flat = 0;
  for (const list of Object.values(by)) { list.sort((a, b) => a.ms - b.ms); const last = list[list.length - 1]; if (last.ms < rec || list.length < 2) continue; const prev = list[list.length - 2]; if (last.v > prev.v) up++; else if (last.v < prev.v) down++; else flat++; }
  const moved = up + down;
  return { up, down, flat, direction: moved ? (up - down) / moved : null };
}

/** OUTLIERS on the comps upside: beyond k MADs (×1.4826) from the cohort's median → candidate for elimination. k = 0 → off. */
export function upsideOutliers(members, k = DIALS.outlier_mad) {
  const vals = members.map((m) => num(m.comps_upside)).filter((x) => x != null);
  if (!(k > 0) || vals.length < 5) return { out: [], median: median(vals), mad: null, fence: null };
  const m = median(vals), mad = median(vals.map((v) => Math.abs(v - m))) * 1.4826;
  if (!(mad > 0)) return { out: [], median: m, mad: 0, fence: null };
  const lo = m - k * mad, hi = m + k * mad;
  return { out: members.filter((x) => { const v = num(x.comps_upside); return v != null && (v < lo || v > hi); }).map((x) => ({ ticker: x.ticker, value: num(x.comps_upside), side: num(x.comps_upside) > hi ? "high" : "low", z: (num(x.comps_upside) - m) / mad })), median: m, mad, fence: { lo, hi } };
}

/** KNOCKOUT inside one cohort. members: [{ ticker, comps_upside, target_upside, revision, geiger }], the cohort's geiger mean is
    taken here; returns every member with rank scores, score, verdict (SURVIVES · OUT · OUTLIER · BLANK) and the survivors. */
export function knockout(members, dials = DIALS) {
  const w = { ...DIALS.ko_w, ...(dials.ko_w || {}) }, S = dials.survivors ?? DIALS.survivors, k = dials.outlier_mad ?? DIALS.outlier_mad;
  const gMean = mean(members.map((m) => m.geiger));
  const withRel = members.map((m) => ({ ...m, geiger_rel: num(m.geiger) != null && gMean != null ? num(m.geiger) - gMean : null }));
  const ol = upsideOutliers(withRel, k), outSet = new Set(ol.out.map((o) => o.ticker));
  const inRing = withRel.filter((m) => !outSet.has(m.ticker));
  const rs = { comps: rankScores(inRing, "comps_upside"), target: rankScores(inRing, "target_upside"), revision: rankScores(inRing, "revision"), geiger: rankScores(inRing, "geiger_rel") };
  const scored = inRing.map((m, i) => { let acc = 0, sw = 0; const scores = {}; for (const key of Object.keys(w)) { scores[key] = rs[key][i]; if ((w[key] || 0) > 0 && rs[key][i] != null) { acc += w[key] * rs[key][i]; sw += w[key]; } } return { ...m, rank_scores: scores, score: sw > 0 ? acc / sw : null, readings: Object.values(scores).filter((x) => x != null).length }; });
  const ranked = scored.filter((m) => m.score != null).sort((a, b) => b.score - a.score || (b.readings - a.readings) || a.ticker.localeCompare(b.ticker));
  ranked.forEach((m, i) => { m.place = i + 1; m.verdict = i < S ? "SURVIVES" : "OUT"; });
  const blanks = scored.filter((m) => m.score == null).map((m) => ({ ...m, place: null, verdict: "BLANK" }));
  const outliers = withRel.filter((m) => outSet.has(m.ticker)).map((m) => ({ ...m, place: null, verdict: "OUTLIER", outlier: ol.out.find((o) => o.ticker === m.ticker) }));
  return { geiger_mean: gMean, members: [...ranked, ...outliers, ...blanks], survivors: ranked.slice(0, S).map((m) => m.ticker), outliers: ol, weights: w, survivors_n: S };
}

/** One line of reasons for a name. */
export function reasonLine(m, cohort, sector) {
  const p = (v, d = 0) => v == null ? "—" : (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(d) + "%";
  const g = (v) => v == null ? "—" : (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2);
  return [sector ? `${sector.label || sector.key} heat #${sector.heat_rank ?? "—"}` : null, cohort ? `${cohort.label} (${cohort.sound ? "sound" : "thin"})` : null,
    `comps #${m.place ?? "—"} · way C ${p(m.comps_upside)}`, m.target_upside != null ? `target ${p(m.target_upside)} (${m.target_n} firms)` : "target —", m.revision != null ? `revisions ${m.revision > 0 ? "up" : m.revision < 0 ? "down" : "flat"}` : null,
    `Geiger ${g(m.geiger)} (${g(m.geiger_rel)} vs cohort)`].filter(Boolean).join(" · ");
}

/** PICKS: the survivors of the hot sectors' cohorts, deduped (a name keeps its best score). rows: [{ ticker, score, cohort, sector, ... }]. */
export function dedupePicks(rows) {
  const best = new Map();
  for (const r of rows) { const o = best.get(r.ticker); if (!o || (r.score ?? -1) > (o.score ?? -1)) best.set(r.ticker, r); }
  return [...best.values()].sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.ticker.localeCompare(b.ticker));
}

/** THE DISCUSSION VIEW: the full chain over every name that ran a knockout: heat rank score of its sector (0..1 by heat rank) + knockout score. */
export function fullChain(rows, sectorsRanked, dials = DIALS) {
  const w = { ...DIALS.chain_w, ...(dials.chain_w || {}) }, n = sectorsRanked.length;
  const hs = Object.fromEntries(sectorsRanked.map((s, i) => [s.key, n > 1 ? 1 - i / (n - 1) : 0.5]));
  const all = dedupePicks(rows.filter((r) => r.score != null).map((r) => { const h = hs[r.sector_key]; const chain = h == null ? r.score : (w.heat * h + w.knockout * r.score) / (w.heat + w.knockout); return { ...r, heat_score: h ?? null, chain }; }).map((r) => ({ ...r, score: r.chain, ko_score: r.score })));
  return { all, strongest: all.slice(0, 5), weakest: all.slice(-5).reverse(), weights: w };
}

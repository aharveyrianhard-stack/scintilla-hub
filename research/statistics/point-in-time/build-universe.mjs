/* N9 · build the point-in-time universe from the raw pulls (28 Sep 2026).
   node research/statistics/point-in-time/build-universe.mjs [--root <cache dir>]
   Reads  <root>/raw/{lists,caps,bars0..3}.json.gz — pulled inside Fly (FMP constituent lists and change logs,
          FMP historical market caps reduced to month-end, Massive daily bars by ticker over each membership
          window ± ~15 months). No key or network here.
   Writes <root>/{membership.json.gz, caps-monthly.json.gz, bars-pit.json.gz, manifest.json}. */
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { buildMembership, membersOn, everMembers, dailyDelta } from "./pit-core.mjs";

export const PIT_ROOT = path.join(os.homedir(), "Library/Application Support/scintilla/stats-cache/point-in-time/v1");
export const FLOOR = "2003-01-02", LAST = "2026-09-25";
export const MAX_HOLE_DAYS = 20;
const rd = (f) => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString());
const wr = (f, o) => fs.writeFileSync(f, zlib.gzipSync(Buffer.from(JSON.stringify(o))));
const ds = (t) => new Date(t).toISOString().slice(0, 10);

/** Raw Massive rows ([dayOffset,o,h,l,c,v] from t0) → [{d,o,h,l,c,v}]. */
export function expandBars(raw) {
  if (!raw || !raw.rows) return null;
  return raw.rows.map(([k, o, h, l, c, v]) => ({ d: ds(raw.t0 + k * 864e5), o, h, l, c, v }));
}

/** Old-ticker bars joined in front of the current ticker's, only when the join is continuous (≤ 25% jump). */
export function joinOld(oldBars, cur) {
  if (!cur.length) return null;
  const pre = oldBars.filter((b) => b.d < cur[0].d).sort((a, b) => a.d.localeCompare(b.d));
  if (!pre.length) return null;
  const jump = Math.abs(Math.log(cur[0].c / pre.at(-1).c));
  return jump <= Math.log(1.25) ? pre.concat(cur) : null;
}

/** Share of a member stretch's sessions that carry a bar, and the biggest hole inside the stretch. */
export function stretchCoverage(bars, sessions, from, to) {
  const inS = sessions.filter((d) => d >= from && d <= to);
  if (!inS.length) return { sessions: 0, withBar: 0, share: null, maxHoleDays: 0, firstBar: null };
  const have = new Set((bars || []).map((b) => b.d));
  const withBar = inS.filter((d) => have.has(d)).length;
  const inB = (bars || []).filter((b) => b.d >= from && b.d <= to).map((b) => b.d);
  let maxHole = 0;
  for (let i = 1; i < inB.length; i++) maxHole = Math.max(maxHole, (Date.parse(inB[i]) - Date.parse(inB[i - 1])) / 864e5);
  if (inB.length) { maxHole = Math.max(maxHole, (Date.parse(inB[0]) - Date.parse(inS[0])) / 864e5, (Date.parse(inS.at(-1)) - Date.parse(inB.at(-1))) / 864e5); }
  return { sessions: inS.length, withBar, share: withBar / inS.length, maxHoleDays: Math.round(maxHole), firstBar: inB[0] ?? null };
}

export function build(root = PIT_ROOT) {
  const raw = path.join(root, "raw");
  const L = rd(path.join(raw, "lists.json.gz")); let caps = rd(path.join(raw, "caps.json.gz"));
  const bars = {}; for (let i = 0; i < 4; i++) Object.assign(bars, rd(path.join(raw, `bars${i}.json.gz`)));
  const idx = {
    SP500: buildMembership(L.sp500_current.map((r) => r.symbol), L.sp500_changes, { floor: FLOOR, asOf: L.pulled_utc }),
    NDX: buildMembership(L.ndx_current.map((r) => r.symbol), L.ndx_changes, { floor: FLOOR, asOf: L.pulled_utc }),
  };
  // the session calendar: every date AAPL traded (it traded every NYSE session since 2002)
  const sessions = expandBars(bars.AAPL).map((b) => b.d).filter((d) => d >= FLOOR && d <= LAST);
  const B0 = {}; for (const [s, r] of Object.entries(bars)) { const x = expandBars(r); if (x) B0[s] = x; }
  const EV = rd(path.join(raw, "events.json.gz")), FILL = rd(path.join(raw, "fill.json.gz")), SPL = rd(path.join(raw, "splits.json.gz"));
  const old = {}; for (const [k, r] of Object.entries(EV.oldBars)) { const [s] = k.split("|"); (old[s] ??= []).push(...expandBars(r)); }
  const fmpB = {}; for (const [s, rows] of Object.entries(FILL.fmpBars)) fmpB[s] = rows.map(([d, o, h, l, c, v]) => ({ d, o, h, l, c, v }));
  // one series per name, chosen by how much of its membership it covers (never mixed, except a checked old-ticker join)
  const memberDays = (sym) => { const set = new Set(); for (const M of Object.values(idx)) for (const iv of M.intervals) if (iv.sym === sym && !(iv.to != null && iv.to < FLOOR)) for (const d of sessions) if (d >= (iv.from ?? FLOOR) && d <= (iv.to ?? LAST)) set.add(d); return set; };
  const B = {}, barSource = {};
  for (const sym of new Set([...Object.keys(B0), ...Object.keys(old), ...Object.keys(fmpB)])) {
    const cands = [];
    if (B0[sym]) cands.push({ src: "massive", bars: B0[sym] });
    if (old[sym] && B0[sym]) { const j = joinOld(old[sym], B0[sym]); if (j) cands.push({ src: "massive+old-ticker", bars: j }); }
    else if (old[sym]) cands.push({ src: "massive-old-ticker", bars: old[sym].sort((a, b) => a.d.localeCompare(b.d)) });
    if (fmpB[sym]) cands.push({ src: "fmp-eod", bars: fmpB[sym] });
    if (cands.length === 1) { B[sym] = cands[0].bars; barSource[sym] = cands[0].src; continue; }
    const want = memberDays(sym); let best = null;
    for (const c of cands) { const have = c.bars.reduce((a, b) => a + (want.has(b.d) ? 1 : 0), 0); if (!best || have > best.have + 5) best = { ...c, have }; }
    B[sym] = best.bars; barSource[sym] = best.src;
  }
  // caps: FMP month-end first; else month-end close × Massive's dated share count (split-corrected), flagged
  const capSource = {};
  for (const s of Object.keys(caps)) if (caps[s]) capSource[s] = "fmp";
  for (const [s, pts] of Object.entries(FILL.shares)) {
    if (caps[s] || !B[s]) continue;
    const sp = (SPL[s] || []).map(([d, f, t]) => ({ d, r: t / f }));
    const me = new Map(); for (const b of B[s]) me.set(b.d.slice(0, 7), b);
    const P = pts.map(([d, w, c]) => [d, w || c]).filter(([, n]) => n).sort((a, b) => a[0].localeCompare(b[0]));
    if (!P.length) continue;
    const rows = [];
    for (const b of [...me.values()].sort((a, c) => a.d.localeCompare(c.d))) {
      let n = null; for (const [d, v] of P) if (d <= b.d) n = { d, v }; if (!n) { if (Date.parse(P[0][0]) - Date.parse(b.d) > 366 * 864e5) continue; n = { d: P[0][0], v: P[0][1] }; }
      const F = sp.filter((x) => x.d > b.d).reduce((a, x) => a * x.r, 1), Fs = sp.filter((x) => x.d > n.d).reduce((a, x) => a * x.r, 1);
      rows.push([b.d, Math.round(b.c * F * n.v * Fs / F / 1e6)]); // raw close = adj × F(d); shares as of n.d restated to d's basis
    }
    if (rows.length) { caps[s] = rows; capSource[s] = "price×shares (Massive dated shares)"; }
  }
  const out = { membership: {}, coverage: {}, lacking: {} };
  for (const [name, M] of Object.entries(idx)) {
    const cov = [];
    for (const iv of M.intervals) {
      if (iv.to != null && iv.to < FLOOR) continue;
      const from = iv.from ?? FLOOR, to = iv.to ?? LAST;
      const c = stretchCoverage(B[iv.sym], sessions, from < FLOOR ? FLOOR : from, to);
      const cap = caps[iv.sym] ? caps[iv.sym].filter(([d]) => d >= from.slice(0, 7) && d <= to).length : 0;
      cov.push({ sym: iv.sym, from: iv.from, to: iv.to, ...c, share: c.share == null ? null : Math.round(c.share * 1000) / 1000, capMonths: cap, hasCap: !!caps[iv.sym], barSource: barSource[iv.sym] ?? null, capSource: capSource[iv.sym] ?? null });
    }
    const counts = sessions.filter((_, i) => i % 21 === 0).map((d) => ({ d, n: membersOn(M.intervals, d).length }));
    out.membership[name] = { intervals: M.intervals, anomalies: M.anomalies, daily: dailyDelta(M.intervals, sessions), countSample: counts };
    out.coverage[name] = cov;
    out.lacking[name] = cov.filter((c) => c.share == null || c.share < 0.95).map((c) => ({ sym: c.sym, from: c.from, to: c.to, share: c.share, firstBar: c.firstBar }));
  }
  // bars only inside [first membership − 400d, last membership], so a reused ticker's other life is left out
  const keep = {};
  for (const name of Object.keys(idx)) for (const iv of idx[name].intervals) {
    if (iv.to != null && iv.to < FLOOR || !B[iv.sym]) continue;
    const lo = new Date(Date.parse((iv.from ?? FLOOR) + "T00:00:00Z") - 400 * 864e5).toISOString().slice(0, 10), hi = iv.to ?? LAST;
    const k = keep[iv.sym] ?? (keep[iv.sym] = { lo, hi }); if (lo < k.lo) k.lo = lo; if (hi > k.hi) k.hi = hi;
  }
  const barsPit = {}; for (const [s, k] of Object.entries(keep)) barsPit[s] = B[s].filter((b) => b.d >= k.lo && b.d <= k.hi).map((b) => [b.d, b.o, b.h, b.l, b.c, b.v]);
  const capsKept = {}; for (const s of Object.keys(keep)) if (caps[s]) capsKept[s] = caps[s];
  const srcCount = (o) => Object.values(o).reduce((a, v) => (a[v] = (a[v] || 0) + 1, a), {});
  const summarize = (name) => {
    const cov = out.coverage[name], M = idx[name], cs = Object.values(M.countByChangeDate);
    return { ever_members: everMembers(M.intervals, FLOOR).length, stretches: cov.length, stretches_full_bars: cov.filter((c) => c.share != null && c.share >= 0.95).length,
      stretches_partial_bars: cov.filter((c) => c.share != null && c.share > 0 && c.share < 0.95).length, stretches_no_bars: cov.filter((c) => !c.share).length,
      member_sessions: cov.reduce((a, c) => a + c.sessions, 0), member_sessions_with_bar: cov.reduce((a, c) => a + c.withBar, 0),
      names_without_cap: [...new Set(cov.filter((c) => !c.hasCap).map((c) => c.sym))].length,
      member_count_min: Math.min(...cs), member_count_max: Math.max(...cs), anomalies: M.anomalies.length };
  };
  const manifest = {
    dataset: "scintilla research · point-in-time index membership", version: "v1", built_utc: new Date().toISOString(), floor: FLOOR, last_session: LAST, sessions: sessions.length,
    sources: {
      membership: "FMP /stable/sp500-constituent + /stable/historical-sp500-constituent; /stable/nasdaq-constituent + /stable/historical-nasdaq-constituent (pulled " + L.pulled_utc + " inside Fly, scintilla-massive-stocks-batch)",
      caps: "FMP /stable/historical-market-capitalization, reduced to the last value of each month, $ millions",
      bars: "Massive /v2/aggs/ticker/{T}/range/1/day (adjusted=true) by ticker over each membership window ± ~15 months, inside Fly",
      calendar: "the sessions AAPL traded (Massive)", check: "SPY's own quarterly N-PORT holdings 2019-09 → 2026-06 (FMP, cached by the leaders lane)",
    },
    method: "Start from today's list and undo each change date, newest first; one interval per membership stretch. Tickers are FMP's (renamed members carry today's ticker). Records that do not fit the walk are listed under anomalies, never fixed silently.",
    SP500: summarize("SP500"), NDX: summarize("NDX"), bar_sources: srcCount(barSource), cap_sources: srcCount(capSource),
    files: { "membership.json.gz": "intervals, anomalies, daily add/remove list from 2003, coverage per stretch, members lacking bars", "caps-monthly.json.gz": "{sym: [[date, $m], …]}", "bars-pit.json.gz": "{sym: [[date,o,h,l,c,v], …]} inside each membership window (−400 days)" },
  };
  wr(path.join(root, "membership.json.gz"), { ...out, manifest });
  wr(path.join(root, "caps-monthly.json.gz"), capsKept);
  wr(path.join(root, "bars-pit.json.gz"), barsPit);
  fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify(manifest, null, 1));
  return { manifest, out };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const i = process.argv.indexOf("--root"), root = i > 0 ? process.argv[i + 1] : PIT_ROOT;
  const t0 = Date.now(), { manifest, out } = build(root);
  console.log(JSON.stringify({ SP500: manifest.SP500, NDX: manifest.NDX, sessions: manifest.sessions }, null, 1));
  console.log("SP500 lacking (first 40):", out.lacking.SP500.slice(0, 40).map((x) => `${x.sym}:${x.share ?? "none"}`).join(" "));
  console.log("secs", ((Date.now() - t0) / 1000).toFixed(1));
}

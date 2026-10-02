/* Scintilla · A1 analytics knockouts (2 Oct) · the round robin inside a group, stated once. Pure: no fetch, no DOM.
   The page and the tests import this same file.

   A GAME is one pairing. It is decided by a small, named set of COMPARISONS; each comparison is a visible win / loss
   with its two numbers. A comparison with a missing number on either side is NOT PLAYED (a missing input is a named
   blank, never a loss). The game goes to the side with more weighted comparison points; equal points is a draw.
   STANDINGS: a win is one point, a draw a half. Ties are broken by the head-to-head game, then by comparison points won
   over the whole round, then by ticker. The top K advance.
   Every comparison's on/off, direction and weight is a toggle; the baselines are below. */

import { num } from "./stats.mjs";

export const COMPARISONS = [
  { key: "up_a",      label: "upside, way A (range of the medians)",  group: "upside",        better: "high", weight: 1, on: true,  fmt: "pct" },
  { key: "up_b",      label: "upside, way B (middle-half band)",      group: "upside",        better: "high", weight: 1, on: true,  fmt: "pct" },
  { key: "up_c",      label: "upside, way C (reliability-weighted)",  group: "upside",        better: "high", weight: 1, on: true,  fmt: "pct" },
  { key: "rev_g_fy",  label: "revenue growth, next FY estimate",      group: "growth",        better: "high", weight: 1, on: true,  fmt: "pct" },
  { key: "eps_g_fy",  label: "EPS growth, next FY estimate",          group: "growth",        better: "high", weight: 1, on: true,  fmt: "pct" },
  { key: "om",        label: "operating margin",                      group: "margins",       better: "high", weight: 1, on: true,  fmt: "pct" },
  { key: "fcfm",      label: "free-cash-flow margin",                 group: "margins",       better: "high", weight: 1, on: true,  fmt: "pct" },
  { key: "nd_ebitda", label: "net debt over EBITDA",                  group: "balance sheet", better: "low",  weight: 1, on: true,  fmt: "x" },
  { key: "geiger",    label: "Geiger, seven rungs (the condition)",   group: "geiger",        better: "high", weight: 1, on: true,  fmt: "signed" },
  { key: "stretch",   label: "stretch against its own history",       group: "geiger",        better: "low",  weight: 1, on: true,  fmt: "pctile" },
];
export const BASELINE = { advance: 3, tolerance: 0, min_played: 3 };   // advance: how many go through; tolerance: |a − b| at or under this fraction of the larger magnitude is a draw; min_played: a game with fewer comparisons played than this is NOT PLAYED (a name with blanks cannot collect draws)

export function withToggles(overrides = {}) {
  return COMPARISONS.map((c) => ({ ...c, ...(overrides[c.key] || {}) }));
}

/** One comparison between a and b on one row. */
export function compare(a, b, c, tolerance = 0) {
  const x = num(a[c.key]), y = num(b[c.key]);
  if (x == null || y == null) return { key: c.key, a: x, b: y, winner: null, played: false, why: x == null && y == null ? "no number on either side" : x == null ? "no number for the first" : "no number for the second" };
  const scale = Math.max(Math.abs(x), Math.abs(y));
  const tie = x === y || (tolerance > 0 && scale > 0 && Math.abs(x - y) / scale <= tolerance);
  let winner = "draw";
  if (!tie) winner = (c.better === "low" ? x < y : x > y) ? "A" : "B";
  return { key: c.key, a: x, b: y, winner, played: true };
}

/** One game: a against b over the comparisons that are on. */
export function game(a, b, comparisons = COMPARISONS, { tolerance = BASELINE.tolerance, min_played = BASELINE.min_played } = {}) {
  const rows = comparisons.filter((c) => c.on && c.weight > 0).map((c) => ({ ...compare(a, b, c, tolerance), weight: c.weight, label: c.label, better: c.better }));
  let pa = 0, pb = 0, played = 0;
  for (const r of rows) { if (!r.played) continue; played++; if (r.winner === "A") pa += r.weight; else if (r.winner === "B") pb += r.weight; else { pa += r.weight / 2; pb += r.weight / 2; } }
  const winner = played < Math.max(1, min_played) ? null : pa > pb ? "A" : pb > pa ? "B" : "draw";
  return { a: a.ticker, b: b.ticker, rows, points: { a: pa, b: pb }, played, winner, not_played_why: winner == null ? `${played} of ${rows.length} comparisons played, fewer than ${min_played}` : null };
}

/** The round robin: every pair once. names: [{ticker, ...numbers}]. */
export function roundRobin(names, comparisons = COMPARISONS, { advance = BASELINE.advance, tolerance = BASELINE.tolerance, min_played = BASELINE.min_played } = {}) {
  const games = [];
  const S = Object.fromEntries(names.map((n) => [n.ticker, { ticker: n.ticker, wins: 0, draws: 0, losses: 0, unplayed: 0, points: 0, cmpPoints: 0, rowWins: {}, rowPlayed: {}, h2h: {} }]));
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const g = game(names[i], names[j], comparisons, { tolerance, min_played });
    games.push(g);
    const A = S[g.a], B = S[g.b];
    if (g.winner == null) { A.unplayed++; B.unplayed++; }
    else if (g.winner === "A") { A.wins++; B.losses++; A.points += 1; A.h2h[g.b] = 1; B.h2h[g.a] = 0; }
    else if (g.winner === "B") { B.wins++; A.losses++; B.points += 1; B.h2h[g.a] = 1; A.h2h[g.b] = 0; }
    else { A.draws++; B.draws++; A.points += 0.5; B.points += 0.5; A.h2h[g.b] = 0.5; B.h2h[g.a] = 0.5; }
    if (g.winner != null) { A.cmpPoints += g.points.a; B.cmpPoints += g.points.b; }
    for (const r of g.rows) { if (!r.played) continue; A.rowPlayed[r.key] = (A.rowPlayed[r.key] || 0) + 1; B.rowPlayed[r.key] = (B.rowPlayed[r.key] || 0) + 1; if (r.winner === "A") A.rowWins[r.key] = (A.rowWins[r.key] || 0) + 1; else if (r.winner === "B") B.rowWins[r.key] = (B.rowWins[r.key] || 0) + 1; }
  }
  const standings = Object.values(S).sort((x, y) => y.points - x.points || ((y.h2h[x.ticker] ?? 0.5) - (x.h2h[y.ticker] ?? 0.5)) || y.cmpPoints - x.cmpPoints || x.ticker.localeCompare(y.ticker));
  standings.forEach((s, i) => { s.place = i + 1; s.played = s.wins + s.draws + s.losses; });
  const k = Math.max(0, Math.min(advance, standings.length));
  const through = standings.slice(0, k).filter((s) => s.played > 0);
  const why = {};
  for (const s of through) why[s.ticker] = whySentence(s, comparisons);
  return { games, standings, advance: through.map((s) => s.ticker), why, comparisons: comparisons.filter((c) => c.on && c.weight > 0).map((c) => c.key), tolerance, min_played, k };
}

/** One sentence: what the name won on, and what it lost on. */
export function whySentence(s, comparisons = COMPARISONS) {
  const on = comparisons.filter((c) => c.on && c.weight > 0);
  const rows = on.map((c) => ({ key: c.key, label: c.label.split(" (")[0], won: s.rowWins[c.key] || 0, played: s.rowPlayed[c.key] || 0 })).filter((r) => r.played > 0);
  const share = (r) => r.won / r.played;
  const best = rows.slice().sort((a, b) => share(b) - share(a) || b.won - a.won).filter((r) => share(r) >= 0.5).slice(0, 3);
  const worst = rows.slice().sort((a, b) => share(a) - share(b)).filter((r) => share(r) < 0.5).slice(0, 2);
  const rec = `${s.wins} won, ${s.draws} drawn, ${s.losses} lost of ${s.played}`;
  const w = best.length ? `it took ${best.map((r) => `${r.label} in ${r.won} of ${r.played}`).join(", ")}` : "it won no row more often than not";
  const l = worst.length ? `; it gave up ${worst.map((r) => `${r.label} (${r.won} of ${r.played})`).join(" and ")}` : "";
  return `${s.ticker} advances in place ${s.place} (${rec}): ${w}${l}.`;
}

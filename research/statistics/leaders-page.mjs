/* Writes deliverables/20260928/leaders/LEADERS.html and its chart files (SVG, saved next to the page) from the three
   JSON files the leaders-*.mjs studies wrote into the same folder.
   node research/statistics/leaders-page.mjs   (then python3 scripts/inject-scnav.py places BACK / CLOSE) */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, "../..");
export const OUT_DIR = path.join(root, "deliverables/20260928/leaders");

export const UP = "#00FFA3", DN = "#FF2D55", INK = "#A8A8BA", DIM = "#6E6E80", GRID = "#24242E", BG = "#0B0B12", FILL = "#2C2C38", FILL2 = "#3A3A48";
export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const f1 = (x) => x == null ? "—" : (+x).toFixed(1), f2 = (x) => x == null ? "—" : (+x).toFixed(2);
const sg = (x, dp = 1, unit = "%") => x == null ? "—" : `<span class="${x > 0 ? "up" : x < 0 ? "dn" : ""}">${x > 0 ? "+" : ""}${(+x).toFixed(dp)}${unit}</span>`;
const mean = (xs) => { const a = xs.filter((x) => x != null); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
const med = (xs) => { const a = xs.filter((x) => x != null).sort((p, q) => p - q); if (!a.length) return null; const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

/* ---------- SVG helpers: dark panel, mono labels, labels ON the chart ---------- */
export function svgDoc(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="ui-monospace,Menlo,Consolas,monospace"><rect width="${w}" height="${h}" fill="${BG}"/>${body}</svg>`;
}
export const tx = (x, y, s, a = "start", c = INK, fs = 13, extra = "") => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="${c}" font-size="${fs}" text-anchor="${a}" ${extra}>${esc(s)}</text>`;
const ln = (x1, y1, x2, y2, c, w = 1, extra = "") => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${c}" stroke-width="${w}" ${extra}/>`;
const rect = (x, y, w, h, c, extra = "") => `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(0, w).toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" fill="${c}" ${extra}/>`;
/** A polyline whose every segment is green when it rises and red when it falls (the house rule: no grey lines). */
export function slopeLine(pts, w = 2, extra = "") {
  // consecutive segments of one colour become one polyline, so a dash pattern runs on unbroken; a flat step keeps the previous colour
  let s = "", run = [], col = null;
  const flush = () => { if (run.length > 1) s += `<polyline points="${run.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linejoin="round" ${extra}/>`; };
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    if ([x0, y0, x1, y1].some((v) => v == null || !Number.isFinite(v))) { flush(); run = []; col = null; continue; }
    const c = y1 < y0 ? UP : y1 > y0 ? DN : (col ?? UP);
    if (c !== col) { flush(); run = [[x0, y0]]; col = c; } else if (!run.length) run = [[x0, y0]];
    run.push([x1, y1]);
  }
  flush(); return s;
}
/** A polyline coloured by the sign of the value it draws (above zero green, below red). */
function signLine(pts, zeroY, w = 2.4) { let s = ""; for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; if ([x0, y0, x1, y1].some((v) => v == null)) continue; s += ln(x0, y0, x1, y1, (y0 + y1) / 2 <= zeroY ? UP : DN, w); } return s; }

/* 1 · stacked contributions per year */
export function chartStack(C) {
  const Ys = C.years, W = 1500, H = 620, L = 70, R = 20, T = 70, B = 70;
  const segs = (y) => { const t = y.tops; return [["top 1", t[1]], ["2–5", t[5] - t[1]], ["6–10", t[10] - t[5]], ["11–20", t[20] - t[10]], ["rest", y.index - t[20]]]; };
  let lo = 0, hi = 0; for (const y of Ys) { let p = 0, n = 0; for (const [, v] of segs(y)) v >= 0 ? p += v : n += v; hi = Math.max(hi, p, y.index); lo = Math.min(lo, n, y.index); }
  hi = Math.ceil((hi + 7) / 5) * 5; lo = Math.floor(lo / 5) * 5;
  const bw = (W - L - R) / Ys.length, Yv = (v) => T + (H - T - B) * (hi - v) / (hi - lo);
  const OP = [1, 0.72, 0.5, 0.32, 0.16];
  let s = tx(L, 28, "Where each year's S&P 500 price return came from — points of return, stacked", "start", "#C8C8D2", 17) + tx(L, 50, "top 1 contributor · the next 4 · the next 5 · the next 10 · everyone else    |  ◆ = the index's return that year", "start", DIM, 12);
  for (let v = lo; v <= hi; v += 10) { s += ln(L, Yv(v), W - R, Yv(v), v === 0 ? "#55556A" : GRID, v === 0 ? 1.4 : 1) + tx(L - 8, Yv(v) + 4, (v > 0 ? "+" : "") + v, "end", DIM, 12); }
  Ys.forEach((y, i) => {
    const x = L + i * bw + bw * 0.14, w = bw * 0.72; let pos = 0, neg = 0;
    segs(y).forEach(([name, v], k) => { if (v == null || Math.abs(v) < 1e-9) return; const a = v >= 0 ? pos : neg, b = a + v; s += rect(x, Yv(Math.max(a, b)), w, Math.abs(Yv(a) - Yv(b)), v >= 0 ? UP : DN, `fill-opacity="${OP[k]}"`); if (v >= 0) pos = b; else neg = b; });
    s += `<path d="M${(x + w / 2).toFixed(1)} ${(Yv(y.index) - 6).toFixed(1)} l6 6 l-6 6 l-6 -6 z" fill="${y.index >= 0 ? UP : DN}" stroke="${BG}" stroke-width="1.5"/>`;
    s += tx(x + w / 2, H - B + 20, String(y.year) + (y.partial ? "*" : ""), "middle", y.regime === "measured" ? "#C8C8D2" : DIM, 12);
    if (y.index > 0 && y.share[10] != null) s += tx(x + w / 2, Yv(Math.max(pos, y.index)) - 12, Math.round(y.share[10]) + "%", "middle", INK, 11);
  });
  const firstM = Ys.findIndex((y) => y.regime === "measured");
  if (firstM > 0) { const xm = L + firstM * bw; s += ln(xm, T - 8, xm, H - B + 4, "#55556A", 1, 'stroke-dasharray="4 4"') + tx(xm - 8, T + 4, "◀ ESTIMATED (FMP caps, 113 survivors)", "end", DIM, 12) + tx(xm + 8, T + 4, "MEASURED (SPY's own quarterly holdings) ▶", "start", "#C8C8D2", 12); }
  s += tx(L, H - 22, "Numbers above the bars: the share of the year's gain that came from the top 10 (only in up years). * 2026 = to 25 Sep.", "start", DIM, 12);
  const labels = [["top 1", 1], ["next 4", 0.72], ["next 5", 0.5], ["next 10", 0.32], ["everyone else", 0.16]]; let lx = W - R - 560;
  for (const [n, o] of labels) { s += rect(lx, 38, 14, 14, UP, `fill-opacity="${o}"`) + tx(lx + 20, 50, n, "start", INK, 12); lx += 20 + n.length * 8 + 22; }
  return svgDoc(W, H, s);
}

/* 2 · top-10 share per up year */
export function chartShare(C) {
  const Ys = C.years.filter((y) => y.index > 0), W = 1500, H = 420, L = 70, R = 20, T = 60, B = 50;
  const hi = Math.max(100, ...Ys.map((y) => y.share[20] ?? 0)) * 1.05, bw = (W - L - R) / Ys.length, Yv = (v) => T + (H - T - B) * (1 - v / hi);
  let s = tx(L, 28, "How much of each UP year's gain came from its 10 biggest contributors", "start", "#C8C8D2", 17) + tx(L, 48, "bar = top 10 · upper tick = top 20 · lower tick = the single biggest", "start", DIM, 12);
  for (let v = 0; v <= hi; v += 25) s += ln(L, Yv(v), W - R, Yv(v), GRID) + tx(L - 8, Yv(v) + 4, v + "%", "end", DIM, 12);
  Ys.forEach((y, i) => { const x = L + i * bw + bw * 0.2, w = bw * 0.6;
    s += rect(x, Yv(y.share[10]), w, Yv(0) - Yv(y.share[10]), UP, `fill-opacity="${y.regime === "measured" ? 0.85 : 0.45}"`);
    s += ln(x - 3, Yv(y.share[20]), x + w + 3, Yv(y.share[20]), UP, 2) + ln(x + w * 0.2, Yv(y.share[1]), x + w * 0.8, Yv(y.share[1]), BG, 2.5);
    s += tx(x + w / 2, Yv(Math.max(y.share[20], y.share[10])) - 8, Math.round(y.share[10]) + "%", "middle", INK, 12) + tx(x + w / 2, H - B + 20, String(y.year) + (y.partial ? "*" : ""), "middle", y.regime === "measured" ? "#C8C8D2" : DIM, 12); });
  return svgDoc(W, H, s);
}

/* 3 · trait ranges: leaders vs everyone else (middle half + middle value) */
export function chartTraits(TR, group, title, rowsDef) {
  const G = TR.summary.traits[group].T, W = 1500, rowH = 64, T = 70, H = T + rowsDef.length * rowH + 40, L = 380, R = 60;
  const all = rowsDef.flatMap(([k]) => [G[k].leaders.q1, G[k].leaders.q3, G[k].others.q1, G[k].others.q3]);
  let s = tx(24, 28, title, "start", "#C8C8D2", 17) + tx(24, 50, "bar = the middle half (25th → 75th percentile) · dot = the middle value · green/red = leaders above/below everyone else", "start", DIM, 12);
  rowsDef.forEach(([k, label, lo, hi], r) => {
    const y = T + r * rowH, X = (v) => L + (W - L - R) * (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo);
    const Ld = G[k].leaders, O = G[k].others, better = Ld.med > O.med;
    s += tx(24, y + 20, label, "start", "#C8C8D2", 14) + tx(24, y + 40, `leaders ${f1(Ld.med)}  ·  others ${f1(O.med)}`, "start", DIM, 12);
    s += ln(L, y + 50, W - R, y + 50, GRID) + tx(L, y + 62, String(lo), "start", DIM, 10) + tx(W - R, y + 62, String(hi), "end", DIM, 10);
    if (lo < 0 && hi > 0) s += ln(X(0), y + 2, X(0), y + 48, "#55556A", 1, 'stroke-dasharray="3 3"');
    s += rect(X(Ld.q1), y + 6, X(Ld.q3) - X(Ld.q1), 16, better ? UP : DN, 'fill-opacity=".55"') + `<circle cx="${X(Ld.med).toFixed(1)}" cy="${y + 14}" r="6" fill="${better ? UP : DN}"/>` + tx(X(Ld.q3) + 8, y + 19, "leaders", "start", INK, 11);
    s += rect(X(O.q1), y + 28, X(O.q3) - X(O.q1), 16, FILL2) + `<circle cx="${X(O.med).toFixed(1)}" cy="${y + 36}" r="6" fill="${INK}"/>` + tx(X(O.q3) + 8, y + 41, "everyone else", "start", DIM, 11);
  });
  return svgDoc(W, H, s);
}

/* 4 · base-rate curve: chance of being a leader at or above each pool percentile */
export function chartBaseRate(TR) {
  const W = 1500, H = 460, L = 80, R = 40, T = 60, B = 60, G = TR.summary.traits.all.T, Gc = TR.summary.traits.comparable.T;
  const curves = [["relative strength rank (all)", G.rsRank.baseRateAtOrAbove, TR.summary.traits.all.baseRate], ["relative strength rank (comparable size)", Gc.rsRank.baseRateAtOrAbove, TR.summary.traits.comparable.baseRate], ["revenue-growth rank (comparable size)", Gc.revGRank.baseRateAtOrAbove, TR.summary.traits.comparable.baseRate]];
  const hi = Math.ceil(Math.max(...curves.flatMap(([, c]) => c.filter((x) => x != null))) / 10) * 10 + 5;
  const X = (p) => L + (W - L - R) * p / 99, Y = (v) => T + (H - T - B) * (1 - v / hi);
  let s = tx(L, 28, "Chance a company became a top-20 contributor, if its rank on the last close before the year was at or above p", "start", "#C8C8D2", 16) + tx(L, 48, "x = rank inside that year's pool (0 = weakest, 99 = strongest) · flat line = the trait tells you nothing · segments green where the chance rises, red where it falls", "start", DIM, 12);
  for (let v = 0; v <= hi; v += 5) s += ln(L, Y(v), W - R, Y(v), GRID) + tx(L - 8, Y(v) + 4, v + "%", "end", DIM, 12);
  for (let p = 0; p <= 99; p += 10) s += tx(X(p), H - B + 20, String(p), "middle", DIM, 12);
  const dashes = ["", 'stroke-dasharray="10 6"', 'stroke-dasharray="2 5"'], look = ["solid", "long dashes", "dots"];
  curves.forEach(([name, c, base], k) => { const pts = c.map((v, p) => [X(p), v == null ? null : Y(v)]).filter((q) => q[1] != null); s += slopeLine(pts, 2.4, dashes[k]); const last = pts.at(-1);
    s += tx(L + 20, T + 22 + k * 20, `${look[k]} = ${name} · everyone: ${base}% · strongest ranks: ${c.filter((v) => v != null).at(-1)}%`, "start", INK, 13); });
  return svgDoc(W, H, s);
}

/* 5 · switch minus hold across horizons (fan) */
export function chartFan(RO, key = "all") {
  const D = RO[key].switchMinusHold, W = 1500, H = 520, L = 80, R = 40, T = 60, B = 60;
  const vals = D.filter(Boolean).flatMap((r) => [r[0], r[4]]), lo = Math.floor(Math.min(...vals) / 5) * 5, hi = Math.ceil(Math.max(...vals) / 5) * 5;
  const X = (h) => L + (W - L - R) * (h - 1) / 249, Y = (v) => T + (H - T - B) * (hi - v) / (hi - lo);
  let s = tx(L, 28, "Switch minus hold, after a leader's up-swing — every horizon from 1 to 250 sessions", "start", "#C8C8D2", 17) + tx(L, 48, "above 0 = the calmer strong-trend basket did better · outer band 10th–90th percentile, inner band 25th–75th · line = the middle case", "start", DIM, 12);
  for (let v = lo; v <= hi; v += 10) s += ln(L, Y(v), W - R, Y(v), v === 0 ? "#55556A" : GRID, v === 0 ? 1.5 : 1) + tx(L - 8, Y(v) + 4, (v > 0 ? "+" : "") + v, "end", DIM, 12);
  for (const h of [1, 21, 63, 126, 189, 250]) s += tx(X(h), H - B + 20, h + (h === 250 ? " sessions" : ""), h === 250 ? "end" : "middle", DIM, 12);
  const band = (a, b, c) => { const top = D.map((r, i) => r ? `${X(i + 1).toFixed(1)},${Y(r[a]).toFixed(1)}` : null).filter(Boolean), bot = D.map((r, i) => r ? `${X(i + 1).toFixed(1)},${Y(r[b]).toFixed(1)}` : null).filter(Boolean).reverse(); return `<polygon points="${top.concat(bot).join(" ")}" fill="${c}"/>`; };
  s += band(4, 0, FILL) + band(3, 1, FILL2);
  s += signLine(D.map((r, i) => r ? [X(i + 1), Y(r[2])] : [null, null]), Y(0));
  const at = (h) => D[h - 1];
  for (const h of [63, 250]) { const r = at(h); s += `<circle cx="${X(h)}" cy="${Y(r[2])}" r="5" fill="${r[2] >= 0 ? UP : DN}"/>` + tx(X(h) + 8, Y(r[2]) - 10, `${h} sessions: middle ${r[2] > 0 ? "+" : ""}${f1(r[2])} pts · switch ahead ${f1(r[6])}% of the time`, h === 250 ? "end" : "start", INK, 12);
    s += tx(X(h) + (h === 250 ? -8 : 8), Y(r[4]) + 14, `90th: +${f1(r[4])}`, h === 250 ? "end" : "start", DIM, 11) + tx(X(h) + (h === 250 ? -8 : 8), Y(r[0]) - 6, `10th: ${f1(r[0])}`, h === 250 ? "end" : "start", DIM, 11); }
  return svgDoc(W, H, s);
}

/* 6 · worst drop inside the horizon: hold vs switch vs SPY (middle case and bad case) */
export function chartDrawdown(RO, key = "all") {
  const B_ = RO[key], W = 1500, H = 520, L = 80, R = 240, T = 60, B = 60;
  const series = [["hold · middle", B_.hold.dd, 2, ""], ["switch · middle", B_.switch.dd, 2, ""], ["SPY · middle", B_.spy.dd, 2, ""], ["hold · 1 in 10 worst", B_.hold.dd, 0, 'stroke-dasharray="7 5"'], ["switch · 1 in 10 worst", B_.switch.dd, 0, 'stroke-dasharray="7 5"'], ["SPY · 1 in 10 worst", B_.spy.dd, 0, 'stroke-dasharray="7 5"']];
  const lo = Math.floor(Math.min(...series.flatMap(([, d, q]) => d.filter(Boolean).map((r) => r[q]))) / 5) * 5;
  const X = (h) => L + (W - L - R) * (h - 1) / 249, Y = (v) => T + (H - T - B) * (-v) / (-lo);
  let s = tx(L, 28, "The worst peak-to-trough drop suffered inside each horizon — holding the leader vs the calmer basket vs SPY", "start", "#C8C8D2", 16) + tx(L, 48, "solid = the middle case · dashed = the bad case (1 in 10 was worse) · every line falls, so every line is red", "start", DIM, 12);
  for (let v = 0; v >= lo; v -= 10) s += ln(L, Y(v), W - R, Y(v), GRID) + tx(L - 8, Y(v) + 4, v + "%", "end", DIM, 12);
  for (const h of [1, 21, 63, 126, 189, 250]) s += tx(X(h), H - B + 20, String(h), "middle", DIM, 12);
  const widths = { hold: 2.8, switch: 1.8, SPY: 1.1 };
  const labs = [];
  for (const [name, d, q, dash] of series) { const pts = d.map((r, i) => r ? [X(i + 1), Y(r[q])] : [null, null]); s += slopeLine(pts, widths[name.split(" ")[0]], dash); const last = pts.filter((p) => p[0] != null).at(-1); labs.push([last[0], last[1], `${name}  ${f1(d[249]?.[q])}%`]); }
  labs.sort((a, b) => a[1] - b[1]); for (let i = 1; i < labs.length; i++) if (labs[i][1] - labs[i - 1][1] < 16) labs[i][1] = labs[i - 1][1] + 16;
  for (const [x, y, t] of labs) s += tx(x + 8, y + 4, t, "start", INK, 12);
  return svgDoc(W, H, s);
}

/* 7 · by own-history size of the up-swing */
export function chartByGain(RO) {
  const G = RO.byGain, W = 1500, H = 440, L = 80, R = 30, T = 60, B = 70;
  const vals = G.map((g) => g.h250.med), m = Math.max(4, ...vals.map(Math.abs)) * 1.3, bw = (W - L - R) / G.length, Y = (v) => T + (H - T - B) * (m - v) / (2 * m);
  let s = tx(L, 28, "Switch minus hold after 250 sessions, by how big the up-swing was against the name's own earlier swings", "start", "#C8C8D2", 16) + tx(L, 48, "bar = middle case (points) · label = how often the switch came out ahead · x = the swing's percentile in its own history", "start", DIM, 12);
  s += ln(L, Y(0), W - R, Y(0), "#55556A", 1.4);
  G.forEach((g, i) => { const x = L + i * bw + bw * 0.18, w = bw * 0.64, v = g.h250.med; s += rect(x, Math.min(Y(0), Y(v)), w, Math.abs(Y(v) - Y(0)), v >= 0 ? UP : DN, 'fill-opacity=".8"');
    s += tx(x + w / 2, v >= 0 ? Y(v) - 8 : Y(v) + 18, `${v > 0 ? "+" : ""}${f1(v)}`, "middle", INK, 12) + tx(x + w / 2, H - B + 20, `${g.from}–${g.to}`, "middle", DIM, 12) + tx(x + w / 2, H - B + 38, `ahead ${f1(g.h250.beat)}%`, "middle", DIM, 11) + tx(x + w / 2, H - B + 54, `n ${g.h250.n}`, "middle", DIM, 10); });
  return svgDoc(W, H, s);
}

/* ---------------- page ---------------- */
export function buildPage(C, TR, RO) {
  const est = C.years.filter((y) => y.regime === "estimated"), mea = C.years.filter((y) => y.regime === "measured");
  const up = (ys) => ys.filter((y) => y.index > 0 && !y.partial);
  const avgShare = (ys, n) => med(up(ys).map((y) => y.share[n])), pooled = (ys, n) => 100 * up(ys).reduce((a, y) => a + y.tops[n], 0) / up(ys).reduce((a, y) => a + y.index, 0);
  const y24 = C.years.find((y) => y.year === 2024), y23 = C.years.find((y) => y.year === 2023), y08 = C.years.find((y) => y.year === 2008), y22 = C.years.find((y) => y.year === 2022), y26 = C.years.find((y) => y.year === 2026);
  const A = TR.summary.traits.all, Cm = TR.summary.traits.comparable, RS = TR.runStartSummary;
  const R = RO.all, at = (blk, k, h) => blk[k].ret[h - 1], dd = (blk, k, h) => blk[k].dd[h - 1], df = (blk, h) => blk.switchMinusHold[h - 1];
  const top90 = RO.byGain.at(-1);
  const leadCount = new Map(); for (const y of C.years) for (const x of y.top20.slice(0, 5)) leadCount.set(x.sym, (leadCount.get(x.sym) ?? 0) + 1);
  const freq = [...leadCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s, n]) => `${s} ${n}×`).join(", ");
  const bt = C.backtest;
  const btErr = bt.map((b) => b.estimated[10] - b.measured[10]);
  const orderRow = (G) => G.C.order.map((o) => `<tr><td>${esc(o.value)}</td><td>${o.n}</td><td>${o.leaders}</td><td>${f1(o.chance)}%</td></tr>`).join("");
  const posRow = (G) => G.C.position.map((o) => `<tr><td>${esc(o.value)}</td><td>${o.n}</td><td>${o.leaders}</td><td>${f1(o.chance)}%</td></tr>`).join("");
  const yearRows = C.years.map((y) => `<tr class="${y.regime === "estimated" ? "est" : ""}"><td>${y.year}${y.partial ? "*" : ""}</td><td>${y.regime}</td><td>${sg(y.index)}</td><td>${sg(y.tops[1], 2, "")}</td><td>${sg(y.tops[5], 2, "")}</td><td>${sg(y.tops[10], 2, "")}</td><td>${sg(y.tops[20], 2, "")}</td><td>${y.share[10] == null ? "down year" : f1(y.share[10]) + "%"}</td><td class="q">${y.top20.slice(0, 5).map((x) => `${esc(x.sym)} ${x.contrib > 0 ? "+" : ""}${f2(x.contrib)}`).join(" · ")}</td></tr>`).join("");
  const qc = C.quarterCheck, gapMax = Math.max(...qc.map((q) => Math.abs(q.gap)));
  const kMin = Math.min(...C.scale.map((s) => s.k)), kMax = Math.max(...C.scale.map((s) => s.k));
  const img = (f, alt) => `<figure><img class="chart" src="${f}" alt="${esc(alt)}"><figcaption class="q">Saved as <code>${f}</code> next to this page.</figcaption></figure>`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Market leaders · 28 Sep 2026</title>
<style>
body{margin:0;background:#07070C;color:#B4B4C6;font:17px/1.55 -apple-system,"Helvetica Neue",Arial,sans-serif;padding:28px 34px 80px;max-width:1560px}
h1{font-size:34px;margin:0 0 6px;color:#C8C8D2}h2{font-size:26px;margin:48px 0 8px;color:#C8C8D2}h3{font-size:19px;margin:26px 0 6px;color:#C8C8D2}
p,li{max-width:1100px}.q{color:#9C9CAE;font-size:13px}
ol.lead{font-size:19px;color:#C8C8D2;max-width:1140px;padding-left:24px}ol.lead li{margin:0 0 12px}
.status{border:1px solid #2A2A36;border-left:4px solid #8A8A9E;padding:12px 16px;margin:18px 0;max-width:1100px;color:#C8C8D2}
code{font:14px ui-monospace,Menlo,monospace;color:#BEBECE}
.scroll{overflow-x:auto;max-width:100%}
table{border-collapse:collapse;font-size:14px;margin:10px 0;font-variant-numeric:tabular-nums}th,td{border:1px solid #24242E;padding:6px 9px;text-align:left;vertical-align:top}th{color:#A8A8BA;font-weight:600;font-size:13px;font-family:ui-monospace,Menlo,monospace}
tr.est td{color:#9C9CAE}
figure{margin:14px 0 22px}.chart{display:block;width:100%;max-width:1500px;height:auto;border:1px solid #1E1E28;background:#0B0B12}
.up{color:#00FFA3}.dn{color:#FF2D55}
dl{max-width:1140px}dt{color:#C8C8D2;font-weight:600;margin-top:10px}dd{margin:2px 0 0 0}
@media(max-width:600px){body{padding:20px 16px 60px;font-size:16px}h1{font-size:26px}h2{font-size:22px}ol.lead{font-size:17px}table{font-size:12px}th,td{padding:5px 6px}code{overflow-wrap:anywhere}}
</style></head><body>
<span data-scnav-slot></span><h1>Market leaders: how much of the market they were, what they looked like, and the rotation question</h1>
<div class="q">Leaders · 28 Sep 2026 · built ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · research, not rules · price only · nothing here predicts</div>

<div class="status"><b>STATUS · all three studies ran on real data.</b> 2020 → 2026 uses SPY's own quarterly holdings (the actual index weights, ${C.sources.holdings.length} filings, ${C.sources.holdings[0]} → ${C.sources.holdings.at(-1)}). 2004 → 2019 is an <b>estimate</b> from FMP market caps of ${C.sources.capSymbols.length} large companies that still exist — shown in a dimmer colour everywhere. Bars to ${C.sources.lastBar}. Green = up / ahead, red = down / behind; every line is coloured by its own direction.</div>

<h2>What it says, in plain words</h2>
<ol class="lead">
<li><b>The market's gains have become far more concentrated in a handful of names.</b> In the estimated up years 2004–2019, the ten biggest contributors delivered ${f1(avgShare(est, 10))}% of the year's gain in the middle case (all those years' top-10 points added together ÷ all their index points: ${f1(pooled(est, 10))}%). In the measured up years 2020–2025 it was ${f1(avgShare(mea, 10))}% (pooled ${f1(pooled(mea, 10))}%). The single biggest name: ${f1(avgShare(est, 1))}% then, ${f1(avgShare(mea, 1))}% now. In 2023 the top 10 gave ${f2(y23.tops[10])} of the index's ${f2(y23.index)} points (${f1(y23.share[10])}%); in 2024 ${f2(y24.tops[10])} of ${f2(y24.index)} (${f1(y24.share[10])}%), and one name — ${esc(y24.top20[0].sym)} — gave ${f2(y24.tops[1])} points on its own. 2026 so far: ${f2(y26.tops[10])} of ${f2(y26.index)} points (${f1(y26.share[10])}%), led by ${y26.top20.slice(0, 3).map((x) => esc(x.sym)).join(", ")}.</li>
<li><b>In down years leaders do not carry the index.</b> In 2008 (${f1(y08.index)}%) the best twenty together added ${f2(y08.tops[20])} points; in 2022 (${f1(y22.index)}%) ${f2(y22.tops[20])}. Leadership is an up-market phenomenon. The names that were a top-5 contributor most often: ${esc(freq)}.</li>
<li><b>On the last close before their year, leaders did not look special on the chart.</b> Their relative strength against SPY was a little better (middle ${sg(A.T.rs.leaders.med)} vs ${sg(A.T.rs.others.med)} for everyone else), their distance from the 52-week high about the same (${f1(A.T.fromHigh.leaders.med)}% vs ${f1(A.T.fromHigh.others.med)}%), their RSI own-history percentile slightly lower (${f1(A.T.rsiPct.leaders.med)} vs ${f1(A.T.rsiPct.others.med)}). Cloud order barely moved the odds: bull order ${f1(A.C.order[0].chance)}%, mixed ${f1(A.C.order[1].chance)}%, bear order ${f1(A.C.order[2].chance)}% (base rate ${f1(A.baseRate)}%).</li>
<li><b>What did recur: size, and growth.</b> A leader's starting index weight was ${f2(A.T.w.leaders.med)}% in the middle case against ${f2(A.T.w.others.med)}% — contribution is weight × return, so the giants lead by arithmetic. Revenue growth was higher (trailing year ${sg(A.T.revG.leaders.med)} vs ${sg(A.T.revG.others.med)}); among companies of comparable size, a growing top line lifted the chance from ${f1(Cm.C.revenueGrowing[1].chance)}% to ${f1(Cm.C.revenueGrowing[0].chance)}%. The strongest relative-strength names did lead more often: in the top tenth of the pool the chance was ${f1(A.T.rsRank.baseRateAtOrAbove[90])}% against ${f1(A.baseRate)}% for all.</li>
<li><b>Their runs started from washed-out lows — but so did everyone's.</b> Looking back, a leader's run began at a low about ${f1(-RS.leaders.monthsFromYearStart.med)} months before its year, typically ${f1(-RS.leaders.fromHigh.med)}% below its 52-week high, with RSI in the bottom ${f1(RS.leaders.rsiPct.med)}% of its own history and price below all four cloud lines ${f1(RS.leaders.belowAllAtLow)}% of the time. Companies of the same size that did NOT lead looked the same at their lows (${f1(-RS.comparableOthers.fromHigh.med)}% below the high, RSI percentile ${f1(RS.comparableOthers.rsiPct.med)}, below all lines ${f1(RS.comparableOthers.belowAllAtLow)}%). The difference is what came after: leaders rose ${f1(RS.leaders.gainToPeak.med)}% to their peak in the middle case, the others ${f1(RS.comparableOthers.gainToPeak.med)}%; revenue growth at the low was ${f1(RS.leaders.revG.med)}% vs ${f1(RS.comparableOthers.revG.med)}%.</li>
<li><b>The rotation question: moving to calmer strong-trend names gave about the same middle result with roughly half the pain.</b> Across ${R.n.toLocaleString("en-US")} up-swings in ${R.names} leader names, one year after the swing was confirmed the leader returned ${sg(at(R, "hold", 250)[2])} in the middle case and the calmer basket ${sg(at(R, "switch", 250)[2])} (SPY ${sg(at(R, "spy", 250)[2])}). The basket came out ahead ${f1(df(R, 250)[6])}% of the time — a coin toss. But the worst drop inside that year was ${f1(dd(R, "hold", 250)[2])}% for the leader and ${f1(dd(R, "switch", 250)[2])}% for the basket in the middle case, and ${f1(dd(R, "hold", 250)[0])}% vs ${f1(dd(R, "switch", 250)[0])}% in the bad case (1 in 10). The basket behaved almost exactly like SPY (SPY's worst drop: ${f1(dd(R, "spy", 250)[2])}% middle, ${f1(dd(R, "spy", 250)[0])}% bad case) — so in practice "switch to calm strong-trend names" looked like "go back to the index". The leader kept the fatter right tail: its best tenth returned ${sg(at(R, "hold", 250)[4])} or more, the basket's ${sg(at(R, "switch", 250)[4])}.</li>
<li><b>After the very biggest swings (the top tenth of a name's own history) holding did slightly better</b>: switch minus hold ${sg(top90.h250.med, 2, " pts")} at one year, basket ahead only ${f1(top90.h250.beat)}% of the time — momentum persisted a little. Everywhere else the middle difference stayed within ±${f1(Math.max(...RO.byGain.slice(0, -1).map((g) => Math.abs(g.h250.med))))} points. The drawdown gap was there at every swing size (leader ≈ ${f1(top90.holdDD250)}% vs basket ≈ ${f1(top90.switchDD250)}% in the top tenth).</li>
</ol>

<h2>1 · Concentration: the share of the S&P 500's return from its top 1 / 5 / 10 / 20</h2>
<p>Each bar is one year's index return split into the points that came from the single biggest contributor, the next four, the next five, the next ten and everyone else. A contribution is the company's weight at the start of the quarter × its price return in the quarter, chained through the year so that the pieces add up to the index's return.</p>
${img("leaders-contribution-stack.svg", "Stacked yearly contributions")}
${img("leaders-top10-share.svg", "Top-10 share of each up year")}
<div class="scroll"><table><tr><th>year</th><th>source</th><th>S&P 500 (price)</th><th>top 1 (pts)</th><th>top 5</th><th>top 10</th><th>top 20</th><th>top 10 as a share of the gain</th><th>the five biggest contributors (points)</th></tr>${yearRows}</table></div>
<p class="q">* 2026 runs to ${C.sources.lastBar}. Points are percentage points of the index's price return. "Down year" = the index fell, so a share of the gain is meaningless.</p>

<h3>How far to trust the two regimes</h3>
<ul>
<li><b>Measured years check out against the index.</b> Quarter by quarter, the weight × return of every company adds up to within ${f2(gapMax)} points of the S&P 500's own quarterly return (the rest is companies that joined or left mid-quarter). ${f1(100 - Math.max(...qc.map((q) => q.source.none)))}%+ of the weight is priced in every quarter.</li>
<li><b>The estimate was tested on the measured years.</b> Using the estimate method on 2020–2025 gives a top-10 sum ${btErr.map((e) => (e > 0 ? "+" : "") + f2(e)).join(", ")} points away from the measured answer, and the same top names. It runs slightly high, because FMP caps are full caps while the index uses float. The scale factor (index value ÷ level) moved only between ${(kMin / 1e9).toFixed(2)} and ${(kMax / 1e9).toFixed(2)} billion across 2019–2026.</li>
<li><b>The estimate only sees survivors.</b> Before 2020 only the ${C.sources.capSymbols.length} companies with cap histories here are counted (today's large names, while they were members). A company that led and later disappeared (AIG, HP, Yahoo, Lehman…) is inside "everyone else", so pre-2020 top-N sums are, if anything, too LOW — which would make the rise in concentration look bigger than it was. The backtest above and the direction of this bias pull in opposite directions; the rise in the middle case from ${f1(avgShare(est, 10))}% to ${f1(avgShare(mea, 10))}% is larger than either.</li>
</ul>

<h2>2 · What leaders looked like on the last close before their year</h2>
<p>"Leader" = one of the year's top 20 contributors. The comparison group = every other company in the same pool on the same day (${A.n.toLocaleString("en-US")} company-years, ${A.leaders} of them leaders, base rate ${f1(A.baseRate)}%). "Comparable size" keeps only companies at least as big as that year's smallest leader (${Cm.n.toLocaleString("en-US")} company-years, base rate ${f1(Cm.baseRate)}%).</p>
${img("leaders-traits-all.svg", "Traits of leaders vs everyone else")}
${img("leaders-traits-comparable.svg", "Traits of leaders vs companies of comparable size")}
${img("leaders-base-rate.svg", "Chance of leading by rank")}
<div class="scroll"><table><tr><th>cloud order on that close</th><th>company-years</th><th>of them leaders</th><th>chance of leading</th></tr>${orderRow(A)}</table></div>
<div class="scroll"><table><tr><th>price vs the four cloud lines</th><th>company-years</th><th>of them leaders</th><th>chance of leading</th></tr>${posRow(A)}</table></div>
<h3>Looking back: where the runs began (hindsight, described not selected)</h3>
${img("leaders-run-start.svg", "Traits at the low where the run began")}
<p>For each leader: the lowest low between the start of the year before and its highest close in its leadership year. The same rule applied to every company of comparable size that did not lead gives the yardstick. The lows look alike; what separated the two groups came after the low.</p>

<h2>3 · The rotation question: hold the leader after a big up-swing, or move to a calmer name in a strong trend?</h2>
<p>Alan's words: "the market is more bullish than bearish — better to be long-leaning; if I take profits on a volatile name, shift the money into another good one with a lesser risk profile." This is a research question, not advice. The test: every completed up-swing (pivot rule, 10 bars each side) of every name that was ever a top-20 contributor. The swing high is only known 10 sessions later, so both paths start at that close. <b>Hold</b> = stay in the name. <b>Switch</b> = an equal-weight basket of every other company in the cache that, on that same day, had the Station bull order with price above all four lines AND had moved less than the name over the same swing. SPY is the third path.</p>
${img("leaders-rotation-fan.svg", "Switch minus hold across horizons")}
${img("leaders-rotation-drawdown.svg", "Worst drop inside each horizon")}
${img("leaders-rotation-by-gain.svg", "Switch minus hold by swing size")}
<div class="scroll"><table><tr><th>after</th><th>hold: 10th / middle / 90th</th><th>switch: 10th / middle / 90th</th><th>SPY middle</th><th>switch − hold, middle</th><th>switch ahead</th><th>worst drop, middle: hold / switch</th><th>worst drop, 1 in 10: hold / switch</th></tr>
${[21, 63, 126, 250].map((h) => { const a = at(R, "hold", h), b = at(R, "switch", h), c = at(R, "spy", h), d = df(R, h); return `<tr><td>${h} sessions</td><td>${sg(a[0])} / ${sg(a[2])} / ${sg(a[4])}</td><td>${sg(b[0])} / ${sg(b[2])} / ${sg(b[4])}</td><td>${sg(c[2])}</td><td>${sg(d[2], 2, " pts")}</td><td>${f1(d[6])}%</td><td>${sg(dd(R, "hold", h)[2])} / ${sg(dd(R, "switch", h)[2])}</td><td>${sg(dd(R, "hold", h)[0])} / ${sg(dd(R, "switch", h)[0])}</td></tr>`; }).join("")}
</table></div>
<p class="q">The table only reads four points off curves that run through every horizon 1 → 250; the JSON keeps every percentile 1..100 at 15 horizons.</p>

<h2>Where every number comes from</h2>
<dl>
<dt>Index weights 2020 → 2026</dt><dd>SPY's quarterly holdings as filed with the SEC (N-PORT), read through the FMP connector (<code>mutual-fund-disclosures</code>), 30 Sep 2019 → 30 Jun 2026. Share classes of one company are merged by CUSIP issuer.</dd>
<dt>Company prices</dt><dd>The chart API's split- and spin-off-adjusted daily bars (the durable cache). Where the cache has no bars for a company, the fund's own prices (value ÷ shares, split-corrected) stand in; for the last quarter FMP's previous close (25 Sep) does.</dd>
<dt>Index return</dt><dd>^GSPC daily closes (FMP, cached): price only, no dividends.</dd>
<dt>Market caps 2004 → 2019</dt><dd>FMP <code>historical-market-cap</code> for ${C.sources.capSymbols.length} companies; before Nov 2006 the first cap is scaled back by price. Membership from FMP's S&P 500 add/remove list.</dd>
<dt>Growth</dt><dd>FMP quarterly income statements (${"119"} companies), only quarters filed before the date.</dd>
<dt>Swings, clouds, RSI</dt><dd>The S9 research code on this branch (<code>research/statistics/s9-research.mjs</code>): 10/10 wick pivots, Station cloud order, RSI(14) own-history percentile.</dd>
</dl>

<h2>What could be wrong</h2>
<ul>
<li><b>Hindsight in the leader list.</b> Parts 2 and 3 study names because they became leaders. Holding them looks better than holding a random stock would have; the rotation result is, if anything, flattering to "hold".</li>
<li><b>Survivors.</b> The switch candidates and the pre-2020 cap list are today's companies. Names that collapsed are missing from both.</li>
<li><b>The chart API's META history was a different security before 9 Jun 2022</b> (a fund that used the ticker, with a 4-month gap). It was replaced here with FMP's daily prices for Facebook/Meta. The same rule (drop history before any gap of more than 20 days) removed older, reused-ticker history for WM (Washington Mutual), MS (pre-2006), BNY, SPCX, SHAZ and others. <b>This is a data fault in the chart API worth fixing at the source.</b></li>
<li><b>Overlap.</b> Up-swings in different names often end in the same weeks (the whole market turns), so the ${R.n.toLocaleString("en-US")} events are far fewer independent observations than they look.</li>
<li><b>Price only.</b> No dividends, no costs, no taxes. Switching every time a swing completes would trade a lot; taxes alone could swamp a 1-point difference.</li>
<li><b>Three companies' statements came back too small to file</b> (PLTR, SNDK, CRWD) and ${"six"} leaders have no bars in the cache (PYPL, ACN, CI, VLO, MCK, HES), so they are missing from parts 2–3.</li>
</ul>

<h2>What was not done</h2>
<ul>
<li>No full reconstruction of S&P membership and float before 2019 (would need every member's caps, including dead companies — a keyed bulk job).</li>
<li>No sector or theme split of the leaders, no valuation (P/E) at the start, no analyst-estimate revisions.</li>
<li>The switch basket is not optimised (no ranking by trend strength or by volatility); it is simply "every calmer name in bull order that day".</li>
<li>Nothing was deployed, no database was touched, no trade was made.</li>
</ul>
<p class="q">Data files next to this page: <code>leaders-concentration.json</code>, <code>leaders-traits.json</code>, <code>leaders-rotation.json</code>. Code: <code>research/statistics/leaders-*.mjs</code>. Tests: <code>tests/statistics-leaders.test.mjs</code>.</p>
</body></html>`;
}

export function writeAll(dir = OUT_DIR) {
  const C = JSON.parse(fs.readFileSync(path.join(dir, "leaders-concentration.json"), "utf8"));
  const TR = JSON.parse(fs.readFileSync(path.join(dir, "leaders-traits.json"), "utf8"));
  const RO = JSON.parse(fs.readFileSync(path.join(dir, "leaders-rotation.json"), "utf8"));
  const rowsDef = [["rs", "relative strength vs SPY, prior year (pts)", -60, 80], ["fromHigh", "distance from the 52-week high (%)", -50, 0], ["rsiPct", "RSI(14) percentile in its own history", 0, 100], ["revG", "revenue growth, trailing year (%)", -30, 60], ["niG", "net income growth, trailing year (%)", -80, 120], ["w", "weight in the S&P 500 (%)", 0, 4]];
  const files = {
    "leaders-contribution-stack.svg": chartStack(C), "leaders-top10-share.svg": chartShare(C),
    "leaders-traits-all.svg": chartTraits(TR, "all", "Leaders vs every other company in the pool — read on the last close before the year they led", rowsDef),
    "leaders-traits-comparable.svg": chartTraits(TR, "comparable", "The same, against companies at least as big as that year's smallest leader", rowsDef),
    "leaders-base-rate.svg": chartBaseRate(TR),
    "leaders-run-start.svg": chartRunStart(TR),
    "leaders-rotation-fan.svg": chartFan(RO), "leaders-rotation-drawdown.svg": chartDrawdown(RO), "leaders-rotation-by-gain.svg": chartByGain(RO),
  };
  for (const [f, svg] of Object.entries(files)) fs.writeFileSync(path.join(dir, f), svg);
  fs.writeFileSync(path.join(dir, "LEADERS.html"), buildPage(C, TR, RO));
  return Object.keys(files);
}

/* run-start comparison (hindsight): leaders vs comparable non-leaders at their own lows */
export function chartRunStart(TR) {
  const S = TR.runStartSummary, W = 1500, rowH = 64, T = 70;
  const rows = [["fromHigh", "distance from the 52-week high at the low (%)", -60, 0], ["rsiPct", "RSI percentile at the low", 0, 60], ["rs", "relative strength vs SPY at the low (pts)", -50, 30], ["revG", "revenue growth at the low (%)", -10, 30], ["gainToPeak", "rise from the low to the year's peak (%)", 0, 200], ["monthsFromYearStart", "months from the start of the leadership year", -14, 6]];
  const H = T + rows.length * rowH + 40, L = 420, R = 60;
  let s = tx(24, 28, "Where the runs began (hindsight): leaders vs companies of comparable size that did not lead", "start", "#C8C8D2", 17) + tx(24, 50, "bar = middle half · dot = middle value · leaders green/red = above/below the others' middle value", "start", DIM, 12);
  rows.forEach(([k, label, lo, hi], r) => {
    const y = T + r * rowH, X = (v) => L + (W - L - R) * (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo), Ld = S.leaders[k], O = S.comparableOthers[k], better = Ld.med > O.med;
    s += tx(24, y + 20, label, "start", "#C8C8D2", 14) + tx(24, y + 40, `leaders ${f1(Ld.med)} · others ${f1(O.med)}`, "start", DIM, 12) + ln(L, y + 50, W - R, y + 50, GRID) + tx(L, y + 62, String(lo), "start", DIM, 10) + tx(W - R, y + 62, String(hi), "end", DIM, 10);
    s += rect(X(Ld.q1), y + 6, X(Ld.q3) - X(Ld.q1), 16, better ? UP : DN, 'fill-opacity=".55"') + `<circle cx="${X(Ld.med).toFixed(1)}" cy="${y + 14}" r="6" fill="${better ? UP : DN}"/>` + tx(X(Ld.q3) + 8, y + 19, "leaders", "start", INK, 11);
    s += rect(X(O.q1), y + 28, X(O.q3) - X(O.q1), 16, FILL2) + `<circle cx="${X(O.med).toFixed(1)}" cy="${y + 36}" r="6" fill="${INK}"/>` + tx(X(O.q3) + 8, y + 41, "others of comparable size", "start", DIM, 11);
  });
  return svgDoc(W, H, s);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) { const f = writeAll(); console.log("wrote LEADERS.html and", f.length, "charts:", f.join(", ")); }

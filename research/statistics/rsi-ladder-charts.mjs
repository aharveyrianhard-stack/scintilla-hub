/* RSI LADDER charts — every chart is a saved SVG file next to the page (deliverables/20260928/rsi-ladder/charts/).
   node research/statistics/rsi-ladder-charts.mjs   (reads rsi-ladder.json from the same folder)
   Look: dark panel, mono labels, quiet grid. No grey series lines: every drawn series is green (up / better) or
   red (down / worse), per Alan's rule "daily up, daily down, green, red". Labels sit on the chart, at line ends. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";

export const COL = { bg: "#0B0B12", grid: "#1C1C26", axis: "#34343F", ink: "#B4B4C6", dim: "#8E8EA0", hi: "#C8C8D2", up: "#00FFA3", dn: "#FF2D55" };
const FONT = `font-family="ui-monospace,SFMono-Regular,Menlo,monospace"`;
export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fx = (x, d = 1) => (Math.round(x * 10 ** d) / 10 ** d).toString();
const fin = (x) => x != null && Number.isFinite(x);

/** Linear or log scale. */
export function scale(d0, d1, r0, r1, log = false) {
  if (log) { const a = Math.log(d0), b = Math.log(d1); return (x) => r0 + (Math.log(Math.max(x, d0)) - a) / (b - a) * (r1 - r0); }
  return (x) => r0 + (x - d0) / (d1 - d0) * (r1 - r0);
}
export function niceTicks(lo, hi, count = 6) {
  const span = hi - lo, raw = span / count, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count + 1);
  const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10)); return out;
}
const LOG_TICKS = [0, 1, 2, 3, 5, 10, 20, 30, 50, 100, 200, 300, 500, 1000, 2000, 5000, 10000];

/** A framed panel: title, axes, grid; `draw(X, Y)` returns the series markup. */
export function panel({ w = 800, h = 420, title, sub, xLabel, yLabel, x, y, xTicks, yTicks, xFmt = (v) => fx(v, 0), yFmt = (v) => fx(v, 1), draw }) {
  const m = { l: 74, r: 26, t: sub ? 66 : 48, b: 58 };
  const X = scale(x[0], x[1], m.l, w - m.r, x[2] === "log"), Y = scale(y[0], y[1], h - m.b, m.t, y[2] === "log");
  const xt = xTicks ?? (x[2] === "log" ? LOG_TICKS.filter((v) => v >= x[0] && v <= x[1]) : niceTicks(x[0], x[1], 8));
  const yt = yTicks ?? (y[2] === "log" ? LOG_TICKS.filter((v) => v >= y[0] && v <= y[1]) : niceTicks(y[0], y[1], 6));
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" ${FONT}>`;
  s += `<rect width="${w}" height="${h}" fill="${COL.bg}"/>`;
  s += `<text x="${m.l}" y="26" font-size="18" fill="${COL.hi}" font-weight="600">${esc(title)}</text>`;
  if (sub) s += `<text x="${m.l}" y="48" font-size="14" fill="${COL.dim}">${esc(sub)}</text>`;
  for (const v of yt) s += `<line x1="${m.l}" x2="${w - m.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="${COL.grid}"/><text x="${m.l - 8}" y="${(Y(v) + 5).toFixed(1)}" font-size="14" fill="${COL.dim}" text-anchor="end">${esc(yFmt(v))}</text>`;
  for (const v of xt) s += `<line y1="${m.t}" y2="${h - m.b}" x1="${X(v).toFixed(1)}" x2="${X(v).toFixed(1)}" stroke="${COL.grid}"/><text y="${h - m.b + 20}" x="${X(v).toFixed(1)}" font-size="14" fill="${COL.dim}" text-anchor="middle">${esc(xFmt(v))}</text>`;
  s += `<rect x="${m.l}" y="${m.t}" width="${w - m.l - m.r}" height="${h - m.t - m.b}" fill="none" stroke="${COL.axis}"/>`;
  if (xLabel) s += `<text x="${(m.l + w - m.r) / 2}" y="${h - 12}" font-size="14" fill="${COL.ink}" text-anchor="middle">${esc(xLabel)}</text>`;
  if (yLabel) s += `<text transform="translate(18 ${(m.t + h - m.b) / 2}) rotate(-90)" font-size="14" fill="${COL.ink}" text-anchor="middle">${esc(yLabel)}</text>`;
  s += draw(X, Y, m, w, h);
  return s + "</svg>";
}
/** Label with a dark backing so it stays legible over lines. */
export function label(x, y, text, { color = COL.hi, size = 14, anchor = "start", bold = false } = {}) {
  const wEst = text.length * size * 0.61, x0 = anchor === "end" ? x - wEst : anchor === "middle" ? x - wEst / 2 : x;
  return `<rect x="${(x0 - 3).toFixed(1)}" y="${(y - size + 1).toFixed(1)}" width="${(wEst + 6).toFixed(1)}" height="${size + 5}" fill="${COL.bg}" opacity="0.85"/><text x="${x.toFixed(1)}" y="${(y + 1).toFixed(1)}" font-size="${size}" fill="${color}" text-anchor="${anchor}"${bold ? ' font-weight="600"' : ""}>${esc(text)}</text>`;
}
/** A polyline split into green (value ≥ pivot) and red (below) pieces, cutting exactly at the crossing. */
export function signLine(pts, X, Y, pivot, { width = 2.5, dash = null } = {}) {
  let s = "", cur = [], curUp = null;
  const flush = () => { if (cur.length > 1) s += `<polyline points="${cur.map(([a, b]) => `${X(a).toFixed(1)},${Y(b).toFixed(1)}`).join(" ")}" fill="none" stroke="${curUp ? COL.up : COL.dn}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ""} stroke-linejoin="round"/>`; };
  for (let i = 0; i < pts.length; i++) {
    const [px, py] = pts[i]; if (!fin(py)) { flush(); cur = []; curUp = null; continue; }
    const up = py >= pivot;
    if (curUp === null) { cur = [[px, py]]; curUp = up; continue; }
    if (up !== curUp) { const [ax, ay] = cur[cur.length - 1], t = (pivot - ay) / (py - ay), cx = ax + t * (px - ax); cur.push([cx, pivot]); flush(); cur = [[cx, pivot], [px, py]]; curUp = up; }
    else cur.push([px, py]);
  }
  flush(); return s;
}

/* ============================ the charts ============================ */
/** Heat strip: one row per instrument, 100 cells (rung 1..100), red below RSI 50, green above, stronger further out. */
export function heatLadder(d, which = "full", keys) {
  const rows = keys.map((k) => d.instruments[k]).filter((A) => A && !A.missing).sort((a, b) => a.ladder[which][1] - b.ladder[which][1]);
  const w = 1600, rh = 30, top = 92, left = 300, right = 330, h = top + rows.length * rh + 58, cw = (w - left - right) / 100;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" ${FONT}><rect width="${w}" height="${h}" fill="${COL.bg}"/>`;
  s += `<text x="24" y="30" font-size="20" fill="${COL.hi}" font-weight="600">RSI at every rung, 1% to 100% — ${which === "full" ? "each one's full history" : "last 3 years"}</text>`;
  s += `<text x="24" y="56" font-size="14" fill="${COL.dim}">Each row is one instrument, each cell one rung (1% of its days). Red = RSI under 50, green = over 50; the stronger the colour, the further from 50. Deepest bottom rung at the top.</text>`;
  const cols = [[1, "1%"], [5, "5%"], [50, "50%"], [95, "95%"], [99, "99%"]];
  cols.forEach(([q, t], j) => { s += `<text x="${w - right + 36 + j * 60}" y="${top - 10}" font-size="14" fill="${COL.dim}" text-anchor="middle">${t}</text>`; });
  for (const q of [1, 10, 25, 50, 75, 90, 100]) s += `<text x="${left + (q - 0.5) * cw}" y="${top - 10}" font-size="13" fill="${COL.dim}" text-anchor="middle">${q}</text>`;
  rows.forEach((A, r) => {
    const y = top + r * rh, L = A.ladder[which];
    s += `<text x="${left - 12}" y="${y + rh / 2 + 5}" font-size="15" fill="${COL.hi}" text-anchor="end">${esc(A.name)}</text>`;
    for (let q = 1; q <= 100; q++) {
      const v = (L[q - 1] + L[q]) / 2, a = Math.min(1, Math.abs(v - 50) / 32);
      s += `<rect x="${(left + (q - 1) * cw).toFixed(2)}" y="${y + 2}" width="${(cw + 0.3).toFixed(2)}" height="${rh - 4}" fill="${v >= 50 ? COL.up : COL.dn}" fill-opacity="${(0.08 + 0.8 * a).toFixed(3)}"/>`;
    }
    cols.forEach(([q], j) => { const v = L[q]; s += `<text x="${w - right + 36 + j * 60}" y="${y + rh / 2 + 5}" font-size="15" fill="${v >= 50 ? COL.up : COL.dn}" text-anchor="middle">${fx(v)}</text>`; });
    const now = A.now.rung; if (which === "full" && now) s += `<rect x="${(left + (now - 1) * cw - 1).toFixed(1)}" y="${y}" width="${(cw + 2).toFixed(1)}" height="${rh}" fill="none" stroke="${COL.hi}" stroke-width="2"/>`;
  });
  s += `<text x="${left}" y="${h - 22}" font-size="14" fill="${COL.dim}">rung (percentile of that instrument's own days) →${which === "full" ? "   ▯ outlined cell = where the latest close sits" : ""}</text>`;
  return s + "</svg>";
}

/** Three ladders on one chart (e.g. Bitcoin, SPY, QQQ): RSI against rung, labels at both ends. */
export function ladderLines(series, { title, sub }) {
  const styles = [{ width: 4, dash: null }, { width: 2.5, dash: "9 6" }, { width: 2.5, dash: "2 5" }, { width: 2, dash: "14 4 2 4" }];
  return panel({ w: 1600, h: 640, title, sub, xLabel: "rung (percentile of each one's own days) — left = most oversold, right = most overbought", yLabel: "RSI(14)", x: [0, 100], y: [10, 95],
    xTicks: [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99], yTicks: [10, 20, 30, 40, 50, 60, 70, 80, 90],
    draw: (X, Y) => {
      let s = `<line x1="${X(0)}" x2="${X(100)}" y1="${Y(50)}" y2="${Y(50)}" stroke="${COL.axis}" stroke-width="1.5"/>`;
      series.forEach((S, i) => { s += signLine(S.v.map((v, q) => [q, v]), X, Y, 50, styles[i]); });
      // end labels, stacked so they never overlap
      const place = (vals, side) => { const sorted = vals.map((v, i) => ({ ...v, i })).sort((a, b) => a.y - b.y); for (let j = 1; j < sorted.length; j++) if (sorted[j].y - sorted[j - 1].y < 20) sorted[j].y = sorted[j - 1].y + 20; return sorted; };
      const left = place(series.map((S) => ({ y: Y(S.v[1]), t: `${S.name} ${fx(S.v[1])}`, v: S.v[1] })), "l");
      for (const L of left) s += label(X(1) + 10, L.y + 24, `rung 1: ${L.t}`, { color: L.v >= 50 ? COL.up : COL.dn });
      const right = place(series.map((S) => ({ y: Y(S.v[99]), t: `${S.name} ${fx(S.v[99])}`, v: S.v[99] })), "r");
      for (const R of right) s += label(X(99) - 10, R.y - 10, `rung 99: ${R.t}`, { color: R.v >= 50 ? COL.up : COL.dn, anchor: "end" });
      // key-line legend drawn in the chart
      series.forEach((S, i) => { const y = 86 + i * 24, x = X(34); s += `<line x1="${x}" x2="${x + 46}" y1="${y}" y2="${y}" stroke="${COL.up}" stroke-width="${styles[i].width}"${styles[i].dash ? ` stroke-dasharray="${styles[i].dash}"` : ""}/>` + label(x + 56, y + 5, S.name + (S.span ? ` (${S.span})` : ""), { color: COL.hi }); });
      return s;
    } });
}

/** Rung-by-rung gap: B's RSI minus A's RSI at each rung 1..99 (red = B lower / deeper, green = B higher). */
export function gapBars(A, B, { title, sub, aName, bName }) {
  return panel({ w: 1600, h: 460, title, sub, xLabel: "rung (percentile of each one's own days)", yLabel: `${bName} minus ${aName}, RSI points`, x: [0, 100], y: [-12, 12],
    xTicks: [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99], yTicks: [-12, -8, -4, 0, 4, 8, 12], yFmt: (v) => (v > 0 ? "+" : "") + v,
    draw: (X, Y) => {
      let s = ""; const bw = (X(1) - X(0)) * 0.8;
      for (let q = 1; q <= 99; q++) { const g = B[q] - A[q], y0 = Y(0), y1 = Y(Math.max(-12, Math.min(12, g))); s += `<rect x="${(X(q) - bw / 2).toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.abs(y1 - y0).toFixed(1)}" fill="${g >= 0 ? COL.up : COL.dn}" fill-opacity="0.85"/>`; }
      for (const q of [1, 5, 50, 95, 99]) { const g = B[q] - A[q]; s += label(X(q) + (q > 90 ? -6 : 6), g >= 0 ? Y(Math.min(12, g)) - 8 : Y(Math.max(-12, g)) + 20, `${q}%: ${g >= 0 ? "+" : ""}${fx(g)} (${fx(B[q])} vs ${fx(A[q])})`, { color: g >= 0 ? COL.up : COL.dn, anchor: q > 90 ? "end" : "start", size: 14 }); }
      return s;
    } });
}

/** One outcome panel against rung: dots per rung, 90% band as a thin bar, the any-day line dashed.
 *  log = true draws on a log scale of (value + 1), so a wait of 0 ("already above") sits on the bottom line. */
export function outcomePanel(A, { key, bandKey, title, sub, yLabel, unit, baseVal, good = "up", log = false, pivot = null }) {
  const rows = A.byRung, sh = (v) => log ? v + 1 : v;
  const vals = rows.map((r) => key(r)).filter(fin), bands = rows.map((r) => r.band?.[bandKey]).filter(Boolean).flat().filter(fin);
  let lo = Math.min(...vals, ...bands, baseVal ?? Infinity), hi = Math.max(...vals, ...bands, baseVal ?? -Infinity);
  if (log) { lo = 1; hi = Math.max(sh(hi) * 1.35, 11); } else { const pad = (hi - lo) * 0.06 || 1; lo -= pad; hi += pad; if (pivot === 0) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); } }
  const ref = pivot ?? baseVal;
  const better = (v) => good === "up" ? v >= ref : v <= ref;
  const logTicks = [0, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000].map((t) => t + 1).filter((t) => t <= hi);
  return panel({ w: 800, h: 420, title, sub, xLabel: "rung of the day's RSI (1 = most oversold 1% of days)", yLabel, x: [0, 101], y: [log ? 1 : lo, hi, log ? "log" : null],
    xTicks: [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100], yTicks: log ? logTicks : undefined,
    yFmt: (v) => log ? `${fx(v - 1, 0)}` : unit === "%" ? `${v > 0 && pivot === 0 ? "+" : ""}${fx(v, Math.abs(hi - lo) < 4 ? 1 : 0)}${unit}` : `${fx(v, 0)}${unit}`,
    draw: (X, Y) => {
      let s = "";
      if (fin(baseVal)) s += `<line x1="${X(0)}" x2="${X(101)}" y1="${Y(sh(baseVal)).toFixed(1)}" y2="${Y(sh(baseVal)).toFixed(1)}" stroke="${better(baseVal) || pivot == null ? COL.up : COL.dn}" stroke-width="2" stroke-dasharray="8 6"/>`;
      for (const r of rows) {
        const v = key(r); if (!fin(v)) continue; const b = r.band?.[bandKey], c = better(v) ? COL.up : COL.dn;
        if (b && fin(b[0]) && fin(b[1])) s += `<line x1="${X(r.q).toFixed(1)}" x2="${X(r.q).toFixed(1)}" y1="${Y(sh(b[0])).toFixed(1)}" y2="${Y(sh(b[1])).toFixed(1)}" stroke="${c}" stroke-opacity="0.35" stroke-width="4"/>`;
        s += `<circle cx="${X(r.q).toFixed(1)}" cy="${Y(sh(v)).toFixed(1)}" r="3.4" fill="${c}"/>`;
      }
      if (fin(baseVal)) { const yb = Y(sh(baseVal)), top = yb - 70 > 70; s += label(X(101) - 8, top ? yb - 40 : yb + 44, `dashed = any day: ${unit === "%" && pivot === 0 && baseVal > 0 ? "+" : ""}${fx(baseVal, unit === "%" ? 2 : 0)}${unit}`, { anchor: "end", color: COL.hi, size: 13 }); }
      return s;
    } });
}

/** Pullbacks: every one as a dot (depth vs time to a new high), open ones hollow red at their time so far,
 *  plus the median time for "every pullback at least this deep". */
export function pullbackScatter(A, which = "pull") {
  const rec = which === "rec", P = rec ? A.records : A.pullbacks, SUM = rec ? A.rec : A.pull, bp = A.unit === "bp", mag = (p) => Math.max(bp ? 1 : 0.3, -p.depth);
  const xmax = Math.max(...P.map(mag)) * 1.15, xmin = bp ? Math.max(1, Math.min(...P.map(mag)) * 0.8) : Math.max(0.3, Math.min(...P.map(mag)) * 0.8);
  const ymax = Math.max(10, ...P.map((p) => p.lowToNew)) * 1.4;
  const unit = bp ? " bp" : "%";
  const rankTicks = [50, 75, 90, 99].map((q) => [q, -SUM.depthLadder[q]]);
  const title = rec ? `${A.name}: every decline from a record high — how deep, and how long until a NEW RECORD` : `${A.name}: every swing pullback — how deep, and how long until back above the top it fell from`;
  const sub = rec ? `${P.length} declines ${A.from.slice(0, 4)}–${A.to.slice(0, 4)}, record to lowest low before the next record · green = new record · red ring = not yet · line = middle wait, at least this deep`
    : `${P.length} swing pullbacks ${A.from.slice(0, 4)}–${A.to.slice(0, 4)} (${SUM.belowEarlierTop ?? "?"} began below an earlier top) · green = back above own top · red ring = not yet · line = middle wait, at least this deep`;
  return panel({ w: 1600, h: 620, title, sub,
    xLabel: `${rec ? "decline, record to low" : "pullback depth, top to low"} (${bp ? "basis points" : "%"}, log scale${bp ? "" : "; under 0.3% drawn at 0.3%"})`, yLabel: `${A.calendar ? "days" : "sessions"} from the low to ${rec ? "a new record" : "back above its top"} (log)`, x: [xmin, xmax, "log"], y: [1, ymax, "log"],
    xFmt: (v) => `${v}${unit}`, yFmt: (v) => `${v}`,
    xTicks: (bp ? [5, 10, 20, 50, 100, 200, 500] : [0.5, 1, 2, 3, 5, 10, 20, 30, 50, 80]).filter((v) => v >= xmin && v <= xmax),
    draw: (X, Y) => {
      let s = "";
      rankTicks.forEach(([q, v], j) => { const x = X(v), right = x > 1250; s += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${Y(ymax)}" y2="${Y(1)}" stroke="${COL.dn}" stroke-opacity="0.45" stroke-dasharray="3 5"/>` + label(x + (right ? -5 : 5), Y(1) - 12 - (j % 2) * 20, `deeper than ${q}%: ${fx(v, bp ? 0 : 1)}${unit}`, { color: COL.dn, size: 13, anchor: right ? "end" : "start" }); });
      for (const p of P) { const x = X(mag(p)), y = Y(Math.max(1, p.lowToNew)); s += p.done ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.2" fill="${COL.up}" fill-opacity="0.8"/>` : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="none" stroke="${COL.dn}" stroke-width="2.2"/>`; }
      const pts = SUM.atLeast.filter((r) => r[2] != null).map((r) => [Math.max(xmin, -r[0]), Math.max(1, r[2])]).sort((a, b) => a[0] - b[0]);
      if (pts.length > 1) s += `<polyline points="${pts.map(([a, b]) => `${X(a).toFixed(1)},${Y(b).toFixed(1)}`).join(" ")}" fill="none" stroke="${COL.up}" stroke-width="3" stroke-linejoin="round"/>`;
      const pick = [...P].sort((a, b) => a.depth - b.depth).slice(0, 3), longest = [...P].sort((a, b) => b.lowToNew - a.lowToNew)[0];
      if (longest && !pick.includes(longest)) pick.push(longest);
      const labs = pick.map((p) => ({ p, x: X(mag(p)), y: Math.max(84, Y(Math.max(1, p.lowToNew)) + 5) })).sort((a, b) => a.y - b.y);
      for (let j = 1; j < labs.length; j++) if (labs[j].y - labs[j - 1].y < 19) labs[j].y = labs[j - 1].y + 19;
      for (const L of labs) { const p = L.p; s += label(L.x - 10, L.y, `${p.top.slice(0, 7)} ${rec ? "record" : "top"}: ${fx(p.depth, bp ? 0 : 1)}${unit}, ${p.done ? `${p.lowToNew} ${A.calendar ? "days" : "sessions"} to ${rec ? "a new record" : "back above it"}` : `${p.lowToNew}+ so far`}`, { color: p.done ? COL.up : COL.dn, anchor: "end", size: 13 }); }
      return s;
    } });
}

/** Time-to-new-high curves: share of pullbacks back above the old top by t sessions after the low. */
export function recoveryCurves(A) {
  const C = A.pull.curves, tmax = Math.max(20, ...A.pullbacks.map((p) => p.lowToNew)) * 1.2;
  const styles = [{ w: 4, d: null }, { w: 2.8, d: "10 6" }, { w: 2.4, d: "3 5" }, { w: 2.2, d: "14 4 2 4" }];
  const nameOf = (q) => q === 0 ? "every pullback" : `display group: depth rank ≥ ${q}`;
  return panel({ w: 1600, h: 560, title: `${A.name}: how long until back above the top it fell from — no next-leg cut-off`, sub: `Share back above their own top, by ${A.calendar ? "days" : "sessions"} after the low. Not a new record (see 3b). Rank groups are display points; the scatter line is continuous.`,
    xLabel: `${A.calendar ? "days" : "sessions"} after the low (log scale)`, yLabel: "% back above its own top", x: [1, tmax, "log"], y: [0, 100], yTicks: [0, 25, 50, 75, 100], yFmt: (v) => v + "%",
    draw: (X, Y) => {
      let s = `<line x1="${X(1)}" x2="${X(tmax)}" y1="${Y(50)}" y2="${Y(50)}" stroke="${COL.axis}" stroke-dasharray="4 4"/>`;
      C.forEach((c, i) => {
        if (!c.steps.length) return; const pts = [[1, 0]]; let last = 0; for (const [t, v] of c.steps) { const tt = Math.max(1, t); pts.push([tt, last], [tt, v]); last = v; } pts.push([tmax, last]);
        s += `<polyline points="${pts.map(([a, b]) => `${X(a).toFixed(1)},${Y(b).toFixed(1)}`).join(" ")}" fill="none" stroke="${COL.up}" stroke-width="${styles[i].w}"${styles[i].d ? ` stroke-dasharray="${styles[i].d}"` : ""}/>`;
        const y = 100 + i * 26, x = X(1) + 16;
        s += `<line x1="${x}" x2="${x + 46}" y1="${y}" y2="${y}" stroke="${COL.up}" stroke-width="${styles[i].w}"${styles[i].d ? ` stroke-dasharray="${styles[i].d}"` : ""}/>`;
        s += label(x + 56, y + 5, `${nameOf(c.fromRank)} (${c.n}${c.open ? `, ${c.open} still open` : ""}): half back by ${c.median ?? "—"}, ${fx(last, 0)}% by now`, { color: COL.hi });
      });
      return s;
    } });
}

/** Slope of "what came next" across the rungs, one row per instrument: dot = rank correlation between rung and the
 *  rung's median result, bar = 90% range from resampling whole quarters. Red = negative (the lower the rung, the
 *  better the next result), green = positive. Faint bar = the range crosses zero. */
export function slopeForest(d, key = "f20", keys) {
  const I = d.instruments, rows = [];
  for (const k of keys) { const A = I[k]; if (!A?.slope?.[key]) continue; rows.push({ name: A.name, ...A.slope[key] });
    if (A.slopeEra) { rows.push({ name: `  ${A.short} before ${A.slopeEra.split.slice(0, 4)}`, ...A.slopeEra.before[key] }); rows.push({ name: `  ${A.short} from ${A.slopeEra.split.slice(0, 4)}`, ...A.slopeEra.after[key] }); } }
  const w = 1600, rh = 26, top = 96, left = 420, right = 300, h = top + rows.length * rh + 64, X = scale(-1, 1, left, w - right);
  const what = key === "f20" ? "the change 20 sessions later" : key === "f60" ? "the change 60 sessions later" : "the worst close in the next 60 sessions";
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" ${FONT}><rect width="${w}" height="${h}" fill="${COL.bg}"/>`;
  s += `<text x="24" y="30" font-size="20" fill="${COL.hi}" font-weight="600">Slope across the 100 rungs: rung vs ${esc(what)}, with a 90% range</text>`;
  s += `<text x="24" y="56" font-size="14" fill="${COL.dim}">Dot = rank correlation of rung (1..100) with that rung's middle result. Bar = 90% range, whole calendar quarters resampled. Red = negative (lower rung, higher result);</text>`;
  s += `<text x="24" y="76" font-size="14" fill="${COL.dim}">green = positive. Faint = the range crosses zero. The US funds share one market and one period (2004–2026): read them as one observation, not many.</text>`;
  for (const v of [-1, -0.5, 0, 0.5, 1]) s += `<line x1="${X(v)}" x2="${X(v)}" y1="${top - 6}" y2="${h - 50}" stroke="${v === 0 ? COL.axis : COL.grid}" stroke-width="${v === 0 ? 2 : 1}"/><text x="${X(v)}" y="${h - 30}" font-size="14" fill="${COL.dim}" text-anchor="middle">${v > 0 ? "+" : ""}${v}</text>`;
  rows.forEach((r, i) => {
    const y = top + i * rh + rh / 2, c = (r.rho ?? 0) >= 0 ? COL.up : COL.dn, b = r.band, crosses = b ? b[0] <= 0 && b[1] >= 0 : true;
    s += `<text x="${left - 14}" y="${y + 5}" font-size="14" fill="${r.name.startsWith("  ") ? COL.dim : COL.hi}" text-anchor="end">${esc(r.name.trim() === r.name ? r.name : "↳ " + r.name.trim())}</text>`;
    if (b) s += `<line x1="${X(b[0]).toFixed(1)}" x2="${X(b[1]).toFixed(1)}" y1="${y}" y2="${y}" stroke="${c}" stroke-opacity="${crosses ? 0.3 : 0.75}" stroke-width="6"/>`;
    if (r.rho != null) s += `<circle cx="${X(r.rho).toFixed(1)}" cy="${y}" r="5.5" fill="${c}"/>`;
    s += `<text x="${w - right + 20}" y="${y + 5}" font-size="14" fill="${c}">${r.rho == null ? "—" : (r.rho > 0 ? "+" : "") + r.rho.toFixed(2)}${b ? `  (${b[0].toFixed(2)} to ${b[1].toFixed(2)})` : ""}</text>`;
  });
  return s + "</svg>";
}

/* ============================ runner ============================ */
export function writeAll(d, dir) {
  const out = path.join(dir, "charts"); fs.mkdirSync(out, { recursive: true });
  const files = []; const put = (name, svg) => { fs.writeFileSync(path.join(out, name), svg); files.push("charts/" + name); };
  const keys = Object.keys(d.instruments).filter((k) => !d.instruments[k].missing), I = d.instruments;
  put("ladder-heat-full.svg", heatLadder(d, "full", keys));
  put("ladder-heat-3y.svg", heatLadder(d, "last3", keys));
  const X = d.cross;
  put("ladder-btc-spy-qqq.svg", ladderLines([{ name: "Bitcoin", v: I.BTCUSD.ladder.full, span: `${I.BTCUSD.from.slice(0, 4)}–` }, { name: "SPY", v: X.SPY_sinceBTC.ladder, span: `same years` }, { name: "QQQ", v: X.QQQ_sinceBTC.ladder, span: "same years" }],
    { title: "Does Bitcoin's RSI go deeper? RSI at every rung, same years", sub: `Bitcoin vs SPY and QQQ, each read on its own days since ${X.SPY_sinceBTC.from}. Red where RSI is under 50, green over 50.` }));
  put("ladder-long-view.svg", ladderLines([{ name: "Bitcoin", v: I.BTCUSD.ladder.full }, { name: "S&P 500 since 1928", v: I.SPX.ladder.full }, { name: "Nasdaq 100 since 1985", v: I.NDX.ladder.full }],
    { title: "Bitcoin against the long stock records", sub: "The S&P 500 since 1928 (with the 1929–32 crash) and the Nasdaq 100 since 1985 (with the 2000–02 bust)." }));
  put("gap-btc-vs-spy.svg", gapBars(X.SPY_sinceBTC.ladder, I.BTCUSD.ladder.full, { title: "Bitcoin minus SPY, rung by rung (same years)", sub: "Red bar = Bitcoin's RSI is LOWER (deeper) than SPY's at that rung; green = higher.", aName: "SPY", bName: "Bitcoin" }));
  for (const key of ["f20", "f60", "w60"]) put(`slope-${key}.svg`, slopeForest(d, key, keys));
  const vsSpy = keys.filter((k) => k !== "SPY");
  for (const k of vsSpy) put(`gap-${k}-vs-spy.svg`, gapBars(I.SPY.ladder.full, I[k].ladder.full, { title: `${I[k].name} minus SPY, rung by rung`, sub: `${I[k].name} ${I[k].from.slice(0, 4)}–${I[k].to.slice(0, 4)} vs SPY ${I.SPY.from.slice(0, 4)}–${I.SPY.to.slice(0, 4)}. Red = lower (deeper) than SPY at that rung; green = higher.`, aName: "SPY", bName: I[k].short }));
  for (const k of keys) {
    const A = I[k], u = A.unit === "bp" ? " bp" : "%", B = A.base, sess = A.calendar ? "days" : "sessions";
    put(`out-${k}-f20.svg`, outcomePanel(A, { key: (r) => r.f20, bandKey: "f20", title: `20 ${sess} later: middle result`, sub: `${A.name} · dot = median of that rung's days · bar = 90% band`, yLabel: `change${u === "%" ? " %" : ", bp"}`, unit: u, baseVal: B.f20, pivot: 0 }));
    put(`out-${k}-f60.svg`, outcomePanel(A, { key: (r) => r.f60, bandKey: "f60", title: `60 ${sess} later: middle result`, sub: `${A.name} · band from whole quarters resampled`, yLabel: `change${u === "%" ? " %" : ", bp"}`, unit: u, baseVal: B.f60, pivot: 0 }));
    put(`out-${k}-up20.svg`, outcomePanel(A, { key: (r) => r.up20, bandKey: "up20", title: `Higher 20 ${sess} later: share of days`, sub: `${A.name} · green = above the any-day share`, yLabel: "% of days higher", unit: "%", baseVal: B.up20 }));
    put(`out-${k}-up60.svg`, outcomePanel(A, { key: (r) => r.up60, bandKey: "up60", title: `Higher 60 ${sess} later: share of days`, sub: `${A.name} · green = above the any-day share`, yLabel: "% of days higher", unit: "%", baseVal: B.up60 }));
    put(`out-${k}-w60.svg`, outcomePanel(A, { key: (r) => r.w60, bandKey: "w60", title: `Worst close inside the next 60 ${sess}`, sub: `${A.name} · middle worst dip · green = shallower than any day`, yLabel: `below the entry close${u === "%" ? ", %" : ", bp"}`, unit: u, baseVal: B.w60 }));
    put(`out-${k}-rec.svg`, outcomePanel(A, { key: (r) => r.rec?.median, bandKey: "none", title: `Wait until back above the prior swing high`, sub: `${A.name} · middle wait, open ones counted · green = shorter`, yLabel: `${sess} (log)`, unit: "", baseVal: Math.max(1, B.rec.median ?? 1), good: "down", log: true }));
    put(`pull-${k}-scatter.svg`, pullbackScatter(A));
    put(`pull-${k}-curves.svg`, recoveryCurves(A));
    put(`record-${k}-scatter.svg`, pullbackScatter(A, "rec"));
  }
  return files;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const here = path.dirname(fileURLToPath(import.meta.url)), dir = path.resolve(here, "../../deliverables/20260928/rsi-ladder");
  const d = JSON.parse(fs.readFileSync(path.join(dir, "rsi-ladder.json"), "utf8"));
  const files = writeAll(d, dir);
  console.log(`wrote ${files.length} charts to ${path.join(dir, "charts")}`);
}

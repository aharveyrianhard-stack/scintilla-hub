/* BOTTOMS · stand-alone SVG charts (each saved as a file next to the page, so the visuals persist).
   Look: dark panel, mono labels, greys only for frame/text; every DATA line follows direction — a segment that
   rises is green, one that falls is red (Alan, 23 Sep: "Daily up, daily down, green, red"). Bands are fills. */
export const UP = "#00FFA3", DN = "#FF2D55", INK = "#9C9CAE", TXT = "#C8C8D2", GRID = "#24242E", PANEL = "#0B0B12", BAND = "#1C1C28";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const f = (x) => Math.round(x * 10) / 10;
const ly0 = (leg) => leg.length ? leg[leg.length - 1].row : -1;
function niceTicks(lo, hi, n = 5) {
  const span = hi - lo || 1, step0 = span / n, mag = 10 ** Math.floor(Math.log10(step0)), step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n + 0.5);
  const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6); return out;
}
/** Direction-coloured polyline: consecutive segments grouped by rising / falling. */
function dirPath(pts, X, Y, { width = 2.4, dash = null, flat = null } = {}) {
  // consecutive segments of the same direction become ONE polyline, so a dash pattern runs continuously
  const clean = pts.filter(([x, y]) => x != null && y != null && Number.isFinite(y));
  let s = "", prev = flat ?? UP, run = [];
  const flush = (col) => { if (run.length > 1) s += `<polyline points="${run.map(([x, y]) => `${f(X(x))},${f(Y(y))}`).join(" ")}" fill="none" stroke="${col}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`; };
  for (let i = 1; i < clean.length; i++) {
    const [, y0] = clean[i - 1], [, y1] = clean[i]; const col = y1 > y0 ? UP : y1 < y0 ? DN : prev;
    if (i === 1) { run = [clean[0], clean[1]]; prev = col; continue; }
    if (col === prev) run.push(clean[i]); else { flush(prev); run = [clean[i - 1], clean[i]]; prev = col; }
  }
  flush(prev);
  return s;
}
/** Line chart. series: [{name, pts:[[x,y]], band:[[x,lo,hi]], dash}] · marks: [{x, label}] shaded columns · yMarks: [{y,label}] axis ticks. */
export function lineChart({ title, sub = "", xLabel = "", yLabel = "", series, xDomain = null, yDomain = null, marks = [], yMarks = [], w = 1100, h = 460, legend = true, xFmt = (v) => v, yFmt = (v) => v }) {
  const m = { l: 74, r: 24, t: 70, b: 62 }, iw0 = w - m.l - m.r;
  // legend laid out left to right under the subtitle, wrapping; the plot starts below it
  const leg = []; if (legend) { let lx = 0, ly = 0; for (const se of series.filter((x) => x.name)) { const tw = se.name.length * 8.4 + 58; if (lx + tw > iw0 && lx > 0) { lx = 0; ly++; } leg.push({ se, x: lx, row: ly }); lx += tw; } m.t = 70 + (ly0(leg) + 1) * 22 + 8; }
  const iw = iw0, ih = h - m.t - m.b;
  const xs = series.flatMap((s) => s.pts.map((p) => p[0])).concat(series.flatMap((s) => (s.band || []).map((b) => b[0])));
  const ys = series.flatMap((s) => s.pts.map((p) => p[1])).concat(series.flatMap((s) => (s.band || []).flatMap((b) => [b[1], b[2]]))).concat(yMarks.map((q) => q.y)).filter((v) => v != null && Number.isFinite(v));
  const [x0, x1] = xDomain ?? [Math.min(...xs), Math.max(...xs)];
  let [y0, y1] = yDomain ?? [Math.min(...ys), Math.max(...ys)]; if (!yDomain) { const pad = (y1 - y0) * 0.06 || 1; y0 -= pad; y1 += pad; }
  const X = (v) => m.l + (v - x0) / (x1 - x0 || 1) * iw, Y = (v) => m.t + ih - (v - y0) / (y1 - y0 || 1) * ih;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="ui-monospace,Menlo,monospace">`;
  s += `<rect width="${w}" height="${h}" fill="${PANEL}"/>`;
  s += `<text x="${m.l}" y="30" fill="${TXT}" font-size="20" font-weight="600">${esc(title)}</text>`;
  if (sub) s += `<text x="${m.l}" y="52" fill="${INK}" font-size="14">${esc(sub)}</text>`;
  for (const k of marks) { const xa = X(k.x0 ?? k.x - 0.5), xb = X(k.x1 ?? k.x + 0.5); s += `<rect x="${f(Math.min(xa, xb))}" y="${m.t}" width="${f(Math.max(2, Math.abs(xb - xa)))}" height="${ih}" fill="${BAND}"/>`; if (k.label) s += `<text x="${f((xa + xb) / 2 + 6)}" y="${m.t + 16}" fill="${INK}" font-size="13">${esc(k.label)}</text>`; }
  for (const t of niceTicks(y0, y1)) { s += `<line x1="${m.l}" x2="${m.l + iw}" y1="${f(Y(t))}" y2="${f(Y(t))}" stroke="${GRID}" stroke-width="1"/><text x="${m.l - 8}" y="${f(Y(t) + 5)}" fill="${INK}" font-size="13" text-anchor="end">${esc(yFmt(t))}</text>`; }
  for (const t of niceTicks(x0, x1, 8)) s += `<text x="${f(X(t))}" y="${m.t + ih + 22}" fill="${INK}" font-size="13" text-anchor="middle">${esc(xFmt(t))}</text>`;
  for (const q of yMarks) s += `<path d="M${m.l + iw} ${f(Y(q.y))} l8 -6 v12 z" fill="${INK}"/><text x="${m.l + iw - 6}" y="${f(Y(q.y) - 8)}" fill="${INK}" font-size="13" text-anchor="end">${esc(q.label)}</text>`;
  for (const se of series) if (se.band?.length) {
    const b = se.band.filter((r) => r[1] != null && r[2] != null);
    if (b.length > 1) s += `<path d="M${b.map((r) => `${f(X(r[0]))} ${f(Y(r[2]))}`).join(" L")} L${b.slice().reverse().map((r) => `${f(X(r[0]))} ${f(Y(r[1]))}`).join(" L")} Z" fill="${se.bandFill || BAND}" opacity="0.9"/>`;
  }
  for (const se of series) s += dirPath(se.pts, X, Y, { dash: se.dash, width: se.width ?? 2.4 });
  for (const se of series) for (const [x, y, lab] of se.pts) if (lab) s += `<text x="${f(X(x) + 6)}" y="${f(Y(y) - 8)}" fill="${TXT}" font-size="13">${esc(lab)}</text>`;
  s += `<text x="${m.l + iw / 2}" y="${h - 14}" fill="${INK}" font-size="14" text-anchor="middle">${esc(xLabel)}</text>`;
  s += `<text transform="translate(18 ${m.t + ih / 2}) rotate(-90)" fill="${INK}" font-size="14" text-anchor="middle">${esc(yLabel)}</text>`;
  for (const { se, x, row } of leg) { const lx = m.l + x, ly = 72 + row * 22, sw = se.width ?? 2.4, da = se.dash ? ` stroke-dasharray="${se.dash}"` : ""; s += `<line x1="${lx}" x2="${lx + 18}" y1="${ly}" y2="${ly}" stroke="${UP}" stroke-width="${sw}"${da}/><line x1="${lx + 18}" x2="${lx + 36}" y1="${ly}" y2="${ly}" stroke="${DN}" stroke-width="${sw}"${da}/><text x="${lx + 42}" y="${ly + 5}" fill="${TXT}" font-size="13">${esc(se.name)}</text>`; }
  return s + "</svg>";
}
/** Bars (histogram / categories). bars: [{label, v, col?}] — colour from the caller (direction meaning stated under the chart). */
export function barChart({ title, sub = "", bars, w = 1100, h = 420, yLabel = "", xLabel = "", yFmt = (v) => v, valFmt = (v) => v, rotate = false }) {
  const m = { l: 74, r: 24, t: 70, b: rotate ? 110 : 62 }, iw = w - m.l - m.r, ih = h - m.t - m.b;
  const vs = bars.map((b) => b.v).filter((v) => v != null), lo = Math.min(0, ...vs), hi = Math.max(0, ...vs) * 1.12 || 1;
  const Y = (v) => m.t + ih - (v - lo) / (hi - lo) * ih, bw = iw / bars.length;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="ui-monospace,Menlo,monospace"><rect width="${w}" height="${h}" fill="${PANEL}"/>`;
  s += `<text x="${m.l}" y="30" fill="${TXT}" font-size="20" font-weight="600">${esc(title)}</text>`; if (sub) s += `<text x="${m.l}" y="52" fill="${INK}" font-size="14">${esc(sub)}</text>`;
  for (const t of niceTicks(lo, hi)) s += `<line x1="${m.l}" x2="${m.l + iw}" y1="${f(Y(t))}" y2="${f(Y(t))}" stroke="${GRID}"/><text x="${m.l - 8}" y="${f(Y(t) + 5)}" fill="${INK}" font-size="13" text-anchor="end">${esc(yFmt(t))}</text>`;
  bars.forEach((b, i) => {
    if (b.v == null) return; const x = m.l + i * bw + bw * 0.14, y = Math.min(Y(b.v), Y(0)), hh = Math.abs(Y(b.v) - Y(0));
    s += `<rect x="${f(x)}" y="${f(y)}" width="${f(bw * 0.72)}" height="${f(Math.max(1, hh))}" fill="${b.col || (b.v >= 0 ? UP : DN)}" opacity="0.85"/>`;
    if (b.show !== false && bw > 26) s += `<text x="${f(x + bw * 0.36)}" y="${f(y - 6)}" fill="${TXT}" font-size="12" text-anchor="middle">${esc(valFmt(b.v))}</text>`;
    const lx = m.l + i * bw + bw / 2;
    s += rotate ? `<text transform="translate(${f(lx + 4)} ${m.t + ih + 12}) rotate(55)" fill="${INK}" font-size="12">${esc(b.label)}</text>` : `<text x="${f(lx)}" y="${m.t + ih + 22}" fill="${INK}" font-size="12" text-anchor="middle">${esc(b.label)}</text>`;
  });
  s += `<text x="${m.l + iw / 2}" y="${h - 12}" fill="${INK}" font-size="14" text-anchor="middle">${esc(xLabel)}</text><text transform="translate(18 ${m.t + ih / 2}) rotate(-90)" fill="${INK}" font-size="14" text-anchor="middle">${esc(yLabel)}</text>`;
  return s + "</svg>";
}
/** Horizontal stacked shares. rows: [{label, parts:[{v, col, name}]}] (v in %). */
export function stackChart({ title, sub = "", rows, w = 1100, rowH = 38, legend = [] }) {
  const m = { l: 250, r: 30, t: 84, b: 30 }, iw = w - m.l - m.r, h = m.t + rows.length * rowH + m.b;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="ui-monospace,Menlo,monospace"><rect width="${w}" height="${h}" fill="${PANEL}"/>`;
  s += `<text x="24" y="30" fill="${TXT}" font-size="20" font-weight="600">${esc(title)}</text>`; if (sub) s += `<text x="24" y="52" fill="${INK}" font-size="14">${esc(sub)}</text>`;
  let lx = m.l; for (const L of legend) { s += `<rect x="${lx}" y="62" width="14" height="14" fill="${L.col}"/><text x="${lx + 20}" y="74" fill="${TXT}" font-size="13">${esc(L.name)}</text>`; lx += L.name.length * 7.8 + 44; }
  rows.forEach((r, i) => {
    const y = m.t + i * rowH + 6; let x = m.l;
    s += `<text x="${m.l - 10}" y="${y + rowH / 2}" fill="${TXT}" font-size="14" text-anchor="end">${esc(r.label)}</text>`;
    for (const p of r.parts) { const ww = iw * (p.v || 0) / 100; if (ww > 0) { s += `<rect x="${f(x)}" y="${y}" width="${f(ww)}" height="${rowH - 12}" fill="${p.col}"/>`; if (ww > 34) s += `<text x="${f(x + ww / 2)}" y="${y + rowH / 2}" fill="#07070C" font-size="13" font-weight="700" text-anchor="middle">${Math.round(p.v)}%</text>`; } x += ww; }
  });
  return s + "</svg>";
}

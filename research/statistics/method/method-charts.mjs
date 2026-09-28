/* METHOD DEMO charts · node research/statistics/method/method-charts.mjs — reads method-demo.json, writes SVGs next to
   the page. Look: dark panel, mono labels, greys for frame and text; data marks green when up / better, red when down
   / worse (Alan, 23 Sep). Thin marks, one axis per chart, direct labels, no legend needed where the title names it. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../..");
const DIR = path.join(ROOT, "deliverables/20260928/statistician"), CH = path.join(DIR, "charts");
const J = JSON.parse(fs.readFileSync(path.join(DIR, "method-demo.json"), "utf8"));
fs.mkdirSync(CH, { recursive: true });
const UP = "#00FFA3", DN = "#FF2D55", INK = "#9C9CAE", TXT = "#C8C8D2", GRID = "#24242E", PANEL = "#0B0B12", MUTE = "#5A5A6C";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"), f = (x) => Math.round(x * 10) / 10;
const head = (w, h, title, sub) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="ui-monospace,Menlo,monospace"><rect width="${w}" height="${h}" fill="${PANEL}"/><text x="60" y="30" fill="${TXT}" font-size="19" font-weight="600">${esc(title)}</text><text x="60" y="52" fill="${INK}" font-size="13">${esc(sub)}</text>`;
const save = (name, svg) => fs.writeFileSync(path.join(CH, name), svg + "</svg>");

/* A · three intervals, one number */
{
  const A = J.A, w = 1100, h = 330, x0 = 30, x1 = 100, L = 300, R = w - 40, X = (v) => L + (v - x0) / (x1 - x0) * (R - L);
  let s = head(w, h, `SPY more than 10% below its 200-day: up 60 sessions later — ${A.share}% of ${A.days} days`, `the same number, three ways of saying how sure · any day ${A.anyDay}%`);
  for (const t of [30, 40, 50, 60, 70, 80, 90, 100]) s += `<line x1="${f(X(t))}" x2="${f(X(t))}" y1="80" y2="${h - 50}" stroke="${GRID}"/><text x="${f(X(t))}" y="${h - 30}" fill="${INK}" font-size="12" text-anchor="middle">${t}%</text>`;
  s += `<line x1="${f(X(A.anyDay))}" x2="${f(X(A.anyDay))}" y1="70" y2="${h - 50}" stroke="${INK}" stroke-dasharray="4 4"/><text x="${f(X(A.anyDay)) + 6}" y="78" fill="${INK}" font-size="12">any day ${A.anyDay}%</text>`;
  const rowsA = [["counted as 275 coin flips (naive)", A.naive90, DN], [`resampling runs of days (block ${A.block})`, A.bootstrap90, UP], [`worth ≈ ${A.effectiveNDeep} independent observations`, null, MUTE]];
  rowsA.forEach(([label, iv, col], i) => {
    const y = 115 + i * 62;
    s += `<text x="${L - 12}" y="${y + 5}" fill="${TXT}" font-size="13" text-anchor="end">${esc(label)}</text>`;
    if (iv) { s += `<line x1="${f(X(iv[0]))}" x2="${f(X(iv[1]))}" y1="${y}" y2="${y}" stroke="${col}" stroke-width="6" stroke-linecap="round"/><circle cx="${f(X(A.share))}" cy="${y}" r="7" fill="${PANEL}" stroke="${TXT}" stroke-width="2"/>`;
      s += `<text x="${f(X(iv[0])) - 8}" y="${y + 5}" fill="${INK}" font-size="12" text-anchor="end">${iv[0]}%</text><text x="${f(X(iv[1])) + 8}" y="${y + 5}" fill="${INK}" font-size="12">${iv[1]}%</text>`; }
    else s += `<text x="${L}" y="${y + 5}" fill="${INK}" font-size="12">${A.episodes} visits in ${A.episodeYears.length} years · runs of days: middle ${A.medianRun}, longest ${Math.max(...A.runLengths)} (2008–09)</text>`;
  });
  s += `<text x="60" y="${h - 8}" fill="${MUTE}" font-size="12">90% ranges · naive = a coin-flip count · resampled = whole runs of days kept together, the way bear markets arrive</text>`;
  save("a-200day-intervals.svg", s);
}
/* B · 100 rungs: median 20-session result with its band; p-values below */
{
  const B = J.B, w = 1400, h = 660, L = 70, R = w - 30, T = 75, mid = 360, X = (q) => L + (q - 1) / 99 * (R - L);
  const ys = B.rungs.flatMap((r) => [r.lo, r.hi, r.median20]).filter((v) => v != null), y0 = Math.min(...ys) - 0.3, y1 = Math.max(...ys) + 0.3, Y = (v) => T + (mid - T) - (v - y0) / (y1 - y0) * (mid - T);
  let s = head(w, h, `SPY: 100 RSI rungs (own 3-year percentile) — middle 20-session result, with its 90% band`, `any day ${B.anyDayMedian20}% · a rung is 1% of days · ${B.rawCount} rungs read as "different from any day" at 10%, about ${B.expectedByLuck} expected by luck · surviving a 10% false-discovery check: ${B.survivorsFDR10.length}`);
  for (const t of [-2, -1, 0, 1, 2, 3, 4]) if (t >= y0 && t <= y1) s += `<line x1="${L}" x2="${R}" y1="${f(Y(t))}" y2="${f(Y(t))}" stroke="${GRID}"/><text x="${L - 8}" y="${f(Y(t)) + 4}" fill="${INK}" font-size="12" text-anchor="end">${t > 0 ? "+" : ""}${t}%</text>`;
  s += `<line x1="${L}" x2="${R}" y1="${f(Y(B.anyDayMedian20))}" y2="${f(Y(B.anyDayMedian20))}" stroke="${INK}" stroke-dasharray="4 4"/><text x="${L + 6}" y="${f(Y(B.anyDayMedian20)) - 8}" fill="${INK}" font-size="12">any day ${B.anyDayMedian20}%</text>`;
  for (const r of B.rungs) { if (r.lo == null) continue; const col = r.median20 >= B.anyDayMedian20 ? UP : DN; s += `<line x1="${f(X(r.rung))}" x2="${f(X(r.rung))}" y1="${f(Y(r.lo))}" y2="${f(Y(r.hi))}" stroke="${col}" stroke-opacity="0.35" stroke-width="3"/><circle cx="${f(X(r.rung))}" cy="${f(Y(r.median20))}" r="3.2" fill="${col}"/>`; }
  for (const q of [1, 10, 25, 50, 75, 90, 100]) s += `<text x="${f(X(q))}" y="${mid + 18}" fill="${INK}" font-size="12" text-anchor="middle">${q}</text>`;
  s += `<text x="${L}" y="${mid + 36}" fill="${MUTE}" font-size="12">rung 1 = most oversold 1% of days · rung 100 = most overbought</text>`;
  // p-value strip
  const pT = mid + 70, pB = h - 40, PY = (p) => pT + (pB - pT) * (Math.log10(Math.max(p, 0.0005)) - Math.log10(0.0005)) / (0 - Math.log10(0.0005));
  s += `<text x="${L}" y="${pT - 8}" fill="${TXT}" font-size="13">p-value per rung (log scale): the chance of a gap this size by luck · above the 0.10 line looks "real" alone</text>`;
  for (const t of [0.001, 0.01, 0.1, 1]) s += `<line x1="${L}" x2="${R}" y1="${f(PY(t))}" y2="${f(PY(t))}" stroke="${GRID}"/><text x="${L - 8}" y="${f(PY(t)) + 4}" fill="${INK}" font-size="12" text-anchor="end">${t}</text>`;
  s += `<line x1="${L}" x2="${R}" y1="${f(PY(0.1))}" y2="${f(PY(0.1))}" stroke="${INK}" stroke-dasharray="4 4"/><text x="${R}" y="${f(PY(0.1)) - 6}" fill="${INK}" font-size="12" text-anchor="end">0.10 line</text>`;
  s += `<line x1="${L}" x2="${R}" y1="${f(PY(0.001))}" y2="${f(PY(0.001))}" stroke="${TXT}" stroke-dasharray="2 3"/><text x="${R}" y="${f(PY(0.001)) - 6}" fill="${TXT}" font-size="12" text-anchor="end">false-discovery line: after 100 tests the smallest p must be under 0.001</text>`;
  for (const r of B.rungs) if (r.p != null) { const col = r.p < 0.1 ? (r.median20 >= B.anyDayMedian20 ? UP : DN) : MUTE; s += `<circle cx="${f(X(r.rung))}" cy="${f(PY(r.p))}" r="3" fill="${col}"/>`; }
  save("b-rungs-fdr.svg", s);
}
/* C · the two halves */
{
  const C = J.C, w = 1100, h = 330, x0 = 40, x1 = 100, L = 330, R = w - 40, X = (v) => L + (v - x0) / (x1 - x0) * (R - L);
  let s = head(w, h, `SPY RSI bottom 10%, above the 200-day → up 20 sessions later, each half of history alone`, `the share of episodes, its 90% resampled range, and that period's any-uptrend-day share (dashed)`);
  for (const t of [40, 50, 60, 70, 80, 90, 100]) s += `<line x1="${f(X(t))}" x2="${f(X(t))}" y1="70" y2="${h - 50}" stroke="${GRID}"/><text x="${f(X(t))}" y="${h - 30}" fill="${INK}" font-size="12" text-anchor="middle">${t}%</text>`;
  C.splits.forEach((sp, i) => {
    const y = 105 + i * 66, col = sp.shareEpisodesUp > sp.anyUptrendDay ? UP : DN;
    s += `<text x="${L - 12}" y="${y + 5}" fill="${TXT}" font-size="13" text-anchor="end">${esc(sp.period)} · ${sp.episodes} episodes</text>`;
    s += `<line x1="${f(X(sp.bootstrap90[0]))}" x2="${f(X(sp.bootstrap90[1]))}" y1="${y}" y2="${y}" stroke="${col}" stroke-width="6" stroke-linecap="round"/><circle cx="${f(X(sp.shareEpisodesUp))}" cy="${y}" r="7" fill="${PANEL}" stroke="${TXT}" stroke-width="2"/>`;
    s += `<line x1="${f(X(sp.anyUptrendDay))}" x2="${f(X(sp.anyUptrendDay))}" y1="${y - 18}" y2="${y + 18}" stroke="${INK}" stroke-dasharray="3 3"/>`;
    s += `<text x="${f(X(sp.shareEpisodesUp))}" y="${y - 12}" fill="${TXT}" font-size="12" text-anchor="middle">${sp.shareEpisodesUp}%</text><text x="${f(X(sp.anyUptrendDay))}" y="${y + 32}" fill="${INK}" font-size="11" text-anchor="middle">any ${sp.anyUptrendDay}%</text>`;
    s += `<text x="${R + 2}" y="${y + 5}" fill="${INK}" font-size="12" text-anchor="end">p ${sp.pAnyDay}</text>`;
  });
  s += `<text x="60" y="${h - 8}" fill="${MUTE}" font-size="12">same direction in both halves (the effect is consistent) — but each half's range covers its any-day line (the size is not proven)</text>`;
  save("c-walk-forward.svg", s);
}
console.log("charts written", fs.readdirSync(CH));

/* D1 — writes diag-data.js: each diagnosis screenshot of the live Hub with its numbered marks. Every mark is an
   element box measured from the live page at capture time (screens/diag/rects-*.json), except the parts drawn inside
   the Station chart iframe and the Geiger / Fundamentals panels, which are placed from the screenshot itself (said so). */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const HERE = fileURLToPath(new URL("..", import.meta.url));
const R = (w) => JSON.parse(readFileSync(HERE + `screens/diag/rects-${w}.json`, "utf8")).named;
const box = (r, pad = 3) => r && r.w ? { x: r.x - pad, y: r.y - pad, w: r.w + 2 * pad, h: Math.max(r.h, 10) + 2 * pad } : null;
const m = (n, r, label, how = "measured") => (r ? { n, ...r, label, how } : null);
const shots = [];
for (const w of [1680, 1440, 390]) {
  const n = R(w), b = n.board, t = n.meta, H = w === 390 ? null : (w >= 1600 ? 1050 : 900);
  const img = (s) => `screens/diag/live-${w}-${s}.png`;
  const identLeft = b.ident ? { x: b.ident.x + 6, y: b.ident.y + 4, w: Math.min(260, b.ident.w - 12), h: b.ident.h - 8 } : null;
  shots.push({ id: `${w}-board`, img: img("board"), w, h: H, title: `${w} wide · nothing picked`, marks: [
    m(1, identLeft, "the empty company bar: a dash"), m(2, box(b.identStat), "CLOSED, second copy"), m(2, box(b.headStat), "CLOSED, the one to keep"),
    m(11, box(b.mtabAlloc, 0), "ALLOCATION: underlined, left"), m(11, box(b.mtabStation, 0), "STATION: underlined, left"),
    m(6, box(b.cohtab), "cohort tabs " + (b.cohtab && b.cohtab.fs)), m(6, box(b.hdr, 1), "column heads " + (b.hdr && b.hdr.fs)),
    m(8, box(b.usualHdr), "USUAL DAY " + (b.usualHdr && b.usualHdr.w) + " px"), m(8, box(b.geigerHdr), "GEIGER " + (b.geigerHdr && b.geigerHdr.w) + " px"),
    m(10, box(b.macroNext), "tape 1: NEXT events"), m(10, box(b.scint), "tape 2: TODAY'S SCINTILLAS"), m(10, box(b.bands, 0), "tapes 3–6: MACRO · ALL · ECON · EARNINGS"),
  ].filter(Boolean) });
  const f = t.frame; const inFrame = (dx, dy, ww, hh) => (f && f.w ? { x: f.x + dx, y: f.y + dy, w: ww, h: hh } : null);
  shots.push({ id: `${w}-meta`, img: img("meta"), w, h: H, title: `${w} wide · META picked, CHART tab`, marks: [
    m(3, box(t.ident, 0), "the company bar, full width, far from the chart"), m(4, box(t.identTk), "META 1"), m(4, box(t.src), "META 2 · station chart · META"),
    m(4, inFrame(10, 3, w === 390 ? 80 : 100, 24), "META 3 · the pane's own ticker box", "placed from the screenshot (inside the chart iframe)"),
    m(4, inFrame(8, 44, w === 390 ? 130 : 175, 32), "META 4 · the pane's price badge", "placed from the screenshot (inside the chart iframe)"), m(4, box(t.selRow, 0), "META 5 · the board row"),
    m(5, box(t.cofrBar, 0), "timeframe row 1 (the Hub's)"), m(5, inFrame(0, 0, f ? f.w : 0, 29), "timeframe row 2 (the pane's own, cut off)", "the pane bar is 28–29 px tall (H2 finding 4)"),
    m(6, box(t.ptabs, 0), "company tabs " + (t.ptab && t.ptab.fs)), m(7, box(t.auto), "AUTO"), m(7, box(t.rot), "10s ▾"),
  ].filter(Boolean) });
}
const n = R(1680), e = n.expanded;
shots.push({ id: "1680-expanded", img: "screens/diag/live-1680-expanded.png", w: 1680, h: 1050, title: "1680 · META picked, EXPAND", marks: [
  m(5, box(e.cofrBar, 0), "timeframe row 1"), m(5, e.frame && { x: e.frame.x, y: e.frame.y, w: e.frame.w, h: 29 }, "timeframe row 2", "inside the chart iframe"),
  m(4, box(e.identTk), "META 1"), m(4, box(e.src), "META 2"), m(6, box(e.ptabs, 0), "company tabs " + (e.ptab && e.ptab.fs) + ", eleven of them"), m(1, box(e.ident, 0), "the bar stays on top even when expanded") ].filter(Boolean) });
const P = "placed from the screenshot";
shots.push({ id: "1680-geiger", img: "screens/diag/live-1680-geiger.png", w: 1680, h: 1050, title: "1680 · the GEIGER tab, expanded", marks: [
  m(14, { x: 280, y: 318, w: 160, h: 100 }, "KEEP: the composite bar", P), m(14, { x: 308, y: 412, w: 96, h: 70 }, "the arc", P),
  m(14, { x: 60, y: 580, w: 580, h: 250 }, "the dotted ladder box", P), m(14, { x: 658, y: 316, w: 470, h: 250 }, "RSI and Williams, mostly empty", P),
  m(14, { x: 658, y: 584, w: 470, h: 60 }, "MACD: unavailable", P), m(14, { x: 1140, y: 584, w: 480, h: 250 }, "volume gauge: awaiting feed", P) ] });
shots.push({ id: "1680-fund", img: "screens/diag/live-1680-fundamentals.png", w: 1680, h: 1050, title: "1680 · FUNDAMENTALS, expanded", marks: [
  m(4, { x: 60, y: 318, w: 48, h: 22 }, "META 3", P), m(4, { x: 72, y: 356, w: 76, h: 32 }, "META 4", P), m(4, { x: 156, y: 354, w: 124, h: 36 }, "META 5 · a ticker box", P),
  m(13, { x: 74, y: 408, w: 248, h: 124 }, "MKT CAP 1.43T here, $1.9T on the board", P), m(13, { x: 84, y: 436, w: 90, h: 34 }, "values 24 px", P), m(13, { x: 84, y: 474, w: 230, h: 30 }, "notes 11 px", P) ] });
const fs = n.fullscreen && n.fullscreen.cells || [];
const cell = (t) => fs.find((c) => c.t === t);
const cu = cell("USUAL DAY"), cg = cell("GEIGER ▼");
shots.push({ id: "1680-fullscreen", img: "screens/diag/live-1680-board-fullscreen.png", w: 1680, h: 1050, title: "1680 · the board in full screen", marks: [
  m(9, cu && { x: cu.x, y: 280, w: cu.w, h: 750 }, "USUAL DAY " + (cu && cu.w) + " px"), m(9, cg && { x: cg.x, y: 280, w: cg.w, h: 750 }, "GEIGER " + (cg && cg.w) + " px"),
  m(9, { x: 1418, y: 312, w: 48, h: 718 }, "the bar itself stays ~45 px", P), m(1, { x: 46, y: 98, w: 1587, h: 28 }, "the company bar shows through behind the full screen", P) ].filter(Boolean) });
const cols = (w) => { const c = R(w).cols && R(w).cols.cells; return c ? c.filter((x) => x.w > 0).map((x) => ({ t: x.t || "·", w: x.w })) : null; };
writeFileSync(HERE + "diag-data.js", "/* written by tools/build-diag-data.mjs from screens/diag/rects-*.json */\nwindow.DIAG = " + JSON.stringify({ shots, cols: { 1440: cols(1440), 390: cols(390), fs1680: fs } }, null, 1) + ";\n");
console.log("shots", shots.length, "marks", shots.reduce((a, s) => a + s.marks.length, 0));

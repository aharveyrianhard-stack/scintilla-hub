/* Scintilla · comps on the live company view (C1, 29 Sep) · the drawing.
   The round-3 row (every mark named, multiples on top, implied prices below, the diamond for today, the arrow to
   the median with the upside), the way-B field, the COMPARE field on one % axis, the numbered ladder, the legend.
   Ported from the approved page (deliverables/20260928/comps-r3-labels/COMPS-R3-LABELS.html) with every class
   prefixed `cl-` so nothing collides inside the Hub. DOM only here; the arithmetic is ladder.mjs / labels-r3.mjs. */

import { rowMarks, rowScale, rowUpside, upsideTo, upsideWords, middleHalfBand, combinedScale, basisLine, stagger } from "../../20260928/comps-r3-labels/labels-r3.mjs";
import { fmt, dateWord } from "../../20260927/comps-r3/r3.mjs";
import { SHORT, MARKS, MARK_WORDS } from "./ladder.mjs";

export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const X = (v) => fmt("x", v), P = (v) => fmt("price", v), MONEY = (v) => fmt("money", v), USD = (v) => fmt("usd2", v);
export const P0 = (v) => v == null || !Number.isFinite(v) ? "—" : "$" + Math.round(v).toLocaleString("en-US");
export const PCT = (v) => v == null ? "—" : (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(Math.abs(v) >= 10 ? 0 : 1) + "%";
const D = (d) => d ? dateWord(d) : "date not on file";
const SVG = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}, text) => { const e = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };
const widthOf = (t, fallback) => { try { const w = t.getComputedTextLength(); if (w > 0) return w; } catch (_) {} return fallback; };
const WAY_B = { lo: "LOW EDGE", mid: "CENTRE", hi: "HIGH EDGE" };

/* ---- the css: greys plus the Hub's two direction colours ------------------------------------------- */
export const CSS = `
.cl{--cl-line:#2a2a2a;--cl-line2:#363636;--cl-line3:#4a4a4a;--cl-ink:#cfcfcf;--cl-ink2:#acacac;--cl-dim:#8c8c8c;--cl-mute:#6c6c6c;--cl-box:#2a2a2e;--cl-boxline:#5a5a60;--cl-band:#34343a;--cl-sunk:#0a0a0a;--cl-panel:#141414;
 --cl-up:var(--bull,#4fae6a);--cl-dn:var(--bear,#d0554a);font-family:var(--mono,ui-monospace,Menlo,monospace);font-size:11.5px;line-height:1.5;color:var(--cl-ink2);letter-spacing:.02em}
.cl *{box-sizing:border-box;min-width:0}
.cl h4{font:600 10.5px/1.4 var(--mono,monospace);letter-spacing:.2em;color:var(--cl-ink);margin:16px 0 6px;text-transform:uppercase}
.cl h4 small{font-weight:400;letter-spacing:.06em;color:var(--cl-dim);text-transform:none;margin-left:8px;font-size:11px}
.cl .cl-panel{border:1px solid var(--cl-line);background:var(--cl-panel)}
.cl .cl-stamp{font-size:11px;color:var(--cl-dim);padding:8px 12px;border-bottom:1px solid var(--cl-line)}
.cl .cl-stamp b{color:var(--cl-ink);font-weight:600}
.cl .cl-words{padding:10px 12px;font-size:11.5px;line-height:1.6}
.cl .cl-words b{color:var(--cl-ink);font-weight:600}
.cl .cl-up{color:var(--cl-up)}.cl .cl-dn{color:var(--cl-dn)}
.cl .cl-colhead,.cl .cl-row{display:grid;grid-template-columns:200px minmax(0,1fr) 230px;gap:0 18px;align-items:center;padding:0 12px}
.cl .cl-colhead{padding-top:8px;padding-bottom:5px;border-bottom:1px solid var(--cl-line)}
.cl .cl-colhead span{font:400 9.5px/1.4 var(--mono,monospace);letter-spacing:.16em;color:var(--cl-mute);text-transform:uppercase}
.cl .cl-colhead span:last-child{text-align:right}
.cl .cl-row{padding-top:12px;padding-bottom:12px;border-bottom:1px solid var(--cl-line)}
.cl .cl-row:last-child{border-bottom:0}
.cl .cl-row .cl-hd .cl-nm{font:600 13px/1.3 var(--mono,monospace);color:var(--cl-ink)}
.cl .cl-row .cl-hd .cl-bs{font:400 11px/1.5 var(--mono,monospace);color:var(--cl-dim);margin-top:2px}
.cl .cl-row .cl-hd .cl-n{font:400 11px/1.5 var(--mono,monospace);color:var(--cl-mute);margin-top:1px}
.cl .cl-row .cl-ch{position:relative}
.cl .cl-row .cl-ch svg{display:block;width:100%;height:auto;overflow:visible}
.cl .cl-ups{display:grid;grid-template-columns:auto 1fr;gap:1px 10px;font-size:11.5px;line-height:1.5;font-variant-numeric:tabular-nums}
.cl .cl-ups span{color:var(--cl-dim)}
.cl .cl-ups b{color:var(--cl-ink);font-weight:400;text-align:right;white-space:nowrap}
.cl .cl-ups b.cl-med{font-weight:600}
.cl .cl-ups .cl-today{grid-column:1/-1;display:grid;grid-template-columns:auto 1fr;gap:10px;border-top:1px solid var(--cl-line2);margin-top:4px;padding-top:4px}
.cl .cl-ups .cl-today b{font-weight:600}
.cl .cl-ups i{font-style:normal;color:var(--cl-mute)}
.cl .cl-ups .cl-no{grid-column:1/-1;color:var(--cl-dim);font-size:11px}
.cl .cl-row.cl-way{background:var(--cl-sunk)}
.cl .cl-row.cl-way .cl-hd .cl-badge{display:inline-block;font:600 9px/1 var(--mono,monospace);letter-spacing:.16em;color:var(--cl-ink);border:1px solid var(--cl-ink2);padding:4px 6px;margin-bottom:6px}
.cl .cl-row.cl-way .cl-hd .cl-rule{font:400 11px/1.45 var(--mono,monospace);color:var(--cl-dim);margin-top:4px}
.cl .cl-legend{display:flex;gap:8px 22px;flex-wrap:wrap;padding:8px 12px 10px;font-size:11px;color:var(--cl-dim);border-top:1px solid var(--cl-line);line-height:1.5}
.cl .cl-legend i{display:inline-block;vertical-align:middle;margin-right:6px}
.cl .cl-legend svg{display:inline-block;vertical-align:middle;margin-right:6px}
.cl .cl-legend .cl-caps{font-size:9px;letter-spacing:.14em;color:var(--cl-dim);margin-right:6px}
.cl .cl-legend b{color:var(--cl-ink);font-weight:600}
.cl .cl-wh{stroke:var(--cl-ink2);stroke-width:2}
.cl .cl-box{fill:var(--cl-box);stroke:var(--cl-boxline);stroke-width:1}
.cl .cl-env{stroke:var(--cl-line3);stroke-width:1;stroke-dasharray:2 3}
.cl .cl-inner{fill:var(--cl-band);stroke:var(--cl-boxline);stroke-width:1}
.cl .cl-medl{stroke:var(--cl-ink);stroke-width:3}
.cl .cl-own-line{stroke-width:1.5;stroke-dasharray:3 3}
.cl .cl-own-dot{stroke-width:1}
.cl .cl-up-stroke{stroke:var(--cl-up)}.cl .cl-dn-stroke{stroke:var(--cl-dn)}
.cl .cl-up-fill{fill:var(--cl-up)}.cl .cl-dn-fill{fill:var(--cl-dn)}
.cl .cl-arrow{stroke-width:1.5;fill:none}
.cl .cl-tie{stroke:var(--cl-line3);stroke-width:1}
.cl .cl-tick{stroke:var(--cl-ink2);stroke-width:1}
.cl .cl-zero{stroke:var(--cl-ink);stroke-width:1;stroke-dasharray:4 3}
.cl .cl-word{font:500 8.5px var(--mono,monospace);fill:var(--cl-dim);letter-spacing:.12em}
.cl .cl-word.cl-own{font-weight:700}
.cl .cl-num{font:400 11.5px var(--mono,monospace);fill:var(--cl-ink2)}
.cl .cl-num.cl-bold{font-weight:700;fill:var(--cl-ink)}
.cl .cl-price{font:400 11.5px var(--mono,monospace);fill:var(--cl-ink2)}
.cl .cl-price.cl-bold{font-weight:700}
.cl .cl-tag{font:400 9px var(--mono,monospace);fill:var(--cl-dim);letter-spacing:.06em}
.cl .cl-uptext{font:600 10.5px var(--mono,monospace);letter-spacing:.04em;paint-order:stroke;stroke:var(--cl-panel);stroke-width:4px;stroke-linejoin:round}
.cl .cl-way .cl-uptext{stroke:var(--cl-sunk)}
.cl .cl-note{padding:8px 12px 10px;font-size:11px;color:var(--cl-dim);border-top:1px solid var(--cl-line)}
.cl .cl-note b{color:var(--cl-ink2);font-weight:400}
/* the ladder */
.cl .cl-ladder{counter-reset:step}
.cl .cl-step{border-top:1px solid var(--cl-line);padding:10px 12px 12px}
.cl .cl-step:first-child{border-top:0}
.cl .cl-step > summary{list-style:none;cursor:pointer;display:flex;gap:10px;align-items:baseline}
.cl .cl-step > summary::-webkit-details-marker{display:none}
.cl .cl-step .cl-stepn{font:700 12px/1 var(--mono,monospace);color:var(--cl-ink);border:1px solid var(--cl-ink2);padding:4px 6px;min-width:26px;text-align:center}
.cl .cl-step .cl-stept{font:600 11.5px/1.4 var(--mono,monospace);color:var(--cl-ink);letter-spacing:.08em;text-transform:uppercase}
.cl .cl-step .cl-stepr{font:400 11px/1.5 var(--mono,monospace);color:var(--cl-dim);margin:4px 0 6px 36px}
.cl .cl-step .cl-body{margin-left:36px}
.cl .cl-step p{margin:5px 0}
.cl table.cl-t{width:100%;border-collapse:collapse;font-size:11px;font-variant-numeric:tabular-nums}
.cl table.cl-t th,.cl table.cl-t td{padding:3px 8px;border-bottom:1px solid var(--cl-line);text-align:right;white-space:nowrap}
.cl table.cl-t th{font:400 9.5px/1.4 var(--mono,monospace);letter-spacing:.14em;color:var(--cl-mute);text-transform:uppercase}
.cl table.cl-t th:first-child,.cl table.cl-t td:first-child{text-align:left}
.cl table.cl-t td{color:var(--cl-ink2)}.cl table.cl-t td.cl-k{color:var(--cl-ink)}
.cl table.cl-t td.cl-blank{color:var(--cl-mute);font-style:italic}
.cl .cl-tw{overflow-x:auto;-webkit-overflow-scrolling:touch;position:relative}
.cl .cl-twwrap{position:relative}
.cl .cl-twwrap::after{content:"";position:absolute;top:0;right:0;bottom:0;width:26px;background:linear-gradient(90deg,transparent,var(--cl-panel));pointer-events:none}
.cl .cl-twhint{font-size:10.5px;color:var(--cl-mute);letter-spacing:.1em;text-align:right;padding:2px 0 0}
.cl .cl-sentence{font:600 12.5px/1.6 var(--mono,monospace);color:var(--cl-ink);border-left:3px solid var(--cl-ink2);padding:6px 10px;margin:6px 0}
.cl .cl-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.cl .cl-chip{display:inline-block;font:400 11px/1 var(--mono,monospace);color:var(--cl-ink2);border:1px solid var(--cl-line2);padding:4px 7px;border-radius:2px}
.cl .cl-chip.cl-x{color:var(--cl-mute);text-decoration:line-through}
.cl .cl-chip.cl-me{color:var(--cl-ink);border-color:var(--cl-ink2);font-weight:600}
/* compare */
.cl .cl-cmpbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 12px;border-bottom:1px solid var(--cl-line);font-size:11px;color:var(--cl-dim)}
.cl .cl-cmpbar input{font:400 12px/1 var(--mono,monospace);background:var(--cl-sunk);color:var(--cl-ink);border:1px solid var(--cl-line2);padding:6px 8px;min-width:170px;letter-spacing:.08em;text-transform:uppercase}
.cl .cl-cmpbar button,.cl .cl-btn{-webkit-appearance:none;appearance:none;cursor:pointer;font:600 10.5px/1 var(--mono,monospace);letter-spacing:.14em;padding:7px 10px;background:var(--cl-sunk);color:var(--cl-dim);border:1px solid var(--cl-line2);border-radius:2px;text-transform:uppercase}
.cl .cl-cmpbar button:hover,.cl .cl-btn:hover{color:var(--cl-ink);border-color:var(--cl-ink2)}
.cl .cl-cmpbar button[aria-pressed="true"]{color:var(--cl-ink);border-color:var(--cl-ink2)}
.cl .cl-cmprow{display:grid;grid-template-columns:150px minmax(0,1fr);gap:0 14px;align-items:center;padding:10px 12px;border-bottom:1px solid var(--cl-line)}
.cl .cl-cmprow .cl-nm{font:600 13px/1.3 var(--mono,monospace);color:var(--cl-ink)}
.cl .cl-cmprow .cl-bs{font:400 10.5px/1.45 var(--mono,monospace);color:var(--cl-dim)}
.cl .cl-cmprow svg{display:block;width:100%;height:auto;overflow:visible}
.cl .cl-cmpgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:0}
.cl .cl-cmpgrid > div{padding:8px 12px 10px;border-right:1px solid var(--cl-line)}
.cl .cl-cmpgrid > div:last-child{border-right:0}
.cl .cl-cmpgrid .cl-nm{font:600 13px/1.3 var(--mono,monospace);color:var(--cl-ink)}
.cl .cl-cmpgrid dl{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin:6px 0;font-size:11px;font-variant-numeric:tabular-nums}
.cl .cl-cmpgrid dt{color:var(--cl-dim)}.cl .cl-cmpgrid dd{margin:0;color:var(--cl-ink);text-align:right;overflow-wrap:anywhere}
.cl .cl-grid{display:grid;grid-template-columns:1fr;gap:0 18px}
.cl .cl-grid.cl-wide{grid-template-columns:minmax(0,1.15fr) minmax(0,1fr)}
.cl .cl-err{border:1px solid var(--cl-line3);padding:10px 12px;color:var(--cl-ink);font-size:11.5px}
.cl .cl-loading{padding:16px 12px;color:var(--cl-dim);letter-spacing:.2em}
/* the pane's width decides the layout, not the window's: on the Hub the ESTIMATES pane is a ~450px column even on a
   1680 screen. live.mjs sets cl-narrow under 1000px and cl-phone under 600px of the box's own width. */
.cl.cl-narrow .cl-colhead{display:none}
.cl.cl-narrow .cl-row{grid-template-columns:1fr;gap:8px 0}
.cl.cl-narrow .cl-ups{grid-template-columns:auto 1fr auto 1fr;gap:2px 8px}
.cl.cl-narrow .cl-ups .cl-today{grid-column:1/-1}
.cl.cl-narrow .cl-cmprow{grid-template-columns:1fr;gap:6px 0}
.cl.cl-phone .cl-ups{grid-template-columns:auto 1fr}
.cl.cl-phone .cl-step .cl-body,.cl.cl-phone .cl-step .cl-stepr{margin-left:0}
.cl.cl-phone .cl-cmpgrid > div{border-right:0;border-top:1px solid var(--cl-line)}
.cl.cl-phone .cl-cmpgrid{grid-template-columns:1fr}
.cl .cl-step p{overflow-wrap:anywhere}
.cl .cl-words,.cl .cl-note,.cl .cl-sentence,.cl .cl-stamp{overflow-wrap:anywhere}`;

/* ---- one valuation row --------------------------------------------------------------------------- */
export function rowNode(row, T, { big = false } = {}) {
  const div = document.createElement("div");
  div.className = "cl-row" + (big ? " cl-big" : "");
  const U = rowUpside(row);
  const cell = (u, word, med) => { const w = upsideWords(u, P); return w ? `<span>to the ${word}</span><b class="${med ? "cl-med " : ""}${w.up ? "cl-up" : "cl-dn"}">${esc(w.pct)} <i>·</i> ${esc(w.dollars)}</b>` : `<span>to the ${word}</span><b>—</b>`; };
  const ups = row.ok
    ? `${cell(U.q1, "25th")}${cell(U.median, "median", true)}${cell(U.q3, "75th")}<div class="cl-today"><span>${esc(T)} today</span><b>${esc(P(row.own.price))} <i>·</i> ${esc(X(row.own.multiple))}</b></div>`
    : `<div class="cl-no">${esc(row.reason || "this row cannot be priced")}</div>`;
  div.innerHTML = `
    <div class="cl-hd"><div class="cl-nm">${esc(row.label)}</div><div class="cl-bs">${esc(basisLine(row, MONEY, USD))}</div><div class="cl-n">${row.n} peer${row.n === 1 ? "" : "s"} carry it${(row.nm || []).length ? " · " + row.nm.length + " set aside" : ""}${(row.missing || []).length ? " · " + row.missing.length + " blank" : ""}</div></div>
    <div class="cl-ch"><svg></svg></div>
    <div class="cl-ups">${ups}</div>`;
  const svg = div.querySelector("svg");
  if (row.ok && row.band && row.band.n) {
    const draw = () => drawRow(svg, row, T, { big, width: div.querySelector(".cl-ch").clientWidth || 600 });
    new ResizeObserver(draw).observe(div.querySelector(".cl-ch"));
    requestAnimationFrame(draw);
  } else svg.setAttribute("height", 4);
  return div;
}

function drawRow(svg, row, T, { big, width }) {
  const W = Math.max(200, Math.floor(width)), k = big ? 1.18 : 1;
  const wordH = 10 * k, numH = 13 * k, boxH = 22 * k, capH = 12 * k, arrowH = 30 * k, priceH = 16 * k;
  const marks = rowMarks(row, T);
  const s = rowScale(row, { width: W, pad: 12 });
  const x = (m) => Math.round(s.x(m) * 10) / 10;
  const b = row.band, own = marks.find((m) => m.own);
  const med = b.median, up = own ? own.multiple <= med : true, dir = up ? "up" : "dn";
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const tops = marks.map((m) => {
    const g = el("g");
    const w = el("text", { class: "cl-word" + (m.own ? " cl-own" : ""), y: 0 }, m.word);
    const n = el("text", { class: "cl-num" + (m.own ? " cl-bold" : ""), y: 0 }, X(m.multiple));
    if (m.own) { w.setAttribute("fill", `var(--cl-${dir})`); n.setAttribute("fill", `var(--cl-${dir})`); }
    g.appendChild(w); g.appendChild(n); svg.appendChild(g);
    return { m, g, w, n, width: Math.max(widthOf(w, m.word.length * 6.4 * k), widthOf(n, X(m.multiple).length * 7.1 * k)) };
  });
  const bots = marks.map((m) => {
    const t = el("text", { class: "cl-price" + (m.own ? " cl-bold" : ""), y: 0 }, m.price != null ? P0(m.price) : "—");
    if (m.own) t.setAttribute("fill", `var(--cl-${dir})`);
    svg.appendChild(t);
    return { m, t, width: widthOf(t, 7 * 7.1 * k) };
  });
  const topRes = stagger(tops.map((t) => ({ id: t.m.id, x: x(t.m.multiple), w: t.width, anchor: t.m.anchor })), { width: W, gap: 10 });
  const botRes = stagger(bots.map((t) => ({ id: t.m.id, x: x(t.m.multiple), w: t.width, anchor: t.m.anchor })), { width: W, gap: 10 });
  const topTiers = Math.max(...topRes.map((r) => r.tier)) + 1, botTiers = Math.max(...botRes.map((r) => r.tier)) + 1;
  const tierH = wordH + numH + 4;
  const yTop0 = 2 + (topTiers - 1) * tierH, lineTop = yTop0 + wordH + numH + 6;
  const mid = lineTop + 4 + boxH / 2, boxTop = mid - boxH / 2, boxBot = mid + boxH / 2;
  const yArrow = boxBot + 12 * k, yArrowText = yArrow + 13 * k;
  const yBot0 = boxBot + arrowH + 8 + priceH;
  const H = yBot0 + (botTiers - 1) * (priceH + 2) + 6;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H);
  svg.appendChild(el("line", { class: "cl-wh", x1: x(b.min), x2: x(b.max), y1: mid, y2: mid }));
  svg.appendChild(el("line", { class: "cl-wh", x1: x(b.min), x2: x(b.min), y1: mid - capH / 2, y2: mid + capH / 2 }));
  svg.appendChild(el("line", { class: "cl-wh", x1: x(b.max), x2: x(b.max), y1: mid - capH / 2, y2: mid + capH / 2 }));
  svg.appendChild(el("rect", { class: "cl-box", x: x(b.q1), y: boxTop, width: Math.max(1, x(b.q3) - x(b.q1)), height: boxH }));
  svg.appendChild(el("line", { class: "cl-medl", x1: x(med), x2: x(med), y1: boxTop, y2: boxBot }));
  topRes.forEach((r, i) => {
    const t = tops[i], m = t.m, cx = m.anchor === "start" ? r.left : m.anchor === "end" ? r.right : (r.left + r.right) / 2;
    const yWord = yTop0 - r.tier * tierH + wordH - 2, yNum = yWord + numH;
    t.w.setAttribute("y", yWord); t.n.setAttribute("y", yNum);
    const anchor = m.anchor === "start" ? "start" : m.anchor === "end" ? "end" : "middle";
    const ax = anchor === "start" ? r.left : anchor === "end" ? r.right : cx;
    t.w.setAttribute("text-anchor", anchor); t.n.setAttribute("text-anchor", anchor); t.w.setAttribute("x", ax); t.n.setAttribute("x", ax);
    const px = x(m.multiple);
    if (m.own) return;
    if (Math.abs(cx - px) > 4 || r.tier > 0) {
      const y1 = yNum + 3, y2 = (m.id === "q1" || m.id === "q3" || m.id === "median") ? boxTop - 1 : mid - capH / 2 - 1;
      svg.appendChild(el("polyline", { class: "cl-tie", fill: "none", points: `${cx},${y1} ${cx},${(y1 + y2) / 2} ${px},${(y1 + y2) / 2} ${px},${y2}` }));
    } else svg.appendChild(el("line", { class: "cl-tick", x1: px, x2: px, y1: yNum + 3, y2: lineTop }));
  });
  botRes.forEach((r, i) => {
    const t = bots[i], m = t.m, cx = m.anchor === "start" ? r.left : m.anchor === "end" ? r.right : (r.left + r.right) / 2;
    const y = yBot0 + r.tier * (priceH + 2);
    const anchor = m.anchor === "start" ? "start" : m.anchor === "end" ? "end" : "middle";
    t.t.setAttribute("text-anchor", anchor); t.t.setAttribute("x", anchor === "start" ? r.left : anchor === "end" ? r.right : cx); t.t.setAttribute("y", y);
    const px = x(m.multiple);
    if (m.own) return;
    const yTopOfText = y - priceH + 3, yFrom = m.id === "min" || m.id === "max" ? mid + capH / 2 + 1 : boxBot + 1;
    if (Math.abs(cx - px) > 4 || r.tier > 0) svg.appendChild(el("polyline", { class: "cl-tie", fill: "none", points: `${px},${yFrom} ${px},${yArrowText + 6} ${cx},${yArrowText + 6} ${cx},${yTopOfText}` }));
    else svg.appendChild(el("line", { class: "cl-tick", x1: px, x2: px, y1: yFrom, y2: yTopOfText, "stroke-dasharray": "1 3" }));
  });
  if (own) {
    const px = x(own.multiple), rTop = topRes[tops.findIndex((t) => t.m.own)], rBot = botRes[bots.findIndex((t) => t.m.own)];
    const yTopLabel = yTop0 - rTop.tier * tierH + wordH + numH + 2, yBotLabel = yBot0 + rBot.tier * (priceH + 2) - priceH + 3;
    svg.appendChild(el("line", { class: `cl-own-line cl-${dir}-stroke`, x1: px, x2: px, y1: yTopLabel, y2: yBotLabel }));
    const d = 5 * k;
    svg.appendChild(el("polygon", { class: `cl-own-dot cl-${dir}-fill cl-${dir}-stroke`, points: `${px},${mid - d} ${px + d},${mid} ${px},${mid + d} ${px - d},${mid}` }));
    const u = upsideTo(row.own.price, row.ends.median.price), words = upsideWords(u, P);
    const xm = x(med);
    if (words && Math.abs(xm - px) > 1) {
      const dirX = xm > px ? 1 : -1, ah = 4 * k;
      svg.appendChild(el("line", { class: `cl-arrow cl-${dir}-stroke`, x1: px, x2: xm - dirX * ah, y1: yArrow, y2: yArrow }));
      svg.appendChild(el("polygon", { class: `cl-${dir}-fill`, points: `${xm},${yArrow} ${xm - dirX * ah * 1.8},${yArrow - ah} ${xm - dirX * ah * 1.8},${yArrow + ah}` }));
      const t = el("text", { class: "cl-uptext", fill: `var(--cl-${dir})`, y: yArrowText }, words.line);
      svg.appendChild(t);
      const tw = widthOf(t, words.line.length * 6.6 * k), c = (px + xm) / 2;
      t.setAttribute("x", Math.max(2, Math.min(W - tw - 2, c - tw / 2)));
    } else if (words) {
      const t = el("text", { class: "cl-uptext", fill: `var(--cl-${dir})`, y: yArrowText }, "at the median today");
      svg.appendChild(t); const tw = widthOf(t, 20 * 6.6); t.setAttribute("x", Math.max(2, Math.min(W - tw - 2, px - tw / 2)));
    }
  }
}

/* ---- way B, on the $ axis ------------------------------------------------------------------------- */
export function wayNode(rows, T, price, { label = "WAY B · THE TRANCHE BAND", sub = null } = {}) {
  const B = middleHalfBand(rows);
  if (B.ok) B.upside = { lo: upsideTo(price, B.lo), mid: upsideTo(price, B.mid), hi: upsideTo(price, B.hi) };
  const div = document.createElement("div");
  div.className = "cl-row cl-way";
  const cell = (u, word, med) => { const w = upsideWords(u, P); return w ? `<span>to the ${word}</span><b class="${med ? "cl-med " : ""}${w.up ? "cl-up" : "cl-dn"}">${esc(w.pct)} <i>·</i> ${esc(w.dollars)}</b>` : `<span>to the ${word}</span><b>—</b>`; };
  div.innerHTML = `
    <div class="cl-hd"><div class="cl-badge">${esc(label)}</div><div class="cl-nm">${esc(sub || "Middle-half band across the six metrics")}</div><div class="cl-rule">${esc(B.rule || "")}</div></div>
    <div class="cl-ch"><svg></svg></div>
    <div class="cl-ups">${B.ok ? `${cell(B.upside.lo, "low edge")}${cell(B.upside.mid, "centre", true)}${cell(B.upside.hi, "high edge")}<div class="cl-today"><span>${esc(T)} today</span><b>${esc(P(price))}</b></div>` : `<div class="cl-no">${esc(B.reason)}</div>`}</div>`;
  const svg = div.querySelector("svg");
  if (B.ok) {
    const draw = () => drawWay(svg, B, T, price, { width: div.querySelector(".cl-ch").clientWidth || 600 });
    new ResizeObserver(draw).observe(div.querySelector(".cl-ch"));
    requestAnimationFrame(draw);
  } else svg.setAttribute("height", 4);
  div._band = B;
  return div;
}

function drawWay(svg, way, T, price, { width }) {
  const W = Math.max(200, Math.floor(width));
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const wordH = 10, numH = 13, boxH = 22, capH = 12, priceH = 14;
  const s = combinedScale([way], price, { width: W, pad: 12 });
  const x = (p) => Math.round(s.x(p) * 10) / 10;
  const up = price <= way.mid, dir = up ? "up" : "dn";
  const marks = [
    { id: "lo", word: WAY_B.lo, price: way.lo, anchor: "start" }, { id: "mid", word: WAY_B.mid, price: way.mid, anchor: "middle" },
    { id: "hi", word: WAY_B.hi, price: way.hi, anchor: "end" }, { id: "own", word: `${T} TODAY`, price, anchor: "middle", own: true },
  ].sort((a, b) => a.price - b.price);
  const tops = marks.map((m) => {
    const g = el("g"); const w = el("text", { class: "cl-word" + (m.own ? " cl-own" : ""), y: 0 }, m.word); const n = el("text", { class: "cl-num" + (m.own ? " cl-bold" : ""), y: 0 }, P0(m.price));
    if (m.own) { w.setAttribute("fill", `var(--cl-${dir})`); n.setAttribute("fill", `var(--cl-${dir})`); }
    g.appendChild(w); g.appendChild(n); svg.appendChild(g);
    return { m, w, n, width: Math.max(widthOf(w, m.word.length * 6.4), widthOf(n, 7 * 7.1)) };
  });
  const pts = (way.points || []).map((p) => ({ id: p.key, tag: SHORT[p.key] || p.key, price: p.mid, lo: p.lo, hi: p.hi }));
  const bots = pts.map((p) => { const t = el("text", { class: "cl-tag", y: 0 }, p.tag); svg.appendChild(t); return { p, t, width: widthOf(t, p.tag.length * 5.6) }; });
  const topRes = stagger(tops.map((t) => ({ id: t.m.id, x: x(t.m.price), w: t.width, anchor: t.m.anchor })), { width: W, gap: 10 });
  const botRes = stagger(bots.map((t) => ({ id: t.p.id, x: x(t.p.price), w: t.width, anchor: "middle" })), { width: W, gap: 8 });
  const topTiers = Math.max(...topRes.map((r) => r.tier)) + 1, botTiers = bots.length ? Math.max(...botRes.map((r) => r.tier)) + 1 : 0;
  const tierH = wordH + numH + 4;
  const yTop0 = 2 + (topTiers - 1) * tierH, lineTop = yTop0 + wordH + numH + 6;
  const mid = lineTop + 4 + boxH / 2, boxTop = mid - boxH / 2, boxBot = mid + boxH / 2;
  const yArrow = boxBot + 12, yArrowText = yArrow + 13;
  const yTicks = yArrowText + 8, yBot0 = yTicks + 8 + priceH;
  const H = yBot0 + Math.max(0, botTiers - 1) * (priceH + 2) + 6;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H);
  if (way.envelope) svg.appendChild(el("line", { class: "cl-env", x1: x(way.envelope.lo), x2: x(way.envelope.hi), y1: mid, y2: mid }));
  svg.appendChild(el("rect", { class: "cl-box", x: x(way.lo), y: boxTop, width: Math.max(1, x(way.hi) - x(way.lo)), height: boxH }));
  if (way.overlap) svg.appendChild(el("rect", { class: "cl-inner", x: x(way.overlap.lo), y: boxTop + 5, width: Math.max(1, x(way.overlap.hi) - x(way.overlap.lo)), height: boxH - 10 }));
  svg.appendChild(el("line", { class: "cl-medl", x1: x(way.mid), x2: x(way.mid), y1: boxTop, y2: boxBot }));
  for (const p of pts) {
    if (p.lo != null && p.hi != null) svg.appendChild(el("line", { class: "cl-env", x1: x(p.lo), x2: x(p.hi), y1: yTicks, y2: yTicks }));
    svg.appendChild(el("line", { class: "cl-tick", x1: x(p.price), x2: x(p.price), y1: yTicks - 4, y2: yTicks + 4 }));
  }
  topRes.forEach((r, i) => {
    const t = tops[i], m = t.m, cx = m.anchor === "start" ? r.left : m.anchor === "end" ? r.right : (r.left + r.right) / 2;
    const yWord = yTop0 - r.tier * tierH + wordH - 2, yNum = yWord + numH;
    const anchor = m.anchor === "start" ? "start" : m.anchor === "end" ? "end" : "middle", ax = anchor === "start" ? r.left : anchor === "end" ? r.right : cx;
    for (const e of [t.w, t.n]) { e.setAttribute("text-anchor", anchor); e.setAttribute("x", ax); }
    t.w.setAttribute("y", yWord); t.n.setAttribute("y", yNum);
    const px = x(m.price);
    if (m.own) return;
    if (Math.abs(cx - px) > 4 || r.tier > 0) svg.appendChild(el("polyline", { class: "cl-tie", fill: "none", points: `${cx},${yNum + 3} ${cx},${(yNum + 3 + boxTop) / 2} ${px},${(yNum + 3 + boxTop) / 2} ${px},${boxTop - 1}` }));
    else svg.appendChild(el("line", { class: "cl-tick", x1: px, x2: px, y1: yNum + 3, y2: lineTop }));
  });
  botRes.forEach((r, i) => {
    const t = bots[i], cx = (r.left + r.right) / 2, y = yBot0 + r.tier * (priceH + 2);
    t.t.setAttribute("text-anchor", "middle"); t.t.setAttribute("x", cx); t.t.setAttribute("y", y);
    const px = x(t.p.price);
    if (Math.abs(cx - px) > 3 || r.tier > 0) svg.appendChild(el("polyline", { class: "cl-tie", fill: "none", points: `${px},${yTicks + 4} ${px},${yTicks + 7} ${cx},${yTicks + 7} ${cx},${y - priceH + 4}` }));
    else svg.appendChild(el("line", { class: "cl-tick", x1: px, x2: px, y1: yTicks + 4, y2: y - priceH + 4, "stroke-dasharray": "1 3" }));
  });
  const own = marks.find((m) => m.own), rTop = topRes[marks.indexOf(own)], px = x(price);
  svg.appendChild(el("line", { class: `cl-own-line cl-${dir}-stroke`, x1: px, x2: px, y1: yTop0 - rTop.tier * tierH + wordH + numH + 2, y2: yTicks - 6 }));
  svg.appendChild(el("polygon", { class: `cl-own-dot cl-${dir}-fill cl-${dir}-stroke`, points: `${px},${mid - 5} ${px + 5},${mid} ${px},${mid + 5} ${px - 5},${mid}` }));
  const words = upsideWords(way.upside.mid, P, "centre"), xm = x(way.mid);
  if (words && Math.abs(xm - px) > 1) {
    const dirX = xm > px ? 1 : -1, ah = 4;
    svg.appendChild(el("line", { class: `cl-arrow cl-${dir}-stroke`, x1: px, x2: xm - dirX * ah, y1: yArrow, y2: yArrow }));
    svg.appendChild(el("polygon", { class: `cl-${dir}-fill`, points: `${xm},${yArrow} ${xm - dirX * ah * 1.8},${yArrow - ah} ${xm - dirX * ah * 1.8},${yArrow + ah}` }));
    const t = el("text", { class: "cl-uptext", fill: `var(--cl-${dir})`, y: yArrowText }, words.line); svg.appendChild(t);
    const tw = widthOf(t, words.line.length * 6.6); t.setAttribute("x", Math.max(2, Math.min(W - tw - 2, (px + xm) / 2 - tw / 2)));
  }
}

/* ---- compare: every company's band on ONE % axis (today = 0%) ------------------------------------ */
export function compareFieldNode(cmp) {
  const wrap = document.createElement("div");
  const rows = cmp.companies;
  for (const c of rows) {
    const div = document.createElement("div"); div.className = "cl-cmprow";
    div.innerHTML = `<div><div class="cl-nm">${esc(c.ticker)}</div><div class="cl-bs">${esc(c.name)} · ${esc(c.cohort || "?")} · ${c.peers} peers · today ${esc(P(c.price))}</div>${c.upside ? `<div class="cl-bs"><b class="${c.upside.mid.pct >= 0 ? "cl-up" : "cl-dn"}">${esc(PCT(c.upside.mid.pct))}</b> to the centre</div>` : `<div class="cl-bs">no band: no row can be priced</div>`}</div><div><svg></svg></div>`;
    const svg = div.querySelector("svg");
    if (c.upside) { const draw = () => drawCompareRow(svg, c, cmp.axis, { width: div.querySelector("div:last-child").clientWidth || 600 }); new ResizeObserver(draw).observe(div.querySelector("div:last-child")); requestAnimationFrame(draw); }
    else svg.setAttribute("height", 4);
    wrap.appendChild(div);
  }
  return wrap;
}
function drawCompareRow(svg, c, axis, { width }) {
  const W = Math.max(200, Math.floor(width)), pad = 12, inner = W - 2 * pad;
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const lo = Math.min(axis.lo, 0) - 2, hi = Math.max(axis.hi, 0) + 2;
  const x = (pct) => Math.round((pad + ((pct - lo) / (hi - lo)) * inner) * 10) / 10;
  const wordH = 10, numH = 13, boxH = 20, priceH = 14;
  const up = c.upside.mid.pct >= 0, dir = up ? "up" : "dn";
  const marks = [
    { id: "lo", word: WAY_B.lo, pct: c.upside.lo.pct, usd: c.band.lo, anchor: "start" }, { id: "mid", word: WAY_B.mid, pct: c.upside.mid.pct, usd: c.band.mid, anchor: "middle" },
    { id: "hi", word: WAY_B.hi, pct: c.upside.hi.pct, usd: c.band.hi, anchor: "end" }, { id: "own", word: `${c.ticker} TODAY`, pct: 0, usd: c.price, anchor: "middle", own: true },
  ].sort((a, b) => a.pct - b.pct);
  const tops = marks.map((m) => { const g = el("g"); const w = el("text", { class: "cl-word" + (m.own ? " cl-own" : ""), y: 0 }, m.word); const n = el("text", { class: "cl-num" + (m.own ? " cl-bold" : ""), y: 0 }, m.own ? "0%" : PCT(m.pct));
    if (m.own) { w.setAttribute("fill", `var(--cl-${dir})`); n.setAttribute("fill", `var(--cl-${dir})`); } g.appendChild(w); g.appendChild(n); svg.appendChild(g); return { m, w, n, width: Math.max(widthOf(w, m.word.length * 6.4), widthOf(n, 6 * 7.1)) }; });
  const bots = marks.map((m) => { const t = el("text", { class: "cl-price" + (m.own ? " cl-bold" : ""), y: 0 }, P0(m.usd)); if (m.own) t.setAttribute("fill", `var(--cl-${dir})`); svg.appendChild(t); return { m, t, width: widthOf(t, 7 * 7.1) }; });
  const topRes = stagger(tops.map((t) => ({ id: t.m.id, x: x(t.m.pct), w: t.width, anchor: t.m.anchor })), { width: W, gap: 10 });
  const botRes = stagger(bots.map((t) => ({ id: t.m.id, x: x(t.m.pct), w: t.width, anchor: t.m.anchor })), { width: W, gap: 10 });
  const topTiers = Math.max(...topRes.map((r) => r.tier)) + 1, botTiers = Math.max(...botRes.map((r) => r.tier)) + 1, tierH = wordH + numH + 4;
  const yTop0 = 2 + (topTiers - 1) * tierH, lineTop = yTop0 + wordH + numH + 6, mid = lineTop + 4 + boxH / 2, boxTop = mid - boxH / 2, boxBot = mid + boxH / 2;
  const yBot0 = boxBot + 10 + priceH, H = yBot0 + (botTiers - 1) * (priceH + 2) + 6;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H);
  svg.appendChild(el("line", { class: "cl-zero", x1: x(0), x2: x(0), y1: lineTop - 2, y2: boxBot + 4 }));
  svg.appendChild(el("rect", { class: "cl-box", x: x(c.upside.lo.pct), y: boxTop, width: Math.max(1, x(c.upside.hi.pct) - x(c.upside.lo.pct)), height: boxH }));
  svg.appendChild(el("line", { class: "cl-medl", x1: x(c.upside.mid.pct), x2: x(c.upside.mid.pct), y1: boxTop, y2: boxBot }));
  const px = x(0);
  svg.appendChild(el("polygon", { class: `cl-own-dot cl-${dir}-fill cl-${dir}-stroke`, points: `${px},${mid - 5} ${px + 5},${mid} ${px},${mid + 5} ${px - 5},${mid}` }));
  topRes.forEach((r, i) => { const t = tops[i], m = t.m, cx = m.anchor === "start" ? r.left : m.anchor === "end" ? r.right : (r.left + r.right) / 2;
    const yWord = yTop0 - r.tier * tierH + wordH - 2, yNum = yWord + numH, anchor = m.anchor === "start" ? "start" : m.anchor === "end" ? "end" : "middle", ax = anchor === "start" ? r.left : anchor === "end" ? r.right : cx;
    for (const e of [t.w, t.n]) { e.setAttribute("text-anchor", anchor); e.setAttribute("x", ax); } t.w.setAttribute("y", yWord); t.n.setAttribute("y", yNum);
    const mx = x(m.pct); if (m.own) return;
    if (Math.abs(cx - mx) > 4 || r.tier > 0) svg.appendChild(el("polyline", { class: "cl-tie", fill: "none", points: `${cx},${yNum + 3} ${cx},${(yNum + 3 + boxTop) / 2} ${mx},${(yNum + 3 + boxTop) / 2} ${mx},${boxTop - 1}` }));
    else svg.appendChild(el("line", { class: "cl-tick", x1: mx, x2: mx, y1: yNum + 3, y2: lineTop })); });
  botRes.forEach((r, i) => { const t = bots[i], m = t.m, cx = m.anchor === "start" ? r.left : m.anchor === "end" ? r.right : (r.left + r.right) / 2, y = yBot0 + r.tier * (priceH + 2);
    const anchor = m.anchor === "start" ? "start" : m.anchor === "end" ? "end" : "middle"; t.t.setAttribute("text-anchor", anchor); t.t.setAttribute("x", anchor === "start" ? r.left : anchor === "end" ? r.right : cx); t.t.setAttribute("y", y);
    const mx = x(m.pct); if (m.own) return; const yTopOfText = y - priceH + 3;
    if (Math.abs(cx - mx) > 4 || r.tier > 0) svg.appendChild(el("polyline", { class: "cl-tie", fill: "none", points: `${mx},${boxBot + 1} ${mx},${boxBot + 5} ${cx},${boxBot + 5} ${cx},${yTopOfText}` }));
    else svg.appendChild(el("line", { class: "cl-tick", x1: mx, x2: mx, y1: boxBot + 1, y2: yTopOfText, "stroke-dasharray": "1 3" })); });
}

/* ---- the legend ----------------------------------------------------------------------------------- */
export function legend(kind, T) {
  const own = `<svg width="26" height="18" viewBox="0 0 26 18"><line x1="13" x2="13" y1="1" y2="17" stroke="var(--cl-up)" stroke-width="1.5" stroke-dasharray="3 3"/><polygon points="13,4 18,9 13,14 8,9" fill="var(--cl-up)"/></svg>`;
  const arrow = `<svg width="30" height="10" viewBox="0 0 30 10"><line x1="1" x2="24" y1="5" y2="5" stroke="var(--cl-up)" stroke-width="1.5"/><polygon points="29,5 22,1 22,9" fill="var(--cl-up)"/></svg>`;
  const tie = `<svg width="22" height="14" viewBox="0 0 22 14"><polyline points="2,1 2,7 20,7 20,13" fill="none" stroke="var(--cl-line3)" stroke-width="1"/></svg>`;
  const items = kind === "row" ? [
    `<i style="width:22px;border-top:2px solid var(--cl-ink2)"></i>the peers, from the lowest to the highest`,
    `<i style="width:18px;height:11px;background:var(--cl-box);border:1px solid var(--cl-boxline)"></i>the middle half of the peers (25th to 75th percentile)`,
    `<i style="width:3px;height:12px;background:var(--cl-ink)"></i>the peer median`,
    `${own}<b style="color:var(--cl-up)">${esc(T)} today</b>&nbsp;— the diamond on the dashed line; green when ${esc(T)} sits below the median (room up), <span class="cl-dn">red</span> when above`,
    `${arrow}the arrow runs from ${esc(T)} today to the peer median; its words are the upside, in percent and dollars`,
    `<span class="cl-caps">SMALL CAPS</span>the name of each mark (LOWEST PEER · 25TH · MEDIAN · 75TH · HIGHEST PEER · ${esc(T)} TODAY)`,
    `<b>top row</b>&nbsp;the multiples&nbsp;·&nbsp;<b>bottom row</b>&nbsp;the price each multiple implies for ${esc(T)}`,
    `${tie}a label moved aside so it stays readable, tied to its mark by a thin line`,
  ] : kind === "way" ? [
    `<i style="width:18px;height:11px;background:var(--cl-box);border:1px solid var(--cl-boxline)"></i>the band, low edge to high edge, in dollars per ${esc(T)} share`,
    `<i style="width:22px;border-top:1px dashed var(--cl-line3)"></i>the envelope: the lowest 25th-percentile price to the highest 75th, across the metrics`,
    `<i style="width:18px;height:7px;background:var(--cl-band);border:1px solid var(--cl-boxline)"></i>where every metric's middle half agrees (absent when they do not)`,
    `<i style="width:3px;height:12px;background:var(--cl-ink)"></i>the centre`,
    `${own}<b style="color:var(--cl-up)">${esc(T)} today</b>&nbsp;— green below the centre (room up), <span class="cl-dn">red</span> above`,
    `${arrow}the arrow from ${esc(T)} today to the centre, with the upside in percent and dollars`,
    `<i style="width:1px;height:10px;background:var(--cl-ink2)"></i>one small tick per metric: the price its peer median implies (tagged below); the faint span under it is that metric's middle half`,
  ] : [
    `<i style="width:18px;height:11px;background:var(--cl-box);border:1px solid var(--cl-boxline)"></i>each company's band, drawn as upside from its own price today`,
    `<i style="width:22px;border-top:1px dashed var(--cl-ink)"></i>today, 0% — the same line for every company`,
    `<i style="width:3px;height:12px;background:var(--cl-ink)"></i>the centre`,
    `<b>top row</b>&nbsp;the upside in percent&nbsp;·&nbsp;<b>bottom row</b>&nbsp;the dollars behind it`,
  ];
  return `<div class="cl-legend">${items.map((i) => `<span>${i}</span>`).join("")}</div>`;
}

/* ---- the ladder, in words and tables ---------------------------------------------------------------- */
const who = (a) => a && a.length ? " (" + a.join(" & ") + ")" : "";
const fmtBy = (kind, v) => kind === "money" ? MONEY(v) : USD(v);
const step = (s, body, { open = true, rule = null } = {}) => `<details class="cl-step"${open ? " open" : ""}><summary><span class="cl-stepn">${s.n}</span><span class="cl-stept">${esc(s.title)}</span></summary>${rule ? `<div class="cl-stepr">${esc(rule)}</div>` : ""}<div class="cl-body">${body}</div></details>`;

export function ladderHTML(L, { compact = false } = {}) {
  const [s1, s2, s3, s4, s5, s6, s7] = L.steps, T = L.ticker, O = L.outliers;
  const out = [];
  // 1
  out.push(step(s1, `<p><b>${esc(T)}</b> ${esc(s1.subject.name)} · cohort <b>${esc(s1.cohort || "?")}</b>${s1.cohort_options.length > 1 ? ` (it is also tagged ${esc(s1.cohort_options.filter((c) => c !== s1.cohort).join(", "))}; the comps run on the first)` : ""} · <b>${s1.peers.length} peers</b></p>
    <div class="cl-chips"><span class="cl-chip cl-me">${esc(T)}</span>${s1.peers.map((p) => `<span class="cl-chip" title="${esc(p.name)}">${esc(p.ticker)}</span>`).join("")}${s1.excluded.map((e) => `<span class="cl-chip cl-x" title="${esc(e.why)}">${esc(e.ticker)}</span>`).join("")}</div>
    ${s1.excluded.length ? `<p>Excluded: ${s1.excluded.map((e) => `<b>${esc(e.ticker)}</b> ${esc(e.name)} — ${esc(e.why)}`).join("; ")}.</p>` : `<p>Nobody in the cohort is excluded at this step; a peer that cannot carry a row sits that row out, and step 2 names it.</p>`}`, { rule: s1.rule }));
  // 2
  if (!compact) {
    const head = `<tr><th>Peer</th>${s2.rows.map((r) => `<th>${esc(SHORT[r.key])}</th>`).join("")}<th>Figures as of</th><th>Price</th></tr>`;
    const cellHTML = (c) => c.state === "in" ? `<td class="cl-k">${esc(X(c.multiple))}</td>` : c.state === "nm" ? `<td class="cl-blank" title="${esc(c.why)}">${esc(X(c.multiple))} NM</td>` : `<td class="cl-blank" title="${esc(c.why || "")}">—</td>`;
    const body = s2.table.map((p) => `<tr><td class="cl-k" title="${esc(p.name)}">${esc(p.ticker)}</td>${s2.rows.map((r) => cellHTML(p.cells[r.key])).join("")}<td>${p.dates ? esc([p.dates.fundamentals ? "EPS " + D(p.dates.fundamentals) : null, p.dates.ttm_to ? (p.dates.ttm_basis || "TTM") + " to " + D(p.dates.ttm_to) : null, p.dates.balance ? "balance " + D(p.dates.balance) : null].filter(Boolean).join(" · ")) || "—" : "dates not in this snapshot"}</td><td>${p.dates && p.dates.price ? esc(D(p.dates.price)) + (p.dates.price_from && !/chart API/.test(p.dates.price_from) ? " · " + esc(p.dates.price_from) : "") : "—"}</td></tr>`).join("");
    const legendRows = s2.rows.map((r) => `<li><b>${esc(SHORT[r.key])}</b> ${esc(r.label)} — ${esc(r.basis || "")}: ${r.n} peers carry it${r.nm.length ? `; set aside as not meaningful (above the cap): ${r.nm.map((x) => `${esc(x.ticker)} ${esc(X(x.value))}`).join(", ")}` : ""}${r.missing.length ? `; blank (${esc(missingWord(r.key))}): ${r.missing.map(esc).join(", ")}` : ""}.</li>`).join("");
    out.push(step(s2, `<div class="cl-twwrap"><div class="cl-tw"><table class="cl-t"><thead>${head}</thead><tbody>${body}</tbody></table></div></div><div class="cl-twhint">wide table · scrolls sideways →</div>
      <p>Source: ${esc(s2.source)}. Taken ${s2.taken ? esc(new Date(s2.taken).toLocaleString("en-GB", { timeZone: "America/New_York", hour12: false })) + " ET" : "—"}. "NM" is a multiple above the row's cap (P/E 100x, EV/sales and P/S 50x, EV/EBITDA 100x, PEG 10x): named, kept out of the percentiles. "—" is a blank: the figure is absent or not positive.</p><ul>${legendRows}</ul>`, { open: !compact }));
  }
  // 3
  out.push(step(s3, `<div class="cl-twwrap"><div class="cl-tw"><table class="cl-t"><thead><tr><th>Metric</th><th>Peers</th><th>Lowest</th><th>25th</th><th>Median</th><th>75th</th><th>Highest</th><th>${esc(T)} today</th></tr></thead><tbody>
    ${s3.rows.map((r) => r.n ? `<tr><td class="cl-k">${esc(r.label)}</td><td>${r.n}</td><td>${esc(X(r.band.min))}${esc(who(r.who.min))}</td><td>${esc(X(r.band.q1))}</td><td class="cl-k">${esc(X(r.band.median))}${esc(who(r.who.median))}</td><td>${esc(X(r.band.q3))}</td><td>${esc(X(r.band.max))}${esc(who(r.who.max))}</td><td class="cl-k">${r.own != null ? esc(X(r.own)) : "—"}</td></tr>` : `<tr><td class="cl-k">${esc(r.label)}</td><td colspan="7" class="cl-blank">no peer carries this row</td></tr>`).join("")}</tbody></table></div></div><div class="cl-twhint">wide table · scrolls sideways →</div>
    ${compact ? "" : `<p>Read the sorted peers to check a median by eye: ${s3.rows.filter((r) => r.n).map((r) => `<b>${esc(SHORT[r.key])}</b> ${r.sorted.map((p) => `${esc(p.ticker)} ${esc(X(p.multiple))}`).join(" · ")}`).join("<br>")}</p>`}`, { rule: s3.rule }));
  // 4
  const lines = (r) => r.lines.map((l) => `<tr><td>${esc(l.word)}</td><td>${l.multiple != null ? esc(X(l.multiple)) : "—"}</td><td>×</td><td>${r.denominator.value != null ? esc(fmtBy(r.denominator.fmt, r.denominator.value)) : `<span class="cl-blank">blank</span>`}</td><td>=</td><td class="cl-k">${l.price != null ? esc(P0(l.price)) : `<span class="cl-blank">—</span>`}</td></tr>`).join("");
  out.push(step(s4, `<p>${esc(T)} today <b>${esc(P(s4.price))}</b> (${esc(D(s4.price_date))}) · shares <b>${s4.shares ? esc((s4.shares / 1e6).toFixed(0)) + "M" : "—"}</b> (market value ÷ the price on the fundamentals row) · net debt <b>${s4.net_debt != null ? esc(MONEY(s4.net_debt)) + (s4.net_debt < 0 ? " (net cash)" : "") : "—"}</b> at ${esc(D(s4.net_debt_date))}.</p>
    ${s4.rows.map((r) => `<p><b>${esc(r.label)}</b> — ${esc(r.denominator.word)}: ${r.denominator.value != null ? `<b>${esc(fmtBy(r.denominator.fmt, r.denominator.value))}</b>${r.denominator.growth != null ? ` (growth ${esc(PCT(r.denominator.growth))} × EPS ${esc(USD(r.denominator.eps))})` : ""} as of ${esc(D(r.denominator.date))} · ${esc(r.denominator.source || "")} · ${esc(r.denominator.formula)}` : `<span class="cl-blank">blank — ${esc(r.denominator.why)}</span>`}</p>
    ${r.denominator.value != null && !compact ? `<div class="cl-tw"><table class="cl-t"><tbody>${lines(r)}</tbody></table></div>` : ""}`).join("")}`, { open: !compact }));
  // 5
  const list = (arr) => arr.map((p) => `${esc(SHORT[p.key])} ${esc(P0(p.price))}`).join(" · ");
  out.push(step(s5, s5.band ? `<div class="cl-tw"><table class="cl-t"><thead><tr><th>Metric</th><th>At the 25th</th><th>At the median</th><th>At the 75th</th></tr></thead><tbody>
    ${s5.used.map((r) => `<tr><td class="cl-k">${esc(r.label)}</td><td>${esc(P0(r.q1))}</td><td class="cl-k">${esc(P0(r.median))}</td><td>${esc(P0(r.q3))}</td></tr>`).join("")}
    ${s5.left_out.map((r) => `<tr><td class="cl-k">${esc(r.label)}</td><td colspan="3" class="cl-blank">left out: ${esc(r.why)}</td></tr>`).join("")}
    <tr><td class="cl-k">Way B, the median of each column</td><td class="cl-k">${esc(P0(s5.band.lo))}</td><td class="cl-k">${esc(P0(s5.band.mid))}</td><td class="cl-k">${esc(P0(s5.band.hi))}</td></tr></tbody></table></div>
    <p>Sorted, so the median can be checked by eye — 25ths: ${list(s5.q1s)} → <b>${esc(P0(s5.band.lo))}</b>; medians: ${list(s5.medians)} → <b>${esc(P0(s5.band.mid))}</b>; 75ths: ${list(s5.q3s)} → <b>${esc(P0(s5.band.hi))}</b>. ${s5.band.overlap ? `Every metric's middle half agrees between ${esc(P0(s5.band.overlap.lo))} and ${esc(P0(s5.band.overlap.hi))}.` : "There is no price where every metric's middle half agrees; the band uses the median of the edges."}</p>` : `<p class="cl-blank">${esc(s5.reason || "no row can be priced")}</p>`, { rule: s5.rule }));
  // 6
  const u = (x, word) => x ? `<p><b>${esc(word)}</b> ${esc(P0(x.dollars + s6.price))} ÷ ${esc(P(s6.price))} − 1 = <b class="${x.pct >= 0 ? "cl-up" : "cl-dn"}">${esc(PCT(x.pct))}</b> · ${esc(P0(x.dollars + s6.price))} − ${esc(P(s6.price))} = <b class="${x.pct >= 0 ? "cl-up" : "cl-dn"}">${esc((x.dollars >= 0 ? "+" : "−") + P0(Math.abs(x.dollars)))}</b></p>` : "";
  out.push(step(s6, s5.band ? `${u(s6.lo, "Low edge (25th):")}${u(s6.mid, "Centre:")}${u(s6.hi, "High edge (75th):")}` : `<p class="cl-blank">no band, so no upside</p>`, { rule: s6.rule }));
  // 7
  out.push(step(s7, `<div class="cl-sentence">${esc(s7.sentence)}</div>
    ${O.outliers.length || O.nm.length || O.missing.length ? `<p><b>Outliers and blanks, named.</b> ${O.outliers.length ? `Outliers by the rule (${esc(O.rule)}): ${O.outliers.map((o) => `${esc(o.ticker)} ${esc(X(o.multiple))} on ${esc(o.label)} (${esc(o.side)})`).join(", ")}.` : "No peer is an outlier by the rule."} ${O.nm.length ? `Set aside as not meaningful: ${O.nm.map((o) => `${esc(o.ticker)} ${esc(X(o.multiple))} on ${esc(o.label)}`).join(", ")}.` : ""} ${O.missing.length ? `Blank: ${O.missing.map((o) => `${esc(o.ticker)} on ${esc(o.label)}`).join(", ")}.` : ""}</p>` : ""}
    ${O.with && O.without ? `<p><b>With the outliers in:</b> ${esc(P0(O.with.lo))} – ${esc(P0(O.with.hi))}, centre ${esc(P0(O.with.mid))} (${esc(PCT(s6.mid ? s6.mid.pct : null))} to the centre). <b>With them out:</b> ${esc(P0(O.without.lo))} – ${esc(P0(O.without.hi))}, centre ${esc(P0(O.without.mid))} (${esc(PCT(L.without.upside.mid ? L.without.upside.mid.pct : null))} to the centre). ${O.changed ? "The two readings differ; both are stated, neither is dropped." : "The two readings are the same."}</p>` : ""}`));
  return `<div class="cl-ladder">${out.join("")}</div>`;
}
const missingWord = (k) => k === "pe_ttm" ? "no positive trailing EPS" : k === "pe_fwd" ? "no positive EPS estimate — forward P/E blank" : k === "ev_ebitda" ? "no positive EBITDA or no net debt" : k === "peg" ? "no positive EPS growth expected" : "no revenue, net debt or share count";

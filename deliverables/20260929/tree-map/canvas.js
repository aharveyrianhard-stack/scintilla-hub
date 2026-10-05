/* TREE MAP · THE CANVAS, rebuilt from the standard parts (T13, 5 Oct 2026).
   Alan, 5 Oct: "'A · today' is boxy, pixelated, looks like 1970… The Hub bar looks so much better." T12's finding: at the first view
   only 108–127 of 613 tickers printed and 81 % of the canvas was black, because the boxes (60 × 19 px) were drawn 2.7 × wider than
   the column pitch they sat on, so they covered each other.

   THE RULE NOW: the box IS the pitch. The canvas is a grid of Hub cells (hub-parts.css: the Hub's type, the Hub's Geiger track,
   the Hub's colours, no frame), one cell per tradeable, every cell the same size, every cell printed whole, never one on another:
   613 of 613 tickers print at the home view by construction. The sector blocks tile the canvas (a squarified treemap by count,
   Bruls / Huizing / van Wijk 2000 — the pattern d3-hierarchy's treemapSquarify uses), each block a title strip and a grid of
   cells, columns = the block's width ÷ the cell pitch; one global scale k on the pitch is solved (bisection) so every block's grid
   fits its tile — the biggest cells that fit. Nothing is drawn in WebGL: cells are DOM, pan / zoom is one CSS transform on the
   stage, so the type is the Hub's type at every zoom (no pixelation).

   ZOOM = LEVEL (the brief: CLEAN is the base, DETAILED's extras fold into CLEAN's zoom levels):
     0 SECTOR      the home view: every sector block with its title and its cells, green → red (the settled order)
     1 INDUSTRY    zoom past 1.5 ×: inside each block the cells regroup under their FMP industry (funds under FUNDS), a caption each
     2 COHORT      past 2.5 ×: the groups split by cohort (the registry's home cohort), a caption each — click a caption: its podium
     3 INSTRUMENT  past 4 ×: the cell grows a second line — the name, the day's move, the market cap
   The cells morph between levels (a CSS transition on their transforms). The type follows the label rule (label-scale.mjs:
   base 12 px at home, floor 11, ceiling 24 on 1080 tall; the ticker thins where cells would overlap it when zoomed OUT, strongest
   reading first, and comes back zoomed in).

   mountCanvas(host, { items, blocks, hub, onPick, onOpen, onCoil, onHover }) → api
     items:  [{ id, t, kind: "name" | "fund", v, label, block, industry, cohort, cohortId, cap, day }]
     blocks: [{ id, label, short, path }] in the order they tile */
import { labelPx, thinLabels } from "./label-scale.mjs";

export const CELL = { w: 88, h: 28, gap: 3, title: 20, caption: 14, ratio: 88 / 28, line2: 14 }; // the home pitch at k = 1 (px on the 1920 × 1080 Apple TV); the cell's shape = the Hub bar's 3.2 : 1
export const LEVELS = [{ level: 0, name: "SECTOR", from: 0 }, { level: 1, name: "INDUSTRY", from: 1.5 }, { level: 2, name: "COHORT", from: 2.5 }, { level: 3, name: "INSTRUMENT", from: 4 }];
export const levelOf = (s) => { let L = 0; for (const l of LEVELS) if (s >= l.from) L = l.level; return L; };
export const LABEL = { base_px: 12, floor_px: 11, ceil_px: 24, reference_view_h: 1080, pad_px: 2 };

/* squarified treemap: items [{ w (weight), … }] into rect {x, y, w, h}; returns [{ item, x, y, w, h }]. The classic row-building
   algorithm: add items to the current row while the worst aspect ratio improves; then lay the row along the shorter side. */
export function squarify(items, rect) {
  const out = [], total = items.reduce((s, it) => s + it.w, 0); if (!items.length || total <= 0) return out;
  let { x, y, w, h } = rect; const scale = (w * h) / total; let rest = items.slice();
  const worst = (row, side) => { const s = row.reduce((a, b) => a + b.w * scale, 0); let m = Infinity, M = 0; for (const r of row) { const a = r.w * scale; m = Math.min(m, a); M = Math.max(M, a); } return Math.max((side * side * M) / (s * s), (s * s) / (side * side * m)); };
  while (rest.length) {
    const side = Math.min(w, h); const row = [rest[0]]; let i = 1;
    while (i < rest.length && worst([...row, rest[i]], side) <= worst(row, side)) { row.push(rest[i]); i++; }
    const area = row.reduce((a, b) => a + b.w * scale, 0);
    if (w >= h) { const rw = area / h; let yy = y; for (const r of row) { const rh = (r.w * scale) / rw; out.push({ item: r, x, y: yy, w: rw, h: rh }); yy += rh; } x += rw; w -= rw; }
    else { const rh = area / w; let xx = x; for (const r of row) { const rw = (r.w * scale) / rh; out.push({ item: r, x: xx, y, w: rw, h: rh }); xx += rw; } y += rh; h -= rh; }
    rest = rest.slice(i);
  }
  return out;
}

const byReading = (a, b) => { const av = a.v == null ? -9 : a.v, bv = b.v == null ? -9 : b.v; return bv - av || (a.t < b.t ? -1 : 1); };
export const groupKey = (it, level) => (level <= 0 ? "" : level === 1 ? it.industry : `${it.industry} · ${it.cohort}`);

/* the layout of one level into W × H (stage px). SHELVES (strip packing, the pattern of a bookshelf and of Bederson's strip treemap):
   the blocks, biggest first, fill horizontal bands; every block in a band is exactly the band's rows tall, its columns = what its
   count needs at that height, so the waste inside a block is under one row and the bands stack with no gap. One global scale k
   on the cell pitch, the largest where the bands fit the height — the biggest cells that fit. Pure: the tests lay it out without
   a browser. */
export function layoutLevel(items, blocks, W, H, level, cell = CELL) {
  const byBlock = new Map(blocks.map((b) => [b.id, []]));
  for (const it of items) if (byBlock.has(it.block)) byBlock.get(it.block).push(it);
  const groupsOf = (list) => { const g = new Map(); for (const it of list.slice().sort(byReading)) { const k = groupKey(it, level); if (!g.has(k)) g.set(k, []); g.get(k).push(it); } // groups ordered by their mean reading, green → red
    return [...g.entries()].map(([k, v]) => ({ key: k, items: v, mean: v.filter((x) => x.v != null).reduce((s, x) => s + x.v, 0) / Math.max(1, v.filter((x) => x.v != null).length) })).sort((a, b) => b.mean - a.mean); };
  const prepared = blocks.map((b) => ({ ...b, items: byBlock.get(b.id) || [], groups: groupsOf(byBlock.get(b.id) || []) })).filter((b) => b.items.length).sort((a, b) => b.items.length - a.items.length);
  const ch = level >= 3 ? cell.h + cell.line2 : cell.h;
  // the rows a block needs at `cols` columns (its groups stacked, a caption each above level 0), in cell heights
  const rowsAt = (b, cols) => b.groups.reduce((r, g) => r + (level ? cell.caption / ch : 0) + Math.ceil(g.items.length / cols), 0);
  const colsFor = (b, R) => { for (let c = 1; c <= b.items.length + 1; c++) if (rowsAt(b, c) <= R + 1e-9) return c; return b.items.length; }; // the fewest columns that fit the band's rows
  const pack = (k) => { // the bands at pitch scale k: the split of the sorted blocks into bands that needs the FEWEST rows in all (dynamic programming over the split points)
    const cw = cell.w * k, chh = ch * k, gap = cell.gap * k, title = cell.title * k, perRow = Math.max(1, Math.floor(W / cw)), T = title / chh + gap / chh;
    const N = prepared.length, memo = new Map();
    const bandOf = (i, j) => { // blocks i..j-1 in one band: the fewest rows R at which their columns fit the width
      const key = i + ":" + j; if (memo.has(key)) return memo.get(key);
      const S = prepared.slice(i, j), n = S.reduce((s, b) => s + b.items.length, 0); let out = null;
      for (let R = Math.max(1, Math.ceil(n / perRow)); R <= 120 && !out; R++) { const cols = S.map((b) => colsFor(b, R)); const w = cols.reduce((s, c) => s + c * cw + 2 * gap, 0); if (w <= W + 1e-6) out = { S, R, cols, w }; }
      memo.set(key, out); return out;
    };
    const best = new Array(N + 1).fill(null); best[N] = { rows: 0, next: null };
    for (let i = N - 1; i >= 0; i--) { let bi = null; for (let j = i + 1; j <= N; j++) { const bd = bandOf(i, j); if (!bd) break; const rows = bd.R + T + best[j].rows; if (!bi || rows < bi.rows - 1e-9) bi = { rows, next: j, band: bd }; } best[i] = bi || { rows: 1e9, next: N, band: { S: prepared.slice(i), R: 1, cols: prepared.slice(i).map(() => 1), w: W } }; }
    const bands = []; for (let i = 0; i < N; i = best[i].next) bands.push(best[i].band);
    const height = bands.reduce((s, bd) => s + title + bd.R * chh + gap, 0);
    return { bands, height, cw, chh, gap, title };
  };
  let lo = 0.05, hi = 3; for (let n = 0; n < 40; n++) { const k = (lo + hi) / 2; if (pack(k).height <= H) lo = k; else hi = k; }
  const k = lo, P = pack(k), { cw, chh, gap, title } = P;
  const cells = [], titles = [], captions = [], tiles = []; let y = 0;
  for (const bd of P.bands) {
    const spare = Math.max(0, W - bd.w), add = spare / bd.S.length; let x = 0; // the band's leftover width is shared between its blocks' tiles (the cells stay the pitch)
    bd.S.forEach((b, j) => {
      const tw = bd.cols[j] * cw + 2 * gap + add, th = title + bd.R * chh + gap, x0 = x + gap + (tw - 2 * gap - bd.cols[j] * cw) / 2; let yy = y;
      tiles.push({ id: b.id, x, y, w: tw, h: th, n: b.items.length });
      titles.push({ id: b.id, label: b.label, short: b.short, x: x + gap, y: yy, w: tw - 2 * gap, h: title, n: b.items.length, up: b.items.filter((i) => i.v > 0).length, down: b.items.filter((i) => i.v < 0).length, tile: { x, y, w: tw, h: th } });
      yy += title;
      for (const g of b.groups) {
        if (level) { captions.push({ id: `${b.id}|${g.key}`, block: b.id, key: g.key, cohortId: g.items[0].cohortId, cohort: g.items[0].cohort, industry: g.items[0].industry, x: x0, y: yy, w: bd.cols[j] * cw, h: cell.caption * k, n: g.items.length, mean: g.mean }); yy += cell.caption * k; }
        g.items.forEach((it, i) => { const c = i % bd.cols[j], r = Math.floor(i / bd.cols[j]); cells.push({ id: it.id, it, x: x0 + c * cw, y: yy + r * chh, w: cw - gap, h: chh - gap }); });
        yy += Math.ceil(g.items.length / bd.cols[j]) * chh;
      }
      x += tw;
    });
    y += title + bd.R * chh + gap;
  }
  const inked = cells.reduce((s, c) => s + c.w * c.h, 0) + titles.reduce((s, t) => s + t.w * t.h, 0) + captions.reduce((s, c) => s + c.w * c.h, 0);
  return { level, k, cell: { w: cw - gap, h: chh - gap, pitch_w: cw, pitch_h: chh }, tiles, titles, captions, cells, covered: inked / (W * H), bands: P.bands.length, W, H };
}

export function mountCanvas(host, opts) {
  const { items, blocks } = opts;
  const $ = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtG = (g) => (g > 0 ? "+" : "") + g.toFixed(2);
  const fmtCap = (v) => (v >= 1e12 ? "$" + (v / 1e12).toFixed(2) + "T" : v >= 1e9 ? "$" + (v / 1e9).toFixed(1) + "B" : v > 0 ? "$" + (v / 1e6).toFixed(0) + "M" : "");
  const stage = $("div", "stage"); const layerT = $("div", "titles"), layerC = $("div", "captions"), layerX = $("div", "cells"); stage.append(layerT, layerC, layerX); host.appendChild(stage);
  const view = { w: 1, h: 1 }, cam = { s: 1, tx: 0, ty: 0 }; let lay = null, level = 0, homeLay = null, selected = null, raf = 0, busy = false, fitDone = false;
  const cellEl = new Map(), titleEl = new Map(), capEl = new Map();
  /* the Hub cell: ticker (the Hub's ticker type) · the value (bull / bear, tabular) · the Hub's composite track under them (gs-cgr —
     the markup the Hub's own GEIGER tile builds: a track with one <i> fill from the centre, bull or bear). No frame. Level 3 adds
     the second line: name · day · cap. */
  const fill = (v) => (v == null ? "" : `<i style="${v >= 0 ? "left:50%" : "right:50%"};width:${(Math.min(1, Math.abs(v)) * 50).toFixed(1)}%;background:var(${v >= 0 ? "--bull" : "--bear"});box-shadow:0 0 7px var(${v >= 0 ? "--bull" : "--bear"})"></i>`);
  const cellHTML = (it) => `<span class="tk">${esc(it.t)}</span><span class="val ${it.v == null ? "none" : it.v >= 0 ? "up" : "dn"}">${it.v == null ? "—" : fmtG(it.v)}</span><span class="gs-cgr${it.v == null ? " none" : ""}">${fill(it.v)}</span><span class="l2">${esc(it.label)}${it.day != null ? ` · <span class="${it.day >= 0 ? "up" : "dn"}">${(it.day >= 0 ? "+" : "") + it.day.toFixed(2)}%</span>` : ""}${it.cap ? ` · ${fmtCap(it.cap)}` : ""}</span>`;
  for (const it of items) { const e = $("div", "cell " + it.kind + (it.v == null ? " hollow" : ""), cellHTML(it)); e.dataset.id = it.id; cellEl.set(it.id, e); layerX.appendChild(e); }
  const titleHTML = (t) => `<span class="name">${esc(t.short || t.label)}</span><span class="cnt">${t.n} · <span class="up">${t.up} UP</span> · <span class="dn">${t.down} DOWN</span></span><span class="go" data-coil="${esc(t.id)}">PODIUM</span>`;
  for (const b of blocks) { const e = $("div", "title"); e.dataset.id = b.id; titleEl.set(b.id, e); layerT.appendChild(e); }
  function applyLayout(L, animate) {
    lay = L; stage.style.width = L.W + "px"; stage.style.height = L.H + "px";
    stage.classList.toggle("anim", !!animate); stage.dataset.level = L.level;
    for (const c of L.cells) { const e = cellEl.get(c.id); e.style.transform = `translate3d(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px,0)`; e.style.width = c.w.toFixed(1) + "px"; e.style.height = c.h.toFixed(1) + "px"; }
    for (const t of L.titles) { const e = titleEl.get(t.id); e.style.transform = `translate3d(${t.x.toFixed(1)}px,${t.y.toFixed(1)}px,0)`; e.style.width = t.w.toFixed(1) + "px"; e.style.height = t.h.toFixed(1) + "px"; e.innerHTML = titleHTML(t); }
    const keep = new Set();
    for (const c of L.captions) { keep.add(c.id); let e = capEl.get(c.id); if (!e) { e = $("div", "caption" + (c.cohortId ? " coh" : "")); e.dataset.id = c.id; if (c.cohortId) e.dataset.coil = c.cohortId; capEl.set(c.id, e); layerC.appendChild(e); } e.style.transform = `translate3d(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px,0)`; e.style.width = c.w.toFixed(1) + "px"; e.style.height = c.h.toFixed(1) + "px"; e.innerHTML = `<span>${esc(c.key)}</span><span class="cnt">${c.n}${c.cohortId ? " · PODIUM" : ""}</span>`; }
    for (const [id, e] of capEl) if (!keep.has(id)) { e.remove(); capEl.delete(id); }
    stage.style.setProperty("--cw", L.cell.w.toFixed(1) + "px"); stage.style.setProperty("--chh", L.cell.h.toFixed(1) + "px");
    scheduleLabels();
  }
  function fit() { view.w = host.clientWidth || 1; view.h = host.clientHeight || 1; const L = layoutLevel(items, blocks, view.w, view.h, 0); homeLay = L; if (!lay || lay.level === 0) applyLayout(L, false); if (!fitDone) { fitDone = true; cam.s = 1; cam.tx = 0; cam.ty = 0; } applyCam(); }
  const applyCam = () => { stage.style.transform = `translate3d(${cam.tx.toFixed(1)}px,${cam.ty.toFixed(1)}px,0) scale(${cam.s.toFixed(4)})`; const L = labelPx(1 / cam.s, 1, view.h, LABEL); stage.style.setProperty("--lpx", (L.px / cam.s).toFixed(2) + "px"); stage.style.setProperty("--s", cam.s.toFixed(4)); setLevel(levelOf(cam.s)); scheduleLabels(); };
  function setLevel(L) { if (L === level) return; level = L; applyLayout(L === 0 ? (homeLay || layoutLevel(items, blocks, view.w, view.h, 0)) : layoutLevel(items, blocks, view.w, view.h, L), true); if (opts.onLevel) opts.onLevel(L); }
  /* the ticker thins where cells would overlap it zoomed OUT (label-scale: strongest first); zoomed in every ticker prints */
  function scheduleLabels() { thin(); } // synchronous: the proof reads the count right after a move
  let printed = 0;
  function thin() {
    if (!lay) return; const s = cam.s, px = labelPx(1 / s, 1, view.h, LABEL).px, tw = (t) => px * 0.62 * t.length + 6;
    const boxes = lay.cells.map((c) => ({ id: c.id, x: (c.x + c.w / 2) * s + cam.tx, y: (c.y + c.h / 2) * s + cam.ty, w: Math.max(tw(c.it.t), c.w * s), h: Math.max(px * 1.3, c.h * s), priority: Math.abs(c.it.v ?? -2) + (c.id === selected ? 10 : 0), fits: c.w * s >= tw(c.it.t) - 2 }));
    const th = thinLabels(boxes.filter((b) => !b.fits), LABEL.pad_px); printed = 0;
    for (const b of boxes) { const on = b.fits || th.shown.has(b.id); cellEl.get(b.id).classList.toggle("nolabel", !on); if (on) printed++; }
  }
  new ResizeObserver(fit).observe(host); fit();
  /* pan: drag · zoom: the wheel, toward the pointer · pinch on touch */
  let drag = null;
  host.addEventListener("pointerdown", (e) => { if (e.button !== 0) return; drag = { x: e.clientX, y: e.clientY, tx: cam.tx, ty: cam.ty, moved: false, t: performance.now() }; host.setPointerCapture(e.pointerId); });
  host.addEventListener("pointermove", (e) => { if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 4) drag.moved = true; if (drag.moved) { cam.tx = drag.tx + dx; cam.ty = drag.ty + dy; applyCam(); host.classList.add("dragging"); } return; } if (opts.onHover) { const c = e.target.closest(".cell"); opts.onHover(c ? c.dataset.id : null, e.clientX, e.clientY); } });
  host.addEventListener("pointerup", (e) => { const d = drag; drag = null; host.classList.remove("dragging"); if (!d || d.moved) return; const t = e.target; const coil = t.closest("[data-coil]"); if (coil) { if (opts.onCoil) opts.onCoil(coil.dataset.coil); return; } const c = t.closest(".cell"); if (c) { select(c.dataset.id); if (opts.onPick) opts.onPick(c.dataset.id); return; } const ti = t.closest(".title"); if (ti) { openBlock(ti.dataset.id); if (opts.onOpen) opts.onOpen(ti.dataset.id); return; } });
  host.addEventListener("wheel", (e) => { e.preventDefault(); const f = Math.exp(-e.deltaY * 0.0015); zoomAt(e.clientX, e.clientY, f); }, { passive: false });
  host.addEventListener("dblclick", (e) => { if (e.target.closest(".cell,.title,.caption")) return; home(600); });
  let pinch = null; host.addEventListener("touchstart", (e) => { if (e.touches.length === 2) pinch = { d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY), s: cam.s }; }, { passive: true });
  host.addEventListener("touchmove", (e) => { if (pinch && e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2, cy = (e.touches[0].clientY + e.touches[1].clientY) / 2; zoomAt(cx, cy, (pinch.s * d / pinch.d) / cam.s); e.preventDefault(); } }, { passive: false });
  host.addEventListener("touchend", () => { pinch = null; }, { passive: true });
  function zoomAt(cx, cy, f) { const r = host.getBoundingClientRect(); const x = cx - r.left, y = cy - r.top; const ns = Math.max(0.35, Math.min(10, cam.s * f)); const k = ns / cam.s; cam.tx = x - (x - cam.tx) * k; cam.ty = y - (y - cam.ty) * k; cam.s = ns; applyCam(); }
  /* an eased move of the camera (pan + zoom): the finder, the block opening, home */
  let move = null;
  function flyTo(to, ms) { if (!ms) { Object.assign(cam, to); applyCam(); return; } move = { from: { ...cam }, to, t0: performance.now(), ms }; busy = true; if (!raf) raf = requestAnimationFrame(step); }
  function step(now) { raf = 0; if (!move) { busy = false; return; } const k = Math.min(1, (now - move.t0) / move.ms), e = 1 - Math.pow(1 - k, 3); cam.s = move.from.s + (move.to.s - move.from.s) * e; cam.tx = move.from.tx + (move.to.tx - move.from.tx) * e; cam.ty = move.from.ty + (move.to.ty - move.from.ty) * e; applyCam(); if (k < 1) raf = requestAnimationFrame(step); else { move = null; busy = false; } }
  const home = (ms = 0) => flyTo({ s: 1, tx: 0, ty: 0 }, ms);
  function frameRect(r, ms = 600, pad = 10, maxS = 10) { const s = Math.min(maxS, (view.w - 2 * pad) / r.w, (view.h - 2 * pad) / r.h); flyTo({ s, tx: (view.w - r.w * s) / 2 - r.x * s, ty: (view.h - r.h * s) / 2 - r.y * s }, ms); }
  function openBlock(id) { const t = (lay || homeLay).tiles.find((x) => x.id === id); if (!t) return; // a block opens at the INDUSTRY level: zoom so the block fills the view (at least 1.5 ×), then the level 1 layout places its groups
    const s = Math.max(LEVELS[1].from, Math.min(6, (view.w - 20) / t.w, (view.h - 20) / t.h)); const L1 = layoutLevel(items, blocks, view.w, view.h, 1); const t1 = L1.tiles.find((x) => x.id === id) || t;
    flyTo({ s, tx: (view.w - t1.w * s) / 2 - t1.x * s, ty: (view.h - t1.h * s) / 2 - t1.y * s }, 700); }
  function select(id) { if (selected) { const e = cellEl.get(selected); if (e) e.classList.remove("sel"); } selected = id; const e = id && cellEl.get(id); if (e) e.classList.add("sel"); scheduleLabels(); }
  function cellOf(id) { return (lay || homeLay).cells.find((c) => c.id === id) || null; }
  function screenOf(id) { const c = cellOf(id); if (c) { const r = host.getBoundingClientRect(); return [r.left + (c.x + c.w / 2) * cam.s + cam.tx, r.top + (c.y + c.h / 2) * cam.s + cam.ty]; } const t = (lay || homeLay).titles.find((x) => x.id === id); if (t) { const r = host.getBoundingClientRect(); return [r.left + (t.x + t.w / 2) * cam.s + cam.tx, r.top + (t.y + t.h / 2) * cam.s + cam.ty]; } return null; }
  const api = {
    home, flyTo, zoomAt, select, openBlock, screenOf, cellOf, fit, level: () => level, pose: () => ({ s: +cam.s.toFixed(4), tx: +cam.tx.toFixed(1), ty: +cam.ty.toFixed(1), level }), busy: () => busy, selected: () => selected,
    find(id) { const c = cellOf(id); if (!c) return false; select(id); const s = Math.max(cam.s, 3); flyTo({ s, tx: view.w / 2 - (c.x + c.w / 2) * s, ty: view.h / 2 - (c.y + c.h / 2) * s }, 700); return true; },
    zoomTo(s, ms = 0) { const cx = view.w / 2, cy = view.h / 2; const k = s / cam.s; flyTo({ s, tx: cx - (cx - cam.tx) * k, ty: cy - (cy - cam.ty) * k }, ms); },
    layout: () => lay, homeLayout: () => homeLay, layoutAt: (L) => layoutLevel(items, blocks, view.w, view.h, L), sizes: () => ({ box: [view.w, view.h], stage: [lay.W, lay.H] }),
    // the proof's rulers: every cell on screen (CSS px), the printed tickers, the pitch
    boxes: () => lay.cells.map((c) => ({ id: c.id, kind: c.it.kind, x: +(c.x * cam.s + cam.tx).toFixed(1), y: +(c.y * cam.s + cam.ty).toFixed(1), w: +(c.w * cam.s).toFixed(1), h: +(c.h * cam.s).toFixed(1), v: c.it.v })),
    labelsNow: () => lay.cells.filter((c) => !cellEl.get(c.id).classList.contains("nolabel")).map((c) => ({ id: c.id, text: c.it.t, x: +(c.x * cam.s + cam.tx).toFixed(1), y: +(c.y * cam.s + cam.ty).toFixed(1), w: +(c.w * cam.s).toFixed(1), h: +(c.h * cam.s).toFixed(1), nx: +((c.x + c.w / 2) * cam.s + cam.tx).toFixed(1), ny: +((c.y + c.h / 2) * cam.s + cam.ty).toFixed(1), onbox: true })),
    tickersPrinted: () => printed, labelPx: () => labelPx(1 / cam.s, 1, view.h, LABEL),
    pitchPx: () => ({ k: +lay.k.toFixed(4), cell: { w: +(lay.cell.w * cam.s).toFixed(1), h: +(lay.cell.h * cam.s).toFixed(1) }, pitch: { w: +(lay.cell.pitch_w * cam.s).toFixed(1), h: +(lay.cell.pitch_h * cam.s).toFixed(1) }, covered: +lay.covered.toFixed(4), cells: lay.cells.length, blocks: lay.tiles.length, level }),
    // boxes never overlap and never leave their tile: the test and the proof read it
    overlaps: () => { const c = lay.cells; let n = 0; for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) { const a = c[i], b = c[j]; if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) n++; } return n; },
    stage, refresh(itemsNow) { for (const it of itemsNow || items) { const e = cellEl.get(it.id); if (e) { e.innerHTML = cellHTML(it); e.classList.toggle("hollow", it.v == null); } } },
  };
  return api;
}

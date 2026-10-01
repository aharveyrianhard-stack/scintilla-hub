/* TREE MAP · LAYERS (30 Sep) — the flat map: the broad levels as nested regions on one canvas. Drag pans, wheel and pinch
   zoom toward the pointer, every label is printed ON its node (a region's title strip, a leaf's middle) at every zoom, and
   a node whose box is too small for its name shows the name once you zoom in. Level steps 1–4 show or hide depth. Clicking
   a region flies to it; clicking a cohort opens its CLUSTER (the 3D of just its names) through the page.
   Alan, 30 Sep: "its layers i need to be able to move around the broad layer… zoomed out it looks amazing i just cant
   zoom in to specific areas… labels dont match nodes." */
import { layoutLayers, labelAnchor, PAD, TITLE } from "./layers-layout.js";

export function mount({ nodes, state, readingOf, aggBar, membersOf, onPick, onOpenCluster }) {
  const host = document.getElementById("layers");
  const cv = document.createElement("canvas"); cv.style.display = "block"; host.appendChild(cv);
  const ctx = cv.getContext("2d");
  const tipEl = document.getElementById("tip-l");
  const byId = state.byId;
  const W = 1600, H = 1000; // the map's own units; the camera maps them to the screen
  let { rects, order } = layoutLayers(nodes, W, H);
  const cam = { x: 0, y: 0, k: 1 }; // screen = (map - x) * k
  const view = { w: 1, h: 1, dpr: 1 };
  let level = 4, hover = null, drag = null, anim = null, dirty = true;
  const KIND_COL = { adopted: "#3a3a3a", proposed: "#2e2e2e", fundset: "#262626", none: "#1d1d1d" };
  const KIND_INK = { adopted: "#cdcdcd", proposed: "#b8b8b8", fundset: "#9a9a9a", none: "#7a7a7a" };
  const HEAD_COL = ["#101010", "#141414", "#181818", "#1c1c1c", "#202020"];
  const UP = "#35b06a", DN = "#d1483f", TRACK = "#1f1f1f";

  function fit() {
    const r = host.getBoundingClientRect(); view.w = Math.max(1, r.width); view.h = Math.max(1, r.height); view.dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(view.w * view.dpr); cv.height = Math.round(view.h * view.dpr); cv.style.width = view.w + "px"; cv.style.height = view.h + "px";
    dirty = true; draw();
  }
  const toScreen = (x, y) => [(x - cam.x) * cam.k, (y - cam.y) * cam.k];
  const toMap = (sx, sy) => [sx / cam.k + cam.x, sy / cam.k + cam.y];
  function frameRect(r, ms = 700, pad = 24) {
    const k = Math.min((view.w - 2 * pad) / Math.max(1, r.w), (view.h - 2 * pad) / Math.max(1, r.h));
    const to = { k, x: r.x + r.w / 2 - view.w / 2 / k, y: r.y + r.h / 2 - view.h / 2 / k };
    if (!ms) { Object.assign(cam, to); dirty = true; draw(); return; }
    anim = { from: { ...cam }, to, t0: performance.now(), ms }; requestAnimationFrame(tick);
  }
  const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  function tick(now) {
    if (!anim) return;
    const t = ease(Math.min(1, (now - anim.t0) / anim.ms));
    // zoom on a log scale so the fly-in feels even
    cam.k = Math.exp(Math.log(anim.from.k) + (Math.log(anim.to.k) - Math.log(anim.from.k)) * t);
    cam.x = anim.from.x + (anim.to.x - anim.from.x) * t; cam.y = anim.from.y + (anim.to.y - anim.from.y) * t;
    dirty = true; draw();
    if (t >= 1) anim = null; else requestAnimationFrame(tick);
  }
  const frameWhole = (ms = 600) => frameRect(rects.get("MARKET"), ms);

  /* ---- drawing ---- */
  const barOf = (n) => { const rd = readingOf(n); if (rd) return { v: rd.v, agg: false, scout: rd.kind === "scout" }; const ab = aggBar(n); return ab ? { v: ab.v, agg: true, scout: ab.kind === "scout" } : null; };
  function drawBar(b, x, y, w, h) {
    ctx.fillStyle = TRACK; ctx.fillRect(x, y, w, h);
    const half = w / 2, fw = Math.min(1, Math.abs(b.v)) * half, fh = b.scout ? h * 0.36 : h * 0.62, fy = y + (h - fh) / 2;
    ctx.fillStyle = b.v >= 0 ? UP : DN;
    if (b.v >= 0) ctx.fillRect(x + half, fy, fw, fh); else ctx.fillRect(x + half - fw, fy, fw, fh);
    if (b.agg) { ctx.fillStyle = TRACK; for (let s = 0; s < fw; s += 5) { const sx = b.v >= 0 ? x + half + s + 3 : x + half - s - 5; ctx.fillRect(Math.max(x + half - fw, Math.min(x + half + fw, sx)), fy, 2, fh); } }
    ctx.fillStyle = "#8c8c8c"; ctx.fillRect(x + half - 0.5, y, 1, h);
  }
  const fmtG = (g) => (g > 0 ? "+" : "") + g.toFixed(2);
  const labels = []; // what was printed this frame: for the proof (id, label box, node anchor)
  function draw() {
    if (!dirty) return; dirty = false;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = "#0d0d0d"; ctx.fillRect(0, 0, view.w, view.h);
    labels.length = 0;
    ctx.textBaseline = "middle";
    for (const id of order) {
      const r = rects.get(id); if (r.level > level || r.w <= 0 || r.h <= 0) continue;
      const [sx, sy] = toScreen(r.x, r.y), sw = r.w * cam.k, sh = r.h * cam.k;
      if (sx > view.w || sy > view.h || sx + sw < 0 || sy + sh < 0) continue;
      const n = byId.get(id);
      const sel = id === state.selected, hov = id === hover;
      // fill
      if (r.region) { ctx.fillStyle = r.level === level ? "#222" : HEAD_COL[Math.min(4, r.level)]; ctx.fillRect(sx, sy, sw, sh); ctx.strokeStyle = sel ? "#ababab" : hov ? "#6a6a6a" : "#333"; ctx.lineWidth = sel ? 1.5 : 1; ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1); }
      else { ctx.fillStyle = n.kind === "cohort" ? KIND_COL[n.ckind] : "#2a2a2a"; ctx.fillRect(sx + 1, sy + 1, sw - 2, sh - 2); if (sel || hov) { ctx.strokeStyle = sel ? "#ababab" : "#6a6a6a"; ctx.lineWidth = 1.5; ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2); } }
      // label ON the node
      const a = labelAnchor(r), [ax, ay] = toScreen(a.x, a.y);
      const text = n.kind === "index" ? n.label.toUpperCase() : n.kind === "cohort" ? n.label.toUpperCase() : n.ticker;
      const px = r.region ? Math.max(11, Math.min(13, 10 + r.level)) : 11;
      ctx.font = `${r.region ? 600 : 400} ${px}px ui-monospace, Menlo, monospace`;
      const tw = ctx.measureText(text).width;
      const room = r.region ? sw - 2 * PAD : sw - 4;
      const bar = !r.region || n.kind === "fund" ? barOf(n) : n.kind === "index" ? barOf(n) : null;
      const collapsed = r.region && TITLE * cam.k < 11; // zoomed far out: strips are thinner than the text
      if (collapsed && r.level > 2) { if (bar && n.kind === "fund") {} }
      const ly0 = r.region ? (collapsed ? sy + 8 + (r.level - 1) * 13 : sy + Math.min(TITLE * cam.k, TITLE) / 2 + 1) : ay - (bar && sh >= 30 ? 7 : 0);
      const lx0 = a.align === "left" ? ax : ax - tw / 2;
      const onCanvas = lx0 >= 0 && lx0 + tw <= view.w && ly0 - px / 2 >= 0 && ly0 + px / 2 <= view.h; // a label is printed whole or not at all
      if (onCanvas && tw <= room && !(collapsed && r.level > 2) && (r.region ? sh >= TITLE * cam.k * 0.6 || sh >= 14 : sh >= 12)) {
        ctx.fillStyle = r.region ? "#cdcdcd" : n.kind === "cohort" ? KIND_INK[n.ckind] : "#ababab";
        ctx.textAlign = a.align;
        const ly = ly0;
        ctx.fillText(text, ax, ly);
        labels.push({ id, text, x: a.align === "left" ? ax : ax - tw / 2, y: ly - px / 2, w: tw, h: px, nx: ax, ny: r.region ? sy + Math.min(TITLE * cam.k, TITLE) / 2 : ay, align: a.align });
        // a kind mark and a member count on a cohort; a mean and ▲▼ on a region
        if (n.kind === "cohort" && sh >= 40 && sw >= 90) { ctx.font = "10px ui-monospace, Menlo, monospace"; ctx.fillStyle = "#6a6a6a"; ctx.fillText(`${{ adopted: "ADOPTED", proposed: "PROPOSED", fundset: "FUND SET", none: "NONE YET" }[n.ckind]} · ${membersOf(n).length}`, ax, ly + 12); }
        if (r.region && n.agg && n.agg.full && sw >= 160) { ctx.font = "10px ui-monospace, Menlo, monospace"; ctx.textAlign = "right"; ctx.fillStyle = "#8c8c8c"; ctx.fillText(`${fmtG(n.agg.full.v)} ▲${n.agg.full.up} ▼${n.agg.full.down}`, sx + sw - PAD, ly); }
      }
      // the bar: under a leaf's label, at the right of a region's title strip
      if (bar) {
        if (!r.region && sw >= 26 && sh >= 30) { const bw = Math.min(sw - 8, 80), bh = 8; drawBar(bar, ax - bw / 2, ay + 3, bw, bh); }
        else if (r.region && n.kind === "fund" && sw >= 120) drawBar(bar, sx + sw - PAD - 60, sy + 4, 60, 8);
      }
    }
    state.layersLabels = labels.length; state.layersLevel = level; state.layersCam = { ...cam };
  }
  const redraw = () => { dirty = true; draw(); };

  /* ---- picking: the deepest drawn rect under the pointer ---- */
  function pick(sx, sy) {
    const [mx, my] = toMap(sx, sy); let best = null;
    for (const id of order) { const r = rects.get(id); if (r.level > level || r.w <= 0) continue; if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) best = id; }
    return best ? byId.get(best) : null;
  }
  cv.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false }; cv.setPointerCapture(e.pointerId); anim = null; });
  cv.addEventListener("pointermove", (e) => {
    if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 3) drag.moved = true; cam.x = drag.cx - dx / cam.k; cam.y = drag.cy - dy / cam.k; redraw(); return; }
    const r = cv.getBoundingClientRect(), n = pick(e.clientX - r.left, e.clientY - r.top);
    if (n !== hover) { hover = n; cv.style.cursor = n ? "pointer" : "grab"; redraw(); }
    if (n && tipEl) { tipEl.innerHTML = tip(n); tipEl.style.display = "block"; tipEl.style.left = Math.min(e.clientX - r.left + 14, view.w - 300) + "px"; tipEl.style.top = (e.clientY - r.top + 14) + "px"; } else if (tipEl) tipEl.style.display = "none";
  });
  cv.addEventListener("pointerup", (e) => {
    const d = drag; drag = null; if (!d || d.moved) return;
    const r = cv.getBoundingClientRect(), n = pick(e.clientX - r.left, e.clientY - r.top);
    if (!n) return;
    if (n.kind === "cohort") { onPick(n); onOpenCluster(n); return; }
    onPick(n); flyTo(n);
  });
  cv.addEventListener("pointerleave", () => { if (tipEl) tipEl.style.display = "none"; hover = null; redraw(); });
  cv.addEventListener("wheel", (e) => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  // pinch: two pointers
  const pts = new Map(); let pinch = null;
  cv.addEventListener("pointerdown", (e) => { pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: cam.k }; drag = null; } });
  cv.addEventListener("pointermove", (e) => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]); if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); const r = cv.getBoundingClientRect(); zoomAt((a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top, (pinch.k * d / pinch.d) / cam.k); } });
  const endPt = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
  cv.addEventListener("pointerup", endPt); cv.addEventListener("pointercancel", endPt);
  function zoomAt(sx, sy, f) {
    const k2 = Math.max(0.2, Math.min(60, cam.k * f)); f = k2 / cam.k;
    const [mx, my] = toMap(sx, sy); cam.k = k2; cam.x = mx - sx / cam.k; cam.y = my - sy / cam.k; redraw();
  }
  function tip(n) {
    const rd = readingOf(n), ab = rd ? null : aggBar(n);
    const head = n.ticker ? `<b>${n.ticker}</b> · ${n.label}` : `<b>${n.label}</b>`;
    const what = n.kind === "index" ? "heading · click to zoom in" : n.kind === "cohort" ? `${{ adopted: "ADOPTED", proposed: "PROPOSED", fundset: "FUND SET", none: "NONE YET" }[n.ckind]} · ${membersOf(n).length} members · click to open its cluster` : n.kind;
    const g = rd ? `Geiger ${fmtG(rd.v)}${rd.kind === "scout" ? " (scout)" : ""}` : ab ? `mean ${fmtG(ab.v)}` : "";
    return `${head}<br><span style="color:#8c8c8c">${what}</span>${g ? `<br><span style="color:${(rd || ab).v >= 0 ? "#35b06a" : "#d1483f"}">${g}</span>` : ""}`;
  }
  function flyTo(n, ms = 700) {
    const r = rects.get(n.id) || rects.get(n.parents[0]); if (!r) return;
    if (n.kind === "name") { const p = rects.get(n.parents[0]); if (p) frameRect(p, ms, 60); return; }
    frameRect(r, ms, r.region ? 24 : 80);
  }
  function setLevel(l) {
    level = Math.max(1, Math.min(4, l));
    let n = state.selected ? byId.get(state.selected) : null;
    while (n && (!rects.has(n.id) || rects.get(n.id).level > level)) n = byId.get(n.parents[0]);
    if (n && rects.get(n.id)) frameRect(rects.get(n.id), 500, rects.get(n.id).region ? 24 : 80); else redraw();
  }
  // the proof reads this: every printed label with its box and the node point it is anchored to (screen px)
  state.layersLabelsNow = () => labels.map((l) => ({ ...l }));
  state.layersRectOf = (id) => { const r = rects.get(id); if (!r) return null; const [x, y] = toScreen(r.x, r.y); return { x, y, w: r.w * cam.k, h: r.h * cam.k, level: r.level }; };
  addEventListener("resize", () => { if (host.offsetParent !== null) fit(); });
  fit(); frameWhole(0);
  return { fit, frameWhole, flyTo, setLevel, redraw, select: (n) => { redraw(); flyTo(n); }, release: () => redraw(), level: () => level };
}

/* T15 (5 Oct 2026, night) · the connections of the LIVE tree, added as branches of the same tree. Nothing about the tree
   changes: same tree.json, same layout, same camera, same labels, same modes. This module is loaded by index.html through
   seven one-line hooks (each tagged T15) and draws into map3d.js's own scene.

   Alan, 5 Oct ~20:45: "everything feels so separate … I don't see the connection of things under technology to other areas
   of the market, like the indexes." ~21:30, on connections being added to the real tree: "we kind of do have to make it
   branch … important in the layers." On T13's preview: "there can't be a bazillion toggles" → ONE toggle: CONNECTIONS on | off,
   on by default.

   1 · THE INDEX LAYER (always drawn while CONNECTIONS is on). SPY, QQQ, DIA, IWM and RSP already sit on the tree as funds under
       BROAD MARKET; each gets a branch from THE MARKET in the tree's own line colour, and a line to every sector it holds:
       thickness = its weight in that sector (the number prints on hover). The 11 sector SPDRs (XLK, XLF, …) get the same
       weighted line to their own sector (and to any other sector they hold ≥ 0.5 % of). Weights: data/connections-20261005.json
       (built by T14 from the Hub's etf_holdings export, read-only; % of the WHOLE fund — what the tree cannot place stays
       "unplaced", nothing is re-scaled).
   2 · A TICKER'S CONNECTIONS (quiet until a name is clicked): thin lines from the clicked name to every fund on the tree that
       holds it, and to its comps peers (FMP ∪ Massive) that sit in ANOTHER sector. The card lists them all, with the weights.
       A target the picture folds away (CLEAN: a line with no reading) is listed, not drawn.
   3 · CROSS-SECTOR COHORT LINKS (quiet until a cohort is clicked): the clicked cohort's links to cohorts in other sectors,
       the strongest first, at most 20, as faint arcs. The card lists them with the count (members + peer pairs + funds).

   Nothing moves on its own; the lines follow the nodes through every morph (FLAT, CLEAN | DETAILED, the order) and hide with
   the whole tree inside an opened area or the podium. Colours are the tree's greys. */
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

export async function connections({ state, nodes, byTicker, esc, fmtG, $, remember, remembered, nameOf, select, SHORT_URL }) {
  const Q = new URLSearchParams(location.search);
  let C = null, err = null;
  try { const r = await fetch(SHORT_URL, { cache: "no-store" }); if (!r.ok) throw new Error("HTTP " + r.status); C = await r.json(); } catch (e) { err = String(e); }
  const SHORT = { SEC_TECH: "TECHNOLOGY", SEC_FIN: "FINANCIALS", SEC_HLTH: "HEALTH CARE", SEC_ENGY: "ENERGY", SEC_INDU: "INDUSTRIALS", SEC_STPL: "STAPLES", SEC_DISC: "DISCRETIONARY", SEC_UTIL: "UTILITIES", SEC_MATL: "MATERIALS", SEC_REIT: "REAL ESTATE", SEC_COMM: "COMMUNICATION", US_BROAD: "BROAD MARKET", US_STYLE: "STYLE · FACTOR", INTL_DEV: "INTL DEVELOPED", EM: "EMERGING", MACRO: "DOLLAR · VOL", WORLD: "THE WORLD", CRYPTO: "CRYPTO", FUNDS: "FUNDS" };
  const secName = (id) => SHORT[id] || (state.byId.get(id) ? state.byId.get(id).label.toUpperCase() : String(id).replace(/^SEC_/, ""));
  const sectorOf = (n) => (n.kind === "name" ? n.sector : n.kind === "fund" && n.parents[0] && n.parents[0].startsWith("SEC_") ? n.parents[0] : null);
  const pct = (w) => (w >= 10 ? w.toFixed(1) : w.toFixed(2)) + "%";
  // the tree's own greys: 0x3c3c3c = a heading's edge, 0x484848 = a cohort's edge, 0x6a6a6a = the HOLLOW ball, 0x8c8c8c = the selection line
  const GREY = { branch: 0x3c3c3c, weight: 0x4e4e4e, hot: 0x9a9a9a, held: 0x484848, peer: 0x6a6a6a, arc: 0x5a5a5a };
  const BROAD = C ? C.indexes.broad.filter((f) => byTicker.has(f) || state.byId.has(f)) : [], SPDR = C ? C.indexes.sector.filter((f) => state.byId.has(f)) : [];
  const MIN_W = 0.5; // a line to a sector the index holds less than half a percent of says nothing: not drawn, still on the card
  const on0 = Q.has("conn") ? Q.get("conn") !== "0" : remembered("tree.connections", "on", ["on", "off"]) === "on";
  const ext = { on: on0, err, has: !!C, counts: { index_branches: 0, index_sector_lines: 0, ticker_lines: 0, arcs: 0 }, selected: null, skipped: [] };
  state.ext = ext;

  /* ---- the one toggle, in the header beside WHOLE MAP; and one line in the KEY ---- */
  const btn = document.createElement("button"); btn.id = "connections"; btn.textContent = "CONNECTIONS"; btn.classList.toggle("on", ext.on);
  btn.title = "on: the indexes branch from THE MARKET to the sectors they hold (thickness = weight, hover for the number); a clicked name shows the funds that hold it and its comps peers in other sectors; a clicked cohort shows its links to cohorts in other sectors. off: the tree alone.";
  const resetBtn = $("reset"); if (resetBtn && resetBtn.parentNode) resetBtn.parentNode.insertBefore(btn, resetBtn);
  const legend = $("legend"); if (legend) { const d = document.createElement("div"); d.id = "legend-conn"; d.innerHTML = `<span class="kb" style="text-align:center;color:var(--mute)">━ ─ ╌</span><span>CONNECTIONS: an index's line to a sector, thick to thin = its weight there (hover for the number) · thin lines from a clicked name to the funds that hold it and its comps peers in other sectors · faint arcs from a clicked cohort to cohorts in other sectors</span>`; legend.appendChild(d); }
  function setOn(on) { ext.on = on; btn.classList.toggle("on", on); remember("tree.connections", on ? "on" : "off"); if (G) { G.visible = on && lastWhole; redraw(); } if (state.selected) card(state.byId.get(state.selected)); }
  btn.addEventListener("click", () => setOn(!ext.on));
  ext.setOn = setOn;

  /* ---- the 3D side: built when map3d mounts (ext.mount), redrawn when the nodes move (ext.positions) ---- */
  let M = null, G = null, lastWhole = true, indexLines = [], hot = null, tickerSeg = null, arcGroup = null, ray = null;
  const V = new THREE.Vector3();
  const pos = (id) => { const n = state.byId.get(id); return n && n.pos && !n.hid ? n.pos : null; };
  function mkLine(a, b, px, col, op, meta) {
    const geo = new LineSegmentsGeometry(); geo.setPositions([a.x, a.y, a.z, b.x, b.y, b.z]);
    const mat = new LineMaterial({ color: col, linewidth: px, transparent: true, opacity: op, depthTest: true, worldUnits: false });
    mat.resolution.set(M.view.w, M.view.h);
    const l = new LineSegments2(geo, mat); l.computeLineDistances(); l.renderOrder = 1; l.userData = meta; l.frustumCulled = false;
    return l;
  }
  const widthPx = (w) => 0.6 + 4.4 * Math.pow(Math.min(100, w) / 100, 0.7); // 1.8 % → 0.9 px · 39 % → 3 px · 98 % → 4.9 px
  function buildIndexLayer() {
    for (const l of indexLines) { G.remove(l); l.geometry.dispose(); l.material.dispose(); } indexLines = [];
    ext.counts.index_branches = 0; ext.counts.index_sector_lines = 0;
    if (!C) return;
    const mk = state.byId.get("MARKET");
    for (const f of BROAD) { const a = mk && mk.pos, b = pos(f); if (!a || !b) continue; const l = mkLine(a, b, 1.2, GREY.branch, 0.95, { kind: "branch", f }); G.add(l); indexLines.push(l); ext.counts.index_branches++; }
    for (const f of [...BROAD, ...SPDR]) {
      const IS = C.index_sectors[f]; if (!IS) continue;
      for (const [sec, w] of Object.entries(IS.shares)) { if (w < MIN_W || !sec.startsWith("SEC_")) continue; const a = pos(f), b = pos(sec); if (!a || !b) continue; const l = mkLine(a, b, widthPx(w), GREY.weight, 0.9, { kind: "weight", f, sec, w }); G.add(l); indexLines.push(l); ext.counts.index_sector_lines++; }
    }
  }
  function placeIndexLayer() { // the nodes moved: the same lines, the new ends
    const mk = state.byId.get("MARKET");
    for (const l of indexLines) { const u = l.userData, a = u.kind === "branch" ? mk.pos : pos(u.f), b = u.kind === "branch" ? pos(u.f) : pos(u.sec); if (!a || !b) { l.visible = false; continue; } l.visible = true; l.geometry.setPositions([a.x, a.y, a.z, b.x, b.y, b.z]); l.computeLineDistances(); }
  }
  /* a name: lines to the funds that hold it (on the tree, drawn) and to its comps peers in other sectors (on the tree, drawn) */
  function targetsOf(n) {
    const out = { held: [], peers_other: [], peers_same: [], skipped: [] };
    if (!C || n.kind !== "name") return out;
    for (const [f, w] of C.held_by[n.ticker] || []) { const fn = state.byId.get(f); if (!fn) continue; out.held.push({ n: fn, w, drawn: !!pos(f) }); }
    const mine = sectorOf(n);
    for (const p of C.peers[n.ticker] || []) { const pn = byTicker.get(p.t); if (!pn) continue; const s = sectorOf(pn); if (s && s !== mine) out.peers_other.push({ n: pn, sec: s, src: p.src, drawn: !!pos(pn.id) }); else out.peers_same.push({ n: pn, src: p.src }); }
    out.held.sort((a, b) => b.w - a.w);
    return out;
  }
  function linksOf(c) { // a cohort: its cross-sector links, the strongest first, at most 20
    if (!C || c.kind !== "cohort") return [];
    return C.cohort_links.filter((l) => l.a === c.id || l.b === c.id).map((l) => ({ ...l, other: l.a === c.id ? l.b : l.a, otherSec: l.a === c.id ? l.sb : l.sa, mySec: l.a === c.id ? l.sa : l.sb })).filter((l) => state.byId.has(l.other)).slice(0, 20);
  }
  function clearSelection() {
    if (tickerSeg) { G.remove(tickerSeg); tickerSeg.geometry.dispose(); tickerSeg.material.dispose(); tickerSeg = null; }
    if (arcGroup) { G.remove(arcGroup); arcGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); arcGroup = null; }
    ext.counts.ticker_lines = 0; ext.counts.arcs = 0; ext.skipped = [];
  }
  function drawSelection() {
    clearSelection();
    const n = ext.selected ? state.byId.get(ext.selected) : null; if (!n || !G) return;
    if (n.kind === "name" && n.pos && !n.hid) {
      const T = targetsOf(n), segs = [], cols = [], C1 = new THREE.Color(GREY.held), C2 = new THREE.Color(GREY.peer);
      const push = (b, Cc) => { segs.push(n.pos.x, n.pos.y, n.pos.z, b.x, b.y, b.z); cols.push(Cc.r, Cc.g, Cc.b, Cc.r, Cc.g, Cc.b); };
      for (const h of T.held) { const p = pos(h.n.id); if (p) push(p, C1); else ext.skipped.push(h.n.id); }
      for (const p of T.peers_other) { const q = pos(p.n.id); if (q) push(q, C2); else ext.skipped.push(p.n.id); }
      if (segs.length) { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(segs), 3)); g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(cols), 3)); tickerSeg = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 })); tickerSeg.renderOrder = 1; tickerSeg.frustumCulled = false; G.add(tickerSeg); ext.counts.ticker_lines = segs.length / 6; }
    } else if (n.kind === "cohort" && n.pos) {
      arcGroup = new THREE.Group();
      for (const l of linksOf(n)) {
        const b = state.byId.get(l.other); if (!b || !b.pos) continue;
        const a = n.pos, d = a.distanceTo(b.pos), mid = new THREE.Vector3().addVectors(a, b.pos).multiplyScalar(0.5); mid.y += Math.max(40, d * 0.22); mid.z += 12; // the arc rises between the two: on the flat canvas it reads as an arch, in 3D the same
        const pts = new THREE.QuadraticBezierCurve3(a.clone(), mid, b.pos.clone()).getPoints(32);
        const g = new THREE.BufferGeometry().setFromPoints(pts);
        const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: GREY.arc, transparent: true, opacity: 0.5 })); line.renderOrder = 1; line.frustumCulled = false; line.userData = { other: l.other, count: l.count }; arcGroup.add(line); ext.counts.arcs++;
      }
      G.add(arcGroup);
    }
  }
  function redraw() { if (!G) return; placeIndexLayer(); drawSelection(); state.dirty = true; M.wake(); }
  ext.mount = (m) => { M = m; G = new THREE.Group(); G.name = "T15 connections"; G.visible = ext.on; m.scene.add(G); ray = new THREE.Raycaster(); ray.params.Line2 = { threshold: 2 }; buildIndexLayer(); drawSelection(); state.dirty = true; };
  ext.positions = () => { if (G) { placeIndexLayer(); drawSelection(); } };
  ext.frame = (whole) => { lastWhole = whole; if (!G) return; G.visible = whole && ext.on; if (M && indexLines.length && (indexLines[0].material.resolution.x !== M.view.w || indexLines[0].material.resolution.y !== M.view.h)) for (const l of indexLines) l.material.resolution.set(M.view.w, M.view.h); };
  /* hover: a connection line under the pointer prints its number (map3d calls this when no node is under the pointer) */
  const tipHTML = (u) => {
    if (u.kind === "weight") { const IS = C.index_sectors[u.f]; return `<b>${esc(u.f)} → ${esc(secName(u.sec))}</b><br><b>${pct(u.w)}</b> of ${esc(u.f)}'s weight sits in ${esc(secName(u.sec))}<br><span style='color:#8c8c8c'>${pct(IS.classified_pct)} of the fund placed on the tree's sectors · ${pct(IS.unclassified_pct)} in names the tree cannot place</span>`; }
    const IS = C.index_sectors[u.f], fn = state.byId.get(u.f); const top = Object.entries(IS.shares).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s, w]) => `${secName(s)} ${pct(w)}`).join(" · ");
    return `<b>${esc(u.f)}</b> · ${esc(fn ? fn.label : "")}<br><span style='color:#8c8c8c'>an index of the market, branching from THE MARKET to the ${Object.keys(IS.shares).filter((s) => IS.shares[s] >= MIN_W).length} sectors it holds · ${esc(top)}</span>`;
  };
  function setHot(l) { if (hot === l) return; if (hot) { hot.material.color.setHex(hot.userData.kind === "branch" ? GREY.branch : GREY.weight); hot.material.opacity = hot.userData.kind === "branch" ? 0.95 : 0.9; } hot = l; if (hot) { hot.material.color.setHex(GREY.hot); hot.material.opacity = 1; } state.dirty = true; if (M) M.wake(); }
  ext.hoverLine = (ev, tipEl, graph, view) => {
    if (!G || !G.visible || !indexLines.length) return false;
    const r = M.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, M.camera);
    const hit = ray.intersectObjects(indexLines.filter((l) => l.visible), false)[0];
    if (!hit) { setHot(null); return false; }
    setHot(hit.object);
    tipEl.innerHTML = tipHTML(hit.object.userData); tipEl.style.display = "block";
    const g = graph.getBoundingClientRect(); tipEl.style.left = Math.min(ev.clientX - g.left + 14, view.w - 310) + "px"; tipEl.style.top = (ev.clientY - g.top + 14) + "px";
    graph.style.cursor = "help";
    return true;
  };

  /* ---- the card's CONNECTIONS section, appended after index.html has drawn the card ---- */
  const row = (n, mid, right) => `<tr><td><span class="lnk" data-go="${esc(n.id)}">${esc(nameOf(n))}</span></td><td class="nm">${mid}</td><td class="r">${right}</td></tr>`;
  const notDrawn = `<span class="tag k" title="this line has no reading, so the CLEAN picture folds it away; DETAILED shows it">not drawn</span>`;
  function sectionHTML(n) {
    if (!C) return `<div class="sec">CONNECTIONS</div><div class="wait">The connections file did not load (${esc(err || "no data")}). The tree itself is unchanged.</div>`;
    const off = ext.on ? "" : `<div class="mute" style="font-size:11px;margin:0 0 6px">CONNECTIONS is off: the lists stay, the lines are not drawn.</div>`;
    if (n.kind === "name") {
      const T = targetsOf(n);
      let h = `<div class="sec">CONNECTIONS</div>` + off;
      const drawn = T.held.filter((x) => x.drawn), folded = T.held.filter((x) => !x.drawn); // the card above already lists HELD BY (tree.json); here: which of those lines are drawn, with the holdings file's weight
      h += `<div class="mute" style="font-size:11px;margin:0 0 4px">LINES TO THE FUNDS THAT HOLD IT · ${drawn.length} drawn <span style="letter-spacing:0">· weight = share of the whole fund (holdings read ${esc((C.read_utc || "").slice(0, 10))})</span></div>`;
      h += drawn.length ? `<div style="font-size:12px;line-height:1.7">${drawn.map((x) => `<span class="lnk" data-go="${esc(x.n.id)}">${esc(x.n.ticker)}</span> <span class="mute">${pct(x.w)}</span>`).join(" · ")}</div>` : `<div class="mute" style="font-size:11px">no fund in the holdings file holds it</div>`;
      if (folded.length) h += `<div class="mute" style="font-size:11px">${notDrawn} ${folded.map((x) => esc(x.n.ticker)).join(", ")}</div>`;
      h += `<div class="mute" style="font-size:11px;margin:10px 0 4px">COMPS PEERS IN OTHER SECTORS · ${T.peers_other.length}</div>`;
      h += T.peers_other.length ? `<table>${T.peers_other.map((x) => row(x.n, esc(secName(x.sec)), `<span class="mute" style="font-size:11px">${esc(x.src.join(" + "))}</span>${x.drawn ? "" : " " + notDrawn}`)).join("")}</table>` : `<div class="mute" style="font-size:11px">every comps peer on the tree sits in its own sector</div>`;
      if (T.peers_same.length) h += `<div class="mute" style="font-size:11px;margin-top:6px">peers in its own sector (${T.peers_same.length}, not drawn): ${T.peers_same.map((x) => `<span class="lnk" data-go="${esc(x.n.id)}">${esc(x.n.ticker)}</span>`).join(", ")}</div>`;
      return h;
    }
    if (n.kind === "cohort") {
      const L = linksOf(n), all = C.cohort_links.filter((l) => l.a === n.id || l.b === n.id).length;
      let h = `<div class="sec">LINKS TO COHORTS IN OTHER SECTORS · ${L.length}${all > L.length ? ` of ${all}` : ""}</div>` + off;
      if (!L.length) return h + `<div class="mute" style="font-size:11px">no link: this cohort shares no member, comps peer or narrow fund with a cohort in another sector</div>`;
      h += `<table>${L.map((l) => { const o = state.byId.get(l.other); return row(o, esc(secName(l.otherSec)), `<b style="font-weight:400">${l.count}</b> <span class="mute" style="font-size:11px">= ${l.members}m + ${l.peers}p + ${l.funds}f</span>`); }).join("")}</table>`;
      h += `<div class="mute" style="font-size:11px;margin-top:6px">count = shared members + comps peer pairs across the two + narrow funds both sit in (the broad and style funds hold everything, so they count for nothing) · the strongest first, at most 20 drawn as arcs</div>`;
      return h;
    }
    if (n.kind === "fund" && C.index_sectors[n.ticker]) {
      const IS = C.index_sectors[n.ticker], rows = Object.entries(IS.shares).sort((a, b) => b[1] - a[1]);
      return `<div class="sec">HOLDS, BY SECTOR · ${rows.filter(([, w]) => w >= MIN_W).length} lines</div>` + off + `<table>${rows.map(([s, w]) => `<tr><td>${state.byId.has(s) ? `<span class="lnk" data-go="${esc(s)}">${esc(secName(s))}</span>` : esc(secName(s))}</td><td class="r">${pct(w)}${w < MIN_W ? ` <span class="tag k">under ${MIN_W}%, no line</span>` : ""}</td></tr>`).join("")}</table>` +
        `<div class="mute" style="font-size:11px;margin-top:6px">${pct(IS.classified_pct)} of the fund is placed on the tree's sectors · ${pct(IS.unclassified_pct)} sits in holdings the tree cannot place (not a sector line) · ${IS.rows} holdings in the file</div>`;
    }
    if (n.kind === "index" && n.id.startsWith("SEC_")) {
      const rows = [...BROAD, ...SPDR].map((f) => [f, (C.index_sectors[f] || { shares: {} }).shares[n.id] || 0]).filter(([, w]) => w >= MIN_W).sort((a, b) => b[1] - a[1]);
      return `<div class="sec">HELD BY THE INDEXES · ${rows.length}</div>` + off + (rows.length ? `<table>${rows.map(([f, w]) => { const fn = state.byId.get(f); return `<tr><td><span class="lnk" data-go="${esc(f)}">${esc(f)}</span></td><td class="nm">${esc(fn ? fn.label : "")}</td><td class="r">${pct(w)}</td></tr>`; }).join("")}</table>` : `<div class="mute" style="font-size:11px">no index in the file puts half a percent here</div>`);
    }
    return "";
  }
  function card(n) {
    const old = document.getElementById("conn-card"); if (old) old.remove();
    if (!n) return;
    const html = sectionHTML(n); if (!html) return;
    const d = document.createElement("div"); d.id = "conn-card"; d.innerHTML = html; $("card").appendChild(d);
  }
  ext.cardSoon = (n) => { ext.selected = n && (n.kind === "name" || n.kind === "cohort") ? n.id : null; queueMicrotask(() => { card(n); if (G) { drawSelection(); state.dirty = true; M.wake(); } }); };

  /* ---- read by the headless proof ---- */
  ext.links = () => ({ on: ext.on, visible: !!(G && G.visible), ...ext.counts, selected: ext.selected, skipped: ext.skipped.slice(), has_data: !!C, err });
  ext.lineMid = (f, sec) => { const l = indexLines.find((x) => x.userData.f === f && (sec ? x.userData.sec === sec : x.userData.kind === "branch")); if (!l || !M) return null; const a = sec ? pos(f) : state.byId.get("MARKET").pos, b = sec ? pos(sec) : pos(f); if (!a || !b) return null; V.addVectors(a, b).multiplyScalar(0.5); const s = M.toScreen(V), r = M.renderer.domElement.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; };
  ext.hoverAt = (f, sec) => { const xy = ext.lineMid(f, sec); if (!xy) return null; M.renderer.domElement.dispatchEvent(new PointerEvent("pointermove", { clientX: xy[0], clientY: xy[1], bubbles: true })); return { at: xy.map(Math.round), tip: ($("tip") || {}).innerText || "", hot: !!hot }; };
  ext.indexLayer = () => indexLines.map((l) => ({ ...l.userData, px: +l.material.linewidth.toFixed(2), visible: l.visible }));
  ext.targetsOf = (t) => { const n = byTicker.get(t); if (!n) return null; const T = targetsOf(n); return { held: T.held.map((x) => [x.n.id, x.w, x.drawn]), peers_other: T.peers_other.map((x) => [x.n.id, x.sec, x.drawn]), peers_same: T.peers_same.length }; };
  ext.linksOf = (id) => { const n = state.byId.get(id); return n ? linksOf(n).map((l) => [l.other, l.otherSec, l.count]) : null; };
  return ext;
}

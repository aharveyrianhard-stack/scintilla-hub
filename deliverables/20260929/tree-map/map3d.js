/* TREE MAP · the 3D view (29 Sep). The r3 market-map scene (deliverables/20260928/market-map-r3/index.html) with one more
   level: the cohorts. Loaded by index.html only when the 3D view is asked for, so the OUTLINE never waits for three.js.

   Layout: the r3 top-down tree (layout.js, copied unchanged). A cohort is laid out as a heading whose "names" block is its
   members; a fund that parents cohorts (SMH, IGV, GDX, …) is laid out as a branch under its sector heading with its cohorts
   as sub-branches, and is still drawn as a fund ball with its bars. The upper tree stays flat; the rows of a big cohort
   step toward you (3D) exactly as r3's sector blocks do. Every position comes from the tree by arithmetic: no randomness.

   Bars: kind 0 own FULL · 1 aggregate (striped: a fund's holdings blend, a cohort's or heading's mean) · 2 own SCOUT (slim)
   · 3 aggregate of SCOUT readings (slim, striped). Scout only where full is absent.

   T5 (2 Oct). Two pictures of the same tree, CLEAN and DETAILED (state.detail): CLEAN lays out only the nodes that carry
   a reading of their own or an aggregate — headings, cohorts and funds with a bar — and no names, so there are no boxes;
   what a node folds away is counted on it as "＋N more". DETAILED is the full tree. Inside every parent the children run
   green → red by reading (state.order = "geiger"; "size" keeps the old order). A section heading carries a 3D chip on
   the canvas; a cohort of more than 24 names opens into the COIL.

   T6 (2 Oct, Alan: "my Geigers are not optional — they are the centerpiece"). In CLEAN every kept node is drawn as a BOX =
   its Geiger bar, centred on its place, sized so it reads at the zoom-out (a floor in screen pixels), with the name on it;
   the balls are hidden there; a node with no reading shows the empty track, never nothing. The leaf blocks sit wider apart
   in CLEAN (layout.js {sp}) so the boxes have room. The COIL is the PODIUM: one spiral of Geiger bars, the highest reading
   at the centre-top, winding down and outwards as the readings fall, the lowest at the outer bottom; the zero line is the
   ring where the bars turn from green to red. OPEN 3D on every section; the canvas takes keyboard focus inside an area so
   Esc works; the framing keeps the bottom band (KEY, hint, the lowest label) clear. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { prepareTree, layout as layoutTree, bestRows, LAYOUT } from "./layout.js";

export async function mount({ nodes, state, kids, primaryKids, readingOf, aggBar, membersOf, onSelect, onRelease, onArea, onTree }) {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtG = (g) => (g > 0 ? "+" : "") + g.toFixed(2);
  const PHONE = matchMedia("(max-width:760px)").matches;
  const LIT = 0x7a7a7a, HEADING = 0x4a4a4a, COHORT = 0x9a9a9a, HOLLOW = 0x6a6a6a, RING = 0xababab;
  nodes.forEach((n) => { n.pos = new THREE.Vector3(); n.from = new THREE.Vector3(); n.to = new THREE.Vector3(); });

  /* ---- layout: the r3 tree with cohorts and cohort-parent funds as branches ---- */
  const parentsCohort = new Set(nodes.filter((n) => n.kind === "cohort").map((n) => n.parents[0]));
  // the reading a node is ordered and kept by: its own (full or scout), else its aggregate, else none
  const valueOf = (n) => { const rd = readingOf(n); if (rd) return rd.v; const ab = aggBar(n); return ab ? ab.v : null; };
  // T6: in CLEAN a cohort folds its names away, so it is a LEAF — it sits in its parent's block like a fund (a compact grid of
  // boxes) instead of being a wide sub-heading of its own; DETAILED keeps every cohort a branch with its names under it
  const layNode = (n, clean = false) => ({ id: n.id, kind: n.kind === "cohort" ? (clean ? "fund" : "index") : (n.kind === "fund" && parentsCohort.has(n.id)) ? "index" : n.kind, parents: n.parents, role: n.role, issuer: n.issuer, market_value_usd: n.market_value_usd, ticker: n.ticker, v: valueOf(n), name: n.label });
  // a cohort's members hang from it as its names block: give each member a primary parent of its cohort in the layout copy
  // (names already have it; member FUNDS keep their own place on the tree and are not moved)
  const shapeOf = (() => { const r = $("graph").getBoundingClientRect(); return r.width > 10 && r.height > 10 ? r.width / r.height : innerWidth / Math.max(1, innerHeight - 80); })();
  state.detail = state.detail === "detailed" ? "detailed" : "clean"; state.order = state.order === "size" ? "size" : "geiger";
  // CLEAN keeps a heading, and any cohort or fund that has a bar; it drops every name, every fund set with no names at
  // home (no bar), every waiting fund. A dropped node sits on its nearest kept ancestor, scaled to nothing, and is counted there.
  const cleanKeep = (n) => n.kind === "index" || (n.kind !== "name" && valueOf(n) != null);
  // T6: in CLEAN the lines of a leaf block sit wider apart and its rows step taller (DETAILED: 22 / 36) so every box is a bar that
  // reads at the zoom-out; a heading's minimum width is its box, not two columns. (?sp= ?row= ?minw= let the proof tune them.)
  const Q = new URLSearchParams(location.search);
  const CLEAN_SP = +Q.get("sp") || 120, CLEAN_ROW = +Q.get("row") || 90, CLEAN_MINW = +Q.get("minw") || 200;
  const boxMode = () => state.detail !== "detailed"; // CLEAN draws boxes (bars with the name on them) instead of balls
  const modes = {};
  function buildMode(key) {
    const list = (key === "clean" ? nodes.filter(cleanKeep) : nodes).map((n) => layNode(n, key === "clean"));
    const ids = new Set(list.map((n) => n.id));
    const kept = list.filter((n) => !n.parents.length || ids.has(n.parents[0]));
    const opts = key === "clean" ? { order: state.order, sp: CLEAN_SP, row: CLEAN_ROW, minW: CLEAN_MINW, wrapMin: +Q.get("wrap") || 2 } : { order: state.order };
    const rows = bestRows(kept, shapeOf, key === "clean" ? { ...opts, k: 0 } : opts); // CLEAN is judged flat: that is how the canvas shows it
    const heads = prepareTree(kept, { ...opts, rows });
    return { key, heads, byId: new Map(kept.map((n) => [n.id, n])), rows, trayHeads: heads.filter((h) => h.names.length), wrapHeads: heads.filter((h) => h.rows.length > 1) };
  }
  modes.full = buildMode("full"); modes.clean = buildMode("clean");
  const modeOf = (m) => (m === "detailed" ? modes.full : modes.clean);
  let cur = modeOf(state.detail); state.sectorRows = cur.rows;
  const isBranch = (n) => n.kind === "index" || n.kind === "cohort" || parentsCohort.has(n.id);
  const isSection = (n) => n.kind === "index" && n.id !== "MARKET" && !primaryKids(n.id).some((c) => c.kind === "index"); // a heading with no sub-headings: Technology, Financials, Broad Market, …
  function layout(k, into, mode = cur) {
    const placed = new Map();
    layoutTree(mode.heads, k, (ln, x, y, z) => placed.set(ln.id, [x, y, z]));
    nodes.forEach((n) => { n.fold = null; });
    for (const n of nodes) {
      let p = placed.get(n.id), a = null;
      n.hid = !p;
      if (!p) { a = n; while (a && !placed.has(a.id)) a = a.parents.length ? state.byId.get(a.parents[0]) : null; p = a ? placed.get(a.id) : [0, 0, 0]; }
      if (a) { const f = a.fold || (a.fold = { names: 0, sets: 0, waiting: 0, funds: 0, total: 0 }); f.total++; if (n.kind === "name") { if (n.hollow) f.waiting++; else f.names++; } else if (n.kind === "cohort") f.sets++; else f.funds++; }
      into(n, p[0], p[1], p[2]);
    }
  }
  layout(1, (n, x, y, z) => n.pos.set(x, y, z));

  /* ---- the scene ---- */
  const el = $("gl"), graph = $("graph");
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
  /* 1 Oct (Alan's Retina Mac, scale 2): the drawing buffer was CSS × ratio but the canvas element kept its buffer size as
     its CSS size, so the picture overflowed the box while the labels (CSS px) stayed put — two planes. Now: the CSS size is
     the container's, the buffer is CSS × device scale, the ratio is set here and again on every resize (a window dragged
     between a Retina and a plain screen changes it), and every label is projected in CSS pixels from the same size. */
  const dprNow = () => Math.max(1, Math.min(3, devicePixelRatio || 1));
  renderer.setPixelRatio(dprNow());
  renderer.setClearColor(0x0d0d0d, 1);
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0d0d0d, 900, 2600);
  const camera = new THREE.PerspectiveCamera(38, 1, 1, 12000);
  scene.add(new THREE.HemisphereLight(0xb4b4b4, 0x1e1e1e, 1.1));
  const key = new THREE.DirectionalLight(0xc8c8c8, 1.3); key.position.set(500, 900, 700); scene.add(key);

  const litL = nodes.filter((n) => n.ticker && (n.g || n.sg)), holL = nodes.filter((n) => n.ticker && !n.g && !n.sg), headL = nodes.filter((n) => n.kind === "index"), cohL = nodes.filter((n) => n.kind === "cohort");
  const M = new THREE.Matrix4();
  function instanced(list, geom, mat) { const im = new THREE.InstancedMesh(geom, mat, Math.max(1, list.length)); im.count = list.length; list.forEach((n, i) => { n.inst = { mesh: im, i }; }); im.userData.list = list; scene.add(im); return im; }
  const litMesh = instanced(litL, new THREE.SphereGeometry(1, 16, 11), new THREE.MeshLambertMaterial({ color: LIT }));
  const holMesh = instanced(holL, new THREE.IcosahedronGeometry(1.15, 1), new THREE.MeshBasicMaterial({ color: HOLLOW, wireframe: true, transparent: true, opacity: 0.6 }));
  const headMesh = instanced(headL, new THREE.SphereGeometry(1, 16, 11), new THREE.MeshLambertMaterial({ color: HEADING }));
  const cohMesh = instanced(cohL, new THREE.SphereGeometry(1, 16, 11), new THREE.MeshLambertMaterial({ color: COHORT }));

  /* ---- bars ---- */
  const BAR_W = 9, BAR_H = 1.7, BAR_GAP = 0.9, BAR_TOP = 1.1, BAR_MIN_PX = 7;
  /* T6 · the boxes. A box is the same bar drawn big and centred on the node, with a floor in screen pixels so it reads at
     the zoom-out: a fund's box at least 26 × 7 px, a heading's or cohort's at least 56 × 13 px, a podium bar at least
     44 × 11 px (its ticker sits on it). Sizes are half-widths / half-heights in world units + the half-width floor in px. */
  const BOX = { small: { w: 42, h: 14, min: 10.5 }, big: { w: 90, h: 20.9, min: 28 }, coil: { w: 15, h: 3.75, min: 22 } }; // a fund's box: 21 × 7 px floor, so the grids never touch at the zoom-out; a flat podium bar: 44 × 11 px (T7: was 54 × 13.5, part of why the middle turns touched)
  const bars = [];
  nodes.forEach((n) => {
    const rd = readingOf(n);
    const own = rd ? { v: rd.v, kind: rd.kind === "full" ? 0 : 2 } : null;
    let agg = null;
    if (n.kind === "fund") agg = n.agg ? { v: n.agg.value, kind: 1 } : null;
    else if (n.kind === "cohort" || n.kind === "index") { const ab = aggBar(n); agg = ab ? { v: ab.v, kind: ab.kind === "full" ? 1 : 3 } : null; }
    if (own) bars.push({ n, ...own, slot: 0 });
    if (agg) bars.push({ n, ...agg, slot: own ? 1 : 0 });
    if (!own && !agg) bars.push({ n, v: 0, kind: 4, slot: 0 }); // no reading at all: the empty track, never nothing (T6)
  });
  const isBig = (n) => n.kind === "index"; // the 23 headings get the big box; cohorts and funds the small one (they sit in grids)
  function barGeometry(list) {
    const g = new THREE.InstancedBufferGeometry(); g.copy(new THREE.PlaneGeometry(2, 2)); g.instanceCount = list.length;
    g.setAttribute("aCenter", new THREE.InstancedBufferAttribute(new Float32Array(list.flatMap((b) => [b.n.pos.x, b.n.pos.y, b.n.pos.z])), 3));
    g.setAttribute("aVal", new THREE.InstancedBufferAttribute(new Float32Array(list.map((b) => Math.max(-1, Math.min(1, b.v)))), 1));
    g.setAttribute("aKind", new THREE.InstancedBufferAttribute(new Float32Array(list.map((b) => b.kind)), 1));
    g.setAttribute("aR", new THREE.InstancedBufferAttribute(new Float32Array(list.map((b) => b.n.r)), 1));
    g.setAttribute("aTwo", new THREE.InstancedBufferAttribute(new Float32Array(list.map((b) => b.slot)), 1));
    g.setAttribute("aBox", new THREE.InstancedBufferAttribute(new Float32Array(list.map((b) => (isBig(b.n) ? 1 : 0))), 1));
    return g;
  }
  const barGeo = barGeometry(bars);
  const aCenter = barGeo.getAttribute("aCenter");
  /* one shader for every bar on the page. uBox = 0: the DETAILED look, a small bar hung under its ball (uW × uH, floor uMinPx).
     uBox = 1: the box look — a fund (aBox 0) at uW × uH, a heading or cohort (aBox 1) at uWBig × uHBig, each with its own
     floor. uCenter = 1 centres the first bar on the node (the box) and pushes it a touch toward the camera so it covers
     the line that ends there; uCenter = 0 hangs it under the ball as before. Kind 4 is the empty track. */
  const mkBarMat = (o) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: !!o.depthWrite, depthTest: true,
    uniforms: { uScaleH: { value: 1 }, uW: { value: o.w }, uH: { value: o.h }, uMinPx: { value: o.min }, uWBig: { value: o.wBig || o.w }, uHBig: { value: o.hBig || o.h }, uMinPxBig: { value: o.minBig || o.min },
      uGap: { value: BAR_GAP }, uTop: { value: BAR_TOP }, uBox: { value: o.box ? 1 : 0 }, uCenter: { value: o.center ? 1 : 0 } },
    vertexShader: `attribute vec3 aCenter; attribute float aVal; attribute float aKind; attribute float aR; attribute float aTwo; attribute float aBox;
      uniform float uScaleH; uniform float uW; uniform float uH; uniform float uMinPx; uniform float uWBig; uniform float uHBig; uniform float uMinPxBig;
      uniform float uGap; uniform float uTop; uniform float uBox; uniform float uCenter;
      varying vec2 vUv; varying float vVal; varying float vKind;
      void main(){
        vec4 mv = viewMatrix * vec4(aCenter, 1.0);
        float ppu = uScaleH / max(1.0, -mv.z);
        float big = uBox * aBox;
        float w = mix(uW, uWBig, big); float h = mix(uH, uHBig, big); float minPx = mix(uMinPx, uMinPxBig, big);
        float s = max(1.0, minPx / (w * ppu));
        float off = mix(aR + s * (uTop + h), 0.0, uCenter) + s * aTwo * (2.0 * h + uGap);
        mv.xy += vec2(position.x * w * s, position.y * h * s - off);
        mv.z += uCenter * 0.6;
        vUv = position.xy; vVal = aVal; vKind = aKind;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying vec2 vUv; varying float vVal; varying float vKind;
      void main(){
        vec3 track = vec3(0.12); vec3 col = vVal >= 0.0 ? vec3(0.208, 0.690, 0.416) : vec3(0.820, 0.282, 0.247);
        vec3 c = track; float a = 0.94; float x = vUv.x;
        float fillH = vKind > 1.5 ? 0.34 : 0.62;
        bool inFill = vKind < 3.5 && abs(vUv.y) < fillH && ((vVal >= 0.0 && x >= 0.0 && x <= vVal) || (vVal < 0.0 && x <= 0.0 && x >= vVal));
        if (inFill) { c = col; if ((abs(vKind - 1.0) < 0.5 || (vKind > 2.5 && vKind < 3.5)) && mod(gl_FragCoord.x + gl_FragCoord.y, 5.0) < 2.0) c = track; }
        if (abs(x) < 0.035) c = vec3(0.55);
        gl_FragColor = vec4(c, a);
      }`,
  });
  const barMat = mkBarMat({ w: BAR_W, h: BAR_H, min: BAR_MIN_PX });                     // the whole tree: DETAILED look until applyBarMode says otherwise
  const areaBarMat = mkBarMat({ w: BAR_W, h: BAR_H, min: BAR_MIN_PX });                 // an area always shows the DETAILED look (balls with bars under them)
  const coilBarMat = mkBarMat({ w: BOX.coil.w, h: BOX.coil.h, min: BOX.coil.min, box: 1, center: 1, depthWrite: true }); // the podium's bars
  const barMesh = new THREE.Mesh(barGeo, barMat); barMesh.frustumCulled = false; barMesh.renderOrder = 3; scene.add(barMesh);
  const ballMeshes = [litMesh, holMesh, headMesh, cohMesh];
  function applyBarMode() { // CLEAN = boxes: the bars grow to their box sizes, centre on the nodes, and the balls go
    const on = boxMode();
    const u = barMat.uniforms; u.uBox.value = on ? 1 : 0; u.uCenter.value = on ? 1 : 0;
    u.uW.value = on ? BOX.small.w : BAR_W; u.uH.value = on ? BOX.small.h : BAR_H; u.uMinPx.value = on ? BOX.small.min : BAR_MIN_PX;
    u.uWBig.value = on ? BOX.big.w : BAR_W; u.uHBig.value = on ? BOX.big.h : BAR_H; u.uMinPxBig.value = on ? BOX.big.min : BAR_MIN_PX;
    ballMeshes.forEach((m) => { m.visible = !on && !cluster; });
    state.boxMode = on; state.dirty = true;
  }
  const showWhole = (on) => { for (const o of [barMesh, selLines, treeLines]) o.visible = on; ballMeshes.forEach((m) => { m.visible = on && !boxMode(); }); };

  /* ---- lines: the tree's edges, trays round the name blocks, rails for wrapped rows ---- */
  const links = [];
  nodes.forEach((n) => n.parents.forEach((p, i) => links.push({ s: state.byId.get(p), t: n, primary: i === 0 })));
  const treeLinks = links.filter((l) => l.primary && l.t.kind !== "name");
  const RAIL = LAYOUT.ROWGAP / 2;
  const hangs = (l) => { const lt = cur.byId.get(l.t.id), ls = cur.byId.get(l.s.id); return !!lt && !!ls && lt.kind === "index" && lt.rowOf > 0 && ls.rows && ls.rows.length > 1; };
  const railsOf = (m) => m.wrapHeads.reduce((s, h) => s + 2 * h.rows.length - 1, 0);
  const railCount = Math.max(railsOf(modes.full), railsOf(modes.clean)), trayMax = Math.max(modes.full.trayHeads.length, modes.clean.trayHeads.length);
  const lineGeo = new THREE.BufferGeometry();
  const railStart = treeLinks.length + trayMax * 5, lineCount = railStart + railCount;
  lineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(lineCount * 6), 3));
  lineGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(lineCount * 6), 3));
  { const col = lineGeo.attributes.color.array, C = new THREE.Color();
    treeLinks.forEach((l, i) => { C.setHex(l.t.kind === "index" ? 0x3c3c3c : l.t.kind === "cohort" ? 0x484848 : 0x2c2c2c); col.set([C.r, C.g, C.b, C.r, C.g, C.b], i * 6); });
    for (let j = treeLinks.length; j < lineCount; j++) { C.setHex(j >= railStart ? 0x3c3c3c : 0x2a2a2a); col.set([C.r, C.g, C.b, C.r, C.g, C.b], j * 6); } }
  const treeLines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 })); scene.add(treeLines);
  const selGeo = new THREE.BufferGeometry(); selGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6 * 64), 3)); selGeo.setDrawRange(0, 0);
  const selLines = new THREE.LineSegments(selGeo, new THREE.LineBasicMaterial({ color: 0x8c8c8c, transparent: true, opacity: 0.95 })); scene.add(selLines);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.1, 48), new THREE.MeshBasicMaterial({ color: RING, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false }));
  ring.visible = false; ring.renderOrder = 5; scene.add(ring);
  const P = (id) => state.byId.get(id).pos;
  function applyPositions() {
    for (const mesh of [litMesh, holMesh, headMesh, cohMesh]) { mesh.userData.list.forEach((n, i) => { const r = n.hid ? 0 : n.r; M.makeScale(r, r, r).setPosition(n.pos); mesh.setMatrixAt(i, M); }); mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); }
    bars.forEach((b, i) => aCenter.setXYZ(i, b.n.pos.x, b.n.hid ? 1e6 : b.n.pos.y, b.n.pos.z)); aCenter.needsUpdate = true; // a folded node's bar is parked far out of view
    const a = lineGeo.attributes.position.array;
    treeLinks.forEach((l, i) => a.set(l.t.hid ? [l.s.pos.x, l.s.pos.y, l.s.pos.z, l.s.pos.x, l.s.pos.y, l.s.pos.z] : hangs(l) ? [l.t.pos.x, l.t.pos.y + RAIL, l.t.pos.z, l.t.pos.x, l.t.pos.y, l.t.pos.z] : [l.s.pos.x, l.s.pos.y, l.s.pos.z, l.t.pos.x, l.t.pos.y, l.t.pos.z], i * 6));
    a.fill(0, treeLinks.length * 6, lineCount * 6); // trays and rails of the mode not on the screen stay empty
    cur.trayHeads.forEach((h, j) => {
      const hp = P(h.id), f = P(h.names[0].id), last = P((h.names[(h.nRows - 1) * h.cols] || h.names[h.names.length - 1]).id);
      const x0 = h.bx0 - 4, x1 = h.bx0 + h.leafW + 4, top = f.y + 16, bot = last.y - 16, z0 = f.z - 6, z1 = last.z + 10;
      const segs = [[hp.x, hp.y, hp.z, h.cx, top, z0], [x0, top, z0, x1, top, z0], [x1, top, z0, x1, bot, z1], [x1, bot, z1, x0, bot, z1], [x0, bot, z1, x0, top, z0]];
      if (h.funds.length) { const lf = P(h.funds[h.funds.length - 1].id); segs[0] = [h.cx, lf.y - 8, lf.z, h.cx, top, z0]; }
      segs.forEach((s, k) => a.set(s, (treeLinks.length + j * 5 + k) * 6));
    });
    let ri = railStart;
    for (const h of cur.wrapHeads) {
      const hp = P(h.id), z = hp.z, g = h.trunkX;
      a.set([hp.x, hp.y, z, g[0], hp.y, z], ri++ * 6);
      let prevY = hp.y;
      for (let r = 1; r < h.rows.length; r++) {
        const row = h.rows[r], r0 = P(row[0].id), rl = P(row[row.length - 1].id), ry = r0.y + RAIL, next = r < g.length ? g[r] : r0.x;
        a.set([g[r - 1], prevY, z, g[r - 1], ry, z], ri++ * 6);
        a.set([Math.min(g[r - 1], next, r0.x), ry, z, Math.max(g[r - 1], next, rl.x), ry, z], ri++ * 6);
        prevY = ry;
      }
    }
    lineGeo.attributes.position.needsUpdate = true;
    if (state.selected && state.byId.get(state.selected).pos) drawSelection(state.byId.get(state.selected));
  }
  applyPositions();

  /* ---- camera, controls, framing ---- */
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.rotateSpeed = 0.55; controls.zoomSpeed = 0.9; controls.minDistance = 30; controls.maxDistance = 9000;
  const view = { w: 1, h: 1 };
  function fit() {
    const r = graph.getBoundingClientRect(); view.w = Math.max(1, r.width); view.h = Math.max(1, r.height);
    renderer.setPixelRatio(dprNow()); renderer.setSize(view.w, view.h, true); // CSS = the box; buffer = CSS × scale
    camera.aspect = view.w / view.h; camera.updateProjectionMatrix();
    view.scaleH = view.h / (2 * Math.tan((camera.fov * Math.PI) / 360)); for (const m of [barMat, areaBarMat, coilBarMat, standMat]) m.uniforms.uScaleH.value = view.scaleH; wake();
  }
  addEventListener("resize", fit);
  (function watchScale() { let last = dprNow(); setInterval(() => { const d = dprNow(); if (d !== last) { last = d; fit(); } }, 1000); })();
  state.sizes = () => { const c = renderer.domElement, r = c.getBoundingClientRect(), b = graph.getBoundingClientRect(); return { box: [Math.round(b.width), Math.round(b.height)], css: [Math.round(r.width), Math.round(r.height)], buffer: [c.width, c.height], ratio: renderer.getPixelRatio(), view: [view.w, view.h] }; };
  let move = null;
  function flyTo(to, ms = 900) { move = { from: { p: camera.position.clone(), t: controls.target.clone() }, to, t0: performance.now(), ms }; wake(); }
  const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  function stepMove(now) { if (!move) return false; const k = ease(Math.min(1, (now - move.t0) / move.ms)); camera.position.lerpVectors(move.from.p, move.to.p, k); controls.target.lerpVectors(move.from.t, move.to.t, k); if (k >= 1) move = null; return true; }
  const _cam = camera.clone(), _p = new THREE.Vector3();
  function framing(list, dir, fill = 0.86, getPos = (n) => n.pos, bottom = 0) {
    const tgt = new THREE.Vector3(); list.forEach((n) => tgt.add(getPos(n))); tgt.divideScalar(list.length);
    let rad = 1; list.forEach((n) => { rad = Math.max(rad, getPos(n).distanceTo(tgt)); });
    let d = (rad * 1.1) / Math.tan((camera.fov * Math.PI) / 360) / Math.min(1, camera.aspect);
    for (let it = 0; it < 5; it++) {
      _cam.aspect = camera.aspect; _cam.fov = camera.fov; _cam.updateProjectionMatrix();
      _cam.position.copy(tgt).add(dir.clone().multiplyScalar(d)); _cam.lookAt(tgt); _cam.updateMatrixWorld();
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const n of list) { _p.copy(getPos(n)).project(_cam); x0 = Math.min(x0, _p.x); x1 = Math.max(x1, _p.x); y0 = Math.min(y0, _p.y); y1 = Math.max(y1, _p.y); }
      const span = Math.max((x1 - x0) / 2 / fill, (y1 - y0) / 2 / (fill * (1 - bottom)));
      const right = new THREE.Vector3().setFromMatrixColumn(_cam.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(_cam.matrixWorld, 1);
      const half = d * Math.tan((camera.fov * Math.PI) / 360);
      tgt.add(right.multiplyScalar(((x0 + x1) / 2) * half * camera.aspect)).add(up.multiplyScalar(((y0 + y1) / 2 - 0.03 - bottom) * half));
      d *= span;
    }
    return { p: tgt.clone().add(dir.clone().multiplyScalar(d)), t: tgt };
  }
  const DIR3 = new THREE.Vector3(0.12, 0.62, 1).normalize(), DIR2 = new THREE.Vector3(0, 0, 1);
  function subtree(h) { const out = [h]; (function walk(id) { for (const c of primaryKids(id)) { out.push(c); walk(c.id); } })(h.id); if (h.kind === "cohort") out.push(...membersOf(h)); return out; }
  /* T6 · the bottom band: the framing keeps clear whatever sits at the bottom of the canvas (the KEY, open or closed, and
     the hint line — whichever reaches higher) plus the depth of a label under the lowest node, so nothing overlaps. */
  const LABEL_DEPTH = 56;
  function bottomBand() {
    const gr = graph.getBoundingClientRect(); let top = gr.bottom;
    for (const id of ["legend", "hint"]) { const el = $(id); if (el && getComputedStyle(el).display !== "none") top = Math.min(top, el.getBoundingClientRect().top); }
    return Math.max(0, gr.bottom - top) + 10 + LABEL_DEPTH;
  }
  function frameWhole(ms = 0, getPos) {
    const to = framing(nodes, state.flat ? DIR2 : DIR3, 0.9, getPos, Math.min(0.55, bottomBand() / Math.max(1, view.h)));
    if (!ms) { camera.position.copy(to.p); controls.target.copy(to.t); move = null; wake(); } else flyTo(to, ms);
  }
  $("legend").addEventListener("toggle", () => { if (!cluster) frameWhole(500); }); // the KEY opened or closed: keep the tree above it
  // the proof reads it: the lowest printed label against the top of the KEY and the hint (positive = clear)
  state.bottomGap = () => { const L = state.labelsNow ? state.labelsNow() : []; const gr = graph.getBoundingClientRect(); let top = gr.height; for (const id of ["legend", "hint"]) { const el = $(id); if (el && getComputedStyle(el).display !== "none") top = Math.min(top, el.getBoundingClientRect().top - gr.top); } const low = L.reduce((m, l) => Math.max(m, l.y + l.h), 0); return { lowest_label_bottom: +low.toFixed(1), widgets_top: +top.toFixed(1), gap: +(top - low).toFixed(1), key_open: !!$("legend").open, canvas_h: Math.round(gr.height) }; };

  /* ---- labels ---- */
  const labelLayer = $("labels");
  const measure = (() => { const c = document.createElement("canvas").getContext("2d"); return (txt, px, sp) => { c.font = `${px}px ui-monospace, Menlo, monospace`; return c.measureText(txt).width + sp * txt.length; }; })();
  const SHORT = { SEC_TECH: "TECHNOLOGY", SEC_FIN: "FINANCIALS", SEC_HLTH: "HEALTH CARE", SEC_ENGY: "ENERGY", SEC_INDU: "INDUSTRIALS", SEC_STPL: "STAPLES", SEC_DISC: "DISCRETIONARY", SEC_UTIL: "UTILITIES", SEC_MATL: "MATERIALS", SEC_REIT: "REAL ESTATE", SEC_COMM: "COMMUNICATION", US_BROAD: "BROAD MARKET", US_STYLE: "STYLE · FACTOR", INTL_DEV: "INTL DEVELOPED", EM: "EMERGING", MACRO: "DOLLAR · VOL", WORLD: "THE WORLD" };
  function initLabel(n) { // every node on the tree at mount; a Hub list's root (kind "list", T7) when its podium first opens
    const top = n.kind === "index" && (n.id === "MARKET" || n.parents[0] === "MARKET");
    const kind = n.kind === "index" || n.kind === "list" ? "h" : n.kind === "cohort" ? "c" : n.kind === "fund" ? "f" : "n";
    // 2 Oct: a proposed cohort used to print "NAME ?" — the question mark is gone; its small line says "proposed, not adopted"
    const text = n.kind === "index" ? (SHORT[n.id] || n.label.toUpperCase()) : n.kind === "list" ? n.label : n.kind === "cohort" ? (n.ckind === "none" ? "NONE YET" : n.ckind === "fundset" ? n.cohort + " SET" : n.label) : n.ticker;
    n.lbl = { kind, top, text, el: null, shown: false };
    const px = kind === "h" ? (top ? 13 : 12) : kind === "f" ? 12 : 11, sp = kind === "h" ? (top ? 2.3 : 1.7) : kind === "c" ? 1.2 : 0.2;
    n.lbl.w = measure(text, px, sp) + 4; n.lbl.h = kind === "h" || kind === "c" ? 16 : 14;
    // a section's name and its OPEN 3D button (96) win every collision but THE MARKET's
    n.lbl.prio = n.kind === "index" ? (n.id === "MARKET" ? 100 : isSection(n) ? 96 : top ? 92 : 84) : n.kind === "list" ? 90 : n.kind === "cohort" ? (n.ckind === "adopted" ? 80 : n.ckind === "proposed" ? 76 : n.ckind === "fundset" ? 62 : 70) : n.kind === "fund" ? (n.role === "sector" ? 60 : n.role === "broad" ? 58 : 50) + (n.g ? 5 : 0) + (parentsCohort.has(n.id) ? 12 : 0) : 0;
  }
  nodes.forEach(initLabel);
  function labelEl(n) { if (n.lbl.el) return n.lbl.el; const d = document.createElement("div"); d.className = "lb " + n.lbl.kind + (n.lbl.top ? " top" : "") + (n.hollow ? " w" : "") + (isSection(n) ? " sec" : ""); d.textContent = n.lbl.text; d.dataset.id = n.id; if (isSection(n)) d.title = "click the name: open only this section in 3D"; labelLayer.appendChild(d); n.lbl.el = d; return d; }
  /* the small line under a heading or cohort, in words: "86 up · 40 down" (how many lines under it read up / down — the
     ▲▼ arrows Alan could not read are gone), "proposed, not adopted", "no names at home here" (a fund set whose served
     holdings all live in an adopted or proposed cohort), and in CLEAN "＋N more" = what the box folds away. */
  function sub(n) {
    const a = n.agg && n.agg.full; const parts = [];
    if (a) parts.push((n.kind === "cohort" ? `${fmtG(a.v)} · ` : "") + `<span class="up">${a.up} up</span> · <span class="dn">${a.down} down</span>`);
    if (n.kind === "cohort" && n.ckind === "proposed") parts.push("proposed, not adopted");
    if (n.kind === "cohort" && n.ckind === "fundset" && !membersOf(n).length) parts.push("no names at home here");
    if (n.kind === "cohort" && n.ckind === "none") parts.push("names no group claims yet");
    let s = parts.join(" · ");
    if (n.fold && n.fold.total && !cluster) s += (s ? "<br>" : "") + `＋${n.fold.total} more`; // not inside an area or the coil: there everything is drawn
    return s;
  }
  const foldWords = (f) => [f.names ? `${f.names} name${f.names > 1 ? "s" : ""}` : "", f.sets ? `${f.sets} empty set${f.sets > 1 ? "s" : ""}` : "", f.funds ? `${f.funds} fund${f.funds > 1 ? "s" : ""} with no reading` : "", f.waiting ? `${f.waiting} waiting` : ""].filter(Boolean).join(" · ");
  /* T6: the chip is a real button — OPEN 3D with the cube — big enough for a thumb; the section's name itself does the same */
  const CUBE = `<svg class="cube" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1 11 3.6 6 6.2 1 3.6Z"/><path d="M1 3.6 6 6.2V11L1 8.4Z"/><path d="M11 3.6 6 6.2V11l5-2.6Z"/></svg>`;
  const CHIP = `<i class="lb3d" title="open only this section in 3D (Esc, the breadcrumb or ← BACK TO THE CANVAS drops back)">${CUBE}OPEN 3D</i>`;
  labelLayer.addEventListener("click", (ev) => {
    const el = ev.target.closest(".lb"); if (!el) return; const n = state.byId.get(el.dataset.id); if (!n) return;
    const onChip = !!ev.target.closest(".lb3d"), onName = el.classList.contains("sec") && state.canvas && !cluster;
    if (!onChip && !onName) return;
    ev.stopPropagation(); state.selected = n.id; enterArea(n);
  });
  const V = new THREE.Vector3(), rects = [], boxRects = [];
  const MAXL = PHONE ? 70 : 240, PXN = PHONE ? 4.6 : 3.4, PXF = PHONE ? 2.4 : 1.6;
  function barsBelowPx(n, ppu) { const nb = bars.filter((b) => b.n === n).length; if (!nb) return n.r * ppu; const s = Math.max(1, BAR_MIN_PX / (BAR_W * ppu)); return n.r * ppu + s * ppu * (BAR_TOP + 2 * BAR_H * nb + BAR_GAP * (nb - 1)); }
  // the box a node is drawn as, in screen px (full width and height), or null where it is a ball
  function boxPx(n, ppu) {
    const b = cluster ? (cluster.coil && n !== cluster.c && n.kind === "name" ? BOX.coil : null) : boxMode() && !n.hid ? (isBig(n) ? BOX.big : BOX.small) : null;
    if (!b) return null; const s = Math.max(1, b.min / (b.w * ppu)); return { w: 2 * b.w * s * ppu, h: 2 * b.h * s * ppu };
  }
  function placeLabels() {
    const camD = camera.position.distanceTo(controls.target), cand = [];
    camera.updateMatrixWorld();
    const pool = cluster ? [cluster.c, ...cluster.members, ...cluster.nbs] : nodes;
    boxRects.length = 0;
    for (const n of pool) {
      V.copy(n.pos).applyMatrix4(camera.matrixWorldInverse); const depth = -V.z;
      if (depth <= 1) { hide(n); continue; }
      V.copy(n.pos).project(camera);
      if (V.x < -1.02 || V.x > 1.02 || V.y < -1.02 || V.y > 1.02) { hide(n); continue; } // off-screen or behind: no label (30 Sep: labels used to pile up at the edge)
      const ppu = view.scaleH / depth, rpx = n.r * ppu;
      const sx = (V.x + 1) * view.w / 2, sy = (1 - V.y) * view.h / 2;
      let stand = null, bx = null;
      if (cluster && cluster.coil && n.podium) { // T7 · a standing column: its rectangle runs from the foot to the tip (the same floors as the shader); the ticker sits at the tip
        const F = toScreen(n.podium.foot), Tt = toScreen(n.podium.tip), w = Math.max(2 * PARAMS.stand.minPx, 2 * PARAMS.stand.W * ppu), h = Math.max(PARAMS.stand.minH, Math.abs(Tt[1] - F[1]));
        stand = { x: (F[0] + Tt[0]) / 2 - w / 2, y: Math.min(F[1], Tt[1]), w, h, tip: Tt, up: n.podium.v >= 0 };
        boxRects.push({ n, x: stand.x, y: stand.y, w, h, dist: depth });
      } else if ((bx = boxPx(n, ppu))) boxRects.push({ n, x: sx - bx.w / 2, y: sy - bx.h / 2, w: bx.w, h: bx.h, dist: depth });
      let show = false, p = n.lbl.prio;
      if (n.lbl.kind === "h" || n.lbl.kind === "c") show = true;
      else if (n.lbl.kind === "f") show = (bx ? bx.w >= 38 : rpx >= PXF) || n.id === state.selected; // on a box: once the ticker fits on it
      else { show = rpx >= PXN || n.id === state.selected; p = 36 + rpx * 2.2; }
      if (n.id === state.selected) p += 300;
      if (n.hid) show = false;
      if (cluster && cluster.coil && n !== cluster.c) { show = true; p = 40 + (valueOf(n) ?? -2); } // every podium bar carries its ticker; the strongest win a collision
      if (!show) { hide(n); continue; }
      cand.push({ n, sx, sy, rpx, bx, stand, below: barsBelowPx(n, ppu), p, dist: depth / camD });
    }
    cand.sort((a, b) => b.p - a.p);
    rects.length = 0; let shown = 0;
    for (const c of cand) {
      if (shown >= MAXL) { hide(c.n); continue; }
      const n = c.n, s = (n.lbl.kind === "h" && c.rpx > 2.2 && !n.lbl.top && n.id !== "US") || (n.lbl.kind === "c" && c.rpx > 1.6) ? sub(n) : "";
      const chip = state.canvas && !cluster && isSection(n); // every section carries its OPEN 3D button on the canvas, at any zoom, on its own line under the name
      const w = Math.max(n.lbl.w, chip ? 96 : 0);
      const h = n.lbl.h + (chip ? 30 : 0) + (s ? 14 * (1 + (s.match(/<br>/g) || []).length) : 0), x = (c.stand ? c.stand.tip[0] : c.sx) - w / 2; // centred on the ball (or the column's tip), never pushed along the edge
      if (x < 0 || x + w > view.w) { hide(n); continue; } // printed whole or not at all
      // on a box the name sits ON the bar (its first line centred on the box); the sub-lines hang below; on a standing column the
      // ticker sits just past the tip (above a green one, below a red one; the other side if that is taken); else under the ball as before
      const tries = c.stand ? (c.stand.up ? [c.stand.tip[1] - c.sy - h - 2, c.stand.tip[1] - c.sy + 3] : [c.stand.tip[1] - c.sy + 3, c.stand.tip[1] - c.sy - h - 2])
        : c.bx ? [-n.lbl.h / 2, c.bx.h / 2 + 2] : n.lbl.kind === "h" || n.lbl.kind === "c" ? [c.below + 3, c.below + 3 + h + 2, -c.rpx - h - 3] : [c.below + 2];
      let y = null;
      for (const dy of tries) { const yy = c.sy + dy; let ok = yy >= 0 && yy + h <= view.h; for (const r of rects) if (x < r.x + r.w && x + w > r.x && yy < r.y + r.h && yy + h > r.y) { ok = false; break; } if (ok) { y = yy; break; } }
      if (y == null) { hide(n); continue; }
      rects.push({ x, y, w, h, id: n.id, nx: c.stand ? c.stand.tip[0] : c.sx, ny: c.stand ? c.stand.tip[1] : c.sy, text: n.lbl.text, onbox: !!c.bx, attip: !!c.stand }); shown++;
      const e = labelEl(n);
      const key = s + (chip ? "|3d" : "");
      if ((n.lbl.kind === "h" || n.lbl.kind === "c") && e.dataset.sub !== key) { e.innerHTML = esc(n.lbl.text) + (chip ? `<span class="chipline">${CHIP}</span>` : "") + (s ? `<small>${s}</small>` : ""); e.dataset.sub = key; }
      e.classList.toggle("onbox", !!c.bx || !!c.stand); e.classList.toggle("sel", (!!c.bx || !!c.stand) && n.id === state.selected);
      e.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      e.style.opacity = Math.max(0.45, Math.min(1, 1.6 - c.dist * 0.6)).toFixed(2);
      if (!n.lbl.shown) { e.style.display = "block"; n.lbl.shown = true; }
    }
    state.labelsShown = shown;
    state.labelsNow = () => rects.map((r) => ({ ...r }));
    state.boxes = () => boxRects.map((b) => ({ id: b.n.id, kind: b.n.kind, x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.w.toFixed(1), h: +b.h.toFixed(1), v: valueOf(b.n) }));
  }
  function hide(n) { if (n.lbl && n.lbl.shown) { n.lbl.el.style.display = "none"; n.lbl.shown = false; } }
  const _S = new THREE.Vector3();
  function toScreen(p) { _S.copy(p).project(camera); return [(_S.x + 1) * view.w / 2, (1 - _S.y) * view.h / 2]; } // a world point in canvas px (the camera's matrices are current inside placeLabels)

  /* ---- render on demand ---- */
  let running = false, still = 0, morph = null;
  function pauseAnimation() { running = false; state.paused = true; }
  function resumeAnimation() { if (!running) { running = true; state.paused = false; requestAnimationFrame(tick); } still = 0; }
  function wake() { resumeAnimation(); }
  function stepMorph(now) { if (!morph) return false; const k = ease(Math.min(1, (now - morph.t0) / morph.ms)); nodes.forEach((n) => n.pos.lerpVectors(n.from, n.to, k)); applyPositions(); if (k >= 1) morph = null; return true; }
  function tick(now) {
    if (!running) return;
    const moved = stepMove(now) | stepMorph(now) | controls.update();
    if (moved) still = 0; else still++;
    if (still < 2 || state.dirty) { const camD = camera.position.distanceTo(controls.target); scene.fog.near = camD * 0.9; scene.fog.far = camD * 3.2; ring.quaternion.copy(camera.quaternion); renderer.render(scene, camera); placeLabels(); state.frames++; state.dirty = false; }
    if (still > 30 && !move && !morph) { pauseAnimation(); state.settled = true; return; }
    requestAnimationFrame(tick);
  }
  controls.addEventListener("start", () => { graph.classList.add("dragging"); wake(); });
  controls.addEventListener("end", () => { graph.classList.remove("dragging"); wake(); });
  controls.addEventListener("change", wake);
  ["wheel", "touchstart"].forEach((ev) => renderer.domElement.addEventListener(ev, () => { move = null; wake(); }, { passive: true }));
  document.addEventListener("visibilitychange", () => { if (document.hidden) pauseAnimation(); else wake(); });

  /* ---- picking ---- */
  const ray = new THREE.Raycaster(); const mouse = new THREE.Vector2();
  let hoverN = null, downAt = null;
  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    if (boxRects.length) { // boxes and podium bars are picked by their screen rectangles (the nearest one under the pointer)
      const px = ev.clientX - r.left, py = ev.clientY - r.top; let best = null;
      for (const b of boxRects) if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h && (!best || b.dist < best.dist)) best = b;
      if (best) return best.n;
    }
    mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    if (cluster) { const h2 = ray.intersectObjects(cluster.balls, false)[0]; return h2 ? h2.object.userData.node : null; }
    const hit = ray.intersectObjects([litMesh, cohMesh, headMesh, holMesh], false)[0];
    return hit ? hit.object.userData.list[hit.instanceId] : null;
  }
  const tipEl = $("tip");
  const gHTML = (v) => `<span style="color:${v >= 0 ? "#35b06a" : "#d1483f"}">${fmtG(v)}</span>`;
  const barHTML = (v) => `<span style="display:inline-block;width:64px;height:9px;background:#1f1f1f;position:relative;vertical-align:middle;border-radius:2px"><span style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:#8c8c8c"></span><span style="position:absolute;top:1px;bottom:1px;${v >= 0 ? "left:50%" : "right:50%"};width:${(Math.min(1, Math.abs(v)) * 50).toFixed(1)}%;background:${v >= 0 ? "#35b06a" : "#d1483f"}"></span></span>`;
  const pathWords = (n) => { const out = []; let c = n; while (c.parents.length) { c = state.byId.get(c.parents[0]); out.unshift(c.ticker || (SHORT[c.id] || c.label)); } return out.join(" › "); };
  function tip(n) {
    const head = n.ticker ? `<b>${esc(n.ticker)}</b> · ${esc(n.label)}` : `<b>${esc(n.label)}</b>`;
    const fold = n.fold && n.fold.total ? `<br><span style='color:#8c8c8c'>＋${n.fold.total} more inside: ${foldWords(n.fold)} — DETAILED shows them</span>` : "";
    const words = state.wordsOf ? state.wordsOf(n) : "";
    if (n.kind === "index") return head + (words ? `<br><span style='color:#ababab'>${esc(words)}</span>` : "") + `<br><span style='color:#8c8c8c'>heading · ${kids(n.id).length} under it · click to lift it into 3D</span>` + fold;
    if (n.kind === "list") { const a = n.agg && n.agg.full; return head + (words ? `<br><span style='color:#ababab'>${esc(words)}</span>` : "") + `<br><span style='color:#8c8c8c'>the Hub's list · ${(n.listMembers || []).length} names on the tree</span>` + (a ? `<br>mean ${gHTML(a.v)} <span style='color:#8c8c8c'>· ${a.n} full · ${a.up} up · ${a.down} down</span>` : ""); } // T7
    if (n.kind === "cohort") { const a = n.agg && n.agg.full; return head + `<br><span style='color:#8c8c8c'>${{ adopted: "ADOPTED cohort", proposed: "PROPOSED cohort, not adopted", fundset: "FUND SET: the fund's served holdings no cohort claims", none: "NONE YET: names no group claims, grouped under their sector" }[n.ckind]} · ${membersOf(n).length} members${n.ckind === "adopted" && n.diff_count ? ` · ${n.diff_count} filed elsewhere on the board` : ""}</span>` + (a ? `<br>mean ${gHTML(a.v)} <span style='color:#8c8c8c'>· ${a.n} full · ${a.up} up · ${a.down} down</span>` : "") + fold; }
    const rd = readingOf(n); let s = head;
    if (rd) s += `<br>${barHTML(rd.v)} Geiger ${gHTML(rd.v)} <span style='color:#8c8c8c'>${rd.kind === "scout" ? "· SCOUT" : ""}</span>`; else s += "<br><span style='color:#8c8c8c'>waiting: no reading yet</span>";
    if (n.kind === "fund" && n.agg) s += `<br>holdings ${gHTML(n.agg.value)} <span style='color:#8c8c8c'>· ${n.agg.count} names = ${Math.round(n.agg.coverage_pct)}% of the fund</span>`;
    if (n.kind === "name") { const ind = state.industryOf ? state.industryOf(n.ticker) : null; if (ind && (ind.fmp_industry || ind.sic_code)) s += `<br><span style='color:#8c8c8c'>${esc(ind.fmp_industry || "industry —")}${ind.sic_code ? " · SIC " + esc(ind.sic_code) : ""}</span>`; } // T6: no disagreement note (Alan: "that's our job")
    if (n.kind === "name" && (cluster && cluster.coil)) s += `<br><span style='color:#8c8c8c'>${esc(pathWords(n))}</span>`;
    if (n.kind === "name" && n.differs) s += `<br><span style='color:#8c8c8c'>board tab today: ${esc(String(n.board_cohort || "—").replace(/_/g, " "))}</span>`;
    return s + fold;
  }
  renderer.domElement.addEventListener("pointermove", (ev) => {
    if (downAt) return; const n = pick(ev);
    if (n !== hoverN) { hoverN = n; graph.style.cursor = n ? "pointer" : ""; }
    if (n) { tipEl.innerHTML = tip(n); tipEl.style.display = "block"; const r = graph.getBoundingClientRect(); tipEl.style.left = Math.min(ev.clientX - r.left + 14, view.w - 310) + "px"; tipEl.style.top = (ev.clientY - r.top + 14) + "px"; } else tipEl.style.display = "none";
  });
  renderer.domElement.addEventListener("pointerleave", () => { tipEl.style.display = "none"; hoverN = null; });
  renderer.domElement.addEventListener("pointerdown", (ev) => { downAt = { x: ev.clientX, y: ev.clientY, t: performance.now() }; tipEl.style.display = "none"; });
  addEventListener("pointerup", (ev) => {
    if (!downAt) return; const d = downAt; downAt = null;
    if (Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 6 || performance.now() - d.t > 600) return;
    const n = pick(ev); if (!n) return;
    if (cluster && cluster.coil && n.kind === "name" && onTree) { onTree(n); return; } // a podium bar: that name on the tree (T6)
    if (n.id === state.selected && !state.canvas) { release(); onRelease(); } else { onSelect(n); select(n, true, true); }
  });
  // Esc must work the moment an area opens, even in an installed-app window where nothing had keyboard focus: the canvas takes it
  function focusCanvas() { const c = renderer.domElement; if (!c.hasAttribute("tabindex")) c.setAttribute("tabindex", "-1"); try { c.focus({ preventScroll: true }); } catch {} } // the attribute, not the property: a canvas reports -1 while still unfocusable

  /* ---- selection ---- */
  let beforePick = null;
  function drawSelection(n) {
    ring.position.copy(n.pos); ring.scale.setScalar(n.r + 2.2);
    const mine = links.filter((l) => l.s === n || l.t === n).slice(0, 64), a = selGeo.attributes.position.array;
    mine.forEach((l, i) => a.set([l.s.pos.x, l.s.pos.y, l.s.pos.z, l.t.pos.x, l.t.pos.y, l.t.pos.z], i * 6));
    selGeo.attributes.position.needsUpdate = true; selGeo.setDrawRange(0, mine.length * 2);
  }
  const ringOk = () => !boxMode() || (cluster && !cluster.coil); // on a box the selection is the box's outline, not a ring
  function select(n, fly = true, lift = false) { // lift: a click on the canvas lifts a branch into 3D; the finder and the card only fly there
    if (cluster) { state.selected = n.id; ring.visible = ringOk(); drawSelection(n); state.dirty = true; wake(); return; }
    if (state.canvas && lift && isBranch(n)) { state.selected = n.id; onSelect(n); if (coilWorthy(n)) enterCoil(n); else enterArea(n); return; }
    if (!beforePick) beforePick = { p: camera.position.clone(), t: controls.target.clone() };
    state.selected = n.id; ring.visible = ringOk(); drawSelection(n);
    if (fly) {
      const dir = state.canvas ? DIR2.clone() : camera.position.clone().sub(controls.target).normalize();
      if (isBranch(n)) flyTo(framing(subtree(n), dir, 0.82), 1000);
      else { const d = n.kind === "fund" ? 240 : 170 + n.r * 8; flyTo({ p: n.pos.clone().add(dir.multiplyScalar(d)), t: n.pos.clone() }, 900); }
    }
    state.dirty = true; wake();
  }
  function release(fly = true) {
    ring.visible = false; selGeo.setDrawRange(0, 0); tipEl.style.display = "none";
    if (fly && beforePick) flyTo(beforePick, 800);
    beforePick = null; state.dirty = true; wake();
  }
  function setFlat(on, ms = 800) {
    state.flat = on; $("flat").classList.toggle("on", on);
    nodes.forEach((n) => n.from.copy(n.pos));
    layout(on ? 0 : 1, (n, x, y, z) => n.to.set(x, y, z));
    release(false); frameWhole(ms, (n) => n.to);
    if (ms) morph = { t0: performance.now(), ms }; else { nodes.forEach((n) => n.pos.copy(n.to)); applyPositions(); }
    wake();
  }
  /* ---- AREA (1 Oct, T3): click an area on the canvas and it becomes 3D. A sector, a fund that parents cohorts, or a cohort
     lifts into the 3D view of just that subtree — its own balls, bars, labels and lines, placed by the tree's own 3D layout —
     plus, for every name in it, a faint line to each other cohort or fund set the name is also in (its "also in"; the funds
     that hold it stay on the card). Whole-tree objects are hidden meanwhile; the involved nodes borrow area positions and get
     their canvas positions back on exit. (T2's CLUSTER was the cohort-only case of this.) ---- */
  let cluster = null;
  const saved = new Map();
  const sph = new THREE.SphereGeometry(1, 16, 11);
  function subtreeOf(root) {
    const out = []; const seen = new Set();
    (function walk(id) { for (const c of primaryKids(id)) { if (seen.has(c.id)) continue; seen.add(c.id); out.push(c); walk(c.id); if (c.kind === "cohort") for (const m of membersOf(c)) if (!seen.has(m.id)) { seen.add(m.id); out.push(m); } } })(root.id);
    if (root.kind === "cohort") for (const m of membersOf(root)) if (!seen.has(m.id)) { seen.add(m.id); out.push(m); }
    return out;
  }
  function enterCluster(root) {
    exitCluster(false);
    const sub = subtreeOf(root), inSub = new Set([root.id, ...sub.map((n) => n.id)]);
    const names = sub.filter((n) => n.kind === "name");
    const nbIds = new Set();
    for (const m of names) for (const a of m.also_in || []) if (!inSub.has(a.id)) nbIds.add(a.id);
    // cohorts first (where else it is filed), fund sets next; at most 30 so the ring stays readable
    // the ring runs green → red by the neighbour's reading (2 Oct), no reading last; at most 30 so it stays readable
    const nbs = [...nbIds].map((id) => state.byId.get(id)).filter(Boolean).sort((a, b) => { const av = valueOf(a), bv = valueOf(b); if (av == null && bv == null) return 0; if (av == null) return 1; if (bv == null) return -1; return bv - av || (a.label < b.label ? -1 : 1); }).slice(0, 30);
    // the subtree in its own 3D arrangement: the tree's 3D layout, re-centred on the area's root
    const L3 = state.layoutOf(1), o = L3[root.id];
    const put = (n, x, y, z) => { if (!saved.has(n.id)) saved.set(n.id, n.pos.clone()); n.pos.set(x, y, z); };
    put(root, 0, 0, 0);
    for (const n of sub) { const p = L3[n.id] || o; put(n, p[0] - o[0], p[1] - o[1], p[2] - o[2]); }
    let rad = 40; for (const n of sub) rad = Math.max(rad, Math.hypot(n.pos.x, n.pos.z));
    const depth = sub.reduce((m, n) => Math.min(m, n.pos.y), 0);
    nbs.forEach((nb, i) => { const a = (i / nbs.length) * Math.PI * 2, r = rad + 70; put(nb, r * Math.cos(a), depth - 30, r * Math.sin(a)); });
    const group = new THREE.Group();
    const colOf = (n) => n.kind === "index" ? HEADING : n.kind === "cohort" ? COHORT : n.g || n.sg ? LIT : HOLLOW;
    const mkBall = (n, op = 1) => { const b = new THREE.Mesh(sph, new THREE.MeshLambertMaterial({ color: colOf(n), transparent: op < 1, opacity: op })); b.position.copy(n.pos); b.scale.setScalar(n.r); b.userData.node = n; group.add(b); return b; };
    const balls = [root, ...sub].map((n) => mkBall(n)); nbs.forEach((nb) => balls.push(mkBall(nb, 0.35)));
    // bars: the same ones the whole tree draws, for the nodes in the area (own full / scout, holdings blend, cohort and heading means)
    const cb = bars.filter((b) => inSub.has(b.n.id));
    if (cb.length) { const bm = new THREE.Mesh(barGeometry(cb), areaBarMat); bm.frustumCulled = false; bm.renderOrder = 3; group.add(bm); }
    // lines: the tree's own edges inside the area (parent → child, cohort → member), and the faint "also in" links
    const segs = [], cols = [], C1 = new THREE.Color(0x3c3c3c), C2 = new THREE.Color(0x262626);
    const push = (a, b, C) => { segs.push(a.pos.x, a.pos.y, a.pos.z, b.pos.x, b.pos.y, b.pos.z); cols.push(C.r, C.g, C.b, C.r, C.g, C.b); };
    for (const n of sub) { const p = state.byId.get(n.parents[0]); if (p && inSub.has(p.id)) push(p, n, C1); }
    for (const n of sub) if (n.kind === "cohort") for (const m of membersOf(n)) if (m.kind === "fund" && inSub.has(m.id)) push(n, m, C1);
    if (root.kind === "cohort") for (const m of membersOf(root)) if (m.kind === "fund") push(root, m, C1);
    const nbPos = new Set(nbs.map((nb) => nb.id));
    for (const m of names) for (const a of m.also_in || []) if (nbPos.has(a.id)) push(m, state.byId.get(a.id), C2);
    const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(segs), 3)); lg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(cols), 3));
    group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 })));
    scene.add(group);
    showWhole(false);
    cluster = { c: root, group, balls, members: sub, nbs, before: { p: camera.position.clone(), t: controls.target.clone() }, rotate: controls.enableRotate };
    controls.enableRotate = true; // orbit is allowed inside an area, whatever the canvas allows
    state.cluster = root.id; state.clusterCount = { members: sub.length, names: names.length, neighbours: nbs.length };
    nodes.forEach(hide);
    focusCanvas();
    flyTo(framing([root, ...sub, ...nbs], DIR3, 0.8), 900);
    state.dirty = true; wake();
    if (onArea) onArea(root);
  }
  const enterArea = enterCluster;
  /* ---- the COIL = the PODIUM (2 Oct, Alan: "Think Mario Kart: number one on top, number two a little lower… the HEIGHT of
     the Geiger is what gives the height: the top position is in the middle at the peak, and then they coil down and
     outwards. It's not nodes, it's Geigers, in 3D, coiling"). One spiral, not two snakes. Every name is its Geiger BAR
     (colour and fill = its reading, the same bar as everywhere on the tree), standing on a spiral that starts at the
     centre-top with the highest reading and winds down and outwards as the readings fall: rank sets the place along the
     spiral (an even step of arc, so the bars never crowd), the reading sets the height (×H). The lowest readings end at the
     outer bottom; names with no reading follow them as empty tracks a step lower. The zero line is the ring at height 0
     where the bars turn from green to red. Ticker on every bar; hover = the full bar and the path; click = that name on the
     tree. Opened by a cohort of more than 24 names, or from the card of any parent. ---- */
  const COIL_MIN = 24;
  function beneathNames(root) { const out = []; const seen = new Set(); (function walk(id) { for (const c of primaryKids(id)) { if (c.kind === "name" && !seen.has(c.id)) { seen.add(c.id); out.push(c); } walk(c.id); if (c.kind === "cohort") for (const m of membersOf(c)) if (m.kind === "name" && !seen.has(m.id)) { seen.add(m.id); out.push(m); } } })(root.id); if (root.kind === "cohort") for (const m of membersOf(root)) if (m.kind === "name" && !seen.has(m.id)) { seen.add(m.id); out.push(m); } return out; }
  const coilWorthy = (n) => n.kind === "cohort" && beneathNames(n).length > COIL_MIN;
  const UPC = new THREE.Color(0x35b06a), DNC = new THREE.Color(0xd1483f), GREYC = new THREE.Color(0x4a4a4a);
  /* T7 (2 Oct, evening — Alan: the podium "standing up in 3D"). Two pictures of the same podium, state.podium:
       "3d" = PODIUM 3D, the default when a podium opens: every name is a STANDING Geiger column on a spiral RAMP — the first
         place at the centre, highest; each next one a step lower (STEP) and a step further out, coiling down and outwards;
         the last alone at the outer bottom. The column's height is the reading: green rising above the ramp for a positive
         one, red hanging below it for a negative one — the ramp itself is the zero line. The ramp is a stepped ribbon, one
         flat tread per place, like a podium's steps.
       "above" = FROM ABOVE, T6's picture: the same spiral seen from above the front, every name a flat Hub bar at the height
         of its reading, the grey ring the zero line.
     Spacing: T6 measured 62 touching pairs at 1680 in the flat middle turns — the turn pitch (2πB = 63 units) was narrower
     than the 54 px bar at that zoom. Each picture now has its own inner radius A, turn pitch B (one turn = 2πB apart) and
     step along the spiral D, set so no two bars touch at 1680 wide for Technology (113 names); ?pa= ?pb= ?pd= (above) and
     ?sa= ?sb= ?sd= ?ss= ?sel= ?saz= (standing: the ramp's step, the camera's elevation and azimuth in degrees) let the
     proof tune them, and __mm.podiumTune(…) re-enters in place and counts the touching pairs. */
  const PODIUM = { H: 260, A: 40, B: 10, D: 86 }; // T6's numbers, the record: height per unit of reading · inner radius · radius per radian · arc between bars
  const qn = (k, d) => (Q.has(k) && Number.isFinite(+Q.get(k)) ? +Q.get(k) : d);
  /* the settings below are the measured ones (2 Oct, 1680 × 1000 at device scale 2, Technology's 113 names, headless):
     standing — camera 70° up, pitch 2π·23 = 145 units, 96 units between places, one turn 16 lower: 0 of 113 columns touch another, all 113 tickers printed;
     from above — camera 66° up (T6 looked from 42°), pitch 2π·34 = 214, 112 between bars: 0 of 113 bars touch, 112 tickers printed.
     Lower cameras were tried (30°–62° standing, 42°–60° from above) and always left touching pairs: a column's screen height must stay
     shorter than the screen distance between one turn and the next, and only a high camera and a wide pitch give that. */
  const PARAMS = { above: { A: qn("pa", 40), B: qn("pb", 34), D: qn("pd", 112), el: qn("pel", 66), az: qn("paz", 27) },
    stand: { A: qn("sa", 60), B: qn("sb", 23), D: qn("sd", 96), STEP: qn("ss", 16), el: qn("sel", 70), az: qn("saz", 28), W: 4.5, minPx: 5, minH: 5, RW: 22 } }; // STEP = how much lower one full turn of the ramp sits (a helix: an even drop per turn, so every place is a little lower than the one before)
  const dirOf = (P) => { const el = (P.el * Math.PI) / 180, az = (P.az * Math.PI) / 180; return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize(); }; // the camera's direction from an elevation and an azimuth (degrees)
  const COIL_DIR = dirOf(PARAMS.above); // FROM ABOVE: T6 looked from (0.5, 1, 1) = 42° up, 27° round — the same by default
  const standDir = () => dirOf(PARAMS.stand);
  state.podium = Q.get("podium") === "above" ? "above" : "3d";
  const spiralP = () => (state.podium === "above" ? PARAMS.above : PARAMS.stand);
  // the place of rank i along the spiral: an Archimedean spiral r = A + Bθ walked in even steps of arc length D (s ≈ Aθ + Bθ²/2)
  const spiralAt = (i) => { const P = spiralP(), s = i * P.D, th = (-P.A + Math.sqrt(P.A * P.A + 2 * P.B * s)) / P.B; return { th, r: P.A + P.B * th }; };
  /* the standing column: one billboarded strip per name from its foot (on the ramp) to its tip (the reading above or below
     it), a fixed width in view units with a floor in px so it reads from any angle; solid green or red, a grey stub where
     there is no reading, slim for a scout reading, a lighter cap at the tip. */
  function standGeometry(list) {
    const g = new THREE.InstancedBufferGeometry(); g.copy(new THREE.PlaneGeometry(2, 2)); g.instanceCount = list.length;
    g.setAttribute("aFoot", new THREE.InstancedBufferAttribute(new Float32Array(list.flatMap((b) => b.n.podium.foot.toArray())), 3));
    g.setAttribute("aTip", new THREE.InstancedBufferAttribute(new Float32Array(list.flatMap((b) => b.n.podium.tip.toArray())), 3));
    g.setAttribute("aVal", new THREE.InstancedBufferAttribute(new Float32Array(list.map((b) => b.v)), 1));
    g.setAttribute("aKind", new THREE.InstancedBufferAttribute(new Float32Array(list.map((b) => b.kind)), 1));
    return g;
  }
  const standMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: true, depthTest: true, side: THREE.DoubleSide,
    uniforms: { uScaleH: { value: 1 }, uW: { value: PARAMS.stand.W }, uMinPx: { value: PARAMS.stand.minPx }, uMinH: { value: PARAMS.stand.minH } },
    vertexShader: `attribute vec3 aFoot; attribute vec3 aTip; attribute float aVal; attribute float aKind;
      uniform float uScaleH; uniform float uW; uniform float uMinPx; uniform float uMinH;
      varying vec2 vUv; varying float vVal; varying float vKind;
      void main(){
        vec4 f = viewMatrix * vec4(aFoot, 1.0); vec4 t = viewMatrix * vec4(aTip, 1.0); vec4 u = viewMatrix * vec4(aFoot + vec3(0.0, 1.0, 0.0), 1.0);
        float ppu = uScaleH / max(1.0, -f.z);
        vec2 up = u.xy - f.xy; up = length(up) > 1e-6 ? normalize(up) : vec2(0.0, 1.0);
        vec2 e = t.xy - f.xy; float minL = uMinH / ppu;
        if (length(e) < minL) e = up * (aVal < 0.0 ? -1.0 : 1.0) * minL;
        vec2 en = normalize(e); vec2 px = vec2(en.y, -en.x); // across the column: the column's direction turned a quarter the way that keeps the quad front-facing (turned the other way it is mirrored and culled)
        float s = max(1.0, uMinPx / (uW * ppu));
        float k = (position.y + 1.0) * 0.5;
        vec4 mv = mix(f, t, k);
        mv.xy = f.xy + e * k + px * position.x * uW * s;
        mv.z += 0.4;
        vUv = position.xy; vVal = aVal; vKind = aKind;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying vec2 vUv; varying float vVal; varying float vKind;
      void main(){
        vec3 col = vVal >= 0.0 ? vec3(0.208, 0.690, 0.416) : vec3(0.820, 0.282, 0.247);
        if (vKind > 3.5) col = vec3(0.30);
        float x = abs(vUv.x);
        if (vKind > 1.5 && vKind < 2.5 && x > 0.55) discard;
        float shade = x > 0.74 ? 0.58 : (x > 0.42 ? 0.84 : 1.0);
        if (vUv.y > 0.9) shade *= 1.18;
        gl_FragColor = vec4(col * shade, 0.96);
      }` });
  // the ramp: a stepped ribbon — one flat tread per place (RW wide across the spiral), a riser down to the next tread; lit, so the treads read as steps
  function rampMesh(members, P) {
    const pos = [], idx = [], NS = 4;
    const at = (s) => { const th = (-P.A + Math.sqrt(P.A * P.A + 2 * P.B * Math.max(0, s))) / P.B; return { th, r: P.A + P.B * th }; };
    const edge = (th, r, y) => { const c = Math.cos(th), sn = Math.sin(th); pos.push((r - P.RW / 2) * c, y, (r - P.RW / 2) * sn, (r + P.RW / 2) * c, y, (r + P.RW / 2) * sn); };
    members.forEach((n, i) => {
      const y = n.podium.ramp, base = pos.length / 3;
      for (let k = 0; k <= NS; k++) { const { th, r } = at((i - 0.5 + k / NS) * P.D); edge(th, r, y); }
      for (let k = 0; k < NS; k++) { const a = base + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      if (i + 1 < members.length) { const { th, r } = at((i + 0.5) * P.D), b2 = pos.length / 3; edge(th, r, y); edge(th, r, members[i + 1].podium.ramp); idx.push(b2, b2 + 1, b2 + 2, b2 + 1, b2 + 3, b2 + 2); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0x5a5a5a, side: THREE.DoubleSide, transparent: true, opacity: 0.95 })));
    grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 1), new THREE.LineBasicMaterial({ color: 0x6a6a6a, transparent: true, opacity: 0.5 })));
    return grp;
  }
  function initNode(n) { n.pos = new THREE.Vector3(); n.from = new THREE.Vector3(); n.to = new THREE.Vector3(); initLabel(n); } // a list root (★ FAVORITES, ♥ LIKED) lives off the tree: give it a place and a label on first use
  function enterCoil(root, mode, opts = {}) {
    exitCluster(false);
    if (mode === "above" || mode === "3d") state.podium = mode;
    const above = state.podium === "above", P = spiralP();
    if (!root.pos) initNode(root);
    const all = root.listMembers ? root.listMembers : beneathNames(root); // a Hub list carries its own members (T7); a parent's are the names under it
    const withV = all.map((n) => ({ n, v: valueOf(n) })).filter((x) => x.v != null).sort((a, b) => b.v - a.v || (a.n.ticker < b.n.ticker ? -1 : 1));
    const none = all.filter((n) => valueOf(n) == null);
    const { H } = PODIUM;
    const put = (n, x, y, z) => { if (!saved.has(n.id)) saved.set(n.id, n.pos.clone()); n.pos.set(x, y, z); };
    const members = [...withV.map((x) => x.n), ...none];
    let top, floor;
    if (above) {
      withV.forEach((x, i) => { const { th, r } = spiralAt(i); put(x.n, r * Math.cos(th), x.v * H, r * Math.sin(th)); });
      top = withV.length ? withV[0].v * H : 0; floor = withV.length ? withV[withV.length - 1].v * H : 0;
      none.forEach((n, i) => { const { th, r } = spiralAt(withV.length + i); put(n, r * Math.cos(th), floor - 18, r * Math.sin(th)); });
      members.forEach((n) => { n.podium = null; });
    } else {
      // standing: the foot on the ramp (a helix — one turn round = STEP lower, so every place sits a little lower than the one before), the tip a reading above or below it; n.pos = the column's middle (what a click lands on)
      const rampY = (th) => (-th / (2 * Math.PI)) * P.STEP;
      members.forEach((n, i) => { const { th, r } = spiralAt(i), v = i < withV.length ? withV[i].v : 0, y0 = rampY(th), x = r * Math.cos(th), z = r * Math.sin(th);
        put(n, x, y0 + (v * H) / 2, z); n.podium = { foot: new THREE.Vector3(x, y0, z), tip: new THREE.Vector3(x, y0 + v * H, z), v, i, ramp: y0, none: i >= withV.length }; });
      top = withV.length ? withV[0].v * H : 0;
      floor = members.length ? members[members.length - 1].podium.ramp + Math.min(0, withV.length ? withV[withV.length - 1].v * H : 0) : 0;
      standMat.uniforms.uW.value = P.W; standMat.uniforms.uMinPx.value = P.minPx; standMat.uniforms.uMinH.value = P.minH;
    }
    put(root, 0, top + 130, 0); // the parent sits well above the peak so its label never lands on the top bars
    const group = new THREE.Group();
    const balls = [];
    const mkBall = (n, col, r, op = 1) => { const b = new THREE.Mesh(sph, new THREE.MeshLambertMaterial({ color: col, transparent: op < 1, opacity: op })); b.position.copy(n.pos); b.scale.setScalar(r); b.userData.node = n; group.add(b); balls.push(b); return b; };
    mkBall(root, root.kind === "index" ? HEADING : COHORT, root.r); // the parent above the peak; the names are bars, picked by their rectangles
    const cb = members.map((n) => { const rd = readingOf(n); const v = rd ? rd.v : (aggBar(n) ? aggBar(n).v : null); return { n, v: v == null ? 0 : v, kind: v == null ? 4 : rd && rd.kind === "scout" ? 2 : 0, slot: 0 }; });
    if (above) { const bm = new THREE.Mesh(barGeometry(cb), coilBarMat); bm.frustumCulled = false; bm.renderOrder = 3; group.add(bm); }
    else { const sm = new THREE.Mesh(standGeometry(cb), standMat); sm.frustumCulled = false; sm.renderOrder = 3; group.add(sm); group.add(rampMesh(members, P)); }
    // FROM ABOVE: the spiral's thread through the bars, coloured by the reading; the zero ring where green turns to red; the spine
    const line = (pts, col, op = 0.55) => { if (pts.length < 2) return; const g = new THREE.BufferGeometry().setFromPoints(pts); group.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: op }))); };
    let zeroR = null;
    if (above) {
      if (withV.length > 1) {
        const g = new THREE.BufferGeometry().setFromPoints(withV.map((x) => x.n.pos.clone())), cols = [];
        for (const x of withV) { const c = GREYC.clone().lerp(x.v >= 0 ? UPC : DNC, 0.35 + 0.65 * Math.min(1, Math.abs(x.v))); cols.push(c.r, c.g, c.b); }
        g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
        group.add(new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6 })));
      }
      const flip = withV.findIndex((x) => x.v < 0);
      zeroR = flip > 0 ? spiralAt(flip - 0.5).r : flip === 0 ? P.A : spiralAt(withV.length - 0.5).r;
      const ringPts = []; for (let i = 0; i <= 96; i++) ringPts.push(new THREE.Vector3(zeroR * Math.cos((i / 96) * Math.PI * 2), 0, zeroR * Math.sin((i / 96) * Math.PI * 2)));
      line(ringPts, 0x6a6a6a, 0.7);
    }
    line([new THREE.Vector3(0, Math.min(0, floor) - 30, 0), new THREE.Vector3(0, top + 116, 0)], 0x2a2a2a); // the spine, both pictures
    scene.add(group);
    showWhole(false);
    cluster = { c: root, group, balls, members, nbs: [], before: opts.instant && cluster ? cluster.before : { p: camera.position.clone(), t: controls.target.clone() }, rotate: controls.enableRotate, coil: true };
    controls.enableRotate = true;
    const ups = withV.filter((x) => x.v >= 0), dns = withV.filter((x) => x.v < 0);
    state.cluster = root.id; state.clusterCount = { members: all.length, names: all.length, neighbours: 0, read: withV.length, up: ups.length, down: dns.length, none: none.length, top: withV.length ? withV[0].n.ticker : null, bottom: withV.length ? withV[withV.length - 1].n.ticker : null, zero_ring_r: zeroR == null ? null : +zeroR.toFixed(1), podium: state.podium, list: !!root.listMembers };
    state.coilOrder = withV.map((x) => x.n.ticker);
    // the proof reads every place: rank, reading, radius, the middle's height, and standing: the ramp's height (the foot) and the tip
    state.coilPlaces = () => members.map((n, i) => ({ t: n.ticker, i, v: i < withV.length ? +withV[i].v.toFixed(3) : null, r: +Math.hypot(n.pos.x, n.pos.z).toFixed(1), y: +n.pos.y.toFixed(1), ...(n.podium ? { ramp: +n.podium.ramp.toFixed(1), tip: +n.podium.tip.y.toFixed(1) } : {}) }));
    nodes.forEach(hide);
    focusCanvas();
    // the frame holds every foot and every tip (standing) or every bar (above); the parent's ball too
    const frameList = above ? [root, ...members] : [root, ...members, ...members.map((n) => ({ pos: n.podium.foot })), ...members.map((n) => ({ pos: n.podium.tip }))];
    const to = framing(frameList, above ? dirOf(PARAMS.above) : standDir(), 0.8);
    if (opts.instant) { camera.position.copy(to.p); controls.target.copy(to.t); move = null; } else flyTo(to, 900);
    state.dirty = true; wake();
    if (onArea) onArea(root);
  }
  // FROM ABOVE | PODIUM 3D: the other picture of the podium that is open (or the one the next podium opens in)
  function setPodium(mode) { if (mode !== "above" && mode !== "3d") return; if (cluster && cluster.coil) enterCoil(cluster.c, mode); else state.podium = mode; }
  // the proof: set a spacing in place (above: {above:1, A, B, D} · standing: {A, B, D, STEP, el, az}), re-enter without the flight, render, count the touching pairs
  state.podiumTune = (params = {}) => {
    const tgt = params.above ? PARAMS.above : PARAMS.stand; for (const k of Object.keys(params)) if (k in tgt && Number.isFinite(+params[k])) tgt[k] = +params[k];
    if (!(cluster && cluster.coil)) return null;
    enterCoil(cluster.c, state.podium, { instant: true });
    controls.update(); camera.updateMatrixWorld(); renderer.render(scene, camera); placeLabels();
    const B = state.boxes(); let ov = 0; for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) { const a = B[i], b = B[j]; if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) ov++; }
    return { params: { ...tgt }, mode: state.podium, bars: B.length, overlaps: ov, labels: state.labelsShown };
  };
  function exitCluster(fly = true) {
    if (!cluster) return;
    scene.remove(cluster.group);
    cluster.group.traverse((o) => { if (o.geometry && o.geometry !== sph) o.geometry.dispose(); });
    for (const [id, p] of saved) state.byId.get(id).pos.copy(p); saved.clear();
    applyPositions();
    controls.enableRotate = cluster.rotate;
    (cluster.members || []).forEach((n) => { n.podium = null; }); // T7: the standing columns' feet and tips go with the podium
    const b = cluster.before, c0 = cluster.c; cluster = null; state.cluster = null; nodes.forEach(hide); hide(c0); // a list root is not in nodes: hide its label too
    showWhole(true); boxRects.length = 0;
    if (fly) flyTo(b, 700); // back to the same spot and zoom
    state.dirty = true; wake();
    if (onArea) onArea(null);
  }
  /* ---- CANVAS (1 Oct): the same tree laid flat — the FLAT 2D layout, the camera straight on, rotation locked. Drag pans,
     wheel and pinch zoom toward the pointer. Nothing is boxed and nothing rotates. ---- */
  function setCanvas(on, ms = 0) {
    state.canvas = on;
    controls.enableRotate = !on; controls.zoomToCursor = on; controls.screenSpacePanning = true;
    controls.mouseButtons = { LEFT: on ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: on ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN };
    controls.touches = { ONE: on ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    if (on !== state.flat) setFlat(on, ms); else frameWhole(ms);
  }
  // the proof drives these: pan by screen pixels, zoom by a factor toward a screen point (what the wheel does)
  state.pose = () => ({ p: camera.position.toArray().map((v) => +v.toFixed(1)), t: controls.target.toArray().map((v) => +v.toFixed(1)), d: +camera.position.distanceTo(controls.target).toFixed(1), rotate: controls.enableRotate });
  state.panBy = (dx, dy) => { const d = camera.position.distanceTo(controls.target), ppu = view.scaleH / d; const v = new THREE.Vector3(-dx / ppu, dy / ppu, 0).applyQuaternion(camera.quaternion); camera.position.add(v); controls.target.add(v); state.dirty = true; wake(); };
  state.zoomAt = (sx, sy, f) => { const nd = new THREE.Vector3((sx / view.w) * 2 - 1, -(sy / view.h) * 2 + 1, 0.5).unproject(camera); const dir = nd.sub(camera.position).normalize(); const d = camera.position.distanceTo(controls.target); const hit = camera.position.clone().add(dir.multiplyScalar(d)); camera.position.lerp(hit, 1 - 1 / f); controls.target.lerp(hit, 1 - 1 / f); state.dirty = true; wake(); };
  const T_HELD = (state.tree && state.tree.held_by) || {};
  state.screenOf = (id) => { const n = state.byId.get(id); camera.updateMatrixWorld(); const v = n.pos.clone().project(camera); const r = renderer.domElement.getBoundingClientRect(); return [r.left + (v.x + 1) * r.width / 2, r.top + (1 - v.y) * r.height / 2]; };
  state.layoutOf = (k) => { const out = {}; layout(k, (n, x, y, z) => { out[n.id] = [x, y, z]; }, modes.full); layout(state.flat ? 0 : 1, () => {}); return out; }; // an area is always the DETAILED subtree
  /* ---- CLEAN | DETAILED and the order (2 Oct): the other picture of the same tree, morphed to ---- */
  function remorph(ms) {
    if (cluster) exitCluster(false);
    nodes.forEach((n) => n.from.copy(n.pos));
    layout(state.flat ? 0 : 1, (n, x, y, z) => n.to.set(x, y, z));
    release(false); nodes.forEach(hide);
    if (ms) { morph = { t0: performance.now(), ms }; frameWhole(ms, (n) => n.to); } else { nodes.forEach((n) => n.pos.copy(n.to)); applyPositions(); frameWhole(0); }
    state.dirty = true; wake();
  }
  function setDetail(mode, ms = 700) { mode = mode === "detailed" ? "detailed" : "clean"; if (mode === state.detail) return; state.detail = mode; cur = modeOf(mode); state.sectorRows = cur.rows; applyBarMode(); remorph(ms); }
  function setOrder(o, ms = 700) { o = o === "size" ? "size" : "geiger"; if (o === state.order) return; state.order = o; modes.full = buildMode("full"); modes.clean = buildMode("clean"); cur = modeOf(state.detail); state.sectorRows = cur.rows; remorph(ms); }
  state.folds = () => { const out = {}; for (const n of nodes) if (n.fold) out[n.id] = { ...n.fold }; return out; };
  state.hidden = () => nodes.filter((n) => n.hid).map((n) => n.id);
  state.shownKinds = () => { const k = {}; for (const n of nodes) if (!n.hid) { const key = n.kind + (n.ckind ? "/" + n.ckind : "") + (n.ticker && !readingOf(n) ? "/noreading" : ""); k[key] = (k[key] || 0) + 1; } return k; };
  state.sectionsWithChip = () => nodes.filter((n) => isSection(n) && !n.hid).map((n) => n.id);
  state.chipsDrawn = () => [...labelLayer.querySelectorAll(".lb .lb3d")].filter((c) => c.closest(".lb").style.display !== "none").map((c) => c.closest(".lb").dataset.id);
  state.orderOnScreen = (id) => { const h = cur.heads.find((x) => x.id === id); if (!h) return null; const row = (list) => list.map((c) => ({ id: c.id, v: c.v, x: +state.byId.get(c.id).pos.x.toFixed(1) })); return { subs: row(h.subs), funds: row(h.funds), names: row(h.names) }; };

  fit();
  if (PHONE) $("legend").removeAttribute("open");
  applyBarMode();
  frameWhole(0);
  state.canvasFocused = () => document.activeElement === renderer.domElement;
  return { select, release, setFlat, fit, frameWhole, enterCluster, exitCluster, enterArea, exitArea: exitCluster, setCanvas, inCluster: () => !!cluster, inArea: () => !!cluster, inCoil: () => !!(cluster && cluster.coil), enterCoil, coilWorthy, beneathNames, setDetail, setOrder, valueOf, focusCanvas, setPodium, podiumMode: () => state.podium };
}

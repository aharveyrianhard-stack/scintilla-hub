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
   the canvas; a cohort of more than 24 names opens into the COIL (two snakes: the greens coil up to the highest reading
   at the tip, the base near zero runs flat, the reds coil down to the most negative at the other tip). */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { prepareTree, layout as layoutTree, bestRows, LAYOUT } from "./layout.js";

export async function mount({ nodes, state, kids, primaryKids, readingOf, aggBar, membersOf, onSelect, onRelease }) {
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
  const layNode = (n) => ({ id: n.id, kind: n.kind === "cohort" || (n.kind === "fund" && parentsCohort.has(n.id)) ? "index" : n.kind, parents: n.parents, role: n.role, issuer: n.issuer, market_value_usd: n.market_value_usd, ticker: n.ticker, v: valueOf(n), name: n.label });
  // a cohort's members hang from it as its names block: give each member a primary parent of its cohort in the layout copy
  // (names already have it; member FUNDS keep their own place on the tree and are not moved)
  const shapeOf = (() => { const r = $("graph").getBoundingClientRect(); return r.width > 10 && r.height > 10 ? r.width / r.height : innerWidth / Math.max(1, innerHeight - 80); })();
  state.detail = state.detail === "detailed" ? "detailed" : "clean"; state.order = state.order === "size" ? "size" : "geiger";
  // CLEAN keeps a heading, and any cohort or fund that has a bar; it drops every name, every fund set with no names at
  // home (no bar), every waiting fund. A dropped node sits on its nearest kept ancestor, scaled to nothing, and is counted there.
  const cleanKeep = (n) => n.kind === "index" || (n.kind !== "name" && valueOf(n) != null);
  const modes = {};
  function buildMode(key) {
    const list = (key === "clean" ? nodes.filter(cleanKeep) : nodes).map(layNode);
    const ids = new Set(list.map((n) => n.id));
    const kept = list.filter((n) => !n.parents.length || ids.has(n.parents[0]));
    const opts = { order: state.order };
    const rows = bestRows(kept, shapeOf, opts);
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
  const bars = [];
  nodes.forEach((n) => {
    const rd = readingOf(n);
    const own = rd ? { v: rd.v, kind: rd.kind === "full" ? 0 : 2 } : null;
    let agg = null;
    if (n.kind === "fund") agg = n.agg ? { v: n.agg.value, kind: 1 } : null;
    else if (n.kind === "cohort" || n.kind === "index") { const ab = aggBar(n); agg = ab ? { v: ab.v, kind: ab.kind === "full" ? 1 : 3 } : null; }
    if (own) bars.push({ n, ...own, slot: 0 });
    if (agg) bars.push({ n, ...agg, slot: own ? 1 : 0 });
  });
  const barGeo = new THREE.InstancedBufferGeometry(); barGeo.copy(new THREE.PlaneGeometry(2, 2)); barGeo.instanceCount = bars.length;
  const aCenter = new THREE.InstancedBufferAttribute(new Float32Array(bars.length * 3), 3);
  barGeo.setAttribute("aCenter", aCenter);
  barGeo.setAttribute("aVal", new THREE.InstancedBufferAttribute(new Float32Array(bars.map((b) => Math.max(-1, Math.min(1, b.v)))), 1));
  barGeo.setAttribute("aKind", new THREE.InstancedBufferAttribute(new Float32Array(bars.map((b) => b.kind)), 1));
  barGeo.setAttribute("aR", new THREE.InstancedBufferAttribute(new Float32Array(bars.map((b) => b.n.r)), 1));
  barGeo.setAttribute("aTwo", new THREE.InstancedBufferAttribute(new Float32Array(bars.map((b) => b.slot)), 1));
  const barMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true,
    uniforms: { uScaleH: { value: 1 }, uW: { value: BAR_W }, uH: { value: BAR_H }, uMinPx: { value: BAR_MIN_PX }, uGap: { value: BAR_GAP }, uTop: { value: BAR_TOP } },
    vertexShader: `attribute vec3 aCenter; attribute float aVal; attribute float aKind; attribute float aR; attribute float aTwo;
      uniform float uScaleH; uniform float uW; uniform float uH; uniform float uMinPx; uniform float uGap; uniform float uTop;
      varying vec2 vUv; varying float vVal; varying float vKind;
      void main(){
        vec4 mv = viewMatrix * vec4(aCenter, 1.0);
        float ppu = uScaleH / max(1.0, -mv.z);
        float s = max(1.0, uMinPx / (uW * ppu));
        float off = aR + s * (uTop + uH + aTwo * (2.0 * uH + uGap));
        mv.xy += vec2(position.x * uW * s, position.y * uH * s - off);
        vUv = position.xy; vVal = aVal; vKind = aKind;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying vec2 vUv; varying float vVal; varying float vKind;
      void main(){
        vec3 track = vec3(0.12); vec3 col = vVal >= 0.0 ? vec3(0.208, 0.690, 0.416) : vec3(0.820, 0.282, 0.247);
        vec3 c = track; float a = 0.92; float x = vUv.x;
        float fillH = vKind > 1.5 ? 0.34 : 0.62;
        bool inFill = abs(vUv.y) < fillH && ((vVal >= 0.0 && x >= 0.0 && x <= vVal) || (vVal < 0.0 && x <= 0.0 && x >= vVal));
        if (inFill) { c = col; if ((abs(vKind - 1.0) < 0.5 || vKind > 2.5) && mod(gl_FragCoord.x + gl_FragCoord.y, 5.0) < 2.0) c = track; }
        if (abs(x) < 0.035) c = vec3(0.55);
        gl_FragColor = vec4(c, a);
      }`,
  });
  const barMesh = new THREE.Mesh(barGeo, barMat); barMesh.frustumCulled = false; barMesh.renderOrder = 3; scene.add(barMesh);

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
    view.scaleH = view.h / (2 * Math.tan((camera.fov * Math.PI) / 360)); barMat.uniforms.uScaleH.value = view.scaleH; wake();
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
  function frameWhole(ms = 0, getPos) {
    const lg = $("legend"), keyH = lg && lg.open ? lg.getBoundingClientRect().height + 14 : 0;
    const to = framing(nodes, state.flat ? DIR2 : DIR3, 0.9, getPos, Math.min(0.3, keyH / Math.max(1, view.h)));
    if (!ms) { camera.position.copy(to.p); controls.target.copy(to.t); move = null; wake(); } else flyTo(to, ms);
  }

  /* ---- labels ---- */
  const labelLayer = $("labels");
  const measure = (() => { const c = document.createElement("canvas").getContext("2d"); return (txt, px, sp) => { c.font = `${px}px ui-monospace, Menlo, monospace`; return c.measureText(txt).width + sp * txt.length; }; })();
  const SHORT = { SEC_TECH: "TECHNOLOGY", SEC_FIN: "FINANCIALS", SEC_HLTH: "HEALTH CARE", SEC_ENGY: "ENERGY", SEC_INDU: "INDUSTRIALS", SEC_STPL: "STAPLES", SEC_DISC: "DISCRETIONARY", SEC_UTIL: "UTILITIES", SEC_MATL: "MATERIALS", SEC_REIT: "REAL ESTATE", SEC_COMM: "COMMUNICATION", US_BROAD: "BROAD MARKET", US_STYLE: "STYLE · FACTOR", INTL_DEV: "INTL DEVELOPED", EM: "EMERGING", MACRO: "DOLLAR · VOL", WORLD: "THE WORLD" };
  nodes.forEach((n) => {
    const top = n.kind === "index" && (n.id === "MARKET" || n.parents[0] === "MARKET");
    const kind = n.kind === "index" ? "h" : n.kind === "cohort" ? "c" : n.kind === "fund" ? "f" : "n";
    // 2 Oct: a proposed cohort used to print "NAME ?" — the question mark is gone; its small line says "proposed, not adopted"
    const text = n.kind === "index" ? (SHORT[n.id] || n.label.toUpperCase()) : n.kind === "cohort" ? (n.ckind === "none" ? "NONE YET" : n.ckind === "fundset" ? n.cohort + " SET" : n.label) : n.ticker;
    n.lbl = { kind, top, text, el: null, shown: false };
    const px = kind === "h" ? (top ? 13 : 12) : kind === "f" ? 12 : 11, sp = kind === "h" ? (top ? 2.3 : 1.7) : kind === "c" ? 1.2 : 0.2;
    n.lbl.w = measure(text, px, sp) + 4; n.lbl.h = kind === "h" || kind === "c" ? 16 : 14;
    n.lbl.prio = n.kind === "index" ? (n.id === "MARKET" ? 100 : top ? 92 : 84) : n.kind === "cohort" ? (n.ckind === "adopted" ? 80 : n.ckind === "proposed" ? 76 : n.ckind === "fundset" ? 62 : 70) : n.kind === "fund" ? (n.role === "sector" ? 60 : n.role === "broad" ? 58 : 50) + (n.g ? 5 : 0) + (parentsCohort.has(n.id) ? 12 : 0) : 0;
  });
  function labelEl(n) { if (n.lbl.el) return n.lbl.el; const d = document.createElement("div"); d.className = "lb " + n.lbl.kind + (n.lbl.top ? " top" : "") + (n.hollow ? " w" : ""); d.textContent = n.lbl.text; d.dataset.id = n.id; labelLayer.appendChild(d); n.lbl.el = d; return d; }
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
  const CHIP = `<i class="lb3d" title="lift this section into 3D (Esc drops it back)">3D</i>`;
  labelLayer.addEventListener("click", (ev) => { const c = ev.target.closest(".lb3d"); if (!c) return; const el = c.closest(".lb"), n = el && state.byId.get(el.dataset.id); if (!n) return; ev.stopPropagation(); onSelect(n); state.selected = n.id; enterArea(n); });
  const V = new THREE.Vector3(), rects = [];
  const MAXL = PHONE ? 70 : 240, PXN = PHONE ? 4.6 : 3.4, PXF = PHONE ? 2.4 : 1.6;
  function barsBelowPx(n, ppu) { const nb = bars.filter((b) => b.n === n).length; if (!nb) return n.r * ppu; const s = Math.max(1, BAR_MIN_PX / (BAR_W * ppu)); return n.r * ppu + s * ppu * (BAR_TOP + 2 * BAR_H * nb + BAR_GAP * (nb - 1)); }
  function placeLabels() {
    const camD = camera.position.distanceTo(controls.target), cand = [];
    camera.updateMatrixWorld();
    const pool = cluster ? [cluster.c, ...cluster.members, ...cluster.nbs] : nodes;
    for (const n of pool) {
      V.copy(n.pos).applyMatrix4(camera.matrixWorldInverse); const depth = -V.z;
      if (depth <= 1) { hide(n); continue; }
      V.copy(n.pos).project(camera);
      if (V.x < -1.02 || V.x > 1.02 || V.y < -1.02 || V.y > 1.02) { hide(n); continue; } // off-screen or behind: no label (30 Sep: labels used to pile up at the edge)
      const ppu = view.scaleH / depth, rpx = n.r * ppu;
      let show = false, p = n.lbl.prio;
      if (n.lbl.kind === "h" || n.lbl.kind === "c") show = true;
      else if (n.lbl.kind === "f") show = rpx >= PXF || n.id === state.selected;
      else { show = rpx >= PXN || n.id === state.selected; p = 36 + rpx * 2.2; }
      if (n.id === state.selected) p += 300;
      if (n.hid) show = false;
      if (cluster && cluster.coil && n !== cluster.c) { show = true; p = 40 + n.r; }
      if (!show) { hide(n); continue; }
      cand.push({ n, sx: (V.x + 1) * view.w / 2, sy: (1 - V.y) * view.h / 2, rpx, below: barsBelowPx(n, ppu), p, dist: depth / camD });
    }
    cand.sort((a, b) => b.p - a.p);
    rects.length = 0; let shown = 0;
    for (const c of cand) {
      if (shown >= MAXL) { hide(c.n); continue; }
      const n = c.n, s = (n.lbl.kind === "h" && c.rpx > 2.2 && !n.lbl.top && n.id !== "US") || (n.lbl.kind === "c" && c.rpx > 1.6) ? sub(n) : "";
      const chip = state.canvas && !cluster && isSection(n); // every section carries its 3D chip on the canvas, at any zoom
      const w = n.lbl.w + (chip ? 26 : 0);
      const h = n.lbl.h + (s ? 14 * (1 + (s.match(/<br>/g) || []).length) : 0), x = c.sx - w / 2; // centred on the ball, never pushed along the edge
      if (x < 0 || x + w > view.w) { hide(n); continue; } // printed whole or not at all
      const tries = n.lbl.kind === "h" || n.lbl.kind === "c" ? [c.below + 3, c.below + 3 + h + 2, -c.rpx - h - 3] : [c.below + 2];
      let y = null;
      for (const dy of tries) { const yy = c.sy + dy; let ok = yy >= 0 && yy + h <= view.h; for (const r of rects) if (x < r.x + r.w && x + w > r.x && yy < r.y + r.h && yy + h > r.y) { ok = false; break; } if (ok) { y = yy; break; } }
      if (y == null) { hide(n); continue; }
      rects.push({ x, y, w, h, id: n.id, nx: c.sx, ny: c.sy, text: n.lbl.text }); shown++;
      const e = labelEl(n);
      const key = s + (chip ? "|3d" : "");
      if ((n.lbl.kind === "h" || n.lbl.kind === "c") && e.dataset.sub !== key) { e.innerHTML = esc(n.lbl.text) + (chip ? CHIP : "") + (s ? `<small>${s}</small>` : ""); e.dataset.sub = key; }
      e.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      e.style.opacity = Math.max(0.45, Math.min(1, 1.6 - c.dist * 0.6)).toFixed(2);
      if (!n.lbl.shown) { e.style.display = "block"; n.lbl.shown = true; }
    }
    state.labelsShown = shown;
    state.labelsNow = () => rects.map((r) => ({ ...r }));
  }
  function hide(n) { if (n.lbl && n.lbl.shown) { n.lbl.el.style.display = "none"; n.lbl.shown = false; } }

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
    if (n.kind === "cohort") { const a = n.agg && n.agg.full; return head + `<br><span style='color:#8c8c8c'>${{ adopted: "ADOPTED cohort", proposed: "PROPOSED cohort, not adopted", fundset: "FUND SET: the fund's served holdings no cohort claims", none: "NONE YET: names no group claims, grouped under their sector" }[n.ckind]} · ${membersOf(n).length} members${n.ckind === "adopted" && n.diff_count ? ` · ${n.diff_count} filed elsewhere on the board` : ""}</span>` + (a ? `<br>mean ${gHTML(a.v)} <span style='color:#8c8c8c'>· ${a.n} full · ${a.up} up · ${a.down} down</span>` : "") + fold; }
    const rd = readingOf(n); let s = head;
    if (rd) s += `<br>${barHTML(rd.v)} Geiger ${gHTML(rd.v)} <span style='color:#8c8c8c'>${rd.kind === "scout" ? "· SCOUT" : ""}</span>`; else s += "<br><span style='color:#8c8c8c'>waiting: no reading yet</span>";
    if (n.kind === "fund" && n.agg) s += `<br>holdings ${gHTML(n.agg.value)} <span style='color:#8c8c8c'>· ${n.agg.count} names = ${Math.round(n.agg.coverage_pct)}% of the fund</span>`;
    if (n.kind === "name") { const ind = state.industryOf ? state.industryOf(n.ticker) : null; if (ind && (ind.fmp_industry || ind.sic_code)) s += `<br><span style='color:#8c8c8c'>${esc(ind.fmp_industry || "industry —")}${ind.sic_code ? " · SIC " + esc(ind.sic_code) : ""}${ind.disagreement ? " · the two authorities differ" : ""}</span>`; }
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
    if (n.id === state.selected && !state.canvas) { release(); onRelease(); } else { onSelect(n); select(n, true, true); }
  });

  /* ---- selection ---- */
  let beforePick = null;
  function drawSelection(n) {
    ring.position.copy(n.pos); ring.scale.setScalar(n.r + 2.2);
    const mine = links.filter((l) => l.s === n || l.t === n).slice(0, 64), a = selGeo.attributes.position.array;
    mine.forEach((l, i) => a.set([l.s.pos.x, l.s.pos.y, l.s.pos.z, l.t.pos.x, l.t.pos.y, l.t.pos.z], i * 6));
    selGeo.attributes.position.needsUpdate = true; selGeo.setDrawRange(0, mine.length * 2);
  }
  function select(n, fly = true, lift = false) { // lift: a click on the canvas lifts a branch into 3D; the finder and the card only fly there
    if (cluster) { state.selected = n.id; ring.visible = true; drawSelection(n); state.dirty = true; wake(); return; }
    if (state.canvas && lift && isBranch(n)) { state.selected = n.id; onSelect(n); if (coilWorthy(n)) enterCoil(n); else enterArea(n); return; }
    if (!beforePick) beforePick = { p: camera.position.clone(), t: controls.target.clone() };
    state.selected = n.id; ring.visible = true; drawSelection(n);
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
    if (cb.length) {
      const g2 = new THREE.InstancedBufferGeometry(); g2.copy(new THREE.PlaneGeometry(2, 2)); g2.instanceCount = cb.length;
      g2.setAttribute("aCenter", new THREE.InstancedBufferAttribute(new Float32Array(cb.flatMap((b) => [b.n.pos.x, b.n.pos.y, b.n.pos.z])), 3));
      g2.setAttribute("aVal", new THREE.InstancedBufferAttribute(new Float32Array(cb.map((b) => Math.max(-1, Math.min(1, b.v)))), 1));
      g2.setAttribute("aKind", new THREE.InstancedBufferAttribute(new Float32Array(cb.map((b) => b.kind)), 1));
      g2.setAttribute("aR", new THREE.InstancedBufferAttribute(new Float32Array(cb.map((b) => b.n.r)), 1));
      g2.setAttribute("aTwo", new THREE.InstancedBufferAttribute(new Float32Array(cb.map((b) => b.slot)), 1));
      const bm = new THREE.Mesh(g2, barMat); bm.frustumCulled = false; bm.renderOrder = 3; group.add(bm);
    }
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
    for (const o of [litMesh, holMesh, headMesh, cohMesh, barMesh, selLines, treeLines]) o.visible = false;
    cluster = { c: root, group, balls, members: sub, nbs, before: { p: camera.position.clone(), t: controls.target.clone() }, rotate: controls.enableRotate };
    controls.enableRotate = true; // orbit is allowed inside an area, whatever the canvas allows
    state.cluster = root.id; state.clusterCount = { members: sub.length, names: names.length, neighbours: nbs.length };
    nodes.forEach(hide);
    flyTo(framing([root, ...sub, ...nbs], DIR3, 0.8), 900);
    state.dirty = true; wake();
  }
  const enterArea = enterCluster;
  /* ---- the COIL (2 Oct, Alan): a long ordered list drawn as two snakes. Every name with a reading is a bead; its height is
     its reading (×H), so the beads near zero lie flat round the base ring and the strong ones climb; the angle grows with
     the rank from the base, so the greens coil upward to the highest reading at the top tip and the reds coil downward,
     mirrored, to the most negative at the bottom tip; the radius narrows toward the tips. Colour = the reading (green up,
     red down, stronger = brighter). Names with no reading lie in a grey row under the base. Hover = the bar and the path;
     click = the name's card. Opened by a cohort of more than 24 names, or from the card of any parent. ---- */
  const COIL_MIN = 24;
  function beneathNames(root) { const out = []; const seen = new Set(); (function walk(id) { for (const c of primaryKids(id)) { if (c.kind === "name" && !seen.has(c.id)) { seen.add(c.id); out.push(c); } walk(c.id); if (c.kind === "cohort") for (const m of membersOf(c)) if (m.kind === "name" && !seen.has(m.id)) { seen.add(m.id); out.push(m); } } })(root.id); if (root.kind === "cohort") for (const m of membersOf(root)) if (m.kind === "name" && !seen.has(m.id)) { seen.add(m.id); out.push(m); } return out; }
  const coilWorthy = (n) => n.kind === "cohort" && beneathNames(n).length > COIL_MIN;
  const UPC = new THREE.Color(0x35b06a), DNC = new THREE.Color(0xd1483f), GREYC = new THREE.Color(0x4a4a4a);
  function enterCoil(root) {
    exitCluster(false);
    const all = beneathNames(root);
    const withV = all.map((n) => ({ n, v: valueOf(n) })).filter((x) => x.v != null).sort((a, b) => b.v - a.v || (a.n.ticker < b.n.ticker ? -1 : 1));
    const none = all.filter((n) => valueOf(n) == null);
    const H = 320, R = 150, STEP = (Math.PI * 2) / 11;
    const put = (n, x, y, z) => { if (!saved.has(n.id)) saved.set(n.id, n.pos.clone()); n.pos.set(x, y, z); };
    const ups = withV.filter((x) => x.v >= 0), dns = withV.filter((x) => x.v < 0);
    const place = (x, i, sign) => { const a = sign * i * STEP, r = R * (1 - 0.72 * Math.min(1, Math.abs(x.v))); put(x.n, r * Math.cos(a), x.v * H, r * Math.sin(a)); };
    ups.slice().reverse().forEach((x, i) => place(x, i, 1));   // from the base (nearest zero) up to the tip
    dns.forEach((x, i) => place(x, i, -1));                     // from the base down to the other tip, mirrored
    const top = ups.length ? ups[0].v * H : 0, bottom = dns.length ? dns[dns.length - 1].v * H : 0;
    none.forEach((n, i) => put(n, -R + (i % 24) * 13, bottom - 60 - Math.floor(i / 24) * 14, 0));
    put(root, 0, top + 70, 0);
    const group = new THREE.Group();
    const balls = [];
    const mkBall = (n, col, r, op = 1) => { const b = new THREE.Mesh(sph, new THREE.MeshLambertMaterial({ color: col, transparent: op < 1, opacity: op })); b.position.copy(n.pos); b.scale.setScalar(r); b.userData.node = n; group.add(b); balls.push(b); return b; };
    for (const x of withV) { const k = 0.3 + 0.7 * Math.min(1, Math.abs(x.v)); mkBall(x.n, GREYC.clone().lerp(x.v >= 0 ? UPC : DNC, k), 4.6); }
    for (const n of none) mkBall(n, HOLLOW, 3, 0.5);
    mkBall(root, root.kind === "index" ? HEADING : COHORT, root.r);
    // the snakes' bodies: one line through the greens base → tip, one through the reds; the base ring; the spine
    const line = (pts, col) => { if (pts.length < 2) return; const g = new THREE.BufferGeometry().setFromPoints(pts); group.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.55 }))); };
    line(ups.slice().reverse().map((x) => x.n.pos.clone()), 0x2f6f48); line(dns.map((x) => x.n.pos.clone()), 0x7a3a34);
    const ringPts = []; for (let i = 0; i <= 64; i++) ringPts.push(new THREE.Vector3(R * Math.cos((i / 64) * Math.PI * 2), 0, R * Math.sin((i / 64) * Math.PI * 2)));
    line(ringPts, 0x2a2a2a); line([new THREE.Vector3(0, bottom - 20, 0), new THREE.Vector3(0, top + 50, 0)], 0x2a2a2a);
    scene.add(group);
    for (const o of [litMesh, holMesh, headMesh, cohMesh, barMesh, selLines, treeLines]) o.visible = false;
    cluster = { c: root, group, balls, members: [...withV.map((x) => x.n), ...none], nbs: [], before: { p: camera.position.clone(), t: controls.target.clone() }, rotate: controls.enableRotate, coil: true };
    controls.enableRotate = true;
    state.cluster = root.id; state.clusterCount = { members: all.length, names: all.length, neighbours: 0, read: withV.length, up: ups.length, down: dns.length, none: none.length, top: withV.length ? withV[0].n.ticker : null, bottom: withV.length ? withV[withV.length - 1].n.ticker : null };
    state.coilOrder = withV.map((x) => x.n.ticker);
    nodes.forEach(hide);
    flyTo(framing([root, ...cluster.members], new THREE.Vector3(1, 0.28, 0.9).normalize(), 0.78), 900);
    state.dirty = true; wake();
  }
  function exitCluster(fly = true) {
    if (!cluster) return;
    scene.remove(cluster.group);
    cluster.group.traverse((o) => { if (o.geometry && o.geometry !== sph) o.geometry.dispose(); });
    for (const [id, p] of saved) state.byId.get(id).pos.copy(p); saved.clear();
    for (const o of [litMesh, holMesh, headMesh, cohMesh, barMesh, selLines, treeLines]) o.visible = true;
    applyPositions();
    controls.enableRotate = cluster.rotate;
    const b = cluster.before; cluster = null; state.cluster = null; nodes.forEach(hide);
    if (fly) flyTo(b, 700); // back to the same spot and zoom
    state.dirty = true; wake();
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
  function setDetail(mode, ms = 700) { mode = mode === "detailed" ? "detailed" : "clean"; if (mode === state.detail) return; state.detail = mode; cur = modeOf(mode); state.sectorRows = cur.rows; remorph(ms); }
  function setOrder(o, ms = 700) { o = o === "size" ? "size" : "geiger"; if (o === state.order) return; state.order = o; modes.full = buildMode("full"); modes.clean = buildMode("clean"); cur = modeOf(state.detail); state.sectorRows = cur.rows; remorph(ms); }
  state.folds = () => { const out = {}; for (const n of nodes) if (n.fold) out[n.id] = { ...n.fold }; return out; };
  state.hidden = () => nodes.filter((n) => n.hid).map((n) => n.id);
  state.shownKinds = () => { const k = {}; for (const n of nodes) if (!n.hid) { const key = n.kind + (n.ckind ? "/" + n.ckind : "") + (n.ticker && !readingOf(n) ? "/noreading" : ""); k[key] = (k[key] || 0) + 1; } return k; };
  state.sectionsWithChip = () => nodes.filter((n) => isSection(n) && !n.hid).map((n) => n.id);
  state.chipsDrawn = () => [...labelLayer.querySelectorAll(".lb .lb3d")].filter((c) => c.closest(".lb").style.display !== "none").map((c) => c.closest(".lb").dataset.id);
  state.orderOnScreen = (id) => { const h = cur.heads.find((x) => x.id === id); if (!h) return null; const row = (list) => list.map((c) => ({ id: c.id, v: c.v, x: +state.byId.get(c.id).pos.x.toFixed(1) })); return { subs: row(h.subs), funds: row(h.funds), names: row(h.names) }; };

  fit();
  if (PHONE) $("legend").removeAttribute("open");
  frameWhole(0);
  return { select, release, setFlat, fit, frameWhole, enterCluster, exitCluster, enterArea, exitArea: exitCluster, setCanvas, inCluster: () => !!cluster, inArea: () => !!cluster, inCoil: () => !!(cluster && cluster.coil), enterCoil, coilWorthy, beneathNames, setDetail, setOrder, valueOf };
}

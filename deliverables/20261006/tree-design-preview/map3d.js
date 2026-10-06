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
   Esc works; the framing keeps the bottom band (KEY, hint, the lowest label) clear.

   T8 (2 Oct, night — Alan: "the Geigers need to be way bigger… just show me the Geiger of each tradeable instrument, no
   aggregates… too much black space"). Only a TRADEABLE instrument (a fund, a company) carries a bar; a heading, a cohort or
   a Hub list carries none (the aggregate bars stay in the code behind state.showAggregates, off). CLEAN now keeps every
   company with a reading as a box = its Geiger (bigger: 96 × 30 units, a 60 × 19 px floor), the ticker printed on it in
   white, and packs the tree with its own tighter distances (layout.js {L}); a cohort is a heading over its names in both
   pictures. An opened section (OPEN 3D) is drawn the same way — boxes, no balls for tradeables. A label never sits on
   another label or on another thing's box: it moves or it is not printed. The podium is a staircase (see enterCoil). */
/* T16 (6 Oct, Alan: "the Geigers are disproportionate… coils would be better in a lot of these areas, with a clickable thing that
   expands a list… it looks ugly, the tree"). Every COHORT on the canvas is one small COIL (the coil-lab bow tie, flat): its names
   as standing bars, green up / red down, sorted green → red left to right, the length = the Geiger on ONE scale (GU world units per
   1.0, the same scale a fund's box fills by), a quiet dot for a name with no reading; its names are no longer laid out as boxes.
   Clicking a coil opens a numbered list beside it (rank · ticker · Geiger · day %); a row opens the company card. No pixel floor on
   any mark: a box or a coil is never larger than its node's slot. The pictures (CLEAN | DETAILED) both draw boxes, never balls. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { prepareTree, layout as layoutTree, bestRows, LAYOUT } from "./layout.js";

export async function mount({ nodes, state, kids, primaryKids, readingOf, aggBar, orderValue, membersOf, onSelect, onRelease, onArea, onTree, onWalk, onRow }) {
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
  const orderOf = orderValue || valueOf; // T8: a heading is ORDERED by the mean of its lines (green → red, as T5 asked) but never DRAWS it
  const SHOW_AGG = !!state.showAggregates; // T8: aggregate bars (a cohort's mean, a heading's mean, a fund's holdings blend) stay in the code, off
  // T8: a cohort is a heading over its names in BOTH pictures (T6 folded it into a leaf box carrying its mean; the mean is gone)
  const layNode = (n) => ({ id: n.id, kind: n.kind === "cohort" ? "index" : (n.kind === "fund" && parentsCohort.has(n.id)) ? "index" : n.kind, parents: n.parents, role: n.role, issuer: n.issuer, market_value_usd: n.market_value_usd, ticker: n.ticker, v: orderOf(n), name: n.label });
  // a cohort's members hang from it as its names block: give each member a primary parent of its cohort in the layout copy
  // (names already have it; member FUNDS keep their own place on the tree and are not moved)
  const shapeOf = (() => { const r = $("graph").getBoundingClientRect(); return r.width > 10 && r.height > 10 ? r.width / r.height : innerWidth / Math.max(1, innerHeight - 80); })();
  state.detail = state.detail === "detailed" ? "detailed" : "clean"; state.order = state.order === "size" ? "size" : "geiger";
  // CLEAN keeps a heading, and any cohort or fund that has a bar; it drops every name, every fund set with no names at
  // home (no bar), every waiting fund. A dropped node sits on its nearest kept ancestor, scaled to nothing, and is counted there.
  // T8: CLEAN keeps every heading and cohort (as headings) and every TRADEABLE line with a reading — funds and companies —
  // and drops only what has no reading (folded on its heading as "＋N waiting")
  const cleanKeep = (n) => n.kind === "index" || n.kind === "cohort" || valueOf(n) != null;
  const inCoil = (n) => n.kind === "name" && (state.byId.get(n.parents[0]) || {}).kind === "cohort"; // T16: a cohort's names live in its coil, never as boxes on the canvas
  // T8: CLEAN's distances — a box is 96 × 30 units; columns 104 apart, rows 36, so siblings sit close; the levels of the
  // tree sit 70 apart (DETAILED: 120), wrapped rows 110 (was 110 + 36 px of label). (?sp= ?row= ?minw= ?gap= ?level= ?drop= ?rowgap= tune them.)
  const Q = new URLSearchParams(location.search);
  const qn = (k, d) => (Q.has(k) && Number.isFinite(+Q.get(k)) ? +Q.get(k) : d);
  const CLEAN_SP = qn("sp", 80), CLEAN_ROW = qn("row", 28), CLEAN_MINW = qn("minw", 120); // T16: the boxes are 68 × 18 units (T8: 96 × 30), the columns 80 apart (was 104), the rows 28 (was 36)
  const CLEAN_L = { GAP: qn("gap", 28), LEVEL: qn("level", 96), NAMES_DROP: qn("drop", 50), ROWGAP: qn("rowgap", 130) }; // T16: the levels 96 apart (was 70) and the wrapped rows 130 (was 110): room for a coil (one GU up, one down) and its title under every heading // T9 tried 18 / 56 / 42 / 84: the zoom-out is bound by the tree's WIDTH, so it bought no black back and put 4 fund-set captions on boxes — T8's distances stay
  const boxMode = () => true; // T16: both pictures draw boxes (CLEAN = the lines with a reading; DETAILED adds the ones without, as quiet dots); the balls are gone
  const modes = {};
  function buildMode(key) {
    const list = (key === "clean" ? nodes.filter(cleanKeep) : nodes).filter((n) => !inCoil(n)).map((n) => layNode(n)); // T16
    const ids = new Set(list.map((n) => n.id));
    const kept = list.filter((n) => !n.parents.length || ids.has(n.parents[0]));
    const opts = key === "clean" ? { order: state.order, sp: CLEAN_SP, row: CLEAN_ROW, minW: CLEAN_MINW, wrapMin: qn("wrap", 2), L: CLEAN_L } : { order: state.order };
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
  const BOX = { small: { w: 34, h: 9, min: 0 }, big: { w: 34, h: 9, min: 0 }, coil: { w: 15, h: 3.75, min: 22 } }; // T16: a tradeable's box is 48 × 14 world units and has NO pixel floor (68 × 18 units; T8: 96 × 30 with a 60 px floor — at the zoom-out every box grew past its slot and over its neighbours: "disproportionate"); a mark is never larger than its node
  const GU = BOX.small.w; // T16 · ONE Geiger scale on the canvas: 34 world units per 1.0 of reading — a box fills GU × |v| from its centre line, a coil's bar stands GU × |v| tall // T8: a tradeable's box 96 × 30 units, a 60 × 19 px floor (T6: 84 × 28, 21 × 7 px) — the bar is the biggest thing on the screen
  const bars = [];
  nodes.forEach((n) => {
    const rd = readingOf(n);
    const own = rd ? { v: rd.v, kind: rd.kind === "full" ? 0 : 2 } : null;
    let agg = null;
    if (n.kind === "fund") agg = n.agg ? { v: n.agg.value, kind: 1 } : null;
    else if (n.kind === "cohort" || n.kind === "index") { const ab = aggBar(n); agg = ab ? { v: ab.v, kind: ab.kind === "full" ? 1 : 3 } : null; }
    if (own) bars.push({ n, ...own, slot: 0 });
    if (agg && SHOW_AGG) bars.push({ n, ...agg, slot: own ? 1 : 0 }); // T8: off — a heading, a cohort, a fund's blend carry no bar of their own
    if (!own && !(agg && SHOW_AGG) && n.ticker) bars.push({ n, v: 0, kind: 4, slot: 0 }); // a tradeable with no reading at all: the empty track, never nothing (T6)
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
        if (vKind > 3.5) { if (abs(x) > 0.09 || abs(vUv.y) > 0.3) discard; c = vec3(0.42); } // T16: no reading = a quiet dot, not an empty track (and never a question mark)
        gl_FragColor = vec4(c, a);
      }`,
  });
  const barMat = mkBarMat({ w: BAR_W, h: BAR_H, min: BAR_MIN_PX });                     // the whole tree: DETAILED look until applyBarMode says otherwise
  const areaBarMat = mkBarMat({ w: BOX.small.w, h: BOX.small.h, min: BOX.small.min, box: 1, center: 1 }); // T8: an opened section draws boxes too (T6: balls with small bars under them)
  const barMesh = new THREE.Mesh(barGeo, barMat); barMesh.frustumCulled = false; barMesh.renderOrder = 3; scene.add(barMesh);
  const ballMeshes = [litMesh, holMesh, headMesh, cohMesh];
  /* ---- T16 · the COILS: every cohort as one small bow tie on the canvas. Its names with a reading stand as bars, green → red
     left to right, each GU × |v| tall above (green) or below (red) the cohort's zero line; the names with no reading follow as
     quiet dots on the line. The bar width shrinks so the whole coil never passes COIL.maxW (= one box's width × 2): a coil of 3
     is 21 units wide, a coil of 31 is 48. One instanced mesh for all of them; the places follow the nodes in applyPositions. ---- */
  const COIL = { bw: 8, maxW: 2 * BOX.small.w, dot: 2.6, line: 0.6 };
  const cohorts = nodes.filter((n) => n.kind === "cohort");
  const normColor = (hex) => new THREE.Color(hex).convertSRGBToLinear();
  let coilSlots = 0;
  for (const c of cohorts) {
    const ms = membersOf(c).filter((m) => m.kind === "name");
    const read = ms.map((m) => ({ n: m, v: valueOf(m) })).filter((x) => x.v != null).sort((a, b) => b.v - a.v || (a.n.ticker < b.n.ticker ? -1 : 1));
    const none = ms.filter((m) => valueOf(m) == null).sort((a, b) => (a.ticker < b.ticker ? -1 : 1));
    const k = read.length + none.length;
    if (!k) { c.coil = null; continue; }
    const bw = Math.min(COIL.bw, COIL.maxW / k);
    c.coil = { k, bw, W: k * bw, read: read.length, none: none.length, slots: [...read, ...none.map((n) => ({ n, v: null }))] };
    coilSlots += k + 1;
  }
  const coilMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), Math.max(1, coilSlots));
  coilMesh.count = coilSlots; coilMesh.frustumCulled = false; coilMesh.renderOrder = 4; scene.add(coilMesh);
  { let i = 0; const C = new THREE.Color();
    for (const c of cohorts) { if (!c.coil) continue; for (const s of c.coil.slots) coilMesh.setColorAt(i++, s.v == null ? C.setHex(0x6a6a6a) : s.v >= 0 ? C.setHex(0x35b06a) : C.setHex(0xd1483f)); coilMesh.setColorAt(i++, C.setHex(0x5a5a5a)); }
    if (coilMesh.instanceColor) coilMesh.instanceColor.needsUpdate = true; }
  function placeCoils() {
    let i = 0;
    for (const c of cohorts) { if (!c.coil) continue; const { slots, bw, W } = c.coil, far = c.hid ? 1e6 : 0, x0 = c.pos.x - W / 2;
      slots.forEach((s, j) => { const h = s.v == null ? COIL.dot : Math.max(COIL.line, Math.abs(s.v) * GU), y = s.v == null ? c.pos.y : c.pos.y + (s.v >= 0 ? 1 : -1) * h / 2;
        M.makeScale(bw * 0.72, h, 1.2).setPosition(far + x0 + (j + 0.5) * bw, y, c.pos.z + 0.8); coilMesh.setMatrixAt(i++, M); });
      M.makeScale(W + 2, COIL.line, 1).setPosition(far + c.pos.x, c.pos.y, c.pos.z + 0.6); coilMesh.setMatrixAt(i++, M); }
    coilMesh.instanceMatrix.needsUpdate = true;
  }
  state.coils = () => cohorts.filter((c) => c.coil && !c.hid).map((c) => ({ id: c.id, k: c.coil.k, read: c.coil.read, none: c.coil.none, W: +c.coil.W.toFixed(1), bw: +c.coil.bw.toFixed(2), top: c.coil.slots[0] ? c.coil.slots[0].n.ticker : null }));
  state.scale = () => ({ GU, box: { w: 2 * BOX.small.w, h: 2 * BOX.small.h, floor_px: BOX.small.min }, coil: COIL, rule: "a box fills GU × |v| from its centre; a coil bar stands GU × |v| tall; no pixel floor" });
  function applyBarMode() { // CLEAN = boxes: the bars grow to their box sizes, centre on the nodes, and the balls go
    const on = boxMode();
    const u = barMat.uniforms; u.uBox.value = on ? 1 : 0; u.uCenter.value = on ? 1 : 0;
    u.uW.value = on ? BOX.small.w : BAR_W; u.uH.value = on ? BOX.small.h : BAR_H; u.uMinPx.value = on ? BOX.small.min : BAR_MIN_PX;
    u.uWBig.value = on ? BOX.big.w : BAR_W; u.uHBig.value = on ? BOX.big.h : BAR_H; u.uMinPxBig.value = on ? BOX.big.min : BAR_MIN_PX;
    ballMeshes.forEach((m) => { m.visible = !on && !cluster; });
    state.boxMode = on; state.dirty = true;
  }
  const showWhole = (on) => { for (const o of [barMesh, selLines, treeLines, coilMesh]) o.visible = on; ballMeshes.forEach((m) => { m.visible = on && !boxMode(); }); }; // T16: the coils go with the whole tree (an opened section shows them again, see enterCluster)

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
    placeCoils(); // T16
    const a = lineGeo.attributes.position.array;
    treeLinks.forEach((l, i) => a.set(l.t.hid ? [l.s.pos.x, l.s.pos.y, l.s.pos.z, l.s.pos.x, l.s.pos.y, l.s.pos.z] : hangs(l) ? [l.t.pos.x, l.t.pos.y + RAIL, l.t.pos.z, l.t.pos.x, l.t.pos.y, l.t.pos.z] : [l.s.pos.x, l.s.pos.y, l.s.pos.z, l.t.pos.x, l.t.pos.y, l.t.pos.z], i * 6));
    a.fill(0, treeLinks.length * 6, lineCount * 6); // trays and rails of the mode not on the screen stay empty
    cur.trayHeads.forEach((h, j) => {
      const hp = P(h.id), f = P(h.names[0].id), last = P((h.names[(h.nRows - 1) * h.cols] || h.names[h.names.length - 1]).id);
      const pad = (h.rowStep || LAYOUT.ROW2) / 2 + 2, x0 = h.bx0 - 4, x1 = h.bx0 + h.leafW + 4, top = f.y + pad, bot = last.y - pad, z0 = f.z - 6, z1 = last.z + 10; // T8: the frame clears the boxes
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
    if (state.ext) state.ext.positions(); // T15: the connections follow every node move (morph, FLAT, CLEAN | DETAILED)
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
    view.scaleH = view.h / (2 * Math.tan((camera.fov * Math.PI) / 360)); for (const m of [barMat, areaBarMat]) m.uniforms.uScaleH.value = view.scaleH; wake();
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
  const LABEL_DEPTH = 40; // T9: was 56 — the band under the lowest label was a fifth of the canvas of black
  function bottomBand() {
    const gr = graph.getBoundingClientRect(); let top = gr.bottom;
    for (const id of ["legend", "hint"]) { const el = $(id); if (el && getComputedStyle(el).display !== "none") top = Math.min(top, el.getBoundingClientRect().top); }
    return Math.max(0, gr.bottom - top) + 10 + LABEL_DEPTH;
  }
  function frameWhole(ms = 0, getPos) {
    const to = framing(nodes, state.flat ? DIR2 : DIR3, 0.94, getPos, Math.min(0.55, bottomBand() / Math.max(1, view.h))); // T9: fill 0.94 (was 0.9)
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
    // T8: a tradeable's ticker is large and white on its box (15 px; 12 on a phone); the titles keep their style
    const px = kind === "h" ? (top ? 13 : 12) : kind === "c" ? 11 : PHONE ? 12 : 15, sp = kind === "h" ? (top ? 2.3 : 1.7) : kind === "c" ? 1.2 : 0.6;
    n.lbl.w = measure(text, px, sp) + 4; n.lbl.h = kind === "h" || kind === "c" ? 16 : PHONE ? 15 : 18;
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
    if (a) parts.push(`<span class="up">${a.up} up</span> · <span class="dn">${a.down} down</span>`); // T8: the counts stay; the mean (an aggregate) is gone
    if (n.kind === "cohort" && n.ckind === "proposed") parts.push("proposed, not adopted");
    if (n.kind === "cohort" && n.ckind === "fundset" && !membersOf(n).length) parts.push("no names at home here");
    if (n.kind === "cohort" && n.ckind === "none") parts.push("names no group claims yet");
    let s = parts.join(" · ");
    if (n.fold && n.fold.total && !cluster && n.kind !== "cohort") s += (s ? "<br>" : "") + `＋${n.fold.total} more`; // not inside an area or the coil: there everything is drawn (T16: a cohort's names are its coil, not a fold)
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
  function boxPx(n, ppu) { // T8: only a tradeable has a box (CLEAN, and inside an opened section); the podium's steps have their own rectangles
    if (n.kind === "cohort" && n.coil && !n.hid && !(cluster && cluster.coil)) return { w: Math.max(n.coil.W + 2, 12) * ppu, h: 2 * GU * ppu, coil: true }; // T16: a coil's rectangle — one GU up, one GU down
    const b = cluster ? (cluster.coil || !n.ticker ? null : BOX.small) : boxMode() && !n.hid && n.ticker ? BOX.small : null;
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
      if (cluster && cluster.coil && n.podium) { // T8 · a step: its rectangle runs from the floor to the tread, one tread wide; the ticker sits above the tread
        const F = toScreen(n.podium.foot), Tt = toScreen(n.podium.tip), w = Math.max(6, PARAMS.stand.D * ppu), h = Math.max(4, Math.abs(Tt[1] - F[1]));
        stand = { x: (F[0] + Tt[0]) / 2 - w / 2, y: Math.min(F[1], Tt[1]), w, h, tip: Tt, up: n.podium.v >= 0 };
        boxRects.push({ n, x: stand.x, y: stand.y, w, h, dist: depth });
      } else if ((bx = boxPx(n, ppu))) boxRects.push({ n, x: sx - bx.w / 2, y: sy - bx.h / 2, w: bx.w, h: bx.h, dist: depth });
      let show = false, p = n.lbl.prio;
      if (n.lbl.kind === "h" || n.lbl.kind === "c") show = true;
      else if (bx) { show = bx.w >= n.lbl.w - 6 || n.id === state.selected; p = (n.lbl.kind === "f" ? 50 : 30) + bx.w; } // T8: on a box, once the ticker fits on it (fund or company alike)
      else if (n.lbl.kind === "f") show = rpx >= PXF || n.id === state.selected;
      else { show = rpx >= PXN || n.id === state.selected; p = 36 + rpx * 2.2; }
      if (n.id === state.selected) p += 300;
      if (n.hid) show = false;
      if (cluster && cluster.coil && n !== cluster.c) { show = true; p = 40 + (valueOf(n) ?? -2); } // every podium bar carries its ticker; the strongest win a collision
      if (!show) { hide(n); continue; }
      cand.push({ n, sx, sy, rpx, bx, stand, below: barsBelowPx(n, ppu), p, dist: depth / camD });
    }
    cand.sort((a, b) => b.p - a.p);
    rects.length = 0; let shown = 0;
    placeList(); // T16: the open list sits beside its coil and the labels keep off it
    for (const c of cand) {
      if (shown >= MAXL) { hide(c.n); continue; }
      const n = c.n, s = (n.lbl.kind === "h" && c.rpx > 2.2 && !n.lbl.top && n.id !== "US") || (n.lbl.kind === "c" && c.rpx > 1.6) ? sub(n) : "";
      const chip = state.canvas && !cluster && isSection(n); // every section carries its OPEN 3D button on the canvas, at any zoom, on its own line under the name
      const subW = s ? Math.max(...s.split("<br>").map((line) => measure(line.replace(/<[^>]+>/g, ""), 11, 0.5))) + 6 : 0; // T16: the caption's small lines count toward its width (T15 crowding: "NONE YET" and "AI DATACENTER" sat on each other because only the title was measured)
      const w = Math.max(n.lbl.w, chip ? 96 : 0, subW);
      const h = n.lbl.h + (chip ? 38 : 0) + (s ? 14 * (1 + (s.match(/<br>/g) || []).length) : 0), x = (c.stand ? c.stand.tip[0] : c.sx) - w / 2; // T16: the OPEN 3D chip line is 38 px tall as drawn (26 px button + its margins), not 30 — a cohort's title landed on the button // centred on the ball (or the column's tip), never pushed along the edge
      if (x < 0 || x + w > view.w) { hide(n); continue; } // printed whole or not at all
      // on a box the name sits ON the bar (its first line centred on the box); the sub-lines hang below; on a standing column the
      // ticker sits just past the tip (above a green one, below a red one; the other side if that is taken); else under the ball as before
      // T8: on a step the ticker sits just above the tread (the step face is the fallback); on a box the name sits ON the bar; a heading's
      // title goes ABOVE its point in the box pictures (its children's boxes sit right under it) and under its ball in DETAILED
      const boxy = boxMode() || !!cluster;
      const tries = c.stand ? [c.stand.tip[1] - c.sy - h - 2, c.stand.tip[1] - c.sy + 3]
        : c.bx && c.bx.coil ? [-c.bx.h / 2 - h - 2, c.bx.h / 2 + 2] /* T16: a cohort's title sits above its coil, else under it — never on the bars */
        : c.bx ? [-n.lbl.h / 2, c.bx.h / 2 + 2] : n.lbl.kind === "h" || n.lbl.kind === "c" ? (boxy ? [-c.rpx - h - 3, c.below + 3, c.below + 3 + h + 2] : [c.below + 3, c.below + 3 + h + 2, -c.rpx - h - 3]) : [c.below + 2];
      // a label never sits on another label, and (outside the podium, where the steps touch by design) never on another thing's box
      const avoidBoxes = !(cluster && cluster.coil);
      let y = null;
      for (const dy of tries) { const yy = c.sy + dy; let ok = yy >= 0 && yy + h <= view.h;
        if (ok) for (const r of rects) if (x < r.x + r.w && x + w > r.x && yy < r.y + r.h && yy + h > r.y) { ok = false; break; }
        if (ok && avoidBoxes) for (const b of boxRects) if (b.n !== n && x < b.x + b.w && x + w > b.x && yy < b.y + b.h && yy + h > b.y) { ok = false; break; }
        if (ok) { y = yy; break; } }
      if (y == null) { hide(n); continue; }
      const onBox = !!c.bx && !c.bx.coil; // T16: a coil's title is not "on" anything
      rects.push({ x, y, w, h, id: n.id, nx: c.stand ? c.stand.tip[0] : c.sx, ny: c.stand ? c.stand.tip[1] : c.sy, text: n.lbl.text, onbox: onBox, attip: !!c.stand }); shown++;
      const e = labelEl(n);
      const key = s + (chip ? "|3d" : "");
      if ((n.lbl.kind === "h" || n.lbl.kind === "c") && e.dataset.sub !== key) { e.innerHTML = esc(n.lbl.text) + (chip ? `<span class="chipline">${CHIP}</span>` : "") + (s ? `<small>${s}</small>` : ""); e.dataset.sub = key; }
      e.classList.toggle("onbox", onBox || !!c.stand); e.classList.toggle("sel", (onBox || !!c.stand) && n.id === state.selected);
      e.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      e.style.opacity = Math.max(0.45, Math.min(1, 1.6 - c.dist * 0.6)).toFixed(2);
      if (!n.lbl.shown) { e.style.display = "block"; n.lbl.shown = true; }
    }
    state.labelsShown = shown;
    state.labelsNow = () => rects.map((r) => ({ ...r }));
    state.boxes = () => boxRects.map((b) => ({ id: b.n.id, kind: b.n.kind, x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.w.toFixed(1), h: +b.h.toFixed(1), v: valueOf(b.n) }));
  }
  function hide(n) { if (n.lbl && n.lbl.shown) { n.lbl.el.style.display = "none"; n.lbl.shown = false; } }
  /* ---- T16 · the LIST: click a coil and its names open as a numbered list beside it — rank · ticker · the Hub bar and the
     reading · the day's change (once the quotes are in) — a row opens the company card (onRow). One list at a time; ✕, Esc or
     letting go closes it; it follows the coil as the canvas pans and zooms, and is pushed inside the canvas at the edges. ---- */
  let coilList = null;
  const fmtPct = (p) => (p > 0 ? "+" : "") + p.toFixed(2) + "%";
  const noReadingWhy = (n) => n.served ? "no reading yet — served, but the live Geiger has not answered for it" : `no reading yet — ${n.admission || "not admitted"}, and no close-of-day reading either`;
  function listHTML(c, hiId) {
    const q = state.quotes || {};
    const rows = c.coil.slots.map((s, i) => { const n = s.n, qq = q[n.ticker], dp = qq && Number.isFinite(qq.change_pct) ? qq.change_pct : null;
      return `<div class="r${n.id === (hiId || state.selected) ? " sel" : ""}" data-row="${esc(n.id)}" title="${esc(n.label)} — click for its card"><span class="rk">${i + 1}</span><span class="tk">${esc(n.ticker)}</span>` +
        (s.v == null ? `<span class="gb nr" title="${esc(noReadingWhy(n))}"><i class="dot"></i></span><span class="gv mute" title="${esc(noReadingWhy(n))}">·</span>` : `<span class="gb"><span class="mid"></span><i class="${s.v >= 0 ? "u" : "d"}" style="width:${(Math.min(1, Math.abs(s.v)) * 50).toFixed(1)}%"></i></span><span class="gv ${s.v >= 0 ? "up" : "dn"}">${fmtG(s.v)}</span>`) +
        `<span class="dp ${dp == null ? "mute" : dp >= 0 ? "up" : "dn"}">${dp == null ? "·" : fmtPct(dp)}</span></div>`; }).join("");
    const kindWord = { adopted: "ADOPTED", proposed: "PROPOSED", fundset: "FUND SET", none: "NONE YET" }[c.ckind] || "";
    return `<div class="hd"><b>${esc(c.lbl.text)}</b> <span class="tag kd">${kindWord}</span> <span class="mute">${c.coil.k} names</span><span class="x" title="close (Esc)">✕</span></div><div class="cols"><span>#</span><span>ticker</span><span>Geiger</span><span></span><span>day</span></div>${rows}`;
  }
  function openList(c, hiId) {
    if (!c || !c.coil) return false;
    closeList();
    const el = document.createElement("div"); el.className = "coillist"; el.dataset.id = c.id; el.innerHTML = listHTML(c, hiId); labelLayer.appendChild(el);
    el.addEventListener("click", (e) => { e.stopPropagation(); if (e.target.closest(".x")) { closeList(); return; } const row = e.target.closest("[data-row]"); if (!row) return; const n = state.byId.get(row.dataset.row); if (!n) return; el.querySelectorAll(".r.sel").forEach((r) => r.classList.remove("sel")); row.classList.add("sel"); if (onRow) onRow(n); });
    el.addEventListener("pointerdown", (e) => e.stopPropagation()); el.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true });
    coilList = { c, el }; state.dirty = true; wake(); return true;
  }
  function closeList() { if (!coilList) return false; coilList.el.remove(); coilList = null; state.dirty = true; wake(); return true; }
  const toggleList = (c) => (coilList && coilList.c === c ? closeList() : openList(c));
  function placeList() {
    if (!coilList) return;
    const b = boxRects.find((r) => r.n === coilList.c), el = coilList.el;
    if (!b) { el.style.display = "none"; return; }
    el.style.display = "block"; const pw = el.offsetWidth, ph = el.offsetHeight;
    let x = b.x + b.w + 10, y = b.y + b.h / 2 - ph / 2;
    if (x + pw > view.w - 4) x = Math.max(4, b.x - pw - 10);
    y = Math.max(4, Math.min(view.h - ph - 4, y));
    el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
    rects.push({ x, y, w: pw, h: ph, id: "__list:" + coilList.c.id, nx: b.x + b.w, ny: b.y + b.h / 2, text: "LIST " + coilList.c.lbl.text, list: true });
  }
  state.listOpen = () => (coilList ? coilList.c.id : null);
  state.openCoilList = (id) => openList(state.byId.get(id));
  state.closeCoilList = () => closeList();
  state.refreshCoilList = () => { if (coilList) coilList.el.innerHTML = listHTML(coilList.c); };
  state.listRows = () => (coilList ? [...coilList.el.querySelectorAll(".r")].map((r) => r.textContent.trim().replace(/\s+/g, " ")) : null);
  state.listRect = () => { const r = rects.find((x) => x.list); return r ? { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: r.w, h: r.h } : null; };
  const _S = new THREE.Vector3();
  function toScreen(p) { _S.copy(p).project(camera); return [(_S.x + 1) * view.w / 2, (1 - _S.y) * view.h / 2]; } // a world point in canvas px (the camera's matrices are current inside placeLabels)

  /* ---- render on demand ---- */
  let running = false, still = 0, morph = null, walk = null, lastWheel = 0; // walk: T9's step walk (declared here: tick reads it)
  function pauseAnimation() { running = false; state.paused = true; }
  function resumeAnimation() { if (!running) { running = true; state.paused = false; requestAnimationFrame(tick); } still = 0; }
  function wake() { resumeAnimation(); }
  function stepMorph(now) { if (!morph) return false; const k = ease(Math.min(1, (now - morph.t0) / morph.ms)); nodes.forEach((n) => n.pos.lerpVectors(n.from, n.to, k)); applyPositions(); if (k >= 1) morph = null; return true; }
  function tick(now) {
    if (!running) return;
    const moved = stepMove(now) | stepMorph(now) | controls.update();
    if (moved) still = 0; else still++;
    if (state.ext) state.ext.frame(treeLines.visible); // T15: the connections show only when the whole tree does (never inside an opened area or the podium)
    if (still < 2 || state.dirty) { const camD = camera.position.distanceTo(controls.target); if (walk) { scene.fog.near = 700; scene.fog.far = 2400; } else { scene.fog.near = camD * 0.9; scene.fog.far = camD * 3.2; } /* T9: walking, the stair ahead must not fade */ ring.quaternion.copy(camera.quaternion); renderer.render(scene, camera); placeLabels(); state.frames++; state.dirty = false; }
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
    if (cluster && cluster.coil && cluster.steps) { // T8: the steps touch, so a step is picked by a real ray against the staircase, never by its rectangle
      mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mouse, camera);
      const hs = ray.intersectObject(cluster.steps, false)[0]; if (hs && hs.instanceId != null) return cluster.members[hs.instanceId] || null;
      const hb = ray.intersectObjects(cluster.balls, false)[0]; return hb ? hb.object.userData.node : null;
    }
    if (boxRects.length) { // boxes are picked by their screen rectangles (the nearest one under the pointer)
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
  let hoverSlot = null; // T16: which bar of a coil the pointer is on
  function slotAt(ev, n) { const r = renderer.domElement.getBoundingClientRect(), px = ev.clientX - r.left, b = boxRects.find((x) => x.n === n); if (!b || !n.coil) return null; const j = Math.floor(((px - b.x) / b.w) * n.coil.k); return n.coil.slots[Math.max(0, Math.min(n.coil.k - 1, j))] || null; }
  function tip(n) {
    const head = n.ticker ? `<b>${esc(n.ticker)}</b> · ${esc(n.label)}` : `<b>${esc(n.label)}</b>`;
    if (n.kind === "cohort" && n.coil) { const s = hoverSlot, a = n.agg && n.agg.full; // T16: the bar under the pointer, then the cohort
      return (s ? `<b>${esc(s.n.ticker)}</b> · ${esc(s.n.label)}<br>${s.v == null ? `<span style='color:#8c8c8c'>${esc(noReadingWhy(s.n))}</span>` : `${barHTML(s.v)} Geiger ${gHTML(s.v)} <span style='color:#8c8c8c'>· #${n.coil.slots.indexOf(s) + 1} of ${n.coil.k}</span>`}<br>` : "") +
        `<span style='color:#ababab'>${esc(n.lbl.text)}</span> <span style='color:#8c8c8c'>· ${{ adopted: "ADOPTED cohort", proposed: "PROPOSED cohort, not adopted", fundset: "FUND SET", none: "NONE YET" }[n.ckind]} · ${n.coil.k} names${a ? ` · ${a.up} up · ${a.down} down` : ""} · click for the numbered list</span>`; }
    const fold = n.fold && n.fold.total ? `<br><span style='color:#8c8c8c'>＋${n.fold.total} more inside: ${foldWords(n.fold)} — DETAILED shows them</span>` : "";
    const words = state.wordsOf ? state.wordsOf(n) : "";
    if (n.kind === "index") return head + (words ? `<br><span style='color:#ababab'>${esc(words)}</span>` : "") + `<br><span style='color:#8c8c8c'>heading · ${kids(n.id).length} under it · click to lift it into 3D</span>` + fold;
    if (n.kind === "list") { const a = n.agg && n.agg.full; return head + (words ? `<br><span style='color:#ababab'>${esc(words)}</span>` : "") + `<br><span style='color:#8c8c8c'>the Hub's list · ${(n.listMembers || []).length} names on the tree</span>` + (a ? `<br><span style='color:#8c8c8c'>${a.up} up · ${a.down} down</span>` : ""); } // T7 · T8: counts, no mean
    if (n.kind === "cohort") { const a = n.agg && n.agg.full; return head + `<br><span style='color:#8c8c8c'>${{ adopted: "ADOPTED cohort", proposed: "PROPOSED cohort, not adopted", fundset: "FUND SET: the fund's served holdings no cohort claims", none: "NONE YET: names no group claims, grouped under their sector" }[n.ckind]} · ${membersOf(n).length} members${n.ckind === "adopted" && n.diff_count ? ` · ${n.diff_count} filed elsewhere on the board` : ""}</span>` + (a ? `<br><span style='color:#8c8c8c'>${a.up} up · ${a.down} down</span>` : "") + fold; }
    const rd = readingOf(n); let s = head;
    if (rd) s += `<br>${barHTML(rd.v)} Geiger ${gHTML(rd.v)} <span style='color:#8c8c8c'>${rd.kind === "scout" ? "· computed at the close" : ""}</span>`; else s += `<br><span style='color:#8c8c8c'>${esc(noReadingWhy(n))}</span>`; // T8: the off-Hub Geiger is drawn like the Hub's; its hover says when it was computed · T16: a quiet dot on the canvas, the reason here
    if (n.kind === "fund" && n.agg && SHOW_AGG) s += `<br>holdings ${gHTML(n.agg.value)} <span style='color:#8c8c8c'>· ${n.agg.count} names = ${Math.round(n.agg.coverage_pct)}% of the fund</span>`;
    if (n.kind === "name") { const ind = state.industryOf ? state.industryOf(n.ticker) : null; if (ind && (ind.fmp_industry || ind.sic_code)) s += `<br><span style='color:#8c8c8c'>${esc(ind.fmp_industry || "industry —")}${ind.sic_code ? " · SIC " + esc(ind.sic_code) : ""}</span>`; } // T6: no disagreement note (Alan: "that's our job")
    if (n.kind === "name" && (cluster && cluster.coil)) s += `<br><span style='color:#8c8c8c'>${esc(pathWords(n))}</span>`;
    if (n.kind === "name" && n.differs) s += `<br><span style='color:#8c8c8c'>board tab today: ${esc(String(n.board_cohort || "—").replace(/_/g, " "))}</span>`;
    return s + fold;
  }
  renderer.domElement.addEventListener("pointermove", (ev) => {
    if (downAt) return; const n = pick(ev);
    hoverSlot = n && n.kind === "cohort" && n.coil && !(cluster && cluster.coil) ? slotAt(ev, n) : null; // T16
    if (n !== hoverN) { hoverN = n; graph.style.cursor = n ? "pointer" : ""; }
    if (!n && state.ext && state.ext.hoverLine(ev, tipEl, graph, view)) return; // T15: a connection line under the pointer prints its number (the index weight)
    if (n) { tipEl.innerHTML = tip(n); tipEl.style.display = "block"; const r = graph.getBoundingClientRect(); tipEl.style.left = Math.min(ev.clientX - r.left + 14, view.w - 310) + "px"; tipEl.style.top = (ev.clientY - r.top + 14) + "px"; } else tipEl.style.display = "none";
  });
  renderer.domElement.addEventListener("pointerleave", () => { tipEl.style.display = "none"; hoverN = null; });
  renderer.domElement.addEventListener("pointerdown", (ev) => { downAt = { x: ev.clientX, y: ev.clientY, t: performance.now() }; tipEl.style.display = "none"; });
  addEventListener("pointerup", (ev) => {
    if (!downAt) return; const d = downAt; downAt = null;
    if (Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 6 || performance.now() - d.t > 600) return;
    const n = pick(ev); if (!n) return;
    if (cluster && cluster.coil && n.kind === "name") { onSelect(n); select(n, false); return; } // T8: a podium step = the card first (its SHOW ON THE TREE button jumps to the tree); T6 jumped straight away
    if (n.kind === "cohort" && n.coil && !(cluster && cluster.coil)) { onSelect(n); toggleList(n); if (!cluster) { state.selected = n.id; drawSelection(n); } state.dirty = true; wake(); return; } // T16: a coil clicked = its numbered list beside it (and its card); nothing lifts into 3D by itself
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
  const ringOk = () => !boxMode() && !cluster; // on a box the selection is the box's outline, not a ring (T8: inside an area too, everything tradeable is a box)
  function select(n, fly = true, lift = false) { // lift: a click on the canvas lifts a branch into 3D; the finder and the card only fly there
    if (cluster) { state.selected = n.id; ring.visible = ringOk(); drawSelection(n); state.dirty = true; wake(); return; }
    if (state.canvas && lift && isBranch(n)) { state.selected = n.id; onSelect(n); if (coilWorthy(n)) enterCoil(n); else enterArea(n); return; }
    if (!beforePick) beforePick = { p: camera.position.clone(), t: controls.target.clone() };
    state.selected = n.id; ring.visible = ringOk(); drawSelection(n);
    if (n.hid && n.kind === "name") { const c = state.byId.get(n.parents[0]); if (c && c.coil) openList(c, n.id); } // T16: a name lives in its cohort's coil: its list opens with the row marked
    else if (n.kind === "cohort" && n.coil) openList(n); else closeList();
    if (fly) {
      const dir = state.canvas ? DIR2.clone() : camera.position.clone().sub(controls.target).normalize();
      if (isBranch(n)) flyTo(framing(subtree(n), dir, 0.82), 1000);
      else if (n.hid && n.kind === "name") { const c = state.byId.get(n.parents[0]), gp = c && c.parents.length ? state.byId.get(c.parents[0]) : c; flyTo(framing(subtree(gp || c).filter((x) => !x.hid), dir, 0.7), 1000); } // T16: a name in a coil — frame the block its cohort sits in (every member shares the coil's point, so the coil alone cannot be framed)
      else if (boxMode() && n.parents.length) flyTo(framing(subtree(state.byId.get(n.parents[0])).filter((x) => !x.hid), dir, 0.7), 1000); // T8: a box is big — frame its whole block (the cohort or heading it sits in), not nine bars
      else { const d = n.kind === "fund" ? 240 : 170 + n.r * 8; flyTo({ p: n.pos.clone().add(dir.multiplyScalar(d)), t: n.pos.clone() }, 900); }
    }
    state.dirty = true; wake();
  }
  function release(fly = true) {
    closeList(); // T16
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
    // T8: the opened section is the CLEAN picture lifted: boxes for every tradeable with a reading; a line with no reading stays on the card (it would only pile on its cohort's point)
    const waiting = subtreeOf(root).filter((n) => n.ticker && valueOf(n) == null).length;
    const sub = subtreeOf(root).filter((n) => !(n.ticker && valueOf(n) == null)).filter((n) => !inCoil(n)), inSub = new Set([root.id, ...sub.map((n) => n.id)]); // T16: a cohort's names stay in its coil inside the area too
    const names = subtreeOf(root).filter((n) => n.kind === "name");
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
    nbs.forEach((nb, i) => { const a = (i / nbs.length) * Math.PI * 2, r = rad + 70; put(nb, r * Math.cos(a), depth - 30, r * Math.sin(a)); }); // T9 tried +44: one ticker landed on a box at 1680, so the ring stays where T8 put it
    const group = new THREE.Group();
    const colOf = (n) => n.kind === "index" ? HEADING : n.kind === "cohort" ? COHORT : n.g || n.sg ? LIT : HOLLOW;
    const mkBall = (n, op = 1) => { const b = new THREE.Mesh(sph, new THREE.MeshLambertMaterial({ color: colOf(n), transparent: op < 1, opacity: op })); b.position.copy(n.pos); b.scale.setScalar(n.r); b.userData.node = n; group.add(b); return b; };
    const balls = [root, ...sub].filter((n) => !n.ticker && !(n.kind === "cohort" && n.coil)).map((n) => mkBall(n)); nbs.forEach((nb) => { if (!(nb.kind === "cohort" && nb.coil)) balls.push(mkBall(nb, 0.35)); }); // T8: a tradeable is its box, no ball · T16: a cohort is its coil, no ball
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
    showWhole(false); placeCoils(); coilMesh.visible = true; // T16: the lifted section keeps its coils (at their lifted places)
    cluster = { c: root, group, balls, members: sub, nbs, before: { p: camera.position.clone(), t: controls.target.clone() }, rotate: controls.enableRotate };
    controls.enableRotate = true; freeOrbit(); // orbit is allowed inside an area, whatever the canvas allows; T9: no limit on the turn
    state.cluster = root.id; state.clusterCount = { members: sub.length, names: names.length, neighbours: nbs.length, waiting };
    nodes.forEach(hide);
    focusCanvas();
    cluster.home = framing([root, ...sub, ...nbs], DIR3, 0.8); // T9 tried 0.9 and 0.86: each put one ticker on another name's box at 1680, so T8's 0.8 stays; RESET VIEW / a double-click comes back here; RESET VIEW / a double-click comes back here
    flyTo(cluster.home, 900);
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
  /* T8 (2 Oct, night — Alan: "if the winner of the race, number one, wanted to walk down those steps, he would fall at every
     step. He can't fall. The winner has to take a glory walk down the steps, like a king."). The podium is ONE STAIRCASE.
     Every name is a vertical column standing against its neighbours — no gap at all — on a spiral: first place at the
     centre and the top, each next step a little lower and a little further out, coiling down to the last at the outer
     bottom. The TREAD of a step (the column's top) sits at the name's reading × H; every column stands on one common floor
     just under the lowest tread, so the treads form one continuous stair from the first place to the last. Green where the
     tread is above zero, red where it is below; the zero level is a grey ring round the spiral at height 0.
       Decision (for Alan): T7 drew the ramp as the zero line and hung the red columns below it, so the red half had no
       steps to walk on — every red column's top was the ramp. Here the stair IS the readings: a red step's tread sits below
       zero by its reading, and the ring marks zero beside the stair. The height of a step above or below the ring is still
       its Geiger.
       No cliffs: the drop between two neighbours is their Geiger difference × H. H starts at 260 (T6's scale) and is lowered
       when the biggest drop would exceed one tread's width (DROP CAP = D, the step along the arc), never below H_MIN, so no
       step is a cliff and high still reads as high. The step along the arc D is also the tread's width, so neighbours touch;
       the turn pitch 2πB equals the tread's depth RW (a hair more), so the turns sit against each other too.
       FROM ABOVE: the same steps as flat slabs at their tread heights, seen from straight above. PODIUM 3D is the default;
       the camera sits 70° up (Alan: "70 — sounds like a good angle; I'll be able to drag anyway").
       ?sa= ?sb= ?sd= ?srw= ?sh= ?sel= ?saz= tune: inner radius, radius per radian (0 = from RW), the step along the arc
       (= tread width), tread depth, H, the camera's elevation and azimuth (degrees); __mm.podiumParams() reads them back. */
  const PARAMS = { stand: { A: qn("sa", 30), B: qn("sb", 0), D: qn("sd", 30), RW: qn("srw", 30), H: qn("sh", 260), H_MIN: 60, el: qn("sel", 70), az: qn("saz", 28) }, above: { el: qn("pel", 88), az: qn("paz", 28) } };
  if (!(PARAMS.stand.B > 0)) PARAMS.stand.B = (PARAMS.stand.RW * 1.04) / (2 * Math.PI); // one turn out = one tread's depth: the turns touch
  const dirOf = (P) => { const el = (P.el * Math.PI) / 180, az = (P.az * Math.PI) / 180; return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize(); }; // the camera's direction from an elevation and an azimuth (degrees)
  state.podium = Q.get("podium") === "above" ? "above" : "3d";
  // the place of rank i along the spiral: an Archimedean spiral r = A + Bθ walked in even steps of arc length D (s ≈ Aθ + Bθ²/2); the first centre sits half a step in
  const NONE_DROP = 0.25; // T9: a step with no reading drops a quarter tread below the one before it
  const spiralAt = (i) => { const P = PARAMS.stand, s = (i + 0.5) * P.D, th = (-P.A + Math.sqrt(P.A * P.A + 2 * P.B * s)) / P.B; return { th, r: P.A + P.B * th }; };
  const stepGeo = new THREE.BoxGeometry(1, 1, 1), Y_AXIS = new THREE.Vector3(0, 1, 0);
  // the staircase: one box per step, turned to the spiral's tangent, one tread wide (a hair more on the outer edge, so the outer edges meet too), RW deep,
  // from the common floor up to its tread (standing) or a thin slab at its tread (from above); green / red / grey for no reading
  function stairMesh(members, P, above) {
    const im = new THREE.InstancedMesh(stepGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), Math.max(1, members.length)); im.count = members.length;
    const M4 = new THREE.Matrix4(), Qt = new THREE.Quaternion(), S = new THREE.Vector3(), Pz = new THREE.Vector3(), C = new THREE.Color();
    members.forEach((n, i) => { const p = n.podium, w = (P.D * (p.r + P.RW / 2)) / p.r;
      const y0 = above ? p.tread - 1.5 : p.floor, y1 = above ? p.tread + 1.5 : p.tread;
      Qt.setFromAxisAngle(Y_AXIS, -(p.th + Math.PI / 2)); S.set(w, Math.max(0.5, y1 - y0), P.RW); Pz.set(p.foot.x, (y0 + y1) / 2, p.foot.z);
      M4.compose(Pz, Qt, S); im.setMatrixAt(i, M4);
      im.setColorAt(i, C.setHex(p.none ? 0x4a4a4a : p.v >= 0 ? 0x35b06a : 0xd1483f).multiplyScalar(i % 2 ? 0.8 : 1)); }); // neighbours alternate a shade so each step reads without a gap
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.userData.steps = true; return im;
  }
  function initNode(n) { n.pos = new THREE.Vector3(); n.from = new THREE.Vector3(); n.to = new THREE.Vector3(); initLabel(n); } // a list root (★ FAVORITES, ♥ LIKED, ◎ RADAR) lives off the tree: give it a place and a label on first use
  function enterCoil(root, mode, opts = {}) {
    exitCluster(false);
    if (mode === "above" || mode === "3d") state.podium = mode;
    const above = state.podium === "above", P = PARAMS.stand;
    if (!root.pos) initNode(root);
    const all = root.listMembers ? root.listMembers : beneathNames(root); // a Hub list carries its own members (T7); a parent's are the names under it
    const withV = all.map((n) => ({ n, v: valueOf(n) })).filter((x) => x.v != null).sort((a, b) => b.v - a.v || (a.n.ticker < b.n.ticker ? -1 : 1));
    const none = all.filter((n) => valueOf(n) == null);
    const put = (n, x, y, z) => { if (!saved.has(n.id)) saved.set(n.id, n.pos.clone()); n.pos.set(x, y, z); };
    const members = [...withV.map((x) => x.n), ...none];
    // the height scale: T6's 260 per unit of reading, lowered until the biggest drop between neighbours is at most one tread's width (never below H_MIN)
    let maxGap = 0; for (let i = 1; i < withV.length; i++) maxGap = Math.max(maxGap, withV[i - 1].v - withV[i].v);
    const H = Math.max(P.H_MIN, Math.min(P.H, maxGap > 0 ? P.D / maxGap : P.H));
    const vLow = withV.length ? withV[withV.length - 1].v : 0, vTop = withV.length ? withV[0].v : 0;
    /* T9 (Alan: "Why is the coiling of the bottom different from the top? Why are you forcing it flat? The red ones have to coil
       down the same way the green ones coil"): ONE rule for every step, above and below zero — tread = reading × H, the same H
       on both sides, so the pitch (the drop per unit of reading) never changes where the stair crosses the zero ring. A name
       with NO reading (grey) used to stand on a flat run at the floor; now it keeps coiling down a quarter tread per step
       after the last red one, so the stair never flattens. The floor sits one tread under the lowest tread, never above zero. */
    const lastTread = withV.length ? vLow * H : 0;
    const treadOf = (i) => (i < withV.length ? withV[i].v * H : lastTread - (i - withV.length + 1) * P.D * NONE_DROP);
    const floor = Math.min(0, members.length ? treadOf(members.length - 1) : 0) - P.D; // the common floor: one tread's width under the lowest tread, and never above zero
    members.forEach((n, i) => { const { th, r } = spiralAt(i), v = i < withV.length ? withV[i].v : null, tread = treadOf(i), x = r * Math.cos(th), z = r * Math.sin(th);
      put(n, x, (floor + tread) / 2, z); n.podium = { foot: new THREE.Vector3(x, floor, z), tip: new THREE.Vector3(x, tread, z), v: v == null ? 0 : v, i, th, r, tread, floor, none: v == null }; });
    const top = vTop * H;
    put(root, 0, top + 110, 0); // the parent sits well above the peak so its label never lands on the top steps
    const group = new THREE.Group();
    const balls = [];
    const mkBall = (n, col, r, op = 1) => { const b = new THREE.Mesh(sph, new THREE.MeshLambertMaterial({ color: col, transparent: op < 1, opacity: op })); b.position.copy(n.pos); b.scale.setScalar(r); b.userData.node = n; group.add(b); balls.push(b); return b; };
    mkBall(root, root.kind === "index" ? HEADING : COHORT, root.r); // the parent above the peak; the steps are picked by their rectangles
    const steps = stairMesh(members, P, above); group.add(steps);
    // the zero level: a grey ring round the stair at height 0, and the spine
    const line = (pts, col, op = 0.55) => { if (pts.length < 2) return; const g = new THREE.BufferGeometry().setFromPoints(pts); group.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: op }))); };
    const outerR = (members.length ? members[members.length - 1].podium.r : P.A) + P.RW / 2 + 6;
    const ringPts = []; for (let i = 0; i <= 96; i++) ringPts.push(new THREE.Vector3(outerR * Math.cos((i / 96) * Math.PI * 2), 0, outerR * Math.sin((i / 96) * Math.PI * 2)));
    line(ringPts, 0x8c8c8c, 0.8);
    line([new THREE.Vector3(0, floor - 10, 0), new THREE.Vector3(0, top + 96, 0)], 0x2a2a2a); // the spine
    scene.add(group);
    showWhole(false); closeList(); // T16: the podium has the whole tree's coils off and no list open
    cluster = { c: root, group, balls, members, steps, nbs: [], before: opts.instant && cluster ? cluster.before : { p: camera.position.clone(), t: controls.target.clone() }, rotate: controls.enableRotate, coil: true };
    controls.enableRotate = true; freeOrbit(); // T9: the full orbit — above, from the side, from below the rim
    // T9 · the pitch rule, read by the proof: the drop per unit of reading above zero and below zero (both = H), the crossing, the no-reading run
    state.pitchRule = () => { const fit = (list) => { let num = 0, den = 0, mn = Infinity, mx = -Infinity; for (let k = 1; k < list.length; k++) { const dv = list[k - 1].v - list[k].v, dh = list[k - 1].tread - list[k].tread; if (dv > 1e-9) { const h = dh / dv; mn = Math.min(mn, h); mx = Math.max(mx, h); } num += dh; den += dv; } return { steps: list.length, per_unit: den > 1e-9 ? +(num / den).toFixed(2) : null, per_unit_min: isFinite(mn) ? +mn.toFixed(2) : null, per_unit_max: isFinite(mx) ? +mx.toFixed(2) : null, mean_drop: list.length > 1 ? +(num / (list.length - 1)).toFixed(2) : null }; };
      const R = members.filter((n) => !n.podium.none).map((n) => n.podium), up = R.filter((q) => q.v >= 0), dn = R.filter((q) => q.v < 0); let cross = null;
      for (let k = 1; k < R.length; k++) if (R[k - 1].v >= 0 && R[k].v < 0) { const dv = R[k - 1].v - R[k].v, dh = R[k - 1].tread - R[k].tread; cross = { from: members[R[k - 1].i].ticker, to: members[R[k].i].ticker, dv: +dv.toFixed(4), drop: +dh.toFixed(2), per_unit: dv > 1e-9 ? +(dh / dv).toFixed(2) : null }; break; }
      const N = members.filter((n) => n.podium.none).map((n) => n.podium);
      return { H: +H.toFixed(2), rule: "tread = reading × H, one H above and below zero", above: fit(up), below: fit(dn), crossing: cross, no_reading: { steps: N.length, flat: N.length > 1 && N.every((q) => Math.abs(q.tread - N[0].tread) < 1e-6), drop_per_step: N.length ? +(P.D * NONE_DROP).toFixed(2) : null }, floor: +floor.toFixed(1), inner_radius: P.A }; };
    const ups = withV.filter((x) => x.v >= 0), dns = withV.filter((x) => x.v < 0);
    state.cluster = root.id; state.clusterCount = { members: all.length, names: all.length, neighbours: 0, read: withV.length, up: ups.length, down: dns.length, none: none.length, top: withV.length ? withV[0].n.ticker : null, bottom: withV.length ? withV[withV.length - 1].n.ticker : null, zero_ring_r: +outerR.toFixed(1), podium: state.podium, list: !!root.listMembers, H: +H.toFixed(1), max_gap: +maxGap.toFixed(3), max_drop: +(maxGap * H).toFixed(1), drop_cap: P.D };
    state.coilOrder = withV.map((x) => x.n.ticker);
    // the proof reads the gap between every pair of neighbouring steps, in world units along the outer edge of the spiral (0 = they touch; negative = they overlap a hair on the inside of the turn)
    state.stepGaps = () => members.slice(1).map((n, i) => { const a = members[i].podium, b = n.podium, rm = (a.r + b.r) / 2, wa = (P.D * (a.r + P.RW / 2)) / a.r, wb = (P.D * (b.r + P.RW / 2)) / b.r; return +((b.th - a.th) * (rm + P.RW / 2) - (wa + wb) / 2).toFixed(2); });
    state.podiumParams = () => ({ ...P, H: +H.toFixed(1), floor: +floor.toFixed(1), top: +top.toFixed(1), max_gap: +maxGap.toFixed(3), max_drop: +(maxGap * H).toFixed(1), turns: +(members.length ? members[members.length - 1].podium.th / (2 * Math.PI) : 0).toFixed(2), outer_r: +outerR.toFixed(1) });
    // the proof reads every place: rank, reading, radius, the tread (the step's top) and the floor
    state.coilPlaces = () => members.map((n, i) => ({ t: n.ticker, i, v: i < withV.length ? +withV[i].v.toFixed(3) : null, r: +Math.hypot(n.pos.x, n.pos.z).toFixed(1), y: +n.pos.y.toFixed(1), tread: +n.podium.tread.toFixed(1), floor: +n.podium.floor.toFixed(1), tip: +n.podium.tread.toFixed(1) }));
    nodes.forEach(hide);
    focusCanvas();
    // the frame holds every floor point and every tread, and the parent's ball
    const frameList = [root, ...members, ...members.map((n) => ({ pos: n.podium.foot })), ...members.map((n) => ({ pos: n.podium.tip }))];
    const to = framing(frameList, dirOf(above ? PARAMS.above : PARAMS.stand), 0.9); // T9: fill 0.9 (was 0.8)
    cluster.home = to; // T9: RESET VIEW / a double-click / Esc out of the walk come back to this 70° (88° from above) view
    if (opts.instant) { camera.position.copy(to.p); controls.target.copy(to.t); move = null; } else flyTo(to, 900);
    state.dirty = true; wake();
    if (onArea) onArea(root);
  }
  /* ---- T9 · FREE ROTATION (Alan: "I'm not able to get it into the view I want — rotating to a side seems to have weird
     limits"). Inside the podium and a section's 3D the orbit has no pitch or yaw limit: from straight above, from the side,
     from below the rim. The tickers are DOM labels, so they stay upright and readable whatever the angle; the zero ring is a
     line at height 0. 70° stays the starting view; RESET VIEW on the top bar, or a double-click on the canvas, flies back. ---- */
  // The limit Alan hit: CANVAS maps the left button and one finger to PAN (drag to pan the flat canvas) and the podium inherited
  // that — a left drag slid the staircase sideways instead of turning it, and only the right button turned. Inside the podium and
  // a section's 3D the left button and one finger ROTATE (the right button pans); the canvas gets its own mapping back on exit.
  function orbitButtons(inside) { controls.mouseButtons = { LEFT: inside || !state.canvas ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: inside || !state.canvas ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE }; controls.touches = { ONE: inside || !state.canvas ? THREE.TOUCH.ROTATE : THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }; }
  function freeOrbit() { controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI; controls.minAzimuthAngle = -Infinity; controls.maxAzimuthAngle = Infinity; controls.enabled = true; orbitButtons(true); }
  function resetView(ms = 700) { if (!cluster || !cluster.home) return false; if (walk) endWalk(); flyTo(cluster.home, ms); return true; }
  renderer.domElement.addEventListener("dblclick", (e) => { if (!cluster) return; e.preventDefault(); resetView(700); });
  state.orbitLimits = () => ({ minPolar: controls.minPolarAngle, maxPolar: controls.maxPolarAngle, minAz: controls.minAzimuthAngle, maxAz: controls.maxAzimuthAngle, rotate: controls.enableRotate, enabled: controls.enabled, left: controls.mouseButtons.LEFT === THREE.MOUSE.ROTATE ? "rotate" : controls.mouseButtons.LEFT === THREE.MOUSE.PAN ? "pan" : String(controls.mouseButtons.LEFT), one_finger: controls.touches.ONE === THREE.TOUCH.ROTATE ? "rotate" : "pan" });
  state.elevation = () => { const d = camera.position.clone().sub(controls.target); return { el: +((Math.asin(d.y / d.length()) * 180) / Math.PI).toFixed(1), az: +((Math.atan2(d.x, d.z) * 180) / Math.PI).toFixed(1), d: +d.length().toFixed(1) }; };
  state.orbitTo = (el, az) => { const d = camera.position.distanceTo(controls.target); camera.position.copy(controls.target).add(dirOf({ el, az }).multiplyScalar(d)); move = null; state.dirty = true; wake(); }; // the proof's deterministic side / below-the-rim views
  state.homeView = () => (cluster && cluster.home ? { p: cluster.home.p.toArray().map((v) => +v.toFixed(1)), t: cluster.home.t.toArray().map((v) => +v.toFixed(1)) } : null);

  /* ---- T9 · WALK THE STEPS (Alan: "I should be able to walk down the steps too, navigationally"; earlier: "the winner has
     to take a glory walk down the steps, like a king"). WALK on the top bar (or ↓) starts at the winner: the camera stands
     just above the current step, a little back up the stair, and looks down the staircase at the steps ahead; ↓ / J / the
     wheel / ▼ take one step down, ↑ / K / ▲ one step up, Home / End the first / last step, Esc leaves the walk and flies back
     to the 70° view. Every step is a short eased move (WALK.ms), so it feels like walking, not teleporting. While walking the
     orbit is parked (dragging does nothing) so the camera cannot be knocked off the stair. The HUD (#walkhud) shows the step's
     rank, ticker and reading large, with ▲ ▼ for the phone. ?wms= ?weye= ?wback= ?wahead= tune. ---- */
  const WALK = { ms: qn("wms", 480), eye: qn("weye", 120), back: qn("wback", 3.2), ahead: qn("wahead", 12), fov: qn("wfov", 62) }; // eye height over the tread, steps back up the stair, steps looked at ahead, the field of view while walking (the podium's is 38)
  lastWheel = 0;
  const hud = $("walkhud");
  function walkPose(i) {
    const P = PARAMS.stand, m = cluster.members, p = m[i].podium;
    const b = spiralAt(i - WALK.back); // a fraction of a step back up the stair
    const eye = new THREE.Vector3(b.r * Math.cos(b.th), p.tread + WALK.eye, b.r * Math.sin(b.th));
    const j = Math.min(m.length - 1, i + WALK.ahead); let look;
    if (j > i) { const q = m[j].podium; look = new THREE.Vector3(q.foot.x, q.tread, q.foot.z); } // the tread a few steps down
    else look = new THREE.Vector3(p.foot.x, p.tread - P.D * 0.5, p.foot.z); // the last steps: the stair's end itself, seen from a few steps back up
    return { p: eye, t: look };
  }
  function walkTo(i, ms = WALK.ms) {
    if (!cluster || !cluster.coil || !cluster.members.length) return;
    i = Math.max(0, Math.min(cluster.members.length - 1, i));
    walk = { i }; state.walkAt = i; controls.enabled = false;
    if (camera.fov !== WALK.fov) { camera.fov = WALK.fov; fit(); }
    flyTo(walkPose(i), ms);
    const n = cluster.members[i], p = n.podium, col = p.none ? "#8c8c8c" : p.v >= 0 ? "#35b06a" : "#d1483f";
    if (hud) { hud.style.display = "flex"; hud.innerHTML = `<button data-walk="-1" title="a step up (↑ / K / wheel up)"${i === 0 ? " disabled" : ""}>▲</button><div class="who"><span class="rank">#${i + 1} <small>of ${cluster.members.length}</small></span><b>${esc(n.ticker || n.label)}</b><span class="v" style="color:${col}">${p.none ? "no reading" : fmtG(p.v)}</span><small>${esc(n.label && n.label !== n.ticker ? n.label : "")}</small></div><button data-walk="1" title="a step down (↓ / J / wheel down)"${i === cluster.members.length - 1 ? " disabled" : ""}>▼</button>`; }
    if (onWalk) onWalk(n, i, cluster.members.length);
    state.dirty = true; wake();
  }
  function endWalk() { walk = null; state.walkAt = null; controls.enabled = true; if (camera.fov !== 38) { camera.fov = 38; fit(); } if (hud) { hud.style.display = "none"; hud.innerHTML = ""; } if (onWalk) onWalk(null); }
  function setWalk(on) {
    if (on) { if (!cluster || !cluster.coil) return false; if (!walk) walkTo(0, 900); return true; }
    if (!walk) return false;
    endWalk(); resetView(700); return false;
  }
  const walkStep = (d) => { if (!walk) return false; walkTo(walk.i + d); return true; };
  addEventListener("keydown", (e) => { // before the page's own Esc (window, capture): the walk owns the arrows, J / K, Home / End and Esc
    if (!walk) return; const k = e.key; let used = true;
    if (k === "ArrowDown" || k === "j" || k === "J" || k === "PageDown") walkStep(1);
    else if (k === "ArrowUp" || k === "k" || k === "K" || k === "PageUp") walkStep(-1);
    else if (k === "Home") walkTo(0); else if (k === "End") walkTo(cluster.members.length - 1);
    else if (k === "Escape") setWalk(false); else used = false;
    if (used) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  graph.addEventListener("wheel", (e) => { // while walking the wheel walks (one step per 220 ms), never zooms
    if (!walk) return; e.preventDefault(); e.stopPropagation(); const now = performance.now(); if (now - lastWheel < 220) return; lastWheel = now; walkStep(e.deltaY > 0 ? 1 : -1);
  }, { capture: true, passive: false });
  if (hud) hud.addEventListener("click", (e) => { const b = e.target.closest("[data-walk]"); if (b) walkStep(+b.dataset.walk); });
  state.walking = () => !!walk;

  // FROM ABOVE | PODIUM 3D: the other picture of the podium that is open (or the one the next podium opens in)
  function setPodium(mode) { if (mode !== "above" && mode !== "3d") return; if (cluster && cluster.coil) enterCoil(cluster.c, mode); else state.podium = mode; }
  function exitCluster(fly = true) {
    if (!cluster) return;
    scene.remove(cluster.group);
    cluster.group.traverse((o) => { if (o.geometry && o.geometry !== sph) o.geometry.dispose(); });
    for (const [id, p] of saved) state.byId.get(id).pos.copy(p); saved.clear();
    applyPositions();
    controls.enableRotate = cluster.rotate; orbitButtons(false); // T9: the canvas's buttons back (left = pan)
    (cluster.members || []).forEach((n) => { n.podium = null; }); // T7: the standing columns' feet and tips go with the podium
    if (walk) endWalk(); // T9: the walk ends with the podium
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
  state.screenOf = (id) => { const n = state.byId.get(id); camera.updateMatrixWorld(); const v = (n.podium ? n.podium.tip : n.pos).clone().project(camera); const r = renderer.domElement.getBoundingClientRect(); /* T8: a step is aimed at its tread */ return [r.left + (v.x + 1) * r.width / 2, r.top + (1 - v.y) * r.height / 2]; };
  state.layoutOf = (k) => { const out = {}; layout(k, (n, x, y, z) => { out[n.id] = [x, y, z]; }, modes.clean); layout(state.flat ? 0 : 1, () => {}); return out; }; // T8: an area lifts the CLEAN picture (boxes, packed); T6 lifted the DETAILED one
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
  if (state.ext) state.ext.mount({ THREE, scene, camera, controls, renderer, nodes, wake, view, toScreen }); // T15: the connections module draws into this scene
  state.canvasFocused = () => document.activeElement === renderer.domElement;
  return { select, release, setFlat, fit, frameWhole, enterCluster, exitCluster, enterArea, exitArea: exitCluster, setCanvas, inCluster: () => !!cluster, inArea: () => !!cluster, inCoil: () => !!(cluster && cluster.coil), enterCoil, coilWorthy, beneathNames, setDetail, setOrder, valueOf, focusCanvas, setPodium, podiumMode: () => state.podium, walk: setWalk, walkStep, walking: () => !!walk, resetView, openList, closeList, listOpen: () => (coilList ? coilList.c.id : null) }; // T16: the list
}

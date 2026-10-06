/* COIL LAB (3 Oct 2026) · the coil alone, as a component, in 3D — three visual directions on one scene. PASS 6 (6 Oct 2026).
   PASS 6 (Alan, 6 Oct ~09:05: "I like it … it's sensitive … the black background on these boxes lost the laser feel. I like the
   laser, but without hue, without shine outside of its container … labels sometimes appear and sometimes disappear at some angles …
   at least the ones in the frontal row have to appear … a numbered ordered list that occupies the same top-to-bottom space at the
   right will help."):
     LASER, CONTAINED (opts.look = "laser", the default) a bar is ONE flat ribbon drawn in screen space along the bar (a capsule: the
                   fat-line technique of three.js Line2 / LineMaterial, with a soft profile): full colour down the middle (the hot
                   line, LASER.hot of the half width), a softer body round it, fading to NOTHING at the bar's own edge. The glow is that fade — it lives inside
                   the bar's footprint and its alpha is exactly 0 on the outline, so no pixel outside a bar is touched. Normal
                   (not additive) blending: where bars overlap the colour is mixed, never summed, so it cannot burn to white.
                   No bloom, no composer, no fog, no dark fill, no dark edge. api.spill() proves it per frame: every pixel the bars
                   change lies inside a bar's footprint, and the page prints 0A0A0F.
     CALMER SPIN   SPIN.rotate_speed 2.5 → 1.25: half the turn for the same drag. Free in every direction, the short coast, and
                   double-click home are pass 5's.
     FRONT ROW     label-scale.mjs · layoutFront(): the bars nearest the camera always carry their ticker (they slide along their
                   own bar rather than hide); the rest show when clear; nothing changes twice within 500 ms.
     THE LIST      index.html draws the numbered list; here: api.order() (the order rule), api.highlight(t) and opts.onHover(t).
   PASS 5 (Alan, 5 Oct ~20:45: "It's this shiny at some of these angles … It has like this hue … the red bars … there's like this
   shine … I should be able to basically spin it, all directions … it just has this green hue and I can't really see shit. The
   proportion and the sizing of the labels and the bars seem good, but something really weird is up."):
     THE CAUSE     pass 4's beam was three ADDITIVE layers (a tube at 0.7, a line above 1 down its middle, a halo) under a bloom
                   with threshold 0. Additive light sums wherever beams overlap on screen: from the side the bars stack behind one
                   another and the sum clips to white (the shine, and red bars going pink-white); the bloom then spreads that sum
                   over the whole frame (the green-cyan haze round the coil: the hue). The same chain also lifts the PAGE: 0A0A0F
                   prints as 56, 56, 69 through the composer and 105, 105, 127 once the bloom adds the frame to itself — a grey
                   wash over everything. No light, no environment map, no metalness in the scene — it is the post chain and
                   the sum. Measured layer by layer in proof-p5.mjs (shots/proof-p5.json → cause).
     MATTE         (opts.look = "matte", the default; LASER) a bar is ONE opaque unlit cylinder in the Hub's own green 00FFA3 or
                   red FF2D55 — the same colour at every angle, because nothing is summed and nothing is lit. No bloom, no halo,
                   no white line, no fog, no additive ring; the sphere is its outline only (no glass over the bars). Bars that
                   stand behind one another are told apart by a 1.25 px dark edge (the inverted hull of toon rendering: the bar's
                   back faces, a little bigger, in the page's colour). The bar keeps pass 4's width (1.15 × the type) and the
                   labels are untouched. A change flashes the bar itself: it swells to 1.6 × its width and settles in 320 ms.
                   opts.look = "glow" is pass 4 as it was, for the side-by-side; api.diag() switches its layers for the proof.
     FREE SPIN     three.js TrackballControls instead of OrbitControls: the camera's up vector turns with the drag, so there is
                   no pole and no lock — any axis, over the top and on. Release coasts (the last turn decays by √(1 − 0.3) per
                   frame, about half a second); double-click (or RESET VIEW) turns the whole camera back to home, upright, along the
                   shortest arc. The wheel is pass 4's eased zoom, unchanged.
   PASS 4 (Alan, 5 Oct ~12:45: "What are these boxes, these rectangles at the top of the lasers? I hate these boxes. Make the lasers
   at least as thick as the fonts. The zooming is a little glitchy — it kind of snaps, some weird lag. … lasers thicker, fonts a little
   smaller — even on the zoom-out the fonts are still big; balance it out."):
     1 NO RECTANGLES the dark chip behind each label is gone: the ticker and the value are painted type with a dark outline and a
                     soft glow for contrast, nothing boxed; and the LASER step has no tread frame any more (the thin polygon outline
                     V3 left around every step) — a step is its beam and its type. V2b's boxes (opts.boxes) still bring everything back.
     2 BEAM ≥ TYPE   the beam's core is sized in screen px each frame: core = BEAM.core_over_type × the ticker's cap height (never
                     thinner than the type, at any zoom); the halo = core × (2 + 2.5 × |reading|) — the halo follows the reading,
                     the core does not. api.beamPx() prints core / halo / type in px.
     3 BALANCE       the type (label-scale.mjs, pass 4 sizes): ticker 11 px at home, value 9 px, ceiling 16 px zoomed in, floor 8 px
                     zoomed out (on 1080 tall; scaled with the screen's height). The beam follows the type, so the ratio holds.
     4 SMOOTH ZOOM   the wheel no longer dollies the camera itself (OrbitControls' zoom is off): each tick moves a TARGET distance
                     (× 0.946 per 120 px of wheel) and the camera eases toward it every frame with a 120 ms time constant; the type
                     and the thinning are laid out per frame with hysteresis (label-scale.mjs), so no label pops at a threshold.
                     Nothing is re-fitted on a wheel tick: the home fit runs once (and on a resize), the zoom scales from it.
                     api.record() counts, per rendered frame, the distance step and the labels that appeared or disappeared.
     5 RED = GREEN   every step colour is normalised to the green's luminance before bloom (litEq), so a red core crosses the bloom
                     threshold as a green one does; the red fan reads at home below the zero plane as the green fan does above it.
   PASS 3 (Alan, 5 Oct: "it still has these column boxes around it … the labels need to tilt with the view change, and smaller, or
   some dynamic zoom on the font as I zoom … the sphere's total is market cap"):
     1 NO BOXES   a step is its light — the beam (core + halo) and the tread's edge — and nothing else. No glass body, no hairline
                  verticals, no plate, no footprint. opts.boxes = true puts V2b's boxes back for the side-by-side.
     2 BILLBOARD  one label per step, a sprite (THREE.Sprite) at the step's tip: it always faces the camera and stays upright in
                  screen space, so it can never read mirrored or upside down; api.labelCheck() still measures it.
     3 ZOOM TYPE  the label's type size follows the camera distance (label-scale.mjs: 13 px at home, floor 11, ceiling 24 on 1080
                  tall), and labels thin out when they would overlap (strongest readings first) and all come back when zoomed in.
                  Labels are drawn in a second pass after the bloom chain, so the type stays crisp.
     4 THE SPHERE each set draws a translucent sphere whose VOLUME is the sum of its members' market caps ($1 T = CAP_R1T U of
                  radius, so r = CAP_R1T × (Σcap / $1 T)^⅓), the coil inside it; two sets side by side compare at a glance.
                  The alternative beside it: each step's width = its name's market cap (width share = (cap / the set's biggest)^⅓,
                  floor 0.2). opts.caps = { TICKER: market_cap }; api.setSets([{ name, rows }, …]).
   Throwaway page. The live tree (deliverables/20260929/tree-map) is not touched.

   WHAT IS SETTLED (Alan, 2–3 Oct; never re-opened here): the camera starts 70° up; the red half is the green half mirrored
   in the zero plane (its own spiral from the centre, hanging down); walking down the steps; the coil's scale comes from the
   data (tread = reading × H, one H above and below zero, H lowered until the biggest drop ≤ one tread); the lists are read
   through the Hub mirror.

   THE GEOMETRY is T9/T10's: an Archimedean spiral r = A + Bθ walked in even steps of arc length D; A = 30, D = RW = 30,
   B = RW × 1.04 / 2π, H = 260 → drop cap. Every number below that is a size comes from the T10 standard sheet
   (data/tree-standard.t10-e133a81.json), read at start — nothing is typed to taste.

   PASS 2 (the coordinator's five points on pass 1):
     1 FILL   the home view is fitted, not guessed: the camera distance is solved (bisection) so the coil's projected height
              is 80 % of the view's height at any screen (1680 × 1050, 1920 × 1080, the phone). api.fill() measures it.
     2 LEGIBLE every painted label (the reading face and the outer face of a step) is turned each frame by its facing angle:
              if its own x axis points screen-left it is mirrored → scale.x = −1; if its y axis points screen-down it is
              upside down → scale.y = −1. So every ticker and value reads left-to-right, upright, from any angle, and still
              moves with its step. The ticker spans the tread (96 of 256 texture px). api.labelCheck() counts the wrong ones.
     3 LIGHT  the form is light, not plastic: a dark translucent body (18 %), a thin bright frame on the tread, a beam (a
              bright core + a soft halo) from the zero plane to the reading, hairline verticals, UnrealBloom on every direction;
              the glow's strength = 0.35 + 0.65 × |reading| (a strong reading burns brighter). No lit slabs, no lights.
              References followed: three.js webgl_postprocessing_unreal_bloom (the bloom chain and threshold), EdgesGeometry /
              LineSegments wire frames (the three.js "lines" examples), the Hub's own Geiger bar (its box-shadow glow in its
              own colour), and FUI work of the Territory-Studio kind (thin emissive strokes on dark glass, nothing filled).
     4 RED    the red half shows at 70° because nothing green is opaque any more: the bodies are 18 % glass and the treads
              are a frame with a 22 % plate, so the red frames, beams and labels read through them. api.pixelShare() measures
              the red and green shares of the lit pixels.
     5 FPS    the page prints fps only while MEASURE FPS runs (index.html).
   THE THREE DIRECTIONS share that grammar and differ in what the light is:
     A · LASER       the beam is the form: core + halo, bloom 0.9; a change flares the beam (320 ms) and the height eases (600 ms).
     B · LIGHT-GUIDE every edge of the step is a cyan hairline, the tread frame carries the direction colour, no beam; a change
                     runs a bead of light from the zero plane to the tip (420 ms).
     C · HOLOGRAM    additive plates with a fresnel rim and scanlines, the tread a bright frame; a change re-materialises the
                     plate with a vertical wipe (400 ms); a name that scintillated today flickers once every 20 s. */
import * as THREE from "three";
import { TrackballControls } from "three/addons/controls/TrackballControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { labelPx, thinLabels, worldHeightForPx, LABEL_RULE } from "./label-scale.mjs";
import { layoutFront, makeFrontState, FRONT_RULE } from "./label-scale.mjs"; // pass 6

const HUB = { bg: 0x0a0a0f, bull: 0x00ffa3, bear: 0xff2d55, crk: 0x00d4ff, ink: 0xf2f2f8, ink2: 0xc6c8de, dim: 0x868aaa, mute: 0x3a3a52, line: 0x1a1a2a, none: 0x3a3a52 };
const MONO = '"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace';
const FILL = 0.8; // the coil's projected height = this share of the view's height at home (the coordinator's point 1)
const CAP_R1T = 80; // pass 3 · the sphere's scale: $1 T of market cap = 80 U of radius (a tread is 30 U); volume ∝ Σ cap, so r = 80 × (Σcap / 1 T)^⅓
const CAP_GAP = 40; // U between two spheres side by side
const TEX = { w: 256, h: 128, tickerFs: 64, valueFs: Math.round(64 * LABEL_RULE.value_share), capShare: (64 * 0.72) / 128 }; // the label texture: the ticker's cap height is capShare of the sprite's height; the value is value_share (9/11) of the ticker (pass 4)
const BEAM = { core_over_type: 1.15, hot_over_core: 0.3, halo: (v) => 1.5 + 1.5 * Math.min(1, Math.abs(v == null ? 0 : v)) }; // pass 4 · the beam's core = 1.15 × the ticker's cap height in px (≥ the type at every zoom), in the step's colour; a white-hot line 0.3 of the core down its middle (the laser); the halo = core × (1.5 … 3.0) by the reading
const ZOOM = { per_tick: 0.946, tau_ms: 120, min_ratio: 0.12, max_ratio: 8 }; // pass 4 · the wheel: each 120 px of wheel scales the target distance by 0.946 (OrbitControls' own pace at zoomSpeed 0.9); the camera eases toward it with a 120 ms time constant
const MATTE = { edge_px: 1.25, flare_swell: 0.6, seg: 16 }; // pass 5 · the matte bar: a dark edge of 1.25 px all round (the inverted hull), a change swells the bar by 0.6 of its width for 320 ms
const SPIN = { rotate_speed: 1.25, was: 2.5, coast: 0.3 }; // pass 6 · HALF of pass 5's 2.5 (Alan: "it's sensitive"): the same drag turns the coil half as far; on release the turn still decays by √(1 − 0.3) a frame, about half a second
const LASER = { foot: 1.5, hot: 0.2, body: 0.55, body_to: 0.55, dim: 0.28, dim_hover: 0.62, lift: 1.35 }; // pass 6 · the contained laser. The footprint = 1.5 × pass 5's bar. Across it (d = 0 on the axis, 1 on the outline): the hot line — full colour — out to d = 0.2 (pass 4's 0.3 of the beam); the body at 0.55 out to d = 0.55, then fading to exactly 0 at d = 1. A hovered bar is 1.35 × as wide and the others drop to 0.28 when a row of the list points at it (0.62 when the mouse is on the bar itself, so the coil does not go dark under the hand)
const BLOOM = { laser: { s: 0.3, r: 0.3, t: 0 }, guide: { s: 0.3, r: 0.28, t: 0 }, holo: { s: 0.32, r: 0.3, t: 0 } }; // PASS 4: the bloom is proportional — threshold 0, so every emitter glows by its own brightness (green 00FFA3 and red FF2D55 have nearly the same length, 1.19 vs 1.07). Pass 3's threshold 0.78 was a LUMINANCE gate: the green (0.76 per unit) passed, the red (0.36 per unit) never did — that is why the red half was dim. Strength 0.3 (was 0.42) because everything now contributes

export function mountCoil(host, opts) {
  const STD = opts.standard, P = STD.podium, CAM = P.camera;
  const PAR = { A: P.inner_radius, D: P.step_w, RW: P.tread_depth, B: (P.tread_depth * 1.04) / (2 * Math.PI), H: P.H_max, H_MIN: P.H_min, DROP: P.tread_depth };
  const HOME = { el: 70, az: CAM.home_az, fov: CAM.fov }; // 70° is settled (Alan); the sheet's 24° stays a note, not a choice to make again
  const CAPS = opts.caps || {}; let boxes = !!opts.boxes, capMode = opts.capMode || "sphere"; // pass 3
  let look = opts.look === "glow" ? "glow" : opts.look === "matte" ? "matte" : "laser"; // pass 6 · laser = the contained laser (the default); matte = pass 5's opaque bars with a dark edge; glow = pass 4's additive beams and bloom
  const diag = { bloom: true, additive: true, hot: true, halo: true, sphere: true, fog: true, labels: true }; // pass 5 · the glow look's layers, switched one at a time by the proof to name the cause
  const capOf = (t) => { const c = Number(CAPS[t]); return Number.isFinite(c) && c > 0 ? c : null; };

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(HUB.bg, 1); renderer.info.autoReset = false; renderer.toneMapping = THREE.NoToneMapping;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const fog = new THREE.Fog(HUB.bg, 1800, 5200); // the glow look only (pass 5: fog darkens a far bar, so the matte look has none)
  const camera = new THREE.PerspectiveCamera(HOME.fov, 1, 1, 12000);
  // pass 5 · FREE SPIN: a trackball (three.js TrackballControls) — the camera's up turns with the drag, so there is no pole to lock on
  const controls = new TrackballControls(camera, renderer.domElement);
  controls.rotateSpeed = SPIN.rotate_speed; controls.staticMoving = false; controls.dynamicDampingFactor = SPIN.coast; controls.keys = ["", "", ""];
  controls.noZoom = true; /* pass 4: the wheel is ours (eased), see wheel() */ controls.noPan = false; controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

  // post: bloom on every direction (the light IS the form); strength per direction
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.32, 0.78); composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const view = { w: 1, h: 1 }, uView = { value: new THREE.Vector2(1, 1) }, uSolid = { value: 0 }; // pass 6 · the beam shader's view size (px) and the proof's switch (footprints drawn solid)
  let dirty = true, placed = null, home = null;
  controls.addEventListener("change", () => { dirty = true; });
  function fit() {
    view.w = host.clientWidth || 1; view.h = host.clientHeight || 1;
    renderer.setSize(view.w, view.h, false); composer.setSize(view.w, view.h);
    camera.aspect = view.w / view.h; camera.updateProjectionMatrix(); controls.handleResize(); dirty = true; uView.value.set(view.w, view.h);
    controls.rotateSpeed = SPIN.rotate_speed * (view.w / Math.max(view.w, opts.spinWidth ? opts.spinWidth() || 0 : 0)); // pass 6 · the trackball measures a drag as a share of ITS pane's width; the list made the pane narrower, so the speed is scaled back to the full stage — a px of drag is exactly half of pass 5's on the same screen
    if (placed && home) { home = framing(HOME.el, homeAz()); }
  }
  new ResizeObserver(fit).observe(host); fit();

  /* ---- the places: ONE rule for every step (T9/T10) ---- */
  const spiralAt = (i) => { const s = (i + 0.5) * PAR.D, th = (-PAR.A + Math.sqrt(PAR.A * PAR.A + 2 * PAR.B * s)) / PAR.B; return { th, r: PAR.A + PAR.B * th }; };
  function place(rows) {
    const read = rows.filter((r) => r.v != null), none = rows.filter((r) => r.v == null);
    const ups = read.filter((r) => r.v >= 0).sort((a, b) => b.v - a.v || (a.t < b.t ? -1 : 1));
    const dns = read.filter((r) => r.v < 0).sort((a, b) => a.v - b.v || (a.t < b.t ? -1 : 1));
    let maxGap = 0; const all = [...ups, ...dns.slice().reverse()];
    for (let i = 1; i < all.length; i++) maxGap = Math.max(maxGap, Math.abs(all[i - 1].v - all[i].v));
    const H = Math.max(PAR.H_MIN, Math.min(PAR.H, maxGap > 0 ? PAR.DROP / maxGap : PAR.H));
    const out = [];
    ups.forEach((r, i) => { const { th, r: rad } = spiralAt(i); out.push({ ...r, side: 1, i, th, r: rad, tip: r.v * H }); });
    dns.forEach((r, i) => { const { th, r: rad } = spiralAt(i); out.push({ ...r, side: -1, i, th: -th, r: rad, tip: r.v * H }); }); // the mirror: reflected, so it turns the other way as a reflection does
    none.forEach((r, k) => { const i = dns.length + k, { th, r: rad } = spiralAt(i); out.push({ ...r, side: -1, i, th: -th, r: rad, tip: (dns.length ? dns[dns.length - 1].v * H : 0) - (k + 1) * PAR.D * 0.25, none: true }); });
    return { steps: out, H, ups: ups.length, dns: dns.length, none: none.length, outerR: (out.length ? Math.max(...out.map((s) => s.r)) : PAR.A) + PAR.RW / 2 + 6 };
  }

  /* ---- pass 3: the label is a sprite (ticker over its value, 256 × 128), drawn in its own pass after the bloom so it stays crisp ---- */
  const texCache = new Map();
  const hex = (c) => "#" + c.toString(16).padStart(6, "0");
  function labelTex(t, v, col, extra) {
    const k = t + "|" + (v == null ? "" : v.toFixed(2)) + "|" + col + "|" + (extra || "");
    if (texCache.has(k)) return texCache.get(k);
    const c = document.createElement("canvas"); c.width = TEX.w; c.height = TEX.h; const g = c.getContext("2d");
    g.clearRect(0, 0, TEX.w, TEX.h); g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `700 ${TEX.tickerFs}px ${MONO}`; let tw = g.measureText(t).width; if (tw > TEX.w - 8) { g.font = `700 ${Math.floor(TEX.tickerFs * (TEX.w - 8) / tw)}px ${MONO}`; tw = TEX.w - 8; }
    // pass 4 · NO RECTANGLES: painted type only — a dark outline (16 % of the size, round joins) under a soft dark glow gives the contrast the chip gave
    const ink = (txt, x, y, fs, fill) => { g.lineJoin = "round"; g.lineWidth = Math.max(3, fs * 0.16); g.strokeStyle = "rgba(6,6,10,0.9)"; g.shadowColor = "rgba(0,0,0,0.9)"; g.shadowBlur = Math.max(4, fs * 0.22); g.strokeText(txt, x, y); g.shadowBlur = 0; g.fillStyle = fill; g.fillText(txt, x, y); };
    ink(t, TEX.w / 2, 40, TEX.tickerFs, "#f2f2f8");
    let inkW = tw + 12, inkH = v != null || extra ? 118 : 56;
    if (v != null || extra) { g.font = `600 ${TEX.valueFs}px ${MONO}`; const txt = (v != null ? (v >= 0 ? "+" : "") + v.toFixed(2) : "") + (extra ? (v != null ? " " : "") + extra : ""); let vw = g.measureText(txt).width; if (vw > TEX.w - 8) { g.font = `600 ${Math.floor(TEX.valueFs * (TEX.w - 8) / vw)}px ${MONO}`; vw = TEX.w - 8; } inkW = Math.max(inkW, vw + 12); ink(txt, TEX.w / 2, 96, TEX.valueFs, hex(col)); }
    const tex = new THREE.CanvasTexture(c); tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace; tex.userData = { inkW: inkW / TEX.w, inkH: inkH / TEX.h }; texCache.set(k, tex); return tex;
  }
  const fmtCap = (c) => c >= 1e12 ? "$" + (c / 1e12).toFixed(c >= 1e13 ? 0 : 1) + "T" : c >= 1e9 ? "$" + (c / 1e9).toFixed(c >= 1e11 ? 0 : 1) + "B" : "$" + (c / 1e6).toFixed(0) + "M";
  const labelScene = new THREE.Scene(); // the second pass
  function makeLabel(s, col) {
    const cap = capOf(s.t);
    const m = new THREE.SpriteMaterial({ map: labelTex(s.t, s.none ? null : s.v, col, capMode === "width" && cap ? fmtCap(cap) : ""), transparent: true, depthWrite: false, depthTest: false, toneMapped: false });
    const sp = new THREE.Sprite(m); sp.renderOrder = 10; sp.userData = { t: s.t, pri: s.none ? 0 : Math.abs(s.v), px: 0, shown: true }; labelScene.add(sp); return sp;
  }

  /* ---- the group, rebuilt per direction ---- */
  let group = null, parts = [], mode = "laser", data = null, t0 = performance.now();
  const Y = new THREE.Vector3(0, 1, 0);
  const scintSet = new Set(opts.scintillas || []);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1), edgesGeo = new THREE.EdgesGeometry(boxGeo);
  // the tread's frame: the four edges of the top face (a unit square in x/z at y = 0)
  const frameGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 0, -0.5), new THREE.Vector3(0.5, 0, -0.5), new THREE.Vector3(0.5, 0, 0.5), new THREE.Vector3(0.5, 0, 0.5), new THREE.Vector3(-0.5, 0, 0.5), new THREE.Vector3(-0.5, 0, 0.5), new THREE.Vector3(-0.5, 0, -0.5)]);
  const vertsGeo = new THREE.BufferGeometry().setFromPoints([-0.5, 0.5].flatMap((x) => [-0.5, 0.5].flatMap((z) => [new THREE.Vector3(x, -0.5, z), new THREE.Vector3(x, 0.5, z)])));
  const barGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, MATTE.seg, 1, false); // pass 5 · the matte bar: a closed cylinder, unit diameter and height
  const coreGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1, true), haloGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, true); // pass 4: unit diameter — the width is set in screen px each frame (layoutLabels)
  const plateGeo = new THREE.PlaneGeometry(1, 1);
  /* pass 6 · THE CONTAINED LASER. One quad per bar; the vertex shader projects the bar's two ends (local 0, ±0.5, 0 through the same
     matrix a cylinder would have), and lays the quad out in SCREEN space as a capsule round that segment, half as wide as the bar's
     world width prints at each end. The fragment's d is the distance to the segment in half-widths: 0 on the axis, 1 on the outline.
     alpha(d) = body × (1 − smoothstep(body_to, 1, d)) + (1 − body) × (hot line), which is 0 at d = 1 — nothing is drawn on or past the outline. */
  const beamGeo = new THREE.BufferGeometry(); beamGeo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)); beamGeo.setIndex([0, 1, 2, 0, 2, 3]);
  function beamMat(col) {
    return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: THREE.NormalBlending, side: THREE.DoubleSide, toneMapped: false,
      uniforms: { uCol: { value: new THREE.Color(col) }, uOp: { value: 1 }, uView, uSolid, uHot: { value: LASER.hot }, uBody: { value: LASER.body }, uBodyTo: { value: LASER.body_to } },
      vertexShader: `uniform vec2 uView; varying vec2 vQ; varying float vL;
        void main(){
          vec4 a = modelViewMatrix * vec4(0.0, -0.5, 0.0, 1.0), b = modelViewMatrix * vec4(0.0, 0.5, 0.0, 1.0); float rW = 0.5 * length(modelMatrix[0].xyz), nz = -2.0;
          if (a.z > nz && b.z > nz) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vQ = vec2(0.0); vL = 0.0; return; } // wholly behind the camera
          if (a.z > nz) a = mix(b, a, (nz - b.z) / (a.z - b.z)); else if (b.z > nz) b = mix(a, b, (nz - a.z) / (b.z - a.z));
          vec4 ca = projectionMatrix * a, cb = projectionMatrix * b; vec2 hv = 0.5 * uView;
          vec2 sa = ca.xy / ca.w * hv, sb = cb.xy / cb.w * hv; float pa = rW * projectionMatrix[1][1] / ca.w * hv.y, pb = rW * projectionMatrix[1][1] / cb.w * hv.y;
          vec2 dir = sb - sa; float len = length(dir); dir = len > 1e-4 ? dir / len : vec2(0.0, 1.0); vec2 nrm = vec2(-dir.y, dir.x);
          float e = position.y; vec2 s = e < 0.0 ? sa : sb; float r = e < 0.0 ? pa : pb, z = e < 0.0 ? ca.z / ca.w : cb.z / cb.w;
          vL = len / (0.5 * (pa + pb)); vQ = vec2(position.x, e < 0.0 ? -1.0 : vL + 1.0);
          gl_Position = vec4((s + dir * e * r + nrm * position.x * r) / hv, z, 1.0);
        }`,
      fragmentShader: `uniform vec3 uCol; uniform float uOp; uniform float uSolid; uniform float uHot; uniform float uBody; uniform float uBodyTo; varying vec2 vQ; varying float vL;
        void main(){
          float d = length(vec2(vQ.x, max(max(-vQ.y, vQ.y - vL), 0.0))); if (d >= 1.0) discard;
          float a = uSolid > 0.5 ? 1.0 : (uBody * (1.0 - smoothstep(uBodyTo, 1.0, d)) + (1.0 - uBody) * (1.0 - smoothstep(uHot - 0.06, uHot + 0.06, d))) * uOp;
          gl_FragColor = vec4(uCol, a);
          #include <colorspace_fragment>
        }` });
  }

  function clear() { if (group) { scene.remove(group); group.traverse((o) => { if (o.geometry && ![boxGeo, edgesGeo, frameGeo, vertsGeo, coreGeo, haloGeo, plateGeo, barGeo, beamGeo].includes(o.geometry)) o.geometry.dispose(); if (o.material && !o.material.map) o.material.dispose(); }); } group = new THREE.Group(); scene.add(group); parts = []; for (const o of labelScene.children.slice()) { labelScene.remove(o); if (o.material && !o.material.map) o.material.dispose(); } spheres = []; }
  let sets = [], spheres = []; // pass 3: one or two placed sets, each with an x offset (ox) and, when capMode = sphere, its sphere

  const glow = (v) => 0.35 + 0.65 * Math.min(1, Math.abs(v == null ? 0 : v)); // the glow's strength follows the reading
  const lit = (col, k) => new THREE.Color(col).multiplyScalar(k); // a colour above 1 is what bloom picks up (toneMapped: false)
  /* pass 4 · RED = GREEN: the bloom threshold is a luminance (Rec. 709, as UnrealBloomPass's luminosity pass); green 00FFA3 has 0.76 of it
     per unit, red FF2D55 only 0.36 — at 0.78 the green bloomed and the red did not. The threshold is now 0.28 (BLOOM), under every core. */
  const LUM = (col) => { const c = new THREE.Color(col); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; }, LUM_GREEN = LUM(HUB.bull);
  const matte = () => look !== "glow" && mode === "laser"; // pass 5 · the flat pipeline (no composer, no fog): pass 5's matte bar and pass 6's contained laser
  const contained = () => look === "laser" && mode === "laser"; // pass 6
  const EQ = () => 1, litEq = (col, k) => lit(col, k); // (tried: scaling the red to the green's luminance — it clamps to pink-white in the core; the threshold is the right lever, see BLOOM)
  const lineMat = (col, k, op = 1) => new THREE.LineBasicMaterial({ color: lit(col, k), transparent: op < 1, opacity: op, toneMapped: false });
  const basic = (col, op, blend = THREE.NormalBlending, k = 1) => new THREE.MeshBasicMaterial({ color: lit(col, k), transparent: true, opacity: op, depthWrite: false, blending: blend, toneMapped: false, side: THREE.DoubleSide });
  const basicEq = (col, op, blend, k) => basic(col, op, blend, k * EQ(col)), lineMatEq = (col, k, op) => lineMat(col, k * EQ(col), op); // the step materials (pass 4)

  function zeroRing(outerR, ox = 0) {
    const pts = []; for (let i = 0; i <= 160; i++) pts.push(new THREE.Vector3(ox + outerR * Math.cos((i / 160) * Math.PI * 2), 0, outerR * Math.sin((i / 160) * Math.PI * 2)));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat(HUB.crk, 1.2, 0.9)));
    const band = new THREE.Mesh(new THREE.RingGeometry(PAR.A - PAR.RW / 2, PAR.A + PAR.RW / 2, 64), basic(HUB.line, 0.8)); band.rotation.x = -Math.PI / 2; band.position.x = ox; group.add(band); // the equator: the flat grey band (T10)
    const inner = new THREE.Mesh(new THREE.RingGeometry(outerR - 0.6, outerR, 160), basic(HUB.crk, 0.18, matte() ? THREE.NormalBlending : THREE.AdditiveBlending)); inner.rotation.x = -Math.PI / 2; inner.position.x = ox; group.add(inner);
  }
  function spine(top, bottom, ox = 0) { group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(ox, bottom - 10, 0), new THREE.Vector3(ox, top + 60, 0)]), lineMat(HUB.crk, 1, 0.35))); }
  /* pass 3 · the set's sphere: volume = Σ market cap. A glass body (fresnel rim, additive), its equator on the zero plane, and a
     title sprite above it: NAME · Σ cap · n names (m with a cap on file). Names without a cap on file (BTCUSD, GCUSD) are listed, not counted. */
  function sphereFor(set) {
    const r = set.capR; if (!r) return null;
    const body = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 48), matte() ? sphereRimMat(HUB.crk) : sphereMat(HUB.crk)); body.position.set(set.ox, 0, 0); body.renderOrder = -1; body.visible = matte() || diag.sphere; group.add(body);
    const eq = []; for (let i = 0; i <= 180; i++) eq.push(new THREE.Vector3(set.ox + r * Math.cos((i / 180) * Math.PI * 2), 0, r * Math.sin((i / 180) * Math.PI * 2)));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(eq), lineMat(HUB.crk, 1, 0.4)));
    const mer = []; for (let i = 0; i <= 180; i++) mer.push(new THREE.Vector3(set.ox, r * Math.cos((i / 180) * Math.PI * 2), r * Math.sin((i / 180) * Math.PI * 2))); group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(mer), lineMat(HUB.crk, 0.8, 0.22)));
    const title = new THREE.Sprite(new THREE.SpriteMaterial({ map: titleTex(set), transparent: true, depthWrite: false, depthTest: false, toneMapped: false })); title.renderOrder = 11; title.userData = { title: true, r, ox: set.ox }; labelScene.add(title);
    return { body, title, r, ox: set.ox, set };
  }
  function sphereMat(col) {
    return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide, // the near face only: a glass rim, not a filled ball
      uniforms: { uCol: { value: new THREE.Color(col) } },
      vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uCol; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(uCol * (0.004 + 0.11 * f), 1.0); }` });
  }
  // pass 5 · the matte sphere: its outline only — a thin cyan rim where the surface turns away, nothing over the bars inside it
  function sphereRimMat(col) {
    return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.NormalBlending, side: THREE.FrontSide,
      uniforms: { uCol: { value: new THREE.Color(col) } },
      vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uCol; varying vec3 vN; varying vec3 vV; void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); gl_FragColor = vec4(uCol, 0.5 * smoothstep(0.86, 0.985, f));
#include <colorspace_fragment>
}` });
  }
  function titleTex(set) {
    const c = document.createElement("canvas"); c.width = 768; c.height = 96; const g = c.getContext("2d"); g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `600 34px ${MONO}`; g.fillStyle = "#f2f2f8"; g.shadowColor = "#000"; g.shadowBlur = 6; g.fillText(`${(set.name || "SET").toUpperCase()} · ${fmtCap(set.capSum)}`, 384, 30);
    g.font = `500 22px ${MONO}`; g.fillStyle = "#c6c8de"; g.fillText(`${set.n} NAMES · ${set.nCap} WITH A CAP ON FILE · SPHERE r ${set.capR.toFixed(0)} U`, 384, 70);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
  }

  // a step's frame: the box from the zero plane to its tip (standing up, or hanging down), turned to the spiral's tangent
  function stepMatrix(s, h01, M4) {
    const w = ((PAR.D * (s.r + PAR.RW / 2)) / s.r) * (s.wk || 1), tip = s.tip * h01, y0 = Math.min(0, tip), y1 = Math.max(0, tip); // wk: pass 3's width share by market cap (1 unless capMode = width)
    const q = new THREE.Quaternion().setFromAxisAngle(Y, -(s.th + Math.PI / 2));
    M4.compose(new THREE.Vector3((s.ox || 0) + s.r * Math.cos(s.th), (y0 + y1) / 2, s.r * Math.sin(s.th)), q, new THREE.Vector3(w, Math.max(0.6, y1 - y0), PAR.RW));
    return { w, tip, q };
  }
  /* ---- pass 3 · the labels: placed at the step's tip each frame, sized by the zoom rule, thinned where they would overlap ---- */
  const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _right = new THREE.Vector3(), _up = new THREE.Vector3(), _fwd = new THREE.Vector3();
  const labelStats = { px: 0, value_px: 0, raw: 0, at: "", shown: 0, hidden: 0, total: 0, home_d: 0, d: 0, core_u: 0, pops: 0 };
  let frontSt = makeFrontState(), lastLayout = performance.now(), relayout = false, hiT = null, hiStrong = false; // pass 6 · the front-row rule's memory; a layout owed next frame (a dwell is running or a slide is easing); the hovered ticker
  let prevShown = null; // pass 4 · the labels shown last frame (the hysteresis of the thinning); null = no last frame
  const hiddenAt = new Map(), HOLD_MS = 400; // pass 4 · a label that has just gone cannot come back for 400 ms (no overlap can follow from staying hidden) — the "out and straight back in" flicker
  const rec = { on: false, frames: [], lastD: null, inTick: false, wheels: 0, wheelDy: 0, wheelAbs: 0, flipAt: new Map(), reflips: 0 }; // pass 4 · api.record(): per rendered frame, the distance step and the label pops
  function layoutLabels() {
    if (!parts.length) return;
    camera.updateMatrixWorld(); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    camera.getWorldDirection(_fwd); _right.set(1, 0, 0).applyQuaternion(camera.quaternion); _up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const d = camera.position.distanceTo(controls.target), hd = home ? home.p.distanceTo(home.t) : d;
    const L = labelPx(d, hd, opts.screenH || window.innerHeight || view.h); const spriteH_px = L.px / TEX.capShare; // the sprite's printed height (the ticker's cap height is capShare of it)
    // pass 4 · the beam's core in world units: core_over_type × the ticker's cap height, converted at the target's depth (px → U = 2 d tan(fov/2) / viewH)
    const uPerPx = (2 * d * Math.tan((camera.fov * Math.PI) / 360)) / view.h, coreU = L.px * BEAM.core_over_type * uPerPx;
    Object.assign(labelStats, { px: +L.px.toFixed(1), value_px: +L.value_px.toFixed(1), raw: +L.raw.toFixed(1), at: L.at, home_d: +hd.toFixed(0), d: +d.toFixed(0), total: parts.length, core_u: +coreU.toFixed(2) });
    for (const p of parts) if (p.core) { const w = coreU * (p.s.wk || 1), hw = w * BEAM.halo(p.s.v);
      if (p.beam) { const lift = p.hi || 0; p.core.scale.x = p.core.scale.z = w * LASER.foot * (1 + MATTE.flare_swell * (p.flare || 0)) * (1 + (LASER.lift - 1) * lift); p.halo_u = w * LASER.foot; continue; } // pass 6 · the footprint; a hovered bar is wider
      if (p.edge) { const wf = w * (1 + MATTE.flare_swell * (p.flare || 0)), o = 2 * MATTE.edge_px * uPerPx; p.core.scale.x = p.core.scale.z = wf; p.edge.position.copy(p.core.position); p.edge.scale.set(wf + o, p.core.scale.y + o, wf + o); p.halo_u = w; continue; } // pass 5 · matte: the bar and its dark edge, both in screen px
      p.core.scale.x = p.core.scale.z = w; p.hot.scale.x = p.hot.scale.z = w * BEAM.hot_over_core; p.halo.scale.x = p.halo.scale.z = hw; }
    const items = [], uAt = (depth) => (2 * depth * Math.tan((camera.fov * Math.PI) / 360)) / view.h; // world units a px covers at that depth
    for (const p of parts) {
      const sp = p.lp, s = p.s, tip = s.tip * p.h, x = (s.ox || 0) + s.r * Math.cos(s.th), z = s.r * Math.sin(s.th);
      _p.set(x, tip, z); const depth = -_p.clone().applyMatrix4(camera.matrixWorldInverse).z; // the camera-space depth of the tip
      const hW = worldHeightForPx(spriteH_px, Math.max(1, depth), camera.fov, view.h); // the world height that prints spriteH_px here
      sp.scale.set(hW * (TEX.w / TEX.h), hW, 1);
      const by0 = tip + (s.tip >= 0 ? 1 : -1) * (hW * 0.5 + 1.5); // just past the step's end, above a green step, under a red one
      sp.userData.px = L.px; sp.userData.depth = depth;
      _q.set(x, by0, z).project(camera); if (_q.z >= 1 || depth <= 0) { sp.visible = false; continue; }
      const bx = ((_q.x + 1) / 2) * view.w, by = ((1 - _q.y) / 2) * view.h;
      _q.set(x, tip, z).project(camera); let ux = bx - ((_q.x + 1) / 2) * view.w, uy = by - ((1 - _q.y) / 2) * view.h; const ul = Math.hypot(ux, uy); if (ul < 2) { ux = 0; uy = -1; } else { ux /= ul; uy /= ul; } // the screen direction from the tip to its label: the way a front-row label slides (pass 6)
      const ink = sp.material.map.userData || { inkW: 0.9, inkH: 0.9 };
      items.push({ id: s.t + "|" + (s.ox || 0), x: bx, y: by, w: spriteH_px * (TEX.w / TEX.h) * ink.inkW, h: spriteH_px * ink.inkH, priority: sp.userData.pri, depth: -_q.set(x, 0, z).applyMatrix4(camera.matrixWorldInverse).z, tipDepth: depth, ux, uy, sp, wx: x, wy: by0, wz: z }); // depth = the bar's FOOT on the zero plane: the front row is the near edge of the coil's footprint, whatever the bars' heights
    }
    const now = performance.now(), dtL = Math.min(0.1, (now - lastLayout) / 1000); lastLayout = now;
    /* pass 6 · the front row always shows; the rest when clear; nothing changes twice within the dwell (label-scale.mjs · layoutFront) */
    const th = layoutFront(items, frontSt, now, FRONT_RULE, hiT ? hiT + "|" + (sets[0] ? sets[0].ox : 0) : null); let shown = 0, pops = 0; if (th.held) relayout = true;
    for (const it of items) { const vis = th.shown.has(it.id), sp = it.sp;
      const k = vis ? th.slot.get(it.id) || 0 : 0; let off = sp.userData.off ?? k; off += (k - off) * Math.min(1, dtL * 12); if (Math.abs(k - off) < 0.01) off = k; else relayout = true; sp.userData.off = off; // a slide is eased, never a jump
      const u = uAt(Math.max(1, it.tipDepth)) * off * (it.h + FRONT_RULE.slot_gap_px);
      sp.position.set(it.wx, it.wy, it.wz).addScaledVector(_right, it.ux * u).addScaledVector(_up, -it.uy * u);
      sp.visible = vis; sp.userData.shown = vis; sp.userData.front = th.front.has(it.id); if (vis) shown++;
      if (prevShown && prevShown.has(it.id) !== vis) { pops++; if (rec.on && rec.inTick) { const last = rec.flipAt.get(it.id); if (last != null && now - last < 500) rec.reflips++; rec.flipAt.set(it.id, now); } } } // a re-flip: the same label changing state again within 500 ms — the flicker Alan would see
    labelStats.shown = shown; labelStats.hidden = items.length - shown; labelStats.pops = pops; labelStats.front = th.n_front; labelStats.front_overlaps = th.overlaps; prevShown = th.shown;
    if (rec.on && rec.inTick) { rec.frames.push({ t: performance.now(), d: +d.toFixed(2), step: rec.lastD == null ? 0 : +(d - rec.lastD).toFixed(2), px: +L.px.toFixed(2), shown, pops }); rec.lastD = d; }
    for (const sph of spheres) { const t = sph.title; const depth = -_p.set(sph.ox, 0, 0).applyMatrix4(camera.matrixWorldInverse).z; const hW = worldHeightForPx(Math.max(11, L.px * 1.1) / (34 * 0.72 / 96), Math.max(1, depth), camera.fov, view.h); t.scale.set(hW * (768 / 96), hW, 1); t.position.set(sph.ox, 0, 0).add(_up.clone().multiplyScalar(sph.r + hW * 0.7 + 6)); } // above the sphere's outline from wherever the camera is
  }
  // the probe keeps pass 2's meaning: a label is wrong when its screen x axis points left or its y axis points down. A sprite's axes
  // are the camera's right and up, so this measures what a billboard promises: 0 wrong from any angle.
  function screenAxes(sp) {
    sp.getWorldPosition(_p); const c = _p.clone().project(camera);
    const px = _p.clone().add(_right.clone().multiplyScalar(sp.scale.x / 2)).project(camera), py = _p.clone().add(_up.clone().multiplyScalar(sp.scale.y / 2)).project(camera);
    return { rx: px.x - c.x, ry: py.y - c.y, onScreen: Math.abs(c.x) <= 1 && Math.abs(c.y) <= 1 && c.z < 1, h_px: Math.abs(py.y - c.y) * view.h }; // h_px: the sprite's full printed height (half height in NDC is Δ/2 of 2 → × view.h)
  }
  function orientAll() { layoutLabels(); }

  const colOf = (s) => (s.none ? HUB.none : s.side > 0 ? HUB.bull : HUB.bear);

  function build() {
    clear(); if (!sets.length) return;
    const B = BLOOM[mode]; bloom.strength = B.s; bloom.radius = B.r; bloom.threshold = B.t; bloom.enabled = diag.bloom; scene.fog = !matte() && diag.fog ? fog : null;
    const beamBlend = diag.additive ? THREE.AdditiveBlending : THREE.NormalBlending; // the proof's switch (glow look)
    for (const set of sets) {
      const pl = set.placed, top = Math.max(0, ...pl.steps.map((s) => s.tip)), bottom = Math.min(0, ...pl.steps.map((s) => s.tip));
      zeroRing(pl.outerR, set.ox); spine(top, bottom, set.ox);
      if (capMode === "sphere") { const sph = sphereFor(set); if (sph) spheres.push(sph); }
      for (const s of pl.steps) {
        s.ox = set.ox; s.wk = capMode === "width" ? widthShare(s.t, set) : 1;
        const col = colOf(s), k = glow(s.v), part = { s, h: 0, target: 1, flare: 0, scan: 0, wipe: 0, scint: scintSet.has(s.t), k };
        if (mode !== "laser" || boxes) part.frame = new THREE.LineSegments(frameGeo, lineMatEq(col, 0.9 + 0.5 * k)); // the tread's edge: a bright thin frame — the guide's and the hologram's light. PASS 4: the LASER step has none (Alan: "I hate these boxes") — it is its beam and its type; V2b's boxes bring it back for the side-by-side
        if (mode === "laser") {
          if (contained()) { // pass 6 · the contained laser: one screen-space capsule in the step's own colour, its glow inside its own outline
            part.core = new THREE.Mesh(beamGeo, beamMat(col)); part.core.frustumCulled = false; part.core.renderOrder = 2; part.beam = true; group.add(part.core);
          } else if (matte()) { // pass 5 · MATTE: one opaque unlit cylinder in the step's own colour (nothing summed, nothing lit — the same green or red from every angle), and its dark edge
            part.core = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: col, toneMapped: false, fog: false }));
            part.edge = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: HUB.bg, side: THREE.BackSide, toneMapped: false, fog: false })); // the inverted hull: the back faces of a slightly bigger bar, in the page's colour — a 1.25 px edge against whatever stands behind
            group.add(part.edge, part.core);
          } else {
          part.core = new THREE.Mesh(coreGeo, basicEq(col, 0.7, beamBlend, 0.65 + 0.3 * k)); // the laser (pass 4): a tube in the step's colour, as wide as the type…
          part.hot = new THREE.Mesh(coreGeo, basicEq(col, 1, beamBlend, 1.3 + 0.7 * k)); part.hot.visible = diag.hot; // …a white-hot line down its middle (above 1 → it burns white)…
          part.halo = new THREE.Mesh(haloGeo, basicEq(col, 0.02 + 0.045 * k, beamBlend, 1)); part.halo.visible = diag.halo; // …in a soft halo
          group.add(part.halo, part.core, part.hot);
          }
          if (part.frame) group.add(part.frame);
          if (boxes) { // V2b's column boxes, for the side-by-side only
            part.body = new THREE.Mesh(boxGeo, basic(col, 0.06, THREE.NormalBlending, 0.35)); part.verts = new THREE.LineSegments(vertsGeo, lineMat(col, 0.8, 0.18)); part.plate = new THREE.Mesh(plateGeo, basic(col, 0.08, THREE.NormalBlending, 0.5)); group.add(part.body, part.verts, part.plate);
          }
        } else if (mode === "guide") {
          part.bead = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), basic(0xffffff, 1, THREE.AdditiveBlending, 2)); part.bead.visible = false; group.add(part.frame, part.bead);
          if (boxes) { part.body = new THREE.Mesh(boxGeo, basic(HUB.crk, 0.03)); part.edges = new THREE.LineSegments(edgesGeo, lineMat(HUB.crk, 0.8, 0.4)); part.plate = new THREE.Mesh(plateGeo, basic(col, 0.1, THREE.NormalBlending, 0.5)); group.add(part.body, part.edges, part.plate); }
          else { part.edges = new THREE.LineSegments(vertsGeo, lineMat(HUB.crk, 0.8, 0.4)); group.add(part.edges); } // without the box the guide keeps only its verticals as the light
        } else {
          part.body = new THREE.Mesh(boxGeo, holoMat(col, boxes ? 0.004 : 0.0, boxes ? 0.06 * k : 0.03 * k)); group.add(part.body, part.frame); // the hologram's rim is its light; without boxes the body itself is nothing
          if (boxes) { part.plate = new THREE.Mesh(plateGeo, basic(col, 0.06 + 0.06 * k, THREE.AdditiveBlending, 0.7)); group.add(part.plate); }
        }
        if (boxes) { part.base = new THREE.LineSegments(frameGeo, lineMat(col, 0.7, 0.55)); group.add(part.base); if (s.side < 0 && !s.none) { part.floor = new THREE.Mesh(plateGeo, basic(col, 0.42, THREE.AdditiveBlending, 0.7)); group.add(part.floor); } }
        part.lp = makeLabel(s, col);
        parts.push(part);
      }
    }
    prevShown = null; hiddenAt.clear(); frontSt = makeFrontState(); applyHi(); dirty = true; landAt = performance.now();
  }
  /* pass 3 · the alternative: a step's width = its market cap. Share of the slot = (cap ÷ the set's biggest cap)^⅓, floor 0.2 — the same
     cube root as the sphere, so widths compare like radii; a name without a cap on file gets the floor. */
  function widthShare(t, set) { const c = capOf(t); if (!c || !set.capMax) return 0.2; return Math.max(0.2, Math.min(1, Math.cbrt(c / set.capMax))); }
  // hologram: additive translucent plate with a fresnel rim, scanlines, and a vertical wipe (uWipe 0..1 reveals from the zero plane)
  function holoMat(col, body = 0.1, fres = 0.55) {
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uCol: { value: new THREE.Color(col) }, uWipe: { value: 1 }, uFlick: { value: 0 }, uBody: { value: body }, uFres: { value: fres }, uH: { value: 1 } },
      vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uCol; uniform float uWipe; uniform float uFlick; uniform float uBody; uniform float uFres; uniform float uH; varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.4); float y = vP.y + 0.5; if (y > uWipe) discard;
          float scan = 0.5 + 0.5 * sin(y * uH * 1.3); float body = uBody * (0.6 + 0.8 * scan) + uFres * f; float edge = smoothstep(0.97, 1.0, y / max(uWipe, 1e-3)) * 0.35;
          gl_FragColor = vec4(uCol * (body + edge + uFlick), 1.0); }`,
    });
  }

  /* ---- the frame: sizes from the data each frame (a height eases toward its target) ---- */
  const M4 = new THREE.Matrix4(), ease = (k) => 1 - Math.pow(1 - k, 3);
  let landAt = 0, lastT = performance.now();
  const setM = (o, M) => { o.matrix.copy(M); o.matrixAutoUpdate = false; o.matrixWorldNeedsUpdate = true; };
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    controls.update(); const moved = false; // pass 5: the trackball says "change" (→ dirty) when the camera has turned or is still coasting
    let busy = false;
    for (const p of parts) {
      const delay = p.s.i * 28, k = Math.min(1, Math.max(0, (now - landAt - delay) / 900));
      let h = p.h;
      if (p.landing !== false) { h = ease(k) * p.target; if (k >= 1) p.landing = false; busy = true; }
      else if (Math.abs(p.target - p.h) > 1e-3) { h += (p.target - h) * Math.min(1, dt * 7); if (Math.abs(p.target - h) < 1e-3) h = p.target; busy = true; }
      if (h !== p.h) { p.h = h; p.moved = true; }
      if (p.moved) {
        const { w, tip, q } = stepMatrix(p.s, p.h, M4);
        const x = (p.s.ox || 0) + p.s.r * Math.cos(p.s.th), z = p.s.r * Math.sin(p.s.th), wk = p.s.wk || 1;
        if (p.body) setM(p.body, M4); if (p.verts) setM(p.verts, M4); if (p.edges) setM(p.edges, M4);
        if (p.frame) { p.frame.position.set(x, tip, z); p.frame.quaternion.copy(q); p.frame.scale.set(w, 1, PAR.RW); }
        if (p.base) { p.base.position.set(x, 0, z); p.base.quaternion.copy(q); p.base.scale.set(w, 1, PAR.RW); }
        if (p.floor) { p.floor.position.set(x, -0.3, z); p.floor.quaternion.copy(q); p.floor.rotateX(-Math.PI / 2); p.floor.scale.set(w, PAR.RW, 1); }
        if (p.plate) { p.plate.position.set(x, tip + (tip >= 0 ? -0.15 : 0.15), z); p.plate.quaternion.copy(q); p.plate.rotateX(-Math.PI / 2); p.plate.scale.set(w, PAR.RW, 1); }
        if (p.core) { p.core.position.set(x, tip / 2, z); p.core.scale.y = Math.max(0.1, Math.abs(tip)); if (p.halo) { p.halo.position.copy(p.core.position); p.halo.scale.y = p.core.scale.y; p.hot.position.copy(p.core.position); p.hot.scale.y = p.core.scale.y; } } // the width (x, z) is set in screen px each frame by layoutLabels (pass 4)
        if (mode === "holo" && p.body) p.body.material.uniforms.uH.value = Math.max(1, Math.abs(tip));
        p.moved = false; dirty = true;
      }
      // motion with a meaning: a flare / a scan / a wipe runs only when a value lands or changes
      if (mode === "laser" && p.flare > 0 && (p.edge || p.beam)) { p.flare = Math.max(0, p.flare - dt / 0.32); busy = true; } // pass 5 · matte: the bar itself flashes — it swells and settles (layoutLabels sets the width), its colour never changes
      else if (mode === "laser" && p.flare > 0) { p.flare = Math.max(0, p.flare - dt / 0.32); p.hot.material.color.copy(litEq(colOf(p.s), 1.3 + 0.7 * p.k + 1.6 * p.flare)); p.halo.material.opacity = 0.02 + 0.045 * p.k + 0.3 * p.flare; if (p.body) p.body.material.opacity = 0.06 + 0.25 * p.flare; busy = true; }
      if (mode === "guide" && p.scan > 0) { p.scan = Math.max(0, p.scan - dt / 0.42); const u = 1 - p.scan, tip = p.s.tip * p.h; p.bead.visible = true; p.bead.position.set((p.s.ox || 0) + p.s.r * Math.cos(p.s.th), tip * u, p.s.r * Math.sin(p.s.th)); p.edges.material.opacity = 0.4 + 0.6 * p.scan; if (p.scan <= 0) { p.bead.visible = false; p.edges.material.opacity = 0.4; } busy = true; }
      if (mode === "holo" && p.body) {
        if (p.wipe > 0) { p.wipe = Math.max(0, p.wipe - dt / 0.4); p.body.material.uniforms.uWipe.value = 1 - p.wipe; p.body.material.uniforms.uFlick.value = p.wipe * 0.6; busy = true; }
        else if (p.scint) { const ph = ((now - t0) / 1000) % 20; const f = ph < 0.5 ? Math.sin((ph / 0.5) * Math.PI) : 0; if (f !== p.body.material.uniforms.uFlick.value) { p.body.material.uniforms.uFlick.value = f * 0.35; busy = true; } } // once every 20 s, the Hub's "soon" cadence
      }
    }
    if (zoomS.target) { // pass 4 · the eased zoom: the distance follows the wheel's target with a 120 ms time constant, every frame
      const d = camera.position.distanceTo(controls.target), gap = zoomS.target - d;
      if (Math.abs(gap) < 0.02) { setDistance(zoomS.target); zoomS.target = 0; } else setDistance(d + gap * (1 - Math.exp(-(dt * 1000) / ZOOM.tau_ms)));
      camera.lookAt(controls.target); busy = true;
    }
    if (moveTo) { // pass 5 · the way home turns the whole camera (its direction AND its up) along the shortest arc, so a view left upside down comes back upright without a flip
      const k = ease(Math.min(1, (now - moveTo.t0) / moveTo.ms)); _mq.slerpQuaternions(moveTo.from.q, moveTo.to.q, k); controls.target.lerpVectors(moveTo.from.t, moveTo.to.t, k);
      camera.up.set(0, 1, 0).applyQuaternion(_mq); camera.position.set(0, 0, 1).applyQuaternion(_mq).multiplyScalar(moveTo.from.d + (moveTo.to.d - moveTo.from.d) * k).add(controls.target); camera.lookAt(controls.target);
      if (k >= 1) { camera.up.set(0, 1, 0); camera.position.copy(moveTo.to.p); camera.lookAt(controls.target); moveTo = null; } busy = true; }
    if (busy || moved || dirty || measuring) {
      camera.updateMatrixWorld(); rec.inTick = true; orientAll(); rec.inTick = false; // only a rendered frame counts in the record
      renderer.info.reset(); const r0 = performance.now(); renderAll(); if (measuring) { meas.ms += performance.now() - r0; meas.n++; meas.tris = renderer.info.render.triangles; meas.calls = renderer.info.render.calls; }
      dirty = false; frames.n++; if (relayout) { relayout = false; dirty = true; }
    }
    if (now - frames.since >= 1000) { frames.fps = frames.n / ((now - frames.since) / 1000); frames.n = 0; frames.since = now; if (opts.onFps) opts.onFps(frames.fps); }
  }
  // pass 5 · matte renders straight to the screen (no bloom chain: nothing glows, and the canvas' own anti-aliasing applies); glow keeps pass 4's composer
  function renderAll() { if (matte()) { renderer.autoClear = true; renderer.render(scene, camera); } else composer.render(); if (diag.labels) { renderer.autoClear = false; renderer.render(labelScene, camera); renderer.autoClear = true; } }
  const _mq = new THREE.Quaternion(), _m4 = new THREE.Matrix4();
  const frames = { n: 0, since: performance.now(), fps: 0 };
  requestAnimationFrame(tick);

  /* ---- camera (point 1): the distance is solved so the coil's projected height = FILL of the view; 70° home; the full sphere ---- */
  let moveTo = null;
  /* pass 4 · the wheel: no dolly on the camera itself. A tick scales the TARGET distance; tick() eases the camera to it. The home fit
     (framing: the bisection) runs once per data load and on a resize — never on a wheel tick. */
  const zoomS = { target: 0 };
  const _dir = new THREE.Vector3();
  function setDistance(nd) { _dir.copy(camera.position).sub(controls.target).normalize(); camera.position.copy(controls.target).add(_dir.multiplyScalar(nd)); dirty = true; }
  function wheel(e) {
    if (!home) return; e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * view.h : e.deltaY; // lines / pages → px
    if (rec.on) { rec.wheels++; rec.wheelDy += dy; rec.wheelAbs += Math.abs(dy); }
    const hd = home.p.distanceTo(home.t), d = zoomS.target || camera.position.distanceTo(controls.target);
    zoomS.target = Math.max(hd * ZOOM.min_ratio, Math.min(hd * ZOOM.max_ratio, d * Math.pow(ZOOM.per_tick, -dy / 120))); moveTo = null; dirty = true;
  }
  renderer.domElement.addEventListener("wheel", wheel, { passive: false });
  const dirOf = (el, az) => { const e = (el * Math.PI) / 180, a = (az * Math.PI) / 180; return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).normalize(); };
  function coilPoints() {
    const pts = []; if (!sets.length) return pts;
    for (const set of sets) { const pl = set.placed, ox = set.ox;
      for (const s of pl.steps) { const x = ox + s.r * Math.cos(s.th), z = s.r * Math.sin(s.th), o = new THREE.Vector3(Math.cos(s.th), 0, Math.sin(s.th)).multiplyScalar(PAR.RW / 2), t = new THREE.Vector3(-Math.sin(s.th), 0, Math.cos(s.th)).multiplyScalar(PAR.D / 2);
        for (const y of [0, s.tip]) for (const a of [-1, 1]) for (const b of [-1, 1]) pts.push(new THREE.Vector3(x + a * o.x + b * t.x, y, z + a * o.z + b * t.z)); }
      const R = pl.outerR; for (let i = 0; i < 24; i++) pts.push(new THREE.Vector3(ox + R * Math.cos((i / 24) * Math.PI * 2), 0, R * Math.sin((i / 24) * Math.PI * 2)));
      if (capMode === "sphere" && set.capR) { const r = set.capR; for (let i = 0; i < 12; i++) for (let j = 1; j < 6; j++) { const a = (i / 12) * Math.PI * 2, b = (j / 6) * Math.PI; pts.push(new THREE.Vector3(ox + r * Math.sin(b) * Math.cos(a), r * Math.cos(b), r * Math.sin(b) * Math.sin(a))); } pts.push(new THREE.Vector3(ox, r + 30, 0), new THREE.Vector3(ox, -r, 0)); }
    }
    return pts;
  }
  const _cam = new THREE.PerspectiveCamera(), _v = new THREE.Vector3();
  function extent(pts, p, t) { // the projected extent of the points for a camera at p looking at t: {w, h} as shares of the view
    _cam.fov = camera.fov; _cam.aspect = camera.aspect; _cam.near = camera.near; _cam.far = camera.far; _cam.updateProjectionMatrix();
    _cam.position.copy(p); _cam.up.set(0, 1, 0); _cam.lookAt(t); _cam.updateMatrixWorld();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const q of pts) { _v.copy(q).project(_cam); x0 = Math.min(x0, _v.x); x1 = Math.max(x1, _v.x); y0 = Math.min(y0, _v.y); y1 = Math.max(y1, _v.y); }
    return { w: (x1 - x0) / 2, h: (y1 - y0) / 2, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }
  function framing(el, az, fill = FILL) {
    const pts = coilPoints(); if (!pts.length) return { p: new THREE.Vector3(0, 0, 500), t: new THREE.Vector3() };
    if (fill === FILL && sets.length > 1) fill = FILL * 0.9; // two sets side by side: a little air at the top and bottom
    const box = new THREE.Box3().setFromPoints(pts), c = box.getCenter(new THREE.Vector3()), dir = dirOf(el, az);
    let lo = 20, hi = 20000; // bisection on the distance: the projected height = fill of the view, the width never past 0.94
    for (let i = 0; i < 40; i++) { const d = (lo + hi) / 2, e = extent(pts, c.clone().add(dir.clone().multiplyScalar(d)), c); if (e.h > fill || e.w > 0.94) lo = d; else hi = d; }
    const d = hi, p = c.clone().add(dir.multiplyScalar(d));
    // centre the picture: shift the target so the projected box sits in the middle of the view
    const e = extent(pts, p, c), right = new THREE.Vector3().crossVectors(dir, Y).normalize().negate(), up = new THREE.Vector3().crossVectors(right, dir).normalize();
    const ndcPerUnit = 2 / (2 * d * Math.tan((camera.fov * Math.PI) / 360)); const t = c.clone().add(right.multiplyScalar((e.cx / ndcPerUnit) * camera.aspect)).add(up.multiplyScalar(e.cy / ndcPerUnit));
    return { p: t.clone().add(dirOf(el, az).multiplyScalar(d)), t };
  }
  const homeAz = () => (sets.length > 1 ? 0 : HOME.az); // two sets side by side sit level: the camera looks along z (az 0); one set keeps the sheet's azimuth
  const stopSpin = () => { controls._lastAngle = 0; }; // the coast ends when the camera is sent somewhere
  const quatOf = (p, t, up) => new THREE.Quaternion().setFromRotationMatrix(_m4.lookAt(p, t, up)); // the camera's attitude at p looking at t
  function flyHome(ms = 700) { if (!sets.length) return; zoomS.target = 0; stopSpin(); home = framing(HOME.el, homeAz()); if (!ms) { camera.up.set(0, 1, 0); camera.position.copy(home.p); controls.target.copy(home.t); camera.lookAt(home.t); moveTo = null; dirty = true; return; }
    camera.lookAt(controls.target); moveTo = { from: { q: camera.quaternion.clone(), t: controls.target.clone(), d: camera.position.distanceTo(controls.target) }, to: { q: quatOf(home.p, home.t, Y), t: home.t, p: home.p, d: home.p.distanceTo(home.t) }, t0: performance.now(), ms }; }
  renderer.domElement.addEventListener("pointerdown", () => { moveTo = null; }); // a drag takes over from a flight home
  renderer.domElement.addEventListener("dblclick", () => flyHome(700));

  /* ---- pass 6 · the hovered bar: it and its label stay full, the others step back; the list on the right drives it and is driven by it ---- */
  function applyHi() { for (const p of parts) { const me = hiT && p.s.t === hiT, other = hiT && !me; p.hi = me ? 1 : 0; if (p.beam) p.core.material.uniforms.uOp.value = other ? (hiStrong ? LASER.dim : LASER.dim_hover) : 1; if (p.lp) p.lp.material.opacity = other ? (hiStrong ? 0.35 : 0.75) : 1; } dirty = true; }
  function barAt(mx, my) { // the bar under a point (px in the view): the nearest to the camera whose footprint covers it
    camera.updateMatrixWorld(); let best = null, bd = Infinity; const f = (camera.projectionMatrix.elements[5] * view.h) / 2;
    for (const p of parts) { if (!p.core) continue; const x = (p.s.ox || 0) + p.s.r * Math.cos(p.s.th), z = p.s.r * Math.sin(p.s.th), tip = p.s.tip * p.h;
      const a = _p.set(x, 0, z).project(camera).clone(), b = _q.set(x, tip, z).project(camera); if (a.z >= 1 || b.z >= 1) continue;
      const ax = ((a.x + 1) / 2) * view.w, ay = ((1 - a.y) / 2) * view.h, bx = ((b.x + 1) / 2) * view.w, by = ((1 - b.y) / 2) * view.h, dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const k = l2 > 1e-6 ? Math.max(0, Math.min(1, ((mx - ax) * dx + (my - ay) * dy) / l2)) : 0, dist = Math.hypot(mx - ax - k * dx, my - ay - k * dy);
      const depth = -_v.set(x, tip / 2, z).applyMatrix4(camera.matrixWorldInverse).z; if (depth <= 0) continue; const rpx = Math.max(4, ((p.core.scale.x / 2) * f) / depth);
      if (dist <= rpx && depth < bd) { bd = depth; best = p.s.t; } }
    return best; }
  let hoverRaf = 0, dragging = false;
  renderer.domElement.addEventListener("pointerdown", () => { dragging = true; }); window.addEventListener("pointerup", () => { dragging = false; });
  renderer.domElement.addEventListener("pointermove", (e) => { if (dragging || hoverRaf) return; const r = renderer.domElement.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top; hoverRaf = requestAnimationFrame(() => { hoverRaf = 0; const t = barAt(mx, my); if (t !== hiT) { hiT = t; hiStrong = false; applyHi(); if (opts.onHover) opts.onHover(t); } }); });
  renderer.domElement.addEventListener("pointerleave", () => { if (hiT) { hiT = null; applyHi(); if (opts.onHover) opts.onHover(null); } });

  /* ---- public ---- */
  let measuring = false; const meas = { ms: 0, n: 0, tris: 0, calls: 0 };
  /* pass 3 · a set = { name, rows }; its market-cap sum, its sphere radius (CAP_R1T × (Σ / 1 T)^⅓), its x offset when two sit side by side */
  function makeSet(def) {
    const rows = def.rows.map((r) => ({ ...r })), caps = rows.map((r) => capOf(r.t)).filter(Boolean), capSum = caps.reduce((a, b) => a + b, 0);
    return { name: def.name || "", rows, placed: place(rows), n: rows.length, nCap: caps.length, capSum, capMax: caps.length ? Math.max(...caps) : 0, capR: capSum > 0 ? CAP_R1T * Math.cbrt(capSum / 1e12) : 0, ox: 0 };
  }
  function layoutSets() {
    if (sets.length < 2) { for (const s of sets) s.ox = 0; return; }
    const half = (s) => Math.max(capMode === "sphere" ? s.capR : 0, s.placed.outerR + PAR.RW); // half-width of each set's footprint
    const a = sets[0], b = sets[1]; a.ox = -(half(a) + CAP_GAP / 2); b.ox = half(b) + CAP_GAP / 2;
    for (const s of sets) for (const st of s.placed.steps) st.ox = s.ox;
  }
  const api = {
    setSets(defs, { land = true } = {}) {
      const prev = data ? new Map(data.map((r) => [r.t, r.v])) : null;
      sets = defs.map(makeSet); layoutSets(); placed = sets[0].placed; data = sets[0].rows;
      build();
      if (prev && !land) { for (const p of parts) { p.landing = false; p.h = 1; p.moved = true; const was = prev.get(p.s.t); if (was != null && Math.abs(was - (p.s.v ?? 0)) > 1e-6) api.pulse(p.s.t); } }
      if (!home) flyHome(0); else { home = framing(HOME.el, homeAz()); }
      dirty = true;
    },
    setData(rows, o = {}) { api.setSets([{ name: o.name || "", rows }], o); },
    sets: () => sets.map((s) => ({ name: s.name, n: s.n, nCap: s.nCap, capSum: s.capSum, capSumT: +(s.capSum / 1e12).toFixed(2), capR: +s.capR.toFixed(1), ox: +s.ox.toFixed(1), outerR: +s.placed.outerR.toFixed(1), H: +s.placed.H.toFixed(1), ups: s.placed.ups, dns: s.placed.dns, none: s.placed.none })),
    capScale: () => ({ r1T_units: CAP_R1T, rule: "r = " + CAP_R1T + " × (Σ market cap ÷ $1 T)^⅓ U; volume ∝ Σ market cap", mode: capMode }),
    setCapMode(m) { capMode = m; layoutSets(); build(); for (const p of parts) { p.landing = false; p.h = 1; p.moved = true; } flyHome(0); dirty = true; },
    setBoxes(b) { boxes = !!b; build(); for (const p of parts) { p.landing = false; p.h = 1; p.moved = true; } dirty = true; },
    boxes: () => boxes, capMode: () => capMode,
    pulse(t) { for (const p of parts) if (p.s.t === t) { if (mode === "laser") p.flare = 1; else if (mode === "guide") p.scan = 1; else p.wipe = 1; } dirty = true; },
    change(t, v) {
      if (!data) return; const r = data.find((x) => x.t === t); if (!r) return; r.v = v; const np = place(data); const step = np.steps.find((s) => s.t === t); const p = parts.find((q) => q.s.t === t && q.s.ox === sets[0].ox);
      if (step && p) { p.s.tip = step.tip; p.s.v = v; p.moved = true; p.landing = false; p.lp.material.map = labelTex(t, v, colOf(p.s), capMode === "width" && capOf(t) ? fmtCap(capOf(t)) : ""); p.lp.material.needsUpdate = true; p.lp.userData.pri = Math.abs(v); }
      api.pulse(t); dirty = true;
    },
    setMode(m) { mode = m; build(); for (const p of parts) { p.landing = false; p.h = 1; p.moved = true; } dirty = true; },
    land() { build(); dirty = true; },
    mode: () => mode, placed: () => placed, home: () => flyHome(700), orbitTo(el, az) { const h = framing(el, az); stopSpin(); camera.up.set(0, 1, 0); camera.position.copy(h.p); controls.target.copy(h.t); camera.lookAt(h.t); moveTo = null; zoomS.target = 0; dirty = true; },
    // pass 5 · the look (matte / glow), the glow look's layers for the proof, and the camera's attitude (its up and its direction — a trackball's up is free)
    look: () => look, setLook(l) { look = l === "glow" ? "glow" : l === "matte" ? "matte" : "laser"; build(); for (const p of parts) { p.landing = false; p.h = 1; p.moved = true; } dirty = true; },
    diag(o) { if (o) { Object.assign(diag, o); build(); for (const p of parts) { p.landing = false; p.h = 1; p.moved = true; } dirty = true; } return { ...diag }; },
    attitude() { const d = camera.position.clone().sub(controls.target), n = d.clone().normalize(); return { up: camera.up.toArray().map((x) => +x.toFixed(4)), dir: n.toArray().map((x) => +x.toFixed(4)), d: +d.length().toFixed(1), el: +((Math.asin(n.y) * 180) / Math.PI).toFixed(1), upside_down: camera.up.y < 0, moving: !!moveTo, coasting: Math.abs(controls._lastAngle) > 1e-4 }; },
    look_spec: () => ({ look, contained: contained(), laser: { ...LASER, blending: "NormalBlending (mixed, never summed)", alpha_at_the_outline: 0, depth: "no depth write, no depth test" }, front_rule: FRONT_RULE, matte: matte(), bar: { material: "MeshBasicMaterial (unlit), opaque, NormalBlending", bull: hex(HUB.bull), bear: hex(HUB.bear), edge_px: MATTE.edge_px }, bloom: !matte() && diag.bloom, fog: !!scene.fog, lights: scene.children.filter((o) => o.isLight).length, environment: !!scene.environment, toneMapping: renderer.toneMapping === THREE.NoToneMapping ? "none" : "on", controls: "TrackballControls", spin: { ...SPIN, in_use: +controls.rotateSpeed.toFixed(4) } }),
    // pass 3: zoom = the camera distance as a multiple of home's (0.5 = twice as close); the direction stays
    zoom(ratio) { if (!home) return; const hd = home.p.distanceTo(home.t); zoomS.target = 0; setDistance(hd * ratio); moveTo = null; dirty = true; camera.updateMatrixWorld(); layoutLabels(); return api.labelCheck(); },
    // pass 4: the same, eased — the way the wheel does it (the proof drives it both ways)
    zoomTo(ratio) { if (!home) return; zoomS.target = home.p.distanceTo(home.t) * ratio; moveTo = null; dirty = true; },
    zoomTarget: () => (zoomS.target ? +(zoomS.target / home.p.distanceTo(home.t)).toFixed(3) : null),
    // pass 4: the beam in px right now — core / halo / the ticker's cap height / the value, at the median LASER step on screen (and the min / max)
    beamPx() {
      camera.updateMatrixWorld(); layoutLabels(); const cores = [], halos = [];
      for (const p of parts) { if (!p.core || !p.lp.visible) continue; const depth = -_p.copy(p.core.position).applyMatrix4(camera.matrixWorldInverse).z; if (depth <= 0) continue; const uPx = (2 * depth * Math.tan((camera.fov * Math.PI) / 360)) / view.h; cores.push(p.core.scale.x / uPx); halos.push((p.halo ? p.halo.scale.x : p.core.scale.x) / uPx); }
      const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? +s[s.length >> 1].toFixed(1) : null; }, mn = (a) => (a.length ? +Math.min(...a).toFixed(1) : null), mx = (a) => (a.length ? +Math.max(...a).toFixed(1) : null);
      return { type_px: labelStats.px, value_px: labelStats.value_px, core_px: med(cores), core_px_min: mn(cores), core_px_max: mx(cores), halo_px: med(halos), halo_px_min: mn(halos), halo_px_max: mx(halos), core_over_type: cores.length ? +(med(cores) / labelStats.px).toFixed(2) : null, core_u: labelStats.core_u, distance_ratio: labelStats.home_d ? +(labelStats.d / labelStats.home_d).toFixed(3) : null, steps: cores.length };
    },
    // pass 4: record every rendered frame (distance, its step, the type px, labels shown, labels that popped in or out) → the zoom measurement
    record(on) { if (on) { rec.on = true; rec.frames = []; rec.lastD = null; rec.wheels = 0; rec.wheelDy = 0; rec.wheelAbs = 0; rec.flipAt = new Map(); rec.reflips = 0; return; } rec.on = false; const f = rec.frames; if (f.length < 2) return { frames: f.length };
      let net = 0; for (let i = 1; i < f.length; i++) net += Math.abs(f[i].shown - f[i - 1].shown); // the pops that are a real change of the shown count; the rest is flicker (a label out and another in, or one out and back)
      const moving = f.filter((x) => Math.abs(x.step) > 1e-3), t0 = f[0].t, t1 = f[f.length - 1].t, secs = (t1 - t0) / 1000;
      const travel = f.reduce((a, x) => a + Math.abs(x.step), 0), maxStep = Math.max(...f.map((x) => Math.abs(x.step))), pops = f.reduce((a, x) => a + x.pops, 0);
      let mt = 0; for (let i = 1; i < f.length; i++) if (Math.abs(f[i].step) > 1e-3) mt += f[i].t - f[i - 1].t; // the seconds the camera was moving
      const gaps = []; for (let i = 1; i < f.length; i++) if (Math.abs(f[i].step) > 1e-3 && Math.abs(f[i - 1].step) > 1e-3) gaps.push(f[i].t - f[i - 1].t);
      return { wheel_events: rec.wheels, wheel_px_net: rec.wheelDy, wheel_px_abs: rec.wheelAbs, frames: f.length, seconds: +secs.toFixed(2), net_changes: net, pops_beyond_net: pops - net, reflips_within_500ms: rec.reflips, reflips_per_second: secs ? +(rec.reflips / secs).toFixed(2) : null, moving_frames: moving.length, moving_seconds: +(mt / 1000).toFixed(2), fps_while_moving: mt ? +(moving.length / (mt / 1000)).toFixed(1) : null, fps_overall: +(f.length / secs).toFixed(1), travel_u: +travel.toFixed(1), max_frame_step_u: +maxStep.toFixed(2), max_frame_step_share_of_travel: travel ? +(maxStep / travel).toFixed(3) : null, longest_gap_ms_while_moving: gaps.length ? +Math.max(...gaps).toFixed(1) : null, pops, pops_per_second: secs ? +(pops / secs).toFixed(2) : null, px_min: Math.min(...f.map((x) => x.px)), px_max: Math.max(...f.map((x) => x.px)), d_min: Math.min(...f.map((x) => x.d)), d_max: Math.max(...f.map((x) => x.d)), trace: f.filter((_, i) => i % 3 === 0).map((x) => [+((x.t - t0) / 1000).toFixed(3), x.d, x.px, x.shown]) }; },
    // pass 3: each sphere's printed radius in px right now (its centre and centre + the camera's right × r, projected)
    spherePx() { camera.updateMatrixWorld(); _right.set(1, 0, 0).applyQuaternion(camera.quaternion); return spheres.map((sp) => { const c = new THREE.Vector3(sp.ox, 0, 0), e = c.clone().add(_right.clone().multiplyScalar(sp.r)); c.project(camera); e.project(camera); return { name: sp.set.name, capSumT: +(sp.set.capSum / 1e12).toFixed(2), r_units: +sp.r.toFixed(1), r_px: +(Math.abs(e.x - c.x) * view.w / 2).toFixed(1), px_per_T_of_radius_at_this_zoom: +((Math.abs(e.x - c.x) * view.w / 2) / sp.r * CAP_R1T).toFixed(1) }; }); },
    labelStats: () => { camera.updateMatrixWorld(); layoutLabels(); return { ...labelStats, rule: LABEL_RULE, beam: { core_over_type: BEAM.core_over_type, halo: "core × (2 + 2.5 × |reading|)" } }; },
    elevation() { const d = camera.position.clone().sub(controls.target); return { el: +((Math.asin(d.y / d.length()) * 180) / Math.PI).toFixed(1), az: +((Math.atan2(d.x, d.z) * 180) / Math.PI).toFixed(1), d: +d.length().toFixed(1) }; },
    // point 1: the share of the view's height and width the coil's projection covers right now
    fill() { camera.updateMatrixWorld(); const e = extent(coilPoints(), camera.position, controls.target); return { h: +e.h.toFixed(3), w: +e.w.toFixed(3), target: FILL, view: { w: view.w, h: view.h } }; },
    // point 2 (pass 3): every label shown, with its screen axes — wrong = reads mirrored or upside down (must be 0) — the ticker's printed px, and the thinning
    labelCheck() {
      camera.updateMatrixWorld(); layoutLabels(); const out = { labels: 0, wrong: 0, onScreen: 0, hidden_by_thinning: labelStats.hidden, rule_px: labelStats.px, rule_at: labelStats.at, distance_ratio: labelStats.home_d ? +(labelStats.d / labelStats.home_d).toFixed(3) : null, ticker_px: [] };
      for (const p of parts) { const m = p.lp; if (!m.visible) continue; out.labels++; const a = screenAxes(m); if (a.onScreen) out.onScreen++; if (a.rx < 0 || a.ry < 0) out.wrong++; if (a.onScreen) out.ticker_px.push(+(a.h_px * TEX.capShare).toFixed(1)); }
      const t = out.ticker_px.slice().sort((a, b) => a - b); out.ticker_px_median = t.length ? t[t.length >> 1] : null; out.ticker_px_min = t.length ? t[0] : null; out.ticker_px_max = t.length ? t[t.length - 1] : null; delete out.ticker_px; return out;
    },
    // point 4: render once and count the lit pixels by hue (red / green / cyan) — the red half must be plainly there at home
    pixelShare() {
      camera.updateMatrixWorld(); orientAll(); renderAll(); const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, buf = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      // a lit pixel is sorted by hue (red 330°–25°, green 110°–175°, cyan 175°–215°) when its saturation is above 0.25 — so red seen through green glass still counts as red
      let red = 0, green = 0, cyan = 0, lit = 0, redSum = 0, greenSum = 0, redHot = 0, greenHot = 0; for (let i = 0; i < buf.length; i += 4) { const r = buf[i], g = buf[i + 1], b = buf[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx < 70) continue; lit++; const sat = (mx - mn) / mx; if (sat < 0.25) continue; let h = mx === r ? ((g - b) / (mx - mn)) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4; h = ((h * 60) + 360) % 360; if (h >= 330 || h < 25) { red++; redSum += mx; if (mx >= 200) redHot++; } else if (h >= 110 && h < 175) { green++; greenSum += mx; if (mx >= 200) greenHot++; } else if (h >= 175 && h < 215) cyan++; }
      const nRed = parts.filter((p) => p.s.side < 0 && !p.s.none).length, nGreen = parts.filter((p) => p.s.side > 0).length; // pass 4: per step, and the mean brightness of the lit pixels of each colour (0–255), and the share that is near white-hot
      return { px: w * h, lit, red, green, cyan, red_share_of_lit: +(red / Math.max(1, lit)).toFixed(3), green_share_of_lit: +(green / Math.max(1, lit)).toFixed(3), red_to_green: +(red / Math.max(1, green)).toFixed(3), lit_share: +(lit / (w * h)).toFixed(3),
        red_steps: nRed, green_steps: nGreen, red_px_per_step: nRed ? Math.round(red / nRed) : null, green_px_per_step: nGreen ? Math.round(green / nGreen) : null, red_per_step_over_green_per_step: nRed && nGreen ? +((red / nRed) / Math.max(1, green / nGreen)).toFixed(3) : null,
        red_mean_brightness: red ? +(redSum / red).toFixed(1) : null, green_mean_brightness: green ? +(greenSum / green).toFixed(1) : null, red_hot_share: red ? +(redHot / red).toFixed(3) : null, green_hot_share: green ? +(greenHot / green).toFixed(3) : null };
    },
    // pass 5 · the colour audit: render once and sort every lit pixel — is it the Hub's own green or red (within 24 a channel), washed toward
    // white (bright, saturation under 0.45: the shine), or a dim veil over the page (brighter than the page, darker than a bar: the hue)?
    pixelAudit() {
      camera.updateMatrixWorld(); orientAll(); renderAll(); const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, buf = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      const near = (r, g, b, c) => Math.abs(r - (c >> 16)) <= 24 && Math.abs(g - ((c >> 8) & 255)) <= 24 && Math.abs(b - (c & 255)) <= 24;
      let lit = 0, tg = 0, tr = 0, green = 0, red = 0, washed = 0, white = 0, haze = 0, hr = 0, hg = 0, hb = 0, fr = 0, fg = 0, fb = 0;
      for (let i = 0; i < buf.length; i += 4) { const r = buf[i], g = buf[i + 1], b = buf[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b); fr += r; fg += g; fb += b;
        if (mx < 70) { if (mx > 46) { haze++; hr += r; hg += g; hb += b; } continue; } // the page is 0A0A0F and the zero band 1A1A2A (max 42): a veil is anything brighter than both and darker than a bar
        lit++; if (near(r, g, b, HUB.bull)) tg++; else if (near(r, g, b, HUB.bear)) tr++;
        const sat = (mx - mn) / mx; if (sat < 0.45 && mx >= 160) washed++; if (mn >= 200) white++;
        if (sat >= 0.25) { let hh = mx === r ? ((g - b) / (mx - mn)) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4; hh = ((hh * 60) + 360) % 360; if (hh >= 330 || hh < 25) red++; else if (hh >= 110 && hh < 175) green++; } }
      const n = w * h, sh = (a, b) => +(a / Math.max(1, b)).toFixed(4);
      return { px: n, lit, lit_share: sh(lit, n), true_green: tg, true_red: tr, true_share_of_lit: sh(tg + tr, lit), greenish: green, reddish: red, true_green_of_greenish: sh(tg, green), true_red_of_reddish: sh(tr, red), washed, washed_share_of_lit: sh(washed, lit), white, white_share_of_lit: sh(white, lit),
        veil: haze, veil_share_of_frame: sh(haze, n), veil_rgb: haze ? [Math.round(hr / haze), Math.round(hg / haze), Math.round(hb / haze)] : null, page_corner_rgb: [buf[(20 * w + 20) * 4], buf[(20 * w + 20) * 4 + 1], buf[(20 * w + 20) * 4 + 2]], // the page itself, 20 px in from a corner: it should print 0A0A0F = 10, 10, 15
        frame_mean_rgb: [+(fr / n).toFixed(1), +(fg / n).toFixed(1), +(fb / n).toFixed(1)] };
    },
    async measure(ms = 4000) {
      measuring = true; meas.ms = 0; meas.n = 0; const start = performance.now(); let f = 0; const el0 = api.elevation(), d0 = camera.position.distanceTo(controls.target), t0 = controls.target.clone();
      await new Promise((res) => { stopSpin(); camera.up.set(0, 1, 0); const step = (now) => { const k = Math.min(1, (now - start) / ms); camera.position.copy(t0).add(dirOf(el0.el, el0.az + 90 * k).multiplyScalar(d0)); dirty = true; f++; if (k < 1) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
      measuring = false; const dt = (performance.now() - start) / 1000;
      return { fps: +(f / dt).toFixed(1), frames: f, seconds: +dt.toFixed(2), rendered: meas.n, render_ms_per_frame: meas.n ? +(meas.ms / meas.n).toFixed(2) : null, dpr: renderer.getPixelRatio(), w: view.w, h: view.h, mode, steps: parts.length, triangles: meas.tris, calls: meas.calls, gpu: (() => { try { const gl = renderer.getContext(); const d = gl.getExtension("WEBGL_debug_renderer_info"); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch { return null; } })() };
    },
    /* pass 6 · THE LIST's order — the order the bars stand in from top to bottom: the highest reading first (the green spiral from its
       centre out), down through zero, the lowest last (the red spiral from its rim in), then the names without a reading. Ties by ticker. */
    order() { const pl = sets[0] && sets[0].placed; if (!pl) return []; const read = pl.steps.filter((s) => !s.none).sort((a, b) => b.v - a.v || (a.t < b.t ? -1 : 1)), none = pl.steps.filter((s) => s.none).sort((a, b) => a.i - b.i);
      return [...read, ...none].map((s, k) => ({ rank: k + 1, t: s.t, v: s.none ? null : s.v, side: s.none ? 0 : s.v >= 0 ? 1 : -1 })); },
    order_rule: "top to bottom as the bars stand: the highest reading first, down through zero, the lowest last; names without a reading at the end; ties by ticker",
    labelsOn(on) { diag.labels = !!on; dirty = true; }, // the type on or off without rebuilding the scene (the proof's audits count the 3D alone)
    highlight(t) { hiT = t || null; hiStrong = true; applyHi(); }, highlighted: () => hiT, barAt,
    // where a bar prints (the middle of it), for the proof's mouse
    barPx(t) { camera.updateMatrixWorld(); const p = parts.find((q) => q.s.t === t); if (!p) return null; const x = (p.s.ox || 0) + p.s.r * Math.cos(p.s.th), z = p.s.r * Math.sin(p.s.th); const out = []; for (const k of [0.15, 0.3, 0.5, 0.7, 0.85]) { _p.set(x, p.s.tip * p.h * k, z).project(camera); out.push([((_p.x + 1) / 2) * view.w, ((1 - _p.y) / 2) * view.h]); } return out; },
    /* pass 6 · THE SPILL CHECK. Three renders of the same frame, type off: A as it is; B without the bars; C with every bar's footprint
       drawn solid. A pixel the bars changed (A ≠ B) must be inside a footprint (C ≠ B) — `outside` counts the ones that are not (must be 0).
       And the page: the four corners and the share of the frame that prints exactly 0A0A0F. */
    spill() {
      if (!contained()) return null; camera.updateMatrixWorld(); orientAll(); const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      const grab = () => { renderer.autoClear = true; renderer.render(scene, camera); const b = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
      const A = grab(); for (const p of parts) if (p.beam) p.core.visible = false; const B = grab(); for (const p of parts) if (p.beam) p.core.visible = true; uSolid.value = 1; const C = grab(); uSolid.value = 0; dirty = true;
      let lit = 0, foot = 0, outside = 0, worst = 0, page = 0; const bg = [(HUB.bg >> 16) & 255, (HUB.bg >> 8) & 255, HUB.bg & 255];
      for (let i = 0; i < A.length; i += 4) { const dA = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])), inF = C[i] !== B[i] || C[i + 1] !== B[i + 1] || C[i + 2] !== B[i + 2];
        if (inF) foot++; if (dA > 0) { lit++; if (!inF) { outside++; worst = Math.max(worst, dA); } }
        if (A[i] === bg[0] && A[i + 1] === bg[1] && A[i + 2] === bg[2]) page++; }
      const at = (x, y) => { const k = (y * w + x) * 4; return [A[k], A[k + 1], A[k + 2]]; };
      return { px: w * h, bar_footprint_px: foot, px_the_bars_changed: lit, outside_a_footprint: outside, worst_step_outside: worst, page_rgb: bg, corners: [at(20, 20), at(w - 21, 20), at(20, h - 21), at(w - 21, h - 21)], page_exact_px: page, page_exact_share: +(page / (w * h)).toFixed(4) };
    },
    canvas: renderer.domElement, fps: () => frames.fps, labels: () => parts.map((p) => ({ t: p.s.t, v: p.s.v, side: p.s.side, tip: +p.s.tip.toFixed(1), r: +p.s.r.toFixed(1), shown: p.lp.visible, front: !!p.lp.userData.front, slot: +(p.lp.userData.off || 0).toFixed(2), px: +p.lp.userData.px.toFixed(1), wk: +(p.s.wk || 1).toFixed(2) })),
  };
  return api;
}

/* COIL LAB (3 Oct 2026) · the coil alone, as a component, in 3D — three visual directions on one scene. PASS 2.
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
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const HUB = { bg: 0x0a0a0f, bull: 0x00ffa3, bear: 0xff2d55, crk: 0x00d4ff, ink: 0xf2f2f8, ink2: 0xc6c8de, dim: 0x868aaa, mute: 0x3a3a52, line: 0x1a1a2a, none: 0x3a3a52 };
const MONO = '"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace';
const FILL = 0.8; // the coil's projected height = this share of the view's height at home (the coordinator's point 1)
const BLOOM = { laser: { s: 0.42, r: 0.32, t: 0.78 }, guide: { s: 0.34, r: 0.28, t: 0.8 }, holo: { s: 0.38, r: 0.3, t: 0.76 } }; // bloom only on what is above 1: the cores, the frames, the ring

export function mountCoil(host, opts) {
  const STD = opts.standard, P = STD.podium, CAM = P.camera;
  const PAR = { A: P.inner_radius, D: P.step_w, RW: P.tread_depth, B: (P.tread_depth * 1.04) / (2 * Math.PI), H: P.H_max, H_MIN: P.H_min, DROP: P.tread_depth };
  const HOME = { el: 70, az: CAM.home_az, fov: CAM.fov }; // 70° is settled (Alan); the sheet's 24° stays a note, not a choice to make again

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(HUB.bg, 1); renderer.info.autoReset = false; renderer.toneMapping = THREE.NoToneMapping;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(HUB.bg, 1800, 5200);
  const camera = new THREE.PerspectiveCamera(HOME.fov, 1, 1, 12000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.12; controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI; // the full sphere (T9)
  controls.zoomSpeed = 0.9; controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

  // post: bloom on every direction (the light IS the form); strength per direction
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.32, 0.78); composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const view = { w: 1, h: 1 };
  let dirty = true, placed = null, home = null;
  function fit() {
    view.w = host.clientWidth || 1; view.h = host.clientHeight || 1;
    renderer.setSize(view.w, view.h, false); composer.setSize(view.w, view.h);
    camera.aspect = view.w / view.h; camera.updateProjectionMatrix(); dirty = true;
    if (placed && home) { home = framing(HOME.el, HOME.az); }
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

  /* ---- labels painted on the step: the ticker spans the tread (96 px of 256), the value under it ---- */
  const texCache = new Map();
  const hex = (c) => "#" + c.toString(16).padStart(6, "0");
  function labelTex(t, v, col) {
    const k = t + "|" + (v == null ? "" : v.toFixed(2)) + "|" + col;
    if (texCache.has(k)) return texCache.get(k);
    const c = document.createElement("canvas"); c.width = 256; c.height = 256; const g = c.getContext("2d");
    g.clearRect(0, 0, 256, 256); g.textAlign = "center"; g.textBaseline = "middle";
    const fs = t.length <= 3 ? 104 : t.length === 4 ? 96 : t.length === 5 ? 80 : 66;
    g.font = `700 ${fs}px ${MONO}`; const tw = g.measureText(t).width; // a dark backing only behind the type (not the whole tread), so what is under the step still shows
    g.fillStyle = "rgba(10,10,15,0.5)"; g.fillRect(128 - tw / 2 - 8, (v == null ? 128 : 100) - fs * 0.42, tw + 16, fs * 0.84); if (v != null) g.fillRect(128 - 100, 184 - 26, 200, 52);
    g.fillStyle = "#f2f2f8"; g.shadowColor = "#000"; g.shadowBlur = 8; g.fillText(t, 128, v == null ? 128 : 100);
    if (v != null) { g.font = `500 60px ${MONO}`; g.fillStyle = hex(col); g.fillText((v >= 0 ? "+" : "") + v.toFixed(2), 128, 184); }
    const tex = new THREE.CanvasTexture(c); tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace; texCache.set(k, tex); return tex;
  }

  /* ---- the group, rebuilt per direction ---- */
  let group = null, parts = [], mode = "laser", data = null, t0 = performance.now();
  const Y = new THREE.Vector3(0, 1, 0);
  const scintSet = new Set(opts.scintillas || []);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1), edgesGeo = new THREE.EdgesGeometry(boxGeo);
  // the tread's frame: the four edges of the top face (a unit square in x/z at y = 0)
  const frameGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 0, -0.5), new THREE.Vector3(0.5, 0, -0.5), new THREE.Vector3(0.5, 0, 0.5), new THREE.Vector3(0.5, 0, 0.5), new THREE.Vector3(-0.5, 0, 0.5), new THREE.Vector3(-0.5, 0, 0.5), new THREE.Vector3(-0.5, 0, -0.5)]);
  const vertsGeo = new THREE.BufferGeometry().setFromPoints([-0.5, 0.5].flatMap((x) => [-0.5, 0.5].flatMap((z) => [new THREE.Vector3(x, -0.5, z), new THREE.Vector3(x, 0.5, z)])));
  const coreGeo = new THREE.CylinderGeometry(0.7, 0.7, 1, 6, 1, true), haloGeo = new THREE.CylinderGeometry(3.2, 3.2, 1, 10, 1, true);
  const plateGeo = new THREE.PlaneGeometry(1, 1);

  function clear() { if (group) { scene.remove(group); group.traverse((o) => { if (o.geometry && ![boxGeo, edgesGeo, frameGeo, vertsGeo, coreGeo, haloGeo, plateGeo].includes(o.geometry)) o.geometry.dispose(); if (o.material && !o.material.map) o.material.dispose(); }); } group = new THREE.Group(); scene.add(group); parts = []; }

  const glow = (v) => 0.35 + 0.65 * Math.min(1, Math.abs(v == null ? 0 : v)); // the glow's strength follows the reading
  const lit = (col, k) => new THREE.Color(col).multiplyScalar(k); // a colour above 1 is what bloom picks up (toneMapped: false)
  const lineMat = (col, k, op = 1) => new THREE.LineBasicMaterial({ color: lit(col, k), transparent: op < 1, opacity: op, toneMapped: false });
  const basic = (col, op, blend = THREE.NormalBlending, k = 1) => new THREE.MeshBasicMaterial({ color: lit(col, k), transparent: true, opacity: op, depthWrite: false, blending: blend, toneMapped: false, side: THREE.DoubleSide });

  function zeroRing(outerR) {
    const pts = []; for (let i = 0; i <= 160; i++) pts.push(new THREE.Vector3(outerR * Math.cos((i / 160) * Math.PI * 2), 0, outerR * Math.sin((i / 160) * Math.PI * 2)));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat(HUB.crk, 1.2, 0.9)));
    const band = new THREE.Mesh(new THREE.RingGeometry(PAR.A - PAR.RW / 2, PAR.A + PAR.RW / 2, 64), basic(HUB.line, 0.8)); band.rotation.x = -Math.PI / 2; group.add(band); // the equator: the flat grey band (T10)
    const inner = new THREE.Mesh(new THREE.RingGeometry(outerR - 0.6, outerR, 160), basic(HUB.crk, 0.18, THREE.AdditiveBlending)); inner.rotation.x = -Math.PI / 2; group.add(inner);
  }
  function spine(top, bottom) { group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, bottom - 10, 0), new THREE.Vector3(0, top + 60, 0)]), lineMat(HUB.crk, 1, 0.35))); }

  // a step's frame: the box from the zero plane to its tip (standing up, or hanging down), turned to the spiral's tangent
  function stepMatrix(s, h01, M4) {
    const w = (PAR.D * (s.r + PAR.RW / 2)) / s.r, tip = s.tip * h01, y0 = Math.min(0, tip), y1 = Math.max(0, tip);
    const q = new THREE.Quaternion().setFromAxisAngle(Y, -(s.th + Math.PI / 2));
    M4.compose(new THREE.Vector3(s.r * Math.cos(s.th), (y0 + y1) / 2, s.r * Math.sin(s.th)), q, new THREE.Vector3(w, Math.max(0.6, y1 - y0), PAR.RW));
    return { w, tip, q };
  }
  function labelPlane(s, col) {
    const tex = labelTex(s.t, s.none ? null : s.v, col);
    const w = (PAR.D * (s.r + PAR.RW / 2)) / s.r, side = Math.min(w, PAR.RW) * 0.94;
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(side, side), m); // the reading face
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(side, side), m); // the outer face
    face.userData.kind = "face"; outer.userData.kind = "outer"; face.userData.sx = outer.userData.sx = 1; face.userData.sy = outer.userData.sy = 1; return { face, outer, side };
  }
  function putLabels(s, lp, h01) {
    const tip = s.tip * h01, q = new THREE.Quaternion().setFromAxisAngle(Y, -(s.th + Math.PI / 2));
    const x = s.r * Math.cos(s.th), z = s.r * Math.sin(s.th);
    lp.face.position.set(x, tip + (s.tip >= 0 ? 0.5 : -0.5), z);
    lp.face.quaternion.copy(q); lp.face.rotateX(s.tip >= 0 ? -Math.PI / 2 : Math.PI / 2);
    const out = new THREE.Vector3(Math.cos(s.th), 0, Math.sin(s.th));
    lp.outer.position.set(x + out.x * (PAR.RW / 2 + 0.5), tip / 2, z + out.z * (PAR.RW / 2 + 0.5));
    lp.outer.quaternion.copy(q); lp.outer.rotateY(Math.PI / 2); lp.outer.userData.tall = Math.abs(tip) >= 14;
    lp.outer.userData.sy = Math.min(1, Math.abs(tip) / Math.max(1, lp.side)); lp.outer.userData.sx = 1;
    orientLabel(lp.face); orientLabel(lp.outer);
  }
  /* ---- point 2: a painted label is turned by its facing angle so it always reads upright and left-to-right ---- */
  const _p = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _q = new THREE.Quaternion();
  function screenAxes(mesh) {
    mesh.getWorldPosition(_p); _q.copy(mesh.quaternion);
    _x.set(1, 0, 0).applyQuaternion(_q).add(_p).project(camera); _y.set(0, 1, 0).applyQuaternion(_q).add(_p).project(camera); _p.project(camera);
    return { rx: _x.x - _p.x, ry: _y.y - _p.y, onScreen: Math.abs(_p.x) <= 1 && Math.abs(_p.y) <= 1 && _p.z < 1 };
  }
  const _n = new THREE.Vector3(), _toCam = new THREE.Vector3();
  function orientLabel(mesh) {
    if (mesh.userData.kind === "outer") { mesh.getWorldPosition(_p); _n.set(0, 0, 1).applyQuaternion(mesh.quaternion); _toCam.copy(camera.position).sub(_p); mesh.visible = mesh.userData.tall && _n.dot(_toCam) > 0; if (!mesh.visible) return; }
    const a = screenAxes(mesh); const sx = a.rx < 0 ? -1 : 1, sy = a.ry < 0 ? -1 : 1;
    mesh.scale.set(sx * mesh.userData.sx, sy * mesh.userData.sy, 1);
  }
  function orientAll() { for (const p of parts) { orientLabel(p.lp.face); orientLabel(p.lp.outer); } }

  const colOf = (s) => (s.none ? HUB.none : s.side > 0 ? HUB.bull : HUB.bear);

  function build() {
    clear(); if (!placed) return;
    const top = Math.max(0, ...placed.steps.map((s) => s.tip)), bottom = Math.min(0, ...placed.steps.map((s) => s.tip));
    const B = BLOOM[mode]; bloom.strength = B.s; bloom.radius = B.r; bloom.threshold = B.t;
    zeroRing(placed.outerR); spine(top, bottom);
    for (const s of placed.steps) {
      const col = colOf(s), k = glow(s.v), part = { s, h: 0, target: 1, flare: 0, scan: 0, wipe: 0, scint: scintSet.has(s.t), k };
      if (mode === "laser") {
        part.body = new THREE.Mesh(boxGeo, basic(col, 0.06, THREE.NormalBlending, 0.35)); // dark translucent glass, tinted
        part.verts = new THREE.LineSegments(vertsGeo, lineMat(col, 0.8, 0.18)); // hairline verticals
        part.frame = new THREE.LineSegments(frameGeo, lineMat(col, 0.9 + 0.5 * k)); // the tread: a bright thin frame
        part.plate = new THREE.Mesh(plateGeo, basic(col, 0.08, THREE.NormalBlending, 0.5)); // and a 22 % plate under the type
        part.core = new THREE.Mesh(coreGeo, basic(col, 0.9, THREE.AdditiveBlending, 0.9 + 0.7 * k)); // the laser: a bright core…
        part.halo = new THREE.Mesh(haloGeo, basic(col, 0.04 + 0.08 * k, THREE.AdditiveBlending, 1)); // …in a soft halo
        part.lp = labelPlane(s, col);
        group.add(part.body, part.verts, part.frame, part.plate, part.core, part.halo, part.lp.face, part.lp.outer);
      } else if (mode === "guide") {
        part.body = new THREE.Mesh(boxGeo, basic(HUB.crk, 0.03)); // a hollow glass guide
        part.edges = new THREE.LineSegments(edgesGeo, lineMat(HUB.crk, 0.8, 0.4)); // every edge a cyan hairline
        part.frame = new THREE.LineSegments(frameGeo, lineMat(col, 0.9 + 0.6 * k)); // the reading face carries the direction colour
        part.plate = new THREE.Mesh(plateGeo, basic(col, 0.1, THREE.NormalBlending, 0.5));
        part.bead = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), basic(0xffffff, 1, THREE.AdditiveBlending, 2)); part.bead.visible = false;
        part.lp = labelPlane(s, col);
        group.add(part.body, part.edges, part.frame, part.plate, part.bead, part.lp.face, part.lp.outer);
      } else {
        part.body = new THREE.Mesh(boxGeo, holoMat(col, 0.004, 0.06 * k)); // an additive hologram body, almost nothing, a fresnel rim
        part.frame = new THREE.LineSegments(frameGeo, lineMat(col, 0.9 + 0.5 * k));
        part.plate = new THREE.Mesh(plateGeo, basic(col, 0.06 + 0.06 * k, THREE.AdditiveBlending, 0.7));
        part.lp = labelPlane(s, col);
        group.add(part.body, part.frame, part.plate, part.lp.face, part.lp.outer);
      }
      part.base = new THREE.LineSegments(frameGeo, lineMat(col, 0.7, 0.55)); group.add(part.base); // the step's footprint on the zero plane, in its colour
      if (s.side < 0 && !s.none) { part.floor = new THREE.Mesh(plateGeo, basic(col, 0.42, THREE.AdditiveBlending, 0.7)); group.add(part.floor); } // point 4: the red half's plan, filled, on the zero plane — it reads through the green glass from 70°
      parts.push(part);
    }
    dirty = true; landAt = performance.now();
  }
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
    const moved = controls.update();
    let busy = false;
    for (const p of parts) {
      const delay = p.s.i * 28, k = Math.min(1, Math.max(0, (now - landAt - delay) / 900));
      let h = p.h;
      if (p.landing !== false) { h = ease(k) * p.target; if (k >= 1) p.landing = false; busy = true; }
      else if (Math.abs(p.target - p.h) > 1e-3) { h += (p.target - h) * Math.min(1, dt * 7); if (Math.abs(p.target - h) < 1e-3) h = p.target; busy = true; }
      if (h !== p.h) { p.h = h; p.moved = true; }
      if (p.moved) {
        const { w, tip, q } = stepMatrix(p.s, p.h, M4);
        const x = p.s.r * Math.cos(p.s.th), z = p.s.r * Math.sin(p.s.th);
        setM(p.body, M4); if (p.verts) setM(p.verts, M4); if (p.edges) setM(p.edges, M4);
        p.frame.position.set(x, tip, z); p.frame.quaternion.copy(q); p.frame.scale.set(w, 1, PAR.RW);
        p.base.position.set(x, 0, z); p.base.quaternion.copy(q); p.base.scale.set(w, 1, PAR.RW);
        if (p.floor) { p.floor.position.set(x, -0.3, z); p.floor.quaternion.copy(q); p.floor.rotateX(-Math.PI / 2); p.floor.scale.set(w, PAR.RW, 1); }
        p.plate.position.set(x, tip + (tip >= 0 ? -0.15 : 0.15), z); p.plate.quaternion.copy(q); p.plate.rotateX(-Math.PI / 2); p.plate.scale.set(w, PAR.RW, 1);
        if (p.core) { p.core.position.set(x, tip / 2, z); p.core.scale.set(1, Math.max(0.1, Math.abs(tip)), 1); p.halo.position.copy(p.core.position); p.halo.scale.copy(p.core.scale); }
        if (mode === "holo") p.body.material.uniforms.uH.value = Math.max(1, Math.abs(tip));
        putLabels(p.s, p.lp, p.h); p.moved = false; dirty = true;
      }
      // motion with a meaning: a flare / a scan / a wipe runs only when a value lands or changes
      if (mode === "laser" && p.flare > 0) { p.flare = Math.max(0, p.flare - dt / 0.32); p.core.material.color.copy(lit(colOf(p.s), 0.9 + 0.7 * p.k + 1.6 * p.flare)); p.halo.material.opacity = 0.04 + 0.08 * p.k + 0.3 * p.flare; p.body.material.opacity = 0.06 + 0.25 * p.flare; busy = true; }
      if (mode === "guide" && p.scan > 0) { p.scan = Math.max(0, p.scan - dt / 0.42); const u = 1 - p.scan, tip = p.s.tip * p.h; p.bead.visible = true; p.bead.position.set(p.s.r * Math.cos(p.s.th), tip * u, p.s.r * Math.sin(p.s.th)); p.edges.material.opacity = 0.4 + 0.6 * p.scan; if (p.scan <= 0) { p.bead.visible = false; p.edges.material.opacity = 0.4; } busy = true; }
      if (mode === "holo") {
        if (p.wipe > 0) { p.wipe = Math.max(0, p.wipe - dt / 0.4); p.body.material.uniforms.uWipe.value = 1 - p.wipe; p.body.material.uniforms.uFlick.value = p.wipe * 0.6; busy = true; }
        else if (p.scint) { const ph = ((now - t0) / 1000) % 20; const f = ph < 0.5 ? Math.sin((ph / 0.5) * Math.PI) : 0; if (f !== p.body.material.uniforms.uFlick.value) { p.body.material.uniforms.uFlick.value = f * 0.35; busy = true; } } // once every 20 s, the Hub's "soon" cadence
      }
    }
    if (moveTo) { const k = ease(Math.min(1, (now - moveTo.t0) / moveTo.ms)); camera.position.lerpVectors(moveTo.from.p, moveTo.to.p, k); controls.target.lerpVectors(moveTo.from.t, moveTo.to.t, k); if (k >= 1) moveTo = null; busy = true; }
    if (busy || moved || dirty || measuring) {
      camera.updateMatrixWorld(); orientAll();
      renderer.info.reset(); const r0 = performance.now(); composer.render(); if (measuring) { meas.ms += performance.now() - r0; meas.n++; meas.tris = renderer.info.render.triangles; meas.calls = renderer.info.render.calls; }
      dirty = false; frames.n++;
    }
    if (now - frames.since >= 1000) { frames.fps = frames.n / ((now - frames.since) / 1000); frames.n = 0; frames.since = now; if (opts.onFps) opts.onFps(frames.fps); }
  }
  const frames = { n: 0, since: performance.now(), fps: 0 };
  requestAnimationFrame(tick);

  /* ---- camera (point 1): the distance is solved so the coil's projected height = FILL of the view; 70° home; the full sphere ---- */
  let moveTo = null;
  const dirOf = (el, az) => { const e = (el * Math.PI) / 180, a = (az * Math.PI) / 180; return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).normalize(); };
  function coilPoints() {
    const pts = []; if (!placed) return pts;
    for (const s of placed.steps) { const x = s.r * Math.cos(s.th), z = s.r * Math.sin(s.th), o = new THREE.Vector3(Math.cos(s.th), 0, Math.sin(s.th)).multiplyScalar(PAR.RW / 2), t = new THREE.Vector3(-Math.sin(s.th), 0, Math.cos(s.th)).multiplyScalar(PAR.D / 2);
      for (const y of [0, s.tip]) for (const a of [-1, 1]) for (const b of [-1, 1]) pts.push(new THREE.Vector3(x + a * o.x + b * t.x, y, z + a * o.z + b * t.z)); }
    const R = placed.outerR; for (let i = 0; i < 24; i++) pts.push(new THREE.Vector3(R * Math.cos((i / 24) * Math.PI * 2), 0, R * Math.sin((i / 24) * Math.PI * 2)));
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
    const box = new THREE.Box3().setFromPoints(pts), c = box.getCenter(new THREE.Vector3()), dir = dirOf(el, az);
    let lo = 20, hi = 20000; // bisection on the distance: the projected height = fill of the view, the width never past 0.94
    for (let i = 0; i < 40; i++) { const d = (lo + hi) / 2, e = extent(pts, c.clone().add(dir.clone().multiplyScalar(d)), c); if (e.h > fill || e.w > 0.94) lo = d; else hi = d; }
    const d = hi, p = c.clone().add(dir.multiplyScalar(d));
    // centre the picture: shift the target so the projected box sits in the middle of the view
    const e = extent(pts, p, c), right = new THREE.Vector3().crossVectors(dir, Y).normalize().negate(), up = new THREE.Vector3().crossVectors(right, dir).normalize();
    const ndcPerUnit = 2 / (2 * d * Math.tan((camera.fov * Math.PI) / 360)); const t = c.clone().add(right.multiplyScalar((e.cx / ndcPerUnit) * camera.aspect)).add(up.multiplyScalar(e.cy / ndcPerUnit));
    return { p: t.clone().add(dirOf(el, az).multiplyScalar(d)), t };
  }
  function flyHome(ms = 700) { if (!placed) return; home = framing(HOME.el, HOME.az); if (!ms) { camera.position.copy(home.p); controls.target.copy(home.t); moveTo = null; dirty = true; return; } moveTo = { from: { p: camera.position.clone(), t: controls.target.clone() }, to: home, t0: performance.now(), ms }; }
  renderer.domElement.addEventListener("dblclick", () => flyHome(700));

  /* ---- public ---- */
  let measuring = false; const meas = { ms: 0, n: 0, tris: 0, calls: 0 };
  const api = {
    setData(rows, { land = true } = {}) {
      const prev = data ? new Map(data.map((r) => [r.t, r.v])) : null;
      data = rows; placed = place(rows);
      build();
      if (prev && !land) { for (const p of parts) { p.landing = false; p.h = 1; p.moved = true; const was = prev.get(p.s.t); if (was != null && Math.abs(was - (p.s.v ?? 0)) > 1e-6) api.pulse(p.s.t); } }
      if (!home) flyHome(0); else { home = framing(HOME.el, HOME.az); }
      dirty = true;
    },
    pulse(t) { for (const p of parts) if (p.s.t === t) { if (mode === "laser") p.flare = 1; else if (mode === "guide") p.scan = 1; else p.wipe = 1; } dirty = true; },
    change(t, v) {
      if (!data) return; const r = data.find((x) => x.t === t); if (!r) return; r.v = v; const np = place(data); const step = np.steps.find((s) => s.t === t); const p = parts.find((q) => q.s.t === t);
      if (step && p) { p.s.tip = step.tip; p.s.v = v; p.moved = true; p.landing = false; p.lp.face.material.map = labelTex(t, v, colOf(p.s)); p.lp.face.material.needsUpdate = true; }
      api.pulse(t); dirty = true;
    },
    setMode(m) { mode = m; build(); for (const p of parts) { p.landing = false; p.h = 1; p.moved = true; } dirty = true; },
    land() { build(); dirty = true; },
    mode: () => mode, placed: () => placed, home: () => flyHome(700), orbitTo(el, az) { const h = framing(el, az); camera.position.copy(h.p); controls.target.copy(h.t); moveTo = null; dirty = true; },
    elevation() { const d = camera.position.clone().sub(controls.target); return { el: +((Math.asin(d.y / d.length()) * 180) / Math.PI).toFixed(1), az: +((Math.atan2(d.x, d.z) * 180) / Math.PI).toFixed(1), d: +d.length().toFixed(1) }; },
    // point 1: the share of the view's height and width the coil's projection covers right now
    fill() { camera.updateMatrixWorld(); const e = extent(coilPoints(), camera.position, controls.target); return { h: +e.h.toFixed(3), w: +e.w.toFixed(3), target: FILL, view: { w: view.w, h: view.h } }; },
    // point 2: every label on screen, with its screen axes after the turn — wrong = reads mirrored or upside down (must be 0) — and the ticker's printed height in px
    labelCheck() {
      camera.updateMatrixWorld(); orientAll(); const out = { labels: 0, wrong: 0, onScreen: 0, ticker_px: [] }; const c0 = new THREE.Vector3(), c1 = new THREE.Vector3();
      for (const p of parts) for (const m of [p.lp.face, p.lp.outer]) { if (!m.visible) continue; out.labels++; const a = screenAxes(m); if (a.onScreen) out.onScreen++; const sx = Math.sign(m.scale.x), sy = Math.sign(m.scale.y); if (a.rx * sx < 0 || a.ry * sy < 0) out.wrong++;
        if (m === p.lp.face && a.onScreen) { m.getWorldPosition(c0); c1.set(0, 0.5 * p.lp.side, 0).applyQuaternion(m.quaternion).add(c0); c0.project(camera); c1.project(camera); const px = Math.hypot((c1.x - c0.x) * view.w / 2, (c1.y - c0.y) * view.h / 2) * 2; out.ticker_px.push(+(px * (96 * 0.72) / 256).toFixed(1)); } }
      const t = out.ticker_px.slice().sort((a, b) => a - b); out.ticker_px_median = t.length ? t[t.length >> 1] : null; out.ticker_px_min = t.length ? t[0] : null; delete out.ticker_px; return out;
    },
    // point 4: render once and count the lit pixels by hue (red / green / cyan) — the red half must be plainly there at home
    pixelShare() {
      camera.updateMatrixWorld(); orientAll(); composer.render(); const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, buf = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      // a lit pixel is sorted by hue (red 330°–25°, green 110°–175°, cyan 175°–215°) when its saturation is above 0.25 — so red seen through green glass still counts as red
      let red = 0, green = 0, cyan = 0, lit = 0; for (let i = 0; i < buf.length; i += 4) { const r = buf[i], g = buf[i + 1], b = buf[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx < 70) continue; lit++; const sat = (mx - mn) / mx; if (sat < 0.25) continue; let h = mx === r ? ((g - b) / (mx - mn)) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4; h = ((h * 60) + 360) % 360; if (h >= 330 || h < 25) red++; else if (h >= 110 && h < 175) green++; else if (h >= 175 && h < 215) cyan++; }
      return { px: w * h, lit, red, green, cyan, red_share_of_lit: +(red / Math.max(1, lit)).toFixed(3), green_share_of_lit: +(green / Math.max(1, lit)).toFixed(3), red_to_green: +(red / Math.max(1, green)).toFixed(3), lit_share: +(lit / (w * h)).toFixed(3) };
    },
    async measure(ms = 4000) {
      measuring = true; meas.ms = 0; meas.n = 0; const start = performance.now(); let f = 0; const el0 = api.elevation(), d0 = camera.position.distanceTo(controls.target), t0 = controls.target.clone();
      await new Promise((res) => { const step = (now) => { const k = Math.min(1, (now - start) / ms); camera.position.copy(t0).add(dirOf(el0.el, el0.az + 90 * k).multiplyScalar(d0)); dirty = true; f++; if (k < 1) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
      measuring = false; const dt = (performance.now() - start) / 1000;
      return { fps: +(f / dt).toFixed(1), frames: f, seconds: +dt.toFixed(2), rendered: meas.n, render_ms_per_frame: meas.n ? +(meas.ms / meas.n).toFixed(2) : null, dpr: renderer.getPixelRatio(), w: view.w, h: view.h, mode, steps: parts.length, triangles: meas.tris, calls: meas.calls, gpu: (() => { try { const gl = renderer.getContext(); const d = gl.getExtension("WEBGL_debug_renderer_info"); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch { return null; } })() };
    },
    canvas: renderer.domElement, fps: () => frames.fps, labels: () => parts.map((p) => ({ t: p.s.t, v: p.s.v, side: p.s.side, tip: +p.s.tip.toFixed(1), r: +p.s.r.toFixed(1) })),
  };
  return api;
}

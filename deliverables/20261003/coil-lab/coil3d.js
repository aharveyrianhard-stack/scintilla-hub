/* COIL LAB (3 Oct 2026) · the coil alone, as a component, in 3D — three visual directions on one scene.
   Throwaway page. The live tree (deliverables/20260929/tree-map) is not touched.

   WHAT IS SETTLED (Alan, 2–3 Oct; never re-opened here): the camera starts 70° up; the red half is the green half mirrored
   in the zero plane (its own spiral from the centre, hanging down); walking down the steps; the coil's scale comes from the
   data (tread = reading × H, one H above and below zero, H lowered until the biggest drop ≤ one tread); the lists are read
   through the Hub mirror.

   THE GEOMETRY is T9/T10's: an Archimedean spiral r = A + Bθ walked in even steps of arc length D; A = 30, D = RW = 30,
   B = RW × 1.04 / 2π, H = 260 → drop cap. Every number below that is a size comes from the T10 standard sheet
   (data/tree-standard.t10-e133a81.json), read at start — nothing is typed to taste.

   THE THREE DIRECTIONS (switchable, same data, same camera):
     A · LASER      — every step is an emissive slab with a laser beam standing on the zero plane up to its reading
                      (hanging down for red); UnrealBloom. Motion = a value landing or changing: the beam flares (320 ms)
                      and the slab eases to its new height (600 ms). Nothing moves otherwise.
     B · LIGHT-GUIDE — every step is a hollow glass guide: cyan hairline edges, faces at 6 %; a bead of light runs from the
                      zero plane to the tip once when the reading lands and once per change (420 ms). The reading face
                      carries the direction colour; the chrome is the Hub's cyan.
     C · HOLOGRAM   — every step is a translucent additive plate with a fresnel rim; a change re-materialises the plate
                      with a vertical wipe (400 ms). A name that scintillated today (public.scintillas, Friday's rows)
                      flickers once every 20 s — the Hub's own "soon" cadence — so the motion says "this one fired".
   The ticker + reading is painted on the reading face of every step (the tread of a green step, the underside of a red
   one) and on its outer face, in the Hub's mono type, as T10 asks: it moves with the step, no billboard. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const HUB = { bg: 0x0a0a0f, bull: 0x00ffa3, bear: 0xff2d55, crk: 0x00d4ff, ink: 0xf2f2f8, ink2: 0xc6c8de, dim: 0x868aaa, mute: 0x3a3a52, line: 0x1a1a2a, none: 0x3a3a52 };
const MONO = '"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace';

export function mountCoil(host, opts) {
  const STD = opts.standard, P = STD.podium, CAM = P.camera;
  const PAR = { A: P.inner_radius, D: P.step_w, RW: P.tread_depth, B: (P.tread_depth * 1.04) / (2 * Math.PI), H: P.H_max, H_MIN: P.H_min, DROP: P.tread_depth };
  const HOME = { el: 70, az: CAM.home_az, fov: CAM.fov }; // 70° is settled (Alan); the sheet's 24° stays a note, not a choice to make again
  const PHONE = host.clientWidth < 760;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(HUB.bg, 1); renderer.info.autoReset = false;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(HUB.bg, 1500, 4200);
  const camera = new THREE.PerspectiveCamera(HOME.fov, 1, 1, 12000);
  const key = new THREE.DirectionalLight(0xc8c8d8, 1.1); key.position.set(500, 900, 700); scene.add(key);
  scene.add(new THREE.AmbientLight(0x6a6a80, 0.55));
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.12; controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI; // the full sphere (T9)
  controls.zoomSpeed = 0.9; controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

  // post: bloom only for LASER (the others are drawn without it; bloom on glass looks like fog)
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera); composer.addPass(renderPass);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.5, 0.62); composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const view = { w: 1, h: 1 };
  let dirty = true;
  function fit() {
    view.w = host.clientWidth || 1; view.h = host.clientHeight || 1;
    renderer.setSize(view.w, view.h, false); composer.setSize(view.w, view.h);
    camera.aspect = view.w / view.h; camera.updateProjectionMatrix(); dirty = true;
  }
  new ResizeObserver(fit).observe(host); fit();

  /* ---- the places: ONE rule for every step (T9/T10) ---- */
  const spiralAt = (i) => { const s = (i + 0.5) * PAR.D, th = (-PAR.A + Math.sqrt(PAR.A * PAR.A + 2 * PAR.B * s)) / PAR.B; return { th, r: PAR.A + PAR.B * th }; };
  function place(rows) {
    // rows: [{t, v}] with v in −1..1 or null. Green: v ≥ 0 sorted high → low from the centre. Red: v < 0, the mirror — its own spiral from the centre, most negative first, hanging.
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

  /* ---- labels painted on the step (T10: type 18 U = 0.6 of the tread; here as a texture per step) ---- */
  const texCache = new Map();
  function labelTex(t, v, col) {
    const k = t + "|" + (v == null ? "" : v.toFixed(2)) + "|" + col;
    if (texCache.has(k)) return texCache.get(k);
    const c = document.createElement("canvas"); c.width = 256; c.height = 256; const g = c.getContext("2d");
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = "#" + col.toString(16).padStart(6, "0"); g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `700 ${t.length > 4 ? 64 : 78}px ${MONO}`; g.fillText(t, 128, v == null ? 128 : 104);
    if (v != null) { g.font = `500 52px ${MONO}`; g.fillStyle = "#c6c8de"; g.fillText((v >= 0 ? "+" : "") + v.toFixed(2), 128, 180); }
    const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4; tex.colorSpace = THREE.SRGBColorSpace; texCache.set(k, tex); return tex;
  }

  /* ---- the group, rebuilt per direction ---- */
  let group = null, parts = [], mode = "laser", data = null, placed = null, t0 = performance.now();
  const Y = new THREE.Vector3(0, 1, 0);
  const scintSet = new Set(opts.scintillas || []);
  const frames = { n: 0, since: performance.now(), fps: 0 };

  function clear() { if (group) { scene.remove(group); group.traverse((o) => { if (o.geometry && o.geometry !== boxGeo) o.geometry.dispose(); if (o.material && !o.material.__shared) o.material.dispose(); }); } group = new THREE.Group(); scene.add(group); parts = []; }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const edgesGeo = new THREE.EdgesGeometry(boxGeo);

  function zeroRing(outerR, col, op) {
    const pts = []; for (let i = 0; i <= 128; i++) pts.push(new THREE.Vector3(outerR * Math.cos((i / 128) * Math.PI * 2), 0, outerR * Math.sin((i / 128) * Math.PI * 2)));
    const g = new THREE.BufferGeometry().setFromPoints(pts); const m = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: op }); group.add(new THREE.Line(g, m));
    // the equator: the flat grey band between the two base radii (T10)
    const band = new THREE.Mesh(new THREE.RingGeometry(PAR.A - PAR.RW / 2, PAR.A + PAR.RW / 2, 64), new THREE.MeshBasicMaterial({ color: 0x1a1a2a, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })); band.rotation.x = -Math.PI / 2; group.add(band);
  }
  function spine(top, bottom, col, op) { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, bottom - 10, 0), new THREE.Vector3(0, top + 60, 0)]); group.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: op }))); }

  // a step's frame: the box from the zero plane to its tip (standing up, or hanging down), turned to the spiral's tangent
  function stepMatrix(s, h01, M4) {
    const w = (PAR.D * (s.r + PAR.RW / 2)) / s.r, tip = s.tip * h01, y0 = Math.min(0, tip), y1 = Math.max(0, tip);
    const q = new THREE.Quaternion().setFromAxisAngle(Y, -(s.th + Math.PI / 2));
    M4.compose(new THREE.Vector3(s.r * Math.cos(s.th), (y0 + y1) / 2, s.r * Math.sin(s.th)), q, new THREE.Vector3(w, Math.max(0.6, y1 - y0), PAR.RW));
    return { w, tip, q };
  }
  function labelPlane(s, col) {
    const tex = labelTex(s.t, s.none ? null : s.v, col);
    const w = (PAR.D * (s.r + PAR.RW / 2)) / s.r, side = Math.min(w, PAR.RW) * 0.92;
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(side, side), m); // the reading face
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(side, side), m); // the outer face
    face.userData.kind = "face"; outer.userData.kind = "outer"; return { face, outer };
  }
  function putLabels(s, lp, h01) {
    const tip = s.tip * h01, q = new THREE.Quaternion().setFromAxisAngle(Y, -(s.th + Math.PI / 2));
    const x = s.r * Math.cos(s.th), z = s.r * Math.sin(s.th);
    lp.face.position.set(x, tip + (s.side > 0 || s.none ? 0.4 : -0.4) * (s.none && s.tip > 0 ? 1 : 1), z);
    lp.face.quaternion.copy(q); lp.face.rotateX(s.tip >= 0 ? -Math.PI / 2 : Math.PI / 2);
    // the outer face: on the outside of the turn, half way up the step
    const out = new THREE.Vector3(Math.cos(s.th), 0, Math.sin(s.th));
    lp.outer.position.set(x + out.x * (PAR.RW / 2 + 0.4), tip / 2, z + out.z * (PAR.RW / 2 + 0.4));
    lp.outer.quaternion.copy(q); lp.outer.rotateY(Math.PI / 2); if (Math.abs(tip) < 14) lp.outer.visible = false; else lp.outer.visible = true;
    lp.outer.scale.set(1, Math.min(1, Math.abs(tip) / Math.max(1, lp.face.geometry.parameters.height)), 1);
  }

  const colOf = (s) => (s.none ? HUB.none : s.side > 0 ? HUB.bull : HUB.bear);

  function build() {
    clear(); if (!placed) return;
    const M4 = new THREE.Matrix4();
    const top = Math.max(0, ...placed.steps.map((s) => s.tip)), bottom = Math.min(0, ...placed.steps.map((s) => s.tip));
    if (mode === "laser") {
      bloom.enabled = true; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
      zeroRing(placed.outerR, HUB.crk, 0.55); spine(top, bottom, HUB.mute, 0.6);
      const slabMat = new THREE.MeshStandardMaterial({ color: 0x0f0f1a, roughness: 0.35, metalness: 0.6 });
      for (const s of placed.steps) {
        const col = colOf(s);
        const slab = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.07, depthWrite: false, toneMapped: false })); // the body: a faint column from the zero plane to the reading
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); // the laser: thin, bright, bloomed
        const cap = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x0f0f1a, emissive: new THREE.Color(col), emissiveIntensity: 0.55, roughness: 0.4, metalness: 0.5 })); // the tread: a thin lit plate at the reading
        const lp = labelPlane(s, 0x0a0a0f);
        group.add(slab, beam, cap, lp.face, lp.outer);
        parts.push({ s, slab, beam, cap, lp, h: 0, target: 1, flare: 0 });
      }
    } else if (mode === "guide") {
      bloom.enabled = false; renderer.toneMapping = THREE.NoToneMapping;
      zeroRing(placed.outerR, HUB.crk, 0.75); spine(top, bottom, HUB.crk, 0.25);
      for (const s of placed.steps) {
        const col = colOf(s);
        const glass = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: HUB.crk, transparent: true, opacity: 0.06, depthWrite: false, toneMapped: false }));
        const edges = new THREE.LineSegments(edgesGeo, new THREE.LineBasicMaterial({ color: HUB.crk, transparent: true, opacity: 0.55, toneMapped: false }));
        const face = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, side: THREE.DoubleSide, toneMapped: false })); // the reading face carries the direction colour
        const bead = new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); bead.visible = false;
        const lp = labelPlane(s, 0x0a0a0f); // the type sits dark on the lit face
        group.add(glass, edges, face, bead, lp.face, lp.outer);
        parts.push({ s, glass, edges, face, bead, lp, h: 0, target: 1, scan: 0 });
      }
    } else {
      bloom.enabled = false; renderer.toneMapping = THREE.NoToneMapping;
      zeroRing(placed.outerR, HUB.crk, 0.4); spine(top, bottom, HUB.mute, 0.5);
      for (const s of placed.steps) {
        const col = colOf(s);
        const plate = new THREE.Mesh(boxGeo, holoMat(col, 0.015, 0.14)); // the column: a faint hologram body
        const rim = new THREE.Mesh(boxGeo, holoMat(col, 0.28, 0.4)); // the tread: a bright thin plate at the reading
        const lp = labelPlane(s, 0xf2f2f8);
        group.add(plate, rim, lp.face, lp.outer);
        parts.push({ s, plate, rim, lp, h: 0, target: 1, wipe: 0, scint: scintSet.has(s.t) });
      }
    }
    dirty = true; landAt = performance.now();
  }
  // hologram: additive translucent plate with a fresnel rim and a vertical wipe (uWipe 0..1 reveals from the zero plane)
  function holoMat(col, body = 0.1, fres = 0.55) {
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uCol: { value: new THREE.Color(col) }, uWipe: { value: 1 }, uFlick: { value: 0 }, uBody: { value: body }, uFres: { value: fres } },
      vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uCol; uniform float uWipe; uniform float uFlick; uniform float uBody; uniform float uFres; varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); float y = vP.y + 0.5; if (y > uWipe) discard;
          float body = uBody + uFres * f; float edge = smoothstep(0.985, 1.0, y / max(uWipe, 1e-3)) * 0.5;
          gl_FragColor = vec4(uCol * (body + edge + uFlick), 1.0); }`,
    });
  }

  /* ---- the frame: sizes from the data each frame (a height eases toward its target) ---- */
  const M4 = new THREE.Matrix4(), ease = (k) => 1 - Math.pow(1 - k, 3);
  let landAt = 0, lastT = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    const moved = controls.update();
    let busy = false;
    for (const p of parts) {
      // landing: staggered by rank, 900 ms per step, so the readings land one after the other from the centre out
      const delay = p.s.i * 28, k = Math.min(1, Math.max(0, (now - landAt - delay) / 900));
      let h = p.h;
      if (p.landing !== false) { h = ease(k) * p.target; if (k >= 1) p.landing = false; busy = true; }
      else if (Math.abs(p.target - p.h) > 1e-3) { h += (p.target - h) * Math.min(1, dt * 7); if (Math.abs(p.target - h) < 1e-3) h = p.target; busy = true; }
      if (h !== p.h) { p.h = h; p.moved = true; }
      if (p.moved) {
        const { w, tip } = stepMatrix(p.s, p.h, M4);
        if (mode === "laser") {
          p.slab.matrix.copy(M4); p.slab.matrixAutoUpdate = false; p.slab.matrixWorldNeedsUpdate = true;
          p.beam.position.set(p.s.r * Math.cos(p.s.th), tip / 2, p.s.r * Math.sin(p.s.th)); p.beam.scale.set(1, Math.max(0.1, Math.abs(tip)), 1);
          p.cap.position.set(p.s.r * Math.cos(p.s.th), tip, p.s.r * Math.sin(p.s.th)); p.cap.quaternion.setFromAxisAngle(Y, -(p.s.th + Math.PI / 2)); p.cap.scale.set(w, 2.4, PAR.RW); p.cap.position.y = tip + (tip >= 0 ? -1.2 : 1.2);
        } else if (mode === "guide") {
          p.glass.matrix.copy(M4); p.glass.matrixAutoUpdate = false; p.glass.matrixWorldNeedsUpdate = true;
          p.edges.matrix.copy(M4); p.edges.matrixAutoUpdate = false; p.edges.matrixWorldNeedsUpdate = true;
          p.face.position.set(p.s.r * Math.cos(p.s.th), tip + (tip >= 0 ? 0.2 : -0.2), p.s.r * Math.sin(p.s.th)); p.face.quaternion.setFromAxisAngle(Y, -(p.s.th + Math.PI / 2)); p.face.rotateX(-Math.PI / 2); p.face.scale.set(w, PAR.RW, 1);
        } else {
          p.plate.matrix.copy(M4); p.plate.matrixAutoUpdate = false; p.plate.matrixWorldNeedsUpdate = true;
          p.rim.position.set(p.s.r * Math.cos(p.s.th), tip + (tip >= 0 ? -1.2 : 1.2), p.s.r * Math.sin(p.s.th)); p.rim.quaternion.setFromAxisAngle(Y, -(p.s.th + Math.PI / 2)); p.rim.scale.set(w, 2.4, PAR.RW);
        }
        putLabels(p.s, p.lp, p.h); p.moved = false; dirty = true;
      }
      // motion with a meaning: a flare / a scan / a wipe runs only when a value lands or changes
      if (mode === "laser" && p.flare > 0) { p.flare = Math.max(0, p.flare - dt / 0.32); p.beam.material.opacity = 0.9 + 1.6 * p.flare; p.cap.material.emissiveIntensity = 0.55 + 1.6 * p.flare; p.slab.material.opacity = 0.07 + 0.3 * p.flare; busy = true; }
      if (mode === "guide" && p.scan > 0) { p.scan = Math.max(0, p.scan - dt / 0.42); const u = 1 - p.scan, tip = p.s.tip * p.h; p.bead.visible = true; p.bead.position.set(p.s.r * Math.cos(p.s.th), tip * u, p.s.r * Math.sin(p.s.th)); p.edges.material.opacity = 0.55 + 0.45 * p.scan; if (p.scan <= 0) { p.bead.visible = false; p.edges.material.opacity = 0.55; } busy = true; }
      if (mode === "holo") {
        if (p.wipe > 0) { p.wipe = Math.max(0, p.wipe - dt / 0.4); p.plate.material.uniforms.uWipe.value = 1 - p.wipe; p.rim.material.uniforms.uFlick.value = p.wipe * 0.8; busy = true; }
        if (p.scint) { const ph = ((now - t0) / 1000) % 20; const f = ph < 0.5 ? Math.sin((ph / 0.5) * Math.PI) : 0; if (f !== p.plate.material.uniforms.uFlick.value) { p.plate.material.uniforms.uFlick.value = f * 0.5; if (p.wipe <= 0) p.rim.material.uniforms.uFlick.value = f * 0.9; busy = true; } } // once every 20 s, the Hub's "soon" cadence
      }
    }
    if (moveTo) { const k = ease(Math.min(1, (now - moveTo.t0) / moveTo.ms)); camera.position.lerpVectors(moveTo.from.p, moveTo.to.p, k); controls.target.lerpVectors(moveTo.from.t, moveTo.to.t, k); if (k >= 1) moveTo = null; busy = true; }
    if (busy || moved || dirty || measuring) {
      renderer.info.reset(); const r0 = performance.now(); if (bloom.enabled) composer.render(); else renderer.render(scene, camera); if (measuring) { meas.ms += performance.now() - r0; meas.n++; meas.tris = renderer.info.render.triangles; meas.calls = renderer.info.render.calls; }
      dirty = false; frames.n++;
    }
    if (now - frames.since >= 1000) { frames.fps = frames.n / ((now - frames.since) / 1000); frames.n = 0; frames.since = now; if (opts.onFps) opts.onFps(frames.fps); }
  }
  requestAnimationFrame(tick);

  /* ---- camera: the frame holds the whole coil; 70° home; the full sphere to turn (settled) ---- */
  let moveTo = null;
  const dirOf = (el, az) => { const e = (el * Math.PI) / 180, a = (az * Math.PI) / 180; return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).normalize(); };
  function framing(el, az, fill = 0.9) {
    const pts = []; for (const s of placed.steps) { pts.push(new THREE.Vector3(s.r * Math.cos(s.th), 0, s.r * Math.sin(s.th)), new THREE.Vector3(s.r * Math.cos(s.th), s.tip, s.r * Math.sin(s.th))); }
    const box = new THREE.Box3().setFromPoints(pts.length ? pts : [new THREE.Vector3()]), c = box.getCenter(new THREE.Vector3()), rad = Math.max(1, box.getSize(new THREE.Vector3()).length() / 2);
    const d = (rad / fill) / Math.tan((camera.fov * Math.PI) / 360) / Math.min(1, camera.aspect);
    return { p: c.clone().add(dirOf(el, az).multiplyScalar(d)), t: c };
  }
  let home = null;
  function flyHome(ms = 700) { if (!placed) return; home = framing(HOME.el, HOME.az); if (!ms) { camera.position.copy(home.p); controls.target.copy(home.t); moveTo = null; dirty = true; return; } moveTo = { from: { p: camera.position.clone(), t: controls.target.clone() }, to: home, t0: performance.now(), ms }; }
  renderer.domElement.addEventListener("dblclick", () => flyHome(700));

  /* ---- public ---- */
  let measuring = false; const meas = { ms: 0, n: 0, tris: 0, calls: 0 };
  const api = {
    setData(rows, { land = true } = {}) {
      // rows: [{t, v}]; a change against the current data flares / scans / wipes the steps that changed (a value's meaning), the heights ease
      const prev = data ? new Map(data.map((r) => [r.t, r.v])) : null;
      data = rows; placed = place(rows);
      build();
      if (prev && !land) { for (const p of parts) { p.landing = false; p.h = 1; p.moved = true; const was = prev.get(p.s.t); if (was != null && Math.abs(was - (p.s.v ?? 0)) > 1e-6) api.pulse(p.s.t); } }
      if (!home) flyHome(0); else { const h = framing(HOME.el, HOME.az); home = h; }
      dirty = true;
    },
    pulse(t) { for (const p of parts) if (p.s.t === t) { if (mode === "laser") p.flare = 1; else if (mode === "guide") p.scan = 1; else p.wipe = 1; } dirty = true; },
    change(t, v) { // one reading changes: the step eases to the new height and signals the change
      if (!data) return; const r = data.find((x) => x.t === t); if (!r) return; r.v = v; const np = place(data); const step = np.steps.find((s) => s.t === t); const p = parts.find((q) => q.s.t === t);
      if (step && p) { p.s.tip = step.tip; p.s.v = v; p.moved = true; p.landing = false; p.lp.face.material.map = labelTex(t, v, mode === "holo" ? 0xf2f2f8 : 0x0a0a0f); p.lp.face.material.needsUpdate = true; }
      api.pulse(t); dirty = true;
    },
    setMode(m) { mode = m; build(); for (const p of parts) { p.landing = false; p.h = 1; p.moved = true; } dirty = true; },
    land() { build(); dirty = true; },
    mode: () => mode, placed: () => placed, home: () => flyHome(700), orbitTo(el, az) { const d = camera.position.distanceTo(controls.target); camera.position.copy(controls.target).add(dirOf(el, az).multiplyScalar(d)); moveTo = null; dirty = true; },
    elevation() { const d = camera.position.clone().sub(controls.target); return { el: +((Math.asin(d.y / d.length()) * 180) / Math.PI).toFixed(1), az: +((Math.atan2(d.x, d.z) * 180) / Math.PI).toFixed(1), d: +d.length().toFixed(1) }; },
    // the frame-rate probe: render every frame for `ms` while the camera turns 90°, count the frames; also the renderer's own time per frame
    async measure(ms = 4000) {
      measuring = true; meas.ms = 0; meas.n = 0; const start = performance.now(); const n0 = renderer.info.render.frame; let f = 0; const el0 = api.elevation();
      await new Promise((res) => { const step = (now) => { const k = Math.min(1, (now - start) / ms); api.orbitTo(el0.el, el0.az + 90 * k); f++; if (k < 1) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
      measuring = false; const dt = (performance.now() - start) / 1000;
      return { fps: +(f / dt).toFixed(1), frames: f, seconds: +dt.toFixed(2), rendered: meas.n, render_ms_per_frame: meas.n ? +(meas.ms / meas.n).toFixed(2) : null, dpr: renderer.getPixelRatio(), w: view.w, h: view.h, mode, steps: parts.length, triangles: meas.tris, calls: meas.calls, gpu: (() => { try { const gl = renderer.getContext(); const d = gl.getExtension("WEBGL_debug_renderer_info"); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch { return null; } })() };
    },
    canvas: renderer.domElement, fps: () => frames.fps, labels: () => parts.map((p) => ({ t: p.s.t, v: p.s.v, side: p.s.side, tip: +p.s.tip.toFixed(1), r: +p.s.r.toFixed(1) })),
  };
  return api;
}

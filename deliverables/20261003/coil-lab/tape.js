/* COIL LAB · Part B — the scintillas tape, a proposal (3 Oct 2026). Proposal only: the Hub is not changed.
   Alan: "there's a lot of scintillas at moments… I need to know the names… maybe a line down the middle and they move in
   either direction… small movements are hard to read… the zoom-in level is going to require expanding to more of a bigger
   screen mode."
   DATA: real rows of public.scintillas (the table the Hub's tape reads), pulled 3 Oct through the Hub's own read path:
   Friday 2 Oct (12 rows, 9 up · 3 down, all stamped at the close), and the two busiest sessions of the month for the
   "40 at once" case (24 Sep: 34 rows; 28 Sep: 32 rows). Nothing is invented: every mark is a stored row.
   THREE VARIANTS, all working on the same rows:
     T1 · CENTRE-LINE TAPE — the strip itself: a cyan centre line, up moves standing above it, down moves hanging below,
          the name on every mark, the mark's length = how many times its usual day, a floor so a small move still reads.
          It drifts right → left and can be dragged (the swipe Alan likes). Height: one share of the screen (4 % → 42 px
          at 1050 tall).
     T2 · THE SPREAD (zoom level, full panel) — x = the time it fired (ET), y = size, up above / down below the centre
          line; every mark labelled, labels nudged apart; a swarm at one minute fans out by size.
     T3 · THE LADDER (zoom level, full panel) — the centre line turned vertical: ups ranked to the right, downs to the
          left, one row per name with the name, × usual and the move %; forty names = forty rows, all on one screen. */
const C = { crk: "#00D4FF", bull: "#00FFA3", bear: "#FF2D55", ink: "#F2F2F8", ink2: "#C6C8DE", ink3: "#9A9AB6", dim: "#868AAA", mute: "#3A3A52", line: "#1A1A2A", bg: "#0A0A0F", surface: "#0F0F1A" };
const MONO = '"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace';
const ET = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false });
const etMin = (ts) => { const [h, m] = ET.format(new Date(ts)).split(":").map(Number); return h * 60 + m; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// one row → one mark. size = |z| (× its usual day) for a statistical fire; a raw-rule fire has z < 1, so its size is the move itself scaled to the same ladder (3 % ≈ 1×)
export function marks(rows) {
  return rows.filter((r) => r.kind === "price_outlier" || r.kind === "earnings_surprise").map((r) => {
    const d = r.detail || {}, z = Math.abs(+r.magnitude || 0), move = d.move_pct != null ? +d.move_pct : null;
    const size = Math.max(z, move != null ? Math.abs(move) / 3 : 0);
    return { t: r.subject, dir: r.direction > 0 ? 1 : r.direction < 0 ? -1 : 0, z, move, size, ts: r.ts, min: etMin(r.ts), rule: d.rule || "", fired: (d.fired || []).join("+"), price: d.price, kind: r.kind };
  });
}
const fmtX = (m) => (m.z >= 1 ? m.z.toFixed(1) + "×" : m.move != null ? (m.move > 0 ? "+" : "") + m.move.toFixed(1) + "%" : "");
const fmtMove = (m) => (m.move == null ? "" : (m.move > 0 ? "+" : "") + m.move.toFixed(1) + "%");

/* T1 · the strip */
export function tapeStrip(host, ms, opts = {}) {
  const H = opts.height || 42, W = host.clientWidth || 900;
  const mid = H / 2, maxLen = mid - 14, scale = maxLen / Math.max(1, ...ms.map((m) => m.size)), floor = 3, slot = opts.slot || 76;
  const total = Math.max(W, ms.length * slot);
  let x = 0, drag = null, paused = false;
  host.innerHTML = `<div class="t1" style="height:${H}px"><canvas></canvas></div>`;
  const cv = host.querySelector("canvas"), g = cv.getContext("2d");
  const dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px"; g.scale(dpr, dpr);
  function draw() {
    g.clearRect(0, 0, W, H); g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = C.crk; g.globalAlpha = 0.5; g.lineWidth = 1; g.beginPath(); g.moveTo(0, mid + 0.5); g.lineTo(W, mid + 0.5); g.stroke(); g.globalAlpha = 1;
    g.font = `500 10px ${MONO}`; g.textAlign = "center";
    ms.forEach((m, i) => {
      let px = ((i * slot + slot / 2 - x) % total + total) % total; if (px > W + slot) return;
      const len = Math.max(floor, m.size * scale), col = m.dir > 0 ? C.bull : m.dir < 0 ? C.bear : C.dim;
      g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.moveTo(px, mid); g.lineTo(px, m.dir >= 0 ? mid - len : mid + len); g.stroke();
      g.fillStyle = col; g.fillRect(px - 2, (m.dir >= 0 ? mid - len : mid + len) - 2, 4, 4);
      // the name on every mark, with its size, on one line: above the line for an up move, below for a down move; the tick's length is the size
      g.textBaseline = m.dir >= 0 ? "bottom" : "top"; const ty = m.dir >= 0 ? mid - len - 2 : mid + len + 2;
      g.fillStyle = C.ink; g.textAlign = "right"; g.fillText(m.t, px - 1, ty);
      g.fillStyle = C.ink3; g.font = `400 9px ${MONO}`; g.textAlign = "left"; g.fillText(fmtX(m), px + 4, ty); g.font = `500 10px ${MONO}`; g.textAlign = "center";
    });
  }
  let last = performance.now();
  function tick(now) { if (!host.isConnected) return; const dt = (now - last) / 1000; last = now; if (!paused && !drag) { x += (opts.speed == null ? 22 : opts.speed) * dt; draw(); } requestAnimationFrame(tick); }
  cv.addEventListener("pointerdown", (e) => { drag = { x0: e.clientX, at: x }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => { if (drag) { x = drag.at - (e.clientX - drag.x0); draw(); } });
  cv.addEventListener("pointerup", () => (drag = null)); cv.addEventListener("pointerenter", () => (paused = true)); cv.addEventListener("pointerleave", () => (paused = false));
  draw(); requestAnimationFrame(tick);
  return { draw, pause: (p) => (paused = p), offset: (v) => { x = v; draw(); } };
}

/* T2 · the spread: time across, size up / down, every name printed, labels nudged apart */
export function spread(host, ms, opts = {}) {
  const W = host.clientWidth || 900, H = opts.height || 520, L = 56, R = 16, T = 26, B = 34, mid = T + (H - T - B) / 2;
  const mins = ms.map((m) => m.min), lo = Math.min(9 * 60 + 30, ...mins) - 10, hi = Math.max(16 * 60, ...mins) + 10;
  const sx = (mn) => L + ((mn - lo) / (hi - lo)) * (W - L - R), maxS = Math.max(1, ...ms.map((m) => m.size)), sy = (s) => (s / maxS) * (mid - T - 14);
  const pts = ms.map((m) => ({ m, x: sx(m.min), y: m.dir >= 0 ? mid - Math.max(6, sy(m.size)) : mid + Math.max(6, sy(m.size)) }));
  // a swarm at one minute: fan the marks out along x by rank so forty names at one stamp still read (each gets 10 px)
  const byMin = new Map(); for (const p of pts) { const k = p.m.min + "|" + p.m.dir; if (!byMin.has(k)) byMin.set(k, []); byMin.get(k).push(p); }
  for (const arr of byMin.values()) if (arr.length > 1) { arr.sort((a, b) => b.m.size - a.m.size); const span = Math.min(W - L - R - 20, (arr.length - 1) * 14); arr.forEach((p, i) => (p.x = Math.max(L + 4, Math.min(W - R - 4, p.x - span / 2 + i * (span / Math.max(1, arr.length - 1)))))); }
  // labels: nudge vertically apart within a side, never over the centre line
  const lab = pts.map((p) => ({ p, x: p.x, y: p.y + (p.m.dir >= 0 ? -7 : 11), y0: p.y + (p.m.dir >= 0 ? -7 : 11), w: p.m.t.length * 6.2 + 4, h: 11 }));
  for (const side of [1, -1]) { // within a side, sweep from the line outward: a label that would sit on another is pushed further out
    const L = lab.filter((l) => (l.p.m.dir >= 0) === (side > 0)).sort((a, b) => (side > 0 ? b.y - a.y : a.y - b.y));
    const placed = [];
    for (const l of L) { let guard = 0; while (guard++ < 80 && placed.some((o) => Math.abs(o.x - l.x) < (o.w + l.w) / 2 && Math.abs(o.y - l.y) < l.h)) l.y -= side * l.h; l.y = Math.max(T + 9, Math.min(H - B - 2, l.y)); placed.push(l); }
  }
  const hours = []; for (let h = Math.ceil(lo / 60); h * 60 <= hi; h++) hours.push(h);
  let s = `<svg class="t2" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family='${MONO}'>`;
  s += `<rect width="${W}" height="${H}" fill="${C.bg}"/>`;
  for (const h of hours) s += `<line x1="${sx(h * 60)}" x2="${sx(h * 60)}" y1="${T}" y2="${H - B}" stroke="${C.line}"/><text x="${sx(h * 60)}" y="${H - B + 16}" fill="${C.dim}" font-size="10" text-anchor="middle">${String(h).padStart(2, "0")}:00</text>`;
  s += `<line x1="${L}" x2="${W - R}" y1="${mid}" y2="${mid}" stroke="${C.crk}" stroke-opacity=".6"/>`;
  s += `<text x="${L - 6}" y="${T + 10}" fill="${C.bull}" font-size="10" text-anchor="end">UP</text><text x="${L - 6}" y="${H - B - 2}" fill="${C.bear}" font-size="10" text-anchor="end">DOWN</text>`;
  for (const k of [1, 2, 3, 4]) if (k <= maxS) { for (const side of [-1, 1]) s += `<line x1="${L}" x2="${W - R}" y1="${mid + side * sy(k)}" y2="${mid + side * sy(k)}" stroke="${C.line}" stroke-dasharray="2 4"/>`; s += `<text x="${L - 6}" y="${mid - sy(k) + 3}" fill="${C.mute}" font-size="9" text-anchor="end">${k}×</text>`; }
  for (const p of pts) { const col = p.m.dir > 0 ? C.bull : p.m.dir < 0 ? C.bear : C.dim; s += `<line x1="${p.x}" x2="${p.x}" y1="${mid}" y2="${p.y}" stroke="${col}" stroke-width="1.5" stroke-opacity=".8"/><circle cx="${p.x}" cy="${p.y}" r="3" fill="${col}"><title>${esc(p.m.t)} · ${esc(fmtX(p.m))} · ${esc(fmtMove(p.m))} · ${esc(p.m.rule)}</title></circle>`; }
  for (const l of lab) { if (Math.abs(l.y - l.y0) > 2) s += `<line x1="${l.x}" x2="${l.x}" y1="${l.p.y}" y2="${l.y + (l.p.m.dir >= 0 ? 2 : -9)}" stroke="${C.mute}" stroke-width="1"/>`; s += `<text x="${l.x}" y="${l.y}" fill="${C.ink}" font-size="10" font-weight="600" text-anchor="middle">${esc(l.p.m.t)}</text>`; }
  s += `</svg>`; host.innerHTML = s; return { points: pts.length, labels: lab.map((l) => ({ t: l.p.m.t, x: Math.round(l.x), y: Math.round(l.y), w: Math.round(l.w), h: l.h })) };
}

/* T3 · the ladder: the centre line stood up; ups to the right, downs to the left, ranked, one row per name */
export function ladder(host, ms, opts = {}) {
  const ups = ms.filter((m) => m.dir >= 0).sort((a, b) => b.size - a.size), dns = ms.filter((m) => m.dir < 0).sort((a, b) => b.size - a.size);
  const n = Math.max(ups.length, dns.length), rowH = Math.max(18, Math.min(26, Math.floor((opts.height || 520) / Math.max(1, n)))), maxS = Math.max(1, ...ms.map((m) => m.size));
  const row = (m, side) => { const len = Math.max(4, Math.round((m.size / maxS) * 100)); const col = side > 0 ? C.bull : C.bear;
    return `<div class="t3r ${side > 0 ? "up" : "dn"}" style="height:${rowH}px"><span class="t3n">${esc(m.t)}</span><span class="t3b"><i style="width:${len}%;background:${col}"></i></span><span class="t3x">${esc(fmtX(m))}</span><span class="t3m">${esc(fmtMove(m))}</span></div>`; };
  host.innerHTML = `<div class="t3"><div class="t3h"><span class="dn">${dns.length} DOWN</span><span class="mid">${ms.length} SCINTILLAS</span><span class="up">${ups.length} UP</span></div>
    <div class="t3cols"><div class="t3col dn">${dns.map((m) => row(m, -1)).join("")}</div><div class="t3line"></div><div class="t3col up">${ups.map((m) => row(m, 1)).join("")}</div></div></div>`;
  return { rows: ms.length, rowH, ups: ups.length, dns: dns.length };
}

/* GEIGER VISUALS · shared runtime for the three motion mockups and the three tab mockups.
   Real data only (data.js, pulled 2026-09-25 from fan_daily / momentum_daily / company_profile and the
   chart API). One replay clock: a continuous position in trading days, advanced by requestAnimationFrame,
   so every reading on screen is an interpolation between two real days - nothing is stepped per day. */
(function () {
  const D = window.GV_DATA, DATES = D.META.hist_dates, N = DATES.length;
  const GV = (window.GV = { D, DATES, N });
  window.__GV = { frames: 0, moves: 0 };

  /* ---- names ---- */
  GV.cohort = (key) => (D.COHORTS[key] || []).filter((t) => D.HIST[t] && D.NOW[t]);
  GV.name = (t) => D.NAME[t] || t;

  /* ---- prices aligned to the replay dates (weekend carry: last bar on or before the day, at most 4 days back) ---- */
  const PXI = {};
  const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
  function pxIndex(t) {
    if (PXI[t]) return PXI[t];
    const bars = D.PX[t] || [];
    const byDay = {}, days = [];
    for (let i = 0; i < bars.length; i++) {
      const d = dayOf(bars[i][0]);
      const prev = bars[i - 1] ? bars[i - 1][1] : null;
      const chg = prev ? (bars[i][1] / prev - 1) * 100 : null;
      /* the usual day: mean absolute daily move over the 20 bars before this one */
      let s = 0, n = 0;
      for (let k = Math.max(1, i - 20); k < i; k++) { s += Math.abs(bars[k][1] / bars[k - 1][1] - 1) * 100; n++; }
      let dv = 0, dn = 0;
      for (let k = Math.max(0, i - 20); k < i; k++) { dv += bars[k][1] * bars[k][2]; dn++; }
      byDay[d] = { c: bars[i][1], chg, usual: n ? s / n : null, liq: dn ? dv / dn : null };
      days.push(d);
    }
    const out = DATES.map((d) => {
      let k = -1;
      for (let i = days.length - 1; i >= 0; i--) if (days[i] <= d) { k = i; break; }
      if (k < 0) return null;
      const gap = (Date.parse(d) - Date.parse(days[k])) / 864e5;
      return gap <= 4 ? byDay[days[k]] : null;
    });
    return (PXI[t] = out);
  }
  GV.px = pxIndex;

  /* ---- interpolation on the continuous day position ---- */
  GV.lerpAt = (arr, pos, get) => {
    const L = arr.length; const i = Math.max(0, Math.min(L - 1, Math.floor(pos))), f = pos - i, j = Math.min(L - 1, i + 1);
    const a = get ? get(arr[i]) : arr[i], b = get ? get(arr[j]) : arr[j];
    if (a == null && b == null) return null;
    if (a == null) return b;
    if (b == null) return a;
    return a + (b - a) * f;
  };
  GV.geigerAt = (t, pos) => GV.lerpAt(D.HIST[t], pos);
  GV.chgAt = (t, pos) => GV.lerpAt(pxIndex(t), pos, (x) => x && x.chg);
  GV.usualAt = (t, pos) => GV.lerpAt(pxIndex(t), pos, (x) => x && x.usual);
  GV.vsUsualAt = (t, pos) => { const c = GV.chgAt(t, pos), u = GV.usualAt(t, pos); return c == null || !u ? null : c / u; };
  GV.spanAt = (t, pos) => { const p = pxIndex(t), a = p[0], b = GV.lerpAt(p, pos, (x) => x && x.c); return a && b ? (b / a.c - 1) * 100 : null; };
  GV.liq = (t) => { const p = pxIndex(t); for (let i = p.length - 1; i >= 0; i--) if (p[i] && p[i].liq) return p[i].liq; return null; };
  GV.mcap = (t) => D.MCAP[t] || null;

  /* the sortable columns a board row carries; the same keys rank every mockup */
  GV.SORTS = [["g", "GEIGER"], ["chg", "DAY MOVE"], ["usual", "VS USUAL DAY"], ["span", "% OVER SPAN"], ["mcap", "MKT CAP"]];
  GV.metric = (key, t, pos) => key === "g" ? GV.geigerAt(t, pos) : key === "chg" ? GV.chgAt(t, pos)
    : key === "usual" ? GV.vsUsualAt(t, pos) : key === "span" ? GV.spanAt(t, pos) : key === "mcap" ? GV.mcap(t) : null;

  /* ---- format ---- */
  GV.fmtG = (v) => v == null ? "—" : (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2);
  GV.fmtPct = (v, d) => v == null ? "—" : (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(d == null ? 1 : d) + "%";
  GV.fmtCap = (v) => v == null ? "—" : v >= 1e12 ? "$" + (v / 1e12).toFixed(1) + "T" : v >= 1e9 ? "$" + (v / 1e9).toFixed(0) + "B" : "$" + (v / 1e6).toFixed(0) + "M";
  GV.approach = (cur, target, dt, tau) => cur + (target - cur) * (1 - Math.exp(-dt / tau));
  GV.css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  /* ---- the clock ---- */
  GV.clock = function (onFrame, n, dates) {
    const c = { n: n || N, dates: dates || DATES, pos: 0, playing: false, speedI: 1, speeds: [["½×", 1400], ["1×", 700], ["2×", 350], ["4×", 175]], last: 0, loop: true, onFrame };
    c.step = function (now) {
      if (!c.last) c.last = now;
      const dt = Math.min(120, now - c.last); c.last = now;
      if (c.playing) {
        c.pos += dt / c.speeds[c.speedI][1];
        if (c.pos >= c.n - 1) { c.pos = c.n - 1; if (c.loop) c.pos = 0; else c.pause(); }
      }
      /* AT REST, NOTHING RUNS. A frame is drawn only while playing, while something is still gliding
         (a page sets c.dirty while it moves), or after an input (scrub, chip, hover, resize). A tab left
         open all day costs nothing until something changes. */
      if (c.playing || c.dirty) {
        c.dirty = false;
        window.__GV.frames++;
        c.onFrame(c.pos, dt);
        if (c.ui) c.ui.sync();
      } else c.last = 0;
      requestAnimationFrame(c.step);
    };
    c.play = () => { c.playing = true; c.dirty = true; if (c.ui) c.ui.sync(); };
    c.pause = () => { c.playing = false; c.dirty = true; if (c.ui) c.ui.sync(); };
    c.toggle = () => (c.playing ? c.pause() : c.play());
    c.start = () => { c.dirty = true; window.addEventListener("resize", () => { c.dirty = true; }); requestAnimationFrame(c.step); };
    c.date = () => { const i = Math.round(c.pos); return c.dates[Math.max(0, Math.min(c.n - 1, i))]; };
    return c;
  };

  /* ---- the transport row (PLAY · speed · scrub · date), the hub's own shape ---- */
  GV.transport = function (el, c) {
    el.className = "gv-transport";
    el.innerHTML = '<button class="gv-play" data-a="play">▶ PLAY</button><button class="gv-chip" data-a="speed">1×</button>' +
      '<input class="gv-scrub" type="range" min="0" max="' + ((c.n - 1) * 20) + '" value="0">' +
      '<span class="gv-date tab"></span>';
    const play = el.querySelector('[data-a="play"]'), sp = el.querySelector('[data-a="speed"]'),
      sc = el.querySelector("input"), dt = el.querySelector(".gv-date");
    play.onclick = c.toggle;
    sp.onclick = () => { c.speedI = (c.speedI + 1) % c.speeds.length; sp.textContent = c.speeds[c.speedI][0]; };
    sc.oninput = () => { c.pos = +sc.value / 20; c.pause(); c.dirty = true; };
    let lastDate = "", lastPlay = null, lastV = -1;
    c.ui = { sync() {
      const d = c.date(); if (d !== lastDate) { dt.textContent = d; lastDate = d; }
      if (c.playing !== lastPlay) { play.innerHTML = c.playing ? "❙❙ PAUSE" : "▶ PLAY"; play.classList.toggle("is-on", c.playing); lastPlay = c.playing; }
      const v = Math.round(c.pos * 20); if (v !== lastV && document.activeElement !== sc) { sc.value = v; lastV = v; }
    } };
    return c.ui;
  };

  /* ---- chip groups ---- */
  GV.chips = function (el, items, cur, onPick) {
    el.className = "gv-chips";
    const paint = () => { el.innerHTML = items.map(([k, l]) => '<button class="gv-chip' + (k === cur ? " is-on" : "") + '" data-k="' + k + '">' + l + "</button>").join(""); };
    paint();
    el.onclick = (e) => { const b = e.target.closest("[data-k]"); if (!b) return; cur = b.dataset.k; paint(); onPick(cur); };
    return { get: () => cur };
  };

  /* ---- canvas helper: device-pixel aware, resized to its box ---- */
  GV.canvas = function (host) {
    const cv = document.createElement("canvas"); cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%"; host.appendChild(cv);
    const ctx = cv.getContext("2d"); let w = 0, h = 0, dpr = 1;
    const fit = () => { const r = host.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1);
      if (Math.round(r.width) !== w || Math.round(r.height) !== h) { w = Math.round(r.width); h = Math.round(r.height); cv.width = w * dpr; cv.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return { w, h }; };
    return { cv, ctx, fit };
  };
  /* one hue rule everywhere: a reading above zero is green, below is red; never grey */
  GV.tone = (v) => v == null ? GV.css("--mute") : v >= 0 ? GV.css("--bull") : GV.css("--bear");
  GV.rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")"; };
})();

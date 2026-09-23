(function () {
  "use strict";
  var DATA = JSON.parse(document.getElementById("cloud-data").textContent);
  var NS = "http://www.w3.org/2000/svg";
  var state = { win: "all" };
  var W = 1000, H = 380, L = 64, R = 78, T = 26, B = 40, PW = W - L - R, PH = H - T - B;
  var PAST = 500, FWD = 250, SPLIT = 0.42; /* the past keeps 42% of the width, the cone carried forward gets 58% */

  function el(tag, attrs, parent, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function h(tag, cls, parent, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function fmt(v, dp) {
    if (v == null || !isFinite(v)) return "–";
    return v.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }
  function signed(v, dp, unit) {
    if (v == null || !isFinite(v)) return "–";
    return (v > 0 ? "+" : v < 0 ? "−" : "") + fmt(Math.abs(v), dp) + (unit || "");
  }
  function ordinal(p) {
    if (p == null) return "–";
    var n = Math.round(p), s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function niceTicks(lo, hi, count) {
    var span = hi - lo, step = Math.pow(10, Math.floor(Math.log(span / count) / Math.LN10)), err = span / count / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    var t = [];
    for (var v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) t.push(+v.toFixed(10));
    return t;
  }
  function tickDp(ticks) {
    var d = 0;
    for (var i = 0; i < ticks.length; i++) { var s = String(ticks[i]); var j = s.indexOf("."); if (j >= 0) d = Math.max(d, s.length - j - 1); }
    return Math.min(d, 3);
  }
  function xs(s) { return s < 0 ? L + ((s + PAST) / PAST) * PW * SPLIT : L + PW * SPLIT + (s / FWD) * PW * (1 - SPLIT); }
  function win(inst) { return inst.windows[state.win] || inst.windows.all; }

  /* --- one instrument panel --------------------------------------------------- */
  function panel(inst, host) {
    var sec = h("section", "inst", host);
    sec.id = "i-" + inst.sym.toLowerCase();
    var w = win(inst), td = w.today;
    var hd = h("div", "hd", sec);
    var left = h("div", "", hd);
    h("h3", "", left, inst.sym + " · " + inst.name);
    h("p", "sub", left, inst.unit + " · " + td.sessions.toLocaleString("en-US") + " sessions since " + td.since + " · close of " + td.date);
    var tiles = h("div", "tiles", hd);
    function tile(val, label, now) { var t = h("div", "tile", tiles); var b = h("b", now ? "now" : "", t, val); h("span", "", t, label); return t; }
    tile(fmt(td.level, inst.dp), "today · " + td.date, true);
    tile(signed(td.z_1y, 1, "σ"), "z vs trailing year");
    tile(ordinal(td.pct_level_1y), "level percentile, trailing year");
    tile(signed(td.ret_1y == null ? null : td.ret_1y * 100, 1, "%"), "1-year change");
    tile(ordinal(td.ret_1y_pct), "that change vs history since " + td.since.slice(0, 4));

    var wrap = h("div", "plotwrap", sec);
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, class: "plot", role: "img", "aria-label": inst.sym + " projection cloud" }, wrap);
    var tip = h("div", "tip", sec);

    /* values to fit */
    var past = inst.rolling, fwd = w.bands, level = td.level;
    var lo = Infinity, hi = -Infinity;
    function fit(v) { if (v == null || !isFinite(v)) return; if (v < lo) lo = v; if (v > hi) hi = v; }
    past.forEach(function (p) { fit(p.q[0]); fit(p.q[4]); });
    fwd.forEach(function (b) { if (b.p05 == null) return; fit(level * b.p05); fit(level * b.p95); fit(level * b.s2lo); fit(level * b.s2hi); });
    fit(level);
    var pad = (hi - lo) * 0.06 || 1; lo -= pad; hi += pad;
    function y(v) { return T + ((hi - v) / (hi - lo)) * PH; }

    /* grid + y axis (solid hairlines, one step off the surface) */
    var ticks = niceTicks(lo, hi, 5), dp = tickDp(ticks);
    ticks.forEach(function (t) {
      el("line", { x1: L, x2: L + PW, y1: y(t), y2: y(t), class: "grid" }, svg);
      el("text", { x: L - 8, y: y(t) + 3, "text-anchor": "end", class: "ax" }, svg, fmt(t, dp));
    });

    /* the trailing-year cloud, behind today */
    function poly(pts, cls) { return el("polygon", { points: pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" "), class: cls, fill: "var(--" + cls + ")" }, svg); }
    function line(pts, cls) { return el("polyline", { points: pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" "), class: cls }, svg); }
    var pu = [], pl = [], pu2 = [], pl2 = [], pm = [];
    past.forEach(function (p) {
      var x = xs(-p.k);
      pu.push([x, y(p.q[4])]); pl.unshift([x, y(p.q[0])]);
      pu2.push([x, y(p.q[3])]); pl2.unshift([x, y(p.q[1])]);
      pm.push([x, y(p.q[2])]);
    });
    poly(pu.concat(pl), "cloud1"); poly(pu2.concat(pl2), "cloud2"); line(pm, "med");

    /* the cone carried forward from today's close */
    var apex = [xs(0), y(level)];
    var fu = [apex], fl = [], fu2 = [apex], fl2 = [], fm = [apex], s1a = [apex], s1b = [apex], s2a = [apex], s2b = [apex];
    fwd.forEach(function (b) {
      if (b.p05 == null) return;
      var x = xs(b.h);
      fu.push([x, y(level * b.p95)]); fl.unshift([x, y(level * b.p05)]);
      fu2.push([x, y(level * b.p75)]); fl2.unshift([x, y(level * b.p25)]);
      fm.push([x, y(level * b.p50)]);
      s1a.push([x, y(level * b.s1hi)]); s1b.push([x, y(level * b.s1lo)]);
      s2a.push([x, y(level * b.s2hi)]); s2b.push([x, y(level * b.s2lo)]);
    });
    poly(fu.concat(fl, [apex]), "cloud1"); poly(fu2.concat(fl2, [apex]), "cloud2");
    line(s2a, "sig"); line(s2b, "sig"); line(s1a, "sig"); line(s1b, "sig"); line(fm, "med");

    /* today */
    el("line", { x1: xs(0), x2: xs(0), y1: T, y2: T + PH, class: "now-line" }, svg);
    el("circle", { cx: apex[0], cy: apex[1], r: 5, class: "now-dot" }, svg);
    el("text", { x: xs(0) + 6, y: T + 9, class: "now-txt" }, svg, "today " + td.date + " · " + fmt(level, inst.dp));

    /* right-edge labels, pushed apart so none collide */
    var last = null; for (var i = fwd.length - 1; i >= 0; i--) if (fwd[i].p05 != null) { last = fwd[i]; break; }
    if (last) {
      var labs = [
        { v: level * last.p95, t: "95th", c: "ax r" }, { v: level * last.p75, t: "75th", c: "ax r" }, { v: level * last.p50, t: "median", c: "ax r" },
        { v: level * last.p25, t: "25th", c: "ax r" }, { v: level * last.p05, t: "5th", c: "ax r" },
        { v: level * last.s2hi, t: "+2σ", c: "ax s" }, { v: level * last.s1hi, t: "+1σ", c: "ax s" }, { v: level * last.s1lo, t: "−1σ", c: "ax s" }, { v: level * last.s2lo, t: "−2σ", c: "ax s" }
      ].map(function (l) { l.y = y(l.v); return l; }).sort(function (a, b) { return a.y - b.y; });
      for (var j = 1; j < labs.length; j++) if (labs[j].y < labs[j - 1].y + 10) labs[j].y = labs[j - 1].y + 10;
      var over = labs[labs.length - 1].y - (T + PH); if (over > 0) labs.forEach(function (l) { l.y -= over; });
      labs.forEach(function (l) { el("text", { x: xs(last.h) + 6, y: l.y + 3, class: l.c }, svg, l.t); });
    }

    /* x axis */
    function xl(s, text, anchor) { el("text", { x: xs(s), y: T + PH + 16, "text-anchor": anchor || "middle", class: "ax" }, svg, text); }
    var oldest = past[0], mid = past.reduce(function (a, p) { return Math.abs(p.k - 250) < Math.abs(a.k - 250) ? p : a; }, past[0]);
    xl(-oldest.k, oldest.d, "start"); if (mid !== oldest) xl(-mid.k, mid.d); xl(0, "today");
    xl(21, "+1m"); xl(63, "+3m"); xl(126, "+6m"); xl(250, "+1y", "end");
    el("text", { x: L, y: H - 6, class: "ax s" }, svg, "← trailing-year distribution of closes, session by session · today · the same history carried forward →");

    /* hover: crosshair finds the session; the tooltip lists every band there */
    var hit = el("rect", { x: L, y: T, width: PW, height: PH, class: "hit" }, svg);
    var xh = el("line", { x1: 0, x2: 0, y1: T, y2: T + PH, class: "xh" }, svg);
    function row(k, v) { var r = h("div", "r", tip); h("i", "", r, k); h("span", "", r, v); }
    function show(evt) {
      var rect = svg.getBoundingClientRect(), px = ((evt.clientX - rect.left) / rect.width) * W;
      var fx = (px - L) / PW; if (fx < 0 || fx > 1) return hide();
      var s = fx < SPLIT ? (fx / SPLIT) * PAST - PAST : ((fx - SPLIT) / (1 - SPLIT)) * FWD;
      while (tip.firstChild) tip.removeChild(tip.firstChild);
      var x;
      if (s < 0) {
        var p = past.reduce(function (a, q) { return Math.abs(q.k + s) < Math.abs(a.k + s) ? q : a; }, past[0]);
        x = xs(-p.k);
        h("b", "", tip, p.d + " · trailing year");
        row("95th", fmt(p.q[4], inst.dp)); row("75th", fmt(p.q[3], inst.dp)); row("median", fmt(p.q[2], inst.dp)); row("25th", fmt(p.q[1], inst.dp)); row("5th", fmt(p.q[0], inst.dp));
      } else {
        var b = fwd.reduce(function (a, q) { return Math.abs(q.h - s) < Math.abs(a.h - s) ? q : a; }, fwd[0]);
        x = xs(b.h);
        var named = DATA.named[b.h] ? " · " + DATA.named[b.h] : "";
        h("b", "", tip, "+" + b.h + " session" + (b.h === 1 ? "" : "s") + named);
        if (b.p05 == null) { row("samples", String(b.n)); row("", "too few to draw"); }
        else {
          row("95th", fmt(level * b.p95, inst.dp)); row("75th", fmt(level * b.p75, inst.dp)); row("median", fmt(level * b.p50, inst.dp));
          row("25th", fmt(level * b.p25, inst.dp)); row("5th", fmt(level * b.p05, inst.dp));
          row("+2σ / −2σ", fmt(level * b.s2hi, inst.dp) + " / " + fmt(level * b.s2lo, inst.dp));
          row("+1σ / −1σ", fmt(level * b.s1hi, inst.dp) + " / " + fmt(level * b.s1lo, inst.dp));
          row("samples", b.n.toLocaleString("en-US"));
        }
      }
      xh.setAttribute("x1", x); xh.setAttribute("x2", x); xh.style.opacity = ".6";
      tip.style.display = "block";
      var sr = sec.getBoundingClientRect();
      var tx = evt.clientX - sr.left + 14, ty = evt.clientY - sr.top + 14;
      if (tx + 190 > sr.width) tx = evt.clientX - sr.left - 200;
      tip.style.left = tx + "px"; tip.style.top = ty + "px";
    }
    function hide() { tip.style.display = "none"; xh.style.opacity = "0"; }
    hit.addEventListener("pointermove", show); hit.addEventListener("pointerleave", hide);
    /* on a narrow screen the plot scrolls sideways; open it with today in view rather than two years ago */
    if (wrap.scrollWidth > wrap.clientWidth + 8) wrap.scrollLeft = Math.max(0, (xs(0) / W) * wrap.scrollWidth - wrap.clientWidth * 0.45);

    /* the table twin: every drawn value, without hovering */
    var det = h("details", "", sec); h("summary", "", det, "table · the bands at 1 week, 1 month, 3 months, 6 months, 1 year");
    var tb = h("table", "tv", det), thead = h("thead", "", tb), tr = h("tr", "", thead);
    ["horizon", "5th", "25th", "median", "75th", "95th", "−2σ", "−1σ", "+1σ", "+2σ", "samples"].forEach(function (t) { h("th", "", tr, t); });
    var tbody = h("tbody", "", tb);
    [5, 21, 63, 126, 250].forEach(function (hz) {
      var b = null; for (var i = 0; i < fwd.length; i++) if (fwd[i].h === hz) b = fwd[i];
      if (!b) return;
      var r = h("tr", "", tbody); h("td", "", r, "+" + hz + " · " + DATA.named[hz]);
      if (b.p05 == null) { for (var q = 0; q < 9; q++) h("td", "", r, "–"); h("td", "", r, String(b.n)); return; }
      [b.p05, b.p25, b.p50, b.p75, b.p95, b.s2lo, b.s1lo, b.s1hi, b.s2hi].forEach(function (m) { h("td", "", r, fmt(level * m, inst.dp)); });
      h("td", "", r, b.n.toLocaleString("en-US"));
    });
  }

  /* --- all six on one strip -------------------------------------------------- */
  function strip(host, title, get, domain, tickText, fmtv) {
    var box = h("div", "agg", host); h("p", "t", box, title);
    var SW = 1000, SH = 112, SL = 40, SR = 40, PWs = SW - SL - SR, mid = 58;
    var svg = el("svg", { viewBox: "0 0 " + SW + " " + SH, role: "img", "aria-label": title }, box);
    function x(v) { return SL + ((Math.max(domain[0], Math.min(domain[1], v)) - domain[0]) / (domain[1] - domain[0])) * PWs; }
    el("line", { x1: SL, x2: SL + PWs, y1: mid, y2: mid, class: "grid" }, svg);
    tickText.forEach(function (t) { el("line", { x1: x(t[0]), x2: x(t[0]), y1: mid - 8, y2: mid + 8, class: "grid" }, svg); el("text", { x: x(t[0]), y: SH - 6, "text-anchor": "middle", class: "ax" }, svg, t[1]); });
    /* labels take the first of four rows (above, below, higher, lower) that has room, so clustered dots never overprint */
    var rows = [[], [], [], []], rowY = [mid - 16, mid + 24, mid - 30, mid + 38];
    var items = DATA.instruments.map(function (inst) { var v = get(inst); return v == null ? null : { inst: inst, v: v, cx: x(v) }; })
      .filter(Boolean).sort(function (a, b) { return a.cx - b.cx; });
    items.forEach(function (it) {
      var text = it.inst.sym + " " + fmtv(it.v), w = text.length * 6.6 + 8, x0 = it.cx - w / 2, x1 = it.cx + w / 2, r = 3;
      for (var k = 0; k < 4; k++) { if (rows[k].every(function (o) { return x0 > o.x1 + 6 || x1 < o.x0 - 6; })) { r = k; break; } }
      rows[r].push({ x0: x0, x1: x1 });
      el("circle", { cx: it.cx, cy: mid, r: 5, fill: "var(--ink)", stroke: "var(--panel)", "stroke-width": 2 }, svg);
      el("text", { x: it.cx, y: rowY[r], "text-anchor": "middle", class: "ax r" }, svg, text);
    });
  }

  /* --- page ---------------------------------------------------------------- */
  var aggHost = document.getElementById("aggregate"), panels = document.getElementById("panels");
  function renderAll() {
    while (aggHost.firstChild) aggHost.removeChild(aggHost.firstChild);
    while (panels.firstChild) panels.removeChild(panels.firstChild);
    strip(aggHost, "where today sits against each instrument's own trailing year · z-score of the close vs the last 250 sessions", function (i) { return win(i).today.z_1y; }, [-3.5, 3.5],
      [[-3, "−3σ"], [-2, "−2σ"], [-1, "−1σ"], [0, "0"], [1, "+1σ"], [2, "+2σ"], [3, "+3σ"]], function (v) { return signed(v, 1, "σ"); });
    strip(aggHost, "the last year's change, ranked against every one-year change in the instrument's own history (window above)", function (i) { return win(i).today.ret_1y_pct; }, [0, 100],
      [[0, "0"], [25, "25th"], [50, "median"], [75, "75th"], [100, "100th"]], function (v) { return ordinal(v); });
    DATA.instruments.forEach(function (inst) { panel(inst, panels); });
  }
  var buttons = document.querySelectorAll(".filters button[data-win]");
  Array.prototype.forEach.call(buttons, function (b) {
    b.addEventListener("click", function () {
      state.win = b.getAttribute("data-win");
      Array.prototype.forEach.call(buttons, function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
      renderAll();
    });
  });
  renderAll();
})();

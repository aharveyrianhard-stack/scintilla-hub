/* D1 · the dashboard mockup engine. One engine, two layouts (window.D1_LAYOUT = "A" or "B"):
   A · BESIDE — today's grid kept (board left 60 · company right 40). The company block moves out of the full-width bar
       and becomes the head of the right panel, next to the chart. The tape sits under the master tabs.
   B · STAGE — when a company is picked the board narrows to its five core columns and the company gets a stage
       (board 44 · stage 56) with the chart always on top and the tabs under it. The tape sits at the bottom.
   Both: one tape (scintillas · earnings · economic events) that hides itself, one timeframe row, readable tabs, the
   master tabs as one element, ROTATE instead of AUTO, and the Geiger column taking every spare pixel.
   URL: ?t=META selects a name · &view=expanded · &tab=GEIGER · &fs=1 (board full screen) · &cohort=AI_HARDWARE · &tapehide=0 */
(function () {
  "use strict";
  const L = window.D1_LAYOUT || "A";
  const Q = new URLSearchParams(location.search);
  const $ = (s, r) => (r || document).querySelector(s);
  const D = window.D1, esc = D.esc;
  const S = { cohort: Q.get("cohort") || "LIKED", rows: [], sel: Q.get("t") || null, tab: (Q.get("tab") || "CHART").toUpperCase(), expanded: Q.get("view") === "expanded",
    fs: Q.get("fs") === "1", tf: "1D", rot: null, rotMs: 10000, market: null, gall: null, det: {}, hb: {}, prof: {}, fund: {}, q: {}, tape: null, room: "DASHBOARD", l0: "MAP" };
  if (L === "B" && !Q.get("tab")) S.tab = "GEIGER";
  const MTABS = ["DASHBOARD", "ALLOCATION", "STATION", "NEWS", "SOCIAL", "SENTIMENT", "SCINTILLAS", "ALERTS", "SCREENER", "EVENTS", "ECONOMIC"];
  const COHORT_TABS = [["LIKED", "♥ LIKED"], ["AI_HARDWARE", "AI HW"], ["AI_SOFTWARE", "AI SW"], ["MEGACAP", "MEGACAP"], ["BLUE_CHIP", "BLUE CHIP"], ["GROWTH", "GROWTH"], ["CRYPTO", "CRYPTO"], ["INTL", "INTL"], ["MACRO", "MACRO"], ["INDEXES", "INDEXES"], ["THEMATIC", "THEMATIC"], ["METALS", "METALS"], ["UTILITIES", "UTILITIES"]];
  const TABS = ["CHART", "GEIGER", "FUNDAMENTALS", "STATS", "ESTIMATES", "FINANCIALS", "NEWS", "SOCIAL", "EVENTS", "READ"];
  const TF = [["1h", "1h"], ["4h", "4h"], ["1D", "1d"], ["3D", "3d"], ["1W", "1w"]];

  /* ── the shell ─────────────────────────────────────────────────────────────────────── */
  function shell() {
    const tape = '<div class="d1-tape" id="tape"><div class="d1-tape__lbl">TAPE <span id="tapeCounts"></span></div><div class="d1-tape__lane"><div class="d1-tape__track" id="tapeTrack"></div></div></div>';
    $("#app").innerHTML = '<div class="d1 d1-' + L + '" id="d1">' +
      '<header class="d1-head"><span id="navHere"></span><span class="d1-logo" aria-hidden="true"></span><span class="d1-wm">SCINTILLA</span>' +
        '<span class="d1-status" id="mkt">● …</span><span class="d1-icons" aria-hidden="true">🔔︎ ⛶ ⌕</span></header>' +
      '<nav class="d1-mtabs" id="mtabs">' + MTABS.map((m) => '<button class="d1-mtab' + (m === "DASHBOARD" ? " is-on" : "") + (m === "SCINTILLAS" ? " is-new" : "") + '" data-m="' + m + '">' + m + "</button>").join("") + "</nav>" +
      (L === "A" ? tape : "") +
      '<div class="d1-body" id="body"></div>' +
      (L === "B" ? tape : "") + "</div>";
    /* the page's BACK / CLOSE slot moves into the header, so the pair sits beside the logo and covers nothing */
    const slot = document.querySelector("body > [data-scnav-slot]"), here = $("#navHere"); if (slot && here) here.replaceWith(slot);
    $("#mtabs").addEventListener("click", (e) => { const b = e.target.closest("[data-m]"); if (!b) return; S.room = b.dataset.m; [...$("#mtabs").children].forEach((x) => x.classList.toggle("is-on", x === b)); render(); });
  }

  /* ── the board ─────────────────────────────────────────────────────────────────────── */
  const compact = () => L === "B" && S.sel && !S.fs;
  function colTemplate() {
    if (innerWidth <= 640) return "54px 70px 62px minmax(90px,1fr)";
    if (compact()) return "20px 56px 72px 62px minmax(180px,1fr)";
    return "20px 56px 72px 62px 44px 54px 54px 28px 32px minmax(160px,1fr) 10px";
  }
  function hdrHTML() {
    const ph = innerWidth <= 640, c = compact();
    const cells = ph ? ["TICKER", "LAST", "CHG<span class=sub>USUAL</span>", "GEIGER"]
      : c ? ["", "TICKER", "LAST", "CHG<span class=sub>USUAL</span>", "GEIGER · T / M · READ · BY TIMEFRAME"]
      : ["", "TICKER", "LAST", "CHG<span class=sub>USUAL</span>", "F P/E", "MKT CAP", "REVENUE", "RSI", "RVOL", "GEIGER · T / M · READ · BY TIMEFRAME", ""];
    const gi = ph ? 3 : c ? 4 : 9;
    return '<div class="d1-row hdr" style="grid-template-columns:' + colTemplate() + '">' + cells.map((x, i) => '<span class="' + ((ph ? i >= 1 : i >= 2) && i < gi ? "r" : "") + '" data-col="' + i + '">' + x + "</span>").join("") + "</div>";
  }
  function gcellHTML(t) {
    const g = S.gall && S.gall.by[t], d = S.det[t];
    if (!g) return '<div class="gcell"><span class="dim">no Geiger for this name</span></div>';
    return '<div class="gcell">' + D.sbar(g.g) + '<span class="v num ' + D.dirCls(g.g) + '">' + D.signed(g.g) + "</span>" +
      '<span class="tm num">T ' + D.signed(g.tr) + " · M " + D.signed(g.mo) + "</span>" +
      '<span class="rd">' + esc(D.read(g.tr, g.mo)) + "</span>" + D.rungCells(d && d.rungs) + "</div>";
  }
  function rowHTML(r) {
    const t = r.t, q = S.q[t] || {}, hb = S.hb[t], pf = S.prof[t] || {}, f = S.fund[t] || {};
    const chg = q.chg, usual = hb && hb.usual_day_60;
    const pe = f.ntm_eps > 0 && q.price ? q.price / f.ntm_eps : null, fpe = pe == null ? "—" : (pe >= 100 ? Math.round(pe) : pe.toFixed(1)) + "×";
    const rsi = S.det[t] && (S.det[t].rungs.find((x) => x.k === "1d") || {}).rsi;
    const chgCell = '<span class="r two"><span class="num ' + D.dirCls(chg) + '">' + D.pct(chg) + '</span><span class="sub num">±' + (usual != null ? usual.toFixed(1) + "%" : "—") + "</span></span>";
    const px = q.price != null ? D.price(q.price) : '<span class="dim" title="' + esc(q.state || "") + '">—</span>';
    const ph = innerWidth <= 640, c = compact();
    const cells = ph ? ['<span class="tk">' + esc(t) + "</span>", '<span class="r num">' + px + "</span>", chgCell, gcellHTML(t)]
      : c ? ['<span class="d1-stars">♥</span>', '<span class="tk">' + esc(t) + "</span>", '<span class="r num">' + px + "</span>", chgCell, gcellHTML(t)]
      : ['<span class="d1-stars">♥</span>', '<span class="tk">' + esc(t) + "</span>", '<span class="r num">' + px + "</span>", chgCell,
        '<span class="r num">' + fpe + "</span>", '<span class="r num">' + D.cap(pf.market_cap) + "</span>", '<span class="r num">' + D.cap(f.revenue_ttm) + "</span>",
        '<span class="r num dim">' + (rsi != null ? Math.round(rsi) : "—") + "</span>", '<span class="r dim">—</span>', gcellHTML(t),
        '<span><i class="d1-mkt' + (S.market && S.market.equity_open ? " is-open" : "") + '"></i></span>'];
    return '<div class="d1-row' + (S.sel === t ? " is-sel" : "") + '" data-t="' + esc(t) + '" style="grid-template-columns:' + colTemplate() + '">' + cells.join("") + "</div>";
  }
  function cohortMean() {
    const v = S.rows.map((r) => S.gall && S.gall.by[r.t] && S.gall.by[r.t].g).filter((x) => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  }
  function boardHTML() {
    const m = cohortMean();
    return '<section class="d1-panel d1-board" id="board">' +
      '<div class="d1-bar"><div class="d1-tabs" id="cohtabs">' + COHORT_TABS.map(([k, l]) => '<button class="d1-tab' + (S.cohort === k ? " is-on" : "") + '" data-c="' + k + '">' + l + "</button>").join("") + "</div>" +
        '<span class="d1-sp"></span><button class="d1-btn' + (S.rot ? " is-on" : "") + '" id="rotBtn" title="ROTATE steps the company panel through these rows, one every ' + S.rotMs / 1000 + ' s. This is what AUTO and 10s did.">' + (S.rot ? "■ ROTATING" : "▶ ROTATE") + " · " + S.rotMs / 1000 + "s</button>" +
        '<button class="d1-btn" id="fsBtn" title="board full screen: the Geiger column takes the extra width">' + (S.fs ? "✕ EXIT" : "⛶") + "</button></div>" +
      '<div class="d1-cg"><span class="lab">COHORT GEIGER · ' + esc(S.cohort.replace(/_/g, " ")) + '</span><span style="flex:1;max-width:420px">' + D.sbar(m, "big") + '</span><b class="num ' + D.dirCls(m) + '">' + D.signed(m) + '</b><span class="dim" style="font-size:var(--t-label)">' + S.rows.length + " names</span></div>" +
      '<div class="d1-rows" id="rows">' + hdrHTML() + S.rows.map(rowHTML).join("") + "</div></section>";
  }
  /* the Geiger cell shows more as it gets wider: bar + value, then T/M, then READ, then the eight timeframes */
  function sizeGeiger() {
    const h = $('#rows .hdr [data-col="' + (innerWidth <= 640 ? 3 : compact() ? 4 : 9) + '"]'); if (!h) return;
    const w = h.getBoundingClientRect().width;
    const cols = w >= 480 ? "minmax(120px,1.4fr) 46px 132px 96px minmax(110px,1fr)" : w >= 360 ? "minmax(80px,1fr) 46px 132px 92px" : w >= 250 ? "minmax(56px,1fr) 46px 132px" : "minmax(40px,1fr) 44px";
    document.documentElement.style.setProperty("--gcols", cols);
    document.querySelectorAll(".gcell").forEach((g) => { g.style.gridTemplateColumns = cols; });
    const n = cols.split(" ").length;
    document.querySelectorAll(".gcell").forEach((g) => { [...g.children].forEach((c, i) => { c.style.display = i < n ? "" : "none"; }); });
    const b = $("#board"); if (b) b.dataset.gw = Math.round(w);
  }

  /* ── the right side: Layer 0 when nothing is picked, the company when something is ─── */
  function layer0HTML() {
    const tiles = S.rows.slice(0, 48).map((r) => { const q = S.q[r.t] || {}, c = q.chg;
      const a = c == null ? 0.08 : Math.min(1, Math.abs(c) / 5) * 0.75 + 0.15;
      return '<div data-t="' + esc(r.t) + '" style="cursor:pointer;padding:8px 6px;text-align:center;background:' + (c == null ? "var(--panel2)" : (c >= 0 ? "rgba(0,255,163," : "rgba(255,45,85,") + a.toFixed(2) + ")") + '"><b style="color:var(--bg);background:rgba(10,10,15,.75);padding:1px 4px;color:var(--ink)">' + esc(r.t) + '</b><div class="num" style="font-size:var(--t-label);margin-top:3px;color:var(--ink)">' + D.pct(c) + "</div></div>"; }).join("");
    return '<section class="d1-panel d1-side" id="side"><div class="d1-bar"><div class="d1-tabs">' + ["COHORT COMPARE", "MAP", "ROTATION", "RELATIVE"].map((k) => '<button class="d1-tab' + (S.l0 === k ? " is-on" : "") + '" data-l0="' + k + '">' + k + "</button>").join("") + "</div></div>" +
      (S.l0 === "MAP" ? '<div class="d1-pane" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:4px;align-content:start">' + tiles + "</div>"
        : '<div class="d1-note">' + S.l0 + " stays as it is today. Only its place and its tab style change in this proposal.</div>") +
      '<div class="d1-src">nothing picked · pick a row, or a tile, and the company takes this panel</div></section>';
  }
  function coLineHTML(t) {
    const q = S.q[t] || {}, pf = S.prof[t] || {}, hb = S.hb[t];
    const tfSeg = '<span class="d1-seg" id="tfSeg">' + TF.map(([l]) => '<button class="' + (S.tf === l ? "is-on" : "") + '" data-tf="' + l + '">' + l + "</button>").join("") + "</span>";
    return '<div class="d1-co"><span class="tk">' + esc(t) + '</span><span class="px num ' + D.dirCls(q.chg) + '">' + (q.price != null ? "$" + D.price(q.price) : "—") + '</span><span class="num ' + D.dirCls(q.chg) + '">' + D.pct(q.chg) + "</span>" +
      '<span class="nm">' + esc(pf.name || "") + (pf.exchange ? " · " + esc(pf.exchange) : "") + "</span>" +
      '<span class="d1-stars" title="liked · favourite · radar">♥ ☆ ◎</span><span class="d1-sp"></span>' +
      ((L === "B" || S.expanded) ? tfSeg : "") +
      '<button class="d1-ico" id="unpin" title="back to the cohort view (the name is let go)">◂</button><button class="d1-ico" id="expBtn" title="' + (S.expanded ? "collapse: give the board its room back" : "expand: the company takes the whole width, chart and tabs side by side") + '">' + (S.expanded ? "⤡" : "⤢") + "</button></div>";
  }
  function tabsHTML(list) {
    return '<div class="d1-bar" style="padding:0 6px"><div class="d1-tabs" id="cotabs">' + list.map((k) => '<button class="d1-tab' + (S.tab === k ? " is-on" : "") + '" data-tab="' + k + '">' + k + "</button>").join("") + "</div>" +
 "</div>";
  }
  function companyHTML() {
    const t = S.sel, chart = '<div class="d1-chart" id="chartBox">' + (L === "A" && !S.expanded ? '<span class="d1-seg" id="tfSeg">' + TF.map(([l]) => '<button class="' + (S.tf === l ? "is-on" : "") + '" data-tf="' + l + '">' + l + "</button>").join("") + "</span>" : "") + '<div id="chart" style="position:absolute;inset:0"><div class="d1-note">reading ' + esc(t) + " " + S.tf + " candles…</div></div></div>";
    const paneTabs = TABS.filter((k) => k !== "CHART");
    if (S.expanded) {           // chart always, the tabs beside it
      if (S.tab === "CHART") S.tab = "GEIGER";
      return '<section class="d1-panel d1-side is-exp" id="side">' + coLineHTML(t) +
        '<div class="d1-view" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)"><div style="display:flex;flex-direction:column;min-height:0"><div style="flex:1;position:relative;display:flex;min-height:0">' + chart.replace('class="d1-chart"', 'class="d1-chart" style="flex:1"') + "</div>" + glanceHTML(t) + "</div>" +
        '<div style="display:flex;flex-direction:column;min-height:0;border-left:1px solid var(--line)">' + tabsHTML(paneTabs) + '<div class="d1-pane" id="pane"></div></div></div>' + srcHTML() + "</section>";
    }
    if (L === "B") {            // chart always on top, the tabs under it
      if (S.tab === "CHART") S.tab = "GEIGER";
      return '<section class="d1-panel d1-side" id="side">' + coLineHTML(t) +
        '<div class="d1-view" style="grid-template-rows:minmax(0,1.1fr) auto minmax(0,1fr)">' + chart + tabsHTML(paneTabs.slice(0, 5).concat(["MORE ▾"])) + '<div class="d1-pane" id="pane"></div></div>' + srcHTML() + "</section>";
    }
    return '<section class="d1-panel d1-side" id="side">' + coLineHTML(t) + tabsHTML(["CHART", "GEIGER", "FUNDAMENTALS", "STATS", "ESTIMATES", "MORE ▾"]) +
      '<div class="d1-view">' + (S.tab === "CHART" ? chart : '<div class="d1-pane" id="pane"></div>') + "</div>" + srcHTML() + "</section>";
  }
  /* the expanded view's extra room: the numbers you want next to the chart, always on screen whatever tab is open */
  function glanceHTML(t) {
    const q = S.q[t] || {}, pf = S.prof[t] || {}, f = S.fund[t] || {}, hb = S.hb[t], g = S.gall && S.gall.by[t];
    const pe = f.ntm_eps > 0 && q.price ? (q.price / f.ntm_eps).toFixed(1) + "×" : "—";
    const x = q.chg != null && hb && hb.usual_day_60 ? (Math.abs(q.chg) / hb.usual_day_60).toFixed(1) + "×" : "—";
    const tile = (k, v, s, id) => '<div' + (id ? ' id="' + id + '"' : "") + '><div class="k">' + k + '</div><div class="v num">' + v + '</div><div class="s">' + s + "</div></div>";
    setTimeout(async () => { const [tg, ne] = await Promise.all([D.targets(t), D.nextEarnings(t)]); if (S.sel !== t) return;
      const a = $("#glNext"), b = $("#glTgt");
      if (a) a.outerHTML = tile("NEXT REPORT", ne ? ne.date.slice(5) + " " + (ne.report_time || "") : "—", ne ? D.ago(Date.parse(ne.date + "T12:00:00Z")) : "none stored", "glNext");
      if (b) b.outerHTML = tile("TARGET MEDIAN", tg ? "$" + D.price(tg.target_median) : "—", tg && q.price ? D.pct((tg.target_median / q.price - 1) * 100, 1) + " from here" : "no consensus", "glTgt"); }, 0);
    return '<div class="kv" style="padding:10px 12px;border-top:1px solid var(--line);grid-template-columns:repeat(6,minmax(0,1fr))">' +
      tile("GEIGER", '<span class="' + D.dirCls(g && g.g) + '">' + D.signed(g && g.g) + "</span>", g ? esc(D.read(g.tr, g.mo)) : "") +
      tile("TODAY", '<span class="' + D.dirCls(q.chg) + '">' + D.pct(q.chg) + "</span>", x + " its usual day") +
      tile("MKT CAP", D.cap(pf.market_cap), "company profile") + tile("P/E FORWARD", pe, "next 12 months") +
      tile("NEXT REPORT", "…", "", "glNext") + tile("TARGET MEDIAN", "…", "", "glTgt") + "</div>";
  }
  function srcHTML() { return '<div class="d1-src" id="src">chart API · Supabase · read only</div>'; }

  /* ── the chart: the name's candles, one line, green on an up day and red on a down day ─ */
  async function drawChart() {
    const box = $("#chart"); if (!box || !S.sel) return; const t = S.sel, tf = (TF.find((x) => x[0] === S.tf) || TF[2])[1];
    let c; try { c = await D.candles(t, tf, 240); } catch (e) { box.innerHTML = '<div class="d1-note">no candles: ' + esc(e.message) + "</div>"; return; }
    if (S.sel !== t || !$("#chart")) return;
    const bars = c.bars; if (bars.length < 2) { box.innerHTML = '<div class="d1-note">no candles for ' + esc(t) + " on " + S.tf + "</div>"; return; }
    const W = Math.max(200, box.clientWidth), H = Math.max(140, box.clientHeight), lo = Math.min(...bars.map((b) => b.l)), hi = Math.max(...bars.map((b) => b.h)), sp = hi - lo || 1;
    const x = (i) => (i / (bars.length - 1)) * (W - 60), y = (v) => 40 + (1 - (v - lo) / sp) * (H - 68);
    const q = S.q[t] || {}; const up = q.chg != null ? q.chg >= 0 : bars[bars.length - 1].c >= bars[bars.length - 2].c;
    const pts = bars.map((b, i) => x(i).toFixed(1) + "," + y(b.c).toFixed(1)).join(" ");
    const ticks = [hi, (hi + lo) / 2, lo].map((v) => '<text x="' + (W - 54) + '" y="' + (y(v) + 4) + '" fill="var(--dim)" font-size="11">' + D.price(v) + "</text>").join("");
    const dates = [0, 0.33, 0.66, 1].map((f) => { const i = Math.round(f * (bars.length - 1)); const d = new Date(bars[i].t);
      return '<text x="' + Math.min(W - 110, x(i)) + '" y="' + (H - 6) + '" fill="var(--dim)" font-size="11">' + d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: tf === "1d" || tf === "3d" || tf === "1w" ? "2-digit" : undefined, timeZone: "America/New_York" }) + "</text>"; }).join("");
    box.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(t) + " " + S.tf + ' chart">' +
      [0.25, 0.5, 0.75].map((f) => '<line x1="0" x2="' + (W - 60) + '" y1="' + (12 + f * (H - 40)) + '" y2="' + (12 + f * (H - 40)) + '" stroke="var(--line)" stroke-width="1" vector-effect="non-scaling-stroke"/>').join("") +
      '<polyline fill="none" stroke="' + (up ? "var(--bull)" : "var(--bear)") + '" stroke-width="1.6" vector-effect="non-scaling-stroke" points="' + pts + '"/>' + ticks + dates + "</svg>";
    const s = $("#src"); if (s) s.textContent = "chart · " + bars.length + " " + (c.display || S.tf) + " bars from the chart API /candles, newest " + (c.newest || "").slice(0, 16).replace("T", " ") + "Z · the build uses the Station chart pane (bare), not this line";
  }

  /* ── the tab panes ─────────────────────────────────────────────────────────────────── */
  async function drawPane() {
    const p = $("#pane"); if (!p || !S.sel) return; const t = S.sel, tab = S.tab;
    if (tab === "GEIGER") return geigerPane(p, t);
    if (tab === "FUNDAMENTALS") return fundPane(p, t);
    if (tab === "STATS") return statsPane(p, t);
    if (tab === "ESTIMATES") return estPane(p, t);
    p.innerHTML = '<div class="d1-note">' + esc(tab.replace(" ▾", "")) + ": the content is not redesigned here. In the build it keeps what it shows today and takes the same six sizes and four greys.</div>";
  }
  async function geigerPane(p, t) {
    let d = S.det[t]; if (!d) { p.innerHTML = '<div class="d1-note">reading the Geiger for ' + esc(t) + "…</div>"; const m = await D.geigerDetail([t]); d = S.det[t] = m[t]; }
    if (S.sel !== t || !$("#pane")) return;
    if (!d) { p.innerHTML = '<div class="d1-note">the chart API has no Geiger for ' + esc(t) + "</div>"; return; }
    const lean = d.g >= 0.5 ? "bull" : d.g >= 0.15 ? "bull lean" : d.g <= -0.5 ? "bear" : d.g <= -0.15 ? "bear lean" : "neutral";
    const wmax = Math.max(...d.rungs.map((r) => r.w || 0), 1);
    p.innerHTML = '<div class="gz">' +
      '<div class="gz-top"><div class="gz-comp"><div class="lab">GEIGER COMPOSITE</div>' + D.sbar(d.g, "big") +
        '<div style="display:flex;align-items:baseline;gap:12px;margin-top:6px"><span class="val num ' + D.dirCls(d.g) + '">' + D.signed(d.g) + '</span><span class="lean">' + lean + '</span></div>' +
        '<div class="dim" style="font-size:var(--t-label)">' + esc(D.read(d.tr, d.mo)) + " · " + d.rungs.length + " timeframes</div></div>" +
      '<div class="gz-fam"><span class="lab">TREND</span>' + D.sbar(d.tr) + '<b class="num r ' + D.dirCls(d.tr) + '">' + D.signed(d.tr) + '</b><span class="lab">MOMENTUM</span>' + D.sbar(d.mo) + '<b class="num r ' + D.dirCls(d.mo) + '">' + D.signed(d.mo) + "</b></div></div>" +
      '<div><div class="lab" style="margin-bottom:8px">BY TIMEFRAME · short to long · the bar under each label is its weight in the composite</div><div class="gz-lad">' +
        '<span class="h">TF</span><span class="h xw">WEIGHT</span><span class="h">TREND</span><span class="h">MOMENTUM</span><span class="h r">TF</span><span class="h r xr">RSI</span><span class="h r xr">W%R</span>' +
        d.rungs.map((r) => '<b>' + r.lbl + '</b><span class="xw"><div class="gz-w" style="width:' + ((r.w || 0) / wmax * 100).toFixed(0) + '%"></div></span>' + D.sbar(r.tr) + D.sbar(r.mo) +
          '<span class="num r ' + D.dirCls(r.tfc) + '">' + D.signed(r.tfc) + '</span><span class="num r dim xr">' + (r.rsi != null ? Math.round(r.rsi) : "—") + '</span><span class="num r dim xr">' + (r.wr != null ? Math.round(r.wr) : "—") + "</span>").join("") +
      "</div></div></div>";
    const s = $("#src"); if (s) s.textContent = "Geiger · chart API /geiger?detail=1 · computed " + (d.at || "").slice(0, 16).replace("T", " ") + "Z · equalizer " + (d.receipt || "").slice(0, 8) + " · families: trend + momentum (" + (d.absent || []).join(", ") + ")";
  }
  async function fundPane(p, t) {
    p.innerHTML = '<div class="d1-note">reading stored fundamentals for ' + esc(t) + "…</div>";
    const [qs, f] = await Promise.all([D.quarters(t), S.fund[t] ? Promise.resolve(S.fund) : D.fundamentals([t])]);
    if (S.sel !== t || !$("#pane")) return;
    const fu = f[t] || {}, pf = S.prof[t] || {}, q = S.q[t] || {}, r = qs.ratio || {};
    const fpe = fu.ntm_eps > 0 && q.price ? (q.price / fu.ntm_eps).toFixed(1) + "×" : "—";
    const tile = (k, v, s) => '<div><div class="k">' + k + '</div><div class="v num">' + v + '</div><div class="s">' + s + "</div></div>";
    const pd = (ts) => (ts ? new Date(ts * 1000).toISOString().slice(0, 10) : "no date");
    const bars = qs.q.filter((x) => x.revenue != null); const mx = Math.max(...bars.map((x) => x.revenue), 1);
    const bw = 100 / Math.max(bars.length, 1);
    const svg = bars.length ? '<svg viewBox="0 0 100 44" preserveAspectRatio="none" style="width:100%;height:140px;display:block">' + bars.map((x, i) => { const h = x.revenue / mx * 36, up = i === 0 || x.revenue >= bars[i - 1].revenue;
      return '<rect x="' + (i * bw + bw * 0.18).toFixed(2) + '" y="' + (40 - h).toFixed(2) + '" width="' + (bw * 0.64).toFixed(2) + '" height="' + h.toFixed(2) + '" fill="' + (up ? "var(--bull)" : "var(--bear)") + '" opacity=".75"/>'; }).join("") + "</svg>" +
      '<div style="display:grid;grid-template-columns:repeat(' + bars.length + ',1fr);font-size:var(--t-micro);color:var(--dim);text-align:center">' + bars.map((x) => "<span>" + x.fiscal_date.slice(2, 7) + "<br>" + D.cap(x.revenue).replace("$", "") + "</span>").join("") + "</div>" : '<div class="d1-note">no stored quarters</div>';
    p.innerHTML = '<div class="kv">' + tile("MKT CAP", D.cap(pf.market_cap), "company_profile · " + pd(pf.updated_ts)) + tile("P/E TRAILING", fu.trailing_pe ? fu.trailing_pe.toFixed(1) + "×" : "—", "fundamentals · " + pd(fu.updated_ts)) +
      tile("P/E FORWARD", fpe, "price ÷ next-12-month EPS") + tile("REVENUE TTM", D.cap(fu.revenue_ttm), "fundamentals · " + pd(fu.updated_ts)) +
      tile("GROSS MARGIN", r.gross_margin != null ? (r.gross_margin * 100).toFixed(1) + "%" : "—", "ratios_history · " + (r.fiscal_date || "—")) + tile("NET MARGIN", r.net_margin != null ? (r.net_margin * 100).toFixed(1) + "%" : "—", "ratios_history · " + (r.fiscal_date || "—")) + "</div>" +
      '<div class="lab" style="margin:14px 0 6px">REVENUE BY QUARTER · green when it beat the quarter before</div>' + svg;
    const s = $("#src"); if (s) s.textContent = "fundamentals · stored FMP rows (fundamentals, fundamentals_history, ratios_history, company_profile) · the tiles use one size for every value and one for every note";
  }
  async function statsPane(p, t) {
    const hb = S.hb[t], q = S.q[t] || {};
    if (!hb) { p.innerHTML = '<div class="d1-note">no stored usual-day row for ' + esc(t) + "</div>"; return; }
    const x = q.chg != null && hb.usual_day_60 ? Math.abs(q.chg) / hb.usual_day_60 : null;
    const tile = (k, v, s) => '<div><div class="k">' + k + '</div><div class="v num">' + v + '</div><div class="s">' + s + "</div></div>";
    p.innerHTML = '<div class="kv">' + tile("TODAY'S MOVE", '<span class="' + D.dirCls(q.chg) + '">' + D.pct(q.chg) + "</span>", x != null ? x.toFixed(1) + "× its usual day" : "") +
      tile("USUAL DAY · 20", "±" + hb.usual_day_20.toFixed(1) + "%", "a month of sessions") + tile("USUAL DAY · 60", "±" + hb.usual_day_60.toFixed(1) + "%", "the season — the board's number") +
      tile("USUAL DAY · 250", "±" + hb.usual_day_250.toFixed(1) + "%", "a year") + tile("ATR 14", hb.atr_pct_14 != null ? hb.atr_pct_14.toFixed(1) + "%" : "—", "average true range, % of price") + "</div>" +
      '<div class="d1-note" style="padding-left:0">This is where USUAL DAY lives in full once the board folds it under CHG.</div>';
    const s = $("#src"); if (s) s.textContent = "stats · ticker_heartbeat_daily " + hb.date + " · " + hb.n + " sessions";
  }
  async function estPane(p, t) {
    p.innerHTML = '<div class="d1-note">reading targets and the next report…</div>';
    const [tg, ne] = await Promise.all([D.targets(t), D.nextEarnings(t)]); if (S.sel !== t || !$("#pane")) return;
    const q = S.q[t] || {}, tile = (k, v, s) => '<div><div class="k">' + k + '</div><div class="v num">' + v + '</div><div class="s">' + s + "</div></div>";
    let range = "";
    if (tg && tg.target_low && tg.target_high && q.price) { const lo = Math.min(tg.target_low, q.price), hi = Math.max(tg.target_high, q.price), f = (v) => ((v - lo) / (hi - lo) * 100).toFixed(1);
      range = '<div class="lab" style="margin:14px 0 6px">ANALYST TARGETS · low · median · high, and today\'s price</div><div style="position:relative;height:26px;border-bottom:1px solid var(--line2)">' +
        '<i style="position:absolute;left:' + f(tg.target_low) + "%;right:" + (100 - f(tg.target_high)) + '%;top:10px;height:6px;background:var(--line2)"></i>' +
        '<i style="position:absolute;left:' + f(tg.target_median) + '%;top:6px;width:2px;height:14px;background:var(--ink2)"></i><i style="position:absolute;left:' + f(q.price) + '%;top:2px;width:2px;height:22px;background:' + (q.chg >= 0 ? "var(--bull)" : "var(--bear)") + '"></i></div>'; }
    p.innerHTML = '<div class="kv">' + tile("TARGET MEDIAN", tg ? "$" + D.price(tg.target_median) : "—", tg ? "low $" + D.price(tg.target_low) + " · high $" + D.price(tg.target_high) : "no stored consensus") +
      tile("VS PRICE", tg && q.price ? D.pct((tg.target_median / q.price - 1) * 100, 1) : "—", "median target against the last price") +
      tile("NEXT REPORT", ne ? ne.date : "—", ne ? (ne.report_time || "time not set") + " · " + D.ago(Date.parse(ne.date + "T12:00:00Z")) : "none stored") +
      tile("EPS ESTIMATE", ne && ne.eps_estimate != null ? D.price(ne.eps_estimate) : "—", ne && ne.revenue_estimate ? "revenue " + D.cap(ne.revenue_estimate) : "") + "</div>" + range;
    const s = $("#src"); if (s) s.textContent = "estimates · price_target_consensus and earnings_events, stored rows";
  }

  /* ── THE TAPE ──────────────────────────────────────────────────────────────────────── */
  function tapeItemHTML(i) {
    const mine = S.sel && i.ticker === S.sel ? " is-mine" : "";
    if (i.type === "scint") {
      const d = i.detail || {}, lbl = i.kind === "price_outlier" ? (d.move_pct != null ? D.pct(d.move_pct * (i.dir < 0 && d.move_pct > 0 ? -1 : 1), 1) + " · " + (d.x_usual != null ? d.x_usual.toFixed(1) + "× usual" : "") : "outlier")
        : i.kind === "econ_imminent" ? "about to print" : i.kind === "earnings_surprise" ? "earnings surprise" : i.kind.replace(/_/g, " ");
      return '<span class="d1-ti' + mine + '"><span class="g ' + (i.dir > 0 ? "up" : i.dir < 0 ? "dn" : "flat") + '">◆</span><b>' + esc(i.ticker || i.subject) + "</b>" + esc(lbl) + "<i>" + esc(D.dayName(i.at)) + " " + D.hhmm(i.at) + "</i></span>";
    }
    if (i.type === "earn") return '<span class="d1-ti' + mine + '"><span class="g">▲</span><b>' + esc(i.ticker) + "</b>reports " + esc(D.dayName(i.at)) + " " + esc(i.date.slice(5)) + " " + esc(i.when || "") + "<i>" + D.ago(i.at) + "</i></span>";
    return '<span class="d1-ti"><span class="g" style="opacity:' + (i.impact === "High" ? 1 : 0.6) + '">●</span>' + esc(D.dayName(i.at)) + " " + D.hhmm(i.at) + " <b>" + esc(i.subject) + "</b><i>" + D.ago(i.at) + "</i></span>";
  }
  function paintTape() {
    const tr = $("#tapeTrack"); if (!tr || !S.tape) return;
    const html = S.tape.items.map(tapeItemHTML).join('<span class="d1-tape__sep">·</span>') || '<span class="d1-ti">nothing on the tape</span>';
    tr.innerHTML = html + '<span class="d1-tape__sep">·</span>' + html;       // twice, for a seamless loop
    $("#tapeCounts").textContent = "◆" + S.tape.counts.scint + " ▲" + S.tape.counts.earn + " ●" + S.tape.counts.econ;
    requestAnimationFrame(() => { const w = tr.scrollWidth / 2; tr.style.setProperty("--tape-s", Math.max(30, w / 45).toFixed(0) + "s"); });
  }
  /* auto-hide: after 12 s with no pointer near it the tape folds to a 4 px line; the pointer near it, or a new item, brings it back */
  let tapeSeen = Date.now(), tapeN = 0;
  function tapeWatch() {
    if (Q.get("tapehide") === "0") return;
    const tape = $("#tape"); if (!tape) return;
    addEventListener("pointermove", (e) => { const r = tape.getBoundingClientRect(); if (e.clientY > r.top - 60 && e.clientY < r.bottom + 60) { tapeSeen = Date.now(); tape.classList.remove("is-hidden"); } }, { passive: true });
    setInterval(() => { if (Date.now() - tapeSeen > 12000) tape.classList.add("is-hidden"); }, 2000);
  }

  /* ── the SCINTILLAS room (the new master tab: the outliers of the day get a home) ─── */
  function scintRoomHTML() {
    const s = (S.tape ? S.tape.items : []).filter((i) => i.type === "scint");
    return '<section class="d1-panel"><div class="d1-bar"><span class="lab">SCINTILLAS · the last sessions · outliers of the day, surprises, releases about to print</span></div><div class="d1-rows">' +
      '<div class="d1-row hdr" style="grid-template-columns:120px 90px 150px 1fr 90px"><span>WHEN</span><span>NAME</span><span>KIND</span><span>WHY</span><span class="r">SIZE</span></div>' +
      s.map((i) => '<div class="d1-row" data-t="' + esc(i.ticker || "") + '" style="grid-template-columns:120px 90px 150px 1fr 90px"><span class="dim">' + D.dayName(i.at) + " " + D.hhmm(i.at) + '</span><span class="tk">' + esc(i.ticker || "—") + "</span><span>" + esc(i.kind.replace(/_/g, " ")) + '</span><span class="dim">' + esc((i.detail && i.detail.rule) || i.subject) + '</span><span class="r num ' + (i.dir > 0 ? "up" : i.dir < 0 ? "dn" : "") + '">' + (i.mag != null ? i.mag.toFixed(2) : "—") + "</span></div>").join("") +
      '</div><div class="d1-src">scintillas table · newest first · the Hub today shows these one at a time in the TODAY\'S SCINTILLAS strip</div></section>';
  }

  /* ── layout ────────────────────────────────────────────────────────────────────────── */
  function gridCols() {
    if (innerWidth <= 640) return "1fr";
    if (S.fs || (S.expanded && S.sel)) return "1fr";
    if (L === "B" && S.sel) return "minmax(0,44fr) minmax(0,56fr)";
    return "minmax(0,60fr) minmax(0,40fr)";
  }
  function render() {
    const body = $("#body"); const ph = innerWidth <= 640;
    if (S.room === "SCINTILLAS") { body.style.gridTemplateColumns = "1fr"; body.innerHTML = scintRoomHTML(); return; }
    if (S.room !== "DASHBOARD") { body.style.gridTemplateColumns = "1fr"; body.innerHTML = '<section class="d1-panel"><div class="d1-note">' + esc(S.room) + " is not part of this mockup. Only the tab row itself is: every tab is the same element, centred, with no underline.</div></section>"; return; }
    body.style.gridTemplateColumns = gridCols();
    const side = S.fs ? "" : S.sel ? companyHTML() : (ph ? "" : layer0HTML());
    body.innerHTML = (S.expanded && S.sel && !ph ? "" : boardHTML()) + side;
    sizeGeiger(); drawChart(); drawPane();
  }
  /* a price tick repaints the rows and the company line only: the chart, the tab pane and the tape are left alone */
  function patchRows() {
    const rows = $("#rows"); if (!rows || S.room !== "DASHBOARD") return;
    const sc = rows.scrollTop; rows.innerHTML = hdrHTML() + S.rows.map(rowHTML).join(""); rows.scrollTop = sc; sizeGeiger();
    const co = $(".d1-co"); if (co && S.sel) co.outerHTML = coLineHTML(S.sel);
  }
  function select(t) {
    S.sel = t; if (S.rows.length) render(); paintTape();
    if (innerWidth <= 640) { const s = $("#side"); if (s) s.scrollIntoView({ block: "start" }); }
  }
  document.addEventListener("click", (e) => {
    const r = e.target.closest("[data-t]"); const c = e.target.closest("[data-c]"); const tb = e.target.closest("[data-tab]"); const tf = e.target.closest("[data-tf]"); const l0 = e.target.closest("[data-l0]");
    if (c) { S.cohort = c.dataset.c; S.sel = null; return loadBoard(); }
    if (tb) { if (tb.dataset.tab === "MORE ▾") { S.tab = "FINANCIALS"; } else S.tab = tb.dataset.tab; return render(); }
    if (tf) { S.tf = tf.dataset.tf; document.querySelectorAll("#tfSeg button").forEach((b) => b.classList.toggle("is-on", b === tf)); return drawChart(); }
    if (l0) { S.l0 = l0.dataset.l0; return render(); }
    if (e.target.closest("#unpin")) { S.sel = null; S.expanded = false; stopRot(); return render(); }
    if (e.target.closest("#expBtn")) { S.expanded = !S.expanded; return render(); }
    if (e.target.closest("#fsBtn")) { S.fs = !S.fs; return render(); }
    if (e.target.closest("#rotBtn")) { if (S.rot) stopRot(); else startRot(); return render(); }
    if (r && r.dataset.t && !r.classList.contains("hdr")) { if (S.room === "SCINTILLAS") { S.room = "DASHBOARD"; document.querySelectorAll(".d1-mtab").forEach((x) => x.classList.toggle("is-on", x.dataset.m === "DASHBOARD")); } stopRot(); return select(r.dataset.t); }
  });
  function startRot() { let i = Math.max(0, S.rows.findIndex((r) => r.t === S.sel)); S.rot = setInterval(() => { i = (i + 1) % S.rows.length; select(S.rows[i].t); }, S.rotMs); if (!S.sel && S.rows[0]) select(S.rows[0].t); }
  function stopRot() { if (S.rot) clearInterval(S.rot); S.rot = null; }
  let rs = null; addEventListener("resize", () => { clearTimeout(rs); rs = setTimeout(render, 150); });

  /* ── loading ───────────────────────────────────────────────────────────────────────── */
  async function loadBoard() {
    $("#body").innerHTML = '<section class="d1-panel"><div class="d1-note">reading ' + esc(S.cohort) + "…</div></section>";
    const names = S.cohort === "LIKED" ? await D.favorites() : ((await D.cohorts())[S.cohort] || []);
    const [q, g, hb, pf, fu] = await Promise.all([D.quotes(names), S.gall ? Promise.resolve(S.gall) : D.geigerAll(), D.usual(names), D.profiles(names), D.fundamentals(names)]);
    S.q = Object.assign(S.q, q); S.gall = g; Object.assign(S.hb, hb); Object.assign(S.prof, pf); Object.assign(S.fund, fu);
    S.rows = names.map((t) => ({ t })).sort((a, b) => ((g.by[b.t] || {}).g ?? -9) - ((g.by[a.t] || {}).g ?? -9));
    render();
    D.geigerDetail(names).then((d) => { Object.assign(S.det, d); patchRows(); if (S.sel && S.tab === "GEIGER") drawPane(); });
  }
  async function boot() {
    shell(); tapeWatch();
    D.marketState().then((m) => { S.market = m; const el = $("#mkt"); if (el) { const open = m && m.equity_open; el.textContent = "● " + (m ? (open ? "OPEN" : String(m.equity_session || "closed").toUpperCase()) : "—"); el.classList.toggle("is-open", !!open); } });
    D.tape({ days: 21 }).then((t) => { S.tape = t; paintTape(); }).catch(() => {});
    try { await loadBoard(); } catch (e) { $("#body").innerHTML = '<section class="d1-panel"><div class="d1-note">the live read failed: ' + esc(e.message) + "</div></section>"; }
    setInterval(async () => { if (document.hidden) return; try { S.q = Object.assign(S.q, await D.quotes(S.rows.map((r) => r.t))); patchRows(); } catch (_) {} }, 60000);
    setInterval(() => { if (!document.hidden) D.tape({ days: 21 }).then((t) => { const n = t.items.length; if (n !== tapeN) { tapeN = n; tapeSeen = Date.now(); $("#tape") && $("#tape").classList.remove("is-hidden"); } S.tape = t; paintTape(); }).catch(() => {}); }, 120000);
  }
  window.D1HUB = { S, render, select };
  boot();
})();

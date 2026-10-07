/* ==== HM3 · 7 OCT 2026 — THE MACRO CARDS IN THE SLIDER'S LOOK ==================
   Alan, 7 Oct ~16:10 ET, on HM2's pictures: "these visuals of the macro stuff … look a little bit antiquated and analog
   in a lot of ways. Boxy … the economic one [the slider] looks way better than the other ones. This treasury curve one
   seems a little analog and weird … I can't really see much of the information on there … macro prints — what would be
   the idea, expand upon click?" and: "Event card with the official link — just keep it simple. It's just about having
   access to the information. Don't go nuts."
   WHAT THIS LAYER DOES: it redraws four of HM2's cards and nothing else. Every read, every rule (which way is better,
   the six auctions before, which release the event card is about, where the official page is) and every number is
   HM2's own function, called from here; HM2's block asks this layer only for the HTML.
     hm3CurveHTML     one clean line chart — today, a month ago, a year ago — with today's yields printed on the line;
                      THEN VS NOW in three lines; 2s10s as one number with its year beside it.
     hm3AuctionsHTML  one line per term. Click a line: that term's history opens under it, each number as a row of bars.
     hm3PrintsHTML    one line per indicator (the newest print and its last twelve surprises). Click a line: every
                      stored print opens under it, as bars.
     hm3EventHTML     the official link and the three headlines.
   THE LOOK is the economic slider's: flat bars standing on the panel, a small label, the number beside it — no box
   inside a box. One row is open at a time in a card, so a card never grows past one history.
   HOW TO TURN IT OFF: HM3_ON = false draws HM2's four cards exactly as they were. */
var HM3_ON = true;                      /* var, not const: HM2's block reads it as `typeof HM3_ON !== "undefined" && HM3_ON`, so a page without this layer draws HM2's cards */
/* WHERE THE CURVE STANDS. As built (false) the curve, the auctions and the prints stand where HM2 put them: after the
   rail's two lists, so as the room opens the curve is one scroll of the rail down. true = the curve and the auctions
   come FIRST on the rail, right under the event card, and the room opens on them (the prints stay where they are).
   It is off because the order of the rail is Alan's call; both ways are pictured in HM3.html. */
var HM3_CURVE_FIRST = false;
let HM3 = { auc: null, print: null, have: null, by: null };
const HM3_THEN = [["1M AGO", 30, "#00D4FF", "5 3"], ["1Y AGO", 365, "#FF8A00", "2 3"]];   /* a hue and a dash each: no grey line */
const HM3_ON_LINE = { m3: 1, y2: 1, y5: 1, y10: 1, y30: 1 };                             /* the yields printed on today's line */
const HM3_X_LBL = { "1M": 1, "3M": 1, "1Y": 1, "2Y": 1, "5Y": 1, "10Y": 1, "30Y": 1 };
const HM3_TVN = [["3M", "m3"], ["2Y", "y2"], ["10Y", "y10"], ["30Y", "y30"]];
const HM3_PRINT_TAIL = 12, HM3_PRINT_RECENT = 4, HM3_AUC_N = 30;
/* each auction number in a few words, beside its bars only when a term is open (the whole sentence is its hover, and
   PAGE SPECS carries the rules) — Alan: "for me to learn a little bit more about them" */
const HM3_AUC_GLOSS = { high_yield: "the yield it took to sell it all", bid_to_cover: "bid per dollar sold · higher is more demand",
  indirect_pct: "foreign buyers and big funds · higher is stronger", direct_pct: "domestic funds bidding for themselves", dealer_pct: "what the banks were left holding · lower is stronger" };
const hm3My = (iso) => (iso ? HM2_MON[+iso.slice(5, 7) - 1].toUpperCase() + " " + iso.slice(0, 4) : "—");

/* A ROW OF FLAT BARS, oldest on the left — the slider's bar. items: { f, tone, ttl }. Plain: f is 0…1 and the bar stands
   on the floor. mid: f is −1…1 and the bar stands on a middle line, above it or below it; exactly 0 is a dot on the
   line. tone is the colour (up green, dn red, eq yellow); the newest bar is at full strength. */
function hm3BarsHTML(items, mid, h) {
  return '<span class="hm3-bars' + (mid ? " hm3-bars--mid" : "") + '" style="--h:' + h + 'px">' + items.map((it, i) => {
    const f = +it.f || 0, zero = mid && f === 0;
    const pct = zero ? 0 : Math.max(mid ? 10 : 8, Math.round(Math.min(1, Math.abs(f)) * 100));
    return '<i class="' + (it.tone || "eq") + (i === items.length - 1 ? " is-now" : "") + (mid && f < 0 ? " is-lo" : "") + (zero ? " is-zero" : "") +
      '" style="--p:' + pct + '%" title="' + esc(it.ttl || "") + '"></i>';
  }).join("") + "</span>";
}
/* a line that stretches to the room it is given (the 2s10s year) */
function hm3SparkHTML(vals, tone) {
  const v = vals.filter((x) => x != null && isFinite(x)); if (v.length < 2) return "";
  const lo = Math.min.apply(null, v), hi = Math.max.apply(null, v), span = hi - lo || 1, y = (x) => (25 - (x - lo) / span * 22).toFixed(1);
  const pts = v.map((x, i) => (i / (v.length - 1) * 100).toFixed(1) + "," + y(x)).join(" ");
  return '<svg class="hm3-spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">' +
    (lo < 0 && hi > 0 ? '<line class="hm3-zero" x1="0" x2="100" y1="' + y(0) + '" y2="' + y(0) + '"/>' : "") +
    '<polyline class="hm3-sl ' + (tone || "flat") + '" points="' + pts + '"/></svg>';
}

/* ---- 1 · THE YIELD CURVE ----------------------------------------------------------------------------
   The same one read as HM2's (treasury_rates, 270 rows). Three lines, not four: the newest stored curve (thick, the
   day's colour — its 10-year against the day before), a month before it and a year before it. Five of its yields are
   printed on the line itself, so the picture is read without an axis and without scrolling. THEN VS NOW is the same
   three days as numbers. It is called NOW, with its date: Treasury posts a day's yields after the close, so the newest
   curve is often yesterday's. */
function hm3CurveHTML(rows, width) {
  const t0 = rows[0], t1 = rows[1] || null;
  if (!t0) return '<div class="sc-senttxt">the curve is not stored yet</div>';
  const olds = HM3_THEN.map(([lbl, days, col, dash]) => ({ lbl, col, dash, r: hm2RowAtOrBefore(rows, ecShift(String(t0.date), -days)) })).filter((o) => o.r && o.r !== t0);
  let lo = Infinity, hi = -Infinity;
  for (const r of [t0].concat(olds.map((o) => o.r))) for (const [, k] of HM2_TEN) { const v = num(r[k]); if (v != null && isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }
  if (!isFinite(lo)) return '<div class="sc-senttxt">the curve is not stored yet</div>';
  const pad = Math.max(0.05, (hi - lo) * 0.08); lo -= pad; hi += pad;
  const W = Math.max(280, Math.round(width || 360)), H = Math.round(Math.min(190, Math.max(150, W * 0.33))), L = 6, R = 6, T = 20, B = 20, n = HM2_TEN.length;
  const X = (i) => L + (i / (n - 1)) * (W - L - R), Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const path = (r) => HM2_TEN.map(([, k], i) => { const v = num(r[k]); return v == null || !isFinite(v) ? null : X(i).toFixed(1) + "," + Y(v).toFixed(1); }).filter(Boolean).join(" ");
  const tone = (t1 && num(t0.y10) != null && num(t1.y10) != null ? hm2Tone(t0.y10 - t1.y10) : "") || "flat";
  const anchor = (i) => (i === 0 ? "start" : i === n - 1 ? "end" : "middle");
  let svg = '<svg class="hm3-curve" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Treasury yield curve: now against a month ago and a year ago">' +
    '<line class="hm3-base" x1="' + L + '" x2="' + (W - R) + '" y1="' + (H - B + 4) + '" y2="' + (H - B + 4) + '"/>';
  HM2_TEN.forEach(([lbl], i) => { if (HM3_X_LBL[lbl]) svg += '<text class="hm3-ax" x="' + X(i).toFixed(1) + '" y="' + (H - 4) + '" text-anchor="' + anchor(i) + '">' + lbl + "</text>"; });
  for (const o of olds.slice().reverse()) svg += '<polyline class="hm3-cl" points="' + path(o.r) + '" style="stroke:' + o.col + ";stroke-dasharray:" + o.dash + '"/>';
  svg += '<polyline class="hm3-cl hm3-cl--now ' + tone + '" points="' + path(t0) + '"/>';
  HM2_TEN.forEach(([lbl, k], i) => {
    const v = num(t0[k]); if (v == null || !isFinite(v)) return;
    svg += '<circle class="hm3-dot ' + tone + '" cx="' + X(i).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="' + (HM3_ON_LINE[k] ? 2.6 : 1.5) + '"><title>' + lbl + " " + v.toFixed(2) + "% · " + esc(t0.date) + "</title></circle>";
    if (HM3_ON_LINE[k]) svg += '<text class="hm3-val" x="' + X(i).toFixed(1) + '" y="' + (Y(v) - 7).toFixed(1) + '" text-anchor="' + anchor(i) + '">' + v.toFixed(2) + "</text>";
  });
  svg += "</svg>";
  /* THEN VS NOW: the same three days, four maturities, as numbers; a cell's hover says how far it has moved to today */
  const day = (r, year) => hm2Md(String(r.date)) + (year ? " " + String(r.date).slice(0, 4) : "");
  const line = (key, when, style, r, isNow) => '<div class="hm3-tvn__r"><span class="hm3-key' + (isNow ? " " + tone : "") + '"' + style + ' title="' + esc(key + " · " + when) + '"><i></i>' + key + "<em> · " + esc(when) + "</em></span>" +
    HM3_TVN.map(([lbl, k]) => { const v = num(r[k]), now = num(t0[k]);
      return "<span" + (isNow ? ' class="is-now"' : v != null && now != null ? ' title="' + esc(lbl + " " + hm2Sign((now - v) * 100, 0) + " bp from then to today") + '"' : "") + ">" + hm2Fix(v) + "</span>"; }).join("") + "</div>";
  const tvn = '<div class="hm3-tvn"><div class="hm3-tvn__r hm3-tvn__h"><span>THEN VS NOW</span>' + HM3_TVN.map((c) => "<span>" + c[0] + "</span>").join("") + "</div>" +
    line("NOW", day(t0), "", t0, true) +
    olds.map((o) => line(o.lbl, day(o.r, o.lbl === "1Y AGO"), ' style="color:' + o.col + '"', o.r, false)).join("") + "</div>";
  /* 2s10s: one number, the move since the day before, its year as a line, and where it stood then */
  const sp = (r) => (r && num(r.y10) != null && num(r.y2) != null ? r.y10 - r.y2 : null);
  const now = sp(t0), was = sp(t1), chg = now != null && was != null ? (now - was) * 100 : null, st = hm2Tone(chg);
  const spread = '<div class="hm3-sp" title="' + esc("2s10s: the 10-year yield minus the 2-year, in percentage points; above zero the curve slopes up · the line is its last 252 sessions") + '">' +
    '<span class="hm3-sp__l">2s10s</span><b class="hm3-sp__v ' + st + '">' + hm2Sign(now) + "</b>" +
    '<span class="hm3-sp__c ' + st + '">' + (chg == null ? "" : hm2Sign(chg, 0) + " bp on the day") + (now != null && now < 0 ? " · INVERTED" : "") + "</span>" +
    hm3SparkHTML(rows.slice(0, 252).reverse().map(sp), st) +
    '<span class="hm3-sp__o">' + olds.map((o) => '<span style="color:' + o.col + '">' + o.lbl.replace(" AGO", "") + " " + hm2Sign(sp(o.r)) + "</span>").join("") + "</span></div>";
  return svg + tvn + spread;
}

/* ---- 2 · TREASURY AUCTIONS ---------------------------------------------------------------------------
   One line per term: when, how much, where it stopped, the cover, and the two ends of who took it (indirect and
   dealers) — each coloured against the six auctions of the same term before it, by HM2's own rule (hm2AucVsSix).
   A click opens that term: Treasury's own result, and its last thirty auctions as five rows of bars. */
function hm3AucOpenHTML(done, row) {
  const all = done.filter((r) => r.term === row.term), seq = all.slice(0, HM3_AUC_N).reverse();      /* done is newest first */
  const pdf = hm2AucPdf(row.results_pdf);
  const metrics = seq.length < 2 ? "" : HM2_AUC_METRICS.map(([lbl, k, better, d, unit, say]) => {
    const v = seq.map((r) => num(r[k])).filter((x) => x != null && isFinite(x));
    if (v.length < 2) return "";
    const lo = Math.min.apply(null, v), hi = Math.max.apply(null, v), span = hi - lo || 1;
    let lastTone = "", lastAvg = null;
    const items = seq.map((r, i) => {
      const val = num(r[k]); if (val == null || !isFinite(val)) return null;
      const at = all.indexOf(r), prior = all.slice(at + 1, at + 7).map((x) => num(x[k])).filter((x) => x != null && isFinite(x));
      const avg = prior.length ? prior.reduce((a, b) => a + b, 0) / prior.length : null;
      const ref = better === 0 ? (prior.length ? prior[0] : null) : avg;                      /* the stop: against the auction before it */
      const tone = ref == null || val === ref ? "eq" : ((val > ref) === (better >= 0) ? "up" : "dn");
      if (i === seq.length - 1) { lastTone = tone; lastAvg = avg; }
      return { f: 0.12 + 0.88 * (val - lo) / span, tone, ttl: hm2Md(r.auction_date) + " " + r.auction_date.slice(0, 4) + (r.reopening ? " (reopening)" : "") + " · " + val.toFixed(d) + unit +
        (avg != null && better !== 0 ? " · the six before it averaged " + avg.toFixed(d) + unit : "") };
    }).filter(Boolean);
    const now = num(seq[seq.length - 1][k]);
    return '<div class="hm3-m" title="' + esc(say) + '"><div class="hm3-m__h"><b>' + lbl + "</b><span>" + esc(HM3_AUC_GLOSS[k] || "") + "</span></div>" +
      '<div class="hm3-chart">' + hm3BarsHTML(items, false, 30) +
      '<span class="hm3-chart__v ' + lastTone + '"><b>' + (now == null ? "—" : now.toFixed(d) + unit) + "</b>" + (lastAvg != null && better !== 0 ? "<i>six before " + lastAvg.toFixed(d) + "</i>" : "") + "</span></div></div>";
  }).join("");
  return '<div class="hm3-open"><div class="hm3-open__h"><span>' + seq.length + (seq.length === 1 ? " AUCTION" : " AUCTIONS") + " · " + hm3My(seq[0].auction_date) + " → " + hm3My(row.auction_date) + "</span>" +
    (pdf ? '<a class="hm3-link" href="' + esc(pdf) + '" target="_blank" rel="noopener" title="Treasury’s own one-page result for this auction (treasurydirect.gov)">OFFICIAL RESULT ↗</a>' : "") + "</div>" + metrics + "</div>";
}
function hm3AuctionsHTML(rows, later) {
  const today = ecToday();
  const done = rows.filter((r) => r.status === "auctioned"), coming = rows.filter((r) => r.status === "announced" && r.auction_date >= today)
    .sort((a, b) => (a.auction_date < b.auction_date ? -1 : 1));
  if (!done.length && !coming.length) return '<div class="sc-senttxt">no auctions stored yet</div>';
  const cell = (val, avg, better, d, unit) => { const v = num(val), tone = v == null || avg == null || v === avg ? "" : ((v > avg) === (better > 0) ? "up" : "dn");
    return '<span class="' + tone + '" title="' + esc(avg == null ? "" : "the six before it averaged " + avg.toFixed(d) + unit) + '">' + (v == null ? "—" : v.toFixed(d) + unit) + "</span>"; };
  const lines = HM2_TERMS.map((t) => done.find((r) => r.term === t)).filter(Boolean).map((r) => {
    const c = hm2AucVsSix(done, r), open = HM3.auc === r.term, isToday = r.auction_date === today;
    return '<div class="hm3-row hm3-ar' + (open ? " is-open" : "") + (isToday ? " is-today" : "") + '" data-hm3="auc" data-k="' + esc(r.term) + '" role="button" tabindex="0" aria-expanded="' + open + '" title="' +
        esc(r.term + (r.reopening ? " reopening (more of a bond that already trades)" : "") + " · " + (open ? "click to fold its history" : "click to open its history")) + '">' +
      '<span class="hm3-row__l"><i class="hm3-chev">▸</i>' + esc(r.term.replace("-Year", "Y")) + (r.reopening ? '<i class="hm3-re">r</i>' : "") + "</span>" +
      "<span>" + (isToday ? "TODAY" : hm2Md(r.auction_date)) + "</span><span>" + esc(hm2Bn(num(r.offering_amount))) + "</span><span><b>" + hm2Fix(num(r.high_yield), 3) + "%</b></span>" +
      cell(r.bid_to_cover, c.btc, 1, 2, "×") + cell(r.indirect_pct, c.ind, 1, 0, "%") + cell(r.dealer_pct, c.dlr, -1, 0, "%") + "</div>" +
      (open ? hm3AucOpenHTML(done, r) : "");
  }).join("");
  let html = lines ? '<div class="hm3-row hm3-ar hm3-ar--h"><span>TERM</span><span>DATE</span><span>SIZE</span><span>STOP</span><span>COVER</span><span>INDIRECT</span><span>DEALERS</span></div>' + lines : "";
  html += '<div class="hm3-next"><b>COMING</b>' + (coming.length ? coming.map((r) => {
    const days = Math.round((ecAnchor(r.auction_date) - ecAnchor(today)) / 86400);
    return "<span><b>" + esc(r.term.replace("-Year", "Y")) + (r.reopening ? " reopening" : "") + "</b> " + esc(hm2Bn(num(r.offering_amount))) + " · " +
      (days === 0 ? "today" : days === 1 ? "tomorrow" : hm2Md(r.auction_date)) + " " + esc(String(r.closing_time_et || "").replace(/^0/, "")) + " ET</span>";
  }).join("") : "<span>nothing announced yet</span>") + "</div>";
  if (later && later.length) html += '<div class="hm3-next hm3-next--later" title="' + esc("dated on the calendar; Treasury names the size about a week ahead") + '"><b>LATER</b>' +
    later.map((l) => '<span title="' + esc(l.last != null ? "its last auction was " + hm2Bn(l.last) : "") + '"><b>' + esc(l.term.replace("-Year", "Y")) + "</b> " + hm2Md(l.day) + "</span>").join("") + "</div>";
  return html;
}

/* ---- 3 · MACRO PRINTS --------------------------------------------------------------------------------
   One line per indicator: its name, its last twelve surprises as small bars on a line (above and green = better than
   expected, below and red = worse, a yellow dot = on consensus — HM2's rule, EC_INVERT deciding which way is better),
   and the newest print against what was expected. A click opens every stored print as bars of the number itself,
   each bar coloured by its surprise, then the last four prints in words. */
function hm3PrintPts(base, rows) { const inv = EC_INVERT.test(base) ? -1 : 1; return rows.map((r) => ({ r, s: (r.actual - r.estimate) * inv })); }
const hm3PrintTone = (p) => (p.s > 0 ? "up" : p.s < 0 ? "dn" : "eq");
function hm3PrintTtl(p) {
  const day = ecDateKey(+p.r.event_ts), per = ecPeriod(p.r.event);
  return hm2Md(day) + " " + day.slice(0, 4) + (per ? " (" + per + ")" : "") + " · actual " + p.r.actual + " · expected " + p.r.estimate +
    (p.r.previous != null ? " · before " + p.r.previous : "") + " · " + (p.s > 0 ? "better than expected" : p.s < 0 ? "worse than expected" : "on consensus");
}
function hm3PrintOpenHTML(base, pts) {
  const v = pts.map((p) => +p.r.actual), lo = Math.min.apply(null, v), hi = Math.max.apply(null, v), cross = lo < 0 && hi > 0, span = hi - lo || 1, top = Math.max(Math.abs(lo), Math.abs(hi)) || 1;
  const last = pts[pts.length - 1], d0 = ecDateKey(+pts[0].r.event_ts), d1 = ecDateKey(+last.r.event_ts);
  const better = pts.filter((p) => p.s > 0).length, worse = pts.filter((p) => p.s < 0).length;
  /* a series that crosses zero stands on a zero line; one that does not is stretched between its own low and high */
  const bars = hm3BarsHTML(pts.map((p) => ({ f: cross ? p.r.actual / top : 0.12 + 0.88 * (p.r.actual - lo) / span, tone: hm3PrintTone(p), ttl: hm3PrintTtl(p) })), cross, 46);
  const recent = pts.slice(-HM3_PRINT_RECENT).reverse().map((p) => { const day = ecDateKey(+p.r.event_ts);
    return '<span class="hm3-pl"><i>' + hm2Md(day) + '</i><b class="' + hm3PrintTone(p) + '">' + esc(String(p.r.actual)) + "</b><span>expected " + esc(String(p.r.estimate)) +
      (p.r.previous != null ? " · before " + esc(String(p.r.previous)) : "") + "</span></span>"; }).join("");
  return '<div class="hm3-open"><div class="hm3-open__h"><span>' + pts.length + " PRINTS · " + hm3My(d0) + " → " + hm3My(d1) + "</span><span>" + better + " BETTER · " + worse + " WORSE</span></div>" +
    '<div class="hm3-chart">' + bars + '<span class="hm3-chart__v ' + hm3PrintTone(last) + '"><b>' + esc(String(last.r.actual)) + "</b><i>low " + lo + " · high " + hi + "</i></span></div>" +
    '<div class="hm3-pls">' + recent + "</div>" +
    '<div class="hm3-open__f"><span class="hm3-link" data-hm2="strip" data-day="' + d1 + '" title="' + esc("open the newest print in the calendar on the left") + '">IN THE CALENDAR →</span></div></div>';
}
function hm3PrintRowHTML(base, rows, open) {
  const pts = hm3PrintPts(base, rows), last = pts[pts.length - 1], tail = pts.slice(-HM3_PRINT_TAIL);
  const max = Math.max.apply(null, pts.map((p) => Math.abs(p.s))) || 1;
  return '<div class="hm3-row hm3-pr' + (open ? " is-open" : "") + '" data-hm3="print" data-k="' + esc(base) + '" role="button" tabindex="0" aria-expanded="' + open + '" title="' +
      esc(base + " · the bars are its last " + tail.length + " surprises, oldest on the left · " + (open ? "click to fold its history" : "click to open its history")) + '">' +
    '<span class="hm3-row__l"><i class="hm3-chev">▸</i>' + esc(HM2_STRIP_LBL[base] || base) + "</span>" +
    hm3BarsHTML(tail.map((p) => ({ f: p.s / max, tone: hm3PrintTone(p), ttl: hm3PrintTtl(p) })), true, 20) +
    '<span class="hm3-row__v ' + hm3PrintTone(last) + '"><b>' + esc(String(last.r.actual)) + "</b> vs " + esc(String(last.r.estimate)) + "</span></div>" +
    (open ? hm3PrintOpenHTML(base, pts) : "");
}
function hm3PrintsHTML(have, by) {
  HM3.have = have; HM3.by = by;                              /* kept so that a click redraws without a second read */
  return have.map((b) => hm3PrintRowHTML(b, by[b], HM3.print === b)).join("");
}
function hm3PrintsPaint() {
  const host = hm2Host("hm2Strips"); if (!host || !HM3_ON || !HM3.have) return;
  host.innerHTML = hm3PrintsHTML(HM3.have, HM3.by);
}

/* ---- 4 · THE EVENT CARD ------------------------------------------------------------------------------
   "Just keep it simple. It's just about having access to the information." The release and its time; the official
   link (an auction that has a result links Treasury's own page for it); the three headlines. Which release, which
   publisher and which headlines are HM2's (hm2EventPick, hm2Source, hm2EventNews) — only what is drawn is less. */
function hm3EventHTML(ev, nowSec, news, auction) {
  const out = ev.ets <= nowSec, mins = Math.round(Math.abs(nowSec - ev.ets) / 60), src = hm2Source(ev.sub);
  const ago = mins < 1 ? "just now" : mins < 90 ? mins + " min" : Math.round(mins / 60) + " h";
  const day = ecDateKey(ev.ets), when = (day === ecDateKey(nowSec) ? "TODAY" : hm2Md(day)) + " " + ecTimeET(ev.ets) + " ET";
  const pdf = out && auction ? hm2AucPdf(auction.results_pdf) : null;
  const link = pdf ? '<a class="hm3-link hm3-ev__src" href="' + esc(pdf) + '" target="_blank" rel="noopener" title="' + esc("Treasury’s own one-page result for this auction") + '">THIS AUCTION’S RESULT · TREASURYDIRECT.GOV ↗</a>'
    : src ? '<a class="hm3-link hm3-ev__src" href="' + esc(src.url) + '" target="_blank" rel="noopener" title="' + esc(src.who + " · " + src.what) + '">' + esc(src.site.toUpperCase()) + " ↗</a>"
    : '<span class="hm3-ev__none">no official link on file for this release</span>';
  const feed = !out || news == null ? "" : !news.length ? '<span class="hm3-ev__none">no headline in our feed yet</span>'
    : news.map((n) => '<span class="hm3-ev__n">' + (n.url ? '<a href="' + esc(n.url) + '" target="_blank" rel="noopener">' + esc(n.title) + "</a>" : esc(n.title)) +
      " <i>" + esc(n.site || "") + " · " + esc(ecTimeET(+n.published_ts)) + " ET</i></span>").join("");
  return '<h4 class="hm3-ev">' + esc(ev.sub.toUpperCase()) + ' <i class="ec-li-note">' + esc(when) + " · " + (out ? "out " + ago + " ago" : "in " + ago) + "</i>" +
      (ev.why === "picked" ? '<span class="se-zm hm2-evx" data-hm2="evclose" title="back to what is happening now">×</span>' : "") + "</h4>" + link + feed;
}

/* ---- the three cards' frames, what PAGE SPECS says, and the click ------------------------------------- */
const HM3_FRAME = {
  curve: '<div class="card hm2-card hm3-card"><h4>TREASURY CURVE <i class="ec-li-note" id="hm2CurveAsOf"></i></h4><div id="hm2Curve"><div class="sc-senttxt">—</div></div></div>',
  auctions: '<div class="card hm2-card hm3-card"><h4>TREASURY AUCTIONS</h4><div id="hm2Auctions"><div class="sc-senttxt">—</div></div></div>',
  prints: '<div class="card hm2-card hm3-card"><h4>MACRO PRINTS <i class="ec-li-note" id="hm2StripsSince"></i></h4><div id="hm2Strips"><div class="sc-senttxt">—</div></div></div>',
};
/* where HM2's cards stand, after the rail's two lists … */
function hm3RailCardsHTML() { return (HM3_CURVE_FIRST ? "" : HM3_FRAME.curve + HM3_FRAME.auctions) + HM3_FRAME.prints; }
/* … and the top of the rail, right under the event card: nothing, unless the curve and the auctions are to come first
   (and never when HM2's own switch is off: then the room has none of these cards) */
function hm3RailTopHTML() { return HM3_CURVE_FIRST && (typeof HM2_ON === "undefined" ? false : HM2_ON) ? HM3_FRAME.curve + HM3_FRAME.auctions : ""; }
const HM3_SPECS_P =
  "<p><b>Treasury curve.</b> treasury_rates (Treasury’s daily par yields). Three lines: today, and the stored curve nearest to a month and a year before it. Today’s line is green when the 10-year closed above the day before and red when below; five of its yields are printed on it. THEN VS NOW is the same three days as numbers. 2s10s is the 10-year minus the 2-year, with its last 252 sessions as a line; above zero the curve slopes up.</p>" +
  "<p><b>Treasury auctions.</b> One line per term: the newest auction’s date, size, where it stopped (the highest yield accepted), the cover (dollars bid per dollar sold) and the share taken by indirect bidders and by dealers. An r beside a term is a reopening: more of a bond that already trades. A number is green when it shows more demand than the average of the six auctions of that term before it and red when less; for DEALERS a smaller share is the stronger auction. Click a line to open that term: Treasury’s own result, and its last thirty auctions as bars, oldest on the left (STOPPED AT is coloured by which way it moved from the auction before). COMING is what Treasury has announced, with its size; LATER is dated on the calendar and not yet sized. TreasuryDirect’s own results, a few minutes after the 1:00 PM New York deadline. The tail is not shown: it needs the yield the new issue traded at one minute before the deadline, and no free source carries it.</p>" +
  "<p><b>Macro prints.</b> econ_calendar (FMP’s economic calendar), every US print stored with a consensus. One line per indicator: the small bars are its last twelve surprises, oldest on the left — above the line and green is better than expected, below and red is worse, a yellow dot is exactly on consensus; for inflation, unemployment and jobless claims a lower number is the better one. Click a line to open every stored print: each bar is the number itself (stretched between its own low and high, or standing on a zero line when it crosses zero) in the colour of its surprise, then the last four prints. Indicators nobody forecasts (money supply, the Fed’s balance sheet, mortgage rates) have no line.</p>" +
  "<p><b>The event card.</b> At the top of the rail, for the release that is happening or the one you click in the day table: the publisher’s own page (an auction that has a result links Treasury’s one-page result) and the first three headlines our news feed carried after the release. FMP’s calendar gives the item, its time and — for a print — its numbers, which are in the day table; it gives no text.</p>";
if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
  const hm3Toggle = (e) => {
    if (!HM3_ON || !e.target || !e.target.closest || e.target.closest("a, [data-hm2]")) return false;   /* a link, or one of HM2's own controls inside an open row */
    const a = e.target.closest("[data-hm3]"); if (!a) return false;
    const k = a.dataset.hm3, v = a.dataset.k;
    if (k === "auc") { HM3.auc = HM3.auc === v ? null : v; hm2AuctionsPaint(); }
    else if (k === "print") { HM3.print = HM3.print === v ? null : v; hm3PrintsPaint(); }
    else return false;
    if (e.type === "keydown") { const again = Array.from(document.querySelectorAll('[data-hm3="' + k + '"]')).find((x) => x.dataset.k === v); if (again) again.focus(); }   /* the key that opened it can fold it again */
    return true;
  };
  document.addEventListener("click", hm3Toggle);
  document.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target && e.target.dataset && e.target.dataset.hm3 && hm3Toggle(e)) e.preventDefault(); });
}
/* ==== END HM3 ============================================================== */

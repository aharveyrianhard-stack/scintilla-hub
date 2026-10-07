/* ==== HM2 · 7 OCT 2026 — THE MACRO SCREENS ==================================
   Alan, 7 Oct ~12:50 ET, in order:
     "we don't have in the economic section a left to right slider like we have on the event section … I think we should"
     "There's a … 10-year note auction … should we be tracking that? … how much they fill or what?"
     "the treasury yield ladder — wouldn't the graphic be better for this?"
     "macro prints — all of the historical information, do we have it? … It's only really useful in a historical
      context. A visual like slider type oscillator thing could be good on that too"
     on put/call: "it's like a two-factor thing — it can move because one or the other moved … What's the best visual?"
   WHAT THIS BLOCK ADDS (each part is its own function and its own host element):
     1. hm2EcTape   — the ECONOMIC room's left-to-right slider, in the EARNINGS slider's own frame and classes
                      (.se-tape …): one bar a day / week / month, a TODAY line, click a bar to open it below.
     2. hm2Curve    — the yield curve as a picture, in place of the UST ladder: today against a week, a month and a
                      year ago, with the 2s10s and 3m10y spreads.
     3. hm2Auctions — Treasury auction results (public.treasury_auctions, from TreasuryDirect): the stop, bid-to-cover
                      and who took it, each against the six auctions of the same term before it; what is coming, with size.
     4. hm2Strips   — one strip of surprises per indicator, oldest on the left: up and green = better than expected,
                      down and red = worse (the room's own EC_INVERT rule decides which way is better).
     5. hm2Pc       — the put/call tape on the dashboard: for each name, calls ÷ its usual day and puts ÷ its usual
                      day side by side, then the ratio against its usual; the name flashes at 1.5× (scScint).
   WHAT IT READS: econ_calendar, treasury_rates (both already read by this room), treasury_auctions and
   putcall_names_now (new, additive — until they exist each card says "not stored yet" and nothing else changes).
   HOW TO TURN IT OFF: HM2_ON = false puts the room, the rail and the dashboard back exactly as they were. */
var HM2_ON = true;                      /* var, not const: a builder that runs before this line reads it as off, never as an error */
var HM2_PC_ON = true;                   /* the put/call tape on the dashboard, on its own switch */
const HM2_PC_FLASH_X = 1.5;             /* Alan: a name flashes when its ratio reaches 1.5× its own usual */
const HM2_PC_REFRESH_MS = 60000, HM2_PC_FLASH_MS = 6000;
/* A HOST IS A REAL ELEMENT OR IT IS NOTHING. Every part below paints into an element its own HTML drew; anything
   else (no element, or a stand-in that is not a DOM node) means the room on screen is not this one, and the part
   neither reads nor paints. So the room's own mount and its own reads never wait on, or share a queue with, these. */
const hm2Host = (id) => { const h = el(id); return h && h.nodeType === 1 ? h : null; };
const hm2Fix = (v, d) => (v == null || !isFinite(+v) ? "—" : (+v).toFixed(d == null ? 2 : d));
const hm2Sign = (v, d) => (v == null || !isFinite(+v) ? "—" : (+v > 0 ? "+" : +v < 0 ? "−" : "") + Math.abs(+v).toFixed(d == null ? 2 : d));
const hm2Tone = (v) => (v == null || !isFinite(+v) || +v === 0 ? "" : +v > 0 ? "up" : "dn");

/* ---- 1 · THE ECONOMIC SLIDER --------------------------------------------------------------------
   Built like the earnings one: the same frame, the same bar, the same number above it, the same TODAY line, the same
   zoom chips. What a bar counts: the releases of that day (week, month) that pass the room's own filters — the
   region tab, the category chip and HIGH ONLY — so the slider and the table under it never disagree.
   Its colour is the day's LOAD, as on the earnings slider: cool = no high-importance release, warm = one to four,
   hot = five or more. MEASURED, not chosen by eye: over the 190 US weekdays to 7 Oct 2026, 84 days carried none,
   83 carried one to four and 23 carried five or more — so red is about one day in eight. (A week is ranked against
   the busiest week on the slider instead.) A star marks a bar that holds one of the releases that move everything
   (the Fed's decision, payrolls, CPI, core PCE, GDP). */
const HM2_TL_HOT = 5;
const HM2_ZOOMS = ["DAYS", "WEEKS"];   /* no MONTHS: a month of releases is nearly the same number every month, and the read would be the whole table */
const HM2_ZOOM = {
  DAYS:   { w: 19, back: 35,  fwd: 28,  span: "DAY",   say: "one bar is one day; weekends appear only when something is scheduled" },
  WEEKS:  { w: 24, back: 182, fwd: 63,  span: "WEEK",  say: "one bar is one week, Monday to Sunday" },
};
const HM2_MOVER = /^(fed interest rate decision|non ?farm payrolls|inflation rate yoy|cpi mom|core pce price index mom|gdp growth rate qoq)$/i;
const HM2_MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
let HM2_TL = { z: "DAYS", key: "", rows: null, busy: "", failAt: 0, drag: null, moved: false, trunc: false };
function hm2TlSpan(z) {
  const t = ecToday(), c = HM2_ZOOM[z];
  let from = ecShift(t, -c.back), to = ecShift(t, c.fwd);
  if (z === "WEEKS") from = hm2Monday(from);
  return { from, to };
}
function hm2Monday(iso) { const d = new Date(ecAnchor(iso) * 1000).getUTCDay(); return ecShift(iso, -((d + 6) % 7)); }
function hm2Bucket(iso, z) { return z === "DAYS" ? iso : z === "WEEKS" ? hm2Monday(iso) : iso.slice(0, 8) + "01"; }
function hm2BucketEnd(b, z) {
  if (z === "DAYS") return b;
  if (z === "WEEKS") return ecShift(b, 6);
  const y = +b.slice(0, 4), m = +b.slice(5, 7);
  return b.slice(0, 8) + String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0");
}
function hm2Buckets(from, to, z, dated) {
  const out = [], seen = {};
  for (let d = from; d <= to; d = ecShift(d, 1)) {
    const b = hm2Bucket(d, z);
    if (seen[b]) continue;
    if (z === "DAYS") { const wd = new Date(ecAnchor(d) * 1000).getUTCDay(); if ((wd === 0 || wd === 6) && !dated[d]) continue; }
    seen[b] = 1; out.push(b);
  }
  return out;
}
function hm2TlKey(z) { const s = hm2TlSpan(z); return (S.econCty || "US") + "|" + z + "|" + s.from + "|" + s.to; }
/* THE SLIDER OPENS NO CALENDAR READ OF ITS OWN: it asks through ecFetchWindow, the room's one window reader (the same
   select, the same keyset pages, the same unit rule), for its own stretch. One ask per region and zoom, kept until
   the zoom, the region or the day changes; a failed ask says so and is made again on the next paint after 20 seconds. */
async function hm2TlLoad(z) {
  const key = hm2TlKey(z), s = hm2TlSpan(z);
  if (HM2_TL.busy === key || (HM2_TL.key === key && HM2_TL.rows)) return;
  if (HM2_TL.failAt && Date.now() - HM2_TL.failAt < 20000) return;
  HM2_TL.busy = key;
  try {
    const from = Math.floor(ecAnchor(s.from) - 86400), to = Math.floor(ecAnchor(s.to) + 86400);
    const out = await ecFetchWindow(from, to);
    if (hm2TlKey(HM2_TL.z) !== key) return;                 /* the reader moved on while this was in flight */
    /* ecFetchWindow stops after 20 pages of 1,000: a stretch that large is said, not shown as if it were whole */
    HM2_TL.key = key; HM2_TL.rows = out || []; HM2_TL.failAt = 0; HM2_TL.trunc = (out || []).length >= 20000;
  } catch (_) { HM2_TL.failAt = Date.now(); }
  finally { if (HM2_TL.busy === key) HM2_TL.busy = ""; }
  hm2EcTapePaint();
}
function hm2TlIndex(rows, z) {
  const idx = {}, reg = S.econCty || "US", cat = S.econCat || "ALL";
  for (const r of rows || []) {
    if (!ecInRegion(r.country, reg) || !ecPassImp(r)) continue;
    if (cat !== "ALL" && ecCat(r.event) !== cat) continue;
    const b = hm2Bucket(ecDateKey(+r.event_ts), z), e = idx[b] || (idx[b] = { n: 0, hi: 0, mover: "", names: [] });
    e.n++;
    if (r.impact === "High") { e.hi++; if (e.names.length < 3) e.names.push(ecBase(r.event)); }
    if (!e.mover && r.country === "US" && HM2_MOVER.test(ecBase(r.event))) e.mover = ecBase(r.event);
  }
  return idx;
}
function hm2TlLevel(e, z, maxHi) {
  if (!e || !e.hi) return "cool";
  if (z === "DAYS") return e.hi >= HM2_TL_HOT ? "hot" : "warm";
  return maxHi > 0 && e.hi >= 0.66 * maxHi ? "hot" : e.hi >= 0.33 * maxHi ? "warm" : "cool";
}
function hm2TlSay(b, z) {
  const d = new Date(ecAnchor(b) * 1000), wd = ["SUN","MON","TUE","WED","THU","FRI","SAT"][d.getUTCDay()];
  const md = HM2_MON[d.getUTCMonth()].toUpperCase() + " " + d.getUTCDate();
  if (z === "DAYS") return wd + " " + md;
  if (z === "WEEKS") return "WEEK OF " + md;
  return HM2_MON[d.getUTCMonth()].toUpperCase() + " " + d.getUTCFullYear();
}
function hm2TlTick(b, z) {
  const d = new Date(ecAnchor(b) * 1000);
  return z === "MONTHS" ? HM2_MON[d.getUTCMonth()] : String(d.getUTCDate());
}
function hm2TlBarHTML(b, z, e, today, open, maxN, maxHi) {
  const n = e ? e.n : 0, end = hm2BucketEnd(b, z), isNow = today >= b && today <= end;
  const lvl = hm2TlLevel(e, z, maxHi), pct = n ? Math.max(6, Math.round((n / maxN) * 70)) : 0;   /* the tallest bar stops at 70% so its number and its star stay inside the frame */
  const ttl = hm2TlSay(b, z) + " · " + (n ? n + (n === 1 ? " release" : " releases") : "nothing scheduled") +
    (e && e.hi ? " · " + e.hi + " high-importance" + (e.names.length ? ": " + e.names.join(", ") + (e.hi > e.names.length ? " …" : "") : "") : "") +
    (isNow ? " · this is where today sits" : "") + " · click to open this " + HM2_ZOOM[z].span.toLowerCase() + " below";
  return '<div class="se-tlday' + (isNow ? " is-today" : "") + (open >= b && open <= end ? " is-open" : "") + (end < today ? " is-past" : "") +
      '" data-hm2="bar" data-d="' + b + '" title="' + esc(ttl) + '">' +
    '<span class="se-tlb"><i class="' + lvl + '" style="height:' + pct + '%"></i>' +
      (n ? '<span class="se-tlv ' + lvl + '" style="bottom:calc(' + pct + '% + 3px)">' + n + "</span>" : "") +
      (e && e.mover ? '<span class="se-tlstar" title="' + esc(e.mover + " prints here") + '">★</span>' : "") +
    "</span>" +
    '<span class="se-tlx">' + esc(hm2TlTick(b, z)) + "</span></div>";
}
function hm2TlStripHTML(buckets, z) {
  const grp = (b) => (z === "MONTHS" ? b.slice(0, 4) : b.slice(0, 7));
  const say = (g) => (z === "MONTHS" ? g : HM2_MON[+g.slice(5, 7) - 1].toUpperCase() + (g.slice(5, 7) === "01" ? " " + g.slice(0, 4) : ""));
  let out = "", run = 0, cur = "";
  const flush = () => { if (run) out += '<span class="se-tlmo" style="width:calc(var(--tlw) * ' + run + ')">' + esc(say(cur)) + "</span>"; };
  buckets.forEach((b) => { const g = grp(b); if (g !== cur) { flush(); cur = g; run = 1; } else run++; });
  flush();
  return '<div class="se-tlmos">' + out + "</div>";
}
function hm2EcTapeHTML() {
  const z = HM2_TL.z, s = hm2TlSpan(z), today = ecToday(), open = S.econDay || today;
  const have = HM2_TL.key === hm2TlKey(z) && HM2_TL.rows;
  const zooms = '<span class="se-zooms" title="' + esc("how much one bar covers") + '"><span class="se-zlbl">ZOOM</span>' +
    HM2_ZOOMS.map((x) => '<span class="se-zm' + (x === z ? " on" : "") + '" data-hm2="zoom" data-z="' + x + '" title="' + esc(HM2_ZOOM[x].say) + '">' + x + "</span>").join("") +
    '<span class="se-zm se-zm--now" data-hm2="now" title="' + esc("bring the slider back to today") + '">TODAY</span></span>';
  const lbl = "ON SCREEN " + hm2TlSay(s.from, "DAYS").replace(/^\w+ /, "") + " " + s.from.slice(0, 4) + "  →  " + hm2TlSay(s.to, "DAYS").replace(/^\w+ /, "") + " " + s.to.slice(0, 4);
  if (!have) {
    return '<div class="se-tape hm2-tape"><div class="se-tapehd"><span class="se-lbl hm2-tllbl">' + esc(lbl) + "</span>" + zooms + "</div>" +
      '<div class="se-tapesay">' + (HM2_TL.failAt ? "the calendar could not be read for this stretch. It asks again by itself." : "reading the calendar…") + "</div></div>";
  }
  const idx = hm2TlIndex(HM2_TL.rows, z), dated = {};
  if (z === "DAYS") { for (const b in idx) dated[b] = 1; if (today >= s.from && today <= s.to) dated[today] = 1; }
  const buckets = hm2Buckets(s.from, s.to, z, dated);
  let maxN = 1, maxHi = 0, total = 0, hi = 0;
  for (const b of buckets) { const e = idx[b]; if (e) { maxN = Math.max(maxN, e.n); maxHi = Math.max(maxHi, e.hi); total += e.n; hi += e.hi; } }
  const bars = buckets.map((b) => hm2TlBarHTML(b, z, idx[b], today, open, maxN, maxHi)).join("");
  const d = new Date(ecAnchor(today) * 1000);
  const todaySay = "TODAY · " + ["SUN","MON","TUE","WED","THU","FRI","SAT"][d.getUTCDay()] + " " + HM2_MON[d.getUTCMonth()].toUpperCase() + " " + d.getUTCDate();
  const scope = (S.econCty || "US") + ((S.econCat || "ALL") !== "ALL" ? " · " + S.econCat : "") + (S.econImp === "HIGH" ? " · high only" : "");
  return '<div class="se-tape se-tape--' + z.toLowerCase() + ' hm2-tape" style="--tlw:' + HM2_ZOOM[z].w + 'px">' +
    '<div class="se-tapehd"><span class="se-lbl hm2-tllbl" title="' + esc(HM2_ZOOM[z].say + " · drag it or scroll it sideways") + '">' + esc(lbl) + "</span>" + zooms + "</div>" +
    '<div class="se-tlwrap"><div class="se-tlscroll" id="hm2TlScroll" data-key="' + esc(HM2_TL.key) + '">' +
      '<div class="se-tlgrid">' + bars + "</div>" + hm2TlStripHTML(buckets, z) +
      '<span class="se-tltoday" id="hm2TlToday" hidden title="' + esc("everything left of this line has happened, everything right of it is still to come") + '"><b>' + esc(todaySay) + "</b></span>" +
    "</div></div>" +
    '<div class="se-tapesay"><span>showing <b>' + esc(scope) + "</b> · " + total + (total === 1 ? " release" : " releases") + " on this slider · " + hi + " high-importance</span>" +
      (HM2_TL.trunc ? '<span class="se-none">this stretch holds more releases than one read returns — the right-hand bars are short; pick a narrower region</span>' : "") + "</div></div>";
}
/* the TODAY line sits at today's own place inside its bar (noon-ish for a day; the day's share of a week or a month) */
function hm2TlPlaceToday(sc) {
  const line = hm2Host("hm2TlToday"); if (!sc || !line) return;
  const bar = sc.querySelector(".se-tlday.is-today");
  if (!bar) { line.hidden = true; return; }
  const z = HM2_TL.z, b = bar.dataset.d, today = ecToday();
  let frac = 0.5;
  if (z !== "DAYS") { const len = Math.round((ecAnchor(hm2BucketEnd(b, z)) - ecAnchor(b)) / 86400) + 1; frac = (Math.round((ecAnchor(today) - ecAnchor(b)) / 86400) + 0.5) / len; }
  line.style.left = (bar.offsetLeft + bar.offsetWidth * frac) + "px";
  line.hidden = false;
  line.classList.toggle("is-flip", bar.offsetLeft > sc.scrollWidth - 150);
}
function hm2TlToToday(sc, smooth) {
  const bar = sc && sc.querySelector(".se-tlday.is-today"); if (!bar) return;
  const to = Math.max(0, bar.offsetLeft - sc.clientWidth * 0.5);
  if (smooth && typeof sc.scrollTo === "function") sc.scrollTo({ left: to, behavior: "smooth" }); else sc.scrollLeft = to;
}
function hm2EcTapePaint() {
  const host = hm2Host("hm2EcTape"); if (!host || !HM2_ON) return;
  if (HM2_TL.key !== hm2TlKey(HM2_TL.z) || !HM2_TL.rows) hm2TlLoad(HM2_TL.z);
  const html = hm2EcTapeHTML(), old = hm2Host("hm2TlScroll");
  /* same stretch on screen: only the bars are swapped, so a filter chip never throws the slider back to its start */
  if (old && host.contains(old) && old.dataset.key === HM2_TL.key && typeof document !== "undefined") {
    const box = document.createElement("div"); box.innerHTML = html;
    const nsc = box.querySelector("#hm2TlScroll");
    if (nsc && nsc.dataset.key === old.dataset.key) {
      const keep = old.scrollLeft;
      old.innerHTML = nsc.innerHTML; old.scrollLeft = keep;
      const so = host.querySelector(".se-tapesay"), sn = box.querySelector(".se-tapesay"); if (so && sn) so.innerHTML = sn.innerHTML;
      hm2TlPlaceToday(old);
      return;
    }
  }
  host.innerHTML = html;
  const sc = hm2Host("hm2TlScroll");
  if (sc) { hm2TlToToday(sc, false); hm2TlPlaceToday(sc); hm2TlDragArm(sc); }
}
function hm2TlDragArm(sc) {
  if (!sc || sc.dataset.armed) return; sc.dataset.armed = "1";
  sc.addEventListener("pointerdown", (e) => { if (e.button) return; HM2_TL.drag = { x: e.clientX, left: sc.scrollLeft }; HM2_TL.moved = false; });
  sc.addEventListener("pointermove", (e) => {
    const d = HM2_TL.drag; if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 4) { HM2_TL.moved = true; sc.classList.add("is-drag"); }
    if (HM2_TL.moved) sc.scrollLeft = d.left - dx;
  });
  const end = () => { HM2_TL.drag = null; sc.classList.remove("is-drag"); };
  sc.addEventListener("pointerup", end); sc.addEventListener("pointerleave", end); sc.addEventListener("pointercancel", end);
}
function hm2TlOpen(b) {
  const z = HM2_TL.z;
  S.econDay = z === "DAYS" ? b : (ecToday() >= b && ecToday() <= hm2BucketEnd(b, z) ? ecToday() : b);
  S.econSpan = HM2_ZOOM[z].span; S.econOpen = {}; S.econFocus = null;
  document.querySelectorAll('.ec-span .ec-sp[data-act="ecspan"]').forEach((x) => x.classList.toggle("on", x.dataset.s === S.econSpan));
  ecLoadWindow();
}

/* ---- 2 · THE YIELD CURVE, AS A PICTURE ------------------------------------------------------------
   One read: the newest 270 rows of treasury_rates (a trading year and a little more). Four curves on one frame —
   today, and the stored curve nearest to a week, a month and a year before it. Today's line is the day's colour
   (the 10-year closed above the day before = green, below = red), the three older ones each have a hue and a
   dash of their own, so none of them is a grey line. Under it: the two spreads Alan named, each with its own year. */
const HM2_TEN = [["1M","m1"],["2M","m2"],["3M","m3"],["6M","m6"],["1Y","y1"],["2Y","y2"],["3Y","y3"],["5Y","y5"],["7Y","y7"],["10Y","y10"],["20Y","y20"],["30Y","y30"]];
const HM2_CURVE_OLD = [["1W AGO", 7, "#00D4FF", "5 3"], ["1M AGO", 30, "#A24BFF", "2 3"], ["1Y AGO", 365, "#FF8A00", "7 3 2 3"]];
function hm2RowAtOrBefore(rows, iso) { for (const r of rows) if (String(r.date) <= iso) return r; return null; }
function hm2Spark(vals, tone, w, h) {
  const v = vals.filter((x) => x != null && isFinite(x)); if (v.length < 2) return "";
  const lo = Math.min.apply(null, v), hi = Math.max.apply(null, v), span = hi - lo || 1;
  const pts = v.map((x, i) => (i / (v.length - 1) * w).toFixed(1) + "," + (h - 2 - (x - lo) / span * (h - 4)).toFixed(1)).join(" ");
  const zero = lo < 0 && hi > 0 ? '<line x1="0" x2="' + w + '" y1="' + (h - 2 - (0 - lo) / span * (h - 4)).toFixed(1) + '" y2="' + (h - 2 - (0 - lo) / span * (h - 4)).toFixed(1) + '" class="hm2-zero"/>' : "";
  return '<svg class="hm2-spark" viewBox="0 0 ' + w + " " + h + '" width="' + w + '" height="' + h + '" aria-hidden="true">' + zero +
    '<polyline points="' + pts + '" class="hm2-sl ' + (tone || "flat") + '"/></svg>';
}
function hm2CurveHTML(rows, width) {
  const t0 = rows[0], t1 = rows[1] || null;
  if (!t0) return '<div class="sc-senttxt">the curve is not stored yet</div>';
  const olds = HM2_CURVE_OLD.map(([lbl, days, col, dash]) => ({ lbl, col, dash, r: hm2RowAtOrBefore(rows, ecShift(String(t0.date), -days)) })).filter((o) => o.r && o.r !== t0);
  const all = [t0].concat(olds.map((o) => o.r));
  let lo = Infinity, hi = -Infinity;
  for (const r of all) for (const [, k] of HM2_TEN) { const v = num(r[k]); if (v != null && isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }
  if (!isFinite(lo)) return '<div class="sc-senttxt">the curve is not stored yet</div>';
  const pad = Math.max(0.05, (hi - lo) * 0.12); lo -= pad; hi += pad;
  const W = Math.max(280, Math.round(width || 360)), H = Math.round(Math.min(190, Math.max(140, W * 0.36))), L = 34, R = 10, T = 10, B = 22, n = HM2_TEN.length;
  const X = (i) => L + (i / (n - 1)) * (W - L - R), Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const path = (r) => HM2_TEN.map(([, k], i) => { const v = num(r[k]); return v == null || !isFinite(v) ? null : X(i).toFixed(1) + "," + Y(v).toFixed(1); }).filter(Boolean).join(" ");
  const dayTone = t1 && num(t0.y10) != null && num(t1.y10) != null ? hm2Tone(t0.y10 - t1.y10) : "";
  const yTicks = [lo + pad, (lo + hi) / 2, hi - pad];
  let svg = '<svg class="hm2-curve" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Treasury yield curve: today against a week, a month and a year ago">';
  for (const v of yTicks) svg += '<line class="hm2-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/><text class="hm2-ax" x="' + (L - 4) + '" y="' + (Y(v) + 3).toFixed(1) + '" text-anchor="end">' + v.toFixed(2) + "</text>";
  HM2_TEN.forEach(([lbl], i) => { if (lbl !== "2M" && lbl !== "3Y" && lbl !== "7Y" && (W >= 420 || (lbl !== "6M" && lbl !== "20Y"))) svg += '<text class="hm2-ax" x="' + X(i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + lbl + "</text>"; });
  for (const o of olds.slice().reverse()) svg += '<polyline class="hm2-cl" points="' + path(o.r) + '" style="stroke:' + o.col + ";stroke-dasharray:" + o.dash + '"/>';
  svg += '<polyline class="hm2-cl hm2-cl--now ' + (dayTone || "flat") + '" points="' + path(t0) + '"/>';
  HM2_TEN.forEach(([lbl, k], i) => { const v = num(t0[k]); if (v != null && isFinite(v)) svg += '<circle class="hm2-dot ' + (dayTone || "flat") + '" cx="' + X(i).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="1.8"><title>' + lbl + " " + v.toFixed(2) + "% · " + esc(t0.date) + "</title></circle>"; });
  svg += "</svg>";
  const legend = '<div class="hm2-leg"><span class="hm2-lg ' + (dayTone || "flat") + '"><i></i>TODAY ' + esc(String(t0.date).slice(5)) + "</span>" +
    olds.map((o) => '<span class="hm2-lg" style="color:' + o.col + '"><i style="border-top-style:dashed"></i>' + o.lbl + " " + esc(String(o.r.date).slice(o.lbl === "1Y AGO" ? 0 : 5)) + "</span>").join("") + "</div>";
  /* the two spreads: now, the move since the day before, the same spread a week / a month / a year ago, and its year */
  const sp = (r, a, b) => (r && num(r[a]) != null && num(r[b]) != null ? r[a] - r[b] : null);
  const year = rows.slice(0, 252).reverse();
  const tile = (name, a, b, say) => {
    const now = sp(t0, a, b), was = sp(t1, a, b), chg = now != null && was != null ? (now - was) * 100 : null, tone = hm2Tone(chg);
    return '<div class="hm2-sp" title="' + esc(say) + '"><div class="hm2-sp__h"><b>' + name + '</b><span class="hm2-sp__v ' + tone + '">' + hm2Sign(now) + "</span>" +
      '<span class="hm2-sp__c ' + tone + '">' + (chg == null ? "" : hm2Sign(chg, 0) + " bp today") + "</span>" +
      (now != null && now < 0 ? '<span class="hm2-sp__inv">INVERTED</span>' : "") + "</div>" +
      hm2Spark(year.map((r) => sp(r, a, b)), tone, 150, 28) +
      '<div class="hm2-sp__o">' + olds.map((o) => '<span style="color:' + o.col + '">' + o.lbl.replace(" AGO", "") + " " + hm2Sign(sp(o.r, a, b)) + "</span>").join("") + "</div></div>";
  };
  const cols = [["3M","m3"],["2Y","y2"],["5Y","y5"],["10Y","y10"],["30Y","y30"]];
  const cell = (r, k, prev) => { const v = num(r[k]); const tone = prev && num(prev[k]) != null && v != null ? hm2Tone(v - prev[k]) : ""; return '<td class="' + tone + '">' + hm2Fix(v) + "</td>"; };
  const tbl = '<table class="hm2-ytbl"><tr><th></th>' + cols.map((c) => "<th>" + c[0] + "</th>").join("") + "</tr>" +
    "<tr><th>TODAY</th>" + cols.map((c) => cell(t0, c[1], t1)).join("") + "</tr>" +
    olds.map((o) => '<tr><th style="color:' + o.col + '">' + o.lbl.replace(" AGO", "") + "</th>" + cols.map((c) => "<td>" + hm2Fix(num(o.r[c[1]])) + "</td>").join("") + "</tr>").join("") + "</table>";
  return svg + legend + '<div class="hm2-sps">' + tile("2s10s", "y10", "y2", "the 10-year yield minus the 2-year, in percentage points; above zero the curve slopes up") +
    tile("3m10y", "y10", "m3", "the 10-year yield minus the 3-month bill, in percentage points") + "</div>" + tbl;
}
async function hm2CurveFill() {
  const host = hm2Host("hm2Curve"); if (!host || !HM2_ON) return;
  try {
    const rows = await pg("treasury_rates?select=*&order=date.desc&limit=270");
    if (hm2Host("hm2Curve") !== host) return;
    /* a year back must be inside the read; if a short table cannot reach it, the 1Y line is simply not drawn */
    host.innerHTML = hm2CurveHTML(rows || [], host.clientWidth);
    const h = hm2Host("hm2CurveAsOf"); if (h && rows && rows[0]) h.textContent = "as of " + rows[0].date;
  } catch (_) { host.innerHTML = '<div class="sc-senttxt">the curve could not be read</div>'; }
}

/* ---- 3 · TREASURY AUCTIONS ------------------------------------------------------------------------
   What an auction tells you, in the three numbers the desks watch: where it stopped (the high yield), how much was
   bid for every dollar sold (bid-to-cover), and who was left holding it (indirect = mostly foreign and funds,
   direct = domestic funds bidding themselves, dealers = the banks who must take what nobody else wanted).
   Each is printed against the average of the SIX auctions of the same term before it. Green = more demand than
   usual (higher cover, higher indirect, lower dealer share), red = less. The tail — the stop against the yield the
   new issue traded at one minute before the deadline — is NOT printed: no free source carries that yield. */
const HM2_TERMS = ["2-Year","3-Year","5-Year","7-Year","10-Year","20-Year","30-Year"];
const hm2Bn = (v) => (v == null ? "—" : "$" + (v / 1e9).toFixed(v / 1e9 >= 100 || Math.abs(v / 1e9 - Math.round(v / 1e9)) < 0.05 ? 0 : 1) + "B");
const hm2Md = (iso) => (iso ? HM2_MON[+iso.slice(5, 7) - 1].toUpperCase() + " " + (+iso.slice(8, 10)) : "—");
function hm2AucVsSix(rows, row) {
  const prior = rows.filter((x) => x.term === row.term && x.status === "auctioned" && x.auction_date < row.auction_date).slice(0, 6);
  const avg = (k) => { const v = prior.map((x) => num(x[k])).filter((x) => x != null && isFinite(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  return { n: prior.length, prior, btc: avg("bid_to_cover"), ind: avg("indirect_pct"), dir: avg("direct_pct"), dlr: avg("dealer_pct") };
}
/* six small bars (oldest left) and this auction's own bar at the right end, on one scale */
function hm2AucBars(prior, row, k, better) {
  const seq = prior.slice().reverse().concat([row]), v = seq.map((x) => num(x[k])).filter((x) => x != null && isFinite(x));
  if (v.length < 2) return "";
  const lo = Math.min.apply(null, v), hi = Math.max.apply(null, v), span = hi - lo || 1;
  const avg = prior.length ? prior.map((x) => num(x[k])).filter((x) => x != null).reduce((a, b) => a + b, 0) / prior.length : null;
  return '<span class="hm2-ab">' + seq.map((x, i) => {
    const val = num(x[k]); if (val == null) return "";
    const h = 4 + Math.round((val - lo) / span * 12), last = i === seq.length - 1;
    const tone = avg == null || val === avg ? "" : ((val > avg) === (better > 0) ? "up" : "dn");
    return '<i class="' + tone + (last ? " is-now" : "") + '" style="height:' + h + 'px" title="' + esc(hm2Md(x.auction_date) + " " + x.auction_date.slice(0, 4) + " · " + (+val).toFixed(k === "bid_to_cover" ? 2 : 1)) + '"></i>';
  }).join("") + "</span>";
}
function hm2AucVs(val, avg, better, d, unit) {
  if (val == null || avg == null) return '<span class="hm2-avs">—</span>';
  const diff = val - avg, tone = Math.abs(diff) < 1e-9 ? "" : ((diff > 0) === (better > 0) ? "up" : "dn");
  return '<span class="hm2-avs ' + tone + '" title="' + esc("the six auctions of this term before it averaged " + avg.toFixed(d) + unit) + '">' + hm2Sign(diff, d) + " vs 6</span>";
}
function hm2AuctionsHTML(rows) {
  const today = ecToday();
  const done = rows.filter((r) => r.status === "auctioned"), coming = rows.filter((r) => r.status === "announced" && r.auction_date >= today)
    .sort((a, b) => (a.auction_date < b.auction_date ? -1 : 1));
  if (!done.length && !coming.length) return '<div class="sc-senttxt">no auctions stored yet</div>';
  const head = done[0];
  let html = "";
  if (head) {
    const c = hm2AucVsSix(done, head), isToday = head.auction_date === today;
    const stat = (lbl, val, avg, better, d, unit, k) => '<div class="hm2-as"><span class="hm2-as__l">' + lbl + "</span><b>" + (val == null ? "—" : (+val).toFixed(d) + unit) + "</b>" +
      hm2AucVs(num(val), avg, better, d, unit) + hm2AucBars(c.prior, head, k, better) + "</div>";
    html += '<div class="hm2-ah"><div class="hm2-ah__t"><b>' + esc(head.term.replace("-Year", "Y")) + (head.reopening ? " · REOPENING" : "") + "</b><span>" +
        esc(hm2Bn(num(head.offering_amount))) + " · " + (isToday ? "TODAY" : hm2Md(head.auction_date)) + " " + esc(String(head.closing_time_et || "").replace(/^0/, "")) + ' ET</span></div>' +
      '<div class="hm2-ah__y" title="' + esc("the stop: the highest yield Treasury had to accept to sell it all · the median accepted bid was " + hm2Fix(num(head.median_yield), 3) + "%") + '"><span class="hm2-as__l">STOPPED AT</span><b>' + hm2Fix(num(head.high_yield), 3) + "%</b></div>" +
      '<div class="hm2-ass">' + stat("BID-TO-COVER", num(head.bid_to_cover), c.btc, 1, 2, "×", "bid_to_cover") +
        stat("INDIRECT", num(head.indirect_pct), c.ind, 1, 1, "%", "indirect_pct") +
        stat("DIRECT", num(head.direct_pct), c.dir, 1, 1, "%", "direct_pct") +
        stat("DEALERS", num(head.dealer_pct), c.dlr, -1, 1, "%", "dealer_pct") + "</div></div>";
  }
  /* the newest result of every term, one line each */
  const lines = HM2_TERMS.map((t) => done.find((r) => r.term === t)).filter(Boolean).map((r) => {
    const c = hm2AucVsSix(done, r);
    const td = (val, avg, better, d) => { const v = num(val); const tone = v == null || avg == null || v === avg ? "" : ((v > avg) === (better > 0) ? "up" : "dn"); return '<td class="' + tone + '" title="' + esc(avg == null ? "" : "six before it averaged " + avg.toFixed(d)) + '">' + (v == null ? "—" : v.toFixed(d)) + "</td>"; };
    return "<tr><th>" + esc(r.term.replace("-Year", "Y")) + (r.reopening ? "<i>r</i>" : "") + "</th><td>" + hm2Md(r.auction_date) + "</td><td>" + esc(hm2Bn(num(r.offering_amount))) + "</td><td>" + hm2Fix(num(r.high_yield), 3) + "</td>" +
      td(r.bid_to_cover, c.btc, 1, 2) + td(r.indirect_pct, c.ind, 1, 0) + td(r.direct_pct, c.dir, 1, 0) + td(r.dealer_pct, c.dlr, -1, 0) + "</tr>";
  }).join("");
  html += '<table class="hm2-atbl"><tr><th>TERM</th><th>DATE</th><th>SIZE</th><th>STOP %</th><th>COVER</th><th>IND %</th><th>DIR %</th><th>DLR %</th></tr>' + lines + "</table>";
  html += '<div class="hm2-aup"><span class="hm2-as__l">COMING</span>' + (coming.length ? coming.map((r) => {
    const days = Math.round((ecAnchor(r.auction_date) - ecAnchor(today)) / 86400);
    return '<span class="hm2-aup__i"><b>' + esc(r.term.replace("-Year", "Y")) + (r.reopening ? " reopening" : "") + "</b> " + esc(hm2Bn(num(r.offering_amount))) + " · " +
      (days === 0 ? "today" : days === 1 ? "tomorrow" : hm2Md(r.auction_date)) + " " + esc(String(r.closing_time_et || "").replace(/^0/, "")) + " ET</span>";
  }).join("") : '<span class="hm2-aup__i">nothing announced yet — Treasury names the size about a week ahead</span>') + "</div>";
  return html;
}
async function hm2AuctionsFill() {
  const host = hm2Host("hm2Auctions"); if (!host || !HM2_ON) return;
  try {
    const rows = await pg("treasury_auctions?select=cusip,auction_date,term,reopening,closing_time_et,offering_amount,high_yield,median_yield,bid_to_cover,indirect_pct,direct_pct,dealer_pct,status&order=auction_date.desc&limit=160", 1);
    if (hm2Host("hm2Auctions") !== host) return;
    host.innerHTML = hm2AuctionsHTML(rows || []);
  } catch (_) { host.innerHTML = '<div class="sc-senttxt">auction results are not stored yet</div>'; }
}

/* ---- 4 · MACRO PRINTS, WITH THEIR HISTORY -----------------------------------------------------------
   One strip per indicator: every stored print that came with a consensus, oldest on the left. A bar above the
   line and green = better than expected; below and red = worse; its height is how big the miss was against that
   indicator's own largest. "Better" is the room's one rule (EC_INVERT): hotter inflation or more people out of
   work than expected is worse, everything else stronger is better. A print exactly on consensus is the room's own
   yellow dot on the line. The newest print's numbers stand at the right. */
const HM2_STRIPS = ["Non Farm Payrolls", "Unemployment Rate", "Initial Jobless Claims", "JOLTs Job Openings",
  "Inflation Rate YoY", "Core Inflation Rate MoM", "Core PCE Price Index MoM", "Producer Price Index MoM",
  "Retail Sales MoM", "Durable Goods Orders MoM", "ISM Manufacturing PMI", "ISM Services PMI", "GDP Growth Rate QoQ",
  "Michigan Consumer Sentiment", "Industrial Production MoM", "Housing Starts", "Total Vehicle Sales", "Fed Interest Rate Decision"];
const HM2_STRIP_LBL = { "Non Farm Payrolls": "PAYROLLS", "Unemployment Rate": "UNEMPLOYMENT", "Initial Jobless Claims": "JOBLESS CLAIMS",
  "JOLTs Job Openings": "JOB OPENINGS", "Inflation Rate YoY": "CPI YOY", "Core Inflation Rate MoM": "CORE CPI MOM",
  "Core PCE Price Index MoM": "CORE PCE MOM", "Producer Price Index MoM": "PPI MOM", "Retail Sales MoM": "RETAIL SALES",
  "Durable Goods Orders MoM": "DURABLE GOODS", "ISM Manufacturing PMI": "ISM MANUFACTURING", "ISM Services PMI": "ISM SERVICES",
  "GDP Growth Rate QoQ": "GDP QOQ", "Michigan Consumer Sentiment": "MICHIGAN SENTIMENT", "Industrial Production MoM": "INDUSTRIAL PROD",
  "Housing Starts": "HOUSING STARTS", "Total Vehicle Sales": "VEHICLE SALES", "Fed Interest Rate Decision": "FED DECISION" };
function hm2StripRows(all) {
  const by = {};
  for (const raw of all || []) {
    const r = typeof ecNormalize === "function" ? ecNormalize(Object.assign({}, raw)) : raw;
    const base = ecBase(r.event);
    if (HM2_STRIPS.indexOf(base) < 0 || num(r.actual) == null || num(r.estimate) == null) continue;
    (by[base] || (by[base] = [])).push(r);
  }
  for (const k in by) by[k].sort((a, b) => +a.event_ts - +b.event_ts);
  return by;
}
function hm2StripHTML(base, rows) {
  const inv = EC_INVERT.test(base) ? -1 : 1;
  const pts = rows.map((r) => ({ r, s: (r.actual - r.estimate) * inv }));
  const max = Math.max.apply(null, pts.map((p) => Math.abs(p.s))) || 1;
  const last = pts[pts.length - 1], better = pts.filter((p) => p.s > 0).length, worse = pts.filter((p) => p.s < 0).length;
  const bars = pts.map((p) => {
    const day = ecDateKey(+p.r.event_ts), per = ecPeriod(p.r.event);
    const ttl = hm2Md(day) + " " + day.slice(0, 4) + (per ? " (" + per + ")" : "") + " · actual " + p.r.actual + " · expected " + p.r.estimate +
      (p.r.previous != null ? " · before " + p.r.previous : "") + " · " + (p.s > 0 ? "better than expected" : p.s < 0 ? "worse than expected" : "on consensus");
    if (!p.s) return '<i class="eq" style="margin-top:13px" title="' + esc(ttl) + '"></i>';
    const h = Math.max(2, Math.round(Math.abs(p.s) / max * 13));           /* the line is at 15 px: up bars end on it, down bars start on it */
    return '<i class="' + (p.s > 0 ? "up" : "dn") + '" style="height:' + h + "px;margin-top:" + (p.s > 0 ? 15 - h : 15) + 'px" title="' + esc(ttl) + '"></i>';
  }).join("");
  const tone = last.s > 0 ? "is-up" : last.s < 0 ? "is-dn" : "is-eq";
  return '<div class="hm2-st" data-hm2="strip" data-day="' + ecDateKey(+last.r.event_ts) + '" title="' + esc(base + " · " + rows.length + " prints with a consensus since " + hm2Md(ecDateKey(+rows[0].event_ts)) + " " + ecDateKey(+rows[0].event_ts).slice(0, 4) + " · " + better + " better, " + worse + " worse · click to open the newest in the calendar") + '">' +
    '<span class="hm2-st__l">' + esc(HM2_STRIP_LBL[base] || base) + "</span>" +
    '<span class="hm2-st__b"><span class="hm2-st__s">' + bars + "</span></span>" +
    '<span class="hm2-st__v ' + tone + '"><b>' + esc(String(last.r.actual)) + "</b> vs " + esc(String(last.r.estimate)) + "</span></div>";
}
async function hm2StripsFill() {
  const host = hm2Host("hm2Strips"); if (!host || !HM2_ON) return;
  try {
    /* THE STRIPS' ONE READ, and the page's third calendar read (after the room's window read and the click-only
       history behind a landed number): the eighteen named families only, both numbers present — about 900 rows in
       one page — instead of the whole US calendar through the window reader (9,000 rows, ten pages). It is behind
       HM2_ON, never the tape's switch, and it runs once per room mount. */
    const names = HM2_STRIPS.map((n) => "event.ilike." + encodeURIComponent(n.replace(/[(),]/g, " ") + "*")).join(",");
    let all = [], after = "";
    const seen = new Set();
    for (let n = 0; n < 4; n++) {
      const page = await pg("econ_calendar?select=event_ts,country,event,actual,estimate,previous,impact&country=eq.US&actual=not.is.null&estimate=not.is.null&or=(" + names + ")" +
        (after ? "&event_ts=gte." + after : "") + "&order=event_ts.asc,event.asc&limit=1000");
      if (!page || !page.length) break;
      for (const r of page) { const k = r.event_ts + "|" + r.event; if (!seen.has(k)) { seen.add(k); all.push(r); } }   /* payrolls and unemployment share a minute: gte + this set never drops one at a page edge */
      after = page[page.length - 1].event_ts;
      if (page.length < 1000) break;
    }
    if (hm2Host("hm2Strips") !== host) return;
    const by = hm2StripRows(all), have = HM2_STRIPS.filter((b) => by[b] && by[b].length >= 2);
    if (!have.length) { host.innerHTML = '<div class="sc-senttxt">no print with a consensus is stored yet</div>'; return; }
    const first = Math.min.apply(null, have.map((b) => +by[b][0].event_ts));
    host.innerHTML = have.map((b) => hm2StripHTML(b, by[b])).join("");
    host.querySelectorAll(".hm2-st__b").forEach((b) => { b.scrollLeft = b.scrollWidth; });
    const h = hm2Host("hm2StripsSince"); if (h) h.textContent = "since " + HM2_MON[+ecDateKey(first).slice(5, 7) - 1].toUpperCase() + " " + ecDateKey(first).slice(0, 4);
  } catch (_) { host.innerHTML = '<div class="sc-senttxt">the prints could not be read</div>'; }
}

/* ---- 5 · THE PUT / CALL TAPE ------------------------------------------------------------------------
   The ratio is two things, so it is shown as two things. For each name:
     C  calls traded so far today ÷ the calls it has usually traded by this time of day   (green)
     P  puts  traded so far today ÷ the puts  it has usually traded by this time of day   (red)
     then the ratio itself and how far it stands from its own usual — which is exactly P ÷ C.
   So "P/C 1.6× usual" with C 0.6× and P 1.0× says: the ratio rose because calls dried up, not because puts came in.
   A name FLASHES (the Hub's one primitive, scScint) while its ratio is at 1.5× its own usual or more. A name too
   thinly traded to mean anything (usually under 2,000 contracts by this time of day) is shown and never flashes.
   Names: SPY, QQQ, then FAVORITES and RADAR. Read once a minute from putcall_names_now. */
let HM2_PC = { rows: null, at: 0, timer: null, flashAt: {}, sig: "", names: null };
const hm2X = (v) => (v == null || !isFinite(+v) ? "—" : (+v >= 10 ? (+v).toFixed(0) : (+v).toFixed(1)) + "×");
function hm2PcBars(r) {
  /* two bars on one scale, 0 to 3× the usual day; the upright line is 1×, the usual day itself */
  const w = (x) => Math.max(1, Math.round(Math.min(3, +x || 0) / 3 * 30));
  return '<svg class="hm2-pcb" viewBox="0 0 32 12" width="32" height="12" aria-hidden="true">' +
    '<rect class="t" x="1" y="1" width="30" height="4"/><rect class="t" x="1" y="7" width="30" height="4"/>' +
    '<rect class="c" x="1" y="1" width="' + w(r.calls_x) + '" height="4"/><rect class="p" x="1" y="7" width="' + w(r.puts_x) + '" height="4"/>' +
    '<line class="u" x1="11" x2="11" y1="0" y2="12"/></svg>';
}
function hm2PcItemHTML(r) {
  const rx = num(r.ratio_x), hot = !r.thin && rx != null && rx >= HM2_PC_FLASH_X;
  const tip = r.ticker + " · calls " + Math.round(r.call_vol).toLocaleString("en-US") + " (usually " + Math.round(r.usual_call_vol).toLocaleString("en-US") + " by now) · puts " +
    Math.round(r.put_vol).toLocaleString("en-US") + " (usually " + Math.round(r.usual_put_vol).toLocaleString("en-US") + ") · put/call " + hm2Fix(num(r.put_call)) + " against its usual " + hm2Fix(num(r.usual_put_call)) +
    " · usual = the average of its last " + r.usual_sessions + " sessions at this time of day" + (r.thin ? " · thinly traded: never flashes" : "");
  return '<button class="sc-ss__it hm2-pc' + (hot ? " is-hot" : "") + (r.thin ? " is-thin" : "") + '" data-hm2="pc" data-t="' + esc(r.ticker) + '" title="' + esc(tip) + '">' +
    '<b class="sc-ss__tk">' + esc(r.ticker) + "</b>" + hm2PcBars(r) +
    '<span class="hm2-pc__c">C ' + hm2X(num(r.calls_x)) + '</span><span class="hm2-pc__p">P ' + hm2X(num(r.puts_x)) + "</span>" +
    '<span class="hm2-pc__r ' + (rx == null || rx === 1 ? "" : rx > 1 ? "dn" : "up") + '">P/C ' + hm2Fix(num(r.put_call)) + " · " + hm2X(rx) + "</span></button>";
}
function hm2PcOrder(rows, names) {
  const want = names && names.size ? rows.filter((r) => names.has(r.ticker)) : rows;
  const lead = ["SPY", "QQQ"].map((t) => want.find((r) => r.ticker === t)).filter(Boolean);
  const rest = want.filter((r) => r.ticker !== "SPY" && r.ticker !== "QQQ").sort((a, b) => (b.thin ? -1 : +b.ratio_x) - (a.thin ? -1 : +a.ratio_x));
  return lead.concat(rest);
}
function hm2PcHTML(rows) {
  const hot = rows.filter((r) => !r.thin && num(r.ratio_x) >= HM2_PC_FLASH_X).length, seg = rows.map(hm2PcItemHTML).join("");
  const at = rows[0] ? String(rows[0].hhmm || "") + " ET" : "";
  const note = "calls and puts so far today, each against what the name has usually traded by this time of day; P/C× is the ratio against its own usual and equals P ÷ C · a name flashes at " +
    HM2_PC_FLASH_X + "× · IBKR volumes, read every 15 minutes, as of " + at;
  return '<div class="sc-ss sc-ss--one sc-ss--tape hm2-pcbox" title="' + esc(note) + '"><span class="sc-ss__lbl">PUT / CALL</span>' +
    '<span class="sc-ss__n" title="' + esc("names at " + HM2_PC_FLASH_X + "× their usual ratio or more") + '">' + hot + "</span>" +
    '<span class="sc-ss__coh">' + esc(at) + "</span>" +
    '<div class="sc-tape__win"><span class="sc-tape__track">' + seg + seg + "</span></div></div>";
}
async function hm2PcNames() {
  if (HM2_PC.names) return HM2_PC.names;
  const s = new Set(["SPY", "QQQ"]);
  try { (await pg("station_lists?select=ticker,list&list=in.(favorites,radar)&limit=600", 1)).forEach((r) => s.add(r.ticker)); } catch (_) {}
  HM2_PC.names = s; return s;
}
async function hm2PcFill() {
  const host = hm2Host("hm2PcStrip"); if (!host || !HM2_ON || !HM2_PC_ON) return;
  let rows;
  try { rows = await pg("putcall_names_now?select=*&limit=1000", 1); } catch (_) { host.innerHTML = ""; return; }   /* not stored yet: the strip is absent, the dashboard is as it was */
  if (hm2Host("hm2PcStrip") !== host) return;
  const list = hm2PcOrder(rows || [], await hm2PcNames());
  if (hm2Host("hm2PcStrip") !== host) return;
  HM2_PC.rows = list; HM2_PC.at = Date.now();
  if (!list.length) { host.innerHTML = ""; return; }
  const sig = list.map((r) => r.ticker + ":" + r.calls_x + ":" + r.puts_x).join(",");
  if (sig !== HM2_PC.sig || host.innerHTML === "") {
    HM2_PC.sig = sig; host.innerHTML = hm2PcHTML(list);
    const track = host.querySelector(".sc-tape__track");
    if (track && typeof tapeSpeed === "function") tapeSpeed(track);
  }
  hm2PcFlash();
}
/* the flash: every name at 1.5× or more glows on the tape's own clock, never a second animation */
function hm2PcFlash() {
  const host = hm2Host("hm2PcStrip"); if (!host || typeof scScint !== "function") return 0;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return 0;
  const now = Date.now(); let n = 0;
  host.querySelectorAll(".hm2-pc.is-hot").forEach((node) => {
    const k = node.dataset.t + "|" + (node.parentNode && node.parentNode.firstChild === node ? "a" : "") + node.offsetLeft;
    if (HM2_PC.flashAt[k] && now - HM2_PC.flashAt[k] < HM2_PC_FLASH_MS) return;
    HM2_PC.flashAt[k] = now; scScint(node.querySelector(".sc-ss__tk"), false); n++;
  });
  return n;
}
function hm2PcArm() {
  if (HM2_PC.timer != null || typeof setInterval !== "function") return;
  HM2_PC.timer = setInterval(() => {
    if (!hm2Host("hm2PcStrip")) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    if (Date.now() - HM2_PC.at >= HM2_PC_REFRESH_MS) hm2PcFill(); else hm2PcFlash();
  }, 2000);
}

/* ---- the rail's two new cards, the room mount and the clicks ---------------------------------------- */
function hm2RailCardsHTML() {
  return '<div class="card hm2-card"><h4>TREASURY CURVE <i class="ec-li-note" id="hm2CurveAsOf"></i></h4><div id="hm2Curve"><div class="sc-senttxt">—</div></div></div>' +
    '<div class="card hm2-card"><h4>TREASURY AUCTIONS <i class="ec-li-note">each against the six before it</i></h4><div id="hm2Auctions"><div class="sc-senttxt">—</div></div></div>' +
    '<div class="card hm2-card"><h4>MACRO PRINTS · SURPRISES <i class="ec-li-note" id="hm2StripsSince"></i></h4><div id="hm2Strips"><div class="sc-senttxt">—</div></div></div>';
}
const HM2_SPECS = '<details class="sc-pagespecs hm2-specs"><summary>PAGE SPECS</summary><div>' +
  "<p><b>The slider.</b> One bar is a day, a week or a month of releases that pass the region tab, the category chip and HIGH ONLY. Height is how many; colour is the load (cyan: no high-importance release, orange: one to four, red: five or more, which is about one day in eight — a week is ranked against the busiest week on the slider). A star marks the Fed’s decision, payrolls, CPI, core PCE or GDP. Click a bar to open it below.</p>" +
  "<p><b>Treasury curve.</b> treasury_rates (Treasury’s daily par yields). Today’s line is green when the 10-year closed above the day before and red when below; the week-, month- and year-ago curves are the stored curve nearest to that date. 2s10s = 10-year minus 2-year; 3m10y = 10-year minus 3-month; each with its last 252 sessions.</p>" +
  "<p><b>Treasury auctions.</b> An r beside a term is a reopening: more of a bond that already trades. TreasuryDirect’s own results, a few minutes after the 1:00 PM New York deadline. STOPPED AT is the highest yield accepted. COVER is dollars bid per dollar sold. INDIRECT, DIRECT and DEALERS are each bidder class’s share of what competitive bidders were awarded. Each is compared with the average of the six auctions of the same term before it: green is more demand than usual, red less (for DEALERS a smaller share is the stronger auction). The tail is not shown: it needs the yield the new issue traded at one minute before the deadline, and no free source carries it.</p>" +
  "<p><b>Macro prints.</b> econ_calendar (FMP’s economic calendar), every US print stored with a consensus, oldest on the left. Up and green is better than expected, down and red is worse; for inflation, unemployment and jobless claims a lower number is the better one. A yellow dot is a print exactly on consensus. Indicators nobody forecasts (money supply, the Fed’s balance sheet, mortgage rates) have no strip.</p>" +
  "</div></details>";
/* called beside the room's mount and NOT awaited by it: the calendar and the rail are ready exactly when they were */
function hm2Mount() {
  if (!HM2_ON) return;
  try { hm2EcTapePaint(); } catch (_) {}
  Promise.all([hm2CurveFill(), hm2AuctionsFill(), hm2StripsFill()]).catch(() => {});
}
if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
  document.addEventListener("click", (e) => {
    const a = e.target && e.target.closest ? e.target.closest("[data-hm2]") : null;
    if (!a || !HM2_ON) return;
    const k = a.dataset.hm2;
    if (k === "bar") { if (HM2_TL.moved) { HM2_TL.moved = false; return; } hm2TlOpen(a.dataset.d); }
    else if (k === "zoom") { if (HM2_ZOOM[a.dataset.z] && a.dataset.z !== HM2_TL.z) { HM2_TL.z = a.dataset.z; hm2EcTapePaint(); } }
    else if (k === "now") { const sc = hm2Host("hm2TlScroll"); if (sc) hm2TlToToday(sc, true); }
    else if (k === "strip") { S.econDay = a.dataset.day; S.econSpan = "DAY"; S.econCty = "US"; S.econCat = "ALL"; S.econOpen = {}; S.econFocus = null;
      document.querySelectorAll('.ec-span .ec-sp[data-act="ecspan"]').forEach((x) => x.classList.toggle("on", x.dataset.s === S.econSpan)); ecLoadWindow(); }
    else if (k === "pc") { if (typeof openCo === "function") openCo(a.dataset.t); }
  });
}
/* ==== END HM2 ============================================================== */

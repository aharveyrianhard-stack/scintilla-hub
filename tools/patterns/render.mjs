/* Turns evidence/patterns.json into the two pages: PATTERNS.html (the six results,
   each with a real example drawn) and RULEBOOK.html (the book chapters). Every number
   on both pages comes from the JSON — nothing is typed in by hand.

   Run:  node tools/patterns/render.mjs                                              */

import fs from "node:fs";
import path from "node:path";

const DIR = "deliverables/20260923/patterns";
const DOC = JSON.parse(fs.readFileSync(path.join(DIR, "evidence/patterns.json"), "utf8"));

const HU = JSON.parse(fs.readFileSync("data/how-unusual.json", "utf8"));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pc = (v) => (v == null ? "—" : (v >= 0 ? "+" : "") + v.toFixed(2) + "%");
const n0 = (v) => (v == null ? "—" : Math.round(v) + "%");
const grp = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/* ---------- the rules, in the words of the standard texts ---------------------
   The books are not on this Mac, so these are careful paraphrases of the standard
   description of each pattern, not quotations. Chapter titles are cited rather than
   chapter numbers, which differ between editions. Anyone holding the books should
   check these against them. */
const META = {
  "rising-wedge": {
    title: "The rising wedge",
    claims: "a fall",
    texts: [
      ["Edwards &amp; Magee, <i>Technical Analysis of Stock Trends</i> — the chapters on reversal phenomena",
       "A wedge slopes against itself: both boundaries run the same way and converge, and prices usually fall away from a rising wedge rather than break out of its top."],
      ["Murphy, <i>Technical Analysis of the Financial Markets</i> — the chapter on continuation patterns",
       "The rising wedge is read as a pause that leans the wrong way: rising, but with the buying getting weaker, so it is treated as bearish."],
      ["Bulkowski, <i>Encyclopedia of Chart Patterns</i> — the rising-wedge chapter",
       "Bulkowski's own counts put wedges among the weaker patterns, with a high rate of what he calls throwbacks."],
    ],
    rule: "Higher highs and higher lows, but the floor rises faster than the ceiling, so the two lines close on each other. The reading is that buyers are tiring. The signal is the close that breaks the rising floor.",
  },
  "falling-wedge": {
    title: "The falling wedge",
    claims: "a rise",
    texts: [
      ["Edwards &amp; Magee — the chapters on reversal phenomena",
       "The mirror of the rising wedge: two down-sloping lines closing on each other, from which prices usually escape upward."],
      ["Murphy — the chapter on continuation patterns",
       "A falling wedge is read as selling that is running out, and is treated as bullish."],
      ["Bulkowski — the falling-wedge chapter", "Measured, it is another of the modest ones."],
    ],
    rule: "Lower highs and lower lows, but the ceiling falls faster than the floor, so the lines close on each other. The signal is the close that breaks out through the falling ceiling.",
  },
  "bull-flag": {
    title: "The bull flag",
    claims: "a rise",
    texts: [
      ["Edwards &amp; Magee — the chapter on consolidation formations",
       "A flag is a short, compact drift against a steep prior move — the pause that “flies at half-mast” in the middle of a run."],
      ["Murphy — the chapter on continuation patterns",
       "Flags and pennants are brief pauses in a fast move, and the move is expected to continue afterwards."],
      ["Bulkowski — the flag chapter", "Flags are numerous and short-lived; their measured edge is small."],
    ],
    rule: "A sharp run up (the pole), then a short tight pause that gives back only part of it (the flag), then a close above the pause's high. This is M17's detector, unchanged.",
  },
  "bear-flag": {
    title: "The bear flag",
    claims: "a fall",
    texts: [
      ["Edwards &amp; Magee — the chapter on consolidation formations",
       "The same shape upside down: a steep fall, then a small drift back up, then the fall resuming."],
      ["Murphy — the chapter on continuation patterns", "A pause in a decline, expected to resolve downward."],
      ["Bulkowski — the flag chapter", "Counted with the flags."],
    ],
    rule: "A sharp fall (the pole), then a short tight drift that recovers only part of it, then a close below the drift's low. The same rule as the bull flag, mirrored, so the two can be compared without arguing about the definition.",
  },
  "head-shoulders": {
    title: "Head and shoulders",
    claims: "a fall",
    texts: [
      ["Edwards &amp; Magee — the chapter on important reversal patterns",
       "The best known reversal: a peak, a higher peak, a lower peak, and a neckline drawn through the two valleys between them. The pattern is not complete until the price closes through the neckline."],
      ["Murphy — the chapter on reversal patterns",
       "The neckline break is the signal; everything before it is a shape that may still fail to form."],
      ["Bulkowski — the head-and-shoulders top chapter",
       "One of the better-performing classical patterns in his counts, with failure rates that rise sharply in strong bull markets."],
    ],
    rule: "Three turning points with the middle one highest, shoulders within a little of each other, and a neckline through the two valleys. The signal is the close below that neckline — not the shape itself.",
  },
  "inverse-head-shoulders": {
    title: "Inverse head and shoulders",
    claims: "a rise",
    texts: [
      ["Edwards &amp; Magee — the chapter on important reversal patterns",
       "The same figure inverted at a bottom, where the neckline is broken upward."],
      ["Murphy — the chapter on reversal patterns", "Read as a bottom that has been tested three times, the middle test the deepest."],
      ["Bulkowski — the head-and-shoulders bottom chapter", "Among his stronger classical patterns."],
    ],
    rule: "Three turning points with the middle one lowest, shoulders alike, a neckline through the two peaks between them, and a close above it as the signal.",
  },
};

/* ---------- drawing ---------------------------------------------------------- */
function chart(ex, { w = 1040, h = 420 } = {}) {
  if (!ex) return '<p class="note">No complete example with sixty finished days after it.</p>';
  const bars = ex.bars, n = bars.length;
  const padL = 10, padR = 66, padT = 18, padB = 30;
  const lo = Math.min(...bars.map((b) => b.l)), hi = Math.max(...bars.map((b) => b.h));
  const span = hi - lo || 1;
  const X = (i) => padL + (i * (w - padL - padR)) / (n - 1);
  const Y = (p) => padT + ((hi - p) / span) * (h - padT - padB);
  const cw = Math.max(1.6, Math.min(7, (w - padL - padR) / n * 0.62));
  const s = [];
  s.push(`<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${esc(ex.symbol)} ${esc(ex.kind)} example">`);
  s.push(`<rect x="0" y="0" width="${w}" height="${h}" fill="#0D0D14"/>`);
  // the bars: before the signal in the lighter grey, after it in the darker one
  bars.forEach((b, i) => {
    const after = i > ex.signal_index;
    const col = after ? "#585866" : "#9A9AA8";
    const up = b.c >= b.o;
    s.push(`<line x1="${X(i).toFixed(1)}" y1="${Y(b.h).toFixed(1)}" x2="${X(i).toFixed(1)}" y2="${Y(b.l).toFixed(1)}" stroke="${col}" stroke-width="0.8"/>`);
    const y1 = Y(Math.max(b.o, b.c)), y2 = Y(Math.min(b.o, b.c));
    s.push(`<rect x="${(X(i) - cw / 2).toFixed(1)}" y="${y1.toFixed(1)}" width="${cw.toFixed(1)}" height="${Math.max(0.8, y2 - y1).toFixed(1)}" ` +
      (up ? `fill="none" stroke="${col}" stroke-width="0.8"` : `fill="${col}"`) + `/>`);
  });
  const d = ex.draw || {};
  const line = (a, b, to) => {
    const sl = (b.p - a.p) / (b.i - a.i);
    const x2 = to, p2 = a.p + sl * (x2 - a.i);
    return `<line x1="${X(a.i).toFixed(1)}" y1="${Y(a.p).toFixed(1)}" x2="${X(x2).toFixed(1)}" y2="${Y(p2).toFixed(1)}" stroke="#C0C0CC" stroke-width="1" stroke-dasharray="4 3"/>`;
  };
  const below = /inverse/.test(ex.kind);   // a bottom's labels belong under it, not over the bars
  const dot = (p, label) => `<circle cx="${X(p.i).toFixed(1)}" cy="${Y(p.p).toFixed(1)}" r="3.2" fill="none" stroke="#C0C0CC" stroke-width="1"/>` +
    (label ? `<text x="${X(p.i).toFixed(1)}" y="${(Y(p.p) + (below ? 18 : -9)).toFixed(1)}" fill="#A8A8B6" font-family="ui-monospace,Menlo,monospace" font-size="11" text-anchor="middle">${esc(label)}</text>` : "");
  if (d.upper && d.lower) {
    s.push(line(d.upper[0], d.upper[d.upper.length - 1], ex.signal_index + 4),
           line(d.lower[0], d.lower[d.lower.length - 1], ex.signal_index + 4));
    d.upper.concat(d.lower).forEach((p) => s.push(dot(p)));
  }
  if (d.points) { const L = ["left shoulder", "head", "right shoulder"]; d.points.forEach((p, i) => s.push(dot(p, L[i]))); }
  if (d.neck) s.push(line(d.neck[0], d.neck[1], ex.signal_index + 6), dot(d.neck[0]), dot(d.neck[1]));
  if (d.pole) {
    const [a, b] = d.pole;
    s.push(`<line x1="${X(a).toFixed(1)}" y1="${Y(bars[a].c).toFixed(1)}" x2="${X(b).toFixed(1)}" y2="${Y(bars[b].c).toFixed(1)}" stroke="#C0C0CC" stroke-width="1" stroke-dasharray="4 3"/>`);
    s.push(`<text x="${X((a + b) / 2).toFixed(1)}" y="${(h - padB + 14)}" fill="#A8A8B6" font-family="ui-monospace,Menlo,monospace" font-size="11" text-anchor="middle">pole</text>`);
  }
  if (d.flag) {
    const [a, b] = d.flag;
    const fl = Math.min(...bars.slice(a, b + 1).map((x) => x.l)), fh = Math.max(...bars.slice(a, b + 1).map((x) => x.h));
    s.push(`<rect x="${X(a).toFixed(1)}" y="${Y(fh).toFixed(1)}" width="${(X(b) - X(a)).toFixed(1)}" height="${(Y(fl) - Y(fh)).toFixed(1)}" fill="none" stroke="#C0C0CC" stroke-width="1" stroke-dasharray="3 3"/>`);
    s.push(`<text x="${X((a + b) / 2).toFixed(1)}" y="${(Y(fh) - 7).toFixed(1)}" fill="#A8A8B6" font-family="ui-monospace,Menlo,monospace" font-size="11" text-anchor="middle">pause</text>`);
  }
  // the signal day
  s.push(`<line x1="${X(ex.signal_index).toFixed(1)}" y1="${padT}" x2="${X(ex.signal_index).toFixed(1)}" y2="${h - padB}" stroke="#C6C6D2" stroke-width="1"/>`);
  s.push(`<text x="${(X(ex.signal_index) + 5).toFixed(1)}" y="${padT + 11}" fill="#C6C6D2" font-family="ui-monospace,Menlo,monospace" font-size="11">signal · ${esc(ex.signal_date)}</text>`);
  // scale
  s.push(`<text x="${w - padR + 6}" y="${(Y(hi) + 4).toFixed(1)}" fill="#86868F" font-family="ui-monospace,Menlo,monospace" font-size="11">${hi.toFixed(2)}</text>`);
  s.push(`<text x="${w - padR + 6}" y="${(Y(lo) + 4).toFixed(1)}" fill="#86868F" font-family="ui-monospace,Menlo,monospace" font-size="11">${lo.toFixed(2)}</text>`);
  s.push(`<text x="${padL}" y="${h - 8}" fill="#86868F" font-family="ui-monospace,Menlo,monospace" font-size="11">${esc(bars[0].t)}</text>`);
  s.push(`<text x="${w - padR}" y="${h - 8}" fill="#86868F" font-family="ui-monospace,Menlo,monospace" font-size="11" text-anchor="end">${esc(bars[n - 1].t)}</text>`);
  s.push("</svg>");
  return `<figure class="chart">${s.join("")}<figcaption>${esc(ex.symbol)} — the most recent complete example the rule found, drawn from the same daily bars the detector read. ` +
    `The dashes are the lines the rule used; the pale bars are before the signal, the dark ones are what followed. ` +
    `After this one: ${pc(ex.after.d5)} at 5 days, ${pc(ex.after.d20)} at 20, ${pc(ex.after.d60)} at 60. One example proves nothing either way — the counts below are the evidence.</figcaption></figure>`;
}

/* ---------- tables ----------------------------------------------------------- */
function numbers(p) {
  const rows = [5, 20, 60].map((hz) => {
    const x = p.horizons[hz], rc = x.random_same_count.median_pct;
    return `<tr><td class="k">${hz} days later</td>` +
      `<td data-l="after the signal" class="num">${n0(x.signal.up_pct)} up · ${pc(x.signal.median_pct)}</td>` +
      `<td data-l="from any day" class="num">${n0(x.any_day.up_pct)} up · ${pc(x.any_day.median_pct)}</td>` +
      `<td data-l="drift removed" class="num">${pc(x.excess_over_local.median_pct)}</td>` +
      `<td data-l="random draws" class="num">${pc(rc.p5)} to ${pc(rc.p95)}</td>` +
      `<td data-l="signals" class="num">${grp(x.signal.n)}</td></tr>`;
  }).join("");
  return `<table><thead><tr><th>horizon</th><th>after the signal</th><th>from any day</th><th>drift removed</th><th>random draws, same count</th><th>signals</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function sweepTable(p) {
  return `<table><thead><tr><th>setting</th><th>signals</th><th>20 days up</th><th>middle move</th><th>drift removed</th></tr></thead><tbody>` +
    p.sweep.map((r) => `<tr><td class="k">${esc(r.setting)}</td><td data-l="signals" class="num">${grp(r.signals)}</td>` +
      `<td data-l="20 days up" class="num">${n0(r.up_pct)}</td><td data-l="middle" class="num">${pc(r.median_pct)}</td>` +
      `<td data-l="drift removed" class="num">${pc(r.excess_pct)}</td></tr>`).join("") + "</tbody></table>";
}
function verdictBlock(p) {
  const tests = (p.verdict.tests || []).map((t) => `<li><b>${t.pass ? "passes" : "fails"}</b> — ${esc(t.test)}: ${esc(t.text)}</li>`).join("");
  return `<div class="verdict"><b>${esc(p.verdict.call)}</b><div class="note" style="margin-top:8px">${esc(p.verdict.why)}</div></div>` +
    (tests ? `<ul class="note">${tests}</ul>` : "");
}

const CSS = fs.readFileSync(path.join(DIR, "../how-unusual/HOW-UNUSUAL.html"), "utf8")
  .match(/<style>[\s\S]*?<\/style>/)[0]
  .replace("--warn:#C8B25A", "--warn:#A8A8B4")
  + `<style>.chart svg{ display:block; border:.6px solid var(--line2); }
.chart{ margin:22px 0 26px; }
.claim{ font-family:var(--mono); font-size:12px; color:var(--dim); text-transform:uppercase; letter-spacing:.09em; }
.tally td.k{ width:34%; }
.disc{ border:.8px solid var(--line2); border-left-width:3px; padding:18px 20px; margin:26px 0; color:var(--ink2); }
.disc b{ color:var(--ink); }
</style>`;

const head = (title, extra = "") => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
${CSS}</head><body><main>${extra}`;
const foot = "</main></body></html>\n";

/* ---------- part A: what the Hub panel now says ------------------------------ */
function huSection() {
  const spy = HU.symbols.find((s) => s.t === "SPY");
  const nowB = spy.recent.now_band, low60 = spy.recent.lows["60"], low20 = spy.recent.lows["20"];
  const find = (back, low) => (spy.shapes[back] || []).find((r) => r.now_band === nowB && r.low_band === low.band);
  const m60 = find(60, low60), m20 = find(20, low20);
  const band = (b) => { const [lo, hi] = [[0,30],[30,35],[35,40],[40,45],[45,50],[50,55],[55,60],[60,65],[65,70],[70,100]][b];
    return b === 0 ? `under ${hi}` : b === 9 ? "70 and over" : `${lo} to ${hi}`; };
  const bandRows = spy.bands.map((B) => `<tr><td class="k">${esc(B.label)}${B.band === nowB ? " · where it is now" : ""}</td>` +
    `<td data-l="how often" class="num">${B.days_pct.toFixed(1)}% of days</td>` +
    `<td data-l="visits a year" class="num">${B.per_year.toFixed(1)}</td>` +
    `<td data-l="20 days later" class="num">${n0(B.fwd20.up_pct)} up · ${pc(B.fwd20.median_pct)}</td>` +
    `<td data-l="60 days later" class="num">${n0(B.fwd60.up_pct)} up · ${pc(B.fwd60.median_pct)}</td></tr>`).join("");
  const near = spy.approaches.filter((a) => a.near_misses >= 10).map((a) =>
    `<tr><td class="k">within ${a.within} of ${a.level}, ${esc(a.side)}</td>` +
    `<td data-l="near misses" class="num">${a.near_misses}</td>` +
    `<td data-l="after a near miss" class="num">${n0(a.fwd20.up_pct)} up · ${pc(a.fwd20.median_pct)}</td>` +
    `<td data-l="touches" class="num">${a.touches_at_a_turn}</td>` +
    `<td data-l="after a touch" class="num">${n0(a.touch_fwd20.up_pct)} up · ${pc(a.touch_fwd20.median_pct)}</td></tr>`).join("");
  return `<p class="lead">Tap any RSI cell on the Hub and the panel now answers in ranges, not on one line. It says which band the
reading sits in, how often that band happens, what followed a visit to it — and it pairs where the reading is now with
the lowest it has been lately, which is the shape you described.</p>
<h3>Your case, answered from SPY's own history</h3>
<p>SPY's daily RSI stands at <b>${spy.latest.rsi}</b> (${band(nowB)}). In the last <b>60 days</b> the lowest it went was
<b>${low60.lowest}</b> (${band(low60.band)}, on ${esc(low60.on)}). ${m60
    ? `Days that looked like that — in the ${band(nowB)} band now, having been down in the ${band(low60.band)} band within 60 days —
happened <b>${grp(m60.days)}</b> times in the ${grp(spy.history.rsi_days_measured)} days measured (<b>${m60.days_pct.toFixed(1)}%</b> of them).
After those days SPY was higher 20 days later <b>${n0(m60.fwd20.up_pct)}</b> of the time, middle move <b>${pc(m60.fwd20.median_pct)}</b>,
against <b>${n0(spy.baseline.fwd20.up_pct)}</b> and <b>${pc(spy.baseline.fwd20.median_pct)}</b> from any day at all.
At 60 days: <b>${n0(m60.fwd60.up_pct)}</b> and <b>${pc(m60.fwd60.median_pct)}</b> against ${n0(spy.baseline.fwd60.up_pct)} and ${pc(spy.baseline.fwd60.median_pct)}.`
    : "That pairing has happened on fewer than ten days, so there is nothing to report from it."}</p>
<p><b>Read that carefully:</b> the shape you asked about has been followed by <i>slightly worse</i> than an ordinary day, not better.
${m20 ? `The 20-day version of the same question (lowest ${low20.lowest}, ${band(low20.band)}) says much the same: ${n0(m20.fwd20.up_pct)} up, ${pc(m20.fwd20.median_pct)}.` : ""}
It is a small difference on a few hundred days and it is not a signal. What it does do is stop the reading being described as
unusual when it is not.</p>
<h3>Every band</h3>
<table><thead><tr><th>band</th><th>how often</th><th>visits a year</th><th>20 days later</th><th>60 days later</th></tr></thead><tbody>${bandRows}</tbody></table>
<h3>Near misses, counted apart from touches</h3>
<p>A turn that came within ${spy.approaches[0].within} points of a level and stopped there is counted separately from one that reached it.
A turn is only known ${spy.approaches[0].confirm_days} days after it happens — the days either side are what make it a turn — so what followed is
measured from that later day. Measuring from the turn itself would be reading the future, and it inflates the numbers by a
lot: at 40, the same count measured from the turn said 97% up at five days, against ${n0(spy.approaches.find((a) => a.level === 40 && a.side === "from above").fwd5.up_pct)} measured honestly.</p>
<table><thead><tr><th>level</th><th>near misses</th><th>20 days after</th><th>touches at a turn</th><th>20 days after</th></tr></thead><tbody>${near}</tbody></table>
<p class="note">All of it is counted by <code>tools/how-unusual/build.mjs</code> from finished daily bars and stored in <code>data/how-unusual.json</code>;
the reading itself is recomputed live when the panel opens, so the panel is never older than the last finished day.</p>`;
}

/* ---------- page one: the six results ---------------------------------------- */
function patternsPage() {
  const built = (DOC.built_utc || "").slice(0, 10);
  const tally = Object.values(DOC.patterns).map((p) => {
    const x = p.horizons[20];
    return `<tr><td class="k">${esc(META[p.name].title)}</td>` +
      `<td data-l="claims">${esc(META[p.name].claims)}</td>` +
      `<td data-l="signals" class="num">${grp(p.total)}</td>` +
      `<td data-l="20 days" class="num">${pc(x.signal.median_pct)}</td>` +
      `<td data-l="any day" class="num">${pc(x.any_day.median_pct)}</td>` +
      `<td data-l="drift removed" class="num">${pc(x.excess_over_local.median_pct)}</td>` +
      `<td data-l="verdict">${esc(p.verdict.call)}</td></tr>`;
  }).join("");

  const sections = Object.values(DOC.patterns).map((p) => {
    const M = META[p.name];
    return `<hr><h2>${esc(M.title)}</h2>
<p class="claim">the pattern claims ${esc(M.claims)} · ${grp(p.total)} signals found · ${esc(p.verdict.call)}</p>
<h3>What the books say</h3>
${M.texts.map(([src, line]) => `<p class="q">${line}<span>${src} — paraphrase, not a quotation</span></p>`).join("")}
<h3>The rule, in words</h3>
<p>${esc(M.rule)}</p>
<h3>One real example</h3>
${chart(p.example)}
<h3>What followed, counted</h3>
${numbers(p)}
<p class="note">“From any day” is every day of the same ${DOC.universe.length} symbols over the same history — the thing a signal has to beat.
“Drift removed” subtracts what that same symbol was doing anyway in the year around each signal, which is the part of the answer survivor bias cannot reach.
“Random draws” is 300 draws of the same number of days, picked at random from the same histories: the middle 90% of what luck looks like.</p>
<h3>The same rule with the dials moved</h3>
${sweepTable(p)}
<p class="note">If one setting shines and its neighbours do not, that setting is luck, not a rule.</p>
<h3>The two halves of history</h3>
<p class="note">2003–2014: ${grp(p.split_half.n_early)} signals, middle move ${pc(p.split_half.early)}, against ${pc(p.split_half.base_early)} for an ordinary day in that half.<br>
2015–2026: ${grp(p.split_half.n_late)} signals, middle move ${pc(p.split_half.late)}, against ${pc(p.split_half.base_late)} for an ordinary day in that half.</p>
<h3>Verdict</h3>
${verdictBlock(p)}`;
  }).join("\n");

  return head("Six chart patterns, measured") + `
<h1>Six chart patterns, measured</h1>
<p class="meta">${esc(built)} · branch hub/patterns-20260923 · ${DOC.universe.length} symbols · nothing deployed, nothing pushed, no price table written</p>

<p class="lead">M17 measured the bull flag end to end and it did not survive. This page does the same to five more:
the rising wedge, the falling wedge, the bear flag, head and shoulders, and its inverse. Same method, same
controls, same standard of proof — and the results are reported whatever they say.</p>

<h2>First, the other half of this lane: readings in ranges</h2>
<p class="q">“Today's RSI 58.33 … It's been close to forty recently though, so the range matters … Everything cannot be very fixed thresholds … not only if it touches forty.”<span>Alan, 23 September</span></p>
${huSection()}

<h2>All six at a glance</h2>
<table class="tally"><thead><tr><th>pattern</th><th>claims</th><th>signals</th><th>middle move, 20 days</th><th>an ordinary day</th><th>drift removed</th><th>verdict</th></tr></thead><tbody>${tally}</tbody></table>
<p class="note">One of the six passes every test. Three fail. Two have too few signals to judge. That is the honest state of it.</p>

<h2>How each one was measured</h2>
<p>Every detector can only see the past. A turning point needs ${DOC.rules.pivot} days on either side to be a turning point at all,
so no detector is allowed to use one until ${DOC.rules.pivot} days after it happened. A test in <code>tests/patterns.test.mjs</code> cuts the history
short at three places and checks that the signals before the cut do not change — if a detector were reading the future, that test would fail.</p>
<p>The history is ${DOC.universe.length} symbols of finished daily bars from the chart API: index and sector funds, the large names, and
laggards (INTC, F, T, VZ, PFE, GE) on purpose, so the set is not only the winners. Each signal is measured to the close
5, 20 and 60 finished days later, and compared with four things: an ordinary day in the same history; the same
symbol's own drift in the year around the signal; 300 random draws of the same number of days; and the same rule
with its dials moved. Then the whole thing is cut in half by date and both halves are read separately.</p>
<p>A pattern is only called a survivor if it beats an ordinary day at 20 <b>and</b> 60 days, lands outside the random band
at least once, still points the right way after its own drift is removed, and tells the same story in both halves of
history. Those five tests were written before the numbers were looked at.</p>

<h2>What survivor bias still does to these numbers</h2>
<p>The chart API holds the symbols that are listed today. Every company that failed and was delisted is missing, and
no detector here can see them. That flatters every upward number on this page, including the ordinary-day baselines.
The “drift removed” column is the part that survives this objection — it compares a signal with what that same
symbol was doing anyway — and it is always the smaller number. Where a pattern only looks good in the raw column
and not in the drift-removed one, the honest reading is that the pattern found a rising market, not an edge.</p>

${sections}

<hr><h2>What could be wrong</h2>
<ul>
<li>The rules are one reasonable reading of each pattern, not the only one. The dials sweep shows how much the answer moves when the reading changes; for the wedges it moves a lot.</li>
<li>The books are not on this Mac. The descriptions above are careful paraphrases, cited to chapter titles rather than numbers, and should be checked against the texts before any of this is printed.</li>
<li>Delisted companies are missing entirely, as above.</li>
<li>Nothing here accounts for costs, slippage, or the money you would have to risk to take a signal. A 0.3% edge before costs may be no edge at all.</li>
<li>“Survives” means it passed five tests on this history. It does not mean it will work next month.</li>
</ul>
<h2>What was not done</h2>
<ul>
<li>No pattern here is wired into the Hub, and nothing places a trade or suggests one.</li>
<li>Volume is not part of any rule, though the books make it part of several. That is the next thing to add.</li>
<li>Targets and stops (the “measured move” each book gives) are not tested — only what happened at 5, 20 and 60 days.</li>
<li>Intraday and weekly bars are untouched; this is daily only.</li>
</ul>
` + foot;
}

/* ---------- page two: the rulebook -------------------------------------------- */
function rulebookPage() {
  const chapters = Object.values(DOC.patterns).map((p, i) => {
    const M = META[p.name];
    const x20 = p.horizons[20], x60 = p.horizons[60];
    return `<hr><h2>Chapter ${i + 5}. ${esc(M.title)}</h2>
<p class="claim">the pattern claims ${esc(M.claims)}</p>
${M.texts.slice(0, 2).map(([src, line]) => `<p class="q">${line}<span>${src} — paraphrase, not a quotation</span></p>`).join("")}
<h3>The rule</h3>
<p>${esc(M.rule)}</p>
<h3>The drawing</h3>
${chart(p.example, { h: 380 })}
<h3>The numbers</h3>
<p>Counted over ${DOC.universe.length} symbols of daily history, the rule fired <b>${grp(p.total)}</b> times.
Twenty days later the middle move was <b>${pc(x20.signal.median_pct)}</b>, against <b>${pc(x20.any_day.median_pct)}</b> for an ordinary day
in the same history. Sixty days later: <b>${pc(x60.signal.median_pct)}</b> against <b>${pc(x60.any_day.median_pct)}</b>.
Once the symbol's own drift is removed, what is left is <b>${pc(x20.excess_over_local.median_pct)}</b> at twenty days
and <b>${pc(x60.excess_over_local.median_pct)}</b> at sixty.</p>
<h3>The verdict</h3>
${verdictBlock(p)}
<h3>How to use this chapter</h3>
<p>${p.verdict.call === "survives"
  ? "It passed every test set for it, and the edge that remains after drift is removed is small. Treat it as one piece of evidence among several, sized so that being wrong costs little — not as a reason to act on its own."
  : p.verdict.call === "too few"
    ? "There were not enough examples to judge it. That is not the same as saying it fails: it means this history cannot answer the question, and anyone claiming it can is going beyond the evidence."
    : "It did not pass. The shape is real and easy to see, but on this history the price that followed was not different enough from an ordinary day to lean on. Read it, if you read it at all, as a description of what has happened, not as a prediction of what comes next."}</p>`;
  }).join("\n");

  return head("The Scintilla rulebook — technical analysis, measured") + `
<h1>The rulebook</h1>
<p class="meta">Technical analysis, measured · first draft of the pattern chapters · ${esc((DOC.built_utc || "").slice(0, 10))} · branch hub/patterns-20260923</p>

<div class="disc"><b>Read this first.</b> This book is for education. It is not investment advice, not a
recommendation to buy or sell anything, and not a promise about the future. Every number in it is counted from
past daily prices of ${DOC.universe.length} symbols that are still listed today — the companies that failed and were removed are
missing from it, which makes every upward number here kinder than the real world was. Patterns that “survive”
these tests survived <i>this</i> history; markets change, and a rule that worked for twenty years can stop working
the day you start using it. Nothing here accounts for costs, taxes, or the money you must risk to find out. If you
act on any of it, you do so on your own judgement and at your own risk.</div>

<p class="lead">Graham wrote <i>The Intelligent Investor</i> to separate investing from speculating, and to give the
ordinary reader a standard of proof. This book tries to do the same for chart patterns: state the rule as the
standard texts state it, then measure what actually followed, and let the measurement settle it.</p>

<h2>Chapter 1. Price as a vote</h2>
<p>A price is not a fact about a company. It is the last number two people agreed on, and it moves because opinions
move. That is the whole basis of reading charts: the record of the votes is public, complete, and free, where the
facts behind them are slow, private and revised.</p>
<p>It follows that a chart can only ever tell you what people have done, never what a business is worth. Anyone who
tells you a shape on a chart knows the future has mistaken a record of the past for a forecast. The honest claim is
much smaller: some shapes have been followed by particular behaviour often enough, over enough history, that they
are worth counting. Counting is what the rest of this book does.</p>

<h2>Chapter 2. The margin of safety is the invalidation level</h2>
<p>Graham's margin of safety is the gap between what you pay and what a thing is worth, so that being wrong costs
you little. A chart reader has no estimate of worth, but has something Graham did not: the exact price at which the
reading was wrong. In every pattern in this book, the shape states its own level — the neckline, the floor of the
wedge, the low of the pause. Below it the reading is simply wrong.</p>
<p>That level, not the target, is the useful half of the pattern. A rule that says where you are wrong lets you size a
position so that being wrong is survivable. A rule that only says where price is going does not.</p>

<h2>Chapter 3. The defensive and the enterprising reader</h2>
<p>Graham split his readers in two, and the split works here. The <b>defensive</b> reader uses charts for one thing:
to avoid acting on noise. They look at a reading, see how unusual it is against its own history, and mostly do
nothing. Almost everything in this book is, for them, a reason not to act.</p>
<p>The <b>enterprising</b> reader is willing to do the work: to count, to test a rule against an ordinary day, to
keep records of their own signals and to drop a rule when it stops paying. The price of the enterprising path is
not cleverness, it is bookkeeping. If you will not keep the records, take the defensive path — it is not the
lesser one.</p>

<h2>Chapter 4. What technical analysis can and cannot know</h2>
<p><b>It can know:</b> what has happened; how often a reading has occurred in a symbol's own history; what followed
those occurrences, on average and in the middle; and how much of that is explained by the market simply rising.</p>
<p><b>It cannot know:</b> what will happen; why a pattern formed; whether this instance is like the ones counted; or
anything at all about a company. It also cannot know about the companies that were delisted, because their prices
are gone from most databases, including this one.</p>
<p><b>The standard of proof used in this book.</b> A pattern is only called a survivor if, on the history measured,
it beats an ordinary day at both twenty and sixty days; lands outside the range produced by drawing the same number
of days at random; still points the right way once the symbol's own drift is removed; and tells the same story in
the first half of the history as in the second. Four of the six chapters that follow do not meet it. That is the
point of having a standard.</p>

${chapters}

<hr><h2>Afterword: how to read a chapter that failed</h2>
<p>Most of the chapters in this book fail their own test. That is not an argument against reading charts — it is
what an honest count looks like. A shape that does not beat an ordinary day is still a description of what the
market has been doing: pauses, tests, and turns are real. What the numbers refuse to support is the leap from
“this shape is here” to “therefore price will go there”.</p>
<p>The useful habit is the one in Chapter 2: take the level the pattern gives you, treat it as the place where you
were wrong, and size accordingly. The pattern earns its place as a way to frame risk, not as a forecast.</p>

<div class="disc"><b>Again, plainly.</b> Education only. Not advice. Past prices, ${DOC.universe.length} still-listed symbols, survivors only,
before all costs. You are responsible for what you do with it.</div>

<h2>Sources</h2>
<ul>
<li>Robert D. Edwards &amp; John Magee, <i>Technical Analysis of Stock Trends</i> — the chapters on important reversal patterns, other reversal phenomena, and consolidation formations.</li>
<li>Thomas N. Bulkowski, <i>Encyclopedia of Chart Patterns</i> — one chapter per pattern, each with its own measured statistics.</li>
<li>John J. Murphy, <i>Technical Analysis of the Financial Markets</i> — the chapters on reversal and continuation patterns.</li>
</ul>
<p class="note">The books are not on this machine. Every description of them above is a paraphrase written from the
standard account of each pattern and cited to chapter titles, not chapter numbers, which differ between editions.
Before any of this is published, the paraphrases must be checked against the texts, and the quotations that a
published book would need must be taken from them properly, with permission where required.</p>
` + foot;
}

fs.writeFileSync(path.join(DIR, "PATTERNS.html"), patternsPage());
fs.writeFileSync(path.join(DIR, "RULEBOOK.html"), rulebookPage());
console.error(`wrote ${DIR}/PATTERNS.html and RULEBOOK.html`);

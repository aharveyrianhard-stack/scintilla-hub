/* M52 HEARTBEAT — the usual day is one definition, stored once and read everywhere.
   These tests hold three promises: the maths is the maths (and matches the detector's, so a stored
   heartbeat and a live scintilla cannot disagree); nothing is invented from too little history; and
   the Hub READS the stored number rather than working one out of its own. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  stdev, dailyReturnsPct, usualDayPct, atrPct, trueRange, heartbeatRow, xUsual, calmRatio,
  MIN_SESSIONS, HEARTBEAT_VERSION,
} from "../supabase/functions/heartbeat-daily/heartbeat.mjs";
import { stdev as detectStdev, detectPriceOutliers } from "../scripts/scintillas-detect.mjs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
function fn(name) {
  const s = page.search(new RegExp("^(async )?function " + name + "\\b", "m"));
  assert.ok(s >= 0, name); const e = page.indexOf("\n}\n", s); return page.slice(s, e + 3);
}
/* a flat 100 with a fixed pattern of moves, so every expectation below is checkable by hand */
const barsFrom = (moves, start = 100) => {
  const out = [{ o: start, h: start, l: start, c: start, t: 0 }];
  let p = start;
  for (const m of moves) { const c = p * (1 + m / 100); out.push({ o: p, h: Math.max(p, c), l: Math.min(p, c), c, t: out.length * 86400e3 }); p = c; }
  return out;
};
const repeat = (arr, times) => Array.from({ length: times }, () => arr).flat();

test("the usual day is the spread of the daily moves, and a hand-checkable one", () => {
  // 40 sessions alternating +2 / -2: every move is 2% from a mean of about zero, so the spread is ~2
  const bars = barsFrom(repeat([2, -2], 20));
  const u = usualDayPct(bars, 20);
  assert.ok(Math.abs(u - 2) < 0.06, "alternating ±2% days give a usual day of about ±2%, got " + u);
  // the returns themselves are what the spread is taken over
  const rets = dailyReturnsPct(bars);
  assert.equal(rets.length, 40);
  assert.equal(Math.round(stdev(rets.slice(-20)) * 1000), Math.round(u * 1000));
});

test("fewer than 20 sessions is NULL, never a zero that would read as 'this name does not move'", () => {
  const short = barsFrom(repeat([1, -1], 9));           // 18 moves
  assert.equal(usualDayPct(short, 20), null);
  assert.equal(usualDayPct(short, 60), null);
  const row = heartbeatRow("NEW", "2026-09-23", short);
  assert.equal(row.usual_day_20, null);
  assert.equal(row.usual_day_250, null);
  assert.notEqual(row.usual_day_20, 0);
  assert.equal(MIN_SESSIONS, 20);
});

test("each window looks at its own length, so 'now' and 'the year' can disagree", () => {
  // quiet lately (±1%), wild before (±8%) — exactly the BYND shape
  const bars = barsFrom(repeat([8, -8], 100).concat(repeat([1, -1], 15)));
  const now = usualDayPct(bars, 20), year = usualDayPct(bars, 250);
  assert.ok(now < 1.5, "the last 20 sessions are quiet: " + now);
  assert.ok(year > 5, "the year still remembers the wild part: " + year);
  assert.ok(calmRatio(now, year) < 0.3, "calmer than its own normal");
});

test("ATR% counts the gap and the wick a close-to-close reading cannot see", () => {
  const prevClose = 100;
  const gapped = { o: 110, h: 112, l: 109, c: 111 };
  assert.equal(trueRange(gapped, prevClose), 12, "high 112 against yesterday's 100 close, not 112-109");
  assert.equal(trueRange(gapped, null), 3, "with no previous close it can only be the day's own range");
  // a name that gaps every day has an ATR% far above its close-to-close usual day
  const bars = [];
  let c = 100;
  for (let i = 0; i < 40; i++) { const up = i % 2 === 0; const nc = up ? c * 1.005 : c * 0.995;
    bars.push({ o: c, h: Math.max(c, nc) * 1.03, l: Math.min(c, nc) * 0.97, c: nc, t: i * 86400e3 }); c = nc; }
  const atr = atrPct(bars), usual = usualDayPct(bars, 20);
  assert.ok(atr > usual * 3, "whole-day travel " + atr.toFixed(2) + "% dwarfs the ±" + usual.toFixed(2) + "% close-to-close day");
});

test("a stored row says what it is, how much history is behind it, and where it came from", () => {
  const bars = barsFrom(repeat([1.5, -1.2, 0.4], 120));
  const row = heartbeatRow("XYZ", "2026-09-23", bars);
  assert.equal(row.ticker, "XYZ");
  assert.equal(row.date, "2026-09-23");
  assert.equal(row.n, 250, "n is capped at the longest window");
  assert.equal(row.version, HEARTBEAT_VERSION);
  assert.match(row.source, /chart-api/);
  for (const k of ["usual_day_20", "usual_day_60", "usual_day_250", "atr_pct_14"]) assert.ok(row[k] > 0, k);
  assert.equal(row.usual_day_20, Math.round(usualDayPct(bars, 20) * 1000) / 1000, "stored to 3 decimals, nothing else changed");
});

test("the heartbeat's spread and the detector's spread are the same formula", () => {
  const xs = [1.2, -0.4, 3.9, -2.2, 0.0, 5.5, -1.1, 0.7];
  assert.equal(stdev(xs), detectStdev(xs), "sample (n-1) in both files");
  assert.equal(stdev([1]), null);
  assert.equal(detectStdev([1]), null);
});

test("the detector divides by the STORED usual day when there is one, and says which it used", () => {
  const history = barsFrom(repeat([2, -2], 20));        // computes to about ±2% a day
  const quotes = [{ symbol: "AAA", price: 106, prev_close: 100 }];   // a +6% day
  const common = { quotes, historyBySymbol: { AAA: history }, session: "2026-09-23", ts: "2026-09-23T22:00:00Z" };

  const computed = detectPriceOutliers({ ...common });
  assert.equal(computed.events.length, 1);
  assert.match(computed.events[0].detail.usual_source, /computed here from 40 sessions/);

  const stored = detectPriceOutliers({ ...common, heartbeatBySymbol: { AAA: { usual_day_60: 3, date: "2026-09-22", n: 60 } } });
  assert.equal(stored.events.length, 1);
  assert.equal(stored.events[0].detail.daily_vol_pct, 3, "the stored number is the divisor");
  assert.equal(stored.events[0].detail.usual_sessions, 60);
  assert.equal(stored.events[0].detail.n_days, 60);
  assert.match(stored.events[0].detail.usual_source, /ticker_heartbeat_daily:2026-09-22/);
  assert.equal(stored.events[0].magnitude, 2, "+6% against a stored ±3% day is exactly 2x");
  assert.notEqual(computed.events[0].magnitude, stored.events[0].magnitude, "the two really are different divisors");
});

test("a stored heartbeat of zero or nothing falls back to the bars instead of dividing by nothing", () => {
  const history = barsFrom(repeat([2, -2], 20));
  const quotes = [{ symbol: "AAA", price: 106, prev_close: 100 }];
  const out = detectPriceOutliers({ quotes, historyBySymbol: { AAA: history }, session: "2026-09-23",
    ts: "2026-09-23T22:00:00Z", heartbeatBySymbol: { AAA: { usual_day_60: 0, date: "2026-09-22" } } });
  assert.equal(out.events.length, 1);
  assert.match(out.events[0].detail.usual_source, /computed here/);
});

/* ---- the Hub reads it; it does not work it out ------------------------------------------- */
const hubEnv = () => {
  const src = "const num=(v)=>{const n=typeof v==='number'?v:parseFloat(v);return Number.isFinite(n)?n:null;};" +
    "const esc=(x)=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');" +
    page.match(/^const SC_HB_STALE_DAYS = [^\n]*\n/m)[0] + page.match(/^const SC_HB_X_UNUSUAL\s+= [^\n]*\n/m)[0] +
    fn("hbAgeDays") + fn("hbPct") + fn("hbXUsual") + fn("hbTitle") + fn("hbCellHTML") + fn("hbMedian") + fn("hbGroupLabel") +
    "return { hbCellHTML, hbTitle, hbPct, hbXUsual, hbMedian, hbGroupLabel, hbAgeDays };";
  return new Function(src)();
};
const today = () => new Date().toISOString().slice(0, 10);

test("the board cell prints the stored usual day, and the multiple ONLY on a day that is unusual", () => {
  const H = hubEnv();
  const hb = { date: today(), usual_day_60: 1.45, usual_day_20: 1.5, usual_day_250: 1.22, atr_pct_14: 1.93, n: 250 };
  const quiet = H.hbCellHTML("MCD", hb, -0.9);
  const body = (h) => h.slice(h.indexOf('">', h.indexOf("title=")) + 2);   // past the title attribute
  assert.match(body(quiet), /^<i class="sc-hb__pm">±<\/i>1\.4%<\/span>$/,
    "the cell is the number and nothing else, its sign in its own element so a phone can drop it");
  assert.doesNotMatch(quiet, /sc-hb__x/, "an ordinary day gets no multiple");
  const loud = H.hbCellHTML("MCD", hb, -4.81);
  assert.match(loud, /sc-hb__x/, "a 3.3x day is called out");
  assert.match(loud, /3\.3×/);
  assert.match(loud, /var\(--bear\)/, "down days are red, the estate's one colour rule");
  assert.match(H.hbCellHTML("MCD", hb, 4.81), /var\(--bull\)/);
});

test("no stored row is a dash and a plain sentence — never a guess", () => {
  const H = hubEnv();
  const cell = H.hbCellHTML("NEWCO", null, 3.2);
  assert.match(cell, /—/);
  assert.doesNotMatch(cell, /sc-hb__x/, "with no usual day there is no multiple to print");
  assert.match(H.hbTitle("NEWCO", null, 3.2), /not enough stored history for NEWCO yet/);
});

test("a heartbeat older than a week is dimmed and dated, not passed off as today's", () => {
  const H = hubEnv();
  const old = new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10);
  const cell = H.hbCellHTML("MCD", { date: old, usual_day_60: 1.45 }, -1);
  assert.match(cell, /is-stale/);
  assert.match(H.hbTitle("MCD", { date: old, usual_day_60: 1.45 }, -1), /days old, not a current reading/);
  assert.doesNotMatch(H.hbCellHTML("MCD", { date: today(), usual_day_60: 1.45 }, -1), /is-stale/);
});

test("the tooltip says all three windows, the whole-day range, and that sigma is the same thing", () => {
  const H = hubEnv();
  const t = H.hbTitle("MCD", { date: "2026-09-23", usual_day_60: 1.45, usual_day_20: 1.5, usual_day_250: 1.22, atr_pct_14: 1.93 }, -4.81);
  assert.match(t, /a normal day for this name moves about this much/);
  assert.match(t, /60 sessions \(the season\)/);
  assert.match(t, /20 sessions ±1\.5% \(now\)/);
  assert.match(t, /250 sessions ±1\.2% \(the year\)/);
  assert.match(t, /whole-day range including gaps 1\.9%/);
  assert.match(t, /today -4\.81% = 3\.3x its usual day/);
  assert.match(t, /sigma and standard deviation are the same thing/);
});

test("a group's heartbeat is the MIDDLE name's, so one wild name cannot speak for the cohort", () => {
  const H = hubEnv();
  const rows = [{ hb: { usual_day_60: 1.0 } }, { hb: { usual_day_60: 1.2 } }, { hb: { usual_day_60: 1.4 } },
                { hb: { usual_day_60: 1.6 } }, { hb: { usual_day_60: 40 } }];
  assert.equal(H.hbMedian(rows).med, 1.4, "the median ignores the 40% name; a mean would read 9.04");
  assert.equal(H.hbMedian(rows).n, 5);
  assert.equal(H.hbMedian([{ hb: null }, {}]).med, null, "nothing stored, nothing claimed");
  assert.match(H.hbGroupLabel(rows, 46), /usual day ±1\.4% \(middle of 5 of 46\)/, "the count it is taken over is always shown");
  assert.equal(H.hbGroupLabel([{}], 46), "");
});

test("at phone width the row stays legible: one column steps aside and the sign is dropped, not the number", () => {
  const phone = [...page.matchAll(/@media\(max-width:560px\)\{[\s\S]*?\n\}/g)].map((m) => m[0]).find((b) => b.includes(".ch{grid-template-columns"));
  assert.ok(phone, "the board has a phone rule of its own");
  assert.match(phone, /nth-child\(6\), \.ch > \*:nth-child\(11\)\{ display:none/, "F P/E and READ step aside - the two that were already unreadable at 390");
  assert.match(phone, /\.sc-hb__pm\{ display:none/, "the ± goes so the decimal fits");
  assert.equal(phone.match(/minmax\(0,\d+fr\)/g).length, 12, "12 tracks for the 12 cells that remain");
  assert.match(phone, /\.ch > \.sc-hb, \.ch > \.sc-chg, \.ch > \.sc-fpe\{ overflow:hidden/, "no cell spills into its neighbour at 390");
});

test("the column exists on the board, has a track to sit in, and the page carries the words", () => {
  assert.match(page, /\["Usual day","hb"\]/, "the board column");
  const cols = page.match(/const BOARD_COLS = \[(.*?)\];/s)[1].split("],").length;
  const track = page.match(/\.ch\{grid-template-columns:([^!]*)!important;gap:5px\}/)[1].match(/minmax\(0,\d+fr\)/g).length;
  assert.equal(track, cols, "one grid track per column (" + cols + " columns, " + track + " tracks)");
  assert.match(page, /hbCellHTML\(d\.t, d\.hb, d\.c\)/, "every row renders it");
  assert.match(page, /ticker_heartbeat_daily\?ticker=in\./, "the Hub READS the stored heartbeat");
  /* Alan asked "what's the difference between sigma and standard deviation?" — the page answers it
     in words and STILL never puts a Greek letter on his screen, which is M48's rule. */
  assert.match(page, /sigma means the same thing/, "the plain-words answer to Alan's question");
  const strip = page.match(/const exp = '<div class="sc-ss__exp">[\s\S]*?<\/div>";/)[0];
  assert.doesNotMatch(strip, /σ/, "no Greek letter reaches the screen (M48)");
  assert.equal((strip.match(/standard deviation/g) || []).length, 1, "written once, for the record");
  assert.doesNotMatch(page.match(/function hbCellHTML[\s\S]*?\n}\n/)[0], /Math\.sqrt/, "the Hub never computes a spread of its own");
});

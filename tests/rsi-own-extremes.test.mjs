/* RS1 (6 Oct 2026) — RSI coloured by each name's own extremes.
   Alan: "I see Netflix at 33 and I don't think that's green enough." The board coloured RSI on one 30 / 70 ruler; now
   each name is read against its own last two years. These tests pin: the maths (against FMP's own stored number on
   real bars), the colour rule, the three fallback states, the page's inline copies against the shared module value
   for value, the wiring, and that the table is additive and the loader's dry run needs no key. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  wilderRsi, percentileGrid, percentileOf, rsiOwnRow, rsiOwnRead, rsiOwnColor, rsiFixedColor, rsiOwnExtreme,
  rsiFixedExtreme, rsiOwnTitle, rsiOwnSpan, WINDOW_DAYS, MIN_SPAN_DAYS, MIN_SESSIONS, OWN_LO, OWN_HI, RSI_OWN_VERSION,
  MACRO_SYMBOLS, SEVEN_DAY,
} from "../supabase/functions/rsi-own-daily/rsi-own.mjs";

const here = (p) => new URL(p, import.meta.url);
const page = readFileSync(here("../index.html"), "utf8");
const fx = JSON.parse(readFileSync(here("./fixtures/rs1-rsi-own.json"), "utf8"));
function fn(name) {
  const s = page.search(new RegExp("^(async )?function " + name + "\\b", "m"));
  assert.ok(s >= 0, name);
  const e = page.indexOf("\n}\n", s);
  return page.slice(s, e + 3);
}
const line = (re) => { const m = page.match(re); assert.ok(m, String(re)); return m[0]; };
const num = (x) => (x == null || x === "" || !isFinite(+x) ? null : +x);
const bars = (pairs) => pairs.map(([t, c]) => ({ t, c }));
const day = 864e5;

/* ── the maths ───────────────────────────────────────────────────────────────────────────────────── */
test("Wilder's RSI(14) on the chart API's daily bars is the number the board already prints (FMP's), on real bars", () => {
  const r = wilderRsi(fx.spy.bars.map((b) => b[1]));
  assert.equal(r[13], null, "no value before 14 changes have been seen");
  assert.notEqual(r[14], null);
  assert.ok(Math.abs(r[r.length - 1] - fx.spy.fmp_rsi_14_at_2026_10_05) < 0.02,
    "SPY at the 5 Oct 2026 close: ours " + r[r.length - 1].toFixed(2) + " vs FMP's stored " + fx.spy.fmp_rsi_14_at_2026_10_05);
  /* an independent, by-the-definition recomputation (averages restated, not the recurrence) agrees */
  const c = fx.spy.bars.map((b) => b[1]).slice(0, 60);
  let ag = 0, al = 0;
  for (let i = 1; i <= 14; i++) { const ch = c[i] - c[i - 1]; if (ch > 0) ag += ch; else al -= ch; }
  ag /= 14; al /= 14;
  for (let i = 15; i < c.length; i++) { const ch = c[i] - c[i - 1]; ag = (ag * 13 + Math.max(ch, 0)) / 14; al = (al * 13 + Math.max(-ch, 0)) / 14; }
  assert.ok(Math.abs(wilderRsi(c)[59] - (100 - 100 / (1 + ag / al))) < 1e-9);
  assert.equal(wilderRsi([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24])[14], 100, "only gains → 100");
  assert.equal(wilderRsi(new Array(20).fill(5))[19], 50, "a flat line is neither stretched up nor down");
});

test("the percentile grid is 101 rising numbers and a reading is placed back on it where it came from", () => {
  const vals = []; for (let i = 0; i < 500; i++) vals.push(20 + 60 * ((i * 7919) % 500) / 499);   // 500 distinct readings, shuffled
  const g = percentileGrid(vals);
  assert.equal(g.length, 101);
  for (let k = 1; k <= 100; k++) assert.ok(g[k] >= g[k - 1], "rising at " + k);
  assert.equal(g[0], 20); assert.equal(g[100], 80); assert.ok(Math.abs(g[50] - 50) < 0.1);
  for (const k of [0, 3, 10, 37, 50, 90, 99, 100]) assert.ok(Math.abs(percentileOf(g, g[k]) - k) <= 0.6, "round trip at " + k + ": " + percentileOf(g, g[k]));
  assert.equal(percentileOf(g, 5), 0, "below its lowest day");
  assert.equal(percentileOf(g, 99), 100, "above its highest day");
  assert.equal(percentileOf(g, null), null); assert.equal(percentileOf([1, 2, 3], 2), null, "a short grid is not a grid");
  assert.equal(percentileGrid([]), null);
  /* agrees with a straight count of days at or below, to a point */
  const s = [...vals].sort((a, b) => a - b);
  for (const v of [25, 33.3, 47, 61.5, 77]) assert.ok(Math.abs(percentileOf(g, v) - 100 * s.filter((x) => x <= v).length / s.length) < 1, "count at " + v);
  const flat = percentileGrid(new Array(300).fill(42));
  assert.equal(percentileOf(flat, 42), 100, "a reading inside a flat run takes the run's top");
});

/* ── a row ───────────────────────────────────────────────────────────────────────────────────────── */
test("one name's row: its own two calendar years, the four percentiles, today's percentile — and it fits the table's checks", () => {
  const got = rsiOwnRow("SPY", bars(fx.spy.bars));
  const r = got.row;
  assert.ok(r, "a row");
  assert.equal(r.ticker, "SPY"); assert.equal(r.as_of, "2026-10-05"); assert.equal(r.version, RSI_OWN_VERSION);
  assert.equal(r.eligible, true);
  assert.ok(r.sessions >= 495 && r.sessions <= 506, "about 502 sessions in two calendar years: " + r.sessions);
  assert.ok(Date.parse(r.as_of) - Date.parse(r.window_from) <= WINDOW_DAYS * day, "the window never reaches past two years");
  assert.ok(Date.parse(r.as_of) - Date.parse(r.window_from) > (WINDOW_DAYS - 7) * day, "and uses all of them");
  assert.equal(r.grid.length, 101);
  assert.ok(r.p10 <= r.p20 && r.p20 <= r.p50 && r.p50 <= r.p80 && r.p80 <= r.p90, "rop_order_ck");
  assert.ok(r.rsi >= 0 && r.rsi <= 100 && r.pct >= 0 && r.pct <= 100, "rop_rsi_ck / rop_pct_ck");
  assert.deepEqual([r.p10, r.p20, r.p50, r.p80, r.p90], [r.grid[10], r.grid[20], r.grid[50], r.grid[80], r.grid[90]]);
  assert.equal(r.pct, percentileOf(r.grid, r.rsi), "the stored percentile is the one the browser would place");
  /* PRIOR OBSERVATIONS ONLY (the estate's rule, research/statistics/stats.mjs): the as_of close is judged against the
     sessions before it and is never inside its own sample */
  const all = wilderRsi(fx.spy.bars.map((b) => b[1])), L = all.length - 1, floor = fx.spy.bars[L][0] - WINDOW_DAYS * day;
  const prior = all.filter((v, i) => i < L && v != null && fx.spy.bars[i][0] > floor);
  assert.equal(r.sessions, prior.length, "the window holds the sessions BEFORE as_of");
  assert.deepEqual(r.grid, percentileGrid(prior));
  assert.notDeepEqual(r.grid, percentileGrid(prior.concat([all[L]])), "…and not the as_of session itself");
  /* the reading the coordinator took at the 5 Oct close */
  assert.ok(Math.abs(r.rsi - 58.83) < 0.02); assert.ok(Math.abs(r.p10 - 41.6) < 0.15, "its own 10th: " + r.p10);
  assert.ok(r.pct > 52 && r.pct < 62, "mid-range for SPY, not stretched: " + r.pct);
  /* the same row the dry run produced from the live API */
  assert.deepEqual(r.grid, fx.rows.SPY.grid);
});

test("under one year of its own history is marked not eligible; too little history gets no row; a reused ticker is cut at the join", () => {
  const last = fx.spy.bars.slice(-150);                        // ~7 months of bars
  const young = rsiOwnRow("NEWCO", bars(last));
  assert.ok(young.row); assert.equal(young.row.eligible, false, "150 sessions is not a year");
  assert.ok(young.row.sessions < MIN_SESSIONS);
  const yr = rsiOwnRow("ONEYEAR", bars(fx.spy.bars.slice(-300)));   // ~14 months
  assert.equal(yr.row.eligible, true, "a year and two months qualifies");
  assert.ok(Date.parse(yr.row.as_of) - Date.parse(yr.row.window_from) >= MIN_SPAN_DAYS * day);
  assert.equal(rsiOwnRow("TINY", bars(fx.spy.bars.slice(-30))).row, null);
  assert.equal(rsiOwnRow("TINY", bars(fx.spy.bars.slice(-30))).reason, "SHORT_HISTORY");
  assert.equal(rsiOwnRow("NONE", []).row, null);
  /* a 60-day hole means another company used the ticker before: only the bars after it count */
  const b = bars(fx.spy.bars.slice(-700));
  const joined = b.map((x, i) => (i < 400 ? { t: x.t - 60 * day, c: x.c * 3 } : x));
  const cut = rsiOwnRow("REUSED", joined);
  assert.equal(cut.joins_cut, true);
  assert.ok(cut.row.sessions <= 300 - 14, "only the bars since the join: " + cut.row.sessions);
  assert.equal(fx.rows.CBRS.eligible, false, "CBRS listed this year: the live dry run marks it too young");
});

test("weekend prints are not sessions (except Bitcoin's), a load can be pinned to one close, and the macro series are named", () => {
  const b = bars(fx.spy.bars.slice(-700));
  const base = rsiOwnRow("DXUSD", b).row;
  /* the dollar, oil, gold and the futures are served with Saturday / Sunday prints: add one after every Friday */
  const withWeekends = [];
  for (const x of b) { withWeekends.push(x); if (new Date(x.t).getUTCDay() === 5) withWeekends.push({ t: x.t + day, c: x.c * 1.001 }); }
  assert.ok(withWeekends.length > b.length + 100);
  const dropped = rsiOwnRow("DXUSD", withWeekends);
  assert.deepEqual(dropped.row, base, "the same row as if the weekend prints were never served");
  assert.equal(dropped.weekend_bars_dropped, withWeekends.length - b.length);
  const kept = rsiOwnRow("BTCUSD", withWeekends).row;
  assert.ok(kept.sessions > base.sessions + 60, "Bitcoin trades every day: its weekend bars count");
  assert.deepEqual([...SEVEN_DAY], ["BTCUSD"]);
  /* --as-of: bars after that session are ignored, so one load sits on one close */
  const asOf = new Date(b[b.length - 4].t).toISOString().slice(0, 10);
  const pinned = rsiOwnRow("SPY", b, { asOf }).row;
  assert.equal(pinned.as_of, asOf);
  assert.deepEqual(pinned, rsiOwnRow("SPY", b.slice(0, -3)).row);
  assert.deepEqual([...MACRO_SYMBOLS], ["VIX", "US10Y", "US5Y", "US30Y", "US3M", "DXY", "DXUSD", "GCUSD", "CLUSD", "SIUSD", "BTCUSD", "ESUSD", "NQUSD"]);
  for (const t of ["VIX", "DXUSD", "BTCUSD"]) assert.equal(fx.rows[t].eligible, true, t + " has an own scale in the live dry run");
  assert.ok(fx.rows.BTCUSD.sessions > 700, "two years of Bitcoin is ~729 daily sessions: " + fx.rows.BTCUSD.sessions);
});

/* ── the colour rule ─────────────────────────────────────────────────────────────────────────────── */
test("the same palette on the name's own scale: neutral at its middle, full green at its own 10th, full red at its own 90th", () => {
  assert.equal(rsiOwnColor(50), "var(--ink2)");
  assert.equal(rsiOwnColor(10), "rgb(0,255,163)"); assert.equal(rsiOwnColor(3), "rgb(0,255,163)"); assert.equal(rsiOwnColor(0), "rgb(0,255,163)");
  assert.equal(rsiOwnColor(90), "rgb(255,45,85)"); assert.equal(rsiOwnColor(100), "rgb(255,45,85)");
  assert.equal(rsiOwnColor(10), rsiFixedColor(20), "the deepest green is the one the board already used");
  assert.equal(rsiOwnColor(90), rsiFixedColor(80), "and the deepest red");
  const ch = (c) => c.match(/\d+/g).map(Number);
  let prev = ch(rsiOwnColor(11));
  for (let p = 12; p <= 47; p++) { const c = ch(rsiOwnColor(p)); assert.ok(c[0] >= prev[0] && c[1] <= prev[1], "greener as it falls: " + p); prev = c; }
  prev = ch(rsiOwnColor(53));
  for (let p = 54; p <= 90; p++) { const c = ch(rsiOwnColor(p)); assert.ok(c[0] >= prev[0] && c[1] <= prev[1], "redder as it rises: " + p); prev = c; }
  for (let p = 0; p <= 100; p += 0.5) assert.match(rsiOwnColor(p), /^(rgb\(\d+,\d+,\d+\)|var\(--ink2\))$/, "never rgba, never dimmed: " + p);
  assert.equal(rsiOwnColor(null), "");
  assert.equal(OWN_LO, 10); assert.equal(OWN_HI, 90);
  assert.equal(rsiOwnExtreme(10), true); assert.equal(rsiOwnExtreme(90), true);
  assert.equal(rsiOwnExtreme(10.1), false); assert.equal(rsiOwnExtreme(89.9), false); assert.equal(rsiOwnExtreme(null), false);
});

test("Netflix at 33 is greener than it was, and says where 33 sits for Netflix", () => {
  const row = fx.rows.NFLX, v = row.rsi;                       // 32.79 at the 5 Oct close — the "33" Alan saw
  assert.equal(Math.round(v), 33);
  const rd = rsiOwnRead("NFLX", v, row);
  assert.equal(rd.own, true);
  assert.ok(rd.pct > 10 && rd.pct < 20, "NFLX's own percentile at 33: " + rd.pct);
  const ch = (c) => c.match(/\d+/g).map(Number);
  const was = ch(rsiFixedColor(v)), now = ch(rd.color);
  assert.ok(now[0] < was[0] - 30 && now[2] < was[2], "less grey, more green: was " + was + " now " + now);
  assert.equal(rd.title, "33 — lower than " + Math.round(100 - rd.pct) + "% of NFLX's last two years");
  assert.match(rd.title, /^33 — lower than 8\d% of NFLX's last two years$/);
  assert.equal(rd.extreme, false, "not yet at its own 10th: it does not breathe");
  /* the same number means different things for different names */
  assert.equal(rsiOwnRead("TLT", fx.rows.TLT.rsi, fx.rows.TLT).extreme, true);
  assert.equal(rsiOwnRead("TLT", fx.rows.TLT.rsi, fx.rows.TLT).color, "rgb(0,255,163)");
  const tsm = rsiOwnRead("TSM", fx.rows.TSM.rsi, fx.rows.TSM);
  assert.equal(tsm.extreme, true); assert.equal(tsm.color, "rgb(255,45,85)");
  assert.match(tsm.title, /^76 — higher than 99% of TSM's last two years$/);
  assert.equal(rsiOwnRead("TLT", fx.rows.TLT.rsi, fx.rows.TLT).title, "22 — the lowest reading of TLT's last two years", "never 'lower than 100%'");
  /* SPY 59 is the middle of ITS range: nearly neutral, no glow */
  const spy = rsiOwnRead("SPY", fx.rows.SPY.rsi, fx.rows.SPY);
  assert.equal(spy.extreme, false); assert.match(spy.title, /^59 — higher than 58% of SPY's last two years$/);
});

test("three fallback states: an own scale · known too young (30 / 70 + the hover says why) · nothing known (30 / 70, no hover)", () => {
  const none = rsiOwnRead("ZZZ", 25, null);
  assert.deepEqual(none, { pct: null, own: false, color: rsiFixedColor(25), extreme: true, title: "" });
  assert.equal(rsiOwnRead("ZZZ", 45, undefined).extreme, false);
  const young = rsiOwnRead("CBRS", 72, fx.rows.CBRS);
  assert.equal(young.own, false); assert.equal(young.color, rsiFixedColor(72)); assert.equal(young.extreme, true);
  assert.equal(young.title, "72 — CBRS has under a year of its own history, so this is coloured on the usual 30 / 70 scale");
  assert.equal(rsiFixedExtreme(30), true); assert.equal(rsiFixedExtreme(70), true); assert.equal(rsiFixedExtreme(31), false); assert.equal(rsiFixedExtreme(69), false);
  assert.equal(rsiOwnTitle("X", 50, 50), "50 — higher than 50% of X's last two years");
  assert.equal(rsiOwnTitle("X", 41.6, 8.2), "42 — lower than 92% of X's last two years");
  /* the ends are said in words, and nothing rounds to "100%" */
  assert.equal(rsiOwnTitle("X", 12, 0), "12 — the lowest reading of X's last two years");
  assert.equal(rsiOwnTitle("X", 91, 100), "91 — the highest reading of X's last two years");
  assert.equal(rsiOwnTitle("X", 88, 99.7), "88 — higher than 99% of X's last two years");
  assert.equal(rsiOwnTitle("X", 14, 0.3), "14 — lower than 99% of X's last two years");
  /* a name with over a year but under two says how long its own window really is */
  assert.equal(rsiOwnSpan("2024-10-07", "2026-10-05"), "last two years");
  assert.equal(rsiOwnSpan(fx.rows.CRWV.window_from, fx.rows.CRWV.as_of), "last 18 months");
  assert.match(rsiOwnRead("CRWV", fx.rows.CRWV.rsi, fx.rows.CRWV).title, /^50 — higher than 52% of CRWV's last 18 months$/);
});

/* ── the Hub page's inline copies are the module, value for value ────────────────────────────────── */
const hub = new Function("num", line(/const RSI_XT_LO = [^\n]*\n/) + line(/const rsiExtreme = [^\n]*\n/) + fn("rsiGradColor") +
  line(/const RSI_OWN = [^\n]*\n/) + line(/const RSI_OWN_LO = [^\n]*\n/) + fn("rsiOwnPct") + fn("rsiOwnColor") + fn("rsiOwnSpan") + fn("rsiOwnTitle") + fn("rsiOwnRead") +
  "\nreturn { RSI_OWN, RSI_OWN_LO, RSI_OWN_HI, rsiGradColor, rsiExtreme, rsiOwnPct, rsiOwnColor, rsiOwnSpan, rsiOwnTitle, rsiOwnRead };")(num);

test("the Hub's inline rule and the shared module agree on every reading, for every state", () => {
  assert.equal(hub.RSI_OWN_LO, OWN_LO); assert.equal(hub.RSI_OWN_HI, OWN_HI);
  for (let v = 0; v <= 100; v += 0.25) assert.equal(hub.rsiGradColor(v), rsiFixedColor(v), "30/70 colour at " + v);
  for (let p = 0; p <= 100; p += 0.1) assert.equal(hub.rsiOwnColor(p), rsiOwnColor(p), "own colour at " + p);
  for (const t of Object.keys(fx.rows)) {
    const row = fx.rows[t];
    assert.equal(hub.rsiOwnSpan(row.window_from, row.as_of), rsiOwnSpan(row.window_from, row.as_of), t + " span");
    hub.RSI_OWN[t] = { eligible: row.eligible, grid: row.grid, as_of: row.as_of, sessions: row.sessions, span: hub.rsiOwnSpan(row.window_from, row.as_of) };
    for (let v = 1; v <= 99; v += 0.37) {
      assert.equal(hub.rsiOwnPct(row.grid, v), percentileOf(row.grid, v), t + " percentile at " + v);
      assert.deepEqual(hub.rsiOwnRead(t, v), rsiOwnRead(t, v, row), t + " read at " + v);
    }
  }
  for (const v of [12, 30, 31, 50, 69, 70, 88]) assert.deepEqual(hub.rsiOwnRead("NOT_LOADED", v), rsiOwnRead("NOT_LOADED", v, null), "no row at " + v);
  for (const [v, p] of [[12, 0], [91, 100], [88, 99.7], [14, 0.3], [50, 50], [40, null]]) assert.equal(hub.rsiOwnTitle("X", v, p, "last 18 months"), rsiOwnTitle("X", v, p, "last 18 months"));
});

test("the board cell is painted from the name's own read: colour, glow and hover — and the glow itself is untouched", () => {
  const paint = fn("paintRsiCell");
  assert.match(paint, /const rd = rsiOwnRead\(t, v\);/);
  assert.match(paint, /cell\.removeAttribute\("data-hu-rsi"\);/, "once the provider's number is painted the how-unusual fill lets go of the cell");
  assert.match(paint, /cell\.style\.color = rd\.color;/);
  assert.match(paint, /classList\.toggle\("is-xt", rd\.extreme\)/);
  assert.match(paint, /setAttribute\("title", rd\.title\)/);
  assert.match(paint, /setAttribute\("data-own", rd\.title\)/, "the own line rides on data-own so the how-unusual script can keep it");
  assert.match(paint, /removeAttribute\("data-own"\); cell\.removeAttribute\("title"\)/, "a cell with no own scale carries no leftover hover");
  const rowsHtml = fn("boardRowsHTML");
  assert.match(rowsHtml, /typeof rsiOwnRead === "function" \? rsiOwnRead\(d\.t, d\.rsi\)/, "born in its final colour");
  assert.match(rowsHtml, /rsiRd\.extreme \? " is-xt" : ""/);
  assert.match(rowsHtml, /data-own="' \+ esc\(rsiRd\.title\) \+ '" title="' \+ esc\(rsiRd\.title\) \+ '"/, "the hover is escaped like every other cell title");
  assert.match(fn("loadBoardRsi"), /loadBoardRsiOwn\(tickers\)\.catch\(\(\) => \{\}\)/, "asked beside the numbers, never blocking them");
  /* SLOW1's cheap breath is exactly as it was */
  assert.match(page, /\.sc-rsi\.is-xt::after\{ content:attr\(data-v\);[^}]*opacity:0; animation:rsi-xt 4s ease-in-out infinite; \}/);
  assert.match(page, /@keyframes rsi-xt\{ 0%,100%\{ opacity:0; \} 50%\{ opacity:1; \} \}/);
  /* painting a cell end to end */
  const cell = { textContent: "", style: {}, attrs: {}, cls: new Set(),
    setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; },
    classList: { toggle: (c, on) => (on ? cell.cls.add(c) : cell.cls.delete(c)) } };
  const paintFn = new Function("el", "rsiOwnRead", paint + "\nreturn paintRsiCell;")(() => cell, (t, v) => rsiOwnRead(t, v, fx.rows[t] || null));
  paintFn("TLT", fx.rows.TLT.rsi);
  assert.equal(cell.textContent, 22); assert.equal(cell.attrs["data-v"], "22"); assert.equal(cell.style.color, "rgb(0,255,163)");
  assert.ok(cell.cls.has("is-xt")); assert.equal(cell.attrs.title, "22 — the lowest reading of TLT's last two years");
  assert.equal(cell.attrs["data-own"], cell.attrs.title);
  paintFn("UNKNOWN", 55);
  assert.equal(cell.cls.has("is-xt"), false); assert.equal("title" in cell.attrs, false); assert.equal("data-own" in cell.attrs, false);
});

test("reading the own scales: one bounded read per chunk, three weeks at most, off for the page when the table is not there", async () => {
  const src = fn("loadBoardRsiOwn");
  assert.match(src, /rsi_own_percentiles\?ticker=in\./);
  assert.match(src, /&as_of=gte\." \+ since/, "an old row is never read");
  assert.match(src, /select=ticker,as_of,window_from,sessions,eligible,rsi,grid", 1\);/, "one try: pg() repeats every failure three times");
  assert.match(line(/const RSI_OWN_STALE_DAYS = [^\n]*\n/), /= 21;/, "the heartbeat column's own bound");
  assert.match(fn("loadBoardHeartbeat"), /Date\.now\(\) - 21 \* 86400e3/, "…which is still 21 days");
  const make = (pgImpl) => {
    const calls = [], painted = [];
    const S = { rows: [{ t: "NFLX", rsi: 32.79 }, { t: "SPY", rsi: null }, { t: "CBRS", rsi: 61 }] };
    const api = new Function("pg", "S", "paintRsiCell", "num", "rsiOwnSpan",
      "const RSI_OWN = Object.create(null); const RSI_OWN_STALE_DAYS = 21; const RSI_OWN_ASKED = new Set(); let RSI_OWN_OFF = false;\n" +
      src + "\nreturn { load: loadBoardRsiOwn, RSI_OWN, off: () => RSI_OWN_OFF };")(
      (path, tries) => { calls.push(path); assert.equal(tries, 1); return pgImpl(path, calls.length); }, S, (t, v) => painted.push([t, v]), num, rsiOwnSpan);
    return { api, calls, painted };
  };
  /* rows land: stored, and a number already on screen is recoloured */
  let h = make(async () => [fx.rows.NFLX, fx.rows.SPY, fx.rows.CBRS, { ticker: "BAD", eligible: true, grid: [1, 2] }]);
  await h.api.load(["NFLX", "SPY", "CBRS", "NFLX", ""]);
  assert.equal(h.calls.length, 1, "one read for the chunk, duplicates dropped");
  assert.deepEqual(Object.keys(h.api.RSI_OWN).sort(), ["CBRS", "NFLX", "SPY"], "a malformed grid is not stored");
  assert.equal(h.api.RSI_OWN.NFLX.eligible, true); assert.equal(h.api.RSI_OWN.CBRS.eligible, false);
  assert.equal(h.api.RSI_OWN.NFLX.span, "last two years"); assert.equal(h.api.RSI_OWN.NFLX.rsi, 32.79);
  assert.deepEqual(h.painted, [["NFLX", 32.79], ["CBRS", 61]], "only cells that already show a number are repainted");
  await h.api.load(["NFLX", "SPY", "CBRS"]);
  assert.equal(h.calls.length, 1, "asked once per name per page load");
  /* 36 names → two reads of at most 35 */
  h = make(async () => []);
  await h.api.load(Array.from({ length: 36 }, (_, i) => "T" + i));
  assert.equal(h.calls.length, 2);
  /* the table is not there yet: stop asking, stay on 30 / 70 */
  h = make(async (p) => { throw new Error("pg " + p + " → 404"); });
  await h.api.load(["NFLX"]); assert.equal(h.api.off(), true);
  await h.api.load(["SPY"]); assert.equal(h.calls.length, 1, "no second request after a 404");
  /* a bad moment: ask again on the next pass */
  h = make(async (p, n) => { if (n === 1) throw new Error("pg " + p + " → 503"); return [fx.rows.NFLX]; });
  await h.api.load(["NFLX"]); assert.equal(h.api.off(), false); assert.equal(Object.keys(h.api.RSI_OWN).length, 0);
  await h.api.load(["NFLX"]); assert.equal(h.calls.length, 2); assert.ok(h.api.RSI_OWN.NFLX);
});

/* ── the table and its loader ────────────────────────────────────────────────────────────────────── */
test("the table is additive, publicly readable, written only by the service role, and its rollback removes only itself", () => {
  const sql = readFileSync(here("../supabase/migrations/20261006_rsi_own_percentiles.sql"), "utf8");
  const code = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  assert.match(code, /create table if not exists public\.rsi_own_percentiles/);
  assert.equal((code.match(/create table/g) || []).length, 1, "one new table");
  assert.doesNotMatch(code, /\b(drop table|alter table (?!public\.rsi_own_percentiles)|truncate|delete from|update public\.)/i, "nothing existing is touched");
  for (const col of ["ticker", "as_of", "window_from", "sessions", "eligible", "rsi", "pct", "p10", "p20", "p50", "p80", "p90", "grid", "source", "version", "computed_at"])
    assert.match(code, new RegExp("\\n\\s+" + col + "\\s"), "column " + col);
  assert.match(code, /primary key \(ticker\)/);
  assert.match(code, /array_length\(grid, 1\) = 101/);
  assert.match(code, /enable row level security/);
  /* the 2 Oct access block (after the Q4 access audit): policy names its roles, revoke all, grant select back */
  assert.match(code, /create policy rop_read_all on public\.rsi_own_percentiles for select to anon, authenticated using \(true\);/);
  assert.match(code, /revoke all on table public\.rsi_own_percentiles from anon, authenticated;\ngrant select on table public\.rsi_own_percentiles to anon, authenticated;/);
  assert.match(code, /grant select, insert, update on table public\.rsi_own_percentiles to service_role;/);
  assert.doesNotMatch(code, /grant (all|insert|update|delete)[^;]*to (anon|authenticated)/i, "the public roles can only read");
  const rb = readFileSync(here("../supabase/migrations/20261006_rsi_own_percentiles_ROLLBACK.sql"), "utf8").split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").trim();
  assert.equal(rb, "drop policy if exists rop_read_all on public.rsi_own_percentiles;\ndrop table if exists public.rsi_own_percentiles;");
  /* every column the writer sends exists, and nothing the table requires is missing */
  const row = rsiOwnRow("SPY", bars(fx.spy.bars)).row;
  for (const k of Object.keys(row)) assert.match(code, new RegExp("\\n\\s+" + k + "\\s"), "writer field " + k + " is a column");
});

test("the nightly job runs after the two jobs that read the same bars, carries no key, and has an exact rollback", () => {
  const cron = readFileSync(here("../supabase/migrations/20261006_rsi_own_daily_cron.sql"), "utf8");
  assert.match(cron, /cron\.schedule\('rsi-own-daily', '30 23 \* \* 1-5', body\)/, "23:30 UTC, after heartbeat-daily 23:10 and sigma-daily 23:20");
  assert.match(cron, /cron\.schedule\('rsi-own-daily-catchup', '30 11 \* \* 2-6', body\)/);
  assert.match(readFileSync(here("../supabase/migrations/20260928_sigma_daily_cron.sql"), "utf8"), /cron\.schedule\('sigma-daily', '20 23 \* \* 1-5', body\)/, "the neighbour is where this file says it is");
  assert.doesNotMatch(cron, /eyJ[A-Za-z0-9_-]{20,}|sb_secret_|service_role key/i, "no key in the file");
  const rb = readFileSync(here("../supabase/migrations/20261006_rsi_own_daily_cron_ROLLBACK.sql"), "utf8");
  assert.match(rb, /cron\.unschedule\('rsi-own-daily'\)/); assert.match(rb, /cron\.unschedule\('rsi-own-daily-catchup'\)/);
  assert.doesNotMatch(rb.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n"), /drop table|delete from/i, "stopping the job leaves the rows");
});

test("the function and the Mac loader share one maths file, write one table, and the dry run needs no key", () => {
  const edge = readFileSync(here("../supabase/functions/rsi-own-daily/index.ts"), "utf8");
  const load = readFileSync(here("../scripts/rsi-own-load.mjs"), "utf8");
  assert.match(edge, /from "\.\/rsi-own\.mjs"/); assert.match(load, /from "\.\.\/supabase\/functions\/rsi-own-daily\/rsi-own\.mjs"/);
  for (const src of [edge, load]) {
    const tables = [...src.matchAll(/\/rest\/v1\/([a-z_]+)/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(tables)], ["rsi_own_percentiles"], "one table, never a price table");
    assert.match(src, /on_conflict=ticker/, "one row per name, replaced");
    assert.match(src, /\/candles\?symbol=.*&tf=1d&limit=/, "daily bars from the chart API only");
  }
  for (const src of [edge, load]) assert.match(src, /new Set\(\[\.\.\.symbols, \.\.\.MACRO_SYMBOLS\]\)/, "the macro series ride along with /universe");
  assert.match(load, /rsiOwnRow\(sym, barsOf\(await chartGet\(.*\)\), \{ asOf: AS_OF \}\);/, "--as-of pins one load to one close");
  assert.match(load, /rows\.push\(\{ \.\.\.got\.row, computed_at: computedAt \}\)/, "computed_at travels with the row");
  assert.match(load, /if \(!DRY && \(!SB \|\| !SERVICE\)\)/, "--dry asks for no key");
  assert.match(load, /if \(DRY \|\| !rows\.length\) return 0;/, "--dry writes nothing");
  assert.match(edge, /const written = dry \? 0 : await upsert\(rows\);/);
  assert.ok(existsSync(here("../supabase/functions/heartbeat-daily/heartbeat.mjs")), "the join cut is the heartbeat's own");
  assert.match(readFileSync(here("../supabase/functions/rsi-own-daily/rsi-own.mjs"), "utf8"), /import \{ sinceLastJoin \} from "\.\.\/heartbeat-daily\/heartbeat\.mjs";/);
});

/* ── the "how unusual" script shares the cell: it must keep the own line, and dress the macro cells it fills ───── */
function huFn(name) {
  const s = page.indexOf("  function " + name + "(");
  assert.ok(s >= 0, name);
  return page.slice(s, page.indexOf("\n  }\n", s) + 5);
}

test("the tap hint no longer replaces the hover: the name's own line leads and the way in follows", () => {
  const src = huFn("markCells");
  const cell = (id, own) => ({ id, attrs: own ? { "data-own": own } : {}, title: "",
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; } });
  const cells = [cell("lr_NFLX", "33 — lower than 86% of NFLX's last two years"), cell("lr_SPY", "59 — higher than 58% of SPY's last two years"), cell("lr_ZZZ", null)];
  const mark = new Function("document", "WATCHED", src + "\nreturn markCells;")({ querySelectorAll: () => cells }, ["SPY"]);
  mark();
  assert.equal(cells[0].title, "33 — lower than 86% of NFLX's last two years · tap: how unusual is this reading?");
  assert.equal(cells[1].title, "59 — higher than 58% of SPY's last two years · how unusual is this reading? — tap for SPY's own history");
  assert.equal(cells[2].title, "tap: how unusual is this reading?", "a cell with no own line is exactly as it was");
  assert.equal(cells[0].attrs["data-hu"], "1"); assert.equal(cells[1].attrs["data-hu"], "watch");
});

test("VIX, the ten-year, the dollar, oil and gold are dressed on their own scale too, from the freshest finished reading", () => {
  const src = huFn("fillWatchedRsi");
  assert.match(src, /var rd = typeof rsiOwnRead === "function" \? rsiOwnRead\(sym\.t, v\) : null;/);
  assert.match(src, /c\.classList\.toggle\("is-xt", rd\.own && rd\.extreme\)/, "with no own scale these cells still do not breathe, as before");
  assert.match(src, /if \(shown !== String\(Math\.round\(v\)\)\) c\.textContent = Math\.round\(v\);/, "the text is only written when it changes: a text write wakes the observer");
  const mk = (text) => {
    const cell = { style: {}, attrs: {}, title: "", writes: 0, cls: new Set(),
      setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; } };
    cell.classList = { toggle: (c, on) => (on ? cell.cls.add(c) : cell.cls.delete(c)) };
    let t = text;
    Object.defineProperty(cell, "textContent", { get: () => t, set: (v) => { t = String(v); cell.writes++; } });
    return cell;
  };
  const run = (cell, { live, own }) => {
    const RSI_OWN = own ? { VIX: { eligible: true, grid: fx.rows.VIX.grid, as_of: fx.rows.VIX.as_of, rsi: fx.rows.VIX.rsi, span: "last two years" } } : {};
    const fill = new Function("DOC", "LIVE", "document", "RSI_OWN", "rsiOwnRead", "rsiGradColor", src + "\nreturn fillWatchedRsi;")(
      { symbols: [{ t: "VIX", provider: "FMP", latest: { rsi: 43.0, date: "2026-09-22" } }] }, live ? { VIX: live } : {},
      { getElementById: (id) => (id === "lr_VIX" ? cell : null) }, RSI_OWN,
      (t, v) => rsiOwnRead(t, v, own ? fx.rows[t] : null), rsiFixedColor);
    fill(); return fill;
  };
  /* nothing known yet: the static file's last day, on 30 / 70, no glow — exactly as before */
  let c = mk("—"); let fill = run(c, { own: false });
  assert.equal(c.textContent, "43"); assert.equal(c.style.color, rsiFixedColor(43)); assert.equal(c.cls.has("is-xt"), false);
  assert.equal(c.title, "RSI 43 on 2026-09-22, from finished daily bars (FMP) — tap: how unusual is this reading?");
  /* the own scale has landed: the nightly row's close (5 Oct), coloured on VIX's own two years */
  c = mk("—"); fill = run(c, { own: true });
  assert.equal(c.textContent, String(Math.round(fx.rows.VIX.rsi)));
  assert.equal(c.style.color, rsiOwnColor(fx.rows.VIX.pct));
  assert.match(c.title, /^49 — higher than 55% of VIX's last two years · RSI 48\.8 on 2026-10-05, from finished daily bars \(FMP\) — tap/);
  const writes = c.writes; fill(); fill();
  assert.equal(c.writes, writes, "dressing it again writes no text (no observer loop)");
  /* the provider's own number is never overwritten */
  c = mk("61"); run(c, { own: true });
  assert.equal(c.textContent, "61"); assert.equal(c.writes, 0);
  /* …not even in a cell this function filled first (SPY, QQQ, IWM, DIA are filled while empty, then the provider's
     number lands): paintRsiCell takes the marker off, and from then on the cell is the provider's */
  c = mk("—"); fill = run(c, { own: true });
  assert.equal(c.attrs["data-hu-rsi"], String(fx.rows.VIX.rsi), "filled here: marked as this function's");
  const paintFn = new Function("el", "rsiOwnRead", fn("paintRsiCell") + "\nreturn paintRsiCell;")(() => Object.assign(c, { removeAttribute(k) { delete c.attrs[k]; } }), () => ({ color: "rgb(1,2,3)", extreme: false, title: "" }));
  paintFn("VIX", 52.2);                                          // the provider's number arrives
  assert.equal(c.textContent, "52"); assert.equal("data-hu-rsi" in c.attrs, false);
  const w2 = c.writes; fill(); fill();
  assert.equal(c.textContent, "52", "the provider's 52 stands; the nightly row's 49 is not written over it"); assert.equal(c.writes, w2);
  assert.equal(c.style.color, "rgb(1,2,3)", "and its colour is left as the board painted it");
  /* the panel's live recount still wins when it exists */
  c = mk("—"); run(c, { own: true, live: { rsi: 52.4, date: "2026-10-06" } });
  assert.equal(c.textContent, "52"); assert.match(c.title, /RSI 52\.4 on 2026-10-06/);
});

test("a tap says it too (a phone has no hover): the panel carries the own line for any name with a scale", () => {
  const src = huFn("ownLine");
  const n0 = (x) => String(Math.round(x));
  const mkLine = (RSI_OWN) => new Function("RSI_OWN", "rsiOwnRead", "n0", src + "\nreturn ownLine;")(RSI_OWN, (t, v) => rsiOwnRead(t, v, fx.rows[t] || null), n0);
  const own = (t) => ({ [t]: { eligible: fx.rows[t].eligible, grid: fx.rows[t].grid } });
  assert.equal(mkLine(own("NFLX"))("NFLX", fx.rows.NFLX.rsi),
    '<p class="hu__say">Daily RSI <b>33</b> — lower than 86% of NFLX\'s last two years. Its own bottom tenth is <b>31</b> or lower; its own top tenth is <b>71</b> or higher.</p>');
  assert.match(mkLine(own("CBRS"))("CBRS", 44.5), /Daily RSI <b>45<\/b> — CBRS has under a year of its own history, so this is coloured on the usual 30 \/ 70 scale\.<\/p>$/);
  assert.equal(mkLine({})("ZZZ", 50), "", "no scale, no line");
  assert.equal(mkLine(own("NFLX"))("NFLX", null), "", "no reading, no line");
  const paintSrc = huFn("paint");
  assert.match(paintSrc, /ownLine\(CUR, bRow && bRow\.rsi\) \+ '<p class="hu__say">No history has been built/, "a name outside the nine no longer says only that it has no history");
  assert.match(paintSrc, /\+ ownLine\(sym\.t, now\)\n/, "the nine carry it under their all-history sentence");
  assert.equal(page.includes("__rsi"), false, "tests/hub-motion forbids that substring anywhere in the page");
});

// GH1 · the Geiger history study and the Pine Geiger oscillator — static checks on the paste-ready script, the script's
// running maths (its JS port) against the publisher-copied replay, and the shape of the stored data. No network.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Rung, rungVal, nextSession, isHoliday, easterDay } from "../deliverables/20261006/geiger-history/tools/pine-port.mjs";
import { rungReading } from "../deliverables/20260927/geiger-review/geiger-replay.mjs";

const DIR = new URL("../deliverables/20261006/geiger-history/", import.meta.url);
const pine = fs.readFileSync(new URL("pine/SCINTILLA-GEIGER-OSCILLATOR.pine", DIR), "utf8");
const code = pine.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
const page = fs.readFileSync(new URL("GEIGER-HISTORY.html", DIR), "utf8");
const data = JSON.parse(fs.readFileSync(new URL("data/gh1-data.json", DIR), "utf8"));
const series = JSON.parse(fs.readFileSync(new URL("data/geiger-series.json", DIR), "utf8"));

test("the script is Pine v6 and declares its budget in the header", () => {
  assert.match(pine, /^\/\/@version=6\n/);
  assert.match(pine, /PLOTS 7\/64/);
  assert.match(pine, /REQUESTS 3\/40/);
});

test("the plot budget matches the header: five plots (one with a sign colour), one fill, three requests", () => {
  const count = (re) => (code.match(re) || []).length;
  assert.equal(count(/(^|[^.\w])plot\(/g), 5);
  assert.equal(count(/(^|[^.\w])fill\(/g), 1);
  assert.equal(count(/= request\.security\(/g), 3);
  for (const f of ["plotshape(", "plotchar(", "plotcandle(", "plotbar(", "bgcolor(", "barcolor("]) assert.ok(!code.includes(f), f);
});

test("the pane is an oscillator from -1 to +1 with the five level lines", () => {
  assert.match(code, /indicator\("SCINTILLA · GEIGER OSCILLATOR", shorttitle = "GEIGER OSC", overlay = false/);
  for (const v of ["1.0", "0.5", "0.0", "-0.5", "-1.0"]) assert.ok(code.includes(`hline(${v},`), v);
});

test("default weights are the saved Equalizer the stored series was replayed with", () => {
  const name = { "3h": "w3h", "4h": "w4h", "6h": "w6h", "12h": "w12h", "1d": "w1d", "3d": "w3d", "1w": "w1w" };
  assert.equal(Object.keys(series.weights).length, 7);
  for (const [k, w] of Object.entries(series.weights)) {
    const m = pine.match(new RegExp(`float ${name[k]}\\s*=\\s*input\\.float\\(([0-9.]+)`));
    assert.ok(m, k); assert.equal(+m[1], w, k);
  }
  assert.match(pine, /float famT = input\.float\(0\.5,/); assert.match(pine, /float famM = input\.float\(0\.5,/);
  assert.match(pine, /float mixR = input\.float\(0\.6,/); assert.match(pine, /float mixW = input\.float\(0\.4,/);
});

test("no white, and every grey follows the look rule (colour only for the sign and the one teal family)", () => {
  assert.ok(!/color\.white|#fff\b|#ffffff/i.test(code));
  for (const [, n, hex] of pine.matchAll(/const color (C_\w+)\s*=\s*#([0-9A-Fa-f]{6})/g)) {
    if (["C_BULL", "C_BEAR", "C_TREND", "C_MOM"].includes(n)) continue;
    const ch = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(Math.max(...ch) - Math.min(...ch) <= 24 && Math.max(...ch) <= 210, `${n} #${hex}`);
  }
});

test("the intraday rungs sit on the provider's grid: 04:00 UTC and every N hours, not the New York clock", () => {
  assert.match(code, /const int\s+GRID_MS\s+= 4 \* 3600000/);
  assert.match(code, /gridId\(int nh\) => int\(math\.floor\(\(time - GRID_MS\) \/ \(nh \* 3600000\.0\)\)\)/);
  assert.ok(!/hour\(time, TZ\) \/ nh/.test(code));
});

test("the 3-day calendar is picked per name: the script's Grid B list is the surveyed one", () => {
  const m = pine.match(/const string GRID_B\s+= ",([^"]+),"/); assert.ok(m);
  const inScript = m[1].split(",").sort(); const surveyed = Object.entries(data.three_day_calendar.phase).filter(([, p]) => p === 1).map(([s]) => s).sort();
  assert.deepEqual(inScript, surveyed); assert.equal(inScript.length, 104);
  assert.ok(Object.values(data.three_day_calendar.phase).every((p) => p === 1 || p === 2));
  assert.match(code, /int phase3 = .*str\.contains\(GRID_B, "," \+ syminfo\.ticker \+ ","\) \? 1 : 2/);
  assert.match(code, /int\(math\.floor\(\(ed - phase3\) \/ 3\.0\)\)/);
});

// deterministic pseudo-random walks
function walk(n, seed, start = 100) {
  let s = seed >>> 0, p = start; const out = [];
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < n; i++) { p *= 1 + (r() - 0.5) * 0.04; const h = p * (1 + r() * 0.01), l = p * (1 - r() * 0.01); out.push({ c: p, h, l }); }
  return out;
}

test("the running maths equals the publisher's windowed reading at every length up to the 230-bar window", () => {
  for (const seed of [1, 7, 42]) {
    const b = walk(230, seed), R = new Rung();
    for (let k = 0; k < b.length; k++) {
      const out = R.step(k, true, b[k].h, b[k].l, b[k].c), ref = rungReading(b.slice(0, k + 1));
      if (k + 1 < 8) { assert.equal(out.dev.trend, null); assert.equal(ref, null); continue; }
      assert.equal(out.dev.trend, ref.trend, `trend n=${k + 1}`); assert.equal(out.dev.lines, ref.fanLines, `lines n=${k + 1}`);
      if (ref.momentum == null) assert.equal(out.dev.mom, null, `mom n=${k + 1}`);
      else assert.ok(Math.abs(out.dev.mom - ref.momentum) < 1e-9, `mom n=${k + 1}`);
      assert.ok(Math.abs(rungVal(out.dev) - ref.composite) < 1e-9, `rung n=${k + 1}`);
    }
  }
});

test("past 230 bars the running maths stays within a millionth of the publisher's restarted window", () => {
  let worst = 0, flips = 0, n = 0;
  for (const seed of [3, 11, 99]) {
    const b = walk(1500, seed), R = new Rung();
    for (let k = 0; k < b.length; k++) {
      const out = R.step(k, true, b[k].h, b[k].l, b[k].c); if (k < 230) continue;
      const ref = rungReading(b.slice(0, k + 1)); n++;
      if (out.dev.trend !== ref.trend) flips++; else worst = Math.max(worst, Math.abs(rungVal(out.dev) - ref.composite));
    }
  }
  assert.ok(worst < 1e-6, `worst ${worst}`); assert.ok(flips / n < 0.001, `fan-order flips ${flips} of ${n}`);
});

test("finished-bars-only: a bar still being built changes the developing reading, not the finished one", () => {
  const b = walk(60, 5), R = new Rung(); let last;
  for (let k = 0; k < 59; k++) last = R.step(k, true, b[k].h, b[k].l, b[k].c);
  const before = rungVal(last.dev);                                  // bar 58 counted
  const forming = R.step(59, false, b[59].h, b[59].l, b[59].c);      // bar 59 arrives, not finished
  assert.ok(Math.abs(rungVal(forming.cmp) - before) < 1e-12);        // the finished reading has not moved
  assert.ok(Math.abs(rungVal(forming.dev) - rungReading(b.slice(0, 60)).composite) < 1e-9);
  const done = R.step(59, true, b[59].h, b[59].l, b[59].c);          // same bar, now finished
  assert.ok(Math.abs(rungVal(done.cmp) - rungVal(done.dev)) < 1e-12);
});

test("a rung bar is the high, low and last close of the bars rolled into it", () => {
  const R = new Rung(); for (let k = 0; k < 40; k++) R.step(Math.floor(k / 4), k % 4 === 3, 10 + k, 5 + k, 7 + k);
  assert.equal(R.n, 9); assert.equal(R.cl[8], 7 + 35); assert.equal(R.hi[R.hi.length - 1], 10 + 35); assert.equal(R.lo[R.lo.length - 1], 5 + 32);
});

test("the calendar rule: Good Friday, the Monday after a Sunday holiday, and Juneteenth only from 2022", () => {
  const ed = (y, m, d) => Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  assert.equal(easterDay(2026), ed(2026, 4, 5)); assert.ok(isHoliday(ed(2026, 4, 3)));
  assert.equal(nextSession(ed(2026, 4, 2)), ed(2026, 4, 6));        // Thursday before Good Friday → Monday
  assert.ok(isHoliday(ed(2023, 1, 2))); assert.ok(!isHoliday(ed(2021, 12, 31)));   // 1 Jan 2023 a Sunday; 1 Jan 2022 a Saturday is not moved to Friday
  assert.ok(isHoliday(ed(2022, 6, 20))); assert.ok(!isHoliday(ed(2021, 6, 18)));
  assert.equal(nextSession(ed(2025, 11, 26)), ed(2025, 11, 28));    // Thanksgiving
  assert.equal(data.pine_check.calendar.next_session_wrong, 5);     // the recorded check: only the five one-off closures since 2003
});

test("the recorded check on the names: exact on liquid names when the daily bar gets the day's last after-hours bar", () => {
  const n = data.pine_check.names; assert.deepEqual(Object.keys(n), ["MU", "NVDA", "AVGO", "SPY", "SNDK", "GFS", "CIEN"]);
  for (const s of ["MU", "NVDA", "AVGO", "SPY", "SNDK"]) { assert.ok(n[s].session_end.corr > 0.99999, s); assert.ok(n[s].session_end.max_gap < 0.005, s); assert.equal(n[s].grid, "A"); }
  for (const s of ["GFS", "CIEN"]) { assert.ok(n[s].session_end.corr > 0.999, s); assert.ok(n[s].session_end.mean_gap < 0.01, s); assert.equal(n[s].grid, "B"); }
  for (const s of Object.keys(n)) assert.ok(n[s].cash_close.mean_gap > n[s].session_end.mean_gap, s);
  for (const k of ["3h", "4h", "6h", "12h"]) assert.equal(data.pine_check.rollup[k].all_four_pct, 100);
  assert.deepEqual(data.pine_compile_check, { errors: [], warnings: [] });
});

test("the replay agrees with the Hub's own numbers on two evenings", () => {
  const v = data.validation, s = data.validation_against_stored_rows;
  assert.ok(v.exact_1e5 / v.names > 0.95); assert.ok(v.max < 0.03);
  for (const day of ["2026-10-05", "2026-10-06"]) { assert.ok(s[day].exact_1e4 / s[day].names > 0.95, day); assert.ok(s[day].max < 0.03, day); }
  assert.ok(v.earlier_variant.exact_1e5 < 10);                       // counting the unfinished 3-day / weekly bar does not reproduce the Hub
});

test("the stored series: one shared calendar, a value per session, Geiger x 1000 inside -1000..1000", () => {
  assert.ok(series.calendar.length >= 5800); assert.equal(series.calendar.at(-1), data.as_of_session);
  const names = Object.keys(series.names); assert.ok(names.length >= 190);
  for (const s of ["SPY", "QQQ", "MU", "NVDA", "AVGO", "GOOGL", "AMZN", "TSM", "AMD", "MSFT", "AAPL", "SNDK", "WDC", "NVTS"]) assert.ok(series.names[s], s);
  for (const [s, o] of Object.entries(series.names)) {
    assert.equal(o.start + o.g.length, series.calendar.length, s); assert.equal(series.calendar[o.start], o.first, s);
    assert.ok(o.g.every((x) => x === null || (Number.isInteger(x) && x >= -1000 && x <= 1000)), s);
    assert.ok(Math.abs(o.g.at(-1) - data.stats[s].g * 1000) < 0.51, s);
  }
});

test("percentiles are a share of the name's own window, and the windows nest", () => {
  for (const [s, v] of Object.entries(data.stats)) {
    for (const k of ["1y", "3y", "5y", "all"]) assert.ok(v[k].pct >= 0 && v[k].pct <= 100, `${s} ${k}`);
    assert.ok(v["1y"].n <= 251 && v["3y"].n <= 755 && v["5y"].n <= 1259 && v["1y"].n <= v["3y"].n && v["3y"].n <= v["5y"].n && v["5y"].n <= v.all.n, s);
    assert.ok(v["5y"].lo <= v["3y"].lo && v["3y"].lo <= v["1y"].lo && v["1y"].lo <= v.g && v.g <= v["1y"].hi, s);
  }
});

test("the seven dates: eleven names, every cell either measured or named absent", () => {
  const b = data.bottoms; assert.equal(b.dates.length, 7); assert.equal(b.names.length, 11);
  for (const t of b.names) for (const d of b.dates) {
    const r = b.rows[t][d];
    if (r === null) { assert.ok(["AVGO"].includes(t) && d === "2009-03-02", `${t} ${d}`); continue; }
    assert.ok(r.g >= -1 && r.g <= 1 && r.rsi > 0 && r.rsi < 100 && Number.isFinite(r.p200), `${t} ${d}`);
    assert.ok(r.rungs === 7 || (t === "QQQ" && d === "2009-03-02" && r.rungs === 3), `${t} ${d} rungs`);
  }
  assert.equal(b.rows.GOOGL["2009-03-02"].src, "GOOG");
  assert.ok(b.rows.SPY["2009-03-02"].g < -0.9 && b.rows.SPY["2025-04-04"].g < -0.8);
});

test("the parabolic start is the first close 50% above the 200-day, and the count of lower sessions is inside the run", () => {
  for (const s of ["MU", "SNDK", "WDC"]) {
    const p = data.parabolic[s]; assert.ok(p.start_row.p200 >= 50, s); assert.ok(p.below_today < p.sessions_since, s);
    assert.equal(p.runs.reduce((a, r) => a + r.sessions, 0), p.below_today, s);
    for (const r of p.runs) { assert.ok(r.from >= p.start, s); assert.ok(r.low.g < p.today.g, s); }
    assert.ok(p.lowest.g <= Math.min(...p.runs.map((r) => r.low.g)) + 1e-9, s);
  }
});

test("the page: one way back, the look rule, nothing smaller than 11 px, the pictures drawn for desk and phone", () => {
  assert.ok(page.includes("scnav"), "BACK / CLOSE pair");
  const own = page.split("<!-- scnav")[0];
  assert.ok(!/#fff\b|#ffffff|:\s*white\b/i.test(own));
  for (const [, px] of own.matchAll(/font-size:\s*([0-9.]+)px/g)) assert.ok(+px >= 11, `font-size ${px}px`);
  for (const [, px] of own.matchAll(/font-size="([0-9.]+)"/g)) assert.ok(+px >= 11, `svg font-size ${px}`);
  assert.ok((own.match(/class="tw wide"/g) || []).length >= 10 && (own.match(/class="tw narrow"/g) || []).length >= 10);
  assert.ok(own.includes('<details class="sc-pagespecs"><summary>PAGE SPECS</summary>'));
  for (const d of ["26 Mar 2026", "4 Apr 2025", "30 Oct 2023", "17 Oct 2022", "17 Mar 2020", "21 Dec 2018", "2 Mar 2009"]) assert.ok(own.includes(`<th>${d}</th>`), d);
});

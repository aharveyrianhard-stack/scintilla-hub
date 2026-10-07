/* CHN1 (6 Oct 2026) — SPY and QQQ inside the Indicator Lab's retained long-term channels.
   The study's numbers come from Python (deliverables/20261006/channels/tools). This file re-derives the ones that matter a second
   way, in JavaScript, from the saved inputs: the Lab's constants, the Lab's own saved daily bars and its own saved 200-day. No network.
   It also holds the page to the house rules a browser measured (tools/05_shots.mjs → shots/record.json). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "deliverables/20261006/channels");
const read = (p) => fs.readFileSync(path.join(DIR, p), "utf8");
const R = JSON.parse(read("data/results.json")), LAB = JSON.parse(read("data/lab-channels.json")), LB = JSON.parse(read("data/lab-source-bars.json")).symbols;
const PAGE = read("CHANNELS.html"), REC = JSON.parse(read("shots/record.json"));
const day = (ms) => new Date(ms).toISOString().slice(0, 10);
const monday = (iso) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.getTime(); };
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);

/* The retained B lines, exactly as the Lab's packs hold them (level at the snapshot bar, USD per source bar). If the Lab changes
   its geometry, or our reading of it drifts, this is where it shows. */
const PINNED = {
  SPY: { "1W B": [788.3375155333333, 662.8891240199998, 1.3622353166666665], "2W B": [788.3375155333333, 580.1928960800001, 2.724470633333333] },
  QQQ: { "1W B": [755.65, 592.5704624342519, 1.4132882601574803], "2W B": [755.65, 509.83166579228345, 2.8265765203149606] },
};

test("the Lab's channel constants are the ones pinned, identical in every pack read, and pass their own cross-checks", () => {
  assert.equal(LAB.sources.packs.b_geometry_identical_in_every_pack, true);
  assert.ok(LAB.sources.packs.packs_compared.includes("V24") && LAB.sources.packs.packs_compared.includes("V34"));
  assert.equal(LAB.sources.installed_registry.matches_the_pack_file_read_here, true, "the installed pack is the file that was read");
  for (const sym of ["SPY", "QQQ"]) for (const name of ["1W B", "2W B"]) {
    const c = LAB.symbols[sym].channels[name], [up, lo, slope] = PINNED[sym][name];
    assert.equal(c.upper.at_snapshot, up); assert.equal(c.lower.at_snapshot, lo); assert.equal(c.slope_per_source_bar, slope);
    near(c.mid.at_snapshot, (up + lo) / 2, 1e-9, `${sym} ${name} midline is the mean of its rails`);
    assert.deepEqual(Object.values(c.checks), Object.values(c.checks).map(() => true), `${sym} ${name} cross-checks`);
    assert.equal(c.approval.slope_strip, true); assert.equal(c.approval.retained_in_installed_pack, true);
  }
  for (const sym of ["SPY", "QQQ"]) {   // the two timeframes share one top rail, and a two-week bar climbs exactly two weekly steps
    const a = LAB.symbols[sym].channels["1W B"], b = LAB.symbols[sym].channels["2W B"];
    assert.equal(a.upper.at_snapshot, b.upper.at_snapshot, `${sym}: 1W B2 and 2W B2 coincide`);
    near(b.slope_per_source_bar, 2 * a.slope_per_source_bar, 1e-12, `${sym}: 2W slope is twice the 1W slope`);
  }
});

test("today's position inside each channel is plain arithmetic on those constants and the last final close", () => {
  for (const sym of ["SPY", "QQQ"]) {
    const S = R.symbols[sym], px = S.today.close;
    assert.equal(S.today.session, "2026-10-06"); assert.equal(S.price_source.bar_finality.verified, true);
    S.channels.forEach((c) => {
      const [up, lo] = PINNED[sym][c.name], mid = (up + lo) / 2, t = c.today;   // the week of 5 Oct is the snapshot bar: n = 0
      near(t.position_pct_of_height, (px - lo) / (up - lo) * 100, 0.01, `${sym} ${c.name} position`);
      near(t.move_to_upper_pct, (up / px - 1) * 100, 0.001, `${sym} ${c.name} move to the upper rail`);
      near(t.move_to_mid_pct, (mid / px - 1) * 100, 0.001, `${sym} ${c.name} move to the midline`);
      near(t.move_to_lower_pct, (lo / px - 1) * 100, 0.001, `${sym} ${c.name} move to the lower rail`);
    });
    near(S.today.upper_rail.room_usd, PINNED[sym]["1W B"][0] - px, 0.001, `${sym} room in dollars`);
  }
  assert.ok(R.symbols.SPY.today.upper_rail.room_pct > 0, "SPY closed under its top rail");
  assert.ok(R.symbols.QQQ.today.upper_rail.room_pct < 0, "QQQ closed over its top rail");
});

test("the slope in the Lab's strip units and per month follows the Lab's own formula", () => {
  for (const sym of ["SPY", "QQQ"]) R.symbols[sym].channels.forEach((c) => {
    const L = LAB.symbols[sym].channels[c.name], usd7 = L.slope_per_source_bar * L.anchor_span_bars * 168 / L.elapsed_calendar_hours, px = R.symbols[sym].today.close;
    near(c.slope.usd_per_7d, usd7, 1e-5, `${sym} ${c.name} USD per 7 days`);
    assert.equal(c.slope.lab_strip_reads, `+${(100 * usd7 / px).toFixed(2)}% / 7d`);
    near(c.slope.pct_of_close_per_month, 100 * usd7 * (365.25 / 12) / 7 / px, 1e-3, `${sym} ${c.name} % a month`);
  });
  assert.equal(R.symbols.SPY.channels[1].slope.lab_strip_reads, "+0.18% / 7d");   // the numbers Alan read off the strip, 6 Oct
  assert.equal(R.symbols.SPY.channels[0].slope.lab_strip_reads, "+0.17% / 7d");
});

test("our prices, 200-day, RSI and Williams reproduce what the Lab saved", () => {
  for (const sym of ["SPY", "QQQ"]) {
    const p = R.symbols[sym].basis.parity_with_lab_bars;
    assert.ok(p.daily.lab_days_compared >= 290 && p.daily.max_abs_error_usd_any_of_ohlc <= 0.01, `${sym} daily bars`);
    assert.ok(p.weekly.lab_weeks_compared >= 290 && p.weekly.max_abs_error_usd_any_of_ohlc <= 0.01, `${sym} weekly bars`);
    assert.ok(p.sma200_vs_lab_saved_daily.days >= 290 && p.sma200_vs_lab_saved_daily.max_abs_error_usd <= 1e-4, `${sym} 200-day`);
    assert.ok(p.rsi14_vs_lab_saved_daily.max_abs_error_points_lab_bar_vs_our_previous_session <= 1e-4, `${sym} RSI`);
    assert.ok(p.williams14_plus100_vs_lab_saved_daily.max_abs_error_points_lab_bar_vs_our_previous_session <= 1e-4, `${sym} Williams`);
    assert.equal(R.symbols[sym].clock_check.ok, true, `${sym} source clocks agree with the Lab's bar counts`);
  }
});

/* A second derivation that owes nothing to the study's own price conversion: the Lab's saved daily bars against the Lab's saved 200-day. */
function labDaily(sym) {
  const bars = LB[sym]["1D"].rows.slice(0, -1), ind = new Map(LB[sym]["1D_lab_indicators"].rows.map((r) => [r[0], r[1]]));   // the newest bar was still forming
  return bars.map((b) => ({ d: day(b[0]), high: b[2], close: b[4], ma: ind.get(b[0]) }));
}

test("the March 2026 pierce, found again from the Lab's own bars and its own 200-day", () => {
  for (const sym of ["SPY", "QQQ"]) {
    const rows = labDaily(sym), runs = [];
    rows.forEach((r, i) => { if (r.close < r.ma) { if (i && rows[i - 1].close < rows[i - 1].ma) runs[runs.length - 1].push(r); else runs.push([r]); } });
    assert.equal(runs.length, 1, `${sym}: one stretch under the 200-day in the Lab's saved window`);
    const run = runs[0], low = run.reduce((a, b) => (b.close < a.close ? b : a)), e = R.symbols[sym].episodes.at(-1);
    assert.equal(run[0].d, e.first_pierce); assert.equal(run.length, e.sessions_closed_below); assert.equal(low.d, e.low.date);
    near(low.close, e.low.close, 0.006, `${sym} low close`);
    near((low.close / low.ma - 1) * 100, e.low.below_sma200_pct, 0.006, `${sym} depth under the 200-day at the low`);
    assert.equal(rows[rows.indexOf(run.at(-1)) + 1].d, e.back_above_for_good);
  }
});

test("closes above the top rail, found again from the Lab's own bars and the rail's equation", () => {
  const snap = monday("2026-10-05");
  const above = (sym) => labDaily(sym).filter((r) => r.close > PINNED[sym]["1W B"][0] + PINNED[sym]["1W B"][2] * Math.round((monday(r.d) - snap) / 6048e5)).map((r) => r.d);
  assert.deepEqual(above("SPY"), [], "SPY has not closed above 1W B2");
  const q = above("QQQ"), ours = R.symbols.QQQ.channels[0].life.sessions_closed_above_upper;
  assert.deepEqual(q, ours.filter((d) => d !== "2026-10-06"), "QQQ's closes above 1W B2 (the Lab's capture ends on 5 Oct)");
  assert.equal(ours.at(-1), "2026-10-06"); assert.equal(R.symbols.QQQ.upper_rail.stretches_of_closes_above.length, 2);
  const touched = labDaily("SPY").filter((r) => r.high >= PINNED.SPY["1W B"][0] + PINNED.SPY["1W B"][2] * Math.round((monday(r.d) - snap) / 6048e5)).map((r) => r.d);
  assert.deepEqual(touched, ["2026-08-13"], "the one day SPY's high reached the rail");
});

test("every pierce belongs to one episode and every episode is internally consistent", () => {
  for (const sym of ["SPY", "QQQ"]) {
    const S = R.symbols[sym]; let n = 0, prevEnd = "";
    for (const e of S.episodes) {
      n += e.pierces.length;
      assert.ok(e.first_pierce > prevEnd, `${sym} episodes are in order and do not overlap`); prevEnd = e.back_above_for_good;
      assert.equal(e.pierces[0].pierce, e.first_pierce); assert.equal(e.pierces.reduce((a, p) => a + p.sessions_below, 0), e.sessions_closed_below);
      assert.ok(e.low.date >= e.first_pierce && e.low.date < e.back_above_for_good, `${sym} ${e.label}: the low lies inside the episode`);
      assert.ok(e.max_depth.by_intraday_low_pct <= e.max_depth.by_close_pct && e.max_depth.by_close_pct < 0);
      for (const k of ["rsi14_own_percentile", "williams14_own_percentile"]) assert.ok(e.oscillators_at_low[k] > 0 && e.oscillators_at_low[k] <= 100);
      const rb = e.rebound;   // a later line is never reached before an earlier one
      if (rb.to_2W_B4_mid && rb.to_1W_B4_mid) assert.ok(rb.to_2W_B4_mid.sessions <= rb.to_1W_B4_mid.sessions);
      if (rb.to_1W_B4_mid && rb.to_upper_touch) assert.ok(rb.to_1W_B4_mid.sessions <= rb.to_upper_touch.sessions);
    }
    assert.equal(n, S.pierces.count_pierces); assert.equal(S.episodes.length, S.pierces.count_episodes);
  }
  assert.equal(R.symbols.SPY.pierces.count_episodes, 5); assert.equal(R.symbols.QQQ.pierces.count_episodes, 4);
});

test("the page names every line by its exact label, is self-contained, and says what the numbers say", () => {
  for (const id of ["1W B2", "1W B4", "1W B6", "2W B2", "2W B4", "2W B6"]) assert.ok(PAGE.includes(id), id);
  assert.ok(/1W B2<\/b>, which is the same line as <b>2W B2/.test(PAGE), "the page says the two top rails coincide");
  assert.ok(PAGE.includes("<!-- scnav · ") && PAGE.includes("data-scnav-slot"), "the BACK / CLOSE pair");
  assert.ok(PAGE.includes('<details class="sc-pagespecs"><summary>PAGE SPECS</summary>'), "the notes live in PAGE SPECS");
  assert.equal((PAGE.match(/(?:src|href)\s*=\s*["'](?:https?:)?\/\//g) || []).length, 0, "no outside file is asked for");
  assert.ok(!/@import/.test(PAGE), "no outside stylesheet");
  assert.deepEqual((PAGE.match(/url\((?!#)/g) || []), [], "every url() points inside the page (the pictures' own clip regions), never at a file");
  const s = R.symbols.SPY.today, q = R.symbols.QQQ.today;
  assert.ok(PAGE.includes(`SPY has ${s.upper_rail.room_pct.toFixed(1)}% of room left`)); assert.ok(PAGE.includes(`it closed ${Math.abs(q.upper_rail.room_pct).toFixed(1)}% above its top rail`));
  assert.ok(PAGE.includes(`<b>${s.upper_rail.room_pct.toFixed(2)}% ($${s.upper_rail.room_usd.toFixed(2)}) of room</b>`));
  assert.ok(PAGE.includes(`<b>No room: ${Math.abs(q.upper_rail.room_pct).toFixed(2)}% ($${Math.abs(q.upper_rail.room_usd).toFixed(2)}) above</b>`));
  for (const sym of ["SPY", "QQQ"]) R.symbols[sym].episodes.forEach((e, i) => {   // the side-by-side picture has one panel per low, carrying that low's own multiples
    const f20 = e.rebound.first_20_sessions.multiple_of_channel_slope, f60 = e.rebound.first_60_sessions.multiple_of_channel_slope, x = (v) => (v >= 20 ? v.toFixed(0) : v.toFixed(1)) + "×";
    assert.ok(PAGE.includes(`<tspan font-weight="700">${sym} ${i + 1}</tspan>`), `${sym} ${i + 1} has its panel`);
    assert.ok(PAGE.includes(`20 sessions ${x(f20)} · 60 sessions ${x(f60)}`), `${sym} ${i + 1}: 20 and 60 session multiples`);
  });
});

test("the page keeps the house look: greys stay grey, nothing above 210, colour only where it means something", () => {
  const MEANING = new Set(["#2fa5ba", "#c98500", "#22ad79", "#c0403c"]);   // the Lab's rails, the 200-day, an up day, a down day
  const hexes = new Set((PAGE.match(/#[0-9a-fA-F]{6}\b/g) || []).map((h) => h.toLowerCase()));
  assert.ok(hexes.size >= 8);
  for (const h of hexes) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) <= 210, `${h} has a channel above 210`);
    if (!MEANING.has(h)) assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24, `${h} is neither a grey nor one of the four colours that carry meaning`);
  }
});

test("a headless browser opened the page at 1680 and 390: nothing fetched, nothing written, no text under 11 px, no sideways page scroll", () => {
  for (const w of ["1680", "390"]) {
    const rec = REC.widths[w];
    assert.deepEqual(rec.outside_requests, []); assert.deepEqual(rec.non_get, []); assert.deepEqual(rec.errors, []);
    assert.ok(rec.measured.smallest_text_px >= 11, `${w}: smallest text ${rec.measured.smallest_text_px}px`);
    assert.equal(rec.measured.page_scrolls_sideways, false); assert.equal(rec.measured.charts.length, 6);   // two price pictures per index, and the rebounds side by side for each
  }
  assert.ok(REC.widths["1680"].measured.charts.every((c) => !c.scrolls), "at 1680 every picture fits its panel");
  assert.ok(REC.widths["1680"].measured.tables.every((t) => t.table <= t.wrap + 1), "at 1680 every table fits its panel");
  assert.equal(REC.widths["1680"].hover.visible, true, "pointing at a day shows its values");
});

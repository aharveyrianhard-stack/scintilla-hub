/* RESEARCH ROUND 2 (N11, 28 Sep): the delivered page, its saved charts, its numbers, the counted search, and the arithmetic
   checked against answers worked out by hand (data/fixtures.json is written by research/python/research-round-2/fixtures.py). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "deliverables/20260928/research-round-2");
const PAGE = readFileSync(join(DIR, "RESEARCH-ROUND-2.html"), "utf8");
const J = (f) => JSON.parse(readFileSync(join(DIR, "data", f), "utf8"));

test("the page carries the way back, the status line and the four parts the common brief asks for", () => {
  assert.match(PAGE, /<!-- scnav · /);
  assert.equal((PAGE.match(/<!-- scnav · /g) || []).length, 1);
  assert.match(PAGE, /STATUS/);
  for (const h of ["What the page shows", "Where each number comes from", "What could be wrong", "What was not done"]) assert.ok(PAGE.includes(h), `page lacks "${h}"`);
  assert.ok(!/NaN|undefined|None%/.test(PAGE.replace(/<script[\s\S]*?<\/script>/g, "")), "a missing number leaked onto the page");
});

test("every chart on the page is a saved image next to it, and every saved chart is on the page", () => {
  const srcs = [...PAGE.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  for (const s of srcs) assert.ok(existsSync(join(DIR, s)), `missing chart file ${s}`);
  const files = readdirSync(join(DIR, "charts")).filter((f) => f.endsWith(".png"));
  assert.ok(files.length >= 17, `only ${files.length} charts`);
  for (const f of files) assert.ok(srcs.includes("charts/" + f), `${f} not on the page`);
});

test("the page stays monochrome apart from the up/down pair", () => {
  for (const [, hex] of PAGE.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
    const h = hex.toUpperCase(); if (h === "00FFA3" || h === "FF2D55") continue;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24 && Math.max(r, g, b) <= 210, `#${hex} is not an allowed grey`);
  }
});

test("each study names its public source with a link, in the order asked: today, P4, P5, P7, P10", () => {
  const at = (id) => PAGE.indexOf(`id="${id}"`);
  const order = ["today", "p4", "p5", "p7", "p10", "search"].map(at);
  assert.ok(order.every((x) => x > 0), "a section is missing");
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  for (const u of ["https://www.nber.org/papers/w22208", "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=962461", "https://www.nber.org/papers/w23191",
    "https://arxiv.org/abs/1404.7493", "https://school.stockcharts.com/doku.php?id=market_indicators:zweig_breadth_thrust"]) assert.ok(PAGE.includes(u), `source ${u} not linked`);
  assert.equal((PAGE.match(/STOLEN FROM/g) || []).length, 5);
});

test("the arithmetic matches answers worked out by hand", () => {
  const F = J("fixtures.json");
  // spells: 100 → 80 → back to 101 is one recovered −20% fall (2 sessions down, 2 back); 101 → 50 is an open −50.5% fall
  assert.equal(F.spells.length, 2);
  assert.deepEqual([F.spells[0].depth_pct, F.spells[0].to_low, F.spells[0].low_to_back, F.spells[0].open], [-20, 2, 2, false]);
  assert.deepEqual([F.spells[1].depth_pct, F.spells[1].to_low, F.spells[1].low_to_back, F.spells[1].open], [-50.5, 5, null, true]);
  // Kaplan–Meier: 4 at risk, one ends at 10 (3/4 left), one censored at 20, one ends at 30 (1/2 of 0.75), last at 40
  assert.deepEqual(F.km, [1, 0.75, 0.75, 0.375, 0]);
  assert.deepEqual(F.thrust, [false, false, false, true, false, false, true]);
  assert.deepEqual(F.hold, [0, 0, 0, 1, 1, 1, 0, 0]);
  assert.deepEqual(F.decluster, [0, 140]);
  // weight 0.5 then 1: day 2 earns 0.5 × −2% less 5 bps × 0.5 traded; day 3 earns 1 × 3% less 5 bps × 0.5
  assert.deepEqual(F.p4_net, [-0.01025, 0.02975]);
  assert.deepEqual(F.p4_trade, [0.5, 0.5]);
  assert.deepEqual(F.p4_weight, [1, 0.75]);
  // 200-day ±2% band: out at the start (100 is not above 100), in at 103 (> 102.02), holds at 101, out at 97 (< 98.01), stays out at 99
  assert.deepEqual(F.band, [0, 0, 1, 1, 0, 0]);
  assert.equal(F.max_dd, -0.5);
});

test("the CALM/STRESS model reproduces the research director's published reading before it is moved forward", () => {
  const C = J("calm-today.json");
  assert.equal(C.fixture.match, true);
  assert.equal(C.fixture.reproduced_date, "2026-09-25");
  assert.ok(["CALM", "STRESS"].includes(C.state_today));
  assert.ok(C.today.STRESS >= 0 && C.today.STRESS <= 1);
  assert.equal(C.state_today, C.today.STRESS >= 0.5 ? "STRESS" : "CALM");
  assert.ok(C.today.date >= "2026-09-25");
  for (const v of Object.values(C.calm_ahead_prob)) assert.ok(v >= 0 && v <= 1);
  for (const v of Object.values(C.vol_weights)) assert.ok(v.weight > 0 && v.weight <= 1);
  const TB = J("today-bars.json");
  for (const s of ["VIX", "SPY", "QQQ"]) assert.ok(TB[s].rows.length > 0 && TB[s].rows.every((r) => /^\d{4}-\d\d-\d\d$/.test(r.date) && r.c > 0));
});

test("P4: 28 rules per instrument, the search counted, weights never above 100% in the headline rule", () => {
  const P = J("p4-volsize.json");
  for (const k of ["SPY", "QQQ (from Apr 2011)", "Nasdaq-100 index since 1985", "S&P 500 index since 1928", "LEADERS10 (point-in-time top 10)"]) {
    const v = P.instruments[k]; assert.ok(v, k);
    assert.equal(Object.keys(v.rules).length, k === "Nasdaq-100 index since 1985" || k === "S&P 500 index since 1928" ? 24 : 28);
    for (const t of ["spa_vs_buy_and_hold", "spa_vs_same_exposure", "spa_vol_matched_vs_buy_and_hold"]) assert.ok(v[t].consistent >= 0 && v[t].consistent <= 1);
    assert.ok(v.rules[P.headline_rule].avg_weight <= 1);
    assert.ok(v.headline_sharpe_minus_bh.lo <= v.headline_sharpe_minus_bh.est && v.headline_sharpe_minus_bh.est <= v.headline_sharpe_minus_bh.hi);
  }
  assert.ok(P.search_count.rules_tested_total >= 300);
  assert.equal(P.instruments["QQQ (from Apr 2011)"].from >= "2011-04-01", true, "QQQ must not bridge the QQQQ hole");
});

test("P5: ten rules on every instrument, the cut and the cost are rule minus holding, pooled over the evidence set only", () => {
  const P = J("p5-trend.json");
  assert.equal(P.rules.length, 10);
  for (const [k, v] of Object.entries(P.instruments)) {
    assert.equal(Object.keys(v.rules).length, 10, k);
    for (const r of Object.values(v.rules)) {
      assert.ok(Math.abs(r.dd_cut_pts - (r.max_dd_pct - v.buy_and_hold.max_dd_pct)) < 0.02, `${k} cut`);
      assert.ok(Math.abs(r.cagr_cost_pts - (r.cagr_pct - v.buy_and_hold.cagr_pct)) < 0.02, `${k} cost`);
      assert.ok(r.time_in_pct > 0 && r.time_in_pct <= 100);
    }
  }
  const ev = Object.values(P.instruments).filter((v) => v.group !== "today's leader (survivor)").length;
  assert.equal(P.pooled_evidence_set["10-month (Faber)"].instruments, ev);
  assert.equal(P.search_count.rules_tested_total, 10 * Object.keys(P.instruments).length);
});

test("P7: open falls are counted as open, the stock pool is point in time, run-up rates carry ranges and both halves", () => {
  const P = J("p7-drawdown.json");
  assert.ok(P.pit_stocks.names > 900, "point-in-time pool should include names that left the index");
  const g = P.groups["S&P 500 stocks, point in time"]["20"]; assert.ok(g.open > 0 && g.spells > g.open);
  for (const t of [100, 150, 200]) {
    const r = P.runups[`pit_${t}`]; assert.ok(r.crash_range90[0] <= r.crash_pct && r.crash_pct <= r.crash_range90[1]);
    assert.ok(r.halves["2005-2014"].complete + r.halves["2015-2024"].complete === r.complete);
  }
  for (const k of ["Gold since 1975", "Silver since 1970", "Bitcoin since 2013", "SMH semis", "NVDA", "MU"]) assert.ok(P.named_assets[k], k);
});

test("P10: 23 rules searched on the point-in-time panel, SPA counted over every rule and holding period, today's breadth read", () => {
  const P = J("p10-breadth.json"); const R = P.results.pit;
  assert.equal(Object.keys(R.rules).length, 23);
  assert.equal(R.spa.n_rules, 69);
  assert.ok(R.spa.consistent >= 0 && R.spa.consistent <= 1);
  for (const v of Object.values(R.rules)) {
    assert.ok(["a list", "leaning", "luck-proof", "not shown"].includes(v.word));
    if (v.episodes < 20) assert.equal(v.word, "a list");
  }
  assert.equal(P.today.date, "2026-09-25");
  assert.ok(P.today.pit.above50 >= 0 && P.today.pit.above50 <= 100);
  assert.ok(P.panel.pit_names_ever > P.panel.served_names);
});

test("provenance names every input file with its hash and bar count, and the cached bars end at the 25 Sep close", () => {
  for (const f of ["provenance-p4.json", "provenance-p5.json", "provenance-p7.json", "provenance-p10.json"]) {
    const P = J(f);
    for (const [k, v] of Object.entries(P)) {
      assert.match(v.sha256_12, /^([0-9a-f]{12}( \(manifest\))?|per-file)$/, `${f} ${k}`);
      assert.ok(v.bars > 200, `${f} ${k}`);
      assert.ok(v.to >= "2026-09-25", `${f} ${k} ends ${v.to}`);
    }
  }
});

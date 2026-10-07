// PF1 (6 Oct 2026) — Alan: "I'm tired of being in cash so much. I'm missing opportunities … Give me alternatives. What do you
// suggest? Let's do some little research." A study page under deliverables/20261006/portfolio-structures/: six portfolio
// structures back-tested on our own daily bars, plus Cboe's measured option-selling indexes. These tests hold the page to its
// data: the yardstick is right, the table prints what the files hold, no rule reads the future, nothing leaves the page.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const dir = new URL("../deliverables/20261006/portfolio-structures/", import.meta.url);
const J = (n) => JSON.parse(fs.readFileSync(new URL("data/" + n, dir), "utf8"));
const html = fs.readFileSync(new URL("PORTFOLIO-STRUCTURES.html", dir), "utf8");
const pct = (x, signed = true, dp = 1) => (x < 0 ? `(${Math.abs(x).toFixed(dp)}%)` : (signed ? "+" : "") + x.toFixed(dp) + "%");
const S0 = J("s0_baselines.json");
const base = (label) => S0.variants.find((v) => v.label === label);
const FILES = ["s1_core_satellite", "s2_trend_core", "s3_dual_momentum", "s4_vol_sizing", "s5_level_scaling", "s6_paid_to_wait"];
const S = Object.fromEntries(FILES.map((k) => [k, J(k + ".json")]));

test("the yardstick: SPY's calendar-year total return from our bars + our dividends matches the published figure", () => {
  assert.ok(S0.spy_year_check.length >= 8);
  for (const r of S0.spy_year_check) assert.ok(Math.abs(r.gap) <= 0.1, `${r.year}: ours ${r.ours} vs published ${r.published}`);
});

test("buy and hold is buy and hold: 100% in stocks, no orders after the first, and cash alone never falls", () => {
  const spy = base("Buy and hold SPY"), bills = base("All cash (Treasury bills)");
  assert.equal(spy.full.avg_stock_pct, 100); assert.equal(spy.last2.decision_days_per_month, 0);
  assert.equal(bills.full.avg_stock_pct, 0); assert.ok(bills.full.max_dd_pct > -0.05); assert.ok(bills.full.cagr_pct > 1 && bills.full.cagr_pct < 3);
});

test("cash by default is the tool's own ladder: 502 sessions, and the average share in stocks is the average rung", () => {
  const lad = base("Cash by default — the July heat ladder"); const R = J("tool-replay.json");
  assert.equal(R.series.length, 502); assert.equal(lad.last2.sessions, 502);
  const mean = R.series.reduce((a, x) => a + x.heatRung, 0) / R.series.length;
  assert.ok(Math.abs(lad.last2.avg_stock_pct - mean) < 1.0, `ladder average ${lad.last2.avg_stock_pct} vs mean rung ${mean.toFixed(1)}`);
  assert.equal(Object.values(lad.rung_days).reduce((a, b) => a + b, 0), 502);
  const flat = base("A flat share in SPY equal to the ladder's average");
  assert.ok(lad.last2.total_return_pct > flat.last2.total_return_pct, "the ladder's timing added to a flat holding of the same average size");
  assert.ok(base("Buy and hold SPY").last2.total_return_pct > lad.last2.total_return_pct, "and its low average share cost more than the timing added");
});

test("every structure file has the agreed shape and plausible numbers", () => {
  for (const k of FILES) {
    const s = S[k]; assert.equal(s.structure, k); assert.ok(s.variants.length >= 2, k); assert.ok(s.rule_plain.length >= 2, k); assert.ok(s.caveats.length >= 1, k);
    for (const v of s.variants) {
      for (const w of ["full", "last2"]) {
        const m = v[w]; if (!m) continue;
        assert.ok(m.avg_stock_pct >= 0 && m.avg_stock_pct <= 100.5, `${k} ${v.key} ${w} stock share ${m.avg_stock_pct}`);
        assert.ok(m.max_dd_pct <= 0 && m.max_dd_pct > -80, `${k} ${v.key} ${w} worst fall ${m.max_dd_pct}`);
        assert.ok(m.decision_days_per_month >= 0 && m.decision_days_per_month < 22, `${k} ${v.key} ${w} decisions`);
      }
      assert.equal(v.last2.sessions, 502, `${k} ${v.key} last-two-years window`);
      assert.equal(v.scorecard.pullbacks.length, 3, `${k} ${v.key} three pullbacks scored`);
      assert.equal(v.scorecard.breakouts.length, 10, `${k} ${v.key} ten breakouts scored`);
    }
  }
});

test("self-checks: a run that is always in SPY equals buy and hold, and the second core + satellite agrees with the first", () => {
  const spy = base("Buy and hold SPY");
  assert.equal(S.s1_core_satellite.extras.self_check.no_satellite_slots_equals_buy_and_hold_spy, true);
  assert.equal(S.s4_vol_sizing.extras.self_check_always_100pct_spy.match, true);
  const once = S.s5_level_scaling.variants.find((v) => v.key === "reenter_at_once"), s2 = S.s2_trend_core.variants.find((v) => v.key === "trend_and_breadth");
  assert.ok(Math.abs(once.full.cagr_pct - s2.full.cagr_pct) <= 0.05, "structure 5's all-at-once re-entry is structure 2's rule, written twice by different hands");
  assert.ok(Math.abs(once.full.max_dd_pct - s2.full.max_dd_pct) <= 0.2);
  const C = J("s7_combined.json"); assert.equal(C.extras.check_against_structure_1.agree, true);
  assert.ok(spy.full.cagr_pct > 10 && spy.full.cagr_pct < 12);
});

test("the two entry experiments, written separately, agree on buying at once and on waiting at the 50-day", () => {
  const a = S.s5_level_scaling.extras.entry_experiment.tables.all.filter((r) => r.asset === "SPY" && r.horizon === 252);
  const b = S.s6_paid_to_wait.extras.entry_experiment.full.methods;
  const m1 = a.find((r) => r.method === "M1"), m5 = a.find((r) => r.method === "M5");
  const lump = b.lump.mean_pct ?? b.lump.mean_end_pct, wait = b.wait_limit_50d.mean_pct ?? b.wait_limit_50d.mean_end_pct;
  assert.ok(Math.abs(m1.mean_pct - lump) <= 0.1, `lump ${m1.mean_pct} vs ${lump}`); assert.ok(Math.abs(m5.mean_pct - wait) <= 0.1, `wait ${m5.mean_pct} vs ${wait}`);
});

test("structure 6 rests on the measured record: Cboe's PUT calendar years as published, and the model is shown to be too rich", () => {
  const M = J("s6b_cboe_measured.json"); const put = M.variants.find((v) => v.key === "put_measured");
  for (const [y, p] of Object.entries({ 2008: -26.8, 2009: 31.5, 2018: -5.9, 2020: 2.1, 2021: 21.8, 2022: -7.7 })) assert.ok(Math.abs(put.years[y] - p) <= 0.15, `PUT ${y}: ${put.years[y]} vs ${p}`);
  assert.ok(put.full.cagr_pct < put.spy_same_window.cagr_pct, "put selling made less than the index over the same years");
  const g = M.model_gap.find((x) => x.measured === "PUT"); assert.ok(g.model_minus_measured_pts > 1, "our model's flattery is measured and printed");
  assert.match(html, /points too rich/);
});

test("the comparison table prints what the files hold", () => {
  const i = html.indexOf(">The comparison table</h2>"); assert.ok(i > 0); const sec = html.slice(i, html.indexOf("</section>", i));
  const rowOf = (name) => { const j = sec.indexOf(`<td>${name}`); assert.ok(j > 0, "row " + name); return sec.slice(j, sec.indexOf("</tr>", j)); };
  const check = (name, v) => {
    const r = rowOf(name); const want = [];
    if (v.full) want.push(pct(v.full.cagr_pct), pct(v.full.max_dd_pct, false));
    want.push(pct(v.last2.total_return_pct), pct(v.last2.max_dd_pct, false));
    let at = 0; for (const w of want) { const k = r.indexOf(`>${w}<`, at); assert.ok(k >= 0, `${name}: ${w} missing or out of order in the row`); at = k + 1; }
  };
  const names = { s1_core_satellite: "1 · Core + satellite", s2_trend_core: "2 · Trend-filtered core", s3_dual_momentum: "3 · Dual momentum", s4_vol_sizing: "4 · Volatility-targeted sizing", s5_level_scaling: "5 · Level-based scaling in" };
  for (const [k, n] of Object.entries(names)) check(n, S[k].variants[0]);
  check("2b · Trend-filtered core, three-close wait", S.s2_trend_core.variants.find((v) => v.key === "trend_and_breadth_3day"));
  check("6 · Getting paid to wait", J("s6b_cboe_measured.json").variants.find((v) => v.key === "put_measured"));
  check("Buy and hold SPY", base("Buy and hold SPY")); check("Cash by default — the July heat ladder", base("Cash by default — the July heat ladder"));
  check("1 + 2b together", J("s7_combined.json").variants.find((v) => v.key === "core_sat_filtered"));
});

test("no rule reads the future, and no order is anything but a simulated one", () => {
  const tools = new URL("tools/", dir);
  for (const f of fs.readdirSync(tools).filter((n) => /^(s\d|pf1lib)/.test(n) && n.endsWith(".py"))) {
    const src = fs.readFileSync(new URL(f, tools), "utf8").split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");
    assert.ok(!/\.shift\(\s*-\s*\d/.test(src), f + " shifts a series backwards (reads a later row)");
    assert.ok(!/center\s*=\s*True/.test(src), f + " uses a centred window");
    assert.ok(!/ibkr|ib_insync|placeOrder|tws/i.test(src), f + " mentions a broker connection");
  }
});

test("the page is self-contained, carries the way back and the page specs, and leaks nothing", () => {
  assert.ok(!/<script[^>]+src=/.test(html), "no external script"); assert.ok(!/<link[^>]+href=/.test(html), "no external stylesheet"); assert.ok(!/<img[^>]+src=["']https?:/.test(html), "no remote image");
  assert.match(html, /<details class="sc-pagespecs"><summary>PAGE SPECS<\/summary>/);
  assert.match(html, /<!-- scnav · /, "the BACK / CLOSE pair is on the page");
  assert.match(html, /not a licensed adviser/); assert.match(html, /not orders/);
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === "_raw" ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]));
  for (const f of walk(dir.pathname.replace(/%20/g, " "))) {
    if (/\.(png|gz)$/.test(f)) continue;
    assert.ok(!/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(fs.readFileSync(f, "utf8")), "a token-shaped string is in " + path.basename(f));
  }
});

test("the look: every colour on the page is a quiet grey, a declared series colour or a direction colour", () => {
  const allowed = new Set(["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#19b37d", "#e0526c"]);   // five series hues (validated), up, down
  const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>")) + html.slice(html.indexOf("<main>"), html.indexOf("<!-- scnav"));
  for (const h of new Set((css.match(/#[0-9a-fA-F]{6}\b/g) || []).map((x) => x.toLowerCase()))) {
    if (allowed.has(h)) continue;
    const [r, g, b] = [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24 && Math.max(r, g, b) <= 210, h + " is neither a quiet grey nor a declared chart colour");
  }
});

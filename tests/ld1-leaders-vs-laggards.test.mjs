/* LD1 (6 Oct 2026) · leaders vs laggards: the study page and the file behind it say the same thing, the groups follow the
   stated rule, every count can be recounted from the names, and the page keeps the Hub's look and its way back. */
import test from "node:test"; import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs"; import { fileURLToPath } from "node:url"; import path from "node:path";
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../deliverables/20261006/leaders-vs-laggards");
const S = JSON.parse(readFileSync(path.join(DIR, "study.json"), "utf8"));
const SEL = JSON.parse(readFileSync(path.join(DIR, "selection.json"), "utf8"));
const PAGE = readFileSync(path.join(DIR, "LEADERS-VS-LAGGARDS.html"), "utf8");
const UP = "#199e70", DOWN = "#d55181";

test("LD1: leaders are the 25 highest scores, laggards the 20 lowest plus the brief's names from the bottom third", () => {
  const rank = Object.fromEntries(SEL.all.map((n) => [n.ticker, n.rank])), N = SEL.field;
  assert.equal(S.groups.leader.length, 25);
  assert.deepEqual(S.groups.leader.map((t) => rank[t]).sort((a, b) => a - b), Array.from({ length: 25 }, (_, i) => i + 1));
  const bottom = S.groups.laggard.filter((t) => rank[t] > N - 20), named = S.groups.laggard.filter((t) => rank[t] <= N - 20), asked = SEL.named_in_brief.map((x) => x.ticker);
  assert.equal(bottom.length, 20);
  for (const t of named) { assert.ok(asked.includes(t), `${t} is a laggard outside the bottom 20 without being named in the brief`); assert.ok(rank[t] > Math.ceil(N * 2 / 3), `${t} is not in the bottom third`); }
  for (const t of S.groups.named_mid) { assert.ok(asked.includes(t)); assert.ok(rank[t] <= Math.ceil(N * 2 / 3)); }
  assert.ok(S.groups.laggard.includes("CBRS"), "CBRS, the name Alan asked about, is among the laggards");
});

test("LD1: every counted condition can be recounted from the names, and no name is counted twice", () => {
  assert.ok(S.conditions.length >= 20);
  for (const c of S.conditions) {
    for (const [g, size] of [["leaders", S.groups.leader.length], ["laggards", S.groups.laggard.length]]) {
      const { yes, no, no_reading } = c[g];
      assert.equal(new Set([...yes, ...no, ...no_reading]).size, size, `${c.id}: ${g} must each sit in exactly one of yes / no / no reading`);
      assert.equal(yes.length + no.length + no_reading.length, size, `${c.id}: ${g} counted twice`);
      assert.equal(c[g + "_yes"], yes.length); assert.equal(c[g + "_n"], yes.length + no.length);
    }
    if (c.gap_points != null) assert.ok(Math.abs(c.gap_points - (c.leaders_yes / c.leaders_n - c.laggards_yes / c.laggards_n) * 100) < 0.06, `${c.id}: the gap is the difference of the two shares`);
  }
});

test("LD1: a judgement call the two readers disagree on is left out of the counts", () => {
  for (const [t, n] of Object.entries(S.names)) for (const k of ["eps_rev_90d_direction", "rev_est_rev_90d_direction", "guidance_direction"]) {
    const st = n[k + "_status"]; assert.ok(st, `${t} ${k} carries its status`);
    if (st.startsWith("two readings disagree")) assert.equal(n[k], null, `${t} ${k}: disputed, so no reading`);
  }
});

test("LD1: the page prints the counts the study file holds", () => {
  const C = Object.fromEntries(S.conditions.map((c) => [c.id, c]));
  for (const id of S.conditions_sorted_ids) { const c = C[id]; assert.ok(PAGE.includes(`${c.leaders_yes} of ${c.leaders_n}`) && PAGE.includes(`${c.laggards_yes} of ${c.laggards_n}`), `${id} is on the page as counts`); }
  for (const t of [...S.groups.leader, ...S.groups.laggard, ...S.groups.named_mid]) assert.ok(PAGE.includes(`<b>${t}</b>`), `${t} has a row`);
  assert.match(PAGE, /OPINION · THE AGENT'S OWN READ, NOT A MEASUREMENT/);
});

test("LD1: the leaders' combined market value is the sum of its rows, then and now", () => {
  const L = S.groups.leader.map((t) => S.names[t]), sum = (k) => L.reduce((a, n) => a + (n[k] || 0), 0);
  assert.ok(Math.abs(S.caps.leaders.now_b - sum("cap_now_b")) < 0.01); assert.ok(Math.abs(S.caps.leaders.run_start_b - sum("cap_run_start_b")) < 0.01);
  for (const n of L) { assert.ok(n.cap_now_b > 0, `${n.ticker} has a market value now`); assert.ok(Math.abs(n.cap_added_in_run_b - (n.cap_now_b - n.cap_run_start_b)) < 1e-6); }
});

test("LD1: the page keeps the Hub's look: greys and the two direction colours only, text 11px or more, the way back, PAGE SPECS", () => {
  const own = PAGE.replace(/<!-- scnav[\s\S]*?<!-- \/scnav -->/, "");
  for (const hex of new Set((own.match(/#[0-9a-fA-F]{6}\b/g) || []).map((h) => h.toLowerCase()))) {
    if (hex === UP || hex === DOWN) continue;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24 && Math.max(r, g, b) <= 210, `${hex} is neither a quiet grey nor a direction colour`);
  }
  for (const m of own.matchAll(/font-size[:=]\s*"?(\d+(?:\.\d+)?)(?:px)?/g)) assert.ok(+m[1] >= 11, `text at ${m[1]}px is under 11`);
  for (const m of own.matchAll(/font:\s*(?:\d+\s+)?(\d+(?:\.\d+)?)px/g)) assert.ok(+m[1] >= 11, `text at ${m[1]}px is under 11`);
  assert.match(PAGE, /class="scnav"|scnav-css/, "the BACK / CLOSE pair is on the page");
  assert.match(PAGE, /<details class="sc-pagespecs"><summary>PAGE SPECS<\/summary>/);
  assert.doesNotMatch(own, /<script/i, "the study page runs no script of its own");
});

test("LD1: nothing in the folder carries a key or a token", () => {
  const walk = (d) => readdirSync(d).flatMap((f) => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
  for (const f of walk(DIR)) { if (/\.png$/.test(f)) continue; const s = readFileSync(f, "utf8"); assert.doesNotMatch(s, /eyJhbGciOi[A-Za-z0-9_-]{8,}|sb_secret_|sk-[A-Za-z0-9]{20,}|apikey=[A-Za-z0-9]{12,}/, `${path.basename(f)} carries something that looks like a key`); }
});

/* ---- second pass, 7 Oct 2026: the first run stopped before it could return, so its work was re-derived and re-read first-hand ---- */
const OP = JSON.parse(readFileSync(path.join(DIR, "opinion.json"), "utf8"));
const AUD = JSON.parse(readFileSync(path.join(DIR, "data/audit-firsthand.json"), "utf8"));
const RC = JSON.parse(readFileSync(path.join(DIR, "data/closes-recheck.json"), "utf8")).by_symbol;

test("LD1 second pass: the groups are ranked on one close and shown at a later one, and the page says which", () => {
  assert.ok(S.closes_through > S.ranked_on, "shown at a later close than the ranking");
  assert.equal(S.ranked_on, SEL.closes_through);
  for (const [t, n] of Object.entries(S.names)) { assert.ok(Number.isInteger(n.rank) && Number.isInteger(n.rank_now), `${t} carries both ranks`); assert.equal(n.close_last, RC[t].closes[S.closes_through], `${t} is shown at the newest close`); }
  assert.match(PAGE, /ranked on the 5 Oct close · shown at the 6 Oct close/);
});

test("LD1 second pass: every return on the page re-derives from the closes pulled first-hand", () => {
  const cal = Object.keys(RC.SPY.closes).sort(), now = S.closes_through; assert.equal(cal.at(-1), now);
  for (const [t, n] of Object.entries(S.names)) {
    const c = RC[t].closes, near = (a, b) => Math.abs(a - b) < 1e-9;
    assert.ok(near(n.r_run, c[now] / c[S.run_start] - 1), `${t} bounce`); assert.ok(near(n.r3m, c[now] / c[cal.at(-64)] - 1), `${t} 3 months`); assert.ok(near(n.r1m, c[now] / c[cal.at(-22)] - 1), `${t} 1 month`);
  }
});

test("LD1 second pass: market value is on one basis, so the same thing never has two figures", () => {
  const d = S.checks.who_added_the_dollars, c = S.caps;
  assert.ok(Math.abs(d.leaders_added_b - (c.leaders.now_b - c.leaders.run_start_b)) < 0.01, "what the leaders added is one number, in the table and in the dollars check");
  assert.ok(Math.abs(d.field_added_b - (c.field.now_b - c.field.run_start_b)) < 0.01, "and so is the field's");
  for (const n of Object.values(S.names)) if (n.cap_now_b != null) assert.ok(Math.abs(n.cap_now_b - n.shares_m * n.close_last / 1000) < 1e-6, `${n.ticker}: value = shares x close`);
  assert.deepEqual(c.counted_once, { GOOG: "GOOGL" }, "Alphabet's two share lines are one company");
  assert.ok(c.field.now_b < 40000, "the field total no longer carries Alphabet twice");
});

test("LD1 second pass: a first-hand estimate reading is in the counts, and none contradicts the first run", () => {
  assert.ok(AUD.estimate_pairs.length >= 12);
  for (const e of AUD.estimate_pairs) {
    const n = S.names[e.ticker]; assert.ok(n, `${e.ticker} is a studied name`);
    assert.equal(n.eps_rev_90d_direction, e.direction, `${e.ticker}: the count uses what the page showed on 7 Oct`);
    const band = e.pct == null ? null : Math.abs(e.pct) <= 2 ? "flat" : e.pct > 0 ? "up" : "down";
    if (band && e.then > 0 && e.now > 0) assert.equal(e.direction, band, `${e.ticker}: the direction follows the 2% rule`);
    assert.ok(/^https:\/\//.test(e.source));
  }
  for (const [t, n] of Object.entries(S.names)) assert.ok(!String(n.eps_rev_90d_direction_status).startsWith("first-hand re-check disagrees"), `${t}: no contradiction to report`);
});

test("LD1 second pass: every leader marked 'raised' says which kind of raise it was", () => {
  const C = Object.fromEntries(S.conditions.map((c) => [c.id, c])), gk = AUD.guidance_kind;
  const both = [...gk.raised_a_published_full_year_range, ...gk.guided_above_what_analysts_expected];
  assert.deepEqual([...both].sort(), [...C.guide_raised.leaders.yes].sort(), "the two kinds together are exactly the leaders counted as raised");
  assert.equal(new Set(both).size, both.length, "no leader is in both kinds");
  for (const [t, n] of Object.entries(S.names)) if (n.guidance_direction === "raised") assert.ok(["full year", "above forecasts"].includes(n.guidance_kind), `${t} is marked raised without a kind`);
});

test("LD1 second pass: the Cerebras lock-up arithmetic adds up", () => {
  const rows = AUD.cbrs.release_schedule.rows, sup = AUD.cbrs.supply_arithmetic, sum = (f) => rows.filter(f).reduce((a, r) => a + r.m, 0), near = (a, b) => Math.abs(a - b) < 0.051;
  assert.ok(near(sum((r) => r.date <= "2026-10-28"), 171.1), "the ten early releases are about 171 million");
  assert.ok(near(sum((r) => r.date > "2026-08-12" && r.state === "freed"), sup.freed_since_the_12_aug_report_m));
  assert.ok(near(sum((r) => r.date > S.run_start && r.date <= S.closes_through), sup.of_which_inside_the_bounce_15sep_6oct_m));
  assert.ok(near(sum((r) => r.state === "to come" && r.date <= "2026-10-28"), sup.still_to_come_14_and_28_oct_m));
  assert.ok(Math.abs(sup.shares_outstanding_m - sup.sold_at_the_ipo_m - 171.1 - sup.left_for_9_nov_m_my_arithmetic) < 0.1, "what is left for 9 Nov is outstanding less the listing less the early releases");
  for (const r of rows) assert.equal(r.state, r.date <= S.closes_through ? "freed" : "to come", `${r.date} is on the right side of today`);
  const ins = JSON.parse(readFileSync(path.join(DIR, "data/cbrs-insider-sales.json"), "utf8"));
  assert.equal(ins.total_shares, ins.rows.reduce((a, r) => a + r.shares, 0)); assert.equal(ins.total_usd, ins.rows.reduce((a, r) => a + r.usd, 0));
});

test("LD1 second pass: the opinion leads with the answer, defines nothing twice, and carries the market-value answer in its own words", () => {
  const C = Object.fromEntries(S.conditions.map((c) => [c.id, c])), text = OP.paragraphs.map((p) => p.text).join(" ");
  assert.match(OP.paragraphs[0].text, /^In my opinion the leaders led because/);
  for (const p of OP.paragraphs) assert.ok(p.head && p.text, "each paragraph has a short heading");
  for (const id of ["guide_raised", "eps_rev_up", "rev_q_20", "eps_pos", "fcf_pos", "diluting", "comps_up_1m"]) assert.ok(text.includes(`${C[id].leaders_yes} of ${C[id].leaders_n}`), `${id}: the leaders' count in the words is the study's`);
  for (const id of ["guide_raised", "eps_rev_down", "rev_q_20", "diluting", "comps_up_1m"]) assert.ok(text.includes(`${C[id].laggards_yes} of ${C[id].laggards_n}`), `${id}: the laggards' count in the words is the study's`);
  const mv = OP.paragraphs.find((p) => p.head === "Market value").text, tr = (v) => `$${(v / 1000).toFixed(2)} trillion`;
  for (const v of [S.caps.leaders.selloff_start_b, S.caps.leaders.run_start_b, S.caps.leaders.now_b, S.caps.laggards.run_start_b, S.caps.laggards.now_b]) assert.ok(mv.includes(tr(v)), `${tr(v)} is in the market-value paragraph`);
  assert.ok(mv.includes("Cerebras was worth"), "the stock that was asked about has its own value");
  assert.doesNotMatch(text, /\b(UP|DOWN|CHANGE|NEXT|LAST|OWN|AND)\b(?! [A-Z])/, "no capitals for stress");
  assert.ok(OP.against.length >= 6 && OP.short.startsWith("OPINION."));
});

test("LD1 second pass: the page carries the Cerebras picture and the re-check, and still runs no script", () => {
  assert.match(PAGE, /2c · CEREBRAS \(CBRS\): ITS SHARE PRICE, AND THE SHARES FREED FOR SALE/);
  assert.match(PAGE, /11 · THE SECOND PASS, 7 OCT: WHAT WAS RE-READ FIRST-HAND/);
  assert.equal((PAGE.match(/<svg /g) || []).length, 2, "two pictures drawn as SVG: the field, and Cerebras");
  assert.match(PAGE, /580 of 580 match/);
  assert.match(PAGE, /11g · A TEST ON NAMES THE FINDING WAS NOT BUILT FROM/);
  const oos = AUD.out_of_sample; assert.equal(oos.result.read, oos.rows.length); assert.equal(oos.result.estimate_raised, oos.rows.filter((r) => r.estimate === "up").length); assert.equal(oos.result.gave_a_higher_outlook, oos.rows.filter((r) => r.guidance === "raised").length);
  for (const r of oos.rows) { assert.ok(!S.names[r.ticker], `${r.ticker} was not one of the names the finding was built from`); assert.ok(oos.entered_top_25.includes(r.ticker)); assert.ok(r.now > r.then === (r.estimate === "up")); }
  assert.deepEqual([...oos.entered_top_25].sort(), S.recheck.rerank.leaders_entered.map((x) => x[0]).sort(), "the six tested are exactly the six the re-rank brings in");
  for (const e of AUD.cbrs.items) assert.ok(PAGE.includes(e.fact.replace(/&/g, "&amp;").replace(/'/g, "&#x27;")), `the Cerebras fact "${e.fact}" has a row`);
});

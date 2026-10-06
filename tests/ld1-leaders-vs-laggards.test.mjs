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

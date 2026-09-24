import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

/* M45 · THE TREE (24 Sep). Alan: "we need a better way of measuring the cohorts versus sectors downwards.
   From broad market down to branching outwards." and "I don't want to have to make watch lists."

   These rules hold the proposal to what it claims:
     · every served name is placed, exactly once, on exactly one trunk, and no company is left off a branch;
     · a parent node's members are the union of its children's, so a roll-up cannot quietly lose names;
     · the readings shown on a node are recomputable from the per-name numbers in the same file;
     · the preview writes nothing anywhere and carries no key;
     · the migration is additive, with its rollback in the same file;
     · the look follows the 23 Sep rules: greys only, except green/red for direction, and no text under 11px. */

const url = (p) => new URL("../" + p, import.meta.url);
const read = (p) => fs.readFileSync(url(p), "utf8");
const TAX = JSON.parse(read("data/taxonomy-20260924.json"));
const PAGE = read("deliverables/20260924/tree/prototype.html");
const DOC = read("deliverables/20260924/tree/TREE.html");
const MIG = read("supabase/migrations/20260924_taxonomy_tree.sql");
const N = TAX.nodes, P = TAX.profiles;

test("every served name is placed exactly once, and the trunks add up to the universe", () => {
  const syms = Object.keys(P);
  assert.equal(syms.length, TAX.provenance.universe.count);
  const trunks = ["COMPANIES", "FUNDS", "INSTRUMENTS"].filter((t) => N[t]);
  const seen = new Map();
  for (const t of trunks) for (const s of N[t].members) {
    assert.ok(!seen.has(s), `${s} sits on two trunks: ${seen.get(s)} and ${t}`);
    seen.set(s, t);
  }
  assert.equal(seen.size, syms.length, "every served name belongs to one trunk");
  for (const s of syms) assert.ok(seen.has(s), `${s} is served but on no trunk`);
});

test("no company is left off a branch", () => {
  assert.deepEqual(TAX.unbranched, [], "these names matched no branch rule");
  const onBranch = new Set();
  for (const n of Object.values(N)) if (n.level === "branch") n.members.forEach((m) => onBranch.add(m));
  assert.equal(onBranch.size, N.COMPANIES.n);
  for (const t of N.COMPANIES.members) assert.ok(onBranch.has(t), `${t} is a company on no branch`);
});

test("a name sits on exactly one branch, so a branch roll-up never double counts", () => {
  const count = new Map();
  for (const n of Object.values(N)) if (n.level === "branch")
    n.members.forEach((m) => count.set(m, (count.get(m) || 0) + 1));
  const twice = [...count].filter(([, c]) => c > 1).map(([t]) => t);
  assert.deepEqual(twice, [], "these names are on more than one branch");
});

test("every parent holds all of its children's names", () => {
  for (const n of Object.values(N)) {
    if (n.parent !== null) assert.ok(N[n.parent], `${n.id} points at a parent that does not exist`);
    const kids = Object.values(N).filter((k) => k.parent === n.id);
    if (!kids.length) continue;
    const mine = new Set(n.members);
    for (const k of kids) for (const m of k.members)
      assert.ok(mine.has(m), `${m} is on ${k.id} but not on its parent ${n.id}`);
  }
});

test("the readings on a node are the readings its own names produce", () => {
  for (const n of Object.values(N)) {
    const comps = n.members.map((t) => P[t] && P[t].geiger).filter((v) => v !== null && v !== undefined);
    assert.equal(n.geiger_n, comps.length, `${n.id} counts a different number of Geiger values`);
    if (comps.length) {
      const mean = comps.reduce((a, b) => a + b, 0) / comps.length;
      assert.ok(Math.abs(mean - n.geiger_mean) < 1e-3, `${n.id} Geiger mean is not the mean of its names`);
      const breadth = 100 * comps.filter((c) => c >= 0.5).length / comps.length;
      assert.ok(Math.abs(breadth - n.breadth_pct) < 0.11, `${n.id} breadth does not match its names`);
    }
    const caps = n.members.map((t) => (P[t] && P[t].market_cap) || 0).reduce((a, b) => a + b, 0);
    if (n.market_cap) assert.equal(n.market_cap, caps, `${n.id} market cap is not the sum of its names`);
  }
});

test("a reading is never invented: put/call is empty and says why, and sentiment states its sample", () => {
  for (const n of Object.values(N)) {
    assert.equal(n.put_call, null, `${n.id} shows a put/call number that nothing produces yet`);
    assert.ok(/does not exist yet/.test(n.put_call_reason));
    assert.ok(n.sentiment_n <= n.n);
    if (n.sentiment_mean !== null) assert.ok(n.sentiment_n > 0);
  }
  assert.ok(/not yet/.test(PAGE), "the preview must say 'not yet' for put/call rather than print a zero");
  assert.ok(/SENTIMENT/.test(PAGE) && /sentiment_n/.test(PAGE), "the sentiment tile must carry its sample size");
});

test("every number on the preview names where it came from", () => {
  for (const k of ["universe", "geiger", "quotes", "profile", "cohorts", "sentiment", "eps", "favourites"])
    assert.ok(TAX.provenance[k], `provenance is missing ${k}`);
  assert.ok(TAX.provenance.quotes.session_et, "the served session must be named, not inferred from the build time");
  assert.ok(/chart API/.test(PAGE) && /company_profile/.test(PAGE));
});

test("the preview writes nothing and carries no key", () => {
  assert.ok(!/eyJhbGciOi/.test(PAGE), "no key may be embedded in a deliverable page");
  assert.ok(!/method:\s*["'](POST|PATCH|PUT|DELETE)/i.test(PAGE), "the preview must not write");
  assert.ok(!/localStorage|sessionStorage/.test(PAGE), "the preview must not keep state on Alan's machine");
  assert.ok(/write nothing|nothing is written/.test(PAGE), "the page must say on screen that it writes nothing");
});

test("the preview and the document carry the way back", () => {
  for (const [name, src] of [["prototype", PAGE], ["TREE", DOC]]) {
    assert.ok(/<!-- scnav/.test(src), `${name} is missing the BACK / CLOSE pair`);
    assert.ok(/BACK/.test(src) && /CLOSE/.test(src), `${name} lost the pair's labels`);
  }
});

test("the look follows the 23 Sep rules: greys, no white, direction in green and red, nothing under 11px", () => {
  const DIRECTION = new Set(["#35b06a", "#d1483f"]);
  for (const [name, src] of [["prototype", PAGE], ["TREE", DOC]]) {
    const head = src.slice(0, src.indexOf("</style>"));
    for (const hex of head.match(/#[0-9a-fA-F]{6}\b/g) || []) {
      if (DIRECTION.has(hex.toLowerCase())) continue;
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      assert.ok(spread <= 24, `${name}: ${hex} is not a grey (channels differ by ${spread})`);
      assert.ok(Math.max(r, g, b) <= 210, `${name}: ${hex} is brighter than 210 — too close to white`);
    }
    /* "white-space" is a layout property, not a colour — only a colour value counts here. */
    assert.ok(!/#fff\b|#ffffff|:\s*white\b/i.test(head), `${name} uses white`);
    for (const px of head.match(/font(?:-size)?:\s*(\d+)px/g) || []) {
      const v = +px.match(/(\d+)px/)[1];
      assert.ok(v >= 11, `${name} sets ${v}px text, under the 11px floor`);
    }
  }
});

test("the document shows the screenshots it claims, and both files exist", () => {
  for (const shot of ["desktop-1680.png", "phone-390.png"]) {
    assert.ok(DOC.includes(shot), `TREE.html does not show ${shot}`);
    assert.ok(fs.existsSync(url("deliverables/20260924/tree/" + shot)), `${shot} is missing`);
  }
});

test("the migration is additive and carries its own rollback", () => {
  const live = MIG.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  /* a statement that changes something that exists — "on delete cascade" inside a new table's
     foreign key is not one of those, so the check is anchored to the start of a statement. */
  assert.ok(!/(^|;)\s*(drop|alter|truncate|update)\s|\bdelete\s+from\b/i.test(live),
    "the migration must not change anything that exists");
  for (const t of ["taxonomy_nodes", "taxonomy_membership", "taxonomy_list_rules"])
    assert.ok(new RegExp(`create table if not exists public.${t}`).test(live), `${t} is missing`);
  assert.ok(/-- ROLLBACK[\s\S]*drop table if exists public.taxonomy_nodes;/.test(MIG), "the rollback must be in the file");
  assert.ok(!/eyJhbGciOi/.test(MIG));
});

test("the five lists are rules, not saved sets of tickers", () => {
  const ids = ["OVERSOLD_QUALITY", "LEADERS_PULLING_BACK", "SCINTILLAS", "CHEAPER_GROWING_FASTER", "FAVOURITES_IN_RED"];
  for (const id of ids) assert.ok(MIG.includes(`'${id}'`), `${id} is missing from taxonomy_list_rules`);
  assert.ok(!/'ticker'\s*:\s*\[/.test(MIG), "a list must not hold a fixed ticker list");
  for (const label of ["OVERSOLD QUALITY", "LEADERS PULLING BACK", "SCINTILLAS", "CHEAPER, GROWING FASTER", "FAVOURITES IN RED"])
    assert.ok(PAGE.includes(label), `the preview is missing the ${label} list`);
});

test("the cohorts are reported on, not edited", () => {
  const audit = JSON.parse(read("data/taxonomy-audit-20260924.json"));
  const kinds = audit.cohort_findings.map((f) => f.kind);
  for (const k of ["SAME_NAME_TWO_SPELLINGS", "COHORT_ROWS_FOR_NAMES_THE_HUB_CANNOT_PRICE",
                   "MACHINE_GENERATED_INDUSTRY_COHORTS", "TWO_ENGINES_DISAGREE"])
    assert.ok(kinds.includes(k), `the audit no longer reports ${k}`);
  for (const f of audit.cohort_findings) {
    assert.ok(f.fix && f.impact, `${f.kind} must carry both a fix and its impact`);
  }
  assert.ok(!/update public.ticker_cohorts|delete from public.cohorts/i.test(MIG), "no cohort row may be edited by this lane");
});

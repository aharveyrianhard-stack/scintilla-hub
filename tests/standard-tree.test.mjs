// M54 · the standard tree: the data is a real partition, the comparisons compare like with like,
// the 22 instrument rows carry their evidence, and both pages obey the house look.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const D = J("data/standard-tree-20260924.json");
const PRICE = J("data/instrument-pricing-20260924.json");
const COH = J("data/cohort-label-origin-20260924.json");
const PROTO = readFileSync(join(ROOT, "deliverables/20260924/tree-2/prototype.html"), "utf8");
const DOC = readFileSync(join(ROOT, "deliverables/20260924/tree-2/TREE-2.html"), "utf8");

test("every name sits on exactly one industry, one group and one sector", () => {
  const seen = { industry: new Map(), group: new Map(), sector: new Map() };
  for (const n of Object.values(D.nodes)) {
    if (!["industry", "group", "sector"].includes(n.level)) continue;
    for (const t of n.members) {
      const m = seen[n.level];
      assert.equal(m.get(t), undefined, `${t} is on two ${n.level} branches: ${m.get(t)} and ${n.id}`);
      m.set(t, n.id);
    }
  }
  for (const level of ["industry", "group", "sector"]) {
    assert.equal(seen[level].size, Object.keys(D.names).length, `${level} level does not cover every name`);
  }
  assert.equal(D.nodes.MARKET.members.length, Object.keys(D.names).length);
  assert.equal(D.unmapped_industries.length, 0, "an industry fell through the GICS table");
});

test("all eleven sectors are anchored to a served SPDR that has its own Geiger", () => {
  const sectors = D.nodes.MARKET.children;
  assert.equal(sectors.length, 11);
  for (const id of sectors) {
    const n = D.nodes[id];
    assert.ok(D.sector_etf[n.label], `${n.label} has no anchor ETF`);
    assert.equal(n.anchor_etf, D.sector_etf[n.label]);
    assert.ok(n.anchor && typeof n.anchor.geiger === "number", `${n.anchor_etf} has no Geiger`);
  }
});

test("the comparison compares like with like, and both sides sum to the whole", () => {
  assert.equal(D.comparison.length, 11);
  let hubCap = 0, spCap = 0, hubN = 0, spN = 0;
  for (const c of D.comparison) {
    for (const k of ["hub_cap_share_pct", "sp500_cap_share_pct", "hub_count_share_pct", "sp500_count_share_pct"]) {
      assert.equal(typeof c[k], "number", `${c.gics_sector} is missing ${k}`);
    }
    hubCap += c.hub_cap_share_pct; spCap += c.sp500_cap_share_pct;
    hubN += c.hub_count_share_pct; spN += c.sp500_count_share_pct;
    if (c.hub_share_of_sector_index_weight_pct != null) {
      assert.ok(c.hub_share_of_sector_index_weight_pct <= 100.5,
        `${c.gics_sector} claims to cover more than all of its sector's index weight`);
    }
  }
  for (const [label, v] of [["hub by cap", hubCap], ["hub by count", hubN], ["S&P by count", spN]]) {
    assert.ok(Math.abs(v - 100) < 0.6, `${label} sums to ${v}, not 100`);
  }
  assert.ok(spCap > 97 && spCap <= 100.5, `S&P by cap sums to ${spCap}`);
});

test("the tech claim is stated like with like, not weight against count", () => {
  const t = D.comparison.find((c) => c.gics_sector === "Information Technology");
  assert.ok(Math.abs(t.hub_cap_share_pct - t.sp500_cap_share_pct) < 5,
    "Hub and S&P technology weights should be close; if this fails the claim needs rewriting, not the test");
  assert.ok(t.hub_count_share_pct > t.sp500_count_share_pct, "the Hub does hold proportionally more tech names");
  assert.ok(DOC.includes("40% of the Hub is technology"), "the deliverable must quote the claim it corrects");
});

test("each index branch either measures its members or says it did not", () => {
  assert.equal(D.indexes.length, 4);
  for (const ix of D.indexes) {
    assert.ok(ix.anchor_etf && ix.anchor, `${ix.label} has no anchor ETF reading`);
    if (ix.membership === "measured") {
      assert.ok(ix.members_in_hub > 0 && ix.hub_weight_of_index_pct > 0);
      assert.ok(ix.hub_weight_of_index_pct <= 100.5);
    } else {
      assert.equal(ix.members_in_hub, null);
      assert.match(ix.source, /not obtained/);
    }
  }
});

test("the 22 instrument rows each carry the evidence behind their verdict", () => {
  const rows = Object.entries(PRICE.rows);
  assert.equal(rows.length, 22);
  for (const [t, r] of rows) {
    assert.ok(r.verdict, `${t} has no verdict`);
    if (r.chart_api_candles.served) {
      assert.ok(r.chart_api_candles.last_bar_et, `${t} is served but has no last bar`);
      assert.match(r.verdict, /PRICED OUTSIDE THE STOCK LIST/);
    }
    if (r.verdict === "NOT PRICED ANYWHERE TONIGHT") {
      assert.equal(r.chart_api_candles.served, false);
      assert.equal(r.live_quote.age_minutes, null, `${t} is called unpriced but has a quote`);
    }
    if (r.live_quote.age_minutes !== null && r.live_quote.age_minutes <= 15) {
      assert.notEqual(r.verdict, "NOT PRICED ANYWHERE TONIGHT");
    }
  }
  const priced = rows.filter(([, r]) => r.verdict !== "NOT PRICED ANYWHERE TONIGHT").length;
  assert.ok(priced >= 20, `only ${priced} of 22 priced; the deliverable's sentence would be wrong`);
});

test("the machine-made cohort count is measured, and the two groups add up", () => {
  assert.equal(COH.match_an_fmp_industry_name + COH.do_not, COH.distinct_cohorts);
  assert.equal(COH.machine_made.length, COH.match_an_fmp_industry_name);
  for (const m of COH.machine_made) assert.ok(m.fmp_industry, `${m.cohort} has no source industry`);
  assert.ok(DOC.includes(COH.plain_sentence.slice(0, 40)), "the deliverable must carry the plain sentence");
});

test("both pages keep the house look: greys only, direction colours apart, and 11px floor", () => {
  const DIRECTION = new Set(["#35b06a", "#d1483f"]);
  for (const [name, src] of [["prototype", PROTO], ["deliverable", DOC]]) {
    const hexes = [...src.matchAll(/#([0-9a-fA-F]{6})\b/g)].map((m) => "#" + m[1].toLowerCase());
    for (const h of new Set(hexes)) {
      if (DIRECTION.has(h)) continue;
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
      assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24, `${name}: ${h} is not a grey`);
      assert.ok(Math.max(r, g, b) <= 210, `${name}: ${h} is brighter than the house ceiling`);
    }
    const sizes = [...src.matchAll(/font(?:-size)?:\s*(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
    assert.ok(sizes.length > 0);
    assert.ok(Math.min(...sizes) >= 11, `${name}: ${Math.min(...sizes)}px body text is under the 11px floor`);
    assert.match(src, /data-scnav-slot/, `${name} is missing the BACK / CLOSE pair`);
    assert.match(src, /width=device-width/, `${name} has no phone viewport`);
  }
});

test("the drawn tree reads the built file and the deliverable shows the shots it took", () => {
  assert.match(PROTO, /\/data\/standard-tree-20260924\.json/);
  assert.match(PROTO, /theme lens/);   // the themes stay a lens over the standard trunk
  for (const shot of ["desktop-1680-sector.png", "desktop-1680-table.png", "phone-390.png"]) {
    assert.ok(existsSync(join(ROOT, "deliverables/20260924/tree-2", shot)), `${shot} is missing`);
    assert.ok(DOC.includes(shot), `the deliverable does not show ${shot}`);
  }
  for (const t of D.thresholds) assert.ok(PROTO.includes(t.key), `threshold ${t.key} is not on the page`);
});

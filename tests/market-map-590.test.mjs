// M1-MAP-590 (29 Sep) · both market-map node lists place every served name. Fails if a served name is missing from
// either map, sits under the "Other served lines" fallback, or if an admission-v3 name was placed without FMP's sector.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAPS = {
  "27 Sep map": JSON.parse(readFileSync(join(ROOT, "deliverables/20260927/market-map/nodes.json"), "utf8")),
  "r3 tree": JSON.parse(readFileSync(join(ROOT, "deliverables/20260928/market-map-r3/nodes.json"), "utf8")),
};
const PROF = JSON.parse(readFileSync(join(ROOT, "data/market-map-profiles-v3-20260929.json"), "utf8"));

// the names a map places properly: a served node that hangs off a real heading, not the fallback "Other served lines"
function placedServed(D) {
  const out = new Set();
  for (const n of D.nodes) if (n.ticker && n.served && n.parents[0] !== "OTHER") out.add(n.ticker);
  return out;
}

test("every served name in the recorded universe is on both maps, lit, and never in the 'Other served lines' fallback", () => {
  const U = MAPS["27 Sep map"].provenance.universe;
  assert.deepEqual(MAPS["r3 tree"].provenance.universe, U, "both maps must record the same served set");
  for (const [name, D] of Object.entries(MAPS)) {
    const placed = placedServed(D);
    const missing = U.symbols.filter((s) => !placed.has(s));
    assert.deepEqual(missing, [], `${name}: served but not placed: ${missing.join(" ")}`);
    assert.ok(!D.nodes.some((n) => n.id === "OTHER"), `${name}: the "Other served lines" fallback heading is in use`);
    assert.equal(D.counts.universe_placed, U.count, `${name}: universe_placed`);
    assert.deepEqual(D.counts.universe_missed, []);
    assert.equal(D.counts.served, U.count, `${name}: served count`);
  }
});

test("live: every name the chart API serves right now is on both maps (skips when the chart API cannot be reached)", async (t) => {
  let live;
  try {
    const r = await fetch("https://scintilla-massive-chart-api.fly.dev/universe", { headers: { Origin: "https://scintillahub.ai" }, signal: AbortSignal.timeout(8000) });
    live = await r.json();
  } catch (e) { t.skip("chart API unreachable: " + e.message); return; }
  assert.ok(Array.isArray(live.symbols) && live.symbols.length > 0, "the chart API returned no universe");
  for (const [name, D] of Object.entries(MAPS)) {
    const placed = placedServed(D);
    const missing = live.symbols.filter((s) => !placed.has(s));
    assert.deepEqual(missing, [], `${name}: served now but missing from the map — rerun scripts/build-market-map.mjs then build-market-map-r3.mjs: ${missing.join(" ")}`);
  }
});

test("admission v3: each of the 104 names sits under the GICS sector FMP's profile gives, with its industry and market cap", () => {
  const names = Object.values(PROF.names);
  assert.equal(names.length, 104);
  assert.match(PROF.provenance.profiles, /FMP \/stable\/profile/);
  for (const [name, D] of Object.entries(MAPS)) {
    const byId = new Map(D.nodes.map((n) => [n.id, n]));
    const sectorHead = new Map(D.nodes.filter((n) => n.id.startsWith("SEC_")).map((n) => [n.label, n.id]));
    for (const p of names) {
      const n = byId.get(p.ticker);
      assert.ok(n && n.served && n.kind === "name", `${name}: ${p.ticker} not a served name`);
      assert.equal(n.parents[0], sectorHead.get(p.gics_sector), `${name}: ${p.ticker} should sit under ${p.gics_sector}`);
      assert.equal(n.gics_industry, p.gics_industry, `${name}: ${p.ticker} industry`);
      assert.equal(n.market_value_usd, p.cap, `${name}: ${p.ticker} market value`);
      assert.ok(n.admission_v3 && typeof n.admission_v3.cohort === "string", `${name}: ${p.ticker} keeps its admission cohort`);
      assert.match(n.placed_by, /FMP company profile/);
      assert.equal(n.tier, "FULL");
    }
  }
});

test("the profiles are FMP's own words, translated by a stated table; every sector move and official disagreement is listed", () => {
  const SECTOR_GICS = { Technology: "Information Technology", "Financial Services": "Financials", Healthcare: "Health Care",
    "Consumer Cyclical": "Consumer Discretionary", "Consumer Defensive": "Consumer Staples", "Basic Materials": "Materials",
    Industrials: "Industrials", Energy: "Energy", Utilities: "Utilities", "Real Estate": "Real Estate", "Communication Services": "Communication Services" };
  const moved = new Set(PROF.moved_by_gics.map((m) => m.ticker));
  const disagree = new Set(PROF.official_disagreements.map((m) => m.ticker));
  for (const p of Object.values(PROF.names)) {
    assert.ok(p.fmp && p.fmp.sector && p.fmp.industry && p.fmp.marketCap > 0, `${p.ticker}: FMP gave no sector / industry / cap`);
    assert.ok(["tree", "extra"].includes(p.translated_by), p.ticker);
    if (p.translated_by === "extra") assert.ok((PROF.ind_extra_used[p.fmp.industry] || []).includes(p.ticker), `${p.ticker}: extra translation not listed`);
    assert.equal(SECTOR_GICS[p.fmp.sector] !== p.gics_sector, moved.has(p.ticker), `${p.ticker}: a sector move must be listed, and only a move`);
    assert.equal(!!p.gics_sector_official && p.gics_sector_official !== p.gics_sector, disagree.has(p.ticker), `${p.ticker}: official disagreement`);
  }
});

test("a line the Hub serves with a dot (MOG.A) keeps it: its fund weights reach the holdings bar", () => {
  const r3 = new Map(MAPS["r3 tree"].nodes.map((n) => [n.id, n]));
  const ita = r3.get("ITA").holdings.served_weights.map(([t]) => t);
  assert.ok(ita.includes("MOG.A"), "ITA holds MOG.A (0.82% in the 26 Sep file) and it is served");
  assert.ok(!ita.includes("MOG-A"));
  assert.equal(r3.get("MOG.A").served, true);
});

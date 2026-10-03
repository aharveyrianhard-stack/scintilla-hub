/* Comps, the mechanic (C4, 1 Oct · deliverables/20261001/comps-mechanic): one stated rule for the comparable set, the
   four test names on it, the measurement on the universe, the tab's clean screen, the Hub's wiring. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { candidates, select, fundsHolding, sourcesFromRows, BAND_DEFAULT, N_DEFAULT, BROAD_FUNDS, INDUSTRY_FUND_MAX } from "../deliverables/20261001/comps-mechanic/peers.mjs";
import { middleHalfBand } from "../deliverables/20260928/comps-r3-labels/labels-r3.mjs";

const here = (p) => new URL(p, import.meta.url);
const SET = (t) => JSON.parse(readFileSync(here(`../deliverables/20261001/comps-mechanic/set-${t}-2026-10-01.json`), "utf8"));
const LRCX = SET("LRCX"), MSFT = SET("MSFT"), TSM = SET("TSM"), MU = SET("MU");
const M = JSON.parse(readFileSync(here("../deliverables/20261001/comps-mechanic/measure-2026-10-01.json"), "utf8"));
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const profiles = { MU: { industry: "Semiconductors", market_cap: 1.2e12, sic: "3674" }, LRCX: { industry: "Semiconductors", market_cap: 4.1e11 }, AMAT: { industry: "Semiconductors", market_cap: 4.06e11 }, KLAC: { industry: "Semiconductors", market_cap: 2.5e11 }, NVDA: { industry: "Semiconductors", market_cap: 5.5e12 }, AXTI: { industry: "Semiconductors", market_cap: 4e9 }, MSFT: { industry: "Software - Infrastructure", market_cap: 3.8e12 }, CRM: { industry: "Software - Application", market_cap: 2.3e11 }, XX: { industry: null, market_cap: 1e12, sic: "3674" } };
const funds = [{ ticker: "SMH", holdings: [["MU", 5], ["NVDA", 20], ["LRCX", 4], ["AMAT", 4]] }, { ticker: "SPY", holdings: [["MU", 1], ["MSFT", 5]] }];

test("the rule by hand: union of the sources, same industry (FMP, SIC, or a shared industry fund), the size band, ranked industry-first then size, every drop with its reason", () => {
  const c = candidates("MU", { profiles, sources: { fmp: ["AMAT", "CRM", "SAP"], massive: ["NVDA", "MSFT"] }, funds });
  assert.deepEqual(c.my_funds, ["SMH"], "SPY is broad, SMH is an industry fund");
  const s = select(c, { band: 10, n: 10 });
  assert.deepEqual(s.counts, { candidates: 9, served: 8, same_industry: 6, in_band: 5, kept: 5 });
  assert.deepEqual(s.kept.map((r) => r.ticker), ["LRCX", "AMAT", "NVDA", "KLAC", "XX"], "industry match first (FMP industry before SIC-only), then size");
  assert.equal(s.kept.find((r) => r.ticker === "XX").match_word, "same SIC code");
  assert.deepEqual(s.kept.find((r) => r.ticker === "AMAT").sources.sort(), ["FMP", "FUND", "INDUSTRY"]);
  for (const [t, why] of [["CRM", /different industry/], ["SAP", /not served/], ["MSFT", /different industry/], ["AXTI", /too small/]]) assert.match(s.dropped.find((r) => r.ticker === t).why, why);
  const tight = select(c, { band: 3, n: 10 }); assert.ok(!tight.kept.some((r) => r.ticker === "NVDA"), "×3 drops NVDA (4.6× the company)");
  const few = select(c, { band: 10, n: 2 }); assert.equal(few.kept.length, 2); assert.match(few.dropped.find((r) => r.ticker === "NVDA").why, /beyond the nearest 2/);
  assert.equal(BAND_DEFAULT, 10); assert.equal(N_DEFAULT, 10); assert.ok(BROAD_FUNDS.has("SPY") && !BROAD_FUNDS.has("SMH")); assert.equal(INDUSTRY_FUND_MAX, 60);
  assert.deepEqual(fundsHolding("MSFT", funds), []);
});

test("the sources: the tables first, the dated fixture only where a table has nothing", () => {
  const fx = { source: "probe", companies: { MU: { fmp: ["AAA"], massive: ["BBB"], sic: "3674" } } };
  const s1 = sourcesFromRows("MU", { fmpRows: [{ ticker: "MU", peer: "AMAT" }], srcRows: [], fixture: fx });
  assert.deepEqual(s1.fmp, ["AMAT"]); assert.deepEqual(s1.massive, ["BBB"]); assert.equal(s1.from.fmp, "table"); assert.equal(s1.from.massive, "probe"); assert.equal(s1.sic, "3674");
  const s2 = sourcesFromRows("MU", { fmpRows: [], srcRows: [{ ticker: "MU", peer: "CCC", source: "massive" }, { ticker: "MU", peer: "DDD", source: "fmp" }], fixture: null });
  assert.deepEqual(s2.fmp, ["DDD"]); assert.deepEqual(s2.massive, ["CCC"]);
});

test("the four names on the rule (1 Oct fixtures): sets of ten in the same industry inside the band; FMP from the loaded table, Massive from the probe; the sources on every row", () => {
  for (const F of [LRCX, MSFT, TSM, MU]) {
    const s = F.set;
    assert.equal(s.counts.kept, 10, F.ticker); assert.ok(s.counts.candidates >= s.counts.same_industry && s.counts.same_industry >= s.counts.in_band && s.counts.in_band >= s.counts.kept);
    for (const r of s.kept) { assert.ok(r.sources.length >= 1 && r.market_cap > 0 && r.ratio >= 1 / s.band && r.ratio <= s.band); assert.ok(r.match != null); }
    assert.equal(F.tables.fmp_peers, true); assert.equal(s.source_state.fmp, "table");
    assert.equal(Object.keys(F.snapshot.table.peers).length, 10);
    const B = middleHalfBand(F.snapshot.rows), w = F.ways.find((x) => x.way === "B"); if (B.ok) close(w.mid, B.mid);
  }
  assert.equal(LRCX.set.own_industry, "Semiconductors"); assert.ok(LRCX.set.kept.some((r) => r.ticker === "AMAT" && r.sources.includes("FMP") && r.sources.includes("MASSIVE")));
  assert.equal(MSFT.set.own_industry, "Software - Infrastructure"); const nv = MSFT.set.kept.find((r) => r.ticker === "NVDA"); assert.ok(nv && nv.match === 1 && nv.match_word === "same industry fund", "NVDA is in MSFT's set by a shared industry fund (XLK), not by FMP industry, and the row says so");
  assert.match(TSM.set.source_state.massive, /no rows|probed|table/); assert.ok(TSM.snapshot.fx && TSM.snapshot.fx.currency === "TWD" && TSM.snapshot.fx.converted);
  assert.ok(MU.set.dropped.some((r) => r.ticker === "SAP" && /not served/.test(r.why)));
});

test("the measurement on the universe: the rule's yield and how often the ways differ; A and B share a centre by construction", () => {
  assert.ok(M.n_served >= 400); assert.ok(M.yield.ge5 / M.n_served > 0.85, `${M.yield.ge5} of ${M.n_served} get five or more`);
  assert.equal(M.summary.a_vs_b_gt5pct, 0, "A and B have the same centre (the median of the medians)");
  assert.ok(M.summary.ce_vs_cw_gt5pct > 0, "C weighted differs from C equal often enough to keep");
  assert.ok(M.summary.four_centres_differ_gt5pct / M.summary.measured > 0.5);
  assert.equal(M.summary.kept_median, 10);
});

test("the tab: no status chips, no repeated price, no 'log axis', the price as the one overlay; plain numbers; the Hub loads it; migrations, job, deliverable and shots exist", () => {
  const src = readFileSync(here("../deliverables/20261001/comps-mechanic/tab.mjs"), "utf8");
  assert.ok(!/decisions saved|decisions in this browser|TODAY \$|LOG AXIS|log axis/i.test(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\bno "log axis"\b/g, "")), "the banned words are not rendered");
  assert.match(src, /const PCT = \(v\) => v == null \? "—" : \(v < 0 \? "\(" : ""\)/, "plain percentages, negatives in parentheses");
  assert.ok(!/me-ring|me-dot/.test(src), "one mark for the company: the line");
  assert.match(src, /going down/);
  const html = readFileSync(here("../index.html"), "utf8");
  assert.match(html, /import\("\/deliverables\/2026(1001\/comps-mechanic|1003\/comps-c5)\/tab\.mjs"\)/);
  for (const f of ["../supabase/migrations/20261001_peer_sources.sql", "../supabase/migrations/20261001_peer_sources_ROLLBACK.sql", "../scripts/peer-sources-sync.mjs", "../deliverables/20261001/comps-mechanic/COMPS-MECHANIC.html", "../deliverables/20261001/comps-mechanic/sources-20261001.json"]) assert.ok(existsSync(here(f)), f);
  const job = readFileSync(here("../scripts/peer-sources-sync.mjs"), "utf8"); assert.match(job, /\/stable\/stock-peers/); assert.match(job, /related-companies/); assert.ok(!/api\/v3\//.test(job), "stable paths only"); assert.ok(!/SUPABASE_SERVICE_ROLE_KEY/.test(job), "the job prints, it does not write");
  for (const t of ["LRCX", "MSFT", "TSM", "MU"]) for (const w of [1680, 390]) assert.ok(existsSync(here(`../deliverables/20261001/comps-mechanic/shots/${t}-${w}.png`)), `${t}-${w}`);
});

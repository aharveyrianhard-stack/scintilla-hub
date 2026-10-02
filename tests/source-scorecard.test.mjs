// C5 (2 Oct): the source scorecard measures the four comp-set sources against the standard's kept ten on every served
// company. The maths is checked on a hand-built fixture; the rule re-stated in scorecard.mjs reproduces the standard's six
// worked sets exactly (nothing changed); the JSON agrees with itself and with the cone page's LRCX ten; the cone, the
// ladder and the standalone page carry the scorecard, the ring shares and the BACK / CLOSE pair; the shots exist and were
// taken with no error, no overflow and no non-GET request.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "deliverables/20261002/source-scorecard");
const STD = join(ROOT, "deliverables/20261001/universe-standard");
const { scoreCompany, aggregate, standardSelect, verdict, norm, pairKey, SOURCES } = await import(join(DIR, "scorecard.mjs"));
const { candidates } = await import(join(STD, "peers-c4.mjs"));
const J = (p) => JSON.parse(readFileSync(p, "utf8"));
const SC = J(join(DIR, "scorecard-2026-10-02.json"));
const D = J(join(STD, "derived-20261001.json"));

test("the precision and agreement maths on a fixture (one company, four sources, hand-counted)", () => {
  const profiles = { A: { industry: "X", market_cap: 100 }, B: { industry: "X", market_cap: 120 }, C: { industry: "X", market_cap: 50 }, D: { industry: "Y", market_cap: 110 }, E: { industry: "X", market_cap: 900 }, F: { industry: "Y", market_cap: 90 } };
  const funds = [{ ticker: "FX", holdings: [["A", 10], ["B", 10], ["D", 10]] }];
  const r = scoreCompany("A", { profiles, sources: { fmp: ["B", "D", "Z"], massive: ["B", "C"] }, funds });
  // candidates: B (all four), C (Massive + industry), D (FMP + fund; industry Y), E (industry only; 9× the company), Z (not served)
  assert.deepEqual(r.kept.map((k) => `${k.ticker}:${k.votes}`), ["B:4", "C:2", "E:1"]);
  assert.equal(r.band_used, "any"); assert.equal(r.band_widened, true, "fewer than five survive ×10 and ×30, so the band widens to any");
  assert.deepEqual(r.counts, { candidates: 5, served: 4, same_industry: 3, in_band: 3, kept: 3 });
  const s = r.sources;
  assert.deepEqual([s.FMP.offered, s.FMP.served, s.FMP.unserved, s.FMP.eligible, s.FMP.kept, s.FMP.outside_industry], [3, 2, 1, 1, 1, 1]);
  assert.deepEqual([s.MASSIVE.offered, s.MASSIVE.served, s.MASSIVE.eligible, s.MASSIVE.kept, s.MASSIVE.outside_industry], [2, 2, 2, 2, 0]);
  assert.deepEqual([s.INDUSTRY.offered, s.INDUSTRY.kept, s.INDUSTRY.outside_industry], [3, 3, 0]);
  assert.deepEqual([s.FUND.offered, s.FUND.kept, s.FUND.outside_industry], [2, 1, 1]);
  assert.equal(r.pairs[pairKey("FMP", "MASSIVE")].jaccard, +(1 / 3).toFixed(4));
  assert.equal(r.pairs[pairKey("FMP", "FUND")].jaccard, 1);
  assert.equal(r.pairs[pairKey("MASSIVE", "INDUSTRY")].jaccard, +(2 / 3).toFixed(4));
  assert.equal(r.pairs[pairKey("INDUSTRY", "FUND")].jaccard, 0.25);
  assert.equal(r.pairs[pairKey("FMP", "MASSIVE")].both_kept, 1);
  assert.deepEqual(r.corroborated, { FMP: 2, MASSIVE: 2, INDUSTRY: 2, FUND: 2 });
  assert.deepEqual(r.by_votes, { 1: { candidates: 1, kept: 1 }, 2: { candidates: 2, kept: 1 }, 3: { candidates: 0, kept: 0 }, 4: { candidates: 1, kept: 1 } });
  const agg = aggregate({ A: r }, { lists: { A: { fmp: ["B", "D", "Z"], massive: ["B", "C"] } }, fundTickers: [], industryOf: { A: "X", B: "X", C: "X", D: "Y", E: "X", F: "Y" } });
  assert.equal(agg.precision.FMP.kept_of_served, 0.5); assert.equal(agg.precision.FMP.kept_of_offered, +(1 / 3).toFixed(4)); assert.equal(agg.precision.MASSIVE.kept_of_served, 1);
  assert.equal(agg.agreement[pairKey("FMP", "FUND")].pooled_jaccard, 1); assert.equal(agg.agreement[pairKey("FMP", "MASSIVE")].kept_of_named_by_both, 1);
  assert.equal(agg.provenance.kept_total, 3); assert.equal(agg.provenance.by_votes[4].kept_share, 1); assert.equal(agg.provenance.by_votes[2].kept_share, 0.5);
  assert.equal(agg.provenance.by_source.INDUSTRY.found_alone, 1, "E was found by the industry alone"); assert.equal(agg.provenance.by_source.FMP.found_alone, 0);
  assert.equal(agg.authority.FMP.outside_share, 0.5); assert.equal(agg.authority.FMP.unserved_share, +(1 / 3).toFixed(4)); assert.equal(agg.authority.FUND.outside_share, 0.5);
  assert.equal(agg.reach.FMP.covered, 1); assert.equal(agg.reach.FMP.mean_offered, 3);
  assert.equal(agg.by_industry[0].industry, "X"); assert.equal(agg.by_industry[0].served_in_industry, 4);
  assert.match(verdict(agg).sentence, /sharpest/);
});

test("the rule re-stated here reproduces the standard's six worked sets exactly (the kept-set rule was not changed)", () => {
  const PROF = J(join(STD, "data/company_profile-20261001.json")), PROBE = J(join(STD, "data/sources-probe-20261001.json")), PEERS = J(join(STD, "data/fmp_peers-20261001.json")), TREE = J(join(ROOT, "deliverables/20260929/tree-map/tree.json"));
  const ref = Object.fromEntries(Object.entries(PROBE.ref).map(([t, r]) => [norm(t), r]));
  const profiles = {};
  for (const r of PROF) { const T = norm(r.ticker); profiles[T] = { industry: r.industry || null, sector: r.sector || null, market_cap: Number(r.market_cap) || null, is_etf: r.is_etf === true, is_fund: r.is_fund === true, sic: ref[T] && ref[T].sic_code ? ref[T].sic_code : null }; }
  const fmp = {}; for (const r of PEERS) (fmp[r.ticker] ||= []).push(r.peer);
  const massive = Object.fromEntries(Object.entries(PROBE.related).map(([t, l]) => [t, [...new Set(l.map(norm))]]));
  const funds = TREE.nodes.filter((n) => n.kind === "fund" && n.holdings && Array.isArray(n.holdings.served_weights)).map((n) => ({ ticker: n.ticker, holdings: n.holdings.served_weights.map(([s, w]) => [norm(s), w]) }));
  for (const T of D.six) {
    const sel = standardSelect(candidates(T, { profiles, sources: { fmp: fmp[T] || [], massive: massive[T] || [] }, funds }));
    assert.deepEqual(sel.kept.map((k) => k.ticker), D.comp_sets[T].standard.kept.map((k) => k.ticker), T + " keeps the same names in the same order");
    assert.deepEqual(sel.kept.map((k) => k.n_votes), D.comp_sets[T].standard.kept.map((k) => k.votes), T + " with the same votes");
    assert.equal(sel.band_used, D.comp_sets[T].standard.band_used, T + " on the same band");
  }
});

test("the JSON agrees with itself: the industry is the gate, the rings sum, the shares are shares, LRCX is the cone's ten", () => {
  const M = SC.measures, PR = M.provenance;
  assert.equal(SC.universe.with_set, Object.values(SC.companies).filter((c) => c.counts.kept > 0).length);
  assert.equal(SC.universe.companies, Object.keys(SC.companies).length);
  for (const [T, c] of Object.entries(SC.companies)) { assert.ok(c.counts.kept <= 10, T); assert.equal(c.sources.INDUSTRY.kept, c.counts.kept, T + ": every kept name is a same-industry candidate"); for (const S of SOURCES) assert.ok(c.sources[S].kept <= c.sources[S].served && c.sources[S].served <= c.sources[S].offered, T + " " + S); }
  assert.equal(M.precision.INDUSTRY.kept, PR.kept_total); assert.equal(PR.by_source.INDUSTRY.names_kept, PR.kept_total);
  for (const S of ["FMP", "MASSIVE", "FUND"]) assert.equal(PR.by_source[S].found_alone, 0, S + " never finds a kept name alone (the industry gate)");
  assert.equal([1, 2, 3, 4].reduce((s, v) => s + PR.by_votes[v].kept, 0), PR.kept_total);
  assert.ok(PR.by_votes[4].kept_share > PR.by_votes[3].kept_share && PR.by_votes[3].kept_share > PR.by_votes[2].kept_share && PR.by_votes[2].kept_share > PR.by_votes[1].kept_share, "more agreement, more often kept");
  const walk = (o) => { for (const [k, v] of Object.entries(o)) { if (v && typeof v === "object") walk(v); else if (/share|jaccard|_of_/.test(k) && typeof v === "number") assert.ok(v >= 0 && v <= 1, k + "=" + v); } };
  walk(M);
  assert.deepEqual(SC.companies.LRCX.kept, D.comp_sets.LRCX.standard.kept.map((k) => `${k.ticker}:${k.votes}`), "LRCX keeps the cone page's ten");
  assert.equal(SC.measures.reach.MASSIVE.funds.empty, 136); assert.equal(SC.universe.served, 590);
  assert.ok(SC.worked.LRCX && SC.worked.JPM && SC.worked.JPM.counts.kept < 10, "JPM is the thin case");
});

test("the cone and the ladder carry the scorecard under the four lines, the ring shares under the picture, and the BACK / CLOSE pair", () => {
  const bv = SC.measures.provenance.by_votes, pct = (x) => Math.round(x * 100) + "%";
  for (const f of ["agreement-3d.html", "agreement-ladder.html"]) {
    const P = readFileSync(join(STD, f), "utf8");
    const four = P.indexOf("What goes in."), sc = P.indexOf('id="scorecard"'), pic = P.indexOf(f === "agreement-3d.html" ? "<svg" : 'class="ladder"'), rings = P.indexOf('class="sc-rings"');
    assert.ok(four > 0 && sc > four && pic > sc && rings > pic, f + ": four lines → scorecard → picture → ring shares");
    for (const w of ["FMP's peer list", "Massive's related companies", "the same industry (the authority)", "a shared industry fund", "companies covered", "names offered per company", "kept share", "agreement with the others", "SOURCE-SCORECARD.html"]) assert.ok(P.includes(w), f + " carries " + w);
    assert.ok(P.includes(SC.verdict.sentence.slice(0, 60).replace(/'/g, "'")), f + " carries the verdict sentence");
    for (const v of [4, 3, 2, 1]) assert.ok(P.includes(`<b>${pct(bv[v].kept_share)}</b><span>${v === 1 ? "1 source names it" : v + " sources agree"}`), f + " ring " + v);
    assert.ok(P.includes("scnav") && P.includes("data-scnav-slot"), f + " carries the BACK / CLOSE pair");
    assert.ok(!/undefined|NaN|\[object/.test(P), f);
  }
  const C = readFileSync(join(STD, "agreement-3d.html"), "utf8");
  for (const v of [4, 3, 2]) assert.ok(C.includes(`${v} SOURCES AGREE · ${pct(bv[v].kept_share)} OF THESE ARE KEPT`), "ring label " + v);
  assert.ok(C.includes(`1 SOURCE NAMES IT · ${pct(bv[1].kept_share)} OF THESE ARE KEPT`));
  const U = readFileSync(join(STD, "UNIVERSE-STANDARD.html"), "utf8");
  for (const h of ["1 · The placement record", "6 · The agreement view", "10 · Decisions for Alan"]) assert.ok(U.includes(h), "the standard page still prints " + h);
  assert.ok(U.includes("scnav") && U.includes("data-scnav-slot"), "the standard page carries the pair");
});

test("the standalone page prints every measure, the two worked cases, the method, what could be wrong; the shots exist and were clean", () => {
  const P = readFileSync(join(DIR, "SOURCE-SCORECARD.html"), "utf8");
  for (const h of ["1 · The scorecard", "2 · Where the sources agree", "3 · Reach", "4 · Where the kept ten come from", "5 · Against the authority", "6 · By industry", "7 · Worked: LRCX and JPM", "8 · The method in plain words", "9 · What could be wrong", "10 · What was not done", "11 · Proof and files"]) assert.ok(P.includes(h), h);
  assert.ok(P.includes("<h3>LRCX · ") && P.includes("<h3>JPM · "));
  assert.ok(P.includes(SC.verdict.sentence.slice(0, 60)));
  assert.ok((P.match(/class="bars"/g) || []).length >= 12, "a picture per measure");
  assert.ok(P.includes("scnav") && P.includes("data-scnav-slot"), "the pair");
  assert.ok(!/undefined|NaN|\[object/.test(P));
  assert.ok(!/<script/.test(P.replace(/<!-- scnav · [\s\S]*?<!-- \/scnav -->/, "")), "static: no script of its own (the BACK / CLOSE snippet carries the only one)");
  // the look: every colour a grey (channels within 24 of each other, none above 210), no white
  for (const hex of new Set(P.match(/#[0-9a-f]{6}\b/gi) || [])) { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); assert.ok(Math.max(...c) - Math.min(...c) <= 24 && Math.max(...c) <= 210, hex + " is a grey, not above 210"); }
  for (const f of ["scorecard-1680.png", "scorecard-390.png", "scorecard-s1-1680.png", "scorecard-s4-1680.png", "scorecard-lrcx-1680.png", "scorecard-jpm-1680.png", "scorecard-s1-390.png", "scorecard-lrcx-390.png"]) assert.ok(existsSync(join(DIR, "shots", f)), f);
  const facts = J(join(DIR, "shots/facts.json"));
  for (const f of facts) { assert.equal(f.errors.length, 0, f.name + " no page error"); assert.equal(f.blocked_non_get, 0, f.name + " no non-GET request"); assert.equal(f.horizontal_overflow, false, f.name + " no horizontal overflow"); assert.ok(f.has_scnav, f.name + " pair present"); assert.ok(f.min_font >= 11, f.name + " body text at least 11 px"); }
});

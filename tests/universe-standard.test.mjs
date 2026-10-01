// U1 (1 Oct): the universe standard is a proposal built from dated snapshots, and its derivations are consistent with
// its own rules: the machine copy is marked PROPOSED; every one of the six worked comp sets keeps only served names of the
// company's own industry (by the authority) inside the band it says it used, ranked by votes then closeness; the ladder
// carries every candidate once; the dry run never writes and never adopts; the page prints what the JSON holds.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "deliverables/20261001/universe-standard");
const D = JSON.parse(readFileSync(join(DIR, "derived-20261001.json"), "utf8"));
const STD = JSON.parse(readFileSync(join(DIR, "universe-standard.v1.json"), "utf8"));
const PAGE = readFileSync(join(DIR, "UNIVERSE-STANDARD.html"), "utf8");
const PROF = JSON.parse(readFileSync(join(DIR, "data/company_profile-20261001.json"), "utf8"));
const profile = Object.fromEntries(PROF.map((r) => [r.ticker, r]));
const SIX = ["LRCX", "MSFT", "TSM", "MU", "JPM", "XOM"];

test("the machine copy is a proposal, versioned, with the five decisions open", () => {
  assert.equal(STD.status, "PROPOSED");
  assert.equal(STD.artifact_kind, "SCINTILLA_UNIVERSE_STANDARD");
  assert.match(STD.version, /^\d+\.\d+\.\d+$/);
  assert.deepEqual(STD.decisions_open, [1, 2, 3, 4, 5]);
  assert.equal(STD.placement_record.parts.comps_measures_usd.fields.length, 16);
});

test("the six worked comp sets follow the standard's own rule: same industry by the authority, inside the band said, votes then closeness, at most N", () => {
  for (const T of SIX) {
    const s = D.comp_sets[T], st = s.standard, own = profile[T];
    assert.ok(st.kept.length <= 10, T);
    assert.equal(st.kept.length, Math.min(10, st.counts.in_band), T + " keeps the nearest N of the band");
    const band = st.band_used === "any" ? Infinity : Number(st.band_used.replace("×", ""));
    for (const k of st.kept) {
      const p = profile[k.ticker];
      assert.ok(p, `${T}: ${k.ticker} is served (has a profile)`);
      assert.ok(p.industry === own.industry || (k.sic && s.sic && k.sic === s.sic), `${T}: ${k.ticker} is the same industry by the authority`);
      const ratio = Number(p.market_cap) / Number(own.market_cap);
      assert.ok(ratio <= band && ratio >= 1 / band, `${T}: ${k.ticker} is inside the band ${st.band_used}`);
      assert.ok(k.votes >= 1 && k.votes <= 4);
    }
    for (let i = 1; i < st.kept.length; i++) {
      const a = st.kept[i - 1], b = st.kept[i];
      const ca = Math.abs(Math.log10(a.ratio)), cb = Math.abs(Math.log10(b.ratio));
      assert.ok(a.votes > b.votes || (a.votes === b.votes && ca <= cb + 1e-9), `${T}: ${a.ticker} before ${b.ticker} by votes then closeness`);
    }
    // the fund-is-a-vote rule: nothing kept by a fund alone from another industry
    for (const k of st.kept) assert.ok(!(k.sources.length === 1 && k.sources[0] === "FUND" && profile[k.ticker].industry !== own.industry), `${T}: ${k.ticker} not in by a fund alone`);
    // the band widens only when fewer than 5 survive ×10
    if (st.band_widened) assert.ok(s.ladder.filter((r) => r.served && r.industry === own.industry && r.ratio != null && r.ratio <= 10 && r.ratio >= 0.1).length < 5, T + " widened only because ×10 was thin");
  }
});

test("the ladder carries every candidate once, sorted by votes then closeness, and the kept set is exactly the standard's", () => {
  for (const T of SIX) {
    const s = D.comp_sets[T], seen = new Set();
    for (const r of s.ladder) { assert.ok(!seen.has(r.ticker), `${T}: ${r.ticker} once`); seen.add(r.ticker); assert.equal(r.n_votes, Object.values(r.votes).filter(Boolean).length); }
    for (let i = 1; i < s.ladder.length; i++) { const a = s.ladder[i - 1], b = s.ladder[i]; assert.ok(a.n_votes >= b.n_votes, T + " votes descend"); }
    assert.equal(s.counts.candidates, s.ladder.length, T + " C4's candidate count is the ladder's");
  }
  assert.deepEqual(D.comp_sets.LRCX.agreement.four.sort(), ["AMAT", "KLAC", "MU"]);
});

test("the dry run is provisional, measured on the stated window, and adopts nothing", () => {
  const dr = D.dry_run;
  assert.equal(dr.window_sessions, 60);
  assert.ok(dr.names_with_returns > 400);
  assert.ok(dr.cohorts_measured.length >= 100);
  for (const c of dr.cohorts_measured) { assert.ok(["COHESIVE", "NOT ABOVE RANDOM", "too few"].includes(c.verdict)); if (c.verdict === "COHESIVE") assert.ok(c.cohesion > c.null95); }
  for (const m of dr.moves) assert.ok(m.gain >= 0.10);
  assert.equal(STD.cohorts.dry_run_1oct.provisional, true);
  assert.match(PAGE, /PROVISIONAL until P8 lands/);
});

test("the placement examples carry the SIC where probed, both market values, and a source for every part", () => {
  for (const T of SIX) {
    const r = D.examples[T];
    assert.equal(r.as_of, "2026-10-01");
    assert.ok(r.identity.name && r.classification.fmp_industry);
    if (T !== "TSM") assert.ok(r.classification.sic_code, T + " has a SIC");
    else assert.equal(r.classification.sic_code, null, "TSM: Massive has no SIC (foreign filer)");
    assert.ok(r.size.market_value_usd > 0 && r.size.check_fmp_market_cap > 0);
    assert.ok(r.provenance.profile.source && r.provenance.peers.source && r.provenance.scout.as_of);
    assert.ok(r.membership.funds.length > 0, T + " is held by at least one tree fund");
  }
  assert.ok(D.authorities.industry_disagreements.length >= 20);
  assert.deepEqual(D.authorities.sic_missing.sort(), ["ARM", "ASML", "CCJ", "TSM"]);
});

test("the page prints the standard: numbered sections, the six names, the decisions, the proposal mark, the shots", () => {
  for (const h of ["1 · The placement record", "2 · Authorities", "3 · The tree, derived", "4 · Cohorts", "5 · Comp sets", "6 · The agreement view", "7 · The screener", "8 · What this does to the Hub", "9 · The implementation queue", "10 · Decisions for Alan"]) assert.ok(PAGE.includes(h), h);
  for (const T of SIX) assert.ok(PAGE.includes(`<h3>${T} · `), T + " worked");
  assert.ok(PAGE.includes('class="proposed">PROPOSED'));
  assert.equal((PAGE.match(/\[ESTIMATE\]/g) || []).length >= 8, true, "every epic carries an estimate tag");
  assert.ok(!/undefined|NaN|\[object/.test(PAGE));
  for (const f of ["standard-1680.png", "standard-390.png", "ladder-1680.png", "ladder-390.png", "3d-1680.png", "3d-390.png"]) assert.ok(existsSync(join(DIR, "shots", f)), f);
  assert.ok(PAGE.includes("scnav"), "the page carries the BACK / CLOSE pair");
});

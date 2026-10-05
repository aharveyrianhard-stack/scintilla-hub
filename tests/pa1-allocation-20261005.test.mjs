/* PA1 (5 Oct 2026) · the chain's arithmetic (deliverables/20261005/pa1-allocation/chain.mjs), the data file's shape, and the page's pins.
   node --test tests/pa1-allocation-20261005.test.mjs */
import test from "node:test"; import assert from "node:assert/strict"; import { readFileSync, existsSync } from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), DIR = path.join(ROOT, "deliverables/20261005/pa1-allocation");
const C = await import(path.join(DIR, "chain.mjs"));

test("rank scores: the share of the others beaten, ties half, nulls stay null, one value = 0.5", () => {
  assert.deepEqual(C.rankScores([{ x: 1 }, { x: 3 }, { x: 2 }, { x: null }], "x"), [0, 1, 0.5, null]);
  assert.deepEqual(C.rankScores([{ x: 2 }, { x: 2 }, { x: 5 }], "x"), [0.25, 0.25, 1]);
  assert.deepEqual(C.rankScores([{ x: 1 }, { x: 3 }], "x", "low"), [1, 0]);
  assert.deepEqual(C.rankScores([{ x: 7 }, { x: null }], "x"), [0.5, null]);
});
test("heat: the weighted mean of the legs a sector has; hot = top N, cold = bottom N; a sector with no leg is unranked", () => {
  const S = [{ key: "A", names: 0.3, funds: 0.8, rotation: 1 }, { key: "B", names: -0.1, funds: 0.2, rotation: 5 }, { key: "C", names: -0.4, funds: -0.5, rotation: -8 }, { key: "D", names: null, funds: null, rotation: null }];
  const H = C.heat(S, { ...C.DIALS, hot_n: 1 });
  assert.deepEqual(H.hot, ["A"]); assert.deepEqual(H.cold, ["C"]); assert.equal(H.unranked.length, 1);
  assert.equal(H.ranked[0].heat_rank, 1); assert.ok(H.ranked[0].heat > H.ranked[1].heat);
  const only = C.heat(S, { ...C.DIALS, hot_n: 1, heat_w: { names: 0, funds: 0, rotation: 1, bowtie: 0 } });
  assert.deepEqual(only.hot, ["B"], "with rotation alone B leads");
});
test("a cohort belongs to the sector holding most of its companies; the share is printed", () => {
  const r = C.cohortSector([{ ticker: "a", sector: "Technology" }, { ticker: "b", sector: "Technology" }, { ticker: "c", sector: "Energy" }, { ticker: "d", sector: null }]);
  assert.equal(r.sector, "Technology"); assert.equal(r.counted, 3); assert.ok(Math.abs(r.share - 2 / 3) < 1e-9);
  assert.equal(C.isSound({ sound: true }), true); assert.equal(C.isSound({ sound: false }), false); assert.equal(C.isSound(null), false);
});
test("analyst target from clean notes: the firms' newest note inside the window; too few firms is a named blank", () => {
  const notes = [{ firm: "A", published_utc: "2026-09-01T10:00:00Z", target: 100 }, { firm: "A", published_utc: "2026-09-20T10:00:00Z", target: 120 }, { firm: "B", published_utc: "2026-09-10T10:00:00Z", target: 90 }, { firm: "C", published_utc: "2025-01-10T10:00:00Z", target: 500 }, { firm: "D", published_utc: "2026-09-12T10:00:00Z", target: 110 }];
  const t = C.targetFromNotes(notes, "2026-10-05", { days: 183, minFirms: 3 });
  assert.equal(t.n, 3); assert.equal(t.median, 110); assert.equal(t.lo, 90); assert.equal(t.hi, 120);
  const few = C.targetFromNotes(notes.slice(0, 3), "2026-10-05", { days: 183, minFirms: 3 });
  assert.equal(few.median, null); assert.match(few.why, /only 2 firms/);
});
test("revision direction: raised minus lowered over the firms that moved in the last 30 days", () => {
  const notes = [{ firm: "A", published_utc: "2026-08-01T10:00:00Z", target: 100 }, { firm: "A", published_utc: "2026-09-25T10:00:00Z", target: 120 }, { firm: "B", published_utc: "2026-08-01T10:00:00Z", target: 100 }, { firm: "B", published_utc: "2026-09-28T10:00:00Z", target: 80 }, { firm: "C", published_utc: "2026-09-29T10:00:00Z", target: 50 }, { firm: "D", published_utc: "2026-08-01T10:00:00Z", target: 70 }, { firm: "D", published_utc: "2026-08-20T10:00:00Z", target: 90 }];
  const r = C.revisionDirection(notes, "2026-10-05", { recent: 30, days: 183 });
  assert.equal(r.up, 1); assert.equal(r.down, 1); assert.equal(r.direction, 0, "C has no prior note, D moved before the window");
});
test("outliers on the comps upside: beyond k MADs from the median, named with side and z; off below 5 values or k = 0", () => {
  const M = [10, 12, 15, 11, 13, 14, 300, -200].map((v, i) => ({ ticker: "T" + i, comps_upside: v }));
  const o = C.upsideOutliers(M, 3);
  assert.deepEqual(o.out.map((x) => x.ticker + ":" + x.side).sort(), ["T6:high", "T7:low"]);
  assert.equal(C.upsideOutliers(M, 0).out.length, 0); assert.equal(C.upsideOutliers(M.slice(0, 4), 3).out.length, 0);
});
test("knockout: rank scores inside the ring, weighted by the readings a member has; outliers out; blanks named; top S survive", () => {
  const members = [
    { ticker: "A", comps_upside: 40, target_upside: 10, revision: 1, geiger: 0.5 }, { ticker: "B", comps_upside: 20, target_upside: 30, revision: -1, geiger: 0.1 },
    { ticker: "C", comps_upside: 10, target_upside: null, revision: null, geiger: 0.9 }, { ticker: "D", comps_upside: 5, target_upside: 5, revision: 0, geiger: -0.2 },
    { ticker: "E", comps_upside: 15, target_upside: 8, revision: null, geiger: 0.0 }, { ticker: "F", comps_upside: 900, target_upside: 1, revision: null, geiger: 0.3 }, { ticker: "G", comps_upside: null, target_upside: null, revision: null, geiger: null }];
  const K = C.knockout(members, { ...C.DIALS, survivors: 2 });
  assert.deepEqual(K.outliers.out.map((o) => o.ticker), ["F"]);
  const F = K.members.find((m) => m.ticker === "F"), G = K.members.find((m) => m.ticker === "G");
  assert.equal(F.verdict, "OUTLIER"); assert.equal(G.verdict, "BLANK"); assert.equal(G.score, null);
  assert.equal(K.survivors.length, 2); assert.equal(K.members.filter((m) => m.verdict === "SURVIVES").length, 2);
  const A = K.members.find((m) => m.ticker === "A");
  assert.equal(A.rank_scores.comps, 1, "A has the best upside inside the ring"); assert.ok(A.geiger_rel > 0);
  /* weights: a member with only comps and geiger is scored on those two alone */
  const Cm = K.members.find((m) => m.ticker === "C"); const w = K.weights; const exp = (w.comps * Cm.rank_scores.comps + w.geiger * Cm.rank_scores.geiger) / (w.comps + w.geiger);
  assert.ok(Math.abs(Cm.score - exp) < 1e-9); assert.equal(Cm.readings, 2);
  /* turning the comps weight off reorders */
  const K2 = C.knockout(members, { ...C.DIALS, survivors: 1, ko_w: { comps: 0, target: 1, revision: 0, geiger: 0 } });
  assert.deepEqual(K2.survivors, ["B"]);
});
test("picks dedupe by best score; the full chain blends sector heat and the knockout and names five and five", () => {
  const rows = [{ ticker: "X", score: 0.4, sector_key: "A" }, { ticker: "X", score: 0.9, sector_key: "B" }, { ticker: "Y", score: 0.5, sector_key: "A" }];
  const d = C.dedupePicks(rows); assert.equal(d.length, 2); assert.equal(d[0].ticker, "X"); assert.equal(d[0].score, 0.9);
  const many = Array.from({ length: 12 }, (_, i) => ({ ticker: "N" + i, score: i / 11, sector_key: i % 2 ? "A" : "B" }));
  const FC = C.fullChain(many, [{ key: "A" }, { key: "B" }], C.DIALS);
  assert.equal(FC.strongest.length, 5); assert.equal(FC.weakest.length, 5); assert.equal(FC.strongest[0].ticker, "N11"); assert.equal(FC.weakest[0].ticker, "N0");
  const n11 = FC.strongest[0]; assert.ok(Math.abs(n11.chain - (1 * 1 + 2 * 1) / 3) < 1e-9, "A is heat rank 1 → heat score 1; N11 knockout 1");
});
test("the reason line carries sector heat · cohort · comps rank · target · Geiger", () => {
  const line = C.reasonLine({ place: 2, comps_upside: 31.2, target_upside: 14, target_n: 7, revision: null, geiger: 0.91, geiger_rel: 0.4 }, { label: "AI ACCELERATORS", sound: true }, { label: "TECH", heat_rank: 2 });
  assert.match(line, /TECH heat #2/); assert.match(line, /AI ACCELERATORS \(sound\)/); assert.match(line, /comps #2 · way C \+31%/); assert.match(line, /target \+14% \(7 firms\)/); assert.match(line, /Geiger \+0\.91 \(\+0\.40 vs cohort\)/);
});
test("today's data file: eleven sectors with four legs, cohorts with T12's soundness, knockouts with the raw readings, sources dated", () => {
  const f = path.join(DIR, "data-latest.json"); assert.ok(existsSync(f));
  const d = JSON.parse(readFileSync(f, "utf8"));
  assert.equal(d.sectors.length, 11);
  for (const s of d.sectors) for (const k of ["names", "funds", "ew", "bowtie", "rotation"]) assert.ok(k in s, s.label + " " + k);
  assert.ok(d.cohorts.length >= 50); assert.ok(d.cohorts.some((c) => c.sound)); assert.ok(d.cohorts.every((c) => c.sound === true || typeof c.why_not === "string" || c.fallback));
  assert.ok(d.cohorts.filter((c) => c.mixed).every((c) => !c.sound && c.sector_key == null), "a mixed cohort is never sound and has no sector");
  assert.ok(d.knockouts.length >= 6);
  for (const k of d.knockouts) { assert.ok(k.members.length >= 2, k.label); for (const m of k.members) for (const key of ["comps_upside", "target_upside", "revision", "geiger", "price"]) assert.ok(key in m, k.label + " " + m.ticker + " " + key); }
  assert.match(d.sources.geiger_live.as_of, /^2026-/); assert.match(d.sources.bars.to, /^2026-/); assert.equal(d.sources.b1.as_of, "2026-10-02"); assert.ok(d.sources.targets.rows > 0);
  /* the chain runs on the file under the baselines and names picks */
  const H = C.heat(d.sectors, C.DIALS); assert.equal(H.hot.length, 3); assert.equal(H.cold.length, 3);
  const kos = d.knockouts.map((k) => ({ ...k, K: C.knockout(k.members, C.DIALS) })); assert.ok(kos.every((k) => k.K.survivors.length >= 1));
});
test("the page: Hub look, no sentence in a panel, PAGE SPECS at the bottom, the dials, both views, the scnav pair", () => {
  const html = readFileSync(path.join(DIR, "index.html"), "utf8");
  assert.match(html, /import \{ DIALS, heat, knockout, dedupePicks, fullChain, reasonLine, num \} from "\.\/chain\.mjs"/);
  assert.match(html, /details class="sc-pagespecs"/); assert.match(html, /data-view="discussion"/); assert.match(html, /f\("ko_w\.comps"/); assert.match(html, /f\("outlier_mad"/); assert.match(html, /data-dial="\$\{id\}"/);
  assert.match(html, /scnav/, "the BACK / CLOSE pair is placed"); assert.match(html, /--crk:#00D4FF/);
  assert.ok(!/not financial advice/i.test(html), "no hedge in place of the answer");
  assert.ok(existsSync(path.join(DIR, "METHOD.md")) && existsSync(path.join(DIR, "TODAY.md")));
});

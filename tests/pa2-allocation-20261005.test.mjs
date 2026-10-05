/* PA2 (5 Oct 2026) · the equalizer's arithmetic in chain.mjs (how much to own, the sector cap, the book, the fundamentals readings,
   the tie-breakers, the lookback), today's data file carrying the fundamentals, and the page's pins. node --test tests/pa2-allocation-20261005.test.mjs */
import test from "node:test"; import assert from "node:assert/strict"; import { readFileSync, existsSync } from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), DIR = path.join(ROOT, "deliverables/20261005/pa1-allocation");
const C = await import(path.join(DIR, "chain.mjs"));

test("how much to own: the average Geiger or how many rising → % invested around the anchor, at the speed, under the cash floor", () => {
  const S = [{ names: 0.2, names_n: 100, up: 70 }, { names: -0.4, names_n: 100, up: 20 }];
  const a = C.howMuch(S, C.DIALS);
  assert.equal(a.reading, -0.1); assert.equal(a.invested, 45, "50 + 1 × 50 × −0.1"); assert.equal(a.cash, 55); assert.equal(a.names_n, 200); assert.equal(a.rising, 90);
  const b = C.howMuch(S, { ...C.DIALS, own: { measure: "breadth", neutral: 50, speed: 1, cash_floor: 0 } });
  assert.equal(b.reading, -0.1, "2 × 90/200 − 1"); assert.equal(b.invested, 45);
  const c = C.howMuch(S, { ...C.DIALS, own: { measure: "heat", neutral: 70, speed: 2, cash_floor: 25 } });
  assert.equal(c.invested, 60, "70 − 10 = 60, under the 75 cap");
  const d = C.howMuch(S, { ...C.DIALS, own: { measure: "heat", neutral: 80, speed: 0.25, cash_floor: 25 } });
  assert.equal(d.invested, 75, "the cash floor caps it");
  assert.equal(C.howMuch([], C.DIALS).invested, null, "no names, no answer");
});
test("the sector cap: shares in proportion, none above the cap, the excess spread over the others, what cannot be placed is left", () => {
  assert.deepEqual(C.capShares({ a: 9, b: 1, c: 1 }, 60, 25), { shares: { a: 25, b: 17.5, c: 17.5 }, left: 0 });
  assert.deepEqual(C.capShares({ a: 1, b: 1 }, 60, 20), { shares: { a: 20, b: 20 }, left: 20 });
  const r = C.capShares({ a: 1, b: 1, c: 1 }, 30, null); assert.ok(Math.abs(r.shares.a - 10) < 1e-9); assert.equal(r.left, 0);
  assert.deepEqual(C.capShares({ a: 0, b: 0 }, 30, 20).left, 30);
});
test("the fundamentals readings fold the comps field's table to growth, margins, leverage; blanks stay blank", () => {
  const f = C.fundamentalsOf({ fund: { rev_g_ttm: 10, rev_g_fy: 20, eps_g_fy: null, gm: 60, om: 20, fcfm: 10, nd_ebitda: 1.5 } });
  assert.equal(f.growth, 15); assert.equal(f.margins, 30); assert.equal(f.leverage, 1.5);
  const g = C.fundamentalsOf({ fund: null }); assert.equal(g.growth, null); assert.equal(g.margins, null); assert.equal(g.leverage, null);
});
test("the ring ranks the fundamentals (lower leverage is better) and breaks ties on the Geiger, then the target", () => {
  const M = [
    { ticker: "A", comps_upside: 10, geiger: 0.1, target_upside: 5, fund: { rev_g_ttm: 30, gm: 50, nd_ebitda: 0.5 } },
    { ticker: "B", comps_upside: 10, geiger: 0.3, target_upside: 5, fund: { rev_g_ttm: 30, gm: 50, nd_ebitda: 0.5 } },
    { ticker: "C", comps_upside: 10, geiger: 0.3, target_upside: 9, fund: { rev_g_ttm: 30, gm: 50, nd_ebitda: 0.5 } },
    { ticker: "D", comps_upside: 10, geiger: 0.1, target_upside: 5, fund: { rev_g_ttm: 30, gm: 50, nd_ebitda: 4 } }];
  const K = C.knockout(M, { ...C.DIALS, survivors: 2 });
  const by = Object.fromEntries(K.members.map((m) => [m.ticker, m]));
  assert.ok(by.D.rank_scores.leverage < by.A.rank_scores.leverage, "more debt ranks lower");
  assert.ok(by.D.score < by.A.score);
  assert.equal(K.members[0].ticker, "C", "C and B tie on the score; C's target breaks it"); assert.equal(K.members[1].ticker, "B", "B beats A on the Geiger");
  const noF = C.knockout(M, { ...C.DIALS, ko_w: { comps: 1, growth: 0, margins: 0, leverage: 0, target: 0, revision: 0, geiger: 0 } });
  assert.ok(noF.members.every((m) => Math.abs(m.score - 0.5) < 1e-9), "with the comps alone every tie scores 0.5");
});
test("the lookback dial swaps the tape leg to the 16-session one", () => {
  const S = [{ key: "A", names: 0, funds: 0, rotation: 10, rotation_short: -5 }, { key: "B", names: 0, funds: 0, rotation: -10, rotation_short: 5 }];
  assert.deepEqual(C.heat(S, { ...C.DIALS, hot_n: 1, lookback: 72 }).hot, ["A"]);
  assert.deepEqual(C.heat(S, { ...C.DIALS, hot_n: 1, lookback: 16 }).hot, ["B"]);
});
test("the book: the hot sectors by heat under the cap, the rings inside EQUAL or TILT, the names inside; cash is the rest", () => {
  const H = { ranked: [{ key: "T", label: "TECH", heat: 0.9, heat_rank: 1 }, { key: "E", label: "ENERGY", heat: 0.6, heat_rank: 2 }, { key: "R", label: "REAL ESTATE", heat: 0.1, heat_rank: 3 }], hot: ["T", "E"], unranked: [] };
  const ring = (cohort, sector_key, names) => ({ cohort, label: cohort, sector_key, K: { survivors: names.map((n) => n[0]), members: names.map(([t, s]) => ({ ticker: t, score: s, verdict: "SURVIVES" })) } });
  const kos = [ring("AI", "T", [["NVDA", 0.9], ["TSM", 0.6]]), ring("SEMI", "T", [["AVGO", 0.5]]), ring("OIL", "E", [["XOM", 0.7]])];
  const B = C.book(H, kos, { ...C.DIALS, max_sector: 60 }, 50);
  assert.equal(B.invested, 50); assert.equal(B.cash, 50);
  const T = B.sectors.find((s) => s.key === "T"), E = B.sectors.find((s) => s.key === "E");
  assert.ok(Math.abs(T.share - 30) < 1e-9 && Math.abs(E.share - 20) < 1e-9, "0.9 : 0.6 of 50");
  assert.ok(Math.abs(T.cohorts[0].share - 15) < 1e-9, "EQUAL: two rings split TECH evenly"); assert.ok(Math.abs(B.names.NVDA - 7.5) < 1e-9);
  const Bt = C.book(H, kos, { ...C.DIALS, max_sector: 60, within: "tilt" }, 50);
  const Tt = Bt.sectors.find((s) => s.key === "T"); assert.ok(Tt.cohorts[0].share > Tt.cohorts[1].share, "TILT: the stronger ring holds more"); assert.ok(Bt.names.NVDA > Bt.names.TSM);
  const Bc = C.book(H, kos, { ...C.DIALS, max_sector: 20 }, 50);
  assert.ok(Bc.sectors.every((s) => s.share <= 20 + 1e-9)); assert.ok(Math.abs(Bc.unplaced - 10) < 1e-9, "two sectors at 20 of 50: 10 stays in cash"); assert.ok(Math.abs(Bc.cash - 60) < 1e-9);
});
test("fillDials: a saved set from an older page keeps its values and gains the new keys", () => {
  const D = C.fillDials({ survivors: 5, ko_w: { comps: 70 } });
  assert.equal(D.survivors, 5); assert.equal(D.ko_w.comps, 70); assert.equal(D.ko_w.growth, 10); assert.equal(D.own.neutral, 50); assert.equal(D.max_sector, 40);
});
test("today's data file carries the fundamentals and the peers' medians for every ring member", () => {
  const d = JSON.parse(readFileSync(path.join(DIR, "data-latest.json"), "utf8"));
  assert.match(d.what, /^PA2/);
  let n = 0, withF = 0, withP = 0;
  for (const k of d.knockouts) for (const m of k.members) { n++; if (m.fund && typeof m.fund === "object") withF++; if (m.peers_median) withP++; }
  assert.ok(n >= 100); assert.ok(withF / n > 0.95, `fundamentals on ${withF} of ${n}`); assert.ok(withP / n > 0.8, `peers' medians on ${withP} of ${n}`);
  for (const s of d.sectors) { assert.ok(typeof s.names_n === "number" && typeof s.up === "number", s.label); }
  const o = C.howMuch(d.sectors, C.DIALS); assert.ok(o.invested >= 0 && o.invested <= 100); assert.ok(o.names_n > 300);
  const H = C.heat(d.sectors, C.DIALS), kos = d.knockouts.map((k) => ({ ...k, K: C.knockout(k.members, C.DIALS) }));
  const B = C.book(H, kos, C.DIALS, o.invested); const placed = B.sectors.reduce((a, s) => a + s.share, 0);
  assert.ok(Math.abs(placed + B.cash - 100) < 1e-6, "the book sums to 100");
});
test("the page: the equalizer with Alan's groups, the pies, the fundamentals columns, the sticky tabs, PAGE SPECS, the previous page, no codes", () => {
  const html = readFileSync(path.join(DIR, "index.html"), "utf8");
  assert.match(html, /import \{ DIALS, fillDials, heat, knockout, dedupePicks, fullChain, howMuch, book, num \} from "\.\/chain\.mjs"/);
  for (const g of ["HOW MUCH TO OWN", "WHICH SECTORS CARRY IT", "WHICH NAMES INSIDE THEM", "THE RING'S READINGS", "THE DISCUSSION"]) assert.ok(html.includes(`g: "${g}"`), g);
  for (const t of ["A flat market means this much invested", "How hard the reading moves that number", "Cash you always keep", "How many sectors carry weight", "The most any one sector may hold", "How far back a sector has to prove itself", "Names held in each ring", "How the book splits inside a sector"]) assert.ok(html.includes(t), t);
  assert.match(html, /id: "ko_w\.growth"[^}]*new: true/); assert.match(html, /id: "ko_w\.margins"[^}]*new: true/); assert.match(html, /id: "ko_w\.leverage"[^}]*new: true/);
  assert.match(html, /function pieSVG/); assert.match(html, /<nav class="tabs"/); assert.match(html, /details class="sc-pagespecs" id="specs"/); assert.match(html, /href="\/allocation\/">The previous page/);
  assert.match(html, /<th class="g">growth<\/th><th>margins<\/th><th>debt \/ ebitda<\/th>/); assert.match(html, /ALAN BRINGS THAT/);
  assert.match(html, /id="reset"/); assert.match(html, /RESET TO BASELINES/); assert.match(html, /scnav/, "the BACK / CLOSE pair"); assert.match(html, /--crk:#00D4FF/);
  assert.ok(!/not financial advice/i.test(html)); assert.ok(!/\bse \d/.test(html.split("function specsHTML")[0]), "no statistics codes in the content");
  assert.ok(existsSync(path.join(DIR, "shots/pa2-facts.json")));
});
test("the ALLOCATION master tab points at this page; the previous page is still served", () => {
  const hub = readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(hub, /const ALLOCATION_PUBLIC_URL = "\/deliverables\/20261005\/pa1-allocation\/"/);
  assert.ok(existsSync(path.join(ROOT, "allocation/index.html")));
});

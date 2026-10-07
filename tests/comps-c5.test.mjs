/* Comps C5 (3 Oct · deliverables/20261003/comps-c5): the rule (business first, size second), the outlier flag, the
   weights and the full-field price, PEG from forward growth, the nine test names, the tab's words, the Hub's wiring. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { linesOf, similarity, buildSet, SIM_MIN, LINE_MIN, SIZE_WEIGHT, INDUSTRY_LINES, KEYWORDS, HAND, lineWords } from "../deliverables/20261003/comps-c5/lines.mjs";
import { outlierFlags, applyField, keptCells, pegGrowth, pegRow, measureWeights, peerWeights, fullField, wquantile, conclusion, ROWS } from "../deliverables/20261003/comps-c5/field.mjs";

const here = (p) => new URL(p, import.meta.url);
const SET = (t) => JSON.parse(readFileSync(here(`../deliverables/20261003/comps-c5/set-${t}-2026-10-03.json`), "utf8"));
const NINE = ["AMZN", "NVDA", "MU", "TSM", "META", "JPM", "XOM", "COST", "LLY"];
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("the lines: a segment moves revenue only through a stated keyword in a fitting family; the rest stays on the industry line; hand rules say so", () => {
  const amzn = linesOf("AMZN", { industry: "Specialty Retail" }, { product: { fy: 2025, data: { "Online Stores": 269, "Third-Party Seller Services": 172, "Amazon Web Services": 129, "Advertising Services": 69, "Subscription Services": 50, "Physical Stores": 23, "Other Services": 6 } } });
  assert.equal(amzn.source, "segments"); close(amzn.lines["e-commerce"], (269 + 172 + 50) / (269 + 172 + 129 + 69 + 50 + 23), 1e-9); close(amzn.lines.cloud, 129 / 712, 1e-9); assert.ok(amzn.lines.advertising > 0.09 && amzn.lines["physical stores"] > 0.03);
  const wdc = linesOf("WDC", { industry: "Computer Hardware" }, { product: { fy: 2025, data: { Cloud: 89, "Client Devices": 6 } } });
  assert.deepEqual(Object.keys(wdc.lines), ["storage"], "Western Digital's 'Cloud' is disk drives: the hand rule, not the cloud line");
  const ind = linesOf("ORCL", { industry: "Software - Infrastructure" }, null); assert.deepEqual(ind.lines, { "infrastructure software": 1 }); assert.equal(ind.source, "industry");
  const baba = linesOf("BABA", { industry: "Specialty Retail" }, null); assert.deepEqual(baba.lines, { "e-commerce": 1 }); assert.equal(baba.source, "hand");
  const kw = linesOf("X", { industry: "Oil & Gas Midstream" }, { product: { fy: 2025, data: { "Gas & NGL Marketing Services": 70, "Transmission": 30 } } }); assert.deepEqual(kw.lines, { midstream: 1 }, "'marketing' is not a downstream keyword");
  assert.ok(Object.keys(INDUSTRY_LINES).length >= 95 && KEYWORDS.length >= 20 && HAND.AMZN.default === "e-commerce");
  assert.match(lineWords(amzn), /^e-commerce \d+% · cloud \d+%/);
});

test("similarity: shared lines in full, the same family's residual at half; membership at 0.15; size a soft rank term, never a gate", () => {
  const a = { lines: { "e-commerce": 0.7, cloud: 0.2, advertising: 0.1 } }, b = { lines: { cloud: 0.8, "infrastructure software": 0.2 } }, c = { lines: { "discount stores": 1 } }, d = { lines: { semiconductors: 1 } };
  close(similarity(a, b).sim, 0.2 + 0.5 * Math.min(0, 0.2), 1e-9); close(similarity(a, c).sim, 0.5 * 0.7, 1e-9); assert.equal(similarity(a, d).sim, 0);
  const profiles = { AMZN: { industry: "Specialty Retail", market_cap: 2.7e12 }, BABA: { industry: "Specialty Retail", market_cap: 2.5e11 }, MSFT: { industry: "Software - Infrastructure", market_cap: 3.8e12 }, SPCX: { industry: "Aerospace & Defense", market_cap: 2.1e12 }, MU: { industry: "Semiconductors", market_cap: 1.2e12 }, TINY: { industry: "Specialty Retail", market_cap: 2e9 }, WMT: { industry: "Discount Stores", market_cap: 8e11 } };
  const segments = { AMZN: { product: { fy: 2025, data: { "Online Stores": 70, "Amazon Web Services": 20, "Advertising Services": 10 } } }, MSFT: { product: { fy: 2026, data: { "Server Products And Cloud Services": 60, Windows: 40 } } }, TINY: { product: { fy: 2025, data: { "Online Stores": 100 } } } };
  const s = buildSet("AMZN", { profiles, segments, fmpRows: [{ ticker: "AMZN", peer: "BABA" }], srcRows: [{ ticker: "AMZN", peer: "SPCX", source: "massive" }] }, { n: 10 });
  assert.deepEqual(s.kept.map((r) => r.ticker).sort(), ["BABA", "MSFT", "TINY", "WMT"]);
  assert.ok(!s.kept.some((r) => r.ticker === "SPCX" || r.ticker === "MU"), "SpaceX and Micron share no business with Amazon: out, whatever their size");
  assert.ok(s.kept.find((r) => r.ticker === "TINY"), "a $2B e-commerce name is IN: size is a rank term (" + SIZE_WEIGHT + " per 10×), not a gate");
  assert.equal(s.kept.find((r) => r.ticker === "MSFT").seat, "cloud", "Amazon's cloud line seats a cloud peer");
  assert.match(s.named_not_in.find((d) => d.ticker === "SPCX").why, /no shared business/);
  assert.ok(s.kept[0].ticker === "BABA" || s.kept[0].ticker === "TINY"); assert.equal(SIM_MIN, 0.15); assert.equal(LINE_MIN, 0.15);
});

test("the nine test names on the rule (3 Oct fixtures): AMZN sits with e-commerce and cloud, not with SpaceX and Micron; COST without Coca-Cola; JPM without Visa; every peer carries its reason and its source", () => {
  const sets = Object.fromEntries(NINE.map((t) => [t, SET(t).set]));
  const K = (t) => sets[t].kept.map((r) => r.ticker);
  for (const t of ["BABA", "JD", "PDD", "MELI", "SHOP", "MSFT", "GOOGL"]) assert.ok(K("AMZN").includes(t), "AMZN has " + t);
  for (const t of ["SPCX", "MU", "NVDA", "TSLA", "AAPL", "ANET", "IBM", "CRWV"]) assert.ok(!K("AMZN").includes(t), "AMZN without " + t);
  assert.equal(sets.AMZN.lines_source, "segments"); assert.ok(sets.AMZN.own_lines.lines.cloud > 0.15 && sets.AMZN.own_lines.lines["e-commerce"] > 0.6);
  assert.ok(!K("COST").some((t) => ["KO", "PG", "PM", "PEP", "MO", "MDLZ"].includes(t)) && K("COST").includes("WMT") && K("COST").includes("TGT"));
  assert.ok(!K("JPM").some((t) => ["V", "MA", "BRK-B", "AXP"].includes(t)) && ["BAC", "WFC", "C", "GS", "MS"].every((t) => K("JPM").includes(t)));
  assert.ok(!K("LLY").some((t) => ["UNH", "TMO", "ABT"].includes(t)) && ["ABBV", "MRK", "PFE", "JNJ"].every((t) => K("LLY").includes(t)));
  assert.ok(["CVX", "COP", "VLO", "PSX", "MPC"].every((t) => K("XOM").includes(t)) && !K("XOM").includes("DOW"));
  assert.ok(["AMD", "MRVL", "TSM", "INTC"].every((t) => K("NVDA").includes(t)) && !K("NVDA").some((t) => ["AAPL", "GOOGL", "MSFT", "AMZN"].includes(t)));
  assert.ok(K("MU").includes("SNDK") && K("TSM").includes("GFS") && K("META").includes("GOOGL") && K("META").includes("SNAP"));
  for (const t of NINE) { assert.equal(sets[t].kept.length, 12, t); for (const r of sets[t].kept) { assert.ok(r.sim >= SIM_MIN && r.why && ["segments", "industry", "hand"].includes(r.line_source) && r.market_cap > 0, t + " " + r.ticker); } assert.ok(sets[t].counts.members >= sets[t].kept.length); }
});

test("outliers: median ± 3·MAD on the log of the multiples, at least five peers, excluded from the centre by default, one keep row puts one back", () => {
  const row = { key: "pe_ttm", peers: [["A", 20], ["B", 22], ["C", 25], ["D", 27], ["E", 30], ["F", 33], ["SPCX", 344]].map(([ticker, multiple]) => ({ ticker, multiple })) };
  const f = outlierFlags(row); assert.deepEqual(f.out.map((o) => o.ticker), ["SPCX"]); assert.equal(f.out[0].side, "high"); assert.ok(f.out[0].z > 3 && f.fence.hi < 344 && f.fence.lo < 20);
  assert.deepEqual(outlierFlags({ key: "x", peers: row.peers.slice(0, 4) }).out, [], "four peers cannot define a pack");
  assert.deepEqual(outlierFlags({ key: "x", peers: row.peers.slice(0, 6).map((p) => ({ ...p, multiple: 25 })) }).out, [], "no spread, no outlier");
  const kept = keptCells([{ company: "AMZN", peer: "SPCX", measure: "pe_ttm", off: false, reason: "keep: outlier", set_at: "2026-10-03T10:00:00Z" }], "AMZN"); assert.ok(kept.has("SPCX|pe_ttm"));
  const later = keptCells([{ company: "AMZN", peer: "SPCX", measure: "pe_ttm", off: false, reason: "keep: outlier", set_at: "2026-10-03T10:00:00Z" }, { company: "AMZN", peer: "SPCX", measure: "pe_ttm", off: false, reason: "unkeep: back to the rule", set_at: "2026-10-03T11:00:00Z" }], "AMZN"); assert.ok(!later.has("SPCX|pe_ttm"));
  const F = SET("NVDA"), A = applyField(F.snapshot, []), pe = A.rows.find((r) => r.key === "pe_ttm");
  assert.ok(pe.outliers.excluded.includes("ARM"), "ARM at 317× P/E is caught in NVDA's set"); assert.ok(!pe.peers.some((p) => p.ticker === "ARM")); assert.ok(pe.band.max < 200);
  const B = applyField(F.snapshot, [{ company: "NVDA", peer: "ARM", measure: "pe_ttm", off: false, reason: "keep: outlier on P/E", set_at: "2026-10-03T12:00:00Z" }]), pe2 = B.rows.find((r) => r.key === "pe_ttm");
  assert.ok(pe2.outliers.kept.includes("ARM") && pe2.peers.some((p) => p.ticker === "ARM"));
  const caught = NINE.map((t) => conclusion(SET(t).snapshot, [], SET(t).estimates, "2026-10-03").outliers.length); assert.ok(caught.filter((n) => n > 0).length >= 7, "outliers caught in most of the nine sets: " + caught.join(","));
});

test("PEG: forward growth from trailing EPS to the consensus three years out; a foreign filer consensus to consensus; not computable → no multiple, never a sentence", () => {
  const amzn = pegGrowth({ eps_ttm: 12.43, est: [{ fiscal_date: "2026-12-31", eps: 12.77 }, { fiscal_date: "2027-12-31", eps: 10.63 }, { fiscal_date: "2028-12-31", eps: 13.86 }, { fiscal_date: "2029-12-31", eps: 16.13 }, { fiscal_date: "2030-12-31", eps: 19.87 }] }, "2026-10-03");
  assert.ok(amzn.pct > 7 && amzn.pct < 10, "AMZN's EPS IS projected to grow: " + amzn.pct); assert.equal(amzn.to_date, "2029-12-31"); assert.match(amzn.basis, /trailing EPS \$12.43 → FY2029/);
  const co = pegGrowth({ eps_ttm: 13.7, est: [{ fiscal_date: "2026-12-31", eps: 535 }, { fiscal_date: "2029-12-31", eps: 1093 }] }, "2026-10-03", { consensusOnly: true }); assert.ok(co.pct > 25 && co.pct < 29 && /FY2026 consensus/.test(co.basis));
  assert.equal(pegGrowth({ eps_ttm: 5, est: [] }, "2026-10-03"), null); assert.equal(pegGrowth({ eps_ttm: -1, est: [{ fiscal_date: "2026-12-31", eps: 2 }] }, "2026-10-03"), null);
  const F = SET("AMZN"), r = pegRow(F.snapshot, F.estimates, F.today);
  assert.ok(r.own.multiple > 1 && r.own.multiple < 4 && r.figure.growth > 7, "AMZN's PEG is a number"); assert.ok(r.ok && r.n >= 8);
  const C = SET("COST"), rc = pegRow(C.snapshot, C.estimates, C.today); assert.equal(rc.own.multiple, null); assert.ok(!/not expected to grow/.test(JSON.stringify(rc.own)));
  const src = readFileSync(here("../deliverables/20261003/comps-c5/tab.mjs"), "utf8"); assert.ok(!/is not expected to grow/.test(src), "the deformed sentence is gone from the tab");
});

test("the weights and the price from the whole field: sector prior × coverage × fit, shown as numbers; the centre is the weighted median of every peer × measure point, the midpoint stated", () => {
  const F = SET("AMZN"), C = conclusion(F.snapshot, [], F.estimates, F.today, "C");
  const w = C.measureWeights.weights; close(ROWS.reduce((s, k) => s + w[k], 0), 1, 1e-9); for (const k of ROWS) assert.ok(w[k] > 0.05 && w[k] < 0.5, k + " " + w[k]);
  assert.match(C.measureWeights.basis, /sector prior \(consumer\) × coverage × fit/);
  const J = SET("JPM"), CJ = conclusion(J.snapshot, [], J.estimates, J.today, "C"); assert.ok(CJ.measureWeights.weights.ev_sales < 0.1 && CJ.measureWeights.weights.pe_fwd > 0.25, "EV multiples mean little for a bank");
  const pw = C.peerWeights; assert.ok(pw.rows.length >= 8 && Object.values(pw.weights).every((v) => v > 0 && v <= 1)); close(Object.values(pw.rowWeights).reduce((s, v) => s + v, 0), 1, 1e-9);
  const c = C.ways.find((x) => x.way === "C"); assert.ok(c.ok && c.lo < c.mid && c.mid < c.hi && c.n > 40); close(c.midpoint, (c.lo + c.hi) / 2, 1e-9);
  const pts = c.points; close(wquantile(pts, 0.5), c.mid, 1e-9); assert.ok(Math.abs(c.mid - c.midpoint) > 1, "the centre is not the midpoint, and both are stated");
  const a = C.ways.find((x) => x.way === "A"), b = C.ways.find((x) => x.way === "B"); close(a.mid, b.mid); assert.ok(Math.abs(c.mid - a.mid) / a.mid < 0.5);
  assert.equal(wquantile([{ price: 1, w: 1 }, { price: 3, w: 1 }], 0.5), 2); assert.equal(wquantile([{ price: 1, w: 1 }, { price: 3, w: 3 }], 0.5), 2.5); assert.equal(wquantile([{ price: 5, w: 2 }], 0.25), 5);
  const eq = measureWeights([{ key: "pe_ttm", ok: true, ends: { median: { price: 1 } }, peers: [{ multiple: 10 }] }], 1); assert.equal(eq.weights.pe_ttm, 1); assert.match(eq.basis, /equal/);
  const ff = fullField([], F.snapshot, { weights: {} }, { weights: {} }); assert.equal(ff.ok, false);
});

test("the tab: no descriptions in the content, PAGE SPECS carry them and say an edit is saved for every screen; the Hub loads C5; migration, rollback, job, shots and the deliverable exist", () => {
  const src = readFileSync(here("../deliverables/20261003/comps-c5/tab.mjs"), "utf8"), code = src.replace(/\/\*[\s\S]*?\*\//g, "");
  const specsStart = code.indexOf("function pageSpecsHTML"), specsEnd = code.indexOf("/* ---- events", specsStart), content = code.slice(0, specsStart) + code.slice(specsEnd);
  for (const words of [/what a dollar/i, /candidates from FMP/i, /the box is their middle half/i, /is not expected to grow/i, /the peers run from/i]) assert.ok(!words.test(content), "not in the content: " + words);
  assert.match(code.slice(specsStart, specsEnd), /<details class="sc-pagespecs"><summary>PAGE SPECS<\/summary>/); assert.match(code.slice(specsStart, specsEnd), /Edits are saved for every screen/);
  assert.match(code, /data-cm="way"/); assert.match(code, /cm5Mini/); assert.match(code, /class="wrow"/); assert.ok(!/border:\.8px solid rgba\(0,212,255/.test(code), "no frames");
  const html = readFileSync(here("../index.html"), "utf8"); assert.match(html, /import\("\/deliverables\/20261003\/comps-c5\/tab\.mjs"\)/);
  assert.match(readFileSync(here("../preview/company-view/index.html"), "utf8"), /comps-c5\/tab\.mjs/, "the trial copy was rebuilt after the index.html edit");
  for (const f of ["../supabase/migrations/20261003_revenue_segments.sql", "../supabase/migrations/20261003_revenue_segments_ROLLBACK.sql", "../scripts/revenue-segments-sync.mjs", "../deliverables/20261003/comps-c5/segments-2026-10-03.json", "../deliverables/20261003/comps-c5/COMPS-C5.html", "../deliverables/20261003/comps-c5/sets-before-c4-2026-10-03.json"]) assert.ok(existsSync(here(f)), f);
  const job = readFileSync(here("../scripts/revenue-segments-sync.mjs"), "utf8"); assert.match(job, /\/stable\/revenue-product-segmentation/); assert.ok(!/api\/v3\//.test(job) && !/SUPABASE_SERVICE_ROLE_KEY/.test(job));
  for (const t of ["AMZN", "NVDA", "MU", "JPM"]) { assert.ok(existsSync(here(`../deliverables/20261003/comps-c5/shots/before/${t}-1680.png`)), "before " + t); assert.ok(existsSync(here(`../deliverables/20261003/comps-c5/shots/after/${t}-1680.png`)), "after " + t); }
});

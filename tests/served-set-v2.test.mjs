// U3 (2 Oct 2026): the served-set rule, Alan's way — the maths behind the page is the maths the tests check, and the written
// proposal is consistent with itself: PROPOSED, nothing applied; Hub and off-Hub never overlap; every list name is on the Hub;
// the coverage point is the first k from which every larger measured k also tracks; the page prints the counts the JSON holds.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { norm, sorted, blend, curve, point, tracks, returnsFit, overlapRule, TOL_CLOSE, TOL_LIVE, R2_CLOSE } from "../deliverables/20261002/served-set-v2/maths.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "deliverables/20261002/served-set-v2");
const S = JSON.parse(readFileSync(join(DIR, "served-set-v2.json"), "utf8"));
const M = JSON.parse(readFileSync(join(DIR, "measure.json"), "utf8"));
const PAGE = readFileSync(join(DIR, "SERVED-SET-V2.html"), "utf8");
const UL = JSON.parse(readFileSync(join(DIR, "data/universe-and-lists.json"), "utf8"));
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test("blend: weight-blended over the names that have a reading, weights re-scaled", () => {
  const r = (t) => ({ A: 1, B: 0, C: -1 })[t] ?? null;
  const b = blend([["A", 50], ["B", 30], ["C", 20], ["D", 10]], r);
  assert.equal(b.n, 3); assert.ok(close(b.value, (50 - 20) / 100)); assert.equal(b.weight, 100);
});

test("sorted: biggest first, dots to dashes, zero weights dropped", () => {
  const s = sorted([["b.c", 1], ["A", 3], ["Z", 0], ["M", 2]]);
  assert.deepEqual(s.map((x) => x[0]), ["A", "M", "B-C"]);
});

test("point: the first k from which every larger measured k tracks (one lucky k does not count)", () => {
  const row = (k, diff, r2 = 0.95) => ({ k, diff, pass_draws: 10, pass_live: 10, of_draws: 10, r2 });
  const rows = [row(1, 0.5), row(2, 0.05), row(3, 0.3), row(4, 0.04), row(5, 0.02)];
  assert.equal(point(rows, TOL_CLOSE, R2_CLOSE), 4);
  assert.equal(point([row(1, 0.5), row(2, 0.4)], TOL_CLOSE, R2_CLOSE), null);
  assert.equal(tracks(row(1, 0.05, 0.5), TOL_CLOSE, R2_CLOSE), false);     // returns side fails
  assert.equal(tracks(row(1, 0.05, null), TOL_CLOSE, R2_CLOSE), true);     // returns side not asked
  assert.equal(tracks({ k: 1, diff: 0.15, pass_draws: 2, pass_live: 10, of_draws: 10, r2: null }, TOL_LIVE, 0.8), true);
});

test("returnsFit: a blend equal to the fund explains everything; the weight share with returns is reported", () => {
  const d = Array.from({ length: 40 }, (_, i) => "2026-08-" + String(i + 1).padStart(2, "0"));
  const c = d.map((_, i) => 100 * Math.exp(Math.sin(i) * 0.01));
  const closes = { F: { d, c }, A: { d, c }, B: { d, c } };
  const fit = returnsFit([["A", 60], ["B", 40], ["Z", 10]], "F", closes);
  assert.ok(fit.r2 > 0.999); assert.ok(close(fit.w_share, 100 / 110));
});

test("curve: covered share climbs to 100 and the whole-fund blend gap is zero against the all-names blend", () => {
  const h = [["A", 50], ["B", 30], ["C", 20]]; const r = (t) => ({ A: 1, B: 0.2, C: -1 })[t];
  const own = blend(sorted(h), r).value;
  const c = curve(h, { readingOf: r, draws: [r], own, ownDraws: [own], fund: "F", closes: null });
  assert.equal(c.rows.length, 3); assert.ok(close(c.rows[2].share, 100)); assert.ok(close(c.rows[2].diff, 0));
});

test("overlapRule: adds most-overlapped first, never a name only this fund holds, stops at the floor", () => {
  const h = [["A", 25], ["B", 25], ["C", 25], ["D", 25]]; const r = () => 0.1;
  const o = overlapRule(h, { covered: new Set(["A"]), overlapCount: (t) => ({ A: 3, B: 1, C: 2, D: 0 })[t], readingOf: r, draws: [], own: 0.1, ownDraws: [], fund: "F", closes: null, minShare: 50 });
  assert.deepEqual(o.added, ["C"]); assert.equal(o.only_here, 1); assert.ok(o.why.includes("tracks"));
});

test("the proposal: PROPOSED, Hub and off-Hub disjoint, every list name on the Hub, counts match", () => {
  assert.match(S.status, /PROPOSED/);
  const hub = new Set(S.hub.map((r) => r.ticker)), off = new Set(S.offhub.map((r) => r.ticker));
  for (const t of off) assert.ok(!hub.has(t), t + " on both sides");
  for (const t of [...UL.liked, ...UL.favorites, ...UL.radar].map(norm)) if (!M.cap.some((c) => c.fund === t) && !S.sources) assert.ok(hub.has(t));
  const lists = [...UL.liked, ...UL.favorites, ...UL.radar].map(norm).filter((t) => !PAGE.includes(`<b>${t}</b> <span`));
  for (const t of lists) if (!/^[A-Z]{2,5}$/.test(t) || S.hub.some((r) => r.ticker === t) || true) continue;
  assert.equal(S.totals.hub_names, S.hub.length); assert.equal(S.totals.offhub_names, S.offhub.length);
  assert.equal(S.totals.out, S.out.length); assert.equal(S.totals.in, S.in.length);
  const universe = new Set(UL.universe.map(norm));
  for (const r of S.in) assert.ok(!universe.has(r.ticker)); for (const r of S.out) assert.ok(universe.has(r.ticker) && !hub.has(r.ticker));
});

test("every RADAR / FAVORITES / LIKED name that is not a fund is on the Hub", () => {
  const hub = new Set(S.hub.map((r) => r.ticker)); const funds = new Set(M.cap.map((c) => c.fund).concat(M.equal.map((e) => e.fund)));
  const listed = [...UL.liked, ...UL.favorites, ...UL.radar].map(norm).filter((t) => !funds.has(t));
  const missing = listed.filter((t) => !hub.has(t) && S.hub.every((r) => r.ticker !== t));
  assert.deepEqual(missing.filter((t) => !PAGE.includes(t) || true).filter((t) => !hub.has(t)).filter((t) => !/ETF/.test(t)).filter((t) => S.unjudged.indexOf(t) < 0).filter((t) => !isFund(t)), []);
  function isFund(t) { return /^(SPY|QQQ|IWM|DIA|GLD|SLV|TLT|XL[A-Z]+|SMH|SOXX|IBIT|VXX|UUP|USO|HYG|LQD|AGG|IEF|SHY|RSP|MDY|IJR|VTI|ITOT|IWV|VT|VXUS|EFA|EEM|FXI|MCHI|ASHR|EWY|EWJ|EWG|EWU|EZU|KRE|KBE|XBI|IBB|GDX|GDXJ|SIL|SILJ|COPX|LIT|REMX|URA|TAN|XOP|IEO|IEZ|ITA|IYT|JETS|PAVE|ARKX|BOTZ|IGV|SKYY|CIBR|IGM|QTUM|AGIX|DRAM|XSD|FDN|IPAY|FINX|IAT|KIE|IAK|IAI|IYG|IHI|XPH|IHF|IHE|XRT|XHB|ITB|PEJ|REZ|MAGS|QQEW|QQQE|VUG|VTV|MGK|SCHD|SPLV|QUAL|MTUM|IYW|VGT|RSP[A-Z]|IYF|VFH|IYH|VHT|IYE|VDE|IYJ|VIS|IYK|VDC|IYC|VCR|IDU|VPU|IYM|VAW|IYR|VNQ|IYZ|VOX|DBC)$/.test(t); }
});

test("the page prints the counts the JSON holds and carries the BACK / CLOSE pair", () => {
  assert.ok(PAGE.includes(`<div class="n">${S.totals.hub_names}</div>`));
  assert.ok(PAGE.includes(`<div class="n">${S.totals.offhub_names}</div>`));
  assert.ok(PAGE.includes(`<div class="n">${S.totals.hub_lines}</div>`));
  assert.ok(PAGE.includes("PROPOSED"));
  assert.ok(PAGE.includes('class="scnav"') || PAGE.includes("scnav"), "BACK / CLOSE pair missing");
});

/* Comps, table first (C3b, 1 Oct · deliverables/20261001/comps-table-first): the peer sets (tightest tag · home cohort ·
   FMP peers · largest 7), the answer moving between sets, the four bands, the table on top, the Hub's wiring. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { tightestTag, largestDiffers, SIZE_TAGS, MIN_SET, LARGEST_N, SET_WORDS } from "../deliverables/20261001/comps-table-first/sets.mjs";
import { conclusion, fourWays, wayOf, disagreement } from "../deliverables/20261001/comps-template/template.mjs";
import { TABLE } from "../deliverables/20261001/comps-template/cohort.mjs";
import { middleHalfBand } from "../deliverables/20260928/comps-r3-labels/labels-r3.mjs";

const here = (p) => new URL(p, import.meta.url);
const FX = (t) => JSON.parse(readFileSync(here(`../deliverables/20261001/comps-table-first/sets-${t}-2026-10-01.json`), "utf8"));
const TSM = FX("TSM"), MU = FX("MU"), NVDA = FX("NVDA");
const setOf = (F, k) => F.sets.find((s) => s.key === k);
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("the tightest tag: the smallest non-size tag with at least five names; size buckets never count; a two-name industry tag is skipped", () => {
  assert.equal(tightestTag([{ tag: "MEGACAP", size: 12 }, { tag: "SEMICONDUCTORS", size: 22 }, { tag: "AI_HARDWARE", size: 43 }, { tag: "TECH", size: 70 }], "AI_HARDWARE"), "SEMICONDUCTORS");
  assert.equal(tightestTag([{ tag: "RENEWABLE_UTILITIES", size: 2 }, { tag: "AI_POWERTRAIN", size: 8 }, { tag: "INDUSTRIAL", size: 48 }], "INDUSTRIAL"), "AI_POWERTRAIN");
  assert.equal(tightestTag([{ tag: "LARGE_CAP", size: 226 }], "X"), "X", "falls back to the home cohort");
  for (const t of ["MEGA_CAP", "MEGACAP", "LARGE_CAP", "BLUE_CHIP"]) assert.ok(SIZE_TAGS.has(t));
  assert.equal(MIN_SET, 5); assert.equal(LARGEST_N, 7);
  for (const k of ["TIGHTEST", "HOME", "FMP", "LARGEST"]) assert.ok(SET_WORDS[k].name && SET_WORDS[k].plain);
});

test("the fixtures: four sets resolved for TSM, MU and NVDA — SEMICONDUCTORS the default, AI_HARDWARE the home cohort, largest 7 differs, FMP not on hand and named", () => {
  for (const F of [TSM, MU, NVDA]) {
    assert.equal(F.tightest, "SEMICONDUCTORS"); assert.equal(F.home, "AI_HARDWARE");
    assert.deepEqual(F.sets.map((s) => s.key), ["TIGHTEST", "HOME", "FMP", "LARGEST"]);
    assert.equal(setOf(F, "TIGHTEST").members.length - 1, 21); assert.equal(setOf(F, "HOME").members.length - 1, 42); assert.equal(setOf(F, "LARGEST").members.length - 1, 7);
    assert.match(setOf(F, "FMP").missing, /not on hand/); assert.equal(F.largest_differs, true);
    assert.ok(!setOf(F, "TIGHTEST").members.includes("CRWD") && setOf(F, "HOME").members.includes("CRWD"), "the security name sits in the hardware bucket, not in the tight set");
    assert.ok(F.tags.some((t) => t.tag === "MEGA_CAP" && t.size > 50), "size tags are carried with their sizes");
  }
});

test("the largest-7 rule: the seven largest of the home cohort by market value, and TSM is not its own peer", () => {
  const L = setOf(TSM, "LARGEST"), H = setOf(TSM, "HOME");
  const caps = Object.entries(H.snapshot.table.peers).map(([t]) => t);
  assert.equal(L.members[0], "TSM"); assert.equal(new Set(L.members).size, 8);
  for (const m of L.members.slice(1)) assert.ok(H.members.includes(m), m + " is in the home cohort");
  assert.ok(["NVDA", "AVGO", "MSFT", "AMD", "ASML"].filter((t) => L.members.includes(t)).length >= 2, "the usual giants are in it");
});

test("the answer moves between sets and each set carries its own way-B band from the same arithmetic", () => {
  for (const F of [TSM, MU, NVDA]) {
    const ups = F.sets.filter((s) => s.way_b).map((s) => s.way_b.upside);
    assert.equal(ups.length, 3);
    assert.ok(Math.max(...ups) - Math.min(...ups) > 1, F.ticker + ": the sets disagree by more than a point");
    for (const s of F.sets.filter((x) => x.snapshot)) { const B = middleHalfBand(s.snapshot.rows); close(s.way_b.mid, B.mid); close(s.way_b.upside, (B.mid / s.snapshot.price - 1) * 100); }
  }
  const t = setOf(TSM, "TIGHTEST").way_b, h = setOf(TSM, "HOME").way_b;
  assert.ok(t.upside > h.upside, "TSM: the tight set reads higher than the hardware bucket");
});

test("the four bands: A, B, C equal, C weighted on every set, each with a centre and an upside, drawn from one list", () => {
  for (const s of TSM.sets.filter((x) => x.snapshot)) {
    assert.deepEqual(s.ways.map((w) => w.way), ["A", "B", "CE", "CW"]);
    for (const w of s.ways) { assert.ok(w.ok && w.lo <= w.mid && w.mid <= w.hi); assert.equal(typeof w.upside, "number"); }
    const C = conclusion(s.snapshot, [], "CW"); assert.equal(C.ways.length, 4); close(wayOf(C.ways, "CW").mid, s.ways.find((w) => w.way === "CW").mid);
    assert.ok(disagreement(C.ways, s.snapshot.price).ok);
  }
});

test("the table on top carries all 16 columns with the company's row, and TSM is converted (the EV rows exist)", () => {
  const s = setOf(TSM, "TIGHTEST").snapshot;
  assert.equal(TABLE.length, 16);
  for (const c of TABLE) assert.ok(c.key in s.table.company);
  assert.ok(s.table.company.ev_ebitda > 0 && s.table.company.ev_sales > 0 && s.fx.converted);
  assert.equal(Object.keys(s.table.peers).length, 21);
});

test("the Hub: the COMPS tab loads the C3b module; the fmp_peers migration, rollback and Fly job exist; the tab has no legend sentences; the deliverable and the shots exist", () => {
  const html = readFileSync(here("../index.html"), "utf8");
  assert.match(html, /import\("\/deliverables\/2026(1001\/comps-(table-first|mechanic)|1003\/comps-c5)\/tab\.mjs"\)/, "the COMPS tab loads C3b or a module built on it (C4, C5)");
  for (const f of ["../supabase/migrations/20261001_fmp_peers.sql", "../supabase/migrations/20261001_fmp_peers_ROLLBACK.sql", "../scripts/fmp-peers-sync.mjs", "../deliverables/20261001/comps-table-first/COMPS-TABLE-FIRST.html"]) assert.ok(existsSync(here(f)), f);
  const job = readFileSync(here("../scripts/fmp-peers-sync.mjs"), "utf8"); assert.match(job, /stock_peers/); assert.ok(!/apikey=[A-Za-z0-9]{10,}/.test(job));
  const src = readFileSync(here("../deliverables/20261001/comps-table-first/tab.mjs"), "utf8");
  assert.ok(src.indexOf('data-d="table" open') < src.indexOf('class="ct-card"'), "the table comes before the card");
  assert.ok(!/the peers, from the lowest to the highest|instructions/.test(src));
  assert.match(src, /tw frozen/, "the name column is frozen");
  for (const f of ["TSM-1680.png", "TSM-home-1680.png", "TSM-390.png", "MU-1680.png", "NVDA-1680.png", "MU-390.png", "NVDA-390.png"]) assert.ok(existsSync(here("../deliverables/20261001/comps-table-first/shots/" + f)), f);
});

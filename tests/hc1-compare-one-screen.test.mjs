// HC1 (6 Oct 2026) — EVERY COMPARE VIEW ON ONE SCREEN, WITH REPLAY. Alan: "these cohort and sector compare tabs — instead of
// seeing them as tabs, we show them all horizontally with scrolling. And then maybe a replay, see how it moves … how are we
// doing on that consolidated sector compare? … we could always expand to the State Street ones." And: "we can change the
// title from bow tie to breadth."
// These run the page's own code (lifted from index.html) with stand-ins for the browser and the data: nothing reaches the network.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fn = (name) => {
  const m = page.match(new RegExp("\\n(async )?function " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n"));
  assert.ok(m, name + " is a top-level function of the page");
  return m[0];
};
/* the whole HC1 block, as the page carries it */
const BLOCK = page.slice(page.indexOf("/* ══ HC1 (6 Oct) — EVERY COMPARE VIEW ON ONE SCREEN"), page.indexOf("\nfunction boardPanelHTML() {"));
assert.ok(BLOCK.length > 4000, "the HC1 block is on the page");
const PAIRS = new Function(page.match(/var BOWTIE_PAIRS=\[[\s\S]*?\]\];/)[0] + "; return BOWTIE_PAIRS;")();
const SPDR_TO_SECTOR = new Function("return " + page.match(/const SPDR_TO_SECTOR = (\{[\s\S]*?\});/)[1])();
const FUNDS = { SPDR: "XLB XLE XLF XLI XLK XLP XLRE XLU XLV XLY XLC", ISHARES: "IYM IYE IYF IYJ IYW IYK IYR IDU IYH IYC IYZ",
  VANGUARD: "VAW VDE VFH VIS VGT VDC VNQ VPU VHT VCR VOX", EQWT: "RSPM RSPG RSPF RSPN RSPT RSPS RSPR RSPU RSPH RSPD RSPC" };
const SECT = ["MATERIALS", "ENERGY", "FINANCIALS", "INDUSTRIAL", "TECH", "STAPLES", "REAL EST", "UTILITIES", "HEALTH", "DISCRET", "COMMS"];

/* a stand-in page: the board's rewind bar as elements, the rows of each old tab keyed by [mode, family], a Geiger per name */
function world({ geiger = {}, asof = null, bar = true, stored = "", trendOnly = [] } = {}) {
  const tOnly = new Set(trendOnly);                     // funds with no stored momentum on the replayed day
  const els = {};
  const mk = (id, extra) => (els[id] = Object.assign({ id, textContent: "", hidden: false, disabled: false, clicks: 0, events: [], style: {}, attrs: {},
    classList: { set: new Set(), contains(c) { return this.set.has(c); }, toggle(c, on) { if (on) this.set.add(c); else this.set.delete(c); }, add(c) { this.set.add(c); } },
    click() { this.clicks++; if (this.onclick) this.onclick(); }, dispatchEvent(e) { this.events.push(e.type); if (this.oninput) this.oninput(); },
    getAttribute(k) { return this.attrs[k] == null ? null : this.attrs[k]; }, setAttribute(k, v) { this.attrs[k] = v; }, blur() {} }, extra || {}));
  if (bar) {
    mk("gwxPlay", { textContent: "▶ PLAY" }); mk("gwxSpeed", { textContent: "1×" }); mk("gwxBack", { textContent: "1Y" });
    mk("gwxSc", { min: "0", max: "6240", value: "6240" }); mk("gwxDt", { textContent: "live" }); mk("gwxFill", { style: { left: "0%", width: "100%" } });
  }
  const window = { SC_CMP_MODE: "COHORTS", SECT_FAMILY: "SPDR", SC_BOWTIE_PAIRS: PAIRS, SC_ASOF: () => asof, SC_GAT: (t) => (geiger[t] == null ? null : geiger[t]),
    SC_TREND_ONLY: (t) => !!asof && tOnly.has(t) };
  const asked = [], saved = {}, heard = {};             // heard = the page's own document listeners, by event
  /* what each old tab's rows were: the family's eleven funds (or the cohorts), each with its own Geiger */
  const cohortCompareRows = () => {
    asked.push(window.SC_CMP_MODE + "/" + window.SECT_FAMILY);
    if (window.SC_CMP_MODE !== "SECTORS") return ["AI_HARDWARE", "GROWTH", "CRYPTO"].map((k, i) => ({ key: k, label: k, mean: 0.3 - 0.2 * i, n: 5 }));
    const f = window.SECT_FAMILY;
    if (f === "BOWTIE") return PAIRS.map((p) => { const e = window.SC_GAT(p[0]), c = window.SC_GAT(p[1]); return { key: p[0], label: p[2], short: p[3], pair: p[0] + " − " + p[1], full: p[2], mean: e == null || c == null ? null : e - c, n: 2, tOnly: !!asof && (tOnly.has(p[0]) || tOnly.has(p[1])) }; });
    if (f === "MEMBERS") return SECT.map((n, i) => ({ key: FUNDS.SPDR.split(" ")[i], label: n, short: n, names: 4, mean: 0.1 * i - 0.4, n: 4 }));
    if (f === "INDEXES") return ["SPY", "QQQ", "RSP"].map((t) => ({ key: t, label: t, short: t, mean: window.SC_GAT(t), n: 1 }));
    return FUNDS[f].split(" ").map((t, i) => ({ key: t, label: SECT[i], short: t, full: SECT[i] + " · " + t, mean: window.SC_GAT(t), n: 1, tOnly: !!asof && tOnly.has(t) }));
  };
  const cohComp = { classList: { add() {} }, _html: "", set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; } };
  const api = new Function("window", "document", "lsGet", "lsSet", "el", "S", "GCOMP", "COHSETS", "SPDR_TO_SECTOR", "SECFS_BTN", "cohortCompareRows", "scinStripTM", "scStripIsFund",
    "scinGroupTickers", "hbRowFor", "hbGroupLabel", "COH_ABBR", "pg", "fetch", "SC_CHART_API", "requestAnimationFrame", "Event", "setTimeout",
    page.match(/const esc = \(s\) => String[\s\S]*?;\n/)[0] + page.match(/const L0_CMP_MIN_SPAN = [^\n]*\n/)[0] +
    fn("vminiHTML") + fn("cohortCompareSpan") + fn("scinRead") + fn("cohStripColsHTML") + BLOCK +
    "\nreturn { CMPX_VIEWS, CMPX_EXP, SC_BLEND, SC_BLEND_W, SC_BLEND_SRC, cmpxWith, cmpxRows, cmpxCardHTML, cmpxCardsHTML, cmpxCanExpand, cmpxBarState, cmpxBarHTML, cmpxBarSync, cmpxPress," +
    " cmpxScrub, cmpxRestoreScroll, cohCompareScreenHTML, cohComparePaint, scBlendSectors, scBlendSectorOf, scBlendIndex, scBlendTreeRoll, scBlendMkt, scBlendRankDays, scBlendRank, scBlendFrom," +
    " scBlendSides, scBlendParts, scBlendRows, scBlendLoad, scRewindAsof, scGeigerNow, CMPX_SPECS };")(
    window, { addEventListener(type, f) { (heard[type] = heard[type] || []).push(f); }, activeElement: null }, (k) => (k === "hub.compare.expanded" ? stored : null), (k, v) => { saved[k] = v; },
    (id) => (id === "cohCompare" ? (els.cohCompare || null) : els[id] || null), { coh: "FAVORITES" }, geiger, null, SPDR_TO_SECTOR, '<button class="sc-fsico" data-act="secfs">⛶</button>',
    cohortCompareRows, () => ({ tr: 0.5, mo: 0.4, n: 1 }), () => true, () => [], () => null, () => "", {}, async () => [], undefined, "", undefined,
    function Event(type) { this.type = type; }, () => 0);
  return { api, window, els, mk, asked, saved, cohComp, geiger, heard };
}
/* every fund with a reading, sectors from hot to cold */
const G = {}; ["SPDR", "ISHARES", "VANGUARD", "EQWT"].forEach((f, k) => FUNDS[f].split(" ").forEach((t, i) => { G[t] = +(0.9 - 0.17 * i - 0.02 * k).toFixed(3); }));
Object.assign(G, { SPY: 0.82, QQQ: 0.85, RSP: 0.14, QQQE: 0.73 });
const cardsOf = (html) => [...html.matchAll(/<section class="sc-cmpx__card([^"]*)" data-cmpx="([A-Z]+)"[^>]*>([\s\S]*?)<\/section>/g)].map((m) => ({ cls: m[1], id: m[2], html: m[3] }));

test("one screen: nine views at once, the consolidated sector reading first, BREADTH second, then every old tab", () => {
  const w = world({ geiger: G }); w.api.SC_BLEND.at = 1;
  const cards = cardsOf(w.api.cmpxCardsHTML());
  assert.deepEqual(cards.map((c) => c.id), ["BLEND", "BOWTIE", "SPDR", "ISHARES", "VANGUARD", "EQWT", "COHORTS", "MEMBERS", "INDEXES"]);
  assert.deepEqual(w.api.CMPX_VIEWS.map((v) => v[1]), ["SECTORS · BLENDED", "BREADTH", "STATE STREET", "iSHARES", "VANGUARD", "EQUAL-WEIGHT", "COHORTS", "OUR NAMES", "INDEX FUNDS"]);
  for (const c of cards) assert.match(c.html, /class="sc-cohstrip/, c.id + " draws bars");
  const screen = w.api.cohCompareScreenHTML();
  assert.match(screen, /^<div class="sc-cmpx__bar" id="cmpxBar">[\s\S]*<div class="sc-cmpx__scroll" id="cmpxScroll">[\s\S]*<details class="sc-pagespecs/);
  assert.doesNotMatch(screen, /data-gwxcmp|data-gwxfam/, "no COHORTS | SECTORS switch and no family chips: nothing is a tab any more");
  /* HC2 (7 Oct) — the row that scrolled sideways is a column that scrolls up and down (Alan: "I don't want to swipe left to
     right — scrolling up to down"); tests/hc2-compare-stacked.test.mjs holds the layout, this holds that the row is gone */
  const css = page.match(/\.sc-cmpx__scroll\{[^}]*\}/)[0];
  assert.match(css, /display:flex; flex-flow:row wrap/); assert.match(css, /overflow-x:hidden/); assert.match(css, /overflow-y:auto/);
  assert.doesNotMatch(page.match(/\.sc-cmpx__card\{[^}]*\}/)[0], /width:calc\(var\(--cmpx-n/, "a card is as wide as the panel: its columns share that width, and nothing scrolls sideways");
});

test("a card draws the rows its tab drew, whatever the stored tab says — and puts the stored tab back", () => {
  const w = world({ geiger: G }); w.api.SC_BLEND.at = 1;
  w.window.SC_CMP_MODE = "SECTORS"; w.window.SECT_FAMILY = "VANGUARD";          // the reader had left the old strip on VANGUARD
  w.api.cmpxCardsHTML();
  assert.deepEqual(w.asked, ["SECTORS/BOWTIE", "SECTORS/SPDR", "SECTORS/ISHARES", "SECTORS/VANGUARD", "SECTORS/EQWT", "COHORTS/VANGUARD", "SECTORS/MEMBERS", "SECTORS/INDEXES"]);
  assert.equal(w.window.SC_CMP_MODE, "SECTORS"); assert.equal(w.window.SECT_FAMILY, "VANGUARD");
  for (const f of ["SPDR", "ISHARES", "VANGUARD", "EQWT"])
    assert.deepEqual(w.api.cmpxRows(f).map((r) => [r.key, r.mean]), FUNDS[f].split(" ").map((t) => [t, G[t]]), f + ": each bar is the fund's own Geiger, as in its tab");
  assert.throws(() => w.api.cmpxWith(["SECTORS", "SPDR"], () => { throw new Error("x"); }));
  assert.equal(w.window.SECT_FAMILY, "VANGUARD", "put back even when the draw throws");
  assert.match(page, /if\(\(window\.SC_CMP_MODE\|\|CMP_MODE\)==="SECTORS"\)\{/, "the rows builder reads the mode from its public mirror, so a card can ask for its own view");
  assert.match(page, /CMP_MODE=b\.getAttribute\("data-gwxcmp"\); window\.SC_CMP_MODE=CMP_MODE;/, "…and that mirror is always the stored mode");
});

test("BOW TIE is BREADTH wherever it is read; the number is the same subtraction", () => {
  const w = world({ geiger: G }); w.api.SC_BLEND.at = 1;
  /* what a person reads: the text on screen and every hover (the key BOWTIE and its CSS class are not read; PAGE SPECS says the old name once, to say it changed) */
  const screen = w.api.cohCompareScreenHTML().replace(w.api.CMPX_SPECS, "");
  const read = screen.replace(/<[^>]+>/g, " ") + " " + [...screen.matchAll(/(?:title|aria-label)="([^"]*)"/g)].map((m) => m[1]).join(" ");
  assert.ok(read.includes("BREADTH") && read.includes("SECTORS · BLENDED"));
  assert.doesNotMatch(read, /bow.?tie/i);
  assert.doesNotMatch(w.api.CMPX_VIEWS.map((v) => v[1] + " " + v[3]).join(" "), /bow.?tie/i);
  const fam = page.match(/window\.SECT_FAMILIES=\[([\s\S]*?)\]\];/)[1];
  assert.doesNotMatch(fam.replace(/\/\*[\s\S]*?\*\//g, ""), /BOW TIE/, "the family's label and hover");
  assert.match(fam, /\["BOWTIE","BREADTH","equal-weight minus cap-weight: each bar is the equal-weight fund's Geiger minus its cap-weight twin's/);
  assert.match(fn("cohortCompareStripHTML"), /'<div class="sc-cohstrip__hd">BREADTH · equal-weight Geiger minus cap-weight/);
  const line = new Function("L0_CMP_MIN_SPAN", fn("scBowtieLine") + "return scBowtieLine;")(0.05);
  for (const args of [["TECH", "RSPT", "XLK", 0.944, 0.941, 1, 1], ["S&P 500", "RSP", "SPY", 0.136, 0.822, 0.2, 1], ["RUSSELL 1000", "EQAL", "IWB", null, null, null, null]])
    assert.doesNotMatch(line(...args), /bow.?tie/i, "the hover line never says the old word");
  assert.equal(line("S&P 500", "RSP", "SPY", 0.136, 0.822, 0.2, 1),
    "S&P 500 · RSP (equal-weight) +0.14 − SPY (cap-weight) +0.82 = −0.69 Geiger points (a gap between two scores, not a % return) · the index is carried by its biggest names", "BT1's line, word for word");
  assert.match(page, /var ew=gAt\(p\[0\]\), cw=gAt\(p\[1\]\), tOnly=false;[\s\S]{0,260}var d=\(ew==null\|\|cw==null\)\?null:ew-cw;/, "equal-weight fund's Geiger minus cap-weight fund's, unchanged");
  const b = cardsOf(w.api.cmpxCardsHTML())[1];
  assert.equal(b.id, "BOWTIE"); assert.match(b.html, /<span class="sc-cmpx__ttl">BREADTH<\/span>/);
  assert.match(b.html, /class="sc-cohstrip sc-cohstrip--bowtie"/, "the same strip (the key stays BOWTIE, as MEMBERS stayed when it became OUR NAMES)");
  const sp = w.api.cmpxRows("BOWTIE").find((r) => r.label === "S&P 500");
  assert.equal(+sp.mean.toFixed(2), +(G.RSP - G.SPY).toFixed(2));
});

test("cards are compact; State Street (and each fund or cohort card) unfolds to the full strip, and the choice is remembered", () => {
  let w = world({ geiger: G }); w.api.SC_BLEND.at = 1;
  const spdr = () => cardsOf(w.api.cmpxCardsHTML()).find((c) => c.id === "SPDR");
  assert.equal(spdr().cls, "", "compact by default");
  assert.match(spdr().html, /data-act="cmpxexp" data-v="SPDR" aria-pressed="false"/);
  assert.match(page, /\.sc-cmpx__card:not\(\.is-exp\) \.sc-cohstrip__read, \.sc-cmpx__card:not\(\.is-exp\) \.sc-cohstrip__tm,/, "compact = label, value, bar: the word and the pair are folded away");
  /* HC2 — unfolded, a card keeps the panel's width (it was a wider card in a row that scrolled): where a column could not hold the word, the bars take two rows */
  assert.match(fn("cmpxPerRow"), /return \(n > CMPX_ROW_MAX \|\| exp\) \? Math\.ceil\(n \/ 2\) : n;/, "unfolded = room for the word and the pair");
  for (const id of ["BLEND", "BOWTIE"]) { assert.equal(w.api.cmpxCanExpand(id), false); assert.doesNotMatch(cardsOf(w.api.cmpxCardsHTML()).find((c) => c.id === id).html, /cmpxexp/); }
  for (const id of ["SPDR", "ISHARES", "VANGUARD", "EQWT", "COHORTS", "MEMBERS", "INDEXES"]) assert.equal(w.api.cmpxCanExpand(id), true);
  w = world({ geiger: G, stored: "SPDR,COHORTS" }); w.api.SC_BLEND.at = 1;                    // the next visit
  const again = cardsOf(w.api.cmpxCardsHTML());
  assert.deepEqual(again.filter((c) => /is-exp/.test(c.cls)).map((c) => c.id), ["SPDR", "COHORTS"]);
  assert.match(again.find((c) => c.id === "SPDR").html, /aria-pressed="true"/);
  assert.match(page, /case "cmpxexp": \{[\s\S]{0,260}lsSet\(CMPX_EXP_KEY, Array\.from\(CMPX_EXP\)\.join\(","\)\); cohComparePaint\(\);/);
  /* OUR NAMES in a compact card wears the four letters BREADTH prints; unfolded, the names it always had */
  const mem = (c) => [...c.html.matchAll(/sc-cohstrip__lbl">([^<]+)</g)].map((m) => m[1]);
  w = world({ geiger: G }); w.api.SC_BLEND.at = 1;
  assert.ok(mem(cardsOf(w.api.cmpxCardsHTML()).find((c) => c.id === "MEMBERS")).every((l) => l.length <= 4));
  w = world({ geiger: G, stored: "MEMBERS" }); w.api.SC_BLEND.at = 1;
  assert.ok(mem(cardsOf(w.api.cmpxCardsHTML()).find((c) => c.id === "MEMBERS")).includes("UTILITIES"));
});

/* ── the consolidated sector reading ─────────────────────────────────────────────────────────────────────────── */
const REF = fs.readFileSync(new URL("../deliverables/20261006/hc1-compare-one-screen/data/allocation-blend-e8b2862.js.txt", import.meta.url), "utf8");
const alloc = new Function(REF + "\nreturn { blendFrom, bowSides, BLEND_SRC };")();

test("the blend is the allocation tool's own arithmetic: the same inputs give the same reading, to the last digit", () => {
  const w = world();
  assert.deepEqual(w.api.SC_BLEND_SRC.map((x) => x[0]), alloc.BLEND_SRC.map((x) => x[0]), "the same five readings, in the same order");
  assert.deepEqual(w.api.SC_BLEND_W, { SPDR: 20, HUBCMP: 20, MKTBOW: 20, TREE: 20, RANK: 20 }, "the allocation tool's default: each counts a fifth");
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 400; i++) {
    const parts = {};
    for (const k of ["SPDR", "HUBCMP", "MKTBOW", "TREE", "RANK"]) {
      if (rnd() < 0.25) { parts[k] = null; continue; }
      const cap = rnd() * 2 - 1, eq = rnd() * 2 - 1;
      parts[k] = k === "HUBCMP" || k === "MKTBOW" ? { score: k === "HUBCMP" ? (cap + eq) / 2 : eq, cap, eq } : { score: rnd() * 2 - 1 };
    }
    const wts = i % 3 ? w.api.SC_BLEND_W : { SPDR: 40, HUBCMP: 10, MKTBOW: 0, TREE: 30, RANK: 20 };
    const mine = w.api.scBlendFrom(parts, wts), theirs = alloc.blendFrom(parts, wts);
    assert.equal(mine.score, theirs.score); assert.deepEqual(mine.used, theirs.used); assert.deepEqual(mine.missing, theirs.missing); assert.deepEqual(mine.weights, theirs.weights);
    const ms = w.api.scBlendSides(parts, wts), ts = alloc.bowSides(parts, wts);
    assert.equal(ms.cap, ts.cap); assert.equal(ms.eq, ts.eq); assert.equal(ms.gap, ts.bowtie);
  }
});

test("a missing reading is named and the others carry its share", () => {
  const w = world();
  const parts = { SPDR: { score: 0.9 }, HUBCMP: { score: 0.8, cap: 0.9, eq: 0.7 }, MKTBOW: { score: 0.3, cap: 0.5, eq: 0.3 }, TREE: null, RANK: null };
  const b = w.api.scBlendFrom(parts, w.api.SC_BLEND_W);
  assert.deepEqual(b.used, ["SPDR", "HUBCMP", "MKTBOW"]); assert.deepEqual(b.missing, ["TREE", "RANK"]);
  assert.equal(+b.score.toFixed(6), +((0.9 + 0.8 + 0.3) / 3).toFixed(6));
  assert.deepEqual(b.weights, { SPDR: 33.3, HUBCMP: 33.3, MKTBOW: 33.3 });
  assert.deepEqual(w.api.scBlendFrom({}, w.api.SC_BLEND_W), { score: null, used: [], missing: ["SPDR", "HUBCMP", "MKTBOW", "TREE", "RANK"], weights: {} });
});

test("the five readings of a sector: the fund, the fund with its twin, our names, the tree's close tier, the ranking row", () => {
  const w = world({ geiger: Object.assign({ A1: 0.2, A2: 0.4, A3: 0.9, E1: 0.5, ETF: 0.99, NOCAP: 0.99 }, G) });
  /* our names: non-funds with a market value, three or more to a sector; the equal-weight and the cap-weighted averages */
  const prof = { A1: { market_cap: 100, sector: "Technology" }, A2: { market_cap: 300, sector: "Technology" }, A3: { market_cap: 600, sector: "Technology" },
    E1: { market_cap: 50, sector: "Energy" }, ETF: { market_cap: 900, is_etf: true, sector: "Technology" }, NOCAP: { sector: "Technology" } };
  const secOf = (t) => ({ Technology: "TECH", Energy: "ENERGY" })[prof[t] && prof[t].sector] || null;
  const mkt = w.api.scBlendMkt(prof, w.window.SC_GAT, secOf);
  assert.deepEqual(Object.keys(mkt), ["TECH"], "energy has one name: fewer than three is no reading");
  assert.equal(mkt.TECH.n, 3); assert.equal(+mkt.TECH.ew.toFixed(6), 0.5); assert.equal(+mkt.TECH.cw.toFixed(6), +((0.2 * 100 + 0.4 * 300 + 0.9 * 600) / 1000).toFixed(6));
  /* the tree's close tier: common stocks and ADRs with a reading */
  const scout = { as_of: "2026-10-06", computed_utc: "2026-10-07T00:21:01Z", row_columns: ["ticker", "composite", "trend", "momentum", "rungs_used", "kind"],
    rows: [["T1", 0.1, 0, 0, "", "CS"], ["T2", 0.3, 0, 0, "", "ADR"], ["T3", 0.5, 0, 0, "", "CS"], ["T4", 0.9, 0, 0, "", "ETF"], ["T5", null, 0, 0, "", "CS"], ["U1", 0.7, 0, 0, "", "CS"]] };
  const tree = w.api.scBlendTreeRoll(scout, (t) => (t[0] === "T" ? "TECH" : "UTILITIES"));
  assert.deepEqual(tree.sectors, { TECH: { n: 3, score: (0.1 + 0.3 + 0.5) / 3 } }); assert.equal(tree.asof, "2026-10-06");
  /* a name's sector: our own membership first, then the industry table, then the State Street funds' holdings, then the profile */
  const map = w.api.scBlendIndex([{ ticker: "AAA", fmp_sector: "Energy" }, { ticker: "BBB", fmp_sector: "Unknown" }], { data: { XLK: { h: [["AAA", 1], ["CCC", 2]] }, QQQ: { h: [["ZZZ", 1]] } } });
  assert.deepEqual(map, { AAA: "ENERGY", CCC: "TECH" }, "the industry table before the holdings; only the eleven State Street funds");
  /* the parts, live */
  w.api.SC_BLEND.rankDays = w.api.scBlendRankDays([{ date: "2026-10-06", sector: "XLK", rank: 3, score: 0.282, method: "constituent mean … readings 2026-10-06", updated_at: new Date().toISOString() }]);
  const s = w.api.scBlendSectors().find((x) => x.cw === "XLK");
  assert.deepEqual(s, { key: "TECH", cw: "XLK", ew: "RSPT", short: "TECH", name: "TECH" });
  assert.equal(w.api.scBlendSectors().length, 11, "the eleven State Street sectors, from the BREADTH pairs");
  const P = w.api.scBlendParts(s, mkt, tree, null);
  assert.equal(P.SPDR.score, G.XLK); assert.equal(P.HUBCMP.score, (G.XLK + G.RSPT) / 2); assert.equal(P.HUBCMP.cap, G.XLK); assert.equal(P.HUBCMP.eq, G.RSPT);
  assert.equal(P.MKTBOW.score, mkt.TECH.ew); assert.equal(P.TREE.score, tree.sectors.TECH.score); assert.equal(P.RANK.score, 0.282);
});

test("the ranking row: live it must be fresh; on a replayed day it must say which day's readings it averaged", () => {
  const w = world();
  const now = Date.parse("2026-10-07T04:00:00Z");
  const R = w.api.scBlendRankDays([
    { date: "2026-10-06", sector: "XLK", rank: 3, score: 0.28, method: "constituent mean, newest daily Geiger per name: 0.5*trend+0.5*momentum, n=69 · readings 2026-10-06", updated_at: "2026-10-07T01:45:00Z" },
    { date: "2026-10-05", sector: "XLK", rank: 2, score: 0.31, method: "constituent mean, newest daily Geiger per name: 0.5*trend+0.5*momentum, n=69 · readings 2026-10-05", updated_at: "2026-10-06T01:45:00Z" },
    { date: "2026-10-02", sector: "XLK", rank: 5, score: 0.11, method: "constituent mean, composite_staged D: 0.5*trend+0.5*momentum, n=70", updated_at: "2026-10-02T21:15:00Z" },
  ]);
  assert.equal(w.api.scBlendRank(R, "XLK", null, now).score, 0.28, "live: the newest day's row");
  assert.equal(w.api.scBlendRank(R, "XLK", null, now + 4 * 864e5), null, "…not used when it was written more than three days ago (the allocation tool's rule)");
  assert.equal(w.api.scBlendRank(R, "XLE", null, now), null);
  assert.equal(w.api.scBlendRank(R, "XLK", "2026-10-05", now).score, 0.31, "a replayed day: that day's row");
  assert.equal(w.api.scBlendRank(R, "XLK", "2026-10-02", now), null, "the 2 Oct row was built from a staged table carrying 24 Aug readings (H12): never drawn as 2 Oct's reading");
  assert.equal(w.api.scBlendRank(R, "XLK", "2026-10-03", now), null);
  assert.equal(w.api.scBlendRank(R, "XLK", "2026-09-01", now), null, "before the table's first day");
});

test("the first card: one bar per sector, hot to cold; live it says 5/5 once; replayed it says what was not read", () => {
  const live = world({ geiger: Object.assign({}, G) });   // its own copy: one reading is taken away below
  const B = live.api.SC_BLEND; B.at = 1; B.prof = {}; B.scout = null;
  B.rankDays = live.api.scBlendRankDays(FUNDS.SPDR.split(" ").map((t, i) => ({ date: "2026-10-06", sector: t, rank: i + 1, score: 0.5 - 0.1 * i, method: "… readings 2026-10-06", updated_at: new Date().toISOString() })));
  let rows = live.api.scBlendRows();
  assert.equal(rows.length, 11);
  assert.deepEqual(rows.map((r) => r.mean), rows.map((r) => r.mean).slice().sort((a, b) => b - a), "hot to cold");
  assert.ok(rows.every((r) => r.blend.used.join() === "SPDR,HUBCMP,RANK" && r.blend.missing.join() === "MKTBOW,TREE"));
  const xlb = rows.find((r) => r.key === "XLB");
  assert.equal(+xlb.mean.toFixed(6), +((G.XLB + (G.XLB + G.RSPM) / 2 + 0.5) / 3).toFixed(6), "three readings present: each counts a third");
  const f2 = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2), twin = (G.XLB + G.RSPM) / 2, avgStock = (G.RSPM + 0.5) / 2;   // index side: the fund twice (0.90); average-stock side: its twin and the ranking row
  assert.equal(xlb.full, "MATERIALS · blended " + f2(xlb.mean) + " from 3 of 5 readings, each counting the same · State Street fund +0.90 (XLB) · fund and its equal-weight twin " + f2(twin) +
    " (XLB + RSPM) · sector ranking +0.50 (#1 on 2026-10-06) · not read: our names in the sector (fewer than three of our names here), the tree's close tier (not read) — the others carry the share" +
    " · index names +0.90, average stock " + f2(avgStock) + ": breadth " + f2(avgStock - 0.9));
  const card = cardsOf(live.api.cmpxCardsHTML())[0];
  assert.equal(card.id, "BLEND");
  assert.match(card.html, /<span class="sc-cmpx__sub">±0\.\d\d · <span class="sc-cmpx__of is-miss">3\/5 read<\/span><\/span>/, "said once beside the name when every sector has the same count");
  assert.doesNotMatch(card.html, /sc-cohstrip__n--of/, "…so the bars keep the height, and the zero line, of the cards beside them");
  assert.equal((card.html.match(/class="sc-cohstrip__col/g) || []).length, 11);
  /* sectors that differ carry their own count under the bar */
  live.geiger.RSPM = null;
  assert.match(cardsOf(live.api.cmpxCardsHTML())[0].html, /sc-cohstrip__n--of is-miss"[^>]*>2\/5<\/span>/);
  /* before the sources have been read once, the card says so instead of drawing a part of the answer */
  const cold = world({ geiger: G });
  assert.match(cardsOf(cold.api.cmpxCardsHTML())[0].html, /<div class="sc-cmpx__none">reading the five sources …<\/div>/);
  /* a replayed day: the tree's close tier has no stored past */
  const old = world({ geiger: G, asof: "2026-09-03" }); old.api.SC_BLEND.at = 1;
  old.api.SC_BLEND.scout = { rows: [], row_columns: [] }; old.api.SC_BLEND.tree = { sectors: { TECH: { n: 99, score: 0.5 } } }; old.api.SC_BLEND.treeFor = null;
  rows = old.api.scBlendRows();
  assert.ok(rows.every((r) => !r.blend.used.includes("TREE") && r.blend.missing.includes("TREE")), "never today's tree on a past day");
  assert.match(rows[0].full, / on 2026-09-03 · blended .* not read: .*the tree's close tier \(no stored past\), sector ranking \(no row that reads this day\)/);
});

test("the consolidated card's sources are read when the tab is drawn, once, then only when 15 minutes old — no timer", async () => {
  assert.match(fn("mountL0Body"), /if \(LAYER0_TAB === "COHORT"\) \{ cmpxRestoreScroll\(\); cmpxBarSync\(\); scBlendLoad\(\); return; \}/);
  assert.match(fn("cohComparePaint"), /cmpxBarSync\(\);\n  scBlendLoad\(\);/);
  const load = fn("scBlendLoad");
  assert.match(load, /if \(SC_BLEND\.flight\) return SC_BLEND\.flight;\n  if \(SC_BLEND\.at && Date\.now\(\) - SC_BLEND\.at < SC_BLEND_TTL_MS\) return null;/);
  assert.match(BLOCK, /const SC_BLEND_TTL_MS = 15 \* 60e3/);
  assert.doesNotMatch(load, /setInterval|setTimeout/);
  for (const src of ['"/v1/scout-geiger"', '"sector_rankings?select=date,sector,rank,score,method,updated_at&order=date.desc,rank.asc&limit=1000"',
    '"company_profile?select=ticker,sector,market_cap,is_etf&limit=1000"', '"ticker_industry?select=ticker,fmp_sector&order=ticker.asc&limit=1000"',
    '"/deliverables/20260928/coverage-tree/data/holdings.json"']) assert.ok(load.includes(src), src + " — the allocation tool's own sources");
  assert.doesNotMatch(load, /method: "(POST|PATCH|DELETE)"/i, "reads only");
});

/* ── replay ──────────────────────────────────────────────────────────────────────────────────────────────────── */
test("REPLAY is a second handle on the REWIND bar: each control presses the bar's own control, and shows what it shows", () => {
  const w = world({ geiger: G }); w.api.SC_BLEND.at = 1;
  const bar = w.api.cmpxBarHTML();
  for (const id of ["cmpxPlay", "cmpxSpeed", "cmpxBack", "cmpxSc", "cmpxLive", "cmpxDt"]) assert.ok(bar.includes('id="' + id + '"'), id);
  assert.match(bar, /<span class="gwx__rng sc-cmpx__rng"><span class="gwx__rngfill" id="cmpxFill"[^>]*><\/span><input type="range" class="gwx__h gwx__h--b" id="cmpxSc" min="0" max="6240" value="6240"/, "the bar's own track and thumb");
  assert.match(bar, /data-act="cmpxlive" id="cmpxLive" hidden/, "no LIVE chip until the day has been moved");
  assert.match(bar, /data-act="secfs"/, "and the page's own full-screen button");
  /* each press lands on the bar's own control */
  for (const [act, target] of [["cmpxplay", "gwxPlay"], ["cmpxspeed", "gwxSpeed"], ["cmpxback", "gwxBack"]])
    assert.match(page, new RegExp('case "' + act + '":\\s+e\\.preventDefault\\(\\); e\\.stopPropagation\\(\\); (if \\()?cmpxPress\\("' + target + '"\\)'), act + " presses #" + target);
  assert.match(page, /case "cmpxlive":  e\.preventDefault\(\); e\.stopPropagation\(\); if \(!cmpxPress\("gwxLive"\)\) cmpxPress\("gwxLiveFab"\); break;/);
  assert.equal(w.api.cmpxPress("gwxPlay"), true); assert.equal(w.els.gwxPlay.clicks, 1);
  assert.equal(w.api.cmpxPress("gwxNothing"), false);
  /* scrubbing writes the bar's own scrubber and fires its own input: its date stamp, its coalesced seek, its way back to live */
  let seen = null; w.els.gwxSc.oninput = function () { seen = this.value; };
  w.api.cmpxScrub(5800);
  assert.equal(w.els.gwxSc.value, 5800); assert.equal(seen, 5800); assert.deepEqual(w.els.gwxSc.events, ["input"]);
  w.els.gwxSc.disabled = true; w.api.cmpxScrub(100); assert.equal(w.els.gwxSc.value, 5800, "a bar that has no days yet is not moved");
  assert.match(BLOCK, /document\.addEventListener\("input", \(e\) => \{ if \(e\.target && e\.target\.id === "cmpxSc"\) cmpxScrub\(e\.target\.value\); \}\);/);
  /* the handle shows what the bar shows */
  w.els.gwxSc.disabled = false; w.els.gwxPlay.classList.add("is-on"); w.els.gwxSpeed.textContent = "4×"; w.els.gwxBack.textContent = "3M"; w.els.gwxDt.textContent = "2026-09-03";
  w.els.gwxSc.min = "400"; w.els.gwxFill.style = { left: "6%", width: "87%" };
  const st = w.api.cmpxBarState();
  assert.deepEqual([st.on, st.playing, st.speed, st.back, st.min, st.max, st.value, st.dt, st.fill], [true, true, "4×", "3M", 400, 6240, 5800, "2026-09-03", "left:6%;width:87%"]);
  for (const id of ["cmpxBar", "cmpxPlay", "cmpxSpeed", "cmpxBack", "cmpxSc", "cmpxDt", "cmpxLive", "cmpxFill"]) w.mk(id);
  w.api.cmpxBarSync();
  assert.equal(w.els.cmpxPlay.textContent, "❙❙ PAUSE"); assert.ok(w.els.cmpxPlay.classList.contains("is-on"));
  assert.equal(w.els.cmpxSpeed.textContent, "4×"); assert.equal(w.els.cmpxBack.textContent, "3M"); assert.equal(w.els.cmpxDt.textContent, "2026-09-03");
  assert.equal(w.els.cmpxSc.value, 5800); assert.equal(w.els.cmpxSc.min, 400); assert.equal(w.els.cmpxSc.max, 6240);
  assert.equal(w.els.cmpxFill.attrs.style, "left:6%;width:87%");
  /* no board on the screen (no bar): the handle is not drawn */
  const none = world({ bar: false });
  assert.match(none.api.cmpxBarHTML(), /^<div class="sc-cmpx__bar is-off" id="cmpxBar">/);
  assert.match(page, /\.sc-cmpx__bar\.is-off \.sc-cmpx__rep\{ visibility:hidden; \}/);
});

test("one clock: the rewind publishes its day and its reader, and repaints every card on each replayed day", () => {
  assert.match(page, /window\.SC_ASOF=function\(\)\{ return ASOF; \};\n\s+window\.SC_GAT=gAt;/);
  assert.match(page, /if\(typeof cohComparePaint==="function"\) cohComparePaint\(\);   \/\* the compare rewinds with the board \(HC1: every view of it\) \*\//);
  assert.doesNotMatch(BLOCK, /fan_daily|momentum_daily/, "no second read of the stored days: the cards ask the rewind's own reader");
  const w = world({ geiger: G, asof: "2026-09-03" });
  assert.equal(w.api.scRewindAsof(), "2026-09-03"); assert.equal(w.api.scGeigerNow("XLK"), G.XLK); assert.equal(w.api.scGeigerNow("NOPE"), null);
  w.mk("gwxLive");
  assert.match(w.api.cmpxBarHTML(), /data-act="cmpxlive" id="cmpxLive" title/, "rewound: the way back to live is shown");
  /* a fund with no stored reading on that day: its card says so rather than draw nothing */
  const thin = world({ geiger: { XLK: 0.5, XLE: 0.2 }, asof: "2026-01-06" }); thin.api.SC_BLEND.at = 1;
  const cards = cardsOf(thin.api.cmpxCardsHTML());
  assert.match(cards.find((c) => c.id === "VANGUARD").html, /<div class="sc-cmpx__none">no stored reading for 2026-01-06 — this history starts later<\/div>/);
  assert.match(cards.find((c) => c.id === "SPDR").html, /class="sc-cohstrip"/);
});

test("a replayed day shows what the stored days hold: a trend-only reading is named, and BREADTH is read like with like", () => {
  /* the rule, as the rewind module carries it: a reading with no stored momentum on the replayed day is the trend alone */
  const src = page.match(/function trendOnly\(t\)\{[\s\S]*?\n    \}/)[0];
  const rule = (ASOF, CACHE) => new Function("ASOF", "CACHE", src + "\nreturn trendOnly;")(ASOF, CACHE);
  const C = { "2026-09-08": { XLE: 1, RSPG: 1, IYE: 1, __mom: { XLE: 0.8781 } } };          // read from the stored days on 6 Oct: the State Street fund has both, the others the trend only
  const on = rule("2026-09-08", C);
  assert.equal(on("XLE"), false); assert.equal(on("RSPG"), true); assert.equal(on("IYE"), true);
  assert.equal(on("NOPE"), false, "no reading at all is not a trend-only reading");
  assert.equal(rule(null, C)("RSPG"), false, "live: never — both funds' Geiger, as always");
  /* BREADTH on such a day: both funds on trend, so the subtraction is of two like things; live is the same line as before */
  assert.match(page, /if\(ASOF && ew!=null && cw!=null && \(trendOnly\(p\[0\]\)\|\|trendOnly\(p\[1\]\)\)\)\{ ew=CACHE\[ASOF\]\[p\[0\]\]; cw=CACHE\[ASOF\]\[p\[1\]\]; tOnly=true; \}/);
  assert.match(page, /\(tOnly\?" \\u00b7 on this replayed day both funds are read on trend alone \(no stored momentum for one of them\), so the gap is like for like":""\)/);
  assert.match(page, /window\.SC_TREND_ONLY=trendOnly;/);
  /* the cards say it once, beside the name */
  const eq = FUNDS.EQWT.split(" "), sub = (w, id) => /<span class="sc-cmpx__sub">([\s\S]*?)<\/span><(?:button|\/header)/.exec(cardsOf(w.api.cmpxCardsHTML()).find((c) => c.id === id).html)[1];
  const old = world({ geiger: G, asof: "2026-09-08", trendOnly: eq }); old.api.SC_BLEND.at = 1;
  assert.match(sub(old, "EQWT"), /· <span class="sc-cmpx__of is-miss" title="on this replayed day 11 of these funds have no stored momentum: their bars are the trend alone">trend only<\/span>$/);
  assert.match(sub(old, "BOWTIE"), /title="on this replayed day 11 of these pairs are read on trend alone, both funds alike: one of them has no stored momentum">trend only<\/span>$/);
  assert.doesNotMatch(sub(old, "SPDR"), /trend only/, "the State Street funds have both stored: their replayed bars are the Geiger");
  const hover = old.api.scBlendRows()[0].full;
  assert.match(hover, /fund and its equal-weight twin [+−]0\.\d\d \(XL[A-Z]+ \+ RSP[A-Z], the twin on trend alone\)/);
  assert.doesNotMatch(hover, /breadth/, "the two sides are not set against each other when they are not alike");
  const live = world({ geiger: G, trendOnly: eq }); live.api.SC_BLEND.at = 1;
  for (const id of ["EQWT", "BOWTIE", "SPDR"]) assert.doesNotMatch(sub(live, id), /trend only/, id + ": live is never trend-only");
  assert.match(live.api.scBlendRows()[0].full, /: breadth [+−]0\.\d\d$/);
});

test("a repaint redraws the cards only, and the list keeps where it was scrolled to", () => {
  const w = world({ geiger: G }); w.api.SC_BLEND.at = Date.now();
  /* first paint: the whole screen */
  w.els.cohCompare = w.cohComp;
  w.api.cohComparePaint();
  assert.match(w.cohComp.innerHTML, /id="cmpxBar"[\s\S]*id="cmpxScroll"[\s\S]*PAGE SPECS/);
  /* later paints: a browser throws the scroll back to 0 when the content is replaced; the painter puts it back */
  const sc = w.mk("cmpxScroll", { _x: 780, _h: "old", get scrollTop() { return this._x; }, set scrollTop(v) { this._x = v; }, set innerHTML(v) { this._h = v; this._x = 0; }, get innerHTML() { return this._h; } });
  const shell = w.cohComp.innerHTML;
  w.api.cohComparePaint();
  assert.equal(sc.scrollTop, 780); assert.match(sc.innerHTML, /^<section class="sc-cmpx__card/);
  assert.equal(w.cohComp.innerHTML, shell, "the replay handle and PAGE SPECS are left standing");
  /* a REBUILD of the pane (a cohort click remounts it) starts a new list at 0: the place the reader scrolled to is remembered and put back */
  const again = world({ geiger: G }); again.api.SC_BLEND.at = Date.now();
  assert.equal(again.heard.scroll.length, 1, "the page listens for the list's own scroll");
  again.heard.scroll[0]({ target: { id: "somethingElse", scrollTop: 55 } });
  again.heard.scroll[0]({ target: { id: "cmpxScroll", scrollTop: 2040 } });          // the reader scrolls to the COHORTS card
  const fresh = again.mk("cmpxScroll", { scrollTop: 0 });                              // …clicks a cohort; the pane is rebuilt
  again.api.cmpxRestoreScroll();
  assert.equal(fresh.scrollTop, 2040);
  again.heard.scroll[0]({ target: { id: "cmpxScroll", scrollTop: 0 } });              // back at the first card by hand: nothing is forced
  fresh.scrollTop = 0; again.api.cmpxRestoreScroll(); assert.equal(fresh.scrollTop, 0);
  assert.match(fn("cohComparePaint"), /cc\.innerHTML = cohCompareScreenHTML\(\); cmpxRestoreScroll\(\);/, "a first paint into a new pane puts the list back too");
  /* every place that used to write the strip goes through the one painter */
  assert.doesNotMatch(page, /innerHTML\s*=\s*cohortCompareStripHTML\(\)/);
  assert.ok((page.match(/cohComparePaint\(\)/g) || []).length >= 9);
});

test("PAGE SPECS says each view in plain words, below the cards — never inside one", () => {
  const w = world();
  const t = w.api.CMPX_SPECS.replace(/<[^>]+>/g, " ");
  for (const s of ["SECTORS · BLENDED", "average of five readings, each counting a fifth", "BREADTH", "the view that was called BOW TIE; only the name changed",
    "Geiger points, not percent", "REPLAY", "the REWIND bar's own clock", "the tree's close tier has no stored past"]) assert.ok(t.includes(s), s);
  assert.match(w.api.CMPX_SPECS, /^<details class="sc-pagespecs sc-cmpx__specs"><summary>PAGE SPECS<\/summary>/);
});

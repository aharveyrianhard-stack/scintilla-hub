// HC2 (7 Oct 2026) — the stand-in page the compare cards are drawn on, for the tests and for the tool that froze HC1's
// output (deliverables/20261007/hc2-compare-stacked/tools/make-fixture.mjs). It is HC1's own test world
// (tests/hc1-compare-one-screen.test.mjs), taking the page's source as an argument so the SAME inputs can be drawn by the
// release HC2 branched from (b80c01e) and by the page as it stands. Nothing here reaches the network.
import assert from "node:assert/strict";
import crypto from "node:crypto";

const FUNDS = { SPDR: "XLB XLE XLF XLI XLK XLP XLRE XLU XLV XLY XLC", ISHARES: "IYM IYE IYF IYJ IYW IYK IYR IDU IYH IYC IYZ",
  VANGUARD: "VAW VDE VFH VIS VGT VDC VNQ VPU VHT VCR VOX", EQWT: "RSPM RSPG RSPF RSPN RSPT RSPS RSPR RSPU RSPH RSPD RSPC" };
const SECT = ["MATERIALS", "ENERGY", "FINANCIALS", "INDUSTRIAL", "TECH", "STAPLES", "REAL EST", "UTILITIES", "HEALTH", "DISCRET", "COMMS"];
/* the cohorts as the board has them today: twelve, the longest names six letters */
const COHORTS = ["INDEXES", "MEGACAP", "AI_SOFTWARE", "AI_HARDWARE", "CRYPTO", "AI_POWERTRAIN", "GROWTH", "BLUE_CHIP", "MACRO", "INTL", "METALS", "THEMATIC"];
const INDEX_FUNDS = ["ITOT", "QQQ", "SPY", "QQQE", "IWV", "VTI", "MDY", "RSP", "IJR", "DIA", "IWM"];

/* every fund with a reading, sectors from hot to cold */
export const GEIGER = {};
["SPDR", "ISHARES", "VANGUARD", "EQWT"].forEach((f, k) => FUNDS[f].split(" ").forEach((t, i) => { GEIGER[t] = +(0.9 - 0.17 * i - 0.02 * k).toFixed(3); }));
INDEX_FUNDS.forEach((t, i) => { GEIGER[t] = +(0.8 - 0.11 * i).toFixed(3); });

const fnOf = (page, name) => {
  const m = page.match(new RegExp("\\n(async )?function " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n"));
  assert.ok(m, name + " is a top-level function of the page");
  return m[0];
};

export function makeWorld(page, { geiger = GEIGER, asof = null, bar = true, stored = "", trendOnly = [], blendAt = 1 } = {}) {
  const BLOCK = page.slice(page.indexOf("/* ══ HC1 (6 Oct) — EVERY COMPARE VIEW ON ONE SCREEN"), page.indexOf("\nfunction boardPanelHTML() {"));
  assert.ok(BLOCK.length > 4000, "the compare block is on the page");
  const PAIRS = new Function(page.match(/var BOWTIE_PAIRS=\[[\s\S]*?\]\];/)[0] + "; return BOWTIE_PAIRS;")();
  const SPDR_TO_SECTOR = new Function("return " + page.match(/const SPDR_TO_SECTOR = (\{[\s\S]*?\});/)[1])();
  const COH_ABBR = new Function("return " + page.match(/const COH_ABBR = (\{[\s\S]*?\});/)[1])();
  const tOnly = new Set(trendOnly), els = {};
  const mk = (id, extra) => (els[id] = Object.assign({ id, textContent: "", hidden: false, disabled: false, clicks: 0, events: [], style: {}, attrs: {},
    classList: { set: new Set(), contains(c) { return this.set.has(c); }, toggle(c, on) { if (on) this.set.add(c); else this.set.delete(c); }, add(c) { this.set.add(c); } },
    click() { this.clicks++; }, dispatchEvent(e) { this.events.push(e.type); }, getAttribute(k) { return this.attrs[k] == null ? null : this.attrs[k]; }, setAttribute(k, v) { this.attrs[k] = v; }, blur() {} }, extra || {}));
  if (bar) {
    mk("gwxPlay", { textContent: "▶ PLAY" }); mk("gwxSpeed", { textContent: "1×" }); mk("gwxBack", { textContent: "1Y" });
    mk("gwxSc", { min: "0", max: "6240", value: asof ? "5840" : "6240" }); mk("gwxDt", { textContent: asof || "live" }); mk("gwxFill", { style: { left: "0%", width: asof ? "93.6%" : "100%" } });
  }
  const window = { SC_CMP_MODE: "COHORTS", SECT_FAMILY: "SPDR", SC_BOWTIE_PAIRS: PAIRS, SC_ASOF: () => asof, SC_GAT: (t) => (geiger[t] == null ? null : geiger[t]),
    SC_TREND_ONLY: (t) => !!asof && tOnly.has(t) };
  const heard = {}, saved = {};
  /* what each old tab's rows were: the family's eleven funds, the fourteen pairs, our twelve cohorts, the eleven index funds */
  const cohortCompareRows = () => {
    if (window.SC_CMP_MODE !== "SECTORS") return COHORTS.map((k, i) => ({ key: k, label: k, mean: +(0.48 - 0.085 * i).toFixed(3), n: 5 + i }));
    const f = window.SECT_FAMILY;
    if (f === "BOWTIE") return PAIRS.map((p) => { const e = window.SC_GAT(p[0]), c = window.SC_GAT(p[1]); return { key: p[0], label: p[2], short: p[3], pair: p[0] + " − " + p[1], full: p[2], mean: e == null || c == null ? null : e - c, n: 2, tOnly: !!asof && (tOnly.has(p[0]) || tOnly.has(p[1])) }; });
    if (f === "MEMBERS") return SECT.map((n, i) => ({ key: FUNDS.SPDR.split(" ")[i], label: n, short: n, names: 4 + i, mean: +(0.1 * i - 0.4).toFixed(2), n: 4 + i }));
    if (f === "INDEXES") return INDEX_FUNDS.map((t) => ({ key: t, label: t, short: t, mean: window.SC_GAT(t), n: 1 }));
    return FUNDS[f].split(" ").map((t, i) => ({ key: t, label: SECT[i], short: t, full: SECT[i] + " · " + t, mean: window.SC_GAT(t), n: 1, tOnly: !!asof && tOnly.has(t) }));
  };
  const names = ["CMPX_VIEWS", "CMPX_EXP", "SC_BLEND", "cmpxCardHTML", "cmpxCardsHTML", "cmpxCanExpand", "cmpxBarHTML", "cmpxRestoreScroll", "cohCompareScreenHTML", "cohComparePaint", "CMPX_SPECS",
    "CMPX_ROW_MAX", "cmpxPerRow", "CMPX_PER_LINE", "CMPX_W", "cmpxColWeight", "cmpxLineShare"];                    // the last six are HC2's: absent from the release, and returned as undefined there
  const api = new Function("window", "document", "lsGet", "lsSet", "el", "S", "GCOMP", "COHSETS", "SPDR_TO_SECTOR", "SECFS_BTN", "cohortCompareRows", "scinStripTM", "scStripIsFund",
    "scinGroupTickers", "hbRowFor", "hbGroupLabel", "COH_ABBR", "pg", "fetch", "SC_CHART_API", "requestAnimationFrame", "Event", "setTimeout",
    page.match(/const esc = \(s\) => String[\s\S]*?;\n/)[0] + page.match(/const L0_CMP_MIN_SPAN = [^\n]*\n/)[0] +
    fnOf(page, "vminiHTML") + fnOf(page, "cohortCompareSpan") + fnOf(page, "scinRead") + fnOf(page, "cohStripColsHTML") + BLOCK +
    "\nreturn { " + names.map((n) => n + ": typeof " + n + ' !== "undefined" ? ' + n + " : undefined").join(", ") + " };")(
    window, { addEventListener(type, f) { (heard[type] = heard[type] || []).push(f); }, activeElement: null }, (k) => (k === "hub.compare.expanded" ? stored : null), (k, v) => { saved[k] = v; },
    (id) => els[id] || null, { coh: "METALS" }, geiger, null, SPDR_TO_SECTOR, '<button class="sc-fsico" data-act="secfs">⛶</button>',
    /* a column's trend / momentum pair: one that differs by column, so every word of the read is drawn somewhere */
    cohortCompareRows, (key) => { const h = [...String(key)].reduce((t, c) => t + c.charCodeAt(0), 0); return { tr: +(((h % 21) - 10) / 10).toFixed(2), mo: +((((h * 7) % 21) - 10) / 10).toFixed(2), n: 1 + (h % 9) }; },
    () => true, () => [], () => null, () => "", COH_ABBR, async () => [], undefined, "", undefined, function Event(type) { this.type = type; }, () => 0);
  api.SC_BLEND.at = blendAt;
  return { api, window, els, mk, heard, saved };
}

/* the states a reader can put the cards in */
export const SCENARIOS = [
  { name: "live, every card folded", opts: {} },
  { name: "live, State Street, COHORTS and OUR NAMES unfolded", opts: { stored: "SPDR,COHORTS,MEMBERS" } },
  { name: "replayed to 8 Sep, three families on trend alone", opts: { asof: "2026-09-08", trendOnly: [...FUNDS.ISHARES.split(" "), ...FUNDS.VANGUARD.split(" "), ...FUNDS.EQWT.split(" ")] } },
  { name: "a day before any fund has a reading", opts: { asof: "2025-01-02", geiger: {} } },
  { name: "the five sources still being read", opts: { blendAt: 0 } },
];

export const cardsOf = (html) => [...html.matchAll(/<section class="sc-cmpx__card([^"]*)" data-cmpx="([A-Z]+)" style="([^"]*)">([\s\S]*?)<\/section>/g)].map((m) => ({ cls: m[1], id: m[2], style: m[3], html: m[4] }));

/* what HC2 changed in a card's markup, taken out — everything left is what the card SHOWS: its name, its scale, each
   bar's label, value, height and colour, every hover, the word and the pair, the ⤢:
     · the card's share of a full-screen line (--cmpx-f), new
     · is-wide, new: the mark on a card of more than eleven columns
     · --coh-half: HC1 wrote the column count (one row everywhere, and the row scrolled); HC2 writes how many to a row */
export function shown(html) {
  return cardsOf(html).map((c) => ({ id: c.id, unfolded: /\bis-exp\b/.test(c.cls), style: c.style.replace(/--cmpx-f:[\d.]+;/, ""),
    html: c.html.replace(/(style="--coh-n:\d+;)--coh-half:\d+"/, '$1"') }));
}

/* a card, small enough to keep: the words a reader sees, the first hover in full, and a fingerprint of every hover and
   of the whole markup — a difference says which card and which of the three */
const sha = (t) => crypto.createHash("sha256").update(t).digest("hex").slice(0, 16);
const unesc = (t) => t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
export function digest(card) {
  const hovers = [...card.html.matchAll(/ title="([^"]*)"/g)].map((m) => unesc(m[1]));
  return { id: card.id, unfolded: card.unfolded, style: card.style, text: unesc(card.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()),
    firstHover: hovers[0] || null, hovers: hovers.length + " · " + sha(hovers.join("\n")), markup: sha(card.html) };
}

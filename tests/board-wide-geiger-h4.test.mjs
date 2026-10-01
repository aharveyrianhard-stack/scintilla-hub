/* H4 (1 Oct) — the board: one wide Geiger, the breakdown on click, TREND and MOMENTUM as sortable columns in full screen,
   and the header ticker's day change in direction colour with a minus sign. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fn = (name) => { const s = page.search(new RegExp("^(async )?function " + name + "\\b", "m")); assert.ok(s >= 0, name); return page.slice(s, page.indexOf("\n}\n", s) + 3); };
const css = page.slice(page.indexOf('<style id="board-h4-20261001">'), page.indexOf('<style id="tape-events-20260927">'));
const tracks = (sel) => { const m = css.match(new RegExp(sel + "\\{ grid-template-columns:([^!]+)!important")); assert.ok(m, sel); return m[1].match(/minmax/g).length; };
const fr = (sel, i) => +css.match(new RegExp(sel + "\\{ grid-template-columns:([^!]+)!important"))[1].match(/minmax\(0,(\d+)fr\)/g)[i].match(/(\d+)fr/)[1];
const num = (x) => (x == null ? null : Number(x));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

test("beside the left panel: TREND, MOM and READ are not drawn and the Geiger takes their width", () => {
  const sel = "body:not\\(\\.secfs\\):not\\(\\.gwx-motion\\) \\.ch";
  assert.equal(tracks(sel), 11, "11 tracks for 11 drawn cells");
  assert.match(css, /body:not\(\.secfs\):not\(\.gwx-motion\) \.ch > :nth-child\(9\), body:not\(\.secfs\):not\(\.gwx-motion\) \.ch > :nth-child\(10\),\s+body:not\(\.secfs\):not\(\.gwx-motion\) \.ch > :nth-child\(11\)\{ display:none !important; \}/);
  /* the old board: TREND 9 + MOM 9 + READ 15 + GEIGER 13 = 46 — all of it is the Geiger's now.
     H5 (1 Oct) — the RVOL battery and its number take 11 fr of that back (RVOL 5 → 16, Geiger 46 → 35): the pair still sums
     to what H4 gave them, so every other column is untouched. */
  assert.equal(fr(sel, 8), 35);
  assert.equal(fr(sel, 8) + fr(sel, 9), 46 + 5);
  assert.match(css, /@media \(min-width:561px\)\{\s+body:not\(\.secfs\)/, "the phone keeps its own seven cells");
  assert.ok(page.indexOf('<style id="r4-fit">') > page.indexOf('<style id="board-h4-20261001">'), "r4-fit stays last");
});

test("full screen: 14 columns (TREND and MOMENTUM as bars, READ in words, the Geiger number); a phone keeps six", () => {
  assert.equal(tracks("body\\.secfs \\.sc-secfs \\.ch"), 14);
  const phone = css.slice(css.indexOf("@media (max-width:560px){\n  body.secfs"));
  assert.match(phone, /grid-template-columns:minmax\(0,3fr\) minmax\(0,8fr\) minmax\(0,10fr\) minmax\(0,12fr\) minmax\(0,12fr\) minmax\(0,12fr\) !important/);
  assert.match(phone, /\.ch > :nth-child\(9\), body\.secfs \.sc-secfs \.ch > :nth-child\(10\)\{ display:flex !important; \}/);
  assert.match(css, /body\.secfs \.sc-secfs \.sc-board__row \.sc-gnum\{ display:block;/);
  assert.match(css, /\.gwx-tmb i\{[^}]*\}/);
  assert.doesNotMatch(css.match(/\.gwx-tmb i\{[^}]*\}/)[0], /box-shadow/, "a plain fill: the glow is the Geiger's alone");
});

test("TREND and MOMENTUM carry sort keys and re-rank by what the board shows (a rewound day included); absent sorts lowest", () => {
  const cols = new Function("return " + page.match(/const BOARD_COLS = (\[[^\n]*\]);/)[1])();
  assert.deepEqual(cols.slice(8, 11), [["Trend", "tr"], ["Momentum", "mo"], ["Read", null]]);
  const rows = [{ t: "A" }, { t: "B" }, { t: "C" }, { t: "D" }];
  const order = (key, dir, win) => new Function("S", "window", "num", fn("boardSortValue") + fn("computeBoardOrder") + "\nreturn computeBoardOrder();")(
    { sort: { key, dir }, rows }, Object.assign({ SC_RANK_READY: true }, win), num);
  const live = { A: { tr: 0.2, mo: -0.5 }, B: { tr: 0.9, mo: 0.1 }, C: { tr: -0.4, mo: 0.8 } };
  assert.deepEqual(order("tr", -1, { SCIN_TM: live }), ["B", "A", "C", "D"]);
  assert.deepEqual(order("mo", -1, { SCIN_TM: live }), ["C", "B", "A", "D"]);
  assert.deepEqual(order("mo", 1, { SCIN_TM: live }), ["D", "A", "B", "C"], "ascending: the name with no reading first");
  const shown = { A: { tr: 1, mo: 0 }, B: { tr: 0, mo: 0 }, C: { tr: 0.5, mo: 0 }, D: null };
  assert.deepEqual(order("tr", -1, { SCIN_TM: live, SCIN_TM_SHOWN: shown }), ["A", "C", "B", "D"], "the numbers on screen win");
  assert.match(fn("computeBoardOrder"), /if \(key !== "t" && !window\.SC_RANK_READY\)/, "still no ranking before an authoritative snapshot");
});

test("the Geiger cell is a keyboard-reachable button for its breakdown, and the row still opens the company", () => {
  const src = fn("boardRowsHTML");
  assert.match(src, /'<span class="sc-gcell" role="button" tabindex="0" data-act="gpop" data-t="' \+ esc\(d\.t\) \+ '" aria-haspopup="dialog" aria-expanded="false"'/);
  assert.match(src, /data-act="row"/);
  assert.match(page, /case "gpop": \{[^}]*e\.preventDefault\(\); e\.stopPropagation\(\); gpopOpen\(a\); break;/);
  /* Enter / Space on any [data-act][role=button] synthesises the click: the one shared keyboard path */
  assert.match(page, /e\.target\.closest\('\[data-act\]\[role="button"\]'\)/);
});

test("the breakdown: composite bar kept special, trend and momentum as plain bars, the read in one line, ◆ on a split", () => {
  const scinRead = new Function(fn("scinRead") + "; return scinRead;")();
  const READ_LINE = new Function(page.match(/const READ_LINE = \{[\s\S]*?\};/)[0] + "; return READ_LINE;")();
  for (const w of ["aligned bull", "aligned bear", "pullback", "turning up", "mom leads", "stalling", "constructive", "broken", "mixed", "trend only"])
    assert.ok(READ_LINE[w] && READ_LINE[w].length > 10, w);
  const geigerMiniHTML = new Function(fn("geigerMiniHTML") + "; return geigerMiniHTML;")();
  const make = (win, S) => new Function("S", "ALLROWS", "window", "num", "esc", "scinRead", "READ_LINE", "geigerMiniHTML",
    fn("gpopRowFor") + fn("gpopBarHTML") + fn("gpopNum") + fn("gpopCol") + fn("gpopHTML") + "; return gpopHTML;")(S, [], win, num, esc, scinRead, READ_LINE, geigerMiniHTML);
  const html = make({ SCIN_TM_SHOWN: { XLE: { tr: 0.67, mo: -0.40 } }, SCIN_FAMW: { trend: 0.5, mom: 0.5 } }, { rows: [{ t: "XLE", g: 0.14 }] })("XLE");
  assert.match(html, /<b>XLE<\/b><span>GEIGER<\/span><em style="color:var\(--bull\)">\+0\.14<\/em>/);
  assert.match(html, /class="gp-comp"><span class="sc-gmini sc-clip">[\s\S]*box-shadow:0 0 5px var\(--bull\)/, "the composite keeps its glow");
  assert.match(html, /TREND<\/span><span class="gwx-tmb"><i style="left:50%;width:33\.5%;background:var\(--bull\)"><\/i><\/span><b style="color:var\(--bull\)">\+0\.67<\/b>/);
  assert.match(html, /MOMENTUM<\/span><span class="gwx-tmb"><i style="right:50%;width:20\.0%;background:var\(--bear\)"><\/i><\/span><b style="color:var\(--bear\)">−0\.40<\/b>/);
  assert.match(html, /<b style="color:var\(--warn,#e0a24a\)">pullback<\/b><span class="gp-div"[^>]*>◆<\/span> — the uptrend holds; the fast frames have rolled over/);
  assert.match(html, /trend half · momentum half/);
  const none = make({}, { rows: [{ t: "ZZ", g: null }] })("ZZ");
  assert.match(none, /no trend or momentum reading yet/);
  assert.match(none, /<em style="color:var\(--mute\)">—<\/em>/);
});

test("one overlay, fixed to the window (never moves a row); Esc, ✕, a click away or a scroll closes it; Esc is its own", () => {
  assert.match(css, /\.sc-gpop\{ position:fixed;/);
  const open = fn("gpopOpen");
  assert.match(open, /let p = document\.getElementById\("gPop"\);/, "one element, reused");
  assert.match(open, /if \(GPOP_T === t && GPOP_ANCHOR === anchor\) \{ gpopClose\(false\); return; \}/, "the same bar again closes it");
  assert.match(open, /const below = r\.bottom \+ 6 \+ h <= vh - 8;/);
  assert.match(open, /p\.style\.left = \(left \/ z\)\.toFixed\(1\) \+ "px"/, "placed in the zoomed body's own units (1.28 at 1680)");
  assert.match(page, /if \(e\.key !== "Escape" \|\| !GPOP_T\) return;\s+e\.preventDefault\(\); e\.stopImmediatePropagation\(\); gpopClose\(true\);/);
  assert.match(fn("cvKeysBlocked"), /if \(typeof GPOP_T !== "undefined" && GPOP_T\) return true;/, "the company view's Esc waits for it");
  assert.match(page, /document\.addEventListener\("scroll", \(e\) => \{ if \(GPOP_T/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{ \.sc-gpop\.is-in\{ animation:none; \} \}/);
});

test("the header ticker: +0.55% green on an up day, −0.55% red (a minus sign) on a down day, the class carrying the colour", () => {
  const fmtC = (c) => (c >= 0 ? "+" + c.toFixed(2) + "%" : "(" + Math.abs(c).toFixed(2) + "%)");
  const kit = new Function("fmtC", "scScintSet", "scSetText", fn("fmtChgHead") + fn("identDirClass") + fn("identChgSet") + "; return { fmtChgHead, identChgSet };")(
    fmtC, (n, v) => { n.textContent = v; }, (n, v) => { n.textContent = v; });
  assert.equal(kit.fmtChgHead(-0.55), "−0.55%");
  assert.equal(kit.fmtChgHead(0.55), "+0.55%");
  const node = (inHead) => { const cls = new Set(); return { textContent: "", style: {}, closest: (q) => (inHead && q === "#headIdent" ? {} : null),
    classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), contains: (c) => cls.has(c) } }; };
  const h = node(true);
  h.classList.toggle("is-up", true);            // what an earlier up tick left behind
  kit.identChgSet(h, -0.55);
  assert.equal(h.textContent, "−0.55%"); assert.equal(h.style.color, "var(--bear)");
  assert.ok(h.classList.contains("is-dn") && !h.classList.contains("is-up"), "a down day can never stay green");
  kit.identChgSet(h, 1.2);
  assert.equal(h.textContent, "+1.20%"); assert.ok(h.classList.contains("is-up"));
  const off = node(false); kit.identChgSet(off, -0.55);
  assert.equal(off.textContent, "(0.55%)", "outside the header the board's own format is kept");
  assert.match(css, /\.sc-head__ident \.sc-cchg\.is-dn\{ color:var\(--bear\) !important; \}/);
  /* both live paths go through it: the moved-price tick and the unchanged-price tick (which used to leave the colour) */
  assert.match(page, /if \(ch\) identChgSet\(ch, cc, /);
  assert.match(page, /identChgSet\(sameCompany, sameChange\); identDirClass\(el\("coPx"\), sameChange\);/);
  const ident = fn("leftIdentHTML");
  assert.match(ident, /\(chg != null \? \(head \? fmtChgHead\(chg\) : fmtC\(chg\)\) : ""\)/);
});

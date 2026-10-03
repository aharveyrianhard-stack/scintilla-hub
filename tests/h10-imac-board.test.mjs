// H10 (3 Oct) — the iMac board. Alan: "I'm scrolling on the cohort board and something moves … why would that re-sort
// steal my mouse and scrolling? … I'd prefer to see the actual movement happen than a glitch." A refresh patches the
// board in place and slides rows; the order waits while the reader scrolls; long boards are windowed; the replay uses
// the same slide. Offline: functions are sliced out of the page by name and run with stubs; nothing leaves the process.
// The headless proof (6x CPU, 2240 x 1260) is deliverables/20261003/h10-imac-board/tools/perf.mjs and verify.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(process.env.SC_PAGE || new URL("../index.html", import.meta.url), "utf8");
function fn(name) {
  const start = page.search(new RegExp("^(async )?function " + name + "\\b", "m"));
  assert.ok(start >= 0, name + " present");
  const end = page.indexOf("\n}\n", start);
  return page.slice(start, end + 3);
}

test("a refresh patches the board in place; only a different set of rows rebuilds it", () => {
  const ub = fn("updateBoard");
  assert.match(ub, /if \(!boardPatch\(bs\)\) boardRender\(bs\);/);
  assert.equal(/bs\.innerHTML\s*=\s*boardRowsHTML\(\)/.test(ub), false, "no wholesale rebuild on a refresh");
  const bp = fn("boardPatch");
  assert.match(bp, /kids\.length !== m\.rows\.length \+ 1\) return false/, "a different number of rows rebuilds");
  assert.match(bp, /if \(!els\.has\(x\.t\)\) return false/, "a different set of tickers rebuilds");
  assert.match(bp, /boardPatchRow\(els\.get\(x\.t\), x\.html\)/, "the same set: row by row");
});

test("boardRowsHTML(true) gives the same rows as parts — joined, they are exactly boardRowsHTML()", () => {
  const src = fn("boardRowsHTML");
  assert.match(src, /return parts \? \{ head, rows: sorted\.map\(\(d, i\) => \(\{ t: d\.t, html: list\[i\] \}\)\) \} : head \+ list\.join\(""\);/);
  assert.match(src, /return parts \? \{ html: h \} : h;/, "a state with no rows comes back whole");
});

test("a row is patched cell by cell; TREND / MOM / READ, the rank badge and the replay % stay with their owners", () => {
  const own = page.match(/const boardOwnCell = [^\n]*/)[0];
  for (const k of ["gwx-tm", "gwx-read", "gwx-rk", "gwx-pct"]) assert.ok(own.includes('"' + k + '"'), k);
  const pr = fn("boardPatchRow");
  assert.match(pr, /if \(row\.__h === html\) return row;/, "an unchanged row costs one string compare");
  assert.match(pr, /if \(h\.__h === w\) continue;/, "an unchanged cell is not touched");
  assert.match(pr, /h\.replaceWith\(want\[i\]\)/, "a changed cell is replaced, not the row");
});

test("the fewest moves: the longest run already in order stays put", () => {
  const boardLis = new Function(fn("boardLis") + "\nreturn boardLis;")();
  const keep = (a) => [...boardLis(a)].sort((x, y) => x - y);
  assert.deepEqual(keep([0, 1, 2, 3]), [0, 1, 2, 3], "nothing moved: nothing moves");
  assert.deepEqual(keep([3, 0, 1, 2]).length, 3, "one name jumped to the top: one move");
  assert.deepEqual(keep([0, 1, 2, 3].map((x, i, a) => a[a.length - 1 - i])).length, 1, "a full reversal keeps one");
  const big = Array.from({ length: 546 }, (_, i) => i); big.splice(2, 0, big.splice(400, 1)[0]);
  assert.equal(boardLis(big).size, 545, "BTCUSD from 400 to 3: one row moves of 546");
});

test("the new order waits while the board is scrolled or the pointer moves on it, and lands 1.5 s after", () => {
  assert.match(page, /const BOARD_HOLD_MS = 1500, BOARD_SLIDE_MS = 650;/);
  const w = fn("boardWire");
  for (const ev of ["wheel", "touchstart", "pointerdown", "keydown", "scroll", "pointermove", "pointerleave"]) assert.ok(w.includes('"' + ev + '"'), ev);
  assert.match(w, /Date\.now\(\) - BOARD_UI\.selfAt > 80/, "the board's own anchor scroll is not the reader scrolling");
  const st = fn("boardSettle");
  assert.match(st, /if \(!force && quiet < BOARD_HOLD_MS\)/);
  assert.match(st, /setTimeout\(\(\) => boardSettle\(false\), BOARD_HOLD_MS - quiet \+ 30\)/, "and it comes back to land it");
  assert.match(st, /if \(scRewoundNow\(\)\)/, "while rewound the replay owns the order");
});

test("when the order lands, the row under the pointer stays under it; otherwise the scroll position stays", () => {
  const st = fn("boardSettle");
  assert.match(st, /document\.elementFromPoint\(BOARD_UI\.x, BOARD_UI\.y\)/);
  assert.match(st, /scBoardSlide\(bs, want, \{ anchor \}\)/);
  const sl = fn("scBoardSlide");
  assert.match(sl, /bs\.scrollTop = st0 \+ \(nTop - oldTop\.get\(anchor\)\) \/ z;/, "the scroll follows the anchor row (layout px)");
  assert.match(sl, /else if \(bs\.scrollTop !== st0\) bs\.scrollTop = st0;/);
  assert.match(page, /#boardScroll\{ overflow-anchor:none; \}/, "the browser's own anchoring does not fight it");
});

test("rows slide (FLIP); a row from far away enters from the edge; a row leaving slides out as a ghost with no ids", () => {
  const sl = fn("scBoardSlide");
  assert.match(sl, /r\.style\.transform = "translateY\(" \+ dy\.toFixed\(1\) \+ "px\)"/, "invert");
  assert.match(sl, /void bs\.offsetHeight;/, "one flush");
  assert.match(sl, /r\.style\.transition = "transform " \+ ms \+ "ms " \+ ease;/, "play");
  assert.match(sl, /if \(!oIn\) from = o < n \? box\.top - Hz : box\.bottom;/, "an arrival starts just past the edge");
  assert.match(sl, /g\.classList\.remove\("sc-board__row", "is-far", "sel"\); g\.classList\.add\("sc-board__ghost"\);/);
  assert.match(sl, /x\.removeAttribute\("id"\); x\.removeAttribute\("data-act"\); x\.removeAttribute\("data-t"\);/, "a ghost is never found as a row");
  assert.match(sl, /\/ z\]\);|\(from - n\) \/ z\]/, "transforms are in layout px under the page zoom");
});

test("off-screen rows cost nothing: content-visibility, and long boards are windowed with exact margins", () => {
  assert.match(page, /#boardScroll > \.sc-board__row\{ content-visibility:auto; contain-intrinsic-size:auto var\(--sc-rowh, 37px\); \}/);
  assert.match(page, /#boardScroll\.is-win > \.sc-board__row\.is-far\{ display:none; \}/);
  assert.match(page, /#boardScroll\.is-win > \.sc-board__row\{ height:var\(--sc-rowh\); box-sizing:border-box; \}/);
  assert.match(page, /const BOARD_WIN_MIN = 80;/, "RADAR, FAVORITES and LIKED stay as they were");
  const w = fn("boardWindow");
  assert.match(w, /const mt = i === wf \? wf \* H \+ "px" : "", mb = i === wl \? \(n - 1 - wl\) \* H \+ "px" : "";/, "the margins stand for exactly the hidden rows");
  assert.match(fn("boardMeasure"), /getBoundingClientRect\(\)\.height \/ z/, "the row height is read in layout px (body zoom 1.12-1.45)");
});

test("the windowing arithmetic: one screen of rows either side of the view, margins summing to the full board", () => {
  const rows = Array.from({ length: 546 }, () => ({ classList: new Set(), style: { marginTop: "", marginBottom: "" } }));
  for (const r of rows) { const s = r.classList; r.classList = { contains: (k) => s.has(k), toggle: (k, on) => (on ? s.add(k) : s.delete(k)), add: (k) => s.add(k), remove: (k) => s.delete(k) }; }
  const cls = new Set();
  const bs = { scrollTop: 2600, clientHeight: 527, clientWidth: 600, __rowH: 25.776, __start: 23.4, __w: 600, __body: "",
    classList: { contains: (k) => cls.has(k), add: (k) => cls.add(k), remove: (k) => cls.delete(k) } };
  const boardWindow = new Function("boardRowList", "boardMeasure", "BOARD_WIN_MIN", "boardHMode", "document",
    fn("boardWindow") + "\nreturn boardWindow;")(() => rows, () => {}, 80, () => "", {});
  boardWindow(bs, true);
  const shown = rows.map((r, i) => r.classList.contains("is-far") ? null : i).filter((i) => i != null);
  assert.equal(shown[shown.length - 1] - shown[0] + 1, shown.length, "the rows in layout are one contiguous run");
  const H = bs.__rowH, top = bs.scrollTop - bs.__start;
  assert.ok(shown[0] * H <= top - bs.clientHeight + H && (shown[shown.length - 1] + 1) * H >= top + 2 * bs.clientHeight - H, "a screen either side");
  const mt = parseFloat(rows[shown[0]].style.marginTop), mb = parseFloat(rows[shown[shown.length - 1]].style.marginBottom);
  assert.ok(Math.abs(mt + mb + shown.length * H - 546 * H) < 0.01, "hidden rows are stood in for exactly");
  assert.ok(shown.length < 80, "about three screens of rows in layout, not 546");
});

test("the replay moves its rows through the same slide, and reads the board's measured row height", () => {
  const i = page.indexOf("      function orderPass(){");
  const src = page.slice(i, page.indexOf("        var cg=E(\"cohGeiger\")", i));
  assert.match(src, /moved=Math\.max\(0, window\.scBoardSlide\(bs, S\.boardOrder\|\|\[\], \{ ms: MD \? MD\.r : 420 \}\)\);/);
  assert.match(page, /if\(typeof window\.scBoardSlide==="function" && bs\.__rowH\)\{ PITCH=bs\.__rowH; PITCH_OK=true; \}/);
});

test("per-tick work no longer touches every row: indexed lookups, cached formatters, marked cells left alone", () => {
  assert.match(fn("patch"), /typeof scRowNode === "function" \? scRowNode\(t\)/);
  assert.match(fn("scProviderTick"), /typeof scRowNode === "function" \? scRowNode\(t\)/);
  const scRowOf = new Function(fn("scRowOf") + "\nreturn scRowOf;")();
  const a = [{ t: "A" }, { t: "B" }, { t: "C" }];
  assert.equal(scRowOf(a, "B"), a[1]); assert.equal(scRowOf(a, "Z"), undefined);
  a[1] = { t: "B", fresh: true }; assert.equal(scRowOf(a, "B").fresh, true, "a replaced row object is the one returned");
  a.reverse(); assert.equal(scRowOf(a, "A"), a[2], "a reordered array is re-indexed, never answered stale");
  a.push({ t: "D" }); assert.equal(scRowOf(a, "D"), a[3], "a newcomer is found");
  assert.match(page, /querySelectorAll\("\.sc-rsi\[id\^='lr_'\]:not\(\[data-hu\]\)"\)/, "markCells skips marked cells");
  const pr = fn("paintRsiCell");
  assert.match(pr, /if \(cell\.textContent !== txt\) cell\.textContent = txt;/, "an unchanged RSI is not rewritten");
  const scNum = new Function("SC_NFMT", fn("scNum") + "\nreturn scNum;")(new Map());
  for (const v of [0.4, 12.345, 999.95, 1437.2]) assert.equal(scNum(v, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  assert.equal(scNum(84803.814, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), "84,803.81");
});

test("the RSI breath runs without re-laying-out the board (a filter, not a text-shadow)", () => {
  assert.match(page, /\.sc-rsi\.is-xt\{ animation:rsi-xt 4s ease-in-out infinite; \}/);
  const kf = page.match(/@keyframes rsi-xt\{[^\n]*/)[0];
  assert.equal(/text-shadow/.test(kf), false);
  assert.match(kf, /filter:drop-shadow\(0 0 3px currentColor\)/);
});

test("item 3 — the company tabs wrap instead of running past the right edge; STATS rows wrap instead of '…'", () => {
  const rule = page.match(/^\.cv-tabs\{[^\n]*/m)[0];
  assert.match(rule, /flex-wrap:wrap/);
  assert.match(rule, /overflow:visible/);
  assert.equal(/overflow-x:auto/.test(rule), false, "no hidden sideways scroller hiding READ");
  assert.match(page, /\.cv-side \.st1 \.st-blk > div > span\{flex:1 1 auto;min-width:0;white-space:normal;overflow-wrap:anywhere\}/);
  assert.equal(/\.cv-side \.st1 \.st-blk > div > b\{[^}]*text-overflow:ellipsis/.test(page), false);
});

test("item 4 — a '?' beside the company name in the header opens the business; Esc, ✕ and a click outside close it", () => {
  const li = fn("leftIdentHTML");
  assert.match(li, /head && data\.t \? '<button class="sc-bizq sc-tab' \+ \(typeof BIZ_T !== "undefined" && BIZ_T === data\.t \? " on" : ""\)/, "header only, in the tab look");
  assert.match(li, /aria-haspopup="dialog" aria-expanded="' \+ \(typeof BIZ_T !== "undefined" && BIZ_T === data\.t\)/, "the open state lives in the markup");
  assert.match(fn("identPaint"), /bizSync\(\)/, "an open panel follows the name, and closes when it changes");
  assert.match(page, /if \(e\.key !== "Escape" \|\| !BIZ_T\) return;\n    e\.preventDefault\(\); e\.stopImmediatePropagation\(\); bizClose\(true\);/);
  assert.match(page, /if \(tg && tg\.closest && tg\.closest\("#bizPop"\)\) return;\n    bizClose\(false\);/, "a click outside closes it");
  assert.match(fn("cvKeysBlocked"), /if \(typeof BIZ_T !== "undefined" && BIZ_T\) return true;/, "Esc closes the panel, not the company view");
  /* the panel's three states, in order: READ's BUSINESS words; else the provider's description, named; else plain words */
  const esc = (x) => String(x == null ? "" : x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const mk = (coData) => new Function("S", "esc", "readAgeHTML", "sanitize", fn("bizPopHTML") + "\nreturn bizPopHTML;")({ coData }, esc, () => '<span class="readage">DOSSIER · 2 Oct</span>', (x) => x);
  const withRead = mk({ t: "MU", name: "Micron", read: { content: { BUSINESS: ["Micron makes memory."] }, ages: { BUSINESS: {} } }, _profile: { sector: "Technology", industry: "Semiconductors", description: "FMP text" } })("MU");
  assert.match(withRead, /DOSSIER · 2 Oct<\/span><p>Micron makes memory\.<\/p>/);
  assert.match(withRead, /TECHNOLOGY|Technology · Semiconductors/);
  assert.match(withRead, /data-bizread="MU">READ › BUSINESS/);
  const profOnly = mk({ t: "SKHY", name: "SK hynix", read: { content: { BUSINESS: [] } }, _profile: { description: "SK hynix makes DRAM." } })("SKHY");
  assert.match(profOnly, /company profile · FMP<\/div><p>SK hynix makes DRAM\.<\/p>/);
  const none = mk({ t: "XYZ", read: { content: {} }, _profile: {} })("XYZ");
  assert.match(none, /Not written yet for XYZ — no company dossier yet\./);
  assert.match(mk(null)("XYZ"), /reading XYZ …/);
});

test("item 5 — no developer text on the face: plain states, the how-it-is-made moved to PAGE SPECS", () => {
  const gone = ["Desk narrative auto-generates", "fills from company_releases", "No estimate rows in analyst_estimates",
    "No price_target_consensus or analyst_ratings rows", "No P/E inputs loaded", "fills from analyst_grades",
    "no quarterly balance sheet (balance_history)", "cash-flow statement (cashflow_history)", "No rows in fundamentals_history",
    "No earnings events in earnings_events", "live from <b>news</b> (DB)", "(from <b>company_releases</b>)", 'src: "social_sentiment source=youtube (DB)'];
  for (const g of gone) assert.equal(page.includes(g), false, g);
  const rt = fn("readTxtHTML");
  assert.match(rt, /Not written yet for ' \+ esc\(data\.t \|\| "this company"\) \+ " — no company dossier yet\./);
  assert.match(rt, /<details class="sc-pagespecs"><summary>PAGE SPECS<\/summary>/);
  assert.match(page, /details\.sc-pagespecs\{/);
});

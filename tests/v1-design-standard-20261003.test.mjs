/* V1 (3 Oct) — the Hub's visual standard: one measured design sheet, applied. Offline: reads the page source and the sheet;
   nothing leaves the process. The headless proof (every surface, before and after, 1680 x 1050) is in
   deliverables/20261003/hub-design-standard/. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sheet = JSON.parse(fs.readFileSync(new URL("../deliverables/20261003/hub-design-standard/hub-design-standard.json", import.meta.url), "utf8"));
function fn(name) {
  const start = page.search(new RegExp("^(async )?function " + name + "\\b", "m"));
  assert.ok(start >= 0, name + " present");
  return page.slice(start, page.indexOf("\n}\n", start) + 3);
}
const block = page.slice(page.indexOf('<style id="sc-design-standard-20261003">'), page.indexOf("</style>", page.indexOf('<style id="sc-design-standard-20261003">')));

test("the sheet's style block is on the page, last in the cascade, and defines the one tab class the sheet names", () => {
  assert.ok(block.length > 1000, "the block is present");
  assert.equal(sheet.tab.class, "sc-tab");
  assert.match(block, /\n\.sc-tab\{ font-family:var\(--mono\); font-size:var\(--sc-fs-2\); font-weight:400; letter-spacing:var\(--sc-ls-tab\); text-transform:uppercase;/);
  assert.match(block, /\.sc-tab\.is-active, \.sc-tab\.on, \.sc-tab\[aria-pressed="true"\], \.sc-tab\[aria-selected="true"\]\{ color:var\(--sc-accent\); box-shadow:inset 0 -2px 0 var\(--sc-accent\); \}/);
  assert.ok(page.lastIndexOf("<style") === page.indexOf('<style id="sc-design-standard-20261003">'), "no style block comes after the sheet");
  for (const t of Object.keys(sheet.tokens)) assert.ok(block.includes("--" + t.replace(/^--/, "") + ":"), "token on the page: " + t);
});

test("a. every master tab — buttons and the ALLOCATION, STATION, TREE links — carries the sheet's tab class and the links are centred with no underline", () => {
  const b = fn("buildMtabs");
  assert.equal((b.match(/class="sc-mtab sc-tab"/g) || []).length, 4, "the button template and the three links");
  assert.doesNotMatch(b, /class="sc-mtab"/, "no master tab without the class");
  assert.match(block, /\.sc-mtab\.sc-tab\{ display:flex; align-items:center; justify-content:center; text-align:center;/);
  assert.match(block, /\.sc-tab\{[^}]*text-decoration:none;/);
  assert.match(b, /href="' \+ STATION_PUBLIC_URL \+ '" target="_blank"/, "STATION still a link");
  assert.match(b, /href="' \+ TREE_MAP_URL \+ '"/, "TREE still a link");
  assert.match(b, /href="' \+ ALLOCATION_PUBLIC_URL \+ '"/, "ALLOCATION still a link");
});

test("b. the chart toolbar and the company tabs use the sheet's tab class; the toolbar's functions are unchanged", () => {
  const l = fn("cvLineHTML");
  assert.match(l, /class="cv-back sc-tab" data-act="unpin"/);
  assert.match(l, /class="sc-cofr__tf sc-tab' \+ \(x === r \? " on" : ""\)[\s\S]*data-act="corange"/);
  assert.match(l, /class="sc-cofr__tf cv-clouds sc-tab'[\s\S]*data-act="coclouds"/);
  assert.match(l, /data-act="secfs"/);
  assert.match(fn("coExpandBtnHTML"), /class="sc-coexp sc-tab" id="coExpBtn" data-act="coexpand"/);
  assert.match(fn("cohortChipHTML"), /class="sc-it sc-tab" id="cohChip" role="button"/);
  assert.match(fn("cvTabsHTML"), /class="cv-tab sc-tab' \+ \(x === S\.coTab \? " on" : ""\)/);
  assert.match(block, /\.cv-tab\.sc-tab, \.cv-tab\.sc-tab\.on\{ border:0 !important; padding:10px 6px; \}/, "the company tabs' grey underline gives way to the one active mark");
  assert.match(block, /\.cv-line\{ padding:0 4px !important; gap:0 2px !important;/, "the toolbar row is as tall as the tab row");
});

test("c. the company panel splits 50/50 between the chart and the tab area (desk, not expanded); EXPAND and the phone keep their own", () => {
  assert.match(block, /@media \(min-width:761px\)\{\n  body:not\(\.co-exp\) \.cv-main\{ flex:1 1 0 !important; min-height:0 !important; \}\n  body:not\(\.co-exp\) \.cv-side\{ flex:1 1 0 !important; min-height:0 !important; \}\n  body:not\(\.co-exp\) \.cv-chart\{ flex:1 1 0 !important; min-height:0 !important; height:auto !important; \}\n\}/);
  assert.match(page, /body\.co-exp \.cv\{display:grid;grid-template-columns:156px minmax\(0,50fr\) minmax\(0,50fr\)/, "EXPAND's grid untouched");
  assert.equal(sheet.company_view.split, "50/50");
});

test("d. PAGE SPECS: one closed <details class=\"sc-pagespecs\"> per tab or page, footer font; the sweeper moves every .sc-spec there", () => {
  assert.match(block, /\.sc-pagespecs\{[^}]*font-size:var\(--sc-fs-2\)/);
  assert.match(block, /\.sc-pagespecs > summary\{[^}]*text-transform:uppercase/);
  const js = page.slice(page.indexOf('<script id="sc-pagespecs-20261003">'), page.indexOf("</script>", page.indexOf('<script id="sc-pagespecs-20261003">')));
  assert.match(js, /d\.innerHTML = "<summary>PAGE SPECS<\/summary>"/, "closed by default: no open attribute");
  assert.doesNotMatch(js, /\.open = true|setAttribute\("open"/);
  assert.match(js, /new MutationObserver\(queue\)\.observe\(document\.body, \{ childList: true, subtree: true \}\)/);
  for (const marked of ['class="sc-rvnote sc-spec"', 'class="sc-cohgeiger__n sc-spec"', 'class="mmleg sc-spec"', 'class="card sc-spec"><h4>SOURCE · LIVE</h4>', 'class="card sc-spec"><h4>Sources &amp; freshness</h4>', 'class="fn3-note of-legend sc-spec"'])
    assert.ok(page.includes(marked), marked);
  assert.ok((page.match(/class="sn-sub sc-spec"/g) || []).length >= 8, "the SENTIMENT room's explanations");
});

test("the sheet: one type scale of at most six sizes, one surface, one border, one tab style", () => {
  assert.ok(Object.keys(sheet.type_scale).length <= 6);
  assert.equal(typeof sheet.surface.background, "string");
  assert.equal(typeof sheet.border, "string");
  for (const role of ["page_title", "section_header", "tab", "table_header", "body", "number", "footnote"]) assert.ok(sheet.roles[role], "role " + role);
});

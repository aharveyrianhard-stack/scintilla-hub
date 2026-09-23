import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* 23 Sep (M18): the owner runs the Hub as an installed app - a window with no browser toolbar - and said of the
   pages it opens: "I don't have a back button. I don't have a close button. I'm stuck." The BACK / CLOSE pair
   answered that, but where a page had no slot of its own the pair floated over the page's own title.

   These rules hold the repair: every sub-page the Hub can open carries the pair AND a slot of its own, so the
   pair sits in the page's flow instead of on top of it; the review home is one scrolling page rather than six
   tabs that hide each other; and the palette stays grey with no label under 11 px. */

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/* the injector's own list is the source of truth for "a page the Hub opens" */
const injector = read("scripts/inject-scnav.py");
const NAMED = [...injector.matchAll(/^\s+"([^"]+\.html)",$/gm)].map((m) => m[1]);
const DELIVERABLES = fs.existsSync(path.join(ROOT, "deliverables"))
  ? fs.readdirSync(path.join(ROOT, "deliverables"), { recursive: true }).filter((p) => String(p).endsWith(".html")).map((p) => "deliverables/" + p)
  : [];
const PAGES = [...NAMED, ...DELIVERABLES, "prototypes/index.html"];

test("every page the Hub opens carries the way out, and a slot of its own so it covers nothing", () => {
  assert.ok(PAGES.length >= 19, "the audit covers every listed page, not a sample: " + PAGES.length);
  for (const rel of PAGES) {
    const html = read(rel);
    assert.match(html, /<!-- scnav ·/, rel + " carries the BACK / CLOSE pair");
    assert.match(html, /data-go="back"[\s\S]*?data-go="close"/, rel + " offers both a way back and a way out");
    const slots = html.split("data-scnav-slot").length - 1;
    /* one mention belongs to the snippet's own querySelector; a real slot is a second one */
    assert.ok(slots >= 2, rel + " has a slot of its own, so the pair sits in the page instead of over its title");
  }
});

test("the Indicator Lab home is the owner's: it is left alone, and it is not a dead end either", () => {
  const lab = read("prototypes/indicator-lab/index.html");
  assert.doesNotMatch(lab, /<!-- scnav ·/, "the owner's page is not edited by us");
  assert.match(lab, /href="\/prototypes\/"/, "it carries the owner's own way back to the library");
});

test("the review home is one scrolling page: the tabs move you, they do not hide five sections", () => {
  const page = read("prototypes/index.html");
  const script = page.slice(page.lastIndexOf("<script>"));
  assert.doesNotMatch(page, /parts\.forEach\(function\s*\(p\)\s*\{p\.hidden=/, "no section is hidden from the page");
  assert.match(page, /scrollIntoView/, "a tab scrolls to its section");
  assert.ok(script.length > 0);
  for (const id of ["overview", "tools", "review", "work", "architecture", "page-spec"])
    assert.ok(page.includes('id="' + id + '"'), id + " is present on the page at all times");
});

test("the palette is grey: every colour's channels are within 24 of each other and none is brighter than 210", () => {
  const css = read("prototypes/index.html").match(/<style>([\s\S]*?)<\/style>/)[1];
  const bad = [];
  const check = (label, c) => {
    const spread = Math.max(...c) - Math.min(...c);
    if (spread > 24 || Math.max(...c) > 210) bad.push(label + " [" + c.join(",") + "] spread " + spread);
  };
  for (const m of css.matchAll(/#([0-9a-fA-F]{6})\b/g))
    check(m[0], [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)));
  for (const m of css.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)) check(m[0], [+m[1], +m[2], +m[3]]);
  assert.deepEqual(bad, [], "these are not greys");
});

test("no label is smaller than 11 px, at any screen size", () => {
  const css = read("prototypes/index.html").match(/<style>([\s\S]*?)<\/style>/)[1];
  /* the root is clamp(15px, ..., 19px), so anything under .74rem is below 11 px on a phone
     unless it carries an explicit floor */
  const small = [];
  for (const m of css.matchAll(/font(?:-size)?:(?:\d{3} )?(\.\d+)rem/g))
    if (parseFloat(m[1]) < 0.74) small.push(m[0]);
  for (const m of css.matchAll(/font-size:max\(11px,(\.\d+)rem\)/g)) {
    const i = small.indexOf("font-size:" + m[1] + "rem");
    if (i >= 0) small.splice(i, 1);
  }
  const unfloored = small.filter((d) => !/max\(11px/.test(d));
  /* every small declaration must be followed by its floor in the same rule */
  for (const d of unfloored) {
    const at = css.indexOf(d), rest = css.slice(at, css.indexOf("}", at));
    assert.match(rest, /font-size:max\(11px,/, "a label under 11 px with no floor: " + d);
  }
});

/* H2 (30 Sep) — "this thing in the expanded view with the liked 128 has a weird scrolling thing it doesnt let me scroll well."
   Every live tick of the open name and every board refresh repainted the LIKED list and pulled the open name back into
   view, so a list scrolled away from it snapped back within 1-3 s (measured headless with the real 128 names). The open
   name is now brought into view only when it changes, or when asked (the view opens, a re-sort). The list's ends no longer
   hand the scroll to the page behind. Offline: functions are sliced out of the page by name and run with stubs. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
function fn(name) {
  const start = page.search(new RegExp("^(async )?function " + name + "\\b", "m"));
  assert.ok(start >= 0, name + " present");
  return page.slice(start, page.indexOf("\n}\n", start) + 3);
}

/* a rail 300 px tall of 128 rows of 27 px; the open name is row `openIx` */
function harness(openIx) {
  const env = { LEFT_T: "T" + openIx, html: 0 };
  const rowRect = (i, rail) => ({ top: 40 + i * 27 - rail.scrollTop, bottom: 40 + (i + 1) * 27 - rail.scrollTop, left: 0, right: 156, width: 156, height: 27 });
  const rail = { scrollTop: 0, scrollLeft: 0, offsetParent: {},
    getBoundingClientRect: () => ({ top: 40, bottom: 340, left: 0, right: 156, width: 156, height: 300 }),
    querySelector: () => { const i = +env.LEFT_T.slice(1); return { getBoundingClientRect: () => rowRect(i, rail) }; } };
  const m = new Function("env", "el", "cvSet", "cvRailHTML",
    "let LEFT_T; " + fn("cvRailRepaint") + "\nreturn { paint: (r) => { LEFT_T = env.LEFT_T; cvRailRepaint(r); } };")(
    env, (id) => (id === "cvRail" ? rail : null), () => { env.html++; }, () => "");
  return { env, rail, m };
}

test("a tick leaves the LIKED list where it was scrolled; a new open name is brought into view once", () => {
  const { env, rail, m } = harness(0);
  m.paint(true);                             // the view opens: the open name (row 0) is in view, nothing to move
  assert.equal(rail.scrollTop, 0);
  rail.scrollTop = 3000;                     // Alan scrolls to the bottom of the list
  for (let i = 0; i < 20; i++) m.paint();    // twenty live ticks / board refreshes
  assert.equal(rail.scrollTop, 3000, "no snap back to the open name");
  assert.equal(env.html, 21, "the values still repaint on every tick");
  env.LEFT_T = "T120";                       // a click on row 120 (or ↓): the open name changed
  m.paint();
  assert.equal(rail.scrollTop, 3000, "row 120 is already on screen at 3000: nothing moves");
  env.LEFT_T = "T5"; m.paint();              // ↑ wraps to a name far above: it is brought into view
  assert.ok(rail.scrollTop < 200, "a name that changed and is off screen is revealed");
  const at = rail.scrollTop; rail.scrollTop = 2500;
  m.paint(); m.paint();
  assert.equal(rail.scrollTop, 2500, "then the list is left alone again");
  m.paint(true);                             // a re-sort asks explicitly
  assert.equal(rail.scrollTop, at, "an explicit reveal still centres the open name");
});

test("the expanded view asks for the reveal when it opens and on a re-sort; a tick never does", () => {
  assert.match(page, /case "coexpand": \{[\s\S]{0,400}cvRailRepaint\(true\);/);
  assert.match(page, /case "cvrailsort": \{[\s\S]{0,300}cvRailRepaint\(true\);/);
  assert.match(fn("cvRepaint"), /cvRailRepaint\(\);/, "the tick path repaints without asking for a reveal");
  assert.match(page, /if \(el\("cv"\) && document\.body\.classList\.contains\("co-exp"\)\) cvRailRepaint\(\);/, "the board refresh too");
});

test("the list's ends do not scroll the page behind it", () => {
  assert.match(page, /body\.co-exp \.cv-rail\{[^}]*overscroll-behavior:contain/);
});

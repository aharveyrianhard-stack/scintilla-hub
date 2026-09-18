import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("an open events view is re-read on a timer and on return to the tab, never while hidden, never right after a read", () => {
  assert.match(page, /setInterval\(\(\) => refreshOpenEvents\(false\), 300000\);/);
  assert.match(page, /document\.addEventListener\("visibilitychange", \(\) => \{ if \(document\.visibilityState === "visible"\) refreshOpenEvents\(true\); \}\);/);
  const src = page.match(/function refreshOpenEvents\(onResume\) \{[\s\S]*?\n\}\n/)[0];
  assert.match(src, /if \(document\.visibilityState === "hidden"\) return;/);
  assert.match(src, /if \(onResume && Date\.now\(\) - EV_READ_AT < 60000\) return;/);
  assert.match(src, /if \(S\.sec === "EVENTS" && el\("evList"\) && S\.calType !== "DIVIDENDS"\) fillEvents\(true\);\n  else if \(S\.coData && S\.coTab === "EVENTS"\) refreshCompanyEvents\(\);/, "only the view that is open is re-read");
});

test("a quiet re-read that finds the same rows touches nothing; one that finds a change redraws in place", () => {
  assert.match(page, /if \(EV_CACHE && !quiet\) renderEvents\(S\.coh\);/, "no repaint from the old read when the re-read is quiet");
  assert.match(page, /if \(!quiet\) loadCohSets\(\)\.then\(\(\) => \{ if \(S\.sec === "EVENTS"\) renderEvents\(S\.coh\); \}\)/, "nor from the cohort map arriving (measured: it reset the past column from 600px to 0)");
  assert.match(page, /if \(!quiet\) renderEvents\(S\.coh\);\n    else if \(changed\) redrawKeepingPlace\("#evList", "\.sc-evcol", \(\) => renderEvents\(S\.coh\)\);/);
  assert.match(page, /else if \(S\.sec === "EVENTS"\) fillEvents\(\);/, "entering the section still paints at once and reads, as before");
  const co = page.match(/async function refreshCompanyEvents\(\) \{[\s\S]*?\n\}\n/)[0];
  assert.match(co, /if \(sig === d\._evSig\) return;/);
  assert.match(co, /if \(token !== ROT_TOKEN \|\| S\.coData !== d \|\| S\.coTab !== "EVENTS"\) return;/, "an answer for a company that is no longer on screen is dropped");
  assert.match(co, /catch \(err\) \{ return; \}/, "a failed re-read changes nothing on screen");
  assert.match(co, /if \(document\.querySelector\("#leftPanel \.sc-evtab\.tr-open"\)\) return;/, "a call summary being read is not redrawn from under the reader");
  assert.match(page, /_evSig: JSON\.stringify\(\[evs \|\| \[\], csum \|\| \[\], ckeys \|\| \[\]\]\),/, "the first load records what the tab was drawn from, so the first re-read is not a redraw");
  assert.equal((page.match(/pg\(coEventsPath\(e\)\)/g) || []).length, 2, "first load and re-read ask the identical question");
});

test("redrawKeepingPlace keeps each list where the reader left it and an opened group open", () => {
  const mk = (scroll, open) => ({ lists: scroll.map((v) => ({ scrollTop: v })), groups: open.map((v) => ({ open: v })) });
  let dom = mk([0, 480], [true]);
  const document = { querySelector: () => ({ querySelectorAll: (sel) => (/details/.test(sel) ? dom.groups : dom.lists) }) };
  const redraw = new Function("document", page.match(/function redrawKeepingPlace\(rootSel, scrollSel, draw\) \{[\s\S]*?\n\}\n/)[0] + "return redrawKeepingPlace;")(document);
  redraw("#evList", ".sc-evcol", () => { dom = mk([0, 0], [false]); });   // the draw replaces every node
  assert.deepEqual(dom.lists.map((x) => x.scrollTop), [0, 480]); assert.equal(dom.groups[0].open, true);
  redraw("#evList", ".sc-evcol", () => { dom = mk([0], []); });            // fewer lists after the draw: nothing throws
  assert.deepEqual(dom.lists.map((x) => x.scrollTop), [0]);
});

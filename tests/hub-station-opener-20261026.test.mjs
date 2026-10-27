/* 26 Oct 2026 (coordinator) — the STATION tab never opens the Station inside Safari. Alan: "Don't open the fucking station in Safari …
   I opened the station from the Scintilla or in the station PWA." Inside the Hub's own Safari app on a Mac (the iMac's SCINTILLA app) a link
   to the Station stayed in that Safari app, where the X bridge (in Brave) cannot reach it. There the tab sends scintilla-station://wall,
   which the iMac's SCINTILLA Station Opener answers by bringing up the Brave Station app; everywhere else the tab opens the device chooser. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const stationViaApp = new Function(page.match(/function stationViaApp\(nav, mm\) \{[\s\S]*?\n\}\n/)[0] + "return stationViaApp;")();
const SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Safari/605.1.15";
const BRAVE = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1";
const mm = (standalone) => (q) => ({ matches: q === "(display-mode: standalone)" && standalone });

test("STATION via the app: only the Hub's own Safari app on a Mac", () => {
  assert.equal(stationViaApp({ userAgent: SAFARI, maxTouchPoints: 0 }, mm(true)), true, "the iMac's SCINTILLA app (display-mode standalone)");
  assert.equal(stationViaApp({ userAgent: SAFARI, maxTouchPoints: 0, standalone: true }, null), true, "or navigator.standalone");
  assert.equal(stationViaApp({ userAgent: SAFARI, maxTouchPoints: 0 }, mm(false)), false, "Safari's own window: the chooser, as before");
  assert.equal(stationViaApp({ userAgent: BRAVE, maxTouchPoints: 0 }, mm(true)), false, "Brave and Chrome apps: the chooser");
  assert.equal(stationViaApp({ userAgent: SAFARI, maxTouchPoints: 5 }, mm(true)), false, "an iPad asking for the desktop page: the chooser");
  assert.equal(stationViaApp({ userAgent: IPHONE, maxTouchPoints: 5, standalone: true }, null), false, "the iPhone: the chooser");
  assert.equal(stationViaApp(null, null), false);
});

test("the STATION tab: scintilla-station://wall in the Safari app (same window, no new Safari window); the chooser in a new tab elsewhere", () => {
  const SECTIONS = JSON.parse(page.match(/^const SECTIONS = (\[[^\]]*\]);/m)[1]);
  const tabs = (via) => { const box = { innerHTML: "" };
    new Function("el", "SECTIONS", page.match(/^const STATION_PUBLIC_URL = [^\n]*/m)[0] + "\n" + page.match(/^const STATION_APP_URL = [^\n]*/m)[0] + "\n" +
      "const STATION_VIA_APP = " + via + ";\n" + page.match(/^const TREE_MAP_URL = [^\n]*/m)[0] + "\n" + page.match(/^const ALLOCATION_PUBLIC_URL = [^\n]*/m)[0] + "\n" +
      page.match(/^const MTAB_LABEL = [^\n]*/m)[0] + "\n" + page.match(/function buildMtabs\(\) \{[\s\S]*?\n\}\n/)[0] + "buildMtabs();")(() => box, SECTIONS);
    return box.innerHTML.match(/<a[^>]*data-sec="STATION"[^>]*>/)[0]; };
  assert.match(tabs(true), /href="scintilla-station:\/\/wall"/); assert.doesNotMatch(tabs(true), /target=/);
  assert.match(tabs(false), /href="https:\/\/station\.scintillahub\.ai\/go\/" target="_blank" rel="noopener"/);
});

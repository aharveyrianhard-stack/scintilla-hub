#!/usr/bin/env node
// RM1 — the night reload, end to end in a real (headless) browser, on the branch's own files.
// The page's clock is set to 22:00, the page is put somewhere other than its front door, the clock is moved
// to 03:10 (as a Mac waking from sleep would see it) and the page is left to its own three-minute check.
// PASS = it reloaded itself once, came back where it was, and did not reload again over the next two days.
//   node verify-night-reload.mjs hub|station <override.json> [--off | --hold]
//     --off   opened with ?nightreload=0: it must not reload
//     --hold  something is up that the night reload waits for (Hub: the bell's panel; Station: the browser's full
//             screen): no reload while it is up, one reload once it is closed
// Every non-GET is kept off the network: the page's own version check (a HEAD to its own server) is answered
// here with a fixed tag, everything else non-GET is refused and counted.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [which, overrideFile] = process.argv.slice(2);
const OFF = process.argv.includes("--off"), HOLD = process.argv.includes("--hold");
const urlKey = (u) => { try { const x = new URL(u); return x.host + x.pathname; } catch (_) { return ""; } };
const overrides = new Map(Object.entries(JSON.parse(fs.readFileSync(overrideFile, "utf8"))).map(([u, f]) => [urlKey(u), f]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const START = new Date("2026-10-07T22:00:00-04:00");
const URL_ = (which === "hub" ? "https://scintillahub.ai/" : "https://station.scintillahub.ai/deck/") + (OFF ? "?nightreload=0" : "");
const blocked = {}; let heads = 0, documentLoads = 0;

const browser = await chromium.launch({ headless: true, args: ["--mute-audio"] });
let ok = true; const say = (pass, text) => { if (!pass) ok = false; console.log((pass ? "  PASS  " : "  FAIL  ") + text); };
try {
  const context = await browser.newContext({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1, serviceWorkers: "block", timezoneId: "America/New_York", locale: "en-US" });
  await context.route("**/*", (route) => {
    const req = route.request(), key = urlKey(req.url()), own = /(^|\.)scintillahub\.ai$/.test(new URL(req.url()).hostname);
    if (req.method() === "HEAD" && own) { heads++; return route.fulfill({ status: 200, headers: { etag: '"rm1-fixed-tag"', "cache-control": "no-store" }, body: "" }); }
    if (req.method() !== "GET") { blocked[req.method() + " " + key] = (blocked[req.method() + " " + key] || 0) + 1; return route.abort("blockedbyclient"); }
    const local = overrides.get(key);
    if (local) { if (/index\.html$/.test(local) && req.resourceType() === "document" && req.frame() === page.mainFrame()) documentLoads++;
      return route.fulfill({ status: 200, contentType: /\.m?js$/.test(local) ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8", headers: { "cache-control": "no-store" }, body: fs.readFileSync(local) }); }
    return route.continue();
  });
  const page = await context.newPage();
  await page.clock.install({ time: START });
  await page.goto(URL_, { waitUntil: "load", timeout: 120000 });
  await page.clock.resume();
  await sleep(18000);
  console.log(which.toUpperCase() + (OFF ? " (switched off with ?nightreload=0)" : "") + " — the page's clock reads " + await page.evaluate(() => new Date().toString().slice(0, 24)));

  let before;
  if (which === "hub") {
    before = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const press = (sel) => { const n = document.querySelector(sel); if (n) n.click(); return !!n; };
      press('[data-act="coh"][data-key="ALL"]');
      for (let i = 0; i < 60 && document.querySelectorAll(".sc-board__row[data-t]").length < 20; i++) await wait(500);   /* the ALL list is a large read */
      await wait(1500);
      const row = [...document.querySelectorAll(".sc-board__row[data-t]")][12] || document.querySelector(".sc-board__row[data-t]");
      let sc = row; while (sc && !(sc.scrollHeight > sc.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
      if (sc) sc.scrollTop = 420;
      const t = row.dataset.t; row.querySelector(".sc-ctk").click(); await wait(2500);
      return { sec: S.sec, coh: S.coh, pinned: LEFT_STATE === "PINNED" ? LEFT_T : null, boardScroll: sc ? Math.round(sc.scrollTop) : null, boardPath: sc ? hubScrollPath(sc) : null, name: t };
    });
  } else {
    before = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      await wait(4000);
      const pane = PANES.find((p) => p.def.kind === "video" && p.frame);
      const grid = pane && pane.frame.contentDocument && pane.frame.contentDocument.getElementById("grid");
      if (grid) grid.scrollTop = 380;
      /* the wall is held on its page (the deck's own pause, remembered on this test browser only): otherwise the lap moves
         to another page while the clock is being moved, and "before" would not be the page that was reloaded */
      setRotationPaused(true);
      setSolo("c1");                                   /* the first chart, expanded - a state the deck does not remember by itself */
      await wait(500);
      return { scene: SCENE, range: RANGE, videoFeed: VIDEO_FEED, chartCount: CHART_COUNT, rotationPaused: ROTATE_PAUSED, expanded: SOLO, videoPane: pane ? pane.def.key : null, gridScroll: grid ? Math.round(grid.scrollTop) : null, xFrames: document.querySelectorAll('iframe[src*="x-v2"]').length };
    });
  }
  console.log("  before:", JSON.stringify(before));
  const loads0 = documentLoads;
  if (HOLD) {
    if (which === "hub") await page.evaluate(() => document.getElementById("alertBell").click());
    else {
      /* the browser only grants full screen to a real press: one click on the wall's empty corner, then the deck's own
         button (it lives in the tucked-away dock, so it is pressed directly) */
      await page.mouse.click(8, 300);
      await page.evaluate(() => document.getElementById("stationFullBtn").click());
    }
    await sleep(800);
    const up = await page.evaluate((hub) => (hub ? hubNightHoldNow() : nightHoldNow()), which === "hub");
    say(!!up, "something is up that the night reload waits for: " + JSON.stringify(up));
    await page.clock.fastForward("05:10:00"); await sleep(3000);
    for (let i = 0; i < 3; i++) { await page.clock.fastForward("03:05"); await sleep(2000); }
    say(documentLoads === loads0, "3 am came and went with it up: no reload (" + (documentLoads - loads0) + ")");
    if (which === "hub") await page.evaluate(() => document.getElementById("alertBell").click());
    else await page.evaluate(() => document.exitFullscreen());
    await sleep(800);
    const down = await page.evaluate((hub) => (hub ? hubNightHoldNow() : nightHoldNow()), which === "hub");
    say(down === "", "closed again: nothing holds it (" + JSON.stringify(down) + ")");
    for (let i = 0; i < 3 && documentLoads === loads0; i++) { await page.clock.fastForward("03:05"); await sleep(2500); }
    await sleep(8000);
    say(documentLoads === loads0 + 1, "at the next check it reloaded, once (" + (documentLoads - loads0) + "); the page's clock reads " + await page.evaluate(() => new Date().toString().slice(16, 24)));
    console.log("  non-GET requests refused: " + JSON.stringify(blocked));
    console.log(ok ? "RESULT: PASS" : "RESULT: FAIL");
    await browser.close();
    process.exit(ok ? 0 : 1);
  }

  // 22:00 → 03:10, the way a sleeping Mac sees it: the clock jumps, every due timer fires once
  await page.clock.fastForward("05:10:00");
  await sleep(3000);
  // …and the page is left alone for its next checks (three minutes apart on its own clock)
  for (let i = 0; i < 3 && documentLoads === loads0; i++) { await page.clock.fastForward("03:05"); await sleep(2500); }
  await sleep(OFF ? 2000 : 9000);
  const reloads = documentLoads - loads0;
  if (OFF) say(reloads === 0, "switched off: no reload at 3 am (document loads after the first: " + reloads + ")");
  else say(reloads === 1, "it reloaded itself once in the night hour (document loads after the first: " + reloads + ", version checks answered: " + heads + ")");

  if (!OFF) {
    await sleep(6000);
    /* a large list fills late on a busy machine: the place is read once the board has been put back, or after 50 s */
    if (which === "hub") for (let i = 0; i < 100; i++) {
      const top = await page.evaluate((path) => { try { const n = path && document.querySelector(path); return n ? Math.round(n.scrollTop) : -1; } catch (_) { return -1; } }, before.boardPath).catch(() => -1);
      if (Math.abs(top - before.boardScroll) <= 4) break;
      await sleep(500);
    }
    const after = which === "hub"
      ? await page.evaluate((path) => { let n = null; try { n = path && document.querySelector(path); } catch (_) {} return { sec: S.sec, coh: S.coh, pinned: LEFT_STATE === "PINNED" ? LEFT_T : null, boardScroll: n ? Math.round(n.scrollTop) : null, clock: new Date().toString().slice(0, 24), kept: sessionStorage.getItem("hub.nightreload.place") }; }, before.boardPath)
      : await page.evaluate(async (key) => { await new Promise((r) => setTimeout(r, 6000)); const pane = PANES.find((p) => p.def.key === key); const grid = pane && pane.frame && pane.frame.contentDocument && pane.frame.contentDocument.getElementById("grid");
          return { scene: SCENE, range: RANGE, videoFeed: VIDEO_FEED, chartCount: CHART_COUNT, rotationPaused: ROTATE_PAUSED, expanded: SOLO, gridScroll: grid ? Math.round(grid.scrollTop) : null, xFrames: document.querySelectorAll('iframe[src*="x-v2"]').length, clock: new Date().toString().slice(0, 24), kept: sessionStorage.getItem("station.nightreload.place") }; }, before.videoPane);
    console.log("  after: ", JSON.stringify(after));
    if (which === "hub") {
      say(after.sec === before.sec, "the room is the same (" + after.sec + ")");
      say(after.coh === before.coh, "the board's list is the same (" + after.coh + ")");
      say(after.pinned === before.pinned && !!after.pinned, "the open company is the same (" + after.pinned + ")");
      say(before.boardScroll > 0 && Math.abs((after.boardScroll || 0) - before.boardScroll) <= 4, "the board is scrolled where it was (" + before.boardScroll + " → " + after.boardScroll + " px)");
    } else {
      say(after.scene === before.scene && after.range === before.range && after.chartCount === before.chartCount, "the scene, timeframe and chart count are the same (" + after.scene + ", " + after.range + ", " + after.chartCount + ")");
      say(after.videoFeed === before.videoFeed && after.rotationPaused === before.rotationPaused, "the video feed is the same (" + after.videoFeed + ") and the rotation is still paused");
      say(after.expanded === before.expanded && !!after.expanded, "the pane that was expanded is expanded again (" + after.expanded + ")");
      say(before.gridScroll > 0 && Math.abs((after.gridScroll || 0) - before.gridScroll) <= 4, "the video list is scrolled where it was (" + before.gridScroll + " → " + after.gridScroll + " px)");
      say(after.xFrames === before.xFrames, "the X pane is mounted again, by the deck itself (" + after.xFrames + " frame)");
    }
    say(after.kept === null, "the kept place was used once and removed");
    // two more days: asleep by day (the clock jumps), awake for the checks around each 3 am
    const loads1 = documentLoads;
    await page.clock.fastForward("00:30:00"); await sleep(1500);                       // 03:4x the same night: already reloaded
    await page.clock.fastForward("03:05"); await sleep(1500);
    say(documentLoads === loads1, "no second reload the same night");
    await page.clock.fastForward("10:00:00"); await sleep(1500); await page.clock.fastForward("03:05"); await sleep(1500);   // ~13:50 next day
    say(documentLoads === loads1, "no reload in the working day");
    await page.clock.fastForward("13:30:00"); await sleep(2500);                       // ~03:25 the next night
    for (let i = 0; i < 3 && documentLoads === loads1; i++) { await page.clock.fastForward("03:05"); await sleep(2500); }
    await sleep(8000);
    say(documentLoads === loads1 + 1, "the next night: once again (" + (documentLoads - loads1) + ")");
  }
  console.log("  non-GET requests refused: " + JSON.stringify(blocked));
  await page.screenshot({ path: "verify-" + which + (OFF ? "-off" : "") + ".jpg", type: "jpeg", quality: 60 }).catch(() => {});
} finally { await browser.close(); }
console.log(ok ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(ok ? 0 : 1);

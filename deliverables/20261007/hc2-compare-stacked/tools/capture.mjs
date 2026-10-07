// HC2 — the pictures and the measurements behind them: the compare panel before (one row, swiped sideways) → after (one
// column, scrolled up and down).
//   before = the Hub as deployed (https://scintillahub.ai/)        after = this branch's files served at the same address
// Headless only; every request that is not a GET is stopped and counted (HC1's rig.mjs). Nothing is written anywhere but
// this folder.
//   node deliverables/20261007/hc2-compare-stacked/tools/capture.mjs <before|after> <width> [height]
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { openHub, sleep, REPO } from "../../../20261006/hc1-compare-one-screen/tools/rig.mjs";

const D = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WHICH = process.argv[2] || "after", W = +(process.argv[3] || 1680), H = +(process.argv[4] || 0) || (W < 500 ? 844 : W >= 1680 ? 1050 : W >= 1440 ? 900 : 800);
const PHONE = W < 500, TAG = H === (PHONE ? 844 : W >= 1680 ? 1050 : W >= 1440 ? 900 : 800) ? String(W) : W + "x" + H;
const SHOTS = path.join(D, "shots");
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(path.join(D, "data"), { recursive: true });
const out = { which: WHICH, width: W, height: H, at: new Date().toISOString(), steps: {} };
const h = await openHub({ width: W, height: H, local: WHICH === "before" ? null : REPO });
const { page, count } = h;
const shot = async (name) => { const f = `${name}-${WHICH}-${TAG}.png`; await page.screenshot({ path: path.join(SHOTS, f) }); return f; };
const toTab = async () => {
  const sel = '[data-act="l0tab"][data-tab="COHORT"]';
  await page.evaluate((s) => { document.querySelector(s).scrollIntoView({ block: "start" }); window.scrollBy(0, -8); }, sel);
  await page.click(sel); await sleep(1500);
  await page.evaluate((s) => { document.querySelector(s).scrollIntoView({ block: "start" }); window.scrollBy(0, -8); }, sel);
  await sleep(300);
};
/* everything the brief asks about, read off the page as it stands */
const read = () => page.evaluate(() => {
  const q = (s) => document.querySelector(s), box = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; };
  const sc = q("#cmpxScroll"), cc = q("#cohCompare"), bar = q("#cmpxBar"), zoom = +getComputedStyle(document.body).zoom || 1;
  const over = (e) => (e ? Math.max(0, e.scrollWidth - e.clientWidth) : null);     // px of content that can only be reached by scrolling sideways
  const L = sc.getBoundingClientRect();
  const cards = Array.from(document.querySelectorAll(".sc-cmpx__card")).map((c) => {
    const b = c.getBoundingClientRect(), tr = c.querySelector(".sc-vmini"), col = c.querySelector(".sc-cohstrip__col");
    const seen = Math.max(0, Math.min(b.bottom, L.bottom) - Math.max(b.top, L.top)) * Math.max(0, Math.min(b.right, L.right) - Math.max(b.left, L.left));
    return { view: c.querySelector(".sc-cmpx__ttl").textContent, scale: c.querySelector(".sc-cmpx__sub").textContent, unfolded: c.classList.contains("is-exp"),
      w: Math.round(b.width), h: Math.round(b.height), shareOfListHeight: +(b.height / L.height).toFixed(3), shown: +(seen / (b.width * b.height || 1)).toFixed(2), sideways: over(c),
      columns: c.querySelectorAll(".sc-cohstrip__col").length, columnW: col ? +col.getBoundingClientRect().width.toFixed(1) : null,
      barTrackH: tr ? Math.round(tr.getBoundingClientRect().height) : null, barW: tr ? +tr.getBoundingClientRect().width.toFixed(1) : null,
      rowsOfBars: new Set(Array.from(c.querySelectorAll(".sc-vmini")).map((v) => Math.round(v.getBoundingClientRect().top))).size,
      none: (c.querySelector(".sc-cmpx__none") || {}).textContent || null,
      bars: Array.from(c.querySelectorAll(".sc-cohstrip__col")).map((x) => (x.querySelector(".sc-cohstrip__lbl") || {}).textContent + " " + (x.querySelector(".sc-cohstrip__val") || {}).textContent),
      hovers: Array.from(c.querySelectorAll(".sc-cohstrip__col")).map((x) => x.getAttribute("title")) };
  });
  return { asof: typeof SC_ASOF === "function" ? SC_ASOF() : null, bodyZoom: zoom, viewport: [innerWidth, innerHeight],
    panel: box(cc), replayBar: box(bar), list: box(sc), pageSpecs: box(q(".sc-cmpx__specs")),
    listScroll: { shownW: sc.clientWidth, wholeW: sc.scrollWidth, shownH: sc.clientHeight, wholeH: sc.scrollHeight, left: Math.round(sc.scrollLeft), top: Math.round(sc.scrollTop),
      overflowX: getComputedStyle(sc).overflowX, overflowY: getComputedStyle(sc).overflowY },
    /* no sideways scroll ANYWHERE: the page, the main column, the pane, the panel, the list, each card */
    sideways: { page: Math.max(0, document.documentElement.scrollWidth - innerWidth), main: over(q("#main")), pane: over(q("#layer0")), paneBody: over(q("#l0body")), panel: over(cc), list: over(sc),
      cards: cards.reduce((t, c) => t + (c.sideways || 0), 0) },
    cardsFullyShown: cards.filter((c) => c.shown >= 0.98).map((c) => c.view), cardsPartlyShown: cards.filter((c) => c.shown > 0.02 && c.shown < 0.98).map((c) => c.view),
    cutLabels: Array.from(document.querySelectorAll(".sc-cmpx__card .sc-cohstrip__lbl, .sc-cmpx__card .sc-cohstrip__val, .sc-cmpx__ttl, .sc-cmpx__sub")).filter((e) => e.offsetParent !== null && e.scrollWidth > e.clientWidth + 0.5).map((e) => e.textContent),
    replay: { date: (q("#cmpxDt") || {}).textContent, liveChipShown: q("#cmpxLive") ? !q("#cmpxLive").hidden : null, play: (q("#cmpxPlay") || {}).textContent },
    cards };
});
const slim = (r) => { const c = JSON.parse(JSON.stringify(r)); c.cards.forEach((x) => { delete x.hovers; delete x.bars; }); return c; };

try {
  await page.waitForFunction(() => typeof LISTS_READ !== "undefined" && LISTS_READ && document.querySelectorAll(".sc-board__row").length > 5, null, { timeout: 90000 }); await sleep(3500);
  out.pageSha = await page.evaluate(async () => { const b = await (await fetch(location.href)).arrayBuffer(); const d = await crypto.subtle.digest("SHA-256", b); return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 12); });
  await toTab();
  await page.waitForFunction(() => typeof SC_BLEND !== "undefined" && SC_BLEND.at > 0, null, { timeout: 60000 }); await sleep(1500);
  const S = out.steps;

  /* 1 · as it opens */
  const first = await read();
  S.opens = slim(first); S.opens.shot = await shot("1-as-it-opens");
  out.numbers = first.cards.map((c) => ({ view: c.view, scale: c.scale, bars: c.bars }));      // every number on every card, for the before ↔ after comparison
  out.hovers = { first: first.cards[0].hovers[0], breadth: first.cards[1].hovers[0], stateStreet: first.cards[2].hovers[0] };

  if (WHICH === "before") {
    /* the row as deployed: what a reader has to swipe through to reach the last card */
    await page.evaluate(() => { const s = document.getElementById("cmpxScroll"); s.scrollLeft = (s.scrollWidth - s.clientWidth) / 2; }); await sleep(500);
    S.swipedHalfway = slim(await read()); S.swipedHalfway.shot = await shot("2-swiped-halfway");
    await page.evaluate(() => { const s = document.getElementById("cmpxScroll"); s.scrollLeft = s.scrollWidth; }); await sleep(500);
    S.swipedToEnd = slim(await read()); S.swipedToEnd.shot = await shot("3-swiped-to-the-end");
    await page.evaluate(() => { document.getElementById("cmpxScroll").scrollLeft = 0; });
    await page.click("#cmpxBar .sc-fsico"); await sleep(1200);
    S.fullScreen = slim(await read()); S.fullScreen.shot = await shot("4-full-screen");
    await page.click("#cmpxBar .sc-fsico"); await sleep(900);
  } else {
    const barTop0 = first.replayBar.y;
    /* 2 · one screen down, then the end: every card is on the list, and the replay handle has not moved */
    const pageDown = () => page.evaluate(() => { const s = document.getElementById("cmpxScroll"); s.scrollTop = Math.min(s.scrollHeight, s.scrollTop + s.clientHeight); });
    await pageDown(); await sleep(700);
    S.oneScreenDown = slim(await read()); S.oneScreenDown.replayBarMovedPx = S.oneScreenDown.replayBar.y - barTop0; S.oneScreenDown.shot = await shot("2-one-screen-down");
    await page.evaluate(() => { const s = document.getElementById("cmpxScroll"); s.scrollTop = s.scrollHeight; }); await sleep(700);
    S.atTheEnd = slim(await read()); S.atTheEnd.replayBarMovedPx = S.atTheEnd.replayBar.y - barTop0; S.atTheEnd.shot = await shot("3-at-the-end");
    /* a feed tick repaints the cards: the list must stay where it was */
    S.keepsPlaceOnRepaint = await page.evaluate(() => { const s = document.getElementById("cmpxScroll"); const y = s.scrollTop; updateBoard(); cohComparePaint(); return { before: Math.round(y), after: Math.round(document.getElementById("cmpxScroll").scrollTop) }; });
    /* a click on a cohort's bar switches the board and REBUILDS this pane: the list must come back where it was */
    if (!PHONE) {
      const was = await page.evaluate(() => S.coh);
      await page.evaluate(() => { const s = document.getElementById("cmpxScroll"), c = document.querySelector('.sc-cmpx__card[data-cmpx="COHORTS"]'); s.scrollTop += c.getBoundingClientRect().top - s.getBoundingClientRect().top - 6; }); await sleep(700);
      const y0 = await page.evaluate(() => Math.round(document.getElementById("cmpxScroll").scrollTop));
      await page.click('.sc-cmpx__card[data-cmpx="COHORTS"] .sc-cohstrip__col[data-key="METALS"]'); await sleep(4000);
      S.cohortClick = await page.evaluate((y0) => ({ board: S.coh, boardRows: document.querySelectorAll(".sc-board__row").length, listBefore: y0, listAfter: Math.round(document.getElementById("cmpxScroll").scrollTop),
        marked: !!document.querySelector('.sc-cmpx__card[data-cmpx="COHORTS"] .sc-cohstrip__col.is-active[data-key="METALS"]') }), y0);
      S.cohortClick.shot = await shot("3b-after-a-cohort-click");
      await page.click('[data-act="coh"][data-key="' + was + '"]'); await sleep(3500);
    }
    await page.evaluate(() => { document.getElementById("cmpxScroll").scrollTop = 0; }); await sleep(400);
    /* 3 · State Street unfolded (the ⤢): the word and the trend / momentum pair under each bar */
    await page.click('[data-act="cmpxexp"][data-v="SPDR"]'); await sleep(700);
    await page.evaluate(() => { const s = document.getElementById("cmpxScroll"), c = document.querySelector('.sc-cmpx__card[data-cmpx="SPDR"]'); const b = c.getBoundingClientRect(), L = s.getBoundingClientRect(); if (b.bottom > L.bottom) s.scrollTop += b.bottom - L.bottom + 6; }); await sleep(500);
    S.unfolded = slim(await read());
    S.unfolded.stateStreet = await page.evaluate(() => { const c = document.querySelector('.sc-cmpx__card[data-cmpx="SPDR"]'), vis = (e) => e.offsetParent !== null;
      const cut = Array.from(c.querySelectorAll(".sc-cohstrip__read, .sc-cohstrip__tm, .sc-cohstrip__n")).filter(vis).filter((e) => e.scrollWidth > e.clientWidth + 0.5).map((e) => e.textContent);
      return { unfolded: c.classList.contains("is-exp"), words: Array.from(c.querySelectorAll(".sc-cohstrip__read")).filter(vis).map((e) => e.textContent), pairs: Array.from(c.querySelectorAll(".sc-cohstrip__tm")).filter(vis).map((e) => e.textContent), cutWords: cut }; });
    S.unfolded.shot = await shot("4-state-street-unfolded");
    await page.click('[data-act="cmpxexp"][data-v="SPDR"]'); await sleep(500);                       // fold it back: the picture run leaves nothing remembered
    /* …and COHORTS unfolded: twelve columns and the longest names, the tightest card there is */
    await page.evaluate(() => { const s = document.getElementById("cmpxScroll"), c = document.querySelector('.sc-cmpx__card[data-cmpx="COHORTS"]'); s.scrollTop += c.getBoundingClientRect().top - s.getBoundingClientRect().top - 6; }); await sleep(600);
    await page.click('[data-act="cmpxexp"][data-v="COHORTS"]'); await sleep(700);
    S.cohortsUnfolded = await page.evaluate(() => { const c = document.querySelector('.sc-cmpx__card[data-cmpx="COHORTS"]'), vis = (e) => e.offsetParent !== null, b = c.getBoundingClientRect(), L = document.getElementById("cmpxScroll").getBoundingClientRect();
      return { unfolded: c.classList.contains("is-exp"), h: Math.round(b.height), shareOfListHeight: +(b.height / L.height).toFixed(3), sideways: Math.max(0, c.scrollWidth - c.clientWidth),
        rowsOfBars: new Set(Array.from(c.querySelectorAll(".sc-vmini")).map((v) => Math.round(v.getBoundingClientRect().top))).size, columnW: +c.querySelector(".sc-cohstrip__col").getBoundingClientRect().width.toFixed(1),
        words: Array.from(c.querySelectorAll(".sc-cohstrip__read")).filter(vis).map((e) => e.textContent),
        cut: Array.from(c.querySelectorAll(".sc-cohstrip__lbl, .sc-cohstrip__val, .sc-cohstrip__read, .sc-cohstrip__tm, .sc-cohstrip__n")).filter(vis).filter((e) => e.scrollWidth > e.clientWidth + 0.5).map((e) => e.textContent) }; });
    S.cohortsUnfolded.shot = await shot("4b-cohorts-unfolded");
    await page.click('[data-act="cmpxexp"][data-v="COHORTS"]'); await sleep(500);
    await page.evaluate(() => { document.getElementById("cmpxScroll").scrollTop = 0; }); await sleep(300);
    /* 4 · REPLAY from the pinned handle: scrub back about four weeks, look, scroll the list, play three seconds, pause, back to live */
    S.replayBefore = await page.evaluate(() => cmpxBarState());
    await page.evaluate(() => { const s = document.getElementById("cmpxSc"); s.value = Math.round((+s.max - 20 * 20) / 20) * 20; s.dispatchEvent(new Event("input", { bubbles: true })); });
    await sleep(4500);
    const rew = await read();
    S.replayed = slim(rew); S.replayed.numbers = rew.cards.map((c) => ({ view: c.view, scale: c.scale, none: c.none, bars: c.bars.length }));
    S.replayed.bar = await page.evaluate(() => ({ second: cmpxBarState(), boardStamp: document.getElementById("gwxDt").textContent, boardThumb: +document.getElementById("gwxSc").value, thisThumb: +document.getElementById("cmpxSc").value }));
    S.replayed.shot = await shot("5-replay-four-weeks-back");
    await pageDown(); await sleep(700);
    /* compared with the handle's place a moment ago, in this same replayed state: on a phone the board above grows a line when it is rewound */
    S.replayedScrolled = slim(await read()); S.replayedScrolled.replayBarMovedPx = S.replayedScrolled.replayBar.y - S.replayed.replayBar.y; S.replayedScrolled.shot = await shot("6-replay-scrolled-down-live-chip-still-there");
    await page.click("#cmpxPlay"); await sleep(3200);
    S.playing = await page.evaluate(() => ({ second: document.getElementById("cmpxPlay").textContent, board: document.getElementById("gwxPlay").textContent, day: SC_ASOF(), listTop: Math.round(document.getElementById("cmpxScroll").scrollTop),
      thisThumb: Math.round(+document.getElementById("cmpxSc").value), boardThumb: Math.round(+document.getElementById("gwxSc").value) }));
    await page.click("#cmpxPlay"); await sleep(500);
    S.paused = await page.evaluate(() => ({ second: document.getElementById("cmpxPlay").textContent, day: SC_ASOF() }));
    await page.click("#cmpxLive"); await sleep(1800);
    S.backToLive = await page.evaluate(() => ({ day: SC_ASOF(), stamp: document.getElementById("cmpxDt").textContent, liveChipShown: !document.getElementById("cmpxLive").hidden, firstCard: document.querySelector('.sc-cmpx__card[data-cmpx="BLEND"] .sc-cmpx__sub').textContent }));
    await page.evaluate(() => { document.getElementById("cmpxScroll").scrollTop = 0; }); await sleep(300);
    /* 5 · full screen (the panel's own ⛶) — and State Street unfolded there */
    await page.click("#cmpxBar .sc-fsico"); await sleep(1200);
    S.fullScreen = slim(await read()); S.fullScreen.shot = await shot("7-full-screen");
    await page.click('[data-act="cmpxexp"][data-v="SPDR"]'); await sleep(700);
    S.fullScreenUnfolded = slim(await read());
    S.fullScreenUnfolded.cutWords = await page.evaluate(() => Array.from(document.querySelectorAll('.sc-cmpx__card.is-exp .sc-cohstrip__read, .sc-cmpx__card.is-exp .sc-cohstrip__tm')).filter((e) => e.offsetParent !== null && e.scrollWidth > e.clientWidth + 0.5).map((e) => e.textContent));
    S.fullScreenUnfolded.shot = await shot("8-full-screen-state-street-unfolded");
    await page.click('[data-act="cmpxexp"][data-v="SPDR"]'); await sleep(500);
    await page.click("#cmpxBar .sc-fsico"); await sleep(900);                                        // leave full screen
    /* 6 · the thinner option, NOT what the branch ships: four cards to the list, set on this page only, for the picture */
    if (process.argv.includes("--four")) {
      await page.evaluate(() => { document.getElementById("cmpxScroll").style.setProperty("--cmpx-rows", "4"); }); await sleep(600);
      S.optionFour = slim(await read()); S.optionFour.shot = await shot("9-option-four-to-a-panel");
      await page.evaluate(() => { document.getElementById("cmpxScroll").style.removeProperty("--cmpx-rows"); });
    }
  }
} catch (e) { out.error = String((e && e.stack) || e).slice(0, 1500); console.error(out.error); }
finally {
  out.requests = { stoppedNonGet: count.blocked, stoppedWhat: Array.from(new Set(count.blockedList)), branchFilesServed: count.servedLocal };
  out.consoleErrors = count.consoleErrors.slice(0, 10);
  fs.writeFileSync(path.join(D, "data", `capture-${WHICH}-${TAG}.json`), JSON.stringify(out, null, 1));
  await h.close();
}
const o = out.steps.opens || {};
console.log(WHICH, TAG, "page", out.pageSha, "· steps", Object.keys(out.steps).join(","), "· sideways", JSON.stringify(o.sideways), "· shown", (o.cardsFullyShown || []).length, "· cut", JSON.stringify(o.cutLabels),
  "· non-GET stopped", out.requests.stoppedNonGet, "· console errors", out.consoleErrors.length, out.error ? "· ERROR" : "");

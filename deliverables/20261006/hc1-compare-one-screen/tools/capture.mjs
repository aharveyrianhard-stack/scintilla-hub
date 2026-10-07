// HC1 — the pictures and the measurements behind them, before → after, at 1680 and 390.
//   before = the Hub as deployed (https://scintillahub.ai/)        after = this branch's files served at the same address
// Headless only; every request that is not a GET is stopped and counted (rig.mjs). Nothing is written anywhere but this folder.
//   node deliverables/20261006/hc1-compare-one-screen/tools/capture.mjs <before|after> <1680|390> [compare|bar|chart]…
import fs from "fs";
import path from "path";
import { openHub, sleep, D, REPO } from "./rig.mjs";

const WHICH = process.argv[2] || "after", W = +(process.argv[3] || 1680);
const PARTS = process.argv.slice(4).length ? process.argv.slice(4) : ["compare", "bar", "chart"];
const SHOTS = path.join(D, "shots"), NAME = "EQIX";
fs.mkdirSync(SHOTS, { recursive: true });
const out = { which: WHICH, width: W, at: new Date().toISOString(), parts: {} };
const h = await openHub({ width: W, local: WHICH === "before" ? null : REPO });
const { page, count } = h;
const shot = async (name, clip) => { const f = `${name}-${WHICH}-${W}.png`; await page.screenshot({ path: path.join(SHOTS, f), ...(clip ? { clip } : {}) }); return f; };
const ready = async () => { await page.waitForFunction(() => typeof LISTS_READ !== "undefined" && LISTS_READ && document.querySelectorAll(".sc-board__row").length > 5, null, { timeout: 90000 }); await sleep(3500); };
const toTab = async () => {
  const sel = '[data-act="l0tab"][data-tab="COHORT"]';
  await page.evaluate((s) => { document.querySelector(s).scrollIntoView({ block: "start" }); window.scrollBy(0, -8); }, sel);
  await page.click(sel); await sleep(1500);
  await page.evaluate((s) => { document.querySelector(s).scrollIntoView({ block: "start" }); window.scrollBy(0, -8); }, sel);
  await sleep(300);
};

try {
  await ready();
  out.pageSha = await page.evaluate(async () => { const b = await (await fetch(location.href)).arrayBuffer(); const d = await crypto.subtle.digest("SHA-256", b); return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 12); });

  /* ── 1 · the compare ─────────────────────────────────────────────────────────────────────────────── */
  if (PARTS.includes("compare")) {
    const P = (out.parts.compare = {});
    await toTab();
    if (WHICH === "before") {
      /* the tabs as they are: COHORTS, then SECTORS with each family behind a chip (BOW TIE among them) */
      P.cohorts = await shot("cmp-1-cohorts");
      await page.evaluate(() => { const b = document.querySelector('[data-gwxcmp="SECTORS"]'); if (b) b.click(); }); await sleep(900);
      P.chips = await page.evaluate(() => Array.from(document.querySelectorAll("[data-gwxfam]")).map((b) => b.textContent.trim()));
      P.sectors = await shot("cmp-2-sectors-state-street");
      await page.evaluate(() => { const b = document.querySelector('[data-gwxfam="BOWTIE"]'); if (b) b.click(); }); await sleep(900);
      P.header = await page.evaluate(() => (document.querySelector(".sc-cohstrip__hd") || {}).innerText || null);
      P.bowtie = await shot("cmp-3-bow-tie");
    } else {
      await page.waitForFunction(() => typeof SC_BLEND !== "undefined" && SC_BLEND.at > 0, null, { timeout: 60000 }); await sleep(1200);
      const read = () => page.evaluate(() => {
        const sc = document.getElementById("cmpxScroll"), b = sc.getBoundingClientRect();
        return { asof: SC_ASOF(), date: document.getElementById("cmpxDt").textContent, pageScrollsSideways: document.documentElement.scrollWidth > innerWidth + 1,
          row: { shown: Math.round(sc.clientWidth), whole: Math.round(sc.scrollWidth), at: Math.round(sc.scrollLeft), height: Math.round(b.height) },
          zeroLines: Array.from(new Set(Array.from(document.querySelectorAll(".sc-cmpx__card")).map((c) => { const z = c.querySelector(".sc-vmini__mid"); return z ? Math.round(z.getBoundingClientRect().top) : null; }).filter((v) => v != null))),
          cut: Array.from(document.querySelectorAll(".sc-cmpx__card .sc-cohstrip__lbl, .sc-cmpx__card .sc-cohstrip__val, .sc-cmpx__ttl")).filter((e) => e.scrollWidth > e.clientWidth + 0.5).map((e) => e.textContent),
          cards: Array.from(document.querySelectorAll(".sc-cmpx__card")).map((c) => ({ view: c.querySelector(".sc-cmpx__ttl").textContent, scale: c.querySelector(".sc-cmpx__sub").textContent, unfolded: c.classList.contains("is-exp"),
            none: (c.querySelector(".sc-cmpx__none") || {}).textContent || null,
            bars: Array.from(c.querySelectorAll(".sc-cohstrip__col")).map((x) => (x.querySelector(".sc-cohstrip__lbl") || {}).textContent + " " + (x.querySelector(".sc-cohstrip__val") || {}).textContent) })) };
      });
      P.live = await read(); P.shotPane = await shot("cmp-1-as-it-opens");
      P.firstHover = await page.evaluate(() => document.querySelector('.sc-cmpx__card[data-cmpx="BLEND"] .sc-cohstrip__col').getAttribute("title"));
      P.breadthHover = await page.evaluate(() => document.querySelector('.sc-cmpx__card[data-cmpx="BOWTIE"] .sc-cohstrip__col').getAttribute("title"));
      /* scroll the row to its middle and to its end: every card is on it */
      await page.evaluate(() => { const s = document.getElementById("cmpxScroll"); s.scrollLeft = (s.scrollWidth - s.clientWidth) / 2; }); await sleep(500); P.shotMid = await shot("cmp-2-scrolled-middle");
      await page.evaluate(() => { const s = document.getElementById("cmpxScroll"); s.scrollLeft = s.scrollWidth; }); await sleep(500); P.shotEnd = await shot("cmp-3-scrolled-end");
      /* a feed tick repaints the cards: the row must stay where it was */
      P.keepsPlace = await page.evaluate(() => { const s = document.getElementById("cmpxScroll"); const x = s.scrollLeft; updateBoard(); cohComparePaint(); return { before: Math.round(x), after: Math.round(document.getElementById("cmpxScroll").scrollLeft) }; });
      /* a click on a cohort's bar switches the board and REBUILDS this pane: the row must come back where it was */
      if (W >= 500) {
        const was = await page.evaluate(() => S.coh);
        await page.evaluate(() => { document.querySelector('.sc-cmpx__card[data-cmpx="COHORTS"]').scrollIntoView({ inline: "start", block: "nearest" }); }); await sleep(600);
        const x0 = await page.evaluate(() => Math.round(document.getElementById("cmpxScroll").scrollLeft));
        await page.click('.sc-cmpx__card[data-cmpx="COHORTS"] .sc-cohstrip__col[data-key="METALS"]'); await sleep(4000);
        P.cohortClick = await page.evaluate((x0) => ({ board: S.coh, rows: document.querySelectorAll(".sc-board__row").length, rowBefore: x0, rowAfter: Math.round(document.getElementById("cmpxScroll").scrollLeft),
          marked: !!document.querySelector('.sc-cmpx__card[data-cmpx="COHORTS"] .sc-cohstrip__col.is-active[data-key="METALS"]') }), x0);
        P.shotCohortClick = await shot("cmp-3b-after-a-cohort-click");
        await page.click('[data-act="coh"][data-key="' + was + '"]'); await sleep(3500);
      }
      await page.evaluate(() => { document.getElementById("cmpxScroll").scrollLeft = 0; }); await sleep(300);
      /* full screen (the page's own ⛶), then State Street unfolded */
      await page.click("#cmpxBar .sc-fsico"); await sleep(1200);
      P.full = await read(); P.shotFull = await shot("cmp-4-full-screen");
      await page.evaluate(() => { const s = document.getElementById("cmpxScroll"); s.scrollLeft = s.scrollWidth; }); await sleep(500); P.shotFullEnd = await shot("cmp-5-full-screen-scrolled-end");
      await page.evaluate(() => { document.getElementById("cmpxScroll").scrollLeft = 0; });
      await page.evaluate(() => { document.querySelector('[data-act="cmpxexp"][data-v="SPDR"]').scrollIntoView({ inline: "center", block: "nearest" }); });
      await page.click('[data-act="cmpxexp"][data-v="SPDR"]'); await sleep(700);
      await page.evaluate(() => { document.querySelector('.sc-cmpx__card[data-cmpx="SPDR"]').scrollIntoView({ inline: "start", block: "nearest" }); }); await sleep(400);
      P.unfolded = await page.evaluate(() => { const c = document.querySelector('.sc-cmpx__card[data-cmpx="SPDR"]'); return { unfolded: c.classList.contains("is-exp"), width: Math.round(c.getBoundingClientRect().width),
        words: Array.from(c.querySelectorAll(".sc-cohstrip__read")).filter((e) => e.offsetParent !== null).map((e) => e.textContent).slice(0, 11), pairs: Array.from(c.querySelectorAll(".sc-cohstrip__tm")).filter((e) => e.offsetParent !== null).map((e) => e.textContent).slice(0, 11) }; });
      P.shotUnfolded = await shot("cmp-6-state-street-unfolded");
      await page.click('[data-act="cmpxexp"][data-v="SPDR"]'); await sleep(500);                    // fold it back: the picture run leaves nothing remembered
      await page.evaluate(() => { document.getElementById("cmpxScroll").scrollLeft = 0; });
      /* REPLAY from the second handle: scrub back about four weeks, look, play three seconds, pause, back to live */
      P.barBefore = await page.evaluate(() => cmpxBarState());
      await page.evaluate(() => { const s = document.getElementById("cmpxSc"); s.value = Math.round((+s.max - 20 * 20) / 20) * 20; s.dispatchEvent(new Event("input", { bubbles: true })); });
      await sleep(4500);
      P.rewound = await read();
      P.rewoundBar = await page.evaluate(() => ({ second: cmpxBarState(), boardStamp: document.getElementById("gwxDt").textContent, boardThumb: +document.getElementById("gwxSc").value, thisThumb: +document.getElementById("cmpxSc").value, liveChipShown: !document.getElementById("cmpxLive").hidden }));
      P.rewoundHover = await page.evaluate(() => document.querySelector('.sc-cmpx__card[data-cmpx="BLEND"] .sc-cohstrip__col').getAttribute("title"));
      P.shotRewound = await shot("cmp-7-replay-four-weeks-back");
      await page.click("#cmpxPlay"); await sleep(3200);
      P.playing = await page.evaluate(() => ({ second: document.getElementById("cmpxPlay").textContent, board: document.getElementById("gwxPlay").textContent, day: SC_ASOF(), thisThumb: Math.round(+document.getElementById("cmpxSc").value), boardThumb: Math.round(+document.getElementById("gwxSc").value) }));
      P.shotPlaying = await shot("cmp-8-replay-playing");
      await page.click("#cmpxPlay"); await sleep(500);
      P.paused = await page.evaluate(() => ({ second: document.getElementById("cmpxPlay").textContent, day: SC_ASOF() }));
      await page.click("#cmpxLive"); await sleep(1800);
      P.backToLive = await page.evaluate(() => ({ day: SC_ASOF(), stamp: document.getElementById("cmpxDt").textContent, liveChipShown: !document.getElementById("cmpxLive").hidden, firstCard: document.querySelector('.sc-cmpx__card[data-cmpx="BLEND"] .sc-cmpx__sub').textContent }));
      await page.click("#cmpxBar .sc-fsico"); await sleep(900);                                       // leave full screen
    }
  }

  /* ── 2 · the Geiger bar in search and in LIKED ───────────────────────────────────────────────────── */
  if (PARTS.includes("bar") && W >= 500) {
    const P = (out.parts.bar = { name: NAME });
    const rowOf = () => page.evaluate((t) => {
      const r = Array.from(document.querySelectorAll('.sc-board__row[data-t="' + t + '"]')).filter((x) => x.offsetParent !== null)[0]; if (!r) return null;
      r.scrollIntoView({ block: "center" });
      const i = r.querySelector(".sc-gmini i"), tr = r.querySelector(".sc-gmini").getBoundingClientRect(), b = r.getBoundingClientRect(), ib = i ? i.getBoundingClientRect() : null;
      return { geiger: +r.getAttribute("data-sc-geiger"), barWidthCss: i ? i.style.width : null, barPx: ib ? +ib.width.toFixed(1) : 0, halfTrackPx: +(tr.width / 2).toFixed(1), shareOfHalf: ib ? +(ib.width / (tr.width / 2)).toFixed(3) : 0,
        rowsOnScreen: document.querySelectorAll(".sc-board__row").length, clip: { x: Math.max(0, b.x - 4), y: Math.max(0, b.y - 46), width: Math.min(innerWidth - Math.max(0, b.x - 4), b.width + 8), height: b.height + 60 } };
    }, NAME);
    if (!(await page.locator("#cohSearchInput").isVisible())) { await page.click("#headSearchBtn"); await page.waitForSelector("#cohSearchInput", { state: "visible", timeout: 8000 }); }
    await page.fill("#cohSearchInput", NAME);
    await page.waitForFunction((t) => document.querySelectorAll('.sc-board__row[data-t="' + t + '"]').length > 0, NAME, { timeout: 20000 }); await sleep(1200);
    P.inSearch = await rowOf(); await sleep(300); P.inSearch = await rowOf(); P.shotSearch = await shot("bar-1-in-search", P.inSearch.clip);
    if (!(await page.locator("#cohSearchInput").isVisible())) { await page.click("#headSearchBtn"); await page.waitForSelector("#cohSearchInput", { state: "visible", timeout: 8000 }); }
    await page.fill("#cohSearchInput", ""); await sleep(1200);
    await page.click('[data-act="coh"][data-key="FAV"]'); await page.waitForFunction((t) => document.querySelectorAll('.sc-board__row[data-t="' + t + '"]').length > 0 && document.querySelectorAll(".sc-board__row").length > 60, NAME, { timeout: 40000 }); await sleep(2500);
    P.inLiked = await rowOf(); await sleep(400); P.inLiked = await rowOf(); P.shotLiked = await shot("bar-2-in-liked", P.inLiked.clip);
    P.strongestInLiked = await page.evaluate(() => Math.max(...Array.from(document.querySelectorAll(".sc-board__row[data-sc-geiger]")).map((r) => Math.abs(+r.getAttribute("data-sc-geiger")))));
    delete P.inSearch.clip; delete P.inLiked.clip;
    await page.click('[data-act="coh"][data-key="FAVORITES"]'); await sleep(2500);
  }

  /* ── 3 · the company view's chart: is its right side cut, and does the hover carry its percent ───── */
  if (PARTS.includes("chart")) {
    const P = (out.parts.chart = { name: NAME, modes: {} });
    await page.evaluate((t) => { const r = document.querySelector('#boardScroll .sc-board__row[data-t="' + t + '"] .sc-ctk'); if (r) r.scrollIntoView({ block: "center" }); }, NAME); await sleep(300);
    await page.click('#boardScroll .sc-board__row[data-t="' + NAME + '"] .sc-ctk'); await sleep(8000);
    for (const mode of W >= 500 ? ["collapsed", "expanded"] : ["phone"]) {
      if (mode === "expanded") { await page.click('[data-act="coexpand"]'); await sleep(6500); }
      await page.evaluate(() => document.getElementById("coChartFrame").scrollIntoView({ block: "center" })); await sleep(500);
      const box = await page.evaluate(() => { const b = document.getElementById("coChartFrame").getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; });
      const fr = page.frames().find((f) => /station\.scintillahub\.ai\/chart\//.test(f.url()));
      const M = (P.modes[mode] = { frameUrl: fr ? fr.url() : null });
      M.hub = await page.evaluate(() => {
        const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right)]; }, q = (s) => document.querySelector(s);
        const f = document.getElementById("coChartFrame"), fb = f.getBoundingClientRect(), over = [];
        for (const dx of [3, 20, 45, 70, 100]) for (const fy of [0.12, 0.5, 0.8, 0.93]) { const e = document.elementFromPoint(fb.right - dx, fb.top + fb.height * fy); if (e && e !== f) over.push((e.id || e.className || e.tagName).toString().slice(0, 40)); }
        return { zoom: getComputedStyle(document.body).zoom, panel: r(q("#leftPanel")), chartBox: r(q(".cv-chart")), frame: r(f), tabsPanel: r(q(".cv-side")), frameWidthCss: f.clientWidth, coveredBy: Array.from(new Set(over)) };
      });
      M.shotRest = await shot("chart-" + mode + "-1-at-rest", box);
      /* the pointer on the price, then on the oscillator: what the pane itself drew */
      for (const [fy, tag] of [[0.33, "price"], [0.86, "oscillator"]]) {
        await page.mouse.move(box.x + box.width * 0.48, box.y + box.height * fy); await sleep(250);
        await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * fy); await sleep(1000);
        M[tag] = await fr.evaluate(() => { const host = Array.from(CHART_HOSTS)[0], d = host._rsiDrawn || {}, T = host._levelTag;
          return { paneWidth: innerWidth, hubPane: typeof HUB_PANE !== "undefined" ? HUB_PANE : null, canvasWidth: Math.round(host.querySelector("canvas").getBoundingClientRect().width),
            hoverLabel: T ? { price: T.price, percent: T.pct, left: Math.round(T.x), right: Math.round(T.x + T.w), insidePane: T.x >= 0 && T.x + T.w <= innerWidth } : null,
            oscillatorReadout: d.hover ? d.hover.join(" ") : null }; });
        M["shot" + tag[0].toUpperCase() + tag.slice(1)] = await shot("chart-" + mode + "-2-pointer-on-" + tag, box);
      }
      await page.mouse.move(4, 4); await sleep(300);
    }
  }
} catch (e) { out.error = String((e && e.stack) || e).slice(0, 1200); console.error(out.error); }
finally {
  out.requests = { stoppedNonGet: count.blocked, stoppedWhat: Array.from(new Set(count.blockedList)), branchFilesServed: count.servedLocal };
  out.consoleErrors = count.consoleErrors.slice(0, 10);
  const f = path.join(D, "data", `capture-${WHICH}-${W}.json`);
  let prev = {}; try { prev = JSON.parse(fs.readFileSync(f, "utf8")); } catch (_) {}
  out.parts = Object.assign({}, prev.parts || {}, out.parts);
  fs.writeFileSync(f, JSON.stringify(out, null, 1));
  await h.close();
}
console.log(WHICH, W, "page", out.pageSha, "parts", Object.keys(out.parts).join(","), "· non-GET stopped", out.requests.stoppedNonGet, "· console errors", out.consoleErrors.length, out.error ? "· ERROR" : "");

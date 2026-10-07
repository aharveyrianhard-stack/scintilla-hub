// HC2 — the window widths BETWEEN the ones the brief names (1680, 1440, 1280, 390): where the page's own zoom steps
// (1400, 1920), where the bars-to-a-row rule switches (1279), where the dashboard stacks (901 → 900), the old strip's
// breakpoint (821), and a small phone (360). At each: the cards folded, four unfolded, full screen, full screen with
// three unfolded. Read: any px that can only be reached by scrolling sideways, any name / number / word cut short, any
// card whose content runs over its own box. Writes data/edge-widths.json. Headless; non-GET stopped (HC1's rig).
//   node deliverables/20261007/hc2-compare-stacked/tools/edge-widths.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { openHub, sleep, REPO } from "../../../20261006/hc1-compare-one-screen/tools/rig.mjs";

const D = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SIZES = [[1920, 1080], [1400, 900], [1279, 800], [1100, 800], [901, 800], [821, 800], [360, 780]];

async function one([W, H]) {
  const h = await openHub({ width: W, height: H, local: REPO });
  const { page, count } = h, out = { width: W, height: H, states: [] };
  const read = (state) => page.evaluate((state) => {
    const sc = document.getElementById("cmpxScroll"), q = (s) => document.querySelector(s), over = (e) => (e ? Math.max(0, e.scrollWidth - e.clientWidth) : 0);
    const zoom = +getComputedStyle(document.body).zoom || 1, cards = Array.from(document.querySelectorAll(".sc-cmpx__card")), vis = (e) => e.offsetParent !== null;
    const rows = (c) => new Set(Array.from(c.querySelectorAll(".sc-vmini")).map((v) => Math.round(v.getBoundingClientRect().top))).size;
    return { state, bodyZoom: zoom, listCssPx: [sc.clientWidth, sc.clientHeight],
      sidewaysPx: Math.max(0, document.documentElement.scrollWidth - innerWidth) + over(q("#main")) + over(q("#layer0")) + over(q("#l0body")) + over(q("#cohCompare")) + over(sc) + cards.reduce((t, c) => t + over(c), 0),
      cut: Array.from(document.querySelectorAll(".sc-cmpx__card .sc-cohstrip__lbl, .sc-cmpx__card .sc-cohstrip__val, .sc-cmpx__ttl, .sc-cmpx__sub, .sc-cmpx__card .sc-cohstrip__read, .sc-cmpx__card .sc-cohstrip__tm, .sc-cmpx__card .sc-cohstrip__n"))
        .filter(vis).filter((e) => e.scrollWidth > e.clientWidth + 0.5).map((e) => e.textContent),
      cardsRunningOverTheirBox: cards.filter((c) => c.scrollHeight > c.clientHeight + 1).map((c) => c.dataset.cmpx),
      cardsToALine: Math.max(...Object.values(cards.reduce((m, c) => { const t = Math.round(c.getBoundingClientRect().top); m[t] = (m[t] || 0) + 1; return m; }, {}))),
      cards: cards.map((c) => ({ id: c.dataset.cmpx, unfolded: c.classList.contains("is-exp"), cssPx: [+(c.getBoundingClientRect().width / zoom).toFixed(1), +(c.getBoundingClientRect().height / zoom).toFixed(1)], rowsOfBars: rows(c),
        columnCssPx: c.querySelector(".sc-cohstrip__col") ? +(c.querySelector(".sc-cohstrip__col").getBoundingClientRect().width / zoom).toFixed(1) : null })) };
  }, state);
  try {
    await page.waitForFunction(() => typeof LISTS_READ !== "undefined" && LISTS_READ && document.querySelectorAll(".sc-board__row").length > 5, null, { timeout: 90000 }); await sleep(3000);
    const sel = '[data-act="l0tab"][data-tab="COHORT"]';
    await page.evaluate((s) => { document.querySelector(s).scrollIntoView({ block: "start" }); window.scrollBy(0, -8); }, sel);
    await page.click(sel); await sleep(1200);
    await page.waitForFunction(() => typeof SC_BLEND !== "undefined" && SC_BLEND.at > 0, null, { timeout: 60000 }); await sleep(1200);
    out.pageSha = await page.evaluate(async () => { const b = await (await fetch(location.href)).arrayBuffer(); const d = await crypto.subtle.digest("SHA-256", b); return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 12); });
    out.states.push(await read("folded"));
    /* unfolded through the page's own set and painter (the ⤢ of each), not remembered: the set is cleared again below */
    await page.evaluate(() => { for (const id of ["SPDR", "COHORTS", "MEMBERS", "INDEXES"]) CMPX_EXP.add(id); cohComparePaint(); }); await sleep(700);
    out.states.push(await read("State Street, COHORTS, OUR NAMES and INDEX FUNDS unfolded"));
    await page.evaluate(() => { CMPX_EXP.clear(); cohComparePaint(); }); await sleep(400);
    await page.click("#cmpxBar .sc-fsico"); await sleep(1000);
    out.states.push(await read("full screen"));
    await page.evaluate(() => { for (const id of ["SPDR", "ISHARES", "COHORTS"]) CMPX_EXP.add(id); cohComparePaint(); }); await sleep(700);
    out.states.push(await read("full screen, State Street, iSHARES and COHORTS unfolded"));
    await page.evaluate(() => { CMPX_EXP.clear(); cohComparePaint(); });
  } catch (e) { out.error = String((e && e.stack) || e).slice(0, 600); }
  finally { out.requests = { stoppedNonGet: count.blocked }; out.consoleErrors = count.consoleErrors.slice(0, 5); await h.close(); }
  return out;
}

const runs = [];
for (let i = 0; i < SIZES.length; i += 4) runs.push(...await Promise.all(SIZES.slice(i, i + 4).map(one)));
const all = { at: new Date().toISOString(), runs };
fs.writeFileSync(path.join(D, "data", "edge-widths.json"), JSON.stringify(all, null, 1) + "\n");
for (const r of runs) console.log(r.width + " × " + r.height, "page", r.pageSha, r.error ? "ERROR " + r.error : "", r.states.map((s) => s.cardsToALine + "/line sideways " + s.sidewaysPx + " cut " + JSON.stringify(s.cut) + " over " + JSON.stringify(s.cardsRunningOverTheirBox)).join(" | "));

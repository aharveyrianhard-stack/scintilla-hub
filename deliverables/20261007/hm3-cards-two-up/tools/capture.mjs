// HM3 (cards) — the pictures and the measurements behind them: the compare cards three to a view (live) → two to a view.
//   before = the Hub as deployed (https://scintillahub.ai/)        after = this branch's files served at the same address
// Headless only; ONE page at a time (each browser is closed before the next opens); every request that is not a GET is
// stopped and counted (HC1's rig.mjs). Nothing is written anywhere but this folder.
//   node deliverables/20261007/hm3-cards-two-up/tools/capture.mjs                 every size below, one after the other
//   node deliverables/20261007/hm3-cards-two-up/tools/capture.mjs after 1680      one size
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { openHub, sleep, REPO } from "../../../20261006/hc1-compare-one-screen/tools/rig.mjs";

const D = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SHOTS = path.join(D, "shots"), DATA = path.join(D, "data");
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(DATA, { recursive: true });
/* the sizes the brief names (pictured and measured in full), then the widths in between (measured): where the page's own
   zoom steps (1920, 1400), where the bars-to-a-row rule switches (1279), where the dashboard stacks (901), the phone
   sheet's edge (821 is the last width with two to a view, 820 the first with three) and a small phone (360) */
const NAMED = [["before", 1680, 1050], ["before", 390, 844], ["after", 1680, 1050], ["after", 1680, 940], ["after", 1440, 900], ["after", 1280, 800], ["after", 390, 844]];
const BETWEEN = [[1920, 1080], [1400, 900], [1279, 800], [1100, 800], [901, 800], [821, 800], [820, 800], [360, 780]];

const read = (page) => page.evaluate(() => {
  const q = (s) => document.querySelector(s), sc = q("#cmpxScroll"), cc = q("#cohCompare"), zoom = +getComputedStyle(document.body).zoom || 1;
  const over = (e) => (e ? Math.max(0, e.scrollWidth - e.clientWidth) : 0), L = sc.getBoundingClientRect(), vis = (e) => e.offsetParent !== null;
  const cards = Array.from(document.querySelectorAll(".sc-cmpx__card")).map((c) => {
    const b = c.getBoundingClientRect(), tr = c.querySelector(".sc-vmini"), col = c.querySelector(".sc-cohstrip__col");
    const seen = Math.max(0, Math.min(b.bottom, L.bottom) - Math.max(b.top, L.top)) * Math.max(0, Math.min(b.right, L.right) - Math.max(b.left, L.left));
    return { id: c.dataset.cmpx, view: c.querySelector(".sc-cmpx__ttl").textContent, unfolded: c.classList.contains("is-exp"),
      cssPx: [+(b.width / zoom).toFixed(1), +(b.height / zoom).toFixed(1)], shareOfListHeight: +(b.height / L.height).toFixed(3), shown: +(seen / (b.width * b.height || 1)).toFixed(2),
      barTrackCssPx: tr ? +(tr.getBoundingClientRect().height / zoom).toFixed(1) : null, columnCssPx: col ? +(col.getBoundingClientRect().width / zoom).toFixed(1) : null,
      rowsOfBars: new Set(Array.from(c.querySelectorAll(".sc-vmini")).map((v) => Math.round(v.getBoundingClientRect().top))).size,
      runsOverItsBox: c.scrollHeight > c.clientHeight + 1,
      bars: Array.from(c.querySelectorAll(".sc-cohstrip__col")).map((x) => (x.querySelector(".sc-cohstrip__lbl") || {}).textContent + " " + (x.querySelector(".sc-cohstrip__val") || {}).textContent) };
  });
  return { bodyZoom: zoom, viewport: [innerWidth, innerHeight], fullScreen: !!q(".sc-layer0.sc-secfs"),
    rowsVar: getComputedStyle(sc).getPropertyValue("--cmpx-rows").trim(), colsVar: getComputedStyle(sc).getPropertyValue("--cmpx-cols").trim(),
    listCssPx: [sc.clientWidth, sc.clientHeight], listWholeCssPx: [sc.scrollWidth, sc.scrollHeight], listTop: Math.round(sc.scrollTop), overflowX: getComputedStyle(sc).overflowX,
    sidewaysPx: Math.max(0, document.documentElement.scrollWidth - innerWidth) + over(q("#main")) + over(q("#layer0")) + over(q("#l0body")) + over(cc) + over(sc) + cards.length * 0 +
      Array.from(document.querySelectorAll(".sc-cmpx__card")).reduce((t, c) => t + over(c), 0),
    cut: Array.from(document.querySelectorAll(".sc-cmpx__card .sc-cohstrip__lbl, .sc-cmpx__card .sc-cohstrip__val, .sc-cmpx__ttl, .sc-cmpx__sub, .sc-cmpx__card .sc-cohstrip__read, .sc-cmpx__card .sc-cohstrip__tm, .sc-cmpx__card .sc-cohstrip__n"))
      .filter(vis).filter((e) => e.scrollWidth > e.clientWidth + 0.5).map((e) => e.textContent),
    cardsToALine: Math.max(...Object.values(Array.from(document.querySelectorAll(".sc-cmpx__card")).reduce((m, c) => { const t = Math.round(c.getBoundingClientRect().top); m[t] = (m[t] || 0) + 1; return m; }, {}))),
    cardsFullyShown: cards.filter((c) => c.shown >= 0.98).map((c) => c.view), cardsPartlyShown: cards.filter((c) => c.shown > 0.02 && c.shown < 0.98).map((c) => c.view),
    cards };
});
const slim = (r) => { const c = JSON.parse(JSON.stringify(r)); c.cards.forEach((x) => { delete x.bars; }); return c; };

async function open(which, W, H) {
  const h = await openHub({ width: W, height: H, local: which === "before" ? null : REPO });
  const { page } = h;
  await page.waitForFunction(() => typeof LISTS_READ !== "undefined" && LISTS_READ && document.querySelectorAll(".sc-board__row").length > 5, null, { timeout: 90000 }); await sleep(3000);
  const sel = '[data-act="l0tab"][data-tab="COHORT"]';
  await page.evaluate((s) => { document.querySelector(s).scrollIntoView({ block: "start" }); window.scrollBy(0, -8); }, sel);
  await page.click(sel); await sleep(1300);
  await page.evaluate((s) => { document.querySelector(s).scrollIntoView({ block: "start" }); window.scrollBy(0, -8); }, sel);
  await page.waitForFunction(() => typeof SC_BLEND !== "undefined" && SC_BLEND.at > 0, null, { timeout: 60000 }); await sleep(1300);
  const pageSha = await page.evaluate(async () => { const b = await (await fetch(location.href)).arrayBuffer(); const d = await crypto.subtle.digest("SHA-256", b); return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 12); });
  return { h, page, pageSha };
}
const unfold = (page, ids) => page.evaluate((ids) => { CMPX_EXP.clear(); for (const id of ids) CMPX_EXP.add(id); cohComparePaint(); }, ids);
/* a screen of the list down: the list's own height, as a wheel or a finger would take it, then where its snap leaves it */
const down = async (page) => { await page.evaluate(() => { const s = document.getElementById("cmpxScroll"); s.scrollTop += s.clientHeight; }); await sleep(700); };

async function named([which, W, H]) {
  const std = W < 500 ? 844 : W >= 1680 ? 1050 : W >= 1440 ? 900 : 800, tag = H === std ? String(W) : W + "x" + H;
  const out = { which, width: W, height: H, at: new Date().toISOString(), steps: {} };
  const { h, page, pageSha } = await open(which, W, H);
  const shot = async (name) => { const f = `${name}-${which}-${tag}.png`; await page.screenshot({ path: path.join(SHOTS, f) }); return f; };
  try {
    out.pageSha = pageSha;
    const S = out.steps, first = await read(page);
    S.opens = slim(first); S.opens.shot = await shot("1-as-it-opens");
    out.numbers = first.cards.map((c) => ({ view: c.view, bars: c.bars }));     // every number on every card: before and after must print the same
    await down(page); S.oneScreenDown = slim(await read(page)); S.oneScreenDown.shot = await shot("2-one-screen-down");
    await page.evaluate(() => { const s = document.getElementById("cmpxScroll"); s.scrollTop = s.scrollHeight; }); await sleep(700);
    S.atTheEnd = slim(await read(page)); S.atTheEnd.shot = await shot("3-at-the-end");
    if (which === "after") {
      await page.evaluate(() => { document.getElementById("cmpxScroll").scrollTop = 0; });
      await unfold(page, ["SPDR", "COHORTS", "MEMBERS", "INDEXES"]); await sleep(700);
      S.unfolded = slim(await read(page));
      await page.evaluate(() => { const c = document.querySelector('.sc-cmpx__card[data-cmpx="SPDR"]'), s = document.getElementById("cmpxScroll"); s.scrollTop = c.offsetTop - 6; }); await sleep(600);
      S.unfolded.shot = await shot("4-state-street-unfolded");
      await unfold(page, []); await sleep(400);
      await page.evaluate(() => { document.getElementById("cmpxScroll").scrollTop = 0; });
      await page.click("#cmpxBar .sc-fsico"); await sleep(1200);
      S.fullScreen = slim(await read(page)); S.fullScreen.shot = await shot("5-full-screen");
    }
  } catch (e) { out.error = String((e && e.stack) || e).slice(0, 600); }
  finally { out.requests = { stoppedNonGet: h.count.blocked }; out.consoleErrors = h.count.consoleErrors.slice(0, 5); await h.close(); }
  fs.writeFileSync(path.join(DATA, `capture-${which}-${tag}.json`), JSON.stringify(out, null, 1) + "\n");
  const o = out.steps.opens || {};
  console.log(which, tag, "page", out.pageSha, out.error ? "ERROR " + out.error : "", "| rows", o.rowsVar, "| list", JSON.stringify(o.listCssPx), "| card", JSON.stringify(o.cards && o.cards[0].cssPx), "share", o.cards && o.cards[0].shareOfListHeight,
    "| shown", JSON.stringify(o.cardsFullyShown), "| sideways", o.sidewaysPx, "cut", JSON.stringify(o.cut), "| stopped", out.requests.stoppedNonGet, "errors", out.consoleErrors.length);
  return out;
}

async function between([W, H]) {
  const out = { width: W, height: H, states: [] };
  const { h, page, pageSha } = await open("after", W, H);
  try {
    out.pageSha = pageSha;
    const st = async (state) => { const r = slim(await read(page)); r.state = state; out.states.push(r); };
    await st("folded");
    await unfold(page, ["SPDR", "COHORTS", "MEMBERS", "INDEXES"]); await sleep(700); await st("State Street, COHORTS, OUR NAMES and INDEX FUNDS unfolded");
    await unfold(page, []); await sleep(400);
    await page.click("#cmpxBar .sc-fsico"); await sleep(1000); await st("full screen");
  } catch (e) { out.error = String((e && e.stack) || e).slice(0, 600); }
  finally { out.requests = { stoppedNonGet: h.count.blocked }; out.consoleErrors = h.count.consoleErrors.slice(0, 5); await h.close(); }
  console.log(W + " × " + H, "page", out.pageSha, out.error ? "ERROR " + out.error : "", out.states.map((s) => s.rowsVar + " rows, " + s.cardsToALine + "/line, share " + s.cards[0].shareOfListHeight + ", shown " + s.cardsFullyShown.length +
    ", sideways " + s.sidewaysPx + ", cut " + JSON.stringify(s.cut) + ", over " + JSON.stringify(s.cards.filter((c) => c.runsOverItsBox).map((c) => c.id))).join(" | "));
  return out;
}

const [a1, a2, a3] = process.argv.slice(2);
if (a1 === "between") {
  const runs = []; for (const s of BETWEEN) runs.push(await between(s));                 // one page at a time
  fs.writeFileSync(path.join(DATA, "between-widths.json"), JSON.stringify({ at: new Date().toISOString(), runs }, null, 1) + "\n");
} else if (a1) {
  await named([a1, +a2 || 1680, +a3 || ((+a2 || 1680) < 500 ? 844 : (+a2 || 1680) >= 1680 ? 1050 : (+a2 || 1680) >= 1440 ? 900 : 800)]);
} else {
  for (const s of NAMED) await named(s);                                                  // one page at a time
}

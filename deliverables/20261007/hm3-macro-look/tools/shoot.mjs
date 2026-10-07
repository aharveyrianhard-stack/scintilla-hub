// HM3 — the pictures of the macro cards, before (HM2's look) and after (the slider's look), and what was read off them.
// Headless only, never a window; ONE page at a time (each browser is closed before the next opens); every request that
// is not a GET is stopped and counted. The page is opened at https://scintillahub.ai/#economic (the only address the
// chart API answers) and that address is answered with a local page:
//     before = HM2's page (branch hub/hm2-macro-20261007 @ca8e0dc, read out of git)      after = this branch's index.html
// Every read on screen is the real one, except public.treasury_auctions, which does not exist yet: it is answered from
// HM2's own file of Treasury's rows (deliverables/20261007/hm2-macro/data/treasury-auctions.json), as HM2's pictures were.
//     option = this branch's page with its one switch thrown (HM3_CURVE_FIRST = true): the curve and the auctions first on the rail
//   node deliverables/20261007/hm3-macro-look/tools/shoot.mjs                 all five, one after the other
//   node deliverables/20261007/hm3-macro-look/tools/shoot.mjs after 1680      one
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");

const D = path.dirname(path.dirname(fileURLToPath(import.meta.url))), REPO = path.resolve(D, "..", "..", "..");
const SHOTS = path.join(D, "shots"), DATA = path.join(D, "data");
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(DATA, { recursive: true });
const HM2_SHA = "ca8e0dc";
const AUCTIONS = fs.readFileSync(path.join(REPO, "deliverables/20261007/hm2-macro/data/treasury-auctions.json"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CARD = { event: "#hm2Event", curve: ".card:has(> #hm2Curve)", auctions: ".card:has(> #hm2Auctions)", prints: ".card:has(> #hm2Strips)" };

async function one(which, W) {
  const phone = W < 500, H = phone ? 844 : 1050, tag = which + "-" + W;
  let html = which === "before" ? execFileSync("git", ["-C", REPO, "show", HM2_SHA + ":index.html"], { maxBuffer: 64 << 20 }) : fs.readFileSync(path.join(REPO, "index.html"));
  if (which === "option") {
    /* THE OPTION: this branch's page with its one switch thrown — HM3_CURVE_FIRST = true — and nothing else changed */
    const src = html.toString("utf8"), off = "var HM3_CURVE_FIRST = false;";
    if (src.split(off).length !== 2) throw new Error("the switch is not on the page exactly once");
    html = Buffer.from(src.replace(off, "var HM3_CURVE_FIRST = true;"), "utf8");
  }
  const out = { which, width: W, height: H, at: new Date().toISOString(), page: which === "before" ? "hub/hm2-macro-20261007 @" + HM2_SHA : which === "option" ? "this branch's index.html with HM3_CURVE_FIRST = true" : "this branch's index.html", shots: [], facts: {} };
  const browser = await chromium.launch({ headless: true, args: ["--mute-audio"] });
  let blocked = 0; const errors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone, serviceWorkers: "block", timezoneId: "America/New_York", locale: "en-US" });
    await ctx.route("**/*", (route) => {
      const req = route.request(), url = req.url();
      if (req.method() !== "GET") { blocked++; return route.abort("blockedbyclient"); }
      if (/^https:\/\/scintillahub\.ai\/(index\.html)?(\?[^#]*)?$/.test(url.split("#")[0])) return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", headers: { "cache-control": "no-store" }, body: html });
      if (url.includes("/rest/v1/treasury_auctions")) return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*", "cache-control": "no-store", "content-range": "0-0/*" }, body: AUCTIONS });
      return route.continue();
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
    const shot = async (name, sel) => {
      const f = name + "-" + tag + ".png";
      if (sel) { const el = await page.$(sel); if (!el) { out.shots.push(name + ": NOT FOUND " + sel); return; } await el.screenshot({ path: path.join(SHOTS, f) }); }
      else await page.screenshot({ path: path.join(SHOTS, f) });
      out.shots.push(f);
    };
    /* bring a rail card to the top of the rail (or of the page, where the rail does not scroll by itself) */
    const toCard = (sel) => page.evaluate((sel) => {
      const c = document.querySelector(sel); if (!c) return false;
      const rail = c.closest(".rail");
      const zoom = +getComputedStyle(document.body).zoom || 1;                 /* a box is read in screen px, a scroll is set in the page's own */
      if (rail && rail.scrollHeight > rail.clientHeight + 2) rail.scrollTop += (c.getBoundingClientRect().top - rail.getBoundingClientRect().top) / zoom - 4;
      else c.scrollIntoView({ block: "start" });
      return true;
    }, sel);
    await page.goto("https://scintillahub.ai/#economic", { waitUntil: "load", timeout: 120000 });
    await page.waitForFunction(() => document.querySelector("#hm2Curve svg") && document.querySelector("#hm2Strips > div[title]") && document.querySelector("#hm2Auctions table, #hm2Auctions .hm3-row") &&
      typeof HM2_TL !== "undefined" && HM2_TL.rows && HM2_TL.rows.length > 10, null, { timeout: 90000 });
    await sleep(2500);
    /* the event card: today's FOMC minutes (the release Alan asked about), as a click on its row in the day table would pick it */
    out.facts.event = await page.evaluate(() => {
      const today = ecToday(), us = HM2_TL.rows.filter((r) => r.country === "US" && ecDateKey(+r.event_ts) === today);
      const r = us.find((x) => /^fomc minutes/i.test(ecBase(x.event))) || us.filter((x) => x.impact === "High").pop();
      if (!r) return null;
      HM2_EV.pick = { sub: ecBase(r.event), ets: +r.event_ts, cty: "US" }; hm2EventPaint();
      return ecBase(r.event) + " " + ecTimeET(+r.event_ts) + " ET";
    });
    await page.waitForFunction(() => { const h = document.getElementById("hm2Event"); return h && h.querySelector("a[href]"); }, null, { timeout: 30000 }).catch(() => {});
    await sleep(3500);                                              /* the headlines: one read of our news table */
    const railTop = () => page.evaluate(() => { const r = (document.querySelector("#hm2Curve") || document.body).closest(".rail"); if (r) r.scrollTop = 0; window.scrollTo(0, 0); });
    await railTop();
    if (phone) {
      /* a phone gives the rail a sliver under the calendar (as it does on the Hub today — pictured first, as it is); the
         rail is read through its own full-screen button, so that is how the cards are pictured */
      await shot("0-room-as-a-phone-opens-it");
      await page.click(".panel:has(#hm2Curve) .sc-plabel .sc-fsico"); await sleep(900); await railTop();
      out.facts.phoneRailFullScreen = await page.evaluate(() => !!document.querySelector(".sc-secfs, .is-secfs, [data-secfs]"));
    }
    const read = () => page.evaluate((CARD) => {
      const zoom = +getComputedStyle(document.body).zoom || 1, rail = (document.querySelector("#hm2Curve") || document.body).closest(".rail"), o = { bodyZoom: zoom, viewport: [innerWidth, innerHeight], railCssPx: rail ? [rail.clientWidth, rail.clientHeight] : null,
        railScrollsByItself: rail ? rail.scrollHeight > rail.clientHeight + 2 : null, sidewaysPx: Math.max(0, document.documentElement.scrollWidth - innerWidth) + (rail ? Math.max(0, rail.scrollWidth - rail.clientWidth) : 0), cards: {} };
      for (const [k, sel] of Object.entries(CARD)) {
        const c = document.querySelector(sel); if (!c) { o.cards[k] = null; continue; }
        const b = c.getBoundingClientRect(), txt = Array.from(c.querySelectorAll("span, b, i, a, th, td, h4, text, em")).filter((e) => e.offsetParent !== null || e instanceof SVGElement);
        o.cards[k] = { cssPx: [+(b.width / zoom).toFixed(0), +(b.height / zoom).toFixed(0)], sharePctOfRailHeight: rail && rail.clientHeight ? Math.round(b.height / zoom / rail.clientHeight * 100) : null,
          fitsInOneRailView: rail ? b.height / zoom <= rail.clientHeight : null, sidewaysPx: Math.max(0, c.scrollWidth - c.clientWidth),
          cut: txt.filter((e) => !(e instanceof SVGElement) && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== "visible").map((e) => e.textContent.slice(0, 40)).slice(0, 8),
          smallestTextPx: Math.min(...txt.filter((e) => e.textContent.trim()).map((e) => parseFloat(getComputedStyle(e).fontSize)).filter((x) => x > 0)),
          borders: Array.from(c.querySelectorAll("*")).filter((e) => { const s = getComputedStyle(e); return ["Top", "Right", "Bottom", "Left"].every((d) => parseFloat(s["border" + d + "Width"]) > 0) && e.getBoundingClientRect().height > 20; }).length,
          lines: c.querySelectorAll(".hm3-row:not(.hm3-ar--h)").length, text: c.innerText.replace(/\s+/g, " ").trim().slice(0, 700) };
      }
      return o;
    }, CARD);
    /* what the first view of the rail holds, as the room opens */
    const firstView = () => page.evaluate((CARD) => {
      const curve = document.querySelector(CARD.curve), auc = document.querySelector(CARD.auctions), ev = document.querySelector(CARD.event), rail = curve.closest(".rail");
      const zoom = +getComputedStyle(document.body).zoom || 1, R = rail.getBoundingClientRect();
      const seen = (c) => { const b = c.getBoundingClientRect(); return Math.round(Math.max(0, Math.min(R.bottom, b.bottom) - Math.max(R.top, b.top)) / zoom); };
      const whole = (c) => { const b = c.getBoundingClientRect(); return b.height > 0 && b.top >= R.top - 1 && b.bottom <= R.bottom + 1; };
      return { railScrollTop: rail.scrollTop, order: Array.from(rail.children).filter((c) => c.getBoundingClientRect().height > 0).slice(0, 6).map((c) => ((c.querySelector("h4") || c).firstChild || c).textContent.trim().slice(0, 22)),
        eventCardPx: Math.round(ev.getBoundingClientRect().height / zoom), curveWhole: whole(curve), curveShownPx: seen(curve), auctionsWhole: whole(auc), auctionsShownPx: seen(auc), auctionsPx: Math.round(auc.getBoundingClientRect().height / zoom) };
    }, CARD);
    if (which === "option") {
      out.facts.firstView = await firstView(); out.facts.cards = (await read()).cards;
      await shot("13-option-curve-first");                              /* with an event card above them */
      await page.evaluate((CARD) => { document.querySelector(CARD.event).style.display = "none"; }, CARD); await railTop(); await sleep(400);
      out.facts.firstViewNoEventCard = await firstView();
      await shot("14-option-curve-first-no-event-card");                /* as it is most of the day: nothing just released, so no event card */
      out.facts.title = await page.title(); await ctx.close();
      return finish();
    }
    out.facts.asItOpens = await read();
    await shot("1-room");                                           /* the room as it opens: the event card first on the rail */
    await shot("2-event", CARD.event);
    await toCard(CARD.curve); await sleep(400); await shot("3-room-at-the-curve");
    await toCard(CARD.auctions); await sleep(400); await shot("4-room-at-the-auctions");
    await toCard(CARD.prints); await sleep(400); await shot("5-room-at-the-prints");
    /* each card whole: the window is made tall, so the rail shows a card in full and the picture is not cut by the rail's own scroll */
    await page.setViewportSize({ width: W, height: phone ? 2600 : 3400 }); await sleep(900);
    await shot("6-curve", CARD.curve); await shot("7-auctions", CARD.auctions); await shot("8-prints", CARD.prints);
    if (which === "after") {
      await page.click('[data-hm3="auc"][data-k="10-Year"]'); await sleep(500);
      out.facts.auctionOpen = (await read()).cards.auctions; await shot("9-auctions-10y-open", CARD.auctions);
      await page.click('[data-hm3="auc"][data-k="10-Year"]'); await sleep(300);
      out.facts.auctionFoldedAgain = await page.evaluate(() => document.querySelectorAll("#hm2Auctions .hm3-open").length === 0);
      await page.click('[data-hm3="print"][data-k="Non Farm Payrolls"]'); await sleep(500);
      out.facts.printOpen = (await read()).cards.prints; await shot("10-prints-payrolls-open", CARD.prints);
      await page.click('[data-hm3="print"][data-k="Inflation Rate YoY"]'); await sleep(500);
      out.facts.oneOpenAtATime = await page.evaluate(() => Array.from(document.querySelectorAll("#hm2Strips .hm3-row.is-open")).map((r) => r.dataset.k));
      await shot("11-prints-cpi-open", CARD.prints);
      if (!phone) {
        /* back on the real screen: an opened term, as Alan would see it */
        await page.setViewportSize({ width: W, height: H }); await sleep(700);
        await page.click('[data-hm3="auc"][data-k="10-Year"]'); await sleep(400); await toCard(CARD.auctions); await sleep(400);
        await shot("12-room-auction-open");
        out.facts.onTheScreenOpen = await read();
        await page.click('[data-hm3="auc"][data-k="10-Year"]'); await sleep(300); await railTop(); await sleep(300);
        out.facts.firstView = await firstView();                       /* as built: what the first view of the rail holds as the room opens */
      }
    }
    out.facts.title = await page.title();
    await ctx.close();
  } catch (e) { out.error = String((e && e.stack) || e).slice(0, 700); }
  finally { await browser.close(); }
  return finish();
  function finish() {
  out.requests = { stoppedNonGet: blocked }; out.pageErrors = errors.slice(0, 6);
  fs.writeFileSync(path.join(DATA, "shoot-" + tag + ".json"), JSON.stringify(out, null, 1) + "\n");
  const c = (out.facts.asItOpens || {}).cards || out.facts.cards || {};
  console.log(tag, out.error ? "ERROR " + out.error : "", "| event", out.facts.event, "| rail", JSON.stringify((out.facts.asItOpens || {}).railCssPx), "| cards",
    Object.entries(c).map(([k, v]) => k + " " + (v ? v.cssPx.join("×") + (v.fitsInOneRailView ? "" : " (taller than the rail)") + " boxes " + v.borders + " min " + v.smallestTextPx + "px cut " + v.cut.length : "—")).join(" · "),
    "| stopped", blocked, "errors", errors.length, "| shots", out.shots.length, out.facts.firstView ? "| first view: curve whole " + out.facts.firstView.curveWhole + ", " + out.facts.firstView.curveShownPx + " px of it" : "");
  return out;
  }
}
const [a1, a2] = process.argv.slice(2);
if (a1) await one(a1, +a2 || 1680);
else for (const [w, x] of [["before", 1680], ["after", 1680], ["option", 1680], ["before", 390], ["after", 390]]) await one(w, x);   /* one page at a time */

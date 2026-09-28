/* SWITCH-ON (28 Sep) — one headless run per width over the switched-on Hub, walking the switch checklist.
   node proof.mjs <1680|390> [local|live]
   local = this worktree served under https://scintillahub.ai (the Station frame is the live Station), so the chart API
   sees its own origin and nothing is relaxed. /api/* GETs go to the live Hub. EVERY non-GET request is answered here
   with an empty 201 and recorded (method, host+path, body) — nothing is written anywhere. Never a visible window. */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const here = path.dirname(fileURLToPath(import.meta.url));
const HUB = path.resolve(here, "../../../..");
const W = +(process.argv[2] || 1680), TARGET = process.argv[3] || "local", mobile = W < 500;
const OUT = path.join(here, "..", "shots"); fs.mkdirSync(OUT, { recursive: true });
const CLIP = fs.readFileSync(path.join(here, "clip.js"), "utf8");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".woff2": "font/woff2" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function localFile(pathname) {
  let f = path.normalize(path.join(HUB, decodeURIComponent(pathname)));
  if (!f.startsWith(HUB)) return null;
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null;
}
const res = { width: W, target: TARGET, at: new Date().toISOString(), steps: {}, writes: [], errors: [] };
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
try {
  const ctx = await browser.newContext({ viewport: { width: W, height: mobile ? 844 : 1050 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block" });
  await ctx.addInitScript(() => { try { if (sessionStorage.getItem("proofInit")) return; sessionStorage.setItem("proofInit", "1"); localStorage.setItem("hub.company.expanded", "0"); localStorage.removeItem("hub.sector.family"); localStorage.setItem("hub.company.tab", "GEIGER"); } catch (_) {} });
  await ctx.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") {
      res.writes.push({ method: m, url: u.host + u.pathname, body: (req.postData() || "").slice(0, 300) });
      return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" });
    }
    if (TARGET === "local" && u.host === "scintillahub.ai" && !u.pathname.startsWith("/api/")) {
      const f = localFile(u.pathname);
      if (!f) return route.fulfill({ status: 404, body: "not found" });
      return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" }, body: fs.readFileSync(f) });
    }
    return route.continue();
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => res.errors.length < 30 && res.errors.push(String(e.message).slice(0, 200)));
  const tag = `${W}`;
  const shot = async (name, full) => { const f = path.join(OUT, `${tag}-${name}.png`); await page.screenshot({ path: f, fullPage: !!full }); return path.basename(f); };
  const ev = (js) => page.evaluate(js);
  const clickVis = (sel) => page.evaluate((s) => { const n = [...document.querySelectorAll(s)].find((x) => x.offsetParent !== null && x.getBoundingClientRect().width > 0); if (!n) return "none"; n.click(); return "ok"; }, sel);
  const P = `(() => { const q = (s) => document.querySelector(s), qa = (s) => [...document.querySelectorAll(s)];
    const vis = (n) => !!(n && n.offsetParent !== null && n.getBoundingClientRect().width > 0 && getComputedStyle(n).visibility !== "hidden");
    const txt = (n) => n ? n.innerText.replace(/\\s+/g, " ").trim().slice(0, 400) : null;
    return { sec: S.sec, leftT: LEFT_T, coTab: S.coTab, secfs: !!SECFS, bodyCls: document.body.className,
      head: vis(q("#headIdent")) ? txt(q("#headIdent")) : null, headx: vis(q('#headIdent [data-act="headx"]')),
      line: vis(q("#cvLine")) ? txt(q("#cvLine")) : null, facts: vis(q("#cvFacts")) ? txt(q("#cvFacts")) : null,
      tickerShown: qa(".sc-ctkbig, .cv-t").filter(vis).length,
      cohChip: qa("#cvLine .sc-cohwrap [aria-haspopup]").filter(vis).length, fsBtn: qa('#cvLine [data-act="secfs"]').filter(vis).length,
      tfs: qa('#cvLine [data-act="corange"]').filter(vis).map((b) => b.dataset.r + (b.classList.contains("on") ? "*" : "")),
      clouds: qa("#cvLine .cv-clouds").filter(vis).map((b) => b.getAttribute("aria-pressed")),
      lists: qa('[data-act="star"],[data-act="lst"]').filter((b) => vis(b) && (b.closest("#headIdent") || b.closest("#cvFacts"))).length,
      tabs: qa('#cvTabs [data-act="cotab"]').filter(vis).map((b) => b.dataset.tab),
      frame: (q("#coChartFrame") || {}).src || null,
      rail: vis(q("#cvRail")) ? qa("#cvRail .cv-rail__r").length : 0, board: vis(q("#boardScroll")) };
  })()`;
  const step = async (k, extra) => { res.steps[k] = Object.assign(await ev(P), extra || {}); return res.steps[k]; };

  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector('.sc-board__row[data-t="MU"]', { timeout: 60000 }).catch(() => {});
  await sleep(9000);
  /* BOARD + list B/C checks */
  res.steps.board = await ev(`(() => { const qa = (s) => [...document.querySelectorAll(s)]; const vis = (n) => !!(n && n.offsetParent !== null);
    return { tape: vis(document.querySelector("#topTape, .sc-toptape, [id*=opTape]")), usualTab: qa(".sc-mtab, [data-sec]").some((b) => /USUAL/.test(b.innerText || "")),
      boardUsualCol: qa(".sc-board__hdr, .sc-board__head, #boardHead").some((h) => /USUAL/.test(h.innerText || "")),
      listTabs: qa(".sc-cohtab, [data-act=coh]").filter(vis).map((b) => (b.innerText || "").trim()).filter((t) => /LIKED|FAVORITES|RADAR/.test(t)).slice(0, 3),
      scint: (document.querySelector("#scintStrip, .sc-scint, [id*=cint]") || {}).innerText?.replace(/\\s+/g, " ").slice(0, 160) || null,
      fmpDigests: (typeof SC_FMP_REFERENCE_DIGESTS !== "undefined") ? SC_FMP_REFERENCE_DIGESTS.slice(1, -1).split(",").map((d) => d.slice(0, 8)) : null,
      rsiCells: qa(".sc-board__row [data-col=rsi], .sc-board__row .sc-rsi").slice(0, 3).map((n) => n.innerText.trim()) }; })()`);
  res.steps.board.shot = await shot("board");
  res.steps.board.clipped = [].concat((await ev(CLIP)) || []).length;

  /* SECTORS: default family, OUR NAMES, remembered */
  await clickVis('[data-act="l0tab"][data-tab="COHORT"]'); await sleep(1500);
  await clickVis('[data-gwxcmp="SECTORS"]'); await sleep(1500);
  res.steps.sectors = await ev(`(() => ({ family: SECT_FAMILY, chips: [...document.querySelectorAll("[data-gwxfam]")].filter((b) => b.offsetParent).map((b) => b.innerText.trim() + (b.classList.contains("is-on") ? "*" : "")),
    hd: (document.querySelector(".sc-cohstrip__hd") || {}).innerText, cols: [...document.querySelectorAll("#cohStrip .sc-cohstrip__col")].map((c) => c.innerText.replace(/\\s+/g, " ").trim()).slice(0, 11) }))()`);
  const strip = await page.$("#cohCompare"); if (strip) { await strip.scrollIntoViewIfNeeded().catch(() => {}); res.steps.sectors.shot = path.basename(path.join(OUT, `${tag}-sectors-spdr.png`)); await strip.screenshot({ path: path.join(OUT, `${tag}-sectors-spdr.png`) }).catch(() => {}); }
  await clickVis('[data-gwxfam="MEMBERS"]'); await sleep(1200);
  res.steps.sectorsOurs = await ev(`(() => ({ family: SECT_FAMILY, stored: localStorage.getItem("hub.sector.family"), hd: (document.querySelector(".sc-cohstrip__hd") || {}).innerText,
    cols: [...document.querySelectorAll("#cohStrip .sc-cohstrip__col")].map((c) => c.getAttribute("title")).slice(0, 11) }))()`);
  if (strip) await strip.screenshot({ path: path.join(OUT, `${tag}-sectors-ournames.png`) }).catch(() => {});
  await clickVis('[data-gwxcmp="COHORTS"]'); await sleep(600);
  /* the family choice survives a reload */
  await page.reload({ waitUntil: "domcontentloaded" }); await page.waitForSelector('.sc-board__row[data-t="MU"]', { timeout: 60000 }).catch(() => {}); await sleep(6000);
  res.steps.sectorsReload = await ev(`({ family: SECT_FAMILY, stored: localStorage.getItem("hub.sector.family") })`);

  /* OPEN MU the way Alan does: a board row */
  const t0 = Date.now();
  await ev(`(() => { const r = document.querySelector('.sc-board__row[data-t="MU"]'); if (r) r.click(); else openCo("MU"); })()`);
  await sleep(10000);
  await step("opened", { ms: Date.now() - t0 });
  res.steps.opened.shot = await shot("MU-collapsed-GEIGER");
  res.steps.opened.williams = await ev(`(document.querySelector('[data-gs="wpr"]') || {}).innerText || null`);
  res.steps.opened.clipped = [].concat((await ev(CLIP)) || []).map((c) => c.path + " :: " + (c.text || "").slice(0, 60)).slice(0, 12);

  /* COHORT ▾ — open the menu, pick another cohort: the save is caught here and recorded, never sent */
  res.steps.cohort = { open: await clickVis("#cvLine .sc-cohwrap [aria-haspopup]") };
  await sleep(500);
  res.steps.cohort.menu = await ev(`[...document.querySelectorAll("#cvLine .sc-cohopt")].map((o) => o.innerText.trim() + (o.classList.contains("on") ? "*" : ""))`);
  res.steps.cohort.shot = await shot("MU-cohort-menu");
  /* a price tick must not close it: repaint the line the way a tick does */
  await ev(`cvRepaint()`); await sleep(300);
  res.steps.cohort.stillOpenAfterTick = await ev(`!!document.querySelector("#cvLine .sc-cohwrap.is-open")`);
  const before = res.writes.length;
  res.steps.cohort.pick = await ev(`(() => { const o = [...document.querySelectorAll("#cvLine .sc-cohopt")].find((x) => !x.classList.contains("on")); if (!o) return null; const k = o.getAttribute("data-cohopt"); o.click(); return k; })()`);
  await sleep(1500);
  res.steps.cohort.saveCaught = res.writes.slice(before);
  res.steps.cohort.saved = await ev(`(document.querySelector("#cvLine .sc-cohsaved") || {}).textContent || null`);

  /* ⛶ fullscreen, then Esc */
  await ev(`(() => { const s = document.querySelector("#cvLine .sc-cohwrap.is-open"); if (s) s.classList.remove("is-open"); })()`);
  res.steps.fs = { click: await clickVis('#cvLine [data-act="secfs"]') }; await sleep(900);
  Object.assign(res.steps.fs, await ev(`({ on: !!SECFS, id: SECFS && SECFS.id, cls: document.body.classList.contains("secfs") })`));
  res.steps.fs.shot = await shot("MU-fullscreen");
  await page.keyboard.press("Escape"); await sleep(500);
  Object.assign(res.steps.fs, { afterEsc: await ev(`({ on: !!SECFS, leftT: LEFT_T })`) });

  /* timeframes + clouds */
  await clickVis('#cvLine [data-act="corange"][data-r="15m"]'); await sleep(600);
  res.steps.tf15 = await ev(`({ src: document.getElementById("coChartFrame").getAttribute("src"), stored: localStorage.getItem("hub.chart.range"), lit: [...document.querySelectorAll('#cvLine .sc-cofr__tf.on')].map((b) => b.dataset.r || b.innerText) })`);
  await clickVis('#cvLine [data-act="coclouds"]'); await sleep(600);
  res.steps.cloudsOff = await ev(`({ src: document.getElementById("coChartFrame").getAttribute("src"), stored: localStorage.getItem("hub.chart.clouds"), lit: [...document.querySelectorAll('#cvLine .sc-cofr__tf.on')].map((b) => b.dataset.r || b.innerText) })`);
  await sleep(7000); res.steps.cloudsOff.shot = await shot("MU-15m-cloudsoff");
  await clickVis('#cvLine [data-act="coclouds"]'); await clickVis('#cvLine [data-act="corange"][data-r="1D"]'); await sleep(7000);

  /* the tabs */
  for (const tab of ["FINANCIALS", "STATS", "SOCIAL", "EVENTS"]) {
    await clickVis(`#cvTabs [data-tab="${tab}"]`); await sleep(tab === "SOCIAL" ? 9000 : 5000);
    const k = "tab" + tab;
    res.steps[k] = await ev(`(() => { const b = document.getElementById("coRailContent"); return { text: b ? b.innerText.replace(/\\s+/g, " ").slice(0, 700) : null,
      mcap: [...document.querySelectorAll("#coRailContent .kv2 div")].map((d) => d.innerText.replace(/\\s+/g, " ")).find((x) => /market cap/i.test(x)) || null,
      asofVisible: [...document.querySelectorAll("#coRailContent .sc-asof")].some((n) => n.offsetParent !== null && n.getBoundingClientRect().width > 0),
      airead: !!document.querySelector("#coRailContent .sc-airead"), strip: !!document.querySelector("#coRailContent .ern-strip, #coRailContent [class*=ernstrip], #coRailContent [class*=ern-strip]") }; })()`);
    res.steps[k].shot = await shot(`MU-collapsed-${tab}`, mobile);
  }
  /* keys: 1 = GEIGER, ↓ next name, ↑ back, Esc to the board */
  await page.keyboard.press("1"); await sleep(800);
  res.steps.keys = { after1: await ev(`S.coTab`) };
  await page.keyboard.press("ArrowDown"); await sleep(1500); res.steps.keys.down = await ev(`LEFT_T`);
  await page.keyboard.press("ArrowUp"); await sleep(1500); res.steps.keys.up = await ev(`LEFT_T`);

  /* EXPAND */
  await clickVis('#cvLine [data-act="coexpand"]'); await sleep(8000);
  await step("expanded");
  for (const tab of ["GEIGER", "FINANCIALS", "SOCIAL", "EVENTS"]) {
    await clickVis(`#cvTabs [data-tab="${tab}"]`); await sleep(tab === "SOCIAL" ? 8000 : 4500);
    res.steps["exp" + tab] = { shot: await shot(`MU-expanded-${tab}`, mobile) };
    if (tab === "GEIGER") res.steps.expGEIGER.sma200 = await ev(`(() => { const l = document.querySelector('[data-gs="ladder"]'); if (!l) return null; const box = l.getBoundingClientRect(); const t = [...l.querySelectorAll("text, span, div")].find((n) => /SMA 200/.test(n.textContent)); if (!t) return "no SMA 200 label"; const r = t.getBoundingClientRect(); return { inBox: r.bottom <= box.bottom + 1 && r.top >= box.top - 1, top: Math.round(r.top), boxBottom: Math.round(box.bottom), viewport: innerHeight }; })()`);
  }
  res.steps.expClipped = [].concat((await ev(CLIP)) || []).map((c) => c.path + " :: " + (c.text || "").slice(0, 60)).slice(0, 12);
  await clickVis('#cvLine [data-act="coexpand"]'); await sleep(1500);

  /* ✕ in the title goes back */
  res.steps.headx = { click: await clickVis('#headIdent [data-act="headx"]') }; await sleep(1500);
  Object.assign(res.steps.headx, await ev(`({ leftState: LEFT_STATE, leftT: LEFT_T, sec: S.sec, headHidden: document.getElementById("headIdent").hidden })`));

  /* tapes: dashboard top tape and the earnings room */
  res.steps.tapes = { dash: await shot("tapes-dashboard") };
  const top = await page.$("#topTape, .sc-toptape"); if (top) { await top.screenshot({ path: path.join(OUT, `${tag}-tape-top.png`) }).catch(() => {}); res.steps.tapes.top = `${tag}-tape-top.png`; }
  await ev(`(() => { location.hash = "#earnings"; })()`); await sleep(6000);
  res.steps.tapes.earnings = await shot("tapes-earnings-room");
  res.steps.tapes.sec = await ev(`S.sec`);

  /* COHORT ALLOC flow: logo menu function → ALL → a row → the chip is on the company line */
  await ev(`(() => { location.hash = ""; S.sec = "DASHBOARD"; updateMtabs(); })()`); await sleep(2500);
  res.steps.alloc = await ev(`(() => { const b = [...document.querySelectorAll("[data-lm], .sc-lm__item, button, a")].find((x) => /COHORT ALLOC/i.test(x.innerText || "")); if (b) { b.click(); return "menu item"; } return "no item"; })()`);
  await sleep(3500);
  res.steps.allocLabel = await ev(`(document.getElementById("boardLabel") || {}).innerText || null`);
  await ev(`(() => { const r = document.querySelector('.sc-board__row[data-t]'); if (r) r.click(); })()`); await sleep(5000);
  res.steps.allocChip = await ev(`({ t: LEFT_T, chip: [...document.querySelectorAll("#cvLine .sc-cohwrap [aria-haspopup]")].some((n) => n.offsetParent !== null) })`);
} catch (e) { res.fatal = String(e && e.stack || e).slice(0, 500); }
finally { await browser.close().catch(() => {}); }
fs.writeFileSync(path.join(here, "..", "measure", `proof-${W}-${TARGET}.json`), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1).slice(0, 12000));

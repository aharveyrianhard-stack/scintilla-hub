/* K1 (5 Oct 2026) — the headless before/after pictures of the backlog sweep. Never a visible window (Alan, 24 Sep).
     node k1-shots.mjs <live|local> <width> <scenario> [ticker]
   live  = https://scintillahub.ai as deployed (the BEFORE);  local = this branch served under the same hostname (the AFTER).
   Every non-GET request is answered locally and counted, never sent. Shots → ../shots/<scenario>-<mode>-<width>[-T].png,
   the record (what was on the page, page errors, writes) → ../tools/rec-<scenario>-<mode>-<width>[-T].json */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [mode = "local", w = "1680", scenario = "pm", ticker = ""] = process.argv.slice(2);
const width = Number(w), phone = width < 700;
const here = path.dirname(fileURLToPath(import.meta.url));
const hubRoot = process.env.HUB_ROOT || path.resolve(here, "../../../..");
const shots = path.join(here, "..", "shots");
const tag = scenario + "-" + mode + "-" + width + (ticker ? "-" + ticker : "");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".woff2": "font/woff2" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function localFile(root, pathname) {
  let f = path.normalize(path.join(root, decodeURIComponent(pathname)));
  if (!f.startsWith(root)) return null;
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f) && fs.existsSync(f + ".html")) f += ".html";
  return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null;
}
const writes = [], errors = [];
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
const out = { tag, mode, width, scenario, ticker, at: new Date().toISOString(), writes, errors };
try {
  const context = await browser.newContext({ viewport: { width, height: phone ? 844 : 1050 }, deviceScaleFactor: phone ? 2 : 1, serviceWorkers: "block",
    ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") {
      writes.push({ method: m, url: u.host + u.pathname });
      return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" });
    }
    if (mode === "local" && u.host === "scintillahub.ai") {
      if (u.pathname.startsWith("/api/")) return route.continue();
      const f = localFile(hubRoot, u.pathname);
      if (!f) return route.fulfill({ status: 404, body: "not found" });
      return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream", "access-control-allow-origin": "*", "cache-control": "no-store" }, body: fs.readFileSync(f) });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.length < 20 && errors.push(String(e.message).slice(0, 200)));
  const shot = async (name, sel) => {
    const file = path.join(shots, name + "-" + mode + "-" + width + (ticker ? "-" + ticker : "") + ".png");
    if (sel) {                                 // bring the part to the top of its own scroller, then picture the screen as a person sees it
      const ok = await page.evaluate((q) => { const e = document.querySelector(q); if (!e) return false; e.scrollIntoView({ block: "start" }); return true; }, sel);
      if (!ok) out["missing_" + name] = sel;
      await sleep(500);
    }
    await page.screenshot({ path: file, type: "png", fullPage: false });
    return file;
  };
  const openCoTab = async (t, tab) => {
    await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector(".sc-board__row[data-t]", { timeout: 60000 }).catch(() => { out.noBoard = true; });
    await sleep(1500);
    await page.evaluate((x) => openCo(x), t);
    await page.waitForSelector('[data-act="cotab"][data-tab="' + tab + '"]', { timeout: 30000 }).catch(() => { out.noTab = tab; });
    await page.evaluate((k) => { const b = document.querySelector('[data-act="cotab"][data-tab="' + k + '"]'); if (b) b.click(); }, tab);
    await sleep(2500);
  };
  const S = {
    /* item 1 — SENTIMENT → PREDICTION MARKETS: the world group's history, the resolution log, the PAGE SPECS fold */
    async pm() {
      await page.goto("https://scintillahub.ai/#prediction", { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForSelector("#pmSection", { timeout: 60000 });
      await page.waitForFunction(() => document.querySelector("#pmSection .pmx-row") && typeof PM !== "undefined" && PM.hist && Object.keys(PM.hist).length, null, { timeout: 60000 }).catch(() => { out.noHistory = true; });
      await page.waitForFunction(() => typeof PMX === "undefined" || !("closed" in PMX) || PMX.closed || PMX.closedErr, null, { timeout: 30000 }).catch(() => { out.noClosed = true; });
      await sleep(3000);
      out.pm = await page.evaluate(() => {
        const sec = document.querySelector("#pmSection"), txt = (e) => e ? e.textContent.replace(/\s+/g, " ").trim() : null;
        const world = sec.querySelector(".pmx-grp--world"), wr = world ? [...world.querySelectorAll(".pmx-row")] : [];
        const closed = sec.querySelector("#pmClosed");
        return { status: txt(sec.querySelector(".pmx-status")).slice(0, 160),
          world: { head: txt(world && world.querySelector(".pmx-grp__h")), rows: wr.length, noYesterday: wr.filter((r) => /no yesterday/.test(r.textContent)).length,
                   noHistory: wr.filter((r) => /no history yet/.test(r.textContent)).length, withLine: wr.filter((r) => r.querySelector(".pmx-row__l svg")).length, first3: wr.slice(0, 3).map((r) => txt(r).slice(0, 130)) },
          closed: closed ? { head: txt(closed.querySelector(".pmx-grp__h")), rows: closed.querySelectorAll(".pmx-crow").length, first5: [...closed.querySelectorAll(".pmx-crow")].slice(0, 5).map((r) => txt(r)) } : null,
          pageSpecs: !!sec.querySelector("details.sc-pagespecs"), overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth };
      });
      out.shots = [await shot("pm-room"), await shot("pm-world", ".pmx-grp--world")];
      if (out.pm.closed) out.shots.push(await shot("pm-closed", "#pmClosed"));
      if (out.pm.pageSpecs) { await page.evaluate(() => { document.querySelector("#pmSection details.sc-pagespecs").open = true; }); out.shots.push(await shot("pm-specs", "#pmSection details.sc-pagespecs")); }
    },
    /* item 1 — company view → ESTIMATES → 05 Rating changes: which feed the table reads */
    async ratings() {
      const t = ticker || "NVDA";
      await openCoTab(t, "ESTIMATES");
      await page.waitForSelector("#coRailContent .sc-grsec", { timeout: 30000 }).catch(() => { out.noGrades = true; });
      await page.waitForFunction((x) => typeof REV_CACHE !== "undefined" && REV_CACHE[x], t, { timeout: 30000 }).catch(() => { out.noNotes = true; });
      await sleep(1500);
      out.ratings = await page.evaluate(() => {
        const g = document.querySelector("#coRailContent .sc-grsec"), txt = (e) => e ? e.textContent.replace(/\s+/g, " ").trim() : null;
        const rows = g ? [...g.querySelectorAll(".sc-grrow")] : [];
        return { src: g && g.dataset.grSrc || "analyst_grades (the page before K1 names no source)", rows: rows.length, newest: rows[0] ? txt(rows[0].querySelector(".gdate")) : null,
                 oldest: rows.length ? txt(rows[rows.length - 1].querySelector(".gdate")) : null, first3: rows.slice(0, 3).map(txt), empty: txt(g && g.querySelector(".sc-grempty")) };
      });
      const h = await page.$("#coRailContent .sc-grsec");
      if (h) { await h.scrollIntoViewIfNeeded(); await sleep(400); }
      out.shots = [await shot("ratings", "#coRailContent .sc-grsec"), await shot("ratings-view")];
    },
    /* item 1 — SOCIAL → SENTIMENT: the stale table replaced by the daily one */
    async social() {
      await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForSelector(".sc-board__row[data-t]", { timeout: 60000 }).catch(() => { out.noBoard = true; });
      await sleep(1500);
      await page.evaluate(() => { S.coh = "ALL"; S.socTab = "SENTIMENT"; go("SOCIAL"); });
      await page.waitForSelector("#socList .sc-socrow", { timeout: 30000 }).catch(() => { out.noRows = true; });
      await sleep(4000);
      out.social = await page.evaluate(() => {
        const txt = (e) => e ? e.textContent.replace(/\s+/g, " ").trim() : null;
        const rows = [...document.querySelectorAll("#socList .sc-socrow")], have = rows.filter((r) => !r.classList.contains("awaiting"));
        return { rows: rows.length, withData: have.length, source: txt(document.querySelector("#socSource")), label: txt(document.querySelector("#socLabel")),
                 first5: have.slice(0, 5).map(txt), daily: typeof SOCDAILY !== "undefined" ? { rows: SOCDAILY.rows && SOCDAILY.rows.length, err: SOCDAILY.err } : null };
      });
      await page.evaluate(() => { const l = document.querySelector("#socList"), r = l && l.querySelector(".sc-socrow:not(.awaiting)"); if (r) r.scrollIntoView({ block: "start" }); });
      await sleep(400);
      out.shots = [await shot("social")];
    },
  };
  /* item 2 — company view → FINANCIALS → CAPITAL: the cash-after-spending projection; and the previous-close hover */
  S.capital = async () => {
    const t = ticker || "CRWV";
    await openCoTab(t, "FINANCIALS");
    await page.waitForSelector("#ofCap_" + t + " .of-cash", { timeout: 30000 }).catch(() => { out.noCap = true; });
    await page.waitForFunction((x) => typeof OF !== "undefined" && OF.co[x], t, { timeout: 30000 }).catch(() => { out.noRead = true; });
    await sleep(1500);
    out.capital = await page.evaluate((x) => {
      const c = document.querySelector("#ofCap_" + x), txt = (e) => e ? e.textContent.replace(/\s+/g, " ").trim() : null, p = c && c.querySelector(".of-proj");
      const r = p && p.getBoundingClientRect(), box = c && c.querySelector(".of-cash").getBoundingClientRect();
      return { cover: txt(c && c.querySelector(".of-cover")), proj: p ? { state: p.dataset.ofProj, read: txt(p.querySelector(".of-proj__r")), axis: txt(p.querySelector(".of-proj__ax")), hover: p.getAttribute("title"),
        w: Math.round(r.width), h: Math.round(r.height), insideColumn: r.right <= box.right + 1 } : null, specs: !!(c && c.querySelector("details.sc-pagespecs")) };
    }, t);
    out.shots = [await shot("capital", "#ofCap_" + t + " .of-cover")];
    /* the hover: nothing is provisional outside the minutes after the bell, so the page is handed the two cases the
       provider can send and asked what the hover would say (the page's own functions; no request is made) */
    out.prevHover = await page.evaluate((x) => {
      if (typeof scPrevNoteSet !== "function") return null;
      const res = {};
      scPrevNoteSet(x, { previous_close: 100.02, previous_close_provisional: false, previous_close_revised: { own_close: 100, provider_close: 100.02 } }); scHeldPrevPaint(x);
      res.revised = { header: document.querySelector("#coPrev") && document.querySelector("#coPrev").getAttribute("title"), state: document.querySelector("#coPrev") && document.querySelector("#coPrev").dataset.scPrevCloseState };
      scPrevNoteSet(x, { previous_close: 100, previous_close_provisional: true, previous_close_revised: null }); scHeldPrevPaint(x);
      res.provisional = { header: document.querySelector("#coPrev").getAttribute("title"), boardCell: document.querySelector("#lc_" + x) ? document.querySelector("#lc_" + x).getAttribute("title") : "(row not on this board)" };
      scPrevNoteSet(x, { previous_close: 100, previous_close_provisional: false, previous_close_revised: null }); scHeldPrevPaint(x);
      res.confirmed = { header: document.querySelector("#coPrev").getAttribute("title") };
      return res;
    }, t);
  };
  /* item 3 — a company tab measured for anything cut at the panel's right edge (H10's leftovers) */
  S.cut = async () => {
    const t = ticker || "NVDA", tab = process.env.TAB || "COMPS";
    await openCoTab(t, tab);
    await sleep(Number(process.env.WAIT || 6000));
    out.cut = await page.evaluate(() => {
      const rail = document.querySelector("#coRailContent"); if (!rail) return null;
      const R = rail.getBoundingClientRect(), bad = [];
      for (const e of rail.querySelectorAll("*")) {
        const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
        const over = Math.round(r.right - R.right);
        if (over > 2) { let hid = false; for (let p = e.parentElement; p && p !== rail; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll" || o === "hidden") { hid = o; break; } }
          bad.push({ tag: e.tagName.toLowerCase() + (e.className && typeof e.className === "string" ? "." + e.className.split(" ")[0] : ""), over, clippedBy: hid, text: e.textContent.replace(/\s+/g, " ").trim().slice(0, 40) }); }
      }
      bad.sort((a, b) => b.over - a.over);
      const top = {}; for (const b of bad) { if (!top[b.tag] || top[b.tag].over < b.over) top[b.tag] = b; }
      return { railW: Math.round(R.width), railScrollW: rail.scrollWidth, railClientW: rail.clientWidth, cutElements: bad.length, worst: Object.values(top).slice(0, 12) };
    });
    out.shots = [await shot("cut-" + tab)];
  };
  /* item 3 — company view → EVENTS: the earnings strip's cards against the strip's own width */
  S.strip = async () => {
    const t = ticker || "NVDA";
    if (process.env.VW) await page.setViewportSize({ width: Number(process.env.VW), height: Number(process.env.VH || 690) });
    await openCoTab(t, "EVENTS");
    await page.waitForSelector("#esRow .es-c", { timeout: 30000 }).catch(() => { out.noStrip = true; });
    await sleep(1200);
    out.strip = await page.evaluate(() => {
      const row = document.querySelector("#esRow"); if (!row) return null;
      const R = row.getBoundingClientRect(), cs = [...row.querySelectorAll(".es-c")].filter((c) => c.getBoundingClientRect().width > 0);
      const vis = cs.map((c) => { const r = c.getBoundingClientRect(); return { l: Math.round(r.left - R.left), w: Math.round(r.width), whole: r.left >= R.left - 1 && r.right <= R.right + 1, part: r.right > R.left + 1 && r.left < R.right - 1 }; });
      return { rowW: Math.round(R.width), scrollW: row.scrollWidth, clientW: row.clientWidth, cards: cs.length, cardW: vis[0] && vis[0].w, whole: vis.filter((v) => v.whole).length,
               sliced: vis.filter((v) => v.part && !v.whole).length, scrollLeft: row.scrollLeft, display: getComputedStyle(row).display };
    });
    out.shots = [await shot("strip" + (process.env.VW ? "-" + process.env.VW : ""), "#esRow")];
  };
  /* item 3 — FUNDAMENTALS for a fund */
  S.fund = async () => {
    const t = ticker || "XLK";
    await openCoTab(t, "FUNDAMENTALS");
    await sleep(5000);
    out.fund = await page.evaluate(() => {
      const rail = document.querySelector("#coRailContent"), txt = (e) => e ? e.textContent.replace(/\s+/g, " ").trim() : null, f = rail && rail.querySelector(".fdf");
      const R = rail.getBoundingClientRect();
      return { frame: !!(rail && rail.querySelector("#coFundFrame")), fundPanel: !!f, tiles: f ? [...f.querySelectorAll(".fdf-t")].map(txt) : null, head: f ? [...f.querySelectorAll(".fdf-h")].map(txt) : null,
        rows: f ? f.querySelectorAll(".fdf-r").length : 0, clickable: f ? f.querySelectorAll(".fdf-r[data-tkopen]").length : 0, first3: f ? [...f.querySelectorAll(".fdf-r")].slice(0, 3).map(txt) : null,
        cut: f ? [...f.querySelectorAll("*")].filter((e) => e.getBoundingClientRect().right > R.right + 2).length : null, specs: !!(f && f.querySelector("details.sc-pagespecs")) };
    });
    out.shots = [await shot("fund")];
    if (out.fund.clickable) { await page.evaluate(() => document.querySelector(".fdf-r[data-tkopen]").click()); await sleep(2500); out.fund.afterClick = await page.evaluate(() => typeof LEFT_T !== "undefined" ? LEFT_T : null); }
  };
  /* item 3 — the captions that named our tables, counted in a company tab's visible text */
  S.captions = async () => {
    const t = ticker || "NVDA", tab = process.env.TAB || "FINANCIALS";
    await openCoTab(t, tab);
    await sleep(5000);
    out.captions = await page.evaluate(() => {
      const rail = document.querySelector("#coRailContent"), names = /\b(fundamentals_history|balance_history|cashflow_history|youtube_videos|ipo_lockups|offering_news|analyst_[a-z_]+|price_target_[a-z_]+|ratios_history)\b/g;
      const clone = rail.cloneNode(true); clone.querySelectorAll("details.sc-pagespecs").forEach((d) => d.remove());
      const inPanel = (clone.textContent.match(names) || []), specs = [...rail.querySelectorAll("details.sc-pagespecs")].map((d) => (d.textContent.match(names) || []).length);
      return { tableNamesInPanel: inPanel.length, which: [...new Set(inPanel)], pageSpecsFolds: specs.length, tableNamesInPageSpecs: specs.reduce((a, b) => a + b, 0),
               notes: [...rail.querySelectorAll(".fn3-note")].map((n) => n.textContent.trim().slice(0, 90)) };
    });
    await page.evaluate(() => { const d = [...document.querySelectorAll("#coRailContent details.sc-pagespecs")].pop(); if (d) { d.open = true; d.scrollIntoView({ block: "end" }); } else { const r = document.querySelector("#coRailContent"); r.scrollTop = r.scrollHeight; const sc = r.closest(".scroller") || r.parentElement; if (sc) sc.scrollTop = sc.scrollHeight; } });
    await sleep(500);
    out.shots = [await shot("captions-" + tab)];
  };
  /* item 4 — COMPS on the comps branch (HUB_ROOT points at it): the set, its tiers, the range */
  S.comps = async () => {
    const t = ticker || "MU";
    await openCoTab(t, "COMPS");
    await page.waitForSelector("#coRailContent .cm5 table.p tbody tr", { timeout: 40000 }).catch(() => { out.noSet = true; });
    await sleep(7000);
    out.comps = await page.evaluate(() => {
      const c = document.querySelector("#coRailContent .cm5"); if (!c) return null; const txt = (e) => e ? e.textContent.replace(/\s+/g, " ").trim() : null;
      const rows = [...c.querySelectorAll("table.p tbody tr:not(.me)")].map((r) => ({ t: txt(r.querySelector(".tk")), tag: [...r.querySelectorAll(".seat")].map(txt).join("+") }));
      const R = c.getBoundingClientRect(), tb = c.querySelector("table.p").getBoundingClientRect();
      return { peers: rows, tableOverPanelPx: Math.round(tb.right - R.right), range: txt(c.querySelector(".rg")) ? txt(c.querySelector(".rg")).slice(0, 260) : null };
    });
    out.shots = [await shot("comps-set", "#coRailContent .cm5"), await shot("comps-range", "#coRailContent .cm5 .rg")];
  };
  /* item 3 — the SENTIMENT room (HOW IT IS BUILT) and the ECONOMIC room: table names in the visible text */
  S.rooms = async () => {
    const names = "sentiment_ticker_daily|news_headline_sentiment|youtube_videos|social_sentiment|econ_calendar|treasury_rates|econ_history";
    await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector(".sc-board__row[data-t]", { timeout: 60000 }).catch(() => {});
    const count = (sel) => page.evaluate(([q, n]) => { const r = document.querySelector(q); if (!r) return null; const c = r.cloneNode(true); c.querySelectorAll("details.sc-pagespecs").forEach((d) => d.remove());
      const m = c.textContent.match(new RegExp("\\b(" + n + ")\\b", "g")) || []; return { inPanel: m.length, which: [...new Set(m)], folds: r.querySelectorAll("details.sc-pagespecs").length }; }, [sel, names]);
    out.rooms = {};
    for (const tab of ["OVERVIEW", "ANATOMY"]) { await page.evaluate((t) => { S.sentiTab = t; go("SENTIMENT"); if (typeof sync === "function") sync(); }, tab); await sleep(6000); out.rooms["SENTIMENT_" + tab] = await count("#snMain") ; out.rooms["SENTIMENT_" + tab + "_rail"] = await count("#snRail"); }
    out.shots = [await shot("rooms-sentiment-built")];
    await page.evaluate(() => { go("ECONOMIC"); }); await sleep(7000);
    out.rooms.ECONOMIC_source = await page.evaluate(() => { const e = document.querySelector("#econSource"); return e ? { text: e.textContent.replace(/\s+/g, " ").trim().slice(0, 200), hover: e.getAttribute("title") } : null; });
    out.shots.push(await shot("rooms-economic", "#econSource"));
  };
  if (!S[scenario]) throw new Error("no scenario " + scenario);
  await S[scenario]();
} catch (e) { out.failed = String((e && e.stack) || e).slice(0, 600); }
finally { await browser.close(); }
fs.writeFileSync(path.join(here, "rec-" + tag + ".json"), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));

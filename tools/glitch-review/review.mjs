#!/usr/bin/env node
/* PG1 — the nightly slowness-and-glitch review (Alan, 5 Oct 2026: "Slowness and glitchiness and buggy stuff …
   the more reviews you give for that, the better").

   Walks every screen in screens.mjs in a HEADLESS browser, measures it, pictures it, compares the picture with the
   last run's, runs Lighthouse on the whole pages, ranks what it found and writes a JSON + an HTML page.
   It only reads public pages: every request that is not a plain read (GET/HEAD/OPTIONS) is blocked and counted.
   It fixes nothing.

   usage: node review.mjs --out <dir> [--baseline <dir of last run's pictures>] [--prev <last run's glitch-review.json>]
                          [--only id,id] [--no-lighthouse] [--slot night|market|manual]
   env:   PG1_PLAYWRIGHT_FROM  a package.json whose node_modules holds playwright-core (local runs on the MacBook) */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SCREENS, LIMITS } from "./screens.mjs";
import { rank, writeReport } from "./report.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, dflt = null) => { const i = process.argv.indexOf("--" + name); return i < 0 ? dflt : (process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : true); };
const OUT = path.resolve(arg("out", "glitch-review-out"));
const BASE = arg("baseline") ? path.resolve(arg("baseline")) : null;
const PREV = arg("prev") ? path.resolve(arg("prev")) : null;
const ONLY = arg("only") ? String(arg("only")).split(",") : null;
const SLOT = arg("slot", "manual");
const DO_LH = !arg("no-lighthouse", false);
const WIDE = { width: 1680, height: 1050 }, PHONE = { width: 390, height: 844 };

const req = createRequire(path.join(HERE, "package.json"));
const pwReq = process.env.PG1_PLAYWRIGHT_FROM ? createRequire(process.env.PG1_PLAYWRIGHT_FROM) : req;
const { chromium } = (() => { try { return pwReq("playwright"); } catch { return pwReq("playwright-core"); } })();
const { PNG } = req("pngjs");
const pixelmatch = (await import(req.resolve("pixelmatch"))).default;

fs.mkdirSync(path.join(OUT, "shots"), { recursive: true });
fs.mkdirSync(path.join(OUT, "pictures"), { recursive: true });
const PROBE = fs.readFileSync(path.join(HERE, "probe.js"), "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const short = (u) => { try { const x = new URL(u); return x.host + x.pathname.slice(0, 70); } catch { return String(u).slice(0, 90); } };

/* one screen, one fresh page */
async function measure(browser, screen, viewport) {
  const phone = viewport.width < 600;
  const rec = { id: screen.id + (phone ? "-phone" : ""), name: screen.name + (phone ? " (phone width)" : ""), url: screen.url, width: viewport.width, ok: true, notes: [] };
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone, serviceWorkers: "block", locale: "en-US", timezoneId: "America/New_York" });
  await ctx.addInitScript(PROBE);
  const page = await ctx.newPage();
  let bytes = 0, calls = 0, blocked = 0; const pending = new Set(); let lastNet = Date.now();
  const consoleErrors = [], pageErrors = [], failed = [], sizeJobs = [];
  const reset = () => { bytes = 0; calls = 0; consoleErrors.length = 0; pageErrors.length = 0; failed.length = 0; };
  await ctx.route("**/*", (route) => {
    const m = route.request().method();
    if (m === "GET" || m === "HEAD" || m === "OPTIONS") return route.continue();
    blocked++; return route.abort("blockedbyclient");
  });
  page.on("console", (m) => {
    if (m.type() !== "error" || consoleErrors.length >= 300) return;
    if (/ERR_BLOCKED_BY_CLIENT/.test(m.text())) return;               // the echo of a write this review blocked itself
    consoleErrors.push(m.text().slice(0, 240));
  });
  page.on("pageerror", (e) => { if (pageErrors.length < 100) pageErrors.push(String(e && e.message || e).slice(0, 240)); });
  page.on("request", (r) => { pending.add(r); lastNet = Date.now(); });
  page.on("requestfinished", (r) => {
    pending.delete(r); lastNet = Date.now(); calls++;
    sizeJobs.push(r.sizes().then((s) => { bytes += (s.responseBodySize || 0) + (s.responseHeadersSize || 0); }).catch(() => {}));
  });
  page.on("requestfailed", (r) => {
    pending.delete(r); lastNet = Date.now();
    const why = (r.failure() && r.failure().errorText) || "failed";
    if (/BLOCKED_?BY_?CLIENT/i.test(why)) return;                         // our own block of a write
    if (/ERR_ABORTED/i.test(why)) return;                            // the page cancelled its own request
    if (failed.length < 200) failed.push({ status: 0, why, url: short(r.url()) });
  });
  page.on("response", (r) => { if (r.status() >= 400 && failed.length < 200) failed.push({ status: r.status(), url: short(r.url()) }); });
  page.on("crash", () => { rec.ok = false; rec.notes.push("the page crashed"); });

  const quiet = async (capMs, idleMs = 1500) => { const t = Date.now(); while (Date.now() - t < capMs) { if (Date.now() - lastNet > idleMs) return true; await sleep(150); } return false; };
  /* first data: the page's own clock if the numbers are on the page itself; otherwise the first moment a frame inside it
     (the Station chart in a company view, the panes of the deck) reports its own numbers or drawn chart */
  let clock0 = Date.now(); const newFrames = new Set(); let onlyNewFrames = false;
  page.on("frameattached", (f) => newFrames.add(f));
  page.on("framenavigated", (f) => { if (f !== page.mainFrame()) newFrames.add(f); });
  const firstData = async (capMs) => {
    const t = Date.now();
    while (Date.now() - t < capMs) {
      const v = await page.evaluate(() => window.__pg1 && window.__pg1.firstData).catch(() => null);
      if (v != null) return v;
      for (const f of page.frames()) {
        if (f === page.mainFrame() || (onlyNewFrames && !newFrames.has(f))) continue;
        const inner = await f.evaluate(() => window.__pg1 && window.__pg1.firstData).catch(() => null);
        if (inner != null) return Date.now() - clock0;
      }
      await sleep(150);
    }
    return null;
  };

  const t0 = Date.now();
  try {
    const resp = await page.goto(screen.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    if (resp && resp.status() >= 400) { rec.ok = false; rec.notes.push("the page itself answered " + resp.status()); }
    rec.domReadyMs = Date.now() - t0;
    if (screen.hubTab && screen.hubTab !== "DASHBOARD" || screen.hubCompany) {
      /* let the board arrive first, then time the step a visitor takes from it */
      await firstData(30000); await quiet(10000);
      await Promise.all(sizeJobs.splice(0)); reset();
      await page.evaluate(() => window.__pg1.mark());
      clock0 = Date.now(); newFrames.clear(); onlyNewFrames = true;
      if (screen.hubTab) {
        /* the master tabs fold away until a visitor reaches for them; unfold them the way the page does */
        await page.evaluate(() => { try { if (typeof revealTabs === "function") revealTabs(); } catch { /* fall through */ } document.body.classList.remove("tuck"); });
        await sleep(350);
        const tab = page.locator('.sc-mtab[data-sec="' + screen.hubTab + '"]').first();
        if (!(await tab.count())) { rec.ok = false; rec.notes.push("the tab " + screen.hubTab + " is not on the page"); }
        else await tab.click({ timeout: 8000 });
      } else {
        const opened = await page.evaluate((t) => { if (typeof openCo !== "function") return false; openCo(t); return true; }, screen.hubCompany);
        if (!opened) { rec.ok = false; rec.notes.push("the company view could not be opened"); }
      }
    }
    rec.firstDataMs = await firstData(30000);
    if (rec.firstDataMs == null) rec.notes.push("no numbers and no drawn chart within 30 seconds");
    await quiet(12000);
    rec.settledMs = Math.max(0, lastNet - t0);                         // when the last download finished
    await sleep(Math.max(0, 8000 - (Date.now() - t0)));               // every screen is watched for at least 8 s, so shifts compare
    await sleep(1500);
    await Promise.all(sizeJobs.splice(0));

    /* gather from every frame (a company view holds the Station chart in a frame) */
    let shift = 0; const shifts = [], tasks = [], audit = { numbers: 0, placeholders: [], blankPanels: [], ages: [], stale: [] };
    for (const f of page.frames()) {
      const g = await f.evaluate((staleMin) => { const P = window.__pg1; if (!P || !document.body) return null; return { shift: P.shift, shifts: P.shifts, tasks: P.longTasks, audit: P.audit(staleMin) }; }, LIMITS.staleBadgeAgeMin).catch(() => null);
      if (!g) continue;
      const top = f === page.mainFrame();
      shift += g.shift; shifts.push(...g.shifts.map((s) => ({ ...s, frame: top ? "page" : short(f.url()) })));
      tasks.push(...g.tasks);
      audit.numbers += g.audit.numbers;
      for (const k of ["placeholders", "blankPanels", "ages", "stale"]) audit[k].push(...g.audit[k]);
    }
    /* "500 STALE TRADES" in the Hub's header is on every Hub screen: count it once, on the board */
    if (screen.hubCompany || (screen.hubTab && screen.hubTab !== "DASHBOARD") || phone) audit.stale = audit.stale.filter((x) => !/stale trades/i.test(x.text));
    /* a room that says it is parked on purpose ("Alerts — parked until the hub is settled") is listed, not red */
    if (screen.hubTab && await page.evaluate(() => /(^|[\s·])parked\b/i.test(document.body.innerText || "")).catch(() => false)) rec.parked = true;
    const after = screen.hubTab && screen.hubTab !== "DASHBOARD" || screen.hubCompany;
    const tks = after ? tasks.filter((t) => t.at >= 0) : tasks;
    rec.layoutShift = +shift.toFixed(3);
    rec.shiftSources = shifts.sort((a, b) => b.value - a.value).slice(0, 5);
    rec.longTasks = tks.length;
    rec.longestFreezeMs = tks.reduce((m, t) => Math.max(m, t.ms), 0);
    rec.frozenMs = tks.reduce((s, t) => s + Math.max(0, t.ms - 50), 0);
    rec.weightKB = Math.round(bytes / 1024);
    rec.calls = calls;
    rec.blockedWrites = blocked;
    rec.consoleErrors = consoleErrors.length;
    rec.consoleErrorSamples = top5(consoleErrors);
    rec.pageErrors = pageErrors.length;
    rec.pageErrorSamples = top5(pageErrors);
    rec.failedCalls = failed.length;
    rec.failedCallSamples = top5(failed.map((f) => (f.status || f.why) + " " + f.url));
    rec.numbersOnScreen = audit.numbers;
    rec.placeholders = audit.placeholders.length;
    rec.placeholderSamples = top5(audit.placeholders);
    rec.blankPanels = audit.blankPanels.length;
    rec.blankPanelSamples = audit.blankPanels.slice(0, 5);
    rec.ages = audit.ages.slice(0, 12);
    rec.staleBadges = audit.stale.length;
    rec.staleSamples = audit.stale.slice(0, 5);
    if (phone) rec.sidewaysScrollPx = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth)).catch(() => 0);

    /* the picture, and what moved since the last run's */
    const png = await page.screenshot({ type: "png", fullPage: false, animations: "disabled", caret: "hide" });
    fs.writeFileSync(path.join(OUT, "pictures", rec.id + ".png"), png);
    fs.writeFileSync(path.join(OUT, "shots", rec.id + ".jpg"), await page.screenshot({ type: "jpeg", quality: 62, fullPage: false, animations: "disabled", caret: "hide" }));
    rec.shot = "shots/" + rec.id + ".jpg";
    const old = BASE && path.join(BASE, rec.id + ".png");
    if (old && fs.existsSync(old)) {
      try {
        const a = PNG.sync.read(fs.readFileSync(old)), b = PNG.sync.read(png);
        if (a.width === b.width && a.height === b.height) {
          const d = new PNG({ width: a.width, height: a.height });
          const n = pixelmatch(a.data, b.data, d.data, a.width, a.height, { threshold: 0.12, diffMask: true, diffColor: [205, 205, 205] });
          rec.picChangedPct = +(100 * n / (a.width * a.height)).toFixed(2);
          fs.writeFileSync(path.join(OUT, "shots", rec.id + ".moved.png"), PNG.sync.write(d));
          rec.moved = "shots/" + rec.id + ".moved.png";
        } else rec.notes.push("the picture changed size since the last run (" + a.width + "×" + a.height + " → " + b.width + "×" + b.height + ")");
      } catch (e) { rec.notes.push("the last run's picture could not be read"); }
    } else rec.picChangedPct = null;
  } catch (e) {
    rec.ok = false; rec.notes.push("the review could not finish this screen: " + String(e && e.message || e).split("\n")[0].slice(0, 200));
  } finally {
    await ctx.close().catch(() => {});
  }
  return rec;
}
function top5(list) {
  const m = new Map(); for (const s of list) m.set(s, (m.get(s) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([text, n]) => ({ n, text }));
}

/* Lighthouse — the public scoring tool Q3 used (same defaults: a mid-range phone on a slowed connection) */
async function lighthouseRun(url, chromePath) {
  const lighthouse = (await import(req.resolve("lighthouse"))).default;
  const chromeLauncher = await import(req.resolve("chrome-launcher"));
  const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
  try {
    const r = await lighthouse(url, { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["performance", "accessibility", "best-practices"] });
    const l = r.lhr, a = l.audits, n = (k) => (a[k] && typeof a[k].numericValue === "number" ? a[k].numericValue : null);
    return {
      performance: l.categories.performance.score == null ? null : Math.round(l.categories.performance.score * 100),
      accessibility: Math.round((l.categories.accessibility.score || 0) * 100),
      bestPractices: Math.round((l.categories["best-practices"].score || 0) * 100),
      firstPaintMs: n("first-contentful-paint") && Math.round(n("first-contentful-paint")),
      largestPaintMs: n("largest-contentful-paint") && Math.round(n("largest-contentful-paint")),
      blockedMs: n("total-blocking-time") == null ? null : Math.round(n("total-blocking-time")),
      layoutShift: n("cumulative-layout-shift") == null ? null : +n("cumulative-layout-shift").toFixed(3),
      weightKB: n("total-byte-weight") && Math.round(n("total-byte-weight") / 1024),
      domElements: n("dom-size") || n("dom-size-insight"),
      warning: (l.runWarnings || [])[0] || null,
    };
  } finally { try { await chrome.kill(); } catch { /* already gone */ } }
}

const started = new Date();
const browser = await chromium.launch({ headless: true });          // headless ALWAYS — never a window on anyone's screen
const screens = [];
try {
  const list = SCREENS.filter((s) => !ONLY || ONLY.includes(s.id));
  for (const s of list) {
    process.stdout.write("· " + s.name + " … ");
    const r = await measure(browser, s, WIDE);
    screens.push(r);
    console.log(r.ok ? "first data " + (r.firstDataMs == null ? "never" : r.firstDataMs + " ms") + ", shift " + r.layoutShift + ", " + r.weightKB + " KB" : "FAILED: " + r.notes.join("; "));
  }
  for (const s of list.filter((s) => s.lighthouse)) {
    process.stdout.write("· " + s.name + " (phone width) … ");
    const r = await measure(browser, s, PHONE);
    screens.push(r);
    console.log(r.ok ? "shift " + r.layoutShift + ", sideways scroll " + r.sidewaysScrollPx + " px" : "FAILED: " + r.notes.join("; "));
  }
  if (DO_LH) {
    const chromePath = chromium.executablePath();
    for (const s of list.filter((s) => s.lighthouse)) {
      process.stdout.write("· Lighthouse " + s.name + " … ");
      const rec = screens.find((x) => x.id === s.id);
      try { rec.lighthouse = await lighthouseRun(s.url, chromePath); console.log("performance " + rec.lighthouse.performance); }
      catch (e) { rec.lighthouse = { error: String(e && e.message || e).split("\n")[0].slice(0, 200) }; console.log("could not run: " + rec.lighthouse.error); }
    }
  }
} finally {
  await browser.close().catch(() => {});
}

let prev = null; try { if (PREV && fs.existsSync(PREV)) prev = JSON.parse(fs.readFileSync(PREV, "utf8")); } catch { prev = null; }
const et = (d, o) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", ...o }).format(d);
const result = {
  kind: "scintilla-glitch-review", version: 1,
  slot: SLOT,
  dateET: et(started, { year: "numeric", month: "2-digit", day: "2-digit" }),
  startedET: et(started, { hour: "2-digit", minute: "2-digit", hour12: false }),
  startedUTC: started.toISOString(), finishedUTC: new Date().toISOString(),
  ranOn: process.env.GITHUB_ACTIONS ? "GitHub Actions (cloud) run " + (process.env.GITHUB_RUN_ID || "") : "a headless browser on " + (process.env.PG1_HOST_LABEL || "a local machine"),
  runUrl: process.env.GITHUB_ACTIONS ? process.env.GITHUB_SERVER_URL + "/" + process.env.GITHUB_REPOSITORY + "/actions/runs/" + process.env.GITHUB_RUN_ID : null,
  comparedWith: prev ? { dateET: prev.dateET, slot: prev.slot, startedET: prev.startedET } : null,
  hadLastPictures: !!(BASE && fs.existsSync(BASE) && fs.readdirSync(BASE).some((f) => f.endsWith(".png"))),
  limits: LIMITS, screens,
};
Object.assign(result, rank(result, prev));
fs.writeFileSync(path.join(OUT, "glitch-review.json"), JSON.stringify(result, null, 1));
writeReport(result, OUT, HERE);
console.log("\n" + result.verdict.toUpperCase() + " — " + result.findings.filter((f) => f.level === "red").length + " red, " + result.findings.filter((f) => f.level === "amber").length + " amber\n");
for (const [i, f] of result.worstFive.entries()) console.log((i + 1) + ". " + f.screen + " · " + f.problem + " · " + f.number);
console.log("\nreport: " + path.join(OUT, "index.html"));

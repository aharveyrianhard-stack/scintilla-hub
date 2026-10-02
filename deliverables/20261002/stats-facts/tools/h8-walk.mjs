/* H8 (2 Oct) — the headless walk of the STATS tab. Never a visible window (Alan, 24 Sep). The Hub is served from this
   branch (hubRoot) under its real hostname, the way R3's harness does it; every non-GET request is answered locally and
   counted, never sent. Two jobs:
     node h8-walk.mjs shots <label> <T,T,…>        full-page PNGs at 1680 × 1050, device scale 2, STATS tab open, plus a
                                                    zoomed crop of the tab → screens/<label>-<T>-1680-STATS.png and
                                                    screens/zoom-<label>-<T>-1680-STATS.png
     node h8-walk.mjs probe <label> <nStocks> <nFunds> [T,T,…]   opens the company payload for a sample of the board's names
                                                    (the walk's five funds always in), renders the STATS tab with the page's own
                                                    function, and records every row: its label, what it prints, and why a
                                                    missing one is missing → probe-<label>.json beside this file */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [job, label, a3, a4, a5] = process.argv.slice(2);
const here = path.dirname(fileURLToPath(import.meta.url));
const hubRoot = process.env.HUB_ROOT || path.resolve(here, "../../../..");
const screens = path.join(here, "..", "screens");
fs.mkdirSync(screens, { recursive: true });
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
const context = await browser.newContext({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: job === "shots" ? 2 : 1, serviceWorkers: "block" });
await context.addInitScript(() => { try { localStorage.setItem("hub.company.tab", "STATS"); } catch (_) {} });
await context.route("**/*", async (route) => {
  const req = route.request(), u = new URL(req.url()), m = req.method();
  if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") {
    writes.push({ method: m, url: u.host + u.pathname });
    return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" });
  }
  if (u.host === "scintillahub.ai") {
    if (u.pathname.startsWith("/api/")) return route.continue();
    const f = localFile(hubRoot, u.pathname);
    if (!f) return route.fulfill({ status: 404, body: "not found" });
    return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream", "access-control-allow-origin": "*", "cache-control": "no-store" }, body: fs.readFileSync(f) });
  }
  return route.continue();
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.length < 20 && errors.push(String(e.message).slice(0, 200)));
const out = { job, label, hubRoot, at: new Date().toISOString(), results: [], writes, errors };
try {
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".sc-board__row[data-t]", { timeout: 60000 });
  await sleep(6000);   // the board's quotes, the heartbeat and the volume batteries land
  /* the served set is the page's whole-universe rows (ALLROWS, the latest pull), not the list on screen (the board opens on FAVORITES) */
  const boardT = await page.evaluate(() => { const all = (typeof ALLROWS !== "undefined" && ALLROWS && ALLROWS.length) ? ALLROWS.map((r) => r && r.t).filter(Boolean)
    : (typeof BOARD_SNAPSHOT !== "undefined" && BOARD_SNAPSHOT && BOARD_SNAPSHOT.rows) ? BOARD_SNAPSHOT.rows.map((r) => r && r.t).filter(Boolean) : [];
    return all.length ? [...new Set(all)] : [...document.querySelectorAll(".sc-board__row[data-t]")].map((r) => r.dataset.t); });
  out.board = boardT.length;
  out.boardOnScreen = await page.evaluate(() => document.querySelectorAll(".sc-board__row[data-t]").length);
  /* the rows of the rendered tab: block → [label, printed value, hover] — the same markup the person sees */
  const readRows = `(html) => { const d = document.createElement("div"); d.innerHTML = html; const blocks = [];
    for (const s of d.querySelectorAll("section.st-blk")) { const h = s.querySelector("h3"), rows = [];
      for (const r of s.querySelectorAll(":scope > div")) { const l = r.querySelector("span, .st-vis__l"), v = r.querySelector("b");
        rows.push({ label: (l ? l.textContent : "").trim(), value: (v ? v.textContent : r.textContent).replace(/\\s+/g, " ").trim(), ns: !!(v && v.classList.contains("ns")), title: r.getAttribute("title") || "" }); }
      blocks.push({ block: (h ? h.textContent : "").trim(), rows }); }
    return { blocks, foot: (d.querySelector(".st-foot") || {}).textContent || "", none: /No stats inputs loaded/.test(html) }; }`;
  if (job === "shots") {
    for (const t of String(a3 || "MU,SPY").split(",")) {
      const r = { t };
      await page.evaluate((x) => openCo(x), t);
      try { await page.waitForSelector('[data-act="cotab"][data-tab="STATS"]', { timeout: 30000 }); } catch (_) { r.noTab = true; }
      await page.evaluate(() => { const b = document.querySelector('[data-act="cotab"][data-tab="STATS"]'); if (b) b.click(); });
      try { await page.waitForSelector(".cv-side .st1, .cv-side .sc-senttxt", { timeout: 30000 }); } catch (_) { r.noStats = true; }
      await sleep(5000);
      const full = path.join(screens, `${label}-${t}-1680-STATS.png`);
      await page.screenshot({ path: full, type: "png" }); r.file = full;
      const slot = await page.$("#coRailContent");
      if (slot) { const zoom = path.join(screens, `zoom-${label}-${t}-1680-STATS.png`); await slot.screenshot({ path: zoom, type: "png" }); r.zoom = zoom;
        r.rect = await slot.boundingBox(); r.scroll = await slot.evaluate((e) => e.scrollHeight + "/" + e.clientHeight); }
      r.rows = await page.evaluate(`(${readRows})(document.querySelector(".cv-side .st1") ? document.querySelector(".cv-side .st1").outerHTML : "")`);
      r.overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      out.results.push(r);
    }
  } else {
    const nS = +(a3 || 40), nF = +(a4 || 10), walk = ["SPY", "QQQ", "IWM", "SMH", "XLK"];
    /* which of the board's names are funds: the profile flag, read once for the whole board (one request) */
    const flags = await page.evaluate(async (ts) => { const m = {}; for (let i = 0; i < ts.length; i += 200) {
      const rows = await pg("company_profile?ticker=in.(" + ts.slice(i, i + 200).join(",") + ")&select=ticker,is_etf,is_fund");
      for (const r of rows) m[r.ticker] = { is_etf: r.is_etf === true, is_fund: r.is_fund === true }; } return m; }, boardT);
    const asked = a5 ? String(a5).split(",") : null;
    const funds = boardT.filter((t) => flags[t] && (flags[t].is_etf || flags[t].is_fund)), stocks = boardT.filter((t) => flags[t] && !flags[t].is_etf && !flags[t].is_fund);
    const noProfile = boardT.filter((t) => !flags[t]);
    const pick = (arr, n, seed) => { const a = arr.slice(); let s = seed; for (let i = a.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor(s / 233280 * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
    const sampleF = asked ? asked.filter((t) => funds.includes(t)) : [...new Set([...walk.filter((t) => funds.includes(t)), ...pick(funds.filter((t) => !walk.includes(t)), nF, 7)])].slice(0, Math.max(nF, 5));
    const sampleS = asked ? asked.filter((t) => !funds.includes(t)) : [...new Set(["MU", "NVDA", "AAPL", ...pick(stocks.filter((t) => !["MU", "NVDA", "AAPL"].includes(t)), nS, 11)])].slice(0, nS);
    out.counts = { board: boardT.length, funds: funds.length, stocks: stocks.length, noProfile: noProfile.length, noProfileNames: noProfile.slice(0, 40) };
    for (const t of [...sampleS, ...sampleF]) {
      const r = { t, fund: funds.includes(t) };
      try {
        const got = await page.evaluate(`(async () => { const data = await fetchCompanyData(${JSON.stringify(t)}); const html = statsTabHTML(data);
          const p = data._profile || {}, f = data._fund, etf = data._etf, row = (typeof coBoardRow === "function" ? coBoardRow(data.t) : null) || {};
          return { html, tab: (${readRows})(html), have: { profile: !!p.ticker, shares_out: p.shares_out != null, market_cap: p.market_cap != null, avg_volume: p.avg_volume != null,
            float_shares: p.float_shares != null, short_interest: p.short_interest != null, dividend_per_share: p.dividend_per_share != null, ex_dividend_date: p.ex_dividend_date != null,
            fundamentals: !!f, eps_ttm: !!(f && f.eps_ttm != null), revenue_ttm: !!(f && f.revenue_ttm != null), boardRev: row.rev != null || !!row.revCcy, estimates: (data._est || []).length,
            pt: !!data._pt, etf_row: !!etf, etf_aum: !!(etf && etf.aum != null), etf_expense: !!(etf && etf.expense_ratio != null), etf_holdings: !!(etf && etf.holdings_count != null), etf_inception: !!(etf && etf.inception_date),
            events: (data.events || []).length, price: data.price != null, is_etf: p.is_etf === true, is_fund: p.is_fund === true } }; })()`);
        r.tab = got.tab; r.have = got.have;
      } catch (e) { r.err = String(e.message).slice(0, 200); }
      out.results.push(r);
    }
  }
} catch (e) { out.error = String(e && e.stack || e).slice(0, 800); }
finally { await browser.close().catch(() => {}); }
const file = path.join(here, `${job}-${label}.json`);
fs.writeFileSync(file, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ file, board: out.board, counts: out.counts, results: out.results.length, errors: out.errors, writes: out.writes.length, error: out.error }));

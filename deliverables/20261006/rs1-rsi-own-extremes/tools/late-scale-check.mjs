/* RS1 (7 Oct 2026) — A REAL-BROWSER CHECK OF ONE REPAIR: a name's own scale that lands AFTER its number.
     node late-scale-check.mjs <label> <indexFile>
   THE CASE. Type a ticker in the board's search that is NOT in the list on screen. The board draws it from the whole
   universe; its RSI number is read and painted (on 30 / 70, because its own scale has not arrived); then its own scale
   arrives. The 6 Oct code recoloured only names found in the active list, so this cell stayed on 30 / 70 until the next
   board rebuild. The repair: the cell carries the exact number it shows (data-rsi) and is recoloured from it.
   HOW. Headless (never a visible window). The browser opens https://scintillahub.ai/ and this script answers the page
   from <indexFile>; the one read of the not-yet-applied table public.rsi_own_percentiles is answered from the loader's
   dry run AFTER A 4-SECOND DELAY, so the number always lands first. Every other read is live; every non-GET request is
   aborted and counted. The name is picked from the dry run: inside its own bottom tenth but above 30, so the two rules
   visibly disagree (30 / 70: no breath; own scale: breathes). Writes rec-late-scale-<label>.json beside this file. */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [label = "fixed", indexFile = ""] = process.argv.slice(2);
const here = path.dirname(fileURLToPath(import.meta.url));
if (!indexFile || !fs.existsSync(indexFile)) { console.error("no page file"); process.exit(2); }
const dry = JSON.parse(fs.readFileSync(path.join(here, "..", "data", "rsi-own-dry-run.json"), "utf8")).rows;
const dryBy = new Map(dry.map((r) => [r.ticker, r]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DELAY = 4000;
const out = { label, at: new Date().toISOString(), page_file: path.basename(indexFile), delay_ms: DELAY, writes_attempted: 0, page_errors: 0, own_reads: [] };
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
try {
  const context = await browser.newContext({ viewport: { width: 1680, height: 1050 }, serviceWorkers: "block" });
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") { out.writes_attempted++; return route.abort(); }
    if (u.host === "scintillahub.ai" && (u.pathname === "/" || u.pathname === "/index.html"))
      return route.fulfill({ status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }, body: fs.readFileSync(indexFile) });
    if (u.pathname === "/rest/v1/rsi_own_percentiles") {
      const want = (u.searchParams.get("ticker") || "").replace(/^(in\.\(|eq\.)/, "").replace(/\)$/, "").split(",").map(decodeURIComponent).filter(Boolean);
      const since = (u.searchParams.get("as_of") || "").replace(/^gte\./, ""), cols = (u.searchParams.get("select") || "").split(",").filter(Boolean);
      const rows = want.map((t) => dryBy.get(t)).filter((r) => r && (!since || r.as_of >= since)).map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])));
      out.own_reads.push({ names: want.length, sent_after_ms: DELAY });
      await sleep(DELAY);                                       // the scale lands late, on purpose
      return route.fulfill({ status: 200, headers: { "content-type": "application/json", "access-control-allow-origin": "*" }, body: JSON.stringify(rows) }).catch(() => {});
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", () => out.page_errors++);
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector(".sc-board__row[data-t]", { timeout: 90000 });
  await page.waitForFunction(() => window.SC_RANK_READY === true, null, { timeout: 60000 }).catch(() => {});
  await sleep(9000);                                            // the opening list's own (delayed) scales have landed
  out.opening_list = await page.evaluate(() => (typeof S !== "undefined" ? S.coh : null));
  const inList = new Set(await page.evaluate(() => (S.rows || []).map((r) => r.t)));
  const universe = new Set(await page.evaluate(() => (typeof ALLROWS !== "undefined" ? ALLROWS : []).map((r) => r.t)));
  out.list_names = inList.size; out.universe_names = universe.size;
  /* a name outside the list whose two rules disagree visibly, and whose ticker is no other name's prefix */
  const cands = dry.filter((r) => r.eligible && r.pct <= 8 && r.rsi > 32 && !inList.has(r.ticker) && universe.has(r.ticker) && ![...universe].some((t) => t !== r.ticker && t.startsWith(r.ticker)));
  out.candidates = cands.length;
  for (const pick of cands.slice(0, 6)) {
    const T = pick.ticker;
    await page.evaluate((T) => { const i = document.getElementById("cohSearchInput"); i.value = T; i.dispatchEvent(new Event("input", { bubbles: true })); }, T);
    const got = await page.waitForFunction((T) => { const c = document.getElementById("lr_" + T); return c && /\d/.test(c.textContent); }, T, { timeout: 15000 }).then(() => true).catch(() => false);
    if (!got) { out.skipped = (out.skipped || []).concat(T + ": no number"); continue; }
    const read = (T) => page.evaluate((T) => { const c = document.getElementById("lr_" + T); if (!c) return null; const first = !c.__probe; c.__probe = 1;
      return { same_cell: !first, text: c.textContent.trim(), color: getComputedStyle(c).color, breathes: c.classList.contains("is-xt"), own_line: c.getAttribute("data-own"), carries_number: c.getAttribute("data-rsi"),
        in_active_list: (S.rows || []).some((r) => r.t === T), scale_loaded: typeof RSI_OWN !== "undefined" && !!RSI_OWN[T] }; }, T);
    const a = await read(T);
    if (a.scale_loaded) { out.skipped = (out.skipped || []).concat(T + ": scale already loaded"); continue; }
    await sleep(DELAY + 2500);
    const b = await read(T);
    if (!b || !b.same_cell) { out.skipped = (out.skipped || []).concat(T + ": the board was rebuilt in between"); continue; }
    const want = await page.evaluate(([T, v]) => { const rd = rsiOwnRead(T, v); const d = document.createElement("i"); d.style.color = rd.color; document.body.appendChild(d); const col = getComputedStyle(d).color; d.remove(); return { color: col, breathes: rd.extreme, own_line: rd.title }; }, [T, Number(b.carries_number != null ? b.carries_number : pick.rsi)]);
    out.name = T; out.dry_run_row = { rsi: pick.rsi, pct: pick.pct, p10: pick.p10 };
    out.number_first = a; out.after_its_scale_landed = b; out.own_scale_says = want;
    out.recoloured = b.scale_loaded && b.color === want.color && b.breathes === want.breathes && !!b.own_line;
    await page.screenshot({ path: path.join(here, "..", "pictures", `late-scale-${label}.png`), clip: await page.evaluate((T) => { const r = document.querySelector('#boardScroll [data-act="row"][data-t="' + T + '"]').getBoundingClientRect(); return { x: Math.max(0, r.x - 2), y: Math.max(0, r.y - r.height), width: r.width + 4, height: r.height * 3 }; }, T) });
    break;
  }
} catch (e) { out.failed = String(e && e.message || e).slice(0, 300); }
finally { await browser.close(); }
fs.writeFileSync(path.join(here, `rec-late-scale-${label}.json`), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));

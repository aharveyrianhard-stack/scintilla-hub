/* TR1 · headless proof that adopting the tree changes NO Hub screen. NEVER a visible window.
   The Hub page of this branch under its real hostname (files from the checkout), the live database with the public
   key, the live chart API. Every non-GET is answered locally and counted.
     node hub-no-change-proof.mjs before <width>   → the Hub as it is today (the two new tables do not exist)
     node hub-no-change-proof.mjs after  <width>   → the same page with the two new tables PRESENT: every request to
                                                      /rest/v1/cohort_tree* is answered with the loader's own rows
   Each run writes shots/<mode>-<width>-<screen>.png and facts-<mode>-<width>.json. compare.mjs then sets them side by side.
   What is compared is structure (tabs, cohort keys, cohort → ticker sets, the names on each screen), not prices:
   prices move between two runs while the market is open. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module"; import crypto from "node:crypto";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [mode, widthS] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url)), D = path.dirname(HERE), HUB_ROOT = path.resolve(D, "../../.."), OUT = path.join(D, "shots");
const width = +widthS, mobile = width < 500, height = mobile ? 844 : 1050;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
function localFile(p) { let f = path.normalize(path.join(HUB_ROOT, decodeURIComponent(p))); if (!f.startsWith(HUB_ROOT)) return null; if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); return fs.existsSync(f) ? f : null; }
/* the loader's rows, read back out of the generated LOAD file's source of truth (the loader itself) */
const { buildTree } = await import(path.join(HUB_ROOT, "scripts/cohort-tree-loader.mjs"));
const J = (p) => JSON.parse(fs.readFileSync(path.join(HUB_ROOT, p), "utf8"));
const tree = buildTree({ proposal: J("deliverables/20261006/cohort-proposal/proposal.json"), indexLayer: J("deliverables/20261006/tree-adopted/index-layer.json"), served: J("deliverables/20261006/cohort-proposal/data/universe-20261006.json").symbols });
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
let probing = false;
const writes = [], errors = [], newTableRequests = [], restTables = {}, out = { mode, width, page_sha: sha(fs.readFileSync(path.join(HUB_ROOT, "index.html"))) };
try {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, serviceWorkers: "block", isMobile: mobile, hasTouch: mobile });
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") { writes.push(m + " " + u.host + u.pathname); return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" }); }
    const rest = u.pathname.match(/^\/rest\/v1\/([a-z0-9_]+)/i);
    if (rest && m === "GET" && !probing) restTables[rest[1]] = (restTables[rest[1]] || 0) + 1;
    if (rest && /^cohort_tree/.test(rest[1])) {
      const probe = probing;
      if (!probe) newTableRequests.push(u.pathname + u.search);
      if (mode === "after") return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: JSON.stringify(rest[1] === "cohort_tree" ? tree.nodes : tree.members) });
    }
    if (u.host === "scintillahub.ai") { if (u.pathname.startsWith("/api/")) return route.continue(); const f = localFile(u.pathname); if (!f) return route.fulfill({ status: 404, body: "not found" }); return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream" }, body: fs.readFileSync(f) }); }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.length < 20 && errors.push(String(e.message).slice(0, 200)));
  fs.mkdirSync(OUT, { recursive: true });
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => { try { return !!COHSETS && document.querySelectorAll(".sc-board__row").length > 5; } catch (_) { return false; } }, null, { timeout: 120000 }).catch(() => {});
  await sleep(6000);
  /* what the live database says about the two table names, asked with the page's own public key (a probe this script makes itself; not counted as a Hub request. In the AFTER run the two new names answer from the loader, by design) */
  probing = true;
  out.live_probe = await page.evaluate(async () => { const r = {}; for (const t of ["cohort_tree", "cohort_tree_members", "ticker_cohorts"]) { try { const x = await fetch(SB + "/rest/v1/" + t + "?select=*&limit=1", { headers: { apikey: ANON, Authorization: "Bearer " + ANON } }); r[t] = x.status; } catch (e) { r[t] = "ERR " + e.message; } } return r; });
  probing = false;
  const names = (els) => [...new Set(els.map((e) => (e.getAttribute("data-t") || e.getAttribute("data-tk") || e.getAttribute("data-ticker") || (e.textContent || "").trim().split(/\s+/)[0] || "")).filter(Boolean))];
  const facts = () => page.evaluate(() => {
    const rows = [...document.querySelectorAll(".sc-board__row")];
    const tk = (e) => e.getAttribute("data-t") || e.getAttribute("data-tk") || e.getAttribute("data-ticker") || ((e.textContent || "").trim().split(/\s+/)[0] || "");
    return { rows: rows.length, tickers: [...new Set(rows.map(tk))].sort().join(","), cohortButtons: [...new Set([...document.querySelectorAll('[data-act="coh"]')].map((b) => b.getAttribute("data-key")))].sort().join(","),
      masterTabs: [...document.querySelectorAll('[data-act="mtab"]')].map((b) => b.getAttribute("data-sec")).join(","), overflow: document.documentElement.scrollWidth - window.innerWidth };
  });
  out.cohsets = await page.evaluate(() => { try { const k = Object.keys(COHSETS).sort(); return { cohorts: k.length, rows: k.reduce((n, c) => n + COHSETS[c].size, 0), signature: k.map((c) => c + ":" + [...COHSETS[c]].sort().join("|")).join(";") }; } catch (e) { return { error: String(e.message) }; } });
  out.cohsets.signature = out.cohsets.signature ? sha(out.cohsets.signature) : null;
  out.cohsets.has_tree_ids = await page.evaluate(() => { try { return ["AI_ACCELERATORS", "IDX_WORLD", "NEOCLOUDS_MINERS", "IDX_FACTOR"].filter((k) => COHSETS[k]); } catch (_) { return null; } });
  out.screens = {};
  const snap = async (name) => { await sleep(2500); const f = await facts(); f.tickers_sha = sha(f.tickers); f.cohortButtons_sha = sha(f.cohortButtons); f.tickers_n = f.tickers ? f.tickers.split(",").length : 0; f.cohortButtons_n = f.cohortButtons ? f.cohortButtons.split(",").length : 0; delete f.tickers; const keys = f.cohortButtons; delete f.cohortButtons; out.screens[name] = f; out.cohortKeys = out.cohortKeys || keys; await page.screenshot({ path: path.join(OUT, `${mode}-${width}-${name}.png`) }); };
  await snap("home");
  const secs = (await page.evaluate(() => [...document.querySelectorAll('[data-act="mtab"]')].map((b) => b.getAttribute("data-sec")))).slice(0, 12);
  /* every cohort the board offers that the tree could have disturbed, then every master tab */
  for (const key of ["AI_HARDWARE", "GROWTH", "THEMATIC", "MEGACAP", "INTL", "INDEXES"]) {
    const ok = await page.evaluate((k) => { const b = document.querySelector('[data-act="coh"][data-key="' + k + '"]'); if (b) { b.click(); return true; } return false; }, key);
    if (ok) await snap("cohort-" + key); else out.screens["cohort-" + key] = { absent: true };
  }
  for (const s of secs) { const ok = await page.evaluate((k) => { const b = document.querySelector('[data-act="mtab"][data-sec="' + k + '"]'); if (b) { b.click(); return true; } return false; }, s); if (ok) await snap("tab-" + s); }
  out.errors = errors; out.writes = writes.length; out.writeList = [...new Set(writes)].slice(0, 8);
  out.hub_requests_to_new_tables = newTableRequests.length; out.rest_tables_read = Object.keys(restTables).sort();
  fs.writeFileSync(path.join(D, `facts-${mode}-${width}.json`), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ mode, width, cohsets: out.cohsets, probe: out.live_probe, new_table_requests: out.hub_requests_to_new_tables, screens: Object.keys(out.screens).length, errors: errors.length, writes: writes.length, tables: out.rest_tables_read.length }));
} finally { await browser.close(); }

// HC1 — the headless rig every picture and walk in this folder uses.
//
//   · HEADLESS ONLY (never a window on Alan's screen); service workers blocked.
//   · EVERY request that is not a GET is stopped before it leaves the browser, and counted.
//   · The page is opened at https://scintillahub.ai/ (the only origin the chart API answers). For the branch, the
//     worktree's own files are served at that address — index.html and anything else that exists in the worktree —
//     so the picture is the branch as it would deploy. Everything else (the chart API, the database's reads) is live.
//   · For the FAVORITES walk, public.station_lists is a STAND-IN held in this process: seeded from the copy read by GET
//     (data/lists-as-read.json) and following the database's own rules as read from its catalog (primary key, the list,
//     ticker and position checks). Reads and writes of that one table are answered here; nothing is written anywhere.
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const D = path.dirname(HERE);
export const REPO = path.resolve(D, "..", "..", "..");
export const HUB = "https://scintillahub.ai/";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };

/* public.station_lists, as a stand-in. cap = the position check's upper bound (64 when Alan hit the bug; 256 since the coordinator's fix, 6 Oct ~19:40 ET). */
export function standInLists({ cap = 64, rows = null } = {}) {
  const seed = rows || JSON.parse(fs.readFileSync(path.join(D, "data", "lists-as-read.json"), "utf8")).station_lists;
  let T = seed.map((r) => ({ list: r.list, position: r.position, ticker: r.ticker, updated_at: r.updated_at }));
  const log = [];
  const refusal = (which) => ({ code: "23514", details: "Failing row contains (…).", hint: null,
    message: 'new row for relation "station_lists" violates check constraint "station_lists_' + which + '_check"' });
  const inList = (q) => { const m = /^in\.\((.*)\)$/.exec(q || ""); if (m) return m[1].split(","); const e = /^eq\.(.*)$/.exec(q || ""); return e ? [e[1]] : null; };
  return {
    log, cap: (n) => { cap = n; }, getCap: () => cap,
    list: (l) => T.filter((r) => r.list === l).sort((a, b) => a.position - b.position).map((r) => r.ticker),
    handle(method, url, body) {
      const u = new URL(url), q = u.searchParams;
      if (method === "GET") {
        const want = inList(q.get("list"));
        const sel = (q.get("select") || "list,position,ticker,updated_at").split(",");
        const out = T.filter((r) => !want || want.includes(r.list)).sort((a, b) => a.list.localeCompare(b.list) || a.position - b.position)
          .map((r) => Object.fromEntries(sel.map((k) => [k, r[k]])));
        return { status: 200, body: out };
      }
      if (method === "POST") {
        const rowsIn = JSON.parse(body || "[]");
        for (const r of rowsIn) {                                   // one statement: every row is checked before any is stored
          if (!/^[a-z_]{2,24}$/.test(r.list)) { log.push({ method, refused: "list", n: rowsIn.length }); return { status: 400, body: refusal("list") }; }
          if (!(r.position >= 1 && r.position <= cap)) { log.push({ method, refused: "position", n: rowsIn.length, list: r.list }); return { status: 400, body: refusal("position") }; }
          if (!/^[A-Z0-9.\-]{1,12}$/.test(r.ticker)) { log.push({ method, refused: "ticker", n: rowsIn.length }); return { status: 400, body: refusal("ticker") }; }
        }
        for (const r of rowsIn) { T = T.filter((x) => !(x.list === r.list && x.position === r.position)); T.push({ list: r.list, position: r.position, ticker: r.ticker, updated_at: r.updated_at }); }
        log.push({ method, stored: rowsIn.length, list: rowsIn[0] && rowsIn[0].list });
        return { status: 201, body: null };
      }
      if (method === "DELETE") {
        const l = (inList(q.get("list")) || [])[0], gt = +String(q.get("position") || "").replace("gt.", "");
        const before = T.length; T = T.filter((x) => !(x.list === l && x.position > gt));
        log.push({ method, trimmed: before - T.length, list: l });
        return { status: 204, body: null };
      }
      return { status: 405, body: { message: "method not allowed" } };
    },
  };
}

/* open one headless browser on the Hub. local = a worktree folder to serve as the site (null = the site as deployed). */
export async function openHub({ width = 1680, height = null, local = null, lists = null, hash = "", indexHtml = null, listDelayMs = 350 } = {}) {
  const phone = width < 500;
  const H = height || (phone ? 844 : 1050);
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width, height: H }, deviceScaleFactor: phone ? 2 : 1,
    isMobile: phone, hasTouch: phone });
  const count = { blocked: 0, blockedList: [], answeredHere: 0, servedLocal: 0, consoleErrors: [] };
  await ctx.route("**/*", async (route) => {
    const req = route.request(), method = req.method(), url = req.url();
    if (lists && /\/rest\/v1\/station_lists(\?|$)/.test(url) && method !== "OPTIONS") {
      const a = lists.handle(method, url, req.postData());
      count.answeredHere++;
      await sleep(listDelayMs);                                     // a round trip to the database takes about this long; without it the star's flash cannot be seen
      return route.fulfill({ status: a.status, contentType: "application/json; charset=utf-8",
        headers: { "access-control-allow-origin": "*", "access-control-expose-headers": "*" }, body: a.body == null ? "" : JSON.stringify(a.body) });
    }
    if (lists && /\/rest\/v1\/station_lists(\?|$)/.test(url) && method === "OPTIONS")
      return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,DELETE,PATCH,OPTIONS", "access-control-allow-headers": "*" }, body: "" });
    if (method !== "GET" && method !== "OPTIONS" && method !== "HEAD") { count.blocked++; count.blockedList.push(method + " " + url.split("?")[0]); return route.abort(); }
    if (method === "GET" && url.startsWith(HUB)) {
      const u = new URL(url);
      let rel = decodeURIComponent(u.pathname).replace(/^\/+/, "");
      if (rel === "" || rel.endsWith("/")) rel += "index.html";
      if (indexHtml && rel === "index.html") { count.servedLocal++; return route.fulfill({ status: 200, contentType: TYPES[".html"], body: indexHtml }); }
      if (local && !rel.startsWith("api/") && !rel.includes("..")) {
        const f = path.join(local, rel);
        if (fs.existsSync(f) && fs.statSync(f).isFile()) {
          count.servedLocal++;
          return route.fulfill({ status: 200, contentType: TYPES[path.extname(f).toLowerCase()] || "application/octet-stream", body: fs.readFileSync(f) });
        }
      }
    }
    return route.continue();
  });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") count.consoleErrors.push(m.text().slice(0, 300)); });
  page.on("pageerror", (e) => count.consoleErrors.push("PAGEERROR " + String(e).slice(0, 300)));
  await page.goto(HUB + (hash || ""), { waitUntil: "domcontentloaded", timeout: 90000 });
  return { browser, ctx, page, count, close: async () => { try { await browser.close(); } catch (_) {} } };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const sha12 = (buf) => crypto.createHash("sha256").update(buf).digest("hex").slice(0, 12);

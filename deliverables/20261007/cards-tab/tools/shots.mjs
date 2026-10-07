/* CP2 (7 Oct 2026) · headless proof for the CARDS tab. NEVER a visible window. A Hub checkout is served under the real
   hostname (files from --root, default this branch), with the live database through the public key and the live chart
   API; every request that is not a GET is answered locally and counted. The browser is closed before the script ends.
     node shots.mjs <width> <ticker> [--root <hub checkout>] [--tab CARDS] [--name <prefix>] [--expand] [--estflag]
   --estflag turns on the page's own switch for the flag line at the top of the ESTIMATES tab (it is off in the page).
   Writes shots/<prefix>-<ticker>-<width>.png (the screen as it opens), …-full-… (the whole tab, unclipped) and, for the
   CARDS tab, one picture per block; prints one JSON line of what the page really holds. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const argv = process.argv.slice(2), flag = (k, d) => { const i = argv.indexOf("--" + k); return i < 0 ? d : (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : true); };
const [widthS, ticker = "MU"] = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--") && !["--expand", "--estflag"].includes(argv[i - 1])));
const HERE = path.dirname(fileURLToPath(import.meta.url)), HUB_ROOT = path.resolve(String(flag("root", path.resolve(HERE, "../../../.."))));
const OUT = path.join(HERE, "..", "shots"), tab = String(flag("tab", "CARDS")), name = String(flag("name", tab.toLowerCase())), expand = !!flag("expand", false), estflag = !!flag("estflag", false);
const width = +widthS, mobile = width < 500, height = mobile ? 844 : 1050;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".woff2": "font/woff2" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function localFile(p) { let f = path.normalize(path.join(HUB_ROOT, decodeURIComponent(p))); if (!f.startsWith(HUB_ROOT)) return null; if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null; }
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
const writes = [], apiFail = [], errors = [], missing = [], out = { width, ticker, tab, root: path.basename(HUB_ROOT) };
try {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mobile ? 2 : 1, serviceWorkers: "block", isMobile: mobile, hasTouch: mobile });
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") { writes.push(m + " " + u.host + u.pathname); return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" }); }
    if (u.host === "scintillahub.ai") {
      if (u.pathname.startsWith("/api/")) return route.continue();
      const f = localFile(u.pathname);
      if (!f) { if (/\/deliverables\//.test(u.pathname)) missing.push(u.pathname); return route.fulfill({ status: 404, body: "not found" }); }
      return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" }, body: fs.readFileSync(f) });
    }
    return route.continue();
  });
  if (estflag) await context.addInitScript(() => { window.SC_EST_FLAG_LINE = true; });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.length < 20 && errors.push(String(e.message).slice(0, 200)));
  page.on("response", (r) => { if (/massive-chart-api/.test(r.url()) && r.status() >= 400) apiFail.push(new URL(r.url()).pathname + " " + r.status()); });
  fs.mkdirSync(OUT, { recursive: true });
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(9000);
  await page.evaluate((t) => { openCo(t); }, ticker); await sleep(3500);
  if (expand) { await page.evaluate(() => { const b = document.querySelector('[data-act="coexpand"], [data-act="cvexpand"], .cv-expand'); if (b) b.click(); }); await sleep(1500); }
  out.tabs = await page.evaluate(() => [...document.querySelectorAll("#cvTabs [data-tab]")].map((b) => b.dataset.tab + (b.classList.contains("on") ? "*" : "")));
  const clicked = await page.evaluate((t) => { const b = document.querySelector('#cvTabs [data-act="cotab"][data-tab="' + t + '"]') || document.querySelector('[data-act="cotab"][data-tab="' + t + '"]'); if (b) { b.click(); return true; } return false; }, tab);
  out.clicked = clicked;
  if (tab === "CARDS" && clicked) { try { await page.waitForSelector("#scCardsTab .cd-card, #scCardsTab .cd-none, #scCardsTab .cd-err", { timeout: 60000 }); } catch (_) { out.timeout = true; } }
  else if (tab === "ESTIMATES" && estflag) { try { await page.waitForSelector("#scEstFlag .cd-flag", { timeout: 30000 }); } catch (_) { out.timeout = true; } await sleep(4000); }
  else await sleep(6000);
  await sleep(1800);
  if (tab === "ESTIMATES") out.estFlag = await page.evaluate(() => { const e = document.getElementById("scEstFlag"); return e ? { text: e.innerText.replace(/\s+/g, " ").trim(), firstInTab: !!(e.parentElement && e.parentElement.firstElementChild === e), next: e.nextElementSibling ? (e.nextElementSibling.className || "").toString().slice(0, 30) : null } : null; });
  const shot = async (suffix, sel) => { if (sel) { const ok = await page.evaluate((s) => { const e = document.querySelector(s); if (e) { e.scrollIntoView({ block: "start" }); return true; } return false; }, sel); if (!ok) return false; await sleep(450); } await page.screenshot({ path: path.join(OUT, `${name}-${ticker}${suffix ? "-" + suffix : ""}-${width}.png`) }); return true; };
  await shot("");
  out.layout = await page.evaluate(() => { const r = document.getElementById("coRailContent"), c = document.getElementById("cv"); const b = (e) => e ? (({ x, y, width, height }) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(width), h: Math.round(height) }))(e.getBoundingClientRect()) : null; return { rail: b(r), cv: b(c), vw: innerWidth, vh: innerHeight, pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth }; });
  if (tab === "CARDS") {
    out.card = await page.evaluate(() => {
      const box = document.getElementById("scCardsTab"); if (!box) return { box: false };
      const T = (s, root = box) => { const e = root.querySelector(s); return e ? e.innerText.replace(/\s+/g, " ").trim().slice(0, 700) : null; };
      const specs = box.querySelector("details.sc-pagespecs"), all = box.innerText, content = all.replace(specs ? specs.innerText : "", "");
      const small = [...box.querySelectorAll("*")].filter((e) => e.children.length === 0 && e.textContent.trim() && !e.closest("svg")).map((e) => parseFloat(getComputedStyle(e).fontSize)).filter((v) => v > 0);
      return { box: true, head: T(".cd-head"), source: T(".cd-src"), pies: [...box.querySelectorAll(".cd-pie")].map((p) => ({ title: T(".cd-pt", p), wedges: p.querySelectorAll("svg path.w").length, dc: p.querySelectorAll("svg path.w.dc").length, legend: [...p.querySelectorAll(".cd-lg li")].map((li) => li.innerText.replace(/\s+/g, " ").trim()), note: T(".cd-pn", p) })),
        chips: [...box.querySelectorAll(".cd-chips .cd-chip")].map((c) => c.innerText.replace(/\s+/g, " ").trim()), blend: [...box.querySelectorAll(".cd-blend .cd-bl")].map((c) => c.innerText.replace(/\s+/g, " ").trim()), blendTitles: [...box.querySelectorAll(".cd-blend .cd-bl")].map((c) => (c.getAttribute("title") || "").slice(0, 400)),
        side: [...box.querySelectorAll(".cd-side tbody tr")].map((r) => r.innerText.replace(/\s+/g, " ").trim()), flag: T(".cd-flag"), zones: [...box.querySelectorAll(".cd-zones .zr")].map((r) => r.innerText.replace(/\s+/g, " ").trim()), zonesOverflow: (() => { const z = box.querySelector(".cd-zones"); return z ? z.scrollWidth > z.clientWidth + 1 : null; })(),
        sections: [...box.querySelectorAll(".cd-h")].map((h) => h.innerText.trim()), specs: !!specs, specsOpen: specs ? specs.open : null, none: T(".cd-none"), err: T(".cd-err"),
        sentencesInContent: (content.match(/[a-z]{3,}\s[a-z]+\s[a-z]+\s[a-z]+\s[a-z]+\s[a-z]+\s[a-z]+\s[a-z]+/g) || []).slice(0, 8), minFont: small.length ? Math.min(...small) : null, boxW: box.clientWidth, boxSW: box.scrollWidth };
    });
    for (const [suffix, sel] of [["business", "#scCardsTab .cd-biz"], ["fundamentals", "#scCardsTab .cd-fund"], ["levels", "#scCardsTab .cd-lev"], ["plan", "#scCardsTab .cd-plan"]]) await shot(suffix, sel);
    /* hover one pie wedge and one blend chip: the hover text is part of the brief */
    out.hover = await page.evaluate(() => { const w = document.querySelector("#scCardsTab .cd-pie svg path.w title"), b = document.querySelector("#scCardsTab .cd-blend .cd-bl"); return { wedge: w ? w.textContent : null, blend: b ? b.getAttribute("title") : null }; });
  }
  /* the whole tab: a copy of the box laid on top of the page at the same width and the same scale (the Hub scales the company
     view), so no panel edge or sticky header crosses it; the window is made as tall as the copy for this one picture */
  const dim = await page.evaluate((isCards) => {
    const box = document.getElementById(isCards ? "scCardsTab" : "coRailContent"); if (!box) return null;
    const scale = box.getBoundingClientRect().width / box.clientWidth, w = box.clientWidth;
    const wrap = document.createElement("div"); wrap.id = "cdFullWrap";
    wrap.style.cssText = "position:absolute;left:0;top:0;z-index:2147483000;background:var(--bg);padding:10px;box-sizing:content-box;width:" + w + "px";
    const copy = box.cloneNode(true); copy.removeAttribute("id"); copy.style.cssText = "overflow:visible;height:auto;max-height:none";
    wrap.appendChild(copy); document.body.appendChild(wrap);
    /* the Hub's scale may sit on the page itself: the copy then already has it; if not, give it the same one */
    const own = wrap.getBoundingClientRect().width / wrap.offsetWidth; if (Math.abs(own - scale) > 0.02) wrap.style.zoom = String(scale / own);
    const r = wrap.getBoundingClientRect(); return { w: Math.ceil(r.width), h: Math.ceil(r.height), scale: +scale.toFixed(3) };
  }, tab === "CARDS");
  if (dim) {
    out.scale = dim.scale;
    await page.setViewportSize({ width, height: Math.min(16000, dim.h + 4) }); await sleep(700);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(OUT, `${name}-${ticker}-full-${width}.png`), clip: { x: 0, y: 0, width: Math.min(width, dim.w), height: Math.min(16000, dim.h) } }); out.full = dim;
    await page.evaluate(() => { const w = document.getElementById("cdFullWrap"); if (w) w.remove(); });
  }
  out.errors = errors; out.apiFail = apiFail.slice(0, 6); out.writes = writes.length; out.writeList = writes.slice(0, 5); out.missing = missing.slice(0, 6);
  console.log(JSON.stringify(out));
} finally { await browser.close(); }

/* V1 (3 Oct) — the visuals lab's walker. Headless only (Alan, 24 Sep: a test window stole his screen). Walks every Hub
   surface Alan uses, takes one screenshot per surface and reads the computed styles of every visible piece of text,
   every boxed panel, every divider and every button, then counts the distinct values per role.
     node walk.mjs <tag> <width> [hubRoot]
   tag = before | after (the shots folder). With hubRoot, https://scintillahub.ai/* is served from that folder (the same
   hostname, so the chart API sees its real origin and nothing needs relaxing); /api/* and anything not on disk still go
   to the live Hub. Every non-GET request is answered locally with an empty 201 and counted, never sent. */
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module"; import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [tag = "before", W = "1680", hubRoot = ""] = process.argv.slice(2);
const width = +W, height = width >= 1900 ? 1080 : 1050;
const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, "..", "shots", tag);
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".woff2": "font/woff2" };
function localFile(root, pathname) {
  let f = path.normalize(path.join(root, decodeURIComponent(pathname)));
  if (!f.startsWith(root)) return null;
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f) && fs.existsSync(f + ".html")) f += ".html";
  return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null;
}
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, serviceWorkers: "block" });
const writes = [];
await ctx.route("**/*", async (route) => {
  const req = route.request(), m = req.method(), u = new URL(req.url());
  if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") { writes.push(m + " " + u.href.slice(0, 90)); return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" }); }
  if (hubRoot && u.hostname === "scintillahub.ai" && !u.pathname.startsWith("/api/")) {
    const f = localFile(hubRoot, u.pathname);
    if (f) return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream", "access-control-allow-origin": "*" }, body: fs.readFileSync(f) });
  }
  return route.continue();
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror", String(e).slice(0, 160)));

/* ---- the measurement, run inside the page ---- */
const MEASURE = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) return false; if (r.bottom < 0 || r.right < 0 || r.top > innerHeight * 3 || r.left > innerWidth) return false; return true; };
  const sel = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : "");
  const chain = (el) => { const out = []; let e = el; for (let i = 0; e && i < 6; i++) { out.push(sel(e)); e = e.parentElement; } return out.join(" < "); };
  const isNumber = (s) => /^[\s\d.,%$+\-−()×xKMBT:/]+$/.test(s) && /\d/.test(s);
  const role = (el, txt) => {
    const c = chain(el), self = sel(el);
    const has = (re) => re.test(self), up = (re) => re.test(c);
    if (has(/\.(sc-mtab|sc-coh\b|cv-tab\b|sc-it\b|sc-soctab|ct\b|rtab|sc-cofr__tf|cv-back|sc-coexp|cv-rail__s|cv-clouds|cohChip|sc-evtab|sc-sentab|sc-tab\b)/) || el.getAttribute("role") === "tab" || (el.closest("[role=tablist]") && el.tagName === "BUTTON")) return "tab";
    if (has(/\.(sc-stamp|sc-brand|sc-logo|sc-head__t|cv-t\b)|^h1/) || up(/\.sc-stamp/)) return "page title";
    if (has(/^th\b|\.(sc-hcell|thead|hdr\b|sc-th\b|cmp-th|tbl__h|__th\b)/) || up(/\.ch\.hdr|^thead|\.sc-board__hdr|\.hdr\b/) || el.closest("thead")) return "table header";
    if (has(/\.(seccap|sc-senttxt|fn3|sc-cofl__src|sc-eq__note|sc-ytcfg__note|sc-pagespecs|sc-foot|foot\b|note\b|src\b|footer)|__note|__src|__foot|^small|^footer/) || up(/\.sc-pagespecs|^footer|\.sc-foot\b/)) return "footnote";
    if (has(/^h[2-6]|\.(sc-ihead|sc-zlabel|sc-tape__lbl|cv-rail__h|card__h|sc-sec__h|sec-h|hd\b|lbl\b|sc-lbl|mn-lbl|g2-h|gs-h|sc-h\b|ttl|title|head\b|__h\b|__hd|__lbl|__ttl|__title|__k\b|k\b|sc-kpi__k|est-h|estsec|sc-l0card__t)/)) return "section header";
    if (isNumber(txt) || getComputedStyle(el).fontVariantNumeric.includes("tabular")) return "number";
    return "body";
  };
  const text = [];
  for (const el of document.querySelectorAll("body *")) {
    if (["SCRIPT", "STYLE", "SVG", "PATH", "IFRAME", "CANVAS", "NOSCRIPT", "TEMPLATE"].includes(el.tagName)) continue;
    let own = ""; for (const n of el.childNodes) if (n.nodeType === 3) own += n.textContent;
    own = own.replace(/\s+/g, " ").trim(); if (!own) continue;
    if (!vis(el)) continue;
    const cs = getComputedStyle(el);
    text.push({ role: role(el, own), fs: parseFloat(cs.fontSize), fw: cs.fontWeight, ls: cs.letterSpacing, tt: cs.textTransform, color: cs.color, ff: cs.fontFamily.split(",")[0].replace(/"/g, ""), sel: sel(el), chain: chain(el), txt: own.slice(0, 40) });
  }
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  const panels = [], dividers = [], buttons = [];
  for (const el of document.querySelectorAll("body *")) {
    if (["SCRIPT", "STYLE", "SVG", "PATH", "IFRAME", "CANVAS"].includes(el.tagName) || !vis(el)) continue;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    const bw = ["Top", "Right", "Bottom", "Left"].map((s) => parseFloat(cs["border" + s + "Width"]) || 0), bc = cs.borderTopColor;
    const boxed = bw.every((x) => x > 0), bg = cs.backgroundColor;
    const hasBg = bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent" && bg !== bodyBg;
    if (el.tagName === "BUTTON" || el.getAttribute("role") === "button") { buttons.push({ sel: sel(el), fs: parseFloat(cs.fontSize), fw: cs.fontWeight, ls: cs.letterSpacing, border: bw[0] + "px " + bc, radius: cs.borderTopLeftRadius, bg, color: cs.color, h: Math.round(r.height), txt: (el.textContent || "").trim().slice(0, 18) }); continue; }
    if (r.width * r.height > 4000 && (boxed || hasBg)) panels.push({ sel: sel(el), bg, border: boxed ? bw[0] + "px " + bc : "none", radius: cs.borderTopLeftRadius, shadow: cs.boxShadow !== "none" ? cs.boxShadow.slice(0, 50) : "none", w: Math.round(r.width), h: Math.round(r.height) });
    else if (!boxed && r.width > 120 && (bw[2] > 0 || bw[0] > 0)) dividers.push({ sel: sel(el), line: (bw[2] || bw[0]) + "px " + (bw[2] ? cs.borderBottomColor : bc) });
  }
  const cv = document.getElementById("cv"), ch = document.getElementById("cvChart"), side = document.querySelector(".cv-side");
  const split = cv && ch && side ? { cv: Math.round(cv.getBoundingClientRect().height), chart: Math.round(ch.getBoundingClientRect().height), side: Math.round(side.getBoundingClientRect().height), tabs: Math.round((document.getElementById("cvTabs") || { getBoundingClientRect: () => ({ height: 0 }) }).getBoundingClientRect().height), zoom: getComputedStyle(document.documentElement).zoom } : null;
  const mtabs = [...document.querySelectorAll("#mtabs .sc-mtab")].map((b) => { const cs = getComputedStyle(b); return { t: b.textContent.trim(), tag: b.tagName, ta: cs.textAlign, td: cs.textDecorationLine, disp: cs.display, fs: cs.fontSize, ls: cs.letterSpacing }; });
  return { url: location.href, sec: typeof S !== "undefined" ? S.sec : null, text, panels, dividers, buttons, split, mtabs };
};
async function shoot(name, extra) {
  await page.screenshot({ path: path.join(OUT, `${name}-${width}.png`) });
  const m = await page.evaluate(MEASURE);
  m.surface = name; Object.assign(m, extra || {});
  results.push(m);
  console.log(name, "text", m.text.length, "panels", m.panels.length, "buttons", m.buttons.length, m.split ? "split " + JSON.stringify(m.split) : "");
}
const results = [];
await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 60000 });
await sleep(14000);
await shoot("dashboard");
/* the company view, every tab */
await page.evaluate(() => openCo("NVDA")); await sleep(9000);
for (const t of ["GEIGER", "FUNDAMENTALS", "ESTIMATES", "COMPS", "FINANCIALS", "STATS", "NEWS", "SOCIAL", "EVENTS", "READ"]) {
  await page.evaluate((t) => { const b = document.querySelector('#cvTabs .cv-tab[data-tab="' + t + '"]'); if (b) b.click(); }, t); await sleep(t === "COMPS" || t === "ESTIMATES" ? 7000 : 3500);
  await shoot("company-" + t.toLowerCase());
}
await page.evaluate(() => { const b = document.querySelector("#cvLine .sc-coexp"); if (b) b.click(); }); await sleep(3000);
await shoot("company-expand");
await page.evaluate(() => { const b = document.querySelector("#cvLine .sc-coexp"); if (b) b.click(); }); await sleep(1500);
await page.evaluate(() => { const b = document.querySelector(".cv-back"); if (b) b.click(); }); await sleep(1500);
/* the rooms */
for (const sec of ["NEWS", "SOCIAL", "SENTIMENT", "ALERTS", "SCREENER", "EVENTS", "USUAL", "ECONOMIC"]) {
  await page.evaluate((sec) => { const b = document.querySelector('#mtabs .sc-mtab[data-sec="' + sec + '"]'); if (b) b.click(); else { S.sec = sec; sync(); } }, sec); await sleep(sec === "ECONOMIC" || sec === "SENTIMENT" ? 7000 : 5000);
  await shoot(sec.toLowerCase());
  if (sec === "SENTIMENT") { await page.evaluate(() => { const b = document.querySelector('.sc-soctab[data-act="sentitab"][data-tab="PREDICTION"]'); if (b) b.click(); }); await sleep(6000); await shoot("sentiment-prediction"); }
}
/* the link pages */
for (const [name, url] of [["allocation", "https://scintillahub.ai/allocation/"], ["tree", await page.evaluate(() => typeof TREE_MAP_URL !== "undefined" ? new URL(TREE_MAP_URL, location.href).href : "")]]) {
  if (!url) continue;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch((e) => console.log("goto", name, String(e).slice(0, 80))); await sleep(8000);
  await shoot(name, { link: url });
}
fs.writeFileSync(path.join(HERE, "..", `measure-${tag}-${width}.json`), JSON.stringify({ tag, width, height, when: new Date().toISOString(), hubRoot: hubRoot || "live", writes, results }, null, 1));
console.log("blocked writes", writes.length);
await browser.close();

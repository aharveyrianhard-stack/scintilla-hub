import { createRequire } from "module";
import fs from "fs";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const URL = process.argv[2], OUT = process.argv[3], TAG = process.argv[4] || "live";
const W = +(process.argv[5] || 1680), H = W < 500 ? 844 : 1000;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const LOCAL = process.env.LOCAL_INDEX || null;
const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: W, height: H }, deviceScaleFactor: W < 500 ? 2 : 1 });
let blocked = 0; let geigerBody = null;
await ctx.route("**/*", (r) => { if (r.request().method() !== "GET" && r.request().method() !== "OPTIONS") { blocked++; return r.abort(); } return r.continue(); });
if (LOCAL) await ctx.route("https://scintillahub.ai/", (r) => r.request().method() === "GET" ? r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: fs.readFileSync(LOCAL) }) : r.abort());
const page = await ctx.newPage();
page.on("response", async (res) => { try { if (/\/geiger(\?|$)/.test(res.url()) && !/symbols=/.test(res.url()) && res.status() === 200 && !geigerBody) geigerBody = await res.text(); } catch (_) {} });
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForSelector("#cohStrip .sc-cohstrip__col", { timeout: 90000 }).catch(() => {});
await page.click('[data-act="l0tab"][data-tab="COHORT"]').catch((e)=>console.log("tab",String(e)));
await page.waitForTimeout(12000);
const dump = () => page.evaluate(() => {
  const hd = document.querySelector(".sc-cohstrip__hd");
  const hdTxt = hd ? Array.from(hd.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim() : null;
  const cols = Array.from(document.querySelectorAll("#cohStrip .sc-cohstrip__col")).map(c => ({
    key: c.dataset.key, lbl: (c.querySelector(".sc-cohstrip__lbl") || {}).textContent, val: (c.querySelector(".sc-cohstrip__val") || {}).textContent,
    read: (c.querySelector(".sc-cohstrip__read") || {}).textContent, readVisible: c.querySelector(".sc-cohstrip__read") ? getComputedStyle(c.querySelector(".sc-cohstrip__read")).visibility : null,
    tm: (c.querySelector(".sc-cohstrip__tm") || {}).textContent, n: (c.querySelector(".sc-cohstrip__n") || {}).textContent,
    title: c.getAttribute("title"), tmTitle: (c.querySelector(".sc-cohstrip__tm") || { getAttribute() { return null; } }).getAttribute("title"), barH: (c.querySelector(".sc-vmini i") || { style: {} }).style.height || null }));
  const g = {}; try { for (const t in GCOMP) g[t] = GCOMP[t]; } catch (e) {}
  const cs = {}; try { for (const k in COHSETS) cs[k] = Array.from(COHSETS[k]); } catch (e) {}
  const tm = {}; try { for (const k in window.SCIN_TM) tm[k] = { tr: window.SCIN_TM[k].tr, mo: window.SCIN_TM[k].mo }; } catch (e) {}
  return { cohsets: cs, scinTM: tm, header: hdTxt, mode: window.SC_CMP_MODE, fam: window.SECT_FAMILY, cols, gcompN: Object.keys(g).length, gcomp: g };
});
const out = { url: URL, at: new Date().toISOString(), width: W, views: {} };
const shot = async (name) => {
  const el = await page.$("#cohCompare");
  await page.screenshot({ path: `${OUT}/${TAG}-${W}-${name}-page.png` });
  if (el) await el.screenshot({ path: `${OUT}/${TAG}-${W}-${name}.png`, timeout: 5000 }).catch((e) => console.log("elshot", name, String(e).slice(0,80)));
};
out.views.COHORTS = await dump(); await shot("COHORTS");
await page.click('[data-gwxcmp="SECTORS"]').catch((e) => { out.err = String(e); });
await page.waitForTimeout(1500);
const fams = await page.evaluate(() => (window.SECT_FAMILIES || []).map(f => f[0]));
for (const f of fams) {
  await page.click(`[data-gwxfam="${f}"]`).catch((e) => { out["err_" + f] = String(e); });
  await page.waitForTimeout(1500);
  out.views[f] = await dump(); await shot(f);
}
out.blockedNonGet = blocked; out.pageSha = LOCAL ? "local" : await page.evaluate(async () => { const b = await (await fetch(location.href)).arrayBuffer(); const d = await crypto.subtle.digest("SHA-256", b); return Array.from(new Uint8Array(d)).map(x => x.toString(16).padStart(2, "0")).join(""); }).catch(() => null);
if (geigerBody) fs.writeFileSync(`${OUT}/${TAG}-${W}-geiger-as-page-received.json`, geigerBody);
fs.writeFileSync(`${OUT}/${TAG}-${W}-dump.json`, JSON.stringify(out, null, 1));
await browser.close();
console.log("done", Object.keys(out.views).join(","), "blocked", blocked, "sha", out.pageSha, "geiger", !!geigerBody);

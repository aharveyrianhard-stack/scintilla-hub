import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const S="/private/tmp/claude-501/-Users-alanharvey-SCINTILLA-0-5/ed9fabe7-f2e3-471c-a2e4-b8c582e27437/scratchpad/sg1";
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1 });
let blocked=0; await ctx.route("**/*", r => { if (r.request().method() !== "GET") { blocked++; return r.abort(); } r.continue(); });
const p = await ctx.newPage();
await p.goto("https://allocation.scintillahub.ai/", { waitUntil: "networkidle", timeout: 120000 }).catch(e=>console.log("goto:",e.message));
await p.waitForTimeout(8000);
const data = await p.evaluate(() => {
  const rows = (window.blendTable ? window.blendTable() : []).map(r => ({ key:r.key, score:r.score, cap:r.cap, eq:r.eq, q:r.q, parts:r.parts, missing:r.missing, blendBow:r.blendBow }));
  const spine = window.SPINE || null;
  const txt = (document.getElementById('bowtie')||{}).innerText || '';
  return { rows, spine, txt: txt.slice(0,3000), title: document.title };
});
import fs from "node:fs"; fs.writeFileSync(S+"/alloc3a.json", JSON.stringify(data,null,1));
console.log("rows", data.rows.length, "blocked non-GET", blocked);
const sec = await p.$("#bowtie");
if (sec) { await sec.scrollIntoViewIfNeeded(); await p.waitForTimeout(500); await sec.screenshot({ path: S+"/shots/alloc-3a-today-1680.png" }); console.log("shot ok"); }
else console.log("no #bowtie");
await b.close();

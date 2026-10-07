/* CP1 · THE KNOCKOUT RE-RUN, headless, on the allocation tool AS IT IS LIVE (scintilla-allocation main, the checkout
   given), its own feeds and its own knockout() — nothing of the knockout is re-implemented here.
     BEFORE  the page exactly as live: /c5/lines.mjs is the Hub's live file (C5's lines).
     AFTER   the same page, the same feeds, ONE file swapped: /c5/lines.mjs answered with this branch's lines.mjs with
             CP1_DEFAULT switched on (memory + storage one line, data-centre landlords their own line) — what the
             knockout reads the day the fix goes live, since the tool imports that file as it is.
   The cohort is Alan's eighteen names, added in the headless page only (a tag `CP1_ALAN` on UNIVERSE.cohorts; nothing is
   written anywhere). NEVER a visible window; every non-GET request is blocked and counted.
     node knockout-run.mjs <allocation checkout> <out.json> */
import { createRequire } from "node:module"; import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json"), { chromium } = require("playwright-core");
const HERE = path.dirname(fileURLToPath(import.meta.url)), WT = path.resolve(HERE, "../../../..");
const ROOT = path.resolve(process.argv[2] || "/Users/alanharvey/SCINTILLA 0.5/_ALLOC_DEPLOY"), OUT = process.argv[3] || "knockout-before-after.json";
const NAMES = "MU SNDK WDC STX NVDA AVGO GOOGL AMZN ORCL VST CEG BE NBIS IREN CRWV EQIX DLR IRM".split(" ");
const rewrites = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8")).rewrites;
const FIXED = fs.readFileSync(path.join(WT, "deliverables/20261003/comps-c5/lines.mjs"), "utf8").replace("export const CP1_DEFAULT = CP1_LINES_OFF;", "export const CP1_DEFAULT = CP1_LINES_ON;");
if (!FIXED.includes("export const CP1_DEFAULT = CP1_LINES_ON;")) throw new Error("the switch line was not found in lines.mjs");
async function run(mode) {
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://x");
    if (u.pathname === "/c5/lines.mjs" && mode === "after") { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(FIXED); }
    const rw = rewrites.find((x) => x.source === u.pathname);
    if (rw) { try { const r = await fetch(rw.destination + u.search); res.writeHead(r.status, { "content-type": r.headers.get("content-type") || "application/json" }); return res.end(Buffer.from(await r.arrayBuffer())); } catch (e) { res.writeHead(502); return res.end(String(e)); } }
    const f = path.join(ROOT, u.pathname === "/" ? "index.html" : u.pathname);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": f.endsWith(".json") ? "application/json" : "text/html" }); res.end(fs.readFileSync(f));
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const browser = await chromium.launch({ headless: true });
  const nonGet = [], errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1680, height: 1050 } }), page = await context.newPage();
    await page.route("**/*", (r) => { const m = r.request().method(); if (m !== "GET") { nonGet.push(m + " " + new URL(r.request().url()).pathname); return r.abort(); } r.continue(); });
    page.on("pageerror", (e) => errors.length < 10 && errors.push(String(e).slice(0, 200)));
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "networkidle", timeout: 180000 });
    await page.waitForFunction(() => typeof knockout === "function" && typeof LINES === "object" && Object.keys(LINES).length > 100 && typeof COMPS === "object" && Object.keys(COMPS).length > 100, null, { timeout: 120000 });
    await page.waitForTimeout(2500);
    const res = await page.evaluate((NAMES) => {
      for (const t of NAMES) { UNIVERSE.cohorts[t] = [...(UNIVERSE.cohorts[t] || []).filter((c) => c !== "CP1_ALAN"), "CP1_ALAN"]; }
      TRUE_COHORT_SET.add("CP1_ALAN");
      const cand = new Set(candidateSyms()), K = knockout("CP1_ALAN");
      const ent = (e) => e && ({ sym: e.sym, seed: e.seed ?? null, line: e.line, lineShare: e.lineShare, score: e.fund.score, n: e.fund.n, parts: (e.fund.parts || []).map((p) => [p[0], p[1], p[2]]), g: e.g, timing: e.timing, regime: e.rg && e.rg.label || null, outliers: e.outlierPeers || [], fieldN: e.fieldN, scale: e.scale });
      return { ok: !!K, c5: !!C5, lines_n: Object.keys(LINES).length, comps_n: Object.keys(COMPS).length, not_candidates: NAMES.filter((t) => !cand.has(t)), in_cohort: K ? K.cohort.names : [],
        lines: K ? K.lines.map((l) => ({ line: l.line, scale: { level: l.scale.level, name: l.scale.name, members: l.scale.members.length }, unopposed: l.unopposed, entrants: l.entrants.map(ent), sitOut: l.sitOut.map(ent), rounds: l.rounds.map((ms) => ms.map((m) => ({ a: m.a.sym, b: m.b ? m.b.sym : null, winner: m.winner.sym, loser: m.loser ? m.loser.sym : null, on: m.on, why: m.why }))), champion: l.champion ? l.champion.sym : null })) : [],
        podium: K ? K.podium.map((e) => ({ sym: e.sym, line: e.line, score: e.fund.score, g: e.g })) : [],
        names: Object.fromEntries(NAMES.map((t) => [t, { line: typeof dominantLine === "function" ? dominantLine(t) : null, vector: LINES[t] ? LINES[t].lines : null, from: LINES[t] ? LINES[t].from : null, comps: COMPS[t] ? { pe: COMPS[t].pe ?? null, fwd_pe: COMPS[t].fwd_pe ?? null, ps: COMPS[t].ps ?? null, pb: COMPS[t].pb ?? null, rev_growth: COMPS[t].rev_growth ?? null, net_m: COMPS[t].net_m ?? null, de: COMPS[t].de ?? null } : null, g: typeof gv === "function" ? gv(t) : null }])),
        rule: { even: KO.even, minField: KO.minField, lineMin: KO.lineMin } };
    }, NAMES);
    return { mode, taken_utc: new Date().toISOString(), non_get_blocked: nonGet.length, non_get: [...new Set(nonGet)].slice(0, 8), page_errors: errors, ...res };
  } finally { await browser.close(); server.close(); }
}
const out = { allocation_checkout: ROOT, allocation_head: fs.existsSync(path.join(ROOT, ".git")) ? require("node:child_process").execSync(`git -C "${ROOT}" rev-parse --short HEAD`).toString().trim() : null, names: NAMES };
for (const mode of ["before", "after"]) { out[mode] = await run(mode); const o = out[mode]; console.log(mode, "· ok", o.ok, "· lines", o.lines.length, "· entrants", o.lines.reduce((s, l) => s + l.entrants.length, 0), "· sit out", o.lines.reduce((s, l) => s + l.sitOut.length, 0), "· non-GET blocked", o.non_get_blocked, "· page errors", o.page_errors.length, "· podium", o.podium.map((p) => p.sym + " " + (p.score ?? 0).toFixed(2)).join(", ")); }
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log("DONE →", OUT);

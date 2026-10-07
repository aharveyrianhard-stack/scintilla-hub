/* FD1 · THE LIVE KNOCKOUT, BEFORE → AFTER THE FEED FIX. Headless, on the allocation tool AS IT IS LIVE (scintilla-allocation
   main, the checkout given), its own feeds and its own knockout() — nothing of the tool is re-implemented here.
     BEFORE  the page exactly as live: its comps-feed calls go to the deployed function (v5).
     AFTER   the same page, the same moment's tables, ONE answer swapped: each comps-feed call is answered by the fixed
             function's own code (supabase/functions/comps-feed/feed.mjs) reading the same public tables — what the
             knockout reads the day v6 is deployed. Nothing is deployed and nothing is written.
   The cohort is Alan's eighteen names, added in the headless page only (a tag `FD1_ALAN` on UNIVERSE.cohorts).
   NEVER a visible window; every non-GET request is blocked and counted. Run from a folder holding `.anon`:
     node knockout-feed-run.mjs <allocation checkout> <out.json> */
import { createRequire } from "node:module"; import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json"), { chromium } = require("playwright-core");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { fixedFeedText, todayUTC } = await import(path.join(HERE, "fixed-feed.mjs"));
const ROOT = path.resolve(process.argv[2] || "/Users/alanharvey/SCINTILLA 0.5/_ALLOC_DEPLOY"), OUT = process.argv[3] || "knockout-feed-before-after.json";
const EIGHTEEN = "MU SNDK WDC STX NVDA AVGO GOOGL AMZN ORCL VST CEG BE NBIS IREN CRWV EQIX DLR IRM".split(" ");
const CARDS = "MU SNDK WDC STX AVGO NVDA LRCX AMAT VST CEG GOOGL AMZN ORCL EQIX DLR IRM LLY JPM BAC NBIS IREN CRWV BE CRDO COHR AME".split(" ");
const rewrites = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8")).rewrites, TODAY = todayUTC(), FEED = new Map();
async function run(mode) {
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://x");
    const rw = rewrites.find((x) => x.source === u.pathname);
    if (rw) { try { const r = await fetch(rw.destination + u.search); res.writeHead(r.status, { "content-type": r.headers.get("content-type") || "application/json" }); return res.end(Buffer.from(await r.arrayBuffer())); } catch (e) { res.writeHead(502); return res.end(String(e)); } }
    const f = path.join(ROOT, u.pathname === "/" ? "index.html" : u.pathname);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": f.endsWith(".json") ? "application/json" : "text/html" }); res.end(fs.readFileSync(f));
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const browser = await chromium.launch({ headless: true });
  const nonGet = [], errors = []; let feedCalls = 0, feedSyms = 0;
  try {
    const context = await browser.newContext({ viewport: { width: 1680, height: 1050 } }), page = await context.newPage();
    await page.route("**/*", async (r) => {
      const req = r.request(), m = req.method(), url = new URL(req.url());
      if (m !== "GET") { nonGet.push(m + " " + url.pathname); return r.abort(); }
      if (url.pathname.endsWith("/functions/v1/comps-feed")) {
        const syms = url.searchParams.get("syms") || ""; feedCalls++; feedSyms += syms.split(",").filter(Boolean).length;
        if (mode === "after") { try { if (!FEED.has(syms)) FEED.set(syms, await fixedFeedText(syms, TODAY)); return r.fulfill({ status: 200, headers: { "content-type": "text/csv; charset=utf-8", "access-control-allow-origin": "*", "cache-control": "no-store" }, body: FEED.get(syms) }); } catch (e) { errors.push("fixed feed: " + String(e).slice(0, 160)); return r.fulfill({ status: 503, headers: { "content-type": "text/csv", "access-control-allow-origin": "*" }, body: "sym,mktcap,pe,fwd_pe,ps,pb,gross_m,net_m,de,div_yld,rev_growth,updated" }); } }
      }
      r.continue();
    });
    page.on("pageerror", (e) => errors.length < 10 && errors.push(String(e).slice(0, 200)));
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "networkidle", timeout: 240000 });
    await page.waitForFunction(() => typeof knockout === "function" && typeof LINES === "object" && Object.keys(LINES).length > 100 && typeof COMPS === "object" && Object.keys(COMPS).length > 100, null, { timeout: 180000 });
    await page.waitForTimeout(2500);
    const res = await page.evaluate(({ EIGHTEEN, CARDS }) => {
      for (const t of EIGHTEEN) { UNIVERSE.cohorts[t] = [...(UNIVERSE.cohorts[t] || []).filter((c) => c !== "FD1_ALAN"), "FD1_ALAN"]; }
      TRUE_COHORT_SET.add("FD1_ALAN");
      const K = knockout("FD1_ALAN"), all = Object.keys(COMPS), pos = (k) => all.filter((t) => COMPS[t][k] != null && isFinite(COMPS[t][k]) && COMPS[t][k] > 0).length, held = (k) => all.filter((t) => COMPS[t][k] != null && isFinite(COMPS[t][k])).length;
      const ent = (e) => e && ({ sym: e.sym, seed: e.seed ?? null, line: e.line, score: e.fund.score, n: e.fund.n, parts: (e.fund.parts || []).map((p) => [p[0], p[1], p[2]]), g: e.g, fieldN: e.fieldN, outliers: e.outlierPeers || [] });
      const figs = (t) => (COMPS[t] ? Object.fromEntries(["mktcap", "pe", "fwd_pe", "ps", "pb", "gross_m", "net_m", "de", "div_yld", "rev_growth"].map((k) => [k, COMPS[t][k] ?? null])) : null);
      const fs = (t) => { try { const f = fundScore(t); return { score: f.score, n: f.n, parts: (f.parts || []).map((p) => [p[0], p[1], p[2]]) }; } catch (e) { return { score: null, n: 0, parts: [], err: String(e).slice(0, 80) }; } };
      const vr = (t) => { try { const v = typeof valueRead === "function" ? valueRead(t) : null; return v ? { tag: v.tag ?? null, pct: v.pct ?? v.upside ?? null } : null; } catch (e) { return null; } };
      return { ok: !!K, comps_n: all.length, lines_n: Object.keys(LINES).length, counts: { fwd_pe_positive: pos("fwd_pe"), fwd_pe_zero: all.filter((t) => COMPS[t].fwd_pe === 0).length, fwd_pe_blank: all.filter((t) => COMPS[t].fwd_pe == null).length, pe_positive: pos("pe"), ps_positive: pos("ps"), growth_held: held("rev_growth"), growth_zero: all.filter((t) => COMPS[t].rev_growth === 0).length, growth_negative: all.filter((t) => COMPS[t].rev_growth < 0).length, net_margin_above_80pct: all.filter((t) => COMPS[t].net_m > 0.8).length, ps_above_40: all.filter((t) => COMPS[t].ps > 40).length, pe_between_0_and_3: all.filter((t) => COMPS[t].pe > 0 && COMPS[t].pe < 3).length },
        lines: K ? K.lines.map((l) => ({ line: l.line, scale: { level: l.scale.level, name: l.scale.name, members: l.scale.members.length }, unopposed: l.unopposed, entrants: l.entrants.map(ent), sitOut: l.sitOut.map(ent), rounds: l.rounds.map((ms) => ms.map((m) => ({ a: m.a.sym, b: m.b ? m.b.sym : null, winner: m.winner.sym, on: m.on, why: m.why }))), champion: l.champion ? l.champion.sym : null })) : [],
        podium: K ? K.podium.map((e) => ({ sym: e.sym, line: e.line, score: e.fund.score, g: e.g })) : [],
        figures: Object.fromEntries(CARDS.map((t) => [t, figs(t)])), fund: Object.fromEntries(CARDS.map((t) => [t, fs(t)])), value: Object.fromEntries(CARDS.map((t) => [t, vr(t)])) };
    }, { EIGHTEEN, CARDS });
    return { mode, taken_utc: new Date().toISOString(), feed_calls: feedCalls, feed_symbols: feedSyms, non_get_blocked: nonGet.length, non_get: [...new Set(nonGet)].slice(0, 8), page_errors: errors, ...res };
  } finally { await browser.close(); server.close(); }
}
const out = { allocation_checkout: ROOT, allocation_head: require("node:child_process").execSync(`git -C "${ROOT}" rev-parse --short HEAD`).toString().trim(), today: TODAY, eighteen: EIGHTEEN, cards: CARDS };
for (const mode of ["before", "after"]) { out[mode] = await run(mode); const o = out[mode]; console.log(mode, "· ok", o.ok, "· names priced", o.comps_n, "· feed calls", o.feed_calls, "· fwd P/E > 0:", o.counts.fwd_pe_positive, "· = 0:", o.counts.fwd_pe_zero, "· blank:", o.counts.fwd_pe_blank, "· non-GET blocked", o.non_get_blocked, "· page errors", o.page_errors.length, "· podium", o.podium.map((p) => p.sym + " " + (p.score ?? 0).toFixed(2)).join(", ")); }
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log("DONE →", OUT);

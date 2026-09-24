/* Offline render of the allocation page. Every request the page makes is intercepted and
   answered from generated fixtures — nothing leaves this machine, no production table and
   no chart API is read, and the "key" the page finds is the literal string FIXTURE. The
   browser is headless. */
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/alanharvey/SCINTILLA 0.5/_worktrees/allocation-4-20260924";
const OUT = process.argv[2] || (ROOT + "/deliverables/20260924/allocation-4/screens");
fs.mkdirSync(OUT, { recursive: true });

/* ---- a small, deterministic market ---------------------------------------- */
const SECTORS = ["Technology", "Energy", "Healthcare", "Financial Services", "Consumer Defensive"];
const rnd = (seed) => () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const R = rnd(7);
const NAMES = [];
SECTORS.forEach((sec, si) => {
  for (let i = 0; i < 14; i++) {
    const t = ["TCH","ENG","HLT","FIN","CDF"][si] + String(i + 1).padStart(2, "0");
    /* Energy and Healthcare are the beaten-up sectors here, with good companies inside them;
       Technology is stretched and expensive. That is the shape the new lane must react to. */
    const beat = sec === "Energy" || sec === "Healthcare";
    const px = 100;
    const s200 = beat ? px * (1 + 0.04 + R() * 0.16) : px * (1 - 0.06 - R() * 0.14);
    const s50 = beat ? px * (1 + 0.01 + R() * 0.06) : px * (1 - 0.02 - R() * 0.05);
    NAMES.push({ t, sector: sec, price: px, s50, s200,
      rsi: beat ? 22 + R() * 18 : 58 + R() * 22,
      g: beat ? -0.65 + R() * 0.5 : 0.15 + R() * 0.5,
      nm: 4 + R() * 26, roe: 4 + R() * 30, de: 0.1 + R() * 2.4,
      pe: 8 + R() * 30, eps: 4 + R() * 3, ntm: 0, mcap: (20 + R() * 300) * 1e9 });
    const n = NAMES[NAMES.length - 1];
    n.ntm = n.eps * (1 + (beat ? 0.06 + R() * 0.3 : R() * 0.1));
  }
});
const COHS = { Technology:"AI_HARDWARE", Energy:"MACRO", Healthcare:"BLUE_CHIP",
  "Financial Services":"BLUE_CHIP", "Consumer Defensive":"BLUE_CHIP" };

/* one daily series per symbol, with three real selloffs so a probability has episodes */
function candles(sym, limit) {
  const seed = [...sym].reduce((a, c) => a + c.charCodeAt(0), 11);
  const r = rnd(seed);
  const n = Math.min(limit, 1300);
  const out = [];
  let c = 60 + r() * 40;
  for (let i = 0; i < n; i++) {
    c *= 1 + (r() - 0.48) * 0.02;
    if (i % 380 > 340) c *= 0.985;                     // a recurring selloff
    out.push({ t: Date.UTC(2021, 0, 4) + i * 86400000, c: Number(c.toFixed(2)),
               v: Math.round(2e6 + r() * 3e7), vw: Number(c.toFixed(2)) });
  }
  /* end the series where the fixture says the name is today */
  const nm = NAMES.find((x) => x.t === sym);
  if (nm) { const k = nm.price / out[out.length - 1].c; out.forEach((b) => { b.c = Number((b.c * k).toFixed(2)); b.vw = b.c; }); }
  return out;
}

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

function restRows(url) {
  const p = url.split("/rest/v1/")[1] || "";
  const tbl = p.split("?")[0];
  if (tbl === "company_profile") return NAMES.map((n)=>({ ticker:n.t, sector:n.sector, market_cap:n.mcap, updated_ts: Math.floor(Date.now()/1000) - 86400, is_etf:false }))
    .concat([{ ticker:"SPY", sector:"Financial Services", market_cap:6e11, updated_ts: Math.floor(Date.now()/1000), is_etf:true }]);
  if (tbl === "fundamentals") return NAMES.map((n)=>({ ticker:n.t, price:n.price, market_cap:n.mcap, trailing_pe:n.pe, eps_ttm:n.eps, revenue_ttm:1e10, updated_ts: Math.floor(Date.now()/1000) - 3*86400 }));
  if (tbl === "ratios_history") {
    const out = [];
    NAMES.forEach((n)=> ["2022-12-31","2023-12-31","2024-12-31","2025-12-31"].forEach((d, i) => out.push({
      ticker:n.t, fiscal_date:d, pe:n.pe, ps:3, pb:2, debt_to_equity:n.de,
      roe:n.roe, net_margin: n.nm - (3 - i) * 0.8, updated_ts: Math.floor(Date.now()/1000) - 10*86400 })));
    return out;
  }
  if (tbl === "earnings_events") return NAMES.slice(0, 6).map((n, i)=>({ ticker:n.t, date:"2026-10-" + String(12+i).padStart(2,"0"), report_time:"amc", confirmed:true }));
  if (tbl === "sector_rankings") return SECTORS.map((s, i)=>({ sector:{Technology:"XLK",Energy:"XLE",Healthcare:"XLV","Financial Services":"XLF","Consumer Defensive":"XLP"}[s], sector_name:s, rank:i+1, score:1-i*0.2, date:"2026-09-23" }));
  if (tbl === "ticker_cohorts") return NAMES.map((n)=>({ ticker:n.t, cohort:COHS[n.sector] }))
    .concat(NAMES.slice(0,8).map((n)=>({ ticker:n.t, cohort:"MEGACAP" })));
  if (tbl === "composite_staged") return [{ ticker:"GCUSD", composite:-0.2, updated_ts: Math.floor(Date.now()/1000), tf:"D" }];
  if (tbl === "provider_indicators_current") {
    const out = [];
    NAMES.forEach((n)=>{
      out.push({ ticker:n.t, indicator:"sma", period_length:50,  value:n.s50,  source_date:"2026-09-23", session_state:"settled" });
      out.push({ ticker:n.t, indicator:"sma", period_length:200, value:n.s200, source_date:"2026-09-23", session_state:"settled" });
      out.push({ ticker:n.t, indicator:"rsi", period_length:14,  value:n.rsi,  source_date:"2026-09-23", session_state:"settled" });
    });
    return out;
  }
  if (tbl === "hub_favorites") return [{ ticker:"TCH01" }, { ticker:"TCH02" }, { ticker:"ENG03" }];
  if (tbl === "fwd_eps_ntm") return NAMES.map((n)=>({ ticker:n.t, ntm_eps:n.ntm, updated_ts: Math.floor(Date.now()/1000) - 2*86400 }));
  return [];
}

const b = await chromium.launch({ headless: true });
const srv = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]).replace(/\/$/, "/index.html"));
  fs.readFile(f, (e, data) => {
    if (e) { res.writeHead(404); res.end("no"); return; }
    res.writeHead(200, { "Content-Type": f.endsWith(".html") ? "text/html" : "text/plain" });
    res.end(data);
  });
});
await new Promise((r)=> srv.listen(0, "127.0.0.1", r));
const PORT = srv.address().port;
let external = 0;

async function shoot(w, h, tag, withSwipe) {
  const ctx = await b.newContext({ viewport:{ width:w, height:h }, deviceScaleFactor: 1 });
  await ctx.route("**/*", async (route) => {
    const u = route.request().url();
    if (u.startsWith("http://127.0.0.1:" + PORT)) {
      if (u.includes("/pip.html")) return route.fulfill({ status:200, contentType:"text/html",
        body:'<script>window.SC_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.FIXTURE.FIXTURE"</script>' });
      if (u.includes("/regime/latest.json")) return route.fulfill({ status:404, body:"" });
      return route.continue();
    }
    external++;
    if (u.includes("/rest/v1/")) return json(route, restRows(u));
    if (u.includes("functions/v1/operator-write")) return route.fulfill({ status:404, body:"no such action" });
    if (u.includes("/geiger")) {
      const symbols = {};
      NAMES.forEach((n)=>{ symbols[n.t] = { composite:n.g, trend:n.g*0.8, momentum:n.g*1.1 }; });
      return json(route, { computed_utc:new Date().toISOString(), symbols,
        verification:{ completed_session_et:"2026-09-23" } });
    }
    if (u.includes("/universe")) return json(route, { symbols: NAMES.map((n)=>n.t) });
    if (u.includes("/quotes")) return json(route, { quotes: NAMES.map((n)=>({ symbol:n.t, price:n.price })) });
    if (u.includes("/candles")) {
      const q = new URL(u).searchParams;
      return json(route, { series: candles(q.get("symbol"), Number(q.get("limit")||260)),
        provider:"FIXTURE", surface:"fixture", price_basis:"close" });
    }
    return json(route, {});
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e)=> errs.push(String(e)));
  await p.goto("http://127.0.0.1:" + PORT + "/allocation/index.html", { waitUntil:"load" });
  await p.waitForFunction(()=> document.getElementById("desk") && !document.getElementById("desk").classList.contains("off"), null, { timeout:30000 });
  await p.waitForFunction(()=> { const el = document.getElementById("acts"); return el && el.textContent.length > 80; }, null, { timeout:30000 }).catch(()=>{});
  await p.waitForTimeout(2500);
  const lane0 = await p.evaluate(()=> ({ oppRows: document.querySelectorAll("#lanetab tbody tr").length,
     acts: document.querySelectorAll(".act").length,
     laneText: (document.getElementById("lanesays").textContent||"").slice(0,60) }));
  console.log("  lane:", JSON.stringify(lane0));
  if (withSwipe && lane0.oppRows) {
    await p.click("#swopen");
    await p.waitForTimeout(400);
    await p.screenshot({ path: OUT + "/swipe-" + tag + ".png" });
    await p.keyboard.press("ArrowRight");
    await p.waitForTimeout(350);
    await p.screenshot({ path: OUT + "/swipe-after-" + tag + ".png" });
    const status = await p.textContent("#swstat");
    console.log("  swipe status after one right:", status.trim());
    await p.click("#swclose");
    await p.waitForTimeout(600);
  }
  await p.screenshot({ path: OUT + "/page-" + tag + ".jpg", fullPage: true, type:"jpeg", quality: 78 });
  for (const [sel, name] of [["#lanetwo","answers"],["#acts","actions"],["#brline","breadth"],["#lists","lists"],["#cash","toggles"]]) {
    const el = await p.$(sel);
    if (el) await el.screenshot({ path: OUT + "/" + name + "-" + tag + ".png" }).catch(()=>{});
  }
  const read = await p.evaluate(() => ({
    headline: (document.getElementById("headline").textContent || "").slice(0, 180),
    lane: (document.getElementById("lanesays").textContent || "").slice(0, 260),
    two: (document.getElementById("lanetwo").innerText || "").replace(/\n+/g, " | ").slice(0, 300),
    acts: Array.from(document.querySelectorAll(".act .ahead")).slice(0, 4).map((e)=> e.innerText.replace(/\n/g," ")),
    lists: (document.getElementById("lists").innerText || "").split("\n").slice(0, 8),
    tide: (document.getElementById("tide").innerText || "").split("\n").slice(0, 8),
    cashRows: document.querySelectorAll("#cash tbody tr").length,
    oppRows: document.querySelectorAll("#lanetab tbody tr").length,
    knobs: document.querySelectorAll("#k4 .knob").length,
    scrollW: document.documentElement.scrollWidth, winW: window.innerWidth,
  }));
  console.log("\n[" + tag + "] " + w + "x" + h);
  console.log("  headline:", read.headline);
  console.log("  lane:", read.lane);
  console.log("  two answers:", read.two);
  console.log("  actions:", JSON.stringify(read.acts, null, 0));
  console.log("  lists:", JSON.stringify(read.lists));
  console.log("  tide:", JSON.stringify(read.tide));
  console.log("  cash rows:", read.cashRows, "| opp rows:", read.oppRows, "| k4 knobs:", read.knobs);
  console.log("  scrollWidth", read.scrollW, "vs window", read.winW, read.scrollW > read.winW + 1 ? "*** OVERFLOW ***" : "(no sideways scroll)");
  if (errs.length) console.log("  PAGE ERRORS:", errs.slice(0,3));
  await ctx.close();
}
await shoot(1680, 1050, "1680", true);
await shoot(390, 844, "390", true);
console.log("\nrequests intercepted that would have left this machine:", external, "(all answered from fixtures)");
srv.close(); await b.close();

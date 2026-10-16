/* CW2 (15 Oct 2026) · the Hub's comps machine RUN headless on the RADAR names, from a local serve of the release @7b66061 (the same
   files the live Hub serves); the database is the live one, read the Hub's own way (GET). Nothing is recomputed here and nothing is
   written: every non-GET request is answered locally and counted.
   Per name: (1) the LIVE COMPS tab (C5/C6: business-similarity set) as the product shows it tonight — its state copied off the tab;
   (2) the four-switch machine (C3b, deliverables/20261001/comps-table-first: tightest tag · home cohort · FMP peers · largest 7)
   mounted in a hidden box once per switch, its state copied off the box.
     node drive.mjs <outdir> TICKER …                                                                                             */
import fs from "node:fs"; import path from "node:path"; import http from "node:http"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json"); const { chromium } = require("playwright-core");
const ROOT = "/Users/alanharvey/SCINTILLA 0.5/_deploy/hub-deploy";
const [outDir, ...tickers] = process.argv.slice(2); fs.mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".css": "text/css", ".webmanifest": "application/manifest+json" };
const server = http.createServer((req, res) => { const u = new URL(req.url, "http://x"); const f = path.join(ROOT, u.pathname === "/" ? "index.html" : decodeURIComponent(u.pathname)); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" }); res.end(fs.readFileSync(f)); });
await new Promise((ok) => server.listen(0, "127.0.0.1", ok)); const url = `http://127.0.0.1:${server.address().port}/`;
const writes = [], errors = [], log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
try {
  const context = await browser.newContext({ viewport: { width: 1680, height: 1050 }, serviceWorkers: "block" });
  await context.route("**/*", async (route) => { const req = route.request(), m = req.method(); if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") { const u = new URL(req.url()); writes.push(m + " " + u.host + u.pathname); return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" }); } return route.continue(); });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.length < 40 && errors.push(String(e.message).slice(0, 240)));
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 }); await sleep(12000);
  /* the bounded copier, installed once */
  await page.evaluate(() => { window.__cp = (v, d = 0, maxD = 8) => { if (v == null || typeof v === "number" || typeof v === "boolean") return v; if (typeof v === "string") return v.length > 800 ? v.slice(0, 800) + "…" : v; if (typeof v === "function") return undefined; if (typeof Node !== "undefined" && v instanceof Node) return undefined; if (d > maxD) return "…"; if (v instanceof Set) v = [...v]; if (v instanceof Map) v = Object.fromEntries(v); if (Array.isArray(v)) return v.slice(0, 80).map((x) => window.__cp(x, d + 1, maxD)); const o = {}; for (const k of Object.keys(v).slice(0, 100)) { const x = window.__cp(v[k], d + 1, maxD); if (x !== undefined) o[k] = x; } return o; }; });
  for (const T of tickers) {
    const r = { ticker: T, read_utc: new Date().toISOString(), served_url: url };
    const t0 = Date.now();
    /* (1) the live COMPS tab */
    try {
      r.dash = await page.evaluate((t) => { const row = (typeof S !== "undefined" && S.rows || []).find((x) => x.t === t); return row ? { fpe: row.fpe ?? null, price: row.p ?? row.price ?? row.last ?? null } : null; }, T);
      await page.evaluate((t) => { openCo(t); }, T); await sleep(2500);
      await page.evaluate(() => { const b = document.querySelector('[data-act="cotab"][data-tab="COMPS"]'); if (b) b.click(); });
      let ok = false, nonOp = false; for (let i = 0; i < 120 && !ok; i++) { await sleep(1000); const st = await page.evaluate((t) => { const b = document.getElementById("scCompsTab"); if (!b) return { ok: false, text: "no tab box" }; const txt = b.innerText.slice(0, 300); return { ok: !!(b._cm && b._cm.C && b.dataset.mounted === t && !/BUILDING|READING/.test(txt)), text: txt, err: !!b.querySelector(".err") }; }, T); ok = st.ok; if (st.err || /could not be|cannot be priced|not an operating|no comps/i.test(st.text)) { nonOp = true; r.live_text = st.text; break; } }
      if (nonOp) r.live = { error: "the tab did not build a set", text: r.live_text };
      else if (!ok) r.live = { error: "the tab did not finish in 120 s", text: await page.evaluate(() => (document.getElementById("scCompsTab") || {}).innerText || "").then((t) => t.slice(0, 600)) };
      else r.live = await page.evaluate(() => {
        const cp = window.__cp, S = document.getElementById("scCompsTab")._cm, C = S.C, snap = C.snap || {}, c6 = C.c6 || {};
        const rows = (C.rows || []).filter((x) => x && x.key).map((x) => cp(x));
        const kept = (S.set && S.set.kept || []).map((k) => ({ ticker: k.ticker, sim: k.sim, why: k.why, sources: k.sources, line_source: k.line_source, seat: !!k.seat, stated: !!k.stated, reference: !!k.reference, has_figures: k.has_figures ?? null, market_cap: k.market_cap ?? null, shared: (k.shared || []).slice(0, 4), exact: k.exact, family: k.family }));
        const c6out = { pricedOn: c6.pricedOn, business: cp(c6.business), outliers: cp(c6.outliers), flaggedCells: c6.flaggedCells, keys: Object.keys(c6) };
        return { T: S.T, way: S.way, n: S.n, mode: S.mode, today: S.opts && S.opts.today, price: snap.price ?? null, forward: snap.forward,
          own_lines: cp(S.set && S.set.own_lines), own_industry: S.set && S.set.own_industry, own_market_cap: S.set && S.set.own_market_cap, kept, dropped_n: S.set && S.set.dropped ? S.set.dropped.length : null, dropped_named: cp((S.set && S.set.dropped || []).filter((d) => d.sources && d.sources.length).slice(0, 40)),
          members: S.members, peersOn: C.peersOn || null, band: cp(C.band), upside: cp(C.upside), reason: C.reason ?? null, ways: cp(C.ways), measureWeights: cp(C.measureWeights), peerWeights: cp(C.peerWeights), outliers: cp(C.outliers), cp1: cp(C.cp1), c6: c6out, rows,
          snap: cp({ taken: snap.taken, name: snap.name, cohort: snap.cohort, peer_source: snap.peer_source, sector: snap.sector, industry: snap.industry, price: snap.price, price_date: snap.price_date, price_from: snap.price_from, shares: snap.shares, mcap: snap.mcap, net_debt: snap.net_debt, net_debt_date: snap.net_debt_date, eps_ttm: snap.eps_ttm, eps_date: snap.eps_date, eps_fy1: snap.eps_fy1, fy1_date: snap.fy1_date, eps_fy2: snap.eps_fy2, fy2_date: snap.fy2_date, forward: snap.forward, fwd: snap.fwd, revenue_ttm: snap.revenue_ttm, ebitda_ttm: snap.ebitda_ttm, dates: snap.dates, peer_dates: snap.peer_dates, table: snap.table, members: snap.members, excluded: snap.excluded, names: snap.names, fx: snap.fx, quotes_error: snap.quotes_error }),
          text: document.getElementById("scCompsTab").innerText.replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").slice(0, 7000) };
      });
    } catch (e) { r.live = { error: String(e && e.message || e).slice(0, 300) }; }
    log(T, "live:", r.live.error ? "ERROR " + r.live.error : `${r.live.c6 && r.live.c6.pricedOn} · band ${r.live.band ? [r.live.band.lo, r.live.band.mid, r.live.band.hi].map((x) => Math.round(x)).join("/") : "none"} · price ${r.live.price} · peers on ${(r.live.peersOn || []).length}`);
    /* (2) the four switches, C3b */
    r.sets = {};
    for (const key of ["TIGHTEST", "HOME", "FMP", "LARGEST"]) {
      try {
        const st = await page.evaluate(async ([t, key]) => {
          const cp = window.__cp;
          const m = await import("/deliverables/20261001/comps-table-first/tab.mjs");
          let box = document.getElementById("cw2box"); if (!box) { box = document.createElement("div"); box.id = "cw2box"; box.style.cssText = "position:fixed;left:0;top:0;width:1200px;height:600px;overflow:hidden;opacity:0;pointer-events:none;z-index:-1"; document.body.appendChild(box); }
          box.dataset.t = t; delete box.dataset.mounted; box.innerHTML = "";
          const api = (typeof window !== "undefined" && window.SC_CHART_API) || "https://scintilla-massive-chart-api.fly.dev";
          const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("the set did not read in 150 s")), 150000));
          await Promise.race([m.mountCompsTab(box, { ticker: t, pg, today: todayISO(), set: key,
            quotes: (syms) => fetch(api + "/quotes?symbols=" + encodeURIComponent(syms.join(","))).then((r) => { if (!r.ok) throw new Error("quotes → " + r.status); return r.json(); }),
            livePrices: (typeof PRICES !== "undefined") ? PRICES : {}, read: (p) => pg(p, 1), write: () => Promise.reject(new Error("CW2: writes are not allowed")), open: () => {} }), timeout]);
          const S = box._ct; if (!S) return { error: "no state on the box", text: box.innerText.slice(0, 500) };
          const out = { set: S.set, way: S.way, mode: S.mode, sets: cp(S.sets.sets.map((s) => ({ key: s.key, label: s.label, members: s.members, missing: s.missing || null, source: s.source || null, all_peers: s.all_peers || null, off_hub: s.off_hub || null, fetched_at: s.fetched_at || null, from: s.from || null }))), tags: cp(S.sets.tags), home: S.sets.home, tightest: S.sets.tightest,
            ctx: cp({ set: S.ctx.set, set_label: S.ctx.set_label, peer_source: S.ctx.peer_source, cohort: S.ctx.cohort, members: S.ctx.members, excluded: S.ctx.excluded, inputs: (S.ctx.inputs || []).map((i) => ({ ticker: i.ticker, name: i.name, mcap: i.mcap, price: i.price, eps_ttm: i.eps_ttm, is_etf: i.is_etf, currency: i.currency, sector: i.sector, industry: i.industry, country: i.country })) }),
            members: S.members, snap: cp({ price: S.snap.price, price_date: S.snap.price_date, name: S.snap.name, sector: S.snap.sector, industry: S.snap.industry, cohort: S.snap.cohort, eps_ttm: S.snap.eps_ttm, eps_fy1: S.snap.eps_fy1, forward: S.snap.forward, table: S.snap.table, fx: S.snap.fx, quotes_error: S.snap.quotes_error }),
            C: cp({ band: S.C.band, upside: S.C.upside, reason: S.C.reason, ways: S.C.ways, waysAll: S.C.waysAll.map((w) => ({ way: w.way, ok: w.ok, lo: w.lo, mid: w.mid, hi: w.hi, upside: w.upside, reason: w.reason })), disagreement: S.C.disagreement, off: S.C.off, cls: S.C.cls, reliability: S.C.reliability, rows: S.C.rows }), decisions_n: (S.decisions || []).length,
            text: box.innerText.replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").slice(0, 4000) };
          box.dataset.mounted = "done"; /* stops the background reads of the other sets */
          return out;
        }, [T, key]);
        r.sets[key] = st;
        log(T, key + ":", st.error ? "ERROR " + st.error : `${st.ctx.set_label} · ${st.members.length - 1} peers · band ${st.C.band ? [st.C.band.lo, st.C.band.mid, st.C.band.hi].map((x) => Math.round(x)).join("/") : "none (" + (st.C.reason || "") + ")"}`);
      } catch (e) { r.sets[key] = { error: String(e && e.message || e).slice(0, 300) }; log(T, key, "ERROR", r.sets[key].error); }
    }
    r.seconds = Math.round((Date.now() - t0) / 1000);
    fs.writeFileSync(path.join(outDir, T + ".json"), JSON.stringify(r, null, 1));
  }
} finally { await browser.close(); server.close(); }
fs.writeFileSync(path.join(outDir, "_run.json"), JSON.stringify({ done: true, at: new Date().toISOString(), tickers, errors, writes_blocked: writes.length, writes: [...new Set(writes)].slice(0, 20) }, null, 1));
log(JSON.stringify({ done: true, n_errors: errors.length, writes_blocked: writes.length }));

// HC1 — is the Hub's consolidated sector reading the allocation tool's? Both pages are opened headless at the same
// moment and each is asked for its own numbers: the Hub branch's scBlendRows() and the live allocation tool's blendTable().
// It is asked twice over: as each page loaded, and again with the Hub given the tool's own list of which name sits in which
// sector for that load. The tool fills that list from two reads that race (the industry table and the State Street funds'
// holdings; whichever lands first names a name's sector), so its own numbers move a little from load to load; the Hub
// always takes the industry table first. The second comparison takes that out and leaves only the arithmetic.
// Every request that is not a GET is stopped. Appends one run to data/blend-crosscheck.json (runs[]; the top level is the newest).
//   node deliverables/20261006/hc1-compare-one-screen/tools/blend-crosscheck.mjs
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { openHub, sleep, D, REPO } from "./rig.mjs";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");

const hub = await openHub({ width: 1680, local: REPO });
const browser = await chromium.launch({ headless: true });
const out = { at: new Date().toISOString(), allocation: "https://allocation.scintillahub.ai/ (live)", rows: [] };
try {
  const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 }, serviceWorkers: "block" });
  let blocked = 0;
  await ctx.route("**/*", (r) => { const m = r.request().method(); if (m !== "GET" && m !== "OPTIONS" && m !== "HEAD") { blocked++; return r.abort(); } return r.continue(); });
  const ap = await ctx.newPage();
  const [,] = await Promise.all([
    ap.goto("https://allocation.scintillahub.ai/", { waitUntil: "networkidle", timeout: 180000 }),
    (async () => { await hub.page.waitForSelector("#boardScroll .sc-board__row", { timeout: 90000 }); await hub.page.click('[data-act="l0tab"][data-tab="COHORT"]'); })(),
  ]);
  await hub.page.waitForFunction(() => typeof SC_BLEND !== "undefined" && SC_BLEND.at > 0, null, { timeout: 60000 });
  await ap.waitForFunction(() => typeof blendTable === "function" && blendTable().length >= 11 && typeof TREE_ROLL !== "undefined" && !!TREE_ROLL && !!MKTBOW, null, { timeout: 90000 });
  await sleep(1500);
  const allocMap = await ap.evaluate(() => Object.assign({}, SECTOR_MAP));
  const hubMap = await hub.page.evaluate(() => Object.assign({}, SC_BLEND.secMap));
  const names = Array.from(new Set(Object.keys(allocMap).concat(Object.keys(hubMap)))).sort();
  out.sectorList = { names: names.length, sameInBoth: names.filter((t) => allocMap[t] === hubMap[t]).length,
    differ: names.filter((t) => allocMap[t] !== hubMap[t]).map((t) => ({ name: t, allocation: allocMap[t] || null, hub: hubMap[t] || null })) };
  /* the Hub's own arithmetic, given the tool's list for this load */
  const HS = await hub.page.evaluate((m) => { const keep = SC_BLEND.secMap; SC_BLEND.secMap = m; SC_BLEND.tree = null;
    try { return scBlendRows().map((r) => ({ fund: r.key, score: r.mean })); } finally { SC_BLEND.secMap = keep; SC_BLEND.tree = null; } }, allocMap);
  const [H, A] = await Promise.all([
    hub.page.evaluate(() => ({ geigerAt: (typeof SC_GEIGER_META !== "undefined" && SC_GEIGER_META && SC_GEIGER_META.computed_utc) || null,
      rows: scBlendRows().map((r) => ({ fund: r.key, name: r.label, score: r.mean, used: r.blend.used, missing: r.blend.missing, cap: r.blend.cap, eq: r.blend.eq,
        parts: Object.fromEntries(Object.entries(r.blend.parts).map(([k, p]) => [k, p ? { score: p.score, label: p.label } : null])) })) })),
    ap.evaluate(() => ({ geigerAt: geigerTs(), weights: mixWeights(),
      rows: blendTable().filter((r) => SECT_CW[r.key]).map((r) => ({ fund: SECT_CW[r.key], name: r.name, score: r.score, used: r.used, missing: r.missing, cap: r.cap, eq: r.eq,
        parts: Object.fromEntries(Object.entries(r.parts || {}).map(([k, p]) => [k, p ? { score: p.score, label: p.label } : null])) })) })),
  ]);
  out.allocationWeights = A.weights; out.allocationGeigerAt = A.geigerAt; out.nonGetStopped = { allocation: blocked, hub: hub.count.blocked };
  let worst = 0, worstSame = 0;
  for (const h of H.rows) {
    const a = A.rows.find((x) => x.fund === h.fund);
    const d = a && a.score != null && h.score != null ? h.score - a.score : null;
    const parts = {};
    for (const k of ["SPDR", "HUBCMP", "MKTBOW", "TREE", "RANK"]) parts[k] = { hub: h.parts[k] && h.parts[k].score, alloc: a && a.parts[k] && a.parts[k].score,
      diff: (h.parts[k] && a && a.parts[k]) ? +(h.parts[k].score - a.parts[k].score).toFixed(4) : null, hubLabel: h.parts[k] && h.parts[k].label, allocLabel: a && a.parts[k] && a.parts[k].label };
    if (d != null) worst = Math.max(worst, Math.abs(d));
    const hs = HS.find((x) => x.fund === h.fund), ds = hs && a && hs.score != null && a.score != null ? hs.score - a.score : null;
    if (ds != null) worstSame = Math.max(worstSame, Math.abs(ds));
    out.rows.push({ fund: h.fund, sector: h.name, hub: h.score, allocation: a ? a.score : null, diff: d == null ? null : +d.toFixed(4), hubWithToolsList: hs ? hs.score : null, diffWithToolsList: ds == null ? null : +ds.toFixed(4),
      hubUsed: h.used.length, allocUsed: a ? a.used.length : null, parts });
    console.log(h.fund.padEnd(5), String(h.name).padEnd(14), "hub", (h.score == null ? "—" : h.score.toFixed(4)).padStart(8), "alloc", (a && a.score != null ? a.score.toFixed(4) : "—").padStart(8), "diff", d == null ? "—" : d.toFixed(4),
      "| parts diff", Object.entries(parts).map(([k, v]) => k + ":" + (v.diff == null ? "—" : v.diff)).join(" "));
  }
  out.worstDifference = +worst.toFixed(4); out.worstWithToolsList = +worstSame.toFixed(4);
  console.log("worst difference as each page loaded:", out.worstDifference, "· with the tool's own sector list:", out.worstWithToolsList, "· names whose sector differs:", out.sectorList.differ.length,
    JSON.stringify(out.sectorList.differ.slice(0, 12)), "· non-GET stopped", JSON.stringify(out.nonGetStopped));
  const f = path.join(D, "data", "blend-crosscheck.json");
  let prev = []; try { const j = JSON.parse(fs.readFileSync(f, "utf8")); prev = (j.runs || []).filter((r) => r.worstWithToolsList != null); } catch (_) {}
  const brief = { at: out.at, worstDifference: out.worstDifference, worstWithToolsList: out.worstWithToolsList, namesWhoseSectorDiffers: out.sectorList.differ.map((x) => x.name) };
  out.runs = prev.concat([brief]);
  fs.writeFileSync(f, JSON.stringify(out, null, 1));
} finally { await browser.close(); await hub.close(); }

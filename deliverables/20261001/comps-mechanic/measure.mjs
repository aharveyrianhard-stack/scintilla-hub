/* C4 · measure on the served universe: (1) the mechanic's yield — how many names get a set of at least five on the
   default band and N, and the counts at each step; (2) how often the four centres (A, B, C equal, C weighted) differ by
   more than 5% (highest centre ÷ lowest centre − 1), per company on its own mechanical set. Reads the Hub's tables with the
   public key (paged), the chart API for prices, the tree for funds. Writes measure-<today>.json next to this file.
     node deliverables/20261001/comps-mechanic/measure.mjs [limit] */
import { readFileSync, writeFileSync } from "node:fs"; import { fileURLToPath } from "node:url"; import path from "node:path";
import { inputs, buildSet, snapshotFromCohort } from "./read.mjs";
import { readCohort } from "../comps-template/cohort.mjs";
import { fourWays, wayOf } from "../comps-template/template.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../..");
const HUB = "https://scintillahub.ai", SB = "https://wadinxqplrggagkvrdag.supabase.co", API = "https://scintilla-massive-chart-api.fly.dev";
const TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }), LIMIT = +(process.argv[2] || 0);
let KEY = null; for (const page of ["/pip.html", "/index.html"]) { const m = (await (await fetch(HUB + page)).text()).match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_.\-]+/); if (m) { KEY = m[0]; break; } }
const pg = async (p) => { const r = await fetch(SB + "/rest/v1/" + p, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } }); if (!r.ok) throw new Error(p.split("?")[0] + " → " + r.status); return r.json(); };
const fetchJson = async (u) => JSON.parse(readFileSync(path.join(ROOT, u), "utf8"));
const quotes = async (T) => { const r = await fetch(`${API}/quotes?symbols=${encodeURIComponent(T.join(","))}`, { headers: { Origin: HUB } }); if (!r.ok) throw new Error("quotes → " + r.status); return r.json(); };
const fxStandin = JSON.parse(readFileSync(path.join(HERE, "../comps-template/fx-standin-ecb-2026-10-01.json"), "utf8"));
const inp = await inputs({ pg, fetchJson });
const served = (await (await fetch(API + "/universe", { headers: { Origin: HUB } })).json()).symbols.filter((t) => inp.profiles[t] && !inp.profiles[t].is_etf);
console.log(`served companies with a profile: ${served.length} · tables: ${JSON.stringify(inp.tables)} · industry table ${inp.industry_table} · funds ${inp.funds.length}`);
const out = { today: TODAY, taken: new Date().toISOString(), n_served: served.length, tables: inp.tables, industry_table: inp.industry_table, yield: { ge5: 0, lt5: 0, zero: 0 }, steps: [], ways: [], errors: [] };
const list = LIMIT ? served.slice(0, LIMIT) : served;
const cache = new Map();
for (const t of list) {
  let set; try { set = buildSet(t, inp); } catch (e) { out.errors.push(t + ": " + e.message); continue; }
  out.steps.push({ ticker: t, industry: set.own_industry, ...set.counts, sources_fmp: set.sources.fmp.length, sources_massive: set.sources.massive.length, funds: set.my_funds.length });
  if (set.counts.kept >= 5) out.yield.ge5++; else if (set.counts.kept > 0) out.yield.lt5++; else out.yield.zero++;
  if (set.counts.kept < 2) continue;
  try {
    const members = [t, ...set.kept.map((r) => r.ticker)];
    const ctx = await readCohort({ ticker: t, today: TODAY, pg, quotes, fxStandin, membersAsked: members, labelAsked: "mechanic" });
    const snap = snapshotFromCohort(ctx, t);
    const W = fourWays(snap.rows, snap.price, { peerCount: set.counts.kept, cls: "default" });
    const ok = W.filter((w) => w.ok);
    if (ok.length < 4) { out.ways.push({ ticker: t, ok: ok.length }); continue; }
    const mids = Object.fromEntries(W.map((w) => [w.way, w.mid]));
    const spread = Math.max(...ok.map((w) => w.mid)) / Math.min(...ok.map((w) => w.mid)) - 1;
    out.ways.push({ ticker: t, ok: 4, mids, spread4: spread, ce_vs_cw: Math.abs(mids.CW / mids.CE - 1), a_vs_b: Math.abs(mids.A / mids.B - 1), price: snap.price });
  } catch (e) { out.errors.push(t + ": " + e.message); }
  if (out.steps.length % 50 === 0) console.log(`… ${out.steps.length} of ${list.length}`);
}
const w4 = out.ways.filter((w) => w.ok === 4);
out.summary = {
  measured: w4.length, four_centres_differ_gt5pct: w4.filter((w) => w.spread4 > 0.05).length, ce_vs_cw_gt5pct: w4.filter((w) => w.ce_vs_cw > 0.05).length, ce_vs_cw_gt1pct: w4.filter((w) => w.ce_vs_cw > 0.01).length, a_vs_b_gt5pct: w4.filter((w) => w.a_vs_b > 0.05).length,
  median_spread4: w4.length ? w4.map((w) => w.spread4).sort((a, b) => a - b)[Math.floor(w4.length / 2)] : null, median_ce_cw: w4.length ? w4.map((w) => w.ce_vs_cw).sort((a, b) => a - b)[Math.floor(w4.length / 2)] : null,
  kept_median: out.steps.map((s) => s.kept).sort((a, b) => a - b)[Math.floor(out.steps.length / 2)],
};
writeFileSync(path.join(HERE, `measure-${TODAY}.json`), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ yield: out.yield, summary: out.summary, errors: out.errors.length }, null, 1));

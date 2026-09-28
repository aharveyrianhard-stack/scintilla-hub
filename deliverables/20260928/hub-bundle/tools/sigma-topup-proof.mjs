/* N6 (28 Sep) — local proof for the sigma-daily top-up. Writes NOTHING to any database.
   1. Reads the rows already stored for the chosen dates (public read, the Hub's anon key).
   2. Recomputes those dates the way the edge function will: planTopUp over each served name's SHORT daily window.
   3. Compares row by row, and saves the result.
   node deliverables/20260928/hub-bundle/tools/sigma-topup-proof.mjs [--since 2026-09-22] [--out file.json] */
import fs from "node:fs";
import { planTopUp, barsNeeded } from "../../../../supabase/functions/sigma-daily/topup.mjs";
import { RULES } from "../../../../supabase/functions/scintillas-detect/rules.mjs";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const SINCE = arg("since", "2026-09-22"), OUT = arg("out", null);
const CHART = "https://scintilla-massive-chart-api.fly.dev", SB = "https://wadinxqplrggagkvrdag.supabase.co/rest/v1";
const page = fs.readFileSync(new URL("../../../../index.html", import.meta.url), "utf8");
const ANON = page.match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)[0];   // the public anon key the Hub ships
const sb = async (p) => { const r = await fetch(SB + p, { headers: { apikey: ANON, Authorization: "Bearer " + ANON } }); if (!r.ok) throw new Error("sb " + r.status); return r.json(); };
const chart = async (p) => { for (let k = 0; k < 3; k++) { const r = await fetch(CHART + p, { headers: { origin: "https://scintillahub.ai" } }); if (r.ok) return r.json(); await new Promise((s) => setTimeout(s, 1500)); } throw new Error("chart " + p); };
const today = new Date().toISOString().slice(0, 10), limit = barsNeeded(SINCE, today);
const syms = ((await chart("/universe")).symbols || []).map((s) => (typeof s === "string" ? s : s.symbol));
const bars = {}, failed = [];
for (let i = 0; i < syms.length; i += 12) await Promise.all(syms.slice(i, i + 12).map(async (s) => {
  try { const j = await chart(`/candles?symbol=${encodeURIComponent(s)}&tf=1d&limit=${limit}`); bars[s] = j.series || []; } catch (e) { failed.push(s); }
}));
const plan = planTopUp(bars, RULES, { since: SINCE, failed });
const storedC = await sb(`/sigma_day_counts?select=date,names_measured,n,up,dn&date=gte.${SINCE}&order=date.asc`);
const storedE = await sb(`/sigma_events_daily?select=ticker,date,move_pct,usual_day_60,x_usual,direction,fired&date=gte.${SINCE}&order=date.asc,ticker.asc&limit=10000`);
const key = (e) => e.ticker + "|" + e.date;
const sMap = new Map(storedE.map((e) => [key(e), e])), pMap = new Map(plan.events.map((e) => [key(e), e]));
const onlyStored = [...sMap.keys()].filter((k) => !pMap.has(k) && plan.written_dates.includes(k.split("|")[1]));
const onlyNew = [...pMap.keys()].filter((k) => !sMap.has(k));
const diff = [...pMap.keys()].filter((k) => sMap.has(k)).filter((k) => {
  const a = sMap.get(k), b = pMap.get(k);
  return Math.abs(a.move_pct - b.move_pct) > 1e-9 || Math.abs(a.usual_day_60 - b.usual_day_60) > 1e-9 || Math.abs(a.x_usual - b.x_usual) > 1e-9 ||
    a.direction !== b.direction || JSON.stringify([...a.fired].sort()) !== JSON.stringify([...b.fired].sort());
});
const countCmp = plan.counts.map((c) => { const s = storedC.find((x) => x.date === c.date);
  return { date: c.date, planned: [c.names_measured, c.n, c.up, c.dn], stored: s ? [s.names_measured, s.n, s.up, s.dn] : null,
           same: !!s && s.names_measured === c.names_measured && s.n === c.n && s.up === c.up && s.dn === c.dn }; });
const res = { at: new Date().toISOString(), since: SINCE, bars_per_name: limit, names: Object.keys(bars).length, failed,
  newest_bar: plan.newest_bar, dates_planned: plan.written_dates, held: plan.held, lagging: plan.lagging,
  events: { planned: plan.events.length, stored_same_dates: storedE.length, only_stored: onlyStored, would_add: onlyNew, value_diffs: diff },
  counts: countCmp, new_count_rows: countCmp.filter((c) => !c.stored) };
console.log(JSON.stringify(res, null, 1));
if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));

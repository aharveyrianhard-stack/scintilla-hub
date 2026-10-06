/* C6 (C5's snapshot.mjs + the reporting-currency sweep the tab loads) · one company's comparable set on the business-first rule, with the figures, from this Mac (the Hub's public key,
   the chart API, the segments fixture): set-<T>-<today>.json. node snapshot.mjs AMZN NVDA … */
import { readFileSync, writeFileSync } from "node:fs"; import { fileURLToPath } from "node:url"; import path from "node:path";
import { inputs as c4inputs, readSet, snapshotFromCohort } from "../../20261001/comps-mechanic/read.mjs";
import { buildSet, lineWords } from "../../20261003/comps-c5/lines.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../..");
const HUB = "https://scintillahub.ai", SB = "https://wadinxqplrggagkvrdag.supabase.co", API = "https://scintilla-massive-chart-api.fly.dev";
const TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
let KEY = null; for (const page of ["/pip.html", "/index.html"]) { const m = (await (await fetch(HUB + page)).text()).match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_.\-]+/); if (m) { KEY = m[0]; break; } }
const pg = async (p) => { const r = await fetch(SB + "/rest/v1/" + p, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } }); if (!r.ok) throw new Error(p.split("?")[0] + " → " + r.status); return r.json(); };
const fetchJson = async (u) => JSON.parse(readFileSync(path.join(ROOT, u), "utf8"));
const quotes = async (T) => { const r = await fetch(`${API}/quotes?symbols=${encodeURIComponent(T.join(","))}`, { headers: { Origin: HUB } }); if (!r.ok) throw new Error("quotes → " + r.status); return r.json(); };
const fxStandin = JSON.parse(readFileSync(path.join(HERE, "../../20261001/comps-template/fx-standin-ecb-2026-10-01.json"), "utf8"));
/* C6: the tab also loads C5b's reporting-currency sweep with the stand-in (GDS files in yuan); the fixture must match the tab */
fxStandin.reported = JSON.parse(readFileSync(path.join(HERE, "../../20261003/comps-c5b/reporting-currency-fmp-2026-10-03.json"), "utf8")).reported;
const inp = await c4inputs({ pg, fetchJson });
inp.segments = JSON.parse(readFileSync(path.join(HERE, "../../20261003/comps-c5/segments-2026-10-03.json"), "utf8")).companies;
for (const T of process.argv.slice(2).map((t) => t.toUpperCase())) {
  const set = buildSet(T, inp);
  const ctx = await readSet(T, set, { today: TODAY, pg, quotes, fxStandin });
  const snap = snapshotFromCohort(ctx, T);
  const estRows = await pg(`analyst_estimates?select=ticker,fiscal_date,est_eps_avg&period=eq.annual&ticker=in.(${ctx.members.map(encodeURIComponent).join(",")})&fiscal_date=gte.${TODAY}&order=ticker.asc,fiscal_date.asc`);
  const estimates = Object.fromEntries(ctx.inputs.map((i) => [i.ticker, { eps_ttm: i.eps_ttm ?? null, est: estRows.filter((e) => e.ticker === i.ticker).map((e) => ({ fiscal_date: e.fiscal_date, eps: e.est_eps_avg })) }]));
  const out = { taken: new Date().toISOString(), today: TODAY, ticker: T, set: { ...set, dropped: set.dropped.filter((d) => d.member || d.sources.length) }, snapshot: snap, estimates };
  writeFileSync(path.join(HERE, `set-${T}-${TODAY}.json`), JSON.stringify(out, null, 1));
  console.log(`${T.padEnd(5)} ${lineWords(set.own_lines)} · kept ${set.kept.map((r) => r.ticker).join(" ")} · price $${snap.price} · rows ok ${snap.rows.filter((r) => r.ok).length}/6`);
}

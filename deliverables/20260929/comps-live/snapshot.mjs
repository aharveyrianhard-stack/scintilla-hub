/* Scintilla · comps live (C1, 29 Sep) · take one dated snapshot from this Mac, with the same function the live
   company view uses (snapshot-live.mjs → takeSnapshot). No key on this machine is needed: the Hub's public read
   key is discovered at run time from the Hub's own pages, as the round-1/2/3 pages do; it is used for the reads
   and is NEVER written to disk or printed. The chart API only answers a request that carries the Hub's origin;
   this script sends that origin header for the /quotes read and says so in the snapshot.
     node deliverables/20260929/comps-live/snapshot.mjs [TICKER] [COHORT]
   Output: snapshot-<TICKER>-<today>.json next to this file, plus one line per row on the console. */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { takeSnapshot } from "./snapshot-live.mjs";
import { fmt } from "../../20260927/comps-r3/r3.mjs";

const HUB = "https://scintillahub.ai", SB = "https://wadinxqplrggagkvrdag.supabase.co", API = "https://scintilla-massive-chart-api.fly.dev";
const TICKER = (process.argv[2] || "MU").toUpperCase();
const TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
let KEY = null;
for (const page of ["/pip.html", "/index.html"]) {
  const m = (await (await fetch(HUB + page)).text()).match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_.\-]+/);
  if (m) { KEY = m[0]; break; }
}
if (!KEY) throw new Error("no read key could be found on the Hub's pages");
const pg = async (p) => { const r = await fetch(SB + "/rest/v1/" + p, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } }); if (!r.ok) throw new Error(p.split("?")[0] + " → " + r.status); return r.json(); };
const quotes = async (T) => { const r = await fetch(`${API}/quotes?symbols=${encodeURIComponent(T.join(","))}`, { headers: { Origin: HUB } }); if (!r.ok) throw new Error("quotes → " + r.status); return r.json(); };
const out = await takeSnapshot({ ticker: TICKER, cohortAsked: process.argv[3] || null, today: TODAY, pg, quotes });
out.quotes_origin = HUB;
const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, `snapshot-${TICKER}-${TODAY}.json`);
writeFileSync(file, JSON.stringify(out, null, 1));
console.log(`${file}\n${TICKER} · ${out.name} · cohort ${out.cohort} · price $${out.price} (${out.price_date}, ${out.price_from}) · EPS TTM $${out.eps_ttm} · EPS FY1 $${out.eps_fy1} (${out.fy1_date}) · shares ${out.shares && (out.shares / 1e6).toFixed(0)}M · net debt ${out.net_debt} · peers ${out.members.length - 1}${out.excluded.length ? " · excluded " + out.excluded.map((e) => e.ticker).join(",") : ""}${out.quotes_error ? " · QUOTES NOT REACHED: " + out.quotes_error : ""}`);
for (const r of out.rows) console.log(`${r.label.padEnd(14)} own ${fmt("x", r.own.multiple)} · n ${r.n} · low ${fmt("x", r.band.min)} q1 ${fmt("x", r.band.q1)} med ${fmt("x", r.band.median)} q3 ${fmt("x", r.band.q3)} high ${fmt("x", r.band.max)} · $ ${r.ends.min.price?.toFixed(0)} / ${r.ends.q1.price?.toFixed(0)} / ${r.ends.median.price?.toFixed(0)} / ${r.ends.q3.price?.toFixed(0)} / ${r.ends.max.price?.toFixed(0)} · ok ${r.ok}${r.reason ? " · " + r.reason : ""}`);

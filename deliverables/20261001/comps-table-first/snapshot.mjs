/* C3b · the peer sets of one company and a snapshot on each set, from this Mac, for the tests and the deliverable.
   node deliverables/20261001/comps-table-first/snapshot.mjs [TICKER] → sets-<TICKER>-<today>.json */
import { readFileSync, writeFileSync } from "node:fs"; import { fileURLToPath } from "node:url"; import path from "node:path";
import { resolveSets, readSet, snapshotFromCohort, largestDiffers } from "./sets.mjs";
import { conclusion, wayOf } from "../comps-template/template.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const HUB = "https://scintillahub.ai", SB = "https://wadinxqplrggagkvrdag.supabase.co", API = "https://scintilla-massive-chart-api.fly.dev";
const TICKER = (process.argv[2] || "TSM").toUpperCase(), TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
let KEY = null;
for (const page of ["/pip.html", "/index.html"]) { const m = (await (await fetch(HUB + page)).text()).match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_.\-]+/); if (m) { KEY = m[0]; break; } }
const pg = async (p) => { const r = await fetch(SB + "/rest/v1/" + p, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } }); if (!r.ok) throw new Error(p.split("?")[0] + " → " + r.status); return r.json(); };
const quotes = async (T) => { const r = await fetch(`${API}/quotes?symbols=${encodeURIComponent(T.join(","))}`, { headers: { Origin: HUB } }); if (!r.ok) throw new Error("quotes → " + r.status); return r.json(); };
const fxStandin = JSON.parse(readFileSync(path.join(HERE, "../comps-template/fx-standin-ecb-2026-10-01.json"), "utf8"));
const sets = await resolveSets({ ticker: TICKER, pg });
const cache = new Map(), out = { taken: new Date().toISOString(), today: TODAY, ticker: TICKER, tags: sets.tags, home: sets.home, tightest: sets.tightest, sets: [], fx_tables: null };
for (const s of sets.sets) {
  if (s.missing) { out.sets.push({ key: s.key, label: s.label, missing: s.missing }); continue; }
  const ctx = await readSet({ ticker: TICKER, set: s.key, sets, today: TODAY, pg, quotes, fxStandin, cache });
  const snap = snapshotFromCohort(ctx, TICKER);
  const C = conclusion(snap, [], "B"), w = wayOf(C.ways, "B");
  out.fx_tables = ctx.fx_tables;
  out.sets.push({ key: s.key, label: s.label, source: ctx.peer_source, members: ctx.members, snapshot: snap, way_b: w && w.ok ? { lo: w.lo, mid: w.mid, hi: w.hi, upside: w.upside.mid.pct } : null, ways: C.ways.map((x) => ({ way: x.way, ok: x.ok, lo: x.lo, mid: x.mid, hi: x.hi, upside: x.ok ? x.upside.mid.pct : null })) });
  console.log(`${s.key.padEnd(9)} ${s.label.padEnd(28)} ${String(ctx.members.length - 1).padStart(3)} peers · B ${w && w.ok ? `$${Math.round(w.lo)} – $${Math.round(w.hi)}, centre $${Math.round(w.mid)}, ${w.upside.mid.pct.toFixed(0)}%` : "no band"}`);
}
out.largest_differs = largestDiffers(sets);
const file = path.join(HERE, `sets-${TICKER}-${TODAY}.json`); writeFileSync(file, JSON.stringify(out, null, 1));
console.log(file, "· tags", sets.tags.map((t) => t.tag + ":" + t.size).join(" "), "· tightest", sets.tightest, "· home", sets.home, "· largest differs", out.largest_differs, "· fx tables", JSON.stringify(out.fx_tables));

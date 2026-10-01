/* C4 · one company's comparable set on the rule, with the figures, from this Mac: set-<T>-<today>.json */
import { readFileSync, writeFileSync } from "node:fs"; import { fileURLToPath } from "node:url"; import path from "node:path";
import { inputs, buildSet, readSet, snapshotFromCohort } from "./read.mjs";
import { conclusion, wayOf } from "../comps-template/template.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../..");
const HUB = "https://scintillahub.ai", SB = "https://wadinxqplrggagkvrdag.supabase.co", API = "https://scintilla-massive-chart-api.fly.dev";
const TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
let KEY = null; for (const page of ["/pip.html", "/index.html"]) { const m = (await (await fetch(HUB + page)).text()).match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_.\-]+/); if (m) { KEY = m[0]; break; } }
const pg = async (p) => { const r = await fetch(SB + "/rest/v1/" + p, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } }); if (!r.ok) throw new Error(p.split("?")[0] + " → " + r.status); return r.json(); };
const fetchJson = async (u) => JSON.parse(readFileSync(path.join(ROOT, u), "utf8"));
const quotes = async (T) => { const r = await fetch(`${API}/quotes?symbols=${encodeURIComponent(T.join(","))}`, { headers: { Origin: HUB } }); if (!r.ok) throw new Error("quotes → " + r.status); return r.json(); };
const fxStandin = JSON.parse(readFileSync(path.join(HERE, "../comps-template/fx-standin-ecb-2026-10-01.json"), "utf8"));
const inp = await inputs({ pg, fetchJson });
for (const T of process.argv.slice(2).map((t) => t.toUpperCase())) {
  const set = buildSet(T, inp);
  const ctx = await readSet(T, set, { today: TODAY, pg, quotes, fxStandin });
  const snap = snapshotFromCohort(ctx, T);
  const C = conclusion(snap, [], "B");
  const out = { taken: new Date().toISOString(), today: TODAY, ticker: T, tables: inp.tables, set: { ...set, dropped: set.dropped }, snapshot: snap, ways: C.ways.map((w) => ({ way: w.way, ok: w.ok, lo: w.lo, mid: w.mid, hi: w.hi, upside: w.ok ? w.upside.mid.pct : null, weights: w.weights || null })), disagreement: C.disagreement };
  writeFileSync(path.join(HERE, `set-${T}-${TODAY}.json`), JSON.stringify(out, null, 1));
  const b = wayOf(C.ways, "B");
  console.log(`${T.padEnd(5)} ${String(set.own_industry).padEnd(26)} cand ${set.counts.candidates} → ind ${set.counts.same_industry} → band ${set.counts.in_band} → kept ${set.counts.kept}: ${set.kept.map((r) => r.ticker + "[" + r.sources.map((s) => s[0]).join("") + "]").join(" ")} · fmp ${set.source_state.fmp} · massive ${set.source_state.massive} · funds ${set.source_state.fund} · B ${b && b.ok ? `$${Math.round(b.lo)}–$${Math.round(b.hi)} centre $${Math.round(b.mid)} ${b.upside.mid.pct.toFixed(0)}%` : "no band"} · price $${snap.price}`);
}

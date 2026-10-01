/* Scintilla · COMPS tab (C2) · one dated read of a whole cohort from this Mac, and a snapshot per member, for the tests
   and the deliverable. The Hub's public read key is discovered from the Hub's own pages (never written or printed); the
   chart API is asked with the Hub's origin header, as the round-1/2/3 scripts did.
     node deliverables/20260930/comps-tab/snapshot.mjs [TICKER]   → cohort-<COHORT>-<today>.json */
import { writeFileSync } from "node:fs"; import { fileURLToPath } from "node:url"; import path from "node:path";
import { readCohort, snapshotFromCohort } from "./cohort.mjs";
const HUB = "https://scintillahub.ai", SB = "https://wadinxqplrggagkvrdag.supabase.co", API = "https://scintilla-massive-chart-api.fly.dev";
const TICKER = (process.argv[2] || "MU").toUpperCase(), TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
let KEY = null;
for (const page of ["/pip.html", "/index.html"]) { const m = (await (await fetch(HUB + page)).text()).match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_.\-]+/); if (m) { KEY = m[0]; break; } }
if (!KEY) throw new Error("no read key could be found on the Hub's pages");
const pg = async (p) => { const r = await fetch(SB + "/rest/v1/" + p, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } }); if (!r.ok) throw new Error(p.split("?")[0] + " → " + r.status); return r.json(); };
const quotes = async (T) => { const r = await fetch(`${API}/quotes?symbols=${encodeURIComponent(T.join(","))}`, { headers: { Origin: HUB } }); if (!r.ok) throw new Error("quotes → " + r.status); return r.json(); };
const ctx = await readCohort({ ticker: TICKER, today: TODAY, pg, quotes });
const snapshots = ctx.members.filter((t) => !ctx.excluded.some((e) => e.ticker === t)).map((t) => { try { return snapshotFromCohort(ctx, t); } catch (e) { return { ticker: t, error: String(e.message || e) }; } });
const out = { taken: ctx.taken, today: TODAY, cohort: ctx.cohort, asked_for: TICKER, members: ctx.members, excluded: ctx.excluded, names: ctx.names, quotes_error: ctx.quotes_error, quotes_origin: HUB, snapshots };
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), `cohort-${ctx.cohort}-${TODAY}.json`);
writeFileSync(file, JSON.stringify(out, null, 1));
console.log(file, "·", ctx.cohort, "·", ctx.members.length, "members ·", snapshots.filter((s) => s.error).length, "errors", ctx.quotes_error ? "· QUOTES NOT REACHED " + ctx.quotes_error : "");
for (const s of snapshots.slice(0, 40)) console.log(s.error ? `${s.ticker}: ${s.error}` : `${s.ticker.padEnd(6)} $${s.price} geiger ${s.geiger} · ` + s.rows.map((r) => `${r.key} n${r.n}${r.ok ? "" : "×"}`).join(" "));

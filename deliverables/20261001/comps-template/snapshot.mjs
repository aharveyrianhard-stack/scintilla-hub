/* C3 · one dated read of a whole cohort from this Mac with the stand-in rates, a snapshot per member, for the tests and
   the deliverable.  node deliverables/20261001/comps-template/snapshot.mjs [TICKER]  → cohort-<COHORT>-<today>.json */
import { readFileSync, writeFileSync } from "node:fs"; import { fileURLToPath } from "node:url"; import path from "node:path";
import { readCohort, snapshotFromCohort } from "./cohort.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const HUB = "https://scintillahub.ai", SB = "https://wadinxqplrggagkvrdag.supabase.co", API = "https://scintilla-massive-chart-api.fly.dev";
const TICKER = (process.argv[2] || "MU").toUpperCase(), TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
let KEY = null;
for (const page of ["/pip.html", "/index.html"]) { const m = (await (await fetch(HUB + page)).text()).match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_.\-]+/); if (m) { KEY = m[0]; break; } }
if (!KEY) throw new Error("no read key could be found on the Hub's pages");
const pg = async (p) => { const r = await fetch(SB + "/rest/v1/" + p, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } }); if (!r.ok) throw new Error(p.split("?")[0] + " → " + r.status); return r.json(); };
const quotes = async (T) => { const r = await fetch(`${API}/quotes?symbols=${encodeURIComponent(T.join(","))}`, { headers: { Origin: HUB } }); if (!r.ok) throw new Error("quotes → " + r.status); return r.json(); };
const fxStandin = JSON.parse(readFileSync(path.join(HERE, "fx-standin-ecb-2026-10-01.json"), "utf8"));
const ctx = await readCohort({ ticker: TICKER, today: TODAY, pg, quotes, fxStandin });
const snapshots = ctx.members.filter((t) => !ctx.excluded.some((e) => e.ticker === t)).map((t) => { try { return snapshotFromCohort(ctx, t); } catch (e) { return { ticker: t, error: String(e.message || e) }; } });
const out = { taken: ctx.taken, today: TODAY, cohort: ctx.cohort, asked_for: TICKER, members: ctx.members, excluded: ctx.excluded, names: ctx.names, fx_tables: ctx.fx_tables, fx: ctx.fx, quotes_error: ctx.quotes_error, quotes_origin: HUB, snapshots };
const file = path.join(HERE, `cohort-${ctx.cohort}-${TODAY}.json`);
writeFileSync(file, JSON.stringify(out, null, 1));
console.log(file, "·", ctx.cohort, "·", ctx.members.length, "members ·", snapshots.filter((s) => s.error).length, "errors · fx tables", JSON.stringify(ctx.fx_tables), ctx.quotes_error ? "· QUOTES NOT REACHED " + ctx.quotes_error : "");
for (const t of Object.keys(ctx.fx)) if (ctx.fx[t].currency && ctx.fx[t].currency !== "USD") console.log("FX", t, ctx.fx[t].currency, ctx.fx[t].converted, "·", ctx.fx[t].why, "·", ctx.fx[t].adr && ctx.fx[t].adr.basis);
for (const s of snapshots) console.log(s.error ? `${s.ticker}: ${s.error}` : `${s.ticker.padEnd(6)} $${s.price} · ` + s.rows.map((r) => `${r.key} ${r.own.multiple != null ? r.own.multiple.toFixed(1) + "x" : "—"}/n${r.n}${r.ok ? "" : "×"}`).join(" "));

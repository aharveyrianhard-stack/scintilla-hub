/* FD1 · THE REHEARSAL OF THE FIXED FEED. Reads the Hub's public tables through its public read key (a private file
   `.anon` in the working folder, never committed) with the very reads the edge function makes (feed.mjs: queries,
   readTables) and answers with the very text it would answer (buildFeed). Read-only: GET requests, nothing written
   to any table, nothing deployed.
     node fixed-feed.mjs MU SNDK WDC STX          prints the CSV the fixed function would return
     node fixed-feed.mjs --json MU …              the rows with the basis of every figure
   import { fixedFeed, liveFeed } from "./fixed-feed.mjs"   for the other FD1 tools */
import { readFileSync } from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)), WT = path.resolve(HERE, "../../../..");
const { parseSyms, readTables, buildFeed, MAX_SYMS, VERSION } = await import(WT + "/supabase/functions/comps-feed/feed.mjs");
const SB = "https://wadinxqplrggagkvrdag.supabase.co";
let KEY = null; const key = () => (KEY ??= readFileSync(".anon", "utf8").trim());
export const todayUTC = () => new Date().toISOString().slice(0, 10);
export async function pg(p) {
  for (let a = 0; a < 4; a++) {
    try { const r = await fetch(SB + "/rest/v1/" + p, { headers: { apikey: key(), Authorization: "Bearer " + key() } }); if (!r.ok) throw new Error(p.split("?")[0] + " → " + r.status); return await r.json(); }
    catch (e) { if (a === 3) throw e; await new Promise((r) => setTimeout(r, 1200 * (a + 1))); }
  }
}
/** How many rows a read holds in all (PostgREST's exact count), without fetching them. */
export async function pgCount(p) { const r = await fetch(SB + "/rest/v1/" + p + "&limit=1", { headers: { apikey: key(), Authorization: "Bearer " + key(), Prefer: "count=exact" } }); if (!r.ok) throw new Error(p.split("?")[0] + " → " + r.status); return Number((r.headers.get("content-range") || "").split("/")[1]); }
/** The fixed feed for any number of symbols, in the function's own batches of MAX_SYMS. Returns { csv, rows, tables_rows }. */
export async function fixedFeed(symbols, today = todayUTC()) {
  const all = parseSymsMany(symbols), rows = [], counts = { fundamentals: 0, history: 0, ratios: 0, estimates: 0, filers: 0, fx: 0 };
  for (let i = 0; i < all.length; i += MAX_SYMS) {
    const syms = all.slice(i, i + MAX_SYMS), tables = await readTables(pg, syms, today);
    for (const k of Object.keys(counts)) counts[k] += tables[k].length;
    rows.push(...buildFeed(syms, tables, today).rows);
  }
  return { version: VERSION, today, rows, counts };
}
function parseSymsMany(symbols) { const out = []; for (let i = 0; i < symbols.length; i += MAX_SYMS) for (const s of parseSyms(symbols.slice(i, i + MAX_SYMS).join(","))) if (!out.includes(s)) out.push(s); return out; }
/** One request to the fixed feed, answered as the function answers it (the text). */
export async function fixedFeedText(rawSyms, today = todayUTC()) { const syms = parseSyms(rawSyms); if (!syms.length) return buildFeed([], { fundamentals: [], history: [], ratios: [], estimates: [], filers: [], fx: [] }, today).csv; return buildFeed(syms, await readTables(pg, syms, today), today).csv; }
/** The LIVE feed as deployed, one request (a GET, as the allocation page makes it). */
export async function liveFeedText(rawSyms) { const r = await fetch(SB + "/functions/v1/comps-feed?syms=" + encodeURIComponent(rawSyms)); if (!r.ok) throw new Error("live comps-feed → " + r.status); return await r.text(); }
export function parseCsv(text) { const L = text.trim().split("\n"), head = L[0].split(","); return Object.fromEntries(L.slice(1).map((l) => { const c = l.split(","), o = {}; head.forEach((h, i) => (o[h] = h === "sym" || h === "updated" ? c[i] : c[i] === "" ? null : +c[i])); return [c[0], o]; })); }
if (process.argv[1] && process.argv[1].endsWith("fixed-feed.mjs")) {
  const args = process.argv.slice(2), json = args.includes("--json"), syms = args.filter((a) => !a.startsWith("--"));
  if (json) console.log(JSON.stringify(await fixedFeed(syms), null, 1)); else console.log(await fixedFeedText(syms.join(",")));
}

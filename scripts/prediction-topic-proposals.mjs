#!/usr/bin/env node
/* P2 (2 Oct 2026) — THE TOPIC METHOD, run from a Mac or by the coordinator: our last 7 days of news decide which
   prediction-market topics to propose. Same code as the edge function's mode (supabase/functions/prediction-topic-proposals).
     node scripts/prediction-topic-proposals.mjs                 dry run: prints the proposals as JSON (no write)
     node scripts/prediction-topic-proposals.mjs --out f.json    also saves them (the report page and the section's fallback read this)
     node scripts/prediction-topic-proposals.mjs --write         inserts them into public.prediction_topic_proposals — needs
                                                                 SUPABASE_SERVICE_ROLE_KEY in the environment (the coordinator's; never on a Mac that lacks it)
   Reads: public.news titles (anon, read-only, paged) · prediction_market_latest (which topics are live) · the registry file ·
   Polymarket's public search (no key). The page's own anon client values are read from index.html at run time; nothing is
   copied into this file. Nothing is ever written unless --write is given. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VERSION, countThemes, propose, themesToSearch, SEARCH_URL, THEMES } from "../supabase/functions/prediction-topic-proposals/lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true) : null; };
const outFile = flag("--out"), doWrite = !!flag("--write"), days = Number(flag("--days") || 7);

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const SB = process.env.SUPABASE_URL || (html.match(/^const SB\s*=\s*"([^"]+)"/m) || [])[1];
const ANON = process.env.SUPABASE_ANON_KEY || (html.match(/^const ANON\s*=[^\n]*\n\s*"([^"]+)"/m) || [])[1];   // the page's fallback literal, second line
if (!SB || !ANON) { console.error("could not find the page's anon client in index.html"); process.exit(2); }
const H = { apikey: ANON, Authorization: "Bearer " + ANON };
async function pg(pathq) {
  const r = await fetch(SB + "/rest/v1/" + pathq, { headers: H });
  if (!r.ok) throw new Error("pg " + pathq.split("?")[0] + " → " + r.status);
  return r.json();
}
async function pageAll(pathq, max = 60) {
  const out = [];
  for (let i = 0; i < max; i++) {
    const rows = await pg(pathq + "&limit=1000&offset=" + i * 1000);
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}
const t0 = Date.now(), now = new Date(), runId = "proposals-" + now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
const since = Math.floor((now.getTime() - days * 86400000) / 1000);   // public.news.published_ts is epoch SECONDS (bigint)
const registry = JSON.parse(fs.readFileSync(path.join(root, "supabase/functions/prediction-markets/topics.json"), "utf8"));
const registryIds = registry.topics.map((t) => t.id);

const news = await pageAll("news?select=title,published_ts&published_ts=gte." + since + "&order=published_ts.desc");
const counts = countThemes(news.map((r) => r.title));
const latest = await pg("prediction_market_latest?select=topic&topic=neq.discover&limit=5000");
const liveTopics = [...new Set(latest.map((r) => r.topic))];
const searches = {}, searchNotes = {};
for (const t of themesToSearch(counts, registryIds)) {
  try {
    const r = await fetch(SEARCH_URL(t.q), { headers: { "User-Agent": "scintilla-prediction-topic-proposals/1.0" } });
    if (!r.ok) throw new Error("HTTP_" + r.status);
    const j = await r.json();
    searches[t.theme] = (j && j.events) || [];
    searchNotes[t.theme] = { q: t.q, hits: searches[t.theme].length };
  } catch (e) { searches[t.theme] = []; searchNotes[t.theme] = { q: t.q, error: String(e.message || e) }; }
}
const rows = propose({ counts, registryIds, liveTopics, searches, runId, ts: now.toISOString(), registryTopics: registry.topics, kalshiOn: !!(registry.venues && registry.venues.kalshi && registry.venues.kalshi.enabled) });
const themes = THEMES.map((t) => ({ theme: t.theme, kind: t.kind, n: counts[t.theme].n, distinct: counts[t.theme].distinct,
  tracked: t.topics.filter((id) => registryIds.includes(id)), live: t.topics.filter((id) => liveTopics.includes(id)) }));
const result = { version: VERSION, run_id: runId, ts: now.toISOString(), window_days: days, headlines: news.length, newest: news[0] && new Date(Number(news[0].published_ts) * 1000).toISOString(),
  registry_topics: registryIds.length, live_topics: liveTopics.length, themes, searches: searchNotes, proposals: rows, ms: Date.now() - t0, written: 0 };

if (doWrite) {
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE) { console.error("--write needs SUPABASE_SERVICE_ROLE_KEY in the environment (the coordinator's)"); process.exit(3); }
  const r = await fetch(SB + "/rest/v1/prediction_topic_proposals", { method: "POST",
    headers: { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(rows.map(({ distinct_7d, ...r }) => r)) });
  if (!r.ok) { console.error("write failed: HTTP " + r.status + " " + (await r.text()).slice(0, 200)); process.exit(4); }
  result.written = rows.length;
}
if (outFile) fs.writeFileSync(outFile, JSON.stringify(result, null, 1));
console.log(JSON.stringify(outFile ? { ...result, themes: undefined, proposals: rows.map((r) => r.kind + " · " + (r.topic || r.theme) + " · " + r.status) } : result, null, 1));

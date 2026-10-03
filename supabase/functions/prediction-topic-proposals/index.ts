// SCINTILLA · prediction-topic-proposals v1 (P2, 2 Oct 2026) — NOT DEPLOYED BY THIS LANE; the coordinator deploys.
//
// Alan: "we need a methodology that scans the news from our streams, makes a list and tracks it." This function is
// the server-side home of that method: the same lib.mjs the node script and the tests use. It reads our own news
// reel (public.news, last 7 days), counts headlines per theme, asks Polymarket's public search (no key) for an open
// market where a heavy theme has no topic, and writes PROPOSALS (add / remove, each with a plain "why") into
// public.prediction_topic_proposals. It never edits topics.json and never touches the collector (prediction-markets).
//
// Modes:  POST /prediction-topic-proposals?mode=dry     (default) compute and return the proposals, write nothing
//         POST /prediction-topic-proposals?mode=write   compute, insert the rows, return them
// Suggested schedule once approved: nightly, after the reel's day (not added here — no cron is changed by this lane).
import REG from "../prediction-markets/topics.json" with { type: "json" };
import { VERSION, countThemes, propose, themesToSearch, SEARCH_URL } from "./lib.mjs";

const SB = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "Content-Type": "application/json" };
const UA = { "User-Agent": "scintilla-prediction-topic-proposals/1.0" };

async function pg(pathq: string) {
  const r = await fetch(`${SB}/rest/v1/${pathq}`, { headers: H });
  if (!r.ok) throw new Error("PG_HTTP_" + r.status + " " + pathq.split("?")[0]);
  return await r.json();
}
async function pageAll(pathq: string, max = 60) {
  const out: any[] = [];
  for (let i = 0; i < max; i++) {
    const rows = await pg(pathq + "&limit=1000&offset=" + i * 1000);
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

Deno.serve(async (req) => {
  const t0 = Date.now(), now = new Date();
  const mode = new URL(req.url).searchParams.get("mode") || "dry";
  const runId = "proposals-" + now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  try {
    const since = Math.floor((now.getTime() - 7 * 86400000) / 1000);   // public.news.published_ts is epoch SECONDS (bigint)
    const registryIds = (REG as any).topics.map((t: any) => t.id as string);
    const news = await pageAll("news?select=title&published_ts=gte." + since + "&order=published_ts.desc");
    const counts = countThemes(news.map((r: any) => r.title));
    const latest = await pg("prediction_market_latest?select=topic&topic=neq.discover&limit=5000");
    const liveTopics = [...new Set((latest as any[]).map((r) => r.topic as string))];
    const searches: Record<string, any[]> = {};
    for (const t of themesToSearch(counts, registryIds)) {
      try { const r = await fetch(SEARCH_URL(t.q), { headers: UA }); searches[t.theme] = r.ok ? ((await r.json())?.events || []) : []; }
      catch (_) { searches[t.theme] = []; }
    }
    const rows = propose({ counts, registryIds, liveTopics, searches, runId, ts: now.toISOString(), registryTopics: (REG as any).topics, kalshiOn: !!(REG as any).venues?.kalshi?.enabled });
    let written = 0, write_error: string | null = null;
    if (mode === "write" && rows.length) {
      const r = await fetch(`${SB}/rest/v1/prediction_topic_proposals`, { method: "POST", headers: { ...H, Prefer: "return=minimal" },
        body: JSON.stringify(rows.map(({ distinct_7d, ...x }: any) => x)) });
      if (r.ok) written = rows.length; else write_error = "HTTP_" + r.status + " " + (await r.text()).slice(0, 200);
    }
    const body = { version: VERSION, run_id: runId, mode, headlines: news.length, live_topics: liveTopics.length, proposals: rows, written, write_error, ms: Date.now() - t0 };
    return new Response(JSON.stringify(body, null, 1), { status: write_error ? 500 : 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e).slice(0, 300), version: VERSION }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});

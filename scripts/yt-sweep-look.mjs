#!/usr/bin/env node
// SCINTILLA · yt-sweep-look — run the collector's OWN handler on this Mac, against the real network, with a table
// that can be read and cannot be written.
//
// Y5 (12 Oct): the proof the brief asks for ("a run of the handler on this Mac against the real network with a
// read-only table stub") without deploying anything. The function file is the one in this repo, loaded as the
// tests load it (types stripped, the Supabase client swapped for the stub below).
//
//   READS   come from the live project through the logged-in `supabase` CLI — `supabase db query --linked`,
//           SELECT statements only, built here from fixed text. Only these app_config rows are ever fetched:
//           the YouTube API key, the saved channel lists, the bridge rows, yt_rss_health, yt_rss_fallback,
//           yt_rss_running. The sign-in rows (OAuth client, refresh tokens) are NOT fetched, so the handler
//           reports every account as "not connected" and runs on the saved lists — as it does live, where the
//           sign-ins answer invalid_grant.
//   WRITES  go nowhere. The stub has no way to write: every upsert / update the handler makes is listed and
//           dropped. The live "busy" lock is not taken and the live rows are not touched.
//   NETWORK is real: YouTube's feeds, its pages, and its Data API with the collector's own key. The key is held
//           in memory, sent only to www.googleapis.com, and removed from anything printed. Every API call is
//           counted, so the run says what it spent.
//
//   node scripts/yt-sweep-look.mjs "?dry=fallback&channels=UC…,UC…"     the look-only door, for named channels
//   node scripts/yt-sweep-look.mjs "?dry=fallback"                       the look-only door, as a pass would pick
//   node scripts/yt-sweep-look.mjs ""                                    a whole pass, its writes listed and dropped
//   add  --health '<json>'   to run with that remembered row instead of the stored one (e.g. to play a burst)
//   add  --out <file>        to save the full JSON beside the printed summary
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { stripTypeScriptTypes } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const REF = "wadinxqplrggagkvrdag";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : null; };
const healthOverride = flag("--health"), outFile = flag("--out");
const query = args[0] || "";

/* ---------- the read side: SELECT only, through the CLI's own login ---------- */
const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "yt-sweep-look-"));
function select(statement) {
  if (!/^select\b/i.test(statement) || statement.includes(";")) throw new Error("SELECT only");
  const raw = execFileSync("supabase", ["db", "query", "--linked", "--project-ref", REF, "--workdir", workdir, "--output-format", "json", statement],
    { cwd: workdir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 512 * 1024 * 1024, timeout: 180000 });
  return JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
}
const ACCOUNTS = ["personal", "scintilla", "soundscapes", "golf", "ai_research", "fitness"];
const READABLE = ["YT_API_KEY", ...ACCOUNTS.map((a) => "yt_sub_channels_" + a), "yt_sub_channels", "yt_bridge_channels", "yt_bridge_live", "yt_rss_health", "yt_rss_fallback", "yt_rss_running"];
const config = select("select key, value from public.app_config where key in (" + READABLE.map((k) => "'" + k + "'").join(",") + ")");
if (healthOverride != null) {
  JSON.parse(healthOverride);
  const at = config.findIndex((r) => r.key === "yt_rss_health");
  if (at >= 0) config[at].value = healthOverride; else config.push({ key: "yt_rss_health", value: healthOverride });
}
const KEY = String((config.find((r) => r.key === "YT_API_KEY") || {}).value || "").trim();
const scrub = (text) => (KEY ? String(text).split(KEY).join("<YT_API_KEY>") : String(text));
/* the CLI prints a time as "2026-10-13 01:14:38+00"; the handler compares against ISO text */
const iso = (v) => (v == null ? v : String(v).replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00"));
const videos = select("select video_id, channel_id, channel_title, published_at, duration_sec, live_broadcast, live_checked_ts, subscription_accounts from public.youtube_videos")
  .map((row) => ({ ...row, published_at: iso(row.published_at) }));

/* ---------- the table stub: reads answered from what was just read, writes listed and dropped ---------- */
const log = { reads: [], dropped: [] };
const tables = { app_config: config, youtube_videos: videos };
function from(table) {
  const q = { filters: [], op: "select", payload: null, lim: null, orders: [] };
  const keyOf = table === "app_config" ? "key" : "video_id";
  const run = () => {
    if (q.op !== "select") {
      const rows = q.op === "upsert" ? [].concat(q.payload) : tables[table].filter((row) => q.filters.every((f) => f(row)));
      for (const row of rows) log.dropped.push({ table, op: q.op, key: row[keyOf], row: q.op === "upsert" ? row : q.payload });
      return { data: null, error: null };
    }
    let rows = tables[table].filter((row) => q.filters.every((f) => f(row)));
    for (const [column, opts] of [...q.orders].reverse()) {
      const up = !opts || opts.ascending !== false, nullsFirst = opts && opts.nullsFirst === true;
      rows = [...rows].sort((a, b) => {
        const x = a[column], y = b[column];
        if (x == null || y == null) return x == null && y == null ? 0 : (x == null) === nullsFirst ? -1 : 1;
        return (x < y ? -1 : x > y ? 1 : 0) * (up ? 1 : -1);
      });
    }
    if (q.lim != null) rows = rows.slice(0, q.lim);
    log.reads.push({ table, rows: rows.length });
    return { data: rows.map((row) => ({ ...row })), error: null };
  };
  const api = {
    select: () => api, limit: (n) => { q.lim = n; return api; }, order: (column, opts) => { q.orders.push([column, opts]); return api; },
    in: (k, list) => { q.filters.push((r) => list.includes(r[k])); return api; },
    eq: (k, v) => { q.filters.push((r) => r[k] === v); return api; },
    gte: (k, v) => { q.filters.push((r) => r[k] != null && Date.parse(r[k]) >= Date.parse(v)); return api; },
    or: (expr) => {
      if (expr !== "duration_sec.is.null,live_broadcast.in.(live,upcoming)") throw new Error("the stub does not know this filter: " + expr);
      q.filters.push((r) => r.duration_sec == null || ["live", "upcoming"].includes(r.live_broadcast)); return api;
    },
    upsert: (payload) => { q.op = "upsert"; q.payload = payload; return api; },
    update: (payload) => { q.op = "update"; q.payload = payload; return api; },
    then: (ok, bad) => Promise.resolve().then(run).then(ok, bad),
  };
  return api;
}

/* ---------- the network: real, counted ---------- */
const realFetch = globalThis.fetch;
const net = { feeds: 0, feeds_failed: 0, pages: 0, shorts: 0, api: { playlistItems: 0, videos: 0, other: 0 } };
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (KEY && u.includes(KEY) && !u.startsWith("https://www.googleapis.com/youtube/v3/")) throw new Error("the key would have left for somewhere that is not YouTube's API");
  const api = u.match(/googleapis\.com\/youtube\/v3\/([a-zA-Z]+)/);
  if (api) net.api[api[1] in net.api ? api[1] : "other"]++;
  else if (u.includes("/feeds/videos.xml")) net.feeds++;
  else if (u.includes("/shorts/")) net.shorts++;
  else net.pages++;
  const r = await realFetch(url, init);
  if (!api && u.includes("/feeds/videos.xml") && !r.ok) net.feeds_failed++;
  return r;
};

/* ---------- the handler, loaded as the tests load it ---------- */
globalThis.__look = { createClient: () => ({ from }) };
globalThis.Deno = { env: { get: (k) => ({ SUPABASE_URL: "http://read-only.stub", SUPABASE_SERVICE_ROLE_KEY: "stub" })[k] || "" }, serve: (h) => { globalThis.__look.handler = h; } };
const source = fs.readFileSync(path.join(ROOT, "supabase/functions/yt-rss-sweep/index.ts"), "utf8");
const js = stripTypeScriptTypes(source, { mode: "strip" })
  .replace(/import \{ createClient \} from "https:\/\/esm\.sh\/[^"]+";/, "const { createClient } = globalThis.__look;")
  .replace('"../_shared/yt-bridge.mjs"', JSON.stringify(pathToFileURL(path.join(ROOT, "supabase/functions/_shared/yt-bridge.mjs")).href));
const file = path.join(workdir, "handler.mjs");
fs.writeFileSync(file, js);
const started = Date.now();
let result;
try {
  await import(pathToFileURL(file).href);
  const response = await globalThis.__look.handler(new Request("http://read-only.stub/functions/v1/yt-rss-sweep" + query));
  result = await response.json();
} finally {
  globalThis.fetch = realFetch;
  fs.rmSync(workdir, { recursive: true, force: true });
}

/* ---------- what is said ---------- */
const units = net.api.playlistItems + net.api.videos + net.api.other;
const droppedVideos = log.dropped.filter((w) => w.table === "youtube_videos" && w.op === "upsert");
const report = {
  ran: "supabase/functions/yt-rss-sweep/index.ts from this checkout, on this Mac", asked: query || "(the schedule's call: a whole pass)", at: new Date().toISOString(), took_ms: Date.now() - started,
  table: { read_from: "project " + REF + " through the supabase CLI (SELECT only)", videos_read: videos.length, config_rows_read: config.map((r) => r.key).sort(),
    sign_in_rows_read: "none", remembered_row: healthOverride != null ? "given on the command line (--health)" : config.some((r) => r.key === "yt_rss_health") ? "the stored one" : "none stored yet (the function is not deployed)",
    writes_reaching_the_database: 0, writes_dropped: log.dropped.length },
  network: { feeds_asked: net.feeds, feed_answers_not_ok: net.feeds_failed, youtube_pages: net.pages, shorts_checks: net.shorts, api_calls: net.api, api_units_spent: units },
  result,
  would_have_written: {
    app_config_rows: [...new Set(log.dropped.filter((w) => w.table === "app_config").map((w) => w.key))],
    new_videos: droppedVideos.map((w) => ({ video_id: w.row.video_id, channel: w.row.channel_title, published_at: w.row.published_at, accounts: w.row.subscription_accounts, title: String(w.row.title || "").slice(0, 80) })),
    video_updates: log.dropped.filter((w) => w.table === "youtube_videos" && w.op === "update").length,
    remembered_row: (() => { const w = log.dropped.find((x) => x.table === "app_config" && x.key === "yt_rss_health"); if (!w) return null; const h = JSON.parse(w.row.value);
      return { characters: w.row.value.length, channels: Object.keys(h.ch).length, feed_answered: Object.values(h.ch).filter((e) => !e.f).length, day: h.day, used: h.used, quota_day: h.quota_day }; })(),
  },
};
const text = scrub(JSON.stringify(report, null, 1));
if (KEY && text.includes(KEY)) throw new Error("refusing to print: the key is in the report");
if (outFile) fs.writeFileSync(outFile, text + "\n");
console.log(text);

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
//           the YouTube API key, the saved channel lists, each account's own channel id (YT_CHANNEL_ID_…), the
//           bridge rows, yt_rss_health, yt_rss_fallback, yt_rss_result, yt_rss_running. The sign-in rows (OAuth
//           client, refresh tokens) are NOT fetched, so the handler reports every account as "not connected" and
//           takes the same road it takes live, where the sign-ins answer invalid_grant.
//   WRITES  never reach the database: the stub has no way to send one. By default every upsert / update the
//           handler makes is listed and dropped. With --memory they are applied to the copy held in this
//           process — so a pass can be seen to take a tag off, or two runs can follow one another — and listed.
//   NETWORK is real: YouTube's feeds, its pages, and its Data API with the collector's own key. The key is held
//           in memory, sent only to www.googleapis.com, and removed from anything printed. Every API call is
//           counted, so the run says what it spent. (--feeds-down answers every feed read with a 404 here,
//           without asking YouTube: "what if every feed read fails" on demand.)
//
//   node scripts/yt-sweep-look.mjs "?dry=fallback&channels=UC…,UC…"     the look-only door, for named channels
//   node scripts/yt-sweep-look.mjs "?dry=fallback"                       the look-only door, as a pass would pick
//   node scripts/yt-sweep-look.mjs "?dry=lists"                          each account's list the public way (Y6)
//   node scripts/yt-sweep-look.mjs ""                                    a whole pass
//   add  --health '<json>'     run with that remembered row instead of the stored one (e.g. to play a burst)
//   add  --settings '<json>'   run with that yt_rss_fallback row instead of the stored one
//   add  --carry <file>        the remembered row and the result row are taken from this file when it exists, and
//                              what the pass would have written to them is saved back — pass after pass, no table
//   add  --memory              writes are applied to the in-memory copy (never the database)
//   add  --feeds-down          every feed read fails
//   add  --forget <ids>        video ids (comma-separated) left out of the in-memory copy, as if not stored yet
//   add  --pretend <file>      a JSON file { "follow": { "<account>": ["UC…"] }, "videos": [ {row}, … ],
//                              "counts": { "UC…": n } } — channels added to a saved list, rows added to the copy of
//                              the table, and counts put into the remembered row, all in memory: a made-up case
//                              played against YouTube's real answers
//   add  --out <file>          save the full JSON beside the printed summary
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
const on = (name) => { const i = args.indexOf(name); if (i >= 0) args.splice(i, 1); return i >= 0; };
const healthOverride = flag("--health"), settingsOverride = flag("--settings"), carryFile = flag("--carry"), outFile = flag("--out");
const forget = (flag("--forget") || "").split(",").filter(Boolean), pretendFile = flag("--pretend");
const inMemory = on("--memory"), feedsDown = on("--feeds-down");
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
const READABLE = ["YT_API_KEY", ...ACCOUNTS.map((a) => "yt_sub_channels_" + a), "yt_sub_channels", ...ACCOUNTS.map((a) => "YT_CHANNEL_ID_" + a.toUpperCase()),
  "yt_bridge_channels", "yt_bridge_live", "yt_rss_health", "yt_rss_fallback", "yt_rss_result", "yt_rss_running"];
const config = select("select key, value from public.app_config where key in (" + READABLE.map((k) => "'" + k + "'").join(",") + ")");
const setRow = (key, value) => { const at = config.findIndex((r) => r.key === key); if (at >= 0) config[at].value = value; else config.push({ key, value }); };
const getRow = (key) => (config.find((r) => r.key === key) || {}).value;
const given = { health: "the stored one", settings: getRow("yt_rss_fallback") ? "the stored one" : "none stored (the built-in numbers)" };
if (!getRow("yt_rss_health")) given.health = "none stored yet";
if (healthOverride != null) { JSON.parse(healthOverride); setRow("yt_rss_health", healthOverride); given.health = "given on the command line (--health)"; }
if (settingsOverride != null) { JSON.parse(settingsOverride); setRow("yt_rss_fallback", settingsOverride); given.settings = "given on the command line (--settings)"; }
if (carryFile && fs.existsSync(carryFile)) {
  const carried = JSON.parse(fs.readFileSync(carryFile, "utf8"));
  for (const key of ["yt_rss_health", "yt_rss_result"]) if (carried[key] != null) setRow(key, carried[key]);
  for (const [key, value] of Object.entries(carried.lists || {})) setRow(key, value);
  given.health = "carried from the run before (--carry)";
}
/* the live "busy" lock is another process's business: this run neither takes it nor waits for it */
setRow("yt_rss_running", JSON.stringify({ ts: 0 }));
const KEY = String(getRow("YT_API_KEY") || "").trim();
const OWN_IDS = ACCOUNTS.map((a) => String(getRow("YT_CHANNEL_ID_" + a.toUpperCase()) || "").trim()).filter(Boolean);
/* nothing printed carries the key; an account's own channel id is printed as the account's name */
const scrub = (text) => { let out = KEY ? String(text).split(KEY).join("<YT_API_KEY>") : String(text);
  for (const a of ACCOUNTS) { const id = String(getRow("YT_CHANNEL_ID_" + a.toUpperCase()) || "").trim(); if (id) out = out.split(id).join("<YT_CHANNEL_ID_" + a.toUpperCase() + ">"); } return out; };
/* the CLI prints a time as "2026-10-13 01:14:38+00"; the handler compares against ISO text */
const iso = (v) => (v == null ? v : String(v).replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00"));
let videos = select("select video_id, channel_id, channel_title, published_at, duration_sec, live_broadcast, live_started_at, live_scheduled_at, live_checked_ts, subscription_accounts from public.youtube_videos")
  .map((row) => ({ ...row, published_at: iso(row.published_at), live_started_at: iso(row.live_started_at), live_scheduled_at: iso(row.live_scheduled_at) }));
const tableHeld = videos.length;
const played = { forgotten: [], followed: {}, videos_added: 0, counts_set: 0 };
if (forget.length) { played.forgotten = videos.filter((row) => forget.includes(row.video_id)).map((row) => row.video_id); videos = videos.filter((row) => !forget.includes(row.video_id)); }
if (pretendFile) {
  const pretend = JSON.parse(fs.readFileSync(pretendFile, "utf8"));
  for (const [account, ids] of Object.entries(pretend.follow || {})) {
    const key = "yt_sub_channels_" + account, saved = JSON.parse(getRow(key) || "{}");
    setRow(key, JSON.stringify({ ...saved, ids: [...new Set([...(saved.ids || []), ...ids])] }));
    played.followed[account] = ids;
  }
  for (const row of pretend.videos || []) { videos.push({ ...row }); played.videos_added++; }
  if (pretend.counts) {
    const health = JSON.parse(getRow("yt_rss_health") || "{}"); health.ch = health.ch || {};
    for (const [id, count] of Object.entries(pretend.counts)) { health.ch[id] = { ...(health.ch[id] || {}), c: count }; played.counts_set++; }
    setRow("yt_rss_health", JSON.stringify(health));
  }
}

/* ---------- the table stub: reads answered from what was just read; writes listed, and dropped or kept in memory ---------- */
const log = { reads: [], writes: [] };
const tables = { app_config: config, youtube_videos: videos };
function from(table) {
  const q = { filters: [], op: "select", payload: null, lim: null, orders: [], count: false };
  const keyOf = table === "app_config" ? "key" : "video_id";
  const run = () => {
    if (q.op !== "select") {
      const rows = q.op === "upsert" ? [].concat(q.payload) : tables[table].filter((row) => q.filters.every((f) => f(row)));
      for (const row of rows) {
        log.writes.push({ table, op: q.op, key: row[keyOf], row: q.op === "upsert" ? row : q.payload, ...(q.op === "update" && table === "youtube_videos" ? { was: { subscription_accounts: row.subscription_accounts } } : {}) });
        if (!inMemory) continue;
        if (q.op === "update") Object.assign(row, q.payload);
        else { const at = tables[table].findIndex((r) => r[keyOf] === row[keyOf]); if (at >= 0) tables[table][at] = { ...tables[table][at], ...row }; else tables[table].push({ ...row }); }
      }
      return { data: null, error: null };
    }
    let rows = tables[table].filter((row) => q.filters.every((f) => f(row)));
    if (q.count) { log.reads.push({ table, counted: rows.length }); return { data: null, count: rows.length, error: null }; }
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
    select: (_columns, opts) => { if (opts && opts.head) q.count = true; return api; }, limit: (n) => { q.lim = n; return api; }, order: (column, opts) => { q.orders.push([column, opts]); return api; },
    in: (k, list) => { q.filters.push((r) => list.includes(r[k])); return api; },
    eq: (k, v) => { q.filters.push((r) => r[k] === v); return api; },
    contains: (k, list) => { q.filters.push((r) => Array.isArray(r[k]) && list.every((v) => r[k].includes(v))); return api; },
    gte: (k, v) => { q.filters.push((r) => r[k] != null && Date.parse(r[k]) >= Date.parse(v)); return api; },
    or: (expr) => {
      if (expr !== "duration_sec.is.null,live_broadcast.in.(live,upcoming)") throw new Error("the stub does not know this filter: " + expr);
      q.filters.push((r) => r.duration_sec == null || ["live", "upcoming"].includes(r.live_broadcast)); return api;
    },
    upsert: (payload) => { q.op = "upsert"; q.payload = payload; return api; },
    update: (payload) => { q.op = "update"; q.payload = payload; return api; },
    delete: () => { throw new Error("the handler asked to delete: it never may"); },
    then: (ok, bad) => Promise.resolve().then(run).then(ok, bad),
  };
  return api;
}

/* ---------- the network: real, counted ---------- */
const realFetch = globalThis.fetch;
const net = { feeds: 0, feeds_failed: 0, pages: 0, shorts: 0, sign_in: 0, api: { subscriptions: 0, channels: 0, playlistItems: 0, videos: 0, other: 0 } };
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (KEY && u.includes(KEY) && !u.startsWith("https://www.googleapis.com/youtube/v3/")) throw new Error("the key would have left for somewhere that is not YouTube's API");
  const api = u.match(/googleapis\.com\/youtube\/v3\/([a-zA-Z]+)/);
  if (api) net.api[api[1] in net.api ? api[1] : "other"]++;
  else if (u.includes("/feeds/videos.xml")) {
    net.feeds++;
    if (feedsDown) { net.feeds_failed++; return new Response("Not Found", { status: 404 }); }
  } else if (u.includes("/shorts/")) net.shorts++;
  else if (u.includes("oauth2.googleapis.com")) net.sign_in++;
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
const units = Object.values(net.api).reduce((a, b) => a + b, 0);
const last = (key) => { const w = [...log.writes].reverse().find((x) => x.table === "app_config" && x.key === key); return w ? w.row.value : null; };
if (carryFile && !query) {
  const lists = Object.fromEntries(ACCOUNTS.map((a) => ["yt_sub_channels_" + a, last("yt_sub_channels_" + a)]).filter(([, v]) => v != null));
  const before = fs.existsSync(carryFile) ? JSON.parse(fs.readFileSync(carryFile, "utf8")) : {};
  fs.writeFileSync(carryFile, JSON.stringify({ yt_rss_health: last("yt_rss_health") ?? before.yt_rss_health ?? null, yt_rss_result: last("yt_rss_result") ?? before.yt_rss_result ?? null,
    lists: { ...(before.lists || {}), ...lists } }) + "\n");
}
const newVideos = log.writes.filter((w) => w.table === "youtube_videos" && w.op === "upsert");
const tagWrites = log.writes.filter((w) => w.table === "youtube_videos" && w.op === "update" && w.row && "subscription_accounts" in w.row);
const report = {
  ran: "supabase/functions/yt-rss-sweep/index.ts from this checkout, on this Mac", asked: query || "(the schedule's call: a whole pass)", at: new Date().toISOString(), took_ms: Date.now() - started,
  table: { read_from: "project " + REF + " through the supabase CLI (SELECT only)", videos_read: tableHeld, config_rows_read: config.map((r) => r.key).sort().map((k) => (k.startsWith("YT_CHANNEL_ID_") ? k : k)),
    sign_in_rows_read: "none", remembered_row: given.health, settings_row: given.settings,
    writes_reaching_the_database: 0, writes: inMemory ? "applied to the copy in this process only (--memory)" : "listed and dropped", writes_made: log.writes.length },
  played: { feeds: feedsDown ? "every feed read answered 404 here (--feeds-down); YouTube was not asked" : "real", ...(played.forgotten.length ? { left_out_of_the_table_copy: played.forgotten } : {}),
    ...(Object.keys(played.followed).length ? { added_to_a_saved_list_in_memory: played.followed } : {}), ...(played.videos_added ? { rows_added_to_the_table_copy: played.videos_added } : {}),
    ...(played.counts_set ? { counts_put_in_the_remembered_row: played.counts_set } : {}) },
  network: { feeds_asked: net.feeds, feed_answers_not_ok: net.feeds_failed, youtube_pages: net.pages, shorts_checks: net.shorts, sign_in_calls: net.sign_in, api_calls: net.api, api_units_spent: units },
  result,
  would_have_written: {
    app_config_rows: [...new Set(log.writes.filter((w) => w.table === "app_config").map((w) => w.key))],
    new_videos: newVideos.map((w) => ({ video_id: w.row.video_id, channel: w.row.channel_title, published_at: w.row.published_at, accounts: w.row.subscription_accounts, title: String(w.row.title || "").slice(0, 80),
      minutes_after_it_was_posted: w.row.published_at ? Math.round((Date.now() - Date.parse(w.row.published_at)) / 6000) / 10 : null })),
    tags_changed: tagWrites.map((w) => ({ video_id: w.key, from: w.was ? w.was.subscription_accounts : null, to: w.row.subscription_accounts })),
    other_video_updates: log.writes.filter((w) => w.table === "youtube_videos" && w.op === "update" && !(w.row && "subscription_accounts" in w.row)).length,
    rows_deleted: 0,
    remembered_row: (() => { const value = last("yt_rss_health"); if (!value) return null; const h = JSON.parse(value);
      return { characters: value.length, channels: Object.keys(h.ch).length, feed_answered: Object.values(h.ch).filter((e) => !e.f).length, with_a_count: Object.values(h.ch).filter((e) => e.c != null).length,
        count_vouched_for: Object.values(h.ch).filter((e) => e.cr).length, day: h.day, used: h.used, quota_day: h.quota_day, lists: h.ls || null, gone: h.gone || null }; })(),
  },
};
const text = scrub(JSON.stringify(report, null, 1));
if (KEY && text.includes(KEY)) throw new Error("refusing to print: the key is in the report");
if (OWN_IDS.some((id) => text.includes(id))) throw new Error("refusing to print: an account's own channel id is in the report");
if (outFile) fs.writeFileSync(outFile, text + "\n");
console.log(text);

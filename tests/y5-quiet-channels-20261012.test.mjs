/* Y5 (12 Oct) — channels that went quiet.
   Alan, about a channel on the SCINTILLA list: "The videos are not coming through to the Scintilla channel. He posted a
   video 18 minutes ago. I don't have it there … I'd like to get this guy's videos onto the feed."

   What was measured before anything was built (13 Oct ~02:00Z):
     · that channel's feed WAS answering — 36 passes in a row (three hours) with all 194 feeds answering — and
       its video was thrown away each time: YouTube's API tags every one of its videos "zxx" (no spoken language), and the
       collector dropped any new video whose tag did not start with "en".
     · the feed itself fails in bursts (99–190 of 194 for 95 minutes), which delays videos.
   These tests hold the collector to both fixes. No network: the feeds, the API answers and the table are fixtures
   written here, in the shapes YouTube served on 13 Oct; the sweep function itself is run against them.
   THE CHANNELS AND VIDEOS HERE ARE MADE UP (ids, names, titles). This repository is public and which channels Alan
   follows is not its business; the shapes and the language tags are the measured ones. */
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { keepSubscribed, otherLanguage } from "../supabase/functions/_shared/yt-feed-fallback.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const RSS = read("supabase/functions/yt-rss-sweep/index.ts");
const FEED = read("supabase/functions/youtube-feed/index.ts");
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/mg, "");

const DESK = "UCdeskFixture00000000001";
const LEDGER = "UCledgerFixture000000002";
const TAPE = "UCtapeFixture00000000003";
const TALK = "UCtalkFixture00000000004";
const RAIN = "UCrainFixture00000000005";
const KEY = "test-key-NEVER-SHOWN";

/* ---------- fixtures in the shapes YouTube serves ---------- */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
/** the public channel feed (youtube.com/feeds/videos.xml) */
const feedXml = (name, entries) => '<?xml version="1.0" encoding="UTF-8"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom"><title>' + esc(name) +
  "</title><author><name>" + esc(name) + "</name></author>" + entries.map((e) => "<entry><id>yt:video:" + e.id + "</id><yt:videoId>" + e.id + "</yt:videoId><title>" + esc(e.title) +
  "</title><published>" + e.published + '</published><media:group><media:thumbnail url="https://i1.ytimg.com/vi/' + e.id + '/hqdefault.jpg" width="480" height="360"/><media:description>' + esc(e.description || "") +
  "</media:description></media:group></entry>").join("") + "</feed>";
/** videos.list item: the part the collector reads (length, live state, the language tags) */
const apiVideo = (audio, standard, duration = "PT23M27S") => ({ snippet: { liveBroadcastContent: "none", ...(audio ? { defaultAudioLanguage: audio } : {}), ...(standard ? { defaultLanguage: standard } : {}) }, contentDetails: { duration } });
/* the named channel in the shape YouTube served it on 13 Oct: the two videos the collector never stored, and one it held */
const DESK_NEW = [
  { id: "fxNewVideo1", title: "The newest video, posted an hour before this pass", published: "2026-10-13T01:14:38+00:00" },
  { id: "fxNewVideo2", title: "The video of two days ago that was never stored", published: "2026-10-11T04:00:03+00:00" },
];
const DESK_HELD = { id: "fxHeldVideo", title: "A video the table already holds", published: "2026-10-09T06:16:38+00:00" };

/* ---------- the sweep itself, run against an in-memory table ---------- */
function db(config, videos) {
  const log = { writes: [], reads: [], fetched: [] };
  const tables = { app_config: config, youtube_videos: videos };
  function query(table) {
    const q = { filters: [], op: "select", payload: null, lim: null };
    const rowsOf = () => tables[table].filter((row) => q.filters.every((f) => f(row)));
    const run = () => {
      const key = table === "app_config" ? "key" : "video_id";
      if (q.op === "upsert") {
        for (const row of [].concat(q.payload)) {
          const i = tables[table].findIndex((r) => r[key] === row[key]);
          if (i >= 0) tables[table][i] = { ...tables[table][i], ...row }; else tables[table].push({ ...row });
          log.writes.push({ table, key: row[key] });
        }
        return { data: null, error: null };
      }
      if (q.op === "update") { for (const row of rowsOf()) { Object.assign(row, q.payload); log.writes.push({ table, key: row[key] }); } return { data: null, error: null }; }
      let rows = rowsOf(); if (q.lim != null) rows = rows.slice(0, q.lim);
      log.reads.push({ table, keys: rows.map((r) => r[key]) });
      return { data: rows.map((r) => ({ ...r })), error: null };
    };
    const api = {
      select: () => api, order: () => api, limit: (n) => { q.lim = n; return api; },
      in: (k, list) => { q.filters.push((r) => list.includes(r[k])); return api; },
      eq: (k, v) => { q.filters.push((r) => r[k] === v); return api; },
      gte: (k, v) => { q.filters.push((r) => String(r[k] || "") >= v); return api; },
      or: () => { q.filters.push((r) => r.duration_sec == null || ["live", "upcoming"].includes(r.live_broadcast)); return api; },
      upsert: (payload) => { q.op = "upsert"; q.payload = payload; return api; },
      update: (payload) => { q.op = "update"; q.payload = payload; return api; },
      then: (ok, bad) => Promise.resolve().then(run).then(ok, bad),
    };
    return api;
  }
  return { log, tables, client: { from: query } };
}
let harnessCount = 0;
/** one pass. feeds / uploads: channel id → body, or [status, body], or an Error to throw (default: an empty feed /
    "no such list"). api: video id → videos.list item. store: an earlier pass's table, to run the next pass on it. */
async function runSweep({ config, videos = [], feeds = {}, api = {}, uploads = {}, query = "", nowMs = Date.UTC(2026, 9, 13, 2, 0, 0), store = null }) {
  store = store || db(config, videos);
  store.log.fetched.length = 0; store.log.writes.length = 0; store.log.reads.length = 0;
  const realFetch = globalThis.fetch, realTimeout = globalThis.setTimeout;
  const answer = (status, body, u) => ({ ok: status >= 200 && status < 300, status, url: u, text: async () => (typeof body === "string" ? body : JSON.stringify(body)), json: async () => (typeof body === "string" ? JSON.parse(body) : body) });
  const from = (hit, fallback, u) => { if (hit === undefined) hit = fallback; if (hit instanceof Error) throw hit; return Array.isArray(hit) ? answer(hit[0], hit[1], u) : answer(200, hit, u); };
  globalThis.fetch = async (url) => {
    const u = String(url);
    assert.ok(!u.includes(KEY) || u.startsWith("https://www.googleapis.com/youtube/v3/"), "the key goes to YouTube's API and nowhere else");
    store.log.fetched.push(u.replace(/key=[^&]+/, "key=…"));
    if (u.includes("/feeds/videos.xml")) { const id = u.split("channel_id=")[1]; return from(feeds[id], feedXml("x", []), u); }
    if (u.includes("googleapis.com/youtube/v3/videos")) {
      const ids = decodeURIComponent(u.match(/[?&]id=([^&]+)/)[1]).split(",");
      return answer(200, { items: ids.filter((id) => api[id]).map((id) => ({ id, ...api[id] })) }, u);
    }
    if (u.includes("googleapis.com/youtube/v3/playlistItems")) {
      const id = "UC" + u.match(/[?&]playlistId=UU([^&]+)/)[1];
      return from(uploads[id], [404, { error: { code: 404, errors: [{ reason: "playlistNotFound" }] } }], u);
    }
    if (u.includes("/shorts/")) return answer(303, "", u);
    throw new Error("unexpected request " + u);
  };
  globalThis.setTimeout = (fn, _ms, ...rest) => realTimeout(fn, 0, ...rest);   // the feed's 700 ms retry pause, not waited for in a test
  mock.timers.enable({ apis: ["Date"], now: nowMs });
  globalThis.__y5 = { createClient: () => store.client };
  globalThis.Deno = { env: { get: (k) => ({ SUPABASE_URL: "http://db.test", SUPABASE_SERVICE_ROLE_KEY: "test" })[k] || "" }, serve: (h) => { globalThis.__y5.handler = h; } };
  const js = stripTypeScriptTypes(RSS, { mode: "strip" })
    .replace(/import \{ createClient \} from "https:\/\/esm\.sh\/[^"]+";/, "const { createClient } = globalThis.__y5;")
    .replace('"../_shared/yt-bridge.mjs"', JSON.stringify(pathToFileURL(path.join(ROOT, "supabase/functions/_shared/yt-bridge.mjs")).href));
  const file = path.join(os.tmpdir(), "y5-sweep-" + process.pid + "-" + (harnessCount++) + ".mjs");
  fs.writeFileSync(file, js);
  try {
    await import(pathToFileURL(file).href);
    const response = await globalThis.__y5.handler(new Request("http://edge.test/functions/v1/yt-rss-sweep" + query));
    return { result: await response.json(), store, ...store };
  } finally { mock.timers.reset(); globalThis.fetch = realFetch; globalThis.setTimeout = realTimeout; fs.unlinkSync(file); delete globalThis.Deno; }
}
const sec = (ms) => Math.floor(ms / 1000);
const cfg = (lists, extra = {}, listedAtMs = Date.UTC(2026, 9, 13, 1, 59, 0)) => Object.entries({
  YT_API_KEY: KEY,
  ...Object.fromEntries(Object.entries(lists).map(([account, ids]) => ["yt_sub_channels_" + account, JSON.stringify({ ids, ts: sec(listedAtMs) })])),
  ...extra,
}).map(([key, value]) => ({ key, value: typeof value === "string" ? value : JSON.stringify(value) }));
const held = (v, channel, name) => ({ video_id: v.id, channel_id: channel, channel_title: name, title: v.title, published_at: v.published, source: "subscription", duration_sec: 1343, live_broadcast: "none", subscription_accounts: ["scintilla"], updated_ts: 1791639302 });
const row = (tables, id) => tables.youtube_videos.find((r) => r.video_id === id);
const stored = (tables, key) => JSON.parse(tables.app_config.find((r) => r.key === key).value);

/* =====================================================================================================
   1 · THE REAL CAUSE: a followed channel's video was thrown away for its language tag
   ===================================================================================================== */
test("the channel Alan named, as measured on 13 Oct: its feed answers, YouTube tags its videos 'zxx' — and both new videos are now stored", async () => {
  const { result, tables, log } = await runSweep({
    config: cfg({ scintilla: [DESK] }),
    videos: [held(DESK_HELD, DESK, "Chart Desk Daily")],
    feeds: { [DESK]: feedXml("Chart Desk Daily", [...DESK_NEW, DESK_HELD]) },
    api: { fxNewVideo1: apiVideo("zxx", "en", "PT23M27S"), "fxNewVideo2": apiVideo("zxx", "en", "PT21M22S") },
  });
  assert.deepEqual([result.rss_failed, result.rss_seen, result.new_videos, result.dropped], [0, 3, 2, 0], "the feed answered, three entries, the two new ones stored, none thrown away");
  assert.equal(result.kept_other_language, 2, "the result row says how many the old rule would have dropped");
  const newest = row(tables, "fxNewVideo1");
  assert.deepEqual([newest.channel_id, newest.channel_title, newest.title, newest.source, newest.subscription_accounts, newest.duration_sec, newest.live_broadcast, newest.is_short],
    [DESK, "Chart Desk Daily", DESK_NEW[0].title, "subscription", ["scintilla"], 1407, "none", false]);
  assert.equal(row(tables, "fxNewVideo2").published_at, "2026-10-11T04:00:03+00:00");
  assert.equal(tables.youtube_videos.length, 3, "the video already held is still one row");
  assert.equal(row(tables, "fxHeldVideo").updated_ts, 1791639302, "and it was not rewritten");
  assert.doesNotMatch(JSON.stringify(result) + JSON.stringify(log.fetched), new RegExp(KEY), "the key is in no output");
});

test("everything a followed channel posts is kept: any tag (es, ja, zxx), any script in the title — and plain English is not counted as other", async () => {
  const entries = [
    { id: "fxRainNight", title: "Soft rain for a restful night", published: "2026-10-11T16:38:34+00:00" },   // audio ja
    { id: "fxLluviaEs1", title: "Lluvia suave ✨ música para dormir", published: "2026-10-12T11:00:00+00:00" },                  // audio es
    { id: "aaaaaaaaaaa", title: "眠りのための音楽", published: "2026-10-12T12:00:00+00:00" },                                               // a Japanese title, no tag
    { id: "bbbbbbbbbbb", title: "Plain English upload", published: "2026-10-12T13:00:00+00:00" },                                           // en-US
    { id: "ccccccccccc", title: "No tag at all", published: "2026-10-12T14:00:00+00:00" },
  ];
  const { result, tables } = await runSweep({
    config: cfg({ soundscapes: [RAIN], personal: [RAIN] }),
    feeds: { [RAIN]: feedXml("Quiet Rain Room", entries) },
    api: { fxRainNight: apiVideo("ja", "en"), fxLluviaEs1: apiVideo("es", "es"), aaaaaaaaaaa: apiVideo(null, null), bbbbbbbbbbb: apiVideo("en-US", "en-US"), ccccccccccc: apiVideo(null, null) },
  });
  assert.deepEqual([result.new_videos, result.dropped, result.kept_other_language, result.kept_other_script], [5, 0, 2, 1]);
  assert.deepEqual(tables.youtube_videos.map((r) => r.video_id).sort(), entries.map((e) => e.id).sort());
  assert.deepEqual(row(tables, "fxRainNight").subscription_accounts, ["personal", "soundscapes"], "filed under every account that follows the channel, as before");
});

test("a kept video is known on the next pass: the same videos are no longer re-asked about every five minutes", async () => {
  const feeds = { [DESK]: feedXml("Chart Desk Daily", DESK_NEW) };
  const api = { fxNewVideo1: apiVideo("zxx", "en"), "fxNewVideo2": apiVideo("zxx", "en") };
  const first = await runSweep({ config: cfg({ scintilla: [DESK] }), feeds, api });
  assert.equal(first.log.fetched.filter((u) => u.includes("/youtube/v3/videos")).length, 1, "one videos call for the two new ones");
  const second = await runSweep({ store: first.store, feeds, api, nowMs: Date.UTC(2026, 9, 13, 2, 5, 0) });
  assert.deepEqual([second.result.new_videos, second.result.rss_seen], [0, 2]);
  assert.equal(second.log.fetched.filter((u) => u.includes("/youtube/v3/videos")).length, 0, "nothing new, nothing asked — the dropped ones used to cost a call on every pass");
});

test("the rule and its neighbours: the sweep keeps, the ticker search still filters strangers' videos, and no key is in any source", () => {
  assert.equal(keepSubscribed({ title: "日本語" }, "ja"), true);
  assert.equal(keepSubscribed({ title: "The video of two days ago that was never stored" }, "zxx"), true);
  assert.deepEqual(["zxx", "ZXX", "es", "ja", "en", "en-US", "EN-gb", "", null, undefined].map(otherLanguage), [true, true, true, true, false, false, false, false, false, false]);
  const sweep = code(RSS);
  assert.match(sweep, /if \(lang && lang\.slice\(0, 2\) !== "en" && !keepSubscribed\(row, lang\)\) \{ dropped\+\+; return false; \}/, "the language tag no longer drops a followed channel's video");
  assert.match(sweep, /if \(!keepSubscribed\(candidate\) && FOREIGN\.test\(String\(candidate\.title \|\| ""\)\)\) return false;/, "nor does the script of its title");
  assert.doesNotMatch(sweep, /if \(lang && lang\.slice\(0, 2\) !== "en"\) \{ dropped\+\+/, "the old line is gone");
  const search = code(FEED);
  assert.match(search, /FOREIGN\.test\(r\.title\|\|''\)/, "youtube-feed (RADAR search) is untouched: strangers' foreign-script titles are still dropped");
  assert.match(search, /L\.slice\(0,2\)!=='en'/, "and so are strangers' other-language videos");
  assert.doesNotMatch(RSS + read("supabase/functions/_shared/yt-feed-fallback.mjs") + read("supabase/functions/_shared/yt-bridge.mjs"), /AIza[0-9A-Za-z_-]{20,}/, "no key in any source");
});

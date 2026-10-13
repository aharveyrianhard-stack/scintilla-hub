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
import { keepSubscribed, otherLanguage, HEALTH_KEY, SETTINGS_KEY, FALLBACK_DEFAULTS, FALLBACK_LIMITS, SEARCH_MAX_UNITS, SWEEP_WORST_UNITS, WORST_DAY_ROOM,
  SWEEP_EVERY_MIN, UPLOADS_TIMEOUT_MS, UNREAD_NAMED_MAX, fallbackSettings, parseHealth, fallbackPlan, capWords, lastRead, retryAfterMin, uploadsPlaylistId, uploadsPath,
  uploadsToCandidates, readUploads, readUploadsPass, feedAnswers, isFeed, nextHealth, unreadOverADay, savedChannelLists, carriers } from "../supabase/functions/_shared/yt-feed-fallback.mjs";
import { DAILY_QUOTA, pacificClock } from "../supabase/functions/_shared/yt-search-plan.mjs";

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
async function runSweep({ config, videos = [], feeds = {}, api = {}, uploads = {}, query = "", nowMs = Date.UTC(2026, 9, 13, 2, 0, 0), store = null, videosDown = null }) {
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
      if (videosDown) return answer(videosDown[0], videosDown[1], u);
      const ids = decodeURIComponent(u.match(/[?&]id=([^&]+)/)[1]).split(",");
      return answer(200, { items: ids.filter((id) => api[id]).map((id) => ({ id, ...api[id] })) }, u);
    }
    if (u.includes("googleapis.com/youtube/v3/playlistItems")) {
      const id = "UC" + u.match(/[?&]playlistId=UU([^&]+)/)[1];
      return from(uploads[id], [404, { error: { code: 404, errors: [{ reason: "playlistNotFound" }] } }], u);
    }
    if (u.includes("/shorts/")) return answer(303, "", u);
    /* an on-air check, should a pass make one: every channel is plainly off (its own page comes back) */
    const page = u.match(/^https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})\/(?:live|streams)$/);
    if (page) return answer(200, '<html><head><link rel="canonical" href="https://www.youtube.com/channel/' + page[1] + '"></head><body>"externalId":"' + page[1] + '"</body></html>', u);
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
/* Y6 (13 Oct) added a cheap count before the read (tests/y6-lists-without-sign-in-20261012.test.mjs). These tests
   hold what Y5 built — the blind read and its budget — so every config here carries {"notice":0} in the settings
   row: with the notice off the second way is Y5's, to the unit. A settings row a test gives is merged over it. */
const NOTICE_OFF = { notice: 0 };
const cfg = (lists, extra = {}, listedAtMs = Date.UTC(2026, 9, 13, 1, 59, 0)) => Object.entries({
  YT_API_KEY: KEY,
  ...Object.fromEntries(Object.entries(lists).map(([account, ids]) => ["yt_sub_channels_" + account, JSON.stringify({ ids, ts: sec(listedAtMs) })])),
  ...extra,
  [SETTINGS_KEY]: typeof extra[SETTINGS_KEY] === "string" ? extra[SETTINGS_KEY] : { ...NOTICE_OFF, ...(extra[SETTINGS_KEY] || {}) },
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

test("a videos call YouTube does not answer is no longer silent: the rows are stored as before, and the result row counts the call", async () => {
  /* 10 Oct 13:35Z: 93 new rows were stored with no length, no live state and no tag, and nothing said why. (It is
     also the only reason the named channel's videos were ever stored: with no tag there was nothing to drop.) */
  const down = await runSweep({ config: cfg({ scintilla: [DESK] }), feeds: { [DESK]: feedXml("Chart Desk Daily", DESK_NEW) },
    videosDown: [403, { error: { code: 403, errors: [{ reason: "quotaExceeded" }] } }] });
  assert.deepEqual([down.result.new_videos, down.result.videos_calls_not_ok, down.result.write_error], [2, 2, null],
    "two calls went unanswered: the one for the new videos, and the refresh that at once re-asks about rows with no length");
  const stored2 = row(down.tables, "fxNewVideo1");
  assert.deepEqual([stored2.duration_sec, stored2.live_broadcast, stored2.live_started_at], [null, null, null], "what such a row has always looked like");
  const fine = await runSweep({ config: cfg({ scintilla: [DESK] }), feeds: { [DESK]: feedXml("Chart Desk Daily", DESK_NEW) }, api: { fxNewVideo1: apiVideo("zxx", "en"), "fxNewVideo2": apiVideo("zxx", "en") } });
  assert.equal(fine.result.videos_calls_not_ok, 0);
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

/* =====================================================================================================
   2 · THE SECOND WAY IN: a channel's uploads list, when the public feed gives no answer
   ===================================================================================================== */
const T0 = Date.UTC(2026, 9, 13, 2, 0, 0);                    // 13 Oct 02:00Z = 12 Oct 19:00 Pacific: 1,140 minutes into the quota day
const NOW = sec(T0);
const minAgo = (m, from = NOW) => from - m * 60;
const many = (n, from = 0) => Array.from({ length: n }, (_, i) => "UC" + String(from + i).padStart(22, "0"));
const DEFAULTS = fallbackSettings(null);
const healthRow = (ch = {}, extra = {}) => ({ v: 1, at: minAgo(5), day: "2026-10-12", used: 0, quota_day: "", ch, ...extra });
/** playlistItems.list for a channel's uploads, as the API answers */
const uploadsBody = (channelId, name, items) => ({ kind: "youtube#playlistItemListResponse", items: items.map((v, i) => ({ kind: "youtube#playlistItem",
  snippet: { publishedAt: v.added || v.published, channelId, title: v.title, description: v.description || "", thumbnails: { default: { url: "https://i.ytimg.com/vi/" + v.id + "/default.jpg" }, high: { url: "https://i.ytimg.com/vi/" + v.id + "/hqdefault.jpg" } },
    channelTitle: name, playlistId: "UU" + channelId.slice(2), position: i, resourceId: { kind: "youtube#video", videoId: v.id }, videoOwnerChannelTitle: name, videoOwnerChannelId: channelId },
  contentDetails: { videoId: v.id, videoPublishedAt: v.published } })) });
const apiError = (status, reason) => [status, { error: { code: status, message: "…", errors: [{ message: "…", domain: "youtube.quota", reason }] } }];
const NOT_FOUND = [404, "<html>Not Found</html>"];
const DESK_UPLOADS = uploadsBody(DESK, "Chart Desk Daily", [
  { ...DESK_NEW[0], published: "2026-10-13T01:14:38Z" }, { ...DESK_NEW[1], published: "2026-10-11T04:00:03Z" }, { ...DESK_HELD, published: "2026-10-09T06:16:38Z" }]);
const ZXX = { fxNewVideo1: apiVideo("zxx", "en"), "fxNewVideo2": apiVideo("zxx", "en") };

/* ---------- the numbers ---------- */
test("the two caps start at 6 a pass and 580 a day, live in app_config (yt_rss_fallback), and a slip in the row cannot spend the day", () => {
  assert.deepEqual(DEFAULTS, { per_pass: 6, per_day: 580, after_min: 60, max_results: 15, from: "default" });
  assert.deepEqual(fallbackSettings(""), DEFAULTS);
  assert.deepEqual(fallbackSettings('{"per_pass":3,"per_day":600}'), { per_pass: 3, per_day: 600, after_min: 60, max_results: 15, from: "app_config" });
  assert.deepEqual(fallbackSettings({ per_pass: "2", per_day: 40.9, after_min: 30, max_results: 8 }), { per_pass: 2, per_day: 40, after_min: 30, max_results: 8, from: "app_config" });
  const slip = fallbackSettings('{"per_pass":600,"per_day":60000,"after_min":1,"max_results":500}');
  assert.deepEqual([slip.per_pass, slip.per_day, slip.after_min, slip.max_results], [25, 2000, 10, 50], "clamped to the limits");
  assert.equal(FALLBACK_LIMITS.per_day[1], DAILY_QUOTA - 8000, "per_day never passes the whole non-search share of the day");
  const off = fallbackSettings('{"per_day":0}');
  assert.deepEqual([off.per_day, off.per_pass, off.from], [0, 6, "app_config"], "0 is a real setting: off");
  assert.equal(fallbackSettings('{"per_pass":-4}').per_pass, 0);
  for (const junk of ["not json", "[1,2]", "7", "null"]) {
    const s = fallbackSettings(junk);
    assert.deepEqual([s.per_pass, s.per_day], [6, 580], "an unreadable row falls back to the defaults: " + junk);
    assert.match(s.from, /^default \(the yt_rss_fallback row could not be read\)$/);
  }
  assert.equal(fallbackSettings('{"per_pass":"many"}').per_pass, 6, "a value that is not a number is ignored");
});

test("the neighbours — the day still fits: RADAR 7,979 + the sweep's worst 1,440 + the second way's 580 = 9,999 of 10,000", () => {
  assert.deepEqual([SEARCH_MAX_UNITS, SWEEP_WORST_UNITS, WORST_DAY_ROOM], [7979, 1440, 581]);
  assert.ok(SEARCH_MAX_UNITS + SWEEP_WORST_UNITS + FALLBACK_DEFAULTS.per_day <= DAILY_QUOTA, "worst day " + (SEARCH_MAX_UNITS + SWEEP_WORST_UNITS + FALLBACK_DEFAULTS.per_day));
  assert.ok(FALLBACK_DEFAULTS.per_day <= WORST_DAY_ROOM, "600 would be 19 over on the worst day the older tests allow for");
  /* the sweep's worst case is what Y2's test says it is: every pass one new-video call and REFRESH_MAX / 50 refresh calls */
  const sweep = code(RSS);
  assert.match(sweep, /const REFRESH_MAX = 200;/);
  assert.equal(SWEEP_EVERY_MIN, 5);
  assert.equal(SWEEP_WORST_UNITS, (1440 / 5) * (1 + 200 / 50));
  /* measured 12 Oct 20:10Z → 13 Oct 02:05Z, 72 passes: 137 videos calls = 1.9 a pass */
  const measuredSweep = Math.round((137 / 72) * 288);
  assert.equal(measuredSweep, 548);
  assert.ok(SEARCH_MAX_UNITS + measuredSweep + FALLBACK_DEFAULTS.per_day <= DAILY_QUOTA - 800, "on the measured day there are more than 800 units to spare");
  /* what the sweep calls: its own two kinds (videos for new rows, videos for the refresh) and, through one door only, the uploads list */
  assert.equal((sweep.match(/apiKeyRequest\(/g) || []).length, 3, "definition + the two uses it always had");
  /* Y6: the pass and the look-only door now run ONE function, secondWayPass (the count, then the reads); the door's
     named channels are the only place the sweep's own file still asks an uploads list directly */
  assert.equal((sweep.match(/secondWayPass\(/g) || []).length, 2, "the second way is run in two places: the pass and the look-only door");
  assert.equal((sweep.match(/readUploadsPass\(/g) || []).length, 1, "and the uploads list is asked directly only for the look-only door's named channels");
  const notice = code(read("supabase/functions/_shared/yt-upload-notice.mjs"));
  assert.match(notice, /const toRead = \[\.\.\.movedPlan\.pick, \.\.\.plan\.pick\];\n  const reads = toRead\.length \? await readUploadsPass\(toRead, apiKey, fetchFn,/, "a pass reads exactly the plan's pick (and the channels whose count moved)");
  assert.doesNotMatch(sweep, /search\?|eventType=live/, "still no search call in the sweep");
  assert.match(code(read("supabase/functions/_shared/yt-feed-fallback.mjs")), /playlistItems\?part=snippet,contentDetails&playlistId=/);
  assert.doesNotMatch(FEED, /yt-feed-fallback|yt_rss_fallback|yt_rss_health/, "the search collector does not know about any of this");
});

/* ---------- who is asked ---------- */
test("who is due: a channel read within the hour waits, one unread for more than 60 minutes is asked, one never read goes first", () => {
  const [a, b, c2, d] = many(4);
  const health = parseHealth(healthRow({ [a]: { ok: minAgo(20), f: 4 }, [b]: { ok: minAgo(61), f: 12 }, [c2]: { ok: minAgo(600), fb: minAgo(30), f: 100 }, [d]: { f: 1, b: minAgo(5) } }));
  const plan = fallbackPlan({ unread: [a, b, c2, d], health, settings: DEFAULTS, nowSec: NOW });
  assert.deepEqual(plan.pick, [d, b], "never read first, then the one unread for 61 minutes");
  assert.deepEqual([plan.eligible.length, plan.read_lately, plan.skipped_budget, plan.cap], [2, 2, 0, null], "20 minutes ago by the feed and 30 minutes ago by the second way both count as read");
  assert.equal(lastRead(health.ch[c2]), minAgo(30));
  assert.deepEqual(fallbackPlan({ unread: [b], health, settings: { ...DEFAULTS, after_min: 90 }, nowSec: NOW }).pick, [], "the hour is a setting");
  assert.deepEqual(fallbackPlan({ unread: [], health, settings: DEFAULTS, nowSec: NOW }).pick, [], "every feed answered: nobody is asked");
});

test("oldest-unread first, and a tie is settled in the order given (the SCINTILLA list first)", () => {
  const ids = many(5);
  const health = parseHealth(healthRow({ [ids[0]]: { ok: minAgo(70) }, [ids[1]]: { ok: minAgo(300) }, [ids[2]]: { ok: minAgo(70) }, [ids[3]]: { ok: minAgo(1500), fb: minAgo(200) }, [ids[4]]: { ok: minAgo(301) } }));
  assert.deepEqual(fallbackPlan({ unread: ids, health, settings: DEFAULTS, nowSec: NOW }).pick, [ids[4], ids[1], ids[3], ids[0], ids[2]]);
  const by = carriers({ personal: [ids[0], ids[1]], scintilla: [ids[2], ids[1]], golf: [ids[3]] }, ["personal", "scintilla", "soundscapes", "golf"]);
  assert.deepEqual([...by.keys()], [ids[2], ids[1], ids[0], ids[3]], "SCINTILLA's channels lead the order");
  assert.deepEqual([...by.get(ids[1])].sort(), ["personal", "scintilla"], "and a channel knows every account that carries it");
});

test("the caps: 6 a pass; the day's even share so far; the day's total; YouTube's own 'allowance gone'; off — each said by name", () => {
  const ids = many(10);
  const never = parseHealth(healthRow());
  let plan = fallbackPlan({ unread: ids, health: never, settings: DEFAULTS, nowSec: NOW });
  assert.deepEqual([plan.pick.length, plan.skipped_budget, plan.cap, plan.day, plan.allowed_by_now], [6, 4, "pass", "2026-10-12", 461]);
  assert.equal(capWords(plan.cap, DEFAULTS, plan), "the cap of 6 channels a pass");
  /* 00:02 Pacific: 7 minutes' share of 580 is 2 */
  const early = sec(Date.UTC(2026, 9, 13, 7, 2, 0));
  plan = fallbackPlan({ unread: ids, health: never, settings: DEFAULTS, nowSec: early });
  assert.deepEqual([plan.day, plan.allowed_by_now, plan.pick.length, plan.skipped_budget, plan.cap], ["2026-10-13", 2, 2, 8, "pace"]);
  assert.match(capWords(plan.cap, DEFAULTS, plan), /even share so far is spent \(0 of 2 allowed by now, 580 a day\)/);
  /* the same moment with 2 already made today */
  plan = fallbackPlan({ unread: ids, health: parseHealth(healthRow({}, { day: "2026-10-13", used: 2 })), settings: DEFAULTS, nowSec: early });
  assert.deepEqual([plan.pick.length, plan.cap], [0, "pace"]);
  /* late in the day with the whole day spent, and with two calls left */
  plan = fallbackPlan({ unread: ids, health: parseHealth(healthRow({}, { used: 461 })), settings: DEFAULTS, nowSec: NOW });
  assert.deepEqual([plan.pick.length, plan.skipped_budget, plan.cap], [0, 10, "pace"], "461 of the 461 allowed by 19:00 Pacific");
  const lastMinute = sec(Date.UTC(2026, 9, 13, 6, 57, 0));   // 23:57 Pacific, still 12 Oct
  plan = fallbackPlan({ unread: ids, health: parseHealth(healthRow({}, { used: 578 })), settings: DEFAULTS, nowSec: lastMinute });
  assert.deepEqual([plan.day, plan.allowed_by_now, plan.pick.length, plan.skipped_budget, plan.cap], ["2026-10-12", 580, 2, 8, "day"]);
  assert.match(capWords("day", DEFAULTS, plan), /the day's 580 calls are spent \(578 before this pass\)/);
  /* yesterday's count is not today's */
  plan = fallbackPlan({ unread: ids, health: parseHealth(healthRow({}, { day: "2026-10-11", used: 580 })), settings: DEFAULTS, nowSec: NOW });
  assert.deepEqual([plan.used_today, plan.pick.length], [0, 6], "the count starts again at midnight Pacific, when YouTube resets the allowance");
  plan = fallbackPlan({ unread: ids, health: parseHealth(healthRow({}, { quota_day: "2026-10-12" })), settings: DEFAULTS, nowSec: NOW });
  assert.deepEqual([plan.pick.length, plan.skipped_budget, plan.cap], [0, 10, "quota"]);
  assert.match(capWords("quota", DEFAULTS, plan), /rests until midnight Pacific/);
  assert.equal(fallbackPlan({ unread: ids, health: parseHealth(healthRow({}, { quota_day: "2026-10-11" })), settings: DEFAULTS, nowSec: NOW }).pick.length, 6, "and it starts again the next Pacific day");
  for (const settings of [{ ...DEFAULTS, per_day: 0 }, { ...DEFAULTS, per_pass: 0 }]) {
    plan = fallbackPlan({ unread: ids, health: never, settings, nowSec: NOW });
    assert.deepEqual([plan.pick.length, plan.skipped_budget, plan.cap], [0, 10, "off"]);
  }
  assert.match(capWords("off", DEFAULTS, plan), /switched off in app_config \(yt_rss_fallback\)/);
  assert.equal(capWords(null, DEFAULTS, plan), null);
});

test("a channel the second way cannot read either is not asked on every pass: after 1 h, 2 h, 4 h … at most once a day", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 9].map((x) => retryAfterMin(x, 60)), [60, 120, 240, 480, 960, 1440, 1440]);
  const [gone] = many(1);
  const at = (minutes, x) => fallbackPlan({ unread: [gone], health: parseHealth(healthRow({ [gone]: { f: 50, b: minAgo(3000), t: minAgo(minutes), x } })), settings: DEFAULTS, nowSec: NOW });
  assert.deepEqual([at(59, 1).pick.length, at(59, 1).resting, at(61, 1).pick.length], [0, 1, 1]);
  assert.deepEqual([at(119, 2).pick.length, at(121, 2).pick.length, at(1439, 8).pick.length, at(1441, 8).pick.length], [0, 1, 0, 1]);
});

test("a whole day with every feed down: 580 calls, never more than 6 a pass, spread from midnight to midnight, every channel read", () => {
  const ids = many(186);
  let health = parseHealth(null);
  const start = sec(Date.UTC(2026, 9, 13, 7, 0, 0));          // midnight Pacific
  const perHour = Array(24).fill(0), readsOf = new Map(ids.map((id) => [id, 0]));
  let most = 0, total = 0;
  for (let pass = 0; pass < 288; pass++) {
    const nowSec = start + pass * 300;
    const plan = fallbackPlan({ unread: ids, health, settings: DEFAULTS, nowSec });
    most = Math.max(most, plan.pick.length); total += plan.pick.length; perHour[Math.floor(pass / 12)] += plan.pick.length;
    for (const id of plan.pick) readsOf.set(id, readsOf.get(id) + 1);
    health = nextHealth({ health, channels: ids, feedOk: new Set(), reads: plan.pick.map((id) => ({ id, sent: true, outcome: "ok", name: "n", rows: [] })), nowSec });
  }
  assert.equal(total, 580, "the day's cap, exactly");
  assert.equal(health.used, 580);
  assert.ok(most <= 6, "never more than 6 in a pass (most: " + most + ")");
  assert.ok(Math.max(...perHour) <= 26 && Math.min(...perHour) >= 22, "about 24 an hour, every hour: " + perHour.join(" "));
  assert.equal([...readsOf.values()].filter((n) => n === 0).length, 0, "all 186 channels were read");
  assert.ok(Math.min(...readsOf.values()) >= 3 && Math.max(...readsOf.values()) <= 4, "each of them three or four times — one read every seven and a half hours");
  assert.deepEqual(unreadOverADay(health, start + 288 * 300), [], "so nobody is unread for a day");
});

test("three channels down for a day, the rest fine: each is read every hour or so and the budget is never the limit", () => {
  const ids = many(186), down = ids.slice(0, 3);
  let health = parseHealth(null);
  const start = sec(Date.UTC(2026, 9, 13, 7, 0, 0));
  let total = 0, skipped = 0;
  for (let pass = 0; pass < 288; pass++) {
    const nowSec = start + pass * 300;
    const plan = fallbackPlan({ unread: down, health, settings: DEFAULTS, nowSec });
    total += plan.pick.length; skipped += plan.skipped_budget;
    health = nextHealth({ health, channels: ids, feedOk: new Set(ids.slice(3)), reads: plan.pick.map((id) => ({ id, sent: true, outcome: "ok", name: "n", rows: [] })), nowSec });
  }
  assert.ok(total >= 60 && total <= 72, "about 22 reads each (65-minute rounds): " + total);
  assert.ok(skipped <= 3, "only the very first minutes of the Pacific day make anyone wait (" + skipped + ")");
});

/* ---------- reading one channel the second way ---------- */
test("an uploads-list answer becomes rows in the feed's own shape; private, removed and other people's items are left out", () => {
  const body = uploadsBody(DESK, "Chart Desk Daily", [
    { id: "fxNewVideo1", title: "The newest video", published: "2026-10-13T01:14:38Z", description: "d".repeat(499) + "😀tail" },
    { id: "fxNewVideo2", title: "The video of two days ago that was never stored", published: "2026-10-11T04:00:03Z" }]);
  body.items.push({ snippet: { title: "Private video", description: "This video is private.", resourceId: { kind: "youtube#video", videoId: "ppppppppppp" } }, contentDetails: { videoId: "ppppppppppp" } });
  body.items.push({ snippet: { title: "Deleted video", publishedAt: "2026-10-01T00:00:00Z", resourceId: { kind: "youtube#video", videoId: "ddddddddddd" } }, contentDetails: { videoId: "ddddddddddd" } });
  body.items.push({ snippet: { title: "A guest's video", publishedAt: "2026-10-01T00:00:00Z", videoOwnerChannelId: LEDGER, resourceId: { kind: "youtube#video", videoId: "ggggggggggg" } }, contentDetails: { videoId: "ggggggggggg", videoPublishedAt: "2026-10-01T00:00:00Z" } });
  body.items.push({ snippet: { title: "A stream still to come", publishedAt: "2026-10-12T20:00:00Z", thumbnails: {}, channelTitle: "Chart Desk Daily", resourceId: { kind: "youtube#video", videoId: "uuuuuuuuuuu" } }, contentDetails: { videoId: "uuuuuuuuuuu" } });
  body.items.push({ snippet: { title: "same again", resourceId: { kind: "youtube#video", videoId: "fxNewVideo1" } }, contentDetails: { videoId: "fxNewVideo1", videoPublishedAt: "2026-10-13T01:14:38Z" } });
  body.items.push({ snippet: { title: "not a video id" }, contentDetails: { videoId: "short" } });
  const rows = uploadsToCandidates(body, DESK, NOW);
  assert.deepEqual(rows.map((r) => r.video_id), ["fxNewVideo1", "fxNewVideo2", "uuuuuuuuuuu"]);
  assert.deepEqual(Object.keys(rows[0]), ["video_id", "channel_id", "channel_title", "title", "description", "thumbnail", "url", "published_at", "source", "ticker", "updated_ts"],
    "exactly the fields a feed entry carries — nothing the table has no column for");
  assert.deepEqual([rows[0].channel_id, rows[0].channel_title, rows[0].source, rows[0].ticker, rows[0].updated_ts, rows[0].url, rows[0].thumbnail, rows[0].published_at],
    [DESK, "Chart Desk Daily", "subscription", null, NOW, "https://www.youtube.com/watch?v=fxNewVideo1", "https://i.ytimg.com/vi/fxNewVideo1/hqdefault.jpg", "2026-10-13T01:14:38Z"]);
  assert.equal(rows[0].description.length, 499, "cut at 500 without leaving half of a character (a lone half breaks the table write)");
  assert.ok(rows[0].description.isWellFormed());
  assert.deepEqual([rows[2].published_at, rows[2].thumbnail], ["2026-10-12T20:00:00Z", "https://i.ytimg.com/vi/uuuuuuuuuuu/hqdefault.jpg"], "no publish time yet: the listing time; no picture given: the standard address");
  assert.deepEqual(uploadsToCandidates(null, DESK, NOW), []);
  assert.deepEqual(uploadsToCandidates({ items: "x" }, DESK, NOW), []);
  assert.equal(uploadsPlaylistId(DESK), "UUdeskFixture00000000001");
  assert.equal(uploadsPath(DESK), "playlistItems?part=snippet,contentDetails&playlistId=UUdeskFixture00000000001&maxResults=15");
});

test("one channel read: every outcome has a name, a failure never throws, and the key is in the request and nowhere else", async () => {
  const asked = [];
  const net = (hit) => async (url, init) => {
    asked.push({ url: String(url), signal: !!(init && init.signal) });
    if (hit instanceof Error) throw hit;
    const [status, body] = Array.isArray(hit) ? hit : [200, hit];
    return { ok: status === 200, status, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) };
  };
  const ok = await readUploads(DESK, KEY, net(DESK_UPLOADS), { nowSec: NOW });
  assert.deepEqual([ok.id, ok.sent, ok.status, ok.outcome, ok.reason, ok.name, ok.rows.length], [DESK, true, 200, "ok", null, "Chart Desk Daily", 3]);
  assert.equal(asked[0].url, "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=UUdeskFixture00000000001&maxResults=15&key=" + KEY);
  assert.ok(asked[0].signal, "the call is bounded");
  assert.ok(UPLOADS_TIMEOUT_MS <= 8000);
  assert.equal((await readUploads(DESK, KEY, net(DESK_UPLOADS), { maxResults: 8 })).outcome, "ok");
  assert.match(asked[1].url, /maxResults=8&key=/);
  const empty = await readUploads(DESK, KEY, net({ items: [] }));
  assert.deepEqual([empty.outcome, empty.rows.length, empty.name], ["ok", 0, ""], "a channel with nothing uploaded is still a channel that was read");
  const cases = [
    [apiError(404, "playlistNotFound"), "not_found", "playlistNotFound"], [NOT_FOUND, "not_found", null],
    [apiError(403, "quotaExceeded"), "quota", "quotaExceeded"], [apiError(403, "dailyLimitExceeded"), "quota", "dailyLimitExceeded"],
    [apiError(403, "rateLimitExceeded"), "rate", "rateLimitExceeded"], [[429, "slow down"], "rate", null],
    [apiError(403, "playlistItemsNotAccessible"), "forbidden", "playlistItemsNotAccessible"], [apiError(403, "accessNotConfigured"), "key_or_request", "accessNotConfigured"],
    [apiError(400, "keyInvalid"), "key_or_request", "keyInvalid"], [[500, "oops"], "http_500", null], [[503, { error: { errors: [] } }], "http_503", null],
    [[200, "<html>not json</html>"], "unreadable", null], [[200, { kind: "x" }], "unreadable", null],
    [Object.assign(new Error("slow"), { name: "TimeoutError" }), "timeout", null], [new Error("socket " + KEY), "fetch_error", null],
  ];
  for (const [hit, outcome, reason] of cases) {
    const got = await readUploads(DESK, KEY, net(hit));
    assert.deepEqual([got.outcome, got.reason, got.sent, got.rows], [outcome, reason, true, []], outcome);
    assert.doesNotMatch(JSON.stringify(got), new RegExp(KEY), "no key in what comes back: " + outcome);
  }
  const before = asked.length;
  assert.deepEqual([(await readUploads("not-a-channel", KEY, net(DESK_UPLOADS))).outcome, (await readUploads(DESK, "", net(DESK_UPLOADS))).outcome], ["not_a_channel_id", "no_key"]);
  assert.equal(asked.length, before, "neither is sent");
  const pass = await readUploadsPass([DESK, LEDGER], KEY, net(DESK_UPLOADS), { nowSec: NOW });
  assert.deepEqual(pass.map((r) => [r.id, r.outcome]), [[DESK, "ok"], [LEDGER, "ok"]]);
  assert.equal(pass[1].rows.length, 0, "an answer whose videos belong to another channel brings nothing");
});

test("the feed itself: one retry, a time limit, and an OK answer that is not a feed is not a read", async (t) => {
  const realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, _ms, ...rest) => realTimeout(fn, 0, ...rest);   // the 700 ms pause before the retry, not waited for here
  t.after(() => { globalThis.setTimeout = realTimeout; });
  let n = 0;
  const twice = await feedAnswers(TALK, async (url, init) => { n++; assert.ok(init.signal); assert.equal(url, "https://www.youtube.com/feeds/videos.xml?channel_id=" + TALK); return n === 1 ? { ok: false, status: 404 } : { ok: true, status: 200, text: async () => feedXml("Long Talks Radio", []) }; });
  assert.deepEqual([twice, n], [{ id: TALK, ok: true, status: 200 }, 2]);
  assert.deepEqual(await feedAnswers(TALK, async () => ({ ok: false, status: 500 })), { id: TALK, ok: false, status: 500 });
  assert.deepEqual(await feedAnswers(TALK, async () => { throw new Error("x"); }), { id: TALK, ok: false, status: 0 });
  assert.deepEqual(await feedAnswers(TALK, async () => ({ ok: true, status: 200, text: async () => "<html>Before you continue to YouTube</html>" })), { id: TALK, ok: false, status: 200 });
  assert.deepEqual([isFeed(feedXml("x", [])), isFeed("<feed>"), isFeed("<html><body>feed</body></html>"), isFeed(""), isFeed(null)], [true, true, false, false, false]);
});

/* ---------- what is remembered ---------- */
test("the remembered row: last feed read, last second-way read, misses in a row — small, and only followed channels", () => {
  const [fine, down, both, left, fresh] = many(5);
  const before = parseHealth(healthRow({ [fine]: { ok: minAgo(5) }, [down]: { ok: minAgo(120), f: 23 }, [both]: { ok: minAgo(900), f: 170, t: minAgo(200), x: 2, n: "Old Name" }, [left]: { ok: minAgo(5) } }, { used: 40 }));
  const after = nextHealth({ health: before, channels: [fine, down, both, fresh], feedOk: new Set([fine]), nowSec: NOW,
    reads: [{ id: down, sent: true, outcome: "ok", name: "Morning Tape", rows: [] }, { id: both, sent: true, outcome: "not_found", name: "", rows: [] }, { id: "UCsomeoneNamedInALook00", sent: true, outcome: "ok", name: "x", rows: [] }] });
  assert.deepEqual(after.ch[fine], { ok: NOW }, "a channel the feed answers is one short entry");
  assert.deepEqual(after.ch[down], { ok: minAgo(120), f: 24, fb: NOW, n: "Morning Tape" }, "read the second way: remembered, with its name while it is in trouble");
  assert.deepEqual(after.ch[both], { ok: minAgo(900), f: 171, t: NOW, x: 3, n: "Old Name" }, "neither way: the failure is counted, so it is asked less often");
  assert.deepEqual(after.ch[fresh], { f: 1, b: NOW }, "never read: the moment it was first seen unread");
  assert.ok(!(left in after.ch), "a channel no longer followed is dropped");
  assert.deepEqual([after.v, after.at, after.day, after.used, after.quota_day], [1, NOW, "2026-10-12", 43, ""], "three calls were sent, whoever they were for");
  assert.deepEqual(before.ch[down], { ok: minAgo(120), f: 23 }, "the old row is not touched");
  /* the feed comes back */
  const back = nextHealth({ health: after, channels: [fine, down, both, fresh], feedOk: new Set([fine, down, both, fresh]), reads: [], nowSec: NOW + 300 });
  assert.deepEqual(back.ch[down], { ok: NOW + 300, fb: NOW }, "the count and the name go; the last second-way read stays for a week");
  assert.deepEqual(back.ch[both], { ok: NOW + 300 });
  assert.deepEqual(nextHealth({ health: back, channels: [down], feedOk: new Set([down]), reads: [], nowSec: NOW + 8 * 86400 }).ch[down], { ok: NOW + 8 * 86400 });
  /* an answer that is not about the channel holds nothing against it, and "allowance gone" is remembered for the day */
  const quota = nextHealth({ health: before, channels: [down], feedOk: new Set(), nowSec: NOW,
    reads: [{ id: down, sent: true, outcome: "quota", reason: "quotaExceeded", rows: [] }] });
  assert.deepEqual([quota.ch[down], quota.quota_day, quota.used], [{ ok: minAgo(120), f: 24 }, "2026-10-12", 41]);
  for (const outcome of ["rate", "key_or_request", "timeout", "fetch_error"]) {
    assert.deepEqual(nextHealth({ health: before, channels: [down], feedOk: new Set(), nowSec: NOW, reads: [{ id: down, sent: true, outcome, rows: [] }] }).ch[down], { ok: minAgo(120), f: 24 }, outcome);
  }
  /* a new Pacific day: the count starts again and yesterday's "allowance gone" is forgotten */
  const tomorrow = nextHealth({ health: quota, channels: [down], feedOk: new Set(), reads: [], nowSec: sec(Date.UTC(2026, 9, 13, 7, 5, 0)) });
  assert.deepEqual([tomorrow.day, tomorrow.used, tomorrow.quota_day], ["2026-10-13", 0, ""]);
  /* the size of the real thing: 186 followed channels, all answering */
  const all = many(186);
  const whole = nextHealth({ health: parseHealth(null), channels: all, feedOk: new Set(all), reads: [], nowSec: NOW });
  assert.ok(JSON.stringify(whole).length < 9000, "186 healthy channels: " + JSON.stringify(whole).length + " characters");
  const burst = nextHealth({ health: whole, channels: all, feedOk: new Set(), reads: [], nowSec: NOW + 300 });
  assert.ok(JSON.stringify(burst).length < 12000, "all 186 down: " + JSON.stringify(burst).length + " characters");
});

test("a row that cannot be read is an empty memory, never a crash", () => {
  const empty = { v: 1, at: 0, day: "", used: 0, quota_day: "", ch: {} };
  for (const junk of [null, undefined, "", "not json", "[]", "7", '{"ch":[1,2]}', '{"ch":"x","used":-4,"at":"soon","day":5}']) assert.deepEqual(parseHealth(junk), empty, String(junk));
  const mixed = parseHealth(JSON.stringify({ at: NOW, day: "2026-10-12", used: "12", ch: { [TALK]: { ok: NOW, fb: 0, f: "3", n: "Long Talks Radio", extra: "x" }, "not-an-id": { ok: 1 }, [LEDGER]: "x", [TAPE]: { ok: -5, n: 7 } } }));
  assert.deepEqual(mixed, { v: 1, at: NOW, day: "2026-10-12", used: 12, quota_day: "", ch: { [TALK]: { ok: NOW, f: 3, n: "Long Talks Radio" }, [TAPE]: {} } });
  assert.equal(lastRead(undefined), 0);
});

test("unread for more than a day — by the feed AND by the second way — is a list, longest first; a channel the second way reads is not on it", () => {
  const [rescued, dark, never, recent] = many(4);
  const health = parseHealth(healthRow({ [rescued]: { ok: minAgo(5000), fb: minAgo(50), f: 900 }, [dark]: { ok: minAgo(3000), f: 600, t: minAgo(100), x: 5, n: "Gone Quiet" },
    [never]: { f: 400, b: minAgo(1500), x: 1, t: minAgo(1500) }, [recent]: { ok: minAgo(1439), f: 280 } }));
  assert.deepEqual(unreadOverADay(health, NOW), [
    { id: dark, name: "Gone Quiet", hours: 50, feed_misses: 600, second_way_failures: 5 },
    { id: never, name: "", hours: 25, feed_misses: 400, second_way_failures: 1 }]);
  assert.ok(UNREAD_NAMED_MAX >= 40);
});

test("the saved channel lists are read without signing in anywhere; the unsuffixed list is SCINTILLA's when its own is missing", () => {
  const config = { yt_sub_channels_personal: JSON.stringify({ ids: [TALK, "junk"], ts: 1 }), yt_sub_channels: JSON.stringify({ ids: [DESK] }), yt_sub_channels_golf: "not json" };
  assert.deepEqual(savedChannelLists(config, ["personal", "scintilla", "golf", "fitness"]), { personal: [TALK], scintilla: [DESK], golf: [], fitness: [] });
  assert.deepEqual(savedChannelLists({ ...config, yt_sub_channels_scintilla: JSON.stringify({ ids: [LEDGER] }) }, ["scintilla"]), { scintilla: [LEDGER] });
});

/* ---------- the sweep itself, with feeds that do not answer ---------- */
const emptyUploads = (ids) => Object.fromEntries(ids.map((id) => [id, { items: [] }]));
const uploadsAsked = (log) => log.fetched.filter((u) => u.includes("/youtube/v3/playlistItems")).map((u) => "UC" + u.match(/playlistId=UU([^&]+)/)[1]);

test("a burst: a followed channel's feed has given 404 for 95 minutes → its uploads list is read, the new videos enter the feed, and the row says how", async () => {
  const { result, tables, log } = await runSweep({
    config: cfg({ scintilla: [DESK, TALK], personal: [DESK] }, { [HEALTH_KEY]: healthRow({ [DESK]: { ok: minAgo(95), f: 19 }, [TALK]: { ok: minAgo(5) } }, { used: 7 }) }),
    videos: [held(DESK_HELD, DESK, "Chart Desk Daily")],
    feeds: { [DESK]: NOT_FOUND, [TALK]: feedXml("Long Talks Radio", []) },
    uploads: { [DESK]: DESK_UPLOADS }, api: ZXX,
  });
  assert.deepEqual([result.rss_channels, result.rss_failed, result.rss_seen, result.new_videos], [3, 2, 3, 2], "two feed reads failed (the channel is on two lists); three videos seen, the two new ones stored");
  const f = result.fallback;
  assert.deepEqual([f.feed_unread, f.eligible, f.asked, f.read, f.videos, f.videos_new, f.skipped_budget, f.cap, f.cap_says, f.error], [1, 1, 1, 1, 3, 2, 0, null, null, null]);
  assert.deepEqual(f.channels, [{ id: DESK, name: "Chart Desk Daily", videos: 3 }]);
  assert.deepEqual(f.could_not_read, []);
  assert.deepEqual(f.budget, { per_pass: 6, per_day: 580, after_min: 60, max_results: 15, from: "app_config", day: "2026-10-12", used_today: 8, allowed_by_now: 461, quota_gone: false });
  assert.deepEqual(f.unread_over_a_day, { count: 0, longest_hours: 0, names: [] });
  assert.deepEqual(uploadsAsked(log), [DESK], "one call, for the one channel that was due");
  const newest = row(tables, "fxNewVideo1");
  assert.deepEqual([newest.channel_id, newest.channel_title, newest.source, newest.subscription_accounts, newest.published_at, newest.thumbnail, newest.duration_sec, newest.is_short],
    [DESK, "Chart Desk Daily", "subscription", ["personal", "scintilla"], "2026-10-13T01:14:38Z", "https://i.ytimg.com/vi/fxNewVideo1/hqdefault.jpg", 1407, false],
    "the same row a feed entry makes: every account that follows the channel, then the videos call's length and the shorts check");
  assert.equal(row(tables, "fxHeldVideo").updated_ts, 1791639302, "a video already held is not rewritten");
  assert.equal(tables.youtube_videos.length, 3);
  const health = stored(tables, HEALTH_KEY);
  assert.deepEqual(health.ch[DESK], { ok: minAgo(95), fb: NOW, f: 20, n: "Chart Desk Daily" });
  assert.deepEqual(health.ch[TALK], { ok: NOW });
  assert.deepEqual([health.at, health.day, health.used, health.quota_day], [NOW, "2026-10-12", 8, ""]);
  assert.deepEqual(stored(tables, "yt_rss_result").fallback, f, "the stored result row carries the same block");
  assert.doesNotMatch(JSON.stringify(result) + JSON.stringify(tables.app_config.filter((r) => r.key !== "YT_API_KEY")) + JSON.stringify(log.fetched), new RegExp(KEY), "no key in anything stored or reported");
});

test("a feed that missed this pass but answered 20 minutes ago is left to the feed: no call is spent on a blip", async () => {
  const { result, tables, log } = await runSweep({
    config: cfg({ scintilla: [DESK] }, { [HEALTH_KEY]: healthRow({ [DESK]: { ok: minAgo(20), f: 3 } }) }),
    feeds: { [DESK]: new Error("socket hang up") }, uploads: { [DESK]: DESK_UPLOADS },
  });
  assert.deepEqual([result.rss_failed, result.fallback.feed_unread, result.fallback.eligible, result.fallback.asked, result.new_videos], [1, 1, 0, 0, 0]);
  assert.deepEqual(uploadsAsked(log), []);
  assert.deepEqual(stored(tables, HEALTH_KEY).ch[DESK], { ok: minAgo(20), f: 4 });
});

test("ten channels due: six are asked — the longest unread first — four wait and the row says which cap; five minutes later the four go first", async () => {
  const ids = many(10);
  const ch = Object.fromEntries(ids.map((id, i) => [id, { ok: minAgo(100 + i), f: 20 }]));
  const feeds = Object.fromEntries(ids.map((id) => [id, [500, "Internal Server Error"]]));
  const first = await runSweep({ config: cfg({ scintilla: ids }, { [HEALTH_KEY]: healthRow(ch) }), feeds, uploads: emptyUploads(ids) });
  let f = first.result.fallback;
  assert.deepEqual([f.feed_unread, f.eligible, f.asked, f.read, f.skipped_budget, f.cap, f.cap_says], [10, 10, 6, 6, 4, "pass", "the cap of 6 channels a pass"]);
  assert.deepEqual(uploadsAsked(first.log).sort(), ids.slice(4).sort(), "the six unread longest");
  assert.equal(first.result.rss_failed, 10, "the feed count is what it was");
  const second = await runSweep({ store: first.store, feeds, uploads: emptyUploads(ids), nowMs: T0 + 300000 });
  f = second.result.fallback;
  assert.deepEqual([f.feed_unread, f.eligible, f.asked, f.skipped_budget, f.cap, f.budget.used_today], [10, 4, 4, 0, null, 10]);
  assert.deepEqual(uploadsAsked(second.log).sort(), ids.slice(0, 4).sort(), "the four that waited; the six just read are not asked again");
  const third = await runSweep({ store: second.store, feeds, uploads: emptyUploads(ids), nowMs: T0 + 600000 });
  assert.deepEqual([third.result.fallback.eligible, third.result.fallback.asked], [0, 0], "everyone was read within the hour: nothing is spent");
});

test("the budget is the limit: nothing is asked, the row says so in words, and the pass still stores what the feeds bring", async () => {
  const ids = many(3);
  const { result, tables, log } = await runSweep({
    config: cfg({ scintilla: [...ids, TALK] }, { [HEALTH_KEY]: healthRow(Object.fromEntries(ids.map((id) => [id, { ok: minAgo(200), f: 40 }])), { used: 461 }) }),
    feeds: { ...Object.fromEntries(ids.map((id) => [id, NOT_FOUND])), [TALK]: feedXml("Long Talks Radio", [{ id: "fxLongTalk1", title: "Long Talks #412 - a three-hour conversation", published: "2026-10-08T17:00:00+00:00" }]) },
    api: { fxLongTalk1: apiVideo("en", "en", "PT2H41M") }, uploads: emptyUploads(ids),
  });
  const f = result.fallback;
  assert.deepEqual([f.eligible, f.asked, f.skipped_budget, f.cap], [3, 0, 3, "pace"]);
  assert.equal(f.cap_says, "the day's even share so far is spent (461 of 461 allowed by now, 580 a day)");
  assert.deepEqual(uploadsAsked(log), []);
  assert.deepEqual([result.new_videos, row(tables, "fxLongTalk1").duration_sec], [1, 9660], "the feed's own video is stored as on any pass");
  assert.equal(stored(tables, HEALTH_KEY).used, 461);
});

test("YouTube says the day's allowance is gone: the pass does not fail, nothing is held against the channel, and the second way rests until the Pacific day turns", async () => {
  const config = cfg({ scintilla: [DESK] }, { [HEALTH_KEY]: healthRow({ [DESK]: { ok: minAgo(300), f: 60 } }) });
  const feeds = { [DESK]: NOT_FOUND };
  const first = await runSweep({ config, feeds, uploads: { [DESK]: apiError(403, "quotaExceeded") } });
  let f = first.result.fallback;
  assert.deepEqual([f.asked, f.read, f.videos, f.error], [1, 0, 0, null]);
  assert.deepEqual(f.could_not_read, [{ id: DESK, outcome: "quota", reason: "quotaExceeded" }]);
  assert.equal(f.budget.quota_gone, true);
  assert.ok(first.result.at && first.log.writes.some((w) => w.key === "yt_rss_result"), "the pass finished and wrote its result");
  let health = stored(first.tables, HEALTH_KEY);
  assert.deepEqual([health.ch[DESK], health.quota_day, health.used], [{ ok: minAgo(300), f: 61 }, "2026-10-12", 1]);
  const second = await runSweep({ store: first.store, feeds, uploads: { [DESK]: DESK_UPLOADS }, nowMs: T0 + 300000 });
  f = second.result.fallback;
  assert.deepEqual([f.eligible, f.asked, f.skipped_budget, f.cap], [1, 0, 1, "quota"]);
  assert.match(f.cap_says, /YouTube said the day's allowance is gone/);
  assert.deepEqual(uploadsAsked(second.log), [], "not one more call that day");
  const nextDay = await runSweep({ store: second.store, feeds, uploads: { [DESK]: DESK_UPLOADS }, api: ZXX, nowMs: Date.UTC(2026, 9, 13, 8, 0, 0) });   // 01:00 Pacific, 13 Oct
  f = nextDay.result.fallback;
  assert.deepEqual([f.asked, f.read, f.videos_new, f.budget.day, f.budget.used_today, f.budget.quota_gone], [1, 1, 3, "2026-10-13", 1, false]);
});

test("neither way can read a channel: it is counted, asked less often — and after a day it is NAMED in the result, from the videos already held", async () => {
  const dark = { ok: minAgo(1500), f: 300 };
  const first = await runSweep({
    config: cfg({ scintilla: [TAPE, TALK] }, { [HEALTH_KEY]: healthRow({ [TAPE]: dark, [TALK]: { ok: minAgo(5) } }) }),
    videos: [held({ id: "fxTapeDaily", title: "8 Oct: the breakout fails. What next?", published: "2026-10-08T12:32:00+00:00" }, TAPE, "Morning Tape")],
    feeds: { [TAPE]: NOT_FOUND, [TALK]: feedXml("Long Talks Radio", []) },   // and the uploads list answers 404 too
  });
  let f = first.result.fallback;
  assert.deepEqual([f.asked, f.read, f.videos], [1, 0, 0]);
  assert.deepEqual(f.could_not_read, [{ id: TAPE, outcome: "not_found", reason: "playlistNotFound" }]);
  assert.deepEqual(f.unread_over_a_day, { count: 1, longest_hours: 25, names: ["Morning Tape"] }, "nothing goes quiet unseen");
  assert.deepEqual(stored(first.tables, HEALTH_KEY).ch[TAPE], { ok: minAgo(1500), f: 301, t: NOW, x: 1, n: "Morning Tape" });
  const second = await runSweep({ store: first.store, feeds: { [TAPE]: NOT_FOUND, [TALK]: feedXml("Long Talks Radio", []) }, nowMs: T0 + 300000 });
  f = second.result.fallback;
  assert.deepEqual([f.feed_unread, f.eligible, f.asked, f.unread_over_a_day.names], [1, 0, 0, ["Morning Tape"]], "not asked again inside the hour, still named");
  assert.equal(second.log.reads.filter((r) => r.table === "youtube_videos" && r.keys.includes("fxTapeDaily")).length, 0, "the name is in the row now: the table is not asked for it again");
  /* a channel with no video held at all is named by its id */
  const [stranger] = many(1);
  const third = await runSweep({ config: cfg({ golf: [stranger] }, { [HEALTH_KEY]: healthRow({ [stranger]: { f: 400, b: minAgo(2000), t: minAgo(100), x: 6 } }) }), feeds: { [stranger]: NOT_FOUND } });
  assert.deepEqual(third.result.fallback.unread_over_a_day, { count: 1, longest_hours: 33, names: [stranger] });
});

test("the numbers in app_config are the numbers used, and the result row says where they came from; 0 switches the second way off", async () => {
  const ids = many(5);
  const ch = Object.fromEntries(ids.map((id, i) => [id, { ok: minAgo(100 + i), f: 20 }]));
  const feeds = Object.fromEntries(ids.map((id) => [id, NOT_FOUND]));
  const two = await runSweep({ config: cfg({ scintilla: ids }, { [HEALTH_KEY]: healthRow(ch), [SETTINGS_KEY]: { per_pass: 2, per_day: 100, after_min: 90, max_results: 8 } }), feeds, uploads: emptyUploads(ids) });
  let f = two.result.fallback;
  assert.deepEqual([f.asked, f.skipped_budget, f.cap, f.cap_says], [2, 3, "pass", "the cap of 2 channels a pass"]);
  assert.deepEqual([f.budget.per_pass, f.budget.per_day, f.budget.after_min, f.budget.max_results, f.budget.from, f.budget.allowed_by_now], [2, 100, 90, 8, "app_config", 79]);
  assert.ok(two.log.fetched.filter((u) => u.includes("playlistItems")).every((u) => u.includes("&maxResults=8&")), "the page size asked for is the row's");
  assert.equal(JSON.stringify(two.tables.app_config.find((r) => r.key === SETTINGS_KEY)), JSON.stringify({ key: SETTINGS_KEY, value: JSON.stringify({ notice: 0, per_pass: 2, per_day: 100, after_min: 90, max_results: 8 }) }), "the sweep reads the settings row and never writes it");
  const off = await runSweep({ config: cfg({ scintilla: ids }, { [HEALTH_KEY]: healthRow(ch), [SETTINGS_KEY]: { per_day: 0 } }), feeds, uploads: emptyUploads(ids) });
  f = off.result.fallback;
  assert.deepEqual([f.eligible, f.asked, f.skipped_budget, f.cap, f.cap_says], [5, 0, 5, "off", "switched off in app_config (yt_rss_fallback)"]);
  assert.deepEqual(uploadsAsked(off.log), []);
  const broken = await runSweep({ config: cfg({ scintilla: ids }, { [HEALTH_KEY]: "not json at all", [SETTINGS_KEY]: "[6,600]" }), feeds, uploads: emptyUploads(ids) });
  f = broken.result.fallback;
  assert.deepEqual([f.asked, f.budget.per_pass, f.budget.per_day, f.budget.from, f.error], [5, 6, 580, "default (the yt_rss_fallback row could not be read)", null], "two unreadable rows: an empty memory and the defaults — the pass runs");
});

test("every feed answers: the pass is the pass it always was — no uploads call, the same rows — plus one small remembered row", async () => {
  const { result, tables, log } = await runSweep({
    config: cfg({ scintilla: [DESK, TALK], soundscapes: [RAIN] }),
    feeds: { [DESK]: feedXml("Chart Desk Daily", DESK_NEW), [TALK]: feedXml("Long Talks Radio", []), [RAIN]: feedXml("Quiet Rain Room", []) }, api: ZXX,
  });
  assert.deepEqual(result.fallback, { feed_unread: 0, eligible: 0, asked: 0, read: 0, videos: 0, videos_new: 0, skipped_budget: 0, cap: null, cap_says: null, channels: [], could_not_read: [],
    budget: { per_pass: 6, per_day: 580, after_min: 60, max_results: 15, from: "app_config", day: "2026-10-12", used_today: 0, allowed_by_now: 461, quota_gone: false },
    unread_over_a_day: { count: 0, longest_hours: 0, names: [] }, error: null });
  assert.deepEqual(uploadsAsked(log), []);
  assert.deepEqual([result.rss_failed, result.rss_seen, result.new_videos], [0, 2, 2]);
  assert.deepEqual(stored(tables, HEALTH_KEY), { v: 1, at: NOW, day: "2026-10-12", used: 0, quota_day: "", ch: { [DESK]: { ok: NOW }, [TALK]: { ok: NOW }, [RAIN]: { ok: NOW } } });
  assert.equal(log.writes.filter((w) => w.key === HEALTH_KEY).length, 1, "one write of the one new row");
  const before = ["yt_rss_result", "yt_rss_running", "yt_bridge_live"];   // the rows a pass wrote before Y5
  assert.deepEqual([...new Set(log.writes.filter((w) => w.table === "app_config").map((w) => w.key))].filter((key) => !before.includes(key)), ["yt_rss_health"], "and no other new row");
  assert.ok(!log.writes.some((w) => w.key === SETTINGS_KEY), "the settings row is never written by the sweep");
  assert.equal(tables.app_config.find((r) => r.key === SETTINGS_KEY).value, JSON.stringify(NOTICE_OFF), "it is what it was");
});

test("an OK answer that is not a feed is not a read; a pass that is already running is still left alone", async () => {
  const wall = await runSweep({ config: cfg({ scintilla: [DESK] }), feeds: { [DESK]: "<html><title>Before you continue to YouTube</title></html>" }, uploads: { [DESK]: DESK_UPLOADS }, api: ZXX });
  assert.deepEqual([wall.result.rss_failed, wall.result.fallback.feed_unread, wall.result.fallback.asked, wall.result.fallback.videos_new], [0, 1, 1, 3], "YouTube said OK, so the old count is 0 — but nothing was read, and a channel never read is asked at once");
  const busy = await runSweep({ config: cfg({ scintilla: [DESK] }, { yt_rss_running: { ts: NOW - 60 } }), feeds: { [DESK]: NOT_FOUND }, uploads: { [DESK]: DESK_UPLOADS } });
  assert.deepEqual([busy.result, busy.log.writes, busy.log.fetched], [{ skipped: "busy" }, [], []]);
});

/* ---------- the look-only door ---------- */
test("?dry=fallback — which channels would be asked and what came back: nothing written, no lock taken, no sign-in row read", async () => {
  const config = cfg({ scintilla: [DESK, TALK], personal: [DESK] }, {
    [HEALTH_KEY]: healthRow({ [DESK]: { ok: minAgo(95), f: 19 }, [TALK]: { ok: minAgo(5) } }, { used: 7 }),
    YT_OAUTH_CLIENT_ID: "client", YT_OAUTH_CLIENT_SECRET: "client-secret-NEVER-READ", YT_REFRESH_TOKEN_SCINTILLA: "refresh-NEVER-READ", yt_rss_running: { ts: 0 } });
  const snapshot = JSON.stringify(config);
  const { result, tables, log } = await runSweep({ config, videos: [held(DESK_HELD, DESK, "Chart Desk Daily")], query: "?dry=fallback",
    feeds: { [DESK]: NOT_FOUND, [TALK]: feedXml("Long Talks Radio", []) }, uploads: { [DESK]: DESK_UPLOADS } });
  assert.deepEqual([result.dry, result.wrote, result.followed, result.feeds_read, result.feed_unread, result.eligible, result.would_ask, result.skipped_budget, result.cap, result.units_spent],
    ["fallback", "nothing", 2, 2, 1, 1, [DESK], 0, null, 1]);
  assert.equal(result.asked.length, 1);
  const line = result.asked[0];
  assert.deepEqual([line.id, line.name, line.why, line.feed, line.last_read_min_ago, line.outcome, line.reason, line.videos, line.newest, line.not_stored],
    [DESK, "Chart Desk Daily", "feed unread", "no answer (404)", 95, "ok", null, 3, "2026-10-13T01:14:38Z", 2]);
  assert.deepEqual(line.items.map((v) => [v.video_id, v.stored]), [["fxNewVideo1", false], ["fxNewVideo2", false], ["fxHeldVideo", true]]);
  assert.deepEqual(result.budget, { per_pass: 6, per_day: 580, after_min: 60, max_results: 15, from: "app_config", day: "2026-10-12", used_today: 7, allowed_by_now: 461, quota_gone: false });
  assert.match(result.note, /not added to the day's count/);
  assert.deepEqual(log.writes, [], "nothing written — not the result, not the lock, not the remembered row, not a video");
  assert.equal(JSON.stringify(tables.app_config), snapshot);
  assert.equal(tables.youtube_videos.length, 1);
  const configRead = log.reads.find((r) => r.table === "app_config");
  assert.deepEqual(configRead.keys.slice().sort(), ["YT_API_KEY", HEALTH_KEY, SETTINGS_KEY, "yt_sub_channels_personal", "yt_sub_channels_scintilla"].sort(), "the key, the saved lists, the numbers and the remembered row — no OAuth secret, no refresh token");
  assert.equal(log.reads.filter((r) => r.table === "app_config").length, 1);
  assert.ok(!log.fetched.some((u) => u.includes("oauth2") || u.includes("/youtube/v3/videos") || u.includes("/shorts/")), "no sign-in, no videos call, no shorts check");
  assert.doesNotMatch(JSON.stringify(result) + JSON.stringify(log.fetched), new RegExp(KEY + "|NEVER-READ"));
  /* the same caps as a pass */
  const spent = await runSweep({ config: cfg({ scintilla: [DESK] }, { [HEALTH_KEY]: healthRow({ [DESK]: { ok: minAgo(95), f: 19 } }, { used: 461 }) }), query: "?dry=fallback",
    feeds: { [DESK]: NOT_FOUND }, uploads: { [DESK]: DESK_UPLOADS } });
  assert.deepEqual([spent.result.would_ask, spent.result.skipped_budget, spent.result.cap, spent.result.units_spent, spent.result.asked], [[], 1, "pace", 0, []]);
  const noKey = await runSweep({ config: cfg({ scintilla: [DESK] }).filter((r) => r.key !== "YT_API_KEY"), query: "?dry=fallback" });
  assert.deepEqual([noKey.result.error, noKey.log.fetched, noKey.log.writes], ["missing YouTube API key", [], []]);
});

test("?dry=fallback&channels=… — named channels are asked whatever their feed says, never more than the cap, never when it is off", async () => {
  const lists = { scintilla: [DESK, LEDGER, TAPE, TALK, RAIN] };
  const feeds = Object.fromEntries(lists.scintilla.map((id) => [id, feedXml("x", [])]));
  const uploads = { [DESK]: DESK_UPLOADS, [LEDGER]: uploadsBody(LEDGER, "Ledger Lines - Stocks and Investing", [{ id: "fxLedgerVs1", title: "Two retailers compared", published: "2026-10-08T02:28:00Z" }]),
    [TAPE]: uploadsBody(TAPE, "Morning Tape", [{ id: "fxTapeDaily", title: "8 Oct: the breakout fails", published: "2026-10-08T12:32:00Z" }]),
    [TALK]: uploadsBody(TALK, "Long Talks Radio", [{ id: "fxLongTalk1", title: "Long Talks #412 - a three-hour conversation", published: "2026-10-08T17:00:00Z" }]) };
  const named = [DESK, LEDGER, TAPE, TALK];
  const { result, log } = await runSweep({ config: cfg(lists), feeds, uploads, videos: [held({ id: "fxLongTalk1", title: "TALK #2563", published: "2026-10-08T17:00:00+00:00" }, TALK, "Long Talks Radio")],
    query: "?dry=fallback&channels=" + [...named, "junk", DESK].join(",") });
  assert.deepEqual([result.feeds_read, result.feed_unread, result.would_ask, result.skipped_budget, result.cap, result.units_spent], [4, 0, named, 0, null, 4], "only the named channels' feeds are read, and a name given twice is asked once");
  assert.deepEqual(result.asked.map((l) => [l.name, l.why, l.feed, l.outcome, l.videos, l.not_stored]), [
    ["Chart Desk Daily", "named in the call", "answered", "ok", 3, 3], ["Ledger Lines - Stocks and Investing", "named in the call", "answered", "ok", 1, 1],
    ["Morning Tape", "named in the call", "answered", "ok", 1, 1], ["Long Talks Radio", "named in the call", "answered", "ok", 1, 0]]);
  assert.deepEqual(log.writes, []);
  assert.equal(log.fetched.filter((u) => u.includes("/feeds/videos.xml")).length, 4);
  const capped = await runSweep({ config: cfg(lists, { [SETTINGS_KEY]: { per_pass: 2 } }), feeds, uploads, query: "?dry=fallback&channels=" + named.join(",") });
  assert.deepEqual([capped.result.would_ask, capped.result.skipped_budget, capped.result.cap, capped.result.cap_says, capped.result.units_spent], [named.slice(0, 2), 2, "pass", "the cap of 2 channels a pass", 2]);
  const off = await runSweep({ config: cfg(lists, { [SETTINGS_KEY]: { per_day: 0 } }), feeds, uploads, query: "?dry=fallback&channels=" + named.join(",") });
  assert.deepEqual([off.result.would_ask, off.result.cap, off.result.units_spent, uploadsAsked(off.log)], [[], "off", 0, []]);
  const gone = await runSweep({ config: cfg(lists, { [HEALTH_KEY]: healthRow({}, { quota_day: "2026-10-12" }) }), feeds, uploads, query: "?dry=fallback&channels=" + named.join(",") });
  assert.deepEqual([gone.result.would_ask, gone.result.cap, gone.result.units_spent], [[], "quota", 0]);
  const last = await runSweep({ config: cfg(lists, { [HEALTH_KEY]: healthRow({}, { used: 579 }) }), feeds, uploads, query: "?dry=fallback&channels=" + named.join(",") });
  assert.deepEqual([last.result.would_ask, last.result.skipped_budget, last.result.cap], [[DESK], 3, "day"], "one call left in the day: one channel");
});

test("the doors that were there are the doors they were: the schedule's call sweeps, ?dry=live and ?probe=live are untouched", async () => {
  for (const query of ["", "?dry=1", "?dry=fall", "?probe=fallback"]) {
    const { result, log } = await runSweep({ config: cfg({ scintilla: [TALK] }), feeds: { [TALK]: feedXml("Long Talks Radio", []) }, query });
    assert.ok(result.fallback && result.rss_channels === 1 && log.writes.some((w) => w.key === "yt_rss_result"), "a full sweep ran for " + JSON.stringify(query));
  }
  const sweep = code(RSS);
  assert.match(sweep, /if \(ask\.get\("probe"\) === "live"\)/); assert.match(sweep, /if \(ask\.get\("dry"\) === "live"\)/); assert.match(sweep, /if \(ask\.get\("dry"\) === "fallback"\)/);
  assert.match(sweep, /if \(!r \|\| !r\.ok\) \{ rssFailed\+\+; return; \}/, "Y1's count of feeds that do not answer is the line it was");
  assert.match(sweep, /running\.ts && now - running\.ts < 180/, "the 180 s lock is still the sweep's");
  assert.ok(FALLBACK_LIMITS.per_pass[1] * 1 <= 25 && UPLOADS_TIMEOUT_MS <= 8000, "the second way adds at most 8 s to a pass: its calls go together, each bounded");
});

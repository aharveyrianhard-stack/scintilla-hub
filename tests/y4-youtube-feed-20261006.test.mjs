/* Y4 (6 Oct) — "Tyler Wilson … is on a live video. The live video is not on my grid at all … Verified Investing
   slips through the cracks … it depended on when the video was scheduled or released … Everything subscribed."
   The four rules the collector gained, each run through the sweep itself against an in-memory table (no network:
   the pages, the channel feeds and the YouTube API are fixtures written here). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { onAirPlan, watchableStart, refreshOrder, keepSubscribed, ON_AIR_PER_PASS, ON_AIR_ALWAYS_MAX, STREAMER_DAYS,
  UPCOMING_BACK_DAYS, UPCOMING_MAX, ON_AIR_BUDGET_MS, PAGE_TIMEOUT_MS, LIVE_EVERY_MIN } from "../supabase/functions/_shared/yt-bridge.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RSS = fs.readFileSync(path.join(ROOT, "supabase/functions/yt-rss-sweep/index.ts"), "utf8");
const TYLER = "UCJ5A7RbiS35ilqUU3-ioSPw", VERIFIED = "UCZ-J2m1AUSLnifUEKam5_dA", ARETE = "UCTeFsS-bP0XEt3NBMjfW2cA";
const QUIET = "UCFMgf_GvoNTU1Vt7IgRaaWg", WOLF = "UCvTUPg9PxLq3DO72AZBygNg";
const ch = (i) => "UC" + String(i).padStart(22, "0");

/* ---------- the rules, alone ---------- */
test("who is asked 'are you on air?': the bridged channels and every carried channel that streams, each check; the rest in turn", () => {
  const carried = [TYLER, VERIFIED, QUIET, ...Array.from({ length: 200 }, (_, i) => ch(i))];
  const plan = onAirPlan({ bridgeIds: [WOLF], carried, streamers: [TYLER, VERIFIED, "UCnotcarried0000000000000"], cursor: 0 });
  assert.deepEqual(plan.pick.slice(0, 3), [WOLF, TYLER, VERIFIED], "bridged first, then the streamers we carry — a streamer we do not carry is not asked");
  assert.equal(plan.pick.length, ON_AIR_PER_PASS);
  assert.equal(new Set(plan.pick).size, plan.pick.length, "nobody is asked twice in a pass");
  assert.equal(plan.always, 3);
  /* the others take turns: every carried channel is asked within full_round_checks checks */
  const asked = new Set(); let cursor = 0;
  for (let i = 0; i < plan.full_round_checks; i++) { const p = onAirPlan({ bridgeIds: [WOLF], carried, streamers: [TYLER, VERIFIED], cursor }); p.pick.forEach((id) => asked.add(id)); cursor = p.cursor; }
  assert.equal(asked.size, carried.length + 1, "the whole list in " + plan.full_round_checks + " checks");
  assert.equal(plan.full_round_checks, 2);
  /* a short list is asked whole, every check */
  const small = onAirPlan({ bridgeIds: [], carried: [TYLER, QUIET], streamers: [] });
  assert.deepEqual([small.pick.sort(), small.waiting, small.full_round_checks], [[TYLER, QUIET].sort(), 0, 1]);
  assert.deepEqual(onAirPlan({}).pick, []);
});
test("the neighbours: the wider check still fits the pass's 45 s, the schedule's 120 s wait and the sweep's 180 s lock", () => {
  /* pages are read 8 at a time, each bounded by PAGE_TIMEOUT_MS; a pass out of time writes the rest down as not reached */
  assert.ok(ON_AIR_ALWAYS_MAX <= ON_AIR_PER_PASS);
  assert.ok(ON_AIR_BUDGET_MS + PAGE_TIMEOUT_MS < 120000, "the slowest pass ends inside the schedule's wait");
  assert.ok(ON_AIR_BUDGET_MS + PAGE_TIMEOUT_MS < 180000, "and inside the busy lock");
  assert.equal(LIVE_EVERY_MIN, 20, "the cadence is what it was");
  assert.match(RSS, /\.slice\(0, REFRESH_MAX\)/, "the rows re-asked about stay inside the old bound — no extra YouTube API call");
  assert.ok(UPCOMING_MAX <= 200 && STREAMER_DAYS >= 7 && UPCOMING_BACK_DAYS >= 1);
});
test("when it became watchable: YouTube's start; else the start we already hold; else, for a stream on air, now — never for an upload", () => {
  const nowIso = "2026-10-06T12:10:04.000Z";
  assert.equal(watchableStart({ broadcast: "live", actualStart: "2026-10-06T12:01:43Z", storedStart: "x", nowIso }), "2026-10-06T12:01:43Z");
  assert.equal(watchableStart({ broadcast: "live", actualStart: null, storedStart: "2026-10-06T12:05:00Z", nowIso }), "2026-10-06T12:05:00Z", "written once, never moved");
  assert.equal(watchableStart({ broadcast: "live", actualStart: null, storedStart: null, nowIso }), nowIso);
  assert.equal(watchableStart({ broadcast: "none", actualStart: null, storedStart: null, nowIso }), null);
  assert.equal(watchableStart({ broadcast: "upcoming", actualStart: null, storedStart: null, nowIso }), null);
});
test("the order rows are re-asked in: just found on air, then said-live, then scheduled streams, then the recent rows — inside the bound", () => {
  assert.deepEqual(refreshOrder({ found: ["a"], stillLive: ["b", "a"], upcoming: ["c"], recent: ["d", "c"], max: 3 }), ["a", "b", "c"]);
  assert.equal(keepSubscribed({ title: "日本語" }, "ja"), true);
});

/* ---------- the sweep itself ---------- */
function db(config, videos) {
  const log = { upserts: [], updates: [], fetched: [] };
  const tables = { app_config: config, youtube_videos: videos };
  function query(table) {
    const q = { filters: [], op: "select", payload: null, lim: null };
    const rowsOf = () => tables[table].filter((row) => q.filters.every((f) => f(row)));
    const run = () => {
      if (q.op === "upsert") {
        const key = table === "app_config" ? "key" : "video_id";
        for (const row of [].concat(q.payload)) {
          const i = tables[table].findIndex((r) => r[key] === row[key]);
          if (i >= 0) tables[table][i] = { ...tables[table][i], ...row }; else tables[table].push({ ...row });
          log.upserts.push({ table, row });
        }
        return { data: null, error: null };
      }
      if (q.op === "update") { for (const row of rowsOf()) { Object.assign(row, q.payload); log.updates.push({ table, id: row.video_id || row.key, set: q.payload }); } return { data: null, error: null }; }
      let rows = rowsOf(); if (q.lim != null) rows = rows.slice(0, q.lim);
      return { data: rows.map((r) => ({ ...r })), error: null };
    };
    const api = {
      select: () => api, order: () => api, limit: (n) => { q.lim = n; return api; },
      in: (k, list) => { q.filters.push((r) => list.includes(r[k])); return api; },
      eq: (k, v) => { q.filters.push((r) => r[k] === v); return api; },
      gte: (k, v) => { q.filters.push((r) => r[k] != null && new Date(r[k]).toISOString() >= new Date(v).toISOString()); return api; },
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
async function runSweep({ config, videos = [], rss = {}, live = {}, api = {} }) {
  const store = db(config, videos);
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url); store.log.fetched.push(u.replace(/key=[^&]+/, "key=…"));
    const answer = (status, body) => ({ ok: status >= 200 && status < 300, status, url: u, text: async () => body, json: async () => JSON.parse(body) });
    if (u.includes("/feeds/videos.xml")) return answer(200, rss[u.split("channel_id=")[1]] || "<feed><name>x</name></feed>");
    if (u.includes("googleapis.com/youtube/v3/videos")) {
      const ids = decodeURIComponent(u.match(/[?&]id=([^&]+)/)[1]).split(",");
      return answer(200, JSON.stringify({ items: ids.filter((id) => api[id]).map((id) => ({ id, ...api[id] })) }));
    }
    if (u.endsWith("/live")) { const id = u.split("/channel/")[1].replace("/live", ""); return answer(200, live[id] ?? channelPage(id)); }
    if (u.endsWith("/streams")) return answer(200, channelPage(u.split("/channel/")[1].replace("/streams", "")));
    if (u.includes("/shorts/")) return answer(303, "");
    if (u.includes("oauth2.googleapis.com")) return answer(400, JSON.stringify({ error: "invalid_grant" }));
    throw new Error("unexpected request " + u);
  };
  globalThis.__y2 = { createClient: () => store.client };
  globalThis.Deno = { env: { get: (k) => ({ SUPABASE_URL: "http://db.test", SUPABASE_SERVICE_ROLE_KEY: "test" })[k] || "" }, serve: (h) => { globalThis.__y2.handler = h; } };
  const js = stripTypeScriptTypes(RSS, { mode: "strip" })
    .replace(/import \{ createClient \} from "https:\/\/esm\.sh\/[^"]+";/, "const { createClient } = globalThis.__y2;")
    .replace('"../_shared/yt-bridge.mjs"', JSON.stringify(pathToFileURL(path.join(ROOT, "supabase/functions/_shared/yt-bridge.mjs")).href));
  const file = path.join(os.tmpdir(), "y4-sweep-" + process.pid + "-" + (harnessCount++) + ".mjs");
  fs.writeFileSync(file, js);
  try {
    await import(pathToFileURL(file).href);
    const response = await globalThis.__y2.handler();
    return { result: await response.json(), ...store };
  } finally { globalThis.fetch = realFetch; fs.unlinkSync(file); delete globalThis.Deno; }
}
const livePage = (video, channel, name) => '<html><head><link rel="canonical" href="https://www.youtube.com/watch?v=' + video + '"></head><body><script>var ytInitialPlayerResponse = {"playabilityStatus":{"status":"OK"},"videoDetails":{"videoId":"' + video + '","title":"Stock Market LIVE","channelId":"' + channel + '","author":"' + name + '","isLiveContent":true,"isLive":true}};</script></body></html>';
const channelPage = (id) => '<html><head><link rel="canonical" href="https://www.youtube.com/channel/' + id + '"><meta property="og:title" content="A channel"></head><body>"externalId":"' + id + '"</body></html>';
const entry = (id, title, published) => "<entry><yt:videoId>" + id + "</yt:videoId><title>" + title + "</title><published>" + published + '</published><media:thumbnail url="https://i.ytimg.com/vi/' + id + '/hqdefault.jpg"/></entry>';
const feed = (name, ...entries) => "<feed><name>" + name + "</name>" + entries.join("") + "</feed>";
const nowSec = () => Math.floor(Date.now() / 1000);
const ago = (hours) => new Date(Date.now() - hours * 3600000).toISOString();
const cfg = (lists, extra = {}) => Object.entries({ YT_API_KEY: "test-key",
  ...Object.fromEntries(Object.entries(lists).map(([account, ids]) => ["yt_sub_channels_" + account, JSON.stringify({ ids, ts: nowSec() })])), ...extra,
}).map(([key, value]) => ({ key, value }));

test("TYLER WILSON: a subscribed channel that is not bridged goes on air, YouTube's feed has not listed it yet → the on-air check puts it in the feed", async () => {
  const { result, tables } = await runSweep({
    config: cfg({ scintilla: [TYLER, QUIET], personal: [TYLER] }),      /* no bridge row at all */
    rss: { [TYLER]: feed("Tyler Wilson Investing", entry("9x__5-Lz1U8", "THE END Tomorrow", ago(16))) },   /* the stream is not in the feed yet */
    live: { [TYLER]: livePage("PGzloCU5odg", TYLER, "Tyler Wilson Investing") },
    api: { PGzloCU5odg: { snippet: { liveBroadcastContent: "live" }, contentDetails: { duration: "P0D" }, liveStreamingDetails: { actualStartTime: "2026-10-06T12:01:43Z" } },
           "9x__5-Lz1U8": { snippet: { liveBroadcastContent: "none" }, contentDetails: { duration: "PT12M10S" } } },
  });
  assert.equal(result.bridge.channels, 0);
  assert.deepEqual(result.bridge.live_check.on_air, ["PGzloCU5odg"]);
  assert.equal(result.bridge.live_check.checked, 2, "both carried channels were asked");
  const row = tables.youtube_videos.find((r) => r.video_id === "PGzloCU5odg");
  assert.deepEqual([row.channel_id, row.live_broadcast, row.live_started_at, row.subscription_accounts], [TYLER, "live", "2026-10-06T12:01:43Z", ["personal", "scintilla"]],
    "filed under the accounts that carry the channel, at its real start");
  const stored = JSON.parse(tables.app_config.find((r) => r.key === "yt_bridge_live").value);
  assert.deepEqual([stored.asked.always, stored.asked.in_turn, stored.asked.waiting], [0, 2, 0]);
  assert.doesNotMatch(JSON.stringify(result) + JSON.stringify(stored), /test-key/);
});
test("a carried channel that streamed in the last 30 days is asked every check, ahead of the ones that never have", async () => {
  const many = Array.from({ length: 130 }, (_, i) => ch(i));
  const { result, log } = await runSweep({
    config: cfg({ scintilla: [...many, TYLER] }),
    videos: [{ video_id: "jYQkbUoS36s", channel_id: TYLER, title: "My Broadcast", published_at: ago(24), duration_sec: 2871, live_broadcast: "none", live_started_at: ago(24), subscription_accounts: ["scintilla"] }],
  });
  const asked = log.fetched.filter((u) => u.endsWith("/live"));
  assert.equal(asked.length, ON_AIR_PER_PASS);
  assert.equal(asked[0], "https://www.youtube.com/channel/" + TYLER + "/live", "the streamer is first in line");
  assert.deepEqual(result.bridge.live_check.asked, { always: 1, in_turn: ON_AIR_PER_PASS - 1, waiting: 131 - ON_AIR_PER_PASS, full_round_checks: 2 });
});
test("VERIFIED INVESTING / ARETE: a stream scheduled days ahead is re-asked about by its START time — it turns live though its publish date is a week old", async () => {
  const sched = ago(0.05);
  const { tables, log } = await runSweep({
    config: cfg({ scintilla: [ARETE] }, { yt_bridge_live: JSON.stringify({ last_ms: Date.now() - 60000 }) }),   /* the on-air check is not due: only the stored row can save it */
    videos: [{ video_id: "TwYmPwGhmkE", channel_id: ARETE, title: "PREMARKET LIVE", published_at: ago(24 * 5.5), duration_sec: null, live_broadcast: "upcoming", live_started_at: null, live_scheduled_at: sched, live_checked_ts: nowSec() - 2.5 * 86400, subscription_accounts: ["scintilla"] }],
    api: { TwYmPwGhmkE: { snippet: { liveBroadcastContent: "live" }, contentDetails: { duration: "P0D" }, liveStreamingDetails: { actualStartTime: sched, scheduledStartTime: sched } } },
  });
  assert.equal(log.fetched.filter((u) => u.endsWith("/live")).length, 0);
  const row = tables.youtube_videos[0];
  assert.deepEqual([row.live_broadcast, row.live_started_at], ["live", sched]);
});
test("a scheduled stream whose start passed more than three days ago is left alone (a cancelled stream is not asked about for ever)", async () => {
  const { tables, log } = await runSweep({
    config: cfg({ scintilla: [ARETE] }, { yt_bridge_live: JSON.stringify({ last_ms: Date.now() - 60000 }) }),
    videos: [{ video_id: "9s1VdCoKZjA", channel_id: ARETE, title: "old", published_at: ago(24 * 10), duration_sec: null, live_broadcast: "upcoming", live_scheduled_at: ago(24 * 9), live_checked_ts: 1, subscription_accounts: ["scintilla"] }],
  });
  assert.equal(log.fetched.filter((u) => u.includes("/youtube/v3/videos")).length, 0);
  assert.equal(tables.youtube_videos[0].live_checked_ts, 1);
});
test("YouTube says live and gives no start time: the first moment we saw it live is its start, and a later pass does not move it", async () => {
  const item = { snippet: { liveBroadcastContent: "live" }, contentDetails: { duration: "P0D" }, liveStreamingDetails: {} };
  const before = Date.now();
  const first = await runSweep({
    config: cfg({ scintilla: [VERIFIED] }), rss: { [VERIFIED]: feed("Verified Investing", entry("8oCPuyVdKVM", "My Trading Game Plan", ago(17))) }, api: { "8oCPuyVdKVM": item },
  });
  const row = first.tables.youtube_videos[0];
  assert.equal(row.live_broadcast, "live");
  assert.ok(Date.parse(row.live_started_at) >= before - 1000 && Date.parse(row.live_started_at) <= Date.now(), "first seen live = now, not the publish time 17 hours ago");
  const held = "2026-10-06T13:01:00.000Z";
  const second = await runSweep({
    config: cfg({ scintilla: [VERIFIED] }, { yt_bridge_live: JSON.stringify({ last_ms: Date.now() - 60000 }) }),
    videos: [{ ...row, live_started_at: held }], api: { "8oCPuyVdKVM": item },
  });
  assert.equal(second.tables.youtube_videos[0].live_started_at, held, "the start we hold is kept");
  /* and when YouTube does give the time, YouTube's time wins */
  const third = await runSweep({
    config: cfg({ scintilla: [VERIFIED] }, { yt_bridge_live: JSON.stringify({ last_ms: Date.now() - 60000 }) }),
    videos: [{ ...row, live_started_at: held }], api: { "8oCPuyVdKVM": { ...item, liveStreamingDetails: { actualStartTime: "2026-10-06T13:00:57Z" } } },
  });
  assert.equal(third.tables.youtube_videos[0].live_started_at, "2026-10-06T13:00:57Z");
});
test("an ordinary upload gets no invented start, and a stream that ended keeps the start YouTube gave", async () => {
  const { tables } = await runSweep({
    config: cfg({ scintilla: [TYLER] }, { yt_bridge_live: JSON.stringify({ last_ms: Date.now() - 60000 }) }),
    rss: { [TYLER]: feed("Tyler Wilson Investing", entry("9x__5-Lz1U8", "THE END Tomorrow", ago(16)), entry("PGzloCU5odg", "Stock Market LIVE", ago(1))) },
    api: { "9x__5-Lz1U8": { snippet: { liveBroadcastContent: "none" }, contentDetails: { duration: "PT12M10S" } },
           PGzloCU5odg: { snippet: { liveBroadcastContent: "none" }, contentDetails: { duration: "PT56M49S" }, liveStreamingDetails: { actualStartTime: "2026-10-06T12:01:43Z", actualEndTime: "2026-10-06T12:58:33Z" } } },
  });
  const upload = tables.youtube_videos.find((r) => r.video_id === "9x__5-Lz1U8"), stream = tables.youtube_videos.find((r) => r.video_id === "PGzloCU5odg");
  assert.deepEqual([upload.live_started_at, upload.duration_sec], [null, 730]);
  assert.deepEqual([stream.live_started_at, stream.live_ended_at, stream.duration_sec], ["2026-10-06T12:01:43Z", "2026-10-06T12:58:33Z", 3409]);
});
test("EVERYTHING SUBSCRIBED: a carried channel's video is kept whatever its language tag or its title's script", async () => {
  const { result, tables } = await runSweep({
    config: cfg({ scintilla: [QUIET] }, { yt_bridge_live: JSON.stringify({ last_ms: Date.now() - 60000 }) }),
    rss: { [QUIET]: feed("A channel", entry("aaaaaaaaaaa", "Micron, WDC &amp; Seagate", ago(11)), entry("bbbbbbbbbbb", "マイクロン 決算", ago(12))) },
    api: { aaaaaaaaaaa: { snippet: { liveBroadcastContent: "none", defaultAudioLanguage: "ko" }, contentDetails: { duration: "PT10M" } },
           bbbbbbbbbbb: { snippet: { liveBroadcastContent: "none", defaultAudioLanguage: "ja" }, contentDetails: { duration: "PT9M" } } },
  });
  assert.deepEqual(tables.youtube_videos.map((r) => r.video_id).sort(), ["aaaaaaaaaaa", "bbbbbbbbbbb"]);
  assert.deepEqual([result.new_videos, result.dropped], [2, 0]);
  assert.equal(tables.youtube_videos.find((r) => r.video_id === "aaaaaaaaaaa").title, "Micron, WDC & Seagate");
});
test("no key in the sources, and the search collector's own filters are untouched", () => {
  const feedFn = fs.readFileSync(path.join(ROOT, "supabase/functions/youtube-feed/index.ts"), "utf8");
  assert.match(feedFn, /FOREIGN\.test/, "the ticker search still drops strangers' foreign-script titles");
  assert.doesNotMatch(RSS + fs.readFileSync(path.join(ROOT, "supabase/functions/_shared/yt-bridge.mjs"), "utf8"), /AIza[0-9A-Za-z_-]{20,}|eyJhbGciOi/, "no key in any source");
});
test("MARKET SIGNAL: the staged list change is additive, names one channel, and has its way back", () => {
  const up = fs.readFileSync(path.join(ROOT, "staged/y4-youtube/01_market_signal_back_on_the_scintilla_list.sql"), "utf8").replace(/--.*$/mg, "");
  const down = fs.readFileSync(path.join(ROOT, "staged/y4-youtube/01_market_signal_back_on_the_scintilla_list_ROLLBACK.sql"), "utf8").replace(/--.*$/mg, "");
  assert.doesNotMatch(up, /\b(drop|truncate|delete|alter|grant)\b/i, "additive only");
  assert.deepEqual([...new Set(up.match(/UC[A-Za-z0-9_-]{22}/g))], ["UCLSjYYwAX9cJKSxbUChPNKQ"]);
  assert.match(up, /not \(\(value::jsonb -> 'ids'\) \? 'UCLSjYYwAX9cJKSxbUChPNKQ'\)/, "applying twice changes nothing");
  assert.match(down, /yt_sub_channels_scintilla/);
  const lost = JSON.parse(fs.readFileSync(path.join(ROOT, "deliverables/20261006/y4-youtube-feed/data/lost-channels.json"), "utf8"));
  const ms = lost.lost.find((c) => c.id === "UCLSjYYwAX9cJKSxbUChPNKQ");
  assert.deepEqual([ms.title, ms.absent, ms.accounts], ["Market Signal", 15, ["scintilla"]], "the measurement the change rests on");
});

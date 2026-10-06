/* Y2 (5 Oct) — the X accounts' YouTube channels ride with the SCINTILLA feed, and a channel on air shows up now.
   No network: the pages, the RSS and the YouTube API are fixtures written here; the sweep function itself is run
   (types stripped, its two imports swapped for an in-memory table and the shared rules file). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseChannelPage, parseWatchPage, parseLivePage, youtubeRefs, sameName, confidence, bridgeChannelIds, withBridge,
  liveProbeDue, liveProbePick, liveCandidateRow, subscriberCount, isChannelId, FEED_CONFIDENCE, MAX_LIVE_PROBES, LIVE_EVERY_MIN,
  SAME_HANDLE_MIN_SUBSCRIBERS } from "../supabase/functions/_shared/yt-bridge.mjs";
import { COST_PER_SEARCH, SEARCH_BUDGET_UNITS, DAILY_QUOTA } from "../supabase/functions/_shared/yt-search-plan.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const BRIDGE = JSON.parse(read("control/YOUTUBE_CHANNEL_BRIDGE.json"));
const RSS = read("supabase/functions/yt-rss-sweep/index.ts");
const CFG = read("supabase/functions/yt-config/index.ts");
const FEED = read("supabase/functions/youtube-feed/index.ts");
const WOLF = "UCvTUPg9PxLq3DO72AZBygNg";
const OTHER = "UCaqenTegMoW98A4trRofR1A";
const OWN = "UCFMgf_GvoNTU1Vt7IgRaaWg";

/* ---------- the pages ---------- */
const livePage = (video, extra = '"isLive":true') => '<html><head><link rel="canonical" href="https://www.youtube.com/watch?v=' + video + '"></head><body><script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"' + video + '","title":"RISK ON MARKET? TRADERS AREN\'T FULLY CONVINCED \\u0026 MORE","lengthSeconds":"0","channelId":"' + WOLF + '","isLiveContent":true},"microformat":{"ownerChannelName":"WOLF Trading","liveBroadcastDetails":{' + extra + '}},"originalViewCount":"354"};</script></body></html>';
const channelPage = (id) => '<html><head><link rel="canonical" href="https://www.youtube.com/channel/' + id + '"><meta property="og:title" content="WOLF Trading"></head><body>"externalId":"' + id + '","vanityChannelUrl":"http://www.youtube.com/@wolf_tradingx" 5.74K subscribers</body></html>';

test("a /live address: on air, still to come, off, and a page we could not read", () => {
  const on = parseLivePage(livePage("MqOnx6420No"));
  assert.deepEqual([on.state, on.video_id, on.viewers, on.channel_title], ["live", "MqOnx6420No", 354, "WOLF Trading"]);
  assert.equal(on.title, "RISK ON MARKET? TRADERS AREN'T FULLY CONVINCED & MORE", "the page's escapes are decoded");
  assert.equal(parseLivePage(livePage("MqOnx6420No", '"isUpcoming":true')).state, "upcoming", "a stream still to come is not on air");
  assert.equal(parseLivePage(livePage("MqOnx6420No", '"isLive":false')).state, "off", "a finished stream's watch page is not on air");
  assert.equal(parseLivePage(channelPage(WOLF)).state, "off", "not streaming: the channel page comes back");
  assert.equal(parseLivePage("").state, "unknown");
  assert.equal(parseLivePage("<html>Before you continue to YouTube consent.youtube.com</html>").state, "unknown", "a consent wall is not 'off'");
  assert.equal(parseLivePage("<html><title>429</title></html>").state, "unknown");
});

test("a channel page and a watch page say who they are", () => {
  assert.deepEqual(parseChannelPage(channelPage(WOLF)), { channel_id: WOLF, title: "WOLF Trading", handle: "wolf_tradingx", subscribers: 5740 });
  assert.equal(parseChannelPage("<html>nothing</html>"), null);
  assert.equal(parseWatchPage(livePage("MqOnx6420No")).channel_id, WOLF);
  assert.equal(subscriberCount("418K subscribers"), 418000);
  assert.equal(subscriberCount("1.2M subscribers"), 1200000);
  assert.equal(subscriberCount("no figure"), null);
});

test("the YouTube references in a post", () => {
  const refs = youtubeRefs("live https://www.youtube.com/live/q-tQ-u6Lch4?is=k https://youtu.be/XiuObVUtyHI?si=2 https://youtube.com/@wolf_tradingx and https://www.youtube.com/channel/" + WOLF + " https://www.youtube.com/watch?feature=x&v=VVDWqWcKG3Y");
  assert.deepEqual(refs.videos, ["q-tQ-u6Lch4", "VVDWqWcKG3Y", "XiuObVUtyHI"].sort((a, b) => refs.videos.indexOf(a) - refs.videos.indexOf(b)));
  assert.equal(refs.videos.length, 3);
  assert.deepEqual(refs.channels, ["@wolf_tradingx", "channel/" + WOLF]);
});

/* ---------- how sure ---------- */
test("names: the same thing said two ways matches; a stranger does not", () => {
  assert.equal(sameName("WOLF_TradingX", "WOLF Trading"), true);
  assert.equal(sameName("kingcobratrader", "KingCobraTrades"), true);
  assert.equal(sameName("ripster47", "Ripster , Tenet Trade Group"), true);
  assert.equal(sameName("JesseOlson", "Grant"), false);
  assert.equal(sameName("TheRoaringKitty", "ABlazinGrace"), false);
  assert.equal(sameName("abc", "abc"), false, "three letters prove nothing");
});

test("a same-handle channel alone is never a match — handles are first come, first served", () => {
  assert.equal(confidence({ same_handle: true }), "low");
  assert.equal(confidence({ same_handle: true, name_match: true, subscribers: 6 }), "low", "Beth_Kindig's look-alike with 6 subscribers");
  assert.equal(confidence({ same_handle: true, name_match: true, subscribers: SAME_HANDLE_MIN_SUBSCRIBERS }), "medium");
  assert.equal(confidence({ same_handle: true, backlink: true }), "high", "the channel links back to the X account");
  assert.equal(confidence({ self_link: true, own_videos_channel: 8, own_videos_total: 8, name_match: true }), "high");
  assert.equal(confidence({ own_videos_channel: 1, own_videos_total: 1 }), "low", "one shared video is somebody else's video");
  assert.equal(confidence({ own_videos_channel: 1, own_videos_total: 3, name_match: true }), "low", "CNBC shared once is not the account's channel");
  assert.equal(confidence({ own_videos_channel: 8, own_videos_total: 8 }), "medium");
  assert.deepEqual(FEED_CONFIDENCE, ["high", "medium"]);
});

/* ---------- the bridge file ---------- */
test("the bridge file: WOLF Trading first among equals, every id well formed, low matches kept out of the feed", () => {
  assert.equal(BRIDGE.schema, "scintilla.youtube_channel_bridge.v1");
  assert.equal(BRIDGE.source.follow_list_stored, false, "the file says the follow list is not what it was built from");
  const wolf = BRIDGE.channels.find((r) => r.x_handle.toLowerCase() === "wolf_tradingx");
  assert.ok(wolf, "WOLF Trading is in the bridge");
  assert.deepEqual([wolf.channel_id, wolf.confidence, wolf.in_feed], [WOLF, "high", true]);
  for (const r of BRIDGE.channels) {
    assert.match(r.x_handle, /^[A-Za-z0-9_]{1,15}$/);
    assert.ok(r.how_found && r.how_found.length > 10, r.x_handle + " says how it was found");
    if (r.channel_id !== null) assert.ok(isChannelId(r.channel_id), r.x_handle);
    if (r.confidence === "low" || r.confidence === "none") assert.ok(!r.in_feed, r.x_handle + " is not added");
  }
  assert.equal(BRIDGE.channels.length, BRIDGE.counts.accounts);
  assert.equal(new Set(BRIDGE.channels.map((r) => r.x_handle.toLowerCase())).size, BRIDGE.channels.length, "one row per account");
  const ids = bridgeChannelIds(BRIDGE);
  assert.ok(ids.includes(WOLF));
  assert.equal(ids.length, new Set(BRIDGE.channels.filter((r) => r.in_feed).map((r) => r.channel_id)).size, "two accounts on one channel add it once");
  for (const r of BRIDGE.channels.filter((x) => x.confidence === "low")) {
    if (!BRIDGE.channels.some((x) => x.in_feed && x.channel_id === r.channel_id)) assert.ok(!ids.includes(r.channel_id), r.x_handle);
  }
});

test("the migration carries exactly the bridge file's channels, and its rollback names the same rows", () => {
  const up = read("supabase/migrations/20261005_youtube_channel_bridge.sql");
  const down = read("supabase/migrations/20261005_youtube_channel_bridge_ROLLBACK.sql");
  const value = JSON.parse(up.match(/\$bridge\$([\s\S]*?)\$bridge\$/)[1]);
  assert.deepEqual(value.ids, bridgeChannelIds(BRIDGE));
  assert.match(up, /insert into public\.app_config/);
  assert.doesNotMatch(up.replace(/--.*$/mg, ""), /\b(drop|truncate|delete|alter)\b/i, "additive only");
  assert.match(down, /delete from public\.app_config where key in \('yt_bridge_channels', 'yt_bridge_live'\)/);
  assert.doesNotMatch(up + down, /AIza[0-9A-Za-z_-]{20,}|eyJ[A-Za-z0-9_-]{20,}/, "no key in either file");
});

test("our own list plus the bridge: additive, no duplicates, junk ignored", () => {
  assert.deepEqual(withBridge([OWN, WOLF], [WOLF, OTHER, "not-an-id", null]), [OWN, WOLF, OTHER]);
  assert.deepEqual(withBridge([OWN], []), [OWN], "no bridge row: the list is exactly what it was");
  assert.deepEqual(bridgeChannelIds(null), []);
  assert.deepEqual(bridgeChannelIds({ ids: [WOLF, WOLF, "x"] }), [WOLF]);
  assert.deepEqual(bridgeChannelIds({ channels: [{ channel_id: WOLF, confidence: "high" }, { channel_id: OTHER, confidence: "low" }] }), [WOLF]);
});

/* ---------- the on-air check's pacing ---------- */
test("the on-air check runs every 20 minutes off the 5-minute sweep, and gives every channel its turn", () => {
  assert.equal(LIVE_EVERY_MIN, 20);
  const t0 = Date.UTC(2026, 9, 5, 19, 20);
  assert.equal(liveProbeDue(t0, 0), true, "never run: due");
  assert.equal(liveProbeDue(t0 + 5 * 60000, t0), false);
  assert.equal(liveProbeDue(t0 + 15 * 60000, t0), false);
  assert.equal(liveProbeDue(t0 + 20 * 60000, t0), true);
  assert.equal(liveProbeDue(t0 + 20 * 60000 - 4000, t0), true, "a cron that fires a few seconds early is still the 20-minute run");
  let runs = 0; let last = 0;
  for (let m = 0; m < 1440; m += 5) if (liveProbeDue(t0 + m * 60000, last)) { runs++; last = t0 + m * 60000; }
  assert.equal(runs, 72, "72 checks a day");
  const many = Array.from({ length: 150 }, (_, i) => "UC" + String(i).padStart(22, "0"));
  const seen = new Set(); let cursor = 0;
  for (let i = 0; i < 3; i++) { const p = liveProbePick(many, cursor); assert.ok(p.pick.length <= MAX_LIVE_PROBES); p.pick.forEach((id) => seen.add(id)); cursor = p.cursor; }
  assert.equal(seen.size, 150, "150 channels are all read within three passes");
  assert.deepEqual(liveProbePick([], 5), { pick: [], cursor: 0 });
});

/* ---------- the neighbours: Y1's quota rule still holds ---------- */
test("the bridge and the on-air check spend no search quota, and the day still fits", () => {
  const code = RSS.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/mg, "");
  assert.doesNotMatch(code, /search\?/, "the sweep never calls search.list (100 units)");
  assert.doesNotMatch(code, /eventType=live/, "no live search");
  assert.match(code, /\.slice\(0, REFRESH_MAX\)/, "the rows re-asked about stay inside the old bound");
  assert.match(code, /const REFRESH_MAX = 200;/);
  const searches = Math.floor(SEARCH_BUDGET_UNITS / COST_PER_SEARCH) * COST_PER_SEARCH;        // 79 × 101 = 7,979 (Y1, unchanged)
  const sweepWorst = 288 * (1 + 200 / 50);                                                    // every pass: one new-video call + four refresh calls
  assert.equal(searches, 7979);
  assert.ok(searches + sweepWorst <= DAILY_QUOTA, "worst case " + (searches + sweepWorst) + " of " + DAILY_QUOTA);
  assert.match(FEED, /planRun\(/, "youtube-feed's RADAR plan is untouched");
  assert.doesNotMatch(FEED, /yt-bridge/, "the search collector does not read the bridge");
  assert.doesNotMatch(RSS + CFG + read("supabase/functions/_shared/yt-bridge.mjs") + read("scripts/yt-bridge-resolve.mjs"), /AIza[0-9A-Za-z_-]{20,}/, "no key in any source");
});

/* ---------- the sweep itself, run against an in-memory table ---------- */
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
async function runSweep({ config, videos, pages, api }) {
  const store = db(config, videos);
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url); store.log.fetched.push(u.replace(/key=[^&]+/, "key=…"));
    const answer = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => body, json: async () => JSON.parse(body) });
    if (u.includes("/feeds/videos.xml")) return answer(200, pages.rss[u.split("channel_id=")[1]] || "<feed><name>x</name></feed>");
    if (u.includes("googleapis.com/youtube/v3/videos")) {
      const ids = decodeURIComponent(u.match(/[?&]id=([^&]+)/)[1]).split(",");
      return answer(200, JSON.stringify({ items: ids.filter((id) => api[id]).map((id) => ({ id, ...api[id] })) }));
    }
    if (u.endsWith("/live")) return answer(200, pages.live[u.split("/channel/")[1].replace("/live", "")] ?? "");
    if (u.includes("/shorts/")) return answer(303, "");
    if (u.includes("oauth2.googleapis.com")) return answer(400, JSON.stringify({ error: "invalid_grant" }));
    throw new Error("unexpected request " + u);
  };
  globalThis.__y2 = { createClient: () => store.client };
  globalThis.Deno = { env: { get: (k) => ({ SUPABASE_URL: "http://db.test", SUPABASE_SERVICE_ROLE_KEY: "test" })[k] || "" }, serve: (h) => { globalThis.__y2.handler = h; } };
  const js = stripTypeScriptTypes(RSS, { mode: "strip" })
    .replace(/import \{ createClient \} from "https:\/\/esm\.sh\/[^"]+";/, "const { createClient } = globalThis.__y2;")
    .replace('"../_shared/yt-bridge.mjs"', JSON.stringify(pathToFileURL(path.join(ROOT, "supabase/functions/_shared/yt-bridge.mjs")).href));
  const file = path.join(os.tmpdir(), "y2-sweep-" + process.pid + "-" + (harnessCount++) + ".mjs");
  fs.writeFileSync(file, js);
  try {
    await import(pathToFileURL(file).href);
    const response = await globalThis.__y2.handler();
    return { result: await response.json(), ...store };
  } finally { globalThis.fetch = realFetch; fs.unlinkSync(file); delete globalThis.Deno; }
}
const cfg = (extra = {}) => Object.entries({
  YT_API_KEY: "test-key", yt_sub_channels_scintilla: JSON.stringify({ ids: [OWN], ts: Math.floor(Date.now() / 1000) }), ...extra,
}).map(([key, value]) => ({ key, value }));
const liveItem = { snippet: { liveBroadcastContent: "live", defaultAudioLanguage: "en" }, contentDetails: { duration: "P0D" }, liveStreamingDetails: { actualStartTime: "2026-10-05T17:48:00Z" } };

test("WOLF Trading on air, not subscribed anywhere: the next pass puts the stream in the SCINTILLA feed, marked live", async () => {
  const { result, tables, log } = await runSweep({
    config: cfg({ yt_bridge_channels: JSON.stringify({ ids: [WOLF, OTHER] }) }), videos: [],
    pages: { rss: {}, live: { [WOLF]: livePage("MqOnx6420No"), [OTHER]: channelPage(OTHER) } },
    api: { MqOnx6420No: liveItem },
  });
  assert.deepEqual(result.bridge.channels, 2);
  assert.equal(result.bridge.added_to_scintilla, 2);
  assert.deepEqual(result.bridge.live_check.on_air, ["MqOnx6420No"]);
  /* Y4 (6 Oct): our own carried channel is asked too — "Tyler Wilson … is on a live video … not on my grid" */
  assert.equal(result.bridge.live_check.checked, 3);
  const row = tables.youtube_videos.find((r) => r.video_id === "MqOnx6420No");
  assert.ok(row, "the stream has a row");
  assert.deepEqual([row.channel_id, row.live_broadcast, row.live_started_at, row.subscription_accounts], [WOLF, "live", "2026-10-05T17:48:00Z", ["scintilla"]]);
  assert.equal(row.channel_title, "WOLF Trading");
  assert.ok(log.fetched.some((u) => u.includes("channel_id=" + WOLF)), "its uploads are read by RSS too");
  assert.ok(log.fetched.some((u) => u.includes("channel_id=" + OWN)), "our own channel is still read");
  assert.equal(JSON.parse(tables.app_config.find((r) => r.key === "yt_sub_channels_scintilla").value).ids.length, 1, "our own stored list is not rewritten with the bridge");
  assert.ok(tables.app_config.find((r) => r.key === "yt_bridge_live"), "the check leaves its time and result");
  assert.doesNotMatch(JSON.stringify(result) + JSON.stringify(log.fetched), /test-key/, "the key is in no output");
});

test("no bridge row: the channel list is what it was — and (Y4) the channel we carry ourselves is still asked whether it is on air", async () => {
  const { result, log } = await runSweep({ config: cfg(), videos: [], pages: { rss: {}, live: {} }, api: {} });
  assert.equal(result.bridge.channels, 0);
  assert.equal(result.bridge.live_check.ran, true);
  assert.equal(result.accounts.scintilla.channels, 1);
  assert.deepEqual(log.fetched.filter((u) => u.endsWith("/live")), ["https://www.youtube.com/channel/" + OWN + "/live"]);
});

test("checked five minutes ago: this pass does not read the /live pages again", async () => {
  const { result, log } = await runSweep({
    config: cfg({ yt_bridge_channels: JSON.stringify({ ids: [WOLF] }), yt_bridge_live: JSON.stringify({ last_ms: Date.now() - 5 * 60000, cursor: 0 }) }),
    videos: [], pages: { rss: {}, live: { [WOLF]: livePage("MqOnx6420No") } }, api: { MqOnx6420No: liveItem },
  });
  assert.equal(result.bridge.live_check.ran, false);
  assert.equal(log.fetched.filter((u) => u.endsWith("/live")).length, 0);
  assert.equal(result.accounts.scintilla.channels, 2, "the channel still rides with the list between checks");
});

test("a stream we already hold from a ticker search joins SCINTILLA and is re-asked about at once", async () => {
  const { tables } = await runSweep({
    config: cfg({ yt_bridge_channels: JSON.stringify({ ids: [WOLF] }) }),
    videos: [{ video_id: "MqOnx6420No", channel_id: WOLF, title: "t", published_at: "2026-10-04T20:00:00Z", duration_sec: 10, live_broadcast: "none", subscription_accounts: [] }],
    pages: { rss: {}, live: { [WOLF]: livePage("MqOnx6420No") } }, api: { MqOnx6420No: liveItem },
  });
  const row = tables.youtube_videos.find((r) => r.video_id === "MqOnx6420No");
  assert.deepEqual([row.live_broadcast, row.subscription_accounts], ["live", ["scintilla"]]);
});

test("a row that has said LIVE for two weeks: ended → no longer live; removed → no longer live; a real 24-hour stream stays", async () => {
  const old = (id, extra = {}) => ({ video_id: id, channel_id: OWN, title: id, published_at: "2026-09-21T08:00:00Z", duration_sec: null, live_broadcast: "live", live_checked_ts: 1, subscription_accounts: [], ...extra });
  const { result, tables } = await runSweep({
    config: cfg(), videos: [old("ENDED000001"), old("REMOVED0001"), old("STILLLIVE01")], pages: { rss: {}, live: {} },
    api: { ENDED000001: { snippet: { liveBroadcastContent: "none" }, contentDetails: { duration: "PT2H" }, liveStreamingDetails: { actualStartTime: "2026-09-21T08:34:47Z", actualEndTime: "2026-09-21T10:34:47Z" } }, STILLLIVE01: liveItem },
  });
  const state = Object.fromEntries(tables.youtube_videos.map((r) => [r.video_id, r.live_broadcast]));
  assert.deepEqual(state, { ENDED000001: "none", REMOVED0001: "none", STILLLIVE01: "live" });
  assert.equal(tables.youtube_videos.find((r) => r.video_id === "ENDED000001").duration_sec, 7200);
  assert.equal(result.live_gone, 1);
});

test("a /live page we could not read is counted, and nothing is written from it", async () => {
  const { result, tables } = await runSweep({
    config: cfg({ yt_bridge_channels: JSON.stringify({ ids: [WOLF] }) }), videos: [],
    pages: { rss: {}, live: { [WOLF]: "<html>Before you continue to YouTube consent.youtube.com</html>" } }, api: {},
  });
  assert.deepEqual([result.bridge.live_check.checked, result.bridge.live_check.unknown, result.bridge.live_check.on_air.length], [2, 2, 0], "Y4: the bridged channel and our own, both unreadable here");
  assert.equal(tables.youtube_videos.length, 0);
});

test("yt-config's status line carries the bridge and the last on-air check, and nothing secret", () => {
  assert.match(CFG, /bridge:\{channels:/);
  assert.match(CFG, /'yt_bridge_live'/);
  assert.doesNotMatch(CFG.replace(/\/\/.*$/mg, ""), /YT_API_KEY|REFRESH_TOKEN|CLIENT_SECRET/, "the status endpoint reads no credential row");
  const row = liveCandidateRow(WOLF, { video_id: "MqOnx6420No", title: "t", channel_title: "WOLF Trading" }, 1791228000);
  assert.deepEqual([row.source, row.url, row.channel_id], ["subscription", "https://www.youtube.com/watch?v=MqOnx6420No", WOLF]);
});

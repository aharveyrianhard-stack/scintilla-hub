/* Y2b (5 Oct, evening) — the on-air check must see WOLF Trading from where the collector runs.
   The first pass from the data centre read 29 channels, found nobody on air and could not read one, and stored
   three counts. These tests hold the check to: scoped live markers, a second way when the first cannot be read,
   "could not read" kept honest, one stored line per channel, and two read-only doors (probe, dry pass) that touch
   no table and no API. No network: the pages are fixtures cut to the shapes YouTube served on 5 Oct. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseLivePage, parseStreamsPage, liveMarker, wallKind, checkOnAir, onAirPass, onAirLine, probeLive, readPage, describePage,
  livePageUrl, streamsPageUrl, LIVE_PAGE_HEADERS, PAGE_TIMEOUT_MS, ON_AIR_BUDGET_MS, MAX_LIVE_PROBES, LIVE_EVERY_MIN } from "../supabase/functions/_shared/yt-bridge.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const RSS = read("supabase/functions/yt-rss-sweep/index.ts");
const WOLF = "UCvTUPg9PxLq3DO72AZBygNg";
const OTHER = "UCaqenTegMoW98A4trRofR1A";
const OWN = "UCFMgf_GvoNTU1Vt7IgRaaWg";
const VID = "MqOnx6420No";

/* ---------- the pages, in the shapes seen on 5 Oct ---------- */
const head = (canonical) => '<html><head><title>RISK ON MARKET? - YouTube</title><link rel="canonical" href="https://www.youtube.com/' + canonical + '"></head><body>';
/* a stream on air: the player says OK and isLive, the view counter says isLive, and the side column shows OTHER channels' LIVE badges */
const onAirPage = (video = VID) => head("watch?v=" + video) + '<script>var ytInitialPlayerResponse = {"playabilityStatus":{"status":"OK","playableInEmbed":true},"videoDetails":{"videoId":"' + video + '","title":"RISK ON MARKET? TRADERS AREN\'T FULLY CONVINCED","lengthSeconds":"0","isLive":true,"channelId":"' + WOLF + '","author":"WOLF Trading","isLiveContent":true}};</script>' +
  '"viewCount":{"videoViewCountRenderer":{"viewCount":{"runs":[{"text":"304"},{"text":" watching now"}]},"isLive":true,"originalViewCount":"304"}}</body></html>';
/* a stream still to come: its WAITING counter also says "isLive":true — the trap a bare isLive test falls into */
const upcomingPage = (video = "95AU7rw0Zt4") => head("watch?v=" + video) + '<script>var ytInitialPlayerResponse = {"playabilityStatus":{"status":"LIVE_STREAM_OFFLINE","reason":"Live in 3 hours"},"videoDetails":{"videoId":"' + video + '","title":"Tomorrow","lengthSeconds":"0","channelId":"' + OTHER + '","isUpcoming":true,"isLiveContent":true}};</script>"videoViewCountRenderer":{"viewCount":{"runs":[{"text":"3 waiting"}]},"isLive":true}</body></html>';
/* the data-centre wall: a watch page with the address of the stream and no player facts */
const walledPage = (video = VID) => head("watch?v=" + video) + '<script>var ytInitialPlayerResponse = {"playabilityStatus":{"status":"LOGIN_REQUIRED","reason":"Sign in to confirm you\\u2019re not a bot"}};</script>' +
  '"thumbnailOverlayTimeStatusRenderer":{"text":{"runs":[{"text":"LIVE"}]},"style":"LIVE"} "badgeStyle":"THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE"</body></html>';
const endedPage = (video = VID) => head("watch?v=" + video) + '<script>var ytInitialPlayerResponse = {"playabilityStatus":{"status":"OK"},"videoDetails":{"videoId":"' + video + '","title":"Yesterday","lengthSeconds":"5400","channelId":"' + WOLF + '","isLiveContent":true}};</script></body></html>';
const channelPage = (id) => head("channel/" + id) + '<meta property="og:title" content="WOLF Trading">"externalId":"' + id + '"</body></html>';
const tile = (video, title, live) => '{"richItemRenderer":{"content":{"lockupViewModel":{"contentImage":{"thumbnailViewModel":{"image":{"sources":[{"url":"https://i.ytimg.com/vi/' + video + '/hq720.jpg"}]},"overlays":[{"thumbnailBottomOverlayViewModel":{"badges":[{"thumbnailBadgeViewModel":' +
  (live ? '{"text":"LIVE","badgeStyle":"THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE","animationActivationTargetId":"' + video + '"}' : '{"text":"1:31:02","badgeStyle":"THUMBNAIL_OVERLAY_BADGE_STYLE_DEFAULT"}') +
  '}]}}]}},"metadata":{"lockupMetadataViewModel":{"title":{"content":"' + title + '"}}}}}}}';
const streamsPage = (id, tiles, tab = '"title":"Live","selected":true') => head("channel/" + id) + '<meta property="og:title" content="WOLF Trading">{"tabRenderer":{' + tab + ',"content":{"richGridRenderer":{"contents":[' + tiles.join(",") + ']}}}}</body></html>';
const CONSENT = "<html><title>Before you continue to YouTube</title>consent.youtube.com</html>";

/* ---------- reading one /live page ---------- */
test("the live marker is scoped: on air is on air, and a stream still to come is not — though its waiting counter says isLive", () => {
  const on = parseLivePage(onAirPage());
  assert.deepEqual([on.state, on.outcome, on.marker, on.video_id, on.viewers, on.channel_title], ["live", "on_air", "player.isLive", VID, 304, "WOLF Trading"]);
  const soon = parseLivePage(upcomingPage());
  assert.deepEqual([soon.state, soon.outcome, soon.marker], ["upcoming", "upcoming", "isUpcoming"]);
  assert.equal(parseLivePage(upcomingPage().replace('"isUpcoming":true,', "")).marker, "player.LIVE_STREAM_OFFLINE", "the player's own word is enough");
  assert.equal(liveMarker(onAirPage().replace('"lengthSeconds":"0","isLive":true,', '"lengthSeconds":"0",')), "page.viewCount.isLive", "the view counter alone still reads");
  assert.equal(liveMarker('<x>"microformat":{"liveBroadcastDetails":{"isLiveNow":true}}'), "microformat.isLiveNow");
  assert.equal(liveMarker(endedPage()), null);
});

test("a watch page with no player facts is 'could not read', never 'off' — and the side column's LIVE badges are not this channel's", () => {
  const walled = parseLivePage(walledPage());
  assert.deepEqual([walled.state, walled.outcome, walled.marker, walled.video_id], ["unknown", "watch_page_unreadable", "player.LOGIN_REQUIRED", VID]);
  const ended = parseLivePage(endedPage());
  assert.deepEqual([ended.state, ended.outcome], ["off", "watch_page_not_live"]);
  assert.deepEqual([parseLivePage(channelPage(WOLF)).state, parseLivePage(channelPage(WOLF)).outcome], ["off", "channel_page"]);
});

test("every page that could not be read says which kind it was", () => {
  assert.equal(parseLivePage("").outcome, "empty");
  assert.equal(parseLivePage(CONSENT).outcome, "consent_page");
  assert.equal(parseLivePage("<html>anything</html>", "https://consent.youtube.com/m?continue=x").outcome, "consent_page");
  assert.equal(parseLivePage("<html>Our systems have detected unusual traffic from your computer network</html>").outcome, "bot_check");
  assert.equal(wallKind("<html></html>", "https://www.google.com/sorry/index?continue=x"), "bot_check");
  assert.equal(parseLivePage("<html><title>429</title></html>").outcome, "unrecognised_page");
  for (const page of ["", CONSENT, "<html><title>429</title></html>", walledPage()]) assert.equal(parseLivePage(page).state, "unknown");
  assert.equal(wallKind(onAirPage()), null);
  assert.equal(parseLivePage(onAirPage().replace('<link rel="canonical" href="https://www.youtube.com/watch?v=' + VID + '">', '<meta property="og:url" content="https://www.youtube.com/watch?v=' + VID + '">')).state, "live", "og:url names the stream when the canonical link is missing");
});

/* ---------- the second way: the channel's Live tab ---------- */
test("the Live tab: the tile with the LIVE badge is the stream on air; no badge is off; somebody else's page is not read", () => {
  const live = parseStreamsPage(streamsPage(WOLF, [tile("1zlZms2CzGw", "Yesterday", false), tile(VID, "RISK ON MARKET?", true)]), WOLF);
  assert.deepEqual([live.state, live.outcome, live.marker, live.video_id, live.title, live.channel_title], ["live", "on_air", "streams.badge_live", VID, "RISK ON MARKET?", "WOLF Trading"]);
  assert.deepEqual([parseStreamsPage(streamsPage(WOLF, [tile("1zlZms2CzGw", "Yesterday", false)]), WOLF).outcome], ["live_tab_no_stream"]);
  const noTab = parseStreamsPage(streamsPage(WOLF, [tile(VID, "x", true)], '"title":"Home","selected":true'), WOLF);
  assert.deepEqual([noTab.state, noTab.outcome], ["off", "no_live_tab"], "a channel with no Live tab lands on Home; a badge there may be another channel's");
  assert.equal(parseStreamsPage(streamsPage(OTHER, [tile(VID, "x", true)]), WOLF).outcome, "unrecognised_page");
  assert.equal(parseStreamsPage(CONSENT, WOLF).outcome, "consent_page");
  assert.equal(parseStreamsPage("", WOLF).outcome, "empty");
  const old = streamsPage(WOLF, ['{"videoRenderer":{"videoId":"' + VID + '","thumbnail":{"thumbnails":[{"url":"https://i.ytimg.com/vi/' + VID + '/hqdefault_live.jpg"}]},"title":{"runs":[{"text":"Old shape"}]},"thumbnailOverlays":[{"thumbnailOverlayTimeStatusRenderer":{"text":{"runs":[{"text":"LIVE"}]},"style":"LIVE"}}]}}']);
  assert.deepEqual([parseStreamsPage(old, WOLF).marker, parseStreamsPage(old, WOLF).video_id], ["streams.style_live", VID], "the older tile shape reads too");
});

/* ---------- one channel, both ways ---------- */
const net = (routes) => {
  const asked = [];
  const fn = async (url, init) => {
    asked.push({ url: String(url), headers: (init && init.headers) || {} });
    const hit = routes(String(url));
    if (hit instanceof Error) throw hit;
    const [status, body] = Array.isArray(hit) ? hit : [200, hit];
    return { ok: status >= 200 && status < 300, status, url: String(url), text: async () => body };
  };
  return { fn, asked };
};

test("one channel: /live read → one request; /live unreadable → the Live tab is asked, and the answer says both", async () => {
  let n = net((u) => u.endsWith("/live") ? onAirPage() : new Error("not asked"));
  let line = await checkOnAir(WOLF, n.fn);
  assert.deepEqual([line.state, line.outcome, line.marker, line.way, line.video, line.status, line.url], ["live", "on_air", "player.isLive", "live_page", VID, 200, "/channel/" + WOLF + "/live"]);
  assert.equal(n.asked.length, 1);
  assert.equal(n.asked[0].headers.Cookie, LIVE_PAGE_HEADERS.Cookie);
  assert.match(LIVE_PAGE_HEADERS.Cookie, /SOCS=CAI/); assert.match(LIVE_PAGE_HEADERS.Cookie, /CONSENT=YES\+/); assert.match(LIVE_PAGE_HEADERS.Cookie, /PREF=hl=en&gl=US/);

  n = net((u) => u.endsWith("/live") ? channelPage(OTHER) : new Error("not asked"));
  line = await checkOnAir(OTHER, n.fn);
  assert.deepEqual([line.state, line.outcome, n.asked.length], ["off", "channel_page", 1], "a channel that is plainly off costs one request, as before");

  for (const firstAnswer of [walledPage(), CONSENT, [429, "Too Many Requests"], new Error("socket")]) {
    n = net((u) => u.endsWith("/live") ? firstAnswer : streamsPage(WOLF, [tile(VID, "RISK ON MARKET?", true)]));
    line = await checkOnAir(WOLF, n.fn);
    assert.deepEqual([line.state, line.way, line.marker, line.video], ["live", "streams_tab", "streams.badge_live", VID]);
    assert.deepEqual(n.asked.map((a) => a.url), [livePageUrl(WOLF), streamsPageUrl(WOLF)]);
    assert.ok(["watch_page_unreadable", "consent_page", "http_429", "fetch_error"].includes(line.live_page), "the first way's outcome is kept: " + line.live_page);
  }
  n = net((u) => u.endsWith("/live") ? walledPage() : streamsPage(WOLF, [tile("1zlZms2CzGw", "Yesterday", false)]));
  line = await checkOnAir(WOLF, n.fn);
  assert.deepEqual([line.state, line.outcome, line.way, line.live_page, line.live_page_video], ["off", "live_tab_no_stream", "streams_tab", "watch_page_unreadable", VID]);
});

test("neither way readable: the channel is 'could not read' and says what each way got", async () => {
  const n = net((u) => u.endsWith("/live") ? [429, "x"] : CONSENT);
  const line = await checkOnAir(WOLF, n.fn);
  assert.deepEqual([line.state, line.outcome, line.way, line.live_page, line.streams_tab, line.status, line.live], ["unknown", "http_429", "none", "http_429", "consent_page", 429, null]);
  const stored = onAirLine(line);
  assert.ok(!("live" in stored), "the stored line carries no page text");
  assert.ok(JSON.stringify(stored).length < 400, "a stored line stays small");
});

test("ways=both (the dry pass): the Live tab is asked even when /live answered, and a stream it alone sees is on air", async () => {
  let n = net((u) => u.endsWith("/live") ? channelPage(WOLF) : streamsPage(WOLF, [tile(VID, "RISK ON MARKET?", true)]));
  let line = await checkOnAir(WOLF, n.fn, { both: true });
  assert.deepEqual([line.state, line.way, line.live_page, n.asked.length], ["live", "streams_tab", "channel_page", 2]);
  n = net((u) => u.endsWith("/live") ? channelPage(WOLF) : streamsPage(WOLF, []));
  line = await checkOnAir(WOLF, n.fn, { both: true });
  assert.deepEqual([line.state, line.way, line.outcome, line.streams_tab], ["off", "live_page", "channel_page", "live_tab_no_stream"]);
});

test("a page that does not answer is a time-out, not a crash; a pass out of time writes the rest down as not reached", async () => {
  const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" });
  const page = await readPage("https://www.youtube.com/x", {}, async () => { throw timeout; });
  assert.deepEqual([page.status, page.error, page.html], [0, "timeout", ""]);
  const ids = Array.from({ length: 20 }, (_, i) => "UC" + String(i).padStart(22, "0"));
  const n = net((u) => channelPage(u.split("/channel/")[1].split("/")[0]));
  const spent = await onAirPass(ids, n.fn, { budgetMs: 0 });
  assert.equal(spent.length, 20, "every channel has a line");
  assert.deepEqual([spent.filter((l) => l.outcome === "channel_page").length, spent.filter((l) => l.outcome === "not_reached").length], [8, 12]);
  assert.ok(spent.filter((l) => l.outcome === "not_reached").every((l) => l.state === "unknown"), "not reached counts as could not read");
  assert.equal(n.asked.length, 8, "nothing is asked after the budget");
  assert.equal((await onAirPass(ids, n.fn)).filter((l) => l.outcome === "channel_page").length, 20);
});

test("the neighbours: the pass's budget fits inside the schedule's 120 s wait and the sweep's 180 s lock; pacing is what it was", () => {
  assert.equal(LIVE_EVERY_MIN, 20); assert.equal(MAX_LIVE_PROBES, 60);
  const worstLastBatch = 2 * PAGE_TIMEOUT_MS;                       // a batch that starts just inside the budget, both ways timing out
  assert.ok(ON_AIR_BUDGET_MS + worstLastBatch <= 75000, "worst case " + (ON_AIR_BUDGET_MS + worstLastBatch) + " ms leaves the sweep 45 s of the schedule's 120 s");
  const code = RSS.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/mg, "");
  assert.match(code, /net\.http_get|running\.ts && now - running\.ts < 180/, "the 180 s lock is still the sweep's");
  assert.doesNotMatch(code, /search\?|eventType=live/, "no search call was added");
  assert.equal((code.match(/apiKeyRequest\(/g) || []).length, 3, "the sweep still makes its two kinds of YouTube API call and no third (definition + 2 uses)");
  assert.match(code, /const REFRESH_MAX = 200;/);
});

/* ---------- the probe ---------- */
test("the probe describes each way of asking, and says which ones see the stream", async () => {
  const n = net((u) => {
    if (u.includes("/oembed")) return JSON.stringify({ title: "RISK ON MARKET?", author_name: "WOLF Trading" });
    if (u.includes("/streams")) return streamsPage(WOLF, [tile(VID, "RISK ON MARKET?", true)]);
    if (u.includes("live_view=501")) return channelPage(WOLF);
    if (u.includes("hl=en&gl=US")) return onAirPage();
    return n.asked[n.asked.length - 1].headers.Cookie ? walledPage() : CONSENT;
  });
  const out = await probeLive(WOLF, null, n.fn);
  assert.deepEqual(Object.keys(out.ways), ["live_as_the_check_sends_it", "live_as_v8_sent_it", "live_plain_get", "live_consent_cookies_hl_gl", "streams_tab", "videos_live_view_501", "oembed"]);
  assert.deepEqual(out.sees_live, ["live_consent_cookies_hl_gl", "streams_tab"]);
  const first = out.ways.live_as_the_check_sends_it;
  assert.deepEqual([first.status, first.kind, first.player_status, first.verdict, first.watch_video], [200, "watch_page", "LOGIN_REQUIRED", "watch_page_unreadable", VID]);
  assert.equal(out.ways.live_plain_get.kind, "consent_page");
  assert.equal(out.ways.live_plain_get.title, "Before you continue to YouTube");
  assert.ok(first.first_300.length <= 300 && first.bytes > 0);
  assert.deepEqual([out.ways.live_consent_cookies_hl_gl.markers.isLive, out.ways.live_consent_cookies_hl_gl.markers.live_marker], [2, "player.isLive"]);
  assert.deepEqual([out.ways.oembed.video, out.ways.oembed.author], [VID, "WOLF Trading"], "the stream's id comes from the pages when none is given");
  assert.deepEqual([out.check.state, out.check.way], ["live", "streams_tab"], "and the check itself, run last, is reported as one line");
  assert.equal(describePage({ status: 429, url: "https://www.google.com/sorry/index", body: "<html>sorry</html>", html: "", error: "http_429" }).kind, "bot_check");
});

/* ---------- the sweep itself, run against an in-memory table ---------- */
function db(config, videos) {
  const log = { writes: [], reads: [], fetched: [] };
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
          log.writes.push({ table, key: row[key] });
        }
        return { data: null, error: null };
      }
      if (q.op === "update") { for (const row of rowsOf()) { Object.assign(row, q.payload); log.writes.push({ table, key: row.video_id || row.key }); } return { data: null, error: null }; }
      let rows = rowsOf(); if (q.lim != null) rows = rows.slice(0, q.lim);
      log.reads.push({ table, keys: rows.map((r) => r.key || r.video_id) });
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
async function runSweep({ config, videos = [], live = {}, streams = {}, api = {}, query = "" }) {
  const store = db(config, videos);
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url); store.log.fetched.push(u.replace(/key=[^&]+/, "key=…"));
    const answer = (status, body) => ({ ok: status >= 200 && status < 300, status, url: u, text: async () => body, json: async () => JSON.parse(body) });
    const pageOf = (map, id) => { const hit = map[id] ?? channelPage(id); return Array.isArray(hit) ? answer(hit[0], hit[1]) : answer(200, hit); };
    if (u.includes("/feeds/videos.xml")) return answer(200, "<feed><name>x</name></feed>");
    if (u.includes("googleapis.com/youtube/v3/videos")) {
      const ids = decodeURIComponent(u.match(/[?&]id=([^&]+)/)[1]).split(",");
      return answer(200, JSON.stringify({ items: ids.filter((id) => api[id]).map((id) => ({ id, ...api[id] })) }));
    }
    if (u.includes("/oembed")) return answer(200, JSON.stringify({ title: "t", author_name: "WOLF Trading" }));
    if (/\/channel\/UC[\w-]{22}\/live/.test(u)) return pageOf(live, u.split("/channel/")[1].split("/")[0]);
    if (/\/channel\/UC[\w-]{22}\/(streams|videos)/.test(u)) return pageOf(streams, u.split("/channel/")[1].split("/")[0]);
    if (u.includes("/shorts/")) return answer(303, "");
    if (u.includes("oauth2.googleapis.com")) return answer(400, JSON.stringify({ error: "invalid_grant" }));
    throw new Error("unexpected request " + u);
  };
  globalThis.__y2b = { createClient: () => store.client };
  globalThis.Deno = { env: { get: (k) => ({ SUPABASE_URL: "http://db.test", SUPABASE_SERVICE_ROLE_KEY: "test" })[k] || "" }, serve: (h) => { globalThis.__y2b.handler = h; } };
  const js = stripTypeScriptTypes(RSS, { mode: "strip" })
    .replace(/import \{ createClient \} from "https:\/\/esm\.sh\/[^"]+";/, "const { createClient } = globalThis.__y2b;")
    .replace('"../_shared/yt-bridge.mjs"', JSON.stringify(pathToFileURL(path.join(ROOT, "supabase/functions/_shared/yt-bridge.mjs")).href));
  const file = path.join(os.tmpdir(), "y2b-sweep-" + process.pid + "-" + (harnessCount++) + ".mjs");
  fs.writeFileSync(file, js);
  try {
    await import(pathToFileURL(file).href);
    const response = await globalThis.__y2b.handler(query === null ? undefined : new Request("http://edge.test/functions/v1/yt-rss-sweep" + query));
    return { result: await response.json(), ...store };
  } finally { globalThis.fetch = realFetch; fs.unlinkSync(file); delete globalThis.Deno; }
}
const cfg = (extra = {}) => Object.entries({
  YT_API_KEY: "test-key", yt_sub_channels_scintilla: JSON.stringify({ ids: [OWN], ts: Math.floor(Date.now() / 1000) }), ...extra,
}).map(([key, value]) => ({ key, value }));
const liveItem = { snippet: { liveBroadcastContent: "live", defaultAudioLanguage: "en" }, contentDetails: { duration: "P0D" }, liveStreamingDetails: { actualStartTime: "2026-10-05T13:25:03Z" } };
const bridge = (ids) => ({ yt_bridge_channels: JSON.stringify({ ids }) });

test("the data-centre case: /live shows WOLF's stream behind a wall, the Live tab shows it on air → the stream enters the feed, and the row says how", async () => {
  const { result, tables } = await runSweep({
    config: cfg(bridge([WOLF, OTHER])), live: { [WOLF]: walledPage() }, streams: { [WOLF]: streamsPage(WOLF, [tile(VID, "RISK ON MARKET?", true)]) }, api: { [VID]: liveItem },
  });
  /* Y4 (6 Oct): the channel we carry ourselves is asked too, so every count of channels asked is one higher */
  assert.deepEqual([result.bridge.live_check.checked, result.bridge.live_check.on_air, result.bridge.live_check.unknown], [3, [VID], 0]);
  const row = tables.youtube_videos.find((r) => r.video_id === VID);
  assert.deepEqual([row.channel_id, row.title, row.channel_title, row.live_broadcast, row.live_started_at, row.subscription_accounts], [WOLF, "RISK ON MARKET?", "WOLF Trading", "live", "2026-10-05T13:25:03Z", ["scintilla"]]);
  const stored = JSON.parse(tables.app_config.find((r) => r.key === "yt_bridge_live").value);
  assert.deepEqual([stored.checked, stored.on_air, stored.unknown], [3, [VID], 0], "the fields the status line reads are what they were");
  assert.equal(stored.channels.length, 3, "one line per channel");
  const wolf = stored.channels.find((l) => l.id === WOLF), other = stored.channels.find((l) => l.id === OTHER);
  assert.deepEqual([wolf.outcome, wolf.marker, wolf.way, wolf.video, wolf.url, wolf.live_page, wolf.live_page_video], ["on_air", "streams.badge_live", "streams_tab", VID, "/channel/" + WOLF + "/streams", "watch_page_unreadable", VID]);
  assert.deepEqual([other.outcome, other.marker, other.way, other.url, other.status], ["channel_page", null, "live_page", "/channel/" + OTHER + "/live", 200]);
  assert.doesNotMatch(JSON.stringify(stored) + JSON.stringify(result), /test-key|<html/, "no key and no page text in what is stored");
});

test("could not read stays honest: a wall on both ways is counted, named in the row, and writes no video", async () => {
  const { result, tables } = await runSweep({ config: cfg(bridge([WOLF])), live: { [WOLF]: [429, "x"] }, streams: { [WOLF]: CONSENT } });
  assert.deepEqual([result.bridge.live_check.checked, result.bridge.live_check.unknown, result.bridge.live_check.on_air], [2, 1, []]);
  assert.equal(tables.youtube_videos.length, 0);
  const line = JSON.parse(tables.app_config.find((r) => r.key === "yt_bridge_live").value).channels[0];
  assert.deepEqual([line.id, line.state, line.outcome, line.streams_tab, line.status], [WOLF, "unknown", "http_429", "consent_page", 429]);
});

test("a stream still to come is not put on air by the check", async () => {
  const { result, tables } = await runSweep({ config: cfg(bridge([OTHER])), live: { [OTHER]: upcomingPage() } });
  assert.deepEqual([result.bridge.live_check.on_air, result.bridge.live_check.unknown], [[], 0]);
  assert.equal(tables.youtube_videos.length, 0);
  assert.equal(JSON.parse(tables.app_config.find((r) => r.key === "yt_bridge_live").value).channels[0].outcome, "upcoming");
});

test("the schedule's call (no question asked) is the sweep it always was", async () => {
  for (const query of [null, "", "?probe=other", "?dry=1"]) {
    const { result, log } = await runSweep({ config: cfg(bridge([WOLF])), live: { [WOLF]: onAirPage() }, api: { [VID]: liveItem }, query });
    assert.ok(result.bridge && result.rss_channels === 2, "a full sweep ran for " + JSON.stringify(query));
    assert.deepEqual(result.bridge.live_check.on_air, [VID]);
    assert.ok(log.writes.some((w) => w.key === "yt_rss_result"));
  }
});

test("?dry=live — the whole on-air pass, reported: WOLF listed on air, and not one write, lock or API call", async () => {
  const before = cfg({ ...bridge([WOLF, OTHER]), yt_bridge_live: JSON.stringify({ last_ms: Date.now() - 60000, cursor: 0, checked: 29, on_air: [], unknown: 1 }) });
  const snapshot = JSON.stringify(before);
  const { result, tables, log } = await runSweep({ config: before, live: { [WOLF]: onAirPage() }, query: "?dry=live&also=" + OWN + ",junk" });
  assert.deepEqual([result.dry, result.wrote, result.bridged, result.checked, result.probe_only], ["live", "nothing", 2, 3, [OWN]]);
  assert.deepEqual(result.on_air, [{ id: WOLF, video: VID, title: "RISK ON MARKET? TRADERS AREN'T FULLY CONVINCED", channel: "WOLF Trading", marker: "player.isLive", way: "live_page", bridged: true }]);
  assert.deepEqual(result.could_not_read, []);
  assert.equal(result.channels.length, 3);
  assert.deepEqual(log.writes, [], "nothing written — not the result, not the lock, not the 20-minute clock");
  assert.equal(JSON.stringify(tables.app_config), snapshot);
  assert.equal(tables.youtube_videos.length, 0);
  assert.deepEqual(log.reads, [{ table: "app_config", keys: ["yt_bridge_channels"] }], "one read: the bridge row, and no credential row");
  assert.ok(log.fetched.every((u) => u.startsWith("https://www.youtube.com/channel/")), "only channel pages are asked for — no API, no RSS");
  assert.equal(result.channels.find((l) => l.id === OTHER).outcome, "channel_page");
  assert.doesNotMatch(JSON.stringify(result), /test-key/);
});

test("?dry=live&ways=both asks the Live tab for every channel", async () => {
  const { result, log } = await runSweep({ config: cfg(bridge([WOLF])), live: { [WOLF]: channelPage(WOLF) }, streams: { [WOLF]: streamsPage(WOLF, [tile(VID, "RISK ON MARKET?", true)]) }, query: "?dry=live&ways=both" });
  assert.deepEqual([result.on_air[0].way, result.on_air[0].marker, result.channels[0].live_page], ["streams_tab", "streams.badge_live", "channel_page"]);
  assert.equal(log.fetched.length, 2);
});

test("?probe=live — one channel looked at every way: no table is opened at all", async () => {
  const { result, log } = await runSweep({ config: cfg(bridge([WOLF])), live: { [WOLF]: onAirPage() }, streams: { [WOLF]: streamsPage(WOLF, [tile(VID, "RISK ON MARKET?", true)]) }, query: "?probe=live&channel=" + WOLF });
  assert.deepEqual([result.probe, result.wrote, result.channel], ["live", "nothing", WOLF]);
  assert.ok(result.sees_live.includes("live_as_the_check_sends_it") && result.sees_live.includes("streams_tab"));
  assert.deepEqual([log.reads, log.writes], [[], []], "no read and no write");
  assert.ok(log.fetched.every((u) => u.startsWith("https://www.youtube.com/")), "only youtube.com is asked");
  assert.ok(!log.fetched.some((u) => u.includes("googleapis")), "no API call");
  const bad = await runSweep({ config: cfg(), query: "?probe=live&channel=https://evil.test/" });
  assert.match(bad.result.error, /channel id/);
  assert.deepEqual(bad.log.fetched, [], "an address that is not a channel id is never fetched");
});

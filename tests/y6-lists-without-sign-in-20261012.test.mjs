/* Y6 (13 Oct) — the followed lists refresh themselves without a sign-in; the SCINTILLA list is read first.
   Alan, 12 Oct 22:40 ET: "I have tried to make some changes to the subscriptions … this was supposed to happen daily."
   22:48 ET: "Why are we getting shit hidden? … Just get my shit on there, please."

   What was measured before anything was built (13 Oct 03:27Z–03:36Z):
     · every Google sign-in answers invalid_grant; YouTube gives ONE account's list without a sign-in (56 channels on
       two pages, 49 + 7), says "private" (403) for three, and for one answers 200 with NO channels against 47 saved;
     · the public feed is mostly gone (162–184 of 195 reads failing for most of an hour);
     · one call says how many videos each of 50 channels has, and that number moved within 66 seconds of a publish.
   These tests hold the collector to what was built on that. No network: YouTube's answers and the table are written
   here, in the shapes YouTube served; the sweep function itself is run against them.
   EVERY CHANNEL, ACCOUNT AND VIDEO HERE IS MADE UP. This repository is public; which channels Alan follows is not in it. */
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { HEALTH_KEY, SETTINGS_KEY, FALLBACK_DEFAULTS, NOTICE_DEFAULTS, NOTICE_LIMITS, SEARCH_MAX_UNITS, fallbackSettings, noticeSettings, parseHealth, fallbackPlan, capWords,
  lastRead, lastSeen, nextHealth, afterLists, unreadOverADay, apiGet, apiOutcome, allowedByNow, GONE_KEPT } from "../supabase/functions/_shared/yt-feed-fallback.mjs";
import { COUNTS_PER_CALL, OWN_CALLS_A_PASS, GUARD_MARGIN, tiersOf, dayGuard, ownCallsToday, passBudget, noticePlan, countsCall, readCounts, readCountsAgainst, movedPick,
  secondWayPass } from "../supabase/functions/_shared/yt-upload-notice.mjs";
import { LIST_MAX_PAGES, LISTS_BUDGET_MS, SLOW_AGAIN, ownChannelKey, publicListPath, stillSubscribedPath, readPublicList, askStillSubscribed, stillFromAnswer, acceptList,
  missingFrom, settleList, untagGroups, publicWayDue, keptWords, listSays } from "../supabase/functions/_shared/yt-lists.mjs";
import * as bridge from "../supabase/functions/_shared/yt-bridge.mjs";
import { DAILY_QUOTA } from "../supabase/functions/_shared/yt-search-plan.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const RSS = read("supabase/functions/yt-rss-sweep/index.ts");
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/mg, "");
const KEY = "test-key-NEVER-SHOWN";

/* ---------- made-up channels, accounts and videos ---------- */
const many = (n, from = 0) => Array.from({ length: n }, (_, i) => "UC" + String(from + i).padStart(22, "0"));
const OWN = Object.fromEntries(["scintilla", "personal", "soundscapes", "golf", "ai_research"].map((a) => [a, "UC" + ("own" + a.replace("_", "")).padEnd(22, "0").slice(0, 22)]));
const vid = (n) => "fx" + String(n).padStart(9, "0");
const T0 = Date.UTC(2026, 9, 13, 3, 30, 0);                   // 13 Oct 03:30Z = 12 Oct 20:30 Pacific: 1,230 minutes into the quota day
const sec = (ms) => Math.floor(ms / 1000);
const NOW = sec(T0);
const minAgo = (m, from = NOW) => from - m * 60;
const NOTICE = noticeSettings(null), FALLBACK = fallbackSettings(null);

/* ---------- YouTube's answers, in the shapes it serves ---------- */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const feedXml = (name, entries) => '<?xml version="1.0" encoding="UTF-8"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom"><title>' + esc(name) +
  "</title><author><name>" + esc(name) + "</name></author>" + entries.map((e) => "<entry><id>yt:video:" + e.id + "</id><yt:videoId>" + e.id + "</yt:videoId><title>" + esc(e.title) +
  "</title><published>" + e.published + '</published><media:group><media:thumbnail url="https://i1.ytimg.com/vi/' + e.id + '/hqdefault.jpg" width="480" height="360"/><media:description>' + esc(e.description || "") +
  "</media:description></media:group></entry>").join("") + "</feed>";
const uploadsBody = (channelId, name, items) => ({ kind: "youtube#playlistItemListResponse", items: items.map((v, i) => ({ kind: "youtube#playlistItem",
  snippet: { publishedAt: v.published, channelId, title: v.title, description: "", thumbnails: { high: { url: "https://i.ytimg.com/vi/" + v.id + "/hqdefault.jpg" } },
    channelTitle: name, playlistId: "UU" + channelId.slice(2), position: i, resourceId: { kind: "youtube#video", videoId: v.id }, videoOwnerChannelTitle: name, videoOwnerChannelId: channelId },
  contentDetails: { videoId: v.id, videoPublishedAt: v.published } })) });
const apiVideo = (duration = "PT12M", live = "none", extra = {}) => ({ snippet: { liveBroadcastContent: live, defaultAudioLanguage: "en" }, contentDetails: { duration }, ...extra });
const apiError = (status, reason) => [status, { error: { code: status, message: "…", errors: [{ message: "…", domain: "youtube", reason }] } }];
/** one page of subscriptions.list */
const subsPage = (ids, nextPageToken, total) => ({ kind: "youtube#SubscriptionListResponse", ...(nextPageToken ? { nextPageToken } : {}), pageInfo: { totalResults: total ?? ids.length, resultsPerPage: 50 },
  items: ids.map((id) => ({ kind: "youtube#subscription", snippet: { title: "Channel " + id.slice(-4), resourceId: { kind: "youtube#channel", channelId: id } } })) });
const PRIVATE = apiError(403, "subscriptionForbidden");
const NOT_FOUND = [404, "<html>Not Found</html>"];

/* ---------- the sweep itself, run against an in-memory table ---------- */
function db(config, videos) {
  const log = { writes: [], reads: [], fetched: [], failUpdate: null };
  const tables = { app_config: config, youtube_videos: videos };
  function query(table) {
    const q = { filters: [], op: "select", payload: null, lim: null, count: false };
    const rowsOf = () => tables[table].filter((row) => q.filters.every((f) => f(row)));
    const run = () => {
      const key = table === "app_config" ? "key" : "video_id";
      if (q.op === "upsert") {
        for (const row of [].concat(q.payload)) {
          const i = tables[table].findIndex((r) => r[key] === row[key]);
          if (i >= 0) tables[table][i] = { ...tables[table][i], ...row }; else tables[table].push({ ...row });
          log.writes.push({ table, op: "upsert", key: row[key] });
        }
        return { data: null, error: null };
      }
      if (q.op === "update") {
        if (log.failUpdate && table === "youtube_videos" && log.failUpdate(q.payload)) return { data: null, error: { message: "the table said no" } };
        for (const row of rowsOf()) { Object.assign(row, q.payload); log.writes.push({ table, op: "update", key: row[key], set: Object.keys(q.payload) }); }
        return { data: null, error: null };
      }
      let rows = rowsOf();
      if (q.count) { log.reads.push({ table, count: rows.length }); return { data: null, count: rows.length, error: null }; }
      if (q.lim != null) rows = rows.slice(0, q.lim);
      log.reads.push({ table, keys: rows.map((r) => r[key]) });
      return { data: rows.map((r) => ({ ...r })), error: null };
    };
    const api = {
      select: (_cols, opts) => { if (opts && opts.head) q.count = true; return api; }, order: () => api, limit: (n) => { q.lim = n; return api; },
      in: (k, list) => { q.filters.push((r) => list.includes(r[k])); return api; },
      eq: (k, v) => { q.filters.push((r) => r[k] === v); return api; },
      contains: (k, list) => { q.filters.push((r) => Array.isArray(r[k]) && list.every((v) => r[k].includes(v))); return api; },
      gte: (k, v) => { q.filters.push((r) => String(r[k] || "") >= v); return api; },
      or: () => { q.filters.push((r) => r.duration_sec == null || ["live", "upcoming"].includes(r.live_broadcast)); return api; },
      upsert: (payload) => { q.op = "upsert"; q.payload = payload; return api; },
      update: (payload) => { q.op = "update"; q.payload = payload; return api; },
      delete: () => { throw new Error("the sweep must never delete"); },
      then: (ok, bad) => Promise.resolve().then(run).then(ok, bad),
    };
    return api;
  }
  return { log, tables, client: { from: query } };
}
let harnessCount = 0;
/** one pass.
    feeds / uploads   channel id → body, or [status, body], or an Error to throw   (default: an empty feed / an empty uploads list)
    feedsDown         true: every feed read fails (404), whatever feeds says
    counts            channel id → videoCount (a channel not listed is simply missing from YouTube's answer); or [status, body] for every count call
    lists             own channel id → array of pages (each an array of channel ids), or [status, body], or an Error; pages may be [ids, opts]
    follows           own channel id → the channels the direct question says are followed (default: the last page set given in lists), or [status, body]
    signIn            refresh token → { token } (default: every sign-in answers invalid_grant); mine: token → channel ids, or { list, follows }
    api               video id → videos.list item (default: a plain 12-minute upload) */
async function runSweep({ config, videos = [], feeds = {}, feedsDown = false, counts = {}, uploads = {}, lists = {}, follows = {}, signIn = {}, mine = {}, api = {}, shorts = [],
  query = "", nowMs = T0, store = null, failUpdate = null }) {
  store = store || db(config, videos);
  store.log.fetched.length = 0; store.log.writes.length = 0; store.log.reads.length = 0; store.log.failUpdate = failUpdate;
  const realFetch = globalThis.fetch, realTimeout = globalThis.setTimeout;
  const answer = (status, body, u) => ({ ok: status >= 200 && status < 300, status, url: u, text: async () => (typeof body === "string" ? body : JSON.stringify(body)), json: async () => (typeof body === "string" ? JSON.parse(body) : body) });
  const from = (hit, fallback, u) => { if (hit === undefined) hit = fallback; if (hit instanceof Error) throw hit; return Array.isArray(hit) && typeof hit[0] === "number" ? answer(hit[0], hit[1], u) : answer(200, hit, u); };
  const param = (u, name) => { const m = u.match(new RegExp("[?&]" + name + "=([^&]+)")); return m ? decodeURIComponent(m[1]) : ""; };
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    assert.ok(!u.includes(KEY) || u.startsWith("https://www.googleapis.com/youtube/v3/"), "the key goes to YouTube's API and nowhere else");
    store.log.fetched.push(u.replace(/key=[^&]+/, "key=…"));
    if (u.includes("/feeds/videos.xml")) { const id = u.split("channel_id=")[1]; return feedsDown ? answer(404, "Not Found", u) : from(feeds[id], feedXml("Channel " + id.slice(-4), []), u); }
    if (u.startsWith("https://oauth2.googleapis.com/token")) {
      const refresh = new URLSearchParams(String(init.body)).get("refresh_token"), hit = signIn[refresh];
      return hit ? answer(200, { access_token: hit.token }, u) : answer(400, { error: "invalid_grant" }, u);
    }
    if (u.includes("googleapis.com/youtube/v3/subscriptions")) {
      const bearer = init && init.headers && init.headers.Authorization ? String(init.headers.Authorization).replace("Bearer ", "") : null;
      if (bearer) {                                          // a sign-in's own list
        assert.ok(!u.includes("key="), "a signed-in call carries no key");
        const hit = mine[bearer]; if (hit === undefined) return answer(401, { error: { message: "Invalid Credentials" } }, u);
        if (Array.isArray(hit) && typeof hit[0] === "number") return answer(hit[0], hit[1], u);
        /* { list, follows }: the list call's answer, and what the direct question says — they differ when a list comes back short */
        const all = Array.isArray(hit) ? hit : hit.list, follows = Array.isArray(hit) ? hit : hit.follows;
        const asked = param(u, "forChannelId");
        if (asked && typeof follows[0] === "number") return answer(follows[0], follows[1], u);
        return answer(200, subsPage(asked ? asked.split(",").filter((id) => follows.includes(id)) : all), u);
      }
      const own = param(u, "channelId"), asked = param(u, "forChannelId");
      if (asked) {
        const f = follows[own] !== undefined ? follows[own] : (Array.isArray(lists[own]) && typeof lists[own][0] !== "number" ? lists[own].flat() : []);
        if (f instanceof Error) throw f;
        if (Array.isArray(f) && typeof f[0] === "number") return answer(f[0], f[1], u);
        return answer(200, subsPage(asked.split(",").filter((id) => f.includes(id))), u);
      }
      const hit = lists[own];
      if (hit === undefined) return answer(404, apiError(404, "subscriberNotFound")[1], u);
      if (hit instanceof Error) throw hit;
      if (typeof hit[0] === "number") return answer(hit[0], hit[1], u);
      const token = param(u, "pageToken"), at = token ? +token.replace("page", "") : 0, page = hit[at];
      if (page instanceof Error) throw page;
      if (typeof page[0] === "number") return answer(page[0], page[1], u);
      return answer(200, subsPage(page, at + 1 < hit.length ? "page" + (at + 1) : null, hit.filter((p) => typeof p[0] !== "number").flat().length + 1), u);
    }
    if (u.includes("googleapis.com/youtube/v3/channels")) {
      if (Array.isArray(counts)) return answer(counts[0], counts[1], u);
      const ids = param(u, "id").split(",");
      assert.ok(ids.length <= 50, "never more than 50 channels to a count call");
      return answer(200, { kind: "youtube#channelListResponse", items: ids.filter((id) => counts[id] != null).map((id) => ({ kind: "youtube#channel", id, statistics: { viewCount: "1", subscriberCount: "1", videoCount: String(counts[id]) } })) }, u);
    }
    if (u.includes("googleapis.com/youtube/v3/videos")) {
      const ids = param(u, "id").split(",");
      return answer(200, { items: ids.map((id) => ({ id, ...(api[id] || apiVideo()) })) }, u);
    }
    if (u.includes("googleapis.com/youtube/v3/playlistItems")) {
      const id = "UC" + u.match(/[?&]playlistId=UU([^&]+)/)[1];
      return from(uploads[id], { items: [] }, u);
    }
    if (u.includes("/shorts/")) return answer(shorts.includes(u.split("/shorts/")[1]) ? 200 : 303, "", u);
    const page = u.match(/^https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})\/(?:live|streams)$/);
    if (page) return answer(200, '<html><head><link rel="canonical" href="https://www.youtube.com/channel/' + page[1] + '"></head><body>"externalId":"' + page[1] + '"</body></html>', u);
    throw new Error("unexpected request " + u);
  };
  globalThis.setTimeout = (fn, _ms, ...rest) => realTimeout(fn, 0, ...rest);   // the feed's 700 ms retry pause, not waited for in a test
  mock.timers.enable({ apis: ["Date"], now: nowMs });
  globalThis.__y6 = { createClient: () => store.client };
  globalThis.Deno = { env: { get: (k) => ({ SUPABASE_URL: "http://db.test", SUPABASE_SERVICE_ROLE_KEY: "test" })[k] || "" }, serve: (h) => { globalThis.__y6.handler = h; } };
  const js = stripTypeScriptTypes(RSS, { mode: "strip" })
    .replace(/import \{ createClient \} from "https:\/\/esm\.sh\/[^"]+";/, "const { createClient } = globalThis.__y6;")
    .replace('"../_shared/yt-bridge.mjs"', JSON.stringify(pathToFileURL(path.join(ROOT, "supabase/functions/_shared/yt-bridge.mjs")).href));
  const file = path.join(os.tmpdir(), "y6-sweep-" + process.pid + "-" + (harnessCount++) + ".mjs");
  fs.writeFileSync(file, js);
  try {
    await import(pathToFileURL(file).href);
    const response = await globalThis.__y6.handler(new Request("http://edge.test/functions/v1/yt-rss-sweep" + query));
    return { result: await response.json(), store, ...store };
  } finally { mock.timers.reset(); globalThis.fetch = realFetch; globalThis.setTimeout = realTimeout; fs.unlinkSync(file); delete globalThis.Deno; }
}
/** app_config rows. lists: account → channel ids (saved listedMinAgo minutes ago — over an hour, so every list is due);
    own: which accounts have a channel id on file (default: all five that do in the live table) */
const cfg = (lists, extra = {}, { listedMinAgo = 90, own = Object.keys(OWN), nowSec = NOW } = {}) => Object.entries({
  YT_API_KEY: KEY,
  ...Object.fromEntries(Object.entries(lists).map(([account, ids]) => ["yt_sub_channels_" + account, JSON.stringify({ ids, ts: minAgo(listedMinAgo, nowSec) })])),
  ...Object.fromEntries(own.map((account) => [ownChannelKey(account), OWN[account]])),
  ...extra,
}).map(([key, value]) => ({ key, value: typeof value === "string" ? value : JSON.stringify(value) }));
const healthRow = (ch = {}, extra = {}) => ({ v: 1, at: minAgo(5), day: "2026-10-12", used: 0, quota_day: "", ch, ...extra });
const held = (id, channel, accounts, extra = {}) => ({ video_id: id, channel_id: channel, channel_title: "Channel " + channel.slice(-4), title: "A stored video " + id, published_at: "2026-10-01T12:00:00+00:00",
  source: "subscription", duration_sec: 600, is_short: false, live_broadcast: "none", subscription_accounts: accounts, updated_ts: 1791000000, ...extra });
const row = (tables, id) => tables.youtube_videos.find((r) => r.video_id === id);
const stored = (tables, key) => JSON.parse(tables.app_config.find((r) => r.key === key).value);
const asked = (log, what) => log.fetched.filter((u) => u.includes("/youtube/v3/" + what));
const listCalls = (log) => asked(log, "subscriptions").filter((u) => !u.includes("forChannelId"));
const directCalls = (log) => asked(log, "subscriptions").filter((u) => u.includes("forChannelId"));
const uploadsAsked = (log) => asked(log, "playlistItems").map((u) => "UC" + u.match(/playlistId=UU([^&]+)/)[1]);
const countsAsked = (log) => asked(log, "channels").map((u) => decodeURIComponent(u.match(/[?&]id=([^&]+)/)[1]).split(","));
const net = (hit) => { const calls = []; const fn = async (url, init) => { calls.push({ url: String(url), signal: !!(init && init.signal) }); const h = typeof hit === "function" ? hit(String(url), calls.length) : hit;
  if (h instanceof Error) throw h; const [status, body] = Array.isArray(h) && typeof h[0] === "number" ? h : [200, h];
  return { ok: status === 200, status, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) }; }; fn.calls = calls; return fn; };

/* =====================================================================================================
   1 · THE LISTS WITHOUT A SIGN-IN — the rules
   ===================================================================================================== */
test("an account's list is read the public way: every page, 1 unit a page, and only a page WITHOUT nextPageToken ends it", async () => {
  const all = many(56, 100);
  /* as measured: the first page came back one short of its 50, with a second page to follow, and totalResults said 57 */
  const fn = net((u) => (u.includes("pageToken=") ? subsPage(all.slice(49), null, 57) : subsPage(all.slice(0, 49), "page1", 57)));
  const got = await readPublicList(OWN.scintilla, KEY, fn);
  assert.deepEqual([got.outcome, got.sent, got.pages, got.ids.length, got.reason], ["ok", 2, 2, 56, null]);
  assert.deepEqual(got.ids, all);
  assert.equal(got.names[all[0]], "Channel " + all[0].slice(-4));
  assert.equal(fn.calls[0].url, "https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&maxResults=50&order=alphabetical&channelId=" + OWN.scintilla + "&key=" + KEY);
  assert.match(fn.calls[1].url, /&pageToken=page1&key=/);
  assert.ok(fn.calls.every((c) => c.signal), "every page is bounded");
  assert.doesNotMatch(JSON.stringify(got), new RegExp(KEY), "no key in what comes back");
  /* a channel listed twice is one channel; an item that is not a channel is left out */
  const twice = await readPublicList(OWN.scintilla, KEY, net({ items: [...subsPage([all[0], all[1], all[0]]).items, { snippet: { title: "odd", resourceId: { channelId: "not-a-channel" } } }, {}] }));
  assert.deepEqual(twice.ids, [all[0], all[1]]);
  assert.equal(publicListPath(OWN.golf, "a b"), "subscriptions?part=snippet&maxResults=50&order=alphabetical&channelId=" + OWN.golf + "&pageToken=a%20b");
});

test("a list that cannot be read WHOLE is not read at all: private, one failed page, too long, no unit left — each has its name", async () => {
  const cases = [
    [PRIVATE, "private", "subscriptionForbidden", 1], [apiError(403, "accountClosed"), "closed", "accountClosed", 1], [apiError(404, "subscriberNotFound"), "not_found", "subscriberNotFound", 1],
    [NOT_FOUND, "not_found", null, 1], [apiError(403, "quotaExceeded"), "quota", "quotaExceeded", 1], [apiError(403, "rateLimitExceeded"), "rate", "rateLimitExceeded", 1],
    [apiError(400, "keyInvalid"), "key_or_request", "keyInvalid", 1], [[500, "oops"], "http_500", null, 1], [[200, "<html>not json</html>"], "unreadable", null, 1],
    [[200, { kind: "x" }], "unreadable", null, 1], [Object.assign(new Error("slow"), { name: "TimeoutError" }), "timeout", null, 1], [new Error("socket " + KEY), "fetch_error", null, 1],
  ];
  for (const [hit, outcome, reason, sent] of cases) {
    const got = await readPublicList(OWN.personal, KEY, net(hit));
    assert.deepEqual([got.outcome, got.reason, got.sent, got.ids], [outcome, reason, sent, []], outcome);
    assert.doesNotMatch(JSON.stringify(got), new RegExp(KEY), "no key in what comes back: " + outcome);
  }
  /* the second page does not answer: the 50 channels of the first are NOT a list */
  const half = await readPublicList(OWN.scintilla, KEY, net((u) => (u.includes("pageToken=") ? [500, "oops"] : subsPage(many(50), "page1"))));
  assert.deepEqual([half.outcome, half.sent, half.pages, half.ids], ["http_500", 2, 1, []], "two units spent, nothing used");
  /* a list that never ends is given up after 10 pages */
  const endless = await readPublicList(OWN.scintilla, KEY, net((_u, n) => subsPage(many(50, n * 50), "more")));
  assert.deepEqual([endless.outcome, endless.sent, endless.ids], ["too_long", LIST_MAX_PAGES, []]);
  /* the pass had one unit left and the list has two pages */
  const short = await readPublicList(OWN.scintilla, KEY, net(subsPage(many(50), "page1")), { maxPages: 1 });
  assert.deepEqual([short.outcome, short.sent, short.ids], ["day", 1, []]);
  const fn = net(subsPage([]));
  assert.deepEqual([(await readPublicList("", KEY, fn)).outcome, (await readPublicList("UCshort", KEY, fn)).outcome, (await readPublicList(OWN.golf, "", fn)).outcome], ["no_channel_id", "no_channel_id", "no_key"]);
  assert.equal(fn.calls.length, 0, "none of the three is sent");
  /* the measured case: a clean 200 that carries no channel at all */
  const empty = await readPublicList(OWN.soundscapes, KEY, net(subsPage([], null, 0)));
  assert.deepEqual([empty.outcome, empty.sent, empty.ids], ["ok", 1, []], "by its status this is a list — which is why the next rule exists");
});

test("a list read the public way is taken only if it is 60–300 % of the saved one; the two numbers live in the settings row", () => {
  const take = (saved, fresh, notice = NOTICE) => { const v = acceptList({ saved, fresh, notice }); return [v.take, v.code, v.pct]; };
  assert.deepEqual([NOTICE.list_min_pct, NOTICE.list_max_pct], [60, 300]);
  assert.deepEqual(take(55, 56), [true, "ok", 102], "the measured night: 55 saved, 56 read");
  assert.deepEqual(take(47, 0), [false, "empty", 0], "the measured night: 47 saved, YouTube shows none — kept");
  assert.deepEqual([take(55, 33), take(55, 32)], [[true, "ok", 60], [false, "smaller", 58]], "33 of 55 is exactly 60 %");
  assert.deepEqual([take(55, 165), take(55, 166)], [[true, "ok", 300], [false, "larger", 302]]);
  assert.deepEqual([take(14, 8), take(14, 9)], [[false, "smaller", 57], [true, "ok", 64]]);
  assert.deepEqual([take(0, 12), take(0, 0)], [[true, "first", null], [true, "first", null]], "an account with nothing saved takes what it is given");
  const loose = noticeSettings({ list_min_pct: 30, list_max_pct: 500 });
  assert.deepEqual([take(55, 20, loose), take(55, 270, loose), take(55, 16, loose)], [[true, "ok", 36], [true, "ok", 491], [false, "smaller", 29]]);
  assert.deepEqual([NOTICE_LIMITS.list_min_pct, NOTICE_LIMITS.list_max_pct], [[1, 100], [100, 1000]], "a slip in the row cannot switch the rule off: at least 1 %, and never under the saved size as a ceiling");
  assert.equal(take(55, 0, noticeSettings({ list_min_pct: 0 }))[0], false, "and an empty answer is never taken over a saved list");
});

test("a channel missing from the list has not left until YouTube, asked directly, does not give it back", async () => {
  const [a, b, c2, d, bridged] = many(5, 200);
  const fn = net(subsPage([b]));
  const q = await askStillSubscribed(OWN.scintilla, [b, c2], KEY, fn);
  assert.deepEqual([q.outcome, q.sent, [...q.still]], ["ok", 1, [b]]);
  assert.equal(fn.calls[0].url, "https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&maxResults=50&channelId=" + OWN.scintilla + "&forChannelId=" + b + "," + c2 + "&key=" + KEY);
  assert.equal(stillSubscribedPath(OWN.golf, [a]), "subscriptions?part=snippet&maxResults=50&channelId=" + OWN.golf + "&forChannelId=" + a);
  /* an answer naming a channel that was not asked about is not believed */
  assert.deepEqual([...(await askStillSubscribed(OWN.scintilla, [c2], KEY, net(subsPage([a, c2])))).still], [c2]);
  const failed = await askStillSubscribed(OWN.scintilla, [b], KEY, net([500, "oops"]));
  assert.deepEqual([failed.outcome, failed.still, failed.sent], ["http_500", null, 1]);
  assert.deepEqual([(await askStillSubscribed(OWN.scintilla, many(120), KEY, net(subsPage([])))).sent], [3], "50 to a question");
  /* who left, and what the list becomes */
  const saved = [a, b, c2, bridged], fresh = [a, d];
  assert.deepEqual(missingFrom(saved, fresh, [bridged]), [b, c2], "a channel that rides with the list (the bridge) is not asked about");
  assert.deepEqual(settleList({ saved, fresh, riding: [bridged], still: new Set([b]) }), { ids: [a, d, b], left: [c2], held: [b], asked: true }, "b is still followed: it stays; c left");
  assert.deepEqual(settleList({ saved, fresh, riding: [bridged], still: null }), { ids: [a, d, b, c2], left: [], held: [b, c2], asked: false }, "the question could not be asked: nobody leaves");
  assert.deepEqual(settleList({ saved: [a], fresh: [a, d], still: null }), { ids: [a, d], left: [], held: [], asked: false }, "nothing missing: nothing to ask");
  assert.deepEqual([...stillFromAnswer(200, subsPage([b, a]), [b, c2])], [b], "the same answer read out of a sign-in's own call");
  assert.deepEqual([stillFromAnswer(401, { error: {} }, [b]), stillFromAnswer(200, null, [b]), stillFromAnswer(200, { items: "x" }, [b])], [null, null, null]);
});

test("the tag comes off and nothing else: another list's tag stays, a row without the tag is left alone", () => {
  const [gone, other] = many(2, 300);
  const rows = [held(vid(1), gone, ["scintilla"]), held(vid(2), gone, ["scintilla"]), held(vid(3), gone, ["personal", "scintilla"]), held(vid(4), gone, ["scintilla", "soundscapes", "personal"]),
    held(vid(5), other, ["scintilla", "personal"]), held(vid(6), gone, ["soundscapes"]), held(vid(7), gone, []), { video_id: vid(8), channel_id: gone, subscription_accounts: null }];
  const groups = untagGroups(rows, "scintilla");
  assert.deepEqual(groups.map((g) => [g.next, g.ids]), [[[], [vid(1), vid(2)]], [["personal"], [vid(3), vid(5)]], [["soundscapes", "personal"], [vid(4)]]]);
  assert.deepEqual(groups[1].channels, { [gone]: 1, [other]: 1 }, "counted per channel");
  assert.deepEqual(untagGroups(rows, "golf"), [], "nobody carries that tag");
  assert.deepEqual(untagGroups(null, "scintilla"), []);
});

test("how often the public way is tried, and what the result row says about a list", () => {
  assert.deepEqual([NOTICE.list_retry_min, SLOW_AGAIN], [360, ["private", "empty", "smaller", "larger", "not_found", "closed", "too_long"]]);
  assert.equal(publicWayDue(undefined, NOW, NOTICE), true, "never tried");
  assert.deepEqual([59, 61].map((m) => publicWayDue({ w: "public", a: minAgo(m), t: minAgo(m) }, NOW, NOTICE)), [false, true], "a list it can read: once an hour");
  assert.deepEqual([61, 359, 361].map((m) => publicWayDue({ t: minAgo(m), k: "private" }, NOW, NOTICE)), [false, false, true], "private: being told again costs a unit, so every six hours");
  assert.deepEqual([61, 361].map((m) => publicWayDue({ t: minAgo(m), k: "empty" }, NOW, NOTICE)), [false, true]);
  assert.deepEqual([59, 61].map((m) => publicWayDue({ t: minAgo(m), k: "http_500" }, NOW, NOTICE)), [false, true], "YouTube not answering is tried again the next hour");
  assert.equal(publicWayDue({ t: minAgo(61), k: "private" }, NOW, noticeSettings({ list_retry_min: 60 })), true, "the six hours are a setting");
  const says = (line, savedTs = minAgo(12), n = 56) => listSays({ line, savedTs, savedCount: n, nowSec: NOW, notice: NOTICE });
  assert.deepEqual(says({ w: "public", a: minAgo(12), t: minAgo(12), n: 56 }), { way: "public", at: new Date(minAgo(12) * 1000).toISOString(), channels: 56 });
  assert.deepEqual(says({ w: "sign-in", a: minAgo(12) }), { way: "sign-in", at: new Date(minAgo(12) * 1000).toISOString(), channels: 56 });
  const priv = says({ t: minAgo(30), k: "private" }, sec(Date.UTC(2026, 8, 30, 14, 15, 2)), 25);
  assert.deepEqual([priv.way, priv.at, priv.channels, priv.tried, priv.again_in_min], ["kept", "2026-09-30T14:15:02.000Z", 25, new Date(minAgo(30) * 1000).toISOString(), 330]);
  assert.match(priv.why, /keeps this account's subscriptions private \(403\)/);
  const empty = says({ t: minAgo(30), k: "empty", n: 0, p: 0 }, minAgo(9000), 47);
  assert.equal(empty.why, "YouTube showed no subscriptions at all for this account, against 47 saved — the saved list stays");
  const was = says({ w: "public", a: minAgo(70), t: minAgo(10), k: "http_500" }, minAgo(70));
  assert.deepEqual([was.way, was.last_refreshed, was.again_in_min], ["kept", "public", 50], "kept this hour; the list in force is still the one the public way brought");
  assert.deepEqual(says(undefined, minAgo(40)), { way: "kept", at: new Date(minAgo(40) * 1000).toISOString(), channels: 56, why: "saved by a sign-in or by hand, before this function kept track" });
  assert.equal(says({ w: "public", a: minAgo(500) }, minAgo(40)).way, "kept", "a list saved since by something else is not called ours");
  assert.equal(says(undefined, 0, 0).why, "nothing is saved for this account");
  assert.match(keptWords("smaller", { n: 20, p: 36 }, 55), /had 20 channels against 55 saved \(36%\) — too few/);
  assert.match(keptWords("larger", { n: 200, p: 364 }, 55), /too many/);
  for (const c of ["not_found", "closed", "too_long", "no_id", "untag", "day", "neighbours", "no_time", "quota", "off", "http_503"]) assert.ok(keptWords(c, null, 3).length > 20, c);
});

/* =====================================================================================================
   2 · THE LISTS WITHOUT A SIGN-IN — the sweep itself
   ===================================================================================================== */
const OFF = { [SETTINGS_KEY]: { notice: 0 } };                // these tests are about the lists: the notice has its own, below
const SIGN_INS = { YT_OAUTH_CLIENT_ID: "client", YT_OAUTH_CLIENT_SECRET: "client-secret-NEVER-SHOWN",
  ...Object.fromEntries(["PERSONAL", "SCINTILLA", "SOUNDSCAPES", "GOLF", "AI_RESEARCH"].map((a) => ["YT_REFRESH_TOKEN_" + a, "refresh-" + a + "-NEVER-SHOWN"])) };
const iso = (s) => new Date(s * 1000).toISOString();

test("the measured night: one list YouTube shows, three it keeps private, one it shows empty, one never connected — only the first changes, and the row says all of it", async () => {
  const saved = { scintilla: many(55, 1000), personal: many(25, 2000), soundscapes: many(47, 3000), golf: many(14, 4000), ai_research: many(31, 5000) };
  const joined = "UC" + "9".repeat(22), now56 = [...saved.scintilla, joined];
  const youtube = { [OWN.scintilla]: [now56.slice(0, 49), now56.slice(49)], [OWN.personal]: PRIVATE, [OWN.golf]: PRIVATE, [OWN.ai_research]: PRIVATE, [OWN.soundscapes]: [[]] };
  const first = await runSweep({ config: cfg(saved, { ...OFF, ...SIGN_INS }), lists: youtube });
  const { result, tables, log } = first;
  /* the SCINTILLA list is the one read the public way, first, on two pages */
  assert.deepEqual(listCalls(log).map((u) => decodeURIComponent(u.match(/channelId=([^&]+)/)[1])), [OWN.scintilla, OWN.scintilla, OWN.personal, OWN.soundscapes, OWN.golf, OWN.ai_research]);
  assert.deepEqual(stored(tables, "yt_sub_channels_scintilla"), { ids: now56, ts: NOW }, "56 channels saved, in the shape the list row always had");
  for (const account of ["personal", "soundscapes", "golf", "ai_research"]) assert.deepEqual(stored(tables, "yt_sub_channels_" + account), { ids: saved[account], ts: minAgo(90) }, account + ": the saved list is exactly what it was");
  assert.ok(log.fetched.includes("https://www.youtube.com/feeds/videos.xml?channel_id=" + joined), "the channel that joined is read in this same pass");
  /* per account: which way, and when */
  const a = result.accounts;
  assert.deepEqual(a.scintilla, { channels: 56, error: "invalid_grant", list: { way: "public", at: iso(NOW), channels: 56 } });
  assert.deepEqual([a.personal.channels, a.personal.error, a.personal.list.way, a.personal.list.at, a.personal.list.tried, a.personal.list.again_in_min], [25, "invalid_grant", "kept", iso(minAgo(90)), iso(NOW), 360]);
  assert.match(a.personal.list.why, /keeps this account's subscriptions private \(403\), so its list cannot be read without a sign-in/);
  assert.deepEqual([a.soundscapes.list.way, a.soundscapes.list.channels, a.soundscapes.list.why], ["kept", 47, "YouTube showed no subscriptions at all for this account, against 47 saved — the saved list stays"]);
  assert.deepEqual(a.fitness, { channels: 0, error: "not connected", list: { way: "kept", at: null, channels: 0, why: "no channel id is on file for this account, and its sign-in does not answer" } });
  /* the lists block: the private accounts are NAMED, every kept list has its reason, and the units are counted */
  const l = result.lists;
  assert.deepEqual(l.private, ["personal", "golf", "ai_research"]);
  assert.deepEqual(Object.keys(l.kept), ["personal", "soundscapes", "golf", "ai_research", "fitness"]);
  assert.deepEqual(l.refreshed, [{ account: "scintilla", way: "public", channels: 56, joined: 1, left: 0, held: 0, untagged_videos: 0 }]);
  assert.deepEqual([l.left, l.held, l.untagged_videos, l.units, l.error], [[], [], 0, 6, null], "2 pages + 4 single answers: 6 units");
  assert.deepEqual([result.units.pass.lists, result.units.pass.counts, result.units.pass.uploads, result.units.today.second_way], [6, 0, 0, 6], "and they are part of the day's number");
  const health = stored(tables, HEALTH_KEY);
  assert.deepEqual([health.used, health.day], [6, "2026-10-12"]);
  assert.deepEqual(health.ls, { scintilla: { w: "public", a: NOW, t: NOW, n: 56 }, personal: { t: NOW, k: "private" }, soundscapes: { t: NOW, k: "empty", n: 0, p: 0 }, golf: { t: NOW, k: "private" }, ai_research: { t: NOW, k: "private" } });
  assert.equal(log.writes.filter((w) => w.table === "youtube_videos").length, 0, "no stored video was touched");
  assert.doesNotMatch(JSON.stringify(result) + JSON.stringify(tables.app_config.filter((r) => !/KEY|SECRET|TOKEN/.test(r.key))) + JSON.stringify(log.fetched), /NEVER-SHOWN/, "no key, secret or token in anything stored, reported or asked");

  /* five minutes later nobody is asked again — and the private accounts are still named */
  const second = await runSweep({ store: first.store, lists: youtube, nowMs: T0 + 5 * 60000 });
  assert.deepEqual([asked(second.log, "subscriptions"), second.result.lists.units, second.result.lists.private], [[], 0, ["personal", "golf", "ai_research"]]);
  assert.deepEqual(second.result.accounts.scintilla, { channels: 56, error: null, list: { way: "public", at: iso(NOW), channels: 56 } }, "the list is fresh: no sign-in is even tried");
  assert.equal(second.result.accounts.personal.list.again_in_min, 355);
  /* an hour on: the list YouTube shows is read again; the private ones are not (a unit each to be told the same) */
  const hour = await runSweep({ store: second.store, lists: youtube, nowMs: T0 + 61 * 60000 });
  assert.deepEqual(listCalls(hour.log).map((u) => decodeURIComponent(u.match(/channelId=([^&]+)/)[1])), [OWN.scintilla, OWN.scintilla]);
  assert.deepEqual([hour.result.accounts.scintilla.list.at, hour.result.lists.units, stored(hour.tables, HEALTH_KEY).used], [iso(NOW + 61 * 60), 2, 8]);
  /* six hours on: they are asked once more */
  const six = await runSweep({ store: hour.store, lists: youtube, nowMs: T0 + 361 * 60000 });
  assert.deepEqual(listCalls(six.log).map((u) => decodeURIComponent(u.match(/channelId=([^&]+)/)[1])), [OWN.scintilla, OWN.scintilla, OWN.personal, OWN.soundscapes, OWN.golf, OWN.ai_research]);
});

test("an unsubscribe shows: the channel is asked about directly, its stored videos lose THAT account's tag and nothing else, before the list is saved", async () => {
  const [a, b, gone, d, e] = many(5, 600);
  const videos = [held(vid(1), gone, ["scintilla"]), held(vid(2), gone, ["personal", "scintilla"]), held(vid(3), gone, ["soundscapes"]), held(vid(4), a, ["scintilla"]), held(vid(5), e, ["personal"])];
  const before = JSON.parse(JSON.stringify(videos));
  const config = cfg({ scintilla: [a, b, gone, d] }, OFF, { own: ["scintilla"] }).concat(cfg({ personal: [gone, e] }, {}, { listedMinAgo: 20, own: [] }).filter((r) => r.key === "yt_sub_channels_personal"));
  const { result, tables, log } = await runSweep({ config, videos, lists: { [OWN.scintilla]: [[a, b, d]] },
    feeds: { [gone]: feedXml("Channel gone", [{ id: vid(2), title: "still posted", published: "2026-10-01T12:00:00+00:00" }]) } });
  assert.deepEqual([listCalls(log).length, directCalls(log).length], [1, 1], "one page, one direct question");
  assert.match(directCalls(log)[0], new RegExp("channelId=" + OWN.scintilla + "&forChannelId=" + gone + "&key="), "the question names only the channel that is missing");
  assert.deepEqual(row(tables, vid(1)).subscription_accounts, [], "its only tag is gone — the row is still there");
  assert.deepEqual(row(tables, vid(2)).subscription_accounts, ["personal"], "the personal list still carries the channel: that tag stays");
  assert.deepEqual(row(tables, vid(3)).subscription_accounts, ["soundscapes"], "a row without the tag is not written");
  assert.deepEqual([row(tables, vid(4)).subscription_accounts, row(tables, vid(5)).subscription_accounts], [["scintilla"], ["personal"]], "other channels' videos are not touched");
  assert.equal(tables.youtube_videos.length, 5, "no row was deleted");
  for (const was of before) { const { subscription_accounts: _x, ...rest } = row(tables, was.video_id), { subscription_accounts: _y, ...same } = was; assert.deepEqual(rest, same, "nothing else on " + was.video_id + " changed"); }
  const videoWrites = log.writes.filter((w) => w.table === "youtube_videos");
  assert.deepEqual(videoWrites.map((w) => [w.op, w.key, w.set]), [["update", vid(1), ["subscription_accounts"]], ["update", vid(2), ["subscription_accounts"]]]);
  const order = log.writes.map((w) => w.key);
  assert.ok(order.indexOf(vid(2)) < order.indexOf("yt_sub_channels_scintilla"), "the tags come off BEFORE the list is saved");
  assert.deepEqual(stored(tables, "yt_sub_channels_scintilla"), { ids: [a, b, d], ts: NOW });
  assert.ok(log.fetched.includes("https://www.youtube.com/feeds/videos.xml?channel_id=" + gone), "the channel is still read — for the personal list");
  assert.equal(log.fetched.filter((u) => u.endsWith("channel_id=" + gone)).length, 1, "once, not twice: it is on one list now");
  assert.equal(result.membership_updates, 0, "and reading it does not put the tag back");
  assert.deepEqual(result.lists.left, [{ account: "scintilla", id: gone, name: "Channel " + gone.slice(-4), videos: 2 }]);
  assert.deepEqual([result.lists.untagged_videos, result.lists.units, result.lists.held, result.lists.error], [2, 2, [], null]);
  assert.deepEqual(result.lists.refreshed, [{ account: "scintilla", way: "public", channels: 3, joined: 0, left: 1, held: 0, untagged_videos: 2 }]);
  assert.deepEqual(stored(tables, HEALTH_KEY).gone, [["scintilla", gone, NOW, 2]], "who left, when and how many videos is remembered");
  assert.deepEqual(result.lists.recently_left, [{ account: "scintilla", id: gone, at: iso(NOW), videos: 2 }]);
});

test("missing from YouTube's list is not the same as gone: a channel YouTube still gives back when asked stays, and so does every channel when it cannot be asked", async () => {
  const [a, b, c2, d, e, f] = many(6, 700);
  const videos = () => [held(vid(1), c2, ["scintilla"]), held(vid(2), d, ["scintilla"])];
  const config = () => cfg({ scintilla: [a, b, c2, d, e, f] }, OFF, { own: ["scintilla"] });
  /* the list came back without c and d; asked directly, YouTube says the account still follows c */
  const one = await runSweep({ config: config(), videos: videos(), lists: { [OWN.scintilla]: [[a, b, e, f]] }, follows: { [OWN.scintilla]: [a, b, c2, e, f] } });
  assert.deepEqual(stored(one.tables, "yt_sub_channels_scintilla").ids, [a, b, e, f, c2], "c stays on the list; d left");
  assert.deepEqual([row(one.tables, vid(1)).subscription_accounts, row(one.tables, vid(2)).subscription_accounts], [["scintilla"], []]);
  assert.deepEqual(one.result.lists.held, [{ account: "scintilla", id: c2, why: "YouTube says the account still follows it" }]);
  assert.deepEqual(one.result.lists.refreshed, [{ account: "scintilla", way: "public", channels: 5, joined: 0, left: 1, held: 1, untagged_videos: 1 }]);
  /* the direct question does not answer: nobody leaves this hour */
  const two = await runSweep({ config: config(), videos: videos(), lists: { [OWN.scintilla]: [[a, b, e, f]] }, follows: { [OWN.scintilla]: [500, "oops"] } });
  assert.deepEqual(stored(two.tables, "yt_sub_channels_scintilla"), { ids: [a, b, e, f, c2, d], ts: NOW }, "the list is saved — with both still on it");
  assert.deepEqual([row(two.tables, vid(1)).subscription_accounts, row(two.tables, vid(2)).subscription_accounts], [["scintilla"], ["scintilla"]]);
  assert.deepEqual(two.result.lists.held.map((h) => h.why), ["YouTube could not be asked about it", "YouTube could not be asked about it"]);
  assert.deepEqual([two.result.lists.left, two.result.lists.untagged_videos, two.result.lists.units, two.log.writes.filter((w) => w.table === "youtube_videos").length], [[], 0, 2, 0]);
});

test("a channel that rides with the SCINTILLA list (the bridge) does not leave when the account stops following it", async () => {
  const [a, b, rides] = many(3, 800);
  const { result, tables, log } = await runSweep({ config: cfg({ scintilla: [a, b, rides] }, { ...OFF, yt_bridge_channels: [rides] }, { own: ["scintilla"] }), videos: [held(vid(1), rides, ["scintilla"])], lists: { [OWN.scintilla]: [[a, b]] } });
  assert.deepEqual([directCalls(log), result.lists.left, result.lists.held], [[], [], []], "it is not even asked about");
  assert.deepEqual(row(tables, vid(1)).subscription_accounts, ["scintilla"]);
  assert.deepEqual(stored(tables, "yt_sub_channels_scintilla").ids, [a, b], "the account's own list is what YouTube says");
  assert.deepEqual([result.accounts.scintilla.channels, result.accounts.scintilla.list.channels, result.bridge.added_to_scintilla], [3, 2, 1], "and the channel is still carried");
  assert.ok(log.fetched.includes("https://www.youtube.com/feeds/videos.xml?channel_id=" + rides));
});

test("if the tags cannot be taken off, the list is not saved: the hour is tried again, and nothing is half done", async () => {
  const [a, b, c2, gone] = many(4, 900);
  const config = cfg({ scintilla: [a, b, c2, gone] }, OFF, { own: ["scintilla"] }), lists = { [OWN.scintilla]: [[a, b, c2]] };
  const first = await runSweep({ config, videos: [held(vid(1), gone, ["scintilla"])], lists, failUpdate: (payload) => "subscription_accounts" in payload });
  assert.deepEqual(stored(first.tables, "yt_sub_channels_scintilla"), { ids: [a, b, c2, gone], ts: minAgo(90) }, "the saved list is what it was");
  assert.deepEqual(row(first.tables, vid(1)).subscription_accounts, ["scintilla"]);
  assert.match(first.result.lists.error, /the tags could not be taken off \(scintilla\): the table said no/);
  assert.deepEqual([first.result.lists.refreshed, first.result.lists.left, first.result.accounts.scintilla.list.way], [[], [], "kept"]);
  assert.match(first.result.accounts.scintilla.list.why, /tags could not be taken off the videos of the channels that left, so the list was not changed/);
  assert.equal(stored(first.tables, HEALTH_KEY).ls.scintilla.k, "untag");
  const soon = await runSweep({ store: first.store, lists, nowMs: T0 + 5 * 60000 });
  assert.deepEqual(asked(soon.log, "subscriptions"), [], "not on every pass");
  const later = await runSweep({ store: soon.store, lists, nowMs: T0 + 61 * 60000 });
  assert.deepEqual([stored(later.tables, "yt_sub_channels_scintilla").ids, row(later.tables, vid(1)).subscription_accounts, later.result.lists.untagged_videos, later.result.lists.error], [[a, b, c2], [], 1, null], "the next hour does it");
});

test("a list that came back in part, too small or too large is not taken — the saved list stays and the row says why", async () => {
  const saved = many(55, 1000);
  const run = (lists, extra = {}) => runSweep({ config: cfg({ scintilla: saved }, { [SETTINGS_KEY]: { notice: 0, ...extra } }, { own: ["scintilla"] }), videos: [held(vid(1), saved[54], ["scintilla"])], lists });
  const kept = (r) => [stored(r.tables, "yt_sub_channels_scintilla"), row(r.tables, vid(1)).subscription_accounts, r.result.lists.refreshed, r.result.accounts.scintilla.list.way];
  const same = [{ ids: saved, ts: minAgo(90) }, ["scintilla"], [], "kept"];
  const half = await run({ [OWN.scintilla]: [saved.slice(0, 50), [500, "oops"]] });
  assert.deepEqual(kept(half), same, "page two did not answer: the first 50 are not a list, and nobody is untagged");
  assert.deepEqual([half.result.lists.units, half.result.accounts.scintilla.list.why, half.result.accounts.scintilla.list.again_in_min], [2, "YouTube did not answer (http_500)", 60]);
  const small = await run({ [OWN.scintilla]: [saved.slice(0, 20)] });
  assert.deepEqual(kept(small), same);
  assert.equal(small.result.accounts.scintilla.list.why, "the list read had 20 channels against 55 saved (36%) — too few to be taken, the saved list stays");
  assert.equal(small.result.accounts.scintilla.list.again_in_min, 360);
  const large = await run({ [OWN.scintilla]: [many(50, 7000), many(50, 7050), many(50, 7100), many(50, 7150)] });
  assert.deepEqual(kept(large), same);
  assert.match(large.result.accounts.scintilla.list.why, /had 200 channels against 55 saved \(364%\) — too many/);
  /* the floor is a number in the settings row: lowered to 30 %, the same 20 channels are taken — and the 35 that left are asked about and untagged */
  const let20 = await run({ [OWN.scintilla]: [saved.slice(0, 20)] }, { list_min_pct: 30 });
  assert.deepEqual([stored(let20.tables, "yt_sub_channels_scintilla").ids.length, row(let20.tables, vid(1)).subscription_accounts, let20.result.lists.left.length, directCalls(let20.log).length], [20, [], 35, 1]);
});

test("a sign-in that works is still the first way: the public way is not asked, and a channel that left under it is confirmed with the sign-in and untagged the same", async () => {
  const [a, b, gone] = many(3, 1100);
  const { result, tables, log } = await runSweep({
    config: cfg({ scintilla: [a, b, gone] }, { ...OFF, YT_OAUTH_CLIENT_ID: "client", YT_OAUTH_CLIENT_SECRET: "client-secret-NEVER-SHOWN", YT_REFRESH_TOKEN_SCINTILLA: "refresh-ok" }, { own: ["scintilla"] }),
    videos: [held(vid(1), gone, ["scintilla"]), held(vid(2), a, ["scintilla"])], signIn: { "refresh-ok": { token: "access-1" } }, mine: { "access-1": [a, b] }, lists: { [OWN.scintilla]: [[a]] } });
  assert.deepEqual(result.accounts.scintilla, { channels: 2, error: null, list: { way: "sign-in", at: iso(NOW), channels: 2 } });
  assert.ok(asked(log, "subscriptions").every((u) => u.includes("mine=true") && !u.includes("key=")), "every list call was the sign-in's own");
  assert.equal(asked(log, "subscriptions").filter((u) => u.includes("forChannelId=" + gone)).length, 1, "the channel that is missing is asked about with the sign-in");
  assert.deepEqual([stored(tables, "yt_sub_channels_scintilla"), row(tables, vid(1)).subscription_accounts, row(tables, vid(2)).subscription_accounts], [{ ids: [a, b], ts: NOW }, [], ["scintilla"]]);
  assert.deepEqual([result.lists.refreshed, result.lists.units], [[{ account: "scintilla", way: "sign-in", channels: 2, joined: 0, left: 1, held: 0, untagged_videos: 1 }], 0], "a sign-in's calls cost none of the key's units");
  assert.deepEqual(stored(tables, HEALTH_KEY).ls.scintilla, { w: "sign-in", a: NOW });
  /* a sign-in's list that came back SHORT: the channel it lacks is asked about with the sign-in, YouTube gives it back, and it stays — tags and all */
  const signedIn = (videos, mine) => runSweep({ videos, signIn: { "refresh-ok": { token: "access-1" } }, mine: { "access-1": mine },
    config: cfg({ scintilla: [a, b, gone] }, { ...OFF, YT_OAUTH_CLIENT_ID: "client", YT_OAUTH_CLIENT_SECRET: "client-secret-NEVER-SHOWN", YT_REFRESH_TOKEN_SCINTILLA: "refresh-ok" }, { own: ["scintilla"] }) });
  const short = await signedIn([held(vid(1), gone, ["scintilla"]), held(vid(2), b, ["scintilla"])], { list: [a], follows: [a, b] });
  assert.deepEqual([stored(short.tables, "yt_sub_channels_scintilla").ids, row(short.tables, vid(2)).subscription_accounts, row(short.tables, vid(1)).subscription_accounts], [[a, b], ["scintilla"], []]);
  assert.deepEqual(short.result.lists.held, [{ account: "scintilla", id: b, why: "YouTube says the account still follows it" }]);
  /* and when the sign-in cannot be asked that question, nobody leaves */
  const mute = await signedIn([held(vid(1), gone, ["scintilla"])], { list: [a], follows: [500, "oops"] });
  assert.deepEqual([stored(mute.tables, "yt_sub_channels_scintilla").ids, row(mute.tables, vid(1)).subscription_accounts, mute.result.lists.left], [[a, b, gone], ["scintilla"], []]);
});

test("the lists' pages come out of the day: nothing is asked when the day is spent, switched off, or the lists alone are switched off", async () => {
  const saved = many(5, 1200), lists = { [OWN.scintilla]: [saved] };
  const run = (settings, health) => runSweep({ config: cfg({ scintilla: saved }, { [SETTINGS_KEY]: { notice: 0, ...settings }, ...(health ? { [HEALTH_KEY]: health } : {}) }, { own: ["scintilla"] }), lists });
  const spent = await run({}, healthRow({}, { used: 580 }));
  assert.deepEqual([asked(spent.log, "subscriptions"), spent.result.accounts.scintilla.list.way, spent.result.accounts.scintilla.list.why], [[], "kept", "the day's calls were spent before this list's turn"]);
  const off = await run({ per_day: 0 });
  assert.deepEqual([asked(off.log, "subscriptions"), off.result.accounts.scintilla.list.why], [[], "the public way is switched off in app_config (yt_rss_fallback)"]);
  const listsOff = await run({ lists: 0 });
  assert.deepEqual([asked(listsOff.log, "subscriptions"), listsOff.result.accounts.scintilla.list.why, listsOff.result.lists.units], [[], "the public way is switched off in app_config (yt_rss_fallback)", 0]);
  const quota = await runSweep({ config: cfg({ scintilla: saved, personal: saved }, OFF, { own: ["scintilla", "personal"] }), lists: { [OWN.scintilla]: apiError(403, "quotaExceeded"), [OWN.personal]: [saved] } });
  assert.deepEqual([listCalls(quota.log).length, quota.result.accounts.scintilla.list.why, stored(quota.tables, HEALTH_KEY).quota_day], [1, "YouTube said the day's allowance is gone", "2026-10-12"], "YouTube says the day is gone: the next account is not even asked");
  assert.equal(quota.result.accounts.personal.list.why, "YouTube said the day's allowance is gone");
  /* one unit left in the day and a list of two pages: the read stops, nothing is taken */
  const one = await runSweep({ config: cfg({ scintilla: many(55, 1300) }, { ...OFF, [HEALTH_KEY]: healthRow({}, { used: 579 }) }, { own: ["scintilla"] }), lists: { [OWN.scintilla]: [many(50, 1300), many(5, 1350)] } });
  assert.deepEqual([listCalls(one.log).length, one.result.accounts.scintilla.list.why, stored(one.tables, HEALTH_KEY).used], [1, "the day's calls were spent before this list's turn", 580]);
});

test("?dry=lists — each account's list read the public way and set against the saved one: nothing saved, no tag taken off, no sign-in row read", async () => {
  const [a, b, gone, joined] = many(4, 1400);
  const config = cfg({ scintilla: [a, b, gone], personal: many(3, 1500), soundscapes: many(4, 1600) }, { ...SIGN_INS, yt_rss_running: { ts: 0 } }, { own: ["scintilla", "personal", "soundscapes"] });
  const snapshot = JSON.stringify(config);
  const videos = [held(vid(1), gone, ["scintilla"]), held(vid(2), gone, ["scintilla", "personal"]), held(vid(3), a, ["scintilla"])];
  const { result, tables, log } = await runSweep({ config, videos, query: "?dry=lists", lists: { [OWN.scintilla]: [[a, b, joined]], [OWN.personal]: PRIVATE, [OWN.soundscapes]: [[]] } });
  assert.deepEqual([result.dry, result.wrote, result.units_spent, result.rule], ["lists", "nothing", 4, { taken_if_pct_of_saved: [60, 300], pages_at_most: 10 }], "3 lists asked + 1 direct question");
  const [s, p, sound, golf] = result.accounts;
  assert.deepEqual([s.account, s.saved, s.outcome, s.read, s.pct_of_saved, s.would, s.becomes], ["scintilla", 3, "ok", 3, 100, "take the list read", 3]);
  assert.deepEqual(s.joined, [{ id: joined, name: "Channel " + joined.slice(-4) }]);
  assert.deepEqual(s.left, [{ id: gone, name: "Channel " + gone.slice(-4), videos_that_would_lose_the_tag: 2 }]);
  assert.deepEqual(s.asked_directly, { channels: 1, outcome: "ok", still_followed: 0 });
  assert.deepEqual([p.account, p.outcome, p.would], ["personal", "private", "keep the saved list"]);
  assert.match(p.says, /private \(403\)/);
  assert.deepEqual([sound.outcome, sound.read, sound.would, sound.says], ["ok", 0, "keep the saved list", "YouTube showed no subscriptions at all for this account, against 4 saved — the saved list stays"]);
  assert.deepEqual([golf.account, golf.outcome, golf.would], ["golf", "not asked", "keep the saved list"]);
  assert.deepEqual(log.writes, [], "nothing written — not a list, not a tag, not the lock, not the remembered row");
  assert.equal(JSON.stringify(tables.app_config), snapshot);
  assert.deepEqual(tables.youtube_videos.map((r) => r.subscription_accounts), [["scintilla"], ["scintilla", "personal"], ["scintilla"]]);
  const configRead = log.reads.find((r) => r.table === "app_config");
  assert.ok(!configRead.keys.some((k) => /OAUTH|REFRESH/.test(k)), "no OAuth secret and no refresh token is read: " + configRead.keys.join(" "));
  assert.ok(!log.fetched.some((u) => u.includes("oauth2") || u.includes("/feeds/") || u.includes("/youtube/v3/videos")), "no sign-in, no feed, no videos call");
  assert.match(result.note, /no list is saved, no tag is taken off/);
  assert.doesNotMatch(JSON.stringify(result) + JSON.stringify(log.fetched), /NEVER-SHOWN/);
  const noKey = await runSweep({ config: config.filter((r) => r.key !== "YT_API_KEY"), query: "?dry=lists" });
  assert.deepEqual([noKey.result.error, noKey.log.fetched, noKey.log.writes], ["missing YouTube API key", [], []]);
});

/* =====================================================================================================
   3 · THE NOTICE — the rules
   ===================================================================================================== */
/* the live shape: 78 channels in the SCINTILLA turn (55 of its own + 23 that ride with it), 25 personal, 83 on the other lists */
const S = many(78, 10000), P = many(25, 20000), R = many(83, 30000), ALL = [...S, ...P, ...R];
const TIER = new Map([...S.map((id) => [id, 0]), ...P.map((id) => [id, 1]), ...R.map((id) => [id, 2])]);
const DAY1200 = fallbackSettings({ per_day: 1200 });
/** a remembered row in which every channel was counted `counted` minutes ago, read `readAgo` minutes ago, a read standing behind the count */
const counted = (ids, { count = 100, countedAgo = 5, readAgo = 5, extra = {} } = {}) => Object.fromEntries(ids.map((id) => [id, { ok: minAgo(readAgo), c: count, ca: minAgo(countedAgo), cr: 1, ...extra }]));
const purse = (health, settings = DAY1200, ownToday = 0, nowSec = NOW) => passBudget({ health: parseHealth(health), settings, nowSec, ownToday });
const plan = (feedOk, health, { notice = NOTICE, settings = DAY1200, nowSec = NOW } = {}) =>
  noticePlan({ followed: ALL, tier: TIER, feedOk: new Set(feedOk), health: parseHealth(health), notice, nowSec, budget: purse(health, settings, 0, nowSec) });

test("the numbers the notice starts from, and what the same settings row can change", () => {
  assert.deepEqual(NOTICE, { notice: 1, moved_per_pass: 20, notice_min: 15, baseline_min: 60, verify_min: 720, lists: 1, list_min_pct: 60, list_max_pct: 300, list_retry_min: 360, from: "default" });
  assert.deepEqual(noticeSettings('{"per_pass":6,"per_day":450}'), { ...NOTICE, from: "app_config" }, "the row in force today keeps meaning what it meant: it names none of these");
  assert.deepEqual(fallbackSettings('{"per_pass":6,"per_day":450,"notice":0}'), { per_pass: 6, per_day: 450, after_min: 60, max_results: 15, from: "app_config" }, "and Y5's four numbers do not grow");
  const set = noticeSettings({ notice: 0, moved_per_pass: 8, notice_min: 30, baseline_min: 0, verify_min: 1440, lists: 0, list_retry_min: 120 });
  assert.deepEqual([set.notice, set.moved_per_pass, set.notice_min, set.baseline_min, set.verify_min, set.lists, set.list_retry_min], [0, 8, 30, 0, 1440, 0, 120]);
  const slip = noticeSettings({ notice: 7, moved_per_pass: 900, notice_min: 1, baseline_min: -5, verify_min: 5, lists: -1, list_retry_min: 1 });
  assert.deepEqual([slip.notice, slip.moved_per_pass, slip.notice_min, slip.baseline_min, slip.verify_min, slip.lists, slip.list_retry_min], [1, 50, 5, 0, 60, 0, 60], "clamped to the limits");
  for (const junk of ["not json", "[1]", "7"]) assert.deepEqual(noticeSettings(junk), { ...NOTICE, from: "default (the yt_rss_fallback row could not be read)" });
  assert.equal(COUNTS_PER_CALL, 50);
});

test("who is counted: every unread channel of the SCINTILLA list on every pass; the others ride in the places left over, personal first", () => {
  /* every feed fails; every count was taken five minutes ago */
  let p = plan([], healthRow(counted(ALL)));
  assert.deepEqual([p.calls, p.must_calls, p.extra_calls, p.must, p.ask.length, p.fill, p.short, p.why, p.refresh], [2, 2, 0, 78, 100, 22, 0, null, false]);
  assert.deepEqual(p.ask.slice(0, 78), S, "the SCINTILLA list fills the calls first");
  assert.deepEqual(p.ask.slice(78), P.slice(0, 22), "the 22 places left over go to the personal list, free");
  /* a partial burst: 30 of the SCINTILLA list unread, everything else answering — ONE call, and its 20 spare places keep answering channels' counts fresh */
  p = plan([...S.slice(30), ...P, ...R], healthRow(counted(ALL)));
  assert.deepEqual([p.calls, p.must, p.ask.length, p.fill], [1, 30, 50, 20]);
  assert.deepEqual(p.ask.slice(30), S.slice(30, 50), "the SCINTILLA list's own answering channels first");
  /* nothing of the SCINTILLA list is unread, and its counts are fresh: no call at all — a clean pass costs nothing */
  p = plan(ALL, healthRow(counted(ALL)));
  assert.deepEqual([p.calls, p.ask, p.why], [0, [], null]);
  /* only other lists' channels are unread and none has waited 15 minutes: still no call */
  p = plan([...S, ...P.slice(5), ...R], healthRow(counted(ALL)));
  assert.deepEqual([p.calls, p.wanting], [0, 0]);
  /* … once they have waited 15 minutes, one call, inside the day's even share */
  p = plan([...S, ...P.slice(5), ...R], healthRow(counted(ALL, { countedAgo: 16 })));
  assert.deepEqual([p.calls, p.must_calls, p.extra_calls, p.wanting, p.ask.slice(0, 5)], [1, 0, 1, 5, P.slice(0, 5)]);
});

test("the other lists get a call of their own only when their channels have waited, and only inside the day's even share; the SCINTILLA list is never held to the pace", () => {
  const waited = healthRow({ ...counted(S), ...counted([...P, ...R], { countedAgo: 20 }) });
  let p = plan([], waited);
  assert.deepEqual([p.calls, p.must_calls, p.extra_calls, p.ask.length, p.short], [4, 2, 2, 186, 0], "everyone is counted: 4 units");
  assert.deepEqual([p.ask.slice(78, 103), p.ask.slice(103)], [P, R], "personal before the rest");
  /* the day's even share is spent (1,029 of 1,200 allowed by 20:30 Pacific): the SCINTILLA list is still counted, the others take the spare places and wait for the rest */
  const paced = healthRow(waited.ch, { used: 1029 });
  p = plan([], paced);
  assert.deepEqual([p.calls, p.must_calls, p.extra_calls, p.ask.length, p.short, p.why], [2, 2, 0, 100, 86, "pace"]);
  assert.deepEqual(p.ask.slice(78), P.slice(0, 22));
  /* the day's whole number is spent: nothing */
  p = plan([], healthRow(waited.ch, { used: 1200 }));
  assert.deepEqual([p.calls, p.ask, p.short, p.why], [0, [], 186, "day"]);
  /* one unit left in the day and 42 passes to go: it is not spent ahead of the pace (see "the day must last") */
  p = plan([], healthRow(waited.ch, { used: 1199 }));
  assert.deepEqual([p.calls, p.ask, p.why], [0, [], "pace"]);
  for (const [health, settings, notice, why] of [[healthRow(waited.ch, { quota_day: "2026-10-12" }), DAY1200, NOTICE, "quota"], [waited, fallbackSettings({ per_day: 0 }), NOTICE, "off"], [waited, DAY1200, noticeSettings({ notice: 0 }), "off"]]) {
    p = plan([], health, { settings, notice });
    assert.deepEqual([p.calls, p.ask, p.why], [0, [], why]);
  }
});

test("the day must last: a number too small to count the SCINTILLA list on every pass until midnight thins the counts all day instead of leaving the evening dark", () => {
  const all = healthRow(counted(ALL));
  /* 1,200 a day carries two calls a pass to midnight with room to spare: not held to the pace, even with the pace spent */
  const big = purse(healthRow(all.ch, { used: 1029 }));
  let p = noticePlan({ followed: ALL, tier: TIER, feedOk: new Set(), health: parseHealth(all), notice: NOTICE, nowSec: NOW, budget: big });
  assert.deepEqual([big.passes_left, big.held, p.calls], [42, false, 2], "42 passes left, 171 units: two calls a pass is 84");
  /* 450 a day, at one in the morning Pacific: 276 passes left would need 552 */
  const early = sec(Date.UTC(2026, 9, 13, 8, 0, 0)), small = fallbackSettings({ per_day: 450 });
  const at = (ids, countedAgo) => Object.fromEntries(ids.map((id) => [id, { ok: early - 1800, c: 100, ca: early - countedAgo * 60, cr: 1 }]));
  const run = (used) => { const health = healthRow(at(ALL, 1), { day: "2026-10-13", used }); const b = passBudget({ health: parseHealth(health), settings: small, nowSec: early, ownToday: 0 });
    return [noticePlan({ followed: ALL, tier: TIER, feedOk: new Set(), health: parseHealth(health), notice: NOTICE, nowSec: early, budget: b }), b]; };
  let [plan1, b1] = run(0);
  assert.deepEqual([b1.passes_left, b1.held, b1.paced(), plan1.calls, plan1.ask.length, plan1.why], [276, true, 20, 2, 100, null], "held to the pace — which still has 20 units, so this pass counts everyone");
  [plan1, b1] = run(19);
  assert.deepEqual([b1.paced(), plan1.calls, plan1.ask.length, plan1.short, plan1.why], [1, 1, 50, 28, "pace"], "one unit of pace: one call, 50 of the 78");
  [plan1, b1] = run(20);
  assert.deepEqual([b1.paced(), b1.room(), plan1.calls, plan1.why], [0, 430, 0, "pace"], "the pace is spent: this pass waits, though the day has 430 left — they are the evening's");
  /* when one call is all there is, it goes to the channels longest uncounted — not always to the same 50 */
  const health = healthRow({ ...at(S.slice(0, 50), 1), ...at(S.slice(50), 6), ...at([...P, ...R], 1) }, { day: "2026-10-13", used: 19 });
  const b2 = passBudget({ health: parseHealth(health), settings: small, nowSec: early, ownToday: 0 });
  p = noticePlan({ followed: ALL, tier: TIER, feedOk: new Set(), health: parseHealth(health), notice: NOTICE, nowSec: early, budget: b2 });
  assert.deepEqual([p.calls, p.ask.slice(0, 28)], [1, S.slice(50)]);
  /* the reads of channels that moved are NOT thinned: a video known to be there is worth more than another look */
  const moved = movedPick({ moved: [S[0], S[1], P[0]], tier: TIER, health: parseHealth(health), settings: small, notice: NOTICE, nowSec: early, budget: Object.assign(b2, { spent: 1 }) });
  assert.deepEqual([b2.held, b2.paced(), moved.pick, moved.waiting, moved.cap], [true, 0, [S[0], S[1]], 1, "pace"], "the SCINTILLA list's two are read out of the day; the personal one waits for the pace");
});

test("while its feeds answer, the SCINTILLA list's counts are taken afresh once an hour, all at once — so a burst starts from counts that are minutes old", () => {
  let p = plan(ALL, healthRow(counted(ALL, { countedAgo: 59 })));
  assert.deepEqual([p.calls, p.refresh], [0, false]);
  p = plan(ALL, healthRow(counted(ALL, { countedAgo: 60 })));
  assert.deepEqual([p.calls, p.refresh, p.must, p.ask.length, p.ask.slice(0, 78), p.fill], [2, true, 78, 100, S, 22], "2 units an hour, and the 22 spare places refresh other lists' counts for nothing");
  /* one channel of the list was counted an hour ago, the rest five minutes ago: all at once still, so the hour does not splinter into many small calls */
  p = plan(ALL, healthRow({ ...counted(ALL), ...counted([S[7]], { countedAgo: 61 }) }));
  assert.deepEqual([p.calls, p.refresh, p.must], [2, true, 78]);
  /* a channel that has just joined the list has no count: that is a reason too */
  const joined = healthRow(counted(ALL)); delete joined.ch[S[3]].c; delete joined.ch[S[3]].ca;
  assert.deepEqual([plan(ALL, joined).refresh, plan(ALL, joined).calls], [true, 2]);
  assert.deepEqual([plan(ALL, healthRow(counted(ALL, { countedAgo: 600 })), { notice: noticeSettings({ baseline_min: 0 }) }).calls], [0], "0 switches the hourly refresh off");
  /* the first pass ever, with every feed answering: everything is counted once (4 units), a read standing behind each count */
  p = plan(ALL, healthRow({}));
  assert.deepEqual([p.calls, p.must_calls, p.refresh, p.ask.length], [2, 2, true, 100]);
});

test("one count call: 50 channels, 1 unit, and a number for each channel YouTube answers for", async () => {
  const ids = many(120, 40000);
  const fn = net((u) => { const asked = decodeURIComponent(u.match(/[?&]id=([^&]+)/)[1]).split(","); return { items: asked.filter((id) => id !== ids[3]).map((id) => ({ id, statistics: { videoCount: String(1000 + +id.slice(-3)) } })) }; });
  const got = await readCounts(ids, KEY, fn);
  assert.deepEqual([got.sent, got.counts.size, got.quota, got.calls.map((c) => [c.asked, c.answered, c.outcome])], [3, 119, false, [[50, 49, "ok"], [50, 50, "ok"], [20, 20, "ok"]]]);
  assert.deepEqual([got.counts.get(ids[0]), got.counts.get(ids[119]), got.counts.has(ids[3])], [1000, 1119, false], "a channel YouTube leaves out of its answer has no number, and nothing is concluded about it");
  assert.equal(fn.calls[0].url, "https://www.googleapis.com/youtube/v3/channels?part=statistics&id=" + ids.slice(0, 50).join(",") + "&maxResults=50&key=" + KEY);
  assert.ok(fn.calls.every((c) => c.signal), "each call is bounded");
  assert.doesNotMatch(JSON.stringify([...got.counts]) + JSON.stringify(got.calls), new RegExp(KEY));
  assert.deepEqual([(await readCounts([], KEY, fn)).sent, (await readCounts(["junk", ids[0], ids[0]], KEY, net({ items: [] }))).calls.map((c) => c.asked)], [0, [1]], "nothing to ask: no call; a name given twice is one channel");
  /* odd answers */
  const odd = await countsCall([ids[0], ids[1], ids[2]], KEY, net({ items: [{ id: ids[0], statistics: { videoCount: "0" } }, { id: ids[1], statistics: {} }, { id: ids[2], statistics: { videoCount: "many" } }, { id: "UC" + "x".repeat(22), statistics: { videoCount: "5" } }] }));
  assert.deepEqual([...odd.counts], [[ids[0], 0]], "0 is a real count; no number, a number that is not one, and a channel that was not asked about are left out");
  for (const [hit, outcome] of [[apiError(403, "quotaExceeded"), "quota"], [[500, "oops"], "http_500"], [[200, "<html>"], "unreadable"], [[200, { items: "x" }], "unreadable"], [new Error("socket " + KEY), "fetch_error"],
    [Object.assign(new Error("slow"), { name: "TimeoutError" }), "timeout"], [apiError(400, "keyInvalid"), "key_or_request"]]) {
    const bad = await readCounts(ids.slice(0, 60), KEY, net(hit));
    assert.deepEqual([bad.sent, bad.counts.size, bad.quota, bad.calls.map((c) => c.outcome)], [2, 0, outcome === "quota", [outcome, outcome]], outcome);
    assert.doesNotMatch(JSON.stringify(bad.calls), new RegExp(KEY));
  }
  assert.deepEqual([(await apiGet("channels?part=statistics&id=x", "", fn)).outcome, apiOutcome(429, null), apiOutcome(403, "playlistItemsNotAccessible"), apiOutcome(503, null)], ["no_key", "rate", "forbidden", "http_503"]);
});

test("what the counts say, and who is read for it: the SCINTILLA list first, then personal, then the rest; longest unread first; never past the cap", () => {
  const ids = [S[0], S[1], S[2], P[0], P[1], R[0]];
  const health = parseHealth(healthRow({ [S[0]]: { ok: minAgo(20), c: 100, ca: minAgo(5), cr: 1 }, [S[1]]: { ok: minAgo(90), c: 100, ca: minAgo(5), cr: 1 }, [S[2]]: { ok: minAgo(40), c: 100, ca: minAgo(5) },
    [P[0]]: { ok: minAgo(300), c: 7, ca: minAgo(5), cr: 1 }, [P[1]]: { ok: minAgo(10) }, [R[0]]: { ok: minAgo(500), c: 9, ca: minAgo(5), cr: 1 } }));
  const counts = new Map([[S[0], 101], [S[1], 100], [S[2], 100], [P[0], 8], [P[1], 55], [R[0], 8]]);
  const said = readCountsAgainst({ unread: ids, health, counts });
  assert.deepEqual([said.moved, [...said.confirmed], said.first], [[S[0], P[0], R[0]], [S[1]], [P[1]]],
    "moved: the number changed (up or down). confirmed: unmoved AND a read stands behind it — S[2]'s count is unmoved but nothing has read the channel since it was taken. first: no number was remembered");
  const pick = (moved, { notice = NOTICE, used = 0, settings = DAY1200, ch = health.ch } = {}) => movedPick({ moved, tier: TIER, health: { ...health, ch }, settings, notice, nowSec: NOW, budget: purse(healthRow(ch, { used }), settings) });
  assert.deepEqual(pick([R[0], P[0], S[0]]), { pick: [S[0], P[0], R[0]], waiting: 0, resting: 0, cap: null }, "whatever order they come in");
  assert.deepEqual(pick([S[1], S[0]]).pick, [S[1], S[0]], "inside a list: the one unread longest (90 minutes before 20)");
  assert.deepEqual(pick([R[0], P[0], S[0]], { notice: noticeSettings({ moved_per_pass: 2 }) }), { pick: [S[0], P[0]], waiting: 1, resting: 0, cap: "pass" });
  /* the day's even share is spent: the SCINTILLA list is read all the same; the others wait */
  assert.deepEqual(pick([R[0], P[0], S[0]], { used: 1029 }), { pick: [S[0]], waiting: 2, resting: 0, cap: "pace" });
  assert.deepEqual(pick([R[0], P[0], S[0]], { used: 1200 }), { pick: [], waiting: 3, resting: 0, cap: "day" });
  assert.deepEqual(pick([S[0], S[1]], { used: 1199 }), { pick: [S[1]], waiting: 1, resting: 0, cap: "day" }, "one unit left in the day: one read");
  /* a channel whose uploads list would not open an hour ago is not asked on every pass because its count moved */
  const shut = { ...health.ch, [S[0]]: { ...health.ch[S[0]], t: minAgo(30), x: 1 } };
  assert.deepEqual(pick([S[0], P[0]], { ch: shut }), { pick: [P[0]], waiting: 0, resting: 1, cap: null });
  assert.deepEqual(pick([], {}), { pick: [], waiting: 0, resting: 0, cap: null });
});

test("what is remembered of a count: a moved count is taken over only by a pass that READ the channel, and only a read lets a count vouch", () => {
  const [first, same, movedRead, movedWait, movedFeed, noCount, readOnly] = many(7, 50000);
  const before = parseHealth(healthRow({ [same]: { ok: minAgo(30), f: 6, c: 100, ca: minAgo(5), cr: 1 }, [movedRead]: { ok: minAgo(30), f: 6, c: 100, ca: minAgo(5), cr: 1 }, [movedWait]: { ok: minAgo(30), f: 6, c: 100, ca: minAgo(5), cr: 1 },
    [movedFeed]: { ok: minAgo(5), c: 100, ca: minAgo(65), cr: 1 }, [noCount]: { ok: minAgo(30), f: 6, c: 100, ca: minAgo(5), cr: 1 }, [readOnly]: { ok: minAgo(30), f: 6, c: 100, ca: minAgo(10) } }, { used: 40 }));
  const after = nextHealth({ health: before, channels: [first, same, movedRead, movedWait, movedFeed, noCount, readOnly], feedOk: new Set([movedFeed]), nowSec: NOW, units: 2,
    counts: new Map([[first, 12], [same, 100], [movedRead, 101], [movedWait, 103], [movedFeed, 102]]),
    reads: [{ id: movedRead, sent: true, outcome: "ok", name: "n", rows: [] }, { id: readOnly, sent: true, outcome: "ok", name: "n", rows: [] }] });
  assert.deepEqual(after.ch[first], { f: 1, b: NOW, c: 12, ca: NOW }, "seen for the first time, nothing read: the number is only remembered — it vouches for nothing");
  assert.deepEqual(after.ch[same], { ok: minAgo(30), f: 7, c: 100, ca: NOW, cr: 1 }, "unmoved: seen again now");
  assert.deepEqual(after.ch[movedRead], { ok: minAgo(30), fb: NOW, f: 7, n: "n", c: 101, ca: NOW, cr: 1 }, "moved and read in this pass: the new number is taken over");
  assert.deepEqual(after.ch[movedWait], { ok: minAgo(30), f: 7, c: 100, ca: minAgo(5), cr: 1 }, "moved and NOT read (a cap): the old number stays, so it is still 'moved' on the next pass");
  assert.deepEqual(after.ch[movedFeed], { ok: NOW, c: 102, ca: NOW, cr: 1 }, "moved, and its feed answered this pass: the feed's read stands behind the new number");
  assert.deepEqual(after.ch[noCount], { ok: minAgo(30), f: 7, c: 100, ca: minAgo(5), cr: 1 }, "not counted this pass: as it was");
  assert.deepEqual(after.ch[readOnly], { ok: minAgo(30), fb: NOW, f: 7, n: "n", c: 100, ca: minAgo(10), cr: 1 }, "read after its count was taken: now the count can vouch");
  assert.equal(after.used, 44, "two uploads reads and the two units given (list pages, count calls) — one number for the day");
  assert.deepEqual([lastSeen(after.ch[same]), lastSeen(after.ch[first]), lastSeen(after.ch[movedWait]), lastRead(after.ch[same])], [NOW, 0, minAgo(5), minAgo(30)], "seen: a read, or the last unmoved count a read stands behind");
  /* a number taken over without a read loses its voucher */
  const lost = nextHealth({ health: parseHealth(healthRow({ [first]: { f: 3, b: minAgo(15), c: 12, ca: minAgo(5), cr: 1 } })), channels: [first], feedOk: new Set(), reads: [], nowSec: NOW, counts: new Map([[first, 12]]) });
  assert.deepEqual(lost.ch[first], { f: 4, b: minAgo(15), c: 12, ca: NOW, cr: 1 });
  /* Y5's code reads a row written now exactly as it read its own (the rollback is safe) … */
  const y5reads = (row) => Object.fromEntries(Object.entries(row.ch).map(([id, e]) => [id, Object.fromEntries(Object.entries(e).filter(([k]) => ["ok", "fb", "f", "t", "x", "b", "n"].includes(k)))]));
  assert.deepEqual(y5reads(after)[movedRead], { ok: minAgo(30), fb: NOW, f: 7, n: "n" });
  /* … and a row written before Y6 gains nothing it did not have */
  const old = parseHealth(healthRow({ [same]: { ok: minAgo(5) } }));
  assert.deepEqual(Object.keys(old), ["v", "at", "day", "used", "quota_day", "ch"]);
  assert.deepEqual(nextHealth({ health: old, channels: [same], feedOk: new Set([same]), reads: [], nowSec: NOW }), { v: 1, at: NOW, day: "2026-10-12", used: 0, quota_day: "", ch: { [same]: { ok: NOW } } });
  /* odd values in the row */
  const odd = parseHealth({ ch: { [same]: { c: "12", ca: "5", cr: "yes" }, [first]: { c: -1, ca: 9, cr: 1 }, [movedRead]: { c: 0 }, [movedWait]: { c: "x", ca: 7 } },
    ls: { scintilla: { w: "public", a: 5, t: 6, k: "x".repeat(40), n: 0, p: 0, extra: 1 }, "Bad Name": { w: "public" }, golf: { w: "by magic" }, fitness: "x" },
    gone: [["scintilla", same, 5, 2], ["scintilla", "junk", 5, 2], ["Bad Name", same, 1, 1], "x", ["golf", first, "soon", -3]] });
  assert.deepEqual(odd.ch, { [same]: { c: 12, ca: 5, cr: 1 }, [first]: {}, [movedRead]: { c: 0 }, [movedWait]: {} });
  assert.deepEqual(odd.ls, { scintilla: { w: "public", a: 5, t: 6, k: "x".repeat(24), n: 0, p: 0 } });
  assert.deepEqual(odd.gone, [["scintilla", same, 5, 2], ["golf", first, 0, 0]]);
  assert.equal(parseHealth({ gone: Array.from({ length: 80 }, (_, i) => ["golf", same, i, 1]) }).gone.length, GONE_KEPT);
});

test("the blind read under the notice: a channel the count vouches for is not read every hour — it is checked every 12; one it cannot vouch for keeps Y5's hour", () => {
  const [vouched, unvouched, moved, old, never] = many(5, 51000);
  const health = parseHealth(healthRow({ [vouched]: { ok: minAgo(200), f: 40, c: 100, ca: minAgo(5), cr: 1 }, [unvouched]: { ok: minAgo(200), f: 40, c: 100, ca: minAgo(5) },
    [moved]: { ok: minAgo(200), f: 40, c: 100, ca: minAgo(5), cr: 1 }, [old]: { ok: minAgo(721), f: 144, c: 100, ca: minAgo(5), cr: 1 }, [never]: { f: 3, b: minAgo(15), c: 5, ca: minAgo(5) } }));
  const unread = [vouched, unvouched, moved, old, never];
  const run = (extra = {}) => fallbackPlan({ unread, health, settings: DAY1200, nowSec: NOW, verifyMin: 720, ...extra });
  let p = run({ confirmed: new Set([vouched, old]), moved: new Set([moved]) });
  assert.deepEqual([p.pick, p.read_lately], [[never, old, unvouched, moved], 1], "the vouched-for channel is left alone; one not read for 12 hours is read whatever its count says");
  p = run({ confirmed: new Set([vouched, old]), moved: new Set([moved]), exclude: new Set([moved]) });
  assert.deepEqual(p.pick, [never, old, unvouched], "a channel already being read because its count moved is not picked twice");
  /* nothing was counted this pass (the call failed, or the pace held it): the last unmoved count still stands for an hour, then Y5's rule */
  assert.deepEqual(run().pick, [never, old, unvouched], "a channel counted unmoved five minutes ago with a read behind it was seen five minutes ago; one with no read behind its count was not");
  const stale = parseHealth(healthRow({ [vouched]: { ok: minAgo(200), f: 40, c: 100, ca: minAgo(61), cr: 1 } }));
  assert.deepEqual(fallbackPlan({ unread: [vouched], health: stale, settings: DAY1200, nowSec: NOW, verifyMin: 720 }).pick, [vouched], "not counted for an hour: the blind read is back");
  /* the blind read keeps Y5's order — the longest unread first, whatever its list. It is the net under everything: were the counts
     down for a day, a net that served the SCINTILLA list first would never reach the others (6 a pass is less than that list needs alone) */
  const mixed = parseHealth(healthRow({ [S[0]]: { ok: minAgo(70) }, [P[0]]: { ok: minAgo(900) }, [R[0]]: { ok: minAgo(2000) }, [S[1]]: { ok: minAgo(80) } }));
  assert.deepEqual(fallbackPlan({ unread: [S[0], S[1], P[0], R[0]], health: mixed, settings: DAY1200, nowSec: NOW }).pick, [R[0], P[0], S[1], S[0]]);
  assert.doesNotMatch(code(read("supabase/functions/_shared/yt-upload-notice.mjs")), /fallbackPlan\(\{[^}]*\btier\b/, "the turns order the reads of channels that MOVED, not the blind read");
  /* units already spent this pass count against the same day */
  const many7 = many(7, 52000), unreadHealth = parseHealth(healthRow(Object.fromEntries(many7.map((id) => [id, { ok: minAgo(100) }])), { used: 1020 }));
  p = fallbackPlan({ unread: many7, health: unreadHealth, settings: DAY1200, nowSec: NOW, spent: 6 });
  assert.deepEqual([p.used_today, p.allowed_by_now, p.pick.length, p.skipped_budget, p.cap], [1026, 1029, 3, 4, "pace"]);
});

test("the neighbours: the second way's day gives way to RADAR's searches and to this sweep's own videos calls", () => {
  assert.deepEqual([DAILY_QUOTA, SEARCH_MAX_UNITS, OWN_CALLS_A_PASS, GUARD_MARGIN], [10000, 7979, 2, 50]);
  const midnight = sec(Date.UTC(2026, 9, 13, 7, 0, 0)), noon = sec(Date.UTC(2026, 9, 13, 19, 0, 0)), last = sec(Date.UTC(2026, 9, 14, 6, 55, 0));
  assert.deepEqual([dayGuard({ nowSec: midnight }), dayGuard({ nowSec: noon, ownToday: 288 }), dayGuard({ nowSec: last, ownToday: 574 })], [1395, 1395, 1395],
    "a day that runs at two videos calls a pass: 10,000 − 7,979 − 576 − 50 leaves the second way 1,395 from midnight to midnight");
  assert.equal(dayGuard({ nowSec: noon, ownToday: 240 }), 1443, "the measured sweep (1.67 a pass since Y5): more room");
  assert.equal(dayGuard({ nowSec: noon, ownToday: 720 }), 963, "the worst sweep the older tests allow for (5 a pass): the second way gives way");
  assert.equal(dayGuard({ nowSec: last, ownToday: 2000 }), 0, "and never below nothing");
  /* the recommended row, 1,200 a day, on a day when this sweep's own calls run at their worst: the day's ceiling drops under it and the row says whose doing it is */
  const hot = passBudget({ health: parseHealth(healthRow({}, { day: "2026-10-13", used: 900 })), settings: DAY1200, nowSec: noon, ownToday: 720 });
  assert.deepEqual([hot.ceiling, hot.guard, hot.room(), hot.paced(), hot.why()], [963, 963, 63, 0, "neighbours"]);
  const calm = passBudget({ health: parseHealth(healthRow({}, { day: "2026-10-13", used: 100 })), settings: DAY1200, nowSec: noon, ownToday: 240 });
  assert.deepEqual([calm.ceiling, calm.by_now, calm.room(), calm.paced(), calm.why()], [1200, 604, 1100, 504, "day"]);
  calm.spend(4); calm.spend(-9); calm.spend();
  assert.deepEqual([calm.spent, calm.room(), calm.paced()], [4, 1096, 500]);
  /* the day that is in force tonight: 450. Whatever the number, the whole day adds up to less than the allowance */
  for (const perDay of [450, 580, 1200, 2000]) {
    for (const own of [0, 240, 288, 720]) {
      const b = passBudget({ health: parseHealth(null), settings: fallbackSettings({ per_day: perDay }), nowSec: noon, ownToday: own });
      const restOfDay = OWN_CALLS_A_PASS * 144;
      assert.ok(SEARCH_MAX_UNITS + own + restOfDay + b.ceiling <= DAILY_QUOTA - GUARD_MARGIN, perDay + " a day, " + own + " own calls by noon: " + (SEARCH_MAX_UNITS + own + restOfDay + b.ceiling));
    }
  }
  /* yesterday's count is not today's; a row that is not there is zero */
  const row = { units: { today: { day: "2026-10-13", videos_calls: 311 } } };
  assert.deepEqual([ownCallsToday(JSON.stringify(row), noon), ownCallsToday(row, midnight - 60), ownCallsToday("not json", noon), ownCallsToday(null, noon), ownCallsToday({ units: { today: { day: "2026-10-13", videos_calls: "x" } } }, noon)], [311, 0, 0, 0, 0]);
  const p = fallbackPlan({ unread: many(9, 53000), health: parseHealth(healthRow({}, { day: "2026-10-13", used: 960 })), settings: DAY1200, nowSec: last, dayCap: 963 });
  assert.deepEqual([p.pick.length, p.skipped_budget, p.cap, p.ceiling], [3, 6, "neighbours", 963]);
  assert.equal(capWords("neighbours", DAY1200, p), "RADAR's searches and this sweep's own calls leave the second way 963 of its 1200 today (960 used)");
  assert.equal(allowedByNow(1200, 1230), 1029);
  assert.deepEqual([...tiersOf({ scintilla: [S[0], P[0]], personal: [P[0], P[1]], golf: [R[0], S[0]], fitness: [] }, ["personal", "scintilla", "golf", "fitness"])], [[S[0], 0], [P[0], 0], [P[1], 1], [R[0], 2]],
    "a channel on two lists takes the earlier turn");
});

/* =====================================================================================================
   4 · THE NOTICE — the sweep itself
   ===================================================================================================== */
/* lists saved ten minutes ago, so the lists step asks nobody: these tests are about the feed's second way */
const fresh = (lists, extra = {}) => cfg(lists, extra, { listedMinAgo: 10, own: [] });
const NOTICE_BLOCK = { on: true, calls: 0, asked: 0, answered: 0, for_the_scintilla_list: 0, refresh: false, filled_free: 0, not_counted: 0, not_counted_why: null,
  unread_counted: 0, moved: 0, moved_read: 0, moved_waiting: 0, moved_resting: 0, moved_cap: null, unmoved: 0, first_count: 0, calls_not_ok: [] };

test("every feed read fails and a SCINTILLA channel has posted: one count call notices it, one read brings it — 2 units, in the same pass", async () => {
  const [a, b, c2] = many(3, 60000), [p1] = many(1, 61000);
  const posted = { id: vid(101), title: "Posted two minutes ago", published: iso(NOW - 120) }, older = { id: vid(100), title: "Already held", published: "2026-10-12T15:00:00Z" };
  const { result, tables, log } = await runSweep({
    config: fresh({ scintilla: [a, b, c2], personal: [p1] }, { [HEALTH_KEY]: healthRow(counted([a, b, c2, p1], { readAgo: 30, extra: { f: 6 } }), { used: 40 }) }),
    videos: [held(vid(100), a, ["scintilla"])], feedsDown: true, counts: { [a]: 101, [b]: 100, [c2]: 100, [p1]: 100 }, uploads: { [a]: uploadsBody(a, "Channel a", [posted, older]) } });
  assert.deepEqual([result.rss_channels, result.rss_failed, result.rss_seen], [4, 4, 2], "every one of the four feed reads failed");
  assert.deepEqual(countsAsked(log), [[a, b, c2, p1]], "ONE count call: the SCINTILLA list's three, and the personal channel in a place left over");
  assert.deepEqual(uploadsAsked(log), [a], "ONE read: the channel whose number moved");
  assert.deepEqual(result.notice, { ...NOTICE_BLOCK, calls: 1, asked: 4, answered: 4, for_the_scintilla_list: 3, filled_free: 1, unread_counted: 4, moved: 1, moved_read: 1, unmoved: 3 });
  const stored1 = row(tables, vid(101));
  assert.deepEqual([stored1.channel_id, stored1.title, stored1.source, stored1.subscription_accounts, stored1.published_at, stored1.duration_sec, stored1.is_short, stored1.live_broadcast],
    [a, "Posted two minutes ago", "subscription", ["scintilla"], iso(NOW - 120), 720, false, "none"], "in the table, two minutes after it was posted, filed as a feed entry would be");
  assert.deepEqual([result.new_videos, tables.youtube_videos.length, row(tables, vid(100)).updated_ts], [1, 2, 1791000000], "the video already held is not rewritten");
  const f = result.fallback;
  assert.deepEqual([f.feed_unread, f.eligible, f.asked, f.read, f.videos, f.videos_new, f.skipped_budget, f.cap, f.channels], [4, 0, 1, 1, 2, 1, 0, null, [{ id: a, name: "Channel a", videos: 2 }]],
    "nobody else needed a blind read: their counts had not moved, and a read stands behind each");
  assert.deepEqual(result.units.pass, { lists: 0, counts: 1, uploads: 1, videos: 1, total: 3 }, "the second way spent 2; the videos call for the new row is the sweep's own, as on any pass");
  assert.deepEqual([result.units.today.second_way, f.budget.used_today], [42, 42]);
  const health = stored(tables, HEALTH_KEY);
  assert.deepEqual(health.ch[a], { ok: minAgo(30), fb: NOW, f: 7, n: "Channel a", c: 101, ca: NOW, cr: 1 }, "the new number is remembered, with the read that stands behind it");
  assert.deepEqual([health.ch[b], health.ch[p1], health.used], [{ ok: minAgo(30), f: 7, c: 100, ca: NOW, cr: 1 }, { ok: minAgo(30), f: 7, c: 100, ca: NOW, cr: 1 }, 42]);
  assert.doesNotMatch(JSON.stringify(result) + JSON.stringify(tables.app_config.filter((r) => r.key !== "YT_API_KEY")) + JSON.stringify(log.fetched), new RegExp(KEY));
});

test("the SCINTILLA list first, then personal, then the rest — and a channel that waits for the cap is still 'moved' on the next pass", async () => {
  const [s1] = many(1, 62000), [p1] = many(1, 63000), [r1] = many(1, 64000);
  const up = (id, n) => ({ [id]: uploadsBody(id, "Channel " + id.slice(-4), [{ id: vid(n), title: "new on " + id.slice(-4), published: iso(NOW - 200) }]) });
  const first = await runSweep({
    config: fresh({ golf: [r1], personal: [p1], scintilla: [s1] }, { [HEALTH_KEY]: healthRow(counted([s1, p1, r1], { readAgo: 30, countedAgo: 16, extra: { f: 6 } })), [SETTINGS_KEY]: { per_day: 1200, moved_per_pass: 2 } }),
    feedsDown: true, counts: { [s1]: 101, [p1]: 101, [r1]: 101 }, uploads: { ...up(s1, 201), ...up(p1, 202), ...up(r1, 203) } });
  assert.deepEqual(uploadsAsked(first.log), [s1, p1], "two reads allowed: the SCINTILLA list's channel and the personal one");
  assert.deepEqual([first.result.notice.moved, first.result.notice.moved_read, first.result.notice.moved_waiting, first.result.notice.moved_cap], [3, 2, 1, "pass"]);
  assert.deepEqual([first.result.new_videos, !!row(first.tables, vid(201)), !!row(first.tables, vid(202)), !!row(first.tables, vid(203))], [2, true, true, false]);
  assert.deepEqual(row(first.tables, vid(202)).subscription_accounts, ["personal"]);
  const h = stored(first.tables, HEALTH_KEY).ch;
  assert.deepEqual([h[s1].c, h[p1].c, h[r1].c, h[r1].ca], [101, 101, 100, minAgo(16)], "the channel that waited keeps its OLD number: a cap delays a read, it cannot lose one");
  const second = await runSweep({ store: first.store, feedsDown: true, counts: { [s1]: 101, [p1]: 101, [r1]: 101 }, uploads: { ...up(s1, 201), ...up(p1, 202), ...up(r1, 203) }, nowMs: T0 + 300000 });
  assert.deepEqual([uploadsAsked(second.log), second.result.notice.moved, second.result.new_videos, row(second.tables, vid(203)).subscription_accounts], [[r1], 1, 1, ["golf"]], "five minutes later it is read");
});

test("the first pass ever in a burst: every count is new, so nothing has 'moved' — the blind read still goes round, and from the next pass a new upload is noticed", async () => {
  const [a, b] = many(2, 65000), [p1] = many(1, 66000);
  const counts = { [a]: 500, [b]: 80, [p1]: 12 };
  const first = await runSweep({ config: fresh({ scintilla: [a, b], personal: [p1] }), feedsDown: true, counts });
  assert.deepEqual(first.result.notice, { ...NOTICE_BLOCK, calls: 1, asked: 3, answered: 3, for_the_scintilla_list: 2, unread_counted: 3, first_count: 3 });
  assert.deepEqual([uploadsAsked(first.log), first.result.fallback.eligible, first.result.fallback.asked], [[a, b, p1], 3, 3], "channels nothing has ever read are read (Y5's rule), the SCINTILLA list's first");
  assert.deepEqual(stored(first.tables, HEALTH_KEY).ch[a], { fb: NOW, f: 1, c: 500, ca: NOW, cr: 1 }, "counted and read in one pass: the read stands behind the count from the start");
  const quiet = await runSweep({ store: first.store, feedsDown: true, counts, nowMs: T0 + 300000 });
  assert.deepEqual([countsAsked(quiet.log).length, uploadsAsked(quiet.log), quiet.result.notice.unmoved, quiet.result.units.pass.counts + quiet.result.units.pass.uploads], [1, [], 3, 1], "nothing moved: the pass costs one unit");
  const posted = await runSweep({ store: quiet.store, feedsDown: true, counts: { ...counts, [b]: 81 }, uploads: { [b]: uploadsBody(b, "Channel b", [{ id: vid(301), title: "new", published: iso(NOW + 500) }]) }, nowMs: T0 + 600000 });
  assert.deepEqual([uploadsAsked(posted.log), posted.result.notice.moved_read, posted.result.new_videos, row(posted.tables, vid(301)).subscription_accounts], [[b], 1, 1, ["scintilla"]]);
});

test("a channel the count vouches for is not read blind every hour — forty channels three hours unread cost one count call, not six reads a pass", async () => {
  const forty = many(40, 67000);
  const unreadFor = (minutes) => fresh({ scintilla: forty }, { [HEALTH_KEY]: healthRow(counted(forty, { readAgo: minutes, extra: { f: 36 } })) });
  const counts = Object.fromEntries(forty.map((id) => [id, 100]));
  const y6 = await runSweep({ config: unreadFor(180), feedsDown: true, counts });
  assert.deepEqual([countsAsked(y6.log).length, uploadsAsked(y6.log), y6.result.notice.unmoved, y6.result.fallback.eligible, y6.result.units.pass.counts + y6.result.units.pass.uploads], [1, [], 40, 0, 1]);
  /* the same forty with the notice switched off and no count remembered: Y5's blind read, six a pass, forty waiting */
  const plain = Object.fromEntries(forty.map((id) => [id, { ok: minAgo(180), f: 36 }]));
  const y5 = await runSweep({ config: fresh({ scintilla: forty }, { [HEALTH_KEY]: healthRow(plain), [SETTINGS_KEY]: { notice: 0 } }), feedsDown: true, counts });
  assert.deepEqual([countsAsked(y5.log), uploadsAsked(y5.log).length, y5.result.fallback.eligible, y5.result.notice.on], [[], 6, 40, false]);
  /* switched off an hour after the last count: the count has stopped vouching, and the blind read is back by itself */
  const offLater = await runSweep({ config: fresh({ scintilla: forty }, { [HEALTH_KEY]: healthRow(counted(forty, { readAgo: 180, countedAgo: 61, extra: { f: 36 } })), [SETTINGS_KEY]: { notice: 0 } }), feedsDown: true, counts });
  assert.deepEqual([uploadsAsked(offLater.log).length, offLater.result.fallback.eligible], [6, 40]);
  /* twelve hours without a READ: the count is no longer enough */
  const half = await runSweep({ config: unreadFor(721), feedsDown: true, counts });
  assert.deepEqual([uploadsAsked(half.log).length, half.result.fallback.eligible, half.result.fallback.cap], [6, 40, "pass"], "the check every 12 hours, six a pass");
});

test("the count call fails: the pass does not, the blind read carries on as in Y5, and the row says the call was not answered", async () => {
  const [a, b] = many(2, 68000);
  const config = () => fresh({ scintilla: [a, b] }, { [HEALTH_KEY]: healthRow(counted([a, b], { readAgo: 90, countedAgo: 70, extra: { f: 18 } })) });
  const down = await runSweep({ config: config(), feedsDown: true, counts: [500, "oops"] });
  assert.deepEqual(down.result.notice.calls_not_ok, [{ outcome: "http_500", reason: null, channels: 2 }]);
  assert.deepEqual([down.result.notice.calls, down.result.notice.answered, uploadsAsked(down.log), down.result.fallback.error, down.result.units.pass.counts], [1, 0, [a, b], null, 1],
    "no count: both channels are simply unread for 90 minutes, and are read");
  assert.ok(down.log.writes.some((w) => w.key === "yt_rss_result"), "the pass finished and wrote its result");
  const gone = await runSweep({ config: config(), feedsDown: true, counts: apiError(403, "quotaExceeded") });
  assert.deepEqual([uploadsAsked(gone.log), gone.result.fallback.cap, gone.result.fallback.budget.quota_gone, stored(gone.tables, HEALTH_KEY).quota_day], [[], "quota", true, "2026-10-12"],
    "YouTube says the day's allowance is gone on the count call: not one read is asked after it");
  const next = await runSweep({ store: gone.store, feedsDown: true, counts: { [a]: 100, [b]: 100 }, nowMs: T0 + 300000 });
  assert.deepEqual([asked(next.log, "channels"), uploadsAsked(next.log), next.result.notice.not_counted_why], [[], [], "quota"], "nor on the next pass, until the Pacific day turns");
});

test("every feed answers: no read at all; the SCINTILLA list's counts cost 1 unit per 50 channels once an hour, and a pass in between costs nothing", async () => {
  const [a, b] = many(2, 69000), [p1] = many(1, 69500);
  const counts = { [a]: 10, [b]: 20, [p1]: 30 };
  const first = await runSweep({ config: fresh({ scintilla: [a, b], personal: [p1] }), counts });
  assert.deepEqual([first.result.rss_failed, countsAsked(first.log), uploadsAsked(first.log)], [0, [[a, b, p1]], []]);
  assert.deepEqual(first.result.notice, { ...NOTICE_BLOCK, calls: 1, asked: 3, answered: 3, for_the_scintilla_list: 2, refresh: true, filled_free: 1 });
  assert.deepEqual(stored(first.tables, HEALTH_KEY), { v: 1, at: NOW, day: "2026-10-12", used: 1, quota_day: "", ch: { [a]: { ok: NOW, c: 10, ca: NOW, cr: 1 }, [b]: { ok: NOW, c: 20, ca: NOW, cr: 1 }, [p1]: { ok: NOW, c: 30, ca: NOW, cr: 1 } } });
  const between = await runSweep({ store: first.store, counts, nowMs: T0 + 5 * 60000 });
  assert.deepEqual([asked(between.log, "channels"), between.result.notice, between.result.units.pass], [[], NOTICE_BLOCK, { lists: 0, counts: 0, uploads: 0, videos: 0, total: 0 }]);
  const hour = await runSweep({ store: between.store, counts, nowMs: T0 + 60 * 60000 });
  assert.deepEqual([countsAsked(hour.log).length, hour.result.notice.refresh, uploadsAsked(hour.log)], [1, true, []]);
  /* switched off, the pass asks nothing of the kind */
  const off = await runSweep({ config: fresh({ scintilla: [a, b] }, { [SETTINGS_KEY]: { notice: 0 } }), feedsDown: true, counts });
  assert.deepEqual([asked(off.log, "channels"), off.result.notice.on, off.result.notice.calls], [[], false, 0]);
});

test("streams and Shorts: the read is the WHOLE uploads list, so what a burst brings is what the feed would have brought — each kind filed as it always was", async () => {
  const [a] = many(1, 70000);
  const items = [{ id: vid(401), title: "A video", published: iso(NOW - 100) }, { id: vid(402), title: "A Short", published: iso(NOW - 200) },
    { id: vid(403), title: "A stream on air", published: iso(NOW - 4000) }, { id: vid(404), title: "A stream still to come", published: iso(NOW - 5000) }];
  const { result, tables, log } = await runSweep({ config: fresh({ scintilla: [a] }, { [HEALTH_KEY]: healthRow(counted([a], { readAgo: 30, extra: { f: 6 } })) }), feedsDown: true, counts: { [a]: 103 },
    uploads: { [a]: uploadsBody(a, "Channel a", items) }, shorts: [vid(402)],
    api: { [vid(401)]: apiVideo("PT14M"), [vid(402)]: apiVideo("PT45S"), [vid(403)]: apiVideo("PT0S", "live", { liveStreamingDetails: { actualStartTime: iso(NOW - 600), scheduledStartTime: iso(NOW - 660) } }),
      [vid(404)]: apiVideo("PT0S", "upcoming", { liveStreamingDetails: { scheduledStartTime: iso(NOW + 86400) } }) } });
  assert.match(asked(log, "playlistItems")[0], new RegExp("playlistId=UU" + a.slice(2) + "&maxResults=15"), "UU… — videos, streams and Shorts together; not UULF…, which holds neither a stream nor a Short");
  assert.equal(result.new_videos, 4);
  assert.deepEqual([row(tables, vid(401)).is_short, row(tables, vid(401)).duration_sec, row(tables, vid(401)).live_broadcast], [false, 840, "none"]);
  assert.deepEqual([row(tables, vid(402)).is_short, row(tables, vid(402)).duration_sec], [true, 45], "a Short is stored as a Short");
  assert.deepEqual([row(tables, vid(403)).live_broadcast, row(tables, vid(403)).live_started_at, row(tables, vid(403)).duration_sec], ["live", iso(NOW - 600), null], "a stream on air: live, with its real start");
  assert.deepEqual([row(tables, vid(404)).live_broadcast, row(tables, vid(404)).live_scheduled_at, row(tables, vid(404)).live_started_at], ["upcoming", iso(NOW + 86400), null], "a stream still to come: kept as upcoming, as from the feed");
  assert.doesNotMatch(code(read("supabase/functions/_shared/yt-upload-notice.mjs")) + code(read("supabase/functions/_shared/yt-feed-fallback.mjs")) + code(RSS), /UULF|UULV|UUSH/, "no code path reads a part-list");
});

test("?dry=fallback runs the same second way a pass runs — the count, the read it asks for — and writes nothing", async () => {
  const [a, b] = many(2, 71000);
  const config = fresh({ scintilla: [a, b] }, { [HEALTH_KEY]: healthRow(counted([a, b], { readAgo: 30, extra: { f: 6 } }), { used: 9 }), yt_rss_running: { ts: 0 } });
  const snapshot = JSON.stringify(config);
  const { result, tables, log } = await runSweep({ config, videos: [held(vid(500), a, ["scintilla"])], query: "?dry=fallback", feedsDown: true, counts: { [a]: 102, [b]: 100 },
    uploads: { [a]: uploadsBody(a, "Channel a", [{ id: vid(501), title: "new", published: iso(NOW - 90) }, { id: vid(500), title: "held", published: "2026-10-01T12:00:00Z" }]) } });
  assert.deepEqual([result.dry, result.wrote, result.feed_unread, result.would_ask, result.units_spent, result.cap], ["fallback", "nothing", 2, [a], 2, null]);
  assert.deepEqual(result.notice, { ...NOTICE_BLOCK, calls: 1, asked: 2, answered: 2, for_the_scintilla_list: 2, unread_counted: 2, moved: 1, moved_read: 1, unmoved: 1 });
  const line = result.asked[0];
  assert.deepEqual([line.id, line.why, line.count, line.outcome, line.videos, line.not_stored, line.items.map((v) => [v.video_id, v.stored])], [a, "its count moved", { was: 100, now: 102 }, "ok", 2, 1, [[vid(501), false], [vid(500), true]]]);
  assert.deepEqual(result.the_day, { may_come_to: 580, own_videos_calls_so_far: 0, what_the_neighbours_leave: 1887 });
  assert.deepEqual(log.writes, [], "nothing written — not the result, not the lock, not the remembered row, not a video");
  assert.deepEqual([JSON.stringify(tables.app_config), tables.youtube_videos.length], [snapshot, 1]);
  assert.match(result.note, /not added to the day's count/);
});

test("the result row says what the pass and the day spent — this sweep's own videos calls beside the second way's — and the second way gives way when they run high", async () => {
  const [a] = many(1, 72000);
  const base = (extra) => fresh({ scintilla: [a] }, { [HEALTH_KEY]: healthRow(counted([a], { readAgo: 30, extra: { f: 6 } }), { used: 100 }), [SETTINGS_KEY]: { per_day: 1200 }, ...extra });
  const moved = { feedsDown: true, counts: { [a]: 101 }, uploads: { [a]: uploadsBody(a, "Channel a", [{ id: vid(601), title: "new", published: iso(NOW - 60) }]) } };
  const calm = await runSweep({ config: base({ yt_rss_result: { units: { today: { day: "2026-10-12", videos_calls: 300 } } } }), ...moved });
  assert.deepEqual(calm.result.units, { pass: { lists: 0, counts: 1, uploads: 1, videos: 1, total: 3 },
    today: { day: "2026-10-12", second_way: 102, videos_calls: 301, total: 403, second_way_per_day: 1200, second_way_may_come_to: 1200 } });
  assert.deepEqual(stored(calm.tables, "yt_rss_result").units, calm.result.units, "and the stored row carries it to the next pass");
  /* a new Pacific day starts both counts again */
  const tomorrow = await runSweep({ store: calm.store, ...moved, counts: { [a]: 101 }, nowMs: Date.UTC(2026, 9, 13, 7, 5, 0) });
  assert.deepEqual([tomorrow.result.units.today.day, tomorrow.result.units.today.videos_calls, tomorrow.result.units.today.second_way], ["2026-10-13", 0, 1]);
  /* the sweep's own calls have run far over their usual two a pass: there is no room left for the second way today, and the row says whose doing it is */
  const hot = await runSweep({ config: base({ yt_rss_result: { units: { today: { day: "2026-10-12", videos_calls: 1900 } } } }), ...moved });
  assert.deepEqual([hot.result.units.today.second_way_may_come_to, asked(hot.log, "channels"), uploadsAsked(hot.log), hot.result.notice.not_counted_why, hot.result.new_videos], [0, [], [], "neighbours", 0]);
  assert.equal(hot.result.fallback.error, null, "the pass itself is untouched");
});

test("what Y6 added stays inside its lines: no key, no delete, one new kind of write, the search collector and the sign-in untouched", () => {
  const sweep = code(RSS), notice = read("supabase/functions/_shared/yt-upload-notice.mjs"), lists = read("supabase/functions/_shared/yt-lists.mjs");
  assert.doesNotMatch(RSS + notice + lists + read("supabase/functions/_shared/yt-feed-fallback.mjs"), /AIza[0-9A-Za-z_-]{20,}/, "no key in any source");
  assert.doesNotMatch(sweep, /\.delete\(/, "the sweep deletes nothing, anywhere");
  assert.equal((sweep.match(/\.update\(\{ subscription_accounts: /g) || []).length, 2, "the tags are written in two places: the merge that only ever adds (as before), and the one that takes a tag off");
  assert.match(sweep, /await sb\.from\("youtube_videos"\)\.update\(\{ subscription_accounts: group\.next \}\)\.in\("video_id", batch\);/, "and taking a tag off writes that one column, for exactly the rows read");
  assert.doesNotMatch(code(lists) + code(notice), /\.from\(|createClient/, "the shared rules never touch a table");
  /* the sign-in is what it was: the same token call, the same list call, the same test of what it gives */
  assert.match(sweep, /"subscriptions\?part=snippet&mine=true&maxResults=50" \+\n\s+\(pageToken \? "&pageToken=" \+ encodeURIComponent\(pageToken\) : ""\),\n\s+auth\.token,/);
  assert.match(sweep, /if \(!channels\.length \|\| now - cacheTs > 3600\) \{/, "a list is refreshed when it is over an hour old, as before");
  assert.match(sweep, /if \(got\.length \|\| !accountErrors\[account\]\) \{/);
  assert.equal((sweep.match(/accessToken\(/g) || []).length, 2, "definition + the one use it always had");
  /* the neighbours */
  const feed = read("supabase/functions/youtube-feed/index.ts");
  assert.doesNotMatch(feed, /yt-upload-notice|yt-lists|yt_rss_health|YT_CHANNEL_ID_|secondWayPass/, "the search collector (RADAR) knows nothing of this");
  assert.doesNotMatch(sweep, /search\?|eventType=live|yt_backup/, "no search call, and nothing built on the database stopgap");
  assert.equal((sweep.match(/apiKeyRequest\(/g) || []).length, 3, "the sweep's own two videos calls are what they were");
  assert.match(sweep, /running\.ts && now - running\.ts < 180/, "the 180 s lock is still the sweep's");
  /* what a pass may add to its length: the lists inside 20 s, then at most 4 count calls together and 26 reads together, 8 s each */
  assert.ok(LISTS_BUDGET_MS <= 20000 && NOTICE_LIMITS.moved_per_pass[1] <= 50 && LIST_MAX_PAGES === 10);
  /* everything the sweep imports from the shared address is there (the tests load the function by rewriting exactly that one import) */
  const imported = RSS.match(/import \{([^}]+)\} from "\.\.\/_shared\/yt-bridge\.mjs";/)[1].split(",").map((name) => name.trim()).filter(Boolean);
  for (const name of imported) assert.ok(name in bridge, "yt-bridge.mjs hands on " + name);
  for (const door of ["probe\") === \"live\"", "dry\") === \"live\"", "dry\") === \"fallback\"", "dry\") === \"lists\""]) assert.ok(sweep.includes('ask.get("' + door), "door: " + door);
});

/* =====================================================================================================
   5 · A WHOLE DAY — the second way run for 288 passes against a made-up YouTube
   ===================================================================================================== */
/* 186 channels in the live shape (78 in the SCINTILLA turn, 25 personal, 83 on the other lists). Uploads follow the
   measured weekday: about 165 on the SCINTILLA list and 50 on the others, through the day in the shape the table
   shows by hour. The made-up YouTube's count runs `lag` seconds behind a publish (measured: 3–70 s); a feed that
   answers shows a video four minutes after it is posted. Nothing here is a real channel. */
const BY_HOUR_UTC = [51, 53, 47, 49, 22, 29, 25, 18, 8, 12, 17, 60, 91, 111, 125, 86, 141, 135, 96, 107, 84, 94, 89, 68];
const dice = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function postings(start, ids, perDay, active, seed) {
  const roll = dice(seed), of = new Map(), total = BY_HOUR_UTC.reduce((a, b) => a + b, 0), busy = ids.slice(0, active);
  for (let i = 0; i < perDay; i++) {
    let x = roll() * total, hour = 0; while (x > BY_HOUR_UTC[hour]) { x -= BY_HOUR_UTC[hour]; hour++; }
    let t = Math.floor(start / 86400) * 86400 + hour * 3600 + Math.floor(roll() * 3600); if (t < start) t += 86400;
    const id = busy[Math.floor(roll() * roll() * busy.length)];            // a few channels post most of it
    if (!of.has(id)) of.set(id, []); of.get(id).push(t);
  }
  return of;
}
async function wholeDay({ feedsUp = () => false, row = {}, counts = true, lag = 70, ownAPass = 1.9 } = {}) {
  const start = sec(Date.UTC(2026, 9, 13, 7, 0, 0));                        // midnight Pacific
  const videosOf = new Map([...postings(start, S, 165, 40, 7), ...postings(start, [...P, ...R], 50, 45, 8)]);
  const settings = fallbackSettings(row), notice = noticeSettings(row), clock = { now: start }, calls = { counts: 0, uploads: 0 };
  const ok = (body) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });
  const fetchFn = async (url) => {
    const u = String(url);
    if (u.includes("/channels?")) { calls.counts++; const ids = decodeURIComponent(u.match(/[?&]id=([^&]+)/)[1]).split(",");
      return ok({ items: ids.map((id) => ({ id, statistics: { videoCount: String(1000 + (videosOf.get(id) || []).filter((t) => t <= clock.now - lag).length) } })) }); }
    if (u.includes("/playlistItems?")) { calls.uploads++; const id = "UC" + u.match(/playlistId=UU([^&]+)/)[1];
      return ok({ items: (videosOf.get(id) || []).filter((t) => t <= clock.now).sort((a, b) => b - a).slice(0, 15).map((t) => ({ snippet: { title: "v", publishedAt: iso(t), videoOwnerChannelId: id, videoOwnerChannelTitle: "c",
        resourceId: { kind: "youtube#video", videoId: String(t).padStart(11, "v") } }, contentDetails: { videoId: String(t).padStart(11, "v"), videoPublishedAt: iso(t) } })) }); }
    throw new Error("unexpected " + u);
  };
  let health = parseHealth(counts ? { ch: Object.fromEntries(ALL.map((id) => [id, { ok: start - 300, c: 1000, ca: start - 300, cr: 1 }])) } : { ch: Object.fromEntries(ALL.map((id) => [id, { ok: start - 300 }])) });
  const seenAt = new Map();
  let most = 0, lastSpendPass = -1;
  for (let pass = 0; pass < 288; pass++) {
    const nowSec = start + pass * 300; clock.now = nowSec;
    const feedOk = new Set(ALL.filter((_id, i) => feedsUp(pass, i)));
    for (const id of feedOk) for (const t of videosOf.get(id) || []) if (t <= nowSec - 240 && !seenAt.has(id + t)) seenAt.set(id + t, nowSec);
    const before = calls.counts + calls.uploads;
    const sw = await secondWayPass({ followed: ALL, tier: TIER, feedOk, health, settings, notice, apiKey: "k", nowSec, fetchFn, budget: passBudget({ health, settings, nowSec, ownToday: Math.round(pass * ownAPass) }) });
    for (const one of sw.reads) if (one.outcome === "ok") for (const t of videosOf.get(one.id) || []) if (t <= nowSec && !seenAt.has(one.id + t)) seenAt.set(one.id + t, nowSec);
    health = nextHealth({ health, channels: ALL, feedOk, reads: sw.reads, nowSec, counts: sw.counted.counts, units: sw.counted.sent });
    const spent = calls.counts + calls.uploads - before; most = Math.max(most, spent); if (spent) lastSpendPass = pass;
  }
  const end = start + 288 * 300, late = [[], [], []]; let unseen = [0, 0, 0];
  for (const [id, times] of videosOf) for (const t of times) { if (t > end - 600) continue; const at = seenAt.get(id + t); if (at == null) unseen[TIER.get(id)]++; else late[TIER.get(id)].push(at - t); }
  const lateness = (a) => ({ videos: a.length, worst_s: a.length ? Math.max(...a) : 0, within_10_min: a.filter((x) => x <= 600).length });
  return { units: calls.counts + calls.uploads, counts: calls.counts, reads: calls.uploads, used: health.used, most_in_a_pass: most, last_spend_pass: lastSpendPass, unseen,
    scintilla: lateness(late[0]), personal: lateness(late[1]), rest: lateness(late[2]),
    unread_hours: Math.round(Math.max(...ALL.map((id) => end - lastRead(health.ch[id]))) / 360) / 10 };
}
/* the lists' own pages through a day, as measured: the one readable list, two pages an hour (48), and four accounts asked every six hours (16) */
const LISTS_A_DAY = 48 + 16;
const RECOMMENDED = { per_pass: 6, per_day: 1200 };

test("a whole day with EVERY feed down, at the recommended 1,200: each SCINTILLA upload is in the table inside 10 minutes, every list is read, and the day fits", async () => {
  const d = await wholeDay({ row: RECOMMENDED });
  assert.deepEqual([d.scintilla.videos, d.scintilla.within_10_min, d.unseen], [165, 165, [0, 0, 0]], "all 165, and nothing on any list went unseen");
  assert.ok(d.scintilla.worst_s <= 370, "the worst SCINTILLA video waited " + d.scintilla.worst_s + " s: the count's 70 s and one five-minute pass");
  assert.equal(d.counts, 768, "the count: 2 calls a pass for the SCINTILLA list (576) and 2 every quarter of an hour for the others (192)");
  assert.ok(d.reads >= 300 && d.reads <= 420, "the reads: one for each upload that moved a count, and each channel checked once in 12 hours: " + d.reads);
  assert.ok(d.units + LISTS_A_DAY <= 1200, "with the lists' " + LISTS_A_DAY + " the day comes to " + (d.units + LISTS_A_DAY) + " of 1,200");
  assert.equal(d.used, d.units, "and the remembered row counted every one of them");
  assert.ok(d.most_in_a_pass <= 4 + 20 + 6, "never more in one pass than 4 counts, 20 moved reads and 6 blind ones (most: " + d.most_in_a_pass + ")");
  assert.ok(d.personal.within_10_min >= 40 && d.personal.worst_s <= 1200, "the personal list: counted every 15 minutes — " + d.personal.within_10_min + " of " + d.personal.videos + " inside 10, the worst " + d.personal.worst_s + " s");
  assert.ok(d.unread_hours <= 12.1, "no channel went more than 12 hours without a read (" + d.unread_hours + ")");
  assert.ok(SEARCH_MAX_UNITS + 550 + 1200 <= DAILY_QUOTA - 250, "RADAR 7,979 + this sweep's own 550 (measured) + 1,200 = 9,729 of 10,000");
});

test("the evening as it was measured — bursts for 70 % of the day — costs about half of that; a day with every feed answering costs 48", async () => {
  const bursts = await wholeDay({ row: RECOMMENDED, feedsUp: (pass, i) => (Math.floor(pass / 6) % 10 < 3 ? true : (i * 7 + pass * 13) % 100 < 7) });
  assert.deepEqual([bursts.scintilla.within_10_min, bursts.scintilla.videos, bursts.unseen], [165, 165, [0, 0, 0]]);
  assert.ok(bursts.units >= 500 && bursts.units <= 700, "about 640 units: " + bursts.units);
  const clean = await wholeDay({ row: RECOMMENDED, feedsUp: () => true });
  assert.deepEqual([clean.units, clean.counts, clean.reads, clean.unseen], [48, 48, 0, [0, 0, 0]], "the SCINTILLA list's counts once an hour, two calls: 48 — and not one read");
});

test("a number that is too small does not leave the evening dark: at the 450 in force tonight the SCINTILLA list is still served to midnight — later, and at the others' cost", async () => {
  const d = await wholeDay({ row: { per_pass: 6, per_day: 450 } });
  assert.equal(d.units, 450, "the day's number, exactly");
  assert.ok(d.last_spend_pass >= 280, "and still spending in the last half hour of the Pacific day (pass " + d.last_spend_pass + " of 287)");
  assert.deepEqual([d.scintilla.videos, d.unseen[0]], [165, 0], "every SCINTILLA upload was found");
  assert.ok(d.scintilla.within_10_min >= 100 && d.scintilla.within_10_min < 165 && d.scintilla.worst_s <= 1800, d.scintilla.within_10_min + " of 165 inside 10 minutes, the worst " + d.scintilla.worst_s + " s");
  assert.ok(d.unseen[1] + d.unseen[2] >= 40, "the other lists got nothing that day (" + (d.unseen[1] + d.unseen[2]) + " videos unseen): 450 is the stopgap's number, not this function's");
});

test("for comparison, the same day read Y5's way — blind, six a pass: 1,200 units and almost nothing inside 10 minutes", async () => {
  const y5 = await wholeDay({ row: { ...RECOMMENDED, notice: 0 }, counts: false });
  assert.deepEqual([y5.units, y5.counts, y5.reads], [1200, 0, 1200]);
  assert.ok(y5.scintilla.within_10_min <= 20 && y5.scintilla.worst_s > 3 * 3600, y5.scintilla.within_10_min + " SCINTILLA videos inside 10 minutes, the worst " + Math.round(y5.scintilla.worst_s / 60) + " minutes late");
});

test("turned on in the middle of a burst with no count remembered: the SCINTILLA list is at full speed from the second pass; the others catch up as each gets its first read", async () => {
  const d = await wholeDay({ row: RECOMMENDED, counts: false });
  assert.deepEqual([d.scintilla.within_10_min, d.scintilla.videos, d.unseen], [165, 165, [0, 0, 0]]);
  assert.ok(d.scintilla.worst_s <= 370 && d.units <= 1200, d.scintilla.worst_s + " s, " + d.units + " units");
  assert.ok(d.personal.worst_s > 600, "the first day costs the other lists some hours (worst " + Math.round(d.personal.worst_s / 60) + " min): each channel needs one read before its count can vouch — 186 units, once");
});

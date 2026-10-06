// SCINTILLA · yt-bridge — the X accounts Alan reads → their YouTube channels, and "is this channel on air now".
//
// Alan, 5 Oct: "Grok Bot was studying which of the Twitter accounts I follow have YouTube channels. We need to
// bridge the gap: subscribe to all of those, have the feed. Wolf Trading is live right now on X Spaces and on
// YouTube — I don't see it on our YouTube feed."
//
// Two jobs, both pure text → facts, so the resolver (Node, scripts/yt-bridge-resolve.mjs), the sweep (Deno,
// yt-rss-sweep) and the tests read the same rules:
//   1. what a public YouTube page says about itself (channel id, name, the watch page a /live address lands on);
//   2. how sure we are that a channel belongs to an X handle, from evidence we can show.
//
// No key, no sign-in: only pages any browser can open. The pattern is the one yt-dlp uses for a channel's
// /live tab (https://github.com/yt-dlp/yt-dlp — the youtube:tab extractor follows /live to the watch page and
// reads isLive from the player response); a /live address that is not on air answers with the channel page.

const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
export const isChannelId = (v) => typeof v === "string" && CHANNEL_ID.test(v);
export const isVideoId = (v) => typeof v === "string" && VIDEO_ID.test(v);

const unesc = (s) => String(s || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const first = (text, re) => { const m = String(text || "").match(re); return m ? m[1] : null; };
/** a string cut out of YouTube's embedded JSON still carries its escapes (\u0026 for &) */
const unjson = (s) => { try { return JSON.parse('"' + String(s || "") + '"'); } catch (_) { return String(s || ""); } };
/** "5.74K subscribers" → 5740 */
export function subscriberCount(html) {
  const m = String(html || "").match(/([\d.,]+)\s*([KMB]?)\s+subscribers/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, "")) * ({ K: 1e3, M: 1e6, B: 1e9 }[m[2]] || 1);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** a channel page (youtube.com/@name, /channel/UC…, /c/…, /user/…) → { channel_id, title, handle } or null */
export function parseChannelPage(html) {
  const canonical = first(html, /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})"/);
  const external = first(html, /"externalId":"(UC[A-Za-z0-9_-]{22})"/);
  const id = canonical || external;
  if (!isChannelId(id)) return null;
  const handle = first(html, /"vanityChannelUrl":"https?:\/\/www\.youtube\.com\/@([^"\/]+)"/)
    || first(html, /"canonicalBaseUrl":"\/@([^"\/]+)"/);
  return { channel_id: id, title: unesc(first(html, /<meta property="og:title" content="([^"]*)"/) || ""),
    handle: handle ? decodeURIComponent(handle) : null, subscribers: subscriberCount(html) };
}

/** a watch page → the channel that owns the video, or null */
export function parseWatchPage(html) {
  const id = first(html, /"videoDetails":\{[^}]*?"channelId":"(UC[A-Za-z0-9_-]{22})"/)
    || first(html, /<meta itemprop="identifier" content="(UC[A-Za-z0-9_-]{22})"/)
    || first(html, /"channelId":"(UC[A-Za-z0-9_-]{22})"/);
  if (!isChannelId(id)) return null;
  return { channel_id: id, title: unjson(first(html, /"ownerChannelName":"((?:[^"\\]|\\.)*)"/) || first(html, /"author":"((?:[^"\\]|\\.)*)"/) || "") };
}

/* Y2b (5 Oct, evening): the first pass from the collector's data centre read 29 channels, found nobody on air and
   could not read one — while WOLF Trading was on air in a browser. The answer stored was three counts, so nobody
   could say which channel, or what came back. Every read now names its OUTCOME and the MARKER it went by:
     on_air                 a watch page whose player or view counter says live
     upcoming               a watch page for a stream still to come (isUpcoming, or the player says LIVE_STREAM_OFFLINE)
     channel_page           not streaming: the channel page came back
     watch_page_not_live    a watch page the player could be read on, and it is not live
     watch_page_unreadable  a watch page with no player facts ("Sign in to confirm you're not a bot") — could not read
     consent_page · bot_check · empty · unrecognised_page — could not read
   The live markers are scoped: a stream still to come carries "isLive":true in its waiting counter, and a watch
   page's side column carries LIVE badges of other channels, so neither is read on its own. */
const WATCH_ID = [/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})"/,
  /<meta property="og:url" content="https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})"/];
const CHANNEL_PAGE = /<(?:link rel="canonical" href|meta property="og:url" content)="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})"/;
const pageTitle = (text) => unesc(first(text, /<title>([^<]*)<\/title>/) || "").replace(/\s+/g, " ").trim();
/** a page that is not YouTube's answer at all: Google's consent wall, or its "unusual traffic" check */
export function wallKind(html, finalUrl) {
  const text = String(html || ""), head = text.slice(0, 20000), url = String(finalUrl || "");
  if (/google\.com\/sorry\//.test(url) || /unusual traffic from your computer network|\/sorry\/index/i.test(head)) return "bot_check";
  if (/consent\.(youtube|google)\.com/.test(url)) return "consent_page";
  if (/consent\.youtube\.com|before you continue to youtube/i.test(head) && !/"videoDetails"/.test(text)) return "consent_page";
  return null;
}
/** which live marker a watch page carries, strongest first; null when none */
export function liveMarker(html) {
  const text = String(html || "");
  const at = text.indexOf('"videoDetails":{');
  if (at >= 0) {
    const rest = text.slice(at, at + 20000), end = rest.indexOf('"channelId"');
    if (/"isLive":true/.test(end > 0 ? rest.slice(0, end) : rest.slice(0, 2000))) return "player.isLive";
  }
  if (/"videoViewCountRenderer":\{[^]{0,600}?"isLive":true/.test(text)) return "page.viewCount.isLive";
  if (/"isLiveNow":true/.test(text)) return "microformat.isLiveNow";
  if (/"isLive":true/.test(text)) return "isLive";
  return null;
}
export const playerStatus = (html) => first(html, /"playabilityStatus":\{"status":"([A-Z_]+)"/);

/** what youtube.com/channel/<id>/live answered. On air: the page IS a watch page (canonical /watch?v=…) and the
    player says isLive. A stream still to come lands on a watch page too, but says isUpcoming — that is not on air.
    Not streaming: the channel page comes back. A consent, bot-check or error page reads as "unknown", never as
    "not live". state is live · upcoming · off · unknown; outcome says why (the list above). */
export function parseLivePage(html, finalUrl) {
  const text = String(html || "");
  if (!text) return { state: "unknown", video_id: null, outcome: "empty", marker: null };
  const wall = wallKind(text, finalUrl);
  if (wall) return { state: "unknown", video_id: null, outcome: wall, marker: null };
  const video = first(text, WATCH_ID[0]) || first(text, WATCH_ID[1]);
  if (!video) {
    return CHANNEL_PAGE.test(text)
      ? { state: "off", video_id: null, outcome: "channel_page", marker: null }
      : { state: "unknown", video_id: null, outcome: "unrecognised_page", marker: null };
  }
  const status = playerStatus(text);
  if (/"isUpcoming":true/.test(text) || status === "LIVE_STREAM_OFFLINE") {
    return { state: "upcoming", video_id: video, outcome: "upcoming", marker: /"isUpcoming":true/.test(text) ? "isUpcoming" : "player.LIVE_STREAM_OFFLINE" };
  }
  const marker = liveMarker(text);
  if (marker) {
    const viewers = first(text, /"originalViewCount":"(\d+)"/);
    return { state: "live", video_id: video, outcome: "on_air", marker,
      title: unjson(first(text, /"videoDetails":\{"videoId":"[A-Za-z0-9_-]{11}","title":"((?:[^"\\]|\\.)*)"/) || "") || pageTitle(text).replace(/ - YouTube$/, ""),
      channel_title: unjson(first(text, /"ownerChannelName":"((?:[^"\\]|\\.)*)"/) || first(text, /"author":"((?:[^"\\]|\\.)*)"/) || ""), viewers: viewers ? +viewers : null };
  }
  /* a watch page with no player facts is a page we were not shown, not a stream that is off */
  if (status === "LOGIN_REQUIRED" || !/"videoDetails"/.test(text)) {
    return { state: "unknown", video_id: video, outcome: "watch_page_unreadable", marker: status ? "player." + status : null };
  }
  return { state: "off", video_id: video, outcome: "watch_page_not_live", marker: status ? "player." + status : null };
}

/** the SECOND WAY, asked only when the /live read could not be read: the channel's own Live tab
    (youtube.com/channel/<id>/streams). A stream on air is the tile with the LIVE badge; the tab lists only this
    channel's streams, so the badge is the channel's own (yt-dlp's youtube:tab reads the same tiles). */
export function parseStreamsPage(html, channelId, finalUrl) {
  const text = String(html || "");
  if (!text) return { state: "unknown", video_id: null, outcome: "empty", marker: null };
  const wall = wallKind(text, finalUrl);
  if (wall) return { state: "unknown", video_id: null, outcome: wall, marker: null };
  const page = first(text, CHANNEL_PAGE);
  if (!page || (channelId && page !== channelId)) return { state: "unknown", video_id: null, outcome: "unrecognised_page", marker: null };
  if (!/"title":"Live","selected":true/.test(text)) return { state: "off", video_id: null, outcome: "no_live_tab", marker: null };
  for (const [re, marker] of [[/"badgeStyle":"THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE"/g, "streams.badge_live"], [/"thumbnailOverlayTimeStatusRenderer":\{[^]{0,400}?"style":"(?:LIVE|[A-Z]+)"/g, "streams.style_live"]]) {
    for (const m of text.matchAll(re)) {
      if (marker === "streams.style_live" && !m[0].endsWith('"style":"LIVE"')) continue;   // DEFAULT / UPCOMING: this tile's own style, not on air
      const before = [...text.slice(Math.max(0, m.index - 5000), m.index).matchAll(/i\.ytimg\.com\/vi\/([A-Za-z0-9_-]{11})\//g)];
      const video = first(text.slice(m.index, m.index + 600), /"animationActivationTargetId":"([A-Za-z0-9_-]{11})"/) || (before.length ? before[before.length - 1][1] : null);
      if (!isVideoId(video)) continue;
      const after = text.slice(m.index, m.index + 8000);
      return { state: "live", video_id: video, outcome: "on_air", marker,
        title: unjson(first(after, /"lockupMetadataViewModel":\{"title":\{"content":"((?:[^"\\]|\\.)*)"/) || first(after, /"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/) || ""),
        channel_title: unesc(first(text, /<meta property="og:title" content="([^"]*)"/) || ""), viewers: null };
    }
  }
  return { state: "off", video_id: null, outcome: "live_tab_no_stream", marker: null };
}

/** every YouTube reference in a piece of text or a link list: channel addresses and video ids */
export function youtubeRefs(text) {
  const out = { channels: [], videos: [] };
  const s = String(text || "");
  for (const m of s.matchAll(/youtube\.com\/(@[A-Za-z0-9_.\-%]+|channel\/UC[A-Za-z0-9_-]{22}|c\/[A-Za-z0-9_.\-%]+|user\/[A-Za-z0-9_.\-%]+)/g)) out.channels.push(m[1]);
  for (const m of s.matchAll(/(?:youtube\.com\/(?:watch\?(?:[^"\s]*&)?v=|live\/|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/g)) out.videos.push(m[1]);
  return out;
}

/** letters and digits only, lower case — "WOLF Trading" and "wolf_tradingx" become comparable */
export const squash = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
/** do an X handle and a channel's name / handle plainly name the same thing? A shared opening of six letters
    counts ("kingcobratrader" / "KingCobraTrades", "ripster47" / "Ripster , Tenet Trade Group"). */
export function sameName(xHandle, channelTitle, channelHandle) {
  const x = squash(xHandle), names = [squash(channelTitle), squash(channelHandle)].filter((n) => n.length >= 4);
  if (x.length < 4) return false;
  const shared = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
  return names.some((n) => n === x || (n.length >= 5 && x.includes(n)) || (x.length >= 5 && n.includes(x)) || shared(n, x) >= 6);
}

/* HOW SURE. Evidence, strongest first:
   self_link    — the account itself posted its channel's address (youtube.com/@…, /channel/UC…);
   own_videos   — videos the account posted itself (not reposts), counted per owning channel;
   same_handle  — youtube.com/@<the X handle> exists;
   backlink     — that channel's page links back to x.com/<the X handle>;
   name_match   — the channel's NAME plainly matches the X handle (a same-handle channel's handle matches by
                  definition, so that does not count);
   subscribers  — the channel's audience, read off its page.
   A same-handle channel alone is NOT a match: handles are first come, first served on both sites, and an
   impostor takes the handle and a look-alike name. It is taken as a match only with a real audience behind it. */
export const SAME_HANDLE_MIN_SUBSCRIBERS = 5000;
export function confidence(ev) {
  const e = ev || {};
  const share = e.own_videos_total ? (e.own_videos_channel || 0) / e.own_videos_total : 0;
  if (e.backlink) return "high";
  if (e.self_link && (e.name_match || (e.own_videos_channel || 0) >= 1)) return "high";
  if ((e.own_videos_channel || 0) >= 3 && share >= 0.6 && (e.name_match || e.same_handle)) return "high";
  if (e.self_link) return "medium";
  if ((e.own_videos_channel || 0) >= 2 && share >= 0.5 && (e.name_match || e.same_handle)) return "medium";
  if (e.same_handle && (e.own_videos_channel || 0) >= 1) return "medium";
  if (e.same_handle && e.name_match && (e.subscribers || 0) >= SAME_HANDLE_MIN_SUBSCRIBERS) return "medium";
  if ((e.own_videos_channel || 0) >= 3 && share >= 0.6) return "medium";
  return "low";
}
/** only these go into the feed; "low" is listed for a person to look at */
export const FEED_CONFIDENCE = ["high", "medium"];

/** the bridge file (control/YOUTUBE_CHANNEL_BRIDGE.json) or the stored config row → the channel ids to carry */
export function bridgeChannelIds(bridge) {
  const rows = Array.isArray(bridge) ? bridge : (bridge && (bridge.channels || bridge.rows || bridge.ids)) || [];
  const out = [];
  for (const row of rows) {
    const id = typeof row === "string" ? row : row && row.channel_id;
    const ok = typeof row === "string" || !row.confidence || FEED_CONFIDENCE.includes(row.confidence);
    if (isChannelId(id) && ok && !out.includes(id)) out.push(id);
  }
  return out;
}

/** our own channel list for one sweep: what the account already carries, plus the bridge, no duplicates */
export function withBridge(accountChannels, bridgeIds) {
  return [...new Set([...(accountChannels || []), ...(bridgeIds || [])].filter(isChannelId))];
}

/* THE LIVE CHECK'S OWN PACING. One /live page per bridged channel per pass costs no quota, but it is a request
   to youtube.com from a data centre; MAX_LIVE_PROBES bounds a pass, and a rotating cursor gives every channel
   its turn when the bridge is bigger than one pass. The pass is "every 20 minutes" by the minute of the hour,
   so the 5-minute sweep carries it without a new schedule. */
export const MAX_LIVE_PROBES = 60;
export const LIVE_EVERY_MIN = 20;
export function liveProbeDue(nowMs, lastMs, everyMin = LIVE_EVERY_MIN) {
  return !lastMs || nowMs - lastMs >= everyMin * 60000 - 30000;
}
export function liveProbePick(ids, cursor, max = MAX_LIVE_PROBES) {
  const list = (ids || []).filter(isChannelId), n = list.length;
  if (!n) return { pick: [], cursor: 0 };
  const start = (((+cursor || 0) % n) + n) % n, k = Math.min(max, n), pick = [];
  for (let i = 0; i < k; i++) pick.push(list[(start + i) % n]);
  return { pick, cursor: (start + k) % n };
}

/** the request every page read sends. SOCS / CONSENT are how yt-dlp answers Google's consent wall
    (yt_dlp/extractor/youtube — _initialize_consent sets SOCS=CAI; older walls took CONSENT=YES+), and PREF pins the
    page to English / US so the markers read the same wherever the data centre is. */
export const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
export const LIVE_PAGE_HEADERS = {
  "User-Agent": BROWSER_UA, "Accept-Language": "en-US,en;q=0.9", "Cookie": "SOCS=CAI; CONSENT=YES+cb; PREF=hl=en&gl=US",
};
export const livePageUrl = (channelId) => "https://www.youtube.com/channel/" + channelId + "/live";
export const streamsPageUrl = (channelId) => "https://www.youtube.com/channel/" + channelId + "/streams";

/** one page read that never throws: { status, url (where it ended), html, error }. A page that does not answer in
    PAGE_TIMEOUT_MS is "timeout" — bounded so 60 channels × two ways stay inside the sweep's two-minute call. */
export const PAGE_TIMEOUT_MS = 12000;
export async function readPage(url, headers, fetchFn = globalThis.fetch) {
  try {
    const signal = typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(PAGE_TIMEOUT_MS) : undefined;
    const r = await fetchFn(url, { headers: headers || {}, signal });
    const html = await r.text().catch(() => "");
    return { status: r.status, url: r.url || url, html: r.ok ? html : "", body: html, error: r.ok ? null : "http_" + r.status };
  } catch (e) {
    return { status: 0, url, html: "", body: "", error: e && (e.name === "TimeoutError" || e.name === "AbortError") ? "timeout" : "fetch_error" };
  }
}
const shortUrl = (u) => String(u || "").replace(/^https:\/\/www\.youtube\.com/, "").slice(0, 160);

/** IS THIS CHANNEL ON AIR — the whole check for one channel, the same code in the sweep, its dry pass and the tests.
    Way 1 the /live address; way 2 (only when way 1 could not be read) the channel's Live tab. The answer is one
    line a person can read later: id · state · outcome · marker · way · video · status · where the read ended. */
export async function checkOnAir(channelId, fetchFn = globalThis.fetch, opts = {}) {
  const a = await readPage(livePageUrl(channelId), LIVE_PAGE_HEADERS, fetchFn);
  const one = a.error ? { state: "unknown", video_id: null, outcome: a.error, marker: null } : parseLivePage(a.html, a.url);
  const line = (way, p, page, extra = {}) => ({ id: channelId, state: p.state, outcome: p.outcome, marker: p.marker || null, way,
    video: p.video_id || null, status: page.status, url: shortUrl(page.url), bytes: page.html.length, ...extra });
  /* opts.both (the dry pass's ?ways=both) asks the Live tab even when /live answered, to show the two side by side */
  if (one.state === "live" || (one.state !== "unknown" && !opts.both)) return { ...line("live_page", one, a), live: one.state === "live" ? one : null };
  const b = await readPage(streamsPageUrl(channelId), LIVE_PAGE_HEADERS, fetchFn);
  const two = b.error ? { state: "unknown", video_id: null, outcome: b.error, marker: null } : parseStreamsPage(b.html, channelId, b.url);
  const firstWay = { live_page: one.outcome, live_page_status: a.status, live_page_url: shortUrl(a.url), live_page_video: one.video_id || null };
  if (two.state === "live" || (one.state === "unknown" && two.state !== "unknown")) return { ...line("streams_tab", two, b, firstWay), live: two.state === "live" ? two : null };
  if (one.state !== "unknown") return { ...line("live_page", one, a, { streams_tab: two.outcome, streams_tab_status: b.status }), live: null };
  return { ...line("none", one, a, { ...firstWay, streams_tab: two.outcome, streams_tab_status: b.status }), live: null };
}
/** a whole pass: eight channels at a time. THE NEIGHBOURS: the schedule waits 120 s for the sweep and the sweep's
    own "busy" lock lasts 180 s; a pass normally takes about four seconds, but 60 channels × two ways × a 12 s
    time-out would not fit. So the pass has a budget — once it is spent the channels not reached are written down
    as "not_reached" (could not read) and the rotating cursor brings them round next time. */
export const ON_AIR_BUDGET_MS = 45000;
export async function onAirPass(channelIds, fetchFn = globalThis.fetch, opts = {}) {
  const lines = [], started = Date.now(), budget = opts.budgetMs ?? ON_AIR_BUDGET_MS;
  for (let i = 0; i < channelIds.length; i += 8) {
    const batch = channelIds.slice(i, i + 8);
    if (i > 0 && Date.now() - started >= budget) {
      lines.push(...batch.map((id) => ({ id, state: "unknown", outcome: "not_reached", marker: null, way: "none", video: null, status: 0, url: "", bytes: 0, live: null })));
      continue;
    }
    lines.push(...await Promise.all(batch.map((id) => checkOnAir(id, fetchFn, opts))));
  }
  return lines;
}
/** the stored / reported form of a pass: the lines without the page facts used to build a feed row */
export const onAirLine = ({ live: _live, ...line }) => line;

/** THE PROBE (read-only, no table): what one page looks like from wherever this runs — status, where it ended,
    size, which markers are in it, whether it is a wall, its title and first 300 characters. */
export function describePage(page) {
  const text = String(page.body || page.html || ""), count = (re) => (text.match(re) || []).length;
  const watch = first(text, WATCH_ID[0]) || first(text, WATCH_ID[1]);
  return { status: page.status, final_url: String(page.url || "").slice(0, 200), bytes: text.length, error: page.error || null,
    kind: wallKind(text, page.url) || (watch ? "watch_page" : CHANNEL_PAGE.test(text) ? "channel_page" : text ? "other" : "empty"),
    watch_video: watch || null, player_status: playerStatus(text),
    markers: { isLive: count(/"isLive":true/g), isLiveNow: count(/"isLiveNow":true/g), status_LIVE: count(/"status":"LIVE"/g),
      hqdefault_live: count(/hqdefault_live/g), isUpcoming: count(/"isUpcoming":true/g), style_LIVE: count(/"style":"LIVE"/g),
      badge_live: count(/THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE/g), videoDetails: count(/"videoDetails":\{/g), live_marker: liveMarker(text) },
    title: pageTitle(text).slice(0, 140), first_300: text.slice(0, 300).replace(/\s+/g, " ") };
}
export async function probeLive(channelId, videoId, fetchFn = globalThis.fetch) {
  const base = "https://www.youtube.com/channel/" + channelId;
  const cookies = { "User-Agent": BROWSER_UA, "Accept-Language": "en-US,en;q=0.9", "Cookie": "SOCS=CAI; CONSENT=YES+cb" };
  const ways = [
    ["live_as_the_check_sends_it", livePageUrl(channelId), LIVE_PAGE_HEADERS],
    ["live_as_v8_sent_it", livePageUrl(channelId), { "User-Agent": BROWSER_UA, "Accept-Language": "en-US,en", "Cookie": "SOCS=CAI" }],
    ["live_plain_get", livePageUrl(channelId), {}],
    ["live_consent_cookies_hl_gl", base + "/live?hl=en&gl=US", cookies],
    ["streams_tab", streamsPageUrl(channelId), LIVE_PAGE_HEADERS],
    ["videos_live_view_501", base + "/videos?view=2&live_view=501&hl=en&gl=US", cookies],
  ];
  const out = { channel: channelId, at: new Date().toISOString(), ways: {}, sees_live: [] };
  for (const [name, url, headers] of ways) {
    const page = await readPage(url, headers, fetchFn);
    const verdict = name.startsWith("live") ? parseLivePage(page.html, page.url) : parseStreamsPage(page.html, name === "streams_tab" ? channelId : null, page.url);
    out.ways[name] = { ...describePage(page), verdict: page.error || verdict.outcome, verdict_marker: verdict.marker || null, verdict_video: verdict.video_id || null };
    if (verdict.state === "live") out.sees_live.push(name);
    if (!videoId && isVideoId(verdict.video_id)) videoId = verdict.video_id;
  }
  if (isVideoId(videoId)) {
    const page = await readPage("https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + videoId), {}, fetchFn);
    let body = null; try { body = JSON.parse(page.body); } catch (_) {}
    out.ways.oembed = { video: videoId, status: page.status, bytes: page.body.length, error: page.error || null,
      title: body ? String(body.title || "").slice(0, 140) : null, author: body ? body.author_name || null : null,
      note: "oembed says the video exists and who owns it; it carries no live flag" };
  }
  out.check = onAirLine(await checkOnAir(channelId, fetchFn));
  return out;
}

/** a stream found on air → the row the sweep's own "new video" path takes (the API then fills the real times) */
export function liveCandidateRow(channelId, live, nowSec) {
  return { video_id: live.video_id, channel_id: channelId, channel_title: live.channel_title || "", title: live.title || "",
    description: "", thumbnail: "https://i.ytimg.com/vi/" + live.video_id + "/mqdefault.jpg",
    url: "https://www.youtube.com/watch?v=" + live.video_id, published_at: new Date(nowSec * 1000).toISOString(),
    source: "subscription", ticker: null, updated_ts: nowSec };
}

/* ================================================================================================================
   Y4 · the rules the Station's YouTube grid is collected by (Y4, 6 Oct 2026).
   
   Alan, 6 Oct: "Tyler Wilson … he's on a live video. The live video is not on my grid at all … Verified Investing
   slips through the cracks as well … it depended on when the video was scheduled or released … I need to see it
   when it starts … I absolutely need it in chronological order. Everything subscribed."
   
   Measured that morning (deliverables/20261006/y4-youtube-feed):
   · the on-air page check asked only the 37 BRIDGED channels; Tyler Wilson is a subscribed channel, so his
   stream waited for YouTube's channel feed and reached the table 8 min 21 s after it started;
   · a stored stream was re-asked about only while its PUBLISH date was under three days old, and a stream is
   "published" when it is scheduled — 17 rows said "upcoming" after their start had passed (Arete Trading,
   scheduled 5½ days ahead, was last asked about three days after it was created and never again);
   · a subscribed video whose language tag was not English was dropped at the door.
   Pure functions (no network, no table).
   ================================================================================================================ */

/* ---- WHO IS ASKED "ARE YOU ON AIR?" ----
   Every check asks the channels that are likely to be streaming: the bridged ones (as before) and every carried
   channel that has streamed in the last STREAMER_DAYS days. The rest of the carried channels take turns in what
   is left of the pass, so a channel that has never streamed for us is still asked within a few checks.
   ON_AIR_ALWAYS_MAX keeps the "always" set inside the pass's time budget (yt-bridge ON_AIR_BUDGET_MS, 45 s:
   37 pages took 2.8 s on 5 Oct); ON_AIR_PER_PASS is the whole pass. */
export const STREAMER_DAYS = 30;
export const ON_AIR_ALWAYS_MAX = 90;
export const ON_AIR_PER_PASS = 120;
export function onAirPlan({ bridgeIds = [], carried = [], streamers = [], cursor = 0, perPass = ON_AIR_PER_PASS, alwaysMax = ON_AIR_ALWAYS_MAX } = {}) {
  const carriedSet = new Set([...(bridgeIds || []), ...(carried || [])].filter(isChannelId));
  const always = [];
  for (const id of [...(bridgeIds || []), ...(streamers || [])]) {
    if (carriedSet.has(id) && !always.includes(id) && always.length < alwaysMax) always.push(id);
  }
  const rest = [...carriedSet].filter((id) => !always.includes(id)).sort();
  const room = Math.max(0, perPass - always.length), n = rest.length, turn = [];
  const start = n ? (((+cursor || 0) % n) + n) % n : 0, k = Math.min(room, n);
  for (let i = 0; i < k; i++) turn.push(rest[(start + i) % n]);
  return { pick: [...always, ...turn], always: always.length, in_turn: turn.length, waiting: n - k,
    cursor: n ? (start + k) % n : 0,
    /* how many checks until every carried channel has been asked once */
    full_round_checks: k >= n ? 1 : Math.ceil(n / Math.max(1, k)) };
}

/* ---- WHEN DID IT BECOME WATCHABLE ----
   An upload: its publish time. A stream: YouTube's actual start. When YouTube says "live" and gives no start
   time, the first moment WE saw it live stands in — written once and never moved by a later pass. */
export function watchableStart({ broadcast, actualStart, storedStart, nowIso }) {
  if (actualStart) return actualStart;
  if (storedStart) return storedStart;
  return broadcast === "live" ? nowIso : null;
}

/* ---- WHICH STORED ROWS ARE RE-ASKED ABOUT ----
   A scheduled stream is re-asked about by its START time, not its publish date: from UPCOMING_BACK_DAYS before
   now (a late or re-timed start) onwards, soonest first. The old three-day window on the publish date stays for
   everything else. */
export const UPCOMING_BACK_DAYS = 3;
export const UPCOMING_MAX = 60;
export function refreshOrder({ found = [], stillLive = [], upcoming = [], recent = [], max = 200 } = {}) {
  return [...new Set([...found, ...stillLive, ...upcoming, ...recent].filter(Boolean))].slice(0, max);
}

/* ---- WHAT IS KEPT ----
   Everything a carried channel posts. The language and script filters belong to the ticker SEARCH (strangers'
   videos); a channel Alan subscribed to is his choice, whatever language its tag says. */
export function keepSubscribed(_row, _language) { return true; }

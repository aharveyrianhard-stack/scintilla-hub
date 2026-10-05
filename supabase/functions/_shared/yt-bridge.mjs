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

/** what youtube.com/channel/<id>/live answered. On air: the page IS a watch page (canonical /watch?v=…) and the
    player says isLive. A stream still to come lands on a watch page too, but says isUpcoming — that is not on air.
    Not streaming: the channel page comes back. A consent or error page reads as "unknown", never as "not live". */
export function parseLivePage(html) {
  const text = String(html || "");
  if (!text || /consent\.youtube\.com|before you continue to youtube/i.test(text.slice(0, 20000)) && !/"videoDetails"/.test(text)) {
    return { state: "unknown", video_id: null };
  }
  const video = first(text, /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})"/);
  if (!video) {
    return /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/UC/.test(text)
      ? { state: "off", video_id: null } : { state: "unknown", video_id: null };
  }
  if (/"isUpcoming":true/.test(text)) return { state: "upcoming", video_id: video };
  if (/"isLive":true/.test(text) || /"isLiveNow":true/.test(text)) {
    const viewers = first(text, /"originalViewCount":"(\d+)"/);
    return { state: "live", video_id: video, title: unjson(first(text, /"videoDetails":\{"videoId":"[A-Za-z0-9_-]{11}","title":"((?:[^"\\]|\\.)*)"/) || ""),
      viewers: viewers ? +viewers : null };
  }
  return { state: "off", video_id: video };
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

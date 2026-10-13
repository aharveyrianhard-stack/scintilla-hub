// SCINTILLA · yt-feed-fallback — what the collector keeps from a followed channel, and a SECOND WAY to read a
// channel when YouTube's public feed does not answer.
//
// Alan, 12 Oct, about a channel on the SCINTILLA list: "The videos are not coming through to the Scintilla channel. He
// posted a video 18 minutes ago. I don't have it there … I'd like to get this guy's videos onto the feed."
//
// WHAT WAS MEASURED (12–13 Oct, from the collector's own stored answers — 72 passes — and YouTube's API):
//   1. That channel's feed was answering. Every one of its videos carries the language tag "zxx" (the code for
//      "no spoken language"), and the collector threw away any new video whose tag did not start with "en". The
//      only two times its videos were ever stored (10 Sep, 10 Oct) were passes where the API gave no tag at all.
//      That is rule 1 below, and it is the fix for Alan's channel.
//   2. The public feed (youtube.com/feeds/videos.xml) fails in BURSTS: 36 passes in a row (three hours) with
//      all 194 feeds answering, then 95 minutes with 99–190 of them answering 404 / 500. A burst delays a video
//      — the feed carries the newest 15 when it answers again — but a channel dark for hours has no other way
//      in. That is rule 2: the channel's uploads list, read through the YouTube Data API, inside a hard budget.
//
// Plain ESM, read by Deno (yt-rss-sweep, through _shared/yt-bridge.mjs) and Node (the tests) alike. No key is
// ever returned, stored or put in a message here: the one function that holds it builds the request and gives
// back facts only.
import { pacificClock, DAILY_QUOTA, SEARCH_BUDGET_UNITS, COST_PER_SEARCH } from "./yt-search-plan.mjs";

const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/* ---- RULE 1 · WHAT IS KEPT ----
   Everything a carried channel posts. The language and script filters belong to the ticker SEARCH (strangers'
   videos); a channel Alan subscribed to is his choice, whatever language its tag says (Alan, 6 Oct: "Everything
   subscribed."). Same rule, same name and same call sites as Y4's collector, which was never deployed. */
export function keepSubscribed(_row, _language) { return true; }
/** would the old rule have thrown this video away for its tag? (counted, so the change can be seen in the result) */
export const otherLanguage = (tag) => { const t = String(tag || "").toLowerCase(); return !!t && t.slice(0, 2) !== "en"; };

/* ---- RULE 2 · THE SECOND WAY ----
   WHO IS ASKED   a channel whose feed gave no readable answer THIS pass and that has not been read, by either
                  way, for more than after_min minutes. Oldest-unread first.
   HOW            playlistItems.list on the channel's uploads list ("UU" + the id without its "UC"): 1 unit a call
                  whatever the page size, so the page is the feed's own 15 — what the feed would have given.
   WHAT IT COSTS  the neighbours share one allowance of DAILY_QUOTA units, reset at midnight Pacific:
                    the RADAR searches   79 × 101 = 7,979      (yt-search-plan.mjs, Y1)
                    this sweep, worst    288 × (1 + 4) = 1,440 (one new-video call + four refresh calls a pass;
                                                                measured 12 Oct: 1.9 a pass, about 550 a day)
                    what is left         581 on the worst day, about 1,470 on the measured one
                  The default is 580 a day, so even the worst day adds up to 9,999. It is spent the way the
                  searches are (the same pacificClock): never more than the even share of the day that has
                  passed, so a day-long outage is served from midnight to midnight instead of running dry in
                  the afternoon, and never more than per_pass in one pass.
   WHERE THE NUMBERS LIVE  app_config row yt_rss_fallback, e.g. {"per_pass":6,"per_day":580}. The sweep only reads
                  it. No row: the defaults below. per_pass 0 or per_day 0 switches the second way off. */
export const HEALTH_KEY = "yt_rss_health";
export const SETTINGS_KEY = "yt_rss_fallback";
export const SWEEP_EVERY_MIN = 5;
export const UNITS_PER_READ = 1;
export const SEARCH_MAX_UNITS = Math.floor(SEARCH_BUDGET_UNITS / COST_PER_SEARCH) * COST_PER_SEARCH;
export const SWEEP_WORST_UNITS = (1440 / SWEEP_EVERY_MIN) * (1 + 200 / 50);
export const WORST_DAY_ROOM = DAILY_QUOTA - SEARCH_MAX_UNITS - SWEEP_WORST_UNITS;
export const FALLBACK_DEFAULTS = Object.freeze({ per_pass: 6, per_day: 580, after_min: 60, max_results: 15 });
/* a typing slip in the row must not be able to spend the day: per_day never passes the whole non-search share */
export const FALLBACK_LIMITS = Object.freeze({ per_pass: [0, 25], per_day: [0, DAILY_QUOTA - SEARCH_BUDGET_UNITS], after_min: [10, 1440], max_results: [1, 50] });

/** the yt_rss_fallback row (text or object) → the numbers in force, and where they came from */
export function fallbackSettings(raw) {
  let row = null, from = "default";
  if (raw != null && raw !== "") {
    try { row = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (_) { row = null; }
    if (row && typeof row === "object" && !Array.isArray(row)) from = "app_config";
    else { row = null; from = "default (the yt_rss_fallback row could not be read)"; }
  }
  const out = {};
  for (const [name, standard] of Object.entries(FALLBACK_DEFAULTS)) {
    const [low, high] = FALLBACK_LIMITS[name];
    const given = row && row[name] != null && row[name] !== "" ? Number(row[name]) : NaN;
    out[name] = Number.isFinite(given) ? Math.min(high, Math.max(low, Math.floor(given))) : standard;
  }
  return { ...out, from };
}

/* ---- WHAT IS REMEMBERED (app_config yt_rss_health, written by the sweep only) ----
   { v, at, day, used, quota_day, ch: { <channel id>: { ok, fb, f, t, x, b, n } } }   every time in epoch seconds
     ok  the feed last answered            fb  the second way last answered        f  feed misses in a row
     t   the second way last FAILED on it  x   second-way failures in a row        b  first seen unread (never read yet)
     n   the channel's name, kept only while it is in trouble
   day / used are the Pacific quota day and the second-way calls made in it; quota_day is the day YouTube said the
   allowance was gone. A channel the feed answers is one short entry; a channel no longer followed is dropped. */
const TIMES = ["ok", "fb", "f", "t", "x", "b"];
export const FB_KEEP_SEC = 7 * 86400;
export function parseHealth(raw) {
  let h = null;
  try { h = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (_) { h = null; }
  if (!h || typeof h !== "object" || Array.isArray(h)) h = {};
  const ch = {};
  if (h.ch && typeof h.ch === "object" && !Array.isArray(h.ch)) {
    for (const [id, e] of Object.entries(h.ch)) {
      if (!CHANNEL_ID.test(id) || !e || typeof e !== "object") continue;
      const entry = {};
      for (const k of TIMES) { const v = Math.floor(Number(e[k])); if (Number.isFinite(v) && v > 0) entry[k] = v; }
      if (typeof e.n === "string" && e.n) entry.n = e.n.slice(0, 60);
      ch[id] = entry;
    }
  }
  const whole = (v) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? n : 0; };
  return { v: 1, at: whole(h.at), day: typeof h.day === "string" ? h.day : "", used: whole(h.used),
    quota_day: typeof h.quota_day === "string" ? h.quota_day : "", ch };
}
/** when a channel was last read by either way (0 = never, as far as the row remembers) */
export const lastRead = (entry) => Math.max((entry && entry.ok) || 0, (entry && entry.fb) || 0);
/** a channel the second way could not read either is asked again after after_min, then twice that, … at most daily */
export const retryAfterMin = (failures, afterMin) => Math.min(1440, afterMin * 2 ** Math.max(0, (failures || 1) - 1));

/** THIS PASS'S PICK. unread = the followed channels whose feed gave no readable answer this pass, in the order
    the sweep prefers on a tie (the SCINTILLA list first). Nothing here calls anything. */
export function fallbackPlan({ unread, health, settings, nowSec }) {
  const clock = pacificClock(nowSec * 1000);
  const usedToday = health.day === clock.day ? health.used : 0;
  const allowedByNow = Math.min(settings.per_day, Math.floor(settings.per_day * Math.min(1440, clock.minute + SWEEP_EVERY_MIN) / 1440));
  const room = Math.max(0, allowedByNow - usedToday);
  const eligible = [];
  let readLately = 0, resting = 0;
  (unread || []).forEach((id, order) => {
    const entry = health.ch[id] || {}, last = lastRead(entry);
    if (last && nowSec - last <= settings.after_min * 60) { readLately++; return; }
    if (entry.x && entry.t && nowSec - entry.t < retryAfterMin(entry.x, settings.after_min) * 60) { resting++; return; }
    eligible.push({ id, last, order });
  });
  eligible.sort((a, b) => a.last - b.last || a.order - b.order);
  const off = !settings.per_pass || !settings.per_day, quotaGone = health.quota_day === clock.day;
  const take = off || quotaGone ? 0 : Math.min(settings.per_pass, eligible.length, room);
  const skipped = eligible.length - take;
  /* which limit left channels unasked: the pass's own cap, or the day's — "pace" while the day's even share is
     what holds it back, "day" once the whole day's number is what is left */
  let cap = null;
  if (skipped > 0) {
    cap = off ? "off" : quotaGone ? "quota" : room >= settings.per_pass ? "pass"
      : allowedByNow >= settings.per_day ? "day" : "pace";
  }
  return { day: clock.day, used_today: usedToday, allowed_by_now: allowedByNow, eligible: eligible.map((c) => c.id),
    pick: eligible.slice(0, take).map((c) => c.id), skipped_budget: skipped, cap, read_lately: readLately, resting };
}
/** the cap, in words a person reads in the result row */
export function capWords(cap, settings, plan) {
  if (cap === "pass") return "the cap of " + settings.per_pass + " channels a pass";
  if (cap === "pace") return "the day's even share so far is spent (" + plan.used_today + " of " + plan.allowed_by_now + " allowed by now, " + settings.per_day + " a day)";
  if (cap === "day") return "the day's " + settings.per_day + " calls are spent (" + plan.used_today + " before this pass)";
  if (cap === "quota") return "YouTube said the day's allowance is gone; the second way rests until midnight Pacific";
  if (cap === "off") return "switched off in app_config (" + SETTINGS_KEY + ")";
  return null;
}

/* outcomes that say nothing about the channel: the allowance, the pace of calls, the key, the line */
const QUOTA_REASONS = ["quotaExceeded", "dailyLimitExceeded"];
const RATE_REASONS = ["rateLimitExceeded", "userRateLimitExceeded"];
const KEY_REASONS = ["keyInvalid", "keyExpired", "accessNotConfigured", "ipRefererBlocked", "badRequest"];
export const NOT_THE_CHANNEL = ["quota", "rate", "key_or_request", "timeout", "fetch_error", "no_key", "not_asked"];

export const uploadsPlaylistId = (channelId) => "UU" + String(channelId).slice(2);
export const uploadsPath = (channelId, maxResults = FALLBACK_DEFAULTS.max_results) =>
  "playlistItems?part=snippet,contentDetails&playlistId=" + uploadsPlaylistId(channelId) + "&maxResults=" + maxResults;
/** a description cut to the stored length without cutting a character in half (a lone half breaks the table write) */
const cut = (text, n) => { const s = String(text || "").slice(0, n); const last = s.charCodeAt(s.length - 1); return last >= 0xD800 && last <= 0xDBFF ? s.slice(0, -1) : s; };
const GONE = ["Private video", "Deleted video"];

/** an uploads-list answer → rows in the shape of the feed's own entries, so everything after (already-stored
    check, the videos call, shorts, live) treats them exactly as it treats a feed entry */
export function uploadsToCandidates(body, channelId, nowSec) {
  const rows = [], seen = new Set();
  for (const item of (body && Array.isArray(body.items) ? body.items : [])) {
    const s = (item && item.snippet) || {}, c = (item && item.contentDetails) || {};
    const videoId = c.videoId || (s.resourceId && s.resourceId.videoId);
    if (!VIDEO_ID.test(String(videoId || "")) || seen.has(videoId)) continue;
    if (s.resourceId && s.resourceId.kind && s.resourceId.kind !== "youtube#video") continue;
    if (s.videoOwnerChannelId && s.videoOwnerChannelId !== channelId) continue;
    /* a private or removed upload has no publish time and a placeholder title; the public feed never lists it */
    if (!c.videoPublishedAt && (GONE.includes(String(s.title || "")) || !s.publishedAt)) continue;
    seen.add(videoId);
    const thumbs = s.thumbnails || {};
    rows.push({
      video_id: videoId,
      channel_id: channelId,
      channel_title: String(s.videoOwnerChannelTitle || s.channelTitle || ""),
      title: String(s.title || ""),
      description: cut(s.description, 500),
      thumbnail: (thumbs.high && thumbs.high.url) || (thumbs.medium && thumbs.medium.url) || (thumbs.default && thumbs.default.url)
        || "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg",
      url: "https://www.youtube.com/watch?v=" + videoId,
      published_at: c.videoPublishedAt || s.publishedAt,
      source: "subscription",
      ticker: null,
      updated_ts: nowSec,
    });
  }
  return rows;
}

/** ONE CHANNEL, THE SECOND WAY. Never throws and never repeats the key: { id, sent, status, outcome, reason,
    name, rows }. outcome is ok · not_found · forbidden · unreadable · http_NNN (the channel) or quota · rate ·
    key_or_request · timeout · fetch_error (not the channel). Bounded by UPLOADS_TIMEOUT_MS. */
export const UPLOADS_TIMEOUT_MS = 8000;
export async function readUploads(channelId, apiKey, fetchFn = globalThis.fetch, opts = {}) {
  const none = { id: channelId, sent: false, status: 0, outcome: "not_asked", reason: null, name: "", rows: [] };
  if (!CHANNEL_ID.test(String(channelId || ""))) return { ...none, outcome: "not_a_channel_id" };
  if (!apiKey) return { ...none, outcome: "no_key" };
  const nowSec = opts.nowSec ?? Math.floor(Date.now() / 1000);
  let r;
  try {
    const signal = typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(opts.timeoutMs ?? UPLOADS_TIMEOUT_MS) : undefined;
    r = await fetchFn("https://www.googleapis.com/youtube/v3/" + uploadsPath(channelId, opts.maxResults ?? FALLBACK_DEFAULTS.max_results)
      + "&key=" + encodeURIComponent(apiKey), { signal });
  } catch (e) {
    return { ...none, sent: true, outcome: e && (e.name === "TimeoutError" || e.name === "AbortError") ? "timeout" : "fetch_error" };
  }
  let body = null;
  try { body = JSON.parse(await r.text()); } catch (_) { body = null; }
  const first = body && body.error && Array.isArray(body.error.errors) ? body.error.errors[0] : null;
  const reason = first && typeof first.reason === "string" ? first.reason.slice(0, 40) : null;
  if (r.status === 200 && body && Array.isArray(body.items)) {
    const rows = uploadsToCandidates(body, channelId, nowSec);
    const named = body.items.find((item) => item && item.snippet && (item.snippet.videoOwnerChannelTitle || item.snippet.channelTitle));
    return { ...none, sent: true, status: 200, outcome: "ok", rows,
      name: named ? String(named.snippet.videoOwnerChannelTitle || named.snippet.channelTitle) : "" };
  }
  const outcome = QUOTA_REASONS.includes(reason) ? "quota" : RATE_REASONS.includes(reason) || r.status === 429 ? "rate"
    : r.status === 400 || KEY_REASONS.includes(reason) ? "key_or_request" : r.status === 404 ? "not_found"
    : r.status === 403 ? "forbidden" : r.status === 200 ? "unreadable" : "http_" + r.status;
  return { ...none, sent: true, status: r.status, outcome, reason };
}

/** a whole pass of the second way: the picked channels asked together (at most per_pass of them, each bounded by
    UPLOADS_TIMEOUT_MS, so the pass grows by seconds). An answer that says the allowance is gone, or that the key
    or the line is at fault, is not a fact about a channel: nextHealth holds nothing against the channel for it. */
export async function readUploadsPass(channelIds, apiKey, fetchFn = globalThis.fetch, opts = {}) {
  return await Promise.all((channelIds || []).map((id) => readUploads(id, apiKey, fetchFn, opts)));
}

/** the public feed for one channel, with the sweep's own one retry: the look-only door's read (the sweep's loop
    keeps its own). A feed "answered" when YouTube said OK and the body is a feed. */
export const FEED_TIMEOUT_MS = 15000;
export async function feedAnswers(channelId, fetchFn = globalThis.fetch) {
  const url = "https://www.youtube.com/feeds/videos.xml?channel_id=" + channelId;
  let status = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const signal = typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(FEED_TIMEOUT_MS) : undefined;
      const r = await fetchFn(url, { signal });
      status = r.status;
      if (r.ok) return { id: channelId, ok: isFeed(await r.text()), status };
    } catch (_) { status = 0; }
    if (attempt === 0) await new Promise((ok) => setTimeout(ok, 700));
  }
  return { id: channelId, ok: false, status };
}
/** is this body a channel feed at all? (an OK answer that is some other page is not a read) */
export const isFeed = (xml) => /<feed[\s>]/.test(String(xml || ""));

/** THE ROW AFTER THIS PASS. channels = every followed channel this pass; feedOk = the ones whose feed answered;
    reads = what readUploads gave back. Returns the new row; the old one is not touched. */
export function nextHealth({ health, channels, feedOk, reads, nowSec }) {
  const clock = pacificClock(nowSec * 1000);
  const ch = {};
  for (const id of channels || []) {
    if (!CHANNEL_ID.test(String(id))) continue;
    const prev = health.ch[id] || {}, entry = {};
    if (feedOk.has(id)) {
      entry.ok = nowSec;
      if (prev.fb && nowSec - prev.fb < FB_KEEP_SEC) entry.fb = prev.fb;
    } else {
      if (prev.ok) entry.ok = prev.ok;
      if (prev.fb) entry.fb = prev.fb;
      entry.f = (prev.f || 0) + 1;
      if (prev.t) entry.t = prev.t;
      if (prev.x) entry.x = prev.x;
      if (!entry.ok && !entry.fb) entry.b = prev.b || nowSec;
      if (prev.n) entry.n = prev.n;
    }
    ch[id] = entry;
  }
  let calls = 0, quotaGone = false;
  for (const read of reads || []) {
    if (read.sent) calls += UNITS_PER_READ;
    if (read.outcome === "quota") quotaGone = true;
    const entry = ch[read.id];
    if (!entry) continue;
    if (read.outcome === "ok") {
      entry.fb = nowSec;
      delete entry.t; delete entry.x; delete entry.b;
      if (read.name && entry.f) entry.n = String(read.name).slice(0, 60);
    } else if (!NOT_THE_CHANNEL.includes(read.outcome)) {
      entry.t = nowSec;
      entry.x = (entry.x || 0) + 1;
    }
  }
  return { v: 1, at: nowSec, day: clock.day, used: (health.day === clock.day ? health.used : 0) + calls,
    quota_day: quotaGone ? clock.day : (health.quota_day === clock.day ? health.quota_day : ""), ch };
}

/** the channels nothing has read for more than a day — by the feed or by the second way. hours since the last
    read (or since first seen unread). The list the result row names, so nothing goes quiet unseen. */
export const UNREAD_NAMED_MAX = 40;
export function unreadOverADay(health, nowSec) {
  const out = [];
  for (const [id, entry] of Object.entries(health.ch)) {
    const since = Math.max(entry.ok || 0, entry.fb || 0, entry.b || 0);
    if (since && nowSec - since > 86400) out.push({ id, name: entry.n || "", hours: Math.floor((nowSec - since) / 3600), feed_misses: entry.f || 0, second_way_failures: entry.x || 0 });
  }
  return out.sort((a, b) => b.hours - a.hours || a.id.localeCompare(b.id));
}

/** the followed channels of one pass, from the saved lists alone — the look-only door reads these and signs in
    nowhere. Returns { account: [ids] }; the unsuffixed list is the SCINTILLA identity's, as in the sweep. */
export function savedChannelLists(config, accounts) {
  const out = {};
  for (const account of accounts) {
    let ids = [];
    try {
      const cached = JSON.parse(config["yt_sub_channels_" + account] || (account === "scintilla" ? config.yt_sub_channels : "") || "{}");
      ids = Array.isArray(cached.ids) ? cached.ids.filter((id) => CHANNEL_ID.test(String(id))) : [];
    } catch (_) { ids = []; }
    out[account] = ids;
  }
  return out;
}
/** which accounts carry each channel, and the channels in the order a tie is settled: SCINTILLA's first */
export function carriers(accountChannels, accounts, first = "scintilla") {
  const by = new Map();
  for (const account of [first, ...accounts.filter((a) => a !== first)]) {
    for (const id of accountChannels[account] || []) {
      if (!by.has(id)) by.set(id, new Set());
      by.get(id).add(account);
    }
  }
  return by;
}

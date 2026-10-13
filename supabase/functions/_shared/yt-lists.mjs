// SCINTILLA · yt-lists — the followed lists refreshed without a sign-in where YouTube allows it, and what happens
// to a channel's stored videos when the channel leaves a list (Y6).
//
// Alan, 12 Oct 22:40 ET: "I have tried to make some changes to the subscriptions … this was supposed to happen daily."
// It did happen hourly — while a Google sign-in worked. Every sign-in has answered invalid_grant since 30 Sep.
//
// WHAT WAS MEASURED (13 Oct 03:27Z, 9 units of YouTube's allowance):
//   · subscriptions.list?channelId=<the account's own channel>&key=… answers WITHOUT a sign-in when the account
//     shows its subscriptions. Of the six accounts:
//        SCINTILLA    200 — 56 channels on two pages (49 + 7); both of YouTube's orders gave the same 56.
//        PERSONAL, GOLF, AI_RESEARCH    403 subscriptionForbidden — the account keeps its subscriptions private.
//        SOUNDSCAPES  200 with NO channels at all, against 47 saved. By its status that is a clean answer, and
//                     taken as one it would have emptied the list and untagged every video under it.
//        FITNESS      no channel id on file; never connected.
//   · a page can come back short of its 50 (49 here) with a page still to follow, and totalResults said 57 for a
//     list of 56: only a page WITHOUT nextPageToken ends a list.
//   · the direct question, subscriptions.list?channelId=…&forChannelId=a,b,c (1 unit), gave back exactly the
//     channels the account follows out of seven asked — three it follows, three it had left, one made-up id.
//
// THE RULES
//   WHEN      an account's saved list is older than an hour and its sign-in did not refresh it (it failed, or there
//             is none). Then the public way: once an hour for an account it can read; once every list_retry_min
//             for one that is private, empty or out of bounds — being told "private" again costs a unit each time.
//   HOW       every page, 50 to a page, alphabetical. The list is read only if EVERY page answered and the last
//             had no nextPageToken. One page that does not answer, or more than 10 pages, and nothing of it is used.
//   TAKEN     only if it has between list_min_pct and list_max_pct (60–300 %) as many channels as the saved one.
//             An account with nothing saved takes what it is given.
//   LEAVING   a channel in the saved list and missing from the fresh one has not left yet: it is asked about
//             directly, and only a channel YouTube does not give back there has left. If the question cannot be
//             asked, nobody leaves this hour. A channel that rides with the SCINTILLA list (the bridge) does not
//             leave by this door at all.
//   THE TAG   a channel that left has that account's tag taken off its stored videos — nothing else on a row
//             changes, no row is deleted, and a tag another list put there stays — BEFORE the list is saved. If
//             the tags cannot be taken off, the list is not saved and the next hour tries again.
//
// Plain ESM, read by Deno (yt-rss-sweep, through _shared/yt-bridge.mjs) and Node (the tests) alike. No key is
// returned, stored or put in a message here. This file never touches a table: the sweep does the writing.
import { apiGet } from "./yt-feed-fallback.mjs";

const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
export const LIST_STALE_SEC = 3600;
export const LIST_PAGE = 50;
export const LIST_MAX_PAGES = 10;
/* the whole lists step of one pass: an account not reached inside it is simply left for the next pass */
export const LISTS_BUDGET_MS = 20000;
export const ownChannelKey = (account) => "YT_CHANNEL_ID_" + String(account).toUpperCase();
export const publicListPath = (ownId, pageToken = "") => "subscriptions?part=snippet&maxResults=" + LIST_PAGE + "&order=alphabetical&channelId=" + ownId
  + (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");
export const stillSubscribedPath = (ownId, ids) => "subscriptions?part=snippet&maxResults=" + LIST_PAGE + "&channelId=" + ownId + "&forChannelId=" + ids.join(",");
const subscribedTo = (item) => (item && item.snippet && item.snippet.resourceId && item.snippet.resourceId.channelId) || "";

/** AN ACCOUNT'S LIST, THE PUBLIC WAY. Never throws and never repeats the key: { sent, outcome, reason, ids, names,
    pages }. sent = pages asked = units. outcome is ok, or why there is no list: private · closed · not_found ·
    too_long · day (the pass had no units left for the next page) · quota · rate · key_or_request · unreadable ·
    http_NNN · timeout · fetch_error · no_channel_id · no_key. Only "ok" carries ids. */
export async function readPublicList(ownId, apiKey, fetchFn = globalThis.fetch, opts = {}) {
  const none = { sent: 0, outcome: "not_asked", reason: null, ids: [], names: {}, pages: 0 };
  if (!CHANNEL_ID.test(String(ownId || ""))) return { ...none, outcome: "no_channel_id" };
  if (!apiKey) return { ...none, outcome: "no_key" };
  const maxPages = Math.max(0, Math.min(LIST_MAX_PAGES, Math.floor(opts.maxPages ?? LIST_MAX_PAGES)));
  const ids = [], names = {};
  let pageToken = "", sent = 0, pages = 0;
  for (let page = 0; page < maxPages; page++) {
    const r = await apiGet(publicListPath(ownId, pageToken), apiKey, fetchFn);
    if (r.sent) sent++;
    if (r.outcome !== "ok" || !Array.isArray(r.body.items)) {
      const outcome = r.outcome === "ok" ? "unreadable" : r.outcome === "forbidden" && r.reason === "subscriptionForbidden" ? "private"
        : r.outcome === "forbidden" && (r.reason === "accountClosed" || r.reason === "accountSuspended") ? "closed" : r.outcome;
      return { ...none, sent, outcome, reason: r.reason, pages };            // one page did not answer: nothing of this read is used
    }
    pages++;
    for (const item of r.body.items) {
      const id = subscribedTo(item);
      if (CHANNEL_ID.test(id) && !ids.includes(id)) { ids.push(id); names[id] = String(item.snippet.title || "").slice(0, 60); }
    }
    pageToken = typeof r.body.nextPageToken === "string" ? r.body.nextPageToken : "";
    if (!pageToken) return { ...none, sent, outcome: "ok", ids, names, pages };
  }
  return { ...none, sent, outcome: maxPages < LIST_MAX_PAGES ? "day" : "too_long", pages };
}

/** THE DIRECT QUESTION: of these channels, which does the account still follow? { sent, outcome, reason, still }
    — still is a Set, or null when the question could not be asked (then nobody may be said to have left). */
export async function askStillSubscribed(ownId, ids, apiKey, fetchFn = globalThis.fetch) {
  const still = new Set();
  let sent = 0;
  for (let i = 0; i < ids.length; i += LIST_PAGE) {
    const batch = ids.slice(i, i + LIST_PAGE);
    const r = await apiGet(stillSubscribedPath(ownId, batch), apiKey, fetchFn);
    if (r.sent) sent++;
    if (r.outcome !== "ok" || !Array.isArray(r.body.items)) return { sent, outcome: r.outcome === "ok" ? "unreadable" : r.outcome, reason: r.reason, still: null };
    for (const item of r.body.items) { const id = subscribedTo(item); if (batch.includes(id)) still.add(id); }
  }
  return { sent, outcome: "ok", reason: null, still };
}
/** the same question's answer, read out of a sign-in's own call (the sweep makes that call; it holds the token) */
export function stillFromAnswer(status, body, asked) {
  if (status !== 200 || !body || !Array.isArray(body.items)) return null;
  return new Set(body.items.map(subscribedTo).filter((id) => asked.includes(id)));
}

/** IS A LIST READ THE PUBLIC WAY TAKEN? { take, code, pct } — code is first · ok · empty · smaller · larger */
export function acceptList({ saved, fresh, notice }) {
  if (!saved) return { take: true, code: "first", pct: null };
  const pct = Math.round((100 * fresh) / saved);
  if (!fresh) return { take: false, code: "empty", pct: 0 };
  if (fresh * 100 < saved * notice.list_min_pct) return { take: false, code: "smaller", pct };
  if (fresh * 100 > saved * notice.list_max_pct) return { take: false, code: "larger", pct };
  return { take: true, code: "ok", pct };
}

/** the channels of the saved list that the fresh one lacks — the ones to ask about. A channel that rides with
    the list (the bridge) is not one of them: it is carried whether the account follows it or not. */
export const missingFrom = (saved, fresh, riding = []) => (saved || []).filter((id) => !fresh.includes(id) && !riding.includes(id));
/** WHO LEFT, AND WHAT THE LIST BECOMES. still = the direct question's answer, or null when it could not be asked.
    { ids, left, held } — held: missing from the read, but YouTube says still followed (or could not be asked). */
export function settleList({ saved, fresh, riding = [], still }) {
  const missing = missingFrom(saved, fresh, riding);
  if (!missing.length) return { ids: [...fresh], left: [], held: [], asked: false };
  const held = still ? missing.filter((id) => still.has(id)) : missing;
  const left = still ? missing.filter((id) => !still.has(id)) : [];
  return { ids: [...fresh, ...held], left, held, asked: !!still };
}

/** THE TAG COMING OFF: the stored rows of the channels that left, grouped by what their tags become, so one write
    serves every row that ends the same. A row keeps every other list's tag; a row without the tag is left alone. */
export function untagGroups(rows, account) {
  const groups = new Map();
  for (const row of rows || []) {
    const have = Array.isArray(row.subscription_accounts) ? row.subscription_accounts : [];
    if (!have.includes(account)) continue;
    const next = have.filter((name) => name !== account);
    const key = JSON.stringify(next);
    if (!groups.has(key)) groups.set(key, { next, ids: [], channels: {} });
    const group = groups.get(key);
    group.ids.push(row.video_id);
    group.channels[row.channel_id] = (group.channels[row.channel_id] || 0) + 1;
  }
  return [...groups.values()];
}

/* an answer that will be the same in an hour is asked for again only every list_retry_min */
export const SLOW_AGAIN = ["private", "empty", "smaller", "larger", "not_found", "closed", "too_long"];
/** may the public way be tried for this account now? line = what is remembered about it (ls[account]) */
export function publicWayDue(line, nowSec, notice) {
  if (!line || !line.t) return true;
  const wait = SLOW_AGAIN.includes(line.k) ? notice.list_retry_min : 60;
  return nowSec - line.t >= wait * 60 - 30;
}

/** why the saved list was kept, in words a person reads in the result row */
export function keptWords(code, line, savedCount) {
  const n = line && line.n != null ? line.n : "?", p = line && line.p != null ? line.p : "?";
  if (code === "private") return "YouTube keeps this account's subscriptions private (403), so its list cannot be read without a sign-in";
  if (code === "empty") return "YouTube showed no subscriptions at all for this account, against " + savedCount + " saved — the saved list stays";
  if (code === "smaller") return "the list read had " + n + " channels against " + savedCount + " saved (" + p + "%) — too few to be taken, the saved list stays";
  if (code === "larger") return "the list read had " + n + " channels against " + savedCount + " saved (" + p + "%) — too many to be taken, the saved list stays";
  if (code === "not_found") return "YouTube does not know the channel id on file for this account";
  if (code === "closed") return "YouTube says this account is closed or suspended";
  if (code === "too_long") return "the list runs past " + LIST_MAX_PAGES * LIST_PAGE + " channels and was not read to its end";
  if (code === "no_id") return "no channel id is on file for this account, and its sign-in does not answer";
  if (code === "untag") return "the tags could not be taken off the videos of the channels that left, so the list was not changed";
  if (code === "day") return "the day's calls were spent before this list's turn";
  if (code === "neighbours") return "RADAR's searches and this sweep's own calls left no unit for this list's turn today";
  if (code === "no_time") return "the lists ran out of their time this pass before this account's turn; it is tried on the next";
  if (code === "quota") return "YouTube said the day's allowance is gone";
  if (code === "off") return "the public way is switched off in app_config (yt_rss_fallback)";
  return "YouTube did not answer (" + code + ")";
}

/** ONE ACCOUNT'S LINE IN THE RESULT ROW: which way the list in force was last refreshed and when; and, when the
    last try kept the saved list, why and when that try was. way is sign-in · public · kept. */
export function listSays({ line, savedTs, savedCount, nowSec, notice }) {
  const iso = (sec) => (sec ? new Date(sec * 1000).toISOString() : null);
  const by = line && line.w && line.a && line.a === savedTs ? line.w : null;
  const out = { way: line && line.k ? "kept" : by || "kept", at: iso(savedTs), channels: savedCount };
  if (line && line.k) {
    out.why = keptWords(line.k, line, savedCount);
    if (by) out.last_refreshed = by;
    if (line.t) {
      out.tried = iso(line.t);
      out.again_in_min = Math.max(0, Math.ceil(((SLOW_AGAIN.includes(line.k) ? notice.list_retry_min : 60) * 60 - (nowSec - line.t)) / 60));
    }
  } else if (!by) out.why = savedTs ? "saved by a sign-in or by hand, before this function kept track" : "nothing is saved for this account";
  return out;
}

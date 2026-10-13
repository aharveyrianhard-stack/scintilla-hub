// SCINTILLA · yt-feed-fallback — what the collector keeps from a followed channel.
//
// Alan, 12 Oct, about a channel on the SCINTILLA list: "The videos are not coming through to the Scintilla channel. He
// posted a video 18 minutes ago. I don't have it there … I'd like to get this guy's videos onto the feed."
//
// WHAT WAS MEASURED (12–13 Oct, from the collector's own stored answers — 72 passes — and YouTube's API):
//   Chart Desk Daily's feed was answering. Every one of its videos carries the language tag "zxx" (the code for
//   "no spoken language"), and the collector threw away any new video whose tag did not start with "en". The
//   only two times its videos were ever stored (10 Sep, 10 Oct) were passes where the API gave no tag at all.
//   That is rule 1 below, and it is the fix for Alan's channel.
//
// Plain ESM, read by Deno (yt-rss-sweep, through _shared/yt-bridge.mjs) and Node (the tests) alike.

/* ---- RULE 1 · WHAT IS KEPT ----
   Everything a carried channel posts. The language and script filters belong to the ticker SEARCH (strangers'
   videos); a channel Alan subscribed to is his choice, whatever language its tag says (Alan, 6 Oct: "Everything
   subscribed."). Same rule, same name and same call sites as Y4's collector, which was never deployed. */
export function keepSubscribed(_row, _language) { return true; }
/** would the old rule have thrown this video away for its tag? (counted, so the change can be seen in the result) */
export const otherLanguage = (tag) => { const t = String(tag || "").toLowerCase(); return !!t && t.slice(0, 2) !== "en"; };

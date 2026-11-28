/* 28 Nov 2026 (coordinator). What an alert says on the phone: its headline, then a COMPLETE summary that fits.
   Alan, 13:14 ET (relayed by the markets session): "when you get something in the notification center and you leave it pressed, it expands the
   bubble, you see more. Like in all of these, it's like the few sentences that I see there are incomplete. So like that summary should be
   complete in the space that the notification center allows. I click in and then I can see more detail."
   Before (v14): body = title + "\n" + the whole body, cut at 300 characters - 216 of 2,761 alerts in a week ended mid-word.
   Now: title + "\n" + the body's FIRST PARAGRAPH (the text before the first empty line), and when that does not fit, as many WHOLE sentences
   from its start as fit. If not even the first sentence fits (or the source sent a fragment with no sentence end), the headline alone:
   no trailing fragment, as the dispatch asks ("never mid-word, no trailing fragment"). The tap shows the rest.
   The tap still opens the whole card (card.html). Plain JS, no dependency: Deno imports it, Node tests it (tests/notify-phone-summary.test.mjs). */
export const PHONE_BODY_MAX = 300;

/* a full stop after these is not the end of a sentence: initials (J.P.), U.S., Inc., Mr., No., months, days */
const ABBR = /(?:^|[\s("'“‘\[])(?:[A-Z]|[A-Z]\.[A-Z]|U\.S|U\.K|E\.U|a\.m|p\.m|Inc|Corp|Co|Ltd|Plc|Mr|Mrs|Ms|Dr|Prof|St|Sr|Jr|vs|etc|e\.g|i\.e|approx|est|No|Nos|Fig|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat|Sun)$/;
const STARTS = /[A-Z0-9"'“‘(\[$€£¥#@•*–—-]/;   // what the next sentence may begin with

export function firstParagraph(body) {
  return String(body ?? "").replace(/\r\n?/g, "\n").split(/\n[ \t]*\n/)[0].trim();
}

/* the longest run of whole sentences from the start of `text` within `max` characters ("" when none fits) */
export function wholeSentences(text, max) {
  const s = String(text ?? "").trim();
  if (s.length <= max) return s;
  const re = /[.!?]+["'”’)\]]*(?=\s|$)/g;   // an ellipsis ("…", "...") is a pause or a source's own cut, never an end
  let best = 0, m;
  while ((m = re.exec(s)) && m.index + m[0].length <= max) {
    const end = m.index + m[0].length;
    if (s[m.index] === "." && m[0].length === 1 && ABBR.test(s.slice(0, m.index))) continue;
    if (/^\.{2,}/.test(m[0])) continue;
    const next = s.slice(end).trimStart()[0];
    if (next && !STARTS.test(next)) continue;
    best = end;
  }
  return s.slice(0, best).trim();
}

/* the last whole words within `max`, closed with an ellipsis (only for a headline that is itself longer than the space, or no headline) */
export function wholeWords(text, max) {
  const s = String(text ?? "").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, Math.max(0, max - 1));
  const sp = cut.search(/\s+\S*$/);
  return (sp > 0 ? cut.slice(0, sp) : cut).replace(/[\s,;:·–—-]+$/, "") + "…";
}

/* the phone's body line: headline, then the complete summary */
export function phoneBody(title, body, max = PHONE_BODY_MAX) {
  const t = String(title ?? "").trim();
  const p = firstParagraph(body);
  if (t.length >= max) return wholeWords(t, max);
  if (!p) return t;
  const room = max - (t ? t.length + 1 : 0);
  if (t && room < 40) return t;                                   // the headline fills the space
  const fit = wholeSentences(p, room);
  if (!t) return fit || wholeWords(p, max);
  return fit ? t + "\n" + fit : t;
}

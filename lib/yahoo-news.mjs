/* SCINTILLA · M63 — Yahoo Finance per-ticker headlines, as DATA.
 *
 * WHY THIS EXISTS. Alan, 24 Sep: "Yahoo Finance news?" Yahoo publishes a per-ticker RSS feed that
 * needs no key, no account and no scraping: https://feeds.finance.yahoo.com/rss/2.0/headline?s=BE
 * MEASURED 24 Sep 2026: 200 application/xml, 14.6 KB, 20 items for BE, each with a title, a link
 * to the publisher's own page, a pubDate and a description.
 *
 * WHAT IT DOES AND WILL NOT DO.
 *   · It stores the HEADLINE, the LINK and the TIME — the same three things the Google collector
 *     already stores. It does NOT copy article text: the description is kept only when Yahoo's own
 *     feed carries one, trimmed, and it is never presented as the article.
 *   · It never fetches the linked page. Nothing paywalled is read, cached or republished.
 *   · It writes rows with feed='yahoo' so every row can be told apart from the 'google' and 'fmp'
 *     rows already in the table, and so a bad pass can be deleted by feed alone.
 *   · It is pure: this file parses and maps. The runner (scripts/yahoo-news-pull.mjs) does the
 *     reading and the writing, so every rule below is testable offline against a saved feed.
 *
 * DEDUPE. public.news is keyed on (ticker, url). Yahoo and Google both carry the same story from
 * the same publisher often enough that this matters: the same url from either collector is the
 * same row, and whichever lands first wins. Nothing is counted twice.
 */

const tag = (block, name) => {
  const m = block.match(new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + name + ">", "i"));
  return m ? m[1] : "";
};
const unwrap = (s) => String(s || "").replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/i, "$1").trim();
const ents = (s) => String(s || "")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;|&#160;/g, " ")
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
  .replace(/&amp;/g, "&").trim();
const text = (block, name) => ents(unwrap(tag(block, name)));

/** every <item> in a Yahoo headline feed, in the feed's own order */
export function parseYahooRss(xml) {
  const out = [];
  for (const m of String(xml || "").matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const b = m[1];
    out.push({
      title: text(b, "title"),
      link: text(b, "link"),
      pubDate: text(b, "pubDate"),
      description: text(b, "description"),
      guid: text(b, "guid"),
    });
  }
  return out;
}

export const hostOf = (url) => {
  try { return new URL(String(url)).hostname.replace(/^www\./i, ""); } catch (_) { return null; }
};
/** RFC-822 dates, as Yahoo writes them ("Thu, 24 Sep 2026 12:45:01 +0000") -> epoch SECONDS */
export const pubSeconds = (s) => {
  const t = Date.parse(String(s || ""));
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
};

/* what a row must have before it is worth storing. A headline with no link cannot be opened, a
   headline with no time cannot be ordered against the rest of the table, and a link that is not
   http(s) is not a story. Each refusal is reported, never silently dropped. */
export function yahooRows({ ticker, xml, now = Date.now(), maxAgeDays = 7, snippetMax = 280 }) {
  const rows = [], skipped = [];
  const tk = String(ticker || "").trim().toUpperCase();
  if (!tk) return { rows, skipped: [{ reason: "NO_TICKER" }] };
  const seen = new Set();
  for (const it of parseYahooRss(xml)) {
    if (!it.title) { skipped.push({ reason: "NO_TITLE", link: it.link || null }); continue; }
    const url = it.link;
    if (!/^https?:\/\//i.test(url || "")) { skipped.push({ reason: "NO_LINK", title: it.title }); continue; }
    const ts = pubSeconds(it.pubDate);
    if (ts == null) { skipped.push({ reason: "NO_DATE", title: it.title }); continue; }
    const ageDays = (now / 1000 - ts) / 86400;
    if (ageDays > maxAgeDays) { skipped.push({ reason: "TOO_OLD", title: it.title, age_days: Math.round(ageDays) }); continue; }
    if (seen.has(url)) { skipped.push({ reason: "DUPLICATE_IN_FEED", title: it.title }); continue; }
    seen.add(url);
    const snip = it.description ? it.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, snippetMax) : null;
    rows.push({
      ticker: tk,
      url,
      title: it.title,
      published_ts: ts,                 /* epoch SECONDS, the column's own units */
      site: hostOf(url),                /* the PUBLISHER's host, not Yahoo's — the link goes there */
      snippet: snip || null,
      feed: "yahoo",
    });
  }
  return { rows, skipped };
}

export const YAHOO_URL = (ticker) =>
  "https://feeds.finance.yahoo.com/rss/2.0/headline?s=" + encodeURIComponent(String(ticker).toUpperCase()) +
  "&region=US&lang=en-US";

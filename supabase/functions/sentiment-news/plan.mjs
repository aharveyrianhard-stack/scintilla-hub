// SCINTILLA · sentiment-news — the decisions of a run, as plain functions.
//
// WHY THIS FILE EXISTS (5 Oct 2026, N1). Three faults sat in index.ts where no test could
// reach them, and each one was a decision, not a calculation:
//   1. the live run asked for "the newest 600 by publish time". The news table has no index
//      on publish time, so every run read all ~594,000 rows (3.1 s on a quiet database; past
//      the 8 s limit, answered 500 "read news", whenever the hourly vacuum ran beside it);
//   2. "newest by publish time" never sees a headline that ARRIVES late. The feeds deliver
//      most headlines hours after their publish stamp (median 21 h for the missed ones), so
//      42% of the last three days was never scored;
//   3. the back-fill called itself finished when a slice came back shorter than it asked for.
//      It asked for 1,500; the database never hands out more than 1,000; so the first slice
//      (24 Sep) ended it with 554,681 of 594,917 headlines unread.
// Plain ESM, read by Deno and by `node --test tests/sentiment-news-plan.test.mjs`.

/** PostgREST never returns more than this many rows to one request, whatever `limit` says. */
export const PAGE_CAP = 1000;

/** the live slice: the newest ARRIVALS. updated_ts is stamped once, when news-feed first
 *  stores the row (its upsert ignores duplicates), and has an index. */
export function liveQuery(limit) {
  return `news?select=url,ticker,title,snippet,site,published_ts,updated_ts&published_ts=not.is.null` +
    `&order=updated_ts.desc&limit=${Math.min(limit, PAGE_CAP)}`;
}

/** the back-fill slice: strictly older than the cursor, newest first. */
export function backfillQuery(cursor, limit) {
  return `news?select=url,ticker,title,snippet,site,published_ts&published_ts=not.is.null` +
    (cursor ? `&published_ts=lt.${cursor}` : "") +
    `&order=published_ts.desc&limit=${Math.min(limit, PAGE_CAP)}`;
}

/** one publish stamp can carry more rows than a page holds (1,475 share 30 Jul 07:00Z).
 *  A full page may therefore have cut its oldest stamp in half; the rest is read by name. */
export function boundaryQuery(ts) {
  return `news?select=url,ticker,title,snippet,site,published_ts&published_ts=eq.${ts}&order=ticker.asc,url.asc`;
}
export function needsBoundary(rows, limit) {
  return rows.length >= Math.min(limit, PAGE_CAP);
}

/** merge two reads of headlines without repeating a (url, ticker) filing */
export function mergeRows(a, b, sep = "\t") {
  const seen = new Set(), out = [];
  for (const r of [...a, ...b]) {
    const k = r.url + sep + r.ticker;
    if (seen.has(k)) continue;
    seen.add(k); out.push(r);
  }
  return out;
}

/** what the back-fill writes down after a slice. It is finished ONLY when the read came back
 *  empty, or when it has walked past the `since` floor — never because a page was short. */
export function backfillNext({ rows, cursor, sinceTs = null }) {
  if (!rows.length) return { cursor_ts: cursor, done: true, why: "no rows older than the cursor" };
  const minTs = Math.min(...rows.map((r) => +r.published_ts));
  if (sinceTs != null && minTs < sinceTs) return { cursor_ts: minTs, done: true, why: "reached the since floor" };
  return { cursor_ts: minTs, done: false, why: "more to read" };
}

/** `since=YYYY-MM-DD` → epoch seconds (UTC midnight); anything else → null (no floor) */
export function sinceToTs(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = Date.parse(s + "T00:00:00Z");
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

/** "is this filing already scored?" asked by NAME, because a slice of late arrivals spans
 *  months of publish time and a time-range read would be cut off. Returns PostgREST filters,
 *  each short enough to travel in a URL. */
export function urlInFilters(urls, maxChars = 2400) {
  const uniq = [...new Set(urls.filter(Boolean))];
  const out = [];
  let cur = [], len = 0;
  for (const u of uniq) {
    const q = encodeURIComponent('"' + String(u).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"');
    if (cur.length && len + q.length + 3 > maxChars) { out.push(cur); cur = []; len = 0; }
    cur.push(q); len += q.length + 3;
  }
  if (cur.length) out.push(cur);
  return out.map((c) => `url=in.(${c.join(",")})`);   // values are encoded, so a bare comma only ever separates
}

/** WHICH DAYS TO REBUILD. A run can only afford `maxDays`; the days it cannot afford are
 *  written down and done by the next runs — they used to be reported and then forgotten.
 *  Newest touched day first (today's reading stays live); when something is waiting, the last
 *  seat goes to the OLDEST waiting day so a busy week cannot starve it. */
export function pickDays(touched, pending, maxDays) {
  const all = [...new Set([...(touched || []), ...(pending || [])])].filter(Boolean).sort().reverse();
  if (all.length <= maxDays) return { now: all, later: [] };
  const now = all.slice(0, Math.max(1, maxDays - 1));
  if (maxDays > 1) now.push(all[all.length - 1]);
  const taken = new Set(now);
  return { now, later: all.filter((d) => !taken.has(d)) };
}

/** the waiting list is kept in app_config as text; a broken value reads as "nothing waiting" */
export function parseDays(value) {
  try {
    const a = JSON.parse(value || "[]");
    return Array.isArray(a) ? a.filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];
  } catch { return []; }
}

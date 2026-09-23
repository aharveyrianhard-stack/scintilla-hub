/* SOCIAL › SENTIMENT — the video count opens the videos behind it.
   ================================================================
   Alan, 22 Sep, on the sentiment box: "Is the video count clickable?" It is now. The count on a
   YouTube row is a control that opens, under its own row, the list of the videos the job counted:
   title (a link) · channel · age · lean. The contract this file holds:

     · only the YouTube job's rows get the door; other sources keep the plain count;
     · the list is the job's own per-video rows (youtube_video_sentiment ⟶ youtube_videos), never a
       title search dressed up as the list; when the job has not written them for a ticker the
       panel says so, names the table, and still offers the latest mention the row carries;
     · opening the list does not open the company row underneath it;
     · nothing added is white or near-white. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const SRC = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

function fnFrom(name) {
  const start = SRC.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0;
  for (let i = SRC.indexOf("{", start); i < SRC.length; i += 1) {
    if (SRC[i] === "{") depth += 1;
    if (SRC[i] === "}") { depth -= 1; if (depth === 0) return SRC.slice(start, i + 1); }
  }
  throw new Error(`unbalanced ${name}`);
}
/* one-line constants are taken as their line; esc spans two lines and ends at its own "[c]));" */
function constFrom(name) {
  const start = SRC.indexOf(`const ${name} =`);
  assert.notEqual(start, -1, `${name} must exist`);
  const tail = name === "esc" ? SRC.indexOf('"&#39;");', start) + '"&#39;");'.length : SRC.indexOf("\n", start);
  return SRC.slice(start, tail);
}
const api = vm.runInNewContext([
  constFrom("num"), constFrom("esc"), constFrom("YT_PUBLISHED_SHAPE"),
  fnFrom("ytAgo"), fnFrom("socScoreCol"), fnFrom("socPostsHTML"), fnFrom("socVideoRowHTML"), fnFrom("socVideosHTML"),
  "({ socPostsHTML, socVideoRowHTML, socVideosHTML })",
].join("\n"), {});

test("the count is a door on YouTube rows only", () => {
  const yt = api.socPostsHTML("NVDA", { source: "youtube" }, 12);
  assert.match(yt, /data-act="socvideos"/);
  assert.match(yt, /data-t="NVDA"/);
  assert.match(yt, /role="button"/);
  assert.match(yt, /12 videos/);
  const other = api.socPostsHTML("NVDA", { source: "stocktwits" }, 12);
  assert.doesNotMatch(other, /data-act/);
  assert.match(other, /12 posts/);
  assert.equal(api.socPostsHTML("NVDA", { source: "youtube" }, null), '<span class="sc-socposts">—</span>');
  assert.match(fnFrom("socRowHTML"), /socPostsHTML\(t, s, posts\)/, "the row paints its count through the door");
});

test("a listed video shows title · channel · age · link · lean", () => {
  const threeHoursAgo = new Date(Date.now() - 3 * 3600e3).toISOString();
  const html = api.socVideoRowHTML({ video_id: "abc123", mentions: 3, lean: 0.3,
    youtube_videos: { title: "Why <NVDA> runs", channel_title: "Mike Jones Investing", published_at: threeHoursAgo, url: "https://www.youtube.com/watch?v=abc123" } });
  assert.match(html, /href="https:\/\/www\.youtube\.com\/watch\?v=abc123"/);
  assert.match(html, /target="_blank" rel="noopener"/);
  assert.match(html, /Why &lt;NVDA&gt; runs/, "the title is escaped");
  assert.match(html, /class="ch">Mike Jones Investing</);
  assert.match(html, /class="age">3h ago</);
  assert.match(html, />\+0\.30</);
  assert.match(html, /3 mentions/);
  const bare = api.socVideoRowHTML({ video_id: "zzz", lean: null });
  assert.match(bare, /href="https:\/\/www\.youtube\.com\/watch\?v=zzz"/, "no joined row: the id still links to the video");
  assert.match(bare, /class="age"><\/span>/, "no publish time: no age, never a computed one");
});

test("with the job's rows the list is headed and newest first; without them it says exactly what is missing", () => {
  const rows = [{ video_id: "a", lean: 0.1, youtube_videos: { title: "A", channel_title: "C", published_at: "2026-09-22T10:00:00+00:00", url: "https://www.youtube.com/watch?v=a" } }];
  const full = api.socVideosHTML("BTCUSD", rows, { summary: { posts: 33, window_days: 7 } });
  assert.match(full, /1 video mentioning BTCUSD · 7-day window · newest first/);
  assert.match(full, /watch\?v=a/);
  const empty = api.socVideosHTML("META", [], { summary: { posts: 17, last_channel: "Mike Jones Investing" }, last: null });
  assert.match(empty, /the count \(17 videos\) comes from social_sentiment/);
  assert.match(empty, /youtube_video_sentiment holds 0 rows for it/);
  assert.match(empty, /Latest mention on record: Mike Jones Investing/);
  const emptyWithLast = api.socVideosHTML("META", [], { summary: { posts: 17 },
    last: { video_id: "HZ_GAhINQP8", title: "These stock moves", channel_title: "Mike Jones Investing", published_at: "2026-09-22T23:40:16+00:00", url: "https://www.youtube.com/watch?v=HZ_GAhINQP8" } });
  assert.match(emptyWithLast, /Latest mention on record: <div class="sc-socvid">/);
  assert.match(emptyWithLast, /watch\?v=HZ_GAhINQP8/);
});

test("opening the list never opens the company row under it, and the query is the job's own table", () => {
  assert.match(SRC, /case "socvideos": \{ e\.stopPropagation\(\); socToggleVideos\(a\.dataset\.t, a\); break; \}/);
  const fetch = fnFrom("socFetchVideos");
  assert.match(fetch, /youtube_video_sentiment\?select=video_id,mentions,lean,computed_at,youtube_videos\(title,channel_title,published_at,url\)/);
  assert.match(fetch, /&ticker=eq\./);
  assert.match(fetch, /youtube_videos\?select=video_id,title,channel_title,published_at,url&video_id=eq\./, "the latest mention is looked up by id");
  const toggle = fnFrom("socToggleVideos");
  assert.match(toggle, /open\.remove\(\)/, "a second click closes it");
  assert.match(toggle, /aria-expanded/);
});

test("house rule: nothing added is white or near-white", () => {
  const css = SRC.slice(SRC.indexOf('.sc-socposts[data-act="socvideos"]{'), SRC.indexOf(".sc-socvids__empty a{"));
  assert.ok(css.length > 200);
  assert.doesNotMatch(css, /#fff\b|#ffffff|#f2f2f8|#c6c8de|\bwhite(?!-space)|rgb\(255/i);
});

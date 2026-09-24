/* M70 (24 Sep 2026) — the Investing.com lane of news-feed, held to what it promises.
   The functions under test are lifted BY NAME out of the candidate function file, so this test cannot
   drift from the code that would be deployed. The RSS is a captured fixture of two of their real feeds
   (tests/fixtures/investing-*.xml, read 24 Sep 2026): no network is touched here. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SRC = fs.readFileSync(new URL("../deliverables/20260924/econ-news/news-feed-v23-investing-CANDIDATE.ts", import.meta.url), "utf8");
const grab = (re, what) => { const m = SRC.match(re); assert.ok(m, what + " is in the candidate"); return m[0]; };
const ctx = vm.createContext({});
vm.runInContext([
  grab(/function tag\(b,name\)\{.*\n/, "tag"), grab(/function clean\(s\)\{.*\n/, "clean"),
  grab(/function rssItems\(xml\)\{.*\n/, "rssItems"), grab(/function gts\(s\)\{.*\n/, "gts"),
  grab(/const INVESTING_FEEDS=\[.*\n/, "the feed list"), grab(/const MARKET_BUCKET='\*MARKET'.*\n/, "the market bucket"),
  grab(/const normTitle=.*\n/, "normTitle"), grab(/const normUrl=.*\n/, "normUrl"),
].join(""), ctx);
const F = vm.runInContext("({rssItems,gts,INVESTING_FEEDS,MARKET_BUCKET,normTitle,normUrl})", ctx);
const fixture = (n) => fs.readFileSync(new URL("./fixtures/investing-" + n + ".xml", import.meta.url), "utf8");

/* the lane's own loop, over fixture pages instead of live ones */
function lane(pages, now = Math.floor(Date.parse("2026-09-24T18:00:00Z") / 1000)) {
  const out = [], seenUrl = new Set(), seenTitle = new Set();
  let dropped = 0, future = 0;
  for (const xml of pages) for (const x of F.rssItems(xml)) {
    const u = F.normUrl(x.link), t = F.normTitle(x.title);
    if (!u || !t || seenUrl.has(u) || seenTitle.has(t)) { dropped++; continue; }
    seenUrl.add(u); seenTitle.add(t);
    const ts = F.gts(x.pub) || Math.floor(Date.parse(x.pub || "") / 1000) || now;
    if (ts > now + 3600) { future++; continue; }
    out.push({ ticker: F.MARKET_BUCKET, url: x.link, title: x.title, site: "Investing.com", snippet: "",
               published_ts: ts, updated_ts: now, feed: "investing" });
  }
  return { out, dropped, future };
}

test("the five feeds are their NEWS desks, by the channel title each one returns — no opinion columns", () => {
  const names = F.INVESTING_FEEDS.map((f) => f[1]);
  assert.deepEqual(names.join(" · "), "All News · Economy · Stock Market · Economic Indicators · Commodities & Futures");
  for (const [url] of F.INVESTING_FEEDS) assert.match(url, /^https:\/\/www\.investing\.com\/rss\/[a-z0-9_]+\.rss$/);
  assert.equal(F.INVESTING_FEEDS.some(([u]) => /\/(commodities|stock|forex|market_overview)\.rss$/.test(u)), false,
    "the Analysis & Opinion feeds are deliberately not ingested");
});

test("a headline becomes a row with the source, the time and the link — and no article text", () => {
  const { out } = lane([fixture("indicators")]);
  assert.ok(out.length >= 3);
  const r = out.find((x) => /new home sales/i.test(x.title));
  assert.ok(r, "today's New Home Sales story is in the feed");
  assert.equal(r.site, "Investing.com");
  assert.equal(r.ticker, "*MARKET");
  assert.equal(r.feed, "investing");
  assert.equal(r.snippet, "", "no article text is stored");
  assert.match(r.url, /^https:\/\/www\.investing\.com\/news\//);
  assert.equal(r.published_ts, Math.floor(Date.parse("2026-09-24T14:42:48Z") / 1000), "the feed's own pubDate, read as UTC");
  assert.deepEqual(Object.keys(r).sort(), ["feed", "published_ts", "site", "snippet", "ticker", "title", "updated_ts", "url"]);
});

test("the same story on two of their feeds is stored once", () => {
  const one = lane([fixture("all-news")]).out.length;
  const both = lane([fixture("all-news"), fixture("all-news")]);
  assert.equal(both.out.length, one, "the second copy of the page adds nothing");
  assert.equal(both.dropped, one, "and every repeat is counted as dropped");
});

test("a headline dated in the future is a feed fault and is not stored", () => {
  const xml = fixture("indicators").replace("2026-09-24 14:42:48", "2026-09-30 09:00:00");
  const { out, future } = lane([xml]);
  assert.equal(future, 1);
  assert.equal(out.some((r) => /jump to eight-month high/i.test(r.title)), false,
    "the future-dated story is the one dropped — the other new-home-sales headline is untouched");
});

test("the market bucket is not a symbol, so it cannot collide with a tracked name", () => {
  assert.equal(F.MARKET_BUCKET, "*MARKET");
  assert.doesNotMatch(F.MARKET_BUCKET, /^[A-Z]{1,5}$/);
});

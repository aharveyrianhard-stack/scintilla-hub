// NEWS-PUBLISHER (Hub news room + EVENTS headlines) - source-to-screen regression, offline.
// Google News is the aggregator. Google rows stored before news-feed v21 (and any later row whose RSS item had no
// <source>) carry site="Google News"; the publisher is only in Google's " - Publisher" headline tail. The page must
// show that publisher, strip it from the headline, keep the stored link untouched and still name the aggregator.
// Every row below is EXAMPLE data. The page's own esc/stripSrcTail/newsArtHTML/evHeadlineRowHTML run in a sandbox.
// SC_PAGE=<path to a copy of index.html> overrides the page under test.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(process.env.SC_PAGE || new URL("../index.html", import.meta.url), "utf8");
function cut(from, to) { const a = page.indexOf(from); const b = page.indexOf(to, a); assert.ok(a >= 0 && b > a, "anchor " + from); return page.slice(a, b); }
function fnSrc(sig) { const a = page.indexOf(sig); assert.ok(a >= 0, "anchor " + sig); return page.slice(a, page.indexOf("\n}\n", a) + 3); }
const SRC = cut("const esc = (s) =>", "const el = (id)") +
  cut("const srcNorm = (s) =>", "/* D2 FIX") + fnSrc("function stripNewsMarkup(") + fnSrc("function newsArtHTML(") + fnSrc("function evHeadlineRowHTML(") +
  "\nreturn { newsArtHTML, evHeadlineRowHTML };";
const { newsArtHTML, evHeadlineRowHTML } = new Function("newsTS", "senChip", SRC)(() => "", () => "");

const srcText = (html) => { const m = html.match(/<span class="rsrc"[^>]*>([^<]*)<\/span>/); return m ? m[1] : null; };
const srcTip = (html) => { const m = html.match(/<span class="rsrc"( title="([^"]*)")?>/); return m && m[2] ? m[2] : ""; };
const headline = (html) => { const m = html.match(/<div class="hl"><a href="([^"]*)"[^>]*>([^<]*)<\/a>/); return m ? { href: m[1], text: m[2] } : null; };
const G = (title, site = "Google News", url = "https://news.google.com/rss/articles/EXAMPLE-1") => ({ ticker: "T01", feed: "google", site, title, url, snippet: "", published_ts: 1789750000 });

test("pre-v21 google row: the publisher from Google's headline tail is the source, not the aggregator", () => {
  const html = newsArtHTML(G("T01 EXAMPLE results beat estimates - Reuters"));
  assert.equal(srcText(html), "Reuters");
  assert.equal(headline(html).text, "T01 EXAMPLE results beat estimates");
  assert.equal(srcTip(html), "via Google News", "aggregator still named");
});

test("the stored link is rendered unchanged", () => {
  const url = "https://news.google.com/rss/articles/CBMiEXAMPLE?oc=5&hl=en-US";
  const html = newsArtHTML(G("T01 EXAMPLE story - Barron's", "Google News", url));
  assert.equal(headline(html).href, url.replace(/&/g, "&amp;"));
  assert.equal(srcText(html), "Barron&#39;s");
});

test("a headline with its own ' - ' keeps it; only the last segment is the publisher; hyphenated names survive", () => {
  assert.equal(headline(newsArtHTML(G("T01 - what EXAMPLE guidance means - Pittsburgh Post-Gazette"))).text, "T01 - what EXAMPLE guidance means");
  assert.equal(srcText(newsArtHTML(G("T01 - what EXAMPLE guidance means - Pittsburgh Post-Gazette"))), "Pittsburgh Post-Gazette");
});

test("empty site on a google row reads the tail too; no readable tail keeps the honest aggregator label", () => {
  assert.equal(srcText(newsArtHTML(G("T01 EXAMPLE item - MarketBeat", ""))), "MarketBeat");
  const bare = newsArtHTML(G("T01 EXAMPLE headline with no publisher tail"));
  assert.equal(srcText(bare), "Google News");
  assert.equal(headline(bare).text, "T01 EXAMPLE headline with no publisher tail");
});

test("v21 google row (publisher already stored) renders as before, plus the aggregator tooltip", () => {
  const html = newsArtHTML(G("T01 EXAMPLE story - Reuters", "Reuters"));
  assert.equal(srcText(html), "Reuters");
  assert.equal(headline(html).text, "T01 EXAMPLE story");
  assert.equal(srcTip(html), "via Google News");
});

test("non-google rows are untouched: FMP site label and the existing R20 tail strip", () => {
  const fmp = { ticker: "T02", feed: "fmp", site: "zacks.com", title: "T02 EXAMPLE upgrade - Zacks", url: "https://example.com/T02/1", published_ts: 1789750000 };
  const html = newsArtHTML(fmp);
  assert.equal(srcText(html), "zacks.com");
  assert.equal(headline(html).text, "T02 EXAMPLE upgrade");
  assert.equal(srcTip(html), "", "no aggregator tooltip on a direct feed");
  const other = { ticker: "T03", feed: "fmp", site: "EXAMPLE Wire", title: "T03 EXAMPLE note - Some Other Desk", url: "https://example.com/T03/1" };
  assert.equal(headline(newsArtHTML(other)).text, "T03 EXAMPLE note - Some Other Desk", "a tail that is not the site is kept");
});

test("EVENTS headline rows use the same publisher reading", () => {
  const html = evHeadlineRowHTML(G("T01 EXAMPLE results beat estimates - Reuters"));
  assert.match(html, /<b>T01 EXAMPLE results beat estimates<\/b>/);
  assert.match(html, /<span class="src"[^>]*>· Reuters<\/span>/);
  assert.doesNotMatch(html, /Google News<\/span>/);
});

// The 25 Sep sentiment-feed proposal: the deliverable, its mockup and the house rules they must keep.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const DIR = new URL("../deliverables/20260925/sentiment-feed/", import.meta.url);
const read = (f) => readFileSync(new URL(f, DIR), "utf8");

test("the deliverable and the live mockup exist and carry the way back", () => {
  for (const f of ["SENTIMENT-FEED.html", "mockup-feed.html"]) {
    assert.ok(existsSync(new URL(f, DIR)), f + " missing");
    assert.match(read(f), /<!-- scnav ·/, f + " has no BACK / CLOSE pair");
  }
});

test("the mockup's colours are greys, none above 210, and only the direction pair is coloured", () => {
  const css = /<style>([\s\S]*?)<\/style>/.exec(read("mockup-feed.html"))[1];
  const hex = [...css.matchAll(/#([0-9a-f]{6})\b/gi)].map((m) => m[1].toLowerCase());
  const DIRECTION = new Set(["2fbf71", "e8384f"]);
  for (const h of new Set(hex)) {
    if (DIRECTION.has(h)) continue;
    const ch = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    assert.ok(Math.max(...ch) - Math.min(...ch) <= 24, "#" + h + " is not a grey (channels differ by more than 24)");
    assert.ok(Math.max(...ch) <= 210, "#" + h + " has a channel above 210");
  }
});

test("body text in the mockup is at least 11px and it is built on stored rows, not an AI read", () => {
  const html = read("mockup-feed.html");
  const body = /body\{[^}]*font:(\d+(?:\.\d+)?)px/.exec(html);
  assert.ok(body && +body[1] >= 11, "body font under 11px");
  assert.match(html, /news_headline_sentiment/);
  assert.match(html, /Nothing here is an AI read/);
  assert.match(html, /SINCE YESTERDAY/);
  assert.match(html, /THIN/i);
});

test("the deliverable names the three word lists, the schedule and the measured history", () => {
  const html = read("SENTIMENT-FEED.html");
  for (const s of ["lm-v1", "sc-social-v2", "yt-lexicon-v1", "every 10 minutes", "sentiment_ticker_daily", "not an AI read", "90 days"]) {
    assert.ok(html.includes(s), "deliverable does not mention " + s);
  }
});

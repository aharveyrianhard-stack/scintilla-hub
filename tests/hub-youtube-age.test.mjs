/* SCI-26 — the hub's Social / YouTube surface, and the age it prints.
   ===================================================================
   This repo had no test suite before this file; it is the first. It exists because
   the same video is shown to Alan on two screens — here, under SOCIAL › YOUTUBE, and
   in the Station's YouTube grid (scintilla-widgets, station-shells/*-video-v1) — and
   the two must never disagree about how old it is. The wording asserted below is the
   wording asserted there.

   What this surface used to print, and why each line changed:

     · three buckets, floored at "Nd ago" with no ceiling: a video from last spring
       said "217d ago" instead of "7mo ago".
     · Math.round: a 40-minute-old video said "1h ago" — an age it had not reached.
     · Math.max(0, ...): a publish time in the future was clamped to "1m ago", so a
       scheduled premiere announced itself as the newest thing in the feed.
     · new Date(iso) with only a falsy guard: Date.parse reads the string "0" as the
       year 2000, so a junk value became a confident 26-year-old video.

   The rule underneath all four: published_at is the only source of an age. The
   database also records when the sweep first SAW a row, and measured on the live
   table that trails publication by 4-15 minutes for ordinary uploads and by up to
   two days for livestreams. Substituting it would make late-caught videos look new.
   A row with no usable publish time gets no age at all.
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const SRC = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

function fnFrom(name, bindings = {}) {
  const start = SRC.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0, end = -1;
  for (let i = SRC.indexOf("{", start); i < SRC.length; i += 1) {
    if (SRC[i] === "{") depth += 1;
    if (SRC[i] === "}") depth -= 1;
    if (depth === 0) { end = i + 1; break; }
  }
  return vm.runInNewContext(`(${SRC.slice(start, end)})`, bindings);
}

/* Prose is not behaviour. The doctrine assertions read the code only. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, " ");
const ytAgo = () => fnFrom("ytAgo",
  { Date, isFinite, Math, YT_PUBLISHED_SHAPE:/^\d{4}-\d{2}-\d{2}[T ]/ });

const NOW = Date.parse("2026-09-22T18:00:00Z");
const ago = (seconds) => new Date(NOW - seconds * 1000).toISOString();
const MIN = 60, HOUR = 3600, DAY = 86400;

test("the wording, at every boundary — identical to the Station's grid", () => {
  const f = ytAgo();
  const at = (seconds) => f(ago(seconds), NOW);

  assert.equal(at(0), "just now");
  assert.equal(at(119), "just now");
  assert.equal(at(120), "2m ago", "no gap between 'just now' and the first number");
  assert.equal(at(14 * MIN), "14m ago");
  assert.equal(at(40 * MIN), "40m ago", "the rounding defect: this used to read '1h ago'");
  assert.equal(at(59 * MIN + 59), "59m ago");
  assert.equal(at(HOUR), "1h ago");
  assert.equal(at(2 * HOUR), "2h ago");
  assert.equal(at(9 * HOUR), "9h ago");
  assert.equal(at(DAY - 1), "23h ago");
  assert.equal(at(DAY), "yesterday");
  assert.equal(at(2 * DAY - 1), "yesterday");
  assert.equal(at(2 * DAY), "2d ago");
  assert.equal(at(3 * DAY), "3d ago");
  assert.equal(at(6 * DAY), "6d ago");
  assert.equal(at(7 * DAY), "1w ago");
  assert.equal(at(14 * DAY), "2w ago");
  assert.equal(at(217 * DAY), "7mo ago", "the uncapped-days defect: this used to read '217d ago'");

  for (const seconds of [0, 40 * MIN, 5 * HOUR, DAY, 5 * DAY, 20 * DAY, 400 * DAY])
    assert.equal(at(seconds), at(seconds).toLowerCase(), "lowercase everywhere");
});

test("an age is never invented", () => {
  const f = ytAgo();
  for (const empty of [null, undefined, ""]) assert.equal(f(empty, NOW), "");
  for (const bad of ["not a date", "NaN", "0", "-17", 0, -1, {}, [], true, false])
    assert.equal(f(bad, NOW), "", `${JSON.stringify(bad)} must not become an age`);
  /* The specific trap: Date.parse is generous, and a guess that lands is the worst
     outcome of all — it looks like knowledge. */
  assert.equal(new Date("0").getUTCFullYear(), 2000, "'0' really does parse, which is the point");
  assert.equal(f("0", NOW), "", "and it is still refused");
});

test("a publish time in the future is not an age", () => {
  const f = ytAgo();
  assert.equal(f(ago(-30), NOW), "just now", "half a minute of clock skew still reads as new");
  assert.equal(f(ago(-3 * DAY), NOW), "", "a premiere scheduled for Friday is not the newest video");
  assert.doesNotMatch(CODE, /Math\.max\(0, \(Date\.now\(\) - t\)/,
    "the clamp that turned the future into '1m ago' is gone");
});

test("the age sits on the channel line, and reads as a note rather than a label", () => {
  /* The card's meta row is one flex line, channel left and age right — which is the
     empty space Alan pointed at. It must stay that way. */
  assert.match(SRC, /\.sc-ytc__meta\{[^}]*justify-content:space-between/);
  assert.match(SRC, /esc\(r\.channel \|\| ""\) \+ ' · ' \+ esc\(ytProvenance\(r\)\) \+ '<\/span><span class="sc-ytage">' \+ esc\(ytAgo\(r\.published_at\)\)/,
    "channel first, age second, on one line");
  /* That row is uppercased by house style. The age opts out, so it stays quiet
     under the title instead of becoming a third label shouting at the reader. */
  assert.match(SRC, /\.sc-ytage\{[^}]*text-transform:none/);
  assert.match(SRC, /\.sc-ytage\{[^}]*tabular-nums/, "and does not twitch in width as it ticks over");
  assert.doesNotMatch(SRC, /\.sc-ytage\{[^}]*color:/, "it introduces no colour of its own — no white");
});

test("every place this surface prints an age uses the one function", () => {
  /* Card grid, RAW table and the player modal. Three renderers, one wording. */
  for (const marker of [
    /<span class="sc-ytage">' \+ esc\(ytAgo\(r\.published_at\)\)/,          // card
    /class="sc-ytraw__c ts sc-ytage">' \+ esc\(ytAgo\(r\.published_at\)\)/,  // raw table
    /<span class="ago sc-ytage">' \+ esc\(ytAgo\(r\.published_at\)\)/,       // player modal
  ]) assert.match(SRC, marker);
  const calls = SRC.match(/ytAgo\(/g) || [];
  assert.equal(calls.length, 4, "one definition and three call sites — no fourth wording anywhere");
});

test("length and age stay different numbers in different places", () => {
  /* r.duration is how long the video RUNS and lives in the thumbnail corner.
     Merging the two is how a reader decides a 13-minute video is 13 minutes old. */
  assert.match(SRC, /<span class="sc-ytc__dur">' \+ esc\(r\.duration\)/);
  assert.doesNotMatch(SRC, /sc-ytc__dur[^]{0,120}ytAgo/);
});

test("collection time is never substituted for publish time", () => {
  /* Scoped to this surface: the hub reads updated_ts elsewhere for unrelated
     tables, and that is fine. What must never happen is a collection time
     reaching a video age. */
  const reads = CODE.match(/youtube_feed\?select=[^"]*/g) || [];
  assert.equal(reads.length, 1, "one read of the video feed");
  assert.match(reads[0], /published_at/, "it asks for the publish time");
  assert.doesNotMatch(reads[0], /updated_ts/, "and never for the collection time");

  const ytRegion = CODE.slice(CODE.indexOf("function ytAgo("), CODE.indexOf("function renderYT("));
  assert.ok(ytRegion.length > 2000, "the YouTube region was located");
  assert.doesNotMatch(ytRegion, /updated_ts/, "no renderer here reads a collection time");
});

test("the label keeps up with the clock on the pass that already runs", () => {
  const f = ytAgo();
  const published = ago(2 * HOUR);
  assert.equal(f(published, NOW), "2h ago");
  assert.equal(f(published, NOW + 7 * HOUR * 1000), "9h ago", "the same row, later in the day");
  assert.equal(f(published, NOW + DAY * 1000), "yesterday");
  /* Nothing new was wired to achieve that. The tab's own two-minute poll re-pulls
     and re-renders while Social › YouTube is open, and renderYT recomputes every
     label from published_at on each pass. */
  assert.match(SRC, /window\.__ytPoll = setInterval\(function\(\)\{ if \(S\.sec === "SOCIAL" && S\.socTab === "YOUTUBE"/);
  assert.match(SRC, /\}, 120000\); \}/);
  assert.match(SRC, /function renderYT\(\)/);
  assert.equal((SRC.match(/__ytPoll/g) || []).length, 2, "still exactly one poll, declared once and set once");
});

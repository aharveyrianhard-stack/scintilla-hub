/* RM1 (7 Oct 2026) — what a left-open Hub holds on to.
   ============================================================================
   Alan, 7 Oct: "When I leave Scintilla open and the Station open, it takes a lot of RAM in Activity Monitor
   after a while. When I quit and come back, it's perfectly fine… especially on the iMac it's a problem."
   FOUND: the news chime and the feed-down alarm each opened a sound channel (an AudioContext) and never
   closed it. A browser does not take an open one back. MEASURED headless: 40 chimes left 40 contexts alive
   after a forced collection - about 1.2 threads and 1-2 MB each, 11% of one core between them while silent;
   closed as each note ended, all of it came back (deliverables/20261007/rm1-memory/data/audio-experiment.txt).
   ALSO FOUND: a live headline was pushed onto every news list ever opened and never taken off (a pull holds
   120; the table gains 5,800 to 8,700 a day), each arrival re-sorting the whole list.
   The 90-minute soaks, the laps of clicking and the heap comparisons are beside that file. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const s = page.search(/^function scAudioDone\b/m);
assert.ok(s >= 0, "scAudioDone is declared with `function` at column 0");
const scAudioDone = (timers) => new Function("setTimeout", page.slice(s, page.indexOf("\n}\n", s) + 3) + "return scAudioDone;")(timers);

/* a sound channel and a note that only count what is done to them */
const channel = () => { const ac = { state: "running", closes: 0, close() { ac.closes++; ac.state = "closed"; } }; return ac; };
const clock = () => { const due = []; const set = (fn, ms) => { due.push({ fn, ms }); return due.length; }; set.due = due; return set; };

test("the channel is closed when its last note ends", () => {
  const ac = channel(), note = {}, timers = clock();
  scAudioDone(timers)(ac, note, 1500);
  assert.equal(ac.closes, 0, "not while the note is still sounding");
  note.onended();
  assert.equal(ac.closes, 1);
  assert.equal(ac.state, "closed");
});

test("a note that never plays cannot hold the channel open: the timer closes it", () => {
  const ac = channel(), note = {}, timers = clock();
  ac.state = "suspended";                        /* a browser that has not been clicked yet holds sound back */
  scAudioDone(timers)(ac, note, 1500);
  assert.deepEqual(timers.due.map((d) => d.ms), [1500], "one timer, at the time asked for");
  timers.due[0].fn();
  assert.equal(ac.closes, 1, "closed without ever having played");
});

test("closed once: the note ending and the timer firing are the same goodbye", () => {
  const ac = channel(), note = {}, timers = clock();
  const close = scAudioDone(timers)(ac, note, 1500);
  note.onended(); timers.due[0].fn(); close(); note.onended();
  assert.equal(ac.closes, 1);
});

test("nothing it is handed can make it throw: the alarm must still raise its title and its log line", () => {
  const timers = clock();
  assert.doesNotThrow(() => { scAudioDone(timers)(null, null, 10); timers.due[0].fn(); }, "no channel at all");
  assert.doesNotThrow(() => { scAudioDone(timers)({ state: "running", close() { throw new Error("already gone"); } }, {}, 10); timers.due[1].fn(); }, "a close that fails");
  const gone = channel(); gone.state = "closed";
  scAudioDone(timers)(gone, {}, 10); timers.due[2].fn();
  assert.equal(gone.closes, 0, "a channel already closed is left alone");
  assert.doesNotThrow(() => scAudioDone(timers)(channel(), Object.freeze({}), 10), "a note that cannot take a handler: the timer still closes it");
});

test("every place the Hub opens a sound channel hands it to scAudioDone", () => {
  const opens = page.match(/new \(window\.AudioContext\|\|window\.webkitAudioContext\)\(\)/g) || [];
  assert.equal(opens.length, 2, "the news chime and the feed-down alarm (a third one must be closed too)");
  assert.equal((page.match(/\bnew (window\.)?(webkit)?AudioContext\(/g) || []).length, 0, "and no other spelling of it");
  const chime = page.slice(page.indexOf("function chime(){"), page.indexOf("function paintBadge(){"));
  assert.match(chime, /o\.start\(ac\.currentTime\); o\.stop\(ac\.currentTime\+0\.34\);\n\s+scAudioDone\(ac, o, 1500\);/, "the chime: its one note, then closed");
  assert.match(chime, /if\(now - lastChimeAt < 60000\) return;/, "its once-a-minute rule is as it was");
  const alarm = page.slice(page.indexOf("function scAlert(msg){"), page.indexOf("function scQuoteObservation"));
  assert.match(alarm, /o\.stop\(ac\.currentTime\+t\+0\.17\); last = o; \}\);\n\s+scAudioDone\(ac, last, 2500\);/, "the alarm: closed after the third beep");
  assert.match(alarm, /document\.title = "🔴 FEED DOWN · SCINTILLA"/, "and it still raises its title");
});

test("the alarm's three beeps are the same three beeps", () => {
  assert.match(page, /\[0,0\.2,0\.4\]\.forEach\(function\(t\)\{ var o=ac\.createOscillator\(\), g=ac\.createGain\(\); o\.type="square"; o\.frequency\.value=880;/);
});

/* ---- the news lists ----------------------------------------------------------------------- */
const p0 = page.search(/^function newsCachePush\b/m);
assert.ok(p0 >= 0, "newsCachePush is declared with `function` at column 0");
const newsCachePush = new Function(page.slice(p0, page.indexOf("\n}\n", p0) + 3) + "return newsCachePush;")();
const NEWS_LIMIT = Number(page.match(/^const NEWS_LIMIT = (\d+);/m)[1]);
/* the order the realtime handler uses, as the page writes it: newest first, undated last */
const tsDesc = new Function("return " + page.match(/const tsDesc = (\(a, b\) => \{[\s\S]*?\n    \});?/)[1].replace(/;$/, ""))();
const row = (ts, title = "h" + ts) => ({ ticker: "NVDA", title, published_ts: ts });

test("a list holds what a pull holds: the newest 120, however long the Hub stays open", () => {
  assert.equal(NEWS_LIMIT, 120, "the pull's own limit");
  const items = [];
  for (let ts = 1; ts <= 8726; ts++) newsCachePush(items, row(ts), tsDesc, NEWS_LIMIT);   /* a day of headlines, 6 Oct's count */
  assert.equal(items.length, NEWS_LIMIT, "it was 8,726 long before");
  assert.equal(items[0].published_ts, 8726, "newest first");
  assert.equal(items[NEWS_LIMIT - 1].published_ts, 8726 - NEWS_LIMIT + 1, "and exactly the newest 120, in order");
});

test("a headline that arrives late with an old date takes its own place, or none", () => {
  const items = [];
  for (let ts = 1000; ts < 1000 + NEWS_LIMIT; ts++) newsCachePush(items, row(ts), tsDesc, NEWS_LIMIT);
  newsCachePush(items, row(5, "hours late"), tsDesc, NEWS_LIMIT);
  assert.equal(items.length, NEWS_LIMIT); assert.ok(!items.some((n) => n.title === "hours late"), "older than everything shown: a pull would not have returned it either");
  newsCachePush(items, row(1050.5, "a little late"), tsDesc, NEWS_LIMIT);
  const at = items.findIndex((n) => n.title === "a little late");
  assert.ok(at > 0 && items[at - 1].published_ts > 1050.5 && items[at + 1].published_ts < 1050.5, "in its date order, never at the top (R22 FIX 7)");
});

test("undated headlines sort last and are the first to go", () => {
  const items = [];
  newsCachePush(items, row(null, "undated"), tsDesc, 3);
  for (const ts of [10, 20]) newsCachePush(items, row(ts), tsDesc, 3);
  assert.deepEqual(items.map((n) => n.published_ts), [20, 10, null]);
  newsCachePush(items, row(30), tsDesc, 3);
  assert.deepEqual(items.map((n) => n.published_ts), [30, 20, 10], "the undated one made room");
});

test("a short list is not touched: below the limit nothing is dropped", () => {
  const items = [row(3), row(1)];
  newsCachePush(items, row(2), tsDesc, NEWS_LIMIT);
  assert.deepEqual(items.map((n) => n.published_ts), [3, 2, 1]);
});

test("the realtime handler uses it for every cached list, and still repaints through renderNews", () => {
  assert.match(page, /for \(const \[key, ent\] of NEWS_CACHE\)[^\n]*\n\s+if \(newsItemInKey\(p\.new, key\)\) newsCachePush\(ent\.items, p\.new, tsDesc, NEWS_LIMIT\);/);
  assert.doesNotMatch(page, /ent\.items\.push\(p\.new\)/, "the bare push is gone");
  assert.match(page, /if \(el\("newsList"\) && S\.sec === "NEWS" && newsInScope\(p\.new\)\)\n\s+renderNews\(S\.coh\);/, "order stability (R22 FIX 7) is as it was");
});

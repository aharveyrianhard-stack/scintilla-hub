/* ST2 (6 Oct 2026) — TODAY'S SCINTILLAS as a moving tape, in short words.
   Alan: "there needs to be a tape of this… it needs to move… it's very wordy. I get the multiple… Doesn't need to be
   explained a bazillion times."
   The change is four insertions kept in deliverables/20261006/scintillas-tape/tools/st2-patch.mjs. While index.html does
   not carry them (this branch: preview only) the tests run the page WITH them applied and pin the preview copy to the
   byte; once the coordinator applies the diff, the same tests run on the page as it is. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { applyST2, previewOf, withoutScnav } from "../deliverables/20261006/scintillas-tape/tools/st2-patch.mjs";
const raw = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const applied = raw.includes("const SCINT_TAPE_ON = ");
const page = applied ? raw : applyST2(raw);

const LAYER = (() => {
  const a = page.indexOf("/* ── M42 SCINTILLAS — the glow becomes a signal");
  const b = page.indexOf("function scSetTitle (node, value) {", a);
  assert.ok(a > 0 && b > a, "the M42 layer is where the test expects it");
  return page.slice(a, b);
})();
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const TODAY = "2026-10-06", NOW = Date.parse("2026-10-06T15:40:00Z");
/* a host whose items are read back out of the HTML the page wrote into it */
function host() {
  const h = { _html: "", track: null,
    get innerHTML() { return h._html; },
    set innerHTML(v) { h._html = v; h.track = { style: {}, getAnimations: () => [{ currentTime: h.playedMs }] }; h.items = null; },
    playedMs: 0,
    querySelector: (q) => (/sc-tape__track/.test(q) && /sc-ss--tape/.test(h._html) ? h.track : null),
    querySelectorAll: (q) => {
      if (q !== ".sc-ss__it[data-kind]") return [];
      if (!h.items) h.items = [...h._html.matchAll(/<button class="sc-ss__it[^>]*data-kind="([^"]*)" data-sub="([^"]*)"[^>]*data-ts="([^"]*)"[^>]*>(.*?)<\/button>/g)]
        .map((m) => { const mv = { is: "mv", sub: m[2] }; return { dataset: { kind: m[1], sub: m[2], ts: m[3] }, querySelector: (s) => (s === ".sc-ss__mv" && /sc-ss__mv/.test(m[4]) ? mv : null) }; });
      return h.items;
    } };
  return h;
}
function world(rows, { tapeOn = true } = {}) {
  const glows = [], speeds = [], strip = host();
  const src = (tapeOn ? LAYER : LAYER.replace("const SCINT_TAPE_ON = true;", "const SCINT_TAPE_ON = false;")) +
    "\nreturn { scintStripHTML, scintStripRender, scintItemShort: typeof scintItemShort === 'function' ? scintItemShort : null," +
    " setRows: (r) => { SCINT_ROWS = r; SCINT_BY = null; }, rows: () => SCINT_ROWS, seen: SCINT_SEEN, cap: SCINT_GLOW_CAP };";
  const api = new Function("document", "ET_DAY", "ET_HM", "todayISO", "esc", "fmtC", "el", "scScint", "pg", "setInterval", "Date", "tapeSpeed", "COHSETS", src)(
    { visibilityState: "visible", querySelectorAll: () => [], addEventListener: () => {}, documentElement: {} },
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }),
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
    () => TODAY, esc, (v) => (v >= 0 ? "+" + Number(v).toFixed(2) + "%" : "(" + Math.abs(v).toFixed(2) + "%)"),
    (id) => (id === "scintStrip" ? strip : null),
    (n, tone) => glows.push({ node: n, tone }),
    async () => [], () => 1,
    class FakeDate extends Date { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } },
    (track) => { speeds.push(track); track.style.animationDuration = "80s"; },
    null);
  api.setRows(rows);
  return { api, glows, speeds, strip };
}
const ev = (o) => ({ ts: "2026-10-06T15:00:00Z", kind: "price_outlier", subject: "NBIS", subject_kind: "ticker", direction: 1, magnitude: 3.1,
  source: "chart-api:/candles", detail: { move_pct: 8.34, daily_vol_pct: 2.7, n_days: 60 }, ...o });
const words = (html) => [...html.matchAll(/<button class="sc-ss__it[^>]*>(.*?)<\/button>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, "?"));
const ROWS = [
  ev({ ts: "2026-10-06T15:30:00Z", subject: "ILMN", direction: -1, magnitude: 2.1, detail: { move_pct: -6.41, daily_vol_pct: 3.1, n_days: 60 } }),
  ev({ ts: "2026-10-06T15:00:00Z" }),
  ev({ ts: "2026-10-06T14:45:00Z", kind: "econ_imminent", subject: "Fed Bowman Speech", subject_kind: "release", direction: 0, magnitude: null,
       detail: { event_ts: "2026-10-06T14:45:00Z", minutes_to: 9, country: "US" } }),
  ev({ ts: "2026-10-06T14:00:00Z", kind: "econ_surprise", subject: "Ivey PMI", subject_kind: "release", direction: 1, magnitude: 2.2,
       detail: { actual: 56.1, estimate: 52, room_class: "dn", spread: 1.9, n_prints: 24, country: "CA", event_ts: "2026-10-06T14:00:00Z" } }),
  ev({ ts: "2026-10-06T13:35:00Z", kind: "earnings_surprise", subject: "PEP", direction: 1, magnitude: 2.4,
       detail: { measure: "eps", measures: [{ name: "eps", surprise_pct: 12.31, spread_pct: 5.1, n: 12 }] } }),
];

test("an item is the ticker, the move and the multiple of its usual day — nothing else", () => {
  const { api } = world(ROWS);
  const html = api.scintStripHTML();
  const w = words(html);
  assert.equal(w.length, ROWS.length * 2, "every one of today's is on the tape, and the loop carries the list twice so it never shows a gap");
  assert.deepEqual(w.slice(0, ROWS.length), ["ILMN −6.4% 2.1×", "NBIS +8.3% 3.1×", "Fed Bowman Speech 10:45 ET", "Ivey PMI 56.1 2.2×", "PEP EPS +12.3% 2.4×"],
    "newest first; one decimal; a release that has not printed has only its time");
  assert.deepEqual(w.slice(ROWS.length), w.slice(0, ROWS.length), "the second half is the first, for a seamless loop");
  for (const s of w) assert.doesNotMatch(s, /usual|outlier|sessions|at the flash|now /, "no sentence inside an item: " + s);
  assert.match(html, /class="sc-ss__it dn"[^>]*data-sub="ILMN"/, "a fall is the day's red");
  assert.match(html, /class="sc-ss__it up"[^>]*data-sub="NBIS"/, "a rise is the day's green");
});

test("the count stays and still opens the day; a click on an item goes to the thing itself", () => {
  const { api } = world(ROWS);
  const html = api.scintStripHTML();
  assert.match(html, /<span class="sc-ss__lbl">TODAY’S SCINTILLAS<\/span><button class="sc-ss__n sc-ss__n--go" data-act="scintlast" data-day="2026-10-06"[^>]*>5<\/button>/);
  assert.equal((html.match(/data-act="scintgo"/g) || []).length, ROWS.length * 2, "every item opens its company (or its release's day in ECONOMIC)");
  assert.doesNotMatch(html, /data-act="scintbell"|sc-ss__one|all 5 ›/, "the one sentence and its way into the bell are not drawn");
  assert.match(html, /data-kind="econ_surprise" data-sub="Ivey PMI" data-cty="CA" data-day="2026-10-06"/, "a release carries what scintgo needs");
  assert.match(page, /case "scintgo": \{[\s\S]{0,400}openCo\(sub\);/, "scintgo opens the company, as before");
});

test("'usual day' is explained once — the strip's hover — and an item's hover says only when", () => {
  const { api } = world(ROWS);
  const html = api.scintStripHTML();
  const strip = html.match(/^<div class="sc-ss sc-ss--one sc-ss--tape" title="([^"]*)">/);
  assert.ok(strip, "the strip keeps the one-line box (same height) and is marked as the tape");
  assert.match(strip[1], /usual day.{1,6} is the size of a typical daily move for that name/);
  assert.doesNotMatch(strip[1], /tap to open the notifications/, "the list is the tape now; the hover no longer sends him to the bell for it");
  const rest = html.slice(strip[0].length);
  assert.equal((rest.match(/usual day/gi) || []).length, 1, "after the strip's own hover, 'usual day' appears once more only: the count button's 'open USUAL DAY'");
  const tips = [...rest.matchAll(/<button class="sc-ss__it[^>]*title="([^"]*)"/g)].map((m) => m[1]);
  assert.equal(tips[0], "first spike 11:30 ET");
  assert.equal(tips[1], "first spike 11:00 ET");
  for (const t of tips) assert.ok(t.length <= 44 && !/usual/.test(t), "an item's hover is the time, not the lecture: " + t);
});

test("it moves like the Hub's other tapes, and hover pauses it", () => {
  const css = page.match(/\/\* ── ST2 \(6 Oct\) · THE STRIP IS A TAPE[\s\S]*?\n(?=\/\* 28 Sep — no session has run today)/)[0];
  assert.match(css, /\.sc-ss--tape \.sc-tape__track\{[^}]*animation-name:sc-tape-move;[^}]*linear;[^}]*infinite/, "the same keyframes as every band");
  assert.match(css, /\.sc-ss--tape:hover \.sc-tape__track\{ animation-play-state:paused; \}/);
  assert.match(css, /\.sc-ss__it\{[^}]*font-size:11px/, "body text is at least 11 px");
  const { api, speeds, strip } = world(ROWS);
  api.scintStripRender();
  assert.match(strip.innerHTML, /<div class="sc-tape__win"><span class="sc-tape__track">/);
  assert.equal(speeds.length, 1, "the speed is tapeSpeed's — the one 45 px/s law — and it is set when the tape is drawn");
  assert.match(page, /function tapeSpeed\(track, startAt\) \{\s*const PX_S = 45;/);
  api.scintStripRender(); api.scintStripRender();
  assert.equal(speeds.length, 1, "an unchanged tape is left running: no redraw, no restart");
});

test("a new scintilla flashes once as it enters; the rest never flash again; a repaint with the same items carries on", () => {
  const many = Array.from({ length: 28 }, (_, i) => ev({ subject: "T" + i, ts: new Date(Date.parse("2026-10-06T15:20:00Z") - i * 60000).toISOString() }));
  const { api, glows, speeds, strip } = world(many);
  api.scintStripRender();
  assert.equal(glows.length, api.cap * 2, "opening the page flashes the newest dozen (both copies in the loop), never all 28");
  glows.length = 0;
  api.scintStripRender(); api.scintStripRender();
  assert.equal(glows.length, 0, "the other sixteen are NOT flashed on the next ticks — a flash means new");
  const fresh = ev({ subject: "NEWONE", ts: "2026-10-06T15:39:00Z", direction: -1, detail: { move_pct: -9.2, daily_vol_pct: 3 } });
  api.setRows([fresh, ...many]);
  api.scintStripRender();
  assert.deepEqual(glows.map((g) => [g.node.sub, g.tone]), [["NEWONE", false], ["NEWONE", false]], "only the newcomer, in its own red, on the number");
  assert.equal(words(strip.innerHTML)[0], "NEWONE −9.2% 3.1×", "and it is first on the tape");
  assert.equal(strip.track.style.animationDelay, undefined, "new items: the tape starts over so the newcomer is the first thing in the window");
  assert.match(strip.innerHTML, /sc-ss__n--go[^>]*>29<\/button>/, "the count went up with it");
  glows.length = 0;
  api.scintStripRender();
  assert.equal(glows.length, 0, "once");
  /* same items, different HTML (the spark turns over on the hour, the cohort chip arrives, a stored number is revised):
     the tape carries on from where it was */
  strip.playedMs = 30000;
  api.setRows([fresh, { ...many[0], magnitude: 3.3 }, ...many.slice(1)]);
  const n = speeds.length;
  api.scintStripRender();
  assert.equal(speeds.length, n + 1);
  assert.equal(strip.track.style.animationDelay, "-30s", "it resumes 30 s into its loop, where it was");
  assert.equal(glows.length, 0);
});

test("everything that is not 'rows today' is exactly as it was, and one switch puts the sentence back", () => {
  const off = world(ROWS, { tapeOn: false });
  const html = off.api.scintStripHTML();
  assert.equal((html.match(/class="sc-ss__one/g) || []).length, 1);
  assert.match(html, /data-act="scintbell"/);
  assert.doesNotMatch(html, /sc-ss--tape/);
  const empty = world([]);
  assert.doesNotMatch(empty.api.scintStripHTML(), /sc-ss--tape/, "an empty or closed day keeps its one line");
});

test("this branch does not change index.html: the preview copy is the page plus the four insertions, to the byte", { skip: applied && "the diff has been applied to index.html" }, () => {
  const preview = fs.readFileSync(new URL("../deliverables/20261006/scintillas-tape/preview/index.html", import.meta.url), "utf8");
  assert.match(preview, /<!-- scnav ·/, "like every page under deliverables/, the copy carries the BACK / CLOSE pair");
  assert.equal(withoutScnav(preview), previewOf(raw), "and apart from that pair it is the page plus ST2, nothing else");
  assert.doesNotMatch(raw, /sc-ss--tape|scintTapeHTML/);
  const added = page.length - raw.length, diff = fs.readFileSync(new URL("../deliverables/20261006/scintillas-tape/ST2-index.diff", import.meta.url), "utf8");
  assert.equal((diff.match(/^-(?!--)/gm) || []).length, 0, "the diff only adds lines; nothing of the page is removed or rewritten");
  assert.equal(diff.split("\n").filter((l) => /^\+(?!\+\+)/.test(l)).map((l) => l.slice(1) + "\n").join("").length, added, "and it adds exactly what the preview carries");
});

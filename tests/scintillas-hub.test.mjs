/* M42 — the stored scintilla ON SCREEN. What is pinned here is what Alan asked for and what must not
   regress: the Economic room glows the row the dashboard pointed at, each event glows once per
   surface, the glow wears the room's own colour, a faded one still says it was a scintilla, the
   strip lists today's newest first, and a missing store changes nothing but the strip's own note. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

/* the whole M42 layer, lifted from the page and run as written */
const LAYER = (() => {
  const a = page.indexOf("/* ── M42 SCINTILLAS — the glow becomes a signal");
  const b = page.indexOf("function scSetTitle (node, value) {", a);
  assert.ok(a > 0 && b > a, "the M42 layer is where the test expects it");
  return page.slice(a, b);
})();

function node(opts = {}) {
  const n = {
    textContent: opts.text || "", dataset: opts.dataset || {}, kids: opts.kids || {},
    anims: [], classes: new Set(), attrs: {}, _html: "",
    animate: (frames, opt) => { const rec = { frames, opt, cancel() {} }; n.anims.push(rec); return rec; },
    classList: { add: (c) => n.classes.add(c), remove: (...c) => c.forEach((x) => n.classes.delete(x)),
                 contains: (c) => n.classes.has(c), toggle: (c, on) => (on ? n.classes.add(c) : n.classes.delete(c)) },
    getAttribute: (k) => (k in n.attrs ? n.attrs[k] : null),
    setAttribute: (k, v) => { n.attrs[k] = String(v); },
    querySelector: (q) => n.kids[q] || null,
    querySelectorAll: (q) => n.all || [],
    get innerHTML() { return n._html; },
    set innerHTML(v) { n._html = v; },
    get offsetWidth() { return 1; },
  };
  return n;
}
/* one small world: a document whose querySelectorAll answers per selector, and an el() by id */
function world({ rows = null, today = "2026-09-23", now = Date.parse("2026-09-23T20:30:00Z"),
                 sel = {}, ids = {}, pg = async () => [], missing = false, cohsets = null } = {}) {
  const glows = [];
  const doc = {
    visibilityState: "visible",
    querySelectorAll: (q) => sel[q] || [],
    addEventListener: () => {},
    documentElement: {},
  };
  /* scSetTitle is the page's own, lifted verbatim: the hover text is part of what is being proved */
  const setTitleSrc = page.match(/function scSetTitle \(node, value\) \{[\s\S]*?\n\}/)[0];
  const src = "const COHSETS = arguments[11] || null;\n" + LAYER + setTitleSrc + "\nreturn { scintKey, scintToday, scintIndex, scintBy, scintTone, scintGlow, scintWhat, scintSays," +
    " scintClass, scintCrit, scintSpark, scintSessions, scintCohorts, scintStripHTML, scintStripRender, ecScintPass," +
    " scintNotifyItems, scintUsualNote, identScintPass," +
    " ernScintPass, boardScintPass, scintPull, scintTick, scintPaint," +
    " state: () => ({ missing: SCINT_MISSING, fail: SCINT_FAIL_AT, rows: SCINT_ROWS, cap: SCINT_GLOW_CAP })," +
    " setRows: (r) => { SCINT_ROWS = r; SCINT_BY = null; }, setMissing: (m) => { SCINT_MISSING = m; }," +
    " setFail: (f) => { SCINT_FAIL_AT = f; }, seen: SCINT_SEEN };";
  const api = new Function("document", "ET_DAY", "ET_HM", "todayISO", "esc", "fmtC", "el", "scScint",
    "pg", "setInterval", "Date", src)(
    doc,
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }),
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
    () => today,
    (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    (v) => (v >= 0 ? "+" : "") + Number(v).toFixed(2) + "%",
    (id) => ids[id] || null,
    (n, tone) => glows.push({ node: n, tone }),
    pg, () => 1,
    class FakeDate extends Date { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return now; } },
    cohsets,
  );
  if (rows) api.setRows(rows);
  if (missing) api.setMissing(true);
  return { api, glows, doc };
}
const ev = (o) => ({ ts: "2026-09-23T20:04:00Z", kind: "price_outlier", subject: "AAPL", subject_kind: "ticker",
  direction: 1, magnitude: 2.6, source: "chart-api:/candles",
  detail: { move_pct: 3.2, daily_vol_pct: 1.2, n_days: 40 }, ...o });

test("the glow wears the room's own colour, and nothing that has not printed implies a direction", () => {
  const { api } = world();
  assert.equal(api.scintTone(ev({ direction: 1 })), true, "a rise glows bull");
  assert.equal(api.scintTone(ev({ direction: -1 })), false, "a fall glows bear");
  assert.equal(api.scintTone(ev({ kind: "econ_surprise", detail: { room_class: "up" } })), "hot",
    "an adverse print glows the room's own --sv5");
  assert.equal(api.scintTone(ev({ kind: "econ_surprise", detail: { room_class: "dn" } })), "cool");
  assert.equal(api.scintTone(ev({ kind: "econ_surprise", detail: { room_class: "flat" } })), "soon");
  assert.equal(api.scintTone(ev({ kind: "econ_imminent", direction: 0 })), "soon",
    "a release that has not printed has no direction to show");
  /* the neutral tone is a grey inside the estate's law: channels equal, and under 210 */
  const neu = page.match(/: \["(#[0-9A-Fa-f]{6})", "rgba\(200,200,200,\.55\)"\]/);
  assert.ok(neu, "scScint resolves a literal grey for the neutral tone");
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(neu[1].slice(i, i + 2), 16));
  assert.equal(Math.max(r, g, b) - Math.min(r, g, b), 0, "a grey: all three channels equal");
  assert.ok(Math.max(r, g, b) <= 210, "and never brighter than 210");
});

test("one event glows ONCE on a surface, and independently on each surface", () => {
  const { api, glows } = world({ rows: [ev()] });
  const cell = node();
  const e = ev();
  assert.equal(api.scintGlow("econ", e, cell), true, "first sight glows");
  assert.equal(api.scintGlow("econ", e, cell), false, "a re-render does not re-flash what was seen");
  assert.equal(api.scintGlow("board", e, cell), true, "the board has not shown this one yet");
  assert.equal(api.scintGlow("strip", e, cell), true);
  assert.equal(glows.length, 3);
  const later = ev({ ts: "2026-09-23T20:40:00Z", magnitude: 3.4 });
  assert.equal(api.scintGlow("econ", later, cell), true, "a newer reading of the same subject is a new scintilla");
});

test("the Economic room glows the row the dashboard pointed at — the actual complaint", () => {
  const cpiRow = node({ dataset: { esub: "Core CPI", ecty: "US" }, kids: { ".nm": node({ text: "Core CPI" }) } });
  const ukRow = node({ dataset: { esub: "Core CPI", ecty: "UK" }, kids: { ".nm": node() } });
  const other = node({ dataset: { esub: "Existing Home Sales", ecty: "US" }, kids: { ".nm": node() } });
  const imminent = ev({ kind: "econ_imminent", subject: "Core CPI", direction: 0, magnitude: null,
    detail: { country: "US", minutes_to: 10, impact: "High", estimate: 3 }, source: "econ_calendar" });
  /* the same pass covers the MONTH grid's chips — Alan's saved Economic view is MONTH */
  const monthChip = node({ dataset: { esub: "Core CPI", ecty: "US" }, kids: { ".nm": node({ text: "CPI" }) } });
  const { api, glows } = world({ rows: [imminent],
    sel: { ".ec-row[data-esub], .ec-ev[data-esub]": [cpiRow, ukRow, other, monthChip] } });
  assert.equal(api.ecScintPass(), 1, "the US row glows once; the UK row of the same name does not");
  assert.ok(monthChip.classes.has("is-scint"), "and the month chip for the same release is marked too");
  assert.equal(glows[0].node, cpiRow.kids[".nm"], "the release's own name is what glows");
  assert.equal(glows[0].tone, "soon");
  assert.ok(cpiRow.classes.has("is-scint"), "and it keeps saying it was a scintilla after the glow fades");
  assert.ok(!ukRow.classes.has("is-scint") && !other.classes.has("is-scint"));
  assert.equal(api.ecScintPass(), 0, "the room re-reads every ten minutes and must not re-flash");
});

test("once the number lands, the printed surprise supersedes 'about to print'", () => {
  const row = node({ dataset: { esub: "Core CPI", ecty: "US" }, kids: { ".nm": node() } });
  const rows = [
    ev({ kind: "econ_surprise", subject: "Core CPI", direction: 1, magnitude: 7.8, ts: "2026-09-23T12:30:05Z",
         detail: { country: "US", room_class: "up", reading: "adverse", actual: 3.9, estimate: 3 } }),
    ev({ kind: "econ_imminent", subject: "Core CPI", direction: 0, magnitude: null, ts: "2026-09-23T12:20:00Z",
         detail: { country: "US", minutes_to: 10 } }),
  ];
  const { api, glows } = world({ rows, sel: { ".ec-row[data-esub], .ec-ev[data-esub]": [row] } });
  assert.equal(api.ecScintPass(), 1);
  assert.equal(glows[0].tone, "hot", "a hotter-than-expected inflation print glows the room's red");
});

test("the earnings tape and the timeline glow from the same stored surprise", () => {
  const tapeIt = node({ dataset: { t: "COST" }, kids: { ".ern-sur": node({ text: "+30%" }) } });
  const tapeCopy = node({ dataset: { t: "COST" }, kids: { ".ern-res": node() } });   // the marquee repeats its segment
  const timeline = node({ dataset: { t: "COST" }, kids: { ".ern-tk": node() } });
  const other = node({ dataset: { t: "NKE" }, kids: { ".ern-tk": node() } });
  const surprise = ev({ kind: "earnings_surprise", subject: "COST", direction: 1, magnitude: 3.1, source: "earnings_events",
    detail: { measure: "eps", measures: [{ name: "eps", surprise_pct: 30, z: 3.1, usual_pct: 1.2 }], beat: true } });
  const { api, glows } = world({ rows: [surprise],
    sel: { ".ern-it[data-t], .sc-evrow[data-t]": [tapeIt, tapeCopy, timeline, other] } });
  assert.equal(api.ernScintPass(), 1, "one glow for the event, not one per copy of the marquee");
  assert.equal(glows[0].node, tapeIt.kids[".ern-sur"], "the surprise itself is what glows");
  assert.ok(tapeIt.classes.has("is-scint") && tapeCopy.classes.has("is-scint") && timeline.classes.has("is-scint"),
    "every copy and the timeline carry the mark");
  assert.ok(!other.classes.has("is-scint"));
});

test("the board marks the outliers of the day on the percentage cell that IS the outlier", () => {
  const lc = node({ text: "+3.20%" });
  const { api, glows } = world({ rows: [ev()], ids: { lc_AAPL: lc } });
  assert.equal(api.boardScintPass(), 1);
  assert.equal(glows[0].node, lc);
  assert.equal(glows[0].tone, true);
  assert.ok(lc.classes.has("is-scint"));
  assert.match(lc.attrs.title, /outlier of the day · \+3\.20% · 2\.6× its usual day \(usual: ±1\.2% a day, measured over its last 40 sessions\)/,
    "hovering says what made it one, in plain words");
  assert.equal(api.boardScintPass(), 0, "a board repaint keeps the mark and does not re-flash");
});

test("M55 — today's strip is ONE line: the count, the newest said plainly, and the way into the notifications", () => {
  /* Alan, 24 Sep: "look at how many rows it takes … this would be too many tapes … What about a
     notifications channel, internal notifications?" So the dashboard keeps one line and the LIST
     moved to the bell. What each event knows — where it lives, which day, which country — did not
     move: it travels with the notification row instead of the strip row. */
  const host = node();
  const rows = [
    ev({ ts: "2026-09-23T20:04:00Z" }),
    ev({ ts: "2026-09-23T13:30:05Z", kind: "econ_surprise", subject: "Core CPI", subject_kind: "event", magnitude: 7.8,
         detail: { country: "US", room_class: "up", reading: "adverse", actual: 3.9, estimate: 3, event_ts: "2026-09-23T12:30:00Z" } }),
    ev({ ts: "2026-09-22T18:00:00Z", subject: "OLD" }),                        // yesterday
  ];
  const { api } = world({ rows, ids: { scintStrip: host } });
  const html = api.scintStripHTML();
  assert.match(html, /TODAY’S SCINTILLAS/);
  assert.match(html, />2</, "two events today, not the third from yesterday");
  assert.ok(!html.includes(">OLD<"), "yesterday is not today");
  assert.equal((html.match(/class="sc-ss__one/g) || []).length, 1, "ONE line, not one per event");
  assert.match(html, /data-act="scintbell"/, "the line opens the notifications, where the rest are");
  assert.match(html, /outlier of the day/);
  assert.ok(html.includes("AAPL") && !html.includes("Core CPI"), "the line is the NEWEST one");
  assert.match(html, /all 2 ›/, "and it says how many are behind it");

  /* every event still knows where to go — now as a notification */
  const items = api.scintNotifyItems(api.scintToday());
  assert.equal(items.length, 2);
  assert.equal(items[0].sub, "AAPL");
  assert.equal(items[0].isco, true, "a price outlier opens the company");
  assert.equal(items[1].kind, "econ_surprise");
  assert.equal(items[1].isco, false, "a release opens the ECONOMIC room, not a company");
  assert.equal(items[1].day, "2026-09-23", "on the day the release belongs to");
  assert.equal(items[1].cty, "US");
  assert.ok(items[1].says.includes("actual 3.9"), "said in the room's own words: " + items[1].says);
  const plain = (html + JSON.stringify(items)).replace(/<[^>]*>/g, " ");
  assert.ok(!/undefined|NaN|null/.test(plain), "no half-formed number reaches the screen: " + plain.slice(0, 200));
});

test("every shape of the Economic room glows — the month grid returns early and still does", () => {
  /* the bug this pins: renderEconTable RETURNS inside the MONTH branch, which is the view Alan's
     saved state opens, so a pass called only at the end of the function never ran there. */
  const fn = (() => { const a = page.indexOf("function renderEconTable() {");
    return page.slice(a, page.indexOf("\n}\n", a)); })();
  const month = fn.slice(fn.indexOf('if ((S.econSpan || "DAY") === "MONTH") {'));
  const monthBranch = month.slice(0, month.indexOf("\n  }"));
  assert.match(monthBranch, /ecScintPass\(\)/, "the month branch glows before it returns");
  assert.match(fn.slice(fn.lastIndexOf("ecReadNote()")), /ecScintPass\(\)/, "and so does the day/week table");
  assert.match(fn, /ecMonthHTML\(rows\)/);
});

test("the strip says what it does not know, and a missing store changes nothing else", () => {
  const host = node();
  const quiet = world({ rows: [], ids: { scintStrip: host } });
  assert.match(quiet.api.scintStripHTML(), /nothing has moved further than its own history today/);

  const gone = world({ missing: true, ids: { scintStrip: host } });
  assert.match(gone.api.scintStripHTML(), /the store is not there yet — the migration has not been applied/);
  assert.equal(gone.api.ecScintPass(), 0, "and no surface glows on nothing");

  const unread = world({ ids: { scintStrip: host } });
  unread.api.setFail(Date.parse("2026-09-23T20:29:00Z"));
  assert.match(unread.api.scintStripHTML(), /could not be read — showing nothing rather than something stale/);

  const boot = world({ ids: { scintStrip: host } });
  assert.equal(boot.api.scintStripHTML(), "", "before the first read there is no strip at all, not an empty box");
});

test("a store that is not there yet is asked once, not three times a minute", async () => {
  const asked = [];
  const { api } = world({ pg: async (path, tries) => { asked.push([path, tries]); throw new Error("pg " + path + " → 404"); } });
  await api.scintPull();
  assert.equal(asked.length, 1, "one request");
  assert.equal(asked[0][1], 1, "and one try inside it — pg's three retries are for a busy database, not a missing table");
  assert.equal(api.state().missing, true);
  api.scintTick();
  assert.equal(asked.length, 1, "the tick does not keep asking");
});

test("a hidden tab reads nothing and paints nothing", () => {
  const asked = [];
  const { api, doc } = world({ pg: async (p) => { asked.push(p); return []; } });
  doc.visibilityState = "hidden";
  api.scintTick();
  assert.equal(asked.length, 0);
});

test("the criticality reading also says WHICH cohort is doing the scintillating", () => {
  const rows = [ev({ subject: "AMD", magnitude: 2.7 }), ev({ subject: "MU", magnitude: 2.1 }),
                ev({ subject: "COST", magnitude: 3.0, kind: "earnings_surprise" }),
                ev({ subject: "Core CPI", subject_kind: "event", kind: "econ_surprise", magnitude: 9 })];
  const cohsets = { AI_HARDWARE: new Set(["AMD", "MU"]), MEGACAP: new Set(["AMD"]), FOOD: new Set(["COST"]) };
  const { api } = world({ rows, cohsets });
  const out = api.scintCohorts(rows);
  assert.deepEqual(out, [{ cohort: "AI_HARDWARE", count: 2, intensity: 4.8 },
                         { cohort: "FOOD", count: 1, intensity: 3 },
                         { cohort: "MEGACAP", count: 1, intensity: 2.7 }],
    "ranked by intensity; a release is not a cohort member and the 9× print does not distort any of them");
  assert.equal(api.scintCohorts([]).length, 0);
  const noMap = world({ rows });
  assert.deepEqual(noMap.api.scintCohorts(rows), [], "with no cohort map loaded it says nothing rather than guessing");
  const html = world({ rows, cohsets, ids: { scintStrip: node() } }).api.scintStripHTML();
  assert.match(html, /class="sc-ss__coh" title="AI_HARDWARE 2 · 4.8× usual, added up · FOOD 1 · 3× usual, added up · MEGACAP 1 · 2.7× usual, added up · a name counts in every cohort it belongs to">AI_HARDWARE 2</);
});

test("the criticality reading counts and weighs, and its line carries direction", () => {
  const { api } = world();
  const nowMs = Date.parse("2026-09-23T20:30:00Z");
  const rows = [
    { ts: "2026-09-23T20:05:00Z", direction: 1, magnitude: 2.5 },
    { ts: "2026-09-23T20:20:00Z", direction: 1, magnitude: 3.5 },
    { ts: "2026-09-23T19:10:00Z", direction: -1, magnitude: 4 },
    { ts: "2026-09-23T19:40:00Z", direction: 0, magnitude: null },   // an imminent release: counted, no z
  ];
  const b = api.scintCrit(rows, nowMs, 3);
  assert.equal(b.length, 3);
  assert.equal(b[2].count, 2, "the current hour holds two");
  assert.equal(b[2].intensity, 6, "intensity is the sum of |z| — one big event is not five small ones");
  assert.ok(b[2].net > 0, "and the hour reads up");
  assert.equal(b[1].count, 2);
  assert.equal(b[1].intensity, 4, "an event with no z adds to the count and not to the intensity");
  assert.ok(b[1].net < 0, "that hour reads down");
  const svg = api.scintSpark(b);
  assert.match(svg, /stroke="var\(--bear\)"/, "a down hour draws in the bear colour");
  assert.match(svg, /stroke="var\(--bull\)"/, "an up hour in the bull colour");
  assert.ok(!/stroke="(#9|var\(--dim\)|var\(--mute\)|grey|gray)/.test(svg), "no grey chart lines");
  assert.match(svg, /aria-label="criticality: scintillas per hour, 3 hours"/);
});

test("nothing that already scintillated was touched, and the strip cannot move the page", () => {
  /* the four live paths Alan already likes, still through the one primitive */
  for (const re of [/scScintSet\(lp, price\.toFixed\(2\)/, /scScintSet\(lc, cc != null \? fmtC\(cc\) : "—"/,
                    /if \(htTxt && hc != null\) scScintSet\(htTxt, fmtC\(hc\)/, /scScintSet\(px, fmtPxIdent\(price\)/,
                    /scScintSet\(pxEl, fmtTapePx\(it\.price\)/])
    assert.match(page, re, "a surface that scintillated before must still do it");
  assert.match(page, /const ECON_TAPE_ON = true;/);
  assert.match(page, /const ECON_BAND_ON = true;/);
  /* the strip is a fixed-height element that scrolls inside itself, and is hidden when empty */
  assert.match(page, /\.sc-scintstrip:empty\{ display:none; \}/);
  assert.match(page, /\.ec-ev\.is-scint \.nm/, "the month grid carries the mark as well as the table");
  assert.match(page, /\.sc-ss__rows\{ max-height:66px; overflow:auto;/);
  /* the marks are colour only — no border, size, background or position in any is-scint rule */
  const marks = page.match(/^\.ec-row\.is-scint .*$|^\.ec-row\.is-scint\.res-[a-z]+ .*$/gm) || [];
  assert.ok(marks.length >= 3);
  for (const m of marks) assert.match(m, /^[^{]*\{ text-shadow:[^;}]*;? \}$/, "a mark is a text shadow and nothing else: " + m);
  /* body text in the strip is at least 11px */
  for (const cls of ["sc-ss__d", "sc-ss__w", "sc-ss__t", "sc-ss__k", "sc-ss__note", "sc-ss__empty"]) {
    const rule = page.match(new RegExp("\\." + cls + "\\{[^}]*\\}"));
    assert.ok(rule, cls);
    const size = rule[0].match(/font-size:(\d+(?:\.\d+)?)px/);
    assert.ok(size && parseFloat(size[1]) >= 11, cls + " is at least 11px: " + rule[0]);
  }
});

/* ── M48 — PLAIN WORDS, NOT σ ──────────────────────────────────────────────────────────────────
   Alan, 24 Sep, seeing "3.4σ" on the strip: "How unusual? What's that Greek letter there? What
   does that exactly mean, and what's that standard measure? Because I don't think we're using
   that." The maths did not change. The screen did. */
const bynd = (extra = {}) => ev({
  subject: "BYND", kind: "price_outlier", magnitude: 2.384, direction: -1,
  detail: { move_pct: -12.16, daily_vol_pct: 5.1, n_days: 60, asset_class: "equity",
            fired: ["statistical", "raw"], thresholds: { raw_move_pct: 8 }, rules_version: "2026-09-24.1", ...extra },
});

test("a row says how unusual in words, with the usual day spelled out", () => {
  const { api } = world({ rows: [bynd()] });
  const html = api.scintStripHTML();
  assert.ok(html.includes("2.4× its usual day (usual: ±5.1% a day, measured over its last 60 sessions)"),
    "the sentence Alan asked for, verbatim: " + html.slice(html.indexOf("sc-ss__d"), html.indexOf("sc-ss__d") + 180));
  assert.ok(!/σ/.test(html), "no Greek letter reaches the screen");
});

test("M55 — 'usual day' is still explained ONCE, in words, where the list now lives", () => {
  /* M48's rule has not changed: the letter is written once, in brackets, for the record, and the
     odds are spelled out. Only the PLACE changed — one line has no room for a paragraph, so the
     sentence travels on the line itself and heads the notifications list. */
  const { api } = world({ rows: [bynd()] });
  const html = api.scintStripHTML();
  const note = api.scintUsualNote();
  assert.equal((note.match(/standard deviation/g) || []).length, 1, "written once, for the record");
  assert.ok(note.includes("1 day in 20") && note.includes("1 day in 370"), "the two everyday frequencies");
  assert.ok(note.includes("An ordinary day is about 1×"));
  assert.ok(note.includes("no probability is claimed yet"), "and the criticality line stays honest");
  assert.equal((html.match(/standard deviation/g) || []).length, 1, "carried on the line, once");
  assert.ok(!html.includes("sc-ss__exp"), "the paragraph under the board is gone");
  const empty = world({ rows: [] }).api.scintStripHTML();
  assert.match(empty, /standard deviation/, "a quiet day still explains the measure");
  /* and the panel prints it: the renderer asks the page for this exact sentence */
  const alerts = page.slice(page.indexOf("function renderList(){"), page.indexOf("function alertKey("));
  assert.ok(/scintUsualNote/.test(alerts) && /sc-alerts__note/.test(alerts),
    "the notifications list heads itself with the same sentence");
});

test("which rule fired is said beside the row, in the rules file's own numbers", () => {
  const both = world({ rows: [bynd()] }).api.scintStripHTML();
  assert.ok(both.includes("big move, and far beyond its usual day"), both.slice(0, 200));
  const rawOnly = world({ rows: [bynd({ fired: ["raw"] })] }).api.scintStripHTML();
  assert.ok(rawOnly.includes("a big move on its own (over the 8% floor for equity)"));
  const older = world({ rows: [ev({ detail: { move_pct: 3.2, daily_vol_pct: 1.2, n_days: 40 } })] }).api.scintStripHTML();
  assert.ok(!older.includes("floor for"), "a row stored before the rules file claims nothing about which rule it was");
});

test("an earnings surprise and an economic print are said the same way", () => {
  const ern = ev({ kind: "earnings_surprise", subject: "MU", magnitude: 3.1,
    detail: { measure: "eps", measures: [{ name: "eps", surprise_pct: 12.4, spread_pct: 4.0, n: 8 }] } });
  const html = world({ rows: [ern] }).api.scintStripHTML();
  assert.ok(html.includes("3.1× its usual surprise (usual: ±4.0% over its last 8 reports)"), html.slice(0, 400));
  const econ = ev({ kind: "econ_surprise", subject: "Core CPI", subject_kind: "event", magnitude: 2.1,
    detail: { actual: 3.4, estimate: 3.1, reading: "adverse", spread: 0.14, n_prints: 12, room_class: "up" } });
  const h2 = world({ rows: [econ] }).api.scintStripHTML();
  assert.ok(h2.includes("2.1× this release's usual miss (usual miss: ±0.14 over its last 12 prints)"), h2.slice(0, 400));
});

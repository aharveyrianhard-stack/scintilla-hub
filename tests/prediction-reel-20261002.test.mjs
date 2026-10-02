/* P1 (2 Oct 2026) — THE PREDICTION MARKETS REEL and the REGIME card re-pointed.
   Alan, 2 Oct (pasted): "Polymarket status / topics / news reel". The brief: a PREDICTION MARKETS → band in the
   EARNINGS → frame, one chip per registry topic (short name ≤ 18 characters, the probability as a whole percent, the
   change since yesterday's 16:00 ET close in points — up green, down red, never grey — a flash when today's move is
   bigger than that market's usual day, "N× its usual day" in the hover, never a sigma), biggest move first then by
   probability, a status chip from prediction_market_runs that is red past 45 minutes or with a problem, a chip that
   opens the topic in the right-side pane, and the REGIME view reading prediction_market_latest instead of catalyst_odds.
   Everything below runs on the page's own functions, pulled out of index.html, over fixtures — no network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const grab = (re) => { const m = src.match(re); assert.ok(m, "not found in index.html: " + re); return m[0]; };
const registry = JSON.parse(fs.readFileSync(new URL("../supabase/functions/prediction-markets/topics.json", import.meta.url), "utf8"));

const shared =
  grab(/const esc = \(s\) => String[\s\S]*?&#39;"\);/) + "\n" +
  grab(/const PM_ON = true;[\s\S]*?const PM_LINK = "[^"]*";\n/) +
  grab(/const PM_SHORT = \{[\s\S]*?\};\n/) +
  'var PM = { latest: null, run: null, hist: null, open: null, panelHist: null, panelFor: null, reg: null, slugs: {} };\n' +
  grab(/function pmShort\(id\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function pmCut\(s, n\) \{[^\n]*\n/) +
  grab(/function pmEtDay\(ms\) \{[^\n]*\n/) +
  grab(/function pmEtClose\(day\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function pmDayShift\(day, n\) \{[^\n]*\n/) +
  grab(/function pmIsWeekday\(day\) \{[^\n]*\n/) +
  grab(/function pmCloseAt\(points, ms\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function pmMedian\(a\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function pmDayMaths\(points, nowMs, last\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function pmFavourite\(rows\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function pmFmtChg\(c\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function pmFmtPts\(v\) \{[^\n]*\n/) +
  grab(/function pmChips\(latest, hist, nowMs\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function pmClock\(iso\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function pmStatus\(run, nowMs\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function pmChipTitle\(c\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function pmChipHTML\(c\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function pmStripHTML\(chips, status, state\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function pmLinePts\(points, nowMs, cur\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function pmLineHTML\(points, nowMs, cur\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function pmEnds\(iso\) \{[^\n]*\n/) +
  grab(/function pmPct\(v\) \{[^\n]*\n/) +
  grab(/function pmLinkFor\(row, slugs\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function pmPanelHTML\(topic, rows, hist, meta, slugs, nowMs, state\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function rgFmt\(v,d\)\{[^\n]*\n/) +
  grab(/function rgChart\(sets,o\)\{[\s\S]*?\n\}/) + "\n" +
  grab(/function rgTrendCls\(pts\)\{[\s\S]*?\n\}/) + "\n" +
  grab(/const RG_PM_MAP = \[[\s\S]*?\n\];\n/) +
  grab(/function pmRegimeRowHTML\(r, points, nowMs\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function rgRenderCatalysts\(\)\{[\s\S]*?\n\}/) + "\n" +
  "const RG = { cats: null };\nconst el = () => null;\n";
const fn = (name) => new Function(shared + "return " + name + ";")();
const pmChips = fn("pmChips"), pmDayMaths = fn("pmDayMaths"), pmStatus = fn("pmStatus"), pmStripHTML = fn("pmStripHTML"),
  pmPanelHTML = fn("pmPanelHTML"), pmFavourite = fn("pmFavourite"), pmShort = fn("pmShort"), pmEtClose = fn("pmEtClose"),
  PM_SHORT = fn("PM_SHORT"), RG_PM_MAP = fn("RG_PM_MAP");
const rgRenderWith = (cats) => new Function(shared + "RG.cats = arguments[0]; return rgRenderCatalysts();")(cats);

/* the fixture: Friday 2 Oct 2026, 15:30 ET (19:30Z). Yesterday's close = Thu 1 Oct 16:00 ET = 20:00Z. */
const NOW = Date.parse("2026-10-02T19:30:00Z");
const T = (iso) => Date.parse(iso);
/* a market that sits still for weeks (a ±0.5 pt usual day) and jumps 6 points today */
const stillThenJump = [];
for (let d = 1; d <= 20; d++) { const day = new Date(Date.UTC(2026, 8, 11 + d)); // 12 Sep … 1 Oct, one reading a day at 14:00Z
  stillThenJump.push({ t: Date.UTC(2026, 8, 11 + d, 14, 0), p: 0.30 + (d % 2 ? 0.005 : 0) }); }
stillThenJump.push({ t: T("2026-10-02T15:00:00Z"), p: 0.36 });
/* a market that moves 3 points every weekday (its usual day is 3) and sits flat today: ordinary. The Fed's "No change"
   in the latest rows below is 82.5%; yesterday (1 Oct = d 20, even) closed at 0.825, so today is a flat day, +0. */
const steady = [];
for (let d = 1; d <= 20; d++) steady.push({ t: Date.UTC(2026, 8, 11 + d, 14, 0), p: 0.825 + (d % 2 ? 0.03 : 0) });
steady.push({ t: T("2026-10-02T15:00:00Z"), p: 0.825 });
const latest = [
  { topic: "fed-2026-10", venue: "polymarket", event_id: "606422", market_id: "2589812", outcome: "No change", align_key: "hold", question: "Will there be no change in Fed interest rates after the October 2026 meeting?", probability: "0.825", bid: "0.82", ask: "0.83", end_date: "2026-10-29T03:59:00+00:00", ts: "2026-10-02T19:15:00Z" },
  { topic: "fed-2026-10", venue: "polymarket", event_id: "606422", market_id: "2589813", outcome: "25 bps increase", align_key: "hike25", question: "Will the Fed increase interest rates by 25 bps after the October 2026 meeting?", probability: "0.175", bid: "0.17", ask: "0.18", end_date: "2026-10-29T03:59:00+00:00", ts: "2026-10-02T18:30:00Z" },
  { topic: "gold-month", venue: "polymarket", event_id: "907964", market_id: "4936078", outcome: "↓ $4,100", align_key: null, question: "Will Gold (XAUUSD) hit (LOW) $4,100 in October?", probability: "0.995", bid: "0.99", ask: "1.00", end_date: "2026-11-01T03:59:59Z", ts: "2026-10-02T19:00:00Z" },
  { topic: "gold-month", venue: "polymarket", event_id: "907964", market_id: "5208210", outcome: "↑ $4,200", align_key: null, question: "Will Gold (XAUUSD) hit (HIGH) $4,200 in October?", probability: "0.36", bid: "0.33", ask: "0.39", end_date: "2026-11-01T03:59:59Z", ts: "2026-10-02T19:15:00Z" },
  { topic: "recession-2026", venue: "polymarket", event_id: "48802", market_id: "500001", outcome: "Yes", align_key: "yes", question: "US recession by end of 2026?", probability: "0.50", bid: "0.49", ask: "0.51", end_date: "2027-01-31T00:00:00Z", ts: "2026-10-02T10:00:00Z" },
  { topic: "taiwan-invade", venue: "polymarket", event_id: "34044", market_id: "500002", outcome: "Yes", align_key: null, question: "China invades Taiwan before 2027?", probability: "0.03", bid: "0.02", ask: "0.04", end_date: "2027-01-01T00:00:00Z", ts: "2026-10-01T10:00:00Z" },
  { topic: "discover", venue: "polymarket", event_id: "1", market_id: "900000", outcome: "Lula", align_key: null, question: "Brazil Presidential Election", probability: "0.74", bid: null, ask: null, end_date: null, ts: "2026-10-02T19:15:00Z" },
];
const hist = { "2589812": steady, "5208210": stillThenJump, "500001": [{ t: T("2026-10-01T15:00:00Z"), p: 0.55 }, { t: T("2026-10-02T10:00:00Z"), p: 0.50 }] };

test("16:00 New York is found on a summer day and a winter day", () => {
  assert.equal(pmEtClose("2026-10-01"), Date.parse("2026-10-01T20:00:00Z"), "EDT: 16:00 ET = 20:00Z");
  assert.equal(pmEtClose("2026-12-15"), Date.parse("2026-12-15T21:00:00Z"), "EST: 16:00 ET = 21:00Z");
});

test("every registry topic has a short name of at most 18 characters, and an unknown topic is cut to fit", () => {
  for (const t of registry.topics) {
    assert.ok(PM_SHORT[t.id], "no short name for " + t.id);
    assert.ok(PM_SHORT[t.id].length <= 18, t.id + " → " + PM_SHORT[t.id] + " is " + PM_SHORT[t.id].length);
  }
  assert.equal(pmShort("a-topic-id-that-is-very-long-indeed").length, 18);
});

test("the day maths: the change is since yesterday's 16:00 ET close, the usual day is the middle weekday move, the flash needs a bigger move", () => {
  const w = pmDayMaths(stillThenJump, NOW, 0.36);
  assert.equal(Math.round(w.yc * 1000) / 1000, 0.30, "1 Oct (d=20, even) closed at 0.30");
  assert.equal(Math.round(w.chg * 10) / 10, 6, "+6 points today");
  assert.equal(w.usual, 0.5, "the market's usual day is half a point");
  assert.equal(w.wild, true, "6 points beats max(usual 0.5, the one-point floor)");
  assert.equal(Math.round(w.x), 12, "12× its usual day");
  const s = pmDayMaths(steady, NOW, 0.825);
  assert.equal(s.usual, 3, "3 points every weekday");
  assert.equal(s.chg, 0, "a flat day is a change of 0, not null");
  assert.equal(s.wild, false);
  const thin = pmDayMaths([{ t: T("2026-10-01T15:00:00Z"), p: 0.55 }, { t: T("2026-10-02T10:00:00Z"), p: 0.50 }], NOW, 0.50);
  assert.equal(Math.round(thin.chg), -5, "−5 since yesterday's close");
  assert.equal(thin.n, 0, "no weekday-to-weekday pair yet");
  assert.equal(thin.wild, false, "nothing is wild without a usual day to measure against");
  const none = pmDayMaths([], NOW, 0.50);
  assert.equal(none.chg, null, "no history: no change is printed, never a zero");
});

test("the headline outcome is the most likely one under 97%; discover never makes a chip", () => {
  const gold = latest.filter((r) => r.topic === "gold-month");
  assert.equal(pmFavourite(gold).market_id, "5208210", "the 99.5% level is as good as settled: the 36% level is the headline");
  const chips = pmChips(latest, hist, NOW);
  assert.ok(!chips.some((c) => c.topic === "discover"));
  assert.equal(chips.find((c) => c.topic === "fed-2026-10").head.outcome, "No change");
});

test("chip order: the biggest move first, then by probability; the colour rule has no grey", () => {
  const chips = pmChips(latest, hist, NOW);
  assert.deepEqual(chips.map((c) => c.topic), ["gold-month", "recession-2026", "fed-2026-10", "taiwan-invade"],
    "gold +6 · recession −5 · the Fed +0 (83%) · Taiwan (no history, 3%)");
  const html = pmStripHTML(chips, pmStatus({ run_id: "pm-x", ts: "2026-10-02T19:15:05Z", read: 240, written: 37, unchanged: 203, ms: 4219, problems: [] }, NOW), {});
  assert.ok(html.includes('id="pmBand"') && html.includes("PREDICTION MARKETS →"));
  assert.ok(html.includes('class="pm-chg up is-scint" data-up="1">◆+6.0<'), "gold: green, flashing, a diamond, +6.0 points");
  assert.ok(html.includes('class="pm-chg dn">−5.0<'), "recession: red, no flash");
  assert.ok(html.includes('class="pm-chg up">+0.0<'), "the Fed's flat day is green +0.0 — never a grey case");
  assert.ok(!/pm-chg neu|pm-chg flat/.test(html));
  assert.ok(html.includes("12.0× its usual day"), "the hover says N× its usual day");
  assert.ok(!/σ|sigma/i.test(html), "never a sigma");
  assert.ok(html.includes('data-act="pmchip" data-topic="gold-month"'));
  assert.ok(html.includes("<span class=\"pm-nm\">Gold this month</span>"));
  assert.ok(html.includes('class="pm-p">36%<'), "a whole percent");
  const seg = html.split('class="pm-nm">Gold this month').length - 1;
  assert.equal(seg, 2, "the marquee's two equal halves");
});

test("the status chip: the newest pass, red past 45 minutes or with a problem", () => {
  const fresh = pmStatus({ run_id: "pm-x", ts: "2026-10-02T19:15:05Z", read: 240, written: 37, unchanged: 203, ms: 4219, problems: [] }, NOW);
  assert.equal(fresh.text, "15:15 · 240 read · 0 problems");
  assert.equal(fresh.red, false);
  const old = pmStatus({ run_id: "pm-x", ts: "2026-10-02T18:40:00Z", read: 240, written: 0, unchanged: 240, ms: 100, problems: [] }, NOW);
  assert.equal(old.red, true, "50 minutes old");
  assert.ok(/OLDER THAN 45 MINUTES/.test(old.title));
  const prob = pmStatus({ run_id: "pm-x", ts: "2026-10-02T19:15:05Z", read: 240, written: 35, unchanged: 205, ms: 4167,
    problems: [{ venue: "polymarket", topic: "shutdown", event: "580520", reason: "EVENT_CLOSED — this topic has no series to roll to" }] }, NOW);
  assert.equal(prob.text, "15:15 · 240 read · 1 problem");
  assert.equal(prob.red, true);
  assert.ok(prob.title.includes("shutdown: EVENT_CLOSED"));
  assert.equal(pmStatus(null, NOW).red, true, "no pass at all is red");
  const html = pmStripHTML([], prob, {});
  assert.ok(html.includes('class="pm-status is-red"'));
});

test("the pane: every outcome with bid / ask, the venue, the question in full, a 20-day line, and the market's page on polymarket.com in a new tab", () => {
  const slugs = { "606422": { event: "fed-decision-in-october-2026", markets: { "2589812": "will-there-be-no-change-in-fed-interest-rates-after-the-october-2026-meeting" } } };
  const html = pmPanelHTML("fed-2026-10", latest, hist, { label: "Fed decision · the next meeting", group: "The Fed", plain: "what the Fed does at its next meeting" }, slugs, NOW, {});
  assert.ok(html.includes('id="pmPanel" data-topic="fed-2026-10"'));
  assert.ok(html.includes("Fed decision · the next meeting") && html.includes("The Fed"));
  assert.ok(html.includes("Will there be no change in Fed interest rates after the October 2026 meeting?"), "the question in full");
  assert.ok(html.includes("Will the Fed increase interest rates by 25 bps after the October 2026 meeting?"), "every outcome");
  assert.ok(html.includes("No change · bid 82% / ask 83% · polymarket · ends 2026-10-29"));
  assert.ok(html.includes("25 bps increase · bid 17% / ask 18% · polymarket"));
  assert.ok(html.includes('class="rg-svg"'), "the 20-day line");
  assert.ok(html.includes('href="https://polymarket.com/event/fed-decision-in-october-2026/will-there-be-no-change-in-fed-interest-rates-after-the-october-2026-meeting" target="_blank" rel="noopener"'), "the market's own page");
  assert.ok(html.includes('href="https://polymarket.com/event/fed-decision-in-october-2026" target="_blank" rel="noopener">open on polymarket.com ↗'), "the event's page");
  assert.ok(html.includes('data-act="pmclose"'), "a way back");
  assert.ok(html.includes("<b>83%</b>") && html.includes('<u class="up">+0.0</u>'), "the probability and today's change");
  const noslug = pmPanelHTML("fed-2026-10", latest, hist, null, {}, NOW, { slugBusy: true });
  assert.ok(noslug.includes("finding its page on polymarket.com…") && !noslug.includes("polymarket.com/event/"), "nothing is guessed before the slug arrives");
  const empty = pmPanelHTML("effective-tariff", latest, hist, null, {}, NOW, {});
  assert.ok(empty.includes("not in the registry yet"), "a topic without a live market says so in the dim style, never a blank");
});

test("REGIME: the view no longer reads catalyst_odds; its card draws the six headings from the registry, dim where a topic is missing", () => {
  const i0 = src.indexOf("Room 9b · REGIME view"), i1 = src.indexOf("Room 3 · COMPANY");
  assert.ok(i0 > 0 && i1 > i0);
  const regime = src.slice(i0, i1);
  assert.ok(!regime.includes("catalyst_odds"), "the REGIME block mentions catalyst_odds");
  assert.ok(!/pg\("catalyst_odds/.test(src), "no read of catalyst_odds anywhere on the page");
  assert.ok(regime.includes("pmRegimeLoad()"), "REGIME loads the registry's tables");
  assert.deepEqual(RG_PM_MAP.map((m) => m[0]), ["the Fed · the next meeting", "inflation · CPI, the next print", "the midterms · the House", "the midterms · the Senate", "recession", "government shutdown"]);
  const html = rgRenderWith({ rows: latest.filter((r) => r.topic !== "discover"), hist, at: NOW });
  assert.ok(html.includes("prediction markets"));
  assert.ok(html.includes("Will there be no change in Fed interest rates after the October 2026 meeting?"));
  assert.ok(html.includes("US recession by end of 2026?"));
  assert.equal((html.match(/not in the registry yet/g) || []).length, 4, "CPI, the House, the Senate and the shutdown have no row in this fixture: each says so, none is blank");
  assert.ok(html.includes('<u class="rg-dn">−5.0</u>'), "today's change rides beside the probability, in its colour");
  const nofeed = rgRenderWith({ rows: [], hist: {}, err: "pg prediction_market_latest → 503" });
  assert.ok(nofeed.includes("NO FEED"));
});

test("the band has its slot under the dashboard and the pane has its branch in the right-side pane", () => {
  assert.ok(src.includes('<div id="ernBandSlot"></div><div id="pmBandSlot"></div>'), "the slot sits beside the EARNINGS → band");
  assert.ok(/PM\.open && \(LEFT_STATE !== "PINNED" \|\| !LEFT_T\)\) return pmPanelNow\(PM\.open\)/.test(src), "leftPanelInnerHTML draws the topic pane");
  assert.ok(src.includes('case "pmchip": { pmOpen(a.dataset.topic); break; }') && src.includes('case "pmclose": { pmClose(); break; }'));
  assert.ok(src.includes('<style id="prediction-reel-20261002">'));
});

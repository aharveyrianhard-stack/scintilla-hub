/* P2 (2 Oct 2026) — THE PREDICTION MARKETS SECTION (SENTIMENT → PREDICTION MARKETS) and THE TOPIC METHOD.
   Alan, 2 Oct: "leave the strip, but we need a full section for this. It's either in sentiment or in social." … "we need a
   methodology that scans the news from our streams, makes a list and tracks it." Everything below runs on the page's own
   functions, pulled out of index.html, and on the method's module, over fixtures — no network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { THEMES, countThemes, propose, exclusionReason, bestMarket, themesToSearch, ADD_MIN_7D, QUIET_MAX_7D } from "../supabase/functions/prediction-topic-proposals/lib.mjs";

const src = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const grab = (re) => { const m = src.match(re); assert.ok(m, "not found in index.html: " + re); return m[0]; };
const registry = JSON.parse(fs.readFileSync(new URL("../supabase/functions/prediction-markets/topics.json", import.meta.url), "utf8"));

/* the page's functions the section rests on (the band's maths) plus the section's own */
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
  grab(/function pmDiscoverChips\(latest, hist, nowMs\) \{[\s\S]*?\n\}/) + "\n" +   // P2b: the WHAT THE WORLD IS BETTING ON group
  grab(/function pmClock\(iso\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function pmStatus\(run, nowMs\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function pmChipTitle\(c\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function pmLinePts\(points, nowMs, cur\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function pmLineHTML\(points, nowMs, cur\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function pmEnds\(iso\) \{[^\n]*\n/) +
  grab(/function pmPct\(v\) \{[^\n]*\n/) +
  grab(/function pmLinkFor\(row, slugs\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function rgFmt\(v,d\)\{[^\n]*\n/) +
  grab(/function rgChart\(sets,o\)\{[\s\S]*?\n\}/) + "\n" +
  grab(/function rgTrendCls\(pts\)\{[\s\S]*?\n\}/) + "\n" +
  grab(/const PM_SECTION_ON = true;[\s\S]*?var PMX = \{[^\n]*\n/) +
  "var S = { sec: 'SENTIMENT', sentiTab: 'PREDICTION' };\nconst el = (id) => (id === 'snMain' ? {} : null);\nfunction pmPanelNow(t) { return '<div id=\"pmPanel\" data-topic=\"' + t + '\"></div>'; }\n" +
  grab(/function pmSectionOn\(\) \{[^\n]*\n/) +
  grab(/function pmGroupOf\(topic, reg\) \{[^\n]*\n/) +
  grab(/function pmFmtX\(x\) \{[^\n]*\n/) +
  grab(/function pmSectionRowHTML\(c, hist, reg, slugs, nowMs\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function pmSectionStatusHTML\(run, chips, reg, nowMs, state\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function pmProposalsHTML\(props, state\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function pmSectionHTML\(latest, hist, run, reg, slugs, props, nowMs, state\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function pmSectionRailHTML\(openTopic\) \{[\s\S]*?\n\}/) + "\n";
const fn = (name) => new Function(shared + "return " + name + ";")();
const pmSectionHTML = fn("pmSectionHTML"), pmProposalsHTML = fn("pmProposalsHTML"), pmSectionRailHTML = fn("pmSectionRailHTML"),
  PM_GROUP = fn("PM_GROUP"), PM_GROUP_ORDER = fn("PM_GROUP_ORDER"), PM_RULE_SENTENCE = fn("PM_RULE_SENTENCE");

/* the fixture: Friday 2 Oct 2026, 15:30 ET (19:30Z). Yesterday's close = Thu 1 Oct 16:00 ET = 20:00Z. */
const NOW = Date.parse("2026-10-02T19:30:00Z");
const T = (iso) => Date.parse(iso);
const row = (topic, market_id, outcome, p, extra) => ({ topic, venue: "polymarket", event_id: "E" + topic, market_id, outcome, question: "Q " + topic, probability: p, bid: p - 0.01, ask: p + 0.01, ts: "2026-10-02T19:15:00Z", ...extra });
/* a step history: a close every weekday at 15:00 ET for 20 weekdays ending yesterday, then today's reading */
function steps(market, closes) {
  const out = [];
  let day = "2026-10-01", i = closes.length - 1;
  while (i >= 0) { const d = new Date(day + "T12:00:00Z").getUTCDay(); if (d >= 1 && d <= 5) { out.push({ t: T(day + "T19:00:00Z"), p: closes[i] }); i--; } const dd = new Date(day + "T12:00:00Z"); dd.setUTCDate(dd.getUTCDate() - 1); day = dd.toISOString().slice(0, 10); }
  return { [market]: out.sort((a, b) => a.t - b.t) };
}
const latest = [
  row("fed-2026-10", "M1", "No change", 0.83), row("fed-2026-10", "M2", "Cut 0.25 pt", 0.15),
  row("gold-month", "M3", "$4,000", 0.41),
  row("taiwan-invade", "M4", "Yes", 0.08),
];
const hist = { ...steps("M1", [0.80, 0.80, 0.81, 0.80, 0.80, 0.81, 0.80, 0.80, 0.80, 0.81, 0.80, 0.80, 0.80, 0.81, 0.80, 0.80, 0.80, 0.81, 0.80, 0.80]),   // usual day 1 point (floor); today +3 → wild
  ...steps("M3", [0.40, 0.40]),                                                                                     // 1 daily change: too few days
  ...steps("M4", [0.10, 0.11, 0.10, 0.11, 0.10, 0.11, 0.10, 0.11, 0.10, 0.11, 0.10, 0.11, 0.10, 0.11, 0.10, 0.11, 0.10, 0.11, 0.10, 0.09]) };  // today −1, usual 1 → not wild
const run = { run_id: "pass-1", ts: "2026-10-02T19:15:00Z", read: 240, written: 40, unchanged: 200, ms: 5000, problems: [] };
const reg = { "fed-2026-10": { label: "Fed decision · the next meeting", group: "The Fed" }, "gold-month": { label: "Gold this month", group: "Gold" },
  "taiwan-invade": { label: "China invades Taiwan", group: "China–Taiwan" }, "shutdown": { label: "US government shutdown", group: "Washington" } };
const slugs = { Efed_2026_10: null, "Efed-2026-10": { event: "fed-decision-october", markets: { M1: "no-change" } } };
const props = [
  { run_id: "proposals-1", ts: "2026-10-03T01:48:00Z", kind: "add", theme: "Bitcoin / crypto", topic: null, headline_7d: 230, market_title: "What price will Bitcoin hit in October?", event_id: "1112205", series_id: "10016", volume_24h: 944501, why: "230 headlines in 7 days say Bitcoin / crypto, no topic tracks it, and Polymarket has an open market", status: "proposed" },
  { run_id: "proposals-1", ts: "2026-10-03T01:48:00Z", kind: "remove", theme: "Tariffs / trade", topic: "effective-tariff", headline_7d: 29, market_title: null, why: "maps to no Polymarket market (Kalshi only) and Kalshi is off", status: "proposed" },
];

test("SENTIMENT has a sixth sub-tab, PREDICTION MARKETS, and the room routes it to its own filler", () => {
  const tabs = grab(/const SENTI_TABS = \[[^\n]*\];/);
  assert.match(tabs, /\["PREDICTION", "PREDICTION MARKETS"\]\]/, "the tab is last in the row");
  assert.match(grab(/const SENTI_LBL = \{[\s\S]*?\n\};/), /PREDICTION: \["prediction markets/);
  assert.match(grab(/function sentiDispatch\(\) \{[\s\S]*?\n\}/), /S\.sentiTab === "PREDICTION"\) return typeof fillSentiPrediction === "function" \? fillSentiPrediction\(\)/);
  assert.match(src, /if \(h === "prediction" \|\| h === "prediction-markets" \|\| h === "polymarket"\) return "SENTIMENT";/, "#prediction opens the room");
  assert.match(src, /sentiTab: scEntrySentiTab\(\),/, "and lands on the sub-tab");
  assert.match(grab(/function scEntrySentiTab\(\) \{[\s\S]*?\n\}/), /"PREDICTION" : "OVERVIEW"/);
});

test("the band stays as it is; its label and the pane's foot link into the section; the dispatcher knows the way", () => {
  assert.match(src, /data-act="pmsection">PREDICTION MARKETS →<\/b>/, "the label opens the section");
  assert.match(src, /case "pmsection": \{ if \(typeof pmGoSection === "function"\) pmGoSection\(\); break; \}/);
  assert.match(grab(/function pmGoSection\(\) \{[\s\S]*?\n\}/), /S\.sec = "SENTIMENT"; S\.sentiTab = "PREDICTION";/);
  assert.match(grab(/function pmOpen\(topic\) \{[\s\S]*?\n\}/), /if \(pmSectionOn\(\)\) \{[\s\S]*?pmSectionPaint\(\); pmPanelLoad\(topic\);/, "inside the section a row opens in the room's own right-hand panel, not the dashboard");
  assert.match(grab(/function pmClose\(\) \{[\s\S]*?\n\}/), /if \(pmSectionOn\(\)\) \{ pmSectionPaint\(\); return; \}/);
  assert.match(grab(/function pmStripHTML\(chips, status, state\) \{[\s\S]*?\n\}/), /PREDICTION MARKETS →/, "the strip's label text is unchanged");
});

test("every registry topic has a group on the page, equal to topics.json, and every group has a place in the order", () => {
  const want = Object.fromEntries(registry.topics.map((t) => [t.id, t.group]));
  assert.deepEqual(PM_GROUP, want);
  for (const g of new Set(registry.topics.map((t) => t.group))) assert.ok(PM_GROUP_ORDER.includes(g), "group in the order: " + g);
});

test("the section: a status line, the rule in one sentence, rows grouped by theme in the order, change coloured, the flash, the venue link, the quiet topic", () => {
  const h = pmSectionHTML(latest, hist, run, reg, slugs, props, NOW, {});
  assert.match(h, /last pass 15:15 · 240 read · 0 problems/);
  assert.match(h, /3 of 4 topics with a live market · <b>1 moving more than usual<\/b>/);
  assert.ok(h.includes(PM_RULE_SENTENCE.replace(/'/g, "&#39;")) || h.includes(PM_RULE_SENTENCE), "the rule is printed in plain words");
  assert.match(PM_RULE_SENTENCE, /at least 3 days of history/);
  const groups = [...h.matchAll(/<div class="pmx-grp__h">([^<]+) /g)].map((m) => m[1]);
  assert.deepEqual(groups, ["The Fed", "Gold", "Washington", "China–Taiwan"], "the money first, then the world; a quiet topic's group still appears");
  const fed = h.match(/<div class="pmx-row is-wild" data-act="pmchip" data-topic="fed-2026-10"[\s\S]*?<\/span><\/div>/);
  assert.ok(fed, "the Fed row flashes: +3 points against a usual day of 1");
  assert.match(fed[0], /<span class="pmx-row__p">83%<\/span>/);
  assert.match(fed[0], /pmx-row__c up">◆\+3\.0<i>3\.0× usual<\/i>/);
  assert.match(fed[0], /<span class="pmx-row__o">No change<i>2 outcomes<\/i>/, "the headline outcome and the ladder's size");
  assert.match(fed[0], /href="https:\/\/polymarket\.com\/event\/fed-decision-october\/no-change"/, "the venue link once the slug is known");
  const gold = h.match(/<div class="pmx-row" data-act="pmchip" data-topic="gold-month"[\s\S]*?<\/span><\/div>/)[0];
  assert.match(gold, /pmx-row__c up">\+1\.0<i>1 of 3 days<\/i>/, "too few days: the change is printed, the usual day is not claimed, no flash");
  assert.match(gold, /<span class="pmx-dim">polymarket<\/span>/, "no slug yet: the venue is named, nothing is guessed");
  const tw = h.match(/<div class="pmx-row" data-act="pmchip" data-topic="taiwan-invade"[\s\S]*?<\/span><\/div>/)[0];
  assert.match(tw, /pmx-row__c dn">−1\.0<i>1\.0× usual<\/i>/, "down is red (dn), not grey");
  assert.match(h, /pmx-row pmx-row--quiet" title="US government shutdown · no live market reading in the last 8 hours"/);
  assert.match(h, /<span class="pmx-row__o pmx-dim">no live market<\/span>/);
});

test("the proposals: ADD and REMOVE with a plain why each; the source footnote; the empty case", () => {
  const h = pmProposalsHTML(props, { src: "file" });
  assert.match(h, /PROPOSALS · OUR OWN NEWS DECIDES THE LIST/);
  assert.match(h, /pmx-prop is-add"><span class="pmx-prop__k">ADD<\/span><span class="pmx-prop__t"><b>Bitcoin \/ crypto<\/b><i>“What price will Bitcoin hit in October\?” · \$944,501 traded in a day<\/i>/);
  assert.match(h, /<span class="pmx-prop__n">230<i>headlines · 7 days<\/i><\/span>/);
  assert.match(h, /pmx-prop is-rm"><span class="pmx-prop__k">REMOVE<\/span><span class="pmx-prop__t"><b>effective-tariff<\/b>/);
  assert.match(h, /Nothing is added by itself: Alan approves/);
  assert.match(h, /Weather, temperatures, sports, tweet counts, prizes and celebrity novelties are left out by rule/);
  assert.match(h, /this is the file, not the table/);
  assert.match(pmProposalsHTML([], { src: "table" }), /no proposal tonight/);
  assert.match(pmProposalsHTML(null, { busy: true }), /reading the proposals/);
});

test("the right-hand panel: the plain-words cards (two threads, the yesterday / three-day rule), or the open topic's pane", () => {
  const h = pmSectionRailHTML(null);
  assert.match(h, /THE YESTERDAY \/ THREE-DAY RULE, IN PLAIN WORDS/);
  assert.match(h, /TWO THREADS ON ONE TOPIC/);
  assert.match(h, /\$770/, "the SPY re-listing is the worked example");
  assert.match(h, /Kalshi is mapped but off/);
  assert.match(pmSectionRailHTML("fed-2026-10"), /id="pmPanel" data-topic="fed-2026-10"/);
});

/* ---- the topic method -------------------------------------------------------- */
test("the theme map counts headlines once per theme they match; company themes are counted but never proposed", () => {
  const c = countThemes(["Fed holds rates steady as Powell warns", "Gold retreats as Treasury yields rebound", "Gold retreats as Treasury yields rebound",
    "Bitcoin rallies above $86K", "Nvidia price target raised at Citi", "Micron earnings beat; shares jump", null, ""]);
  assert.equal(c["Fed / rates"].n, 1); assert.equal(c["Gold"].n, 2); assert.equal(c["Gold"].distinct, 1); assert.equal(c["Treasury yields"].n, 2);
  assert.equal(c["Bitcoin / crypto"].n, 1); assert.equal(c["Price target"].n, 1); assert.equal(c["Earnings"].n, 1);
  for (const t of THEMES) if (t.kind === "company") assert.equal(t.topics.length, 0);
  const regIds = registry.topics.map((t) => t.id);
  for (const t of THEMES) for (const id of t.topics) assert.ok(regIds.includes(id), "theme topic exists in the registry: " + id);
  const mapped = new Set(THEMES.flatMap((t) => t.topics));
  for (const id of regIds) assert.ok(mapped.has(id), "registry topic has a theme: " + id);
});

test("the exclusion rule: weather, sports, tweet counts, prizes and games are left out; a closed market too", () => {
  assert.equal(exclusionReason({ title: "Highest temperature in NYC on October 5?", tags: [{ label: "Weather" }] }), 'tag "weather"');
  assert.equal(exclusionReason({ title: "Elon Musk # tweets October 3-10?", tags: [] }), 'title says "tweets"');
  assert.equal(exclusionReason({ title: "Pittsburgh vs. Virginia Tech", tags: [{ label: "CFB (All)" }] }), 'tag "cfb (all)"');
  assert.equal(exclusionReason({ title: "Nobel Peace Prize 2026", tags: [{ label: "World" }] }), 'title says "Nobel"');
  assert.equal(exclusionReason({ title: "Government shutdown by October 1?", tags: [], closed: true }), "closed");
  assert.equal(exclusionReason({ title: "What price will Bitcoin hit in October?", tags: [{ label: "Bitcoin" }], closed: false }), null);
  const best = bestMarket([
    { id: "1", title: "Bitcoin above ___ on October 3?", volume24hr: 900000, closed: false, tags: [], series: [] },
    { id: "2", title: "What price will Bitcoin hit in October?", volume24hr: 800000, closed: false, tags: [], series: [{ id: "10016" }], slug: "btc-oct" },
    { id: "3", title: "Highest temperature in Miami?", volume24hr: 5000000, closed: false, tags: [{ label: "Daily Temperature" }] }]);
  assert.equal(best.event_id, "2", "a market in a series wins (it rolls by itself); the temperature market never counts");
  assert.equal(best.series_id, "10016");
});

test("the proposals: ADD at 100+ headlines with an open market and no topic; no-market when the search finds nothing fit; REMOVE when quiet and not live, or Kalshi-only", () => {
  const counts = {}; for (const t of THEMES) counts[t.theme] = { n: 0, distinct: 0 };
  counts["Bitcoin / crypto"] = { n: 230, distinct: 177 }; counts["Jobs / payrolls"] = { n: 122, distinct: 90 }; counts["Ethereum"] = { n: 29, distinct: 12 };
  counts["Shutdown"] = { n: 1, distinct: 1 }; counts["Tariffs / trade"] = { n: 29, distinct: 25 }; counts["Earnings"] = { n: 1203, distinct: 1078 };
  const regIds = registry.topics.map((t) => t.id);
  const live = regIds.filter((id) => id !== "shutdown" && id !== "effective-tariff");
  const searches = { "Bitcoin / crypto": [{ id: "1112205", title: "What price will Bitcoin hit in October?", volume24hr: 944501, closed: false, tags: [], series: [{ id: "10016" }] }],
    "Jobs / payrolls": [{ id: "9", title: "Highest temperature in NYC on October 5?", volume24hr: 1, closed: false, tags: [{ label: "Weather" }] }] };
  const rows = propose({ counts, registryIds: regIds, liveTopics: live, searches, runId: "r", ts: "2026-10-03T01:48:00Z", registryTopics: registry.topics, kalshiOn: false });
  const by = Object.fromEntries(rows.map((r) => [r.kind + ":" + (r.topic || r.theme), r]));
  assert.equal(by["add:Bitcoin / crypto"].status, "proposed"); assert.equal(by["add:Bitcoin / crypto"].event_id, "1112205");
  assert.match(by["add:Bitcoin / crypto"].why, /230 headlines in 7 days \(177 distinct\) say Bitcoin \/ crypto, no topic tracks it, and Polymarket has an open market/);
  assert.equal(by["add:Jobs / payrolls"].status, "no-market", "a heavy theme whose only hits fail the rule is noted, not added");
  assert.match(by["add:Jobs / payrolls"].why, /1 hit left out/);
  assert.equal(by["remove:shutdown"].kind, "remove"); assert.match(by["remove:shutdown"].why, /only 1 headline in 7 days say Shutdown, and “shutdown” has had no live market reading in the last 8 hours/);
  assert.equal(by["remove:effective-tariff"].kind, "remove"); assert.match(by["remove:effective-tariff"].why, /Kalshi only.*Kalshi is off/);
  assert.ok(!rows.some((r) => r.theme === "Earnings"), "company themes are never proposed");
  assert.ok(!rows.some((r) => r.theme === "Ethereum"), "29 headlines is under the ADD line");
  assert.ok(!rows.some((r) => r.kind === "remove" && live.includes(r.topic)), "a topic with a live market is never proposed for removal");
  assert.equal(ADD_MIN_7D, 100); assert.equal(QUIET_MAX_7D, 20);
  assert.deepEqual(themesToSearch(counts, regIds).map((t) => t.theme), ["Jobs / payrolls", "Bitcoin / crypto"]);
});

test("the table is additive, anon-readable, with a rollback that drops only itself; the script and the function read the same news column the same way", () => {
  const mig = fs.readFileSync(new URL("../supabase/migrations/20261002_prediction_topic_proposals.sql", import.meta.url), "utf8");
  assert.match(mig, /create table if not exists public\.prediction_topic_proposals/);
  assert.match(mig, /check \(kind in \('add','remove'\)\)/);
  assert.match(mig, /create policy prediction_topic_proposals_read on public\.prediction_topic_proposals for select to anon, authenticated/);
  assert.doesNotMatch(mig, /alter table public\.prediction_market|drop (table|view)/i, "nothing existing is touched");
  const rb = fs.readFileSync(new URL("../supabase/migrations/20261002_prediction_topic_proposals_ROLLBACK.sql", import.meta.url), "utf8");
  assert.match(rb, /drop table if exists public\.prediction_topic_proposals;/);
  assert.doesNotMatch(rb, /prediction_market_snapshots|prediction_market_runs|cron\./);
  const script = fs.readFileSync(new URL("../scripts/prediction-topic-proposals.mjs", import.meta.url), "utf8");
  const edge = fs.readFileSync(new URL("../supabase/functions/prediction-topic-proposals/index.ts", import.meta.url), "utf8");
  for (const s of [script, edge]) {
    assert.match(s, /published_ts=gte\." \+ since/, "epoch seconds, not an ISO string (news.published_ts is a bigint)");
    assert.match(s, /\/ 1000\)/);
    assert.match(s, /from "(\.\.\/supabase\/functions\/prediction-topic-proposals|\.)\/lib\.mjs"/, "one module for both");
  }
  assert.doesNotMatch(script, /eyJ[A-Za-z0-9_-]{20,}/, "no key in the script");
  assert.match(script, /if \(doWrite\)/, "nothing is written without --write");
  const dry = JSON.parse(fs.readFileSync(new URL("../deliverables/20261002/prediction-section/proposals-20261002.json", import.meta.url), "utf8"));
  assert.ok(Array.isArray(dry.proposals) && dry.proposals.length >= 1);
  for (const r of dry.proposals) { assert.ok(["add", "remove"].includes(r.kind)); assert.ok(r.why && r.why.length > 20); }
  assert.ok(dry.headlines > 20000, "tonight's run read the whole 7-day reel");
});

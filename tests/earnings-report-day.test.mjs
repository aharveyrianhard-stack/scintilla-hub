import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
/* A result captured TODAY is a past report on both views. On 8de19eb the company EVENTS tab kept a today-dated row that already
   carries its stored result in the NEXT EARNINGS slot (and out of PAST EARNINGS / the streak), and the master feed moved it only
   when its EPS was stored. ALL ROWS BELOW ARE EXAMPLE FIXTURES (tickers EXA / EXB / EXC, invented numbers) - not stored data. */
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const grab = (re) => { const m = page.match(re); return m ? m[0] : ""; };
const helperSrc = grab(/function ernByReportDay\(rows, today\) \{[\s\S]*?\n\}\n/);
const TODAY = "2026-09-24";   // EXAMPLE New York day (a report day)
const row = (ticker, date, eps_actual = null, revenue_actual = null) =>
  ({ ticker, date, eps_actual, revenue_actual, eps_estimate: 1, revenue_estimate: 100, report_time: null });   // EXAMPLE

function coEvents(events) {
  const src = [
    grab(/const num = \(x\) => [^\n]*\n/),
    grab(/function surprisePct\(actual, est\) \{[\s\S]*?\n\}\n/),
    grab(/function callDayWindow\(day, n\) \{[\s\S]*?\n\}\n/),
    grab(/function splitPastEarnings\(past, all\) \{[\s\S]*?\n\}\n/),
    grab(/function earningsRowToBlock\(row, callsum, callDays\) \{[\s\S]*?\n\}\n/),
    helperSrc,
    grab(/function coEventsHTML\(data\) \{[\s\S]*?\n\}\n/),
    "return coEventsHTML;",
  ].join("\n");
  const card = (b) => "[CARD " + b.ticker + " " + b.date + (b.streakTag ? " streak=" + b.streakTag : "") + "]";
  const f = new Function("todayISO", "esc", "cryptoSet", "coEvHeaderHTML", "transcriptBtnHTML", "transcriptBubbleHTML", "AIREAD_SLOT",
    "releasesSectionHTML", "earningsBlockHTML", "pastNoResultHTML", "ernSummaryKind", "transcriptExists", src)(
    () => TODAY, (s) => String(s == null ? "" : s), new Set(), () => "", () => "", () => "", () => '<div class="sc-airead"></div>',
    () => "", card, (l) => (l && l.length ? "[NORESULT " + l.map((x) => x.row.date).join(",") + "]" : ""), () => null, () => false);
  const html = f({ t: "EXA", events, _profile: {} });
  const cut = html.indexOf('<div class="sc-evpastscroll">');
  return { next: html.slice(0, cut), past: html.slice(cut) };
}

test("one rule: UPCOMING means dated today or later AND no stored result (EPS or revenue); everything else is PAST, newest first", () => {
  assert.ok(helperSrc, "ernByReportDay exists");
  const split = new Function(helperSrc + "return ernByReportDay;")();
  const rows = [row("EXA", "2026-12-10"), row("EXA", TODAY, 1.2, 110), row("EXB", TODAY, null, 90), row("EXC", TODAY),
    row("EXA", "2026-06-10", 1.1, 105), row("EXA", "2026-09-01"), null, { ticker: "EXA", date: "" }];
  const s = split(rows, TODAY);
  assert.deepEqual(s.up.map((r) => r.ticker + " " + r.date), ["EXC 2026-09-24", "EXA 2026-12-10"], "only pending rows, oldest first");
  assert.deepEqual(s.past.map((r) => r.ticker + " " + r.date), ["EXA 2026-09-24", "EXB 2026-09-24", "EXA 2026-09-01", "EXA 2026-06-10"],
    "today's results (EPS, or revenue alone) lead the past list; a past date without a result stays past (splitPastEarnings lists it apart)");
  assert.equal(split([row("EXA", TODAY, 0, null)], TODAY).past.length, 1, "a stored 0 is a stored result");
  assert.deepEqual(split(undefined, TODAY), { up: [], past: [] });
});

test("company EVENTS tab on a report day: today's stored result is under PAST EARNINGS and feeds the streak; NEXT EARNINGS is the next pending date", () => {
  const evs = [row("EXA", "2026-12-10"), row("EXA", TODAY, 1.2, 110), row("EXA", "2026-06-10", 1.1, 105), row("EXA", "2026-03-10", 1.0, 104)];
  const v = coEvents(evs);
  assert.doesNotMatch(v.next, /\[CARD EXA 2026-09-24/, "the result captured today is not presented as the next report");
  assert.match(v.next, /\[CARD EXA 2026-12-10 streak=BEAT×3\]/, "the next pending date is NEXT, and its streak reads today's quarter too");
  assert.match(v.past, /PAST EARNINGS[\s\S]*\[CARD EXA 2026-09-24\]\[CARD EXA 2026-06-10\]\[CARD EXA 2026-03-10\]/, "today's result leads PAST EARNINGS");
  const only = coEvents([row("EXA", TODAY, null, 110), row("EXA", "2026-06-10", 1.1, 105)]);
  assert.match(only.next, /NEXT EARNINGS · no scheduled date in the stored calendar/, "with nothing pending the tab says so instead of showing the result as next");
  assert.match(only.past, /\[CARD EXA 2026-09-24\]\[CARD EXA 2026-06-10\]/, "a stored revenue alone is a result");
  const pending = coEvents([row("EXA", TODAY), row("EXA", "2026-06-10", 1.1, 105)]);
  assert.match(pending.next, /\[CARD EXA 2026-09-24 streak=BEAT\]/, "a today row still waiting for its result stays NEXT (unchanged)");
});

test("the master feed uses the same rule (a stored revenue alone no longer leaves a today row under UPCOMING)", () => {
  assert.match(page, /const byDay = ernByReportDay\(up\.concat\(past\), today\);\n    EV_CACHE = \{ up: byDay\.up\.filter\(inU\), past: byDay\.past\.filter\(inU\) \};/);
  assert.doesNotMatch(page, /up\.filter\(\(e\) => e\.eps_actual == null\)/, "the EPS-only test is gone");
  assert.match(page, /const byDay = ernByReportDay\(evs, todayISO\(\)\);/, "company tab");
});

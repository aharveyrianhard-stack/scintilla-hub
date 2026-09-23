/* A MOVED EARNINGS DATE (23 Sep 2026) — the rule that stops one company appearing twice, and the
   band's new distance law. Alan: "It says eight past dates without stored results. What's up with
   that?" · "As a report comes nearer, we should apply a similar idea to the economic section."
   Everything here is the page's own bytes, extracted the way this repo's other tests do; the rows
   are REAL rows read from earnings_events on 23 Sep 2026 (read-only), not invented ones. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const take = (re) => page.match(re)[0];
const SUP = take(/const ERN_SUP_DAYS = 21;[\s\S]*?\nfunction ernSupersede\(rows, all\) \{[\s\S]*?\n\}\n/);
const sup = new Function(SUP + "return { ernSupersede, ERN_SUP_DAYS };")();

/* measured 2026-09-23: the provider moved these dates and the old row stayed behind */
const r = (ticker, date, eps_actual = null, extra = {}) =>
  ({ ticker, date, eps_actual, revenue_actual: eps_actual == null ? null : 1e9, eps_estimate: 1, report_time: "AMC", ...extra });
const REAL = [
  r("ORCL", "2026-09-08"), r("ORCL", "2026-09-10", 1.92),        // 2 days
  r("ZS", "2026-09-01"), r("ZS", "2026-09-02"), r("ZS", "2026-09-03", 1.19),
  r("SNOW", "2026-08-26"), r("SNOW", "2026-09-02", 0.62),        // 7 days
  r("CBRS", "2026-09-22"), r("CBRS", "2026-08-12", -0.04),       // 41 days — NOT the same report
  r("CTAS", "2026-09-23", 1.39),
];

test("a date the provider moved stops being offered as a report; the one that reported stays", () => {
  const live = sup.ernSupersede(REAL, REAL);
  const keys = live.map((x) => x.ticker + "@" + x.date);
  assert.ok(!keys.includes("ORCL@2026-09-08"), "ORCL's 8 Sep estimate gives way to the 10 Sep report");
  assert.ok(keys.includes("ORCL@2026-09-10"));
  assert.ok(!keys.includes("ZS@2026-09-01") && !keys.includes("ZS@2026-09-02"), "both stale ZS dates go");
  assert.ok(keys.includes("ZS@2026-09-03"));
  assert.ok(!keys.includes("SNOW@2026-08-26"));
  assert.deepEqual(keys, ["ORCL@2026-09-10", "ZS@2026-09-03", "SNOW@2026-09-02", "CBRS@2026-09-22", "CBRS@2026-08-12", "CTAS@2026-09-23"],
    "what is left: the four reports, and the one CBRS date nothing explains");
});

test("far apart is NOT the same report: 41 days is left alone and still asks to be explained", () => {
  const keys = sup.ernSupersede(REAL, REAL).map((x) => x.ticker + "@" + x.date);
  assert.ok(keys.includes("CBRS@2026-09-22"), "a quarter is ~90 days; 41 days is not a moved date and is not guessed away");
  assert.equal(sup.ERN_SUP_DAYS, 21);
});

test("a row that carries a result is never set aside by the reading rule", () => {
  /* AVGO has a result stored at BOTH 2 and 3 Sep (measured). Which one is the real date is a
     data question answered in the migration by the stored call date — never guessed on screen. */
  const avgo = [r("AVGO", "2026-09-02", 3.32), r("AVGO", "2026-09-03", 3.32)];
  assert.equal(sup.ernSupersede(avgo, avgo).length, 2, "both are kept: the page does not pick a winner");
});

test("the database decides when it can: a row stamped superseded_at never reaches the screen", () => {
  const rows = [r("MU", "2026-09-22", 1.2, { superseded_at: "2026-09-23T23:00:00Z" }), r("MU", "2026-09-30")];
  const live = sup.ernSupersede(rows, rows);
  assert.deepEqual(live.map((x) => x.date), ["2026-09-30"], "even with a result stored, the database's decision wins");
});

/* ---- the read is order-safe: it works before the migration is applied, and after ---- */
test("the read asks for live rows only, and falls back ONCE if the column is not there yet", async () => {
  const ctx = vm.createContext({ Promise, JSON });
  const asked = [];
  ctx.pg = async (path, tries) => { asked.push({ path, tries }); if (/superseded_at/.test(path)) { const e = new Error("400: column does not exist"); throw e; } return [{ ticker: "X" }]; };
  vm.runInContext(take(/const ERN_SUP_DAYS = 21;[\s\S]*?\nasync function pgErn\(path\) \{[\s\S]*?\n\}\n/) + ";", ctx);
  const first = await vm.runInContext('pgErn("earnings_events?select=ticker")', ctx);
  assert.deepEqual(first, [{ ticker: "X" }], "the rows still arrive");
  assert.equal(asked.length, 2, "one try with the filter, one without");
  assert.equal(asked[0].tries, 1, "a 400 for a missing column is NOT retried three times");
  await vm.runInContext('pgErn("earnings_events?select=ticker")', ctx);
  assert.equal(asked.length, 3, "once it knows, it never asks the missing-column question again");
  assert.ok(!/superseded_at/.test(asked[2].path));
});

/* ---- the band leans in ---- */
const BAND = page.slice(page.indexOf("/* HOW NEAR IS IT."), page.indexOf("function ernBandItems(todayIso)"));
const band = new Function(take(/const esc = \(s\) => String\(s == null \? "" : s\)\n[\s\S]*?"&#39;"\);/) + "\n" +
  take(/const num = \(x\) => [^\n]*\n/) + take(/const ERN_WD = [^\n]*\n/) + take(/const ERN_MO = [^\n]*\n/) +
  take(/const ernWeekday = [^\n]*\n/) + take(/const ernMonthDay = [^\n]*\n/) + take(/const ernNum = [^\n]*\n/) +
  take(/function ernWhen\(r\) \{[\s\S]*?\n\}\n/) + take(/function ernResult\(r\) \{[\s\S]*?\n\}\n/) +
  take(/function ernTitle\(r, res\) \{[\s\S]*?\n\}\n/) + BAND +
  "return { ernTier, ernDayGap, ernWhenLabel, ernItemHTML, ernTimeJustAnnounced, ERN_NEW_MS };")();
const TODAY = "2026-09-23";

test("the nearer the report, the more the item says — and no sooner", () => {
  const far = { ticker: "NKE", date: "2026-10-05", report_time: "AMC", eps_estimate: 0.44 };
  const wk  = { ticker: "MU", date: "2026-09-26", report_time: "AMC", eps_estimate: 31.43 };
  const tom = { ticker: "COST", date: "2026-09-24", report_time: "AMC", eps_estimate: 6.54 };
  const tdy = { ticker: "COST", date: "2026-09-23", report_time: "BMO", eps_estimate: 6.54 };
  assert.deepEqual([far, wk, tom, tdy].map((x) => band.ernTier(x, TODAY)), ["far", "week", "tomorrow", "today"]);
  assert.equal(band.ernWhenLabel(far, "far", TODAY), "IN 12 DAYS", "far off: how long, and who");
  assert.equal(band.ernWhenLabel(wk, "week", TODAY), "SAT", "inside the week: the day it lands on");
  assert.equal(band.ernWhenLabel(tom, "tomorrow", TODAY), "TOMORROW after the close");
  assert.equal(band.ernWhenLabel(tdy, "today", TODAY), "TODAY before the open");
  const h = (x) => band.ernItemHTML(x, TODAY, Date.parse("2026-09-23T23:30:00Z"));
  assert.doesNotMatch(h(far), /est /, "a name three weeks out does not carry an estimate");
  assert.doesNotMatch(h(wk), /est /);
  assert.match(h(tom), /est 6\.54/, "the day before, the estimate joins it");
  assert.match(h(tdy), /est 6\.54/);
  assert.match(h(tdy), /is-live/, "on the day, the item breathes");
  assert.doesNotMatch(h(tom), /is-live/, "and nothing else does");
});

test("once it has reported, the result is what it says — in the calendar's own colours", () => {
  const done = { ticker: "CTAS", date: "2026-09-23", report_time: "BMO", eps_actual: 1.39, eps_estimate: 1.35, surprise_pct: 2.96 };
  assert.equal(band.ernTier(done, TODAY), "reported");
  const html = band.ernItemHTML(done, TODAY, Date.now());
  assert.match(html, /ern-res beat/);
  assert.match(html, /<b>1\.39<\/b> vs est 1\.35/);
  assert.match(html, /ern-sur beat">\+3\.0%/);
  assert.doesNotMatch(html, /est 1\.35<\/span><span class="ern-est"/, "the estimate is not printed twice");
});

test("a past date with no result says so on the band instead of showing nothing", () => {
  const html = band.ernItemHTML({ ticker: "CBRS", date: "2026-09-22", report_time: null }, TODAY, Date.now());
  assert.match(html, /no result stored yet/);
  assert.match(html, /is-past/);
});

test("a report time that has just been stored is marked for a day, then goes quiet", () => {
  const now = Date.parse("2026-09-23T23:30:00Z");
  const fresh = { ticker: "COST", date: "2026-09-24", report_time: "AMC", report_time_set_at: "2026-09-23T22:59:58.330112+00:00" };
  const old = { ...fresh, report_time_set_at: "2026-09-20T22:59:58Z" };
  assert.equal(band.ernTimeJustAnnounced(fresh, now), true);
  assert.equal(band.ernTimeJustAnnounced(old, now), false, "a day later it is no longer news");
  assert.equal(band.ernTimeJustAnnounced({ ...fresh, report_time: null }, now), false, "no time, nothing to announce");
  assert.match(band.ernItemHTML(fresh, TODAY, now), /time announced/);
  assert.doesNotMatch(band.ernItemHTML(old, TODAY, now), /time announced/);
  assert.equal(band.ERN_NEW_MS, 24 * 3600e3);
});

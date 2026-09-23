/* THE EARNINGS BAND (23 Sep 2026) — the fourth band at the bottom of the Hub, beside ECON.
   Pinned here: the week it shows (Monday to Sunday in New York, opening on today), the names it shows (only the
   ones the Hub tracks), the order inside a day, the wording for when a company reports, and the promise that the
   three result colours — green, yellow, red — are worn by the result and by nothing else on the band.
   The block is VM-extracted from ../index.html the way the repo's own tests do; pg / el / document are stubs, so
   nothing here reaches a network or a browser. The rows are a CAPTURED fixture of this week's real earnings
   (tests/fixtures/earnings-week-20260921.json), not invented data. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const plain = (x) => JSON.parse(JSON.stringify(x));   // values cross a VM realm: compare their content

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const START = "/* ============================================================================\n   THE EARNINGS BAND";
const END = "/* ---- tapes ---";
assert.ok(page.indexOf(START) > 0 && page.indexOf(END) > page.indexOf(START), "the earnings band block is in the page");
const mod = page.slice(page.indexOf(START), page.indexOf(END));
const escSrc = page.match(/const esc = \(s\) => [\s\S]*?;\n/)[0];
const numSrc = page.match(/const num = \(x\) => [^\n]*\n/)[0];
const FIX = JSON.parse(fs.readFileSync(new URL("./fixtures/earnings-week-20260921.json", import.meta.url), "utf8")).rows;

const EXPORTS = ["ernWeek", "ernShift", "ernWeekday", "ernMonthDay", "ernWhen", "ernResult", "ernItemHTML",
  "ernBandItems", "ernBandHTML", "ernRead", "renderErnBand", "ERN_BAND_ON", "ERN_TTL_MS"];
function load({ rows = null, universe = ["CTAS", "COST", "CBRS"], pg = async () => [], today = "2026-09-23" } = {}) {
  const asked = [];
  const slot = { id: "ernBandSlot", innerHTML: "", querySelector: () => null };
  const ctx = vm.createContext({
    console, setInterval: () => 1, setTimeout,
    document: { visibilityState: "visible", addEventListener: () => {} },
    el: (id) => (id === "ernBandSlot" ? slot : null),
    tapeSpeed: () => {},
    UNIVERSE: universe ? new Set(universe) : null,
    todayISO: () => today,
    pg: async (path) => { asked.push(path); return pg(path); },
  });
  const api = vm.runInContext(escSrc + numSrc + mod + "\n;({" + EXPORTS.join(",") +
    ", get ERN_ROWS() { return ERN_ROWS; }, set ERN_ROWS(v) { ERN_ROWS = v; }," +
    " get UNIVERSE() { return UNIVERSE; } })", ctx);
  if (rows !== null) api.ERN_ROWS = rows;
  return { api, asked, slot };
}
const row = (o) => ({ ticker: "AAA", date: "2026-09-23", report_time: null, eps_actual: null, eps_estimate: null, surprise_pct: null, ...o });

test("the week is Monday to Sunday in New York, and Sunday belongs to the week that just ended", () => {
  const { api } = load();
  assert.deepEqual(plain(api.ernWeek("2026-09-23")), ["2026-09-21","2026-09-22","2026-09-23","2026-09-24","2026-09-25","2026-09-26","2026-09-27"]);
  assert.equal(api.ernWeek("2026-09-21")[0], "2026-09-21", "Monday opens its own week");
  assert.equal(api.ernWeek("2026-09-27")[0], "2026-09-21", "Sunday still shows the week it closes");
  assert.equal(api.ernWeek("2026-09-28")[0], "2026-09-28", "the next Monday starts the next week");
});

test("only the names the Hub tracks ride the band, and only this week", () => {
  const { api } = load({ rows: [...FIX, row({ ticker: "NOTINUNIV", date: "2026-09-24" }), row({ ticker: "CTAS", date: "2026-10-05" })],
                         universe: FIX.map((r) => r.ticker) });
  const items = api.ernBandItems("2026-09-23");
  assert.deepEqual(plain(items.map((r) => r.ticker + "@" + r.date)), FIX.map((r) => r.ticker + "@" + r.date));
  assert.ok(!items.some((r) => r.ticker === "NOTINUNIV"), "a name the Hub does not track never appears");
  assert.ok(!items.some((r) => r.date > "2026-09-27"), "next month's report is not this week's band");
});

test("inside a day: before the open, then a given time, then after the close, then the ones with no time", () => {
  const { api } = load({ rows: [
    row({ ticker: "DDD", date: "2026-09-24", report_time: null }),
    row({ ticker: "CCC", date: "2026-09-24", report_time: "AMC" }),
    row({ ticker: "BBB", date: "2026-09-24", report_time: "16:05" }),
    row({ ticker: "AAA", date: "2026-09-24", report_time: "BMO" }),
    row({ ticker: "ZZZ", date: "2026-09-22", report_time: "BMO" }),
  ], universe: ["AAA","BBB","CCC","DDD","ZZZ"] });
  assert.deepEqual(plain(api.ernBandItems("2026-09-23").map((r) => r.ticker)), ["ZZZ","AAA","BBB","CCC","DDD"]);
});

test("when a company reports is said in plain words, and an unknown time says nothing", () => {
  const { api } = load();
  assert.equal(api.ernWhen({ report_time: "BMO" }), "before the open");
  assert.equal(api.ernWhen({ report_time: "amc" }), "after the close");
  assert.equal(api.ernWhen({ report_time: "16:05" }), "16:05");
  assert.equal(api.ernWhen({ report_time: null }), "", "nothing known, nothing claimed");
});

test("a reported name carries EPS against the estimate and the surprise; green, yellow and red are the result's alone", () => {
  const { api } = load();
  const ctas = FIX.find((r) => r.eps_actual != null);
  assert.ok(ctas, "this week's fixture contains a company that has reported");
  const res = api.ernResult(ctas);
  assert.equal(res.cls, "beat");
  const html = api.ernItemHTML(ctas, "2026-09-23");
  assert.match(html, /ern-res beat/);
  assert.match(html, /vs est/);
  assert.match(html, /ern-sur beat/);
  assert.match(html, /\+3\.0%/);
  /* the three colour classes appear only inside the result and the surprise */
  for (const m of html.match(/class="[^"]*"/g)) {
    if (/beat|miss|inline/.test(m)) assert.match(m, /ern-(res|sur)/, "a result colour on something that is not the result: " + m);
  }
  assert.equal(api.ernResult({ eps_actual: 1.0, eps_estimate: 1.2 }).cls, "miss");
  assert.equal(api.ernResult({ eps_actual: 1.2, eps_estimate: 1.2 }).cls, "inline");
  assert.equal(api.ernResult({ eps_actual: null, eps_estimate: 1.2 }), null, "nothing reported, nothing shown");
});

test("a name still to report shows day, time and ticker and no numbers at all", () => {
  const { api } = load();
  const cost = FIX.find((r) => r.ticker === "COST");
  const html = api.ernItemHTML(cost, "2026-09-23");
  assert.match(html, /ern-tk">COST/);
  assert.ok(!/ern-res|ern-sur|vs est/.test(html), "no estimate is dressed up as a result");
  assert.match(html, /is-up/);
});

test("today is named TODAY and a day already gone is faded", () => {
  const { api } = load();
  assert.match(api.ernItemHTML(row({ ticker: "AAA", date: "2026-09-23" }), "2026-09-23"), /is-today[\s\S]*TODAY/);
  assert.match(api.ernItemHTML(row({ ticker: "AAA", date: "2026-09-22" }), "2026-09-23"), /ern-it is-past/);
  assert.match(api.ernItemHTML(row({ ticker: "AAA", date: "2026-09-24" }), "2026-09-23"), /ern-it is-up/);
});

test("the band is the same tape part as the bands above it, labelled EARNINGS", () => {
  const { api } = load({ rows: FIX });
  const html = api.ernBandHTML("2026-09-23");
  assert.match(html, /class="sc-tape sc-tape--ern"/);
  assert.match(html, /sc-tape__lbl">EARNINGS →/);
  assert.match(html, /sc-tape__track/);
  assert.match(html, /WEEK OF SEP 21/);
  assert.equal((html.match(/data-t="CTAS"/g) || []).length, 2, "the track is doubled so the marquee loops seamlessly");
});

test("an empty week says so, and a failed read does not pretend the week is empty", () => {
  const { api } = load({ rows: [] });
  assert.match(api.ernBandHTML("2026-09-23"), /no earnings this week for the names you track/);
  const cold = load({ rows: null });
  assert.match(cold.api.ernBandHTML("2026-09-23"), /reading this week's earnings…/);
});

test("the read asks for this week only, from the events room's own table, and writes nothing", async () => {
  const { api, asked } = load({ rows: null, universe: null, pg: async (p) => (p.startsWith("cohorts") ? [{ ticker: "CTAS" }] : FIX) });
  await api.ernRead();
  const ern = asked.find((p) => p.startsWith("earnings_events"));
  assert.ok(ern, "it reads earnings_events");
  assert.match(ern, /date=gte\.2026-09-21/);
  assert.match(ern, /date=lte\.2026-09-27/);
  assert.ok(!/insert|upsert|rpc/i.test(asked.join("|")), "nothing is written anywhere");
  assert.deepEqual(plain(api.ERN_ROWS.map((r) => r.ticker)), ["CTAS"], "rows outside the tracked names are dropped after the read");
});

test("one read per ten minutes, and the rollback is one word", () => {
  const { api } = load();
  assert.equal(api.ERN_TTL_MS, 600000);
  assert.equal(api.ERN_BAND_ON, true);
  assert.match(page, /const ERN_BAND_ON = true;/);
});

/* M42 — the detectors. What is pinned here is the promise the stored table makes: a scintilla is a
   move measured against the SUBJECT'S OWN history, a thin history produces NO row and a stated
   reason, and running a detector twice cannot produce two rows for one occurrence. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  detectPriceOutliers, detectEarningsSurprises, detectEconSurprises, detectEconImminent,
  dailyReturnsPct, stdev, zScore, volZ, surprisePct, econReading, econRoomClass, econEventKey,
  MIN_ABS_Z, PRICE_MIN_HISTORY, SURPRISE_MIN_HISTORY, EC_INVERT,
} from "../scripts/scintillas-detect.mjs";

const TS = "2026-09-23T20:05:00.000Z";
const SESSION = "2026-09-23";
/* a name that moves 1% a day, in both directions so the average is ~0 */
const steadyBars = (n = 40, step = 1) => {
  const out = [{ c: 100 }];
  for (let i = 1; i < n; i++) out.push({ c: +(out[i - 1].c * (1 + (i % 2 ? step : -step) / 100)).toFixed(4) });
  return out;
};
const reasons = (skipped) => skipped.map((s) => s.reason);

test("the maths is the stated maths: sample spread, and a day over its own volatility", () => {
  assert.equal(stdev([1]), null, "one observation has no spread — never a z from a single point");
  assert.equal(stdev([2, 4, 4, 4, 5, 5, 7, 9]).toFixed(4), (2.1381).toFixed(4), "n-1, not n");
  assert.equal(zScore(10, [1, 1, 1]), null, "a flat history cannot rank anything");
  /* [1,1,-1,-1,0] has mean 0 and sample spread exactly 1, so the arithmetic is readable by eye */
  assert.equal(stdev([1, 1, -1, -1, 0]), 1);
  assert.equal(volZ(2, [1, 1, -1, -1, 0]), 2, "2% against a 1% daily volatility is a two-sigma day");
  assert.equal(volZ(2, [1, -1, 1, -1]).toFixed(4), (1.7321).toFixed(4), "alternating +-1 has a spread of 1.15, not 1");
  assert.deepEqual(dailyReturnsPct([{ c: 100 }, { c: 101 }, { c: 99.99 }]).map((x) => +x.toFixed(4)), [1, -1]);
  assert.equal(dailyReturnsPct([{ c: 0 }, { c: 5 }]).length, 0, "a zero or missing close is dropped, not divided by");
  assert.ok(Math.abs(surprisePct(1.1, 1) - 10) < 1e-9, "a 1.10 against a 1.00 estimate is a 10% surprise");
  assert.ok(Math.abs(surprisePct(0.9, -1) - 190) < 1e-9, "the estimate's SIZE is the denominator: 0.9 against an estimate of -1 is a beat, not a miss");
  assert.equal(surprisePct(1, 0), null, "a zero estimate has no percentage surprise");
});

test("an outlier of the day is the move divided by the name's own volatility", () => {
  const quotes = [{ symbol: "QUIET", price: 103, prev_close: 100 }, { symbol: "WILD", price: 103, prev_close: 100 }];
  const { events, skipped } = detectPriceOutliers({
    quotes, session: SESSION, ts: TS,
    historyBySymbol: { QUIET: steadyBars(40, 1), WILD: steadyBars(40, 4) },
  });
  assert.equal(events.length, 1, "the same +3% is a scintilla on the quiet name and ordinary on the wild one");
  assert.equal(events[0].subject, "QUIET");
  assert.equal(events[0].direction, 1);
  assert.ok(events[0].magnitude >= MIN_ABS_Z, "magnitude is |z|, at or above the threshold");
  assert.deepEqual(reasons(skipped), ["BELOW_THRESHOLD"]);
  const d = events[0].detail;
  assert.equal(d.session, SESSION);
  assert.ok(d.move_pct > 2.99 && d.move_pct < 3.01);
  assert.ok(d.daily_vol_pct > 0 && d.n_days >= PRICE_MIN_HISTORY, "the inputs are stored so the row can be recomputed");
  assert.equal(events[0].dedupe_key, "price_outlier|QUIET|2026-09-23");
});

test("a fall glows down, and the same day detected twice carries one key", () => {
  const args = { quotes: [{ symbol: "QUIET", price: 97, prev_close: 100 }], session: SESSION, ts: TS,
                 historyBySymbol: { QUIET: steadyBars(40, 1) } };
  const a = detectPriceOutliers(args), b = detectPriceOutliers({ ...args, ts: "2026-09-23T20:15:00.000Z" });
  assert.equal(a.events[0].direction, -1);
  assert.ok(a.events[0].magnitude > 0, "magnitude is a size; the sign lives in direction");
  assert.equal(a.events[0].dedupe_key, b.events[0].dedupe_key, "a second pass in the same session cannot add a second row");
});

test("no history, no scintilla — and the reason is stated, not guessed", () => {
  const { events, skipped } = detectPriceOutliers({
    quotes: [{ symbol: "NEW", price: 130, prev_close: 100 }, { symbol: "FLAT", price: 130, prev_close: 100 },
             { symbol: "NOBASE", price: 130, prev_close: null }],
    session: SESSION, ts: TS,
    historyBySymbol: { NEW: steadyBars(8, 1), FLAT: Array.from({ length: 40 }, () => ({ c: 100 })) },
  });
  assert.equal(events.length, 0, "a 30% move on a name with no history is still not a measured scintilla");
  assert.deepEqual(reasons(skipped).sort(), ["FLAT_HISTORY", "NO_PREV_CLOSE", "SHORT_HISTORY"]);
  assert.equal(skipped.find((s) => s.reason === "SHORT_HISTORY").n, 7);
});

test("earnings: the surprise is judged against the name's OWN past surprises", () => {
  const past = (pcts) => pcts.map((p, i) => ({ date: "2025-0" + (i + 1) + "-15", eps_actual: 1 + p / 100, eps_estimate: 1 }));
  const rows = [{ ticker: "STEADY", date: SESSION, eps_actual: 1.3, eps_estimate: 1 },
                { ticker: "NOISY", date: SESSION, eps_actual: 1.3, eps_estimate: 1 }];
  const { events, skipped } = detectEarningsSurprises({
    rows, ts: TS,
    historyByTicker: { STEADY: past([1, -1, 2, -2, 1, 0]), NOISY: past([30, -25, 40, -35, 20, -20]) },
  });
  assert.deepEqual(events.map((e) => e.subject), ["STEADY"], "a 30% beat is huge for a name that usually lands within 2%");
  assert.equal(events[0].kind, "earnings_surprise");
  assert.equal(events[0].direction, 1);
  assert.equal(events[0].detail.measure, "eps");
  assert.equal(events[0].detail.beat, true);
  assert.ok(events[0].detail.measures.find((m) => m.name === "eps").n >= SURPRISE_MIN_HISTORY);
  assert.equal(events[0].dedupe_key, "earnings_surprise|STEADY|2026-09-23");
  assert.deepEqual(reasons(skipped), ["BELOW_THRESHOLD"]);
});

test("earnings: revenue can be the louder surprise, and a thin history stays silent", () => {
  /* both measures need a history with SPREAD — a name that surprised by exactly the same amount
     every quarter has no usual spread, and the detector refuses to rank against it (tested below). */
  const EPS = [4, -3, 5, -4, 3, -2], REV = [0.4, -0.3, 0.5, -0.4, 0.3, -0.2];
  const hist = EPS.map((e, i) => ({ date: "2025-0" + (i + 1) + "-15",
    eps_actual: 1 + e / 100, eps_estimate: 1, revenue_actual: 100 * (1 + REV[i] / 100), revenue_estimate: 100 }));
  const { events } = detectEarningsSurprises({
    rows: [{ ticker: "REV", date: SESSION, eps_actual: 1.05, eps_estimate: 1, revenue_actual: 103, revenue_estimate: 100 }],
    historyByTicker: { REV: hist }, ts: TS,
  });
  assert.equal(events[0].detail.measure, "revenue", "the louder of the two measures is the scintilla");
  assert.equal(events[0].detail.measures.length, 2, "both measures are kept in detail either way");
  assert.ok(Math.abs(events[0].detail.measures.find((m) => m.name === "eps").z) <
            Math.abs(events[0].detail.measures.find((m) => m.name === "revenue").z),
    "a 5% EPS beat is ordinary for this name; a 3% revenue beat is ten times its usual");

  const flat = detectEarningsSurprises({
    rows: [{ ticker: "SAME", date: SESSION, eps_actual: 2, eps_estimate: 1 }],
    historyByTicker: { SAME: Array.from({ length: 6 }, (_, i) => ({ date: "2025-0" + (i + 1) + "-15", eps_actual: 1.01, eps_estimate: 1 })) },
    ts: TS });
  assert.equal(flat.events.length, 0);
  assert.equal(flat.skipped[0].reason, "FLAT_HISTORY", "an unvarying past surprise gives nothing to rank against");

  const thin = detectEarningsSurprises({
    rows: [{ ticker: "IPO", date: SESSION, eps_actual: 2, eps_estimate: 1 }],
    historyByTicker: { IPO: hist.slice(0, 2) }, ts: TS,
  });
  assert.equal(thin.events.length, 0);
  assert.equal(thin.skipped[0].reason, "SHORT_HISTORY");
  const noEst = detectEarningsSurprises({ rows: [{ ticker: "X", date: SESSION, eps_actual: 2 }], historyByTicker: {}, ts: TS });
  assert.equal(noEst.skipped[0].reason, "NO_ESTIMATE_OR_ACTUAL", "no estimate means no surprise to measure");
});

test("an economic surprise reads hot or cool the way the room paints it", () => {
  const cpiPast = Array.from({ length: 8 }, (_, i) => ({ actual: 3 + (i % 2 ? 0.1 : -0.1), estimate: 3 }));
  const rows = [{ event_ts: "2026-09-23T12:30:00Z", country: "US", event: "Core CPI (Sep)", actual: 3.9, estimate: 3, impact: "High" },
                { event_ts: "2026-09-23T14:00:00Z", country: "US", event: "Existing Home Sales (Aug)", actual: 4.1, estimate: 4, impact: "Medium" }];
  const { events, skipped } = detectEconSurprises({
    rows, ts: TS,
    historyByEvent: { [econEventKey("US", "Core CPI")]: cpiPast,
                      [econEventKey("US", "Existing Home Sales")]: [0.4, -0.3, 0.5, -0.4, 0.3, -0.2, 0.45, -0.35]
                        .map((d) => ({ actual: 4 + d, estimate: 4 })) },
  });
  assert.deepEqual(events.map((e) => e.subject), ["Core CPI"], "the period tag is dropped; the release is the subject");
  assert.equal(events[0].subject_kind, "event");
  assert.equal(events[0].direction, 1, "direction is the plain sign of actual − estimate");
  assert.equal(events[0].detail.reading, "adverse", "hotter inflation than expected is the ADVERSE kind of surprise");
  assert.equal(events[0].detail.room_class, "up", "the room's own class is stored, so the glow lights the room's colour (red)");
  assert.equal(events[0].detail.n_prints, 8);
  assert.equal(events[0].dedupe_key, "econ_surprise|US|core cpi|2026-09-23T12:30:00Z");
  assert.ok(reasons(skipped).includes("BELOW_THRESHOLD"));
  assert.equal(econReading("Core CPI (Sep)", -0.9), "favourable", "cooler inflation is the green kind");
  assert.equal(econReading("Retail Sales", 0.9), "favourable", "stronger sales is green in this room");
  assert.equal(econReading("Initial Jobless Claims", 12), "adverse", "more claims than expected is red");
  assert.equal(econReading("Retail Sales", 0), "in line");
  assert.equal(econRoomClass("Core CPI", 0.9), "up");
  assert.equal(econRoomClass("Retail Sales", 0.9), "dn");
  assert.equal(econRoomClass("Retail Sales", 0), "flat");
  const notYet = detectEconSurprises({ rows: [{ country: "US", event: "GDP", estimate: 2, event_ts: "2026-09-23T12:30:00Z" }], historyByEvent: {}, ts: TS });
  assert.equal(notYet.skipped[0].reason, "NOT_PRINTED");
});

test("the invert rule is the Hub's own rule, letter for letter", () => {
  const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const hub = page.match(/^const EC_INVERT = (\/.*\/i);$/m);
  assert.ok(hub, "index.html still declares EC_INVERT");
  assert.equal(EC_INVERT.source, new RegExp(hub[1].slice(1, -2), "i").source,
    "a stored scintilla and the Economic room must never disagree about which way is hot");
});

test("imminent is the fifteen minutes before a release, and nothing that already printed", () => {
  const nowSec = Math.floor(Date.parse("2026-09-23T12:20:00Z") / 1000);
  const rows = [
    { event_ts: "2026-09-23T12:30:00Z", country: "US", event: "Core CPI (Sep)", estimate: 3, previous: 2.9, impact: "High" },
    { event_ts: "2026-09-23T13:30:00Z", country: "US", event: "Fed Chair Speaks", impact: "High" },
    { event_ts: "2026-09-23T12:25:00Z", country: "US", event: "Jobless Claims", actual: 230, estimate: 225, impact: "High" },
    { event_ts: "2026-09-23T12:28:00Z", country: "US", event: "Crude Inventories", impact: "Low" },
    { event_ts: "2026-09-23T12:10:00Z", country: "US", event: "Housing Starts", impact: "High" },
  ];
  const { events, skipped } = detectEconImminent({ rows, nowSec, ts: TS });
  assert.deepEqual(events.map((e) => e.subject), ["Core CPI"]);
  assert.equal(events[0].kind, "econ_imminent");
  assert.equal(events[0].direction, 0);
  assert.equal(events[0].magnitude, null, "nothing has printed, so there is no z to state");
  assert.equal(events[0].detail.minutes_to, 10);
  assert.equal(events[0].dedupe_key, "econ_imminent|US|core cpi|2026-09-23T12:30:00Z");
  assert.deepEqual(reasons(skipped).sort(), ["ALREADY_PRINTED", "DUE_OR_PAST", "IMPACT_NOT_TRACKED", "NOT_YET_IMMINENT"]);
});

test("the edge function runs the same detectors this test ran, byte for byte", () => {
  const a = fs.readFileSync(new URL("../scripts/scintillas-detect.mjs", import.meta.url));
  const b = fs.readFileSync(new URL("../supabase/functions/scintillas-detect/detect.mjs", import.meta.url));
  assert.ok(a.equals(b), "the function's copy of the detectors must be identical to the tested module");
  const fn = fs.readFileSync(new URL("../supabase/functions/scintillas-detect/index.ts", import.meta.url), "utf8");
  assert.match(fn, /from "\.\/detect\.mjs"/);
  assert.match(fn, /on_conflict=dedupe_key/, "the insert must be idempotent on the dedupe key");
  assert.match(fn, /resolution=ignore-duplicates/);
  assert.ok(!/SUPABASE_SERVICE_ROLE_KEY\s*\)\s*!\s*;[\s\S]{0,400}console\.log/.test(fn), "no key is ever printed");
  for (const t of ["scintillas"]) assert.ok(fn.includes(t));
  assert.ok(!/(update|delete|patch)\s*\(?\s*['"`]?\/rest\/v1\/(live_quotes|ohlcv_history|earnings_events|econ_calendar)/i.test(fn),
    "the function writes to public.scintillas and to nothing else");
});

test("the migration is additive, reads publicly, and states its rollback", () => {
  const sql = fs.readFileSync(new URL("../supabase/migrations/20260924_scintillas.sql", import.meta.url), "utf8");
  assert.match(sql, /create table if not exists public\.scintillas/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /for select using \(true\)/);
  assert.match(sql, /revoke insert, update, delete on public\.scintillas from anon, authenticated/);
  assert.match(sql, /create unique index if not exists scintillas_dedupe_uidx/);
  assert.match(sql, /ROLLBACK \(exact\):/);
  assert.ok(!/drop table (?!if exists public\.scintillas)/.test(sql.replace(/^--.*$/gm, "")), "no other table is dropped");
  const rb = fs.readFileSync(new URL("../supabase/migrations/20260924_scintillas_ROLLBACK.sql", import.meta.url), "utf8");
  assert.match(rb, /drop table if exists public\.scintillas/);
  const cron = fs.readFileSync(new URL("../supabase/migrations/20260924_scintillas_cron.sql", import.meta.url), "utf8");
  assert.match(cron, /cron\.schedule\('scintillas-detect-intraday'/);
  assert.match(cron, /cron\.schedule\('scintillas-detect-session'/);
  assert.ok(!/eyJ|service_role_key\s*:=\s*'/.test(cron), "no key value in the migration");
});

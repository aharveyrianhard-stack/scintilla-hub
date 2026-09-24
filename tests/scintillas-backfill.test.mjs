/* M68 — the backfill writes the same kind of row the live detector writes, judged by a usual day
   that never contains the day being judged, and can be run twice without leaving two rows. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  backfillSymbol, planBatch, perDayByClass, usualAsOf, sessionCloseUtcISO, ageInDays,
  BACKFILL_FIRST_SESSION, BACKFILL_VERSION,
} from "../scripts/scintillas-backfill.mjs";
import { detectPriceOutliers } from "../scripts/scintillas-detect.mjs";

const RULES = JSON.parse(fs.readFileSync(new URL("../data/scintilla-rules.json", import.meta.url), "utf8"));
const detect = detectPriceOutliers;

/* a quiet name: 60 sessions of ±0.2% ending 2024-10-15, then whatever the test adds */
function quietBars(lastMove = 0, n = 60, start = "2024-07-22") {
  const bars = []; let c = 100; const d = new Date(start + "T00:00:00Z");
  for (let i = 0; i < n; i++) {
    c *= 1 + (i % 2 ? 0.002 : -0.002);
    bars.push({ d: d.toISOString().slice(0, 10), o: c, h: c * 1.001, l: c * 0.999, c, v: 1 });
    d.setUTCDate(d.getUTCDate() + (d.getUTCDay() === 5 ? 3 : 1));
  }
  if (lastMove) {
    const prev = bars.at(-1).c, nc = prev * (1 + lastMove);
    bars.push({ d: d.toISOString().slice(0, 10), o: prev, h: Math.max(prev, nc), l: Math.min(prev, nc), c: nc, v: 1 });
  }
  return bars;
}

test("a backfilled event is the live row's twin: same dedupe key, plus backfilled = true", () => {
  const bars = quietBars(0.09);
  const session = bars.at(-1).d;
  const { events } = backfillSymbol({ detect, symbol: "TEST", bars, from: session, rules: RULES,
    heartbeat: [{ date: bars.at(-2).d, usual_day_60: 0.2, n: 60 }] });
  assert.equal(events.length, 1);
  const e = events[0];
  assert.equal(e.dedupe_key, "price_outlier|TEST|" + session);
  assert.equal(e.kind, "price_outlier");
  assert.equal(e.detail.backfilled, true);
  assert.equal(e.detail.backfill_version, BACKFILL_VERSION);
  assert.equal(e.direction, 1);
  assert.deepEqual(e.detail.fired, ["statistical", "raw"]);
  assert.equal(e.detail.session, session);
});

test("the usual day is the row BEFORE the session, never the session's own row", () => {
  const bars = quietBars(0.03);                       // 3%: fires only if the divisor is small
  const session = bars.at(-1).d, prior = bars.at(-2).d;
  /* the session's own row is enormous (it contains the 3% day). If the backfill used it, 3% would
     be under 2x and nothing would fire. Using the prior row, 3% is 15x a 0.2% day. */
  const heartbeat = [{ date: prior, usual_day_60: 0.2, n: 60 }, { date: session, usual_day_60: 3.5, n: 60 }];
  const { events } = backfillSymbol({ detect, symbol: "TEST", bars, from: session, rules: RULES, heartbeat });
  assert.equal(events.length, 1, "the prior row must be the divisor");
  assert.equal(events[0].detail.usual_as_of, prior);
  assert.equal(events[0].detail.daily_vol_pct, 0.2);
  assert.equal(events[0].detail.stored_usual_used, true);
  assert.match(events[0].detail.usual_source, /ticker_heartbeat_daily:/);
  assert.equal(usualAsOf(heartbeat, session).date, prior);
  assert.equal(usualAsOf(heartbeat, prior), null, "with only its own row, a session has no eligible divisor");
});

test("no lookahead: sessions after the event cannot change its verdict", () => {
  const bars = quietBars(0.09);
  const session = bars.at(-1).d;
  const one = backfillSymbol({ detect, symbol: "TEST", bars, from: session, to: session, rules: RULES });
  const withFuture = quietBars(0.09);
  let c = withFuture.at(-1).c;
  const d = new Date(session + "T00:00:00Z");
  for (let i = 0; i < 10; i++) {                      // ten wild days AFTER the session
    d.setUTCDate(d.getUTCDate() + 1); c *= 1.12;
    withFuture.push({ d: d.toISOString().slice(0, 10), o: c, h: c, l: c, c, v: 1 });
  }
  const two = backfillSymbol({ detect, symbol: "TEST", bars: withFuture, from: session, to: session, rules: RULES });
  assert.deepEqual(two.events, one.events);
});

test("running it twice produces the same rows, so the insert leaves one", () => {
  const bars = quietBars(0.09);
  const args = { detect, symbol: "TEST", bars, from: BACKFILL_FIRST_SESSION, rules: RULES };
  const a = backfillSymbol(args), b = backfillSymbol(args);
  assert.deepEqual(b.events, a.events);
  const keys = a.events.map((e) => e.dedupe_key);
  assert.equal(new Set(keys).size, keys.length, "one key per session");
});

test("with no stored usual day it computes one from earlier bars only, and says so", () => {
  const bars = quietBars(0.09);
  const session = bars.at(-1).d;
  const { events } = backfillSymbol({ detect, symbol: "TEST", bars, from: session, rules: RULES, heartbeat: [] });
  assert.equal(events.length, 1);
  assert.equal(events[0].detail.stored_usual_used, false);
  assert.equal(events[0].detail.usual_as_of, null);
  assert.match(events[0].detail.usual_source, /computed here from \d+ sessions/);
});

test("a stale divisor is not used: a heartbeat row more than a fortnight old falls back to the bars", () => {
  const bars = quietBars(0.09);
  const session = bars.at(-1).d;
  const old = new Date(Date.parse(session + "T00:00:00Z") - 40 * 86400e3).toISOString().slice(0, 10);
  const { events } = backfillSymbol({ detect, symbol: "TEST", bars, from: session, rules: RULES,
    heartbeat: [{ date: old, usual_day_60: 0.2, n: 60 }] });
  assert.equal(events[0].detail.stored_usual_used, false);
  assert.equal(ageInDays(old, session), 40);
});

test("too little history means no event and a stated reason, never a guess", () => {
  const bars = quietBars(0.09, 10);                    // 10 sessions: under the 20-session minimum
  const session = bars.at(-1).d;
  const out = backfillSymbol({ detect, symbol: "TEST", bars, from: session, rules: RULES });
  assert.equal(out.events.length, 0);
  assert.equal(out.skipped.at(-1).reason, "SHORT_HISTORY");
  assert.equal(out.skipped.at(-1).session, session);
});

test("the backfill adds no rule of its own: its events equal the detector's on the same inputs", () => {
  const bars = quietBars(0.09);
  const session = bars.at(-1).d;
  const hb = { date: bars.at(-2).d, usual_day_60: 0.2, n: 60 };
  const mine = backfillSymbol({ detect, symbol: "TEST", bars, from: session, rules: RULES, heartbeat: [hb] }).events[0];
  const theirs = detectPriceOutliers({
    quotes: [{ symbol: "TEST", price: bars.at(-1).c, prev_close: bars.at(-2).c }],
    historyBySymbol: { TEST: bars.slice(0, -1) }, session, ts: sessionCloseUtcISO(session),
    rules: RULES, source: "chart-api:/candles?tf=1d (backfill)", heartbeatBySymbol: { TEST: hb },
  }).events[0];
  assert.equal(mine.magnitude, theirs.magnitude);
  assert.equal(mine.dedupe_key, theirs.dedupe_key);
  assert.deepEqual(mine.detail.thresholds, theirs.detail.thresholds);
  assert.equal(mine.detail.rule, theirs.detail.rule);
});

test("a stored row sits at the session's own close, summer and winter", () => {
  assert.equal(sessionCloseUtcISO("2026-06-15"), "2026-06-15T20:00:00.000Z"); // EDT
  assert.equal(sessionCloseUtcISO("2026-01-15"), "2026-01-15T21:00:00.000Z"); // EST
});

test("batching covers every name exactly once and says where to resume", () => {
  const symbols = Array.from({ length: 97 }, (_, i) => "S" + String(i).padStart(3, "0"));
  const seen = [];
  let cursor = 0, guard = 0;
  for (;;) {
    const p = planBatch(symbols, cursor, 25);
    seen.push(...p.batch);
    assert.equal(p.total, 97);
    if (p.next == null) break;
    cursor = p.next;
    if (++guard > 10) throw new Error("did not finish");
  }
  assert.equal(seen.length, 97);
  assert.equal(new Set(seen).size, 97);
  assert.deepEqual(seen, [...symbols].sort());
  assert.deepEqual(planBatch(symbols, 0, 25).batch, planBatch(symbols, 0, 25).batch, "a resumed run repeats the same slice");
});

test("the run reports its own counts per asset class", () => {
  const events = [
    { direction: 1, detail: { session: "2025-01-02", asset_class: "equity", fired: ["raw"] } },
    { direction: -1, detail: { session: "2025-01-02", asset_class: "equity", fired: ["statistical", "raw"] } },
    { direction: 1, detail: { session: "2025-01-03", asset_class: "index_etf", fired: ["statistical"] } },
  ];
  const c = perDayByClass(events, 2);
  assert.equal(c.total, 3);
  assert.equal(c.per_day, 1.5);
  assert.equal(c.by_class.equity.events, 2);
  assert.equal(c.by_class.equity.both, 1);
  assert.equal(c.by_class.equity.up, 1);
  assert.equal(c.by_class.index_etf.statistical, 1);
});

test("the edge function ships this file byte for byte, and wires the mode", () => {
  const a = fs.readFileSync(new URL("../scripts/scintillas-backfill.mjs", import.meta.url));
  const b = fs.readFileSync(new URL("../supabase/functions/scintillas-detect/backfill.mjs", import.meta.url));
  assert.ok(a.equals(b), "scripts/scintillas-backfill.mjs and the function's backfill.mjs must be identical");
  const fn = fs.readFileSync(new URL("../supabase/functions/scintillas-detect/index.ts", import.meta.url), "utf8");
  assert.match(fn, /mode=backfill/);
  assert.match(fn, /from "\.\/backfill\.mjs"/);
  assert.match(fn, /resolution=ignore-duplicates/, "the backfill must never displace a live row");
  assert.ok(!/delete|update/i.test(fn.split("async function runBackfill")[1].split("Deno.serve")[0]),
    "the backfill only inserts");
});

test("the migration is additive and has an exact rollback", () => {
  const sql = fs.readFileSync(new URL("../supabase/migrations/20260924_scintillas_backfill.sql", import.meta.url), "utf8");
  assert.match(sql, /create index if not exists scintillas_session_idx/);
  assert.match(sql, /create or replace view public\.scintilla_breadth_daily/);
  assert.ok(!/drop table|delete from|alter table .* drop/i.test(sql), "nothing is dropped or deleted");
  const rb = fs.readFileSync(new URL("../supabase/migrations/20260924_scintillas_backfill_ROLLBACK.sql", import.meta.url), "utf8");
  assert.match(rb, /drop view  if exists public\.scintilla_breadth_daily/);
  assert.match(rb, /drop index if exists public\.scintillas_session_idx/);
  assert.ok(!/^\s*delete from/im.test(rb), "the rollback must not delete stored events");
});

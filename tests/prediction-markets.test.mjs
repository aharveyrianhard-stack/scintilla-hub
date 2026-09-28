// L4 prediction markets (28 Sep 2026): the collector's pure logic, the topic registry, the migrations,
// and the master-tab page's maths.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as L from "../supabase/functions/prediction-markets/lib.ts";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const REG = JSON.parse(read("supabase/functions/prediction-markets/topics.json"));
const LIM = REG.limits;
const topic = (id) => REG.topics.find((t) => t.id === id);

test("Kalshi price: a tight two-sided quote wins over a stale last trade", () => {
  assert.equal(L.kalshiPrice({ yes_bid_dollars: "0.7000", yes_ask_dollars: "0.7100", last_price_dollars: "0.5000" }), 0.705);
  // wide book (more than 10 cents): fall back to the last trade
  assert.equal(L.kalshiPrice({ yes_bid_dollars: "0.2000", yes_ask_dollars: "0.6000", last_price_dollars: "0.4500" }), 0.45);
  // one-sided and never traded: no price, never a guess
  assert.equal(L.kalshiPrice({ yes_bid_dollars: "0.0000", yes_ask_dollars: "0.0100", last_price_dollars: "0.0000" }), null);
});

test("Polymarket Yes leg: JSON-string prices, placeholder markets skipped", () => {
  assert.deepEqual(L.polymarketYes({ outcomes: '["Yes","No"]', outcomePrices: '["0.705","0.295"]', groupItemTitle: "25 bps increase" }),
    { label: "25 bps increase", p: 0.705 });
  assert.equal(L.polymarketYes({ outcomes: '["Yes","No"]', outcomePrices: "[]", groupItemTitle: "Party A" }), null);
  assert.equal(L.polymarketYes({ closed: true, outcomes: '["Yes","No"]', outcomePrices: '["1","0"]' }), null);
});

test("alignment lines up the two venues' wording for the same Fed result", () => {
  const t = topic("fed-2026-10");
  assert.equal(L.alignKey(t.align, "kalshi", "Hike 25bps"), "hike25");
  assert.equal(L.alignKey(t.align, "polymarket", "25 bps increase"), "hike25");
  assert.equal(L.alignKey(t.align, "kalshi", "Hike >25bps"), "hike50");
  assert.equal(L.alignKey(t.align, "polymarket", "50+ bps increase"), "hike50");
  assert.equal(L.alignKey(t.align, "polymarket", "No change"), "hold");
  assert.equal(L.alignKey(t.align, "kalshi", "Something else"), null);
  const b = topic("congress-2026");   // the venues name the split the opposite way round
  assert.equal(L.alignKey(b.align, "kalshi", "D-House, R-Senate"), L.alignKey(b.align, "polymarket", "R Senate, D House"));
});

test("rows from a Polymarket event: OI joined by condition id, tails below 1% dropped unless aligned", () => {
  const t = topic("fed-2026-10");
  const ev = { id: "606422", title: "Fed Decision in October?", markets: [
    { id: "1", conditionId: "0xa", outcomes: '["Yes","No"]', outcomePrices: '["0.705","0.295"]', groupItemTitle: "25 bps increase", volumeNum: 10 },
    { id: "2", conditionId: "0xb", outcomes: '["Yes","No"]', outcomePrices: '["0.0025","0.9975"]', groupItemTitle: "50+ bps decrease", volumeNum: 5 },
  ] };
  const rows = L.rowsFromPolymarketEvent(ev, t, new Map([["0xa", 1234.5]]), LIM);
  assert.equal(rows.length, 2, "the 0.25% leg is aligned (cut50), so it stays");
  assert.equal(rows[0].open_interest, 1234.5);
  assert.equal(rows[1].open_interest, null);
  const plain = L.rowsFromPolymarketEvent(ev, topic("iran-us-ceasefire"), new Map(), LIM);
  assert.equal(plain.length, 1, "no alignment on this topic, so the 0.25% leg is trimmed");
});

test("rows from Kalshi markets carry open interest and skip closed legs", () => {
  const rows = L.rowsFromKalshiMarkets("KXFEDDECISION-26OCT", [
    { ticker: "KXFEDDECISION-26OCT-H25", status: "active", yes_sub_title: "Hike 25bps", yes_bid_dollars: "0.70", yes_ask_dollars: "0.71", open_interest_fp: "576502.08", volume_fp: "10" },
    { ticker: "KXFEDDECISION-26OCT-H0", status: "settled", yes_sub_title: "Fed maintains rate", last_price_dollars: "0.30" },
  ], topic("fed-2026-10"), LIM);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].align_key, "hike25");
  assert.equal(rows[0].open_interest, 576502.08);
  assert.equal(rows[0].probability, 0.705);
});

test("change-only writes: first sighting, a real move, a 6-hour heartbeat — and nothing else", () => {
  const now = new Date("2026-09-28T16:00:00Z");
  const r = (market_id, probability) => ({ topic: "t", venue: "polymarket", market_id, outcome: "x", probability });
  const prior = new Map([
    ["t|polymarket|a|x", { probability: 0.5, ts: "2026-09-28T15:45:00Z" }],
    ["t|polymarket|b|x", { probability: 0.5, ts: "2026-09-28T15:45:00Z" }],
    ["t|polymarket|c|x", { probability: 0.5, ts: "2026-09-28T09:59:00Z" }],
  ]);
  const { rows, unchanged } = L.toWrite([r("a", 0.5), r("b", 0.501), r("c", 0.5), r("d", 0.2)], prior, now, LIM);
  assert.deepEqual(rows.map((x) => x.market_id + ":" + x.kind), ["b:change", "c:heartbeat", "d:first"]);
  assert.equal(unchanged, 1);
});

test("US hours = New York weekday 08:00–17:59, right on both sides of the 1 Nov DST change", () => {
  assert.equal(L.isUsHours(new Date("2026-09-28T12:00:00Z")), true);    // Mon 08:00 EDT
  assert.equal(L.isUsHours(new Date("2026-09-28T11:59:00Z")), false);   // Mon 07:59 EDT
  assert.equal(L.isUsHours(new Date("2026-09-28T21:59:00Z")), true);    // Mon 17:59 EDT
  assert.equal(L.isUsHours(new Date("2026-09-28T22:00:00Z")), false);   // Mon 18:00 EDT
  assert.equal(L.isUsHours(new Date("2026-11-02T12:30:00Z")), false);   // Mon 07:30 EST
  assert.equal(L.isUsHours(new Date("2026-11-02T13:00:00Z")), true);    // Mon 08:00 EST
  assert.equal(L.isUsHours(new Date("2026-09-27T15:00:00Z")), false);   // Sunday
});

test("discovery leaves sports out and takes each event's most-traded leg", () => {
  const evs = [
    { id: "1", title: "Game", tags: [{ label: "Sports" }], markets: [{ id: "m", outcomes: '["Yes","No"]', outcomePrices: '["0.5","0.5"]' }] },
    { id: "2", title: "Fed", tags: [{ label: "Fed" }], volume24hr: 9, markets: [
      { id: "lo", outcomes: '["Yes","No"]', outcomePrices: '["0.1","0.9"]', groupItemTitle: "cut", volume24hr: 1 },
      { id: "hi", outcomes: '["Yes","No"]', outcomePrices: '["0.7","0.3"]', groupItemTitle: "hike", volume24hr: 5 } ] },
  ];
  const rows = L.polymarketDiscovery(evs, REG.discovery.exclude_tags, 15);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].market_id, "hi");
  assert.equal(rows[0].topic, "discover");
  const ks = L.kalshiDiscovery([
    { event_ticker: "S", category: "Sports", markets: [{ ticker: "s", last_price_dollars: "0.5", volume_24h_fp: "999" }] },
    { event_ticker: "E", category: "Economics", title: "CPI", markets: [{ ticker: "e", last_price_dollars: "0.4", volume_24h_fp: "5" }] },
  ], REG.discovery.exclude_kalshi_categories, 15);
  assert.deepEqual(ks.map((x) => x.event_id), ["E"]);
});

test("discovery skips events that are already topics (28 Sep: the October Fed event was both, and collided)", () => {
  const ev = { id: "606422", title: "Fed Decision in October?", tags: [{ label: "Fed" }], markets: [
    { id: "2589813", outcomes: '["Yes","No"]', outcomePrices: '["0.7","0.3"]', groupItemTitle: "25 bps increase" } ] };
  assert.equal(L.polymarketDiscovery([ev], REG.discovery.exclude_tags, 15, new Set(["606422"])).length, 0);
  assert.equal(L.polymarketDiscovery([ev], REG.discovery.exclude_tags, 15).length, 1);
  // and even if one market sits under two topics, the prior key keeps them apart
  const a = { topic: "fed-2026-10", venue: "polymarket", market_id: "2589813", outcome: "25 bps increase" };
  assert.notEqual(L.priorKey(a), L.priorKey({ ...a, topic: "discover" }));
});

test("registry: unique ids, every topic mapped somewhere, every pattern compiles, Alan's topics all present", () => {
  const ids = REG.topics.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const t of REG.topics) {
    assert.ok((t.kalshi?.events?.length || 0) + (t.polymarket?.events?.length || 0) > 0, t.id);
    assert.ok(t.plain && t.plain.length > 20, t.id + " has plain words");
    for (const a of t.align || []) for (const v of ["kalshi", "polymarket"]) if (a[v]) new RegExp(a[v]);
    if (t.align) assert.equal(t.same_question, true, t.id + ": alignment only where both venues ask the same thing");
  }
  const groups = new Set(REG.topics.map((t) => t.group));
  for (const g of ["The Fed", "Yields", "Stocks", "Economy", "Iran", "Russia–Ukraine", "Tariffs & trade", "Elections"]) assert.ok(groups.has(g), g);
  assert.ok(REG.flash_points > 0);
});

test("Kalshi ships switched OFF with its reason written down; Polymarket on", () => {
  assert.equal(REG.venues.kalshi.enabled, false);
  assert.match(REG.venues.kalshi.terms_note, /Developer Agreement/);
  assert.equal(REG.venues.polymarket.enabled, true);
});

test("the page's registry copy is byte-identical to the collector's", () => {
  assert.equal(read("deliverables/20260928/prediction-markets/topics.json"), read("supabase/functions/prediction-markets/topics.json"));
});

test("migrations: additive, rollback exists, and no key is written anywhere", () => {
  const m = read("supabase/migrations/20260928_prediction_market_snapshots.sql");
  const c = read("supabase/migrations/20260928_prediction_markets_cron.sql");
  const r = read("supabase/migrations/20260928_prediction_market_snapshots_ROLLBACK.sql");
  assert.doesNotMatch(m, /\b(drop table|alter table public\.(?!prediction_market)|delete from|update public)/i);
  assert.match(r, /cron\.unschedule\('prediction-markets'\)/);
  assert.match(r, /drop table if exists public\.prediction_market_snapshots/);
  for (const s of [m, c, r, read("supabase/functions/prediction-markets/index.ts"), read("deliverables/20260928/prediction-markets/index.html")])
    assert.doesNotMatch(s, /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, "no JWT committed");
  assert.match(c, /America\/New_York/);
  assert.match(c, /'\*\/15 \* \* \* \*'/);
});

test("page maths: 1-day / 1-week change from a step history, and the flash rule", async () => {
  const P = await import("../deliverables/20260928/prediction-markets/pm.mjs");
  const now = Date.parse("2026-09-28T16:00:00Z");
  const hist = [
    { ts: "2026-09-20T12:00:00Z", p: 0.40 },
    { ts: "2026-09-27T10:00:00Z", p: 0.55 },
    { ts: "2026-09-28T09:00:00Z", p: 0.70 },
  ];
  assert.equal(P.valueAt(hist, now - 86400e3), 0.55, "value held since the last row before the mark");
  assert.equal(P.valueAt(hist, Date.parse("2026-09-19T00:00:00Z")), null, "nothing before the first row");
  const ch = P.changes(hist, now);
  assert.equal(ch.d1, 15);
  assert.equal(ch.w1, 30);
  assert.equal(P.isFlash(ch.d1, 10), true);
  assert.equal(P.isFlash(-12, 10), true);
  assert.equal(P.isFlash(9.9, 10), false);
  assert.equal(P.isFlash(null, 10), false);
  assert.equal(P.fmtPts(15), "+15.0");
  assert.equal(P.fmtPts(-0.04), "0.0");
});

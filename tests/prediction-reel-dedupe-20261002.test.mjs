/* P1b (2 Oct): a market re-listed under a new id must not print its question twice — one row per (topic, venue, question, outcome), newest reading wins. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const start = html.indexOf("function pmDedupe(rows)");
assert.ok(start > 0, "pmDedupe exists");
const end = html.indexOf("\n}\n", start) + 3;
const ctx = {}; vm.createContext(ctx); vm.runInContext(html.slice(start, end) + "; this.pmDedupe = pmDedupe;", ctx);
test("the newest reading wins when the same question appears under two market ids", () => {
  const rows = [
    { topic: "spy-month", venue: "polymarket", market_id: "4936034", question: "Will S&P 500 (SPY) hit (HIGH) $770 in October?", outcome: "↑ $770", ts: "2026-10-02T13:45:00+00:00", bid: 1 },
    { topic: "spy-month", venue: "polymarket", market_id: "5208206", question: "Will S&P 500 (SPY) hit (HIGH) $770 in October?", outcome: "↑ $770", ts: "2026-10-02T18:00:00+00:00", bid: 0.99 },
    { topic: "spy-month", venue: "polymarket", market_id: "5208207", question: "Will S&P 500 (SPY) hit (LOW) $760 in October?", outcome: "↓ $760", ts: "2026-10-02T18:00:00+00:00" },
    { topic: "fed-next", venue: "polymarket", market_id: "1", question: "Will S&P 500 (SPY) hit (HIGH) $770 in October?", outcome: "↑ $770", ts: "2026-10-02T18:00:00+00:00" },
  ];
  const out = ctx.pmDedupe(rows);
  assert.equal(out.length, 3, "one of the two $770 rows is dropped; the other topics are untouched");
  const kept = out.find((r) => r.topic === "spy-month" && /770/.test(r.question));
  assert.equal(kept.market_id, "5208206", "the newer id is the one kept");
});
test("the load line uses it", () => { assert.match(html, /PM\.latest = pmDedupe\(Array\.isArray\(latest\) \? latest : \[\]\)/); });

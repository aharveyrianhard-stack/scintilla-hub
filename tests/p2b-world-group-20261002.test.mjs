/* P2b (2 Oct, Alan: "complement it — both things"): Polymarket's most-traded markets (topic "discover") are their own group in the section, one row per event. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const grab = (name) => { const s = html.indexOf("function " + name + "("); assert.ok(s > 0, name + " exists"); const e = html.indexOf("\n}\n", s) + 3; return html.slice(s, e); };
test("pmDiscoverChips groups the discover rows by event and keeps the favourite", () => {
  const ctx = { pmFavourite: (rows) => rows.find((r) => Number(r.probability) < 0.97) || rows[0], pmDayMaths: () => ({ chg: null, yc: null, usual: null, n: 0, x: null, wild: false }), pmCut: (s, n) => String(s).slice(0, n) };
  vm.createContext(ctx); vm.runInContext(grab("pmDiscoverChips") + "; this.f = pmDiscoverChips;", ctx);
  const rows = [
    { topic: "discover", event_id: "e1", market_id: "m1", question: "Brazil Presidential Election?", outcome: "Lula", probability: 0.44 },
    { topic: "discover", event_id: "e1", market_id: "m2", question: "Brazil Presidential Election?", outcome: "Bolsonaro", probability: 0.30 },
    { topic: "discover", event_id: "e2", market_id: "m3", question: "Bitcoin above 74,000 on October 3?", outcome: "Yes", probability: 1.0 },
    { topic: "fed-next", event_id: "e9", market_id: "m9", question: "Fed decision?", outcome: "No change", probability: 0.83 },
  ];
  const out = ctx.f(rows, {}, 0);
  assert.equal(out.length, 2, "two events, the tracked topic left alone");
  assert.equal(out.find((c) => c.event === "e1").head.outcome, "Lula");
  assert.ok(out.every((c) => c.topic === "discover"));
});
test("the section draws the WHAT THE WORLD IS BETTING ON group after the themes", () => {
  assert.match(html, /WHAT THE WORLD IS BETTING ON/);
  assert.match(html, /const world = pmDiscoverChips\(latest, hist, now\)/);
});

/* C2 (5 Oct 2026, SCI-71) — "the ALL map's colours land late".
   The map's 4H colours for ALL (546 names) come from 8 requests of ~70 names. They were asked one after another, so the
   colours landed when the LAST one answered (measured live 5 Oct: 4.2 s median, 6.9 s on a cold server, after the rows).
   Now up to L0_MAP_PARALLEL chunks are out at once on the clean lane; the legacy database read stays one at a time.
   Offline: l0MapLoad is sliced out of the page and run with fake reads; nothing leaves the process. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fn = page.match(/\nasync function l0MapLoad\([\s\S]*?\n\}\n/)[0];
const PARALLEL = +page.match(/const L0_MAP_PARALLEL = (\d+);/)[1];
const tick = () => new Promise((r) => setImmediate(r));

function kit({ clean, n = 546 }) {
  const tickers = Array.from({ length: n }, (_, i) => "T" + i);
  const seen = { out: 0, peak: 0, calls: [], pg: 0, pgOut: 0, pgPeak: 0, painted: 0 }, waiting = [];
  const rowsFor = (part) => part.flatMap((t) => Array.from({ length: 8 }, (_, k) => ({ ticker: t, timestamp: 2e9 - k * 14400, close: 100 + k })));
  const env = {
    window: { SC_CLEAN_READS: clean }, L0_MAP_PARALLEL: PARALLEL,
    L0_MAP_LOADING: {}, L0_MAP_ERR: {}, L0_MAP_CACHE: {}, L0_MAP_BACK: { "240": 6 }, L0_MAP_PAD: { "240": 6 }, L0_MAP_CUT: { "240": 86400 * 16 },
    L0_MAP_BUDGET: 950, L0_MAP_NOWK: "k", LAYER0_TAB: "MAP", el: () => ({}), paintL0Body: () => { seen.painted++; },
    Date: { now: () => 2e12 },
    l0SeriesMany: (part) => { seen.out++; seen.peak = Math.max(seen.peak, seen.out); seen.calls.push(part.length);
      return new Promise((res) => waiting.push(() => { seen.out--; res(part.map((t) => rowsFor([t]))); })); },
    pg: (q) => { seen.pg++; seen.pgOut++; seen.pgPeak = Math.max(seen.pgPeak, seen.pgOut);
      return new Promise((res) => waiting.push(() => { seen.pgOut--; res([]); })); },
  };
  const m = new Function(...Object.keys(env), "let L0_MAP_NOW = null;" + fn + "\nreturn { l0MapLoad, cache: L0_MAP_CACHE, loading: L0_MAP_LOADING };")(...Object.values(env));
  const drain = async () => { for (let i = 0; i < 400 && (waiting.length || i < 3); i++) { const w = waiting.shift(); if (w) w(); await tick(); } };
  return { m, seen, waiting, tickers, drain };
}

test("the clean lane sends the map's chunks four at a time, never more, and every name still gets its colour", async () => {
  const k = kit({ clean: true });
  const done = k.m.l0MapLoad("240", k.tickers, "k");
  await tick();
  assert.equal(PARALLEL, 4);
  assert.equal(k.seen.out, 4, "four chunks are out before any has answered (it was one)");
  await k.drain(); await done;
  assert.equal(k.seen.peak, 4, "never more than four at once");
  assert.deepEqual(k.seen.calls.slice().sort((a, b) => b - a), [73, 73, 73, 73, 73, 73, 73, 35], "the same 8 chunks of 73 as before");
  assert.equal(k.m.cache.k.hit, 546); assert.equal(k.m.cache.k.n, 546);
  assert.ok(Math.abs(k.m.cache.k.pct.T0 - (100 / 106 - 1) * 100) < 1e-9, "the colour is still newest close against six bars back");
  assert.equal(k.m.loading.k, false); assert.equal(k.seen.painted, 1, "one repaint, when all of it is in");
});

test("a short list is one request, as before", async () => {
  const k = kit({ clean: true, n: 63 });
  const done = k.m.l0MapLoad("240", k.tickers, "k"); await tick();
  assert.equal(k.seen.out, 1); await k.drain(); await done;
  assert.deepEqual(k.seen.calls, [63]); assert.equal(k.m.cache.k.hit, 63);
});

test("the legacy database read keeps its one-at-a-time order", async () => {
  const k = kit({ clean: false });
  const done = k.m.l0MapLoad("240", k.tickers, "k"); await tick();
  assert.equal(k.seen.pgOut, 1); await k.drain(); await done;
  assert.equal(k.seen.pgPeak, 1); assert.equal(k.seen.pg, 8); assert.equal(k.seen.calls.length, 0);
});

test("a failed chunk still ends the load honestly: cached as empty, not left spinning", async () => {
  const k = kit({ clean: true });
  const page2 = fn.replace("const got = await l0SeriesMany(part, tf, per);", "const got = await l0SeriesMany(part, tf, per); if (part[0] === 'T73') throw new Error('boom');");
  assert.notEqual(page2, fn, "the read line is where the test expects it");
  const env = { window: { SC_CLEAN_READS: true }, L0_MAP_PARALLEL: PARALLEL, L0_MAP_LOADING: {}, L0_MAP_ERR: {}, L0_MAP_CACHE: {}, L0_MAP_BACK: { "240": 6 }, L0_MAP_PAD: { "240": 6 },
    L0_MAP_CUT: { "240": 1 }, L0_MAP_BUDGET: 950, L0_MAP_NOWK: "other", LAYER0_TAB: "MAP", el: () => null, paintL0Body: () => {}, Date: { now: () => 2e12 },
    l0SeriesMany: async (part) => part.map(() => []), pg: async () => [] };
  const m = new Function(...Object.keys(env), "let L0_MAP_NOW = null;" + page2 + "\nreturn { l0MapLoad, cache: L0_MAP_CACHE, loading: L0_MAP_LOADING, err: L0_MAP_ERR };")(...Object.values(env));
  await m.l0MapLoad("240", k.tickers, "k");
  assert.equal(m.loading.k, false); assert.equal(m.cache.k.hit, 0); assert.match(m.err.k, /boom/);
});

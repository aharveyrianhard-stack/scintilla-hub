/* H2 (30 Sep) — "charts on ticker selection in dashboard are very slow it showed data delayed for a while."
   The map's sparkline reads (/candles?tf=240&limit=13, one per name, ~590 on ALL) went out a chunk of 73 at a time and the
   chart server answers one request after another, so a company chart opened meanwhile queued behind them. Now they are
   paced (6 at a time), a chart being pointed at a name aborts the ones in flight and holds the rest until it has had the
   server, and one GET /sparklines request answers a whole chunk when the chart API offers it (feature-detected).
   Offline: the pacer is sliced out of the page and run with a fake clock and fake fetch; nothing leaves the process. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const block = page.match(/const SPARK_PACE = [\s\S]*?\nasync function l0SeriesMany\([\s\S]*?\n\}\n/)[0];
const tick = () => new Promise((r) => setImmediate(r));

function kit({ fetch } = {}) {
  const clock = { now: 1e6 }, timers = [], session = {}, listeners = [];
  const env = {
    Date: { now: () => clock.now },
    setTimeout: (f, ms) => { timers.push({ at: clock.now + ms, f }); return timers.length; }, clearTimeout: () => {},
    sessionStorage: { getItem: (k) => (k in session ? session[k] : null), setItem: (k, v) => { session[k] = String(v); } },
    document: { addEventListener: (type, f, cap) => listeners.push({ type, f, cap }) },
    fetch: fetch || (async () => { throw new Error("no fetch in this test"); }),
    SC_CHART_API: "https://api", L0_MAP_TTL: 90000, L0_SERIES_CACHE: {}, L0_SERIES_INFLIGHT: {},
    l0SeriesFor: null,
  };
  const m = new Function(...Object.keys(env), block +
    "\nreturn { SPARK_PACE, sparkPaced, scChartFirstHold, scChartFirstLoaded, l0SeriesBatch, l0SeriesMany, get batch() { return SPARK_BATCH; } };")(...Object.values(env));
  const advance = async (ms) => { clock.now += ms; for (const t of timers.splice(0)) { if (t.at <= clock.now) t.f(); else timers.push(t); } await tick(); await tick(); };
  return { m, env, clock, advance, session, listeners };
}
/* a read that finishes when told to, and notices an abort */
function reads() {
  const open = [];
  const run = (name) => (signal) => new Promise((resolve, reject) => {
    const r = { name, signal, resolve: (v) => { const i = open.indexOf(r); if (i >= 0) open.splice(i, 1); resolve(v); } }; open.push(r);
    if (signal) signal.addEventListener("abort", () => { open.splice(open.indexOf(r), 1); reject(Object.assign(new Error("aborted"), { name: "AbortError" })); });
  });
  return { open, run };
}

test("the sparkline reads go out twelve at a time, not a chunk of 73 at once", async () => {
  const { m } = kit(), R = reads();
  const done = [];
  assert.equal(m.SPARK_PACE.max, 12);
  for (let i = 0; i < 30; i++) m.sparkPaced(R.run("S" + i)).then((v) => done.push(v));
  await tick();
  assert.equal(R.open.length, 12, "twelve out at once");
  assert.equal(m.SPARK_PACE.queue.length, 18);
  R.open[0].resolve("S0"); await tick(); await tick();
  assert.equal(R.open.length, 12, "a finished read makes room for the next");
  assert.deepEqual(done, ["S0"]);
});

test("a company chart opening aborts the reads in flight, holds the rest, and they resume (the aborted ones first) after it", async () => {
  const { m, advance } = kit(), R = reads();
  const done = [];
  for (let i = 0; i < 16; i++) m.sparkPaced(R.run("S" + i)).then((v) => done.push(v), (e) => done.push("ERR " + e.message));
  await tick();
  assert.equal(R.open.length, 12);
  m.scChartFirstHold();                           // Alan clicks a row: the chart frame is pointed at the name
  await tick(); await tick();
  assert.equal(R.open.length, 0, "every read in flight is aborted: the chart has the server");
  assert.equal(m.SPARK_PACE.queue.length, 16, "nothing is lost: the aborted ones are back in the queue");
  assert.deepEqual(done, [], "an abort is not an answer and not a failure");
  await advance(1000);
  assert.equal(R.open.length, 0, "still held while the chart loads");
  m.scChartFirstLoaded();                          // the frame has loaded
  await advance(2000);
  assert.equal(R.open.length, 0, "held a little after the frame loads (its price and clouds are being read)");
  await advance(1100);
  assert.equal(R.open.length, 12, "then the queue resumes, twelve at a time");
  assert.deepEqual(R.open.map((r) => r.name).sort(), Array.from({ length: 12 }, (_, i) => "S" + i).sort(), "the aborted reads go first");
  R.open.slice().forEach((r) => r.resolve(r.name)); await tick(); await tick();
  assert.equal(done.length, 12);
});

test("a frame that never reports its load is released at the latest SPARK_HOLD_MAX_MS after the click", async () => {
  const { m, advance } = kit(), R = reads();
  m.scChartFirstHold();
  m.sparkPaced(R.run("A")); await tick();
  assert.equal(R.open.length, 0);
  await advance(7900); assert.equal(R.open.length, 0);
  await advance(200); assert.equal(R.open.length, 1);
});

test("the page listens for the chart frame's load (capture: a load does not bubble)", () => {
  const { listeners } = kit();
  assert.equal(listeners.length, 1); assert.equal(listeners[0].type, "load"); assert.equal(listeners[0].cap, true);
  assert.match(page, /function cvChartHTML\(t\) \{\n  scChartFirstHold\(\);/);
  assert.match(page, /if \(f && f\.getAttribute\("src"\) !== want\) \{ scChartFirstHold\(\); f\.setAttribute\("src", want\); \}/);
  assert.match(page, /const got = await l0SeriesMany\(part, tf, per\);/);
  assert.match(page, /sparkPaced\(\(sig\) => scCleanRows\(sym, tf, def\.bars, sig\)\)/, "the ROTATION panel's reads are paced too");
  assert.match(page, /async function scCleanRows \(sym, tf, bars, signal\)/);
  assert.match(page, /catch \(e\) \{ if \(signal && signal\.aborted\) throw e; return \[\]; \}/);
});

test("GET /sparklines: feature-detected; a server without it (404 unknown path) is asked per symbol for the rest of the tab", async () => {
  const urls = [];
  const { m, session } = kit({ fetch: async (u) => { urls.push(u); return { ok: false, status: 404, json: async () => ({ error: "unknown path" }) }; } });
  const out = await m.l0SeriesBatch(["AAPL", "MU"], "240", 13);
  assert.equal(out, null);
  assert.equal(m.batch, false);
  assert.equal(session["hub.chart.sparklines"], "0");
  assert.equal(urls[0], "https://api/sparklines?tf=240&limit=13&authority=provider&symbols=AAPL,MU");
});

test("GET /sparklines answers a chunk in ONE request: rows as scCleanRows gives them; not tracked → null, other refusals → []", async () => {
  const urls = [];
  const series = (c) => ({ series: [{ t: 1000e3, c, v: 5 }, { t: 2000e3, c: c + 1, v: 6 }] });
  const { m, env } = kit({ fetch: async (u) => { urls.push(u); return { ok: true, status: 200, json: async () => ({
    requested: 4, served: 2, candles: { AAPL: series(10), MU: series(20) },
    refused: [{ symbol: "CLUSD", status: 404, state: "SYMBOL_NOT_TRACKED" }, { symbol: "BAD", status: 500 }] }) }; } });
  const out = await m.l0SeriesBatch(["AAPL", "MU", "CLUSD", "BAD"], "240", 13);
  assert.equal(urls.length, 1, "one request for the chunk");
  assert.equal(m.batch, true);
  assert.deepEqual(out.AAPL, [{ ticker: "AAPL", timestamp: 2000, close: 11, volume: 6 }, { ticker: "AAPL", timestamp: 1000, close: 10, volume: 5 }], "newest first, seconds, like scCleanRows");
  assert.equal(out.CLUSD, null, "not a Massive equity: the caller keeps its owner");
  assert.deepEqual(out.BAD, [], "a real failure stays empty");
  void env;
});

test("l0SeriesMany: fills the shared cache from one batch, then every symbol reads through l0SeriesFor", async () => {
  const urls = [];
  const src = page.match(/const SPARK_PACE = [\s\S]*?\nasync function l0SeriesMany\([\s\S]*?\n\}\n/)[0];
  const cache = {}, asked = [];
  const clock = { now: 5e6 };
  const m = new Function("Date", "setTimeout", "clearTimeout", "sessionStorage", "document", "fetch", "SC_CHART_API", "L0_MAP_TTL", "L0_SERIES_CACHE", "L0_SERIES_INFLIGHT", "l0SeriesFor",
    src + "\nreturn { l0SeriesMany };")(
    { now: () => clock.now }, setTimeout, clearTimeout, { getItem: () => null, setItem: () => {} }, { addEventListener: () => {} },
    async (u) => { urls.push(u); return { ok: true, status: 200, json: async () => ({ candles: { AAPL: { series: [{ t: 1e6, c: 1, v: 1 }] } }, refused: [{ symbol: "ZZ", status: 404 }] }) }; },
    "https://api", 90000, cache, {}, async (s) => { asked.push(s); return cache["240|" + s] ? cache["240|" + s].rows : "per-symbol"; });
  const got = await m.l0SeriesMany(["AAPL", "ZZ"], "240", 13);
  assert.equal(urls.length, 1);
  assert.deepEqual(asked, ["AAPL", "ZZ"]);
  assert.equal(got[0].length, 1); assert.equal(got[1], null);
  await m.l0SeriesMany(["AAPL", "ZZ"], "240", 13);
  assert.equal(urls.length, 1, "a fresh cache asks nothing again");
});

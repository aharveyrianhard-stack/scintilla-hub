/* M39 — the contrarian lane, lifted out of allocation/index.html and run against
   made-up names. No network, no browser. What these pin down is the philosophy Alan
   asked for: a red cohort is where the search looks, quality is measured and never
   invented, a probability rests on separate episodes rather than overlapping days,
   the loading is staged, and a swipe is never lost. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const PAGE = fs.readFileSync(new URL("../allocation/index.html", import.meta.url), "utf8");
const START = PAGE.indexOf("/* ===== M39 — THE CONTRARIAN LANE");
const END = PAGE.indexOf("/* ===== M39 — WHAT THE LANE PUTS ON THE PAGE");
assert.ok(START > 0 && END > START, "the page must still carry the contrarian lane");
const SRC = PAGE.slice(START, END);

const PRE = `
  const mean = (a) => a.reduce((s,x)=>s+x,0)/(a.length||1);
  const med  = (a) => { const b=[...a].sort((x,y)=>x-y); const n=b.length; return !n?null:(n%2?b[(n-1)/2]:(b[n/2-1]+b[n/2])/2); };
  const clamp= (v,lo,hi) => Math.max(lo, Math.min(hi, v));
  const pct  = (v,d) => (v==null||!isFinite(v)) ? "-" : v.toFixed(d==null?0:d) + "%";
  const sg   = (v,d) => (v==null||!isFinite(v)) ? "-" : (v>0?"+":"") + v.toFixed(d==null?2:d);
  const COHORTS = [["AI HW","AI_HARDWARE"],["MEGACAP","MEGACAP"],["METALS","METALS"],["BLUE CHIP","BLUE_CHIP"]];
  const SB = "https://example.invalid";
  let KEY = "test";
  const api = async () => ({ series: [] });
  const draw = () => {};
  const HIST_IN = new Set();
`;
function lane({ T, D, fetchImpl = async () => ({ ok: true }), store = {} }) {
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
  };
  return new Function("T", "D", "localStorage", "fetch", "store",
    PRE + SRC + "\nreturn { contrarianLane, probAt, stagePlan, qualityScorer, stretchOf, s200Series," +
    " prefRead, prefFor, castVote, votesLoad, votesSave, VOTES, tideRead, seasonRead, QLEGS, USUAL };")(
      T, D, localStorage, fetchImpl, store);
}

const T0 = () => ({ near200:5, rsiMax:40, qFloor:55, stage1:40, stageStep:7, minEp:3,
                    oppCap:24, prefW:15, maxSector:35, hunt:"contrarian", brSample:60 });
/* one company, with every quality input present so the score is real */
const co = (t, o = {}) => Object.assign({
  t, sector:"Technology", mcap:5e10, g:-0.4, trend:-0.2, mom:-0.3, pe:14, price:90,
  de:0.4, roe:22, nm:18, nmTrend:2, grw:14, cohs:["AI HW"], cohTilt:-0.5, fav:false,
}, o);
/* the published averages: a name 12% under its 200-day, oversold on the RSI */
const D0 = (names, sma, rsi) => ({
  sma, rsi, quotes:null, hist:{}, histAsked:0, histFailed:0, tape:{}, spyLong:null,
  fav:[], regime:null, ntm:{},
});

/* a series that spends three separate stretches well below its own 200-day average */
function series({ n = 900, dips = [[300, 40], [520, 30], [740, 25]], base = 100, fwd = 6 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    let c = base * (1 + i / n * 0.5);                       // a long slow uptrend
    for (const [at, len] of dips) if (i >= at && i < at + len) c *= 0.72;   // a real selloff
    for (const [at, len] of dips) if (i >= at + len && i < at + len + 60) c *= 1.06; // and a recovery
    out.push({ t: Date.UTC(2021, 0, 4) + i * 86400000, c });
  }
  return out;
}

test("a probability counts separate episodes, not overlapping days", () => {
  const L = lane({ T: T0(), D: D0() });
  const ser = series();
  const p = L.probAt(ser, -15, 20);
  assert.ok(p.n > p.ep, "many days sit inside a handful of episodes");
  assert.ok(p.ep >= 2 && p.ep <= 6, "the three dips should read as a small number of episodes, got " + p.ep);
  if (p.hit != null) { assert.ok(p.hit >= 0 && p.hit <= 100); assert.equal(typeof p.med, "number"); }
});

test("a thin sample refuses to become a probability", () => {
  const L = lane({ T: Object.assign(T0(), { minEp: 9 }), D: D0() });
  const p = L.probAt(series(), -15, 20);
  assert.equal(p.hit, null);
  assert.match(p.why, /separate episode/);
  assert.ok(p.ep > 0, "it still says how many episodes it found");
});

test("too little history is said out loud, not scored", () => {
  const L = lane({ T: T0(), D: D0() });
  const p = L.probAt(series({ n: 150 }), -10, 20);
  assert.equal(p.hit, null);
  assert.match(p.why, /two years/);
});

test("a name that has never been this low says so instead of guessing", () => {
  const L = lane({ T: T0(), D: D0() });
  const p = L.probAt(series({ dips: [] }), -40, 20);
  assert.equal(p.hit, null);
  assert.match(p.why, /never been this far below/);
});

test("quality is measured, and a leg with no peer group has no percentile", () => {
  const pool = Array.from({ length: 12 }, (_, i) => co("N" + i, { nm: i, roe: i, de: i / 10, grw: i, nmTrend: i }));
  const L = lane({ T: T0(), D: D0() });
  const score = L.qualityScorer(pool);
  const best = score(pool[11]), worst = score(pool[0]);
  assert.ok(best.score > worst.score, "a better company must score higher");
  assert.equal(best.n, 5, "all five legs measured");
  const thin = L.qualityScorer(pool.slice(0, 4))(pool[0]);
  assert.equal(thin.score, null, "four peers is not a peer group");
  assert.match(thin.why, /not enough to call anything quality/);
});

test("more debt scores worse, all else equal", () => {
  const pool = Array.from({ length: 12 }, (_, i) => co("N" + i, { de: i / 4 }));
  const L = lane({ T: T0(), D: D0() });
  const score = L.qualityScorer(pool);
  assert.ok(score(pool[0]).score > score(pool[11]).score);
});

test("a quality company far below its 200-day is called a possible exaggeration, and a red cohort does not disqualify it", () => {
  const eq = Array.from({ length: 12 }, (_, i) => co("Q" + i, { nm: 10 + i, roe: 10 + i, grw: 5 + i, de: 1 - i / 20 }));
  const target = eq[11];
  const sma = { [target.t]: { s50: 100, s200: 102 } };
  eq.slice(0, 11).forEach((x, i) => { sma[x.t] = { s50: 100, s200: 100 }; });
  const D = D0(eq, sma, { [target.t]: 28 });
  const L = lane({ T: T0(), D });
  const m = { invested: 40, eq, sectors: [], br: {} };
  L.contrarianLane(m, eq, { Technology: eq });
  const found = m.opp.find((o) => o.t === target.t);
  assert.ok(found, "the oversold quality name must be found");
  assert.ok(found.kinds.includes("EXAGGERATION?"), "kinds were " + found.kinds.join(","));
  assert.ok(found.kinds.includes("OVERSOLD"));
  assert.equal(found.q.n, 5);
  assert.ok(found.red > 0, "its cohort reads red, and that counts towards it, not against it");
});

test("quality at its own 200-day is the Munger line, and it is listed separately", () => {
  const eq = Array.from({ length: 12 }, (_, i) => co("M" + i, { nm: 10 + i, roe: 10 + i, grw: 5 + i }));
  const at = eq[11];
  const sma = {}; eq.forEach((x) => { sma[x.t] = { s50: 95, s200: 140 }; });
  sma[at.t] = { s50: 92, s200: 91 };                        // price 90 → about 1% under its 200-day
  const L = lane({ T: T0(), D: D0(eq, sma, {}) });
  const m = { invested: 40, eq, sectors: [], br: {} };
  L.contrarianLane(m, eq, { Technology: eq });
  assert.ok(m.near200.some((o) => o.t === at.t), "the name at its 200-day must be on that list");
  const o = m.opp.find((z) => z.t === at.t);
  assert.ok(o.kinds.includes("AT THE 200-DAY"));
});

test("a leader that has pulled back is a pullback, and the pullback search keeps only those", () => {
  const eq = Array.from({ length: 12 }, (_, i) => co("P" + i, { nm: 10 + i, roe: 10 + i, grw: 5 + i }));
  const sma = {}; eq.forEach((x, i) => { sma[x.t] = { s50: 95, s200: 70 }; });   // above the 200, under the 50
  const L = lane({ T: T0(), D: D0(eq, sma, {}) });
  const m = { invested: 40, eq, sectors: [], br: {} };
  L.contrarianLane(m, eq, { Technology: eq });
  assert.ok(m.opp.every((o) => o.kinds.includes("PULLBACK")));
  const L2 = lane({ T: Object.assign(T0(), { hunt: "pullback" }), D: D0(eq, sma, {}) });
  const m2 = { invested: 40, eq, sectors: [], br: {} };
  L2.contrarianLane(m2, eq, { Technology: eq });
  assert.equal(m2.elig.length, m2.opp.length, "every one of these is a pullback");
});

test("cheaper than its sector while growing faster is caught as an inconsistency", () => {
  const eq = Array.from({ length: 12 }, (_, i) => co("I" + i, { pe: 30, grw: 5, nm: 10 + i, roe: 10 + i }));
  eq[11] = co("ODD", { pe: 9, grw: 40, nm: 22, roe: 30, de: 0.2, nmTrend: 5 });
  const sma = {}; eq.forEach((x) => { sma[x.t] = { s50: 100, s200: 100 }; });
  const L = lane({ T: T0(), D: D0(eq, sma, {}) });
  const m = { invested: 40, eq, sectors: [], br: {} };
  L.contrarianLane(m, eq, { Technology: eq });
  const o = m.opp.find((z) => z.t === "ODD");
  assert.ok(o && o.kinds.includes("INCONSISTENCY"), "kinds were " + (o ? o.kinds.join(",") : "none"));
});

test("the sector mix comes from the opportunities, not from sector leadership", () => {
  const weak = Array.from({ length: 12 }, (_, i) => co("W" + i, { sector:"Energy", nm: 12 + i, roe: 12 + i, grw: 8 + i, de: 0.3 }));
  const strong = Array.from({ length: 12 }, (_, i) => co("S" + i, { sector:"Technology", nm: 2, roe: 2, grw: 1, de: 3, price: 200 }));
  const eq = weak.concat(strong);
  const sma = {};
  weak.forEach((x) => { sma[x.t] = { s50: 100, s200: 105 } });     // price 90: under both
  strong.forEach((x) => { sma[x.t] = { s50: 150, s200: 120 } });   // price 200: far above both
  const rsi = {}; weak.forEach((x) => { rsi[x.t] = 25; }); strong.forEach((x) => { rsi[x.t] = 78; });
  const L = lane({ T: T0(), D: D0(eq, sma, rsi) });
  const m = { invested: 40, eq, sectors: [], br: {} };
  L.contrarianLane(m, eq, { Energy: weak, Technology: strong });
  assert.ok(m.oppMix.length, "a mix must come out");
  assert.equal(m.oppMix[0].name, "Energy", "the weak sector with the quality names carries it");
  assert.ok(m.oppMix.every((r) => r.w <= 35 + 1e-9), "the single-sector cap still holds");
});

test("the staged plan loads in tranches, each with the probability at its own depth", () => {
  const eq = Array.from({ length: 12 }, (_, i) => co("T" + i, { nm: 10 + i, roe: 10 + i, grw: 5 + i }));
  const target = eq[11];
  const sma = {}; eq.forEach((x) => { sma[x.t] = { s50: 100, s200: 100 }; });
  sma[target.t] = { s50: 100, s200: 102 };
  const D = D0(eq, sma, { [target.t]: 25 });
  D.hist[target.t] = series();
  const L = lane({ T: T0(), D });
  const m = { invested: 40, eq, sectors: [], br: {} };
  L.contrarianLane(m, eq, { Technology: eq });
  const o = m.head.find((z) => z.t === target.t);
  assert.ok(o && o.plan.state === "ok", "the plan should be ready when the history is in hand");
  assert.equal(o.plan.steps.length, 3);
  assert.ok(Math.abs(o.plan.steps.reduce((s, x) => s + x.size, 0) - 100) < 1e-9, "the tranches are the whole position");
  assert.ok(o.plan.steps[1].lvl < o.plan.steps[0].lvl, "each step waits for more weakness");
  assert.ok(o.plan.steps[2].lvl < o.plan.steps[1].lvl);
  assert.match(o.plan.steps[0].trigger, /now/);
  assert.match(o.plan.steps[1].trigger, /only if it falls/);
});

test("a swipe is kept the moment it is made, even when the server refuses it", async () => {
  const store = {};
  const L = lane({ T: T0(), D: D0(), store, fetchImpl: async () => ({ ok: false, status: 404 }) });
  L.votesLoad();
  const o = { t:"AAPL", sector:"Technology", cohs:["MEGACAP"], kinds:["OVERSOLD"], score:0.5,
              q:{ score:70 }, st:{ d200:-8 } };
  L.castVote(o, "right");
  assert.equal(L.VOTES.rows.length, 1);
  assert.equal(L.VOTES.rows[0].sent, false, "it is not claimed as sent");
  await new Promise((r) => setTimeout(r, 5));
  assert.ok(store["sc_alloc_votes"], "it is on the device");
  assert.match(store["sc_alloc_votes"], /AAPL/);
  assert.equal(L.VOTES.pending, 1, "the page can say one is waiting");
});

test("your swipes move the order, and zero weight means they move nothing", () => {
  const store = { sc_alloc_votes: JSON.stringify([
    { ticker:"X1", choice:"right", cohs:["AI HW"], sector:"Technology", sent:true },
    { ticker:"X2", choice:"right", cohs:["AI HW"], sector:"Technology", sent:true },
    { ticker:"X3", choice:"left",  cohs:["METALS"], sector:"Basic Materials", sent:true },
  ]) };
  const L = lane({ T: T0(), D: D0(), store });
  L.votesLoad();
  const pr = L.prefRead();
  assert.ok(pr.coh["AI_HARDWARE"] > 0, "two rights on AI hardware read positive");
  assert.ok(pr.coh["METALS"] < 0, "a pass reads negative");
  const liked = L.prefFor({ cohs:["AI HW"], sector:"Technology" }, pr);
  const passed = L.prefFor({ cohs:["METALS"], sector:"Basic Materials" }, pr);
  assert.ok(liked > passed);
  assert.equal(L.prefFor({ cohs:["BLUE CHIP"], sector:"Utilities" }, pr), null, "a group you never swiped moves nothing");
});

test("the tide and the calendar say how many years they rest on", () => {
  const n = 2600;
  const spy = Array.from({ length: n }, (_, i) => ({ t: Date.UTC(2016, 0, 4) + i * 86400000, c: 100 + i * 0.05 }));
  const L = lane({ T: T0(), D: Object.assign(D0(), { spyLong: spy, tape: { SPY: spy } }) });
  const t = L.tideRead();
  assert.ok(t.bars === n && t.above === true, "a rising series reads above its own 200-day");
  const s = L.seasonRead();
  assert.ok(s.all.n >= 3, "it says how many years it used: " + s.all.n);
  assert.ok(Array.isArray(s.mid.years) || s.mid.n === 0, "midterm years are named when there are any");
});

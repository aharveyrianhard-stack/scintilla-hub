/* Layer three decides in the open. These run the page's own funnel, lifted out of
   allocation/index.html, against made-up names — no network, no browser. What they
   pin down is the behaviour Alan asked for: every step reports who left and why,
   a missing input stops the funnel instead of guessing, and nothing is dropped in
   silence. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const PAGE = fs.readFileSync(new URL("../allocation/index.html", import.meta.url), "utf8");

/* the funnel and the tape reader, exactly as the page carries them */
const START = PAGE.indexOf("function sma(cl, n)");
const END = PAGE.indexOf("/* ---- the model ---");
assert.ok(START > 0 && END > START, "the page must still carry the funnel");
const SRC = PAGE.slice(START, END);

const PRE = `
  const med = (a) => { const b=[...a].sort((x,y)=>x-y); const n=b.length; return !n?null:(n%2?b[(n-1)/2]:(b[n/2-1]+b[n/2])/2); };
  const sg  = (v,d) => (v==null||!isFinite(v)) ? "-" : (v>0?"+":"") + v.toFixed(d==null?2:d);
  const pct = (v,d) => (v==null||!isFinite(v)) ? "-" : v.toFixed(d==null?0:d) + "%";
  const todayET = () => TODAY;
  const ensureBars = (list) => { ASKED.push(...list); };
`;
function load(T, D, TODAY = "2026-09-23") {
  const ASKED = [];
  const api = new Function("T", "D", "TODAY", "ASKED",
    PRE + SRC + "\nreturn { runFunnel, tapeRead, sma, money, daysApart, WAIT };")(T, D, TODAY, ASKED);
  return { ...api, ASKED };
}

const BASE_T = { gFloor:0, maxDebt:2.0, ernDays:7, liqFloor:25, trendOn:true, extMax:12, tapeCap:60 };
const bars = ({ n = 120, from = 100, to = 100, vol = 5e6, px = null }) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = px ? px(i, n) : from + (to - from) * (i / (n - 1));
    out.push({ t: Date.UTC(2026, 3, 1) + i * 86400000, c, v: vol, vw: c });
  }
  return out;
};
const name = (t, o = {}) => ({ t, sector:"Technology", g:0.5, de:0.5, pe:20, rDate:"2025-12-31", ...o });
const MIDS = { Technology: { gMed: 0.2, peMed: 25, n: 9 } };

function storeFor(names, over = {}) {
  const D = { g:{}, ratios:[{}], ern:{}, bars:{}, barsAsked:0, barsFailed:0, ...over };
  names.forEach((x) => { if (D.bars[x.t] === undefined) D.bars[x.t] = bars({}); });
  return D;
}

test("every step reports how many went in, how many came out, and who left with a reason", () => {
  const names = [name("AAA"), name("BBB", { g:0.1 }), name("CCC", { de:9 })];
  const { runFunnel } = load({ ...BASE_T }, storeFor(names));
  const F = runFunnel(names, MIDS);
  assert.equal(F.steps.length, 6);
  for (const st of F.steps) {
    assert.equal(st.in, st.out + st.dropped.length + st.waiting.length,
      st.title + ": names must be accounted for — kept, dropped or still reading");
    assert.ok(st.line && st.rec, st.title + " must show its line and the recommended value");
    for (const d of st.dropped) {
      assert.ok(typeof d.why === "string" && d.why.length > 12, st.title + " dropped " + d.t + " with no reason");
      assert.ok(d.t, "a dropped entry must name the name");
    }
  }
  assert.deepEqual(F.steps[0].dropped.map((d)=>d.t), ["BBB"], "the Geiger step takes the weak name");
  assert.match(F.steps[0].dropped[0].why, /reads \+0\.10 against a sector middle of \+0\.20/);
  assert.deepEqual(F.steps[1].dropped.map((d)=>d.t), ["CCC"], "the balance sheet takes the indebted name");
  assert.match(F.steps[1].dropped[0].why, /9\.00x debt against equity, past your 2\.0x line/);
  assert.deepEqual(F.candidates.map((x)=>x.t), ["AAA"]);
});

test("a missing earnings calendar stops the funnel — nothing below runs and no pick is offered", () => {
  const names = [name("AAA"), name("BBB")];
  const { runFunnel } = load({ ...BASE_T }, storeFor(names, { ern: null }));
  const F = runFunnel(names, MIDS);
  const earn = F.steps.find((s)=>s.id === "earn");
  assert.equal(earn.status, "STOPPED");
  assert.match(earn.why, /earnings calendar/);
  assert.deepEqual(F.steps.filter((s)=>["liq","trend","level"].includes(s.id)).map((s)=>s.status),
    ["NOT RUN", "NOT RUN", "NOT RUN"]);
  assert.deepEqual(F.candidates, [], "a stopped funnel hands back no candidates at all");
  assert.equal(F.stopped.id, "earn");
});

test("the same is true when no daily bar comes back", () => {
  const names = [name("AAA"), name("BBB")];
  const D = storeFor(names);
  D.bars = { AAA: null, BBB: null };
  const { runFunnel } = load({ ...BASE_T }, D);
  const F = runFunnel(names, MIDS);
  assert.equal(F.steps.find((s)=>s.id === "liq").status, "STOPPED");
  assert.equal(F.stopped.id, "liq");
  assert.deepEqual(F.candidates, []);
});

test("a name with no debt figure is let through and flagged, never dropped on a number that is not there", () => {
  const names = [name("AAA", { de: null })];
  const { runFunnel } = load({ ...BASE_T }, storeFor(names));
  const F = runFunnel(names, MIDS);
  assert.deepEqual(F.steps.find((s)=>s.id === "debt").dropped, []);
  assert.deepEqual(F.flags.noDebt, ["AAA"]);
  assert.deepEqual(F.candidates.map((x)=>x.t), ["AAA"]);
});

test("a name with no earnings date is flagged too, and one reporting inside the line is held back", () => {
  const names = [name("AAA"), name("SOON"), name("LATER")];
  const D = storeFor(names, { ern: { SOON: { date:"2026-09-25", confirmed:true },
                                     LATER: { date:"2026-11-04", confirmed:false } } });
  const { runFunnel } = load({ ...BASE_T }, D);
  const F = runFunnel(names, MIDS);
  const earn = F.steps.find((s)=>s.id === "earn");
  assert.deepEqual(earn.dropped.map((d)=>d.t), ["SOON"]);
  assert.match(earn.dropped[0].why, /reports in 2 days \(2026-09-25, confirmed\)/);
  assert.deepEqual(F.flags.noEarn, ["AAA"], "no date on file is a flag, not a pass mark");
  assert.ok(F.candidates.some((x)=>x.t === "LATER"), "a report seven weeks out is not close");
});

test("names past the tape cap are named as unread, not quietly dropped", () => {
  const names = [name("AAA", { g:0.9 }), name("BBB", { g:0.8 }), name("CCC", { g:0.7 })];
  const { runFunnel, ASKED } = load({ ...BASE_T, tapeCap: 2 }, storeFor(names));
  const F = runFunnel(names, MIDS);
  const liq = F.steps.find((s)=>s.id === "liq");
  assert.deepEqual(liq.dropped.map((d)=>d.t), ["CCC"], "the weakest of the three is the one left unread");
  assert.match(liq.dropped[0].why, /tape is read for the 2 strongest only/);
  assert.deepEqual(ASKED, ["AAA", "BBB"], "the tape is asked for only the names inside the cap");
});

test("a name still waiting on its bars is neither kept nor dropped", () => {
  const names = [name("AAA"), name("SLOW")];
  const D = storeFor(names);
  delete D.bars.SLOW;                                   // the request has not come back yet
  const { runFunnel } = load({ ...BASE_T }, D);
  const F = runFunnel(names, MIDS);
  const liq = F.steps.find((s)=>s.id === "liq");
  assert.equal(liq.status, "READING");
  assert.deepEqual(liq.waiting, ["SLOW"]);
  assert.deepEqual(liq.dropped, []);
  assert.deepEqual(F.candidates.map((x)=>x.t), ["AAA"]);
  assert.equal(F.reading, 1);
});

test("liquidity, trend and distance are judged on the tape, at the line and either side of it", () => {
  const names = [name("THIN"), name("UNDER"), name("FAR"), name("OK")];
  const D = storeFor(names);
  D.bars.THIN  = bars({ vol: 1000 });                                  // $100k a day
  D.bars.UNDER = bars({ px: (i,n)=> i < n-1 ? 100 : 80 });             // last close well under the average
  D.bars.FAR   = bars({ px: (i,n)=> i < n-1 ? 100 : 130 });            // 30% above the average
  D.bars.OK    = bars({ from: 90, to: 100 });
  const { runFunnel } = load({ ...BASE_T }, D);
  const F = runFunnel(names, MIDS);
  assert.deepEqual(F.steps.find((s)=>s.id === "liq").dropped.map((d)=>d.t), ["THIN"]);
  assert.match(F.steps.find((s)=>s.id === "liq").dropped[0].why, /trades \$0m a day, under your \$25m line/);
  assert.deepEqual(F.steps.find((s)=>s.id === "trend").dropped.map((d)=>d.t), ["UNDER"]);
  assert.match(F.steps.find((s)=>s.id === "trend").dropped[0].why, /under its 50-day average/);
  assert.deepEqual(F.steps.find((s)=>s.id === "level").dropped.map((d)=>d.t), ["FAR"]);
  assert.match(F.steps.find((s)=>s.id === "level").dropped[0].why, /above its 50-day average/);
  assert.deepEqual(F.candidates.map((x)=>x.t), ["OK"]);
});

test("the tape is only asked for names that survived the cheap steps", () => {
  const names = [name("GOOD"), name("WEAK", { g:0.0 }), name("HEAVY", { de:9 })];
  const { runFunnel, ASKED } = load({ ...BASE_T }, storeFor(names));
  runFunnel(names, MIDS);
  assert.deepEqual(ASKED, ["GOOD"], "no request is spent on a name the funnel already removed");
});

test("switching a step off lets its names through instead of hiding the step", () => {
  const names = [name("HEAVY", { de: 9 })];
  const { runFunnel } = load({ ...BASE_T, maxDebt: 0 }, storeFor(names));
  const F = runFunnel(names, MIDS);
  const debt = F.steps.find((s)=>s.id === "debt");
  assert.equal(debt.status, "RAN");
  assert.match(debt.line, /not used/);
  assert.deepEqual(debt.dropped, []);
});

test("the median of dollars traded, not the mean, decides liquidity", () => {
  const { tapeRead } = load({ ...BASE_T }, storeFor([]));
  const b = bars({ vol: 1e6 });
  b[b.length - 1].v = 400e6;                       // one enormous day at the end
  const r = tapeRead(b);
  assert.ok(r.dollar < 2e8, "one busy session must not carry a thin name over the line");
  assert.equal(r.bars, 120);
});

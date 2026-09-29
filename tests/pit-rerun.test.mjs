/* R4 · the point-in-time re-run: the switch leaves the old runs alone, the three rules, the pages and their boxes. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import * as fsSync from "node:fs";
import { loadStatements } from "../research/statistics/point-in-time/pit-traits.mjs";
import { program } from "../research/statistics/point-in-time/fetch-statements-fly.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), ".."), R = (p) => readFileSync(join(ROOT, p), "utf8");
const PY = join(ROOT, "research/statistics/point-in-time/pit_source.py");

test("the three rules of a --pit run are stated in one place and the exit scoring is right", () => {
  const src = R("research/statistics/point-in-time/pit_source.py");
  for (const rule of ["member THAT day", "ON THAT DAY", "LAST close"]) assert.ok(src.includes(rule), rule);
  const out = execFileSync("python3", ["-c", `import sys; sys.path.insert(0, ${JSON.stringify(dirname(PY))}); import pit_source as PS, numpy as np, json
c = np.array([100, 110, 121, 100.0]); print(json.dumps([PS.fwd_to_exit(c, 2).tolist(), PS.fwd_maxdd_to_exit(c, 2).tolist(), PS.fwd_to_exit(c, 10).tolist(), PS.tranche(250e3), PS.tranche(50e3), PS.tranche(5e3), PS.tranche(500), PS.tranche(None)]).replace("NaN", "null"))`]).toString();
  const [f2, d2, f10, mega, large, mid, small, none] = JSON.parse(out);
  assert.deepEqual(f2.map((x) => x == null ? null : Math.round(x * 100) / 100), [21, -9.09, -17.36, null]);      // a full window: the plain forward return
  assert.deepEqual(f10.map((x) => x == null ? null : Math.round(x * 100) / 100), [0, -9.09, -17.36, null]);      // the series ends inside the window: to the last close
  assert.deepEqual(d2.map((x) => x == null ? null : Math.round(x * 100) / 100), [10, -9.09, -17.36, null]);      // worst close ahead, or the last one
  assert.deepEqual([mega, large, mid, small, none], ["mega cap (>200bn)", "large cap (10–200bn)", "mid cap (2–10bn)", "small cap (<2bn)", "stock (no cap)"]);
});

test("the studies keep their old path: the switch is opt-in and the old data files carry no new keys", () => {
  for (const f of ["q3_falling200.py", "q4_leaders.py", "q5_sigma.py"]) { const s = R("research/statistics/stats-3/" + f); assert.ok(s.includes('PIT = "--pit" in sys.argv'), f); assert.ok(s.includes("if PIT else"), f + " branches"); }
  for (const f of ["q3", "q4", "q5"]) { const j = JSON.parse(R(`deliverables/20260928/stats-3/data/${f}.json`)); assert.ok(!("universe" in j) && !("stoppedTrading" in j) && !("fallerPool" in j), f + " unchanged"); }
  const rot = R("research/statistics/leaders-rotation.mjs"); assert.ok(rot.includes('args.includes("--pit")') && rot.includes("isMem(sym, kc)"));
});

test("the Hub's sigma test is replayed with the rules file's numbers, on member days only", () => {
  const out = execFileSync("python3", ["-c", `import sys, json; sys.path.insert(0, ${JSON.stringify(dirname(PY))}); import pit_source as PS, pandas as pd, numpy as np
idx = pd.bdate_range("2020-01-01", periods=80); c = np.full(80, 100.0)
for i in range(1, 80): c[i] = c[i-1] * (1 + (0.01 if i % 2 else -0.01))
c[70:] *= 1.05; c[75:] *= 0.91                       # a +5% day (5x the 1% usual day) and a -9% day (raw), each carried forward
d = pd.DataFrame({"c": c, "cap_m": 1000.0, "member": 1}, index=idx); d.loc[idx[75], "member"] = 0
ev, meas = PS.sigma_events("T", d, {"x_usual": 2, "x_usual_needs_move_pct": 1, "raw_move_pct": 8})
print(json.dumps({"dates": [str(x.date()) for x in ev.date], "x": [round(float(x), 1) for x in ev.x_usual], "measured": len(meas)}))`]).toString();
  const o = JSON.parse(out);
  assert.deepEqual(o.dates, ["2020-04-08"], "the 5x day fires; the raw day on a non-member day does not");
  assert.ok(o.x[0] > 3.5 && o.x[0] < 4.5, "about 4x: +5% carried, less that day's own −1% step, over a 1% usual day"); assert.ok(o.measured >= 55 && o.measured < 80);
});

test("the statements pull prints values only and its reader keeps filed quarters", () => {
  const p = program(["AAPL", "BRK.B"]); assert.ok(!p.includes("apikey=" + "x") && p.includes("process.env.FMP_API_KEY") && p.includes('replace(/\\./g,"-")'));
  const tmp = join(ROOT, "deliverables/20260928/pit-rerun/.test-statements.jsonl");
  fsSync.writeFileSync(tmp, 'garbage\n{"s":"AAA","q":[["2024-03-31","2024-05-01",10,1],["2023-12-31",null,9,1]]}\n{"s":"BBB","err":"http 404"}\n{"s":"CCC","q":[]}\n{"done":3}\n');
  try { const { fund, errors } = loadStatements(tmp); assert.equal(errors, 1); assert.equal(fund.get("AAA")[0].filingDate, "2024-05-01"); assert.equal(fund.get("AAA")[1].filingDate, "2023-12-31"); assert.ok(!fund.has("BBB") && !fund.has("CCC"), "an error and an empty list are both 'no statements'"); } finally { fsSync.unlinkSync(tmp); }
});

test("the pages: the re-run page, its data, the correction boxes, the status section, the index card", () => {
  const page = R("deliverables/20260928/pit-rerun/PIT-RERUN.html");
  for (const id of ["q3", "q4", "q5", "rot", "traits"]) assert.ok(page.includes(`id="${id}"`), id);
  assert.ok(page.includes("data-scnav-slot"), "the BACK / CLOSE pair has a slot");
  for (const f of ["pit-q3.json", "pit-q4.json", "pit-q5.json", "pit-rotation.json"]) assert.ok(existsSync(join(ROOT, "deliverables/20260928/point-in-time/data", f)), f);
  const s3 = R("deliverables/20260928/stats-3/STATS-3.html");
  for (const id of ["q3", "q3b", "q3c", "q3d", "q4", "q4a", "q4b", "q5b", "q5c"]) assert.ok(s3.includes(`<!-- pit-rerun-correction:${id} -->`), "stats-3 box " + id);
  assert.ok(s3.includes("-15.43") && s3.includes("16.7%") && s3.includes("+3.43"), "the old numbers are still on the stats-3 page");
  const ld = R("deliverables/20260928/leaders/LEADERS.html"); assert.ok(ld.includes("<!-- pit-rerun-correction:rot -->")); assert.ok(ld.includes("+11.2%") || ld.includes("11.2%"), "old rotation numbers stay");
  const pit = R("deliverables/20260928/point-in-time/POINT-IN-TIME.html"); assert.ok(pit.includes('id="studies"') && pit.includes("re-run page"), "the status section");
  assert.ok(R("deliverables/20260928/studies-index/STUDIES.html").includes("/deliverables/20260928/pit-rerun/PIT-RERUN.html"));
  const boxes = R("research/statistics/point-in-time/pit-corrections.mjs"); assert.ok(!/\b(16\.7|-15\.43|\+3\.43)\b/.test(boxes), "no number is typed into the box generator");
});

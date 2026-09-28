/* STATS-3 (28 Sep) · fixture tests: the Python arithmetic against the Hub's own maths, and the delivered page's integrity. */
import test from "node:test"; import assert from "node:assert/strict";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { spawnSync } from "node:child_process";
import { rsiLast } from "../deliverables/20260927/geiger-review/geiger-replay.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."); const DIR = path.join(ROOT, "deliverables/20260928/stats-3"); const PY = path.join(ROOT, "research/statistics/stats-3");
const py = (code) => spawnSync("python3", ["-c", code], { cwd: PY, encoding: "utf8" });
const hasPy = py("import numpy, pandas").status === 0;

test("Python RSI(14) equals the Hub's rsiLast on the same 230 closes", { skip: !hasPy && "python3 with numpy/pandas not available" }, () => {
  const c = Array.from({ length: 230 }, (_, i) => 100 + 10 * Math.sin(i / 7) + (i % 5) * 0.3 + i * 0.05);
  const r = py(`import json,lib,numpy as np; print(lib.rsi(np.array(${JSON.stringify(c)}))[-1])`); assert.equal(r.status, 0, r.stderr);
  assert.ok(Math.abs(parseFloat(r.stdout) - rsiLast(c)) < 1e-9, `${r.stdout} vs ${rsiLast(c)}`);
});
test("own-history percentile uses only prior values and needs 250 of them", { skip: !hasPy && "python3 not available" }, () => {
  const r = py(`import lib,numpy as np; x=np.arange(300.0); p=lib.own_pct(x); print(np.isnan(p[249]), p[250], p[299])`); assert.equal(r.status, 0, r.stderr);
  const [nan, p250, p299] = r.stdout.trim().split(" "); assert.equal(nan, "True"); assert.equal(parseFloat(p250), 100); assert.equal(parseFloat(p299), 100);
  const r2 = py(`import lib,numpy as np; x=np.r_[np.arange(300.0), 0.0]; print(lib.own_pct(x)[-1])`); assert.ok(parseFloat(r2.stdout) < 1, "a new low reads under 1");
});
test("Benjamini–Hochberg matches the Node method library on a fixture", { skip: !hasPy && "python3 not available" }, async () => {
  const { benjaminiHochberg } = await import("../research/statistics/method/method-lib.mjs");
  const ps = [0.001, 0.02, 0.03, 0.2, 0.5, 0.9, 0.04, 0.6]; const node = benjaminiHochberg(ps, 0.1);
  const r = py(`import lib,json; rej,adj=lib.benjamini_hochberg(${JSON.stringify(ps)},0.1); print(json.dumps([bool(x) for x in rej]))`); assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), node.reject);
});
test("pivot swings: a clean V gives one low between two highs, depth from the top's close", { skip: !hasPy && "python3 not available" }, () => {
  const r = py(`import lib,numpy as np,pandas as pd
c=np.r_[np.linspace(100,120,30), np.linspace(120,90,30), np.linspace(90,130,40)]; df=pd.DataFrame({"o":c,"h":c+0.5,"l":c-0.5,"c":c}, index=pd.date_range("2020-01-01",periods=len(c),freq="B"))
L=lib.swing_lows(df); print(len(L), round(L[0]["depth"],1), L[0]["fallBars"])`); assert.equal(r.status, 0, r.stderr);
  const [n, depth, bars] = r.stdout.trim().split(" "); assert.equal(n, "1"); assert.equal(depth, "-25.0"); assert.equal(bars, "30");
});
test("the page exists, carries the BACK / CLOSE pair, and every chart it shows is a saved image", () => {
  const html = fs.readFileSync(path.join(DIR, "STATS-3.html"), "utf8");
  assert.ok(html.includes("<!-- scnav ·"), "scnav pair placed"); assert.ok(html.includes("data-scnav-slot"), "scnav slot");
  const imgs = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]); assert.ok(imgs.length >= 25, `charts on the page: ${imgs.length}`);
  for (const src of imgs) { assert.ok(src.endsWith(".png"), src + " is an image"); assert.ok(fs.existsSync(path.join(DIR, src)), src + " exists"); }
  for (const k of ["What we found", "1 · The Geiger as a statistic", "2 · Confluence", "3 · Below a falling 200-day", "4 · Leaders trail SPY", "5 · USUAL DAY", "6 · Gold", "Follow-ups", "What could be wrong", "What was not done"]) assert.ok(html.includes(k), "section: " + k);
});
test("every data file parses and carries its headline keys", () => {
  const need = { "q1.json": ["byType", "indexToday", "gridTercile", "pullback", "byTypeCell", "ladderStocks"], "q2.json": ["ladders", "combos", "paths", "leads", "today"], "q3.json": ["features", "walkForward", "leadersState", "flags", "today"], "q4.json": ["relSPY", "why", "rules", "bowtie"], "q5.json": ["dnLadder", "oneSided", "triggers", "likeToday"], "q6.json": ["GCUSD", "DXY", "cross"] };
  for (const [f, keys] of Object.entries(need)) { const j = JSON.parse(fs.readFileSync(path.join(DIR, "data", f), "utf8")); for (const k of keys) assert.ok(k in j, `${f} has ${k}`); }
  const q4 = JSON.parse(fs.readFileSync(path.join(DIR, "data/q4.json"), "utf8")); for (const r of q4.rules) assert.ok(["luck-proof", "leaning", "a list", "not shown", "no data"].includes(r.word), "status word on every rule");
});
test("no chart on the page uses white or a coloured (non-grey) line other than green/red", () => {
  // the palette in charts.py is the contract: every colour is a grey (channels within 24) except the two direction colours
  const src = fs.readFileSync(path.join(PY, "charts.py"), "utf8"); const cols = [...src.matchAll(/#([0-9A-Fa-f]{6})/g)].map((m) => m[1].toUpperCase());
  for (const h of cols) { const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); if (h === "00FFA3" || h === "FF2D55") continue; assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24 && Math.max(r, g, b) <= 210, "grey: #" + h); }
});

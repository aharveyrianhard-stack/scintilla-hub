// N8 · Pine Geiger table — static checks on the paste-ready script, and the script's maths (its JS port)
// against the publisher-copied replay. No network.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { rungRead } from "../deliverables/20260928/pine-geiger/pine-port.mjs";
import { rungReading } from "../deliverables/20260927/geiger-review/geiger-replay.mjs";

const DIR = new URL("../deliverables/20260928/pine-geiger/", import.meta.url);
const pine = fs.readFileSync(new URL("SCINTILLA-GEIGER-TABLE.pine", DIR), "utf8");
const code = pine.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

test("the script is Pine v6 and declares its budget in the header", () => {
  assert.match(pine, /^\/\/@version=6\n/);
  assert.match(pine, /PLOTS 0\/64/);
  assert.match(pine, /REQUESTS 40\/40/);
});

test("no plot budget is spent: no plot(), plotshape(), fill() or bgcolor()", () => {
  for (const f of ["plot(", "plotshape(", "plotchar(", "plotcandle(", "plotbar(", "fill(", "bgcolor(", "hline("]) {
    assert.ok(!new RegExp(`(^|[^.\\w])${f.replace("(", "\\(")}`).test(code), f);
  }
});

test("request.security stays at 40: two calls in geigerRow, twenty rows", () => {
  assert.equal((code.match(/request\.security\(/g) || []).length, 2);
  assert.equal((code.match(/= geigerRow\(s\d\d\)/g) || []).length, 20);
});

test("default weights are today's saved Equalizer (as /geiger reported during the check)", () => {
  const val = JSON.parse(fs.readFileSync(new URL("validation.json", DIR), "utf8"));
  const name = { "3h": "w3h", "4h": "w4h", "6h": "w6h", "12h": "w12h", "1d": "w1d", "3d": "w3d", "1w": "w1w" };
  assert.equal(val.participating_rungs.length, 7);
  for (const r of val.participating_rungs) {
    const m = pine.match(new RegExp(`float ${name[r.equalizer_key]}\\s*=\\s*input\\.float\\(([0-9.]+)`));
    assert.ok(m, r.equalizer_key);
    assert.equal(+m[1], r.weight, r.equalizer_key);
  }
  assert.match(pine, /float famT = input\.float\(0\.5,/);
  assert.match(pine, /float famM = input\.float\(0\.5,/);
  assert.match(pine, /float mixR = input\.float\(0\.6,/);
  assert.match(pine, /float mixW = input\.float\(0\.4,/);
});

test("the default list is the 11 SPDR sectors + SPY QQQ IWM DIA RSP", () => {
  const a = [...pine.matchAll(/= pick\("([A-Z]*:?[A-Z]*)"/g)].map((m) => m[1].split(":").pop()).filter(Boolean);
  assert.deepEqual(a, ["XLB", "XLE", "XLF", "XLI", "XLK", "XLP", "XLRE", "XLU", "XLV", "XLY", "XLC", "SPY", "QQQ", "IWM", "DIA", "RSP"]);
});

test("the table's greys follow the look rule; colour only for direction", () => {
  const cols = [...pine.matchAll(/const color (C_\w+)\s*=\s*#([0-9A-Fa-f]{6})/g)];
  for (const [, n, hex] of cols) {
    if (n === "C_BULL" || n === "C_BEAR") continue;
    const ch = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(Math.max(...ch) - Math.min(...ch) <= 24 && Math.max(...ch) <= 210, `${n} #${hex}`);
  }
});

// deterministic pseudo-random walks
function walk(n, seed, start = 100) {
  let s = seed >>> 0, p = start; const out = [];
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < n; i++) { p *= 1 + (r() - 0.5) * 0.04; const h = p * (1 + r() * 0.01), l = p * (1 - r() * 0.01); out.push({ c: p, h, l }); }
  return out;
}

test("the script's rung maths equals the publisher's at every window length", () => {
  for (const n of [8, 12, 15, 20, 33, 49, 50, 99, 150, 199, 200, 230]) {
    for (const seed of [1, 7, 42]) {
      const b = walk(n, seed + n);
      const mine = rungRead(b.map((x) => x.c), b.map((x) => x.h), b.map((x) => x.l));
      const ref = rungReading(b);
      assert.ok(mine && ref, `n=${n}`);
      assert.equal(mine.trend, ref.trend, `trend n=${n}`);
      assert.equal(mine.lines, ref.fanLines, `lines n=${n}`);
      if (ref.momentum == null) assert.equal(mine.mom, null);
      else assert.ok(Math.abs(mine.mom - ref.momentum) < 1e-12, `mom n=${n}`);
      assert.ok(Math.abs(mine.comp - ref.composite) < 1e-12, `comp n=${n}`);
    }
  }
});

test("under 8 bars there is no reading (one fan line cannot form a pair)", () => {
  const b = walk(7, 3);
  assert.equal(rungRead(b.map((x) => x.c), b.map((x) => x.h), b.map((x) => x.l)), null);
});

test("the recorded check: script maths within 1e-6 of the live Geiger on all ten symbols", () => {
  const val = JSON.parse(fs.readFileSync(new URL("validation.json", DIR), "utf8"));
  assert.equal(Object.keys(val.maths).length, 10);
  for (const [s, m] of Object.entries(val.maths)) assert.ok(Math.abs(m.pine.composite - m.live.composite) < 1e-6, s);
});

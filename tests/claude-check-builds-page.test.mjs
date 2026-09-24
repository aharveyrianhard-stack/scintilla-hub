/* The page and the snapshot it reads. These tests run against the files as they ship: if the
   snapshot is missing a number, or a card shows a word with nothing behind it, or a colour on
   the page is not a grey, they fail here rather than on Alan's screen. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const PAGE = "deliverables/20260924/claude-check-builds/builds.html";
const html = readFileSync(PAGE, "utf8");
const read = (n) => JSON.parse(readFileSync(`data/claude-check/${n}.json`, "utf8"));
const rules = JSON.parse(readFileSync("data/claude-check-rules.json", "utf8"));
const [verdicts, participation, squeeze, unfinished, waits] =
  ["verdicts", "participation", "squeeze", "unfinished", "waits"].map(read);

test("the page reads every snapshot file it draws, and nothing else fetches", () => {
  for (const n of ["verdicts", "participation", "squeeze", "unfinished", "waits"]) {
    assert.ok(existsSync(`data/claude-check/${n}.json`), `${n}.json is missing`);
    assert.ok(html.includes(n), `the page never asks for ${n}`);
  }
  assert.equal(html.match(/fetch\(/g).length, 1, "one fetch, of the snapshot; the page calls no provider");
  assert.ok(!/scintilla-massive-chart-api/.test(html), "the page must not call the chart API on load");
});

test("every measurement on the page carries where it came from and when", () => {
  for (const [n, d] of Object.entries({ verdicts, participation, squeeze, unfinished, waits })) {
    const m = d.manifest;
    assert.ok(m?.measured_utc && !Number.isNaN(Date.parse(m.measured_utc)), `${n} has no measured time`);
    assert.ok(m.source.includes("/candles"), `${n} does not name its source`);
    assert.ok(m.universe_sha256, `${n} does not pin the universe it counted`);
    assert.equal(m.rules_version, rules.version);
  }
});

test("a verdict card never shows a word without the number and the rule behind it", () => {
  assert.ok(verdicts.cards.length >= 10, "Geiger, both breadth counts and the eight rails");
  for (const c of verdicts.cards) {
    assert.ok(c.title && c.key, "a card must say which measure it is");
    for (const side of ["saved", "baseline"]) {
      const v = c[side];
      assert.ok(v, `${c.key} has no ${side} reading`);
      if (v.word == null) { assert.ok(v.reason, `${c.key}.${side} shows no word and gives no reason`); continue; }
      assert.ok(Number.isFinite(v.value), `${c.key}.${side} shows ${v.word} with no number`);
      assert.ok(rules.rules[v.rule_id], `${c.key} names a rule that does not exist: ${v.rule_id}`);
      assert.ok(["measured", "estimate"].includes(v.tag), `${c.key} is not tagged`);
    }
    assert.ok(c.spark ? c.spark.length > 3 : typeof c.spark_missing === "string" && c.spark_missing.length > 10,
      `${c.key} has no line and does not say why`);
  }
});

test("the wording rules are data, and every measure has a band that always catches", () => {
  for (const [id, r] of Object.entries(rules.rules)) {
    assert.equal(r.id, id);
    assert.ok(r.bands.length >= 2 && r.bands.every((b) => b.word && b.says));
    assert.equal(r.bands.filter((b) => b.from === null).length, 1, `${id} needs exactly one catch-all band`);
    assert.equal(r.bands[r.bands.length - 1].from, null, `${id}'s catch-all must be last so the file reads top down`);
    const floors = r.bands.slice(0, -1).map((b) => b.from);
    assert.deepEqual(floors, [...floors].sort((a, b) => b - a), `${id}'s bands must be written high to low`);
  }
});

test("a rung is either counted on our own bars or tagged as the post's rule of thumb", () => {
  const rungs = Object.values(waits.rungs);
  assert.equal(rungs.length, 8, "Alan's saved Equalizer has eight rungs");
  for (const r of rungs) {
    if (r.n >= r.min_n && r.median_days != null) {
      assert.ok(r.p25_days <= r.median_days && r.median_days <= r.p75_days, `${r.rung}: the range must hold the middle`);
      assert.ok(r.hit_rate > 0 && r.hit_rate <= 1, `${r.rung}: a hit rate must be a share`);
      assert.ok(r.how.includes("RSI") && r.target_basis.includes("own usual bar"),
        `${r.rung}: the counting rule must be stated, and the move must be scaled to that rung`);
    } else {
      assert.ok(r.why, `${r.rung}: an uncounted rung must say why`);
    }
  }
  const slow = waits.rungs["1w"].median_days, fast = waits.rungs["2h"].median_days;
  assert.ok(slow > fast, "a weekly reading cannot resolve faster than a two-hour one");
});

test("participation counts only sessions where most of the universe reported", () => {
  assert.ok(participation.weekly.length > 100, "2023 to now is well over a hundred weeks");
  const half = participation.manifest.universe / 2;
  for (const w of participation.weekly) {
    assert.ok(w.of >= half, `${w.week} was counted on only ${w.of} names`);
    assert.ok(w.pct >= 0 && w.pct <= 100);
    assert.equal(Math.round((100 * w.above) / w.of), Math.round(w.pct), `${w.week}: the share must be the count`);
  }
  assert.ok(participation.note.includes("not the S&P 500"), "the page must not let this pass as the index");
});

test("the peaks line is drawn through peaks that are really in the series", () => {
  const p = participation.peaks;
  assert.ok(p.n >= 3, "fewer than three peaks would mean no line at all");
  const byWeek = new Map(participation.weekly.map((w) => [w.week, Math.round(w.pct * 10) / 10]));
  for (const pt of p.points) assert.equal(byWeek.get(pt.week), pt.pct, `${pt.week} is not a reading on the chart`);
  assert.ok(["thinner", "broader", "flat"].includes(p.direction));
  assert.equal(p.direction === "thinner", p.slope_per_year < 0);
});

test("a squeeze is ranked against the name's own history, and the candidate flag follows the rule", () => {
  for (const s of squeeze.names) {
    assert.ok(s.pctile >= 0 && s.pctile <= 100, `${s.sym}: a percentile must be a percentile`);
    assert.ok(s.width > 0, `${s.sym}: a band width of zero would mean a price that never moved`);
    assert.equal(s.candidate, s.pctile <= squeeze.tight_threshold_pctile, `${s.sym}: the flag must follow the stated cut-off`);
    assert.ok(s.tightest_since || s.tightest_in_lookback, `${s.sym}: it must say when it was last this tight`);
    assert.ok(s.lookback > 100, `${s.sym}: too short a lookback to rank against`);
  }
  assert.ok(html.includes("direction unknown"), "the squeeze must never imply which way it breaks");
});

test("a standing level really is long, really is unfilled, and says how far it is from here", () => {
  const min = Number(unfinished.rule.match(/at least ([\d.]+)x/)[1]);
  for (const l of unfinished.levels) {
    assert.ok(l.wick_atr >= min, `${l.sym} ${l.session}: ${l.wick_atr}x is under the stated ${min}x`);
    assert.ok(["up", "down"].includes(l.side));
    assert.ok(l.bars_standing >= 0 && Number.isFinite(l.distance_pct));
    assert.ok(l.says.includes(String(l.level)), "the row must state the level it is talking about");
  }
  assert.ok(unfinished.how_rare.some((r) => r.threshold === 2),
    "the page must show how many levels a stricter bar would leave");
  assert.ok(unfinished.intraday.includes("minute bars"), "it must say plainly that intraday was not measured");
});

test("colour is used for direction only: every other colour on the page is a grey", () => {
  const allowed = new Set(["#00FFA3", "#FF2D55"]);          // up and down, Alan's rule
  for (const hex of html.match(/#[0-9A-Fa-f]{6}\b/g) ?? []) {
    if (allowed.has(hex.toUpperCase())) continue;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24, `${hex} is not a grey`);
    assert.ok(Math.max(r, g, b) <= 210, `${hex} is brighter than the 210 ceiling`);
  }
  /* the data lines are drawn one segment at a time, so their colour is written as an expression:
     stroke="var(--${up ? "up" : "dn"})". Count those, then check every fixed stroke as well. */
  const perSegment = html.match(/stroke="var\(--\$\{[^}]+\}\)"/g) ?? [];
  assert.ok(perSegment.length >= 3, `only ${perSegment.length} lines carry the direction colour`);
  const col = html.match(/const col = [^;]+;/)?.[0] ?? "";
  assert.ok(col.includes('"dn"') && col.includes('"up"'), "the peaks line picks its colour from its own slope");
  const fixed = [...html.matchAll(/stroke="var\(--([a-z0-9]+)\)"/g)].map((m) => m[1]);
  for (const s of fixed) assert.ok(["up", "dn", "line", "line2"].includes(s), `a line is painted --${s}, which is neither direction nor furniture`);
});

test("the page reads at 11px and carries the way back", () => {
  const sizes = [...html.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => +m[1]);
  assert.ok(sizes.length > 5);
  const prose = [...html.matchAll(/\.(note|row|basis|says|legend)\{[^}]*font-size:\s*([\d.]+)px/g)].map((m) => +m[2]);
  for (const s of prose) assert.ok(s >= 11, `body text at ${s}px is under the 11px floor`);
  assert.ok(html.includes("scnav"), "every Hub sub-page carries the BACK / CLOSE pair");
  assert.ok(/viewport/.test(html) && html.includes("max-width:560px"), "the page must answer at phone width");
});

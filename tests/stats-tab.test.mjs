/* STATS-TAB (28 Sep) — the curated Statistics tab prototype: deliverables/20260928/stats-tab/.
   Alan: "start to see visuals of the statistical analysis, graphics that get saved… a statistics master tab on the
   Hub — careful, don't make it a dump yard." These tests hold the tab to its own rules:
   · every card in findings.json carries a question, a measured answer with its uncertainty, a sample and date range,
     a study link that exists, a review, and a saved chart in both sizes that exists and parses as XML;
   · no grey marks: every mark is the up or the down colour; a share is green at/above its reference, red below;
   · a bar starts at zero (a raised floor is refused); shares vs a line are dots with ranges, hollow when the range
     crosses the line, or diverging bars of the difference;
   · the entry rules (28 Sep review): on the tab only with a pivot horizon, a full-distribution cut and a review that
     was not part of choosing the finding — everything else is held back, with the reason printed;
   · every grey in the palette is a Scintilla grey (channels within 24, none above 210);
   · text inside a chart is never below 11.5px at the size it is drawn;
   · a two-series chart tells the series apart by texture and carries a legend;
   · the page inlines the same SVG it saved, and shows a candidate lane only as a name, never as a card;
   · the numbers on the cards are the published S8/S9 numbers, not retyped.
   Offline: no network, no browser. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PAL, isScintillaGrey, markColour, niceTicks, wrap, barsPanel, stepsChart, barsChart, twoPanelChart, rangeChart, rangeVerdict, curveChart } from "../deliverables/20260928/stats-tab/charts.mjs";
import { entryFaults, ENTRY } from "../deliverables/20260928/stats-tab/entry.mjs";

const DIR = join(process.cwd(), "deliverables", "20260928", "stats-tab");
const manifest = JSON.parse(readFileSync(join(DIR, "findings.json"), "utf8"));
const page = readFileSync(join(DIR, "index.html"), "utf8");
const fixture = JSON.parse(readFileSync(join(process.cwd(), "tests", "fixtures", "stats-tab-fixture.json"), "utf8"));
const S8 = JSON.parse(readFileSync(join(process.cwd(), "research/statistics/data/s8-summary.json"), "utf8"));
const S9 = JSON.parse(readFileSync(join(process.cwd(), "research/statistics/data/s9-research.json"), "utf8"));
const L = JSON.parse(readFileSync(join(process.cwd(), "research/statistics/data/s8-ladder.json"), "utf8"));
const P = (v) => Number(v).toFixed(1) + "%";   // the cards print every share with one decimal (67 → "67.0%")

/* ── the palette and the colour rule ───────────────────────────────────────────────────────────────── */
test("every grey in the palette is a Scintilla grey; up and down are the S8/S9 colours", () => {
  for (const k of ["bg", "panel", "hair", "ink", "muted", "faint"]) assert.ok(isScintillaGrey(PAL[k]), `${k} ${PAL[k]}`);
  assert.equal(PAL.up, "#00FFA3"); assert.equal(PAL.dn, "#FF2D55");
  assert.ok(!isScintillaGrey("#FFFFFF"), "white is not a grey here"); assert.ok(!isScintillaGrey("#C8C8F0"), "a tint is not a grey");
});
test("markColour: a share is green at/above its reference and red below; a fear measure is red; no grey, no silent default", () => {
  assert.equal(markColour(74.8, 67.2), PAL.up);
  assert.equal(markColour(54.3, 61.0), PAL.dn);
  assert.equal(markColour(67.2, 67.2), PAL.up, "at the line counts as above");
  assert.equal(markColour(30.6, null, "down"), PAL.dn);
  assert.equal(markColour(-2.5, null, "sign"), PAL.dn);
  assert.throws(() => markColour(50, null), /reference/);
});
test("niceTicks reads 40, 50, 60 … never 53, 65, 78", () => {
  assert.deepEqual(niceTicks(40, 90, 5), [40, 50, 60, 70, 80, 90]);
  assert.deepEqual(niceTicks(50, 65, 5), [50, 55, 60, 65]);
  assert.deepEqual(niceTicks(0, 70, 4), [0, 20, 40, 60]);
  for (const t of niceTicks(40, 100, 5)) assert.equal(t % 10, 0);
});
test("wrap never returns a line over budget unless a single word is", () => {
  const lines = wrap("SPY by its distance from the 200-day: up after 60 sessions, and how often a 10% drop followed", 40);
  assert.ok(lines.length >= 2); for (const l of lines) assert.ok(l.length <= 40, l);
  assert.deepEqual(wrap("", 10), []);
});

/* ── the drawing, on a fixture ──────────────────────────────────────────────────────────────────────── */
const marks = (svg) => [...svg.matchAll(/<g class="mark" data-col="(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1]);
const fonts = (svg) => [...svg.matchAll(/font-size="([\d.]+)"/g)].map((m) => +m[1]);
const allCards = [...manifest.cards, ...manifest.heldBack];

test("fixture bars: colours follow the reference line, bars start at zero, values in ink with a halo, counts under the groups", () => {
  const svg = barsChart({ id: "fx", title: "t", subtitle: "s", footer: "f", groups: fixture.groups, ref: fixture.ref, yMax: 100 });
  const cols = marks(svg);
  assert.deepEqual(cols, fixture.groups.map((g) => (g.bars[0].value >= fixture.ref.value ? PAL.up : PAL.dn)));
  assert.ok(!cols.some((c) => isScintillaGrey(c)), "no grey mark");
  assert.ok(svg.includes(`fill="${PAL.ink}" paint-order="stroke"`), "value labels in ink with a halo");
  assert.ok(svg.includes(">36 declines<"), "count under the group");
  assert.ok(svg.includes("stroke-dasharray"), "the reference line is drawn");
  assert.ok(svg.includes(fixture.ref.label), "and named in the legend");
  assert.ok(Math.min(...fonts(svg)) >= 11, "no text under 11px");
  /* the bar for 80.6 on a 0..100 axis is 80.6% of the plot height tall: height is proportional to the value */
  const rects = [...svg.matchAll(/<g class="mark"[^>]*>[\s\S]*?<rect[^>]*y="([\d.]+)" width="[\d.]+" height="([\d.]+)"/g)].map((m) => [+m[1], +m[2]]);
  const bottoms = rects.map(([y, h]) => +(y + h).toFixed(0));
  assert.equal(new Set(bottoms).size, 1, "every bar stands on the same zero line");
  assert.ok(Math.abs(rects[0][1] / rects[2][1] - 80.6 / 25) < 0.05, "bar heights keep the ratio of the values");
});
test("a bar that starts above zero is refused; a diverging bar hangs from zero", () => {
  assert.throws(() => barsChart({ id: "fz", title: "t", groups: fixture.groups, ref: fixture.ref, yMin: 40, yMax: 100 }), /starts at zero/);
  const svg = barsChart({ id: "fd", title: "t", groups: [{ label: "a", bars: [{ value: -10.6 }] }, { label: "b", bars: [{ value: 4.5 }] }], mode: "sign", unit: "pts", yMin: -15, yMax: 5, valueFmt: (v) => (v > 0 ? "+" : "") + v.toFixed(1) });
  assert.deepEqual(marks(svg), [PAL.dn, PAL.up]);
  assert.ok(svg.includes(">-10.6<") && svg.includes(">+4.5<"));
  assert.ok(svg.includes(">+5<") && svg.includes(">-15<"), "signed point ticks");
});
test("fixture steps (two series): stripes on the second series, a legend with both series and both any-day lines", () => {
  const svg = stepsChart({ id: "fs", title: "t", subtitle: "s", footer: "f", steps: fixture.steps, series: fixture.series, refs: fixture.refs });
  assert.ok(svg.includes('fill="url(#fs-stripe)"'), "second series striped");
  for (const se of fixture.series) assert.ok(svg.includes(se.label));
  for (const r of fixture.refs) assert.ok(svg.includes(r.label));
  const cols = marks(svg);
  assert.equal(cols.length, fixture.steps.length * 2);
  fixture.steps.forEach((st, gi) => st.values.forEach((v, i) => assert.equal(cols[gi * 2 + i], v >= fixture.refs[i].value ? PAL.up : PAL.dn, `${st.label} series ${i}`)));
});
test("dots and ranges: colour by the dot's side of its line; hollow when the range crosses it; circle vs diamond for two series", () => {
  assert.equal(rangeVerdict(60, 70, 56), "above"); assert.equal(rangeVerdict(40, 50, 56), "below"); assert.equal(rangeVerdict(56.3, 62.5, 56.4), "crosses");
  const groups = fixture.steps.map((st, gi) => ({ label: st.label, marks: st.values.map((v, i) => ({ value: v, lo: fixture.ranges[gi][i][0], hi: fixture.ranges[gi][i][1], n: st.n[i], ref: fixture.refs[i].value })) }));
  const svg = rangeChart({ id: "fr", title: "t", subtitle: "s", footer: "f", groups, series: fixture.series, refs: fixture.refs, yMin: 30, yMax: 95 });
  const cols = marks(svg), verdicts = [...svg.matchAll(/data-verdict="(\w+)"/g)].map((m) => m[1]);
  groups.forEach((g, gi) => g.marks.forEach((m, i) => {
    assert.equal(cols[gi * 2 + i], m.value >= m.ref ? PAL.up : PAL.dn);
    assert.equal(verdicts[gi * 2 + i], rangeVerdict(m.lo, m.hi, m.ref));
  }));
  assert.ok(verdicts.includes("crosses") && verdicts.includes("above"), "the fixture has both kinds");
  assert.ok(svg.includes(`fill="${PAL.bg}" stroke="${PAL.up}"`) || svg.includes(`fill="${PAL.bg}" stroke="${PAL.dn}"`), "a crossing range draws a hollow dot");
  assert.ok(svg.includes("<path d=\"M"), "the second series is a diamond");
  assert.ok(svg.includes("hollow = range crosses it"), "the legend says what hollow means");
  assert.ok(!/<rect[^>]*class="mark"/.test(svg) && !svg.includes('<g class="mark" data-col="#00FFA3" data-verdict="above" data-tip="x"><rect'), "no bars");
});
test("curve: each point is coloured against its own instrument's line; the thin tail fades instead of being cut", () => {
  const svg = curveChart({ id: "fc", title: "t", subtitle: "s", footer: "f", xMax: 10, series: fixture.curve.map((c) => ({ label: c.label, ref: { value: c.ref, label: `${c.label} ${c.ref}` }, points: c.points })) });
  const cols = marks(svg), exp = fixture.curve.flatMap((c) => c.points.map((p) => (p.y >= c.ref ? PAL.up : PAL.dn)));
  assert.deepEqual(cols, exp);
  const ops = [...svg.matchAll(/<circle[^>]*fill-opacity="([\d.]+)"/g)].map((m) => +m[1]);
  assert.equal(ops.length, exp.length, "every point is drawn, none cut off");
  assert.ok(ops[0] > ops[fixture.curve[0].points.length - 1], "the point with more declines is brighter than the tail");
  assert.ok(svg.includes('stroke-dasharray="8 5"'), "the second instrument is a dashed line");
});
test("fixture two-panel: diverging top panel from zero, the drop share in the down colour", () => {
  const svg = twoPanelChart({ id: "ft", title: "t", subtitle: "s", footer: "f", groups: fixture.bands.map((b) => ({ ...b, d: +(b.up60 - 72.1).toFixed(1) })), panels: [
    { key: "d", label: "up 60 vs any day", mode: "sign", unit: "pts", yMin: -15, yMax: 10 },
    { key: "mdd60Bad", label: "drop", mode: "down", yMax: 50 }] });
  const cols = marks(svg), n = fixture.bands.length;
  assert.equal(cols.length, 2 * n);
  fixture.bands.forEach((b, i) => assert.equal(cols[i], b.up60 >= 72.1 ? PAL.up : PAL.dn));
  for (let i = n; i < 2 * n; i++) assert.equal(cols[i], PAL.dn);
});
test("the phone variant redraws at 390 with 13px labels; crowded axes rotate and crowded values round", () => {
  const three = barsPanel({ id: "fp", x: 0, y: 0, w: 390, h: 300, groups: fixture.groups, refs: [fixture.ref], yMax: 100, compact: true });
  assert.ok(three.includes('font-size="13"'));
  assert.ok(three.includes(">36 declines<"), "three groups at 390: the count and its word fit");
  const six = barsPanel({ id: "fp9", x: 0, y: 0, w: 390, h: 300, groups: [...fixture.groups, ...fixture.groups, ...fixture.groups], refs: [fixture.ref], yMax: 100, compact: true });
  assert.ok(six.includes("rotate(-38"), "nine groups at 390: the labels hang at 38° instead of colliding");
  assert.ok(!six.includes(">36 declines<") && !six.includes(">36<"), "and the count leaves the axis…");
  assert.ok(six.includes("n 36"), "…for the tip");
  assert.ok(!three.includes("rotate(-38"), "three groups at 390 do not rotate");
  assert.ok(six.includes(">81%<") && !six.includes(">80.6%<"), "crowded bars print the rounded value");
  assert.ok(six.includes("80.6%"), "and the exact value stays in the tip");
  assert.ok(Math.min(...fonts(six)) >= 12);
});

/* ── the entry rules ────────────────────────────────────────────────────────────────────────────────── */
test("entry rules: a fixed window, a forced cut-off or a missing review holds a card back, with the reason", () => {
  const ok = { method: { horizon: { kind: "pivot", text: "next swing" }, cutoffs: { kind: "full", text: "every percent" } }, review: { status: "reviewed", by: "QQQ and IWM" } };
  assert.deepEqual(entryFaults(ok), []);
  assert.match(entryFaults({ ...ok, method: { ...ok.method, horizon: { kind: "sessions", text: "up after 20 sessions" } } })[0], /fixed window: up after 20 sessions/);
  assert.match(entryFaults({ ...ok, method: { ...ok.method, cutoffs: { kind: "fixed", text: "bottom 10%" } } })[0], /forced cut-off: bottom 10%/);
  assert.match(entryFaults({ ...ok, review: { status: "unreviewed", by: "picked on both halves" } })[0], /not reviewed/);
  assert.equal(entryFaults({}).length, 3, "a card that states no method fails every rule");
  assert.equal(ENTRY.length, 3);
});

/* ── the manifest: the only door onto the tab ───────────────────────────────────────────────────────── */
test("every card (on the tab or held back) carries its parts, and its chart files exist, parse and use only up/down marks", () => {
  assert.ok(manifest.cards.length >= 1 && manifest.cards.length <= 12, `cards ${manifest.cards.length}`);
  for (const c of allCards) {
    for (const k of manifest.rules) assert.ok(c[k] != null && c[k] !== "", `${c.id} lacks ${k}`);
    assert.ok(/\?$/.test(c.question), `${c.id}: the question is a question`);
    assert.ok(/\d/.test(c.answer), `${c.id}: the answer carries numbers`);
    assert.ok(/\d/.test(c.uncertainty), `${c.id}: the uncertainty carries a number`);
    assert.ok(c.sample.from && c.sample.to && c.sample.days > 0 && c.sample.episodes > 0, `${c.id}: sample`);
    assert.ok(manifest.studies[c.study], `${c.id}: study ${c.study} listed`);
    assert.ok(existsSync(join(process.cwd(), manifest.studies[c.study].page.slice(1))), `${c.id}: study page exists`);
    assert.ok(existsSync(join(process.cwd(), manifest.studies[c.study].json.slice(1))), `${c.id}: study numbers exist`);
    assert.ok(c.review.by.length > 10);
    assert.ok(manifest.themes.some((t) => t.id === c.theme), `${c.id}: theme`);
    for (const k of ["desk", "phone"]) {
      const f = join(DIR, c.chart.files[k]);
      assert.ok(existsSync(f), `${c.id}: ${k} chart saved`);
      assert.match(c.chart.files[k], /^charts\/\d{8}-[a-z0-9-]+-(1200|390)\.svg$/, "dated file name");
      const svg = readFileSync(f, "utf8");
      assert.ok(svg.startsWith("<svg") && svg.trim().endsWith("</svg>"));
      const open = svg.slice(0, svg.indexOf(">") + 1), rest = open.replace(/^<svg/, "").replace(/\s+[\w:-]+="[^"]*"/g, "").trim();
      assert.equal(rest, ">", `${c.id} ${k}: the <svg> tag's attributes are well-formed`);
      assert.ok(svg.includes("built ") && svg.includes(c.study), `${c.id}: the chart names its study and build date`);
      assert.ok(Math.min(...fonts(svg)) >= 11, `${c.id} ${k}: no text under 11px`);
      const cols = marks(svg); assert.ok(cols.length > 0); assert.ok(cols.every((x) => x === PAL.up || x === PAL.dn), `${c.id} ${k}: only up/down marks`);
    }
  }
  const files = new Set(allCards.flatMap((c) => [c.chart.files.desk, c.chart.files.phone]));
  assert.equal(files.size, allCards.length * 2, "one desk and one phone file per card");
});
test("the tab holds only cards that pass the entry rules; every held-back card says why", () => {
  for (const c of manifest.cards) {
    assert.deepEqual(entryFaults(c), [], c.id);
    assert.equal(c.method.horizon.kind, "pivot"); assert.equal(c.method.cutoffs.kind, "full"); assert.equal(c.review.status, "reviewed");
  }
  for (const c of manifest.heldBack) { assert.ok(c.heldBecause.length > 0, c.id); assert.deepEqual(c.heldBecause, entryFaults(c)); }
  const ids = (a) => a.map((c) => c.id).sort();
  assert.deepEqual(ids(manifest.cards), ["fear-vix-at-spy-swing-lows", "pullbacks-spy-fallen-so-far-to-new-high"]);
  assert.deepEqual(ids(manifest.heldBack), ["execution-best-combo-both-halves", "market-spy-low-rsi-vs-200day", "pullbacks-spy-200day-band", "rsi-stock-own-percentile-vs-any-day"]);
});
test("each of Alan's six themes is present, in his order, and every card sits under one", () => {
  assert.deepEqual(manifest.themes.map((t) => t.id), ["market", "pullbacks", "rsi", "fear", "leaders", "execution"]);
  for (const t of manifest.themes) assert.ok(t.why.length > 20);
});
test("a lane still measuring is a candidate by name, never a card", () => {
  assert.ok(manifest.candidates.length >= 5);
  for (const x of manifest.candidates) { assert.ok(!allCards.some((c) => c.id.includes(x.lane)), x.lane); assert.ok(x.state.length > 5); }
  assert.ok(manifest.candidates.some((x) => x.theme === "leaders"), "leaders has only candidates today");
  assert.ok(!allCards.some((c) => c.theme === "leaders"), "and no card");
});

/* ── the page ───────────────────────────────────────────────────────────────────────────────────────── */
test("the page inlines the saved SVG for every card, both sizes, and links the study, the numbers and the file", () => {
  for (const c of allCards) {
    assert.ok(page.includes(`id="${c.id}"`), c.id);
    for (const k of ["desk", "phone"]) {
      const svg = readFileSync(join(DIR, c.chart.files[k]), "utf8");
      assert.ok(page.includes(svg), `${c.id} ${k}: the page carries the same bytes as the saved file`);
      assert.ok(page.includes(`href="${c.chart.files[k]}"`), `${c.id} ${k}: download link`);
    }
    assert.ok(page.includes(manifest.studies[c.study].page) && page.includes(manifest.studies[c.study].json));
  }
  const heldAt = page.indexOf('<details class="heldback"');
  assert.ok(heldAt > 0, "held-back cards sit in their own fold");
  for (const c of manifest.heldBack) assert.ok(page.indexOf(`<article class="card held" id="${c.id}"`) > heldAt, `${c.id} is below the tab`);
  for (const c of manifest.cards) assert.ok(page.indexOf(`id="${c.id}"`) < heldAt, `${c.id} is on the tab`);
  assert.ok(page.includes('<div data-scnav-slot></div>'), "the BACK / CLOSE pair has its slot");
  assert.ok(page.includes(".viz .desk{display:none}.viz .phone{display:block}"), "the phone shows the redrawn chart, not a shrunk one");
  assert.ok(!/font-size:\s*(?:[0-9]|10)(?:\.\d+)?px/.test(page.replace(/<svg[\s\S]*?<\/svg>/g, "")), "no HTML text under 11px");
  assert.ok(page.includes("No finding has passed the entry rules under this theme yet"), "an empty theme says so instead of filling itself");
  assert.ok(page.includes("Measuring now · not on the tab until reviewed"));
});
test("the page's greys obey the grey rule and there is no white", () => {
  const html = page.replace(/<svg[\s\S]*?<\/svg>/g, "");
  const hexes = new Set([...html.matchAll(/#([0-9A-Fa-f]{6})\b/g)].map((m) => "#" + m[1].toUpperCase()));
  for (const h of hexes) assert.ok(isScintillaGrey(h) || h === PAL.up || h === PAL.dn, h);
  assert.ok(!html.includes("#FFFFFF") && !html.includes("#fff;") && !/:\s*white\b/.test(html));
});

/* ── the numbers are the published ones, and the words match them (28 Sep review findings) ──────────── */
const card = (id) => allCards.find((c) => c.id === id);
test("card 1 (SPY above/below the 200-day): no 'Yes'; quotes both published ranges and their overlap", () => {
  const c = card("market-spy-low-rsi-vs-200day"), on = L.indexes.SPY.rows["rsi<=10|on|20"], off = L.indexes.SPY.rows["rsi<=10|off|20"];
  assert.ok(!/^Yes/.test(c.answer));
  for (const v of [on.ep.win, off.ep.win, ...on.ci, ...off.ci, S8.funds.SPY.any.on.win, S8.funds.SPY.any.off.win]) assert.ok(c.answer.includes(Number(v).toFixed(1)), String(v));
  assert.ok(c.answer.includes(`from ${P(Math.max(on.ci[0], off.ci[0]))} to ${P(Math.min(on.ci[1], off.ci[1]))}`), "the overlap");
  assert.ok(/chance/.test(c.answer));
});
test("card 2 (fallen so far → new high): uses what is known during the fall, and shows QQQ and IWM", () => {
  const c = card("pullbacks-spy-fallen-so-far-to-new-high");
  const rec = (t) => S9.instruments[t].all.filter((d) => typeof d.newHigh === "boolean");
  const atX = (t, X) => { const g = rec(t).filter((d) => -d.depth >= X); return [(100 * g.filter((d) => d.newHigh).length) / g.length, g.length]; };
  for (const t of ["SPY", "QQQ", "IWM"]) { const [s, n] = atX(t, 10); assert.ok(c.answer.includes(`${P(s)} of ${n}`) || c.answer.includes(`${n} that got at least 10% deep, ${P(s)}`), t); }
  assert.ok(c.answer.includes(`${P(atX("SPY", 0)[0])}`) && c.answer.includes(`all ${rec("SPY").length} SPY declines`));
  assert.ok(/not repeated in its siblings/.test(c.answer));
  assert.ok(!/the big declines do not/.test(c.review.by), "the old, wrong sensitivity claim is gone");
  assert.ok(c.uncertainty.includes(`from ${S9.sensitivity.SPY["10"].big10} to ${S9.sensitivity.SPY["20"].big10}`), "the pivot-width sensitivity is quoted as it is");
});
test("card 3 (200-day band): numbers from S9", () => {
  const c = card("pullbacks-spy-200day-band"), deep = S9.band.SPY.full.bands.find((b) => b.band === "more than 10% below");
  assert.ok(c.answer.includes(P(deep.up60)) && c.answer.includes(P(deep.mdd60Bad)) && c.answer.includes(P(S9.band.SPY.full.base.up60)));
});
test("card 4 (stock own RSI): quotes the stock row's own range, which reaches the any-day line; no invented '8–20 points'", () => {
  const c = card("rsi-stock-own-percentile-vs-any-day"), f = L.names.fwd["rsi<=5|all|20"], ci = f.ep.ci;
  assert.ok(c.answer.includes(`${ci[0].toFixed(1)}–${ci[1].toFixed(1)}%`), "the stock row's own published range");
  assert.ok(ci[0] < S8.stocks.states[0].any.win, "the published range does reach below the any-day line");
  assert.ok(!c.uncertainty.includes("8–20") && !c.answer.includes("8–20"));
  assert.ok(c.answer.includes(P(f.ep.vs_spy.beat)));
});
test("card 5 (VIX at the lows): one dot per decline, rank correlation computed from the records", () => {
  const c = card("fear-vix-at-spy-swing-lows"), n = S9.instruments.SPY.all.filter((d) => d.vixLow != null).length;
  assert.ok(c.answer.includes(`over ${n} declines`));
  const svg = readFileSync(join(DIR, c.chart.files.desk), "utf8");
  assert.equal(marks(svg).length, n, "every decline is a dot");
});
test("card 6 (best combination): says it was picked on both halves, is not reviewed, and is held back", () => {
  const c = card("execution-best-combo-both-halves");
  assert.ok(!/It held/.test(c.answer) && !/found there/.test(c.answer) && !/checked there/.test(c.answer));
  assert.ok(c.answer.includes(`best of ${L.combos.tested.toLocaleString("en-US")} combinations`));
  assert.ok(/no untouched period was held back/.test(c.answer));
  assert.equal(c.review.status, "unreviewed");
  assert.ok(c.heldBecause.some((r) => /not reviewed/.test(r)));
  assert.ok(!/is the review/.test(c.review.by));
});

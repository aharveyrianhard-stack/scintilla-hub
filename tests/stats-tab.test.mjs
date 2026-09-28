/* STATS-TAB (28 Sep) — the curated Statistics tab prototype: deliverables/20260928/stats-tab/.
   Alan: "start to see visuals of the statistical analysis, graphics that get saved… a statistics master tab on the
   Hub — careful, don't make it a dump yard." These tests hold the tab to its own rules:
   · every card in findings.json carries a question, a measured answer with its uncertainty, a sample and date range,
     a study link that exists, a review, and a saved chart in both sizes that exists and parses as XML;
   · no grey marks: every bar is the up or the down colour; a share is green at/above its reference, red below;
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
import { PAL, isScintillaGrey, markColour, niceTicks, wrap, barsPanel, stepsChart, barsChart, twoPanelChart } from "../deliverables/20260928/stats-tab/charts.mjs";

const DIR = join(process.cwd(), "deliverables", "20260928", "stats-tab");
const manifest = JSON.parse(readFileSync(join(DIR, "findings.json"), "utf8"));
const page = readFileSync(join(DIR, "index.html"), "utf8");
const fixture = JSON.parse(readFileSync(join(process.cwd(), "tests", "fixtures", "stats-tab-fixture.json"), "utf8"));
const S8 = JSON.parse(readFileSync(join(process.cwd(), "research/statistics/data/s8-summary.json"), "utf8"));
const S9 = JSON.parse(readFileSync(join(process.cwd(), "research/statistics/data/s9-research.json"), "utf8"));
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
const marks = (svg) => [...svg.matchAll(/<g class="mark"[^>]*>[\s\S]*?<rect[^>]*fill="(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1]);
const fonts = (svg) => [...svg.matchAll(/font-size="([\d.]+)"/g)].map((m) => +m[1]);

test("fixture bars: colours follow the reference line, values are printed in ink with a halo, counts under the groups", () => {
  const svg = barsChart({ id: "fx", title: "t", subtitle: "s", footer: "f", groups: fixture.groups, ref: fixture.ref, yMin: 40, yMax: 100 });
  const cols = marks(svg);
  assert.deepEqual(cols, fixture.groups.map((g) => (g.bars[0].value >= fixture.ref.value ? PAL.up : PAL.dn)));
  assert.ok(!cols.some((c) => isScintillaGrey(c)), "no grey mark");
  assert.ok(svg.includes(`fill="${PAL.ink}" paint-order="stroke"`), "value labels in ink with a halo");
  assert.ok(svg.includes(">36 declines<"), "count under the group");
  assert.ok(svg.includes("stroke-dasharray"), "the reference line is drawn");
  assert.ok(svg.includes(fixture.ref.label), "and named in the legend");
  assert.ok(Math.min(...fonts(svg)) >= 11, "no text under 11px");
});
test("fixture steps (two series): stripes on the second series, a legend with both series and both any-day lines", () => {
  const svg = stepsChart({ id: "fs", title: "t", subtitle: "s", footer: "f", steps: fixture.steps, series: fixture.series, refs: fixture.refs });
  assert.ok(svg.includes('fill="url(#fs-stripe)"'), "second series striped");
  for (const se of fixture.series) assert.ok(svg.includes(se.label));
  for (const r of fixture.refs) assert.ok(svg.includes(r.label));
  const cols = marks(svg);
  assert.equal(cols.length, fixture.steps.length * 2);
  /* bar i of each step is coloured against ITS series' any-day line */
  fixture.steps.forEach((st, gi) => st.values.forEach((v, i) => assert.equal(cols[gi * 2 + i], v >= fixture.refs[i].value ? PAL.up : PAL.dn, `${st.label} series ${i}`)));
});
test("fixture two-panel: the drop share is drawn in the down colour, the up share against its any-day line", () => {
  const svg = twoPanelChart({ id: "ft", title: "t", subtitle: "s", footer: "f", groups: fixture.bands, panels: [
    { key: "up60", label: "up 60", mode: "vsRef", ref: { value: 72.1, label: "any day 72.1%" }, yMax: 100, yMin: 40 },
    { key: "mdd60Bad", label: "drop", mode: "down", yMax: 50 }] });
  const cols = marks(svg), n = fixture.bands.length;
  assert.equal(cols.length, 2 * n);
  fixture.bands.forEach((b, i) => assert.equal(cols[i], b.up60 >= 72.1 ? PAL.up : PAL.dn));
  for (let i = n; i < 2 * n; i++) assert.equal(cols[i], PAL.dn);
});
test("the phone variant redraws at 390 with 13px labels; crowded axes rotate and crowded values round", () => {
  const three = barsPanel({ id: "fp", x: 0, y: 0, w: 390, h: 300, groups: fixture.groups, refs: [fixture.ref], yMax: 100, yMin: 40, compact: true });
  assert.ok(three.includes('font-size="13"'));
  assert.ok(three.includes(">36 declines<"), "three groups at 390: the count and its word fit");
  const six = barsPanel({ id: "fp9", x: 0, y: 0, w: 390, h: 300, groups: [...fixture.groups, ...fixture.groups, ...fixture.groups], refs: [fixture.ref], yMax: 100, yMin: 40, compact: true });
  assert.ok(six.includes("rotate(-38"), "nine groups at 390: the labels hang at 38° instead of colliding");
  assert.ok(!six.includes(">36 declines<") && !six.includes(">36<"), "and the count leaves the axis…");
  assert.ok(six.includes("n 36"), "…for the tip");
  assert.ok(!three.includes("rotate(-38"), "three groups at 390 do not rotate");
  assert.ok(six.includes(">81%<") && !six.includes(">80.6%<"), "crowded bars print the rounded value");
  assert.ok(six.includes("80.6%"), "and the exact value stays in the tip");
  const svg = six;
  assert.ok(Math.min(...fonts(svg)) >= 12);
});

/* ── the manifest: the only door onto the tab ───────────────────────────────────────────────────────── */
test("every card carries the five things a finding needs, and its chart files exist and parse", () => {
  assert.ok(manifest.cards.length >= 4 && manifest.cards.length <= 12, `cards ${manifest.cards.length}`);
  for (const c of manifest.cards) {
    for (const k of manifest.rules) assert.ok(c[k] != null && c[k] !== "", `${c.id} lacks ${k}`);
    assert.ok(/\?$/.test(c.question), `${c.id}: the question is a question`);
    assert.ok(/\d/.test(c.answer), `${c.id}: the answer carries numbers`);
    assert.ok(/\d/.test(c.uncertainty), `${c.id}: the uncertainty carries a number`);
    assert.ok(c.sample.from && c.sample.to && c.sample.days > 0 && c.sample.episodes > 0, `${c.id}: sample`);
    assert.ok(manifest.studies[c.study], `${c.id}: study ${c.study} listed`);
    assert.ok(existsSync(join(process.cwd(), manifest.studies[c.study].page.slice(1))), `${c.id}: study page exists`);
    assert.ok(existsSync(join(process.cwd(), manifest.studies[c.study].json.slice(1))), `${c.id}: study numbers exist`);
    assert.equal(c.review.status, "reviewed"); assert.ok(c.review.by.length > 10);
    assert.ok(manifest.themes.some((t) => t.id === c.theme), `${c.id}: theme`);
    for (const k of ["desk", "phone"]) {
      const f = join(DIR, c.chart.files[k]);
      assert.ok(existsSync(f), `${c.id}: ${k} chart saved`);
      assert.match(c.chart.files[k], /^charts\/\d{8}-[a-z0-9-]+-(1200|390)\.svg$/, "dated file name");
      const svg = readFileSync(f, "utf8");
      assert.ok(svg.startsWith("<svg") && svg.trim().endsWith("</svg>"));
      const open = svg.slice(0, svg.indexOf(">") + 1), rest = open.replace(/^<svg/, "").replace(/\s+[\w:-]+="[^"]*"/g, "").trim();
      assert.equal(rest, ">", `${c.id} ${k}: the <svg> tag's attributes are well-formed (a quote inside a quoted value broke this once)`);
      assert.ok(svg.includes("built ") && svg.includes(c.study), `${c.id}: the chart names its study and build date`);
      assert.ok(Math.min(...fonts(svg)) >= 11, `${c.id} ${k}: no text under 11px`);
      const cols = marks(svg); assert.ok(cols.length > 0); assert.ok(cols.every((x) => x === PAL.up || x === PAL.dn), `${c.id} ${k}: only up/down marks`);
    }
  }
});
test("each of Alan's six themes is present, in his order, and every card sits under one", () => {
  assert.deepEqual(manifest.themes.map((t) => t.id), ["market", "pullbacks", "rsi", "fear", "leaders", "execution"]);
  for (const t of manifest.themes) assert.ok(t.why.length > 20);
});
test("a lane still measuring is a candidate by name, never a card", () => {
  assert.ok(manifest.candidates.length >= 5);
  for (const x of manifest.candidates) { assert.ok(!manifest.cards.some((c) => c.id.includes(x.lane)), x.lane); assert.ok(x.state.length > 5); }
  assert.ok(manifest.candidates.some((x) => x.theme === "leaders"), "leaders has only candidates today");
  assert.ok(!manifest.cards.some((c) => c.theme === "leaders"), "and no card");
});

/* ── the page ───────────────────────────────────────────────────────────────────────────────────────── */
test("the page inlines the saved SVG for every card, both sizes, and links the study, the numbers and the file", () => {
  for (const c of manifest.cards) {
    assert.ok(page.includes(`id="${c.id}"`), c.id);
    for (const k of ["desk", "phone"]) {
      const svg = readFileSync(join(DIR, c.chart.files[k]), "utf8");
      assert.ok(page.includes(svg), `${c.id} ${k}: the page carries the same bytes as the saved file`);
      assert.ok(page.includes(`href="${c.chart.files[k]}"`), `${c.id} ${k}: download link`);
    }
    assert.ok(page.includes(manifest.studies[c.study].page) && page.includes(manifest.studies[c.study].json));
  }
  assert.ok(page.includes('<div data-scnav-slot></div>'), "the BACK / CLOSE pair has its slot");
  assert.ok(page.includes(".viz .desk{display:none}.viz .phone{display:block}"), "the phone shows the redrawn chart, not a shrunk one");
  assert.ok(!/font-size:\s*(?:[0-9]|10)(?:\.\d+)?px/.test(page.replace(/<svg[\s\S]*?<\/svg>/g, "")), "no HTML text under 11px");
  assert.ok(page.includes("No finding has passed review under this theme yet"), "an empty theme says so instead of filling itself");
  assert.ok(page.includes("Measuring now · not on the tab until reviewed"));
});
test("the page's greys obey the grey rule and there is no white", () => {
  const html = page.replace(/<svg[\s\S]*?<\/svg>/g, "");
  const hexes = new Set([...html.matchAll(/#([0-9A-Fa-f]{6})\b/g)].map((m) => "#" + m[1].toUpperCase()));
  for (const h of hexes) assert.ok(isScintillaGrey(h) || h === PAL.up || h === PAL.dn, h);
  assert.ok(!html.includes("#FFFFFF") && !html.includes("#fff;") && !/:\s*white\b/.test(html));
});

/* ── the numbers are the published ones ─────────────────────────────────────────────────────────────── */
test("card numbers are read from S8/S9, not retyped", () => {
  const c1 = manifest.cards.find((c) => c.id === "market-spy-low-rsi-vs-200day");
  const r10 = S8.funds.SPY.rows.find((r) => r.T === 10);
  assert.ok(c1.answer.includes(`${P(r10.on.win)} of ${r10.on.n}`) && c1.answer.includes(`${P(r10.off.win)} of ${r10.off.n}`));
  assert.ok(c1.answer.includes(P(S8.funds.SPY.any.on.win)));
  const c2 = manifest.cards.find((c) => c.id === "pullbacks-spy-depth-to-new-high");
  const b35 = S9.instruments.SPY.depthTable.find((b) => b.bucket === "3–5%");
  assert.ok(c2.answer.includes(`(${b35.n} since 2003): ${P(b35.newHigh)}`));
  const all = S9.instruments.SPY.all.filter((d) => typeof d.newHigh === "boolean");
  const share = (100 * all.filter((d) => d.newHigh).length / all.length).toFixed(1);
  assert.ok(c2.answer.includes(`Across all ${all.length} declines: ${share}%`));
  const c3 = manifest.cards.find((c) => c.id === "pullbacks-spy-200day-band");
  const deep = S9.band.SPY.full.bands.find((b) => b.band === "more than 10% below");
  assert.ok(c3.answer.includes(P(deep.up60)) && c3.answer.includes(P(deep.mdd60Bad)) && c3.answer.includes(P(S9.band.SPY.full.base.up60)));
  const c4 = manifest.cards.find((c) => c.id === "rsi-stock-own-percentile-vs-any-day");
  const s5 = S8.stocks.states[0].rows.find((r) => r.T === 5);
  assert.ok(c4.answer.includes(P(s5.x.win)) && c4.answer.includes(P(S8.stocks.states[0].any.win)));
  const c5 = manifest.cards.find((c) => c.id === "fear-vix-at-spy-swing-lows");
  for (const b of S9.instruments.SPY.depthTable) assert.ok(c5.answer.includes(String(b.vixLowMed)), b.bucket);
  const c6 = manifest.cards.find((c) => c.id === "execution-best-combo-both-halves");
  assert.ok(c6.answer.includes(P(S8.combos[0].disc.win)) && c6.answer.includes(P(S8.combos[0].conf.win)) && c6.answer.includes(P(S8.base_halves.disc.win)));
});

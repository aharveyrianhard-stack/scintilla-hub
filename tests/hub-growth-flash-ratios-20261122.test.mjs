/* 22 Nov 2026 (second pass) — Alan (relayed by the markets session): 1 GROWTH bars he can read (four quarters, bigger, the %
   printed on each); 2 no circles on RSI, a flash at an extreme like the economic tape, quiet otherwise; 3 ROTATION: five small
   ratio charts (TLT ÷ SHY, RSP ÷ SPY, SMH ÷ SPY, (XLP + XLV) ÷ SPY, DIA ÷ QQQ); 4 VALUATION: five years in front, trailing and
   forward labelled, the long history a faint backdrop. Static checks; the live proof is headless in the coordinator's staging. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const HUB = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const PE = JSON.parse(fs.readFileSync(new URL("../deliverables/20261122/valuation/own-pe.json", import.meta.url), "utf8"));
function cut(from, to) {
  const a = HUB.indexOf(from), b = HUB.indexOf(to, a);
  assert.ok(a > 0 && b > a, "the page must still carry " + from);
  return HUB.slice(a, b);
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const growApi = () => new Function("pg", "esc", "SC_PENDING", cut("let GROWQ = {}", "/* 22 Nov 2026 — OUTLIERS INSIDE THE COHORT.") +
  "\nreturn { set: (m) => { GROWQ = m; GROWQ_READ = true; }, growCellHTML };")(() => Promise.resolve([]), esc, "…");

test("GROWTH has room for four labelled bars: 16 of the 135 parts beside the left panel, from the Geiger and CHG", () => {
  const desk = /body:not\(\.secfs\):not\(\.gwx-motion\) #boardPanel \.ch\{ grid-template-columns:([^!]+)!important/.exec(HUB);
  const fr = desk[1].match(/\d+fr/g).map((x) => parseInt(x, 10));
  assert.deepEqual(fr, [9, 10, 12, 11, 10, 9, 10, 16, 7, 20, 16, 5]);
  assert.equal(fr.reduce((a, b) => a + b, 0), 135, "the other columns keep their share");
  assert.match(HUB, /#boardPanel \.sc-board__row > \.sc-grow\{ margin:-5px 0 -6px; \}/, "24 px tall, the row keeps its height");
});

test("each row is drawn to its own scale with a 10 % floor, so a grower shows its shape and a flat name stays flat", () => {
  const api = growApi();
  api.set({ ACC: { q: ["2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30"], rev: [0.05, 0.08, 0.12, 0.20], eps: [0, 0, 0, 0] },
    FLAT: { q: ["2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30"], rev: [0.01, 0.02, 0.03, 0.02], eps: [null, null, null, null] },
    MIX: { q: ["2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30"], rev: [-0.06, -0.02, 0.03, null], eps: [0, 0, 0, 0] } });
  const hts = (h) => [...h.matchAll(/<rect [^>]*height="([\d.]+)"/g)].map((m) => +m[1]);
  const acc = hts(api.growCellHTML({ t: "ACC" }));
  assert.equal(acc[3], 14, "the biggest quarter fills the bar height");
  assert.ok(acc[0] < acc[1] && acc[1] < acc[2] && acc[2] < acc[3], "accelerating reads as a rising staircase");
  const flat = hts(api.growCellHTML({ t: "FLAT" }));
  assert.ok(Math.max(...flat) <= 4.3, "1-3 % growth is drawn against 10 %: low bars");
  const mix = api.growCellHTML({ t: "MIX" });
  assert.equal((mix.match(/var\(--bear\)/g) || []).length, 4, "two shrinking quarters: red bars and red numbers");
  assert.match(mix, />−6</); assert.match(mix, />–</, "a missing quarter shows a dash");
});

test("RSI: no ring; 25 or below / 75 or above flashes on the economic tape's beat; 30 / 70 keeps its soft breath", () => {
  const num = (v) => (v == null || !Number.isFinite(+v) ? null : +v);
  const f = new Function("num", cut("const RSI_XT_LO = 30", "function rsiGradColor(") + "\nreturn { rsiExtreme, rsiFlash };")(num);
  assert.equal(f.rsiFlash(24.9), true); assert.equal(f.rsiFlash(25), true); assert.equal(f.rsiFlash(27), false); assert.equal(f.rsiFlash(76), true);
  assert.equal(f.rsiExtreme(27), true, "27 still breathes softly"); assert.equal(f.rsiFlash(50), false); assert.equal(f.rsiFlash(null), false);
  assert.match(HUB, /\.sc-rsi\.is-xt2\{ text-shadow:0 0 7px currentColor; animation:mn-breathe 1\.1s ease-in-out infinite; \}/);
  assert.match(HUB, /@keyframes mn-breathe\{ 0%,100%\{ opacity:1; \} 50%\{ opacity:\.22; \} \}/, "the same beat as the tape");
  assert.match(HUB, /\(typeof rsiFlash === "function" && rsiFlash\(d\.rsi\) \? " is-xt2" : ""\) \+ '" id="lr_'/);
  assert.match(HUB, /cell\.classList\.toggle\("is-xt2", rsiFlash\(v\)\)/, "a late RSI flashes when it lands");
  assert.doesNotMatch(HUB, /markRsiOutliers|scheduleRsiOutliers|oMark\(OS\.rsi/);
});

test("RATIOS: the five pairs, divided day by day; the defensive basket adds XLP and XLV; a bad tick is dropped", () => {
  const src = cut("const L0_RATIOS = [", "let RATH = null");
  const api = new Function(src + "\nreturn { L0_RATIOS, ratioSeries };")();
  assert.deepEqual(api.L0_RATIOS.map((r) => r.name), ["TLT ÷ SHY", "RSP ÷ SPY", "SMH ÷ SPY", "(XLP + XLV) ÷ SPY", "DIA ÷ QQQ"]);
  const day = 86400e3, ts = Array.from({ length: 260 }, (_, i) => i * day);
  const m = (f) => new Map(ts.map((t, i) => [t, f(i)]));
  const closes = { XLP: m(() => 80), XLV: m(() => 140), SPY: m((i) => (i === 100 ? 1100 : 550)) };
  const p = api.ratioSeries(closes, api.L0_RATIOS[3]);
  assert.equal(p.length, 259, "the one-day 2× SPY print is dropped");
  assert.equal(+p[0].r.toFixed(4), 0.4, "(80 + 140) ÷ 550");
  assert.equal(p[198].m, null); assert.equal(+p[199].m.toFixed(4), 0.4, "its 200-day");
  assert.match(HUB, /\["6M", "1Y", "5Y"\]\.map\(\(r\) =>/);
  assert.match(HUB, /if \(v === "BONDS"\) return "RATIOS";/, "a browser that remembered BONDS opens RATIOS");
});

test("a small ratio chart: green up, red down, its 200-day thin, today a dot", () => {
  const steps = new Function(cut("function l0SvgSteps(", "const L0_RAT_DAYS") + "\nreturn l0SvgSteps;")();
  const draw = new Function("l0SvgSteps", "esc", "L0_MON", cut("const L0_RAT_DAYS", "/* the axis is capped") + "\nreturn ratioChartSVG;")(steps, esc, ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]);
  const day = 86400e3, pts = Array.from({ length: 400 }, (_, i) => ({ t: Date.UTC(2025, 6, 1) + i * day, r: 1 + Math.sin(i / 20) * 0.05, m: i >= 199 ? 1 : null }));
  const svg = draw(pts, "1Y", 460, 90);
  assert.match(svg, /^<svg class="l0svg" width="460" height="90"/);
  assert.ok((svg.match(/var\(--bull\)/g) || []).length > 50 && (svg.match(/var\(--bear\)/g) || []).length > 50);
  assert.match(svg, /stroke-width="0\.8"/, "the 200-day"); assert.match(svg, /<circle [^>]*r="3"/);
});

test("VALUATION: the last five years in front, the usual range since 2003 faint behind, trailing and forward labelled", () => {
  const src = cut("const VALUE_CAP = {", "/* fill every SVG box");
  const api = new Function("l0SvgSteps", "esc", src + "\nreturn { valueStats, valueChartSVG };")(() => "<line/>", esc);
  const st = api.valueStats(PE.funds.SPY, "SPY");
  assert.equal(st.recent.length, 61, "five years of months, the same month five years back to now");
  assert.equal(String(st.recent[0][0]).slice(0, 7), "2021-11");
  assert.equal(Math.round(st.pct5 * 100), 17, "today's place in its five years - the report's figure");
  assert.equal(Math.round(api.valueStats(PE.funds.DIA, "DIA").pct5 * 100), 3);
  assert.equal(+st.med5.toFixed(1), 28.3);
  assert.ok(st.p25 < st.p50 && st.p50 < st.p75, "the band holds the middle");
  const svg = api.valueChartSVG(PE.funds.SMH, 400, 150, "SMH");
  assert.match(svg, /<rect [^>]*opacity="\.07"/, "the faint band"); assert.match(svg, /stroke-dasharray="3 4" opacity="\.45"/, "its middle");
  assert.doesNotMatch(svg, />2005</, "no twenty-year axis");
  const card = new Function("l0SvgSteps", "esc", src + cut("function valueFundHTML(", "let VALUEJ = null") + "\nreturn valueFundHTML;")(() => "", esc)("SPY", PE.funds.SPY);
  assert.match(card, /●<\/i> trailing <b>23\.1×/); assert.match(card, /◆<\/i> forward <b class="l0val__fwd">17\.8×/);
  assert.match(card, /since 2003 \(faint\): middle 22\.2×/);
  assert.match(HUB, /the faint band = the middle half of every month since 2003 \(25th to 75th percentile\), dashed = its middle/);
});

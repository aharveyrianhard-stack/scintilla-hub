/* The ~2 s provider tick must not rewrite DOM that has not changed, and the cohort average must
   say how much of the cohort it covers. Both are extracted from the real index.html. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
function fn(name) {
  const m = html.match(new RegExp("function " + name + " ?\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n"));
  assert.ok(m, name + " must stay statically extractable");
  return m[0];
}
const helpers = ["scSetAttr", "scSetText", "scSetClass", "scSetTitle", "scStamp"].map(fn).join("\n");
const api = new Function(helpers + "; return { scSetAttr, scSetText, scSetClass, scSetTitle, scStamp };")();

function node(initial = {}) {
  const attrs = { ...initial };
  return { writes: 0, className: initial.class || "", textContent: initial.text || "",
    getAttribute(k) { return k in attrs ? attrs[k] : null },
    setAttribute(k, v) { attrs[k] = v; this.writes++ },
    get _attrs() { return attrs } };
}

test("an unchanged stamp, text, class or title performs no DOM write", () => {
  const n = node();
  api.scStamp(n, { symbol: "AAPL", price: 333.46, state: "OK" });
  assert.equal(n.writes, 3, "first stamp writes");
  api.scStamp(n, { symbol: "AAPL", price: 333.46, state: "OK" });
  assert.equal(n.writes, 3, "identical re-stamp writes nothing");
  api.scStamp(n, { symbol: "AAPL", price: 333.5, state: "OK" });
  assert.equal(n.writes, 4, "only the changed key is written");
  assert.equal(n.getAttribute("data-sc-price"), "333.5");

  const t = node(); t.textContent = "+1.25%";
  api.scSetText(t, "+1.25%"); assert.equal(t.textContent, "+1.25%");
  const c = node(); c.className = "sc-chg up";
  api.scSetClass(c, "sc-chg up"); assert.equal(c.className, "sc-chg up");
  api.scSetClass(c, "sc-chg dn"); assert.equal(c.className, "sc-chg dn");
  const ti = node(); api.scSetTitle(ti, "provider quote"); assert.equal(ti.writes, 1);
  api.scSetTitle(ti, "provider quote"); assert.equal(ti.writes, 1, "identical title is not rewritten");
});

test("a null or non-finite stamp value is still recorded as UNKNOWN, exactly as before", () => {
  const n = node();
  api.scStamp(n, { geiger: null, "chg-pct": NaN, "prev-close": undefined });
  assert.equal(n.getAttribute("data-sc-geiger"), "UNKNOWN");
  assert.equal(n.getAttribute("data-sc-chg-pct"), "UNKNOWN");
  assert.equal(n.getAttribute("data-sc-prev-close"), "UNKNOWN");
});

test("the tick's per-row writes all go through the conditional helpers", () => {
  const tick = html.match(/async function scProviderTick \(\) \{[\s\S]*?\n\}\n/)[0];
  assert.match(tick, /scSetTitle\(priceNode, scQuoteObservationLabel\(q\)\)/);
  assert.doesNotMatch(tick, /priceNode\.title =/);
  assert.match(tick, /quoteRow && quoteRow\.classList\.contains\("nofeed"\)/,
    "the no-feed cleanup only runs on a row that actually carries the marker");
  const patch = html.match(/function patch\(t, price, src\) \{[\s\S]*?\n\}\n/)[0];
  assert.match(patch, /scSetText\(sameCell,/);
  assert.match(patch, /scSetClass\(sameCell,/);
  assert.doesNotMatch(patch, /sameCell\.textContent =/);
});

test("the cohort average states its contributor coverage when some rows carry no Geiger", () => {
  const src = fn("cohortGeigerHTML");
  assert.match(src, /const total = \(S\.rows \|\| \[\]\)\.length;/);
  assert.match(src, /total > n \? n \+ "\/" \+ total \+ " contributors" : n \+ " tickers"/);
  assert.match(src, /">0\/' \+ total \+ " contributors/, "the empty state also states coverage");
  /* the aggregation itself is untouched */
  assert.match(src, /const avg = vals\.reduce\(\(s, v\) => s \+ v, 0\) \/ n;/);
  assert.match(src, /const rows = \(S\.rows \|\| \[\]\)\.filter\(\(r\) => r\.g != null\);/);
});

test("the map reuses a symbol's series across cohorts under the same freshness rule", async () => {
  const src = html.match(/const L0_SERIES_CACHE = \{\};[\s\S]*?\n\}\n[\s\S]*?\n\}\n/)[0];
  const calls = [];
  const ctx = { L0_MAP_TTL: 90000, L0_SERIES_CACHE: {}, now: 0,
    scCleanRows: async (sym, tf, per) => { calls.push(sym + "|" + tf + "|" + per); return [{ ticker: sym }] } };
  const make = new Function("ctx", `const { L0_MAP_TTL, scCleanRows } = ctx; const Date = { now: () => ctx.now };
    ${src.replace("const L0_SERIES_CACHE = {};", "const L0_SERIES_CACHE = ctx.L0_SERIES_CACHE;")} ; return l0SeriesFor;`);
  const l0SeriesFor = make(ctx);

  await l0SeriesFor("AAPL", "240", 13);
  await l0SeriesFor("AAPL", "240", 13);
  assert.deepEqual(calls, ["AAPL|240|13"], "a second cohort containing AAPL reuses the loaded series");

  await l0SeriesFor("AAPL", "D", 6);
  assert.equal(calls.length, 2, "a different timeframe is its own series");

  ctx.now = 90001;
  await l0SeriesFor("AAPL", "240", 13);
  assert.equal(calls.length, 3, "past the 90 s rule the series is pulled again");

  ctx.now = 90002;
  await l0SeriesFor("AAPL", "240", 20);
  assert.equal(calls.length, 4, "a request needing more bars is not served from a shorter cached one");

  const mapLoad = html.match(/async function l0MapLoad\([\s\S]*?\n\}\n/)[0];
  assert.match(mapLoad, /part\.map\(\(t\) => l0SeriesFor\(t, tf, per\)\)/);
  assert.doesNotMatch(mapLoad, /part\.map\(\(t\) => scCleanRows\(/);
});

test("a null series still routes the symbol to its retained owner", async () => {
  const src = html.match(/const L0_SERIES_CACHE = \{\};[\s\S]*?\n\}\n[\s\S]*?\n\}\n/)[0];
  let hits = 0;
  const ctx = { L0_MAP_TTL: 90000, L0_SERIES_CACHE: {}, now: 0,
    scCleanRows: async () => { hits++; return null } };
  const l0SeriesFor = new Function("ctx", `const { L0_MAP_TTL, scCleanRows } = ctx; const Date = { now: () => ctx.now };
    ${src.replace("const L0_SERIES_CACHE = {};", "const L0_SERIES_CACHE = ctx.L0_SERIES_CACHE;")} ; return l0SeriesFor;`)(ctx);
  assert.equal(await l0SeriesFor("CLUSD", "240", 13), null);
  assert.equal(await l0SeriesFor("CLUSD", "240", 13), null, "the non-equity answer is cached too");
  assert.equal(hits, 1);
  const mapLoad = html.match(/async function l0MapLoad\([\s\S]*?\n\}\n/)[0];
  assert.match(mapLoad, /const missing = part\.filter\(\(t, i\) => got\[i\] === null\)/,
    "null still selects the legacy batched read for that symbol");
});

test("two cohorts loading at once pull a symbol's series only once", async () => {
  const src = html.match(/const L0_SERIES_CACHE = \{\};[\s\S]*?\n\}\n[\s\S]*?\n\}\n/)[0];
  let calls = 0, release;
  const gate = new Promise((r) => { release = r });
  const ctx = { L0_MAP_TTL: 90000, L0_SERIES_CACHE: {}, L0_SERIES_INFLIGHT: {}, now: 0,
    scCleanRows: async () => { calls++; await gate; return [{ ticker: "AAPL" }] } };
  const l0SeriesFor = new Function("ctx", `const { L0_MAP_TTL, scCleanRows } = ctx; const Date = { now: () => ctx.now };
    ${src.replace("const L0_SERIES_CACHE = {};", "const L0_SERIES_CACHE = ctx.L0_SERIES_CACHE;")
         .replace("const L0_SERIES_INFLIGHT = {};", "const L0_SERIES_INFLIGHT = ctx.L0_SERIES_INFLIGHT;")} ; return l0SeriesFor;`)(ctx);
  const a = l0SeriesFor("AAPL", "240", 13), b = l0SeriesFor("AAPL", "240", 13);
  release();
  const [ra, rb] = await Promise.all([a, b]);
  assert.equal(calls, 1, "the second cohort waits on the first pull instead of firing its own");
  assert.deepEqual(ra, rb);
  assert.deepEqual(Object.keys(ctx.L0_SERIES_INFLIGHT), [], "the in-flight entry is cleared when it resolves");
});

test("the shell fits the window and the zoom tiers compensate for their own padding", () => {
  const body = html.match(/body\{ background:var\(--bg\)[\s\S]*?\n[^\n]*overflow:hidden; \}/)[0];
  assert.match(body, /padding:16px 22px 16px/, "the shell padding is unchanged");
  assert.match(body, /height:calc\(100vh - 32px\)/, "the viewport lock accounts for that padding");
  assert.doesNotMatch(body, /box-sizing/, "width stays on the 1240px content box, so no strip narrows");
  for (const [w, z] of [[1400, '1.12'], [1680, '1.28'], [1920, '1.45']]) {
    const rule = html.match(new RegExp(`@media \\(min-width:${w}px\\)\\{ body\\{ zoom:${z}; height:([^;]+); \\} \\}`))
    assert.ok(rule, `the ${w}px zoom tier must still exist`)
    assert.equal(rule[1], `calc(100vh / ${z} - 32px)`, `zoom scales the padding too, so ${w}px must subtract it`)
  }
});

test("the company tab strip cannot crush its two cohort controls", () => {
  assert.match(html, /\.sc-ihead\.ptabs \.tabstrip > \.sc-backcoh,\s*\n\.sc-ihead\.ptabs \.tabstrip > \.sc-cohwrap\{ flex:none; \}/);
  assert.match(html, /\.sc-ihead\.ptabs \.tabstrip\{ flex:1 1 auto;[^}]*overflow-x:auto;/,
    "the strip still scrolls, so the tab list itself is never cut off");
});

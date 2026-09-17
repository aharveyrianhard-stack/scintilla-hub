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

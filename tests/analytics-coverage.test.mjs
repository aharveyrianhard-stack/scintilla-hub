import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

/* The analytics surfaces (fundamentals · comps · DCF · scoring) must never present a verdict
   they did not measure, and must never go silently blank where a written read belongs. */
const page = fs.readFileSync(new URL("../fundamentals/index.html", import.meta.url), "utf8");
function fn(name) {
  const s = page.search(new RegExp("^(async )?function " + name + "\\b", "m"));
  assert.ok(s >= 0, name + " is defined at the top level so it can be read without a browser");
  const e = page.indexOf("\n}\n", s);
  return page.slice(s, e + 3);
}

test("a comps score carries its own coverage, and nothing measured is not a score of zero", () => {
  const compsScore = new Function(fn("compsScore") + "return compsScore;")();

  // an entirely unmeasured name: every multiple null (no P/E, no EV/EBITDA, no P/S, no P/B, no PEG)
  const none = compsScore([null, null, null, null, null]);
  assert.equal(none.score, null, "no measure → no score (was 0, printed as VALUE 0/100 · GRADE D)");
  assert.equal(none.n, 0);
  assert.equal(none.of, 5, "coverage names the full measure set, not just the ones that arrived");

  // partial coverage: the score is the mean of what exists, and says how much that was
  const some = compsScore([1, 0.5, null, null, null]);
  assert.equal(some.score, 75, "mean of the measures present, on the 0-100 scale");
  assert.equal(some.n, 2);
  assert.equal(some.of, 5);

  // full coverage
  const all = compsScore([0, 0, 0, 0.5, 0.5]);
  assert.equal(all.n, 5);
  assert.equal(all.score, 20);
});

test("the score panel prints the coverage next to the number and no grade without one", () => {
  assert.doesNotMatch(page, /mean\(valM\.map[^\n]*\|\|\s*0\)\s*\*\s*100/,
    "the ||0 that turned an unmeasured name into a confident zero is gone");
  assert.ok(/vS=compsScore\(valM\.map/.test(page), "VALUE reads through the coverage-carrying score");
  assert.ok(/qS=compsScore\(qualM\.map/.test(page), "QUALITY reads through the coverage-carrying score");
  assert.match(page, /grade=comp==null\?null:/, "no composite → no letter grade");
  assert.match(page, /no measure available — not scored/, "the panel says why there is no grade");
  assert.match(page, /cov\(vS\)/, "VALUE shows n/of measured");
  assert.match(page, /cov\(qS\)/, "QUALITY shows n/of measured");
});

test("the written comps read is never left blank — a missing row is stated, not swallowed", () => {
  assert.doesNotMatch(page, /getElementById\('cn1'\)\.textContent\s*=\s*''/,
    "cn1 was blanked with no explanation, leaving the 🥇 note standing empty");
  assert.doesNotMatch(page, /getElementById\('cn2'\)\.textContent\s*=\s*''/,
    "cn2 was blanked with no explanation, leaving the 📐 note standing empty");
  assert.match(page, /getElementById\('cn1'\)\.innerHTML='<b>No written comps read for '\+sym/,
    "the empty-brief path now names the ticker and the missing input");
  assert.match(page, /A data gap, not an empty opinion/);
  assert.match(page, /getElementById\('cn2'\)\.innerHTML='The CAGR bridge into the DCF needs that same row/,
    "the second note explains what returns when the row lands, instead of disappearing");
});

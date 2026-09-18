import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
test("the favourite-news bell parses epoch-second timestamps (news.published_ts) as well as ISO strings", () => {
  const src = page.match(/  function tsMs\(v\)\{[\s\S]*?\n  \}\n/)[0] + page.match(/  function agoStr\(iso\)\{[\s\S]*?\n  \}\n/)[0];
  const { tsMs, agoStr } = new Function("Date", src + "return { tsMs, agoStr };")(Date);
  assert.equal(tsMs(1789698022), 1789698022000, "epoch seconds");
  assert.equal(tsMs("1789698022"), 1789698022000, "epoch seconds as a string (PostgREST bigint)");
  assert.equal(tsMs(1789698022000), 1789698022000, "epoch milliseconds");
  assert.equal(tsMs("2026-09-18T02:20:22Z"), Date.parse("2026-09-18T02:20:22Z"), "ISO");
  assert.ok(Number.isNaN(tsMs(null)) && Number.isNaN(tsMs("junk")));
  assert.ok(tsMs(1789698100) > tsMs(1789698022), "a newer epoch compares newer (the old Date.parse gave NaN > NaN = false, so no alert ever fired)");
  assert.notEqual(agoStr(1789698022), "", "age renders for an epoch value");
  assert.match(page, /if\(!cur \|\| tsMs\(r\.published_ts\) > tsMs\(cur\.ts\)\)\{/);
  assert.match(page, /var isNewer = !last \|\| !isFinite\(tsMs\(last\)\) \|\| tsMs\(item\.ts\) > tsMs\(last\);/);
});

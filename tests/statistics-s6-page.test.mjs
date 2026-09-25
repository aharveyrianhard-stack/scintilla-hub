import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const html = fs.readFileSync(new URL("../research/statistics/index.html", import.meta.url), "utf8");

test("S6 page: with no export it says so and draws nothing", () => {
  assert.match(html, /fetch\("\.\/data\/runup-into-earnings\.json"/);
  assert.match(html, /Not built yet\.<\/span> These numbers need the list of past report dates/);
  assert.match(html, /<div id="s6body" hidden>/, "the table and strips stay hidden until real data loads");
});

test("S6 page: made-up data is labelled on the section and on every name's strip", () => {
  assert.match(html, /S6\.fixture \? `<div class="s6banner">TEST FIXTURE/);
  assert.match(html, /S6\.fixture \? `<span style="color:var\(--warn\)">TEST FIXTURE · made-up data · <\/span>`/);
});

test("S6 page: direction colours win over the pooled and fund row colours", () => {
  assert.match(html, /\.s6 tr\.pool td\.up,\.s6 tr\.fund td\.up\{color:var\(--up\)\}/);
  assert.match(html, /\.s6 tr\.pool td\.dn,\.s6 tr\.fund td\.dn\{color:var\(--dn\)\}/);
});

test("S6 page: descriptive only — 'buy' appears only inside the disclaimer", () => {
  const sec = html.slice(html.indexOf('<section class="s6"'), html.indexOf("</section>", html.indexOf('<section class="s6"')));
  const buys = sec.match(/[^.]*\bbuy\b[^.]*/gi) || [];
  assert.equal(buys.length, 1);
  assert.match(buys[0], /is not a reason to buy before a report/);
  assert.doesNotMatch(html, /buy before earnings/i);
});

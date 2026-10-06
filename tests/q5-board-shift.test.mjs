// Q5 (5 Oct 2026) — the outside critique measured the board's layout shift at 0.88. The page painted before its late
// style sheets had arrived, and two bands appeared only after their data. These tests hold the fix in place.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const between = (from, to) => { const a = page.indexOf(from); assert.ok(a >= 0, from); const b = page.indexOf(to, a); assert.ok(b > a, to); return page.slice(a, b); };

test('the tabs, the board and the bands are held until the document has been read to the end', () => {
  const head = page.slice(0, page.indexOf('</head>'));
  const gate = head.indexOf('<style id="q5-parse-gate">');
  assert.ok(gate > 0 && gate < head.indexOf('<style>'), 'the hold is in place before any other style or script');
  assert.match(head, /<style id="q5-parse-gate">html\.sc-parsing #mtabs, html\.sc-parsing #main, html\.sc-parsing #bands\{ visibility:hidden; \}<\/style>/);
  assert.match(page, /<nav class="sc-mtabs" id="mtabs" role="tablist"><\/nav>/);
  assert.match(page, /<main id="main"><\/main>/);
  const script = head.slice(gate).match(/<script>([\s\S]*?)<\/script>/)[1];
  const classes = new Set(), listeners = {}, timers = [];
  vm.runInNewContext(script, {
    document: { documentElement: { classList: { add: c => classes.add(c), remove: c => classes.delete(c) } }, addEventListener: (name, fn) => { listeners[name] = fn; } },
    window: { addEventListener: (name, fn) => { listeners['window:' + name] = fn; } },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); },
  });
  assert.deepEqual([...classes], ['sc-parsing'], 'held from the first byte');
  listeners.DOMContentLoaded();
  assert.deepEqual([...classes], [], 'released when the document has been read');
  classes.add('sc-parsing'); listeners['window:load']();
  assert.deepEqual([...classes], []);
  classes.add('sc-parsing');
  assert.deepEqual(timers.map(t => t.ms), [20000], 'and released after 20 s whatever happens');
  timers[0].fn();
  assert.deepEqual([...classes], []);
});

test('the scintilla strip and the tape\'s economic line keep their place while their data loads', () => {
  assert.doesNotMatch(page, /\.sc-scintstrip:empty\{ display:none; \}/);
  assert.match(page, /\.sc-scintstrip:empty\{ min-height:32px; \}\n@media\(max-width:700px\)\{ \.sc-scintstrip:empty\{ min-height:30px; \} \}\n@media\(max-width:560px\)\{ \.sc-scintstrip:empty\{ min-height:68px; \} \}/);
  // a quiet week still folds the economic line away: the rule that hides it is untouched, the hold applies only while waiting
  assert.match(page, /\.sc-toptape--h3 \.sc-toptape__next\.sc-macronext:empty\{ display:none; \}/);
  assert.match(page, /\.sc-toptape--h3 \.sc-toptape__next\.sc-macronext\.is-wait:empty\{ display:flex; \}/);
  assert.match(page, /\(ECON_TAPE_ON && !MACRO_NEXT && !MACRO_NEXT_FAIL_AT \? " is-wait" : ""\)/);
  assert.match(page, /if \(\(MACRO_NEXT \|\| MACRO_NEXT_FAIL_AT\) && box\.classList\) box\.classList\.remove\("is-wait"\);/);
});

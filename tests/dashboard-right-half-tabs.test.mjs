/* M19 — the right half of the DASHBOARD is ONE strip of four tabs, and the chosen one is
   remembered. Alan, 23 Sep: "Cohort compare and the map, rotation and relative should all
   be tabs of the same right half."
   Plus the boot-cost rule these changes rest on: every chart-API read goes through the
   shared in-flight helper, so two callers asking for the same URL make ONE request. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function fn(name) {
  const at = source.lastIndexOf('function ' + name + ' ');
  const compact = source.lastIndexOf('function ' + name + '(');
  const start = Math.max(at, compact);
  assert.notEqual(start, -1, name);
  return (source.slice(Math.max(0, start - 6), start) === 'async ' ? 'async ' : '') +
    source.slice(start, source.indexOf('\n}', start) + 2);
}

test('the strip is COHORT COMPARE · MAP · ROTATION · RELATIVE, in that order', () => {
  assert.match(source, /const L0_TABS = \["COHORT", "MAP", "ROTATION", "RELATIVE"\];/);
  const c = vm.createContext({ window: {}, LAYER0_TAB: 'MAP',
    L0_TABS: ['COHORT', 'MAP', 'ROTATION', 'RELATIVE'],
    L0_TAB_LBL: { COHORT: '<span class="sc-soctab__full">COHORT COMPARE</span><span class="sc-soctab__abbr">COHORT</span>' } });
  vm.runInContext(fn('l0TabsHTML'), c);
  const html = vm.runInContext('l0TabsHTML()', c);
  const tabs = [...html.matchAll(/data-tab="([A-Z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(tabs, ['COHORT', 'MAP', 'ROTATION', 'RELATIVE'], 'four tabs, cohort first');
  assert.equal((html.match(/role="tablist"/g) || []).length, 1, 'ONE strip, not two');
  assert.match(html, /COHORT COMPARE/, 'the full name is present for a wide pane');
  assert.match(html, /aria-selected="true"[^>]*data-tab="MAP"/, 'the active tab is marked for a screen reader');
});

test('the cohort fan is a tab body, not a band stacked above the tabs', () => {
  const layer0 = fn('layer0HTML');
  assert.doesNotMatch(layer0, /id="cohCompare"/, 'the fan is no longer a sibling of the tab row');
  assert.match(layer0, /l0TabsHTML\(\)/);
  assert.match(fn('l0BodyHTML'), /LAYER0_TAB === "COHORT"[\s\S]{0,200}id="cohCompare"[\s\S]{0,80}cohortCompareStripHTML\(\)/,
    'the COHORT tab renders the SAME strip renderer into the body');
});

test('every view keeps its own controls, and the cohort tab is not given a timeframe row it does not use', () => {
  const ctrl = fn('l0CtrlRowHTML');
  assert.match(ctrl, /if \(LAYER0_TAB === "COHORT"\) return "";/);
  for (const tab of ['MAP', 'RELATIVE']) assert.match(ctrl, new RegExp('LAYER0_TAB === "' + tab + '"'), tab + ' keeps its own controls');
  assert.match(source, /\.sc-l0ctlwrap:empty\{ display:none/, 'an empty control row leaves no stray hairline');
});

test('the chosen tab is remembered across reloads', () => {
  assert.match(source, /const L0_TAB_KEY = "sc_l0tab_v1";/);
  assert.match(source, /localStorage\.getItem\(L0_TAB_KEY\)/, 'boots from what was stored');
  assert.match(source, /localStorage\.setItem\(L0_TAB_KEY, t\)/, 'stores the choice on click');
  /* a stored value that is not one of the four must not be trusted */
  const boot = source.slice(source.indexOf('let LAYER0_TAB = (function ()'), source.indexOf('let L0_TF ='));
  const asked = [];
  const c = vm.createContext({ L0_TAB_KEY: 'sc_l0tab_v1', localStorage: { getItem: (k) => { asked.push(k); return 'NONSENSE'; } } });
  vm.runInContext(boot.replace('let LAYER0_TAB =', 'var LAYER0_TAB ='), c);
  assert.equal(vm.runInContext('LAYER0_TAB', c), 'MAP', 'an unknown stored value falls back to MAP');
  assert.deepEqual(asked, ['sc_l0tab_v1'], 'it reads its own key and nothing else');
  const c2 = vm.createContext({ L0_TAB_KEY: 'sc_l0tab_v1', localStorage: { getItem: () => 'COHORT' } });
  vm.runInContext(boot.replace('let LAYER0_TAB =', 'var LAYER0_TAB ='), c2);
  assert.equal(vm.runInContext('LAYER0_TAB', c2), 'COHORT', 'a stored tab is restored');
  /* a browser with storage switched off must still boot the pane */
  const c3 = vm.createContext({ L0_TAB_KEY: 'sc_l0tab_v1', localStorage: { getItem: () => { throw new Error('denied'); } } });
  vm.runInContext(boot.replace('let LAYER0_TAB =', 'var LAYER0_TAB ='), c3);
  assert.equal(vm.runInContext('LAYER0_TAB', c3), 'MAP', 'blocked storage falls back instead of throwing');
});

test('the cohort tab claims the full height of the right half', () => {
  assert.match(source, /\.sc-cohtabwrap \.sc-cohstrip\{[^}]*flex:1 1 auto/);
  assert.match(source, /\.sc-cohtabwrap \.sc-vmini\{[^}]*flex:1 1 auto/, 'the bipolar bar stretches instead of staying 114px');
});

test('two callers asking for the same chart-API url make ONE request', async () => {
  let calls = 0;
  const c = vm.createContext({ window: {}, console,
    fetch: (u) => { calls++; return new Promise((res) => setTimeout(() => res({ ok: true, status: 200, json: async () => ({ u }) }), 20)); } });
  vm.runInContext(fn('scJSONOnce'), c);
  const [a, b] = await vm.runInContext('Promise.all([scJSONOnce("https://p.test/quotes?symbols=A,B"), scJSONOnce("https://p.test/quotes?symbols=A,B")])', c);
  assert.equal(calls, 1, 'the second caller shared the first request');
  assert.deepEqual(a, b, 'and got the same answer');
  assert.equal(c.window.SC_DEDUPED, 1, 'the suppressed request is counted, so it can be checked in a live page');
  /* a different url is a different request, and a settled url is NOT cached */
  await vm.runInContext('scJSONOnce("https://p.test/quotes?symbols=C")', c);
  assert.equal(calls, 2);
  await vm.runInContext('scJSONOnce("https://p.test/quotes?symbols=A,B")', c);
  assert.equal(calls, 3, 'a finished request is forgotten: freshness rules stay with each caller');
});

test('a failed shared request rejects every caller and is forgotten', async () => {
  let calls = 0;
  const c = vm.createContext({ window: {}, console,
    fetch: () => { calls++; return Promise.resolve({ ok: false, status: 503, json: async () => ({}) }); } });
  vm.runInContext(fn('scJSONOnce'), c);
  await assert.rejects(() => vm.runInContext('scJSONOnce("https://p.test/geiger")', c), /HTTP_503/);
  const err = await vm.runInContext('scJSONOnce("https://p.test/geiger").catch((e) => e)', c);
  assert.equal(err.status, 503, 'the status survives, so the geiger reader can still say GEIGER_HTTP_503');
  assert.equal(calls, 2, 'a failure is not remembered as an answer');
});

test('the symbols in a /quotes url are sorted, so two callers can share one request', () => {
  assert.match(source, /const all = \[\.\.\.decl\]\.sort\(\);/, 'the 2-second tick sorts');
  assert.match(source, /const want = \[\.\.\.new Set\(\(tickers \|\| \[\]\)\.filter\(Boolean\)\)\]\.sort\(\);/, "the board's own read sorts");
  assert.match(source, /syms\.slice\(\)\.sort\(\)\.join\(","\)/, 'the breadth read sorts');
});

test('the first tick prices the visible rows and the next one covers the whole universe', () => {
  assert.match(source, /window\.SC_TICK_FIRST = true; window\.SC_TICK_PARTIAL = false;/);
  const tick = source.slice(source.indexOf('async function scProviderTick'), source.indexOf('function scScheduleTick'));
  assert.match(tick, /window\.SC_TICK_FIRST !== false\) \{[\s\S]{0,400}\.filter\(\(t\) => decl\.has\(t\)\)/,
    'the screen-only list is still filtered to declared equities, so nothing unowned is priced');
  assert.match(tick, /if \(vis\.length && vis\.length < all\.length\) want = vis;/);
  assert.match(tick, /window\.SC_TICK_FIRST = false;\n\s*scScheduleTick\(window\.SC_TICK_PARTIAL\);/,
    'after a screen-only request it comes straight back for the full universe');
  assert.doesNotMatch(tick, /SC_TICK_FIRST = false[\s\S]{0,200}return;/, 'the flag is cleared in the finally, never on an early return');
  assert.match(tick, /if \(window\.SC_TICK_FIRST !== false\)/, 'a sandbox without the flag still takes the screen-only path once');
});

test('the fear & greed computation runs once at a time, and waits for the board to be priced', () => {
  assert.match(source, /let SENTI_CALC_INFLIGHT = null;/);
  assert.match(source, /if \(SENTI_CALC_INFLIGHT\) return SENTI_CALC_INFLIGHT;/, 'callers share the run in progress');
  assert.match(fn('fillSnFront'), /await scAfterFirstPrices\(10000\)/, 'prices first, then the gauge');
  const waiter = fn('scAfterFirstPrices');
  assert.match(waiter, /window\.SC_TICK && window\.SC_TICK\.runs > 0/, 'it waits for an ACCEPTED tick');
  assert.match(waiter, /Date\.now\(\) - t0 < cap/, 'and gives up after the cap, so a dead provider cannot hold the gauge for ever');
});

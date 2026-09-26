/* H2 (25 Sep) — the Hub follow-ups Alan named: cold-load seed, compare / rotation scope, the rewind exit,
   the company chart pane, the list tabs and the source labels. Source-level pins plus small vm runs. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const page = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function fn(name) {
  const start = Math.max(page.lastIndexOf('function ' + name + ' '), page.lastIndexOf('function ' + name + '('));
  assert.notEqual(start, -1, name);
  const line = page.slice(start, page.indexOf('\n', start));
  if (/\}\s*$/.test(line)) return line;   // a one-line function
  return page.slice(start, page.indexOf('\n}', start) + 2);
}

test('ROTATION keeps the eleven sectors on ALL and follows any other cohort with its twelve largest names', () => {
  const L0_SECTORS = [{ t:'XLK', c:'#1' }, { t:'XLC', c:'#2' }];
  const rows = Array.from({ length: 20 }, (_, i) => ({ t:'T' + i, name:'N' + i, mc: 100 - i }));
  const c = vm.createContext({ L0_SECTORS, L0_BENCH:'SPY', L0_TF:'240', COH_ABBR:{ AI_HARDWARE:'AI HW' },
    S:{ coh:'ALL', tq:'' }, l0FocRows:() => rows });
  vm.runInContext([fn('l0RotSet'), fn('l0RotKey'), fn('l0RotScopeLbl')].join('\n'), c);
  assert.equal(c.l0RotSet(), L0_SECTORS);
  c.S.coh = 'AI_HARDWARE';
  const set = c.l0RotSet();
  assert.equal(set.length, 12);
  assert.equal(set[0].t, 'T0');
  assert.match(c.l0RotKey(), /^240\|T0,T1,/);
  assert.equal(c.l0RotScopeLbl(set), 'names · AI HW');
  assert.match(page, /L0_CACHE\[key\] = \{ closes: out, thin \}/, 'the series cache is keyed by timeframe + symbol set');
});

test('the COHORTS | SECTORS chips read the mode the rewind module mirrors', () => {
  assert.match(page, /function scCmpMode\(\) \{ return \(typeof window !== "undefined" && window\.SC_CMP_MODE\) \|\| "COHORTS"; \}/);
  assert.equal((page.match(/window\.SC_CMP_MODE=CMP_MODE/g) || []).length, 3);
  assert.doesNotMatch(page, /typeof CMP_MODE !== "undefined"/);
});

test('the compare strip fills from the provider Geiger before the board pull ends', () => {
  assert.match(page, /pGeiger\.then\(function \(m\) \{[\s\S]{0,200}GCOMP\[t\] = c;/);
});

test('a scope painted from a fresh snapshot does not re-pull the universe at once', async () => {
  let pulls = 0;
  const c = vm.createContext({ setTimeout, clearTimeout, console, fetchBoardRows: async () => { pulls++; return []; } });
  vm.runInContext(fn('startBoardFeed'), c);
  const stop = c.startBoardFeed('FAV', [], () => {}, null, 45000, 10000);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(pulls, 0);
  stop();
  const stop2 = c.startBoardFeed('FAV', [], () => {}, null, 45000, 0);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(pulls, 1);
  stop2();
});

test('the rewind can always be left: null-safe stamp, guarded play loop, Esc, a fixed LIVE pill, whole-universe days', () => {
  assert.doesNotMatch(page, /E\("gwxDt"\)\.textContent\s*=/, 'every stamp write goes through setDt');
  assert.match(page, /if\(!sc\.isConnected\)\{ TIMER=null; stop\(\); goLive\(\); return; \}/);
  assert.match(page, /\}catch\(e\)\{ TIMER=null; stop\(\); goLive\(\); \}/);
  assert.match(page, /if\(e\.key==="Escape" && ASOF\) goLive\(\);/);
  assert.match(page, /id="gwxLiveFab" hidden/);
  assert.match(page, /if\(ASOF\)\{ setDt\(ASOF\); liveChip\(true\); armIdle\(\); \}/);
  assert.match(page, /fan_daily\?select=ticker,read&asof=eq\."\+d\+"&limit=1000/);
  assert.doesNotMatch(page, /fan_daily\?select=ticker,read&asof=eq\."\+d\+"&ticker=in\./);
  assert.match(page, /LIVE_G=null;/, 'a second replay never restores the first replay\'s snapshot');
});

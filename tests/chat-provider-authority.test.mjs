import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../supabase/functions/chat/index.ts', import.meta.url), 'utf8');

test('equity chat requires the Massive provider snapshot', () => {
  assert.match(source, /name: "provider_snapshot"/);
  assert.match(source, /scintilla-massive-chart-api\.fly\.dev/);
  assert.match(source, /previous completed provider daily session only/);
  assert.match(source, /Never substitute live_quotes, composite_staged, ladder_values, board_rsi or derived_series/);
});

test('daily indicators use the exact FMP provider universe', () => {
  assert.match(source, /provider_indicators_current/);
  assert.match(source, /7ad595cc4db5e1fd0bb63bb3780ac1450a938e6fa068df944aeec71445556063/);
  assert.match(source, /0c2abd57a836845ee120eba1e465cdb61db6a2cca5b3da1fcecbdc591936bb20/);
  /* M57: the superseded identity stays accepted, because every FMP row in the table today carries
     it. Dropping it would make the desk agent call valid reference rows unacceptable. */
  assert.match(source, /ab8f7965258d939f0a97fbfeac9a271547c258df7a2616aff6ccff746bb5d9d3/);
  assert.match(source, /FORMING versus SETTLED/);
  assert.match(source, /Intraday FMP indicator authority is not verified/);
});

test('legacy calculated tables are never advertised as current equity authority', () => {
  assert.doesNotMatch(source, /LIVE \(update every minute/);
  assert.doesNotMatch(source, /THE LIVE GEIGER/);
  assert.doesNotMatch(source, /THE LIVE 77-RUNG LADDER/);
  assert.doesNotMatch(source, /Prefer this over recomputing indicators/);
  assert.doesNotMatch(source, /for levels read the LIVE tables/);
});

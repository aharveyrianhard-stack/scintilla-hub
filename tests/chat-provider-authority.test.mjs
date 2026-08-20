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

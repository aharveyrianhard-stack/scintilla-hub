import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { webcrypto, createHash } from 'node:crypto';

const source = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function fn(name) {
  const at = source.lastIndexOf('function ' + name + ' ');
  const compact = source.lastIndexOf('function ' + name + '(');
  const start = Math.max(at, compact);
  assert.notEqual(start, -1, name);
  const end = source.indexOf('\n}', start) + 2;
  return (source.slice(Math.max(0, start - 6), start) === 'async ' ? 'async ' : '') + source.slice(start, end);
}
/* The conditional DOM-write helpers are shared plumbing: every painting function now routes its
   attribute/text/class writes through them, so they belong in any context that extracts one. */
const WRITE_HELPERS = ['scSetAttr', 'scSetText', 'scSetClass', 'scSetTitle'];
function context(names, bindings = {}) {
  const c = vm.createContext({ window:{}, Date, TextEncoder, crypto:webcrypto, console,
    ...bindings });
  const needed = WRITE_HELPERS.filter((h) => !names.includes(h));
  vm.runInContext([...needed, ...names].map(fn).join('\n'), c);
  return c;
}
const now = Date.parse('2026-09-16T15:00:00Z');
const quote = (seconds = 5, extra = {}) => ({ state:'OK', price:101, previous_close:100,
  price_freshness:'FRESH', price_observation_utc:new Date(now - seconds * 1000).toISOString(), ...extra });

test('all inline classic scripts compile before any browser request can run', () => {
  let count = 0;
  for (const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=|type\s*=\s*["'](?:module|application\/)/i.test(match[1])) continue;
    new vm.Script(match[2]); count++;
  }
  assert.ok(count > 1);
});

test('cold ownership uses independent universe and verifies actual membership digest', async () => {
  const syms = ['AAPL', 'MSFT'];
  const digest = createHash('sha256').update(JSON.stringify(syms)).digest('hex');
  for (const valid of [true, false]) {
    const requests = [];
    const c = context(['scUniverseDigest', 'scDeclaredEquities'], {
      SC_EQ:null, SC_CHART_API:'https://provider.test', SC_EXPECTED_EQUITY_COUNT:2,
      SC_EQUITY_UNIVERSE_DIGEST:digest, SC_EQ_KEY:'test', scEqFromCache:() => null,
      localStorage:{ setItem() {} },
      fetch:async (url) => { requests.push(url); return { ok:true, json:async () => ({
        provider:'MASSIVE', count:2, universe_sha256:digest,
        symbols:valid ? syms : ['AAPL', 'TICK']
      }) }; }
    });
    const result = await c.scDeclaredEquities();
    assert.deepEqual(requests, ['https://provider.test/universe']);
    if (valid) assert.deepEqual(Array.from(result), syms);
    else assert.equal(result, null, 'same-size wrong membership cannot inherit the supplied digest');
  }
});

test('unknown ownership cannot leave legacy prices or scores on the live board', async () => {
  const c = context(['scApplyProviderQuotes', 'scApplyCandidateGeiger'], {
    scProviderQuotes:async () => ({}), scCandidateGeiger:async () => ({}),
    scDeclaredEquities:async () => null, SC_CG:{ meta:null }
  });
  const px = { AAPL:{ price:271, prev_close:252.54, chg_pct:7.31 } };
  const scores = { AAPL:{ composite:0.8, trend:0.9, momentum:0.7 } };
  await c.scApplyProviderQuotes(px, ['AAPL']);
  await c.scApplyCandidateGeiger(scores);
  assert.equal(px.AAPL.price, null);
  assert.equal(px.AAPL.chg_pct, null);
  assert.equal(scores.AAPL.composite, null);
  assert.equal(scores.AAPL.trend, null);
});

test('verified non-equity consumers remain on their existing owner', async () => {
  const c = context(['scApplyProviderQuotes', 'scApplyCandidateGeiger'], {
    scProviderQuotes:async () => ({}), scCandidateGeiger:async () => ({}),
    scDeclaredEquities:async () => new Set(['AAPL']), SC_CG:{ meta:null }
  });
  const px = { BTCUSD:{ price:95000, prev_close:94000, chg_pct:1.06 } };
  const scores = { BTCUSD:{ composite:0.3 } };
  await c.scApplyProviderQuotes(px, ['BTCUSD']);
  await c.scApplyCandidateGeiger(scores);
  assert.equal(px.BTCUSD.price, 95000);
  assert.equal(scores.BTCUSD.composite, 0.3);
});

test('quote overlay preserves same-response arithmetic and rejects null values as zero', async () => {
  for (const q of [quote(), quote(5, { price:null }), quote(5, { previous_close:null })]) {
    const c = context(['scApplyProviderQuotes'], {
      scProviderQuotes:async () => ({ AAPL:q }), scDeclaredEquities:async () => new Set(['AAPL'])
    });
    const px = { AAPL:{ price:271, prev_close:252.54, chg_pct:7.31 } };
    await c.scApplyProviderQuotes(px, ['AAPL']);
    if (q.price != null && q.previous_close != null) {
      assert.equal(px.AAPL.price, 101); assert.equal(px.AAPL.chg_pct, 1);
      assert.equal(px.AAPL.price_observation_utc, q.price_observation_utc);
    } else {
      assert.equal(px.AAPL.price, null); assert.equal(px.AAPL.chg_pct, null);
    }
  }
});

test('HTTP success containing yesterday trades is not fresh; mixed-age coverage stays explicit', () => {
  const c = context(['scQuoteObservation', 'scEquityFreshness']);
  const tick = { last_utc:new Date(now).toISOString() };
  const old = c.scEquityFreshness({ quotes:{ AAPL:quote(86400) } }, tick, now);
  assert.equal(old.reachable, true); assert.equal(old.fresh, false); assert.equal(old.stale_count, 1);
  const mixed = c.scEquityFreshness({ quotes:{ AAPL:quote(), THIN:quote(86400), UNKNOWN:quote(5, {
    price_observation_utc:null
  }) } }, tick, now);
  assert.equal(mixed.fresh, true);
  assert.equal(mixed.fresh_count, 1); assert.equal(mixed.stale_count, 1); assert.equal(mixed.unknown_count, 1);
  assert.equal(c.scEquityFreshness({ quotes:{ AAPL:quote() } }, {
    last_utc:new Date(now - 181000).toISOString()
  }, now).fresh, false);
  assert.equal(c.scQuoteObservation(quote(-61), now).state, 'UNKNOWN');
  assert.equal(c.scQuoteObservation(quote(5, { price_freshness:'STALE' }), now).state, 'STALE');
});

test('regular-session CLOSED remains separate from fresh postmarket observations', () => {
  const badge = { style:{} };
  const c = context(['updateLive'], {
    window:{ __eqFresh:true, __eqStale:false, SC_TICK:{ runs:1 } },
    marketOpen:() => false, el:(id) => id === 'liveBadge' ? badge : null,
    document:{ body:{ classList:{ toggle() {} } }, querySelector:() => null, querySelectorAll:() => [] }
  });
  c.updateLive();
  assert.equal(badge.textContent, '● CLOSED');
});

test('a stale or rejected Geiger read revokes rank readiness even with unchanged weights', () => {
  const c = context(['scRetainCandidateGeiger', 'scGeigerSnapshotCurrent'], {
    window:{ SC_RANK_READY:true }, SC_CG:{ at:now, map:{ AAPL:{ composite:0.8 } },
      meta:{ receipt:'same', computed:'2026-09-11T20:11:06Z', current_equalizer_validated:true } }
  });
  const result = c.scRetainCandidateGeiger('GEIGER_HTTP_503', { receipt:'same' });
  assert.equal(Object.keys(result).length, 0);
  assert.equal(c.SC_CG.map, null);
  assert.equal(c.SC_CG.meta.current_equalizer_validated, false);
  assert.equal(c.window.SC_RANK_READY, false);
  assert.equal(c.scGeigerSnapshotCurrent({ updated_ts:'2026-09-11T20:11:06Z' }), false);
});

test('board cache restores layout without repainting remembered market data', () => {
  const c = context(['seedBoardFromCache'], { S:{}, cacheGet:() => ({
    rows:[{ t:'AAPL', name:'Apple', price:271, c:7.31, g:0.8, rsi:61, fam:{ trend:0.9 } }], order:['AAPL']
  }) });
  assert.equal(c.seedBoardFromCache('ALL', []), true);
  const row = c.S.rows[0];
  assert.equal(row.name, 'Apple');
  for (const key of ['price', 'c', 'g', 'rsi', 'fam']) assert.equal(row[key], null);
  assert.deepEqual(Array.from(c.S.boardOrder), ['AAPL']);
});

test('a valid provider tick clears no-feed state and keeps observation age separate from request time', async () => {
  let scheduled = 0;
  const row = { t:'AAPL', nf:true, state:'PROVIDER_UNAVAILABLE', price:null, c:null };
  const q = quote(86400);
  class Clock extends Date { static now() { return now; } }
  const c = context(['scProviderTick', 'scQuoteObservation', 'scQuoteObservationLabel',
    'scEquityFreshness', 'scUpdateEquityFreshness'], {
    Date:Clock, window:{ SC_DECLARED_SET:new Set(['AAPL']), SC_TICK:{
      runs:0, applied:0, symbols:0, failures:0, last_utc:null } },
    SC_TICK_INFLIGHT:false, SC_TICK_WAITS:0, SC_TICK_FAILS:0,
    SC_CHART_API:'https://provider.test', S:{ rows:[row] }, ALLROWS:[row], prevClose:{},
    scScheduleTick:() => scheduled++, scDeclaredEquities:async () => new Set(['AAPL']),
    fetch:async () => ({ ok:true, json:async () => ({ quotes:{ AAPL:q } }) }),
    patch:(_ticker, price) => { row.price = price; }, el:() => null,
    document:{ querySelector:() => null }, scStamp() {}, scStampRoot() {}, updateLive() {}
  });
  await c.scProviderTick();
  assert.equal(row.nf, false); assert.equal(row.priceSource, 'MASSIVE_PROVIDER');
  assert.equal(row.price, 101); assert.ok(Math.abs(row.c - 1) < 1e-12);
  assert.equal(c.window.SC_TICK.runs, 1);
  assert.equal(c.window.__eqFresh, false);
  assert.equal(c.window.SC_EQUITY_FRESHNESS.stale_count, 1);
  assert.equal(scheduled, 1);
});


test('expired quote cache cannot re-admit rows after failed or incomplete current responses', async () => {
  for (const mode of ['HTTP503', 'omitted']) {
    const c = context(['scProviderQuotes'], {
      SC_CHART_API:'https://provider.test', SC_PQ:{ at:1, map:{ AAPL:quote(), MSFT:quote() } },
      fetch:async () => ({ ok:mode !== 'HTTP503', status:mode === 'HTTP503' ? 503 : 200,
        json:async () => ({ quotes:{ AAPL:quote(5, { price:102 }) } }) })
    });
    const result = await c.scProviderQuotes(['AAPL', 'MSFT']);
    assert.equal(result.MSFT, undefined);
    assert.equal(c.SC_PQ.map.MSFT, undefined);
    if (mode === 'HTTP503') assert.equal(result.AAPL, undefined);
    else assert.equal(result.AAPL.price, 102);
  }
});

test('cached ownership independently hashes membership instead of trusting stored digest text', async () => {
  const syms = ['AAPL', 'MSFT'];
  const digest = createHash('sha256').update(JSON.stringify(syms)).digest('hex');
  for (const valid of [true, false]) {
    const c = context(['scUniverseDigest', 'scEqFromCache'], {
      SC_EQ_KEY:'test', SC_EXPECTED_EQUITY_COUNT:2, SC_EQUITY_UNIVERSE_DIGEST:digest,
      localStorage:{ getItem:() => JSON.stringify({ at:Date.now(), digest,
        syms:valid ? syms : ['AAPL', 'TICK'] }) }
    });
    const result = await c.scEqFromCache();
    if (valid) assert.deepEqual(Array.from(result), syms);
    else assert.equal(result, null);
  }
});

test('live Trend/Momentum/Read loader revokes failed equities and refreshes without a cohort change', async () => {
  let time = now, cg = { AAPL:{ composite:0.2, trend:0.3, momentum:0.1 } };
  let fail = false, eq = new Set(['AAPL']), paints = 0;
  class Clock extends Date { static now() { return time; } }
  const map = { AAPL:{ tr:-0.3, mo:-0.6 }, BTCUSD:{ tr:0.7, mo:0.6 } };
  const c = vm.createContext({
    Date:Clock, S:{ rows:[{ t:'AAPL' }], coh:'ALL' }, ASOF:null,
    TM:map, TM_AT:null, TM_FLIGHT:false, SC_CG:{ meta:{} }, window:{ SCIN_TM:map },
    api:async () => [{ ticker:'AAPL', trend:-0.3, momentum:-0.6 }, { ticker:'BTCUSD', trend:0.7, momentum:0.6 }],
    scDeclaredEquities:async () => eq,
    scCandidateGeiger:async () => { if (fail) throw new Error('GEIGER_NOT_READY'); return cg; },
    paintTM:() => paints++, E:() => null
  });
  const start = source.indexOf('  async function loadTM(){');
  vm.runInContext(source.slice(start, source.indexOf('\n  }', start) + 4), c);
  await c.loadTM();
  assert.equal(map.AAPL.tr, 0.3);
  assert.equal(map.BTCUSD.tr, 0.7);
  time += 31000; fail = true;
  await c.loadTM();
  assert.equal(map.AAPL, undefined, 'failed Geiger cannot leave legacy component values');
  assert.equal(map.BTCUSD.tr, 0.7, 'verified non-equity owner remains');
  time += 31000; fail = false; cg = { AAPL:{ composite:0.5, trend:0.6, momentum:0.4 } };
  await c.loadTM();
  assert.equal(map.AAPL.tr, 0.6, 'same cohort picks up restored provider components');
  assert.equal(c.window.SCIN_TM, map, 'cohort strip retains the same shared map');
  c.ASOF = '2026-08-20'; time += 31000; cg = {};
  const priorPaints = paints;
  await c.loadTM();
  assert.equal(paints, priorPaints, 'explicit dated rewind is not repainted by live refresh');
  c.ASOF = null; eq = null;
  await c.loadTM();
  assert.equal(Object.keys(map).length, 0, 'unknown ownership never implies non-equity fallback');
});

test('an identical price still updates or clears the visible previous-close percentage', () => {
  for (const baseline of [99, undefined]) {
    const row = { t:'AAPL', price:101, c:1 };
    const cells = Object.fromEntries(['lc_AAPL', 'coChg', 'coPrev'].map((key) => [key, { textContent:'old' }]));
    const c = context(['patch'], {
      window:{ SC_GUARD:{ provider_applied:0 } }, S:{ rows:[row], coData:{ t:'AAPL', chg:1 } },
      ALLROWS:[row], LEFT_T:'AAPL', PRICES:{ AAPL:101 }, prevClose:{ AAPL:baseline },
      document:{ querySelector:() => null }, scStamp() {}, el:(id) => cells[id] || null,
      fmtC:(value) => value.toFixed(2) + '%', fmtPxIdent:String
    });
    c.patch('AAPL', 101, 'PROVIDER');
    if (baseline == null) {
      assert.equal(row.c, null); assert.equal(c.S.coData.chg, null);
      assert.equal(cells.lc_AAPL.textContent, '—'); assert.equal(cells.coChg.textContent, '—');
      assert.equal(cells.coPrev.textContent, '');
    } else {
      assert.ok(Math.abs(row.c - (101 / 99 - 1) * 100) < 1e-12);
      assert.equal(cells.lc_AAPL.textContent, '2.02%'); assert.equal(cells.coChg.textContent, '2.02%');
    }
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const start = source.indexOf('/* R20 FIX 4 — ORIENTATION FLIP RE-RENDER:');
const end = source.indexOf('/* ---- LIVE TICK LAYER', start);
assert.ok(start >= 0 && end > start, 'The actual hub orientation handler must be present.');
const orientationSource = source.slice(start, end);

function harness(sec, socTab) {
  const events = new Map();
  const timers = new Map();
  const connected = { isConnected: true };
  const detached = { isConnected: false };
  const draws = [];
  let nextTimer = 0;
  let syncCalls = 0;
  const context = vm.createContext({
    S: { sec, socTab }, mountedKey: 'existing-room', CHART_HOSTS: [connected, detached],
    sync() { syncCalls++; }, scChartDraw: host => draws.push(host),
    clearTimeout: timer => timers.delete(timer),
    setTimeout(callback, delay) {
      assert.equal(delay, 250);
      timers.set(++nextTimer, callback);
      return nextTimer;
    },
    window: {
      addEventListener: (name, callback) => events.set(name, callback),
      matchMedia(query) {
        assert.equal(query, '(orientation: portrait)');
        return { addEventListener: (name, callback) => events.set('media:' + name, callback) };
      },
    },
  });
  vm.runInContext(orientationSource, context);
  return {
    context, draws, connected, syncCalls: () => syncCalls,
    dispatch(name) { assert.ok(events.has(name)); events.get(name)(); },
    settle() { const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback()); },
  };
}

test('both hub orientation signals preserve the mounted X iframe without a room sync', () => {
  const app = harness('SOCIAL', 'X');
  app.dispatch('orientationchange');
  app.dispatch('media:change');
  app.settle();
  assert.equal(app.context.mountedKey, 'existing-room');
  assert.equal(app.syncCalls(), 0);
  assert.deepEqual(app.draws, []);
});

test('other hub views retain their debounced orientation remount and connected chart redraw', () => {
  for (const [sec, socTab] of [['SOCIAL', 'SENTIMENT'], ['SOCIAL', 'YOUTUBE'], ['SOCIAL', 'STOCKTWITS'], ['DASHBOARD', 'X'], ['COMPANY', 'X'], ['SCENES', 'X'], ['NEWS', 'X']]) {
    const app = harness(sec, socTab);
    app.dispatch('orientationchange');
    app.dispatch('media:change');
    app.settle();
    assert.equal(app.context.mountedKey, null, sec + '/' + socTab);
    assert.equal(app.syncCalls(), 1, sec + '/' + socTab);
    assert.deepEqual(app.draws, [app.connected]);
  }
});

test('orientation protection follows the view active when the debounce settles', () => {
  const app = harness('DASHBOARD', 'X');
  app.dispatch('orientationchange');
  app.context.S.sec = 'SOCIAL';
  app.settle();
  assert.equal(app.syncCalls(), 0);
  app.dispatch('media:change');
  app.context.S.sec = 'DASHBOARD';
  app.settle();
  assert.equal(app.syncCalls(), 1);
});

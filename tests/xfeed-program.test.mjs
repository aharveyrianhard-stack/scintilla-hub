import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEventBuffer, classifySource, retryAtFromRates, zonedInstant, nextScheduled, decide, humanStatus, ensureIntake, writeHealth, fixtureTimeline, parseArgs, cdpAdapters, loadCycleFactory, LIST_URL } from '../scripts/xfeed-program.mjs';
import { freshness } from '../xfeed/model.mjs';

// Offline only. No browser, no network, no X. Stubs stand in for Playwright's page/CDP session.

test('event buffer gives the helper the readEvents contract: cursor, method filter, waiting, hasMore', async () => {
  const buffer = createEventBuffer();
  const now = await buffer.readEvents({});
  assert.deepEqual(now, { cursor: 0, events: [], hasMore: false, truncated: false }, 'no afterSequence means position at now');
  buffer.push('Network.responseReceived', { requestId: 'a' });
  buffer.push('Network.requestWillBeSent', { requestId: 'b' });
  buffer.push('Network.responseReceived', { requestId: 'c' });
  const read = await buffer.readEvents({ afterSequence: 0, methods: ['Network.responseReceived'] });
  assert.deepEqual(read.events.map(e => e.params.requestId), ['a', 'c']);
  assert.equal(read.cursor, 3); assert.equal(read.hasMore, false); assert.equal(read.truncated, false);
  const limited = await buffer.readEvents({ afterSequence: 0, methods: ['Network.responseReceived'], limit: 1 });
  assert.equal(limited.events.length, 1); assert.equal(limited.hasMore, true); assert.equal(limited.cursor, 1);
  const empty = await buffer.readEvents({ afterSequence: 3, methods: ['Network.responseReceived'] });
  assert.deepEqual(empty.events, []); assert.equal(empty.cursor, 3);
  const waiting = buffer.readEvents({ afterSequence: 3, methods: ['Network.responseReceived'], timeoutMs: 2000 });
  setTimeout(() => buffer.push('Network.responseReceived', { requestId: 'd' }), 30);
  const arrived = await waiting;
  assert.equal(arrived.events[0].params.requestId, 'd', 'a read waits for the next event instead of spinning');
  const timedOut = await buffer.readEvents({ afterSequence: 4, timeoutMs: 20 });
  assert.deepEqual(timedOut.events, []);
});

test('event buffer reports truncation only when events between the cursor and the oldest retained one were dropped', async () => {
  const buffer = createEventBuffer({ max: 3 });
  for (let i = 0; i < 5; i++) buffer.push('Network.responseReceived', { i });
  assert.equal((await buffer.readEvents({ afterSequence: 0 })).truncated, true);
  assert.equal((await buffer.readEvents({ afterSequence: 2 })).truncated, false);
  assert.equal((await buffer.readEvents({ afterSequence: 4 })).truncated, false);
});

test('source classification names signed-out, rate-limited, blocked and no-timeline states', () => {
  assert.equal(classifySource({ url: 'https://x.com/i/flow/login?redirect_after_login=%2Fi%2Flists%2F1' }), 'signed_out');
  assert.equal(classifySource({ url: LIST_URL, loginMarker: true }), 'signed_out');
  assert.equal(classifySource({ url: LIST_URL, timelineSeen: true }), 'ok');
  assert.equal(classifySource({ url: LIST_URL, timelineSeen: false }), 'no_timeline');
  assert.equal(classifySource({ blocked: { status: 429 } }), 'rate_limited');
  assert.equal(classifySource({ blocked: { status: 401 } }), 'signed_out');
  assert.equal(classifySource({ blocked: { status: 503 } }), 'blocked');
});

test('retry time comes only from what X actually returned', () => {
  assert.equal(retryAtFromRates({ 'x-rate-limit-reset': '1790150400' }), '2026-09-23T08:00:00.000Z');
  assert.equal(retryAtFromRates({ 'retry-after': '120' }, '2026-09-23T02:00:00.000Z'), '2026-09-23T02:02:00.000Z');
  assert.equal(retryAtFromRates({}), null);
  assert.equal(retryAtFromRates({ 'x-rate-limit-reset': 'soon' }), null);
});

test('schedule maths: the ET slots resolve to the right UTC instants across DST', () => {
  assert.equal(zonedInstant(2026, 9, 23, 6, 30), Date.UTC(2026, 8, 23, 10, 30), 'EDT is UTC-4');
  assert.equal(zonedInstant(2026, 11, 5, 6, 30), Date.UTC(2026, 10, 5, 11, 30), 'EST is UTC-5');
  const next = nextScheduled(Date.UTC(2026, 8, 23, 12, 0)); // 08:00 ET
  assert.deepEqual(next, ['2026-09-23T12:30:00.000Z', '2026-09-23T14:30:00.000Z', '2026-09-23T16:30:00.000Z', '2026-09-23T18:30:00.000Z']);
  assert.equal(nextScheduled(Date.UTC(2026, 8, 23, 23, 0))[0], '2026-09-24T01:00:00.000Z', 'the evening slot at 21:00 ET');
  assert.equal(nextScheduled(Date.UTC(2026, 8, 24, 4, 0))[0], '2026-09-24T10:30:00.000Z', 'after the 23:30 ET late-night slot the next one is 06:30 ET');
});

test('decisions: finish on the observed frontier, keep paging otherwise, stop loudly on limits', () => {
  const base = { summary: { blocked: null, rate_exhausted: null }, checkpoint: { frontier_key: 'k' }, pages: 2, maxPages: 60, elapsedMs: 1000, budgetMs: 60000 };
  const verified = { previous_frontier_observed: true, list_captures: 2, response_integrity: { cursor_chain_verified: true, missing_chunks: [] } };
  assert.deepEqual(decide({ ...base, pending: verified }), { action: 'finish', reason: 'overlap' });
  assert.deepEqual(decide({ ...base, pending: { ...verified, response_integrity: { cursor_chain_verified: false, missing_chunks: [] } } }), { action: 'page' }, 'an unverified chain is not a finish');
  assert.deepEqual(decide({ ...base, pending: { ...verified, previous_frontier_observed: false } }), { action: 'page' });
  assert.deepEqual(decide({ ...base, checkpoint: null, pages: 3, pending: { ...verified, previous_frontier_observed: false } }), { action: 'finish', reason: 'initial_window' }, 'first pass ever finishes its window');
  assert.deepEqual(decide({ ...base, checkpoint: null, pages: 1, pending: { ...verified, previous_frontier_observed: false } }), { action: 'page' });
  assert.deepEqual(decide({ ...base, summary: { blocked: { status: 429 } } }), { action: 'stop', status: 'rate_limited' });
  assert.deepEqual(decide({ ...base, summary: { blocked: null, rate_exhausted: { rates: {} } }, pending: { ...verified, previous_frontier_observed: false } }), { action: 'stop', status: 'rate_limited' });
  assert.deepEqual(decide({ ...base, pending: { ...verified, previous_frontier_observed: false }, stalledRounds: 2 }), { action: 'finish', reason: 'timeline_end' });
  assert.deepEqual(decide({ ...base, pending: { ...verified, previous_frontier_observed: false }, pages: 60 }), { action: 'stop', status: 'incomplete_page_budget' });
  assert.deepEqual(decide({ ...base, pending: { ...verified, previous_frontier_observed: false }, elapsedMs: 60000 }), { action: 'stop', status: 'incomplete_time_budget' });
  assert.match(humanStatus('signed_out'), /sign-in/); assert.equal(humanStatus('weird'), 'weird');
});

test('ensureIntake reuses a live intake for the same runtime, refuses a foreign one, and spawns with the documented arguments', async () => {
  const dir = '/tmp/xfeed-runtime-example';
  const reused = await ensureIntake({ runtimeDir: dir, fetchImpl: async () => ({ ok: true, json: async () => ({ runtime_dir: dir, publication_enabled: true }) }) });
  assert.equal(reused.spawned, false); assert.equal(reused.publication_enabled, true);
  await assert.rejects(ensureIntake({ runtimeDir: dir, fetchImpl: async () => ({ ok: true, json: async () => ({ runtime_dir: '/tmp/other' }) }) }), /different runtime/);
  let calls = 0, spawned = null;
  const child = { exitCode: null, stdout: { on() {} }, stderr: { on() {} }, killed: false, kill() { this.killed = true; }, once(_, fn) { fn(); } };
  const intake = await ensureIntake({ runtimeDir: dir, envFile: '/secret/.env.local', staleAfterSeconds: 23400, spawnImpl: (bin, args) => { spawned = { bin, args }; return child; }, fetchImpl: async () => { if (++calls < 3) throw new Error('not yet'); return { ok: true, json: async () => ({ runtime_dir: dir, publication_enabled: true }) }; } });
  assert.equal(intake.spawned, true); assert.equal(spawned.bin, process.execPath);
  assert.ok(spawned.args[0] === '--env-file=/secret/.env.local' && spawned.args.includes('--serve') && spawned.args.includes('--publish'));
  assert.equal(spawned.args[spawned.args.indexOf('--runtime-dir') + 1], dir);
  assert.equal(spawned.args[spawned.args.indexOf('--stale-after-seconds') + 1], '23400');
  const noEnv = await ensureIntake({ runtimeDir: dir, spawnImpl: (bin, args) => { spawned = { bin, args }; return child; }, fetchImpl: (() => { let n = 0; return async () => { if (++n < 2) throw new Error('no'); return { ok: true, json: async () => ({ runtime_dir: dir, publication_enabled: false }) }; }; })() });
  assert.equal(noEnv.publication_enabled, false); assert.ok(!spawned.args.includes('--publish') && !spawned.args[0].startsWith('--env-file'), 'no token file means no publication flag');
  await intake.stop(); assert.equal(child.killed, true);
});

test('the health file keeps the last good pass across later failures and lists the next four slots', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'xfeed-health-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const first = await writeHealth(dir, { pass_id: 'p1', host: 'h', started_at: '2026-09-23T02:00:00Z', finished_at: '2026-09-23T02:01:00Z', status: 'signed_out', error: 'x' }, { profileDir: '/p' });
  assert.equal(first.last_good_pass, null); assert.match(first.last_run.meaning, /signed out/); assert.equal(first.next_scheduled.length, 4); assert.deepEqual(first.schedule_et, ['06:30', '08:30', '10:30', '12:30', '14:30', '16:30', '18:30', '21:00', '23:30']);
  await writeHealth(dir, { pass_id: 'p2', host: 'h', started_at: '2026-09-23T03:00:00Z', finished_at: '2026-09-23T03:04:00Z', status: 'published', pages: 4, latest_source_event_at: '2026-09-23T02:58:00Z' }, {});
  const after = await writeHealth(dir, { pass_id: 'p3', host: 'h', started_at: '2026-09-23T09:00:00Z', finished_at: '2026-09-23T09:01:00Z', status: 'rate_limited', error: '429' }, {});
  assert.equal(after.last_good_pass.pass_id, 'p2'); assert.equal(after.last_good_pass.published, true); assert.equal(after.last_run.status, 'rate_limited');
  assert.deepEqual(JSON.parse(await readFile(join(dir, 'program-health.json'), 'utf8')).last_good_pass, after.last_good_pass);
});

test('the Playwright adapters drive the unchanged helper: begin() captures a routed timeline response through CDP events', async () => {
  const listeners = {}; const body = fixtureTimeline([{ id: '2097400000000000001', handle: 'TestTrader', created_at: '2026-09-22T20:00:00Z', text: 'EXAMPLE' }], 'EXAMPLE-CURSOR-2');
  let url = 'about:blank', wheels = 0, enabled = 0;
  const session = { on(event, fn) { listeners[event] = fn; }, async send(method) { if (method === 'Network.enable') { enabled++; return {}; } if (method === 'Network.getResponseBody') return { body: JSON.stringify(body), base64Encoded: false }; throw new Error(method); } };
  const page = { url: () => url, async goto(target) { url = target; listeners['Network.responseReceived']({ requestId: 'req.1', response: { status: 200, url: `https://x.com/i/api/graphql/EXAMPLE/ListLatestTweetsTimeline?variables=${encodeURIComponent(JSON.stringify({ listId: '1405188850188759047' }))}`, headers: { 'X-Rate-Limit-Remaining': '499' } } }); }, async reload() {}, mouse: { async move() {}, async wheel() { wheels++; } }, async waitForTimeout() {} };
  const { source, ui } = cdpAdapters(page, session);
  const createCycle = await loadCycleFactory();
  const cycle = await createCycle({ source, intake: {}, ui, passId: 'adapter-test' });
  const summary = await cycle.begin();
  assert.equal(enabled, 2, 'the helper enabled the Network domain before and after navigation');
  assert.equal(summary.pending_chunks, 1); assert.equal(summary.pending_bodies, 0); assert.equal(summary.blocked, null);
  assert.equal(cycle.queue[0].request_cursor, null); assert.equal(cycle.queue[0].rate_headers['x-rate-limit-remaining'], '499');
  cycle.queue.length = 0;
  await cycle.older(); assert.ok(wheels >= 10, 'older() scrolls the list column in wheel steps');
});

test('fixture timelines carry the bottom cursor and the terminate marker the helper and intake expect', () => {
  const page = fixtureTimeline([{ id: '2097400000000000002', handle: 'TestTrader', created_at: '2026-09-22T20:00:00Z', text: 'EXAMPLE' }], 'EXAMPLE-CURSOR-3', true);
  const [add, terminate] = page.data.list.tweets_timeline.timeline.instructions;
  assert.equal(add.entries.at(-1).content.cursorType, 'Bottom'); assert.equal(add.entries[0].content.itemContent.tweet_results.result.legacy.created_at, 'Tue Sep 22 20:00:00 +0000 2026');
  assert.deepEqual(terminate, { type: 'TimelineTerminateTimeline', direction: 'Bottom' });
});

test('argument parsing', () => {
  assert.deepEqual(parseArgs(['run', '--max-pages', '5', '--headless']).options, { maxPages: 5, headless: true });
  assert.deepEqual(parseArgs(['run', '--catch-up']).options, { maxPages: 600, budgetSeconds: 3000 });
  assert.throws(() => parseArgs(['run', '--max-pages', 'lots']), /positive integer/);
  assert.throws(() => parseArgs(['dance']), /Usage/);
  assert.throws(() => parseArgs(['run', '--profile']), /unknown or incomplete/);
});

test('the desk says a failed or silent collector in words, with the last good source time', () => {
  const now = Date.parse('2026-09-23T12:00:00Z');
  const base = { collected_at: '2026-09-08T19:24:31Z', collector_heartbeat_at: '2026-09-23T11:59:00Z', latest_source_event_at: '2026-09-08T19:07:59Z', stale_after_seconds: 23400, collector_status: 'idle', collector_error: null };
  assert.equal(freshness({ source: 'api', receipt: base, now }).state, 'updated');
  const down = freshness({ source: 'api', receipt: { ...base, collector_status: 'error', collector_error: 'the collector browser is signed out of X — open the sign-in file' }, now });
  assert.equal(down.state, 'error'); assert.match(down.text, /Collector down since/); assert.match(down.text, /signed out of X/); assert.match(down.text, /last good source/);
  const silent = freshness({ source: 'api', receipt: { ...base, collector_heartbeat_at: '2026-09-22T11:00:00Z' }, now });
  assert.equal(silent.state, 'stale'); assert.match(silent.text, /Collector silent · no run since/); assert.match(silent.text, /last good source/);
  const never = freshness({ source: 'api', receipt: { ...base, collector_status: 'error', collector_error: 'x', latest_source_event_at: null }, now });
  assert.match(never.text, /no good source pass on record/);
  assert.match(freshness({ source: 'static', receipt: base, now }).text, /collector unavailable/, 'static fallback wording unchanged');
});

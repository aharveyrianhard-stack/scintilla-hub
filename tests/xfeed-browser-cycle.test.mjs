import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCaptureService } from '../scripts/xfeed-capture-server.mjs';
const helper = await readFile(new URL('../scripts/xfeed-browser-cycle.js', import.meta.url), 'utf8');
const createCycle = runInNewContext(`${helper}\ncreateXfeedBrowserCycle`, { URL });
const listUrl = 'https://x.com/i/lists/1405188850188759047';

test('response body failures stay pending and a numeric zero quota stops paging without invalidating captured data', async () => {
  let reads = 0, bodies = 0, scrolls = 0;
  const cap = {
    async readEvents() { return ++reads === 1 ? { cursor: 1, hasMore: false, events: [{ params: { requestId: 'request.1', response: { status: 200, url: `https://x.com/i/api/graphql/id/ListLatestTweetsTimeline?variables=${encodeURIComponent(JSON.stringify({ listId: '1405188850188759047' }))}`, headers: { 'X-Rate-Limit-Remaining': 0, 'Retry-After': 120 } } } }] } : { cursor: 1, hasMore: false, events: [] }; },
    async send(method) {
      assert.equal(method, 'Network.getResponseBody');
      if (++bodies === 1) throw new Error('response body not finished yet');
      return { body: JSON.stringify({ data: { list: { tweets_timeline: { timeline: { instructions: [{ type: 'TimelineAddEntries', entries: [{ entryId: 'one', content: {} }] }] } } } } }), base64Encoded: false };
    },
  };
  const source = { capabilities: { get: async () => cap }, url: async () => listUrl };
  const cycle = await createCycle({ source, intake: {}, ui: { scroll: async () => { scrolls++; } }, passId: 'test-pass' });
  const waiting = await cycle.read(); assert.equal(waiting.pending_bodies, 1); assert.equal(waiting.pending_chunks, 0); assert.equal(waiting.blocked, null);
  assert.equal(waiting.rates['retry-after'], '120');
  const ready = await cycle.read(); assert.equal(ready.pending_bodies, 0); assert.equal(ready.pending_chunks, 1); assert.equal(ready.blocked, null);
  assert.equal(cycle.queue[0].response_chunk_index, 0); assert.equal(cycle.queue[0].request_cursor, null);
  cycle.queue.length = 0;
  await cycle.older(); assert.equal(scrolls, 0);
});

test('actual event truncation throws rather than claiming source continuity', async () => {
  const cap = { readEvents: async () => ({ cursor: 10, truncated: true, hasMore: false, events: [] }) };
  const cycle = await createCycle({ source: { capabilities: { get: async () => cap } }, intake: {}, ui: {}, passId: 'test-pass' });
  await assert.rejects(cycle.read(), /Source events were lost/);
});

test('actual helper begin, chunk save, pagination guard, and finish agree with the capture service contract', async t => {
  const runtimeDir = await mkdtemp(join(tmpdir(), 'xfeed-helper-service-')); t.after(() => rm(runtimeDir, { recursive: true, force: true }));
  const handlesPath = join(runtimeDir, 'handles.txt'); await writeFile(handlesPath, 'TestTrader\n');
  let publications = 0;
  const service = await createCaptureService({ runtimeDir, handlesPath, clock: () => '2030-01-01T00:00:00Z', publish: async () => { publications++; return { changed: true }; } });
  const post = (id, time, text) => ({ rest_id: id, core: { user_results: { result: { rest_id: '123', core: { screen_name: 'TestTrader' } } } }, legacy: { created_at: time, full_text: text, entities: {} } });
  const old = post('2097355556394562028', 'Tue Sep 08 16:00:00 +0000 2026', 'Older source row');
  const newer = post('2097355556394562029', 'Tue Sep 08 16:05:00 +0000 2026', 'x'.repeat(49000));
  const payload = tweets => ({ data: { list: { tweets_timeline: { timeline: { instructions: [{ type: 'TimelineAddEntries', entries: tweets.map(t => ({ entryId: `tweet-${t.rest_id}`, content: { itemContent: { tweet_results: { result: t } } } })) }] } } } } });
  await service.capture({ response_type: 'list', payload: payload([old]), observed_at: '2026-09-08T16:01:00Z', source_url: listUrl, pass_id: 'bootstrap' });
  await service.finish({ pass_id: 'bootstrap', reason: 'initial_window' });
  let reads = 0, reloads = 0, scrolls = 0, page = 'form', filled = null, finishedResult = null;
  const cap = {
    async send(method) { if (method === 'Network.enable') return {}; assert.equal(method, 'Network.getResponseBody'); return { body: JSON.stringify(payload([newer, old])), base64Encoded: false }; },
    async readEvents() {
      if (++reads === 1) return { cursor: 10, events: [], hasMore: false };
      if (reads === 2) return { cursor: 11, hasMore: false, events: [{ params: { requestId: 'request.2', response: { status: 200, url: `https://x.com/i/api/graphql/id/ListLatestTweetsTimeline?variables=${encodeURIComponent(JSON.stringify({ listId: '1405188850188759047' }))}`, headers: { 'x-rate-limit-remaining': '499' } } } }] };
      return { cursor: 11, events: [], hasMore: false };
    },
  };
  const source = { capabilities: { get: async () => cap }, url: async () => listUrl, reload: async () => { reloads++; } };
  const intake = { playwright: {
    getByLabel(label, options) { assert.equal(options.exact, true); assert.ok(['Capture JSON', 'Pass JSON'].includes(label)); return { count: async () => page === 'form' ? 1 : 0, fill: async text => { filled = JSON.parse(text); } }; },
    getByRole(role, { name, exact }) {
      assert.equal(exact, true);
      return { count: async () => role === 'link' && name === 'New capture' && page !== 'form' ? 1 : 0,
        click: async () => {
          if (name === 'New capture') { page = 'form'; return; }
          if (name === 'Save capture') { await service.capture(filled); page = 'saved'; return; }
          if (name === 'Finish pass') { finishedResult = await service.finish(filled); page = 'finished'; return; }
          assert.fail(`unexpected action ${name}`);
        }, waitFor: async () => assert.equal(page, name === 'Capture saved' ? 'saved' : 'finished'),
      };
    }, locator(selector) { assert.equal(selector, 'pre'); return { textContent: async () => JSON.stringify(finishedResult) }; },
  } };
  const cycle = await createCycle({ source, intake, ui: { scroll: async () => { scrolls++; } }, passId: 'recurring' });
  await cycle.begin(); assert.equal(reloads, 1); assert.equal(cycle.queue.length, 2, 'large source entry splits without losing the subsequent frontier entry');
  await assert.rejects(cycle.older(), /Save pending source chunks/); assert.equal(scrolls, 0);
  await cycle.save(1); assert.equal(cycle.saved, 1); assert.equal(cycle.queue.length, 1);
  await cycle.save(8); assert.equal(cycle.saved, 2); assert.equal(cycle.queue.length, 0);
  const pending = (await service.health()).pending_passes.find(p => p.pass_id === 'recurring');
  assert.equal(pending.response_integrity.captures_without_response_metadata, 0); assert.equal(pending.response_integrity.cursor_chain_verified, true); assert.equal(pending.previous_frontier_observed, true);
  const done = JSON.parse(await cycle.finish('overlap'));
  assert.equal(done.published, true); assert.equal(done.source_receipt.coverage.refresh_interval_continuity_verified, true);
  assert.equal(publications, 2);
});

test('a failed intake save retains the queued source chunk and does not count success', async () => {
  const intake = { playwright: {
    getByRole(role) { return { count: async () => 0, click: async () => { throw new Error('intake unavailable'); } }; },
    getByLabel() { return { count: async () => 1, fill: async () => {} }; },
  } };
  const cycle = await createCycle({ source: { capabilities: { get: async () => ({}) } }, intake, ui: {}, passId: 'test-pass' });
  cycle.queue.push({ response_type: 'list' });
  await assert.rejects(cycle.save(), /intake unavailable/);
  assert.equal(cycle.queue.length, 1); assert.equal(cycle.saved, 0);
});

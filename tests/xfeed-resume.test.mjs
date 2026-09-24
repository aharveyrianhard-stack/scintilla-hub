import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCaptureService } from '../scripts/xfeed-capture-server.mjs';

// Offline only: EXAMPLE response shapes, a temporary runtime directory, and
// stubbed browser/CDP objects. Nothing here requests X or reads a session.
const listUrl = 'https://x.com/i/lists/1405188850188759047';
const clock = () => '2026-09-19T21:00:00.000Z';

function tweet(id, created, text = 'EXAMPLE trading row') {
  return { rest_id: id, core: { user_results: { result: { rest_id: '1000', core: { screen_name: 'TestTrader' } } } }, legacy: { id_str: id, created_at: created, full_text: text, entities: { urls: [] } } };
}
function instructions(tweets, bottom) {
  const entries = tweets.map(t => ({ entryId: `tweet-${t.rest_id}`, content: { itemContent: { tweet_results: { result: t } } } }));
  if (bottom) entries.push({ entryId: 'cursor-bottom-0', content: { cursorType: 'Bottom', value: bottom } });
  return [{ type: 'TimelineAddEntries', entries }];
}
function page({ pass, tweets, cursor = null, bottom = null, responseId, observedAt, chunkCount = 1, chunkIndex = 0 }) {
  return {
    response_type: 'list', source_url: listUrl, observed_at: observedAt, pass_id: pass,
    payload: { data: { list: { tweets_timeline: { timeline: { instructions: instructions(tweets, bottom) } } } } },
    response_id: responseId, request_cursor: cursor, response_chunk_index: chunkIndex, response_chunk_count: chunkCount,
  };
}
async function fixture(t) {
  const runtimeDir = await mkdtemp(join(tmpdir(), 'xfeed-resume-'));
  t.after(() => rm(runtimeDir, { recursive: true, force: true }));
  const handlesPath = join(runtimeDir, 'handles.txt');
  await writeFile(handlesPath, 'TestTrader\n');
  return { runtimeDir, handlesPath, service: await createCaptureService({ runtimeDir, handlesPath, clock }) };
}
const pending = async (service, id) => (await service.health()).pending_passes.find(p => p.pass_id === id);

test('an interrupted refresh keeps a committed resume point and continues from the deepest stored cursor', async t => {
  const { service, runtimeDir, handlesPath } = await fixture(t);
  await service.capture(page({ pass: 'refresh-1', tweets: [tweet('2097355556394562030', 'Sat Sep 19 15:00:00 +0000 2026')], cursor: null, bottom: 'EXAMPLE-CURSOR-2', responseId: 'refresh-1:req.1', observedAt: '2026-09-19T15:05:00.000Z' }));
  await service.capture(page({ pass: 'refresh-1', tweets: [tweet('2097355556394562029', 'Sat Sep 19 14:00:00 +0000 2026')], cursor: 'EXAMPLE-CURSOR-2', bottom: 'EXAMPLE-CURSOR-3', responseId: 'refresh-1:req.2', observedAt: '2026-09-19T15:06:00.000Z' }));

  // The pass is interrupted before finish: no frontier checkpoint is written,
  // so the per-page resume record is the only thing that survives.
  const persisted = JSON.parse(await readFile(join(runtimeDir, 'state.json'), 'utf8'));
  assert.equal(persisted.checkpoint, null);
  assert.equal(persisted.passes['refresh-1'].resume.next_cursor, 'EXAMPLE-CURSOR-3');
  assert.deepEqual(persisted.passes['refresh-1'].resume.request_cursors, [null, 'EXAMPLE-CURSOR-2']);

  const restarted = await createCaptureService({ runtimeDir, handlesPath, clock });
  const stopped = await pending(restarted, 'refresh-1');
  assert.equal(stopped.resume.next_cursor, 'EXAMPLE-CURSOR-3');
  assert.deepEqual(stopped.resume.request_cursors, [null, 'EXAMPLE-CURSOR-2']);
  assert.equal(stopped.response_integrity.cursor_chain_verified, true);
  assert.equal(stopped.list_captures, 2);

  await restarted.capture(page({ pass: 'refresh-1', tweets: [tweet('2097355556394562028', 'Sat Sep 19 13:00:00 +0000 2026')], cursor: 'EXAMPLE-CURSOR-3', bottom: 'EXAMPLE-CURSOR-4', responseId: 'refresh-1:req.3', observedAt: '2026-09-19T15:20:00.000Z' }));
  const resumed = await pending(restarted, 'refresh-1');
  assert.equal(resumed.resume.next_cursor, 'EXAMPLE-CURSOR-4');
  assert.equal(resumed.list_captures, 3, 'resuming stores one further page and re-paginates nothing');
  assert.deepEqual(resumed.response_integrity.verified_chain_response_ids, ['refresh-1:req.1', 'refresh-1:req.2', 'refresh-1:req.3']);
  assert.equal(resumed.response_integrity.cursor_chain_verified, true);
  assert.equal(resumed.response_integrity.next_cursor, undefined, 'resume fields stay out of the published integrity diagnostic');
});

test('a rejected capture does not lose the resume point already committed for the pass', async t => {
  const { service } = await fixture(t);
  await service.capture(page({ pass: 'refresh-2', tweets: [tweet('2097355556394562030', 'Sat Sep 19 15:00:00 +0000 2026')], cursor: null, bottom: 'EXAMPLE-CURSOR-2', responseId: 'refresh-2:req.1', observedAt: '2026-09-19T15:05:00.000Z' }));
  await assert.rejects(service.capture(page({ pass: 'refresh-2', tweets: [tweet('2097355556394562029', 'Sat Sep 19 14:00:00 +0000 2026')], cursor: 'EXAMPLE-CURSOR-9', responseId: 'refresh-2:req.1', observedAt: '2026-09-19T15:07:00.000Z' })), /chunks disagree/);
  const after = await pending(service, 'refresh-2');
  assert.equal(after.resume.next_cursor, 'EXAMPLE-CURSOR-2');
  assert.deepEqual(after.resume.request_cursors, [null]);
  assert.equal(after.list_captures, 1);
});

test('the browser helper resumes a pass without reloading the list or re-collecting stored pages', async t => {
  const helper = await readFile(new URL('../scripts/xfeed-browser-cycle.js', import.meta.url), 'utf8');
  const createCycle = runInNewContext(`${helper}\ncreateXfeedBrowserCycle`, { URL });
  const body = JSON.stringify({ data: { list: { tweets_timeline: { timeline: { instructions: instructions([tweet('2097355556394562028', 'Sat Sep 19 13:00:00 +0000 2026')], 'EXAMPLE-CURSOR-4') } } } } });
  const requestUrl = cursor => `https://x.com/i/api/graphql/id/ListLatestTweetsTimeline?variables=${encodeURIComponent(JSON.stringify({ listId: '1405188850188759047', ...(cursor ? { cursor } : {}) }))}`;
  const event = (requestId, cursor) => ({ params: { requestId, response: { status: 200, url: requestUrl(cursor), headers: { 'x-rate-limit-remaining': '400' } } } });
  const stubs = () => {
    const counts = { reloads: 0, gotos: 0, reads: 0 };
    const cap = {
      async send(method) { if (method === 'Network.enable') return {}; assert.equal(method, 'Network.getResponseBody'); return { body, base64Encoded: false }; },
      async readEvents() {
        counts.reads++;
        if (counts.reads === 2) return { cursor: 2, hasMore: false, events: [event('req.top', null), event('req.deep', 'EXAMPLE-CURSOR-3')] };
        return { cursor: 2, hasMore: false, events: [] };
      },
    };
    const source = { capabilities: { get: async () => cap }, url: async () => listUrl, reload: async () => { counts.reloads++; }, goto: async () => { counts.gotos++; } };
    return { counts, source };
  };

  const resumed = stubs();
  const cycle = await createCycle({ source: resumed.source, intake: {}, ui: { scroll: async () => {} }, passId: 'refresh-1', resume: { next_cursor: 'EXAMPLE-CURSOR-3', request_cursors: [null, 'EXAMPLE-CURSOR-2'] } });
  const summary = await cycle.begin();
  assert.equal(resumed.counts.reloads, 0, 'a resumed pass must not reload the list back to its newest page');
  assert.equal(resumed.counts.gotos, 0);
  assert.equal(summary.resumed, true);
  assert.equal(summary.resume_cursor, 'EXAMPLE-CURSOR-3');
  assert.equal(summary.skipped_stored_pages, 1, 'the already stored first page is not collected again');
  assert.equal(summary.pages, 1);
  assert.equal(cycle.queue.length, 1);
  assert.equal(cycle.queue[0].request_cursor, 'EXAMPLE-CURSOR-3');

  const fresh = stubs();
  const firstPass = await createCycle({ source: fresh.source, intake: {}, ui: { scroll: async () => {} }, passId: 'refresh-3' });
  const firstSummary = await firstPass.begin();
  assert.equal(fresh.counts.reloads, 1, 'a pass with nothing stored still refreshes the list');
  assert.equal(firstSummary.skipped_stored_pages, 0);
  assert.equal(firstPass.queue.length, 2);
});

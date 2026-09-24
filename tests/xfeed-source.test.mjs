import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { transformResponse, verifyMembers, TRADING_LIST_ID } from '../scripts/xfeed-source.mjs';
import { createCaptureService, createCaptureServer, auditResponseChain } from '../scripts/xfeed-capture-server.mjs';
import { latestPosts } from '../scripts/xfeed-ingest.mjs';

const at = '2026-09-08T16:30:00.000Z';
const url = `https://x.com/i/lists/${TRADING_LIST_ID}`;
function tweet(id = '2097355556394562028', options = {}) {
  return { rest_id: id, __typename: 'Tweet', core: { user_results: { result: { rest_id: '12345', core: { screen_name: 'TestTrader', name: 'Test Trader' }, notifications_settings: { notifications_enabled: true }, relationship_perspectives: { muting: true }, dm_permissions: { can_dm: true } } } }, legacy: { id_str: id, created_at: 'Tue Sep 08 16:05:06 +0000 2026', full_text: 'Observed &amp; text', bookmarked: true, favorited: true, entities: { urls: [] }, ...options.legacy }, ...Object.fromEntries(Object.entries(options).filter(([k]) => k !== 'legacy')) };
}
function envelope(tweets, pass = 'pass-one') {
  return { response_type: 'list', source_url: url, observed_at: at, pass_id: pass, rate_headers: { 'x-rate-limit-limit': '500', 'x-rate-limit-remaining': '499', authorization: 'NOT_A_REAL_SECRET' }, payload: { data: { list: { tweets_timeline: { timeline: { instructions: [{ type: 'TimelineAddEntries', entries: tweets.map(t => ({ entryId: `tweet-${t.rest_id}`, content: { itemContent: { tweet_results: { result: t } } } })) }] } } } } } };
}

test('source preserves full notes, every native video and public fields without viewer state', () => {
  const media = n => ({ type: 'video', media_url_https: `https://pbs.twimg.com/media/${n}.jpg`, video_info: { variants: [{ content_type: 'video/mp4', bitrate: 1, url: `https://video.twimg.com/${n}-low.mp4` }, { content_type: 'video/mp4', bitrate: 10, url: `https://video.twimg.com/${n}.mp4` }] } });
  const t = tweet(undefined, { legacy: { extended_entities: { media: [media(1), media(2), { type: 'video', media_url_https: 'https://pbs.twimg.com/media/3.jpg' }] } }, note_tweet: { note_tweet_results: { result: { text: 'Full &amp; note is literal', entity_set: { urls: [{ expanded_url: 'https://example.com/report' }] } } } } });
  const result = transformResponse(envelope([t]));
  const p = result.posts[0];
  assert.equal(p.text, 'Full &amp; note is literal'); assert.equal(p.videos.length, 3);
  assert.equal(p.videos[0].url, 'https://video.twimg.com/1.mp4'); assert.equal(p.videos[2].url, null);
  assert.equal(p.raw.legacy.extended_entities.media[0].video_info.variants.length, 2);
  assert.equal(p.links[0].url, 'https://example.com/report');
  const serialized = JSON.stringify(result);
  for (const key of ['NOT_A_REAL_SECRET', 'notifications_settings', 'relationship_perspectives', 'dm_permissions', 'bookmarked', 'favorited']) assert.equal(serialized.includes(key), false, key);
  assert.equal(result.rate_headers['x-rate-limit-remaining'], '499');
  assert.equal(transformResponse(envelope([tweet()])).posts[0].text, 'Observed & text');
});

test('repost uses observed wrapper actor, ID and action time before inherited quote flags', () => {
  const deep = tweet('2000000000000000001', { legacy: { created_at: 'Mon Sep 07 10:00:00 +0000 2026', full_text: 'quoted body' } });
  const quoted = tweet('2000000000000000002', { legacy: { created_at: 'Tue Sep 08 13:00:00 +0000 2026', is_quote_status: true, quoted_status_id_str: deep.rest_id }, quoted_status_result: { result: deep } });
  const wrapper = tweet('2097352434372755783', { legacy: { created_at: 'Tue Sep 08 15:52:41 +0000 2026', is_quote_status: true, retweeted_status_result: { result: quoted } } });
  const p = transformResponse(envelope([wrapper])).posts[0];
  assert.equal(p.kind, 'repost'); assert.equal(p.created_at, '2026-09-08T15:52:41.000Z');
  assert.equal(p.original.id, quoted.rest_id); assert.equal(p.original.original.text, 'quoted body');
  assert.equal(p.raw.original.original.legacy.full_text, 'quoted body');
});

test('detail scopes to requested post and module action time excludes older conversation context', () => {
  const older = tweet('2000000000000000001', { legacy: { created_at: 'Mon Sep 07 10:00:00 +0000 2026' } });
  const recent = tweet(); const input = envelope([]);
  input.payload.data.list.tweets_timeline.timeline.instructions[0].entries = [{ entryId: 'conversation', content: { items: [older, recent].map(t => ({ item: { itemContent: { tweet_results: { result: t } } } })) } }];
  const result = transformResponse(input);
  assert.equal(result.posts.length, 2); assert.equal(result.timeline_rows[0].latest_action_at, '2026-09-08T16:05:06.000Z');
  const detail = transformResponse({ response_type: 'detail', source_url: `https://x.com/TestTrader/status/${older.rest_id}`, observed_at: at, payload: { data: { threaded_conversation_with_injections_v2: { instructions: input.payload.data.list.tweets_timeline.timeline.instructions } } } });
  assert.deepEqual(detail.posts.map(p => p.id), [older.rest_id]);
});

test('membership is authoritative only for the full exact set and known boolean flags', () => {
  const members = [{ handle: 'TestTrader', notifications_enabled: true }, { handle: 'SecondTrader', notifications_enabled: false }];
  const expected = ['TestTrader', 'SecondTrader'];
  assert.equal(verifyMembers(members.slice(0, 1), expected, at).status, 'unconfigured');
  assert.equal(verifyMembers([{ ...members[0], notifications_enabled: null }, members[1]], expected, at).status, 'unconfigured');
  const config = verifyMembers(members, expected, at); assert.equal(config.status, 'configured'); assert.deepEqual(config.handles, ['TestTrader']);
  assert.throws(() => transformResponse({ ...envelope([]), source_url: 'https://x.com/i/lists/1' }), /configured Trading list/);
});

test('observed card title is associated only with its matching outbound URL', () => {
  const t = tweet(undefined, { legacy: { entities: { urls: [{ url: 'https://t.co/abc', expanded_url: 'https://example.com/article', display_url: 'example.com/article' }, { expanded_url: 'https://example.org/other', display_url: 'example.org/other' }] } }, card: { legacy: { url: 'https://t.co/abc', binding_values: [{ key: 'title', value: { string_value: 'Observed article title' } }] } } });
  const links = transformResponse(envelope([t])).posts[0].links;
  assert.equal(links[0].title, 'Observed article title'); assert.equal(links[1].title, 'example.org/other');
});

async function serviceFixture(t, publish = null) {
  const directory = await mkdtemp(join(tmpdir(), 'xfeed-source-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const handlesPath = join(directory, 'handles.txt'); await writeFile(handlesPath, 'TestTrader\n');
  const service = await createCaptureService({ runtimeDir: directory, handlesPath, publish, clock: () => '2026-09-08T17:00:00.000Z' });
  return { service, directory };
}

test('capture is idempotent and finish publishes once with separate honest list coverage', async t => {
  let published = 0;
  const { service, directory } = await serviceFixture(t, async () => { published++; return { changed: true }; });
  const input = envelope([tweet()]);
  await service.capture(input);
  assert.equal((await service.capture(input)).duplicate, true);
  assert.equal(published, 0);
  const first = await service.finish({ pass_id: 'pass-one', reason: 'initial_window' });
  assert.equal(first.source_receipt.coverage.initial_history_gap_open, true);
  assert.equal(first.source_receipt.coverage.history_complete, false);
  assert.equal(published, 1);
  assert.equal((await service.finish({ pass_id: 'pass-one', reason: 'initial_window' })).duplicate, true);
  assert.equal(published, 1);
  const receipt = JSON.parse(await readFile(join(directory, 'data/receipt.json')));
  assert.equal(receipt.handles_attempted, 0, 'list capture must not fabricate individual queries');
  const second = envelope([tweet('2097355556394562029', { legacy: { created_at: 'Tue Sep 08 16:10:00 +0000 2026' } })], 'pass-two');
  await service.capture({ ...second, response_id: 'pass-two.response', request_cursor: null, response_chunk_index: 0, response_chunk_count: 2 });
  await assert.rejects(service.finish({ pass_id: 'pass-two', reason: 'overlap' }), /chunks are incomplete/);
  await service.capture({ ...envelope([tweet()], 'pass-two'), observed_at: '2026-09-08T16:31:00.000Z', response_id: 'pass-two.response', request_cursor: null, response_chunk_index: 1, response_chunk_count: 2 });
  const done = await service.finish({ pass_id: 'pass-two', reason: 'overlap' });
  assert.equal(done.source_receipt.coverage.overlap_with_previous_frontier, true); assert.equal(published, 2);
  const rows = (await readFile(join(directory, 'data/ledger.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(latestPosts(rows).length, 2);
  await assert.rejects(service.capture({ ...input, pass_id: '__proto__' }), /pass_id/);
});

test('detail hydration supplies nested originals without adding outside-roster root posts', async t => {
  const { service, directory } = await serviceFixture(t);
  const root = tweet(undefined, { legacy: { is_quote_status: true, quoted_status_id_str: '2000000000000000001' } });
  await service.capture(envelope([root]));
  const original = tweet('2000000000000000001'); original.core.user_results.result.core.screen_name = 'ExternalAuthor';
  await service.capture({ response_type: 'detail', source_url: `https://x.com/ExternalAuthor/status/${original.rest_id}`, observed_at: at, pass_id: 'pass-one', payload: { data: { tweetResult: { result: original } } } });
  const done = await service.finish({ pass_id: 'pass-one', reason: 'initial_window' });
  assert.equal(done.source_receipt.coverage.unresolved.length, 0);
  const rows = latestPosts((await readFile(join(directory, 'data/ledger.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse));
  assert.equal(rows.length, 1); assert.equal(rows[0].original.handle, 'ExternalAuthor');
});

test('incomplete response chunks block completion and explicit cursors prove a captured chain', async t => {
  const { service } = await serviceFixture(t);
  const metadata = { response_id: 'network.1', request_cursor: null, response_chunk_index: 0, response_chunk_count: 2 };
  await service.capture({ ...envelope([tweet()]), ...metadata });
  await assert.rejects(service.finish({ pass_id: 'pass-one', reason: 'initial_window' }), /chunks are incomplete/);
  const second = envelope([]); second.payload.data.list.tweets_timeline.timeline.instructions[0].entries.push({ content: { cursorType: 'Bottom', value: 'cursor-B' } });
  await service.capture({ ...second, ...metadata, response_chunk_index: 1 });
  const nextPage = envelope([tweet('2097355556394562027', { legacy: { created_at: 'Tue Sep 08 16:00:00 +0000 2026' } })]);
  await service.capture({ ...nextPage, response_id: 'network.2', request_cursor: 'cursor-B', response_chunk_index: 0, response_chunk_count: 1 });
  const result = await service.finish({ pass_id: 'pass-one', reason: 'initial_window' });
  assert.equal(result.source_receipt.coverage.cursor_chain_verified, true);
  assert.equal(result.source_receipt.coverage.response_integrity.captures_without_response_metadata, 0);
  assert.equal(result.source_receipt.coverage.refresh_interval_continuity_verified, false);
  assert.deepEqual(result.source_receipt.coverage.response_integrity.verified_chain_response_ids, ['network.1', 'network.2']);
  assert.equal(result.source_receipt.coverage.initial_history_gap_open, true);
});

test('legacy counter migration subtracts all observed indexed chunks instead of labeling them untracked', () => {
  const response = { response_id: 'actual-shape.1', chunk_count: 19, request_cursor: null, observed_at: at,
    chunks: Object.fromEntries(Array.from({ length: 19 }, (_, i) => [i, { hash: `chunk-${i}`, timeline_rows: [], cursors: [] }])) };
  const pass = { list_captures: 19, responses: { one: response } };
  const result = auditResponseChain(pass);
  assert.equal(result.captures_without_response_metadata, 0);
  assert.equal(result.complete_response_count, 1); assert.equal(result.cursor_chain_verified, true);
  assert.equal(auditResponseChain({ ...pass, list_captures: 21 }).captures_without_response_metadata, 2);
  assert.equal(auditResponseChain({ list_captures: 35 }).captures_without_response_metadata, 35);
});

test('a failed completed-pass publication is retryable without repeating source completion', async t => {
  let tries = 0;
  const { service, directory } = await serviceFixture(t, async () => { if (++tries === 1) throw new Error('simulated publication failure'); return { changed: true }; });
  await service.capture({ ...envelope([tweet()]), response_id: 'network.1', request_cursor: null, response_chunk_index: 0, response_chunk_count: 1 });
  await assert.rejects(service.finish({ pass_id: 'pass-one', reason: 'initial_window' }), /simulated/);
  const receiptPath = join(directory, 'data/source-receipt.json');
  const before = JSON.parse(await readFile(receiptPath));
  // Simulate the older service's persisted missing-counter fallback defect.
  const oldDiagnostic = structuredClone(before); oldDiagnostic.coverage.response_integrity.captures_without_response_metadata = 19;
  await writeFile(receiptPath, JSON.stringify(oldDiagnostic));
  const retry = await service.finish({ pass_id: 'pass-one', reason: 'initial_window' });
  assert.equal(retry.published, true); assert.equal(tries, 2);
  assert.deepEqual(JSON.parse(await readFile(receiptPath)), before, 'retry corrects only the chunk diagnostic; actual source/completion clocks and boundaries stay intact');
  await service.finish({ pass_id: 'pass-one', reason: 'initial_window' }); assert.equal(tries, 2);
});

test('loopback handler rejects cross-origin or DNS-rebound hosts without opening a listener', async () => {
  let captured = 0;
  const server = createCaptureServer({ capture: async () => { captured++; }, health: async () => ({}) });
  const handle = server.listeners('request')[0];
  for (const headers of [{ host: 'evil.example:8766' }, { host: '127.0.0.1:8766', origin: 'https://x.com' }]) {
    let status; const res = { setHeader() {}, writeHead(s) { status = s; }, end() {} };
    await handle({ method: 'POST', url: '/capture', headers, socket: { remoteAddress: '127.0.0.1' } }, res);
    assert.equal(status, 403);
  }
  assert.equal(captured, 0);
});

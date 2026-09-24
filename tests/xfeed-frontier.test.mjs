import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { transformResponse, TRADING_LIST_ID } from '../scripts/xfeed-source.mjs';
import { createCaptureService } from '../scripts/xfeed-capture-server.mjs';

const PARENT = '2097401580035162443';
const REPLY = '2097401741276745967';
const OTHER = '2097402737440735439';
const SECOND_OLD = '2097401360056488050';
const PARENT_KEY = `post:${PARENT}`;
const LIST_URL = `https://x.com/i/lists/${TRADING_LIST_ID}`;
const PARENT_TIME = '2026-09-08T16:05:00.000Z';
const REPLY_TIME = '2026-09-08T16:10:00.000Z';

function tweet(id, at = REPLY_TIME, legacy = {}, extra = {}) {
  return {
    rest_id: id, __typename: 'Tweet',
    core: { user_results: { result: { rest_id: '12345', core: { screen_name: 'TestTrader', name: 'Test Trader' } } } },
    legacy: { id_str: id, created_at: new Date(at).toUTCString(), full_text: `Observed ${id}`, entities: { urls: [] }, ...legacy },
    ...extra,
  };
}
const parent = () => tweet(PARENT, PARENT_TIME);
const reply = () => tweet(REPLY, REPLY_TIME, { in_reply_to_status_id_str: PARENT, conversation_id_str: PARENT });
const entry = t => ({ entryId: `tweet-${t.rest_id}`, content: { itemContent: { tweet_results: { result: t } } } });
const conversation = (tweets, id = 'conversation') => ({ entryId: id, content: { items: tweets.map(t => ({ item: { itemContent: { tweet_results: { result: t } } } })) } });
const bottom = value => ({ entryId: 'cursor-bottom', content: { cursorType: 'Bottom', value } });

function envelope(entries, { pass = 'next', response = 'next.1', cursor = null, index = 0, count = 1, tracked = true } = {}) {
  return {
    response_type: 'list', source_url: LIST_URL, observed_at: '2026-09-08T16:31:00.000Z', pass_id: pass,
    ...(tracked ? { response_id: response, request_cursor: cursor, response_chunk_index: index, response_chunk_count: count } : {}),
    payload: { data: { list: { tweets_timeline: { timeline: { instructions: [{ type: 'TimelineAddEntries', entries }] } } } } },
  };
}

async function fixture(t, seed = true) {
  const directory = await mkdtemp(join(tmpdir(), 'xfeed-frontier-regression-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const handlesPath = join(directory, 'handles.txt');
  await writeFile(handlesPath, 'TestTrader\n');
  const publications = [];
  const options = { runtimeDir: directory, handlesPath, clock: () => '2026-09-08T17:00:00.000Z', publish: async () => { publications.push('published'); return { changed: true }; } };
  const service = await createCaptureService(options);
  if (seed) {
    await service.capture(envelope([entry(parent())], { pass: 'seed', response: 'seed.1' }));
    await service.finish({ pass_id: 'seed', reason: 'initial_window' });
  }
  return { service, directory, options, publications };
}

async function pending(service) {
  return (await service.health()).pending_passes.find(p => p.pass_id === 'next');
}

async function rejectedWithoutAdvancing(f, pattern = /previous source frontier/) {
  assert.equal((await pending(f.service)).previous_frontier_observed, false);
  const statePath = join(f.directory, 'state.json');
  const receiptPath = join(f.directory, 'data/source-receipt.json');
  const checkpoint = JSON.parse(await readFile(statePath, 'utf8')).checkpoint;
  const receipt = await readFile(receiptPath, 'utf8');
  const count = f.publications.length;
  await assert.rejects(f.service.finish({ pass_id: 'next', reason: 'overlap' }), pattern);
  const after = JSON.parse(await readFile(statePath, 'utf8'));
  assert.deepEqual(after.checkpoint, checkpoint);
  assert.equal(after.passes.next.completed_at, undefined);
  assert.equal(await readFile(receiptPath, 'utf8'), receipt);
  assert.equal(f.publications.length, count);
}

test('a freshly observed conversation parent reaches the exact frontier without changing the newer action clock', async t => {
  const f = await fixture(t);
  const input = envelope([conversation([parent(), reply()])]);
  const row = transformResponse(input).timeline_rows[0];
  assert.deepEqual(row.member_keys, [PARENT_KEY, `post:${REPLY}`]);
  assert.equal(row.anchor_key, `post:${REPLY}`);
  assert.equal(row.latest_action_at, REPLY_TIME);
  await f.service.capture(input);
  assert.equal((await pending(f.service)).previous_frontier_observed, true);
  const done = await f.service.finish({ pass_id: 'next', reason: 'overlap' });
  const coverage = done.source_receipt.coverage;
  assert.equal(coverage.overlap_with_previous_frontier, true);
  assert.equal(coverage.refresh_interval_continuity_verified, true);
  assert.equal(coverage.cursor_chain_verified, true);
  assert.equal(coverage.oldest_timeline_action_at, REPLY_TIME);
  assert.equal(coverage.latest_observed_post_at, REPLY_TIME);
  assert.equal(coverage.earliest_observed_post_at, PARENT_TIME);
  assert.deepEqual(coverage.frozen_baseline_overlap_keys, [], 'baseline diagnostics retain module anchors');
  assert.equal((await f.service.health()).checkpoint.frontier_key, `post:${REPLY}`);
  assert.equal(f.publications.length, 2);
});

for (const kind of ['quote', 'repost']) {
  test(`a ${kind} nested original is not an immediate module member or frontier proof`, async t => {
    const f = await fixture(t);
    const nested = kind === 'quote'
      ? tweet(OTHER, REPLY_TIME, { is_quote_status: true, quoted_status_id_str: PARENT }, { quoted_status_result: { result: parent() } })
      : tweet(OTHER, REPLY_TIME, { retweeted_status_result: { result: parent() } });
    const input = envelope([conversation([nested])]);
    const transformed = transformResponse(input);
    assert.equal(transformed.posts[0].original.id, PARENT, 'the original really is present as nested content');
    assert.deepEqual(transformed.timeline_rows[0].member_keys, [kind === 'repost' ? `repost:testtrader:${OTHER}` : `post:${OTHER}`]);
    await f.service.capture(input);
    await rejectedWithoutAdvancing(f);
  });
}

test('a bare reply reference cannot substitute for the actual parent timeline item', async t => {
  const f = await fixture(t);
  const input = envelope([conversation([reply()])]);
  assert.deepEqual(transformResponse(input).timeline_rows[0].member_keys, [`post:${REPLY}`]);
  await f.service.capture(input);
  await rejectedWithoutAdvancing(f);
});

test('a parent available only through detail hydration cannot establish list frontier presence', async t => {
  const f = await fixture(t);
  await f.service.capture(envelope([entry(reply())]));
  await f.service.capture({ response_type: 'detail', source_url: `https://x.com/TestTrader/status/${PARENT}`, observed_at: '2026-09-08T16:32:00.000Z', pass_id: 'next', payload: { data: { tweetResult: { result: parent() } } } });
  await rejectedWithoutAdvancing(f);
});

test('a frontier in an unlinked complete response cannot certify the linked cursor chain', async t => {
  const f = await fixture(t);
  await f.service.capture(envelope([entry(tweet(OTHER)), bottom('expected-B')]));
  await f.service.capture(envelope([conversation([parent(), reply()])], { response: 'next.unlinked', cursor: 'wrong-cursor' }));
  const health = await pending(f.service);
  assert.equal(health.response_integrity.complete_response_count, 2);
  assert.equal(health.response_integrity.cursor_chain_verified, false);
  assert.deepEqual(health.response_integrity.unlinked_response_ids, ['next.unlinked']);
  await rejectedWithoutAdvancing(f);
});

test('an incomplete response cannot use its already-saved parent chunk to establish overlap', async t => {
  const f = await fixture(t);
  await f.service.capture(envelope([conversation([parent(), reply()])], { count: 2 }));
  assert.deepEqual((await pending(f.service)).response_integrity.missing_chunks[0].missing_chunk_indexes, [1]);
  await rejectedWithoutAdvancing(f, /chunks are incomplete/);
});

test('a response without metadata cannot establish verified exact frontier overlap', async t => {
  const f = await fixture(t);
  await f.service.capture(envelope([conversation([parent(), reply()])], { tracked: false }));
  assert.equal((await pending(f.service)).response_integrity.captures_without_response_metadata, 1);
  await rejectedWithoutAdvancing(f);
});

test('mixed untracked captures cannot borrow certification from an otherwise valid response containing the frontier', async t => {
  const f = await fixture(t);
  await f.service.capture(envelope([conversation([parent(), reply()])]));
  await f.service.capture(envelope([entry(tweet(OTHER))], { tracked: false }));
  const health = await pending(f.service);
  assert.equal(health.response_integrity.complete_response_count, 1);
  assert.equal(health.response_integrity.captures_without_response_metadata, 1);
  await rejectedWithoutAdvancing(f);
});

test('a complete linked next page can supply the conversation parent frontier', async t => {
  const f = await fixture(t);
  await f.service.capture(envelope([entry(tweet(OTHER)), bottom('cursor-B')]));
  await f.service.capture(envelope([conversation([parent(), reply()])], { response: 'next.2', cursor: 'cursor-B' }));
  assert.equal((await pending(f.service)).previous_frontier_observed, true);
  const done = await f.service.finish({ pass_id: 'next', reason: 'overlap' });
  assert.equal(done.source_receipt.coverage.refresh_interval_continuity_verified, true);
  assert.deepEqual(done.source_receipt.coverage.response_integrity.verified_chain_response_ids, ['next.1', 'next.2']);
});

test('older module parents do not extend initial baseline coverage to their timestamps', async t => {
  const f = await fixture(t, false);
  const oldTwo = tweet(SECOND_OLD, '2026-09-08T16:06:00.000Z');
  await f.service.capture(envelope([entry(parent()), entry(oldTwo)], { pass: 'uncompleted-seed', response: 'seed.1' }));
  await f.service.capture(envelope([
    conversation([parent(), reply()], 'conversation-one'),
    conversation([oldTwo, tweet(OTHER, '2026-09-08T16:11:00.000Z')], 'conversation-two'),
  ]));
  const health = await pending(f.service);
  assert.equal(health.oldest_seen_at, REPLY_TIME);
  assert.deepEqual(health.baseline_overlap_keys, []);
  const done = await f.service.finish({ pass_id: 'next', reason: 'initial_window' });
  const coverage = done.source_receipt.coverage;
  assert.equal(coverage.frozen_baseline_latest_at, '2026-09-08T16:06:00.000Z');
  assert.equal(coverage.oldest_timeline_action_at, REPLY_TIME);
  assert.equal(coverage.earliest_observed_post_at, PARENT_TIME);
  assert.equal(coverage.initial_history_gap_open, true);
  assert.equal(coverage.overlap_with_previous_frontier, false);
  assert.equal(coverage.refresh_interval_continuity_verified, false);
});

for (const useModule of [false, true]) {
  test(`persisted rows without member_keys ${useModule ? 'do not infer a missing module member from pass posts' : 'retain exact direct-anchor compatibility'}`, async t => {
    const f = await fixture(t);
    await f.service.capture(envelope(useModule ? [conversation([parent(), reply()])] : [entry(parent()), entry(reply())]));
    const statePath = join(f.directory, 'state.json');
    const state = JSON.parse(await readFile(statePath, 'utf8'));
    for (const row of state.passes.next.timeline_rows) delete row.member_keys;
    for (const response of Object.values(state.passes.next.responses)) {
      for (const chunk of Object.values(response.chunks)) for (const row of chunk.timeline_rows) delete row.member_keys;
    }
    await writeFile(statePath, JSON.stringify(state));
    f.service = await createCaptureService(f.options);
    if (useModule) await rejectedWithoutAdvancing(f);
    else {
      assert.equal((await pending(f.service)).previous_frontier_observed, true);
      const done = await f.service.finish({ pass_id: 'next', reason: 'overlap' });
      assert.equal(done.source_receipt.coverage.refresh_interval_continuity_verified, true);
    }
  });
}

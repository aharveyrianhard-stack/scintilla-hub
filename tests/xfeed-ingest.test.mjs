import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ingest, normalizePost, normalizeAttempt, buildReceipt, latestPosts, timestamp } from '../scripts/xfeed-ingest.mjs';

// Synthetic records belong only in isolated tests. They are never imported into xfeed/data.
const makePost = (overrides = {}) => ({
  id: '2097000000000000001', handle: 'TestTrader', created_at: '2026-09-07T21:30:00-04:00',
  kind: 'original', text: 'Test extraction', url: 'https://x.com/TestTrader/status/2097000000000000001',
  photos: [], links: [], ...overrides,
});
const handles = ['TestTrader', 'OtherTrader', 'ThirdTrader', 'FourthTrader', 'FifthTrader'];
const at = '2026-09-08T02:00:00.000Z';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'xfeed-ingest-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const dataDir = join(directory, 'data'), handlesPath = join(directory, 'handles.txt'), inputPath = join(directory, 'input.json');
  await writeFile(handlesPath, `${handles.join('\n')}\n`);
  const run = async (input) => {
    await writeFile(inputPath, JSON.stringify(input));
    return ingest({ inputPath, dataDir, handlesPath, now: at });
  };
  return { directory, dataDir, run };
}

test('append-only import is idempotent, preserves raw evidence, and retains an amendment after the first event', async (t) => {
  const { dataDir, run } = await fixture(t);
  const input = { collected_at: at, source: 'browser detail extraction', posts: [makePost({ raw: { note_tweet: { text: 'Test extraction' }, observed_at: at } })], attempts: [{ handle: handles[0], status: 'success', scope: 'latest_page_per_handle', observed_posts: 1 }] };
  const first = await run(input);
  assert.equal(first.ledger_events_appended, 1);
  assert.equal(first.receipt.handles_successful, 1);
  const before = await readFile(join(dataDir, 'ledger.jsonl'), 'utf8');
  const second = await run(input);
  assert.equal(second.ledger_events_appended, 0);
  assert.equal(second.attempts_appended, 0);
  assert.equal(await readFile(join(dataDir, 'ledger.jsonl'), 'utf8'), before);
  const changed = structuredClone(input);
  changed.posts[0].text = 'Full post after detail extraction';
  changed.posts[0].raw.note_tweet.text = changed.posts[0].text;
  const third = await run(changed);
  assert.equal(third.ledger_events_appended, 1);
  const after = await readFile(join(dataDir, 'ledger.jsonl'), 'utf8');
  assert.ok(after.startsWith(before), 'the first event must remain byte-for-byte intact');
  const rows = after.trim().split('\n').map(JSON.parse);
  assert.equal(rows.length, 2);
  assert.equal(latestPosts(rows).length, 1);
  assert.equal(rows[1].raw.note_tweet.text, changed.posts[0].text);
  assert.equal(rows[1].provenance.source_url, input.posts[0].url);
  assert.equal(third.receipt.posts_kept, 1);
  assert.equal(third.receipt.ledger_events, 2);
});

test('a changed observation time alone does not append a duplicate post', async (t) => {
  const { run } = await fixture(t);
  const first = { posts: [makePost({ observed_at: at })], attempts: [], collected_at: at };
  await run(first);
  const second = structuredClone(first);
  second.collected_at = '2026-09-08T02:01:00Z';
  second.posts[0].observed_at = second.collected_at;
  assert.equal((await run(second)).ledger_events_appended, 0);
});

test('timestamps retain their actual instant and reject missing zones, invalid dates, and numeric IDs', () => {
  assert.equal(normalizePost(makePost()).created_at, '2026-09-08T01:30:00.000Z');
  assert.equal(timestamp('2024-02-29T12:00:00.123456Z'), '2024-02-29T12:00:00.123Z');
  for (const value of [undefined, '2026-09-07', '2026-09-07T21:30:00', '2026-02-30T00:00:00Z', '2026-02-29T00:00:00Z', '2026-09-07T24:00:00Z', '2026-09-07T10:00:00+14:01']) {
    assert.throws(() => normalizePost(makePost({ created_at: value })), /timestamp|timezone|calendar|ISO/);
  }
  assert.throws(() => normalizePost(makePost({ id: Number('2097000000000000001') })), /decimal string/);
  assert.throws(() => normalizePost(makePost({ url: 'https://x.com/TestTrader/status/2097000000000000002' })), /post ID/);
  assert.throws(() => normalizePost(makePost({ url: 'https://x.com/OtherTrader/status/2097000000000000001' })), /author/);
});

test('failed, blocked, no-results, successful-with-zero-observed, and unattempted remain distinct', () => {
  const attempts = [
    { handle: handles[0], status: 'success', observed_posts: 0, scope: 'latest_page_of_6_handle_batch', reason: 'No rows observed in returned batch page' },
    { handle: handles[1], status: 'no_results', observed_posts: 0 },
    { handle: handles[2], status: 'failed', queried: true, reason: 'Search response failed' },
    { handle: handles[3], status: 'blocked', queried: false, reason: 'Sign in required' },
  ].map((attempt) => normalizeAttempt(attempt, { collected_at: at, handles }));
  const receipt = buildReceipt(handles, [], attempts, at);
  assert.equal(receipt.handles_attempted, 4);
  assert.equal(receipt.handles_queried, 3);
  assert.equal(receipt.handles_successful, 1);
  assert.equal(receipt.handles_no_results, 1);
  assert.equal(receipt.handles_failed, 1);
  assert.equal(receipt.handles_blocked, 1);
  assert.equal(receipt.handles_unattempted, 1);
  assert.equal(receipt.handles[0].observed_posts, 0);
  assert.equal(receipt.handles[0].status, 'successful');
  assert.equal(receipt.handles[4].observed_posts, null);
  assert.equal(receipt.first_pass_complete, false);
  assert.equal(receipt.query_pass_complete, false);
});

test('latest attempt by actual attempt time supersedes older batch or failed attempts regardless of import order', () => {
  const attempts = [
    normalizeAttempt({ handle: handles[0], status: 'success', attempted_at: '2026-09-08T02:02:00Z', scope: 'latest_page_per_handle', observed_posts: 20 }),
    normalizeAttempt({ handle: handles[0], status: 'failed', attempted_at: '2026-09-08T02:01:00Z', scope: 'latest_page_of_6_handle_batch' }),
  ];
  const receipt = buildReceipt([handles[0]], [], attempts, at);
  assert.equal(receipt.handles[0].status, 'successful');
  assert.equal(receipt.handles[0].scope, 'latest_page_per_handle');
  assert.equal(receipt.query_pass_complete, true);
  assert.equal(receipt.first_pass_complete, false, 'query success alone never establishes full post extraction');
  assert.throws(() => normalizeAttempt({ handle: handles[0], status: 'failed', attempted_at: at, full_post_extraction_complete: true }), /cannot be extraction complete/);
});

test('quote/repost original media remains playable and repost actors retain separate identities', () => {
  const original = { id: '2097000000000000002', handle: 'OriginalTrader', url: 'https://x.com/OriginalTrader/status/2097000000000000002', video_url: 'https://video.twimg.com/test/video.mp4', photos: ['https://pbs.twimg.com/media/test.jpg'], text: 'Original text' };
  const quote = normalizePost(makePost({ kind: 'quote', original }));
  assert.equal(quote.has_video, true);
  assert.equal(quote.original.video_url, original.video_url);
  assert.equal(quote.original.created_at, null, 'never copy wrapper date into original');
  assert.deepEqual(quote.original.photos, original.photos);
  const one = normalizePost(makePost({ id: original.id, kind: 'repost', url: original.url, original }));
  const two = normalizePost(makePost({ id: original.id, handle: 'OtherTrader', kind: 'repost', url: original.url, original }));
  assert.equal(latestPosts([one, two]).length, 2);
  const unresolved = normalizePost(makePost({ id: '2097000000000000003', url: 'https://x.com/TestTrader/status/2097000000000000003', has_video: true }));
  const youtube = normalizePost(makePost({ id: '2097000000000000004', url: 'https://x.com/TestTrader/status/2097000000000000004', links: [{ url: 'https://youtu.be/abcdefghijk', title: 'Extracted link title' }] }));
  assert.equal(youtube.youtube_id, 'abcdefghijk');
  const receipt = buildReceipt(handles, [quote, unresolved, youtube], [], at);
  assert.equal(receipt.video_posts, 3);
  assert.equal(receipt.videos_resolved, 1);
  assert.equal(receipt.videos_still_missing, 1);
  assert.equal(receipt.youtube_ids, 1);
  assert.equal(receipt.outbound_links, 1);
});

test('unsafe URLs and one invalid row reject the entire import before any data writes', async (t) => {
  const { directory, run } = await fixture(t);
  assert.throws(() => normalizePost(makePost({ photos: ['javascript:alert(1)'] })), /unsupported protocol/);
  assert.throws(() => normalizePost(makePost({ video_url: 'https://secret:password@video.twimg.com/video.mp4' })), /embedded credentials/);
  assert.throws(() => normalizePost(makePost({ links: [{ url: 'data:text/html,hi' }] })), /unsupported protocol/);
  await assert.rejects(run({ posts: [makePost(), makePost({ created_at: 'not an extracted timestamp' })], attempts: [] }), /ISO/);
  assert.ok(!(await readdir(directory)).includes('data'), 'rejected input must not create ledger or receipt');
});

test('all four native videos survive normalization and partial resolution counts the row in both receipt counters', () => {
  const sourceVideos = Array.from({ length: 4 }, (_, index) => ({
    url: `https://video.twimg.com/test/video-${index + 1}.mp4`,
    poster: `https://pbs.twimg.com/media/poster-${index + 1}.jpg`,
    alt: `Extracted video ${index + 1}`,
  }));
  const complete = normalizePost(makePost({ videos: sourceVideos }));
  assert.deepEqual(complete.videos, sourceVideos);
  assert.equal(complete.video_url, sourceVideos[0].url);
  assert.equal(complete.has_video, true);
  assert.equal(complete.raw.videos.length, 4);
  let receipt = buildReceipt(handles, [complete], [], at);
  assert.equal(receipt.native_video_posts, 1);
  assert.equal(receipt.videos_resolved, 1, 'counts rows rather than four separate files');
  assert.equal(receipt.videos_still_missing, 0);

  const partialVideos = structuredClone(sourceVideos);
  partialVideos[2].url = null;
  delete partialVideos[3].url;
  const partial = normalizePost(makePost({ videos: partialVideos }));
  assert.equal(partial.videos.length, 4);
  assert.equal(partial.videos[2].url, null);
  assert.equal(partial.videos[3].url, null);
  receipt = buildReceipt(handles, [partial], [], at);
  assert.equal(receipt.videos_resolved, 1);
  assert.equal(receipt.videos_still_missing, 1, 'any unresolved known native item keeps the row missing');
});

test('original multi-video arrays and legacy files retain the same semantics, while YouTube alone is never missing native media', () => {
  const original = {
    id: '2097000000000000002', handle: 'OriginalTrader',
    videos: [{ url: 'https://video.twimg.com/test/original.mp4', alt: 'First' }, { poster: 'https://pbs.twimg.com/media/unresolved.jpg', alt: 'Second' }],
  };
  const quote = normalizePost(makePost({ kind: 'quote', original }));
  assert.equal(quote.original.videos.length, 2);
  assert.equal(quote.original.videos[1].url, null);
  const receipt = buildReceipt(handles, [quote], [], at);
  assert.equal(receipt.videos_resolved, 1);
  assert.equal(receipt.videos_still_missing, 1);

  const legacy = normalizePost(makePost({ video_url: 'https://video.twimg.com/test/legacy.mp4' }));
  assert.deepEqual(legacy.videos, [{ url: legacy.video_url, poster: null, alt: '' }]);
  assert.equal(buildReceipt(handles, [legacy], [], at).videos_still_missing, 0);
  const yt = normalizePost(makePost({ youtube_id: 'abcdefghijk' }));
  assert.equal(yt.has_video, true);
  assert.deepEqual(yt.videos, []);
  const ytReceipt = buildReceipt(handles, [yt], [], at);
  assert.equal(ytReceipt.native_video_posts, 0);
  assert.equal(ytReceipt.videos_still_missing, 0);
  assert.throws(() => normalizePost(makePost({ videos: [{ url: 'javascript:alert(1)' }] })), /unsupported protocol/);
  assert.throws(() => normalizePost(makePost({ videos: [{ url: 0 }] })), /must be a URL/);
  assert.throws(() => normalizePost(makePost({ videos: [{ poster: 'http://pbs.twimg.com/media/test.jpg' }] })), /unsupported protocol/);
});

test('a completed latest-page pass states its search, detail-check, history, and repost limits explicitly', () => {
  const attempts = handles.map((author) => normalizeAttempt({
    handle: author, status: 'success', attempted_at: at,
    full_post_extraction_complete: true, scope: 'latest_page_per_handle', observed_posts: 20,
  }));
  const receipt = buildReceipt(handles, [normalizePost(makePost())], attempts, at);
  assert.equal(receipt.status, 'complete');
  assert.equal(receipt.first_pass_complete, true);
  assert.equal(receipt.query_pass_complete, true);
  assert.equal(receipt.completion_scope, 'first_returned_latest_search_page_per_handle');
  assert.equal(receipt.collection_method.search_pages_per_handle, 1);
  assert.equal(receipt.collection_method.max_results_per_handle, 20);
  assert.equal(receipt.collection_method.paginated, false);
  assert.equal(receipt.collection_method.post_detail_verification, 'selected_post_pages_only');
  assert.equal(receipt.collection_method.history_coverage, 'not_established');
  assert.equal(receipt.collection_method.repost_coverage, 'not_established');
  assert.equal(receipt.rows_by_kind.repost, 0);
  assert.match(receipt.source_completeness, /selected real post pages/);
  assert.ok(receipt.limitations.some((note) => /zero repost rows does not mean/.test(note)));
  assert.ok(receipt.limitations.some((note) => /rather than a separate detail-page visit for every row/.test(note)));
});

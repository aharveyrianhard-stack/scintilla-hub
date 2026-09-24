import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaOf, classifyLink, tweetsById, deepRecordFrom, methodHints, selectPending, ideaCardFrom, mergeIndex } from '../scripts/xfeed-bookmark-deep.mjs';
import { runDeepSidecar, DEFAULTS } from '../scripts/xfeed-program.mjs';

/* SYNTHETIC payloads in the shape X's TweetDetail actually returns (checked against the live
   folder on 23 Sep). No live capture happens in these tests. */
const media = (over = {}) => ({
  media_key: over.key ?? 'm1', type: over.type ?? 'photo',
  media_url_https: over.url ?? 'https://pbs.twimg.com/media/AAA.jpg',
  ext_alt_text: over.alt ?? null,
  original_info: { width: over.width ?? 2048, height: over.height ?? 1185 },
  ...(over.video ? { video_info: { variants: [
    { content_type: 'video/mp4', bitrate: 832000, url: 'https://video.twimg.com/low.mp4' },
    { content_type: 'application/x-mpegURL', url: 'https://video.twimg.com/stream.m3u8' },
    { content_type: 'video/mp4', bitrate: 2176000, url: 'https://video.twimg.com/high.mp4' },
  ] } } : {}),
});
const tweet = (over = {}) => ({
  rest_id: over.id ?? '111',
  core: { user_results: { result: { core: { screen_name: over.handle ?? 'macrocharts', name: over.name ?? 'MacroCharts' } } } },
  legacy: {
    id_str: over.id ?? '111',
    conversation_id_str: over.conv ?? '111',
    created_at: over.created_at ?? 'Tue Sep 22 14:06:00 +0000 2026',
    full_text: over.text ?? 'Breadth is narrowing: only 38% of members above their 50-day.',
    entities: { symbols: over.symbols ?? [], urls: over.urls ?? [], ...(over.media ? { media: over.media } : {}) },
    ...(over.media ? { extended_entities: { media: over.media } } : {}),
  },
  ...(over.quoted ? { quoted_status_result: { result: tweet({ ...over.quoted, quoted: null }) } } : {}),
});
const detail = tweets => ({ data: { threaded_conversation_with_injections_v2: { instructions: [
  { type: 'TimelineAddEntries', entries: tweets.map(t => ({ entryId: `tweet-${t.rest_id}`, content: { itemContent: { tweet_results: { result: t } } } })) } ] } } });

test('a picture is kept with the URL that returns X\'s full-size copy, deduped, best video first', () => {
  const m = mediaOf(tweet({ media: [media({ key: 'm1', alt: 'SPX with 50-day breadth below' }), media({ key: 'm1' }), media({ key: 'm2', type: 'video', video: true })] }));
  assert.equal(m.length, 2, 'the same media key is one picture');
  assert.equal(m[0].url, 'https://pbs.twimg.com/media/AAA.jpg?name=large');
  assert.equal(m[0].alt, 'SPX with 50-day breadth below');
  assert.equal(m[0].width, 2048);
  assert.equal(m[1].video_url, 'https://video.twimg.com/high.mp4', 'the highest mp4 bitrate, not the HLS stream');
});

test('a post with no picture yields no media, and a bare legacy object works too', () => {
  assert.deepEqual(mediaOf(tweet()), []);
  assert.equal(mediaOf({ extended_entities: { media: [media()] } }).length, 1);
});

test('links are sorted into the ones worth opening', () => {
  const kinds = u => classifyLink(u).kind;
  assert.equal(kinds('https://x.com/i/article/1874'), 'x_article');
  assert.equal(kinds('https://x.com/i/web/article/99'), 'x_article');
  assert.equal(kinds('https://x.com/macrocharts/status/111'), 'x_post');
  assert.equal(kinds('https://research.example.com/note.pdf'), 'pdf');
  assert.equal(kinds('https://www.investing.com/news/photonics'), 'page');
  assert.equal(kinds('https://pbs.twimg.com/media/AAA.jpg'), 'media');
  assert.equal(kinds('https://t.co/abc'), 'shortener');
  assert.equal(kinds('not a url'), 'unusable');
  assert.equal(classifyLink('https://www.investing.com/x').host, 'investing.com');
});

test('the deep record carries the author\'s own thread, the quote, every picture and where it sits', () => {
  const root = tweet({ id: '111', conv: '111', media: [media({ key: 'a', alt: 'breadth chart' })],
    urls: [{ expanded_url: 'https://research.example.com/note.pdf' }],
    quoted: { id: '999', handle: 'otherdesk', text: 'Original: 38% above the 50-day', media: [media({ key: 'q' })] } });
  const cont = tweet({ id: '112', conv: '111', created_at: 'Tue Sep 22 14:09:00 +0000 2026', text: 'Part two: the same measure in 2018.', media: [media({ key: 'b' })] });
  const stranger = tweet({ id: '113', conv: '111', handle: 'randomreply', text: 'nice chart' });
  const other = tweet({ id: '222', conv: '222', text: 'unrelated post' });

  const deep = deepRecordFrom([detail([root, cont, stranger, other])], '111', { folder: 'Claude Check' });
  assert.equal(deep.author_handle, 'macrocharts');
  assert.equal(deep.thread.length, 1, 'only the author\'s own continuation');
  assert.equal(deep.thread[0].id, '112');
  assert.equal(deep.quoted.author_handle, 'otherdesk');
  assert.deepEqual(deep.media.map(m => m.on), ['post', 'thread:1', 'quoted']);
  assert.deepEqual(deep.links.map(l => l.kind), ['pdf']);
  assert.ok(deep.method_hints.includes('breadth'));
  assert.equal(deep.folder, 'Claude Check');
});

test('a post the payload never returned gives null instead of a guess', () => {
  assert.equal(deepRecordFrom([detail([tweet({ id: '111' })])], '404'), null);
});

test('the richest copy of a tweet wins, so a payload that omitted the picture cannot erase it', () => {
  const thin = tweet({ id: '111' });
  const rich = tweet({ id: '111', media: [media({ key: 'a' })] });
  assert.equal(mediaOf(tweetsById(detail([thin, rich])).get('111')).length, 1);
  assert.equal(mediaOf(tweetsById(detail([rich, thin])).get('111')).length, 1);
});

test('method hints read the post\'s own words, and stay empty when there are none', () => {
  assert.deepEqual(methodHints('$NVDA looks good here'), []);
  assert.ok(methodHints('anchored VWAP from the April low').includes('vwap'));
  assert.ok(methodHints('net liquidity: reserve balances minus the TGA').includes('liquidity'));
  assert.ok(methodHints('how long does it take: forward returns 20 days later, hit rate 68%').includes('signal_horizon'));
  assert.ok(methodHints('TQQQ volume is a froth gauge').includes('froth'));
  assert.ok(methodHints('bonds versus the S&P, the ratio chart').includes('correlation'));
});

test('only bookmarks that have not been read deeply are picked, newest first, capped', () => {
  const store = { posts: {
    a: { id: 'a', url: 'u/a', first_seen_at: '2026-09-20T00:00:00Z' },
    b: { id: 'b', url: 'u/b', first_seen_at: '2026-09-24T00:00:00Z' },
    c: { id: 'c', url: 'u/c', first_seen_at: '2026-09-22T00:00:00Z' },
  } };
  const index = { posts: { c: { id: 'c', status: 'read' } } };
  assert.deepEqual(selectPending(store, index, { limit: 5 }).map(p => p.id), ['b', 'a']);
  assert.deepEqual(selectPending(store, index, { limit: 1 }).map(p => p.id), ['b']);
  assert.deepEqual(selectPending(store, index, { limit: 5, redo: true }).map(p => p.id), ['b', 'c', 'a']);
  assert.deepEqual(selectPending(store, index, { limit: 5, ids: ['c'] }).map(p => p.id), ['c'], 'a named id is read again on request');
  assert.deepEqual(selectPending(store, { posts: {} }, { limit: 0 }), []);
  assert.deepEqual(selectPending(null, null, { limit: 3 }), []);
});

test('a card says what was found and admits when nobody has looked at the picture yet', () => {
  const deep = { id: '111', author_handle: 'macrocharts', url: 'https://x.com/macrocharts/status/111',
    created_at: '2026-09-22T14:06:00.000Z', text: 'Breadth is narrowing\nsecond line',
    thread: [{ id: '112' }], quoted: null, cashtags: ['SPX'],
    media: [{ type: 'photo' }, { type: 'video' }], links: [{ kind: 'pdf' }, { kind: 'shortener' }], method_hints: ['breadth'] };
  const blank = ideaCardFrom(deep);
  assert.equal(blank.headline, 'Breadth is narrowing');
  assert.equal(blank.pictures, 1, 'a video is not a chart picture');
  assert.equal(blank.linked, 1, 'a t.co shortener is not a reading');
  assert.equal(blank.described, false);
  assert.equal(blank.description, null);
  assert.equal(blank.author, '@macrocharts');
  const read = ideaCardFrom(deep, { description: 'SPX with the share of members above the 50-day', method: 'breadth', data_needed: 'daily closes for the members', hub_has_data: 'yes, 364 symbols', build: 'small', recommendation: 'build it', theme: 'Breadth' });
  assert.equal(read.described, true);
  assert.equal(read.theme, 'Breadth');
  assert.equal(read.build, 'small');
});

test('the index keeps when a post was first read deeply and moves the last-read stamp', () => {
  const first = mergeIndex(null, [{ id: 'a', status: 'read', pictures: 2 }], '2026-09-24T01:00:00Z');
  assert.equal(first.count, 1);
  assert.equal(first.posts.a.first_deep_at, '2026-09-24T01:00:00Z');
  const second = mergeIndex(first, [{ id: 'a', status: 'read', pictures: 3 }, { id: 'b', status: 'failed' }], '2026-09-24T03:00:00Z');
  assert.equal(second.posts.a.first_deep_at, '2026-09-24T01:00:00Z');
  assert.equal(second.posts.a.last_deep_at, '2026-09-24T03:00:00Z');
  assert.equal(second.posts.a.pictures, 3);
  assert.equal(second.count, 2);
});

test('the deep read rides the existing cycle: bounded, and it can never fail the list pass', async () => {
  const calls = [];
  const deep = async (o, deps) => { calls.push({ o, hasBrowser: Boolean(deps.browser) }); return { status: 'read', pending: 4, read: 4, media_saved: 7 }; };
  const o = { ...DEFAULTS, runtimeDir: '/tmp/rt', profileDir: '/tmp/pf' };
  const logged = [];
  const ok = await runDeepSidecar(o, { browser: { context: {} }, log: { write: m => logged.push(m) }, deep, bookmarkOutcome: { status: 'captured' } });
  assert.equal(ok.status, 'read');
  assert.equal(calls[0].hasBrowser, true, 'the same browser, not a second one');
  assert.equal(calls[0].o.limit, 6, 'a busy folder cannot stretch a cycle');
  assert.equal(calls[0].o.budgetSeconds, 300);
  assert.equal(calls[0].o.folder, 'Claude Check');
  assert.match(logged[0], /7 pictures kept/);

  const thrown = await runDeepSidecar(o, { browser: { context: {} }, deep: async () => { throw new Error('boom'); }, bookmarkOutcome: { status: 'captured' } });
  assert.equal(thrown.status, 'failed', 'it reports its own failure instead of throwing into the list pass');

  assert.equal((await runDeepSidecar({ ...o, fixture: 'f.json' }, { browser: {}, deep })).status, 'skipped');
  assert.equal((await runDeepSidecar({ ...o, deepBookmarks: false }, { browser: {}, deep })).status, 'skipped');
  assert.equal((await runDeepSidecar(o, { browser: null, deep })).status, 'skipped');
  const afterBadFolder = await runDeepSidecar(o, { browser: { context: {} }, deep, bookmarkOutcome: { status: 'signed_out' } });
  assert.equal(afterBadFolder.status, 'skipped', 'no deep read when the folder itself could not be read');
  assert.match(afterBadFolder.reason, /signed_out/);
});

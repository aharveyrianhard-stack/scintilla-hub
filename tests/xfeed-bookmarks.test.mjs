import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBookmarkPayload, tweetRecord, cashtagsOf, folderIdFor, mergeStore, storeToList, slugOf } from '../scripts/xfeed-bookmarks.mjs';
import { runBookmarkSidecar, DEFAULTS } from '../scripts/xfeed-program.mjs';

/* A synthetic BookmarkFolderTimeline body in the shape X actually returns (checked
   against the live folder on 23 Sep). SYNTHETIC — no live capture in these tests. */
const tweet = (over = {}) => ({
  rest_id: over.id ?? '111',
  core: { user_results: { result: { core: { screen_name: over.handle ?? 'asklivermore', name: over.name ?? 'AskLivermore' } } } },
  legacy: {
    id_str: over.id ?? '111',
    created_at: over.created_at ?? 'Tue Jul 15 11:06:00 +0000 2026',
    full_text: over.text ?? 'Photonics stocks are trying to find a low. $AXTI and $LITE lead.',
    entities: {
      symbols: over.symbols ?? [{ text: 'AXTI' }, { text: 'LITE' }],
      urls: over.urls ?? [{ url: 'https://t.co/x', expanded_url: 'https://www.investing.com/news/photonics' }],
      media: over.media ?? [{ media_key: 'm1', type: 'photo', ext_alt_text: 'AXTI daily chart with a falling wedge' }],
    },
  },
  ...(over.quoted ? { quoted_status_result: { result: tweet({ ...over.quoted, quoted: null }) } } : {}),
});
const payload = posts => ({ data: { bookmark_collection_timeline: { timeline: { instructions: [
  { type: 'TimelineAddEntries', entries: posts.map((p, i) => ({ entryId: `tweet-${p.rest_id}`, sortIndex: String(1000 - i), content: { itemContent: { tweet_results: { result: p } } } })) } ] } } } });

test('a bookmark payload becomes records with text, author, date, links, alt text and cashtags', () => {
  const [r] = parseBookmarkPayload(payload([tweet()]));
  assert.equal(r.id, '111');
  assert.equal(r.author_handle, 'asklivermore');
  assert.equal(r.author_name, 'AskLivermore');
  assert.equal(r.created_at, '2026-07-15T11:06:00.000Z');
  assert.equal(r.url, 'https://x.com/asklivermore/status/111');
  assert.match(r.text, /Photonics stocks/);
  assert.deepEqual(r.links, ['https://www.investing.com/news/photonics']);
  assert.deepEqual(r.media_alt, [{ type: 'photo', alt: 'AXTI daily chart with a falling wedge' }]);
  assert.deepEqual(r.cashtags.sort(), ['AXTI', 'LITE']);
});

test('a quoted post is kept, one level deep, and never recurses forever', () => {
  const [r] = parseBookmarkPayload(payload([tweet({ id: '222', quoted: { id: '333', text: 'Original: $SNDK at $317', symbols: [{ text: 'SNDK' }] } })]));
  assert.equal(r.id, '222');
  assert.equal(r.quoted.id, '333');
  assert.deepEqual(r.quoted.cashtags, ['SNDK']);
  assert.equal(r.quoted.quoted, null);
});

test('a long post uses note_tweet text, not the truncated body', () => {
  const long = tweet({ id: '444', text: 'truncated…' });
  long.note_tweet = { note_tweet_results: { result: { text: 'the whole thing about $MU and HBM4', entity_set: { symbols: [{ text: 'MU' }] } } } };
  const [r] = parseBookmarkPayload(payload([long]));
  assert.equal(r.text, 'the whole thing about $MU and HBM4');
  assert.deepEqual(r.cashtags, ['MU']);
});

test('cashtags come from X entities AND from $SYMBOL in the text, upper case and deduped', () => {
  assert.deepEqual(cashtagsOf('buy $axti and $OUST, more $axti', { symbols: [{ text: 'TQQQ' }] }).sort(), ['AXTI', 'OUST', 'TQQQ']);
  assert.deepEqual(cashtagsOf('no tickers here', {}), []);
});

test('the folder is found by name, whatever its case', () => {
  const folders = { data: { bookmark_collections_slice: { items: [
    { id: '2053294825726681561', name: 'CLAUDE CHECK' }, { id: '1863798031671521626', name: 'AI 💎' }] } } };
  assert.equal(folderIdFor(folders, 'Claude Check'), '2053294825726681561');
  assert.equal(folderIdFor(folders, 'claude check'), '2053294825726681561');
  assert.equal(folderIdFor(folders, 'Not A Folder'), null);
});

test('a second pass over the same folder changes nothing (idempotent store)', () => {
  const records = parseBookmarkPayload(payload([tweet({ id: '1' }), tweet({ id: '2' })]));
  const first = mergeStore({ posts: {} }, records, '2026-09-23T23:00:00.000Z');
  assert.equal(first.added, 2);
  const second = mergeStore(first.store, records, '2026-09-23T23:30:00.000Z');
  assert.equal(second.added, 0);
  assert.equal(second.updated, 0);
  assert.equal(second.store.count, 2);
  assert.equal(second.store.posts['1'].first_seen_at, '2026-09-23T23:00:00.000Z', 'first_seen never moves');
  assert.equal(second.store.posts['1'].last_seen_at, '2026-09-23T23:30:00.000Z');
});

test('a new bookmark is added and an edited one is counted as changed', () => {
  const start = mergeStore({ posts: {} }, parseBookmarkPayload(payload([tweet({ id: '1' })])), 'a').store;
  const grown = mergeStore(start, parseBookmarkPayload(payload([tweet({ id: '9', text: 'new one $NVDA' }), tweet({ id: '1' })])), 'b');
  assert.equal(grown.added, 1);
  assert.equal(grown.store.count, 2);
  const edited = mergeStore(grown.store, parseBookmarkPayload(payload([tweet({ id: '1', text: 'edited $MU' })])), 'c');
  assert.equal(edited.updated, 1);
  assert.match(edited.store.posts['1'].text, /edited/);
});

test('the page list is newest first', () => {
  const store = mergeStore({ posts: {} }, [
    tweetRecord(tweet({ id: '1', created_at: 'Tue Jul 15 11:06:00 +0000 2026' })),
    tweetRecord(tweet({ id: '2', created_at: 'Mon Aug 18 13:49:00 +0000 2026' })),
  ], 'now').store;
  assert.deepEqual(storeToList(store).map(p => p.id), ['2', '1']);
});

test('slugs are safe directory names', () => {
  assert.equal(slugOf('Claude Check'), 'claude-check');
  assert.equal(slugOf('AI 💎'), 'ai');
});

test('the sidecar never fails the Trading list pass, whatever the folder does', async () => {
  const lines = [];
  const log = { write: l => lines.push(l) };
  const thrown = await runBookmarkSidecar({ ...DEFAULTS }, { browser: {}, log, capture: async () => { throw new Error('x changed its layout'); } });
  assert.equal(thrown.status, 'failed');
  assert.match(lines.join(' '), /bookmarks failed/);
  const ok = await runBookmarkSidecar({ ...DEFAULTS }, { browser: {}, log, capture: async () => ({ status: 'captured', posts_seen: 65, added: 3 }) });
  assert.equal(ok.status, 'captured');
  assert.match(lines.join(' '), /65 in folder, \+3 new/);
});

test('the sidecar stays out of the way when it is switched off or the run is synthetic', async () => {
  assert.equal((await runBookmarkSidecar({ ...DEFAULTS, bookmarks: false }, { browser: {} })).status, 'skipped');
  assert.equal((await runBookmarkSidecar({ ...DEFAULTS, fixture: '/tmp/f.json' }, { browser: {} })).status, 'skipped');
  assert.equal((await runBookmarkSidecar({ ...DEFAULTS }, { browser: null })).status, 'skipped');
});

test('the folder capture reads and never writes: no click, type, bookmark or cookie call', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('../scripts/xfeed-bookmarks.mjs', import.meta.url), 'utf8');
  for (const forbidden of ['.click(', '.fill(', '.type(', 'keyboard.press', 'cookies(', 'addCookies', 'storageState', 'localStorage']) {
    assert.equal(source.includes(forbidden), false, `the bookmark reader must not use ${forbidden}`);
  }
});

test('a pass records the folder read in its receipt and health file, without touching the list fields', async () => {
  const { mkdtemp, readFile, writeFile, mkdir } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { persistBookmarkOutcome } = await import('../scripts/xfeed-program.mjs');
  const runtimeDir = await mkdtemp(join(tmpdir(), 'xfeed-bm-'));
  const runDir = join(runtimeDir, 'runs', 'program-test');
  await mkdir(runDir, { recursive: true });
  await writeFile(join(runtimeDir, 'program-health.json'), JSON.stringify({ program: 'xfeed-program', last_run: { status: 'published', pages: 4 } }));
  const receipt = { pass_id: 'program-test', status: 'published', pages: 4, bookmarks: { status: 'captured', posts_seen: 65, added: 3, finished_at: '2026-09-23T23:44:49.819Z' } };

  assert.equal(await persistBookmarkOutcome({ runDir, runtimeDir, folder: 'Claude Check', receipt }), true);
  const written = JSON.parse(await readFile(join(runDir, 'receipt.json'), 'utf8'));
  assert.equal(written.bookmarks.posts_seen, 65);
  assert.equal(written.status, 'published', 'the list result is carried through untouched');
  const health = JSON.parse(await readFile(join(runtimeDir, 'program-health.json'), 'utf8'));
  assert.deepEqual(health.last_run, { status: 'published', pages: 4 }, 'the list half of the health file is untouched');
  assert.equal(health.bookmarks.status, 'captured');
  assert.equal(health.bookmarks.folder, 'Claude Check');

  receipt.bookmarks = { status: 'skipped' };
  assert.equal(await persistBookmarkOutcome({ runDir, runtimeDir, folder: 'Claude Check', receipt }), false, 'a skipped sidecar writes nothing at all');
});

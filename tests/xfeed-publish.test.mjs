import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, appendFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { publish, publishLastGoodStatus, verifyPublicFeed, readManifestAtEtag, buildPublicFeed, normalizeCollectorStatus, normalizeNotifications, stableJson } from '../scripts/xfeed-publish.mjs';
import { createHandler } from '../api/xfeed.js';
import { CURRENT_MANIFEST_PATH, PUBLIC_SITE_ORIGIN } from '../lib/xfeed-store.mjs';

const BASE = 'https://teststore.public.blob.vercel-storage.com';
const handles = ['TestTrader', 'OtherTrader'];
const actualTime = '2026-09-08T02:00:00.000Z';
const post = (overrides = {}) => ({
  id: '2097000000000000001', handle: handles[0], created_at: actualTime,
  kind: 'original', text: '<script>Untrusted post text stays text</script>',
  url: 'https://x.com/TestTrader/status/2097000000000000001', photos: [], links: [],
  raw: { private_test_marker: 'raw evidence excluded from compact feed' },
  provenance: { source_url: 'https://x.com/TestTrader/status/2097000000000000001' }, ...overrides,
});
const receipt = (postsKept = 1) => ({ posts_kept: postsKept, collected_at: actualTime, generated_at: '2030-01-01T00:00:00.000Z', handles_total: 2, handles: handles.map((handle) => ({ handle })) });
const status = { collector_status: 'idle', last_heartbeat_at: actualTime, latest_source_event_at: '2026-09-08T01:59:00Z', stale_after_seconds: 180 };
const completedSource = () => ({
  schema_version: 1, source_type: 'x_list_latest_timeline', list_id: '1405188850188759047', source_url: 'https://x.com/i/lists/1405188850188759047', pass_id: 'completed-live-pass',
  observed_at: actualTime, completed_at: '2026-09-08T02:00:10Z', status: 'current_window_observed',
  coverage: { history_complete: false, initial_history_gap_open: true, overlap_with_previous_frontier: false, termination_reason: 'initial_window', captured_responses_or_chunks: 1, observed_posts: 1, latest_observed_post_at: actualTime },
});

async function fixture(t) {
  const dataDir = await mkdtemp(join(tmpdir(), 'xfeed-publish-test-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const statusFile = join(dataDir, 'heartbeat.json'), notificationsFile = join(dataDir, 'notifications.json');
  await writeFile(join(dataDir, 'ledger.jsonl'), `${JSON.stringify(post())}\n`);
  await writeFile(join(dataDir, 'query-attempts.jsonl'), `${JSON.stringify({ handle: handles[0], attempted_at: actualTime, status: 'successful' })}\n`);
  await writeFile(join(dataDir, 'receipt.json'), JSON.stringify(receipt()));
  await writeFile(join(dataDir, 'HANDLES_TRADING.txt'), `${handles.join('\n')}\n`);
  await writeFile(statusFile, JSON.stringify(status));
  return { dataDir, statusFile, notificationsFile };
}
function fakeStore({ cors = '*', weakGetEtag = true } = {}) {
  const objects = new Map(), calls = [];
  let sequence = 0;
  const blob = {
    async get(pathname, options) {
      calls.push({ method: 'get', pathname, options });
      const item = objects.get(pathname);
      if (!item) return null;
      return { statusCode: 200, stream: new Blob([item.body]).stream(), blob: { url: `${BASE}/${pathname}`, etag: `${weakGetEtag ? 'W/' : ''}${item.etag}` } };
    },
    async head(pathname) {
      calls.push({ method: 'head', pathname });
      const item = objects.get(pathname);
      if (!item) throw new Error('Blob not found');
      return { url: `${BASE}/${pathname}`, etag: item.etag };
    },
    async put(pathname, body, options) {
      calls.push({ method: 'put', pathname, options });
      const prior = objects.get(pathname);
      if (prior && !options.allowOverwrite) throw new Error('Blob already exists');
      if (options.ifMatch && options.ifMatch !== prior?.etag) throw new Error('Precondition failed');
      const item = { body: Buffer.from(body), etag: `"etag-${++sequence}"`, options };
      objects.set(pathname, item);
      return { url: `${BASE}/${pathname}`, etag: item.etag };
    },
  };
  const fetchImpl = async (url, options) => {
    calls.push({ method: 'fetch', url, options });
    assert.equal(new URL(url).origin, BASE);
    const item = objects.get(new URL(url).pathname.slice(1));
    return new Response(item?.body ?? '', { status: item ? 200 : 404, headers: { 'content-type': 'application/json', ...(item ? { etag: `W/${item.etag}` } : {}), ...(cors ? { 'access-control-allow-origin': cors } : {}) } });
  };
  return { objects, calls, blob, fetchImpl };
}
function fakeResponse() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end() { return this; },
  };
}

test('compact feed retains current rows and original media but excludes raw/provenance recursively and preserves actual clocks', () => {
  const original = { id: '2097000000000000002', handle: 'OtherTrader', text: 'Original', videos: [{ url: 'https://video.twimg.com/test.mp4', poster: null, alt: '' }], raw: { marker: 'original raw' } };
  const rows = [post(), post({ text: 'Amended text', kind: 'quote', original })];
  const feed = buildPublicFeed({ records: rows, receipt: receipt(), handles, status });
  assert.equal(feed.posts.length, 1);
  assert.equal(feed.posts[0].text, 'Amended text');
  assert.equal(feed.posts[0].original.videos.length, 1);
  assert.equal(feed.posts[0].raw, undefined);
  assert.equal(feed.posts[0].provenance, undefined);
  assert.equal(feed.posts[0].original.raw, undefined);
  assert.equal(feed.receipt.collected_at, actualTime);
  assert.equal(feed.receipt.collector_heartbeat_at, actualTime);
  assert.equal(feed.receipt.latest_source_event_at, '2026-09-08T01:59:00.000Z');
  assert.notEqual(feed.receipt.collector_heartbeat_at, feed.receipt.generated_at);
  assert.equal(buildPublicFeed({ records: rows, receipt: receipt(), handles, status }).version, feed.version);
  assert.throws(() => buildPublicFeed({ records: rows, receipt: receipt(2), handles, status }), /does not match/);
});

test('unknown collector and Notifications remain unconfigured; verified membership must be an exact Trading subset', () => {
  assert.equal(normalizeCollectorStatus(null).collector_status, 'unconfigured');
  assert.equal(normalizeCollectorStatus(null).collector_heartbeat_at, null);
  assert.throws(() => normalizeCollectorStatus({ collector_status: 'running', stale_after_seconds: 180 }), /actual last_heartbeat_at/);
  assert.throws(() => normalizeCollectorStatus({ ...status, stale_after_seconds: 0 }), /positive/);
  assert.deepEqual(normalizeNotifications(null, handles), { status: 'unconfigured', handles: [] });
  assert.deepEqual(normalizeNotifications({ status: 'configured', handles: [handles[0]], membership_verified: false }, handles), { status: 'unconfigured', handles: [] });
  assert.deepEqual(normalizeNotifications({ status: 'configured', handles: ['testtrader'], source: 'X notification_enabled', updated_at: actualTime }, handles), { status: 'configured', handles: ['TestTrader'], source: 'X notification_enabled', updated_at: actualTime });
  assert.throws(() => normalizeNotifications({ status: 'configured', handles: ['OutsideHandle'] }, handles), /outside/);
  assert.throws(() => normalizeNotifications({ status: 'configured', handles: ['TestTrader', 'testtrader'] }, handles), /duplicate/);
  assert.throws(() => normalizeNotifications({ handles: ['TestTrader'] }, handles), /explicitly configured/);
});

test('active list response evidence stays distinct from historical per-handle search coverage', () => {
  const sourceReceipt = {
    schema_version: 1, source_type: 'x_list_latest_timeline', list_id: '1405188850188759047',
    source_url: 'https://x.com/i/lists/1405188850188759047', pass_id: 'actual-pass',
    observed_at: '2026-09-08T03:00:00Z', completed_at: '2026-09-08T03:00:10Z', status: 'current_window_observed',
    coverage: { history_complete: false, initial_history_gap_open: true, overlap_with_previous_frontier: false, termination_reason: 'initial_window', captured_pages: 2, observed_posts: 17, earliest_observed_post_at: actualTime, latest_observed_post_at: actualTime, unresolved: ['History before this window is not collected'] },
    rate_headers: { 'x-rate-limit-remaining': '48' },
  };
  const oldReceipt = { ...receipt(), collection_scopes: ['latest_page_per_handle'], handles_queried: 126, first_pass_complete: true, query_pass_complete: true };
  const feed = buildPublicFeed({ records: [post()], receipt: oldReceipt, handles, status: { ...status, latest_source_event_at: undefined }, sourceReceipt });
  assert.deepEqual(feed.receipt.source_receipt, sourceReceipt);
  assert.deepEqual(feed.receipt.collection_scopes, ['x_list_latest_timeline']);
  assert.equal(feed.receipt.first_pass_complete, null);
  assert.equal(feed.receipt.query_pass_complete, null);
  assert.equal(feed.receipt.historical_search_coverage.handles_queried, 126);
  assert.equal(feed.receipt.historical_search_coverage.first_pass_complete, true);
  assert.equal(feed.receipt.historical_search_coverage.collected_at, actualTime);
  assert.equal(feed.receipt.collected_at, '2026-09-08T03:00:00.000Z');
  assert.equal(feed.receipt.collection_started_at, null);
  assert.equal(feed.receipt.latest_source_event_at, actualTime);
  assert.equal(feed.receipt.collector_heartbeat_at, actualTime);
  assert.match(feed.receipt.source_completeness, /2 captured page\(s\), 17 observed posts/);
  assert.match(feed.receipt.source_completeness, /historical gap remains open/);
  assert.match(feed.receipt.source_completeness, /Continuous response cursor chain was not verified\./);
  assert.throws(() => buildPublicFeed({ records: [post()], receipt: oldReceipt, handles, sourceReceipt: { ...sourceReceipt, source_url: 'https://evil.test/' } }), /Trading list/);
  const chunkReceipt = { ...sourceReceipt, coverage: { ...sourceReceipt.coverage, captured_pages: undefined, captured_responses_or_chunks: 17, cursor_chain_verified: false, limitations: ['One nested quote was unavailable in the captured source.'] } };
  const chunkFeed = buildPublicFeed({ records: [post()], receipt: oldReceipt, handles, sourceReceipt: chunkReceipt });
  assert.match(chunkFeed.receipt.source_completeness, /17 saved response\/chunk\(s\)/);
  assert.doesNotMatch(chunkFeed.receipt.source_completeness, /17 captured page/);
  assert.match(chunkFeed.receipt.source_completeness, /One nested quote was unavailable/);
  assert.ok(chunkFeed.receipt.limitations.includes('One nested quote was unavailable in the captured source.'));
  const linkedFeed = buildPublicFeed({ records: [post()], receipt: oldReceipt, handles, sourceReceipt: { ...sourceReceipt, coverage: { ...sourceReceipt.coverage, cursor_chain_verified: true } } });
  assert.doesNotMatch(linkedFeed.receipt.source_completeness, /cursor chain was not verified/);
});

test('compact publication preserves all four nested original kinds, texts, and media without raw evidence', () => {
  let original = null;
  for (let depth = 4; depth >= 1; depth--) {
    const id = String(2097000000000000010n + BigInt(depth));
    original = { id, handle: 'OtherTrader', kind: depth === 4 ? 'original' : 'quote', text: `Depth ${depth}`, url: `https://x.com/OtherTrader/status/${id}`, videos: depth === 4 ? [{ url: 'https://video.twimg.com/deep.mp4', poster: null, alt: '' }] : [], original, raw: { marker: `Private raw ${depth}` } };
  }
  const feed = buildPublicFeed({ records: [post({ kind: 'repost', original })], receipt: receipt(), handles });
  let node = feed.posts[0].original;
  for (let depth = 1; depth <= 4; depth++) {
    assert.equal(node.text, `Depth ${depth}`);
    assert.equal(node.kind, depth === 4 ? 'original' : 'quote');
    assert.equal(node.raw, undefined);
    if (depth === 4) assert.equal(node.videos[0].url, 'https://video.twimg.com/deep.mp4');
    node = node.original;
  }
  assert.equal(node, null);
});

test('publisher verifies public CORS/content, uploads immutable artifacts, commits manifest last with 60-second cache, and is idempotent', async (t) => {
  const paths = await fixture(t), store = fakeStore();
  const result = await publish({ ...paths, ...store });
  assert.equal(result.changed, true);
  assert.equal(result.base_url, BASE);
  const puts = store.calls.filter((call) => call.method === 'put');
  assert.equal(puts.at(-1).pathname, CURRENT_MANIFEST_PATH);
  assert.equal(puts.at(-1).options.cacheControlMaxAge, 60);
  assert.equal(puts.at(-1).options.allowOverwrite, false);
  for (const call of puts.slice(0, -1)) {
    assert.equal(call.options.allowOverwrite, false);
    assert.equal(call.options.addRandomSuffix, false);
    assert.equal(call.options.cacheControlMaxAge, 31536000);
  }
  const corsCheck = store.calls.find((call) => call.method === 'fetch');
  assert.equal(corsCheck.options.headers.Origin, PUBLIC_SITE_ORIGIN);
  assert.equal(corsCheck.options.redirect, 'error');
  assert.ok(store.calls.indexOf(corsCheck) < store.calls.indexOf(puts.at(-1)));
  assert.ok(store.calls.filter((call) => call.method === 'get').every((call) => call.options.useCache === false));
  const previousPutCount = puts.length;
  assert.equal((await publish({ ...paths, ...store })).changed, false);
  assert.equal(store.calls.filter((call) => call.method === 'put').length, previousPutCount);
  const manifest = JSON.parse(store.objects.get(CURRENT_MANIFEST_PATH).body);
  assert.equal(manifest.feed_cors_verified, true);
  assert.equal(manifest.collected_at, actualTime);
  assert.equal(manifest.collector_heartbeat_at, actualTime);
});

test('later publication archives appended bytes and uses verified strong HEAD ETag despite weak public GET ETag', async (t) => {
  const paths = await fixture(t), store = fakeStore();
  await publish({ ...paths, ...store });
  const first = JSON.parse(store.objects.get(CURRENT_MANIFEST_PATH).body);
  const previousEtag = store.objects.get(CURRENT_MANIFEST_PATH).etag;
  const next = `${JSON.stringify(post({ id: '2097000000000000003', url: 'https://x.com/TestTrader/status/2097000000000000003', text: 'Another observed post' }))}\n`;
  await appendFile(join(paths.dataDir, 'ledger.jsonl'), next);
  await writeFile(join(paths.dataDir, 'receipt.json'), JSON.stringify(receipt(2)));
  await publish({ ...paths, ...store });
  const current = JSON.parse(store.objects.get(CURRENT_MANIFEST_PATH).body);
  assert.notEqual(current.version, first.version);
  const index = JSON.parse(store.objects.get(new URL(current.archives.ledger.index_url).pathname.slice(1)).body);
  assert.equal(index.start_byte, first.archives.ledger.bytes);
  assert.equal(index.previous_index_url, first.archives.ledger.index_url);
  assert.equal(store.objects.get(new URL(index.chunk_url).pathname.slice(1)).body.toString(), next);
  const commits = store.calls.filter((call) => call.method === 'put' && call.pathname === CURRENT_MANIFEST_PATH);
  assert.equal(commits[1].options.ifMatch, previousEtag);
  assert.equal(commits[1].options.allowOverwrite, true);
  assert.ok(store.calls.some((call) => call.method === 'head' && call.pathname === CURRENT_MANIFEST_PATH));
});

test('manifest metadata changing after the body read prevents conditional publication', async (t) => {
  const paths = await fixture(t), store = fakeStore();
  await publish({ ...paths, ...store });
  const before = Buffer.from(store.objects.get(CURRENT_MANIFEST_PATH).body);
  let reads = 0;
  store.blob.head = async () => ({ url: `${BASE}/${CURRENT_MANIFEST_PATH}`, etag: `"different-body-version-${++reads}"` });
  await assert.rejects(publish({ ...paths, ...store }), /changed during manifest readback/);
  assert.deepEqual(store.objects.get(CURRENT_MANIFEST_PATH).body, before);
});

test('missing CORS or a changed published ledger prefix never replaces the current manifest', async (t) => {
  const paths = await fixture(t), noCors = fakeStore({ cors: null });
  await assert.rejects(publish({ ...paths, ...noCors }), /CORS/);
  assert.equal(noCors.objects.has(CURRENT_MANIFEST_PATH), false);
  const store = fakeStore();
  await publish({ ...paths, ...store });
  const before = Buffer.from(store.objects.get(CURRENT_MANIFEST_PATH).body);
  await writeFile(join(paths.dataDir, 'ledger.jsonl'), `${JSON.stringify(post({ text: 'Forbidden rewrite of the existing ledger event' }))}\n`);
  await assert.rejects(publish({ ...paths, ...store }), /append-only prefix/);
  assert.deepEqual(store.objects.get(CURRENT_MANIFEST_PATH).body, before);
});

test('a concurrent manifest change prevents publication from overwriting the other writer', async (t) => {
  const paths = await fixture(t), store = fakeStore();
  await publish({ ...paths, ...store });
  const originalManifest = Buffer.from(store.objects.get(CURRENT_MANIFEST_PATH).body);
  await writeFile(paths.statusFile, JSON.stringify({ ...status, collector_status: 'running', last_heartbeat_at: '2026-09-08T02:01:00Z' }));
  const put = store.blob.put;
  store.blob.put = async (pathname, body, options) => {
    if (pathname === CURRENT_MANIFEST_PATH) store.objects.get(pathname).etag = '"another-writer"';
    return put(pathname, body, options);
  };
  await assert.rejects(publish({ ...paths, ...store }), /Precondition failed/);
  assert.deepEqual(store.objects.get(CURRENT_MANIFEST_PATH).body, originalManifest);
});

test('status-only publication preserves last-good feed and archives even when live ledger and receipt are incomplete', async (t) => {
  const paths = await fixture(t), store = fakeStore();
  await publish({ ...paths, ...store });
  const priorManifest = JSON.parse(store.objects.get(CURRENT_MANIFEST_PATH).body);
  const priorFeed = JSON.parse(store.objects.get(new URL(priorManifest.feed_url).pathname.slice(1)).body);
  await writeFile(join(paths.dataDir, 'ledger.jsonl'), 'partial live capture is not readable JSON\n');
  await writeFile(join(paths.dataDir, 'receipt.json'), '{incomplete');
  await writeFile(paths.statusFile, JSON.stringify({ collector_status: 'error', last_heartbeat_at: '2026-09-08T03:00:00Z', collector_retry_at: '2026-09-08T03:15:00Z', stale_after_seconds: 600, collector_error: 'X returned 429' }));
  await publishLastGoodStatus({ ...paths, ...store });
  const after = JSON.parse(store.objects.get(CURRENT_MANIFEST_PATH).body);
  const feed = JSON.parse(store.objects.get(new URL(after.feed_url).pathname.slice(1)).body);
  assert.deepEqual(feed.posts, priorFeed.posts);
  assert.deepEqual(feed.notifications, priorFeed.notifications);
  assert.deepEqual(after.archives, priorManifest.archives);
  assert.equal(feed.receipt.collected_at, priorFeed.receipt.collected_at);
  assert.equal(feed.receipt.latest_source_event_at, priorFeed.receipt.latest_source_event_at);
  assert.equal(feed.receipt.collector_status, 'error');
  assert.equal(feed.receipt.collector_retry_at, '2026-09-08T03:15:00.000Z');
  assert.equal(feed.receipt.collector_error, 'X returned 429');
  assert.equal(feed.receipt.collector_heartbeat_at, '2026-09-08T03:00:00.000Z');
  assert.equal((await publishLastGoodStatus({ ...paths, ...store })).changed, false);
  await writeFile(paths.statusFile, JSON.stringify(status));
  await publishLastGoodStatus({ ...paths, ...store });
  const restored = JSON.parse(store.objects.get(CURRENT_MANIFEST_PATH).body);
  const restoredFeed = JSON.parse(store.objects.get(new URL(restored.feed_url).pathname.slice(1)).body);
  assert.equal(restoredFeed.receipt.collector_retry_at, undefined);
  assert.equal(restoredFeed.receipt.collector_error, undefined);
  assert.deepEqual(restoredFeed.posts, priorFeed.posts);
});

test('status-only publication cannot seed a new store or accept corrupt last-good content', async (t) => {
  const paths = await fixture(t), store = fakeStore();
  await assert.rejects(publishLastGoodStatus({ ...paths, ...store }), /No last-good/);
  await publish({ ...paths, ...store });
  const manifest = JSON.parse(store.objects.get(CURRENT_MANIFEST_PATH).body);
  const prior = Buffer.from(store.objects.get(CURRENT_MANIFEST_PATH).body);
  store.objects.get(new URL(manifest.feed_url).pathname.slice(1)).body = Buffer.from('{}');
  await assert.rejects(publishLastGoodStatus({ ...paths, ...store }), /does not match its manifest/);
  assert.deepEqual(store.objects.get(CURRENT_MANIFEST_PATH).body, prior);
});

test('public verification tolerates bounded upload visibility failures but validates the eventual complete response', async () => {
  const waits = [], responses = [404, 503, 200], body = Buffer.from('{"posts":[]}');
  let reads = 0;
  await verifyPublicFeed(`${BASE}/xfeed/feeds/${'a'.repeat(64)}.json`, body, {
    base: BASE, retryDelays: [250, 750], waitImpl: async (ms) => waits.push(ms),
    fetchImpl: async () => new Response(++reads === 3 ? body : 'not yet visible', { status: responses.shift(), headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } }),
  });
  assert.equal(reads, 3);
  assert.deepEqual(waits, [250, 750]);
});

test('manifest readback retries stale cached bytes against committed strong metadata without repeating the write', async () => {
  const waits = [], expectedBody = Buffer.from('{"version":"new"}'), etag = '"new-strong-etag"';
  let reads = 0, puts = 0;
  const manifestUrl = `${BASE}/${CURRENT_MANIFEST_PATH}`;
  const result = await readManifestAtEtag({
    blob: { head: async () => ({ url: manifestUrl, etag }), put: async () => puts++ }, manifestUrl, etag, expectedBody,
    retryDelays: [250, 750], waitImpl: async (ms) => waits.push(ms),
    fetchImpl: async (url) => {
      assert.match(new URL(url).searchParams.get('v'), /^[a-f0-9]{64}-[0-2]$/);
      reads++;
      return new Response(reads < 3 ? '{"version":"old"}' : expectedBody, { headers: { etag: reads < 3 ? 'W/"old-strong-etag"' : `W/${etag}` } });
    },
  });
  assert.equal(reads, 3);
  assert.equal(puts, 0);
  assert.deepEqual(waits, [250, 750]);
  assert.deepEqual(result.body, expectedBody);
});

test('manifest readback rejects a superseding writer even when the expected content is still cached', async () => {
  const manifestUrl = `${BASE}/${CURRENT_MANIFEST_PATH}`;
  let reads = 0;
  await assert.rejects(readManifestAtEtag({
    blob: { head: async () => ({ url: manifestUrl, etag: '"superseding-writer"' }) }, manifestUrl, etag: '"our-commit"', expectedBody: Buffer.from('{}'),
    fetchImpl: async () => { reads++; return new Response('{}', { headers: { etag: 'W/"our-commit"' } }); },
  }), /changed during manifest readback; no write was retried/);
  assert.equal(reads, 0);
});

test('manifest readback spans the real 60-second CDN invalidation window within its 90-second budget', async () => {
  let elapsed = 0, reads = 0;
  const etag = '"committed"', expectedBody = Buffer.from('{}'), manifestUrl = `${BASE}/${CURRENT_MANIFEST_PATH}`;
  await readManifestAtEtag({
    blob: { head: async () => ({ url: manifestUrl, etag }) }, manifestUrl, etag, expectedBody,
    nowImpl: () => elapsed, waitImpl: async (ms) => { elapsed += ms; },
    fetchImpl: async () => { reads++; return new Response(elapsed < 60000 ? '{"old":true}' : expectedBody, { headers: { etag: elapsed < 60000 ? 'W/"old"' : `W/${etag}` } }); },
  });
  assert.equal(elapsed, 65000);
  assert.equal(reads, 9);
});

test('retrying an already committed complete source pass recovers its exact publication without heartbeat-version churn', async (t) => {
  const paths = await fixture(t), store = fakeStore();
  await writeFile(join(paths.dataDir, 'source-receipt.json'), JSON.stringify(completedSource()));
  const first = await publish({ ...paths, ...store });
  const before = Buffer.from(store.objects.get(CURRENT_MANIFEST_PATH).body), putCount = store.calls.filter(call => call.method === 'put').length;
  await writeFile(paths.statusFile, JSON.stringify({ ...status, last_heartbeat_at: '2026-09-08T02:03:00Z' }));
  const recovered = await publish({ ...paths, ...store });
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.changed, false);
  assert.equal(recovered.version, first.version);
  assert.deepEqual(store.objects.get(CURRENT_MANIFEST_PATH).body, before);
  assert.equal(store.calls.filter(call => call.method === 'put').length, putCount);
});

test('same-pass recovery requires intact feed bytes, identical source completion and Notifications, and exact raw archive prefixes', async (t) => {
  for (const change of ['source completion', 'Notifications', 'raw archive', 'corrupt retained feed']) await t.test(change, async (subtest) => {
    const paths = await fixture(subtest), store = fakeStore();
    await writeFile(join(paths.dataDir, 'source-receipt.json'), JSON.stringify(completedSource()));
    await publish({ ...paths, ...store });
    const priorManifest = JSON.parse(store.objects.get(CURRENT_MANIFEST_PATH).body);
    await writeFile(paths.statusFile, JSON.stringify({ ...status, last_heartbeat_at: '2026-09-08T02:03:00Z' }));
    if (change === 'source completion') await writeFile(join(paths.dataDir, 'source-receipt.json'), JSON.stringify({ ...completedSource(), completed_at: '2026-09-08T02:01:00Z' }));
    if (change === 'Notifications') await writeFile(paths.notificationsFile, JSON.stringify({ status: 'configured', handles: [handles[0]], updated_at: actualTime }));
    if (change === 'raw archive') await appendFile(join(paths.dataDir, 'ledger.jsonl'), `${JSON.stringify(post())}\n`);
    if (change === 'corrupt retained feed') {
      store.objects.get(new URL(priorManifest.feed_url).pathname.slice(1)).body = Buffer.from('{}');
      await assert.rejects(publish({ ...paths, ...store }), /Previous published feed does not match its manifest/);
      assert.equal(JSON.parse(store.objects.get(CURRENT_MANIFEST_PATH).body).version, priorManifest.version);
    } else {
      const result = await publish({ ...paths, ...store });
      assert.equal(result.changed, true);
      assert.notEqual(result.recovered, true);
      if (change === 'raw archive') assert.ok(JSON.parse(store.objects.get(CURRENT_MANIFEST_PATH).body).archives.ledger.bytes > priorManifest.archives.ledger.bytes);
    }
  });
});

test('publication refreshes a stale initial SDK manifest before computing an idempotent update', async (t) => {
  const paths = await fixture(t), store = fakeStore();
  await publish({ ...paths, ...store });
  const prior = { ...store.objects.get(CURRENT_MANIFEST_PATH) };
  await writeFile(paths.statusFile, JSON.stringify({ ...status, collector_status: 'running' }));
  await publish({ ...paths, ...store });
  const current = { ...store.objects.get(CURRENT_MANIFEST_PATH) }, get = store.blob.get;
  store.blob.get = async (pathname, options) => pathname === CURRENT_MANIFEST_PATH
    ? { statusCode: 200, stream: new Blob([prior.body]).stream(), blob: { url: `${BASE}/${pathname}`, etag: `W/${prior.etag}` } }
    : get(pathname, options);
  const putsBefore = store.calls.filter(call => call.method === 'put').length;
  const result = await publish({ ...paths, ...store });
  assert.equal(result.changed, false);
  assert.deepEqual(store.objects.get(CURRENT_MANIFEST_PATH).body, current.body);
  assert.equal(store.calls.filter(call => call.method === 'put').length, putsBefore);
});

test('public verification exhausts transient retries and never retries access, CORS, or content-integrity failures', async () => {
  const url = `${BASE}/xfeed/feeds/${'a'.repeat(64)}.json`, body = Buffer.from('{}');
  let reads = 0;
  await assert.rejects(verifyPublicFeed(url, body, { base: BASE, retryDelays: [0, 0], waitImpl: async () => {}, fetchImpl: async () => { reads++; return new Response('', { status: 404 }); } }), /HTTP 404 after 3 attempt/);
  assert.equal(reads, 3);
  for (const [statusCode, headers, actualBody, expected] of [
    [403, {}, '', /HTTP 403; non-retryable/],
    [200, { 'content-type': 'application/json' }, '{}', /CORS/],
    [200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, '{"different":true}', /does not match/],
  ]) {
    reads = 0;
    await assert.rejects(verifyPublicFeed(url, body, { base: BASE, waitImpl: async () => assert.fail('Invalid public response must not be retried'), fetchImpl: async () => { reads++; return new Response(actualBody, { status: statusCode, headers }); } }), expected);
    assert.equal(reads, 1);
  }
});

test('API ignores request-controlled sources and redirects only to the configured store verified feed with no-store', async () => {
  const version = 'a'.repeat(64), requested = [];
  const manifest = { schema_version: 1, version, feed_url: `${BASE}/xfeed/feeds/${version}.json`, feed_sha256: 'b'.repeat(64), feed_bytes: 6000000, feed_cors_verified: true, cors_origin: PUBLIC_SITE_ORIGIN };
  const handler = createHandler({ env: { XFEED_BLOB_BASE_URL: BASE }, fetchImpl: async (url, options) => { requested.push({ url, options }); return new Response(stableJson(manifest)); } });
  const response = fakeResponse();
  await handler({ method: 'GET', url: '/api/xfeed?source=http://169.254.169.254', query: { url: 'https://evil.test/', source: 'http://127.0.0.1/' }, headers: { host: 'evil.test' } }, response);
  assert.equal(requested[0].url, `${BASE}/${CURRENT_MANIFEST_PATH}`);
  assert.equal(requested[0].options.redirect, 'error');
  assert.equal(response.statusCode, 307);
  assert.equal(response.headers.location, manifest.feed_url);
  assert.equal(response.headers['cache-control'], 'no-store, max-age=0');
  assert.equal(response.headers['vercel-cdn-cache-control'], 'no-store');
  assert.equal(response.body, null, 'large feed must not pass through the Function body');
});

test('API rejects injected store origins or manifest URLs and reports missing configuration explicitly', async () => {
  const version = 'a'.repeat(64);
  const good = { schema_version: 1, version, feed_url: `${BASE}/xfeed/feeds/${version}.json`, feed_sha256: 'b'.repeat(64), feed_bytes: 100, feed_cors_verified: true, cors_origin: PUBLIC_SITE_ORIGIN };
  for (const feed_url of ['https://evil.test/feed.json', `${BASE}/other.json`, `${good.feed_url}?token=anything`, `${good.feed_url}#fragment`, `https://user:password@teststore.public.blob.vercel-storage.com/xfeed/feeds/${version}.json`]) {
    const response = fakeResponse();
    await createHandler({ env: { XFEED_BLOB_BASE_URL: BASE }, fetchImpl: async () => new Response(stableJson({ ...good, feed_url })) })({ method: 'GET' }, response);
    assert.equal(response.statusCode, 503);
    assert.equal(response.headers.location, undefined);
  }
  let fetched = false;
  const badConfig = fakeResponse();
  await createHandler({ env: { XFEED_BLOB_BASE_URL: `${BASE}.evil.test` }, fetchImpl: async () => { fetched = true; } })({ method: 'GET' }, badConfig);
  assert.equal(fetched, false);
  assert.equal(badConfig.statusCode, 503);
  const missing = fakeResponse();
  await createHandler({ env: {} })({ method: 'GET' }, missing);
  assert.equal(missing.body.receipt.collector_status, 'unconfigured');
  const postResponse = fakeResponse();
  await createHandler({ env: {} })({ method: 'POST' }, postResponse);
  assert.equal(postResponse.statusCode, 405);
});

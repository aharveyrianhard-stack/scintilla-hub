#!/usr/bin/env node
import { readFile, writeFile, mkdir, open, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as blobSdk from '@vercel/blob';
import { latestPosts, normalizePost, recordKey, timestamp } from './xfeed-ingest.mjs';
import { CURRENT_MANIFEST_PATH, PUBLIC_SITE_ORIGIN, MANIFEST_CACHE_SECONDS, IMMUTABLE_CACHE_SECONDS, HASH_PATTERN, publicStoreBase, verifiedBlobUrl, validateManifest } from '../lib/xfeed-store.mjs';

const COLLECTOR_STATUSES = new Set(['idle', 'running', 'error', 'unconfigured']);
const HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
export const stableJson = (value) => JSON.stringify(canonical(value));
function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value;
}
function withoutEvidenceBulk(value) {
  if (Array.isArray(value)) return value.map(withoutEvidenceBulk);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !['raw', 'provenance'].includes(key)).map(([key, item]) => [key, withoutEvidenceBulk(item)]));
  return value;
}
function compactOriginal(source, depth = 1) {
  if (!source) return null;
  if (depth > 4) throw new Error('Original nesting exceeds four levels');
  return {
    ...Object.fromEntries(['id', 'handle', 'kind', 'url', 'created_at', 'text', 'photos', 'videos', 'video_url', 'has_video', 'youtube_id', 'links'].map((key) => [key, source[key] ?? null])),
    original: source.original ? compactOriginal(source.original, depth + 1) : null,
  };
}
export function compactPosts(records, handles) {
  return latestPosts(records).map((record) => {
    const source = normalizePost(record, { handles });
    return {
      record_key: recordKey(source), id: source.id, handle: source.handle, created_at: source.created_at,
      kind: source.kind, text: source.text, url: source.url,
      photos: source.photos, videos: source.videos, video_url: source.video_url, has_video: source.has_video,
      youtube_id: source.youtube_id, links: source.links, original: compactOriginal(source.original),
    };
  }).sort((a, b) => b.created_at.localeCompare(a.created_at) || a.record_key.localeCompare(b.record_key));
}
export function normalizeCollectorStatus(value) {
  if (value == null) return { collector_status: 'unconfigured', collector_heartbeat_at: null, latest_source_event_at: null, stale_after_seconds: null };
  const source = requireObject(value, 'collector status');
  if (!COLLECTOR_STATUSES.has(source.collector_status)) throw new Error('collector_status must be idle, running, error, or unconfigured');
  const heartbeat = source.last_heartbeat_at ?? source.collector_heartbeat_at ?? null;
  if (source.collector_status !== 'unconfigured' && !heartbeat) throw new Error('Configured collector status requires an actual last_heartbeat_at');
  if (source.collector_status !== 'unconfigured' && (!Number.isSafeInteger(source.stale_after_seconds) || source.stale_after_seconds < 1)) throw new Error('Configured collector status requires a positive stale_after_seconds');
  if (source.collector_error != null && typeof source.collector_error !== 'string') throw new Error('collector_error must be a string');
  return {
    collector_status: source.collector_status,
    ...(source.collector_error ? { collector_error: source.collector_error.slice(0, 1000) } : {}),
    collector_heartbeat_at: heartbeat ? timestamp(heartbeat, 'last_heartbeat_at') : null,
    ...(source.collector_retry_at ? { collector_retry_at: timestamp(source.collector_retry_at, 'collector_retry_at') } : {}),
    latest_source_event_at: source.latest_source_event_at ? timestamp(source.latest_source_event_at, 'latest_source_event_at') : null,
    stale_after_seconds: source.collector_status === 'unconfigured' ? null : source.stale_after_seconds,
  };
}
export function normalizeNotifications(value, tradingHandles) {
  if (value == null || value.status === 'unconfigured' || value.membership_verified === false) return { status: 'unconfigured', handles: [] };
  const source = requireObject(value, 'notifications');
  if (source.status !== 'configured' || !Array.isArray(source.handles)) throw new Error('Notifications must be explicitly configured with an exact handles array');
  const population = new Map(tradingHandles.map((handle) => [handle.toLowerCase(), handle]));
  const seen = new Set();
  const handles = source.handles.map((handle) => {
    if (typeof handle !== 'string' || !HANDLE.test(handle) || !population.has(handle.toLowerCase())) throw new Error('Notifications handle is outside the exact Trading population');
    if (seen.has(handle.toLowerCase())) throw new Error('Notifications contains a duplicate handle');
    seen.add(handle.toLowerCase());
    return population.get(handle.toLowerCase());
  });
  if (source.source != null && typeof source.source !== 'string') throw new Error('Notifications source must be descriptive text');
  return { status: 'configured', handles, ...(source.source ? { source: source.source } : {}), ...(source.updated_at ? { updated_at: timestamp(source.updated_at, 'notifications.updated_at') } : {}) };
}
export function applySourceReceipt(receipt, value) {
  if (value == null) return receipt;
  const source = requireObject(value, 'source receipt');
  const coverage = requireObject(source.coverage, 'source coverage');
  if (source.schema_version !== 1 || source.source_type !== 'x_list_latest_timeline' || source.list_id !== '1405188850188759047') throw new Error('Source receipt must identify the exact Trading list');
  const sourceUrl = new URL(source.source_url);
  if (sourceUrl.origin !== 'https://x.com' || sourceUrl.pathname !== `/i/lists/${source.list_id}` || sourceUrl.username || sourceUrl.password || sourceUrl.hash) throw new Error('Source receipt URL does not identify the Trading list');
  if (!['current_window_observed', 'incremental_overlap_observed', 'timeline_end_observed'].includes(source.status) || !['initial_window', 'overlap', 'timeline_end'].includes(coverage.termination_reason)) throw new Error('Source receipt has an unsupported pass boundary');
  if (coverage.history_complete !== false || typeof coverage.initial_history_gap_open !== 'boolean' || typeof coverage.overlap_with_previous_frontier !== 'boolean') throw new Error('Source receipt must state its bounded history evidence');
  const captureKey = coverage.captured_responses_or_chunks !== undefined ? 'captured_responses_or_chunks' : 'captured_pages';
  for (const key of [captureKey, 'observed_posts']) if (!Number.isSafeInteger(coverage[key]) || coverage[key] < 0) throw new Error(`Source coverage ${key} must be a nonnegative integer`);
  const captureDescription = captureKey === 'captured_responses_or_chunks' ? `${coverage[captureKey]} saved response/chunk(s)` : `${coverage[captureKey]} captured page(s)`;
  const observedAt = timestamp(source.observed_at, 'source.observed_at');
  const completedAt = timestamp(source.completed_at, 'source.completed_at');
  for (const key of ['earliest_observed_post_at', 'latest_observed_post_at']) if (coverage[key] != null) timestamp(coverage[key], `source.coverage.${key}`);
  const sourceLimitations = [];
  for (const value of [source.limitations, coverage.limitations]) {
    if (value == null) continue;
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new Error('Source limitations must be an array of strings');
    sourceLimitations.push(...value.filter(Boolean));
  }
  if (coverage.cursor_chain_verified !== true) sourceLimitations.push('Continuous response cursor chain was not verified.');
  const distinctSourceLimitations = [...new Set(sourceLimitations)];
  const historical = Object.fromEntries([
    'status', 'collection_scopes', 'completion_scope', 'query_pass_complete', 'first_pass_complete',
    'handles_attempted', 'handles_queried', 'handles_successful', 'handles_no_results', 'handles_blocked', 'handles_failed', 'handles_unattempted',
    'query_attempts', 'collection_started_at', 'collected_at', 'source_completeness', 'collection_method',
  ].filter((key) => receipt[key] !== undefined).map((key) => [key, receipt[key]]));
  const boundary = coverage.termination_reason === 'overlap' ? 'The captured window reached the previous frontier.' : coverage.termination_reason === 'timeline_end' ? 'The response indicated the end of the available timeline.' : 'This is the initial captured window.';
  return {
    ...receipt,
    source_receipt: source,
    historical_search_coverage: receipt.historical_search_coverage ?? historical,
    handle_attempts_scope: 'historical_search_attempts',
    status: source.status, collection_scopes: ['x_list_latest_timeline'], completion_scope: 'captured_x_list_response_window',
    query_pass_complete: null, first_pass_complete: null,
    collection_started_at: null, collected_at: observedAt, collection_completed_at: completedAt,
    collection_time_basis: 'source_receipt.observed_at',
    source_completeness: [`X Trading list: ${captureDescription}, ${coverage.observed_posts} observed posts in this pass. ${boundary} ${coverage.initial_history_gap_open ? 'The earlier historical gap remains open.' : 'Complete account history is not established.'}`, ...distinctSourceLimitations].join(' '),
    collection_method: { source_type: source.source_type, source_url: source.source_url, list_id: source.list_id, history_coverage: 'not_established', post_detail_verification: 'not_recorded_for_this_pass' },
    limitations: [
      'This pass covers the captured Trading-list response window; it does not establish complete account history.',
      'Available post fields came from list responses; separate detail-page verification is not recorded for every post in this pass.',
      'Resolved video counts indicate extracted file URLs; they do not certify every file\'s playback.',
      ...distinctSourceLimitations,
    ],
  };
}
export function buildPublicFeed({ records, receipt, handles, status = null, notifications = null, sourceReceipt = null }) {
  const cleanReceipt = withoutEvidenceBulk(requireObject(receipt, 'receipt'));
  const posts = compactPosts(records, handles);
  if (cleanReceipt.posts_kept !== posts.length) throw new Error('Receipt posts_kept does not match the current ledger');
  // Source collection clocks remain as supplied. Publication has no clock
  // fallback for collection, heartbeat, or latest source event timestamps.
  const collector = normalizeCollectorStatus(status);
  delete cleanReceipt.collector_error;
  const sourceAwareReceipt = applySourceReceipt(cleanReceipt, sourceReceipt);
  if (!collector.latest_source_event_at && sourceReceipt?.coverage?.latest_observed_post_at) collector.latest_source_event_at = timestamp(sourceReceipt.coverage.latest_observed_post_at, 'source.coverage.latest_observed_post_at');
  const content = { posts, receipt: { ...sourceAwareReceipt, ...collector }, notifications: normalizeNotifications(notifications, handles) };
  return { ...content, version: sha256(stableJson(content)) };
}
async function readJson(path, optional = false) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch (error) { if (optional && error.code === 'ENOENT') return null; throw error; }
}
function parseJsonl(buffer, name) {
  return buffer.toString('utf8').split(/\r?\n/).filter((line) => line.trim()).map((line, index) => {
    try { return JSON.parse(line); } catch { throw new Error(`${name} has invalid JSON on row ${index + 1}`); }
  });
}
export async function loadPublication({ dataDir, statusFile, notificationsFile }) {
  const [ledger, attempts, receipt, handlesText, status, notifications, sourceReceipt] = await Promise.all([
    readFile(join(dataDir, 'ledger.jsonl')), readFile(join(dataDir, 'query-attempts.jsonl')),
    readJson(join(dataDir, 'receipt.json')), readFile(join(dataDir, 'HANDLES_TRADING.txt'), 'utf8'),
    statusFile ? readJson(statusFile, true) : null,
    notificationsFile ? readJson(notificationsFile, true) : null,
    readJson(join(dataDir, 'source-receipt.json'), true),
  ]);
  const handles = handlesText.split(/\r?\n/).filter(Boolean);
  if (!handles.length || handles.some((handle) => !HANDLE.test(handle)) || new Set(handles.map((handle) => handle.toLowerCase())).size !== handles.length) throw new Error('Trading handle list is invalid');
  const records = parseJsonl(ledger, 'ledger.jsonl');
  parseJsonl(attempts, 'query-attempts.jsonl');
  const feed = buildPublicFeed({ records, receipt, handles, status, notifications, sourceReceipt });
  return { feed, ledger, attempts };
}
export async function writePreview({ dataDir, statusFile, notificationsFile, outputPath }) {
  if (!outputPath) throw new Error('--dry-run requires --output <local-feed.json>');
  const { feed } = await loadPublication({ dataDir, statusFile, notificationsFile });
  const body = stableJson(feed);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, body, 'utf8');
  return { dry_run: true, output_path: outputPath, version: feed.version, posts_count: feed.posts.length, collector_status: feed.receipt.collector_status, feed_bytes: Buffer.byteLength(body) };
}
export async function verifyPublicFeed(url, expectedBody, { base, fetchImpl = fetch, waitImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), retryDelays = [250, 750, 1500, 3000, 6000] } = {}) {
  verifiedBlobUrl(url, { base });
  const deadline = Date.now() + 30000;
  let response, failure;
  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    try {
      response = await fetchImpl(url, { method: 'GET', redirect: 'error', cache: 'no-store', headers: { Origin: PUBLIC_SITE_ORIGIN, Accept: 'application/json' }, signal: AbortSignal.timeout(Math.max(1, Math.min(8000, deadline - Date.now()))) });
    } catch (error) {
      if (!['TypeError', 'AbortError', 'TimeoutError'].includes(error.name)) throw error;
      response = null;
      failure = `network ${error.name}`;
    }
    if (response?.ok) {
      const cors = response.headers.get('access-control-allow-origin');
      if (cors !== '*' && cors !== PUBLIC_SITE_ORIGIN) throw new Error('Published feed is missing CORS permission for scintillahub.ai');
      if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) throw new Error('Published feed has an incorrect content type');
      const received = Buffer.from(await response.arrayBuffer());
      if (sha256(received) !== sha256(expectedBody)) throw new Error('Public feed content does not match the complete uploaded snapshot');
      return;
    }
    if (response) {
      failure = `HTTP ${response.status}`;
      await response.body?.cancel();
      if (![404, 408, 425, 429].includes(response.status) && response.status < 500) throw new Error(`Published feed could not be read publicly (${failure}; non-retryable)`);
    }
    const delay = retryDelays[attempt];
    if (delay === undefined || Date.now() + delay >= deadline) throw new Error(`Published feed could not be read publicly (${failure} after ${attempt + 1} attempt(s))`);
    await waitImpl(delay);
  }
}
export async function readManifestAtEtag({ blob, manifestUrl, etag, expectedBody, fetchImpl = fetch, waitImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), retryDelays = [250, 750, 1500, 3000, 6000] }) {
  const base = new URL(verifiedBlobUrl(manifestUrl, { pathname: CURRENT_MANIFEST_PATH })).origin;
  if (!/^"[^"\r\n]+"$/.test(etag)) throw new Error('Manifest readback requires a strong metadata ETag');
  const deadline = Date.now() + 30000;
  let failure = 'unavailable';
  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    const metadata = await blob.head(CURRENT_MANIFEST_PATH);
    verifiedBlobUrl(metadata.url, { base, pathname: CURRENT_MANIFEST_PATH });
    if (metadata.etag !== etag) throw new Error('Current manifest changed during manifest readback; no write was retried');
    // Public SDK get(useCache:false) still uses the CDN. This internal query is
    // derived solely from the expected strong metadata, never request input.
    const readUrl = new URL(manifestUrl);
    readUrl.searchParams.set('v', `${sha256(etag)}-${attempt}`);
    let response;
    try {
      response = await fetchImpl(readUrl.href, { method: 'GET', redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(Math.max(1, Math.min(8000, deadline - Date.now()))) });
      if (response.ok) {
        const body = Buffer.from(await response.arrayBuffer());
        if (body.length > 65536) throw new Error('Current manifest is too large');
        if (response.headers.get('etag')?.replace(/^W\//, '') === etag && (!expectedBody || sha256(body) === sha256(expectedBody))) return { url: manifestUrl, etag, body };
        failure = 'cached body does not match expected metadata/content';
      } else {
        failure = `HTTP ${response.status}`;
        await response.body?.cancel();
        if (![404, 408, 425, 429].includes(response.status) && response.status < 500) throw new Error(`Current manifest readback failed (${failure}; non-retryable)`);
      }
    } catch (error) {
      if (!['TypeError', 'AbortError', 'TimeoutError'].includes(error.name)) throw error;
      failure = `network ${error.name}`;
    }
    const delay = retryDelays[attempt];
    if (delay === undefined || Date.now() + delay >= deadline) throw new Error(`Current manifest commit could not be verified (${failure} after ${attempt + 1} attempt(s)); no write was retried`);
    await waitImpl(delay);
  }
}
export async function publish(options) { return publishSnapshot(options); }
export async function publishLastGoodStatus(options) { return publishSnapshot({ ...options, statusOnly: true }); }
async function publishSnapshot({ dataDir, statusFile, notificationsFile, baseUrl, blob = blobSdk, fetchImpl = fetch, statusOnly = false }) {
  const lockPath = join(dataDir, '.publish.lock');
  let lock;
  try { lock = await open(lockPath, 'wx'); } catch (error) { if (error.code === 'EEXIST') throw new Error('Another publisher holds .publish.lock'); throw error; }
  let base = baseUrl ? publicStoreBase(baseUrl) : null;
  const bindUrl = (value, pathname) => {
    const verified = verifiedBlobUrl(value, { base, pathname });
    base ??= new URL(verified).origin;
    return verified;
  };
  const readBlob = async (pathname) => {
    const result = await blob.get(pathname, { access: 'public', useCache: false });
    if (!result) return null;
    if (result.statusCode !== 200 || !result.stream) throw new Error('Unexpected Blob read response');
    const url = bindUrl(result.blob.url, pathname);
    return { url, etag: result.blob.etag, body: Buffer.from(await new Response(result.stream).arrayBuffer()) };
  };
  const ensureImmutable = async (pathname, body, contentType) => {
    const existing = await readBlob(pathname);
    if (existing) {
      if (sha256(existing.body) !== sha256(body)) throw new Error('Immutable artifact path already contains different bytes');
      return existing.url;
    }
    try {
      const result = await blob.put(pathname, body, { access: 'public', addRandomSuffix: false, allowOverwrite: false, contentType, cacheControlMaxAge: IMMUTABLE_CACHE_SECONDS });
      return bindUrl(result.url, pathname);
    } catch (error) {
      // A concurrent identical upload or uncertain completion is safe only
      // after reading back exactly the expected immutable bytes.
      const completed = await readBlob(pathname);
      if (!completed || sha256(completed.body) !== sha256(body)) throw error;
      return completed.url;
    }
  };
  try {
    let snapshot = statusOnly ? null : await loadPublication({ dataDir, statusFile, notificationsFile });
    let current = await readBlob(CURRENT_MANIFEST_PATH);
    let previous = null;
    if (current) {
      if (!current.etag) throw new Error('Current manifest has no ETag for a conditional update');
      // Public GET can report a weak representation ETag, which cannot satisfy
      // Blob's strong conditional write. Match metadata to the body just read,
      // then retain HEAD's strong ETag for the final ifMatch write.
      const metadata = await blob.head(CURRENT_MANIFEST_PATH);
      bindUrl(metadata.url, CURRENT_MANIFEST_PATH);
      if (!/^"[^"\r\n]+"$/.test(metadata.etag)) throw new Error('Current manifest metadata has no strong ETag');
      if (current.etag.replace(/^W\//, '') !== metadata.etag) current = await readManifestAtEtag({ blob, manifestUrl: current.url, etag: metadata.etag, fetchImpl });
      else current.etag = metadata.etag;
      if (current.body.length > 65536) throw new Error('Current manifest is too large');
      previous = validateManifest(JSON.parse(current.body.toString('utf8')), base);
    }
    if (statusOnly) {
      if (!previous) throw new Error('No last-good published feed exists for a status-only update');
      if (!statusFile) throw new Error('Status-only publication requires an explicit status file');
      const retained = await readBlob(`xfeed/feeds/${previous.version}.json`);
      if (!retained || retained.body.length !== previous.feed_bytes || sha256(retained.body) !== previous.feed_sha256) throw new Error('Last-good published feed does not match its manifest');
      const oldFeed = JSON.parse(retained.body.toString('utf8'));
      const { version: oldVersion, ...oldContent } = oldFeed;
      if (oldVersion !== previous.version || sha256(stableJson(oldContent)) !== oldVersion || !Array.isArray(oldFeed.posts)) throw new Error('Last-good published feed has invalid content identity');
      requireObject(oldFeed.receipt, 'last-good receipt');
      const collector = normalizeCollectorStatus(await readJson(statusFile));
      // Keep all source/data clocks and every last-good record. A failed or
      // incomplete active pass must never leak into this status-only snapshot.
      delete collector.latest_source_event_at;
      const receipt = { ...oldFeed.receipt };
      delete receipt.collector_error;
      delete receipt.collector_retry_at;
      Object.assign(receipt, collector);
      const content = { ...oldContent, receipt };
      for (const name of ['ledger', 'attempts']) {
        const archive = previous.archives?.[name];
        if (!archive || !Number.isSafeInteger(archive.bytes) || archive.bytes < 0 || !HASH_PATTERN.test(archive.sha256)) throw new Error('Last-good archive pointer is invalid');
        verifiedBlobUrl(archive.index_url, { base });
      }
      snapshot = { feed: { ...content, version: sha256(stableJson(content)) }, archives: previous.archives };
    }
    const feedBody = Buffer.from(stableJson(snapshot.feed));
    const feedPath = `xfeed/feeds/${snapshot.feed.version}.json`;
    const feedUrl = await ensureImmutable(feedPath, feedBody, 'application/json; charset=utf-8');
    // CORS and the whole compact payload are verified before any current pointer
    // can make this version visible to the product.
    await verifyPublicFeed(feedUrl, feedBody, { base, fetchImpl });
    const archive = async (name, body) => {
      const prior = previous?.archives?.[name] ?? null;
      const start = prior?.bytes ?? 0;
      if (!Number.isSafeInteger(start) || start < 0 || start > body.length || (prior && (!HASH_PATTERN.test(prior.sha256) || sha256(body.subarray(0, start)) !== prior.sha256))) throw new Error(`${name} no longer matches its published append-only prefix`);
      if (prior) verifiedBlobUrl(prior.index_url, { base });
      if (prior && start === body.length) return prior;
      if (start > 0 && body[start - 1] !== 10) throw new Error(`${name} published prefix does not end at a record boundary`);
      if (body.length && body.at(-1) !== 10) throw new Error(`${name} must end with a newline before publication`);
      const chunk = body.subarray(start), chunkHash = sha256(chunk);
      const chunkUrl = await ensureImmutable(`xfeed/archive/${name}/${chunkHash}.jsonl`, chunk, 'application/x-ndjson; charset=utf-8');
      const index = {
        schema_version: 1, name, start_byte: start, end_byte: body.length,
        chunk_url: chunkUrl, chunk_sha256: chunkHash,
        full_sha256: sha256(body), previous_index_url: prior?.index_url ?? null,
      };
      const indexBody = Buffer.from(stableJson(index));
      const indexUrl = await ensureImmutable(`xfeed/archive/${name}/indexes/${sha256(indexBody)}.json`, indexBody, 'application/json; charset=utf-8');
      return { bytes: body.length, sha256: sha256(body), index_url: indexUrl };
    };
    const archives = snapshot.archives ?? { ledger: await archive('ledger', snapshot.ledger), attempts: await archive('attempts', snapshot.attempts) };
    const manifest = {
      schema_version: 1, version: snapshot.feed.version, feed_url: feedUrl,
      feed_sha256: sha256(feedBody), feed_bytes: feedBody.length,
      feed_cors_verified: true, cors_origin: PUBLIC_SITE_ORIGIN,
      collected_at: snapshot.feed.receipt.collected_at ?? null,
      collector_heartbeat_at: snapshot.feed.receipt.collector_heartbeat_at,
      archives,
    };
    const manifestBody = Buffer.from(stableJson(manifest));
    if (previous && stableJson(previous) === manifestBody.toString('utf8')) return { changed: false, version: manifest.version, feed_url: feedUrl, base_url: base, manifest_url: `${base}/${CURRENT_MANIFEST_PATH}`, feed_bytes: feedBody.length };
    await ensureImmutable(`xfeed/manifests/${sha256(manifestBody)}.json`, manifestBody, 'application/json; charset=utf-8');
    const committed = await blob.put(CURRENT_MANIFEST_PATH, manifestBody, {
      access: 'public', addRandomSuffix: false, allowOverwrite: Boolean(current),
      ...(current ? { ifMatch: current.etag } : {}),
      contentType: 'application/json; charset=utf-8', cacheControlMaxAge: MANIFEST_CACHE_SECONDS,
    });
    const manifestUrl = bindUrl(committed.url, CURRENT_MANIFEST_PATH);
    await readManifestAtEtag({ blob, manifestUrl, etag: committed.etag, expectedBody: manifestBody, fetchImpl });
    return { changed: true, version: manifest.version, feed_url: feedUrl, base_url: base, manifest_url: manifestUrl, feed_bytes: feedBody.length };
  } finally { await lock.close(); await unlink(lockPath); }
}
const usage = 'Usage: node [--env-file=.env.local] scripts/xfeed-publish.mjs [--data-dir <operational-data>] [--status-file <heartbeat.json>] [--notifications-file <notifications.json>] [--base-url <public-store-origin>] [--dry-run --output <local-feed.json>]';
async function main(args) {
  if (args.includes('--help')) { process.stdout.write(`${usage}\n`); return; }
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') { options['--dry-run'] = true; continue; }
    if (!['--data-dir', '--status-file', '--notifications-file', '--base-url', '--output'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--') || options[args[i]]) throw new Error(usage);
    options[args[i]] = args[++i];
  }
  if (options['--output'] && !options['--dry-run']) throw new Error('--output is only used with --dry-run');
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const parameters = {
    dataDir: resolve(options['--data-dir'] ?? join(root, 'xfeed/data')),
    statusFile: options['--status-file'] ? resolve(options['--status-file']) : undefined,
    notificationsFile: options['--notifications-file'] ? resolve(options['--notifications-file']) : undefined,
    baseUrl: options['--base-url'] ?? process.env.XFEED_BLOB_BASE_URL,
  };
  const result = options['--dry-run'] ? await writePreview({ ...parameters, outputPath: options['--output'] ? resolve(options['--output']) : undefined }) : await publish(parameters);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch((error) => {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const message = token ? String(error.message).split(token).join('[redacted]') : String(error.message);
  process.stderr.write(`Xfeed publication failed: ${message}\n`); process.exitCode = 1;
});

#!/usr/bin/env node
/** Offline import of browser-extracted X posts. No network access or collection. */
import { readFile, mkdir, appendFile, writeFile, rename, unlink, open } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KINDS = new Set(['original', 'reply', 'quote', 'repost']);
const STATUSES = new Set(['successful', 'no_results', 'blocked', 'failed']);
const HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const POST_ID = /^[1-9][0-9]{0,19}$/;
const OBSERVATION_TIMES = new Set(['collected_at', 'extracted_at', 'observed_at', 'captured_at', 'fetched_at', 'readAt', 'ingested_at']);

function fail(message) { throw new Error(message); }
function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${name} must be an object`);
  return value;
}
function handle(value, name = 'handle') {
  if (typeof value !== 'string' || !HANDLE.test(value)) fail(`${name} must be a valid X handle without @`);
  return value;
}
function postId(value, name = 'id') {
  if (typeof value !== 'string' || !POST_ID.test(value)) fail(`${name} must be a decimal string, never a JavaScript number`);
  return value;
}
export function timestamp(value, name = 'created_at') {
  if (typeof value !== 'string') fail(`${name} must be an extracted ISO timestamp with a timezone`);
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!m) fail(`${name} must include a full ISO date, time, and timezone`);
  const [, year, month, day, hour, minute, second, , zone] = m;
  const y = Number(year), mo = Number(month), d = Number(day);
  const h = Number(hour), mi = Number(minute), s = Number(second);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (mo < 1 || mo > 12 || d < 1 || d > days[mo - 1] || h > 23 || mi > 59 || s > 59) fail(`${name} has an invalid calendar date or time`);
  if (zone !== 'Z') {
    const zh = Number(zone.slice(1, 3)), zm = Number(zone.slice(4, 6));
    if (zh > 14 || zm > 59 || (zh === 14 && zm !== 0)) fail(`${name} has an invalid timezone offset`);
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) fail(`${name} is invalid`);
  return parsed.toISOString();
}
function url(value, name, { media = false } = {}) {
  if (typeof value !== 'string' || !value) fail(`${name} must be a URL`);
  let parsed;
  try { parsed = new URL(value); } catch { fail(`${name} must be a valid URL`); }
  if (!(media ? ['https:'] : ['https:', 'http:']).includes(parsed.protocol) || parsed.username || parsed.password) fail(`${name} has an unsupported protocol or embedded credentials`);
  return parsed.href;
}
function xUrl(value, name) {
  const parsed = new URL(url(value, name, { media: true }));
  if (!['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(parsed.hostname)) fail(`${name} must be an actual X or Twitter source URL`);
  return parsed;
}
function statusUrl(value, id, author, name, allowOriginal = null) {
  const parsed = xUrl(value, name);
  const match = /^\/(?:([A-Za-z0-9_]{1,15})|i\/web)\/status\/([1-9][0-9]{0,19})(?:\/.*)?$/.exec(parsed.pathname);
  if (!match || match[2] !== id) fail(`${name} does not match the extracted post ID`);
  if (match[1] && match[1].toLowerCase() !== author.toLowerCase() && match[1].toLowerCase() !== allowOriginal?.toLowerCase()) fail(`${name} does not match the extracted author`);
  // Preserve the actual source URL; do not manufacture a permalink from an ID.
  return parsed.href;
}
function photos(value = []) {
  if (!Array.isArray(value)) fail('photos must be an array');
  return [...new Set(value.map((photo) => url(typeof photo === 'string' ? photo : photo?.url, 'photo URL', { media: true })))];
}
function youtubeId(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(value)) fail('youtube_id must be an extracted 11-character video ID');
  return value;
}
function youtubeFromUrl(value) {
  const p = new URL(value);
  if (p.hostname === 'youtu.be' || p.hostname === 'www.youtu.be') return /^[A-Za-z0-9_-]{11}$/.test(p.pathname.slice(1)) ? p.pathname.slice(1) : null;
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(p.hostname)) {
    const id = p.searchParams.get('v') || /^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})(?:\/|$)/.exec(p.pathname)?.[1];
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  }
  return null;
}
function links(value = []) {
  if (!Array.isArray(value)) fail('links must be an array');
  const byUrl = new Map();
  for (const entry of value) {
    const source = typeof entry === 'string' ? { url: entry } : object(entry, 'link');
    const target = url(source.url, 'link URL');
    if (source.title != null && typeof source.title !== 'string') fail('link title must be a string');
    byUrl.set(target, { url: target, title: source.title || '' });
  }
  return [...byUrl.values()];
}
function videos(value = [], legacyUrl = null) {
  if (!Array.isArray(value)) fail('videos must be an array');
  const result = value.map((item) => {
    const source = object(item, 'video');
    if (source.alt != null && typeof source.alt !== 'string') fail('video.alt must be a string');
    return {
      url: source.url == null ? null : url(source.url, 'video URL', { media: true }),
      poster: source.poster == null ? null : url(source.poster, 'video poster URL', { media: true }),
      alt: source.alt ?? '',
    };
  });
  // Older captures contain one direct file. Explicit multi-video arrays retain
  // every known item, including unresolved items, without collapsing to a file.
  if (!result.length && legacyUrl) result.push({ url: legacyUrl, poster: null, alt: '' });
  return result;
}
function media(source) {
  const outbound = links(source.links);
  const video = source.video_url ?? source.file ?? null;
  const legacyVideoUrl = video ? url(video, 'video URL', { media: true }) : null;
  const nativeVideos = videos(source.videos, legacyVideoUrl);
  const yt = youtubeId(source.youtube_id) || outbound.map((link) => youtubeFromUrl(link.url)).find(Boolean) || null;
  if (source.has_video !== undefined && typeof source.has_video !== 'boolean') fail('has_video must be a boolean');
  return {
    photos: photos(source.photos ?? (source.img ? [source.img] : [])),
    videos: nativeVideos,
    video_url: nativeVideos.find((item) => item.url)?.url ?? legacyVideoUrl,
    has_video: source.has_video === true || nativeVideos.length > 0 || Boolean(video) || Boolean(yt),
    youtube_id: yt,
    links: outbound,
  };
}
function originalPost(value, depth = 1) {
  if (value === undefined || value === null) return null;
  if (depth > 4) fail('original nesting exceeds four levels');
  const source = object(value, 'original');
  const id = postId(source.id, 'original.id'), author = handle(source.handle, 'original.handle');
  if (source.text != null && typeof source.text !== 'string') fail('original.text must be a string');
  const original = originalPost(source.original, depth + 1);
  const ownMedia = media(source);
  if (source.kind != null && !KINDS.has(source.kind)) fail('original.kind must be a supported post kind');
  return {
    id, handle: author,
    kind: source.kind ?? 'original',
    url: source.url ? statusUrl(source.url, id, author, 'original.url') : null,
    created_at: source.created_at != null || source.at != null ? timestamp(source.created_at ?? source.at, 'original.created_at') : null,
    text: source.text ?? '',
    ...ownMedia,
    has_video: ownMedia.has_video || Boolean(original?.has_video),
    original,
    raw: source.raw ?? source,
  };
}
export function recordKey(post) {
  return post.kind === 'repost' ? `repost:${post.handle.toLowerCase()}:${post.id}` : `post:${post.id}`;
}
export function normalizePost(value, context = {}) {
  const source = object(value, 'post');
  const id = postId(source.id), author = handle(source.handle);
  if (context.handles && !context.handles.some((item) => item.toLowerCase() === author.toLowerCase())) fail('post handle is outside HANDLES_TRADING.txt');
  if (!KINDS.has(source.kind)) fail('post kind must be original, reply, quote, or repost');
  if (typeof source.text !== 'string') fail('post text must be the extracted string, including an empty string for media-only posts');
  const original = originalPost(source.original);
  if (source.kind === 'repost' && !original) fail('repost must identify its original post');
  const ownMedia = media(source);
  const sourceUrl = statusUrl(source.url, id, author, 'post.url', source.kind === 'repost' && original?.id === id ? original.handle : null);
  const provenance = source.provenance == null ? {} : typeof source.provenance === 'string' ? { note: source.provenance } : { ...object(source.provenance, 'provenance') };
  provenance.source_url ??= sourceUrl;
  if (context.collected_at) provenance.collected_at ??= timestamp(context.collected_at, 'collected_at');
  if (context.source) provenance.collection_source ??= context.source;
  for (const key of ['collected_at', 'extracted_at', 'observed_at']) if (provenance[key] != null) provenance[key] = timestamp(provenance[key], `provenance.${key}`);
  if (provenance.source_url) provenance.source_url = xUrl(provenance.source_url, 'provenance.source_url').href;
  return {
    id, handle: author,
    created_at: timestamp(source.created_at ?? source.at),
    kind: source.kind, text: source.text, url: sourceUrl,
    ...ownMedia,
    has_video: ownMedia.has_video || Boolean(original?.has_video),
    original, provenance, raw: source.raw ?? source,
  };
}
export function normalizeAttempt(value, context = {}) {
  const source = object(value, 'attempt');
  const author = handle(source.handle);
  const status = source.status === 'success' ? 'successful' : source.status;
  if (context.handles && !context.handles.some((item) => item.toLowerCase() === author.toLowerCase())) fail('attempt handle is outside HANDLES_TRADING.txt');
  if (!STATUSES.has(status)) fail('attempt status must be success, successful, no_results, blocked, or failed');
  if (source.queried !== undefined && typeof source.queried !== 'boolean') fail('attempt.queried must be a boolean');
  if (source.full_post_extraction_complete !== undefined && typeof source.full_post_extraction_complete !== 'boolean') fail('attempt.full_post_extraction_complete must be a boolean');
  if (source.full_post_extraction_complete && !['successful', 'no_results'].includes(status)) fail('a blocked or failed attempt cannot be extraction complete');
  if (source.reason !== undefined && typeof source.reason !== 'string') fail('attempt.reason must be a string');
  const scope = source.scope ?? context.scope ?? null;
  if (scope !== null && typeof scope !== 'string') fail('attempt.scope must be a string');
  if (source.observed_posts !== undefined && (!Number.isSafeInteger(source.observed_posts) || source.observed_posts < 0)) fail('attempt.observed_posts must be a nonnegative integer');
  return {
    handle: author, status,
    attempted_at: timestamp(source.attempted_at ?? context.collected_at, 'attempt.attempted_at'),
    query_url: source.query_url ? xUrl(source.query_url, 'attempt.query_url').href : null,
    queried: source.queried ?? ['successful', 'no_results'].includes(status),
    scope, observed_posts: source.observed_posts ?? null,
    full_post_extraction_complete: source.full_post_extraction_complete === true,
    reason: source.reason ?? '',
    raw: source.raw ?? source,
  };
}
function canonical(value, omitObservationTimes = false) {
  if (Array.isArray(value)) return value.map((entry) => canonical(entry, omitObservationTimes));
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter((key) => !(omitObservationTimes && OBSERVATION_TIMES.has(key))).map((key) => [key, canonical(value[key], omitObservationTimes)]));
  return value;
}
function fingerprint(post) {
  const { schema_version, record_key, ingested_at, ...content } = post;
  return JSON.stringify(canonical(content, true));
}
export function latestPosts(records) {
  const latest = new Map();
  for (const record of records) latest.set(recordKey(record), record);
  return [...latest.values()];
}
function postChain(post) {
  const result = [];
  for (let current = post; current && result.length < 5; current = current.original) result.push(current);
  return result;
}
function rowNativeVideos(post) {
  const explicit = (source) => {
    if (!source) return [];
    const items = Array.isArray(source.videos) ? source.videos : [];
    if (items.length) return items;
    return source.video_url ? [{ url: source.video_url }] : [];
  };
  const chain = postChain(post);
  const items = chain.flatMap(explicit);
  // Propagated has_video does not invent unresolved media on an enclosing
  // repost/quote when a nested native or YouTube player accounts for it.
  for (let index = 0; index < chain.length; index++) {
    const node = chain[index];
    if (node.has_video && !explicit(node).length && !node.youtube_id &&
      !chain.slice(index + 1).some(child => explicit(child).length || child.youtube_id)) items.push({ url: null });
  }
  return items;
}
export function buildReceipt(handles, records, attempts, generatedAt = new Date().toISOString()) {
  const latest = latestPosts(records), lastAttempt = new Map();
  const queried = new Set();
  for (const attempt of attempts) {
    const key = attempt.handle.toLowerCase();
    if (attempt.queried) queried.add(key);
    const prior = lastAttempt.get(key);
    if (!prior || attempt.attempted_at >= prior.attempted_at) lastAttempt.set(key, attempt);
  }
  const handleStatuses = handles.map((author) => {
    const attempt = lastAttempt.get(author.toLowerCase());
    return { handle: author, status: attempt?.status ?? 'unattempted', queried: queried.has(author.toLowerCase()), attempted_at: attempt?.attempted_at ?? null, query_url: attempt?.query_url ?? null, scope: attempt?.scope ?? null, observed_posts: attempt?.observed_posts ?? null, full_post_extraction_complete: attempt?.full_post_extraction_complete === true, reason: attempt?.reason ?? '' };
  });
  const count = (status) => handleStatuses.filter((item) => item.status === status).length;
  const videoRows = latest.filter((post) => post.has_video || post.video_url || post.videos?.length || post.youtube_id || post.original?.has_video || post.original?.videos?.length || post.original?.video_url || post.original?.youtube_id);
  const nativeVideoRows = videoRows.map((post) => ({ post, items: rowNativeVideos(post) })).filter(({ items }) => items.length);
  const resolvedNative = nativeVideoRows.filter(({ items, post }) => items.some((item) => item.url) || post.video_url || post.original?.video_url);
  const unresolvedNative = nativeVideoRows.filter(({ items }) => items.some((item) => !item.url));
  const youtubeRows = latest.filter((post) => postChain(post).some(node => node.youtube_id));
  const linksPerPost = latest.reduce((sum, post) => sum + new Set(postChain(post).flatMap(node => node.links ?? []).map((link) => link.url)).size, 0);
  const complete = handles.length > 0 && handleStatuses.every((item) => ['successful', 'no_results'].includes(item.status) && item.full_post_extraction_complete);
  const collectionScopes = [...new Set(handleStatuses.map((item) => item.scope).filter(Boolean))];
  const latestPageCollection = collectionScopes.includes('latest_page_per_handle');
  const retainedAttemptTimes = handleStatuses.map((item) => {
    if (item.status === 'unattempted' || !item.attempted_at) return null;
    try { return timestamp(item.attempted_at, 'attempt.attempted_at'); } catch { return null; }
  });
  const attemptTimeEvidenceComplete = retainedAttemptTimes.length > 0 && retainedAttemptTimes.every(Boolean);
  const sortedAttemptTimes = attemptTimeEvidenceComplete ? retainedAttemptTimes.sort() : [];
  return {
    schema_version: 1, generated_at: timestamp(generatedAt, 'generated_at'),
    collected_at: sortedAttemptTimes.at(-1) ?? null,
    collection_started_at: sortedAttemptTimes[0] ?? null,
    collection_time_basis: attemptTimeEvidenceComplete ? 'retained_per_handle_attempts' : null,
    status: complete ? 'complete' : 'incomplete',
    first_pass_complete: complete,
    query_pass_complete: handles.length > 0 && handleStatuses.every((item) => ['successful', 'no_results'].includes(item.status)),
    handles_total: handles.length,
    handles_attempted: handles.length - count('unattempted'),
    handles_queried: handleStatuses.filter((item) => item.queried).length,
    handles_successful: count('successful'), handles_no_results: count('no_results'),
    handles_blocked: count('blocked'), handles_failed: count('failed'), handles_unattempted: count('unattempted'),
    query_attempts: attempts.length,
    collection_scopes: collectionScopes,
    ...(latestPageCollection ? {
      completion_scope: 'first_returned_latest_search_page_per_handle',
      source_completeness: 'First returned Latest search page per queried handle (up to 20 results). Available full text, quote data, and media were extracted from SearchTimeline; selected real post pages were checked.',
      collection_method: {
        search_pages_per_handle: 1, max_results_per_handle: 20, paginated: false,
        text_source: 'SearchTimeline, including full note_tweet text when present',
        post_detail_verification: 'selected_post_pages_only',
        history_coverage: 'not_established', repost_coverage: 'not_established',
      },
    } : {}),
    posts_kept: latest.length, ledger_events: records.length,
    video_posts: videoRows.length, native_video_posts: nativeVideoRows.length,
    videos_resolved: resolvedNative.length,
    videos_still_missing: unresolvedNative.length,
    youtube_ids: youtubeRows.length, outbound_links: linksPerPost,
    rows_by_kind: Object.fromEntries([...KINDS].map((kind) => [kind, latest.filter((post) => post.kind === kind).length])),
    earliest_post_at: latest.length ? latest.map((post) => post.created_at).sort()[0] : null,
    latest_post_at: latest.length ? latest.map((post) => post.created_at).sort().at(-1) : null,
    handles: handleStatuses,
    limitations: latestPageCollection ? [
      'Only the first returned Latest search page was collected for each queried handle; older pages were not paginated.',
      'Text and media came from SearchTimeline, with selected post-page checks rather than a separate detail-page visit for every row.',
      'Repost coverage is not established by Latest search results; zero repost rows does not mean the accounts made no reposts.',
      'Resolved video counts indicate extracted file URLs; they do not certify every file\'s playback.',
    ] : [
      'Counts describe imported posts and actual query attempts within their recorded scopes.',
      'Resolved video counts indicate extracted file URLs; they do not certify every file\'s playback.',
    ],
  };
}
async function readJsonl(path) {
  let text;
  try { text = await readFile(path, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return { text: '', records: [] }; throw error; }
  const records = text.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => {
    try { return JSON.parse(line); } catch { fail(`${path}: invalid JSONL record ${index + 1}`); }
  });
  return { text, records };
}
async function appendRecords(path, existingText, rows) {
  if (!rows.length) return;
  await appendFile(path, `${existingText && !existingText.endsWith('\n') ? '\n' : ''}${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
}
export async function ingest({ inputPath, dataDir, handlesPath = join(dataDir, 'HANDLES_TRADING.txt'), now = new Date().toISOString() }) {
  const input = object(JSON.parse(await readFile(inputPath, 'utf8')), 'input');
  if (!Array.isArray(input.posts) || !Array.isArray(input.attempts)) fail('input must contain posts and attempts arrays, even when empty');
  const handles = (await readFile(handlesPath, 'utf8')).split(/\r?\n/).filter(Boolean).map((value) => handle(value));
  if (!handles.length || new Set(handles.map((value) => value.toLowerCase())).size !== handles.length) fail('handle list must be nonempty and contain no duplicates');
  if (input.collected_at != null) timestamp(input.collected_at, 'collected_at');
  if (input.source != null && typeof input.source !== 'string') fail('input.source must be a descriptive string');
  const context = { handles, collected_at: input.collected_at, source: input.source, scope: input.scope };
  // Validate the entire import before opening any ledger or writing any records.
  const posts = input.posts.map((post) => normalizePost(post, context));
  const attempts = input.attempts.map((attempt) => normalizeAttempt(attempt, context));
  const importedAt = timestamp(now, 'ingested_at');
  await mkdir(dataDir, { recursive: true });
  const lockPath = join(dataDir, '.ingest.lock');
  let lock;
  try { lock = await open(lockPath, 'wx'); } catch (error) { if (error.code === 'EEXIST') fail('another import holds .ingest.lock; do not run concurrent imports'); throw error; }
  try {
    const ledgerPath = join(dataDir, 'ledger.jsonl'), attemptsPath = join(dataDir, 'query-attempts.jsonl');
    const ledger = await readJsonl(ledgerPath), audit = await readJsonl(attemptsPath);
    const latest = new Map(latestPosts(ledger.records).map((post) => [recordKey(post), post]));
    const appended = [];
    for (const post of posts) {
      const key = recordKey(post), prior = latest.get(key);
      if (prior && fingerprint(prior) === fingerprint(post)) continue;
      const event = { schema_version: 1, record_key: key, ingested_at: importedAt, ...post };
      appended.push(event); latest.set(key, event);
    }
    const attemptKeys = new Set(audit.records.map((attempt) => JSON.stringify(canonical(attempt))));
    const addedAttempts = [];
    for (const attempt of attempts) {
      const key = JSON.stringify(canonical(attempt));
      if (!attemptKeys.has(key)) { attemptKeys.add(key); addedAttempts.push(attempt); }
    }
    const receipt = buildReceipt(handles, [...ledger.records, ...appended], [...audit.records, ...addedAttempts], importedAt);
    await appendRecords(ledgerPath, ledger.text, appended);
    await appendRecords(attemptsPath, audit.text, addedAttempts);
    // An empty ledger is meaningful after an explicit attempted import, not a seed dataset.
    if (!ledger.records.length && !appended.length) await appendFile(ledgerPath, '', 'utf8');
    const receiptPath = join(dataDir, 'receipt.json'), temporary = `${receiptPath}.${process.pid}.tmp`;
    try { await writeFile(temporary, `${JSON.stringify(receipt, null, 2)}\n`); await rename(temporary, receiptPath); }
    finally { await unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error; }); }
    return { posts_received: posts.length, ledger_events_appended: appended.length, unchanged_posts: posts.length - appended.length, attempts_appended: addedAttempts.length, receipt };
  } finally { await lock.close(); await unlink(lockPath); }
}
function usage() {
  return 'Usage: node scripts/xfeed-ingest.mjs --input <browser-extraction.json> [--data-dir xfeed/data] [--handles <HANDLES_TRADING.txt>]';
}
async function main(args) {
  if (args.includes('--help')) { process.stdout.write(`${usage()}\n`); return; }
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--input', '--data-dir', '--handles'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) fail(usage());
    if (options[args[i]]) fail(`duplicate option ${args[i]}`);
    options[args[i]] = args[i + 1];
  }
  if (!options['--input']) fail(usage());
  const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const result = await ingest({ inputPath: resolve(options['--input']), dataDir: resolve(options['--data-dir'] ?? join(repositoryRoot, 'xfeed/data')), ...(options['--handles'] ? { handlesPath: resolve(options['--handles']) } : {}) });
  const { receipt, ...counts } = result;
  process.stdout.write(`${JSON.stringify({ ...counts, posts_kept: receipt.posts_kept, handles_attempted: receipt.handles_attempted, handles_unattempted: receipt.handles_unattempted, status: receipt.status }, null, 2)}\n`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch((error) => { process.stderr.write(`Xfeed import failed: ${error.message}\n`); process.exitCode = 1; });

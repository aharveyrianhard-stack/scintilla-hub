const KINDS = new Set(['original', 'reply', 'quote', 'repost']);
const HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const POST_ID = /^\d{1,30}$/;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function safeUrl(value, { media = false } = {}) {
  if (typeof value !== 'string' || /[\u0000-\u0020\u007f]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || !url.hostname) return null;
    if (media ? url.protocol !== 'https:' : !['https:', 'http:'].includes(url.protocol)) return null;
    return url.href;
  } catch { return null; }
}

export function validDate(value) {
  if (typeof value !== 'string') return null;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts) return null;
  const [, year, month, day, hour, minute, second = '0', zone] = parts;
  const days = new Date(Date.UTC(+year, +month, 0)).getUTCDate();
  if (+month < 1 || +month > 12 || +day < 1 || +day > days || +hour > 23 || +minute > 59 || +second > 59) return null;
  if (zone !== 'Z' && (+zone.slice(1, 3) > 23 || +zone.slice(4) > 59)) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function youtubeId(value) {
  return typeof value === 'string' && YOUTUBE_ID.test(value) ? value : null;
}

export function youtubeIdFromUrl(value) {
  const safe = safeUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  const host = url.hostname.toLowerCase();
  if (host === 'youtu.be' || host === 'www.youtu.be') return youtubeId(url.pathname.split('/')[1]);
  if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host)) return null;
  if (url.pathname === '/watch') return youtubeId(url.searchParams.get('v'));
  if (/^\/(embed|shorts|live)\//.test(url.pathname)) return youtubeId(url.pathname.split('/')[2]);
  return null;
}

function plain(value) { return typeof value === 'string' ? value : ''; }

function normalizeMedia(raw) {
  const photos = [];
  for (const photo of Array.isArray(raw.photos) ? raw.photos : []) {
    const url = safeUrl(typeof photo === 'string' ? photo : photo?.url, { media: true });
    if (url && !photos.some(item => item.url === url)) photos.push({ url, alt: plain(photo?.alt) });
  }
  const links = [];
  for (const link of Array.isArray(raw.links) ? raw.links : []) {
    const url = safeUrl(typeof link === 'string' ? link : link?.url);
    if (url && !links.some(item => item.url === url)) links.push({ url, title: plain(link?.title) });
  }
  const videos = [];
  for (const entry of Array.isArray(raw.videos) ? raw.videos : []) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const url = safeUrl(entry.url, { media: true });
    if (!url || !videos.some(video => video.url === url)) videos.push({ url, poster: safeUrl(entry.poster, { media: true }), alt: plain(entry.alt) });
  }
  const legacyVideo = safeUrl(raw.video_url, { media: true });
  if (legacyVideo && !videos.some(video => video.url === legacyVideo)) videos.push({ url: legacyVideo, poster: null, alt: '' });
  const video_url = videos.find(video => video.url)?.url || null;
  const youtube_id = youtubeId(raw.youtube_id) || links.map(link => youtubeIdFromUrl(link.url)).find(Boolean) || null;
  return { photos, links, videos, video_url, youtube_id, has_video: raw.has_video === true || !!videos.length || !!youtube_id };
}

function normalizeOriginal(raw, depth = 1) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || depth > 4) return null;
  const handle = plain(raw.handle).replace(/^@/, '');
  const id = plain(raw.id);
  const media = normalizeMedia(raw);
  const original = depth < 4 ? normalizeOriginal(raw.original, depth + 1) : null;
  return {
    handle: HANDLE.test(handle) ? handle : '',
    id: POST_ID.test(id) ? id : '',
    kind: KINDS.has(raw.kind) ? raw.kind : 'original',
    url: safeUrl(raw.url), created_at: validDate(raw.created_at), text: plain(raw.text),
    ...media, has_video: media.has_video || !!original?.has_video,
    original, original_truncated: depth === 4 && !!raw.original,
  };
}

export function postSources(post) {
  const result = [];
  let source = post;
  for (let depth = 0; source && depth <= 4; depth++, source = source.original) result.push({ source, depth });
  return result;
}

export function normalizePost(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = typeof raw.id === 'string' ? raw.id : '';
  const handle = typeof raw.handle === 'string' ? raw.handle.replace(/^@/, '') : '';
  const created_at = validDate(raw.created_at);
  if (!POST_ID.test(id) || !HANDLE.test(handle) || !created_at || !KINDS.has(raw.kind)) return null;
  const original = normalizeOriginal(raw.original);
  const media = normalizeMedia(raw);
  return {
    id, handle, created_at, kind: raw.kind, text: plain(raw.text),
    record_key: raw.kind === 'repost' ? 'repost:' + handle.toLowerCase() + ':' + id : 'post:' + id,
    url: safeUrl(raw.url), ...media, has_video: media.has_video || !!original?.has_video, original,
    provenance: raw.provenance ?? null,
  };
}

export function parseLedger(source) {
  const versions = new Map();
  let invalid = 0;
  let duplicates = 0;
  for (const line of String(source).split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const post = normalizePost(JSON.parse(line));
      if (!post) { invalid++; continue; }
      if (versions.has(post.record_key)) duplicates++;
      versions.set(post.record_key, post);
    } catch { invalid++; }
  }
  const posts = [...versions.values()].sort((a, b) => {
    const time = Date.parse(b.created_at) - Date.parse(a.created_at);
    return time || b.id.length - a.id.length || b.id.localeCompare(a.id);
  });
  return { posts, invalid, duplicates };
}

export function mediaFor(post) {
  const sources = postSources(post);
  const videos = [];
  const youtube_videos = [];
  const addDistinct = (items, item, key) => {
    const index = item[key] ? items.findIndex(existing => existing[key] === item[key]) : -1;
    if (index < 0) items.push(item);
    else if (sources[items[index].depth]?.source.kind === 'repost' && item.depth > items[index].depth) items[index] = item;
  };
  for (const { source, depth } of sources) {
    const origin = { original: depth > 0, handle: source.handle, depth };
    for (const video of source.videos) {
      addDistinct(videos, { ...video, ...origin }, 'url');
    }
    // Legacy has_video can be inherited from an original post; do not invent an
    // additional unresolved own video when the original already explains it.
    if (!source.videos.length && source.has_video && !source.youtube_id && !source.original?.has_video) {
      videos.push({ url: null, poster: null, alt: '', ...origin });
    }
    if (source.youtube_id) addDistinct(youtube_videos, { id: source.youtube_id, ...origin }, 'id');
  }
  const photos = [...new Map(sources.flatMap(({ source, depth }) => source.photos.map(photo => ({ ...photo, depth, handle: source.handle, original: depth > 0 }))).map(photo => [photo.url, photo])).values()];
  return {
    video_url: videos.find(video => video.url)?.url || null,
    youtube_id: youtube_videos[0]?.id || null,
    videos,
    youtube_videos,
    has_video: sources.some(({ source }) => source.has_video),
    photos,
    originalMedia: sources.some(({ source, depth }) => depth > 0 && (source.videos.length || source.youtube_id || source.photos.length || source.has_video)),
  };
}

export function filterPosts(posts, view, notifications = null) {
  if (view === 'notifications') {
    if (notifications?.status !== 'configured') return [];
    const members = new Set(notifications.handles.map(handle => handle.toLowerCase()));
    return posts.filter(post => members.has(post.handle.toLowerCase()));
  }
  if (view === 'video') return posts.filter(post => mediaFor(post).has_video);
  return posts;
}

export function ledgerCounts(posts) {
  const media = posts.map(mediaFor);
  return {
    posts_kept: posts.length,
    videos_resolved: media.filter(item => item.videos.some(video => video.url)).length,
    videos_missing: media.filter(item => item.videos.some(video => !video.url)).length,
    youtube_ids: media.filter(item => item.youtube_videos.length).length,
    outbound_links: posts.reduce((total, post) => total + new Set(postSources(post).flatMap(({ source }) => source.links).map(link => link.url)).size, 0),
  };
}

const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;

function tradingHandles(receipt) {
  if (!Array.isArray(receipt.handles)) return null;
  const handles = receipt.handles.map(item => typeof item === 'string' ? item : item?.handle);
  if (handles.some(handle => typeof handle !== 'string' || !HANDLE.test(handle))) return null;
  const unique = [...new Set(handles.map(handle => handle.toLowerCase()))];
  if (count(receipt.handles_total) !== null && unique.length !== receipt.handles_total) return null;
  return unique;
}

export function normalizeNotifications(raw, universe = null) {
  const missing = reason => ({ status: 'unconfigured', handles: [], source: '', updated_at: null, reason });
  if (!raw || raw.status !== 'configured') return missing('Notification membership has not been configured.');
  if (!Array.isArray(universe)) return missing('Notification membership cannot be verified against the trading list.');
  if (!Array.isArray(raw.handles) || raw.handles.some(handle => typeof handle !== 'string' || !HANDLE.test(handle))) return missing('The notification membership configuration is invalid.');
  const allowed = new Set(universe.map(handle => handle.toLowerCase()));
  const handles = [...new Set(raw.handles.map(handle => handle.toLowerCase()))];
  if (handles.some(handle => !allowed.has(handle))) return missing('The notification membership configuration includes a handle outside the trading list.');
  return { status: 'configured', handles, source: plain(raw.source), updated_at: validDate(raw.updated_at), reason: '' };
}

export function normalizeReceipt(raw, posts = []) {
  const receipt = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    handles_queried: count(receipt.handles_queried),
    handles_total: count(receipt.handles_total),
    handles_no_results: count(receipt.handles_no_results),
    handles_blocked: count(receipt.handles_blocked),
    handles_failed: count(receipt.handles_failed),
    handles_unattempted: count(receipt.handles_unattempted),
    trading_handles: tradingHandles(receipt),
    collected_at: validDate(receipt.collected_at),
    generated_at: validDate(receipt.generated_at),
    status: plain(receipt.status) || 'Collection status unavailable',
    source_completeness: receipt.source_completeness ?? null,
    source_receipt: receipt.source_receipt && typeof receipt.source_receipt === 'object' && !Array.isArray(receipt.source_receipt) ? receipt.source_receipt : null,
    collection_scopes: Array.isArray(receipt.collection_scopes) ? [...new Set(receipt.collection_scopes.filter(scope => typeof scope === 'string' && scope.trim()))] : [],
    first_pass_complete: typeof receipt.first_pass_complete === 'boolean' ? receipt.first_pass_complete : null,
    query_pass_complete: typeof receipt.query_pass_complete === 'boolean' ? receipt.query_pass_complete : null,
    notes: Array.isArray(receipt.notes) ? receipt.notes.filter(note => typeof note === 'string') : plain(receipt.notes),
    limitations: Array.isArray(receipt.limitations) ? receipt.limitations.filter(note => typeof note === 'string') : [],
    collector_status: ['running', 'idle', 'error', 'unconfigured'].includes(receipt.collector_status) ? receipt.collector_status : 'unconfigured',
    collector_error: plain(receipt.collector_error),
    collector_retry_at: validDate(receipt.collector_retry_at),
    collector_heartbeat_at: validDate(receipt.collector_heartbeat_at),
    latest_source_event_at: validDate(receipt.latest_source_event_at),
    stale_after_seconds: Number.isSafeInteger(receipt.stale_after_seconds) && receipt.stale_after_seconds >= 30 && receipt.stale_after_seconds <= 86400 ? receipt.stale_after_seconds : 180,
    ...ledgerCounts(posts),
  };
}

export function normalizeSnapshot(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.posts) || !raw.receipt || typeof raw.receipt !== 'object') throw new Error('The feed response does not contain a valid snapshot.');
  const versions = new Map();
  let duplicates = 0;
  for (const item of raw.posts) {
    const post = normalizePost(item);
    if (!post) throw new Error('The feed response contains an invalid post.');
    if (versions.has(post.record_key)) duplicates++;
    versions.set(post.record_key, post);
  }
  const posts = [...versions.values()].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id.length - a.id.length || b.id.localeCompare(a.id));
  if (count(raw.receipt.posts_kept) !== null && raw.receipt.posts_kept !== posts.length) throw new Error('The feed response and its receipt disagree on the post count.');
  const parsed = { posts, invalid: 0, duplicates };
  const receipt = normalizeReceipt(raw.receipt, posts);
  return { parsed, receipt, rawReceipt: raw.receipt, notifications: normalizeNotifications(raw.notifications, receipt.trading_handles) };
}

function postContent(post) {
  const { provenance, ...content } = post;
  return JSON.stringify(content);
}

export function snapshotDifference(current, incoming) {
  const before = new Map(current.map(post => [post.record_key, post]));
  const after = new Map(incoming.map(post => [post.record_key, post]));
  const added = incoming.filter(post => !before.has(post.record_key));
  const amended = incoming.filter(post => before.has(post.record_key) && postContent(before.get(post.record_key)) !== postContent(post));
  const removed = current.filter(post => !after.has(post.record_key));
  return { added, amended, removed, changed: !!(added.length || amended.length || removed.length) };
}

export function shouldApplySnapshot({ atTop, mediaOpen, focusedInTape, selectingText, receiptOpen }) {
  return atTop && !mediaOpen && !focusedInTape && !selectingText && !receiptOpen;
}

export function freshness({ source, receipt, now = Date.now(), error = '', refreshing = false }) {
  if (!receipt) return { state: error ? 'error' : 'loading', text: error || 'Connecting to feed…' };
  const collected = receipt.collected_at ? formatET(receipt.collected_at) : 'collection time unavailable';
  if (source === 'static') return { state: 'snapshot', text: 'Static snapshot · ' + collected + ' · collector unavailable' };
  const heartbeat = receipt.collector_heartbeat_at ? formatET(receipt.collector_heartbeat_at) : 'unavailable';
  // A failed or silent collector is said in words, with the last good source time. Never a quiet stale list.
  const lastGood = receipt.latest_source_event_at ? ' · last good source ' + formatET(receipt.latest_source_event_at) : ' · no good source pass on record';
  const reason = receipt.collector_error ? ' · ' + (receipt.collector_error.length > 140 ? receipt.collector_error.slice(0, 139) + '…' : receipt.collector_error) : '';
  if (error) return { state: 'error', text: 'Refresh failed · showing saved posts · last collector heartbeat ' + heartbeat };
  if (receipt.collector_status === 'unconfigured' || !receipt.collector_heartbeat_at) return { state: 'unconfigured', text: 'Collector unconfigured · last heartbeat ' + heartbeat + lastGood };
  if (receipt.collector_status === 'error') return { state: 'error', text: 'Collector down since ' + heartbeat + reason + lastGood };
  if (now - Date.parse(receipt.collector_heartbeat_at) > receipt.stale_after_seconds * 1000 || Date.parse(receipt.collector_heartbeat_at) > now + 60000) return { state: 'stale', text: 'Collector silent · no run since ' + heartbeat + lastGood };
  return { state: 'updated', text: 'Feed checked ' + heartbeat + (refreshing ? ' · checking…' : ' · checks every 30s') };
}

export function formatET(iso, dayOnly = false) {
  const date = validDate(iso);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: 'short', day: 'numeric',
    ...(dayOnly ? {} : { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }),
  }).format(new Date(date));
}

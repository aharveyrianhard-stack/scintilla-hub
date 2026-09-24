/** Pure extraction of observed public X GraphQL content. No requests or credentials. */
import { timestamp, recordKey } from './xfeed-ingest.mjs';

export const TRADING_LIST_ID = '1405188850188759047';
const HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const ID = /^[1-9][0-9]{0,19}$/;
const own = (o, keys) => Object.fromEntries(keys.filter(k => o?.[k] !== undefined).map(k => [k, o[k]]));
const array = value => Array.isArray(value) ? value : [];
const validId = value => typeof value === 'string' && ID.test(value);
function safeUrl(value, media = false) {
  try { const u = new URL(value); return (media ? u.protocol === 'https:' : ['https:', 'http:'].includes(u.protocol)) && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export function sourceUrl(value, type) {
  const normalized = safeUrl(value, true), u = normalized && new URL(normalized);
  if (!u || !['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(u.hostname)) throw new Error('source_url must be an HTTPS X source');
  if (['list', 'members'].includes(type) && u.pathname.replace(/\/$/, '') !== `/i/lists/${TRADING_LIST_ID}${type === 'members' ? '/members' : ''}`) throw new Error('source_url must identify the configured Trading list');
  if (type === 'detail' && !/^\/(?:[A-Za-z0-9_]{1,15}|i\/web)\/status\/[1-9][0-9]{0,19}\/?$/.test(u.pathname)) throw new Error('detail source_url must identify one actual post');
  if (type === 'search' && u.pathname !== '/search') throw new Error('search source_url must identify X search');
  u.hash = ''; return u.href;
}
export function rateHeaders(value = {}) {
  const result = {};
  for (const [key, v] of Object.entries(value ?? {})) {
    const name = key.toLowerCase();
    if (['x-rate-limit-limit', 'x-rate-limit-remaining', 'x-rate-limit-reset', 'retry-after'].includes(name) && /^(?:0|[1-9][0-9]*)$/.test(String(v))) result[name] = String(v);
  }
  return result;
}
function responseMetadata(input) {
  const keys = ['response_id', 'request_cursor', 'response_chunk_index', 'response_chunk_count'];
  if (!keys.some(key => Object.hasOwn(input, key))) return null;
  if (typeof input.response_id !== 'string' || !/^[A-Za-z0-9_.:-]{1,128}$/.test(input.response_id) || ['__proto__', 'constructor', 'prototype'].includes(input.response_id)) throw new Error('response metadata requires a stable response_id');
  const index = input.response_chunk_index, count = input.response_chunk_count;
  if (!Number.isSafeInteger(count) || count < 1 || count > 10000 || !Number.isSafeInteger(index) || index < 0 || index >= count) throw new Error('response chunks require zero-based index and positive count');
  if (Object.hasOwn(input, 'request_cursor') && input.request_cursor !== null && (typeof input.request_cursor !== 'string' || input.request_cursor.length > 20000)) throw new Error('request_cursor must be the observed string or explicit null for the first page');
  return { response_id: input.response_id, response_chunk_index: index, response_chunk_count: count, ...(Object.hasOwn(input, 'request_cursor') ? { request_cursor: input.request_cursor } : {}) };
}
function decodeLegacy(text) {
  return text.replace(/&(?:amp|lt|gt|quot|apos|#(?:[0-9]+|x[0-9a-f]+));/gi, value => {
    const entity = value.slice(1, -1).toLowerCase(), common = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (common[entity]) return common[entity];
    const n = entity[1] === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : value;
  });
}
function publicMedia(m) {
  const result = own(m, ['id_str', 'media_key', 'type', 'ext_alt_text', 'indices', 'original_info', 'sizes']);
  for (const k of ['media_url_https', 'url', 'expanded_url']) if (safeUrl(m?.[k], true)) result[k] = safeUrl(m[k], true);
  if (m?.video_info) result.video_info = {
    ...own(m.video_info, ['aspect_ratio', 'duration_millis']),
    variants: array(m.video_info.variants).filter(v => safeUrl(v?.url, true)).map(v => ({ ...own(v, ['bitrate', 'content_type']), url: safeUrl(v.url, true) })),
  };
  return result;
}
function publicEntities(e = {}) {
  return {
    urls: array(e.urls).map(x => ({ ...own(x, ['display_url', 'indices']), ...Object.fromEntries(['url', 'expanded_url', 'unwound_url'].filter(k => safeUrl(x?.[k])).map(k => [k, safeUrl(x[k])])) })),
    hashtags: array(e.hashtags).map(x => own(x, ['text', 'indices'])),
    symbols: array(e.symbols).map(x => own(x, ['text', 'indices'])),
    user_mentions: array(e.user_mentions).map(x => own(x, ['id_str', 'screen_name', 'name', 'indices'])),
    media: array(e.media).map(publicMedia),
  };
}
function publicCard(card) {
  const c = card?.legacy;
  if (!c) return null;
  // Poll results and article/video card metadata are public. Viewer/user objects are omitted.
  const binding_values = array(c.binding_values).map(b => ({ key: b.key, value: {
    ...own(b.value, ['type', 'string_value', 'boolean_value', 'scribe_key']),
    ...(b.value?.image_value ? { image_value: own(b.value.image_value, ['url', 'width', 'height', 'alt']) } : {}),
  } })).filter(b => typeof b.key === 'string');
  return { legacy: { ...own(c, ['name', 'url']), binding_values } };
}
export function unwrapTweet(value) {
  for (let i = 0; value && i < 4; i++) {
    if (value.legacy && value.rest_id) return value;
    if (value.tweet) value = value.tweet;
    else if (value.result) value = value.result;
    else break;
  }
  return value;
}
function rawPublic(t, user) {
  const l = t.legacy, note = t.note_tweet?.note_tweet_results?.result;
  const legacy = own(l, ['id_str', 'created_at', 'full_text', 'display_text_range', 'conversation_id_str', 'user_id_str', 'in_reply_to_status_id_str', 'in_reply_to_user_id_str', 'in_reply_to_screen_name', 'is_quote_status', 'quoted_status_id_str', 'lang', 'possibly_sensitive', 'favorite_count', 'reply_count', 'retweet_count', 'quote_count', 'bookmark_count']);
  legacy.entities = publicEntities(l.entities);
  if (l.extended_entities) legacy.extended_entities = { media: array(l.extended_entities.media).map(publicMedia) };
  if (l.quoted_status_permalink) legacy.quoted_status_permalink = own(l.quoted_status_permalink, ['url', 'expanded', 'display']);
  return {
    rest_id: t.rest_id, legacy,
    author: { id: user?.rest_id ?? null, ...own(user?.core ?? user?.legacy, ['screen_name', 'name']) },
    note_tweet: note && typeof note.text === 'string' ? { note_tweet_results: { result: { text: note.text, entity_set: publicEntities(note.entity_set) } } } : null,
    ...(publicCard(t.card) ? { card: publicCard(t.card) } : {}),
  };
}
export function extractPost(value, { source_url, observed_at, method = 'ListLatestTweetsTimeline', issues = [] } = {}, depth = 0) {
  const t = unwrapTweet(value), l = t?.legacy, user = t?.core?.user_results?.result;
  const id = t?.rest_id, handle = user?.core?.screen_name ?? user?.legacy?.screen_name;
  if (!validId(id) || !HANDLE.test(handle ?? '') || !l?.created_at) { issues.push({ reason: 'post_unavailable_or_missing_identity', ...(validId(id) ? { id } : {}) }); return null; }
  if (user?.privacy?.protected === true || user?.legacy?.protected === true) { issues.push({ reason: 'protected_content_excluded', id }); return null; }
  const time = new Date(l.created_at);
  if (!Number.isFinite(time.getTime())) { issues.push({ reason: 'missing_actual_timestamp', id }); return null; }
  const note = t.note_tweet?.note_tweet_results?.result;
  if (typeof note?.text !== 'string' && typeof l.full_text !== 'string') { issues.push({ reason: 'missing_observed_text', id }); return null; }
  const media = array(l.extended_entities?.media?.length ? l.extended_entities.media : l.entities?.media);
  const photos = media.filter(m => m.type === 'photo' && safeUrl(m.media_url_https, true)).map(m => safeUrl(m.media_url_https, true));
  const videos = media.filter(m => ['video', 'animated_gif'].includes(m.type)).map(m => ({
    url: array(m.video_info?.variants).filter(v => v.content_type === 'video/mp4' && safeUrl(v.url, true)).sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0]?.url ?? null,
    poster: safeUrl(m.media_url_https, true), alt: typeof m.ext_alt_text === 'string' ? m.ext_alt_text : '',
  }));
  const binding = new Map(array(t.card?.legacy?.binding_values).filter(b => typeof b?.value?.string_value === 'string').map(b => [b.key, b.value.string_value]));
  const title = binding.get('title');
  const cardUrls = [t.card?.legacy?.url, ...['card_url', 'url', 'vanity_url'].map(key => binding.get(key))].map(v => safeUrl(v)).filter(Boolean);
  const links = [...new Map([...array(l.entities?.urls), ...array(note?.entity_set?.urls)].map(e => {
    const url = safeUrl(e.unwound_url ?? e.expanded_url ?? e.url);
    if (!url) return null;
    const matchesCard = [e.url, e.expanded_url, e.unwound_url].map(v => safeUrl(v)).some(v => v && cardUrls.includes(v));
    return [url, { url, title: matchesCard && title ? title : typeof e.display_url === 'string' ? e.display_url : '' }];
  }).filter(Boolean)).values()];
  const retweet = l.retweeted_status_result?.result ?? t.retweeted_status_result?.result;
  const quote = t.quoted_status_result?.result ?? l.quoted_status_result?.result;
  const kind = retweet ? 'repost' : l.is_quote_status === true ? 'quote' : l.in_reply_to_status_id_str ? 'reply' : 'original';
  let original = null;
  if ((retweet || quote) && depth < 4) original = extractPost(retweet ?? quote, { source_url, observed_at, method, issues }, depth + 1);
  if (kind === 'repost' && !original) { issues.push({ reason: 'repost_original_unavailable', id }); return null; }
  if (kind === 'quote' && !original) issues.push({ reason: quote && depth >= 4 ? 'nested_post_depth_limit' : 'quoted_post_unavailable', id, original_id: validId(l.quoted_status_id_str) ? l.quoted_status_id_str : null });
  if (t.note_tweet?.is_expandable === true && typeof note?.text !== 'string') issues.push({ reason: 'full_note_unavailable', id });
  if (videos.some(v => !v.url)) issues.push({ reason: 'native_video_file_unavailable', id });
  const post = {
    id, handle, created_at: time.toISOString(), kind,
    text: typeof note?.text === 'string' ? note.text : decodeLegacy(l.full_text),
    url: `https://x.com/${handle}/status/${id}`, photos, videos,
    video_url: videos.find(v => v.url)?.url ?? null, has_video: videos.length > 0 || Boolean(original?.has_video), links, original,
    provenance: { method, source_url, collected_at: observed_at, permalink_source: 'observed_author_and_post_id' },
    raw: { ...rawPublic(t, user), ...(original ? { original: original.raw } : {}) },
  };
  return post;
}
function instructions(payload, type) {
  const data = payload?.data;
  if (type === 'members') return data?.list?.members_timeline?.timeline?.instructions;
  if (type === 'list') return data?.list?.tweets_timeline?.timeline?.instructions;
  if (type === 'search') return data?.search_by_raw_query?.search_timeline?.timeline?.instructions;
  return data?.threaded_conversation_with_injections_v2?.instructions;
}
function itemsFromEntries(entries) {
  const result = [];
  for (const entry of entries) {
    const c = entry?.content ?? entry;
    if (c.itemContent) result.push({ entry, item: c.itemContent });
    for (const module of array(c.items)) {
      const item = module.item?.itemContent ?? module.itemContent;
      if (item) result.push({ entry: module, item });
    }
  }
  return result;
}
export function transformResponse(input) {
  if (!input || typeof input !== 'object' || !['list', 'members', 'detail', 'search'].includes(input.response_type)) throw new Error('unknown response_type');
  const type = input.response_type, source_url = sourceUrl(input.source_url, type), observed_at = timestamp(input.observed_at, 'observed_at');
  if (input.pass_id != null && (typeof input.pass_id !== 'string' || !/^[A-Za-z0-9_.-]{1,100}$/.test(input.pass_id))) throw new Error('invalid pass_id');
  const payload = input.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('payload must be the observed JSON response');
  const ins = instructions(payload, type), issues = [];
  const direct = type === 'detail' ? payload?.data?.tweetResult?.result ?? payload?.data?.tweet_result?.result : null;
  if (!Array.isArray(ins) && !direct && !array(payload.errors).length) throw new Error('payload has no recognized source timeline');
  for (const error of array(payload.errors)) issues.push({ reason: 'graphql_error', ...(Number.isInteger(error.code) ? { code: error.code } : {}) });
  const entries = array(ins).flatMap(i => [...array(i.entries), ...(i.entry ? [i.entry] : []), ...array(i.moduleItems).map(item => ({ content: item.item }))]);
  const items = itemsFromEntries(entries), posts = [], members = [];
  const method = { list: 'ListLatestTweetsTimeline', members: 'ListMembers', detail: 'TweetDetail', search: 'SearchTimeline' }[type];
  if (direct) items.push({ entry: {}, item: { tweet_results: { result: direct } } });
  const wantedId = type === 'detail' ? /\/status\/(\d+)/.exec(source_url)?.[1] : null;
  for (const { item } of items) {
    if (type === 'members') {
      const u = item.user_results?.result, handle = u?.core?.screen_name ?? u?.legacy?.screen_name;
      if (!HANDLE.test(handle ?? '')) continue;
      const flag = u?.notifications_settings?.notifications_enabled;
      members.push({ handle, id: validId(u?.rest_id) ? u.rest_id : null, notifications_enabled: typeof flag === 'boolean' ? flag : null });
      continue;
    }
    const raw = item.tweet_results?.result;
    if (!raw) continue;
    const t = unwrapTweet(raw);
    if (wantedId && t?.rest_id !== wantedId) continue;
    const isRepostContext = /retweet/i.test(item.socialContext?.contextType ?? item.socialContext?.type ?? '');
    if (isRepostContext && !t?.legacy?.retweeted_status_result && !t?.retweeted_status_result) { issues.push({ reason: 'repost_wrapper_identity_or_timestamp_unavailable', id: validId(t?.rest_id) ? t.rest_id : null }); continue; }
    const p = extractPost(raw, { source_url, observed_at, method, issues });
    if (p) posts.push(p);
  }
  const cursors = entries.filter(e => e.content?.cursorType).map(e => ({ type: e.content.cursorType, value: typeof e.content.value === 'string' ? e.content.value : null }));
  const byId = new Map(posts.map(p => [p.id, p]));
  const timeline_rows = type === 'list' ? entries.map(entry => {
    const rowPosts = itemsFromEntries([entry]).map(({ item }) => byId.get(unwrapTweet(item.tweet_results?.result)?.rest_id)).filter(Boolean);
    const latest = rowPosts.reduce((p, candidate) => !p || candidate.created_at > p.created_at ? candidate : p, null);
    // A newer reply can become the display anchor without removing its parent
    // from the observed module. Only immediate timeline items count here;
    // nested quoted/reposted originals are not source-window frontier proof.
    return latest ? { entry_id: typeof entry.entryId === 'string' ? entry.entryId : null, anchor_key: recordKey(latest), member_keys: [...new Set(rowPosts.map(recordKey))], latest_action_at: latest.created_at } : null;
  }).filter(Boolean) : [];
  return {
    schema_version: 1, response_type: type, source_url, observed_at, pass_id: input.pass_id ?? null,
    response_metadata: responseMetadata(input),
    source: { endpoint: method, ...(['list', 'members'].includes(type) ? { list_id: TRADING_LIST_ID } : {}) },
    posts: [...new Map(posts.map(p => [recordKey(p), p])).values()], members: [...new Map(members.map(m => [m.handle.toLowerCase(), m])).values()],
    cursors, timeline_rows, terminated_bottom: array(ins).some(i => i.type === 'TimelineTerminateTimeline' && i.direction === 'Bottom'),
    issues, rate_headers: rateHeaders(input.rate_headers), counts: { entries: entries.length, tweet_items: items.filter(i => i.item.tweet_results).length },
  };
}

export function verifyMembers(members, expectedHandles, observedAt) {
  const expected = new Map(expectedHandles.map(h => [h.toLowerCase(), h]));
  const actual = new Map(members.map(m => [m.handle.toLowerCase(), m]));
  const missing = [...expected.keys()].filter(h => !actual.has(h)).map(h => expected.get(h));
  const unexpected = [...actual.keys()].filter(h => !expected.has(h)).map(h => actual.get(h).handle);
  const unknown = [...actual.values()].filter(m => m.notifications_enabled === null).map(m => m.handle);
  const membershipVerified = missing.length === 0 && unexpected.length === 0 && actual.size === expected.size;
  const configured = membershipVerified && unknown.length === 0;
  return {
    status: configured ? 'configured' : 'unconfigured', handles: configured ? [...actual.values()].filter(m => m.notifications_enabled === true).map(m => expected.get(m.handle.toLowerCase())) : [],
    source: `Observed ListMembers notifications_settings.notifications_enabled for X list ${TRADING_LIST_ID}`,
    updated_at: observedAt, membership_verified: membershipVerified, expected_count: expected.size, observed_count: actual.size,
    enabled_count: [...actual.values()].filter(m => m.notifications_enabled === true).length, disabled_count: [...actual.values()].filter(m => m.notifications_enabled === false).length,
    missing_handles: missing, unexpected_handles: unexpected, unknown_handles: unknown,
  };
}

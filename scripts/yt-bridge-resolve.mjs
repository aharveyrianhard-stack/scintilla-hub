#!/usr/bin/env node
/** Y2 (5 Oct 2026) — the X accounts we hold → their YouTube channels → control/YOUTUBE_CHANNEL_BRIDGE.json.
 *
 * What it reads (no key, no sign-in, GET only):
 *   - xfeed/data/HANDLES_TRADING.txt  — the 126 accounts of Alan's X "Trading" list (the X feed's roster);
 *   - the published X feed (https://scintillahub.ai/api/xfeed, or --feed <file>) — the posts those accounts wrote;
 *   - optional --extra <file>: more handles, one per line (a paste of Grok Bot's list, or the full follow list);
 *   - public YouTube pages: youtube.com/@<handle>, the channel addresses and videos the accounts posted themselves.
 * The X follow list itself is NOT stored anywhere we can read; this is the list of accounts we hold.
 *
 * usage: node scripts/yt-bridge-resolve.mjs [--feed file] [--extra file] [--out control/YOUTUBE_CHANNEL_BRIDGE.json] [--live]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseChannelPage, parseWatchPage, parseLivePage, youtubeRefs, sameName, confidence, squash, FEED_CONFIDENCE, isChannelId }
  from '../supabase/functions/_shared/yt-bridge.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (name, fallback = null) => { const i = args.indexOf('--' + name); return i >= 0 ? (args[i + 1] ?? true) : fallback; };
const OUT = arg('out', join(ROOT, 'control/YOUTUBE_CHANNEL_BRIDGE.json'));
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const MAX_VIDEOS_PER_HANDLE = 8;
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

const pageCache = new Map();
async function page(url) {
  if (pageCache.has(url)) return pageCache.get(url);
  const job = (async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
        if (r.status === 404) return { status: 404, text: '' };
        if (r.ok) return { status: 200, text: await r.text() };
        if (attempt) return { status: r.status, text: '' };
      } catch (_) { if (attempt) return { status: 0, text: '' }; }
      await sleep(900);
    }
    return { status: 0, text: '' };
  })();
  pageCache.set(url, job);
  return job;
}
async function pool(items, size, work) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < items.length) { const i = next++; out[i] = await work(items[i], i); await sleep(120); }
  }));
  return out;
}

const roster = (await readFile(join(ROOT, 'xfeed/data/HANDLES_TRADING.txt'), 'utf8')).trim().split(/\r?\n/).map((h) => h.trim()).filter(Boolean);
const extraPath = arg('extra');
const extra = extraPath ? (await readFile(extraPath, 'utf8')).split(/[\s,]+/).map((h) => h.replace(/^@/, '').replace(/^https?:\/\/(?:x|twitter)\.com\//, '').trim()).filter((h) => /^[A-Za-z0-9_]{1,15}$/.test(h)) : [];
const handles = [...new Map([...roster, ...extra].map((h) => [h.toLowerCase(), h])).values()];

const feedPath = arg('feed');
let feed;
if (feedPath) feed = JSON.parse(await readFile(feedPath, 'utf8'));
else feed = await (await fetch('https://scintillahub.ai/api/xfeed', { redirect: 'follow', signal: AbortSignal.timeout(90000) })).json();
const posts = Array.isArray(feed.posts) ? feed.posts : [];

/* what each account posted ITSELF (a repost is somebody else's words and links) */
const own = new Map();
for (const post of posts) {
  if (post.kind === 'repost') continue;
  const key = String(post.handle || '').toLowerCase();
  if (!key) continue;
  const slot = own.get(key) || own.set(key, { posts: 0, channels: new Map(), videos: new Map() }).get(key);
  slot.posts++;
  const blob = [post.text || '', ...(Array.isArray(post.links) ? post.links.map((l) => l && l.url || '') : []),
    post.youtube_id ? 'https://youtu.be/' + post.youtube_id : ''].join(' ');
  const refs = youtubeRefs(blob);
  for (const c of new Set(refs.channels)) slot.channels.set(c, (slot.channels.get(c) || 0) + 1);
  for (const v of new Set(refs.videos)) slot.videos.set(v, (slot.videos.get(v) || 0) + 1);
}

async function channelOfVideo(videoId) {
  const r = await page('https://www.youtube.com/watch?v=' + videoId);
  return r.status === 200 ? parseWatchPage(r.text) : null;
}
function backlinks(html, xHandle) {
  const want = xHandle.toLowerCase();
  for (const m of String(html || '').matchAll(/(?:x|twitter)\.com(?:%2F|\/)([A-Za-z0-9_]{1,15})/gi)) if (m[1].toLowerCase() === want) return true;
  return false;
}

async function resolve(handle) {
  const key = handle.toLowerCase(), mine = own.get(key) || { posts: 0, channels: new Map(), videos: new Map() };
  const candidates = new Map(); // channel_id → { title, handle, evidence }
  const slot = (id, title, ytHandle) => {
    const s = candidates.get(id) || candidates.set(id, { title: '', handle: null, self_link: false, same_handle: false, backlink: false, own_videos_channel: 0, videos: [] }).get(id);
    if (title && !s.title) s.title = title; if (ytHandle && !s.handle) s.handle = ytHandle; return s;
  };
  // 1 · channel addresses the account posted itself
  for (const [ref] of [...mine.channels].sort((a, b) => b[1] - a[1]).slice(0, 4)) {
    const r = await page('https://www.youtube.com/' + ref);
    const c = r.status === 200 ? parseChannelPage(r.text) : null;
    if (c) { const s = slot(c.channel_id, c.title, c.handle); if (c.subscribers != null) s.subscribers = c.subscribers; s.self_link_ref = ref; s.self_link_count = mine.channels.get(ref);
      if (backlinks(r.text, handle)) s.backlink = true; }
  }
  // 2 · the videos the account posted itself → who owns them
  const vids = [...mine.videos].sort((a, b) => b[1] - a[1]).slice(0, MAX_VIDEOS_PER_HANDLE).map(([v]) => v);
  let ownTotal = 0;
  for (const v of vids) {
    const c = await channelOfVideo(v);
    if (!c) continue;
    ownTotal++; const s = slot(c.channel_id, c.title, null); s.own_videos_channel++; s.videos.push(v);
  }
  // 3 · the same name on YouTube
  const probe = await page('https://www.youtube.com/@' + handle);
  const sameHandle = probe.status === 200 ? parseChannelPage(probe.text) : null;
  if (sameHandle) { const s = slot(sameHandle.channel_id, sameHandle.title, sameHandle.handle || handle); s.same_handle = true; if (sameHandle.subscribers != null) s.subscribers = sameHandle.subscribers;
    if (backlinks(probe.text, handle)) s.backlink = true; }
  /* a channel the account linked to is "its own" only when the name agrees or it also posts that channel's videos —
     an account can link to somebody else's channel */
  let best = null;
  for (const [id, s] of candidates) {
    const ev = { self_link: !!s.self_link_ref, same_handle: s.same_handle, backlink: s.backlink,
      own_videos_channel: s.own_videos_channel, own_videos_total: ownTotal, subscribers: s.subscribers ?? null,
      name_match: sameName(handle, s.title, s.handle && squash(s.handle) !== squash(handle) ? s.handle : null) };
    const conf = confidence(ev), rank = { high: 3, medium: 2, low: 1 }[conf] * 100 + ev.own_videos_channel * 3 + (ev.self_link ? 2 : 0) + (ev.name_match ? 2 : 0) + (ev.same_handle ? 1 : 0);
    if (!best || rank > best.rank) best = { id, s, ev, conf, rank };
  }
  const base = { x_handle: handle, posts_held: mine.posts, youtube_links_in_own_posts: [...mine.videos.values()].reduce((a, b) => a + b, 0) + [...mine.channels.values()].reduce((a, b) => a + b, 0) };
  if (!best) return { ...base, channel_id: null, confidence: 'none', how_found: probe.status === 404 || probe.status === 200 ? 'no YouTube link in the posts we hold and no channel named @' + handle : 'not checked: youtube.com did not answer (' + probe.status + ')' };
  const how = [];
  if (best.ev.self_link) how.push('posted its own channel address (youtube.com/' + best.s.self_link_ref + ', ' + best.s.self_link_count + '×)');
  if (best.ev.own_videos_channel) how.push(best.ev.own_videos_channel + ' of the ' + ownTotal + ' videos it posted itself are from this channel');
  if (best.ev.same_handle) how.push('youtube.com/@' + handle + ' exists');
  if (best.ev.backlink) how.push('the channel page links back to x.com/' + handle);
  if (best.ev.name_match) how.push('the names match');
  if (best.ev.subscribers != null && best.ev.same_handle) how.push(best.ev.subscribers.toLocaleString('en-US') + ' subscribers');
  return { ...base, channel_id: best.id, channel_title: best.s.title, channel_handle: best.s.handle, channel_url: 'https://www.youtube.com/channel/' + best.id,
    confidence: best.conf, in_feed: FEED_CONFIDENCE.includes(best.conf), how_found: how.join(' · '), evidence: best.ev, sample_videos: best.s.videos.slice(0, 3),
    other_candidates: [...candidates].filter(([id]) => id !== best.id).map(([id, s]) => ({ channel_id: id, channel_title: s.title, own_videos: s.own_videos_channel })).slice(0, 4) };
}

const started = new Date().toISOString();
const rows = await pool(handles, 5, async (h, i) => { const r = await resolve(h); if ((i + 1) % 20 === 0) console.error('…' + (i + 1) + '/' + handles.length); return r; });

/* --live: is each matched channel on air now? (the same /live read the sweep does) */
if (args.includes('--live')) {
  await pool(rows.filter((r) => r.in_feed), 5, async (r) => {
    const p = await fetch('https://www.youtube.com/channel/' + r.channel_id + '/live', { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en' }, signal: AbortSignal.timeout(30000) }).then((x) => x.text()).catch(() => '');
    r.live_at_build = { ...parseLivePage(p), checked_at: new Date().toISOString() };
  });
}

const order = { high: 0, medium: 1, low: 2, none: 3 };
rows.sort((a, b) => order[a.confidence] - order[b.confidence] || squash(a.x_handle).localeCompare(squash(b.x_handle)));
const count = (c) => rows.filter((r) => r.confidence === c).length;
const out = {
  schema: 'scintilla.youtube_channel_bridge.v1',
  built_at: started,
  source: {
    accounts: 'the X "Trading" list roster (xfeed/data/HANDLES_TRADING.txt, ' + roster.length + ' handles)' + (extra.length ? ' + ' + extra.length + ' pasted handles' : ''),
    follow_list_stored: false,
    follow_list_note: "Alan's full X follow list is not stored anywhere we can read. The X feed captures one X list (id 1405188850188759047); its members are the accounts here.",
    posts: posts.length + ' posts in the published X feed, newest ' + (feed.receipt && feed.receipt.latest_post_at || 'unknown'),
    profile_text_stored: false,
    method: 'no key: public youtube.com pages only (the @handle page, the channel addresses and videos each account posted itself)',
  },
  counts: { accounts: rows.length, matched_in_feed: rows.filter((r) => r.in_feed).length, high: count('high'), medium: count('medium'), low_not_added: count('low'), none: count('none') },
  channels: rows,
};
if (!rows.every((r) => r.channel_id === null || isChannelId(r.channel_id))) throw new Error('a channel id failed validation');
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out.counts));

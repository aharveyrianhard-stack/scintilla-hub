#!/usr/bin/env node
/**
 * xfeed-bookmark-deep.mjs — read a bookmark folder PROPERLY: the whole thread, the quoted
 * post, every picture, and the pages and PDFs a post links to.
 *
 * Why it exists: the folder collector (xfeed-bookmarks.mjs) stores the post text only. It
 * keeps a picture's alt text and throws the picture away, so a chart posted as an image
 * reaches the desk as "ticker only". Alan asked for the visuals and the reports.
 *
 * What it never does: it does not bookmark, unbookmark, like, reply, post or click. It only
 * navigates and downloads with the collector's own signed-in profile, headless. It never
 * reads, prints, copies or moves a cookie or a password.
 *
 * Where the pictures go: the collector's own store on this Mac, mode 0600, OUTSIDE the
 * repository, so nothing here can be published to scintillahub.ai. They are other people's
 * work; the Hub page describes them in words and links to the post.
 *
 *   node scripts/xfeed-bookmark-deep.mjs --once [--folder "Claude Check"] [--limit N]
 *        [--ids 123,456] [--budget-seconds N] [--headless] [--redo]
 *
 * Store (additive, beside store.json):
 *   <runtime>/bookmarks/<slug>/deep/index.json       one entry per post read deeply
 *   <runtime>/bookmarks/<slug>/deep/<id>/thread.json the thread, the quote, the links
 *   <runtime>/bookmarks/<slug>/deep/<id>/media/*     the pictures, private
 *   <runtime>/bookmarks/<slug>/deep/<id>/links/*     linked pages, captures and PDFs
 *   <runtime>/bookmarks/<slug>/deep/runs/<id>.json   one receipt per pass
 */
import { mkdir, writeFile, readFile, rename } from 'node:fs/promises';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import { hostname } from 'node:os';
import { launchBrowser, DEFAULT_PROFILE, hasLoginMarker } from './xfeed-program.mjs';
import { DEFAULT_RUNTIME } from './xfeed-capture-server.mjs';
import { slugOf, DEFAULT_FOLDER, tweetRecord } from './xfeed-bookmarks.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function atomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const t = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(t, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(t, path);
}
async function writeBytes(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes, { mode: 0o600 });
  return { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}
async function readJson(path) { try { return JSON.parse(await readFile(path, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } }

// ---------------------------------------------------------------- pure (offline tested)

/** Every picture and video on a tweet, with the URL that returns the biggest still. */
export function mediaOf(tweet) {
  const legacy = tweet?.legacy ?? tweet ?? {};
  const all = [...(legacy.extended_entities?.media ?? []), ...(legacy.entities?.media ?? [])];
  const seen = new Set(), out = [];
  for (const m of all) {
    const key = m?.media_key ?? m?.id_str;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const still = m.media_url_https ?? null;
    const variants = (m.video_info?.variants ?? []).filter(v => v.content_type === 'video/mp4')
      .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
    out.push({
      key: String(key),
      type: m.type ?? 'photo',
      // ?name=large is X's own full-size rendition of the same picture, not a different asset.
      url: still ? `${still}${still.includes('?') ? '&' : '?'}name=large` : null,
      poster: still,
      video_url: variants[0]?.url ?? null,
      alt: m.ext_alt_text ?? null,
      width: m.original_info?.width ?? null,
      height: m.original_info?.height ?? null,
    });
  }
  return out;
}

/** A link is worth opening, and how. */
export function classifyLink(url) {
  let u;
  try { u = new URL(String(url)); } catch { return { url: String(url), kind: 'unusable' }; }
  const host = u.hostname.replace(/^www\./, '');
  const path = u.pathname;
  if (/^(x\.com|twitter\.com)$/.test(host)) {
    if (/^\/i\/(web\/)?article/.test(path) || /^\/i\/article/.test(path)) return { url, kind: 'x_article' };
    if (/\/status\/\d+/.test(path)) return { url, kind: 'x_post' };
    if (/^\/(i\/)?broadcasts?\//.test(path) || /^\/i\/spaces\//.test(path)) return { url, kind: 'x_broadcast' };
    return { url, kind: 'x_page' };
  }
  if (/\.pdf($|\?)/i.test(u.href)) return { url, kind: 'pdf' };
  if (/^(t\.co)$/.test(host)) return { url, kind: 'shortener' };
  if (/^(pbs\.twimg\.com|video\.twimg\.com)$/.test(host)) return { url, kind: 'media' };
  return { url, kind: 'page', host };
}

/** Tweets the payload carries, by id, so a thread can be assembled without the DOM. */
export function tweetsById(payload, depth = 0, out = new Map()) {
  if (!payload || typeof payload !== 'object' || depth > 40) return out;
  if (Array.isArray(payload)) { for (const v of payload) tweetsById(v, depth + 1, out); return out; }
  const legacy = payload.legacy ?? payload.tweet?.legacy;
  const node = payload.tweet ?? payload;
  const id = node.rest_id ?? legacy?.id_str;
  if (legacy && id && (legacy.full_text !== undefined || node.note_tweet)) {
    const prior = out.get(String(id));
    // Keep the richest copy: a later payload often carries media the first one omitted.
    if (!prior || JSON.stringify(node).length > JSON.stringify(prior).length) out.set(String(id), node);
  }
  for (const v of Object.values(payload)) tweetsById(v, depth + 1, out);
  return out;
}

/**
 * Assemble one post's deep record from whatever payloads the page produced.
 * The thread is the author's own continuation (same handle, same conversation), in time order.
 */
export function deepRecordFrom(payloads, id, { folder = null } = {}) {
  const byId = new Map();
  for (const p of payloads) tweetsById(p, 0, byId);
  const root = byId.get(String(id));
  if (!root) return null;
  const record = tweetRecord(root);
  const rootConv = root.legacy?.conversation_id_str ?? String(id);
  const thread = [];
  for (const [tid, tweet] of byId) {
    if (tid === String(id)) continue;
    const legacy = tweet.legacy ?? {};
    if ((legacy.conversation_id_str ?? null) !== rootConv) continue;
    const handle = tweet.core?.user_results?.result?.core?.screen_name
      ?? tweet.core?.user_results?.result?.legacy?.screen_name ?? null;
    if (!handle || !record.author_handle || handle.toLowerCase() !== record.author_handle.toLowerCase()) continue;
    thread.push(tweetRecord(tweet));
  }
  thread.sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')) || a.id.localeCompare(b.id));
  const quotedRaw = root.quoted_status_result?.result ?? root.quoted_status?.result ?? null;
  const media = [
    ...mediaOf(root).map(m => ({ ...m, on: 'post' })),
    ...thread.flatMap((t, i) => mediaOf(byId.get(t.id) ?? {}).map(m => ({ ...m, on: `thread:${i + 1}` }))),
    ...(quotedRaw ? mediaOf(quotedRaw).map(m => ({ ...m, on: 'quoted' })) : []),
  ];
  const links = [...new Set([record, ...thread, ...(record.quoted ? [record.quoted] : [])]
    .flatMap(r => r.links ?? []))].map(classifyLink);
  return {
    id: String(id), folder,
    author_handle: record.author_handle, author_name: record.author_name,
    url: record.url, created_at: record.created_at,
    text: record.text,
    thread: thread.map(t => ({ id: t.id, text: t.text, created_at: t.created_at })),
    quoted: record.quoted ? { id: record.quoted.id, author_handle: record.quoted.author_handle, text: record.quoted.text, url: record.quoted.url } : null,
    cashtags: record.cashtags,
    media, links,
    method_hints: methodHints([record.text, ...thread.map(t => t.text), record.quoted?.text ?? '', ...media.map(m => m.alt ?? '')].join('\n')),
  };
}

/**
 * The method a post is probably demonstrating, from its own words. This is a signpost for the
 * reading pass, not a claim: a card stays `described: false` until a person or a model has
 * actually looked at the picture.
 */
export const METHODS = Object.freeze({
  breadth: /\bbreadth\b|advance[- ]decline|a\/d line|% (?:of )?(?:stocks|members) above|new highs?[- ]new lows?|equal[- ]weight(?:ed)? vs|McClellan/i,
  positioning: /\bpositioning\b|net long|net short|CTA|commitment of traders|\bCOT\b|fund flows?|short interest|put\/call|\bskew\b/i,
  liquidity: /\bliquidity\b|reserve balances?|\bRRP\b|\bTGA\b|net liquidity|balance sheet|\bQT\b|\bQE\b|reverse repo/i,
  seasonality: /\bseasonal(?:ity)?\b|this time of year|average (?:month|week|year)|since \d{4} (?:the|average)|month of (?:september|october)/i,
  drawdown: /\bdrawdown\b|peak[- ]to[- ]trough|max ?dd|recover(?:y|ed) time|underwater/i,
  options: /\bgamma\b|\b0dte\b|dealer|options? (?:flow|volume|expiry)|\bopex\b|implied vol|\bIV\b\b|vanna|charm/i,
  rotation: /\brotation\b|relative strength|ratio chart|vs\.? (?:SPY|QQQ|IWM|SPX)|outperform(?:ing|ance)|leadership/i,
  credit: /\bcredit\b|high yield|\bHYG\b|\bLQD\b|spread(?:s)?\b|\bbond(?:s)?\b|yield curve|\b10y\b|\b2s10s\b|\bMOVE\b/i,
  froth: /\bfroth\b|leveraged etf|\b3x\b|\bTQQQ\b|\bSOXL\b|speculat(?:ive|ion)|retail (?:buying|bid)|meme/i,
  valuation: /\bvaluation\b|forward p\/e|\bEPS\b|earnings revision|margin|free cash flow|\bDCF\b/i,
  signal_horizon: /how long|days? (?:later|after)|weeks? (?:later|after)|forward return|hit rate|win rate|base rate|historically.*(?:then|after)/i,
  vwap: /\bvwap\b|anchored/i,
  correlation: /\bcorrelation\b|decoupl|diverg(?:e|ence)|\bversus\b|\bvs\b.*\bS&P\b/i,
  volatility: /\bVIX\b|\bvol(?:atility)?\b|term structure|contango|backwardation|realized vol/i,
});
export function methodHints(text) {
  const t = String(text ?? '');
  return Object.entries(METHODS).filter(([, re]) => re.test(t)).map(([name]) => name);
}

/** Bookmarks that still need the deep treatment, newest first, capped. */
export function selectPending(store, index, { limit = 8, redo = false, ids = null } = {}) {
  const posts = Object.values(store?.posts ?? {});
  const done = new Set(Object.keys(index?.posts ?? {}));
  const wanted = ids ? new Set(ids.map(String)) : null;
  return posts
    .filter(p => (wanted ? wanted.has(String(p.id)) : true))
    .filter(p => redo || wanted || !done.has(String(p.id)))
    .sort((a, b) => String(b.first_seen_at ?? '').localeCompare(String(a.first_seen_at ?? ''))
      || String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
    .slice(0, Math.max(0, limit))
    .map(p => ({ id: String(p.id), url: p.url, author_handle: p.author_handle }));
}

/** One card for the backlog page. Describing the picture is a separate reading pass. */
export function ideaCardFrom(deep, described = null) {
  const pictures = deep.media.filter(m => m.type === 'photo').length;
  return {
    id: deep.id,
    author: deep.author_handle ? `@${deep.author_handle}` : 'unknown',
    url: deep.url,
    created_at: deep.created_at,
    headline: (deep.text || '').split('\n').find(Boolean)?.slice(0, 160) ?? '',
    pictures,
    thread_posts: deep.thread.length,
    linked: deep.links.filter(l => ['page', 'pdf', 'x_article'].includes(l.kind)).length,
    methods: deep.method_hints,
    cashtags: deep.cashtags,
    described: Boolean(described),
    description: described?.description ?? null,
    method: described?.method ?? null,
    data_needed: described?.data_needed ?? null,
    hub_has_data: described?.hub_has_data ?? null,
    build: described?.build ?? null,
    recommendation: described?.recommendation ?? null,
    theme: described?.theme ?? null,
  };
}

export function mergeIndex(index, entries, now) {
  const next = { ...(index ?? {}), posts: { ...(index?.posts ?? {}) } };
  for (const e of entries) {
    const prior = next.posts[e.id];
    next.posts[e.id] = { ...prior, ...e, first_deep_at: prior?.first_deep_at ?? now, last_deep_at: now };
  }
  next.updated_at = now;
  next.count = Object.keys(next.posts).length;
  return next;
}

// ---------------------------------------------------------------- the live pass

const isDetail = url => /\/i\/api\/graphql\/[^/]+\/(TweetDetail|TweetResultByRestId|ConversationTimeline)/i.test(url);

/** Download one URL with the collector's own session. Returns null rather than throwing. */
async function fetchBytes(context, url, referer) {
  try {
    const response = await context.request.get(url, { headers: referer ? { referer } : {}, timeout: 30000, maxRedirects: 5 });
    if (!response.ok()) return { error: `HTTP ${response.status()}` };
    const body = await response.body();
    return { body, contentType: String(response.headers()['content-type'] ?? '') };
  } catch (error) { return { error: String(error.message).slice(0, 200) }; }
}

function extFor(contentType, url) {
  const ct = String(contentType ?? '');
  if (/pdf/i.test(ct)) return '.pdf';
  if (/jpe?g/i.test(ct)) return '.jpg';
  if (/png/i.test(ct)) return '.png';
  if (/gif/i.test(ct)) return '.gif';
  if (/webp/i.test(ct)) return '.webp';
  if (/mp4/i.test(ct)) return '.mp4';
  const e = extname(new URL(url, 'https://x.com').pathname);
  return /^\.[a-z0-9]{2,5}$/i.test(e) ? e.toLowerCase() : '.bin';
}

/** One post, read deeply. Read-only: goto, wait, download. */
export async function deepReadPost(context, { id, url }, dirs, o = {}) {
  const page = await context.newPage();
  const payloads = [];
  page.on('response', async response => {
    const u = response.url();
    if (!isDetail(u)) return;
    try { const body = await response.text(); if (body.trim().startsWith('{')) payloads.push(JSON.parse(body)); } catch { /* body gone */ }
  });
  const outcome = { id, status: 'started', media: [], links: [], errors: [] };
  try {
    const target = url ?? `https://x.com/i/status/${id}`;
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await sleep(o.settleMs ?? 3200);
    if (await hasLoginMarker(page)) { outcome.status = 'signed_out'; return outcome; }
    // Nudge the conversation so X returns the author's own continuation too.
    for (let i = 0; i < (o.threadScrolls ?? 2); i++) { await page.mouse.wheel(0, 1400).catch(() => {}); await sleep(900); }
    const deep = deepRecordFrom(payloads, id, { folder: o.folder ?? null });
    if (!deep) { outcome.status = 'no_payload'; return outcome; }

    // pictures — private, never published
    let n = 0;
    for (const m of deep.media) {
      const src = m.url ?? m.poster;
      if (!src) continue;
      n++;
      const got = await fetchBytes(context, src, target);
      if (got.error || !got.body) { outcome.errors.push(`media ${n}: ${got.error ?? 'empty'}`); continue; }
      const file = join(dirs.post, 'media', `${String(n).padStart(2, '0')}-${m.key}${extFor(got.contentType, src)}`);
      const written = await writeBytes(file, got.body);
      const entry = { n, on: m.on, type: m.type, alt: m.alt, width: m.width, height: m.height, source: src, file, ...written };
      outcome.media.push(entry);
      m.stored = { file, bytes: written.bytes };
    }

    // linked reading — pages, X articles, PDFs
    let k = 0;
    for (const link of deep.links) {
      if (!['page', 'pdf', 'x_article'].includes(link.kind)) continue;
      if (k >= (o.maxLinks ?? 4)) { outcome.errors.push('link budget reached'); break; }
      k++;
      const base = join(dirs.post, 'links', `${String(k).padStart(2, '0')}`);
      if (link.kind === 'pdf') {
        const got = await fetchBytes(context, link.url, target);
        if (got.error || !got.body) { outcome.links.push({ ...link, error: got.error ?? 'empty' }); continue; }
        const written = await writeBytes(`${base}.pdf`, got.body);
        outcome.links.push({ ...link, file: `${base}.pdf`, ...written });
        continue;
      }
      const lp = await context.newPage();
      try {
        await lp.goto(link.url, { waitUntil: 'domcontentloaded', timeout: 40000 });
        await sleep(2600);
        const text = await lp.evaluate(() => document.body?.innerText?.slice(0, 40000) ?? '').catch(() => '');
        const title = await lp.title().catch(() => '');
        const shot = `${base}.png`;
        await mkdir(dirname(shot), { recursive: true });
        await lp.screenshot({ path: shot, fullPage: false }).catch(() => {});
        const t = await writeBytes(`${base}.txt`, Buffer.from(`${title}\n${link.url}\n\n${text}`, 'utf8'));
        outcome.links.push({ ...link, title, file: `${base}.txt`, capture: shot, chars: text.length, sha256: t.sha256 });
      } catch (error) {
        outcome.links.push({ ...link, error: String(error.message).slice(0, 200) });
      } finally { await lp.close().catch(() => {}); }
    }

    await atomic(join(dirs.post, 'thread.json'), { ...deep, read_at: new Date().toISOString(), stored_media: outcome.media, stored_links: outcome.links });
    outcome.status = 'read';
    outcome.deep = deep;
    return outcome;
  } catch (error) {
    outcome.status = 'failed';
    outcome.errors.push(String(error.message).slice(0, 200));
    return outcome;
  } finally { await page.close().catch(() => {}); }
}

export async function deepPass(options = {}, deps = {}) {
  const o = {
    folder: DEFAULT_FOLDER, runtimeDir: DEFAULT_RUNTIME, profileDir: DEFAULT_PROFILE, headless: true,
    limit: 8, budgetSeconds: 600, redo: false, ids: null, maxLinks: 4,
    playwrightFrom: process.env.XFEED_PLAYWRIGHT_FROM ?? null, ...options,
  };
  const slug = slugOf(o.folder);
  const root = join(o.runtimeDir, 'bookmarks', slug);
  const deepRoot = join(root, 'deep');
  const startedAt = new Date().toISOString();
  const passId = `deep-${startedAt.replace(/[:.]/g, '-')}`;
  const receipt = {
    program: 'xfeed-bookmark-deep', pass_id: passId, host: hostname(), folder: o.folder, slug,
    started_at: startedAt, status: 'starting', read_only: true, publishes_pictures: false,
    store: deepRoot, attempted: 0, read: 0, media_saved: 0, links_saved: 0, posts: [],
  };
  const store = await readJson(join(root, 'store.json'));
  const index = (await readJson(join(deepRoot, 'index.json'))) ?? { folder: o.folder, slug, posts: {} };
  const finish = async (status, extra = {}) => {
    Object.assign(receipt, { status, finished_at: new Date().toISOString(), ...extra });
    await atomic(join(deepRoot, 'runs', `${passId}.json`), receipt);
    await atomic(join(deepRoot, 'health.json'), {
      program: 'xfeed-bookmark-deep', updated_at: receipt.finished_at, folder: o.folder, slug,
      last_pass: { pass_id: passId, status, attempted: receipt.attempted, read: receipt.read, media_saved: receipt.media_saved, finished_at: receipt.finished_at, error: receipt.error ?? null },
      deep_count: Object.keys(index.posts ?? {}).length, store: deepRoot,
    });
    return receipt;
  };
  if (!store?.posts) return await finish('no_store', { error: `no bookmark store at ${join(root, 'store.json')} — run xfeed-bookmarks.mjs first` });

  const pending = selectPending(store, index, { limit: o.limit, redo: o.redo, ids: o.ids });
  receipt.pending = pending.length;
  if (!pending.length) return await finish('nothing_pending', { deep_count: Object.keys(index.posts ?? {}).length });

  let browser = null;
  const entries = [];
  try {
    // keepMedia: this pass is the one that WANTS pictures.
    browser = deps.browser ?? await launchBrowser({ ...o, fixture: null, keepMedia: true }, deps);
    const deadline = Date.now() + o.budgetSeconds * 1000;
    for (const post of pending) {
      if (Date.now() > deadline) { receipt.stopped_for = 'budget'; break; }
      receipt.attempted++;
      const dirs = { post: join(deepRoot, post.id) };
      const outcome = await deepReadPost(browser.context, post, dirs, { folder: o.folder, maxLinks: o.maxLinks });
      if (outcome.status === 'signed_out') { receipt.error = 'the collector profile is signed out of X'; break; }
      if (outcome.status === 'read') {
        receipt.read++;
        receipt.media_saved += outcome.media.length;
        receipt.links_saved += outcome.links.filter(l => l.file).length;
        entries.push({
          id: post.id, status: 'read', author_handle: outcome.deep.author_handle, url: outcome.deep.url,
          created_at: outcome.deep.created_at, thread_posts: outcome.deep.thread.length,
          quoted: Boolean(outcome.deep.quoted), pictures: outcome.media.length,
          media: outcome.media.map(m => ({ n: m.n, on: m.on, type: m.type, file: m.file, bytes: m.bytes, alt: m.alt, width: m.width, height: m.height })),
          links: outcome.links.map(l => ({ url: l.url, kind: l.kind, title: l.title ?? null, file: l.file ?? null, capture: l.capture ?? null, error: l.error ?? null })),
          method_hints: outcome.deep.method_hints, cashtags: outcome.deep.cashtags,
          described: Boolean((await readJson(join(deepRoot, post.id, 'reading.json')))?.description),
          thread_file: join(deepRoot, post.id, 'thread.json'),
        });
      } else {
        entries.push({ id: post.id, status: outcome.status, url: post.url, errors: outcome.errors });
      }
      receipt.posts.push({ id: post.id, status: outcome.status, media: outcome.media.length, links: outcome.links.length, errors: outcome.errors.length });
      await sleep(600);
    }
    const now = new Date().toISOString();
    await atomic(join(deepRoot, 'index.json'), mergeIndex(index, entries, now));
    return await finish(receipt.error ? 'partial' : 'read');
  } catch (error) {
    return await finish('failed', { error: String(error.message).slice(0, 300) });
  } finally { if (!deps.browser) await browser?.context.close().catch(() => {}); }
}

export function parseArgs(argv) {
  const o = {};
  const map = { '--folder': 'folder', '--runtime-dir': 'runtimeDir', '--profile': 'profileDir', '--limit': 'limit', '--budget-seconds': 'budgetSeconds', '--max-links': 'maxLinks', '--playwright-from': 'playwrightFrom', '--ids': 'ids' };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--once') continue;
    else if (key === '--headless') o.headless = true;
    else if (key === '--headed') o.headless = false;
    else if (key === '--redo') o.redo = true;
    else if (map[key] && argv[i + 1] !== undefined) {
      const v = argv[++i];
      o[map[key]] = ['limit', 'budgetSeconds', 'maxLinks'].includes(map[key]) ? Number(v) : map[key] === 'ids' ? String(v).split(',').map(s => s.trim()).filter(Boolean) : v;
    } else throw new Error(`unknown or incomplete option ${key}`);
  }
  for (const k of ['limit', 'budgetSeconds', 'maxLinks']) if (o[k] !== undefined && !(Number.isSafeInteger(o[k]) && o[k] > 0)) throw new Error(`${k} must be a positive integer`);
  for (const k of ['runtimeDir', 'profileDir', 'playwrightFrom']) if (o[k]) o[k] = resolve(o[k]);
  return o;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  deepPass(parseArgs(process.argv.slice(2)))
    .then(r => { process.stdout.write(`${JSON.stringify(r, null, 2)}\n`); process.exitCode = ['read', 'nothing_pending'].includes(r.status) ? 0 : 2; })
    .catch(e => { process.stderr.write(`xfeed-bookmark-deep failed: ${e.message}\n`); process.exitCode = 1; });
}

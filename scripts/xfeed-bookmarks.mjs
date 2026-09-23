#!/usr/bin/env node
/**
 * xfeed-bookmarks.mjs — read ONE X bookmark folder (default "Claude Check") with the
 * collector's own signed-in profile, into its OWN store beside the Trading list feed.
 *
 * It never touches the Trading list pipeline: no intake, no ledger, no publication.
 * It only reads: goto + scroll. It never bookmarks, unbookmarks, likes, posts or
 * clicks anything, and it never reads, copies, prints or moves a cookie or password.
 *
 *   node scripts/xfeed-bookmarks.mjs --once [--folder "Claude Check"] [--headless]
 *        [--runtime-dir DIR] [--profile DIR] [--max-scrolls N] [--budget-seconds N]
 *        [--playwright-from DIR] [--dry-run]
 *
 * Store (additive, its own directory):
 *   <runtime>/bookmarks/<slug>/store.json    every post ever seen, merged by id
 *   <runtime>/bookmarks/<slug>/runs/<id>.json   one receipt per pass
 *   <runtime>/bookmarks/health.json          last pass, for the desk and the backlog page
 */
import { mkdir, writeFile, readFile, rename } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { hostname } from 'node:os';
import { launchBrowser, DEFAULT_PROFILE, hasLoginMarker } from './xfeed-program.mjs';
import { DEFAULT_RUNTIME } from './xfeed-capture-server.mjs';

// /i/bookmarks currently redirects to the History page, which is where X fetches
// BookmarkFoldersSlice. /i/bookmarks/folders is a 404 (checked live, 23 Sep).
export const FOLDER_PAGES = ['https://x.com/i/bookmarks', 'https://x.com/i/bookmarks/folders'];
export const DEFAULT_FOLDER = 'Claude Check';
const sleep = ms => new Promise(r => setTimeout(r, ms));
export const slugOf = name => String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'folder';

async function atomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const t = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(t, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(t, path);
}
async function readJson(path) { try { return JSON.parse(await readFile(path, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } }

// ---------------------------------------------------------------- pure parsing (offline tested)

/** Every object anywhere in a payload that looks like a rendered tweet. */
function* walkTweets(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 40) return;
  if (Array.isArray(node)) { for (const v of node) yield* walkTweets(v, depth + 1); return; }
  const legacy = node.legacy ?? node.tweet?.legacy;
  const restId = node.rest_id ?? node.tweet?.rest_id ?? legacy?.id_str;
  if (legacy && restId && (legacy.full_text !== undefined || node.note_tweet)) yield node.tweet ?? node;
  for (const v of Object.values(node)) yield* walkTweets(v, depth + 1);
}

function authorOf(tweet) {
  const user = tweet.core?.user_results?.result ?? tweet.author?.result ?? null;
  const handle = user?.core?.screen_name ?? user?.legacy?.screen_name ?? tweet.legacy?.screen_name ?? null;
  const name = user?.core?.name ?? user?.legacy?.name ?? null;
  return { handle: handle ? String(handle) : null, name: name ? String(name) : null };
}

/** Cashtags X itself tagged, plus $SYMBOL written in the text. Upper case, deduped. */
export function cashtagsOf(text, entities = {}) {
  const out = new Set();
  for (const s of entities.symbols ?? []) if (s?.text) out.add(String(s.text).toUpperCase());
  for (const m of String(text ?? '').matchAll(/\$([A-Za-z][A-Za-z.-]{0,6})\b/g)) out.add(m[1].toUpperCase());
  return [...out];
}

/** One tweet object -> the record we store. `depth` stops a quote chain from recursing forever. */
export function tweetRecord(tweet, depth = 0) {
  const legacy = tweet.legacy ?? {};
  const note = tweet.note_tweet?.note_tweet_results?.result;
  const text = note?.text ?? legacy.full_text ?? '';
  const entities = note?.entity_set ?? legacy.entities ?? {};
  const media = [...(legacy.extended_entities?.media ?? []), ...(legacy.entities?.media ?? [])];
  const seenMedia = new Set();
  const id = String(tweet.rest_id ?? legacy.id_str);
  const author = authorOf(tweet);
  const quotedRaw = tweet.quoted_status_result?.result ?? tweet.quoted_status?.result ?? null;
  return {
    id,
    author_handle: author.handle,
    author_name: author.name,
    created_at: legacy.created_at ? new Date(legacy.created_at).toISOString() : null,
    url: author.handle ? `https://x.com/${author.handle}/status/${id}` : `https://x.com/i/status/${id}`,
    text,
    links: [...new Set((entities.urls ?? []).map(u => u?.expanded_url ?? u?.url).filter(Boolean))],
    media_alt: media.filter(m => { const k = m?.media_key ?? m?.id_str; if (!k || seenMedia.has(k)) return false; seenMedia.add(k); return true; })
      .map(m => ({ type: m.type ?? null, alt: m.ext_alt_text ?? null })).filter(m => m.alt),
    cashtags: cashtagsOf(text, entities),
    quoted: quotedRaw && depth < 1 ? tweetRecord(quotedRaw, depth + 1) : null,
  };
}

/** Bookmark timeline payload -> records, in the order X returned them. */
export function parseBookmarkPayload(payload) {
  const seen = new Set(), out = [];
  for (const tweet of walkTweets(payload)) {
    const record = tweetRecord(tweet);
    if (!record.id || seen.has(record.id)) continue;
    seen.add(record.id);
    out.push(record);
  }
  return out;
}

/** The folder id for a named folder, from the folders payload or from page links. */
export function folderIdFor(payload, name) {
  const want = String(name).trim().toLowerCase();
  let found = null;
  (function walk(node, depth = 0) {
    if (found || !node || typeof node !== 'object' || depth > 40) return;
    if (Array.isArray(node)) { for (const v of node) walk(v, depth + 1); return; }
    const id = node.id ?? node.rest_id ?? node.bookmark_collection_id;
    if (id && typeof node.name === 'string' && node.name.trim().toLowerCase() === want) { found = String(id); return; }
    for (const v of Object.values(node)) walk(v, depth + 1);
  })(payload);
  return found;
}

/** Merge a pass into the store without ever losing what we saw before. */
export function mergeStore(store, records, now) {
  const next = { ...(store ?? {}), posts: { ...(store?.posts ?? {}) } };
  let added = 0, updated = 0;
  records.forEach((record, index) => {
    const prior = next.posts[record.id];
    if (!prior) { next.posts[record.id] = { ...record, first_seen_at: now, last_seen_at: now, order_seen: index }; added++; return; }
    const changed = JSON.stringify({ ...prior, first_seen_at: 0, last_seen_at: 0, order_seen: 0 }) !== JSON.stringify({ ...record, first_seen_at: 0, last_seen_at: 0, order_seen: 0 });
    next.posts[record.id] = { ...prior, ...record, first_seen_at: prior.first_seen_at, last_seen_at: now, order_seen: index };
    if (changed) updated++;
  });
  next.updated_at = now;
  next.count = Object.keys(next.posts).length;
  return { store: next, added, updated };
}

export function storeToList(store) {
  return Object.values(store?.posts ?? {}).sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')) || String(a.id).localeCompare(String(b.id)));
}

// ---------------------------------------------------------------- the pass

const isBookmarkTimeline = url => /\/i\/api\/graphql\/[^/]+\/(Bookmark|bookmarks)/i.test(url) || /BookmarkFolderTimeline|BookmarksSlice|bookmark_collection/i.test(url);

export async function captureBookmarkFolder(options = {}, deps = {}) {
  const o = {
    folder: DEFAULT_FOLDER, runtimeDir: DEFAULT_RUNTIME, profileDir: DEFAULT_PROFILE, headless: true,
    maxScrolls: 40, budgetSeconds: 240, dryRun: false, playwrightFrom: process.env.XFEED_PLAYWRIGHT_FROM ?? null, ...options,
  };
  const startedAt = new Date().toISOString();
  const passId = `bookmarks-${startedAt.replace(/[:.]/g, '-')}`;
  const slug = slugOf(o.folder);
  const receipt = {
    program: 'xfeed-bookmarks', pass_id: passId, host: hostname(), folder: o.folder, slug,
    started_at: startedAt, status: 'starting', runtime_dir: o.runtimeDir, profile_dir: o.profileDir,
    read_only: true, touches_trading_list: false, posts_seen: 0, added: 0, updated: 0, payloads: 0, scrolls: 0,
  };
  const storePath = join(o.runtimeDir, 'bookmarks', slug, 'store.json');
  let browser = null;
  const finish = async (status, extra = {}) => {
    Object.assign(receipt, { status, finished_at: new Date().toISOString(), ...extra });
    if (!o.dryRun) {
      await atomic(join(o.runtimeDir, 'bookmarks', slug, 'runs', `${passId}.json`), receipt);
      await atomic(join(o.runtimeDir, 'bookmarks', 'health.json'), {
        program: 'xfeed-bookmarks', updated_at: receipt.finished_at, folder: o.folder, slug,
        last_pass: { pass_id: passId, status, posts_seen: receipt.posts_seen, added: receipt.added, updated: receipt.updated, finished_at: receipt.finished_at, error: receipt.error ?? null },
        store: storePath,
      });
    }
    return receipt;
  };
  try {
    browser = deps.browser ?? await launchBrowser({ ...o, fixture: null }, deps);
    const page = await browser.context.newPage();
    const payloads = [];
    page.on('response', async response => {
      const url = response.url();
      if (!url.includes('/i/api/graphql/')) return;
      try { const body = await response.text(); if (body.trim().startsWith('{')) payloads.push({ url, json: JSON.parse(body) }); } catch { /* body gone or not json */ }
    });

    // 1. the folder list, to resolve the folder by NAME (ids are not stable knowledge)
    let folderId = null;
    for (const url of FOLDER_PAGES) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await sleep(6000);
      if (await hasLoginMarker(page)) return await finish('signed_out', { error: 'the collector profile is signed out of X — run: node scripts/xfeed-program.mjs sign-in' });
      for (const p of payloads) { if (!/Folder/i.test(p.url)) continue; folderId = folderIdFor(p.json, o.folder); if (folderId) break; }
      if (folderId) { receipt.folders_page = url; break; }
    }
    if (!folderId) {
      // Fall back to the rendered list: the link carries the id, the row carries the name.
      folderId = await page.evaluate(name => {
        const want = name.trim().toLowerCase();
        for (const a of document.querySelectorAll('a[href^="/i/bookmarks/"]')) {
          if ((a.textContent || '').trim().toLowerCase().includes(want)) {
            const m = a.getAttribute('href').match(/\/i\/bookmarks\/(\d+)/);
            if (m) return m[1];
          }
        }
        return null;
      }, o.folder).catch(() => null);
    }
    if (!folderId) {
      const names = await page.evaluate(() => [...document.querySelectorAll('a[href^="/i/bookmarks/"]')].map(a => (a.textContent || '').trim()).filter(Boolean).slice(0, 40)).catch(() => []);
      return await finish('folder_not_found', { error: `no bookmark folder named "${o.folder}"`, folders_visible: names });
    }
    receipt.folder_id = folderId;

    // 2. the folder timeline, scrolled to the end (read only)
    payloads.length = 0;
    await page.goto(`https://x.com/i/bookmarks/${folderId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(3500);
    const deadline = Date.now() + o.budgetSeconds * 1000;
    let records = [], stable = 0;
    // Wheel only until X asks for the next slice, then let that response finish — the same
    // shape the Trading list helper uses. A fixed pause scrolled past nothing and stopped at
    // the first 22 posts (first live run, 23 Sep).
    for (let i = 0; i < o.maxScrolls && Date.now() < deadline; i++) {
      const next = page.waitForResponse(r => isBookmarkTimeline(r.url()), { timeout: 12000 })
        .then(r => r.finished().then(() => r)).catch(() => null);
      await page.mouse.move(640, 500).catch(() => {});
      for (let k = 0; k < 8; k++) { await page.mouse.wheel(0, 1600).catch(() => {}); await sleep(220); }
      const got = await next;
      await sleep(700);
      receipt.scrolls = i + 1;
      if (got) stable = 0; else if (++stable >= 3) break;
    }
    records = dedupe(payloads.flatMap(p => (isBookmarkTimeline(p.url) ? parseBookmarkPayload(p.json) : [])));
    receipt.payloads = payloads.filter(p => isBookmarkTimeline(p.url)).length;
    receipt.posts_seen = records.length;
    if (!records.length) return await finish('no_posts', { error: 'the folder page produced no bookmark payload (layout or network change, or an empty folder)' });

    const now = new Date().toISOString();
    const prior = await readJson(storePath);
    const { store, added, updated } = mergeStore(prior ?? { folder: o.folder, slug, posts: {} }, records, now);
    Object.assign(receipt, { added, updated, store_count: store.count });
    if (!o.dryRun) await atomic(storePath, store);
    return await finish('captured');
  } catch (error) {
    receipt.error = String(error.message);
    return await finish('failed');
  } finally {
    if (!deps.browser) await browser?.context.close().catch(() => {});
  }
}
function dedupe(records) {
  const seen = new Set(), out = [];
  for (const r of records) if (!seen.has(r.id)) { seen.add(r.id); out.push(r); }
  return out;
}

export function parseArgs(argv) {
  const o = {};
  const map = { '--folder': 'folder', '--runtime-dir': 'runtimeDir', '--profile': 'profileDir', '--max-scrolls': 'maxScrolls', '--budget-seconds': 'budgetSeconds', '--playwright-from': 'playwrightFrom' };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--once') continue;                  // one pass is the only mode; accepted for the operator's habit
    else if (key === '--headless') o.headless = true;
    else if (key === '--headed') o.headless = false;
    else if (key === '--dry-run') o.dryRun = true;
    else if (map[key] && argv[i + 1] !== undefined) { const v = argv[++i]; o[map[key]] = ['maxScrolls', 'budgetSeconds'].includes(map[key]) ? Number(v) : v; }
    else throw new Error(`unknown or incomplete option ${key}`);
  }
  for (const k of ['maxScrolls', 'budgetSeconds']) if (o[k] !== undefined && !(Number.isSafeInteger(o[k]) && o[k] > 0)) throw new Error(`${k} must be a positive integer`);
  for (const k of ['runtimeDir', 'profileDir', 'playwrightFrom']) if (o[k]) o[k] = resolve(o[k]);
  return o;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  captureBookmarkFolder(parseArgs(process.argv.slice(2)))
    .then(receipt => { process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`); process.exitCode = receipt.status === 'captured' ? 0 : 2; })
    .catch(error => { process.stderr.write(`xfeed-bookmarks failed: ${error.message}\n`); process.exitCode = 1; });
}

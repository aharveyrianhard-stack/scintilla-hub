#!/usr/bin/env node
/** Y3 (5 Oct 2026) — YouTube ↔ X both ways → control/YOUTUBE_X_BOTH_WAYS.json.
 *
 * Alan: "Did we do it both ways? Let's check if there's YouTube channels that I don't have on the trading list."
 *
 * What it reads (no key, no sign-in, GET only, nothing on X):
 *   - deliverables/20261005/y3-both-ways/data/channel-lists.json   — our saved channel lists + the bridge row;
 *   - deliverables/20261005/y3-both-ways/data/video-channels.json  — every channel in youtube_videos;
 *   - deliverables/20261005/y3-both-ways/data/x-accounts-seen.json — the Trading-list roster and the accounts it quotes;
 *   - control/YOUTUBE_CHANNEL_BRIDGE.json                          — Y2's X → YouTube table;
 *   - public youtube.com/channel/<id>/about and youtube.com/@<name>/about pages (the About links + description).
 *
 * usage: node scripts/yt-x-both-ways.mjs [--cache file] [--min-videos 1] [--amplified 5] [--out control/YOUTUBE_X_BOTH_WAYS.json]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseChannelPage, sameName, squash, isChannelId, SAME_HANDLE_MIN_SUBSCRIBERS } from '../supabase/functions/_shared/yt-bridge.mjs';
import { parseAbout, xAccountOf, reverseConfidence, settleLookalike } from './yt-x-both-ways-rules.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'deliverables/20261005/y3-both-ways/data');
const args = process.argv.slice(2);
const arg = (name, fallback = null) => { const i = args.indexOf('--' + name); return i >= 0 ? (args[i + 1] ?? true) : fallback; };
const OUT = arg('out', join(ROOT, 'control/YOUTUBE_X_BOTH_WAYS.json'));
const CACHE = arg('cache');
const MIN_VIDEOS = +arg('min-videos', 1);
const AMPLIFIED_MIN = +arg('amplified', 5);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const json = async (p) => JSON.parse(await readFile(p, 'utf8'));

/* one About page → the facts we keep (never the page itself) */
const cache = CACHE ? await json(CACHE).catch(() => ({})) : {};
let fetched = 0, failedInARow = 0, gaveUp = false;
async function about(ref) { // ref: 'channel/UC…' or '@name'
  if (cache[ref]) return cache[ref];
  if (gaveUp) return { status: 0, note: 'not read: youtube.com stopped answering earlier in this run' };
  let out = { status: 0 };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch('https://www.youtube.com/' + ref + '/about', { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en', Cookie: 'SOCS=CAI' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
      if (r.status === 404) { out = { status: 404 }; break; }
      if (r.ok) {
        const text = await r.text(), c = parseChannelPage(text);
        const alert = c ? null : (text.match(/"alertRenderer":\{"type":"ERROR","text":\{"simpleText":"((?:[^"\\]|\\.)*)"/) || [])[1];
        out = c ? { status: 200, ...c, ...parseAbout(text) } : { status: 200, unreadable: true, ...(alert ? { alert } : {}) };
        break;
      }
      out = { status: r.status };
    } catch (_) { out = { status: 0 }; }
    await sleep(1200);
  }
  fetched++;
  if (out.status === 200 && (!out.unreadable || out.alert) || out.status === 404) { failedInARow = 0; cache[ref] = out; }
  else if (++failedInARow >= 25) gaveUp = true;
  if (CACHE && fetched % 100 === 0) await writeFile(CACHE, JSON.stringify(cache));
  return out;
}
async function pool(items, size, work) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < items.length) { const i = next++; out[i] = await work(items[i], i); await sleep(150); if ((i + 1) % 200 === 0) console.error('…' + (i + 1) + '/' + items.length); }
  }));
  return out;
}

const lists = (await json(join(DATA, 'channel-lists.json'))).lists;
const videoChannels = (await json(join(DATA, 'video-channels.json'))).channels;
const xSeen = await json(join(DATA, 'x-accounts-seen.json'));
const y2 = await json(join(ROOT, 'control/YOUTUBE_CHANNEL_BRIDGE.json'));
const roster = new Map(xSeen.roster.map((h) => [h.toLowerCase(), h]));
const amplified = new Map(xSeen.amplified.map((a) => [a.handle.toLowerCase(), a]));
const bridgeIds = new Set(lists.yt_bridge_channels.ids);
const y2ByChannel = new Map(); // channel → the X accounts Y2 tied to it (sure or likely)
for (const r of y2.channels) if (r.channel_id && r.in_feed) y2ByChannel.set(r.channel_id, [...(y2ByChannel.get(r.channel_id) || []), r]);

/* ── every channel in our YouTube data ─────────────────────────────────────────────────────────────────────── */
const ACCOUNT_OF = { yt_sub_channels_scintilla: 'scintilla', yt_sub_channels_personal: 'personal', yt_sub_channels_ai_research: 'ai_research',
  yt_sub_channels_golf: 'golf', yt_sub_channels_soundscapes: 'soundscapes', yt_sub_channels: 'first list (Aug)' };
const universe = new Map();
const slot = (id) => universe.get(id) || universe.set(id, { channel_id: id, title: '', saved_lists: [], videos_held: 0, radar_tickers: [], sources: [] }).get(id);
for (const [key, account] of Object.entries(ACCOUNT_OF)) for (const id of (lists[key] || { ids: [] }).ids) if (isChannelId(id)) slot(id).saved_lists.push(account);
for (const id of bridgeIds) slot(id);
for (const c of videoChannels) {
  if (!isChannelId(c.channel_id)) continue;
  const listed = universe.has(c.channel_id);
  if (!listed && c.n < MIN_VIDEOS) continue;
  const s = slot(c.channel_id);
  s.title = c.title || s.title; s.videos_held = c.n; s.latest_video = c.latest; s.sources = String(c.sources || '').split(',').filter(Boolean);
  s.radar_tickers = String(c.tickers || '').split(',').filter(Boolean);
}
const channels = [...universe.values()];
console.error('channels to read: ' + channels.length);
await pool(channels, 6, async (c) => { c.about = await about('channel/' + c.channel_id); });

const rows = channels.map((c) => {
  const a = c.about || {}, read = a.status === 200 && !a.unreadable;
  const found = read ? xAccountOf(a, c.title || a.title) : { handle: null, all: [], how: '', where: null };
  const y2rows = y2ByChannel.get(c.channel_id) || [];
  let handle = found.handle, how = found.how, confidence = found.handle ? reverseConfidence(found, a) : 'none';
  /* Y2 already tied this channel to a Trading-list account: keep that when the About page names nobody */
  if (!handle && y2rows.length) { handle = y2rows[0].x_handle; how = 'from the X side (Y2): ' + y2rows[0].how_found; confidence = y2rows[0].confidence; }
  const where = [];
  if (c.saved_lists.length) where.push('subscribed: ' + [...new Set(c.saved_lists)].join(', '));
  if (bridgeIds.has(c.channel_id)) where.push('bridge');
  if (c.sources.includes('search')) where.push('RADAR search' + (c.radar_tickers.length ? ' (' + c.radar_tickers.slice(0, 6).join(', ') + ')' : ''));
  if (c.sources.includes('subscription') && !c.saved_lists.length && !bridgeIds.has(c.channel_id)) where.push('subscription videos held (no longer on a saved list)');
  const key = handle ? handle.toLowerCase() : null;
  if (key && roster.has(key)) handle = roster.get(key); // the list's own spelling
  /* the bridge carries this channel for an X account its own About page does not name */
  const disagrees = y2rows.length && found.all.length && !y2rows.some((y) => found.all.some((h) => h.toLowerCase() === y.x_handle.toLowerCase()))
    ? y2rows.map((y) => '@' + y.x_handle + ' (' + (y.confidence === 'high' ? 'sure' : 'likely') + ')') : null;
  return { bridge_disagrees: disagrees, channel_id: c.channel_id, channel_title: a.title || c.title || '', channel_handle: a.handle || null, subscribers: a.subscribers ?? null,
    channel_url: 'https://www.youtube.com/channel/' + c.channel_id, in_our_data: where, saved_lists: [...new Set(c.saved_lists)], videos_held: c.videos_held,
    x_handle: handle, x_handles_all: found.all, on_trading_list: key ? roster.has(key) : null, on_bridge: bridgeIds.has(c.channel_id),
    quoted_by_trading_list: key && amplified.has(key) ? amplified.get(key).times : 0,
    how_found: handle ? how : (read ? 'the About page names no X account' : a.alert ? 'no page: YouTube says "' + a.alert + '"' : 'not read: youtube.com answered ' + (a.status ?? 0) + (a.note ? ' (' + a.note + ')' : '')), confidence, about_read: read };
});

/* ── X → YouTube again, with what the About pages add ──────────────────────────────────────────────────────── */
/* (a) the 47 look-alikes: does the candidate's own About page link back to the account, or to somebody else? */
const lookalikes = y2.channels.filter((r) => r.confidence === 'low' && r.channel_id);
await pool(lookalikes, 5, async (r) => {
  const cands = [r.channel_id, ...(r.other_candidates || []).map((o) => o.channel_id)].filter(isChannelId);
  const pages = []; for (const id of cands) pages.push({ id, a: await about('channel/' + id) });
  r.settled = settleLookalike(r.x_handle, pages, roster);
});
/* (b) every Trading-list account Y2 left open: is there a channel in our own data whose About names it? */
const namedBy = new Map();
for (const r of rows) for (const h of (r.x_handles_all.length ? r.x_handles_all : [])) namedBy.set(h.toLowerCase(), [...(namedBy.get(h.toLowerCase()) || []), r]);
const open = y2.channels.filter((r) => !r.in_feed);
const settledRows = open.map((r) => {
  const key = r.x_handle.toLowerCase(), own = (namedBy.get(key) || []).filter((c) => c.x_handle && c.x_handle.toLowerCase() === key);
  const s = r.settled || { verdict: 'open', why: 'no candidate channel to check' };
  if (s.verdict !== 'sure' && own.length) {
    const best = own.sort((a, b) => (b.subscribers || 0) - (a.subscribers || 0))[0];
    return { x_handle: r.x_handle, y2: r.confidence, y2_candidate: r.channel_id || null, verdict: 'sure', channel_id: best.channel_id, channel_title: best.channel_title,
      why: 'a channel in our own YouTube data names x.com/' + r.x_handle + ' on its About page (' + best.how_found + ')' };
  }
  return { x_handle: r.x_handle, y2: r.confidence, y2_candidate: r.channel_id || null, y2_candidate_title: r.channel_title || null, ...s };
});

/* (c) beyond the 126: the accounts the Trading list quotes or reposts most. NOT Alan's follow list. */
const beyond = xSeen.amplified.filter((a) => a.times >= AMPLIFIED_MIN);
console.error('quoted accounts to read: ' + beyond.length);
const beyondRows = await pool(beyond, 5, async (acc) => {
  const key = acc.handle.toLowerCase(), named = (namedBy.get(key) || []).filter((c) => c.x_handle && c.x_handle.toLowerCase() === key);
  if (named.length) { const c = named[0]; return { x_handle: acc.handle, quoted: acc.times, channel_id: c.channel_id, channel_title: c.channel_title, confidence: 'high', in_our_data: c.in_our_data, on_bridge: c.on_bridge,
    how_found: 'a channel in our own YouTube data names x.com/' + acc.handle + ' on its About page' }; }
  const a = await about('@' + acc.handle);
  if (a.status !== 200 || a.unreadable) return { x_handle: acc.handle, quoted: acc.times, channel_id: null, confidence: 'none', how_found: a.status === 404 ? 'no channel named @' + acc.handle : 'not read: youtube.com answered ' + a.status };
  const x = xAccountOf(a, a.title), back = x.all.some((h) => h.toLowerCase() === key), other = x.handle && !back ? x.handle : null;
  const name = sameName(acc.handle, a.title, null) || (acc.name && squash(acc.name).length >= 4 && squash(acc.name) === squash(a.title));
  const confidence = back ? 'high' : other ? 'low' : (name && (a.subscribers || 0) >= SAME_HANDLE_MIN_SUBSCRIBERS ? 'medium' : 'low');
  return { x_handle: acc.handle, quoted: acc.times, channel_id: a.channel_id, channel_title: a.title, subscribers: a.subscribers ?? null, confidence,
    in_our_data: (universe.get(a.channel_id) && rows.find((r) => r.channel_id === a.channel_id) || { in_our_data: [] }).in_our_data, on_bridge: bridgeIds.has(a.channel_id),
    how_found: 'youtube.com/@' + acc.handle + ' exists' + (back ? ' · its About page links back to x.com/' + acc.handle : other ? ' · but its About page names a different X account (@' + other + ')' : name ? ' · the names match' : '') };
});
if (CACHE) await writeFile(CACHE, JSON.stringify(cache));

/* ── what goes where ───────────────────────────────────────────────────────────────────────────────────────── */
const rank = { high: 0, medium: 1, low: 2, none: 3 };
const weight = (r) => (r.saved_lists.length ? 1e9 : 0) + (r.on_bridge ? 5e8 : 0) + r.videos_held * 1e4 + Math.min(r.subscribers || 0, 9999);
rows.sort((a, b) => rank[a.confidence] - rank[b.confidence] || weight(b) - weight(a) || a.channel_title.localeCompare(b.channel_title));
const withX = rows.filter((r) => r.x_handle);
const notOnList = withX.filter((r) => r.on_trading_list === false);
const tradingDesk = (r) => r.saved_lists.includes('scintilla') || r.on_bridge || r.sources_radar;
for (const r of rows) r.sources_radar = r.in_our_data.some((w) => w.startsWith('RADAR'));
const scintillaList = new Set((lists.yt_sub_channels_scintilla || { ids: [] }).ids);
const bridgeAdds = settledRows.filter((s) => s.verdict === 'sure' && isChannelId(s.channel_id) && !bridgeIds.has(s.channel_id))
  .filter((s, i, all) => all.findIndex((o) => o.channel_id === s.channel_id) === i);
/* a Trading-list account's channel we hold (About names it) that the bridge does not carry yet */
const listChannelsOffBridge = withX.filter((r) => r.on_trading_list && !r.on_bridge && r.confidence === 'high');
const count = (list, c) => list.filter((r) => r.confidence === c).length;
const out = {
  schema: 'scintilla.youtube_x_both_ways.v1',
  built_at: new Date().toISOString(),
  source: {
    method: 'no key, no sign-in, nothing read from X: public youtube.com About pages only (the links a channel lists, then its description)',
    channels: 'our saved channel lists (app_config yt_sub_channels_*), the bridge row, and every channel in youtube_videos with at least ' + MIN_VIDEOS + ' stored video(s)',
    trading_list: 'the X "Trading" list roster, 126 accounts (list id 1405188850188759047; ListMembers captures of 8 Sep)',
    follow_list_stored: false,
    follow_list_note: "Alan's X follow list is in none of our stores: the collector reads one X list, never a profile's Following page. See what_an_isolated_browser_must_read.",
    pages_read: fetched, stopped_early: gaveUp,
  },
  x_accounts_seen: {
    trading_list_members: xSeen.roster.length,
    quoted_or_reposted_by_them: xSeen.amplified.length,
    only_mentioned_by_them: xSeen.mentions_off_roster,
    full_follow_list: 0,
    note: 'The 126 are members of one X list. The quoted accounts are people those 126 pass along; they are not accounts Alan follows as far as our data can show.',
  },
  counts: {
    channels_in_our_data: rows.length, about_pages_read: rows.filter((r) => r.about_read).length,
    channels_youtube_has_removed: rows.filter((r) => r.how_found.startsWith('no page:')).length, not_read: rows.filter((r) => r.how_found.startsWith('not read:')).length,
    with_an_x_account: withX.length, sure: count(withX, 'high'), likely: count(withX, 'medium'), weak: count(withX, 'low'),
    x_account_on_trading_list: withX.filter((r) => r.on_trading_list).length,
    x_account_not_on_trading_list: notOnList.length,
    not_on_trading_list_sure: count(notOnList, 'high'),
    not_on_trading_list_and_subscribed_on_scintilla: notOnList.filter((r) => r.saved_lists.includes('scintilla')).length,
    lookalikes_checked: lookalikes.length,
    lookalikes_now_sure: settledRows.filter((s) => s.y2 === 'low' && s.verdict === 'sure').length,
    lookalikes_ruled_out: settledRows.filter((s) => s.y2 === 'low' && s.verdict === 'not theirs').length,
    lookalikes_still_open: settledRows.filter((s) => s.y2 === 'low' && s.verdict === 'open').length,
    none_now_sure: settledRows.filter((s) => s.y2 === 'none' && s.verdict === 'sure').length,
    quoted_accounts_checked: beyondRows.length, quoted_accounts_sure: count(beyondRows, 'high'), quoted_accounts_likely: count(beyondRows, 'medium'),
    bridge_adds_staged: bridgeAdds.length, bridge_adds_new_to_the_feed: bridgeAdds.filter((s) => !scintillaList.has(s.channel_id)).length,
  },
  youtube_to_x: rows.map(({ sources_radar, about_read, bridge_disagrees, ...r }) => r),
  x_to_youtube: { trading_list_settled: settledRows, quoted_accounts: beyondRows.sort((a, b) => rank[a.confidence] - rank[b.confidence] || b.quoted - a.quoted) },
  proposals: {
    add_to_bridge_staged: bridgeAdds.map((s) => ({ channel_id: s.channel_id, channel_title: s.channel_title, x_handle: s.x_handle, y2_said: s.y2 === 'low' ? 'look-alike' : 'no channel',
      already_in_feed_by_subscription: scintillaList.has(s.channel_id), why: s.why })),
    bridge_rows_to_review: rows.filter((r) => r.bridge_disagrees).map((r) => ({ channel_id: r.channel_id, channel_title: r.channel_title, bridge_says: r.bridge_disagrees, about_page_names: r.x_handles_all })),
    trading_list_channels_we_hold_off_bridge: listChannelsOffBridge.map((r) => ({ channel_id: r.channel_id, channel_title: r.channel_title, x_handle: r.x_handle, in_our_data: r.in_our_data })),
    x_list_adds_for_alan: notOnList.filter((r) => r.confidence === 'high' && tradingDesk(r)).map((r) => ({ x_handle: r.x_handle, channel_title: r.channel_title, channel_id: r.channel_id, in_our_data: r.in_our_data, videos_held: r.videos_held, quoted_by_trading_list: r.quoted_by_trading_list })),
    youtube_subscribes_for_alan: beyondRows.filter((b) => b.confidence === 'high' && b.channel_id && !(b.in_our_data || []).some((w) => w.startsWith('subscribed')) && !b.on_bridge).map((b) => ({ channel_id: b.channel_id, channel_title: b.channel_title, x_handle: b.x_handle, quoted: b.quoted })),
  },
  what_an_isolated_browser_must_read: {
    why: "The follow list exists only inside X, behind Alan's sign-in. Nothing we hold contains it.",
    where: "Grok Bot's isolated computer, signed in to X as Alan. Never Alan's Chrome, never a window on this MacBook.",
    steps: [
      'Open https://x.com/home and read the signed-in handle from the profile link in the left column (call it <me>).',
      'Open https://x.com/<me>/following. The page header shows the Following count: write it down as expected_count.',
      'Scroll to the bottom slowly (one screen at a time, ~1.5 s pause) until two scrolls in a row add no new row. Rows are [data-testid="UserCell"].',
      'For each row keep: handle (the @name, without @), display name, the bio text, verified yes/no, and "Follows you" yes/no.',
      'Stop if X shows a sign-in wall, a rate-limit notice or "Something went wrong": report how many rows were read; do not retry in a loop.',
      'Optional, same session: https://x.com/i/lists/1405188850188759047/members (the Trading list, expect 126) so both lists come from the same day.',
    ],
    fields: ['handle', 'name', 'bio', 'verified', 'follows_you'],
    deliver: 'handoffs/X-FOLLOWING-<yyyymmdd>.json = { "read_at": ISO time, "account": "<me>", "expected_count": N, "rows": [ {handle, name, bio, verified, follows_you} ] }. A plain text file with one handle per line also works: node scripts/yt-bridge-resolve.mjs --extra <file>.',
    check: 'rows.length within 2% of expected_count; no duplicate handle; every handle matches ^[A-Za-z0-9_]{1,15}$.',
    never: 'No follow, unfollow, like, post, list edit or settings change. Read only.',
  },
};
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out.counts));

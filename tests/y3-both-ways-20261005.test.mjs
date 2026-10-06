// Y3 (5 Oct 2026) — YouTube ↔ X both ways. Alan: "Did we do it both ways? Let's check if there's YouTube
// channels that I don't have on the trading list."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { xHandlesIn, xHandlesSaid, parseAbout, xAccountOf, reverseConfidence, settleLookalike } from '../scripts/yt-x-both-ways-rules.mjs';
import { bridgeChannelIds, isChannelId, MAX_LIVE_PROBES } from '../supabase/functions/_shared/yt-bridge.mjs';

const root = new URL('../', import.meta.url);
const text = (p) => readFile(new URL(p, root), 'utf8');
const both = JSON.parse(await text('control/YOUTUBE_X_BOTH_WAYS.json'));
const y2 = JSON.parse(await text('control/YOUTUBE_CHANNEL_BRIDGE.json'));
const STAGED = 'deliverables/20261005/y3-both-ways/staged/';

const aboutPage = (links, description = '') => '<x>"aboutChannelViewModel":{"description":' + JSON.stringify(description) + ',"links":['
  + links.map(([t, u]) => '{"channelExternalLinkViewModel":{"title":{"content":' + JSON.stringify(t) + '},"link":{"content":' + JSON.stringify(u) + '}}}').join(',') + ']}';

test('an X address is read as an account; pages of the site are not accounts', () => {
  assert.deepEqual(xHandlesIn(' x.com/trendspider'), ['trendspider']);
  assert.deepEqual(xHandlesIn('see https://twitter.com/alphatrends and https://www.twitter.com/AlphaTrends'), ['alphatrends']);
  assert.deepEqual(xHandlesIn('https://twitter.com/intent/follow?screen_name=a https://x.com/i/lists/1 https://x.com/share?u=1'), []);
  assert.deepEqual(xHandlesIn('https://mobile.twitter.com/@Some_One/status/1'), ['Some_One']);
});
test('another site that merely ends in x.com is not X', () => {
  assert.deepEqual(xHandlesIn('https://netflix.com/title https://box.com/abc https://fedex.com/track'), []);
});
test('a handle said in words is found only beside the word Twitter or X', () => {
  assert.deepEqual(xHandlesSaid('Twitter: @Good_Name\nInstagram: @insta_name'), ['Good_Name']);
  assert.deepEqual(xHandlesSaid('Follow me on X @trader9'), ['trader9']);
  assert.deepEqual(xHandlesSaid('mail me @ home, Instagram @insta_only'), []);
});
test('the About block gives the channel\'s own links and its description', () => {
  const a = parseAbout(aboutPage([['Site', 'example.com'], ['Official X', 'x.com/trendspider']], 'Charts & more'));
  assert.equal(a.about_block, true);
  assert.deepEqual(a.links, [{ title: 'Site', url: 'example.com' }, { title: 'Official X', url: 'x.com/trendspider' }]);
  assert.equal(a.description, 'Charts & more');
  assert.deepEqual(parseAbout('<html>nothing</html>'), { links: [], description: '', about_block: false });
});
test('one X account in the link list is sure; several, or a description address, is likely; a bare name is weak', () => {
  const one = xAccountOf(parseAbout(aboutPage([['X', 'x.com/aaa_1']])));
  assert.equal(one.handle, 'aaa_1'); assert.equal(reverseConfidence(one), 'high');
  const two = xAccountOf(parseAbout(aboutPage([['X', 'x.com/aaa_1'], ['Host', 'twitter.com/bbb_2']])));
  assert.equal(two.handle, 'aaa_1'); assert.deepEqual(two.all, ['aaa_1', 'bbb_2']); assert.equal(reverseConfidence(two), 'medium');
  const desc = xAccountOf(parseAbout(aboutPage([['Site', 'example.com']], 'find me at https://x.com/ccc_3')));
  assert.equal(desc.where, 'description'); assert.equal(reverseConfidence(desc), 'medium');
  const said = xAccountOf(parseAbout(aboutPage([], 'Twitter: @ddd_4')));
  assert.equal(said.handle, 'ddd_4'); assert.equal(reverseConfidence(said), 'low');
  const nobody = xAccountOf(parseAbout(aboutPage([['Site', 'example.com']], 'no socials')));
  assert.equal(nobody.handle, null); assert.equal(reverseConfidence(nobody), 'none');
});
test('a look-alike is sure only when the channel names the account, and ruled out when it names somebody else', () => {
  const page = (id, links, d) => ({ id, a: { status: 200, title: 'T', ...parseAbout(aboutPage(links, d)) } });
  const roster = new Map([['other_one', 'Other_One']]);
  assert.equal(settleLookalike('Mine', [page('UCa', [['X', 'x.com/mine']])], roster).verdict, 'sure');
  const second = settleLookalike('Mine', [page('UCa', []), page('UCb', [['X', 'x.com/Mine']])], roster);
  assert.equal(second.verdict, 'sure'); assert.equal(second.channel_id, 'UCb');
  const other = settleLookalike('Mine', [page('UCa', [['X', 'x.com/other_one']])], roster);
  assert.equal(other.verdict, 'not theirs'); assert.match(other.why, /on the Trading list/);
  assert.equal(settleLookalike('Mine', [page('UCa', [])], roster).verdict, 'open');
  assert.equal(settleLookalike('Mine', [page('UCa', [], 'Twitter: @Mine')], roster).verdict, 'open', 'a name without an address never makes a sure match');
  assert.equal(settleLookalike('Mine', [{ id: 'UCa', a: { status: 0 } }], roster).verdict, 'open');
});

test('the table: every row is a real channel id, once, and says where we hold it', () => {
  const ids = both.youtube_to_x.map((r) => r.channel_id);
  assert.ok(ids.every(isChannelId));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(both.counts.channels_in_our_data, ids.length);
  for (const r of both.youtube_to_x) {
    assert.ok(['high', 'medium', 'low', 'none'].includes(r.confidence));
    assert.equal(r.x_handle === null, r.confidence === 'none', r.channel_id);
    assert.equal(r.on_trading_list === null, r.x_handle === null, r.channel_id);
    if (r.x_handle) assert.match(r.x_handle, /^[A-Za-z0-9_]{1,15}$/);
    assert.ok(r.how_found.length > 0);
  }
});
test('the table: "on the Trading list" is the 126-account roster, nothing else', async () => {
  const roster = new Set((await text('xfeed/data/HANDLES_TRADING.txt')).trim().split(/\r?\n/).map((h) => h.trim().toLowerCase()));
  assert.equal(roster.size, 126);
  for (const r of both.youtube_to_x) if (r.x_handle) assert.equal(r.on_trading_list, roster.has(r.x_handle.toLowerCase()), r.x_handle);
  assert.equal(both.counts.x_account_not_on_trading_list, both.youtube_to_x.filter((r) => r.on_trading_list === false).length);
});
test('the follow list is reported as not held, with the job for an isolated browser written out', () => {
  assert.equal(both.source.follow_list_stored, false);
  assert.equal(both.x_accounts_seen.full_follow_list, 0);
  assert.equal(both.x_accounts_seen.trading_list_members, 126);
  const job = both.what_an_isolated_browser_must_read;
  assert.ok(job.steps.some((s) => /x\.com\/<me>\/following/.test(s)));
  assert.match(job.where, /never Alan's Chrome/i);
  assert.match(job.never, /Read only/);
});
test('X list changes and subscriptions are proposals for Alan, never actions', async () => {
  const src = await text('scripts/yt-x-both-ways.mjs');
  assert.ok(!/method:\s*['"]POST|subscriptions\.insert|lists\/members\/create/i.test(src), 'the builder only ever sends GET');
  assert.ok(both.proposals.x_list_adds_for_alan.every((p) => p.x_handle && isChannelId(p.channel_id)));
});

test('staged SQL: the current ids stay first and in order, only sure settled matches are added', async () => {
  const current = JSON.parse(await text(STAGED + 'yt_bridge_channels.current-row.txt'));
  const up = await text(STAGED + 'Y3_bridge_adds.sql');
  const value = JSON.parse(up.match(/\$y3\$(.*?)\$y3\$/s)[1]);
  assert.deepEqual(value.ids.slice(0, current.ids.length), current.ids);
  const added = value.ids.slice(current.ids.length);
  assert.deepEqual(added, both.proposals.add_to_bridge_staged.map((a) => a.channel_id));
  assert.equal(new Set(value.ids).size, value.ids.length);
  const sure = new Map(both.x_to_youtube.trading_list_settled.filter((s) => s.verdict === 'sure').map((s) => [s.channel_id, s]));
  for (const id of added) { assert.ok(sure.has(id), id); assert.match(sure.get(id).why, /About/); }
  /* the neighbours: the sweep still reads the row, and the on-air check still fits one pass */
  assert.deepEqual(bridgeChannelIds(value), value.ids);
  assert.ok(value.ids.length <= MAX_LIVE_PROBES);
});
test('staged SQL: it touches one row, only while that row is unchanged, and never deletes', async () => {
  const currentText = await text(STAGED + 'yt_bridge_channels.current-row.txt');
  const up = await text(STAGED + 'Y3_bridge_adds.sql');
  const sql = up.split('\n').filter((l) => !l.startsWith('--')).join('\n');
  assert.equal((sql.match(/\bupdate\b/gi) || []).length, 1);
  assert.ok(!/\b(delete|drop|truncate|insert|alter)\b/i.test(sql.replace(/\$y3\$.*?\$y3\$/s, '')));
  assert.match(sql, /where key = 'yt_bridge_channels'/);
  assert.ok(sql.includes(createHash('sha256').update(currentText).digest('hex')));
});
test('staged SQL: the rollback is the row as it stood, byte for byte', async () => {
  const currentText = await text(STAGED + 'yt_bridge_channels.current-row.txt');
  const down = await text(STAGED + 'Y3_bridge_adds_ROLLBACK.sql');
  assert.equal(down.match(/\$y3\$(.*?)\$y3\$/s)[1], currentText);
  assert.deepEqual(JSON.parse(currentText).ids, bridgeChannelIds(y2));
});
test('nothing in the Y3 files carries a credential', async () => {
  for (const p of ['control/YOUTUBE_X_BOTH_WAYS.json', STAGED + 'Y3_bridge_adds.sql', STAGED + 'Y3_bridge_adds_ROLLBACK.sql',
    'deliverables/20261005/y3-both-ways/data/channel-lists.json', 'scripts/yt-x-both-ways.mjs']) {
    const t = await text(p);
    assert.ok(!/AIza[0-9A-Za-z_-]{30,}|GOCSPX-|1\/\/0[0-9A-Za-z_-]{20,}|refresh_token|client_secret/i.test(t), p);
  }
});

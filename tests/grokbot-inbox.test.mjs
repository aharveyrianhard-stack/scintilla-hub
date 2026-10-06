// GB1 · the grokbot-inbox edge function, run under Node against a pretend database.
// The token below is a made-up test value; the real one is a function secret the coordinator sets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHandler, sortItems, sameSecret, KINDS, MAX_BYTES, HEARTBEAT_JOB, TEXT_NOT_STORED } from '../supabase/functions/grokbot-inbox/core.mjs';
import { normalizePost as sharedNormalize } from '../supabase/functions/_shared/xfeed-normalize.mjs';
import { normalizePost as collectorNormalize } from '../scripts/xfeed-ingest.mjs';
import { build, TARGET } from '../scripts/build-grokbot-xfeed-normalize.mjs';

const TOKEN = 'test-only-placeholder-token-not-a-secret-0001';
const URL_ = 'https://inbox.test/functions/v1/grokbot-inbox';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/** a pretend database API: keeps rows per table, upserts on the on_conflict key, and — like the real one —
    refuses a statement that names the same key twice. */
function fakeDb({ failTable = null, failRpc = false, config = [] } = {}) {
  const tables = new Map(), calls = [], rpcs = [];
  const T = (name) => { if (!tables.has(name)) tables.set(name, new Map()); return tables.get(name); };
  const col = (row, c) => (c.endsWith('_lc') ? String(row[c.slice(0, -3)]).toLowerCase() : String(row[c]));
  async function fetchFake(url, init = {}) {
    const u = new URL(url), path = u.pathname.replace('/rest/v1/', '');
    calls.push({ method: init.method || 'GET', path, headers: init.headers });
    const ok = (body, status = 200) => new Response(body == null ? null : JSON.stringify(body), { status });
    if ((init.method || 'GET') === 'GET') {
      if (path === 'app_config') return ok(config);
      if (path === 'grokbot_inbox_last') {
        const last = {};
        for (const r of T('grokbot_inbox').values()) if (r.kind && ['ok', 'partial'].includes(r.outcome)) last[r.kind] = r.received_at;
        return ok(Object.entries(last).map(([kind, last_received_at]) => ({ kind, last_received_at })));
      }
      return ok([]);
    }
    const body = JSON.parse(init.body);
    if (path.startsWith('rpc/')) { if (failRpc) return ok({ message: 'no such function' }, 404); rpcs.push({ name: path.slice(4), args: body }); return ok(null, 204); }
    if (path === failTable) return ok({ message: 'database is away' }, 500);
    const conflict = u.searchParams.get('on_conflict');
    if (!conflict) { T(path).set(String(T(path).size + 1), body); return ok(null, 201); }
    const keys = body.map((row) => conflict.split(',').map((c) => col(row, c)).join('|'));
    if (new Set(keys).size !== keys.length) return ok({ code: '21000', message: 'ON CONFLICT DO UPDATE command cannot affect row a second time' }, 500);
    if (new Set(body.map((row) => Object.keys(row).sort().join(','))).size > 1) return ok({ code: 'PGRST102', message: 'All object keys must match' }, 400);
    body.forEach((row, i) => T(path).set(keys[i], { ...(T(path).get(keys[i]) || {}), ...row }));
    return ok(null, 201);
  }
  return { fetch: fetchFake, tables, rows: (name) => [...T(name).values()], calls, rpcs };
}
function inbox(opts = {}, env = {}) {
  const db = fakeDb(opts);
  let tick = Date.parse('2026-10-06T14:00:00Z');
  const handler = createHandler({ url: 'https://db.test', serviceKey: 'service-role-placeholder', token: TOKEN, textAllowed: false, ...env },
    { fetch: db.fetch, now: () => new Date((tick += 1000)) });
  const post = (body, { token = TOKEN, headers = {} } = {}) => handler(new Request(URL_, { method: 'POST',
    headers: { ...(token == null ? {} : { Authorization: 'Bearer ' + token }), 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body) }));
  const get = (token = TOKEN) => handler(new Request(URL_, { headers: token == null ? {} : { Authorization: 'Bearer ' + token } }));
  return { db, handler, post, get };
}
const SENT = '2026-10-06T13:45:00Z';
const xPost = (over = {}) => ({ id: '1975000000000000001', handle: 'alphatrends', kind: 'original', created_at: '2026-10-06T13:31:07.000Z',
  text: '$NVDA holding the 5-day. $AMD lagging.', url: 'https://x.com/alphatrends/status/1975000000000000001', list: 'tracked', ...over });
const env = (kind, items, over = {}) => ({ kind, sent_at: SENT, items, ...over });

test('GB1 · the X validators the function uses are the collector\'s own, cut out unchanged', () => {
  assert.equal(read('supabase/functions/_shared/xfeed-normalize.mjs'), build(), 'run: node scripts/build-grokbot-xfeed-normalize.mjs');
  assert.ok(TARGET.endsWith('supabase/functions/_shared/xfeed-normalize.mjs'));
  const sample = xPost({ kind: 'quote', original: { id: '1974999999999999999', handle: 'TrendSpider', text: '$SPY breadth', url: 'https://x.com/TrendSpider/status/1974999999999999999' } });
  assert.deepEqual(sharedNormalize(sample, { collected_at: SENT }), collectorNormalize(sample, { collected_at: SENT }));
  for (const bad of [xPost({ id: 1975000000000000001 }), xPost({ url: 'https://example.com/alphatrends/status/1975000000000000001' }), xPost({ created_at: '2026-10-06 13:31' })]) {
    assert.throws(() => sharedNormalize(bad)); assert.throws(() => collectorNormalize(bad));
  }
});

test('GB1 · closed without a configured token, 401 on a wrong or missing one, 405 on other methods', async () => {
  for (const token of ['', 'short-token']) {
    const handler = createHandler({ url: 'https://db.test', serviceKey: 'k', token }, { fetch: fakeDb().fetch });
    const r = await handler(new Request(URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: '{}' }));
    assert.equal(r.status, 503); assert.equal((await r.json()).error, 'inbox_not_configured');
  }
  const { post, get, handler, db } = inbox();
  for (const token of [null, '', 'wrong-token-wrong-token-wrong-token-0000000', TOKEN + 'x', TOKEN.slice(0, -1)]) {
    const r = await post(env('heartbeat', []), { token });
    assert.equal(r.status, 401, 'token: ' + token);
    assert.equal((await get(token)).status, 401);
  }
  assert.equal(db.calls.length, 0, 'an unauthorised request never reaches the database');
  assert.equal((await handler(new Request(URL_, { method: 'PUT', headers: { Authorization: 'Bearer ' + TOKEN }, body: '{}' }))).status, 405);
  assert.equal((await handler(new Request(URL_, { method: 'DELETE', headers: { Authorization: 'Bearer ' + TOKEN } }))).status, 405);
  assert.equal(await sameSecret(TOKEN, TOKEN), true);
  assert.equal(await sameSecret(TOKEN, TOKEN + ' '), false);
  assert.equal(await sameSecret('', TOKEN), false);
});

test('GB1 · good X posts are filed; the same post twice is one row; a repost is its own row', async () => {
  const { post, db } = inbox();
  const repost = xPost({ id: '1975000000000000002', handle: 'ripster47', kind: 'repost', text: '', url: 'https://x.com/ripster47/status/1975000000000000002',
    original: { id: '1975000000000000001', handle: 'alphatrends', text: '$NVDA holding the 5-day.', url: 'https://x.com/alphatrends/status/1975000000000000001' } });
  const reply = xPost({ id: '1975000000000000003', kind: 'reply', text: 'agree', url: 'https://x.com/alphatrends/status/1975000000000000003' });
  const r1 = await post(env('x_posts', [xPost(), repost, reply, xPost({ text: '$NVDA holding the 5-day. $AMD lagging. (edited)' })]));
  assert.equal(r1.status, 200);
  assert.deepEqual(await r1.json(), { ok: true, kind: 'x_posts', accepted: 4, rejected: [] });
  assert.equal(db.rows('x_posts').length, 3, 'the same id twice in one POST is one row');
  const again = await post(env('x_posts', [xPost(), repost, reply]));
  assert.equal((await again.json()).accepted, 3);
  assert.equal(db.rows('x_posts').length, 3, 'the same POST again adds nothing');
  const row = db.rows('x_posts').find((x) => x.record_key === 'post:1975000000000000001');
  assert.equal(row.post_id, '1975000000000000001'); assert.equal(typeof row.post_id, 'string');
  assert.deepEqual(row.tickers, ['NVDA', 'AMD']);
  assert.equal(row.source, 'grokbot'); assert.equal(row.list, 'tracked'); assert.equal(row.created_at, '2026-10-06T13:31:07.000Z');
  assert.equal(row.provenance.collection_source, 'grokbot');
  assert.ok(!('raw' in row) && !JSON.stringify(row).includes('"raw"'), 'no second copy of the item');
  assert.ok(db.rows('x_posts').some((x) => x.record_key === 'repost:ripster47:1975000000000000002'));
  assert.equal(db.rows('x_posts').find((x) => x.kind === 'reply').kind, 'reply', 'replies are kept, marked as replies');
  assert.equal(db.rows('grokbot_inbox').length, 2, 'both envelopes are logged');
});

test('GB1 · bad X posts are rejected one by one, with the reason; the good ones still land', async () => {
  const { post, db } = inbox();
  const r = await post(env('x_posts', [
    xPost(),
    xPost({ id: 1975000000000000005 }),
    xPost({ id: '1975000000000000006', url: 'https://evil.example/alphatrends/status/1975000000000000006' }),
    xPost({ id: '1975000000000000007', url: 'https://x.com/alphatrends/status/1975000000000000007', created_at: '2026-10-06T13:31:07' }),
    xPost({ id: '1975000000000000008', url: 'https://x.com/alphatrends/status/1975000000000000999' }),
    xPost({ id: '1975000000000000009', url: 'https://x.com/alphatrends/status/1975000000000000009', handle: 'not a handle' }),
    xPost({ id: '1975000000000000010', url: 'https://x.com/alphatrends/status/1975000000000000010', kind: 'thread' }),
    'not an object',
    xPost({ id: '1975000000000000011', url: 'https://x.com/alphatrends/status/1975000000000000011', list: 'Tracked List!' }),
  ]));
  const out = await r.json();
  assert.equal(r.status, 200); assert.equal(out.accepted, 1);
  assert.deepEqual(out.rejected.map((x) => x.i), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.match(out.rejected[0].reason, /decimal string/); assert.match(out.rejected[1].reason, /X or Twitter/);
  assert.match(out.rejected[2].reason, /timezone/); assert.match(out.rejected[3].reason, /does not match the extracted post ID/);
  assert.equal(db.rows('x_posts').length, 1);
  const logged = db.rows('grokbot_inbox')[0];
  assert.equal(logged.outcome, 'partial'); assert.equal(logged.accepted, 1); assert.equal(logged.rejected, 8);
  const none = await post(env('x_posts', [xPost({ id: 7 })]));
  assert.equal((await none.json()).accepted, 0);
  assert.deepEqual(db.rpcs.at(-1).args, { p_job: HEARTBEAT_JOB, p_ok: false, p_cause: 'ALL_REJECTED', p_detail: 'id must be a decimal string, never a JavaScript number' });
});

test('GB1 · more than 1 MB is refused before anything is read into the database', async () => {
  const { post, handler, db } = inbox();
  const big = JSON.stringify(env('x_posts', [xPost({ text: 'x'.repeat(MAX_BYTES) })]));
  const declared = await post(big, { headers: { 'Content-Length': String(Buffer.byteLength(big)) } });
  assert.equal(declared.status, 413); assert.equal((await declared.json()).max_bytes, MAX_BYTES);
  /* a sender that does not say how big the body is: counted while it streams */
  const bytes = new TextEncoder().encode(big);
  const stream = new ReadableStream({ start(c) { for (let i = 0; i < bytes.length; i += 65536) c.enqueue(bytes.slice(i, i + 65536)); c.close(); } });
  const streamed = await handler(new Request(URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN }, body: stream, duplex: 'half' }));
  assert.equal(streamed.status, 413);
  assert.equal(db.calls.length, 0);
  const under = await post(env('x_posts', [xPost({ text: 'x'.repeat(20000) })]));
  assert.equal(under.status, 200);
});

test('GB1 · a broken envelope is a 400 with the reason, is logged, and marks the heartbeat as failing', async () => {
  const { post, db } = inbox();
  const cases = [['{not json', /not valid UTF-8 JSON/], [JSON.stringify([1]), /must be an object/], [env('tweets', []), /kind must be one of/],
    [env('x_posts', [], { sent_at: '2026-10-06 13:45' }), /sent_at/], [env('x_posts', { a: 1 }), /items must be a list/],
    [{ kind: 'x_posts', sent_at: SENT }, /items must be a list/], [env('x_following', Array.from({ length: 2001 }, () => ({}))), /more than 2000/]];
  for (const [body, why] of cases) {
    const r = await post(body); const out = await r.json();
    assert.equal(r.status, 400); assert.equal(out.error, 'bad_envelope'); assert.match(out.reason, why); assert.equal(out.accepted, 0);
  }
  assert.equal(db.rows('grokbot_inbox').length, cases.length);
  assert.ok(db.rows('grokbot_inbox').every((r) => r.outcome === 'bad_envelope' && !('envelope' in r)));
  assert.ok(db.rpcs.every((p) => p.args.p_ok === false && p.args.p_cause === 'BAD_ENVELOPE'));
});

test('GB1 · YouTube chunks: scores and previews are kept, transcript text is not — until Alan allows it', async () => {
  const chunk = (over = {}) => ({ video_id: 'dQw4w9WgXcQ', t_start: 754, t_end: 812, tickers: ['$mu', 'NVDA'], score: 0.62, model: 'finbert-tone-v1',
    preview: 'Micron revenue 54 billion versus 51 estimate', text: 'the full words of the chunk', ...over });
  const closed = inbox();
  const r = await closed.post(env('youtube_chunks', [chunk(), chunk({ t_start: 900, t_end: 950, tickers: undefined, ticker: null, text: undefined }),
    chunk({ preview: 'p'.repeat(201) }), chunk({ video_id: 'short' }), chunk({ score: 1.5 }), chunk({ t_start: 12.5 }), chunk({ t_end: 10 }), chunk({ model: '' }), chunk({ ticker: 'MU' })]));
  const out = await r.json();
  assert.equal(out.accepted, 2); assert.deepEqual(out.rejected.map((x) => x.i), [2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(out.warnings, [TEXT_NOT_STORED]);
  const rows = closed.db.rows('youtube_chunks');
  assert.deepEqual(rows.map((x) => x.ticker).sort(), ['', 'MU', 'NVDA']);
  assert.ok(rows.every((x) => !('text' in x)), 'no text column is written');
  assert.ok(!JSON.stringify([...closed.db.tables.get('grokbot_inbox').values()]).includes('the full words of the chunk'), 'the log does not keep the text either');
  assert.equal(rows.find((x) => x.ticker === 'MU').score, 0.62);

  const open = inbox({}, { textAllowed: true });
  assert.equal((await (await open.post(env('youtube_chunks', [chunk()]))).json()).warnings, undefined);
  assert.equal(open.db.rows('youtube_chunks').find((x) => x.ticker === 'MU').text, 'the full words of the chunk');
  await open.post(env('youtube_chunks', [chunk({ text: undefined, score: -0.2, model: 'finbert-tone-v1' })]));
  const after = open.db.rows('youtube_chunks').find((x) => x.ticker === 'MU');
  assert.equal(after.score, -0.2); assert.equal(after.text, 'the full words of the chunk', 'a score-only resend does not blank stored text');
  assert.equal(open.db.rows('youtube_chunks').length, 2, 'same chunk, same model = same rows');
});

test('GB1 · channel map, following lists and news scores are filed once each', async () => {
  const { post, db } = inbox();
  const map = [{ x_handle: '@WOLF_TradingX', channel_id: 'UCvTUPg9PxLq3DO72AZBygNg', channel_title: 'WOLF Trading', channel_handle: '@WOLFTrading', confidence: 'high', evidence: 'bio link' },
    { x_handle: 'wolf_tradingx', channel_id: 'UCvTUPg9PxLq3DO72AZBygNg' }, { x_handle: 'x', channel_id: 'not-a-channel' }, { x_handle: 'x', channel_id: 'UCvTUPg9PxLq3DO72AZBygNg', confidence: 'certain' }];
  const m = await (await post(env('youtube_channel_map', map))).json();
  assert.equal(m.accepted, 2); assert.deepEqual(m.rejected.map((x) => x.i), [2, 3]);
  assert.equal(db.rows('x_youtube_channel_map').length, 1, 'capitals do not make a second row');
  const f = await (await post(env('x_following', [{ handle: 'alphatrends', list: 'following', name: 'Brian Shannon' }, { handle: 'AlphaTrends', list: 'following' },
    { handle: 'alphatrends', list: 'trading', seen_at: '2026-10-06T09:00:00-04:00' }, { handle: 'alphatrends' }, { handle: 'way_too_long_for_an_x_handle', list: 'following' }]))).json();
  assert.equal(f.accepted, 3); assert.deepEqual(f.rejected.map((x) => x.i), [3, 4]);
  assert.equal(db.rows('x_following').length, 2);
  assert.equal(db.rows('x_following').find((x) => x.list === 'trading').seen_at, '2026-10-06T13:00:00.000Z');
  assert.equal(db.rows('x_following').find((x) => x.list === 'following').seen_at, '2026-10-06T13:45:00.000Z', 'seen_at falls back to sent_at');
  const news = { url: 'https://www.tipranks.com/news/micron-beats', tickers: ['MU'], score: 0.4, model: 'finbert-tone-v1', title: 'Micron beats', published_at: '2026-10-06T12:00:00Z' };
  const n = await (await post(env('news_scores', [news, news, { ...news, url: 'ftp://x/y' }, { ...news, score: 'bullish' }]))).json();
  assert.equal(n.accepted, 2); assert.deepEqual(n.rejected.map((x) => x.i), [2, 3]);
  assert.equal(db.rows('grokbot_news_scores').length, 1);
});

test('GB1 · every accepted POST pings the heartbeat row; a database failure asks for a retry and stores nothing as accepted', async () => {
  const { post, db } = inbox();
  const hb = await post({ kind: 'heartbeat', sent_at: SENT, status: { ledger_accounts: 129, note: 'quiet hour' } });
  assert.deepEqual(await hb.json(), { ok: true, kind: 'heartbeat', accepted: 0, rejected: [] });
  await post(env('x_posts', [xPost()]));
  assert.deepEqual(db.rpcs.map((p) => [p.name, p.args.p_job, p.args.p_ok, p.args.p_cause]),
    [['job_heartbeat_ping', 'grokbot:inbox', true, 'OK:heartbeat'], ['job_heartbeat_ping', 'grokbot:inbox', true, 'OK:x_posts']]);
  assert.equal(db.rows('grokbot_inbox')[0].envelope.status.ledger_accounts, 129);

  const down = inbox({ failTable: 'x_posts' });
  const r = await down.post(env('x_posts', [xPost()]));
  assert.equal(r.status, 503); assert.equal(r.headers.get('retry-after'), '60');
  assert.deepEqual(await r.json(), { ok: false, error: 'store_failed', retry: true, accepted: 0, rejected: [] });
  assert.equal(down.db.rows('grokbot_inbox')[0].outcome, 'store_failed');
  assert.deepEqual([down.db.rpcs[0].args.p_ok, down.db.rpcs[0].args.p_cause], [false, 'STORE_FAILED']);

  /* the heartbeat tables not being installed must never cost a POST */
  const noHeartbeat = inbox({ failRpc: true });
  assert.equal((await noHeartbeat.post(env('x_posts', [xPost()]))).status, 200);
  const noLog = inbox({ failTable: 'grokbot_inbox' });
  assert.equal((await noLog.post(env('x_posts', [xPost()]))).status, 200);
  assert.equal(noLog.db.rows('x_posts').length, 1);
});

test('GB1 · GET answers the kinds, when each last arrived, and the YouTube channels we follow', async () => {
  const config = [
    { key: 'yt_bridge_channels', value: JSON.stringify({ ids: ['UCvTUPg9PxLq3DO72AZBygNg', 'UCfD3rq06LaA8wc3s2m3LwRQ'], built_at: 'x' }) },
    { key: 'yt_sub_channels_scintilla', value: JSON.stringify({ ids: ['UCfD3rq06LaA8wc3s2m3LwRQ', 'UC2DGNpUZSnFl4RRAouQ3mLw', 'junk'], ts: 1 }) },
  ];
  const { get, post, db } = inbox({ config });
  const empty = await (await get()).json();
  assert.deepEqual(empty.kinds, KINDS);
  assert.deepEqual(empty.last_received_per_kind, { x_posts: null, youtube_chunks: null, youtube_channel_map: null, x_following: null, news_scores: null, heartbeat: null });
  assert.equal(empty.transcript_text_stored, false);
  assert.deepEqual(empty.channels.map((c) => [c.channel_id, c.from.join('+')]), [['UCvTUPg9PxLq3DO72AZBygNg', 'bridge'], ['UCfD3rq06LaA8wc3s2m3LwRQ', 'bridge+subscription:scintilla'], ['UC2DGNpUZSnFl4RRAouQ3mLw', 'subscription:scintilla']]);
  assert.equal(empty.channels[0].rss, 'https://www.youtube.com/feeds/videos.xml?channel_id=UCvTUPg9PxLq3DO72AZBygNg');
  const asked = db.calls.find((c) => c.path === 'app_config');
  assert.ok(asked, 'reads app_config');
  await post(env('x_posts', [xPost()]));
  const after = await (await get()).json();
  assert.equal(after.last_received_per_kind.x_posts, '2026-10-06T14:00:01.000Z');
  assert.equal(after.last_received_per_kind.heartbeat, null);
  /* only the accounts the coordinator names are listed; Alan's personal subscriptions are not handed out by default */
  const wide = createHandler({ url: 'https://db.test', serviceKey: 'k', token: TOKEN, channelAccounts: ['scintilla', 'personal', 'made_up'] }, { fetch: async (u) => { wide.asked = decodeURIComponent(String(u)); return new Response('[]'); } });
  await wide(new Request(URL_, { headers: { Authorization: 'Bearer ' + TOKEN } }));
  assert.match(wide.asked, /yt_bridge_channels,yt_sub_channels_scintilla,yt_sub_channels_personal\)$/);
});

test('GB1 · the token and the service key never appear in an answer or in a logged row', async () => {
  const { post, get, db } = inbox({ failTable: 'x_following' });
  const answers = [];
  for (const r of [await post(env('x_posts', [xPost(), xPost({ id: 5 })])), await post('{bad'), await post(env('x_following', [{ handle: 'a', list: 'following' }])), await get(), await post(env('heartbeat', []), { token: 'nope' })]) answers.push(await r.text());
  const everything = answers.join('\n') + JSON.stringify([...db.tables.values()].map((t) => [...t.values()])) + JSON.stringify(db.rpcs);
  assert.ok(!everything.includes(TOKEN)); assert.ok(!everything.includes('service-role-placeholder'));
  /* and nothing secret-shaped is written into the function or the contract */
  for (const p of ['supabase/functions/grokbot-inbox/index.ts', 'supabase/functions/grokbot-inbox/core.mjs', 'supabase/migrations/20261005_grokbot_inbox.sql']) {
    assert.doesNotMatch(read(p), /eyJ[A-Za-z0-9_-]{20,}|sb_secret_|Bearer [A-Za-z0-9_-]{24,}/, p);
  }
  assert.match(read('supabase/functions/grokbot-inbox/index.ts'), /Deno\.env\.get\("GROKBOT_INBOX_TOKEN"\)/);
});

test('GB1 · the migration is additive, locks every new table, and the rollback undoes exactly it', () => {
  const up = read('supabase/migrations/20261005_grokbot_inbox.sql'), down = read('supabase/migrations/20261005_grokbot_inbox_ROLLBACK.sql');
  const code = up.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  const created = [...code.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]);
  assert.deepEqual(created, ['grokbot_inbox', 'x_posts', 'youtube_chunks', 'x_following', 'x_youtube_channel_map', 'grokbot_news_scores']);
  for (const t of created) {
    assert.match(code, new RegExp(`alter table public\\.${t}\\s+enable row level security`), t + ' has rules on');
    assert.match(down, new RegExp(`drop table if exists public\\.${t};`), t + ' is dropped by the rollback');
  }
  const revoke = /revoke all on ([\s\S]*?) from anon, authenticated, public;/.exec(code)[1];
  for (const t of created) assert.ok(revoke.includes('public.' + t), t + ' loses the public key\'s default grants');
  assert.doesNotMatch(code, /create policy/i, 'no page reads these tables today, so no policy opens them');
  assert.doesNotMatch(code, /grant[^;]*\bto\b[^;]*\b(anon|authenticated|public)\b/i);
  assert.doesNotMatch(code, /\b(drop|truncate|alter table public\.(?!grokbot_inbox|x_posts|youtube_chunks|x_following|x_youtube_channel_map|grokbot_news_scores))/i, 'touches nothing that existed');
  assert.match(code, /security_invoker = true/);
  assert.match(code, /interval '30 days'/); assert.match(down, /cron\.unschedule\('grokbot-inbox-retention'\)/);
  assert.match(code, /'grokbot:inbox', 'external'/); assert.match(code, /interval '1 hour 45 minutes', interval '15 minutes'/);
  assert.match(down, /delete from public\.job_heartbeat where job = 'grokbot:inbox'/);
  /* every table and conflict key the function writes exists in the migration */
  const core = read('supabase/functions/grokbot-inbox/core.mjs');
  for (const [, t] of core.matchAll(/table: "(\w+)"/g)) assert.ok(created.includes(t), t);
});

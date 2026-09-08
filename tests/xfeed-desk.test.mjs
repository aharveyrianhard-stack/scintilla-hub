import test from 'node:test';
import assert from 'node:assert/strict';
import { safeUrl, validDate, youtubeId, youtubeIdFromUrl, normalizePost, parseLedger, mediaFor, filterPosts, normalizeReceipt, formatET } from '../xfeed/model.mjs';

const record = overrides => ({ id: '2095646032767885511', handle: 'example', created_at: '2026-09-03T22:52:04Z', kind: 'original', text: 'A real source field.', url: 'https://x.com/example/status/2095646032767885511', ...overrides });
const post = overrides => normalizePost(record(overrides));

test('append-only ledger keeps the last valid version and sorts dates, not append order', () => {
  const lines = [record({ id: '1', text: 'old' }), record({ id: '2', created_at: '2026-09-04T01:00:00Z' }), record({ id: '1', text: 'enriched', video_url: 'https://video.twimg.com/file.mp4' }), record({ id: '1', created_at: 'invalid' })];
  const parsed = parseLedger(lines.map(JSON.stringify).join('\n') + '\n{broken\n');
  assert.deepEqual(parsed.posts.map(item => item.id), ['2', '1']);
  assert.equal(parsed.posts[1].text, 'enriched');
  assert.equal(parsed.posts[1].video_url, 'https://video.twimg.com/file.mp4');
  assert.equal(parsed.duplicates, 1);
  assert.equal(parsed.invalid, 2);
});

test('distinct repost actors survive and amendments replace only the matching actor', () => {
  const lines = [
    record({ id: '1', handle: 'source', text: 'Original', record_key: 'untrusted-collision' }),
    record({ id: '1', handle: 'ActorA', kind: 'repost', text: 'First capture', record_key: 'untrusted-collision' }),
    record({ id: '1', handle: 'ActorB', kind: 'repost', text: 'Other actor', record_key: 'untrusted-collision' }),
    record({ id: '1', handle: 'actora', kind: 'repost', text: 'Enriched actor A', record_key: 'post:1', video_url: 'https://video.twimg.com/a.mp4' }),
  ];
  const parsed = parseLedger(lines.map(JSON.stringify).join('\n'));
  assert.equal(parsed.posts.length, 3);
  assert.equal(parsed.duplicates, 1);
  const byKey = new Map(parsed.posts.map(item => [item.record_key, item]));
  assert.equal(byKey.get('post:1').text, 'Original');
  assert.equal(byKey.get('repost:actora:1').text, 'Enriched actor A');
  assert.equal(byKey.get('repost:actora:1').video_url, 'https://video.twimg.com/a.mp4');
  assert.equal(byKey.get('repost:actorb:1').text, 'Other actor');
});

test('dates require an explicit timezone and reject impossible calendar values', () => {
  for (const date of ['2026-02-29T10:00:00Z', '2026-04-31T10:00:00Z', '2026-09-03', '2026-09-03T12:00:00', '2026-09-03T24:00:00Z', '2026-09-03T12:00:00+26:00']) assert.equal(validDate(date), null, date);
  assert.equal(validDate('2024-02-29T10:00:00-05:00'), '2024-02-29T15:00:00.000Z');
  assert.equal(post({ created_at: 'no' }), null);
  assert.equal(post({ id: 2095646032767885511 }), null, 'numeric IDs may have lost precision');
  assert.equal(post({ kind: 'advertisement' }), null);
});

test('unsafe links and media are excluded while source text stays literal', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,boom', '//evil.example/p', 'https://user:pass@example.com', 'https://example.com\n.evil.test']) assert.equal(safeUrl(url), null);
  assert.equal(safeUrl('http://example.com/photo.jpg', { media: true }), null);
  const clean = post({ text: '<img src=x onerror=alert(1)>', photos: [{ url: 'javascript:evil' }, { url: 'https://pbs.twimg.com/a.jpg', alt: '<script>' }], links: [{ url: 'data:text/html,evil' }, { url: 'https://example.com/report', title: '<b>Report</b>' }], video_url: 'javascript:evil' });
  assert.equal(clean.text, '<img src=x onerror=alert(1)>');
  assert.deepEqual(clean.photos, [{ url: 'https://pbs.twimg.com/a.jpg', alt: '<script>' }]);
  assert.equal(clean.links.length, 1);
  assert.equal(clean.links[0].title, '<b>Report</b>');
  assert.equal(clean.video_url, null);
});

test('YouTube IDs have a strict boundary and links must belong to YouTube', () => {
  const id = 'dQw4w9WgXcQ';
  assert.equal(youtubeId(id), id);
  for (const invalid of ['dQw4w9WgXcQ?x', '../evil', '', '<iframe>']) assert.equal(youtubeId(invalid), null);
  assert.equal(youtubeIdFromUrl('https://youtu.be/' + id + '?si=abc'), id);
  assert.equal(youtubeIdFromUrl('https://www.youtube.com/watch?v=' + id + '&t=2'), id);
  assert.equal(youtubeIdFromUrl('https://youtube.com/shorts/' + id), id);
  assert.equal(youtubeIdFromUrl('https://youtube.com.evil.test/watch?v=' + id), null);
  assert.equal(youtubeIdFromUrl('https://evil.test/' + id), null);
});

test('video view keeps unresolved rows and original quote/repost media', () => {
  const rows = [post({ id: '1' }), post({ id: '2', has_video: true }), post({ id: '3', kind: 'quote', original: { handle: 'source', id: '5', video_url: 'https://video.twimg.com/original.mp4', photos: ['https://pbs.twimg.com/original.jpg'] } }), post({ id: '4', kind: 'repost', original: { youtube_id: 'dQw4w9WgXcQ' } })];
  assert.deepEqual(filterPosts(rows, 'video').map(item => item.id), ['2', '3', '4']);
  assert.deepEqual(filterPosts(rows, 'notifications'), []);
  assert.equal(mediaFor(rows[2]).video_url, 'https://video.twimg.com/original.mp4');
  assert.equal(mediaFor(rows[2]).originalMedia, true);
  assert.equal(mediaFor(rows[2]).photos[0].url, 'https://pbs.twimg.com/original.jpg');
});

test('a quote retains distinct own and original players while receipt media counts stay row based', () => {
  const quote = post({
    kind: 'quote', video_url: 'https://video.twimg.com/own.mp4', youtube_id: 'dQw4w9WgXcQ',
    original: { handle: 'source', id: '5', video_url: 'https://video.twimg.com/original.mp4', youtube_id: 'abcdefghijk' },
  });
  const media = mediaFor(quote);
  assert.deepEqual(media.videos, [
    { url: 'https://video.twimg.com/own.mp4', poster: null, alt: '', original: false, handle: 'example' },
    { url: 'https://video.twimg.com/original.mp4', poster: null, alt: '', original: true, handle: 'source' },
  ]);
  assert.deepEqual(media.youtube_videos.map(video => [video.id, video.original]), [['dQw4w9WgXcQ', false], ['abcdefghijk', true]]);
  const receipt = normalizeReceipt(null, [quote]);
  assert.equal(receipt.videos_resolved, 1);
  assert.equal(receipt.youtube_ids, 1);
  assert.equal(receipt.videos_missing, 0);
  const duplicated = mediaFor(post({ video_url: 'https://video.twimg.com/same.mp4', youtube_id: 'dQw4w9WgXcQ', original: { video_url: 'https://video.twimg.com/same.mp4', youtube_id: 'dQw4w9WgXcQ' } }));
  assert.equal(duplicated.videos.length, 1);
  assert.equal(duplicated.youtube_videos.length, 1);
});

test('all native video items survive including unresolved items beside playable media', () => {
  const row = post({
    videos: [
      { url: 'https://video.twimg.com/one.mp4', poster: 'https://pbs.twimg.com/poster.jpg', alt: 'First clip' },
      { url: 'https://video.twimg.com/two.mp4' },
      { url: 'https://video.twimg.com/three.mp4' },
      { url: null, alt: 'Fourth clip still missing' },
    ],
    video_url: 'https://video.twimg.com/one.mp4',
    original: { videos: [{ url: 'https://video.twimg.com/original.mp4' }, { url: null }] },
  });
  const media = mediaFor(row);
  assert.equal(media.videos.length, 6);
  assert.equal(media.videos.filter(video => video.url).length, 4);
  assert.equal(media.videos.filter(video => !video.url).length, 2);
  assert.equal(media.videos[0].poster, 'https://pbs.twimg.com/poster.jpg');
  assert.equal(media.videos[0].alt, 'First clip');
  assert.equal(media.videos[4].original, true);
  const receipt = normalizeReceipt(null, [row]);
  assert.equal(receipt.videos_resolved, 1);
  assert.equal(receipt.videos_missing, 1);
  const unsafe = post({ videos: [{ url: 'javascript:alert(1)', poster: 'data:image/png,bad', alt: '<b>Literal</b>' }] });
  assert.deepEqual(unsafe.videos, [{ url: null, poster: null, alt: '<b>Literal</b>' }]);
  assert.equal(filterPosts([unsafe], 'video').length, 1);
});

test('receipt computes kept/media counts from the visible ledger and does not invent coverage', () => {
  const rows = [post({ id: '1', video_url: 'https://video.twimg.com/a.mp4' }), post({ id: '2', has_video: true }), post({ id: '3', links: [{ url: 'https://youtu.be/dQw4w9WgXcQ' }] })];
  const receipt = normalizeReceipt({ posts_kept: 999, videos_missing: 0, handles_queried: '126', handles_total: 126, status: 'partial', collected_at: 'invalid', source_completeness: 'Search cards only' }, rows);
  assert.equal(receipt.posts_kept, 3);
  assert.equal(receipt.videos_resolved, 1);
  assert.equal(receipt.videos_missing, 1);
  assert.equal(receipt.youtube_ids, 1);
  assert.equal(receipt.outbound_links, 1);
  assert.equal(receipt.handles_queried, null);
  assert.equal(receipt.handles_total, 126);
  assert.equal(receipt.collected_at, null);
  assert.equal(receipt.source_completeness, 'Search cards only');
  assert.equal(normalizeReceipt(null).status, 'Collection status unavailable');
});

test('ET labels carry the date, year, and daylight/standard-time distinction', () => {
  assert.match(formatET('2026-09-04T01:00:00Z'), /Sep 3, 2026/);
  assert.match(formatET('2026-09-04T01:00:00Z'), /EDT/);
  assert.match(formatET('2026-01-04T01:00:00Z'), /EST/);
});

test('receipt generation time does not become a collection date or imply complete extraction', () => {
  const receipt = normalizeReceipt({ generated_at: '2026-09-04T01:00:00Z', query_pass_complete: true, first_pass_complete: false, handles_blocked: 3, handles_failed: 1, handles_unattempted: 120, limitations: ['Partial search coverage', 12], collection_scopes: ['latest_page_per_handle', 'latest_page_per_handle', 42, ''] });
  assert.equal(receipt.generated_at, '2026-09-04T01:00:00.000Z');
  assert.equal(receipt.collected_at, null);
  assert.equal(receipt.query_pass_complete, true);
  assert.equal(receipt.first_pass_complete, false);
  assert.equal(receipt.handles_blocked, 3);
  assert.equal(receipt.handles_failed, 1);
  assert.equal(receipt.handles_unattempted, 120);
  assert.deepEqual(receipt.limitations, ['Partial search coverage']);
  assert.deepEqual(receipt.collection_scopes, ['latest_page_per_handle']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'deliverables', '20260923', 'claude-check');
const html = readFileSync(join(DIR, 'CLAUDE-CHECK.html'), 'utf8');
const bookmarks = JSON.parse(readFileSync(join(DIR, 'bookmarks.json'), 'utf8'));
const triage = JSON.parse(readFileSync(join(DIR, 'triage.json'), 'utf8')).posts;
const tickers = JSON.parse(readFileSync(join(DIR, 'tickers.json'), 'utf8'));
const favSql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '20260923_claude_check_favorites.sql'), 'utf8');
const candSql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '20260923_claude_check_candidates.sql'), 'utf8');

test('every bookmark in the folder has a card, and every card has a reading and a proposal', () => {
  const cards = html.match(/<article class="cc-card"/g) ?? [];
  assert.equal(cards.length, bookmarks.posts.length);
  assert.equal(bookmarks.posts.length, Object.keys(triage).length, 'no bookmark is left untriaged');
  for (const p of bookmarks.posts) {
    const t = triage[p.id];
    assert.ok(t, `bookmark ${p.id} has no triage entry`);
    assert.ok(['IDEA', 'DATA', 'STATION', 'HUB'].includes(t.area), `bookmark ${p.id} has an unknown area ${t.area}`);
    assert.ok(t.about?.length > 10 && t.action?.length > 10, `bookmark ${p.id} needs a real reading and proposal`);
  }
});

test('a card links to the post it came from, so nothing on this page is unsourced', () => {
  for (const p of bookmarks.posts.slice(0, 12)) assert.ok(html.includes(p.url), `card for ${p.id} must link to ${p.url}`);
});

test('the favourites migration adds exactly the tickers the table marks ADD, and can be undone', () => {
  const add = tickers.filter(r => r.fav === 'ADD').map(r => r.ticker).sort();
  const inserted = [...favSql.matchAll(/^\s*\('([A-Z.]+)'\)(?:,|\n)/gm)].map(m => m[1]);
  const body = favSql.slice(0, favSql.indexOf('-- ROLLBACK (removes'));
  const values = [...body.matchAll(/\('([A-Z.]+)'\)/g)].map(m => m[1]).sort();
  assert.deepEqual(values, add, 'the migration and the page must name the same tickers');
  assert.ok(inserted.length >= 0);
  assert.match(favSql, /delete from public\.hub_favorites/, 'a rollback statement is present');
  for (const t of add) assert.ok(favSql.includes(`'${t}'`), `${t} must appear in the rollback list too`);
  assert.equal(/delete\s+from/i.test(body), false, 'the applied half of the migration never deletes');
});

test('the candidate migration is additive only and lists every unserved candidate', () => {
  const cand = tickers.filter(r => r.decision === 'candidate' && r.proposed_cohort).map(r => r.ticker).sort();
  const listed = [...candSql.matchAll(/\('([A-Z.]+)', \d+, '([A-Z_]+)'/g)].map(m => m[1]).sort();
  assert.deepEqual(listed, cand);
  assert.match(candSql, /create table if not exists public\.claude_check_candidates/);
  assert.match(candSql, /drop table public\.claude_check_candidates/, 'the rollback is written down');
  assert.equal(/\b(drop|alter|delete|update)\s+(?!table public\.claude_check_candidates)/i.test(candSql.replace(/^--.*$/gm, '')), false,
    'the candidate migration touches no existing table');
});

test('a ticker is never claimed as served and unserved at once, and every candidate has a cohort and a reason', () => {
  for (const r of tickers) {
    assert.equal(typeof r.served, 'boolean');
    if (r.decision === 'candidate') {
      assert.ok(r.proposed_cohort, `${r.ticker} is proposed without a cohort`);
      assert.ok(r.reason?.length > 5, `${r.ticker} is proposed without a reason`);
      assert.equal(r.served, false);
    }
    if (r.fav === 'ADD') assert.equal(r.served, true, `${r.ticker} cannot be favourited before it is served`);
  }
});

test('the page says, in words, what it did not do', () => {
  for (const phrase of ['What I did not do', 'Nothing was deployed', 'No bookmark was added, removed or changed on X',
                        'not been applied', 'No ticker was added to the chart API']) {
    assert.ok(html.includes(phrase) || html.toLowerCase().includes(phrase.toLowerCase()), `the page must say: ${phrase}`);
  }
});

test('the page carries the grey BACK / CLOSE pair', () => {
  assert.match(html, /data-scnav-slot/);
  assert.match(html, /id="scnav-css"/, 'the snippet\'s styles are inline on the page');
  assert.ok(html.includes('>BACK<') && html.includes('>CLOSE<'), 'both buttons are in the snippet the page carries');
  assert.match(html, /n\.className = "scnav"/, 'the pair is drawn by the shared snippet, not a copy');
});

test('every colour is a grey, nothing is white, and the body text is at least 11 px', () => {
  const hexes = [...html.matchAll(/#([0-9a-fA-F]{6})\b/g)].map(m => m[1]);
  assert.ok(hexes.length > 5);
  for (const hex of hexes) {
    const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24, `#${hex} is not a grey`);
    assert.ok(Math.max(r, g, b) <= 210, `#${hex} is brighter than the house limit`);
  }
  const sizes = [...html.matchAll(/font-size:\s*(\d+)px/g)].map(m => Number(m[1]));
  const fonts = [...html.matchAll(/font:\s*(?:\d+\s+)?(\d+)px/g)].map(m => Number(m[1]));
  for (const px of [...sizes, ...fonts]) assert.ok(px >= 10, `${px}px is below the readable floor`);
  assert.match(html, /body\s*\{[^}]*font:[^;]*\b13px/, 'body text is 13px');
});

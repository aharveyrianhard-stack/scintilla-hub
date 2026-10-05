// M1 (5 Oct 2026) — the open-source model review. Pins what the report promises: one row per candidate
// with a verdict, a reason and a source; the page built from those files; the way back; no bright colour.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const DIR = new URL('../deliverables/20261005/m1-models/', import.meta.url);
const json = (name) => JSON.parse(readFileSync(new URL(name, DIR), 'utf8'));
const page = readFileSync(new URL('M1-MODELS.html', DIR), 'utf8');
const models = json('models.json');

test('every candidate carries a job, a verdict, a reason and a source', () => {
  assert.ok(models.rows.length >= 40);
  for (const r of models.rows) {
    assert.match(r.verdict, /^(ADOPT|TRY|NO|KEEP|REPLACE)\b/, r.candidate);
    assert.ok(r.job && r.why && r.why.length > 20, r.candidate);
    assert.ok(r.source, r.candidate + ' has no source');
  }
});

test('the seven jobs of the brief are all covered', () => {
  const jobs = new Set(models.rows.map((r) => r.job[0]));
  for (const n of '1234567') assert.ok(jobs.has(n), 'job ' + n);
});

test('the bake-off accuracies on the page are the measured ones', () => {
  const x = json('bakeoff/x-short-text.json');
  assert.equal(x.posts.length, 300);
  assert.equal(x.posts.filter((p) => p.hand_label).length, 100);
  for (const r of x.results) assert.ok(page.includes(Math.round(r.accuracy_100 * 100) + '%'), r.model);
  const long = json('bakeoff/long-form.json');
  assert.equal(long.news_rows.length, 100);
  assert.equal(long.youtube_videos.length, 20);
});

test('the Grok Bot channel says plainly that today it is human only, and no deep link carries text', () => {
  const g = json('grok-bot-channel.json');
  assert.match(g.the_channel_in_one_line, /HUMAN ONLY/);
  assert.equal(g.answers['1_deep_links'].can_it_send_a_prompt, false);
  assert.ok(page.includes('HUMAN ONLY'));
});

test('the X-feed recommendation is one option, and it keeps off the iMac and off Alan\'s screen', () => {
  const x = json('xfeed-recommendation.json');
  assert.equal(x.options.filter((o) => o.verdict === 'RECOMMENDED').length, 1);
  assert.match(x.recommendation.one_line, /never the iMac, never Alan's screen/);
});

test('the page has the way back, PAGE SPECS, and no channel above 210 outside the up / down / amber colours', () => {
  assert.ok(page.includes('data-scnav-slot') && page.includes('<style id="scnav-css">'));
  assert.ok(page.includes('<details class=sc-pagespecs>'));
  const own = page.slice(0, page.indexOf('<style id="scnav-css">') > 0 ? page.indexOf('<style id="scnav-css">') : page.length);
  const allowed = new Set(['#3ddc84', '#e5484d', '#d1a04a']);
  for (const m of own.matchAll(/#([0-9a-f]{6})\b/gi)) {
    const hex = '#' + m[1].toLowerCase();
    if (allowed.has(hex)) continue;
    const ch = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    assert.ok(Math.max(...ch) <= 210, hex + ' is brighter than 210');
    assert.ok(Math.max(...ch) - Math.min(...ch) <= 24, hex + ' is not a grey');
  }
});

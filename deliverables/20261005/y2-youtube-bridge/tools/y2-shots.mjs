#!/usr/bin/env node
/** Y2 — headless pictures of the Station's SCINTILLA video grid: as it is live today, with the on-air-first change,
 *  and with the change plus the row the bridge will write for WOLF Trading (that one row is SIMULATED and says so).
 *  Headless only. Every non-GET request is blocked and counted. Reads the real feed (GET) with the page's own public key.
 *  usage: node y2-shots.mjs <station-before-dir> <station-after-dir> <out-dir> */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire('/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json');
const { chromium } = require('playwright-core');
import { parseLivePage, livePageUrl, LIVE_PAGE_HEADERS } from '../../../../supabase/functions/_shared/yt-bridge.mjs';

const [beforeDir, afterDir, outDir] = process.argv.slice(2);
const WOLF = 'UCvTUPg9PxLq3DO72AZBygNg';
const serve = (root) => new Promise((ok) => {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const file = path.join(root, p);
    if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  }).listen(0, '127.0.0.1', () => ok(server));
});
const wolfNow = parseLivePage(await (await fetch(livePageUrl(WOLF), { headers: LIVE_PAGE_HEADERS })).text());
const checkedAt = new Date().toISOString();
const browser = await chromium.launch({ headless: true });
const out = { checked_at: checkedAt, wolf_trading_on_youtube: wolfNow, shots: [] };
async function shot(name, root, width, height, simulate) {
  const server = await serve(root); const port = server.address().port;
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: width > 1000 ? 1 : 2 });
  const page = await context.newPage(); let blocked = 0; let onAirReads = 0;
  await page.route('**/*', async (route) => {
    const req = route.request();
    if (req.method() !== 'GET') { blocked++; return route.abort(); }
    if (req.url().includes('/rest/v1/youtube_feed') && req.url().includes('live_state=eq.live')) {
      onAirReads++;
      if (simulate && wolfNow.state === 'live') {
        const real = await route.fetch(); const rows = await real.json();
        rows.unshift({ video_id: wolfNow.video_id, title: wolfNow.title, channel: 'WOLF Trading', channel_id: WOLF, tickers: null, duration: 'LIVE', is_short: false,
          thumb_url: 'https://i.ytimg.com/vi/' + wolfNow.video_id + '/mqdefault.jpg', published_at: checkedAt, subscription_accounts: ['scintilla'],
          feed_at: checkedAt, live_state: 'live', starts_at: null });
        return route.fulfill({ response: real, json: rows });
      }
    }
    return route.continue();
  });
  await page.goto('http://127.0.0.1:' + port + '/station-shells/scintilla-video-v1/?feed=scintilla', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#grid .card', { timeout: 45000 });
  await page.waitForTimeout(3500);
  const tiles = await page.$$eval('#grid .card', (cards) => cards.slice(0, 8).map((c) => ({ video_id: c.dataset.v, badge: (c.querySelector('.dur') || {}).textContent || '', live: !!c.querySelector('.dur.live'),
    title: (c.querySelector('.t') || {}).textContent || '', channel: (c.querySelector('.ch') || {}).textContent || '', age: (c.querySelector('.age') || {}).textContent || '' })));
  const total = await page.$$eval('#grid .card', (cards) => cards.length);
  const firstLiveAt = await page.$$eval('#grid .card', (cards) => cards.findIndex((c) => c.querySelector('.dur.live')));
  const file = path.join(outDir, name + '.png');
  await page.screenshot({ path: file });
  out.shots.push({ name, width, height, simulated_wolf_row: !!simulate && wolfNow.state === 'live', non_get_blocked: blocked, on_air_reads: onAirReads, tiles_on_page: total, first_live_tile_position: firstLiveAt + 1, first_tiles: tiles });
  await context.close(); server.close();
}
await shot('before-1680', beforeDir, 1680, 1000, false);
await shot('after-1680', afterDir, 1680, 1000, false);
await shot('after-bridged-1680', afterDir, 1680, 1000, true);
await shot('before-390', beforeDir, 390, 844, false);
await shot('after-390', afterDir, 390, 844, false);
await shot('after-bridged-390', afterDir, 390, 844, true);
await browser.close();
fs.writeFileSync(path.join(outDir, '..', 'tools', 'shots.json'), JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out.shots.map((s) => [s.name, s.tiles_on_page, s.first_live_tile_position, s.non_get_blocked, s.first_tiles.slice(0, 3).map((t) => (t.live ? 'LIVE ' : '') + t.channel)])));
console.log('wolf', JSON.stringify(wolfNow), checkedAt);

#!/usr/bin/env node
// Offline proof of scripts/xfeed-program.mjs against a SYNTHETIC Trading list.
// Everything runs in a temporary runtime and a temporary browser profile; x.com is never
// contacted (every request is answered or aborted by the fixture router) and the real
// operational runtime is never opened. This is NOT a live capture and never claims one.
//
//   node tests/manual/xfeed-program-proof.mjs --out /path/to/evidence
import { mkdtemp, rm, mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { runCollector, loadPlaywright, REPOSITORY } from '../../scripts/xfeed-program.mjs';

const args = process.argv.slice(2);
const out = resolve(args[args.indexOf('--out') + 1] || join(REPOSITORY, 'deliverables', 'xfeed-program-proof'));
const fixtures = join(REPOSITORY, 'tests', 'fixtures', 'xfeed-program');
await mkdir(out, { recursive: true });
const runtime = await mkdtemp(join(tmpdir(), 'xfeed-proof-runtime-'));
const profile = join(runtime, 'collector-profile');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const readJson = async p => JSON.parse(await readFile(p, 'utf8'));
const summary = { note: 'SYNTHETIC offline proof; not a live capture', runtime, started_at: new Date().toISOString(), runs: [], screenshots: [] };

// 0. Seed the temporary runtime exactly as the intake's own --initialize does (the committed historical snapshot).
await new Promise((ok, no) => { const c = spawn(process.execPath, [join(REPOSITORY, 'scripts', 'xfeed-capture-server.mjs'), '--initialize', '--runtime-dir', runtime], { stdio: 'inherit' }); c.on('exit', code => (code === 0 ? ok() : no(new Error(`initialize exit ${code}`)))); });

async function run(name, fixture, extra = {}) {
  const receipt = await runCollector({ runtimeDir: runtime, profileDir: profile, fixture: join(fixtures, fixture), headless: true, maxPages: 10, budgetSeconds: 240, initialPages: 3, ...extra });
  const heartbeat = await readJson(join(runtime, 'heartbeat.json')).catch(() => null);
  const health = await readJson(join(runtime, 'program-health.json'));
  const entry = { name, fixture, status: receipt.status, meaning: receipt.meaning, pages: receipt.pages, saved_chunks: receipt.saved_chunks, finish_reason: receipt.finish_reason ?? null, finish: receipt.finish ?? null, error: receipt.error ?? null, status_publication: receipt.status_publication ?? null, preview: receipt.preview ?? null, heartbeat, health_last_run: health.last_run, health_last_good: health.last_good_pass, browser: receipt.browser };
  summary.runs.push(entry);
  await writeFile(join(out, `receipt-${name}.json`), JSON.stringify(receipt, null, 2));
  process.stdout.write(`\n[${name}] ${receipt.status} — ${receipt.meaning} (pages ${receipt.pages}, finish ${receipt.finish_reason ?? '-'})\n`);
  await sleep(1500); // let the spawned intake release the port
  return entry;
}

// 1–4. The four states the program must handle.
const first = await run('first-pass', 'run1.json');
const recurring = await run('recurring-pass', 'run2.json');
const feedAfterGood = join(out, 'feed-after-recurring.json');
await copyFile(join(runtime, 'preview', 'feed.json'), feedAfterGood).catch(() => {});
const signedOut = await run('signed-out', 'signed-out.json');
const feedSignedOut = join(out, 'feed-signed-out.json');
await copyFile(join(runtime, 'preview', 'feed.json'), feedSignedOut).catch(() => {});
const limited = await run('rate-limited', 'rate-limited.json');
const feedLimited = join(out, 'feed-rate-limited.json');
await copyFile(join(runtime, 'preview', 'feed.json'), feedLimited).catch(() => {});

// 5. The X Desk itself, served by the existing read-only preview server, one screenshot per state.
const stateFile = join(out, 'preview-state.json');
await writeFile(stateFile, JSON.stringify({ api_file: feedAfterGood }));
const preview = spawn(process.execPath, [join(REPOSITORY, 'scripts', 'xfeed-preview-server.mjs'), '--api-file', feedAfterGood, '--state-file', stateFile, '--root', REPOSITORY, '--port', '8767'], { stdio: ['ignore', 'pipe', 'inherit'] });
preview.stdout.on('data', () => {});
await sleep(1200);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true });
async function shoot(name, feed, viewport = { width: 1280, height: 900 }) {
  await writeFile(stateFile, JSON.stringify({ api_file: feed }));
  const page = await browser.newPage({ viewport });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await page.goto('http://127.0.0.1:8767/xfeed/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !/Connecting/.test(document.querySelector('#feed-status')?.textContent || ''), null, { timeout: 30000 }).catch(() => {});
  await page.locator('#receipt summary').click().catch(() => {});
  await page.waitForTimeout(800);
  const status = await page.locator('#feed-status').textContent();
  const receiptText = await page.locator('#receipt-content').textContent().catch(() => '');
  const firstRows = await page.locator('#tape li').evaluateAll(rows => rows.slice(0, 3).map(r => r.textContent.replace(/\s+/g, ' ').trim().slice(0, 160)));
  const file = join(out, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  summary.screenshots.push({ name, file, status_label: status, receipt_excerpt: receiptText.replace(/\s+/g, ' ').slice(0, 400), first_rows: firstRows });
  process.stdout.write(`[shot] ${name}: ${status}\n`);
  await page.close();
}
await shoot('desk-after-recurring-pass', feedAfterGood);
await shoot('desk-after-recurring-pass-phone', feedAfterGood, { width: 390, height: 844 });
await shoot('desk-signed-out', feedSignedOut);
await shoot('desk-rate-limited', feedLimited);
await browser.close();
preview.kill('SIGTERM');

summary.finished_at = new Date().toISOString();
summary.expectations = {
  first_pass_finished_initial_window: first.status === 'finished_unpublished' && first.finish_reason === 'initial_window',
  recurring_pass_finished_on_frontier_overlap: recurring.status === 'finished_unpublished' && recurring.finish_reason === 'overlap',
  signed_out_reported_loudly: signedOut.status === 'signed_out' && signedOut.heartbeat?.collector_status === 'error' && /signed out/.test(signedOut.heartbeat?.collector_error || ''),
  rate_limit_kept_pass_and_recorded_retry: limited.status === 'rate_limited' && limited.heartbeat?.collector_retry_at === '2026-09-23T08:00:00.000Z',
  last_good_pass_survives_failures: limited.health_last_good?.pass_id === recurring.health_last_run.pass_id,
};
await writeFile(join(out, 'proof-summary.json'), JSON.stringify(summary, null, 2));
process.stdout.write(`\n${JSON.stringify(summary.expectations, null, 2)}\nruntime kept at ${runtime}\n`);
await rm(profile, { recursive: true, force: true });

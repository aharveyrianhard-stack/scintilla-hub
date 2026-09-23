#!/usr/bin/env node
/**
 * xfeed-program.mjs — the X Trading-list collector as a PROGRAM, not a chat session.
 *
 * One scheduled run = one source pass:
 *   dedicated persistent Chrome profile (Playwright) -> the unchanged trusted helper
 *   scripts/xfeed-browser-cycle.js -> the unchanged loopback intake
 *   scripts/xfeed-capture-server.mjs (spawned for the run if it is not already up)
 *   -> finish + publication exactly as before.
 *
 * Never calls the X API. Never reads, exports or copies cookies or credentials.
 * Never prints .env.local (it is only handed to the intake as --env-file).
 * Never touches Alan's everyday Chrome: the profile directory is the collector's own.
 *
 *   node scripts/xfeed-program.mjs run      [--max-pages N] [--budget-seconds N] [--catch-up] [--headless]
 *                                           [--profile DIR] [--runtime-dir DIR] [--env-file FILE] [--chrome PATH]
 *                                           [--fixture FILE]   (offline synthetic list; never a live capture)
 *   node scripts/xfeed-program.mjs sign-in  opens the collector profile on x.com for the one human step
 *   node scripts/xfeed-program.mjs status   prints the program health file and the intake health
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir, rename, appendFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { randomBytes } from 'node:crypto';
import { homedir, hostname } from 'node:os';
import { DEFAULT_RUNTIME } from './xfeed-capture-server.mjs';
import { markCollectorError, safeErrorMessage } from './xfeed-collector-status.mjs';

export const REPOSITORY = dirname(dirname(fileURLToPath(import.meta.url)));
export const LIST_URL = 'https://x.com/i/lists/1405188850188759047';
export const INTAKE = 'http://127.0.0.1:8766';
export const DEFAULT_PROFILE = join(homedir(), 'Library', 'Application Support', 'Scintilla', 'xfeed-collector-profile');
export const SCHEDULE_ET = [[6, 30], [10, 30], [14, 30], [18, 30]];
export const CADENCE_STALE_SECONDS = 6 * 3600 + 30 * 60; // one missed slot plus margin before the desk calls it stale
export const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chrome.app/Contents/MacOS/Google Chrome',
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function readJson(path) { try { return JSON.parse(await readFile(path, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } }
async function atomic(path, value) { await mkdir(dirname(path), { recursive: true }); const t = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`; await writeFile(t, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 }); await rename(t, path); }

// ---------------------------------------------------------------- pure pieces (tested offline)

/** Sequenced buffer that gives the helper the CUA-style readEvents() contract over a Playwright CDP session. */
export function createEventBuffer({ max = 20000 } = {}) {
  const events = []; const waiters = new Set(); let seq = 0, dropped = 0;
  return {
    push(method, params) {
      events.push({ seq: ++seq, method, params });
      if (events.length > max) { events.shift(); dropped++; }
      for (const wake of waiters) wake();
    },
    get size() { return events.length; },
    async readEvents({ afterSequence, methods = null, limit = 1000, timeoutMs = 0 } = {}) {
      // No afterSequence = "position me at now" (the helper does this once in begin()).
      if (afterSequence === undefined || afterSequence === null) return { cursor: seq, events: [], hasMore: false, truncated: false };
      const select = () => events.filter(e => e.seq > afterSequence && (!methods || methods.includes(e.method)));
      let picked = select();
      if (!picked.length && timeoutMs > 0) {
        await new Promise(resolveWait => { const timer = setTimeout(done, timeoutMs); function done() { clearTimeout(timer); waiters.delete(done); resolveWait(); } waiters.add(done); });
        picked = select();
      }
      const oldest = events[0]?.seq ?? seq + 1;
      const truncated = dropped > 0 && afterSequence + 1 < oldest; // something between the cursor and the oldest retained event is gone
      const page = picked.slice(0, limit);
      return { cursor: page.length ? page[page.length - 1].seq : seq, events: page, hasMore: picked.length > limit, truncated };
    },
  };
}

/** What the source looked like when no timeline page could be captured. */
export function classifySource({ url = '', loginMarker = false, timelineSeen = false, blocked = null } = {}) {
  if (blocked && [401, 403].includes(blocked.status)) return 'signed_out';
  if (blocked && blocked.status === 429) return 'rate_limited';
  if (blocked) return 'blocked';
  if (/\/i\/flow\/login|\/login(?:[/?#]|$)|\/account\/access/.test(url) || loginMarker) return 'signed_out';
  if (!timelineSeen) return 'no_timeline';
  return 'ok';
}

/** The actual retry instant X told us, or null. Never a guess. */
export function retryAtFromRates(rates = {}, observedAt = new Date().toISOString()) {
  const reset = Number(rates?.['x-rate-limit-reset']);
  if (Number.isSafeInteger(reset) && reset > 1e9) return new Date(reset * 1000).toISOString();
  const after = Number(rates?.['retry-after']);
  if (Number.isSafeInteger(after) && after >= 0) return new Date(Date.parse(observedAt) + after * 1000).toISOString();
  return null;
}

function wallClock(ms, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(ms));
  const get = type => Number(parts.find(p => p.type === type).value);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour') % 24, mi: get('minute') };
}
/** A wall-clock time in a zone -> UTC instant, DST-aware. */
export function zonedInstant(y, m, d, h, mi, timeZone = 'America/New_York') {
  let guess = Date.UTC(y, m - 1, d, h, mi);
  for (let i = 0; i < 3; i++) {
    const w = wallClock(guess, timeZone);
    const diff = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi) - Date.UTC(y, m - 1, d, h, mi);
    if (!diff) break;
    guess -= diff;
  }
  return guess;
}
/** The next `count` scheduled instants (ISO) after `now` for the ET cadence. */
export function nextScheduled(now = Date.now(), schedule = SCHEDULE_ET, timeZone = 'America/New_York', count = 4) {
  const out = [];
  for (let dayOffset = 0; out.length < count && dayOffset < 4; dayOffset++) {
    const w = wallClock(now + dayOffset * 86400e3, timeZone);
    for (const [h, mi] of schedule) { const t = zonedInstant(w.y, w.m, w.d, h, mi, timeZone); if (t > now) out.push(new Date(t).toISOString()); }
  }
  return [...new Set(out)].sort().slice(0, count);
}

/** One decision per loop turn. The intake's health is the authority on frontier and chain. */
export function decide({ summary, pending, checkpoint, pages, maxPages, elapsedMs, budgetMs, stalledRounds = 0, initialPages = 3 }) {
  const integrity = pending?.response_integrity ?? null;
  if (summary.blocked) return { action: 'stop', status: classifySource({ blocked: summary.blocked }) };
  if (pending && pending.previous_frontier_observed && integrity?.cursor_chain_verified && !(integrity.missing_chunks?.length)) return { action: 'finish', reason: 'overlap' };
  if (!checkpoint && pending?.list_captures > 0 && (pages >= initialPages || stalledRounds >= 1)) return { action: 'finish', reason: 'initial_window' };
  if (summary.rate_exhausted) return { action: 'stop', status: 'rate_limited' };
  if (stalledRounds >= 2) return { action: 'finish', reason: 'timeline_end' };
  if (pages >= maxPages) return { action: 'stop', status: 'incomplete_page_budget' };
  if (elapsedMs >= budgetMs) return { action: 'stop', status: 'incomplete_time_budget' };
  return { action: 'page' };
}

export function humanStatus(status) {
  return {
    published: 'pass finished and published',
    finished_unpublished: 'pass finished; publication not configured on this host',
    paused_until_retry: 'X asked us to wait; run skipped until the recorded retry time',
    signed_out: 'the collector browser is signed out of X — open the sign-in file',
    rate_limited: 'X rate limit reached; pass kept, will continue at the recorded retry time',
    blocked: 'X returned an error response to the list; pass kept',
    no_timeline: 'the Trading list loaded without a timeline response (layout or network change)',
    stalled_without_termination: 'the list stopped paging without an end marker; pass kept',
    incomplete_page_budget: 'page budget used up before the last published frontier was reached; pass kept',
    incomplete_time_budget: 'time budget used up before the last published frontier was reached; pass kept',
    intake_unavailable: 'the local intake service could not be started',
    crashed: 'the program failed unexpectedly',
  }[status] ?? status;
}

// ---------------------------------------------------------------- browser + intake plumbing

export function loadPlaywright(from = process.env.XFEED_PLAYWRIGHT_FROM) {
  const require = createRequire(from ? join(resolve(from), 'package.json') : import.meta.url);
  return require('playwright');
}

export async function launchBrowser(o, deps = {}) {
  const chromium = deps.chromium ?? loadPlaywright(o.playwrightFrom).chromium;
  const executablePath = o.chromePath ?? process.env.XFEED_CHROME ?? CHROME_CANDIDATES.find(p => existsSync(p));
  await mkdir(o.profileDir, { recursive: true, mode: 0o700 });
  const context = await chromium.launchPersistentContext(o.profileDir, {
    headless: Boolean(o.headless), ...(executablePath ? { executablePath } : {}),
    viewport: { width: 1280, height: 900 }, args: ['--no-first-run', '--no-default-browser-check'], timeout: 60000,
  });
  if (o.fixture) await installFixture(context, JSON.parse(await readFile(o.fixture, 'utf8')));
  return { context, executablePath: executablePath ?? 'playwright-bundled-chromium' };
}

/** Adapters giving the unchanged helper its `source`, `ui` and `cdp` handles over one Playwright page. */
export function cdpAdapters(page, session, buffer = createEventBuffer()) {
  session.on('Network.responseReceived', params => buffer.push('Network.responseReceived', params));
  const cap = { send: (method, params = {}) => session.send(method, params), readEvents: options => buffer.readEvents(options) };
  const source = {
    capabilities: { get: async name => (name === 'cdp' ? cap : null) },
    url: async () => page.url(),
    goto: async url => { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); },
    reload: async () => { await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }); },
  };
  const ui = {
    // The helper asks for an ordinary scroll inside the list column; wheel it in steps so the timeline's observers fire.
    // Keep wheeling until X actually requests the next page, then let that page finish arriving.
    // A fixed 8,000 px was shorter than one page of Alan's list, so X never reached the bottom and
    // never asked for page two (first live run, 23 Sep: "stalled_without_termination" after 1 page).
    scroll: async ([x, y], direction, amount) => {
      await page.mouse.move(x, y);
      const sign = direction === 'up' ? -1 : 1;
      if (typeof page.waitForResponse !== 'function') {   // offline test doubles: the old fixed scroll
        for (let done = 0; done < amount * 100; done += 800) { await page.mouse.wheel(0, sign * 800); await page.waitForTimeout(120); }
        await page.waitForTimeout(1500);
        return;
      }
      let settled = false;
      const next = page.waitForResponse(r => r.url().includes('/ListLatestTweetsTimeline'), { timeout: 25000 })
        .then(r => r.finished().then(() => r)).catch(() => null).finally(() => { settled = true; });
      const floor = amount * 100, t0 = Date.now();
      for (let done = 0; (done < floor || !settled) && Date.now() - t0 < 25000; done += 800) {
        await page.mouse.wheel(0, sign * 800); await page.waitForTimeout(150);
        if (settled && done >= floor) break;
      }
      await next;
      await page.waitForTimeout(400);
    },
  };
  return { source, ui, cap, buffer };
}

export async function hasLoginMarker(page) {
  try { return (await page.locator('[data-testid="loginButton"], [data-testid="login"], a[href="/login"], a[href="/i/flow/login"], input[autocomplete="username"]').count()) > 0; }
  catch { return false; }
}

export async function loadCycleFactory() {
  const helper = await readFile(join(REPOSITORY, 'scripts', 'xfeed-browser-cycle.js'), 'utf8');
  return runInNewContext(`${helper}\ncreateXfeedBrowserCycle`, { URL, JSON, Date, Error, Object, Array, Map, Set, String, console });
}

export async function intakeHealth(intake = INTAKE, fetchImpl = fetch) {
  const response = await fetchImpl(`${intake}/health`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`intake health HTTP ${response.status}`);
  return response.json();
}

/** Use an intake that is already up for this runtime, otherwise run one for the duration of this pass. */
export async function ensureIntake({ intake = INTAKE, runtimeDir, envFile = null, staleAfterSeconds = CADENCE_STALE_SECONDS, log = { write() {} }, spawnImpl = spawn, fetchImpl = fetch } = {}) {
  const existing = await intakeHealth(intake, fetchImpl).catch(() => null);
  if (existing) {
    if (resolve(existing.runtime_dir) !== resolve(runtimeDir)) throw new Error(`an intake on ${intake} already serves a different runtime (${existing.runtime_dir})`);
    return { spawned: false, publication_enabled: Boolean(existing.publication_enabled), stop: async () => {} };
  }
  const args = [...(envFile ? [`--env-file=${envFile}`] : []), join(REPOSITORY, 'scripts', 'xfeed-capture-server.mjs'), '--serve', ...(envFile ? ['--publish'] : []), '--runtime-dir', runtimeDir, '--stale-after-seconds', String(staleAfterSeconds)];
  const child = spawnImpl(process.execPath, args, { cwd: REPOSITORY, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout?.on('data', d => log.write(`[intake] ${d}`)); child.stderr?.on('data', d => log.write(`[intake!] ${d}`));
  const until = Date.now() + 20000; let health = null;
  while (!health && Date.now() < until) {
    await sleep(400);
    if (child.exitCode !== null) throw new Error(`intake exited during startup (code ${child.exitCode})`);
    health = await intakeHealth(intake, fetchImpl).catch(() => null);
  }
  if (!health) { child.kill('SIGTERM'); throw new Error(`intake did not answer on ${intake} within 20 s`); }
  return { spawned: true, publication_enabled: Boolean(health.publication_enabled), stop: async () => { child.kill('SIGTERM'); await new Promise(r => { child.once('exit', r); setTimeout(r, 3000).unref(); }); } };
}

// ---------------------------------------------------------------- offline fixture (synthetic list, never live)

const LIST_ID = '1405188850188759047';
const xDate = iso => new Date(iso).toUTCString().replace(/^(\w{3}), (\d{2}) (\w{3}) (\d{4}) (\d{2}:\d{2}:\d{2}) GMT$/, '$1 $3 $2 $5 +0000 $4');
function fixtureEntry(post) {
  const user = { rest_id: `9${post.id.slice(-6)}`, core: { screen_name: post.handle } };
  return { entryId: `tweet-${post.id}`, content: { itemContent: { tweet_results: { result: { rest_id: post.id, core: { user_results: { result: user } }, legacy: { id_str: post.id, user_id_str: user.rest_id, created_at: xDate(post.created_at), full_text: post.text, entities: { urls: [] } } } } } } };
}
export function fixtureTimeline(posts, bottom, terminate = false) {
  const entries = posts.map(fixtureEntry);
  if (bottom) entries.push({ entryId: 'cursor-bottom-0', content: { cursorType: 'Bottom', value: bottom } });
  const instructions = [{ type: 'TimelineAddEntries', entries }];
  if (terminate) instructions.push({ type: 'TimelineTerminateTimeline', direction: 'Bottom' });
  return { data: { list: { tweets_timeline: { timeline: { instructions } } } } };
}
const FIXTURE_LIST_HTML = `<!doctype html><meta charset="utf-8"><title>SYNTHETIC Trading list fixture (not X)</title>
<body style="margin:0;font:16px system-ui;background:#111;color:#ddd">
<h1 style="position:fixed;top:0;left:0;right:0;margin:0;padding:8px;background:#900;font-size:16px">SYNTHETIC LIST FIXTURE — offline proof, not x.com</h1>
<main id="list" style="padding-top:60px"></main>
<script>
const LIST='${LIST_ID}'; let cursor, loading=false, done=false, first=true;
async function load(){ if(loading||done) return; loading=true;
  const v={listId:LIST}; if(!first) v.cursor=cursor; first=false;
  const r=await fetch('/i/api/graphql/EXAMPLE/ListLatestTweetsTimeline?variables='+encodeURIComponent(JSON.stringify(v)));
  if(!r.ok){ done=true; loading=false; return; }
  const j=await r.json(); let next=null;
  for(const i of j.data.list.tweets_timeline.timeline.instructions){ if(i.type==='TimelineTerminateTimeline') done=true;
    for(const e of (i.entries||[])){ if(e.content&&e.content.cursorType==='Bottom'){ next=e.content.value; continue; } if(!e.content||!e.content.itemContent) continue;
      const t=e.content.itemContent.tweet_results.result; const a=document.createElement('article'); a.style.cssText='height:400px;border-bottom:1px solid #333;padding:12px';
      a.textContent='@'+t.core.user_results.result.core.screen_name+': '+t.legacy.full_text; document.getElementById('list').append(a); } }
  cursor=next; if(!next) done=true; loading=false; }
addEventListener('scroll',()=>{ if(innerHeight+scrollY>=document.body.scrollHeight-1500) load(); });
load();
</script>`;
const FIXTURE_LOGIN_HTML = '<!doctype html><meta charset="utf-8"><title>Log in to X / X (SYNTHETIC)</title><body><h1>SYNTHETIC sign-in wall</h1><form action="/i/flow/login"><input autocomplete="username" name="text"><button data-testid="loginButton">Next</button></form>';

export async function installFixture(context, fixture) {
  const byCursor = new Map((fixture.pages ?? []).map(p => [p.cursor ?? null, p]));
  let served = 0;
  await context.route('**/*', route => route.abort('blockedbyclient')); // offline: nothing but the fixture and the loopback intake
  await context.route(/^https?:\/\/127\.0\.0\.1(?::\d+)?\//, route => route.continue());
  await context.route(/^https:\/\/(?:www\.)?x\.com\//, async route => {
    const url = new URL(route.request().url());
    if (fixture.mode === 'signed_out') {
      if (url.pathname.startsWith('/i/flow/login')) return route.fulfill({ status: 200, contentType: 'text/html', body: FIXTURE_LOGIN_HTML });
      return route.fulfill({ status: 302, headers: { location: `https://x.com/i/flow/login?redirect_after_login=${encodeURIComponent(url.pathname)}` }, body: '' });
    }
    if (url.pathname.includes('/ListLatestTweetsTimeline')) {
      const variables = JSON.parse(url.searchParams.get('variables') || '{}');
      const page = byCursor.get(variables.cursor ?? null);
      served++;
      const headers = { 'x-rate-limit-limit': '500', 'x-rate-limit-remaining': String(Math.max(0, 499 - served)), 'x-rate-limit-reset': String(Math.floor(Date.now() / 1000) + 900), ...(page?.rates ?? {}) };
      if (!page) return route.fulfill({ status: 200, contentType: 'application/json', headers, body: JSON.stringify(fixtureTimeline([], null, true)) });
      if (page.status && page.status !== 200) return route.fulfill({ status: page.status, contentType: 'application/json', headers, body: '{"errors":[{"message":"SYNTHETIC"}]}' });
      return route.fulfill({ status: 200, contentType: 'application/json', headers, body: JSON.stringify(fixtureTimeline(page.posts ?? [], page.bottom ?? null, page.terminate === true)) });
    }
    if (url.pathname.startsWith('/i/lists/')) return route.fulfill({ status: 200, contentType: 'text/html', body: FIXTURE_LIST_HTML });
    return route.fulfill({ status: 204, body: '' });
  });
}

// ---------------------------------------------------------------- health, receipts, loud failure

function createLog(path) {
  let chain = mkdir(dirname(path), { recursive: true });
  return { write(line) { chain = chain.then(() => appendFile(path, `${new Date().toISOString()} ${String(line).trimEnd()}\n`)).catch(() => {}); }, close: () => chain };
}
export async function writeHealth(runtimeDir, receipt, o = {}) {
  const path = join(runtimeDir, 'program-health.json');
  const prior = await readJson(path) ?? {};
  const good = ['published', 'finished_unpublished'].includes(receipt.status);
  const health = {
    program: 'xfeed-program', host: receipt.host, updated_at: receipt.finished_at ?? receipt.started_at,
    last_run: { pass_id: receipt.pass_id, started_at: receipt.started_at, finished_at: receipt.finished_at ?? null, status: receipt.status, meaning: humanStatus(receipt.status), pages: receipt.pages ?? 0, saved_chunks: receipt.saved_chunks ?? 0, error: receipt.error ?? null, publication: receipt.publication ?? null, status_published: receipt.status_published ?? null, fixture: receipt.fixture ?? null },
    last_good_pass: good ? { pass_id: receipt.pass_id, finished_at: receipt.finished_at, published: receipt.status === 'published', latest_source_event_at: receipt.latest_source_event_at ?? null } : prior.last_good_pass ?? null,
    schedule_et: SCHEDULE_ET.map(([h, mi]) => `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`),
    next_scheduled: nextScheduled(Date.now()),
    profile_dir: o.profileDir ?? null, runtime_dir: runtimeDir, intake: o.intake ?? INTAKE,
  };
  await atomic(path, health);
  return health;
}
function localPreviewPublisher(o) {
  return async ({ statusFile, dataDir }) => {
    const { writePreview } = await import('./xfeed-publish.mjs');
    const outputPath = join(o.runtimeDir, 'preview', 'feed.json');
    const result = await writePreview({ dataDir, statusFile, notificationsFile: join(dataDir, 'notifications.json'), outputPath });
    return { version: result.version, local_preview: outputPath, published: false };
  };
}
/** Publish the failure over the last good feed so the X Desk says it in words. */
export async function reportLoud(o, receipt, status, message, retryAt = null, log = { write() {} }) {
  const error = safeErrorMessage(`${humanStatus(status)} (${status}): ${message}`);
  receipt.error = error; receipt.status_published = false;
  try {
    if (receipt.publication === 'blob') {
      // The documented operating command, in a child so the publication secrets never enter this process.
      const args = [`--env-file=${o.envFile}`, join(REPOSITORY, 'scripts', 'xfeed-collector-status.mjs'), '--error', error, ...(retryAt ? ['--retry-at', retryAt] : []), '--runtime-dir', o.runtimeDir];
      const out = await new Promise((done, fail) => { const child = spawn(process.execPath, args, { cwd: REPOSITORY, stdio: ['ignore', 'pipe', 'pipe'] }); let text = '', err = ''; child.stdout.on('data', d => { text += d; }); child.stderr.on('data', d => { err += d; }); child.on('exit', code => (code === 0 ? done(text) : fail(new Error(err.trim() || `status publisher exit ${code}`)))); });
      receipt.status_published = true; receipt.status_publication = JSON.parse(out);
    } else {
      const result = await markCollectorError({ runtimeDir: o.runtimeDir, error, retryAt, publishLastGood: localPreviewPublisher(o), environment: {} });
      receipt.status_publication = { ...result, published: false, note: 'publication not configured on this host; status saved to heartbeat.json and the local preview feed' };
    }
  } catch (e) { receipt.status_publication = { failed: true, error: safeErrorMessage(String(e.message)) }; log.write(`status publication failed: ${e.message}`); }
  return receipt;
}

// ---------------------------------------------------------------- the run

export const DEFAULTS = { runtimeDir: DEFAULT_RUNTIME, profileDir: DEFAULT_PROFILE, intake: INTAKE, maxPages: 60, budgetSeconds: 1500, initialPages: 3, headless: false, chromePath: null, envFile: null, fixture: null, staleAfterSeconds: CADENCE_STALE_SECONDS, playwrightFrom: process.env.XFEED_PLAYWRIGHT_FROM ?? null };

export async function runCollector(options = {}, deps = {}) {
  const o = { ...DEFAULTS, ...options };
  o.envFile = o.envFile ?? (existsSync(join(REPOSITORY, '.env.local')) ? join(REPOSITORY, '.env.local') : null);
  const clock = deps.clock ?? (() => new Date().toISOString());
  const startedAt = clock(), passId = `program-${startedAt.replace(/[:.]/g, '-')}`;
  const runDir = join(o.runtimeDir, 'runs', passId);
  const log = createLog(join(o.runtimeDir, 'logs', `program-${startedAt.slice(0, 10)}.log`));
  const receipt = { program: 'xfeed-program', pass_id: passId, host: hostname(), started_at: startedAt, status: 'starting', pages: 0, saved_chunks: 0, profile_dir: o.profileDir, runtime_dir: o.runtimeDir, publication: o.envFile ? 'blob' : 'preview-only', fixture: o.fixture ? 'SYNTHETIC fixture run — not a live capture' : null, max_pages: o.maxPages, budget_seconds: o.budgetSeconds };
  const finishWith = async (status, extra = {}) => { Object.assign(receipt, { status, finished_at: clock(), meaning: humanStatus(status), ...extra }); await atomic(join(runDir, 'receipt.json'), receipt); await writeHealth(o.runtimeDir, receipt, o); log.write(`${passId} ${status}: ${receipt.error ?? ''}`); return receipt; };
  const loud = async (status, message, retryAt = null) => { await reportLoud(o, receipt, status, message, retryAt, log); return finishWith(status); };
  let intake = null, browser = null;
  log.write(`${passId} start (publication ${receipt.publication}${o.fixture ? ', SYNTHETIC fixture' : ''})`);
  try {
    try { intake = await ensureIntake({ intake: o.intake, runtimeDir: o.runtimeDir, envFile: o.envFile, staleAfterSeconds: o.staleAfterSeconds, log }); }
    catch (e) { return await loud('intake_unavailable', e.message); }
    receipt.intake_spawned = intake.spawned;
    const before = await intakeHealth(o.intake);
    receipt.checkpoint_before = before.checkpoint ?? null;
    const retryAt = before.heartbeat?.collector_retry_at;
    if (retryAt && Date.parse(retryAt) > Date.parse(clock())) return await finishWith('paused_until_retry', { retry_at: retryAt });

    browser = await launchBrowser(o, deps);
    receipt.browser = browser.executablePath;
    const page = await browser.context.newPage(), intakePage = await browser.context.newPage();
    const { source, ui } = cdpAdapters(page, await browser.context.newCDPSession(page));
    const createCycle = await loadCycleFactory();
    const cycle = await createCycle({ source, intake: { playwright: intakePage, goto: url => intakePage.goto(url) }, ui, passId });
    const budgetMs = o.budgetSeconds * 1000, t0 = Date.now();
    // WAIT FOR X BEFORE JUDGING. The list's first timeline request fires seconds after the page
    // loads, and the helper's read() returns at once while other responses keep arriving, so the
    // first live run on 23 Sep called "no timeline" before X had even asked for it. Register the
    // wait before begin() navigates, and let the body finish downloading before the first read.
    const firstTimeline = typeof page.waitForResponse === 'function'
      ? page.waitForResponse(r => r.url().includes('/ListLatestTweetsTimeline'), { timeout: 45000 })
        .then(r => r.finished().then(() => r)).catch(() => null)
      : Promise.resolve(null);
    let summary = await cycle.begin(), stalled = 0, lastPages = 0;
    if (summary.pages === 0 && !summary.blocked) {
      receipt.first_timeline_seen = Boolean(await firstTimeline);
      summary = await cycle.read();
    }
    for (;;) {
      for (let i = 0; i < 8 && !summary.blocked && (summary.pending_bodies > 0 || (summary.pages === 0 && i < 6)); i++) summary = await cycle.read();
      while (summary.pending_chunks > 0) summary = await cycle.save(8);
      Object.assign(receipt, { pages: summary.pages, saved_chunks: summary.saved_chunks, rates: summary.rates ?? null });
      if (summary.pages === 0 && !summary.blocked) {
        const status = classifySource({ url: page.url(), loginMarker: await hasLoginMarker(page), timelineSeen: false });
        const landed = (() => { try { return new URL(page.url()).pathname; } catch { return page.url(); } })();
        // Public wording: what happened and where the browser landed; local paths stay in the receipt only.
        receipt.profile_dir_note = status === 'signed_out' ? `profile ${o.profileDir} needs the one-time sign-in` : null;
        return await loud(status, status === 'signed_out' ? `the collector browser landed on ${landed} instead of the Trading list` : `the Trading list at ${landed} produced no timeline response`);
      }
      const health = await intakeHealth(o.intake);
      const pending = health.pending_passes.find(p => p.pass_id === passId) ?? null;
      stalled = summary.pages === lastPages ? stalled + 1 : 0; lastPages = summary.pages;
      const decision = decide({ summary, pending, checkpoint: health.checkpoint, pages: summary.pages, maxPages: o.maxPages, elapsedMs: Date.now() - t0, budgetMs, stalledRounds: stalled, initialPages: o.initialPages });
      log.write(`${passId} pages=${summary.pages} saved=${summary.saved_chunks} frontier=${pending?.previous_frontier_observed ?? null} chain=${pending?.response_integrity?.cursor_chain_verified ?? null} -> ${decision.action} ${decision.reason ?? decision.status ?? ''}`);
      if (decision.action === 'finish') {
        let result;
        try { result = JSON.parse(await cycle.finish(decision.reason)); }
        catch (e) { if (decision.reason === 'timeline_end') return await loud('stalled_without_termination', e.message); throw e; }
        receipt.finish_reason = decision.reason; receipt.finish = { published: result.published, completed_at: result.source_receipt?.completed_at ?? result.completed_at ?? null, coverage_status: result.source_receipt?.status ?? null, observed_posts: result.source_receipt?.coverage?.observed_posts ?? null };
        receipt.latest_source_event_at = result.source_receipt?.coverage?.latest_observed_post_at ?? null;
        if (receipt.publication !== 'blob') { try { receipt.preview = await localPreviewPublisher(o)({ statusFile: join(o.runtimeDir, 'heartbeat.json'), dataDir: join(o.runtimeDir, 'data') }); } catch (e) { receipt.preview = { failed: e.message }; } }
        return await finishWith(result.published ? 'published' : 'finished_unpublished');
      }
      if (decision.action === 'stop') {
        const rates = summary.blocked?.rates ?? summary.rate_exhausted?.rates ?? summary.rates ?? {};
        const retry = ['rate_limited', 'blocked'].includes(decision.status) ? retryAtFromRates(rates, summary.blocked?.observed_at ?? summary.rate_exhausted?.observed_at ?? clock()) : null;
        const detail = summary.blocked ? `HTTP ${summary.blocked.status} from the list timeline` : `${summary.pages} pages captured, last published frontier ${health.checkpoint?.observed_at ?? 'none'} not yet reached`;
        return await loud(decision.status, detail, retry);
      }
      summary = await cycle.older();
    }
  } catch (error) {
    log.write(`crash: ${error.stack ?? error.message}`);
    return await loud('crashed', String(error.message));
  } finally {
    await browser?.context.close().catch(() => {});
    await intake?.stop().catch(() => {});
    await log.close();
  }
}

async function signIn(o) {
  const { context } = await launchBrowser({ ...o, headless: false, fixture: null });
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto('https://x.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  process.stdout.write(`\nSign in to X in the Chrome window that just opened.\nThat window is the collector's own profile (${o.profileDir}); your everyday Chrome is untouched.\nClose the window when you are done, then the scheduled runs will use it.\n\n`);
  await new Promise(done => { context.once('close', done); page.once('close', () => setTimeout(done, 500)); });
  await context.close().catch(() => {});
  process.stdout.write('Profile saved. Test it now with: node scripts/xfeed-program.mjs run --max-pages 3 --budget-seconds 180\n');
}

async function status(o) {
  const health = await readJson(join(o.runtimeDir, 'program-health.json'));
  const heartbeat = await readJson(join(o.runtimeDir, 'heartbeat.json'));
  const intake = await intakeHealth(o.intake).catch(e => ({ unavailable: e.message }));
  process.stdout.write(`${JSON.stringify({ program_health: health, heartbeat, intake: intake.unavailable ? intake : { status: intake.status, publication_enabled: intake.publication_enabled, checkpoint: intake.checkpoint, pending_passes: intake.pending_passes?.map(p => ({ pass_id: p.pass_id, pages: p.list_captures, posts: p.posts, previous_frontier_observed: p.previous_frontier_observed })) } }, null, 2)}\n`);
}

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const o = {};
  const map = { '--profile': 'profileDir', '--runtime-dir': 'runtimeDir', '--intake': 'intake', '--max-pages': 'maxPages', '--budget-seconds': 'budgetSeconds', '--initial-pages': 'initialPages', '--env-file': 'envFile', '--chrome': 'chromePath', '--fixture': 'fixture', '--playwright-from': 'playwrightFrom', '--stale-after-seconds': 'staleAfterSeconds' };
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i];
    if (key === '--headless') o.headless = true;
    else if (key === '--catch-up') { o.maxPages = 600; o.budgetSeconds = 3000; }
    else if (map[key] && rest[i + 1] !== undefined) { const value = rest[++i]; o[map[key]] = ['maxPages', 'budgetSeconds', 'initialPages', 'staleAfterSeconds'].includes(map[key]) ? Number(value) : value; }
    else throw new Error(`unknown or incomplete option ${key}`);
  }
  for (const k of ['maxPages', 'budgetSeconds', 'initialPages', 'staleAfterSeconds']) if (o[k] !== undefined && !(Number.isSafeInteger(o[k]) && o[k] > 0)) throw new Error(`${k} must be a positive integer`);
  for (const k of ['runtimeDir', 'profileDir', 'envFile', 'fixture', 'playwrightFrom']) if (o[k]) o[k] = resolve(o[k]);
  if (!['run', 'sign-in', 'status'].includes(command)) throw new Error('Usage: node scripts/xfeed-program.mjs <run|sign-in|status> [options]');
  return { command, options: o };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (async () => {
    const { command, options } = parseArgs(process.argv.slice(2));
    const o = { ...DEFAULTS, ...options };
    if (command === 'run') { const receipt = await runCollector(options); process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`); process.exitCode = ['published', 'finished_unpublished', 'paused_until_retry'].includes(receipt.status) ? 0 : 2; }
    else if (command === 'sign-in') await signIn(o);
    else await status(o);
  })().catch(error => { process.stderr.write(`xfeed-program failed: ${error.message}\n`); process.exitCode = 1; });
}

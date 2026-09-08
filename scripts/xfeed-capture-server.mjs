#!/usr/bin/env node
/** Loopback intake for browser-observed X responses. This service never requests X. */
import http from 'node:http';
import { readFile, writeFile, mkdir, rename, readdir, copyFile, access } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { transformResponse, verifyMembers, TRADING_LIST_ID } from './xfeed-source.mjs';
import { ingest, latestPosts, recordKey, timestamp } from './xfeed-ingest.mjs';

const REPOSITORY = dirname(dirname(fileURLToPath(import.meta.url)));
export const DEFAULT_RUNTIME = '/Users/alanharvey/SCINTILLA 0.5/_orchestration/xfeed-live/runtime';
const MAX_BODY = 16 * 1024 * 1024;
const LIST_URL = `https://x.com/i/lists/${TRADING_LIST_ID}`;
const passId = value => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.-]{1,100}$/.test(value) || ['__proto__', 'constructor', 'prototype'].includes(value)) throw new Error('pass_id is required (letters, digits, underscore, hyphen, dot; max100)');
  return value;
};
async function json(path, fallback) { try { return JSON.parse(await readFile(path, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return fallback; throw e; } }
async function atomic(path, value) { await mkdir(dirname(path), { recursive: true }); const temp = `${path}.${process.pid}.${randomBytes(5).toString('hex')}.tmp`; await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 }); await rename(temp, path); }
async function ledger(path) { try { return (await readFile(path, 'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse); } catch (e) { if (e.code === 'ENOENT') return []; throw e; } }
const cleanState = () => ({ schema_version: 1, passes: {}, details: {}, checkpoint: null });

export async function initializeRuntime({ runtimeDir = DEFAULT_RUNTIME, seedDir = join(REPOSITORY, 'xfeed/data') } = {}) {
  const dataDir = join(runtimeDir, 'data');
  await mkdir(dataDir, { recursive: true });
  // Initialization is explicitly requested and never overwrites an existing ledger.
  for (const name of ['HANDLES_TRADING.txt', 'ledger.jsonl', 'query-attempts.jsonl', 'receipt.json']) {
    try { await access(join(dataDir, name)); } catch (e) { if (e.code !== 'ENOENT') throw e; await copyFile(join(seedDir, name), join(dataDir, name), 1); }
  }
  if (!await json(join(runtimeDir, 'initialization.json'), null)) await atomic(join(runtimeDir, 'initialization.json'), { initialized_at: new Date().toISOString(), seed_source: seedDir, scope: 'Historical search snapshot; no list refresh or history completeness implied.' });
  return { initialized: true, data_dir: dataDir };
}

function resolveOriginals(post, details, seen = new Set(), depth = 0) {
  if (!post || depth > 4 || seen.has(post.id)) return post;
  const visited = new Set(seen).add(post.id), detail = details[post.id];
  let resolved = detail ? { ...post, ...detail, original: detail.original ?? post.original } : { ...post };
  const quoteId = resolved.raw?.legacy?.quoted_status_id_str;
  if (!resolved.original && resolved.kind === 'quote' && details[quoteId]) resolved.original = details[quoteId];
  if (resolved.original) resolved.original = depth === 4 ? null : resolveOriginals(resolved.original, details, visited, depth + 1);
  // Source raw remains the selected observed public fields; detail provenance is explicit.
  if (detail || (resolved.original && !post.original)) resolved.provenance = { ...resolved.provenance, original_resolution: { method: 'Observed TweetDetail response', source_url: (detail ?? details[quoteId])?.provenance?.source_url } };
  return resolved;
}
function postIssues(post, found = []) {
  if (!post) return found;
  if (post.kind === 'quote' && !post.original) found.push({ reason: post.raw?.original ? 'nested_post_depth_limit' : 'quoted_post_unavailable', id: post.id, original_id: post.raw?.legacy?.quoted_status_id_str ?? null });
  if (post.videos?.some(v => !v.url)) found.push({ reason: 'native_video_file_unavailable', id: post.id });
  if (post.original) postIssues(post.original, found);
  return found;
}

export function auditResponseChain(pass) {
  const responses = Object.values(pass.responses ?? {}), incomplete = [];
  for (const response of responses) {
    const missing = Array.from({ length: response.chunk_count }, (_, i) => i).filter(i => !Object.hasOwn(response.chunks, String(i)));
    if (missing.length) incomplete.push({ response_id: response.response_id, missing_chunk_indexes: missing });
  }
  const completed = responses.filter(r => !incomplete.some(i => i.response_id === r.response_id));
  const starts = completed.filter(r => Object.hasOwn(r, 'request_cursor') && r.request_cursor === null).sort((a, b) => b.observed_at.localeCompare(a.observed_at));
  const visited = [], rows = []; let current = starts[0], ambiguous = false;
  while (current && !visited.includes(current.response_id)) {
    visited.push(current.response_id);
    const chunks = Object.entries(current.chunks).sort(([a], [b]) => Number(a) - Number(b)).map(([, c]) => c);
    rows.push(...chunks.flatMap(c => c.timeline_rows));
    const bottom = chunks.flatMap(c => c.cursors).find(c => c.type === 'Bottom')?.value;
    if (!bottom) break;
    if (completed.some(r => r.request_cursor === bottom && visited.includes(r.response_id))) { ambiguous = true; break; }
    const next = completed.filter(r => r.request_cursor === bottom && !visited.includes(r.response_id));
    if (next.length > 1) ambiguous = true;
    if (next.length !== 1) break;
    current = next[0];
  }
  const unlinked = completed.filter(r => !visited.includes(r.response_id)).map(r => r.response_id);
  const metadataChunks = responses.reduce((count, response) => count + Object.keys(response.chunks).length, 0);
  return {
    metadata_response_count: responses.length, complete_response_count: completed.length, missing_chunks: incomplete,
    verified_chain_response_ids: visited, unlinked_response_ids: unlinked,
    // Earlier persisted passes leave the explicit counter absent until the
    // first legacy chunk. Absence does not mean all chunks lacked metadata.
    captures_without_response_metadata: pass.captures_without_response_metadata ?? Math.max(0, (pass.list_captures ?? 0) - metadataChunks),
    cursor_chain_verified: Boolean(visited.length && !incomplete.length && !unlinked.length && !ambiguous),
    timeline_rows: rows,
  };
}

export async function createCaptureService({ runtimeDir = DEFAULT_RUNTIME, handlesPath = join(REPOSITORY, 'xfeed/data/HANDLES_TRADING.txt'), publish = null, staleAfterSeconds = 600, clock = () => new Date().toISOString() } = {}) {
  const dataDir = join(runtimeDir, 'data'), statePath = join(runtimeDir, 'state.json');
  const handles = (await readFile(handlesPath, 'utf8')).trim().split(/\r?\n/);
  if (!handles.length || new Set(handles.map(h => h.toLowerCase())).size !== handles.length) throw new Error('configured handles are invalid');
  const allowed = new Set(handles.map(h => h.toLowerCase()));
  await mkdir(dataDir, { recursive: true });
  try { await copyFile(handlesPath, join(dataDir, 'HANDLES_TRADING.txt'), 1); } catch (e) { if (e.code !== 'EEXIST') throw e; }
  const runtimeHandles = (await readFile(join(dataDir, 'HANDLES_TRADING.txt'), 'utf8')).trim().split(/\r?\n/);
  if (JSON.stringify(runtimeHandles) !== JSON.stringify(handles)) throw new Error('runtime handle roster differs from configured roster');
  let state = await json(statePath, cleanState()), chain = Promise.resolve();
  const serialized = action => { const next = chain.then(async () => { try { return await action(); } catch (error) { state = await json(statePath, cleanState()); throw error; } }); chain = next.catch(() => {}); return next; };
  const save = () => atomic(statePath, state);
  const heartbeat = async (status, extra = {}) => atomic(join(runtimeDir, 'heartbeat.json'), { collector_status: status, last_heartbeat_at: timestamp(clock()), stale_after_seconds: staleAfterSeconds, ...extra });
  async function importPosts(posts, observedAt) {
    const inputPath = join(runtimeDir, 'current-import.json');
    await atomic(inputPath, { posts, attempts: [], collected_at: observedAt, source: 'Observed X Trading list browser responses', scope: 'list_response_window' });
    return ingest({ inputPath, dataDir, now: clock() });
  }
  async function capture(input) {
    const transformed = transformResponse(input), id = passId(input.pass_id);
    if (!['list', 'members', 'detail'].includes(transformed.response_type)) throw new Error('capture service accepts list, members, detail only');
    if (transformed.response_type === 'detail' && !transformed.posts.length) throw new Error('detail response did not contain the requested post');
    let pass = state.passes[id];
    if (pass?.completed_at) throw new Error('pass is already finished; use a new pass_id');
    const hash = createHash('sha256').update(JSON.stringify(transformed)).digest('hex');
    if (pass?.capture_hashes?.includes(hash)) return { duplicate: true, pass_id: id, posts_received: 0 };
    await atomic(join(runtimeDir, 'captures', `${hash}.json`), transformed);
    pass ??= state.passes[id] = { pass_id: id, capture_hashes: [], posts: {}, members: {}, issues: [], list_captures: 0, entry_count: 0, observed_at: transformed.observed_at, first_observed_at: transformed.observed_at, terminated_bottom: false };
    pass.capture_hashes.push(hash);
    if (transformed.observed_at > pass.observed_at) pass.observed_at = transformed.observed_at;
    if (transformed.observed_at < pass.first_observed_at) pass.first_observed_at = transformed.observed_at;
    pass.issues.push(...transformed.issues);
    if (transformed.response_type === 'list') {
      if (transformed.response_metadata) {
        const m = transformed.response_metadata;
        pass.responses ??= {};
        let response = pass.responses[m.response_id];
        if (response && (response.chunk_count !== m.response_chunk_count || response.request_cursor !== m.request_cursor)) throw new Error('response chunks disagree on count or request cursor');
        if (!response) response = pass.responses[m.response_id] = { response_id: m.response_id, chunk_count: m.response_chunk_count, observed_at: transformed.observed_at, ...(Object.hasOwn(m, 'request_cursor') ? { request_cursor: m.request_cursor } : {}), chunks: {} };
        if (response.chunks[m.response_chunk_index] && response.chunks[m.response_chunk_index].hash !== hash) throw new Error('conflicting content for the same response chunk');
        response.chunks[m.response_chunk_index] = { hash, timeline_rows: transformed.timeline_rows, cursors: transformed.cursors };
      } else pass.captures_without_response_metadata = (pass.captures_without_response_metadata ?? 0) + 1;
      if (!pass.baseline_keys) {
        const before = latestPosts(await ledger(join(dataDir, 'ledger.jsonl')));
        pass.baseline_keys = before.map(recordKey);
        pass.baseline_latest_at = before.map(p => p.created_at).sort().at(-1) ?? null;
      }
      pass.timeline_rows ??= [];
      pass.timeline_rows.push(...transformed.timeline_rows);
      pass.list_captures++; pass.entry_count += transformed.counts.entries;
      pass.list_observed_at = [pass.list_observed_at, transformed.observed_at].filter(Boolean).sort().at(-1);
      pass.terminated_bottom ||= transformed.terminated_bottom;
      pass.rate_headers = { ...pass.rate_headers, ...transformed.rate_headers };
      pass.cursors = transformed.cursors.length ? transformed.cursors : pass.cursors ?? [];
      for (const post of transformed.posts) {
        if (allowed.has(post.handle.toLowerCase())) pass.posts[recordKey(post)] = resolveOriginals(post, state.details);
        else pass.issues.push({ reason: 'nonmember_timeline_context_excluded_from_roots', id: post.id, handle: post.handle });
      }
      await importPosts(Object.values(pass.posts), transformed.observed_at);
    } else if (transformed.response_type === 'detail') {
      for (const post of transformed.posts) state.details[post.id] = post;
      for (const pending of Object.values(state.passes)) if (!pending.completed_at) for (const [key, p] of Object.entries(pending.posts)) pending.posts[key] = resolveOriginals(p, state.details);
      const roots = latestPosts(await ledger(join(dataDir, 'ledger.jsonl'))).map(p => resolveOriginals(p, state.details));
      await importPosts(roots, transformed.observed_at);
    } else {
      for (const member of transformed.members) pass.members = { ...pass.members, [member.handle.toLowerCase()]: member };
      const config = verifyMembers(Object.values(pass.members), handles, transformed.observed_at);
      await atomic(join(runtimeDir, 'membership-progress.json'), { pass_id: id, ...config });
      // Partial/unknown observations do not replace an already verified subset.
      if (config.status === 'configured') await atomic(join(dataDir, 'notifications.json'), { pass_id: id, ...config });
    }
    await save(); await heartbeat('running');
    return { saved: true, pass_id: id, response_type: transformed.response_type, posts_received: transformed.posts.length, members_received: transformed.members.length, issues: transformed.issues, capture_file: join(runtimeDir, 'captures', `${hash}.json`) };
  }
  async function finish(input) {
    const id = passId(input.pass_id), pass = state.passes[id];
    if (!pass?.list_captures) throw new Error('pass has no observed list captures');
    if (pass.completed_at) {
      if (publish && !pass.published) {
        const active = await json(join(dataDir, 'source-receipt.json'), null);
        if (active?.pass_id !== id) throw new Error('a newer source pass is active; retry publication for that pass');
        // A completed but unpublished pass may predate a diagnostic fix.
        // Recompute its persisted chunk audit without advancing any source or
        // completion clock, changing coverage boundaries, or reimporting rows.
        if (active.coverage.response_integrity) {
          const diagnostic = Object.fromEntries(Object.entries(auditResponseChain(pass)).filter(([key]) => key !== 'timeline_rows'));
          if (JSON.stringify(active.coverage.response_integrity) !== JSON.stringify(diagnostic)) {
            active.coverage.response_integrity = diagnostic;
            await atomic(join(dataDir, 'source-receipt.json'), active);
          }
        }
        await heartbeat('idle', { latest_source_event_at: active.coverage.latest_observed_post_at });
        try { pass.publication = await publish({ dataDir, statusFile: join(runtimeDir, 'heartbeat.json'), notificationsFile: join(dataDir, 'notifications.json') }); pass.published = true; delete pass.publication_error; await save(); }
        catch (error) { pass.publication_error = String(error.message); await save(); await heartbeat('error', { collector_error: 'Completed source pass could not be published' }); throw error; }
      }
      return { duplicate: true, pass_id: id, completed_at: pass.completed_at, published: pass.published ?? false };
    }
    if (!['initial_window', 'overlap', 'timeline_end'].includes(input.reason)) throw new Error('reason must be initial_window, overlap, or timeline_end');
    const checkpoint = state.checkpoint, posts = Object.values(pass.posts).map(p => resolveOriginals(p, state.details));
    const responseAudit = auditResponseChain(pass);
    if (responseAudit.missing_chunks.length) throw new Error('source response chunks are incomplete; capture missing chunks before finishing');
    const anchors = new Set((pass.timeline_rows ?? []).map(row => row.anchor_key));
    const baselineOverlap = (pass.baseline_keys ?? []).filter(key => anchors.has(key));
    const oldestSeen = (pass.timeline_rows ?? []).map(row => row.latest_action_at).sort()[0] ?? null;
    const chainAnchors = new Set(responseAudit.timeline_rows.map(row => row.anchor_key));
    const chainOverlap = (pass.baseline_keys ?? []).filter(key => chainAnchors.has(key));
    const chainOldest = responseAudit.timeline_rows.map(row => row.latest_action_at).sort()[0];
    const baselineReached = responseAudit.cursor_chain_verified && chainOverlap.length >= 2 && chainOldest && pass.baseline_latest_at && chainOldest <= pass.baseline_latest_at;
    const overlap = Boolean((checkpoint?.frontier_key && anchors.has(checkpoint.frontier_key)) || (!checkpoint && baselineReached));
    if (input.reason === 'initial_window' && checkpoint) throw new Error('initial_window is only valid before the first source checkpoint');
    if (input.reason === 'overlap' && !overlap) throw new Error('pass has not observed the previous source frontier; keep paging');
    if (input.reason === 'timeline_end' && !pass.terminated_bottom) throw new Error('no observed bottom termination proves timeline_end');
    if (!posts.length) throw new Error('a source checkpoint requires at least one extracted root post');
    const completed = timestamp(input.completed_at ?? clock(), 'completed_at');
    if (completed < pass.observed_at) throw new Error('completion cannot precede source observation');
    await importPosts(posts, pass.observed_at);
    const sorted = [...posts].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const unresolved = [...new Map([
      ...pass.issues.filter(i => !['quoted_post_unavailable', 'native_video_file_unavailable'].includes(i.reason)),
      ...posts.flatMap(p => postIssues(p)),
    ].map(i => [JSON.stringify(i), i])).values()];
    const sourceReceipt = {
      schema_version: 1, source_type: 'x_list_latest_timeline', list_id: TRADING_LIST_ID, source_url: LIST_URL, pass_id: id,
      observed_at: pass.list_observed_at, completed_at: completed,
      status: { initial_window: 'current_window_observed', overlap: 'incremental_overlap_observed', timeline_end: 'timeline_end_observed' }[input.reason],
      coverage: {
        history_complete: false, initial_history_gap_open: checkpoint ? checkpoint.initial_history_gap_open !== false : !baselineReached,
        overlap_with_previous_frontier: overlap, termination_reason: input.reason,
        cursor_chain_verified: responseAudit.cursor_chain_verified,
        refresh_interval_continuity_verified: Boolean(responseAudit.cursor_chain_verified && checkpoint && chainAnchors.has(checkpoint.frontier_key)),
        response_integrity: Object.fromEntries(Object.entries(responseAudit).filter(([key]) => key !== 'timeline_rows')),
        captured_responses_or_chunks: pass.list_captures, timeline_entries: pass.entry_count, observed_posts: posts.length,
        earliest_observed_post_at: sorted.at(-1).created_at, latest_observed_post_at: sorted[0].created_at,
        oldest_timeline_action_at: oldestSeen, frozen_baseline_latest_at: pass.baseline_latest_at,
        frozen_baseline_overlap_keys: baselineOverlap,
        previous_frontier_key: checkpoint?.frontier_key ?? null, unresolved,
        limitations: ['Only observed list timeline response windows are covered.', ...(!responseAudit.cursor_chain_verified ? ['Captured rows establish source observations; complete response chunks and a continuous cursor chain were not verified.'] : []), ...((checkpoint ? checkpoint.initial_history_gap_open !== false : !baselineReached) ? ['The interval between historical search seed and initial list window remains unverified.'] : []), 'List observation is not an individual handle query or proof of historical completeness.'],
      }, rate_headers: pass.rate_headers ?? {},
    };
    await atomic(join(dataDir, 'source-receipt.json'), sourceReceipt);
    await heartbeat('idle', { latest_source_event_at: sorted[0].created_at });
    pass.completed_at = completed; pass.reason = input.reason; pass.published = false;
    state.checkpoint = { pass_id: id, frontier_key: recordKey(sorted[0]), observed_at: pass.list_observed_at, initial_history_gap_open: sourceReceipt.coverage.initial_history_gap_open };
    await save();
    if (publish) {
      try {
        const result = await publish({ dataDir, statusFile: join(runtimeDir, 'heartbeat.json'), notificationsFile: join(dataDir, 'notifications.json') });
        pass.published = true; pass.publication = result; await save();
      } catch (error) { pass.publication_error = String(error.message); await save(); await heartbeat('error', { collector_error: 'Completed source pass could not be published' }); throw error; }
    }
    return { finished: true, pass_id: id, published: pass.published, source_receipt: sourceReceipt };
  }
  return {
    capture: input => serialized(() => capture(input)), finish: input => serialized(() => finish(input)),
    health: async () => ({ status: 'ready', collection: 'browser-observed responses only; no autonomous X requests', publication_enabled: Boolean(publish), runtime_dir: runtimeDir, checkpoint: state.checkpoint,
      pending_passes: Object.values(state.passes).filter(p => !p.completed_at).map(p => {
        const anchors = new Set((p.timeline_rows ?? []).map(row => row.anchor_key));
        return { pass_id: p.pass_id, list_captures: p.list_captures, posts: Object.keys(p.posts).length, members: Object.keys(p.members).length,
          response_integrity: Object.fromEntries(Object.entries(auditResponseChain(p)).filter(([key]) => key !== 'timeline_rows')),
          oldest_seen_at: (p.timeline_rows ?? []).map(row => row.latest_action_at).sort()[0] ?? null, baseline_latest_at: p.baseline_latest_at ?? null,
          baseline_overlap_keys: (p.baseline_keys ?? []).filter(key => anchors.has(key)), previous_frontier_observed: Boolean(state.checkpoint?.frontier_key && anchors.has(state.checkpoint.frontier_key)) };
      }), heartbeat: await json(join(runtimeDir, 'heartbeat.json'), null) }),
    runtimeDir, dataDir,
  };
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function form(token) { return `<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>X feed capture</title><style>body{max-width:850px;margin:2rem auto;background:#161616;color:#ddd;font:16px system-ui}textarea{display:block;width:100%;height:16rem;background:#222;color:#ddd}button{margin:1rem 0;padding:.6rem}a{color:#ccc}</style><h1>X feed capture</h1><form method="post" action="/capture"><input type="hidden" name="token" value="${token}"><label for="capture">Capture JSON</label><textarea id="capture" name="payload" required></textarea><button>Save capture</button></form><form method="post" action="/finish"><input type="hidden" name="token" value="${token}"><label for="finish">Pass JSON</label><textarea id="finish" name="payload" required placeholder='{"pass_id":"actual-pass-id","reason":"overlap"}'></textarea><button>Finish pass</button></form></html>`; }
export function createCaptureServer(service, { port = 8766 } = {}) {
  const token = randomBytes(24).toString('hex'), origin = `http://127.0.0.1:${port}`;
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
    const send = (status, body, type = 'application/json; charset=utf-8') => { res.writeHead(status, { 'Content-Type': type }); res.end(typeof body === 'string' ? body : JSON.stringify(body)); };
    if (req.headers.host !== `127.0.0.1:${port}` || !['127.0.0.1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) return send(403, { error: 'loopback host required' });
    if (req.headers.origin && req.headers.origin !== origin) return send(403, { error: 'cross-origin requests are not accepted' });
    if (req.method === 'GET' && req.url === '/') return send(200, form(token), 'text/html; charset=utf-8');
    if (req.method === 'GET' && req.url === '/health') return send(200, await service.health());
    if (req.method !== 'POST' || !['/capture', '/finish'].includes(req.url)) return send(404, { error: 'not found' });
    try {
      if (Number(req.headers['content-length']) > MAX_BODY) return send(413, { error: 'payload exceeds16MiB' });
      let total = 0; const chunks = [];
      for await (const chunk of req) { total += chunk.length; if (total > MAX_BODY) { send(413, { error: 'payload exceeds16MiB' }); req.destroy(); return; } chunks.push(chunk); }
      const body = Buffer.concat(chunks).toString('utf8');
      const isForm = req.headers['content-type']?.startsWith('application/x-www-form-urlencoded');
      let input;
      if (isForm) { const fields = new URLSearchParams(body); if (fields.get('token') !== token) return send(403, { error: 'invalid form token' }); input = JSON.parse(fields.get('payload')); }
      else if (req.headers['content-type']?.startsWith('application/json')) { if (req.headers.origin !== origin && req.headers['x-capture-token'] !== token) return send(403, { error: 'same-origin JSON request or capture token required' }); input = JSON.parse(body); }
      else return send(415, { error: 'use JSON or the capture form' });
      const result = await (req.url === '/capture' ? service.capture(input) : service.finish(input));
      if (isForm) return send(200, `<!doctype html><meta charset="utf-8"><title>Capture saved</title><h1>${req.url === '/capture' ? 'Capture saved' : 'Pass finished'}</h1><pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre><a href="/">New capture</a>`, 'text/html; charset=utf-8');
      send(200, result);
    } catch (error) { send(400, { error: error.message }); }
  });
}

async function main(args) {
  const flags = new Set(['--initialize', '--serve', '--publish']);
  const options = {};
  for (let i = 0; i < args.length; i++) { const key = args[i]; if (flags.has(key)) options[key] = true; else if (['--runtime-dir', '--import-captures', '--pass-id', '--finish-reason'].includes(key) && args[i + 1]) options[key] = args[++i]; else throw new Error('Usage: node scripts/xfeed-capture-server.mjs [--initialize] [--import-captures DIR --pass-id ID] [--finish-reason initial_window|overlap|timeline_end] [--serve] [--publish] [--runtime-dir DIR]'); }
  if (!args.length) throw new Error('Choose --initialize, --import-captures, or --serve explicitly; service is stopped by default');
  const runtimeDir = resolve(options['--runtime-dir'] ?? DEFAULT_RUNTIME);
  if (options['--initialize']) process.stdout.write(`${JSON.stringify(await initializeRuntime({ runtimeDir }))}\n`);
  let publisher = null;
  if (options['--publish']) publisher = (await import('./xfeed-publish.mjs')).publish;
  const service = await createCaptureService({ runtimeDir, publish: publisher });
  if (options['--import-captures']) {
    const id = passId(options['--pass-id']), directory = resolve(options['--import-captures']); let imported = 0, ignored = 0;
    for (const name of (await readdir(directory)).filter(n => n.endsWith('.json')).sort()) {
      const input = JSON.parse(await readFile(join(directory, name), 'utf8'));
      if (input.response_type === 'list' && input.pass_id !== id) { ignored++; continue; }
      if (!['list', 'members', 'detail'].includes(input.response_type)) { ignored++; continue; }
      // Member/detail samples supplied with this explicit import belong to its audit pass.
      await service.capture({ ...input, pass_id: id }); imported++;
    }
    process.stdout.write(`${JSON.stringify({ imported, ignored, pass_id: id })}\n`);
  }
  if (options['--finish-reason']) process.stdout.write(`${JSON.stringify(await service.finish({ pass_id: options['--pass-id'], reason: options['--finish-reason'] }))}\n`);
  if (options['--serve']) {
    const server = createCaptureServer(service);
    await new Promise((yes, no) => { server.once('error', no); server.listen(8766, '127.0.0.1', yes); });
    process.stdout.write('X feed capture ready at http://127.0.0.1:8766/ (browser intake only)\n');
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(error => { process.stderr.write(`X feed capture failed: ${error.message}\n`); process.exitCode = 1; });

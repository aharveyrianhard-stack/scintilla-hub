#!/usr/bin/env node
// Local verification only. Select real captured API snapshots; this server never
// manufactures posts, advances collection clocks, or writes production data.
//
// node scripts/xfeed-preview-server.mjs --api-file /tmp/capture-a.json \
//   --state-file /tmp/xfeed-preview-state.json
// State: {"api_file":"/tmp/capture-b.json","mode":"ok"}
// Error exercise: {"mode":"error","status":503}; recovery: {"mode":"ok"}
// Optional delay_ms (0..30000) tests a slow response without changing its data.
//
// Browser checks: load A, scroll to a known row/open its real video, select B,
// wait for polling, verify the row/player are unchanged and Show new posts
// appears; close media and apply updates. Then exercise error/recovery and
// Notifications. Capture A and B must be actual retained source snapshots.

import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { resolve, dirname, extname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeSnapshot } from '../xfeed/model.mjs';

const usage = 'Usage: node scripts/xfeed-preview-server.mjs --api-file <actual-feed.json> [--state-file <control.json>] [--root <worktree>] [--port 8767]';
const args = process.argv.slice(2);
if (args.includes('--help')) { process.stdout.write(usage + '\n'); process.exit(0); }
const options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!['--api-file', '--state-file', '--root', '--port'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--') || options[args[i]]) throw new Error(usage);
  options[args[i]] = args[i + 1];
}
if (!options['--api-file']) throw new Error(usage);
const root = await realpath(resolve(options['--root'] || resolve(dirname(fileURLToPath(import.meta.url)), '..')));
const apiFile = resolve(options['--api-file']);
const stateFile = options['--state-file'] ? resolve(options['--state-file']) : null;
const port = Number(options['--port'] || 8767);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port must be an integer from 1 through 65535.');
const mime = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jsonl': 'application/x-ndjson; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

function send(res, status, value, method = 'GET') {
  const body = Buffer.from(JSON.stringify(value));
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length });
  res.end(method === 'HEAD' ? undefined : body);
}

async function control() {
  let value = {};
  if (stateFile) {
    try { value = JSON.parse(await readFile(stateFile, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw new Error('Preview state file could not be read.'); }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Preview state must be an object.');
  const mode = value.mode || 'ok';
  if (!['ok', 'error'].includes(mode)) throw new Error('Preview mode must be ok or error.');
  const delay = value.delay_ms ?? 0;
  if (!Number.isInteger(delay) || delay < 0 || delay > 30000) throw new Error('delay_ms must be an integer from 0 through 30000.');
  const status = value.status ?? 503;
  if (!Number.isInteger(status) || status < 400 || status > 599) throw new Error('Injected error status must be 400 through 599.');
  if (value.api_file !== undefined && typeof value.api_file !== 'string') throw new Error('api_file must be a filesystem path.');
  return { mode, delay, status, file: value.api_file ? resolve(stateFile ? dirname(stateFile) : process.cwd(), value.api_file) : apiFile };
}

async function capturedSnapshot(file) {
  const body = await readFile(file);
  const raw = JSON.parse(body.toString('utf8'));
  const normalized = normalizeSnapshot(raw);
  return { body, version: typeof raw.version === 'string' ? raw.version : null, posts: normalized.parsed.posts.length, notifications: normalized.notifications.status, notification_handles: normalized.notifications.handles.length, heartbeat: normalized.receipt.collector_heartbeat_at };
}

function insideRoot(path) {
  const child = relative(root, path);
  return !child.startsWith('..') && !isAbsolute(child);
}

const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(req.headers.host || '')) return send(res, 403, { error: 'Loopback host required.' }, req.method);
  if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); return send(res, 405, { error: 'Read-only preview server.' }, req.method); }
  try {
    const url = new URL(req.url, 'http://127.0.0.1:' + port);
    if (url.pathname === '/health') {
      const state = await control();
      let snapshot;
      try { snapshot = await capturedSnapshot(state.file); }
      catch { return send(res, 200, { server: 'ready', mode: state.mode, snapshot: 'unavailable', api_file: state.file }, req.method); }
      const { body, ...details } = snapshot;
      return send(res, 200, { server: 'ready', mode: state.mode, api_file: state.file, ...details }, req.method);
    }
    if (url.pathname === '/api/xfeed') {
      const state = await control();
      if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
      if (res.destroyed) return;
      if (state.mode === 'error') return send(res, state.status, { error: 'Deliberate local preview failure. Saved production data is unchanged.' }, req.method);
      const snapshot = await capturedSnapshot(state.file);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': snapshot.body.length, 'X-Xfeed-Preview': 'selected-snapshot' });
      res.end(req.method === 'HEAD' ? undefined : snapshot.body);
      process.stdout.write(JSON.stringify({ path: '/api/xfeed', status: 200, posts: snapshot.posts, notification_handles: snapshot.notification_handles, version: snapshot.version }) + '\n');
      return;
    }
    const decoded = decodeURIComponent(url.pathname);
    if (decoded.includes('\0') || decoded.split('/').some(part => part.startsWith('.') || part === 'node_modules')) return send(res, 404, { error: 'Not found.' }, req.method);
    let path = resolve(root, '.' + decoded);
    if (!insideRoot(path)) return send(res, 404, { error: 'Not found.' }, req.method);
    if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html');
    path = await realpath(path);
    if (!insideRoot(path)) return send(res, 404, { error: 'Not found.' }, req.method);
    const metadata = await stat(path);
    if (!metadata.isFile()) return send(res, 404, { error: 'Not found.' }, req.method);
    res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Content-Length': metadata.size });
    if (req.method === 'HEAD') res.end();
    else await pipeline(createReadStream(path), res);
  } catch (error) {
    if (res.headersSent || res.destroyed) return;
    const missing = error.code === 'ENOENT' || error.code === 'ENOTDIR';
    send(res, missing && !req.url.startsWith('/api/xfeed') ? 404 : 503, { error: missing ? 'Requested preview file is unavailable.' : 'Preview data could not be served or validated.' }, req.method);
  }
});

server.listen(port, '127.0.0.1', () => process.stdout.write(JSON.stringify({ preview: 'http://127.0.0.1:' + port + '/xfeed/', health: 'http://127.0.0.1:' + port + '/health', api_file: apiFile, state_file: stateFile, root }) + '\n'));
server.on('error', error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.close(); server.closeAllConnections(); });

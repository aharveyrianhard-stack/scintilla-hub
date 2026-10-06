// Q5 (5 Oct 2026) — the outside critique measured the board at 5.4 MB before any data. 2.2 MB of that was the page
// downloading itself a second time (and again every 75 s) to read its own build stamp. These tests hold the fix in place.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const between = (from, to) => { const a = page.indexOf(from); assert.ok(a >= 0, from); const b = page.indexOf(to, a); assert.ok(b > a, to); return page.slice(a, b); };

test('the build stamp sits in the first 4 KB of the page and equals window.SC_BUILD', () => {
  const meta = page.match(/<meta name="sc-build" content="([^"]+)">/);
  const line = page.match(/window\.SC_BUILD = "([^"]+)";/);
  assert.ok(meta && line);
  assert.equal(meta[1], line[1], 'one stamp, written twice: bump both or the Hub reloads for ever');
  assert.ok(Buffer.byteLength(page.slice(0, meta.index + meta[0].length)) < 4096, 'inside the byte range the check asks for');
});

const checker = between('function scBuildStampIn(', '(function () {\n  try {\n    if (sessionStorage.getItem("sc_build_reloaded")) return;');
function load(fetchImpl) {
  const calls = [];
  const box = { Date, TextDecoder, fetch: (url, init) => { calls.push({ url, init }); return fetchImpl(url, init, calls.length); } };
  vm.runInNewContext(checker + '\nthis.scShippedBuild = scShippedBuild; this.scBuildStampIn = scBuildStampIn;', box);
  return { box, calls };
}
const HEAD = '<!DOCTYPE html><head><meta name="sc-build" content="2026-10-05T2300"><style>';
const OLD_PAGE = '<!DOCTYPE html><head><style>x</style></head><body><script>window.SC_BUILD = "2026-08-20T1420";</script>';

test('the check asks for the first 4 KB and reads the stamp there: one small request, no second download', async () => {
  const { box, calls } = load(async () => ({ status: 206, text: async () => HEAD }));
  assert.equal(await box.scShippedBuild(), '2026-10-05T2300');
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^\/index\.html\?b=\d+$/);
  assert.equal(calls[0].init.headers.Range, 'bytes=0-4095');
  assert.equal(calls[0].init.cache, 'no-store');
});

test('a page from before the change (no stamp in its head) is read whole and its SC_BUILD line is used', async () => {
  const { box, calls } = load(async (url, init) => init.headers
    ? { status: 206, text: async () => OLD_PAGE.slice(0, 40) }
    : { status: 200, text: async () => OLD_PAGE });
  assert.equal(await box.scShippedBuild(), '2026-08-20T1420');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].init.headers, undefined, 'the second read asks for the whole page');
});

test('a host that ignores the range: the download is stopped as soon as the stamp has gone by', async () => {
  const enc = new TextEncoder();
  const parts = [enc.encode(HEAD.slice(0, 30)), enc.encode(HEAD.slice(30)), enc.encode('x'.repeat(1000)), enc.encode('y'.repeat(1000))];
  let reads = 0, cancelled = 0;
  const reader = { read: async () => (reads < parts.length ? { done: false, value: parts[reads++] } : { done: true }), cancel: () => { cancelled++; } };
  const { box } = load(async () => ({ status: 200, body: { getReader: () => reader } }));
  assert.equal(await box.scShippedBuild(), '2026-10-05T2300');
  assert.equal(reads, 2, 'only the pieces up to the stamp were read (the stamp was split across two)');
  assert.equal(cancelled, 1);
});

test('a host that ignores the range and an old page: read to the end, the old line answers; no stamp at all is null', async () => {
  const enc = new TextEncoder();
  const stream = text => { let sent = false; return { status: 200, body: { getReader: () => ({ read: async () => (sent ? { done: true } : (sent = true, { done: false, value: enc.encode(text) })), cancel: () => {} }) } }; };
  assert.equal(await load(async () => stream(OLD_PAGE)).box.scShippedBuild(), '2026-08-20T1420');
  assert.equal(await load(async () => stream('<html>nothing here</html>')).box.scShippedBuild(), null);
  assert.equal(await load(async () => ({ status: 200, text: async () => OLD_PAGE })).box.scShippedBuild(), '2026-08-20T1420', 'no stream reader: the whole text');
});

test('both freshness checks use the one reader; neither downloads the page itself any more', () => {
  const checks = between('(function () {\n  try {\n    if (sessionStorage.getItem("sc_build_reloaded")) return;', '/* K3 — quiet-time self-update');
  assert.equal((checks.match(/scShippedBuild\(\)/g) || []).length, 2);
  assert.doesNotMatch(checks, /fetch\(/);
  assert.match(checks, /if \(b && b !== window\.SC_BUILD\) \{\s+sessionStorage\.setItem\("sc_build_reloaded", "1"\);\s+location\.reload\(\);/);
  assert.match(checks, /if \(!b \|\| b === window\.SC_BUILD\) return;/);
  assert.match(checks, /\}, 75000\);/);
});

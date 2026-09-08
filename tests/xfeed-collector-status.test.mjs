import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { markCollectorError, safeErrorMessage } from '../scripts/xfeed-collector-status.mjs';
const at = '2026-09-08T17:00:00.000Z';

test('collector error records actual retry time and only invokes the last-good publisher', async t => {
  const runtimeDir = await mkdtemp(join(tmpdir(), 'xfeed-status-test-')); t.after(() => rm(runtimeDir, { recursive: true, force: true }));
  await writeFile(join(runtimeDir, 'heartbeat.json'), JSON.stringify({ collector_status: 'idle', last_heartbeat_at: '2026-09-08T16:55:00.000Z', latest_source_event_at: '2026-09-08T16:54:00.000Z', stale_after_seconds: 600 }));
  let called = 0;
  const result = await markCollectorError({ runtimeDir, error: 'Observed X HTTP 429', retryAt: '2026-09-08T17:05:00Z', clock: () => at, environment: {}, publishLastGood: async ({ statusFile, dataDir }) => {
    called++; assert.equal(dataDir, join(runtimeDir, 'data'));
    const saved = JSON.parse(await readFile(statusFile));
    assert.equal(saved.collector_status, 'error'); assert.equal(saved.last_heartbeat_at, at);
    assert.equal(saved.latest_source_event_at, '2026-09-08T16:54:00.000Z');
    assert.equal(saved.collector_retry_at, '2026-09-08T17:05:00.000Z');
    return { version: 'test-version' };
  } });
  assert.equal(called, 1); assert.equal(result.preserved_last_good_posts, true);
  assert.equal(result.collector_status, 'error');
});

test('failed status publication preserves the local error and never declares health', async t => {
  const runtimeDir = await mkdtemp(join(tmpdir(), 'xfeed-status-failure-')); t.after(() => rm(runtimeDir, { recursive: true, force: true }));
  await assert.rejects(markCollectorError({ runtimeDir, error: 'Browser source session unavailable', clock: () => at, environment: {}, publishLastGood: async () => { throw new Error('test offline'); } }), /test offline/);
  const saved = JSON.parse(await readFile(join(runtimeDir, 'heartbeat.json')));
  assert.equal(saved.collector_status, 'error'); assert.equal(Object.hasOwn(saved, 'collector_retry_at'), false);
  await assert.rejects(markCollectorError({ runtimeDir, error: 'Observed quota exhausted', retryAt: 'tomorrow', environment: {} }), /full ISO/);
});

test('status messages remove credential-shaped text and known secret values', () => {
  assert.equal(safeErrorMessage('Problem TEST_PRIVATE_VALUE\nBearer synthetic-token', { BLOB_READ_WRITE_TOKEN: 'TEST_PRIVATE_VALUE' }), 'Problem [redacted] Bearer [redacted]');
  assert.equal(safeErrorMessage('token=syntheticvalue cookie=syntheticvalue', {}), 'token=[redacted] cookie=[redacted]');
});

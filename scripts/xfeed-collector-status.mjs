#!/usr/bin/env node
/** Record an observed collector failure and publish status over the last good feed. */
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { timestamp } from './xfeed-ingest.mjs';
import { DEFAULT_RUNTIME } from './xfeed-capture-server.mjs';

export function safeErrorMessage(value, environment = process.env) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('--error requires a concise description of an observed failure');
  let message = value;
  for (const [name, secret] of Object.entries(environment)) if (/TOKEN|SECRET|PASSWORD|API_?KEY|PRIVATE_?KEY/i.test(name) && typeof secret === 'string' && secret.length >= 8) message = message.split(secret).join('[redacted]');
  return message.replace(/\b(Bearer\s+)\S+/gi, '$1[redacted]').replace(/\b(authorization|cookie|api[_ -]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 1000);
}
async function readJson(path) { try { return JSON.parse(await readFile(path, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
export async function markCollectorError({ runtimeDir = DEFAULT_RUNTIME, error, retryAt, publishLastGood, clock = () => new Date().toISOString(), environment = process.env }) {
  const message = safeErrorMessage(error, environment), observedAt = timestamp(clock(), 'collector error observation');
  const retry = retryAt == null ? null : timestamp(retryAt, 'actual source retry time');
  const statusFile = join(runtimeDir, 'heartbeat.json'), prior = await readJson(statusFile);
  const source = await readJson(join(runtimeDir, 'data/source-receipt.json'));
  const latest = prior?.latest_source_event_at ?? source?.coverage?.latest_observed_post_at ?? null;
  const status = {
    collector_status: 'error', last_heartbeat_at: observedAt,
    collector_error: message,
    stale_after_seconds: Number.isSafeInteger(prior?.stale_after_seconds) && prior.stale_after_seconds > 0 ? prior.stale_after_seconds : 600,
    ...(latest ? { latest_source_event_at: timestamp(latest, 'latest source event') } : {}),
    ...(retry ? { collector_retry_at: retry } : {}),
  };
  await mkdir(runtimeDir, { recursive: true });
  const temporary = `${statusFile}.${process.pid}.${randomBytes(5).toString('hex')}.tmp`;
  await writeFile(temporary, `${JSON.stringify(status, null, 2)}\n`, { mode: 0o600 }); await rename(temporary, statusFile);
  // No live ledger is read or published here: an unfinished source pass must
  // not become visible merely because its collection failed.
  const publish = publishLastGood ?? (await import('./xfeed-publish.mjs')).publishLastGoodStatus;
  if (typeof publish !== 'function') throw new Error('Last-good status publisher is unavailable; error status remains saved locally');
  const publication = await publish({ statusFile, dataDir: join(runtimeDir, 'data'), baseUrl: environment.XFEED_BLOB_BASE_URL });
  return { collector_status: 'error', observed_at: observedAt, collector_retry_at: retry, published: true, preserved_last_good_posts: true,
    ...(publication?.version ? { version: publication.version } : {}), ...(publication?.manifest_url ? { manifest_url: publication.manifest_url } : {}) };
}
const usage = 'Usage: node --env-file=.env.local scripts/xfeed-collector-status.mjs --error "observed source failure" [--retry-at <actual ISO reset time>] [--runtime-dir <operational runtime>]';
async function main(args) {
  if (args.includes('--help')) { process.stdout.write(`${usage}\n`); return; }
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--error', '--retry-at', '--runtime-dir'].includes(args[i]) || !args[i + 1] || options[args[i]]) throw new Error(usage);
    options[args[i]] = args[i + 1];
  }
  const result = await markCollectorError({ runtimeDir: resolve(options['--runtime-dir'] ?? DEFAULT_RUNTIME), error: options['--error'], retryAt: options['--retry-at'] });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(error => {
  process.stderr.write(`X feed collector status failed: ${safeErrorMessage(String(error.message))}\n`); process.exitCode = 1;
});

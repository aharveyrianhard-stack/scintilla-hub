// Q4 access audit (5 Oct 2026): the staged SQL is a proposal, never an applied change. These checks keep it that way:
// every file says NOT APPLIED and sits beside a rollback, nothing carries a key, and the report's headline count
// equals the evidence it was built from.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const staged = join(root, 'staged/q4-access');
const dlv = join(root, 'deliverables/20261005/q4-access-audit');
const sql = readdirSync(staged).filter(f => f.endsWith('.sql'));

test('q4: every staged file says NOT APPLIED and has its rollback beside it', () => {
  const fwd = sql.filter(f => !f.endsWith('_ROLLBACK.sql'));
  assert.ok(fwd.length >= 6);
  for (const f of fwd) {
    assert.match(readFileSync(join(staged, f), 'utf8'), /STAGED — NOT APPLIED/);
    assert.ok(sql.includes(f.replace(/\.sql$/, '_ROLLBACK.sql')), `${f} has no rollback`);
  }
});

test('q4: no key or token value in the staged SQL, the evidence or the report', () => {
  const files = [...sql.map(f => join(staged, f)), join(dlv, 'Q4-ACCESS-AUDIT.html'),
    ...readdirSync(join(dlv, 'evidence')).map(f => join(dlv, 'evidence', f))];
  for (const f of files) {
    const s = readFileSync(f, 'utf8');
    assert.doesNotMatch(s, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./, f);
    assert.doesNotMatch(s, /sb_secret_[A-Za-z0-9]|sb_publishable_[A-Za-z0-9]/, f);
  }
});

test('q4: the staged SQL only narrows access — nothing is dropped, deleted or widened', () => {
  for (const f of sql.filter(f => !f.endsWith('_ROLLBACK.sql'))) {
    const body = readFileSync(join(staged, f), 'utf8').split('\n').filter(l => !l.startsWith('--')).join('\n');
    assert.doesNotMatch(body, /\b(drop\s+table|delete\s+from|truncate\s+table|disable\s+row\s+level)\b/i, f);
    assert.doesNotMatch(body, /\bgrant\b[^;]*\bto\b[^;]*\b(anon|authenticated|public)\b/i, f);
  }
});

test('q4: the headline count on the page is the count in the evidence', () => {
  const cat = JSON.parse(readFileSync(join(dlv, 'evidence/catalog.json'), 'utf8'));
  const off = cat.filter(r => r.schema === 'public' && r.kind === 'table' && !r.rls).length;
  const page = readFileSync(join(dlv, 'Q4-ACCESS-AUDIT.html'), 'utf8');
  assert.ok(page.includes(`17 June 25 → today ${off}`));
  assert.equal(JSON.parse(readFileSync(join(dlv, 'summary.json'), 'utf8')).rls_off, off);
});

// Put/call audit, 28 Sep 2026 — fixture tests over the saved audit data.
// They pin the arithmetic the page states in words, so the page cannot drift from its own data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "deliverables/20260928/putcall-audit");
const data = JSON.parse(readFileSync(join(DIR, "putcall-audit.json"), "utf8"));
const html = readFileSync(join(DIR, "PUTCALL-AUDIT.html"), "utf8");

test("coverage adds up to the whole live universe", () => {
  const c = data.coverage;
  assert.equal(c.read_now + c.stopped_at_0012_et.length + c.never_in_reader_list.length, c.live_universe);
  assert.equal(c.reader_list - c.stopped_at_0012_et.length, c.read_now);
  assert.equal(c.never_in_reader_list_companies.length + c.never_in_reader_list_funds_count,
    c.never_in_reader_list.length);
});

test("no name is counted twice between the three coverage groups", () => {
  const c = data.coverage;
  const all = [...c.stopped_at_0012_et, ...c.never_in_reader_list];
  assert.equal(new Set(all).size, all.length);
});

test("a put/call ratio is puts divided by calls, for every name compared with Cboe", () => {
  for (const [sym, r] of Object.entries(data.single_names_vs_cboe)) {
    const cb = r.cboe;
    assert.ok(cb.call_vol > 0, sym);
    assert.ok(Math.abs(cb.put_vol / cb.call_vol - cb.pc) < 0.0006, sym);
    const ib = r.ibkr_best_match;
    assert.ok(Math.abs(ib.put_vol / ib.call_vol - ib.pc) < 0.0006, sym);
  }
});

test("every IBKR running total compared was non-decreasing since the open", () => {
  for (const [sym, r] of Object.entries(data.single_names_vs_cboe)) assert.equal(r.monotonic_since_open, true, sym);
  assert.equal(data.spool.falls_inside_regular_session, 0);
  assert.equal(data.recompute.stored_minute_falls, 0);
});

test("the stored daily ratios are their own puts over calls", () => {
  for (const r of data.stored_daily) {
    assert.ok(Math.abs(r.put_vol / r.call_vol - r.put_call) < 1e-9, `${r.session_et} ${r.scope}`);
  }
});

test("every chart the page shows is saved next to it", () => {
  const imgs = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(imgs.length >= 4);
  for (const src of imgs) assert.ok(existsSync(join(DIR, src)), src);
});

test("the page uses no white and keeps body text at 11px or more", () => {
  assert.doesNotMatch(html, /#fff\b|#ffffff|\bwhite\b(?!-space)/i);
  for (const m of html.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) assert.ok(Number(m[1]) >= 11, m[0]);
});

test("no credential shape appears in the page or the data", () => {
  for (const text of [html, JSON.stringify(data)]) {
    assert.doesNotMatch(text, /eyJ[A-Za-z0-9_-]{20,}/);
    assert.doesNotMatch(text, /apiKey=|service_role|Bearer [A-Za-z0-9]/);
  }
});

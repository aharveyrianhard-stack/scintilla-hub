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

/* ---- review fixes, 28 Sep: single names lined up on the calls, table pinned to the data ---- */
const align = await import(join(DIR, "align-names.mjs"));

test("the call-matched comparison in the JSON is what the saved IBKR readings give", () => {
  const fresh = align.alignAll(data);
  assert.deepEqual(data.single_names_aligned, JSON.parse(JSON.stringify(fresh)));
});

test("at the matched moment IBKR's call total equals Cboe's, and the moment lies between two real readings", () => {
  for (const [key] of align.CHECKS) for (const s of align.NAMES) {
    const cboe = data[key][s].cboe, rows = data.ibkr_series_since_open.rows[s];
    const m = align.callMatch(rows, cboe);
    assert.ok(m, `${key} ${s}`);
    assert.ok(m.bracket_s > 0 && m.bracket_s < 40, `${key} ${s} readings ~32 s apart`);
    const i = rows.findIndex((r) => r[0] >= m.t);
    assert.ok(rows[i - 1][1] <= cboe.call_vol && cboe.call_vol <= rows[i][1], `${key} ${s}`);
  }
});

test("every cell of table 3.3 is generated from the aligned data", () => {
  const i = html.indexOf(align.TABLE_START), j = html.indexOf(align.TABLE_END);
  assert.ok(i > 0 && j > i);
  const rows = html.slice(i + align.TABLE_START.length, j).trim();
  assert.equal(rows, align.tableRows(data.single_names_aligned));
  assert.equal((rows.match(/<tr>/g) || []).length, align.NAMES.length);
});

test("a name is compared only when its own delay is within the tolerance of the check's shared delay", () => {
  for (const per of Object.values(data.single_names_aligned.checks)) {
    for (const s of align.NAMES) {
      const p = per[s];
      if (!p.aligned) assert.equal(align.cell(p), "not aligned", s);
      else assert.match(align.cell(p), /^[+−±]\d+%$/, s);
    }
  }
  const c = data.single_names_aligned.checks;
  assert.equal(c["09:55 ET"].IWM.aligned, false);
  assert.equal(c["10:07 ET"].IWM.aligned, false);
  assert.equal(c["10:07 ET"].AMZN.aligned, false);
  for (const s of ["AAPL", "NVDA", "MSFT"]) for (const per of Object.values(c)) {
    assert.equal(per[s].aligned, true, s);
    assert.ok(per[s].put_gap_pct < -5, `${s} puts read low`);
  }
});

test("the old delay-window reading of IWM as noise is gone from the page", () => {
  assert.doesNotMatch(html, /noisy a single name/);
  assert.doesNotMatch(html, /34 of 35", but it really has 43/);
});

test("cohort switching evidence is internally consistent", () => {
  const c = data.cohort_membership_switching;
  assert.equal(c.member_slots_normal - c.member_slots_short, c.member_slots_lost_in_remaining_cohorts + c.one_member_cohorts_vanished);
  assert.equal(c.cohort_lines_normal - c.cohort_lines_in_short_minutes, c.one_member_cohorts_vanished);
  const short = c.ai_hardware_minutes.filter((r) => r.of_members === 35).map((r) => r.utc);
  assert.deepEqual(short, c.short_minutes_utc);
  assert.equal(c.ai_hardware_members_not_reached_today, 0);
  assert.ok(c.ticker_cohorts_rows > c.page_size && c.company_profile_rows <= c.page_size);
  assert.match(html, /53 of the 119 cohort/);
});

test("fix list says the reader must exit with a failure code for launchd to restart it", () => {
  assert.equal(data.reader_exit.plist_keepalive.SuccessfulExit, false);
  assert.match(html, /exit with a failure code/i);
  assert.match(html, /return 1 when the loop ended because the connection dropped/);
});

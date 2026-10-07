#!/usr/bin/env node
// CZ1 — make the page's data file from the provider run.
//
// Input  the provider branch's evidence (provider/cz1-confluence-20261006):
//          evidence/cz1-confluence-20261006/confluence-<date>.json            the run
//          evidence/cz1-confluence-20261006/confluence-load-dry-run-<date>.json  the loader's dry-run receipt
//          evidence/cz1-confluence-20261006/parity-native-labels-<date>.json  the check against TradingView's own labels
// Output data/confluence-page-<date>.js  (window.CZ1 = {...}; a script, so the page also opens from a file)
// Micron is carried in full. Every other name carries its levels, zones, the zones that form and the meetings that
// actually happen — enough for its row and its fold-out, without the 4 MB of the full run.
//
//   node tools/build-page-data.mjs --evidence <provider>/evidence/cz1-confluence-20261006
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVID = opt("--evidence", "/Users/alanharvey/SCINTILLA 0.5/_worktrees/provider-cz1-confluence-20261006/evidence/cz1-confluence-20261006");
const runFile = fs.readdirSync(EVID).filter((f) => /^confluence-\d{8}\.json$/.test(f)).sort().pop();
const run = JSON.parse(fs.readFileSync(path.join(EVID, runFile), "utf8"));
const date = runFile.match(/\d{8}/)[0];
const read = (f) => (fs.existsSync(path.join(EVID, f)) ? JSON.parse(fs.readFileSync(path.join(EVID, f), "utf8")) : null);
const load = read(`confluence-load-dry-run-${date}.json`), parity = read(`parity-native-labels-${date}.json`);
const FULL = new Set(["MU"]);
const r3 = (v) => (v == null || !Number.isFinite(v) ? null : Math.abs(v) >= 100 ? Math.round(v * 100) / 100 : Math.abs(v) >= 1 ? Math.round(v * 1e4) / 1e4 : Math.round(v * 1e6) / 1e6);
const r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
const multi = (z) => z.members.some((m) => m.family === "average") || new Set(z.members.filter((m) => m.family === "line").map((m) => m.tf)).size >= 2;

const zone = (z) => ({ lo: r3(z.low), hi: r3(z.high), side: z.side, d: r2(z.distance_pct), w: r2(z.width_pct), ms: multi(z), m: z.members.map((m) => [m.label, r3(m.level), m.family === "average" ? "a" : "l", m.tf]) });
const form = (z) => ({ s: z.first_session, date: z.first_date, to: z.last_session, n: z.sessions_as_zone, lo: r3(z.low), hi: r3(z.high), side: z.side, d: r2(z.distance_pct), joined: z.joined, m: z.members.map((m) => [m.label, r3(m.level), m.family === "average" ? "a" : "l", m.tf]) });
const meet = (m) => ({ a: m.average, l: m.line, g0: r2(m.gap_today_pct), gH: r2(m.gap_at_horizon_pct), in: m.first_session_within, date: m.first_date_within, x: m.crosses_at, cs: m.closest_session, cg: r2(m.closest_gap_pct), t: m.trend });

function name(t, r) {
  const full = FULL.has(t);
  const lastOf = Object.fromEntries((r.paths.flat.ending || []).map((e) => [e.member_key, e.last_session]));
  const out = {
    t, price: r.price, as_of: r.as_of_date, lines: !!r.has_reviewed_lines, pack: r.pack, unit: r.unit, basis_note: r.basis_note, bars: r.daily_bars, trend: r2(r.trend_per_session_pct), sessions: r.sessions,
    avg: Object.fromEntries(Object.entries(r.averages).map(([n, a]) => [n, a ? { v: r3(a.value), s: r3(a.slope), sp: r3(a.slope_pct), s5: r3(a.slope_5_ago), s10: r3(a.slope_10_ago), s1: r3(a.slope_1), drop: r3(a.drops_out_next) } : null])),
    levels: r.levels_today.map((l) => ({ k: l.key, label: l.label, tf: l.tf, f: l.family === "average" ? "a" : "l", kind: l.kind, v: r3(l.level), d: r2(l.pct_from_price), step: l.family === "line" ? r3(l.step_pct) : null, next: l.next_step_date || null, nextv: r3(l.next_step_level), at20: r3(l.level_at_horizon), ch20: r2(l.change_to_horizon_pct), lt: !!l.lt, role: full ? l.role : undefined })),
    zones: r.zones_today.map((z) => ({ ...zone(z), last: lastOf[z.member_key] ?? r.rule.horizon_sessions })),
    brackets: r.brackets_today.map((b) => ({ label: b.label, tf: b.tf, lo: r3(b.lower), hi: r3(b.upper) })),
    removed: r.removed_from_display.map((x) => x.label), folded: r.hidden_near_duplicates.map((x) => [x.label, r3(x.level)]), near: r.near_cleanup_active,
    paths: {},
  };
  for (const p of ["flat", "trend", "slope"]) {
    const src = r.paths[p];
    const forming = src.forming.filter((z) => full || Math.abs(z.distance_pct) <= 15).map(form);
    out.paths[p] = { p20: r3(src.price_at_horizon), forming: full ? forming : forming.slice(0, 12), same_tf: full ? src.forming_same_timeframe.map((z) => ({ s: z.first_session, date: z.first_date, to: z.last_session, lo: r3(z.low), hi: r3(z.high), side: z.side, d: r2(z.distance_pct), labels: z.labels })) : undefined,
      ending: src.ending.map((e) => [e.member_key, e.last_session, e.last_date]), meetings: src.meetings.filter((m) => full || m.first_session_within != null).map(meet) };
  }
  if (full) { out.avg_paths = Object.fromEntries(Object.entries(r.average_paths).map(([n, v]) => [n, v ? Object.fromEntries(Object.entries(v).map(([p, a]) => [p, a.map(r3)])) : null])); out.line_paths = Object.fromEntries(Object.entries(r.line_paths).map(([k, a]) => [k, a.map(r3)])); }
  return out;
}

const pos = (p) => ({ price: r3(p.price), at: p.at_labels, at_avg: p.at_averages, to: p.next_average_down ? [p.next_average_down.label, r2(p.next_average_down.pct), r3(p.next_average_down.level)] : null });
const pairs = run.pairs.map((p) => ({ c: p.child, p: p.parent, rel: p.relation, beta: r2(p.beta), corr: r2(p.corr), link: p.link, n: p.beta_sessions, mixed: p.mixed_today, plines: p.parent_has_reviewed_lines,
  rows: p.rows.map((r) => ({ sc: r.scenario, rung: r.child_rung || null, cm: r2(r.child_move_pct), pm: r2(r.parent_move_pct), mixed: r.mixed, why: r.why, c: pos(r.child), p: pos(r.parent) })) }));

const data = {
  schema: "scintilla.confluence-page.v1", built_at: new Date().toISOString(), run_generated_at: run.generated_at, as_of: run.as_of_date, rule: run.rule, sources: run.sources,
  names_with_lines: run.names_with_lines, funds_without_lines: run.funds_without_lines, sector_fund: run.sector_fund, name_parents: run.name_parents,
  names: Object.fromEntries(Object.entries(run.results).map(([t, r]) => [t, name(t, r)])), pairs,
  closes: { MU: run.closes.MU, DRAM: run.closes.DRAM, SMH: run.closes.SMH },
  load: load ? { run_id: load.receipt_row.run_id, counts: load.receipt_row.counts, applied: load.applied, sample: load.sample_zone_rows.map((r) => ({ path: r.path, kind: r.kind, lo: r.low, hi: r.high, side: r.side, d: r.distance_pct, n: r.member_count, ms: r.multi_source, rank: r.rank_on_side, last: r.last_session, labels: r.labels })) } : null,
  parity: parity ? { native_read_at: parity.native_read_at, summary: parity.summary, symbols: parity.symbols.map((s) => ({ t: s.ticker, native: s.native_labels, equal: s.equal })) } : null,
};
const OUT = path.join(HERE, "..", "data");
fs.mkdirSync(OUT, { recursive: true });
const json = JSON.stringify(data);
fs.writeFileSync(path.join(OUT, `confluence-page-${date}.js`), `/* CZ1 · generated by tools/build-page-data.mjs from the provider run ${runFile} · do not edit by hand */\nwindow.CZ1 = ${json};\n`);
console.log(`page data → data/confluence-page-${date}.js (${(json.length / 1e6).toFixed(2)} MB) · names ${Object.keys(data.names).length} · pairs ${pairs.length} · as of ${data.as_of}`);

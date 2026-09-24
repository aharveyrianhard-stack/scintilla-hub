#!/usr/bin/env node
// Tables A, B, C and I (packet §10) from the real artifacts of this run, plus the gate results.
// Phase 0/1 only. Nothing here is an outcome statistic or a predictive claim.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tableA, tableB, tableC, tableI } from "../lib/tables.mjs";
import { replay, tripleReplay, NotPortedDetector, HARNESS_VERSION } from "../lib/replay.mjs";
import { clusterEvents } from "../lib/dedupe.mjs";
import { CANONICAL_SETTINGS, settingsSha256, EVAL_SEED, EXTRACTOR_VERSION, sha256, canonicalJson } from "../lib/settings.mjs";

const OUT = fileURLToPath(new URL("../extracts/", import.meta.url));
const manifest = JSON.parse(readFileSync(`${OUT}bars-manifest.json`, "utf8"));
const cohort = JSON.parse(readFileSync(`${OUT}cohort.json`, "utf8"));
const captures = JSON.parse(readFileSync(`${OUT}capture-audit.json`, "utf8"));
const RUN_ID = `phase0-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;

// ---- the replay attempt, recorded rather than narrated -----------------------
const attempts = [];
for (const s of manifest.series) {
  const bars = JSON.parse(readFileSync(`${OUT}bars/${s.symbol}-${s.timeframe}.json`, "utf8")).bars;
  let outcome;
  try {
    replay({ bars, detector: new NotPortedDetector(), context: {}, capture_run_id: RUN_ID });
    outcome = { ok: true };
  } catch (e) { outcome = { ok: false, code: e.code ?? "ERROR", message: e.message }; }
  attempts.push({ symbol: s.symbol, timeframe: s.timeframe, bars: bars.length, outcome });
}
const blocked = attempts.filter((a) => a.outcome.code === "TRENDOSCOPE_LIBRARY_SOURCE_UNAVAILABLE").length;

// The determinism gate cannot be evaluated on a detector that does not exist. Saying so is the
// result; the harness's own determinism is proven separately in tests/trendoscope-replay.test.mjs.
let determinism;
try {
  const g = tripleReplay({ bars: JSON.parse(readFileSync(`${OUT}bars/${manifest.series[0].symbol}-${manifest.series[0].timeframe}.json`, "utf8")).bars,
    detector: new NotPortedDetector(), context: {}, capture_run_id: RUN_ID });
  determinism = { evaluated: true, pass: g.pass, digest: g.geometry_digest };
} catch (e) {
  determinism = { evaluated: false, pass: null, blocked_by: e.code ?? "ERROR",
    note: "Three replays cannot be compared because the detector cannot run. The harness is proven deterministic against a declared test double in tests/trendoscope-replay.test.mjs." };
}

// ---- Table A ---------------------------------------------------------------
const rowsA = manifest.series.map((s) => ({
  run_id: RUN_ID, symbol: s.symbol, feed: `MASSIVE/${s.provenance.provider_symbol ?? s.symbol}`,
  timeframe: s.timeframe, session: s.session_mode, scale: "linear", bars: s.bar_count,
  raw_events: 0, complete_events: 0, unresolved_events: 0,
  endpoint_checks: 0, endpoint_mismatches: 0, replay_hash_match: null,
  notes: `bars extracted and hashed (${s.bars_sha256.slice(0, 12)}…); replay blocked: detector libraries unavailable`,
}));
for (const a of captures.audits) {
  rowsA.push({
    run_id: `${RUN_ID}-capture`, symbol: a.context.symbol, feed: a.context.symbol.split(":")[0],
    timeframe: a.timeframe, session: `tradingview:${a.context.session?.id ?? "unknown"}`,
    scale: a.context.scale_log ? "log" : "linear", bars: a.bars,
    raw_events: 0, complete_events: 0, unresolved_events: a.lines_unresolved,
    endpoint_checks: a.endpoint_checks, endpoint_mismatches: a.endpoint_epoch_mismatches,
    replay_hash_match: null,
    notes: `drawing snapshot, not an event ledger: no confirmation time, no pattern label. ${a.rail_pairs} rail pairs, ${a.endpoint_index_not_loaded} endpoint indices outside the loaded window`,
  });
}

// ---- Tables B and C --------------------------------------------------------
const events = [];                       // deliberately empty: no detector, therefore no events
const clusters = clusterEvents(events);
const B = { ...tableB(events, clusters),
  zero_reason: "No chronological replay event exists because the detector is not ported (research/trendoscope/MISSING-DETECTOR-SOURCES.md). Capture fixtures are NOT promoted into the census: they carry no confirmation time and no pattern label." };
const geomRecords = captures.audits.flatMap((a) => a.geometry.map((g) => ({ ...g, pattern_name: null })));
const C = { ...tableC(geomRecords),
  scope: "capture-fixture geometry ONLY (BITSTAMP:BTCUSD 4H and 1D drawing snapshots). Pattern labels are unavailable in a drawing snapshot, so every row is unlabelled and no per-pattern geometry claim is made.",
  fixture_provenance: captures.audits.map((a) => ({ file: a.file, sha256: a.file_sha256, captured_at: a.captured_at,
    symbol: a.context.symbol, resolution: a.context.resolution, study: a.context.studies })) };

// ---- Table I ---------------------------------------------------------------
const unresolvedLines = captures.audits.reduce((s, a) => s + a.lines_unresolved, 0);
const railPairs = captures.audits.reduce((s, a) => s + a.rail_pairs, 0);
const I = tableI({
  detector_not_ported: { count: blocked, note: "cohort series that could not be replayed: the six Trendoscope Pine libraries are not on this machine and the detector must never be approximated" },
  unresolved_anchors: { count: unresolvedLines, note: "capture line primitives whose x-slots are no longer materialized; kept unresolved rather than guessed" },
  fixture_has_no_confirmation_time: { count: railPairs, note: "rail pairs describable as geometry but excluded from the event census (packet §2)" },
  feed_not_served_by_source: { count: 6, note: "BTCUSD and ETHUSD plus the packet's 4 continuous futures: the chart API universe is 364 US equities/ETFs only" },
  regular_session_run_not_requestable: { count: manifest.series.length, note: "the chart API serves one provider-anchored stream and ignores session parameters; a regular-session-only run cannot be requested from this source" },
});

// ---- gates (packet §11), honestly scored -----------------------------------
const gates = [
  { gate: "Source identity", status: "FAIL", detail: "settings hash, library versions, feed/session/scale are captured, but the detector source hash cannot be computed: the executable rules are not available." },
  { gate: "Chronological determinism", status: "NOT EVALUABLE", detail: determinism.note ?? "" },
  { gate: "Confirmation integrity", status: "NOT EVALUABLE", detail: "No formal event exists yet. The harness refuses any event not stamped with the bar of acceptance (tested)." },
  { gate: "Coordinate completeness", status: "FAIL", detail: `0 formal replay events; ${unresolvedLines} capture line primitives remain unresolved and are reported as such.` },
  { gate: "Endpoint parity", status: "PARTIAL", detail: `Within-capture check: ${captures.audits.reduce((s, a) => s + a.endpoint_checks, 0)} endpoint checks, ${captures.audits.reduce((s, a) => s + a.endpoint_epoch_mismatches, 0)} epoch mismatches. The packet's 10-symbol x 4-timeframe TradingView parity sample is the coordinator's spot audit (research/trendoscope/parity/).` },
  { gate: "Label domain", status: "PASS (schema)", detail: "All 13 labels validate and anything outside them is rejected (tested). No event has been labelled yet." },
  { gate: "Geometry invariants", status: "PASS (schema)", detail: "Ordered alternating pivots and rail ordering are enforced, with every exception enumerated rather than dropped (tested)." },
  { gate: "Dedupe audit", status: "PASS (schema)", detail: "Cluster members keep raw ids, lane/level and settings; cross-feed, cross-session and cross-timeframe merges are refused (tested)." },
  { gate: "Minimum confirmatory N", status: "FAIL", detail: "0 deduped events. Listing only, per the packet's own rule." },
  { gate: "Reproducibility", status: "PARTIAL", detail: "Seed, cohort, bar hashes, code and tables reproduce from a clean run; the detector step cannot." },
];

const payload = {
  generated_utc: new Date().toISOString(), run_id: RUN_ID, phase: "0 and 1 (extractor proof, census, geometry)",
  seed: EVAL_SEED, extractor_version: EXTRACTOR_VERSION, harness_version: HARNESS_VERSION,
  settings_sha256: settingsSha256(), settings: CANONICAL_SETTINGS,
  universe_snapshot: cohort.universe_snapshot, cohort: cohort.cohort, cohort_sha256: cohort.cohort_sha256,
  bars_manifest_sha256: manifest.manifest_sha256,
  replay_attempts: attempts, determinism_gate: determinism,
  tables: { A: tableA(rowsA), B, C, I }, gates,
};
payload.tables_sha256 = sha256(canonicalJson(payload.tables));
writeFileSync(`${OUT}tables-phase-0-1.json`, JSON.stringify(payload, null, 1));
console.log(`Table A rows ${rowsA.length} | raw events ${events.length} | clusters ${clusters.length} | Table C rows ${C.rows.length} | exclusions ${I.total}`);
console.log(`replay blocked on ${blocked}/${attempts.length} series; determinism gate evaluable=${determinism.evaluated}`);
console.log(`tables_sha256 ${payload.tables_sha256}`);

# research/trendoscope — Phase 0 and 1 of the Trendoscope statistical evaluation

**Internal analysis only.** The detector under evaluation is a private visual fork of Trendoscope
Auto Chart Patterns; the Trendoscope source it imports is CC BY-NC-SA 4.0. Nothing in this
directory reproduces that source, and nothing derived from it may be published beyond aggregate
tables. Analysis permission is not commercial product permission (packet §1).

Contract: `INDICATOR_LAB/sprints/2026-09-17-visual-sprint/TRENDOSCOPE_STATISTICAL_EVALUATION_PACKET_2026-09-23.md`.
`INDICATOR_LAB/` is read-only from here; this branch never writes into it.

**Read `MISSING-DETECTOR-SOURCES.md` first.** The detector cannot be replayed on this machine, so
there are zero formal events. Everything else is built and tested.

| Path | What it is |
| --- | --- |
| `lib/settings.mjs` | canonical settings, the 13 label domain, canonical JSON and hashing |
| `lib/event.mjs` | immutable raw event packet (packet §3), deterministic `event_id`, validation |
| `lib/geometry.mjs` | versioned derived features and the §4 tolerance/touch defaults |
| `lib/dedupe.mjs` | two-stage derived clustering (§7); the raw store is never deduplicated |
| `lib/replay.mjs` | chronological replay harness, leakage guards, determinism gate, detector boundary |
| `lib/bars.mjs` | chart API bar extraction with provenance |
| `lib/tables.mjs` | Tables A, B, C, I |
| `bin/select-cohort.mjs` | seed-selected pilot cohort (no symbol chosen by eye) |
| `bin/fetch-bars.mjs` | bar extracts + bucket-anchor audit |
| `bin/audit-captures.mjs` | endpoint and geometry audit of the preserved TradingView captures |
| `bin/build-tables.mjs` | the tables and the gate scoring |
| `bin/parity-sample.mjs` | the coordinator's line-by-line parity sample |
| `bin/freeze-manifest.mjs` | the reproducibility manifest |
| `migrations/` | additive raw-event and cluster tables with RLS read, and their rollback |

Reproduce from a clean checkout:

```
node research/trendoscope/bin/select-cohort.mjs     # seed -> cohort.json
node research/trendoscope/bin/fetch-bars.mjs        # chart API -> extracts/bars + manifest
node research/trendoscope/bin/audit-captures.mjs    # lab captures -> capture-audit.json
node research/trendoscope/bin/build-tables.mjs      # -> tables-phase-0-1.json + gates
node research/trendoscope/bin/parity-sample.mjs     # -> parity/PARITY-SAMPLE-20260924.md
node research/trendoscope/bin/freeze-manifest.mjs   # -> MANIFEST.json
node --test tests/trendoscope-*.test.mjs            # 41 tests
```

`extracts/bars/` is deliberately **not committed**: it is 13 MB of provider-derived bars, and this
repository is served publicly. The manifest pins every series' sha256, so a clean re-run can be
verified byte-for-byte, and the full series were handed to the coordinator in the run directory.

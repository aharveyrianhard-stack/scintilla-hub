# Why a faithful Trendoscope replay cannot be built on this machine

**Status: the Phase 0 detector port is blocked. The brief's instruction was to stop at this list
rather than approximate the detector, and that is what happened.**

## 1. What the detector under evaluation actually is

`INDICATOR_LAB/sprints/2026-09-17-visual-sprint/pine/SCINTILLA_ACP_Duration_Review_V3.pine`
(sha256 `44f641b72f5fed21d50c25bc282b20a72480e5ae54cd5436b278d7c79d789d68`) and the saved-live
baseline `SCINTILLA_ACP_Continued_Rails_V2.pine`
(sha256 `baf294e8adf1478beac7e1f92bee5382738a0aba7058b69dcf514fe597872345`) are **visual forks**.
They contain the inputs, the retained-pattern store, the drawing and the alerts. They do **not**
contain the detection rules. The whole acceptance decision is one call:

```
[valid, currentPattern] = mlzigzag.find(this.sProperties, this.dProperties, this.patterns, ohlcArray)
```

`find(...)` is imported, not defined here. So are the pivots it reads
(`zigzag.calculate(...)`, `zigzag.zigzagPivots`, `mlzigzag.level`, `mlzigzag.nextlevel()`).

## 2. The six imports, and what each one supplies to the decision

| Import | What the study depends on it for | Present on this Mac? |
| --- | --- | --- |
| `Trendoscope/ZigzagLite/4` | the pivot stream itself: `Zigzag.new(length, depth, 0)`, `calculate()`, `flags.newPivot`, `zigzagPivots`, recursive `level` / `nextlevel()` | **no** |
| `Trendoscope/abstractchartpatterns/10` | `find(...)`: pivot-set enumeration, trend-line fitting, the 20% error and 20% flat thresholds, the 0.382 bar-ratio check, Avoid Overlap, and classification into the 13 labels, plus `ScanProperties` / `DrawingProperties` / `Pattern` | **no** |
| `Trendoscope/basechartpatterns/9` | the base pattern types and validation that `abstractchartpatterns` builds on | **no** |
| `Trendoscope/ohlc/3` | the `OHLC` array type the scan consumes | **no** |
| `Trendoscope/LineWrapper/2` | the `Line` objects the rails are stored in (`trendLine1`, `trendLine2`) | **no** |
| `Trendoscope/utils/6` | `Theme` and shared helpers | **no** |

## 3. How thoroughly this was searched

- Every `.pine` file on this Mac: **2,355 files, and not one is a Pine `library(...)` declaration.**
  They are all indicators or studies.
- Text search for library source markers (`library("abstractchartpatterns`, `library("ZigzagLite`,
  `export method find`, `export type Pattern`, …) across `SCINTILLA 0.5`, `AlanOS` and `Downloads`:
  **no match**.
- The Indicator Lab's own sprint evidence directory: capture JSON only, no library source.
- Files whose names looked promising are Google Drive stubs (`.gdoc`) that contain a document id and
  no text, or are unrelated (an Autodesk hatch pattern called `ZIGZAG`).
- The lab's own note already says the same thing from the other direction: "Exact palette assignment
  by pattern type versus pattern instance was not verified from the imported library source"
  (`WORKSHOP_AND_RAILS_2026-09-21.md`), i.e. the library source was not readable there either.

## 4. Why an approximation is not an acceptable substitute

The packet's first two gates are *source identity* and *chronological determinism*, and its §6.5
rule is that any detector or library change creates a new method version and a new cohort. A
re-implementation written from the label names would differ in exactly the places that decide
acceptance — how a 5-pivot set is chosen, how a line is fitted, how the 20% error threshold is
measured, what Avoid Overlap compares, and how a shape becomes one of the 13 names. Its events
would carry a **different** `detector_source_sha256` and could not be called the Trendoscope
detector's reads. Publishing statistics from it would describe a different detector while naming
this one. That is the failure mode the packet is written to prevent, so the port was not attempted.

## 5. Exactly what unblocks it

Either of these is sufficient, and both are the coordinator's to obtain (this session has no
TradingView tools and does not fetch third-party source):

1. **The library source for the six imports above, at those exact versions.** In the TradingView
   Pine editor the imported libraries can be opened from the import line; the source can then be
   saved into the lab's evidence directory. Version numbers must match (`/6`, `/3`, `/2`, `/4`,
   `/10`, `/9`); a newer version is a different method version.
2. **A detector-side event export from the fork itself** — the packet's own Phase 0 step 1. It does
   not need the library source, because it runs inside Pine where `find(...)` already resolves. It
   must emit, at the bar `valid` first becomes true: `patternName`, the ZigZag lane and recursion
   `level`, the ordered 5/6 pivots (`side`, source bar index, epoch, price, synthetic flag) and both
   rails' `p1`/`p2` index, epoch and price. Everything downstream of that export is already built and
   tested in this branch.

Option 2 is the cheaper path and also the only one that yields a real `confirmed_at`, which no
drawing snapshot can reconstruct (packet §2).

## 6. What was built instead, so nothing is wasted

The whole path *after* the detector exists, with tests: the immutable event packet and its
deterministic `event_id`, the leakage-proof chronological replay harness (a detector cannot read a
future bar, and an event cannot be stamped with any bar but the one it was accepted on), the
versioned geometry transformation, the two-stage derived clustering, Tables A/B/C/I, the bar
extracts with provenance, and the seed-selected pilot cohort. The only missing piece is the
licensed detector itself, and it plugs into one interface: `detector.onBar({window, index, retained, context})`.

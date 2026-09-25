# CHAPTER 98 — THE FORMALIZATION APPENDIX

**THE SCINTILLA TRADING RULEBOOK · Finalization pass · v1**
**STATUS: REFERENCE** (navigation + audit surface; introduces no new rules — every entry is a pointer to a card that owns it)
**Built:** at draft-complete, from the sixteen chapters + the Contract (00) + the math file (97). The deposits every chapter left for "the formalization pass" are cashed here: the Master Rule Index, the Consolidated Parameter Registry, the Graveyard, and the Glossary.

> This appendix is the book reading itself. It compiles nothing new. If any line here disagrees with the card it points to, the **card wins** — this is an index, not an authority. Its job is to make ~150 cards and ~180 parameters navigable, and to make the book's *refusals* as visible as its rules.

---

## HOW TO READ THIS BOOK (the one-page orientation)

The rulebook is a machine spec, not a theory book. Every rule is a **card** (T-2): `RULE · CONFIRMATION · INVALIDATION · WHY IT WORKS · STATUS`, and a card is only finished when **two strangers mark the same bar** (T-1, the two-strangers test). The spine underneath everything:

1. **The close is the only truth** (V-2, V-8). Nothing evaluates before a bar of record closes; intrabar is rumor.
2. **A claim is not a verdict** (C-1 → C-2). A close beyond a reference *opens a claim*; the claim becomes a **verdict** (the only opinion object, T-8/V-21) only on a confirming close. Close back inside first and the claim **voids** — and a void is the first sighting of a trapped trader (C-3), which is where the money is (A-3).
3. **Everything is measured in scale units** (T-10): **PCT** (log-percent) or **VOLU** (ATR units). Raw price and chart angles are forbidden. VOLU is what lets one rule read a utility and a crypto pair (U-2).
4. **Witnesses grade; the close decides** (C-9, C-10, Q-1, I-1). Volume and indicators are graders and gauges, never judges. Correlated witnesses count once (I-2, the no-stacking law).
5. **Context gates activity, never truth** (X-4). A regime can suspend which rules *fire*; it may never touch a verdict, a void path, or an in-flight claim (the falsifiability clause).
6. **No rule is TESTED until the loop proves it** — within a stated regime (X-9), on a stated class (U-9), on ≥2 feeds. Every rate in the book is either loop-filled with vintage or stamped UNMEASURED (B-11). The publisher's opinions get no head start (Note R6.1).

The book compiles **forward once** (T-5): earlier chapters never cite later ones; later chapters deposit obligations backward, which earlier chapters cash. This appendix is where you see the finished weave.

---

## PART I — THE MASTER RULE INDEX

Every card, by chapter, with a one-line function. Cards are `LETTER-n`; the letter is the chapter's namespace (T-6, never reused). Status is DRAFT book-wide until loop promotion, except where a card is a pure law/definition.

### 00 · THE CONTRACT (T) — how the book is built
- **T-1** — Two-strangers law: a rule is finished only if two independent implementations mark the same bar.
- **T-2** — Card law: every rule is a five-part card, no part omitted.
- **T-3** — Precision law: inputs/outputs stated so a computer executes without judgment.
- **T-4** — Parameter law: every constant is a named registered parameter; no inline numbers.
- **T-5** — Compile law: the book compiles forward once; no forward citation — backfill instead.
- **T-6** — Rule-ID law: IDs bind to chapter letters, never reused or re-keyed.
- **T-7** — Promotion pipeline: STATUS ∈ {DRAFT, TESTED, LAW, RETIRED}; only evidence promotes.
- **T-8** — Verdict law: the verdict is the only opinion object; seven fields; EVENT_ONLY admissibility.
- **T-9** — Bar contract (RATIFIED): one series of record; ratified v1 defaults; feed-agnostic.
- **T-10** — Scale law: all distance in PCT or VOLU; raw price and angles forbidden.
- **T-11** — Scope ledger: excluded methods listed with reasons, re-admissible only by algorithm.
- **T-12** — Amendment & backfill law: versioned passes; backfill and deposit-forward mechanics.
- **T-13** — Standard formal form: promotion appends an executable schema block (the loop's CardSpec target).

### 01 · VOCABULARY (V) — the primitives everything is built from
- **V-1** — Bar of record: the OHLCV+time tuple under one declared construction.
- **V-2** — Close of record: the sole truth-bearer (the official closing print).
- **V-3** — Scale law (applied): every distance declared PCT or VOLU per rule.
- **V-4** — Revision doctrine: a closed bar is restatable until `bar.revClock`, then immutable.
- **V-5** — Adjustment policy: `bar.adjust` ∈ {SPLIT_ONLY, TOTAL_RETURN}.
- **V-6** — Aggregation law: a higher-TF bar exists only when its last constituent closes.
- **V-7** — Short & missing bars: no session = no bar; short bars flagged, volume stands down.
- **V-8** — Prime axiom (no-partial): no rule evaluates before t_close.
- **V-9** — Tag: completed-bar price contact, direction-less, no verdict.
- **V-10** — Close beyond: a close past a reference by `pen.min` — a claim, not a verdict.
- **V-11** — Swing candidate & confirmed swing: local extreme, candidate until a method confirms.
- **V-12** — Method SW-F (N-bar fractal): fixed-lag fractal, STRICT/LEFT tie option.
- **V-13** — Method SW-R (reversal threshold / zigzag): counter-move threshold, variable lag.
- **V-14** — Repaint prohibition: confirmed outputs are immutable under new data.
- **V-15** — Method SW-P (perceptual key points / PIP): frozen rolling-kernel extrema.
- **V-16** — Swing of record & degree: most recent confirmed swing; recursive degree.
- **V-17** — Level & zone: horizontal level object with states; zone adds a tolerance band.
- **V-18** — Diagonal & channel: trendline through two swings; channel adds a parallel.
- **V-19** — Dynamic level: an indicator series declared as a reference price.
- **V-20** — Support/resistance by position; role flip is a confirmed event.
- **V-21** — Verdict object: seven required fields; EVENT_ONLY sentinel.
- **V-22** — Adjective ban: bullish/bearish/neutral only as verdict direction values.
- **V-23** — Breakout/breakdown (claim terms): a close past a zone edge; a claim.
- **V-24** — Retest · hold · fail · fakeout: post-break terms, each with a clock.
- **V-25** — True range & ATR: Wilder-exact; the book's volatility unit.
- **V-26** — Distance (PCT & VOLU forms): the two signed distance formulas.
- **V-27** — Slope: distance per bar in a declared unit; never degrees.
- **V-28** — Clocks & lookbacks: count closed bars; named parameters, never inline.

### 02 · EVENTS (E) — the countable things a single bar (or two) can do
- **E-1** — Anatomy quantities (+ degenerate guard): body/wick/close numbers; ANATOMY-NULL when range=0.
- **E-2** — Trend bar: directional bar by body-fraction and close-location.
- **E-3** — Neutral bar: the doji family collapsed to one threshold.
- **E-4** — Reject: tag a zone and close back outside (the pin/hammer, three inequalities).
- **E-5** — Inside/outside bar: containment vs engulfing of the prior bar.
- **E-6** — Engulfing close: body- or range-engulf at the close.
- **E-7** — Compression events: NR-n / ATR-fraction / declining-mean contraction.
- **E-8** — Gap event & size: open beyond the prior boundary; ex-div stands down.
- **E-9** — Gap fill & survival: pre-gap boundary retagged vs clock expiry.
- **E-10** — Gap classification (the law): one class, staged; provisional then final.
- **E-11** — Common gap: crosses no active level, stays in context range.
- **E-12** — Breakaway gap: crosses an active level after one-sided consolidation.
- **E-13** — Continuation gap: matches the live structure verdict.
- **E-14** — Exhaustion & failed-breakaway: fill within `gap.exhClock` reclassifies.

### 03 · STANDARDS (C) — how a claim becomes a verdict
- **C-1** — The claim: a close beyond a reference zone opens a directional claim with a clock.
- **C-2** — The confirming close: claim → verdict, under TWO-CONSEC / WINDOW / SINGLE-FILTERED.
- **C-3** — The void: a close back inside before confirmation voids the claim (the fakeout trigger).
- **C-4** — The mirror law: invalidation must be the symmetric, equally-precise voiding event.
- **C-5** — Timeframe of record: one declared tf per claim; no timeframe-shopping.
- **C-6** — Confirmation clock & expiry: window passes → EXPIRED-UNCONFIRMED.
- **C-7** — Wick treatment: wicks only tag and grade — never open/confirm/void.
- **C-8** — Gap handling in confirmation: gap+close-beyond = one claim; close-back = none.
- **C-9** — What never confirms: volume, indicators, anatomy, news, opinion.
- **C-10** — The evidence grade: A/B/C by grader count; orders participation, never gates existence.
- **C-11** — Re-claim discipline: a fresh claim needs a fresh V-10; per-direction attempt counter.

### 04 · HORIZONTAL LEVELS (L)
- **L-1** — Level birth from a confirmed swing at its anchor price.
- **L-2** — Level birth from surviving gap edges.
- **L-3** — Level birth from a prior completed period (PDH/PWH/…).
- **L-4** — Zone-width method options (percent / ATR / max / wick-cluster).
- **L-5** — Test episodes: role-side tag runs, gap-separated.
- **L-6** — Level quality (tier vs score) — a grade, never a gate.
- **L-7** — The third-test problem: WATCH annotation + odds table.
- **L-8** — Break state transition ACTIVE → BROKEN on a confirmed break.
- **L-9** — Role-flip confirmation via retest hold (or reversion on failure).
- **L-10** — Retirement (staleness / irrelevance / period-roll / absorption).
- **L-11** — Confluence clusters of overlapping zones (counted once).
- **L-12** — Reference-binding export: the level behaviors bind *any* reference object.
- **L-13** — Round-number level birth (SKELETON stub, no standing until proven).

### 05 · DIAGONALS & CHANNELS (D)
- **D-1** — Diagonal proposal: a line through two consecutive same-side swings.
- **D-2** — Validation at the first defended test episode (the third touch).
- **D-3** — Slope limits: below floor → level; above cap → parabolic/watch-only.
- **D-4** — The L-12 binding: a diagonal runs the level behaviors unchanged.
- **D-5** — Channel construction/validation via a parallel; midline is evidence-only.
- **D-6** — Redraw law: anchors immutable; a redraw is a new proposal.
- **D-7** — Channel walks and exits (a confirmed boundary break).
- **D-8** — Reference rank on disagreement (HORIZONTAL > DIAGONAL > DYNAMIC).
- **D-9** — Internal-line exclusion: only swing-anchored lines are references.

### 06 · TREND & STRUCTURE (S)
- **S-1** — The alternating confirmed-swing sequence (H, L, H, L …).
- **S-2** — Pairwise events HH/HL/LH/LL/EQ under tolerance.
- **S-3** — Trend existence from interleaved qualifying events.
- **S-4** — Trend verdict: the EVENT_ONLY citizen with a decidable void.
- **S-5** — Suspected-trend state (forming; rules forbidden to fire).
- **S-6** — Structure floor/ceiling is the swing-of-record level.
- **S-7** — Break of structure (BOS) through the floor zone.
- **S-8** — Retracement depth methods (fixed / fib / vol / structural).
- **S-9** — Pullback / deep pullback / reversal-candidate events.
- **S-10** — Trend death vs pause (no auto-reversal, ever).
- **S-11** — After the break: the routing handoff to owner chapters.

### 07 · RANGES (R)
- **R-1** — Range birth via two doorways (structure-pause / de-novo).
- **R-2** — Boundaries are level objects (one ledger).
- **R-3** — No-man's-land: the forbidden middle band.
- **R-4** — Boundary defense classes (defended / reject / void / expiry).
- **R-5** — Maturity by defended-episode count + odds table.
- **R-6** — Range death: confirmed break or dissolution.
- **R-7** — Failed range break: LOADED-OPPOSITE (the spring/upthrust stamp).
- **R-8** — Pre-break context: COILED compression at a boundary.
- **R-9** — Rebirth needs a fresh birth; the rectangle is CH 12's alias.

### 08 · BREAKOUTS (B)
- **B-1** — The break chain: one grammar over five admissible reference types.
- **B-2** — Attempt taxonomy (attempt / failed / break) and the counter reset.
- **B-3** — Pre-break PRESSURE annotation.
- **B-4** — The grade join: which evidence is legible to which break type.
- **B-5** — Entry doctrines: ON-CONFIRM (ENTRY-C) vs ON-RETEST (ENTRY-R).
- **B-6** — Measured objectives: one projection grammar, five methods.
- **B-7** — The runaway break (no-retest + distant close).
- **B-8** — Failure routing: non-clean outcomes handed to Chapter 9.
- **B-9** — Multi-reference breaks; MULTI(k) evidence, highest-rank verdict of record.
- **B-10** — Gap-borne breaks; a separate entry-economics ledger.
- **B-11** — The honesty ledger: the publication law for every rate.

### 09 · AFTERMATH (A)
- **A-1** — Retest machinery: clocks priced; HOLD / FAIL / NO-RETEST.
- **A-2** — Retest-fail: the verdict reset; stamps TRAPPED(break-direction).
- **A-3** — The fakeout setup (C-3's void spent): the first full setup card.
- **A-4** — Spring & upthrust: the named pair at range boundaries.
- **A-5** — The gap trap (E-14's failed-breakaway, spent).
- **A-6** — Whipsaw & the stand-down: the *only* sanctioned activity gate.
- **A-7** — Post-flip third test: single home, flip-test odds.
- **A-8** — Withdrawal & contest evidence at the retest.
- **A-9** — Post-objective law: PAID and the anti-greed rule.
- **A-10** — The aftermath ledger.

### 10 · VOLUME (Q)
- **Q-1** — The evidence doctrine: volume grades; the close decides.
- **Q-2** — Relative volume: the only admissible volume form.
- **Q-3** — Volume grade tiers (Q-FUND, Q-EVR): the C-10 backfill cashed.
- **Q-4** — Effort vs result: ABSORPTION and SUSPECT, position-gated.
- **Q-5** — Volume at tests: DRYING-UP and PRESSING.
- **Q-6** — Climax: the exhaustion candidate, never a reversal signal.
- **Q-7** — Breakout volume (the B-4 row cashed).
- **Q-8** — Aftermath volume: retest signature, trap premiums.
- **Q-9** — Where volume lies: the stand-down register.
- **Q-10** — The volume ledger.

### 11 · INDICATORS (I)
- **I-1** — The witness doctrine: grader, gauge, or reference — three capacities.
- **I-2** — The no-stacking / independence law: correlated witnesses count once.
- **I-3** — Moving-average construction: the house set (SMA/EMA/RMA).
- **I-4** — The dynamic level constructed (V-19 cashed) — and its claim limit.
- **I-5** — Cross events: PRICE×MA (witness) and MA×MA (gauge).
- **I-6** — RSI (Wilder-exact): conditions not signals; the range-shift law.
- **I-7** — MACD (Appel-exact): the momentum witness.
- **I-8** — Williams %R (full standing) & the Stochastic-%K identity.
- **I-9** — Indicator swings, divergence & failure swings (mechanical, swing-indexed).
- **I-10** — Volatility gauges (for the regime chapter).
- **I-11** — Trend-strength gauge (ADX, the cross-check witness).
- **I-12** — The forbidden-uses register (the chapter's spine).

### 12 · PATTERNS (P)
- **P-1** — The composition law: patterns define no machinery — they compose existing objects.
- **P-2** — The pattern-in-structure gate: context is part of the definition.
- **P-3** — The rectangle: the range alias, honored (R-9 cashed, zero new cards).
- **P-4** — Double & triple tops/bottoms: the M/W family (EQ-runs + neckline level).
- **P-5** — Head & shoulders (top & inverse): sequence-failure + a diagonal neckline.
- **P-6** — Flags, pennants & triangles: the continuation containers.
- **P-7** — Wedges (rising & falling): converging lines with a lean.
- **P-8** — The busted-pattern law: failure is first-class (the trapped crowd is fuel).
- **P-9** — The pattern ledger: Bulkowski numbers as SEED-EXT; the loop earns promotion.
- **P-10** — The exclusion list: what the chapter refuses (cup-and-handle, harmonics, …).

### 13 · CONTEXT & REGIME (X)
- **X-1** — Unclear-regime default: contract to a minimal core; no new setup rules.
- **X-2** — Regime taxonomy: four price-native, total, single-valued states.
- **X-3** — Detector options RD-PRICE (primary) vs RD-ADX; stamp disagreements.
- **X-4** — Governing-rules lookup: ACTIVE/SUSPENDED per regime; never gates truth (falsifiability clause).
- **X-5** — Climate axis (volatility, volume): context/grade only, never a gate.
- **X-6** — The inversion list: evidence whose grade weight flips by regime.
- **X-7** — Regime change & the dead zone after a transition.
- **X-8** — Calendar stand-downs; earnings ruled (stand the volume, read the price).
- **X-9** — Regime columns on every honesty table; the stated-regime law (no pooled promotion).

### 14 · MULTI-TIMEFRAME (M)
- **M-1** — The declared stack: ordered frames, one role each.
- **M-2** — Aggregation dependency: context reads use the last completed bar only.
- **M-3** — Authority flows downward: the conflict table (FRAME-FIRST default).
- **M-4** — Regime authority: the record-frame X-2 gates; context regime stamps only.
- **M-5** — Nesting / early warning: WARN annotations, never context-frame verdicts.
- **M-6** — Entry-frame discipline: timing only, never touches record-frame truth.
- **M-7** — The mixing table: downward legal, upward banned except constructions.
- **M-8** — The MTF ledger: higher-timeframe deference measured as a number.

### 15 · UNIVERSE & RELATIVITY (U)
- **U-1** — Instrument classes as declared profiles (rules never change per class).
- **U-2** — The normalization law: VOLU is the transfer unit; PCT is class-calibrated.
- **U-3** — Adaptive thresholds (§J cashed): the index problem and percentile mode.
- **U-4** — Relative strength: the ratio series, full treatment — and its honest limits.
- **U-5** — Breadth: verdict rollups, never a new verdict type.
- **U-6** — Macro vs ticker authority (never swapped).
- **U-7** — Session templates & the 24-hour problem (what "the close" means in FX/crypto).
- **U-8** — Degenerate-price floors (`zone.tickFloor` built out).
- **U-9** — The intraday build-out charter & per-class promotion.

### 16 · RISK PROFILE & APPLICATION (K)
- **K-1** — The invariance law: appetite changes exposure, never truth.
- **K-2** — The legal knobs: a closed registry of profile-touchable parameters.
- **K-3** — The three profiles (CONSERVATIVE / MODERATE / AGGRESSIVE) as parameter sets.
- **K-4** — The invalidation → stop bridge: truth never moves; the buffer does.
- **K-5** — Sizing through the grade channel (C-10's promise, spent; UNMEASURED sizes neutral).
- **K-6** — Profile × regime: exposure through the one legal door.
- **K-7** — Mechanical de-risking: the drawdown ladder (mandatory, hysteretic).
- **K-8** — Positions, verdicts & the TTL proof; application discipline (one book, no forks).
- **K-9** — The risk ledger: the book's last table is about the reader.

*Card count: 13 T · 28 V · 14 E · 11 C · 13 L · 9 D · 11 S · 9 R · 11 B · 10 A · 10 Q · 12 I · 10 P · 9 X · 8 M · 9 U · 9 K = **~156 cards**, seventeen namespaces, one contract.*

---

## PART II — THE CONSOLIDATED PARAMETER REGISTRY

Every named parameter, its home card, and its domain. This is the surface the loop sweeps and the surface T-4 forbids anyone to bypass with an inline number. Honesty tables (loop-filled rate cells) are listed last per chapter and marked `[table]`.

### Bar contract & vocabulary (T, V)
- `bar.earnings` — bool session flag — T-9
- `bar.tf` · `bar.session` (RTH·ETH·FULL24) · `bar.tz` — V-1
- `bar.adjust` (SPLIT_ONLY·TOTAL_RETURN) — V-5 · `bar.revClock` (bars) — V-4
- `pen.min` (scale units ≥ 0) — V-10
- `swing.method` (FRACTAL·REVERSAL·PIP) — V-11 · `swing.n`, `swing.tie` (STRICT·LEFT) — V-12
- `swing.basis` (CLOSE·HL), `swing.revPct`, `swing.revAtr` — V-13
- `swing.window`, `swing.k`, `swing.minDist`, `swing.freeze`, `swing.pipMetric` — V-15 · `swing.degree` — V-16
- `zone.width`, `zone.tickFloor` — V-17 · `diag.anchor` (WICK·CLOSE) — V-18
- `retest.clock`, `retest.confirmClock`, `fake.clock` — V-24 · `atr.len` — V-25 · `scale.mode` (PCT·VOLU) — V-3

### Events (E)
- `ebar.trendBodyFrac`, `ebar.trendCloseLoc` — E-2 · `ebar.neutralBodyFrac` — E-3
- `reject.method` (RJ-W·RJ-C·RJ-R), `reject.wickFrac`, `reject.closeLoc`, `reject.rangeAtr` — E-4
- `ebar.insideStrict` — E-5 · `ebar.engulfMode` (EG-B·EG-R) — E-6
- `sqz.method`, `sqz.n`, `sqz.atrFrac`, `sqz.meanLen`, `sqz.declineCount`, `sqz.clock` — E-7
- `gap.basis` (RANGE·CLOSE), `gap.minSize` — E-8 · `gap.fillClock` — E-9 · `gap.ctxLookback` — E-11/12 · `gap.exhClock` — E-14

### Standards (C)
- `cfm.mode` (TWO-CONSEC·WINDOW·SINGLE-FILTERED), `cfm.window`, `cfm.singlePen`, `cfm.verdictClock` — C-1/2/6
- `cfm.graders`, `cfm.gradePen`, `cfm.gradeLookback` — C-10

### Levels (L)
- `level.anchor` (WICK·CLOSE) — L-1 · `level.gapEdges` (BOTH·NEAR·FAR) — L-2 · `level.periodSet` — L-3 · `level.roundSet` — L-13
- `zone.method` (ZW-P·ZW-A·ZW-MAX·ZW-W), `zone.pct`, `zone.atrMult`, `zone.minTouches` — L-4
- `level.testGapMin` — L-5 · `level.qMethod` (QL-TIER·QL-SCORE), `q.minEpisodes`, `q.minReact`, `q.reactWindow`, `q.minAge`, `q.srcWeight.*` — L-6
- `level.watchAt` — L-7 · `level.lateFlip` (ALLOW·FORBID), `retest.clock2` — L-9 · `level.maxAge`, `level.farDist`, `level.farClock` — L-10 · `level.clusterRetire` (MERGE·KEEP) — L-10/11
- `[table]` `level.testOdds[n]` — L-7

### Diagonals (D)
- `diag.anchorSkip`, `diag.roleSlope` (WITH·BOTH) — D-1 · `diag.slopeMin`, `diag.slopeMax` — D-3
- `chan.anchor` — D-5 · `chan.walkCount` — D-7 · `diag.maxLive` — D-6 · `ref.rankOrder` — D-8

### Structure (S)
- `struct.sameSide` (EXTREME) — S-1 · `struct.eqTol` — S-2 · `trend.minSwings` — S-3
- `retr.basis` (CLOSE·HL), `retr.method` (RD-F·RD-FIB·RD-V·RD-S), `retr.atrMult`, `retr.shallowMax`, `retr.deepMin` — S-8 · `struct.pauseBars` — S-10

### Ranges (R)
- `range.formLookback`, `range.minTouches`, `range.minHeight` — R-1 · `range.nmzFrac` — R-3 · `range.matEpisodes` — R-5 · `range.dissolveBars` — R-6
- `[table]` `range.matOdds` — R-5 · `range.failLoadOdds` — R-7

### Breakouts (B)
- `brk.pressureClock`, `brk.tightCount` — B-3 · `brk.objMethod` (OBJ-H·OBJ-SW·OBJ-ATR·OBJ-NEXT·OBJ-MG), `brk.objBase` (BREAK-LEVEL·CONFIRM-CLOSE), `brk.objAtrMult` — B-6 · `brk.runawayDist` — B-7
- `[table]` `brk.entryOdds`, `brk.objOdds`, `brk.gapEntryOdds` — B-5/6/10

### Aftermath (A)
- `fake.entryMode` (IMMEDIATE·CONF), `fake.setupClock` — A-3 · `after.whipsawCount`, `after.whipsawWindow`, `after.standDownClock` — A-6 · `after.flipWatchAt` — A-7
- `[table]` `fake.setupOdds`, `after.flipTestOdds` — A-3/A-7

### Volume (Q)
- `vol.baseMethod` (SMA·MEDIAN), `vol.baseLen`, `vol.hiMult`, `vol.loMult`, `vol.todSessions` — Q-2 · `evr.smallMax`, `evr.largeMin` — Q-4 · `vol.dryCount` — Q-5 · `clim.volMult`, `clim.rangeMult`, `clim.extremeLookback` — Q-6 · `vol.earnStand` (STAND·DISCOUNT), `vol.calStand` — Q-9
- `[table]` `vol.breakLift`, `vol.dryLift`, `vol.climaxOdds` — Q-7/5/6

### Indicators (I)
- `ma.houseSet`, `ma.type` (SMA·EMA·RMA), `ma.period` — I-3 · `dyn.set` — I-4
- `rsi.period`, `rsi.thresholdMode` (FIXED·PERCENTILE), `rsi.ob`, `rsi.os` — I-6 · `macd.fast`, `macd.slow`, `macd.signal` — I-7 · `wr.period`, `wr.ob`, `wr.os` — I-8
- `audit.rhoWindow`, `audit.rhoMax`, `audit.liftMin`, `audit.pairs` — I-2 · `div.minDelta`, `div.hidden`, `isw.n` — I-9 · `vol.nFast`, `vol.nSlow`, `vol.hi`, `vol.lo`, `vol.window` — I-10 · `adx.period`, `adx.trendMin` — I-11
- `[table]` `ind.xcLift` — I-5

### Patterns (P)
- `pat.candidateClock` — P-1 · `pat.contextLookback` — P-2 · `pat.mwCount` (2·3) — P-4 · `flag.poleMin`, `flag.gapBars`, `flag.maxBars` — P-6 · `tri.pennantMaxBars`, `apex.frac` — P-6/7
- `[table]` `pat.bustedOdds` + the pattern ledger family (SEED-EXT → loop-filled) — P-8/9

### Regime (X)
- `regime.lookup` (state × family → ACTIVE/SUSPENDED) — X-4 · `regime.deadClock` — X-7 · `regime.divWeight[state]`, `regime.oscWeight[state]` — X-6 · `clim.clusterCount`, `clim.clusterWindow` — X-5 · `vol.earnStand`, `vol.calStand` — X-8
- `[table]` `regime.disputeOdds` — X-3

### Multi-timeframe (M)
- `mtf.stack` (ordered frame,role) — M-1 · `agg.short` (stamp) — M-2 · `mtf.conflictRank` (FRAME-FIRST·DEGREE-FIRST) — M-3 · `mtf.regimeGate` (OFF; second-wave) — M-4
- `[table]` `mtf.alignOdds`, `mtf.warnOdds`, `mtf.conflictOdds` — M-8

### Universe (U)
- class profiles (INDEX·ETF·LARGE-CAP·SMALL-CAP·FX·CRYPTO·COMMODITY-FUT) — U-1 · `uni.pctlLookback` — U-3 · `rs.bench`, `rs.noGap` — U-4 · `breadth.hi`, `breadth.lo` — U-5 · `bar.sessionAnchor`, `bar.roll` — U-7 · `zone.tickFloor` per class, `uni.floorClock` — U-8
- `[table]` `uni.mktAlignOdds`, `uni.transferOdds` — U-6/9

### Risk (K)
- `k.entryDoctrine` (ENTRY-C·ENTRY-R·CONTEXT-TABLE), `k.gradeFloor`, `k.setupClasses`, `k.riskPerTrade`, `k.scaleOutFrac`, `k.chaseMode`, `k.pyramid`, `k.maxPositions`, `k.maxPerClass`, `k.profileChangeClock` — K-2 · `risk.stopBufferAtr` — K-4 · `k.sizeMult[grade]` — K-5 · `k.regimeMult[state]`, `k.climateMult` — K-6 · `risk.stepDownR`, `risk.recoverR`, `k.ladderMult` — K-7 · `k.positionTTL`, `k.exitMode` — K-8
- `[table]` `risk.profileOdds`, `risk.stopOdds`, `risk.entryDoctrineOdds` — K-9

*≈180 named parameters across seventeen namespaces. Every one is swept, defaulted, or declared — none is a magic number (T-4).*

---

## PART III — THE GRAVEYARD

What the book **refuses**, and why. A pattern chapter is judged by what it declines (P-10); so is a rulebook. This is the append-only register of every excluded method, retired form, and forbidden move — the negative space that makes the positive space honest. Two directions of entry: **excluded** (never admitted, re-admissible only by algorithm + evidence, T-11) and **superseded** (once in the book, replaced on the record).

### Excluded methods (whole approaches, T-11 scope ledger)
- **Elliott Wave, Gann** — multiple legal counts, no unique algorithm; fail the two-strangers test.
- **Point & figure, Renko, Kagi, three-line-break, Heikin-Ashi** — different bar algebra; not the series of record.
- **Market profile** — a different data object (a distribution, not OHLCV bars).
- **Cycles & seasonality as edge** — survive only as CH 13 calendar stand-downs, never as a signal.
- **Sentiment, COT, flow-of-funds, open interest** — not chart events; inadmissible as confirmation.
- **Intermarket analysis** — admitted only as CH 15 macro-vs-ticker authority (stamps, not gates).
- **Fibonacci as numerology** — admitted only as CH 6/8 fraction *options* (RD-FIB, OBJ methods); ratio-pattern families (Gartley/harmonics) excluded (parameter explosion, P-10).
- **The candlestick name-zoo** — admitted only as CH 2 measurable primitives (E-1..E-7); named two-candle "patterns" are E-compositions, not a new family.
- **Breadth as a verdict** — admitted only as CH 15 rollups of verdicts already made (U-5).
- **OBV / A-D cumulative lines** — path-dependent; a second spelling, not a second witness (Q-9). Re-admission pre-authorized via the independence-audit queue, not run.
- **VWAP** — sub-daily, below the bar floor; site is CH 15's intraday build-out (Q-9).
- **Cup-and-handle, rounding tops/bottoms** — no compileable definition ("roundness" has no confirmed-swing sequence); needs a kernel-regression restatement argued into CH 1 first (P-10).
- **Broadening formations** — diverging boundaries flunk D-2 validation economics (P-10).

### Forbidden forms (moves that fail review anywhere)
- **Raw price / currency distance / chart angles ("45°")** — malformed; only PCT or VOLU (V-3/T-10, C1's lintable bug class).
- **Any indicator, volume, anatomy, or news in a CONFIRMATION/INVALIDATION clause** — nothing but price confirms (C-9); a verdict traced to a volume/indicator "confirmation" is void.
- **A grade read as permission** (branching a verdict's *existence* on a grade) — grades order, never gate (C-10, L-6, Q-3).
- **Repainting / centered / zero-lag / globally-refit methods** — barred book-wide; confirmed outputs are immutable (V-14); centered MAs specifically (I-3).
- **Free adjectives** (bullish/bearish/neutral outside a verdict's direction field) — banned (V-22); classical "bullish/bearish divergence" spellings likewise (I-9).
- **Timeframe-shopping** (cross-tf event sequences; upward event flow) — malformed (C-5, M-7).
- **Confluence double-count** (one close counted as k independent proofs) — voids the analysis (B-9, L-11); the arithmetic case of the no-stacking law.
- **Counting correlated witnesses twice** (e.g. %R and Stochastic %K, the identity pair) — one witness forever; RSI×%R seated as two *before* the audit clears — void (I-2/I-8).
- **A sixth break-reference type** — none exists until a chapter defines one and B-1 is amended (B-1).
- **Extending an objective after PAID without a fresh chain** — anti-greed; void (A-9, B-6).
- **Any activity gate other than A-6's whipsaw stand-down and X-4's regime lookup** — a new gate must clear the A-6 standard and the X-4/A-6 burden, stated in advance each time (regime scope, frame scope, cross-sectional scope).
- **A profile touching a truth field** — the invariance law; voids the analysis and indicts the tool (K-1).
- **A naked rate in prose** (any hit-rate/odds claim without a loop-filled cell + vintage) — fails review (B-11, the publication law, extended to every ledger).
- **A rule/default named after or justified by the publisher's preference** — stripped on sight (Publisher Note R6.1).

### Superseded on the record (replaced, kept for lineage)
- **V-10 v1 (arithmetic-percent `C > P×(1+pen.min)`)** → PCT/log form (corrected by C1).
- **V-12 latest-tied-bar inequalities** → the C-R5-1 tie fix (the loop caught the prose/spec contradiction in compilation).
- **E-10 gap-taxonomy stub** → promoted to E-11..E-14 (the backfill cashed).
- **C-10 reserved grader seats / Q-FUND·Q-EVR deposits** → joined at Q-3 (backfill cashed).
- **"The Alan amendment" (naming)** → the no-stacking / independence law, grounded in statistical hygiene (Note R6.1).
- **OBJ-MG (measuring-gap objective)** — pre-authorized funeral: SUPERSEDED if its hit-rate is indistinguishable from OBJ-H within CI on the loop's first pass (B-6).
- **MACD's witness seat** — pre-authorized graveyard (I-R3): retires to SUPERSEDED if the {MACD × MA-slope} audit shows no conditional lift; formula kept in 97 for reference.
- **No fifth STATUS tier / review-as-status** — resolved NO; reviews annotate via `review_ref`, only evidence promotes (T-7).
- **`range.maxHeight`** — excluded in v1 (R4-R-3); added only if data demands.
- **Hidden divergence, L-13 round numbers, VWAP, SW-P (PIP)** — parked/stub, second-wave; SW-P self-graveyards if it never beats SW-R.

---

## PART IV — THE GLOSSARY

The load-bearing vocabulary, in plain terms. Where a term is a defined object, its owning card is cited; the card is the authority.

**Bar of record / close of record** (V-1/V-2) — the one declared bar construction every rule reads, and its close, which is the *only* thing the book treats as true.

**Two-strangers test** (T-1) — a rule is finished only when two independent implementations, given the same bars, mark the same events. The book's definition of "precise enough."

**Claim vs verdict** (C-1 / C-2 / T-8) — a *claim* is a close beyond a reference, awaiting confirmation; a *verdict* is the confirmed opinion object (seven fields), the only thing in the book allowed to hold a direction.

**Void / trapped** (C-3 / A-2) — a claim that closes back inside before confirming. The failed side is now inventory that must cover — the fakeout's fuel (A-3), the book's stated edge bias.

**PCT / VOLU** (T-10 / V-25/26) — the two legal distance units: log-percent, and ATR (volatility) units. VOLU is the *transfer* unit — what lets one threshold read every instrument (U-2).

**EVENT_ONLY** (T-8 / S-4) — a verdict with no time clock, alive until a specific structural event voids it (e.g. a trend, dead only on a BOS).

**Tag** (V-9) — a completed-bar price touch of a zone. Direction-less; it grades and counts, it never decides.

**Swing (candidate / confirmed / of record)** (V-11/16) — a local extreme; *candidate* until a method (SW-F/SW-R/SW-P) confirms it; *of record* = the most recent confirmed one. Confirmed swings are immutable (V-14) and are the backbone S-1 reads.

**Level / zone / dynamic level** (V-17/19, L) — a horizontal reference with a state machine and a touch ledger; the zone is its tolerance band; a *dynamic* level is an indicator (e.g. an MA) used as a reference price — test-grade only, never claim-grade (I-4).

**Reference-binding export** (L-12) — the level behaviors (test/break/flip) are written once and *bind to any reference object* (diagonals, range boundaries), so no chapter re-writes them.

**Structure: HH/HL/LH/LL/EQ, BOS, floor/ceiling** (S) — the alternating confirmed-swing sequence and its pairwise events; a *break of structure* through the swing-of-record level (the floor/ceiling) is how a trend dies. Death is not birth of the opposite (S-10).

**Range, NMZ, spring/upthrust, COILED** (R, A-4) — two defended boundaries with traffic between; the *no-man's-land* is the forbidden middle; a failed boundary break loads the far side (LOADED-OPPOSITE) and is carded as a spring (down) or upthrust (up).

**The break chain** (B-1) — the book's spine: reference → claim → confirming close → verdict → aftermath, over five admissible reference types. Everything downstream reads the chain, never the setup's name (which is why regime and patterns compose cleanly).

**Entry doctrine (ENTRY-C / ENTRY-R)** (B-5, K-2) — enter on the confirming close, or on the retest hold. A *profile's* choice (K), priced by `brk.entryOdds`.

**Grade (A/B/C) & the grade channel** (C-10, K-5) — the count-tier of satisfied witnesses; it orders participation and, in CH 16, *sizes* the position — but only on measured (not UNMEASURED) evidence.

**Witness: grader / gauge / reference** (I-1) — an indicator's three legal capacities. Never a judge (C-9).

**No-stacking / independence law** (I-2) — correlated witnesses count once; a pair earns a second seat only by an independence audit (rank-corr + event-agreement + conditional lift). Kills the confluence self-delusion with a measurement.

**Relative volume, ABSORPTION, CLIMAX, stand-down register** (Q) — volume only ever as a ratio to its own baseline; effort-vs-result reads at a level; the exhaustion candidate (never a reversal signal); and the register of scheduled "liars" (earnings, ex-div, roll) excluded from the baseline itself.

**Regime: the four states, the lookup, the falsifiability clause** (X) — TRENDING / RANGING / TREND-IN-RANGE / TRANSITIONAL, read as arithmetic on ledgers you already stamp. The lookup suspends which rules *fire*; it may never touch a verdict's truth or void path — "a regime that could protect its own verdicts from disproof would be a religion with a lookup table."

**Stated-regime law** (X-9) — nothing promotes to TESTED on a pooled cross-regime sample. The loop's own keystone finding (the chain has no unconditional edge), written into the book as a promotion precondition.

**MTF: the stack, authority-downward, FRAME-FIRST, WARN** (M) — declared frames each with one role (CONTEXT/RECORD/ENTRY); higher frames outrank on conflict; lower-frame structure can only *warn* the higher frame early, never overrule it.

**Instrument class / profile, the normalization law, percentile mode** (U) — a class is a bundle of parameter values (never different *rules*); VOLU makes rules transfer; percentile mode lets a threshold learn each instrument's own distribution (the fix for "the S&P's RSI never reaches 30").

**Invariance law, legal knobs, the three profiles, the drawdown ladder** (K) — appetite (CONSERVATIVE/MODERATE/AGGRESSIVE) may touch only a closed list of *exposure* knobs; two profiles reading one tape hold identical truth; the stop is anchored to the card's invalidation (truth never moves, the buffer does); and every profile ships a mandatory, hysteretic de-risking ladder keyed to its own drawdown.

**SEED-EXT vs loop-filled** (P-9, B-11) — an external number (e.g. Bulkowski's failure rate) may *seed* an empty cell, stamped with its vintage and source; it may be *stated, never recommended* — only a cell the loop fills on the calibration class promotes a claim past "stated."

**UNMEASURED** (B-11) — the honest state of any rate the loop has not yet filled. An UNMEASURED claim may be stated, never recommended, and never sizes a position above neutral (K-5).

**The loop / the gate ladder (G0–G6)** — the separate validation engine that compiles each card to code and runs it through compile → signal → cross-validation → walk-forward → permutation → deflated-Sharpe → family-SPA before any DRAFT becomes TESTED. The book proposes; the loop disposes; the data crowns the defaults.

---

*Chapter 98 · the formalization appendix · v1 · REFERENCE. Master Rule Index (~156 cards) · Consolidated Parameter Registry (~180 parameters) · the Graveyard (every refusal on the record) · the Glossary. Built at draft-complete from Chapters 00–16 + 97. The book, made navigable and made honest about its own edges. — THE PUBLISHER (Alan + orchestrating session)*

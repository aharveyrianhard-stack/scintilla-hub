# CHAPTER 15 — UNIVERSE & RELATIVITY RULES (U)

**THE SCINTILLA TRADING RULEBOOK · Chapter draft · v1** (supersedes shell v0)
**STATUS: DRAFT** (all cards; promotion by publisher testing) · Sprint 8 ("Finish the Draft") — written with Chapters 12 and 16.

SUMMARY: The application layer — how one rulebook reads many instruments without forking. Instrument classes as declared profiles over the registry; the normalization law that makes rules transfer at all (the Scale Law's payoff, stated as practice); the index problem and its fix (an instrument's own percentiles, §J cashed for every bounded gauge); relative strength as a ratio series that receives the book's machinery — with an honest list of what does *not* apply to a series nobody trades; macro-versus-ticker authority, never swapped; the session templates T-9 deferred here, including what "close of record" even means where the market never closes; the intraday build-out charter every chapter has been depositing to; and the per-class promotion law that keeps a rule's TESTED status from quietly leaking across classes it was never measured on.

Compiles against: Chapters 1–14 + 97 §§J, M. Cited by: 16.

---

## BLOCK ONE — CLASSES AND TRANSFER

---

**U-1 — INSTRUMENT CLASSES AS DECLARED PROFILES**

- RULE: An **instrument class** (v1 registry: INDEX · ETF · LARGE-CAP · SMALL-CAP · FX · CRYPTO · COMMODITY-FUT) is a **declared profile**: a named bundle over existing registry parameters — the bar-contract fields (`bar.session`, `bar.tz`, `bar.adjust`, session anchor per U-6), threshold modes (U-3), calendar sets (`vol.calStand` instance, flag domains per U-7), default stack (`mtf.stack` instance), and tick/precision floors (`zone.tickFloor` values per U-8). **The class law:** rules never change per class — profiles re-parameterize them; a class needing a *different rule* (not a different value) is a finding to argue into the owning chapter, not a class overlay. Every stamped event, table cell, and promotion carries its **class tag**; the calibration class (US LARGE-CAP + INDEX, T-9 ratified) is where every default is born.
- CONFIRMATION: The profile resolves entirely to registry keys; an instrument maps to exactly one class per analysis.
- INVALIDATION: A class overlay containing rule text (not parameter values) is a forked rulebook and fails review; an untagged rate is malformed (B-11 extended).
- WHY IT MATTERS: The alternative is the field's default: a book calibrated on one market, silently applied to all of them, with the reader eating the difference. One rulebook, many profiles, every number tagged with where it was true — that is the whole application doctrine in one card.
- STATUS: DRAFT

---

**U-2 — THE NORMALIZATION LAW (WHY RULES TRANSFER)**

- RULE: The Scale Law's application clause, ratified at A2 and made book law: **VOLU (ATR units) is the transfer unit** — any threshold intended to generalize across instruments or classes is stated and swept in VOLU; **PCT thresholds are class-calibrated** — admissible cross-class only after per-class recalibration (they re-range with class volatility); raw price remains forbidden everywhere (T-10). Corollaries, operative: sweeps meant to produce transferable defaults run VOLU-primary (the loop's standing convention, now the book's); a VOLU-stated default carries a rebuttable transfer presumption to a new class (tested before trusted, per U-9); a PCT-stated default carries none.
- CONFIRMATION: Every registry entry declares its unit; transfer claims cite VOLU statements.
- INVALIDATION: A PCT threshold applied cross-class without recalibration, or a "universal" constant in raw price, voids what consumed it.
- WHY IT WORKS: A sleepy utility and a crypto pair differ mainly in how far a normal day travels — divide that out and the same grammar reads both; fail to, and every threshold is a hidden bet on one class's volatility. T-10 did the heavy lifting six chapters before it paid; this card is the receipt.
- STATUS: DRAFT

---

**U-3 — ADAPTIVE THRESHOLDS (§J CASHED — THE INDEX PROBLEM)**

- RULE: **The index problem, stated mechanically:** an index is a diversified mean — idiosyncratic moves cancel, return distributions compress, and every bounded gauge calibrated on single names systematically under-reaches on it (the standing example: the S&P's RSI almost never tags Wilder's 30 — "oversold" defined on stocks simply fails to occur on the aggregate). **The fix, generalized to every bounded oscillator and gauge state** (I-6/I-8's toggle, I-10's VOL-PCTL, 97 §J — one card, all instances): PERCENTILE mode — the instrument's **own** rolling `uni.pctlLookback`-bar quantiles (`q_ob`/`q_os` and analogs) define its OB/OS/HIGH/DEAD lines. **The cross-class admissibility law:** a threshold-bearing condition consumed outside its calibration class must be either VOLU-denominated (U-2) or PERCENTILE-mode; a fixed absolute line is a single-class artifact, legal only inside the class that calibrated it.
- CONFIRMATION: Threshold mode declared per rule per class profile; percentile lines computable once the lookback fills.
- INVALIDATION: A fixed line consumed cross-class, or a percentile line read before its window fills, voids the condition's reads.
- WHY IT WORKS: "Oversold" is a claim about *this instrument's own history*, and only its own distribution can define it. Percentile mode is self-calibration — the gauge learns the instrument instead of the book guessing it — and it is the difference between one oscillator chapter and seven class-specific ones.
- STATUS: DRAFT

---

## BLOCK TWO — RELATIVITY

---

**U-4 — RELATIVE STRENGTH (THE RATIO SERIES, FULL TREATMENT — AND ITS HONEST LIMITS)**

- RULE: `RS[t] = C_instrument[t] / C_benchmark[t]` (97 §M), both legs from declared series of record, the benchmark declared per class profile (`rs.bench`). The ratio is a **derived series of record** and receives the book's machinery *by declaration, per module* — the book's best free lunch, itemized rather than assumed. **Applies unchanged:** swings (V-11 methods; SW-R's VOLU variant uses the ratio's own ATR), structure (S — a ratio BOS is a leadership change, stamped RS-BOS), levels and diagonals (L/D on ratio prices), regime (X-2 on the ratio's own objects), the C-machinery for all of it. **Does not apply, barred with grounds:** volume and every Q card (a ratio has no attendance; there is nothing to grade); gap machinery E-8..E-14 (a ratio "gap" is either leg's artifact — ratio bars carry `rs.noGap` and C-8's gap handling stands down); candle anatomy E-1..E-7 as *evidence* (a ratio bar's "wick" is a quotient of two anatomies — anatomy grades are inadmissible on ratio series; the events still exist as arithmetic, they simply may not testify). **Consumption law:** ratio verdicts and stamps are **context and grade evidence for the instrument** (RS-LEADING / RS-LAGGING / RS-BOS annotations joining tables) — they gate nothing and touch no instrument verdict (the M-4 pattern, cross-sectional edition).
- CONFIRMATION: Both legs' bars of record closed (the ratio bar exists only when the later of the two closes — V-8 across series); each applied module cited, not assumed.
- INVALIDATION: A volume, gap, or anatomy read on a ratio series is malformed; an RS annotation consumed as confirmation (C-9) or as an instrument gate is void.
- WHY IT WORKS: Leadership is real information the price of either leg alone cannot show, and the ratio is the one place the book gets an entire analysis dimension almost free — *almost* being the card's honest work: the machinery that assumes an auction (volume, gaps, anatomy) has no subject in a series nobody trades, and pretending otherwise would counterfeit evidence.
- STATUS: DRAFT

---

**U-5 — BREADTH (VERDICT ROLLUPS, NEVER A NEW VERDICT TYPE)**

- RULE: **Breadth** = universe-level aggregation of member verdict objects (V-21 rollups, 97 §M): over a declared universe list (point-in-time membership — survivorship discipline is the loop's PIT law, cited not restated), `breadth[t]` = the fraction of members with a live S-4 verdict by direction (and analog rollups: fraction in RANGING, fraction of members' X-2 states by value). Breadth series are **gauge inputs to the benchmark's context** (X-5-class evidence for the index's climate; MKT-stamps' supporting data per U-6's authority card... routed via U-1's INDEX profile) — never a new verdict type, never a member gate. Thresholds (`breadth.hi`/`breadth.lo`) are percentile-mode citizens (U-3).
- CONFIRMATION: Computable at t_close from members' stamped verdicts over the declared PIT universe.
- INVALIDATION: A breadth read over a non-PIT universe (today's members projected backward) is survivorship fiction and voids every consumer; a "breadth verdict" is malformed on its face.
- WHY IT WORKS: Breadth is the census of what the book already decided one instrument at a time — powerful precisely because it adds no new judgment, only counting. The moment it becomes its own verdict type it starts competing with its own inputs; as a rollup it can only inform them.
- STATUS: DRAFT

---

**U-6 — MACRO vs TICKER AUTHORITY (NEVER SWAPPED)**

- RULE: The cross-sectional analog of M-3/M-4, with the same shape and the same wall: for a single-name decision, the declared **context ladder** = benchmark index regime (X-2 on `rs.bench`'s objects) → optional sector/group layer (a second declared benchmark) → the ticker itself. **Indexes set context; tickers produce trade verdicts — never swapped:** benchmark states enter as stamps (**MKT-ALIGNED / MKT-OPPOSED**, joining the tables beside HTF stamps) and as CH 16 exposure inputs; no benchmark verdict opens, confirms, voids, or expires anything on the ticker (the ticker's ledger is sovereign over its own truth), and no ticker aggregate re-judges the index (that is breadth's lane, U-5). A macro *gate* (suspending ticker rule families on benchmark regime) is second-wave and owes the X-4/A-6 burden — the third such wall in the book (regime scope, frame scope, and now cross-sectional scope), stated in advance each time so the future argument arrives with its bar set.
- CONFIRMATION: Ladder declared per profile; stamps computed from the benchmark's completed bars (M-2's discipline applies — a forming index bar is rumor here too).
- INVALIDATION: A ticker analysis citing "the market" without a declared benchmark is prose; a benchmark state consumed as ticker confirmation or gate is void.
- WHY IT WORKS: Most single-name mistakes are index opinions wearing a ticker's name, and most index mistakes are one ticker's story generalized. One ladder, stamps not gates, sovereignty at each level — and the alignment lift becomes a column (`uni.mktAlignOdds`) instead of a slogan, exactly as M-8 did for frames.
- STATUS: DRAFT

---

## BLOCK THREE — SESSIONS AND THE BUILD-OUT

---

**U-7 — SESSION TEMPLATES & THE 24-HOUR PROBLEM (T-9'S DEFERRAL, LANDED)**

- RULE: Per-class session declarations, completing the bar contract: **EQUITY/ETF/INDEX** — RTH (ratified; the closing auction is the close of record, V-2 as written). **FX** — FULL24 weekly (24/5): the bar boundary is the declared anchor `bar.sessionAnchor` (v1 default 17:00 America/New_York — the field's settlement convention); the "daily close" is that anchor's print, and V-2's truth-bearer survives by convention *declared*, not discovered. **CRYPTO** — FULL24 continuous: anchor default 00:00 UTC; no weekend absence (a seven-bar week is the class's normal — V-7's missing-bar law reads the class calendar, not the NYSE's). **COMMODITY-FUT** — exchange session per contract with the roll flagged (`bar.roll` — roll bars join Q-9's stand-down register for volume and E-8's for gaps; the administrative-gap doctrine, futures edition). **The anchor warning (T-9's own):** different anchors produce different books — an anchor is a bar-contract field, stamped on every event, and two analyses with different anchors never share a ledger. M-2's "completed bar" re-states per class mechanically (completion = the anchor boundary passing).
- CONFIRMATION: One template + anchor per class profile; every bar of record carries them.
- INVALIDATION: Mixing anchors inside one analysis voids it (V-1's invalidation, session edition); an undeclared-anchor 24h close is not a close of record.
- WHY IT WORKS: Where the market never closes, "the close" is a decision someone made — the book's move is to make it *once, in the registry, out loud*, because the alternative is every chart service quietly making it differently and every cross-source number disagreeing by one anchor's worth.
- STATUS: DRAFT

---

**U-8 — DEGENERATE-PRICE FLOORS (`zone.tickFloor` BUILT OUT)**

- RULE: The C3 stub, cashed: `zone.tickFloor` (V-17/L-4 — effective zone width never below `zone.tickFloor × tick`) receives its per-class values: v1 proposal — calibration class 2 ticks; SMALL-CAP/sub-$1 names 3–5 ticks (the class where the floor exists: percentage zones on a $0.40 name collapse below markability and every touch list corrupts); FX 2–3 pips by pair convention; CRYPTO per-venue tick tables (declared per profile — venue precision varies). The floor applies wherever zones exist (levels, diagonals, boundaries — L-12 uniformity); an instrument whose normal zone computation sits *at* its floor for > `uni.floorClock` bars is stamped DEGENERATE and drops from the tradable universe per profile (a universe rule, not a truth rule — its ledgers keep accruing).
- CONFIRMATION: Floors resolve from the class profile + instrument tick size; the DEGENERATE stamp from the clock.
- INVALIDATION: A zone below its floor, or analysis published on a DEGENERATE-stamped instrument under a profile that excludes them, fails review.
- WHY IT MATTERS: At the bottom of the price scale, the grid itself is the volatility — zones thinner than a few ticks measure the exchange's rounding, not the auction. The floor is one parameter; the alternative is every low-priced instrument quietly poisoning the class tables.
- STATUS: DRAFT

---

**U-9 — THE INTRADAY BUILD-OUT CHARTER & PER-CLASS PROMOTION**

- RULE: **The charter (the deposits gathered, activation conditions declared):** when a class profile declares sub-daily frames, the following activate as a set, none separately: the ENTRY role under M-6's standing law (`mtf.stack` gains its entry frame); `vol.todSessions` time-of-day baselines (Q-2 — plain relVol lies at the open; the U-curve is the class's furniture); session-boundary stand-downs as X-8 calendar extensions (opening/closing auction windows, declared per class); and the bar floor drops per profile (T-9 amended by that profile, not globally). Until a profile activates the set, the daily floor stands and this card is the contract, not the construction. **Per-class promotion (the stated-class law, completing the ledger's third tag):** TESTED status is per-class, alongside per-regime (X-9) and the ≥2-feed rule — promotion on the calibration class transfers to no other class; a VOLU-stated default carries U-2's rebuttable presumption *into the sweep*, never past it; `uni.transferOdds` publishes how calibration-born defaults actually fared out-of-class, loop-filled.
- CONFIRMATION: Activation is a profile event (registry change, stamped); promotions carry all three tags (regime · class · feeds).
- INVALIDATION: A sub-daily rule firing without its class's full activation set, or a cross-class TESTED claim without its own class's ladder, is void.
- WHY IT WORKS: The intraday world is not a smaller daily world — its volume lies on a clock, its opens are auctions, its noise floor is different furniture — so the book activates it as a *set of laws* or not at all. And the promotion tag closes the last quiet leak: a rule true on large-caps in trend on two feeds is exactly that, and the ledger now says so in three dimensions.
- STATUS: DRAFT

---

## PARAMETER REGISTRY ENTRIES (introduced by this chapter)

| Parameter | Domain | Card | Proposed test range |
|---|---|---|---|
| class profiles | INDEX · ETF · LARGE-CAP · SMALL-CAP · FX · CRYPTO · COMMODITY-FUT | U-1 | calibration class first; others as build-outs |
| `uni.pctlLookback` | bars | U-3 | 252–504 (daily) |
| `rs.bench` | declared benchmark per profile | U-4 | SPX/sector per class |
| `rs.noGap` | stamp (mechanical) | U-4 | — |
| `breadth.hi` / `breadth.lo` | percentile-mode thresholds | U-5 | §J pattern |
| `bar.sessionAnchor` | class anchor time | U-7 | FX 17:00 NY · crypto 00:00 UTC (declared, sweepable) |
| `bar.roll` | stamp (futures) | U-7 | mechanical |
| `zone.tickFloor` per class | ticks | U-8 | 2 · 3–5 · 2–3 pips · per-venue |
| `uni.floorClock` | bars | U-8 | 20–60 |
| `uni.mktAlignOdds` / `uni.transferOdds` | honesty tables | U-6/U-9 | loop-filled |

## SOURCES

Kirkpatrick (relative strength as the field's best-evidenced ranking claim — U-4's empirical license, with Levy's lineage) · Murphy (intermarket context — U-6's ancestry, mechanized into a ladder of stamps) · Edwards, Magee & Bassetti (the class-dependence of classical thresholds, admitted in their own caveats) · Aronson (the cross-class data-mining trap behind U-3/U-9's admissibility laws) · ARCHITECT-REVIEW-A2 (PCT class-relative / VOLU transfer — ratified there, law here; the PIT universe discipline U-5 cites) · 97 §§J, M (the math homes) · The Contract T-9/T-10 (the deferrals this chapter lands).

## OPEN-DEPOSITS (claims on later chapters)

**To CH 16 (Risk, landing with this chapter):** class profiles and DEGENERATE/floor rules bound each risk profile's tradable universe; MKT/RS stamps are sizing inputs through the legal channel; nothing here gates truth.
**To the loop:** the class dimension multiplies the grid — VOLU-primary sweeps with per-class PCT recalibration is the standing order (A2 §2.4); `uni.transferOdds` wants the first out-of-class run (ETF class is the cheapest second class: same feeds, same sessions); the FX/crypto anchors are declared and sweepable before any 24h data enters.
**To the formalization pass:** class profiles are the natural serialization unit for CardSpec parameter blocks (one profile = one overlay file).

## OPEN QUESTIONS (for the publisher)

1. **The v1 second class (U-1/U-9):** author proposes ETF as the first transfer test (identical plumbing, one distribution step from the calibration class) before any 24h class. Confirm the order, or jump to FX if the visual workstream needs it sooner.
2. **Crypto's anchor (U-7):** 00:00 UTC is the declared default; the honest alternative is exchange-local daily candles per venue. One anchor for the class, or per-venue anchors in the profile? Author leans one-per-class (cross-venue comparability beats venue fidelity for a rulebook).
3. **The sector layer (U-6):** shipped as an optional declared layer with no default benchmark set. Ruling wanted on whether the v1 calibration work carries sector context at all, or ships index-only until `uni.mktAlignOdds` justifies the second ladder rung.

*Chapter 15 v1 · 9 cards · DRAFT · review_ref: PUBLISHER-REVIEW-R6 (Sprint 8 go-ahead). Compiled against: Chapters 1–14 + 97. One rulebook, many profiles; thresholds that learn their instrument; a free lunch itemized; the market never swapped for the ticker; and every promotion tagged with where it was earned. — THE SCINTILLA RULEMAKER*

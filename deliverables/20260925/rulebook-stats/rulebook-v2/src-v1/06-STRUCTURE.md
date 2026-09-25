# CHAPTER 6 — TREND & STRUCTURE RULES (S)

**THE SCINTILLA TRADING RULEBOOK · Chapter draft · v2** (supersedes v1)
**STATUS: DRAFT** (all cards; promotion by publisher testing)
**v2 changelog (PUBLISHER-REVIEW-R3):** R3-R-4 — the EQ→pattern boundary CONFIRMED and written into S-2 as a routing line (CH 12 owns converting EQ runs into double/triple-top candidates; this chapter supplies raw material only). R3-R-3 — `trend.minSwings` goes to the loop unruled: both values sweep, the author's lean to 4 recorded as the prior, downstream-event fitness crowns. Both open questions RESOLVED in place. No card mechanics touched.

SUMMARY: When a trend is a fact instead of a feeling. The alternating swing sequence, HH/HL/LH/LL as tolerance-exact events, trend existence and the suspected state before it, the EVENT_ONLY trend verdict with its decidability shown, break of structure through the swing of record, retracement-depth machinery, and the honest difference between a trend pausing and a trend dying.

**Reorder note (T-6 spent by R2):** written before Chapter 5 by publisher order. Verified: no card below cites a diagonal, channel, or any CH 5 object — this chapter compiles against Chapters 1–4 only, which is what made the bump free.

**For the loop engineer:** this chapter is the swing bake-off's scoring target. S-2 (HH/HL events), S-3/S-4 (trend fact and verdict), and S-7 (BOS) are the derived events each `swing.method` option should be scored on — method quality = quality of the structure story it tells downstream, not prettiness of its pivots.

Compiles against: Chapters 1–4 (no CH 5 dependency). Cited by: 5, 7, 8, 9, 12, 13, 14.

---

## BLOCK ONE — THE SEQUENCE

---

**S-1 — THE ALTERNATING SEQUENCE**

- RULE: Structure on a declared (tf, `swing.method`, `swing.degree`) is read from the **alternating sequence** of confirmed swings (V-11/V-16): H, L, H, L… When a method confirms two same-side swings with no intervening opposite swing (possible under SW-F; impossible under SW-R by construction), the sequence keeps one per `struct.sameSide` = EXTREME (the more extreme price; ties → earlier bar) — the discarded swing remains in the swing ledger but not in the structure sequence.
- CONFIRMATION: Each sequence entry inherits its swing's confirmation event; the sequence updates only at confirmations.
- INVALIDATION: A sequence containing two adjacent same-side entries, or an unconfirmed candidate, is malformed; every structure event read from it is void.
- WHY IT MATTERS: Every card below is arithmetic on this sequence. If two strangers hold different sequences, nothing downstream can save them — so the sequence rule comes first and admits no judgment.
- STATUS: DRAFT

---

**S-2 — HH · HL · LH · LL · EQ (THE PAIRWISE EVENTS)**

- RULE: For consecutive same-side entries at prices p₁ (earlier) and p₂ (later), with d = d(p₁→p₂) in the declared `scale.mode` (V-26): **higher** iff `d > struct.eqTol`; **lower** iff `d < −struct.eqTol`; **EQUAL (EQ)** iff `|d| ≤ struct.eqTol`. This yields the five events: HH, LH, EQ-H on the high side; HL, LL, EQ-L on the low side. Each event is stamped at the later swing's confirmation bar. EQ events neither extend nor break a run of HH/HL (or LH/LL) — the sequence position holds through them. **Routing (R3-R-4):** this card supplies EQ-H / EQ-L runs as raw material only — **CH 12 (Patterns) owns converting EQ runs into double/triple-top candidates.** One-rule-one-home; the next reader inherits the boundary instead of re-deriving it.
- CONFIRMATION: The inequality at the later swing's confirmation.
- INVALIDATION: n/a — pairwise facts of the confirmed sequence; superseded, never voided.
- WHY IT WORKS: "Higher high" without a tolerance is a coin-flip at the margin — and the margin is where double tops live. `struct.eqTol` is the two-strangers line between "higher" and "the same," and CH 12's M/W pattern family will inherit it unchanged.
- STATUS: DRAFT

---

## BLOCK TWO — TREND AS FACT

---

**S-3 — TREND EXISTENCE**

- RULE: An **UP-TREND exists** on (tf, method, degree) at the first t_close where the trailing structure sequence contains ≥ `trend.minSwings` consecutive non-EQ events that are all HH (high side) and HL (low side), interleaved, with no LH or LL among them. (Default test shape: HL·HH·HL·HH — two of each.) Mirror for DOWN-TREND (LH·LL…). The completing event's confirmation bar is the trend's birth bar. EQ events inside the window neither qualify nor disqualify (S-2).
- CONFIRMATION: The completing pairwise event confirms → the trend fact exists.
- INVALIDATION: Per S-7 (structure break) — a trend fact ends only by its void event, never by recount.
- WHY IT WORKS: Rhea's definition made countable: an uptrend is the market repeatedly paying more and refusing to pay less, enough times that coincidence is the worse explanation. `trend.minSwings` prices how many times is enough — that's testing's number, not mine.
- STATUS: DRAFT

---

**S-4 — THE TREND VERDICT (THE EVENT_ONLY CITIZEN)**

- RULE: Trend existence (S-3) births the verdict {subject_type: STRUCTURE, subject_id: (tf, method, degree, direction), direction: BULLISH (up-trend) / BEARISH (down-trend), tf_of_record, born_event: S-3's completing confirmation, void_event: S-7 CONFIRMED opposite break of structure, expiry_clock: **EVENT_ONLY**}. **Decidability, per T-8's test:** from birth onward a structure floor (S-6) exists at every t_close; the void predicate is a C-1/C-2 sequence against that floor's zone, and C-1/C-2/C-3/C-6 guarantee every claim terminates in ≤ `cfm.window` bars — so "has the void event occurred?" evaluates TRUE or FALSE on every close, forever. No dangling state exists; EVENT_ONLY is earned, not asserted.
- CONFIRMATION: S-3.
- INVALIDATION: S-7 confirmed against the trend — and nothing else. No bar count, no fading momentum, no opinion retires a trend verdict (T-8; Rhea's law kept inside the mechanism).
- WHY IT WORKS: A trend forced to expire on a counter is an opinion with a kitchen timer; a trend that can't die is a religion. EVENT_ONLY with a decidable void event is the narrow gate between the two.
- STATUS: DRAFT

---

**S-5 — THE SUSPECTED-TREND STATE**

- RULE: When the trailing sequence shows at least one HH or HL (mirror: LH or LL) but fewer than `trend.minSwings` qualifying events, the structure is **SUSPECTED-UP** (mirror SUSPECTED-DOWN) — a state, not a verdict. In this state: no trend verdict exists, no trend-conditional rule may fire, and downstream regime detectors read it as TRANSITIONAL (CH 13 deposit). The state resolves by exactly one of: completion (S-3 fires), negation (a counter-event — LH or LL for suspected-up — dissolves the state), or supersession (the opposite suspected state begins).
- CONFIRMATION: The qualifying first event's confirmation.
- INVALIDATION: Negation or supersession, stamped.
- WHY IT WORKS: The costliest structural error is trading the trend you can see forming. The suspected state gives the forming thing a name precisely so rules can be forbidden from touching it.
- STATUS: DRAFT

---

## BLOCK THREE — THE FLOOR AND ITS BREAK

---

**S-6 — THE STRUCTURE FLOOR (AND CEILING)**

- RULE: For a live UP-trend, the **structure floor** = the most recent confirmed HL entry's swing — which, per L-1, has already birthed a level; the floor *is* that level object (same ledger, same zone per L-4, same episode history per L-5). The floor advances to each newer confirmed HL; prior floors remain ordinary levels. Mirror: the **structure ceiling** (most recent LH) for down-trends. The floor/ceiling is the swing of record (V-16) bound to a role.
- CONFIRMATION: Each new qualifying swing confirmation re-points the floor.
- INVALIDATION: A floor read from a candidate swing, or from a discarded same-side duplicate (S-1), is void.
- WHY IT WORKS: One object, one ledger — the price where the trend's last buyer defended is simultaneously a level and the trend's life-line, and pretending those are two things is how books contradict themselves.
- STATUS: DRAFT

---

**S-7 — BREAK OF STRUCTURE (BOS)**

- RULE: A **BOS claim** against an UP-trend = a C-1 claim DOWNWARD through the structure floor's zone (V-10 close below the zone's lower edge on the tf of record). It composes under the full C-machinery: **BOS CONFIRMED** per the declared `cfm.mode` → fires S-4's void event (trend verdict dies, stamped) and the floor level transitions per L-8. **BOS VOID** (C-3: close back above the zone before confirmation) → trend verdict untouched, and the void is stamped as a **failed structural attack** — the trap context CH 9's spring machinery consumes (deposit). **BOS EXPIRED** (C-6) → trend untouched, attempt counter increments (C-11). Mirror for down-trends through the ceiling.
- CONFIRMATION: The C-2 event against the floor zone.
- INVALIDATION: C-3 / C-6 terminal events; and no BOS may be declared from intrabar penetration, wick depth, or speed (C-7, C-9).
- WHY IT WORKS: The trend's whole claim is "pullbacks hold above the last one." BOS is that claim failing under the same evidentiary standard as every other break in the book — one grammar, no special pleading for structure.
- STATUS: DRAFT

---

## BLOCK FOUR — COUNTER-MOVES

---

**S-8 — RETRACEMENT DEPTH (METHOD OPTIONS)**

- RULE: For a live UP-trend, the **impulse leg** = d(floor → most recent confirmed HH) and the **counter-move** = d(that HH → x), where x = C or the running adverse extreme per `retr.basis` ∈ {CLOSE, HL}; both distances in the declared `scale.mode`, depth ratio `r = counter / leg` (dimensionless — the scale units cancel). Depth classification per `retr.method`:
  - **RD-F (fixed fractions):** bands at {1/3, 1/2, 2/3}.
  - **RD-FIB (Fibonacci fractions):** bands at {0.382, 0.500, 0.618} — admitted as testable fractions (T-11); the numerology stays outside.
  - **RD-V (volatility depth):** counter-move measured directly in ATR multiples (`retr.atrMult`), ignoring the leg ratio.
  - **RD-S (structural):** depth is irrelevant; only the floor governs (the minimalist option — S-9 collapses to floor-logic alone).
  Classification: SHALLOW (r ≤ `retr.shallowMax`), NORMAL, DEEP (r ≥ `retr.deepMin`) under the chosen bands.
- CONFIRMATION: Computable at every t_close of a live trend.
- INVALIDATION: A depth mixing bases or read against a stale leg (leg must use the *current* floor and most recent HH) is void.
- WHY IT WORKS: "How far back is too far" is the field's oldest argument — Dow's thirds, the Fibonacci set, the volatility school, and the purists who only watch the floor. Four options, one bake-off; Grimes's impulse-retracement structure is the frame, and the winner is empirical.
- STATUS: DRAFT

---

**S-9 — PULLBACK · DEEP PULLBACK · REVERSAL-CANDIDATE (THE EVENTS)**

- RULE: Within a live UP-trend, a counter-move is exactly one of, evaluated at each t_close:
  - **PULLBACK:** no tag of the floor zone, depth < `retr.deepMin`. Trend verdict untouched; no annotation.
  - **DEEP PULLBACK:** depth ≥ `retr.deepMin` but no C-1 claim through the floor. Trend verdict untouched + **WATCH annotation** (evidence for C-10 graders; never a verdict — the L-7 pattern).
  - **REVERSAL-CANDIDATE:** a C-1 claim opens through the floor zone (S-7's claim). Resolves per S-7 into BOS CONFIRMED (trend dies) / VOID (failed attack; trap context) / EXPIRED.
  The **first counter-swing** after trend birth — the first confirmed counter-direction swing — proves the trend has a two-sided rhythm (its first real pullback) and proves nothing else: it changes no verdict, and any rule reading it as reversal evidence fails at review (assessment §7.4, made law).
- CONFIRMATION: Each classification is a t_close fact of the sequence + depth machinery.
- INVALIDATION: Classification from intrabar extremes under `retr.basis` = CLOSE, or from an unconfirmed counter-swing, is void.
- WHY IT WORKS: Every reversal starts as a pullback, but almost no pullbacks become reversals — so the book refuses to let depth alone rename the thing. Depth annotates; only the floor, under full confirmation law, converts.
- STATUS: DRAFT

---

**S-10 — TREND DEATH vs TREND PAUSE**

- RULE: **DEATH** = S-7 BOS CONFIRMED: the verdict voids, stamped; the structure state becomes NO-STRUCTURE (or an already-forming opposite suspected state, if its qualifying events exist). **Death of an up-trend is not birth of a down-trend** — each direction earns its own S-3 fact from its own sequence; no auto-reversal, ever. **PAUSE** = the sequence stops producing new HH events for `struct.pauseBars` while the floor holds: the verdict remains fully in force (EVENT_ONLY — boredom is not evidence), annotated PAUSED for CH 13's SUSPEND machinery (deposit); the annotation clears on the next non-EQ qualifying event.
- CONFIRMATION: Death: the C-2 event. Pause: the bar count at t_close.
- INVALIDATION: Death without a confirmed BOS, or a "reversal" declared from a pause, fails at review.
- WHY IT WORKS: Most trends don't die at the moment they stop advancing; most analysts do. Separating the ledger's two states — voided versus merely quiet — is where this chapter earns its keep, and the no-auto-reversal law is the cheapest overtrading vaccine in the book.
- STATUS: DRAFT

---

**S-11 — AFTER THE BREAK (THE HANDOFF)**

- RULE: On BOS CONFIRMED: the dead trend's final floor is now a BROKEN level running L-8/L-9's machinery (retest, flip, reversion — CH 9 owns the setups around it); the structure sequence continues accumulating under S-1/S-2 toward whatever it next proves (S-3 in either direction, or CH 7's range birth once that chapter's boundary evidence accrues — deposit); and the degree-(d+1) sequence recomputes its candidates from the updated degree-d pivots (V-16; confirmed higher-degree swings immutable per V-14). This card creates no verdicts; it routes the aftermath to its owners.
- CONFIRMATION: Bookkeeping at the BOS-confirmed close.
- INVALIDATION: n/a — routing law; a chapter found doing another owner's aftermath here fails one-rule-one-home.
- WHY IT WORKS: The bars after a structure break are the most information-dense in the book and belong to three different chapters. Saying which parts go where — at the moment of the break, in writing — is how the chapters stay short and the reader stays oriented.
- STATUS: DRAFT

---

## PARAMETER REGISTRY ENTRIES (introduced by this chapter)

| Parameter | Domain | Card | Proposed test range |
|---|---|---|---|
| `struct.sameSide` | EXTREME (ties → earlier) | S-1 | fixed rule, no range |
| `struct.eqTol` | scale units ≥ 0 | S-2 | PCT 0.1–0.5 · VOLU 0.05–0.25 |
| `trend.minSwings` | int ≥ 2 | S-3 | 4–5 (author leans 4: HL·HH·HL·HH) |
| `retr.basis` | CLOSE · HL | S-8 | both |
| `retr.method` | RD-F · RD-FIB · RD-V · RD-S | S-8 | all four (bake-off) |
| `retr.atrMult` | > 0 | S-8 | 1.5–4.0 |
| `retr.shallowMax` | 0–1 | S-8 | 0.33–0.45 |
| `retr.deepMin` | 0–1 | S-8 | 0.62–0.80 |
| `struct.pauseBars` | bars | S-10 | 15–40 |

## SOURCES

Rhea (the trend definitions and in-force-until-reversed — S-3, S-4) · Murphy (percentage retracements — RD-F lineage; trend basics) · Grimes (impulse-retracement structure — S-8/S-9's frame; failure tests feeding CH 9) · Kirkpatrick & Dahlquist ch. 12 (formal trend treatment) · Brooks (counter-move discipline; the case that most reversals are pullbacks that got lucky) · 97-CORE-MATH §I (swing toggles this chapter consumes; the OHLC-ified triangle fixture is the bake-off's first scoring input).

## OPEN-DEPOSITS (claims on later chapters)

**To CH 2 v3 (Events — backfill now UNBLOCKED):** the gap-taxonomy separators (E-10.x) can now read the S-4 structure verdict (continuation/exhaustion classes) and L's ACTIVE levels (breakaway class). Scheduled next sprint after this chapter survives review.
**To CH 5 (Diagonals):** anchor swings come from S-1's sequence; channel walks will read S-2 events against channel boundaries; no reverse dependency exists (verified this sprint).
**To CH 7 (Ranges):** PAUSE + EQ-dominated sequences are the range-birth doorway — CH 7 states the boundary-evidence rules; S-10's annotation is its input.
**To CH 8 (Breakouts):** BOS is one of the four reference types the assembled chain covers; S-9's failed structural attack joins the attempt taxonomy.
**To CH 9 (Aftermath):** the VOID branch of S-7/S-9 (failed attack on the floor) is the structural trap context for spring/upthrust cards; the dead-floor retest is the reversal-confirmation site.
**To CH 12 (Patterns):** `struct.eqTol` is the equality grammar for M/W and triple formations; the pattern-in-structure gate reads S-4 verdicts and S-5 states.
**To CH 13 (Regime):** the swing-sequence regime detector is exactly {S-4 verdict live → TRENDING; S-5 or NO-STRUCTURE → TRANSITIONAL; CH 7 range object live → RANGING}; PAUSED feeds SUSPEND.
**To CH 14 (MTF):** degree × frame conflicts operate on S-4 verdict objects; the conflict table must address a degree-2 daily trend disagreeing with a degree-1 weekly one.

## OPEN QUESTIONS — RESOLVED (PUBLISHER-REVIEW-R3)

1. ~~`trend.minSwings` 4 vs 5~~ **RESOLVED (R3-R-3): the loop decides — not ruled.** Options-not-opinions working as intended: both values in the grid, downstream-event fitness (the bake-off crown) picks. Author's lean to 4 recorded as the prior; the data settles it.
2. ~~EQ runs → CH 12 ownership~~ **RESOLVED (R3-R-4): CONFIRMED — boundary stays clean.** CH 12 owns the conversion; the routing line now sits in S-2's card so the next reader inherits it.

*Chapter 6 v2 · 11 cards · DRAFT · review_ref: PUBLISHER-REVIEW-R3. Compiled against: Chapters 1–4 (no CH 5 dependency — the reorder was free, as promised). Scoring target for the swing bake-off. — THE SCINTILLA RULEMAKER*

# CHAPTER 4 — HORIZONTAL LEVEL RULES (L)

**THE SCINTILLA TRADING RULEBOOK · Chapter draft · v2** (supersedes v1)
**STATUS: DRAFT** (12 cards + 1 SKELETON stub; promotion by publisher testing)
**v2 changelog (PUBLISHER-REVIEW-R3):** R3-R-1 — round-number levels ADMITTED as a stub: new card **L-13** (`level.roundSet`, the fourth birth source, evaluated at the current price scale; SKELETON — the loop tests whether the class earns its keep per instrument). R3-R-2 — period closes (PDC/PWC/PMC) confirmed second-wave, as shipped. Both open questions RESOLVED in place. No existing card's mechanics touched.

SUMMARY: Where levels come from, how wide they really are, how their quality is counted, what a test is, what a break does to them, and when they leave the book. The chapter cashes every deposit its shell accumulated: swing and gap-edge births (V-11, E-9), the tick floor (C3), crossing-without-test (C-8), attempt counters (C-11), and the state machine V-17 promised. One deliberate export: this chapter's behavior machinery binds to *any* reference object, which is what will make Diagonals cheap.

Compiles against: Chapters 1–3. Cited by: 5, 6, 7, 8, 9, 12, 14.

---

## BLOCK ONE — BIRTH

---

**L-1 — LEVEL BIRTH: SWING SOURCE**

- RULE: A confirmed swing (V-11, declared method/degree/tf) births a level at its anchor price: `level.anchor` ∈ {WICK (the swing extreme H/L), CLOSE (the swing bar's C)}. Birth is stamped at the swing's **confirmation bar**, not the swing bar — a level cannot exist before its swing does (no lookahead; the fractal's k-bar lag and SW-R's variable lag pass through). State at birth: ACTIVE; touch list: empty.
- CONFIRMATION: The swing's confirmation event (V-12/13/15).
- INVALIDATION: A candidate swing that never confirms births nothing; a level whose birth event cannot be produced on demand is not a level (V-17).
- WHY IT WORKS: A swing point is where one side ran out of conviction at a price — proven, executed inventory. The market remembers where people are wrong from.
- STATUS: DRAFT

---

**L-2 — LEVEL BIRTH: GAP-EDGE SOURCE**

- RULE: A gap that SURVIVES (E-9: fill clock expires untagged) births levels at its edges per `level.gapEdges` ∈ {BOTH (B_ref and O_t), NEAR (B_ref only), FAR (O_t only)}. Birth is stamped at the survival event (clock expiry), not the gap bar — a gap is only evidence once the market declines to fill it. State: ACTIVE; the gap bar itself enters no touch list.
- CONFIRMATION: The E-9 SURVIVES event.
- INVALIDATION: A FILLED gap births nothing; edges of filled gaps carry no standing.
- WHY IT WORKS: A surviving gap is a repricing the market accepted without revisiting — the untraded band behind it is where the skipped inventory still sits. E&M's gap doctrine, reduced to a clock and a tag.
- STATUS: DRAFT

---

**L-3 — LEVEL BIRTH: PRIOR-PERIOD SOURCE**

- RULE: On completion of each calendar period (V-6 aggregation law), the members of `level.periodSet` ⊆ {PDH, PDL, PDC, PWH, PWL, PWC, PMH, PML, PMC} birth as levels **immediately at the completing close** — auto-birth, empty touch list, tags accrue only after birth. **[R2 ruling adopted as the publisher leaned: auto-birth on period completion; contact history starts at zero.]** Each period level RETIRES automatically when its period rolls (the new PDH replaces the old; the old leaves the active book per L-10). Period levels carry source = PERIOD and their period id.
- CONFIRMATION: The period's last constituent bar closes (V-6).
- INVALIDATION: A "prior-period level" computed from a forming period (Wednesday's "weekly high") is void (V-6/V-8).
- WHY IT WORKS: These are the market's shared calendar coordinates — drawn on every terminal, referenced in every desk note. Contact behavior at them is partly self-fulfilling, which does not make it less mechanical.
- STATUS: DRAFT

---

**L-13 — LEVEL BIRTH: ROUND-NUMBER SOURCE [SKELETON — R3-R-1]**

- RULE (stub): The members of `level.roundSet` — round prices at multiples of 10^k chosen relative to the instrument's **current price scale** — birth as levels with source = ROUND, empty touch lists, tags accruing only after birth. Evaluation at the current scale makes SPLIT_ONLY's historical discontinuity a non-issue: round levels are a *today* coordinate, never an adjusted-history one. The full birth/retirement rule (which multiples exist at which price magnitudes; when the set refreshes as price migrates across a decade boundary) is deliberately stubbed — the loop tests whether the class earns its keep per instrument before the rule is drawn to depth. (Card id per T-6's append-only numbering; the card lives here with its birth siblings L-1..L-3.)
- CONFIRMATION: Stubbed with the birth rule.
- INVALIDATION: Stubbed. Until this card leaves SKELETON, a round number cited as a reference has no ledger and no standing (B-1's admissible-reference list is unchanged until promotion).
- WHY IT MATTERS: Genuinely mechanical, universally watched, free to compute — excluding the class would drop a level type half the market draws by reflex. Admit-as-stub, test late (R3-R-1) is options-not-opinions applied to a birth source.
- STATUS: SKELETON

---

## BLOCK TWO — WIDTH

---

**L-4 — ZONE WIDTH (METHOD OPTIONS)**

- RULE: Every level carries a zone (V-17) of width per `zone.method`:
  - **ZW-P (fixed percent):** width = `zone.pct` in PCT units of the level price.
  - **ZW-A (ATR fraction):** width = `zone.atrMult × ATR(atr.len)` at the evaluation bar.
  - **ZW-MAX (composite):** width = max(ZW-P, ZW-A) — the loop's §K form, admitted as its own option.
  - **ZW-W (wick-cluster):** width = span of the touch episodes' wick extremes about the level (requires ≥ `zone.minTouches` episodes; until then, fallback ZW-A). The only option whose width *learns* from contact history.
  All options floored: `width_eff = max(width, zone.tickFloor × tick)` (C3). Zones are symmetric about the level price in v1 (`zone.asym` reserved, untested).
- CONFIRMATION: Width computable at every t_close from the declared option.
- INVALIDATION: A width mixing options, or read below the tick floor, is malformed.
- WHY IT WORKS: A level is an area on the tape and a line in a book; the width options are the field's honest disagreement about how big the area is. Testing picks; the floor keeps degenerate instruments markable.
- STATUS: DRAFT

---

## BLOCK THREE — TESTS, QUALITY, AND THE THIRD-TEST PROBLEM

---

**L-5 — TEST EPISODES**

- RULE: A **test** of an ACTIVE level = a TAG of its zone (V-9) where the bar's close remains on the level's role side (no V-10 close-beyond fires). Consecutive tagging bars belong to **one episode**: a new episode requires ≥ `level.testGapMin` non-tagging bars since the last tagging bar. A **defended** episode is one whose final bar closes on the role side; an episode containing an E-4 reject at the zone is defended-with-rejection (a grade, per C-10 discipline). Touch lists record **episodes** — and only tags: crossings-without-test (C-8) append nothing.
- CONFIRMATION: Episode boundaries and defenses are all t_close facts.
- INVALIDATION: A touch list containing a gap-crossing, a forming bar, or two entries for one episode is corrupt; quality reads from it are void.
- WHY IT WORKS: "Tested three times" is meaningful only if two strangers count episodes, not bars — a week grinding on a level is one argument, not five. The episode gap is what separates arguments.
- STATUS: DRAFT

---

**L-6 — LEVEL QUALITY (METHOD OPTIONS)**

- RULE: Quality is computed from the episode record under `level.qMethod`:
  - **QL-TIER:** Q ∈ {A, B, C} by count thresholds over: episodes ≥ `q.minEpisodes`, mean defended-reaction size ≥ `q.minReact` (reaction = distance in scale units from zone edge to the extreme of the `q.reactWindow` closed bars after episode end), age ≥ `q.minAge`. Count of satisfied criteria → tier (the C-10/R-6 pattern).
  - **QL-SCORE:** the loop's §K weighted score (touches, mean reaction, recency decay, source weight), weights as registry params, v1 equal — admitted as the parametric option.
  Source weight note: swing-, gap-, and period-born levels may carry distinct base weights (`q.srcWeight.*`) — whether source predicts defense is exactly the kind of claim testing settles.
- CONFIRMATION: Recomputable from stamped episodes at any t_close; updates only as bars close.
- INVALIDATION: Quality read as permission — any card branching a verdict's *existence* on Q — fails at review (C-9/C-10 discipline: quality grades, never gates).
- WHY IT WORKS: Not all levels are equal, and the two honest ways to say so are a coarse tier two strangers can't disagree on, or a declared formula they compute identically. Both are stated; opinion is in neither.
- STATUS: DRAFT

---

**L-7 — THE THIRD-TEST PROBLEM (SINGLE HOME)**

- RULE: This card owns pre-break test-count odds; post-break third-test rejection is CH 9's (cross-reference, never restatement). The classical claim — each successive defended episode *consumes* the resting inventory that defends the level, so P(confirmed break | episode n+1) rises with n — is published here as a **measurable claim structure**, not a truth: the honesty table `level.testOdds[n]` (break probability by episode count, by source, on the calibration class) ships with this chapter and is filled by the loop. Mechanical consequence now: from episode `level.watchAt` onward, further tests carry a **WATCH annotation** — evidence for downstream graders (C-10), never a verdict, never a gate.
- CONFIRMATION: Episode counter (L-5) reaches `level.watchAt` → annotation on subsequent tests.
- INVALIDATION: Any card converting WATCH into a directional verdict without a C-2 confirmation fails at review.
- WHY IT WORKS: Both classical camps are right somewhere — "more tests = stronger level" and "more tests = weaker level" are each true for *some* n and some context, which is precisely why the book publishes the odds table instead of the slogan.
- STATUS: DRAFT

---

## BLOCK FOUR — BREAK, FLIP, RETIREMENT

---

**L-8 — BREAK: THE STATE TRANSITION**

- RULE: A C-2 CONFIRMED BREAK through a level's zone transitions it ACTIVE → **BROKEN**, stamped with the confirming close. The break *verdict* is C-2's; this card owns only the state. Role inverts by position immediately (V-20); flip *confirmation* waits for L-9. Attempt counters (C-11) continue across the transition unreset — reset rules are CH 8's (deposit honored). Claims voided or expired at the level (C-3/C-6) leave state untouched.
- CONFIRMATION: The C-2 event.
- INVALIDATION: A state change on an unconfirmed claim (one close, mid-window) is void — the state machine runs on confirmations only.
- WHY IT WORKS: The state machine is bookkeeping, and bookkeeping is exactly the part of level-reading that human memory does worst. The book keeps the ledger so the reader can keep their judgment for where it's needed.
- STATUS: DRAFT

---

**L-9 — ROLE FLIP: CONFIRMATION AND FAILURE**

- RULE: A BROKEN level transitions to **FLIPPED** when its first retest (V-24: first TAG of the zone within `retest.clock` bars of the confirmed break) **HOLDS** — a CLOSE BEYOND away from the zone, in the break's direction, within `retest.confirmClock`. If the retest **FAILS** (close back through the zone against the break), the level transitions BROKEN → **ACTIVE** (the old role resumes; the break verdict's voiding and the trap setups built on it are CH 9's). If no retest occurs within `retest.clock`, the level remains BROKEN unflipped; position alone assigns role (V-20) until either a later episode flips it (`level.lateFlip` = ALLOW one extended window `retest.clock2`, or FORBID — option) or it retires.
- CONFIRMATION: The V-24 HOLD event (flip) or FAIL event (reversion), both t_close facts.
- INVALIDATION: A flip assumed without its HOLD event is the field's most-quoted unproven sentence (V-20); it fails at review.
- WHY IT WORKS: The flip is trapped inventory changing sides — shorts from the old resistance now defending it as support only after they've been proven right once. Until the retest holds, the flip is a rumor with a diagram.
- STATUS: DRAFT

---

**L-10 — RETIREMENT**

- RULE: A level RETIRES (leaves the active book, id preserved) on the first of: (a) **staleness** — no test episode for `level.maxAge` bars; (b) **irrelevance** — every close for `level.farClock` consecutive bars is ≥ `level.farDist` (scale units) from the zone; (c) **period roll** — L-3 levels only, on their period's replacement; (d) **absorption** — the level joins a confluence cluster (L-11) and `level.clusterRetire` = MERGE (option; alternative KEEP retains members individually).
- CONFIRMATION: The triggering condition at t_close.
- INVALIDATION: A retired level cited as a live reference by any rule is a stale pointer; the citing analysis is void. (Retired ≠ deleted: the ledger keeps everything, per T-6's spirit.)
- WHY IT WORKS: An unretired book grows until every price is "at a level" and the word means nothing. Retirement is how the book forgets on schedule instead of never.
- STATUS: DRAFT

---

## BLOCK FIVE — COMPOSITION AND EXPORT

---

**L-11 — CONFLUENCE CLUSTERS**

- RULE: ACTIVE levels whose zones overlap (non-empty intersection of [lo, hi] bands, widths per L-4) form a **cluster**: one composite zone [min lo, max hi], recomputed deterministically at every birth, retirement, or width change. Cluster quality = the max member quality, annotated +CLUSTER(n members). A cluster is tested, defended, broken, and flipped as one object under L-5…L-9; member ledgers record their own histories throughout.
- CONFIRMATION: Overlap condition at recompute events.
- INVALIDATION: Overlapping zones treated as separate references inside one analysis (double-counting the same defense) voids the touch accounting.
- WHY IT WORKS: Two independent reasons for the same price is more resting inventory than either alone — and counting it twice is how analysts convince themselves a level is twice as real as it is.
- STATUS: DRAFT

---

**L-12 — THE REFERENCE-BINDING EXPORT**

- RULE: Cards L-5 through L-11 bind to **any reference object** of Chapter 1's taxonomy — horizontal level (V-17), diagonal's value-at-t (V-18), dynamic level (V-19) — by reference, not by type. Construction stays with the owning chapter (CH 5 diagonals, CH 11 dynamic); *behavior at the reference* is this chapter's machinery, applied unchanged.
- CONFIRMATION: A reference object exposing (price-at-t, zone, role side) runs the full block.
- INVALIDATION: A chapter re-stating test/break/flip machinery for its own reference type violates one-rule-one-home and fails at review.
- WHY IT WORKS: "A trendline is a level that moves" was the vocabulary's promise (V-18); this card is the payoff — Diagonals will cost one construction block, not a rewrite of everything above.
- STATUS: DRAFT

---

## PARAMETER REGISTRY ENTRIES (introduced by this chapter)

| Parameter | Domain | Card | Proposed test range |
|---|---|---|---|
| `level.anchor` | WICK · CLOSE | L-1 | both (bake-off with `diag.anchor`) |
| `level.gapEdges` | BOTH · NEAR · FAR | L-2 | BOTH first |
| `level.periodSet` | subset of {PD,PW,PM}×{H,L,C} | L-3 | {PDH,PDL,PWH,PWL} core; closes second wave (R3-R-2) |
| `level.roundSet` | round-price construction (stub) | L-13 | SKELETON — loop prices class-worth per instrument |
| `zone.method` | ZW-P · ZW-A · ZW-MAX · ZW-W | L-4 | all four |
| `zone.pct` | PCT > 0 | L-4 | 0.15–0.75 |
| `zone.atrMult` | > 0 | L-4 | 0.1–0.4 |
| `zone.minTouches` | int ≥ 2 | L-4 | 2–3 |
| `level.testGapMin` | bars ≥ 1 | L-5 | 1–3 |
| `level.qMethod` | QL-TIER · QL-SCORE | L-6 | both |
| `q.minEpisodes` / `q.minReact` / `q.reactWindow` / `q.minAge` | per L-6 | L-6 | 2–3 · PCT 0.5–1.5 / VOLU 0.5–1.0 · 3–5 · 10–30 |
| `q.srcWeight.*` | ≥ 0 | L-6 | v1 equal |
| `level.watchAt` | int ≥ 2 | L-7 | 3–4 |
| `level.testOdds[n]` | honesty table | L-7 | loop-filled |
| `level.lateFlip` | ALLOW · FORBID (+`retest.clock2`) | L-9 | both |
| `level.maxAge` / `level.farDist` / `level.farClock` | bars · scale units · bars | L-10 | 60–250 · PCT 8–20 / VOLU 4–8 · 20–60 |
| `level.clusterRetire` | MERGE · KEEP | L-10/11 | both |

## SOURCES

Edwards, Magee & Bassetti (role reversal doctrine; gap edges as support/resistance) · Murphy (role-flip and the test/defense grammar; prior-period reference points) · Kirkpatrick & Dahlquist ch. 13 (breakouts/retracements binding to levels) · Bulkowski (the empirical case that test-count odds must be measured, not asserted — L-7's honesty table) · Brooks (episode thinking: one argument, many bars) · 97-CORE-MATH §K (the loop's zone/touch/quality math, aligned: ZW-MAX and QL-SCORE are its forms admitted as options).

## OPEN-DEPOSITS (claims on later chapters)

**To CH 5 (Diagonals):** L-12 binding — CH 5 writes construction + validation + redraw only; all behavior cards bind via L-12. Diagonal zones size per L-4 options applied along the line.
**To CH 6 (Structure):** swing-born levels (L-1) are the structure floors/ceilings BOS reads — the same object, one ledger (consumed this sprint).
**To CH 8 (Breakouts):** attempt-counter *reset* rules (C-11 counters continue unreset through L-8 by design); L-7's odds table joins the entry-doctrine honesty tables.
**To CH 9 (Aftermath):** L-9's FAIL reversion is the state-side of the fakeout/trap setups; spring/upthrust cards read BROKEN→ACTIVE reversions at range boundaries.
**To CH 10 (Volume):** defended-episode volume signatures join L-6 quality as graders (backfill on landing).
**To CH 13 (Regime):** WATCH annotations and cluster density as regime evidence (ranging markets breed clusters).
**To CH 14 (MTF):** levels carry tf-of-record; higher-frame levels outrank on conflict — the conflict table consumes L objects as-is.
**To CH 15 (Universe):** `zone.tickFloor` build-out; period-set conventions for FX/crypto sessions.

## OPEN QUESTIONS — RESOLVED (PUBLISHER-REVIEW-R3)

1. ~~Round-number levels: admit or exclude?~~ **RESOLVED (R3-R-1): ADMIT as a stub, test late** — L-13 added (`level.roundSet`, fourth birth source, evaluated at current price scale so SPLIT_ONLY's discontinuity is moot). SKELETON until the loop prices whether the class earns its keep per instrument.
2. ~~Period closes in core or second wave?~~ **RESOLVED (R3-R-2): second-wave, as shipped** — highs/lows core now; closes join when the loop's fixtures ask for the full nine. A registry-set decision the sweep widens cheaply.

*Chapter 4 v2 · 13 cards (12 DRAFT + L-13 SKELETON) · review_ref: PUBLISHER-REVIEW-R3. Compiled against: Chapters 1–3. The behavior block (L-5…L-11) is exported to every reference type via L-12. — THE SCINTILLA RULEMAKER*

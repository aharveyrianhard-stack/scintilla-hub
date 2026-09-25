# CHAPTER 3 — CONFIRMATION & INVALIDATION STANDARDS (C)

**THE SCINTILLA TRADING RULEBOOK · Chapter draft · v3**
**STATUS: DRAFT** (all cards; promotion by publisher testing)
**v3 changelog (PUBLISHER-REVIEW-R5 + Sprint 6 backfill):** (1) R5-R-1 — the scheduled R-5 revisit is closed on the record: CH 9's A-2 (void-by-structure: the retest-FAIL chain) now exists and is ratified as the break verdict's void_event **alongside** the finite `cfm.verdictClock`, whichever fires first; C-2's verdict-birth text names both retirement paths. (2) T-12 backfill — CH 10 landed: C-10's grader list gains the volume graders **Q-FUND** and **Q-EVR** by citation (the standing deposit, cashed). No other card touched.
**v2 changelog (per PUBLISHER-REVIEW-R2):** both open questions resolved in place — R-5 (break verdicts hold the finite `cfm.verdictClock`; revisit exactly when CH 9 defines the alternative) and R-6 (grade tiers ratified for v1; weights only if testing proves tiers too coarse). No card mechanics touched.

SUMMARY: The iron rules cited by everything after them: how a claim becomes a confirmation, how it dies, on which timeframe, under which clock, and what is forever noise. Short by design. Compiled against Chapters 1–2 only.

---

**C-1 — THE CLAIM**

- RULE: A CLOSE BEYOND a reference's zone edge (V-10 against V-17/V-18/V-19 objects) on the timeframe of record opens a **claim** in that direction, stamped with its bar and reference, carrying clock `cfm.window`. A claim is a fact awaiting composition — it is not a verdict and changes no object's state.
- CONFIRMATION: The V-10 event at t_close.
- INVALIDATION: Per C-3 (the void) or C-6 (expiry) — a claim always ends in exactly one of {CONFIRMED, VOID, EXPIRED}.
- WHY IT WORKS: One close is one auction's opinion. The market's first move beyond a defended price is routinely a liquidity probe; the claim mechanism lets the book see it without believing it yet.
- STATUS: DRAFT

---

**C-2 — THE CONFIRMING CLOSE (DOCTRINE OPTIONS)**

- RULE: An open claim becomes a **CONFIRMED BREAK** under the declared doctrine (`cfm.mode`):
  - **TWO-CONSEC:** the very next bar of record also closes beyond the reference's zone edge (V-10, same direction).
  - **WINDOW:** any later bar within `cfm.window` closes beyond, with **no intervening close back inside** the zone.
  - **SINGLE-FILTERED:** the claim close itself confirms, provided its penetration ≥ `cfm.singlePen` (a larger `pen.min`-class filter — E&M's 3% doctrine as an option, restated in scale units per C1's forms).
  On confirmation, a verdict is born (V-21): subject = the reference, direction = the break's, born_event = the confirming close, void_event = **A-2's void-by-structure** (the retest-FAIL chain, CH 9), expiry_clock = `cfm.verdictClock` (finite — break verdicts are claims about follow-through, not structures; EVENT_ONLY is reserved for CH 6 per T-8). **Two retirement paths, first-to-fire wins (R5-R-1, closing the R-5 thread):** the structure can void the verdict early (A-2), but early death is not a reason to live forever — a break verdict is a dated promise, and if neither the retest resolves it nor the structure voids it, the clock retires it.
- CONFIRMATION: The chosen doctrine's condition.
- INVALIDATION: C-3 during the sequence voids it; C-6 expiry lapses it.
- WHY IT WORKS: "One close is a claim, the second is proof" is the two-close doctrine (Murphy's two-day rule generalized); SINGLE-FILTERED trades time-cost for distance-cost. Which cost is cheaper is an empirical question — three options, one bake-off, testing picks.
- STATUS: DRAFT

---

**C-3 — THE VOID (THE INVALIDATION MIRROR, INSTANTIATED)**

- RULE: An open claim is **VOID** the moment any bar closes back inside (or beyond the opposite zone edge of) the reference, before confirmation. The void is itself a stamped event — it is the trigger the fakeout term (V-24) names, and CH 9 builds its opposite-direction machinery on it. A voided claim's reference keeps its prior state untouched.
- CONFIRMATION: The close-back-inside event at t_close.
- INVALIDATION: n/a — the void is terminal for that claim (fresh claims per C-11).
- WHY IT WORKS: Whoever entered on the claim close is now holding a position the market closed against; the void event is the book's earliest mechanical sighting of trapped traders — which is why CH 9 treats it as a setup, not a failure.
- STATUS: DRAFT

---

**C-4 — THE MIRROR LAW**

- RULE: Every confirmation-type card in this book must state its INVALIDATION as the **symmetric voiding event with its own clock** — same reference, same zone, opposite direction, stated with the same precision as the confirmation. A card whose invalidation is vaguer than its confirmation does not publish.
- CONFIRMATION: Editorial at review: confirmation and invalidation resolve to the same object and unit system.
- INVALIDATION: Asymmetric precision fails the card (T-2's enforcement arm for event cards).
- WHY IT WORKS: The field's books are precise about entries and poetic about exits. Accounts die in the poetry.
- STATUS: DRAFT

---

**C-5 — THE TIMEFRAME OF RECORD**

- RULE: Every claim, confirmation, void, and verdict is evaluated on exactly **one declared timeframe** (`bar.tf`), stamped at birth. No rule re-evaluates a failed or voided claim on a second timeframe to resurrect it; no rule mixes closes from two timeframes inside one event sequence. Other timeframes' evidence enters only through CH 14's authority rules, later, on verdict objects — never inside this chapter's sequences.
- CONFIRMATION: Every stamped event carries its tf; sequences verify tf-homogeneity.
- INVALIDATION: A cross-tf sequence is malformed; every verdict it produced is void.
- WHY IT WORKS: Timeframe-shopping is the field's favorite self-deception — a failed daily break becomes a "strong weekly setup" by squinting. One frame per truth ends it.
- STATUS: DRAFT

---

**C-6 — THE CONFIRMATION CLOCK & EXPIRY**

- RULE: Every claim carries `cfm.window` (bars of the timeframe of record, per V-28). If the window passes with neither confirmation (C-2) nor void (C-3), the claim is **EXPIRED-UNCONFIRMED** — a stamped terminal event, distinct from void. Expired claims leave the reference's state untouched and are counted by downstream attempt-taxonomy machinery (CH 8's deposit).
- CONFIRMATION: Clock reaches its parameter with no terminal event.
- INVALIDATION: n/a — expiry is terminal.
- WHY IT WORKS: A claim that can neither prove nor die keeps a verdict-shaped hole open forever. Expiry closes it. The distinction from void matters downstream: a void traps entrants; an expiry merely bored them — different aftermath, so different event names.
- STATUS: DRAFT

---

**C-7 — WICK TREATMENT**

- RULE: Wicks never open, confirm, or void claims — only closes do (V-8, V-10). Wicks act in exactly two capacities: as **tags** (V-9, feeding touch lists and tests) and as **anatomy** (E-1/E-4, feeding evidence grades per C-10). An intrabar penetration that closes back inside is, for this chapter, a tag with anatomy — nothing more.
- CONFIRMATION: n/a (prohibition; enforced at review and by the formal form's EVAL_AT: t_close).
- INVALIDATION: Any card treating a wick as a claim-bearing event fails at review.
- WHY IT WORKS: The wick is the argument; the close is the settlement. Chapter 9 will show the wick-through-and-close-back-inside is among the *strongest* events in the book — as a rejection, in the opposite direction of the naive read.
- STATUS: DRAFT

---

**C-8 — GAP HANDLING IN CONFIRMATION SEQUENCES**

- RULE: A bar that **opens** beyond a reference (gap event, E-8) and **closes** beyond it produces one claim — the close is the event; the gap is anatomy and (once E's taxonomy backfills) evidence. A bar that opens beyond but closes back inside produces **no claim** (nothing closed beyond) — it registers a tag if the bar tagged the zone (V-9), else a **crossing-without-test**: the reference was passed without contact, and its touch list gains nothing. Gap-borne claims confirm and void under C-2/C-3 unchanged; on `bar.exDiv` bars, no claim may open (T-9 stand-down).
- CONFIRMATION: Standard V-10 evaluation at t_close; crossing-without-test stamped when neither tag nor close-beyond occurs on a gap bar... (exact: gap beyond reference, L_t > zone_top for an up-gap — the bar never came back to touch).
- INVALIDATION: Claims opened on exDiv bars are void ab initio.
- WHY IT WORKS: Gaps are how references get passed without being tested, and untested levels retain their standing — the market owes them a visit. Recording the crossing as *not-a-test* is what keeps touch counts honest.
- STATUS: DRAFT

---

**C-9 — WHAT NEVER CONFIRMS**

- RULE: The following confirm nothing, alone or in combination, and no card may cite them as confirmation: volume of any magnitude · speed or size of a move absent the close event · any indicator value or crossing · any Chapter E anatomy event (they grade, per C-10) · news, scheduled or breaking · open interest · any intrabar value (V-8) · any forming aggregate (V-6) · opinion, including this author's. Confirmation in this book is exactly one thing: the close-composition sequences of C-2.
- CONFIRMATION: n/a (prohibition).
- INVALIDATION: A card citing a forbidden confirmer fails at review; a verdict traced to one is void.
- WHY IT WORKS: Everything on this list correlates with real breaks — that is precisely why each is seductive and why none is proof. Witnesses testify; they do not sentence. The judge is the close.
- STATUS: DRAFT

---

**C-10 — THE EVIDENCE GRADE**

- RULE: A confirmed break may carry a **grade annotation** — a separate object, never a verdict field: grade ∈ {A, B, C} computed as the count-based tier of satisfied graders from the declared grader list `cfm.graders`. v1 graders (all computable today): penetration distance ≥ `cfm.gradePen` (in scale units) · claim or confirming bar is a trend bar (E-2) · compression event within `sqz.clock` before the claim (E-7) · reject (E-4) at the reference in the opposite direction within `cfm.gradeLookback` before the break (the failed defense). Volume graders JOINED (CH 10 landed — backfill cashed): **Q-FUND** (relVol funding of the claim/confirming bar) and **Q-EVR** (effort-vs-result class of the confirming bar), per Q-3. Grades order evidence; they never create, rescue, or veto a confirmation (C-9).
- CONFIRMATION: Grade computed at confirmation time from stamped events only.
- INVALIDATION: A grade read as permission — any card branching verdict existence on grade — fails at review. Grade may parameterize *exposure* (CH 16's legal knobs), never *truth*.
- WHY IT WORKS: Not all confirmed breaks are equal, and pretending otherwise wastes information; letting the inequality touch truth would waste the book. The grade is where the witnesses testify without becoming judges — and the invariance law (CH 16) will let profiles size by it.
- STATUS: DRAFT

---

**C-11 — RE-CLAIM DISCIPLINE**

- RULE: After a void or expiry, a fresh claim on the same reference requires a fresh V-10 event — no standing claim survives its terminal event, and no bar's close is counted toward two claims on the same reference in the same direction. Each terminal event increments the reference's **attempt counter** (per direction), a stamped quantity this chapter maintains and CH 8's attempt taxonomy consumes (deposit).
- CONFIRMATION: Counter increments on each VOID / EXPIRED; resets per CH 8's rules once that chapter states them (deposit — until then, counters only accumulate).
- INVALIDATION: n/a — bookkeeping law.
- WHY IT WORKS: "Third attempt at resistance" is meaningful exactly when attempts are counted identically by two strangers. This card is the counting; the meaning (attempts shift odds) is CH 4's and CH 8's to state and testing's to price.
- STATUS: DRAFT

---

## PARAMETER REGISTRY ENTRIES (introduced by this chapter)

| Parameter | Domain | Card | Proposed test range |
|---|---|---|---|
| `cfm.mode` | TWO-CONSEC · WINDOW · SINGLE-FILTERED | C-2 | all three (bake-off with swing options) |
| `cfm.window` | bars | C-1/C-2/C-6 | 2–5 (daily) |
| `cfm.singlePen` | scale units > 0 | C-2 | PCT 1.0–3.0 · VOLU 0.3–0.75 |
| `cfm.verdictClock` | bars | C-2 | 10–40 |
| `cfm.graders` | subset of grader list | C-10 | v1 set above + Q-FUND/Q-EVR (CH 10 cashed) |
| `cfm.gradePen` | scale units > 0 | C-10 | PCT 0.5–2.0 · VOLU 0.2–0.5 |
| `cfm.gradeLookback` | bars | C-10 | 5–15 |

## SOURCES

Murphy (two-day close rule → TWO-CONSEC; 1–3% filters → SINGLE-FILTERED, restated log-form per C1) · Edwards, Magee & Bassetti (3% penetration doctrine; gap treatment) · Rhea (close-as-settlement lineage) · Brooks (voided breaks as the market's best setups — C-3's downstream promise) · Aronson (the prohibition list's discipline) · Dormeier (why volume grades and never confirms — C-9/C-10's division, full treatment CH 10).

## OPEN-DEPOSITS (claims on later chapters)

**Deposited to CH 4 (Levels):** state transitions on confirmation (ACTIVE→BROKEN) and their retest chain; attempt-counter consumption at level quality ranking; crossing-without-test (C-8) as a non-event in touch lists. *(Consumed — L-5, L-8, L-9.)*
**Deposited to CH 6 (Structure):** break-of-structure claims run this chapter's machinery with the swing of record as reference; trend verdicts are the EVENT_ONLY citizens (T-8) — their void_event is the confirmed opposite structure break. *(Consumed — S-4, S-7.)*
**Deposited to CH 8 (Breakouts):** attempt taxonomy over C-11's counters (attempt vs break vocabulary); entry doctrines keyed to `cfm.mode` (on-confirm vs on-retest cost table; Bulkowski throwback ~60% base rate belongs in that chapter's honesty table); counter reset rules.
**Deposited to CH 9 (Aftermath):** the void event (C-3) as the fakeout trigger; retest hold/fail composed from C-1/C-2 machinery against the flipped reference; expired-unconfirmed as boundary-defense evidence for CH 7.
**Deposited to CH 10 (Volume):** volume graders for C-10 (relative-volume tiers at claim and confirming bars) — join the grader list by backfill. *(Consumed — Q-3; C-10 amended this sprint.)*
**Deposited to CH 16 (Risk):** grade-keyed exposure as a legal knob (grade may size, never gate).

## OPEN QUESTIONS — RESOLVED (PUBLISHER-REVIEW-R2)

1. ~~Finite verdict clock vs EVENT_ONLY~~ **RESOLVED (R-5): finite now**, and the scheduled revisit has since run: **CLOSED (R5-R-1)** — A-2 gave void-by-structure its real definition, the publisher ratified keeping the finite clock alongside it, first-to-fire. Folded into C-2's card text; the thread that opened at R2 is retired on the record.
2. ~~Tiers vs weights~~ **RESOLVED (R-6): tiers for v1.** A/B/C by count of satisfied graders — the two-strangers-clean choice; the loop may propose weights only against outcome evidence.

*Chapter 3 v3 · 11 cards · DRAFT · review_ref: PUBLISHER-REVIEW-R2 · PUBLISHER-REVIEW-R5 (R-1). Compiled against: Chapters 1–2. Cited by: everything after. — THE SCINTILLA RULEMAKER*

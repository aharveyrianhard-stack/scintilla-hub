# CHAPTER 5 — DIAGONAL & CHANNEL RULES (D)

**THE SCINTILLA TRADING RULEBOOK · Chapter draft · v2** (supersedes v1)
**STATUS: DRAFT** (all cards; promotion by publisher testing)
**v2 changelog (PUBLISHER-REVIEW-R4 · R5):** R4-R-1 — D-8's rank H > D > Y CONFIRMED as the v1 default (a stated default beats an unstated one; the loop may re-rank against outcomes). R4-R-2 — D-5 midlines stay EVIDENCE-ONLY for v1 (`chan.midClaims` admitted as an option only if the loop surfaces real midline signal in the bake-offs). R5-R-5 — `ref.rankOrder`'s weight jumped when B-9 made it the arbiter of the verdict-of-record, so it joins the loop's second-wave sweep (routed via ARCHITECT-REVIEW-A2); noted on D-8. Open questions RESOLVED in place. No card mechanics touched.

SUMMARY: Construction, validation, slope limits, channels, and the redraw law — and almost nothing else, because L-12 already exports every behavior card (tests, episodes, quality, break, flip, retirement, clusters) to any reference object. This chapter builds the moving reference; Chapter 4 already knows what to do at it. The cheapest chapter in the book, by design, and the proof the architecture is paying rent.

Compiles against: Chapters 1–4, 6 (anchor swings come from S-1's alternating sequence). Cited by: 8, 12, 13, 14.

---

## BLOCK ONE — CONSTRUCTION

---

**D-1 — DIAGONAL PROPOSAL**

- RULE: A **proposed diagonal** is the line through two anchors: confirmed swings of the same side, **consecutive in S-1's same-side subsequence** (no unused same-side swing between them; sub-option `diag.anchorSkip` = 1 permits skipping exactly one). Anchor prices per `diag.anchor` ∈ {WICK, CLOSE} (V-18). Role by side: a low-side line is support-role, a high-side line resistance-role; the classical constraint `diag.roleSlope` = WITH (default: low-side lines must rise, high-side lines must fall — counter-role slopes are channel partners, not standalone lines; option BOTH admits them for testing). **Line geometry obeys the Scale Law:** in PCT mode the line is straight in log-price — `ln(line(t)) = ln(P_a) + (slope/100) × (t − t_a)`; in VOLU mode it is straight in raw price with slope quoted in ATR-multiples per bar, **ATR frozen at the second anchor's bar** (a moving ATR would repaint the line — V-14). A proposal exists only when its second anchor confirms (no lookahead — the lag passes through, as with L-1).
- CONFIRMATION: The second anchor swing's confirmation event.
- INVALIDATION: Either anchor voided pre-confirmation (V-18); or slope outside D-3's limits at proposal — the line never acquires standing.
- WHY IT WORKS: Two forced pivots on a shared slope is a hypothesis that inventory is arriving on a schedule. It stays a hypothesis until the market countersigns it — which is D-2's whole job.
- STATUS: DRAFT

---

**D-2 — VALIDATION: THE THIRD TOUCH**

- RULE: A proposed diagonal is **VALIDATED** at the first **defended test episode** (L-5, via L-12) of its zone occurring after the second anchor's confirmation — the classical third touch, under episode counting, with defense required (a tag that closes through the line validates nothing; it opens a claim). Until validated, the line is a candidate: **no rule may cite a proposed diagonal as a reference** (the mirror of V-11's candidate discipline). The validating episode enters the line's touch ledger as episode #1 of its validated life; the anchor swings are construction, not touches.
- CONFIRMATION: The defended episode's final bar t_close.
- INVALIDATION: A C-2 confirmed break through the proposed line before any defended episode → the proposal dies unvalidated (stamped DEAD-PROPOSAL; its id retires; no verdict of any kind was ever attached).
- WHY IT WORKS: Two points buy a line; only the third point buys evidence — the market returning to the schedule and someone defending it there. Every technician says this; the episode machinery makes two strangers agree on which bar was the third touch.
- STATUS: DRAFT

---

**D-3 — SLOPE LIMITS**

- RULE: A proposal has standing only if `diag.slopeMin ≤ |slope| ≤ diag.slopeMax`, slope in the declared unit per bar (V-27; never degrees, T-10). Below the floor, the geometry is a level's job (route to CH 4 — a near-flat line through two swings is an EQ pair, which S-2 and L-1 already handle). Above the cap, the line is parabolic: it may be *watched* as an annotation (`STEEP` — evidence for CH 13's regime reading, deposit) but never cited as a reference. Slope is evaluated once, at proposal — anchors are immutable (D-6), so slope never changes.
- CONFIRMATION: The bounds check at proposal.
- INVALIDATION: n/a — a line outside bounds never existed as a reference; re-propose only with new anchors.
- WHY IT WORKS: Too flat and the diagonal adds nothing a level didn't already say; too steep and the schedule it hypothesizes is unpayable — steep lines break on time even when price holds, which makes their breaks noise. The classical warning, priced in unit-per-bar.
- STATUS: DRAFT

---

## BLOCK TWO — BEHAVIOR (THE INHERITANCE)

---

**D-4 — THE L-12 BINDING**

- RULE: A validated diagonal exposes the L-12 tuple — (price-at-t = line(t), zone = L-4 width options computed about line(t) with `zone.tickFloor`, role side per D-1) — and thereby runs **the entire Chapter 4 behavior block unchanged**: test episodes and defenses (L-5), quality (L-6), the watch machinery (L-7), break state (L-8), role flip and reversion (L-9), retirement (L-10), and cluster membership (L-11, including mixed clusters with horizontal levels where zones overlap at some t). Claims and confirmations against line(t) run the C-machinery with the line's value at each t_close as the reference price. Nothing about behavior is restated in this chapter, and any future divergence between diagonal and horizontal behavior must be argued as an amendment to Chapter 4, not written here.
- CONFIRMATION: The binding is total: one tuple, one machinery.
- INVALIDATION: A diagonal-specific behavior rule appearing in this chapter fails one-rule-one-home (L-12).
- WHY IT WORKS: "A trendline is a level that moves" was V-18's promise and L-12's payoff. This card is the receipt.
- STATUS: DRAFT

---

## BLOCK THREE — CHANNELS

---

**D-5 — CHANNEL CONSTRUCTION & VALIDATION**

- RULE: A **proposed channel** = a VALIDATED diagonal (the base line) plus a parallel through the anchor `chan.anchor` = the most extreme opposite-side confirmed swing within the base anchors' bar span (max perpendicular distance from the base, in the base's geometry space). The channel object carries base, parallel, and **midline** (the parallel bisector). The channel is **VALIDATED** when the parallel earns its own defended episode (D-2's standard applied to the second boundary). The midline is measurable but not citable: tags and closes against it are recorded as evidence for graders, and no claim may open against a midline in v1.
- CONFIRMATION: The parallel's defended episode.
- INVALIDATION: A C-2 confirmed break of the parallel before its validation → the channel proposal dies; the base line lives on independently (its ledger never depended on the parallel).
- WHY IT WORKS: A channel is the market honoring the same schedule from both sides — rent-payers above and below. Until the far side is defended once, the parallel is a drawing, not a fact.
- STATUS: DRAFT

---

**D-6 — THE REDRAW LAW (GEOMETRY IS IMMUTABLE)**

- RULE: A line's anchors are **immutable for life** — V-14 applied to geometry. "Redrawing" in this book means exactly one thing: **proposing a new line** (new id, new anchors per D-1) while the old line's ledger stands and its states resolve on their own record. Permitted occasions for a new proposal: a new confirmed swing extends the same-side subsequence. Forbidden, and lintable: editing anchors to keep a line unbroken, re-anchoring after a break to "correct" the line, or tuning a slope to capture a wick. Fan discipline: at most `diag.maxLive` live (validated, unretired) diagonals per side per (tf, degree); when exceeded, the lowest-quality line (L-6) retires with cause OUT_OF_SCOPE.
- CONFIRMATION: Every live line's anchors resolve to their original confirmed swings, byte-identical under data extension.
- INVALIDATION: One anchor edit voids the line's entire ledger — it was never a reference (the repaint prohibition's teeth, V-14).
- WHY IT WORKS: The redraw is the trendline's signature cheat: a line that moves whenever it fails is unfalsifiable, and unfalsifiable is worthless (T-2 — a rule that cannot be voided is a belief; a line that cannot break is not evidence). New information earns a new line; it never earns a revised past.
- STATUS: DRAFT

---

**D-7 — CHANNEL WALKS & EXITS**

- RULE: A **walk** = ≥ `chan.walkCount` consecutive defended episodes on one boundary with **no tag of the midline** between them — stamped WALK(boundary, n), an evidence annotation (grade-class, C-10 discipline; strong-trend witness deposited to CH 13). A **channel exit** = a C-2 confirmed break of either boundary (via D-4's binding); the exit event carries the channel context (which boundary, walk state at exit) as evidence for CH 8's chain and CH 12's flag machinery (deposits). After an exit, the broken boundary runs L-8/L-9 as usual; the surviving boundary lives on as a standalone diagonal.
- CONFIRMATION: Episode counting for walks; the C-2 event for exits.
- INVALIDATION: Walk annotations lapse on any midline tag; they are never verdicts.
- WHY IT WORKS: A walk is one side of the auction refusing even to revisit the middle — the strongest continuation evidence a channel can produce, and the reason channel exits *against* a walk (the trap side) belong to Chapter 9's best material.
- STATUS: DRAFT

---

**D-8 — REFERENCE RANK ON DISAGREEMENT**

- RULE: When references of different types give conflicting context at the same t and tf (price above a rising support line but below a BROKEN horizontal, and similar), no synthesis verdict exists — each reference's events stand on their own ledger (C-5 discipline). Where a downstream rule must pick one reference to gate on (CH 8's chain), the default rank is `ref.rankOrder` = HORIZONTAL > DIAGONAL > DYNAMIC — a registry parameter, not a law of nature: the loop may re-rank it against outcomes. **[R4-R-1]** Confirmed as the v1 default. **[R5-R-5]** B-9 made this parameter the arbiter of the verdict-of-record on multi-reference breaks, so it is **swept, not merely defaulted** — routed to the loop's second-wave grid (ARCHITECT-REVIEW-A2).
- CONFIRMATION: Deterministic rank lookup at the consuming rule.
- INVALIDATION: A card synthesizing one verdict from two disagreeing references fails at review.
- WHY IT WORKS: A horizontal level is memory of executed inventory at one price; a diagonal is a hypothesis about inventory on a schedule; a dynamic level is a summary statistic. Memory outranks hypothesis outranks summary — as a default worth testing, not a truth worth asserting.
- STATUS: DRAFT

---

**D-9 — THE INTERNAL-LINE EXCLUSION**

- RULE: Only swing-anchored lines exist in this book. Internal trendlines, hand-fit lines, best-fit regressions through interior prices, and wick-to-body hybrid anchoring are **excluded**: their anchor choice is unstated or continuous, so two strangers draw two lines (T-1 fails at construction). Re-admissible per T-11's standard only via a stated anchor algorithm.
- CONFIRMATION: Every live line's anchors are confirmed swings (D-1).
- INVALIDATION: A rule citing a non-swing-anchored line is malformed.
- WHY IT WORKS: The hand-fit line is the redraw cheat's twin — infinitely many lines fit "roughly," and the analyst always finds the one that agrees with him. The swing anchor is what makes a line an observation instead of a preference.
- STATUS: DRAFT

---

## PARAMETER REGISTRY ENTRIES (introduced by this chapter)

| Parameter | Domain | Card | Proposed test range |
|---|---|---|---|
| `diag.anchorSkip` | 0 · 1 | D-1 | both |
| `diag.roleSlope` | WITH · BOTH | D-1 | WITH first |
| `diag.slopeMin` | unit/bar > 0 | D-3 | PCT 0.02–0.10 · VOLU 0.01–0.05 |
| `diag.slopeMax` | unit/bar > slopeMin | D-3 | PCT 0.5–1.5 · VOLU 0.25–0.75 |
| `chan.anchor` | max-distance opposite swing (fixed rule) | D-5 | — |
| `chan.walkCount` | int ≥ 2 | D-7 | 2–4 |
| `diag.maxLive` | int ≥ 1 | D-6 | 2–3 per side |
| `ref.rankOrder` | permutation of {H, D, Y} | D-8 | H>D>Y default (R4-R-1) · second-wave sweep (R5-R-5) |

(`diag.anchor` already registered in Chapter 1 v2.)

## SOURCES

Edwards, Magee & Bassetti (trendline doctrine; the third-touch standard; fan lines as failure) · Murphy (trendline construction and significance tests; channel doctrine) · Brooks (channels, micro-channel walks — the walk card's ancestry; the case against hand-fit lines) · Kirkpatrick & Dahlquist (trendline evidence review) · 97-CORE-MATH §K (zone math along a moving reference).

## OPEN-DEPOSITS (claims on later chapters)

**To CH 8 (Breakouts):** channel exits and diagonal breaks join the assembled chain as reference types; WALK state at exit is claim-quality evidence (grade).
**To CH 9 (Aftermath):** exits against a walk (breaking the boundary the market was walking) as premium trap context; broken-diagonal retests run L-9 via D-4.
**To CH 12 (Patterns):** flags/pennants/wedges consume channel objects (a flag is a counter-trend channel — construction here, pattern semantics there); H&S necklines are D-1 objects with `diag.roleSlope` = BOTH permitted (pattern-local override, argued there).
**To CH 13 (Regime):** WALK and STEEP annotations as trending-regime witnesses.
**To CH 14 (MTF):** diagonals carry (tf, degree) like every reference; higher-frame lines outrank per the conflict table, within `ref.rankOrder`'s type-rank.

## OPEN QUESTIONS — RESOLVED (PUBLISHER-REVIEW-R4)

1. ~~D-8's default rank~~ **RESOLVED (R4-R-1): CONFIRMED as the v1 default.** Memory (horizontal, executed inventory) outranks hypothesis (diagonal, inventory-on-a-schedule) outranks summary (dynamic, a statistic) — a defensible prior the sweep can overturn. Also second-wave sweep material per R5-R-5.
2. ~~D-5's midline~~ **RESOLVED (R4-R-2): EVIDENCE-ONLY for v1.** Midlines stay grader input with no claims opening against them; `chan.midClaims` is admitted as an option only if the loop surfaces real midline signal in the bake-offs — not before.

*Chapter 5 v2 · 9 cards · DRAFT · review_ref: PUBLISHER-REVIEW-R4. Compiled against: Chapters 1–4, 6. Behavior inherited whole from L-12 — this chapter builds geometry and nothing else. — THE SCINTILLA RULEMAKER*

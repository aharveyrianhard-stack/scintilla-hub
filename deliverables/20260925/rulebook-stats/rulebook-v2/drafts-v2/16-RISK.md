# CHAPTER 16 — RISK PROFILE & APPLICATION RULES (K)

**THE SCINTILLA TRADING RULEBOOK · Chapter draft · v2** (supersedes v1)
**v2 changelog (per PUBLISHER-REVIEW-R8, folded 2026-09-25 — decision D1):** the three open questions are resolved in place below (K-R1, K-R2, K-R3), in the same form R2–R6 already use. No card text changed.  The footer's `review_ref` is corrected: the Sprint 8 go-ahead was R7, not R6 (R7 §5).
**STATUS: DRAFT** (all cards; promotion by publisher testing) · Sprint 8 ("Finish the Draft") — the closing chapter; with it, the full first draft stands: sixteen chapters, the Contract, and the math file, every deposit cashed or stated.

SUMMARY: The chapter where the reader finally enters — and the wall that keeps their appetite out of the truth. The invariance law as the chapter's constitution; the closed registry of legal knobs (the only surface a profile may touch); CONSERVATIVE, MODERATE, AGGRESSIVE as parameter sets and nothing else; the invalidation→stop bridge (truth never moves, the buffer does); sizing through the grade channel the book built nine chapters ago; regime, climate, and alignment keyed to exposure through the one legal door; the mechanical de-risking ladder; the position-versus-verdict proof the shell demanded; the application discipline that forbids forked rulebooks; and the last ledger — the one about the reader.

Compiles against: Chapters 1–15. Cited by: nothing — the book's application terminus.

---

## BLOCK ONE — THE CONSTITUTION

---

**K-1 — THE INVARIANCE LAW (APPETITE CHANGES EXPOSURE, NEVER TRUTH)**

- RULE: Definitions, confirmations, invalidations, verdicts, grades, states, regimes, and every ledger entry are **profile-invariant**: no card's RULE, CONFIRMATION, or INVALIDATION may branch on profile, and two profiles reading one tape hold **identical truth records** — same claims, same verdicts, same voids, same grades, same stamps. A profile exists in exactly one place: the values it assigns to the legal knobs (K-2). Enforcement is C-10's pattern at chapter scale: any card, table, or published analysis in which profile touches a truth field fails review; any tool that computes different events per profile is broken by definition.
- CONFIRMATION: Editorial + mechanical — the truth pipeline runs profile-blind; profiles enter only at the exposure layer.
- INVALIDATION: One profile-conditional truth anywhere voids the analysis and indicts the tool (T-1's two strangers were always two *appetites* too — they must mark the same bar).
- WHY IT MATTERS: The moment appetite can edit truth, every stop becomes negotiable and every invalidation becomes a mood. Two strangers with different account sizes must disagree only about *how much* — never about *what happened*. This is the book's last law and its first one wearing risk clothing.
- STATUS: DRAFT

---

**K-2 — THE LEGAL KNOBS (A CLOSED REGISTRY)**

- RULE: The **exhaustive** list of profile-touchable parameters — a knob is legal iff it parameterizes exposure or participation without touching a truth field: **entry doctrine** (`k.entryDoctrine`: ENTRY-C vs ENTRY-R vs context-keyed table — B-5's choice, finally assigned to its owner) · **participation tiers** (`k.gradeFloor`: the minimum C-10 grade a profile takes — declining a C-grade setup is the profile gating *its own* participation, exposure = 0; the setup's truth and everyone else's reading stand) · **setup-class participation** (`k.setupClasses`: which families a profile trades — chain entries, trap setups A-3/A-4/A-5, pattern classes per P; classes, never names-as-magic) · **stop construction** (K-4's options and buffers) · **risk fraction** (`k.riskPerTrade`) · **scale-out at PAID** (`k.scaleOutFrac` — A-9's knob) · **chase discipline at RUNAWAY** (`k.chaseMode` ∈ {NEVER, RETEST-ONLY} — B-7's knob; the measured cost of each response is the table's, the choice is the profile's) · **pyramiding** (`k.pyramid`: OFF or add-on-fresh-chain-only — a new add requires its own confirmed chain, never averaging into a thesis) · **exposure multipliers by context** (K-6) · **the de-risking ladder** (K-7) · **concurrency caps** (`k.maxPositions`, `k.maxPerClass`) · **position TTL** (`k.positionTTL`, K-8's proof governs). **The registry is closed:** a new knob enters only by amendment carrying the invariance argument (it must be shown to touch exposure only); anything not on the list is not a knob.
- CONFIRMATION: Every profile field resolves to a listed knob; the list is checked at review against every new card.
- INVALIDATION: An unlisted "knob," or a listed knob found reaching a truth field, fails the amendment or the card that smuggled it.
- WHY IT WORKS: An open-ended risk layer is where discretion re-enters wearing a spreadsheet — every unlisted parameter is a place appetite can quietly become opinion. A closed registry makes the exposure surface as auditable as the truth surface, which is the only way the invariance law is checkable rather than aspirational.
- STATUS: DRAFT

---

**K-3 — THE THREE PROFILES (PARAMETER SETS, NOT PERSONALITIES)**

- RULE: **CONSERVATIVE · MODERATE · AGGRESSIVE** are named rows over K-2's registry — v1 proposal, every value a testing target, none gospel: **CONSERVATIVE:** ENTRY-R only · `k.gradeFloor` = B · setup classes: chain entries + A-1 continuations only (no trap setups) · `k.riskPerTrade` 0.5% · scale-out 50% at PAID · chase NEVER · pyramid OFF · TTL tight. **MODERATE:** doctrine context-keyed (the `brk.entryOdds` table decides per reference type × grade once measured; ENTRY-R until then) · floor = C with grade-keyed sizing (K-5) · classes: + A-3/A-4 traps · risk 1.0% · scale-out 33% · chase RETEST-ONLY · pyramid add-on-fresh-chain. **AGGRESSIVE:** ENTRY-C permitted where the table prices it · all grades, sized by grade · all classes including gap traps · risk 1.5% · scale-out optional · chase RETEST-ONLY · pyramid on, capped. Profiles are registry rows — edited as sets, versioned like cards, **never forked into prose**; a fourth profile is a new row, not a new chapter.
- CONFIRMATION: A profile resolves to one value per knob; analyses declare their profile (K-8).
- INVALIDATION: A profile described in prose that cannot be read back as registry values is not a profile; per-trade knob overrides outside a declared profile change are discretion (K-8's law).
- WHY IT WORKS: The field sells risk appetite as identity; the book reduces it to arithmetic on a closed list — which is exactly what makes three appetites testable as three columns of the same ledger instead of three arguments.
- STATUS: DRAFT

---

## BLOCK TWO — THE EXPOSURE MACHINERY

---

**K-4 — THE INVALIDATION→STOP BRIDGE (TRUTH NEVER MOVES; THE BUFFER DOES)**

- RULE: Every position's stop derives from its setup's **card-stated INVALIDATION** — the voiding close the rulebook already defined — never from a comfort distance: **stop price = invalidation reference's far zone edge ± `risk.stopBufferAtr` × ATR** (the buffer is the profile's, in VOLU; the invalidation is the card's, immutable — assessment §7.8, cashed). Because invalidations are close-events (V-8), the stop order at that price is an *execution hedge against gap-through and intrabar disorder*, and the book states the mismatch honestly: a position may be stopped intrabar while the setup is technically alive until the close — that is an exposure cost the profile chose (tighter buffer = more noise stops; wider = more adverse excursion; the table `risk.stopOdds` prices the buffer sweep). **The SUBSETUP stamp:** a profile choosing a stop *tighter than the invalidation-implied distance* is risking on noise inside a live thesis — legal (exposure choice) but stamped SUBSETUP, tabled separately, and never publishable as the setup's own statistics. **Position size = `k.riskPerTrade` × equity / stop distance (VOLU)** — size derives from truth-anchored risk, never the reverse (no sizing backward into a wider "stop" to fit a desired size; that is the invalidation moving, K-1 breach).
- CONFIRMATION: Stop resolves mechanically from the setup's stamped invalidation + profile buffer at entry.
- INVALIDATION: A stop placed off any un-cited price, a buffer edited mid-position outside the ladder's mechanics, or a size computed before its stop, fails review.
- WHY IT WORKS: The stop is where truth and appetite meet, and the bridge keeps them in the right order: the card says where the thesis is dead; the profile says how much slack to pay around that fact. Every blown account has the arrow backwards.
- STATUS: DRAFT

---

**K-5 — SIZING THROUGH THE GRADE CHANNEL (C-10's PROMISE, SPENT)**

- RULE: The channel built at C-10 and reserved through nine chapters, finally spent: **size multipliers key to evidence, through grades and stamps only** — `k.sizeMult[grade]` (v1 proposal: A = 1.0, B = 0.75, C = 0.5, profile-scaled), with measured-lift stamps (Q-FUND/Q-EVR, PRESSURE, MULTI(k), HTF/MKT-ALIGNED, DRYING-UP context) adjusting *within* the profile's caps **only where their lift columns are loop-filled**. **The UNMEASURED teeth (B-11's law reaching money):** sizing up on an UNMEASURED lift is the definition of *recommending* an unmeasured claim — barred; an unmeasured stamp sizes at 1.0 (neutral) until its column exists. Sizing reads grades; it never creates, requests, or back-pressures them (a sizing layer that wants better grades is K-1's breach by plumbing).
- CONFIRMATION: Every size resolves to profile × grade × (measured stamps); the multiplication is auditable per position.
- INVALIDATION: A size keyed to a raw indicator value, an unmeasured stamp, a pattern name, or anything not a grade/stamp with a filled column, fails review.
- WHY IT WORKS: "Bet more when the evidence is better" is the one edge risk management can add — and it is only real if *better* means measured. The grade channel is where nine chapters of witnesses finally touch position size, with the UNMEASURED law standing between enthusiasm and the ledger.
- STATUS: DRAFT

---

**K-6 — PROFILE × REGIME (EXPOSURE THROUGH THE ONE LEGAL DOOR)**

- RULE: Context keys **exposure multipliers**, never activity and never truth — the division of labor stated at X-4, completed here: X-4's lookup owns *which* rules may fire; this card owns *how much* a profile commits when they do. `k.regimeMult[state]` (v1: TRENDING-aligned 1.0 · TREND-IN-RANGE 0.75 · RANGING 0.75 at boundaries · TRANSITIONAL 0.5 · dead zone/CHURN/REGIME-DISPUTE 0.25-or-0 per profile) · `k.climateMult` (DEAD-VOL and CLIMACTIC reduce per profile — I-10/X-5 spent as sizing input, the deposit's exact shape) · alignment stamps (HTF, MKT) adjust within caps per K-5's measured-only law. All multipliers are profile-row values over states the truth layer already stamped; none reach backward.
- CONFIRMATION: The multiplier chain resolves from stamped states at entry (and at add-on events only — no continuous resizing of open risk by drifting context; changes ride the ladder or the exit).
- INVALIDATION: A regime multiplier consumed as a gate (0 presented as "the rule didn't fire" rather than "the profile declined"), or any multiplier touching the lookup, is malformed — declining is exposure; the setup's record is untouched.
- WHY IT WORKS: The loop proved the edge is regime-conditional; X made the condition a state; this card is where a reader's account finally meets that fact — scaled participation in what the book can defend, near-zero in what it cannot, with the ledger recording that the difference was appetite, never truth. **[v2 note, D6 — 2026-09-25]** The evidence behind this sentence is the loop's synthetic-control run only (feed synthetic-v1, 7 DRAFT verdicts for the swing rule, last decided 24 Jul 2026; lockbox untouched). No real-data verdict exists. Read "measured" / "proved" as *on synthetic controls* until one does.
- STATUS: DRAFT

---

**K-7 — MECHANICAL DE-RISKING (THE DRAWDOWN LADDER)**

- RULE: Exposure keys to the account's own record, mechanically: from the equity high-water mark, at each `risk.stepDownR` of drawdown (denominated in R — the profile's per-trade risk unit — so the ladder is size-invariant), the profile's global exposure multiplier steps down one rung (`k.ladderMult`, v1: 1.0 → 0.75 → 0.5 → 0.25 → flat-except-exits); **restoration is hysteretic** — a rung recovers only after `risk.recoverR` of gain *from the rung's floor* (never immediately on the next win; the ratchet is the point), and rung changes apply from the next entry, never to open stops (K-4's truth-anchor stands). The ladder is profile-keyed in steepness, mandatory in existence: no profile ships without one, no discretion enters it, and no "conviction" overrides a rung (a rung override is K-1's breach in its most classical costume — revenge sizing with paperwork).
- CONFIRMATION: The ladder state is a mechanical function of the equity series; every entry's size cites its rung.
- INVALIDATION: An entry sized above its rung, a rung skipped on recovery, or a ladder edited mid-drawdown, fails review.
- WHY IT WORKS: A drawdown is the one signal that is unambiguously about *the system-and-operator, not the market* — the book's own regime detector for its reader. De-risking into it prices ruin out mechanically and buys the loop time to find what changed; the alternative has a century of memoirs.
- STATUS: DRAFT

---

## BLOCK THREE — APPLICATION AND THE LAST LEDGER

---

**K-8 — POSITIONS, VERDICTS & THE TTL PROOF; APPLICATION DISCIPLINE**

- RULE: A **position** is an exposure object bound at entry to its setup's verdict. **The TTL law, with the proof the shell demanded:** a position may expire before its verdict (`k.positionTTL`, a pure exposure clock — legal, the profile paying time-cost for capital recycling, indispensable under EVENT_ONLY verdicts that may live for months); **the reverse is impossible by construction:** when a verdict dies (void, A-2 reset, or clock expiry — C-2 v3's two paths), the setup's stated invalidation has fired, and K-4 anchors the position's exit to exactly that event — holding beyond it would be exposure with no live thesis, which no card supports and this card forbids; positions close on verdict death, mechanically, same close or next open per `k.exitMode`. ∎ **Application discipline (one book, no forks):** every published analysis declares its profile and cites the same cards with profile values attached; profile differences may appear **only in exposure fields** — two profiles publishing different verdicts from one tape is a review failure (K-1 operationalized); profile changes are scheduled, registry-stamped events (`k.profileChangeClock` minimum interval) — per-trade profile-hopping is discretion re-entering through the last unlocked door, and the ledger tags every position with the profile row that sized it.
- CONFIRMATION: TTL and exits resolve mechanically; profile declarations and change stamps are registry facts.
- INVALIDATION: A position alive after its verdict's death, an undeclared-profile analysis, or an unstamped profile change, fails review.
- WHY IT WORKS: The proof holds because the book built it backwards on purpose: exits were anchored to invalidations (K-4) before TTLs existed, so the position can only ever be the *shorter*-lived object. And the discipline clause is the two-strangers law completing its journey — same tape, same truth, appetite visible only in the size column.
- STATUS: DRAFT

---

**K-9 — THE RISK LEDGER (THE BOOK'S LAST TABLE IS ABOUT THE READER)**

- RULE: Under B-11's law, the chapter's own tables: `risk.profileOdds` — outcomes per profile row × setup class × grade × regime/class tags (the three profiles as three columns of one measured reality) · `risk.stopOdds` — the buffer sweep's noise-stop vs adverse-excursion frontier (K-4), with the SUBSETUP column segregated · `risk.entryDoctrineOdds` — `brk.entryOdds` consumed by its owner: the confirm-vs-retest cost, priced per context, closing the book's oldest deferred argument where it belonged (in the reader's column, not the prose) · ladder outcomes (K-7 — drawdown depth/duration with vs without rungs, the table that justifies the chapter) · TTL cost (K-8 — what the time-stop pays and forfeits under EVENT_ONLY verdicts). Every cell loop-filled with vintage; UNMEASURED cells read UNMEASURED; and an unmeasured knob value may be shipped as a default, stated — never marketed as an edge.
- CONFIRMATION: Every published risk claim resolves to a cell with vintage and tags.
- INVALIDATION: Per B-11 — a naked "conservative is safer" in book prose fails review like any other unpaid claim.
- WHY IT WORKS: The book spent fifteen chapters making the market confess in numbers; the last table points the same instrument at the reader's own choices. If the profiles are real, their columns will differ where appetite should matter and match where truth does — and that sentence is itself a testable claim, which is the only kind this book ships.
- STATUS: DRAFT

---

## PARAMETER REGISTRY ENTRIES (introduced by this chapter)

| Parameter | Domain | Card | Proposed test range |
|---|---|---|---|
| `k.entryDoctrine` | ENTRY-C · ENTRY-R · CONTEXT-TABLE | K-2/K-3 | per profile (B-5's knob, owned) |
| `k.gradeFloor` / `k.setupClasses` | grade tier · class set | K-2/K-3 | per profile |
| `k.riskPerTrade` | % equity | K-3 | 0.25–2.0 |
| `risk.stopBufferAtr` | ATR mult ≥ 0 | K-4 | 0.25–1.0 (profile-keyed) |
| `k.sizeMult[grade]` | ≥ 0 | K-5 | A 1.0 · B 0.5–0.75 · C 0.25–0.5 |
| `k.regimeMult[state]` / `k.climateMult` | ≥ 0 | K-6 | v1 proposal in-card; swept |
| `risk.stepDownR` / `risk.recoverR` / `k.ladderMult` | R units · R units · rung set | K-7 | 3–6R · 2–4R · 4 rungs |
| `k.positionTTL` / `k.exitMode` | bars · SAME-CLOSE · NEXT-OPEN | K-8 | profile-keyed · both |
| `k.scaleOutFrac` / `k.chaseMode` / `k.pyramid` / `k.maxPositions` / `k.maxPerClass` / `k.profileChangeClock` | per K-2 | K-2/K-3/K-8 | per profile |
| `risk.profileOdds` / `risk.stopOdds` / `risk.entryDoctrineOdds` | honesty tables | K-9 | loop-filled |

## SOURCES

Elder (the risk-percent lineage behind `k.riskPerTrade`; the discipline framing) · Tharp (position sizing as the variable that dominates outcomes — K-5's ancestry, held to the measured-only law) · Vince (the mathematical case that overbetting ruins faster than edge saves — the ladder's arithmetic conscience, fractional in practice) · Bulkowski (the throwback/failure base rates that make the entry-doctrine table decidable) · Aronson (the system-vs-market signal distinction behind K-7; the discipline that keeps K-9 honest) · Internal: C-10 (the channel), B-5/B-7 (the knobs' owners), A-9 (PAID), X-4/X-5 (the division of labor), U-1/U-8 (the universe the profiles trade), T-8 (the verdicts positions live under).

## OPEN-DEPOSITS (claims on later work)

**To the formalization pass:** profiles serialize as registry rows beside class profiles (U); the knob registry is CardSpec's exposure block; the invariance law is a lint (profile tokens may appear only in exposure fields — mechanically checkable).
**To the loop:** `risk.entryDoctrineOdds` is `brk.entryOdds` re-keyed — no new measurement, one new consumer; the ladder wants equity-curve simulation over the existing attempt ledger; profile sweeps are pure re-weighting of already-stamped events (cheap — no new detection).
**To the publisher's desk (the R1 reader-model ruling, landing site):** v1 ships **trader profiles only**. An INVESTOR variant changes the knob list (no entry-doctrine knob, longer TTLs, W-record stack per M) — it is a fourth registry row plus a stack declaration, *not* a fork, and the invariance law holds unchanged. The open ruling from R1 can now be made against a concrete mechanism: say the word and the row ships; the chapter needed no restructuring to admit it.

## OPEN QUESTIONS — RESOLVED (PUBLISHER-REVIEW-R8)

1. ~~The reader-model ruling (R1's open item, now concrete)~~ **RESOLVED (K-R1): TRADER-ONLY for v1** — the INVESTOR row (a fourth registry row, no entry-doctrine knob, longer TTLs, a W-record stack — not a fork) is pre-authorized to drop the moment its tables exist. This closes R1's reader-model question against a concrete mechanism.
2. ~~The MODERATE doctrine default (K-3)~~ **RESOLVED (K-R2): ENTRY-R fallback for all profiles until `risk.entryDoctrineOdds` fills** — a table that is UNMEASURED at birth cannot key anything (K-5's own law); the context-keyed table takes over per context only as the loop fills it.
3. ~~Ladder universality (K-7)~~ **RESOLVED (K-R3): MANDATORY-EXISTENCE IS LAW, not default** — every profile ships with a de-risking ladder; steepness varies, existence does not; an absent ladder is not a legal profile. K-7's mandatory-existence clause is elevated to a stated law of the chapter.

*Chapter 16 v2 · 9 cards · DRAFT · review_ref: PUBLISHER-REVIEW-R7 (Sprint 8 go-ahead) · PUBLISHER-REVIEW-R8. Compiled against: Chapters 1–15. The reader enters; the truth doesn't move. Sixteen chapters, one contract, one math file — the full first draft of THE SCINTILLA TRADING RULEBOOK stands complete, every deposit cashed or stated, awaiting the formalization pass. — THE SCINTILLA RULEMAKER*

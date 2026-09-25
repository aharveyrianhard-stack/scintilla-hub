# CHAPTER 13 — CONTEXT & REGIME RULES (X)

**THE SCINTILLA TRADING RULEBOOK · Chapter draft · v2** (supersedes v1)
**v2 changelog (per PUBLISHER-REVIEW-R7, folded 2026-09-25 — decision D1):** the three open questions are resolved in place below (X-R1, X-R2, X-R3), in the same form R2–R6 already use. No card text changed.
**STATUS: DRAFT** (all cards; promotion by publisher testing) · Drafted as a pair with Chapter 14 ("The Context Pair," Sprint 7) — written first: this is the keystone the loop is blocked on (A2's regime law bars pooled promotion; until this chapter exists there is no stated regime to condition on).

SUMMARY: The chapter that turns a signal into a decision. The regime taxonomy the book has been building across six chapters, now stamped as one total, single-valued state; the detector options with their disagreement ledger; the governing-rules lookup — which rule families may open, per regime, argued past A-6's standard on the record; the climate axis; the rules that invert by regime; regime change and the dead zone after it; the calendar home, where the earnings default is finally ruled; and the backfill that puts a regime column on every honesty table in the book. The empirical spine under all of it is the loop's own first result: the break chain has **no unconditional edge** — +0.36 ATR on trending synthetic data, negative on mean-reverting, nothing pooled. Context is not decoration. It is where the edge lives.

**For the loop engineer:** X-2's state stamp is the conditioning variable the promotion path needs (A2 §2.3 — no pooled promotion; provisional green only *within a stated regime*). Every state here is built from events you already compile: S-4 verdicts, R-objects, S-5 states, I-10/I-11 gauge states, Q-6 climaxes. Nothing in this chapter requires new detection machinery — it requires reading what the ladder already stamps.

Compiles against: Chapters 1–11 + 97 §§C, G, J. (CH 12 is deliberately not required: patterns arrive as B-1 chains and inherit regime treatment through the chain — this chapter never needs to know a pattern's name.) Cited by: 14, 15, 16.

---

## BLOCK ONE — THE DEFAULT AND THE FACT LAYER

---

**X-1 — THE UNCLEAR-REGIME DEFAULT (FEWER RULES, NOT MORE)**

- RULE: Whenever the regime state of record (X-2) is not decidable at a t_close — or the dead zone runs (X-7) — the governing set contracts to the **minimal core**: claims already in flight resolve under full C-machinery (claims always resolve — the iron clause inherited from A-6); all object bookkeeping continues (sequences accumulate per S-1/S-2, episodes stamp per L-5, states transition per L-8/L-10, verdicts live and die by their own law); and **no new setup-class rule may fire** — no fresh claims from B-chain entries-as-setups, no A-3/A-4/A-5 trap entries, no WATCH-derived positioning. The default is contraction, never expansion: an unclear tape is answered with fewer rules, not cleverer ones. (Promoted to a card from assessment §7.5; this is the ancestor A-6 cited, now the law of the whole lookup.)
- CONFIRMATION: The X-2 detector returns no decidable state, or X-7's clock runs, at t_close.
- INVALIDATION: A decidable X-2 state outside the dead zone — the full lookup (X-4) resumes. A rule found firing under the minimal core that is not on the core list fails at review.
- WHY IT WORKS: Incoherence in the state read is information about the fit between model and tape, not about direction. Every mechanical system's worst losses come from forcing its full rule set onto a tape that matches none of its templates — the cheapest vaccine is scheduled restraint, stated as the default rather than rediscovered as a regret.
- STATUS: DRAFT

---

**X-2 — THE REGIME TAXONOMY (PRICE-NATIVE, TOTAL, SINGLE-VALUED)**

- RULE: The **regime state of record** on a declared (tf, `swing.method`, `swing.degree`) is exactly one of four values at every t_close, computed from objects the book already stamps: **TRENDING(direction)** — a live S-4 verdict and no live range object · **RANGING** — a live R-object (R-1..R-6) and no live S-4 verdict · **TREND-IN-RANGE(direction)** — both live at once (legal by construction: an S-10 PAUSE can birth a range while the trend verdict stands EVENT_ONLY — this is the continuation-congestion state the field draws as a flag on the chart and this book reads as a pair of ledgers) · **TRANSITIONAL** — neither live (includes S-5 suspected states and post-death NO-STRUCTURE). The mapping is total and single-valued because each component is a decidable object: two strangers holding the same ledgers hold the same state. Overlapping ranges (R4-R-4) do not multiply states — any live R-object sets the range component. This price-native construction is detector option **RD-PRICE**, the primary (X-3).
- CONFIRMATION: Recomputable at every t_close from the S-4/R/S-5 ledgers; the state changes only when a constituent object is born or dies (each a stamped event).
- INVALIDATION: A state read from candidate swings, unconfirmed claims, or a dead range is void; a fifth state, or a rule reading "sort of trending," is malformed.
- WHY IT MATTERS: Every card downstream of this one branches on the state, so the state must be arithmetic on the ledger — not a judgment call wearing a taxonomy. The four values are few on purpose: a regime scheme with nine moods is a discretionary system with extra paperwork.
- STATUS: DRAFT

---

**X-3 — DETECTOR OPTIONS & THE DISAGREEMENT LEDGER**

- RULE: Two detector options for the trend/range axis, one seating law: **RD-PRICE** (X-2) — built entirely from the book's own confirmed events; **the primary by law**: the lookup (X-4) reads RD-PRICE's state and nothing else. **RD-ADX** (I-11, Wilder-exact, fixtured or inadmissible) — TREND-STRONG/TREND-WEAK bands as the independent cross-check; never operative, never an override (the witness doctrine applied to regime: gauges testify, the price-native ledger decides). When the two disagree at a t_close — ADX TREND-STRONG while RD-PRICE reads RANGING/TRANSITIONAL, or ADX TREND-WEAK inside a live TRENDING state — stamp **REGIME-DISPUTE(kind)**: an evidence annotation with its own honesty table `regime.disputeOdds` (what follows disputes, by kind: does the price-native read catch up, does the gauge lead, does the dispute itself mark chop — loop-filled; I-11's disagreement-column deposit, cashed). Disputes are grade/context evidence and CH 16 caution inputs; they change no state.
- CONFIRMATION: Both detectors computable at t_close; the dispute stamp when their reads cross.
- INVALIDATION: A lookup keyed to RD-ADX, or any gauge state overriding RD-PRICE, is malformed (the primary is law, not preference — the sweep may argue re-seating only with outcome evidence, per T-11).
- WHY IT WORKS: The book's own confirmed events are the only regime authority that cannot disagree with the book — a gauge-driven regime would let an indicator retire rules that price facts support. But a second thermometer that argues with the first is real information *about transition risk*, which is why the dispute is stamped and priced instead of suppressed.
- STATUS: DRAFT

---

## BLOCK TWO — THE LOOKUP

---

**X-4 — THE GOVERNING-RULES LOOKUP (ACTIVE / SUSPENDED — THE A-6 BURDEN, ARGUED)**

- RULE: Per regime state, the **lookup** declares each setup-opening rule family ACTIVE or SUSPENDED. Suspension gates **activity only**: no new claims or setup entries from a suspended family; everything in flight resolves; verdicts, grades, ledgers, and bookkeeping are untouchable. **The falsifiability clause (this card's own iron rule):** no suspension may ever gate the void path of a live verdict — the BOS chain against a live trend's floor, the boundary chain of a live range, and every A-1/A-2 resolution run in every state, always; a regime that could protect its own verdicts from disproof would be a religion with a lookup table. **The v1 lookup (defaults; the table itself is registry object `regime.lookup`, swept by the loop):**
  - **TRENDING(d):** ACTIVE — trend-direction B-chain on all five references, S-9 pullback machinery, A-1 retests, trend-direction A-3 (a void against direction d's counter-attack is a with-trend trap). SUSPENDED — counter-trend B-chain entries at references *other than* the structure floor/ceiling (the floor's chain is the void path — always live, per the clause).
  - **RANGING:** ACTIVE — the boundary families (R-4..R-8 evidence, boundary B-chain, A-4 springs/upthrusts, A-1); R-3 already forbids the middle. Trend families are dormant by absence, not suspension (no S-4 verdict exists — the lookup marks N/A, and honesty demands the distinction: absent is not gated).
  - **TREND-IN-RANGE(d):** ACTIVE — boundary machinery both sides (the range is the operative container) plus the trend-direction range-boundary break as the continuation trigger (it carries both stamps — the chain inherits TRENDING context and RANGE-BOUNDARY evidence). Counter-trend boundary setups (the trap against direction d) stay ACTIVE but carry the state stamp — the tables split them; v1 gates nothing it can measure instead.
  - **TRANSITIONAL / UNCLEAR / DEAD-ZONE:** X-1's minimal core.
  **The A-6 burden (R5-R-2's standard, argued on the record):** A-6 is the book's sole sanctioned activity gate, and any card wanting to suspend activity must argue against its standard and clear the same bar. This card does, clause by clause: it gates activity, never truth (identical scope discipline); it fires on mechanical evidence only — states built from confirmed objects, decidable at every close (A-6's incoherence evidence, generalized from one reference to the whole tape); claims in flight always resolve (the clause inherited verbatim); and it is bounded and stamped (states change only by ledger events, the dead zone by a clock). A-6 remains the only *reference-local* gate; this lookup is the only *regime-scope* gate; any third gate must now argue against both standards.
- CONFIRMATION: The lookup entry for (state, family) at each t_close; transitions apply from the bar after the state-changing event (V-28).
- INVALIDATION: A suspension touching a verdict, a grade, an in-flight claim, or any void path fails the card at review and voids nothing else — the invariance boundary (truth untouchable) is the whole legality of this chapter.
- WHY IT WORKS: The loop's first real finding was that the same chain is +0.36 ATR in one regime and negative in another — a rule set that fires identically everywhere converts that spread into noise. The lookup is where the book stops pretending its rules are context-free, without ever letting context touch what is *true*.
- STATUS: DRAFT

---

**X-5 — THE CLIMATE AXIS (VOLATILITY & VOLUME — CONTEXT, NEVER GATE)**

- RULE: Orthogonal to X-2's state, the **climate pair** at each t_close: **volatility climate** per I-10 (VOL-RATIO or VOL-PCTL states: HIGH-VOL / DEAD-VOL / NORMAL) and **volume climate** per Chapter 10: CLIMACTIC when ≥ `clim.clusterCount` CLIMAX events (Q-6) print within `clim.clusterWindow` bars, else the aggregate relVol state (Q-2 classes over `vol.baseLen`). Climate is **context and grade evidence only** in v1: it keys no lookup entry, suspends nothing, and enters every honesty table as the second regime column (X-9) plus CH 16's sizing knobs (volatility-scaled exposure — the legal channel). A climate-keyed lookup extension is second-wave and must argue the A-6/X-4 burden like any other gate — the requirement is stated now so the future argument arrives with its bar already set.
- CONFIRMATION: Both climate components computable at every t_close from stamped gauge states and climax events.
- INVALIDATION: A climate state in any CONFIRMATION clause (C-9), keying any v1 lookup entry, or gating any activity, is malformed.
- WHY IT WORKS: Volatility and attendance are the weather the state plays out in — the same TRENDING state means different follow-through in DEAD-VOL and CLIMACTIC climates, and the tables can prove exactly how much. Making climate a column instead of a gate keeps the chapter honest about what it has measured versus what it merely suspects.
- STATUS: DRAFT

---

**X-6 — THE INVERSION LIST (RULES THAT FLIP MEANING BY REGIME)**

- RULE: An append-only register of evidence whose **grade weight flips sign or zeroes by regime state** — inversions touch grades only, never verdicts, never confirmations (C-9/C-10 unchanged; an inversion is a re-weighting, not a new judge). The v1 list, each entry = (evidence, state, declared weight, honesty column): **(1) Divergence against a strong trend** — heads the list (the deposit standing since assessment §7.6, cashed): in TRENDING carrying WALK (D-7) or RUNAWAY (B-7) witnesses, DIV-HIGH/DIV-LOW annotations (I-9) carry weight per `regime.divWeight[state]` — v1 default **zero** in witnessed-strong trends (inverted is admissible in the sweep), full weight in RANGING at boundaries. **(2) Oscillator OB/OS conditions** — I-6's range-shift law made operative: an OS state inside TRENDING(up) is trending-normal, not cheapness evidence; OB/OS grade weights are per-state (`regime.oscWeight[state]`), v1 default zero with-trend, full at RANGING boundaries. **(3) Climax-as-exhaustion** — a CLIMAX(side) against a witnessed-strong trend grades as continuation-risk rather than reversal evidence until the table says otherwise (`vol.climaxOdds` splits by state — the column exists; the weight follows it). Entries change only by T-12 backfill with outcome evidence; removal follows T-11.
- CONFIRMATION: Each inversion applies at grade-computation time from the stamped state; the weights are registry values.
- INVALIDATION: An inversion cited to void, expire, or create a verdict fails at review; an unlisted flip applied in analysis is malformed (the list is the law — no ad-hoc inverting).
- WHY IT WORKS: The most expensive indicator errors are not wrong readings but right readings consumed in the wrong regime — divergence is genuinely predictive at range boundaries and genuinely ruinous against a walking trend, and the difference is the state, not the tool. The list makes regime-conditioning explicit, bounded, and priced instead of a folk warning.
- STATUS: DRAFT

---

## BLOCK THREE — TRANSITIONS AND THE CALENDAR

---

**X-7 — REGIME CHANGE & THE DEAD ZONE**

- RULE: A **regime transition** = any change of X-2's state, stamped at the t_close of the causing ledger event (BOS confirmed, S-3 completion, range birth, range death, dissolution). For `regime.deadClock` bars after every transition, the **dead zone** runs: the lookup serves X-1's minimal core regardless of the new state — with the falsifiability clause fully in force (void paths and in-flight resolutions never pause). The transition event carries its origin (which object died/was born) as context for the tables; consecutive transitions inside one dead zone restart the clock and stamp CHURN(n) — itself evidence the tape is unresolved (and a dispute-class input to CH 16 caution).
- CONFIRMATION: The state-change at t_close; the clock per V-28.
- INVALIDATION: A dead zone suppressing a void path or an in-flight claim is malformed; a new-state setup fired inside the dead zone is void ab initio.
- WHY IT WORKS: The bars immediately after a regime change are where the crowd is repositioning and the new state's statistics have not yet attached — the maximum-misread window. The book's answer is the same as X-1's: scheduled restraint, priced by a clock, instead of confidence exactly where confidence is least earned.
- STATUS: DRAFT

---

**X-8 — THE CALENDAR (STAND-DOWNS AS RULES; THE EARNINGS DEFAULT, RULED)**

- RULE: The formal home of every scheduled stand-down, each already flagged by the contract and now governed in one place: **(a) Ex-dividend** (`bar.exDiv`, V-5/T-9): no claim may open on the flagged bar (C-8's law, homed here) — the gap is administrative arithmetic, not information. **(b) Short sessions** (`bar.short`, V-7): volume-side stand-down (Q-9 operative); price rules run. **(c) Earnings** (`bar.earnings`, T-9 — semantics RULED here, landing Q-R2's deferral): the flag is a **calendar fact with information content**, treated asymmetrically — **volume side: `vol.earnStand` default STAND** (the bar is excluded from baselines and volume grades, the conservative posture every registered liar receives; DISCOUNT sweeps); **price side: rules run unmodified** — an earnings gap is information-dense repricing (the E-10 taxonomy classifies it like any gap) with `bar.earnings` attached as a table-splitting stamp, because an administrative gap and an informational gap must never share a row. No claim suppression on earnings bars (unlike ex-div): the repricing is real and the chain may read it. **(d) Declared calendar distortions** (`vol.calStand`: index-rebalance and derivative-expiry dates): volume-side stand-down on the declared dates only — the set names its dates in the registry or excludes nothing (no silent judgment, Q-9's law). Session-level stand-downs remain stubbed at the v1 daily floor (T-9; CH 15 builds them with intraday).
- CONFIRMATION: Every stand-down fires from a stamped contract flag or a declared registry date at t_close.
- INVALIDATION: An undeclared exclusion, a stand-down extended past its flag, or an earnings-bar volume grade under the STAND default, corrupts whatever consumed it.
- WHY IT WORKS: The calendar is the one part of the future the book is allowed to know. Scheduled distortions handled by schedule — and the earnings split (stand the volume down, read the price, split the tables) takes the one bar the field argues most about and gives each of its two faces exactly one treatment.
- STATUS: DRAFT

---

**X-9 — REGIME COLUMNS JOIN THE LEDGERS (THE BACKFILL, CASHED) & THE STATED-REGIME LAW**

- RULE: Every honesty table deposited for regime columns gains the **column pair (X-2 state · X-5 climate)** by this citation: the break ledger family (B-11: `brk.entryOdds`, `brk.objOdds`, `brk.gapEntryOdds`, and its joined tables), the aftermath ledger (A-10's five), the volume ledger (Q-10's), `level.testOdds` (L-7), `range.matOdds`/`range.failLoadOdds` (R-5/R-7), `ind.xcLift` and the audit standings (I-2/I-5), and this chapter's own (`regime.disputeOdds`, the inversion columns). Backfill executed this sprint in Chapters 8 v3, 9 v3, 10 v2 (B-11/A-10/Q-10 amended); the remaining owners inherit by this card's citation without version bumps (T-12 permits the join to be stated once at the joining chapter). **The stated-regime law (the loop's promotion precondition, book-side):** per the ratified regime law (ARCHITECT-REVIEW-A2 §2.3), no rule promotes to TESTED on a pooled cross-regime sample — every promotion conditions on a stated X-2 state, every published rate carries its state column, and a rate whose state column is empty reads UNMEASURED like any other naked number (B-11's law, regime edition).
- CONFIRMATION: Editorial + mechanical: every published rate resolves to a cell carrying the column pair; the loop's promotion path reads X-2 stamps.
- INVALIDATION: A pooled rate published without its state column, or a promotion argued from a pooled sample, fails review (and the loop's writer refuses it in code — the write-back law).
- WHY IT WORKS: The machine measured it before the book could assert it: pooled, the chain nets to nothing; conditioned, it has an edge and a sign. A regime column on every table is how that finding becomes permanent furniture instead of a remembered anecdote — and how every future rate the book publishes says *where* it is true. **[v2 note, D6 — 2026-09-25]** The evidence behind this sentence is the loop's synthetic-control run only (feed synthetic-v1, 7 DRAFT verdicts for the swing rule, last decided 24 Jul 2026; lockbox untouched). No real-data verdict exists. Read "measured" / "proved" as *on synthetic controls* until one does.
- STATUS: DRAFT

---

## PARAMETER REGISTRY ENTRIES (introduced by this chapter)

| Parameter | Domain | Card | Proposed test range |
|---|---|---|---|
| `regime.lookup` | (state × family) → ACTIVE/SUSPENDED table | X-4 | v1 defaults above; loop-swept (falsifiability clause not sweepable) |
| `regime.deadClock` | bars | X-7 | 3–10 |
| `regime.divWeight[state]` / `regime.oscWeight[state]` | grade weights ≥ 0 (inverted admissible in sweep) | X-6 | v1: 0 with-trend-witnessed · full at RANGING boundaries |
| `clim.clusterCount` | int ≥ 2 | X-5 | 2–4 |
| `clim.clusterWindow` | bars | X-5 | 10–30 |
| `vol.earnStand` | STAND · DISCOUNT | X-8 (rules Q-9's default) · cited; owner Q-9 [v2, D5] | STAND default; DISCOUNT sweeps |
| `vol.calStand` | declared-date set | X-8 · cited; owner Q-9 [v2, D5] | named dates or empty — no silent set |
| `regime.disputeOdds` | honesty table | X-3 | loop-filled |

## SOURCES

The loop's own Sprint-1 result and ARCHITECT-REVIEW-A2 (the no-unconditional-edge finding and the ratified regime law — this chapter's empirical spine; the machine discovered its keystone before the chapter was written) · Rhea (trend-in-force as the state ancestor) · Brooks (trending vs trading-range days as the informal taxonomy this chapter mechanizes; the always-in discipline) · Kaufman (adaptivity — regime-conditioned parameters as an idea lineage) · Aronson (regime conditioning as the honest form of context claims; the data-mining discipline behind the stated-regime law) · Wilder 1978 (ADX, the cross-check) · Internal: S-4/S-5/S-10 (CH 6), R-objects (CH 7), I-10/I-11 (CH 11), Q-2/Q-6 (CH 10), A-6 (CH 9) — the taxonomy was built across five chapters and cashed here.

## OPEN-DEPOSITS (claims on later chapters)

**To CH 14 (MTF, landing with this chapter):** the regime of record for activity gating is the record frame's X-2 state; higher-frame regime joins as context stamps (HTF-ALIGNED/OPPOSED) — M-4 states the law; any cross-frame regime *gate* is second-wave and owes the X-4 burden.
**To CH 15 (Universe):** session-level stand-downs and per-class calendar sets build with intraday; regime-state conventions for FX/crypto (no RTH close) are that chapter's to restate.
**To CH 16 (Risk):** regime and climate key exposure through the legal channel only (grade/regime size, never gate truth — the invariance boundary restated); REGIME-DISPUTE and CHURN as caution inputs; the dead zone as a sizing stand-down site.
**To the loop:** X-2 state stamps are the promotion path's conditioning variable (the stated-regime law); `regime.lookup` and the inversion weights are sweep objects; `regime.disputeOdds` wants the disagreement ledger from wave 2.

## OPEN QUESTIONS — RESOLVED (PUBLISHER-REVIEW-R7)

1. ~~TREND-IN-RANGE's counter-trend traps (X-4)~~ **RESOLVED (X-R1): MEASURE, don't gate** — springs/upthrusts against the trend stay ACTIVE in TREND-IN-RANGE with the state stamp; gate only if the state's trap odds come back inverted. The table decides, not a prior.
2. ~~The dead zone's scope (X-7)~~ **RESOLVED (X-R2): AFFIRM uniform for v1** — the minimal dead-zone core applies after every transition, range-birth included; the loop flags if range-birth dead zones cost more edge than they save. Measure the exception before carving it.
3. ~~`regime.lookup` as a swept object~~ **RESOLVED (X-R3): CONFIRMED, and tightened** — cells change only on outcome evidence that clears the loop's own gates, never a single green run — and the lookup's cells are *trials*: the loop counts them in the deflated-Sharpe trial total (G5) and runs the family SPA (G6) over the swept table.

*Chapter 13 v2 · 9 cards · DRAFT · review_ref: PUBLISHER-REVIEW-R6 (go-ahead) · PUBLISHER-REVIEW-R7. Compiled against: Chapters 1–11 + 97. The keystone set: states from the ledger, a lookup argued past A-6's bar, climate as a column, inversions as law, the calendar ruled, and a regime column on every number the book will ever publish. The loop's promotion path is unblocked. — THE SCINTILLA RULEMAKER*

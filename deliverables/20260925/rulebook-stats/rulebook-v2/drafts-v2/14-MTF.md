# CHAPTER 14 — MULTI-TIMEFRAME RULES (M)

**THE SCINTILLA TRADING RULEBOOK · Chapter draft · v2** (supersedes v1)
**v2 changelog (per PUBLISHER-REVIEW-R7, folded 2026-09-25 — decision D1):** the three open questions are resolved in place below (M-R1, M-R2, M-R3), in the same form R2–R6 already use. No card text changed.
**STATUS: DRAFT** (all cards; promotion by publisher testing) · Drafted as a pair with Chapter 13 ("The Context Pair," Sprint 7) — the other half: X says *when* rules govern; this chapter says *which frame's* facts they govern from.

SUMMARY: One timeframe of record per truth (C-5 already binds); this chapter is the law of everything around that: the declared stack and its roles, the aggregation dependency made operative, the conflict table where authority flows downward — including the deposited hard case of degree against frame — the regime-authority join with Chapter 13, nesting as early warning that may never become verdict, entry-frame discipline stated as forward law for the intraday build-out, the mixing table that makes the upward ban checkable, and the ledger where "trade with the higher timeframe" finally has to produce a number.

Compiles against: Chapters 1–13 (chiefly V-6/V-8/V-16, C-5, L-12, D-8, B-9, X-2/X-4). Cited by: 15, 16.

---

## BLOCK ONE — THE STACK AND ITS FACTS

---

**M-1 — THE DECLARED STACK**

- RULE: All multi-timeframe reading happens inside a **declared stack** `mtf.stack`: an ordered list of timeframes, each with exactly one role — **CONTEXT** (supplies standing verdicts, references, and regime stamps), **RECORD** (the frame of record where claims, confirmations, and verdicts live — `bar.tf`, C-5's citizen), or **ENTRY** (timing within a record-frame decision; M-6). v1 default for the calibration class: {W = CONTEXT, D = RECORD, ENTRY = RECORD} — the entry role collapses onto the record frame at the daily floor (T-9) and separates only when CH 15's intraday build-out opens sub-daily frames. **No undeclared frame may testify:** evidence from a frame outside the stack is inadmissible in any card or analysis (the V-19 declaration discipline applied to time — "the 4-hour looks strong" from a two-frame stack is prose, not analysis).
- CONFIRMATION: The stack is declared per analysis/profile in the registry; every cross-frame read names its frame and role.
- INVALIDATION: An undeclared frame's evidence anywhere voids the read that used it; a frame carrying two roles at once is malformed.
- WHY IT MATTERS: Frame-shopping is timeframe malpractice's retail form — with enough frames, some frame always agrees with you. A declared stack with fixed roles is how the book gets multi-frame context without a frame for every mood.
- STATUS: DRAFT

---

**M-2 — THE AGGREGATION DEPENDENCY (V-6, OPERATIVE)**

- RULE: A higher frame exists only as completed V-6 aggregates. Operatively: at any record-frame t_close, the CONTEXT frame's current bar is **forming** and does not exist — every context read (verdicts, references, regime states, gauge values) uses the last **completed** context bar and the objects confirmed as of it. There is no "weekly close so far," no mid-week weekly RSI, no forming-bar context of any kind (V-8 upward). **Holiday-week law (the shell's deposit, made law):** an aggregate built from a short constituent set (a 4-bar week, a holiday month) is a **full citizen** — no card may treat it as degraded evidence unless a stated rule says so and prices it; until such a rule exists with a table behind it, partial-set aggregates carry full standing and a `agg.short` stamp so the loop can test whether the distinction ever earns a rule.
- CONFIRMATION: Context reads resolve to a completed aggregate's t_close; the stamp attaches mechanically from the exchange calendar (V-7).
- INVALIDATION: Any read of a forming aggregate is void (V-6/V-8); silently down-weighting an `agg.short` bar without a stated rule fails at review.
- WHY IT MATTERS: Half of multi-timeframe malpractice is treating Wednesday's weekly bar as a fact five times a week — and the other half is quietly distrusting holiday weeks by feel. Both die here: context is completed bars, and suspicion about short weeks is a hypothesis for the loop, not a habit.
- STATUS: DRAFT

---

## BLOCK TWO — AUTHORITY

---

**M-3 — AUTHORITY FLOWS DOWNWARD (THE CONFLICT TABLE)**

- RULE: Conflicts are **operations on verdict objects and references** (V-21 — never on moods), and they resolve by one law: **the higher frame in the declared stack outranks.** The table:
  - **Reference vs reference:** where a record-frame gate must pick one reference among frames (B-9's verdict-of-record generalized), frame rank applies *before* type rank — a weekly level outranks a daily level; within one frame, `ref.rankOrder` (D-8) governs as before. Both objects keep their own ledgers regardless (outranked ≠ retired).
  - **Verdict vs verdict:** when a consuming rule gates on trend context and the stack holds live S-4 verdicts that disagree (daily BEARISH under weekly BULLISH), the **governing verdict** is the highest frame's. The lower frame's verdict remains fully in force *on its own frame* — authority selects which verdict a consumer reads; it never voids, expires, or edits the outranked one (C-5: no cross-frame resurrection, and equally no cross-frame execution).
  - **Degree vs frame (the deposited hard case, ruled):** a degree-2 daily trend against a degree-1 weekly trend resolves **FRAME-FIRST** — frame outranks degree, then degree ranks within a frame. The ground: frame authority is a property of the bar contract (a weekly close is settled auction truth at scale — more capital, more participants, one more level of V-8 finality), while degree is recursion over one frame's summaries — a summary of summaries inherits its frame's authority, it does not multiply it. `mtf.conflictRank` = FRAME-FIRST default; DEGREE-FIRST ships as the alternative option for the sweep (a stated default beats an unstated one — the D-8 pattern).
  - **Regime vs regime:** M-4's law.
- CONFIRMATION: Deterministic rank lookup (frame from the stack, then type per D-8, then degree) at the consuming rule's t_close.
- INVALIDATION: A card synthesizing one verdict from two frames' disagreeing verdicts (averaging, "mixed"), or voiding a lower-frame verdict by higher-frame authority, is malformed.
- WHY IT WORKS: Disagreement between frames is not noise — it is nested structure doing what nested structure does (every weekly pullback is a daily downtrend somewhere inside a weekly uptrend). The table lets both facts stand, names which one governs a given decision, and leaves the disagreement itself measurable (M-8) instead of argued.
- STATUS: DRAFT

---

**M-4 — REGIME AUTHORITY (THE X × M JOIN)**

- RULE: The **regime of record for activity gating is the RECORD frame's X-2 state** — X-4's lookup reads it and only it. The CONTEXT frame's regime state joins every decision as a **stamp, not a gate**: **HTF-ALIGNED** (context regime's direction component agrees with the record-frame event being graded) or **HTF-OPPOSED** — a grade/context column on the tables (M-8; the alignment lift finally measured), plus CH 16 caution input. A cross-frame regime *gate* (suspending record-frame families because the weekly is TRANSITIONAL, and similar) is **second-wave and owes the X-4/A-6 burden in full** — stated now so the future argument arrives with its bar set (X's deposit, cashed).
- CONFIRMATION: Both states computable at the record t_close (context state from the last completed context bar, M-2); the stamp attaches at grade time.
- INVALIDATION: A v1 lookup entry keyed to a context-frame state, or an HTF stamp consumed as confirmation (C-9), is malformed.
- WHY IT WORKS: Gating on the higher frame *feels* obviously right — which is exactly why the book measures it first: the alignment column will say what the with-the-weekly edge actually is, per reference type and state, before any gate is allowed to assume it.
- STATUS: DRAFT

---

## BLOCK THREE — NESTING, ENTRY, AND THE BANS

---

**M-5 — NESTING & EARLY WARNING (WARN, NEVER VERDICT)**

- RULE: Lower-frame structure builds higher-frame swings (V-16's recursion runs on bars that are themselves aggregates — a weekly swing's anatomy *is* daily bars). The operative law: a confirmed record-frame event bearing on a context-frame object — a daily BOS against the weekly floor's direction, a daily range birth straddling a weekly level, a daily S-3 completion opposing the weekly verdict — stamps **WARN(context-object, kind)** on the context object: an **early-warning annotation, evidence-grade only** (C-10 class). A WARN never creates, confirms, voids, or expires anything on the context frame — the weekly bar is not closed, so no weekly event exists (V-6/V-8); the warning is the book's honest name for "the inside of the higher-frame bar is turning." WARN lead-times and hit-rates are ledgered (`mtf.warnOdds`: how often, and how early, does a record-frame BOS against context precede the context frame's own BOS — loop-filled).
- CONFIRMATION: The record-frame event's own confirmation; the stamp attaches at that t_close.
- INVALIDATION: A WARN consumed as a context-frame event, claim, or verdict-toucher of any kind is void — the field's "the weekly just broke" on a Wednesday is exactly the malpractice this card exists to name.
- WHY IT WORKS: The higher frame always moves last but its interior moves first — nesting is real information with a real lag structure, and the only honest way to hold both is an annotation with a measured lead time instead of a premature verdict.
- STATUS: DRAFT

---

**M-6 — ENTRY-FRAME DISCIPLINE (FORWARD LAW FOR THE INTRADAY BUILD-OUT)**

- RULE: Where the stack declares a separate ENTRY frame (v1: it does not — the daily floor collapses ENTRY onto RECORD; this card is the standing law CH 15's intraday build-out inherits): the entry frame may decide **timing only, inside a live record-frame decision** — ENTRY-C/ENTRY-R events (B-5) evaluated on entry-frame bars against entry-frame-readable references, under the record frame's governing verdict and regime. The entry frame may **never**: open a record-frame claim, confirm or void one, extend or retire any record-frame verdict, resurrect a failed record-frame claim on its own bars (C-5), or trade against the record frame's governing verdict and call it timing. Entry-frame events are ledgered on the entry frame; their outcomes join the tables keyed to the record-frame context they executed within.
- CONFIRMATION: Per entry-frame t_close, inside a live record-frame verdict's window.
- INVALIDATION: Any entry-frame read that changes record-frame truth is malformed; an "entry" with no live record-frame decision above it is a record-frame claim wearing a smaller bar.
- WHY IT MATTERS: The entry frame is where discipline traditionally dies — a timing tool quietly becomes a second opinion, then a first one. Writing the wall before the intraday frames exist means the build-out arrives at a law, not a negotiation.
- STATUS: DRAFT

---

**M-7 — WHAT NEVER TRANSFERS UPSTAIRS (THE MIXING TABLE)**

- RULE: C-5's mixing ban, made a checkable flow table. **DOWNWARD (legal):** context-frame verdicts govern and grade record-frame activity (M-3/M-4); context-frame references are citable on the record frame — a weekly level is a price, and record-frame bars may tag it, test it, and open claims against its zone. One object, **per-frame ledgers:** when a context-frame reference is read on the record frame, record-frame events accrue to a ledger keyed (object-id, reading-frame) — the weekly level's *weekly* episodes and quality stay computed from weekly bars only; record-frame contact never contaminates context-frame quality (the one-price-one-record law, refined: one record *per frame of reading*). **UPWARD (illegal):** record-frame events create no context-frame events, episodes, claims, or state transitions; record-frame verdicts never join context-frame gates; a lower frame never revives what a higher frame retired or retires what it holds. **The only legal upward flows are constructions, not testimony:** V-6 aggregation (bars build bars) and V-16 recursion (swings build swings) — and WARN stamps (M-5), which are annotations on the context object, never events of it.
- CONFIRMATION: Every cross-frame read resolves to a legal row of this table; ledger keys carry reading-frame.
- INVALIDATION: A context-frame quality, maturity, or attempt count containing record-frame entries is corrupt; any upward flow outside the three named constructions fails at review.
- WHY IT WORKS: The upward ban is where two-strangers discipline meets its subtlest leak — daily touches quietly padding a weekly level's touch count is invisible in prose and obvious in a ledger key. The table makes the ban auditable instead of aspirational.
- STATUS: DRAFT

---

**M-8 — THE MTF LEDGER**

- RULE: This chapter's claims under B-11's publication law: `mtf.alignOdds` — record-frame chain outcomes split HTF-ALIGNED vs HTF-OPPOSED, per reference type × grade × X-2 state (the field's "trade with the higher timeframe" as a measured lift, finally) · `mtf.warnOdds` — WARN lead-times and hit-rates by kind (M-5) · `mtf.conflictOdds` — outcomes under FRAME-FIRST vs DEGREE-FIRST for the swept rank (M-3) · plus the regime column pair on all of them (X-9). Empty cells read UNMEASURED; an unmeasured alignment claim may be stated, never recommended — including the book's own FRAME-FIRST prior.
- CONFIRMATION: Every published MTF rate resolves to a cell with a vintage and its state column.
- INVALIDATION: Per B-11 — a naked "higher timeframe agrees" in analysis fails review.
- WHY IT WORKS: Top-down doctrine is the most repeated and least measured sentence in technical analysis. The ledger makes the book's own deference to the weekly a claim with a column — and if the column ever reads flat, the doctrine demotes like anything else.
- STATUS: DRAFT

---

## PARAMETER REGISTRY ENTRIES (introduced by this chapter)

| Parameter | Domain | Card | Proposed test range |
|---|---|---|---|
| `mtf.stack` | ordered (frame, role) list | M-1 | v1: {W CONTEXT, D RECORD, ENTRY=RECORD} |
| `agg.short` | stamp (calendar-derived) | M-2 | mechanical; tested for rule-worthiness |
| `mtf.conflictRank` | FRAME-FIRST · DEGREE-FIRST | M-3 | FRAME-FIRST default; both sweep |
| `mtf.regimeGate` | OFF · (second-wave gate, owes X-4 burden) | M-4 | OFF v1 |
| `mtf.alignOdds` / `mtf.warnOdds` / `mtf.conflictOdds` | honesty tables | M-8 | loop-filled |

## SOURCES

Elder (the triple-screen — the declared-stack-with-roles ancestor, mechanized and stripped of its indicator defaults) · Murphy (top-down doctrine — here made a measured claim) · Edwards, Magee & Bassetti (major/intermediate/minor trend nesting — M-5's classical lineage) · Kirkpatrick & Dahlquist (multi-frame evidence review) · Brooks (the smaller-timeframe-inside-the-bar reading behind WARN) · Internal: V-6/V-8 (aggregation truth), V-16 (degree recursion), C-5 (the one-frame law this chapter builds around), D-8/B-9 (rank machinery generalized), X-2/X-4 (the regime join).

## OPEN-DEPOSITS (claims on later chapters)

**To CH 15 (Universe):** the ENTRY role activates with intraday frames (M-6 is its standing law); session templates per class re-state M-2's completed-bar law for 24h markets (no RTH close — what "completed" means per class is CH 15's to declare); per-class default stacks.
**To CH 16 (Risk):** HTF-ALIGNED/OPPOSED and WARN as sizing/caution inputs through the legal channel (grade sizes, never gates); the conflict table's governing verdict is what profile-keyed exposure reads.
**To the loop:** `mtf.alignOdds` is the cheapest high-value table on the board (every chain event already carries tf and the context stamp once M-4 lands); `mtf.conflictRank` joins the sweep; WARN lead-time distributions want the real-bar spine.

## OPEN QUESTIONS — RESOLVED (PUBLISHER-REVIEW-R7)

1. ~~The v1 stack (M-1)~~ **RESOLVED (M-R1): HOLD at two frames** — {W CONTEXT, D RECORD}; every added frame doubles the conflict surface and there is no measured alignment lift yet. Monthly joins when the alignment tables justify a third.
2. ~~FRAME-FIRST (M-3)~~ **RESOLVED (M-R2): FRAME-FIRST CONFIRMED** — frame authority is bar-contract authority (a weekly close is settled truth at scale); degree is recursion over one frame. Ships as the stated default; the loop may flip it per class on evidence.
3. ~~WARN scope (M-5)~~ **RESOLVED (M-R3): AFFIRM confirmed-only for v1; claim-based pre-authorized for wave 2** — the lead-time table (`mtf.warnOdds`) shows whether an earlier, claim-based WARN is worth its false-positive rate; if it is, admit it then.

*Chapter 14 v2 · 8 cards · DRAFT · review_ref: PUBLISHER-REVIEW-R6 (go-ahead) · PUBLISHER-REVIEW-R7. Compiled against: Chapters 1–13. One frame per truth, authority downward, warnings never verdicts, constructions the only way upstairs — and the higher-timeframe doctrine sent to the same table as every other claim. The context pair is complete. — THE SCINTILLA RULEMAKER*

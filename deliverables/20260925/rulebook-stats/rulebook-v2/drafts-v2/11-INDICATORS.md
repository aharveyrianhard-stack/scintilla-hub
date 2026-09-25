# CHAPTER 11 — INDICATOR RULES (I)

**THE SCINTILLA TRADING RULEBOOK · Chapter draft · v2** (supersedes v1)
**STATUS: DRAFT** (all cards; promotion by publisher testing) · Drafted as a pair with Chapter 10 — written **first** by publisher order (R5: Regime consumes this chapter's gauges next sprint), landing together as "The Witnesses."
**v2 changelog (PUBLISHER-NOTE-R6.1 + PUBLISHER-REVIEW-R6):** R6.1 — all personal attribution stripped: the no-stacking law stands on statistical hygiene alone (correlated features are not independent evidence), and RSI × Williams %R are stated as **distinct instruments, both at full standing**, with the audit measuring their real overlap under its own neutral conservative default — no prior lean, no one's opinion of the pair (I-2, I-7, I-8, I-12 reworded; mechanics unchanged). I-R1 — `dyn.set` stays narrow ({SMA-50, SMA-200}), ratified. I-R2 — the dynamic-claim wall stays categorical for v1 with its reopening pre-authorized on evidence (noted at I-4). I-R3 — MACD's pre-authorized graveyard confirmed (noted at I-7). Open questions RESOLVED in place.

SUMMARY: Witnesses, never judges. The chapter states what an indicator is allowed to be in a book where the close is the only truth-bearer: a grader of confirmed events (C-10's channel), a gauge the regime chapter will read, or — in exactly one supervised case — a *reference price* (the dynamic level, V-19 cashed here). It gives the house set their primary-source formulas by citation to 97, defines which indicator events have standing, makes divergence mechanical by indexing it to confirmed swings, prices correlated witnesses with a law instead of a habit, and closes with the register this chapter is really for: the forbidden-uses list, per indicator, each entry citing the law it would break.

**For the loop engineer:** every formula this chapter cites already has its fixture in 97 (§§A, C–G, J) — TA-Lib cross-checks are the L1 oracle lane per your Sprint 2 plan. The RSI × %R independence audit (I-2/I-8) is testing job #2, standing since R1. Nothing in this chapter produces a verdict, so nothing here needs the ladder's verdict machinery — witnesses enter as grade columns and gauge states.

Compiles against: Chapters 1–10 (the CH 10 touchpoints are deliberate and few: one witness pool, one no-stacking law — volume-derived *series* are Chapter 10 citizens, not this chapter's) · 97 §§A, C, D, E, F, G, J. Cited by: 12, 13, 14, 16.

---

## BLOCK ONE — THE DOCTRINE

---

**I-1 — THE WITNESS DOCTRINE (WHAT AN INDICATOR MAY BE)**

- RULE: An **indicator** is any series computed from the series of record (V-1) by a declared formula with registry parameters. An indicator may serve in exactly three capacities, each supervised by existing law: **(1) GRADER** — its declared states join C-10 grader lists through explicit join tables (B-4's pattern); witness "confirmation" in this book means *corroboration* — a grade contribution to a break that already confirmed by close-composition, never a C-2 confirmation (C-9's wall stands whole). **(2) GAUGE** — its declared states are regime/context inputs consumed by CH 13's detector options (I-10/I-11); any activity consequence of a gauge is CH 13's to argue, and any such gate must argue against A-6's standard and clear the same bar (R5-R-2 — A-6 is the book's sole sanctioned activity gate). **(3) REFERENCE** — a declared member of `dyn.set` may serve as a dynamic level (V-19, constructed at I-4), whereupon everything *at* it is Chapter 4's law, not this chapter's. No fourth capacity exists. An indicator never creates, confirms, voids, rescues, or vetoes a price verdict, and never expires one (T-8 — no opinion retires a trend).
- CONFIRMATION: Each capacity's own law: C-10 computation for grades; CH 13's cards for gauges (forward-stub); V-19's declaration for references.
- INVALIDATION: A card citing an indicator in any CONFIRMATION or INVALIDATION clause of price machinery fails at review (C-9); an undeclared capacity is prose, not analysis.
- WHY IT MATTERS: The field's indicators died of promotion — tools built as *measurements* were resold as *signals*, and every backtest graveyard is full of the difference. Three capacities, each under existing law, is the whole chapter; the rest is formulas and the list of what they may not do.
- STATUS: DRAFT

---

**I-2 — THE NO-STACKING LAW (CORRELATED WITNESSES COUNT ONCE)**

- RULE: Grader lists and gauge sets count **independent** witnesses. Two witnesses are **one witness** when either: (a) they are arithmetic transforms of each other — an **identity pair**, declared by law, no measurement needed (the register opens with %R/Stoch-%K, I-8); or (b) the **independence audit** prices their overlap above the line: on the calibration class, compute rank correlation of the two series (`audit.rhoWindow` bars), event-agreement rate (P(both fire | either fires) across stamped witness events), and conditional lift (does B's state change measured follow-through given A's state — the conditional-information test). A pair with rank-corr ≥ `audit.rhoMax` **or** conditional lift ≤ `audit.liftMin` is stamped ONE-WITNESS: it may contribute at most one grade unit wherever both appear. Audit standings live in the registry (`audit.pairs` table); pairs awaiting audit are **UNAUDITED** and default to one joint grade unit until the audit runs — **the audit's own conservative default, a neutral statistical posture** (double-counting correlated evidence inflates false confidence; a temporary joint seat merely defers weight), favoring neither instrument and encoding no one's opinion of any pair. Seeded queue: {RSI × %R} first (testing job #2 — two distinct instruments; the audit measures their real overlap with no prior lean); {MACD × MA-slope} second (I-7 — construction overlap is arithmetic fact: MACD is built from the house EMAs; whether independent information survives it is the audit's number). The law binds **all witnesses in the book** — this chapter's and Chapter 10's volume graders (Q-3) alike; one pool, one standard.
- CONFIRMATION: Identity pairs by declaration; audited pairs by the audit's published run (vintage-stamped, B-11 discipline).
- INVALIDATION: A grade or gauge read counting a ONE-WITNESS pair (or an unaudited presumed-correlated pair) as two units is corrupt; analyses built on it are void.
- WHY IT WORKS: Five oscillators agreeing is one crowd measured five ways — the confluence self-delusion in indicator costume (B-9's warning, witness side). The law is standard statistical hygiene, true on its own arithmetic: counting correlated features as independent evidence inflates confidence without adding information. The audit operationalizes it — genuinely different witnesses earn their second seat by measurement; mirrors get one; nobody's opinion sits anywhere in the chain.
- STATUS: DRAFT

---

## BLOCK TWO — MOVING AVERAGES

---

**I-3 — MOVING AVERAGE CONSTRUCTION (THE HOUSE SET)**

- RULE: Three constructions, primary-source exact, formulas by citation to 97 §A: **SMA** (arithmetic mean of the last N closes) · **EMA** (α = 2/(N+1), seeded with SMA(N) at the first full window) · **RMA** (Wilder's, α = 1/N — the smoother *inside* RSI/ATR/ADX). Declaration is per rule: `ma.type` and `ma.period`, never "the moving average." **The mixing law:** RMA(N) ≈ EMA(2N−1); silently substituting one for the other is the field's #1 cross-implementation bug (97 §A), so any card reading an MA states its type, and any implementation is fixture-checked before use (96's L0). The **house set** `ma.houseSet` — v1 proposal {20, 50, 200} — is a registry parameter naming which periods this book's witnesses and dynamic levels may be built from; periods are parameters, not gospel, and the set exists to cap the search space, not to flatter round numbers.
- CONFIRMATION: Value computable at every t_close from bar `ma.period` onward (V-8 — the MA of a forming bar does not exist).
- INVALIDATION: An undeclared type or period, an MA read intrabar, or any **centered/two-sided** variant (it repaints by construction — V-14 bars it book-wide) is malformed.
- WHY IT MATTERS: An average is the cheapest memory the book owns, and the only honest one — it forgets on a stated schedule. Everything an MA will be allowed to do (I-4, I-5, I-10) sits on these three definitions being exactly one thing each.
- STATUS: DRAFT

---

**I-4 — THE DYNAMIC LEVEL, CONSTRUCTED (V-19 CASHED) — AND ITS LIMIT**

- RULE: A member of `dyn.set` (registry subset of the house set; v1 proposal {SMA-50, SMA-200} — parsimony first, the sweep may widen) serves as a **dynamic level**: its value at each t_close is a reference price (V-19), carrying a zone per L-4's width options (`zone.tickFloor` applies) and a role by position (V-20). Behavior at it binds through L-12 **to test-grade only**: tags, test episodes, defenses, quality, WATCH (L-5, L-6, L-7), retirement from `dyn.set` by registry change (not L-10's clocks — a dynamic level has no birth event to age from). **The claim limit (the B-1 reconciliation, stated as law):** a dynamic reference is **TEST-GRADE, not CLAIM-GRADE** in v1 — no C-1 claim opens against it, it joins no break chain, and B-1's five-type list is deliberately unamended. The reason is falsifiability, not taste: an MA is a rolling statistic *of the very closes being judged against it* — each approaching close drags the reference toward itself, so a "break" of it is partly self-authored, unlike a level, diagonal, or boundary whose price was fixed by past commitments and moves on no new information. A defended test at an MA is real evidence (someone paid there); a close through an MA is a witness event (I-5), not a claim. **[I-R2]** The wall is categorical for v1, and its reopening is **pre-authorized**: if the loop shows defended MA episodes predicting follow-through like level episodes *and* a handling for the self-authored-reference circularity, DYNAMIC-as-B-1's-sixth-type becomes arguable on schedule — the argument arrives expected, not as a reopening fight.
- CONFIRMATION: Declaration in `dyn.set` instantiates the reference; L-5's machinery confirms episodes at it.
- INVALIDATION: A claim, confirmation, verdict, or flip cited against a dynamic reference in v1 is malformed (B-1's list governs); an undeclared series used as a level is prose (V-19).
- WHY IT WORKS: The MA bounce is real exactly as often as the ledger says defended episodes at declared MAs predict follow-through — which the loop can now measure, because the episodes are stamped. And the claim limit keeps the book from the field's quiet circularity: trading breaks of a line that the trade itself helps draw.
- STATUS: DRAFT

---

**I-5 — CROSS EVENTS (WHICH HAVE STANDING)**

- RULE: Two cross species, one standing rule. **PRICE×MA:** the close of record crossing a `dyn.set` member — stamped MA-CROSS(series, direction) at t_close. It is a **witness event**: evidence for gauges (I-10's trend-side input; CH 13 consumption) and a grade input where a join table seats it — never a claim (I-4's limit). **MA×MA:** a shorter house MA crossing a longer (the 50/200 pair is the field's "golden/death cross") — stamped XC(fast, slow, direction) at the t_close where the completed bars' values first satisfy the inequality. It is a **gauge event only**: trend-climate evidence for CH 13, with its honesty column (`ind.xcLift` — measured lead/lag and hit rate on the calibration class; the classical literature's own tables show it late by construction, which is not a flaw — lateness bought smoothness; the column prices the trade). Neither species may appear in any CONFIRMATION clause (C-9), and neither resets any clock.
- CONFIRMATION: The inequality on completed-bar values at t_close (V-8; a forming-bar "cross" is rumor).
- INVALIDATION: A cross cited as an entry, exit, confirmation, or verdict fails at review; a cross computed from mixed MA types without declaration (I-3's mixing law) is malformed.
- WHY IT WORKS: A cross is two memories changing order — information about the *past distribution* of closes, delivered late by exactly the smoothing that made it legible. That is a fine witness and a terrible judge, and the book seats it accordingly.
- STATUS: DRAFT

---

## BLOCK THREE — OSCILLATORS

---

**I-6 — RSI (WILDER-EXACT; CONDITIONS, NOT SIGNALS)**

- RULE: RSI per 97 §D, Wilder's primary source exactly: U/D splits of close changes, **RMA smoothing** (the TA-Lib-matching form; an SMA-smoothed "RSI" is a different indicator and must say so), RS = RMA(U)/RMA(D), RSI = 100 − 100/(1+RS), RSI = 100 when RMA(D) = 0. Standing states, all **conditions** (grade/gauge inputs, per I-1): OB (RSI ≥ ob-line) · OS (RSI ≤ os-line) · MID. Threshold mode `rsi.thresholdMode` ∈ {FIXED (`rsi.ob`/`rsi.os`, Wilder's 70/30 as the classical default), PERCENTILE (97 §J — the instrument's own rolling `q`-quantiles; the CH 15 fix for "the index never reads 30")}. **The range-shift law:** in a live S-4 up-trend, RSI's realized range migrates up (the classical up-trend range ~40–80; mirror in down-trends) — so OS readings arrive late or never, and an OS *touch* inside a live opposing trend is not cheap-ness evidence; it is what trending looks like. Range-shift is why PERCENTILE mode exists and why every RSI condition is consumed **regime-tagged** (CH 13 forward-stub: the same reading testifies differently by regime).
- CONFIRMATION: State computable at every t_close from bar `rsi.period`+1 onward; threshold lines per the declared mode.
- INVALIDATION: An OB/OS state cited as a reversal signal, an entry, or a verdict-expiry event fails at review (C-9; T-8). An RSI built with the wrong smoother fails the fixture (96 L0) and everything read from it is void.
- WHY IT WORKS: RSI is a normalized momentum *thermometer* — it says how stretched the recent one-sided pressure is, on a 0–100 dial. Thermometers are useful to graders and fatal as triggers: stretched gets more stretched in exactly the markets where the reading looks most actionable. The condition/signal distinction is the whole card.
- STATUS: DRAFT

---

**I-7 — MACD (APPEL-EXACT; THE MOMENTUM WITNESS)**

- RULE: MACD per 97 §E: EMA(`macd.fast`) − EMA(`macd.slow`), Signal = EMA(MACD, `macd.signal`), Hist = MACD − Signal; 12/26/9 are named parameters carrying Appel's defaults, not gospel. Standing events, all witness-class: **ZERO-CROSS** (sign of MACD changes — the two underlying EMAs changed order; a trend-side witness equivalent in kind to an XC event, and jointly audited with it) · **SIGNAL-CROSS** (sign of Hist changes — momentum turning relative to its own smoothing) · **HIST-INFLECTION** (sign of ΔHist changes — candidate-grade only, the noisiest tell in the family; it may appear in no grader list, only as a gauge sub-input where CH 13 asks). MACD is unbounded, so it carries **no OB/OS states** — its testimony is direction and turn of momentum, never stretch. **Audit standing:** MACD is EMA arithmetic over the same closes as the house set — construction overlap is fact, not opinion; the pair {MACD × MA-slope} sits in the audit queue (I-2) under the conservative joint-unit default, and MACD earns independent seating only if the audit shows it adds conditional information beyond the slopes it is built from. **[I-R3]** The pre-authorized graveyard is CONFIRMED: no conditional lift → the witness seat retires SUPERSEDED with no further ceremony (formula kept in 97 for reference).
- CONFIRMATION: Each event on completed-bar values at t_close.
- INVALIDATION: Any MACD event in a CONFIRMATION clause (C-9); histogram events treated above candidate grade; an undeclared parameter triple.
- WHY IT WORKS: MACD is the distance between two memories, watched over time — a clean way to *see* the order-change coming before the XC prints. That earns it witness standing and nothing more; whether it earns even that seat independently is the audit's to price, which is how a book stays honest about its own furniture.
- STATUS: DRAFT

---

**I-8 — WILLIAMS %R (FULL STANDING) & THE STOCHASTIC IDENTITY**

- RULE: %R per 97 §F: %R = −100 × (HH(N) − C) / (HH(N) − LL(N)), range −100..0; Stochastic %K = 100 × (C − LL(N)) / (HH(N) − LL(N)). **The identity, by law:** %R = %K − 100 — the *same number shifted*; {%R, Stoch %K} is the register's founding **identity pair** (I-2a): one witness forever, no audit needed, and any card, grader list, or analysis seating both fails review on its face. %R holds **full witness standing as a distinct instrument** — it reads the close's position against the *extremes* of the lookback (wick information RSI never sees), where RSI reads the smoothed balance of close-to-close changes: different constructions measuring different things. Their real overlap is an **empirical** question, not an arithmetic one, and the audit measures it **with no prior lean** — first in the queue (testing job #2); until it runs, the pair seats under I-2's conservative joint-unit default, a neutral statistical posture, not a judgment that the two are redundant. Standing states: OB/OS/MID per `wr.ob`/`wr.os` with the same FIXED/PERCENTILE modes and the same regime-tagged consumption as I-6.
- CONFIRMATION: State computable at every t_close from bar `wr.period` onward.
- INVALIDATION: %R and %K seated as two witnesses (identity breach) — or %R and RSI seated as two before the audit clears them — voids the read (I-2).
- WHY IT WORKS: The close's position inside the recent high-low range and the smoothed balance of up-versus-down closes are different measurements of different things; whether and where they overlap is a number, not a debate. The audit measures it, and until then the book neither stacks the pair by habit nor collapses it by opinion — two distinct instruments, one neutral default, and a measurement on the calendar. That is the difference between respecting tools and guessing about them.
- STATUS: DRAFT

---

**I-9 — INDICATOR SWINGS, DIVERGENCE & FAILURE SWINGS (MECHANICAL, SWING-INDEXED)**

- RULE: **Divergence is swing-indexed or it is nothing.** Over the last two confirmed same-side price swings of the structure sequence (S-1; degree and method declared), sample the declared indicator's value **at each swing's bar**: **DIV-HIGH** (the high-side regular divergence) = the price pair is an HH event (S-2) while the indicator's sampled values print lower by ≥ `div.minDelta` (indicator units); **DIV-LOW** = mirror at lows (LL with higher indicator samples). (The classical names — "bearish/bullish divergence" — are banned spellings here: direction words belong to verdict fields alone (V-22), and a divergence is an annotation, never a verdict.) The divergence is stamped at the *later swing's confirmation bar* (it inherits the swing lag — no lookahead, V-14 clean) and is an **evidence annotation** (grade-class): never a verdict, never an expiry, and consumed regime-gated — **divergence against a strong trend heads CH 13's inversion list** (deposit standing since the assessment §7.6): in a live S-4 trend carrying WALK (D-7) or RUNAWAY (B-7) witnesses, regular divergence carries zero or inverted weight, per the table CH 13 will own. Hidden divergence is **second-wave** (`div.hidden`, registry stub — excluded v1). **Failure swings (Wilder's, the single-series case):** indicator swings are SW-F applied to the indicator series itself (`isw.n`, same confirmation lag law); an OB-excursion followed by a confirmed lower indicator swing-high below the OB line, then the indicator closing below the intervening indicator swing-low, stamps FAILURE-SWING(HIGH) — the mirror from OS stamps FAILURE-SWING(LOW). Grade-class evidence, same consumption discipline as divergence.
- CONFIRMATION: The later swing's confirmation event (divergence); the completing indicator-swing event (failure swings). All t_close facts.
- INVALIDATION: Divergence read from candidate swings, from eyeballed indicator peaks (unconfirmed indicator swings), from mixed degrees, or across an `isw.n`/`swing.n` mismatch without declaration, is void. Divergence cited as a standalone reversal signal fails at review (C-9; the inversion deposit exists because the naive read is *worst* precisely where it is most tempting).
- WHY IT WORKS: Divergence folklore fails on two hinges: nobody says which peaks count, and nobody says when it's allowed to testify. Indexing to confirmed swings fixes the first mechanically; regime-gating (CH 13's inversion table) fixes the second empirically. What survives is a real measurement — pressure waning at the margin — allowed to speak exactly where waning pressure historically mattered.
- STATUS: DRAFT

---

## BLOCK FOUR — GAUGES AND THE REGISTER

---

**I-10 — VOLATILITY GAUGES (FOR THE REGIME CHAPTER)**

- RULE: Two gauge options over V-25's unit, formulas per 97 §§C, J: **VOL-RATIO** — ATR(`vol.nFast`)/ATR(`vol.nSlow`), states HIGH-VOL (> `vol.hi`), DEAD-VOL (< `vol.lo`), NORMAL; **VOL-PCTL** — ATR's rolling percentile rank over `vol.window` bars, states by `q` cutoffs (the §J pattern — the instrument defines its own "high"). Gauge states are stamped at every t_close and consumed by CH 13's regime detector options and by CH 16's sizing knobs (volatility-scaled exposure is a legal knob under the invariance law — forward-stubs, both). Gauge states are conditions; they confirm nothing, gate nothing here (A-6/R5-R-2 discipline — any gauge-driven stand-down is CH 13's to argue).
- CONFIRMATION: Computable at every t_close once the longest window fills.
- INVALIDATION: A volatility state in a CONFIRMATION clause, or a gauge computed across an un-reseeded split boundary (V-25's ATR law), is void.
- WHY IT WORKS: Volatility regime is the weather the price rules trade in — the loop's own Sprint-1 result (edge on trending, negative on mean-reverting, none pooled) is the empirical case that the *same rule* means different things under different skies. The gauges are the barometer; CH 13 reads it; nothing here forecasts with it. **[v2 note, D6 — 2026-09-25]** The evidence behind this sentence is the loop's synthetic-control run only (feed synthetic-v1, 7 DRAFT verdicts for the swing rule, last decided 24 Jul 2026; lockbox untouched). No real-data verdict exists. Read "measured" / "proved" as *on synthetic controls* until one does.
- STATUS: DRAFT

---

**I-11 — TREND-STRENGTH GAUGE (ADX, THE CROSS-CHECK WITNESS)**

- RULE: ADX/DMI per 97 §G, Wilder-exact (±DM exclusivity, RMA throughout, DX → ADX) — with §G's warning made law: ADX has the most implementation variants in the wild, so **no ADX value is admissible from an unfixtured implementation** (96 L0 is mandatory before first use). Standing states: TREND-STRONG (ADX ≥ `adx.trendMin`; v1 toggle {20, 25, PERCENTILE}) · TREND-WEAK (below) · plus the direction pair (+DI vs −DI order) as a side witness. Seating: ADX is a **cross-check gauge** for CH 13 — the price-native detector (S-4 verdict live / R-object live / neither, completed at R4) is primary because it is built from the book's own confirmed events; ADX is the independent second opinion whose *disagreement* with the price-native read is itself information (the disagreement column ships in CH 13's tables — forward-stub). Never an entry timer, never a filter inside price machinery.
- CONFIRMATION: States at every t_close once seeded (§G).
- INVALIDATION: ADX in any CONFIRMATION clause; a TREND-STRONG state used to *extend* a verdict's life (T-8 breach); an unfixtured implementation's output anywhere.
- WHY IT WORKS: The book already knows whether a trend exists — S-4 is the fact. What ADX adds is a continuously-valued *how hard is it pressing*, measured a different way; where the two disagree, one of them is early, and the ledger can say which one tends to be. A second thermometer is only useful if you record when it argues with the first — so the book does.
- STATUS: DRAFT

---

**I-12 — THE FORBIDDEN-USES REGISTER (THE CHAPTER'S SPINE)**

- RULE: Per indicator, the uses barred from every card and every analysis published under this book's name, each with its citation: **MA:** cross as entry/exit signal (C-9; I-5) · centered/zero-lag repainting variants (V-14) · undeclared "the moving average" (I-3) · claims against MAs (I-4's limit; B-1). **RSI:** OB/OS as reversal signal (C-9) · OS-touch as cheap-ness inside an opposing live trend (I-6's range-shift law) · fixed thresholds asserted cross-class without the PERCENTILE alternative tested (T-11; §J). **MACD:** any event above witness class (C-9) · histogram inflection above candidate grade (I-7) · seating alongside MA-slope pre-audit (I-2). **%R/Stoch:** both seated anywhere (identity, I-8) · RSI and %R seated as two independent units before the audit prices the pair (I-2's conservative default). **Divergence:** unconfirmed-peak divergence (I-9) · standalone reversal use (C-9) · un-gated use against WALK/RUNAWAY trends (I-9's inversion deposit). **ADX/vol gauges:** any use inside price machinery's confirmation/invalidation (C-9) · verdict life-extension (T-8) · unfixtured ADX (I-11). **All:** intrabar values (V-8) · forming-aggregate values (V-6) · per-chart post-hoc threshold tuning (T-11; the registry is the only home parameters have) · counting correlated witnesses twice (I-2). This register is append-only; removing an entry requires the T-11 re-admission standard (stated rule + evidence).
- CONFIRMATION: Editorial at review — the register is checked against every new card and every published analysis.
- INVALIDATION: One register breach fails the card or the analysis; a breach traced into a verdict voids it.
- WHY IT MATTERS: Every indicator in this chapter is a good measurement that became a bad religion somewhere in the field's history. The register is the chapter's real product: the formulas say what the tools are; this list is what keeps them that.
- STATUS: DRAFT

---

## PARAMETER REGISTRY ENTRIES (introduced by this chapter)

| Parameter | Domain | Card | Proposed test range |
|---|---|---|---|
| `ma.houseSet` | period set | I-3 | {20, 50, 200} v1; sweep may widen |
| `ma.type` / `ma.period` | SMA · EMA · RMA / int ≥ 2 | I-3 | per rule (97 §A registered; formalized here) |
| `dyn.set` | subset of house set | I-4 | {SMA-50, SMA-200} — narrow ratified (I-R1) |
| `ind.xcLift` | honesty table | I-5 | loop-filled |
| `rsi.period` | int ≥ 2 | I-6 | 9–21 (14 classical) |
| `rsi.thresholdMode` | FIXED · PERCENTILE | I-6 | both (bake-off) |
| `rsi.ob` / `rsi.os` | 0–100 | I-6 | 65–80 / 20–35 |
| `macd.fast` / `macd.slow` / `macd.signal` | ints | I-7 | 12/26/9 ± neighborhoods |
| `wr.period` | int ≥ 2 | I-8 | 10–20 |
| `wr.ob` / `wr.os` | −100..0 | I-8 | −20/−80 classical; PERCENTILE toggle |
| `audit.rhoWindow` / `audit.rhoMax` / `audit.liftMin` | bars · 0–1 · lift units | I-2 | 252–504 · 0.8–0.9 · loop-proposed |
| `audit.pairs` | standings table | I-2 | seeded: {%R,%K} identity · {RSI,%R} queued · {MACD,MA-slope} queued |
| `div.minDelta` | indicator units > 0 | I-9 | per indicator (RSI 2–5) |
| `div.hidden` | EXCLUDED · option (stub) | I-9 | second wave |
| `isw.n` | int ≥ 1 | I-9 | 2–5 (mirror `swing.n`) |
| `vol.nFast` / `vol.nSlow` / `vol.hi` / `vol.lo` / `vol.window` | per 97 §C/§J | I-10 | 14 · 100 · 1.15–1.35 · 0.65–0.85 · 252 |
| `adx.period` / `adx.trendMin` | int · {20, 25, PERCENTILE} | I-11 | 14 · all three |

## SOURCES

Wilder 1978 (RSI, ADX/DMI, the RMA smoother, failure swings — primary source, formulas exact) · Appel (MACD — primary) · Williams (%R) · Lane (Stochastic %K/%D) · Brown (RSI range rules — the range-shift law's ancestry) · Murphy and Edwards, Magee & Bassetti (MA doctrine and crossover lineage; what the classical tables already admit about lateness) · Colby (the encyclopedia's crossover-system results — why XC ships with a lift column) · Lo, Mamaysky & Wang 2000 (formalizability of indicator-conditioned reads) · Aronson (data-mining discipline behind the audit and the register) · 97-CORE-MATH §§A, C–G, J (every formula's fixture home).

## OPEN-DEPOSITS (claims on later chapters)

**To CH 12 (Patterns):** divergence annotations at pattern boundary swings (M/W formations read I-9 stamps as grade input; no pattern may cite an indicator in confirmation).
**To CH 13 (Regime):** the detector consumes I-10 states and I-11's cross-check (disagreement column); the **inversion list opens with divergence-against-strong-trend** (I-9); regime-tagged consumption of every oscillator condition (I-6/I-8); any gauge-driven activity gate must argue against A-6's standard (R5-R-2) — CH 13's burden, stated in advance.
**To CH 14 (MTF):** witness events carry tf-of-record like all events; no indicator may be read cross-frame outside M's authority rules.
**To CH 15 (Universe):** PERCENTILE threshold modes (§J) are the class-calibration mechanism; `dyn.set` conventions per class.
**To CH 16 (Risk):** witness grades size through C-10's channel (grade sizes, never gates); volatility-scaled exposure reads I-10.
**To the loop:** the RSI × %R audit design is ready to run when fixtures exist (I-2's three measurements); `ind.xcLift` and the audit standings are the chapter's first honesty tables.

## OPEN QUESTIONS — RESOLVED (PUBLISHER-REVIEW-R6)

1. ~~`dyn.set` scope~~ **RESOLVED (I-R1): NARROW now** — {SMA-50, SMA-200}; parsimony first, and the loop's defended-episode evidence argues any widening.
2. ~~The dynamic-claim limit~~ **RESOLVED (I-R2): the wall stays CATEGORICAL for v1, reopening pre-authorized.** B-1's five-type list stays closed; if the loop shows level-like prediction at MA episodes *and* a handling for the self-authored-reference circularity, the sixth-type argument arrives on schedule, expected.
3. ~~MACD's seat~~ **RESOLVED (I-R3): pre-authorized graveyard CONFIRMED** (the R5-R-4 pattern applied to a witness) — no conditional lift beyond the house slopes → SUPERSEDED, formula retained in 97.

*Chapter 11 v3 · 12 cards · DRAFT · review_ref: PUBLISHER-REVIEW-R5 · PUBLISHER-REVIEW-R6 · PUBLISHER-NOTE-R6.1. Compiled against: Chapters 1–10 + 97. Witnesses seated, pairs priced by measurement or held at the neutral default, the register armed — and no fingerprints on any of it. CH 13 consumes I-10/I-11 this sprint. — THE SCINTILLA RULEMAKER*

# CHAPTER 10 — VOLUME RULES (Q)

**THE SCINTILLA TRADING RULEBOOK · Chapter draft · v2** (supersedes v1)
**STATUS: DRAFT** (all cards; promotion by publisher testing) · Drafted as a pair with Chapter 11 ("The Witnesses," Sprint 6) — written second by publisher order, landing together.
**v2 changelog (PUBLISHER-REVIEW-R6 + Sprint 7 backfill):** Q-R1 — MEDIAN ratified as the baseline default (SMA stays in the grid). Q-R2 — the earnings-semantics deferral CONFIRMED and now LANDED: the default is ruled at X-8 with the calendar home (noted at Q-9). Q-R3 — the OBV/A-D exclusion CONFIRMED for v1; the audit-queue path is pre-authorized, not run. T-12 backfill — CH 13 landed: Q-10's regime columns JOINED per X-9. Open questions RESOLVED in place. No card mechanics touched.

SUMMARY: The evidence doctrine made operational. Volume is the auction's *attendance record* — it grades what the close decided and never overrides it (C-9 already binds this book-wide; this chapter is where the binding earns its cards). Relative volume as the only admissible form, the grade tiers C-10 has been waiting for since Chapter 3, effort-versus-result and its two suspects, the diminishing-supply signature at tested references, the climax event, the joins that cash every standing deposit into the break chain and the aftermath — and the register of where volume lies, each liar with its contract citation.

**Backfills executed by this chapter's landing (T-12, all in this sprint's delivery):** C-10's grader list gains the volume graders (Chapter 3 v3) · B-4's join table gains its volume row and B-10/B-11 their volume columns (Chapter 8 v2) · A-4/A-5 climax upgrades join and A-10 gains its volume columns (Chapter 9 v2). The E-side deposits (relVol grades for E-4 rejects, E-6 engulfs, and the E-10.x gap taxonomy's confidence reads) are cashed **by citation** from Q-3/Q-6 — the E cards' stubs already name volume as a grade input; the grader now exists.

Compiles against: Chapters 1–9 + 97 §H. Forward-stubs only into 11, 13, 15 (no forward citations — T-5). Cited by: 11 (one pool, one no-stacking law), 12, 13, 15, 16.

---

## BLOCK ONE — DOCTRINE AND THE UNIT

---

**Q-1 — THE EVIDENCE DOCTRINE (VOLUME GRADES; THE CLOSE DECIDES)**

- RULE: Volume (V of the bar of record, V-1, from the declared feed — T-9) may serve in exactly one capacity: **evidence** — grade inputs to C-10's channel and gauge inputs to CH 13's climate reads (forward-stub). Volume never opens, confirms, voids, rescues, or vetoes a claim or verdict (C-9's wall, restated at its home); a confirmed break on thin volume is **confirmed** — it merely grades low and its odds column says what that has historically meant (Q-7). **Admissibility of volume-derived series:** v1 admits **none** as witnesses. OBV and A/D-type cumulative lines are path-dependent sums whose level has no unit and whose increments (sign-of-close × volume) are already legible as relVol + direction — a second spelling, not a second witness; VWAP is sub-daily construction, outside the v1 bar floor (its site is CH 15's intraday build-out). Named and excluded with the door stated: re-admission per T-11's standard (stated rule + evidence), and any re-admitted series would testify under the witness machinery of the next chapter, one pool, one no-stacking law (forward-stub). **[Q-R3]** The exclusion is CONFIRMED for v1; if the loop later wants to test whether OBV-divergence adds conditional information beyond relVol + the price swings, it enters the independence-audit queue *then* — a pre-authorized path, not a scheduled run.
- CONFIRMATION: n/a (doctrine; enforced at review and by the joins' construction — volume appears only in grade/gauge positions).
- INVALIDATION: Volume cited in any CONFIRMATION or INVALIDATION clause of price machinery fails the card at review; a verdict traced to a volume "confirmation" is void (C-9).
- WHY IT MATTERS: Volume is how many showed up; price is what they agreed to. Attendance explains the vote's *weight* — it never recounts it. Every classical volume error is one of promotion: a good grader asked to judge.
- STATUS: DRAFT

---

**Q-2 — RELATIVE VOLUME (THE ONLY VOLUME THAT MEANS ANYTHING)**

- RULE: The admissible form is **relative volume**: `relVol[t] = V[t] / baseline[t]`, baseline per `vol.baseMethod` ∈ {SMA(V, `vol.baseLen`), MEDIAN(V, `vol.baseLen`)} — median is the robust option (a single earnings print poisons a mean baseline for `vol.baseLen` bars; it barely moves a median). **[Q-R1]** MEDIAN is the ratified default; SMA sweeps in the grid. Classes: **HIGH** (relVol ≥ `vol.hiMult`) · **LOW** (relVol ≤ `vol.loMult`) · **NORMAL**. **The volume scale law (T-10's analog):** raw share/contract counts are forbidden in any rule — they are class artifacts, incomparable across instruments and across a split boundary. Baselines **re-seed at a split** under SPLIT_ONLY (the mirror of V-25's ATR re-seed; the feed's split-rescaled volume per the declared convention, T-9), and exclude bars the stand-down register removes (Q-9) so the liars cannot poison the ruler that measures them. Session-aware time-of-day baselines are an intraday necessity and a v1 stub (`vol.todSessions`, CH 15 site — volume's U-shaped intraday curve makes plain relVol lie at the open; the v1 bar floor is daily, so the lie is out of scope, not out of mind).
- CONFIRMATION: relVol computable at every t_close once the baseline window fills with admissible bars.
- INVALIDATION: A raw-volume condition, a baseline spanning a split un-reseeded, or a baseline fed by stand-down bars, is malformed; grades read from it are void.
- WHY IT WORKS: "Big volume" is meaningless until the instrument's own recent attendance defines big — the same reasoning that made ATR the price yardstick (V-3) makes the baseline the volume yardstick. One relative form, two robust baselines, three classes: everything downstream reads these and nothing else.
- STATUS: DRAFT

---

**Q-3 — VOLUME GRADE TIERS (THE C-10 BACKFILL, CASHED)**

- RULE: The graders Chapter 3 deposited for are now defined, and **C-10's grader list is amended by citation** (backfill executed, Chapter 3 v3): **Q-FUND (funding)** — the claim bar *or* the confirming bar prints relVol HIGH: the break's effort was funded by real attendance. One grader, not two — the claim and confirming bars are adjacent draws from the same episode and do not stack (the no-stacking discipline the next chapter writes into law binds here by construction). **Q-EVR (efficiency)** — the effort-versus-result class of the confirming bar (Q-4): a funded *and efficient* confirming bar grades up; an ABSORPTION-class confirming bar grades down (effort refused is a warning inside a break, not a strength). Tier attachment beyond the chain: the volume class of the bar carrying any stamped E event attaches as grade evidence wherever a join table seats it — E-4 rejects, E-6 engulfs, and the E-10.x gap taxonomy's confidence reads (the E deposits, cashed by this citation). Grades order evidence; they never gate (C-10's invalidation clause governs here unchanged).
- CONFIRMATION: Grader values computed at the events' own t_closes from stamped relVol classes only.
- INVALIDATION: A volume grader read as permission — any card branching verdict existence on Q-FUND/Q-EVR — fails at review (C-10). A grader computed from a poisoned baseline (Q-2) is void.
- WHY IT WORKS: C-10 built the courtroom and left two seats reserved; this card seats the witnesses. Funding says the move had attendance; efficiency says the attendance got what it paid for — different facts, separately graded, jointly priced in the tables (Q-10).
- STATUS: DRAFT

---

## BLOCK TWO — EFFORT VERSUS RESULT

---

**Q-4 — EFFORT vs RESULT (ABSORPTION AND THE SUSPECT MOVE)**

- RULE: Per bar, per 97 §H: **effort** = relVol class (Q-2); **result** = `|C − O| / ATR(atr.len)`, classed SMALL (≤ `evr.smallMax`) / LARGE (≥ `evr.largeMin`) / MID. Two named suspects, both **position-gated** — they exist only where the bar tags a reference zone (V-9 against any L-12-shaped reference); in a range's NMZ they stamp nothing (R-3's discipline): **ABSORPTION** = HIGH effort + SMALL result at a zone: massive attendance, no price progress — someone took the other side of everything, at size, and held the line. Direction read: absorption *at* a defended reference with the close held on the role side grades the defense up (joins L-5's episode record as evidence). **SUSPECT** = LOW effort + LARGE result: a big move nobody attended — thin-tape progress, graded down wherever the move's events are graded (a trend bar (E-2) on SUSPECT volume carries its anatomy with an asterisk the tables price). Both are evidence annotations under C-10 discipline: never verdicts, never gates.
- CONFIRMATION: Both classes computable at t_close; the position gate per V-9 against the stamped reference.
- INVALIDATION: An effort-result read off-reference (free-floating "absorption" mid-chart), or built from stand-down bars (Q-9), is void.
- WHY IT WORKS: Wyckoff's law, made countable: when effort and result disagree, the difference went *into somebody's inventory* — and inventory is the thing every later chapter's odds are secretly about. The book refuses to see absorption everywhere (position gate) precisely so that where it does see it, the word means one thing.
- STATUS: DRAFT

---

**Q-5 — VOLUME AT TESTS (DRYING-UP AND PRESSING)**

- RULE: Each test episode (L-5, any L-12-shaped reference) records its **episode volume** = max relVol among its tagging bars. Across successive *defended* episodes at one reference: **DRYING-UP(n)** = the last `vol.dryCount` episode volumes strictly decreasing — the attack is losing attendance (Wyckoff's secondary-test signature: supply exhausting into support, mirror at resistance). **PRESSING(n)** = strictly increasing — the attack is gaining fuel; defense odds degrade. Both are grade-class annotations joining L-6's quality read and R-5's maturity context as graders (the CH 4/CH 7 deposit-backs, cashed by this citation); both feed the spring/upthrust premium context (a spring after DRYING-UP at the boundary is the textbook sequence — A-4 consumes via Q-8). Never gates.
- CONFIRMATION: Episode volumes are t_close facts of stamped episodes; the monotonicity test fires at the completing episode's final bar.
- INVALIDATION: A sequence mixing references, spanning a break (episode counts restart with the reference's state life — L-8/R-9 discipline), or fed by stand-down bars, is corrupt.
- WHY IT WORKS: A level's tests are a siege, and volume is the size of each assault. Shrinking assaults with held ground is the defenders winning; growing assaults are the wall being probed for the breach. The classical tape-readers called this the only volume read worth having — the episode ledger finally lets two strangers count it.
- STATUS: DRAFT

---

**Q-6 — CLIMAX (THE EXHAUSTION CANDIDATE)**

- RULE: Per 97 §H, three conditions jointly at one t_close: relVol ≥ `clim.volMult` **and** (H−L)/ATR ≥ `clim.rangeMult` **and** the bar makes a `clim.extremeLookback`-bar extreme — stamped **CLIMAX(side)**, side by which extreme was made (new lookback low = selling-climax candidate; new high = buying-climax). A climax is an **exhaustion candidate, never a reversal signal** (C-9; the field's costliest volume error is buying the first climax of three). Consumers, all by existing machinery: the spring/upthrust premium and the gap trap read climax-on-the-trigger-bar as their top volume grade (A-4/A-5 via Q-8); the E-10.x taxonomy reads climax as exhaustion-class confidence (E-14's finalization, cashed by citation); CH 13 reads climax *clustering* as a volatility-climate input (forward-stub). The honesty table `vol.climaxOdds` prices what a climax has actually preceded, by side, position (at reference vs free air), and regime column when CH 13 lands.
- CONFIRMATION: The three conditions at one t_close, from admissible bars.
- INVALIDATION: A climax stamped on a stand-down bar (Q-9 — an earnings print is scheduled attendance, not exhaustion) is void; a climax cited as confirmation of anything fails at review.
- WHY IT WORKS: A climax is the auction spending its reserves in one bar — everyone who was going to panic (or chase) just did. That is genuine information about *who is left*, which is why it grades traps so well — and genuine ambiguity about *what happens next*, which is why it may not judge.
- STATUS: DRAFT

---

## BLOCK THREE — THE JOINS AND THE LIARS

---

**Q-7 — BREAKOUT VOLUME (THE B-4 ROW, CASHED)**

- RULE: The break chain's volume row (B-4's join table, amended this sprint): every C-2 confirmed break carries Q-FUND and Q-EVR (Q-3) across **all five reference types**; gap-borne breaks (B-10) additionally carry the claim bar's CLIMAX state (a breakaway on climax attendance is maximum-conviction *and* maximum-trap fuel — both readings are in E-12/E-14's taxonomy, and the table, not the prose, says which dominates). **The doctrine, stated honestly:** "volume must expand on the breakout" is the field's most-quoted volume law and is **inadmissible as law** here (C-9) — it enters as the measured claim `vol.breakLift`: the follow-through lift of Q-FUND breaks over LOW-funded ones, per reference type × grade, loop-filled. The classical literature's own measurements (Bulkowski) put the lift real but modest — the column will say what it says. A LOW-funded confirmed break stands confirmed, grades C-tier on funding, and its odds column is its honest price.
- CONFIRMATION: Row computed at the C-2 event from stamped classes.
- INVALIDATION: A break's volume row read from a poisoned baseline or a stand-down claim bar is void; "no volume, no breakout" as a gate fails at review (C-9 — the wall has no volume-shaped door).
- WHY IT WORKS: Funded breaks trap more inventory when they fail and carry more conviction when they run — both effects are real, directional, and *measurable per reference type*, which is precisely the kind of sentence this book is allowed to publish only with a table under it.
- STATUS: DRAFT

---

**Q-8 — AFTERMATH VOLUME (THE A-JOIN, CASHED)**

- RULE: The aftermath's volume columns (A-10, amended this sprint): **Retest signature** — the retest bar's relVol class and Q-EVR join A-1's HOLD/FAIL tables as graders: the classical read (LOW-volume retest that HOLDs = the throwback found no new supply — the healthiest continuation; HIGH-volume FAIL = active repudiation, premium trap fuel for A-3) ships as columns, not laws. **Trap premiums** — A-4 springs/upthrusts: CLIMAX(side) on the void bar at the range boundary is the setup's top volume grade (the deposit's exact shape: Wyckoff's spring *is* a selling climax that failed to break the floor), with DRYING-UP(n) on the boundary's prior episodes as the textbook pre-context (Q-5); A-5 gap traps: CLIMAX on the fill-confirming bar upgrades the trap (the crowd's capitulation is the entry's fuel). All grades ride the setups' existing five parts; no clock, trigger, or invalidation changes.
- CONFIRMATION: Each column's constituent events at their own t_closes.
- INVALIDATION: A volume column read across episode lives (pre-break volume graded into post-flip tests — A-7's ledger discipline), or from stand-down bars, is corrupt.
- WHY IT WORKS: The aftermath is inventory resolving, and volume is the only direct witness of *how much* inventory each act moved. The retest's quiet is information; the trap's roar is information; the book takes both as testimony and neither as verdict.
- STATUS: DRAFT

---

**Q-9 — WHERE VOLUME LIES (THE STAND-DOWN REGISTER)**

- RULE: The liars, named, each with its contract citation and its operative rule — on a stand-down bar, volume graders do not fire and the bar is excluded from baselines (Q-2) and episode-volume reads (Q-5): **Short sessions** (`bar.short`, V-7 — the law was written there; this is its operative card): a half-day's "low volume" is a calendar fact. **Ex-dividend bars** (`bar.exDiv`, V-5/T-9): dividend-capture flow is scheduled plumbing, not conviction. **Earnings bars** (`bar.earnings`, T-9 — flag ratified at R2; semantics RULED at the calendar home, X-8, per Q-R2's landed deferral): treatment per `vol.earnStand` ∈ {STAND (full stand-down), DISCOUNT (grade caps at NORMAL)} — **default STAND** (the conservative posture every other registered liar already gets; DISCOUNT sweeps), while price rules run with the flag as a table-splitting stamp (an earnings gap is information-dense repricing, not administrative arithmetic — X-8 states the split). **Split boundaries** (V-5): re-seed, never span (Q-2). **Feed identity** (T-9): the series of record's V is the *declared feed's* V — consolidated-tape and primary-exchange volume are different numbers for the same day, and mixing feeds inside one analysis voids it (the volume mirror of V-1's invalidation). **Known calendar distortions** (index rebalances, derivative-expiry clustering): `vol.calStand` ships as a declared-date stub set — the calendar's formal home is CH 13 (forward-stub); until it lands, the stub names the dates it excludes or it excludes nothing (no silent judgment calls).
- CONFIRMATION: Each flag is a stamped fact of the bar of record (T-9's contract fields) or the declared calendar stub.
- INVALIDATION: A volume grade, baseline, or table cell built on unregistered exclusions — or ignoring registered ones — is corrupt; "I skipped that bar, it looked weird" is not in this book's vocabulary.
- WHY IT WORKS: Volume's lies are almost all *scheduled* — the calendar, the corporate action, the venue definition. A register of known liars, enforced mechanically, is cheap; one unregistered liar inside a baseline quietly poisons every grade for a month. This is the assessment's §7.7 promise kept: the liars named, in writing, with citations.
- STATUS: DRAFT

---

**Q-10 — THE VOLUME LEDGER**

- RULE: This chapter's claims live under B-11's publication law (stated once there, binding here — A-10's pattern): `vol.breakLift` (Q-7, per reference type × grade) · retest-volume HOLD/FAIL columns (Q-8, joining A-10's tables) · `vol.dryLift` (Q-5 — defense odds after DRYING-UP vs PRESSING, by reference and maturity) · `vol.climaxOdds` (Q-6, by side × position) · the trap premiums (Q-8's climax columns inside A-4/A-5's tables). Every cell loop-filled with vintage; every empty cell reads **UNMEASURED**; an unmeasured volume claim may be stated, never recommended. **Regime columns JOINED (CH 13 landed):** every table gains the X-2 state · X-5 climate pair, per X-9.
- CONFIRMATION: Editorial — every published volume rate resolves to a cell with a vintage.
- INVALIDATION: Per B-11 — a naked volume claim ("breakouts need volume") in book prose fails review.
- WHY IT WORKS: Volume is the field's favorite place to sound wise without being checkable — attendance claims feel true and go unmeasured for decades. The ledger seats volume's folklore in the same chairs as everyone else's: numbered, dated, or silent.
- STATUS: DRAFT

---

## PARAMETER REGISTRY ENTRIES (introduced by this chapter)

| Parameter | Domain | Card | Proposed test range |
|---|---|---|---|
| `vol.baseMethod` | SMA · MEDIAN | Q-2 | MEDIAN default (Q-R1); SMA in grid |
| `vol.baseLen` | bars | Q-2 | 20–50 |
| `vol.hiMult` | > 1 | Q-2 | 1.5–2.0 |
| `vol.loMult` | 0–1 | Q-2 | 0.5–0.67 |
| `vol.todSessions` | sessions (stub) | Q-2 | CH 15 build-out |
| `evr.smallMax` / `evr.largeMin` | ATR units | Q-4 | 0.25–0.4 / 0.75–1.25 |
| `vol.dryCount` | int ≥ 2 | Q-5 | 2–3 |
| `clim.volMult` | > 1 | Q-6 | 2.5–4.0 |
| `clim.rangeMult` | > 0 | Q-6 | 1.5–2.5 |
| `clim.extremeLookback` | bars | Q-6 | 15–30 |
| `vol.earnStand` | STAND · DISCOUNT | Q-9 | STAND default (ruled at X-8); DISCOUNT sweeps |
| `vol.calStand` | declared-date set (stub) | Q-9 | CH 13 calendar home |
| `vol.breakLift` / `vol.dryLift` / `vol.climaxOdds` | honesty tables | Q-7/Q-5/Q-6 | loop-filled |

## SOURCES

Wyckoff via Pruden (effort-versus-result; the selling climax; the secondary test's drying supply — Q-4/Q-5/Q-6's ancestry, finally carded) · Dormeier (the doctrine's modern statement — volume interprets, grades, and never overrides; relative-volume lineage) · Granville (OBV — named at Q-1 and excluded with reasons, the door left stated) · Murphy and Edwards, Magee & Bassetti (the breakout-volume doctrine, named as folklore and shipped as a table) · Bulkowski (the measured volume-breakout lifts that seed Q-7's expectations) · 97-CORE-MATH §H (every formula's fixture home) · The Contract T-9 and V-5/V-7 (the flags the stand-down register spends).

## OPEN-DEPOSITS (claims on later chapters)

**To CH 11 (Indicators, landing with this chapter):** one witness pool — Q-FUND/Q-EVR sit under the same no-stacking law and independence-audit machinery as every indicator witness; volume-derived series re-admission (Q-1) would arrive through that chapter's grammar.
**To CH 12 (Patterns):** the classical pattern-volume signature (recede through the formation, expand at the break) enters as Q-2/Q-7 columns on pattern tables — CH 12 parameterizes, never re-defines.
**To CH 13 (Regime):** climax clustering and aggregate relVol state as volume-climate inputs; `bar.earnings` semantics and the `vol.calStand` calendar are ruled there (the ex-div stand-down's ratified home extends to the full calendar). *(Consumed — X-5 reads the climate; X-8 rules the calendar and the earnings default; X-9 joins the columns.)*
**To CH 15 (Universe):** time-of-day baselines (`vol.todSessions`); venue/consolidated-feed conventions per class; VWAP's re-admission site (intraday).
**To CH 16 (Risk):** volume grades size through C-10's channel (grade sizes, never gates), per the invariance law.

## OPEN QUESTIONS — RESOLVED (PUBLISHER-REVIEW-R6)

1. ~~Baseline default~~ **RESOLVED (Q-R1): MEDIAN, ratified as the prior** — the only baseline that survives an earnings print unpoisoned; SMA stays in the grid.
2. ~~Earnings treatment~~ **RESOLVED (Q-R2): deferral CONFIRMED, now landed** — the default (STAND) is ruled at X-8 in one motion with the calendar home; the option pair sweeps.
3. ~~OBV/A-D exclusion~~ **RESOLVED (Q-R3): CONFIRMED excluded for v1** — the burden is the claimant's (T-11); the audit-queue path is pre-authorized for later evidence, not run now.

*Chapter 10 v2 · 10 cards · DRAFT · review_ref: PUBLISHER-REVIEW-R5 · PUBLISHER-REVIEW-R6. Compiled against: Chapters 1–9 + 97 §H. The witnesses seated on the volume side; every deposit cashed, every default now ruled or swept, the regime columns joined. — THE SCINTILLA RULEMAKER*

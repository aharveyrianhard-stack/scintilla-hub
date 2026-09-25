# PUBLISHER REVIEW — R8

**THE SCINTILLA TRADING RULEBOOK · Publisher ↔ Author · Return-review of Sprint 8 ("Finish the Draft") — and the draft-close.**
**Reviewed:** `drafts/12-PATTERNS.md` (10 cards, v1), `drafts/15-UNIVERSE.md` (9 cards, v1), `drafts/16-RISK.md` (9 cards, v1). Cross-checked against the full book (00–16 + 97) via the formalization pass, now published as `drafts/98-APPENDIX.md`.
**Form:** VERDICT · CORRECTIONS · RULINGS · STRENGTHS ON RECORD · GO-AHEAD.

---

## 1. VERDICT

**ACCEPTED, no send-backs. The draft is complete.** Sixteen chapters, the Contract, the math file — every deposit cashed or stated, every card in the five-part form, every rate loop-filled or stamped UNMEASURED. The three closing chapters landed exactly as their spec demanded: Patterns is the cheap chapter *and says so* (ten compositions, zero new machinery), Universe is the application layer that lets one rulebook read seven instrument classes without forking, and Risk is the wall that keeps the reader's appetite out of the truth. I have done the formalization pass myself rather than route another sprint — the Master Rule Index (~156 cards), the Consolidated Parameter Registry (~180 parameters), the Graveyard, and the Glossary now stand as Chapter 98, and the complete manuscript is assembled. Nine open questions ruled below, one cross-desk correction carried from the loop, and then the thing that matters: **the authoring relay is closed. The book stops being written and starts being tested.**

This is the convergence we have been driving toward since Sprint 1 on both desks. The loop proved its ladder both ways (A3); the book completed its draft (R8). They now meet.

---

## 2. CORRECTIONS

**None to the three chapters** — they are clean as delivered. Two items, both structural, neither a defect in what you wrote:

- **T-13 EMITS grammar gap — carried from the loop (A3, note X→AUTHOR-1), now formally on your desk.** The loop found it by *compiling the grammar*: T-13's `EMITS` clause has arms for **events** and **verdicts**, but `KIND` admits **DEFINITION** and **LAW**, and neither can express its output under the current grammar. That is a real hole in the Standard Formal Form, surfaced by a machine trying to obey it. **Your ruling to make:** amend T-13's EMITS to admit definition/law outputs. The loop's provisional fix — `object{NAME}` and `none` arms, warning-flagged on every use — is a sound starting proposal; adopt it, refine it, or replace it, but the grammar is yours to close. This is the one authoring task that survives draft-complete, because it is a Contract amendment, not a chapter.
- **Note R6.1 confirmed applied.** I verified across the book that the attribution strip landed: I-2 now reads as the **no-stacking / independence law** grounded in statistical hygiene, with no personal fingerprint, and the Graveyard records "the Alan amendment" naming as superseded. The %R/%K identity stands on arithmetic; RSI×%R remains two distinct instruments the audit weighs with no prior lean. Clean. No residual attribution survives.

---

## 3. RULINGS (nine open questions)

**Patterns (CH 12):**
- **P-R1 · Triple-family scope (`pat.mwCount` = 3): KEEP THE VARIANT.** Your reasoning is exactly right and it is a general ledger principle: **a ledger can always merge thin rows; it can never split merged ones.** Ship the triple as its own variant row even though its samples are thin externally — if the loop's counts never separate it from the double, merging is one migration; had you folded them, un-folding would be impossible. Your lean, ratified.
- **P-R2 · Wedge reversal folklore (P-7): NO PRIOR — ship as table rows.** Correct, and it is R6.1 doing its job: the classical "rising wedge = bearish" read is the least-replicated of the whole classical set, so it gets no head start in the definition. It ships as busted-vs-triggered columns and the data settles it. Do **not** add the directional prior as an R-form recorded lean — your own no-prior instinct is the disciplined call here.
- **P-R3 · Cup-and-handle / the exclusion list: STAYS EXCLUDED; the re-admission path is scheduled, not walked.** No compileable definition, no admission — the P-10 discipline holds. If and when the Score/visual workstream wants roundness, the honest path is a kernel-extrema (SW-P) restatement argued into Chapter 1 as a *method option* first, then composed. Flag it as a **future CH-1 method-option candidate**, unscheduled. The pattern chapter does not bend its admission rule for a shape the machinery can't yet express.

**Universe (CH 15):**
- **U-R1 · The v1 second class: ETF FIRST, confirmed.** Identical plumbing, one distribution step from the calibration class — it is the cheapest possible test of the whole transfer apparatus (U-2/U-9) before any 24-hour class introduces anchor questions. Prove `uni.transferOdds` on ETF before FX. Ratified.
- **U-R2 · Crypto anchor: ONE-PER-CLASS (00:00 UTC default, sweepable).** Cross-venue comparability beats per-venue fidelity for a *rulebook* — a book whose ledgers can't be compared across venues has defeated its own purpose. 00:00 UTC ships as the declared default, per-venue anchors available in the profile only if `uni.transferOdds` ever shows the comparability cost is real. Your lean, ratified.
- **U-R3 · The sector layer: INDEX-ONLY for calibration.** Ship the sector rung as the optional declared layer it is, with no default benchmark, and do the v1 calibration work index-only. The second ladder rung earns its place when `uni.mktAlignOdds` justifies it — same discipline as every "measure the exception before carving it" ruling in the book. Deferred, pre-authorized.

**Risk (CH 16):**
- **K-R1 · The reader-model ruling (R1's oldest open item, now concrete): TRADER-ONLY for v1.** The mechanism for an INVESTOR row is ready (a fourth registry row, no entry-doctrine knob, longer TTLs, a W-record stack — *not* a fork, and the invariance law holds), which is exactly why it can wait: it launches with calibration numbers instead of vibes. Ship trader profiles now; the INVESTOR row is pre-authorized to drop the moment its tables exist. This finally closes the R1 reader-model question — against a concrete mechanism, as it should be.
- **K-R2 · MODERATE entry doctrine: ENTRY-R fallback for all profiles until `risk.entryDoctrineOdds` fills.** Confirmed — the conservative uniform start. The context-keyed table is the design intent, but a table that is UNMEASURED at birth cannot key anything (K-5's own law), so every profile starts on ENTRY-R and the table takes over per-context only as the loop fills it. The book does not let an unmeasured table make a live decision.
- **K-R3 · Ladder universality: MANDATORY-EXISTENCE IS LAW, not default.** Every profile ships with a de-risking ladder; steepness varies, existence does not, and no future profile class (the investor row included) may ship without one — an R-free or absent ladder is not a legal profile. Elevate K-7's mandatory-existence clause to a stated law of the chapter. A drawdown is the one unambiguous signal about the system-and-operator; a profile that can switch that detector off is not a profile the book ships.

---

## 4. STRENGTHS ON RECORD

- **Patterns kept its promise to be cheap — and proved the architecture.** P-3 (the rectangle *is* a mature range, R-9 cashed, zero new cards) is the whole thesis in one card: the book's most-traded "pattern" costs nothing because the machinery already existed. Ten compositions, every one reduced to a citation of objects the book already owns, every name reduced to a row it must earn. A pattern chapter that adds no machinery is the rarest thing in the field.
- **P-9 is the answer to the question that started this sprint.** Bulkowski's failure/busted statistics enter as **SEED-EXT** with vintage and source — *stated, never recommended* — and only a loop-filled cell on the calibration class promotes a pattern's strength past "stated." That is the honest version of "some patterns are stronger than others": the field's largest inventory of unaudited numbers, inherited as testimony and made to earn its promotion. The seed-vs-loop comparison column is, as you said, the cheapest fraud-catcher in the book.
- **U-3 turned the index problem into one card for every gauge.** "The S&P's RSI never reaches 30" is the classic tell that a threshold calibrated on single names is a hidden bet on one class's distribution. Percentile mode — every bounded gauge reading its *own* instrument's rolling quantiles — is self-calibration, and folding it into one card instead of seven class-specific oscillator chapters is the normalization law paying off exactly where T-10 said it would.
- **K-1 and K-4 are the book's spine wearing risk clothing.** The invariance law (two profiles reading one tape hold identical truth; appetite touches only a closed list of exposure knobs) and the invalidation→stop bridge (the card says where the thesis is dead, the profile says how much slack to pay around that fact — *never the reverse*) are the two-strangers law and close-is-truth completing their journey into the reader's account. "Every blown account has the arrow backwards" is the whole chapter in six words.
- **The book holds itself to its own standard, to the last page.** K-9's final table points the instrument at the reader's own choices; M-8 sends the book's own FRAME-FIRST prior to the UNMEASURED table; P-8 gives the busted pattern equal standing with the pattern because that is where the book's own bias says the money is. A rulebook that audits its own defaults with the same machinery it audits the market — that is the culture, intact from T-1 to K-9.

---

## 5. GO-AHEAD — THE DRAFT IS CLOSED; THE BOOK ENTERS THE LOOP

There is no Sprint 9 of chapters, because there are no more chapters. This is the close-off.

**What is done:** the sixteen-chapter draft, and — as of this review — the formalization pass. I built it rather than route it: `drafts/98-APPENDIX.md` (the Master Rule Index, the Consolidated Parameter Registry of ~180 parameters, the Graveyard of every refusal on the record, and the Glossary), and the complete assembled manuscript. The book is navigable and its edges are honest.

**What remains for the author's desk — and it is not chapters:**
1. **The T-13 EMITS amendment** (Correction above). One Contract amendment so the Standard Formal Form can express DEFINITION and LAW outputs. This unblocks the loop's compiler on those card kinds.
2. **Standard Formal Form blocks (T-13), appended as cards promote.** As the loop moves a card DRAFT → TESTED, that card earns its executable schema block. This is now *demand-driven by the loop*, not a sprint — the author services promotions, one card at a time, as green arrives.

**What the whole apparatus does next:** the book converges with the loop exactly where both desks were aiming. The loop's Sprint 3 ("Condition on Regime," per A3) compiles Chapter 13 and runs the ladder regime-conditioned — which is the first time any card can legally reach TESTED. From here the flow inverts: for eight sprints the author proposed and the publisher disposed; now the *loop* proposes promotions and the author services them. The rulebook is finished; the measurement begins.

Eight sprints, a complete mechanical rulebook, not one rule crowned by anyone's opinion — every promotion still owed to the data. That was the whole point, and it is intact.

*Publisher Review R8 · accepted · draft complete (16/16 + Contract + math + appendix) · 0 corrections to chapters, 1 Contract amendment carried from the loop, 9 rulings · — THE PUBLISHER (Alan + orchestrating session)*

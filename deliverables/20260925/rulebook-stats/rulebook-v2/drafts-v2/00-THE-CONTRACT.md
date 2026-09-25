# THE CONTRACT (T)

**THE SCINTILLA TRADING RULEBOOK · Front matter · v2**
**STATUS: DRAFT · v3** (laws T-1…T-13; promotion by publisher ratification, not testing — laws are ratified, rules are tested)
**v3 changelog (2026-09-25, decision D2):** T-13's EMITS clause gains `object{NAME}` and `none` arms — the one grammar hole the loop found by compiling the form (R8 §2) — provisional and warning-flagged; T-9's registry table gains `bar.exDiv` (D3).
**v2 changelog (per PUBLISHER-REVIEW-R2):** T-7 gains the `review_ref` mechanism (R-1: no fifth status — reviews annotate, only evidence promotes) · T-9 gains the optional `bar.earnings` flag (C-R2-1; semantics deferred to CH 13, v1 default no-stand-down) · T-13 gains the CardSpec lossless-serialization requirement (C-R2-2) and its build-question ruling (R-3). Both open questions resolved in place.

SUMMARY: The laws under which every rule in this book is written, read, tested, promoted, and retired. Nothing here reads a chart. Everything that reads a chart obeys this. The loop engineer builds against this document.

**A note on citation direction:** these laws cite the vocabulary cards (V-x) that serve as their operative homes. That is downward citation — a constitution naming the statutes that implement it — and it is the one place the Compile Law (T-5) does not bind, because front matter is grammar, not a rule operating on bars.

---

**T-1 — THE TWO-STRANGERS LAW**

- RULE: A rule is finished only when it could be printed, handed to two strangers, and both would mark the same bar — and one of the strangers may as well be a computer. If applying a rule requires judgment, feel, or context not stated in the rule, the rule is unfinished.
- CONFIRMATION: Two independent implementations (human-marked and machine-executed) produce identical event sets on the same series of record.
- INVALIDATION: One divergence traceable to ambiguity in the rule's text (not to a data difference) sends the rule back to DRAFT.
- WHY IT MATTERS: Every other law in this book is an enforcement mechanism for this one.
- STATUS: DRAFT

---

**T-2 — THE CARD LAW**

- RULE: Every rule is published as a five-part card: RULE (mechanical statement) · CONFIRMATION (the exact event that makes it TRUE) · INVALIDATION (the exact event that voids it) · WHY IT WORKS (who is trapped, who must act) · STATUS. No card publishes without all five. **Definitional cards** (vocabulary, contracts, objects) use WHY IT MATTERS in place of WHY IT WORKS — a definition has no trapped party; it has a divergence it prevents — and their CONFIRMATION/INVALIDATION are the events that instantiate and void the *instance*.
- CONFIRMATION: Editorial check at delivery: five parts present on every card.
- INVALIDATION: A card missing a part — most commonly a rule that cannot state its own INVALIDATION — does not publish. A rule that cannot be voided is a belief.
- WHY IT MATTERS: The card is the book's unit of accountability. A paragraph can hide; a card cannot.
- STATUS: DRAFT

---

**T-3 — THE PRECISION LAW**

- RULE: Every rule states its inputs — the series of record (T-9) plus named parameters — and its output — an event, or a verdict object (T-8) — so exactly that a computer could execute it with no further decisions. Card-short: if a rule takes a paragraph, it is two rules or it is not done.
- CONFIRMATION: The rule translates into the Standard Formal Form (T-13) without adding any decision not present in the card text.
- INVALIDATION: Any word in a RULE requiring interpretation ("significant," "strong," "clearly," "roughly") fails the card at review.
- WHY IT MATTERS: Aronson's discipline: a rule must be objective before it can even be *wrong*. Untestable is a worse grade than false.
- STATUS: DRAFT

---

**T-4 — THE PARAMETER LAW**

- RULE: Every constant is a named parameter (`family.name`) registered in the Parameter Registry (appendix). No number appears inline in any RULE. Authors propose *test ranges*; the publisher's testing sets *defaults*; profiles (CH 16) may re-key only the parameters the risk chapter declares legal knobs. One registry, one entry per parameter, owner chapter recorded.
- CONFIRMATION: Registry lookup resolves every symbol in every card.
- INVALIDATION: An inline number in a RULE, or a parameter used in two chapters with two meanings, fails at review.
- WHY IT MATTERS: Options, not opinions — the author states the machinery; the data picks the values. Inline numbers are opinions wearing precision.
- STATUS: DRAFT

---

**T-5 — THE COMPILE LAW**

- RULE: The book compiles forward, once. No rule card cites a term, event, object, or grade defined in a later chapter. **Forward-stub is legal; forward-cite is not:** a card may *name* a parameter a later chapter owns (`zone.width` named in V-17, sized in CH 4), but may never *depend on a definition* that does not yet exist. Where material genuinely requires later machinery (Chapter E's gap taxonomy needing CH 4 levels and CH 6 structure), it enters the earlier chapter by **backfill** (T-12) after the dependency exists — never by forward citation.
- CONFIRMATION: A dependency scan of any chapter resolves every citation to an earlier chapter or to itself.
- INVALIDATION: One forward citation fails the chapter at review.
- WHY IT MATTERS: A reader — or an execution engine — holding chapters 1 through N possesses every definition chapters 1 through N use. The book never asks for credit.
- STATUS: DRAFT

---

**T-6 — THE RULE-ID LAW**

- RULE: Rule IDs bind to chapter **letters** (V, E, C, L, D, S, R, B, A, Q, I, P, X, M, U, K, T), never to chapter numbers. Chapters may renumber across editions; a rule is never re-keyed. Numbers within a letter are never reused: a retired rule's ID goes to the Graveyard and stays there.
- CONFIRMATION: Every ID ever published resolves — to a live card or a graveyard entry.
- INVALIDATION: A reused or re-keyed ID corrupts the citation graph; the edition does not ship until repaired.
- WHY IT MATTERS: This is what made reordering the entire book (assessment §8) cost nothing. Stable names are what let structure stay cheap to change.
- STATUS: DRAFT

---

**T-7 — THE PROMOTION PIPELINE**

- RULE: Every card carries STATUS ∈ {DRAFT, TESTED, LAW, RETIRED}. DRAFT: authored, delivered, unverified. TESTED: the loop has run it on the calibration class and the publisher has reviewed the numbers. LAW: publisher-promoted; only an amendment pass (T-12) may alter it. RETIRED: moved to the Graveyard with cause of death ∈ {FAILED_TESTING, SUPERSEDED_BY <id>, REGIME_LIMITED, OUT_OF_SCOPE}. The author cannot self-promote; testing cannot self-promote; promotion is a publisher act on testing's evidence. Demotion happens the same way — by data, not by taste.
- CONFIRMATION: Status transitions appear in the Changelog with the evidence cited. **[v2, R-1]** A publisher review is *not* a status: it is recorded as a changelog annotation plus an optional `review_ref` field on the DRAFT card pointing at the review document. The card stays DRAFT until the loop's numbers move it — only evidence promotes.
- INVALIDATION: A status change with no changelog entry is void; the prior status governs.
- WHY IT MATTERS: The W%R episode is the founding precedent: the author's confident opinion went to testing instead of into the book. That pipeline, made law.
- STATUS: DRAFT

---

**T-8 — THE VERDICT LAW**

- RULE: The only opinion-bearing object in this book is the verdict (operative card V-21): {subject_type, subject_id, direction, tf_of_record, born_event, void_event, expiry_clock} — all seven fields, always. `expiry_clock` is a positive bar count **or `EVENT_ONLY`** (per publisher ruling C2). EVENT_ONLY is admissible only when the producing card demonstrates its void_event is **structural and decidable on every future bar** — a break of the swing of record either has happened or has not, on every close, forever. Claim-type verdicts (breaks awaiting confirmation, pattern triggers) must carry finite clocks. Trend-type verdicts (CH 6) are the intended EVENT_ONLY citizens: a trend is in force until reversed — Rhea's law survives inside the mechanism.
- CONFIRMATION: Every verdict-producing card names all seven fields and, if claiming EVENT_ONLY, shows decidability.
- INVALIDATION: A verdict missing a field, or an EVENT_ONLY claim whose void_event can dangle undecidable, fails at review.
- WHY IT MATTERS: Finite clocks kill stale opinions; EVENT_ONLY protects structural truths from being force-expired by an arbitrary counter. Both failure modes are real; the sentinel serves the second without reopening the first.
- STATUS: DRAFT

---

**T-9 — THE BAR CONTRACT (RATIFIED)**

- RULE: Every rule reads exactly one **series of record** (operative cards V-1…V-7): bars (O, H, L, C, V, t_open, t_close) built under a declared `bar.tf`, `bar.session`, `bar.tz`, `bar.basis`, `bar.adjust`, with the aggregation law (V-6), revision doctrine (V-4), and short/missing-bar handling (V-7). **Ratified defaults for v1** (publisher, R1): timeframe floor **DAILY-and-up**; calibration class **US large-cap equities + major US indexes**; `bar.session = RTH`; `bar.adjust = SPLIT_ONLY` with ex-dividend stand-down (calendar rules, CH 13); conventions per **TradingView** as the house platform. **[v2, C-R2-1/R-2]** The contract carries one further **optional** declared flag: `bar.earnings = true` on a session bar inside the instrument's earnings window — parallel in kind to `bar.exDiv`, admitted now because an earnings gap that obeys E-8 mechanically means something categorically different. **v1 default: no stand-down** (present behavior unchanged); the stand-down *semantics* are CH 13's deposit, written when that chapter lands. The contract is **feed-agnostic by construction**: every setting is a named parameter, so declaring another feed (or a testing feed such as FMP/Stooq in the loop) is a parameter declaration, not a rule change.
- CONFIRMATION: A series declaring all contract parameters is a series of record; rules may read it.
- INVALIDATION: Mixed constructions inside one analysis void every verdict involved (V-1, V-5).
- WHY IT MATTERS: Publisher's R1 ruling ordered the V-5 reasoning kept verbatim, so here it is: *"TOTAL_RETURN restates the entire past at every ex-date — historical levels quietly move, which collides with the Repaint Prohibition (V-14) unless the restatement schedule is declared. SPLIT_ONLY keeps prints tradeable but manufactures a fake bearish gap each ex-date. Neither is free; the book must know which lie it is managing."* Two strangers with different feeds fail before Chapter 1; this law is why they don't.
- STATUS: DRAFT (defaults RATIFIED)

---

**T-10 — THE SCALE LAW (RESTATED AS LAW)**

- RULE: All vertical distance is measured in **PCT** (log-percent) or **VOLU** (ATR units); raw currency distance and chart angles are forbidden in every rule; slope is unit-per-bar. Operative cards: V-3 (the law's working form), V-25 (ATR, Wilder-exact), V-26 (the two distance forms), V-27 (slope). Post-C1, every threshold comparison in the book uses the exact log form in PCT mode (`100 × ln(P₂/P₁)`) or the ATR-ratio form in VOLU mode — never the arithmetic approximation.
- CONFIRMATION: Every distance in every card names its `scale.mode` and resolves to one of the two forms.
- INVALIDATION: A raw-price distance, an angle, or an arithmetic-percent threshold fails the card (this is C1's class of bug, now a lintable offense).
- WHY IT MATTERS: The Scale Law is what makes one book work on a $12 ticker and a $4,000 index alike. It is also the law the book itself broke first (V-10 v1) — proof the linting is not decoration.
- STATUS: DRAFT

---

**T-11 — THE SCOPE LEDGER**

- RULE: This book covers the mechanical reading of time-bar price and volume charts. The following are **excluded by judgment, not ignorance** — each with its reason, each re-admissible only by a stated algorithm passing T-1: **Elliott & Gann** (competing counts are simultaneously legal on the same data; no unique-count algorithm exists); **point & figure, Renko, Kagi, three-line-break, Heikin-Ashi** (different bar algebra; porting rules across bar constructions is a second book); **market profile** (different data object); **cycles & seasonality-as-edge** (calendar survives only as stand-down rules, CH 13); **sentiment, COT, flow of funds** (not chart events); **intermarket analysis** (survives only as macro-vs-ticker authority, CH 15); **Fibonacci** (admitted solely as retracement/projection fraction options in CH 6/CH 8 — the ratios are testable fractions; the numerology stays outside); **the candlestick name-zoo** (admitted solely as measurable primitives, CH 2, per Bulkowski's statistics); **breadth** (admitted as CH 15 aggregation machinery only).
- CONFIRMATION: A topic is in scope iff it appears in a chapter; excluded topics appear only on this ledger.
- INVALIDATION: Scope creep — an excluded method entering a card without a ratified ledger amendment — fails the chapter.
- WHY IT MATTERS: Readers trained on the CMT/CFTe curricula will notice what is missing. The ledger converts every silence into a decision they can disagree with — which is the only honest kind of silence.
- STATUS: DRAFT

---

**T-12 — THE AMENDMENT & BACKFILL LAW**

- RULE: Chapters are living until the book ships. Amendments arrive as **versioned passes** (v2, v3 …) with a changelog line per card touched; the spiral's **backfill** (a later chapter correcting an earlier one — Ch. 1's C1–C4 are the founding instance) and **deposit-forward** (early work dropping owned material into a later chapter's OPEN-DEPOSITS section) are the two sanctioned flows. A deposit is not a rule: OPEN-DEPOSITS content is unbound draft material awaiting its chapter's turn. Retired rules go to the Graveyard under T-7's taxonomy; the Changelog records every version of every chapter; the registry re-issues no names.
- CONFIRMATION: Every delivered chapter version appears in all three relay lanes with its version number; every card edit traces to a changelog line.
- INVALIDATION: Silent edits — a card changed with no version bump and no changelog line — void the delivery.
- WHY IT MATTERS: A rulebook that can't account for its own changes will eventually contain two truths, and two truths is zero.
- STATUS: DRAFT

---

**T-13 — THE STANDARD FORMAL FORM**

- RULE: Every card, at promotion to TESTED, appends a formal block in this exact schema — authored by the author, verified executable by the loop:

```
RULE_ID:     <letter>-<number>            # T-6
KIND:        EVENT | VERDICT | DEFINITION | LAW
INPUTS:      series_of_record(<contract params>)   # T-9
PARAMS:      [<family.name>, ...]                  # registry names only, T-4
SCALE:       PCT | VOLU | NONE                     # T-10
EVAL_AT:     t_close                               # V-8, always
CONFIRM:     <boolean expression over closed bars, prior events, params>
INVALIDATE:  <boolean expression — the mirror>
EMITS:       <event name> | verdict{7 fields} | object{NAME} | none   # T-8; object{NAME} when KIND=DEFINITION, none when KIND=LAW (v3, D2 — provisional, warning-flagged)
CLOCKS:      [<name>: <param>, ...]                # V-28
```

  Worked example — V-10 CLOSE BEYOND (upward, PCT mode), post-C1:

```
RULE_ID:     V-10
KIND:        EVENT
INPUTS:      series_of_record(bar.tf=D, bar.session=RTH, bar.adjust=SPLIT_ONLY)
PARAMS:      [pen.min, scale.mode]
SCALE:       PCT
EVAL_AT:     t_close
CONFIRM:     100 * ln(C_t / P_ref) >= pen.min
INVALIDATE:  n/a (claim-level event; voiding is CH 3's composition)
EMITS:       CLOSE_ABOVE(P_ref, t)
CLOCKS:      []
```

- CONFIRMATION: The loop executes the block against fixtures and reproduces the author's marked events exactly (T-1's computer stranger). **[v2, C-R2-2]** The block must **serialize losslessly to the loop's `CardSpec`** — round-trip with no loss, so the compiler between book and loop is negotiated once, not re-fought per chapter. **[v2, R-3, ratified]** Build order: for the swing bake-off the loop *re-implements from prose and diffs* against this block (the strongest Two-Strangers test — two minds, one predicate, a diff); thereafter the formal block is the executable source.
- **[v3, D2 — 2026-09-25]** EMITS gains two arms so the form can express every KIND it admits: a DEFINITION card emits `object{NAME}` (the named object it defines, for other cards to cite); a LAW card emits `none` (it constrains, it produces nothing). Both arms are **provisional**: the loop's compiler flags every use with a warning until the Publisher ratifies the wording. Carried from the loop's compiler finding (ARCHITECT-REVIEW-A3, note X→AUTHOR-1) through PUBLISHER-REVIEW-R8 §2; adopted here at the checkup's default.
- INVALIDATION: A formal block requiring any decision not present in the card's prose reveals the prose unfinished — the card returns to DRAFT.
- WHY IT MATTERS: The formal form is where the Two-Strangers Law stops being an aspiration and becomes a diff.
- STATUS: DRAFT

---

## PARAMETER REGISTRY ENTRIES (introduced by this document)

| Parameter | Domain | Card | Note |
|---|---|---|---|
| `bar.earnings` | bool flag on session bars | T-9 (v2) | optional; v1 default no-stand-down; semantics owned by CH 13 |
| `bar.exDiv` | bool flag on session bars (ex-dividend open) | T-9 (v3, D3) | used by T-9, V-5, E-8, C-3, Q-9, X-8 since v1; registered here 2026-09-25 |

(Otherwise none — the Contract is the law about parameters. The registry lives as an appendix, seeded by Chapter 1 v2's table.)

## SOURCES

Aronson (objectivity precedes evaluation — T-1, T-3) · Rhea (trend-in-force — T-8's EVENT_ONLY) · Kirkpatrick & Dahlquist ch. 11, Murphy ch. 3 (construction-before-analysis — T-9) · PUBLISHER-REVIEW-R1 (C1–C4; ratified defaults; the V-5 reasoning preserved verbatim in T-9) · PUBLISHER-REVIEW-R2 (C-R2-1/2, R-1, R-3 — this version's changelog) · 00-authoring-method v2 / PROCESS-PLAYBOOK (the spiral — T-12).

## OPEN QUESTIONS — RESOLVED (PUBLISHER-REVIEW-R2)

1. ~~Fifth status tier~~ **RESOLVED (R-1): NO.** Four statuses stand; reviews are changelog annotations + `review_ref` (folded into T-7).
2. ~~T-13 executable source vs re-implement-and-diff~~ **RESOLVED (R-3): the author's recommendation ratified** — diff for the bake-off, formal-block-as-source thereafter; the loop independently arrived at the same answer (folded into T-13, paired with the CardSpec requirement).

*The Contract v2 · 13 laws · DRAFT pending ratification · review_ref: PUBLISHER-REVIEW-R2. Compiled against: nothing. Governs: everything. — THE SCINTILLA RULEMAKER*

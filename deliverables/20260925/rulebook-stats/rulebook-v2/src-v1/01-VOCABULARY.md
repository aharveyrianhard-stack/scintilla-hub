# CHAPTER 1 — VOCABULARY (V)

**THE SCINTILLA TRADING RULEBOOK · Chapter draft · v3**
**STATUS: DRAFT** (all cards; promotion by publisher testing)
**v3 changelog (C-R5-1, PUBLISHER-REVIEW-R5 — routed from the loop crew):** V-12's LEFT tie rule reconciled. The prose said ties resolve to the earliest bar while the inequalities (≥ left flank, > right) selected the **latest** — the loop crew's tie fixture proved the contradiction by compiling it. The card now matches the prose and the crew's compiled intent: strict > against the left flank, ≥ against the right, so the earliest bar of any tie group is the unique candidate. INVALIDATION tightened to state the per-option kill condition. A rule that compiles two ways is the Two-Strangers failure this book exists to prevent — caught by the machine that compiles it. No other card touched.
**v2 changelog:** publisher corrections C1–C4 from PUBLISHER-REVIEW-R1 applied — V-10 restated in the two declared scale forms (C1) · V-21 `expiry_clock` admits the `EVENT_ONLY` sentinel (C2) · V-17 gains the `zone.tickFloor` stub (C3) · V-4 revision-window default flagged as a testing target (C4). No other card touched.

SUMMARY: The operational definitions everything else compiles against. Four blocks: the Bar Contract (what a bar is), primitive events (what a bar can do), structural objects (swings, levels, verdicts), and measurement units (how distance, slope, and time are counted). Nothing in this chapter is advice; it is the language the advice will be written in.

**Card grammar note (logged for The Contract):** definitional cards use WHY IT MATTERS in place of WHY IT WORKS — a definition has no trapped party; it has a failure it prevents: the case where two strangers mark different bars. CONFIRMATION on a definitional card is the exact event that instantiates the term; INVALIDATION is the exact event that voids or reclassifies the instance.

**Parameter convention:** every constant is a named parameter (`family.name`). No value appears inline in any RULE. Proposed test ranges live in the registry table at the end of this chapter; the publisher's testing sets defaults.

---

## BLOCK ONE — THE BAR CONTRACT

*The data a rule is allowed to read. Two strangers agree on nothing downstream if they disagree here.*

---

**V-1 — BAR OF RECORD**

- RULE: A bar is the tuple (O, H, L, C, V, t_open, t_close) produced for one instrument by one declared construction: timeframe `bar.tf`, session template `bar.session` ∈ {RTH, ETH, FULL24}, exchange timezone `bar.tz`, price basis `bar.basis` (last trade), adjustment policy `bar.adjust` (V-5). The series so constructed is the **series of record**. Every rule in this book reads the series of record and nothing else.
- CONFIRMATION: The bar exists when t_close has passed and the feed has printed final OHLCV.
- INVALIDATION: A bar from any other construction (different session, different adjustment) is not a bar of record; verdicts computed on it are void.
- WHY IT MATTERS: "Daily bar" is a convention, not a fact of nature. Same ticker, different session template → different high, different close, different verdicts.
- STATUS: DRAFT

---

**V-2 — CLOSE OF RECORD**

- RULE: The close of record is C of the bar of record. For equities under `bar.session = RTH`, that is the official closing auction print. Extended-hours prints after t_close do not amend it and are not events.
- CONFIRMATION: The session's closing procedure completes; C is final subject to V-4.
- INVALIDATION: Any "close" read from a session other than the declared template.
- WHY IT MATTERS: The prime axiom (V-8) makes the close the only truth-bearer in this book. A truth-bearer with two candidate values is not one.
- STATUS: DRAFT

---

**V-3 — THE SCALE LAW**

- RULE: Every vertical distance in every rule is expressed in one of exactly two units, declared per rule: **PCT** — log-percent, `d = 100 × ln(P₂ / P₁)` — or **VOLU** — volatility units, `d = (P₂ − P₁) / ATR(atr.len)` (ATR per V-26). Raw currency distance is forbidden in any rule. Slope is distance per bar in the declared unit (V-27).
- CONFIRMATION: A rule states `scale.mode ∈ {PCT, VOLU}` for each of its distances.
- INVALIDATION: Any rule containing a raw price distance or a chart-angle ("45°") condition is malformed and unpublishable.
- WHY IT MATTERS: $5 is a collapse on a $50 stock and noise on a $5,000 one; an angle is an artifact of zoom. Log-percent is additive across bars and symmetric up/down; ATR units transfer across instruments. These two survive; nothing else does.
- STATUS: DRAFT

---

**V-4 — THE REVISION DOCTRINE**

- RULE: A closed bar may be restated by the feed until `bar.revClock` bars of record have closed after it (the revision window). A restatement inside the window forces re-evaluation of every verdict born on that bar. After the window, the bar is immutable regardless of feed behavior. **[C4] The daily-equity default is a testing target, not a settled value:** vendors correct official daily prints later than one session with some regularity (late trades, bust corrections, adjustment reprocessing) — test 1–3 sessions before promoting a default.
- CONFIRMATION: Restatement print inside the window → re-evaluate; window passes → bar frozen.
- INVALIDATION: Verdicts recomputed from restatements after the window are void; the frozen bar governs.
- WHY IT MATTERS: Feeds correct bad prints. A rulebook that never re-evaluates trusts errors; one that re-evaluates forever has no facts at all. One bar of tolerance, then the record is the record.
- STATUS: DRAFT

---

**V-5 — ADJUSTMENT POLICY**

- RULE: `bar.adjust` ∈ {SPLIT_ONLY, TOTAL_RETURN}. SPLIT_ONLY: series rescaled for splits; dividends leave their gap in the record (the ex-dividend open is flagged `bar.exDiv = true`; gap rules stand down there — cited by CH 2 and CH 13). TOTAL_RETURN: dividends also backed out. Under the Scale Law both options preserve relative distances away from the adjustment boundary; they differ at it.
- CONFIRMATION: One policy declared for the series of record; all rules read that series.
- INVALIDATION: Mixing policies within one analysis (levels from one series, closes from another) voids every verdict involved.
- WHY IT MATTERS: TOTAL_RETURN restates the entire past at every ex-date — historical levels quietly move, which collides with the Repaint Prohibition (V-14) unless the restatement schedule is declared. SPLIT_ONLY keeps prints tradeable but manufactures a fake bearish gap each ex-date. Neither is free; the book must know which lie it is managing. Provisional default (skeleton doc): SPLIT_ONLY with ex-date stand-down.
- STATUS: DRAFT

---

**V-6 — THE AGGREGATION LAW**

- RULE: A bar of a higher timeframe is the aggregate of its constituent bars of record: O = first O, H = max H, L = min L, C = last C, V = Σ V. The aggregate bar exists only when its **last constituent** has closed (the prime axiom applies upward). Weekly = that week's session bars (holiday weeks aggregate what exists); monthly = the calendar month.
- CONFIRMATION: Last constituent bar closes → aggregate bar exists.
- INVALIDATION: Any rule reading a forming aggregate (a "weekly close" on Wednesday) is reading rumor; its output is void.
- WHY IT MATTERS: Half of multi-timeframe malpractice is treating a forming weekly bar as a fact five times a week. Chapter 14 compiles against this card.
- STATUS: DRAFT

---

**V-7 — SHORT & MISSING BARS**

- RULE: A calendar day with no session produces no bar (never a zero-bar). A shortened session produces a bar flagged `bar.short = true`. Volume-graded rules stand down on short bars (consumed by CH 10); price rules run unmodified.
- CONFIRMATION: Exchange calendar declares the session absent or shortened.
- INVALIDATION: Imputed, interpolated, or zero-filled bars are not bars of record; anything computed across them re-computes without them.
- WHY IT MATTERS: A half-day's "low volume" is a calendar fact, not a market message. Rules that can't tell the difference will hear messages in holidays.
- STATUS: DRAFT

---

## BLOCK TWO — PRIMITIVE EVENTS

*What a single bar can do to a reference price. Composite events (confirmation sequences, rejects, gaps, fakeouts) are built from these in Chapters 2, 3, 8, 9.*

---

**V-8 — THE PRIME AXIOM (NO-PARTIAL LAW)**

- RULE: No rule evaluates before t_close of the bar of record. Intrabar values of any series (price or indicator) are rumor; no event exists, no verdict is born, no verdict dies, intrabar.
- CONFIRMATION: t_close passes → the bar's events are readable.
- INVALIDATION: Any rule reading a forming bar is malformed. (Exception class NONE in this book; alert/execution mechanics are the publisher's domain, outside the rulebook.)
- WHY IT MATTERS: Every intrabar "break" that closes back inside was, for a few minutes, a fact on somebody's screen. The close is where the market stops arguing with itself.
- STATUS: DRAFT

---

**V-9 — TAG**

- RULE: Bar B tags reference price P iff L ≤ P ≤ H, where P may be widened to a zone (V-17): L ≤ P + z_hi and H ≥ P − z_lo. A tag is contact, not opinion: it carries no direction and produces no verdict.
- CONFIRMATION: The inequality holds at t_close (per V-8, judged on the completed bar).
- INVALIDATION: n/a — a tag is a fact of the completed bar; it cannot be voided, only superseded by later events.
- WHY IT MATTERS: Touch-counting (level quality, third tests, trendline validation) requires a touch to be one exact thing. "Came close" is not in this book's vocabulary — the zone machinery (V-17) is how *close enough* is made exact instead.
- STATUS: DRAFT

---

**V-10 — CLOSE BEYOND**

- RULE **[restated per C1]**: Bar B closes beyond reference price P in the declared scale form — **PCT:** upward iff `100 × ln(C / P) ≥ pen.min` (equivalently `C ≥ P × exp(pen.min / 100)`); downward iff `100 × ln(C / P) ≤ −pen.min`. **VOLU:** upward iff `(C − P) / ATR_ref ≥ pen.min`; downward iff `(C − P) / ATR_ref ≤ −pen.min`, with `ATR_ref` = ATR at bar B unless the consuming rule declares otherwise. `pen.min ≥ 0` is the minimum-penetration filter in the rule's `scale.mode` unit (may be zero; `pen.min = 0` reduces both forms to C beyond P). CLOSE ABOVE / CLOSE BELOW name the two directions. One close beyond is a **claim**, never a verdict (composition into confirmation is CH 3's law). The arithmetic form `C > P × (1 + pen.min)` is retired: it approximates the PCT form only for small values, and "approximately" is where two strangers diverge.
- CONFIRMATION: The inequality holds at t_close.
- INVALIDATION: n/a at this level — claims are voided or confirmed by the sequences defined in CH 3.
- WHY IT MATTERS: The classical penetration filters (E&M's 3%, Murphy's 1–3% and two-day close) are all instances of this one event with different `pen.min`. Name the parameter once; argue about its value in testing, not in prose.
- STATUS: DRAFT

---

## BLOCK THREE — SWING MACHINERY

*The confirmed swing is the load-bearing object of the entire book: trends, structure breaks, patterns, divergence, and multi-timeframe authority all compile against it. Method options follow; the publisher's bake-off picks defaults. Every option must publish its confirmation lag — a swing method that won't say when it knows is not a method.*

---

**V-11 — SWING CANDIDATE & CONFIRMED SWING**

- RULE: A **swing high** (low) is a bar whose H (L) is the local extreme under the declared method option `swing.method` ∈ {FRACTAL, REVERSAL, PIP}. Until the method's confirmation event occurs it is a **candidate**; after, a **confirmed swing**, immutable per V-14. Every swing carries (price, bar index, side, method, confirmation bar). Rules read confirmed swings only, unless a card explicitly declares candidate-reading (and then must say why).
- CONFIRMATION: The declared method's confirmation event (V-12/13/15, per option).
- INVALIDATION: A candidate that fails its method's condition before confirming simply never existed; nothing downstream fires.
- WHY IT MATTERS: The entire difference between a structure break and noise is which swing was real. Two strangers running the same method mark the same swings — that is the whole point of this block.
- STATUS: DRAFT

---

**V-12 — METHOD OPTION SW-F: N-BAR FRACTAL**

- RULE: Tie sub-option `swing.tie` ∈ {STRICT, LEFT}, each single-valued: under **STRICT**, bar i is a swing-high candidate iff H_i > H_j for all j ∈ [i−`swing.n`, i+`swing.n`], j ≠ i (any equal extreme in either flank kills the candidate). Under **LEFT** (ties resolve to the earliest bar), the comparison is per-flank: H_i > H_j for j ∈ [i−`swing.n`, i−1] (strict against the left flank) **and** H_i ≥ H_j for j ∈ [i+1, i+`swing.n`] (equal-tolerant against the right) — the earliest bar of any tie group is the unique candidate, because every later tied bar fails strict-> against the equal bar on its own left flank. Swing low: mirror on L. **[C-R5-1]** The per-flank inequalities previously ran the other way (≥ left, > right), which selects the *latest* tied bar and contradicts this card's own prose; the loop's tie fixture caught it in compilation, and the inequalities are now matched to the stated intent.
- CONFIRMATION: At t_close of bar i + `swing.n`. **Lag: exactly `swing.n` bars — fixed and known in advance.**
- INVALIDATION: Under LEFT, a strictly higher H (strictly lower L) inside the right flank before confirmation kills the candidate — an equal extreme does not (the tie resolves to the earlier bar, which is the candidate). Under STRICT, an equal-or-higher H (equal-or-lower L) kills it.
- WHY IT MATTERS: The oldest definition in the field (Williams' fractal generalized), and the only option with constant lag. Its cost: it knows nothing about *size* — a 0.2-ATR wiggle and a 4-ATR reversal both qualify. Size-blindness is what SW-R fixes.
- STATUS: DRAFT

---

**V-13 — METHOD OPTION SW-R: REVERSAL THRESHOLD (ZIGZAG FAMILY)**

- RULE: State machine. After a confirmed swing low, track the running extreme `ext` = max H since it (and `ext_bar`). At each t_close compute the counter-move from ext to x, where x = C if `swing.basis` = CLOSE, else the adverse extreme (L for highs). The candidate at `ext_bar` confirms as a swing high when the counter-move ≥ threshold: **PCT variant** `100 × ln(ext / x) ≥ swing.revPct`; **VOLU variant** `(ext − x) / ATR(ext_bar) ≥ swing.revAtr`. Mirror for lows. (The academic directional-change algorithm is this card with `swing.basis` = CLOSE.)
- CONFIRMATION: The threshold inequality first holds at a t_close. **Lag: variable — publish it per instance (t_confirm − ext_bar).**
- INVALIDATION: A new extreme beyond `ext` before confirmation moves the candidate to the new bar; the old candidate never existed.
- WHY IT MATTERS: Sees size, ignores time — the mirror image of SW-F. VOLU variant is the Scale Law applied to structure itself: the same rule reads a sleepy utility and a crypto pair without editing thresholds.
- STATUS: DRAFT

---

**V-14 — THE REPAINT PROHIBITION**

- RULE: A method is admissible in this book only if its confirmed outputs are immutable: once confirmed, a swing (or any derived object) never moves, vanishes, or re-labels when later data arrives. Methods that revise confirmed history — full-series smoothers, centered averages, globally re-fit extrema — are barred from rules unless restated in a frozen rolling form with the freeze declared.
- CONFIRMATION: Method demonstrates, on any data extension, that confirmed outputs are byte-identical.
- INVALIDATION: One confirmed output that changes under data extension bars the method book-wide.
- WHY IT MATTERS: A rule that repaints back-tests like a genius and trades like a coin flip. This card is why the beautiful academic smoothers (V-15's ancestors) enter the book in handcuffs.
- STATUS: DRAFT

---

**V-15 — METHOD OPTION SW-P: PERCEPTUAL KEY POINTS (PIP / KERNEL EXTREMA)**

- RULE: Over a rolling window of `swing.window` bars ending at the current close, select `swing.k` key points iteratively: endpoints first, then repeatedly the bar with maximum distance (in `scale.mode` units, `swing.pipMetric` = perpendicular or vertical) from the chord between its neighbors, stopping at `swing.k` points or when max distance < `swing.minDist`. Points confirmed only when they exit the window's right-edge buffer of `swing.freeze` bars (the frozen form demanded by V-14). Ancestor: Lo–Mamaysky–Wang's kernel-smoothed extrema; admissible only in this frozen rolling restatement.
- CONFIRMATION: Point stands selected for `swing.freeze` consecutive closes. **Lag: `swing.freeze` bars, fixed.**
- INVALIDATION: Selection changes within the freeze buffer → prior selection never existed.
- WHY IT MATTERS: Closest to how a trained eye actually reads a chart, and the ancestor of the academic proof that pattern-reading can be formalized at all. Also the most machinery — which is exactly why it must be one option among three, not the default by fiat.
- STATUS: DRAFT

---

**V-16 — SWING OF RECORD & SWING DEGREE**

- RULE: The **swing of record** for a rule = the most recent confirmed swing of the declared side, method, and degree on the timeframe of record. **Degree** is recursive: degree-1 swings come from the method option applied to bars; degree-(d+1) swings come from the same method applied to the alternating sequence of degree-d swing prices. `swing.degree` is a named parameter of any rule that reads structure.
- CONFIRMATION: Inherited from the method option at each degree.
- INVALIDATION: Inherited; a voided lower-degree swing recomputes the higher degrees built on it (permitted — candidates only; confirmed higher-degree swings obey V-14).
- WHY IT MATTERS: "Break of structure" (CH 6) means nothing until the book can say *which* swing. Degree is how the same grammar reads a pullback and a bear market without new vocabulary.
- STATUS: DRAFT

---

## BLOCK FOUR — LEVELS, VERDICTS, AND THE NAMES OF THINGS

---

**V-17 — LEVEL & ZONE**

- RULE: A **horizontal level** is an object (price, birth event, touch list, state) with state ∈ {ACTIVE, BROKEN, FLIPPED, RETIRED}; birth, tests, transitions, and retirement are CH 4's law — this card only fixes the object and its states. A **zone** is a level plus a tolerance band of width `zone.width`, expressed in `scale.mode` units; all tags and closes-beyond against a level are judged against its zone edges. Width-sizing method options are CH 4's. **[C3, stub]** Effective width is floored at `zone.tickFloor` minimum price increments — `width_eff = max(width, zone.tickFloor × tick)` — so zones on degenerate (sub-$1 / penny) instruments never collapse below markability. Out of scope for the v1 calibration class; the parameter exists now so CH 4 and CH 15 inherit it.
- CONFIRMATION: Birth event per CH 4 instantiates; state transitions per CH 4.
- INVALIDATION: Per CH 4 (retirement); a level with no recorded birth event is not a level.
- WHY IT MATTERS: Prices are lines in a book and areas on a tape. The zone is how "close enough" and "decisively through" stop being feelings (V-9, V-10 both read zone edges).
- STATUS: DRAFT

---

**V-18 — DIAGONAL & CHANNEL**

- RULE: A **diagonal** (trendline) is the line through two anchor prices at two confirmed swings of the same side, anchored on `diag.anchor` ∈ {WICK, CLOSE}; its value at bar t is a reference price like any other (taggable per V-9, closable-beyond per V-10). Its slope is stated in `scale.mode` units per bar. A **channel** is a diagonal plus its parallel through the opposite side's anchor. Validation (third touch), slope limits, redraw law, and breaks are CH 5's.
- CONFIRMATION: Two qualifying confirmed swings exist → the diagonal exists as a *proposed* object (CH 5 promotes it).
- INVALIDATION: Either anchor swing voided before confirmation (possible only pre-confirmation, per V-14) → the line never existed.
- WHY IT MATTERS: A trendline is just a level that moves; saying so in the vocabulary lets every level rule in CH 4 be cited, not rewritten, in CH 5.
- STATUS: DRAFT

---

**V-19 — DYNAMIC LEVEL**

- RULE: A dynamic level is an indicator series (e.g., a moving average, construction owned by CH 11) declared by a rule to serve as a reference price. Its value at each t_close is a reference price per V-9/V-10. Which series may serve, and when (regime gates), is owned by CH 11 and CH 13; behavior *at* any level, dynamic included, is owned by CH 4.
- CONFIRMATION: The declaring rule names the series and its parameters.
- INVALIDATION: An undeclared series used as a level ("price bounced off the 50" without the 50 being any rule's declared reference) is prose, not analysis.
- WHY IT MATTERS: The moving-average bounce is real and tradable exactly as often as it is defined in advance — which is the difference between a level and a coincidence with a fan club.
- STATUS: DRAFT

---

**V-20 — SUPPORT & RESISTANCE BY POSITION; ROLE FLIP**

- RULE: At any t_close, a level below C is **support**; above C is **resistance**. Position, not history, assigns the role. **Role flip** is the term for a BROKEN level whose role has inverted and been confirmed on retest — the confirming machinery is CH 4/CH 9's; this card only fixes that *flip is an event with a confirmation*, never an assumption.
- CONFIRMATION: Position test at t_close (role); CH 4's flip confirmation (flip).
- INVALIDATION: A level equal to C (inside its zone) has no role until the next close outside the zone.
- WHY IT MATTERS: "Old resistance becomes support" is the field's most-quoted line and most-assumed non-event. The vocabulary makes the flip a claim requiring proof, which CH 9's failed-retest cards will spend.
- STATUS: DRAFT

---

**V-21 — THE VERDICT OBJECT**

- RULE: A verdict is the object {subject_type ∈ {LEVEL, STRUCTURE, INSTRUMENT}, subject_id, direction ∈ {BULLISH, BEARISH, NEUTRAL}, tf_of_record, born_event, void_event, expiry_clock}. A verdict exists only as the output of a rule card, and only with **all seven fields present**. Anything missing a field is not a verdict; it is noise with vocabulary. **[C2]** `expiry_clock` admits a positive bar count **or the sentinel `EVENT_ONLY`** — the verdict dies solely on its `void_event`. EVENT_ONLY is legal only where the producing card shows its void_event is structural and decidable on every future bar (a trend is in force until reversed — Rhea's law, kept); claim-type verdicts must carry finite clocks. The full admissibility rule is The Contract's verdict law (T-8).
- CONFIRMATION: The producing rule's CONFIRMATION event fires → verdict born, fields stamped.
- INVALIDATION: The producing rule's INVALIDATION event, **or** expiry of `expiry_clock` where finite — whichever first. Death is as recorded as birth.
- WHY IT MATTERS: A verdict without a TTL is an opinion with good posture. This one object is what CH 9 resets, CH 13 suspends, and CH 14 arbitrates — they become operations on a record instead of arguments about a mood.
- STATUS: DRAFT

---

**V-22 — THE ADJECTIVE BAN**

- RULE: BULLISH, BEARISH, NEUTRAL appear in this book only as values of a verdict's direction field. As free adjectives ("the chart looks bullish") they are banned from every card, every chapter, and every published analysis written under this book's name.
- CONFIRMATION: Editorial: text search returns the words only inside verdict contexts.
- INVALIDATION: One free adjective in a card fails the card at review.
- WHY IT MATTERS: Adjectives are how opinion smuggles itself into print wearing the book's uniform.
- STATUS: DRAFT

---

**V-23 — BREAKOUT / BREAKDOWN (CLAIM TERMS)**

- RULE: A **breakout** (breakdown) is a CLOSE ABOVE (BELOW) — V-10 — against a level's zone edge, on the timeframe of record. This is a **claim event**: the first close of CH 3's claim-then-confirm sequence. It carries no verdict by itself. **Break of structure** is the same claim event where the reference is the swing of record's price (V-16) instead of a level.
- CONFIRMATION: V-10's inequality at t_close against the declared reference.
- INVALIDATION: Composition (confirm vs. void) is entirely CH 3's; the claim itself is a fact of the bar.
- WHY IT MATTERS: One word ("breakout") currently means five different things in the field — intrabar poke, close, confirmed close, retest-held, running. This book spends five words so each thing has one.
- STATUS: DRAFT

---

**V-24 — RETEST · HOLD · FAIL · FAKEOUT (TERMS)**

- RULE: After a confirmed break of reference P: a **retest** is the first TAG of P's zone within `retest.clock` bars. A retest **holds** if it is followed by a CLOSE BEYOND in the break's direction (from the zone, away) within `retest.confirmClock`; it **fails** on a CLOSE BEYOND back through P against the break. A **fakeout** is a claim (V-23) followed by a close back inside the reference zone within `fake.clock` bars **before** confirmation — a break that died as a claim. Full machinery, verdict resets, and the opposite-direction setups are CH 9's.
- CONFIRMATION: Each term's defining close/tag event at t_close.
- INVALIDATION: Clock expiry without the defining event → the term never applied (no retest happened; the claim simply expired per CH 3).
- WHY IT MATTERS: The aftermath is where accounts are made and destroyed, and it is currently narrated in synonyms. Four terms, four clocks, no synonyms.
- STATUS: DRAFT

---

## BLOCK FIVE — MEASUREMENT UNITS

---

**V-25 — TRUE RANGE & ATR (THE VOLATILITY UNIT)**

- RULE: `TR_t = max(H_t − L_t, |H_t − C_{t−1}|, |L_t − C_{t−1}|)`. `ATR` is Wilder-smoothed TR over `atr.len`: seed `ATR_n = (1/n) Σ TR_{1..n}`, then `ATR_t = (ATR_{t−1} × (n−1) + TR_t) / n`. ATR is computed on the series of record and is this book's volatility unit (denominator of every VOLU distance, V-3).
- CONFIRMATION: Computable from bar `atr.len + 1` of the series onward.
- INVALIDATION: ATR spanning a split under SPLIT_ONLY adjustment re-seeds at the split (the gap is administrative, not volatility). Ex-dividend TRs under SPLIT_ONLY are flagged per V-5.
- WHY IT MATTERS: Wilder's formula, from the primary source, exactly — because "about 14 bars of average range" is how two strangers get two rulers.
- STATUS: DRAFT

---

**V-26 — DISTANCE (PCT & VOLU FORMS)**

- RULE: PCT distance: `d = 100 × ln(P₂ / P₁)` (signed; additive across consecutive bars: d(A→C) = d(A→B) + d(B→C)). VOLU distance: `d = (P₂ − P₁) / ATR_ref`, where `ATR_ref` is ATR at the bar declared by the consuming rule (default: the earlier of the two prices' bars). Every card states which form it uses (V-3).
- CONFIRMATION: Both prices exist on the series of record.
- INVALIDATION: A distance mixing forms, or crossing an adjustment boundary without re-seeding (V-25), is void.
- WHY IT MATTERS: Additivity is why log-percent: a +10 then −10 round trip nets zero, as arithmetic percent does not. The units are boring so nothing downstream has to be.
- STATUS: DRAFT

---

**V-27 — SLOPE**

- RULE: The slope of any line through prices (P_a, bar a) and (P_b, bar b), b > a: `slope = d(P_a → P_b) / (b − a)` in the declared unit per bar (d per V-26). Slope limits, wherever a chapter imposes them (CH 5's steepness bounds), are expressed in unit-per-bar, never degrees.
- CONFIRMATION: Both anchors confirmed (per the object's own law, e.g., V-18).
- INVALIDATION: Degree-denominated or visually-judged slope conditions are malformed (V-3).
- WHY IT MATTERS: The steepness of a line should not change when you resize the window. In degrees it does; in unit-per-bar it cannot.
- STATUS: DRAFT

---

**V-28 — CLOCKS & LOOKBACKS**

- RULE: Every clock in this book counts **closed bars of the timeframe of record**, starting at the bar after the triggering event, and is a named parameter (`*.clock`). Every lookback (`*.lookback`, `*.len`) counts closed bars ending at the current bar. No clock or lookback appears as an inline number in any card.
- CONFIRMATION: Each firing rule stamps its clock start bar.
- INVALIDATION: Expiry (clock reaches its parameter value without the awaited event) is itself an event — "expired unconfirmed" — consumed by CH 3.
- WHY IT MATTERS: "Soon," "recently," and "a while" are how discretion re-enters a mechanical book through the service door.
- STATUS: DRAFT

---

## PARAMETER REGISTRY ENTRIES (introduced by this chapter)

| Parameter | Domain | Card | Proposed test range |
|---|---|---|---|
| `bar.tf` | timeframe id | V-1 | D (v1 floor), W, M |
| `bar.session` | RTH · ETH · FULL24 | V-1 | RTH (equities) — publisher confirm |
| `bar.tz` | exchange tz | V-1 | per listing |
| `bar.adjust` | SPLIT_ONLY · TOTAL_RETURN | V-5 | SPLIT_ONLY provisional |
| `bar.revClock` | bars | V-4 | 1–3 (daily equities; C4 testing target) |
| `pen.min` | scale units ≥ 0 | V-10 | PCT: 0–3.0 · VOLU: 0–0.5 |
| `swing.method` | FRACTAL · REVERSAL · PIP | V-11 | bake-off (publisher fixtures) |
| `swing.n` | int ≥ 1 | V-12 | 2–5 |
| `swing.tie` | STRICT · LEFT | V-12 | both |
| `swing.basis` | CLOSE · HL | V-13 | both |
| `swing.revPct` | log-% > 0 | V-13 | 1.0–10.0 (class-dependent) |
| `swing.revAtr` | ATR mult > 0 | V-13 | 1.0–3.0 |
| `swing.window`, `swing.k`, `swing.minDist`, `swing.freeze`, `swing.pipMetric` | per V-15 | V-15 | second-wave testing |
| `swing.degree` | int ≥ 1 | V-16 | 1–2 |
| `zone.width` | scale units ≥ 0 | V-17 | CH 4 owns options |
| `zone.tickFloor` | min-price-increments ≥ 0 | V-17 | stub (C3); builds with CH 15 |
| `diag.anchor` | WICK · CLOSE | V-18 | both |
| `retest.clock`, `retest.confirmClock`, `fake.clock` | bars | V-24 | CH 9 owns ranges |
| `atr.len` | int ≥ 2 | V-25 | 10–30 |
| `scale.mode` | PCT · VOLU | V-3 | per rule |

---

## SOURCES

Wilder 1978 (TR/ATR exact formulas; the smoothing) · Edwards, Magee & Bassetti and Murphy (penetration filters unified into `pen.min`; role-flip doctrine) · Rhea (close-as-truth lineage) · Kirkpatrick & Dahlquist ch. 11 (chart construction as prerequisite; scale treatment) · Lo, Mamaysky & Wang 2000 (kernel extrema — ancestor of SW-P; feasibility of formal swings) · Brooks (bar-event discipline motivating Block Two's minimalism) · Aronson (objectivity requirement behind V-14 and the Adjective Ban).

## OPEN QUESTIONS (for the publisher)

1. `bar.session` for the calibration class: confirm RTH. FX/crypto session templates deferred to CH 15 work.
2. V-5 provisional SPLIT_ONLY: confirm, and confirm the ex-date stand-down lands in CH 13's calendar rules.
3. The swing bake-off (V-12/13/15) is the highest-leverage test in the book — requested first when the loop stands up.
4. V-15's PIP variant ships with five parameters; if testing shows it never beats SW-R, I will move it to the graveyard myself.

*Chapter 1 v3 · 28 cards · all DRAFT (publisher-reviewed; C1–C4 and C-R5-1 applied). Compiled against: nothing (this is the root). Cited by: everything. — THE SCINTILLA RULEMAKER*

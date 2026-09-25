# CHAPTER 7 — RANGE RULES (R)

**THE SCINTILLA TRADING RULEBOOK · Chapter draft · v2** (supersedes v1)
**STATUS: DRAFT** (all cards; promotion by publisher testing)
**v2 changelog (PUBLISHER-REVIEW-R4):** R4-R-3 — NO maximum range height in v1: the episode-within-`formLookback` requirement already bounds a range in time, which is the honest constraint; `range.maxHeight` joins only if the loop shows tall ranges polluting the class. R4-R-4 — overlapping ranges PERMITTED in v1: each range pairs its own levels; where NMZ bands overlap, the strictest governs; revisit only if the loop shows double-counting in the touch accounting. Both open questions RESOLVED in place. No card mechanics touched.

SUMMARY: The market's second state, given the same dignity as the first. Range birth through two doorways (the post-trend pause hardening, and de-novo EQ clustering), boundaries that *are* level objects, the forbidden middle, maturity as measured odds, death by confirmed break or by quiet dissolution, and the failed range break — the event Chapter 9 will spend as its best trap.

Compiles against: Chapters 1–6. Cited by: 8, 9, 12, 13.

---

## BLOCK ONE — BIRTH

---

**R-1 — RANGE BIRTH (TWO DOORWAYS)**

- RULE: A **range** is born at the first t_close where, within the trailing `range.formLookback` bars: (a) two horizontal references exist — an upper and a lower — each with ≥ `range.minTouches` defended test episodes (L-5) inside the window; (b) no C-2 confirmed break through either occurred inside the window; (c) the height `d(lower → upper)` ≥ `range.minHeight` (scale units — below it the congestion is noise, and no range exists). The two references may arise by either doorway: **STRUCTURE-DOORWAY** — an S-10 PAUSE annotation or an EQ-dominated sequence (S-2) whose EQ-run extremes birthed levels via L-1; or **DE-NOVO** — pre-existing CH 4 levels accumulating the episode evidence without any prior trend. The range object stamps {upper ref id, lower ref id, height, birth bar, doorway}.
- CONFIRMATION: Conditions (a)–(c) jointly true at a t_close.
- INVALIDATION: A birth read from a window containing a confirmed boundary break, or from references short of the episode minimum, is void — no range existed.
- WHY IT WORKS: A range is the auction agreeing on value twice — once at each extreme — and repeatedly. Two defended prices with traffic between them is that agreement made countable; one touch each is just a rectangle drawn in hope.
- STATUS: DRAFT

---

**R-2 — BOUNDARIES ARE LEVELS (ONE LEDGER)**

- RULE: The range's boundaries **are** the two level objects — the S-6 pattern repeated: same ledger, same zones (L-4, tick-floored), same episode histories, same attempt counters (C-11), same state machine (L-8/L-9/L-10). The range adds only pairing semantics: membership of a live range annotates both levels, and range-level events (R-5, R-6, R-7) are computed from the paired ledgers. Nothing about boundary behavior is restated here.
- CONFIRMATION: The pairing annotation at birth.
- INVALIDATION: A range citing a reference that is not a live CH 4 level object is malformed.
- WHY IT WORKS: One object, one ledger — the same discipline that made the structure floor a level (S-6) makes the range a pair of them. The book never holds two records of the same price.
- STATUS: DRAFT

---

## BLOCK TWO — THE INTERIOR

---

**R-3 — NO-MAN'S-LAND**

- RULE: The interior band spanning the central `range.nmzFrac` of the range's height (measured between the two zones' inner edges) is **no-man's-land** while the range lives. Inside it: no positional verdict may fire; no level may be born (L-1/L-2 births are suppressed within the band — clutter control); and Chapter E anatomy events carry zero grade weight (a beautiful engulf mid-range grades nothing). Prices in NMZ have exactly one meaning: the auction is in transit.
- CONFIRMATION: Band computable at every t_close of a live range.
- INVALIDATION: Any verdict whose born_event occurred inside NMZ is void ab initio.
- WHY IT WORKS: The middle of a range is where both sides agree price is neither cheap nor dear — the one place on the chart where nothing is defended, so nothing means anything. Forbidding rules there is the cheapest discipline in the book.
- STATUS: DRAFT

---

**R-4 — BOUNDARY DEFENSE CLASSES**

- RULE: Every boundary episode records its **defense class**: **DEFENDED** (L-5 episode, close held the role side) · **REJECT-DEFENDED** (defended with an E-4 reject in the episode — the premium class, grade weight above plain defense) · **VOID-DEFENSE** (a C-3 void at the boundary — an attacker's claim died; per C's deposit, this traps and carries trap weight for R-7/CH 9) · **EXPIRY-DEFENSE** (a C-6 expiry — the attack merely lapsed; the lightest class). Classes are graders' inputs (C-10 discipline) and maturity's raw material (R-5); they gate nothing.
- CONFIRMATION: Each class is stamped by its defining C/E/L event at t_close.
- INVALIDATION: An episode carrying two classes, or a class assigned without its defining event, corrupts the ledger.
- WHY IT WORKS: "The level held" hides four different facts — nobody came, they came and were refused, they broke through and were thrown back, they poked and gave up. Downstream odds differ across all four, so the book refuses to spell them the same way.
- STATUS: DRAFT

---

**R-5 — MATURITY**

- RULE: A range is **MATURE** when total defended-family episodes (DEFENDED + REJECT-DEFENDED) across both boundaries ≥ `range.matEpisodes`, with ≥ 1 on each side, all after birth. Maturity is an annotation with an honesty table behind it: `range.matOdds` — measured break-versus-fade odds at boundary tests, by maturity count and defense-class mix, filled by the loop on the calibration class. Maturity gates nothing; it grades boundary events for every consumer (CH 8 entries, CH 9 traps, CH 12's rectangle alias).
- CONFIRMATION: The episode count at t_close.
- INVALIDATION: Maturity read across a boundary break (episodes from a prior life of the range) is void — the count restarts at rebirth, never carries.
- WHY IT WORKS: An old range is a proven auction: both extremes tested, both defended, repeatedly — the classical claim that mature ranges "mean more" is real exactly insofar as the odds table says so, which is why the table ships with the chapter.
- STATUS: DRAFT

---

## BLOCK THREE — DEATH AND ITS FAILURES

---

**R-6 — RANGE DEATH (BREAK AND DISSOLUTION)**

- RULE: A range dies exactly two ways. **BREAK-DEATH:** a C-2 confirmed break through either boundary — the range stamps DEAD(break, boundary, direction); the broken boundary runs L-8/L-9; the surviving boundary lives on as an ordinary level; the break enters CH 8's assembled chain as reference-type RANGE-BOUNDARY carrying the range's maturity and defense-class record as evidence (deposit). **DISSOLUTION:** `range.dissolveBars` pass with no boundary episode on either side — the range stamps DEAD(dissolved); both boundaries proceed under L-10's ordinary staleness clocks; no directional event of any kind is implied.
- CONFIRMATION: The C-2 event, or the bar count, at t_close.
- INVALIDATION: A range declared dead on an unconfirmed claim (C-1 only) is a false death; the range stands and the claim resolves under C-machinery.
- WHY IT WORKS: Ranges end loudly or they end quietly, and the two endings mean opposite things — one is the auction re-pricing, the other is the auction losing interest. A book that only knows the loud ending will trade ghosts in the quiet one.
- STATUS: DRAFT

---

**R-7 — THE FAILED RANGE BREAK (LOADED-OPPOSITE)**

- RULE: A **failed range break** = a C-3 void at a boundary of a live range (the attacker's claim closed back inside before confirming). The event stamps **LOADED-OPPOSITE(boundary)** — an evidence annotation, never a verdict — with its honesty table `range.failLoadOdds`: the measured probability that the next boundary event occurs at the *opposite* boundary, by maturity and defense-class context, loop-filled. The named special cases at range boundaries — **spring** (failed downside break) and **upthrust** (failed upside break) — are *these events*; their full setup cards (trigger, entry, invalidation, objective) are Chapter 9's, built on this stamp (deposit honored; Pruden's machinery arrives there).
- CONFIRMATION: The C-3 void at a live range's boundary.
- INVALIDATION: A LOADED-OPPOSITE read from an EXPIRY-DEFENSE (C-6) is malformed — expiry bores, it does not trap (R-4's classes exist precisely for this).
- WHY IT WORKS: The failed break is the range's cruelest event: the breakout crowd is inventoried at the extreme, wrong, and their exit is through the entire range — which is why the move it loads is toward the far side. The book measures the claim instead of romanticizing it.
- STATUS: DRAFT

---

**R-8 — PRE-BREAK CONTEXT AT BOUNDARIES**

- RULE: Compression evidence near a boundary — an E-7 event or an inside-bar chain (E-5) whose bars sit within the boundary's zone-adjacent band (outside NMZ) and within `sqz.clock` of a boundary episode — stamps **COILED(boundary)**: pre-break context evidence for CH 8's chain (deposit). Compression *inside* NMZ stamps nothing (R-3). This card only routes Chapter E facts to their consumer; it defines no new event.
- CONFIRMATION: The E-event plus position test at t_close.
- INVALIDATION: COILED read from NMZ-interior compression is void.
- WHY IT WORKS: Contraction against a defended price is the auction narrowing its argument at the exact spot where the argument matters — the mechanical content of "pressure at the boundary," routed to the chapter that spends it.
- STATUS: DRAFT

---

**R-9 — REBIRTH AND THE RECTANGLE ALIAS**

- RULE: After BREAK-DEATH, a new range over the same ground requires a fresh R-1 birth — full episode evidence, fresh counts; nothing inherits (the anti-zombie rule). After DISSOLUTION, likewise. The **rectangle**: Chapter 12 will alias the classical rectangle pattern to *a mature range under this chapter's machinery* — no duplicate pattern machinery exists; the pattern chapter adds only its measured-objective parameterization and honesty statistics (deposit, per the assessment's §7.9 ruling).
- CONFIRMATION: Fresh R-1 conditions for rebirth.
- INVALIDATION: A "range" citing pre-death episodes is a stale pointer; all reads from it are void.
- WHY IT WORKS: Markets revisit old battlegrounds, but the armies are new — carrying dead counts into a new range is how analysts see maturity that isn't there. And the rectangle alias is the book keeping its one-machinery promise: a pattern that is a range gets the range's rules, not a costume.
- STATUS: DRAFT

---

## PARAMETER REGISTRY ENTRIES (introduced by this chapter)

| Parameter | Domain | Card | Proposed test range |
|---|---|---|---|
| `range.formLookback` | bars | R-1 | 20–60 |
| `range.minTouches` | int ≥ 2 (episodes/side) | R-1 | 2–3 |
| `range.minHeight` | scale units > 0 | R-1 | PCT 2–6 · VOLU 1.5–4 |
| `range.nmzFrac` | 0–1 | R-3 | 0.3–0.5 |
| `range.matEpisodes` | int ≥ 3 | R-5 | 4–6 |
| `range.matOdds` | honesty table | R-5 | loop-filled |
| `range.dissolveBars` | bars | R-6 | 15–40 |
| `range.failLoadOdds` | honesty table | R-7 | loop-filled |

## SOURCES

Edwards, Magee & Bassetti (rectangles; the classical break-and-return doctrine) · Murphy (trading ranges; the failed-break lesson) · Brooks (*Trading Ranges* — the middle-is-nothing discipline, R-3's ancestry; failed breakouts as premium setups) · Pruden (springs and upthrusts — named here, carded in CH 9) · Bulkowski (rectangle statistics — the honesty tables' seed; break-vs-fade base rates) · Grimes (failure-test evidence).

## OPEN-DEPOSITS (claims on later chapters)

**To CH 8 (Breakouts):** RANGE-BOUNDARY as a chain reference type carrying maturity + defense-class evidence; COILED as pre-break context; range-height as the measured-objective base for boundary breaks (the §L rectangle projection).
**To CH 9 (Aftermath):** the LOADED-OPPOSITE stamp is the spring/upthrust trigger context — CH 9 writes the full setup cards on it; defense-class weights (VOID-DEFENSE traps vs EXPIRY-DEFENSE bores) carry into fakeout base-rate tables.
**To CH 12 (Patterns):** the rectangle alias (R-9); triangle family boundaries may reuse R-4's defense classes where their boundaries are diagonals (argued there, machinery from D-4/L-12).
**To CH 13 (Regime):** a live range object is the RANGING regime's detector input (S's deposit completed: TRENDING = S-4 live · RANGING = R-object live · TRANSITIONAL = neither/S-5); dissolution feeds the unclear-regime default (X-1).
**To CH 10 (Volume):** defense-class volume signatures (does VOID-DEFENSE carry climax volume?) join R-4 as graders on landing.

## OPEN QUESTIONS — RESOLVED (PUBLISHER-REVIEW-R4)

1. ~~Maximum range height?~~ **RESOLVED (R4-R-3): NO cap in v1.** The episode-within-`formLookback` requirement already bounds a range in time — the honest constraint; a pure height cap would be an arbitrary number. `range.maxHeight` is added only if the data demands it.
2. ~~Overlapping ranges?~~ **RESOLVED (R4-R-4): coexistence PERMITTED, strictest NMZ wins.** Single-range-per-tf would force the book to discard real structure (a broad range genuinely can contain a tighter one). Revisit only if the loop shows double-counting in the touch accounting.

*Chapter 7 v2 · 9 cards · DRAFT · review_ref: PUBLISHER-REVIEW-R4. Compiled against: Chapters 1–6. The geometry layer closes here: level, diagonal, channel, range — every container defined, one behavior machinery under all of them. — THE SCINTILLA RULEMAKER*

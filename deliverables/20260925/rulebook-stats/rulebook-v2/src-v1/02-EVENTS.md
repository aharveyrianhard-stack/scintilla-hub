# CHAPTER 2 — BAR, CANDLE & GAP EVENTS (E)

**THE SCINTILLA TRADING RULEBOOK · Chapter draft · v3**
**STATUS: DRAFT** (all cards; promotion by publisher testing)
**v3 changelog (Sprint 4 — the backfill, cashed):** the gap-taxonomy IOU is paid. E-10 promotes from SKELETON to the classification law; E-11…E-14 publish the four classes (COMMON, BREAKAWAY, CONTINUATION, EXHAUSTION) from the pre-drafted separators, now legally reading CH 4 ACTIVE levels and CH 6 structure verdicts (T-5 satisfied — this is the spiral's first completed revolution). Two parameters added (`gap.ctxLookback`, `gap.exhClock`). Volume-grade upgrades remain CH 10 deposits. v2 changelog retained below.
**v2 changelog (per PUBLISHER-REVIEW-R2):** E-8 notes the admitted `bar.earnings` flag (R-2: flag now, semantics with CH 13; v1 behavior unchanged) · both open questions resolved in place (R-2 admit-and-defer; R-4 keep the E-4 evidentiary split).

SUMMARY: The measurable few-bar events every later chapter leans on: bar anatomy quantified, the reject with math, the two-bar events, compression, and gap mechanics. E-1 through E-9 are computable from the series of record and Chapter 1 alone — no levels, no trends, no volume. E-10 through E-14 (the gap taxonomy) entered by sanctioned backfill in v3, reading CH 4's ACTIVE levels and CH 6's structure verdicts under T-5/T-12 — classification in two stages: position at the gap bar, fill behavior at the clock.

**Scope note (the refusal, made law by T-11):** the named candlestick zoo is excluded. The primitives below are the surviving alphabet; anything the zoo can say mechanically, these can say with parameters. Bulkowski's candlestick statistics are the evidence file.

---

## BLOCK ONE — BAR ANATOMY

---

**E-1 — ANATOMY QUANTITIES (AND THE DEGENERATE-BAR GUARD)**

- RULE: For bar t with range `R = H − L`: `body = |C − O|` · `bodyFrac = body / R` · `upperWickFrac = (H − max(O, C)) / R` · `lowerWickFrac = (min(O, C) − L) / R` · `closeLoc = (C − L) / R` (0 at the low, 1 at the high) · direction `dir = sign(C − O)` (+1, −1, or 0). If `R = 0` (or R < one min-price-increment), the bar is **ANATOMY-NULL**: no anatomy event fires on it, and it contributes no anatomy values to any lookback.
- CONFIRMATION: Computable at every t_close on any non-null bar of record.
- INVALIDATION: Anatomy read on an ANATOMY-NULL bar, or on a forming bar (V-8), is void.
- WHY IT MATTERS: Every event below is arithmetic on these five numbers. The null guard is the difference between a rulebook and a division-by-zero — two strangers must also agree on the bars where nothing can be said.
- STATUS: DRAFT

---

**E-2 — TREND BAR**

- RULE: Bar t is a **trend bar** (directional bar) iff `bodyFrac ≥ ebar.trendBodyFrac` AND (`dir = +1` AND `closeLoc ≥ ebar.trendCloseLoc`) for an up-trend bar, or (`dir = −1` AND `closeLoc ≤ 1 − ebar.trendCloseLoc`) for a down-trend bar.
- CONFIRMATION: The inequalities hold at t_close.
- INVALIDATION: n/a — an anatomy fact of the closed bar; superseded, never voided.
- WHY IT WORKS: A bar that opens near one extreme and closes near the other is one side holding control for the whole session; the trapped side is whoever faded it intrabar and now holds inventory the close disagrees with. Consumed downstream as an evidence grade (CH 3's C-10), never as a verdict.
- STATUS: DRAFT

---

**E-3 — NEUTRAL BAR**

- RULE: Bar t is a **neutral bar** iff `bodyFrac ≤ ebar.neutralBodyFrac`. (The doji family, collapsed to the one number that survives testing.)
- CONFIRMATION: The inequality holds at t_close.
- INVALIDATION: n/a — anatomy fact.
- WHY IT WORKS: Open and close agreeing is a session that settled nothing; neither side is trapped, which is exactly the information — at a level it reads as hesitation, mid-range it reads as nothing. Context chapters decide which; this card only supplies the fact.
- STATUS: DRAFT

---

**E-4 — REJECT (THE MATH THE VOCABULARY PROMISED)**

- RULE: Bar t **rejects downside** at reference zone Z (zone per V-17) iff bar t TAGS Z (V-9), `C` is above Z's upper edge, and the declared method option holds — mirror for upside rejection. Method options (`reject.method`):
  - **RJ-W (wick-fraction):** `lowerWickFrac ≥ reject.wickFrac`.
  - **RJ-C (close-location):** `closeLoc ≥ reject.closeLoc`.
  - **RJ-R (range-qualified):** RJ-W or RJ-C **and** `R ≥ reject.rangeAtr × ATR(atr.len)` — a reject on a dwarf bar is noise, so the bar must be of size.
- CONFIRMATION: Tag + close-position + the chosen option's inequality, all at t_close.
- INVALIDATION: n/a as an event; its *evidentiary* weight is voided if the next close re-enters Z (consumed by CH 3/CH 9 — the reject claimed the level held; a re-entry withdraws the claim).
- WHY IT WORKS: A long wick into a zone with a close back outside is entrants below who were refused — their exits fuel the move away. This is the pin-bar/hammer literature reduced to three inequalities that two strangers can compute.
- STATUS: DRAFT

---

## BLOCK TWO — TWO-BAR EVENTS

---

**E-5 — INSIDE BAR / OUTSIDE BAR**

- RULE: Bar t is an **inside bar** iff `H_t ≤ H_{t−1}` AND `L_t ≥ L_{t−1}` (sub-option `ebar.insideStrict`: both strict). Bar t is an **outside bar** iff `H_t ≥ H_{t−1}` AND `L_t ≤ L_{t−1}` with at least one strict. A bar equal on both extremes with `ebar.insideStrict = false` classifies as inside, never both.
- CONFIRMATION: The inequalities at t_close.
- INVALIDATION: n/a — anatomy facts.
- WHY IT WORKS: Inside = the market narrowed its argument (compression's smallest case — feeds E-7 and CH 7's range logic by deposit); outside = both sides stopped out at least once in one session (feeds CH 9's trap machinery by deposit). Brooks's framework runs substantially on these two.
- STATUS: DRAFT

---

**E-6 — ENGULFING CLOSE**

- RULE: Bar t is a **bullish engulf** of bar t−1 under the declared option (`ebar.engulfMode`) — bearish mirror throughout:
  - **EG-B (body-engulf):** `dir_t = +1`, `dir_{t−1} = −1`, `O_t ≤ min(O_{t−1}, C_{t−1})`, and `C_t ≥ max(O_{t−1}, C_{t−1})`.
  - **EG-R (range-close):** `C_t > H_{t−1}` (the close takes out the prior bar's extreme — Brooks's "buy-above" made a close event, per the prime axiom).
- CONFIRMATION: The chosen option's inequalities at t_close.
- INVALIDATION: n/a — anatomy fact; evidentiary weight withdrawn if the next close gives back the engulfed range (consumed by CH 9).
- WHY IT WORKS: One bar erasing the whole prior bar means everyone who acted on the prior bar's information is now wrong at the close; their unwinding is the follow-through the event predicts. The two options exist because the field genuinely splits here — testing picks.
- STATUS: DRAFT

---

## BLOCK THREE — COMPRESSION

---

**E-7 — COMPRESSION EVENTS**

- RULE: Method options (`sqz.method`), each firing at t_close:
  - **NR-n:** `R_t = min(R_{t−sqz.n+1} … R_t)` — the narrowest range of the last `sqz.n` bars (ties: the current bar still fires; the event is about *now* being minimal).
  - **ATR-FRACTION:** `R_t ≤ sqz.atrFrac × ATR(atr.len)`.
  - **DECLINING-MEAN:** `SMA(R, sqz.meanLen)` has made `sqz.declineCount` consecutive lower values through t.
- CONFIRMATION: The chosen option's condition at t_close.
- INVALIDATION: Expiry: a compression event's evidentiary window is `sqz.clock` bars; unconsumed, it lapses (no standing compression from last month).
- WHY IT WORKS: Contraction is positioning: both sides loading at closer and closer prices, which is the stored energy CH 8's "pre-break structure" spends. This card is that chapter's phrase "pressure building" made computable — deposited there for citation, defined here.
- STATUS: DRAFT

---

## BLOCK FOUR — GAP MECHANICS

---

**E-8 — GAP EVENT & GAP SIZE**

- RULE: Bar t opens a **gap up** iff `O_t > B_ref`, where `B_ref = H_{t−1}` under `gap.basis = RANGE` (full gap) or `B_ref = C_{t−1}` under `gap.basis = CLOSE` (partial gap) — gap down mirrored against `L_{t−1}` / `C_{t−1}`. Gap size = `d(B_ref → O_t)` in the rule's `scale.mode` (V-26). A gap event exists only if size ≥ `gap.minSize`. **Ex-dividend stand-down (ratified, T-9):** if `bar.exDiv = true`, no gap event fires on bar t. **[v2, R-2]** The contract now also carries the optional `bar.earnings` flag (T-9 v2); in v1 it changes nothing here — earnings-bar treatment is CH 13's deferred stand-down rule.
- CONFIRMATION: The open comparison at t_close of bar t (the prime axiom holds — the *event* is stamped when the bar completes, so a gap-and-reverse bar is one fact, not two rumors).
- INVALIDATION: A gap computed across an adjustment boundary or on an exDiv bar is void (V-5).
- WHY IT WORKS: A gap is the auction reopening away from where it closed — everyone holding overnight is repriced without a trade. The two bases exist because "gap" means both things in the literature (E&M's full gap; the common close-basis gap); naming the parameter ends the ambiguity.
- STATUS: DRAFT

---

**E-9 — GAP FILL & GAP SURVIVAL**

- RULE: A gap up from bar t is **FILLED** when a later bar TAGS `B_ref` (V-9, the pre-gap boundary) within `gap.fillClock` bars; it **SURVIVES** if the clock expires untagged. Partial progress is not fill: tag or nothing. The gap's two edges (`B_ref` and `O_t`) are recorded prices available to CH 4's level-birth machinery (deposited there; levels are CH 4's law, not this card's).
- CONFIRMATION: Tag of `B_ref` within the clock (FILLED) or clock expiry (SURVIVES).
- INVALIDATION: n/a — one of the two outcomes always occurs; the pair is exhaustive by construction.
- WHY IT WORKS: A filled gap says the repricing failed — the market went back for the inventory it skipped. A surviving gap says the repricing was accepted. Survival is the single most informative fact about a gap, and it is a pure clock-and-tag fact — which is why it lives here and classification doesn't.
- STATUS: DRAFT

---

**E-10 — GAP CLASSIFICATION (THE LAW) [v3 — promoted from stub]**

- RULE: Every gap event (E-8) receives **exactly one class** ∈ {COMMON, BREAKAWAY, CONTINUATION, EXHAUSTION} under precedence **BREAKAWAY > CONTINUATION > COMMON**, assigned **provisionally at the gap bar's t_close** (position facts are known then) and **finalized at the gap's E-9 resolution** (fill behavior is the only separator that needs time — E-14). Classification reads: the gap span `[B_ref, O_t]`, ACTIVE level zones (CH 4 objects), and the live structure verdict (S-4), all as of the gap bar's close. A class is an **evidence annotation** on the gap event — it grades (C-10 channel), it never verdicts (C-9).
- CONFIRMATION: Provisional class at the gap bar's t_close; final class at the E-9 FILLED/SURVIVES event.
- INVALIDATION: A class read before its stage (final class before E-9 resolves), or a gap carrying two classes at one stage, is malformed. Ex-div and adjustment-boundary exclusions inherit from E-8.
- WHY IT WORKS: The classical taxonomy was always four *positions in a story* — noise inside old ground, escape across a defended price, stride inside a trend, last gasp that gets taken back. The story is now three ledger lookups and a clock, which is what it always should have been.
- STATUS: DRAFT

---

**E-11 — COMMON GAP [v3]**

- RULE: Class = **COMMON** iff the gap span crosses **no ACTIVE level's zone** (CH 4 ledger, zones per L-4) **and** both edges lie inside `[min L, max H]` of the prior `gap.ctxLookback` bars. (Reached only when E-12 and E-13 both fail, per E-10's precedence.)
- CONFIRMATION: Both position tests at the gap bar's t_close.
- INVALIDATION: n/a — classification fact; superseded only by E-10's staged finalization.
- WHY IT WORKS: A gap that escapes nothing and enters nothing new is bookkeeping noise from the overnight auction — the class exists mostly so the other three mean something. Its measured fill rate (the classical claim: commons fill fast) belongs to the honesty ledger via E-9's clocks.
- STATUS: DRAFT

---

**E-12 — BREAKAWAY GAP [v3]**

- RULE: Class = **BREAKAWAY** iff the gap span **crosses ≥ 1 ACTIVE level's zone entirely** (both zone edges inside the span) and price had closed on one side of that zone for ≥ `gap.ctxLookback` consecutive bars before the gap. The crossed level registers a **crossing-without-test** (C-8 — its touch list gains nothing); the gap-borne claim, if the bar also closes beyond the zone, runs C-1/C-2 as usual. A breakaway class is break-quality evidence for CH 8's chain (deposit standing).
- CONFIRMATION: The span-crossing and prior-side tests at the gap bar's t_close.
- INVALIDATION: n/a — classification fact; the *suspect* case is E-14's FAILED-BREAKAWAY finalization.
- WHY IT WORKS: An auction that reopens on the far side of a defended price without trading through it has repriced past the defenders overnight — everyone at that level is trapped at once, which is why the classical literature calls this the most consequential gap. Whether it *stays* consequential is E-9's clock, not this card's opinion.
- STATUS: DRAFT

---

**E-13 — CONTINUATION GAP [v3]**

- RULE: Class = **CONTINUATION** iff a live S-4 structure verdict exists on the tf of record, the gap's direction matches the verdict's direction, and **neither edge of the span violates the structure floor/ceiling's zone** (S-6 object). (Evaluated only when E-12 fails, per precedence.)
- CONFIRMATION: The verdict lookup and floor test at the gap bar's t_close.
- INVALIDATION: n/a — classification fact; finalization may reclassify it (E-14).
- WHY IT WORKS: A gap in stride — the trend repricing *in its own direction* without threatening its own floor — is the crowd chasing, not escaping. The classical "measuring gap" folklore (it marks the middle) is a testable projection claim that belongs to CH 8's objective grammar, not to this card.
- STATUS: DRAFT

---

**E-14 — EXHAUSTION & FAILED-BREAKAWAY (THE FINALIZATION) [v3]**

- RULE: At the gap's E-9 resolution: a **CONTINUATION-provisional** gap that is **FILLED** within `gap.exhClock` bars finalizes as **EXHAUSTION** (the fill *is* the evidence — the stride that got taken back); one that SURVIVES finalizes as CONTINUATION. A **BREAKAWAY-provisional** gap FILLED within `gap.exhClock` keeps class BREAKAWAY but gains the **FAILED-BREAKAWAY** annotation — trap-context evidence for CH 9's fakeout machinery (deposit), kin to C-3's void but born from a gap. COMMON finalizes as COMMON regardless of fill. Volume-grade upgrades to any finalization (climax at exhaustion, relVol at breakaway) remain CH 10's backfill (deposit standing).
- CONFIRMATION: The E-9 FILLED/SURVIVES event against the `gap.exhClock` window.
- INVALIDATION: A finalization read before E-9 resolves, or an EXHAUSTION assigned without a live-trend provisional class, is malformed.
- WHY IT WORKS: Exhaustion and continuation are indistinguishable on the day they print — the classical books admit it — and become distinguishable only by whether the market takes the gap back. So the book classifies twice, on a clock, instead of guessing once, loudly.
- STATUS: DRAFT

---

## PARAMETER REGISTRY ENTRIES (introduced by this chapter)

| Parameter | Domain | Card | Proposed test range |
|---|---|---|---|
| `ebar.trendBodyFrac` | 0–1 | E-2 | 0.5–0.8 |
| `ebar.trendCloseLoc` | 0–1 | E-2 | 0.7–0.9 |
| `ebar.neutralBodyFrac` | 0–1 | E-3 | 0.05–0.25 |
| `reject.method` | RJ-W · RJ-C · RJ-R | E-4 | all three (bake-off) |
| `reject.wickFrac` | 0–1 | E-4 | 0.4–0.7 |
| `reject.closeLoc` | 0–1 | E-4 | 0.6–0.85 |
| `reject.rangeAtr` | > 0 | E-4 | 0.75–1.5 |
| `ebar.insideStrict` | bool | E-5 | both |
| `ebar.engulfMode` | EG-B · EG-R | E-6 | both |
| `sqz.method` | NR-n · ATR-FRACTION · DECLINING-MEAN | E-7 | all three |
| `sqz.n` | int ≥ 2 | E-7 | 4, 7 |
| `sqz.atrFrac` | 0–1 | E-7 | 0.4–0.7 |
| `sqz.meanLen` / `sqz.declineCount` | int | E-7 | 5–10 / 3–5 |
| `sqz.clock` | bars | E-7 | 3–10 |
| `gap.basis` | RANGE · CLOSE | E-8 | both |
| `gap.minSize` | scale units > 0 | E-8 | PCT 0.3–1.5 · VOLU 0.1–0.5 |
| `gap.fillClock` | bars | E-9 | 3–20 |
| `gap.ctxLookback` | bars | E-11/E-12 | 10–30 |
| `gap.exhClock` | bars ≤ `gap.fillClock` | E-14 | 3–10 |

## SOURCES

Bulkowski (candlestick statistics — the evidence for primitives-only; gap performance tables) · Brooks (trend/inside/outside bar discipline; buy-above as EG-R's ancestor) · Edwards, Magee & Bassetti (the gap chapter; full-gap basis; the classical taxonomy E-10…E-14 mechanizes) · Kirkpatrick & Dahlquist ch. 17 (short-term patterns as the curricula's home for this material) · Pruden (rejection at boundaries — springs/upthrusts, whose full cards land in CH 9).

## OPEN-DEPOSITS (claims on later chapters)

**[v3: the taxonomy separators formerly parked here were PROMOTED to cards E-11…E-14 — the backfill is cashed; only the volume upgrades below remain open.]**

**Deposited to CH 4 (Levels):** gap edges (`B_ref`, `O_t` of surviving gaps) as level-birth candidates with their own birth card; `zone.tickFloor` inheritance (C3). *(Consumed — L-2, L-4.)*
**Deposited to CH 7 (Ranges):** inside-bar chains and E-7 compression as range-interior facts; expired compression as boundary-test context. *(Consumed — R-8.)*
**Deposited to CH 8 (Breakouts):** E-7 as the mechanical content of "pre-break pressure"; **E-12 breakaway class as break-quality evidence (live as of v3)**; E-2 trend-bar close as claim-quality evidence; E-13's measuring-gap projection folklore as a testable objective option for the chain's grammar.
**Deposited to CH 9 (Aftermath):** outside-bar two-sided-trap fact; E-6 engulf-withdrawal (next close gives back the engulfed range) as fakeout evidence; reject-withdrawal (E-4) as retest-fail evidence; **E-14's FAILED-BREAKAWAY annotation as gap-borne trap context (live as of v3)**.
**Deposited to CH 10 (Volume):** relative-volume grade for gap events (upgrades E-10/E-14 classification confidence — climax at exhaustion, relVol at breakaway); volume grade for E-4 rejects and E-6 engulfs.
**Deposited to CH 13 (Regime/Calendar):** the exDiv stand-down calendar card (ratified home); the `bar.earnings` stand-down semantics (flag admitted per R-2; behavior written when CH 13 lands).

## OPEN QUESTIONS — RESOLVED (PUBLISHER-REVIEW-R2)

1. ~~Earnings-gap stand-down~~ **RESOLVED (R-2): flag admitted now (`bar.earnings`, T-9 v2), behavior deferred to CH 13.** Earnings dates confirmed reachable from the loop's data side; v1 default no-stand-down.
2. ~~E-4 evidentiary split~~ **RESOLVED (R-4): keep the split.** Fact born here, withdrawal consumed in CH 3/CH 9 — deposit-forward working as intended.

*Chapter 2 v3 · 14 cards, no stubs · DRAFT · review_ref: PUBLISHER-REVIEW-R2. Compiled against: Chapter 1 v2 (E-1…E-9) + Chapters 4 and 6 by sanctioned backfill (E-10…E-14, per T-5/T-12). Cited by: 3, 7, 8, 9, 10, 12, 13. The spiral's first full revolution closes here. — THE SCINTILLA RULEMAKER*

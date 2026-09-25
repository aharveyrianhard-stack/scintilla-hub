---
parent: "[[10 Scintilla/Scintilla|Scintilla]]"
cssclasses: [alanos-topic]
updated: 2026-09-22
stage: First real result in
---
↑ Parent: [[10 Scintilla/Scintilla|Scintilla]]

# Quant loop

> [!summary] In short · Decision needed · 22 Sep 2026
> A "lie detector for trading rules": turns a rulebook rule into code and makes it pass seven statistical judges. Works with the trading rulebook — they should improve each other.

## ✅ It ran on REAL prices for the first time (22 Sep) — and it killed the rule
You asked "how fake was the fake data?" Here is the answer, measured.

**What it tested:** two ways of spotting a swing in price, on **12 US large caps and 5,714 real daily bars, 2004 → last Friday**. The last three and a half years were physically cut out before the run, so the rule could not have been tuned on them.

**The verdict: no edge.** The best setting passed the first judge (the detector is correct and never redraws history) then failed all six that matter. 644 firings, and the honest error band runs from −0.068 to +0.154 — it straddles zero. **Neither version beat a coin flip.** Splitting by trend versus chop did not rescue it, and it leaned the *opposite* way to what the rulebook claims.

That is the loop doing its job: it killed a plausible-looking rule before it ever cost money.

**How fake was the fake data — concretely:** a judge that shuffles the bars broke the moment it met a real bar that closes exactly on its high. Fake bars never do that; real ones do it constantly. That judge had never run on anything real until today.

**CORRECTION (you caught this, 3:25 PM).** I published "we own no daily price history for any individual stock." **That was wrong.** I checked the live chart API myself: every stock carries **5,793 daily bars back to 11 September 2003**, served from R2 (`massive_provider_bars_deep_v1`) — AAPL, MSFT, NVDA, SPY, DIA, XLE, F all identical depth; GLD from Nov 2004. That matches exactly what you said about switching to Massive around 2003.

What is actually true is narrower and still worth fixing: **one Supabase table (`ohlcv_history`) is a stale side-copy** holding 18 fund/future tickers, its writer died on 12 August, and the four alarm tables that should have shouted are empty. A lane that reads that table sees nothing while 23 years of bars sit one call away. Same disease as the Geiger freeze. Tracked as SCI-30. The FMP archive going back to ~1960 has **not been located yet** — that is a search still to do, not a missing thing.

**Depth used by the run:** 2004 onward, because the run read one table instead of asking the chart API. The next run reads R2 and gets 2003 onward for everything, plus whatever the FMP archive holds once it is found.

## Where it stands
- Found (GitHub scintilla-loop + Supabase scintilla-rulebook notebook + iMac folders).
- Ran once (Jul 24) on **computer-generated practice prices**, not real history — its real-price reader was never written.

## To-dos
- [ ] Let it read our stored real history (read-only).
- [ ] First real run: swing bake-off, then regime conditioning.
- [ ] Close the loop: rulebook proposes rules → loop tests → verdicts go back into the rulebook.

> [!question] Decision for you
> Default yes: it may read stored prices.

> [!info] Notion — card with screenshot and comments
> ![Notion|16](https://www.notion.so/images/favicon.ico) [Quant loop — work card](https://app.notion.com/p/3e32d8b7adbe819bb5c9e623ddc47cf3) · [All Scintilla cards](https://app.notion.com/p/3a871fabf5444050ac3be7fc9003b2e7)

> [!todo] Linear — work and progress
> ![Linear|16](https://linear.app/static/favicon.svg) [SCI-22](https://linear.app/aharvey-scintilla/issue/SCI-22)

> [!success] Deliverables — see the result
> - [Quant loop page](file:///Users/alanharvey/AlanOS/Operating%20System/workspaces/scintilla/deliverables/20260922/quant-loop/QUANT-LOOP.html)
> [[10 Scintilla/Deliverables|All Scintilla results]]

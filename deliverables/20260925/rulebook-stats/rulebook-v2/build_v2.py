#!/usr/bin/env python3
"""Rulebook v2 builder. Reads the v1 chapter drafts (src-v1/, copied read-only from the private repo
aharveyrianhard-stack/scintilla-rulebook, drafts/ at commit 43f37c05 / repo HEAD 11692cf, 2026-08-03 text),
applies decisions D1-D6 and the T-13 amendment (D2) as visible, tagged edits, writes drafts-v2/*.md and
compiles RULEBOOK-v2.html. Every edit is listed in CHANGES and printed when the script runs, so the diff
between v1 and v2 is exactly what this file says and nothing else. Run: python3 build_v2.py"""
import re, json, html, datetime, pathlib, sys
HERE = pathlib.Path(__file__).parent; SRC = HERE/"src-v1"; OUT = HERE/"drafts-v2"; OUT.mkdir(exist_ok=True)
TODAY = "2026-09-25"; CHANGES = []
def note(f, what): CHANGES.append((f, what))

ORDER = ["00-THE-CONTRACT","01-VOCABULARY","02-EVENTS","03-STANDARDS","04-LEVELS","05-DIAGONALS","06-STRUCTURE","07-RANGES",
         "08-BREAKOUTS","09-AFTERMATH","10-VOLUME","11-INDICATORS","12-PATTERNS","13-REGIME","14-MTF","15-UNIVERSE","16-RISK","98-APPENDIX"]
docs = {n: (SRC/f"{n}.md").read_text(encoding="utf-8") for n in ORDER}

# ---------- D1: fold the R7/R8 rulings into chapters 12-16 (and record R1 on chapter 1) ----------
RULINGS = {
 "12-PATTERNS": ("R8", [
   ("P-R1", "KEEP THE VARIANT", "a ledger can always merge thin rows; it can never split merged ones. `pat.mwCount` = 3 ships as its own variant row; if the loop's counts never separate it from the double, merging is one migration."),
   ("P-R2", "NO PRIOR — ship as table rows", "the classical \"rising wedge = bearish\" read is the least-replicated of the classical set and gets no head start; it ships as busted-vs-triggered columns and the data settles it. No R-form recorded lean."),
   ("P-R3", "STAYS EXCLUDED; the re-admission path is scheduled, not walked", "no compileable definition, no admission (P-10). Flagged as a future CH 1 method-option candidate (a kernel-extrema SW-P restatement), unscheduled.")]),
 "13-REGIME": ("R7", [
   ("X-R1", "MEASURE, don't gate", "springs/upthrusts against the trend stay ACTIVE in TREND-IN-RANGE with the state stamp; gate only if the state's trap odds come back inverted. The table decides, not a prior."),
   ("X-R2", "AFFIRM uniform for v1", "the minimal dead-zone core applies after every transition, range-birth included; the loop flags if range-birth dead zones cost more edge than they save. Measure the exception before carving it."),
   ("X-R3", "CONFIRMED, and tightened", "cells change only on outcome evidence that clears the loop's own gates, never a single green run — and the lookup's cells are *trials*: the loop counts them in the deflated-Sharpe trial total (G5) and runs the family SPA (G6) over the swept table.")]),
 "14-MTF": ("R7", [
   ("M-R1", "HOLD at two frames", "{W CONTEXT, D RECORD}; every added frame doubles the conflict surface and there is no measured alignment lift yet. Monthly joins when the alignment tables justify a third."),
   ("M-R2", "FRAME-FIRST CONFIRMED", "frame authority is bar-contract authority (a weekly close is settled truth at scale); degree is recursion over one frame. Ships as the stated default; the loop may flip it per class on evidence."),
   ("M-R3", "AFFIRM confirmed-only for v1; claim-based pre-authorized for wave 2", "the lead-time table (`mtf.warnOdds`) shows whether an earlier, claim-based WARN is worth its false-positive rate; if it is, admit it then.")]),
 "15-UNIVERSE": ("R8", [
   ("U-R1", "ETF FIRST", "identical plumbing, one distribution step from the calibration class — the cheapest test of the transfer apparatus (U-2/U-9). Prove `uni.transferOdds` on ETF before FX."),
   ("U-R2", "ONE-PER-CLASS, 00:00 UTC default, sweepable", "cross-venue comparability beats per-venue fidelity for a rulebook; per-venue anchors live in the profile only if `uni.transferOdds` shows the comparability cost is real."),
   ("U-R3", "INDEX-ONLY for calibration", "the sector rung ships as the optional declared layer with no default benchmark; the second rung earns its place when `uni.mktAlignOdds` justifies it. Deferred, pre-authorized.")]),
 "16-RISK": ("R8", [
   ("K-R1", "TRADER-ONLY for v1", "the INVESTOR row (a fourth registry row, no entry-doctrine knob, longer TTLs, a W-record stack — not a fork) is pre-authorized to drop the moment its tables exist. This closes R1's reader-model question against a concrete mechanism."),
   ("K-R2", "ENTRY-R fallback for all profiles until `risk.entryDoctrineOdds` fills", "a table that is UNMEASURED at birth cannot key anything (K-5's own law); the context-keyed table takes over per context only as the loop fills it."),
   ("K-R3", "MANDATORY-EXISTENCE IS LAW, not default", "every profile ships with a de-risking ladder; steepness varies, existence does not; an absent ladder is not a legal profile. K-7's mandatory-existence clause is elevated to a stated law of the chapter.")]),
}
def fold(name, review, rulings):
    t = docs[name]
    m = re.search(r"## OPEN QUESTIONS \(for the publisher\)\n\n(.*?)\n\n(\*Chapter \d+ v1[^\n]*\*)", t, re.S)
    assert m, name
    items = re.findall(r"^\d+\. (.*)$", m.group(1), re.M); assert len(items) == len(rulings), (name, len(items))
    lines = [f"## OPEN QUESTIONS — RESOLVED (PUBLISHER-REVIEW-{review})", ""]
    for i, (item, (code, head, body)) in enumerate(zip(items, rulings), 1):
        tm = re.match(r"\*\*(.+?)\*\*", item); title = tm.group(1).rstrip(":") if tm else item[:80]
        lines.append(f"{i}. ~~{title}~~ **RESOLVED ({code}): {head}** — {body}")
    footer = m.group(2)
    new_footer = footer.replace(" v1 ·", " v2 ·").replace("review_ref: PUBLISHER-REVIEW-R6 (Sprint 8 go-ahead)", "review_ref: PUBLISHER-REVIEW-R7 (Sprint 8 go-ahead) · PUBLISHER-REVIEW-" + review) \
                       .replace("review_ref: PUBLISHER-REVIEW-R6 (go-ahead)", "review_ref: PUBLISHER-REVIEW-R6 (go-ahead) · PUBLISHER-REVIEW-" + review)
    t = t[:m.start()] + "\n".join(lines) + "\n\n" + new_footer + t[m.end():]
    ch = re.search(r"# CHAPTER (\d+)", t).group(1)
    t = t.replace("**THE SCINTILLA TRADING RULEBOOK · Chapter draft · v1** (supersedes shell v0)",
        "**THE SCINTILLA TRADING RULEBOOK · Chapter draft · v2** (supersedes v1)\n"
        f"**v2 changelog (per PUBLISHER-REVIEW-{review}, folded {TODAY} — decision D1):** the three open questions are resolved in place below "
        f"({', '.join(c for c,_,_ in rulings)}), in the same form R2–R6 already use. No card text changed." +
        ("  The footer's `review_ref` is corrected: the Sprint 8 go-ahead was R7, not R6 (R7 §5)." if "Sprint 8" in footer else ""), 1)
    docs[name] = t; note(name, f"D1: OPEN QUESTIONS block resolved against {review} ({len(rulings)} rulings); header v1→v2; changelog line added" + ("; review_ref R6→R7 corrected" if "Sprint 8" in footer else ""))
for n, (rv, rl) in RULINGS.items(): fold(n, rv, rl)

# chapter 1: the four questions already have answers on record (R1); record them so no block reads as open
t = docs["01-VOCABULARY"]
m = re.search(r"## OPEN QUESTIONS \(for the publisher\)\n\n(.*?)\n\n(\*Chapter 1 v3[^\n]*\*)", t, re.S); assert m
blk = ["## OPEN QUESTIONS — RESOLVED (PUBLISHER-REVIEW-R1) · RECORDED", "",
 "1. ~~`bar.session` for the calibration class~~ **RESOLVED (R1): RTH confirmed** — FX/crypto session templates deferred to CH 15 (now U-7).",
 "2. ~~V-5 provisional SPLIT_ONLY~~ **RESOLVED (R1): confirmed, with the ex-date stand-down** — homed in CH 13's calendar rules (X-8).",
 "3. ~~The swing bake-off first~~ **RECORDED (R1 go-ahead): logged as the loop's testing job #1** — ran on synthetic data only (Sprints 1–2, feed synthetic-v1); as of " + TODAY + " it has never run on real prices. Execution pending (decision D7).",
 "4. ~~V-15's PIP self-graveyard~~ **RECORDED: the author's own commitment, stands** — SW-P was not in the first-wave test (46 trials = SW-F + SW-R only)."]
docs["01-VOCABULARY"] = t[:m.start()] + "\n".join(blk) + "\n\n" + m.group(2).replace("Chapter 1 v3", "Chapter 1 v4") + t[m.end():]
docs["01-VOCABULARY"] = docs["01-VOCABULARY"].replace("**v3 changelog", f"**v4 changelog ({TODAY}, D1):** the four open questions carry their R1 answers in place; nothing else changed.\n**v3 changelog", 1) if "**v3 changelog" in docs["01-VOCABULARY"] else docs["01-VOCABULARY"]
note("01-VOCABULARY", "D1: the four open questions marked with their R1 answers (2 resolved, 2 recorded); v3→v4")

# ---------- D2: close the T-13 EMITS grammar hole ----------
t = docs["00-THE-CONTRACT"]
old = "EMITS:       <event name> | verdict{7 fields}      # T-8"
assert old in t
t = t.replace(old, "EMITS:       <event name> | verdict{7 fields} | object{NAME} | none   # T-8; object{NAME} when KIND=DEFINITION, none when KIND=LAW (v3, D2 — provisional, warning-flagged)")
anchor = "- INVALIDATION: A formal block requiring any decision not present in the card's prose reveals the prose unfinished — the card returns to DRAFT."
assert anchor in t
t = t.replace(anchor, "- **[v3, D2 — " + TODAY + "]** EMITS gains two arms so the form can express every KIND it admits: a DEFINITION card emits `object{NAME}` (the named object it defines, for other cards to cite); a LAW card emits `none` (it constrains, it produces nothing). Both arms are **provisional**: the loop's compiler flags every use with a warning until the Publisher ratifies the wording. Carried from the loop's compiler finding (ARCHITECT-REVIEW-A3, note X→AUTHOR-1) through PUBLISHER-REVIEW-R8 §2; adopted here at the checkup's default.\n" + anchor)
t = t.replace("**v2 changelog (per PUBLISHER-REVIEW-R2):**", f"**v3 changelog ({TODAY}, decision D2):** T-13's EMITS clause gains `object{{NAME}}` and `none` arms — the one grammar hole the loop found by compiling the form (R8 §2) — provisional and warning-flagged; T-9's registry table gains `bar.exDiv` (D3).\n**v2 changelog (per PUBLISHER-REVIEW-R2):**", 1)
t = t.replace("**STATUS: DRAFT** (laws T-1…T-13;", "**STATUS: DRAFT · v3** (laws T-1…T-13;", 1)
t = t.replace("| `bar.earnings` | bool flag on session bars | T-9 (v2) | optional; v1 default no-stand-down; semantics owned by CH 13 |",
              "| `bar.earnings` | bool flag on session bars | T-9 (v2) | optional; v1 default no-stand-down; semantics owned by CH 13 |\n| `bar.exDiv` | bool flag on session bars (ex-dividend open) | T-9 (v3, D3) | used by T-9, V-5, E-8, C-3, Q-9, X-8 since v1; registered here " + TODAY + " |")
docs["00-THE-CONTRACT"] = t; note("00-THE-CONTRACT", "D2: T-13 EMITS admits object{NAME} and none (provisional, warning-flagged); D3: bar.exDiv row in the Contract's registry table; v2→v3")

# ---------- D3 / D4 / D5: the registry (Chapter 98 Part II) ----------
t = docs["98-APPENDIX"]
old = "- `bar.earnings` — bool session flag — T-9\n- `bar.tf` · `bar.session` (RTH·ETH·FULL24) · `bar.tz` — V-1"
assert old in t
t = t.replace(old, "- `bar.earnings` — bool session flag — T-9 · `bar.exDiv` — bool session flag (ex-dividend open) — T-9 **[v2, D3]**\n"
                   "- `bar.tf` · `bar.session` (RTH·ETH·FULL24) · `bar.tz` · `bar.basis` (price basis, last trade) — V-1 **[v2, D3: `bar.basis` registered]**\n"
                   "- `bar.short` — bool session flag (shortened session; volume-graded rules stand down) — V-7 **[v2, D3]**")
# D5: one owner per twice-registered parameter — the duplicate rows are in the chapters' own registry tables
owners = {"retest.clock": "V-24", "retest.confirmClock": "V-24", "fake.clock": "V-24", "swing.n": "V-12", "diag.anchor": "V-18",
          "zone.tickFloor": "V-17", "vol.earnStand": "Q-9", "vol.calStand": "Q-9"}
dup_in = {"09-AFTERMATH": ["retest.clock", "retest.confirmClock", "fake.clock"], "11-INDICATORS": ["swing.n"], "04-LEVELS": ["diag.anchor"],
          "05-DIAGONALS": ["diag.anchor"], "15-UNIVERSE": ["zone.tickFloor"], "13-REGIME": ["vol.earnStand", "vol.calStand"]}
d5 = []
for name, params in dup_in.items():
    for p in params:
        pat = re.compile(r"^(\| `" + re.escape(p) + r"`[^|\n]*\|[^|\n]*\|)([^|\n]*)(\|)", re.M)
        if pat.search(docs[name]):
            docs[name] = pat.sub(lambda m: m.group(1) + m.group(2).rstrip() + " · cited; owner " + owners[p] + " [v2, D5] " + m.group(3), docs[name], count=1); d5.append((name, p))
for name in dup_in:
    if any(n == name for n, _ in d5): note(name, "D5: registry row(s) marked as citations of the owner: " + ", ".join(p for n, p in d5 if n == name))
t = t.replace("## PART III — THE GRAVEYARD", "### Reserved names — named in chapter text, deliberately unregistered [v2, D4]\n"
  "These three were left out of the registry by rulings, not by omission, and stay out. They are listed so no future pass \"fixes\" them into live parameters.\n"
  "- `chan.midClaims` — evidence-only for v1 (R4-R-2); CH 5.\n- `zone.asym` — reserved, untested (L-4); CH 4.\n- `range.maxHeight` — no cap in v1 (R4-R-3); already in the Graveyard below.\n\n## PART III — THE GRAVEYARD", 1)
t = t.replace("# CHAPTER 98 — THE FORMALIZATION APPENDIX", "# CHAPTER 98 — THE FORMALIZATION APPENDIX\n\n**v2 changelog (" + TODAY + ", decisions D3–D5):** three used-but-unregistered bar flags registered (`bar.exDiv` T-9, `bar.short` V-7, `bar.basis` V-1); three deliberate reservations listed as RESERVED, not registered; the eight parameters that were registered twice now show one owner, the other listing marked as a citation.", 1)
docs["98-APPENDIX"] = t; note("98-APPENDIX", f"D3: bar.exDiv/bar.short/bar.basis registered; D4: RESERVED block for chan.midClaims, zone.asym, range.maxHeight; D5: {len(d5)} chapter registry rows marked as citations (see per-chapter lines)")

# ---------- D6: 'the loop proved/measured' rests on synthetic controls ----------
D6 = " **[v2 note, D6 — " + TODAY + "]** The evidence behind this sentence is the loop's synthetic-control run only (feed synthetic-v1, 7 DRAFT verdicts for the swing rule, last decided 24 Jul 2026; lockbox untouched). No real-data verdict exists. Read \"measured\" / \"proved\" as *on synthetic controls* until one does."
for name, needle in [("11-INDICATORS", "the loop's own Sprint-1 result (edge on trending, negative on mean-reverting, none pooled) is the empirical case that the *same rule* means different things under different skies. The gauges are the barometer; CH 13 reads it; nothing here forecasts with it."),
                     ("13-REGIME", "and how every future rate the book publishes says *where* it is true."),
                     ("16-RISK", "with the ledger recording that the difference was appetite, never truth.")]:
    assert needle in docs[name], name
    docs[name] = docs[name].replace(needle, needle + D6, 1); note(name, "D6: 'on synthetic controls' note appended to " + {"11-INDICATORS":"I-10","13-REGIME":"X-9","16-RISK":"K-6"}[name])
for name in ["11-INDICATORS"]:
    docs[name] = docs[name].replace("*Chapter 11 v2 ·", "*Chapter 11 v3 ·", 1)

for n in ORDER: (OUT/f"{n}.md").write_text(docs[n], encoding="utf-8")

# ---------- the claims ledger (Chapter 99) ----------
tests = json.loads((SRC/"RULEBOOK-TESTS-20260922.json").read_text())
STUDY = {"U-3": "S1 · percentile lines and the index problem", "I-2": "S2 · are RSI and %R one witness or two",
         "I-10": "S3 · regime conditioning on real prices", "X-9": "S3 · regime conditioning on real prices", "K-6": "S3 · regime conditioning on real prices",
         "B-5": "S4 · the throwback base rate against Bulkowski's 60%", "A-1": "S4 · the throwback base rate against Bulkowski's 60%",
         "E-11": "S5 · do common gaps fill fast", "E-10": "S5 · do common gaps fill fast"}
rows = []
for c in tests["claims"]:
    status = "untested — mechanical check not run" if c["kind"] == "DESIGN" else ("untested — true by arithmetic; the audit it calls for has not run" if c["kind"] == "ARITHMETIC" else "untested on real prices (the loop's 7 verdicts are synthetic)")
    study = STUDY.get(c["card"], f"family {c['family']} ({c['family_name']}) — the loop, {c['priority']}")
    if c["kind"] in ("DESIGN",): study = f"family F11 mechanical check — {c['concrete_test'][:90]}"
    rows.append((c["n"], c["card"], c["page"], c["plain_claim"], c["kind"], status, study))
ledger = ["# CHAPTER 99 — THE CLAIMS LEDGER (v2, " + TODAY + ")", "",
  "Every sentence the 22 September checkup caught as a claim, one per row: what it says in plain words, whether it has been tested, and which study would test it. "
  "The test status column is the loop's verdict where one exists. As of " + TODAY + " the loop holds seven verdicts, all DRAFT, all on synthetic data, all for the swing rule — so no row below is tested on real prices. "
  "Study codes S1–S5 are the five descriptive studies specified in the 25 September package (deliverables/20260925/rulebook-stats); the rest wait for the loop by family.", "",
  "| # | Card · page | The claim, in plain words | Kind | Test status | Which study tests it |", "|---|---|---|---|---|---|"]
for r in rows: ledger.append("| %s | %s · p.%s | %s | %s | %s | %s |" % tuple(html.escape(str(x)).replace("|", "\\|") for x in r))
docs["99-CLAIMS"] = "\n".join(ledger) + "\n"; (OUT/"99-CLAIMS.md").write_text(docs["99-CLAIMS"], encoding="utf-8")

# ---------- front matter ----------
front = f"""# THE SCINTILLA TRADING RULEBOOK — v2

**Compiled {TODAY} from the v1 chapter drafts (repo scintilla-rulebook, drafts/ as of commit 43f37c05, 3 August 2026). The 3 August 2026 PDF (123 pages, sha256 336e710e10c0447c…) is untouched and remains the v1 record.**

## READ THIS FIRST

This book is a set of definitions and a method for measuring chart behaviour. It is written for education and for testing, and for nothing else. It is not investment advice, not a recommendation to buy or sell anything, and not a promise about the future. Every rate it will ever print is a count of what happened on past prices; where no count exists the cell reads UNMEASURED, and as of {TODAY} every market claim in it is untested on real prices (Chapter 99). Nothing here accounts for costs, taxes, slippage or the money you must risk to find out. If you act on any of it, you do so on your own judgement and at your own risk. *(This block is new in v2. v1 carried no disclaimer of any kind while naming entries and price objectives; the 22 and 23 September checks both called that a publication blocker.)*

## WHAT CHANGED FROM v1 — the seven decisions, taken at their defaults

The 22 September checkup left seven small decisions open, each with a default. Alan's standing rule: when a decision has an obvious default, take it and say so. All seven are taken here at the checkup's default; every resulting edit is tagged in the text with its decision code.

| Decision | What was open | Taken as | Where in v2 |
|---|---|---|---|
| D1 | Fold the 15 rulings of reviews R7 and R8 into chapters 12–16 (the reviews existed; the chapters still showed the questions as open) | **Yes.** Each block becomes OPEN QUESTIONS — RESOLVED, in the form R2–R6 already use; Chapter 1's four questions carry their R1 answers | chapters 1, 12, 13, 14, 15, 16 |
| D2 | The Contract's T-13 EMITS clause could not express what DEFINITION and LAW cards produce | **The loop's provisional fix adopted:** `object{{NAME}}` and `none` arms, warning-flagged | The Contract, T-13 (v3) |
| D3 | `bar.exDiv`, `bar.short`, `bar.basis` are used in chapters but missing from the registry | **Registered**, owners T-9 / V-7 / V-1 | Chapter 98 Part II; T-9's table |
| D4 | The 21 September amendments A4–A6 would have registered three names that rulings deliberately left out | **Listed as RESERVED**, not registered (`range.maxHeight` is already in the Graveyard) | Chapter 98 Part II |
| D5 | Eight parameters registered twice | **One owner each** (CH 1 the vocabulary ones, CH 10 the volume ones); the other listing is marked as a citation | Chapter 98 Part II |
| D6 | Three sentences say the loop "proved" / "measured" the regime edge; the only evidence is synthetic | **A note on each** (I-10, X-9, K-6): "on synthetic controls" until a real-data verdict exists | chapters 11, 13, 16 |
| D7 | The loop has never run on real prices | **Not a text change.** The checkup's default — the swing bake-off (SW-F vs SW-R) on US large-cap daily on two feeds, then Sprint 3 "Condition on Regime" — is what the 25 September package specifies as study S3's precondition and hands to the quant-loop owner. Nothing in this book is promoted by it. | deliverables/20260925/rulebook-stats |

D8 (order of testing) stays the book's own order: 1 swing bake-off, 2 RSI × %R independence audit, 3 regime conditioning, then the NEXT rows of Chapter 99.

**What did not change:** no card's RULE, CONFIRMATION, INVALIDATION or STATUS. Every card is still DRAFT. No rate was filled in. The chapter text is the author's, byte for byte, outside the tagged edits listed at the end of this document.

## CONTENTS

The Contract (T) · 1 Vocabulary (V) · 2 Bar, candle & gap events (E) · 3 Confirmation & invalidation (C) · 4 Horizontal levels (L) · 5 Diagonals & channels (D) · 6 Trend & structure (S) · 7 Ranges (R) · 8 Breakouts & breakdowns (B) · 9 Aftermath (A) · 10 Volume (Q) · 11 Indicators (I) · 12 Patterns (P) · 13 Context & regime (X) · 14 Multi-timeframe (M) · 15 Universe & relativity (U) · 16 Risk profile & application (K) · 98 The formalization appendix · 99 The claims ledger (new) · Edit list
"""
edits = "# EDIT LIST — every change between v1 and v2\n\nProduced by build_v2.py; nothing else was changed.\n\n" + "\n".join(f"- **{f}** — {w}" for f, w in CHANGES) + "\n"

# ---------- markdown → html (small, exact enough for these drafts) ----------
def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"~~(.+?)~~", r"<s>\1</s>", s)
    s = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", s)
    s = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r'<a href="\2">\1</a>', s)
    return s
def md2html(md):
    out, lines, i = [], md.split("\n"), 0
    para = []
    def flush():
        if para: out.append("<p>" + inline(" ".join(para)) + "</p>"); para.clear()
    while i < len(lines):
        l = lines[i]
        if l.startswith("```"):
            flush(); j = i + 1; buf = []
            while j < len(lines) and not lines[j].startswith("```"): buf.append(lines[j]); j += 1
            out.append("<pre>" + html.escape("\n".join(buf)) + "</pre>"); i = j + 1; continue
        m = re.match(r"^(#{1,4}) (.*)$", l)
        if m: flush(); n = len(m.group(1)); out.append(f"<h{n}>{inline(m.group(2))}</h{n}>"); i += 1; continue
        if re.match(r"^-{3,}\s*$", l): flush(); out.append("<hr>"); i += 1; continue
        if l.startswith("|"):
            flush(); rows = []
            while i < len(lines) and lines[i].startswith("|"): rows.append(lines[i]); i += 1
            cells = lambda r: [c.strip() for c in re.split(r"(?<!\\)\|", r.strip().strip("|"))]
            hdr = cells(rows[0]); body = [cells(r) for r in rows[2:]] if len(rows) > 1 and re.match(r"^\|[\s:-]+\|", rows[1]) else [cells(r) for r in rows[1:]]
            out.append("<table><thead><tr>" + "".join(f"<th>{inline(c.replace(chr(92)+'|','|'))}</th>" for c in hdr) + "</tr></thead><tbody>" +
                       "".join("<tr>" + "".join(f"<td>{inline(c.replace(chr(92)+'|','|'))}</td>" for c in r) + "</tr>" for r in body) + "</tbody></table>"); continue
        if re.match(r"^(\s*)([-*]|\d+\.) ", l):
            flush(); items = []
            while i < len(lines) and (re.match(r"^(\s*)([-*]|\d+\.) ", lines[i]) or (lines[i].startswith("  ") and items and not re.match(r"^\s*([-*]|\d+\.) ", lines[i]))):
                m2 = re.match(r"^(\s*)([-*]|\d+\.) (.*)$", lines[i])
                if m2: items.append([len(m2.group(1)), m2.group(2) != "-" and m2.group(2) != "*", m2.group(3)])
                else: items[-1][2] += " " + lines[i].strip()
                i += 1
            def render(items, depth):
                h, k = [], 0
                ordered = items[0][1]; h.append("<ol>" if ordered else "<ul>")
                while k < len(items):
                    ind, o, txt = items[k]; sub = []; k += 1
                    while k < len(items) and items[k][0] > ind: sub.append(items[k]); k += 1
                    h.append("<li>" + inline(txt) + (render(sub, depth + 1) if sub else "") + "</li>")
                h.append("</ol>" if ordered else "</ul>"); return "".join(h)
            out.append(render(items, 0)); continue
        if l.startswith("> "): flush(); out.append("<blockquote>" + inline(l[2:]) + "</blockquote>"); i += 1; continue
        if not l.strip(): flush(); i += 1; continue
        para.append(l.strip()); i += 1
    flush(); return "\n".join(out)

parts = [front] + [docs[n] for n in ORDER] + [docs["99-CLAIMS"], edits]
body = "\n<hr class=\"chapter\">\n".join(f'<section class="chapter" id="c{k}">' + md2html(p) + "</section>" for k, p in enumerate(parts))
CSS = """
:root{--bg:#0A0A0F;--panel:#0D0D14;--line:#1A1A2A;--line2:#252538;--ink:#C6C8DE;--ink2:#9A9AB6;--dim:#868AAA;--mono:"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace;--sans:ui-sans-serif,-apple-system,"Helvetica Neue",sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink2);font-family:var(--sans);font-size:15.5px;line-height:1.55}
main{max-width:980px;margin:0 auto;padding:44px 28px 120px}h1{font-size:30px;color:var(--ink);font-weight:500;margin:36px 0 12px;line-height:1.2}
h2{font-size:21px;color:var(--ink);font-weight:500;margin:34px 0 8px}h3{font-size:17px;color:var(--ink);font-weight:500;margin:26px 0 6px}h4{font-size:15px;color:var(--ink);margin:18px 0 4px}
p{margin:0 0 12px;max-width:78ch}li{margin:0 0 6px}ul,ol{padding-left:22px;max-width:80ch}strong{color:var(--ink);font-weight:500}code,pre{font-family:var(--mono);font-size:12.5px;color:var(--ink)}
pre{background:var(--panel);border:.6px solid var(--line2);padding:12px 14px;overflow:auto;white-space:pre-wrap}s{color:var(--dim)}
table{border-collapse:collapse;width:100%;font-family:var(--mono);font-size:11.5px;margin:12px 0}th{text-align:left;font-weight:400;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);border-bottom:.6px solid var(--line2);padding:0 10px 6px 0}
td{padding:6px 10px 6px 0;border-bottom:.4px solid var(--line);vertical-align:top}hr{border:0;border-top:.6px solid var(--line);margin:40px 0}hr.chapter{border-top:1.2px solid var(--line2);margin:64px 0}
a{color:var(--ink)}blockquote{border-left:2px solid var(--line2);margin:0 0 12px;padding:2px 14px;color:var(--ink)}
@media print{body{background:#fff;color:#222;font-size:10.5pt}h1,h2,h3,h4,strong,code,pre,a,blockquote,td.k{color:#000}pre{background:#f4f4f4;border-color:#ccc}
 th{color:#444;border-color:#999}td{border-color:#ddd}hr,hr.chapter{border-color:#999}section.chapter{page-break-before:always}section.chapter:first-child{page-break-before:auto}
 main{max-width:none;padding:0}s{color:#666}a{text-decoration:none}}
"""
# the Hub's BACK / CLOSE pair, from its one source (scripts/scnav-snippet.html), so this page is never a dead end
snip = pathlib.Path(__file__).resolve().parents[4] / "scripts" / "scnav-snippet.html"
scnav = snip.read_text(encoding="utf-8") if snip.exists() else ""
scnav = scnav[scnav.index('<style id="scnav-css">'):] if '<style id="scnav-css">' in scnav else scnav
doc = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>The Scintilla Trading Rulebook — v2 ({TODAY})</title>
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><style>{CSS}</style></head><body><main><div data-scnav-slot style="margin-bottom:12px"></div>{body}</main>{scnav}</body></html>"""
(HERE/"RULEBOOK-v2.html").write_text(doc, encoding="utf-8")
print("chapters compiled:", len(parts), "| html bytes", len(doc.encode()), "| claims rows", len(rows))
for f, w in CHANGES: print(" -", f, "::", w[:160])

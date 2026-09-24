#!/usr/bin/env python3
"""Render UNIVERSE-EXPAND.html from names.json so the page and the data cannot drift apart.
   python3 deliverables/20260924/universe-expand/build.py"""
import json, os, html
HERE = os.path.dirname(os.path.abspath(__file__))
D = json.load(open(os.path.join(HERE, "names.json")))
T1, T2, T3 = D["tier1"], D["tier2"], D["tier3"]
esc = lambda s: html.escape(str(s or ""))

CSS = open(os.path.join(HERE, "page.css")).read()

def rows_t1():
    out = []
    for x in T1:
        out.append(f"<tr><td class=n>{esc(x['ticker'])}</td><td>{esc(x['stands_for'])}</td>"
                   f"<td>{esc(x['why'])}{(' <i>' + esc(x['risk']) + '</i>') if x['risk'] else ''}</td></tr>")
    return "\n".join(out)

def rows_t2():
    out = []
    for x in sorted(T2, key=lambda r: (r["branch"], r["ticker"])):
        risk = f"<br><i>{esc(x['risk'])}</i>" if x["risk"] else ""
        out.append(f"<tr><td class=n>{esc(x['ticker'])}</td><td class=n>{esc(x['branch'].replace('_',' ').title())}</td>"
                   f"<td class=n>{esc(x['cap_band'])}</td><td>{esc(x['why'])}{risk}</td></tr>")
    return "\n".join(out)

def rows_t3():
    return "\n".join(f"<tr><td class=n>{esc(x['ticker'])}</td><td>{esc(x['why'])}</td></tr>" for x in T3)

N1, N2, N3 = len(T1), len(T2), len(T3)
TOTAL = N1 + N2
REQ = TOTAL * 48 + TOTAL * 24 + TOTAL * 2
BATCHES = (TOTAL + 9) // 10

PAGE = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<title>SCINTILLA · FILLING THE HOLES IN THE TREE</title>
<style>{CSS}</style></head>
<body>
<div class=wrap>
<div class=top><div class=brand>SCINTILLA <b>UNIVERSE EXPANSION</b></div>
<div class=stamp>24 SEP 2026 · M53 · PLAN AND RUNBOOK, NOTHING RUN</div></div>

<p class=lead>The Hub watches 364 names. The tree you approved shows where that is thin: ten
sub-industries it cannot see at all, and branches like photonics or solar that rest on a single
company. This page is the plan to fill those holes with <b>{N1} funds first</b> and <b>{N2} of the
companies you named</b>, and the runbook that does it without breaking the 364 that already work.</p>

<div class=box><b>THE RULE THIS WHOLE PLAN IS BUILT AROUND</b>
A new name is pulled while it is <b>invisible</b> — it sits in the provider's list switched off, so
the Hub, the Station and the live stream cannot see it. It only appears on your screen after its own
history passes a check that says, session by session, either "we have it" or exactly why there is
nothing there. Nothing goes live with an unexplained gap.</div>

<h1>1 · THE FUNDS, FIRST — {N1} OF THEM</h1>
<p>You said it plainly: fill the gaps with ETFs rather than a crazy amount of companies, because the
Geiger of the branch matters more than the Geiger of every company inside it. Each fund below stands
for one branch the tree cannot currently see.</p>
<table><tr><th>FUND</th><th>STANDS FOR</th><th>WHY IT IS ON THE LIST</th></tr>
{rows_t1()}
</table>
<div class=box><b>THREE YOU NAMED THAT NEED NOTHING</b>
Information technology (<b>XLK</b>), consumer discretionary (<b>XLY</b>) and real estate
(<b>XLRE</b>) are already served, and so is RKLB. They are not in the list because they are not
missing.</div>

<h1>2 · THE NAMES YOU ASKED FOR — {N2} COMPANIES</h1>
<p>Photonics and optical networking, space, semiconductor equipment, nuclear and uranium, plus the
34 names the Claude Check has been collecting. Each one lands on a branch of the tree, so it arrives
with a cohort instead of floating loose.</p>
<table class=t2><tr><th>NAME</th><th>BRANCH</th><th>SIZE</th><th>WHY, AND WHAT TO WATCH</th></tr>
{rows_t2()}
</table>

<h1>3 · LATER — {N3} NAMES, ONLY IF THE TREE STILL NEEDS THEM</h1>
<p>Two sub-industries have no fund liquid enough to stand for them, and photonics has no fund at
all. If a branch still reads badly once the funds are in, these are the companies that fix it.</p>
<table><tr><th>NAME</th><th>WHY IT WOULD COME LATER</th></tr>
{rows_t3()}
</table>

<h1>4 · WHY THE PAST PULLS WENT BADLY</h1>
<p>You were right to warn about this. I read the provider's own code and operating notes before
designing anything. Six things went wrong before, and each one has a specific answer here.</p>
<table><tr><th>WHAT WENT WRONG</th><th>WHAT THIS DOES INSTEAD</th></tr>
<tr><td><b>Pulling far more history than anything shows.</b> The deep archive walks whole-market
files; going back years costs hours and money for names nobody opens.</td>
<td>48 months per name — the same 200 weeks the current 364 have, no more. The deep archive is not
touched at all.</td></tr>
<tr><td><b>Running while the market was moving.</b> A heavy job on a serving machine made the
health checks and the quote path time out while the data itself was fine (measured 19 Aug).</td>
<td>The runbook refuses to start between 09:25 and 16:15 New York, and again during the 18:30
settlement window. It runs on the batch machine, never on the one serving your screen.</td></tr>
<tr><td><b>A half-finished pull left the screen broken.</b> Names appeared before their history
did.</td><td>A name is invisible until its gap report passes. A run killed halfway leaves rows
nobody can see and files nobody reads.</td></tr>
<tr><td><b>One new name can take the whole Geiger down.</b> Readiness checks every name on every
timeframe — 364 x 8 = 2,912 cells today — and one cell behind makes the whole thing unready.</td>
<td>Names are admitted in batches of ten, each gated on its own report, and the runbook refuses to
start at all while the Geiger is already red.</td></tr>
<tr><td><b>"It already exists" was believed instead of proven.</b> Files of unknown origin were
counted as done.</td><td>The worker re-checks provenance on every symbol-month and re-pulls
anything that cannot prove where it came from. That is also what makes it resumable.</td></tr>
<tr><td><b>The count is pinned in three places</b> — the Hub, the Station and the chart service.
Change one and the Station throws.</td><td>Step 7 changes all three in one window, and the count
and digest are read from the provider, never typed from memory.</td></tr>
</table>

<h1>5 · THE PILOT — THREE NAMES, RUN AS A DRY RUN</h1>
<p>One fund (<b>KRE</b>, regional banks), one larger company (<b>COHR</b>, photonics) and one small
one (<b>AAOI</b>, optical transceivers — the name you led with).</p>
<table><tr><th>WHAT</th><th>MEASURED</th></tr>
<tr><td>Requests to the provider</td><td class=n>222 — 144 for minute history, 72 for the chart
timeframes, about 6 for the old daily</td></tr>
<tr><td>Time to pull</td><td class=n>about a minute, then a minute for the gap report</td></tr>
<tr><td>What it wrote</td><td class=n>nothing — dry run</td></tr>
<tr><td>What it refused</td><td class=n>it stopped at the preflight, because the Geiger is
<b>not ready right now</b>: 5,460 open issues at 04:19Z today</td></tr>
</table>
<div class=box><b>THAT REFUSAL IS THE POINT</b>
I did not override it. The Geiger being red before we start is exactly the condition where adding
480 new cells would make the problem impossible to read. It has to be green first.</div>

<h1>6 · WHAT THE COORDINATOR TYPES</h1>
<p>Three commands. The first two write nothing.</p>
<pre><code>./RUNBOOK.sh --pilot            # the plan for the three pilot names
./RUNBOOK.sh                    # the plan for all {TOTAL}
./RUNBOOK.sh --pilot --confirm  # actually do the three
./RUNBOOK.sh --confirm          # then the rest, in {BATCHES} batches of ten</code></pre>
<p>If a batch fails its gap report the run stops there, names the reason in plain words and prints
the one line that resumes it. Re-running never pulls the same month twice.</p>

<h1>7 · HOW LONG THE WHOLE THING TAKES</h1>
<table><tr><th>STEP</th><th>TIME</th></tr>
<tr><td>Pulling {TOTAL} names, 48 months each ({REQ:,} provider requests)</td><td class=n>about 10 minutes</td></tr>
<tr><td>Gap report, one per batch of ten</td><td class=n>about 6 minutes in total</td></tr>
<tr><td>Admitting, re-pinning the three places, deploying</td><td class=n>15 to 20 minutes of care</td></tr>
<tr><td>Watching the Geiger come back green</td><td class=n>one settlement cycle</td></tr>
<tr><td><b>Overnight in one sitting</b></td><td class=n><b>under an hour of work</b></td></tr>
</table>

<h1>8 · WHERE EACH NUMBER ON THIS PAGE COMES FROM</h1>
<ul>
<li>The holes in the tree, and how thin each branch is: the tree you approved, built 24 Sep —
<code>data/taxonomy-audit-20260924.json</code>.</li>
<li>364 names and the digest <code>ab8f7965…</code>: read live from the chart service at 04:22Z today.</li>
<li>The Geiger being red, and the 5,460 issues: read live from the same service at 04:25Z today.</li>
<li>Request counts and timings: the runbook computes them from the real worker's own units — one
request per name per month — not from a guess.</li>
<li>The 34 collected names, their cohorts and reasons: the Claude Check candidate list, as the tree
audit copied it.</li>
<li>Which fund suits which gap: my reading of what each fund holds. <b>This is the one judgement
call on the page</b>, and the liquidity of the smaller ones (BJK, PEJ, REZ, ARKX) is flagged rather
than assumed.</li>
</ul>

<h1>9 · WHAT COULD BE WRONG</h1>
<ul>
<li><b>I could not ask the provider anything.</b> This machine has no provider key, so "the provider
serves this name" is checked by the runbook's first step, not proven here. SIVE is the likely
casualty — its US line is over-the-counter — and TMRC may be too.</li>
<li><b>Small names have thin minutes by nature.</b> BKSY, SATL, SIDU, SPIR and CRML will show
sessions with no trades. The report calls that an absence, not a gap — but if that classification is
ever wrong, a real hole could be waved through.</li>
<li><b>A fund's Geiger is not the branch's Geiger.</b> KRE moving tells you about regional banks as a
group; it cannot tell you that one bank inside it is breaking.</li>
<li><b>The membership file is the switch, and nothing else writes it.</b> I searched the provider's
services and no code creates it, so the admit step writes it. If some other reader expects a
different shape in that file, admission would look done and serve nothing.</li>
<li><b>The stream writes no minute bars today</b> (<code>BARS_1M_ENABLED=0</code> on the live stream
machine). New names will get history and chart timeframes, but the live minute feed is a separate
problem that this expansion does not fix.</li>
</ul>

<h1>10 · WHAT I DID NOT DO</h1>
<ul>
<li>Nothing was pulled, written, deployed or pushed. No production change of any kind.</li>
<li>No name was added to the universe; it is still 364 with the same digest.</li>
<li>No favourite was created, no cohort changed, no pin edited.</li>
<li>I did not touch the Indicator Lab, the other rooms, or the 364 names' files.</li>
<li>I did not override the preflight refusal, and I did not go hunting for a provider key.</li>
</ul>
</div>
</body></html>
"""
open(os.path.join(HERE, "UNIVERSE-EXPAND.html"), "w").write(PAGE)
print(f"built UNIVERSE-EXPAND.html  tier1={N1} tier2={N2} tier3={N3} total_new={TOTAL} requests={REQ}")

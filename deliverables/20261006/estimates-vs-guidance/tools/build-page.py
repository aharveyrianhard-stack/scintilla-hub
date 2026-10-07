#!/usr/bin/env python3
# ER1 · builds ESTIMATES-VS-GUIDANCE.html from data/*.json. Usage: python3 tools/build-page.py
import json, os, html
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
J = lambda n: json.load(open(os.path.join(D, "data", n)))
E = J("estimates.json")["names"]; F = J("flags.json"); PX = J("price-runs.json"); Q = J("qwen-reads.json"); FB = J("finbert-headlines.json")
NAMES = ["GOOGL", "AMZN", "WDC", "STX", "MU", "LRCX"]
LONG = {"GOOGL": "Alphabet", "AMZN": "Amazon", "WDC": "Western Digital", "STX": "Seagate", "MU": "Micron", "LRCX": "Lam Research"}
esc = html.escape
def pc(v, d=1):
    if v is None: return "—"
    s = f"{v*100:+.{d}f}%"; return f"<span class='{'up' if v>0 else 'dn' if v<0 else ''}'>{s}</span>"
def pcs(v):  # already in percent
    if v is None: return "—"
    return f"<span class='{'up' if v>0 else 'dn' if v<0 else ''}'>{v:+.1f}%</span>"
def fy(s): return s[:4]
def fyl(t, s):  # label a fiscal year
    return s[:4] if t in ("GOOGL", "AMZN") else "FY" + s[2:4]
out = []
A = out.append
A("""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ER1 · Estimates vs guidance</title>
<style>
:root{--bg:#121314;--panel:#1a1b1c;--line:#2e3032;--ink:#c4c6c8;--dim:#8a8c8e;--faint:#5e6062;--bright:#d0d2d4;--up:#00d68f;--dn:#ff3b5c}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;padding:28px 16px 60px}
main{max-width:1180px;margin:0 auto}h1{font-size:16px;letter-spacing:.08em;color:var(--bright);margin:0 0 4px}
h2{font-size:12px;letter-spacing:.12em;color:var(--bright);margin:34px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}
h3{font-size:11px;letter-spacing:.1em;color:var(--dim);margin:18px 0 6px;font-weight:500}
.sub{color:var(--dim);margin:0 0 18px}.panel{background:var(--panel);border:1px solid var(--line);padding:14px;margin:10px 0}
table{border-collapse:collapse;width:100%;font-size:11px}th,td{text-align:left;padding:4px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--dim);font-weight:500;letter-spacing:.06em}td.r,th.r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.up{color:var(--up)}.dn{color:var(--dn)}.v{letter-spacing:.06em;white-space:nowrap}.v.ok{color:var(--up)}.v.bad{color:var(--dn)}.v.warn{color:var(--bright)}
.kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.kpi div{background:var(--panel);border:1px solid var(--line);padding:10px 12px}.kpi b{display:block;font-size:18px;color:var(--bright);font-weight:600}.kpi span{color:var(--dim);font-size:11px}
.wrap{overflow-x:auto}.small{font-size:11px;color:var(--dim)}q{color:var(--bright);font-style:normal}q:before,q:after{content:'"'}
.chip{display:inline-block;border:1px solid var(--line);padding:1px 7px;letter-spacing:.08em;font-size:10px;color:var(--bright);background:var(--bg)}
.chip.bad{border-color:var(--dn);color:var(--dn)}.chip.ok{border-color:var(--up);color:var(--up)}
ul{padding-left:18px;margin:6px 0}li{margin:3px 0}b{color:var(--bright);font-weight:600}
.mock{overflow-x:auto;background:#000;border:1px solid var(--line);padding:10px 12px;margin:8px 0;font-size:11px}.mock .t{color:var(--dim);letter-spacing:.1em;font-size:10px;margin-bottom:4px}
details.sc-pagespecs{margin-top:40px;border-top:1px solid var(--line);padding-top:12px;color:var(--dim)}details.sc-pagespecs summary{cursor:pointer;color:var(--bright);letter-spacing:.12em}details.sc-pagespecs p{max-width:900px}
@media(max-width:700px){body{padding:20px 16px 50px}.kpi{grid-template-columns:1fr}}
</style></head><body><main>
<span data-scnav-slot></span><h1>ER1 · WHAT THE ANALYSTS SAY AGAINST WHAT THE COMPANIES SAY</h1>
<p class="sub">6 Oct 2026, night · GOOGL, AMZN, WDC, STX, MU (+ LRCX) · a study on a branch · nothing on the Hub changed · branch hub/er1-estimates-guidance-20261006</p>
""")
g, a = F["GOOGL"], F["AMZN"]
A(f"""<div class="kpi">
<div><b class="dn">GOOGL −26% is not real</b><span>the 2026 EPS of {g['fy0_eps']:.2f} carries about ${g['oneOffPerShare']:.2f} a share of paper gains on investments (Alphabet's own words). On the clean base of {g['cleanFy0']:.2f}, 2027 at {g['fy1_eps']:.2f} is {pc(g['growthClean'],0)} growth.</span></div>
<div><b class="dn">AMZN −17% is not real</b><span>the 2026 EPS of {a['fy0_eps']:.2f} carries about ${a['oneOffPerShare']:.2f} a share from the Anthropic mark-up ($53.4B in Q2). Clean base {a['cleanFy0']:.2f}; 2027 at {a['fy1_eps']:.2f} is {pc(a['growthClean'],0)}.</span></div>
<div><b class="up">WDC · STX · MU · LRCX in line</b><span>next-quarter consensus sits within 2% of each company's own EPS guide. The big next-year numbers are the analysts' extrapolation; the companies gave direction, not a number.</span></div>
<div><b>MU revision strip is broken</b><span>Micron's fiscal-year date key changed (28 Aug → 3 Sep) after its 30 Sep report; the Hub's "now vs 60 days ago" cannot join the two copies.</span></div>
<div><b>Massive: Benzinga Corporate Guidance, $99/mo</b><span>the one package that turns this hand-read into a feed: company EPS/revenue guidance with the consensus at the time. Not analyst estimates: FMP stays for those.</span></div>
</div>
<p class="small">How to read this page: "consensus" is the average of the analysts' forecasts that FMP collects and the Hub shows. "Guide" is the number the company itself gave on its last earnings call or press release. Alan's rule: the company's words are the check; analysts' numbers are not law.</p>
""")
# ── 1 · per-name table
A("<h2>1 · PER NAME: THE CURRENT YEAR, WHAT IS INSIDE IT, THE NEXT TWO YEARS, THE GUIDE, AND WHETHER THEY AGREE</h2><div class='panel wrap'><table>")
A("<tr><th>name</th><th>current year</th><th class='r'>EPS consensus</th><th>what is inside it</th><th class='r'>next year</th><th class='r'>year after</th><th>company's own number</th><th>consensus vs guide</th><th>flag</th></tr>")
inside = {
 "GOOGL": f"GAAP. Q1 other income $37.7B and Q2 $98.0B = unrealized gains on equity stakes (CFO: 'primarily due to unrealized gains in our equity securities portfolio'). After tax about ${g['oneOffPerShare']:.2f}/share. Clean 2026 about {g['cleanFy0']:.2f}.",
 "AMZN": f"GAAP. Q1 other income $16.0B and Q2 $53.4B, 'primarily from Amazon's investments in Anthropic' (press release). After tax about ${a['oneOffPerShare']:.2f}/share. Clean 2026 about {a['cleanFy0']:.2f}.",
 "WDC": "Non-GAAP (company's FY26 non-GAAP EPS was $10.22; GAAP diluted was $24.28). The gap is the SanDisk share gains ($5.45B other income in FY26) which sit in GAAP only. The Hub's number is clean.",
 "STX": "Non-GAAP. FY26 (to 3 Jul 2026) is reported: the four quarters add to $15.53; the FMP year row still reads 14.91 (not refreshed to the actual). No one-off inside.",
 "MU": "Non-GAAP $75.52 for FY26 (to 3 Sep 2026), reported 30 Sep; the FMP year row still reads 73.85. GAAP 74.33: no one-off inside.",
 "LRCX": "Non-GAAP about $5.82 for FY26 (to 28 Jun 2026), reported; FMP year row 5.70. GAAP 5.76: no one-off inside.",
}
for t in NAMES:
    f = F[t]; e = E[t]; gd = e["guidance"]
    guide = f"{gd['eps_guide']:.2f} ± {gd['eps_guide_pm']:.2f} next quarter" if gd["eps_guide"] else ("Q3 revenue $197–202B; op income $22.5–26.5B" if t == "AMZN" else "no revenue, margin or EPS number; CapEx $195–205B (2026)")
    nq = e["next_report"]["eps_est"] if e["next_report"] else None
    if gd["eps_guide"]:
        gap = nq / gd["eps_guide"] - 1
        vs = f"next-quarter consensus {nq:.2f} vs guide {gd['eps_guide']:.2f}: {pc(gap)} → <span class='v ok'>{f['guideVerdict']}</span>"
    elif t == "AMZN":
        vs = "Q3 revenue consensus $202.0B sits at the top of the $197–202B range → <span class='v warn'>AT TOP OF GUIDE</span>; no EPS to check"
    else:
        vs = "<span class='v warn'>NO EPS GUIDE</span> · nothing to check the 2027 number against; Alphabet guides CapEx only"
    chip = "ok" if f["chip"] == "CONSISTENT" else ("bad" if "ONE-OFF" in f["chip"] or "KEY" in f["chip"] else "")
    A(f"<tr><td><b>{t}</b><br><span class='small'>{LONG[t]}</span></td><td>{fyl(t,f['fy0'])}<br><span class='small'>{'reported' if t in ('WDC','STX','MU','LRCX') else 'two quarters reported'}</span></td><td class='r'>{f['fy0_eps']:.2f}<br><span class='small'>n {E[t]['annual'][[r['fy'] for r in E[t]['annual']].index(f['fy0'])]['n_eps']}</span></td><td class='small'>{inside[t]}</td>"
      f"<td class='r'>{f['fy1_eps']:.2f} {pc(f['growthShown'],0)}<br><span class='small'>n {f['fy1_n']}{' · clean base: '+pc(f['growthClean'],0) if f['oneOffPerShare'] else ''}</span></td><td class='r'>{f['fy2_eps']:.2f} {pc(f['fy2_eps']/f['fy1_eps']-1,0)}<br><span class='small'>n {f['fy2_n']}</span></td><td class='small'>{esc(guide)}</td><td class='small'>{vs}</td><td><span class='chip {chip}'>{f['chip']}</span></td></tr>")
A("</table></div>")
A("<p class='small'>n = number of analysts behind the average. The growth beside each year is against the year to its left as the Hub shows it; 'clean base' is the growth after the one-off gains are taken out of the current year.</p>")
# ── 2 · company words
A("<h2>2 · THE COMPANIES' OWN WORDS (latest call and filing)</h2>")
for t in NAMES:
    e = E[t]; gd = e["guidance"]
    A(f"<div class='panel'><h3>{t} · {esc(gd['call'])}</h3><ul>")
    for qte in gd["quotes"]: A(f"<li><q>{esc(qte)}</q></li>")
    if gd.get("press_release"): A(f"<li>Press release: <q>{esc(gd['press_release'])}</q></li>")
    A("</ul>")
    A(f"<p><b>What it actually guides:</b> {esc(gd['what_it_guides'])}</p><p><b>Consensus against it:</b> {esc(gd['verdict'])}</p>")
    fl = ", ".join(f"{x['date']} {x['form']}" for x in e["filings_recent"][:4]) or "no 10-Q/10-K/8-K in the window"
    tr_list = ", ".join("FY%s Q%s (%s, %s words)" % (x["fy"], x["q"], x["date"], format(x["words"], ",")) for x in e["transcripts"])
    A("<p class='small'>Transcripts read: " + tr_list + ". Latest filings on FMP's list: " + esc(fl) + ". The 10-Q/10-K bodies were not parsed; the numbers above come from the calls and press releases, and the income statements from FMP.</p></div>")
# ── 3 · revisions
A("<h2>3 · THE TREND IN REVISIONS (what the Hub holds)</h2><div class='panel wrap'><table><tr><th>name</th><th>year</th><th class='r'>11 Aug copy</th><th class='r'>6 Oct copy</th><th class='r'>change (56 days)</th><th class='r'>analysts then → now</th></tr>")
for t in NAMES:
    e = E[t]
    for fyk, snaps in sorted(e["snapshots"].items()):
        if fyk < "2026-01-01" or len(snaps) < 2: continue
        s0, s1 = snaps[0], snaps[-1]
        A(f"<tr><td>{t}</td><td>{fyl(t,fyk)}</td><td class='r'>{s0['eps']:.2f}</td><td class='r'>{s1['eps']:.2f}</td><td class='r'>{pc(s1['eps']/s0['eps']-1)}</td><td class='r'>{s0['n']} → {s1['n']}</td></tr>")
mu = E["MU"]["snapshots"]
A(f"<tr><td>MU</td><td>FY27 (key changed)</td><td class='r'>{mu['2027-08-28'][0]['eps']:.2f} <span class='small'>(date key 2027-08-28)</span></td><td class='r'>{mu['2027-09-03'][-1]['eps']:.2f} <span class='small'>(key 2027-09-03)</span></td><td class='r'>{pc(mu['2027-09-03'][-1]['eps']/mu['2027-08-28'][0]['eps']-1)}</td><td class='r'>{mu['2027-08-28'][0]['n']} → {mu['2027-09-03'][-1]['n']}</td></tr>")
A(f"<tr><td>MU</td><td>FY28 (key changed)</td><td class='r'>{mu['2028-08-28'][0]['eps']:.2f}</td><td class='r'>{mu['2028-09-03'][-1]['eps']:.2f}</td><td class='r'>{pc(mu['2028-09-03'][-1]['eps']/mu['2028-08-28'][0]['eps']-1)}</td><td class='r'>{mu['2028-08-28'][0]['n']} → {mu['2028-09-03'][-1]['n']}</td></tr>")
A("</table></div>")
A("""<p><b>Plainly:</b> the Hub keeps one copy a day of FMP's estimates only since 2 Oct, plus one older copy (11 Aug) rebuilt from a mirror. So the honest revision read today is "11 Aug → 6 Oct" (56 days): small upward drift for GOOGL, AMZN, WDC, STX and LRCX next year (+1% to +3%), a cut of 5% in the thin third year for WDC and STX, and a jump of 12% to 25% for Micron after its 30 Sep report. A true 30 / 90 / 180-day trend needs 180 days of daily copies: it will exist from about April 2027 if the daily job keeps running. FMP itself keeps no history of annual estimates.</p>
<p><b>A bug found on the way:</b> Micron's fiscal year-end key moved from 28 Aug to 3 Sep when FMP rolled its calendar after the report. The Hub's revision block joins copies on that key, so for MU it will show "—" instead of the +12% move. Fix on the Hub: join on the fiscal YEAR (first four characters), not the exact date. Not changed here (study only).</p>""")
# ── 4 · report dates
A("<h2>4 · WHEN THEY REPORT NEXT</h2><div class='panel wrap'><table><tr><th>name</th><th>next report (FMP calendar)</th><th class='r'>EPS expected</th><th class='r'>revenue expected</th><th>confirmed by the company?</th></tr>")
conf = {"GOOGL": "not yet announced; Alphabet usually names the date about two weeks before (a web search found only 2025's date)", "AMZN": "not yet announced; Amazon reports on a Thursday in late October", "WDC": "not yet announced", "STX": "not yet announced", "MU": "not yet announced; Micron's December call has fallen on 17–23 Dec in recent years", "LRCX": "not yet announced"}
for t in NAMES:
    n = E[t]["next_report"]
    A(f"<tr><td>{t}</td><td>{n['date']}</td><td class='r'>{n['eps_est']:.2f}</td><td class='r'>${n['rev_est_b']:.1f}B</td><td class='small'>{esc(conf[t])}</td></tr>")
A("</table></div><p class='small'>Dates are FMP's calendar as of 7 Oct 2026 (its lastUpdated field says 2026-10-07). Treat them as expected, not confirmed.</p>")
# ── 5 · local models
A("<h2>5 · THE LOCAL MODELS' READ (Qwen on the transcripts, FinBERT on the headlines)</h2>")
A("<div class='panel wrap'><h3>QWEN2.5-7B-INSTRUCT (llama.cpp, this MacBook, Metal) · asked for the guidance sentences and a tone</h3><table><tr><th>name</th><th class='r'>words fed</th><th class='r'>seconds</th><th>tone</th><th>the numeric guide it found</th><th>quality</th></tr>")
qual = {"GOOGL": "Padded: after the CapEx line it repeated 'we are seeing strong…' sentences that are not guidance. The regex pass found the real outlook lines.", "AMZN": "Good: both Q3 ranges and the 2027 capacity lines, exact. Tone 'cautious' is defensible (the CFO's own caveats).", "WDC": "Good: all four guided numbers, exact.", "STX": "Mostly good: revenue, EPS and CapEx exact; it stitched one sentence ('we expect September quarter non-GAAP operating margin is expected…') and misquoted 'I'm not guiding for the future' as 'we are guiding for the future'.", "MU": "Weak: the FMP transcript for MU is the Q&A-only analyst call (5,523 words) and holds no numbers; the guide came from the press release instead.", "LRCX": "Good: revenue, margins and EPS exact; tone bullish."}
for t in NAMES:
    r = Q[t]; ans = r["answer"]; tone = ans.split("TONE:")[-1].strip().split("\n")[0][:90] if "TONE:" in ans else "—"
    nums = [l.strip("- ").strip('"') for l in ans.split("\n") if l.startswith("-") and ("$" in l or "%" in l)][:3]
    A(f"<tr><td>{t}</td><td class='r'>{r['words_fed']:,}</td><td class='r'>{r['seconds']}</td><td>{esc(tone)}</td><td class='small'>{'<br>'.join(esc(x[:140]) for x in nums) or '—'}</td><td class='small'>{esc(qual[t])}</td></tr>")
A("</table><p class='small'>Verdict on the method: a plain keyword pass (capex, guidance, outlook, expect, margin, 2027) found every guidance sentence on all six transcripts; Qwen is a useful second reader for tone and for pulling the exact numbers out, but it must not be the only reader (it padded GOOGL and misquoted one STX line). The full Qwen answers are in data/qwen-reads.json.</p></div>")
A("<div class='panel wrap'><h3>FINBERT ON THE LAST 40 HEADLINES PER NAME (FMP stock news, 5–6 Oct 2026)</h3><table><tr><th>name</th><th>ModernFinBERT (the model M1 adopted)</th><th>ProsusAI FinBERT (the classic)</th><th>what the headlines were about</th></tr>")
about = {"GOOGL": "nuclear and data-centre power deals (Constellation, Black Hills), securities class-action notices, product items", "AMZN": "'surpasses market', holiday-rush picks, cloud comparisons, one analyst price target", "WDC": "two days of falls on Toshiba's plan to double HDD output (2 and 6 Oct), one 'rebound' day, one '140% to come' note", "STX": "the same Toshiba story, 'a big Toshiba problem' (Barron's), analysts calling the drop overdone", "MU": "'$100B cash windfall' (JPMorgan), 'tighter market through 2028', 'not at its peak yet', one 'memory peak' caution", "LRCX": "semiconductor picks, '$390 target meets earnings test', AI storage demand"}
for t in NAMES:
    m = FB[t]["ModernFinBERT"]; p = FB[t]["FinBERT (ProsusAI)"]
    cm = {k: sum(1 for r in m if r["label"] == k) for k in ("bullish", "neutral", "bearish")}
    cp = {k: sum(1 for r in p if r["label"] == k) for k in ("positive", "neutral", "negative")}
    A(f"<tr><td>{t}</td><td><span class='up'>{cm['bullish']} bullish</span> · {cm['neutral']} neutral · <span class='dn'>{cm['bearish']} bearish</span></td><td><span class='up'>{cp['positive']} positive</span> · {cp['neutral']} neutral · <span class='dn'>{cp['negative']} negative</span></td><td class='small'>{esc(about[t])}</td></tr>")
A("</table><p class='small'>ModernFinBERT reads direction; ProsusAI's FinBERT calls most trader headlines neutral (the M1 bake-off found the same). Headline mood says nothing about the estimate question: WDC and STX read bearish this week because of Toshiba, while their estimates drifted up. Per-headline labels are in data/finbert-headlines.json.</p></div>")
# ── 6 · the flag
A("<h2>6 · THE FLAG: 'ESTIMATE VS GUIDANCE INCONSISTENCY' (a mechanical rule, proposed)</h2>")
A("""<div class='panel'><p><b>One rule, four checks, nothing hand-tuned per name</b> (code: tools/flag-rule.mjs; its tests: tests/er1-estimate-flag.test.mjs, 7 passing).</p>
<ol>
<li><b>Basis.</b> Add up the street "actual" EPS of the reported quarters and the GAAP diluted EPS of the same quarters. Within 10% of each other → the consensus is on a GAAP basis (Alphabet, Amazon, Micron, Lam). Far apart → it is non-GAAP (Western Digital, Seagate) and one-off gains are already outside it.</li>
<li><b>One-offs.</b> In a reported quarter of the current year, if other (non-operating) income is more than 25% of pre-tax profit, that quarter carries a one-off. Take it after tax at the quarter's own rate, divide by the diluted shares, add up. If that is at least 15% of the year's consensus EPS and the basis is GAAP → <span class='chip bad'>ONE-OFF</span>, and the clean base = consensus − one-offs. Next-year growth is then shown against the clean base.</li>
<li><b>Guide.</b> Next-quarter consensus against the company's guided EPS midpoint: within ±5% → IN LINE; else <span class='chip'>ABOVE GUIDE</span> / <span class='chip'>BELOW GUIDE</span>. No EPS guide (Alphabet, Amazon) → <span class='chip'>NO-EPS-GUIDE</span>: say so rather than pretend.</li>
<li><b>Trust.</b> Next year with fewer than 10 analysts → THIN; range (high−low) above 40% of the average → WIDE. The Hub's own copy: no snapshot in 3 days → STALE; fiscal-date key changed → <span class='chip bad'>KEY-CHANGED</span>.</li>
</ol>
<p>Thresholds (25%, 15%, ±5%, 10, 40%, 3 days) are listed in one place at the top of the rule file, so they can be argued over and changed without touching logic. The 25% / 15% pair follows the way Alphabet's and Amazon's own press releases separate 'other income' from operating income; the ±5% band is the usual beat/miss tolerance in the earnings-surprise tables.</p></div>""")
A("<div class='panel wrap'><table><tr><th>name</th><th>basis</th><th class='r'>one-off / share</th><th class='r'>clean base</th><th class='r'>next-year growth shown</th><th class='r'>on the clean base</th><th>guide check</th><th>flags</th></tr>")
for t in NAMES:
    f = F[t]
    chips = " ".join("<span class='chip %s'>%s</span>" % ("bad" if x["code"] in ("ONE-OFF","KEY-CHANGED","ABOVE-GUIDE","BELOW-GUIDE") else "", x["code"]) for x in f["flags"]) or "<span class='chip ok'>CONSISTENT</span>"
    A(f"<tr><td>{t}</td><td>{f['basis']}</td><td class='r'>{f['oneOffPerShare']:.2f}</td><td class='r'>{f['cleanFy0']:.2f}</td><td class='r'>{pc(f['growthShown'],0)}</td><td class='r'>{pc(f['growthClean'],0)}</td><td>{f['guideVerdict']}</td><td>{chips}</td></tr>")
A("</table></div>")
A("""<h3>WHERE IT SHOWS ON THE HUB (proposal, not built)</h3>
<div class='mock'><div class='t'>ESTIMATES · 00 REVISIONS · a new first line, above the three target arrows</div>
<div>GOOGL &nbsp;<span class='chip bad'>ONE-OFF</span> <span class='chip'>NO-EPS-GUIDE</span> &nbsp;2026 EPS 20.61 holds ~8.92/sh of investment gains · clean 11.69 · 2027 15.15 = +30% on the clean base (−26% as shown) · Alphabet guides CapEx only ($195–205B)</div>
<div style='margin-top:4px'>WDC &nbsp;<span class='chip'>GAAP-GAIN-OUTSIDE</span> &nbsp;Q1 FY27 consensus 4.07 vs guide 4.00 ± 0.15 · IN LINE · FY27 20.39 needs $5.44 a quarter after that: the company says 'accelerate', not a number</div>
<div style='margin-top:4px'>MU &nbsp;<span class='chip bad'>KEY-CHANGED</span> &nbsp;FQ1-27 consensus 38.11 vs guide 38.15 ± 1.00 · IN LINE · revision strip cannot join 28 Aug / 3 Sep copies</div></div>
<ul>
<li><b>ESTIMATES tab, 00 REVISIONS block:</b> one line per name as above (the block already reads analyst_estimates_daily, so the inputs are there; the quarterly income statement and the guide are the two new inputs).</li>
<li><b>Comps (growth credit column):</b> use the clean base and the forward CAGR from section 7, never the shown current-year → next-year change. A ONE-OFF name gets its growth from the clean base; a THIN or WIDE year gets no credit.</li>
<li><b>DCF:</b> the starting EPS/free-cash-flow year is the clean base; the fade starts from the forward CAGR of section 7.</li>
<li><b>Company page header:</b> a small chip beside the P/E, because a P/E on 20.61 for Alphabet (17×) and on 11.69 (30×) tell different stories.</li>
</ul>""")
# ── 7 · long-term growth
A("<h2>7 · LONG-TERM GROWTH: THE LONGEST HORIZON ANALYSTS GIVE, AS A CAGR, WITH THE ANALYST COUNT</h2><div class='panel wrap'><table><tr><th>name</th><th class='r'>FY+1 EPS (n)</th><th class='r'>FY+2 (n)</th><th class='r'>FY+3 (n)</th><th class='r'>FY+4 (n)</th><th>reliable horizon (≥10 analysts)</th><th class='r'>EPS CAGR</th><th class='r'>revenue CAGR</th><th>use</th></tr>")
use = {"GOOGL": "3-yr 18% from the clean 2027 base; the usual 'next-year dip' must not enter the comps", "AMZN": "3-yr 24%, but 2030 rests on 14 analysts; 2-yr to 2029 (24 analysts) is the safer figure: " + f"{(F['AMZN']['fy3_eps']/F['AMZN']['fy1_eps'])**0.5*100-100:.0f}%", "WDC": "only one reliable year ahead (FY28, 10 analysts); FY29 has 4, FY30 has 1: no 3-year credit", "STX": "one reliable year (FY28, 11 analysts); FY29 has 4: no 3-year credit", "MU": "one reliable year (FY28, 20); FY29 has 7 and is flat (+3%): the analysts themselves see the peak", "LRCX": "2-yr 22% to FY29 (10 analysts); FY30 (6) is flat"}
for t in NAMES:
    f = F[t]; c = f["cagr"]; fy4 = ("%.2f (%s)" % (f["fy4_eps"], f["fy4_n"])) if f.get("fy4_eps") else "—"
    A(f"<tr><td>{t}</td><td class='r'>{f['fy1_eps']:.2f} ({f['fy1_n']})</td><td class='r'>{f['fy2_eps']:.2f} ({f['fy2_n']})</td><td class='r'>{f['fy3_eps']:.2f} ({f['fy3_n']})</td><td class='r'>{fy4}</td><td>{fyl(t,c['from'])} → {fyl(t,c['to'])} ({c['years']} yr; {c['n_from']} → {c['n_to']} analysts)</td><td class='r'>{pc(c['eps'])}</td><td class='r'>{pc(c['rev'])}</td><td class='small'>{esc(use[t])}</td></tr>")
A("</table></div><p class='small'>FY+1 is the first full consensus year after the current one (2027 for GOOGL and AMZN; FY27 for the July/September fiscal names, which has just begun). The CAGR runs from FY+1 to the last year with at least 10 analysts, so the number never leans on a year that one or two analysts wrote. FMP shows years to 2030 (LRCX to FY31) but the counts fall to 1–7 at the end for the storage names.</p>")
# ── 8 · plain words + runs
A("<h2>8 · WDC IN PLAIN WORDS · STX AND LRCX IN TWO LINES · WHY EACH RAN AND WHAT LED AFTER</h2>")
A("""<div class='panel'><p><b>Western Digital after SanDisk.</b> On 21 Feb 2025 Western Digital split in two. The flash-memory half (USB sticks, SSD, NAND chips) became SanDisk (SNDK). Western Digital kept the hard-disk-drive business: the big spinning drives that cloud data centres buy by the exabyte (its 'Cloud' segment), plus drives for PCs and external consumer drives. It held on to 19.9% of SanDisk's shares, then used them: 5.8 million shares went to lenders to cancel $3.1B of debt (Q3 FY26), and the last 1.7 million were swapped for 4.8 million of its own shares (Q4 FY26). Those swaps are the $5.45B of 'other income' that made GAAP EPS $24.28 while the business earned $10.22 non-GAAP. The Hub's FY26 figure (9.99, non-GAAP) is the business number; nothing of SanDisk is in it. What it sells now: nearline drives (UltraSMR, ePMR up to 40 TB, HAMR next), 36% revenue growth in FY26, gross margin 49% rising to a 55–56% guide, no new factory capacity needed.</p>
<p><b>Seagate (STX).</b> The other half of the hard-drive duopoly (each holds over 40% of the market), first to ship heat-assisted (HAMR, 'Mozaic') drives at scale; FY26 revenue +34%, gross margin 52.7%, EPS +90%, and it guides FY27 revenue growth above that. It ran on the same AI-storage shortage as WDC, with pricing locked for all of calendar 2027.</p>
<p><b>Lam Research (LRCX).</b> Makes the etch and deposition tools that memory and logic fabs buy; FY26 revenue $23.2B (record), gross margin 50.6%, and it lifted its 2026 industry-spend view to about $150B. It ran because every memory maker (Micron's FY27 CapEx is up, mostly construction) has to buy tools; it calls 2027 'an extraordinary setup' but refuses a number.</p></div>""")
A("<div class='panel wrap'><table><tr><th>name</th><th class='r'>close 6 Oct</th><th class='r'>1 month</th><th class='r'>3 months</th><th class='r'>6 months</th><th class='r'>year to date</th><th class='r'>6-month high (date)</th><th class='r'>off the high</th><th>why it ran · what happened next</th></tr>")
why = {"GOOGL": "Gemini and Cloud (cloud margin 35.6%, backlog to 2027) and the investment mark-ups; eased 5% over three months as CapEx ($195–205B) and negative free cash flow weighed", "AMZN": "AWS 'booming', $25B chips business, Anthropic mark-up; flat for a month, the market now waits for Q3 (29 Oct)", "WDC": "AI data-centre drive shortage, pricing up, margins doubling; peaked 18 Jun, then −45%: Toshiba's plan to double HDD output (2 Oct) and the 'no new capacity' story turned into 'someone else's new capacity'", "STX": "same shortage, HAMR lead, FY27 contracts priced; peaked 22 Jun, −26% since, Toshiba hit it hardest (−12% on 2 Oct)", "MU": "DRAM/HBM shortage, EPS from $7.59 to $75.52 in a year; peaked 25 Jun, but it is the one that LED again: +11% over three months while the drive makers fell", "LRCX": "tool demand from the memory build-out; −23% off the 30 Jun high but +8.5% in the last month: the lead passed from the drive makers to memory (MU) and its tool maker (LRCX)"}
for t in NAMES + ["SNDK"]:
    p = PX[t]
    A(f"<tr><td>{t}</td><td class='r'>{p['close']:,.2f}</td><td class='r'>{pcs(p['r1m'])}</td><td class='r'>{pcs(p['r3m'])}</td><td class='r'>{pcs(p['r6m'])}</td><td class='r'>{pcs(p['ytd'])}</td><td class='r'>{p['hi6m']:,.2f} ({p['hi6m_date'][5:]})</td><td class='r'>{pcs(p['off_high'])}</td><td class='small'>{esc(why.get(t, 'the flash half of the old Western Digital: +600% YTD on NAND pricing, −29% off its 25 Jun high; shown for scale'))}</td></tr>")
A("</table></div><p class='small'>Prices from the chart API (daily bars, split-adjusted, last bar 6 Oct 2026). 'Off the high' is against the highest close of the last six months. The sequence in one line: the drive makers (WDC, STX) ran first into June on the storage shortage; since July the memory maker (MU) and its tool supplier (LRCX) took the lead; Toshiba's 2 Oct capacity plan knocked the drive makers down again while memory held.</p>")
# ── 9 · Massive
A("""<h2>9 · MASSIVE'S ANALYST / FUNDAMENTALS ADD-ONS (read, not bought)</h2>
<div class='panel wrap'><table><tr><th>package (massive.com/pricing and /partners/benzinga, read 6 Oct 2026)</th><th class='r'>price</th><th>what it holds</th><th>horizon</th><th>updated</th><th>history · coverage</th><th>fits us?</th></tr>
<tr><td><b>Benzinga Corporate Guidance</b> · GET /benzinga/v1/guidance</td><td class='r'>$99/mo ($79/mo paid yearly)</td><td>company-issued EPS and revenue guidance: min / max / 'estimated' consensus at the time of the announcement, prior guidance, GAAP vs adjusted method, primary vs secondary, importance 0–5, fiscal period and year</td><td>whatever period the company names: next quarter for most; full year or next fiscal year when the company gives one (Seagate's FY27 'faster than FY26' would be a secondary, non-numeric item: not captured)</td><td>'every 2 hours'</td><td>since 12 Sep 2011 · '9,000+ US tickers'</td><td><span class='v ok'>YES</span> · this is the input the flag's check 3 needs, as a feed instead of reading calls by hand</td></tr>
<tr><td>Benzinga Earnings · /benzinga/v1/earnings</td><td class='r'>$99/mo</td><td>results and upcoming dates, EPS and revenue actual vs estimate, surprise %, importance</td><td>next scheduled report only; no FY+1/FY+2 consensus</td><td>real time</td><td>since 30 Apr 2010</td><td><span class='v warn'>NO</span> · FMP's earnings calendar already gives this (section 4)</td></tr>
<tr><td>Benzinga Analyst Ratings (includes Consensus Ratings) · /benzinga/v1/ratings, /consensus-ratings/{ticker}</td><td class='r'>$99/mo</td><td>every rating action with analyst and firm, price target current and prior, action, importance; consensus rating, target, counts</td><td>12-month price targets</td><td>ratings real time; consensus every 2 hours</td><td>since 8 Dec 2011 · '13+ years'</td><td><span class='v warn'>LATER</span> · richer than FMP's price-target rows (analyst names, importance), but A4 already cleaned FMP's; not needed for this question</td></tr>
<tr><td>Benzinga Analyst Insights · /benzinga/v1/analyst-insights</td><td class='r'>$99/mo</td><td>the sentence behind each rating ('insight'), rating, target</td><td>—</td><td>real time</td><td>since 2 Jan 2020 (page) / 2023 (pricing card)</td><td><span class='v warn'>NO</span> for now</td></tr>
<tr><td>Benzinga News · Bulls &amp; Bears Say · Analyst / Firm Details</td><td class='r'>$99/mo each</td><td>full-text news with tickers; bull/bear case summaries; analyst performance scores</td><td>—</td><td>real time</td><td>news since 2009; '1,000+ daily headlines'</td><td><span class='v warn'>NO</span> · the X/YouTube/FMP news lanes cover this</td></tr>
<tr><td>Massive Financials &amp; Ratios (its own)</td><td class='r'>$29/mo stand-alone; included in Stocks Advanced $199</td><td>income statement, balance sheet, cash flow, ratios, float, short interest, short volume</td><td>reported periods only</td><td>—</td><td>—</td><td><span class='v warn'>NO</span> · reported financials only; no estimates, no guidance; FMP gives the same statements</td></tr>
</table></div>
<p><b>What none of them gives:</b> forward annual consensus EPS and revenue by year (FY+1 … FY+4) with analyst counts and a revision history. That stays FMP (analyst-estimates), and the daily copy the Hub keeps is the only revision history we will have.</p>
<p><b>Recommendation:</b> if Alan wants the flag mechanical, buy <b>Benzinga Corporate Guidance</b> alone: $99 a month ($79 on a yearly plan), individual-use licence, 2-hourly updates, 15 years of history, GAAP/adjusted flag, and the consensus at the moment the company spoke, which is exactly the 'estimate vs guidance' pair. Not checked: whether a Benzinga add-on needs a paid Massive Stocks plan underneath (the pricing page lists it under 'partner data add-ons'; the chart API already runs on a Massive stocks plan), rate limits (the docs do not state one for Benzinga routes), and whether the guidance rows carry the words (they carry numbers; Seagate's 'growth faster than FY26' would need the transcript).</p>""")
# ── wrong / not done
A("""<h2>WHAT COULD BE WRONG</h2><ul>
<li>The one-off per share uses each quarter's own effective tax rate and diluted share count; the companies' own after-tax figure may differ by a few percent. The conclusion (the 'dip' is an artefact) does not depend on that.</li>
<li>FMP's annual rows for the just-reported fiscal years (STX 14.91, MU 73.85, LRCX 5.70) have not been refreshed to the actuals (15.53, 75.52, 5.82): the current-year numbers on the Hub for those three are slightly low until FMP rolls them.</li>
<li>Report dates are FMP's projections; none of the six companies had announced its date on 6 Oct.</li>
<li>Micron's transcript on FMP is the Q&amp;A-only analyst call; the numbers came from the press release (8-K of 30 Sep 2026). The 10-Q/10-K bodies were listed but not parsed.</li>
<li>The revision trend covers 56 days from two points, not a daily series; 30/90/180-day figures do not exist yet.</li>
<li>Massive's pricing and plan rules were read from its public pages on 6 Oct; the exact licence (individual vs business) for a product that shows numbers on a private Hub was not checked with Massive.</li></ul>
<h2>WHAT WAS NOT DONE</h2><ul>
<li>Nothing on the Hub changed: no chip, no table write, no deploy. The flag is code plus tests on the branch and a mock of where it would sit.</li>
<li>No purchase and no sign-up at Massive.</li>
<li>No headless screenshots: this page has no Hub component to photograph; the mock above is text.</li>
<li>The keyed FMP read ran on a throw-away Fly machine (created, used, stopped and removed inside this run); nothing keyed ran on the Mac.</li></ul>
<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<p>Sources: FMP stable routes analyst-estimates (annual and quarter), earnings, income-statement (annual and quarter), price-target-consensus, grades-consensus, sec-filings-search, news/stock, earning-call-transcript-dates and earning-call-transcript (78 calls, all HTTP 200, 6 Oct 2026 ~23:40 ET) read on a throw-away machine of app scintilla-massive-stocks-batch and saved as data/estimates.json (reduced) — the raw transcripts are not committed. Hub tables public.analyst_estimates and public.analyst_estimates_daily read with the anon key (read-only). Prices from https://scintilla-massive-chart-api.fly.dev/candles?tf=D. Micron FQ1-27 guide from its 8-K exhibit 99.1 of 30 Sep 2026. Alphabet Q2 2026 and Amazon Q2 2026 press releases (sec.gov) for the one-off wording. Massive pricing and docs pages read 6 Oct 2026.</p>
<p>Models: Qwen2.5-7B-Instruct Q4_K_M under llama.cpp (llama-server, 16k context, Metal) on this MacBook; tabularisai/ModernFinBERT and ProsusAI/finbert via transformers on CPU in a throw-away virtual environment. No paid model API was used.</p>
<p>Tools: tools/er1-fmp.mjs (the Fly read), tools/run-qwen.py, tools/finbert.py, tools/flag-rule.mjs + tools/build-flags.mjs (the rule and its outputs), tools/build-page.py (this page). Test: tests/er1-estimate-flag.test.mjs.</p>
</details>
</main></body></html>""")
open(os.path.join(D, "ESTIMATES-VS-GUIDANCE.html"), "w").write("\n".join(out))
print("page written", sum(len(x) for x in out), "chars")

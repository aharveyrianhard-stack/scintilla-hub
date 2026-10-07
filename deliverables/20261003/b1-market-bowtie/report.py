#!/usr/bin/env python3
"""B1 · writes B1-MARKET-BOWTIE.html (for Alan: pictures first, the soundness table, the names needed, one recommendation,
details in PAGE SPECS) from data/market-bowtie-20261003.json. Plain words; nothing requested at view time."""
import json, os, html
HERE = os.path.dirname(os.path.abspath(__file__))
D = json.load(open(f"{HERE}/data/market-bowtie-20261003.json")); B = D["modes"]["blend"]; C = D["modes"]["close"]
e = html.escape
def f2(v): return "—" if v is None else ("+" if v >= 0 else "−") + f"{abs(v):.2f}"
def pct(v): return "—" if v is None else f"{round(v*100)}%"
def vcls(v): return {"sound": "ok", "thin": "warn", "not yet": "mute"}[v]
V = D["verdicts"]
def vc(d): return f'{d.get("sound",0)} sound · {d.get("thin",0)} thin · {d.get("not yet",0)} not yet'
inds = [i for s in B["sectors"] for i in s["industries"]]
need_sec = {n["t"]: n for s in B["sectors"] for n in s["need"]}
need_ind = {n["t"]: n for i in inds for n in i["need"]}
need_all = {**need_ind, **need_sec}
adr = sum(1 for n in need_all.values() if (n["country"] or "US") != "US")
# how far live and close disagree today (per sector)
drift = max(abs((b["ew"] or 0) - (c["ew"] or 0)) for b in B["sectors"] for c in C["sectors"] if b["label"] == c["label"])

shots = [("strip-heat-1680.png", "LOOK 1 · STRIP · the dashboard's compare strip with a MARKET family: eleven sectors from every name we compute, fanned strongest to weakest · 1680 × 1050"),
         ("strip-bowtie-1680.png", "LOOK 1 · STRIP · the same strip on the BOW TIE reading (equal-weight minus cap-weight, every name) · 1680 × 1050"),
         ("fan-heat-tech-1920.png", "LOOK 2 · FAN · sectors on top, TECH's industries fanned beneath, each with names read / names that exist, share of value, verdict · 1920 × 1080"),
         ("fan-bowtie-financials-1680.png", "LOOK 2 · FAN · the BOW TIE reading, FINANCIALS opened · 1680 × 1050"),
         ("fan-pair-1920.png", "LOOK 2 · FAN · the FUND PAIR reading: the Hub's bow tie today (RSPT − XLK …) next to the market's numbers · 1920 × 1080"),
         ("cohorts-heat-1680.png", "LOOK 3 · COHORTS · Alan's cohorts fanned, each with its verdict · 1680 × 1050"),
         ("fan-close-only-1920.png", "CLOSE ONLY · every name at the 2 Oct close, UTILITIES opened · 1920 × 1080")]

rows = ""
for s in B["sectors"]:
    rows += f'<tr><td class="l">{e(s["label"])}</td><td>{f2(s["ew"])}</td><td>{f2(s["cw"])}</td><td>{f2(s["bowtie"])}</td><td>{s["n_read"]} / {s["n_exist"]}</td><td>{s["n_live"]}</td><td>{pct(s["mv_share"])}</td><td>{s["se"]}</td><td>{s["closes_pass"]} / 6 · swing {s["swing"]}</td><td class="{vcls(s["verdict"])}">{s["verdict"].upper()}</td><td class="dim">{e(" · ".join(s["weak"]) or "—")}</td></tr>'
irows = ""
for s in B["sectors"]:
    for i in s["industries"]:
        irows += f'<tr><td class="dim">{e(s["label"])}</td><td class="l">{e(i["label"])}</td><td>{f2(i["ew"])}</td><td>{f2(i["bowtie"])}</td><td>{i["n_read"]} / {i["n_exist"]}</td><td>{pct(i["mv_share"])}</td><td>{i["se"]}</td><td>{i["closes_pass"]} / 6</td><td class="{vcls(i["verdict"])}">{i["verdict"].upper()}</td><td class="dim">{e(" · ".join(i["weak"]) or "—")}</td></tr>'
crows = ""
for c in B["cohorts"]:
    crows += f'<tr><td class="l">{e(c["label"])}{" · funds / macro" if c["funds_or_macro"] else ""}</td><td>{f2(c["ew"])}</td><td>{f2(c["bowtie"])}</td><td>{c["n_read"]} / {c["n_compute"]}</td><td>{c["n_live"]}</td><td>{c["se"]}</td><td>{c["closes_pass"]} / 6 · swing {c["swing"]}</td><td class="{vcls(c["verdict"])}">{c["verdict"].upper()}</td><td class="dim">{e(" · ".join(c["weak"]) or "—")}</td></tr>'
nrows = ""
for s in B["sectors"]:
    if s["need"]:
        nrows += f'<tr><td class="l">{e(s["label"])}</td><td>{pct(s["mv_share"])} → ≥ 90%</td><td>{", ".join(e(n["t"]) + " (" + e(n["name"] or "") + ", $" + str(n["mcap_bn"]) + " bn)" for n in s["need"])}</td><td>close tier</td><td class="dim">{e(s["need"][0]["why"])}</td></tr>'
thin_inds = [(s, i) for s in B["sectors"] for i in s["industries"] if i["verdict"] == "thin" and i["need"]]
inrows = ""
for s, i in thin_inds:
    inrows += f'<tr><td class="dim">{e(s["label"])}</td><td class="l">{e(i["label"])}</td><td>{pct(i["mv_share"])} → ≥ 90%</td><td>{", ".join(e(n["t"]) + " $" + str(n["mcap_bn"]) + " bn" for n in i["need"][:8])}{" …" if len(i["need"]) > 8 else ""}</td><td>close tier</td></tr>'
pairs = ""
for p in B["pairs"]:
    pairs += f'<tr><td class="l">{e(p["label"])}</td><td>{e(p["ew_fund"])} − {e(p["cw_fund"])}</td><td>{f2(p["diff"])}</td><td>{f2(p["members_bowtie"])}</td><td class="dim">{"agree" if (p["diff"] is not None and p["members_bowtie"] is not None and (p["diff"]>=0)==(p["members_bowtie"]>=0)) else ("—" if p["diff"] is None or p["members_bowtie"] is None else "disagree")}</td></tr>'
mk = B["market"]
page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>SCINTILLA · B1 · the market bow tie — a proposal for Alan (3 Oct 2026)</title><style>
:root{{--bg:#0A0A0F;--panel:#0D0D14;--line:#1A1A2A;--line2:#252538;--ink:#F2F2F8;--ink2:#C6C8DE;--ink3:#9A9AB6;--dim:#868AAA;--mute:#3A3A52;--crk:#00D4FF;--bull:#00FFA3;--bear:#FF2D55;--warn:#e0a24a;--mono:"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace}}
*{{box-sizing:border-box}}html,body{{margin:0;background:var(--bg);color:var(--ink2);font:13px/1.6 var(--mono)}}
main{{max-width:1500px;margin:0 auto;padding:0 18px 60px}}
header.pg{{display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid var(--line)}}
h1{{font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:var(--ink);margin:0;font-weight:600}}
h2{{font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:var(--dim);margin:40px 0 10px;font-weight:600}}
p{{max-width:980px;color:var(--ink2)}} .lead{{font-size:14px;color:var(--ink)}}
figure{{margin:18px 0}}figure img{{width:100%;display:block;border:1px solid var(--line)}}figcaption{{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);margin-top:6px}}
table{{border-collapse:collapse;width:100%;font-size:12px;margin:8px 0 18px}}th,td{{border-bottom:1px solid var(--line);padding:5px 8px;text-align:left;white-space:nowrap;vertical-align:top}}th{{color:var(--dim);font-weight:500;letter-spacing:.1em;text-transform:uppercase;font-size:10px}}
td.l{{color:var(--ink);letter-spacing:.06em;text-transform:uppercase}}td.dim{{color:var(--dim);white-space:normal;max-width:420px}}td.ok{{color:var(--ink3);letter-spacing:.14em}}td.warn{{color:var(--warn);letter-spacing:.14em}}td.mute{{color:var(--mute);letter-spacing:.14em}}
.wrap{{overflow-x:auto}} .num{{font-size:26px;color:var(--ink);font-weight:600;letter-spacing:0}} .tiles{{display:flex;gap:40px;flex-wrap:wrap;margin:18px 0}} .tiles .k{{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--dim)}}
.rec{{border-left:2px solid var(--crk);padding:6px 16px;margin:14px 0;max-width:980px}} a{{color:var(--crk);text-decoration:none}}
.sc-pagespecs{{margin:40px 0 0;border-top:1px solid var(--line);padding-top:12px;color:var(--ink3);font-size:12px;max-width:1100px}}.sc-pagespecs summary{{cursor:pointer;letter-spacing:.2em;text-transform:uppercase;color:var(--dim);font-size:11px}}
</style></head><body><main>
<header class="pg"><div data-scnav-slot></div><h1>B1 · the market bow tie</h1><span style="color:var(--dim);font-size:11px;letter-spacing:.08em;text-transform:uppercase">a proposal on a branch · nothing on the live Hub · 3 Oct 2026</span></header>
<p class="lead">Alan asked for the bow tie of the whole market, at the sector and cohort level, "just to see some heat", and how far we are from aggregates that are statistically sound. This page answers both with real data: every instrument we compute a Geiger for ({D["counts"]["computed_stocks"]:,} names: the {D["counts"]["live_hub"]} the Hub reads live plus the 2 Oct close of every other listed name) against every common stock that exists ({D["counts"]["exist_common"]:,}). The working page is <a href="index.html">index.html</a> beside this one.</p>
<div class="tiles"><div><div class="num">{vc(V["sectors"]).split(" ")[0]} of 11</div><div class="k">sectors sound</div></div><div><div class="num">{V["industries"].get("sound",0)} of {len(inds)}</div><div class="k">industries sound (8+ names)</div></div><div><div class="num">{V["cohorts"].get("sound",0)} of {len(B["cohorts"])}</div><div class="k">cohorts sound</div></div><div><div class="num">{len(need_all)}</div><div class="k">names that would make the thin ones sound · {adr} are foreign listings · all close tier</div></div><div><div class="num">{f2(mk["ew"])} / {f2(mk["cw"])}</div><div class="k">the whole market · equal-weight / cap-weight · bow tie {f2(mk["bowtie"])}</div></div></div>

<h2>The pictures</h2>
{"".join(f'<figure><img src="shots/{f}" alt="{e(cap)}"><figcaption>{e(cap)}</figcaption></figure>' for f, cap in shots)}

<h2>What the market says today (2 Oct close, the Hub live for its 590)</h2>
<p>Read strongest to weakest on the equal-weight reading: {", ".join(f'{s["label"]} {f2(s["ew"])}' for s in B["sectors"])}. The whole market averages {f2(mk["ew"])} equal-weight and {f2(mk["cw"])} cap-weight: the giants are carrying it, by {f2(mk["bowtie"])}. The widest gap is TECH: its average name reads {f2(next(s["ew"] for s in B["sectors"] if s["label"]=="TECH"))} while the same names weighted by market value read {f2(next(s["cw"] for s in B["sectors"] if s["label"]=="TECH"))}: the giants are up, the average tech name is flat.</p>

<h2>Is each sector statistically sound?</h2>
<p>The rule is T12's (3 Oct), so the cohort lane and this one agree: 8 or more names read · standard error at or under 0.10 · held on each of the six closes 25 Sep to 2 Oct. B1 adds one neighbour and tests them together: the names read must carry at least 90 % of the market value of the names that exist, else the aggregate is THIN. Every sector passes count, agreement and steadiness; the five THIN ones are thin only on coverage, and each is one or two foreign listings away from SOUND.</p>
<div class="wrap"><table><tr><th>sector</th><th>equal-wt</th><th>cap-wt</th><th>bow tie</th><th>read / exist</th><th>live</th><th>value covered</th><th>std error</th><th>closes held</th><th>verdict</th><th>why not sound</th></tr>{rows}</table></div>

<h2>The names that would make the thin sectors sound</h2>
<p>All {len(need_sec)} are large foreign companies listed in New York as ADRs. The close job reads Massive's common-stock type, which does not include them, so they have no close Geiger today. None needs the live Hub: the close tier is enough for a sector aggregate.</p>
<div class="wrap"><table><tr><th>sector</th><th>value covered</th><th>names (biggest first)</th><th>tier needed</th><th>why missing</th></tr>{nrows}</table></div>

<h2>One level down: industries</h2>
<p>{len(inds)} FMP industries have 8 or more names read. {V["industries"].get("sound",0)} are sound, {V["industries"].get("thin",0)} thin, {V["industries"].get("not yet",0)} not yet; {V["industries_small"]} more are too small for a verdict and are listed on the working page under their sector. The not-yet industries fail on disagreement, not on count: their names pull in different directions, so one average misleads (the reason the Hub never shows a cohort of fewer than eight names, and the reason the fan opens one sector at a time).</p>
<div class="wrap"><table><tr><th>sector</th><th>industry</th><th>equal-wt</th><th>bow tie</th><th>read / exist</th><th>value covered</th><th>std error</th><th>closes held</th><th>verdict</th><th>why not sound</th></tr>{irows}</table></div>
<p>The thin industries and the names that would make them sound (biggest first, close tier):</p>
<div class="wrap"><table><tr><th>sector</th><th>industry</th><th>value covered</th><th>names</th><th>tier</th></tr>{inrows}</table></div>

<h2>Alan's cohorts</h2>
<p>Measured with the same rule, on the same closes, so the verdicts match T12's where the cohort is the same set. A cohort is its own definition, so coverage is the share of its members we read.</p>
<div class="wrap"><table><tr><th>cohort</th><th>equal-wt</th><th>bow tie</th><th>read / members</th><th>live</th><th>std error</th><th>closes held</th><th>verdict</th><th>why not sound</th></tr>{crows}</table></div>

<h2>Does today's bow tie still mean something at market scale?</h2>
<p>Yes, but it is a different reading, and the page says so with a chip. Today's bow tie on the Hub is a fund pair: the equal-weight sector fund minus its cap-weight twin (RSPT − XLK). Both funds hold only the S&P 500's members of the sector, so the pair says whether the average large cap is stronger than the giants. The market bow tie takes every listed name in the sector (100 to 900) and asks whether the average name is stronger than the market value of the sector. Across the eleven sectors the two agree in sign {D["bowtie_agreement"]["same_sign"]} times out of {D["bowtie_agreement"]["pairs_compared"]} and correlate at {D["bowtie_agreement"]["correlation"]}: they do not measure the same thing. Keep the fund pair where it is (Alan likes it, and it is the S&P's breadth); add the market reading beside it under its own chip.</p>
<div class="wrap"><table><tr><th>group</th><th>fund pair</th><th>pair reads</th><th>market bow tie (every name)</th><th>sign</th></tr>{pairs}</table></div>

<h2>One recommendation</h2>
<div class="rec"><p><b>Ship Look 1 first: a MARKET chip in the compare strip at the top of the dashboard</b>, drawing the eleven sectors from every name we compute (the Hub live, the rest at the close), with names read / that exist, the share of value and the verdict under each column, and the three readings (HEAT, BOW TIE, FUND PAIR) as chips. It needs no new table and no new job: the strip reads the chart API's /v1/scout-geiger once a day beside the Hub's /geiger it already reads. Before it goes live, add the {len(need_sec)} ADRs ({", ".join(sorted(need_sec))}) to the close job's listing so the five thin sectors turn sound; that is a close-tier change, not a Hub admission. Look 2 (the industries fan) follows as a tab once Alan has seen the strip; Look 3 (cohorts) belongs in COHORT COMPARE with the verdict under each column.</p></div>

<details class="sc-pagespecs"><summary>Page specs</summary>
<p><b>Sources, all read-only.</b> Close Geiger: chart API /v1/scout-geiger, run {e(D["as_of"]["close_run"])}, as of {e(D["as_of"]["close"])}, computed {e(D["as_of"]["close_computed_utc"])} ({D["counts"]["computed_close_rows"]:,} rows; the Hub's seven rungs and the live Equalizer receipt {e(D["as_of"]["equalizer_receipt"][:12])}…). Live Geiger: chart API /geiger, computed {e(D["as_of"]["live_computed_utc"])}, 590 names. Six closes: massive_stocks.scout_geiger_daily for {", ".join(D["as_of"]["six_closes"])} (read-only SQL, 33,771 rows). Who exists: FMP /stable/company-screener for NASDAQ, NYSE and AMEX ({D["counts"]["screener_rows"]:,} rows), read once on the Fly bar-service machine on {e(D["as_of"]["screener_fetched_utc"])}; the key never left Fly and no credential is in any file. Kept: active common stocks in FMP's eleven sectors; removed: ETFs, funds, preferreds, notes, warrants, units, rights, SPAC shells, and second share classes and parent-company notes that repeat a company's market value ({D["counts"]["second_classes_dropped"]} symbols, GOOGL for GOOG, PBR-A for PBR, SOJE/SOMN for SO), so one company counts once. The Hub's own classification (public.ticker_industry, public.company_profile) fills in Hub names the screener lacks. Cohorts: public.ticker_membership as exported by T12 on 3 Oct. The Hub's pairs: index.html BOWTIE_PAIRS, copied verbatim.</p>
<p><b>The numbers.</b> Equal-weight = the plain average of the composite Geiger of every name read in the group. Cap-weight = the same names weighted by market cap (FMP's, 3 Oct). Bow tie = equal-weight minus cap-weight. Value covered = market cap of the names read ÷ market cap of the names that exist. Standard error = standard deviation ÷ √n. Closes held = the closes on which the group had 8+ readings with a standard error ≤ 0.10. Swing = the widest difference between the six closes' means. LIVE + CLOSE uses the Hub's live composite for a served name and the close for the rest (Alan, 3 Oct: better a little wrong than a little old); CLOSE ONLY uses the 2 Oct close for all. Today the two differ by at most {drift:.2f} on a sector.</p>
<p><b>What could be wrong.</b> FMP's sector is the authority (U1's standard); a few names sit in a sector Alan would not put them in. {D["counts"]["computed_not_classified"]} computed symbols have no screener row: mostly preferreds, SPAC shells and odd classes we chose to leave out of "exists", so they are not in any column. The close job's "common" type leaves out ADRs, which is why the thin sectors are thin. A Saturday build: the live Hub and the close agree today; on a weekday the LIVE + CLOSE reading mixes an intraday number for 590 names with yesterday's close for the rest, which is exactly Alan's stated preference and is said on the chip. Market caps are FMP's of 3 Oct, not of 2 Oct.</p>
<p><b>What was not done.</b> No table written, nothing deployed, no change to index.html. The ADR listing fix is named, not made (it is a provider-side change on the close job). The 1-member sector placeholders in ticker_membership are not cohorts and are left out. Phone width is not a target for this strip (the Hub's strip is a desktop strip; it halves its columns under 820 px as today's does).</p>
<p><b>Files.</b> build.py (the join and the measure) · data/market-bowtie-20261003.json and data.js (the measured data) · index.html (the working page, three looks, three readings, two sources) · shoot.mjs and shots/ (headless pictures, 1680 × 1050 and 1920 × 1080) · report.py writes this page.</p>
</details>
</main></body></html>'''
open(f"{HERE}/B1-MARKET-BOWTIE.html", "w").write(page)
print("report written", len(page))

#!/usr/bin/env python3
"""O1 · writes O1-OFFHUB.html for Alan from data/soundness-before.json, data/soundness-after.json and data/adr-list-20261005.json.
   Before → after first, then the list by sector / industry, the cost, the machines moved with their rollbacks. Plain words; PAGE SPECS carry the detail."""
import json, os, html
HERE = os.path.dirname(os.path.abspath(__file__)); D = f"{HERE}/data"
e = html.escape
B = json.load(open(f"{D}/soundness-before.json")); A = json.load(open(f"{D}/soundness-after.json")); L = json.load(open(f"{D}/adr-list-20261005.json"))
Bc, Ac = B["b1"]["modes"]["close"], A["b1"]["modes"]["close"]
Bs, As = B["strict"]["modes"]["close"], A["strict"]["modes"]["close"]
def f2(v): return "—" if v is None else ("+" if v >= 0 else "−") + f"{abs(v):.2f}"
def pct(v): return "—" if v is None else f"{round(v*100)}%"
def vcls(v): return {"sound": "ok", "thin": "warn", "not yet": "mute"}[v]
def vc(d, keys=("sound", "thin", "not yet")): return " · ".join(f'{d.get(k,0)} {k}' for k in keys)
inds_b = {(s["label"], i["label"]): i for s in Bc["sectors"] for i in s["industries"]}
inds_a = {(s["label"], i["label"]): i for s in Ac["sectors"] for i in s["industries"]}
sec_b = {s["label"]: s for s in Bc["sectors"]}
sectors_order = sorted(Ac["sectors"], key=lambda s: -(s["mv_exist_bn"] or 0))

# --- the before → after table (sectors)
rows = ""
for sa in sectors_order:
    sb = sec_b[sa["label"]]
    rows += (f'<tr><td class="l">{e(sa["label"])}</td><td>{sb["n_read"]} / {sb["n_exist"]}</td><td>{pct(sb["mv_share"])}</td><td class="{vcls(sb["verdict"])}">{sb["verdict"].upper()}</td>'
             f'<td class="arrow">→</td><td>{sa["n_read"]} / {sa["n_exist"]}</td><td>+{sa["n_adr"]}</td><td>{pct(sa["mv_share"])}</td><td class="{vcls(sa["verdict"])}">{sa["verdict"].upper()}</td>'
             f'<td>{f2(sa["ew"])} / {f2(sa["cw"])}</td></tr>')
# --- industries whose verdict changed
changed = ""
for k, ia in inds_a.items():
    ib = inds_b.get(k)
    if ib and ib["verdict"] != ia["verdict"]:
        changed += (f'<tr><td class="dim">{e(k[0])}</td><td class="l">{e(k[1])}</td><td>{ib["n_read"]} / {ib["n_exist"]} · {pct(ib["mv_share"])}</td><td class="{vcls(ib["verdict"])}">{ib["verdict"].upper()}</td>'
                    f'<td class="arrow">→</td><td>{ia["n_read"]} / {ia["n_exist"]} · {pct(ia["mv_share"])} · +{ia["n_adr"]} ADR</td><td class="{vcls(ia["verdict"])}">{ia["verdict"].upper()}</td><td class="dim">{e(" · ".join(ia["weak"]) or "—")}</td></tr>')
new_inds = [k for k in inds_a if k not in inds_b]
# --- the whole industry table after
irows = ""
for sa in sectors_order:
    for i in sorted(sa["industries"], key=lambda i: -(i["mv_exist_bn"] or 0)):
        ib = inds_b.get((sa["label"], i["label"]))
        irows += (f'<tr><td class="dim">{e(sa["label"])}</td><td class="l">{e(i["label"])}</td><td>{i["n_read"]} / {i["n_exist"]}</td><td>{i["n_adr"]}</td><td>{pct(i["mv_share"])}</td><td>{i["se"]}</td><td>{i["closes_pass"]} / 6</td>'
                  f'<td class="{vcls(ib["verdict"]) if ib else "mute"}">{ib["verdict"].upper() if ib else "under 8 read"}</td><td class="{vcls(i["verdict"])}">{i["verdict"].upper()}</td><td class="dim">{e(" · ".join(i["weak"]) or "—")}</td></tr>')
# --- cohorts
crows = ""
for c in Ac["cohorts"]:
    cb = next((x for x in Bc["cohorts"] if x["label"] == c["label"]), None)
    nr = ", ".join(c["members_no_reading"])
    crows += (f'<tr><td class="l">{e(c["label"])}</td><td>{c["n_read"]}</td><td>{c["se"]}</td><td>{c["closes_pass"]} / 6</td><td class="{vcls(cb["verdict"]) if cb else "mute"}">{cb["verdict"].upper() if cb else "—"}</td>'
              f'<td class="{vcls(c["verdict"])}">{c["verdict"].upper()}</td><td class="dim">{e(" · ".join(c["weak"]) or "—")}{(" · no stock behind: " + e(nr)) if nr else ""}</td></tr>')
# --- the list
lrows = ""
for s, v in sorted(L["by_sector"].items(), key=lambda kv: -kv[1]["mcap_bn"]):
    lrows += f'<tr class="sec"><td class="l" colspan="2">{e(s)}</td><td>{v["n"]}</td><td>{v["new"]}</td><td>${v["mcap_bn"]:,} bn</td><td colspan="3"></td></tr>'
    by_ind = {}
    for r in L["rows"]:
        if r["sector"] == s: by_ind.setdefault(r["industry"], []).append(r)
    for ind, rs in sorted(by_ind.items(), key=lambda kv: -sum(x["mcap_bn"] for x in kv[1])):
        names = ", ".join(f'<b>{e(r["t"])}</b>{"" if not r["already_read"] else "°"} {f2(r["g"])}' for r in rs)
        lrows += f'<tr><td></td><td class="dim">{e(ind)}</td><td>{len(rs)}</td><td>{sum(1 for r in rs if not r["already_read"])}</td><td>${round(sum(r["mcap_bn"] for r in rs)):,} bn</td><td class="names" colspan="3">{names}</td></tr>'
nc = A["b1"]["counts"]; nb = B["b1"]["counts"]
page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>SCINTILLA · O1 · the off-Hub tier made sound (5 Oct 2026)</title><style>
:root{{--bg:#0A0A0F;--line:#1A1A2A;--ink:#F2F2F8;--ink2:#C6C8DE;--ink3:#9A9AB6;--dim:#868AAA;--mute:#3A3A52;--crk:#00D4FF;--bull:#00FFA3;--bear:#FF2D55;--warn:#e0a24a;--mono:"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace}}
*{{box-sizing:border-box}}html,body{{margin:0;background:var(--bg);color:var(--ink2);font:13px/1.6 var(--mono)}}
main{{max-width:1500px;margin:0 auto;padding:0 18px 60px}}
header.pg{{display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid var(--line);flex-wrap:wrap}}
h1{{font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:var(--ink);margin:0;font-weight:600}}
h2{{font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:var(--dim);margin:40px 0 10px;font-weight:600}}
p{{max-width:980px;color:var(--ink2)}} .lead{{font-size:14px;color:var(--ink)}}
table{{border-collapse:collapse;width:100%;font-size:12px;margin:8px 0 18px}}th,td{{border-bottom:1px solid var(--line);padding:5px 8px;text-align:left;white-space:nowrap;vertical-align:top}}th{{color:var(--dim);font-weight:500;letter-spacing:.1em;text-transform:uppercase;font-size:10px}}
td.l{{color:var(--ink);letter-spacing:.06em;text-transform:uppercase}}td.dim{{color:var(--dim);white-space:normal;max-width:460px}}td.ok{{color:var(--bull);letter-spacing:.14em}}td.warn{{color:var(--warn);letter-spacing:.14em}}td.mute{{color:var(--mute);letter-spacing:.14em}}td.arrow{{color:var(--crk)}}
td.names{{white-space:normal;color:var(--ink3)}}td.names b{{color:var(--ink);font-weight:500}} tr.sec td{{border-top:1px solid var(--line)}}
.wrap{{overflow-x:auto}} .num{{font-size:26px;color:var(--ink);font-weight:600;letter-spacing:0}} .tiles{{display:flex;gap:40px;flex-wrap:wrap;margin:18px 0}} .tiles .k{{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--dim)}}
.rec{{border-left:2px solid var(--crk);padding:6px 16px;margin:14px 0;max-width:980px}} a{{color:var(--crk);text-decoration:none}} pre{{background:#0D0D14;border:1px solid var(--line);padding:10px 12px;overflow-x:auto;font-size:11px;color:var(--ink3)}}
.sc-pagespecs{{margin:40px 0 0;border-top:1px solid var(--line);padding-top:12px;color:var(--ink3);font-size:12px;max-width:1100px}}.sc-pagespecs summary{{cursor:pointer;letter-spacing:.2em;text-transform:uppercase;color:var(--dim);font-size:11px}}
@media (max-width:480px){{main{{padding:0 16px 40px}}.tiles{{gap:18px}}}}
</style></head><body><main>
<header class="pg"><div data-scnav-slot></div><h1>O1 · the off-Hub tier made sound</h1><span style="color:var(--dim);font-size:11px;letter-spacing:.08em;text-transform:uppercase">applied to the close tier · nothing on the live Hub · 5 Oct 2026</span></header>
<p class="lead">Alan, 5 Oct: "6 of 11 sound, even in the off-Hub? We definitely need more tickers in that off-Hub list." The off-Hub (close) tier read every US common stock but not one ADR: the night job asked the data provider for the "common stock" type only, and a foreign company's US listing is typed "ADR". Every name B1 said was missing (HSBC, Shell, Toyota, Novartis, BHP, Unilever …) was an ADR. Today the job reads every ADR too: {L["count"]} names, {L["new_to_the_tier"]} of them new to the tier, every one with a reading tonight. Measured on the same rule as B1: <b>all 11 sectors sound</b> (was 6), <b>{Ac["verdicts"]["industries"].get("sound",0)} industries sound</b> (was {Bc["verdicts"]["industries"].get("sound",0)}) and <b>none thin</b> (was {Bc["verdicts"]["industries"].get("thin",0)}). The cohorts did not move ({Ac["verdicts"]["cohorts"].get("sound",0)} of {len(Ac["cohorts"])}): their gaps are not missing names, see below.</p>
<div class="tiles"><div><div class="num">{Bc["verdicts"]["sectors"].get("sound",0)} → {Ac["verdicts"]["sectors"].get("sound",0)} of 11</div><div class="k">sectors sound</div></div>
<div><div class="num">{Bc["verdicts"]["industries"].get("sound",0)} → {Ac["verdicts"]["industries"].get("sound",0)}</div><div class="k">industries sound (8+ names read) · thin {Bc["verdicts"]["industries"].get("thin",0)} → {Ac["verdicts"]["industries"].get("thin",0)}</div></div>
<div><div class="num">{Bc["verdicts"]["cohorts"].get("sound",0)} → {Ac["verdicts"]["cohorts"].get("sound",0)} of {len(Ac["cohorts"])}</div><div class="k">cohorts sound</div></div>
<div><div class="num">{L["count"]}</div><div class="k">ADRs the close tier now reads · {L["new_to_the_tier"]} new · {L["seven_rung"]} on all seven rungs</div></div>
<div><div class="num">{nb["exist_not_computed"]} → {nc["exist_not_computed"]}</div><div class="k">names that exist but had no reading · ${nb["exist_not_computed_value_bn"]:,} bn → ${nc["exist_not_computed_value_bn"]:,} bn of value</div></div></div>

<h2>Before → after · the sectors (the 2 Oct close, every name we compute)</h2>
<div class="wrap"><table><tr><th>sector</th><th>read / exist</th><th>value covered</th><th>before</th><th></th><th>read / exist</th><th>ADRs</th><th>value covered</th><th>after</th><th>equal-wt / cap-wt</th></tr>{rows}</table></div>
<p>The rule is B1's, unchanged: 8 or more names read · standard error at or under 0.10 · held on each of the six closes 25 Sep to 2 Oct · the names read carry at least 90 % of the market value that exists. Before, five sectors were THIN on the last part only; each is now covered at 94 % or better. The six closes were recomputed with the ADRs in (25, 28, 29, 30 Sep, 1 and 2 Oct), so "held on 6 closes" is measured with them, not assumed.</p>

<h2>Before → after · the industries whose verdict changed</h2>
<div class="wrap"><table><tr><th>sector</th><th>industry</th><th>read / exist · covered</th><th>before</th><th></th><th>read / exist · covered · ADRs</th><th>after</th><th>what still holds it back</th></tr>{changed}</table></div>
<p>{len([1 for k, ia in inds_a.items() if inds_b.get(k) and inds_b[k]["verdict"] != ia["verdict"] and ia["verdict"] == "sound"])} industries became SOUND. One went the other way: CHEMICALS was THIN (covered 85 %) and is now fully covered but, with Sasol in, its names agree a touch less on four of the six closes (standard error 0.11 to 0.10 against a limit of 0.10). That is the market, not the list. {len(new_inds)} industries reached 8 names read for the first time ({", ".join(e(k[1]) for k in new_inds)}), so the table now has {Ac["verdicts"]["industries_n"]} industries where B1 had {Bc["verdicts"]["industries_n"]}.</p>

<h2>Why 54 industries are still "not yet" — measured, not guessed</h2>
<p>Not one of them is short of names. Every "not yet" industry is covered at 90 % or better and every name that exists has a reading. They fail T12's agreement test: 40 have names that disagree today (standard error above 0.10) and are not steady across the six closes; 14 agree today but were not held on all six closes. More names cannot fix that: these are small industries (8 to 25 names) whose members genuinely move apart. The cure, if one is wanted, is a wider tolerance or a longer window, which is a rule change for Alan, not a data gap.</p>

<h2>The cohorts: why they did not move</h2>
<div class="wrap"><table><tr><th>cohort</th><th>read</th><th>std error</th><th>closes held</th><th>before</th><th>after</th><th>why</th></tr>{crows}</table></div>
<p>Every stock in every cohort has a reading. The nine "no stock behind" lines in CRYPTO (BTCUSD, ETHUSD …), the two in INDEXES (ESUSD, NQUSD: futures) and the eleven in MACRO (yields, the dollar, oil, gold, silver, VIX) are not stocks: the close tier is built from the whole-market stock day files and cannot read them. Giving those three cohorts a close reading means a second source (the provider's crypto, futures and index feeds), a separate lane. The other nine fail on agreement or steadiness, like the industries above; TECH has only four members.</p>

<h2>The list · every ADR the close tier now reads, by sector and industry</h2>
<p>{L["count"]} ADRs (every active one the provider lists), {L["new_to_the_tier"]} new to the tier; ° marks a name the tree already read as a tree name (TSM, BABA, SK Hynix …), now typed ADR. The number after each name is its 2 Oct composite on the seven rungs. {L["by_sector"].get("— (not in the screener's 11 sectors)", {}).get("n", 0)} ADRs sit in no sector of the screener (small, unclassified listings); they are read all the same.</p>
<div class="wrap"><table><tr><th></th><th>sector / industry</th><th>ADRs</th><th>new</th><th>market value</th><th colspan="3">names · 2 Oct composite</th></tr>{lrows}</table></div>

<h2>The cost</h2>
<div class="wrap"><table><tr><th>pass</th><th>before</th><th>after (measured 5 Oct)</th><th>what it means</th></tr>
<tr><td class="l">nightly close (D / 3D / W)</td><td>5,642 rows · ≈ 50 s · 0 provider calls per name</td><td>5,925 rows · 50 s per session (six sessions in 5 min 30 s) · 0 provider calls per name</td><td class="dim">the job reads one whole-market day file per session; the ADRs' bars were already inside. Nothing was acquired, no bar-service call, no extra request.</td></tr>
<tr><td class="l">seven rungs (16:00 and 20:00 ET)</td><td>5,563 names · 70,353 calls · 393 s (1 Oct)</td><td>5,842 names · 73,983 calls · 2.85 GB · 287 s · 0 failures · 405 MB peak</td><td class="dim">about 3,600 more provider calls per run, two runs a session day: ≈ 7,300 calls and ≈ 280 MB a day more.</td></tr>
<tr><td class="l">tables</td><td>—</td><td>+ 283 rows a night in scout_geiger_daily (one per new ADR) · + 283 rows in scout_geiger_seven</td><td class="dim">kilobytes.</td></tr></table></div>

<h2>The machines moved · with their rollbacks</h2>
<div class="wrap"><table><tr><th>machine</th><th>was</th><th>now</th><th>schedule</th><th>fires</th></tr>
<tr><td class="l">scout-geiger-nightly · 185777d7a27018</td><td>live-112d10c (CODE_COMMIT env said 02ef2a7, stale)</td><td>o1-77d368c · CODE_COMMIT 77d368c</td><td>hourly, re-armed · works once a night after 20:15 ET</td><td>:21</td></tr>
<tr><td class="l">scout-geiger-seven-hourly · 28744406b95608</td><td>p8-7d4f6c7</td><td>o1-77d368c</td><td>hourly, re-armed · works at 16:00 and 20:00 ET</td><td>:17</td></tr></table></div>
<p>Rollback: <code>SCINTILLA 0.5/_archive/backend-fix-20260928/ROLLBACK-o1-offhub-20261005.txt</code> holds the two previous images with their digests, the exact update commands (never with --skip-start, always re-armed with --schedule hourly) and the one-line deletes that remove the ADR rows. The branch is <code>provider/o1-offhub-coverage-20261005</code> @77d368c (code) and @0a3a661 (runbook), on top of the live code line g1-geiger-liveness @8afc9cd. The live Hub, its 590-name universe, the publisher and the chart API were not touched; SK Hynix's admission tonight is lane A5's.</p>

<div class="rec"><b>One recommendation.</b> Keep "who exists" honest the same way: B1 counted Southern Company's listed notes (SOJE, SOMN), Super Micro's preferred and 60 other notes, units and warrants as companies, $300 bn of value no Geiger should ever read. Typing them by the provider's own security type (note, preferred, unit, warrant, right, closed-end fund) leaves 5 names uncomputed, all delisted shells, and changes no verdict today. The measure script here already carries both lines.</div>

<details class="sc-pagespecs"><summary>PAGE SPECS</summary><p>Built by report.py from measure.py's two runs (data/soundness-before.json, data/soundness-after.json) and data/adr-list-20261005.json. Rule: T12 (3 Oct) + B1 (3 Oct), copied line for line from B1's build.py; both modes (blend = live Hub where served, else the close; close = the close only) give the same verdicts today, the close mode is shown. Who exists: FMP /stable/company-screener for NASDAQ, NYSE and AMEX, 17,837 rows read once on a throw-away Fly machine of the batch app at 16:15Z on 5 Oct (the key never left Fly), B1's filters and its one-company-once rule unchanged (72 second classes dropped), the Hub's own classification (public.ticker_industry + public.company_profile) for the served names the screener lacks. Who is typed what: Massive /v3/reference/tickers, every active stock-market listing (13,258: CS 5,319 · ETF 5,530 · ADRC 380 · PFD 427 · WARRANT 436 · FUND 332 · UNIT 307 · SP 159 · RIGHT 125 · ETS 107 · ETV 91 · ETN 45), plus the 2 Oct grouped day (12,601 rows) to say who traded. Before: the route /v1/scout-geiger at 16:17Z (5,642 rows, run scout-geiger-nightly-20261003T002101Z-0a6dbb) and massive_stocks.scout_geiger_daily for the six closes (read-only SQL). After: the same route at 16:36Z (5,925 rows: daily run scout-geiger-once-20261005T162810Z-7a2311, seven run scout-geiger-seven-scout-20261005T162859Z-eab4f3) and the six closes re-read. The change: services/scout-geiger/scout-geiger-job.mjs scoutUniverse asks type=ADRC beside type=CS; rows carry kind 'ADRC'; test suite 26 of 26 (scout-geiger + scout-geiger-seven). Image o1-77d368c built with fly deploy --build-only --push; the six closes recomputed on a throw-away performance-2x machine (mode once, each about 50 s, two sessions retried once after a transient R2 500), then one seven-rung run with the writes on; the machine was stopped and removed. Cohort membership: public.ticker_membership kind=cohort, 56 groups, 18 with 2+ members as B1 read it. Not done: no close reading for crypto pairs, futures, yields or VIX (not stocks); no change to the tree's own files (it reads the route and picks the new rows up on its next load); no screenshot of a Hub screen (none changed). Prior permission limits kept: no publisher log was read by any route; Fly reads were limited to the two scout machines and the throw-aways.</p></details>
</main></body></html>'''
open(f"{HERE}/O1-OFFHUB.html", "w").write(page)
print("written", len(page), "bytes")

#!/usr/bin/env python3
"""Renders COHORT-PROPOSAL.html from the JSON the build wrote. Monochrome (greys only: channels within 24, none above 210),
body text 11px+, explanations in PAGE SPECS at the bottom. Picture first: the tree as an SVG."""
import json, os, html
HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.dirname(HERE)
J = lambda n: json.load(open(os.path.join(D, n)))
W = J("what-we-have.json"); P = J("proposal.json"); MV = J("moves-together.json"); G = J("gaps.json"); TREE = open(os.path.join(D, "tree.txt")).read()
H = P["headings"]; COH = P["cohorts"]
esc = html.escape

# ---------------- SVG tree: MARKET -> headings -> cohorts (counts); dashed line = second parent
order = ["AI", "SEMIS", "SOFTWARE_INTERNET", "ENERGY_POWER", "FRONTIER", "FINANCE", "HEALTH", "MATERIALS_METALS", "INDUSTRIAL", "CONSUMER", "REAL_ESTATE", "CRYPTO", "INTERNATIONAL", "INDEX_LAYER"]
rows = []  # (heading, cohort)
for h in order:
    for c in COH:
        if c["parents"][0] == h: rows.append((h, c))
mag = next(c for c in COH if c["id"] == "MAG7")
ROW = 15; TOP = 44; X0, X1, X2 = 40, 300, 560; WIDTH = 1100
SHORT = {"AI": "AI", "SEMIS": "SEMIS", "SOFTWARE_INTERNET": "SOFTWARE", "ENERGY_POWER": "ENERGY", "FRONTIER": "FRONTIER", "FINANCE": "FINANCE", "HEALTH": "HEALTH", "MATERIALS_METALS": "MATERIALS", "INDUSTRIAL": "INDUSTRIAL", "CONSUMER": "CONSUMER", "REAL_ESTATE": "REAL ESTATE", "CRYPTO": "CRYPTO", "INTERNATIONAL": "INTL", "INDEX_LAYER": "INDEX"}
height = TOP + ROW * (len(rows) + 2) + 30
svg = [f'<svg viewBox="0 0 {WIDTH} {height}" width="100%" style="min-width:{WIDTH}px;display:block" font-family="ui-monospace,Menlo,monospace" font-size="11">']
svg.append(f'<rect width="{WIDTH}" height="{height}" fill="#121314"/>')
ypos = {}
y = TOP
# cohorts
for h, c in rows:
    ypos[c["id"]] = y
    second = f'  ← {SHORT[c["parents"][1]]}' if len(c["parents"]) > 1 else ""
    mt = c.get("moves_together") or {}
    corr = f'{mt["avg_pair_corr"]:.2f} / {mt["sector_avg_pair_corr"]:.2f}' if mt.get("avg_pair_corr") is not None and mt.get("sector_avg_pair_corr") is not None else ""
    svg.append(f'<text x="{X2}" y="{y+4}" fill="#c4c6c8">{esc(c["label"])} <tspan fill="#8a8c8e">({c["n"]})</tspan><tspan fill="#6e7072">{esc(second)}</tspan></text>')
    if corr: svg.append(f'<text x="{WIDTH-12}" y="{y+4}" fill="#8a8c8e" text-anchor="end">{corr}</text>')
    y += ROW
# MAG7 row
ypos["MAG7"] = y; svg.append(f'<text x="{X2}" y="{y+4}" fill="#c4c6c8">{esc(mag["label"])} <tspan fill="#8a8c8e">({mag["n"]})</tspan><tspan fill="#6e7072">  ← THE MARKET</tspan></text>'); y += ROW
# headings: placed at the mean y of their cohorts
hy = {}
for h in order:
    ys = [ypos[c["id"]] for hh, c in rows if hh == h]
    if ys: hy[h] = sum(ys) / len(ys)
for h, yy in hy.items():
    n_c = sum(1 for hh, c in rows if hh == h); n_names = len({t for hh, c in rows if hh == h for t in c["members"]})
    svg.append(f'<text x="{X1}" y="{yy+4}" fill="#d0d2d4" font-weight="600">{esc(H[h]["label"])} <tspan fill="#8a8c8e" font-weight="400">{n_c} · {n_names}</tspan></text>')
    for hh, c in rows:
        if hh == h: svg.append(f'<path d="M{X1+ 8*len(H[h]["label"])+40},{yy} C{X2-40},{yy} {X2-40},{ypos[c["id"]]} {X2-6},{ypos[c["id"]]}" stroke="#4e5052" fill="none"/>')
# second parents: dashed
for c in COH:
    if len(c["parents"]) > 1 and c["parents"][1] in hy and c["id"] in ypos:
        yy = hy[c["parents"][1]]
        svg.append(f'<path d="M{X1+ 8*len(H[c["parents"][1]]["label"])+40},{yy} C{X2-60},{yy} {X2-60},{ypos[c["id"]]} {X2-6},{ypos[c["id"]]}" stroke="#5a5c5e" stroke-dasharray="3 3" fill="none"/>')
# market
my = (TOP + y) / 2
svg.append(f'<text x="{X0}" y="{my+4}" fill="#d0d2d4" font-weight="700">THE MARKET <tspan fill="#8a8c8e" font-weight="400">{P["coverage"]["companies"]} · {P["coverage"]["funds"]} funds</tspan></text>')
for h, yy in hy.items():
    svg.append(f'<path d="M{X0+200},{my} C{X1-40},{my} {X1-40},{yy} {X1-6},{yy}" stroke="#4e5052" fill="none"/>')
svg.append(f'<path d="M{X0+200},{my} C{X2-40},{my} {X2-40},{ypos["MAG7"]} {X2-6},{ypos["MAG7"]}" stroke="#4e5052" fill="none"/>')
svg.append(f'<text x="{WIDTH-12}" y="{TOP-28}" fill="#6e7072" text-anchor="end">right column: moves together, cohort / its sector (6 months)</text>')
svg.append(f'<text x="{X2}" y="{TOP-14}" fill="#6e7072">solid = home parent · dashed = second parent · (n) = names from the 590</text>')
svg.append('</svg>')
SVG = "\n".join(svg)

# ---------------- tables
def tbl(headers, rows, cls=""):
    out = [f'<table class="{cls}"><thead><tr>' + "".join(f"<th>{esc(h)}</th>" for h in headers) + "</tr></thead><tbody>"]
    for r in rows: out.append("<tr>" + "".join(f"<td>{x if isinstance(x, str) and x.startswith('<') else esc('' if x is None else str(x))}</td>" for x in r) + "</tr>")
    out.append("</tbody></table>"); return "\n".join(out)
def f3(v): return "—" if v is None else f"{v:.2f}"
def verdict_short(v):
    if not v: return "—"
    return {"S": "STRONGER", "m": "together, not tighter", "n": "no tighter than random"}[v[0]]
moves_rows = []
for r in MV["proposed"]:
    moves_rows.append([r["cohort"], r["n_priced"], f3(r["avg_pair_corr"]), r["home_sector"] or "—", f3(r["sector_avg_pair_corr"]), f3(r.get("delta_vs_sector")), f3(r["null95_same_size"]), f3(r["corr_with_sector_fund"]), verdict_short(r["verdict"])])
today_rows = [[r["cohort"], r["n_priced"], f3(r["avg_pair_corr"]), r["home_sector"] or "—", f3(r["sector_avg_pair_corr"]), f3(r.get("delta_vs_sector")), f3(r["null95_same_size"]), f3(r["corr_with_sector_fund"]), verdict_short(r["verdict"])] for r in MV["today"]]
sector_rows = [[s["sector"], s["fund"], s["n_priced"], f3(s["avg_pair_corr"])] for s in MV["sectors"]]
inv_rows = []
for r in W["cohorts_table"]:
    ov = ", ".join(f'{o["with"]} ({o["shared"]})' for o in r["top_overlaps"])
    inv_rows.append([r["cohort"], r["kind"], r["parent"] or "—", r["rows"], r["in_universe"], f3(r["avg_pair_corr_6m"]), ov])
loose_rows = []
for c, lst in W["loose_names"].items():
    for x in lst: loose_rows.append([c, x["ticker"], x["name"] or "", x["industry"] or "fund", ", ".join(x["other_cohorts"]) or "—"])
coh_rows = []
for c in COH:
    mt = c.get("moves_together") or {}
    coh_rows.append([c["label"], " + ".join(H[p]["label"] for p in c["parents"]), c["n"], f3(mt.get("avg_pair_corr")), c["spine"], " ".join(c["members"]), " ".join(c["reference_funds"]) or "—", ", ".join(c["from_cohorts"]) or "—"])
gics_rows = [[g["gics_sub_industry"], g["gics_sector"], f'{g["spy_weight_pct"]:.2f}', g["sp500_names"], " ".join(g["we_hold"]) or "none", " ".join(f'{c["ticker"]} ({c["spy_weight_pct"]:.2f})' for c in g["candidates"]) or "—"] for g in G["gics_sub_industries_thin"][:40]]
tf_rows = [[t["fund"], t["name"], t["us_listed_holdings"], t["we_hold"], t["weight_held_pct"], " ".join(f'{m["ticker"]} ({m["weight_pct"]})' for m in t["biggest_missing"])] for t in G["theme_fund_coverage"] if t["us_listed_holdings"] >= 8 and t["we_hold"] <= max(1, t["us_listed_holdings"] // 4)]
idx_rows = [[g["ticker"], g["what"]] for g in G["index_layer_missing"]]
peer_rows = [[g["cohort"], " ".join(f'{c["ticker"]} ×{c["named_by"]}' for c in g["candidates"])] for g in G["fmp_peer_candidates"]]
theme_rows = [[t["theme"], " ".join(t["we_hold"]) or "none", " ".join(t["candidates"]), t["spine"]] for t in G["themes_thin"]]
unc = W["universe_names_in_no_cohort"]["by_sector"]
unc_rows = [[k, len(v), " ".join(v)] for k, v in sorted(unc.items(), key=lambda kv: -len(kv[1]))]
dis_rows = [[k, v] for k, v in P["dissolved_or_demoted"].items()]
S = MV["summary"]

page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CO1 · Cohort proposal</title>
<style>
:root{{--bg:#121314;--panel:#1a1b1c;--line:#2e3032;--ink:#c4c6c8;--dim:#8a8c8e;--faint:#5e6062;--bright:#d0d2d4}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;padding:28px 16px 60px}}
main{{max-width:1180px;margin:0 auto}}h1{{font-size:16px;letter-spacing:.08em;color:var(--bright);margin:0 0 4px}}h2{{font-size:12px;letter-spacing:.12em;color:var(--bright);margin:34px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}}
.sub{{color:var(--dim);margin:0 0 18px}}.panel{{background:var(--panel);border:1px solid var(--line);padding:14px;margin:10px 0}}
table{{border-collapse:collapse;width:100%;font-size:11px}}th,td{{text-align:left;padding:4px 8px;border-bottom:1px solid var(--line);vertical-align:top}}th{{color:var(--dim);font-weight:500;letter-spacing:.06em}}
td:nth-child(n+2){{color:var(--ink)}}.num td:nth-child(2),.num td:nth-child(3),.num td:nth-child(5),.num td:nth-child(6),.num td:nth-child(7),.num td:nth-child(8){{text-align:right;font-variant-numeric:tabular-nums}}
pre{{font-size:11px;line-height:1.45;color:var(--ink);overflow-x:auto;background:var(--panel);border:1px solid var(--line);padding:12px}}
.kpi{{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}}.kpi div{{background:var(--panel);border:1px solid var(--line);padding:10px 12px}}.kpi b{{display:block;font-size:20px;color:var(--bright);font-weight:600}}.kpi span{{color:var(--dim);font-size:11px}}
details.sc-pagespecs{{margin-top:40px;border-top:1px solid var(--line);padding-top:12px;color:var(--dim)}}details.sc-pagespecs summary{{cursor:pointer;color:var(--bright);letter-spacing:.12em}}details.sc-pagespecs p{{max-width:900px}}
.wrap{{overflow-x:auto}}.small{{font-size:11px;color:var(--dim)}}
@media(max-width:700px){{body{{padding:20px 16px 50px}}table{{font-size:11px}}}}
</style></head><body><main>
<h1>CO1 · COHORTS THAT CLASSIFY THE MARKET BETTER THAN THE SECTOR FUNDS DO</h1>
<p class="sub">6 Oct 2026 · a study and a proposal · nothing on the Hub or in the database changed · branch hub/co1-cohorts-20261006</p>

<div class="kpi">
<div><b>{W["cohorts"]}</b><span>cohorts in ticker_cohorts today</span></div>
<div><b>{W["universe_names_in_no_cohort"]["count"]}</b><span>of the 590 sit in no cohort at all</span></div>
<div><b>{len([c for c in COH if not c["id"].startswith("IDX_")])}</b><span>topic cohorts proposed (+ 6 index-layer sets)</span></div>
<div><b>{S["stronger_than_sector"]} / {S["proposed_cohorts_tested"]}</b><span>proposed cohorts move together tighter than their sector</span></div>
<div><b>{S["today_stronger"]} / {S["today_tested"]}</b><span>of today's hand cohorts do</span></div>
<div><b>{P["coverage"]["companies"]}</b><span>companies placed, 0 left over</span></div>
</div>

<h2>1 · THE TREE (parents → cohorts → counts)</h2>
<div class="panel wrap">{SVG}</div>
<pre>{esc(TREE)}</pre>

<h2>2 · DOES EACH COHORT MOVE TOGETHER MORE THAN ITS SECTOR?</h2>
<p class="small">Average pairwise correlation of daily returns, last {MV["window"]["sessions"]} sessions ({MV["window"]["from"]} → {MV["window"]["to"]}), companies only. "Sector" is every one of our names in the cohort's home sector. "Random" is the 95th percentile of 150 random sets of the same size drawn from all our companies. "vs fund" is how the cohort's equal-weight line tracks the sector SPDR.</p>
<div class="wrap">{tbl(["Proposed cohort", "n", "cohort", "home sector", "sector", "Δ", "random", "vs fund", "verdict"], moves_rows, "num")}</div>
<h2>2b · THE SAME TEST ON TODAY'S COHORTS</h2>
<div class="wrap">{tbl(["Today's cohort", "n", "cohort", "home sector", "sector", "Δ", "random", "vs fund", "verdict"], today_rows, "num")}</div>
<h2>2c · THE SECTORS THEMSELVES</h2>
<div class="wrap">{tbl(["Sector (FMP)", "fund", "n priced", "avg pair corr"], sector_rows, "num")}</div>

<h2>3 · THE PROPOSED COHORTS, ONE BY ONE</h2>
<div class="wrap">{tbl(["Cohort", "parent(s)", "n", "corr", "open spine", "members", "reference funds", "from today's"], coh_rows)}</div>
<h2>3b · WHAT HAPPENS TO TODAY'S CONTAINERS</h2>
<div class="wrap">{tbl(["Today", "Proposal"], dis_rows)}</div>

<h2>4 · WHAT WE HAVE TODAY ({W["cohorts"]} cohorts · {W["rows"]} rows · {W["tickers"]} tickers)</h2>
<p class="small">Kinds: {", ".join(f"{v} {k}" for k, v in W["kinds"].items())}. Parents come from the 28 Sep registry file where it names one; ticker_cohorts itself has no parent column. Overlap = the three cohorts sharing most names (shared count).</p>
<div class="wrap">{tbl(["Cohort", "kind", "parent", "rows", "in 590", "corr 6m", "overlaps most with"], inv_rows, "num")}</div>
<h2>4b · NAMES IN GROWTH / THEMATIC / MEGACAP / INTL THAT SIT IN NO TOPIC COHORT</h2>
<div class="wrap">{tbl(["Container", "ticker", "name", "FMP industry", "its other labels (all machine-made or cap/style)"], loose_rows)}</div>
<h2>4c · THE {W["universe_names_in_no_cohort"]["count"]} SERVED NAMES IN NO COHORT AT ALL</h2>
<div class="wrap">{tbl(["Sector", "n", "tickers"], unc_rows)}</div>

<h2>5 · GAPS — WHERE THE MARKET HAS A GROUP AND WE HOLD ZERO OR ONE NAME</h2>
<p class="small">Proposals only. Admissions are the coordinator's and Alan's.</p>
<h2 style="border:0;margin-top:14px">5a · S&amp;P 500 sub-industries by SPY weight (SSgA 22 Sep · GICS from Wikipedia 24 Sep)</h2>
<div class="wrap">{tbl(["GICS sub-industry", "sector", "SPY %", "S&P names", "we hold", "candidates (SPY %)"], gics_rows, "num")}</div>
<h2 style="border:0;margin-top:14px">5b · Theme funds we serve but barely cover (US-listed holdings)</h2>
<div class="wrap">{tbl(["Fund", "name", "US-listed holdings", "we hold", "weight held %", "biggest missing (weight %)"], tf_rows, "num")}</div>
<h2 style="border:0;margin-top:14px">5c · The index layer is missing</h2>
<div class="wrap">{tbl(["Fund", "what it is"], idx_rows)}</div>
<h2 style="border:0;margin-top:14px">5d · Themes we are thin in (named lists)</h2>
<div class="wrap">{tbl(["Theme", "we hold", "candidates", "open spine"], theme_rows)}</div>
<h2 style="border:0;margin-top:14px">5e · FMP's own peer lists: names two or more members of a cohort call a peer</h2>
<div class="wrap">{tbl(["Cohort", "peers we do not serve (× how many members name it)"], peer_rows)}</div>

<h2>6 · WHAT THE APPLY WOULD WRITE (not run)</h2>
<p class="small">One new additive table <code>public.cohort_tree</code> ({len(COH)} rows: cohort, label, parent_1, parent_2, spine) and {sum(c["n"] for c in COH)} membership rows into <code>public.ticker_cohorts</code> under the new cohort ids. Nothing deleted: GROWTH, THEMATIC, MEGACAP and INTL rows stay until Alan says otherwise. The exact statements are in <code>apply-preview.sql</code> beside this page, with the rollback.</p>

<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<p><b>What this page shows.</b> A tree of topic cohorts that sits beside the GICS sectors, not instead of them. Every cohort has one home parent and sometimes a second (AI POWERTRAIN is under AI and under ENERGY &amp; POWER). GROWTH and THEMATIC are split by topic, MAGNIFICENT 7 is a cohort hanging from the market itself, INTL is split by region, and an index layer carries the world benchmarks we serve (VT, VXUS, EFA, EEM, EZU, EWJ …) as reference lines. URTH and ACWI are not served today; VT stands in until they are.</p>
<p><b>Where each number comes from.</b> Cohort rows: public.ticker_cohorts read on 6 Oct through the Hub's own anonymous read (1,282 rows, 119 cohorts, 388 tickers). The 590: the chart API's /universe. Sectors, industries and descriptions: public.company_profile (FMP). Country: the 1 Oct FMP profile export in deliverables/20261001/universe-standard. Fund holdings (the open spine): the 26/28 Sep FMP holdings file for 125 funds in deliverables/20260928/coverage-tree. Prices: the chart API's /candles, tf=D, the last 127 closes per name, 587 of 590 priced (QRVO is no longer observed by the provider; CBRS and SPCX are too new). S&amp;P weights: SSgA's SPY file of 22 Sep; GICS sub-industries: the Wikipedia S&amp;P 500 list of 24 Sep. Parents of today's cohorts: data/cohort-registry-step1.json (28 Sep).</p>
<p><b>Which classification is the spine.</b> Where an open fund defines the theme we used its holdings: SMH/SOXX/XSD (semis), DRAM (memory), IGV/SKYY (software), CIBR (cyber), IPAY/FINX (payments), FDN (internet), MAGS (the seven), ARKX (space), QTUM (quantum), BOTZ (robotics), URA (nuclear), TAN (solar), ITA (defence), PAVE (grid), GDX/GDXJ/SIL (precious metals), COPX (copper), REMX/LIT (critical minerals), IYT/JETS (transport), XHB/ITB (housing), KRE/IAT (regional banks), IAI/IAK/KIE (markets, insurance), IHE/XPH, XBI/IBB, IHI, IHF (health), PEJ (leisure), XRT (retail), VNQ/XLRE/REZ (property), FXI/MCHI/ASHR, EZU/EWG/EWU/EFA, EWJ/EWY, EEM (regions). Where no fund fits, the FMP industry string. Where neither fits (neoclouds &amp; miners, AI powertrain) the rule is written out in the cohort's spine column. Each cohort's spine is printed in section 3.</p>
<p><b>What could be wrong.</b> Six months is one regime: a cohort that moved together this spring may not next year (the 28 Sep study used three years and reached similar verdicts). Three-name cohorts (refiners, services, towers, packaging, housing, IT services) are measured on three pairs and should be read as a hint. Country comes from FMP and is missing for about a third of names; the region cohorts were completed by hand and say so. The holdings file is from 26/28 Sep. Correlations are on log returns of split-adjusted closes as the chart API serves them.</p>
<p><b>What was not done.</b> Nothing was written to ticker_cohorts or any table; no Hub page changed; nothing deployed. URTH/ACWI/ICLN/ARKK holdings were not fetched (not served, and the keys live on Fly). The index layer was not drawn on the tree map. The FMP-industry copies and the sector labels in ticker_cohorts were left alone.</p>
</details>
</main></body></html>"""
open(os.path.join(D, "COHORT-PROPOSAL.html"), "w").write(page); print("wrote COHORT-PROPOSAL.html", len(page), "bytes")

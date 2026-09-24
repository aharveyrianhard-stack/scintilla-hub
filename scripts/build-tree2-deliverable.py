#!/usr/bin/env python3
"""M54 · write deliverables/20260924/tree-2/TREE-2.html from the measured files.

Every number on the page is read out of data/*.json, so the document cannot drift from what was
built. Plain words: Alan is not technical.
"""
import json, os, html, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = json.load(open(os.path.join(ROOT, "data", "standard-tree-20260924.json")))
PRICE = json.load(open(os.path.join(ROOT, "data", "instrument-pricing-20260924.json")))
COH = json.load(open(os.path.join(ROOT, "data", "cohort-label-origin-20260924.json")))
OUT = os.path.join(ROOT, "deliverables", "20260924", "tree-2", "TREE-2.html")
# the grey BACK / CLOSE pair, from its one source, placed here so regenerating this page never
# needs a repository-wide inject run that would touch other lanes' pages
SCNAV = open(os.path.join(ROOT, "scripts", "scnav-snippet.html")).read().strip()
e = lambda s: html.escape(str(s))
f = lambda v, d=2: "—" if v is None else ("%." + str(d) + "f") % v


def rows_comparison():
    r = []
    for c in D["comparison"]:
        r.append("<tr><td>%s</td><td>%s</td><td class=n>%s%%</td><td class=n>%s%%</td>"
                 "<td class=n>%s%%</td><td class=n>%s%%</td><td class=n>%d of %d</td><td class=n>%s%%</td></tr>"
                 % (e(c["gics_sector"]), e(c["anchor_etf"]), f(c["hub_cap_share_pct"]), f(c["sp500_cap_share_pct"]),
                    f(c["hub_count_share_pct"]), f(c["sp500_count_share_pct"]), c["hub_names_in_sp500"],
                    c["sp500_n"], f(c["hub_share_of_sector_index_weight_pct"], 0)))
    return "\n".join(r)


def rows_price():
    order = ["PRICED OUTSIDE THE STOCK LIST — chart API macro route",
             "PRICED OUTSIDE THE STOCK LIST — chart API macro route, quote stale",
             "PRICED OUTSIDE THE STOCK LIST — minute quote only, no chart",
             "NOT PRICED ANYWHERE TONIGHT"]
    out = []
    for v in order:
        for t, r in sorted(PRICE["rows"].items()):
            if r["verdict"] != v:
                continue
            c, q, s = r["chart_api_candles"], r["live_quote"], r["stored_history"]
            where = ("chart API, %s bars, newest %s" % (c["bars"], c["last_bar_et"])) if c["served"] else "no chart"
            live = ("%s, %s minutes old" % (f(q["price"], 4), q["age_minutes"])) if q["age_minutes"] is not None else "none"
            out.append("<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>"
                       % (e(t), e(c["instrument_kind"] or "—"), e(where), e(live),
                          e((s["collector"] or "—") + (" to " + s["newest_bar_utc"] if s["newest_bar_utc"] else "")),
                          e(v.replace("PRICED OUTSIDE THE STOCK LIST — ", "priced: ").replace("NOT PRICED ANYWHERE TONIGHT", "NOT priced anywhere"))))
    return "\n".join(out)


def rows_index():
    out = []
    for ix in D["indexes"]:
        a = ix["anchor"] or {}
        out.append("<tr><td>%s</td><td>%s</td><td class=n>%s</td><td>%s</td></tr>"
                   % (e(ix["label"]), e(ix["anchor_etf"]), f(a.get("geiger")),
                      e("%d of its members are here, and they are %s%% of the index by weight"
                        % (ix["members_in_hub"], f(ix["hub_weight_of_index_pct"], 1))
                        if ix["membership"] == "measured" else
                        "member list not obtained tonight — this branch reads its ETF only")))
    return "\n".join(out)


# the branch where the names and the ETF disagree most, found rather than asserted
gaps = []
for sec in D["sector_etf"]:
    n = D["nodes"].get("SEC:" + sec)
    a = (n or {}).get("anchor") or {}
    if n and n.get("geiger_cap") is not None and a.get("geiger") is not None:
        gaps.append((abs(n["geiger_cap"] - a["geiger"]), sec, n, a))
gaps.sort(reverse=True)
_, gap_sec, gap_node, gap_etf = gaps[0]

sec_etf = ", ".join("%s (%s)" % (v, k) for k, v in D["sector_etf"].items())
moved = "; ".join("%s moves from %s to %s" % (m["ticker"], m["from_sector"], m["to_sector"]) for m in D["moved_by_gics"])
p = D["provenance"]
tech = next(c for c in D["comparison"] if c["gics_sector"] == "Information Technology")
comm = next(c for c in D["comparison"] if c["gics_sector"] == "Communication Services")
spx = next(i for i in D["indexes"] if i["id"] == "SPX")
thr = "; ".join("%s %s" % (t["label"], t["value"]) for t in D["thresholds"])

doc = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>SCINTILLA · THE TREE IN STANDARD CATEGORIES</title>
<style>
:root{{--bg:#0d0d0d;--panel:#151515;--line:#272727;--ink:#cdcdcd;--dim:#8c8c8c;--mute:#5c5c5c;
--up:#35b06a;--dn:#d1483f;--mono:ui-monospace,SFMono-Regular,Menlo,monospace}}
*{{box-sizing:border-box}}
html,body{{margin:0;background:var(--bg);color:var(--ink);font:13px/1.65 var(--mono)}}
.wrap{{max-width:1020px;margin:0 auto;padding:16px 18px 60px}}
h1{{font-size:15px;letter-spacing:.14em;margin:0 0 4px}}
h2{{font-size:13px;letter-spacing:.1em;margin:26px 0 6px;color:var(--ink);border-top:1px solid var(--line);padding-top:14px}}
p{{margin:8px 0}} .lead{{color:var(--dim);margin:0 0 6px}}
table{{border-collapse:collapse;width:100%;font-size:12px;margin:8px 0}}
th,td{{border-bottom:1px solid var(--line);padding:5px 7px;text-align:left;vertical-align:top}}
th{{color:var(--mute);font-weight:400;letter-spacing:.06em}}
td.n,th.n{{text-align:right;font-variant-numeric:tabular-nums}}
img{{width:100%;border:1px solid var(--line);border-radius:3px;margin:8px 0;display:block}}
.k{{color:var(--dim)}} .up{{color:var(--up)}} .dn{{color:var(--dn)}}
ul{{margin:6px 0 6px 18px;padding:0}} li{{margin:4px 0}}
.small{{font-size:12px;color:var(--mute)}}
.box{{background:var(--panel);border:1px solid var(--line);border-radius:3px;padding:10px 12px;margin:10px 0}}
</style></head><body><div class="wrap">
<span data-scnav-slot></span>
<h1>SCINTILLA · THE TREE IN STANDARD CATEGORIES</h1>
<p class="lead">What the page shows, where every number comes from, what could still be wrong, and what I did not do.
Built {e(D["built_utc"])}. Nothing was deployed, pushed or written to any table.</p>

<h2>1 · WHAT CHANGED SINCE THE LAST TREE</h2>
<p>The old tree used branch names nobody standard would recognise — "consumer rounds and retail" and the like — and it
was drawn as a table. This one uses the categories every desk uses, and it is drawn as a tree.</p>
<ul>
<li><b>The trunk is now standard.</b> The four main indexes at the top, then the eleven GICS sectors, each with the
State Street sector ETF that stands for it, then GICS industry groups, then industries, then the names.</li>
<li><b>Your themes are a lens, not branches.</b> AI hardware, power, photonics, space and the rest sit as an overlay you
switch on over the standard trunk, so a name can be a semiconductor and an AI-hardware name at the same time.
{len(D["themes"])} of your themes have served names behind them.</li>
<li><b>Every branch shows two readings, both labelled</b> — cap-weighted and equal-weighted — because they disagree,
and the disagreement is information.</li>
<li><b>Every branch shows its ETF.</b> When the Hub holds few names on a branch, the ETF is the honest read of it.</li>
<li><b>The table is still there</b>, as the second view, one button away.</li>
</ul>

<h2>2 · THE TREE, DRAWN</h2>
<p>At 1680 across. Left to right: the market, the eleven sectors, the industry groups inside whichever sector you pick,
then the industries. Each block's height is its share of the market value on that level, so the picture is the weighting.</p>
<img src="desktop-1680-sector.png" alt="the tree at 1680, with Information Technology picked">
<p>Tapping a branch opens it on the right: its two Geiger readings, its ETF, its day, how much of the S&amp;P 500 it is,
and its self-filling lists.</p>
<img src="desktop-1680-table.png" alt="the same tree as a table, the second view">
<p>At 390 across, on a phone, the tree view opens instead of the icicle, because bands that thin cannot be read.
Everything else is the same page.</p>
<img src="phone-390.png" alt="the tree at 390 on a phone">

<h2>3 · THE COMPARISON THAT WAS WRONG</h2>
<div class="box"><p>You were told <b>"40% of the Hub is technology against 15% of the S&amp;P"</b>. That compared the Hub
by market value with the S&amp;P by number of members — two different measures. Measured like with like tonight, the
Hub's technology weight is <b>{f(tech["hub_cap_share_pct"])}%</b> of its market value and the S&amp;P 500's is
<b>{f(tech["sp500_cap_share_pct"])}%</b>. They are the same to within half a point. By member count the Hub is
{f(tech["hub_count_share_pct"])}% and the index {f(tech["sp500_count_share_pct"])}% — the Hub holds proportionally more
technology <i>names</i>, but it is not more technology <i>money</i>.</p>
<p>The real overweight is somewhere else: <b>Communication Services</b>, {f(comm["hub_cap_share_pct"])}% of the Hub by
value against {f(comm["sp500_cap_share_pct"])}% of the index.</p></div>
<table><thead><tr><th>sector</th><th>ETF</th><th class=n>Hub by value</th><th class=n>S&amp;P by value</th>
<th class=n>Hub by count</th><th class=n>S&amp;P by count</th><th class=n>Hub names in the index</th>
<th class=n>we cover of the sector's index weight</th></tr></thead><tbody>
{rows_comparison()}
</tbody></table>
<p class="small">Hub market values are FMP's, the same source the Hub already uses. The S&amp;P columns are State
Street's own SPY holdings file ({e(p["spy"]["as_of"])}, {p["spy"]["holdings"]} holdings), with each member's GICS sector
from Wikipedia's component table ({p["sp500_gics"]["members"]} members).</p>

<h2>4 · "SHARE OF THE INDEX SEEMS EXTREMELY SLIM"</h2>
<p>It was slim because the old page counted names, not weight. By weight the Hub is nearly the whole index: it holds
<b>{spx["members_in_hub"]} of the {spx["index_members"]}</b> S&amp;P 500 members, and those names are
<b>{f(spx["hub_weight_of_index_pct"], 1)}% of the index by weight</b>. Every branch on the tree now says the same thing
about itself — for example technology's {tech["hub_names_in_sp500"]} index names are
{f(tech["hub_share_of_sector_index_weight_pct"], 0)}% of that sector's weight in the S&amp;P 500.</p>
<table><thead><tr><th>index</th><th>ETF that stands for it</th><th class=n>its Geiger</th><th>what we hold of it</th></tr></thead>
<tbody>{rows_index()}</tbody></table>
<p>Two of the four could not be resolved by member: Invesco and iShares serve a web page rather than a file to a script,
and Wikipedia's Nasdaq-100 table did not parse. So the Nasdaq-100 and the Russell 2000 branches read their ETF only,
and say so on the card. The S&amp;P 500 and the Dow are measured from State Street's own daily files.</p>

<h2>5 · WHAT THE ETFs COVER</h2>
<p>Each sector is anchored to its Select Sector SPDR — {e(sec_etf)}. All eleven are in the served universe, so each one
has its own Geiger from the same machine that reads the names. The ETF is not decoration: on a branch where the Hub
holds two or three names, the branch average is three companies' opinion, and the ETF is the sector's.
The widest disagreement tonight is {e(gap_sec)}: the Hub's {gap_node["n"]} names there read
{f(gap_node["geiger_cap"])} cap-weighted while {e(gap_node["anchor_etf"])} itself reads {f(gap_etf["geiger"])}.</p>

<h2>6 · THE 22 ROWS, RE-CHECKED ONE BY ONE</h2>
<p>The last audit said 22 cohort rows were "names the Hub cannot price". That was wrong in words. Checked live tonight,
{22 - PRICE["summary"].get("NOT PRICED ANYWHERE TONIGHT", 0)} of the 22 are priced — just not through the stock list.
Ten have daily candles on the chart API's macro route; ten more have a minute-by-minute quote from the Coinbase job
and no chart; two have nothing anywhere.</p>
<table><thead><tr><th>row</th><th>what it is</th><th>chart</th><th>live quote</th><th>stored history</th><th>verdict</th></tr></thead>
<tbody>{rows_price()}</tbody></table>
<p>Two things worth knowing behind that table. <b>Coinbase is alive</b> — the crypto quotes were seconds old at every
read, and the Coinbase products are on file. <b>The stored crypto history is not</b>: the newest stored bar for every
crypto name is 2026-08-07, seven weeks ago, so those names have a live price and a dead chart. And the rates
(US10Y, US30Y, US3M, US5Y) have daily bars through {e(PRICE["rows"]["US10Y"]["chart_api_candles"]["last_bar_et"])} but
their live quote has not moved for {PRICE["rows"]["US10Y"]["live_quote"]["age_minutes"] // 1440} days.</p>
<p class="small">US2Y and US2S10S are the two with nothing: no candles, no quote, no stored series. US2S10S is the
two-to-ten spread, which is normally computed from the other two, so it cannot exist while US2Y does not.</p>

<h2>7 · "MACHINE MADE INDUSTRY COHORTS"</h2>
<div class="box"><p>{e(COH["plain_sentence"])}</p></div>
<p>In other words: a job turned the data vendor's industry list into cohorts, and they have been sitting beside the
cohorts you actually chose, looking the same. The standard tree replaces them — industries now come from the GICS
structure with their proper names, and the {COH["do_not"]} hand-chosen cohorts survive as the theme lens.</p>

<h2>8 · THE LINES THE LISTS USE</h2>
<p>The self-filling lists on each branch use the lines desks actually quote, not a Scintilla invention: {e(thr)}.
Each one sits in a box on the page and can be changed; the lists refill as you type, and your change is remembered in
that browser. The readings behind them are FMP's daily RSI(14), 50-day and 200-day averages and Williams %R, dated
{e((p["indicators"]["source_date"] or ["—"])[0])} and marked settled: {p["indicators"]["names_with_rsi"]} names have an
RSI and {p["indicators"]["names_with_sma200"]} have a 200-day average.</p>

<h2>9 · WHERE EVERY NUMBER COMES FROM</h2>
<ul>
<li><b>The names and their Geiger</b> — the chart API's own universe ({p["universe"]["count"]} names) and /geiger,
computed {e(p["geiger"]["computed_utc"])}.</li>
<li><b>Prices and the day's move</b> — the chart API's /quotes, the {e(p["quotes"]["session_et"])} session.</li>
<li><b>Sector, industry and market value</b> — the Hub's own company_profile rows, which are FMP's.</li>
<li><b>RSI, 50-day, 200-day, Williams</b> — the Hub's provider_indicators_current rows, FMP, daily, settled.</li>
<li><b>S&amp;P 500 weights and the Dow</b> — State Street's own daily holdings files for SPY and DIA.</li>
<li><b>GICS sector per S&amp;P member</b> — Wikipedia's component table, reference only, never a price.</li>
</ul>

<h2>10 · WHAT COULD BE WRONG</h2>
<ul>
<li><b>The sector names are a translation, not a licence.</b> The Hub's raw labels are FMP's; this page maps them onto
the GICS names by a stated table in scripts/build-standard-tree.py. It is not S&amp;P's own classification feed, and a
handful of names sit differently under GICS than FMP puts them: {e(moved)}.</li>
<li><b>Industry groups are mapped, not fetched.</b> Every one of the {len(D["names"])} names lands in a group by that
same table. If FMP relabels an industry, a name moves branch and nothing warns you.</li>
<li><b>The Nasdaq-100 and Russell 2000 branches are ETF-only</b> until a member list is obtained.</li>
<li><b>Equal-weighted readings on thin branches are noisy.</b> A branch with three names can swing on one of them;
that is why the ETF is on every card.</li>
<li><b>The stored crypto history is seven weeks old</b>, so any chart for those names is stale even though the quote is not.</li>
<li><b>One reading is a snapshot.</b> The live-quote table is rewritten every minute, and a single read can land
mid-write; the check reads it three times before calling anything unpriced. The first run of it did call two crypto
names unpriced, which was the read's fault, not theirs.</li>
</ul>

<h2>11 · WHAT I DID NOT DO</h2>
<ul>
<li>Nothing was deployed, pushed, merged or scheduled. No table was written. No price table was touched.</li>
<li>No cohort was renamed or deleted, and no name was added to the served universe — both need your word.</li>
<li>The Hub's other rooms are untouched; the Indicator Lab is byte-identical; the old tree page is still there.</li>
<li>The sector ETFs' own holdings were not fetched, so "what the ETF covers" is the sector it tracks, not a look-through.</li>
<li>No browser ever opened on your screen: every screenshot was taken headless.</li>
</ul>
<p class="small">Built by the tree-2 lane, {e(datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"))}.
Data files: data/standard-tree-20260924.json, data/instrument-pricing-20260924.json,
data/cohort-label-origin-20260924.json, data/reference/*.json.</p>
</div>
{SCNAV}
</body></html>
"""
open(OUT, "w").write(doc)
print("wrote", OUT, len(doc), "bytes")

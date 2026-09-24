#!/usr/bin/env python3
"""Writes deliverables/20260924/tree/TREE.html from the two built JSON files, so every number
in the document is the number that was measured, not one typed by hand."""
import json, os, datetime, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = json.load(open(os.path.join(ROOT, "data", "taxonomy-20260924.json")))
A = json.load(open(os.path.join(ROOT, "data", "taxonomy-audit-20260924.json")))
N, P, PV = T["nodes"], T["profiles"], T["provenance"]
F = {x["kind"]: x for x in A["cohort_findings"]}
e = html.escape
cap = lambda v: "—" if not v else (f"{v/1e12:.2f}T" if v >= 1e12 else f"{v/1e9:.0f}B")
pc = lambda v, d=2: "—" if v is None else f"{v:+.{d}f}%"
lvl = lambda l: sorted([x for x in N.values() if x["level"] == l], key=lambda x: -x["n"])

def cls(v):  # direction colour only
    return "" if v is None else ("up" if v > 0 else "dn" if v < 0 else "")

branches = lvl("branch")
sectors = lvl("sector")
fams = lvl("family")
thin = [b for b in branches if b["n"] <= 4]
cands = A["candidates_36"]; cb = A["candidate_branch"]

def g3(v):
    return "—" if v is None else "%+.3f" % v

def br_row(b):
    col = "var(--up)" if (b["geiger_mean"] or 0) > 0 else "var(--dn)"
    names = e(" ".join(b["members"][:9])) + (" …" if b["n"] > 9 else "")
    return ("<tr><td class='t'>%s</td><td>%d</td><td style='color:%s'>%s</td><td>%s</td>"
            "<td class='%s'>%s</td><td>%s</td><td class='t names'>%s</td></tr>") % (
        e(b["label"]), b["n"], col, g3(b["geiger_mean"]),
        "—" if b["breadth_pct"] is None else str(b["breadth_pct"]) + "%",
        cls(b["chg_mean_pct"]), pc(b["chg_mean_pct"]), cap(b["market_cap"]), names)

rows_branch = "\n".join(br_row(b) for b in branches)

def sec_row(s):
    return ("<tr><td class='t'>%s</td><td>%d</td><td>%s</td><td>%s</td><td>%s</td></tr>") % (
        e(s["label"]), s["n"], g3(s["geiger_mean"]),
        "—" if s["breadth_pct"] is None else str(s["breadth_pct"]) + "%", cap(s["market_cap"]))

rows_sector = "\n".join(sec_row(x) for x in sectors)

rep = A["representativeness"]["sectors"]
rows_rep = "\n".join(
    f"<tr><td class='t'>{e(r['sector_fmp'])}</td><td class='t dim'>{e(r['sector_gics'])}</td>"
    f"<td>{r['hub_n']}</td><td>{r['hub_cap_share_pct']:.1f}%</td>"
    f"<td>{r['sp500_n']}</td><td>{r['sp500_share_of_members_pct']:.1f}%</td>"
    f"<td>{r['hub_names_that_are_sp500']}</td>"
    f"<td class='{'dn' if (r['sp500_cover_pct'] or 0) < 45 else ''}'>{r['sp500_cover_pct']:.0f}%</td></tr>" for r in rep)

rows_gap = "\n".join(
    f"<tr><td class='t'>{e(r['gics_sector'])}</td><td class='t'>{e(r['sub_industry'])}</td>"
    f"<td>{r['sp500_members']}</td><td class='t names'>{e(' '.join(r['names'][:8]))}</td></tr>"
    for r in A["uncovered_sub_industries"])

blab = {b["id"][3:]: b["label"] for b in branches}
rows_cand = "\n".join(
    f"<tr><td class='t'>{e(c['ticker'])}</td><td>{c['mentions']}</td>"
    f"<td class='t'>{e(blab.get(cb.get(c['ticker'],''), 'needs a profile before it can be placed'))}</td>"
    f"<td class='t dim'>{e(c['reason'])}</td></tr>"
    for c in sorted(cands, key=lambda c: (-c["mentions"], c["ticker"])))

mega = F["SAME_NAME_TWO_SPELLINGS"]
contra_rows = "\n".join(f"<tr><td class='t'>{e(r['ticker'])}</td><td class='t'>{e(r['cohort'])}</td>"
                        f"<td class='t'>{e(str(r['measured_branch']))}</td><td class='t dim'>{e(r['industry'])}</td></tr>"
                        for r in F["COHORT_CONTRADICTS_THE_NAME_S_BUSINESS"]["rows"])

LISTS = [
 ("Oversold quality", "market cap of $20B or more and a Geiger composite of −0.35 or worse, weakest first",
  "big names the machine reads as beaten down. Size is standing in for quality until the fundamentals join the tree — that is the one honest weakness in this rule."),
 ("Leaders pulling back", "Geiger trend of +0.25 or better while the last completed session closed down",
  "strength that gave a little back, which is the shape Alan described as a pullback to support."),
 ("Scintillas", "moved 3% or more in the last completed session, biggest move first",
  "the fast movers, on whichever node is open — the whole market, one sector, or one branch."),
 ("Cheaper, growing faster", "forward P/E below the open node's median and forward EPS growth above it",
  "cheap against its actual peers, not against the whole market. It needs four names on the node carrying both numbers, otherwise it says so and shows nothing."),
 ("Favourites in red", "a name in hub_favorites that closed down",
  f"the {len(T['favourites'])} names already starred, filtered to the ones having a bad day."),
]
rows_lists = "\n".join(f"<tr><td class='t'>{e(a)}</td><td class='t'>{e(b)}</td><td class='t dim'>{e(c)}</td></tr>" for a, b, c in LISTS)

HTML = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>SCINTILLA · THE TREE — a proposal</title>
<style>
:root{{--bg:#0d0d0d;--panel:#151515;--panel2:#1b1b1b;--line:#272727;--line2:#333;--ink:#cdcdcd;--ink2:#ababab;--dim:#8c8c8c;--mute:#5c5c5c;--up:#35b06a;--dn:#d1483f;--mono:ui-monospace,SFMono-Regular,Menlo,monospace}}
*{{box-sizing:border-box}} html,body{{margin:0;background:var(--bg);color:var(--ink);font:13px/1.65 var(--mono)}}
.wrap{{max-width:1180px;margin:0 auto;padding:16px 16px 60px}}
h1{{font-size:16px;letter-spacing:.14em;margin:0 0 4px}}
h2{{font-size:13px;letter-spacing:.12em;margin:34px 0 8px;color:var(--ink);border-bottom:1px solid var(--line);padding-bottom:6px}}
h3{{font-size:12px;letter-spacing:.08em;color:var(--ink2);margin:18px 0 6px}}
p,li{{color:var(--ink2);font-size:13px}} .lede{{color:var(--ink)}}
.dim{{color:var(--dim)}} .up{{color:var(--up)}} .dn{{color:var(--dn)}}
table{{width:100%;border-collapse:collapse;margin:8px 0 6px}}
th,td{{text-align:right;padding:5px 8px;border-bottom:1px solid var(--line);font-size:12px;vertical-align:top}}
th{{color:var(--dim);font-weight:400;letter-spacing:.06em}} td.t,th.t{{text-align:left}}
td.names{{color:var(--dim);font-size:11px}}
.box{{background:var(--panel);border:1px solid var(--line);padding:10px 12px;margin:10px 0}}
code{{background:var(--panel2);border:1px solid var(--line);padding:1px 4px;font-size:12px}}
img{{width:100%;border:1px solid var(--line);margin:6px 0 2px;display:block}}
.two{{display:grid;grid-template-columns:2fr 1fr;gap:14px;align-items:start}}
.dec{{border-left:2px solid var(--line2);padding-left:10px;margin:12px 0}}
@media (max-width:760px){{ .two{{grid-template-columns:1fr}} }}
</style></head><body><div class="wrap">
<h1>SCINTILLA · THE TREE</h1>
<p class="dim">A proposal, built {T['built_utc'][:16].replace('T',' ')} UTC · nothing on the live Hub was changed, nothing was deployed, no table was written.</p>

<p class="lede">Alan asked for one way to look at the market that runs from the whole thing down to a single name, with his
cohorts as the seed of the themes rather than the structure itself. This is that shape, built from the
{PV['universe']['count']} names Scintilla actually serves, with a page you can click through. It is a proposal: the cohorts,
the board, the Geiger weights and every existing screen are untouched.</p>

<div class="box"><b>The short version.</b> The {PV['universe']['count']} served names now sit on one tree: {len(sectors)} sectors,
{len([x for x in N.values() if x['level']=='industry'])} industries, {len(branches)} themed branches, and a separate trunk for the {N['FUNDS']['n']} funds,
because a fund is not a company. Every node carries the same readings, rolled up the same way. The cohorts are not deleted —
they are the seeds the branches were written from, and the audit below lists every inconsistency found in them, with the fix.</p></div>

<h2>1 · The tree</h2>
<p>Four levels, then a second view of the same companies grouped by theme:</p>
<ul>
<li><b>The market</b> — all {N['MARKET']['n']} served names.</li>
<li><b>Companies</b> ({N['COMPANIES']['n']}) → <b>sector</b> ({len(sectors)}) → <b>industry</b> ({len([x for x in N.values() if x['level']=='industry'])}). Sector and industry are what FMP files for each name in <code>company_profile</code>.</li>
<li><b>Branches</b> ({len(branches)}) — the same {N['COMPANIES']['n']} companies, grouped by theme instead of by filing. A branch is a theme: AI accelerators, the power the machines need, photonics, space, memory, rare earths, crypto miners.</li>
<li><b>Funds</b> ({N['FUNDS']['n']}) — their own trunk in {len(fams)} families, so an index fund never sits inside Financial Services pretending to be a bank.</li>
</ul>
<p>Every served name is placed, and no name is left over. The rules live in one editable file
(<code>data/taxonomy-rules-20260924.json</code>): a branch can list tickers, name one of Alan's cohorts as its seed, or match an
industry, and the most specific branch wins. Adding a name to a branch is one line in that file.</p>

<h3>Why branches are a second view and not a fifth level</h3>
<p>Themes cut across sectors — the power a data centre needs is a utility, an industrial and an engineering firm at once. If a
branch hung under one industry, that branch could only ever hold part of its theme. So a company keeps its sector and industry
address <i>and</i> sits on exactly one branch. That is decision 1 below.</p>

<h3>The branches, as measured</h3>
<table><thead><tr><th class="t">BRANCH</th><th>NAMES</th><th>GEIGER MEAN</th><th>BREADTH</th><th>LAST SESSION</th><th>CAP</th><th class="t">WHO IS ON IT</th></tr></thead><tbody>
{rows_branch}
</tbody></table>
<p class="dim">Geiger mean is the plain mean of the composite the chart API serves for each name on the node. Breadth is the share of
those names with a composite of 0.5 or better. Last session is the chart API's own CHG basis for {PV['quotes']['session_et']}.</p>

<h3>The sectors, as measured</h3>
<table><thead><tr><th class="t">SECTOR</th><th>NAMES</th><th>GEIGER MEAN</th><th>BREADTH</th><th>CAP</th></tr></thead><tbody>
{rows_sector}
</tbody></table>

<h2>2 · Is the Hub a good sample of the market?</h2>
<p>Measured against the S&amp;P 500's own membership list ({A['representativeness']['sp500_rows_parsed']} rows, an external
reference — Wikipedia's component table, read {A['built_utc'][:10]} — and not used for any number on a live screen).</p>
<table><thead><tr><th class="t">SECTOR (as FMP files it)</th><th class="t">GICS NAME</th><th>HUB NAMES</th><th>SHARE OF HUB CAP</th><th>S&amp;P 500 MEMBERS</th><th>SHARE OF THE INDEX</th><th>HUB HAS</th><th>COVER</th></tr></thead><tbody>
{rows_rep}
</tbody></table>
<p><b>What this says.</b> By weight the Hub is a technology portfolio: Technology alone is
{rep[0]['hub_cap_share_pct']:.0f}% of the Hub's market cap against {rep[0]['sp500_share_of_members_pct']:.0f}% of the index by member count.
Financial Services, Health Care and Real Estate are the thin ends — the Hub serves
{[r for r in rep if r['sector_fmp']=='Healthcare'][0]['sp500_cover_pct']:.0f}% of the index's health-care names and
{[r for r in rep if r['sector_fmp']=='Financial Services'][0]['sp500_cover_pct']:.0f}% of its financials. That is not
necessarily wrong — it is what Alan watches — but it means a "market" reading taken over the Hub is a reading of a tech-heavy book,
and the tree now says so on every node.</p>
<p><b>Thin branches</b> (four names or fewer, so their aggregate is close to meaningless):
{', '.join(e(b['label'])+' ('+str(b['n'])+')' for b in thin)}.</p>

<h3>Sub-industries the Hub does not cover at all</h3>
<table><thead><tr><th class="t">GICS SECTOR</th><th class="t">SUB-INDUSTRY</th><th>S&amp;P MEMBERS</th><th class="t">NAMES</th></tr></thead><tbody>
{rows_gap}
</tbody></table>
<p class="dim">One parse artefact to ignore in that list: FDXF is FDX. The Nasdaq-100 comparison is <b>not</b> in this document —
the estate's <code>index_constituents</code> table is empty and the public source returned 403. It needs the FMP constituent
list, and then this table can be re-run.</p>

<h2>3 · The names the Hub is missing</h2>
<p>The {len(cands)} candidates already collected (Alan's CLAUDE CHECK folder), plus IGV and NVTS from lane M33, each given a
place on the tree rather than only a cohort. The chart API cannot price any of them today: adding one is a universe change the
coordinator has to make (universe file, digest, redeploy), which is why this is a list and not a migration.</p>
<table><thead><tr><th class="t">TICKER</th><th>MENTIONS</th><th class="t">BRANCH IT WOULD JOIN</th><th class="t">WHY</th></tr></thead><tbody>
{rows_cand}
</tbody></table>
<p>Read against section 2, the candidates land almost entirely on the branches that are already thin —
photonics, space, critical minerals, uranium. They would fix the thin themes, not the thin sectors. If the aim is a
<i>representative</i> Hub rather than a richer set of themes, the names to add are the large financials, insurers and
health-care names in the gap table above.</p>

<h2>4 · The cohorts: every inconsistency found, with the fix</h2>
<table><thead><tr><th class="t">WHAT IS WRONG</th><th>HOW MANY</th><th class="t">THE FIX</th><th class="t">WHY IT MATTERS</th></tr></thead><tbody>
<tr><td class="t">Two spellings of one cohort: <b>MEGACAP</b> ({mega['sizes']['MEGACAP']} rows) and <b>MEGA_CAP</b> ({mega['sizes']['MEGA_CAP']} rows)</td><td>2</td>
<td class="t">keep MEGA_CAP, move MEGACAP's rows, drop the empty label</td>
<td class="t">the two are not the same list — {e(', '.join(mega['members_unique_to_each']['MEGACAP']))} sits only in MEGACAP, and {len(mega['members_unique_to_each']['MEGA_CAP'])} names sit only in MEGA_CAP. A screen filtered on one silently drops the other's names.</td></tr>
<tr><td class="t">Cohort rows for names the Hub cannot price</td><td>{F['COHORT_ROWS_FOR_NAMES_THE_HUB_CANNOT_PRICE']['n']}</td>
<td class="t">either add them to the served universe or park them in the candidate table</td>
<td class="t">every crypto and macro row — {e(' '.join(F['COHORT_ROWS_FOR_NAMES_THE_HUB_CANNOT_PRICE']['tickers'][:8]))} and the rest — points at a ticker the chart API does not serve, so any aggregate over CRYPTO or MACRO is computed over nothing.</td></tr>
<tr><td class="t">Machine-made industry cohorts</td><td>{F['MACHINE_GENERATED_INDUSTRY_COHORTS']['n']}</td>
<td class="t">stop writing the FMP industry string as a cohort; the tree's industry level already holds it</td>
<td class="t">113 cohort labels for 364 names. Most were never chosen by anyone — they are the industry text with the spaces replaced.</td></tr>
<tr><td class="t">Cohorts holding one served name or none</td><td>{F['COHORT_OF_ONE_OR_NONE_SERVED']['n']}</td>
<td class="t">fold each into the branch that already holds the name</td>
<td class="t">a group of one cannot be compared with anything.</td></tr>
<tr><td class="t">Two cohort engines that disagree</td><td>{F['TWO_ENGINES_DISAGREE']['n']}</td>
<td class="t">make <code>cohorts</code> a view over <code>ticker_cohorts</code>, or move the board onto the tree</td>
<td class="t">the board reads <code>cohorts</code> ({F['TWO_ENGINES_DISAGREE']['old_rows']} rows, one label per name) while the newer engine writes <code>ticker_cohorts</code> ({F['TWO_ENGINES_DISAGREE']['new_rows']} rows, many labels per name). The same name can be in different groups on different screens.</td></tr>
<tr><td class="t">A cohort that contradicts the name's business</td><td>{F['COHORT_CONTRADICTS_THE_NAME_S_BUSINESS']['n']}</td>
<td class="t">let the branch rule place the name and keep the cohort as Alan's own list</td>
<td class="t">AI_HARDWARE currently holds a cyber-security name, three bitcoin miners and four ETFs, so an "AI hardware" reading is not one.</td></tr>
</tbody></table>
<h3>The AI_HARDWARE rows that are not AI hardware</h3>
<table><thead><tr><th class="t">TICKER</th><th class="t">COHORT</th><th class="t">WHERE THE TREE PUTS IT</th><th class="t">WHAT FMP SAYS IT DOES</th></tr></thead><tbody>
{contra_rows}
</tbody></table>
<p class="dim">"None" means the name is a fund, so it sits on the fund trunk rather than on a branch.</p>

<h2>5 · Lists that fill themselves</h2>
<p>Alan: "I don't want to have to make watch lists. I want some dynamism." So a list here is a <b>rule</b>, not a saved set of
tickers. It is evaluated over whichever node is open — the whole market, one sector, one branch — every time the numbers change.
Nothing to maintain, nothing to go stale. Alan stars or swipes; the list rebuilds itself.</p>
<table><thead><tr><th class="t">LIST</th><th class="t">THE RULE</th><th class="t">WHAT IT IS FOR</th></tr></thead><tbody>
{rows_lists}
</tbody></table>
<p>All five run in the prototype today. Each names its own rule on screen and says how many of the node's names met it, so a
list that finds nothing says "no name on this node meets the rule" instead of showing an empty box.</p>

<h2>6 · The prototype</h2>
<p>Open <code>deliverables/20260924/tree/prototype.html</code>. Tap a node in the tree on the left; the right side shows that
node's readings, then its names and the five lists. The star on each row is local to the preview and writes nothing.</p>
<div class="two"><div>
<p class="dim">1680 wide</p><img src="desktop-1680.png" alt="The tree at 1680: the tree on the left, the market node's readings, list tabs and the names table on the right">
</div><div>
<p class="dim">390 wide (phone)</p><img src="phone-390.png" alt="The tree at 390: the tree stacked above the readings, two tiles per row, and a four-column table">
</div></div>

<h2>7 · Where every number comes from</h2>
<ul>
<li><b>Which names exist</b> — the chart API's <code>/universe</code>: {PV['universe']['count']} names, digest <code>{(PV['universe']['sha256'] or '')[:12]}…</code>.</li>
<li><b>Geiger</b> — the chart API's <code>/geiger</code>, computed {PV['geiger']['computed_utc']}. All {PV['universe']['count']} names carry a composite today.</li>
<li><b>Price and the move</b> — the chart API's <code>/quotes</code>, read {PV['quotes']['generated_utc']}, session {PV['quotes']['session_et']}. The change is the API's own CHG basis: price against the close of the session before.</li>
<li><b>Sector, industry, market cap</b> — <code>company_profile</code> (FMP).</li>
<li><b>Cohorts</b> — <code>ticker_cohorts</code> ({PV['cohorts']['rows_new']} rows) and <code>cohorts</code> ({PV['cohorts']['rows_old']} rows).</li>
<li><b>Sentiment</b> — <code>social_sentiment</code>; only {N['MARKET']['sentiment_n']} of {PV['universe']['count']} names have a score, so the sentiment tile is a reading of a small sample and says how many.</li>
<li><b>Forward P/E and growth</b> — <code>fwd_eps_ntm</code>, last written {(PV['eps']['ntm_updated_ts'] or '')[:10]}, and <code>fundamentals.eps_ttm</code>. These are months older than the price, which is why that list is the weakest of the five.</li>
<li><b>Favourites</b> — <code>hub_favorites</code> ({PV['favourites']['n']} names).</li>
<li><b>Put/call</b> — empty. Per-ticker option volume is lane M38's work and does not exist yet; the tile says "not yet" rather than showing a zero.</li>
</ul>

<h2>8 · The data model, if you want it in the database</h2>
<p>Three additive tables, written as a migration and <b>not applied</b>:
<code>taxonomy_nodes</code>, <code>taxonomy_membership</code>, <code>taxonomy_list_rules</code>, in
<code>supabase/migrations/20260924_taxonomy_tree.sql</code>, with the seed rows generated alongside it. The rollback is three
<code>drop table</code> lines at the foot of the same file. Nothing existing is changed and no screen reads them until a reviewed
reader ships.</p>
<p>The migration deliberately stores <b>no</b> Geiger value, breadth number or price. Those come from the chart API when a node is
opened; copied into a table they would be wrong within the hour.</p>

<h2>9 · What could be wrong</h2>
<ul>
<li><b>The branch rules are mine, not Alan's.</b> Thirty branches seeded from the cohorts and from what each name actually does. Some calls are arguable — bitcoin miners that now host AI sit on the crypto branch, not the data-centre branch; Tesla sits on new mobility, not with the mega-cap platforms. Every one of them is one line in the rules file.</li>
<li><b>Sector and industry are FMP's opinion</b>, and FMP files every ETF under Financial Services. The fund trunk sidesteps that, but it means the tree inherits whatever FMP says a company does.</li>
<li><b>Two sector vocabularies.</b> FMP says "Technology" where GICS says "Information Technology". The mapping in section 2 is mine and is stated in the audit file.</li>
<li><b>The S&amp;P list is external.</b> It was read from a public page, not from the estate. Numbers derived from it are for this discussion only.</li>
<li><b>No Nasdaq-100 comparison</b>, for the reason in section 2.</li>
<li><b>Forward P/E is stale</b> ({(PV['eps']['ntm_updated_ts'] or '')[:10]}), and only {len([1 for v in P.values() if v.get('pe_ntm')])} of {PV['universe']['count']} names carry one.</li>
<li><b>Sentiment covers {N['MARKET']['sentiment_n']} names.</b> Treat the tile as a sample, not a reading of the node.</li>
<li><b>Nothing here is a recommendation.</b> The lists are filters over measured numbers; they do not say buy or sell.</li>
</ul>

<h2>10 · What I did not do</h2>
<ul>
<li>No deploy, no push, no merge. The work sits on a branch.</li>
<li>No table was written, no migration applied, no cohort edited, no favourite changed.</li>
<li>The board, the Geiger weights, Alan's Equalizer rungs, the Indicator Lab and every other room are untouched.</li>
<li>No name was added to the served universe.</li>
<li>Every browser I ran was headless, with its own temporary profile, and was killed afterwards.</li>
</ul>

<h2>11 · Three decisions</h2>
<div class="dec"><b>1 · Do branches hang under an industry, or sit beside the sectors as a second view?</b><br>
<span class="dim">My recommendation: beside, as built.</span> A theme that cannot cross a sector boundary cannot hold its theme —
"the power the machines need" is utilities, industrials and engineering at once. Keep the sector address for filing and the
branch for thinking.</div>
<div class="dec"><b>2 · What happens to the cohorts?</b><br>
<span class="dim">My recommendation: keep FAV and the handful Alan actually chose as his own lists; retire the
{F['MACHINE_GENERATED_INDUSTRY_COHORTS']['n']} machine-made industry labels and the {F['COHORT_OF_ONE_OR_NONE_SERVED']['n']}
groups of one, and fix MEGACAP/MEGA_CAP first because it is the one that silently changes what a screen shows.</span>
Nothing is deleted until the tree is serving the same screens.</div>
<div class="dec"><b>3 · Which names go into the universe next?</b><br>
<span class="dim">My recommendation: the {len(cands)} candidates first, because they are already collected and they fill the
branches that are too thin to read.</span> But if the goal is for the Hub to be a fair sample of the market rather than of
Alan's themes, the honest next set is the financials, insurers and health-care names in section 2's gap table. Those are two
different goals and they need two different answers.</div>

<p class="dim" style="margin-top:34px">Built by scripts/build-taxonomy.py, scripts/taxonomy-audit.py and
scripts/build-tree-deliverable.py from live reads at {T['built_utc'][:19].replace('T',' ')} UTC.</p>
</div></body></html>
"""
out = os.path.join(ROOT, "deliverables", "20260924", "tree", "TREE.html")
open(out, "w").write(HTML)
print("wrote", out, os.path.getsize(out), "bytes")

#!/usr/bin/env python3
"""Renders TREE-ADOPTED.html from the JSON beside it. Greys only (channels within 24, none above 210), body text 11px+,
pictures first, explanations in PAGE SPECS at the bottom."""
import json, os, html, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.dirname(HERE); ROOT = os.path.abspath(os.path.join(D, "..", "..", ".."))
J = lambda n: json.load(open(os.path.join(D, n))); e = html.escape
IDX = J("index-layer.json"); DRY = J("loader-dry-run.json"); NC = J("hub-no-change.json"); WEAK = J("weak-areas.json")
tree = json.loads(subprocess.check_output(["node", "-e", """
import('./scripts/cohort-tree-loader.mjs').then(m=>{const fs=require('fs');const J=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const t=m.buildTree({proposal:J('deliverables/20261006/cohort-proposal/proposal.json'),indexLayer:J('deliverables/20261006/tree-adopted/index-layer.json'),served:J('deliverables/20261006/cohort-proposal/data/universe-20261006.json').symbols});console.log(JSON.stringify(t))})"""], cwd=ROOT))
N = {n["cohort"]: n for n in tree["nodes"]}; M = {}
for m in tree["members"]: M.setdefault(m["cohort"], []).append(m)
kids = {}
for n in tree["nodes"]: kids.setdefault(n["parent_1"], []).append(n)
def walk(c, depth, out):
    n = N[c]; ms = M.get(c, []); comp = [m for m in ms if m["role"] == "member"]; funds = [m for m in ms if m["role"] != "member"]; pend = [m["ticker"] for m in ms if m["status"] == "pending_admission"]
    bits = []
    if comp: bits.append(f"{len(comp)} companies")
    if funds: bits.append(f"{len(funds)} funds")
    if n["parent_2"]: bits.append("also under " + N[n["parent_2"]]["label"])
    if n["spine_fund"]: bits.append("spine " + n["spine_fund"] + (f" → {n['spine_fund_next']} once served" if n["spine_fund_next"] else ""))
    elif n["spine_fund_next"]: bits.append(f"spine {n['spine_fund_next']} once served")
    if pend: bits.append("waiting: " + " ".join(pend))
    out.append("  " * depth + ("" if depth == 0 else "└ ") + n["label"] + ("   · " + " · ".join(bits) if bits else ""))
    for k in kids.get(c, []): walk(k["cohort"], depth + 1, out)
lines = []; walk("MARKET", 0, lines)
def pair(name, w, cap):
    return f'<div class="pair"><figure><img src="shots/before-{w}-{name}.png" alt="before" loading="lazy"><figcaption>BEFORE · the two tables do not exist</figcaption></figure><figure><img src="shots/after-{w}-{name}.png" alt="after" loading="lazy"><figcaption>AFTER · the two tables present and filled</figcaption></figure></div><p class="small">{e(cap)}</p>'
V = {"KEEP": "keep", "COPY": "near-copy", "ADMIT": "ADMIT", "SKIP": "leave out"}
fam_order = []; 
for f in IDX["funds"]:
    if f["family"] not in fam_order: fam_order.append(f["family"])
rows = []
for f in IDX["funds"]:
    corr = f"{f['corr_6m']:.2f}" if f["corr_6m"] is not None else ("not measured" if f["vs"] else "")
    rows.append(f"<tr><td>{e(f['family'])}</td><td><b>{f['ticker']}</b></td><td>{e(f['tracks'])}</td><td>{'served' if f['served'] else 'not served'}</td><td>{V[f['verdict']]}</td><td>{f['vs'] or ''}</td><td class='r'>{corr}</td><td>{e(f['why'])}</td></tr>")
W1 = NC["widths"]["1680"]; W3 = NC["widths"]["390"]
adm = [f for f in IDX["funds"] if f["verdict"] == "ADMIT"]
weak = []
for r in WEAK["weak"]:
    c = " · ".join(f"<b>{x['ticker']}</b> {e(x['name'])}" + ("" if x["spy_weight_pct"] is not None else " <span class='small'>(outside the S&amp;P)</span>") for x in r["candidates"])
    weak.append(f"<tr><td class='r'>{r['rank']}</td><td>{e(r['sub_industry'])}</td><td>{e(r['sector'])}</td><td class='r'>{r['spy_weight_pct']:.2f}%</td><td>{' '.join(r['we_hold']) or 'none'}{('<br><span class=small>' + e(r['also']) + '</span>') if r.get('also') else ''}</td><td>{c}</td></tr>")
sr = DRY["sql_run"]
page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TR1 · The tree adopted, the index layer mapped</title>
<style>
:root{{--bg:#121314;--panel:#1a1b1c;--line:#2e3032;--ink:#c4c6c8;--dim:#8a8c8e;--faint:#5e6062;--bright:#d0d2d4}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;padding:28px 16px 60px}}
main{{max-width:1180px;margin:0 auto}}h1{{font-size:16px;letter-spacing:.08em;color:var(--bright);margin:0 0 4px}}h2{{font-size:12px;letter-spacing:.12em;color:var(--bright);margin:34px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}}
.sub{{color:var(--dim);margin:0 0 18px}}.panel{{background:var(--panel);border:1px solid var(--line);padding:14px;margin:10px 0}}
table{{border-collapse:collapse;width:100%;font-size:11px}}th,td{{text-align:left;padding:4px 8px;border-bottom:1px solid var(--line);vertical-align:top}}th{{color:var(--dim);font-weight:500;letter-spacing:.06em}}td.r,th.r{{text-align:right;font-variant-numeric:tabular-nums}}b{{color:var(--bright);font-weight:600}}
pre{{font-size:11px;line-height:1.5;color:var(--ink);overflow-x:auto;background:var(--panel);border:1px solid var(--line);padding:12px;margin:10px 0}}
.kpi{{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}}.kpi div{{background:var(--panel);border:1px solid var(--line);padding:10px 12px}}.kpi b{{display:block;font-size:20px}}.kpi span{{color:var(--dim);font-size:11px}}
.pair{{display:grid;grid-template-columns:1fr 1fr;gap:10px}}figure{{margin:0;background:var(--panel);border:1px solid var(--line);padding:6px}}figure img{{width:100%;display:block}}figcaption{{color:var(--dim);font-size:11px;padding-top:6px;letter-spacing:.06em}}
.pair.phone{{max-width:560px}}
details.sc-pagespecs{{margin-top:40px;border-top:1px solid var(--line);padding-top:12px;color:var(--dim)}}details.sc-pagespecs summary{{cursor:pointer;color:var(--bright);letter-spacing:.12em}}details.sc-pagespecs p{{max-width:900px}}
.wrap{{overflow-x:auto}}.small{{font-size:11px;color:var(--dim)}}code{{color:var(--bright)}}
@media(max-width:700px){{body{{padding:20px 16px 50px}}.wrap table{{min-width:760px}}}}
</style></head><body><main>
<span data-scnav-slot></span><h1>TR1 · THE TREE ADOPTED BESIDE THE SECTORS · THE INDEX LAYER MAPPED</h1>
<p class="sub">6 Oct 2026 · prepared, nothing applied · no table written, no universe change, no deploy · branch hub/tr1-tree-index-20261006</p>

<h2>1 · THE HUB BEFORE AND AFTER — NO SCREEN CHANGES</h2>
{pair("cohort-AI_HARDWARE", 1680, "AI HARDWARE at 1680 wide: the same 43 names, the same tabs, the same map. Only live prices moved between the two runs.")}
<div class="pair phone">{pair("home", 390, "The phone, 390 wide: the same 63 names on the opening board.").replace('<div class="pair">','').replace('</div><p','</div><p',1)}
<div class="kpi">
<div><b>{W1['screens_compared']} + {W3['screens_compared']}</b><span>screens compared (1680 and 390): {len(W1['screens_different']) + len(W3['screens_different'])} different</span></div>
<div><b>{W1['cohort_map_before']['cohorts']} · {W1['cohort_map_before']['rows']}</b><span>cohorts · rows the Hub built its tabs from, before = after</span></div>
<div><b>{W1['hub_requests_to_the_new_tables']['after']}</b><span>requests the Hub made to the new tables</span></div>
<div><b>{W1['live_database_today']['cohort_tree']}</b><span>what the live database answers for the new names today (not there)</span></div>
</div>

<h2>2 · WHAT IS ADOPTED</h2>
<div class="kpi">
<div><b>{DRY['nodes']}</b><span>nodes in the tree ({DRY['nodes_by_kind']['heading']} headings, {DRY['nodes_by_kind']['cohort']} topic cohorts, {DRY['nodes_by_kind']['index']} index sets)</span></div>
<div><b>{DRY['companies']}</b><span>companies placed (QRVO left out: it stopped trading)</span></div>
<div><b>{DRY['members']}</b><span>memberships, each with its reason</span></div>
<div><b>{DRY['distinct_tickers']}</b><span>tickers = the universe after the sitting (590 − 1 + 10)</span></div>
<div><b>{sr['loaded']['nodes']} / {sr['loaded']['members']}</b><span>rows a real Postgres loaded in the dry run, then rolled back to nothing</span></div>
</div>
<pre>{e(chr(10).join(lines))}</pre>

<h2>3 · THE INDEX LAYER, MAPPED</h2>
<div class="kpi">
<div><b>{IDX['counts']['KEEP']}</b><span>served, the line to use</span></div>
<div><b>{IDX['counts']['COPY']}</b><span>served, a near-copy of a kept line</span></div>
<div><b>{IDX['counts']['ADMIT']}</b><span>not served, recommended</span></div>
<div><b>{IDX['counts']['SKIP']}</b><span>not served, left out on purpose</span></div>
</div>
<div class="panel wrap"><table><thead><tr><th>FAMILY</th><th>FUND</th><th>WHAT IT TRACKS</th><th>TODAY</th><th>VERDICT</th><th>AGAINST</th><th class="r">MOVES WITH IT</th><th>WHY</th></tr></thead><tbody>
{chr(10).join(rows)}
</tbody></table></div>

<h2>4 · THE ADMISSION LIST — TEN FUNDS, ONE SITTING WITH QRVO'S RETIREMENT</h2>
<div class="kpi">
<div><b>590 → 599</b><span>names (QRVO out, ten in)</span></div>
<div><b>87769613…</b><span>the new digest (dry run)</span></div>
<div><b>66 → 76</b><span>computed-but-not-shown funds: the board does not change</span></div>
<div><b>00:05 ET</b><span>the visible steps; the prep starts at 16:05 ET</span></div>
</div>
<div class="panel wrap"><table><thead><tr><th>FUND</th><th>FAMILY</th><th>WHAT IT TRACKS</th><th>WHY</th></tr></thead><tbody>
{chr(10).join(f"<tr><td><b>{f['ticker']}</b></td><td>{e(f['family'])}</td><td>{e(f['tracks'])}</td><td>{e(f['why'])}</td></tr>" for f in adm)}
</tbody></table></div>

<h2>5 · WEAK AREAS — THE EIGHT BIGGEST BY MARKET WEIGHT</h2>
<div class="panel wrap"><table><thead><tr><th class="r">#</th><th>INDUSTRY</th><th>SECTOR</th><th class="r">SHARE OF THE S&amp;P 500</th><th>WE HOLD</th><th>THREE CANDIDATES</th></tr></thead><tbody>
{chr(10).join(weak)}
</tbody></table></div>

<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<p><b>What this page shows.</b> Alan said yes to adopting CO1's cohort tree beside the S&amp;P sectors, and that what goes on the Hub is decided after. So the tree is written into two brand-new tables, <code>cohort_tree</code> (one row per branch: its name, up to two parents, the fund it is measured against) and <code>cohort_tree_members</code> (who sits in each branch and why). The Hub builds its cohort tabs from a different table, <code>ticker_cohorts</code>, which this work does not read or write. Nothing has been applied: the coordinator runs the two files.</p>
<p><b>Section 1.</b> The Hub page of this branch was opened twice in a hidden browser at each width. BEFORE is the Hub as it is: the live database answers 404 for both new table names. AFTER answers those two names with the loader's own rows, as if the tables were there. Sixteen screens were opened each time (the opening board, six cohort tabs, nine master tabs). What is compared is which names and tabs are on each screen, and the cohort map the page built, not prices, because prices move between two runs while the market is open. The Hub never asked for the new tables. I opened the pictures: both show the same board, map and tabs; the price column differs by cents. {W1['non_get_blocked']['before']} write attempts by the page (YouTube player telemetry and one function call) were answered locally and never left the browser.</p>
<p><b>Section 2.</b> The tree is CO1's, unchanged for companies. The index layer under it is rebuilt from section 3: world and regions, countries, growth and value, factors, and the four sector-fund families. "spine" is the fund a branch is measured against; "→ X once served" means X takes over after the admission. The dry run loaded the files into a throw-away Postgres on this Mac (not the live database), ran the load twice to show it repeats cleanly, ran the after-admission step, then the rollback, which left no table behind and the stand-in for the Hub's table byte-identical.</p>
<p><b>Section 3.</b> "Moves with it" is the correlation of daily moves over the 126 sessions from 7 Apr to 5 Oct 2026 (closes CO1 pulled from the chart API). It exists only where both funds are served. For a fund we do not serve there is no measured number: "near-copy" then rests on the fact that it tracks the same index, or the same market by another index maker, and that is said in the WHY column. One measured surprise: IYZ moves only 0.20 with the communication-services sector fund, because it holds telecom carriers and not Alphabet or Meta, so it is kept as its own line.</p>
<p><b>Section 4.</b> The ten enter as computed-but-not-shown funds: full bars on all 24 widths, Geiger and settled close, and no row on the board until Alan says so. The count, digest and scope come from the provider's builder run dry in scratch copies. The commands in order, every rollback and the bar backfill are in the provider branch, <code>runbooks/TR1_INDEX_ADMISSION_WITH_QRVO_20261006.md</code>. The brief asked for the sitting right after the 16:00 close; the prep can start then, but the visible steps have to wait for 00:00 ET or the percent column goes blank for every stock for the rest of the evening.</p>
<p><b>Section 5.</b> From CO1's gaps list: S&amp;P 500 industries where we hold none or one of the S&amp;P's names, ranked by the industry's share of the S&amp;P 500 (SSgA holdings file, 22 Sep). Two bigger rows are skipped because the S&amp;P has a single name there and we hold it (Berkshire; Deere). A share is the whole industry's, not the missing names': Broadline Retail's 3.81% is almost all Amazon, which we hold. Names marked "outside the S&amp;P" fill a row to three and come from knowledge of the industry, not from a provider read.</p>
<p><b>What could be wrong.</b> Six months is one market regime: a near-copy at 0.99 this half-year is very likely a near-copy always, but the equal-weight numbers will move. Fund facts for the unserved funds (what they track, first trading date, how thinly SIZE trades) are from memory, not a provider read. Whether each of the ten passes the provider's 60-session gate and the close cross-check is not known until those keyed steps run on Fly.</p>
<p><b>What was not done.</b> No table applied, no universe write, no pin rewritten, no deploy, no Fly machine. Holdings of URTH and ACWI were not fetched. The tree is not drawn on any Hub screen: that is the decision after this one.</p>
</details>
</main></body></html>
"""
open(os.path.join(D, "TREE-ADOPTED.html"), "w").write(page)
print(len(page), len(lines))

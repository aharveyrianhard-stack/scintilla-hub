#!/usr/bin/env python3
"""BT1 — builds BT1-BOWTIE-CHECK.html, verdicts.json and overlap.json from the files beside it.

Inputs (all read-only, all in the repo):
  data/live-dump-1680.json               every label and number the live Hub showed (headless, 6 Oct 2026)
  data/branch-dump-1680.json             the same walk on this branch's index.html
  data/geiger-as-live-page-received.json the chart API /geiger answer the live page itself received
  data/geiger-detail-*.json              /geiger?detail=1 for RSPT, XLK, RSPH, XLV (the seven timeframe rungs)
  data/daily-closes.json                 130 daily closes per fund, chart API /candles
  ../../20260928/coverage-tree/data/holdings.json   fund holdings (FMP, 26 / 28 Sep)
  ../cohort-proposal/proposal.json       the CO1 tree
Run: python3 deliverables/20261006/bt1-bowtie-check/tools/build.py
"""
import json, os, html

HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.dirname(HERE)
REPO = os.path.abspath(os.path.join(D, "..", "..", ".."))
J = lambda p: json.load(open(p, encoding="utf8"))
live = J(D + "/data/live-dump-1680.json")
after = J(D + "/data/branch-dump-1680.json")
feed = J(D + "/data/geiger-as-live-page-received.json")
G = feed["symbols"]
det = J(D + "/data/geiger-detail-RSPT-XLK-RSPH-XLV.json")["symbols"]
closes = J(D + "/data/daily-closes.json")["closes"]
HOLD = J(REPO + "/deliverables/20260928/coverage-tree/data/holdings.json")["data"]
PROP = J(REPO + "/deliverables/20261006/cohort-proposal/proposal.json")
E = html.escape

PAIRS = [["RSP", "SPY", "S&P 500"], ["QQQE", "QQQ", "NASDAQ-100"], ["EQAL", "IWB", "RUSSELL 1000"], ["RSPM", "XLB", "MATERIALS"],
         ["RSPG", "XLE", "ENERGY"], ["RSPF", "XLF", "FINANCIALS"], ["RSPN", "XLI", "INDUSTRIAL"], ["RSPT", "XLK", "TECH"],
         ["RSPS", "XLP", "STAPLES"], ["RSPR", "XLRE", "REAL ESTATE"], ["RSPU", "XLU", "UTILITIES"], ["RSPH", "XLV", "HEALTH"],
         ["RSPD", "XLY", "DISCRETIONARY"], ["RSPC", "XLC", "COMMS"]]
SECT_KEY = {"XLB": "MATERIALS", "XLE": "ENERGY", "XLF": "FINANCIALS", "XLI": "INDUSTRIAL", "XLK": "TECH", "XLP": "STAPLES",
            "XLRE": "REAL_ESTATE", "XLU": "UTILITIES", "XLV": "HEALTH", "XLY": "DISCRET", "XLC": "COMMS"}
FLAT = 0.05   # the strip's own L0_CMP_MIN_SPAN


def sgn(v, dp=2):
    return "—" if v is None else ("+" if v >= 0 else "−") + f"{abs(v):.{dp}f}"


def pct(v):
    return "—" if v is None else ("+" if v >= 0 else "−") + f"{abs(v):.1f}"


def ret(t, n):
    s = closes.get(t) or []
    return None if len(s) <= n else (s[-1][1] / s[-1 - n][1] - 1) * 100


def cls(v):
    return "" if v is None else ("up" if v >= 0 else "dn")


def shown_num(s):
    return None if s in (None, "—") else float(s.replace("−", "-"))


# ── 1. the bow tie, number by number ─────────────────────────────────────────────────────────────
shown = {c["key"]: c for c in live["views"]["BOWTIE"]["cols"]}
shown_after = {c["key"]: c for c in after["views"]["BOWTIE"]["cols"]}
bow = []
for ew, cw, name in PAIRS:
    a, b = G.get(ew), G.get(cw)
    row = {"name": name, "ew": ew, "cw": cw, "shown": shown[ew]["val"], "hover_before": shown[ew]["title"], "hover_after": shown_after[ew]["title"]}
    if not a or not b:
        row.update(verdict="CORRECT (EMPTY)", why="neither fund is served by the chart API (no Geiger, and /candles answers 404), so the column draws nothing and says so")
        bow.append(row); continue
    d = a["composite"] - b["composite"]
    g21 = ret(ew, 21) - ret(cw, 21); g63 = ret(ew, 63) - ret(cw, 63); g126 = ret(ew, 126) - ret(cw, 126)
    ok = abs(round(d, 2) - shown_num(shown[ew]["val"])) < 0.0051
    pinned = abs(a["trend"]) >= 0.995 and abs(b["trend"]) >= 0.995
    row.update(ewg=a["composite"], cwg=b["composite"], ewt=a["trend"], cwt=b["trend"], ewm=a["momentum"], cwm=b["momentum"],
               recomputed=d, price_gap_21=g21, price_gap_63=g63, price_gap_126=g126, ew63=ret(ew, 63), cw63=ret(cw, 63))
    if not ok:
        row.update(verdict="WRONG", why="the shown number does not equal the recomputed one")
    elif pinned:
        row.update(verdict="CORRECT BUT MISLABELED", why=f"the subtraction is right, but both funds' trend is pinned at the gauge's limit ({sgn(a['trend'])}), so the gap can only be about zero; the old hover called {shown[ew]['val']} 'the average stock is stronger than the index'")
    elif abs(d) < FLAT:
        row.update(verdict="CORRECT BUT MISLABELED", why=f"the subtraction is right, but a gap of {sgn(d)} is inside the strip's own flat floor (0.05); the old hover still called it '{'the average stock is stronger' if d >= 0 else 'carried by its biggest names'}'")
    else:
        agree = (d > 0) == (g63 > 0)
        row.update(verdict="CORRECT", why=("prices agree: " if agree else "prices do not clearly agree: ") +
                   f"over 63 sessions {ew} is {pct(ret(ew, 63))}% and {cw} is {pct(ret(cw, 63))}%, a gap of {pct(g63)} points")
    bow.append(row)
bow.sort(key=lambda r: -(r.get("recomputed") if r.get("recomputed") is not None else -99))

# ── 2. every fund view: the bar against the feed row, the line under it against the fund's own pair ──
fund_views = []
for v, label in [["EQWT", "EQUAL-WT (the RSP funds)"], ["SPDR", "SPDR"], ["ISHARES", "iSHARES"], ["VANGUARD", "VANGUARD"], ["INDEXES", "INDEXES"]]:
    rows = []
    acols = {c["key"]: c for c in after["views"][v]["cols"]}
    for c in live["views"][v]["cols"]:
        f = G.get(c["key"]); s = shown_num(c["val"])
        ok = f is not None and s is not None and abs(round(f["composite"], 2) - s) < 0.0051
        own = None if f is None else f"{abs(f['trend']):.2f}".replace("0.", ".", 1) + " / " + f"{abs(f['momentum']):.2f}".replace("0.", ".", 1)
        sub = (c["read"] or "").replace("­", "") + " " + (c["tm"] or "")
        sub_ok = "EMPTY" if (c["tm"] or "").startswith("—") else ("OK" if own.replace(" ", "") == (c["tm"] or "").replace("1.00", "1.00") else "WRONG")
        a = acols.get(c["key"], {})
        rows.append({"key": c["key"], "sector": c["title"].split(" · ")[0], "shown": c["val"], "feed": None if f is None else f["composite"], "bar": "CORRECT" if ok else "WRONG",
                     "sub_before": sub.strip(), "own": own, "sub_verdict": sub_ok, "sub_after": ((a.get("read") or "").replace("­", "") + " " + (a.get("tm") or "")).strip()})
    fund_views.append({"view": v, "label": label, "header": live["views"][v]["header"], "rows": rows})

# ── 3. COHORTS and OUR NAMES: the mean over the page's own membership, values from the page's map and from the feed ──
cs = live["views"]["COHORTS"]["cohsets"]; gp = live["views"]["COHORTS"]["gcomp"]; tm = live["views"]["MEMBERS"]["scinTM"]
group_views = []
for v, label, kf in [["COHORTS", "COHORTS", lambda k: k], ["MEMBERS", "OUR NAMES", lambda k: SECT_KEY[k]]]:
    rows = []
    for c in live["views"][v]["cols"]:
        mem = cs.get(kf(c["key"]), [])
        vp = [gp[t] for t in mem if t in gp]; vf = [G[t]["composite"] for t in mem if t in G and G[t].get("composite") is not None]
        m = sum(vp) / len(vp) if vp else None
        trs = [tm[t]["tr"] for t in mem if t in tm and tm[t]["tr"] is not None]; mos = [tm[t]["mo"] for t in mem if t in tm and tm[t]["mo"] is not None]
        ok = m is not None and abs(round(m, 2) - shown_num(c["val"])) < 0.0051
        tmr = (f"{abs(sum(trs) / len(trs)):.2f}".replace("0.", ".", 1) + "/" + f"{abs(sum(mos) / len(mos)):.2f}".replace("0.", ".", 1)) if trs and mos else "—"
        rows.append({"key": c["key"], "label": c["lbl"], "shown": c["val"], "recomputed": m, "n": len(vp), "n_in_feed": len(vf), "bar": "CORRECT" if ok else "WRONG",
                     "tm_shown": c["tm"], "tm_recomputed": tmr, "tm": "CORRECT" if tmr == c["tm"] else "WRONG", "read": (c["read"] or "").replace("­", "")})
    group_views.append({"view": v, "label": label, "header": live["views"][v]["header"], "rows": rows})

# ── 4. the rungs: the composite rebuilt from the seven timeframes ──
rungs = []
for t, s in det.items():
    W = TR = MO = 0
    for k, r in s["rungs"].items():
        if r.get("availability") != "AVAILABLE": continue
        w = r["eq_weight"]; W += w; TR += w * r["trend_signed"]; MO += w * r["momentum_signed"]
    rungs.append({"t": t, "feed": s["composite"], "trend": TR / W, "mom": MO / W, "rebuilt": (TR / W + MO / W) / 2,
                  "rung_trend": {k: r.get("trend_signed") for k, r in s["rungs"].items()}})

# ── 5. IGV against QQQ against our AI tabs, and the CO1 tree ──
igv = dict(HOLD["IGV"]["h"]); qqq = dict(HOLD["QQQ"]["h"])
AI = {"AI_HARDWARE": "AI HW", "AI_SOFTWARE": "AI SW", "AI_POWERTRAIN": "AI POWER"}
ai_of = {}
for k, lab in AI.items():
    for t in cs.get(k, []): ai_of.setdefault(t, []).append(lab)
heads = PROP["headings"]
co1 = {}
for c in PROP["cohorts"]:
    for t in c["members"]:
        co1.setdefault(t, []).append(c["label"] + " (" + " + ".join(heads.get(p, {}).get("label", p) for p in c["parents"]) + ")")
served = set(G)
prof = {}
try:
    for p in J(REPO + "/deliverables/20261006/cohort-proposal/data/company_profile-20261006.json"):
        prof[p.get("ticker") or p.get("symbol")] = p
except Exception:
    pass


def cap_of(t):
    p = prof.get(t) or {}
    for k in ("market_cap", "mkt_cap", "mktCap", "marketCap"):
        if p.get(k): return float(p[k])
    return 0.0


def orow(t):
    return {"t": t, "igv": igv.get(t), "qqq": qqq.get(t), "ai": " + ".join(ai_of.get(t, [])) or None, "served": t in served,
            "co1": "; ".join(co1.get(t, [])) or None, "geiger": (G.get(t) or {}).get("composite")}


top_igv = [orow(t) for t, _ in sorted(igv.items(), key=lambda x: -x[1])[:25]]
top_qqq = [orow(t) for t, _ in sorted(qqq.items(), key=lambda x: -x[1])[:25]]
ai_sorted = sorted(ai_of, key=lambda t: -cap_of(t))
top_ai = [orow(t) for t in ai_sorted[:25]]
inter = lambda a, b: sorted(set(a) & set(b))
ai_set = set(ai_of)
summary = {
    "igv_holdings": len(igv), "qqq_holdings": len(qqq), "ai_names": len(ai_set),
    "igv_in_qqq_n": len(inter(igv, qqq)), "igv_weight_in_qqq": sum(igv[t] for t in inter(igv, qqq)), "qqq_weight_in_igv": sum(qqq[t] for t in inter(igv, qqq)),
    "igv_in_ai": inter(igv, ai_set), "igv_weight_in_ai": sum(igv[t] for t in inter(igv, ai_set)),
    "igv_only_n": len([t for t in igv if t not in qqq and t not in ai_set]), "igv_only_weight": sum(w for t, w in igv.items() if t not in qqq and t not in ai_set),
    "igv_served_n": len([t for t in igv if t in served]), "igv_served_weight": sum(w for t, w in igv.items() if t in served),
    "ai_in_qqq_n": len(inter(ai_set, qqq)), "qqq_weight_in_ai": sum(qqq[t] for t in inter(ai_set, qqq)),
    "top25_igv_in_qqq": [r["t"] for r in top_igv if r["qqq"]], "top25_igv_in_ai": [r["t"] for r in top_igv if r["ai"]],
    "top25_igv_not_served": [r["t"] for r in top_igv if not r["served"]],
    "igv_only_top": [[t, w] for t, w in sorted(igv.items(), key=lambda x: -x[1]) if t not in qqq and t not in ai_set][:12],
    "holdings_source": HOLD["IGV"]["source"],
}
co1_count = {}
for r in top_igv:
    for lab in (co1.get(r["t"]) or ["not placed: the name is not served by the Hub"]):
        co1_count.setdefault(lab, []).append(r["t"])
summary["top25_igv_co1"] = co1_count

json.dump({"feed_published_utc": feed.get("published_utc"), "live_walk_utc": live["at"], "branch_walk_utc": after["at"], "bow_tie": bow,
           "fund_views": fund_views, "group_views": group_views, "rungs": rungs}, open(D + "/verdicts.json", "w"), indent=1)
json.dump({"summary": summary, "igv_top25": top_igv, "qqq_top25": top_qqq, "ai_top25_by_market_cap": top_ai}, open(D + "/overlap.json", "w"), indent=1)

# ── the page ────────────────────────────────────────────────────────────────────────────────────
VC = {"CORRECT": "ok", "CORRECT (EMPTY)": "ok", "CORRECT BUT MISLABELED": "warn", "WRONG": "bad", "OK": "ok", "EMPTY": "warn"}
tag = lambda v: f'<span class="v {VC.get(v, "")}">{E(v)}</span>'
w = []
w.append("""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BT1 · Bow tie check</title>
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
.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pair figure{margin:0}.pair img{width:100%;display:block;border:1px solid var(--line)}
figcaption{color:var(--dim);font-size:11px;margin-top:6px}.kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.kpi div{background:var(--panel);border:1px solid var(--line);padding:10px 12px}.kpi b{display:block;font-size:18px;color:var(--bright);font-weight:600}.kpi span{color:var(--dim);font-size:11px}
.hov{color:var(--dim)}.hov b{color:var(--ink);font-weight:500}.wrap{overflow-x:auto}.small{font-size:11px;color:var(--dim)}
details.sc-pagespecs{margin-top:40px;border-top:1px solid var(--line);padding-top:12px;color:var(--dim)}details.sc-pagespecs summary{cursor:pointer;color:var(--bright);letter-spacing:.12em}details.sc-pagespecs p{max-width:900px}
@media(max-width:700px){.pair{grid-template-columns:1fr}body{padding:20px 16px 50px}}
</style></head><body><main>
<span data-scnav-slot></span><h1>BT1 · IS THE COHORT COMPARE BOW TIE RIGHT?</h1>
<p class="sub">6 Oct 2026 · a check and one small fix on a branch · nothing on the Hub changed · branch hub/bt1-bowtie-check-20261006</p>
""")
h = next(r for r in bow if r["ew"] == "RSPH"); t = next(r for r in bow if r["ew"] == "RSPT"); sp = next(r for r in bow if r["ew"] == "RSP")
w.append(f"""<div class="kpi">
<div><b>{sum(1 for r in bow if r.get('recomputed') is not None and r['verdict'] != 'WRONG')} / {sum(1 for r in bow if r.get('recomputed') is not None)}</b><span>bow tie numbers reproduce exactly from the feed (the 14th, Russell 1000, is empty: its two funds are not served)</span></div>
<div><b class="up">HEALTH {E(h['shown'])}</b><span>correct, and prices agree: {h['ew']} {pct(h['ew63'])}% against {h['cw']} {pct(h['cw63'])}% over 63 sessions</span></div>
<div><b>TECH {E(t['shown'])}</b><span>correct but it cannot say more: both tech funds sit at the top of the gauge</span></div>
<div><b class="dn">11 lines wrong</b><span>under the SPDR bars: the words and trend / momentum were our names', not the fund's. Fixed on the branch.</span></div>
</div>

<h2>1 · THE BOW TIE, BEFORE AND AFTER</h2>
<div class="pair">
<figure><img src="shots/before-1680-BOWTIE.png" alt="the live bow tie"><figcaption>LIVE (before). Health {E(h['shown'])}, financials +0.02, tech {E(t['shown'])}, S&amp;P {E(sp['shown'])}.</figcaption></figure>
<figure><img src="shots/after-1680-BOWTIE.png" alt="the bow tie on the branch"><figcaption>BRANCH (after). The same bars and numbers: nothing was wrong with them. Only the hover line of each column changed (table below).</figcaption></figure>
</div>

<h2>2 · THE BOW TIE, NUMBER BY NUMBER</h2>
<div class="panel wrap"><table>
<tr><th>column</th><th class="r">shown</th><th class="r">equal-weight fund</th><th class="r">cap-weight fund</th><th class="r">recomputed</th><th class="r">price gap, 63 sessions</th><th class="r">126</th><th>verdict</th><th>why</th></tr>""")
for r in bow:
    if r.get("recomputed") is None:
        w.append(f"<tr><td>{E(r['name'])}</td><td class='r'>—</td><td class='r'>{r['ew']} —</td><td class='r'>{r['cw']} —</td><td class='r'>—</td><td class='r'>—</td><td class='r'>—</td><td>{tag(r['verdict'])}</td><td>{E(r['why'])}</td></tr>")
        continue
    w.append(f"<tr><td>{E(r['name'])}</td><td class='r {cls(shown_num(r['shown']))}'>{E(r['shown'])}</td><td class='r'>{r['ew']} {sgn(r['ewg'], 3)}</td><td class='r'>{r['cw']} {sgn(r['cwg'], 3)}</td>"
             f"<td class='r {cls(r['recomputed'])}'>{sgn(r['recomputed'], 3)}</td><td class='r {cls(r['price_gap_63'])}'>{pct(r['price_gap_63'])} pts</td><td class='r {cls(r['price_gap_126'])}'>{pct(r['price_gap_126'])} pts</td><td>{tag(r['verdict'])}</td><td>{E(r['why'])}</td></tr>")
w.append("</table></div>")
w.append("<h3>THE HOVER LINE OF EACH COLUMN, BEFORE → AFTER</h3><div class='panel wrap'><table><tr><th>column</th><th>live</th><th>branch</th></tr>")
for r in bow:
    w.append(f"<tr><td>{E(r['name'])}</td><td class='hov'>{E(r['hover_before'])}</td><td class='hov'><b>{E(r['hover_after'])}</b></td></tr>")
w.append("</table></div>")

w.append("""<h2>3 · THE RSP EQUAL-WEIGHT VIEW AND THE OTHER FUND VIEWS</h2>
<div class="pair">
<figure><img src="shots/before-1680-EQWT.png" alt="equal-weight, live"><figcaption>EQUAL-WT, LIVE. Bars correct. The two lines under each bar are dashes.</figcaption></figure>
<figure><img src="shots/after-1680-EQWT.png" alt="equal-weight, branch"><figcaption>EQUAL-WT, BRANCH. Same bars; each fund's own word and trend / momentum under it.</figcaption></figure>
<figure><img src="shots/before-1680-SPDR.png" alt="SPDR, live"><figcaption>SPDR, LIVE. XLK's bar is the fund (+0.94) but the line under it, "constructive .31 / .30", is the average of our 70 tech names.</figcaption></figure>
<figure><img src="shots/after-1680-SPDR.png" alt="SPDR, branch"><figcaption>SPDR, BRANCH. XLK reads "aligned bull 1.00 / .88": the fund's own trend and momentum.</figcaption></figure>
</div>""")
for fv in fund_views:
    w.append(f"<h3>{E(fv['label'])} · header: “{E(fv['header'])}”</h3><div class='panel wrap'><table><tr><th>fund</th><th>sector</th><th class='r'>bar shown</th><th class='r'>feed row</th><th>bar</th><th>line under it, live</th><th class='r'>the fund's own trend / momentum</th><th>line</th><th>line on the branch</th></tr>")
    for r in fv["rows"]:
        w.append(f"<tr><td>{r['key']}</td><td>{E(r['sector'])}</td><td class='r {cls(shown_num(r['shown']))}'>{E(r['shown'])}</td><td class='r'>{sgn(r['feed'], 4)}</td><td>{tag(r['bar'])}</td>"
                 f"<td>{E(r['sub_before'])}</td><td class='r'>{E(r['own'] or '—')}</td><td>{tag(r['sub_verdict'])}</td><td>{E(r['sub_after'])}</td></tr>")
    w.append("</table></div>")

w.append("<h2>4 · COHORTS AND OUR NAMES</h2>")
for gv in group_views:
    w.append(f"<h3>{E(gv['label'])} · header: “{E(gv['header'])}”</h3><div class='panel wrap'><table><tr><th>column</th><th class='r'>shown</th><th class='r'>recomputed mean</th><th class='r'>names</th><th>bar</th><th>word</th><th class='r'>trend / mom shown</th><th class='r'>recomputed</th><th>line</th></tr>")
    for r in gv["rows"]:
        note = "" if r["n"] == r["n_in_feed"] else f" <span class='small'>({r['n_in_feed']} from the chart API, {r['n'] - r['n_in_feed']} crypto / futures / rates from the Hub's second source)</span>"
        w.append(f"<tr><td>{E(r['label'])}</td><td class='r {cls(shown_num(r['shown']))}'>{E(r['shown'])}</td><td class='r'>{sgn(r['recomputed'], 4)}</td><td class='r'>{r['n']}{note}</td><td>{tag(r['bar'])}</td><td>{E(r['read'])}</td><td class='r'>{E(r['tm_shown'])}</td><td class='r'>{E(r['tm_recomputed'])}</td><td>{tag(r['tm'])}</td></tr>")
    w.append("</table></div>")

w.append("<h2>5 · WHY TECH SAYS +0.00</h2><div class='panel wrap'><table><tr><th>fund</th><th class='r'>Geiger in the feed</th><th class='r'>rebuilt from the seven timeframes</th><th class='r'>trend</th><th class='r'>momentum</th><th>trend on each timeframe (3h 4h 6h 12h 1D 3D 1W)</th></tr>")
for r in rungs:
    order = ["3h", "4h", "6h", "12h", "1d", "3d", "1w"]
    w.append(f"<tr><td>{r['t']}</td><td class='r'>{sgn(r['feed'], 4)}</td><td class='r'>{sgn(r['rebuilt'], 4)}</td><td class='r'>{sgn(r['trend'], 3)}</td><td class='r'>{sgn(r['mom'], 3)}</td><td>{'  '.join(sgn(r['rung_trend'].get(k)) for k in order)}</td></tr>")
w.append("</table></div>")

s = summary
w.append(f"""<h2>6 · IGV AGAINST QQQ AGAINST OUR AI NAMES</h2>
<div class="kpi">
<div><b>{s['igv_in_qqq_n']} of {s['igv_holdings']}</b><span>IGV names are also in QQQ. They are {s['igv_weight_in_qqq']:.0f}% of IGV but only {s['qqq_weight_in_igv']:.1f}% of QQQ.</span></div>
<div><b>{len(s['igv_in_ai'])} names</b><span>of IGV sit in our three AI tabs ({s['igv_weight_in_ai']:.0f}% of IGV): {' '.join(s['igv_in_ai'])}</span></div>
<div><b>{s['igv_only_n']} names · {s['igv_only_weight']:.0f}%</b><span>of IGV are in neither QQQ nor our AI tabs: the application layer</span></div>
<div><b>{s['igv_served_n']} of {s['igv_holdings']}</b><span>IGV names are served by the Hub at all ({s['igv_served_weight']:.0f}% of the fund by weight)</span></div>
</div>
<h3>IGV · TOP 25 BY WEIGHT</h3><div class="panel wrap"><table><tr><th>name</th><th class="r">IGV %</th><th class="r">QQQ %</th><th>our AI tab today</th><th>where it sits in the CO1 tree: cohort (parents)</th><th class="r">Geiger now</th></tr>""")
for r in top_igv:
    w.append(f"<tr><td>{r['t']}</td><td class='r'>{r['igv']:.2f}</td><td class='r'>{'—' if r['qqq'] is None else format(r['qqq'], '.2f')}</td><td>{E(r['ai'] or '—')}</td><td>{E(r['co1'] or ('not on the Hub' if not r['served'] else 'served, not placed'))}</td><td class='r {cls(r['geiger'])}'>{sgn(r['geiger'])}</td></tr>")
w.append("</table></div><h3>QQQ · TOP 25 BY WEIGHT</h3><div class='panel wrap'><table><tr><th>name</th><th class='r'>QQQ %</th><th class='r'>IGV %</th><th>our AI tab today</th><th>CO1 cohort (parents)</th><th class='r'>Geiger now</th></tr>")
for r in top_qqq:
    w.append(f"<tr><td>{r['t']}</td><td class='r'>{r['qqq']:.2f}</td><td class='r'>{'—' if r['igv'] is None else format(r['igv'], '.2f')}</td><td>{E(r['ai'] or '—')}</td><td>{E(r['co1'] or ('not on the Hub' if not r['served'] else 'served, not placed'))}</td><td class='r {cls(r['geiger'])}'>{sgn(r['geiger'])}</td></tr>")
w.append("</table></div><h3>OUR AI NAMES · THE 25 LARGEST BY MARKET VALUE (the tabs carry no weights)</h3><div class='panel wrap'><table><tr><th>name</th><th>our AI tab today</th><th class='r'>QQQ %</th><th class='r'>IGV %</th><th>CO1 cohort (parents)</th><th class='r'>Geiger now</th></tr>")
for r in top_ai:
    w.append(f"<tr><td>{r['t']}</td><td>{E(r['ai'] or '—')}</td><td class='r'>{'—' if r['qqq'] is None else format(r['qqq'], '.2f')}</td><td class='r'>{'—' if r['igv'] is None else format(r['igv'], '.2f')}</td><td>{E(r['co1'] or '—')}</td><td class='r {cls(r['geiger'])}'>{sgn(r['geiger'])}</td></tr>")
w.append("</table></div>")

w.append(f"""<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<p><b>What the bow tie number is.</b> Each bar is one fund's Geiger minus another's: the equal-weight fund (every stock counts the same) minus the ordinary fund of the same stocks (the biggest companies count most). The Geiger is a score from −1 to +1, so the gap is in Geiger points, never percent. Source: index.html, the BOW TIE branch of cohortCompareRows (BOWTIE_PAIRS, <code>ew − cw</code>), fed by GCOMP, which is filled from the chart API route /geiger (field <code>composite</code>).</p>
<p><b>How each number was checked.</b> A headless browser walked the live Hub ({E(live['at'])}; page sha256 {E(str(live.get('pageSha'))[:12])}) and wrote down every label, number and hover of all eight COHORT COMPARE views. The /geiger answer that same page received (published {E(str(feed.get('published_utc')))}) was saved, and every bar was recomputed from those rows outside the page. For four funds the Geiger itself was rebuilt from the seven timeframes of /geiger?detail=1 (each timeframe's trend and momentum, weighted by the Equalizer weights in that answer). The price columns are a separate sanity check: daily closes from /candles, the equal-weight fund's return minus the cap-weight fund's.</p>
<p><b>Why tech says +0.00.</b> RSPT and XLK both have trend +1.00 on all seven timeframes, the top of the gauge, and near-identical momentum. The trend half cannot go above +1, so two funds that are both fully bullish can only differ by their momentum: the gap is +0.003. Prices agree that there is little to see: over 63 sessions RSPT is {pct(t['ew63'])}% and XLK {pct(t['cw63'])}%.</p>
<p><b>What was wrong.</b> Under each SPDR bar the page printed a word and a trend / momentum pair. The bar was the fund's own Geiger, but the pair was the average of OUR names in that sector (the lookup turned the key XLK into our 70 tech names). So XLK's +0.94 sat over ".31 / .30 constructive". The iShares, Vanguard and equal-weight funds printed dashes there. On the branch every fund column reads the fund's own pair from the same /geiger answer as its bar; OUR NAMES and COHORTS still average their members. The bow tie's hover now says Geiger points, calls a gap inside ±0.05 (the strip's existing flat floor) "level", and says when both funds are at the gauge's limit.</p>
<p><b>What could be wrong.</b> The Geiger moves through the day, so the numbers here are one moment (the feed's publish time above). The page's verification label on that answer was "{E(str(feed.get('verification', {}).get('label')))}". Holdings are the FMP files of 26 and 28 Sep, not today's. "Our AI names" are the three Hub tabs as loaded by the live page; they carry no weights, so their top 25 is by market value from the company profile file of 6 Oct. The cohort and OUR NAMES averages were recomputed over the page's own membership list; the crypto, futures and rate lines in INDEX, CRYPTO, MACRO and METALS come from the Hub's second source, not the chart API, and were not traced further.</p>
<p><b>What was not done.</b> Nothing deployed. No table written. The rewound (REWIND bar) bow tie was not walked. EQAL and IWB are not served, so the Russell 1000 column stays empty. "−0.00" (XLB at −0.001) still prints with a minus sign. Hovers do not appear in headless pictures, so they are printed as text in section 2.</p>
<p><b>Files.</b> verdicts.json, overlap.json, data/ (the walks, the feed as received, closes), tools/capture.mjs, tools/build.py, shots/ (1680 and 390, before and after). Test: tests/bt1-bowtie-check.test.mjs.</p>
</details>
</main></body></html>""")
open(D + "/BT1-BOWTIE-CHECK.html", "w", encoding="utf8").write("\n".join(w))
print("bow tie verdicts:", [(r["name"], r["shown"], r["verdict"]) for r in bow])
print("fund lines wrong:", {fv["view"]: sum(1 for r in fv["rows"] if r["sub_verdict"] == "WRONG") for fv in fund_views}, "bars wrong:", sum(1 for fv in fund_views for r in fv["rows"] if r["bar"] != "CORRECT"))
print("group bars wrong:", sum(1 for gv in group_views for r in gv["rows"] if r["bar"] != "CORRECT"), "tm wrong:", sum(1 for gv in group_views for r in gv["rows"] if r["tm"] != "CORRECT"))
print(json.dumps(summary, indent=1)[:2600])

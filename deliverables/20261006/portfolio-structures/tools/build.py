# PF1 · builds PORTFOLIO-STRUCTURES.html from the JSON the structure files wrote. Every number on the page is read from
# data/*.json at build time — nothing is typed in by hand — so re-running a structure and this file refreshes the page.
import json, os, sys, math
import viz as V
from viz import esc, pct, pts, cell

HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "..", "data"); OUT = os.path.join(HERE, "..", "PORTFOLIO-STRUCTURES.html")
def J(name):
    p = os.path.join(DATA, name); return json.load(open(p)) if os.path.exists(p) else None
S0 = J("s0_baselines.json"); FILES = ["s1_core_satellite", "s2_trend_core", "s3_dual_momentum", "s4_vol_sizing", "s5_level_scaling", "s6_paid_to_wait"]
S = {k: J(k + ".json") for k in FILES}; LIT = J("literature.json") or {"literature": [], "tools": []}; M6 = J("s6b_cboe_measured.json")
missing = [k for k, v in S.items() if v is None] + ([] if M6 else ["s6b_cboe_measured"])
if missing: sys.exit("not built yet: " + ", ".join(missing))

def var(sj, key=None):
    return sj["variants"][0] if key is None else next(v for v in sj["variants"] if v.get("key") == key or v["label"] == key)
B = {v["label"]: v for v in S0["variants"]}
SPY, QQQ, MIX, BILLS = B["Buy and hold SPY"], B["Buy and hold QQQ"], B["60/40 (SPY / 7-10y Treasuries)"], B["All cash (Treasury bills)"]
LADDER = B["Cash by default — the July heat ladder"]; DIALS = B["R4's two dials (REGIME + STRETCH)"]
NAMES = {"s1_core_satellite": "1 · Core + satellite", "s2_trend_core": "2 · Trend-filtered core", "s3_dual_momentum": "3 · Dual momentum",
         "s4_vol_sizing": "4 · Volatility-targeted sizing", "s5_level_scaling": "5 · Level-based scaling in", "s6_paid_to_wait": "6 · Getting paid to wait (modelled)"}
HEAD = {k: var(S[k]) for k in FILES}
HEAD["s6_paid_to_wait"] = next(v for v in M6["variants"] if v["key"] == "put_measured")       # structure 6's headline is the MEASURED Cboe put-selling index
NAMES["s6_paid_to_wait"] = "6 · Getting paid to wait"
MODEL_PUT = var(S["s6_paid_to_wait"], "put_at_the_money")                                      # only for the option-maths estimate of stock risk
import text as T_
import extras as X
TEXT = T_.make(S0, S, HEAD)
def stock(x): return "—" if x is None else f"{x:.0f}%"
SLOW = var(S["s2_trend_core"], "trend_and_breadth_3day"); SLOW_NAME = "2b · Trend-filtered core, three-close wait"     # the slow version of structure 2: best fit 2
C7 = J("s7_combined.json"); BOTH = next(v for v in C7["variants"] if v["key"] == "core_sat_filtered")
ROWS = []                                                # (name, variant, row class, sub-label) for every structure row, in page order
for k in FILES:
    ROWS.append((NAMES[k], HEAD[k], "hl" if k == "s1_core_satellite" else "", HEAD[k]["label"] + (f' · from {HEAD[k]["full_from"][:4]}' if HEAD[k].get("full_from") else "")))
    if k == "s2_trend_core": ROWS.append((SLOW_NAME, SLOW, "hl", SLOW["label"]))
PB = S0["pullbacks_last2"]; BO = S0["breakouts_last2"]
def dmy(d):
    y, m, dd = d.split("-"); return f"{int(dd)} {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][int(m) - 1]} {y}"
def dm(d): return dmy(d).rsplit(" ", 1)[0] + " " + d[2:4]

# ---------------------------------------------------------------- the comparison table
def cmp_row(name, v, cls="", sub=""):
    f, l, st = v.get("full"), v["last2"], v.get("stress") or {}
    c = [f'<td>{esc(name)}{"<br><span class=src>" + esc(sub) + "</span>" if sub else ""}</td>']
    c += [cell(f["cagr_pct"], dp=1), cell(f["max_dd_pct"], signed=False), f'<td>{stock(f["avg_stock_pct"])}</td>'] if f else ["<td>—</td>"] * 3
    c += [cell(l["total_return_pct"]), cell(l["max_dd_pct"], signed=False), f'<td>{stock(l["avg_stock_pct"])}</td>', f'<td>{l["decision_days_per_month"]:.1f}</td>']
    c += [cell(st.get(k), signed=True) for k in ["2008 crash", "2020 crash", "2022 bear"]]
    return f'<tr class="{cls}">' + "".join(c) + "</tr>"
def cmp_table():
    h = ("<tr><th>structure (its main version)</th><th>return a year<br>2005–2026</th><th>worst fall<br>2005–2026</th><th>in stocks<br>on average</th>"
         "<th>last 2 years<br>total return</th><th>last 2 years<br>worst fall</th><th>last 2 years<br>in stocks</th><th>decision days<br>a month</th>"
         "<th>2008 crash</th><th>2020 crash</th><th>2022 bear</th></tr>")
    rows = [cmp_row(n, v, c, sub) for n, v, c, sub in ROWS] + [cmp_row("1 + 2b together", BOTH, "", "core + satellite with the core under the three-close trend rule")]
    rows += [cmp_row("Buy and hold SPY", SPY, "base"), cmp_row("Buy and hold QQQ", QQQ, "base"), cmp_row("60 / 40 (SPY / Treasuries)", MIX, "base"),
             cmp_row("Cash by default — the July heat ladder", LADDER, "base", "the allocation tool's own ladder, replayed; two years only"),
             cmp_row("R4's two dials", DIALS, "base", "proposal on a branch; two years only"), cmp_row("All cash (Treasury bills)", BILLS, "base")]
    return f'<div class="tw"><table>{h}{"".join(rows)}</table></div>'

# ---------------------------------------------------------------- the last two years, episode by episode
def pullback_table():
    h1 = "<tr><th></th>" + "".join(f'<th colspan="3" style="text-align:center">{dm(p["peak"])} → {dm(p["trough"])} · SPY {pct(p["depth_pct"], signed=False)}</th>' for p in PB) + "</tr>"
    h2 = "<tr><th>structure</th>" + "<th>in stocks<br>top → low</th><th>fell</th><th>40 sessions<br>after the low</th>" * len(PB) + "</tr>"
    def row(name, v, cls=""):
        c = [f"<td>{esc(name)}</td>"]
        for r in v["scorecard"]["pullbacks"]:
            c += [f'<td>{r["stock_at_peak_pct"]}% → {r["stock_at_trough_pct"]}%</td>' if r["stock_at_peak_pct"] is not None else "<td>—</td>", cell(r["fall_pct"], signed=False), cell(r["rebound40_pct"])]
        return f'<tr class="{cls}">' + "".join(c) + "</tr>"
    rows = [row(n, v, c) for n, v, c, _ in ROWS] + [row("1 + 2b together", BOTH), row("Buy and hold SPY", SPY, "base"), row("Cash by default — the July ladder", LADDER, "base"), row("R4's two dials", DIALS, "base")]
    return f'<div class="tw"><table>{h1}{h2}{"".join(rows)}</table></div>'
def breakout_table():
    evs = HEAD[FILES[0]]["scorecard"]["breakouts"]
    h = "<tr><th>structure — share in stocks on the day of each breakout</th>" + "".join(f'<th>{e["sym"]}<br>{dm(e["date"])}</th>' for e in evs) + "<th>average</th><th>kept of the next<br>20 sessions</th></tr>"
    def row(name, v, cls=""):
        b = v["scorecard"]["breakouts"]; done = [e for e in b if "next20_pct" in e]
        got = sum(e["next20_pct"] for e in done); had = sum(e["fund_next20_pct"] for e in done)
        known = [e["stock_on_break_pct"] for e in b if e["stock_on_break_pct"] is not None]
        return (f'<tr class="{cls}"><td>{esc(name)}</td>' + "".join(f'<td>{stock(e["stock_on_break_pct"])}</td>' for e in b) + (f'<td><b>{sum(known) / len(known):.0f}%</b></td>' if known else "<td>—</td>")
                + f'<td>{pts(got)} of {pts(had)}</td></tr>')
    rows = [row(n, v, c) for n, v, c, _ in ROWS] + [row("1 + 2b together", BOTH), row("Buy and hold SPY", SPY, "base"), row("Cash by default — the July ladder", LADDER, "base"), row("R4's two dials", DIALS, "base")]
    return f'<div class="tw"><table>{h}{"".join(rows)}</table></div>'

# ---------------------------------------------------------------- pictures
COL = {"SPY": V.BLUE, "ladder": V.ORANGE, "s2": V.AQUA, "s1": V.YELLOW, "s3": V.MAGENTA}   # one colour per entity, the palette's first five in its fixed order; the combination is a dashed neutral line
def hero_bars():
    rows = [{"label": "Cash by default — the July heat ladder", "value": LADDER["last2"]["avg_stock_pct"], "color": V.ORANGE, "right": f'made {pct(LADDER["last2"]["total_return_pct"])}', "hl": True}]
    rows += [{"label": n + (" (option-maths estimate)" if v["last2"]["avg_stock_pct"] is None else ""), "value": v["last2"]["avg_stock_pct"] if v["last2"]["avg_stock_pct"] is not None else MODEL_PUT["last2"]["avg_stock_pct"],
              "color": V.BLUE, "right": f'made {pct(v["last2"]["total_return_pct"])}'} for n, v, _, _ in ROWS]
    rows += [{"label": "1 + 2b together", "value": BOTH["last2"]["avg_stock_pct"], "color": V.BLUE, "right": f'made {pct(BOTH["last2"]["total_return_pct"])}'}]
    rows += [{"label": "R4's two dials (branch proposal)", "value": DIALS["last2"]["avg_stock_pct"], "color": V.INK3, "right": f'made {pct(DIALS["last2"]["total_return_pct"])}'},
             {"label": "Buy and hold SPY", "value": 100, "color": V.INK3, "right": f'made {pct(SPY["last2"]["total_return_pct"])}'}]
    return V.hbar_chart(rows, "Share of the money in stocks, on average — 3 Oct 2024 to 5 Oct 2026", note=TEXT["cap_hero"])
def shades(): return [(p["peak"], p["trough"], pct(p["depth_pct"], signed=False)) for p in PB]
def last2_lines():
    def s(name, v, c): return {"name": name, "color": c, "dates": v["curve_last2"]["dates"], "values": v["curve_last2"]["equity"]}
    ser = [s("Buy and hold SPY", SPY, COL["SPY"]), s("1 · Core + satellite", HEAD["s1_core_satellite"], COL["s1"]), s("2b · Trend core, 3-close wait", SLOW, COL["s2"]),
           s("3 · Dual momentum", HEAD["s3_dual_momentum"], COL["s3"]), s("Cash by default (ladder)", LADDER, COL["ladder"])]
    return V.line_chart(ser, "1.00 put in on 3 Oct 2024 — the last two years, total return", h=440, shades=shades(), note=TEXT["cap_last2"])
def full_lines():
    def s(name, v, c): return {"name": name, "color": c, "dates": v["curve_full"]["dates"], "values": v["curve_full"]["equity"]}
    ser = [s("Buy and hold SPY", SPY, COL["SPY"]), s("1 · Core + satellite", HEAD["s1_core_satellite"], COL["s1"]), s("2b · Trend core, 3-close wait", SLOW, COL["s2"]),
           s("3 · Dual momentum", HEAD["s3_dual_momentum"], COL["s3"]), {**s("1 + 2b together", BOTH, V.INK), "dash": "6 4"}]
    return V.line_chart(ser, "1.00 put in on 3 Jan 2005 — twenty-one years, total return (each step up the scale is a doubling)", h=440, log=True, note=TEXT["cap_full"])
def exposure_lines():
    def s(name, v, c): return {"name": name, "color": c, "dates": v["curve_last2"]["dates"], "values": [round(100 * x) for x in v["curve_last2"]["stock"]]}
    ser = [s("2b · Trend core, 3-close wait", SLOW, COL["s2"]), s("Cash by default (ladder)", LADDER, COL["ladder"])]
    return V.line_chart(ser, "Percent of the money in stocks, day by day — the slow trend rule against the July ladder", h=300, unit="%", shades=shades(), ymin=0, ymax=100,
                        fmt=lambda v: f"{v:.0f}%", step_series={"2b · Trend core, 3-close wait", "Cash by default (ladder)"}, note=TEXT["cap_exposure"])

# ---------------------------------------------------------------- per-structure blocks
def variant_table(sj):
    h = ("<tr><th>version</th><th>return a year<br>2005–2026</th><th>worst fall<br>2005–2026</th><th>in stocks</th><th>last 2 years<br>return</th><th>last 2 years<br>worst fall</th>"
         "<th>last 2 years<br>in stocks</th><th>decision days<br>a month</th></tr>")
    rows = []
    for i, v in enumerate(sj["variants"]):
        f, l = v.get("full"), v["last2"]
        c = [f'<td>{esc(v["label"])}</td>'] + ([cell(f["cagr_pct"]), cell(f["max_dd_pct"], signed=False), f'<td>{stock(f["avg_stock_pct"])}</td>'] if f else ["<td>—</td>"] * 3)
        c += [cell(l["total_return_pct"]), cell(l["max_dd_pct"], signed=False), f'<td>{stock(l["avg_stock_pct"])}</td>', f'<td>{l["decision_days_per_month"]:.1f}</td>']
        rows.append(f'<tr class="{"hl" if i == 0 else ""}">' + "".join(c) + "</tr>")
    rows.append(f'<tr class="base"><td>Buy and hold SPY, for scale</td>{cell(SPY["full"]["cagr_pct"])}{cell(SPY["full"]["max_dd_pct"], signed=False)}<td>100%</td>{cell(SPY["last2"]["total_return_pct"])}{cell(SPY["last2"]["max_dd_pct"], signed=False)}<td>100%</td><td>0.0</td></tr>')
    return f'<div class="tw"><table>{h}{"".join(rows)}</table></div>'
def lit_block(key, show=5):
    """Only findings the independent fact-checker marked verified or corrected are printed, each with the source pages that loaded."""
    items = [x for x in LIT["literature"] if x["key"] in (key if isinstance(key, (list, tuple)) else [key])]; out = []
    for it in items:
        chk = it.get("check") or {}; srcs = {s["id"]: s for s in (chk.get("sources") or [])}; res = {s["id"]: s for s in it["research"]["sources"]}
        good = [f for f in (chk.get("findings") or []) if f["status"] in ("verified", "corrected")]
        if not good: continue
        lis = []
        for f in good:
            links = []
            for sid in f.get("source_ids", []):
                c, r = srcs.get(sid), res.get(sid); s = c or r
                if not s or not str(s.get("url", "")).startswith("http") or (c is not None and not c.get("loads", True)): continue
                who = (s.get("authors") or (r or {}).get("authors") or s.get("title") or "source"); yr = s.get("year") or (r or {}).get("year") or ""
                links.append(f'<a href="{esc(s["url"])}" rel="noopener">{esc(str(who)[:48])}{" " + esc(str(yr)) if yr else ""}</a>')
            lis.append(f'<li>{esc(f["claim"])}{" <b>" + esc(f["numbers"]) + "</b>" if f.get("numbers") else ""} <span class="src">{" · ".join(dict.fromkeys(links))}</span></li>')
        extra = [f"<li>{linkify(m)}</li>" for m in (chk.get("missing") or [])]
        head, rest = lis[:show], lis[show:] + extra
        out.append("<ul>" + "".join(head) + "</ul>" + (f'<details><summary>MORE FROM THE RECORD ({len(rest)})</summary><ul>{"".join(rest)}</ul></details>' if rest else ""))
    return "".join(out) or "<p class='src'>No finding survived the fact-check for this structure.</p>"
def linkify(t):
    import re
    return re.sub(r"(https?://[^\s)\]]+)", lambda m: f'<a href="{esc(m.group(1).rstrip(".,;"))}" rel="noopener">source</a>', esc(t))
def structure_section(k, extra_html=""):
    sj = S[k]; t = TEXT["structures"][k]
    return (f'<h2>{esc(NAMES[k])}</h2><section><p class="lead">{t["verdict"]}</p>{extra_html}{variant_table(sj)}'
            f'<div class="two"><div><h3>What the public record says</h3>{lit_block(t["lit"])}</div><div><h3>How our tools would feed it</h3>{t["tools"]}<h3>What could be wrong</h3>{t["wrong"]}</div></div>'
            f'<details><summary>THE EXACT RULE TESTED</summary><ul>{"".join("<li>" + esc(r) + "</li>" for r in sj["rule_plain"])}</ul><ul>{"".join("<li>" + esc(r) + "</li>" for r in sj.get("caveats", []))}</ul></details></section>')

TEXT["read_after"] = TEXT["read_after"].replace("{S7_TABLE}", X.s7_table(S0))
TEXT["specs"] = TEXT["specs"].replace("{CORRECTIONS}", X.corrections())
page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PF1 · how to stop sitting in cash — six portfolio structures tested on our own bars, with alternatives · 6 Oct 2026</title>
<style>{V.CSS}</style>
</head>
<body>
<main>
<span data-scnav-slot></span><h1>PF1 · how to stop sitting in cash — six structures tested on our own bars, with alternatives</h1>
<p class="lead">{TEXT["lead"]}</p>
<p class="sub">{TEXT["sub"]}</p>
{X.kpis(TEXT)}
<section>{hero_bars()}</section>
<section>{last2_lines()}</section>
<section>{exposure_lines()}</section>
<section>{full_lines()}</section>
<h2>The comparison table</h2>
<section>{cmp_table()}<p class="cap">{TEXT["cap_table"]}</p></section>
<h2>My read, and the two that fit best</h2>
<section>{TEXT["read"]}<div class="two">{"".join(f'<div class="pick"><h3>{esc(p["title"])}</h3>{p["html"]}</div>' for p in TEXT["picks"])}</div>{TEXT["read_after"]}</section>
<h2>The last two years, episode by episode</h2>
<section><h3>The three pullbacks</h3>{pullback_table()}<p class="cap">{TEXT["cap_pullbacks"]}</p><h3>The ten breakouts</h3>{breakout_table()}<p class="cap">{TEXT["cap_breakouts"]}</p></section>
{structure_section("s1_core_satellite", X.s1(S))}
{structure_section("s2_trend_core", X.s2(S, S0))}
{structure_section("s3_dual_momentum", X.s3(S))}
{structure_section("s4_vol_sizing", X.s4(S))}
{structure_section("s5_level_scaling", X.s5(S))}
{structure_section("s6_paid_to_wait", X.s6(S, S0))}
<h2>Alternatives you did not name</h2>
<section>{TEXT["alternatives_intro"]}{lit_block("outside-the-box")}{TEXT["alternatives_after"]}</section>
<h2>How each of the two would plug into the allocation tool</h2>
<section>{TEXT["plug_in"]}</section>
<h2>Decisions for Alan</h2>
<section>{TEXT["decisions"]}</section>
<details class="sc-pagespecs"><summary>PAGE SPECS</summary>{TEXT["specs"]}{X.checks(S0, S, LIT)}</details>
</main>
<script>{V.HOVER_JS}</script>
</body>
</html>
"""
open(OUT, "w", encoding="utf8").write(page); print("wrote", OUT, len(page), "bytes")

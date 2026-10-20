#!/usr/bin/env python3
"""Builds the one self-contained page from PRE-PROFIT-STUDY.json. No network, no script beyond a ready flag;
nothing to click except the PAGE SPECS fold and the per-card raw-quarter tables (always open)."""
import datetime as dt, html, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
D = json.load(open(os.path.join(HERE, "..", "PRE-PROFIT-STUDY.json")))
OUT = os.path.join(HERE, "..", "PRE-PROFIT-STUDY.html")
E = html.escape
A = D["class_a"]; SUM = D["summary_a"]; B = D["class_b"]; META = D["meta"]
MON = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()

def day(s):
    if not s: return "—"
    s = str(s)[:10]
    try:
        y, m, d = s.split("-"); return "%d %s %s" % (int(d), MON[int(m) - 1], y)
    except Exception: return s

def money(v, dash="—"):
    if v is None: return dash
    a = abs(v); neg = "−" if v < 0 else ""
    if a >= 1000: return "%s$%.1fB" % (neg, a / 1000)
    if a >= 10: return "%s$%.0fM" % (neg, a)
    if a >= 0.05: return "%s$%.1fM" % (neg, a)
    return "$0"

def pct(v, sign=True, dash="—", cap=999):
    if v is None: return dash
    if abs(v) > cap: return ("over +%d%%" % cap) if v > 0 else ("under −%d%%" % cap)
    if abs(v) < 0.5: return "0%"
    s = ("%+.0f%%" if sign else "%.0f%%") % v
    return s.replace("-", "−")

def num(v, d=1, dash="—"):
    return dash if v is None else ("%%.%df" % d % v).replace("-", "−")

def qtrs(b):
    if b.get("not_burning"): return "not burning"
    q = b.get("runway_quarters")
    if q is None: return "—"
    return "40+" if q > 40 else "%.1f" % q

def qtrs_s(s):
    if s.get("not_burning"): return "not burning"
    q = s.get("runway_quarters")
    if q is None: return "—"
    return "40+" if q > 40 else "%.1f" % q

def read_badge(r):
    cls = {"funded": "ok", "tight": "warn", "on the clock": "crit"}.get(r, "unk")
    icon = {"funded": "●", "tight": "◆", "on the clock": "▲"}.get(r, "○")
    return '<span class="rd rd-%s"><i>%s</i>%s</span>' % (cls, icon, E(r))

def badges(l):
    out = []
    if l.get("radar"): out.append('<i class="bd bd-r">RADAR%s</i>' % ((" #%d" % l["radar_position"]) if l.get("radar_position") else ""))
    if l.get("favorites"): out.append('<i class="bd bd-f">FAV</i>')
    if l.get("liked"): out.append('<i class="bd bd-l">LIKED</i>')
    return "".join(out) or '<i class="bd">—</i>'

def bar(q, nb):
    if nb: w = 100; cls = "ok"
    elif q is None: return '<div class="bar"><div class="bar-f unk" style="width:0"></div></div>'
    else:
        w = min(100, q / 24 * 100); cls = "ok" if q >= 12 else ("warn" if q >= 6 else "crit")
    return '<div class="bar"><div class="bar-f %s" style="width:%.0f%%"></div><span class="bar-t t12"></span></div>' % (cls, w)

def link(u, text):
    return ('<a href="%s" target="_blank" rel="noopener">%s</a>' % (E(u), text)) if u else text

built = META["built_utc"]
win = META.get("fmp_fetch_window_utc") or ["", ""]
def z(s): 
    try: return dt.datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").strftime("%H:%M")
    except Exception: return s
fetch_words = "FMP fetched %s, %s to %s UTC (%s calls through the project's proxy)" % (day(win[0]), z(win[0]), z(win[1]), META.get("fmp_calls_total"))

# ---------- summary blocks ----------
growers = sorted([s for s in SUM if s["read"] == "funded" and (s.get("ntm_growth_pct") is not None) and (A[s["ticker"]]["pre_profit_test"]["ttm_revenue_m"] or 0) >= 50],
                 key=lambda s: -s["ntm_growth_pct"])[:5]
clock = sorted([s for s in SUM if s["read"] == "on the clock" and s.get("runway_quarters") is not None], key=lambda s: s["runway_quarters"])[:5]

def two_lines(s):
    o = A[s["ticker"]]; v = o["verdict"]["sentences"]
    return "<b>%s</b> · %s<br><span class=\"i2\">%s</span>" % (E(s["ticker"]), E(v[0]), E(v[2]))

H = []
H.append("""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pre-profit study</title><meta name="description" content="Revenue growth, market size, funding, debt, cash, burn, runway and lock-ups for every pre-profit name on the Hub's lists, with a verdict per name.">
<style>
:root{--ground:#0A0A0F;--panel:#0D0D14;--panel2:#0F0F1A;--ink:#F2F2F8;--ink2:#C6C8DE;--ink3:#9A9AB6;--mute:#6E6E88;--line:#1A1A26;--line2:#262636;--neon:#00D4FF;
--ok:#0ca30c;--warn:#fab219;--crit:#d03b3b;--unk:#6E6E88;--s1:#3987e5;--mono:"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace;--sans:ui-sans-serif,-apple-system,"Helvetica Neue",sans-serif}
*{box-sizing:border-box}html,body{margin:0;background:var(--ground);color:var(--ink);font:13px/1.45 var(--mono)}
body{padding:0 16px 80px}main{max-width:1640px;margin:0 auto}
h1{font:600 24px/1.2 var(--sans);margin:28px 0 6px;letter-spacing:-.01em}h2{font:600 17px/1.3 var(--sans);margin:40px 0 10px;color:var(--ink);border-bottom:1px solid var(--line2);padding-bottom:6px}
h3{font:600 14px/1.3 var(--sans);margin:18px 0 6px;color:var(--ink2)}
p{margin:6px 0;color:var(--ink2)}.i2{color:var(--ink3)}.i3{color:var(--mute)}.sm{font-size:11px}.k{color:var(--ink3)}
a{color:var(--ink2);text-decoration:underline dotted var(--mute)}a:hover{color:var(--neon)}
.lede{color:var(--ink2);max-width:1100px;font-family:var(--sans);font-size:14px}
.meta{color:var(--ink3);font-size:11.5px;margin:4px 0 18px}
table{border-collapse:collapse;width:100%}th,td{padding:5px 8px;border-bottom:1px solid var(--line);vertical-align:top;text-align:left;font-variant-numeric:tabular-nums}
th{color:var(--ink3);font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap}.wrap th{position:sticky;top:0;background:var(--ground)}
td.n,th.n{text-align:right}tr:hover td{background:var(--panel2)}
.wrap{overflow-x:auto;border:1px solid var(--line);border-radius:4px;background:var(--panel)}
.rank td{white-space:nowrap}.rank .nm{color:var(--ink3);font-size:11px;white-space:normal;max-width:180px}
.rd{display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:1px 7px;border-radius:3px;border:1px solid var(--line2);color:var(--ink);white-space:nowrap}
.rd i{font-style:normal;font-size:10px}.rd-ok i{color:var(--ok)}.rd-warn i{color:var(--warn)}.rd-crit i{color:var(--crit)}.rd-unk i{color:var(--unk)}
.bd{display:inline-block;font-style:normal;font-size:10px;padding:0 5px;border:1px solid var(--line2);border-radius:3px;color:var(--ink3);margin-right:3px;white-space:nowrap}
.bd-r{color:#A0A8B8}.bd-f{color:#B8B0A0}.bd-l{color:#B4A4AC}
.bar{position:relative;width:120px;height:8px;background:var(--line);border-radius:4px;display:inline-block;vertical-align:middle;margin-right:6px}
.bar-f{height:8px;border-radius:4px}.bar-f.ok{background:var(--ok)}.bar-f.warn{background:var(--warn)}.bar-f.crit{background:var(--crit)}.bar-f.unk{background:var(--unk)}
.bar-t{position:absolute;top:-2px;width:1px;height:12px;background:var(--ink3)}.t12{left:50%}
.two{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:12px 0}.two>div{background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:12px 14px}
.two p{margin:8px 0;font-size:12px;line-height:1.5}
.card{background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:14px 16px;margin:14px 0}
.card h3.t{font:600 18px/1.2 var(--sans);margin:0 0 4px;display:flex;flex-wrap:wrap;gap:10px;align-items:center}.card h3.t small{font:400 12px var(--mono);color:var(--ink3)}
.card .hd{display:flex;flex-wrap:wrap;gap:12px 24px;color:var(--ink2);font-size:12px;margin:4px 0 10px}.card .hd b{color:var(--ink);font-weight:500}
.blk{border-top:1px solid var(--line);padding:8px 0 4px;overflow-x:auto}.blk h4{margin:0 0 4px;font:600 12px/1.3 var(--sans);color:var(--ink3);text-transform:uppercase;letter-spacing:.05em}
.blk h4 span{color:var(--mute);font-weight:400;margin-right:6px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:4px 20px}.grid div{display:flex;justify-content:space-between;gap:10px;border-bottom:1px dotted var(--line);padding:2px 0;font-size:12px}
.grid div span:first-child{color:var(--ink3)}.grid div span:last-child{text-align:right;color:var(--ink);font-variant-numeric:tabular-nums}
.q{width:auto;min-width:520px;margin:4px 0}.q td,.q th{padding:2px 8px;font-size:11.5px}
.verd{background:var(--panel2);border-left:3px solid var(--line2);padding:8px 12px;margin-top:6px}.verd p{margin:4px 0;color:var(--ink);font-family:var(--sans);font-size:13.5px;line-height:1.5}
.verd.ok{border-left-color:var(--ok)}.verd.warn{border-left-color:var(--warn)}.verd.crit{border-left-color:var(--crit)}
.pos{color:var(--ink)}.neg{color:var(--ink2)}
details.specs{margin-top:40px;border:1px solid var(--line);border-radius:4px;background:var(--panel)}details.specs summary{cursor:pointer;padding:10px 14px;color:var(--ink3);font:600 12px var(--sans);letter-spacing:.06em}
details.specs .in{padding:0 16px 16px;color:var(--ink2);font-size:12px}details.specs li{margin:3px 0}
.note{border-left:2px solid var(--line2);padding:4px 10px;color:var(--ink3);font-size:11.5px;margin:6px 0}
ul.lines{padding-left:18px}ul.lines li{margin:4px 0;color:var(--ink2);font-size:12.5px}
.legend{color:var(--ink3);font-size:11px;margin:6px 0}
@media (max-width:700px){.two{grid-template-columns:1fr}.bar{width:60px}h1{font-size:20px}}
</style></head><body><main>
""")
H.append("<h1>The pre-profit names: growth, market size, funding, debt, cash, burn, runway, lock-ups</h1>")
H.append('<p class="lede">Every pre-profit name on the Hub\'s RADAR, FAVORITES and LIKED lists (Class A, %d names) with the eight measures Alan asked for and a verdict each; the rest of the 13 Oct set (Class B, %d names) as table rows. Pre-profit = trailing-twelve-month GAAP net income at or under zero on FMP\'s quarterly statements tonight, or the 13 Oct study\'s class.</p>' % (len(A), len(B)))
H.append('<p class="meta">Built %s UTC · %s · lists read from the Hub\'s database %s UTC · 13 Oct study carried for lock-ups, shelves, filing-tagged converts and coverage quality · nothing deployed, no table written.</p>' % (E(built), E(fetch_words), E(META.get("lists_read_utc") or "")))

# ---------- ranked table ----------
H.append('<h2 id="rank">1 · The ranking: every Class A name by runway</h2>')
H.append('<p class="legend">Runway = cash and short-term investments at the latest balance sheet ÷ quarterly burn (mean of the two most recent negative free-cash-flow quarters). Bar scale 0 to 24 quarters, tick at 12. <span class="rd rd-ok"><i>●</i>funded</span> not burning or ≥12 quarters · <span class="rd rd-warn"><i>◆</i>tight</span> 6 to 12 · <span class="rd rd-crit"><i>▲</i>on the clock</span> under 6. "Builder" = operating cash flow positive, the deficit is capex; its operating-cash basis is shown underneath.</p>')
H.append('<div class="wrap"><table class="rank"><thead><tr><th>#</th><th>Name</th><th>Lists</th><th>Read</th><th>Runway (qtrs)</th><th class="n">Burn / qtr</th><th class="n">Cash + STI</th><th class="n">Net cash</th><th class="n">NTM growth</th><th class="n">Last q y/y</th><th class="n">Dilution 12m</th><th>Next lock-up</th><th class="n">Analysts</th><th class="n">TAM share</th><th class="n">Mkt cap</th></tr></thead><tbody>')
for i, s in enumerate(SUM, 1):
    o = A[s["ticker"]]
    rq = qtrs_s(s)
    extra = ""
    if s.get("builder") and not s.get("not_burning"):
        oc = s.get("runway_ocf")
        extra = '<br><span class="i3 sm">builder · on OCF alone: %s</span>' % ("40+" if (oc is not None and oc > 40) else (num(oc) if oc is not None else "OCF positive" if s.get("ocf_positive_4q") else "—"))
    lk = s.get("next_lockup")
    lkw = day(lk) if lk else ('<span class="i3">none on file</span>' if o["lockup"].get("days_since_listing", 99999) >= 180 else '<span class="i3">inside window, none on file</span>')
    H.append('<tr><td>%d</td><td><a href="#n-%s"><b>%s</b></a><div class="nm">%s</div></td><td>%s</td><td>%s</td><td>%s<b>%s</b>%s</td><td class="n">%s</td><td class="n">%s</td><td class="n">%s</td><td class="n">%s</td><td class="n">%s</td><td class="n">%s</td><td>%s</td><td class="n">%s</td><td class="n">%s</td><td class="n">%s</td></tr>' % (
        i, E(s["ticker"]), E(s["ticker"]), E(s["name"] or ""), badges(s["lists"]), read_badge(s["read"]), bar(s["runway_quarters"], s["not_burning"]), rq, extra,
        money(s["quarterly_burn_m"]) if not s["not_burning"] else "—", money(s["cash_and_sti_m"]), money(s["net_cash_m"]), pct(s["ntm_growth_pct"], cap=999), pct(s["latest_yoy_pct"], cap=999),
        pct(s["dilution_12m_pct"]) if s["dilution_12m_pct"] is not None else '<span class="i3">n/a</span>', lkw, s["analysts"] if s["analysts"] is not None else "—",
        ("%.2f%%" % s["tam_share_pct"]) if s.get("tam_share_pct") is not None else '<span class="i3">—</span>', money(s["market_cap_m"])))
H.append("</tbody></table></div>")
H.append('<p class="note">Cash + STI is unrestricted: where FMP books restricted cash as cash (Hut 8, Cipher and others) the 13 Oct filing read of the same balance sheet takes it out, and the card says so. Dilution is the diluted weighted-average share count, latest quarter against a year earlier; "n/a" where the company listed inside the last 18 months. NTM growth is the time-weighted consensus for the next twelve months against trailing revenue; blank where trailing revenue is under $10M. TAM share = trailing revenue ÷ the company\'s own stated market, where one exists.</p>')

H.append('<div class="two"><div><h3>The five best-funded growers <span class="i3 sm">(funded, trailing revenue ≥ $50M, by NTM consensus growth)</span></h3>%s</div><div><h3>The five on the clock <span class="i3 sm">(shortest free-cash runway)</span></h3>%s</div></div>' % (
    "".join("<p>%s</p>" % two_lines(s) for s in growers), "".join("<p>%s</p>" % two_lines(s) for s in clock)))

# ---------- cards ----------
H.append('<h2 id="cards">2 · The cards, in the ranking\'s order</h2>')
for s in SUM:
    t = s["ticker"]; o = A[t]; g = o["growth"]; f = o["funding"]; b = o["burn"]; c = o["coverage"]; tam = o["tam"]; lk = o["lockup"]; pp = o["pre_profit_test"]; v = o["verdict"]
    cls = {"funded": "ok", "tight": "warn", "on the clock": "crit"}.get(v["read"], "unk")
    H.append('<section class="card" id="n-%s"><h3 class="t">%s <small>%s</small> %s %s</h3>' % (E(t), E(t), E(o["name"] or ""), read_badge(v["read"]), badges(o["lists"])))
    H.append('<div class="hd"><span>price <b>$%s</b></span><span>market cap <b>%s</b></span><span>EV <b>%s</b></span><span>EV/sales (TTM) <b>%s</b></span><span>TTM revenue <b>%s</b></span><span>TTM net income <b>%s</b></span><span>13 Oct class <b>%s</b>%s</span></div>' % (
        num(o["market"]["price"], 2), money(o["market"]["market_cap_m"]), money(o["market"]["ev_m"]), num(o["market"]["ev_to_sales_ttm"], 1) + "×" if o["market"]["ev_to_sales_ttm"] is not None else "—",
        money(pp["ttm_revenue_m"]), money(pp["ttm_net_income_m"]), E(pp.get("class_13oct") or "not in the 13 Oct set"), (" · passes tonight's test" if pp["passes_tonight"] else ' · <span class="k">TTM net income now positive; kept on the 13 Oct class</span>')))
    # 1
    H.append('<div class="blk"><h4><span>1</span>The business</h4><p>%s <span class="i3">· %s · %s · listed %s%s</span></p></div>' % (E(o["business"]["one_line"] or "no FMP description"), E(o["business"]["sector"] or "—"), E(o["business"]["industry"] or "—"), day(o["business"]["ipo_date"]), (" · %s" % E(o["business"]["country"])) if o["business"].get("country") else ""))
    # 2
    rows = "".join('<tr><td>%s <span class="i3">%s</span></td><td class="n">%s</td><td class="n">%s</td><td class="n">%s</td><td class="n">%s</td></tr>' % (day(q["quarter"]), E(q["period"]), money(q["revenue_m"]), pct(q["yoy_pct"], cap=9999), money(q["operating_income_m"]), money(q["net_income_m"])) for q in g["quarters"])
    n = g["ntm"]
    ntm_words = ("<b>%s</b> for the next twelve months (%s), %s analysts on revenue · %s" % (pct(n.get("growth_pct"), cap=9999) if n.get("growth_pct") is not None else money(n.get("ntm_revenue_m")) + " of revenue",
                 money(n.get("ntm_revenue_m")), n.get("analysts") if n.get("analysts") is not None else "?", E(n.get("how") or ""))) if n.get("ntm_revenue_m") else "no consensus revenue estimate on file"
    seg = g.get("segments")
    segw = ("revenue by segment, FY%s: " % seg["fiscal_year"] + ", ".join("%s %s" % (E(k), money(v_)) for k, v_ in sorted(seg["data_m"].items(), key=lambda kv: -(kv[1] or 0)))) if seg and seg.get("data_m") else "no segment split in FMP"
    H.append('<div class="blk"><h4><span>2</span>Revenue growth</h4><table class="q"><thead><tr><th>Quarter</th><th class="n">Revenue</th><th class="n">y/y</th><th class="n">Op. income</th><th class="n">Net income</th></tr></thead><tbody>%s</tbody></table><p>NTM consensus: %s</p><p>Company guidance: %s%s</p><p class="i2">%s</p></div>' % (
        rows, ntm_words, E(g.get("guidance") or "none found"), (" · " + link(g.get("guidance_src"), "source")) if g.get("guidance_src") else "", segw))
    # 3
    if tam.get("stated_m"):
        tw = "<b>%s</b> — %s%s%s." % (money(tam["stated_m"]), E(tam.get("stated_words") or ""), (" · " + link(tam.get("stated_src"), "source")) if tam.get("stated_src") else "", (" · dated %s" % E(tam.get("stated_date"))) if tam.get("stated_date") else "")
        share = (" Trailing revenue is <b>%.2f%%</b> of it." % tam["revenue_share_pct"]) if tam.get("revenue_share_pct") is not None else ""
        cav = ('<p class="i3">Caveat: %s.</p>' % E(tam["stated_caveat"])) if tam.get("stated_caveat") else ""
    else:
        tw = "<b>no stated TAM</b> — %s." % E(tam.get("stated_note") or "nothing credible found")
        share = ""; cav = ""
    ind = ('<p class="i2">Independent figure: %s%s.</p>' % (E(tam["independent"]), (" · " + link(tam.get("independent_src"), "source")) if tam.get("independent_src") else "")) if tam.get("independent") else '<p class="i3">No independent figure cited.</p>'
    H.append('<div class="blk"><h4><span>3</span>Market size (TAM)</h4><p>%s%s</p>%s%s</div>' % (tw, share, cav, ind))
    # 4
    conv = f.get("convertible_notes_m_13oct")
    shelf = f.get("shelf_13oct") or {}; atm = f.get("atm_13oct") or {}
    paper = []
    if atm: paper.append("ATM %s%s" % (E(atm.get("status") or "on file"), (" (%s)" % E(atm.get("size_text"))) if atm.get("size_text") else ""))
    elif f.get("atm_live_13oct"): paper.append("ATM live at the 13 Oct read")
    if shelf: paper.append("shelf %s (%s, %s)" % ("open" if shelf.get("open") else "filed", E(shelf.get("form") or ""), day(shelf.get("filed"))))
    gitems = [("Balance sheet", "%s (filed %s)" % (day(f["balance_date"]), day(f["filing_date"]))), ("Cash", money(f["cash_m"])), ("Short-term investments", money(f["short_term_investments_m"])),
              ("Cash + ST investments" + (" (unrestricted)" if f.get("restricted_note") else ""), "<b>%s</b>" % money(f["cash_and_sti_m"])), ("Longer-dated investments", money(f["long_term_investments_m"])), ("Total debt (FMP, incl. leases)", money(f["total_debt_m"])),
              ("of which leases", money(f["leases_m"])), ("Net cash / (net debt)", "<b>%s</b>" % money(f["net_cash_m"])),
              ("Convertible notes (13 Oct, filing tags)", money(conv) if conv is not None else '<span class="i3">not separated in FMP</span>'),
              ("Equity issued, last 4 qtrs (gross)", money(f["equity_issued_4q_m"])), ("Net debt issued, last 4 qtrs", money(f["net_debt_issued_4q_m"])),
              ("Diluted WA shares now / year ago", "%s / %s" % (num(f["shares_dil_wa_now_m"], 1) + "M" if f["shares_dil_wa_now_m"] is not None else "—", num(f["shares_dil_wa_year_ago_m"], 1) + "M" if f["shares_dil_wa_year_ago_m"] is not None else "—")),
              ("Dilution, 12 months", ("<b>%s</b>" % pct(f["dilution_12m_pct"])) if f.get("dilution_12m_pct") is not None else '<span class="i3">n/a</span>'),
              ("Shares outstanding / float", "%sM / %sM (%s%% free float)" % (num(f["shares_out_now_m"], 1), num(f["float_m"], 1), num(f["free_float_pct"], 0))),
              ("Paper on file (13 Oct read)", "; ".join(paper) if paper else "no shelf, no ATM found")]
    H.append('<div class="blk"><h4><span>4</span>Funding</h4><div class="grid">%s</div>%s</div>' % ("".join("<div><span>%s</span><span>%s</span></div>" % (k, v_) for k, v_ in gitems), (('<p class="i2">%s.</p>' % E(f["restricted_note"])) if f.get("restricted_note") else "") + (('<p class="i3">%s</p>' % E(f["dilution_note"])) if f.get("dilution_note") else "")))
    # 5
    cfr = "".join('<tr><td>%s</td><td class="n">%s</td><td class="n">%s</td><td class="n"><b>%s</b></td><td class="n">%s</td><td class="n">%s</td></tr>' % (day(r["quarter"]), money(r["ocf_m"]), money(r["capex_m"]), money(r["fcf_m"]), money(r["stock_issued_m"]), money(r["net_debt_issued_m"])) for r in b["cash_flow_quarters"][:4])
    if b["not_burning"]:
        rw = "<b>Not burning</b>: free cash flow positive in each of the last four quarters."
    elif b["runway_quarters"] is None:
        rw = "Runway: <b>unknown</b> (no negative free-cash-flow quarter on file to set a burn)."
    else:
        rq_ = b["runway_quarters"]
        rw = "Quarterly burn <b>%s</b> (%s). Runway <b>%s quarters</b> from the %s balance sheet%s; at 1.5× burn <b>%s quarters</b>%s. %s quarters of that have already passed tonight.%s" % (
            money(b["quarterly_burn_m"]), E(b["burn_basis"]), "40+" if rq_ > 40 else num(rq_), day(f["balance_date"]), (" → lands around <b>%s</b>" % day(b["runway_lands"])) if rq_ <= 40 else "",
            "40+" if (b["runway_quarters_at_1_5x"] or 0) > 40 else num(b["runway_quarters_at_1_5x"]), (" (%s)" % day(b["runway_lands_at_1_5x"])) if (b["runway_quarters_at_1_5x"] or 99) <= 40 else "", num(b["quarters_elapsed_since_balance"]),
            (" Latest quarter's outflow is %.1f× the burn figure." % b["latest_over_mean"]) if b.get("latest_over_mean") and b["latest_over_mean"] >= 1.3 else "")
    ocf_w = ""
    if b.get("builder") and not b["not_burning"]:
        oc = b.get("runway_quarters_ocf_basis")
        ocf_w = '<p class="i2">%s. On operating cash flow alone: %s.</p>' % (E(b["builder_note"]), ("OCF positive, no burn" if b.get("ocf_positive_4q") else ("%s quarters" % ("40+" if oc > 40 else num(oc))) if oc is not None else "—"))
    elif b.get("ocf_burn_m") and not b["not_burning"]:
        oc = b.get("runway_quarters_ocf_basis")
        ocf_w = '<p class="i3">On operating cash flow alone (capex set aside): burn %s a quarter, %s quarters.</p>' % (money(b["ocf_burn_m"]), ("40+" if oc > 40 else num(oc)) if oc is not None else "—")
    note = ('<p class="i3">%s.</p>' % E(b["burn_note"])) if b.get("burn_note") and not b["not_burning"] else ""
    r13 = b.get("runway_13oct_quarters")
    H.append('<div class="blk"><h4><span>5</span>Burn and runway</h4><table class="q"><thead><tr><th>Quarter</th><th class="n">Operating CF</th><th class="n">Capex</th><th class="n">Free CF</th><th class="n">Stock issued</th><th class="n">Net debt issued</th></tr></thead><tbody>%s</tbody></table><p>%s</p>%s%s<p class="i3">13 Oct study, four-quarter average basis: %s quarters (cash %s at %s).</p></div>' % (
        cfr, rw, note, ocf_w, ("%.1f" % r13) if r13 is not None else "—", money(f.get("cash_13oct_m")), day(f.get("cash_13oct_end"))))
    # 6
    if lk.get("on_file"):
        steps = lk.get("schedule") or []
        stepw = ("; schedule: " + "; ".join("%s%s" % (day(x.get("date")), (" %s%%" % x["pct"]) if x.get("pct") else "") for x in steps[:8] if x.get("date"))) if steps else ""
        lkw = "<b>%s lock-up, %s days, unlock %s</b>%s%s. %s%s" % (E(lk.get("listing_kind") or ""), lk.get("lockup_days"), day(lk.get("unlock_date")), (" · early release: %s" % E(lk["early_rule"])) if lk.get("early_rule") else "", stepw,
                                                                    link(lk.get("source_url"), "prospectus"), (" · checked %s" % day(lk.get("checked_utc"))) if lk.get("checked_utc") else "")
    else:
        lkw = E(lk.get("words") or "")
    own = o["ownership"]
    H.append('<div class="blk"><h4><span>6</span>Lock-ups and overhang</h4><p>%s</p><p class="i2">Stock outside the float (insiders and restricted holders, FMP shares-float %s): <b>%s</b>. %s</p></div>' % (
        lkw, day(f.get("float_date")), ("%s%%" % num(own["non_float_pct"], 1)) if own.get("non_float_pct") is not None else "—", E(own["note"])))
    # 7
    tg = c.get("targets"); sm = c.get("summary") or {}; gr = c.get("grades") or {}
    tgw = ("targets low <b>$%s</b> · median <b>$%s</b> · high <b>$%s</b> (consensus $%s; spread %s%% of the median; price $%s)" % (num(tg["low"], 0), num(tg["median"], 0), num(tg["high"], 0), num(tg["consensus"], 0), num(tg.get("spread_pct_of_median"), 0), num(o["market"]["price"], 2))) if tg and tg.get("median") else "no price-target consensus in FMP"
    grw = ("ratings: %s buy · %s hold · %s sell (%s)" % (gr.get("buy", 0) + gr.get("strongBuy", 0), gr.get("hold", 0), gr.get("sell", 0) + gr.get("strongSell", 0), E(gr.get("consensus") or ""))) if gr else ""
    smw = ("%s targets in the last quarter (avg $%s), %s in the last year (avg $%s)" % (sm.get("lastQuarterCount"), num(sm.get("lastQuarterAvgPriceTarget"), 0), sm.get("lastYearCount"), num(sm.get("lastYearAvgPriceTarget"), 0))) if sm else ""
    q13 = ("13 Oct coverage read: <b>%s</b> — %s" % (E(c["quality_13oct"]), E(c.get("quality_why_13oct") or ""))) if c.get("quality_13oct") else "13 Oct coverage read: not in that set"
    miss = c.get("projection_miss_13oct")
    H.append('<div class="blk"><h4><span>7</span>Coverage</h4><p><b>%s</b> analysts on next-twelve-month revenue; %s.</p><p class="i2">%s%s</p><p class="i2">%s%s</p></div>' % (
        c.get("analysts_revenue_ntm") if c.get("analysts_revenue_ntm") is not None else "—", tgw, grw, (" · " + smw) if smw else "", q13, (" · median quarterly revenue miss %.1f%%" % miss) if miss is not None else ""))
    # 8
    H.append('<div class="blk"><h4><span>8</span>The verdict</h4><div class="verd %s">%s<p><b>Read: %s.</b></p></div></div>' % (cls, "".join("<p>%s</p>" % E(x) for x in v["sentences"]), E(v["read"])))
    H.append("</section>")

# ---------- class B ----------
H.append('<h2 id="classb">3 · Class B: the rest of the 13 Oct set</h2>')
H.append('<p class="legend">From what the Hub stores (13 Oct study: four-quarter-average burn, filing-tagged cash) plus tonight\'s FMP batch quote and key metrics. Runway and read are the 13 Oct figures; LCID, MARA and EOSE (the cash-filter failers not in Class A) were re-read live tonight, see section 4.</p>')
H.append('<div class="wrap"><table class="rank"><thead><tr><th>Name</th><th>Class</th><th>Read (13 Oct)</th><th class="n">Runway 13 Oct</th><th class="n">Cash 13 Oct</th><th class="n">Debt 13 Oct</th><th class="n">Net cash</th><th class="n">Growth 13 Oct</th><th class="n">Dilution 13 Oct</th><th>Next lock-up</th><th class="n">Analysts</th><th class="n">Price</th><th class="n">Mkt cap</th><th class="n">EV</th><th class="n">EV/sales</th></tr></thead><tbody>')
for t, r in sorted(B.items(), key=lambda kv: (0 if kv[1]["not_burning_13oct"] else 1, -(kv[1]["runway_13oct_quarters"] or -1))):
    rq = "not burning" if r["not_burning_13oct"] else (("40+" if r["runway_13oct_quarters"] > 40 else num(r["runway_13oct_quarters"])) if r["runway_13oct_quarters"] is not None else "—")
    lk = r["lockup"]; lkw = day(lk["unlock_date"]) if lk.get("on_file") else '<span class="i3">none on file</span>'
    H.append('<tr><td><b>%s</b><div class="nm">%s</div></td><td>%s</td><td>%s</td><td class="n">%s</td><td class="n">%s</td><td class="n">%s</td><td class="n">%s</td><td class="n">%s</td><td class="n">%s</td><td>%s</td><td class="n">%s</td><td class="n">%s</td><td class="n">%s</td><td class="n">%s</td><td class="n">%s</td></tr>' % (
        E(t), E(r["name"] or ""), E(r["class"] or ""), read_badge(r["read"]), rq, money(r["cash_13oct_m"]), money(r["debt_13oct_m"]), money(r["net_cash_13oct_m"]), pct(r["growth_13oct_pct"], cap=999), pct(r["dilution_13oct_pct"]), lkw,
        r["analysts_13oct"] if r["analysts_13oct"] is not None else "—", ("$%s" % num(r["price"], 2)) if r["price"] is not None else "—", money(r["market_cap_m"]), money(r["ev_m"]), (num(r["ev_to_sales_ttm"], 1) + "×") if r["ev_to_sales_ttm"] is not None else "—"))
H.append("</tbody></table></div>")

# ---------- failers ----------
H.append('<h2 id="failers">4 · The eleven that failed the 13 Oct cash filter: where they stand tonight</h2><ul class="lines">')
for fl in D["cash_filter_failers_13oct"]:
    rt = "not burning" if fl.get("not_burning") else (("40+" if (fl["runway_tonight"] or 0) > 40 else num(fl["runway_tonight"])) if fl["runway_tonight"] is not None else "—")
    oc = fl.get("runway_ocf_basis")
    H.append("<li><b>%s</b> %s — 13 Oct: %s quarters on %s of cash; tonight: <b>%s quarters</b> on %s of cash and short-term investments at %s (free-cash basis, burn %s a quarter; on operating cash flow alone %s)%s; sold %s of stock in the last four quarters. Read: %s.</li>" % (
        E(fl["ticker"]), E(fl["name"] or ""), num(fl["runway_13oct"]), money(fl["cash_13oct_m"]), rt, money(fl["cash_and_sti_m"]), day(fl["balance_date"]), money(fl["burn_m"]),
        ("40+" if oc > 40 else num(oc)) if oc is not None else ("OCF positive" if fl.get("ocf_burn_m") is None else "—"), " · Class A card above" if fl["where"] == "class A" else " · Class B, re-read live", money(fl["equity_issued_4q_m"]), read_badge(fl["read"] or "unknown")))
H.append("</ul>")

# ---------- excluded ----------
H.append('<h2 id="excluded">5 · Not pre-profit: the established names the loss screen caught</h2><ul class="lines">')
for x in D["excluded"]:
    extra = (" Live tonight: TTM net income %s, TTM operating income %s." % (money(x.get("ttm_net_income_m_live")), money(x.get("ttm_operating_income_m_live")))) if x.get("ttm_net_income_m_live") is not None else ""
    H.append("<li><b>%s</b> %s — %s.%s</li>" % (E(x["ticker"]), E(x.get("name") or ""), E(x["why"].rstrip(".")), E(extra)))
H.append("</ul>")

# ---------- measured / not ----------
H.append('<h2 id="meas">6 · Measured tonight, carried from 13 Oct, not measured</h2>')
H.append('<div class="two"><div><h3>Measured tonight (FMP through the proxy)</h3><ul class="lines"><li>Price, market cap, EV; nine quarters of income statement and cash flow; six balance sheets; annual consensus estimates; price-target consensus and summary; ratings; shares and float; segments; TTM key metrics — for all 41 Class A names.</li><li>Batch quote and TTM key metrics for the 28 Class B names; full statements for LCID, MARA and EOSE.</li><li>Lists (RADAR, FAVORITES, LIKED) and the lock-up table from the Hub\'s database, read-only.</li><li>TAM: web search, read-only, 41 names; the figure, source and date on each card; "no stated TAM" on %d of them.</li></ul></div><div><h3>Not measured</h3><ul class="lines">%s</ul></div></div>' % (
    sum(1 for o in A.values() if not o["tam"].get("stated_m")), "".join("<li>%s.</li>" % E(x) for x in META["not_measured"])))

# ---------- specs ----------
H.append('<details class="specs"><summary>PAGE SPECS</summary><div class="in"><p><b>Lane</b> %s · built %s UTC · %s.</p><h3>Rules</h3><ul>%s</ul><h3>Sources</h3><ul><li>FMP /stable/ routes through the project\'s edge function fmp-proxy (GET only; the Hub\'s public anon key as bearer; %d calls; cache in the lane\'s scratch folder, raw answers summarised in PRE-PROFIT-STUDY.json).</li><li>Hub database, read-only REST: station_lists (radar %d, favorites %d), hub_favorites (%d), ipo_lockups (%d rows).</li><li>The 13 Oct study deliverables/20261013/PRE-PROFIT-NAMES.json (workspace copy) for class, kind, filing-tagged converts, shelves and ATMs, coverage quality and the four-quarter-average runway.</li><li>Web search (read-only) for stated TAMs and guidance; the links are on the cards.</li></ul><h3>Tools</h3><p>tools/fmp_proxy.py (reader, cache, call log) · pull_class_a.py · pull_class_b.py · assemble.py (every measure) · build_page.py (this page) · shots.mjs (pictures, headless, network blocked).</p><h3>Counts</h3><p>Class A %d · Class B %d · excluded %d · funded %d · tight %d · on the clock %d.</p><p>Nothing deployed; no table written; no subagent; no paid model API.</p></div></details>' % (
    E(META["lane"]), E(built), E(fetch_words), "".join("<li><b>%s</b>: %s</li>" % (E(k), E(v_)) for k, v_ in META["rules"].items()), META.get("fmp_calls_total") or 0, len(D["lists_tonight"]["radar"]), len(D["lists_tonight"]["favorites"]), len(D["lists_tonight"]["liked"]), len(D["lockups_table"]),
    len(A), len(B), len(D["excluded"]), sum(1 for s in SUM if s["read"] == "funded"), sum(1 for s in SUM if s["read"] == "tight"), sum(1 for s in SUM if s["read"] == "on the clock")))
H.append('</main><script>document.documentElement.dataset.ready="1"</script></body></html>')
open(OUT, "w").write("\n".join(H))
print("wrote", OUT, os.path.getsize(OUT), "bytes")

#!/usr/bin/env python3
"""NP1 — builds NP1-ESTIMATES-PATH.html from the files in ../data. No network, no database: every number on the page
is in a file beside it. Run from anywhere:  python3 tools/build_page.py"""
import html, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data")
EX = "CBRS"

load = lambda *p: json.load(open(os.path.join(DATA, *p)))
have = lambda *p: os.path.exists(os.path.join(DATA, *p))
e = lambda s: html.escape(str(s), quote=True)

# ---------------------------------------------------------------- number words (no plus signs; brackets for a negative; empty when there is nothing)


def neg(s, v): return f"({s})" if v < 0 else s


def money(v, d=1):
    if v is None: return ""
    a = abs(v)
    s = f"${a / 1e9:.2f}bn" if a >= 1e9 else f"${a / 1e6:.{d}f}M" if a >= 1e6 else f"${a:,.0f}"
    return neg(s, v)


def mult(v, d=1): return "" if v is None else neg(f"{abs(v):,.{d}f}×", v)
def pct(v, d=0): return "" if v is None else neg(f"{abs(v) * 100:,.{d}f}%", v)
def growth_word(v): return "" if v is None else "over 1,000%" if v > 10 else pct(v)      # from a base near zero a growth rate is only "a lot"
def num(v, d=2): return "" if v is None else neg(f"{abs(v):,.{d}f}", v)
def count(v): return "" if v is None else f"{v:,.0f}"


def short_name(n):
    n = (n or "").split(" Class ")[0].split(" Common Stock")[0].split(" American Depositary")[0].rstrip(", ")
    return n if len(n) <= 26 else n[:25].rstrip() + "…"


MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
def day(iso, year=True, short=False): return f"{int(iso[8:10])} {MONTHS[int(iso[5:7]) - 1]}" + (f" {iso[2:4] if short else iso[:4]}" if year else "")


# The 10-Q's table hides its customers behind letters; its own discussion two sections later names the one whose four
# percentages (34 / 70 / 49 / 47) are the table's Customer A. The others are not named in the filing, so they are not named here.
CUSTOMER_NAMES = {"Customer A": "Customer A · MBZUAI"}
NO_PROSPECTUS = {"NBIS": "none · relisted in 2024", "USAR": "none · came public by merger"}

WHY = {  # the reasons, in plain words
    "NEW_LISTING": "listed under 2 years", "IPO_18M": "IPO in the last 18 months", "NO_TRAILING_EARNINGS": "loss over the last 12 months",
    "JUST_PROFITABLE": "profit now, loss in one of the last two years", "PROFIT_NOT_FROM_OPERATIONS": "profit that did not come from operations",
    "TINY_EARNINGS": "trailing P/E above the cut",
    "NO_FORWARD_EARNINGS": "loss expected over the next 12 months", "FORWARD_PE_ABOVE_CUT": "forward P/E above the cut",
}
SHORT = {"NEW_LISTING": "new", "IPO_18M": "IPO", "NO_TRAILING_EARNINGS": "loss now", "JUST_PROFITABLE": "just profitable", "PROFIT_NOT_FROM_OPERATIONS": "profit not from operations",
         "TINY_EARNINGS": "tiny earnings",
         "NO_FORWARD_EARNINGS": "loss ahead", "FORWARD_PE_ABOVE_CUT": "P/E above cut"}
RUNG = {"ESTIMATES": "estimates", "ESTIMATES_AND_PROSPECTUS": "+ prospectus", "MODELS_AND_QUARTERLIES": "+ models"}

CSS = """
:root{--bg:#121314;--panel:#1a1b1c;--line:#2e3032;--ink:#c4c6c8;--dim:#8a8c8e;--faint:#5e6062;--bright:#cdcfd1;--mid:#3c3e40;--up:#00FFA3;--dn:#FF2D55}
*{box-sizing:border-box}html{background:var(--bg)}
body{margin:0;background:var(--bg);color:var(--ink);font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;padding:28px 16px 60px}
main{max-width:1180px;margin:0 auto}
h1{font-size:16px;letter-spacing:.08em;color:var(--bright);margin:0 0 4px;font-weight:600}
h2{font-size:12px;letter-spacing:.12em;color:var(--bright);margin:34px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--line);font-weight:600}
h3{font-size:11px;letter-spacing:.1em;color:var(--dim);margin:0 0 8px;font-weight:500}
.sub{color:var(--dim);margin:0 0 14px}
.kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px 22px;margin:14px 0 4px}
.kpi b{display:block;font-size:20px;color:var(--bright);font-weight:600;line-height:1.2}.kpi span{font-size:11px;color:var(--dim)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:22px 34px}
.blk{padding:12px 0 2px;border-top:1px solid var(--line);min-width:0}
.hero{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px 28px;margin:4px 0 12px}
.hero b{font-size:34px;line-height:1;color:var(--bright);font-weight:600}.hero span{color:var(--dim);font-size:11px}.hero i{font-style:normal;font-size:16px;color:var(--bright)}
.range{position:relative;height:58px;margin:6px 0 2px}
.range .trk{position:absolute;left:0;right:0;top:26px;height:6px;background:var(--mid);border-radius:3px}
.range .band{position:absolute;top:22px;height:14px;background:var(--dim);border-radius:4px}
.range .tick{position:absolute;top:16px;width:2px;height:26px;background:var(--bright)}
.range .lab{position:absolute;font-size:11px;white-space:nowrap;color:var(--ink)}
.vbars{display:flex;gap:10px;align-items:stretch}
.vb{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;font-size:11px}
.vb .up,.vb .lo{width:100%;display:flex;flex-direction:column;align-items:center}
.vb .up{justify-content:flex-end}.vb .lo{justify-content:flex-start;border-top:1px solid var(--faint)}
.vb .bar{width:62%;max-width:54px;background:var(--dim)}.vb .up .bar{border-radius:4px 4px 0 0}.vb .lo .bar{border-radius:0 0 4px 4px}
.vb .bar.pos{background:var(--up)}.vb .bar.negv{background:var(--dn)}.vb .bar.est{opacity:.55}
.vb .v{color:var(--ink);white-space:nowrap}.vb .p{color:var(--dim);margin-top:4px;white-space:nowrap}.vb .g{color:var(--dim);white-space:nowrap}
.pairs{display:grid;gap:12px}
.pr .t{color:var(--ink);margin-bottom:3px}
.pr .row{display:grid;grid-template-columns:1fr 74px;gap:8px;align-items:center;height:14px;margin:2px 0}
.pr .trk{height:8px;background:transparent}.pr .f{height:8px;border-radius:0 4px 4px 0;background:var(--bright);min-width:2px}.pr .f.m{background:var(--faint)}
.pr .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.pr .n.m{color:var(--dim)}
.key{display:flex;flex-wrap:wrap;gap:4px 16px;color:var(--dim);font-size:11px;margin:6px 0 10px}
.key i{display:inline-block;width:10px;height:8px;border-radius:2px;margin-right:6px;background:var(--bright)}
.key i.m{background:var(--faint)}.key i.u{background:var(--up)}.key i.d{background:var(--dn)}.key i.n{background:var(--mid)}
.stack{display:flex;gap:2px;height:14px;margin:4px 0 6px}.stack div{height:14px;min-width:2px}
.stack div:first-child{border-radius:4px 0 0 4px}.stack div:last-child{border-radius:0 4px 4px 0}
.s0{background:var(--bright)}.s1{background:var(--dim)}.s2{background:var(--faint)}.s3{background:var(--mid)}
.leg{list-style:none;margin:0 0 8px;padding:0;font-size:11px;color:var(--ink)}.leg li{display:flex;gap:8px;align-items:baseline}.leg i{flex:none;width:10px;height:8px;border-radius:2px}
.leg span{color:var(--dim);margin-left:auto;white-space:nowrap;font-variant-numeric:tabular-nums}
.facts{display:grid;grid-template-columns:auto 1fr;gap:3px 14px;margin:0}.facts dt{color:var(--dim)}.facts dd{margin:0;text-align:right;font-variant-numeric:tabular-nums;color:var(--ink)}
.sent{display:grid;grid-template-columns:minmax(120px,210px) 1fr;gap:6px 14px;align-items:center;margin:0 0 12px}
.sent .nm{color:var(--ink)}.sent .w{color:var(--dim);font-size:11px}
.tone{display:flex;gap:2px;height:10px}.tone div{height:10px;min-width:1px}.tone .d{background:var(--dn);border-radius:4px 0 0 4px}.tone .n{background:var(--mid)}.tone .u{background:var(--up);border-radius:0 4px 4px 0}
.tl{display:grid;grid-template-columns:86px 1fr 132px;gap:8px;align-items:center;font-size:11px;color:var(--dim);margin:2px 0}.tl .x{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.say{margin:0 0 14px}.say h3{margin-bottom:4px}.say ul{margin:0 0 6px;padding:0;list-style:none}.say li{padding:2px 0 2px 16px;position:relative}
.say li:before{content:"";position:absolute;left:0;top:8px;width:8px;height:2px;background:var(--faint)}.say li.dr:before{background:var(--up)}.say li.rk:before{background:var(--dn)}
.say li em{font-style:normal;color:var(--dim);font-size:11px;margin-left:6px;white-space:nowrap}.say li.off{color:var(--dim)}.say li.off span{text-decoration:line-through}
.wrap{overflow-x:auto}.scroll{max-height:560px;overflow:auto;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
table{border-collapse:collapse;width:100%;font-size:11px}th,td{padding:5px 8px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}
th{color:var(--dim);font-weight:500;letter-spacing:.06em;position:sticky;top:0;background:var(--bg);white-space:nowrap}
td.r,th.r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}td.tk{color:var(--bright);font-weight:600;white-space:nowrap}td.nw{white-space:nowrap}
tr.ex td{background:var(--panel)}
table.wide th{white-space:normal;vertical-align:bottom;line-height:1.3}table.wide td{padding:5px 6px}table.wide th{padding:5px 6px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
.chips button{font:inherit;font-size:11px;color:var(--ink);background:transparent;border:1px solid var(--line);border-radius:12px;padding:3px 10px;cursor:pointer}
.chips button b{color:var(--bright);font-weight:600;margin-left:6px}.chips button[aria-pressed=true]{background:var(--mid);border-color:var(--faint);color:var(--bright)}
.q{color:var(--dim);font-size:11px;border-left:2px solid var(--line);padding-left:10px;margin:6px 0}
.calls{counter-reset:c;list-style:none;margin:0;padding:0}.calls li{counter-increment:c;padding:8px 0 8px 30px;position:relative;border-top:1px solid var(--line)}
.calls li:before{content:counter(c);position:absolute;left:0;top:8px;color:var(--bright);font-size:16px}.calls b{color:var(--bright);font-weight:600}.calls span{display:block;color:var(--dim)}
.small{font-size:11px;color:var(--dim)}
.reads{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:14px 34px}.rd b{display:block;color:var(--bright);font-weight:600;letter-spacing:.06em;margin-bottom:2px}
.rd p{margin:0 0 4px}.rd .q{margin:4px 0}.rd .q i{font-style:normal;color:var(--faint)}
.in{color:var(--bright)}
.facts.l{grid-template-columns:minmax(110px,190px) 1fr;margin:10px 0 14px}.facts.l dd{text-align:left}
details.sc-pagespecs{margin-top:40px;border-top:1px solid var(--line);padding-top:12px;color:var(--dim)}details.sc-pagespecs summary{cursor:pointer;color:var(--bright);letter-spacing:.12em}
details.sc-pagespecs p{max-width:900px}details.sc-pagespecs b{color:var(--ink);font-weight:600}
details.more{margin:6px 0}details.more summary{cursor:pointer;color:var(--ink);letter-spacing:.06em}
@media(max-width:700px){body{padding:20px 12px 50px}.hero b{font-size:28px}.sent{grid-template-columns:1fr}.tl{grid-template-columns:70px 1fr 112px}.grid{grid-template-columns:1fr}}
"""

# ---------------------------------------------------------------- pieces


def vbars(items, height=132):
    """Columns on one zero line. items: [{label, value, text, kind: pos|negv|'' , est: bool, note}]"""
    vals = [i["value"] for i in items if i["value"] is not None]
    hi, lo = max(vals + [0]), min(vals + [0])
    span = (hi - lo) or 1
    up_h, lo_h = round(height * hi / span), round(height * -lo / span)
    out = ['<div class="vbars">']
    for i in items:
        v = i["value"]
        h = 0 if v is None else max(2, round(height * abs(v) / span))
        cls = " ".join(x for x in ("bar", i.get("kind", ""), "est" if i.get("est") else "") if x)
        tip = e(f'{i["label"]}: {i["text"]}')
        up = f'<span class="v">{e(i["text"])}</span><div class="{cls}" style="height:{h}px" title="{tip}"></div>' if v is not None and v >= 0 else ""
        dn = f'<div class="{cls}" style="height:{h}px" title="{tip}"></div><span class="v">{e(i["text"])}</span>' if v is not None and v < 0 else ""
        out.append(f'<div class="vb"><div class="up" style="height:{up_h + 20}px">{up}</div><div class="lo" style="height:{lo_h + (20 if lo_h else 0)}px">{dn}</div>'
                   f'<span class="p">{e(i["label"])}</span>' + (f'<span class="g">{e(i["note"])}</span>' if i.get("note") is not None else "") + "</div>")
    return "".join(out) + "</div>"


def pair(title, a, b, fa, fb=None):
    """One measure, two bars: the company and the median, each with its number."""
    top = max([x for x in (a, b) if x is not None] + [1e-9])
    w = lambda v: 0 if v is None else max(1.0, 100 * v / top)
    fb = fb or fa
    row = lambda v, cls, f: (f'<div class="row"><div class="trk"><div class="f {cls}" style="width:{w(v):.1f}%"></div></div><div class="n {cls}">{e(f(v)) or "N/A"}</div></div>')
    return f'<div class="pr"><div class="t">{e(title)}</div>{row(a, "", fa)}{row(b, "m", fb)}</div>'


def stack(parts):
    """parts: [(label, share 0..1, right-hand text)]"""
    bar = "".join(f'<div class="s{i % 4}" style="flex:{max(s, 0.004):.4f}" title="{e(l)}: {pct(s)}"></div>' for i, (l, s, _) in enumerate(parts))
    leg = "".join(f'<li><i class="s{i % 4}"></i>{e(l)}<span>{e(t)}</span></li>' for i, (l, _, t) in enumerate(parts))
    return f'<div class="stack">{bar}</div><ul class="leg">{leg}</ul>'


def tone(neg_n, mid_n, pos_n):
    n = (neg_n + mid_n + pos_n) or 1
    return (f'<div class="tone" title="negative {neg_n} · neither {mid_n} · positive {pos_n}"><div class="d" style="flex:{neg_n / n:.4f}"></div>'
            f'<div class="n" style="flex:{mid_n / n:.4f}"></div><div class="u" style="flex:{pos_n / n:.4f}"></div></div>')


def tone_rows(sec):
    f, q = sec["finbert"], sec.get("qwen")
    rows = (f'<div class="tl"><span>sentences</span>{tone(f["neg"], f["neu"], f["pos"])}<span class="x">{pct(f["neg"] / (f["n"] or 1))} neg · {pct(f["pos"] / (f["n"] or 1))} pos</span></div>')
    if q:
        n = q["read"] or 1
        rows += (f'<div class="tl"><span>passages</span>{tone(q["negative"], q["mixed"] + q["factual"], q["positive"])}<span class="x">{pct(q["negative"] / n)} neg · {pct(q["positive"] / n)} pos</span></div>')
    return rows


def said(sec, checks):
    """What the long-text model wrote for one section, each line marked with the result of the check against the source."""
    def line(text, cls):
        c = checks.get(text.strip())
        if c and not c["supported"]: return f'<li class="{cls} off" title="{e("The document says: " + c.get("checked_against", ""))}"><span>{e(text)}</span><em>not in the text</em></li>'
        return f'<li class="{cls}">{e(text)}' + ('<em>checked</em>' if c else "") + "</li>"
    d = "".join(line(x, "dr") for x in sec.get("growth_drivers", []))
    r = "".join(line(x, "rk") for x in sec.get("risks", []))
    if not d and not r: return ""
    return f'<div class="say"><h3>{e(sec["section"].upper())}</h3><ul>{d}{r}</ul></div>'


def net_tone(mo, key):
    """The long-text model's lean for the first section whose name holds `key`: share positive less share negative."""
    if not mo: return ""
    s = [x for x in mo["sections"] if key in x["section"].lower() and x.get("qwen")]
    if not s: return ""
    q = s[0]["qwen"]; n_ = q["read"] or 1; v = (q["positive"] - q["negative"]) / n_
    return f"{abs(v) * 100:.0f}% {'neg' if v < 0 else 'pos'}" if v else "even"


def head_tone(mo):
    h = (mo or {}).get("headlines") or {}
    c = h.get("news_classifier") or h.get("finbert")
    if not c or not c.get("n"): return ""
    v = (c["pos"] - c["neg"]) / c["n"]
    return f"{abs(v) * 100:.0f}% {'neg' if v < 0 else 'pos'}" if v else "even"


def call_read(mo):
    if not mo: return ""
    c = mo.get("call")
    if not c: return "none held"
    if not c.get("read"): return f'{day(c["date"], short=True)} · too old, not read'
    return f'{c["quarter"]} · {day(c["date"], year=False)}'


def report_read(f):
    pk = (f or {}).get("picked", {})
    reps = sorted([(pk[k]["filed"], k) for k in ("quarterly", "annual") if pk.get(k)], reverse=True)       # the newer report first
    return (pk[reps[0][1]] if reps else None), reps


def quarter_table(quarters):
    rows = "".join(f'<tr><td class="nw">{e(q["label"])}</td><td class="r">{money(q["rev"])}</td><td class="r">{pct(q["yoy"])}</td><td class="r">{pct(q["gm"])}</td><td class="r">{money(q["oi"])}</td>'
                   f'<td class="r">{money(q["ni"])}</td><td class="r">{num(q["eps"])}</td><td class="r">{money(q["ocf"])}</td><td class="r">{money(q["capex"])}</td><td class="r">{money(q["sbc"])}</td></tr>' for q in quarters)
    return ('<div class="wrap"><table><tr><th>quarter</th><th class="r">sales</th><th class="r">vs a year ago</th><th class="r">gross margin</th>'
            '<th class="r">operating result</th><th class="r">net result</th><th class="r">EPS</th><th class="r">cash from operations</th><th class="r">plant and equipment</th><th class="r">pay in stock</th></tr>' + rows + '</table></div>')


# ---------------------------------------------------------------- the page

def calls(path, p, fil, price, callf):
    inside = [x for x in (callf or {}).get("against_consensus", []) if x["consensus_is"] == "inside the range"]
    guide = (f'For {p["ticker"]} the analysts\' sales figures for ' + " and ".join(x["period"] for x in inside) + f' both sit inside the company\'s own ranges: the consensus is the guidance written down again, not a second opinion.'
             if len(inside) >= 2 else 'It shows at once whether the analysts are adding anything to what the company already said.')
    return [
        ("Where does this live on the Hub?",
         f'Recommend: a PATH sub-tab inside ESTIMATES, shown only for the {path["universe"]["on_path"]} names on the list. The lock-up stays in the capital block, where it already is.'),
        ("Show the company's own guidance beside the analysts' numbers?",
         'Recommend: yes, wherever a company guides. ' + guide),
        ("Do these names stay in the comps football field?",
         f'Recommend: the {path["reasons"]["NEW_LISTING"]} new listings and the {path["reasons"]["NO_FORWARD_EARNINGS"]} expected to lose money over the next 12 months leave it and show this panel instead. '
         f'The {path["reasons"]["PROFIT_NOT_FROM_OPERATIONS"]} whose profit did not come from operations keep their place but lose the trailing P/E row. The rest stay, with their P/E rows empty.'),
    ]


def specs(path, p, fil, mod, meta, checks):
    cut_f, cut_t = path["cuts"]["fwd_pe"], path["cuts"]["trailing_pe"]
    ai = path["ai"]
    bad = [c for c in checks.values() if not c["supported"]]
    took = mod["took"]
    other = ", ".join(f'{x["ticker"]} ({x["currency"]})' for x in path["other_currency"])
    cs = fil["facts"]["quarterly"]["cover_shares"]
    checked = (f'Every growth driver and risk the long-text model wrote for {EX} was then checked line by line against the filing or the call: {len(checks) - len(bad)} of {len(checks)} are supported by the text; '
               f'the {len(bad)} that are not are struck through and marked "not in the text". The other names\' lines were not checked.' if checks else 'The model\'s sentences were not checked line by line.')
    stale = ", ".join(meta["other_day"]) or "none"
    return [
        ("What the page shows.", f'Which of the {path["universe"]["companies"]} companies in the tree cannot be priced by comparing them with peers, why, and what to read instead: the analysts\' estimates first, '
         'the prospectus and the latest report for a new listing, and — where the estimates are too thin — what the two open-source models make of the filings and the earnings call, with the quarterly reports beside them. '
         f'{EX} is carried all the way through as the example. {meta["n_read"]} names were read in full: the {path["reasons"]["NEW_LISTING"]} new listings and the {path["rungs"]["MODELS_AND_QUARTERLIES"]} whose estimates are too thin (SHAZ is both). '
         'Nothing here is on the live Hub and no table was written.'),
        ("Who goes on the path.", 'A company is on it when at least one of these is true on the day: it has traded for under 2 years (the later of our first daily bar and the vendor\'s IPO date); its IPO was in the last 18 months; '
         'it made a loss over the last 12 months; it is profitable now but made a loss in one of its last two fiscal years; its profit did not come from operations (net result above zero while the operating result is below it, over the last fiscal year or the last four quarters); '
         'its trailing P/E is above the cut; it is expected to make a loss over the next 12 months; its forward P/E is above the cut. Index funds are left out. '
         'The operations test was added on 7 Oct: it finds Lyft, which no other test did — a trailing P/E near 2 that rests on a tax gain of about $2.7bn in one quarter, while the four quarters\' operating results add up to a loss.'),
        ("The cut.", f'Not a number we picked. It is Tukey\'s upper fence — the third quartile plus 1.5 times the spread of the middle half — over the positive multiples of all {path["universe"]["companies"]} companies that day. '
         f'Forward P/E: quartiles {cut_f["q1"]:.1f} / {cut_f["median"]:.1f} / {cut_f["q3"]:.1f} over {cut_f["n"]} names, fence {cut_f["upper"]:.1f}×. Trailing P/E: fence {cut_t["upper"]:.1f}× over {cut_t["n"]} names. It moves with the market.'),
        ("Too thin.", 'Estimates count as too thin when fewer than four analysts cover sales for this fiscal year or the next (Alan, 2 Oct: "if three analysts imply 26% down, we shouldn\'t have discussed it"). '
         'A name on the path with thin estimates is the one that gets the models and the quarterly detail. A company listed more than two years ago has no prospectus read: its annual report\'s risk factors stand in.'),
        ("Where each number comes from.", f'Price: the chart API\'s settled close for 6 Oct 2026 — the same day for every company (without a completed close that day, priced a day earlier: {stale}). Estimates and analyst counts: the Hub table analyst_estimates (FMP). Targets: price_target_consensus. '
         'Shares: the Hub\'s COMPS rule, vendor market value ÷ vendor price. Enterprise value: shares × price + net debt of the newest balance sheet (a company with more cash than debt has an enterprise value below its market value). '
         'Next 12 months: the next four quarterly estimates added up, the rule the Hub board uses. Sales growth: next fiscal year over this one. PEG: forward P/E ÷ EPS growth, empty when this year\'s EPS is not positive. '
         f'The AI names: the {ai["tickers"]} companies in the tree\'s cohorts under AI ({", ".join(ai["cohorts"])}). Filings: the documents themselves on www.sec.gov, plus the company\'s tagged figures (XBRL) for cash and cash flow. '
         'Quarterly tables: fundamentals_history and cashflow_history. Earnings calls: FMP\'s newest transcript for each company. Headlines: the Hub\'s news table over the last 45 days — pages that are not news (option chains, quote pages) left out, a story reposted under one title counted once, the newest 60 read.'),
        ("Guidance against the analysts.", 'The company\'s own expectations are read from its latest call by rule, not by a model: a sentence counts when management says what it expects and gives a figure; the analysts\' questions are left out. '
         'Where it gives a range for a period, the analysts\' figure for that period is set against it — only for a company whose fiscal year is the calendar year, and only when the sentence names the year. '
         f'For {EX} the company guides "core" sales, which leave out the warrants it charges against reported sales; the analysts\' figures follow the same measure, so sales growth and the EV ÷ sales multiple on this page are on core sales, and reported sales run lower.'),
        ("Revisions.", f'The Hub compares the newest stored copy of the estimates with the copy nearest 30 and 90 days back, within 12 days. Nightly copies only began on 2 Oct 2026; before that there are copies from 23–24 Jul and 11 Aug. '
         f'So for {EX} the 30- and 90-day cells are N/A, and the page shows the change since {meta["first_copy_label"]}, saying how many days that really is. The columns fill in as nights accumulate.'),
        ("The two models.", f'Short text: {mod["models"]["short_text"]} reads each sentence ({took["finbert_sentences"]:,} for {EX}, {took["finbert_sections_s"]:.0f} seconds). '
         f'Long text: {mod["models"]["long_text"]} reads each passage of about 450 words ({took["qwen_passages"]} passages for {EX}, {took["qwen_s"]:.0f} seconds) and says its tone, its topic and its point, then writes the drivers and risks from those points. '
         f'Both ran on this MacBook\'s graphics chip, one company after another: {meta["n_models"]} companies, {meta["tot"][2]:,} passages, {meta["tot"][4] / 60:.0f} minutes in all. No paid model was called. ' + checked),
        ("The reads.", f'The block "read in the prospectus, the 10-Q and the call" was written by the reviewer of this run after reading the documents the job pulled, not by the job. '
         'Each quote is checked word for word against the stored text of the document it names when the page\'s data is assembled; a quote that is not found is marked on the page.'),
        ("What changed on 7 Oct.", 'The 6 Oct session stopped on the account\'s weekly limit before its review ran. Re-running it found: (1) its prices were pulled minutes after the bell, so 273 of 452 companies carried the 5 Oct close under a "6 Oct" heading — the list is rebuilt on one settled day (one name gained a reason); '
         '(2) its model files were mixed after the run was killed (one said 178 passages, its audit file held 143) — every model output here is from one clean run of the committed code; '
         '(3) the filing reader missed a heading that wraps onto a second line or is printed "Item 7 —", which lost the management discussion in five documents — fixed and tested, with every other section checked unchanged; '
         f'(4) the models had been run for the new listings only — the {path["rungs"]["MODELS_AND_QUARTERLIES"]} thin-estimate names, the ones Alan\'s ladder sends to the models, are now read; (5) Sandisk\'s stored call was a quarter old — the newest call is read for every name.'),
        ("What could be wrong.", '(1) The estimates are FMP\'s; Alan has called them weak, and for a company four months public a handful of analysts is the whole consensus — and here it repeats the company\'s guidance. '
         f'(2) Shares: the vendor\'s share field for {EX} is Class A only, although the vendor\'s own market value does count every class; the Hub rule divides one vendor table\'s market value by its price and lands about {abs(p["shares"] / cs["total"] - 1) * 100:.0f}% above the 10-Q cover. Every multiple on this page uses the Hub rule, so that it matches the COMPS tab. '
         f'(3) Enterprise value follows the Hub rule too: it counts cash but not the {money(fil["facts"]["cash"]["securities"])} of short-term securities {EX} also holds, so EV ÷ sales reads a little high. '
         '(4) A risk-factors section reads negative for every company and a call\'s prepared remarks read positive for every company — the tone of a section is partly the tone of its kind; compare it with another company\'s, not with zero, and give the questions and answers more weight than the script. '
         '(5) The long-text model was measured on news and video only (81% and 67% right, SM1); on filings it is unmeasured, and it does make mistakes — see the struck lines. It also files some plain facts under "risk". '
         '(6) The filing reader finds sections by their headings. A merger prospectus prints one management discussion per company and they are read as one (SHAZ); POET\'s annual report gave no risk-factors section; a foreign filer has no quarterly report and no tagged US figures. '
         '(7) Calls: FMP holds none for CRML and POET, its newest for LAC is May 2024 (named, not read) and for UUUU a quarter behind. '
         f'(8) Our first-daily-bar table covers 349 of the tree\'s names; for the rest "listed under 2 years" rests on the vendor\'s IPO date. '
         '(9) The trailing cut also catches settled companies in a depressed year (ABBV, MRK): true by the rule, but a comps reading on forward numbers still works for them. '
         f'(10) {len(path["other_currency"])} companies report in another currency ({other}); no price-based multiple is computed for them here. '
         '(11) The guidance reader works by wording; a company that guides in other words is not caught, and it found ranges with a named year for few companies besides this one. '
         '(12) Cash burn counts one tagged line, "purchases of property and equipment". A company that pays for its build-out under another line looks lighter than it is: for SHAZ that line is $12.5M in the quarter while the vendor\'s table counts $283.8M, so no count of cash-quarters is printed for it.'),
        ("What was not done.", f'No table was created or written; the three tables are a proposal. Nothing was deployed and the live Hub is untouched. The filings and the models were run for {meta["n_read"]} names; '
         f'the other {path["universe"]["on_path"] - meta["n_read"]} names on the list have the estimates panel as numbers in the table and nothing more. '
         'There is no consensus for capital spending, so "is the spending covered by cash" uses the last quarter\'s rate times four. Nothing was timed on Fly. The model\'s lines were checked for one company only.'),
        ("For the coordinator.", f'Share count: for a new listing the count on the company\'s own 10-Q cover is the right one ({EX}: {cs["total"] / 1e6:,.1f}M across three classes against {p["shares"] / 1e6:,.1f}M by the Hub rule and {p["shares_profile"] / 1e6:,.1f}M in the vendor\'s field). '
         'The Hub\'s earnings_call_transcripts table is behind FMP (Sandisk\'s August call is missing; seven of the twelve older thin-estimate names have no call stored) and company_profile has no SEC number for those seven. '
         f'For small names the news table\'s newest rows are mostly option-chain and quote pages ({meta["junk"]}); the export now leaves them out before taking its window. '
         'The job is services/estimates-path/ on provider/np1-estimates-path-20261006, staged and not armed; the tables are sql/0001_estimates_path.sql with its rollback, row security on.'),
        ("Colour.", 'Grey everywhere; green and red only for the sign of earnings and for positive and negative tone, the house pair. Every coloured mark also carries its number or a word.'),
        ("Files.", 'data/path.json (the list and every panel), data/filings/, data/models/ (each passage\'s reading is in the .passages.ndjson files), data/CBRS.checks.json (the line-by-line check), data/calls/ (guidance), data/CBRS.read.json, '
         'data/quarters.json, data/ipo_lockups.json, data/fmp-leg-proof.json. Rebuild the data with tools/assemble.py and the page with tools/build_page.py. Test: tests/np1-estimates-path-20261006.test.mjs.'),
    ]




def build():
    path = load("path.json")
    names = {p["ticker"]: p for p in path["path"]}
    p = names[EX]
    fil = load("filings", f"{EX}.filings.json")
    mod = load("models", f"{EX}.models.json")
    checks = {c["claim"].strip(): c for c in (load(f"{EX}.checks.json")["claims"] if have(f"{EX}.checks.json") else [])}
    locks = {r["ticker"]: r for r in load("ipo_lockups.json")}
    all_quarters = load("quarters.json")
    quarters = all_quarters[EX]
    callf = load("calls", f"{EX}.call.json") if have("calls", f"{EX}.call.json") else None
    reads = load(f"{EX}.read.json") if have(f"{EX}.read.json") else None
    ai = path["ai"]["medians"]
    cut_f, cut_t = path["cuts"]["fwd_pe"]["upper"], path["cuts"]["trailing_pe"]["upper"]
    price = p["price"]["v"]
    leg = load("fmp-leg-proof.json") if have("fmp-leg-proof.json") else None
    lk = locks.get(EX) or {}
    meta = {
        "first_copy_label": day(p["revisions"]["fy1"]["earliest"]["from"], year=False) if p["revisions"]["fy1"] and p["revisions"]["fy1"].get("earliest") else "",
        "lockup_label": (day(lk["unlock_date"]) + (" · " + lk["early_rule"].split(" · ")[0] if lk.get("early_rule") else "")) if lk.get("unlock_date") else "N/A",
        "cash_label": day(fil["facts"]["cash"]["as_of"]),
        "customer_names": CUSTOMER_NAMES, "no_prospectus": NO_PROSPECTUS,
        "other_day": sorted(r["ticker"] for r in path["path"] if r["price"]["d"] and r["price"]["d"] != path["as_of"]),
        "n_read": len([r for r in path["path"] if "NEW_LISTING" in r["reasons"] or r["rung"] == "MODELS_AND_QUARTERLIES"]),
        "junk": (lambda j: f'{j["not_news"]:,} of the newest {j["titles"]:,} titles across the {j["names"]} names, {j["worst"]["not_news"]} of {j["worst"]["ticker"]}\'s {j["worst"]["titles"]}')(load("headline-window.json")) if have("headline-window.json") else "not measured",
        "fly_label": (f'{len(leg["names"])} names, {sum(len(n["errors"]) for n in leg["names"])} errors, {leg["fetched_utc"][11:16]} UTC on {day(leg["fetched_utc"][:10], year=False)}, machine removed after') if leg else "not run",
    }
    o = []

    o.append(f'<span data-scnav-slot></span><h1>NP1 · NAMES COMPS CANNOT PRICE</h1>'
             f'<p class="sub">6 Oct 2026 close · {path["universe"]["companies"]} companies checked · nothing on the Hub changed · branch hub/np1-estimates-path-20261006</p>')
    o.append('<div class="kpi">'
             f'<div><b>{path["universe"]["on_path"]}</b><span>of {path["universe"]["companies"]} companies go on the estimates path</span></div>'
             f'<div><b>{path["reasons"]["NEW_LISTING"]}</b><span>listed under 2 years</span></div>'
             f'<div><b>{path["reasons"]["NO_TRAILING_EARNINGS"]}</b><span>made a loss over the last 12 months</span></div>'
             f'<div><b>{mult(cut_f, 0)}</b><span>forward P/E cut today · {path["reasons"]["FORWARD_PE_ABOVE_CUT"]} names above it</span></div>'
             f'<div><b>{path["reasons"]["PROFIT_NOT_FROM_OPERATIONS"]}</b><span>show a profit that did not come from operations</span></div>'
             f'<div><b>{path["rungs"]["MODELS_AND_QUARTERLIES"]}</b><span>have estimates too thin to lean on</span></div></div>')

    # ---- worked example
    t = p["target"]
    ts = (load("target_summary.json") if have("target_summary.json") else {}).get(EX)
    o.append(f'<h2>{EX} · CEREBRAS SYSTEMS · WORKED EXAMPLE</h2>')
    top = max(t["high"], price) * 1.04
    x = lambda v: 100 * v / top
    o.append('<div class="grid"><div class="blk"><h3>ANALYST TARGET</h3>'
             f'<div class="hero"><div><b>${t["median"]:,.0f}</b><br><span>middle of the targets</span></div><div><i>{pct(t["upside"])}</i><br><span>above the ${price:,.2f} close</span></div></div>'
             f'<div class="range" role="img" aria-label="close {price:.2f}; targets from {t["low"]:.0f} to {t["high"]:.0f}, middle {t["median"]:.0f}"><div class="trk"></div>'
             f'<div class="band" style="left:{x(t["low"]):.1f}%;width:{x(t["high"]) - x(t["low"]):.1f}%" title="targets ${t["low"]:,.0f} to ${t["high"]:,.0f}"></div>'
             f'<div class="tick" style="left:{x(price):.1f}%" title="close ${price:,.2f}"></div><div class="tick" style="left:{x(t["median"]):.1f}%" title="middle target ${t["median"]:,.0f}"></div>'
             f'<span class="lab" style="left:{x(price):.1f}%;top:44px;transform:translateX(-50%)">close {price:,.2f}</span>'
             f'<span class="lab" style="left:{x(t["median"]):.1f}%;top:0;transform:translateX(-50%)">{t["median"]:,.0f}</span>'
             f'<span class="lab" style="right:{100 - x(t["high"]):.1f}%;top:44px">{t["low"]:,.0f} – {t["high"]:,.0f}</span></div>'
             + (f'<dl class="facts" style="margin-top:14px"><dt>targets set in the last quarter</dt><dd>{ts["last_quarter_count"]} · average ${ts["last_quarter_avg"]:,.0f}</dd>'
                f'<dt>in the last year</dt><dd>{ts["last_year_count"]} · average ${ts["last_year_avg"]:,.0f}</dd></dl>' if ts else "") + '</div>')
    fy = p["fy"]
    hist_eps = [{"label": "FY" + h["fy"][:4], "value": h["eps"], "est": False} for h in p["trailing"]["last_fy"][:-1]]
    eps_items = hist_eps + [{"label": f["label"] + ("e" if f["kind"] == "estimate" else ""), "value": f["eps"], "est": f["kind"] == "estimate"} for f in fy]
    for i in eps_items: i["text"] = num(i["value"]); i["kind"] = "pos" if (i["value"] or 0) >= 0 else "negv"
    last = fy[0]
    o.append('<div class="blk"><h3>EARNINGS PER SHARE BY YEAR · e = ANALYSTS\' ESTIMATE</h3>' + vbars(eps_items) +
             '<dl class="facts" style="margin-top:12px">'
             f'<dt>P/E on the {last["label"]} profit</dt><dd>{mult(price / last["eps"], 0) if last["eps"] and last["eps"] > 0 else "N/A"}</dd>'
             f'<dt>P/E on the next 12 months</dt><dd>{mult(p["mult"]["fwd_pe"], 0) or "N/A"}</dd>'
             f'<dt>cut</dt><dd>{mult(cut_f, 0)}</dd>'
             + "".join(f'<dt>{e(x["period"])} · where the profit came from</dt><dd>net {money(x["ni"])} · operations {money(x["oi"])}</dd>' for x in p["trailing"].get("not_from_operations", []))
             + '</dl></div></div>')

    rev_items = [{"label": f["label"] + ("e" if f["kind"] == "estimate" else ""), "value": f["rev"], "text": money(f["rev"], 0), "est": f["kind"] == "estimate",
                  "note": ("up " + pct(f["rev_g"]) if f["rev_g"] is not None and f["rev_g"] >= 0 else pct(f["rev_g"])) if f["rev_g"] is not None else ""} for f in fy]
    rows = "".join(f'<tr><td class="nw">{e(f["label"])}{"e" if f["kind"] == "estimate" else ""}</td><td class="r">{money(f["rev"], 0)}</td><td class="r">{pct(f["rev_g"])}</td>'
                   f'<td class="r">{num(f["eps"])}</td><td class="r">{(count(f["n_rev"]) + " / " + count(f["n_eps"])) if f["kind"] == "estimate" else ""}</td></tr>' for f in fy)
    rv = p["revisions"]
    def rev_row(label, r):
        if not r or not r.get("earliest"): return f'<tr><td class="nw">{label}</td><td class="r">N/A</td><td class="r">N/A</td><td class="r"></td><td class="r"></td></tr>'
        c = lambda k: (pct(r[k]["rev_pct"], 1) if r.get(k) else "N/A")
        x_ = r["earliest"]
        return (f'<tr><td class="nw">{label}</td><td class="r">{c("d30")}</td><td class="r">{c("d90")}</td><td class="r">{pct(x_["rev_pct"], 1)}</td>'
                f'<td class="r">{num(x_["eps_from"])} → {num(x_["eps_to"])}</td></tr>')
    days = rv["fy1"]["earliest"]["days"] if rv["fy1"] and rv["fy1"].get("earliest") else None
    o.append('<div class="grid"><div class="blk"><h3>SALES BY YEAR</h3>' + vbars(rev_items, 110) + '</div>'
             '<div class="blk"><h3>THE ESTIMATES · ANALYSTS = SALES / EPS</h3><div class="wrap"><table><tr><th>year</th><th class="r">sales</th><th class="r">growth</th><th class="r">EPS</th><th class="r" title="analysts behind the sales estimate / behind the EPS estimate">analysts</th></tr>'
             + rows + '</table></div>'
             f'<h3 style="margin-top:14px">REVISIONS</h3><div class="wrap"><table><tr><th>sales</th><th class="r">30 d</th><th class="r">90 d</th><th class="r">{days} d · since {e(meta["first_copy_label"])}</th><th class="r">EPS then → now</th></tr>'
             + rev_row(fy[1]["label"] + "e", rv["fy1"]) + rev_row(fy[2]["label"] + "e", rv["fy2"]) + '</table></div></div></div>')

    if callf and callf.get("against_consensus"):
        g_rows = "".join(f'<tr><td class="nw">{e(x["period"])}</td><td>{e(x["guided_as"])}</td><td class="r">{money(x["low"], 0)} – {money(x["high"], 0)}</td>'
                         f'<td class="r">{money(x["value"])}</td><td class="r">{count(x["analysts"])}</td><td class="nw in">{e(x["consensus_is"])}</td></tr>' for x in callf["against_consensus"])
        said_ = [s_ for s_ in callf["sentences"] if re.search(r"revenue|margin|sales", s_, re.I) and re.search(r"range of|\b\d+(\.\d+)?x\b|triple|double", s_)][:5]
        step = (f'<dl class="facts" style="margin-top:12px"><dt>analysts\' {fy[2]["label"]} sales against {fy[1]["label"]}</dt><dd>{fy[2]["rev"] / fy[1]["rev"]:.1f} times</dd></dl>'
                if len(fy) > 2 and fy[1]["rev"] and fy[2]["rev"] else "")
        o.append(f'<div class="grid"><div class="blk"><h3>WHAT THE COMPANY GUIDES · AGAINST THE ANALYSTS</h3><div class="wrap"><table><tr><th>period</th><th>measure</th><th class="r">company\'s range</th>'
                 '<th class="r">analysts</th><th class="r" title="analysts behind the figure">n</th><th>the analysts are</th></tr>' + g_rows + '</table></div>' + step + '</div>'
                 f'<div class="blk"><h3>IN THE COMPANY\'S WORDS · {e(callf["quarter"])} CALL, {e(day(callf["call_date"]))}</h3>' + "".join(f'<p class="q">{e(x)}</p>' for x in said_) + '</div></div>')

    m = p["mult"]
    o.append(f'<div class="grid"><div class="blk"><h3>AGAINST THE {path["ai"]["tickers"]} AI NAMES</h3>'
             f'<div class="key"><span><i></i>{EX}</span><span><i class="m"></i>middle of the AI names</span></div><div class="pairs">'
             + pair("enterprise value ÷ next-12-month sales", m["fwd_ev_sales"], ai["fwd_ev_sales"]["median"], mult)
             + pair("sales growth, next fiscal year", p["growth"]["rev_next_fy"], ai["rev_growth_next_fy"]["median"], pct)
             + pair("the same, per point of sales growth", m["ev_sales_per_growth"], ai["ev_sales_per_growth"]["median"], lambda v: num(v, 2) + ("×" if v is not None else ""))
             + pair("price ÷ next-12-month earnings", m["fwd_pe"], ai["fwd_pe"]["median"], lambda v: mult(v, 0))
             + pair("P/E ÷ earnings growth (PEG)", m["peg"], ai["peg"]["median"], lambda v: num(v, 2))
             + '</div></div>')

    # ---- filings
    qf, pf, cash = fil["facts"]["quarterly"], fil["facts"]["prospectus"], fil["facts"]["cash"]
    cs = qf["cover_shares"]
    o.append('<div class="blk"><h3>SHARES AND WHAT THEY MAKE THE COMPANY WORTH</h3><div class="wrap"><table><tr><th>count from</th><th class="r">shares</th><th class="r">market value</th></tr>'
             f'<tr><td>10-Q cover, {e(cs["as_of"])} · ' + " + ".join(e(c["class"].replace("Class ", "")) for c in cs["classes"]) + f'</td><td class="r">{cs["total"] / 1e6:,.1f}M</td><td class="r">{money(cs["total"] * price)}</td></tr>'
             f'<tr><td>Hub rule (vendor market value ÷ vendor price)</td><td class="r">{p["shares"] / 1e6:,.1f}M</td><td class="r">{money(p["mcap"])}</td></tr>'
             f'<tr><td>vendor share field · Class A only</td><td class="r">{p["shares_profile"] / 1e6:,.1f}M</td><td class="r">{money(p["shares_profile"] * price)}</td></tr></table></div>'
             '<dl class="facts" style="margin-top:12px">'
             f'<dt>IPO</dt><dd>{count(pf["offering"].get("shares_offered"))} shares at ${pf["offering"].get("price", 0):,.0f} · {money(pf["offering"].get("net_proceeds"))} to the company</dd>'
             f'<dt>lock-up ends</dt><dd>{e(meta["lockup_label"])}</dd></dl></div></div>')

    mix = qf["revenue_mix"]
    unit = 1000
    o.append('<div class="grid"><div class="blk"><h3>WHERE THE SALES COME FROM · QUARTER TO 30 JUN 2026</h3>'
             + stack([(l["line"], l["share"], f'{pct(l["share"])} · {money(l["value"] * unit)} · a year ago {pct(l["year_ago"] / mix["total_year_ago"])}') for l in mix["lines"]])
             + '<h3 style="margin-top:14px">WHO BUYS · SAME QUARTER</h3>'
             + stack([(meta["customer_names"].get(c["customer"], c["customer"]), c["share_latest_quarter"] / 100, pct(c["share_latest_quarter"] / 100)) for c in qf["customers"]["table"] if c["share_latest_quarter"]]
                     + [("everyone else", 1 - sum((c["share_latest_quarter"] or 0) for c in qf["customers"]["table"]) / 100, pct(1 - sum((c["share_latest_quarter"] or 0) for c in qf["customers"]["table"]) / 100))])
             + f'<p class="q">{e(pf["customers"]["sentences"][0]) if pf.get("customers") else ""}</p></div>')
    gm_items = [{"label": q["label"], "value": q["gm"], "text": pct(q["gm"]), "kind": ""} for q in quarters]
    o.append('<div class="blk"><h3>GROSS MARGIN BY QUARTER</h3>' + vbars(gm_items, 96) +
             '<h3 style="margin-top:16px">CASH</h3><dl class="facts">'
             f'<dt>cash and securities, {e(meta["cash_label"])}</dt><dd>{money(cash["liquid"])}</dd>'
             f'<dt>cash from operations, that quarter</dt><dd>{money(cash["operating_cash_flow_quarter"])}</dd>'
             f'<dt>spent on plant and equipment, that quarter</dt><dd>{money(cash["capex_quarter"])}</dd>'
             f'<dt>quarters of cash at that rate</dt><dd>{cash["quarters_of_cash"]:.1f}</dd>'
             f'<dt>a year of that spending against the cash</dt><dd>{money(cash["capex_run_rate_year"])} · {"covered" if cash["capex_covered_by_cash"] else "not covered"}</dd></dl></div></div>')

    o.append('<div class="blk" style="margin-top:22px"><h3>THE QUARTERLY REPORTS</h3>' + quarter_table(quarters) + '</div>')

    # ---- what the reviewer read in the documents, each line with the words it rests on
    if reads:
        def quote(q): return f'<p class="q">{e(q["text"])} <i>· {e(q["where"])}{"" if q.get("found_in_source") else " · NOT FOUND IN THE TEXT"}</i></p>'
        o.append('<div class="blk" style="margin-top:22px"><h3>READ IN THE PROSPECTUS, THE 10-Q AND THE CALL · EACH QUOTE CHECKED AGAINST THE TEXT</h3><div class="reads">'
                 + "".join(f'<div class="rd"><b>{e(r["topic"].upper())}</b><p>{e(r["says"])}</p>' + "".join(quote(q) for q in r["quotes"]) + '</div>' for r in reads["reads"]) + '</div></div>')

    # ---- models
    o.append('<div class="blk" style="margin-top:22px"><h3>WHAT THE TWO OPEN MODELS READ</h3>'
             '<div class="key"><span><i class="d"></i>reads negative</span><span><i class="n"></i>neither</span><span><i class="u"></i>reads positive</span></div><div class="sent">')
    for s in mod["sections"]:
        o.append(f'<div><div class="nm">{e(s["section"])}</div><div class="w">{s["words"]:,} words</div></div><div>{tone_rows(s)}</div>')
    hl = mod["headlines"]
    if hl.get("finbert"):
        f_, n_ = hl["finbert"], hl["news_classifier"]
        o.append(f'<div><div class="nm">Headlines, last 45 days</div><div class="w">{hl["n"]} headlines</div></div><div>'
                 f'<div class="tl"><span>FinBERT</span>{tone(f_["neg"], f_["neu"], f_["pos"])}<span class="x">{pct(f_["neg"] / f_["n"])} neg · {pct(f_["pos"] / f_["n"])} pos</span></div>'
                 f'<div class="tl"><span>news model</span>{tone(n_["neg"], n_["neu"], n_["pos"])}<span class="x">{pct(n_["neg"] / n_["n"])} neg · {pct(n_["pos"] / n_["n"])} pos</span></div></div>')
    o.append('</div></div>')
    o.append('<div class="blk"><h3>GROWTH DRIVERS AND RISKS, IN THE MODEL\'S WORDS</h3><div class="key"><span><i class="u"></i>growth driver</span><span><i class="d"></i>risk</span></div><div class="grid">'
             + "".join(said(s, checks) for s in mod["sections"]) + '</div></div>')

    # ---- the list
    lst = sorted(path["path"], key=lambda r: ("NEW_LISTING" not in r["reasons"], r["rung"] != "MODELS_AND_QUARTERLIES", -len(r["reasons"]), r["ticker"]))
    chips = [("ALL", "all", path["universe"]["on_path"])] + [(k, WHY[k], path["reasons"][k]) for k in WHY] + [("WEAK", "estimates too thin", path["rungs"]["MODELS_AND_QUARTERLIES"])]
    o.append(f'<h2>THE LIST · {path["universe"]["on_path"]} NAMES</h2><div class="chips" id="chips">'
             + "".join(f'<button type="button" data-k="{k}" aria-pressed="{"true" if k == "ALL" else "false"}">{e(l.replace("the cut", mult(cut_t if k == "TINY_EARNINGS" else cut_f, 0)))}<b>{n}</b></button>' for k, l, n in chips) + '</div>')
    o.append('<div class="scroll"><table id="list"><thead><tr><th>ticker</th><th>company</th><th>why</th><th class="r">listed</th><th class="r">sales growth</th>'
             '<th class="r">EV ÷ sales</th><th class="r">÷ growth</th><th class="r">fwd P/E</th><th class="r">analysts</th><th class="r">target</th><th>read</th></tr></thead><tbody>')
    for r in lst:
        why = " · ".join(SHORT[c] for c in r["reasons"] if c != "IPO_18M" or "NEW_LISTING" not in r["reasons"])
        if r["currency"]: why += f' · reports in {r["currency"]}'
        codes = " ".join(r["reasons"]) + (" WEAK" if r["rung"] == "MODELS_AND_QUARTERLIES" else "")
        mm = r["mult"]
        o.append(f'<tr data-r="{codes}"{" class=ex" if r["ticker"] == EX else ""}><td class="tk">{e(r["ticker"])}</td><td class="nw">{e(short_name(r["name"]))}</td><td>{e(why)}</td>'
                 f'<td class="r">{e(day(r["listed"]["on"], short=True)[-6:]) if "NEW_LISTING" in r["reasons"] else ""}</td><td class="r">{growth_word(r["growth"]["rev_next_fy"])}</td>'
                 f'<td class="r">{mult(mm["fwd_ev_sales"])}</td><td class="r">{num(mm["ev_sales_per_growth"])}</td><td class="r">{mult(mm["fwd_pe"], 0)}</td>'
                 f'<td class="r">{count(r["analysts"]["fy1_rev"])}</td><td class="r">{pct(r["target"]["upside"]) if r["target"] else ""}</td><td class="nw">{e(RUNG[r["rung"]])}</td></tr>')
    o.append('</tbody></table></div>')
    o.append(f'<p class="small">Middle of the {path["ai"]["tickers"]} AI names: EV ÷ sales {mult(ai["fwd_ev_sales"]["median"])} · sales growth {pct(ai["rev_growth_next_fy"]["median"])} · '
             f'per point of growth {num(ai["ev_sales_per_growth"]["median"])} · forward P/E {mult(ai["fwd_pe"]["median"], 0)} · PEG {num(ai["peg"]["median"])}</p>')

    def capex_disagrees(tk, ch):
        vq = next((q for q in (all_quarters.get(tk) or []) if q["end"] == ch.get("as_of") and q.get("capex") is not None), None)
        return bool(vq and ch.get("basis") == "the quarter" and ch.get("capex_quarter") and abs(vq["capex"]) > 2 * abs(ch["capex_quarter"]))

    # ---- the new listings
    o.append(f'<h2>THE {path["reasons"]["NEW_LISTING"]} NEW LISTINGS · WHAT WAS READ</h2><div class="wrap"><table class="wide"><tr><th>ticker</th><th class="r">since</th><th>prospectus</th><th>latest report</th>'
             '<th class="r">shares, filing</th><th class="r">vendor field</th><th class="r">cash</th><th class="r">quarters</th><th class="r">lock-up</th>'
             '<th class="r">risk factors</th><th class="r">management</th><th class="r">call</th></tr>')
    for r in [x for x in lst if "NEW_LISTING" in x["reasons"]]:
        tk = r["ticker"]
        f = load("filings", f"{tk}.filings.json") if have("filings", f"{tk}.filings.json") else None
        mo = load("models", f"{tk}.models.json") if have("models", f"{tk}.models.json") else None
        pk = (f or {}).get("picked", {})
        rep, reps = report_read(f)
        fc = (f or {}).get("facts", {})
        cover = next((fc[k]["cover_shares"] for _, k in reps if (fc.get(k) or {}).get("cover_shares")), None)
        ch = fc.get("cash") or {}
        net = lambda key: net_tone(mo, key)
        lk_ = locks.get(tk)
        cells = [
            f'<td class="tk">{e(tk)}</td>', f'<td class="r">{e(day(r["listed"]["on"], short=True))}</td>',
            f'<td class="nw">{e(pk["prospectus"]["form"] + " · " + day(pk["prospectus"]["filed"], short=True) + (" · later sale" if pk["prospectus"].get("kind") == "later offering" else "")) if pk.get("prospectus") else e(meta["no_prospectus"].get(tk, "none found"))}</td>',
            f'<td class="nw">{e(rep["form"] + " · " + day(rep["filed"], short=True)) if rep else ""}</td>',
            f'<td class="r">{cover["total"] / 1e6:,.1f}M</td>' if cover else '<td class="r"></td>',
            f'<td class="r">{r["shares_profile"] / 1e6:,.1f}M</td>' if r.get("shares_profile") else '<td class="r"></td>',
            f'<td class="r">{money(ch.get("liquid"))}</td>',
            f'<td class="r">{ch["quarters_of_cash"]:.1f}</td>' if ch.get("quarters_of_cash") and not capex_disagrees(tk, ch) else '<td class="r"></td>',
            f'<td class="r">{e(day(lk_["unlock_date"], short=True)) if lk_ and lk_.get("unlock_date") else ""}</td>',
            f'<td class="r nw">{net("risk factors")}</td>', f'<td class="r nw">{net("management")}</td>', f'<td class="r nw">{net("prepared remarks")}</td>']
        o.append(f'<tr{" class=ex" if tk == EX else ""}>' + "".join(cells) + '</tr>')
    o.append('</table></div>')
    def facts_block(tk):
        """What the filing reader lifted for one name: shares, the offering, the lock-up, customers, the sales mix, margin, cash."""
        if not have("filings", f"{tk}.filings.json"): return ""
        f = load("filings", f"{tk}.filings.json"); fc = f["facts"]; pk = f["picked"]
        rep_, reps = report_read(f)
        rows_ = []
        cover = next((fc[k]["cover_shares"] for _, k in reps if (fc.get(k) or {}).get("cover_shares")), None)
        if cover: rows_.append(("shares on the cover", f'{cover["total"] / 1e6:,.1f}M · {cover["as_of"]}' + (" · " + " + ".join(f'{c["class"]} {c["shares"] / 1e6:,.1f}M' for c in cover["classes"] if c["shares"]) if len(cover["classes"]) > 1 else "")))
        off = (fc.get("prospectus") or {}).get("offering") or {}
        if off:
            bits = []
            if off.get("shares_offered"): bits.append(f'{off["shares_offered"]:,} shares by the company' + (f' at ${off["price"]:,.2f}' if off.get("price") else ""))
            if off.get("shares_offered_by_holders"): bits.append(f'{off["shares_offered_by_holders"]:,} by holders')
            if off.get("net_proceeds"): bits.append(f'{money(off["net_proceeds"])} to the company')
            if bits: rows_.append((("the listing" if (pk.get("prospectus") or {}).get("kind") == "listing" else "the later sale") + f' · {day(pk["prospectus"]["filed"], short=True)}', " · ".join(bits)))
        lk_ = locks.get(tk)
        if lk_ and lk_.get("unlock_date"): rows_.append(("lock-up ends", day(lk_["unlock_date"]) + (" · " + lk_["early_rule"] if lk_.get("early_rule") else "")))
        elif (fc.get("prospectus") or {}).get("lockup"): rows_.append(("lock-up, in the prospectus", fc["prospectus"]["lockup"][0][:240] + "…"))
        for _, k in reps:
            x = fc.get(k) or {}
            if x.get("revenue_mix") and not any(a_ == "where the sales come from" for a_, _b in rows_):
                rows_.append(("where the sales come from", " · ".join(f'{l["line"]} {pct(l["share"])}' for l in x["revenue_mix"]["lines"][:5])))
            if x.get("gross_margin") and not any(a_ == "gross margin" for a_, _b in rows_):
                g = x["gross_margin"]; rows_.append(("gross margin", pct(g["margin"]) + (f' · a year before {pct(g["year_ago"])}' if g.get("year_ago") is not None else "")))
            c_ = x.get("customers")
            if c_ and not any(a_ == "who buys" for a_, _b in rows_):
                tbl = [c for c in c_["table"] if c["share_latest_quarter"]]
                rows_.append(("who buys", " · ".join(f'{c["customer"]} {c["share_latest_quarter"]:.0f}%' for c in tbl) if tbl else (c_["sentences"][0][:260] + ("…" if len(c_["sentences"][0]) > 260 else ""))))
        ch = fc.get("cash")
        if ch and ch.get("liquid") is not None:
            t_ = f'{money(ch["liquid"])} · {day(ch["as_of"])}'
            if ch.get("operating_cash_flow_quarter") is not None:
                t_ += f' · operations {money(ch["operating_cash_flow_quarter"])} and plant {money(ch["capex_quarter"])} a quarter ({ch["basis"]})'
                # the tagged line is "purchases of property and equipment" alone; when the vendor's table counts several times more for the
                # same quarter (deposits, prepayments for a build-out), the two are shown side by side and no cash-quarters figure is given
                vq = next((q for q in (all_quarters.get(tk) or []) if q["end"] == ch["as_of"] and q.get("capex") is not None), None)
                if vq and ch["basis"] == "the quarter" and ch["capex_quarter"] and abs(vq["capex"]) > 2 * abs(ch["capex_quarter"]):
                    t_ += f' · the vendor\'s table counts {money(abs(vq["capex"]))} of spending for the same quarter, so no count of cash-quarters is given'
                else:
                    t_ += f' · {ch["quarters_of_cash"]:.1f} quarters of cash' if ch.get("quarters_of_cash") else ' · the quarter made cash'
            rows_.append(("cash and securities", t_))
        return ('<dl class="facts l">' + "".join(f'<dt>{e(a_)}</dt><dd>{e(b_)}</dd>' for a_, b_ in rows_) + '</dl>') if rows_ else ""

    def fold(r):
        tk = r["ticker"]
        if not have("models", f"{tk}.models.json"): return ""
        mo = load("models", f"{tk}.models.json")
        hl_ = mo["headlines"]
        heads = (f'<div><div class="nm">Headlines, last 45 days</div><div class="w">{hl_["n"]} headlines</div></div><div>'
                 f'<div class="tl"><span>FinBERT</span>{tone(hl_["finbert"]["neg"], hl_["finbert"]["neu"], hl_["finbert"]["pos"])}<span class="x">{pct(hl_["finbert"]["neg"] / hl_["finbert"]["n"])} neg · {pct(hl_["finbert"]["pos"] / hl_["finbert"]["n"])} pos</span></div>'
                 f'<div class="tl"><span>news model</span>{tone(hl_["news_classifier"]["neg"], hl_["news_classifier"]["neu"], hl_["news_classifier"]["pos"])}<span class="x">{pct(hl_["news_classifier"]["neg"] / hl_["news_classifier"]["n"])} neg · {pct(hl_["news_classifier"]["pos"] / hl_["news_classifier"]["n"])} pos</span></div></div>'
                 if hl_.get("finbert") and hl_["finbert"]["n"] else "")
        return (f'<details class="more"><summary>{e(tk)} · {e(r["name"])}</summary>' + facts_block(tk) + '<div class="sent" style="margin-top:10px">'
                + "".join(f'<div><div class="nm">{e(s["section"])}</div><div class="w">{s["words"]:,} words</div></div><div>{tone_rows(s)}</div>' for s in mo["sections"]) + heads
                + '</div><div class="grid">' + "".join(said(s, {}) for s in mo["sections"]) + '</div>'
                + (quarter_table(all_quarters[tk]) if all_quarters.get(tk) else "") + '</details>')
    o.append("".join(fold(r) for r in lst if "NEW_LISTING" in r["reasons"] and r["ticker"] != EX))

    # ---- the last rung: estimates too thin, so the models and the quarterly reports
    thin = [x for x in lst if x["rung"] == "MODELS_AND_QUARTERLIES"]
    o.append(f'<h2>THE {len(thin)} WITH ESTIMATES TOO THIN · THE MODELS AND THE QUARTERLIES</h2><div class="wrap"><table class="wide"><tr><th>ticker</th><th>company</th>'
             '<th class="r" title="analysts behind the sales estimate, this fiscal year / next">analysts</th><th>latest report</th><th>call read</th><th class="r">sales, last quarter</th><th class="r">vs a year ago</th>'
             '<th class="r">gross margin</th><th class="r">risk factors</th><th class="r">management</th><th class="r">call</th><th class="r">headlines</th></tr>')
    for r in thin:
        tk = r["ticker"]
        f = load("filings", f"{tk}.filings.json") if have("filings", f"{tk}.filings.json") else None
        mo = load("models", f"{tk}.models.json") if have("models", f"{tk}.models.json") else None
        rep_, _ = report_read(f)
        q = (all_quarters.get(tk) or [None])[-1]
        a_ = r["analysts"]; n_ = lambda v: "N/A" if v is None else count(v)
        o.append(f'<tr><td class="tk">{e(tk)}</td><td>{e(short_name(r["name"]))}</td><td class="r">{n_(a_["fy1_rev"])} / {n_(a_["fy2_rev"])}</td>'
                 f'<td class="nw">{e(rep_["form"] + " · " + day(rep_["filed"], short=True)) if rep_ else ""}</td><td class="nw">{e(call_read(mo))}</td>'
                 f'<td class="r">{money(q["rev"]) if q else ""}</td><td class="r">{pct(q["yoy"]) if q else ""}</td><td class="r">{pct(q["gm"]) if q else ""}</td>'
                 f'<td class="r nw">{net_tone(mo, "risk factors")}</td><td class="r nw">{net_tone(mo, "management")}</td><td class="r nw">{net_tone(mo, "prepared remarks")}</td><td class="r nw">{head_tone(mo)}</td></tr>')
    o.append('</table></div>')
    o.append("".join(fold(r) for r in thin if "NEW_LISTING" not in r["reasons"]))       # a new listing already has its fold-out above

    # ---- proposed table
    o.append('<h2>PROPOSED TABLES · NOTHING WRITTEN</h2><div class="wrap"><table><tr><th>table</th><th>one row is</th><th>it holds</th><th class="r">rows a night</th></tr>'
             f'<tr><td class="tk">estimates_path</td><td>a company on a day</td><td>on the path or not, the reasons, price, shares, enterprise value, next-12-month sales and EPS, the multiples, analysts, target, revisions, the two cuts</td><td class="r">{path["universe"]["companies"]}</td></tr>'
             '<tr><td class="tk">filing_facts</td><td>a filing we read</td><td>shares by class with the sentence, sales mix, customers, gross margin, cash, cash burn, the offering, the lock-up sentence</td><td class="r">new filings only</td></tr>'
             '<tr><td class="tk">filing_model_reads</td><td>a section of a filing or call</td><td>sentences positive / negative, passages positive / negative, topics, the drivers and risks the model wrote, lines checked and supported, the model names, seconds</td><td class="r">new filings and calls only</td></tr>'
             '<tr><td class="tk">call_guidance</td><td>a range the company guided</td><td>the call, the period, the measure in the company\'s words, low and high, the sentence, the analysts\' figure for the same period and where it sits</td><td class="r">new calls only</td></tr></table></div>'
             '<p class="small">services/estimates-path/sql/0001_estimates_path.sql and its rollback, on the provider branch. Four new tables, row security on, no reader yet. Both files pass the PostgreSQL parser; neither was run against a database.</p>')

    # ---- time
    o.append('<h2>MODEL RUNS · TIME ON THIS MACBOOK</h2><div class="wrap"><table><tr><th>ticker</th><th class="r">sentences</th><th class="r">seconds, short-text model</th><th class="r">passages</th>'
             '<th class="r">seconds, long-text model</th><th class="r">headlines</th><th class="r">whole run</th></tr>')
    tot = [0, 0, 0, 0, 0]; n_models = 0
    for r in [x for x in lst if "NEW_LISTING" in x["reasons"] or x["rung"] == "MODELS_AND_QUARTERLIES"]:
        tk = r["ticker"]
        if not have("models", f"{tk}.models.json"): continue
        k = load("models", f"{tk}.models.json"); tk_ = k["took"]
        tot = [tot[0] + tk_["finbert_sentences"], tot[1] + tk_["finbert_sections_s"], tot[2] + tk_["qwen_passages"], tot[3] + tk_["qwen_s"], tot[4] + tk_["total_s"]]; n_models += 1
        o.append(f'<tr{" class=ex" if tk == EX else ""}><td class="tk">{e(tk)}</td><td class="r">{tk_["finbert_sentences"]:,}</td><td class="r">{tk_["finbert_sections_s"]:.0f}</td><td class="r">{tk_["qwen_passages"]}</td>'
                 f'<td class="r">{tk_["qwen_s"]:.0f}</td><td class="r">{k["headlines"]["n"]}</td><td class="r">{tk_["total_s"] / 60:.1f} min</td></tr>')
    o.append(f'<tr><td>all</td><td class="r">{tot[0]:,}</td><td class="r">{tot[1]:.0f}</td><td class="r">{tot[2]}</td><td class="r">{tot[3]:.0f}</td><td class="r"></td><td class="r">{tot[4] / 60:.1f} min</td></tr></table></div>')
    meta["tot"], meta["n_models"] = tot, n_models
    o.append(f'<p class="small">Long text: {e(mod["models"]["long_text"])}. Short text: {e(mod["models"]["short_text"])}. Headlines also: {e(mod["models"]["headlines"])}. '
             f'Keyed pull on a throw-away Fly machine: {e(meta["fly_label"])}.</p>')

    # ---- calls
    o.append('<h2>CALLS FOR ALAN</h2><ol class="calls">' + "".join(f'<li><b>{e(a)}</b><span>{e(b)}</span></li>' for a, b in calls(path, p, fil, price, callf)) + '</ol>')

    # ---- page specs
    o.append('<details class="sc-pagespecs"><summary>PAGE SPECS</summary>' + "".join(f'<p><b>{e(a)}</b> {b}</p>' for a, b in specs(path, p, fil, mod, meta, checks)) + '</details>')

    js = ("<script>(function(){var c=document.getElementById('chips'),rows=document.querySelectorAll('#list tbody tr');if(!c)return;"
          "c.addEventListener('click',function(ev){var b=ev.target.closest('button');if(!b)return;var k=b.getAttribute('data-k');"
          "c.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});"
          "rows.forEach(function(r){r.style.display=(k==='ALL'||(' '+r.getAttribute('data-r')+' ').indexOf(' '+k+' ')>=0)?'':'none'})})})();</script>")
    page = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>NP1 · Names comps cannot price</title><style>' + CSS + '</style></head><body><main>' + "".join(o) + '</main>' + js + '</body></html>\n')
    # the BACK / CLOSE pair is placed by scripts/inject-scnav.py; a rebuild keeps the block that script put here
    out = os.path.join(ROOT, "NP1-ESTIMATES-PATH.html")
    if os.path.exists(out):
        nav = re.search(r"\n?<!-- scnav · .*?<!-- /scnav -->\n?", open(out).read(), re.S)
        if nav: page = page.replace("</body>", nav.group(0) + "</body>")
    with open(out, "w") as fh: fh.write(page)
    return len(page)


if __name__ == "__main__":
    print("wrote NP1-ESTIMATES-PATH.html,", build(), "bytes")

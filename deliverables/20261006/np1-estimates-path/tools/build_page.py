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
NO_PROSPECTUS = {"NBIS": "none · relisted in 2024", "USAR": "none · came public by merger", "SNDK": "none found"}

WHY = {  # the reasons, in plain words
    "NEW_LISTING": "listed under 2 years", "IPO_18M": "IPO in the last 18 months", "NO_TRAILING_EARNINGS": "loss over the last 12 months",
    "JUST_PROFITABLE": "profit now, loss in one of the last two years", "TINY_EARNINGS": "trailing P/E above the cut",
    "NO_FORWARD_EARNINGS": "loss expected over the next 12 months", "FORWARD_PE_ABOVE_CUT": "forward P/E above the cut",
}
SHORT = {"NEW_LISTING": "new", "IPO_18M": "IPO", "NO_TRAILING_EARNINGS": "loss now", "JUST_PROFITABLE": "just profitable", "TINY_EARNINGS": "tiny earnings",
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
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
.chips button{font:inherit;font-size:11px;color:var(--ink);background:transparent;border:1px solid var(--line);border-radius:12px;padding:3px 10px;cursor:pointer}
.chips button b{color:var(--bright);font-weight:600;margin-left:6px}.chips button[aria-pressed=true]{background:var(--mid);border-color:var(--faint);color:var(--bright)}
.q{color:var(--dim);font-size:11px;border-left:2px solid var(--line);padding-left:10px;margin:6px 0}
.calls{counter-reset:c;list-style:none;margin:0;padding:0}.calls li{counter-increment:c;padding:8px 0 8px 30px;position:relative;border-top:1px solid var(--line)}
.calls li:before{content:counter(c);position:absolute;left:0;top:8px;color:var(--bright);font-size:16px}.calls b{color:var(--bright);font-weight:600}.calls span{display:block;color:var(--dim)}
.small{font-size:11px;color:var(--dim)}
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
        if c and not c["supported"]: return f'<li class="{cls} off"><span>{e(text)}</span><em>not in the text</em></li>'
        return f'<li class="{cls}">{e(text)}' + ('<em>checked</em>' if c else "") + "</li>"
    d = "".join(line(x, "dr") for x in sec.get("growth_drivers", []))
    r = "".join(line(x, "rk") for x in sec.get("risks", []))
    if not d and not r: return ""
    return f'<div class="say"><h3>{e(sec["section"].upper())}</h3><ul>{d}{r}</ul></div>'


# ---------------------------------------------------------------- the page

def calls(path, p, fil, price):
    cs = fil["facts"]["quarterly"]["cover_shares"]
    return [
        ("Where does this live on the Hub?",
         f'Recommend: a PATH sub-tab inside ESTIMATES, shown only for the {path["universe"]["on_path"]} names on the list. The lock-up stays in the capital block, where it already is.'),
        ("For a new listing, which share count sets the market value?",
         f'Recommend: the count on the company\'s own 10-Q cover, wherever we have read one. For {p["ticker"]} the cover says {cs["total"] / 1e6:,.1f}M shares across three classes ({money(cs["total"] * price)}); '
         f'the Hub\'s rule gives {p["shares"] / 1e6:,.1f}M ({money(p["mcap"])}), about {abs(p["shares"] / cs["total"] - 1) * 100:.0f}% more; the vendor\'s share field holds Class A only ({p["shares_profile"] / 1e6:,.1f}M) and should never be used for a company with several classes.'),
        ("Do these names stay in the comps football field?",
         f'Recommend: the {path["reasons"]["NEW_LISTING"]} new listings and the {path["reasons"]["NO_FORWARD_EARNINGS"]} expected to lose money over the next 12 months leave it and show this panel instead. '
         'The rest stay, with their P/E rows empty.'),
    ]


def specs(path, p, fil, mod, meta, checks):
    cut_f, cut_t = path["cuts"]["fwd_pe"], path["cuts"]["trailing_pe"]
    ai = path["ai"]
    bad = [c for c in checks.values() if not c["supported"]]
    took = mod["took"]
    other = ", ".join(f'{x["ticker"]} ({x["currency"]})' for x in path["other_currency"])
    checked = (f'Every growth driver and risk the long-text model wrote for {EX} was then checked against the filing or the call by a separate reviewer: {len(checks) - len(bad)} of {len(checks)} are supported by the text; '
               f'the {len(bad)} that are not are struck through and marked "not in the text".' if checks else 'The model\'s sentences were not checked line by line.')
    return [
        ("What the page shows.", f'Which of the {path["universe"]["companies"]} companies in the tree cannot be priced by comparing them with peers, why, and what to read instead: the analysts\' estimates first, '
         'the prospectus and the latest report for a new listing, and — where the estimates are too thin — what the two open-source models make of the filings and the earnings call. '
         f'{EX} is carried all the way through as the example. Nothing here is on the live Hub and no table was written.'),
        ("Who goes on the path.", 'A company is on it when at least one of these is true on the day: it has traded for under 2 years (the later of our first daily bar and the vendor\'s IPO date); its IPO was in the last 18 months; '
         'it made a loss over the last 12 months; it is profitable now but made a loss in one of its last two fiscal years; its trailing P/E is above the cut; it is expected to make a loss over the next 12 months; '
         'its forward P/E is above the cut. Index funds are left out.'),
        ("The cut.", f'Not a number we picked. It is Tukey\'s upper fence — the third quartile plus 1.5 times the spread of the middle half — over the positive multiples of all {path["universe"]["companies"]} companies that day. '
         f'Forward P/E: quartiles {cut_f["q1"]:.1f} / {cut_f["median"]:.1f} / {cut_f["q3"]:.1f} over {cut_f["n"]} names, fence {cut_f["upper"]:.1f}×. Trailing P/E: fence {cut_t["upper"]:.1f}× over {cut_t["n"]} names. It moves with the market.'),
        ("Too thin.", 'Estimates count as too thin when fewer than four analysts cover sales for this fiscal year or the next (Alan, 2 Oct: "if three analysts imply 26% down, we shouldn\'t have discussed it"). '
         'A name on the path with thin estimates is the one that gets the models and the quarterly detail.'),
        ("Where each number comes from.", 'Price: the chart API\'s settled close for 6 Oct 2026. Estimates and analyst counts: the Hub table analyst_estimates (FMP). Targets: price_target_consensus. '
         'Shares: the Hub\'s COMPS rule, vendor market value ÷ vendor price. Enterprise value: shares × price + net debt of the newest balance sheet (a company with more cash than debt has an enterprise value below its market value). '
         'Next 12 months: the next four quarterly estimates added up, the rule the Hub board uses. Sales growth: next fiscal year over this one. PEG: forward P/E ÷ EPS growth, empty when this year\'s EPS is not positive. '
         f'The AI names: the {ai["tickers"]} companies in the tree\'s cohorts under AI ({", ".join(ai["cohorts"])}). Filings: the documents themselves on www.sec.gov, plus the company\'s tagged figures (XBRL) for cash and cash flow. '
         'Quarterly table: fundamentals_history and cashflow_history.'),
        ("Revisions.", f'The Hub compares the newest stored copy of the estimates with the copy nearest 30 and 90 days back, within 12 days. Nightly copies only began on 2 Oct 2026; before that there are copies from 23–24 Jul and 11 Aug. '
         f'So for {EX} the 30- and 90-day cells are N/A, and the page shows the change since {meta["first_copy_label"]}, saying how many days that really is. The columns fill in as nights accumulate.'),
        ("The two models.", f'Short text: {mod["models"]["short_text"]} reads each sentence ({took["finbert_sentences"]:,} for {EX}, {took["finbert_sections_s"]:.0f} seconds). '
         f'Long text: {mod["models"]["long_text"]} reads each passage of about 450 words ({took["qwen_passages"]} passages, {took["qwen_s"]:.0f} seconds) and says its tone, its topic and its point, then writes the drivers and risks from those points. '
         'Both ran on this MacBook\'s graphics chip. No paid model was called. ' + checked),
        ("What could be wrong.", '(1) The estimates are FMP\'s; Alan has called them weak, and for a company four months public a handful of analysts is the whole consensus. '
         f'(2) Shares: the vendor\'s share field for {EX} is Class A only, although the vendor\'s own market value does count every class; the Hub rule divides one vendor table\'s market value by its price and lands about {abs(p["shares"] / fil["facts"]["quarterly"]["cover_shares"]["total"] - 1) * 100:.0f}% above the 10-Q cover. Every multiple on this page uses the Hub rule, so that it matches the COMPS tab. '
         '(3) A risk-factors section reads negative for every company — its tone says how it is written, not how the business is doing; compare it with another company\'s, not with zero. '
         '(4) The long-text model was measured on news and video only (81% and 67% right, SM1); on filings it is unmeasured, and it does make mistakes — see the struck lines. '
         '(5) The filing reader finds sections by their headings; it missed the management discussion in SHAZ\'s 10-Q and USAR\'s 10-K, and it has no rule yet for a company that came public by merger. '
         f'(6) Our first-daily-bar table covers 349 of the tree\'s names; for the rest "listed under 2 years" rests on the vendor\'s IPO date. '
         '(7) The trailing cut also catches settled companies in a depressed year (ABBV, MRK): true by the rule, but a comps reading on forward numbers still works for them. '
         f'(8) {len(path["other_currency"])} companies report in another currency ({other}); no price-based multiple is computed for them here.'),
        ("What was not done.", f'No table was created or written; the three tables are a proposal. Nothing was deployed and the live Hub is untouched. The filings and the models were run for the {path["reasons"]["NEW_LISTING"]} new listings only; '
         f'the other names on the list have the estimates panel as numbers in the table. The {path["rungs"]["MODELS_AND_QUARTERLIES"] - 1} thin-coverage names other than SHAZ were not model-read. '
         'There is no consensus for capital spending, so "is the spending covered by cash" uses the last quarter\'s rate times four. Nothing was timed on Fly.'),
        ("Colour.", 'Grey everywhere; green and red only for the sign of earnings and for positive and negative tone, the house pair. Every coloured mark also carries its number or a word.'),
        ("Files.", 'data/path.json (the list and every panel), data/filings/, data/models/ (each passage\'s reading is in the .passages.ndjson files), data/quarters.json, data/ipo_lockups.json, data/fmp-leg-proof.json. '
         'Rebuild the page with tools/build_page.py. The job is services/estimates-path/ on provider/np1-estimates-path-20261006. Test: tests/np1-estimates-path-20261006.test.mjs.'),
    ]




def build():
    path = load("path.json")
    names = {p["ticker"]: p for p in path["path"]}
    p = names[EX]
    fil = load("filings", f"{EX}.filings.json")
    mod = load("models", f"{EX}.models.json")
    checks = {c["claim"].strip(): c for c in (load("models", f"{EX}.checks.json")["claims"] if have("models", f"{EX}.checks.json") else [])}
    locks = {r["ticker"]: r for r in load("ipo_lockups.json")}
    quarters = load("quarters.json")[EX]
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
        "fly_label": (f'{len(leg["names"])} names, {sum(len(n["errors"]) for n in leg["names"])} errors, {leg["fetched_utc"][11:16]} UTC on 6 Oct, machine removed after') if leg else "not run",
    }
    o = []

    o.append(f'<span data-scnav-slot></span><h1>NP1 · NAMES COMPS CANNOT PRICE</h1>'
             f'<p class="sub">6 Oct 2026 close · {path["universe"]["companies"]} companies checked · nothing on the Hub changed · branch hub/np1-estimates-path-20261006</p>')
    o.append('<div class="kpi">'
             f'<div><b>{path["universe"]["on_path"]}</b><span>of {path["universe"]["companies"]} companies go on the estimates path</span></div>'
             f'<div><b>{path["reasons"]["NEW_LISTING"]}</b><span>listed under 2 years</span></div>'
             f'<div><b>{path["reasons"]["NO_TRAILING_EARNINGS"]}</b><span>made a loss over the last 12 months</span></div>'
             f'<div><b>{mult(cut_f, 0)}</b><span>forward P/E cut today · {path["reasons"]["FORWARD_PE_ABOVE_CUT"]} names above it</span></div>'
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
             f'<dt>cut</dt><dd>{mult(cut_f, 0)}</dd></dl></div></div>')

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

    qrows = "".join(f'<tr><td class="nw">{e(q["label"])}</td><td class="r">{money(q["rev"])}</td><td class="r">{pct(q["yoy"])}</td><td class="r">{pct(q["gm"])}</td><td class="r">{money(q["oi"])}</td>'
                    f'<td class="r">{money(q["ni"])}</td><td class="r">{num(q["eps"])}</td><td class="r">{money(q["ocf"])}</td><td class="r">{money(q["capex"])}</td><td class="r">{money(q["sbc"])}</td></tr>' for q in quarters)
    o.append('<div class="blk" style="margin-top:22px"><h3>THE QUARTERLY REPORTS</h3><div class="wrap"><table><tr><th>quarter</th><th class="r">sales</th><th class="r">vs a year ago</th><th class="r">gross margin</th>'
             '<th class="r">operating result</th><th class="r">net result</th><th class="r">EPS</th><th class="r">cash from operations</th><th class="r">plant and equipment</th><th class="r">pay in stock</th></tr>' + qrows + '</table></div></div>')

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

    # ---- the new listings
    o.append(f'<h2>THE {path["reasons"]["NEW_LISTING"]} NEW LISTINGS · WHAT WAS READ</h2><div class="wrap"><table><tr><th>ticker</th><th class="r">since</th><th>prospectus</th><th>latest report</th>'
             '<th class="r">shares, filing</th><th class="r">vendor field</th><th class="r">cash</th><th class="r">quarters</th><th class="r">lock-up</th>'
             '<th class="r">risk factors</th><th class="r">management</th><th class="r">call</th></tr>')
    for r in [x for x in lst if "NEW_LISTING" in x["reasons"]]:
        tk = r["ticker"]
        f = load("filings", f"{tk}.filings.json") if have("filings", f"{tk}.filings.json") else None
        mo = load("models", f"{tk}.models.json") if have("models", f"{tk}.models.json") else None
        pk = (f or {}).get("picked", {})
        reps = sorted([(pk[k]["filed"], k) for k in ("quarterly", "annual") if pk.get(k)], reverse=True)       # the newer report first
        rep = pk[reps[0][1]] if reps else None
        fc = (f or {}).get("facts", {})
        cover = next((fc[k]["cover_shares"] for _, k in reps if (fc.get(k) or {}).get("cover_shares")), None)
        ch = fc.get("cash") or {}
        def net(key):
            if not mo: return ""
            s = [x for x in mo["sections"] if key in x["section"].lower() and x.get("qwen")]
            if not s: return ""
            q = s[0]["qwen"]; n_ = q["read"] or 1; v = (q["positive"] - q["negative"]) / n_
            return f"{abs(v) * 100:.0f}% {'neg' if v < 0 else 'pos'}" if v else "even"
        lk_ = locks.get(tk)
        cells = [
            f'<td class="tk">{e(tk)}</td>', f'<td class="r">{e(day(r["listed"]["on"], short=True))}</td>',
            f'<td class="nw">{e(pk["prospectus"]["form"] + " · " + day(pk["prospectus"]["filed"], short=True)) if pk.get("prospectus") else e(meta["no_prospectus"].get(tk, "none found"))}</td>',
            f'<td class="nw">{e(rep["form"] + " · " + day(rep["filed"], short=True)) if rep else ""}</td>',
            f'<td class="r">{cover["total"] / 1e6:,.1f}M</td>' if cover else '<td class="r"></td>',
            f'<td class="r">{r["shares_profile"] / 1e6:,.1f}M</td>' if r.get("shares_profile") else '<td class="r"></td>',
            f'<td class="r">{money(ch.get("liquid"))}</td>',
            f'<td class="r">{ch["quarters_of_cash"]:.1f}</td>' if ch.get("quarters_of_cash") else '<td class="r"></td>',
            f'<td class="r">{e(day(lk_["unlock_date"], short=True)) if lk_ and lk_.get("unlock_date") else ""}</td>',
            f'<td class="r nw">{net("risk factors")}</td>', f'<td class="r nw">{net("management")}</td>', f'<td class="r nw">{net("prepared remarks")}</td>']
        o.append(f'<tr{" class=ex" if tk == EX else ""}>' + "".join(cells) + '</tr>')
    o.append('</table></div>')
    for r in [x for x in lst if "NEW_LISTING" in x["reasons"] and x["ticker"] != EX]:
        tk = r["ticker"]
        if not have("models", f"{tk}.models.json"): continue
        mo = load("models", f"{tk}.models.json")
        o.append(f'<details class="more"><summary>{e(tk)} · {e(r["name"])}</summary><div class="sent" style="margin-top:10px">'
                 + "".join(f'<div><div class="nm">{e(s["section"])}</div><div class="w">{s["words"]:,} words</div></div><div>{tone_rows(s)}</div>' for s in mo["sections"])
                 + '</div><div class="grid">' + "".join(said(s, {}) for s in mo["sections"]) + '</div></details>')

    # ---- proposed table
    o.append('<h2>PROPOSED TABLES · NOTHING WRITTEN</h2><div class="wrap"><table><tr><th>table</th><th>one row is</th><th>it holds</th><th class="r">rows a night</th></tr>'
             f'<tr><td class="tk">estimates_path</td><td>a company on a day</td><td>on the path or not, the reasons, price, shares, enterprise value, next-12-month sales and EPS, the multiples, analysts, target, revisions, the two cuts</td><td class="r">{path["universe"]["companies"]}</td></tr>'
             '<tr><td class="tk">filing_facts</td><td>a filing we read</td><td>shares by class with the sentence, sales mix, customers, gross margin, cash, cash burn, the offering, the lock-up sentence</td><td class="r">new filings only</td></tr>'
             '<tr><td class="tk">filing_model_reads</td><td>a section of a filing or call</td><td>sentences positive / negative, passages positive / negative, topics, the drivers and risks the model wrote, the model names, seconds</td><td class="r">new filings and calls only</td></tr></table></div>'
             '<p class="small">services/estimates-path/sql/0001_estimates_path.sql and its rollback, on the provider branch. Three new tables, row security on, no reader yet.</p>')

    # ---- time
    o.append('<h2>MODEL RUNS · TIME ON THIS MACBOOK</h2><div class="wrap"><table><tr><th>ticker</th><th class="r">sentences</th><th class="r">seconds, short-text model</th><th class="r">passages</th>'
             '<th class="r">seconds, long-text model</th><th class="r">headlines</th><th class="r">whole run</th></tr>')
    tot = [0, 0, 0, 0, 0]
    for r in [x for x in lst if "NEW_LISTING" in x["reasons"]]:
        tk = r["ticker"]
        if not have("models", f"{tk}.models.json"): continue
        k = load("models", f"{tk}.models.json"); tk_ = k["took"]
        tot = [tot[0] + tk_["finbert_sentences"], tot[1] + tk_["finbert_sections_s"], tot[2] + tk_["qwen_passages"], tot[3] + tk_["qwen_s"], tot[4] + tk_["total_s"]]
        o.append(f'<tr{" class=ex" if tk == EX else ""}><td class="tk">{e(tk)}</td><td class="r">{tk_["finbert_sentences"]:,}</td><td class="r">{tk_["finbert_sections_s"]:.0f}</td><td class="r">{tk_["qwen_passages"]}</td>'
                 f'<td class="r">{tk_["qwen_s"]:.0f}</td><td class="r">{k["headlines"]["n"]}</td><td class="r">{tk_["total_s"] / 60:.1f} min</td></tr>')
    o.append(f'<tr><td>all</td><td class="r">{tot[0]:,}</td><td class="r">{tot[1]:.0f}</td><td class="r">{tot[2]}</td><td class="r">{tot[3]:.0f}</td><td class="r"></td><td class="r">{tot[4] / 60:.1f} min</td></tr></table></div>')
    o.append(f'<p class="small">Long text: {e(mod["models"]["long_text"])}. Short text: {e(mod["models"]["short_text"])}. Headlines also: {e(mod["models"]["headlines"])}. '
             f'Keyed pull on a throw-away Fly machine: {e(meta["fly_label"])}.</p>')

    # ---- calls
    o.append('<h2>CALLS FOR ALAN</h2><ol class="calls">' + "".join(f'<li><b>{e(a)}</b><span>{e(b)}</span></li>' for a, b in calls(path, p, fil, price)) + '</ol>')

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

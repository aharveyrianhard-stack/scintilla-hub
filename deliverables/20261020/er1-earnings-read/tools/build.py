#!/usr/bin/env python3
"""ER1 · the earnings read, 13–20 Oct 2026. Assembles EARNINGS-READ-20261020.json and the self-contained page
EARNINGS-READ-20261020.html from: notes/ (the lane's own reading of the 28 stored calls, one JSON per batch), raw/fmp (FMP answers
through the project's fmp-proxy door, fetched 20 Oct 2026), raw/candles (house chart API), raw/supabase (earnings_events, the
transcript index and watch table, the tickers universe), tools/reactions.json and tools/calendar.json. Pictures are inline SVG drawn
here (no plotting library on this Mac); PAGE SPECS folded at the bottom. No script beyond a ready flag; no network.
usage: python3 build.py <deliverable dir>"""
import json, os, sys, glob, html, datetime as dt
D = sys.argv[1]
def J(*p): return json.load(open(os.path.join(D, *p)))
def esc(s): return html.escape(str(s)) if s is not None else ""

notes = {}
for f in sorted(glob.glob(os.path.join(D, "notes", "batch*.json"))): notes.update(json.load(open(f)))
reporters = J("tools", "reporters.json"); reactions = J("tools", "reactions.json"); calendar = J("tools", "calendar.json")
events = J("raw", "supabase", "earnings_events_window.json"); tindex = J("raw", "supabase", "transcripts_index.json"); watch = J("raw", "supabase", "transcript_watch.json")
fetch_start = open(os.path.join(D, "raw", "fmp", "_fetch_started_utc.txt")).read().strip(); fetch_end = open(os.path.join(D, "raw", "fmp", "_fetch_ended_utc.txt")).read().strip()

def fmp_body(name):
    body = open(os.path.join(D, "raw", "fmp", name)).read().rsplit("\n", 1)
    return json.loads(body[0]), body[1].strip()
def fmp_earnings(t, date):
    rows, status = fmp_body("earnings_%s.json" % t)
    row = next((r for r in rows if r["date"] == date), None)
    return row, rows, status
def fmp_quote(t):
    rows, status = fmp_body("quote_%s.json" % t); return rows[0], status

# FMP comparability flags, from reading the rows against the calls
FLAGS = {
 "PLD": {"revenue": None, "eps": "FMP's 'EPS' actual is core FFO per share ($1.60) while its estimate ($0.78) is a GAAP-EPS figure: not like for like."},
 "SYF": {"revenue": "FMP's revenue actual ($4.91B) is gross interest and fees; the estimate ($3.81B) is net revenue: not like for like.", "eps": None},
 "ASML": {"revenue": "FMP converts the euro figures to dollars; the company reported €11.7B, a record and the high end of its guidance.", "eps": None},
 "TSM": {"revenue": "ADR basis in dollars; the company's own figure is $46.7B.", "eps": None},
 "JPM": {"eps": "The call's own EPS is $5.57 after $658M of net investment-securities losses; FMP shows $5.75.", "revenue": None},
 "BAC": {"eps": "FMP's $1.08 is the figure excluding the $1.2B regulatory settlement; reported EPS was $0.91.", "revenue": None},
 "PGR": {"eps": "The Hub's earnings_events row carries an earlier FMP answer ($1.08 vs $4.35, $7.2B vs $22.6B) that FMP has since corrected; the page uses today's FMP answer.", "revenue": None},
}
def money(v):
    if v is None: return "no estimate"
    a = abs(v); s = "−" if v < 0 else ""
    if a >= 1e9: return f"{s}${a/1e9:.2f}B"
    if a >= 1e6: return f"{s}${a/1e6:.0f}M"
    return f"{s}${a:,.0f}"
def pct(v, signed=True):
    if v is None: return "—"
    return f"{v:+.1f}%" if signed else f"{v:.1f}%"
def surprise(a, e):
    if a is None or e in (None, 0): return None
    return (a / e - 1) * 100 if e > 0 else None

BANKS = ["JPM", "C", "GS", "WFC", "BAC", "BLK", "MS", "BNY", "PNC", "SCHW", "USB", "SFNC", "SYF"]
REST = ["JNJ", "UNH", "DPZ", "ASML", "FAST", "PGR", "MRSH", "PLD", "TSM", "TRV", "CLF", "STLD", "GE", "GM", "MMM", "NOC", "RTX"]
ORDER = BANKS + REST
assert set(ORDER) == set(notes), set(ORDER) ^ set(notes)

ONE_LINERS = {
 "JPM": "Missed on EPS ($5.75 vs $5.93) with securities losses; first 2027 NII ex-markets case ~$107B; buyback cut to $1B to redeploy capital; Dimon tightening credit terms.",
 "C": "Best third-quarter revenue in a decade and a beat; full-year ROTCE raised to above 11%; Fraser: AI investment 'not slowing', compute and energy the bottleneck; sold off on a 'lousy' implied Q4.",
 "GS": "EPS $17.01 vs $12.86, equities +72%, alts fundraising to $150B; Solomon: the environment went from top-decile to top-quartile, and nobody knows if financing is the AI choke point.",
 "WFC": "In line; the markets miss came in the last weeks of September as rates jumped; consumer spend +12% on cards with charge-offs down; agents moving deposits 'completely overdone'.",
 "BAC": "$1.2B AML settlement plus FICC −17% on an 85bp rate move; 2027 NII '8% or more' assuming hikes in December, March and June; credit the cleanest since 2019.",
 "BLK": "Record revenue, margin and EPS on $205B of inflows; Fink: 'genuine shortages of capital' for the first time in 50 years, rates higher for longer, compute to become an asset class.",
 "MS": "Beat on record wealth flows ($232B) and equities +41%; Pick frames the quarter as glass half full vs half empty and says MS is 'double overweight' AI, mistakes included.",
 "BNY": "EPS +24%, operating-leverage guide lifted to ~500bp, tokenised money funds live, 400-plus AI applications in production.",
 "PNC": "Beat; loans +14% year to date with half of the quarter's growth in its last two weeks; agrees with ~$1B of 2027 NII growth; Demchak: agents moving money 'not going to happen on my watch'.",
 "SCHW": "Record revenue, $190B of net new assets, ~800bp of operating leverage; blocks unauthorised agents, first custodian in Claude for Financial Advisors; AI-using clients hold more cash.",
 "USB": "Beat and a raised revenue guide; buybacks paused on the AOCI hit and loan growth, back within two quarters; the stablecoin pilot has 'client curiosity', not demand.",
 "SFNC": "In line; the balance sheet shrank by choice because 'risk spreads are being competed away' and brokered deposits now cost 30bp more than FHLB advances.",
 "SYF": "Beat, full-year EPS to ~$9.50 at the top of the range; spend +8% with gas and discount stores leading; the CFO named 'a war in Iran' among the things January did not know.",
 "JNJ": "Pharma +7.9% carried a MedTech miss; full-year guide raised toward the first $100B year; the Middle East is now a named drag on device tenders.",
 "UNH": "$4.69 vs $4.14; full-year at least $20.50 and 'consensus may understate' 2027; commercial trend above 11% but not accelerating; the stock is up 11% since.",
 "DPZ": "Beat, but US comps +0.3% and the store guide cut again; order counts up, items per order down, 'consumers remain under pressure'; leverage to run below 4× as rates rise.",
 "ASML": "Record quarter and a 2026 guide of +36% with memory tools +75%; customers see shortage through at least 2028, 2029–30 orders are arriving, and prices were raised for the first time.",
 "FAST": "Sales +15.5% and the biggest operating-income gain in its history; data centres 4–5 points of growth; AI tools replacing branch headcount.",
 "PGR": "EPS beat on FMP's corrected row; no call stored; personal-auto pricing is turning negative at Travelers.",
 "MRSH": "Beat, Thrive savings raised to $600M; commercial insurance pricing −5% and property −10%; a $10B insurance facility for operating data centres.",
 "PLD": "Same-store and development guides up, but 'the abrupt shift in the interest rate environment' widens the bid-ask and pressures values; 5.8GW data-centre pipeline.",
 "TSM": "Beat; Q4 guided +58% y/y and 2026 to ~44%; capex going up again, N2 capacity doubling; demand 'extremely robust' while consumer end-markets are 'being challenged'.",
 "TRV": "$9.18 vs $7.39, core ROE 22%, record investment income with 2027 NII above $3B; unrealised losses tripled to $6.4B on rates; pricing 'stable', auto slightly negative.",
 "CLF": "EBITDA more than doubled quarter on quarter, 2027 seen above $4B; contracts moving to take-or-pay index with lower discounts; 'the problem is having access to steel'.",
 "STLD": "EPS miss, revenue beat; the call is this morning and the transcript was not yet stored.",
 "GE": "Beat and raise across the board with 2027 services growth 'low double digits', yet the stock fell: the first question was $111 Brent and airline profitability.",
 "GM": "Record revenue and a $20B buyback, cash guide up, but copper, steel and DRAM inflation is 'intensifying' and 2027 growth is now conditional on it moderating.",
 "MMM": "Beat and raise; an Amazon warrant tied to $6B of data-centre sales and the optical connector set to double; orders +7%, consumer electronics down mid-teens.",
 "NOC": "Beat; 2027 sales +5–7% with acceleration in 2028 on a $110B backlog; a strategic review of its quantum and microelectronics technology with 'everything on the table'.",
 "RTX": "$2.26 vs $1.78 and a $340B backlog after ~$70B of munitions contracts; the AI build-out is hoarding circuit boards and passives the defence supply chain needs.",
}

SEASON = {
 "headline": "HEADLINE_PLACEHOLDER",
 "blocks": [
  ["Demand", "Strong wherever AI touches it: TSMC guides Q4 +58% y/y and 2026 to ~44%, ASML's memory tool sales are up 75% with customers short through 2028, Fastenal gets 4–5 points of growth from data centres, the data-centre supply chain is 17% of Prologis's US leasing, 3M's data-centre revenue is ~$700M and Amazon just took a warrant on it. Industrial demand is improving (US PMI ~55, 3M orders +7%, US and Canada +7%). Aerospace and defence backlogs are records (GE orders +49%, RTX $340B, NOC $110B) with a decade of munitions now contracted. Consumer-facing demand is the soft spot: Domino's basket shrinking, consumer electronics down mid-teens at 3M, TSMC calling price-sensitive segments 'challenged', JNJ's devices soft outside the US."],
  ["Pricing", "Whoever owns the scarce thing is raising price: ASML's first-ever price increase, TSMC's 'strategic' pricing by node and location, Cleveland-Cliffs' index up ~$40/t a month with take-or-pay minimums, aerospace aftermarket price at GE and RTX. Whoever buys those inputs is absorbing it: GM's commodity, logistics and DRAM headwind is ~$2B this year and could be another ~$2B in 2027; 3M is passing $185M of oil inflation through. Insurance is the exception, with Marsh's index −5%, property −10% and Travelers cutting personal-auto rates. Diesel and logistics surcharges arrive within weeks (GM, Fastenal)."],
  ["AI capex", "The scale is now stated by the financiers: hyperscaler capex ~$1 trillion a year (Morgan Stanley), a US data-centre build that could need over $10 trillion through 2032 (Goldman), $7–9 trillion of US power, grid and shell (BlackRock). The money is flowing through bank windows (SK hynix's record equity raise, SoftBank's $11B high-yield deal, Meta's $14B Texas data centre, Aligned at ~$40B) and the warnings are unanimous and specific: Dimon (nobody is immune to a sentiment change), Solomon (a recalibration 'for sure', neo-clouds price differently from hyperscalers), Pick ('we are going to make mistakes'), Fink (bespoke deals cannot fund trillions; compute must be securitised). The build-out is already crowding out: RTX cannot get circuit boards and passives, Prologis's and Fastenal's customers compete for the same construction labour, and chips are supply-bound through 2028."],
  ["Credit", "The cleanest numbers in years: BofA's criticised commercial assets at the lowest since 2019, Wells' early-stage delinquencies at historic lows, Synchrony's charge-offs down to 4.79%, US Bancorp's card FICOs improving, CRE office at 'the very tail end'. The cracks are at the edges and in the terms: Dimon says covenants got loose and is tightening, Goldman took idiosyncratic impairments, PNC's non-performers rose 8% on one credit, Simmons says risk spreads are being 'competed away' and wholesale funding is 30bp dearer. The rate move did the real damage through AOCI: it paused US Bancorp's buyback, cut CET1 at BofA, PNC and Wells, and tripled Travelers' unrealised loss to $6.4B."],
  ["Consumer", "Spending is up everywhere it is measured (JPM debit and credit +10%, Wells +8% and +12%, BofA +5%, Synchrony +8%, GM's SAAR in the upper 16 millions) and paychecks are growing in every income band. Underneath: gasoline spend up ~20% is crowding out a little, baskets are shrinking (Domino's items per order, Synchrony's discount-store growth), Domino's and GM both say sentiment surveys have 'disconnected' from behaviour, and every bank repeats the same conditional: fine as long as employment holds. Holiday: Synchrony sees October tracking the Q3 exit rate and retailers planning earlier, heavier promotions."],
  ["Rates and the backdrop", "The Fed hiked in September 2026 for the first time in three years; rates rose ~85bp in the quarter and the ten-year sits near 5% with real rates near 3%. Banks now write further hikes into guidance (BofA: December, March, June; PNC: December, March; JPM: one in December and two in the first half). Brent is ~$111 and the Middle East conflict (Synchrony's CFO called it 'a war in Iran') is a named drag at JNJ, Marsh, GM International and Domino's. IEEPA tariff refunds are flowing back (RTX $0.25 of EPS, GM $600–800M of cash). The reaction pattern: beat-and-raise on AI, defence or steel demand was bought (MMM, NOC, CLF, MRSH, BNY, USB); beats exposed to rates or oil were sold (GE, C, BAC, JNJ, ASML, PLD, SCHW)."],
 ]}

# ---------- assemble per-reporter records ----------
records = []
for t in ORDER:
    rp = next(r for r in reporters if r["ticker"] == t); n = notes[t]; rx = reactions[t]
    row, allrows, st = fmp_earnings(t, rp["report_date"]); q, qst = fmp_quote(t)
    ev = next((e for e in events if e["ticker"] == t and e["date"] == rp["report_date"]), None)
    ti = next((x for x in tindex if x["ticker"] == t), None); w = next((x for x in watch if x["ticker"] == t), None)
    eps_a, eps_e = (row or {}).get("epsActual"), (row or {}).get("epsEstimated"); rev_a, rev_e = (row or {}).get("revenueActual"), (row or {}).get("revenueEstimated")
    fl = FLAGS.get(t, {})
    rec = {"ticker": t, "name": n["name"], "group": n["group"], "report_date": rp["report_date"], "report_time": rp["report_time"], "no_call": n.get("no_call", False),
           "fmp": {"eps_actual": eps_a, "eps_estimate": eps_e, "eps_surprise_pct": None if fl.get("eps") and t in ("PLD",) else surprise(eps_a, eps_e), "eps_beat": (eps_a > eps_e) if (eps_a is not None and eps_e is not None) else None,
                   "revenue_actual": rev_a, "revenue_estimate": rev_e, "revenue_surprise_pct": None if fl.get("revenue") and t in ("SYF",) else surprise(rev_a, rev_e), "revenue_beat": (rev_a > rev_e) if (rev_a is not None and rev_e is not None) else None,
                   "last_updated": (row or {}).get("lastUpdated"), "fetched_utc_window": [fetch_start, fetch_end], "flags": {k: v for k, v in fl.items() if v}, "quote": q},
           "hub_earnings_events_row": ev, "transcript": {"stored": ti is not None, "quarter": ti and ti["quarter"], "call_date": ti and ti["call_date"], "stored_utc": ti and ti["updated_ts"], "chars": None, "watch_status": w and w.get("status"), "watch_note": w and w.get("note")},
           "reaction": rx, "one_liner": ONE_LINERS[t], "numbers_line": n["numbers_line"], "guidance": n["guidance"], "call_said": n["call_said"], "quote": n.get("quote"), "read_through": n["read_through"]}
    records.append(rec)
# transcript lengths from the index are not stored; the lane's reading used the full text (40–79k chars each), lengths kept here
CHARS = {"C":74478,"DPZ":49164,"GS":66590,"JNJ":58496,"JPM":56024,"UNH":55573,"WFC":69346,"ASML":52125,"BAC":78840,"BLK":54024,"FAST":44406,"MS":62269,"BNY":56859,"MRSH":54283,"PLD":37224,"PNC":46763,"SCHW":54243,"TSM":46717,"USB":53135,"SFNC":44083,"TRV":57578,"CLF":44534,"GE":45719,"GM":55244,"MMM":61872,"NOC":48028,"RTX":53744,"SYF":55636}
for r in records: r["transcript"]["chars"] = CHARS.get(r["ticker"])

beats = sum(1 for r in records if r["fmp"]["eps_beat"]); down = sum(1 for r in records if (r["reaction"].get("reaction_pct") or 0) < 0)
SEASON["counts"] = {"reporters": len(records), "eps_beats": beats, "down_on_reaction_day": down, "calls_read": sum(1 for r in records if not r["no_call"])}
SEASON["headline"] = f"Beats everywhere, selling almost everywhere: {down} of {len(records)} reporters fell on reaction day while EPS beat FMP's estimate at {beats} of them (PLD's beat is not like for like). The market is paying for demand it can see (data centres, munitions, steel) and selling anything the September rate shock or $111 oil can touch."

# ---------- SVG pictures ----------
def bar_chart(items, title, subtitle, fmt, width=1240, lo=None, hi=None, markers=None):
    # items: list of (label, value, sublabel, color)
    n = len(items); bw = (width - 120) / n; h = 420; top = 70; base = 330
    vals = [v for _, v, _, _ in items if v is not None]
    lo = min(lo if lo is not None else 0, min(vals)); hi = max(hi if hi is not None else 0, max(vals))
    rng = (hi - lo) or 1; scale = (base - top) / rng
    def y(v): return base - (v - lo) * scale
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {h}" width="100%" role="img" aria-label="{esc(title)}" style="font:12px -apple-system,Helvetica,Arial,sans-serif">']
    out.append(f'<text x="60" y="26" fill="#e6e9ef" font-size="17" font-weight="700">{esc(title)}</text><text x="60" y="46" fill="#9aa3b2">{esc(subtitle)}</text>')
    # gridlines
    step = 5 if rng > 20 else (2 if rng > 8 else 1)
    g = int(lo // step) * step
    while g <= hi + 1e-9:
        yy = y(g); out.append(f'<line x1="60" x2="{width-60}" y1="{yy:.1f}" y2="{yy:.1f}" stroke="#263040" stroke-width="1"/><text x="54" y="{yy+4:.1f}" fill="#9aa3b2" text-anchor="end">{g:+d}%</text>')
        g += step
    out.append(f'<line x1="60" x2="{width-60}" y1="{y(0):.1f}" y2="{y(0):.1f}" stroke="#9aa3b2" stroke-width="1.2"/>')
    for i, (lab, v, sub, col) in enumerate(items):
        x = 60 + i * bw
        if v is None:
            out.append(f'<text x="{x+bw/2:.1f}" y="{y(0)-6:.1f}" fill="#9aa3b2" text-anchor="middle" font-size="10">n/a</text>')
        else:
            y0, y1 = sorted([y(0), y(v)]); out.append(f'<rect x="{x+3:.1f}" y="{y0:.1f}" width="{bw-6:.1f}" height="{max(1,y1-y0):.1f}" fill="{col}" rx="2"/>')
            ty = y(v) - 5 if v >= 0 else y(v) + 13; out.append(f'<text x="{x+bw/2:.1f}" y="{ty:.1f}" fill="#e6e9ef" text-anchor="middle" font-size="10.5" font-variant-numeric="tabular-nums">{fmt(v)}</text>')
        if markers and markers[i] is not None:
            my = y(markers[i]); out.append(f'<line x1="{x+6:.1f}" x2="{x+bw-6:.1f}" y1="{my:.1f}" y2="{my:.1f}" stroke="#00d4ff" stroke-width="2"/>')
        out.append(f'<text x="{x+bw/2:.1f}" y="{base+18}" fill="#e6e9ef" text-anchor="middle" font-weight="700" font-size="11.5">{esc(lab)}</text><text x="{x+bw/2:.1f}" y="{base+32}" fill="#9aa3b2" text-anchor="middle" font-size="9.5">{esc(sub)}</text>')
    if markers: out.append(f'<line x1="{width-250}" x2="{width-230}" y1="{h-14}" y2="{h-14}" stroke="#00d4ff" stroke-width="2"/><text x="{width-224}" y="{h-10}" fill="#9aa3b2">SPY, same day</text>')
    out.append("</svg>"); return "".join(out)

ordered_by_date = sorted(records, key=lambda r: (r["reaction"]["reaction_day"], r["ticker"]))
react_items = [(r["ticker"], r["reaction"].get("reaction_pct"), r["reaction"]["reaction_day"][5:].replace("-", "/") + ("*" if r["reaction"]["reaction_close"] is None else ""), "#199e70" if (r["reaction"].get("reaction_pct") or 0) >= 0 else "#e66767") for r in ordered_by_date]
react_markers = [r["reaction"]["spy_same_days"]["reaction_pct"] for r in ordered_by_date]
PIC1 = bar_chart(react_items, "Reaction day: close vs prior close, 30 reporters, 13–20 Oct 2026", "House chart API daily candles; * = 20 Oct names read from the intraday FMP quote at 16:33 UTC, not a close. Cyan tick = SPY the same day.", lambda v: f"{v:+.1f}", markers=react_markers)
since_items = [(r["ticker"], r["reaction"].get("total_pct"), r["reaction"]["reaction_day"][5:].replace("-", "/"), "#199e70" if (r["reaction"].get("total_pct") or 0) >= 0 else "#e66767") for r in ordered_by_date]
PIC2 = bar_chart(since_items, "Prior close to now: the whole move since the print", "Latest price from the FMP quote (20 Oct 2026, 16:33 UTC, intraday) vs the close before the reaction day.", lambda v: f"{v:+.1f}")
surp_items = [(r["ticker"], r["fmp"]["eps_surprise_pct"], f'{r["fmp"]["eps_actual"]} v {r["fmp"]["eps_estimate"]}' if r["fmp"]["eps_estimate"] is not None else "no estimate", "#3987e5" if (r["fmp"]["eps_surprise_pct"] or 0) >= 0 else "#c98500") for r in ordered_by_date]
PIC3 = bar_chart(surp_items, "EPS vs the estimate, FMP (fetched 20 Oct 2026)", "Actual / estimate − 1. PLD left out as not like for like (core FFO vs a GAAP estimate). Capped at +40% for the picture; GS +32%, TRV +24%, RTX +27%, PLD n/a.", lambda v: f"{v:+.0f}", hi=40)
for it in surp_items: pass

# ---------- HTML ----------
css = """
:root{--bg:#0a0e14;--card:#0e131b;--line:#263040;--ink:#e6e9ef;--ink2:#9aa3b2;--cyan:#00d4ff;--up:#199e70;--down:#e66767;--amber:#c98500;--blue:#3987e5}
*{box-sizing:border-box} html{scroll-behavior:auto}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 -apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif;padding:0 16px 48px}
header{max-width:1240px;margin:0 auto;padding:22px 0 6px} main{max-width:1240px;margin:0 auto}
h1{font-size:25px;margin:0 0 6px;font-weight:700;line-height:1.2} h2{font-size:19px;margin:30px 0 10px} h3{font-size:16px;margin:0 0 4px} h4{font-size:12.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink2);margin:14px 0 6px}
.lede{color:var(--ink2);max-width:1100px} .lede b{color:var(--ink)}
.pic{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin:14px 0} .pic svg{display:block}
table{border-collapse:collapse;width:100%;font-size:13px;font-variant-numeric:tabular-nums} th{background:#121a25;color:var(--ink2);font-weight:600;text-align:right;padding:7px 9px;white-space:nowrap;position:sticky;top:0;z-index:1} th:first-child,td:first-child{text-align:left}
td{padding:7px 9px;border-top:1px solid var(--line);text-align:right;vertical-align:top} td.l{text-align:left} td.line{text-align:left;white-space:normal;color:var(--ink2);min-width:360px} td.line b{color:var(--ink)}
.up{color:var(--up)} .down{color:var(--down)} .na{color:var(--ink2)} .flag{display:inline-block;font-size:10.5px;color:var(--amber);border:1px solid var(--amber);border-radius:4px;padding:0 5px;margin-left:4px;white-space:normal}
.wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px} 
section.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px 18px 12px;margin:18px 0}
.head{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 14px} .head .tk{font-size:22px;font-weight:800;letter-spacing:.02em} .head .nm{color:var(--ink2);font-size:15px} .head .when{color:var(--ink2);font-size:12.5px;margin-left:auto}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:12px 0 4px} .kpis div{background:#0a0e14;border:1px solid var(--line);border-radius:8px;padding:8px 10px} .kpis span{display:block;color:var(--ink2);font-size:11px;letter-spacing:.04em;text-transform:uppercase} .kpis b{display:block;font-size:17px;margin-top:2px} .kpis small{display:block;color:var(--ink2);font-size:10.5px;margin-top:2px}
.num{margin:10px 0 0;font-size:14.5px} .guid{color:var(--ink);margin:6px 0 0} ol.said{padding-left:20px;margin:6px 0 0} ol.said li{margin:5px 0} blockquote{margin:12px 0 4px;border-left:3px solid var(--cyan);padding:2px 0 2px 12px;color:var(--ink);font-style:italic} .rt{margin-top:10px;padding:8px 10px;background:#0a0e14;border:1px solid var(--line);border-radius:8px} .rt b{color:var(--cyan)}
.season{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:14px;margin-top:12px} .season .block{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px} .season .block h3{color:var(--cyan)} .season .block p{margin:4px 0 0;color:var(--ink)}
.headline{font-size:16px;background:var(--card);border:1px solid var(--line);border-left:3px solid var(--cyan);border-radius:10px;padding:12px 16px;margin-top:12px}
.cal td.l small{color:var(--ink2)} .unc{color:var(--amber)}
details{margin-top:36px;border-top:1px solid var(--line);padding-top:12px;color:var(--ink2)} summary{cursor:pointer;color:var(--ink);font-weight:600} details ul{padding-left:20px} details code{color:var(--ink)}
a{color:var(--cyan);text-decoration:none} .mono{font-family:ui-monospace,Menlo,monospace;font-size:12px}
@media (max-width:700px){h1{font-size:21px} .head .when{margin-left:0} td.line{min-width:240px}}
"""
def react_cell(r):
    rx = r["reaction"]; v = rx.get("reaction_pct")
    if v is None: return '<span class="na">—</span>'
    star = "*" if rx["reaction_close"] is None else ""
    return f'<span class="{"up" if v >= 0 else "down"}">{v:+.1f}%{star}</span>'
def since_cell(r):
    v = r["reaction"].get("since_pct")
    if v is None or r["reaction"]["reaction_close"] is None: return '<span class="na">today</span>'
    return f'<span class="{"up" if v >= 0 else "down"}">{v:+.1f}%</span>'
def eps_cell(r):
    f = r["fmp"]
    if f["eps_estimate"] is None: return f'{f["eps_actual"]} <span class="na">(no estimate)</span>'
    s = f'{f["eps_actual"]} v {f["eps_estimate"]}'
    if f["eps_surprise_pct"] is not None: s += f' <span class="{"up" if f["eps_surprise_pct"] >= 0 else "down"}">({f["eps_surprise_pct"]:+.0f}%)</span>'
    if f["flags"].get("eps"): s += '<span class="flag" title="' + esc(f["flags"]["eps"]) + '">see note</span>'
    return s
def rev_cell(r):
    f = r["fmp"]
    if f["revenue_estimate"] is None: return f'{money(f["revenue_actual"])} <span class="na">(no estimate)</span>'
    s = f'{money(f["revenue_actual"])} v {money(f["revenue_estimate"])}'
    if f["revenue_surprise_pct"] is not None: s += f' <span class="{"up" if f["revenue_surprise_pct"] >= 0 else "down"}">({f["revenue_surprise_pct"]:+.0f}%)</span>'
    if f["flags"].get("revenue"): s += '<span class="flag" title="' + esc(f["flags"]["revenue"]) + '">see note</span>'
    return s

summary_rows = "".join(
    f'<tr><td class="l"><b><a href="#c-{r["ticker"]}">{r["ticker"]}</a></b><div class="na" style="font-size:11px">{esc(r["name"])}</div></td><td>{r["report_date"][5:]} {r["report_time"]}</td><td>{eps_cell(r)}</td><td>{rev_cell(r)}</td><td>{react_cell(r)}</td><td>{since_cell(r)}</td><td class="line">{esc(r["one_liner"])}</td></tr>'
    for r in records)

def section(r):
    rx = r["reaction"]; f = r["fmp"]
    kp = [("EPS vs est", eps_cell(r), f'FMP, last updated {esc(f["last_updated"])}'), ("Revenue vs est", rev_cell(r), "FMP"),
          ("Reaction day", react_cell(r), esc(rx["reaction_day"]) + (" · intraday" if rx["reaction_close"] is None else f' · close {rx["reaction_close"]:.2f} from {rx["prior_close"]:.2f}') + f' · SPY {rx["spy_same_days"]["reaction_pct"]:+.1f}%'),
          ("Since", since_cell(r), f'to {rx["latest_price"]:.2f} at {esc(rx["latest_utc"][11:16])} UTC'), ("Whole move", f'<span class="{"up" if (rx.get("total_pct") or 0) >= 0 else "down"}">{rx.get("total_pct", 0):+.1f}%</span>', "prior close to now")]
    kpis = "".join(f"<div><span>{k}</span><b>{v}</b><small>{s}</small></div>" for k, v, s in kp)
    said = "".join(f"<li>{esc(x)}</li>" for x in r["call_said"])
    quote = f"<blockquote>{esc(r['quote'])}</blockquote>" if r.get("quote") else ""
    tr = r["transcript"]; src = (f'Call read in full: {tr["quarter"]} call of {tr["call_date"]}, {tr["chars"]:,} characters, stored {esc(tr["stored_utc"][:16])} UTC.' if tr["stored"] else f'No call stored (transcript watch: {esc(tr["watch_status"])}).')
    flags = "".join(f'<div class="na" style="font-size:12px;margin-top:4px">FMP note: {esc(v)}</div>' for v in f["flags"].values())
    return f'''<section class="card" id="c-{r["ticker"]}"><div class="head"><span class="tk">{r["ticker"]}</span><span class="nm">{esc(r["name"])}</span><span class="when">{r["report_date"]} · {r["report_time"]} · {"banks and financials" if r["group"]=="banks" else "the rest"}</span></div>
<div class="kpis">{kpis}</div>{flags}
<h4>The numbers</h4><p class="num">{esc(r["numbers_line"])}</p>
<h4>Guidance and what changed</h4><p class="guid">{esc(r["guidance"])}</p>
<h4>What the call said that the release did not</h4><ol class="said">{said}</ol>{quote}
<div class="rt"><b>What it means for our names ·</b> {esc(r["read_through"])}</div>
<p class="na" style="font-size:12px;margin:10px 0 0">{src}</p></section>'''

season_blocks = "".join(f'<div class="block"><h3>{esc(t)}</h3><p>{esc(p)}</p></div>' for t, p in SEASON["blocks"])
cal_rows = []
for row in calendar["rows"]:
    when = row["report_time"] or "time unconfirmed"; cls = "" if row["time_confirmed"] else " unc"
    dropped = ("also listed " + ", ".join(d["date"][5:] + " " + (d["report_time"] or "no time") for d in row["other_rows_dropped"])) if row["other_rows_dropped"] else ""
    tonight = " (tonight)" if row["date"] == "2026-10-20" else ""
    eps_e = row["eps_estimate"] if row["eps_estimate"] is not None else "no estimate"
    cal_rows.append(f'<tr><td class="l">{row["date"]}{tonight}</td><td class="l{cls}">{esc(when)}</td><td class="l"><b>{row["ticker"]}</b></td><td>{eps_e}</td><td>{money(row["revenue_estimate"])}</td><td class="l"><small class="na">{esc(dropped)}</small></td></tr>')
cal_html = "".join(cal_rows)

specs = f'''<details id="specs"><summary>PAGE SPECS · sources, rules, data notes, what was not done</summary>
<h4>Sources</h4><ul>
<li><b>Numbers:</b> FMP through the project's fmp-proxy edge function, routes <code>earnings</code> (symbol, limit 6) and <code>quote</code>, 61 calls between {esc(fetch_start)} and {esc(fetch_end)} UTC, all status 200; every answer is in <code>EARNINGS-READ-20261020.json</code> under <code>raw.fmp</code> and in <code>raw/fmp/</code>. FMP's own <code>lastUpdated</code> is printed per name. "No estimate" is printed where FMP carries none (none of the 30 lacked one).</li>
<li><b>Calls:</b> the Hub's <code>earnings_call_transcripts</code> table (28 rows with call_date ≥ 13 Oct 2026, 37k–79k characters each, no <code>ai_summary</code> on any of them), read in full by the lane and paraphrased; at most one short quote per name. The transcript text is <em>not</em> redistributed in this public repository; the index of what was read is in <code>raw/supabase/transcripts_index.json</code>. PGR and STLD have no stored call (watch status "waiting"; PGR holds no quarterly call, STLD's call was the morning of 20 Oct).</li>
<li><b>Prices:</b> the house chart API <code>candles?symbol=X&amp;tf=D&amp;limit=12</code>, completed sessions only (newest 19 Oct 2026, bar finality verified by the API); today's prices from the FMP quote at 16:33 UTC on 20 Oct, intraday and marked * wherever used. SPY the same way. The Hub's <code>live_quotes</code> table was checked and not used: its newest rows are from 18 Aug 2026.</li>
<li><b>Universe and calendar:</b> the Hub's <code>tickers</code> table (613 names, all 30 reporters present) and <code>earnings_events</code> for 13–27 Oct read through the anon REST path on 20 Oct; <code>earnings_transcript_watch</code> for the catcher's status.</li></ul>
<h4>Rules</h4><ul>
<li>Reaction day: the report date for a before-the-open reporter, the next session for an after-the-close one; reaction = close ÷ prior close − 1; "since" = latest price ÷ reaction-day close − 1; the 20 Oct names show today's intraday move and no "since".</li>
<li>Banks and financials first (JPM, C, GS, WFC, BAC, BLK, MS, BNY, PNC, SCHW, USB, SFNC, SYF), then the rest in date order.</li>
<li>Calendar: universe names only, 20 Oct after the close plus the next five sessions (21, 22, 23, 26, 27 Oct). FMP's calendar carries unconfirmed duplicate rows for one ticker on different dates; a name that already reported in the window is dropped (PGR, PLD, UNH appeared again), and for a ticker with several rows the one with a confirmed report time (<code>report_time_source</code> set) wins, else the earliest; "time unconfirmed" is printed where no time is given. Dropped rows are listed beside each name. EQR is listed by FMP but is not on the Hub's universe and is left out.</li>
<li>Read-throughs name only companies on the Hub's universe or named on the calls themselves; no invented peers.</li></ul>
<h4>Data notes for the desk</h4><ul>
<li><code>live_quotes</code> is stale: 28 of the 30 reporters have rows, all last updated 18 Aug 2026 (SPY too). Nothing on this page depends on it.</li>
<li><code>earnings_events</code>: the PGR row of 14 Oct carries eps 1.08 vs 4.35 and revenue 7.16B vs 22.6B; FMP's answer today is 4.66 vs 4.35 and 22.3B vs 22.6B. The SYF row carries revenue_actual 103.3B; FMP today says 4.914B. Both look like FMP corrections that the Hub's sweep has not re-read. The PLD estimate is a GAAP-EPS figure against a core-FFO actual; the SYF revenue estimate is net revenue against a gross actual.</li>
<li><code>earnings_call_transcripts</code>: <code>url</code> is null and <code>ai_summary</code> is empty on all 28 rows; the lane's own reading is the summariser, as the brief required.</li>
<li>Duplicate unconfirmed calendar rows (CSX, TXN, KO, VZ, LMT, DHR, CATY, FULT, CB, PG, BE, BKR, FCX, FE, HCA, ITW, NEE, CNP, WM, UAL) are listed with the row kept.</li>
<li>The chart API answers 404 at its root and serves candles normally.</li></ul>
<h4>Not done</h4><ul>
<li>STLD's 20 Oct call and the seven after-the-close reporters tonight (CB, COF, HWC, ISRG, NFLX, OMC, UAL) are not read; they belong to the next edition.</li>
<li>No position, allocation or account figure appears on this page (public repository).</li>
<li>No paid model API; no deployment; nothing written under INDICATOR_LAB/, prototypes/indicator-lab/ or lab.html.</li></ul>
<h4>Tools</h4><ul><li><code>tools/reactions.py</code>, <code>tools/calendar.py</code>, <code>tools/build.py</code> (this page and the JSON, pictures as inline SVG), <code>tools/shots.mjs</code> (headless pictures, every non-file request blocked). Built {dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M")} UTC.</li></ul>
</details>'''

page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Earnings read · 13–20 Oct 2026</title><style>{css}</style></head><body>
<header><h1>The earnings read: every universe name that reported from 13 to 20 October 2026</h1>
<p class="lede"><b>30 reporters, 28 calls read in full, numbers from FMP fetched {esc(fetch_start[:16].replace("T"," "))} UTC on 20 Oct 2026, prices from the house chart API through the 19 Oct close and the FMP quote at 16:33 UTC today.</b> Banks and financials first, then the rest. Each name: the numbers against the estimate, what the guidance changed, three things the call said that the release did not, the stock's reaction day and since, and one line on what it means for our names. Then what the season says so far and the next five sessions' reporters with their report time. Sources, rules and data notes are under PAGE SPECS at the bottom; every figure and every raw answer is in <code>EARNINGS-READ-20261020.json</code> beside this page.</p></header>
<main>
<div class="pic" id="pic-reaction">{PIC1}</div>
<div class="pic" id="pic-total">{PIC2}</div>
<div class="pic" id="pic-surprise">{PIC3}</div>
<h2 id="summary">One screen: the 30 in a line each</h2>
<div class="wrap"><table id="summary-table"><thead><tr><th>Name</th><th>Reported</th><th>EPS vs est</th><th>Revenue vs est</th><th>Reaction</th><th>Since</th><th>The line</th></tr></thead><tbody>{summary_rows}</tbody></table></div>
<p class="na" style="font-size:12px">* 20 Oct names: intraday move from the FMP quote at 16:33 UTC, not a close. Surprise in brackets is actual ÷ estimate − 1. "See note" marks an FMP row that is not like for like; the note is in the name's section.</p>
<h2 id="season">What the season says so far</h2>
<div class="headline">{esc(SEASON["headline"])}</div>
<div class="season">{season_blocks}</div>
<h2 id="banks">Banks and financials</h2>
{"".join(section(r) for r in records if r["group"]=="banks")}
<h2 id="rest">The rest, in date order</h2>
{"".join(section(r) for r in records if r["group"]!="banks")}
<h2 id="calendar">The next five sessions: universe reporters and their report time</h2>
<p class="lede">Tonight after the close, then 21, 22, 23, 26 and 27 October. From the Hub's earnings_events (FMP calendar) read 20 Oct, filtered to the Hub's universe; BMO = before the open, AMC = after the close; <span class="unc">amber</span> = FMP gives no report time. {len(calendar["rows"])} names.</p>
<div class="wrap"><table class="cal" id="calendar-table"><thead><tr><th>Date</th><th>Time</th><th>Name</th><th>EPS est</th><th>Revenue est</th><th>Calendar note</th></tr></thead><tbody>{cal_html}</tbody></table></div>
{specs}
</main><script>window.ER1_PAGE_READY=true;</script></body></html>'''
open(os.path.join(D, "EARNINGS-READ-20261020.html"), "w").write(page)

# ---------- JSON ----------
raw_fmp = {}
for t in ORDER + ["SPY"]:
    raw_fmp[t] = {}
    if t != "SPY":
        rows, st = fmp_body("earnings_%s.json" % t); raw_fmp[t]["earnings"] = {"status": st, "data": rows}
    q, qst = fmp_body("quote_%s.json" % t); raw_fmp[t]["quote"] = {"status": qst, "data": q}
raw_candles = {t: json.load(open(os.path.join(D, "raw", "candles", t + ".json"))) for t in ORDER + ["SPY"]}
out = {"schema": "scintilla.er1.earnings_read.v1", "built_utc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "window": {"from": "2026-10-13", "to": "2026-10-20"},
       "fmp_fetch_utc": {"first": fetch_start, "last": fetch_end, "calls": 61, "door": "fmp-proxy edge function, routes earnings and quote"},
       "counts": SEASON["counts"], "order": ORDER, "reporters": records, "season": SEASON, "calendar": calendar, "one_liners": ONE_LINERS,
       "raw": {"fmp": raw_fmp, "candles": raw_candles, "supabase": {"earnings_events_window": events, "transcripts_index": tindex, "transcript_watch": watch}}}
json.dump(out, open(os.path.join(D, "EARNINGS-READ-20261020.json"), "w"), indent=1, ensure_ascii=False)
print("records", len(records), "eps beats", beats, "down on reaction day", down, "calendar rows", len(calendar["rows"]))
print("html bytes", os.path.getsize(os.path.join(D, "EARNINGS-READ-20261020.html")), "json bytes", os.path.getsize(os.path.join(D, "EARNINGS-READ-20261020.json")))

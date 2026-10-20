#!/usr/bin/env python3
"""CW5 · the page. Self-contained HTML, pictures first: the sector strip, the Micron two-readings chart, the verdict
(peak earnings or disbelief, the evidence for each, the number that decides), one card per name (the ten-year chart
with today marked + the figures), the Micron-vs-Korea premium chart and table, the Micron cycle table, the DRAM/NAND
pricing context, what was not done, PAGE SPECS folded. No script beyond a ready flag; no network.
usage: python3 page.py <deliverable dir>"""
import json, os, sys, base64, html, datetime as dt

ORDER = ["MU", "000660.KS", "005930.KS", "285A.T", "WDC", "SNDK", "2408.TW"]
SHORT = {"MU": "Micron", "000660.KS": "SK hynix", "005930.KS": "Samsung", "285A.T": "Kioxia", "WDC": "Western Digital", "SNDK": "Sandisk", "2408.TW": "Nanya"}
def esc(s): return html.escape(str(s)) if s is not None else ""
def x(v, d=1):
    if v is None: return '<span class="na">n.m.</span>'
    return f"{v:,.0f}×" if v >= 100 else f"{v:.{d}f}×"
def pc(v, signed=False):
    if v is None: return '<span class="na">—</span>'
    return f"{v:+.0f}%" if signed else f"{v:.0f}%"
def xs(v): return "—" if v is None else f"{v:.1f}×"
def pr(v): return '<span class="na">—</span>' if v is None else f"p{v:.0f}"
def pxv(v, ccy):
    if v is None: return "—"
    return (f"${v:,.2f}" if ccy == "USD" else f"{v:,.0f} {ccy}") if v < 100 or ccy != "USD" else f"${v:,.0f}"
def eps(v, ccy):
    if v is None: return "—"
    return f"${v:,.2f}" if ccy == "USD" else f"{v:,.0f} {ccy}"
def b64(p): return "data:image/png;base64," + base64.b64encode(open(p, "rb").read()).decode()
def cls_pct(v):
    if v is None: return ""
    return "cheap" if v <= 33 else ("rich" if v >= 67 else "fair")

def card(n, out):
    t = n["ticker"]; td = n["today"]; p = n["percentiles"]; e = n["earnings"]; ccy = n["currency"]; ntm = n["ntm"]
    rows = []
    for k, lab in (("pe", "Trailing P/E"), ("ev_sales", "EV / sales (TTM)"), ("ev_ebitda", "EV / EBITDA (TTM)"), ("pb", "Price / book")):
        q = p[k]
        rows.append(f'<tr><td>{lab}</td><td><b>{x(q["today"])}</b></td><td class="{cls_pct(q["percentile"])}">{pr(q["percentile"])}</td><td>{x(q["median"])}</td><td>{x(q["low"])} – {x(q["high"])}</td><td>{q["n"]} of {q["n_months"]}{(" (" + str(q["nm_months"]) + " loss months)") if q["nm_months"] else ""}</td></tr>')
    fw = p["pe_fwd_vs_realised"]
    rows.append(f'<tr><td>Forward P/E (consensus NTM, house blend)</td><td><b>{x(td.get("pe_fwd"))}</b></td><td class="{cls_pct(fw["percentile"])}">{pr(fw["percentile"])}<sup>r</sup></td><td>{x(p["pe_fwd_realised"]["median"])}<sup>r</sup></td><td>{x(p["pe_fwd_realised"]["low"])} – {x(p["pe_fwd_realised"]["high"])}<sup>r</sup></td><td>{p["pe_fwd_realised"]["n"]} realised</td></tr>')
    rows.append(f'<tr><td>EV / sales · EV / EBITDA on consensus NTM</td><td><b>{x(td.get("ev_sales_fwd"))} · {x(td.get("ev_ebitda_fwd"))}</b></td><td colspan="4" class="sub">{esc(ntm.get("basis"))}{(" · FY1 " + ntm["fy1"][:7] + " weight " + str(ntm["w"])) if ntm.get("fy1") else ""}{(" · " + str(ntm["n_analysts_eps"]) + " analysts on EPS") if ntm.get("n_analysts_eps") else ""}</td></tr>')
    hi = e["eps_ttm_high"]; prh = e.get("eps_prior_cycle_high"); gmh = e.get("gm_prior_cycle_high")
    kp = f'''<div class="kpis small">
      <div><span>Price · {esc(ccy)}</span><b>{pxv(td["price"], ccy)}</b><small>FMP quote {esc(n["fetched_utc"][11:16])} UTC · mcap {td["mcap"]/1e9:,.0f}B {esc(ccy)} (price × diluted shares; FMP profile {n["fmp_marketcap_profile"]/1e9:,.0f}B)</small></div>
      <div><span>EPS, trailing four quarters</span><b>{eps(e["eps_ttm_now"], ccy)}</b><small>to {esc(e["eps_ttm_quarter"])} · ten-year high {eps(hi[1], ccy) if hi else "—"} ({hi[0][:7] if hi else "—"}) · now = {pc(e["eps_now_vs_high_pct"])} of the high</small></div>
      <div><span>Prior-cycle EPS high</span><b>{eps(prh[1], ccy) if prh else "—"}</b><small>{(prh[0][:7] + " · today's EPS is " + f"{e['eps_ttm_now']/prh[1]:.1f}× it") if (prh and prh[1] > 0) else "no positive prior-cycle high in the window"}</small></div>
      <div><span>Consensus NTM EPS vs trailing</span><b>{(f"{e['ntm_eps_vs_ttm']:.1f}×") if e.get("ntm_eps_vs_ttm") else "no estimate"}</b><small>NTM {eps(ntm.get("eps"), ccy)} vs TTM {eps(e["eps_ttm_now"], ccy)} · latest quarter annualised = {e["latest_quarter_eps_annualised_vs_ttm"]:.2f}× TTM</small></div>
      <div><span>Gross margin, TTM</span><b>{pc(e["gm_ttm_now"]*100) if e.get("gm_ttm_now") is not None else "—"}</b><small>prior-cycle peak {pc(gmh[1]*100) if gmh else "—"} ({gmh[0][:7] if gmh else "—"}) · the DRAM/NAND price proxy</small></div>
      <div><span>EPS the price pays for at the ten-year median trailing P/E</span><b>{eps(e.get("eps_implied_at_median_pe"), ccy)}</b><small>{pc(e.get("implied_vs_ntm_eps_pct"), True)} vs consensus NTM · {pc(e.get("implied_vs_ttm_eps_pct"), True)} vs trailing</small></div>
      <div><span>P/E if gross margin went back to the prior-cycle peak</span><b>{x(e.get("pe_at_prior_peak_gm"))}</b><small>EPS {eps(e.get("eps_at_prior_peak_gm"), ccy)} on today's revenue and opex ratio ({pc((e.get("opex_ratio_ttm") or 0)*100)} of sales)</small></div>
    </div>'''
    notes = "".join(f"<li>{esc(s)}</li>" for s in n["notes"]) + "".join(f'<li>Data correction · {esc(c["quarter"])}: {esc(c["reason"])} (FMP {c["fmp"][0]:,.0f} → {c["used"][0]:,.0f} net income).</li>' for c in n["corrections"])
    img = b64(os.path.join(out, "charts", f"cycle-{t}.png"))
    return f'''<section class="card" id="c-{esc(t)}"><h2>{esc(t)} · {esc(n["company"])} <span class="sub">{esc(n["name"])}</span></h2>
    <img class="chart" src="{img}" alt="{esc(t)} ten-year multiples with today marked">
    {kp}
    <table><thead><tr><th>Multiple</th><th>Today</th><th>Percentile in own history</th><th>Ten-year median</th><th>Low – high</th><th>Months with a meaningful reading</th></tr></thead><tbody>{"".join(rows)}</tbody></table>
    <p class="fn"><sup>r</sup> the forward P/E's history is the <i>realised</i> forward P/E (price ÷ the next four quarters' actual EPS); FMP keeps no point-in-time consensus. Percentile 0 = cheapest month of the name's own history, 100 = richest. Months with losses are n.m. and left out of the percentile.</p>
    {("<ul class='notes'>" + notes + "</ul>") if notes else ""}
    </section>'''

def main():
    out = sys.argv[1]; d = json.load(open(os.path.join(out, "MEMORY-CYCLE.json")))
    N = d["names"]; mc = d["micron_cycle"]; sec = d["sector"]; mu = N["MU"]; e = mu["earnings"]; td = mu["today"]; p = mu["percentiles"]
    W = mc["windows"]
    def wrow(label, key, kind):
        w = W.get(label); m = w.get(kind) if w else None; pk = (w.get("price_peak") or w.get("price_trough")) if w else None
        if not m: return f"<tr><td>{esc(label)} · {esc(key)}</td><td colspan='7' class='sub'>no monthly point (the quarter was not yet public)</td></tr>"
        return f'<tr><td>{esc(label)} · {esc(key)}</td><td>{m["date"][:7]}</td><td>${m["price"]:,.0f}</td><td>${m["eps_ttm"]:,.2f}</td><td>{x(m.get("pe"))}</td><td>{x(m.get("pe_fwd_realised"))}</td><td>{x(m.get("ev_sales"))}</td><td>{x(m.get("ev_ebitda"))}</td><td>{x(m.get("pb"))}</td><td>{pc(m["gm_ttm"]*100) if m.get("gm_ttm") is not None else "—"}</td></tr>'
    cyc = [wrow("2018", "price peak", "at_price_peak"), wrow("2018", "EPS peak", "at_eps_peak"), wrow("2018-19 low", "price low", "at_price_trough"),
           wrow("2022", "price peak", "at_price_peak"), wrow("2022", "EPS peak", "at_eps_peak"), wrow("2022-23 low", "price low", "at_price_trough"),
           wrow("2025", "price peak", "at_price_peak"), wrow("2026 (to date)", "price peak", "at_price_peak")]
    cyc.append(f'<tr class="self"><td>today</td><td>2026-10</td><td>${td["price"]:,.0f}</td><td>${td["eps_ttm"]:,.2f}</td><td>{x(td["pe"])}</td><td>{x(td["pe_fwd"])} <span class="sub">consensus</span></td><td>{x(td["ev_sales"])}</td><td>{x(td["ev_ebitda"])}</td><td>{x(td["pb"])}</td><td>{pc(e["gm_ttm_now"]*100)}</td></tr>')
    prem_rows = []
    for peer in ("000660.KS", "005930.KS"):
        s = mc["premium_to"][peer]["summary"]
        for k, lab in (("pe", "Trailing P/E"), ("ev_ebitda", "EV / EBITDA"), ("ev_sales", "EV / sales"), ("pb", "Price / book")):
            q = s[k]; prem_rows.append(f'<tr><td>vs {esc(SHORT[peer])} · {lab}</td><td>{pc(q["median"], True)}</td><td>{pc(q["low"], True)} to {pc(q["high"], True)}</td><td><b>{pc(q["today"], True)}</b></td><td class="{cls_pct(q["percentile"])}">{pr(q["percentile"])}</td><td>{q["n"]}</td></tr>')
        prem_rows.append(f'<tr><td>vs {esc(SHORT[peer])} · forward P/E (consensus NTM)</td><td colspan="2" class="sub">no history (no point-in-time consensus)</td><td><b>{pc(s["pe_fwd_today"], True)}</b></td><td colspan="2" class="sub">{x(td["pe_fwd"])} against {x(N[peer]["today"]["pe_fwd"])}</td></tr>')
    sec_rows = "".join(f'<tr><td><b>{esc(r["ticker"])}</b> <span class="sub">{esc(SHORT[r["ticker"]])}</span></td><td>{x(r["pe"])} <span class="{cls_pct(r["pe_pct"])}">{pr(r["pe_pct"])}</span></td><td>{x(r["pe_fwd"])}</td><td>{x(r["ev_ebitda"])} <span class="{cls_pct(r["ev_ebitda_pct"])}">{pr(r["ev_ebitda_pct"])}</span></td><td>{x(r["ev_sales"])} <span class="{cls_pct(r["ev_sales_pct"])}">{pr(r["ev_sales_pct"])}</span></td><td>{x(r["pb"])} <span class="{cls_pct(r["pb_pct"])}">{pr(r["pb_pct"])}</span></td><td>{pc(r["eps_vs_high_pct"])}</td><td>{xs(r["eps_vs_prior_cycle_high_x"])}</td><td>{pc(r["gm_now"]*100)} / {pc(r["gm_prior_peak"]*100) if r["gm_prior_peak"] else "—"}</td><td>{xs(r["ntm_eps_vs_ttm_x"])}</td><td>{pc(r["implied_vs_ntm_eps_pct"], True)}</td><td>{x(r["pe_at_prior_peak_gm"])}</td></tr>' for r in sec["rows"])
    M = sec["medians"]
    fetched = d["fetch_utc_first"][:16].replace("T", " ") + "–" + d["fetch_utc_last"][11:16]
    skh = mc["premium_to"]["000660.KS"]["summary"]; sam = mc["premium_to"]["005930.KS"]["summary"]
    w18 = W["2018"]; w22 = W["2022"]
    verdict = f'''
    <div class="blocks">
      <div class="block"><h3>Reading one · the multiple is low because earnings are at a peak</h3><ol>
        <li>Every one of the seven has trailing EPS at its ten-year high. Micron's ${e["eps_ttm_now"]:,.2f} is {e["eps_ttm_now"]/e["eps_prior_cycle_high"][1]:.1f}× its prior-cycle high (${e["eps_prior_cycle_high"][1]:,.2f}, {e["eps_prior_cycle_high"][0][:7]}); SK hynix {N["000660.KS"]["earnings"]["eps_ttm_now"]/N["000660.KS"]["earnings"]["eps_prior_cycle_high"][1]:.1f}×, Samsung {N["005930.KS"]["earnings"]["eps_ttm_now"]/N["005930.KS"]["earnings"]["eps_prior_cycle_high"][1]:.1f}×, Nanya {N["2408.TW"]["earnings"]["eps_ttm_now"]/N["2408.TW"]["earnings"]["eps_prior_cycle_high"][1]:.1f}×.</li>
        <li>Gross margin, the DRAM/NAND price proxy: Micron {e["gm_ttm_now"]*100:.0f}% against {e["gm_prior_cycle_high"][1]*100:.0f}% at the {e["gm_prior_cycle_high"][0][:4]} peak; SK hynix {N["000660.KS"]["earnings"]["gm_ttm_now"]*100:.0f}% vs {N["000660.KS"]["earnings"]["gm_prior_cycle_high"][1]*100:.0f}%; Samsung {N["005930.KS"]["earnings"]["gm_ttm_now"]*100:.0f}% vs {N["005930.KS"]["earnings"]["gm_prior_cycle_high"][1]*100:.0f}%. No memory cycle in the window held a margin like this.</li>
        <li>The pattern at past turns: at the 2018 EPS peak Micron's trailing P/E was {x(w18["at_eps_peak"]["pe"])} and the next four quarters' actual EPS made that {x(w18["at_eps_peak"]["pe_fwd_realised"])}; at the 2022 EPS peak it was {x(w22["at_eps_peak"]["pe"])} and the next four quarters were losses. A trailing P/E at its lows has marked an earnings peak, not a bargain.</li>
        <li>On sales and book the sector sits at the top of its own history: median percentile {M["ev_sales_pct"]:.0f} on EV/sales and {M["pb_pct"]:.0f} on price-to-book; Micron {x(td["ev_sales"])} EV/sales against a median of {x(p["ev_sales"]["median"])}, {x(td["pb"])} book against {x(p["pb"]["median"])}. Cheap on earnings and the richest ever on sales and book is what a cyclical looks like at a peak.</li></ol></div>
      <div class="block"><h3>Reading two · the multiple is low because the market disbelieves the HBM cycle</h3><ol>
        <li>Consensus has next-twelve-month EPS at {e["ntm_eps_vs_ttm"]:.1f}× trailing for Micron, {N["000660.KS"]["earnings"]["ntm_eps_vs_ttm"]:.1f}× for SK hynix, {N["005930.KS"]["earnings"]["ntm_eps_vs_ttm"]:.1f}× for Samsung, {N["285A.T"]["earnings"]["ntm_eps_vs_ttm"]:.1f}× for Kioxia, {N["SNDK"]["earnings"]["ntm_eps_vs_ttm"]:.1f}× for Sandisk. On those numbers the forward P/Es are {x(td["pe_fwd"])}, {x(N["000660.KS"]["today"]["pe_fwd"])}, {x(N["005930.KS"]["today"]["pe_fwd"])}, {x(N["285A.T"]["today"]["pe_fwd"])}, {x(N["SNDK"]["today"]["pe_fwd"])}: a sector median of {x(M["pe_fwd"])}.</li>
        <li>Against the realised-forward history those forward multiples sit at the {p["pe_fwd_vs_realised"]["percentile"]:.0f}th percentile for Micron, the {N["000660.KS"]["percentiles"]["pe_fwd_vs_realised"]["percentile"]:.0f}th for SK hynix and the {N["005930.KS"]["percentiles"]["pe_fwd_vs_realised"]["percentile"]:.0f}st for Samsung: the market has never paid this little for a year of earnings the consensus says is coming.</li>
        <li>What the price actually pays for: at Micron's ten-year median trailing P/E ({x(p["pe"]["median"])}) today's ${td["price"]:,.0f} buys ${e["eps_implied_at_median_pe"]:,.0f} of EPS, {e["implied_vs_ntm_eps_pct"]:+.0f}% against consensus NTM (${mu["ntm"]["eps"]:,.0f}) and {e["implied_vs_ttm_eps_pct"]:+.0f}% against trailing (${e["eps_ttm_now"]:,.0f}). The same gap for every name: the price-implied EPS is {M["implied_vs_ntm_eps_pct"]:.0f}% below consensus at the sector median.</li>
        <li>The trailing multiple is not at its lows: Micron {x(td["pe"])} is the {p["pe"]["percentile"]:.0f}th percentile (median {x(p["pe"]["median"])}), SK hynix {x(N["000660.KS"]["today"]["pe"])} the {N["000660.KS"]["percentiles"]["pe"]["percentile"]:.0f}th, Samsung {x(N["005930.KS"]["today"]["pe"])} the {N["005930.KS"]["percentiles"]["pe"]["percentile"]:.0f}rd. "Ridiculously low" is true of the forward multiples only.</li></ol></div>
    </div>
    <div class="block verdict"><h3>The number that decides</h3>
      <p><b>${e["eps_implied_at_median_pe"]:,.0f} of Micron EPS.</b> That is what today's price pays for at the stock's own median multiple, and it is almost exactly the EPS Micron would earn on today's revenue if gross margin fell back to the last cycle's peak ({e["gm_prior_cycle_high"][1]*100:.0f}%): ${e["eps_at_prior_peak_gm"]:,.0f}, which puts the stock on {x(e["pe_at_prior_peak_gm"])}. The market is pricing a full margin reversion to 2018-peak levels and nothing beyond it; the consensus is pricing ${mu["ntm"]["eps"]:,.0f}. Both readings are the same fact seen from two sides: the multiple is low <i>because</i> the market treats these as peak earnings, and that treatment <i>is</i> the disbelief in the HBM cycle. The sector-wide version: the price-implied EPS at each name's own median multiple is {M["implied_vs_ntm_eps_pct"]:.0f}% below consensus (median of seven), and the P/E at prior-peak margins is {x(M["pe_at_prior_peak_gm"])} — a normal multiple, not a cheap one.</p>
      <p>What settles it is the next four quarters against two lines: the latest quarter printed ${mu["earnings"]["latest_quarter_eps"]:,.2f} (an annualised ${mu["earnings"]["latest_quarter_eps"]*4:,.0f}); consensus needs ${mu["ntm"]["eps"]/4:,.0f} a quarter; the price needs only ${e["eps_implied_at_median_pe"]/4:,.0f}. A first quarter below ${e["eps_implied_at_median_pe"]/4:,.0f} confirms the peak reading at today's price. Every quarter that holds above ${mu["earnings"]["latest_quarter_eps"]:,.0f} moves the fair value toward ${e["eps_ttm_now"]*p["pe"]["median"]:,.0f} on trailing earnings at the median multiple and ${mu["ntm"]["eps"]*p["pe"]["median"]:,.0f} on the consensus year — and the history says the multiple does not wait for the fourth quarter to decide.</p>
      <p class="sub">The 2018 analogue is the caution: Micron's trailing P/E fell from {x(w18["at_price_peak"]["pe"])} at the May 2018 price peak to {x(w18["at_eps_peak"]["pe"])} at the November 2018 EPS peak while the stock fell from ${w18["price_peak"]["price"]:,.0f} to ${w18["at_eps_peak"]["price"]:,.0f}; the "cheapest multiple ever" and the top of earnings were the same month.</p>
    </div>'''
    us = f'''<section class="card" id="premium"><h2>What the US listing is worth: Micron's premium to SK hynix and Samsung through the cycle</h2>
    <img class="chart" src="{b64(os.path.join(out, "charts", "premium-MU-vs-Korea.png"))}" alt="Micron premium to SK hynix and Samsung">
    <table><thead><tr><th>Pair · multiple</th><th>Ten-year median premium</th><th>Range</th><th>Today</th><th>Percentile</th><th>Months</th></tr></thead><tbody>{"".join(prem_rows)}</tbody></table>
    <p>The measured value of "the only US-listed memory maker": through the cycle Micron has carried a <b>{skh["pe"]["median"]:+.0f}% premium to SK hynix on trailing earnings, {skh["ev_ebitda"]["median"]:+.0f}% on EV/EBITDA, {skh["ev_sales"]["median"]:+.0f}% on EV/sales and {skh["pb"]["median"]:+.0f}% on book</b>; against Samsung {sam["pe"]["median"]:+.0f}% on earnings and {sam["ev_ebitda"]["median"]:+.0f}% on EV/EBITDA (Samsung's EV/sales premium of {sam["ev_sales"]["median"]:+.0f}% is a conglomerate artefact: phones and appliances carry low sales multiples). Today the premium is <b>{skh["pe"]["today"]:+.0f}% on earnings, {skh["ev_ebitda"]["today"]:+.0f}% on EV/EBITDA and {skh["pb"]["today"]:+.0f}% on book against SK hynix</b> (percentiles {skh["pe"]["percentile"]:.0f}, {skh["ev_ebitda"]["percentile"]:.0f}, {skh["pb"]["percentile"]:.0f}), and {skh["pe_fwd_today"]:+.0f}% on consensus forward earnings. The US listing has been worth about a third more than the Korean multiple for ten years; the market is paying roughly double that premium now. On SK hynix's own forward multiple ({x(N["000660.KS"]["today"]["pe_fwd"])}) Micron's consensus year is worth ${mu["ntm"]["eps"]*N["000660.KS"]["today"]["pe_fwd"]:,.0f}; at the ten-year median premium over that ({skh["pe"]["median"]:+.0f}%) it is ${mu["ntm"]["eps"]*N["000660.KS"]["today"]["pe_fwd"]*(1+skh["pe"]["median"]/100):,.0f}, against ${td["price"]:,.0f} today.</p>
    <h3>Micron at the turns of the cycle</h3>
    <table><thead><tr><th>Window · point</th><th>Month</th><th>Price</th><th>EPS TTM</th><th>Trailing P/E</th><th>Realised fwd P/E</th><th>EV/sales</th><th>EV/EBITDA</th><th>P/B</th><th>Gross margin</th></tr></thead><tbody>{"".join(cyc)}</tbody></table>
    <p class="fn">Price peaks and lows are monthly closes inside each window (the 2025 price peak is December 2025; the stock went on to a June 2026 high of ${W["2026 (to date)"]["price_peak"]["price"]:,.0f}). The EPS peak is the quarter with the highest trailing EPS in the window; the multiples at it are the month that quarter became public. Realised forward P/E is n.m. where the following four quarters lost money.</p>
    </section>'''
    cards = "".join(card(N[t], out) for t in ORDER if t in N)
    pricing = f'''<section class="card" id="pricing"><h2>DRAM / NAND pricing context</h2>
    <p><b>No free, machine-readable DRAM or NAND contract-price series exists</b> that this lane could fetch: TrendForce/DRAMeXchange contract and spot prices are behind membership (the public pages give the latest reading only), the Korean export price index for memory needs an ECOS API key, and the one free download found (Stanford's memory-prices page, retail $/GB from Amazon listings via Keepa and the McCallum series) is a consumer-retail series, not the contract price the makers book. The proxy used on every card is the maker's own trailing gross margin, which moves with its blended ASP: Micron {e["gm_ttm_now"]*100:.0f}% today against {e["gm_prior_cycle_high"][1]*100:.0f}% at the 2018 peak and {W["2022"]["at_eps_peak"]["gm_ttm"]*100:.0f}% at the 2022 peak; SK hynix {N["000660.KS"]["earnings"]["gm_ttm_now"]*100:.0f}% vs {N["000660.KS"]["earnings"]["gm_prior_cycle_high"][1]*100:.0f}%; Nanya (DRAM only) {N["2408.TW"]["earnings"]["gm_ttm_now"]*100:.0f}% vs {N["2408.TW"]["earnings"]["gm_prior_cycle_high"][1]*100:.0f}%; Kioxia (NAND only) {N["285A.T"]["earnings"]["gm_ttm_now"]*100:.0f}%; Sandisk (NAND) {N["SNDK"]["earnings"]["gm_ttm_now"]*100:.0f}% vs {N["SNDK"]["earnings"]["gm_prior_cycle_high"][1]*100:.0f}%. Source: FMP quarterly income statements, fetched 20 Oct 2026.</p></section>'''
    notdone = '''<section class="card" id="notdone"><h2>What was not done</h2><ul class="notes">
    <li><b>A point-in-time forward P/E history.</b> FMP keeps only today's consensus; the ten-year "forward" series on each card is the realised forward P/E (price ÷ the next four quarters' actual EPS), labelled as such everywhere. Today's forward P/E is the house NTM blend of FMP's fiscal-year consensus (market cap ÷ NTM net income; price ÷ NTM EPS printed beside it on the JSON).</li>
    <li><b>FMP's own quarterly multiples were not used.</b> Its quarterly key-metrics divide EV by a single quarter's sales and EBITDA; the series here are built from the statements (trailing four quarters) so the multiples are comparable across names and years. Market cap is price × diluted weighted shares of the quarter; EV adds total debt and subtracts cash and short-term investments from the quarter's balance sheet.</li>
    <li><b>"As known at the time":</b> US names use FMP's filing date; Korean, Japanese and Taiwanese quarters are treated as public 45 days after period end (FMP carries no filing date for them). A month's multiple uses the latest quarter public by that month end.</li>
    <li><b>Three FMP rows were corrected</b> (SK hynix Q2 2026, Nanya Q4 2016 and Q4 2017): net income printed above revenue, read as cumulative for the fiscal year and netted against the prior quarters. Each is listed on the card and in the JSON.</li>
    <li><b>Kioxia and Sandisk have 22 and 20 months of market history</b>; their percentiles are against that short history and say little. Western Digital's ten years span two different companies (flash + HDD, then HDD).</li>
    <li><b>Samsung is a conglomerate</b>; its multiples are blended-company multiples. No sum-of-the-parts was attempted.</li>
    <li><b>No DRAM/NAND contract-price series</b> (above). No FX conversion was needed: every multiple is in the name's own currency and the premium chart is a ratio of multiples.</li>
    <li>No subagent, no paid API, nothing deployed, nothing written under INDICATOR_LAB, prototypes/indicator-lab or lab.html. The Hermes spine reporter was not run (an earlier lane's refusal stands).</li></ul></section>'''
    specs = f'''<details id="specs"><summary>PAGE SPECS · the rules, the sources, the tools</summary><div class="mono">
    <p>Dispatch SCINTILLA-20261020-CW5. Source: FMP through the project's fmp-proxy edge function (GET only, anon key read from the release's index.html at run time, never written), {d["fmp_calls"]} calls fetched {esc(fetched)} UTC on 20 Oct 2026 (status {esc(json.dumps(d["fmp_calls_by_status"]))}), plus 7 probe calls before the run. Paths: profile, quote, income-statement (quarter, 48), balance-sheet-statement (quarter, 48), cash-flow-statement (quarter, 48), enterprise-values (quarter, 48), key-metrics (quarter, 44), ratios (quarter, 44), key-metrics-ttm, ratios-ttm, income-statement-ttm, analyst-estimates (annual, 6), price-target-summary, historical-price-eod/light (2015-10-01 → 2026-10-20). Every raw answer is under <code>raw/&lt;TICKER&gt;.json</code> with its fetch time.</p>
    <p>Arithmetic (tools/compute.py): TTM = sum of the last four quarters. Trailing P/E = price ÷ TTM diluted EPS, n.m. when EPS ≤ 0. EV/sales, EV/EBITDA on TTM; EV/EBITDA n.m. when TTM EBITDA ≤ 0. P/B = price × diluted shares ÷ total stockholders' equity. Realised forward P/E = price ÷ the next four quarters' actual diluted EPS. Monthly series = month-end price (last close within ten days) × the latest quarter public by then. Percentile = share of meaningful months below today's value (ties half). NTM blend = w·FY1 + (1−w)·FY2 with w = days to FY1 end ÷ 365. Price-implied EPS = today's price ÷ the ten-year median trailing P/E. EPS at prior-peak gross margin = TTM EPS × (GM<sub>prior peak</sub> − opex ratio) ÷ (GM<sub>now</sub> − opex ratio), opex ratio = GM − EBIT margin, TTM. Premium = Micron's multiple ÷ the peer's − 1, same month, both meaningful.</p>
    <p>Pictures (tools/charts.py, matplotlib headless): dark surface #0e131b on #0a0e14; series blue #3987e5 (trailing), orange #d95926 (forward / Samsung), aqua #199e70 (EPS, EV/EBITDA strip), yellow #c98500 (EV/sales strip), red #e66767 (today). Palette validated with the dataviz validator in dark mode (all checks pass: lightness band, chroma floor, CVD separation ΔE 8.4, normal-vision ΔE 19.8, contrast ≥ 3:1). One axis per panel; loss-year spikes clipped and said so on the panel. Page (tools/page.py): self-contained, PNGs inlined, no script beyond a ready flag, no network. Screenshots: tools/shots.mjs (playwright-core, every non-file request blocked).</p>
    <p>Not written: anything under INDICATOR_LAB/, prototypes/indicator-lab/, lab.html. Nothing deployed. Repository public: no positions, no account figures. Written {esc(d["written_utc"])}.</p></div></details>'''
    css = '''
    :root{--bg:#0a0e14;--card:#0e131b;--line:#263040;--ink:#e6e9ef;--ink2:#9aa3b2;--cyan:#00d4ff;--cheap:#199e70;--rich:#e66767;--fair:#c98500;--blue:#3987e5}
    *{box-sizing:border-box} html{color-scheme:dark}
    body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 -apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif;padding:0 16px 48px}
    header{padding:28px 0 8px;max-width:1500px;margin:0 auto} main{max-width:1500px;margin:0 auto}
    h1{font-size:24px;margin:0 0 6px;line-height:1.2} h2{font-size:18px;margin:0 0 10px} h3{font-size:15px;margin:14px 0 6px} .sub{color:var(--ink2);font-weight:400;font-size:12.5px}
    p.lede{color:var(--ink2);margin:6px 0 0;max-width:1100px}
    img.chart{width:100%;height:auto;display:block;border-radius:8px;border:1px solid var(--line);background:var(--bg);margin:6px 0 12px}
    table{border-collapse:collapse;width:100%;font-size:13px;font-variant-numeric:tabular-nums;margin:8px 0} th{background:#121a25;color:var(--ink2);font-weight:600;text-align:right;padding:8px 10px;white-space:nowrap} th:first-child,td:first-child{text-align:left}
    td{padding:7px 10px;border-top:1px solid var(--line);text-align:right;white-space:nowrap} td:first-child{white-space:normal} tr.self td{background:#13202e;font-weight:600}
    .cheap{color:var(--cheap)} .rich{color:var(--rich)} .fair{color:var(--fair)} .na{color:var(--ink2)} .neg{color:var(--rich)}
    .blocks{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:16px;margin-top:12px} .block{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px} .block ol{padding-left:20px;margin:6px 0 0} .block li{margin:6px 0} .block.verdict{margin-top:16px;border-color:#3a4a60} .block.verdict p{margin:6px 0}
    section.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px 18px 12px;margin:22px 0}
    .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:10px 0 8px} .kpis div{background:#0a0e14;border:1px solid var(--line);border-radius:8px;padding:8px 10px} .kpis span{display:block;color:var(--ink2);font-size:11px;letter-spacing:.04em;text-transform:uppercase} .kpis b{display:block;font-size:17px;margin-top:2px} .kpis small{display:block;color:var(--ink2);font-size:10.5px;margin-top:2px} .kpis.small b{font-size:15px}
    .fn{color:var(--ink2);font-size:12px;margin:4px 0} ul.notes{color:var(--ink2);font-size:12.5px;padding-left:18px;margin:8px 0} ul.notes li{margin:4px 0}
    details{margin:24px 0;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 16px} summary{cursor:pointer;color:var(--cyan);font-weight:600}
    .mono{font-family:ui-monospace,Menlo,monospace;font-size:12px;color:var(--ink2);white-space:normal} .mono p{margin:8px 0}
    a{color:var(--cyan);text-decoration:none} .wrap{overflow-x:auto;max-width:100%} .kpis small{white-space:normal;overflow-wrap:anywhere} h1{overflow-wrap:anywhere}
    @media (max-width:600px){h1{font-size:20px} .kpis{grid-template-columns:1fr 1fr} td,th{padding:6px 7px} .blocks{grid-template-columns:1fr}}
    '''
    page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Memory through the cycle · 20 Oct 2026</title><style>{css}</style></head><body>
    <header><h1>Memory through the cycle · are today's multiples high or low against their own history, and what Micron's US listing is worth</h1>
    <p class="lede"><b>Fetched {esc(fetched)} UTC, 20 Oct 2026, from FMP through the project's own door.</b> Seven names: Micron, SK hynix, Samsung, Kioxia, Western Digital, Sandisk, Nanya. Ten years of trailing P/E, realised forward P/E, EV/sales, EV/EBITDA and price-to-book by month, built from the quarterly statements as the market could have known them; today marked and placed in each name's own history; earnings and gross margin against their own peaks; Micron at the 2018, 2022 and 2025 turns; Micron's premium to the Korean names through the cycle. Every figure is in <code>MEMORY-CYCLE.json</code> beside this page with FMP's raw answers. The rules are under PAGE SPECS at the bottom.</p></header>
    <main>
    <section class="card" id="sector"><h2>Where the sector sits today, each name against its own ten years</h2>
    <img class="chart" src="{b64(os.path.join(out, "charts", "sector-percentiles.png"))}" alt="sector percentiles">
    <table><thead><tr><th>Name</th><th>Trailing P/E · pct</th><th>Fwd P/E (NTM)</th><th>EV/EBITDA · pct</th><th>EV/sales · pct</th><th>P/B · pct</th><th>EPS vs 10-yr high</th><th>EPS vs prior-cycle high</th><th>Gross margin now / prior peak</th><th>NTM EPS vs TTM</th><th>Price-implied EPS vs consensus</th><th>P/E at prior-peak margin</th></tr></thead><tbody>{sec_rows}</tbody></table>
    <p class="fn">Percentiles are within each name's own monthly history (120 months for the five long names, 22 for Kioxia, 20 for Sandisk), meaningful months only. Price-implied EPS = today's price ÷ the name's ten-year median trailing P/E, against consensus NTM EPS. Sector medians: trailing P/E percentile {M["pe_pct"]:.0f}, EV/EBITDA {M["ev_ebitda_pct"]:.0f}, EV/sales {M["ev_sales_pct"]:.0f}, P/B {M["pb_pct"]:.0f}; forward P/E {x(M["pe_fwd"])}; NTM EPS {M["ntm_eps_vs_ttm_x"]:.1f}× trailing; price-implied EPS {M["implied_vs_ntm_eps_pct"]:.0f}% vs consensus.</p>
    </section>
    <section class="card" id="verdict"><h2>Is the multiple low because the cycle is at a peak, or because the market disbelieves the HBM cycle?</h2>
    <img class="chart" src="{b64(os.path.join(out, "charts", "MU-two-readings.png"))}" alt="Micron at each turn of the cycle">
    {verdict}
    </section>
    {cards}
    {us}
    {pricing}
    {notdone}
    {specs}
    </main>
    <script>window.CW5_PAGE_READY=true;</script></body></html>'''
    page = page.replace("<table>", '<div class="wrap"><table>').replace("</table>", "</table></div>")
    open(os.path.join(out, "MEMORY-CYCLE.html"), "w").write(page)
    print("page", len(page) // 1024, "KB")

if __name__ == "__main__":
    main()

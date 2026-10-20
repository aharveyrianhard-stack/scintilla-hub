#!/usr/bin/env python3
"""CW3 · the page. Self-contained HTML: the summary (23 ranked cheapest → richest), the closer-look five and the richest five,
one card per name (business line and headline figures · the peer set with reasons · the table with medians and the name's
premium/discount · the football field PNG inlined · the verdict · the pre-profit facts for a loss-maker), what was not done,
and PAGE SPECS folded at the bottom. No script beyond a ready flag; no network.
usage: python3 page.py <deliverable dir>"""
import json, os, sys, base64, html, datetime as dt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from verdicts import VERDICTS

def esc(s): return html.escape(str(s)) if s is not None else ""
def money(v):
    if v is None: return "—"
    a = abs(v); s = "−" if v < 0 else ""
    if a >= 1e12: return f"{s}${a/1e12:.2f}T"
    if a >= 1e9: return f"{s}${a/1e9:.1f}B"
    if a >= 1e6: return f"{s}${a/1e6:.0f}M"
    return f"{s}${a:,.0f}"
def px(v, ccy="USD"):
    if v is None: return "—"
    if ccy not in ("USD", None): return f"{v:,.0f} {ccy}" if v >= 100 else f"{v:,.2f} {ccy}"
    return f"${v:,.2f}" if v < 100 else f"${v:,.0f}" if v >= 1000 else f"${v:,.1f}"
def mult(v, nm=False):
    if v is None: return '<span class="na">—</span>'
    s = f"{v:.1f}×" if abs(v) < 100 else f"{v:,.0f}×"
    return f'<span class="nm" title="not meaningful: left out of the median">{s} n.m.</span>' if nm else s
def pct(v, signed=False):
    if v is None: return '<span class="na">—</span>'
    s = f"{v:+.0f}%" if signed else f"{v:.0f}%"
    return f'<span class="neg">({abs(v):.0f}%)</span>' if v < 0 and not signed else s
def prem(v):
    if v is None: return '<span class="na">—</span>'
    cls = "cheap" if v <= -15 else ("rich" if v >= 15 else "fair")
    return f'<span class="prem {cls}">{v:+.0f}%</span>'
def ratio(v):
    if v is None: return '<span class="na">—</span>'
    return f"{v:.1f}×" if v >= 0 else f"net cash ({abs(v):.1f}×)"

def b64(path):
    return "data:image/png;base64," + base64.b64encode(open(path, "rb").read()).decode()

COLS = [("pe", "Fwd P/E"), ("ev_sales", "EV/sales"), ("ev_ebitda", "EV/EBITDA"), ("peg", "PEG"), ("rev_growth_ntm_pct", "Rev growth NTM"), ("gross_margin_ttm_pct", "Gross margin"), ("ebit_margin_pct", "EBIT margin"), ("net_debt_ebitda", "Net debt/EBITDA")]

def table(n):
    c = n["company"]; m = c["m"]; loss = c["loss_maker"]
    cols = COLS + ([("ev_gp", "EV/gross profit")] if loss else [])
    head = "".join(f"<th>{h}</th>" for _, h in cols)
    def cell(k, mm, nm, basis_fwd):
        v = mm.get(k)
        if k in ("rev_growth_ntm_pct", "gross_margin_ttm_pct", "ebit_margin_pct"):
            s = pct(v)
            if k == "ebit_margin_pct" and mm.get("ebit_margin_basis") == "TTM" and v is not None: s += '<sup class="t">T</sup>'
            return s
        if k == "net_debt_ebitda": return ratio(v)
        s = mult(v, nm)
        if k == "pe" and mm.get("pe_basis") == "TTM" and v is not None: s += '<sup class="t">T</sup>'
        if k in ("ev_sales", "ev_ebitda") and mm.get(k + "_basis") == "TTM" and v is not None: s += '<sup class="t">T</sup>'
        return s
    rows = []
    rows.append(f'<tr class="self"><td><b>{esc(n["ticker"])}</b><div class="sub">{esc(c["name"])}</div></td><td>{px(c["price"], c["trading_ccy"])}</td><td>{money(c["mcap_usd"])}</td><td>{money(c["ev_usd"])}</td>' + "".join(f"<td>{cell(k, m, False, c['forward_basis'])}</td>" for k, _ in cols) + "</tr>")
    for p in n["peers"]:
        pm = p["m"]; nm = p.get("nm", {})
        flags = []
        if not p["in_universe"]: flags.append('<span class="flag" title="not on the Hub\'s universe (tickers table)">off-Hub</span>')
        if p.get("fx_date"): flags.append(f'<span class="flag" title="market cap and EV in USD at FMP\'s rate of {esc(p["fx_date"])}">{esc(p["trading_ccy"])} @ FX {esc(p["fx_date"][:10])}</span>')
        if not p["forward_basis"]: flags.append('<span class="flag warn">no estimate · trailing (T)</span>')
        if p["loss_maker"]: flags.append('<span class="flag">loss-maker</span>')
        for i in p.get("issues", []): flags.append(f'<span class="flag warn">{esc(i)}</span>')
        rows.append(f'<tr><td><b>{esc(p["ticker"])}</b><div class="sub">{esc(p["name"])}</div><div class="why">{esc(p["why"])}</div><div class="flags">{" ".join(flags)}</div></td><td>{px(p["price"], p["trading_ccy"])}</td><td>{money(p["mcap_usd"])}</td><td>{money(p["ev_usd"])}</td>' + "".join(f"<td>{cell(k, pm, nm.get(k, False), p['forward_basis'])}</td>" for k, _ in cols) + "</tr>")
    med = n["median"]; cnt = n["n"]
    def medcell(k):
        v = med.get(k)
        if v is None: return f'<span class="na">— <small>({cnt.get(k, 0)} of {len(n["peers"])})</small></span>'
        if k in ("rev_growth_ntm_pct", "gross_margin_ttm_pct", "ebit_margin_pct"): s = pct(v)
        elif k == "net_debt_ebitda": s = ratio(v)
        else: s = mult(v)
        return f'{s} <small>({cnt[k]} of {len(n["peers"])})</small>'
    rows.append('<tr class="med"><td>Peer median <div class="sub">(peers only; n.m. and missing left out)</div></td><td></td><td></td><td></td>' + "".join(f"<td>{medcell(k)}</td>" for k, _ in cols) + "</tr>")
    pr = n["premium_pct"]
    rows.append('<tr class="prem"><td>' + esc(n["ticker"]) + ' vs median</td><td></td><td></td><td></td>' + "".join(f"<td>{prem(pr.get(k)) if k in pr else ''}</td>" for k, _ in cols) + "</tr>")
    return f'<div class="tw"><table class="comps"><thead><tr><th>Name · why it is a peer</th><th>Price</th><th>Mkt cap</th><th>EV</th>{head}</tr></thead><tbody>{"".join(rows)}</tbody></table></div>'

def card(n, D):
    t = n["ticker"]; c = n["company"]; m = c["m"]; N = c["ntm"]; v = VERDICTS[t]; an = n["analysts"]
    imp = n["implied"]
    head = f'''<div class="head"><div><span class="tk">{esc(t)}</span> <span class="nm2">{esc(c["name"])}</span>
      <span class="read {n["read"] or "none"}">{esc((n["read"] or "unpriced").upper())}</span>{' <span class="loss">LOSS-MAKER · EV/sales and EV/gross profit</span>' if c["loss_maker"] else ''}</div>
      <div class="biz">{esc(n["business"])}</div></div>
    <div class="kpis">
      <div><span>Price</span><b>{px(c["price"])}</b><small>{esc(c["quote_utc"] or "")}</small></div>
      <div><span>Market cap</span><b>{money(c["mcap_usd"])}</b></div>
      <div><span>EV</span><b>{money(c["ev_usd"])}</b><small>net debt {money(c["net_debt_usd"])} · b/s {esc(c["bs_date"])}</small></div>
      <div><span>Revenue growth NTM</span><b>{pct(m["rev_growth_ntm_pct"])}</b><small>NTM {money(N["revenue"])} vs TTM {money(c["ttm"]["revenue"])}</small></div>
      <div><span>EBIT margin {esc(m["ebit_margin_basis"])}</span><b>{pct(m["ebit_margin_pct"])}</b><small>{esc(N["basis"])}{(" · FY1 " + esc(N["fy1"]) + " w=" + str(N["w"])) if N["fy1"] else ""} · {esc(N["n_rev"] or "?")} analysts</small></div>
      <div><span>Analysts</span><b>{px(an.get("median") or an.get("consensus"))}</b><small>low {px(an.get("low"))} · high {px(an.get("high"))} · {esc(an.get("last_quarter_n") or "?")} in last quarter · {esc(an["grades"].get("consensus") or "")}</small></div>
    </div>'''
    rows_html = "".join(f'<tr><td>{esc(r["label"])}</td><td>{r["median"]:.2f}× <small>({r["n"]} peers)</small></td><td><b>{px(r["price"])}</b></td><td>{pct((r["price"]/c["price"]-1)*100, True) if c["price"] else ""}</td></tr>' for r in imp.values())
    field = f'<img class="field" alt="{esc(t)} football field" src="{b64(os.path.join(D, "fields", t + ".png"))}">' if os.path.exists(os.path.join(D, "fields", t + ".png")) else '<p class="na">no field: nothing priceable</p>'
    notes = []
    if n.get("peg_note"): notes.append(esc(n["peg_note"]))
    if not c["forward_basis"]: notes.append("No forward estimate on FMP for the name itself: trailing used, marked T.")
    for i in c.get("issues", []): notes.append(esc(i))
    fmp_p = n.get("fmp_peers") or []
    used = [p["ticker"] for p in n["peers"]]
    shared = [p for p in fmp_p if p in used]
    notes.append(f'FMP\'s own peer list for {esc(t)}: {esc(", ".join(fmp_p) or "none")} — {len(shared)} of them used here ({esc(", ".join(shared) or "none")}); the rest were left out as a different business or a different cycle, and the set above was chosen from the business line, not the tag.')
    implied = f'''<div class="imp"><table class="implied"><thead><tr><th>Row</th><th>Peer median</th><th>Implied price</th><th>vs today</th></tr></thead><tbody>{rows_html}
      <tr class="mid"><td>Midpoint (geometric middle of lowest and highest row)</td><td></td><td><b>{px(n["midpoint"])}</b></td><td>{pct(n["distance_pct"], True) if n["distance_pct"] is not None else ""} <small>price to midpoint</small></td></tr>
      <tr><td>Analysts · low · median · high</td><td>{esc(an.get("last_quarter_n") or "?")} targets last quarter</td><td><b>{px(an.get("low"))} · {px(an.get("median") or an.get("consensus"))} · {px(an.get("high"))}</b></td><td>{pct(((an.get("median") or an.get("consensus") or 0)/c["price"]-1)*100, True) if (an.get("median") or an.get("consensus")) and c["price"] else ""}</td></tr>
    </tbody></table></div>'''
    verdict = f'''<div class="verdict"><h4>Verdict</h4><p>{esc(v["s"][0])}</p><p>{esc(v["s"][1])}</p><p>{esc(v["s"][2])}</p>
      <p class="blind"><b>What comps cannot see here:</b> {esc(v["blind"])}</p></div>'''
    pp = ""
    if n["pre_profit"]:
        p = n["pre_profit"]
        run = f'{p["runway_quarters"]:.1f} quarters' if p["runway_quarters"] else ("not burning on the last four quarters" if p["not_burning"] else "—")
        run2 = f'{p["runway_quarters_latest_basis"]:.1f} quarters' if p["runway_quarters_latest_basis"] else "not burning in the latest quarter"
        q = " · ".join(f'{esc(x["date"])}: FCF {money(x["fcf"])}' for x in p["fcf_quarters"])
        pp = f'''<div class="pp"><h4>Pre-profit facts (same measures as the 13 Oct pre-profit page: burn = free cash flow, runway = cash and short-term investments ÷ burn per quarter)</h4>
        <div class="kpis small">
          <div><span>Cash + short-term investments</span><b>{money(p["cash_usd"])}</b></div>
          <div><span>Total debt</span><b>{money(p["debt_usd"])}</b></div>
          <div><span>Free cash flow, last 4 quarters</span><b>{money(p["fcf_4q_usd"])}</b><small>{esc(q)}</small></div>
          <div><span>Burn per quarter (4-quarter average)</span><b>{money(p["burn_per_quarter_usd"]) if p["burn_per_quarter_usd"] else "not burning"}</b><small>latest quarter: {money(p["burn_latest_quarter_usd"]) if p["burn_latest_quarter_usd"] else "not burning"}</small></div>
          <div><span>Runway</span><b>{esc(run)}</b><small>on the latest quarter alone: {esc(run2)}</small></div>
          <div><span>Lock-up</span><b>{esc(p["lockup_end"]) if p["lockup_end"] else "none pending"}</b><small>listed {esc(p["ipo_date"] or "?")} · float {esc(f"{p['float_pct']:.0f}%" if p["float_pct"] else "?")}</small></div>
        </div></div>'''
    return f'''<section class="card" id="c-{esc(t)}">{head}
    <h4>Peer set · chosen by business ({len(n["peers"])} names)</h4>{table(n)}
    <h4>Football field</h4><div class="fieldwrap">{field}{implied}</div>
    {verdict}{pp}
    <div class="notes">{"".join(f"<p>{x}</p>" for x in notes)}</div>
    </section>'''

def summary(d):
    rows = ""
    for i, s in enumerate(d["summary"], 1):
        g = s["growth"]; pg = s["peer_growth"]; e = s["ebit_margin"]; pe = s["peer_ebit_margin"]
        rows += f'''<tr class="{s["read"]}"><td>{i}</td><td><a href="#c-{esc(s["ticker"])}"><b>{esc(s["ticker"])}</b></a>{' <small>loss</small>' if s["loss_maker"] else ''}</td><td>{px(s["price"])}</td><td>{px(s["midpoint"])}</td><td>{pct(s["distance_pct"], True)}</td><td>{px(s["analyst_median"])}</td>
        <td>{pct(g)} <small>vs {pct(pg)}</small></td><td>{pct(e)} <small>vs {pct(pe)}</small></td><td><span class="read {s["read"]}">{esc(s["read"])}</span></td><td class="rows">{esc(", ".join({"pe": "P/E", "ev_sales": "EV/sales", "ev_ebitda": "EV/EBITDA", "peg": "PEG", "ev_gp": "EV/GP"}.get(r, r) for r in s["rows"]))}</td></tr>'''
    def block(title, items, why):
        li = "".join(f'<li><a href="#c-{esc(s["ticker"])}"><b>{esc(s["ticker"])}</b></a> {px(s["price"])} → midpoint {px(s["midpoint"])} ({pct(s["distance_pct"], True)}) · growth {pct(s["growth"])} vs peers {pct(s["peer_growth"])} · analysts {px(s["analyst_median"])}</li>' for s in items)
        return f'<div class="block"><h3>{title}</h3><p class="why">{why}</p><ol>{li or "<li>none</li>"}</ol></div>'
    return f'''<section id="summary">
    <h2>The 23, cheapest → richest, by distance from the comps midpoint</h2>
    <div class="tw"><table class="rank"><thead><tr><th>#</th><th>Name</th><th>Price</th><th>Midpoint</th><th>Price to midpoint</th><th>Analysts' median</th><th>Rev growth NTM vs peers</th><th>EBIT margin vs peers</th><th>Read</th><th>Rows priced</th></tr></thead><tbody>{rows}</tbody></table></div>
    <div class="blocks">{block("Worth a closer look: cheap on comps and growing faster than its peers", d["closer_look"], "Price more than 15% under the midpoint of its own implied prices, and NTM revenue growth above the peer median.")}
    {block("The five richest", d["richest"], "Price furthest above the midpoint. Each card says what the premium is paying for.")}</div>
    </section>'''

def main():
    D = sys.argv[1]; d = json.load(open(os.path.join(D, "COMPS-RADAR.json")))
    order = [s["ticker"] for s in d["summary"]] + d["unranked"]
    cards = "".join(card(d["names"][t], D) for t in order)
    rules = esc(d["rules"]).replace("\n", "<br>")
    foreign = ", ".join(f'{esc(k)} ({esc(v["name"])}, {esc(v["ccy"])})' for k, v in json.load(open(os.path.join(D, "peers.json")))["foreign"].items())
    fx = d["fx"]; fxrows = "".join(f'<li>{esc(k)}: {v["price"]} (FMP quote, {esc(fx["date"])})</li>' for k, v in fx["quotes"].items())
    not_done = '''<ul>
    <li>Peers were chosen by business line from the universe first, then from outside it where the true peer is foreign or off the Hub (SK hynix, Samsung, Kioxia, Nanya, MediaTek, SMIC, Komatsu, Innolight, Eoptolink, IQE, Soitec). No size band was applied; a peer that is a tenth or ten times the size stays in with its reason printed, and the medians carry the count.</li>
    <li>Multiples are FMP's consensus and statements, not the Hub's stored tables. The Hub's tag-based peer sets were not used (CW2's twelve breaks are the reason); FMP's own peer list is printed on each card for the record, with how many of its names were kept.</li>
    <li>The NTM blend is a time-weighted mix of two fiscal-year consensus rows, not a quarter-by-quarter build; for a name whose fiscal year ends within weeks (Broadcom, Micron, Qualcomm, Walmart) the NTM is almost entirely the next fiscal year.</li>
    <li>Gross margin and net debt/EBITDA are trailing (consensus carries neither). EV/gross profit for the loss-makers is trailing. The PEG uses net-income growth NTM over TTM, not EPS growth, so buybacks are not in it.</li>
    <li>Forward P/E is market cap ÷ NTM net income, which bypasses ADR ratios and FMP share counts; it differs from price ÷ consensus EPS where the share count has moved (Cerebras, Eoptolink, Fluence are flagged for a 1.4–1.5× gap between market cap and price × diluted shares).</li>
    <li>Analysts' low · median · high are FMP's price-target consensus across all targets on file; the count shown is the last quarter's. The Hub's own checked-target table was not re-read tonight.</li>
    <li>Lock-up dates are computed only as listing date + 180 days when the listing is within a year (none of the 23 qualifies tonight: Cerebras's listing date on FMP's profile is the one printed on its card). Secondary lock-ups from follow-on offerings are not on FMP and were not sought.</li>
    <li>No live Hub page was driven; nothing was deployed; no table was written; no key is printed in any file. The 13 Oct pre-profit page's measures were followed (free-cash-flow burn, runway in quarters) but its EDGAR cross-check was not re-run.</li>
    <li>The RADAR list read tonight has 24 rows (AXTI joined since the brief was written); BTCUSD is left out as a coin, so 23 cards.</li>
    </ul>'''
    specs = f'''<details id="specs"><summary>PAGE SPECS · the rules, the sources, the FX, the tools</summary>
    <h4>Rules</h4><p class="mono">{rules}</p>
    <h4>Sources</h4><ul><li>FMP through the project's fmp-proxy edge function (stable routes: quote/batch-quote, profile, analyst-estimates annual, income-statement-ttm, balance-sheet-statement quarter, key-metrics-ttm; for the 23 also price-target-consensus, price-target-summary, grades-consensus, shares-float, cash-flow-statement quarter ×4, stock-peers). {d["fmp_calls"]} calls, {esc(d["fetch_utc_first"])} to {esc(d["fetch_utc_last"])} UTC, by status {esc(json.dumps(d["fmp_calls_by_status"]))}. Every answer is in COMPS-RADAR.json under <code>raw</code>.</li>
    <li>The RADAR list: <code>station_lists</code> where list = radar, read through the Hub's anon REST path on {esc(d["today"])}. The universe for the off-Hub mark: the Hub's <code>tickers</code> table (613 names).</li>
    <li>Foreign listings and their trading currency: {foreign}. Market cap and EV are stated in USD at FMP's quote of {esc(fx["date"])}; multiples are computed in the reporting currency so no rate enters them (SMIC and IQE report in USD; IQE's London quote is in pence).</li></ul>
    <h4>FX used</h4><ul>{fxrows}</ul>
    <h4>Tools</h4><p><code>tools/peers.py</code> the peer sets and reasons · <code>tools/fetch_fmp.py</code> the fetch (GET only, key read at run time from the release's index.html, never written) · <code>tools/compute.py</code> every figure · <code>tools/fields.py</code> the football fields (matplotlib) · <code>tools/verdicts.py</code> the verdicts · <code>tools/page.py</code> this page. Deterministic from the raw answers.</p>
    <p>Lane: SCINTILLA-20261019-CW3 · branch hub/cw3-comps-done-20261019 off hub/release-20260923 @7b66061 · built {esc(d["built_utc"])} UTC.</p>
    </details>'''
    css = '''
    :root{--bg:#0a0e14;--card:#0e131b;--line:#263040;--ink:#e6e9ef;--ink2:#9aa3b2;--cyan:#00d4ff;--cheap:#199e70;--rich:#e66767;--fair:#c98500;--blue:#3987e5}
    *{box-sizing:border-box} html{scroll-behavior:smooth}
    body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 -apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif;padding:0 16px 48px}
    header{padding:28px 0 12px;border-bottom:1px solid var(--line);margin-bottom:18px}
    h1{font-size:24px;margin:0 0 6px;font-weight:700} h2{font-size:19px;margin:28px 0 10px} h3{font-size:16px;margin:0 0 6px} h4{font-size:12.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink2);margin:18px 0 8px}
    .lede{color:var(--ink2);max-width:1100px} .lede b{color:var(--ink)}
    .tw{overflow-x:auto;max-width:100%;border:1px solid var(--line);border-radius:8px}
    table{border-collapse:collapse;width:100%;font-size:13px;font-variant-numeric:tabular-nums} th{background:#121a25;color:var(--ink2);font-weight:600;text-align:right;padding:8px 10px;white-space:nowrap;position:sticky;top:0} th:first-child,td:first-child{text-align:left}
    td{padding:7px 10px;border-top:1px solid var(--line);text-align:right;white-space:nowrap;vertical-align:top}
    tr.self td{background:#13202e;font-weight:600} tr.med td{background:#121a25;color:var(--ink);font-weight:600} tr.prem td{background:#0f1620}
    .sub{color:var(--ink2);font-weight:400;font-size:11.5px;white-space:normal;max-width:260px} .why{color:var(--blue);font-size:11.5px;white-space:normal;max-width:260px} .flags{white-space:normal;max-width:260px}
    .flag{display:inline-block;font-size:10.5px;color:var(--ink2);border:1px solid var(--line);border-radius:4px;padding:0 5px;margin:2px 2px 0 0} .flag.warn{color:var(--fair);border-color:var(--fair)}
    .na{color:#5c6675} .nm{color:#5c6675;text-decoration:line-through dotted} .neg{color:var(--rich)} sup.t{color:var(--fair);font-size:9px;margin-left:2px}
    .prem.cheap{color:var(--cheap)} .prem.rich{color:var(--rich)} .prem.fair{color:var(--fair)}
    .read{display:inline-block;font-size:11px;letter-spacing:.08em;padding:2px 8px;border-radius:4px;border:1px solid;vertical-align:middle;margin-left:8px}
    .read.cheap{color:var(--cheap);border-color:var(--cheap)} .read.rich{color:var(--rich);border-color:var(--rich)} .read.fair{color:var(--fair);border-color:var(--fair)} .read.none{color:var(--ink2);border-color:var(--ink2)}
    table.rank tr.cheap td:nth-child(5){color:var(--cheap)} table.rank tr.rich td:nth-child(5){color:var(--rich)} table.rank tr.fair td:nth-child(5){color:var(--fair)} td.rows{color:var(--ink2);font-size:11.5px}
    .blocks{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;margin-top:16px} .block{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px} .block ol{padding-left:20px;margin:6px 0 0} .block li{margin:4px 0} .block .why{color:var(--ink2);font-size:12.5px;margin:0}
    section.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px 18px 10px;margin:22px 0}
    .head .tk{font-size:22px;font-weight:800;letter-spacing:.02em} .head .nm2{color:var(--ink2);font-size:15px;margin-left:6px} .biz{color:var(--ink2);margin-top:4px} .loss{color:var(--fair);font-size:11px;letter-spacing:.06em;margin-left:8px}
    .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:14px 0 4px} .kpis div{background:#0a0e14;border:1px solid var(--line);border-radius:8px;padding:8px 10px} .kpis span{display:block;color:var(--ink2);font-size:11px;letter-spacing:.04em;text-transform:uppercase} .kpis b{display:block;font-size:17px;margin-top:2px} .kpis small{display:block;color:var(--ink2);font-size:10.5px;margin-top:2px} .kpis.small b{font-size:14px}
    .fieldwrap{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(300px,1fr);gap:16px;align-items:start} img.field{width:100%;height:auto;border-radius:8px;border:1px solid var(--line)}
    table.implied td,table.implied th{white-space:normal} table.implied tr.mid td{background:#121a25;font-weight:600}
    .verdict{margin-top:14px;border-left:3px solid var(--cyan);padding:2px 0 2px 14px;max-width:1100px} .verdict p{margin:6px 0;font-size:14.5px} .blind{color:var(--ink2)}
    .pp{margin-top:8px} .notes{color:var(--ink2);font-size:12px;margin-top:10px} .notes p{margin:4px 0}
    a{color:var(--cyan);text-decoration:none} .mono{font-family:ui-monospace,Menlo,monospace;font-size:12px;color:var(--ink2);white-space:normal}
    details{margin-top:36px;border-top:1px solid var(--line);padding-top:12px;color:var(--ink2)} summary{cursor:pointer;color:var(--ink);font-weight:600} details ul{padding-left:20px}
    @media (max-width:900px){.fieldwrap{grid-template-columns:1fr}}
    '''
    page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>RADAR comps · 19 Oct 2026</title><style>{css}</style></head><body>
    <header><h1>The comps: 23 RADAR names against the peers that share their business</h1>
    <p class="lede"><b>Fetched {esc(d["fetch_utc_first"][:16].replace("T", " "))}–{esc(d["fetch_utc_last"][11:16])} UTC, 19 Oct 2026 (evening ET), from FMP through the project's own door.</b> One forward basis (next twelve months, consensus). Peer sets chosen by business, 5–8 names each, reason printed. Medians, premium/discount, implied price per multiple, the analysts' range, today's price, a verdict in three sentences and the thing a peer table cannot see. Loss-makers on EV/sales and EV/gross profit with their cash, debt, burn and runway. The rules and the sources are under PAGE SPECS at the bottom; every figure is in <code>COMPS-RADAR.json</code> beside this page with FMP's raw answers.</p></header>
    {summary(d)}
    <h2>The cards, in the order above</h2>
    {cards}
    <h2>What was not done</h2>{not_done}
    {specs}
    <script>window.CW3_PAGE_READY=true</script></body></html>'''
    open(os.path.join(D, "COMPS-RADAR.html"), "w").write(page)
    print("page", len(page) // 1024, "KB")

if __name__ == "__main__":
    main()

# GH1 · builds GEIGER-HISTORY.html (inline SVG pictures, plain words) and data/gh1-data.json from the computed files.
import json, os, sys, pickle, html, numpy as np, datetime as dtm
from syms import COHORTS, ALL
OUTDIR = os.environ.get("GH1_OUT", "/Users/alanharvey/SCINTILLA 0.5/_worktrees/gh1-geiger-history-20261006/deliverables/20261006/geiger-history")
RES = pickle.load(open("replay.pkl", "rb")); C = json.load(open("gh1-core.json")); FUND = json.load(open("gh1-fund.json"))
PC = json.load(open("pine-check.json")); CC = json.load(open("pine-compile-check.json")); S = C["stats"]
PI = json.load(open("pine-check-intraday.json")); VS = json.load(open("validate-stored.json")); LAT = json.load(open("lattice-survey.json"))["phase"]; NB_ = sum(1 for v in LAT.values() if v == 1); NA_ = sum(1 for v in LAT.values() if v == 2)
BULL, BEAR = "#00FFA3", "#FF2D55"; INK, INK2, INK3, LINE, PANEL = "#d2d2d2", "#b4b4b8", "#8c8c92", "#2a2a30", "#121216"
e = html.escape
def sg(x, n=2):
    if x is None: return "—"
    s = f"{abs(x):.{n}f}"; return ("+" if x >= 0 else "−") + s
def col(x): return INK3 if x is None else (BULL if x >= 0 else BEAR)
def gv(x, n=2, cls=""): return f'<span class="g {cls}" style="color:{col(x)}">{sg(x, n)}</span>'
def pc(x): return "—" if x is None else (f"{x:.0f}" if x >= 1 else f"{x:.1f}")
def ordn(x):
    if x is None: return "—"
    n = int(round(x)); n = max(n, 0); suf = "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return ("under the 1st" if x < 0.5 else f"{n}{suf}")
def dnice(d, yr=True):
    x = dtm.date.fromisoformat(d); return f"{x.day} {x.strftime('%b')}" + (f" {x.year}" if yr else "")
def pct(x, n=0):
    if x is None: return "—"
    if round(abs(x), n) == 0: return "0%"
    return ("+" if x >= 0 else "−") + f"{abs(x):.{n}f}%"
def main_idx(o): return np.where((o["nr"] == 7) & np.isfinite(o["g"]))[0]
CH = [0]
def _svg(key, d, g, title, w, h, L, R, today, marks, bands, tick_ks, cls):
    n = len(g); T, B = 26, 26; pw = w - L - R; ph = h - T - B
    X = lambda k: L + (pw * k / max(n - 1, 1)); Y = lambda v: T + ph * (1 - (v + 1) / 2)
    pts = " ".join(f"{X(k):.1f},{Y(v):.1f}" for k, v in enumerate(g)); z = Y(0); cid = f"{key}{cls[0]}"
    area = f"M{X(0):.1f},{z:.1f} L" + " L".join(f"{X(k):.1f},{Y(v):.1f}" for k, v in enumerate(g)) + f" L{X(n-1):.1f},{z:.1f} Z"
    s = [f'<svg class="hist" data-key="{key}" viewBox="0 0 {w} {h}" width="100%" role="img" aria-label="{e(title)}" style="min-width:{760 if w > 900 else w}px;display:block" data-l="{L}" data-pw="{pw}" data-n="{n}">']
    s.append(f'<defs><clipPath id="{cid}u"><rect x="{L}" y="{T}" width="{pw}" height="{z-T:.1f}"/></clipPath><clipPath id="{cid}d"><rect x="{L}" y="{z:.1f}" width="{pw}" height="{T+ph-z:.1f}"/></clipPath></defs>')
    for a_, b_, lab in bands:
        ks = [k for k, x in enumerate(d) if a_ <= x <= b_]
        if ks: s.append(f'<rect x="{X(ks[0])-3:.1f}" y="{T}" width="{max(X(ks[-1])-X(ks[0])+6,6):.1f}" height="{ph}" fill="#1e1e25"/><text x="{(X(ks[0])+X(ks[-1]))/2:.1f}" y="{T-8}" fill="{INK3}" font-size="11" text-anchor="middle">{e(lab)}</text>')
    for v in (1, 0.5, 0, -0.5, -1):
        s.append(f'<line x1="{L}" y1="{Y(v):.1f}" x2="{L+pw}" y2="{Y(v):.1f}" stroke="{"#3a3a42" if v == 0 else "#1c1c22"}" stroke-width="1"/><text x="{L-8}" y="{Y(v)+4:.1f}" fill="{INK3}" font-size="11" text-anchor="end">{sg(v,1) if v else "0"}</text>')
    # time labels: years on a long chart, months (the year at each January and at the left edge) on a short one; never closer than 46 px
    months = []; seen = set()
    for k, x in enumerate(d):
        if x[:7] not in seen: seen.add(x[:7]); months.append((k, x))
    long = len(months) > 30; lastx = -99
    for k, x in months:
        if long and x[5:7] != "01" and k != 0: continue
        first = (k == 0); lab = x[:4] if (long or x[5:7] == "01") else dtm.date.fromisoformat(x).strftime("%b")
        if first and not long: lab = dtm.date.fromisoformat(x).strftime("%b %Y")
        px = X(k)
        if px - lastx < (66 if lastx <= L + 1 and not long else 46): continue
        if px > L + pw - 20: continue
        if k > 0: s.append(f'<line x1="{px:.1f}" y1="{T+ph}" x2="{px:.1f}" y2="{T+ph+5}" stroke="{LINE}"/>')
        s.append(f'<text x="{px+3:.1f}" y="{T+ph+18}" fill="{INK3}" font-size="11">{lab}</text>'); lastx = px
    s.append(f'<path d="{area}" fill="{BULL}" opacity=".10" clip-path="url(#{cid}u)"/><path d="{area}" fill="{BEAR}" opacity=".12" clip-path="url(#{cid}d)"/>')
    s.append(f'<polyline points="{pts}" fill="none" stroke="{BULL}" stroke-width="1.6" stroke-linejoin="round" clip-path="url(#{cid}u)"/><polyline points="{pts}" fill="none" stroke="{BEAR}" stroke-width="1.6" stroke-linejoin="round" clip-path="url(#{cid}d)"/>')
    for k in tick_ks: s.append(f'<line x1="{X(k):.1f}" y1="{T+ph-8}" x2="{X(k):.1f}" y2="{T+ph}" stroke="{INK2}" stroke-width="1.2"/>')
    if today is not None:
        s.append(f'<line x1="{L}" y1="{Y(today):.1f}" x2="{L+pw}" y2="{Y(today):.1f}" stroke="{INK3}" stroke-width="1"/>')
        s.append(f'<circle cx="{X(n-1):.1f}" cy="{Y(g[-1]):.1f}" r="4.5" fill="{col(g[-1])}" stroke="{PANEL}" stroke-width="2"/><text x="{L+pw+10}" y="{Y(today)+4:.1f}" fill="{INK}" font-size="12">tonight {sg(today)}</text>')
    tw_ = len(title) * 8.4 + 30
    for md, lab in marks:
        ks = [k for k, x in enumerate(d) if x >= md]
        if not ks: continue
        px = X(ks[0]); s.append(f'<line x1="{px:.1f}" y1="{T-4}" x2="{px:.1f}" y2="{T+ph}" stroke="{INK3}" stroke-width="1"/>')
        s.append(f'<text x="{max(px+6, L+tw_):.1f}" y="{T-8}" fill="{INK2}" font-size="11">{e(lab)}</text>')
    s.append(f'<text x="{L}" y="{T-8}" fill="{INK}" font-size="12" letter-spacing="1.2">{e(title)}</text>')
    s.append(f'<line class="hx" x1="0" y1="{T}" x2="0" y2="{T+ph}" stroke="{INK2}" stroke-width="1" visibility="hidden"/><rect class="hit" x="{L}" y="{T}" width="{pw}" height="{ph}" fill="transparent"/></svg>')
    return "".join(s)
def chart(sym, since, title, h=250, today=None, marks=(), bands=(), below=None, ticks_from=None, note="", short=None):
    """One name's daily Geiger as a line around zero (green above, red below). One axis: -1 to +1.
       Drawn twice: 1500 wide for a desk screen, 760 wide for a phone, so the labels keep their size on both."""
    o = RES[sym]; ix = main_idx(o); ix = ix[[o["date"][i] >= since for i in ix]]
    d = [o["date"][i] for i in ix]; g = o["g"][ix]; CH[0] += 1; key = f"c{CH[0]}"
    tk = [] if below is None else [k for k, v in enumerate(g[:-1]) if v < below and (ticks_from is None or d[k] >= ticks_from)]
    wide = _svg(key, d, g, title, 1500, h, 46, 150, today, marks, bands, tk, "wide")
    narrow = _svg(key, d, g, short or title, 760, h, 40, 108, today, marks, bands, tk, "narrow")
    cap = f'<figcaption>{e(note)}</figcaption>' if note else ""
    js = f'<script type="application/json" data-for="{key}">{json.dumps({"d": d, "g": [round(float(v), 3) for v in g], "sym": sym}, separators=(",", ":"))}</script>'
    return f'<figure class="chartw"><div class="ntitle">{e(title)}</div><div class="tw wide">{wide}</div><div class="tw narrow">{narrow}</div>{cap}{js}</figure>'
def spark(sym, yrs=3, w=120, h=24):
    o = RES[sym]; ix = main_idx(o)[-252 * yrs:]
    if len(ix) < 30: return ""
    g = o["g"][ix][::5]; n = len(g); pts = " ".join(f"{w*k/(n-1):.0f},{h*(1-(v+1)/2):.0f}" for k, v in enumerate(g))
    return f'<svg viewBox="0 0 {w} {h}" width="{w}" height="{h}" aria-hidden="true"><line x1="0" y1="{h/2}" x2="{w}" y2="{h/2}" stroke="#2a2a30"/><polyline points="{pts}" fill="none" stroke="{col(float(g[-1]))}" stroke-width="1.2"/></svg>'
def meter(p, w=64):
    if p is None: return ""
    return f'<svg viewBox="0 0 {w} 8" width="{w}" height="8" aria-hidden="true"><rect x="0" y="3" width="{w}" height="2" fill="#2a2a30"/><rect x="{max(0,min(w-3,p/100*w-1.5)):.1f}" y="0" width="3" height="8" fill="{INK}"/></svg>'

P = C["parabolic"]; WK = C["weeks"]; AS_OF = C["as_of_session"]; V = C["validation"]
nv = S["NVDA"]; mu = P["MU"]; sn = P["SNDK"]; wd = P["WDC"]; av = WK["AVGO"]; nt = C["nvts"]["last90"]
deep = [r for r in nt if r["g"] < -0.5]; ntlow = min(nt, key=lambda r: r["g"])
B = C["bottoms"]; A = {"MU": 0.3728, "SNDK": -0.0908, "WDC": -0.4763, "NVDA": 0.894}
def runs_words(p, k=3):
    rs = sorted(p["runs"], key=lambda r: r["low"]["g"])[:k]
    return "; ".join(f"{dnice(r['low']['date'])} ({sg(r['low']['g'])}, RSI {r['low']['rsi']:.0f}, {pct(r['low']['p200'])} against its 200-day)" for r in rs)
def pct_of(sym, x, n=251):
    o = RES[sym]; ix = main_idx(o); w = o["g"][ix][-n:]; return float((w < x).mean() * 100)
AP = {k: pct_of(k, v) for k, v in A.items()}
H = []
H.append(f"""<section><h2>The short answers</h2><div class="q">
<div class="card"><div class="hd"><span class="tk">NVDA</span><span class="par">"98th percentile of its own year — that's within its Geiger range of the last year, correct?"</span></div>
<p><b>Yes.</b> The percentile is nothing more than where today's reading sits among NVDA's own last 251 evening readings. Over that year NVDA ranged from {sg(nv['1y']['lo'])} ({dnice(nv['1y']['lo_date'])}) to {sg(nv['1y']['hi'])} ({dnice(nv['1y']['hi_date'])}). The {sg(A['NVDA'])} you saw at 15:23 was higher than {AP['NVDA']:.0f}% of them. By the evening it was {gv(nv['g'])}, the <b>{ordn(nv['1y']['pct'])}</b>.</p>
<p><span class="k">zoomed out</span>{ordn(nv['3y']['pct'])} of three years · {ordn(nv['5y']['pct'])} of five · {ordn(nv['all']['pct'])} of its whole {nv['all']['years']:.0f}-year record. Hot for itself on every window, a little less extreme the further back you look.</p></div>
<div class="card"><div class="hd"><span class="tk">MU</span><span class="par">"35th percentile — when was it lower? Since it went parabolic, has it ever been below this?"</span></div>
<p><b>Yes, often.</b> Micron's run began on <b>{dnice(mu['start'])}</b> (its first close 50% above its 200-day, at ${mu['start_row']['close']:,.0f}). In the {mu['sessions_since']} sessions since, the Geiger closed lower than tonight's {gv(mu['today']['g'])} on <b>{mu['below_today']}</b> of them, about one in five, in {len(mu['runs'])} separate stretches.</p>
<p><span class="k">the lowest points of the run</span>{runs_words(mu)}. Even at the worst of them price stayed far above the 200-day.</p>
<p><span class="k">against the reading you saw</span>The {sg(A['MU'])} at 15:23 sits at the {ordn(AP['MU'])} percentile of its year; by the evening it had slipped to {sg(mu['today']['g'])}, the {ordn(S['MU']['1y']['pct'])}. Against {sg(A['MU'])}, {mu['afternoon']['below']} sessions of the run were lower.</p></div>
<div class="card"><div class="hd"><span class="tk">SNDK</span><span class="par">"SanDisk, same"</span></div>
<p><b>Yes, but less often.</b> SanDisk only has a 200-day average since <b>{dnice(sn['start'])}</b>, and on that first day it was already {sn['start_row']['p200']:.0f}% above it, so that is where the run is counted from. Of {sn['sessions_since']} sessions since, <b>{sn['below_today']}</b> closed with a lower Geiger than tonight's {gv(sn['today']['g'])}, about one in nine.</p>
<p><span class="k">the lowest points</span>{runs_words(sn)}.</p>
<p><span class="k">its own year</span>Tonight is the {ordn(S['SNDK']['1y']['pct'])} percentile of its last 251 sessions; its whole record is only {S['SNDK']['all']['n']} sessions.</p></div>
<div class="card"><div class="hd"><span class="tk">WDC</span><span class="par">"…WDC"</span></div>
<p><b>Almost never.</b> Western Digital's run began on <b>{dnice(wd['start'])}</b>. Of {wd['sessions_since']} sessions since, only <b>{wd['below_today']}</b> had a lower Geiger than tonight's {gv(wd['today']['g'])}: {dnice(wd['runs'][0]['from'], False)} to {dnice(wd['runs'][0]['to'])} (low {sg(wd['lowest']['g'])} on {dnice(wd['lowest']['date'], False)}) and {dnice(wd['runs'][-1]['from'])}.</p>
<p><span class="k">where price is</span>{pct(wd['today']['p200'])} against its 200-day tonight, down from {pct(wd['max_p200'])} at the peak on {dnice(wd['max_p200_date'])}. It is the {ordn(S['WDC']['1y']['pct'])} percentile of its own year: the coldest of the three by a distance.</p></div>
<div class="card"><div class="hd"><span class="tk">AVGO</span><span class="par">"the week of March 30th … and the low of the week of September 14th, as a gauge of whether a bottom is in"</span></div>
<p><b>The two lows were the same kind of washout.</b> Monday {dnice(av['mar30']['low']['date'])}: Geiger {gv(av['mar30']['low']['g'])}, lower than all but {av['mar30']['low']['pct_1y']:.1f}% of its previous year, daily RSI {av['mar30']['low']['rsi']:.0f}, {pct(av['mar30']['low']['p200'])} against its 200-day. {dnice(av['sep14']['low']['date'])}: Geiger {gv(av['sep14']['low']['g'])}, lower than all but {av['sep14']['low']['pct_1y']:.1f}%, RSI {av['sep14']['low']['rsi']:.0f}, {pct(av['sep14']['low']['p200'])}.</p>
<p><span class="k">against Broadcom's real bottoms</span>{sg(B['rows']['AVGO']['2025-04-04']['g'])} on 4 Apr 2025 · {sg(B['rows']['AVGO']['2020-03-17']['g'])} on 17 Mar 2020 · {sg(B['rows']['AVGO']['2022-10-17']['low_pm5']['g'])} on {dnice(B['rows']['AVGO']['2022-10-17']['low_pm5']['date'])}. September's {sg(av['sep14']['low']['g'])} sits in that range. It measures how washed out the name was, not what comes next. Tonight AVGO is {gv(S['AVGO']['g'])} ({ordn(S['AVGO']['1y']['pct'])} of its year) and {pct(S['AVGO']['p200'])} against its 200-day.</p></div>
<div class="card"><div class="hd"><span class="tk">NVTS</span><span class="par">"was it deep red recently and is it rising?"</span></div>
<p><b>Yes to both, with a wobble today.</b> Navitas closed below −0.50 on <b>{len(deep)}</b> of the last 90 sessions, from {dnice(deep[0]['date'], False)} to {dnice(deep[-1]['date'])}; the low was {gv(ntlow['g'])} on {dnice(ntlow['date'])} (RSI {ntlow['rsi']:.0f}, {pct(ntlow['p200'])} against its 200-day).</p>
<p><span class="k">since the last deep-red close</span>{" · ".join(f"{dnice(r['date'], False)} {sg(r['g'])}" for r in nt[-15:] if r['date'] in ('2026-09-16','2026-09-22','2026-09-30','2026-10-02','2026-10-05','2026-10-06'))}. Higher lows since mid-September, but tonight gave back most of Monday's level. It is the {ordn(S['NVTS']['1y']['pct'])} percentile of its year and still {pct(S['NVTS']['p200'])} against its 200-day.</p></div>
</div></section>""")
# ---- pictures: the four names against their own history
H.append('<section><h2>1 · Each name against its own history</h2>')
H.append(chart("NVDA", "2021-10-06", "NVDA · daily Geiger, five years", today=nv["g"], note=f"The grey line is tonight's level, {sg(nv['g'])}: the {ordn(nv['1y']['pct'])} percentile of one year, the {ordn(nv['3y']['pct'])} of three, the {ordn(nv['5y']['pct'])} of five."))
for sym, p, since in (("MU", mu, "2025-04-01"), ("SNDK", sn, "2025-04-01"), ("WDC", wd, "2025-04-01")):
    H.append(chart(sym, since, f"{sym} · daily Geiger since April 2025", short=f"{sym} · daily Geiger", today=p["today"]["g"], below=p["today"]["g"], ticks_from=p["start"], marks=[(p["start"], "run begins " + dnice(p["start"]))],
                   note=f"The grey line is tonight's level. The ticks along the bottom are the {p['below_today']} sessions since the run began that closed lower than tonight."))
H.append('</section>')
# ---- the two weeks
H.append('<section><h2>2 · The week of 30 March and the week of 14 September 2026</h2><div class="tw"><table><thead><tr><th class="l">name</th><th>low of 30 Mar – 2 Apr</th><th>own-year pct then</th><th>RSI</th><th>vs 200-day</th><th>low of 14 – 18 Sep</th><th>own-year pct then</th><th>RSI</th><th>vs 200-day</th><th>tonight</th><th>own-year pct</th></tr></thead><tbody>')
for sym in ("AVGO", "NVDA", "MU", "GOOGL", "AMZN"):
    a = WK[sym]["mar30"]["low"]; b = WK[sym]["sep14"]["low"]
    H.append(f"<tr><td>{sym}</td><td>{gv(a['g'])} <span class='d'>{dnice(a['date'], False)}</span></td><td>{pc(a['pct_1y'])}</td><td>{a['rsi']:.0f}</td><td>{pct(a['p200'])}</td><td>{gv(b['g'])} <span class='d'>{dnice(b['date'], False)}</span></td><td>{pc(b['pct_1y'])}</td><td>{b['rsi']:.0f}</td><td>{pct(b['p200'])}</td><td>{gv(S[sym]['g'])}</td><td>{pc(S[sym]['1y']['pct'])}</td></tr>")
H.append('</tbody></table></div>')
for sym in ("AVGO", "NVDA", "MU", "GOOGL", "AMZN"):
    H.append(chart(sym, "2026-01-02", f"{sym} · daily Geiger, 2026", h=190, today=S[sym]["g"], bands=[("2026-03-30", "2026-04-02", "30 Mar week"), ("2026-09-14", "2026-09-18", "14 Sep week")]))
H.append('</section>')
# ---- the seven dates
H.append('<section><h2>3 · The names at the seven bottom dates</h2><div class="tw"><table class="bt"><thead><tr><th class="l">name</th>' + "".join(f"<th>{dnice(D)}</th>" for D in B["dates"]) + "</tr></thead><tbody>")
for t in B["names"]:
    H.append(f"<tr><td>{t}</td>")
    for D in B["dates"]:
        r = B["rows"][t][D]; f = FUND[t][D]
        if r is None: H.append('<td class="na">not listed</td>'); continue
        flag = "" if r["rungs"] == 7 else '<sup>3</sup>'
        if r.get("src") and r["src"] != t: flag += '<sup>G</sup>'
        l2 = f"RSI {r['rsi']:.0f} · {pct(r['p200'])}"
        if not f or f.get("why"): l3 = "—"
        else:
            pe = f"{f['fwd_pe']:.0f}×" if f["fwd_pe"] is not None else ("loss" if f["pe_note"] == "loss ahead" else ("growth" if f["pe_note"] == "reports in another currency" else "—"))
            gr = pct(f["growth"]) if f["growth"] is not None else ("" if f["growth_note"] == "loss ahead" else "from a loss")
            mark = ("<sup>a</sup>" if f.get("method") == "annual" else "") + ("<sup>s</sup>" if f.get("restated") else "") + ("<sup>~</sup>" if f.get("rough") else "") + ("<sup>p</sup>" if f.get("method") == "quarters" and f.get("reported_since", 4) < 4 else "")
            l3 = (pe + ((" " if pe == "growth" else " · ") + gr if gr else "")) + mark
        H.append(f"<td><span class='top'>{gv(r['g'], cls='big')}{flag}</span><span class='l2'>{l2}</span><span class='l3'>{l3}</span></td>")
    H.append("</tr>")
H.append('</tbody></table></div><p class="leg">Each cell: <b>Geiger</b> that evening · daily RSI and the close against the 200-day average · forward P/E and next-twelve-month earnings growth. <sup>3</sup> three slow rungs only (the old ticker QQQQ has no intraday bars on file) · <sup>G</sup> from GOOG, the share that carries Alphabet\'s bars before April 2014 · <sup>a</sup> from two fiscal years, one quarter missing · <sup>s</sup> estimates restated here for later splits · <sup>~</sup> rough: stored to the cent on a much smaller per-share figure · <sup>p</sup> some of the four quarters are not yet reported, so today\'s consensus fills them.</p></section>')
# ---- zoom out: every name
H.append('<section><h2>4 · Zoomed out — every name against one, three and five years of itself</h2><div class="tw tall"><table><thead><tr><th class="l">name</th><th>Geiger tonight</th><th colspan="2">1 year</th><th colspan="2">3 years</th><th colspan="2">5 years</th><th>whole record</th><th>record</th><th>lowest ever</th><th class="l">last 3 years</th></tr></thead><tbody>')
seen = set()
for coh, mem in COHORTS.items():
    rows = [m for m in mem if m in S and m not in seen]
    if not rows: continue
    H.append(f'<tr class="coh"><td colspan="12">{e(coh)}</td></tr>')
    for m in sorted(rows, key=lambda x: -S[x]["g"]):
        seen.add(m); v = S[m]
        def cell(k):
            w = v[k]; short = "" if w["complete"] else f'<span class="d">{w["n"]}</span>'
            return f"<td>{pc(w['pct'])}{short}</td><td class='m'>{meter(w['pct'])}</td>"
        H.append(f"<tr><td>{m}</td><td>{gv(v['g'])}</td>{cell('1y')}{cell('3y')}{cell('5y')}<td>{pc(v['all']['pct'])}</td><td>{v['all']['years']:.1f} y</td><td>{sg(v['all']['lo'])} <span class='d'>{dnice(v['all']['lo_date'])}</span></td><td class='l'>{spark(m)}</td></tr>")
H.append('</tbody></table></div><p class="leg">Percentile = the share of that window\'s evening readings that were lower than tonight\'s. A small grey number beside a percentile is how many sessions the name actually has when it is younger than the window. QRVO is missing: the provider returned no daily bar for it on 6 Oct.</p></section>')
# ---- the Pine oscillator
H.append('<section><h2>5 · The Geiger as a TradingView oscillator</h2>')
H.append('<p><b>File:</b> <code>deliverables/20261006/geiger-history/pine/SCINTILLA-GEIGER-OSCILLATOR.pine</code> — paste-ready, not installed. A line from −1 to +1 in its own pane, green above zero and red below, with TREND and MOMENTUM as optional lines. Plot budget 7 of 64. It compiles on TradingView\'s own compiler with no errors and no warnings.</p>')
H.append(chart("MU", "2025-10-06", "MU · what the pane draws: the Geiger from −1 to +1, one year", short="MU · the pane, one year", h=230, today=S["MU"]["g"], note="Drawn here from the script's own formula run on the Hub's bars. It is not a TradingView screenshot: the script has not been installed."))
H.append('<div class="tw"><table><thead><tr><th class="l">name</th><th class="l">3-day calendar</th><th>sessions compared</th><th class="l">span</th><th>correlation</th><th>average gap</th><th>largest gap</th><th>if the daily bar stops at 16:00: correlation</th><th>average gap</th><th>largest gap</th></tr></thead><tbody>')
for sym, r in PC["names"].items():
    a = r["session_end"]; b = r["cash_close"]
    H.append(f"<tr><td>{sym}</td><td class='l'>grid {r['grid']}</td><td>{a['sessions']}</td><td class='l'>{dnice(a['from'])} – {dnice(a['to'])}</td><td>{a['corr']:.4f}</td><td>{a['mean_gap']:.4f}</td><td>{a['max_gap']:.4f}</td><td>{b['corr']:.3f}</td><td>{b['mean_gap']:.3f}</td><td>{b['max_gap']:.2f} <span class='d'>{dnice(b['max_gap_date'])}</span></td></tr>")
H.append('</tbody></table></div><p class="leg">The script\'s formula was written out again in Python, line for line, and run on the same chart-API bars as the replay: the five names asked for, plus two on the other 3-day calendar. Left half: the daily bar receives the day\'s last after-hours 30-minute bar. Right half: it receives the last bar before the 16:00 close, so after-hours moves (earnings evenings) are missing. Which of the two TradingView does on a daily chart could not be checked without installing the script; the script shows it in the Data Window. GFS and CIEN are not exact because they trade thinly outside regular hours, and there the Hub\'s 30-minute bars and its 3h to 12h bars do not always hold the same prints.</p>')
pi_bars = sum(v[k]["bars"] for v in PI.values() for k in ("pre-market", "regular hours", "after hours, 12h rung present at the Hub", "last bar of the day"))
pi_w = [v["after hours, Hub leaves its 12h rung out (winter)"] for v in PI.values()]
H.append(f'<p class="leg"><b>On a 30-minute chart with extended hours on</b> the script was checked bar by bar against the Hub\'s live rule, worked out separately from the provider\'s own 3h to 12h bars: MU, NVDA and SPY, the last {min(v["last bar of the day"]["bars"] for v in PI.values())} sessions, {pi_bars:,} half-hour bars. Every pre-market, regular-hours and day\'s-last bar agrees (SPY\'s last bar within {max(v["last bar of the day"]["max_gap"] for v in PI.values()):.2f}). After the close it agrees too, except in winter: between 16:00 and 20:00 New York the Hub\'s rule leaves its 12h rung out, the script keeps it, and those bars differ by {min(x["mean_gap"] for x in pi_w):.2f} to {max(x["mean_gap"] for x in pi_w):.2f} on average (largest {max(x["max_gap"] for x in pi_w):.2f}).</p></section>')
# ---- page specs
rl = PC["rollup"]; cal = PC["calendar"]
H.append(f"""<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<p><b>What this page shows.</b> The Geiger of {len(S)} names, one reading per session for as long as the bars go back, and where tonight's reading sits inside each name's own history. Then the questions from 6 Oct, answered from that history; the same names at seven market bottoms; and a TradingView script that draws the Geiger as an oscillator.</p>
<ul>
<li><b>The reading.</b> The Hub publisher's own maths (seven rungs: 3h, 4h, 6h, 12h, D, 3D, W; trend and momentum per rung; today's Equalizer weights), applied to the chart API's bars. One reading per session, as the Hub would have shown it that evening after the 20:00 close. "Tonight" is the evening of Tuesday 6 Oct 2026.</li>
<li><b>How it was checked.</b> Against the Hub's own numbers on two evenings. The rows the Hub stored at about 20:22 ET: {VS['2026-10-05']['exact_1e4']} of {VS['2026-10-05']['names']} names equal to four decimals on 5 Oct and {VS['2026-10-06']['exact_1e4']} of {VS['2026-10-06']['names']} on 6 Oct. The live Geiger read at 23:41 ET on 6 Oct: {V['exact_1e5']} of {V['names']} equal to five decimals. The largest gap anywhere is {max(V['max'], VS['2026-10-05']['max'], VS['2026-10-06']['max']):.3f} ({V['worst'][0]['s']}, a listing with under eight months of bars).</li>
<li><b>Two 3-day calendars.</b> The provider keeps each name's 3-day bars on one of two calendars: {NA_} of the Hub's {len(LAT)} names on one, {NB_} names one day earlier. It never changes inside a name's history, and nothing about the name predicts it. The replay reads each name's own bars. The oscillator carries the list of the {NB_}; on the wrong calendar its reading drifts by about 0.01 on average and up to 0.14.</li>
<li><b>A difference from the earlier replay.</b> The sector study and the workshop queue counted the unfinished 3-day and weekly bar in each evening's reading. The Hub's publisher does not: it reads finished bars only. Counted the earlier way, the same evening matches the live Geiger on {V['earlier_variant']['exact_1e5']} name, with a typical gap of {V['earlier_variant']['median']:.3f} and a largest of {V['earlier_variant']['max']:.2f}. This page uses the publisher's rule, so its percentiles differ slightly from the workshop queue's.</li>
<li><b>How far back.</b> The chart API holds every rung's bars back to September 2003, not two years as the earlier studies assumed (they had asked for a fixed number of bars). So the history here is up to 23 years. A reading needs all seven rungs; a renamed ticker (QQQ before March 2011, META before June 2022 and six others) has no intraday bars under its old name and starts later.</li>
<li><b>Afternoon against evening.</b> The readings quoted on 6 Oct (NVDA +0.89, MU +0.37, SNDK −0.09) were the Hub's live numbers at 15:23 ET. During the session a rung waits for its bar to finish; after the close the whole day counts. This page uses the evening reading, because that is the one that exists for every past session.</li>
<li><b>Parabolic start.</b> The first close 50% or more above the 200-day average after the name had last closed below it. For SanDisk the 200-day only exists from 8 Dec 2025.</li>
<li><b>Daily RSI and the 200-day.</b> RSI(14), Wilder, on daily closes. The 200-day is the simple average of 200 closes. Prices are split-adjusted, not dividend-adjusted.</li>
<li><b>Forward P/E and earnings growth.</b> From the Hub's own FMP tables. Forward earnings are the consensus for the four fiscal quarters ending after the date; growth compares them with the four quarters before. FMP keeps one consensus per quarter, so for quarters since reported it is the last estimate before the report, which lands close to what was earned. That makes these numbers hindsight: the price that day against what the next year went on to earn, not what analysts expected at the time. The Hub only began keeping dated copies of estimates on 11 Aug 2026. TSM reports in another currency, so it has growth only. SPY and QQQ have no estimate history.</li>
<li><b>The oscillator.</b> It rolls 30-minute extended-hours bars up into the provider's own 3h, 4h, 6h and 12h bars, which start at 04:00 UTC all year, and builds the 3-day and weekly bars from daily bars on the provider's calendar. Checked on bars: rolled-up bars equal the provider's on {rl['3h']['all_four_pct']:.0f}% of 3h, {rl['4h']['all_four_pct']:.0f}% of 4h, {rl['6h']['all_four_pct']:.0f}% of 6h and {rl['12h']['all_four_pct']:.0f}% of 12h bars (MU, four years). Its holiday rule gives the right next session on all but {cal['next_session_wrong']} of {cal['sessions']:,} sessions since 2003 (the one-off closures). The compile check sent the file to TradingView's public compiler as a guest: nothing was saved there and no chart or account was touched.</li>
</ul>
<p><b>What could be wrong.</b> The oscillator was checked through a Python copy on the Hub's bars, not on TradingView: TradingView's prices differ by a cent here and there, its intraday history is limited by the plan, and which 30-minute bar it hands a daily bar is unverified. The earlier Pine Geiger table (28 Sep) places its intraday bars on the New York clock, which is one hour off the provider's grid in winter, and uses one 3-day calendar for every name. Forward P/E for 2009 is rough or missing: FMP's old estimates are stored to the cent, are not always restated for later splits, and have holes. Readings in a name's first months rest on short windows (the weekly rung needs four years for its full fan). The seven dates are yours; the lowest Geiger often fell a few sessions either side.</p>
<p><b>Seen on the way, for the coordinator.</b> By the publisher's rule as written, between the 16:00 close and 20:00 New York in winter the live Geiger runs on six rungs: the 12h rung's newest finished bar began the evening before, so the rule that drops an intraday rung older than the daily bar removes it until 20:00. Worked out from the code and the provider's winter grid; not seen live, because it only happens once the clocks change.</p>
<p><b>Not done.</b> Nothing installed in TradingView and no chart touched. No Geiger history for crypto or futures. No test of whether a low own-history percentile has paid. No forward P/E as it was known on the day. Nothing deployed, no table written.</p>
</details>""")
CSS = """:root{ --bg:#0b0b0e; --panel:#121216; --line:#2a2a30; --ink:#d2d2d2; --ink2:#b4b4b8; --ink3:#8c8c92; }
*{ box-sizing:border-box; } body{ margin:0; background:var(--bg); color:var(--ink2); font:14px/1.6 "SF Mono", Menlo, Consolas, monospace; }
main{ max-width:1600px; margin:0 auto; padding:24px 16px 80px; }
h1{ font-size:15px; letter-spacing:.3em; text-transform:uppercase; color:var(--ink); margin:10px 0 4px; }
.sub{ color:var(--ink3); margin:4px 0 16px; font-size:12px; }
section{ background:var(--panel); border:1px solid var(--line); margin:0 0 8px; padding:14px 16px; }
h2{ font-size:13px; letter-spacing:.2em; text-transform:uppercase; margin:2px 0 10px; color:var(--ink); font-weight:600; }
.tw{ overflow-x:auto; } .tall{ max-height:760px; overflow-y:auto; } figure.chartw{ margin:8px 0 16px; } figcaption{ color:var(--ink3); font-size:12px; margin:2px 0 0 46px; } .narrow{ display:none; } .ntitle{ display:none; color:var(--ink); font-size:12px; letter-spacing:.06em; margin:0 0 2px; }
table{ border-collapse:collapse; width:100%; }
th{ text-align:right; font-size:11px; letter-spacing:.1em; color:var(--ink3); font-weight:400; padding:6px 8px; border-bottom:1px solid var(--line); white-space:nowrap; position:sticky; top:0; background:var(--panel); z-index:1; }
td{ padding:6px 8px; border-bottom:1px solid #1c1c22; font-size:13px; text-align:right; white-space:nowrap; color:var(--ink2); vertical-align:top; font-variant-numeric:tabular-nums; }
th.l, td.l{ text-align:left; } td:first-child, th:first-child{ text-align:left; color:var(--ink); } td.m{ padding-left:0; vertical-align:middle; } td.na{ color:var(--ink3); font-size:12px; }
b{ color:var(--ink); font-weight:600; } .g{ font-weight:600; } .g.big{ font-size:17px; } .top{ display:block; } .d{ color:var(--ink3); font-size:11px; margin-left:4px; }
.bt td{ min-width:118px; } .l2, .l3{ display:block; font-size:12px; color:var(--ink2); } .l3{ color:var(--ink3); } sup{ color:var(--ink3); font-size:11px; margin-left:2px; }
tr.coh td{ color:var(--ink3); font-size:11px; letter-spacing:.16em; text-transform:uppercase; padding-top:14px; background:var(--panel); }
.q{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
.card{ border:1px solid var(--line); padding:12px 14px; background:#0f0f13; }
.card .hd{ display:flex; gap:12px; align-items:baseline; flex-wrap:wrap; margin-bottom:6px; }
.card .tk{ font-size:20px; color:var(--ink); letter-spacing:.08em; font-weight:600; } .par{ color:var(--ink3); font-size:12px; }
.card p{ margin:5px 0; font-size:13px; } .k{ color:var(--ink3); font-size:11px; letter-spacing:.14em; text-transform:uppercase; display:block; }
.leg{ color:var(--ink3); font-size:12px; margin:10px 0 0; max-width:1250px; } code{ color:var(--ink); font-size:12px; word-break:break-all; }
svg text{ font-family:"SF Mono", Menlo, Consolas, monospace; }
#tip{ position:fixed; pointer-events:none; background:#17171c; border:1px solid var(--line); color:var(--ink); font-size:12px; padding:4px 8px; display:none; z-index:5; white-space:nowrap; }
details{ margin-top:14px; color:var(--ink3); font-size:13px; } summary{ cursor:pointer; letter-spacing:.2em; font-size:12px; } details p, details li{ color:var(--ink2); max-width:1150px; } ul{ margin:6px 0 0 20px; padding:0; } li{ margin:6px 0; }
@media (max-width:900px){ .wide{ display:none; } .narrow{ display:block; } .ntitle{ display:block; } figcaption{ margin-left:0; } .q{ grid-template-columns:1fr; } body{ font-size:13px; } main{ padding:16px 10px 70px; } .card .tk{ font-size:18px; } h1{ letter-spacing:.16em; } }"""
JS = """(function(){var tip=document.getElementById('tip');function ends(){document.querySelectorAll('.narrow.tw').forEach(function(w){w.scrollLeft=w.scrollWidth;});}ends();window.addEventListener('resize',ends);document.querySelectorAll('svg.hist').forEach(function(s){var j=document.querySelector('script[data-for="'+s.dataset.key+'"]');if(!j)return;var D=JSON.parse(j.textContent),hx=s.querySelector('.hx'),hit=s.querySelector('.hit');if(!hit)return;var L=+s.dataset.l,PW=+s.dataset.pw,N=+s.dataset.n;
function mv(ev){var r=s.getBoundingClientRect(),vb=s.viewBox.baseVal,x=(ev.clientX-r.left)/r.width*vb.width,k=Math.max(0,Math.min(N-1,Math.round((x-L)/PW*(N-1)))),px=L+PW*k/Math.max(N-1,1);hx.setAttribute('x1',px);hx.setAttribute('x2',px);hx.setAttribute('visibility','visible');var v=D.g[k];tip.textContent=D.sym+'  '+D.d[k]+'  '+(v>=0?'+':'\\u2212')+Math.abs(v).toFixed(2);tip.style.display='block';tip.style.left=Math.min(ev.clientX+14,window.innerWidth-220)+'px';tip.style.top=(ev.clientY-30)+'px';}
hit.addEventListener('mousemove',mv);hit.addEventListener('mouseleave',function(){hx.setAttribute('visibility','hidden');tip.style.display='none';});});})();"""
page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>GH1 · the Geiger against its own history · 6 Oct 2026</title>
<style>
{CSS}
</style></head><body><main>
<span data-scnav-slot></span><h1>GH1 · the Geiger against its own history</h1>
<p class="sub">Readings are the evening of Tuesday 6 Oct 2026, after the close · {len(S)} names, up to 23 years each · a study on a branch · nothing deployed, no table written, nothing installed in TradingView</p>
{"".join(H)}
</main><div id="tip"></div><script>{JS}</script></body></html>
"""
os.makedirs(OUTDIR + "/data", exist_ok=True)
open(OUTDIR + "/GEIGER-HISTORY.html", "w", encoding="utf8").write(page)
DATA = dict(C); DATA["validation_against_stored_rows"] = VS; DATA["three_day_calendar"] = {"what": "start day of each Hub name's provider 3-day bars, mod 3 (2 = grid A, 1 = grid B), read 7 Oct 2026 ~00:50 ET", "phase": LAT}; DATA["fundamentals_at_dates"] = FUND; DATA["pine_check"] = PC; DATA["pine_check_intraday"] = PI; DATA["pine_compile_check"] = {"errors": CC["errors"], "warnings": CC["warnings"]}
json.dump(DATA, open(OUTDIR + "/data/gh1-data.json", "w"), indent=1)
print("page %.0f KB · data %.0f KB · charts %d" % (len(page.encode()) / 1e3, os.path.getsize(OUTDIR + "/data/gh1-data.json") / 1e3, CH[0]))

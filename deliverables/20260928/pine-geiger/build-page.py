#!/usr/bin/env python3
"""N8 · builds mock.html (the TradingView table, drawn in a browser for the picture) and PINE-GEIGER.html
(the plain-words page) from mock-data.json, validation.json and sensitivity.json. No network."""
import datetime, html, json, math, pathlib
from zoneinfo import ZoneInfo

HERE = pathlib.Path(__file__).resolve().parent
mock = json.loads((HERE / "mock-data.json").read_text())
val = json.loads((HERE / "validation.json").read_text())
sen = json.loads((HERE / "sensitivity.json").read_text())
pine = (HERE / "SCINTILLA-GEIGER-TABLE.pine").read_text()

BULL, BEAR = "#00FFA3", "#FF2D55"
CSS_TOKENS = """:root{--bg:#0D0D14;--panel:#14141C;--line:#26263A;--axis:#3A3A52;--ink:#C6C8D2;--dim:#8A8A9E;--head:#6E6E82;
--bull:#00FFA3;--bear:#FF2D55}"""
MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,monospace'


def fmt(v):  # as the Pine script's fmt(): ASCII minus, a dim 0.00 inside ±0.005
    return "n/a" if v is None else "0.00" if abs(v) < 0.005 else ("+" if v > 0 else "-") + f"{abs(v):.2f}"


def dcol(v):
    return "var(--dim)" if v is None or abs(v) < 0.005 else ("var(--bull)" if v > 0 else "var(--bear)")


def bar_pos(v, w=8):
    u = max(0.0, v) * w
    f = math.floor(u)
    e = round((u - f) * 8)
    tail = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"][e]
    return "█" * min(f, w) + ("" if f >= w else tail)


def bar_neg(v, w=8):
    u = max(0.0, -v) * w
    f = math.floor(u)
    tail = "█" if u - f >= 0.75 else "▐" if u - f >= 0.25 else ""
    return ("" if f >= w else tail) + "█" * min(f, w)


AS_OF = datetime.datetime.fromisoformat(mock["geiger_computed_utc"].replace("Z", "+00:00")).astimezone(ZoneInfo("America/New_York")).strftime("%d %b %H:%M")

# ---------- mock.html: the table as the Pine script draws it (same glyphs, colours and order) ----------
rows = sorted(mock["rows"], key=lambda r: -r["geiger"])
trs = []
for r in rows:
    g = r["geiger"]
    trs.append(
        f'<tr><td class="sym">{r["sym"]}</td><td class="neg">{bar_neg(g)}</td><td class="ax">│</td>'
        f'<td class="pos">{bar_pos(g)}</td><td style="color:{dcol(g)}">{fmt(g)}</td>'
        f'<td style="color:{dcol(r["trend"])}">{fmt(r["trend"])}</td><td style="color:{dcol(r["mom"])}">{fmt(r["mom"])}</td>'
        f'<td class="r">{r["rungs"]}/7</td></tr>')
mock_html = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Geiger table mock</title>
<style>{CSS_TOKENS}
html,body{{margin:0;background:#0A0A10}}
.pane{{position:relative;width:1180px;height:440px;background:#0A0A10;overflow:hidden;
  background-image:linear-gradient(#15151F 1px,transparent 1px),linear-gradient(90deg,#15151F 1px,transparent 1px);background-size:98px 64px}}
.px{{position:absolute;left:18px;top:14px;font:600 12px/1.4 {MONO};color:var(--dim);letter-spacing:.04em}}
.px b{{color:var(--ink);font-weight:600}}
.tv{{position:absolute;right:16px;top:14px;border:1px solid var(--line);background:var(--bg);border-collapse:separate;border-spacing:1px;
  font:12px/1.25 {MONO};color:var(--ink)}}
.tv td,.tv th{{padding:3px 6px;background:var(--bg);white-space:pre;text-align:right}}
.tv th{{color:var(--head);font-weight:400}}
.tv .sym{{text-align:left}} .tv .neg{{color:var(--bear);text-align:right;min-width:8ch}} .tv .pos{{color:var(--bull);text-align:left;min-width:8ch}}
.tv .ax{{color:var(--axis);text-align:center;padding:3px 0}} .tv .r{{color:var(--dim)}}
.tv .foot td{{text-align:left;color:var(--head);font-size:11px}}
</style></head><body><div class="pane">
<div class="px">AMEX:SPY · 30 · extended hours on &nbsp; <b>SCINTILLA · GEIGER TABLE</b></div>
<table class="tv"><tr><th class="sym" style="text-align:left">GEIGER</th><th>−</th><th class="ax">│</th><th style="text-align:left">+</th><th>VALUE</th><th>TREND</th><th>MOM</th><th>R</th></tr>
{''.join(trs)}
<tr class="foot"><td colspan="8">7 rungs · 3h 4h 6h 12h D 3D W · completed bars only · {AS_OF} ET</td></tr></table>
</div></body></html>"""
(HERE / "mock-table.htm").write_text(mock_html)

# ---------- the comparison table (10 symbols) ----------
cmp_rows = []
worst = 0.0
for s in val["symbols"]:
    m, b, sv = val["maths"][s], val["buckets"][s], sen["symbols"][s]
    gap = m["pine"]["composite"] - m["live"]["composite"]
    worst = max(worst, abs(gap))
    rung_same = sum(1 for k, v in m["rungs"].items() if v.get("pine") and abs(v["pine"]["comp"] - v["live"]["comp"]) < 1e-5)
    intr = all(b[k]["identical"] == b[k]["compared"] for k in ["3h", "4h", "6h", "12h"])
    intr_n = sum(b[k]["compared"] for k in ["3h", "4h", "6h", "12h"])
    long_ok = all(b[k]["identical_hlc"] == b[k]["compared"] for k in ["3d", "1w"])
    long_n = sum(b[k]["compared"] for k in ["3d", "1w"])
    dd = val["daily"][s][1:]
    d_ohl = sum(1 for x in dd if x["match"]["o"] and x["match"]["h"] and x["match"]["l"])
    cmp_rows.append(
        f'<tr><td class="l">{s}</td><td style="color:{dcol(m["live"]["composite"])}">{m["live"]["composite"]:+.4f}</td>'
        f'<td style="color:{dcol(m["pine"]["composite"])}">{m["pine"]["composite"]:+.4f}</td><td>{"&lt;0.000001" if abs(gap) < 1e-6 else f"{abs(gap):.6f}"}</td>'
        f'<td>{rung_same}/7</td><td>{"all" if intr else "NO"} {intr_n}</td><td>{"all" if long_ok else "NO"} {long_n}</td>'
        f'<td>{d_ohl}/{len(dd)}</td><td>{sv["p95_move"]:.4f}</td></tr>')

approx = [
    ("Prices come from TradingView, not Massive.",
     "The Hub reads Massive's bars. TradingView has its own feed, and an after-hours print or a daily high can differ by a cent. "
     f"I nudged every bar of the ten symbols by up to a cent in either direction, 300 times: the Geiger moved at most {max(v['max_move'] for v in sen['symbols'].values()):.4f}, "
     "below the 0.01 the table shows. A bigger feed difference (a missing after-hours bar, a bad print) would move it more."),
    ("The daily bar counts as finished at the 16:00 close.",
     "The Hub waits for its settled-close step before it uses the day. Between 16:00 and that step, the table on TradingView "
     "already uses today's daily bar and the Hub still uses yesterday's, so the two can differ for those hours."),
    ("The intraday rungs are rebuilt, not taken from TradingView's own 3h/6h/12h bars.",
     "TradingView starts its multi-hour bars at the session open (04:00). The Hub's start on the New York clock (3h at 00, 03, 06 …). "
     "The script rolls 30-minute extended-hours bars into the Hub's buckets instead. On the ten symbols this rebuild matched every "
     "bucket the API served."),
    ("Daylight-saving change days.",
     "On the two days a year the clocks change, the end time of the last bucket of the day is off by one hour. Which bucket each bar "
     "falls in is still right; only the moment a bucket counts as finished shifts."),
    ("How much history your TradingView plan loads.",
     "The 12h rung needs about 3,200 thirty-minute bars for its full nine-line fan. TradingView plans load 5,000 to 20,000 bars, "
     "which is enough; if a symbol has less, the rung uses fewer lines, as the Hub does for young listings."),
    ("The chart the table sits on.",
     "Put it on a chart with extended hours on, at 30 minutes or faster (or a 24-hour symbol). On a regular-hours-only chart the "
     "script reads the other symbols as of that chart's last bar, so after 16:00 it can miss the after-hours buckets."),
    ("Twenty rows at most.",
     "Each row needs two TradingView data requests and TradingView allows 40. More rows would need a second copy of the script with "
     "its own list."),
]
approx_html = "".join(f"<li><b>{html.escape(a)}</b> {html.escape(b)}</li>" for a, b in approx)

page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Geiger table for TradingView</title>
<style>{CSS_TOKENS}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--ink);font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}}
main{{max-width:980px;margin:0 auto;padding:56px 16px 64px}}
h1{{font:600 22px/1.3 {MONO};letter-spacing:.04em;margin:0 0 6px}}
h2{{font:600 12px/1.4 {MONO};letter-spacing:.16em;text-transform:uppercase;color:var(--dim);margin:40px 0 10px;border-top:1px solid var(--line);padding-top:18px}}
.kick{{font:600 11px/1.4 {MONO};letter-spacing:.16em;text-transform:uppercase;color:var(--head)}}
p,li{{max-width:72ch}} li{{margin:0 0 10px}} b{{color:var(--ink)}}
.dim{{color:var(--dim)}} .up{{color:var(--bull)}} .dn{{color:var(--bear)}}
.panel{{background:var(--panel);border:1px solid var(--line);border-radius:3px;padding:14px 16px}}
.scroll{{overflow-x:auto;-webkit-overflow-scrolling:touch}}
table.c{{border-collapse:collapse;font:12px/1.4 {MONO};min-width:760px;width:100%}}
table.c th{{color:var(--head);font-weight:400;text-align:right;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:bottom}}
table.c td{{text-align:right;padding:6px 8px;border-bottom:1px solid var(--line);white-space:nowrap}}
table.c .l{{text-align:left}}
img.mock{{width:100%;height:auto;border:1px solid var(--line);border-radius:3px;display:block}}
ol.steps li{{margin-bottom:6px}}
pre{{background:var(--panel);border:1px solid var(--line);border-radius:3px;padding:12px;overflow:auto;max-height:420px;font:11px/1.45 {MONO};color:var(--ink)}}
button.copy{{font:600 11px/1 {MONO};letter-spacing:.14em;text-transform:uppercase;background:var(--panel);color:var(--ink);border:1px solid var(--axis);border-radius:3px;padding:9px 12px;cursor:pointer}}
code{{font:12px {MONO};color:var(--ink)}}
</style></head><body><main>
<span data-scnav-slot></span>
<div class="kick">N8 · 28 Sep 2026 · for the Chrome rotation</div>
<h1>The Geiger, as a table on TradingView</h1>
<p>A TradingView indicator that draws the Hub's Geiger for a list of symbols in one table: a bar centred at zero
(<span class="up">green</span> when the Geiger is above zero, <span class="dn">red</span> below), the Geiger value, and its two families,
TREND and MOMENTUM. It uses the same seven timeframes and today's saved Equalizer weights as the Hub.</p>

<h2>What it will look like</h2>
<a href="mock-table.png"><img class="mock" src="mock-table.png" alt="Mock of the Geiger table: sixteen rows, sorted from XLV and XLK at the top in green down to XLRE and XLU at the bottom in red."></a>
<p class="dim">This is a <b>mock drawn in a web browser</b> with the script's own glyphs, colours and order, filled with the values the script's
maths gives on today's bars (28 Sep, from the bars the Hub's Geiger read at {html.escape(mock['geiger_computed_utc'][11:16])} UTC). It is not a TradingView
screenshot: I did not open or touch your TradingView.</p>

<h2>How to put it on the rotation</h2>
<ol class="steps">
<li>In TradingView open the Pine Editor, start a new indicator, select everything and paste the script (the file
<code>SCINTILLA-GEIGER-TABLE.pine</code>, or the copy at the bottom of this page). Save, then Add to chart.</li>
<li>Use a chart with <b>extended hours on</b>, at 30 minutes or faster. SPY at 30 minutes is a good choice.</li>
<li>In the indicator's settings, <b>List</b> picks the rows: <b>Sectors + indexes</b> (the 11 SPDR sectors + SPY QQQ IWM DIA RSP),
<b>Alan's names</b> (the first 20 names on your LIKED list, in the order you liked them), or <b>Custom</b> (20 boxes; type
<code>EXCHANGE:SYMBOL</code>, e.g. <code>NASDAQ:NVDA</code>).</li>
<li>Rows are sorted from the highest Geiger down; untick <b>Sort by Geiger</b> to keep your list order. <b>R</b> shows how many of the
seven timeframes gave a reading.</li>
</ol>
<p class="dim">The header of the script says <b>PLOTS 0/64</b> (it only draws a table) and <b>REQUESTS 40/40</b> (two per row, twenty rows).</p>

<h2>Where each number comes from</h2>
<ul>
<li><b>The seven timeframes and their weights</b> are the Hub's saved Equalizer, read today from the database and matching what the live
Geiger reports: 3h 1.24 · 4h 2.28 · 6h 3.18 · 12h 3.17 · D 3.18 · 3D 2.58 · W 0.99. TREND and MOMENTUM count half each; inside
MOMENTUM, RSI counts 0.6 and Williams %R 0.4. They are editable in the settings under “Equalizer”, so if you move a slider in the Hub,
type the same number here.</li>
<li><b>TREND</b> on each timeframe: nine averages of the close (5, 8, 13, 21, 34-bar exponential; 50, 100, 150, 200-bar simple). The more of them sit
in order, fastest on top, the closer to +1; fully upside down is −1.</li>
<li><b>MOMENTUM</b> on each timeframe: RSI(14) scaled so 23 is −1 and 77 is +1, blended with Williams %R(14) scaled so −90 is −1 and −10 is +1.</li>
<li><b>The Geiger</b> is the weighted average over the seven timeframes. Only finished bars count, never the bar still forming, exactly as the Hub.</li>
<li><b>The bars</b> are TradingView's. The script builds the 3h, 4h, 6h and 12h bars itself from 30-minute bars, on the same New York clock as the Hub, and
the 3-day and weekly bars from daily bars, on the same calendar as the Hub.</li>
</ul>

<h2>Check against the live Geiger · 10 symbols · today</h2>
<p>TradingView can't be run from here, so I tested the script's method in three parts, all on the Hub's own bars. First, the maths: a line-for-line copy of the script's
maths, run on the exact bars the live Geiger read. Second, the rebuilt bars: the script's bucket rules applied to the Hub's 30-minute and daily bars, then
compared with the 3h/4h/6h/12h/3D/W bars the Hub serves. Third, the daily bar: whether the Hub's daily bar is built like TradingView's regular-session daily bar.</p>
<div class="panel scroll"><table class="c">
<tr><th class="l">Symbol</th><th>Hub Geiger<br>(live)</th><th>Script maths<br>(same bars)</th><th>Gap</th><th>Timeframes<br>identical</th>
<th>3h–12h bars<br>rebuilt = served</th><th>3D + W bars<br>rebuilt = served</th><th>Daily open/high/low<br>= regular session</th><th>1-cent noise<br>moves it (95%)</th></tr>
{''.join(cmp_rows)}
</table></div>
<p class="dim">Live Geiger computed {html.escape(val['geiger_computed_utc'])}; check run {html.escape(val['run_utc'])}. The largest gap is {worst:.7f}, which is only the
rounding of the published numbers (the Hub publishes six decimals). The rebuilt-bar columns count every finished bucket both sides had (intraday: the ~7 days of
30-minute bars the API serves; 3D and weekly: 230 each). The daily close is the official closing price in both places, not the last 30-minute trade, so only open/high/low are compared.</p>
<p><b>What this proves:</b> if TradingView's prices equal the Hub's, the table shows the Hub's Geiger. <b>What it does not prove:</b> that TradingView's prices
<i>are</i> equal. That can only be checked on TradingView itself, by putting the table and the Hub side by side on the same symbols.</p>

<h2>What could be wrong</h2>
<ul>{approx_html}</ul>

<h2>What I did not do</h2>
<ul>
<li><b>The script has not been compiled on TradingView.</b> There is no TradingView checker in this session, and the brief says not to use your editor.
I read it through line by line for Pine v6 rules, but the first paste is its first compile. If TradingView shows an error, send me the line and message.</li>
<li>I did not open, inject into or change anything on your TradingView, and I did not deploy this page.</li>
<li>Your FAVORITES and RADAR lists are empty today, so “Alan's names” uses the first 20 of your 128 LIKED names, leaving out non-stock
codes (BTCUSD, SIUSD, GCUSD, CLUSD, VIX), SPY and QQQ (already in the first list) and DRAM (I'm not sure of its exchange).
TSM, the next name, takes the last row.</li>
<li>The exchange for each preset symbol is written in by hand (AMEX for the SPDR funds, SPY, IWM, DIA and RSP; NASDAQ for QQQ and most names; NYSE for ANET
and TSM). If one shows “n/a”, retype it in a Custom box with the exchange TradingView shows.</li>
</ul>

<h2>The script</h2>
<p><button class="copy" id="cp">Copy script</button> <span class="dim" id="cpm"></span></p>
<pre id="src">{html.escape(pine)}</pre>
<script>
document.getElementById("cp").addEventListener("click", async () => {{
  const t = document.getElementById("src").textContent, m = document.getElementById("cpm");
  try {{ await navigator.clipboard.writeText(t); m.textContent = "copied — paste into a new Pine indicator"; }}
  catch (e) {{ m.textContent = "copy blocked — select the text below and copy it"; }}
}});
</script>
</main></body></html>"""
(HERE / "PINE-GEIGER.html").write_text(page)
print("wrote mock-table.htm and PINE-GEIGER.html;", len(rows), "mock rows; worst gap", worst)

#!/usr/bin/env python3
"""SWITCH-ON (28 Sep) — builds SWITCH-ON.html and SWITCH-CHECKLIST.html from the ticked checklist and the measurements.
Run from the repo root: python3 deliverables/20260928/switch-on/tools/build-page.py   (then python3 scripts/inject-scnav.py)"""
import json, html, pathlib, statistics, subprocess
here = pathlib.Path(__file__).resolve().parent
D = here.parent
root = here.parents[3]
e = html.escape
ck = json.loads((D / "SWITCH-CHECKLIST.json").read_text())
sha = subprocess.run(["git", "-C", str(root), "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()

def speed_rows():
    out = []
    data = {k: json.loads((D / "measure" / f"{k}.json").read_text()) for k in ("before", "after") if (D / "measure" / f"{k}.json").exists()}
    def med(rows, key):
        v = [r[key] for r in rows if r.get(key) is not None]
        return (statistics.median(v) / 1000, len(v), len([r for r in rows])) if v else (None, 0, len(rows))
    for cold in (False, True):
        for w in (1680, 390):
            cells = []
            for label, k, tgt in (("live Hub today", "before", "live"), ("merged, before my changes", "before", "local"), ("this branch, final", "after", "local")):
                rows = [r for r in data.get(k, []) if r["target"] == tgt and r["cold"] == cold and r["width"] == w]
                p, _, n = med(rows, "priceMs"); c, _, _ = med(rows, "cloudsMs"); f, nf, _ = med(rows, "rsiMs")
                fan = f"{f:.1f} s" if f is not None else "never drawn"
                cells.append((label, n, p, c, fan))
            out.append((("opened before the board finished loading" if cold else "opened from a board row (how Alan does it)"), w, cells))
    return out

def fmt(v): return "—" if v is None else f"{v:.1f} s"
speed_html = ""
for cond, w, cells in speed_rows():
    speed_html += f'<tr><th colspan="5" class="grp">{e(cond)} · {w} wide</th></tr>'
    for label, n, p, c, fan in cells:
        speed_html += f"<tr><td>{e(label)}</td><td>{n}</td><td>{fmt(p)}</td><td>{fmt(c)}</td><td>{e(fan)}</td></tr>"

def rows(items, key_feature):
    h = ""
    for i in items:
        t = i["round4_tick"]
        h += (f'<tr><td class="id">{e(i["id"])}</td><td>{e(i.get(key_feature) or i.get("what") or "")}</td>'
              f'<td class="st st-{e(t["status"].split("-")[0].lower())}">{e(t["status"])}</td><td>{e(t["what"])}</td><td class="ev">{e(t.get("evidence",""))}</td></tr>')
    return h
table = ('<table class="ck"><thead><tr><th>#</th><th>What you had</th><th>Now</th><th>Where it is / what changed</th><th>How checked</th></tr></thead><tbody>'
         + rows(ck["items"], "feature") + "</tbody></table>"
         + '<h3>B · things live had that the old trial lacked</h3><table class="ck"><tbody>' + rows(ck["base_drift"], "live_feature") + "</tbody></table>"
         + '<h3>C · the 25 Sep list changes that ride along</h3><table class="ck"><tbody>' + rows(ck["h2_rides_along"], "what") + "</tbody></table>")
counts = " · ".join(f"{k} {v}" for k, v in sorted(ck["round4_counts"].items()))

def shot(f, cap):
    return f'<figure><a href="shots/{f}"><img src="shots/{f}" alt="{e(cap)}" loading="lazy"></a><figcaption>{e(cap)}</figcaption></figure>'

CSS = """
:root{--bg:#0B0B0E;--panel:#121216;--line:#2B2B31;--ink:#CFCFD2;--ink2:#A8A8AE;--dim:#8A8A92;--up:#00E08A;--dn:#FF2E63}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 ui-monospace,Menlo,monospace}
main{max-width:1180px;margin:0 auto;padding:24px 16px 80px}h1{font-size:22px;letter-spacing:.08em;margin:6px 0 4px}
h2{font-size:15px;letter-spacing:.12em;color:var(--ink2);border-bottom:.5px solid var(--line);padding-bottom:6px;margin:34px 0 12px}
h3{font-size:13px;letter-spacing:.1em;color:var(--dim);margin:22px 0 8px}.kick{font-size:11px;letter-spacing:.16em;color:var(--dim)}
p,li{color:var(--ink2)}b{color:var(--ink)}.lead{font-size:15px;color:var(--ink)}
.box{background:var(--panel);border:.5px solid var(--line);border-radius:3px;padding:12px 16px;margin:12px 0}
table{border-collapse:collapse;width:100%;font-size:12px}td,th{border-bottom:.5px solid #1E1E23;padding:6px 8px;text-align:left;vertical-align:top}
th{color:var(--dim);font-weight:600;letter-spacing:.08em}th.grp{color:var(--ink2);padding-top:14px}
.ck td.id{color:var(--dim);white-space:nowrap}.ck td.ev{color:var(--dim);font-size:11px}
.st{white-space:nowrap;font-weight:600}.st-fixed{color:var(--up)}.st-kept{color:var(--ink)}.st-moved{color:var(--ink2)}.st-dropped{color:var(--dim)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
figure{margin:0;background:var(--panel);border:.5px solid var(--line);border-radius:3px;padding:6px}
figure img{width:100%;height:220px;object-fit:cover;object-position:top;display:block}figcaption{font-size:11px;color:var(--dim);padding:6px 2px 0}
.wide figure img{height:auto}.table-wrap{overflow-x:auto}
"""
S = []
S.append(f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Company View Switch-On</title><style>{CSS}</style></head><body><main>
<div class="kick">SCINTILLA · HUB · SWITCH-ON · MON 28 SEP 2026 · BRANCH candidate/switch-on-20260928 @ {e(sha)} · NOT DEPLOYED (the coordinator deploys)</div>
<h1>The company view, switched on</h1>
<p class="lead">This branch is the live Hub with the new company view as its only company view, plus the tapes work. I checked every one of the {len(ck['items'])+len(ck['base_drift'])+len(ck['h2_rides_along'])} things on the switch checklist in a real (headless) browser at 1680 wide and at 390 (phone), or in the code where a click would have written to your data. <b>Nothing is missing.</b> Each row ends KEPT, MOVED (still there, somewhere else), DROPPED-AS-ASKED (on your 27 Sep drop list) or FIXED. Counts: {e(counts)}.</p>

<h2>1 · What changes for you</h2>
<ul>
<li><b>The name shows once.</b> Open MU and the header shows MU · Micron Technology · price · change · Prev close · usual day (and "N× today" on an unusual move) · ♥ ★ ◎ · ✕. The second copy that sat under it is gone. On the phone the header keeps ticker, price, change and ✕, and the rest sits on one short line under the controls.</li>
<li><b>One row of controls under the name:</b> ◂ BOARD · <b>COHORT ▾</b> · the Station chart's eleven timeframes <b>15m 30m 1h 2h 3h 4h 6h 12h 1D 3D 1W</b> · <b>CLOUDS</b> on/off · <b>⛶</b> fullscreen · EXPAND.</li>
<li><b>COHORT ▾ is back.</b> It shows which cohort the name is in and moves it to another, saving to the database exactly as before ("saved ✓"). The logo menu's COHORT ALLOC works again: tap a row, then set its cohort here.</li>
<li><b>⛶ fullscreen is back</b> for the whole company view (the header stays). Esc closes it.</li>
<li><b>STATS shows the market cap's date again</b> ("1.22T as of 2026-09-28").</li>
<li><b>Williams %R:</b> the tile stays gone (your drop list), but the number is one line in GEIGER: "WILLIAMS %R (14) · DAILY −12.8 · near the top of its 14-day range".</li>
<li><b>Sector compare:</b> the funds (SPDR) are now the default. The old MEMBERS tab is renamed <b>OUR NAMES</b>. Its columns now carry the sector's name (not a fund ticker) and, underneath, how many of our names it averages. Hovering a column says it in full: "TECH · 70 of our names, averaged · not the XLK fund". Your last choice is remembered.</li>
<li><b>The tapes work rides along:</b> the earnings tapes behave like the economic tape, the earnings room has its own NEXT queue, a closed day says so in TODAY'S SCINTILLAS, and the swap of the bottom earnings band is behind a switch that is OFF.</li>
</ul>

<h2>2 · What you will not see any more, and why</h2>
<ul>
<li><b>The ring meter, the RSI / Williams / MACD / volume tiles, the compact dashed box, the company PLAY</b>: your 27 Sep drop list. The RSI lives on as the six-line fan under the chart (all six lines drawn in every run). The moving averages live on as the full ladder picture. The board keeps its RSI and RVOL columns and its REWIND ▶ PLAY.</li>
<li><b>AUTO ▶ and the "10s ▾" interval</b>: the rotation they drove has not run since 25 Sep. AUTO's one remaining job, going back to the overview, is ◂ BOARD, Esc or ✕. See decision 1.</li>
<li><b>The empty "AI READ · coming" box</b> in the company EVENTS tab, as you asked for the earnings room on 27 Sep. It never held a read.</li>
<li><b>The Station pane's own toolbar inside the chart</b>: its timeframes and clouds switch are now on the Hub's own row, so nothing is lost. Its symbol box is not needed: the Hub's search does that job.</li>
</ul>

<h2>3 · Speed: "chart drawn at ~45 s vs ~9 s live"</h2>
<p><b>What I found:</b> the 45 s does not reproduce. In the inventory it was the caption of the <i>last</i> screenshot of a run ("~45 s only because it was taken last"), not a measured draw time. I timed the chart the same way on the live Hub and on this branch, side by side on the same clock. The clock starts at the click; the times are when the price line, the clouds and the RSI fan are actually drawn inside the chart. Medians of 2 runs each:</p>
<div class="table-wrap"><table><thead><tr><th>page</th><th>runs</th><th>price line</th><th>clouds</th><th>RSI fan (6 lines)</th></tr></thead><tbody>{speed_html}</tbody></table></div>
<p><b>Read:</b> opened from a board row (how you do it), this branch draws the price line, the clouds and the fan <b>faster than live at both widths</b>. Live never drew the fan at all: its chart shows one RSI. The fan's reads start only <i>after</i> the price line is back: price first, fan after. The Hub asks the Station for its "Hub pane" mode (<code>bare=hub</code>), where the price bars are requested at once instead of after the quote and Geiger reads (live waits ~3 s for those).</p>
<p><b>The one weaker case:</b> a name opened in the <i>first few seconds</i> after the page loads, on a desk. There the price read lands on the chart server in the middle of the dashboard's own start-up burst (about 140 small reads for the MAP overview), and waits 5–15 s. Live waits for the quote and Geiger first, so it tends to miss that burst. Across the two rounds this case went both ways: 8.2 / 6.0 s before my changes, 11.2 / 16.1 s after, against live's 5.8–11.1 s. My changes did not touch the load order. The fix would be to hold the overview's burst back when a name is opened that early. It is not done here, because it changes the overview's start-up; see decision 4.</p>
<h2>4 · Screens (headless, not on your screen)</h2>
<div class="grid">
{shot("1680-board.png","1680 · the board (tape, scintillas, list tabs RADAR · FAVORITES · LIKED)")}
{shot("1680-MU-collapsed-GEIGER.png","1680 · MU opened: name once in the title with ✕; controls row; chart with clouds and the six-line fan; GEIGER with Williams")}
{shot("1680-MU-cohort-menu.png","1680 · COHORT ▾ open (current cohort marked); the save was caught locally, never sent")}
{shot("1680-MU-fullscreen.png","1680 · ⛶ fullscreen: the company view under the header")}
{shot("1680-MU-15m-cloudsoff.png","1680 · 15m with CLOUDS off (Station timeframes from the Hub)")}
{shot("1680-MU-collapsed-STATS.png","1680 · STATS: market cap with its date")}
{shot("1680-MU-collapsed-FINANCIALS.png","1680 · FINANCIALS")}
{shot("1680-MU-collapsed-SOCIAL.png","1680 · SOCIAL: your channels and your X list")}
{shot("1680-MU-collapsed-EVENTS.png","1680 · EVENTS: the earnings strip (DOUBLE BEAT / BEAT / MISS)")}
{shot("1680-MU-expanded-GEIGER.png","1680 · EXPAND: name rail, chart, GEIGER")}
{shot("1680-MU-expanded-FINANCIALS.png","1680 · EXPAND · FINANCIALS")}
{shot("1680-MU-expanded-SOCIAL.png","1680 · EXPAND · SOCIAL")}
{shot("1680-MU-expanded-EVENTS.png","1680 · EXPAND · EVENTS earnings strip")}
{shot("1680-sectors-spdr.png","1680 · SECTOR COMPARE, SPDR (the default now)")}
{shot("1680-sectors-ournames.png","1680 · SECTOR COMPARE, OUR NAMES: sector names and how many of our names under each")}
{shot("1680-tape-top.png","1680 · the top EVENTS tape")}
{shot("1680-tapes-earnings-room.png","1680 · the earnings room: tape with LATER and NEXT")}
{shot("390-board.png","390 · the board")}
{shot("390-MU-collapsed-GEIGER.png","390 · MU: title keeps ticker, price, change, ✕; name, Prev, usual and ♥ ★ ◎ on the phone line")}
{shot("390-MU-collapsed-STATS.png","390 · STATS with the market-cap date (the chart box was mid-redraw when this full-page capture resized the page)")}
{shot("390-MU-collapsed-FINANCIALS.png","390 · FINANCIALS")}
{shot("390-MU-collapsed-SOCIAL.png","390 · SOCIAL")}
{shot("390-MU-collapsed-EVENTS.png","390 · EVENTS earnings strip, two to a row")}
{shot("390-MU-expanded-GEIGER.png","390 · EXPAND · GEIGER: the ladder down to SMA 200")}
{shot("390-MU-expanded-EVENTS.png","390 · EXPAND · EVENTS")}
{shot("390-MU-cohort-menu.png","390 · COHORT ▾ open")}
{shot("390-MU-fullscreen.png","390 · ⛶ fullscreen")}
{shot("390-sectors-ournames.png","390 · OUR NAMES")}
{shot("390-tapes-earnings-room.png","390 · the earnings room")}
</div>

<h2>5 · The checklist, every row</h2>
<p>The discussion lane's list (staging/company-view-switch-20260928), with this branch's tick on every row. Also saved beside this page as SWITCH-CHECKLIST.json and SWITCH-CHECKLIST.html.</p>
<div class="table-wrap">{table}</div>

<h2>6 · Where each number comes from</h2>
<ul>
<li>Price, change, Prev close: the live quote (Massive via the chart API; Prev = the served previous close). Usual day: ticker_heartbeat_daily.usual_day_60.</li>
<li>Chart, clouds, RSI fan: the Station chart pane (Massive bars from the chart API). The Hub only chooses the name, timeframe and clouds.</li>
<li>Geiger composite, trend, momentum: the provider Geiger artifact the board reads. Williams %R and the ladder: FMP daily provider values (provider_indicators_current).</li>
<li>Market cap and its date: company_profile.market_cap / updated_ts.</li>
<li>Sector compare: SPDR/iShares/Vanguard/equal-weight = each fund's own Geiger. OUR NAMES = the mean Geiger of our names in that sector (ticker membership).</li>
</ul>

<h2>7 · What could be wrong / what I did not do</h2>
<ul>
<li>Not deployed, nothing written: every save in the headless runs (one COHORT ▾ pick) was answered locally and never sent. The Station frame in the shots is the live Station; the Hub page is this branch served under the real address.</li>
<li>The fan's 8H label reads "18 AUG": the 8-hour bars are stale on the Station/chart-API side, not the Hub. Not fixed here.</li>
<li>BY TIMEFRAME and BAR AS-OF read "unavailable" in the phone run when the chart API's /geiger?detail=1 did not answer. Same as before; not fixed here.</li>
<li>At 1680×1050 in EXPAND the ladder's SMA 200 is just below the fold of the tab (scroll a little).</li>
<li>COHORT ▾ lists every cohort key in the database, industry groups included (same list as live).</li>
<li>The count under OUR NAMES is the names with a Geiger reading (the ones averaged), e.g. TECH 70. The brief's example said "96 names". The column is too narrow for "TECH · 96 names", so the count sits under the column and the full wording is in its hover.</li>
<li>Tests: node --test tests/ → 1166 pass, 5 fail. The 5 are exactly the known baseline (Indicator Lab checkpoint, one-age-function, saved review charts, readiness, xfeed-publish). The trial copy at /preview/company-view/ is rebuilt from this page.</li>
</ul>

<h2>8 · Decisions for you</h2>
<ol>
<li><b>AUTO ▶ / 10s</b>: leave it out (my recommendation; the rotation it drove is retired and ◂ BOARD / Esc / ✕ do its job), or bring back a button.</li>
<li><b>Sector compare default</b>: SPDR now (recommended, it is what every fund reads). OUR NAMES is one click away and remembered.</li>
<li><b>The bottom earnings band swap</b> (tapes work) is still OFF. My recommendation is to look at the earnings room's new tape for a day before switching it.</li>
<li><b>Hold the MAP overview's start-up reads when a company is opened in the first seconds</b>: this would make that rare early open as quick as a normal one. I recommend it as a small follow-up, measured the same way.</li>
</ol>
</main></body></html>""")
(D / "SWITCH-ON.html").write_text("".join(S))
(D / "SWITCH-CHECKLIST.html").write_text(f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Switch Checklist Ticked</title><style>{CSS}</style></head><body><main><div class="kick">SWITCH CHECKLIST · ROUND-4 TICK · candidate/switch-on-20260928 @ {e(sha)}</div>
<h1>Switch checklist, ticked</h1><p>{e(counts)} · none MISSING.</p><div class="table-wrap">{table}</div></main></body></html>""")
print("built", D / "SWITCH-ON.html")

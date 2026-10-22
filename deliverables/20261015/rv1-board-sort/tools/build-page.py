#!/usr/bin/env python3
"""RV1 — writes ../RV1-BOARD-SORT.html from the evidence JSON beside it (every number on the page is read from there).
Run from anywhere: python3 deliverables/20261015/rv1-board-sort/tools/build-page.py
The BACK / CLOSE pair is placed afterwards with scripts/inject-scnav.py's own functions, on this page alone."""
import html, json, pathlib

D = pathlib.Path(__file__).resolve().parents[1]
EV = D / "evidence"
J = lambda name: json.loads((EV / name).read_text())
e = html.escape


def reads(run):
    out = []
    for r in run["results"]:
        v = r.get("value")
        if r["step"] in ("read", "watch") and isinstance(v, dict) and "top" in v:
            out.append((r.get("label") or "", v))
    return out


def top(v, n=10):
    return " · ".join(e(x["t"]) + " " + e(x["shown"] or "—") for x in v["top"][:n])


before, after = J("scenarios-live.json"), J("scenarios-local.json")
B = {lab.split(" · ")[0]: v for lab, v in reads(before)}
A = {lab.split(" · ")[0]: v for lab, v in reads(after)}
labels = [lab for lab, _ in reads(before)]
evals_b = [r for r in before["results"] if r["step"] == "eval"]
replay_hdr = evals_b[0]["value"] if evals_b else {}
lb = J("live-before.json")
lay = J("live-layouts.json")
drag = J("live-rewind-drag.json")
orders = [r for r in drag["results"] if r["step"] == "watch"][0]["value"]["orders"]
cov = J("live-coverage.json")
cov_ev = {r["label"]: r["value"] for r in cov["results"] if r["step"] == "eval"}
def pick(prefix):
    hits = [v for k, v in cov_ev.items() if k.startswith(prefix)]
    assert len(hits) == 1, prefix
    return hits[0]
cov_counts = pick("ALL · rows without a number")
cov_times = pick("ALL · write times")
cov_day = {"ALL": pick("ALL · whose number")["result"], "FAVORITES": pick("FAVORITES · whose number")["result"]}
from datetime import datetime
from zoneinfo import ZoneInfo
def et(hour_key):   # "2026-10-14T00Z" -> "13 Oct 20:00 ET"
    t = datetime.strptime(hour_key, "%Y-%m-%dT%HZ").replace(tzinfo=ZoneInfo("UTC")).astimezone(ZoneInfo("America/New_York"))
    return t.strftime("%-d %b %H:%M ET")
stale_parts = ["%d last written %s" % (n, et(k)) for k, n in sorted(cov_times["staleOnAllBoardByHour"].items(), key=lambda kv: -kv[1])]
none_n = cov_counts["counts"].get("no board_volume row", 0)
big_key = max(cov_times["staleOnAllBoardByHour"], key=lambda k: cov_times["staleOnAllBoardByHour"][k])
big_n = cov_times["staleOnAllBoardByHour"][big_key]
big_sample = cov_counts["sample"].get("stale row (newest %s)" % big_key[:10], [])
known = [t for t in ("EOSE", "GPN", "CIFR", "CLF", "CSX", "CBRE", "CRH") if t in big_sample][:5] or big_sample[:5]
off_board = [x for x in cov_counts["tableTop"][:3] if not x["onAllBoard"]]


def ok(v):
    good = v.get("wrongSteps") == 0 and v.get("numbersBelowDash") == 0
    return '<td class="%s">%s</td>' % ("ok" if good else "no", "yes" if good else "no")


rows_tbl = []
for lab in labels:
    k = lab.split(" · ")[0]
    b, a = B[k], A[k]
    rows_tbl.append("<tr><td>%s</td><td>%s</td><td>%s / %s</td>%s<td>%s / %s</td>%s</tr>" % (
        e(k), e(lab.split(" · ", 1)[1]), b["wrongSteps"], b["numbersBelowDash"], ok(b) if b["sortKey"] == "rv" else "<td>—</td>",
        a["wrongSteps"], a["numbersBelowDash"], ok(a) if a["sortKey"] == "rv" else "<td>—</td>"))

click_rows = []
for lab, v in reads(lb):
    if "as opened" in lab and v["sortKey"] != "rv":
        continue
    mono = v["breaks"] == 0
    click_rows.append("<tr><td>%s</td><td>%s</td><td>%d / %d</td><td class=\"%s\">%s</td><td>%d</td><td>%s</td></tr>" % (
        e(lab), e(v["header"] or ""), v["withShownNumber"], v["rows"], "ok" if mono else "no", "yes" if mono else "no", v["pulls"], top(v, 15)))

lay_rows = []
names = {"1680": "1680 × 1050 (MacBook)", "1512": "1512 × 982", "2560": "2560 × 1440 (iMac)", "1680-fullscreen": "1680 × 1050, board ⛶ full screen",
         "ipad-portrait": "1024 × 1366 (iPad)", "ipad-landscape": "1366 × 1024 (iPad)", "phone": "390 × 844 (phone)"}
cur = None
for r in lay["results"]:
    lab = r.get("label") or ""
    if r["step"] == "read":
        cur = r["value"]
    if r["step"] == "align":
        key = lab.split(":")[0]
        v = r["value"]
        c = v["cells"][0]
        lay_rows.append("<tr><td>%s</td><td>%s</td><td>%d–%d</td><td>%d–%d</td><td>%s</td><td class=\"%s\">%s</td><td>%s</td></tr>" % (
            e(names.get(key, key)), e(str(v["bodyZoom"])), v["header"]["x0"], v["header"]["x1"], c["cell"]["x0"], c["cell"]["x1"], e(c["labelAbove"] or ""),
            "ok" if cur and cur["breaks"] == 0 else "no", "yes" if cur and cur["breaks"] == 0 else "no", top(cur, 5) if cur else ""))

ord_rows = "".join("<tr><td>%s</td><td>%s</td><td><b>%s</b>%s</td><td>%s</td></tr>" % (
    e(o["at"]), e(o["from"].replace("window.mergeBoardRows (eval at evaluate (:311:30), <anonymous>:15:16) < ", "")),
    e(o["key"]), " ▼" if o["dir"] < 0 else " ▲", e(", ".join(o["top5"][:3]))) for o in orders if o["top5"])

cd = cov_day.get("ALL", {}); cf = cov_day.get("FAVORITES", {})
fig = lambda src, cap: '<figure><img src="shots/%s" loading="lazy" alt="%s"><figcaption>%s</figcaption></figure>' % (src, e(cap), e(cap))
pair = lambda a, b: '<div class="pair">' + a + b + "</div>"

PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RV1 · board RVol sort</title>
<style>
:root{--bg:#0A0A0F;--panel:#101016;--ink:#D8D8DC;--ink2:#9A9AA4;--dim:#66666E;--line:#26262E;--crk:#00D4FF;--up:#00FFA3;--dn:#FF2D55}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;padding:0 16px 60px}
h1{font-size:20px;letter-spacing:.04em;margin:28px 0 4px} h2{font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:var(--crk);margin:40px 0 10px;border-top:1px solid var(--line);padding-top:16px}
h3{font-size:13px;margin:22px 0 6px;color:var(--ink)} p,li{max-width:980px;color:var(--ink2)} b{color:var(--ink)} code{font:12px ui-monospace,Menlo,monospace;color:var(--ink);background:var(--panel);padding:1px 5px;border-radius:3px}
pre{font:12px/1.5 ui-monospace,Menlo,monospace;background:var(--panel);border:1px solid var(--line);padding:12px 14px;overflow:auto;max-width:980px;color:var(--ink)}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:10px 0 24px} @media(max-width:900px){.pair{grid-template-columns:1fr}}
figure{margin:0;background:var(--panel);border:1px solid var(--line);padding:6px} figure img{width:100%%;height:auto;display:block} figcaption{font:11px/1.4 ui-monospace,Menlo,monospace;color:var(--ink2);padding:7px 4px 2px}
.tw{overflow-x:auto;max-width:100%%}
table{border-collapse:collapse;font:12px ui-monospace,Menlo,monospace;margin:8px 0 14px} th,td{border-bottom:1px solid var(--line);padding:5px 10px;text-align:left;vertical-align:top} th{color:var(--ink2);font-weight:400;letter-spacing:.08em;text-transform:uppercase;font-size:11px}
.ok{color:var(--up)} .no{color:var(--dn)} details{margin-top:40px;border-top:1px solid var(--line);padding-top:12px} summary{cursor:pointer;color:var(--crk);letter-spacing:.18em;text-transform:uppercase;font-size:13px}
.sub{color:var(--dim);font-size:12px}
</style></head><body>
<span data-scnav-slot></span><h1>RV1 · the board's RVol column — the click ranks; the way back from the rewind did not</h1>
<p class="sub">Branch <code>hub/rv1-board-sort-20261015</code> from <code>origin/hub/release-20260923</code> @7b66061 (the live index.html); the fix is <code>22d6555</code>.
Headless Chrome (playwright-core 1.62.1, no visible window), 15 Oct 2026 21:10–21:38 ET, 1680 × 1050 unless named. BEFORE = live scintillahub.ai.
AFTER = this branch's index.html served as scintillahub.ai, reading the same live data. Every request other than a read was answered locally; the page attempted none
(%(writes)s). Not deployed: Alan sees this first.</p>

<h2>In short</h2>
<ul>
<li><b>A click on RVol does rank the board</b> by the number beside the battery: FAVORITES and ALL, high → low on the first click, low → high on the second,
names with no number at the bottom both ways. The order holds through the 45 s pulls, and it is the same on seven screen sizes (section 3, 6).</li>
<li><b>The REWIND bar just above the board undid it.</b> Sorted by RVol, any touch of the rewind (a drag, ▶ PLAY, the compare's Replay) and then the way
back to live (↻ LIVE, Esc, the 45 s idle return, the end of a replay) left the <b>live</b> board in <b>Geiger order under "RVol ▼"</b> until the next 45 s
pull: %(a3w)d neighbouring numbers stepping the wrong way and %(a3d)d numbers below a dash. The header says RVol, the rows move, but not by volume.</li>
<li><b>The fix</b>: the replay still ranks by the Geiger alone while the board is rewound (Alan, 24 Sep: "The Geiger replay is with the Geiger bar only");
back to live, the board ranks by its own column again, as that note promised. One branch in one function of the rewind; nothing else changes.</li>
</ul>

<h2>1 · back to live after a rewind — the picture</h2>
<p>Steps on both: FAVORITES, click RVol (high → low), drag the rewind's thumb a little to the left (a real drag), press ↻ LIVE. No other click.</p>
%(pairA3)s
<p>Before, the RVol order came back only with the next 45 s pull: 36 s after ↻ LIVE on the first run, and by the read 50 s later on this one (A4: %(a4w)d wrong-way steps). After, it is right at once and stays right.</p>

<h2>2 · ▶ PLAY, then Esc</h2>
<p>Steps on both: still sorted by RVol, press ▶ PLAY on the rewind, after 3 s press Esc. While the replay plays the board ranks by the replayed Geiger (by design)
and the RVol header is hidden (motion mode: <code>display:%(rvdisp)s</code> measured during the replay), so the RVol order can only come back on the way out.</p>
%(pairB2)s

<h2>3 · the click itself, today (as asked)</h2>
<p>Live page, before any change. Click RVol once, twice, then wait 65 s without clicking (one or two 45 s pulls). "In order" = the printed numbers never step the
wrong way and every dash is below every number, over the whole board. The sort is shared by the tabs, so ALL opened already sorted RVol ▼ and its first click turned it.</p>
<div class="tw"><table><tr><th>read</th><th>header</th><th>numbered / rows</th><th>in order</th><th>pulls so far</th><th>first 15 as drawn (name · number beside the battery)</th></tr>
%(clicks)s</table></div>
%(pairA1)s

<h2>4 · every read, before and after</h2>
<p>Wrong-way steps / numbers below a dash, whole board (FAVORITES, 78 rows, 75 with a number). A2 and B1 are rewound: ranked by the replayed Geiger on both, by design.</p>
<div class="tw"><table><tr><th>step</th><th>what was done</th><th>before</th><th>RVol order</th><th>after</th><th>RVol order</th></tr>
%(steps)s</table></div>

<h2>5 · the cause, with the page's own log</h2>
<p>The harness wraps <code>computeBoardOrder</code> (read-only) and logs every re-order of the board with the sort key it used and who called it.
Live page, the run of 21:18 ET:</p>
<div class="tw"><table><tr><th>time (UTC)</th><th>called from</th><th>key</th><th>first three</th></tr>%(orders)s</table></div>
<p><code>sortBoardBy</code> ranks by RVol. The rewind's <code>orderPass</code> then ranks by <b>g</b> twice: rewound (by design) and again from
<code>goLive → repaint</code>, after the rewind has already ended. <code>S.sort</code> was still RVol ▼ the whole time, so the header kept saying RVol.
The 45 s pull (<code>mergeBoardRows</code>) put the RVol order back.</p>
<p>The code. <code>goLive()</code> clears <code>ASOF</code> and then calls <code>repaint()</code>, whose <code>orderPass()</code> forced the Geiger for every repaint
(23 Sep, commit 158a21e, whose own note said "the board's own sort is left untouched, so LIVE ranks exactly as it did before PLAY"):</p>
<pre>before (7b66061)                                   after (22d6555)
var keepSort=S.sort; S.sort={key:"g",dir:-1};      if(ASOF){
try{ S.boardOrder=computeBoardOrder(); }             var keepSort=S.sort; S.sort={key:"g",dir:-1};
  finally { S.sort=keepSort; }                       try{ S.boardOrder=computeBoardOrder(); } finally { S.sort=keepSort; }
                                                   } else S.boardOrder=computeBoardOrder();</pre>
<p>Ruled out on the live page, with measurements: the rank gate (<code>SC_RANK_READY</code> true on every re-order), the volume read (rows built with it), the 45 s pull
(it keeps RVol), the direction toggle (▼ then ▲, as designed), the number shown vs the key (both <code>rvol_at_time</code>), and the screen layout (section 6).</p>

<h2>6 · every screen: the label is over the battery, and the order is right</h2>
<div class="tw"><table><tr><th>screen</th><th>page zoom</th><th>RVol label x (px)</th><th>battery cell x (px)</th><th>label above the cell</th><th>in order</th><th>first five</th></tr>
%(layouts)s</table></div>

<h2>7 · tests</h2>
<p><code>tests/rv1-board-sort-20261015.test.mjs</code>, 7 tests on the page's own functions (extracted from index.html): RVol high → low and low → high are monotone in the
number the cell prints, names with no number last (12× · 10× · 10.0× · 4.9× · 3.9× · 2.5× · 1.0× · 1.0× · 0.0× · — · — · —: a pace of 10 or more, two paces that print
alike, a zero, a numeric string, a stale row, a battery with no number, no row); the board draws that order; <b>back to live after a rewind the board ranks by
RVol</b>; rewound it still ranks by the Geiger with the sort untouched; <code>goLive</code> clears <code>ASOF</code> before its repaint; the RVol header is hidden while
rewound. Run on 7b66061, exactly one fails, the cause: <code>LIVE after the rewind: a number below a dash: JULY ONEA NONE SESS ZERO ONEB TENR NEAR STRN RSPH BIGR CRWV</code>
(Geiger order). <code>geiger-replay</code> and <code>hub-motion</code> lift the rewind's code into a harness; it now declares <code>ASOF</code> (they are replays).</p>
<p>Hub suite (<code>node --test tests/*.test.mjs</code>), compared by failing name: untouched tip 2,186 tests, 8 failing; with the fix 2,193 tests, the same 8 names
failing (MONTH grid · Indicator Lab checkpoint · the xfeed function end to end · the one age function · saved review charts · readiness · REGIME · xfeed-publish), none new,
none fixed. <code>build-trial.py</code> run; its test passes.</p>

<h2>8 · also seen tonight, not changed</h2>
<ul>
<li><b>Names without a number.</b> ALL tonight: %(cdn)d of %(cdr)d names carry a number beside the battery; %(cdnone)d have none and sit at the bottom, as designed,
because their newest board_volume row is older than the 36 h rule allows: %(cdcounts)s; %(nonen)d have no row at all (VIX and the rates). The %(bign)d include
%(bignames)s … (the TODAY'S SCINTILLAS tape shows EOSE +10.3%% today); the table keeps one row per name, so nothing has been written for them since then (the writer is
described in the 1 Oct H5 notes as writing every minute from 04:01 to 20:00 ET). %(offboard)s</li>
<li><b>Yesterday's number shown as today's.</b> The same rule accepts the previous evening's last write for a whole day: tonight %(cd14)d numbers on ALL and %(cf14)d on
FAVORITES (%(cfnames)s) are 14 Oct's session; the cell's tooltip names the time, not the date. A same-session rule would show them as "no reading"; that is a product
call (weekends, holidays) and is not made here.</li>
<li>While rewound, a 45 s pull redraws the board in its own sort and writes the live Geiger into the rows (the replay re-ranks at its next day). A Ticker click while
rewound is undone by the next replayed day (Ticker and Geiger are the only headers shown then). Both read from the code, not measured; neither touches RVol;
both are left as they are.</li>
</ul>

<h2>9 · not done</h2>
<ul>
<li>No deploy, no database write, no change to the comps tab, the global CSS tokens, the Indicator Lab or lab.html.</li>
<li>Nothing records what Alan's screen was doing at 20:45 (the Hub keeps no click log). The rewind is the one path found, in the code and on the live page, that leaves
the RVol header over another order; a plain click was right every time. Worth asking him whether the rewind or the compare's Replay had been touched.</li>
</ul>

<details><summary>Tools and raw measurements</summary>
<p><code>tools/rv1-harness.mjs</code> (headless; load, wait for the live rows and the volume read, real clicks and drags, read the board as drawn, picture; wraps
<code>computeBoardOrder</code>/<code>mergeBoardRows</code> read-only to log every re-order; answers every non-GET locally) · <code>tools/job-*.json</code> (the runs) ·
<code>tools/make-scenario-jobs.py</code> (one scenario, two targets) · <code>tools/summarize.py</code> · <code>tools/build-page.py</code> (this page, from the evidence).
<code>evidence/live-before.json</code> (FAVORITES/ALL clicks and the 65 s watches) · <code>live-layouts.json</code> (seven screens) · <code>live-rewind-drag.json</code>
(the re-order log above) · <code>scenarios-live.json</code> / <code>scenarios-local.json</code> (sections 1, 2, 4) · <code>live-coverage.json</code> (section 8).
A first rewind attempt clicked the scrubber's track, which only takes a drag of its thumb; nothing was rewound, and that run was discarded.</p>
</details>
</body></html>
"""

a3b, a3a = B["A3"], A["A3"]
vals = {
    "writes": "%d non-GET requests attempted across the runs" % (len(before["writes"]) + len(after["writes"]) + len(lb["writes"]) + len(lay["writes"]) + len(drag["writes"]) + len(cov["writes"])),
    "a3w": a3b["wrongSteps"], "a3d": a3b["numbersBelowDash"],
    "a4w": B["A4"]["wrongSteps"],
    "rvdisp": e(str(replay_hdr.get("rvHeaderDisplay"))),
    "pairA3": pair(fig("before-A3-back-to-live.png", "BEFORE · live · back to LIVE, header RVol ▼: %s … — %d wrong-way steps, %d numbers below a dash (Geiger order)" % (
                     " · ".join(x["t"] + " " + (x["shown"] or "—") for x in a3b["top"][:6]), a3b["wrongSteps"], a3b["numbersBelowDash"])),
                   fig("after-A3-back-to-live.png", "AFTER · the build · back to LIVE, header RVol ▼: %s … — %d and %d" % (
                     " · ".join(x["t"] + " " + (x["shown"] or "—") for x in a3a["top"][:6]), a3a["wrongSteps"], a3a["numbersBelowDash"]))),
    "pairB2": pair(fig("before-B2-esc-from-replay.png", "BEFORE · live · ▶ PLAY then Esc, header RVol ▼: %s … — %d / %d" % (
                     " · ".join(x["t"] + " " + (x["shown"] or "—") for x in B["B2"]["top"][:6]), B["B2"]["wrongSteps"], B["B2"]["numbersBelowDash"])),
                   fig("after-B2-esc-from-replay.png", "AFTER · the build · ▶ PLAY then Esc, header RVol ▼: %s … — %d / %d" % (
                     " · ".join(x["t"] + " " + (x["shown"] or "—") for x in A["B2"]["top"][:6]), A["B2"]["wrongSteps"], A["B2"]["numbersBelowDash"]))),
    "pairA1": pair(fig("before-A1-click-rvol.png", "BEFORE · live · one click on RVol: %s …" % " · ".join(x["t"] + " " + (x["shown"] or "—") for x in B["A1"]["top"][:6])),
                   fig("after-A1-click-rvol.png", "AFTER · the build · one click on RVol: %s …" % " · ".join(x["t"] + " " + (x["shown"] or "—") for x in A["A1"]["top"][:6]))),
    "clicks": "\n".join(click_rows), "steps": "\n".join(rows_tbl), "orders": ord_rows, "layouts": "\n".join(lay_rows),
    "cdn": cd.get("numbered", 0), "cdr": cd.get("rows", 0), "cdnone": cd.get("noNumber", 0),
    "cdcounts": e(", ".join(stale_parts)), "nonen": none_n, "bign": big_n, "bignames": e(", ".join(known)),
    "offboard": e(" and ".join("%s (%.2f)" % (x["t"], x["at"]) for x in off_board) + (", the top of the table, are not on the board at all." if len(off_board) > 1 else ", the top of the table, is not on the board at all.")) if off_board else "",
    "cd14": cd.get("numberBySessionDay", {}).get("2026-10-14", 0), "cf14": cf.get("numberBySessionDay", {}).get("2026-10-14", 0),
    "cfnames": e(", ".join(cf.get("priorSessionNames", []))),
}
out = PAGE % vals
# the house BACK / CLOSE pair, with scripts/inject-scnav.py's own snippet and slot rule, on this page only
import importlib.util
spec = importlib.util.spec_from_file_location("inject_scnav", D.parents[2] / "scripts" / "inject-scnav.py")
inj = importlib.util.module_from_spec(spec); spec.loader.exec_module(inj)
out, _ = inj.ensure_slot(inj.BLOCK.sub("\n", out), "RV1-BOARD-SORT.html")
out = out.replace("</body>", inj.SNIPPET + "\n</body>", 1)
(D / "RV1-BOARD-SORT.html").write_text(out)
print("wrote", (D / "RV1-BOARD-SORT.html").relative_to(D.parents[2]), len(out), "chars")

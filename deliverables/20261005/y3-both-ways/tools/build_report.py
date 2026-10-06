#!/usr/bin/env python3
"""Y3 — builds Y3-BOTH-WAYS.html from control/YOUTUBE_X_BOTH_WAYS.json, so the page's tables are the file's tables. No network."""
import json, html, os
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, "..", "Y3-BOTH-WAYS.html")
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
B = json.load(open(os.path.join(ROOT, "control", "YOUTUBE_X_BOTH_WAYS.json")))
e = html.escape; c = B["counts"]; P = B["proposals"]; seen = B["x_accounts_seen"]
rows = B["youtube_to_x"]; SURE = {"high": "sure", "medium": "likely", "low": "weak", "none": ""}
n = lambda v: format(v, ",")
def where(r):
    return "; ".join(r["in_our_data"]) or "—"
def crow(r):
    subs = n(r["subscribers"]) if r.get("subscribers") else "—"
    return ("<tr><td><a href='%s'>%s</a></td><td class=n><a href='https://x.com/%s'>@%s</a></td><td class=n>%s</td><td class=n>%s</td><td>%s</td><td class=n>%s</td><td class=n>%s</td><td>%s</td></tr>"
            % (e(r["channel_url"]), e(r["channel_title"]), e(r["x_handle"]), e(r["x_handle"]), "yes" if r["on_trading_list"] else "<b>no</b>",
               "yes" if r["on_bridge"] else "no", e(where(r)), n(r["videos_held"]), SURE[r["confidence"]], e(r["how_found"])))
HEAD = "<tr><th>Channel</th><th>X account</th><th>On Trading list?</th><th>On the bridge?</th><th>Where we hold it</th><th>Videos held</th><th>How sure</th><th>How found</th></tr>"
off = [r for r in rows if r["on_trading_list"] is False]
desk = lambda r: "scintilla" in r["saved_lists"]
a_rows = [r for r in off if desk(r)]
radar = sorted([r for r in off if not desk(r) and any(w.startswith("RADAR") or w == "bridge" for w in r["in_our_data"])], key=lambda r: (-r["videos_held"], r["channel_title"]))
other = [r for r in off if not desk(r) and r not in radar]
on = [r for r in rows if r["on_trading_list"]]
settled = B["x_to_youtube"]["trading_list_settled"]
sure = [s for s in settled if s["verdict"] == "sure"]; out_ = [s for s in settled if s["verdict"] == "not theirs"]
still = [s for s in settled if s["verdict"] == "open" and s["y2"] == "low"]
adds = {a["channel_id"]: a for a in P["add_to_bridge_staged"]}
def srow(s):
    a = adds.get(s["channel_id"], {})
    return "<tr><td class=n>@%s</td><td><a href='https://www.youtube.com/channel/%s'>%s</a><br><span class=id>%s</span></td><td class=n>%s</td><td>%s</td></tr>" % (
        e(s["x_handle"]), e(s["channel_id"]), e(s["channel_title"]), e(s["channel_id"]),
        "already in the feed (you subscribe)" if a.get("already_in_feed_by_subscription") else "<b>new to the feed</b>", e(s["why"]))
quoted = [q for q in B["x_to_youtube"]["quoted_accounts"] if q["confidence"] == "high"]
def qrow(q):
    return "<tr><td class=n>@%s</td><td class=n>%s</td><td><a href='https://www.youtube.com/channel/%s'>%s</a></td><td>%s</td></tr>" % (
        e(q["x_handle"]), n(q["quoted"]), e(q["channel_id"]), e(q.get("channel_title") or ""), e("; ".join(q.get("in_our_data") or []) or "not held"))
job = B["what_an_isolated_browser_must_read"]
review = "".join("<li><b>%s</b> is on the bridge for %s, but its own About page names %s.</li>" % (e(r["channel_title"]), e(", ".join(r["bridge_says"])), e(", ".join("@" + h for h in r["about_page_names"]))) for r in P["bridge_rows_to_review"])
page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>YouTube and X, both ways</title>
<style>
:root{{ --bg:#0B0C10; --panel:#121318; --line:#2A2C33; --ink:#CFCFD2; --ink2:#A9AAB0; --dim:#7C7E86;
  --mono:"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace; --sans:ui-sans-serif,-apple-system,"Helvetica Neue",sans-serif; }}
*{{ box-sizing:border-box; }}
body{{ margin:0; background:var(--bg); color:var(--ink); font-family:var(--sans); font-size:15px; line-height:1.55; }}
main{{ max-width:1280px; margin:0 auto; padding:28px 16px 80px; }}
h1{{ font-family:var(--mono); font-size:15px; letter-spacing:.16em; text-transform:uppercase; font-weight:600; margin:8px 0 6px; }}
h2{{ font-family:var(--mono); font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:var(--ink2); font-weight:600;
  margin:44px 0 12px; padding-top:14px; border-top:1px solid var(--line); }}
p, li{{ max-width:78ch; }}
a{{ color:var(--ink); }}
.lede{{ color:var(--ink2); font-size:16px; }}
.grid{{ display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:10px; margin:16px 0; }}
.tile{{ background:var(--panel); border:1px solid var(--line); border-radius:4px; padding:12px 14px; }}
.tile b{{ display:block; font-family:var(--mono); font-size:26px; font-weight:600; }}
.tile span{{ font-size:12.5px; color:var(--ink2); }}
.wrap{{ overflow-x:auto; }}
table{{ border-collapse:collapse; width:100%; min-width:760px; font-size:13.5px; margin:10px 0; }}
th, td{{ text-align:left; padding:7px 10px; border-bottom:1px solid var(--line); vertical-align:top; }}
th{{ font-family:var(--mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--dim); font-weight:500; }}
td.n{{ font-family:var(--mono); white-space:nowrap; font-size:12.5px; }}
.id{{ font-family:var(--mono); font-size:11px; color:var(--dim); }}
.box{{ background:var(--panel); border:1px solid var(--line); border-radius:4px; padding:12px 16px; margin:12px 0; }}
ol li, ul li{{ margin:5px 0; }}
code{{ font-family:var(--mono); font-size:12.5px; color:var(--ink2); overflow-wrap:anywhere; }}
h2, p, li, summary{{ overflow-wrap:anywhere; }}
details{{ margin:10px 0; }} summary{{ cursor:pointer; font-family:var(--mono); font-size:12px; letter-spacing:.08em; color:var(--ink2); }}
@media(max-width:760px){{ .grid{{ grid-template-columns:repeat(2, minmax(0,1fr)); }} }}
</style>
</head>
<body>
<main>
<span data-scnav-slot></span><h1>YouTube and X, both ways</h1>
<p class="lede">You asked: “Did we do it both ways? Let's check if there's YouTube channels that I don't have on the trading list.”
This time we started from YouTube. For every channel we hold, we opened its public About page and read which X account the channel says is its own, then checked that account against your X Trading list.</p>
<div class="grid">
<div class="tile"><b>{n(c["channels_in_our_data"])}</b><span>YouTube channels in our data (your saved lists, the bridge, every stored video)</span></div>
<div class="tile"><b>{n(c["with_an_x_account"])}</b><span>name an X account on their own About page</span></div>
<div class="tile"><b>{n(c["x_account_not_on_trading_list"])}</b><span>of those accounts are <b style="display:inline;font-size:inherit">not</b> on your Trading list ({n(c["not_on_trading_list_sure"])} sure)</span></div>
<div class="tile"><b>{len(a_rows)}</b><span>of them are channels you already subscribe to on the SCINTILLA account</span></div>
</div>

<h2>1 · Channels you subscribe to whose X account is not on your Trading list ({len(a_rows)})</h2>
<p>These are the closest calls: you chose the channel on YouTube, and the same people post on X, but your Trading list does not carry them. Adding an account to the list is your action on X; nothing was changed.</p>
<div class="wrap"><table>{HEAD}{"".join(crow(r) for r in a_rows)}</table></div>

<h2>2 · Channels our ticker search keeps finding, not on your Trading list (top 40 of {len(radar)})</h2>
<p>You do not subscribe to these. Our search for your RADAR tickers brought their videos in; the more videos held, the more often they turn up.</p>
<div class="wrap"><table>{HEAD}{"".join(crow(r) for r in radar[:40])}</table></div>
<details><summary>THE OTHER {len(radar) - 40} SEARCH CHANNELS</summary><div class="wrap"><table>{HEAD}{"".join(crow(r) for r in radar[40:])}</table></div></details>
<details><summary>CHANNELS ON YOUR OTHER ACCOUNTS (PERSONAL, AI RESEARCH, GOLF, SOUNDSCAPES) — {len(other)}</summary><div class="wrap"><table>{HEAD}{"".join(crow(r) for r in other)}</table></div></details>
<details><summary>CHANNELS WHOSE X ACCOUNT IS ALREADY ON YOUR TRADING LIST — {len(on)}</summary><div class="wrap"><table>{HEAD}{"".join(crow(r) for r in on)}</table></div></details>

<h2>3 · The other way again: {len(sure)} look-alikes settled</h2>
<p>This afternoon's pass left 47 Trading-list accounts with only a look-alike channel. Reading the channels' own About pages settles {len(sure)} as sure (the channel lists that X account among its links) and rules {len(out_)} out (the look-alike names somebody else). {len(still)} stay open: their About pages name nobody.</p>
<div class="wrap"><table><tr><th>X account</th><th>Its channel</th><th>In the feed today?</th><th>Why it is sure</th></tr>{"".join(srow(s) for s in sure)}</table></div>
<div class="box">Staged, not applied: one settings row goes from 29 channels to {29 + len(adds)}. {c["bridge_adds_new_to_the_feed"]} of the {len(adds)} are new to the feed; the other {len(adds) - c["bridge_adds_new_to_the_feed"]} you already subscribe to, and the bridge only adds the every-20-minutes on-air check for them. Undo puts the row back exactly as it was.</div>
<details><summary>RULED OUT ({len(out_)}) AND STILL OPEN ({len(still)})</summary><ul>{"".join("<li>@%s — %s</li>" % (e(s["x_handle"]), e(s["why"])) for s in out_)}</ul>
<p>Still open: {e(", ".join("@" + s["x_handle"] for s in still))}.</p></details>
{"<p>Two channels already on the bridge need a second look:</p><ul>" + review + "</ul>" if review else ""}

<h2>4 · Your X follow list: not in our data</h2>
<p>We hold {seen["trading_list_members"]} accounts: the members of your X “Trading” list, which is the only thing the X collector ever read. We also see {n(seen["quoted_or_reposted_by_them"])} accounts those {seen["trading_list_members"]} quote or repost, but those are other people's choices, not yours. The list of everyone you follow is not in the collector's files, not in the database and not in the X screen bridge (it stores screen sizes only).</p>
<p>Until the real list arrives, we checked the {c["quoted_accounts_checked"]} accounts your list quotes three times or more: {c["quoted_accounts_sure"]} have a channel that links back to them.</p>
<details><summary>THE {len(quoted)} QUOTED ACCOUNTS WITH A SURE CHANNEL</summary><div class="wrap"><table><tr><th>X account</th><th>Times quoted</th><th>Channel</th><th>Where we hold it</th></tr>{"".join(qrow(q) for q in quoted)}</table></div></details>
<div class="box"><b>What the isolated browser has to read</b> ({e(job["where"])})
<ol>{"".join("<li>%s</li>" % e(s) for s in job["steps"])}</ol>
<p>Keep for each row: {e(", ".join(job["fields"]))}. {e(job["never"])}</p>
<p>Hand back: <code>{e(job["deliver"])}</code></p></div>

<h2>What could be wrong</h2>
<ul>
<li>A channel that lists no X account on its About page shows as “names nobody” even if its owner is on X. {n(c["about_pages_read"] - c["with_an_x_account"])} channels are in that group.</li>
<li>“Likely” ({c["likely"]}) means the channel lists several X accounts or gives the address only in its description; the first one is shown. “Weak” ({c["weak"]}) is a name without an address.</li>
<li>{c["channels_youtube_has_removed"]} channels we hold videos from have since been removed by YouTube, so there was no page to read.</li>
<li>The Trading list is the 126 accounts captured on 8 September. If you changed the list on X since, this page does not know.</li>
</ul>
<h2>What was not done</h2>
<ul>
<li>Nothing was applied: no settings row written, no channel subscribed, no X list changed. Nothing was read from X at all.</li>
<li>No browser was opened on this MacBook except an invisible one to photograph this page.</li>
<li>The {len(still)} open look-alikes and the 49 accounts with no channel stay as they were.</li>
</ul>
<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<p>Built {e(B["built_at"])} from <code>control/YOUTUBE_X_BOTH_WAYS.json</code> by <code>tools/build_report.py</code>. Method: {e(B["source"]["method"])}. Channels: {e(B["source"]["channels"])}. {n(B["source"]["pages_read"])} public pages fetched in the last run (the rest from this run's cache). Staged SQL: <code>staged/Y3_bridge_adds.sql</code>, undo <code>staged/Y3_bridge_adds_ROLLBACK.sql</code>. Rebuild: <code>node scripts/yt-x-both-ways.mjs</code>, then <code>python3 tools/build_staged_sql.py</code>, then this script.</p>
</details>
</main>
</body>
</html>
"""
# the BACK / CLOSE pair, placed the way scripts/inject-scnav.py places it — on this page only (that script rewrites
# every sub-page it lists, lab.html among them, and this lane never writes there)
SNIPPET = open(os.path.join(ROOT, "scripts", "scnav-snippet.html")).read().strip()
assert page.count("</body>") == 1 and "data-scnav-slot" in page
page = page.replace("</body>", SNIPPET + "\n</body>", 1)
open(OUT, "w").write(page)
print(len(page), len(a_rows), len(radar), len(other), len(on), len(sure), len(out_), len(still), len(quoted))

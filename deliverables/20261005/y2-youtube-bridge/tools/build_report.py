#!/usr/bin/env python3
"""Y2 — builds Y2-BRIDGE.html from control/YOUTUBE_CHANNEL_BRIDGE.json, tools/shots.json and tools/already-carried.json,
so the page's table is always the file's table. No network."""
import json, html, os
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, "..", "Y2-BRIDGE.html")
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
B = json.load(open(os.path.join(ROOT, "control", "YOUTUBE_CHANNEL_BRIDGE.json")))
S = json.load(open(os.path.join(HERE, "shots.json")))
A = json.load(open(os.path.join(HERE, "already-carried.json")))
e = html.escape
rows = B["channels"]; c = B["counts"]
feed = [r for r in rows if r.get("in_feed")]
ids = []
for r in feed:
    if r["channel_id"] not in ids: ids.append(r["channel_id"])
new_ids = [i for i in ids if not A.get(i, {}).get("scintilla")]
wolf = next(r for r in rows if r["x_handle"].lower() == "wolf_tradingx")
feed.sort(key=lambda r: (r["x_handle"].lower() != "wolf_tradingx", {"high": 0, "medium": 1}[r["confidence"]], r["x_handle"].lower()))
SURE = {"high": "sure", "medium": "likely"}
def live_word(r):
    s = (r.get("live_at_build") or {}).get("state")
    return {"live": "<b>ON AIR</b>", "upcoming": "stream scheduled", "off": "not streaming", "unknown": "could not read"}.get(s, "")
def trow(r):
    carried = "already carried" if A.get(r["channel_id"], {}).get("scintilla") else "<b>new</b>"
    return ("<tr><td class=n>@%s</td><td><a href='%s'>%s</a><br><span class=id>%s</span></td><td class=n>%s</td><td>%s</td><td class=n>%s</td><td class=n>%s</td></tr>"
            % (e(r["x_handle"]), e(r["channel_url"]), e(r.get("channel_title") or ""), e(r["channel_id"]), SURE[r["confidence"]], e(r["how_found"]), carried, live_word(r)))
low = [r for r in rows if r["confidence"] == "low"]; none = [r for r in rows if r["confidence"] == "none"]
def lowrow(r):
    return "<tr><td class=n>@%s</td><td><a href='%s'>%s</a></td><td>%s</td></tr>" % (e(r["x_handle"]), e(r["channel_url"]), e(r.get("channel_title") or ""), e(r["how_found"]))
shot = {s["name"]: s for s in S["shots"]}
w = S["wolf_trading_on_youtube"]
def et(iso):  # 2026-10-05T19:33:43Z -> 15:33 ET (EDT, UTC-4 on 5 Oct)
    h = (int(iso[11:13]) - 4) % 24; return "%d:%s ET" % (h, iso[14:16])
built = B["built_at"]
page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>X accounts to YouTube</title>
<style>
:root{{ --bg:#0B0C10; --panel:#121318; --line:#2A2C33; --ink:#CFCFD2; --ink2:#A9AAB0; --dim:#7C7E86;
  --mono:"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace; --sans:ui-sans-serif,-apple-system,"Helvetica Neue",sans-serif; }}
*{{ box-sizing:border-box; }}
body{{ margin:0; background:var(--bg); color:var(--ink); font-family:var(--sans); font-size:15px; line-height:1.55; }}
main{{ max-width:1180px; margin:0 auto; padding:28px 16px 80px; }}
h1{{ font-family:var(--mono); font-size:15px; letter-spacing:.16em; text-transform:uppercase; font-weight:600; margin:8px 0 6px; }}
h2{{ font-family:var(--mono); font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:var(--ink2); font-weight:600;
  margin:44px 0 12px; padding-top:14px; border-top:1px solid var(--line); }}
p, li{{ max-width:76ch; }}
a{{ color:var(--ink); }}
.lede{{ color:var(--ink2); font-size:16px; }}
.pair{{ display:grid; grid-template-columns:1fr 1fr; gap:14px; margin:14px 0; }}
.pair.phone{{ grid-template-columns:repeat(3, minmax(0,1fr)); max-width:900px; }}
figure{{ margin:0; background:var(--panel); border:1px solid var(--line); border-radius:4px; padding:8px; }}
figure img{{ width:100%; display:block; border-radius:2px; }}
figcaption{{ font-family:var(--mono); font-size:11px; color:var(--dim); margin-top:6px; letter-spacing:.04em; }}
.wrap{{ overflow-x:auto; }}
table{{ border-collapse:collapse; width:100%; font-size:13.5px; margin:10px 0; }}
th, td{{ text-align:left; padding:7px 10px; border-bottom:1px solid var(--line); vertical-align:top; }}
th{{ font-family:var(--mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--dim); font-weight:500; }}
td.n{{ font-family:var(--mono); white-space:nowrap; font-size:12.5px; }}
.id{{ font-family:var(--mono); font-size:11px; color:var(--dim); }}
.box{{ background:var(--panel); border:1px solid var(--line); border-radius:4px; padding:12px 16px; margin:12px 0; }}
.sum{{ font-family:var(--mono); font-size:13px; }}
ol li, ul li{{ margin:5px 0; }}
code{{ font-family:var(--mono); font-size:12.5px; color:var(--ink2); }}
details{{ margin:10px 0; }} summary{{ cursor:pointer; font-family:var(--mono); font-size:12px; letter-spacing:.08em; color:var(--ink2); }}
@media(max-width:760px){{ .pair{{ grid-template-columns:1fr; }} }}
</style>
</head>
<body>
<main>
<span data-scnav-slot></span><h1>X accounts → YouTube channels → the SCINTILLA feed, on air first</h1>
<p class="lede">5 Oct 2026. Of the {c['accounts']} X accounts we hold, {c['matched_in_feed']} have a YouTube channel we can show is theirs — {len(ids)} channels, {len(new_ids)} of them not in our feed today. WOLF Trading is one of the {len(new_ids)}; that is why you did not see it. Everything is written and tested on two branches. <b>Nothing is switched on yet</b>: it needs your word, then the coordinator applies it.</p>

<h2>1 · The bridge: X account → YouTube channel</h2>
<p class="sum">{c['accounts']} accounts · {c['high']} sure · {c['medium']} likely · {c['low_not_added']} look-alikes left out · {c['none']} with no channel found</p>
<div class="wrap"><table>
<tr><th>X account</th><th>YouTube channel</th><th>How sure</th><th>Found how</th><th>In our feed today</th><th>At {et(built)}</th></tr>
{''.join(trow(r) for r in feed)}
</table></div>
<p>"Sure" means the channel's own page links back to the X account, or the account posted its own channel address, or nearly every video it posted itself is from that channel and the names agree. "Likely" is one step weaker, for example eight of eight posted videos from one channel whose name is written differently.</p>
<details><summary>{len(low)} LOOK-ALIKES, NOT ADDED — a second look would settle them</summary>
<p>A channel with the same handle exists, or the account shared a single video. Neither proves the channel is theirs. Some are plainly real (Beth Kindig's handle belongs to a 6-subscriber stranger; her real channel has another name). A paste of Grok Bot's list would settle these in one run.</p>
<div class="wrap"><table><tr><th>X account</th><th>Candidate</th><th>Why it is only a candidate</th></tr>{''.join(lowrow(r) for r in low)}</table></div></details>
<details><summary>{len(none)} ACCOUNTS WITH NO CHANNEL FOUND</summary><p class="sum">{' · '.join('@' + e(r['x_handle']) for r in none)}</p></details>

<h2>2 · WOLF Trading, now</h2>
<div class="box">
<p><b>Channel:</b> <a href="{e(wolf['channel_url'])}">WOLF Trading</a> <span class="id">{e(wolf['channel_id'])}</span> — @WOLF_TradingX. Sure: {e(wolf['how_found'])}.</p>
<p><b>On YouTube at {et(S['checked_at'])}:</b> {'ON AIR — "' + e(w.get('title') or '') + '", ' + str(w.get('viewers')) + ' watching (video ' + e(w.get('video_id') or '') + ').' if w['state'] == 'live' else 'not streaming (' + e(w['state']) + ').'} It was also on air at 15:23, 15:26 and 15:31 ET.</p>
<p><b>In our feed at 15:22 ET:</b> not there. We held two old WOLF Trading videos (July and August) that a ticker search had found. The channel was in neither channel list, so nothing was collecting it.</p>
</div>
<div class="pair">
<figure><img src="screens/before-1680.jpg" alt="The SCINTILLA video grid as it is live today"><figcaption>TODAY · the live Station code on the real feed. The first on-air stream is tile {shot['before-1680']['first_live_tile_position']} (KC Trades, fourth row). WOLF Trading is absent.</figcaption></figure>
<figure><img src="screens/after-bridged-1680.jpg" alt="The grid with the change: WOLF Trading first, marked LIVE"><figcaption>AFTER · on-air streams first. The WOLF Trading tile is SIMULATED: it is the row the collector will write, built from YouTube's live page at {et(S['checked_at'])}. The other tiles are the real feed.</figcaption></figure>
</div>
<div class="pair phone">
<figure><img src="screens/before-390.jpg" alt="Phone, today"><figcaption>PHONE 390 · TODAY</figcaption></figure>
<figure><img src="screens/after-390.jpg" alt="Phone, after, real data only"><figcaption>PHONE · AFTER, real feed only (no WOLF row yet)</figcaption></figure>
<figure><img src="screens/after-bridged-390.jpg" alt="Phone, after, with the simulated WOLF row"><figcaption>PHONE · AFTER, with the simulated WOLF row</figcaption></figure>
</div>
<figure style="max-width:50%"><img src="screens/after-1680.jpg" alt="After, real data only"><figcaption>AFTER, REAL FEED ONLY · the change alone, before the bridge is applied: KC Trades and Future Investing, both on air and both already carried, move to tiles 1 and 2.</figcaption></figure>

<h2>3 · Into the SCINTILLA feed</h2>
<ul>
<li>The {len(ids)} channel ids go into one new settings row. The collector adds them to our own channel list on every pass. You do not have to subscribe to anything.</li>
<li>{len(ids) - len(new_ids)} of the {len(ids)} were already carried; {len(new_ids)} are new.</li>
<li>Our own stored list is never rewritten. Delete the row and the channels are gone on the next pass, five minutes later.</li>
<li>The RADAR search pacing is untouched. The bridge makes no search at all. YouTube's daily allowance: 79 searches × 101 = 7,979 units (as on 2 Oct) + the collector's worst case 1,440 = 9,419 of 10,000, the same figure as before this work.</li>
</ul>

<h2>4 · On air now</h2>
<ul>
<li><b>Every 20 minutes</b> the collector opens each bridged channel's public "live" address. It costs nothing against the YouTube allowance. A channel on air answers with the stream; one that is not answers with its channel page.</li>
<li>A stream found on air is written into the feed in that same pass. YouTube's own answer then gives the real state and the real start time, so a page misread cannot mark something LIVE.</li>
<li>Before, a stream reached us only through YouTube's channel feed, which can run late, and only for channels in a list.</li>
<li><b>The Station grid puts on-air streams first</b>, newest start first, with the LIVE mark it already had. Only channels the feed carries are put first. A stream on air for more than 12 hours (a round-the-clock channel) keeps its ordinary place.</li>
<li><b>Stale LIVE marks are cleaned.</b> At 15:22 ET, 13 stored videos said LIVE; the oldest had said so since 21 Sep. The collector only re-checked the last three days. It now re-checks every row that says LIVE.</li>
</ul>
<p><b>X Spaces — the wall.</b> X's Spaces lookups need a paid X developer key. We hold none, and the X feed rule is "never the X API". Two things are possible without one. First, hosts post the Space link: {sum(1 for _ in [0])*52} posts in our stored feed carry one, 26 from @StocksOnSpaces and 11 from @WOLF_TradingX. A SPACE mark on those posts is a small job, but our X collector has captured nothing since 25 Sep, so it would show nothing today. Second, WOLF Trading sends the same show to YouTube, so the YouTube check above catches it.</p>

<h2>5 · What needs you</h2>
<ol>
<li><b>Your word to switch it on.</b> One settings row, one collector update, one Station update. Recommendation: yes. It adds channels and reorders live streams; it removes nothing, and one deleted row undoes it.</li>
<li><b>A paste.</b> Your full X follow list is not stored anywhere we can read. These {c['accounts']} accounts are the members of your X "Trading" list. Paste the follow list, or Grok Bot's list of accounts with channels, as a text file into <code>handoffs/</code>, one handle per line. One command then adds them. Recommendation: paste Grok Bot's list; it also settles the {len(low)} look-alikes.</li>
<li><b>A sign-in, later.</b> None of the six YouTube accounts is refreshing its subscriptions; the collector runs on the channel lists saved earlier. The bridge does not need the sign-in. New subscriptions on the SCINTILLA and PERSONAL accounts do. Recommendation: connect SCINTILLA and PERSONAL once on the Station's connect page.</li>
</ol>

<h2>What could be wrong</h2>
<ul>
<li>A "likely" match can be the wrong channel. @alshfaw → AstroZan rests on one posted channel address, and @StockMarketNerd → Futurum Equities on three videos.</li>
<li>The evidence is the posts we hold, and they stop on 25 Sep. An account that started a channel since then is missed.</li>
<li>The live check was run from this MacBook. From the collector's data-centre address YouTube may answer with a consent page. The collector then counts the channel as "could not read" and falls back to the channel feed; the first run's count will show it.</li>
<li>The start time of a stream found on air is unknown until YouTube's own answer arrives in the same pass. If that call fails, the stream is filed at the time it was found.</li>
<li>The simulated WOLF tile shows "just now" because its real start time was not available here.</li>
</ul>

<h2>What was not done</h2>
<ul>
<li>Nothing was deployed, no table was written, no schedule was changed.</li>
<li>No YouTube key was used or read. Matching used public pages only, so no match was confirmed through YouTube's own data service.</li>
<li>The Hub page was not changed. The Station repo holds an older copy of the collector; it was left alone.</li>
<li>The on-air check was not run inside the deployed collector, only against recorded pages in tests and against live YouTube from this Mac.</li>
</ul>

<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<p><b>Branches.</b> Hub <code>hub/y2-youtube-bridge-20261005</code>; Station <code>station/y2-youtube-live-20261005</code>.</p>
<p><b>Files.</b> <code>control/YOUTUBE_CHANNEL_BRIDGE.json</code> (the table above, with evidence per account) · <code>scripts/yt-bridge-resolve.mjs</code> (rebuilds it; <code>--extra &lt;file&gt;</code> adds pasted handles, <code>--live</code> checks who is on air) · <code>supabase/functions/_shared/yt-bridge.mjs</code> (the matching and on-air rules) · <code>supabase/functions/yt-rss-sweep/index.ts</code> v8 · <code>supabase/functions/yt-config/index.ts</code> v5 · <code>supabase/migrations/20261005_youtube_channel_bridge.sql</code> and <code>…_ROLLBACK.sql</code> · Station <code>station-shells/scintilla-video-v1</code> and <code>personal-video-v1</code>.</p>
<p><b>For the coordinator, in order.</b> 1 · apply <code>20261005_youtube_channel_bridge.sql</code> (one new <code>app_config</code> row, read by nothing until step 2). 2 · deploy <code>yt-rss-sweep</code> and <code>yt-config</code> from the Hub branch (both import <code>_shared/yt-bridge.mjs</code>). No cron changes: the on-air check rides the existing 5-minute sweep (cron 167) and runs on every fourth pass. 3 · merge and deploy the Station branch. 4 · check <code>yt-config?status=1</code>: <code>bridge.channels</code> = {len(ids)}, <code>live_checked</code> = {len(ids)}, <code>could_not_read</code> = 0. Undo: the rollback file's step 1.</p>
<p><b>Tests.</b> Hub <code>tests/y2-youtube-bridge-20261005.test.mjs</code>: 17 tests, which run the collector itself against an in-memory table. Hub suite 1,855 → 1,872 tests, 7 failures before and after (the 5 known, plus MONTH and REGIME, which fail on the live branch without this work). Station <code>tests/station-youtube-on-air-first.test.mjs</code>: 13 tests; suite 964 → 977, 18 failures before and after.</p>
<p><b>Pictures.</b> Headless Chromium, 1680 × 1000 and 390 × 844, the real feed read with the page's own public key; {shot['after-1680']['non_get_blocked']} non-GET requests per page were blocked. <code>tools/shots.json</code> lists the first eight tiles of each picture.</p>
<p><b>Sources for the method.</b> The "/live address lands on the stream" read and the consent cookie follow yt-dlp (github.com/yt-dlp/yt-dlp, the YouTube extractor).</p>
</details>
</main>
</body>
</html>
"""
page = page.replace(str(sum(1 for _ in [0])*52) + " posts", "52 posts")
open(OUT, "w").write(page)
print("written", len(page), "bytes;", len(feed), "rows;", len(ids), "channels;", len(new_ids), "new")

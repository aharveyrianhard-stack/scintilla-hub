#!/usr/bin/env python3
"""K1 (5 Oct 2026) — builds K1-BACKLOG.html from the rows below. The counts in the header are computed from the rows.
   python3 deliverables/20261005/k1-backlog/tools/build-report.py   (run from the repo root or anywhere)"""
import html, json, os
here = os.path.dirname(os.path.abspath(__file__)); out = os.path.join(here, "..", "K1-BACKLOG.html")
HUB, COMPS, STN, PROV = "hub/k1-backlog-20261005", "hub/k1-comps-20261005", "station/k1-backlog-20261005", "provider/k1-backlog-20261005"
DB = "database (additive, rollback beside it)"
# (number, item, status, evidence in plain words, where)
R = [
 ("1", "Prediction markets · the “what the world is betting on” rows had no history", "DONE", "Live: 18 of 18 rows read “no yesterday / no history yet”. Branch: 0 of 18; every row draws its line; 7 are new today so they have no yesterday yet. Picture 1.", HUB),
 ("1", "Prediction markets · a resolution log for closed markets", "DONE", "New group at the foot of the section: 127 questions that ended or left the feed, newest first (ended · yes / ended · no / ended / left the most-traded list / no longer listed). Reads one new read-only view; 221 rows read back. Picture 2.", HUB + " · " + DB),
 ("1", "Prediction markets · trending sources listed", "DONE", "In the section’s PAGE SPECS fold: in use (Polymarket’s volume ranking), recommended next (StockTwits trending), later (Reddit), not used and why (Yahoo, investing.com, Google Trends, X). Picture 3.", HUB),
 ("1", "ESTIMATES · the Rating-changes table reads the new feed", "DONE", "Live: NVDA’s newest row is 2 Jun; ACN shows “No rating changes yet”. Branch: NVDA 1 Oct, ACN 12 rows to 2 Oct. Old feed stopped 9 Jun (89 names); new feed is current (453 names). Picture 4.", HUB),
 ("1", "SOCIAL → SENTIMENT · the stale table replaced", "DONE", "Live table last written 23 Sep. Branch reads the daily table: “Updated 2026-10-05 12:25Z”, the last 7 days summed per name. Picture 5.", HUB),
 ("2", "CAPITAL · the capex-vs-cash projection line", "DONE", "Under the coverage sentence: cash carried forward 8 quarters at the last four quarters’ pace (operations minus spending). CoreWeave: red, zero about Dec 2026, $20.91B to raise in 2 years. Nvidia: green, +$31.75B a quarter. Picture 6.", HUB),
 ("2", "Previous close · hover for “provisional” and “revised by the provider”", "DONE", "Built for you to decide. The hover on the board’s change cell and on “Prev $…” says: “previous close revised by the provider: 100.00 → 100.02 …” or “… is provisional: our own close at the bell …”. A confirmed close says nothing. Read back from the page (a hover cannot be photographed).", HUB),
 ("3", "COMPS table running past its panel", "DONE", "Live tab: 64 px over at 1680. The new comps tab (C5) was 367–467 px over; now 0 elements cut — the business column and the headers wrap. Picture 9.", COMPS),
 ("3", "EARNINGS strip’s sliced card", "CLOSED", "Not reproduced on the live page: 4 whole cards, 0 sliced at eight screen sizes (1280×690 to 2240×1260, four companies). The strip snaps to whole cards; a slice shows only while a finger is dragging. Picture 12.", "—"),
 ("3", "Captions that name our tables → PAGE SPECS (9 of 24)", "DONE", "FINANCIALS’ four tables, the CAPITAL legend and its spending caption, the company SOCIAL freshness line (two forms) and the lock-ups foot now say “FMP · fiscal years” etc.; the table names and reading aids sit in PAGE SPECS folds. FINANCIALS: 5 captions with a table name → 0. Picture 8.", HUB),
 ("3", "Captions · the other 15", "NOT DONE", "7 are in ESTIMATES, which the analysts lane (A3/A4, held for your review) rebuilds — changing them here would collide. 8 are the explanation cards of SENTIMENT, ECONOMIC and SOCIAL, which are explanations by design; say the word and they fold away too.", "—"),
 ("3", "FUNDAMENTALS for a fund shows the fund’s facts", "DONE", "Live: XLK opens a company sheet (“Financial Services · Asset Management”, revenue “—”). Branch: assets $127.3B · cost 0.08% a year ($8 per $10,000) · 74 holdings, top 10 = 64.1% · NAV · since 1998 · run by SPDR, then the ten heaviest holdings (click one that is on the Hub to open it) and the sectors. 72 funds. A company keeps its sheet. Picture 7.", HUB),
 ("4", "Comps · a company’s own-business peers seat first; the nine sets re-run", "DONE", "MU: 12 peers (SNDK + 11 chip designers) → 5 (SNDK · Western Digital, Seagate next door · 2 fill-ins). Centre $4,393 → $2,122 against a $1,065 share. TSM and COST go 12 → 5; AMZN, NVDA, JPM, META, XOM, LLY keep twelve. SK hynix seats with the memory makers the day it is served. Pictures 9–10.", COMPS),
 ("5", "Coil lab labels", "SKIPPED", "The brief gives this to V3.", "—"),
 ("6", "Chart labels ticker · $ · % (SCI-33)", "CLOSED", "Already live: the Station chart reads “NVDA 236.35 +1.03%”.", "—"),
 ("6", "YouTube “how long ago” on both surfaces (SCI-26)", "CLOSED", "Already live: the Hub shows 326 cards with an age (“15m ago”), each Station video page 200 (“10h ago”).", "—"),
 ("6", "Axis navigation in the Station chart (SCI-13)", "DONE", "Drag the date strip: more / less time (125 → 240 → 120 bars in the proof). Drag the price strip: the scale stretches (range ×2.00). A drag on the chart still pans; double-click puts both back. Live today: both strips only pan. Picture 11.", STN),
 ("6", "X bridge one-action attach (SCI-14)", "CLOSED", "Already one action: Option+Shift+S (or the toolbar button) connects the X tab. Chrome requires that one action before a tab can be captured, so zero actions is not possible.", "—"),
 ("6", "Daily oil chart’s step at the Oct/Nov roll", "ALAN’S", "The step is real and on screen now: oil opened 23 Sep at $89.89 against a $94.59 close (−$4.70), the day the front contract changed. A product call — see “Alan’s” below.", "—"),
 ("6", "Put/call 2006–2019 seed as a fixed file", "CLOSED", "Already live: the three put/call series start 1 Nov 2006 (5,010 days each); the seed file ships with the collector.", "—"),
 ("6", "Station map sheet refresh", "DONE", "Rebuilt from the Station’s own page list, so it cannot drift: 33 pages, 21 in the rotation; INTERNALS = VIX + put/call; the three AI groups by name. One command rebuilds it.", STN),
 ("6", "Relative-volume batteries stale since 6 Jul", "CLOSED", "The writer is healthy: 590 of 606 rows written within the last minute. The 16 rows from 6 Jul are crypto, futures and BRK.A, which the stock writer does not cover; the Hub already ignores a stale row.", "—"),
 ("6", "M68 sigma history — merge if green", "DONE", "Merged with no conflict; tests stay at the known failures. It brings the study page (what happened after a sigma day). Its function change and its migration are source only — not deployed, not applied.", HUB),
 ("6", "Economic-calendar loader (unit_rule)", "STAGED", "The change itself is now written against the deployed loader (the 24 Sep note was written blind): one note per row saying whether the three numbers agree on a scale; no number is changed. Deployed source kept as the rollback; steps for the coordinator beside it.", HUB + " · staged/fmp-economic"),
 ("7", "F1 loader fixes (5 functions) and their schedules", "STAGED", "Deployed versions equal the release branch byte for byte and are kept as rollbacks; F1’s versions parse and pass their tests. The note adds what the runbook leaves out: which functions must keep their sign-in check and which must not — get it wrong and the schedule “succeeds” while every call is refused.", HUB + " · staged/f1-loaders"),
 ("7", "The seven-widths daily pass · built and dry-run", "DONE", "Three dry runs on throw-away machines, 0 writes. Those widths are 6–65 days old today; the provider has bars to today. The dry runs found and fixed two faults: one storage hiccup ended the floors step after 19 minutes; and my first fix would have made that step skip every name. Final: 74 of 74 names confirmed in 384 s.", PROV),
 ("7", "The seven-widths pass · the first real run", "STAGED", "For the coordinator, market closed (after 20:15 ET): the exact command is in the provider runbook. Not armed daily until one clean manual pass.", PROV + " · runbook"),
 ("8", "Q2b fixes B, C, E (stagger the quarter-hour rush · split the nightly backup repair · a missing read grant)", "DONE", "Applied this morning by the coordinator; read back by K1: 5 schedules moved, the old repair job off and 4 new ones on (first run tonight 05:30 UTC), the grant in place. Two jobs that failed at the quarter hours recovered at 12:45 and 12:50 ET.", "database"),
 ("8", "Q2b fix D (27 jobs record their real answer)", "DONE", "This morning’s attempt failed because its backup area no longer exists in the database — not a permission problem. Corrected, dry-run in a rolled-back transaction (27 of 27), applied 13:07 ET. 30 minutes later: 45 calls from those jobs, 45 answered 200.", "database · staged/q2b-D"),
 ("8", "Q2b fix A (phone alarms on)", "ALAN’S", "Already on since 11:34 ET — it was switched on with B, C and E. The exact messages are below under “Alan’s”.", "database"),
 ("9", "The night watchman, nightly, on its own machine", "DONE", "New machine 8715e6a0191e68, hourly; nothing existing touched; its first run exited cleanly having done nothing (market hours). Dry run first: Friday’s closes 590 of 590 equal to Massive, every Geiger cell fresh, but the verdict reads RED — see “Alan’s”. First real run: tonight after 20:30 ET — not yet seen.", PROV + " · Fly"),
 ("10", "Chart API /quotes speed in market hours (M24)", "CLOSED", "Not slow now: 13:19 ET, 60 calls, all answered. One name 44 ms (median), a 63-name board 62 ms, the full board as the Hub asks for it (500 names) 152 ms, slowest 852 ms. The 1–21 s of 23 Sep is gone; nothing to diagnose.", "—"),
 ("D", "Deferred · allocation rebuild review (M62) and consolidation review (SCI-23)", "CLOSED", "Superseded: today’s portfolio-allocation lane (PA1) rebuilds and reviews that page.", "—"),
 ("D", "Deferred · Kimi setup", "CLOSED", "You turned Kimi off on 2 Oct.", "—"),
 ("D", "Deferred · service-role key wiring for the sentiment scorers", "CLOSED", "Superseded: the scorers run as scheduled functions inside the database (jobs 261–263), so no key is copied.", "—"),
]
ALAN = [
 ("IB Gateway is down", "The gateway has been down since Sunday 4 Oct, 04:39 ET. Today’s put/call minute series is empty (the newest row is Friday 15:59 ET). Please restart IB Gateway and log in — and switch on its “Auto restart” setting (it is on your list since September)."),
 ("Phone alarms are on — keep them?", "They have been on since 11:34 ET today. What reaches your phone: title “Scintilla: a job is late or failing”, text “Late or failing: <job> (LATE)” — and “Scintilla: jobs back to normal”, text “Back to normal: <job>”. One message per change, never repeated, at most one every 15 minutes. Today’s changes: 11:35 vacuum-ohlcv-hourly late (a side effect of moving it three minutes; back to normal 11:45), 12:45 stats-engine-30m back to normal, 12:50 ribbon-d-3m back to normal. I recommend keeping them. To turn them off: one line, in the report’s PAGE SPECS."),
 ("One alarm needs you", "The X collector on the Mac has not run since Fri 25 Sep 16:31 ET (its folder was deleted). It is the only job marked late right now. Bring it back, or tell us to retire it and its SOCIAL panels."),
 ("Comps · accept the “own business first” rule?", "MU now sits with SanDisk, Western Digital and Seagate and its centre halves to $2,122 — still about double the share, because WDC and STX trade at 21–25× forward earnings and MU at 6×. That is what honest comps say today; SK hynix will pull it further when it is admitted. Recommend: yes."),
 ("Oil chart · the −$4.70 step on 23 Sep", "It is the monthly contract change, not a price move. Either keep true prices and draw a small “roll” mark on that day (what TradingView shows by default), or shift all older prices so the line is smooth (its “back-adjust” option). Recommend: true prices with the mark."),
 ("The night watchman reads RED every night until this is settled", "15 names (BKR, BNY, CB, COHR, ELV, ES …) show daily history older than their recorded start, because we join the earlier ticker’s history on purpose. Either tell the watchman those joins are allowed (recommend), or trim the joined histories (your September item “upstream trim of the joined ticker histories”). It pages no one meanwhile."),
 ("Previous-close hover", "Keep the hover as built (item 2)? Recommend: yes."),
]
OPEN = "Google sign-in app still in “Testing” (YouTube sign-ins expire weekly) · IB second username · NYSE index feed · Safari test browser download · bar-rule default (M73) · 3-hour bars from 09:30 · Investing.com widgets test · glow look (M72) · the 23 admitted funds’ tab · M74 load numbers · IWM / Russell cohort (after the tree) · real futures bars (not in the provider)."
PICS = [
 ("1 · World rows · history", "pm-world-live-1680.png", "BEFORE (live): every row “no yesterday · no history yet”.", "pm-world-local-1680.png", "AFTER (branch): each row has its change and its line."),
 ("2 · Resolution log", None, None, "pm-closed-local-1680.png", "NEW: questions that ended or left the feed, newest first."),
 ("3 · PAGE SPECS with the trending sources", None, None, "pm-specs-local-1680.png", "NEW: the explanations folded at the foot of the section."),
 ("4 · Rating changes (Nvidia)", "ratings-view-live-1680-NVDA.png", "BEFORE (live): the newest row is 2 Jun.", "ratings-view-local-1680-NVDA.png", "AFTER (branch): the newest row is 1 Oct."),
 ("5 · SOCIAL → SENTIMENT", "social-live-1680.png", "BEFORE (live): last written 23 Sep.", "social-local-1680.png", "AFTER (branch): the last 7 days, updated today."),
 ("6 · CAPITAL · cash after spending (CoreWeave)", "capital-live-1680-CRWV.png", "BEFORE (live): the coverage sentence only.", "capital-local-1680-CRWV.png", "AFTER (branch): the red line, the dot where cash reaches zero, the amount to raise."),
 ("7 · FUNDAMENTALS for a fund (XLK)", "fund-live-1680-XLK.png", "BEFORE (live): a company sheet for a fund.", "fund-local-1680-XLK.png", "AFTER (branch): assets, cost, holdings, top ten."),
 ("8 · FINANCIALS captions", "captions-FINANCIALS-live-1680-NVDA.png", "BEFORE (live): captions name our tables.", "captions-FINANCIALS-local-1680-NVDA.png", "AFTER (branch): plain sources; PAGE SPECS open at the foot."),
 ("9 · COMPS · the set (Micron), fitting its panel", "cut-COMPS-live-1680-NVDA.png", "BEFORE (live tab, Nvidia): the table runs past the panel.", "comps-set-local-1680-MU.png", "AFTER (comps branch, Micron): SNDK, then “next door”, then “fill-in”; nothing cut."),
 ("10 · COMPS · the range (Micron)", None, None, "comps-range-local-1680-MU.png", "AFTER (comps branch): centre $2,124 against $1,065 today (was $4,393)."),
 ("11 · Station chart · axis drags", "axis-live-1-dates-dragged-left.png", "BEFORE (live): dragging the date strip only pans.", "axis-local-2-prices-dragged-down.png", "AFTER (branch): more time shown, and the price scale squeezed by a drag on the price strip."),
 ("12 · EARNINGS strip (not reproduced)", None, None, "strip-1920-live-1680-AMZN.png", "LIVE at 1920 × 1080: four whole cards, none sliced."),
]
e = html.escape
counts = {}
for r in R: counts[r[2]] = counts.get(r[2], 0) + 1
order = ["DONE", "STAGED", "CLOSED", "ALAN’S", "NOT DONE", "SKIPPED"]
cls = {"DONE": "s-done", "STAGED": "s-staged", "CLOSED": "s-closed", "ALAN’S": "s-alan", "NOT DONE": "s-not", "SKIPPED": "s-not"}
for f in [p[1] for p in PICS if p[1]] + [p[3] for p in PICS]:
    assert os.path.exists(os.path.join(here, "..", "shots", f)), f
rows = "".join(f'<tr><td class="n">{e(n)}</td><td>{e(item)}</td><td><span class="st {cls[st]}">{e(st)}</span></td><td>{e(ev)}</td><td class="br">{e(br)}</td></tr>' for n, item, st, ev, br in R)
alan = "".join(f"<li><b>{e(t)}{'' if t.endswith('?') else '.'}</b> {e(x)}</li>" for t, x in ALAN)
def fig(title, b, bc, a, ac):
    if b: return f'<section><h2>{e(title)}</h2><div class="pair"><figure><a href="shots/{b}"><img loading="lazy" src="shots/{b}" alt="{e(bc)}"></a><figcaption>{e(bc)}</figcaption></figure><figure><a href="shots/{a}"><img loading="lazy" src="shots/{a}" alt="{e(ac)}"></a><figcaption>{e(ac)}</figcaption></figure></div></section>'
    return f'<section><h2>{e(title)}</h2><figure class="one"><a href="shots/{a}"><img loading="lazy" src="shots/{a}" alt="{e(ac)}"></a><figcaption>{e(ac)}</figcaption></figure></section>'
doc = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>K1 · backlog sweep · 5 Oct 2026</title>
<style>
  :root{{ --bg:#0b0b0e; --panel:#121216; --line:#2a2a30; --ink:#d2d2d2; --ink2:#b4b4b8; --ink3:#8c8c92; }}
  *{{ box-sizing:border-box; }}
  body{{ margin:0; background:var(--bg); color:var(--ink2); font:14px/1.6 "SF Mono", Menlo, Consolas, monospace; }}
  main{{ max-width:1240px; margin:0 auto; padding:24px 16px 80px; }}
  h1{{ font-size:15px; letter-spacing:.3em; text-transform:uppercase; color:var(--ink); margin:10px 0 4px; }}
  .sub{{ color:var(--ink3); margin-bottom:16px; }}
  .k{{ display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:8px; margin:0 0 18px; }}
  .k div{{ border:1px solid var(--line); background:var(--panel); padding:10px 12px; font-size:12px; letter-spacing:.14em; color:var(--ink3); }}
  .k b{{ display:block; font-size:24px; letter-spacing:0; color:var(--ink); font-weight:600; }}
  section{{ background:var(--panel); border:1px solid var(--line); margin:0 0 14px; padding:14px 16px; }}
  h2{{ font-size:13px; letter-spacing:.2em; text-transform:uppercase; margin:0 0 8px; color:var(--ink); font-weight:600; }}
  .tw{{ overflow-x:auto; }}
  table{{ border-collapse:collapse; width:100%; min-width:900px; }}
  th{{ text-align:left; font-size:11px; letter-spacing:.16em; color:var(--ink3); font-weight:400; padding:6px 8px; border-bottom:1px solid var(--line); }}
  td{{ padding:8px; border-bottom:1px solid #1c1c22; vertical-align:top; font-size:13px; }}
  td.n{{ color:var(--ink3); width:26px; }} td:nth-child(2){{ color:var(--ink); width:24%; }} td.br{{ color:var(--ink3); font-size:12px; width:17%; overflow-wrap:anywhere; }}
  .st{{ display:inline-block; font-size:11px; letter-spacing:.14em; padding:2px 7px; border:1px solid var(--line); white-space:nowrap; }}
  .s-done{{ color:#0b0b0e; background:#c8c8c8; border-color:#c8c8c8; font-weight:600; }} .s-staged{{ color:var(--ink); border-color:#8c8c92; }}
  .s-closed{{ color:var(--ink3); }} .s-alan{{ color:var(--ink); border:1px dashed #b4b4b8; font-weight:600; }} .s-not{{ color:var(--ink3); border-style:dotted; }}
  ul{{ margin:4px 0 0 18px; padding:0; }} li{{ margin:7px 0; }} b{{ color:var(--ink); font-weight:600; }}
  .pair{{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }} figure{{ margin:0; }} figure.one{{ max-width:820px; }}
  img{{ width:100%; display:block; border:1px solid var(--line); }} figcaption{{ font-size:12px; color:var(--ink3); margin-top:5px; }}
  details{{ margin-top:18px; color:var(--ink3); font-size:13px; }} summary{{ cursor:pointer; letter-spacing:.2em; text-transform:uppercase; color:var(--ink2); }}
  details p{{ margin:8px 0; }} code{{ color:var(--ink2); }}
  @media (max-width:760px){{ .pair{{ grid-template-columns:1fr; }} body{{ font-size:13px; }} }}
</style>
</head>
<body>
<main>
<h1>K1 · the backlog sweep</h1>
<div class="sub">Monday 5 Oct 2026 · every open line of the backlog, done on a branch, staged, or closed with a reason. Nothing here is live on the Hub or the Station: the coordinator shows you, you decide.</div>
<div class="k">{"".join(f"<div><b>{counts.get(s,0)}</b>{e(s)}</div>" for s in order if counts.get(s))}</div>

<section><h2>Alan’s — {len(ALAN)} lines</h2><p>Two are lines of the list (the oil chart, the phone alarms); the other five came up while doing the work.</p><ul>{alan}</ul></section>

<section><h2>Every item</h2><div class="tw"><table><thead><tr><th>#</th><th>ITEM</th><th>STATUS</th><th>EVIDENCE</th><th>WHERE</th></tr></thead><tbody>{rows}</tbody></table></div></section>

<section><h2>Still open, not touched here</h2><p>{e(OPEN)}</p></section>

{"".join(fig(*p) for p in PICS)}

<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<p><b>Branches.</b> Hub <code>{HUB}</code> (items 1, 2, 3, the M68 merge, the staged notes, this page) · Hub <code>{COMPS}</code> (item 4 and the COMPS table, on top of the comps lane C5/C5b, which is itself waiting for your review) · Station <code>{STN}</code> (axis drags, the map sheet) · provider <code>{PROV}</code> (the seven-widths dry run and fixes, the night watchman’s wrapper, the runbook). The exact commits are in the lane’s return message.</p>
<p><b>How the pictures were taken.</b> A hidden (headless) browser, never a visible window. “Before” is the live site; “after” is the branch served under the same address. Every request that would write was answered locally and counted — none was sent. Pictures are 1680 × 1050 unless the caption says otherwise; the phone pictures (390 wide) are in <code>shots/</code>. The records behind each number are the <code>tools/rec-*.json</code> files.</p>
<p><b>What changed outside the branches (each with its undo).</b> (1) A read-only database view, <code>prediction_market_closed</code>, for the resolution log — undo: <code>supabase/migrations/20261005_prediction_market_closed_ROLLBACK.sql</code>. (2) Q2b fix D: 27 scheduled jobs now record their real answer; their original commands are kept in a private area — undo: <code>staged/q2b-D/20261005_q2b_D_record_real_http_answers_ROLLBACK.sql</code>. (3) One new scheduled machine on Fly, <code>night-watchman-hourly</code> (8715e6a0191e68) — undo: <code>fly machine destroy 8715e6a0191e68 -a scintilla-massive-stocks-batch --force</code>. Two throw-away machines were used for dry runs and are destroyed. Nothing was deployed: no Hub page, no Station page, no edge function, no existing machine.</p>
<p><b>Turning the phone alarms off</b> (if you prefer): <code>update public.job_heartbeat_state set publish_alarms = false where id = 1;</code> — the status page keeps working.</p>
<p><b>Tests.</b> Hub 1,885: the 5 known failures plus two that fail the same way on the untouched release because their fixtures are tied to a date (MONTH, REGIME). Comps branch 1,881: the same seven. Station 958: the 18 known failures. Provider 890 of 890.</p>
<p><b>What could be wrong.</b> The projection line is a pace, not a forecast. The resolution log’s “ended · yes / no” is the last price we read, not Polymarket’s official ruling. The comps re-run used today’s prices, the 3 Oct sets used Friday’s, so small moves in the other eight names are partly price drift. The watchman’s first real night and the split backup-repair jobs’ first night have not happened yet. The seven-widths pass has only been dry-run.</p>
</details>
</main>
</body>
</html>
'''
open(out, "w", encoding="utf-8").write(doc)
print("rows", len(R), "counts", {s: counts.get(s, 0) for s in order}, "alan", len(ALAN), "pictures", len(PICS), "bytes", len(doc))

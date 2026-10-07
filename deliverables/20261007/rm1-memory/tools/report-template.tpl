<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RM1 · why the Hub and the Station eat memory when left open, and the fix · 7 Oct 2026</title>
<style>
  :root{ --bg:#0b0b0e; --panel:#121216; --line:#2a2a30; --hair:#1e1e24; --ink:#d2d2d2; --ink2:#b4b4b8; --ink3:#8c8c92; --before:#CC1F44; --after:#1DAD7B; }
  *{ box-sizing:border-box; }
  body{ margin:0; background:var(--bg); color:var(--ink2); font:14px/1.6 "SF Mono", Menlo, Consolas, monospace; }
  main{ max-width:1560px; margin:0 auto; padding:24px 16px 80px; }
  h1{ font-size:15px; letter-spacing:.3em; text-transform:uppercase; color:var(--ink); margin:10px 0 4px; }
  h2{ font-size:13px; letter-spacing:.2em; text-transform:uppercase; margin:0 0 8px; color:var(--ink); font-weight:600; }
  h3{ font-size:12px; letter-spacing:.18em; text-transform:uppercase; margin:0 0 8px; color:var(--ink); font-weight:600; }
  .lead{ color:var(--ink); font-size:15px; margin:8px 0 6px; max-width:1180px; }
  .sub{ color:var(--ink3); margin-bottom:16px; max-width:1180px; }
  section{ background:var(--panel); border:1px solid var(--line); margin:0 0 8px; padding:16px 16px 14px; }
  p{ margin:6px 0; max-width:1180px; }
  b{ color:var(--ink); font-weight:600; } i{ font-style:normal; color:var(--ink3); } a{ color:var(--ink); }
  code{ color:var(--ink); font:inherit; }
  ul,ol{ margin:6px 0 0 20px; padding:0; max-width:1180px; } li{ margin:6px 0; }
  .dim{ color:var(--ink3); }
  .found{ display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:10px; }
  .found > div{ border:1px solid var(--line); padding:12px 14px; }
  .found .big{ color:var(--ink); font-size:26px; line-height:1.2; margin:2px 0 6px; font-family:-apple-system, "Helvetica Neue", Arial, sans-serif; font-weight:600; }
  .found .where{ color:var(--ink3); font-size:12px; margin-top:8px; }
  .legend{ display:flex; flex-wrap:wrap; gap:6px 22px; align-items:center; margin:0 0 10px; font-size:12px; color:var(--ink2); max-width:none; }
  .key{ display:inline-block; width:22px; height:0; border-top:2px solid var(--ink3); vertical-align:middle; margin-right:8px; }
  .key.before{ border-top-color:var(--before); } .key.after{ border-top-color:var(--after); }
  .grid{ display:flex; flex-wrap:wrap; gap:10px; }
  figure.ch{ position:relative; margin:0; padding:10px 8px 4px; border:1px solid var(--hair); width:448px; max-width:100%; outline:none; }
  figure.ch:focus-visible{ border-color:var(--ink3); }
  figcaption{ font-size:12px; color:var(--ink2); margin:0 0 4px 4px; line-height:1.35; }
  figcaption b{ letter-spacing:.06em; } figcaption span{ display:block; color:var(--ink3); font-size:11px; }
  svg{ display:block; max-width:100%; height:auto; overflow:visible; }
  .grid line.grid, svg .grid{ stroke:#24242a; stroke-width:1; }
  svg .tick{ fill:#8c8c92; font:11px "SF Mono", Menlo, Consolas, monospace; font-variant-numeric:tabular-nums; }
  svg .ln{ fill:none; stroke-width:2; stroke-linejoin:round; stroke-linecap:round; }
  svg .ln.before, svg .dot.before, svg .hv.before{ stroke:var(--before); } svg .ln.after, svg .dot.after, svg .hv.after{ stroke:var(--after); }
  svg .ln.faint{ stroke-opacity:.42; } .key.faint{ opacity:.42; }
  svg .dot{ stroke:var(--panel); stroke-width:2; } svg .dot.before{ fill:var(--before); stroke:var(--panel); } svg .dot.after{ fill:var(--after); stroke:var(--panel); }
  svg .hv{ stroke:var(--panel); stroke-width:2; } svg .hv.before{ fill:var(--before); stroke:var(--panel); } svg .hv.after{ fill:var(--after); stroke:var(--panel); }
  svg .endv{ fill:#d2d2d2; font:600 12px "SF Mono", Menlo, Consolas, monospace; } svg .endn{ fill:#8c8c92; font:11px "SF Mono", Menlo, Consolas, monospace; }
  svg .lead{ stroke:#4a4a50; stroke-width:1; } svg .cross{ stroke:#6e6e74; stroke-width:1; }
  .tip{ position:absolute; z-index:3; pointer-events:none; background:#1a1a1f; border:1px solid var(--line); padding:6px 9px; font-size:12px; color:var(--ink2); white-space:nowrap; }
  .tip b{ display:inline-block; min-width:64px; text-align:right; margin-right:8px; } .tip .t{ color:var(--ink3); font-size:11px; display:block; margin-bottom:2px; }
  .tw{ overflow-x:auto; margin-top:12px; }
  table{ border-collapse:collapse; width:100%; }
  th{ text-align:right; font-size:11px; letter-spacing:.1em; color:var(--ink3); font-weight:400; padding:6px 8px; border-bottom:1px solid var(--line); white-space:nowrap; }
  td{ padding:5px 8px; border-bottom:1px solid var(--hair); font-size:13px; text-align:right; white-space:nowrap; color:var(--ink2); font-variant-numeric:tabular-nums; }
  th:first-child, td:first-child{ text-align:left; color:var(--ink); white-space:normal; }
  th.grp{ text-align:center; color:var(--ink2); border-left:1px solid var(--line); } table.sum td:nth-child(2), table.sum td:nth-child(6){ border-left:1px solid var(--line); }
  table.plain td, table.plain th{ text-align:left; white-space:normal; vertical-align:top; } table.plain td:first-child{ white-space:nowrap; }
  details{ margin-top:10px; color:var(--ink3); font-size:13px; } summary{ cursor:pointer; letter-spacing:.2em; font-size:12px; }
  details p, details li{ color:var(--ink2); } details.tv table td, details.tv table th{ font-size:12px; padding:4px 6px; }
  .shots{ display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:12px; } .shots img{ width:100%; height:auto; display:block; border:1px solid var(--line); } .cap{ color:var(--ink3); font-size:11px; margin-top:5px; }
  .pass{ color:var(--ink); }
  mark{ background:#3a1620; color:#d2d2d2; }
  @media (max-width:980px){ .found{ grid-template-columns:1fr; } .shots{ grid-template-columns:1fr; } body{ font-size:13px; } main{ padding:16px 10px 70px; } figure.ch{ width:100%; } }
</style>
</head>
<body>
<main>
<h1>RM1 · why the Hub and the Station eat memory when left open</h1>
<p class="lead">Alan, 7 Oct: <b>"When I leave Scintilla open and the Station open, it takes a lot of RAM in Activity Monitor after a while. When I quit and come back, it's perfectly fine … especially on the iMac it's a problem."</b></p>
<p class="sub">Each page was left open in a test browser with no window (headless, on the MacBook, during the trading session, with live data) and measured every 5 minutes: the live page for 90 minutes, then the same page with this branch's files for 50 — those runs were stopped early, for the reason given under "What went wrong during the test". Nothing was deployed, no table was written, nothing opened on screen.</p>

<section>
<h2>The short answer</h2>
<p>Three things were being kept that should have been let go. Two are in the Hub and grow for as long as it stays open; one is in the Station and is a fixed weight that scales with the size of the screen, which is why the iMac feels it most. All three are fixed on the branches. Quitting made it "perfectly fine" because closing the page is the only thing that released them.</p>
<div class="found">
  <div><h3>Hub · the news chime</h3>
    <div class="big">{{contexts.hubBefore}} in 90 minutes → {{chime.branchAlive}}</div>
    <p>Every time a favourite gets a headline the Hub rings a short chime, and for each chime it opened a new sound channel and <b>never closed it</b>. A browser never takes an open one back: each keeps a thread and its buffers until the page is closed. The feed-down alarm did the same.</p>
    <p>In the 90-minute run the live Hub was holding <b>{{contexts.hubBefore}} open channels</b> at the end and its process was running <b>{{threads.hubBeforeLast}} threads</b> (the same page starts at {{threads.hubAfterFirst}}); the branch's page was still at <b>{{threads.hubAfterLast}} threads</b> when its run was stopped at minute 50. That is one every four minutes — each time the favourites had a fresh headline, plus one for the feed-down alarm — so <b>up to about 360 a day</b>.</p>
    <p>Side by side for {{chime.minutes}} minutes, counting every channel each page opened: live opened {{chime.liveOpened}}, closed {{chime.liveClosed}}, <b>{{chime.liveAlive}} still alive</b>; the branch opened {{chime.branchOpened}}, closed {{chime.branchClosed}}, <b>{{chime.branchAlive}} still alive</b>.</p>
    <p>What one costs, measured on a blank page: {{audio.n}} chimes left {{audio.n}} channels alive after a forced clean-up — about <b>{{audio.threadsEach}} threads and {{audio.mbEach}} MB each</b>, and together <b>{{audio.cpuPct}}% of one processor core while silent</b>. Closed as each note ends, all of it came back.</p>
    <p class="where">Hub <code>index.html</code>, <code>chime()</code> (line 27107 on live b80c01e) and <code>scAlert()</code> (line 27394). Fix: <code>scAudioDone()</code> closes the channel when the note ends.</p></div>
  <div><h3>Hub · the news lists</h3>
    <div class="big">120 → {{news.day1}} rows a day</div>
    <p>A news list read from the server holds the newest 120 headlines. But every headline that arrived live was added to <b>every list that had ever been opened, and nothing was ever taken off</b>.</p>
    <p>Measured: the news table gained <b>{{news.day1}} headlines in the last 24 hours</b> ({{news.day2}} the day before; {{news.fav1}} of them for the FAVORITES names). Each arrival re-sorted the whole list, and with the NEWS room on screen each one redrew every headline in it.</p>
    <p>Side by side with the NEWS room open on ALL: in {{newsRoom.minutes}} minutes the live list went <b>120 → {{newsRoom.liveKept}} headlines</b> ({{newsRoom.perHour}} an hour) and the pieces of the page drawing it from {{newsRoom.livePieces0}} to {{newsRoom.livePieces1}}; the branch's stayed at <b>{{newsRoom.branchKept}}</b>.</p>
    <p>Now a list stays the newest 120, in the same order a fresh read gives — so nothing you see changes, it just stops growing.</p>
    <p class="where">Hub <code>index.html</code>, the live-news handler (line 26953 on live b80c01e). Fix: <code>newsCachePush()</code>.</p></div>
  <div><h3>Station · a copy of every chart's picture</h3>
    <div class="big">{{pixel.heldMB}} MB of {{pixel.totalMB}} MB</div>
    <p>To find an empty spot for the little context lens, each chart takes a full copy of its own picture (4 bytes for every pixel) — and then <b>kept that copy</b> until its next repaint. A parked chart never repaints, so it kept its copy for as long as it stayed parked.</p>
    <p>Measured on the live Station at 1680 wide: <b>{{pixel.bigMB}} MB for each two-up chart, {{pixel.smallMB}} MB for each eight-up one</b> — ten charts held {{pixel.heldMB}} of the page's {{pixel.totalMB}} MB of buffers. The copy grows with the screen, so it is larger on the iMac.</p>
    <p>Now the copy is handed back the moment the lens has its place: buffers fell from <b>{{pixel.beforeMean}} MB to {{pixel.afterMean}} MB</b> on average over the 90 minutes. Side by side at the same moment on an eight-chart wall: live {{pixel.sideLive}} MB, branch {{pixel.sideBranch}} MB, and <b>the lens in exactly the same place on {{pixel.lensSame}} of {{pixel.lensOf}} charts</b>.</p>
    <p class="where">Station <code>_indicators/lens-placement.mjs</code> <code>inkReader()</code> (line 452) and <code>_indicators/station-lens.mjs</code> (line 566). The Hub's company chart is the same pane, so it gains too.</p></div>
</div>
<p style="margin-top:12px">What was looked for and <b>not</b> found, so it is not guessed at later: timers and listeners do not pile up on either page (the counts below are flat lines); pieces of the page are not kept after they leave the screen; and clicking around the Hub leaves nothing behind — {{laps.count}} laps through {{laps.companies}} companies, every room and {{laps.lists}} lists moved the page's memory from {{laps.first}} MB to {{laps.last}} MB.</p>
</section>

<section>
<h2>What went wrong during the test</h2>
<p><b>From about 10:50 to 11:22 ET the live prices on the Hub and the Station were failing, and this test most likely caused it.</b> To finish inside the morning, the "after" runs were started while the "before" runs were still going, with two short side-by-side experiments on top — up to nine test pages reading live prices at once, about 250 to 270 price reads a minute from this Mac against about 100 from Alan's own screens. The price service stopped answering the quote read ("live price surface unavailable", a 20-second timeout) and its 15-minute frames fell 20 minutes behind. Other reads (candles, Geiger, macro) kept working.</p>
<p>What was done: every test page was stopped at 11:16 ET; a note went to the coordinator's handoffs and the observer's ledger at 11:22; nothing was restarted, redeployed or changed, by this lane or anyone — the machines' own records show no restart. The quote read answered again at 11:22 ET, six minutes after the test load came off. <b>Since then it has answered, but not steadily.</b> Watched with one light read every 30 to 45 seconds until {{probe.until}} ET ({{probe.reads}} reads; the log is <code>data/quotes-route-probe.txt</code>): {{probe.fast}} came back in under half a second, {{probe.slow}} took more than a second (most of them 1 to 4 seconds), and {{probe.failed}} got no answer at all (11:48 ET, in 25 seconds). The slowest reads came while another lane's test suite had test browsers open on this Mac, but slow ones also came with none. There is no reading of this route from before 10:50 to say what its normal spread is. So: the half hour of failures is most likely this lane's doing; whether the unsteadiness after it is left over from that or is the price path's ordinary state, this lane cannot tell without the service's own logs — it needs the coordinator's eyes.</p>
<p>What it means for the numbers below: the "after" runs are 50 minutes, not 90, and the faint part of every line is the stretch where the quote reads were failing (the last 25 minutes of each run). The three leaks do not depend on the price reads — the chime follows the news, the news list follows the news, and the charts' picture copies follow the candles — and each was also measured in its own side-by-side test. A full 90-minute "after" run still has to be done, outside market hours and one page at a time.</p>
<p>What it says about the price path itself, apart from this lane's mistake: every open Hub reads quotes about every 1.8 seconds and every Station about every 3 (and about three times as often when a read fails at once), each read is passed on to the price service, and the path stalled for everyone at roughly two and a half to three times the usual number of open screens. That is worth the provider lane's attention before more screens are added.</p>
</section>

<!--PAGES-->

<section>
<h2>Nothing on screen changed</h2>
<p>The fixes take nothing off the screen and move nothing. The same pages, live and from the branch, in the test browser at the same moment (1680 wide, then phone width). The prices differ by a few seconds; nothing else does.</p>
<div class="shots">
  <div><img src="shots/lens-live.jpg" alt="The live Station: an eight-chart wall, each chart with its small oval context lens"><div class="cap">THE STATION · LIVE — eight charts (GOOGL, NBIS, AVGO, BE, AMZN, VST, MU, WMT) with their clouds, the Geiger chip top right of each, and the small oval 4H lens on every chart. The X pane says its source is offline (no X window in a test browser); the video list shows below it; the two tapes run along the bottom.</div></div>
  <div><img src="shots/lens-branch.jpg" alt="The branch's Station at the same moment: the same wall, every lens in the same place"><div class="cap">THE STATION · THE BRANCH, the same moment — every oval lens sits in the same place ({{pixel.lensSame}} of {{pixel.lensOf}} measured to the pixel), while the page holds {{pixel.sideBranch}} MB of buffers instead of {{pixel.sideLive}} MB.</div></div>
  <div><img src="shots/hub-live-1680.jpg" alt="The live Hub dashboard"><div class="cap">THE HUB · LIVE — the header with LIVE and the bell (17 unread), the earnings and economic bands, today's scintillas, the FAVORITES board (71 names, Geiger bars, RVOL batteries) and the map grid on the right.</div></div>
  <div><img src="shots/hub-branch-1680.jpg" alt="The branch's Hub dashboard, the same"><div class="cap">THE HUB · THE BRANCH — the same page: same board, same order, same bars, same map.</div></div>
</div>
<details><summary>PHONE WIDTH (390) AND FRAMES FROM THE RUNS</summary>
<div class="shots" style="grid-template-columns:repeat(4, minmax(0,1fr)); margin-top:10px">
  <div><img src="shots/hub-live-390.jpg" alt="Live Hub at phone width" loading="lazy"><div class="cap">Hub · live · 390 — header, the two bands, scintillas, list tabs, the board stacked.</div></div>
  <div><img src="shots/hub-branch-390.jpg" alt="Branch Hub at phone width" loading="lazy"><div class="cap">Hub · branch · 390 — the same.</div></div>
  <div><img src="shots/station-live-390.jpg" alt="Live Station at phone width" loading="lazy"><div class="cap">Station · live · 390 — SPY above SNDK, clouds and Geiger chips.</div></div>
  <div><img src="shots/station-branch-390.jpg" alt="Branch Station at phone width" loading="lazy"><div class="cap">Station · branch · 390 — the same.</div></div>
</div>
<div class="shots" style="margin-top:12px">
  <div><img src="shots/before-hub-end.jpg" alt="The live Hub after 90 minutes, its badge reading STALE" loading="lazy"><div class="cap">Hub · live · minute 90 — {{frames.beforeHub}}</div></div>
  <div><img src="shots/before-station-end.jpg" alt="The live Station after 90 minutes" loading="lazy"><div class="cap">Station · live · minute 90 — {{frames.beforeStation}}</div></div>
  <div><img src="shots/before-hubco-start.jpg" alt="The live Hub with NVDA open" loading="lazy"><div class="cap">Hub with a company open · live · minute 0 — {{frames.beforeHubco}}</div></div>
  <div><img src="shots/after-hub-start.jpg" alt="The branch's Hub at the start of its run" loading="lazy"><div class="cap">Hub · branch · minute 0 — {{frames.afterHub}}</div></div>
  <div><img src="shots/after-station-start.jpg" alt="The branch's Station at the start of its run" loading="lazy"><div class="cap">Station · branch · minute 0 — {{frames.afterStation}}</div></div>
</div>
</details>
</section>

<section>
<h2>The night reload — the stopgap</h2>
<p>Alan: <b>"at least a calendar of overnight quitting and restarting would be nice — but for the Station that means opening the Station in the Brave PWA, X in the Brave PWA, executing the extension in the X PWA."</b> A browser gathers some weight of its own over days whatever a page does (and the video player's memory is YouTube's, not ours to fix). So both pages now do the quit-and-reopen for themselves, and neither needs the X steps: only the Hub page or the Station page loads again. <b>The X window and its extension are never touched</b> — the extension keeps the picture and the Station's new X pane takes it back by itself, exactly as after every release.</p>
<div class="tw"><table class="plain">
<tr><th></th><th>The Hub</th><th>The Station</th></tr>
<tr><td>When</td><td colspan="2">Between <b>3 and 5 in the morning</b>, by that computer's clock, if the page has been open <b>four hours or more</b>. Once a night: a page that has just loaded is not four hours old. A Mac that slept through its night gets it at the next quiet moment once the page is <b>thirty hours</b> old.</td></tr>
<tr><td>Only if</td><td>Nobody has touched the page for two minutes, no video is playing, nobody is typing — the same rule that already decides when the Hub may load a new release. And the server must have just answered, so it can never reload into an error page.</td><td>Nobody has touched the Station or any pane for two minutes, no video is on the stage, and a live X picture has had its 30 minutes — the same rule that already decides when the Station may load a new release. And the server must have just answered.</td></tr>
<tr><td>It waits while</td><td>The Hub's own video player is open, a section or the browser is full screen, or a panel is open over the page (the bell, a file, the chart pop-up, a menu). <span class="pass">{{verify.hubHold}}</span></td><td>A video is open in a pane (playing or paused), the Station is in the browser's full screen, or a video is floating in its own window. <span class="pass">{{verify.stationHold}}</span></td></tr>
<tr><td>What comes back</td><td>The room and its sub-tab, the board's list, the company that was open (and EXPAND), and where each panel was scrolled to. Lists and stars live on the server; the company tab and the compare tab were remembered already.</td><td>The scene, the page, the timeframe, the chart count, the feeds and the lists were remembered already; the pane that was expanded and the place each video list was scrolled to are carried over.</td></tr>
<tr><td>Proved</td><td class="pass">{{verify.hub}}</td><td class="pass">{{verify.station}}</td></tr>
<tr><td>Switch it off</td><td>Open the Hub once at <code>scintillahub.ai/?nightreload=0</code> — that browser remembers it. <code>?nightreload=1</code> turns it back on. For every browser at once: <code>HUB_NIGHT_RELOAD_DEFAULT_ON = false</code> in <code>index.html</code>.</td><td>Open the Station once at <code>station.scintillahub.ai/?nightreload=0</code> — that browser remembers it. <code>?nightreload=1</code> turns it back on. For every browser at once: <code>NIGHT_RELOAD_DEFAULT_ON = false</code> in <code>deck/index.html</code>.</td></tr>
</table></div>
<p class="dim">On each branch the stopgap is in its own commits, after the fixes, so the fixes can ship with or without it.</p>
</section>

<section>
<h2>What could be wrong</h2>
<ul>
<li><b>The iMac was not measured.</b> The lanes do not touch it. Everything here is the MacBook's test browser at 1680 × 1050 on a retina screen. The Station's picture copies scale with the screen, so the iMac's saving should be larger than the one shown; the Hub's sound channels do not depend on the screen at all.</li>
<li><b>The X picture and a playing video were not in the test.</b> The X pane needs Alan's own X window and the extension, and the test browser refuses every request that is not a plain read, which also stops YouTube from playing. The Station was measured with its X pane waiting ("X SOURCE IS OFFLINE") and its video list showing but not playing. The X pane's code was read line by line instead: its picture frames are closed after each paint and nothing was found that piles up. What a video player gathers over a day is not known from this test — that is the main thing the night reload is for.</li>
<li><b>"Process memory" includes the measuring tool.</b> The test browser keeps its own log of every request the page makes, in the same process, in both runs. So that row rises a little in both; the before and after are still a fair pair. The other rows are the page's own.</li>
<li><b>The "after" runs are 50 minutes, and the last 25 minutes of every run had no live quotes</b> (see "What went wrong during the test"). The two Hub leaks are steady rates (so many an hour) and show plainly in that time; a full 90-minute "after" run is still owed.</li>
<li><b>90 minutes is not a week.</b> Something that only appears after days would not show here.</li>
<li><b>The chime count depends on the news.</b> The test browser reads Alan's FAVORITES from the server, so it chimed for his names at the real rate for that hour of that day.</li>
</ul>
</section>

<section>
<h2>What was not done</h2>
<ul>
<li>Nothing is deployed. Two branches are pushed for the coordinator: Hub <code>{{sha.hubBranch}}</code> (code at <code>{{sha.hub}}</code>) and Station <code>{{sha.stationBranch}}</code> (code at <code>{{sha.station}}</code>); this report and its data are the commit after each.</li>
<li>The Station's shared store of price history was left as it is. It is the largest thing the Station's own code holds ({{station.candleMB}} MB after 25 minutes) but it empties itself every half hour by design and has a ceiling, so it rises and falls rather than grows.</li>
<li>Parked charts still keep their drawing surfaces. Letting those go while parked would save more on a large screen, but it touches how smoothly a chart fades in, so it needs eyes on the wall first.</li>
<li>The night reload does not keep a typed search, and it does not put a full-screen section back: it waits instead while one is up, so a Hub left full screen for days is not reloaded at night (the leaks themselves are fixed either way).</li>
</ul>
</section>

<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<p><b>How each page was measured.</b> Headless Chromium on the MacBook, 1680 × 1050 at retina scale, New York time, one browser per page. The page is loaded, left 2 minutes to settle, then read every 5 minutes (before: 90 minutes for the Hub and the Station, 85 for the Hub with a company open; after: 50 minutes each): the JS heap after a forced clean-up, the raw buffers, every node the browser is keeping (and those kept off the page), event listeners, repeating and one-shot timers (counted where they are created, by code line), canvases and their pixels, documents, open sockets, requests, and the memory and threads of the whole test browser. A full picture of the page's memory is taken at the start and the end and compared object by object (the runs that were stopped early have a start picture only).</p>
<p><b>Before and after are the same test.</b> "Before" is the live address as deployed (Hub b80c01e, Station b859b30 — checked byte for byte against the branch points). "After" is the same live address, with only the changed files answered from the branch (Hub {{sha.hubCode}} <code>index.html</code>; Station {{sha.stationCode}} <code>deck/index.html</code> and the two lens files), so every number still comes from the live services. The commits made after those two only touch the night reload (what it waits for, what it keeps), which a soak does not exercise; they were proved by the night-reload runs instead. The after runs started {{times.afterLag}} minutes after the before runs, in the same session, and overlapped them — which is what overloaded the price service.</p>
<p><b>Kept safe.</b> Every request that is not a plain read was refused and counted, so nothing could be saved or written (the two runs that ran to their end: {{blocked.summary}}). The live sockets carried only joins and heartbeats. No key was printed or stored.</p>
<p><b>Chart colours.</b> Red is before, green is after — the house's two direction colours, stepped until the colour-blind check passed on this panel (before #CC1F44, after #1DAD7B). Every chart also names its lines at their ends, and every number is in the table view under it.</p>
<p><b>Tests.</b> Hub: {{tests.hub}}. Station: {{tests.station}}.</p>
<p><b>Files.</b> Tools in <code>tools/</code> (the soak, the lap test, the heap comparers, the sound-channel experiment, the night-reload run on a moved clock); every reading in <code>data/</code>.</p>
</details>
</main>
<script>
/*DATA*/
/* the hover layer: a hairline that finds the minute, and one readout with both lines; arrow keys do the same */
(function () {
  const fmt = (v, d) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  for (const fig of document.querySelectorAll("figure.ch")) {
    const svg = fig.querySelector("svg"), tip = fig.querySelector(".tip"), cross = svg.querySelector(".cross");
    const dots = { before: svg.querySelector(".hv.before"), after: svg.querySelector(".hv.after") };
    const S = RM1.series[fig.dataset.page], key = fig.dataset.key, unit = RM1.units[key];
    const L = +svg.dataset.l, IW = +svg.dataset.iw, T = +svg.dataset.t, IH = +svg.dataset.ih, lo = +svg.dataset.lo, hi = +svg.dataset.hi;
    const minutes = [...new Set([].concat((S.before[key] || []).map((p) => Math.round(p[0])), (S.after[key] || []).map((p) => Math.round(p[0]))))].sort((a, b) => a - b);
    if (!minutes.length) continue;
    let at = -1;
    const near = (pts, min) => { let best = null; for (const p of pts || []) if (best === null || Math.abs(p[0] - min) < Math.abs(best[0] - min)) best = p; return best && Math.abs(best[0] - min) <= 3 ? best : null; };
    const show = (i) => {
      at = Math.max(0, Math.min(minutes.length - 1, i));
      const min = minutes[at], x = L + (Math.min(90, min) / 90) * IW;
      cross.setAttribute("x1", x); cross.setAttribute("x2", x); cross.setAttribute("visibility", "visible");
      tip.textContent = "";
      const head = document.createElement("span"); head.className = "t"; head.textContent = "minute " + min; tip.appendChild(head);
      for (const name of ["before", "after"]) {
        const p = near(S[name][key], min), dot = dots[name];
        if (!p) { dot.setAttribute("visibility", "hidden"); continue; }
        dot.setAttribute("cx", L + (Math.min(90, p[0]) / 90) * IW); dot.setAttribute("cy", T + IH - ((p[1] - lo) / (hi - lo)) * IH); dot.setAttribute("visibility", "visible");
        const row = document.createElement("div"), k = document.createElement("i"), v = document.createElement("b"), n = document.createElement("span");
        k.className = "key " + name; v.textContent = fmt(p[1], unit[2]) + (unit[1] ? " " + unit[1] : ""); n.textContent = name;
        row.appendChild(k); row.appendChild(v); row.appendChild(n); tip.appendChild(row);
      }
      tip.hidden = false;
      const box = svg.getBoundingClientRect(), frame = fig.getBoundingClientRect(), scale = box.width / svg.viewBox.baseVal.width, left = box.left - frame.left + x * scale;
      tip.style.top = (box.top - frame.top + 6) + "px";
      tip.style.left = (left + 12 + tip.offsetWidth > fig.clientWidth ? Math.max(0, left - 12 - tip.offsetWidth) : left + 12) + "px";
    };
    const hide = () => { tip.hidden = true; cross.setAttribute("visibility", "hidden"); dots.before.setAttribute("visibility", "hidden"); dots.after.setAttribute("visibility", "hidden"); at = -1; };
    svg.addEventListener("pointermove", (e) => {
      const box = svg.getBoundingClientRect(), vx = (e.clientX - box.left) * (svg.viewBox.baseVal.width / box.width), min = ((vx - L) / IW) * 90;
      let best = 0; for (let i = 1; i < minutes.length; i++) if (Math.abs(minutes[i] - min) < Math.abs(minutes[best] - min)) best = i;
      show(best);
    });
    svg.addEventListener("pointerleave", hide);
    fig.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { show(at < 0 ? 0 : at + 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { show(at < 0 ? minutes.length - 1 : at - 1); e.preventDefault(); }
      else if (e.key === "Escape") hide();
    });
    fig.addEventListener("blur", hide);
  }
})();
</script>
</body>
</html>

<p>The client changes stop the chart from asking for a Geiger reading <i>while</i> it is loading. They cannot stop the freeze itself, and other things still ask for Geigers (the Hub's board, the Hub's GEIGER tab, every other open Station). The fix that would help most is on the chart API server, and it belongs to the I5 lane. It is written up precisely, with the measurements and a check to run after, in <a href="I5-SERVER-ASK.md" style="color:var(--ink)">I5-SERVER-ASK.md</a>:</p>
<ol>
<li><b>Take the Geiger route off the server's single lane of work.</b> Keep the checked Geiger file in memory and rebuild it only when a new one is published (every ~5 min), so a Geiger answer is a quick lookup. Target: under 0.15 s, and a <code>/universe</code> sent during it still 0.11 s.</li>
<li><b>Same for <code>/health</code></b> (13.9 s and 17.3 s today): answer from the last check and refresh it in the background.</li>
<li><b>One request for the board's little charts.</b> The Hub asks for them one row at a time: 75–150 requests in its first 2 seconds.</li>
<li><b>Check the cache for the 3H/6H/8H/12H widths</b>: one cold 3H read waited 4.4 s where 4H took 0.6 s.</li>
</ol>
<p>I did not deploy or change the chart API.</p>

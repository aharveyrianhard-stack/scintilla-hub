<h3>Where each number comes from</h3>
<ul>
<li><b>Appearance times</b> (price, clouds, fan, lens, Geiger chip): a headless Chrome on this MacBook opened the page and looked inside each chart frame every 50 ms. "Price" = the frame holds its bars and has drawn them; "clouds" = its daily cloud rows are in; "fan" = all six RSI lines have values; "lens" = the lens has placed itself; "Geiger chip" = the chip is visible. Times count from the click (Hub) or from the page starting to load (Station).</li>
<li><b>Waterfalls</b>: the browser's own network log (Chrome DevTools Protocol) — each request's start, end, bytes on the wire and whether the browser answered it from its own cache (none were: the chart API marks its answers 60 s cacheable, but every request here was new).</li>
<li><b>The freeze</b>: <code>curl</code> from this MacBook, read-only, one Geiger read with a /universe read sent 0.15 s into it (§1, and I5-SERVER-ASK.md).</li>
<li>Raw files: <code>data/final/*.json</code> (the three-and-three runs), <code>data/before-*.json</code> (the first baseline), <code>data/c1-*</code>, <code>c2-*</code>, <code>h1-*</code>, <code>d1-*</code> (each change's own before/after). Harness: <code>tools/speed.mjs</code>, <code>tools/final.sh</code>; page: <code>tools/build.py</code>.</li>
</ul>
<h3>What could be wrong</h3>
<ul>
<li><b>The chart API was busy with other traffic today</b> (other lanes test against it). Some runs, before and after alike, were several times slower than others: in one before-run on TARGETS only 2 of 8 charts drew in 15 s. That is why every comparison alternates before/after runs minutes apart and shows all three runs, not the best one.</li>
<li>For AFTER, the Station's page files were served from this MacBook's disk under the real Station address (so the chart API saw its real origin — nothing was relaxed). That makes the page files arrive ~0.05–0.1 s sooner than from the internet; the data requests went to the real chart API in both cases. The differences reported are much larger than that.</li>
<li>A headless browser on a fast connection. Your iMac on Wi-Fi will be slower in absolute terms; the order of what appears should hold.</li>
<li>The Geiger chip now comes later on the Hub chart (it waits for the chart's own reads), by about 0–2 s. On the Station wall it is about the same (±0.5 s).</li>
</ul>
<h3>What I did not do</h3>
<ul>
<li>No deploy, no chart-API change, no database change. Branches pushed; the coordinator merges and deploys (Station first is fine — the Hub branch has no code change).</li>
<li>No change to the ownership check, the Geiger reading, the RSI arithmetic or the cloud arithmetic.</li>
<li>Did not measure a Station rotation (the two-at-a-time path) or a phone on a real mobile network.</li>
<li>Did not build the Hub side of a batch sparkline request (needs the server route first).</li>
<li>Noticed, not changed: the chart frame's message listener does not check who sent a message (already the case on live). Worth a small hardening pass by the Station owner.</li>
</ul>

<p class="lead"><b>The main reason: every time anything asks the chart server for a Geiger reading, the server stops answering everything else for 2–5 seconds.</b> Opening a company asked it for a Geiger reading at the same moment it asked for the clouds and the six RSI lines, so those waited. That was most of the nine seconds.</p>
<p>What changed, on the Station (the chart in the Hub's company view <i>is</i> the Station's chart): the chart now asks for its own Geiger chip only after its price, clouds, RSI fan and lens have arrived, and the Station wall asks for its Geigers only after its prices and clouds. The RSI fan also stopped asking twice for daily bars it already had. Nothing the chart shows changed; only the order of the requests did.</p>
<div class="box"><b>Result, median of three runs each, measured against today's live Station (64124b6):</b>
<ul>
<li><b>RSI fan (the nine-second part), Hub MU:</b> warm opens <b>5.2 s → 1.8 s</b> (board row) and <b>11.9 s → 2.5 s</b> (first second after load); cold opens 5.9 s → 4.0 s and 6.1 s → 5.1 s.</li>
<li><b>Clouds, Hub MU, cold:</b> 5.6 s → 3.9 s and 5.7 s → 3.2 s. Warm: under 0.2 s before and after (they come from the browser's memory).</li>
<li><b>Price line:</b> warm 0.1–0.2 s before and after — inside your 1–2 s. Cold it is 0.2–4.3 s in <i>both</i> versions and swings run to run; the slow ones were the Hub's own requests (its GEIGER tab reading, its every-2-seconds quotes for all 486 names) landing on the price request. See §3.</li>
<li><b>Station TARGETS (8 charts):</b> cold price 2.6 s → 2.2 s, clouds 2.9 s → 2.3 s, lens 2.9 s → 2.2 s; warm lens 1.6 s → 0.8 s.</li>
<li><b>The cost:</b> the Geiger chip comes later — on the Hub's chart 2.8 s → 7.2 s cold (warm 3.1 s → 4.3 s), on the Station wall 2.7 s → 4.8 s cold. The Hub's own Geiger tile beside the chart is not delayed.</li>
</ul></div>
<p><b>The real cure is on the server</b> (another lane owns it): make the Geiger answer a quick lookup instead of a stop-everything job. Then nothing has to wait for anything, and the chip comes back early too. §7.</p>

// Caption-route probe: prints status codes and counts only. No key from the environment is read.
const ids = process.argv.slice(2);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const out = [];
for (const id of ids) {
  const rec = { id };
  try {
    const w = await fetch(`https://www.youtube.com/watch?v=${id}`, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US' } });
    rec.watch = w.status; const html = await w.text();
    rec.consent_or_bot = /Sign in to confirm|consent\.youtube|unusual traffic/i.test(html);
    const k = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
    const p = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${k ? k[1] : ''}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)' },
      body: JSON.stringify({ context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } }, videoId: id }) });
    rec.player = p.status; const j = await p.json();
    rec.playability = j?.playabilityStatus?.status; rec.reason = (j?.playabilityStatus?.reason || '').slice(0, 80);
    const tr = j?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    rec.tracks = tr.length;
    const en = tr.find(t => (t.languageCode || '').startsWith('en')) || tr[0];
    if (en) { const c = await fetch(en.baseUrl.replace(/&fmt=\w+/, '') + '&fmt=json3', { headers: { 'User-Agent': UA } }); rec.caption = c.status; const t = await c.text(); rec.caption_bytes = t.length; try { rec.events = JSON.parse(t).events.length; } catch { rec.events = 0; } }
  } catch (e) { rec.error = String(e.message || e).slice(0, 100); }
  out.push(rec);
}
console.log(JSON.stringify(out));

// 1 Nov 2026 (coordinator). YOUTUBE TELLS US. Alan: "I get notifications for videos to watch on YouTube from the subscribed channels, faster than I see them on the station ...
// my idea was whenever it's posted, if it's a subscribed channel, if it doesn't cost a query, it just goes in."
// YouTube's own announcement service (WebSub, the hub at pubsubhubbub.appspot.com) calls this function when a followed channel uploads. The announcement costs nothing; the one detail call costs 1 unit.
// MEASURED before this, 29 Oct - 1 Nov, 180 videos on the SCINTILLA list: half in the table within 7.7 min, 90% within 22.9, 15 over 30 min. The free channel feed was answering 404 for 204 of 208 channels, from the cloud and from the Mac.
// yt-rss-sweep stays as it is and catches anything this misses: a row written here is simply "already stored" to it.
// GET with hub.challenge: the hub checking we asked. POST: an upload, signed with our secret. POST ?renew=1 (cron, daily): subscribes every followed channel whose lease ends within two days.
const SB = Deno.env.get("SUPABASE_URL") || "", SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "", SECRET = Deno.env.get("YT_PUSH_SECRET") || "";
const HUB = "https://pubsubhubbub.appspot.com/subscribe", CALLBACK = SB + "/functions/v1/yt-push", LEASE_S = 864000, RENEW_WITHIN_S = 172800;
const ACCOUNTS = ["personal", "scintilla", "soundscapes", "golf", "ai_research", "fitness", "networks"], CHANNEL = /^UC[\w-]{22}$/;
const H = { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "content-type": "application/json" };
const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const topicOf = (id: string) => "https://www.youtube.com/feeds/videos.xml?channel_id=" + id;
const unesc = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
async function pg(path: string, init: RequestInit = {}) { const r = await fetch(SB + "/rest/v1/" + path, { ...init, headers: { ...H, ...(init.headers || {}) } }); const t = await r.text(); if (!r.ok) throw new Error(path.split("?")[0] + " -> " + r.status + " " + t.slice(0, 200)); return t ? JSON.parse(t) : null; }
const rpc = (fn: string, a: Record<string, unknown> = {}) => pg("rpc/" + fn, { method: "POST", body: JSON.stringify(a) });
async function authorized(req: Request) { const b = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""); if (!b) return false; if (b === SERVICE) return true; try { return (await rpc("push_cron_key_ok", { k: b })) === true; } catch (_) { return false; } }
async function signatureOk(raw: string, header: string) {
  if (!SECRET) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  return header === "sha1=" + [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
}
// who follows what: the same lists the sweep reads (app_config yt_sub_channels_<account>), the X-follows bridge riding with SCINTILLA. Kept ten minutes.
let LISTS: { at: number; by: Map<string, Set<string>>; key: string } | null = null;
async function lists() {
  if (LISTS && Date.now() - LISTS.at < 600000) return LISTS;
  const keys = ["YT_API_KEY", "yt_sub_channels", "yt_bridge_channels", ...ACCOUNTS.map((a) => "yt_sub_channels_" + a)];
  const rows = await pg("app_config?select=key,value&key=in.(" + keys.join(",") + ")"); const C: Record<string, string> = {}; for (const r of rows) C[r.key] = String(r.value || "");
  const by = new Map<string, Set<string>>();
  const add = (id: string, a: string) => { if (!CHANNEL.test(String(id))) return; if (!by.has(id)) by.set(id, new Set()); by.get(id)!.add(a); };
  for (const a of ACCOUNTS) { try { const c = JSON.parse(C["yt_sub_channels_" + a] || (a === "scintilla" ? C.yt_sub_channels : "") || "{}"); for (const id of Array.isArray(c.ids) ? c.ids : []) add(id, a); } catch (_) { /* a bad row is an empty list */ } }
  try { const b = JSON.parse(C.yt_bridge_channels || "null"); for (const r of Array.isArray(b) ? b : (b && (b.channels || b.rows || b.ids)) || []) { const id = typeof r === "string" ? r : r && r.channel_id; const ok = typeof r === "string" || !r.confidence || ["high", "medium", "exact", "verified"].includes(String(r.confidence)); if (ok) add(id, "scintilla"); } } catch (_) { /* no bridge */ }
  LISTS = { at: Date.now(), by, key: C.YT_API_KEY.replace(/"/g, "").trim() };
  return LISTS;
}
const iso2sec = (s?: string) => { const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(s || "")); return m ? (+(m[1] || 0)) * 86400 + (+(m[2] || 0)) * 3600 + (+(m[3] || 0)) * 60 + (+(m[4] || 0)) : 0; };
async function isShort(id: string) { try { const r = await fetch("https://www.youtube.com/shorts/" + id, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(6000) }); return r.status >= 200 && r.status < 300; } catch (_) { return false; } }
async function take(e: { video_id: string; channel_id: string; title: string; author: string; published: string }) {
  const L = await lists(), accounts = L.by.get(e.channel_id);
  const log = (wrote: boolean, already: boolean, note: string | null) => pg("yt_push_log", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ video_id: e.video_id, channel_id: e.channel_id, published_at: e.published || null, wrote, already, note }) }).catch(() => {});
  await pg("yt_push_subs?channel_id=eq." + e.channel_id, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ last_push_at: new Date().toISOString() }) }).catch(() => {});
  if (!accounts) return log(false, false, "not followed");
  const have = await pg("youtube_videos?select=video_id&video_id=eq." + e.video_id);
  if (have && have.length) return log(false, true, null);
  const r = await fetch("https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet,liveStreamingDetails&maxResults=1&id=" + e.video_id + "&key=" + encodeURIComponent(L.key), { signal: AbortSignal.timeout(10000) });
  const it = r.ok ? ((await r.json()).items || [])[0] : null;
  if (!it) return log(false, false, r.ok ? "not public yet" : "videos " + r.status);   // the sweep finds it later
  const now = Math.floor(Date.now() / 1000), sn = it.snippet || {}, live = it.liveStreamingDetails || {}, secs = iso2sec(it.contentDetails?.duration);
  const row = { video_id: e.video_id, channel_id: e.channel_id, channel_title: sn.channelTitle || e.author, title: sn.title || e.title, description: String(sn.description || "").slice(0, 500), thumbnail: sn.thumbnails?.high?.url || sn.thumbnails?.medium?.url || sn.thumbnails?.default?.url || null, url: "https://www.youtube.com/watch?v=" + e.video_id, published_at: sn.publishedAt || e.published, source: "subscription", ticker: null, updated_ts: now, duration_sec: secs > 0 ? secs : null, live_broadcast: String(sn.liveBroadcastContent || "none"), live_started_at: live.actualStartTime || null, live_ended_at: live.actualEndTime || null, live_scheduled_at: live.scheduledStartTime || null, live_checked_ts: now, is_short: await isShort(e.video_id), subscription_accounts: [...accounts].sort() };
  await pg("youtube_videos?on_conflict=video_id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify([row]) });
  return log(true, false, null);
}
Deno.serve(async (req) => {
  const u = new URL(req.url), q = u.searchParams;
  try {
    if (req.method === "GET") {
      const challenge = q.get("hub.challenge"), id = (String(q.get("hub.topic") || "").match(/channel_id=(UC[\w-]{22})/) || [])[1];
      if (!challenge || !id) return J({ ok: true });
      const known = await pg("yt_push_subs?select=channel_id&channel_id=eq." + id);
      if (!known || !known.length) return new Response("not asked", { status: 404 });
      if (q.get("hub.mode") === "subscribe") await pg("yt_push_subs?channel_id=eq." + id, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ verified_at: new Date().toISOString(), lease_until: new Date(Date.now() + 1000 * Number(q.get("hub.lease_seconds") || LEASE_S)).toISOString() }) });
      return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
    }
    if (q.get("renew")) {
      if (!(await authorized(req))) return J({ error: "unauthorized" }, 401);
      if (!SECRET) return J({ error: "no secret" }, 500);
      LISTS = null; const L = await lists(), followed = [...L.by.keys()];
      const subs = await pg("yt_push_subs?select=channel_id,lease_until&limit=2000"), lease = new Map<string, string>((subs || []).map((s: { channel_id: string; lease_until: string }) => [s.channel_id, s.lease_until]));
      const soon = Date.now() + RENEW_WITHIN_S * 1000, todo = followed.filter((id) => { const t = lease.get(id); return !t || Date.parse(t) < soon; });
      if (todo.length) await pg("yt_push_subs?on_conflict=channel_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(todo.map((channel_id) => ({ channel_id, requested_at: new Date().toISOString() }))) });
      let ok = 0, failed = 0, lastError = "";
      for (let i = 0; i < todo.length; i += 12) await Promise.all(todo.slice(i, i + 12).map(async (id) => {
        try { const r = await fetch(HUB, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(15000), body: new URLSearchParams({ "hub.callback": CALLBACK, "hub.topic": topicOf(id), "hub.mode": "subscribe", "hub.verify": "async", "hub.secret": SECRET, "hub.lease_seconds": String(LEASE_S) }) }); if (r.status >= 200 && r.status < 300) ok++; else { failed++; lastError = r.status + " " + (await r.text()).slice(0, 120); } }
        catch (e) { failed++; lastError = String(e).slice(0, 120); }
      }));
      return J({ followed: followed.length, asked: todo.length, ok, failed, lastError });
    }
    // an upload
    const raw = await req.text();
    if (!(await signatureOk(raw, req.headers.get("x-hub-signature") || ""))) return new Response("", { status: 202 });   // the hub is told fine; nothing is done
    for (const m of raw.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
      const x = m[1], video_id = (x.match(/<yt:videoId>([^<]+)/) || [])[1], channel_id = (x.match(/<yt:channelId>([^<]+)/) || [])[1];
      if (video_id && channel_id) await take({ video_id, channel_id, title: unesc((x.match(/<title>([^<]*)/) || [])[1] || ""), author: unesc((x.match(/<name>([^<]*)/) || [])[1] || ""), published: (x.match(/<published>([^<]+)/) || [])[1] || "" });
    }
    return new Response("", { status: 204 });
  } catch (e) { return J({ error: String(e).slice(0, 300) }, req.method === "GET" ? 500 : 202); }
});

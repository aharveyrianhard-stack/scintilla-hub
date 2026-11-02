// 1 Nov 2026 (coordinator). THE LIGHT READ: title and chapters, no transcript, no model, no tokens. Alan: "for the ones that we don't want to go so deep, we just analyze what sections were covered ...
// maybe prompt like, hey, do you want us to pull the full transcript on this?" and "systemically the chapter title ones" for CNBC and Bloomberg.
// Every 20 minutes: new videos on the channels he follows and on NEWS TV -> the full description from YouTube's official API (one quota unit per 50 videos) -> its chapters and the names it mentions ->
// public.youtube_reads (tier light; never over a full read) -> a silent Mac card when it mentions one of his names. The read page offers "read this one in full".
const SB = Deno.env.get("SUPABASE_URL") || "", SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const H = { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "content-type": "application/json" };
const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const READ_PAGE = "https://station.scintillahub.ai/notify/read.html";
const CARD_WITHIN_H = 3, LOOK_BACK_H = 48, BATCH = 50, BATCHES = 3;
async function pg(path: string, init: RequestInit = {}) { const r = await fetch(SB + "/rest/v1/" + path, { ...init, headers: { ...H, ...(init.headers || {}) } }); const t = await r.text(); if (!r.ok) throw new Error(path.split("?")[0] + " -> " + r.status + " " + t.slice(0, 200)); return t ? JSON.parse(t) : null; }
const rpc = (fn: string, a: Record<string, unknown> = {}) => pg("rpc/" + fn, { method: "POST", body: JSON.stringify(a) });
let cronKeyYes: { b: string; until: number } | null = null;
async function authorized(req: Request) { const b = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""); if (!b) return false; if (b === SERVICE) return true; if (cronKeyYes && cronKeyYes.b === b && Date.now() < cronKeyYes.until) return true; try { if ((await rpc("push_cron_key_ok", { k: b })) === true) { cronKeyYes = { b, until: Date.now() + 600_000 }; return true; } } catch (_) { /* a failed lookup is a no */ } return false; }
export function chaptersOf(desc: string) { const out: Array<{ at: string; title: string }> = []; for (const line of String(desc || "").split(/\r?\n/)) { const m = /^\s*\(?(\d{1,2}:\d{2}(?::\d{2})?)\)?\s*[-–—:|]?\s*(.+)$/.exec(line); if (m) out.push({ at: m[1], title: m[2].trim().slice(0, 120) }); } return out.length >= 2 ? out : []; }
type Video = { video_id: string; channel_id: string; channel_title: string; title: string; published_at: string; duration_sec: number | null; subscription_accounts?: string[] };
// the description without its links, codes and sign-up lines: what the local model reads when there are no chapters
export function plainDescription(desc: string) { return String(desc || "").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/https?:\/\/|www\.|^#|subscribe|discount|promo code|sponsor|affiliate|patreon|follow (me|us)|^(instagram|twitter|x|tiktok|facebook|linkedin|discord|telegram)\b/i.test(l) && !/^\(?\d{1,2}:\d{2}/.test(l)).join("\n").slice(0, 1500); }
Deno.serve(async (req) => {
  if (!(await authorized(req))) return J({ error: "unauthorized" }, 401);
  try {
    const cfg = await pg("app_config?select=key,value&key=in.(YT_API_KEY,brain_deep_channels)"); const C: Record<string, string> = {}; for (const r of cfg) C[r.key] = String(r.value || "");
    const KEY = String(C.YT_API_KEY || "").replace(/"/g, "").trim(); if (!KEY) return J({ skipped: "no key" });
    const deep = new Set(Object.keys((JSON.parse(C.brain_deep_channels || "{}") || {}).ids || {}));
    // ?backfill=1: rows from before the description column get theirs (one quota unit per 50 videos)
    if (new URL(req.url).searchParams.get("backfill")) {
      const old: Array<{ video_id: string }> = await pg("youtube_reads?select=video_id&tier=eq.light&description=is.null&published_at=gte." + encodeURIComponent(new Date(Date.now() - 96 * 3600000).toISOString()) + "&order=published_at.desc&limit=300");
      let filled = 0;
      for (let i = 0; i < old.length; i += BATCH) {
        const r = await fetch("https://www.googleapis.com/youtube/v3/videos?part=snippet&maxResults=50&id=" + old.slice(i, i + BATCH).map((v) => v.video_id).join(",") + "&key=" + encodeURIComponent(KEY), { signal: AbortSignal.timeout(12000) });
        if (!r.ok) return J({ error: "youtube " + r.status, filled });
        for (const it of (await r.json()).items || []) { const d = plainDescription(it.snippet?.description || ""); if (d) { await pg("youtube_reads?video_id=eq." + it.id, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ description: d }) }); filled++; } }
      }
      return J({ asked: old.length, filled });
    }
    const since = new Date(Date.now() - LOOK_BACK_H * 3600000).toISOString();
    // 1 Nov: his market lists, his AI list and his personal list get a read. Sleep sounds and golf do not; only the market lists can raise a card ("My iPad Mini OLED Impressions" is not an AAPL alert).
    const vids: Video[] = await pg("youtube_videos?select=video_id,channel_id,channel_title,title,published_at,duration_sec,subscription_accounts&is_short=not.is.true&subscription_accounts=ov.{scintilla,networks,ai_research,personal}&published_at=gte." + encodeURIComponent(since) + "&order=published_at.desc&limit=400");
    const todo0 = (vids || []).filter((v) => !deep.has(v.channel_id));
    if (!todo0.length) return J({ candidates: 0 });
    const have = new Set<string>(); for (let i = 0; i < todo0.length; i += 150) for (const r of await pg("youtube_reads?select=video_id&video_id=in.(" + todo0.slice(i, i + 150).map((v) => v.video_id).join(",") + ")")) have.add(r.video_id);
    const todo = todo0.filter((v) => !have.has(v.video_id)).slice(0, BATCH * BATCHES);
    if (!todo.length) return J({ candidates: todo0.length, new: 0 });
    // his names and what they are called, to spot them in a title or a chapter
    const fol: string[] = (await rpc("push_followed")).map((r: { ticker: string }) => r.ticker);
    const prof = await pg("company_profile?select=ticker,name&ticker=in.(" + fol.map(encodeURIComponent).join(",") + ")");
    const words: Array<[string, RegExp]> = [];
    for (const t of fol) if (/^[A-Z]{3,5}$/.test(t)) words.push([t, new RegExp("(^|[^A-Za-z$])\\$?" + t + "([^A-Za-z]|$)")]);
    for (const p of prof || []) { const n = String(p.name || "").replace(/(?:,\s*|\s+)(?:Inc\.?|Corp\.?|Corporation|Incorporated|plc|Ltd\.?|Limited|Holdings|Company|Co\.?|N\.V\.|S\.A\.|Technologies|Technology|Platforms|Group).*$/i, "").trim(); if (n.length >= 4) words.push([p.ticker, new RegExp("\\b" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i")]); }
    let wrote = 0, cards = 0; const rows: unknown[] = [], stream: unknown[] = [];
    for (let i = 0; i < todo.length; i += BATCH) {
      const part = todo.slice(i, i + BATCH);
      const r = await fetch("https://www.googleapis.com/youtube/v3/videos?part=snippet&maxResults=50&id=" + part.map((v) => v.video_id).join(",") + "&key=" + encodeURIComponent(KEY), { signal: AbortSignal.timeout(12000) });
      if (!r.ok) return J({ error: "youtube " + r.status, wrote });
      const items = new Map<string, string>(((await r.json()).items || []).map((it: { id: string; snippet?: { description?: string } }) => [it.id, it.snippet?.description || ""]));
      for (const v of part) {
        const desc = items.get(v.video_id) ?? "", ch = chaptersOf(desc), text = v.title + "\n" + ch.map((c) => c.title).join("\n");
        const names = [...new Set(words.filter(([, re]) => re.test(text)).map(([t]) => t))].slice(0, 8);
        const dur = v.duration_sec ? Math.floor(v.duration_sec / 60) + ":" + String(v.duration_sec % 60).padStart(2, "0") : null;
        rows.push({ video_id: v.video_id, channel: String(v.channel_title || "").trim(), channel_id: v.channel_id, title: v.title, published_at: v.published_at, duration: dur, tier: "light", takeaway: null, sections: ch.map((c) => ({ at: c.at, title: c.title, points: [] })), tickers: names.map((t) => ({ t, view: "", why: "mentioned in the title or a chapter", levels: "" })), calls: [], chapters: ch, description: plainDescription(desc) || null, worker: "none" }); wrote++;
        if (names.length && (v.subscription_accounts || []).some((a) => a === "scintilla" || a === "networks") && Date.now() - Date.parse(v.published_at) < CARD_WITHIN_H * 3600000) { stream.push({ level: 1, kind: "video", ticker: names.slice(0, 3).join(" · "), title: v.title.slice(0, 300), source: String(v.channel_title || "").trim().slice(0, 60), url: READ_PAGE + "?v=" + v.video_id, key: "video-light|" + v.video_id, event_at: v.published_at }); cards++; }
      }
    }
    if (rows.length) await pg("youtube_reads?on_conflict=video_id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(rows) });
    if (stream.length) await pg("notify_stream?on_conflict=key", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(stream) });
    return J({ candidates: todo0.length, wrote, cards });
  } catch (e) { return J({ error: String(e).slice(0, 400) }, 500); }
});

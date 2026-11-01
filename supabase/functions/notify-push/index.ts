// N2 (15 Oct 2026) — notify-push: sends one notification to every device that allowed them.
//
//   GET  ?mode=vapid                 → { publicKey }  (the application server key the page subscribes with; public by nature)
//   POST { title, body, url, key, kind }   with  Authorization: Bearer <service role key or scintilla_functions_key>
//        → sends that one message now, subject to the rules below; { sent, failed, declined, pruned }
//   POST ?mode=events                → asks the database for push_events_pending(), sends the NEWEST one (one a minute
//                                      is the rule, so one per call), logs it; { event, sent, … } or { event: null }
//   POST ?mode=test                  → "SCINTILLA · test" to every device, kind 'test', not de-duplicated
//   POST ?mode=stream                → 1 Nov: THE PHONE'S END OF THE SWITCHBOARD (public.notify_stream). Every minute: level 3 goes at once, level 2 goes outside the quiet window, at most
//                                      MAX_PER_RUN singly and the rest as one line; what waited overnight arrives as one line in the morning. Goes to every device that allowed Web Push (logo)
//                                      and, while the iPhone has not, to the ntfy app it already has (NTFY_TOPIC in this function's secrets, never printed).
//
// THE RULES (enforced here AND readable in SQL: push_can_send_now()):
//   · never more than one push a minute (push_log: a sent row in the last 60 s declines this one, logged as 'rate limit')
//   · quiet window 22:00–06:30 New York time, every day (logged as 'quiet window'; the event stays pending for the morning,
//     unless it is older than 8 h by then — push_events_pending() already drops transcripts older than 24 h and bursts of
//     other hours)
//   · one announcement per key, ever (push_log_key_sent_idx)
// SECRETS. VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT live in the function's environment (supabase secrets),
// never in the repository, never printed by this code. Deployed with --no-verify-jwt: this file checks the bearer itself,
// as grokbot-inbox does, so pg_cron and curl can call it with the functions key.
// WIRED 22 Oct 2026: pg_cron 'notify-push-events' calls ?mode=events every minute on weekdays with the Vault bearer
// (checked through public.push_cron_key_ok); the events follow Alan's lists (public.push_followed()).
import { sendPush } from "./webpush.mjs";

const SB = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FUNCTIONS_KEY = Deno.env.get("SCINTILLA_FUNCTIONS_KEY") || "";          // optional second bearer (the one pg_cron holds in Vault)
const VAPID = { publicKey: Deno.env.get("VAPID_PUBLIC_KEY") || "", privateKey: Deno.env.get("VAPID_PRIVATE_KEY") || "", subject: Deno.env.get("VAPID_SUBJECT") || "mailto:alan@scintillahub.ai" };
const H = { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "content-type": "application/json" };
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type, apikey", "access-control-allow-methods": "GET, POST, OPTIONS" };
const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", ...CORS } });

async function pg(path: string, init: RequestInit = {}) {
  const r = await fetch(SB + "/rest/v1/" + path, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const text = await r.text();
  if (!r.ok) throw new Error(path.split("?")[0] + " → " + r.status + " " + text.slice(0, 200));
  return text ? JSON.parse(text) : null;
}
const rpc = (fn: string, args: Record<string, unknown> = {}) => pg("rpc/" + fn, { method: "POST", body: JSON.stringify(args) });

/* 22 Oct (coordinator): pg_cron's bearer lives only in Vault ('scintilla_functions_key', made inside the database, never
   printed). Rather than hold a copy, the function asks the database whether a bearer is that key, and remembers a yes
   for ten minutes so the once-a-minute schedule costs one lookup in ten. */
let cronKeyYes: { b: string; until: number } | null = null;
async function authorized(req: Request) {
  const b = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!b) return false;
  if (b === SERVICE || (!!FUNCTIONS_KEY && b === FUNCTIONS_KEY)) return true;
  if (cronKeyYes && cronKeyYes.b === b && Date.now() < cronKeyYes.until) return true;
  try {
    if ((await rpc("push_cron_key_ok", { k: b })) === true) { cronKeyYes = { b, until: Date.now() + 600_000 }; return true; }
  } catch (_) { /* a failed lookup is a no */ }
  return false;
}

type Msg = { kind: string; key: string; title: string; body?: string; url?: string; at?: string };

/* ---- 1 Nov: the phone's end of the switchboard ---- */
const NTFY_TOPIC = Deno.env.get("NTFY_TOPIC") || "";
const MAX_PER_RUN = 8, STALE_H = 14;
type Row = { id: number; level: number; kind: string; ticker: string | null; title: string; body: string | null; source: string | null; url: string | null; pct: number | null; key: string };
const pctText = (v: number | null) => v == null ? "" : (v >= 0 ? "+" : "") + Number(v).toFixed(1) + "%";
/* the phone reads two lines: who and how much, then what */
function phoneLines(r: Row) {
  if (r.level >= 3 || !r.ticker && r.kind !== "macro" && r.kind !== "news" && r.kind !== "press") return { title: r.title, body: r.body || "" };
  const who = [r.ticker, pctText(r.pct), r.source].filter(Boolean).join(" · ");
  return { title: who || "SCINTILLA", body: r.title };
}
async function sendOne(subs: Array<{ endpoint: string; p256dh: string; auth: string; device: string | null; ua: string | null }>, useNtfy: boolean, m: { title: string; body: string; url: string; tag: string; level: number }) {
  let sent = 0, failed = 0; const errors: string[] = [];
  const payload = JSON.stringify({ title: m.title.slice(0, 120), body: m.body.slice(0, 300), url: m.url, tag: m.tag, at: new Date().toISOString() });
  for (const s of subs) {
    try {
      const r = await sendPush(s, payload, VAPID, { ttl: 3600, urgency: m.level >= 3 ? "high" : "normal", topic: null });
      const ep = "push_subscriptions?endpoint=eq." + encodeURIComponent(s.endpoint);
      if (r.status >= 200 && r.status < 300) { sent++; await pg(ep, { method: "PATCH", body: JSON.stringify({ last_ok_at: new Date().toISOString(), failures: 0, last_error: null }) }); }
      else if (r.status === 404 || r.status === 410) { await pg(ep, { method: "DELETE" }); }
      else { failed++; errors.push((s.device || "?") + " " + r.status); await pg(ep, { method: "PATCH", body: JSON.stringify({ last_error: r.status + " " + r.text.slice(0, 120), failures: 1 }) }); }
    } catch (e) { failed++; errors.push(String(e).slice(0, 60)); }
  }
  if (useNtfy && NTFY_TOPIC) {
    const r = await fetch("https://ntfy.sh/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ topic: NTFY_TOPIC, title: m.title.slice(0, 120), message: m.body.slice(0, 300) || " ", click: m.url || undefined, priority: m.level >= 3 ? 4 : 3, icon: "https://scintillahub.ai/icon-192.png" }), signal: AbortSignal.timeout(8000) }).catch((e) => ({ ok: false, status: String(e).slice(0, 50), text: async () => "" }));
    if (r.ok) sent++; else { failed++; errors.push("ntfy " + r.status); }
  }
  return { sent, failed, errors };
}
async function phoneFanOut() {
  const quiet = await rpc("push_quiet_now");
  const stale = new Date(Date.now() - STALE_H * 3600000).toISOString();
  await pg("notify_stream?phone_at=is.null&level=gte.2&at=lt." + encodeURIComponent(stale), { method: "PATCH", body: JSON.stringify({ phone_at: new Date().toISOString(), phone_sent: 0, phone_note: "too old" }) });
  const rows: Row[] = await pg("notify_stream?select=id,level,kind,ticker,title,body,source,url,pct,key&phone_at=is.null&level=gte.2&order=id.asc&limit=200");
  const go = quiet ? rows.filter((r) => r.level >= 3) : rows;
  if (!go.length) return { pending: rows.length, sent: 0, quiet };
  const subs = await pg("push_subscriptions?select=endpoint,p256dh,auth,device,ua");
  const iphoneOnWebPush = (subs || []).some((s: { ua: string | null; device: string | null }) => /iphone/i.test(String(s.ua || "") + String(s.device || "")));
  const useNtfy = !iphoneOnWebPush;
  // alerts first, then the newest headlines singly; the surplus rides one line
  const alerts = go.filter((r) => r.level >= 3), news = go.filter((r) => r.level < 3);
  const single = alerts.concat(news.slice(-Math.max(0, MAX_PER_RUN - alerts.length))), rest = news.filter((r) => !single.includes(r));
  let sent = 0, failed = 0; const errors: string[] = [];
  const done = async (ids: number[], n: number, note: string | null) => { if (ids.length) await pg("notify_stream?id=in.(" + ids.join(",") + ")", { method: "PATCH", body: JSON.stringify({ phone_at: new Date().toISOString(), phone_sent: n, phone_note: note }) }); };
  if (rest.length) {
    const tally = new Map<string, number>(); for (const r of rest) { const t = String(r.ticker || "market").split(" · ")[0]; tally.set(t, (tally.get(t) || 0) + 1); }
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t, n]) => n > 1 ? t + " " + n : t).join(" · ");
    const res = await sendOne(subs || [], useNtfy, { title: rest.length + " more headlines", body: top, url: "https://station.scintillahub.ai/notify/", tag: "digest|" + rest[rest.length - 1].id, level: 2 });
    sent += res.sent; failed += res.failed; errors.push(...res.errors);
    await done(rest.map((r) => r.id), res.sent, "in one line");
  }
  for (const r of single) {
    const { title, body } = phoneLines(r);
    const res = await sendOne(subs || [], useNtfy, { title, body, url: r.url || "https://station.scintillahub.ai/notify/", tag: r.key.slice(0, 60), level: r.level });
    sent += res.sent; failed += res.failed; errors.push(...res.errors);
    await done([r.id], res.sent, res.errors[0] || null);
  }
  /* the phone route failing must not be silent: one card on the Macs an hour (level 1: it does not try the failing route again) */
  if (errors.length) { const hour = new Date().toISOString().slice(0, 13); await pg("notify_stream?on_conflict=key", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify([{ level: 1, kind: "ops", title: "Phone alerts are failing", body: errors[0], source: "SCINTILLA", key: "ops|phone-route|" + hour }]) }).catch(() => {}); }
  return { pending: rows.length - go.length, single: single.length, rolled: rest.length, sent, failed, errors: errors.slice(0, 6), via: { webPush: (subs || []).length, ntfy: useNtfy && !!NTFY_TOPIC } };
}

/* one message to every subscription, with the log row written whatever happens */
async function deliver(m: Msg, { dedupe = true } = {}) {
  if (!VAPID.publicKey || !VAPID.privateKey) return { error: "VAPID keys are not set in this function's secrets" };
  const quiet = await rpc("push_quiet_now");
  const can = await rpc("push_can_send_now");
  const declined = quiet ? "quiet window" : !can ? "rate limit" : null;
  if (!declined && dedupe) {
    const dup = await pg("push_log?select=id&key=eq." + encodeURIComponent(m.key) + "&declined=is.null&limit=1");
    if (Array.isArray(dup) && dup.length) return { key: m.key, declined: "already announced", sent: 0, failed: 0 };
  }
  let sent = 0, failed = 0, pruned = 0; const errors: string[] = [];
  if (!declined) {
    const subs = await pg("push_subscriptions?select=endpoint,p256dh,auth,device");
    const payload = JSON.stringify({ title: m.title, body: m.body || "", url: m.url || "/", tag: m.key, at: m.at || new Date().toISOString() });
    for (const s of subs as Array<{ endpoint: string; p256dh: string; auth: string; device: string | null }>) {
      try {
        const r = await sendPush(s, payload, VAPID, { ttl: 3600, urgency: "high", topic: m.kind.slice(0, 32) });
        const ep = "push_subscriptions?endpoint=eq." + encodeURIComponent(s.endpoint);
        if (r.status >= 200 && r.status < 300) { sent++; await pg(ep, { method: "PATCH", body: JSON.stringify({ last_ok_at: new Date().toISOString(), failures: 0, last_error: null }) }); }
        else if (r.status === 404 || r.status === 410) { pruned++; await pg(ep, { method: "DELETE" }); }
        else { failed++; errors.push((s.device || "?") + ": " + r.status + " " + r.text.slice(0, 80)); await pg(ep, { method: "PATCH", body: JSON.stringify({ last_error: r.status + " " + r.text.slice(0, 120), failures: 1 }) }); }
      } catch (e) { failed++; errors.push((s.device || "?") + ": " + String(e).slice(0, 80)); }
    }
  }
  await pg("push_log", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ kind: m.kind, key: m.key, title: m.title, body: m.body || null, url: m.url || null, sent, failed, declined }) });
  return { key: m.key, declined, sent, failed, pruned, errors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("", { headers: CORS });
  const u = new URL(req.url), mode = u.searchParams.get("mode") || "";
  if (req.method === "GET" && mode === "vapid") return VAPID.publicKey ? J({ publicKey: VAPID.publicKey }) : J({ error: "VAPID keys are not set" }, 503);
  if (req.method !== "POST") return J({ error: "POST a message, or GET ?mode=vapid" }, 405);
  if (!(await authorized(req))) return J({ error: "unauthorized" }, 401);
  if (!SB || !SERVICE) return J({ error: "function environment incomplete" }, 500);
  try {
    if (mode === "stream") return J(await phoneFanOut());
    if (mode === "events") {
      /* 1 Nov: earnings prints and transcripts enter the switchboard, which carries them to every device */
      const pending = await rpc("push_events_pending");
      if (!Array.isArray(pending) || !pending.length) return J({ event: null, pending: 0 });
      const rows = (pending as Msg[]).map((m) => ({ level: m.kind === "actual" ? 3 : 2, kind: m.kind, ticker: (m.title.match(/^([A-Z.\-]{1,8}) reported/) || m.title.match(/for ([A-Z.\-]{1,8})$/) || [])[1] || null, title: m.title, body: m.body || null, source: "SCINTILLA", url: m.url || null, key: m.key, event_at: m.at || null }));
      const ins = await pg("notify_stream?on_conflict=key", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify(rows) });
      return J({ pending: pending.length, entered: Array.isArray(ins) ? ins.length : 0 });
    }
    if (mode === "test") {
      const body = await req.json().catch(() => ({}));
      const m: Msg = { kind: "test", key: "test|" + new Date().toISOString(), title: body.title || "SCINTILLA · test", body: body.body || "If you can read this, the route works.", url: body.url || "/preview/news/" };
      return J(await deliver(m, { dedupe: false }));
    }
    const b = await req.json().catch(() => null);
    if (!b || !b.title) return J({ error: "body needs at least { title }" }, 400);
    const m: Msg = { kind: String(b.kind || "manual"), key: String(b.key || "manual|" + new Date().toISOString()), title: String(b.title).slice(0, 120), body: b.body ? String(b.body).slice(0, 240) : "", url: b.url ? String(b.url) : "/" };
    return J(await deliver(m));
  } catch (e) {
    const msg = String(e);
    const missing = /push_subscriptions|push_log|push_events_pending|push_can_send_now|push_quiet_now/.test(msg) && /404|42P01|PGRST202|PGRST205/.test(msg);
    return J({ error: msg.slice(0, 300), hint: missing ? "apply supabase/migrations/20261015_push_subscriptions.sql first" : undefined }, 500);
  }
});

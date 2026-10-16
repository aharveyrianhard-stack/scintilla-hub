// N2 (15 Oct 2026) — notify-push: sends one notification to every device that allowed them.
//
//   GET  ?mode=vapid                 → { publicKey }  (the application server key the page subscribes with; public by nature)
//   POST { title, body, url, key, kind }   with  Authorization: Bearer <service role key or scintilla_functions_key>
//        → sends that one message now, subject to the rules below; { sent, failed, declined, pruned }
//   POST ?mode=events                → asks the database for push_events_pending(), sends the NEWEST one (one a minute
//                                      is the rule, so one per call), logs it; { event, sent, … } or { event: null }
//   POST ?mode=test                  → "SCINTILLA · test" to every device, kind 'test', not de-duplicated
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
// NOT WIRED. Nothing calls this on a schedule until the coordinator schedules it (two lines in N2-NEWS.html).
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

function authorized(req: Request) {
  const b = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return !!b && (b === SERVICE || (!!FUNCTIONS_KEY && b === FUNCTIONS_KEY));
}

type Msg = { kind: string; key: string; title: string; body?: string; url?: string; at?: string };

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
  if (!authorized(req)) return J({ error: "unauthorized" }, 401);
  if (!SB || !SERVICE) return J({ error: "function environment incomplete" }, 500);
  try {
    if (mode === "events") {
      const pending = await rpc("push_events_pending");
      if (!Array.isArray(pending) || !pending.length) return J({ event: null, pending: 0 });
      const m = pending[0] as Msg;
      return J({ event: m, pending: pending.length, ...(await deliver(m)) });
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

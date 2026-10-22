/* N2 (15 Oct 2026) — news you can read, notifications that reach Alan. Pure checks on the files; the push crypto is proved
   by deliverables/20261015/n2-news/tools/webpush-selftest.mjs (RFC 8291's own vector), run here without the npm round-trip. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const page = read("preview/news/index.html"), hub = read("index.html"), sw = read("push-sw.js");
const mig = read("supabase/migrations/20261015_push_subscriptions.sql"), rb = read("supabase/migrations/20261015_push_subscriptions_ROLLBACK.sql");
const fn = read("supabase/functions/notify-push/index.ts");

test("the news trial: the title is the unit — 22 px on the desktop, 18 px on the phone, two lines at most", () => {
  assert.match(page, /--ttl:22px/); assert.match(page, /@media \(max-width:500px\)\{[\s\S]*--ttl:18px/);
  assert.match(page, /\.art__ttl\{[^}]*-webkit-line-clamp:2/);
  assert.match(page, /\.art__meta\{[^}]*font-size:var\(--meta\)/); assert.match(page, /--meta:12\.5px/);
});
test("the news trial reads what the Hub reads, in the Hub's scopes, and groups by freshness", () => {
  for (const t of ["news?", "ticker_cohorts?select=ticker,cohort", "station_lists?select=list,position,ticker&list=in.(favorites,radar)", "hub_favorites?select=ticker"]) assert.ok(page.includes(t), t);
  assert.match(page, /\["RADAR", "FAVORITES", "LIKED"\]|LISTS = \{ RADAR: \[\], FAVORITES: \[\], LIKED: \[\] \}/);
  for (const g of ['["hour", "Last hour"]', '["today", "Today"]', '["yday", "Yesterday"]']) assert.ok(page.includes(g), g);
  assert.match(page, /href="\/#co=' \+ esc\(t\)/, "a ticker chip opens the company by address");
  assert.match(page, /What moved/);
  assert.match(page, /<!-- scnav ·[\s\S]*data-go="back"[\s\S]*data-go="close"/, "the BACK / CLOSE pair"); assert.ok(page.split("data-scnav-slot").length - 1 >= 2);
});
test("the Hub opens a company by address (/#co=NVDA) and leaves the /push/ worker alone when it clears stale workers", () => {
  assert.match(hub, /\/\^#co=\(\[A-Za-z0-9\.\\-\]\{1,12\}\)\$\//);
  assert.match(hub, /rs = rs\.filter\(function \(r\) \{ try \{ return !\/\\\/push\\\/\$\/\.test\(r\.scope\)/);
  const trial = read("preview/company-view/index.html");
  assert.ok(trial.includes("#co=") && trial.includes("/push/"), "the trial copy carries the same two changes (build-trial.py was run)");
});
test("the push worker shows what it is sent and opens the place it names; it controls no page and caches nothing", () => {
  assert.match(sw, /addEventListener\("push"/); assert.match(sw, /showNotification\(/); assert.match(sw, /notificationclick/);
  assert.doesNotMatch(sw, /addEventListener\("fetch"/); assert.doesNotMatch(sw, /caches\./);
  assert.match(page, /register\("\/push-sw\.js", \{ scope: "\/push\/" \}\)/);
});
test("the migration is additive, RLS is on, and the rollback (written first) drops exactly what the migration adds", () => {
  assert.match(mig, /create table if not exists public\.push_subscriptions/); assert.match(mig, /enable row level security/);
  assert.doesNotMatch(mig, /drop table|alter table public\.(news|earnings_events|earnings_transcript_watch)/);
  assert.doesNotMatch(mig, /cron\.schedule|create trigger/, "created only, not scheduled, not wired");
  assert.match(mig, /for insert to anon, authenticated/); assert.match(mig, /for delete to anon, authenticated/); assert.doesNotMatch(mig, /for select to anon/);
  for (const o of ["push_subscriptions", "push_log", "push_quiet_now", "push_can_send_now", "news_usual_per_hour", "news_bursts_now", "push_events_pending"]) assert.ok(rb.includes(o), "rollback drops " + o);
  assert.match(mig, /time '22:00'/); assert.match(mig, /time '06:30'/); assert.match(mig, /interval '60 seconds'/);
  assert.match(mig, /3 \* greatest\(u\.usual, 1\)/, "a burst is 3x usual, and usual is never below one an hour");
  assert.match(mig, /\/ 336/, "usual = the trailing 14 days' headlines per hour");
});
test("the function checks the bearer itself, serves only the public key without one, and keeps the private key in its environment", () => {
  assert.match(fn, /Deno\.env\.get\("VAPID_PRIVATE_KEY"\)/); assert.doesNotMatch(fn, /BEGIN (EC )?PRIVATE KEY|"VAPID_PRIVATE_KEY":\s*"[A-Za-z0-9_-]{40}/);
  /* 22 Oct (coordinator): the check became async — it also asks the database whether a bearer is pg_cron's Vault key
     (push_cron_key_ok), so the schedule needs no copy of a key; still no answer but the public key without a bearer. */
  assert.match(fn, /if \(!\(await authorized\(req\)\)\) return J\(\{ error: "unauthorized" \}, 401\)/);
  assert.match(fn, /rpc\("push_cron_key_ok", \{ k: b \}\)/);
  assert.match(fn, /mode === "vapid"/); assert.match(fn, /push_can_send_now/); assert.match(fn, /push_quiet_now/); assert.match(fn, /push_events_pending/);
  for (const f of ["push-sw.js", "preview/news/index.html", "supabase/functions/notify-push/index.ts", "supabase/functions/notify-push/webpush.mjs"]) assert.doesNotMatch(read(f), /[A-Za-z0-9_-]{43}\n?VAPID|VAPID_PRIVATE_KEY=/, f + " carries no key");
});
test("the push encryption reproduces RFC 8291's own worked example byte for byte", async () => {
  const wp = await import(path.join(ROOT, "supabase/functions/notify-push/webpush.mjs"));
  const b = wp.b64u;
  const sender = await wp.importP256Pair(b.dec("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8"), b.dec("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw"));
  const body = await wp.encryptForSubscription("When I grow up, I want to be a watermelon", { p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4", auth: "BTBZMqHH6r4Tts7J_aSIgg" }, sender, b.dec("DGv6ra1nlYgDCS1FRnbzlw"));
  assert.equal(b.enc(body), "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN");
  const h = await wp.vapidHeader("https://web.push.apple.com/abc", { publicKey: b.enc(sender.pub), privateKey: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw", subject: "mailto:x@example.invalid" }, 1792113000);
  assert.equal(h.claims.aud, "https://web.push.apple.com"); assert.equal(h.claims.exp - 1792113000, 12 * 3600);
});

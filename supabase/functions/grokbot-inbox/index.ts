// SCINTILLA · grokbot-inbox — the HTTPS inbox Grok Bot posts into (GB1, 5 Oct 2026).
//
// Alan, 5 Oct: "Grok Bot should live on its own computer but can be set up with some forwarding that we ingest."
// Grok Bot's computer POSTs JSON here; this function checks the token, the size and every item, and files what
// passes: X posts → x_posts, YouTube chunk scores → youtube_chunks, his X→YouTube map → x_youtube_channel_map,
// following lists → x_following, news scores → grokbot_news_scores. Every envelope is logged in grokbot_inbox
// (30 days) and pings the job_heartbeat row `grokbot:inbox`, so a silent Grok Bot shows as LATE.
// A GET with the same token answers what we last received per kind and the YouTube channels we follow.
//
// It never reaches out: it does not read X, YouTube or his computer. The rules are in ./core.mjs (tested under
// Node in tests/grokbot-inbox.test.mjs); this file only hands over the function's environment.
//
// SECRETS (function secrets, set by the coordinator — never in code, never printed):
//   GROKBOT_INBOX_TOKEN     the bearer token Grok Bot sends. Unset or shorter than 32 characters = the inbox is closed.
//   GROKBOT_TEXT_ALLOWED    "1" only once Alan has OK'd storing transcript text. Anything else: text is dropped.
//   GROKBOT_CHANNEL_ACCOUNTS  optional, comma list of our YouTube accounts whose subscriptions the GET lists
//                             (default "scintilla"; the bridge row is always listed).
// DEPLOY with --no-verify-jwt: Grok Bot's token is not a Supabase key, so the gateway must let the request
// through to this function, which does its own check.
// @ts-ignore  plain ESM shared with the Node tests
import { createHandler } from "./core.mjs";

Deno.serve(createHandler({
  url: Deno.env.get("SUPABASE_URL") || "",
  serviceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  token: Deno.env.get("GROKBOT_INBOX_TOKEN") || "",
  textAllowed: Deno.env.get("GROKBOT_TEXT_ALLOWED") === "1",
  channelAccounts: (Deno.env.get("GROKBOT_CHANNEL_ACCOUNTS") || "scintilla").split(",").map((s) => s.trim()).filter(Boolean),
}));

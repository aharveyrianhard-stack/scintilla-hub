/* ibkr-ingest — the only door the put/call reader may knock on.
   SCINTILLA-M50, 24 Sep 2026. WRITTEN, NOT DEPLOYED by this lane.

   It exists so that no service key ever sits on Alan's MacBook. The reader holds a write-only
   INGEST TOKEN in the Mac's Keychain; the service role lives here, in Supabase's own
   environment, where Supabase put it.

   It appends to exactly two tables and can do nothing else: no update, no delete, no price
   table, no table named by the caller.

   Deploy (the coordinator, not this lane):
     supabase secrets set IBKR_INGEST_TOKEN=<a new random string>
     supabase functions deploy ibkr-ingest
   Then put the SAME string in the Mac's Keychain:
     security add-generic-password -s scintilla-ibkr-ingest -a ingest -w <the string>
   The token is write-only: holding it lets a caller append readings and read nothing. */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ALLOWED_TABLES, parseBatch, tokenAccepted } from "./validate.mjs";
import { heartbeatDue, heartbeatArgs } from "./heartbeat.mjs";

/* R2, 5 Oct 2026 — THE LANDING REPORTS THAT IT HAPPENED.
   IB Gateway was logged out from Sun 4 Oct 04:39 ET to Mon 5 Oct 20:37 ET and the put/call counter
   landed nothing for a whole session. This door is the one place every reading passes, so it is where
   the "I ran" ping belongs: after each landing it calls job_heartbeat_ping for the row Q2b registered
   ('mac:com.scintilla.ibkr-putcall'). Silence then raises LATE on the jobs board and the phone message,
   and a landing that cannot be written raises FAILING. The ping can never fail a landing, never
   carries a reading or the token, and is sent at most once a minute per function instance (the
   counter lands a batch every few seconds). */
let lastBeatMs = 0;
async function beat(db: any, ok: boolean, cause: string | null, detail: string | null) {
  const nowMs = Date.now();
  if (!heartbeatDue(lastBeatMs, nowMs, ok)) return "skipped";
  lastBeatMs = nowMs;
  try {
    const { error } = await db.rpc("job_heartbeat_ping", heartbeatArgs(ok, cause, detail));
    return error ? "failed" : "sent";
  } catch { return "failed"; }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST_ONLY" }, 405);

  /* The token never appears in a log line, an error body or a metric. */
  const auth = tokenAccepted(req.headers.get("authorization"), Deno.env.get("IBKR_INGEST_TOKEN"));
  if (!auth.ok) return json({ error: auth.reason }, auth.reason === "NO_TOKEN_CONFIGURED" ? 503 : 401);

  const kind = new URL(req.url).searchParams.get("kind") ?? "snapshots";
  const parsed = parseBatch(await req.text(), kind);
  if (!parsed.ok) return json(parsed, 400);
  if (!parsed.rows.length) return json({ accepted: 0, rejected: parsed.rejected }, 400);

  /* Supabase puts these in the function's environment itself. Nothing is copied from a Mac. */
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "FUNCTION_NOT_CONFIGURED" }, 503);

  const db = createClient(url, key, { auth: { persistSession: false } });
  const table = parsed.table;
  if (table !== ALLOWED_TABLES.snapshots && table !== ALLOWED_TABLES.minutes)
    return json({ error: "TABLE_NOT_ALLOWED" }, 400);

  /* APPEND ONLY, and idempotent: the reader re-sends a spool file after a network failure, and
     a repeated (ticker, ts) or (scope, label, ts) must change nothing. ignoreDuplicates keeps
     the first reading rather than overwriting it with a later copy of itself. */
  const rows = parsed.rows.map((r: Record<string, unknown>) =>
    table === ALLOWED_TABLES.snapshots
      ? { ticker: String(r.symbol).toUpperCase(), ts: new Date(Number(r.ts)).toISOString(),
          session_et: r.session, call_vol: r.call_vol ?? null, put_vol: r.put_vol ?? null,
          call_oi: r.call_oi ?? null, put_oi: r.put_oi ?? null, conid: r.conid ?? null,
          source: "IBKR" }
      : { scope: r.scope, label: r.label,
          ts: typeof r.ts === "string" ? r.ts : new Date(Number(r.ts)).toISOString(),
          session_et: r.session_et, put_vol: r.put_vol ?? null, call_vol: r.call_vol ?? null,
          put_call: r.put_call ?? null, put_call_absent: r.put_call_absent ?? null,
          measured: r.measured, of_members: r.of_members, max_age_ms: r.max_age_ms ?? null,
          source: "IBKR", formula_version: r.formula_version ?? "pc-1.0.0" });

  const onConflict = table === ALLOWED_TABLES.snapshots ? "ticker,ts" : "scope,label,ts";
  const { error } = await db.from(table).upsert(rows, { onConflict, ignoreDuplicates: true });
  if (error) {
    const heartbeat = await beat(db, false, "WRITE_FAILED", `${table}: ${error.message}`);
    return json({ error: "WRITE_FAILED", detail: error.message, heartbeat }, 500);
  }

  const heartbeat = await beat(db, true, "OK", null);
  return json({ accepted: rows.length, rejected: parsed.rejected, table, heartbeat });
});

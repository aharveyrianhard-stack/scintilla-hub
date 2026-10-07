/* THE LANDING'S HEARTBEAT (R2, 5 Oct 2026). Its own file with no imports, like validate.mjs, so the edge
   function and the offline tests use the SAME rules. */

/** The row Q2b registered on 3 Oct for the MacBook's put/call counter. */
export const HEARTBEAT_JOB = "mac:com.scintilla.ibkr-putcall";

/** At most one success ping a minute per function instance; a failure is always reported. */
export const HEARTBEAT_MIN_GAP_MS = 60 * 1000;
export function heartbeatDue(lastMs, nowMs, ok) {
  if (!ok) return true;
  return !(Number.isFinite(lastMs) && lastMs > 0 && nowMs - lastMs < HEARTBEAT_MIN_GAP_MS);
}

/** What goes to job_heartbeat_ping. Never a reading, never the token: a job name, a yes/no, a short cause. */
export function heartbeatArgs(ok, cause, detail) {
  const clean = detail == null ? null
    : String(detail).replace(/eyJ[A-Za-z0-9._-]{20,}/g, "***").replace(/Bearer\s+\S+/gi, "Bearer ***").slice(0, 300);
  return { p_job: HEARTBEAT_JOB, p_ok: Boolean(ok), p_cause: cause == null ? null : String(cause).slice(0, 80), p_detail: clean };
}

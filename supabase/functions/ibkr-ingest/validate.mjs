/* WHAT THE INGEST FUNCTION IS ALLOWED TO ACCEPT.
   Kept as its own file with no imports so the edge function and the offline tests check the
   SAME rules. If these two ever drift, the door and the lock stop matching.

   The rule this file exists to enforce: the reader may append put/call readings and nothing
   else. It cannot reach a price table, it cannot update or delete, and it cannot invent a
   table name. */

export const ALLOWED_TABLES = Object.freeze({
  snapshots: "ibkr_option_volume",
  minutes: "ibkr_putcall_minute",
});

export const MAX_ROWS = 5000;           // one sweep of 1,000 names is 1,000 rows
export const MAX_BYTES = 2 * 1024 * 1024;

const isSession = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const optNum = (v) => v === null || v === undefined || (typeof v === "number" && Number.isFinite(v) && v >= 0);

/** A reader snapshot: one underlying, one moment, cumulative day totals. */
export function validateSnapshot(row) {
  if (!row || typeof row !== "object") return "NOT_AN_OBJECT";
  if (typeof row.symbol !== "string" || !row.symbol.trim()) return "NO_SYMBOL";
  if (!Number.isFinite(Number(row.ts))) return "NO_TIMESTAMP";
  if (!isSession(row.session)) return "NO_SESSION_DATE";
  for (const f of ["call_vol", "put_vol", "call_oi", "put_oi"]) {
    if (!optNum(row[f])) return `BAD_${f.toUpperCase()}`;
  }
  if (row.call_vol == null && row.put_vol == null && row.call_oi == null && row.put_oi == null)
    return "EMPTY_READING";
  return null;
}

/** A computed minute aggregate. put_call may be null; it may never be a zero standing in for one. */
export function validateMinute(row) {
  if (!row || typeof row !== "object") return "NOT_AN_OBJECT";
  if (typeof row.scope !== "string" || !row.scope.trim()) return "NO_SCOPE";
  if (typeof row.label !== "string" || !row.label.trim()) return "NO_LABEL";
  if (!isSession(row.session_et)) return "NO_SESSION_DATE";
  if (!Number.isFinite(Number(row.ts)) && typeof row.ts !== "string") return "NO_TIMESTAMP";
  if (!Number.isInteger(row.measured) || !Number.isInteger(row.of_members)) return "NO_COVERAGE";
  if (row.measured > row.of_members) return "MEASURED_ABOVE_MEMBERS";
  if (row.put_call != null && !(typeof row.put_call === "number" && Number.isFinite(row.put_call) && row.put_call >= 0))
    return "BAD_PUT_CALL";
  if (row.put_call == null && !row.put_call_absent) return "ABSENT_RATIO_WITHOUT_A_REASON";
  return null;
}

/** NDJSON in, rows and named refusals out. Nothing is silently dropped. */
export function parseBatch(text, kind) {
  const table = ALLOWED_TABLES[kind];
  if (!table) return { ok: false, error: "UNKNOWN_KIND", kinds: Object.keys(ALLOWED_TABLES) };
  if (typeof text !== "string" || !text.trim()) return { ok: false, error: "EMPTY_BODY" };
  if (text.length > MAX_BYTES) return { ok: false, error: "BODY_TOO_LARGE", max_bytes: MAX_BYTES };
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length > MAX_ROWS) return { ok: false, error: "TOO_MANY_ROWS", max_rows: MAX_ROWS };
  const check = kind === "snapshots" ? validateSnapshot : validateMinute;
  const rows = [], rejected = [];
  lines.forEach((line, i) => {
    let row;
    try { row = JSON.parse(line); } catch { rejected.push({ line: i + 1, reason: "NOT_JSON" }); return; }
    const bad = check(row);
    if (bad) { rejected.push({ line: i + 1, reason: bad, symbol: row?.symbol ?? row?.label ?? null }); return; }
    rows.push(row);
  });
  return { ok: true, table, rows, rejected, of_lines: lines.length };
}

/** Bearer check that does not leak the token through a length or an early exit. */
export function tokenAccepted(header, expected) {
  if (!expected) return { ok: false, reason: "NO_TOKEN_CONFIGURED" };
  const given = String(header || "").replace(/^Bearer\s+/i, "");
  if (!given) return { ok: false, reason: "NO_TOKEN_PRESENTED" };
  const a = new TextEncoder().encode(given), b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0 ? { ok: true } : { ok: false, reason: "TOKEN_REJECTED" };
}

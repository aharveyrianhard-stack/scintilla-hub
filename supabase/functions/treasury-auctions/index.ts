// SCINTILLA · treasury-auctions v1 — Treasury note and bond auctions, announced and auctioned (HM2, 7 Oct 2026).
//
// Alan, 7 Oct: "There's a 10-year note auction … should we be tracking that? … how much they fill or what? What
// information do we get … or do we just get that the event exists?" The economic calendar only says the event exists.
// TreasuryDirect's own web service (free, no key) says what was offered and, about three minutes after the 13:00 ET
// deadline, how it went: the stop (high yield), bid-to-cover, and who took it (indirect / direct / dealers).
//
// One run: read notes and bonds whose auction date is inside the window → auctions.mjs keeps the seven nominal coupon
// terms and shapes each row → upsert public.treasury_auctions by (cusip, auction_date). Nothing else is written.
//   POST /treasury-auctions            the last 45 days and the next 45 (announcements carry a future auction date)
//   POST /treasury-auctions?days=10    a narrower window (the 13:00-13:55 ET results runs)
//   POST /treasury-auctions?from=2018-01-01   a first fill
//   …&dry=1                            reads and maps, writes nothing
// No key is used or needed for the source. The service role is this function's own environment.

import { auctionRows, searchUrl, SOURCE } from "./auctions.mjs";

const SB = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const VERSION = "treasury-auctions-v1";
const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const iso = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST" && req.method !== "GET") return J({ error: "POST_ONLY" }, 405);
  if (!SB || !SERVICE) return J({ error: "FUNCTION_NOT_CONFIGURED" }, 503);
  const q = new URL(req.url).searchParams;
  const days = Math.min(Math.max(Number(q.get("days") ?? 45) || 45, 1), 400);
  const now = Date.now();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(q.get("from") ?? "") ? String(q.get("from")) : iso(new Date(now - days * 86400e3));
  const to = iso(new Date(now + 45 * 86400e3));
  const read: any[] = [], failed: string[] = [];
  for (const type of ["Note", "Bond"]) {
    try {
      const r = await fetch(searchUrl(type, from, to), { headers: { "User-Agent": "ScintillaHub research research@scintillahub.ai" }, signal: AbortSignal.timeout(25000) });
      if (!r.ok) { failed.push(type + " HTTP " + r.status); continue; }
      const list = await r.json();
      if (Array.isArray(list)) read.push(...list); else failed.push(type + " not a list");
    } catch (e) { failed.push(type + " " + String((e as Error).message).slice(0, 80)); }
  }
  const rows = auctionRows(read).map((r: any) => ({ ...r, fetched_at: new Date().toISOString() }));
  const out = { ok: failed.length === 0, version: VERSION, source: SOURCE, window: { from, to }, read: read.length, rows: rows.length,
    announced: rows.filter((r: any) => r.status === "announced").length, failed, wrote: 0 };
  /* a source that answered nothing is a failure to say out loud, never an empty success */
  if (!rows.length) return J({ ...out, ok: false, error: failed.length ? "SOURCE_UNREADABLE" : "NO_ROWS_IN_WINDOW" }, failed.length ? 502 : 200);
  if (q.get("dry") === "1") return J(out);
  const w = await fetch(`${SB}/rest/v1/treasury_auctions?on_conflict=cusip,auction_date`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!w.ok) return J({ ...out, ok: false, error: "WRITE_FAILED", detail: (await w.text()).slice(0, 200) }, 500);
  out.wrote = rows.length;
  return J(out, out.ok ? 200 : 207);
});

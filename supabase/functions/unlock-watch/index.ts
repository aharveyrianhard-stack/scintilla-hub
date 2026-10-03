// SCINTILLA · unlock-watch v1 — IPO lock-up expiry for the stocks the Hub serves (R2 Part B, 2 Oct 2026).
//
// Alan, 2 Oct: "Can we get pre-IPO unlock dates from FMP, Massive or somewhere else?" R1 (deliverables/20261002/
// research-sources) measured that neither provider carries a lock-up date: the term lives only in the prospectus, which the
// SEC serves free. One run:
//   1. the universe — public.cohorts (the names the board and the EARNINGS band track) without funds, indexes, futures,
//      rates and crypto (public.tickers.type, company_profile.is_etf, a ticker ending in USD);
//   2. candidates — FMP /stable/ipos-calendar MONTH BY MONTH for the trailing 18 months (one 12-month call silently returns
//      only the newest ~380 rows) ∩ the universe, plus every universe stock whose stored FMP profile ipoDate
//      (company_profile.ipo_date) is inside the same 18 months;
//   3. per candidate — FMP /stable/profile (listing date, CIK) and /stable/sec-filings-search/symbol around the listing →
//      the 424B4 (else 424B1; a SPAC's merger 424B3; else the S-1) → ONE streamed SEC read of that document that stops once
//      the lock-up section has been read → lib.ts reads the day count, the sentence, any early-release trigger and the
//      prospectus's own "Earliest Date Available for Sale" table;
//   4. public.ipo_lockups — upsert by ticker. Nothing else is written; no other table is touched.
//
// Modes:  POST /unlock-watch?mode=backfill   the whole scan, every candidate read again (also ?months=18,
//                                            ?tickers=A,B to check named listings, ?dry=1 to write nothing)
//         POST /unlock-watch?mode=pass       nightly: the same scan; an SEC read only for a name with no row, a row without a
//                                            prospectus basis, or a row older than 7 days (?tickers=A&force=1 reads the named
//                                            names again even when their row is fresh — C1, to add SharonAI's sponsor step)
// C1 (2 Oct, night): a former SPAC's sponsor lock-up (lib.ts sponsorLockup) is kept as one more schedule row
// { sponsor: true, date, clause, price_rule } — no new column.
// Keys: the FMP key is read from public.app_config with this function's service role (the fmp-analyst pattern) and is never
// printed, logged or returned. SEC needs no key: a User-Agent, at most 4 requests a second.

import * as L from "./lib.ts";

const SB = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const VERSION = "unlock-watch-v2";   // v2 (C1, 2 Oct night): a former SPAC sponsor's founder-share lock-up joins the schedule
const SEC_UA = { "User-Agent": "ScintillaHub research research@scintillahub.ai" };
const SEC_MAX_BYTES = 16_000_000;          // a 12 MB prospectus (SpaceX) is the largest seen; past this the read stops regardless
const sbH = { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "Content-Type": "application/json" };
const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const todayNY = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

async function sbGet(path: string): Promise<any[]> {
  const r = await fetch(`${SB}/rest/v1/${path}`, { headers: sbH });
  if (!r.ok) throw new Error("DB_" + r.status + " " + path.split("?")[0]);
  return await r.json();
}
async function fmpKey(): Promise<string> {
  const rows = await sbGet("app_config?select=key,value&key=eq.FMP_KEY");
  const k = String(rows?.[0]?.value || "").trim();
  if (!k) throw new Error("no FMP_KEY in app_config");
  return k;
}
const calls = { fmp: 0, sec: 0, sec_bytes: 0 };
/** one FMP /stable/ call; the key rides only in the request, never in a message */
async function fmp(path: string, params: Record<string, string | number>, K: string): Promise<any[] | null> {
  const u = new URL("https://financialmodelingprep.com/stable/" + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  u.searchParams.set("apikey", K);
  calls.fmp++;
  try {
    const r = await fetch(u, { headers: { "User-Agent": "scintilla-unlock-watch/1.0" } });
    await sleep(120);
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j : null;
  } catch (_) { return null; }
}

/** the universe: cohorts without funds, indexes, futures, rates and crypto */
async function universe() {
  const [co, tk, pr] = await Promise.all([
    sbGet("cohorts?select=ticker&limit=5000"),
    sbGet("tickers?select=ticker,type&limit=5000"),
    sbGet("company_profile?select=ticker,is_etf,ipo_date,cik,name&limit=5000"),
  ]);
  const type = new Map(tk.map((r: any) => [r.ticker, r.type]));
  const prof = new Map(pr.map((r: any) => [r.ticker, r]));
  const set = new Set<string>();
  for (const r of co) {
    const t = String(r.ticker || "");
    if (!t || /USD$/.test(t) || ["etf", "index", "rate", "future", "crypto"].includes(String(type.get(t) || ""))) continue;
    if ((prof.get(t) as any)?.is_etf === true) continue;
    set.add(t);
  }
  return { set, prof, cohorts: new Set(co.map((r: any) => r.ticker)).size };
}

let lastSec = 0;
/** ONE streamed read of an SEC document. Each piece is turned into plain text as it arrives (cut at the last whole tag, so
    no tag is split) and the HTML is dropped — the text is about a tenth of the bytes. The read stops once the lock-up
    section has been read and a day count found: the "Earliest Date Available for Sale" table plus 20,000 characters, or
    the UNDERWRITING section's lock-up paragraph plus 10,000 — else at the end of the document (16 MB cap). */
async function secLockup(url: string, todayIso: string) {
  const wait = 260 - (Date.now() - lastSec); if (wait > 0) await sleep(wait);       // ≤ 4 requests a second
  lastSec = Date.now(); calls.sec++;
  let r = await fetch(url, { headers: SEC_UA });
  if (r.status === 429) {                       // the SEC is pacing this address: wait as it asks (at most 10 s), then ONE more try
    const ra = Math.min(10, Math.max(2, Number(r.headers.get("retry-after")) || 5));
    try { await r.body?.cancel(); } catch (_) { /* nothing to drain */ }
    await sleep(ra * 1000); lastSec = Date.now(); calls.sec++;
    r = await fetch(url, { headers: SEC_UA });
  }
  if (!r.ok || !r.body) return { status: r.status, bytes: 0, complete: false, stoppedEarly: false, lk: null as L.Lockup | null };
  const out = await L.lockupFromStream(r.body.getReader(), todayIso, SEC_MAX_BYTES);
  calls.sec_bytes += out.bytes;
  return { status: r.status, ...out };
}

type Cand = { ticker: string; calendarIso: string | null; profileIpoIso: string | null; via: string[] };

async function run(req: Request) {
  const u = new URL(req.url);
  const mode = (u.searchParams.get("mode") || "pass").toLowerCase();
  if (!["pass", "backfill"].includes(mode)) return J({ error: "mode must be pass or backfill" }, 400);
  const months = Math.max(1, Math.min(36, Number(u.searchParams.get("months") || 18)));
  const dry = u.searchParams.get("dry") === "1";
  const only = (u.searchParams.get("tickers") || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const force = only.length > 0 && u.searchParams.get("force") === "1";
  const today = todayNY(), since = L.addMonths(today, -months);
  const K = await fmpKey();
  const uni = await universe();
  const problems: { ticker?: string; step: string; reason: string }[] = [];

  // 2 · candidates
  const cands = new Map<string, Cand>();
  const add = (t: string, via: string, cal: string | null, prof: string | null) => {
    const c = cands.get(t) || { ticker: t, calendarIso: null, profileIpoIso: null, via: [] };
    if (cal && (!c.calendarIso || cal > c.calendarIso)) c.calendarIso = cal;
    if (prof) c.profileIpoIso = prof;
    if (!c.via.includes(via)) c.via.push(via);
    cands.set(t, c);
  };
  let calRows = 0, calMonths = 0;
  // C1: the calendar is read for named tickers too — without it a named former SPAC (SharonAI) was anchored on its merger
  // date, read the merger 424B3 instead of its IPO 424B4, and overwrote its row (2 Oct, 23:0x ET; restored by the re-run)
  for (const [from, to] of L.monthWindows(today, months)) {
    const rows = await fmp("ipos-calendar", { from, to }, K);
    if (rows == null) { problems.push({ step: "ipos-calendar " + from, reason: "no answer" }); continue; }
    calMonths++; calRows += rows.length;
    for (const r of rows) {
      const t = String(r.symbol || "").toUpperCase(), d = String(r.date || "").slice(0, 10);
      if ((!only.length || only.includes(t)) && uni.set.has(t) && d && d <= today && d >= since && !/expected|postponed|withdrawn/i.test(String(r.actions || ""))) add(t, "calendar", d, null);
    }
  }
  if (!only.length) {
    for (const t of uni.set) {
      const d = String((uni.prof.get(t) as any)?.ipo_date || "").slice(0, 10);
      if (d && d >= since && d <= today) add(t, "profile", null, d);
    }
  } else for (const t of only) add(t, "named", null, String((uni.prof.get(t) as any)?.ipo_date || "").slice(0, 10) || null);

  // what is stored already (pass mode skips a fresh prospectus row)
  const stored = new Map<string, any>();
  try { for (const r of await sbGet("ipo_lockups?select=ticker,basis,checked_utc,listing_kind&limit=5000")) stored.set(r.ticker, r); }
  catch (e) { problems.push({ step: "read ipo_lockups", reason: String(e).slice(0, 120) }); }

  // 3 · per candidate
  const rows: any[] = [], report: any[] = [];
  for (const c of [...cands.values()].sort((a, b) => a.ticker.localeCompare(b.ticker))) {
    const prev = stored.get(c.ticker);
    if (mode === "pass" && !force && prev && (prev.basis === "PROSPECTUS" || ["RELISTING", "DIRECT_LISTING", "SPINOFF"].includes(prev.listing_kind)) &&
        Date.now() - Date.parse(prev.checked_utc) < 7 * 86400e3) { report.push({ ticker: c.ticker, skipped: "fresh row" }); continue; }
    try {
      const pr = (await fmp("profile", { symbol: c.ticker }, K))?.[0] || null;
      const profIpo = String(pr?.ipoDate || c.profileIpoIso || "").slice(0, 10) || null;
      const listing = c.calendarIso || profIpo;
      if (!listing) { problems.push({ ticker: c.ticker, step: "listing date", reason: "no calendar or profile date" }); continue; }
      const fil = (await fmp("sec-filings-search/symbol", { symbol: c.ticker, from: L.addDays(listing, -240), to: L.addDays(listing, 30), page: 0, limit: 1000 }, K)) || [];
      const pick = L.pickProspectus(fil, listing);
      const form10 = fil.some((r: any) => /^10-12[BG]/i.test(String(r.formType || "")));
      let older = false;
      if (!pick || pick.kind === "UNKNOWN") {
        const old = (await fmp("sec-filings-search/symbol", { symbol: c.ticker, from: L.addDays(listing, -1200), to: L.addDays(listing, -400), page: 0, limit: 200 }, K)) || [];
        older = old.some((r: any) => /^(10-K|20-F|10-Q|40-F)/i.test(String(r.formType || "")));
      }
      let sec: Awaited<ReturnType<typeof secLockup>> | null = null;
      if (pick) sec = await secLockup(pick.url, today);
      // a read the SEC refused (429 on 2 Oct) or that came back empty decides nothing: the stored row is kept as it is
      if (pick && (!sec || sec.status !== 200 || !sec.bytes)) {
        problems.push({ ticker: c.ticker, step: "SEC read", reason: "HTTP " + (sec ? sec.status : "none") + " — nothing written, the stored row is kept" });
        continue;
      }
      const lk = sec?.lk || null;
      const kind = L.classifyListing({ calendarIso: c.calendarIso, profileIpoIso: profIpo, prospectusKind: pick?.kind || null,
        directListing: !!lk?.direct_listing, olderAnnualReport: older, form10 });
      if (kind === "IPO" && !pick) { problems.push({ ticker: c.ticker, step: "prospectus", reason: "no 424B4/424B1/S-1 near " + listing + " — not written" }); continue; }
      // the clock: an IPO counts from the prospectus date on its cover; a SPAC from the merger's closing (≈ its first day as
      // this ticker); without a cover date, from the listing date
      const anchor = kind === "SPAC" ? (profIpo || listing) : (lk?.prospectus_date || listing);
      const un = L.unlockFrom(kind, anchor, lk || { days: null, months: null });
      if (prev && prev.basis === "PROSPECTUS" && un.basis === "ASSUMED_180") {      // never trade a read clause for an assumption
        problems.push({ ticker: c.ticker, step: "lock-up clause", reason: "not found this time — the stored prospectus row is kept" });
        continue;
      }
      const row = {
        ticker: c.ticker, company: pr?.companyName || (uni.prof.get(c.ticker) as any)?.name || null, listing_kind: kind,
        ipo_date: listing, lockup_days: un.lockup_days, unlock_date: un.unlock_date, basis: un.basis,
        early_release: lk?.early_release || null, source_url: pick?.url || null, checked_utc: new Date().toISOString(),
        prospectus_date: kind === "SPAC" ? null : (lk?.prospectus_date || null), clause: lk?.clause || null,
        early_rule: kind === "IPO" || kind === "SPAC" ? (lk?.early_rule || null) : null,
        schedule: (lk?.schedule?.length || lk?.sponsor) ? [...(lk?.schedule || []), ...(lk?.sponsor ? [lk.sponsor] : [])] : null, source_form: pick?.form || null,
      };
      rows.push(row);
      report.push({ ticker: c.ticker, via: c.via, kind, listing, form: pick?.form || null, filed: pick?.date || null,
        sec: sec ? { status: sec.status, bytes: sec.bytes, stopped_early: sec.stoppedEarly } : null,
        prospectus_date: row.prospectus_date, days: un.lockup_days, unlock: un.unlock_date, basis: un.basis,
        early_rule: row.early_rule, steps: row.schedule ? row.schedule.length : 0, sponsor: lk?.sponsor ? { date: lk.sponsor.date, price_rule: lk.sponsor.price_rule } : null });
    } catch (e) { problems.push({ ticker: c.ticker, step: "candidate", reason: String((e as Error)?.message || e).slice(0, 160) }); }
  }

  // 4 · write
  let written = 0;
  if (!dry && rows.length) {
    const r = await fetch(`${SB}/rest/v1/ipo_lockups?on_conflict=ticker`, { method: "POST",
      headers: { ...sbH, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
    if (!r.ok) problems.push({ step: "upsert ipo_lockups", reason: "HTTP_" + r.status + " " + (await r.text()).slice(0, 200) });
    else written = rows.length;
  }
  return J({ version: VERSION, mode, dry, today, window_from: since,
    universe: { source: "public.cohorts minus funds/indexes/futures/rates/crypto", cohorts: uni.cohorts, stocks: uni.set.size },
    calendar: { months: calMonths, rows: calRows }, candidates: cands.size, written, calls, report, problems });
}

Deno.serve(async (req) => {
  try { return await run(req); }
  catch (e) { return J({ version: VERSION, error: String((e as Error)?.message || e).slice(0, 300) }, 500); }
});

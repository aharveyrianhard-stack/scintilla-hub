// SCINTILLA · offering-watch v2 — the OFFERING alert's nightly job (R2 Part A, 2 Oct 2026; C1 news step, 2 Oct night).
//
// Alan, 2 Oct (pasted notes): "dilution announcements". R1 found the signal (RESEARCH-SOURCES.html §02): CoreWeave filed
// for up to 35,000,000 new shares on 17 Sep and the Hub showed nothing. Per New York day this job asks FMP for every
// 424B5 / 424B4 / S-3 / S-3ASR / S-1 filed that day (daily windows: the whole market hits FMP's 1,000-row cap in a
// month), keeps the stocks the Hub serves, reads the first ~60 KB of each NEW filing from the SEC (free, one streamed
// read that stops at the limit), sorts it with classify.mjs, and upserts public.offering_filings.
//
// Modes:  POST /offering-watch?mode=backfill&from=YYYY-MM-DD&to=YYYY-MM-DD   history; writes NO alert_log rows.
//                                                                           Stops near its time budget and answers
//                                                                           next_from — call again from there.
//         POST /offering-watch?mode=pass                                     the previous weekday + today (New York).
//                                                                           Writes NO alert_log rows: Alan, 2 Oct —
//                                                                           "before alerts, things need to have a home
//                                                                           on hub … when it has a home, it can feed
//                                                                           alerts." The home is the company view's
//                                                                           CAPITAL & DILUTION block; the alert path was
//                                                                           removed (classify.mjs keeps the severity map
//                                                                           and the message builder, not called yet).
//         &reclassify=1 (backfill only)                                     re-read stored filings and update their class
//         &news_days=N (pass only, 1-30, default 2)                         C1 · THE NEWS STEP (every pass): headlines of the
//                                                                           last N days in public.news (news-feed, cron 6:
//                                                                           FMP press releases, Google News, investing.com)
//                                                                           for Hub stocks that name an offering and a
//                                                                           security or amount (classify.mjs newsKind) are kept
//                                                                           in public.offering_news, then every headline not yet
//                                                                           joined (last N+10 days) is joined to its filing
//                                                                           (joinFiling). Alan: "If Massive news has the press
//                                                                           release a day earlier — why would we design this on
//                                                                           a source that is slower?" Massive's own news is NOT
//                                                                           in public.news and no Massive key is in app_config,
//                                                                           so this step reads only what we already store.
//
// The FMP key is read from public.app_config with the service-role client, the way fmp-analyst reads it. It is never
// logged, returned or put in an error message (FMP errors carry the route and the status only).
// SEC: "ScintillaHub research research@scintillahub.ai", at most 4 requests a second.
// THE SEC WALL (measured 2 Oct 2026, 21:2x ET): from the default region (us-east-1) the SEC answered 429 "Request Rate
// Threshold Exceeded" to this function's FIRST two reads — the shared edge addresses are over the SEC's per-address limit
// from other tenants' traffic. From us-west-2 the same reads answered 200. Call this function with the header
// x-region: us-west-2. On a 429/403 the run stops reading at once, writes nothing for the refused filings, and answers
// sec_refused + next_from; the next run reads them (a filing is only stored once it has been read).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { FORMS, HEAD_BYTES, HEAD_BYTES_MAX, HEAD_CHARS, NEWS_DAYS, VERSION, classify, cleanHtml, filingFromFmp, joinFiling,
  newsFromRow, passDays, weekdays } from "./classify.mjs";

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SEC_UA = "ScintillaHub research research@scintillahub.ai";
const SEC_GAP_MS = 260;                 // ≤ 4 SEC requests a second
const DEFAULT_BUDGET_MS = 60_000;       // stop starting new days after this; the caller continues from next_from.
                                        // (2 Oct: one 120-day call with re-reads came back 502 — keep calls short)

const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fmpForm(form: string, day: string, key: string, out: any): Promise<any[]> {
  const rows: any[] = [];
  for (let page = 0; page < 4; page++) {
    const u = new URL("https://financialmodelingprep.com/stable/sec-filings-search/form-type");
    u.searchParams.set("formType", form); u.searchParams.set("from", day); u.searchParams.set("to", day);
    u.searchParams.set("page", String(page)); u.searchParams.set("limit", "1000");
    u.searchParams.set("apikey", key);
    out.fmp_calls++;
    let r: Response;
    try { r = await fetch(u, { signal: AbortSignal.timeout(30_000) }); }
    catch (_) { out.errors.push(`FMP ${form} ${day}: network`); return rows; }        // never the URL (it carries the key)
    if (!r.ok) { out.errors.push(`FMP ${form} ${day}: HTTP ${r.status}`); try { await r.body?.cancel(); } catch (_) {} return rows; }
    let j: any = null; try { j = await r.json(); } catch (_) { j = null; }
    if (!Array.isArray(j)) { out.errors.push(`FMP ${form} ${day}: not a list`); return rows; }
    rows.push(...j);
    if (j.length < 1000) break;                                                         // a full page means there may be more
  }
  out.fmp_rows += rows.length;
  return rows;
}

let lastSec = 0;
/** one streamed SEC read: stops at HEAD_BYTES (~60 KB) when the text there has decided a class; otherwise (a cover drowned
 *  in markup, or a registration statement whose facing page fills the first 60 KB) reads on, in the same request, until
 *  something decides or HEAD_CHARS of text are in hand, never past HEAD_BYTES_MAX. */
async function secHead(url: string, out: any): Promise<{ status: number; text: string; bytes: number }> {
  const wait = lastSec + SEC_GAP_MS - Date.now(); if (wait > 0) await sleep(wait);
  lastSec = Date.now(); out.sec_reads++;
  const r = await fetch(url, { headers: { "User-Agent": SEC_UA, "Accept-Encoding": "gzip, deflate" }, signal: AbortSignal.timeout(30_000) });
  if (!r.ok || !r.body) {                                   // keep the SEC's own words (no secret in them) for the run report
    let why = ""; try { why = cleanHtml((await r.text()).slice(0, 4000)).slice(0, 160); } catch (_) {}
    return { status: r.status, text: why, bytes: 0 };
  }
  const reader = r.body.getReader(); const dec = new TextDecoder("utf-8"); let html = "", bytes = 0, limit = HEAD_BYTES;
  while (bytes < limit) {
    const { done, value } = await reader.read(); if (done) break;
    bytes += value.length; html += dec.decode(value, { stream: true });
    if (bytes >= limit && limit < HEAD_BYTES_MAX) {
      const t = cleanHtml(html);
      if (t.length < HEAD_CHARS && classify(t).cls === "UNCLASSIFIED") limit = Math.min(limit + HEAD_BYTES, HEAD_BYTES_MAX);
    }
  }
  try { await reader.cancel(); } catch (_) {}
  return { status: r.status, text: cleanHtml(html), bytes };
}

async function universe(sb: any): Promise<Set<string> & { hub?: Set<string> }> {
  // The stocks the Hub serves: public.tickers, active, type 'stock' or untyped (the 90 core names — AAPL, NVDA, CRWV,
  // ZETA … — carry no type), never a fund (company_profile.is_etf) and never a crypto pair.
  const { data, error } = await sb.from("tickers").select("ticker,type,fmp_symbol").eq("active", true).or("type.eq.stock,type.is.null");
  if (error) throw new Error("tickers: " + error.message);
  const { data: etf, error: e2 } = await sb.from("company_profile").select("ticker").eq("is_etf", true);
  if (e2) throw new Error("company_profile: " + e2.message);
  const funds = new Set((etf || []).map((x: any) => String(x.ticker)));
  const s: Set<string> & { hub?: Set<string> } = new Set<string>(), hub = new Set<string>();
  for (const r of data || []) {
    const t = String(r.ticker || "").toUpperCase();
    if (!t || t.endsWith("USD") || funds.has(t)) continue;
    s.add(String(r.fmp_symbol || t).toUpperCase());
    hub.add(t);                                              // the news table keys rows by the Hub's own ticker
  }
  s.hub = hub;
  return s;
}

const NEWS_OR = ["offering", "convertible", "at-the-market", "registered direct", "private placement", "shelf", "debt sale", "notes sale", "debt raise"]
  .map((w) => "title.ilike.*" + w + "*").join(",");
/** C1 · the news step: offering headlines of the last `days` days → public.offering_news, then join the unjoined ones */
async function newsStep(sb: any, uni: Set<string> & { hub?: Set<string> }, days: number, out: any) {
  const N: any = { days, scanned: 0, matched: 0, written: 0, joined: 0, first: [] as any[] };
  out.news = N;
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const keep = new Map<string, any>();
  // the company names, so a headline Google filed under the wrong ticker is dropped (classify.mjs namesCompany)
  const names: Record<string, string> = {};
  const hubList = [...(uni.hub || uni)];
  for (let i = 0; i < hubList.length; i += 300) {
    const { data, error } = await sb.from("company_profile").select("ticker,name").in("ticker", hubList.slice(i, i + 300));
    if (error) { out.errors.push("company_profile names: " + error.message); break; }
    for (const r of data || []) if (r && r.ticker && r.name) names[String(r.ticker).toUpperCase()] = String(r.name);
  }
  for (let page = 0; page < 20; page++) {
    const { data, error } = await sb.from("news").select("ticker,url,published_ts,title,site,feed").gte("published_ts", since).or(NEWS_OR)
      .order("published_ts", { ascending: true }).range(page * 1000, page * 1000 + 999);
    if (error) { out.errors.push("news read: " + error.message); return; }
    N.scanned += (data || []).length;
    for (const r of data || []) { const n = newsFromRow(r, uni.hub || uni, names); if (n) keep.set(n.ticker + "|" + n.url, n); }
    if (!data || data.length < 1000) break;
  }
  const rows = [...keep.values()];
  N.matched = rows.length;
  if (rows.length) {
    const { data, error } = await sb.from("offering_news").upsert(rows, { onConflict: "ticker,url", ignoreDuplicates: true }).select("ticker,url");
    if (error) { out.errors.push("offering_news insert: " + error.message); return; }
    N.written = (data || []).length;
  }
  // join: every headline not joined yet (the last days + 10), against the filings of those tickers
  const from = new Date(Date.now() - (days + 10) * 86400e3).toISOString();
  const { data: open, error: oe } = await sb.from("offering_news").select("ticker,url,published_utc,kind,source,title").is("filing_url", null).gte("published_utc", from).limit(2000);
  if (oe) { out.errors.push("offering_news read: " + oe.message); return; }
  const tks = [...new Set((open || []).map((n: any) => n.ticker))];
  if (tks.length) {
    const { data: fil, error: fe } = await sb.from("offering_filings").select("url,ticker,filed_date,accepted_utc,class").in("ticker", tks).gte("filed_date", from.slice(0, 10));
    if (fe) { out.errors.push("offering_filings read (join): " + fe.message); return; }
    for (const n of open || []) {
      const f = joinFiling(n, fil || []);
      if (!f) continue;
      const { error } = await sb.from("offering_news").update({ filing_url: f.url }).eq("ticker", n.ticker).eq("url", n.url);
      if (error) out.errors.push("offering_news join " + n.ticker + ": " + error.message); else N.joined++;
    }
  }
  // the earliest headline per ticker and kind in this window, for the run report
  const firsts = new Map<string, any>();
  for (const n of rows) { const k = n.ticker + "|" + n.kind; if (!firsts.has(k)) firsts.set(k, n); }
  N.first = [...firsts.values()].slice(0, 60).map((n) => ({ ticker: n.ticker, kind: n.kind, at: n.published_utc, source: n.source, title: n.title }));
}

Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const u = new URL(req.url);
    let body: any = {}; if (req.method === "POST") { try { body = await req.json(); } catch (_) { body = {}; } }
    const p = (k: string) => u.searchParams.get(k) ?? (body && body[k] != null ? String(body[k]) : null);
    const mode = p("mode") || "pass";
    if (mode !== "pass" && mode !== "backfill") return J({ ok: false, version: VERSION, error: "mode must be pass or backfill" }, 400);
    const reclassify = mode === "backfill" && p("reclassify") === "1";
    const newsDays = Math.min(Math.max(Math.round(Number(p("news_days")) || NEWS_DAYS), 1), 30);
    const budget = Math.min(Math.max(Number(p("budget_ms")) || DEFAULT_BUDGET_MS, 10_000), 140_000);
    let days: string[];
    if (mode === "pass") days = passDays(Date.now());
    else {
      const from = p("from") || "", to = p("to") || "";
      days = weekdays(from, to);
      if (!days.length) return J({ ok: false, version: VERSION, error: "backfill needs from and to (YYYY-MM-DD, from ≤ to)" }, 400);
    }
    const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
    // the FMP key — public.app_config, service role, like fmp-analyst. Never logged or returned.
    const { data: cfg, error: ce } = await sb.from("app_config").select("key,value").in("key", ["FMP_KEY"]);
    if (ce) return J({ ok: false, version: VERSION, error: "app_config: " + ce.message }, 500);
    const K = String(((cfg || []).find((r: any) => r.key === "FMP_KEY") || {}).value || "").trim();
    if (!K) return J({ ok: false, version: VERSION, error: "no FMP_KEY in app_config" }, 500);
    const uni = await universe(sb);

    const out: any = { ok: true, version: VERSION, mode, universe: uni.size, from: days[0], to: days[days.length - 1],
      days_done: 0, fmp_calls: 0, fmp_rows: 0, universe_hits: 0, already_stored: 0, sec_reads: 0, written: 0,
      classes: {}, new_rows: [], errors: [], next_from: null, sec_refused: false,
      region: Deno.env.get("SB_REGION") || null };

    for (const day of days) {
      if (Date.now() - t0 > budget || out.sec_refused) { out.next_from = day; break; }   // refused: resume from this day
      // 1 · FMP, one call per form for this day ∩ the universe
      const byUrl = new Map<string, any>();
      for (const form of FORMS) {
        for (const r of await fmpForm(form, day, K, out)) {
          const f = filingFromFmp(r, uni);
          if (!f || f.filed_date !== day || byUrl.has(f.url)) continue;
          if (!f.form) f.form = form;
          byUrl.set(f.url, f);
        }
      }
      out.universe_hits += byUrl.size;
      if (!byUrl.size) { out.days_done++; continue; }
      // 2 · which of these are new (one SEC read per NEW filing only)
      const urls = [...byUrl.keys()];
      const { data: have, error: he } = await sb.from("offering_filings").select("url").in("url", urls);
      if (he) { out.errors.push(`stored ${day}: ${he.message}`); break; }
      const stored = new Set((have || []).map((x: any) => x.url));
      out.already_stored += stored.size;
      const todo = urls.filter((x) => reclassify || !stored.has(x));
      // 3 · SEC read + classify
      const rows: any[] = [];
      for (const url of todo) {
        if (out.sec_refused) break;
        const f = byUrl.get(url);
        let res: { status: number; text: string; bytes: number };
        try { res = await secHead(url, out); }
        catch (e) { out.errors.push(`SEC ${f.ticker} ${day}: ${String((e as any)?.name || "error")} ${String((e as any)?.message || "").slice(0, 80)}`.trim()); continue; }
        if (res.status === 404 || res.status === 410) {
          rows.push({ ...f, class: "UNCLASSIFIED", sentence: `the SEC answered ${res.status} for this document`, size_text: null });
          continue;
        }
        if (res.status !== 200) {
          out.errors.push(`SEC ${f.ticker} ${day}: HTTP ${res.status} (left for the next run) ${res.text}`.trim());
          if (res.status === 429 || res.status === 403) { out.sec_refused = true; break; }   // the SEC asks callers to back off: stop reading
          continue;
        }
        const c = classify(res.text);
        rows.push({ ...f, class: c.cls, sentence: c.sentence, size_text: c.size_text });
      }
      if (!rows.length) { out.days_done++; continue; }
      // 4 · write: insert new rows (first_seen_utc defaults to now); reclassify updates class/sentence/size only
      let inserted: any[] = [];
      if (reclassify) {
        for (const r of rows) {
          const { error } = await sb.from("offering_filings").update({ class: r.class, sentence: r.sentence, size_text: r.size_text }).eq("url", r.url);
          if (error) out.errors.push(`update ${r.ticker}: ${error.message}`); else out.written++;
        }
        const fresh = rows.filter((r) => !stored.has(r.url));
        if (fresh.length) {
          const { data, error } = await sb.from("offering_filings").upsert(fresh, { onConflict: "url", ignoreDuplicates: true }).select("url,ticker,form,filed_date,accepted_utc,class,size_text");
          if (error) out.errors.push(`insert ${day}: ${error.message}`); else { inserted = data || []; out.written += inserted.length; }
        }
      } else {
        const { data, error } = await sb.from("offering_filings").upsert(rows, { onConflict: "url", ignoreDuplicates: true }).select("url,ticker,form,filed_date,accepted_utc,class,size_text");
        if (error) { out.errors.push(`insert ${day}: ${error.message}`); break; }
        inserted = data || []; out.written += inserted.length;
      }
      for (const r of inserted) {
        out.classes[r.class] = (out.classes[r.class] || 0) + 1;
        if (out.new_rows.length < 200) out.new_rows.push({ ticker: r.ticker, form: r.form, filed_date: r.filed_date, class: r.class, size_text: r.size_text });
      }
      out.days_done++;
    }
    // C1 · the news step runs on every pass, after the filings (so a filing stored this run can be joined at once)
    if (mode === "pass") { try { await newsStep(sb, uni, newsDays, out); } catch (e) { out.errors.push("news step: " + String((e as any)?.message || e).slice(0, 160)); } }
    out.ms = Date.now() - t0;
    return J(out);
  } catch (e) {
    const msg = String((e as any)?.message || e).replace(/apikey=[^&\s]+/gi, "apikey=…");
    return J({ ok: false, version: VERSION, error: msg.slice(0, 300), ms: Date.now() - t0 }, 500);
  }
});

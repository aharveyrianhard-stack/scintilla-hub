// SCINTILLA · analyst-revisions v1 — the REVISIONS strip's collector (R2 Part C, 2 Oct 2026).
//
// Alan (2 Oct, 15:00 ET): "analyst price revisions · better estimates for a DCF". R1 found the revision stream sitting unused
// in FMP: every price-target and rating change by firm, with the stock price that day. This job keeps it for the Hub's stocks
// (public.analyst_target_news) and keeps FMP's price-target summary once a New York day (public.price_target_summary_daily),
// so the ESTIMATES tab can say who moved, from what to what, at what price — and whether the month's targets sit below the
// quarter's (Nvidia, 2 Oct: 3 targets last month averaging $247 vs 25 last quarter averaging $332).
//
// Modes (GET or POST, query string):
//   ?mode=pass       (default; what the nightly cron should call)
//                    1. the all-ticker feeds price-target-latest-news and grades-latest-news, paged back until the rows already
//                       stored (lib.keepPaging), kept only for the Hub's stocks;
//                    2. price-target-summary for the Hub's stocks, one row per stock for today's New York date.
//                    &offset=&limit= chunk step 2 across invocations; &feeds=0 skips step 1; &summary=0 skips step 2.
//   ?mode=backfill   per stock price-target-news and grades-news, the newest 50 of each. &offset=&limit= chunk it.
//                    &deep=1 (v2, R3): every page per stock (100 a page) until a page reaches past &years= (default 2) back,
//                    FMP runs out, or the page cap (&maxpages=, default 30) — reports the depth reached and the calls used.
//   ?mode=estimates  (v2, R3) one snapshot a New York day of FMP analyst-estimates (annual + quarter) per Hub stock into
//                    public.analyst_estimates_daily, so EPS / revenue estimates can be compared with 30 / 60 / 90 days ago.
//                    &offset=&limit= chunk it. &seed=mirror instead reads the one old copy of public.analyst_estimates that
//                    survives in R2 (tables/analyst_estimates/all.csv.gz, 11 Aug 2026; &key= another) and stores its rows
//                    dated by their own updated_ts — never overwriting a row already there. &list=1 lists what R2 holds
//                    under tables/analyst_estimates (the R2 keys come from public.app_config, as table-to-r2 reads them).
//
// The FMP key: read from public.app_config (key FMP_KEY) with the service-role client, exactly as fmp-analyst does. It is never
// logged, returned or written; error text carries the route path and the HTTP status only. /stable/ routes only.
// Writes ONLY public.analyst_target_news and public.price_target_summary_daily (both created 2 Oct by
// supabase/migrations/20261002_analyst_revisions.sql) and, from v2, public.analyst_estimates_daily
// (supabase/migrations/20261002_analyst_estimates_daily.sql). No other table, no alert, no cron. R2 is only read.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dedupe, dedupeEst, deepKeepPaging, estimateRow, type EstRow, gradeRow, inSnapshotWindow, keepPaging, mirrorEstimateRow, nyDate,
  type NewsRow, oldestOf, parseCsv, slice, stockUniverse, summaryRow, type SummaryRow, targetRow } from "./lib.ts";

const VERSION = "analyst-revisions-v2";
const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FMP = "https://financialmodelingprep.com/stable/";
const FEED_PAGE = 100, FEED_MAX_PAGES = 25, BACKFILL_N = 50, CONC = 6, DEEP_PAGE = 100;
const MIRROR_KEY = "tables/analyst_estimates/all.csv.gz";

const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

/** one FMP read → rows (or null) and the status; the key never leaves this function */
async function fmp(path: string, key: string): Promise<{ rows: any[] | null; status: number }> {
  try {
    const r = await fetch(FMP + path + (path.includes("?") ? "&" : "?") + "apikey=" + key);
    if (!r.ok) { await r.body?.cancel(); return { rows: null, status: r.status }; }
    const j = await r.json();
    return { rows: Array.isArray(j) ? j : null, status: r.status };
  } catch (_) {
    return { rows: null, status: 0 };
  }
}

async function readAll(sb: any, table: string, cols: string, filter?: (q: any) => any): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    let q = sb.from(table).select(cols).range(from, from + 999);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(table + ": " + error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function upsert(sb: any, table: string, rows: any[], onConflict: string): Promise<number> {
  let n = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const part = rows.slice(i, i + 500);
    const { error } = await sb.from(table).upsert(part, { onConflict });
    if (error) throw new Error(table + " upsert: " + error.message);
    n += part.length;
  }
  return n;
}

async function inBatches<T>(items: T[], size: number, fn: (x: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

/* ── R2, read only (the mirror's old copy of analyst_estimates). Same SigV4 signing as table-to-r2; GET only. ── */
type R2 = { endpoint: string; ak: string; sk: string; bucket: string; host: string };
const enc = new TextEncoder();
const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b as ArrayBuffer)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256hex = async (b: Uint8Array) => hex(await crypto.subtle.digest("SHA-256", b as unknown as ArrayBuffer));
async function hmac(key: Uint8Array, msg: string) {
  const k = await crypto.subtle.importKey("raw", key as unknown as ArrayBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
}
const rfc3986 = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
async function r2get(cfg: R2, key: string, query: Record<string, string> = {}): Promise<Response> {
  const path = "/" + cfg.bucket + (key ? "/" + key.split("/").map(rfc3986).join("/") : "");
  const qs = Object.keys(query).sort().map((k) => rfc3986(k) + "=" + rfc3986(query[k])).join("&");
  const bodyHash = await sha256hex(new Uint8Array(0));
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""), day = amzDate.slice(0, 8);
  const canonReq = ["GET", path, qs, "host:" + cfg.host + "\nx-amz-content-sha256:" + bodyHash + "\nx-amz-date:" + amzDate + "\n",
    "host;x-amz-content-sha256;x-amz-date", bodyHash].join("\n");
  const scope = day + "/auto/s3/aws4_request";
  const sts = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256hex(enc.encode(canonReq))].join("\n");
  let k = await hmac(enc.encode("AWS4" + cfg.sk), day);
  k = await hmac(k, "auto"); k = await hmac(k, "s3"); k = await hmac(k, "aws4_request");
  const auth = "AWS4-HMAC-SHA256 Credential=" + cfg.ak + "/" + scope + ", SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=" + hex(await hmac(k, sts));
  return await fetch(cfg.endpoint + path + (qs ? "?" + qs : ""), { headers: { "x-amz-content-sha256": bodyHash, "x-amz-date": amzDate, Authorization: auth } });
}
async function r2cfg(sb: any): Promise<R2> {
  const names = ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"];
  const { data, error } = await sb.from("app_config").select("key,value").in("key", names);
  if (error) throw new Error("app_config (R2): " + error.message);
  const C: Record<string, string> = {};
  for (const r of data || []) C[String(r.key)] = String(r.value ?? "");
  const miss = names.filter((x) => !C[x]);
  if (miss.length) throw new Error("missing R2 config: " + miss.join(","));
  return { endpoint: C.R2_ENDPOINT.replace(/\/$/, ""), ak: C.R2_ACCESS_KEY_ID, sk: C.R2_SECRET_ACCESS_KEY, bucket: C.R2_BUCKET, host: new URL(C.R2_ENDPOINT).host };
}
async function gunzipText(b: Uint8Array): Promise<string> {
  const s = new Blob([b as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(s).text();
}

Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const u = new URL(req.url);
    const mode = (u.searchParams.get("mode") || "pass").toLowerCase();
    if (mode !== "pass" && mode !== "backfill" && mode !== "estimates") return J({ version: VERSION, error: "mode must be pass, backfill or estimates" }, 400);
    const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

    if (mode === "estimates" && (u.searchParams.get("list") === "1" || u.searchParams.get("seed") === "mirror")) {
      const cfg = await r2cfg(sb);
      if (u.searchParams.get("list") === "1") {
        const r = await r2get(cfg, "", { "list-type": "2", prefix: "tables/analyst_estimates", "max-keys": "200" });
        const x = await r.text();
        if (!r.ok) return J({ version: VERSION, mode, error: "R2 list HTTP " + r.status }, 502);
        const objs = [...x.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map((m) => ({
          key: (/<Key>([^<]*)<\/Key>/.exec(m[1]) || [])[1], modified: (/<LastModified>([^<]*)</.exec(m[1]) || [])[1],
          bytes: Number((/<Size>(\d+)</.exec(m[1]) || [])[1] || 0) }));
        return J({ version: VERSION, mode, r2_objects: objs, ms: Date.now() - t0 });
      }
      const key = u.searchParams.get("key") || MIRROR_KEY;
      if (!/^tables\/analyst_estimates\/[\w.-]+\.csv\.gz$/.test(key)) return J({ version: VERSION, mode, error: "key must be under tables/analyst_estimates/" }, 400);
      const r = await r2get(cfg, key);
      if (!r.ok) { await r.body?.cancel(); return J({ version: VERSION, mode, key, error: "R2 GET HTTP " + r.status }, 502); }
      const recs = parseCsv(await gunzipText(new Uint8Array(await r.arrayBuffer())));
      const src = "r2:" + key;
      const all = dedupeEst(recs.map((o) => mirrorEstimateRow(o, src)));
      const keep = all.filter((x) => inSnapshotWindow(x.period, x.fiscal_date, x.as_of_date));
      let n = 0;
      for (let i = 0; i < keep.length; i += 500) {
        const { error } = await sb.from("analyst_estimates_daily").upsert(keep.slice(i, i + 500),
          { onConflict: "ticker,period,fiscal_date,as_of_date", ignoreDuplicates: true });
        if (error) throw new Error("analyst_estimates_daily seed: " + error.message);
        n += Math.min(500, keep.length - i);
      }
      const dates: Record<string, number> = {};
      for (const x of keep) dates[x.as_of_date] = (dates[x.as_of_date] || 0) + 1;
      return J({ version: VERSION, mode, seed: "mirror", key, csv_rows: recs.length, columns: recs[0] ? Object.keys(recs[0]) : [],
        usable_rows: all.length, kept_in_window: keep.length, sent: n, as_of_dates: dates, tickers: new Set(keep.map((x) => x.ticker)).size, ms: Date.now() - t0 });
    }

    const { data: cfg, error: ce } = await sb.from("app_config").select("value").eq("key", "FMP_KEY").limit(1);
    if (ce) throw new Error("app_config: " + ce.message);
    const K = String((cfg && cfg[0] && cfg[0].value) || "").trim();
    if (!K) throw new Error("no FMP_KEY in app_config");

    const [tk, coh, funds] = await Promise.all([
      readAll(sb, "tickers", "ticker,type,active", (q) => q.eq("active", true)),
      readAll(sb, "cohorts", "ticker"),
      readAll(sb, "company_profile", "ticker", (q) => q.eq("is_etf", true)),
    ]);
    const U = stockUniverse(tk, coh, funds);
    const inU = new Set(U);
    const runStart = new Date(t0).toISOString();
    const errs: string[] = [];
    const out: Record<string, unknown> = { version: VERSION, mode, universe: U.length, run_start: runStart };

    if (mode === "estimates") {
      const asOf = nyDate(new Date(t0));
      const part = slice(U, u.searchParams.get("offset"), u.searchParams.get("limit"));
      const rows: (EstRow | null)[] = [];
      let calls = 0;
      await inBatches(part, CONC, async (t) => {
        const [a, q] = await Promise.all([
          fmp("analyst-estimates?symbol=" + encodeURIComponent(t) + "&period=annual&page=0&limit=20", K),
          fmp("analyst-estimates?symbol=" + encodeURIComponent(t) + "&period=quarter&page=0&limit=40", K),
        ]);
        calls += 2;
        if (a.rows) for (const x of a.rows) rows.push(estimateRow(x, t, "annual", asOf)); else errs.push(t + " analyst-estimates annual HTTP " + a.status);
        if (q.rows) for (const x of q.rows) rows.push(estimateRow(x, t, "quarter", asOf)); else errs.push(t + " analyst-estimates quarter HTTP " + q.status);
      });
      const clean = dedupeEst(rows).filter((x) => inSnapshotWindow(x.period, x.fiscal_date, asOf));
      out.as_of_date = asOf;
      out.tickers = part.length;
      out.offset = u.searchParams.get("offset") || "0";
      out.fmp_calls = calls;
      out.tickers_with_rows = new Set(clean.map((x) => x.ticker)).size;
      out.rows_upserted = await upsert(sb, "analyst_estimates_daily", clean, "ticker,period,fiscal_date,as_of_date");
      out.errors = errs.slice(0, 40);
      out.error_count = errs.length;
      out.ms = Date.now() - t0;
      return J(out);
    }

    if (mode === "backfill" && u.searchParams.get("deep") === "1") {
      const part = slice(U, u.searchParams.get("offset"), u.searchParams.get("limit"));
      const years = Math.max(1, Math.min(10, Number(u.searchParams.get("years") || 2) || 2));
      const maxPages = Math.max(1, Math.min(80, Number(u.searchParams.get("maxpages") || 30) || 30));
      const cutoff = new Date(t0 - years * 365.25 * 86400e3).toISOString();
      let calls = 0, capped = 0;
      const depth: Record<string, { pages: number; oldest: string | null; reached: boolean }> = {};
      let n = 0, nT = 0, nG = 0;
      await inBatches(part, CONC, async (t) => {
        const rows: (NewsRow | null)[] = [];
        for (const f of [{ route: "price-target-news", map: targetRow, k: "T" }, { route: "grades-news", map: gradeRow, k: "G" }]) {
          let pages = 0, oldest: string | null = null, reached = false;
          for (let p = 0; p < maxPages; p++) {
            const r = await fmp(f.route + "?symbol=" + encodeURIComponent(t) + "&page=" + p + "&limit=" + DEEP_PAGE, K);
            calls++;
            if (!r.rows) { errs.push(t + " " + f.route + " page " + p + " HTTP " + r.status); break; }
            pages++;
            for (const x of r.rows) rows.push(f.map(x, t));
            const o = oldestOf(r.rows);
            if (o && (!oldest || o < oldest)) oldest = o;
            if (oldest && oldest <= cutoff) reached = true;
            if (!deepKeepPaging(r.rows, cutoff)) break;
            if (p === maxPages - 1) capped++;
          }
          depth[t + ":" + f.k] = { pages, oldest, reached };
        }
        const clean = dedupe(rows);
        n += await upsert(sb, "analyst_target_news", clean, "ticker,published_utc,firm,kind");
        nT += clean.filter((r) => r.kind === "TARGET").length;
        nG += clean.filter((r) => r.kind === "GRADE").length;
      });
      const d = Object.values(depth), olds = d.map((x) => x.oldest).filter(Boolean).sort() as string[];
      out.deep = { years, cutoff, max_pages: maxPages, tickers: part.length, offset: u.searchParams.get("offset") || "0",
        fmp_calls: calls, pages_read: d.reduce((a, x) => a + x.pages, 0), feeds_past_cutoff: d.filter((x) => x.reached).length,
        feeds_ended_before_cutoff: d.filter((x) => !x.reached).length, feeds_hit_page_cap: capped,
        oldest_note_read: olds[0] || null, median_oldest: olds.length ? olds[Math.floor(olds.length / 2)] : null,
        rows_upserted: n, targets: nT, grades: nG,
        depth_by_ticker: Object.fromEntries(Object.entries(depth).filter(([k]) => /^(NVDA|MU|AAPL|MSFT):/.test(k))) };
    } else if (mode === "backfill") {
      const part = slice(U, u.searchParams.get("offset"), u.searchParams.get("limit"));
      const rows: (NewsRow | null)[] = [];
      let calls = 0;
      await inBatches(part, CONC, async (t) => {
        const [pt, gr] = await Promise.all([
          fmp("price-target-news?symbol=" + encodeURIComponent(t) + "&page=0&limit=" + BACKFILL_N, K),
          fmp("grades-news?symbol=" + encodeURIComponent(t) + "&page=0&limit=" + BACKFILL_N, K),
        ]);
        calls += 2;
        if (pt.rows) for (const x of pt.rows) rows.push(targetRow(x, t)); else errs.push(t + " price-target-news HTTP " + pt.status);
        if (gr.rows) for (const x of gr.rows) rows.push(gradeRow(x, t)); else errs.push(t + " grades-news HTTP " + gr.status);
      });
      const clean = dedupe(rows);
      out.tickers = part.length;
      out.offset = u.searchParams.get("offset") || "0";
      out.fmp_calls = calls;
      out.rows_upserted = await upsert(sb, "analyst_target_news", clean, "ticker,published_utc,firm,kind");
      out.targets = clean.filter((r) => r.kind === "TARGET").length;
      out.grades = clean.filter((r) => r.kind === "GRADE").length;
    } else {
      if (u.searchParams.get("feeds") !== "0") {
        const feeds: { kind: "TARGET" | "GRADE"; route: string; map: (x: any, t: string) => NewsRow | null }[] = [
          { kind: "TARGET", route: "price-target-latest-news", map: targetRow },
          { kind: "GRADE", route: "grades-latest-news", map: gradeRow },
        ];
        const feedOut: Record<string, unknown> = {};
        for (const f of feeds) {
          const { data: nw, error: ne } = await sb.from("analyst_target_news").select("published_utc").eq("kind", f.kind)
            .order("published_utc", { ascending: false }).limit(1);
          if (ne) throw new Error("newest " + f.kind + ": " + ne.message);
          const newest = (nw && nw[0] && nw[0].published_utc) || null;
          const rows: (NewsRow | null)[] = [];
          let pages = 0, seen = 0, oldest: string | null = null;
          for (let p = 0; p < FEED_MAX_PAGES; p++) {
            const r = await fmp(f.route + "?page=" + p + "&limit=" + FEED_PAGE, K);
            if (!r.rows) { errs.push(f.route + " page " + p + " HTTP " + r.status); break; }
            pages++;
            seen += r.rows.length;
            for (const x of r.rows) {
              const t = String((x && x.symbol) || "").toUpperCase();
              if (inU.has(t)) rows.push(f.map(x, t));
              if (x && x.publishedDate) oldest = String(x.publishedDate);
            }
            if (!keepPaging(r.rows, newest)) break;
          }
          const clean = dedupe(rows);
          feedOut[f.kind] = { newest_stored_before: newest, pages, feed_rows_read: seen, oldest_read: oldest, ours: clean.length,
            upserted: await upsert(sb, "analyst_target_news", clean, "ticker,published_utc,firm,kind") };
        }
        out.feeds = feedOut;
      }
      if (u.searchParams.get("summary") !== "0") {
        const asOf = nyDate(new Date(t0));
        const part = slice(U, u.searchParams.get("offset"), u.searchParams.get("limit"));
        const rows: SummaryRow[] = [];
        await inBatches(part, CONC * 2, async (t) => {
          const r = await fmp("price-target-summary?symbol=" + encodeURIComponent(t), K);
          if (!r.rows) { errs.push(t + " price-target-summary HTTP " + r.status); return; }
          const row = summaryRow(r.rows[0], t, asOf);
          if (row) rows.push(row);
        });
        out.summary = { as_of_date: asOf, tickers: part.length, offset: u.searchParams.get("offset") || "0",
          rows: await upsert(sb, "price_target_summary_daily", rows, "ticker,as_of_date") };
      }
    }
    const { count } = await sb.from("analyst_target_news").select("ticker", { count: "exact", head: true }).gte("first_seen_utc", runStart);
    out.new_rows_this_run = count ?? null;
    out.errors = errs.slice(0, 40);
    out.error_count = errs.length;
    out.ms = Date.now() - t0;
    return J(out);
  } catch (e) {
    return J({ version: VERSION, error: String((e as any)?.message || e).replace(/apikey=[^&\s]+/gi, "apikey=…").replace(/Credential=[^,\s]+/g, "Credential=…"), ms: Date.now() - t0 }, 500);
  }
});

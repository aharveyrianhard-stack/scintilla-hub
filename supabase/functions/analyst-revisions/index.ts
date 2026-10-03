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
//
// The FMP key: read from public.app_config (key FMP_KEY) with the service-role client, exactly as fmp-analyst does. It is never
// logged, returned or written; error text carries the route path and the HTTP status only. /stable/ routes only.
// Writes ONLY public.analyst_target_news and public.price_target_summary_daily (both created 2 Oct by
// supabase/migrations/20261002_analyst_revisions.sql). No other table, no alert, no cron.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dedupe, gradeRow, keepPaging, nyDate, type NewsRow, slice, stockUniverse, summaryRow, type SummaryRow, targetRow } from "./lib.ts";

const VERSION = "analyst-revisions-v1";
const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FMP = "https://financialmodelingprep.com/stable/";
const FEED_PAGE = 100, FEED_MAX_PAGES = 25, BACKFILL_N = 50, CONC = 6;

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

Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const u = new URL(req.url);
    const mode = (u.searchParams.get("mode") || "pass").toLowerCase();
    if (mode !== "pass" && mode !== "backfill") return J({ version: VERSION, error: "mode must be pass or backfill" }, 400);
    const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

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

    if (mode === "backfill") {
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
    return J({ version: VERSION, error: String((e as any)?.message || e).replace(/apikey=[^&\s]+/gi, "apikey=…"), ms: Date.now() - t0 }, 500);
  }
});

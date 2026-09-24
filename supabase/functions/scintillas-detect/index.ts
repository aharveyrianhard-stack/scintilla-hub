// SCINTILLA · scintillas-detect v1 (M42) — turn today's unusual moves into stored scintillas.
//
// WHY THIS EXISTS. A scintilla was a 520 ms glow and nothing more: it lived only while it was on
// screen. Alan, 23 Sep: "we need to broaden scintillation as a signal thats why its called
// scintilla … it can be part of a measure of criticality". Counting them, ranking them and carrying
// one from the dashboard into the room it points at all need the same thing first — a memory.
//
// WHAT IT DOES. It reads what the Hub already reads, asks the detectors in ./detect.mjs whether
// anything moved further than its own history says it usually does, and writes one row per finding
// into public.scintillas. The detectors are pure and shared with scripts/scintillas-detect.mjs
// (a test pins the two files byte-for-byte), so every stored row can be recomputed by hand.
//
// THE RULES IT WILL NOT BREAK.
//   1. It writes to ONE table, public.scintillas, and never to a price, estimate or result table.
//   2. Running it twice with the same inputs leaves ONE row: every event carries a dedupe_key and
//      the insert is ignore-duplicates.
//   3. It never invents a number. Too little history, no estimate, or a flat history means no row
//      and a stated reason in the response.
//   4. It reads keys from the environment and never prints them.
//   5. Bandwidth is bounded: see PREFILTER below. What it skipped, and why, is in the response.
//
// MODES.
//   ?mode=intraday (default) — quotes for the universe, then daily bars ONLY for names already
//     moving at least PREFILTER_PCT, capped at MAX_CANDLE_FETCH. Cheap enough to run every few
//     minutes. HONEST LIMIT: a name so quiet that 2 sigma is under PREFILTER_PCT is not examined
//     until the session pass.
//   ?mode=session — the same pass with the prefilter switched off, for once after the close.
// Econ (surprise + imminent) and earnings run in BOTH modes: they cost two database reads.
//   ?mode=dilution — M59. A separate, cheap pass over what companies FILED: convertible notes,
//     offerings, at-the-market programmes, private placements, warrant exercises, notes exchanged
//     for shares. It reads EDGAR's own daily index — ONE file that lists every filing made that
//     day, for every company in America — keeps the lines whose CIK is in this universe and whose
//     form can carry an issuance, and only then reads those few documents. A quiet day costs one
//     index read and nothing else. It costs NOTHING at FMP: the SEC publishes all of this free,
//     needs no key, and is the primary source rather than a copy of it.
import {
  detectPriceOutliers, detectEarningsSurprises, detectEconSurprises, detectEconImminent, econEventKey,
  detectDilution, DILUTION_FORMS,
} from "./detect.mjs";
/* M48 — the thresholds are no longer buried in the code. They live in data/scintilla-rules.json,
   which the Hub fetches and this function carries as a generated copy (scripts/build-scintilla-rules.mjs;
   a test pins the two together). Two families, either one fires: the move against the name's own usual
   day, and a plain percentage floor, both per asset class. */
import { RULES } from "./rules.mjs";

const SB = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CHART = Deno.env.get("SC_CHART_API") || "https://scintilla-massive-chart-api.fly.dev";
/* M48: the prefilter must stay BELOW the lowest bar any rule can fire on, or a rule in the file
   would be unreachable intraday. The lowest is the smallest "at least this much" in price.* . */
const PREFILTER_PCT = Math.min(0.5, ...Object.values(RULES.price as Record<string, any>)
  .map((p: any) => Number(p.x_usual_needs_move_pct)).filter((n: number) => Number.isFinite(n)));
const MAX_CANDLE_FETCH = 140;   // hard ceiling on daily-bar reads per run
const MAX_FILING_READS = 40;    // hard ceiling on SEC documents read per run
const CANDLE_DAYS = 90;         // ~60 trading days -> a 20-day volatility is comfortably covered
const CONCURRENCY = 6;

const sbHeaders = { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "content-type": "application/json" };

async function sbGet(path: string) {
  const r = await fetch(SB + "/rest/v1/" + path, { headers: sbHeaders });
  if (!r.ok) throw new Error("db " + path.split("?")[0] + " -> " + r.status);
  return await r.json();
}
async function chartGet(path: string) {
  const r = await fetch(CHART + path, { headers: { origin: "https://scintillahub.ai" } });
  if (!r.ok) throw new Error("chart " + path.split("?")[0] + " -> " + r.status);
  return await r.json();
}
/* run a bounded number of requests at a time — the chart API is one small machine */
async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}
const iso = (d: Date) => d.toISOString();
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
/* the session a move belongs to, in ET, so a 20:00 UTC read and a 01:00 UTC read agree */
function sessionET(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

async function insert(rows: any[]) {
  if (!rows.length) return { inserted: 0 };
  const r = await fetch(SB + "/rest/v1/scintillas?on_conflict=dedupe_key", {
    method: "POST",
    headers: { ...sbHeaders, Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error("insert -> " + r.status + " " + (await r.text()).slice(0, 200));
  const back = await r.json();
  return { inserted: Array.isArray(back) ? back.length : 0 };
}

Deno.serve(async (req) => {
  const started = Date.now();
  const url = new URL(req.url);
  const m0 = url.searchParams.get("mode");
  const mode = m0 === "session" ? "session" : m0 === "dilution" ? "dilution" : "intraday";
  const now = new Date();
  const session = sessionET(now);
  const report: any = { mode, session, at: iso(now), rules_version: RULES.version, kinds: {}, skipped_counts: {}, notes: [] };
  const events: any[] = [];

  try {
    /* ── prices: outliers of the day ─────────────────────────────────────────────── */
    const universe = await chartGet("/universe");
    const symbols: string[] = (universe.symbols || universe.universe || []).map((s: any) => (typeof s === "string" ? s : s.symbol)).filter(Boolean);
    const quotes = await chartGet("/quotes?symbols=" + symbols.join(","));
    /* 24 Sep: the chart API's /quotes answers { quotes: { AAPL: {...}, … } } — an object keyed by
       symbol, with previous_close — not a list with prev_close. The first live run died on
       "qRows.filter is not a function". Both shapes are accepted; detect.mjs keeps its contract. */
    const qRaw = quotes && (quotes.quotes ?? quotes.rows ?? quotes);
    const qRows = (Array.isArray(qRaw) ? qRaw
      : (qRaw && typeof qRaw === "object" ? Object.entries(qRaw).map(([sym, q]: any) => ({ ...(q || {}), symbol: (q && q.symbol) || sym })) : []))
      .map((q: any) => ({ ...q, prev_close: q.prev_close ?? q.previous_close })) as any[];
    let candidates = qRows.filter((q) => Number.isFinite(+q.price) && Number.isFinite(+q.prev_close) && +q.prev_close > 0);
    if (mode === "intraday") {
      const before = candidates.length;
      candidates = candidates.filter((q) => Math.abs(+q.price / +q.prev_close - 1) * 100 >= PREFILTER_PCT);
      report.notes.push("intraday prefilter: " + candidates.length + " of " + before + " names moving at least " + PREFILTER_PCT + "% examined");
    }
    /* M59 — in dilution mode the quotes are read for ONE reason (the last close a discount is
       measured against), so nothing below this line runs: no daily bars, no heartbeat, no earnings
       and no economic reads. */
    if (mode === "dilution") candidates = [];
    if (candidates.length > MAX_CANDLE_FETCH) {
      candidates = candidates.slice().sort((a, b) => Math.abs(+b.price / +b.prev_close - 1) - Math.abs(+a.price / +a.prev_close - 1)).slice(0, MAX_CANDLE_FETCH);
      report.notes.push("capped at " + MAX_CANDLE_FETCH + " daily-bar reads: the biggest movers first");
    }
    const historyBySymbol: Record<string, any[]> = {};
    await pool(candidates, CONCURRENCY, async (q: any) => {
      try {
        /* the chart API's daily bars: tf=1d&limit=N, answered under "series", t in epoch ms */
        const c = await chartGet("/candles?symbol=" + encodeURIComponent(q.symbol) + "&tf=1d&limit=" + CANDLE_DAYS);
        const bars = (c.series || c.candles || c.bars || c.rows || []) as any[];
        const dayOf = (b: any) => { const t = b.t ?? b.time ?? b.date;
          return typeof t === "number" ? new Date(t).toISOString().slice(0, 10) : String(t || "").slice(0, 10); };
        /* today's own forming bar must not be part of the history it is judged against */
        historyBySymbol[q.symbol] = bars.filter((b: any) => dayOf(b) < session);
      } catch (_) { historyBySymbol[q.symbol] = []; }
    });
    /* M52 — the usual day comes out of the store, not out of this pass. One read of
       public.ticker_heartbeat_daily for the names under examination, newest row per name within the
       last fortnight (a month-old row would be a stale divisor wearing today's label). Whatever is
       missing simply falls back to the bars, and each event says which it used. */
    const heartbeatBySymbol: Record<string, any> = {};
    try {
      if (!candidates.length) throw new Error("no names under examination");
      const since = new Date(Date.now() - 14 * 86400e3).toISOString().slice(0, 10);
      const hb = await sbGet("ticker_heartbeat_daily?ticker=in.(" +
        candidates.map((q: any) => encodeURIComponent(q.symbol)).join(",") + ")&date=gte." + since +
        "&order=ticker.asc,date.desc&select=ticker,date,usual_day_60,n&limit=5000");
      for (const r of (hb || [])) if (!(r.ticker in heartbeatBySymbol)) heartbeatBySymbol[r.ticker] = r;
      report.notes.push("usual day: " + Object.keys(heartbeatBySymbol).length + " of " + candidates.length +
        " names read from ticker_heartbeat_daily; the rest computed from bars");
    } catch (_) {
      report.notes.push("ticker_heartbeat_daily unreadable — every usual day computed from bars, as before M52");
    }
    const px = detectPriceOutliers({ quotes: candidates, historyBySymbol, session, ts: iso(now), rules: RULES, heartbeatBySymbol });
    events.push(...px.events);
    report.kinds.price_outlier = px.events.length;
    report.skipped_counts.price = countReasons(px.skipped);

    /* ── earnings: a surprise beyond the name's usual surprise ────────────────────── */
    const ernSel = "select=ticker,date,eps_actual,eps_estimate,revenue_actual,revenue_estimate";
    const todays = mode === "dilution" ? [] :
      await sbGet("earnings_events?" + ernSel + "&date=eq." + session + "&eps_actual=not.is.null&limit=400");
    let ern = { events: [] as any[], skipped: [] as any[] };
    if (todays.length) {
      const names = [...new Set(todays.map((r: any) => r.ticker))];
      const past = await sbGet("earnings_events?" + ernSel + "&ticker=in.(" + names.join(",") + ")&date=lt." + session + "&order=date.desc&limit=2000");
      const historyByTicker: Record<string, any[]> = {};
      for (const r of past) (historyByTicker[r.ticker] ||= []).push(r);
      ern = detectEarningsSurprises({ rows: todays, historyByTicker, ts: iso(now),
        minAbsZ: RULES.earnings.x_usual, minHistory: RULES.earnings.min_past_reports });
      events.push(...ern.events);
    }
    report.kinds.earnings_surprise = ern.events.length;
    report.skipped_counts.earnings = countReasons(ern.skipped);

    /* ── economic: today's prints, and what is about to print ─────────────────────── */
    const ecSel = "select=event_ts,country,event,actual,estimate,previous,impact";
    /* 24 Sep: econ_calendar.event_ts is EPOCH SECONDS (bigint). The first live run sent ISO text
       and got a 400; detect.mjs reads event_ts as a date string, so rows are converted on the way in. */
    const dayFrom = Math.floor((now.getTime() - 36 * 3600e3) / 1000), dayTo = Math.floor((now.getTime() + 36 * 3600e3) / 1000);
    const asIsoTs = (rows: any[]) => (rows || []).map((r: any) => ({ ...r,
      event_ts: typeof r.event_ts === "number" || /^\d+$/.test(String(r.event_ts)) ? new Date(Number(r.event_ts) * 1000).toISOString() : r.event_ts }));
    const ecRows = mode === "dilution" ? [] : asIsoTs(await sbGet("econ_calendar?" + ecSel + "&event_ts=gte." + dayFrom + "&event_ts=lte." + dayTo + "&order=event_ts.asc&limit=600"));
    const printed = ecRows.filter((r: any) => r.actual != null && r.estimate != null);
    const historyByEvent: Record<string, any[]> = {};
    if (printed.length) {
      const past = asIsoTs(await sbGet("econ_calendar?" + ecSel + "&event_ts=lt." + dayFrom + "&actual=not.is.null&order=event_ts.desc&limit=4000"));
      for (const r of past) (historyByEvent[econEventKey(r.country, r.event)] ||= []).push(r);
    }
    const ecS = detectEconSurprises({ rows: printed, historyByEvent, ts: iso(now),
      minAbsZ: RULES.econ.x_usual, minHistory: RULES.econ.min_past_prints });
    const ecI = detectEconImminent({ rows: ecRows, nowSec: Math.floor(now.getTime() / 1000), ts: iso(now),
      windowMin: RULES.econ.imminent_minutes });
    events.push(...ecS.events, ...ecI.events);
    report.kinds.econ_surprise = ecS.events.length;
    report.kinds.econ_imminent = ecI.events.length;
    report.skipped_counts.econ = countReasons(ecS.skipped.concat(ecI.skipped));

    /* ── M59 · DILUTION: what the company FILED ───────────────────────────────────
       Only in its own mode, because it answers a different question from "did it move today" and
       runs on its own cadence. Three steps, each bounded:
         1. EDGAR's daily form index for the last few days (rules.dilution.lookback_days). An 8-K is
            due within four business days of the event, so a short window catches the filing on the
            morning it lands without re-reading the quarter.
         2. Keep only this universe's CIKs and only the forms that can issue shares. 424B2 — the
            banks' medium-term-note shelf, thousands of them a quarter — is not in that list.
         3. Read ONLY the matching documents, and the shares outstanding for ONLY the names that
            matched, from the SEC's own XBRL cover-page figure. */
    if (mode === "dilution") {
      const D = (RULES as any).dilution || {};
      const back = Math.max(1, Math.min(7, +D.lookback_days || 3));
      const tickers = await secTickerMap(symbols);                 // ticker -> CIK, SEC's own file
      const byCik: Record<string, string> = {};
      for (const t in tickers) byCik[String(+tickers[t])] = t;
      const lines: any[] = [];
      for (let i = 0; i < back; i++) {
        const d = new Date(now.getTime() - i * 86400e3);
        const rows = await edgarDayIndex(d);
        report.notes.push("edgar " + dayKey(d) + ": " + rows.length + " filings in the index");
        for (const r of rows) {
          if (DILUTION_FORMS.indexOf(r.form) < 0) continue;
          const tic = byCik[String(+r.cik)];
          if (!tic) continue;
          lines.push({ ...r, ticker: tic });
        }
      }
      report.notes.push("dilution candidates in this universe: " + lines.length);
      const filings: any[] = [];
      await pool(lines.slice(0, MAX_FILING_READS), 3, async (r: any) => {
        try {
          const text = await secText(r.path);
          filings.push({ ticker: r.ticker, form: r.form, items: r.items || "", filed_date: r.date,
                         accession: r.acc, url: "https://www.sec.gov/Archives/" + r.path, text });
        } catch (_) { /* a document that will not load is reported as unread, never as clean */ }
      });
      report.notes.push("filings read: " + filings.length + " of " + lines.length);
      /* the market side: the last close the board already shows, and the share count from the
         SEC's own cover page — only for the names that actually filed something. */
      const marketBy: Record<string, any> = {};
      for (const f of filings) {
        const q = qRows.find((x: any) => x.symbol === f.ticker);
        marketBy[f.ticker] = { last_close: q ? +q.prev_close : null, shares_out: null, shares_out_asof: null };
      }
      await pool(Object.keys(marketBy), 3, async (tic: string) => {
        try {
          const so = await secSharesOut(tickers[tic]);
          if (so) { marketBy[tic].shares_out = so.val; marketBy[tic].shares_out_asof = so.end; }
        } catch (_) { /* no share count -> the event says so and the percentage stays null */ }
      });
      const dil = detectDilution({ filings, marketBy, ts: iso(now), rules: RULES });
      events.push(...dil.events);
      report.kinds.dilution = dil.events.length;
      report.skipped_counts.dilution = countReasons(dil.skipped);
      report.excluded = countExcluded(dil.skipped);
    }

    const { inserted } = await insert(events);
    report.detected = events.length;
    report.inserted = inserted;
    report.already_stored = events.length - inserted;
    report.ms = Date.now() - started;
    return json(report, 200);
  } catch (e) {
    report.error = String((e as Error).message || e);
    report.ms = Date.now() - started;
    return json(report, 500);
  }
});

/* ── M59 · the SEC, read politely and without a key ─────────────────────────────────────────
   The SEC asks every automated reader to identify itself in a User-Agent and to stay under ten
   requests a second. Both are honoured here. No key exists for any of this: it is a public
   government feed, and it is the ORIGINAL of what any paid provider resells. */
const SEC_UA = Deno.env.get("SEC_USER_AGENT") || "Scintilla Hub research (+https://scintillahub.ai)";
async function secGet(u: string) {
  const r = await fetch(u, { headers: { "User-Agent": SEC_UA, "Accept-Encoding": "gzip" } });
  if (!r.ok) throw new Error("sec " + r.status + " " + u.slice(0, 80));
  return r;
}
const SEC_QTR = (d: Date) => Math.floor(d.getUTCMonth() / 3) + 1;
/* EDGAR's daily index: one fixed-width file listing every filing made that day. A weekend or a
   holiday has no file, which is a 404 and simply means no filings — not an error. */
async function edgarDayIndex(d: Date) {
  const day = dayKey(d).replace(/-/g, "");
  const url = "https://www.sec.gov/Archives/edgar/daily-index/" + d.getUTCFullYear() +
    "/QTR" + SEC_QTR(d) + "/form." + day + ".idx";
  let text = "";
  try { text = await (await secGet(url)).text(); } catch (_) { return []; }
  const out: any[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^(\S[\S ]{0,11}\S)\s{2,}(.+?)\s{2,}(\d{4,10})\s+(\d{8})\s+(edgar\/data\/\S+)\s*$/);
    if (!m) continue;
    const path = m[5];
    const acc = (path.split("/").pop() || "").replace(/\.txt$/, "");
    out.push({ form: m[1].trim(), company: m[2].trim(), cik: m[3], date: m[4].replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"), path, acc });
  }
  return out;
}
/* the filing itself. The daily index points at the complete submission text file, which carries the
   8-K item numbers in its header and the document in its body — one read, not two. */
async function secText(path: string) {
  const raw = await (await secGet("https://www.sec.gov/Archives/" + path)).text();
  const items = [...raw.matchAll(/^ITEM INFORMATION:\s*(.+)$/gim)].map((x) => x[1].trim());
  const body = raw
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    /* a real filing writes "1,097,444&#160;shares": decode the numeric entities BEFORE the
       whitespace is squeezed, or the number and its unit never meet. */
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/[ \t\r\n\u00a0\u2007\u202f]+/g, " ");
  return body.slice(0, 600000) + (items.length ? " ITEM INFORMATION: " + items.join("; ") : "");
}
/* ticker -> CIK, from the SEC's own published file, narrowed to the universe we care about */
let SEC_TICKERS: Record<string, string> | null = null;
async function secTickerMap(symbols: string[]) {
  if (!SEC_TICKERS) {
    const j = await (await secGet("https://www.sec.gov/files/company_tickers.json")).json();
    const all: Record<string, string> = {};
    for (const k in j) all[String(j[k].ticker).toUpperCase()] = String(j[k].cik_str).padStart(10, "0");
    SEC_TICKERS = all;
  }
  const out: Record<string, string> = {};
  for (const s of symbols) if (SEC_TICKERS[s]) out[s] = SEC_TICKERS[s];
  return out;
}
/* the share count a percentage is measured against: the company's own cover page, as filed */
async function secSharesOut(cik: string) {
  const j = await (await secGet("https://data.sec.gov/api/xbrl/companyconcept/CIK" + cik +
    "/dei/EntityCommonStockSharesOutstanding.json")).json();
  const u = (j && j.units && j.units.shares) || [];
  if (!u.length) return null;
  const last = u.slice().sort((a: any, b: any) => String(a.end || "").localeCompare(String(b.end || "")))[u.length - 1];
  return last && last.val ? { val: +last.val, end: last.end } : null;
}
function countExcluded(skipped: any[]) {
  const out: Record<string, number> = {};
  for (const s of skipped || []) if (s.excluded_by) out[s.excluded_by] = (out[s.excluded_by] || 0) + 1;
  return out;
}
function countReasons(skipped: any[]) {
  const out: Record<string, number> = {};
  for (const s of skipped || []) out[s.reason] = (out[s.reason] || 0) + 1;
  return out;
}
function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body, null, 1), { status, headers: { "content-type": "application/json" } });
}

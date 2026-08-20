// SCINTILLA chat - provider authority closure (2026-08-20).
// Equity price, previous close, CHG and Geiger come from the Massive provider service.
// Daily provider-computed indicators come from provider_indicators_current (FMP raw).
// Legacy Supabase calculation tables are never an equity serving authority.
// verify_jwt MUST stay FALSE: the browser calls this directly and auth is the
// x-scintilla gate below, not a Supabase JWT.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-scintilla",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROVIDER_BASE = "https://scintilla-massive-chart-api.fly.dev";

const SCHEMA = `SCHEMA (tables -> key columns). You may SELECT from ANY table in this database, including ones not listed here — query information_schema.tables if you need to discover something.

CURRENT AUTHORITY:
- For EQUITY current price, previous completed daily close, CHG and Geiger, use provider_snapshot. It reads the live Massive provider service and returns named state/absence. Do not query a Supabase table as a substitute.
- provider_indicators_current(ticker,provider,timeframe,indicator,period_length,value,source_date,session_state,fetched_at,universe_hash) — current raw FMP daily indicators. Provider must be FMP and universe_hash must be 7ad595cc4db5e1fd0bb63bb3780ac1450a938e6fa068df944aeec71445556063. A current-day daily value can be FORMING; say so. Intraday FMP indicator authority is not verified and must be reported unavailable.
- market_state(id=1,et_time,et_weekday,is_holiday,equity_open) — canonical market clock for session interpretation.
- ribbon_ladder(rung,bar_hours,timeframe,ma_type,length,...) — ladder DEFINITION only; it is not a current value source.
- ribbon_series(ticker,kind 'rvol'|'mom_ob'|'mom_os',ts,val) — relative-volume + momentum severity.
- extended_bars(ticker,ts,open,high,low,close,volume) — premarket/afterhours 1-minute bars. Never substitute one of these for provider_snapshot's equity current quote.
- board_volume(ticker,rvol_at_time,cum_rvol,session_rvol) — session relative volume.
- ohlcv_freshness(ticker,tf,last_ts); view data_health(ticker,tf,age_min) — newest-bar age per ticker/tf.
- scintilla_spec(key,value jsonb) — methodology and system rules.

LEGACY / NON-AUTHORITY:
- live_quotes, composite_staged, ladder_values and board_rsi are legacy Supabase surfaces. Never use them for an equity current price, completed previous close, CHG, Geiger, RSI, Williams or moving average.
- derived_series is retired and must never be used as serving authority.

HISTORY / DERIVED:
- ohlcv_history(ticker,tf,timestamp epoch,open,high,low,close,volume,source) — tfs: 1,3,5,10,15,30,60,120,180,240,6h,12h,D,3D,W,2W,1M. This is the WORKING history.
- ohlcv_archive(ticker,tf,timestamp,...) — deep archive. NOTE (2026-07-30): all tf='1' rows were removed to reclaim storage; it now holds ONLY daily and higher (14 timeframes, 196 tickers, ~2.6M rows). Do not promise deep 1-minute history from it.
- statistics(ticker,tf,name,n,mean,std,current,zscore,percentile,stat_read) — ~30 indicators. stat_read=tanh(z/2).
- structure_state(ticker,tf,state +1 HH/HL | -1 LH/LL | 0) + structure_history.
- signals / alert_log — event tape.

FUNDAMENTALS / EVENTS:
- fundamentals_history / balance_history / cashflow_history / ratios_history / analyst_estimates / dividends / splits / insider_trades.
- fwd_eps_ntm(ticker,ntm_eps) — next-twelve-month forward EPS; the basis for the board's forward P/E.
- earnings_events(ticker,date,report_time BMO/AMC,eps_estimate,eps_actual,revenue_estimate,revenue_actual,surprise_pct,beat,release_link,release_summary,call_url) — WARNING: the transcript_url column is DEAD and always null.
- earnings_call_transcripts(ticker,call_date,...) — THE REAL TRANSCRIPTS live here. Always check this table, never earnings_events.transcript_url.
- etf_info(ticker,...) / etf_holdings(ticker,holding,weight,...) — ETF composition.

CONTEXT / UNIVERSE:
- ticker_context(ticker,narrative,business_now,catalysts,watch_notes,deep_dive,updated_ts) — CURATED dossier for the universe; the desk memory for why-is-this-moving.
- ticker_cohorts(ticker,cohort) — MULTI-cohort membership (a ticker can sit in several; e.g. an ETF in both its sector and INDEXES). Use this, not the older single-cohort view.
- tickers(ticker,type,active) / ticker_blocklist / company_profile(ticker,name,exchange,sector,industry,market_cap,avg_volume).
- hub_favorites(ticker) — the operator's starred names.

NEWS / SOCIAL / MACRO:
- news(ticker,cohort,title,snippet,site,feed,url,published_ts) — cohort column is authoritative for scoping.
- social_posts(source,sentiment) / social_sentiment(ticker,bullish,bearish,posts,score).
- econ_dashboard(topic,label,unit,cadence,last_date,value,headline) / treasury_rates / vix_term / put_call_history / sector_performance.

OPS:
- fmp_bandwidth_log(fn,calls,symbols,bytes,status,at) — measured FMP usage. Only live-quote-batch writes to it, so it is a FLOOR, not a total.
- chat_log(ts,role_tag,scope,user_msg,reply,queries,duration_ms) — this conversation's own history.

CONVENTIONS: tf/tfcode are TEXT; timestamps are epoch seconds (use to_timestamp()); z-scores and percentiles are vs each series' OWN history; SELECT only; LIMIT <= 200; statement timeout is 5s so keep queries narrow (filter by ticker and tf).`;

const REGIMEN = `REGIMEN v0.5 (the law of this desk):
1. ZOOM: the USER zooms — you never choose it. Persist their zoom for the conversation.
2. EQUITY AUTHORITY: for current equity price, previous completed daily close, CHG or Geiger, call provider_snapshot first. Never substitute live_quotes, composite_staged, ladder_values, board_rsi or derived_series. State provider timestamps and named absence.
3. INDICATORS: use provider_indicators_current for daily RSI, Williams and MA values. State source_date and FORMING versus SETTLED. If the requested timeframe or indicator is absent, say unavailable; do not compute or fall back.
4. SOURCES: provider tool first for equity market truth; database for dossiers, fundamentals, events, volume and methodology; web second and dated.
5. STRUCTURE: when discussing direction, check accepted structure/volume data, but do not claim a live multi-timeframe ladder when the provider indicator basis is unavailable.
6. NEVER: buy/sell advice, position sizing, certainty-voiced predictions.
7. STYLE: point-first, numeric, short paragraphs. Market desk voice. The operator is coding-illiterate — answer with the number and meaning, not SQL or jargon.
8. HONESTY: missing, stale, FORMING or NOT_OBSERVED data gets said plainly. Never turn missing data into zero or silently use a legacy source.
9. DOSSIER FIRST: for why-is-X-moving / story / fundamentals, read ticker_context first, then use dated web sources as needed.
10. BUDGET: up to 8 tool turns. Prefer one exact provider call and one narrow query over exploration.`;


Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("POST only", { status: 405, headers: CORS });
  const t0 = Date.now();
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not set" }), { status: 500, headers: { ...CORS, "content-type": "application/json" } });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const gateHdr = req.headers.get("x-scintilla") ?? "";
  const opGate = Deno.env.get("CHAT_GATE") ?? "";
  let roleTag = "";
  if (opGate && gateHdr === opGate) roleTag = "operator";
  else {
    const { data: gs } = await sb.from("app_settings").select("value").eq("key", "chat_gate_beta").single();
    if (gs?.value && gateHdr === gs.value) roleTag = "beta";
  }
  if (!roleTag) return new Response(JSON.stringify({ error: "gate" }), { status: 401, headers: { ...CORS, "content-type": "application/json" } });

  let body: { messages?: { role: string; content: unknown }[]; scope?: string; conversation_id?: string; action?: string };
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "bad json" }), { status: 400, headers: { ...CORS, "content-type": "application/json" } }); }

  if (body.action === "logs") {
    if (roleTag !== "operator") return new Response(JSON.stringify({ error: "operator only" }), { status: 403, headers: { ...CORS, "content-type": "application/json" } });
    const { data: rows } = await sb.from("chat_log").select("id,ts,role_tag,scope,conversation_id,user_msg,reply,duration_ms").order("id", { ascending: false }).limit(100);
    return new Response(JSON.stringify({ logs: rows ?? [] }), { headers: { ...CORS, "content-type": "application/json" } });
  }

  const history = (body.messages ?? []).slice(-40);
  if (!history.length) return new Response(JSON.stringify({ error: "no messages" }), { status: 400, headers: { ...CORS, "content-type": "application/json" } });
  const scope = (body.scope ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

  const IDENTITY = scope
    ? `You are the SCINTILLA ${scope} DESK AGENT - a specialist on ${scope} alone. Lead every answer with ${scope} data; cross-ticker context only when it explains ${scope}. For narrative/fundamentals, read ticker_context for ${scope} first; for equity levels call provider_snapshot first.`
    : `You are SCINTILLA's MASTER market-context analyst across the whole instrument universe.`;
  const SYSTEM = IDENTITY + "\n\n" + REGIMEN + "\n\n" + SCHEMA;

  const TOOLS = [
    { name: "provider_snapshot", description: "Fetch exact Massive equity current quote, previous completed daily close, CHG and provider Geiger for 1-20 symbols. This is the required equity market-truth tool.",
      input_schema: { type: "object", properties: { symbols: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 20 } }, required: ["symbols"] } },
    { name: "run_query", description: "Run ONE read-only SQL SELECT against the SCINTILLA Postgres database. Do not use legacy equity authority tables.",
      input_schema: { type: "object", properties: { sql: { type: "string", description: "A single SELECT. Use LIMIT." } }, required: ["sql"] } },
    { type: "web_search_20250305", name: "web_search", max_uses: 4 },
  ];

  const model = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";
  const queries: { sql: string; rows: number }[] = [];
  let messages: unknown[] = history;
  let finalText = "";

  for (let turn = 0; turn < 8; turn++) {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 4096, system: SYSTEM, tools: TOOLS, messages }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ error: "anthropic " + resp.status, detail: t.slice(0, 300) }), { status: 502, headers: { ...CORS, "content-type": "application/json" } });
    }
    const data = await resp.json();
    if (data.stop_reason !== "tool_use") {
      finalText = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n");
      break;
    }
    const toolResults: unknown[] = [];
    for (const block of data.content) {
      if (block.type !== "tool_use") continue;
      if (block.name === "run_query") {
        const sql = String(block.input?.sql ?? "");
        const { data: rows, error } = await sb.rpc("chat_query", { q: sql });
        const payload = error ? { error: error.message } : rows;
        const arr = Array.isArray(payload) ? payload : [];
        queries.push({ sql: sql.slice(0, 200), rows: arr.length });
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(payload).slice(0, 30000) });
        continue;
      }
      if (block.name === "provider_snapshot") {
        const raw = Array.isArray(block.input?.symbols) ? block.input.symbols : [];
        const symbols = [...new Set(raw.map((v: unknown) => String(v).trim().toUpperCase()).filter((v: string) => /^[A-Z][A-Z0-9.-]{0,9}$/.test(v)))].slice(0, 20);
        if (!symbols.length) {
          toolResults.push({ type: "tool_result", tool_use_id: block.id, is_error: true, content: JSON.stringify({ error: "NO_VALID_SYMBOLS" }) });
          continue;
        }
        try {
          const signal = AbortSignal.timeout(12000);
          const [quoteResp, geigerResp] = await Promise.all([
            fetch(PROVIDER_BASE + "/quotes?symbols=" + encodeURIComponent(symbols.join(",")), { signal }),
            fetch(PROVIDER_BASE + "/geiger", { signal }),
          ]);
          if (!quoteResp.ok || !geigerResp.ok) {
            throw new Error("provider HTTP quotes=" + quoteResp.status + " geiger=" + geigerResp.status);
          }
          const quoteJson = await quoteResp.json();
          const geigerJson = await geigerResp.json();
          const allQuotes = quoteJson?.quotes ?? {};
          const allGeiger = geigerJson?.symbols ?? {};
          const quotes = Object.fromEntries(symbols.filter((s: string) => allQuotes[s] !== undefined).map((s: string) => [s, allQuotes[s]]));
          const geiger = Object.fromEntries(symbols.filter((s: string) => allGeiger[s] !== undefined).map((s: string) => [s, allGeiger[s]]));
          const payload = {
            authority: {
              equity_quotes: "Massive provider service",
              previous_close_contract: "previous completed provider daily session only",
              geiger: "provider accepted composite",
              daily_indicators: "FMP raw via provider_indicators_current",
            },
            requested: symbols,
            quotes,
            geiger,
            quote_meta: quoteJson?.meta ?? null,
            geiger_meta: geigerJson?.meta ?? geigerJson?.metadata ?? null,
          };
          queries.push({ sql: "PROVIDER_SNAPSHOT " + symbols.join(","), rows: symbols.length });
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(payload).slice(0, 30000) });
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          queries.push({ sql: "PROVIDER_SNAPSHOT_ERROR " + symbols.join(","), rows: 0 });
          toolResults.push({ type: "tool_result", tool_use_id: block.id, is_error: true, content: JSON.stringify({ error: "PROVIDER_UNAVAILABLE", detail }) });
        }
      }
    }
    if (!toolResults.length) { messages = [...messages, { role: "assistant", content: data.content }]; continue; }
    messages = [...messages, { role: "assistant", content: data.content }, { role: "user", content: toolResults }];
  }
  if (!finalText) return new Response(JSON.stringify({ error: "too many tool turns" }), { status: 500, headers: { ...CORS, "content-type": "application/json" } });

  try {
    const lastUser = history[history.length - 1];
    await sb.from("chat_log").insert({
      ts: Math.floor(Date.now() / 1000), role_tag: roleTag, scope,
      conversation_id: (body.conversation_id ?? "").slice(0, 40),
      user_msg: String(typeof lastUser?.content === "string" ? lastUser.content : JSON.stringify(lastUser?.content)).slice(0, 2000),
      reply: finalText.slice(0, 4000), queries, duration_ms: Date.now() - t0,
    });
  } catch (_e) {}

  return new Response(JSON.stringify({ reply: finalText, queries, role: roleTag, scope }), { headers: { ...CORS, "content-type": "application/json" } });
});

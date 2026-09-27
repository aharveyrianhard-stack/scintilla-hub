/* D1 · the live reads every mockup on this page shares. READ-ONLY: GET requests only, nothing is written.
   Prices, candles and the Geiger come from the chart API (the Hub's own source). Lists, usual day, profiles,
   fundamentals, scintillas, earnings and the economic calendar come from the same Supabase tables the Hub reads.
   The public read key is discovered at run time from the Hub page, exactly as the knockout workshop does; this file
   stores no key. On a local preview the chart API is reached through /__chart (tools/serve.mjs adds the one origin
   the API accepts). */
(function () {
  "use strict";
  const SB = "https://wadinxqplrggagkvrdag.supabase.co";
  const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);
  const API = LOCAL ? "/__chart" : "https://scintilla-massive-chart-api.fly.dev";
  const stats = { reads: 0, failed: 0, bytes: 0, log: [] };
  let KEY = null, keyP = null;
  function note(path, ok, ms, n) {
    stats.reads++; if (!ok) stats.failed++; stats.bytes += n || 0;
    stats.log.unshift({ path: path.split("?")[0], ok, ms: Math.round(ms), at: new Date().toISOString().slice(11, 19) });
    stats.log.length = Math.min(stats.log.length, 40);
    document.dispatchEvent(new CustomEvent("d1:read"));
  }
  function readKey() {
    if (KEY) return Promise.resolve(KEY);
    return keyP || (keyP = (async () => {
      if (window.SC_ANON_KEY) return (KEY = window.SC_ANON_KEY);
      for (const page of ["/pip.html", "/index.html"]) {
        try {
          const t = await (await fetch(page, { cache: "no-store" })).text();
          const m = t.match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_.\-]+/);
          if (m) return (KEY = m[0]);
        } catch (_) {}
      }
      throw new Error("no read key on this site");
    })());
  }
  async function pg(path) {
    const k = await readKey(); const t0 = performance.now();
    try {
      const r = await fetch(SB + "/rest/v1/" + path, { headers: { apikey: k, Authorization: "Bearer " + k } });
      if (!r.ok) throw new Error(path.split("?")[0] + " → " + r.status);
      const txt = await r.text(); note(path, true, performance.now() - t0, txt.length); return JSON.parse(txt);
    } catch (e) { note(path, false, performance.now() - t0); throw e; }
  }
  async function api(path) {
    const t0 = performance.now();
    try {
      const r = await fetch(API + path, { cache: "no-store" });
      if (!r.ok) throw new Error(path.split("?")[0] + " → " + r.status);
      const txt = await r.text(); note("api" + path, true, performance.now() - t0, txt.length); return JSON.parse(txt);
    } catch (e) { note("api" + path, false, performance.now() - t0); throw e; }
  }
  const inList = (a) => "(" + a.map(encodeURIComponent).join(",") + ")";
  const chunks = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
  const isoDay = (d) => d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const today = () => isoDay(new Date());
  const addDays = (iso, n) => new Date(Date.parse(iso + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);

  /* lists */
  async function favorites() { return (await pg("hub_favorites?select=ticker")).map((r) => r.ticker); }
  let COH = null;
  async function cohorts() {
    if (COH) return COH;
    const rows = await pg("cohorts?select=ticker,cohort&limit=5000"); COH = {};
    for (const r of rows) (COH[r.cohort] ||= []).push(r.ticker);
    return COH;
  }
  /* prices */
  async function quotes(syms) {
    const out = {};
    for (const c of chunks(syms, 400)) {
      const j = await api("/quotes?symbols=" + encodeURIComponent(c.join(",")));
      for (const [t, q] of Object.entries(j.quotes || {})) out[t] = { price: q.price, chg: q.change_pct, prev: q.previous_close, fresh: q.price_freshness, state: q.state, session: q.price_session_et };
    }
    return out;
  }
  let GALL = null;
  async function geigerAll() {
    const j = await api("/geiger"); const m = {};
    for (const [t, s] of Object.entries(j.symbols || {})) m[t] = { g: s.composite, tr: s.trend, mo: s.momentum };
    GALL = { at: j.computed_utc, receipt: j.equalizer_receipt_sha256, rungs: j.participating_rungs, absent: j.families_deliberately_absent, by: m };
    return GALL;
  }
  const RUNG_ORDER = ["2h", "3h", "4h", "6h", "12h", "1d", "3d", "1w"];
  const RUNG_LBL = { "2h": "2H", "3h": "3H", "4h": "4H", "6h": "6H", "12h": "12H", "1d": "D", "3d": "3D", "1w": "W" };
  async function geigerDetail(syms) {
    const out = {};
    await Promise.all(chunks(syms, 24).map(async (c) => {
      try {
        const j = await api("/geiger?symbols=" + encodeURIComponent(c.join(",")) + "&detail=1");
        for (const [t, s] of Object.entries(j.symbols || {})) out[t] = { g: s.composite, tr: s.trend, mo: s.momentum, at: j.computed_utc, receipt: j.equalizer_receipt_sha256, absent: j.families_deliberately_absent,
          rungs: RUNG_ORDER.filter((k) => s.rungs && s.rungs[k]).map((k) => { const r = s.rungs[k]; return { k, lbl: RUNG_LBL[k], w: r.eq_weight, tfc: r.tf_composite, tr: r.trend_signed, mo: r.momentum_signed, rsi: r.rsi14, wr: r.williams14, bars: r.bars_used, newest: r.newest }; }) };
      } catch (_) {}
    }));
    return out;
  }
  async function usual(syms) {
    const since = addDays(today(), -12), m = {};
    await Promise.all(chunks(syms, 40).map(async (c) => {
      const rows = await pg("ticker_heartbeat_daily?ticker=in." + inList(c) + "&date=gte." + since + "&order=ticker.asc,date.desc&select=ticker,date,usual_day_20,usual_day_60,usual_day_250,atr_pct_14,n").catch(() => []);
      for (const r of rows) if (!(r.ticker in m)) m[r.ticker] = r;
    }));
    return m;
  }
  async function profiles(syms) {
    const m = {};
    await Promise.all(chunks(syms, 60).map(async (c) => {
      const rows = await pg("company_profile?ticker=in." + inList(c) + "&select=ticker,name,exchange,sector,industry,market_cap,is_etf,updated_ts").catch(() => []);
      for (const r of rows) m[r.ticker] = r;
    }));
    return m;
  }
  async function fundamentals(syms) {
    const m = {};
    await Promise.all(chunks(syms, 60).map(async (c) => {
      const [f, e] = await Promise.all([
        pg("fundamentals?ticker=in." + inList(c) + "&select=ticker,trailing_pe,adjusted_pe,eps_ttm,revenue_ttm,market_cap,price,updated_ts").catch(() => []),
        pg("fwd_eps_ntm?ticker=in." + inList(c) + "&select=ticker,ntm_eps,updated_ts").catch(() => [])]);
      for (const r of f) m[r.ticker] = Object.assign(m[r.ticker] || {}, r);
      for (const r of e) (m[r.ticker] ||= {}).ntm_eps = r.ntm_eps;
    }));
    return m;
  }
  async function marketState() { try { const r = await pg("market_state?id=eq.1&select=equity_session,equity_open"); return r[0] || null; } catch (_) { return null; } }

  /* THE TAPE: scintillas of the last two sessions, earnings in the next N days (names the Hub tracks), US economic
     releases of medium or high impact in the next three days. One list, ordered by time. */
  async function tape(opts) {
    const days = (opts && opts.days) || 14; const t0 = today();
    const coh = await cohorts(); const universe = new Set(Object.values(coh).flat());
    const nowS = Math.floor(Date.now() / 1000);
    const [sc, er, ec] = await Promise.all([
      pg("scintillas?select=ts,kind,subject,subject_kind,direction,magnitude,source,detail&order=ts.desc&limit=120").catch(() => []),
      pg("earnings_events?select=ticker,date,report_time,eps_estimate&date=gte." + t0 + "&date=lte." + addDays(t0, days) + "&superseded_at=is.null&order=date.asc&limit=400").catch(() => []),
      pg("econ_calendar?select=event_ts,country,event,impact,estimate,previous&country=eq.US&impact=in.(High,Medium)&event_ts=gte." + nowS + "&event_ts=lte." + (nowS + 3 * 86400) + "&order=event_ts.asc&limit=40").catch(() => [])]);
    const newestSession = sc.length ? sc[0].ts.slice(0, 10) : null;
    const items = [];
    const seen = new Set();
    for (const s of sc) {
      if (newestSession && s.ts.slice(0, 10) < addDays(newestSession, -3)) continue;
      /* "about to print" belongs on the tape only in its own 15 minutes; after that the release itself is the item */
      if (s.kind === "econ_imminent" && Date.now() - Date.parse(s.ts) > 15 * 60e3) continue;
      const k = s.kind + "|" + s.subject + "|" + s.ts.slice(0, 10); if (seen.has(k)) continue; seen.add(k);
      items.push({ type: "scint", at: Date.parse(s.ts), ticker: s.subject_kind === "ticker" ? s.subject : null, subject: s.subject, kind: s.kind, dir: s.direction, mag: s.magnitude, detail: s.detail });
    }
    for (const e of er) if (universe.has(e.ticker)) items.push({ type: "earn", at: Date.parse(e.date + "T" + (e.report_time === "BMO" ? "12:00" : "21:00") + ":00Z"), ticker: e.ticker, date: e.date, when: e.report_time, est: e.eps_estimate });
    for (const x of ec) items.push({ type: "econ", at: x.event_ts * 1000, subject: x.event, impact: x.impact, est: x.estimate, prev: x.previous });
    const sAll = items.filter((i) => i.type === "scint").sort((a, b) => b.at - a.at);
    const rest = items.filter((i) => i.type !== "scint").sort((a, b) => a.at - b.at);
    return { items: sAll.concat(rest), counts: { scint: sAll.length, earn: rest.filter((i) => i.type === "earn").length, econ: rest.filter((i) => i.type === "econ").length }, newestSession, days };
  }
  async function candles(sym, tf, limit) {
    const j = await api("/candles?symbol=" + encodeURIComponent(sym) + "&tf=" + encodeURIComponent(tf) + "&limit=" + (limit || 240));
    return { bars: (j.series || []).map((b) => ({ t: b.t, c: b.c, o: b.o, h: b.h, l: b.l })), newest: j.newest, display: j.display };
  }
  async function quarters(t) {
    const [fh, rh] = await Promise.all([
      pg("fundamentals_history?ticker=eq." + encodeURIComponent(t) + "&period=neq.FY&select=fiscal_date,period,revenue,net_income,eps_diluted&order=fiscal_date.desc&limit=12").catch(() => []),
      pg("ratios_history?ticker=eq." + encodeURIComponent(t) + "&period=neq.FY&select=fiscal_date,gross_margin,net_margin,pe&order=fiscal_date.desc&limit=1").catch(() => [])]);
    return { q: fh.reverse(), ratio: rh[0] || null };
  }
  async function targets(t) { try { return (await pg("price_target_consensus?ticker=eq." + encodeURIComponent(t) + "&select=target_high,target_low,target_avg,target_median,updated_ts"))[0] || null; } catch (_) { return null; } }
  async function nextEarnings(t) { try { return (await pg("earnings_events?ticker=eq." + encodeURIComponent(t) + "&date=gte." + today() + "&superseded_at=is.null&select=date,report_time,eps_estimate,revenue_estimate&order=date.asc&limit=1"))[0] || null; } catch (_) { return null; } }

  /* the Hub's own READ rule, copied verbatim (index.html scinRead) — a label on two stored numbers, not a new signal */
  function read(T, M) {
    if (T == null || !isFinite(T)) return "—";
    if (M == null || !isFinite(M)) return "trend only";
    if (T >= 0.5 && M >= 0.4) return "aligned bull";
    if (T <= -0.5 && M <= -0.4) return "aligned bear";
    if (T >= 0.4 && M <= -0.15) return "pullback";
    if (T <= -0.2 && M >= 0.35) return "turning up";
    if (Math.abs(T) < 0.25 && M >= 0.5) return "mom leads";
    if (T >= 0.5 && Math.abs(M) < 0.2) return "stalling";
    if (T >= 0.3 && M >= 0) return "constructive";
    if (T <= -0.3 && M <= 0) return "broken";
    return "mixed";
  }
  /* formatting — negatives in (parens), the Hub's canon */
  const num = (v) => (v == null || v === "" || !isFinite(+v) ? null : +v);
  function pct(v, d) { v = num(v); if (v == null) return "—"; const s = Math.abs(v).toFixed(d == null ? 2 : d) + "%"; return v < 0 ? "(" + s + ")" : "+" + s; }
  function signed(v, d) { v = num(v); if (v == null) return "—"; return (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(d == null ? 2 : d); }
  function price(v) { v = num(v); if (v == null) return "—"; return v.toLocaleString("en-US", { minimumFractionDigits: v < 10 ? 2 : 2, maximumFractionDigits: 2 }); }
  function cap(v) { v = num(v); if (v == null || v <= 0) return "—"; const u = v >= 1e12 ? [v / 1e12, "T"] : v >= 1e9 ? [v / 1e9, "B"] : v >= 1e6 ? [v / 1e6, "M"] : [v, ""]; return "$" + (u[0] < 100 ? u[0].toFixed(1) : Math.round(u[0])) + u[1]; }
  const dirCls = (v) => (num(v) == null ? "flat" : v > 0 ? "up" : v < 0 ? "dn" : "flat");
  function sbar(v, cls) {           // signed bar −1…+1
    v = num(v); if (v == null) return '<div class="sb ' + (cls || "") + '"></div>';
    const x = Math.max(-1, Math.min(1, v)), w = Math.abs(x) * 50, l = x >= 0 ? 50 : 50 - w;
    return '<div class="sb ' + (cls || "") + '"><i style="left:' + l + "%;width:" + w + "%;background:" + (x >= 0 ? "var(--bull)" : "var(--bear)") + ';opacity:' + (0.45 + Math.abs(x) * 0.55).toFixed(2) + '"></i></div>';
  }
  function rungCells(rungs) {
    if (!rungs || !rungs.length) return '<div class="rungs"></div>';
    return '<div class="rungs" title="' + rungs.map((r) => r.lbl + " " + signed(r.tfc)).join(" · ") + '">' + rungs.map((r) => { const v = num(r.tfc) || 0;
      return '<i style="background:' + (v >= 0 ? "var(--bull)" : "var(--bear)") + ";opacity:" + (0.12 + Math.min(1, Math.abs(v)) * 0.8).toFixed(2) + '"></i>'; }).join("") + "</div>";
  }
  function spark(vals, w, h, up) {
    const v = vals.filter((x) => x != null); if (v.length < 2) return "";
    const lo = Math.min(...v), hi = Math.max(...v), sp = hi - lo || 1;
    const pts = v.map((x, i) => (i / (v.length - 1) * w).toFixed(1) + "," + (h - 1 - (x - lo) / sp * (h - 2)).toFixed(1)).join(" ");
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '" aria-hidden="true"><polyline fill="none" stroke="' + (up ? "var(--bull)" : "var(--bear)") + '" stroke-width="1.2" points="' + pts + '"/></svg>';
  }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function ago(ms) { const d = (Date.now() - ms) / 1000; if (d < 0) { const f = -d; return f < 3600 ? "in " + Math.round(f / 60) + "m" : f < 86400 ? "in " + Math.round(f / 3600) + "h" : "in " + Math.round(f / 86400) + "d"; } return d < 3600 ? Math.round(d / 60) + "m ago" : d < 86400 ? Math.round(d / 3600) + "h ago" : Math.round(d / 86400) + "d ago"; }
  const dayName = (ms) => new Date(ms).toLocaleDateString("en-US", { weekday: "short", timeZone: "America/New_York" }).toUpperCase();
  const hhmm = (ms) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" });

  window.D1 = { pg, api, readKey, favorites, cohorts, quotes, geigerAll, geigerDetail, usual, profiles, fundamentals, marketState, tape, candles, quarters, targets, nextEarnings,
    read, num, pct, signed, price, cap, dirCls, sbar, rungCells, spark, esc, ago, dayName, hhmm, today, addDays, stats, LOCAL, API };
})();

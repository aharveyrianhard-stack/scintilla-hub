// SCINTILLA · catalyst-odds v1 — store what the public prediction markets say, over time.
//
// WHY THIS EXISTS. Alan: "its a news driven market how do we parametrize that - polymarket
// kalshi" and "I would start with catalysts". A probability you read once is a number; the
// same probability read four times a day is a LINE, and a line is the thing you can put on a
// chart beside the market and argue with. Every pass appends; nothing is ever updated in place.
//
// NO KEYS. Both venues serve this data publicly: Polymarket's gamma-api and Kalshi's
// trade-api v2. The only secret it uses is the function's own service role, to write its rows.
//
// THE TWO MISTAKES THIS CODE IS BUILT NOT TO REPEAT (both measured by hand on 24 Sep before
// this was written, which is why the resolver looks fussy):
//   1. A bare search for "cpi" returned BRAZIL's inflation market.
//   2. A bare search for "senate midterms" returned the HOUSE event.
// So every catalyst carries an exact slug where one exists, and a required word that the
// event's own title/slug must contain. A market that cannot be resolved is REPORTED, never
// guessed at and never quietly dropped.

const SB = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PM = "https://gamma-api.polymarket.com";
const KS = "https://api.elections.kalshi.com/trade-api/v2";

export type Spec = { catalyst: string; slug?: string; search?: string; require?: string; series?: string };
export const SPECS: Spec[] = [
  { catalyst: "fomc",            search: "fed decision next meeting", require: "fed",      series: "KXFEDDECISION" },
  { catalyst: "cpi",             search: "us inflation 2026",         require: "u.s.",     series: "KXCPIYOY" },
  { catalyst: "recession",       search: "us recession",              require: "us ",      series: "KXRECSSNBER" },
  { catalyst: "midterms_house",  slug: "which-party-will-win-the-house-in-2026",  require: "house" },
  { catalyst: "midterms_senate", slug: "which-party-will-win-the-senate-in-2026", require: "senate" },
  { catalyst: "shutdown",        search: "government shutdown",       require: "shutdown", series: "KXGOVSHUTDOWN" },
];

/** the required word must appear in the event's own title or slug — this is the Brazil/Senate guard */
export function eventMatches(ev: any, require?: string): boolean {
  if (!require) return true;
  const blob = String((ev?.title || "") + " " + (ev?.slug || "")).toLowerCase().replace(/-/g, " ");
  return blob.includes(require.trim());
}
/** of the events that match and are still open, the one with the most money behind it */
export function pickEvent(events: any[], require: string | undefined, now: Date): any | null {
  let best: any = null, bestVol = -1;
  for (const ev of events || []) {
    if (ev?.closed) continue;
    if (!eventMatches(ev, require)) continue;
    const end = Date.parse(ev?.endDate || "");
    if (isFinite(end) && end <= now.getTime()) continue;
    const vol = Number(ev?.volume || 0);
    if (vol > bestVol) { best = ev; bestVol = vol; }
  }
  return best;
}
/** Polymarket keeps outcomes and prices as JSON STRINGS inside the market object */
export function rowsFromPolymarket(ev: any, catalyst: string, run_id: string) {
  const out: any[] = [];
  for (const m of ev?.markets || []) {
    if (m?.closed) continue;
    let outs: string[] = [], prices: string[] = [];
    try { outs = JSON.parse(m.outcomes || "[]"); prices = JSON.parse(m.outcomePrices || "[]"); } catch { continue; }
    for (let i = 0; i < outs.length && i < prices.length; i++) {
      if (outs.length === 2 && String(outs[i]).toLowerCase() === "no") continue;   // the YES leg carries it
      const p = Number(prices[i]);
      if (!isFinite(p) || p < 0 || p > 1) continue;
      out.push({ source: "polymarket", catalyst, market: m.slug || ev.slug,
        question: String(m.question || ev.title || "").slice(0, 300), outcome: String(outs[i]),
        probability: Number(p.toFixed(4)), volume: Number(m.volumeNum || 0),
        end_date: m.endDate || ev.endDate || null, run_id });
    }
  }
  return out;
}
/** Kalshi v2 prices are dollar STRINGS; a market with no trade and no two-sided quote has no price */
export function rowsFromKalshi(markets: any[], catalyst: string, run_id: string, top = 4) {
  const num = (v: any) => { const n = Number(v); return isFinite(n) && n > 0 ? n : null; };
  const scored: any[] = [];
  for (const m of markets || []) {
    let p = num(m.last_price_dollars);
    if (p === null) {
      const yb = num(m.yes_bid_dollars), ya = num(m.yes_ask_dollars);
      if (yb !== null && ya !== null) p = (yb + ya) / 2;
    }
    if (p === null || p > 1) continue;
    scored.push({ oi: Number(m.open_interest_fp || m.open_interest || 0), row: {
      source: "kalshi", catalyst, market: m.ticker,
      question: String(m.title || "").slice(0, 300), outcome: String(m.yes_sub_title || "YES"),
      probability: Number(p.toFixed(4)), volume: Number(m.open_interest_fp || m.open_interest || 0),
      end_date: m.close_time || null, run_id } });
  }
  return scored.sort((a, b) => b.oi - a.oi).slice(0, top).map((s) => s.row);
}

async function j(url: string) {
  const r = await fetch(url, { headers: { "User-Agent": "scintilla-catalyst-odds/1.0" } });
  if (!r.ok) throw new Error("HTTP_" + r.status + " " + url.split("?")[0]);
  return await r.json();
}

Deno.serve(async () => {
  const run_id = "catalyst-odds-" + new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
  const now = new Date();
  const rows: any[] = [], problems: any[] = [];
  for (const s of SPECS) {
    try {
      const events = s.slug ? await j(`${PM}/events?slug=${s.slug}`)
                            : ((await j(`${PM}/public-search?limit_per_type=12&q=${encodeURIComponent(s.search!)}`))?.events || []);
      const ev = pickEvent(Array.isArray(events) ? events : [], s.require, now);
      if (ev) rows.push(...rowsFromPolymarket(ev, s.catalyst, run_id));
      else problems.push({ catalyst: s.catalyst, source: "polymarket", reason: "NO_OPEN_EVENT_MATCHED" });
    } catch (e) { problems.push({ catalyst: s.catalyst, source: "polymarket", reason: String(e).slice(0, 120) }); }
    if (s.series) {
      try {
        const k = await j(`${KS}/markets?series_ticker=${s.series}&limit=200&status=open`);
        const got = rowsFromKalshi(k?.markets || [], s.catalyst, run_id);
        if (got.length) rows.push(...got);
        else problems.push({ catalyst: s.catalyst, source: "kalshi", reason: "NO_PRICED_MARKET" });
      } catch (e) { problems.push({ catalyst: s.catalyst, source: "kalshi", reason: String(e).slice(0, 120) }); }
    }
  }
  let written = 0, write_error: string | null = null;
  if (rows.length) {
    const r = await fetch(`${SB}/rest/v1/catalyst_odds`, { method: "POST",
      headers: { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(rows) });
    if (r.ok) written = rows.length; else write_error = "HTTP_" + r.status + " " + (await r.text()).slice(0, 200);
  }
  return new Response(JSON.stringify({ run_id, read: rows.length, written, problems, write_error }, null, 1),
    { status: write_error ? 500 : 200, headers: { "Content-Type": "application/json" } });
});

// SCINTILLA · prediction-markets — the pure part of the collector (no network, no Deno globals), so
// node --test can load it directly. index.ts does the fetching and writing.
//
// ONE ROW = one outcome of one market on one venue at one read. A row is written only when the
// probability moved (>= change_threshold) since the last stored row, or when the last stored row is
// older than heartbeat_hours — so a quiet market costs a few rows a day, not 54, and the history
// line is still exact (it is a step line: the value holds until the next row).

export type Venue = "polymarket" | "kalshi";
export type Align = { key: string; label: string; kalshi?: string; polymarket?: string };
export type Topic = {
  id: string; group: string; label: string; plain: string; same_question: boolean;
  kalshi?: { events: string[] }; polymarket?: { events: string[] }; align?: Align[];
};
export type Limits = { max_outcomes_per_event: number; min_probability: number; heartbeat_hours: number; change_threshold: number };
export type Row = {
  topic: string; venue: Venue; event_id: string; market_id: string; outcome: string; align_key: string | null;
  question: string | null; probability: number; bid: number | null; ask: number | null;
  volume: number | null; volume_24h: number | null; open_interest: number | null; end_date: string | null;
};
export type Prior = { probability: number; ts: string };

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
};
const p4 = (n: number) => Number(n.toFixed(4));

/** which aligned row (if any) a venue's outcome label belongs to */
export function alignKey(align: Align[] | undefined, venue: Venue, label: string): string | null {
  for (const a of align || []) {
    const pat = a[venue];
    if (pat && new RegExp(pat).test(label)) return a.key;
  }
  return null;
}

/** Polymarket keeps outcomes and prices as JSON strings. Every market in an event is its own Yes/No
 *  question; the Yes leg carries it. Placeholder markets ("Party A") have no price and are skipped. */
export function polymarketYes(m: any): { label: string; p: number } | null {
  if (!m || m.closed) return null;
  let outs: string[] = [], prices: string[] = [];
  try { outs = JSON.parse(m.outcomes || "[]"); prices = JSON.parse(m.outcomePrices || "[]"); } catch { return null; }
  if (!outs.length || !prices.length) return null;
  const i = outs.findIndex((o) => String(o).toLowerCase() === "yes");
  const p = num(prices[i >= 0 ? i : 0]);
  if (p === null || p < 0 || p > 1) return null;
  return { label: String(m.groupItemTitle || m.question || outs[i >= 0 ? i : 0]).trim(), p };
}

/** Kalshi v2 prices are dollar strings. The last trade goes stale on thin ladders (it can sit at a
 *  price the book left days ago), so a tight two-sided quote wins: midpoint when bid and ask are both
 *  there and no more than 10 cents apart, else the last trade, else nothing. */
export function kalshiPrice(m: any): number | null {
  const bid = num(m?.yes_bid_dollars), ask = num(m?.yes_ask_dollars), last = num(m?.last_price_dollars);
  if (bid !== null && ask !== null && bid > 0 && ask > 0 && ask >= bid && ask - bid <= 0.10) return p4((bid + ask) / 2);
  if (last !== null && last > 0 && last <= 1) return p4(last);
  return null;
}

/** keep what is worth a line: every aligned outcome, plus anything at or above min_probability,
 *  most-traded first, capped per event */
export function trim(rows: Row[], limits: Limits): Row[] {
  const keep = rows.filter((r) => r.align_key !== null || r.probability >= limits.min_probability);
  keep.sort((a, b) => (Number(b.align_key !== null) - Number(a.align_key !== null)) || ((b.volume || 0) - (a.volume || 0)));
  return keep.slice(0, limits.max_outcomes_per_event);
}

export function rowsFromPolymarketEvent(ev: any, topic: Topic, oi: Map<string, number>, limits: Limits): Row[] {
  const out: Row[] = [];
  for (const m of ev?.markets || []) {
    const y = polymarketYes(m);
    if (!y) continue;
    out.push({
      topic: topic.id, venue: "polymarket", event_id: String(ev.id), market_id: String(m.id), outcome: y.label,
      align_key: alignKey(topic.align, "polymarket", y.label),
      question: String(m.question || ev.title || "").slice(0, 300), probability: p4(y.p),
      bid: num(m.bestBid), ask: num(m.bestAsk), volume: num(m.volumeNum), volume_24h: num(m.volume24hr),
      open_interest: oi.has(m.conditionId) ? p4(oi.get(m.conditionId)!) : null, end_date: m.endDate || ev.endDate || null,
    });
  }
  return trim(out, limits);
}

export function rowsFromKalshiMarkets(eventTicker: string, markets: any[], topic: Topic, limits: Limits): Row[] {
  const out: Row[] = [];
  for (const m of markets || []) {
    if (m?.status && !["active", "open"].includes(String(m.status))) continue;
    const p = kalshiPrice(m);
    if (p === null) continue;
    const label = String(m.yes_sub_title || m.title || "Yes").trim();
    out.push({
      topic: topic.id, venue: "kalshi", event_id: eventTicker, market_id: String(m.ticker), outcome: label,
      align_key: alignKey(topic.align, "kalshi", label), question: String(m.title || "").slice(0, 300), probability: p,
      bid: num(m.yes_bid_dollars), ask: num(m.yes_ask_dollars), volume: num(m.volume_fp ?? m.volume),
      volume_24h: num(m.volume_24h_fp ?? m.volume_24h), open_interest: num(m.open_interest_fp ?? m.open_interest),
      end_date: m.close_time || null,
    });
  }
  return trim(out, limits);
}

/** Polymarket's most-traded open events in the last 24 h, sports and games left out; one row per
 *  event: its most-traded market's Yes price */
export function polymarketDiscovery(events: any[], excludeTags: string[], n: number): Row[] {
  const ex = new Set(excludeTags.map((t) => t.toLowerCase()));
  const out: Row[] = [];
  for (const ev of events || []) {
    if (out.length >= n) break;
    if ((ev?.tags || []).some((t: any) => ex.has(String(t?.label || "").toLowerCase()))) continue;
    const ms = (ev?.markets || []).filter((m: any) => polymarketYes(m));
    if (!ms.length) continue;
    ms.sort((a: any, b: any) => (num(b.volume24hr) || 0) - (num(a.volume24hr) || 0));
    const m = ms[0], y = polymarketYes(m)!;
    out.push({ topic: "discover", venue: "polymarket", event_id: String(ev.id), market_id: String(m.id),
      outcome: y.label, align_key: null, question: String(ev.title || "").slice(0, 300), probability: p4(y.p),
      bid: num(m.bestBid), ask: num(m.bestAsk), volume: num(ev.volume), volume_24h: num(ev.volume24hr),
      open_interest: null, end_date: ev.endDate || null });
  }
  return out;
}

/** Kalshi has no "sort by activity" on events, so discovery ranks the open events the caller paged
 *  through by their summed 24 h volume */
export function kalshiDiscovery(events: any[], excludeCategories: string[], n: number): Row[] {
  const ex = new Set(excludeCategories);
  const scored: { v: number; row: Row }[] = [];
  for (const ev of events || []) {
    if (ex.has(ev?.category)) continue;
    const ms = (ev?.markets || []).filter((m: any) => kalshiPrice(m) !== null);
    if (!ms.length) continue;
    const v = ms.reduce((s: number, m: any) => s + (num(m.volume_24h_fp) || 0), 0);
    ms.sort((a: any, b: any) => (num(b.volume_24h_fp) || 0) - (num(a.volume_24h_fp) || 0));
    const m = ms[0];
    scored.push({ v, row: { topic: "discover", venue: "kalshi", event_id: String(ev.event_ticker), market_id: String(m.ticker),
      outcome: String(m.yes_sub_title || "Yes"), align_key: null, question: String(ev.title || "").slice(0, 300),
      probability: kalshiPrice(m)!, bid: num(m.yes_bid_dollars), ask: num(m.yes_ask_dollars),
      volume: ms.reduce((s: number, x: any) => s + (num(x.volume_fp) || 0), 0), volume_24h: v,
      open_interest: ms.reduce((s: number, x: any) => s + (num(x.open_interest_fp) || 0), 0), end_date: m.close_time || null } });
  }
  return scored.sort((a, b) => b.v - a.v).slice(0, n).map((s) => s.row);
}

export const priorKey = (r: { venue: string; market_id: string; outcome: string }) => `${r.venue}|${r.market_id}|${r.outcome}`;

/** the change-only rule: first sighting, a real move, or a heartbeat so every live line has a point
 *  at least every heartbeat_hours */
export function toWrite(rows: Row[], prior: Map<string, Prior>, now: Date, limits: Limits): { rows: (Row & { kind: string })[]; unchanged: number } {
  const out: (Row & { kind: string })[] = [];
  let unchanged = 0;
  for (const r of rows) {
    const p = prior.get(priorKey(r));
    if (!p) { out.push({ ...r, kind: "first" }); continue; }
    if (Math.abs(r.probability - Number(p.probability)) >= limits.change_threshold - 1e-9) { out.push({ ...r, kind: "change" }); continue; }
    if (now.getTime() - Date.parse(p.ts) >= limits.heartbeat_hours * 3600e3) { out.push({ ...r, kind: "heartbeat" }); continue; }
    unchanged++;
  }
  return { rows: out, unchanged };
}

/** "US hours" = New York weekday 08:00–17:59 (econ releases at 08:30 through the close and a bit);
 *  the cron guard in 20260928_prediction_markets_cron.sql is the same rule written in SQL */
export function isUsHours(d: Date): boolean {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(d);
  const wd = parts.find((p) => p.type === "weekday")!.value, hr = Number(parts.find((p) => p.type === "hour")!.value);
  return !["Sat", "Sun"].includes(wd) && hr >= 8 && hr <= 17;
}

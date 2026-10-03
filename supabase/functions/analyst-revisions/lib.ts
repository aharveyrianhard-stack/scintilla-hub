// SCINTILLA · analyst-revisions — the pure part (no network, no keys). Tested by tests/r2-revisions-20261002.test.mjs.
//
// FMP shapes (measured by R1, 2 Oct 2026 — deliverables/20261002/research-sources/raw/probe-1-fmp-massive-sec.json):
//   price-target-news / price-target-latest-news:
//     symbol, publishedDate, newsURL, newsTitle, analystName, priceTarget, adjPriceTarget, priceWhenPosted, newsPublisher, analystCompany
//   grades-news / grades-latest-news:
//     symbol, publishedDate, newsURL, newsTitle, newGrade, previousGrade, gradingCompany, action (upgrade / downgrade / hold / initialise), priceWhenPosted
//   price-target-summary:
//     symbol, lastMonthCount, lastMonthAvgPriceTarget, lastQuarterCount, lastQuarterAvgPriceTarget, lastYearCount, lastYearAvgPriceTarget,
//     allTimeCount, allTimeAvgPriceTarget, publishers

export type Kind = "TARGET" | "GRADE";
export type NewsRow = {
  ticker: string; published_utc: string; kind: Kind; firm: string; analyst: string | null;
  target: number | null; adj_target: number | null; prior_grade: string | null; new_grade: string | null;
  action: string | null; price_when_posted: number | null; title: string | null; url: string | null;
};
export type SummaryRow = {
  ticker: string; as_of_date: string;
  last_month_count: number | null; last_month_avg: number | null;
  last_quarter_count: number | null; last_quarter_avg: number | null;
  last_year_count: number | null; last_year_avg: number | null;
  all_time_count: number | null; all_time_avg: number | null;
};

export const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const txt = (v: unknown): string | null => {
  const s = v == null ? "" : String(v).trim();
  return s ? s : null;
};

/** FMP publishedDate → ISO UTC. FMP sends "2026-10-02T08:37:00.000Z"; a bare "2026-10-02 08:37:00" is read as UTC. */
export function isoUtc(v: unknown): string | null {
  const s = txt(v);
  if (!s) return null;
  const withZone = /[zZ]$|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(" ", "T") + (s.length <= 10 ? "T00:00:00Z" : "Z");
  const d = new Date(withZone);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** The New York calendar date of an instant — the summary table's as_of_date. */
export function nyDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** The verb in a price-target headline: raise / lower / initiate / reiterate — or null when the headline does not say. */
export function targetAction(title: unknown): string | null {
  const s = String(title || "").toLowerCase();
  if (/\b(raised|raises|raise|lifted|lifts|boosted|boosts|hiked|hikes|increased|increases|bumped|bumps)\b/.test(s)) return "raise";
  if (/\b(lowered|lowers|cut|cuts|reduced|reduces|trimmed|trims|slashed|slashes|decreased|decreases)\b/.test(s)) return "lower";
  if (/\b(initiat\w*|starts?|started|launch\w*|assum\w*|resum\w*|begins?|began)\b/.test(s)) return "initiate";
  if (/\b(reiterat\w*|maintain\w*|keeps?|kept|affirm\w*|reaffirm\w*)\b/.test(s)) return "reiterate";
  return null;
}

/** One price-target-news item → one TARGET row (null when FMP gives no usable date). */
export function targetRow(x: any, ticker: string): NewsRow | null {
  const published_utc = isoUtc(x && x.publishedDate);
  if (!published_utc || !ticker) return null;
  return {
    ticker, published_utc, kind: "TARGET", firm: txt(x.analystCompany) || "", analyst: txt(x.analystName),
    target: num(x.priceTarget), adj_target: num(x.adjPriceTarget), prior_grade: null, new_grade: null,
    action: targetAction(x.newsTitle), price_when_posted: num(x.priceWhenPosted), title: txt(x.newsTitle), url: txt(x.newsURL),
  };
}

/** One grades-news item → one GRADE row. FMP's action word is kept as FMP gives it (lower-cased). */
export function gradeRow(x: any, ticker: string): NewsRow | null {
  const published_utc = isoUtc(x && x.publishedDate);
  if (!published_utc || !ticker) return null;
  const a = txt(x.action);
  return {
    ticker, published_utc, kind: "GRADE", firm: txt(x.gradingCompany) || "", analyst: null,
    target: null, adj_target: null, prior_grade: txt(x.previousGrade), new_grade: txt(x.newGrade),
    action: a ? a.toLowerCase() : null, price_when_posted: num(x.priceWhenPosted), title: txt(x.newsTitle), url: txt(x.newsURL),
  };
}

export const rowKey = (r: NewsRow) => r.ticker + "|" + r.published_utc + "|" + r.firm + "|" + r.kind;

/** One row per unique key (ticker, published_utc, firm, kind) — the first seen wins (FMP lists newest first).
 *  Needed because one upsert batch may not touch the same key twice. */
export function dedupe(rows: (NewsRow | null)[]): NewsRow[] {
  const m = new Map<string, NewsRow>();
  for (const r of rows) if (r && !m.has(rowKey(r))) m.set(rowKey(r), r);
  return [...m.values()];
}

/** The Hub's stocks: the Hub's own member list (public.cohorts) ∩ active rows of public.tickers whose type is
 *  'stock' or unset (90 core names — AAPL, NVDA, MU … — carry no type), minus anything company_profile marks as a fund. */
export function stockUniverse(
  tickers: { ticker: string; type?: string | null; active?: boolean | null }[],
  cohorts: { ticker: string }[],
  funds: { ticker: string }[],
): string[] {
  const inCoh = new Set((cohorts || []).map((c) => c && c.ticker).filter(Boolean));
  const fund = new Set((funds || []).map((f) => f && f.ticker).filter(Boolean));
  const out = new Set<string>();
  for (const t of tickers || []) {
    if (!t || !t.ticker || t.active !== true) continue;
    if (!(t.type == null || t.type === "stock")) continue;
    if (!inCoh.has(t.ticker) || fund.has(t.ticker)) continue;
    out.add(t.ticker);
  }
  return [...out].sort();
}

/** One price-target-summary item → one daily row. An average over zero targets is not $0: it is stored as null. */
export function summaryRow(x: any, ticker: string, asOf: string): SummaryRow | null {
  if (!x || !ticker) return null;
  const pair = (c: unknown, a: unknown): [number | null, number | null] => {
    const n = num(c), v = num(a);
    return [n, n != null && n > 0 && v != null && v > 0 ? v : null];
  };
  const [mc, ma] = pair(x.lastMonthCount, x.lastMonthAvgPriceTarget);
  const [qc, qa] = pair(x.lastQuarterCount, x.lastQuarterAvgPriceTarget);
  const [yc, ya] = pair(x.lastYearCount, x.lastYearAvgPriceTarget);
  const [ac, aa] = pair(x.allTimeCount, x.allTimeAvgPriceTarget);
  return {
    ticker, as_of_date: asOf, last_month_count: mc, last_month_avg: ma, last_quarter_count: qc, last_quarter_avg: qa,
    last_year_count: yc, last_year_avg: ya, all_time_count: ac, all_time_avg: aa,
  };
}

/** Paging the all-ticker feeds ("paged back until rows already stored"): keep reading the next page while this page's
 *  oldest row is still newer than (the newest row already stored for that kind − an overlap). The overlap re-reads the
 *  last day so a note FMP files late with an earlier timestamp is not skipped; the upsert makes the re-read harmless.
 *  Nothing stored yet → keep paging (the caller's page cap bounds it). An empty page → stop. */
export function keepPaging(page: any[], newestStoredIso: string | null, overlapHours = 24): boolean {
  if (!Array.isArray(page) || !page.length) return false;
  if (!newestStoredIso) return true;
  const cutoff = new Date(newestStoredIso).getTime() - overlapHours * 3600e3;
  let oldest = Infinity;
  for (const x of page) {
    const iso = isoUtc(x && x.publishedDate);
    if (iso) oldest = Math.min(oldest, new Date(iso).getTime());
  }
  return oldest !== Infinity && oldest > cutoff;
}

/** The slice of the universe one invocation handles (offset/limit chunking across invocations). */
export function slice<T>(all: T[], offset: unknown, limit: unknown): T[] {
  const o = Math.max(0, Math.floor(num(offset) ?? 0));
  const l = num(limit);
  return l != null && l > 0 ? all.slice(o, o + Math.floor(l)) : all.slice(o);
}

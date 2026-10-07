/* SCINTILLA · the fiscal-year join (FD1, 7 Oct 2026). Pure: no fetch, no clock, no DOM.

   WHY. An analyst estimate is keyed by the date its fiscal year ends, and FMP moves that date. Before Micron reported
   on 30 Sep 2026 its fiscal 2027 was dated 28 Aug 2027 (a year after fiscal 2025's end); after the report, fiscal 2026
   having ended on 3 Sep 2026 (a 53-week year), the same fiscal 2027 is dated 3 Sep 2027. Costco, Cisco and Lumentum
   moved by one day in the same weeks. Two stored copies of ONE fiscal year then carry two different keys, and a join on
   the date loses the older copy: a decision card said "Micron's FY27 estimate +1.7% since 2 Oct, three copies" when the
   database held a fourth copy, from 11 Aug, against which it is +12.4%.

   THE RULE — one fiscal year, whatever its key:
     · Two period-end dates name the same fiscal year when they are at most FY_MATCH_DAYS (45) apart. Fiscal years are a
       year apart, so 45 days can never join two different years; and a company that truly moves its year-end by months
       is left unjoined (its old and new years cover different months: no revision can be read between them).
     · In one copy the row of a fiscal year is the row whose date is NEAREST the date asked for, inside that reach.
     · fiscalYearOf() gives the year a date belongs to as a number, for grouping and for SQL: the calendar year of the
       date fifteen days earlier, so a 52/53-week year that ends in the first days of January (2 Jan 2027) is fiscal
       2026 with its December neighbours, and Micron's 28 Aug and 3 Sep are both 2027.
   It is the rule the Hub's ESTIMATES tab has used for its "now vs before" box since 2 Oct (index.html revEstPick:
   "the nearest fiscal end within 45 days"), stated once here for every other reader of the stored copies. */

export const FY_MATCH_DAYS = 45;
export const FY_SHIFT_DAYS = 15;
const DAY = 86400e3;
const ms = (d) => Date.parse(String(d).slice(0, 10) + "T00:00:00Z");

/** Days between two ISO dates (a − b), or null when either is not a date. */
export function daysApart(a, b) { const x = ms(a), y = ms(b); return Number.isFinite(x) && Number.isFinite(y) ? Math.round((x - y) / DAY) : null; }

/** The fiscal year a period-end date belongs to, as a number (see the header), or null. */
export function fiscalYearOf(date) { const t = ms(date); return Number.isFinite(t) ? new Date(t - FY_SHIFT_DAYS * DAY).getUTCFullYear() : null; }

/** Do two period-end dates name the same fiscal year? */
export function sameFiscalYear(a, b) { const d = daysApart(a, b); return d != null && Math.abs(d) <= FY_MATCH_DAYS; }

/** Of `rows`, the one whose fiscal year is the year of `date`: the nearest period end inside the reach, or null. */
export function pickFiscalYear(rows, date, { key = "fiscal_date" } = {}) {
  let best = null;
  for (const r of rows || []) { if (!r || !r[key]) continue; const d = daysApart(r[key], date); if (d == null || Math.abs(d) > FY_MATCH_DAYS) continue; if (!best || Math.abs(d) < best.off) best = { r, off: Math.abs(d) }; }
  return best ? best.r : null;
}

/** The stored copies of ONE fiscal year, oldest first: one row per copy date (`asOf`), each the row of that fiscal year.
    rows: every stored row of one company (any years, any copy dates). Returns [{ ...row }], and `keys`: the distinct
    period-end dates the year was stored under (more than one = the key moved). */
export function copiesOfFiscalYear(rows, date, { key = "fiscal_date", asOf = "as_of_date" } = {}) {
  const by = new Map();
  for (const r of rows || []) { if (!r || !r[asOf]) continue; const d = String(r[asOf]).slice(0, 10); if (!by.has(d)) by.set(d, []); by.get(d).push(r); }
  const copies = [...by.keys()].sort().map((d) => pickFiscalYear(by.get(d), date, { key })).filter(Boolean);
  return { copies, keys: [...new Set(copies.map((r) => String(r[key]).slice(0, 10)))].sort() };
}

/** The change of one figure across the stored copies of one fiscal year: oldest copy against newest.
    Returns { from, to, days, then, now, pct, copies, keys, key_moved } or null with fewer than two copies. */
export function revisionOf(rows, date, field, opts = {}) {
  const asOf = opts.asOf || "as_of_date", { copies, keys } = copiesOfFiscalYear(rows, date, opts), have = copies.filter((r) => r[field] != null && Number.isFinite(Number(r[field])));
  if (have.length < 2) return null;
  const a = have[0], b = have[have.length - 1], then = Number(a[field]), now = Number(b[field]);
  return { from: String(a[asOf]).slice(0, 10), to: String(b[asOf]).slice(0, 10), days: daysApart(b[asOf], a[asOf]), then, now, pct: then > 0 ? (now / then - 1) * 100 : null, copies: have.length, keys, key_moved: keys.length > 1 };
}

/** The same question the old way — a join on the exact date — kept only to show what it loses. */
export function revisionOnExactDate(rows, date, field, opts = {}) {
  const key = opts.key || "fiscal_date";
  return revisionOf((rows || []).filter((r) => r && String(r[key]).slice(0, 10) === String(date).slice(0, 10)), date, field, opts);
}

// SCINTILLA · ONE FORWARD BASIS (CP3, 7 Oct 2026) — the pure part: no network, no key, no clock.
//
// WHY. Alan, 7 Oct: "Why is there inconsistencies everywhere on the forward P/E … I see on the dashboard Google 24.1×,
// Amazon 25.4×, Micron 5.9× … if that's the right one, it should be everywhere." The dashboard divided the price by the
// NEXT FOUR QUARTERS of consensus EPS; the comps system, the decision cards and the feed the allocation tool reads
// divided it by the nearest FISCAL YEAR's estimate, which for a calendar-year company in October is a year three
// quarters reported: Alphabet's 2026 carries about $8.92 a share of paper gains on its stakes (16.9× instead of 24×),
// and a fast grower looks dearer than it is (Broadcom 32.2× on fiscal 2026, 21.6× on the next four quarters).
//
// THE RULE — the dashboard's own (index.html: applyEstimates, fpeBasis, fpeVal), written once here:
//   1. FORWARD EPS = the next four QUARTERLY consensus EPS, summed: analyst_estimates rows of period "quarter" whose
//      fiscal_date is today or later and no later than WINDOW_MONTHS after today, oldest first, the first four.
//   2. Fewer than four such quarters → the nearest ANNUAL estimate (fiscal_date today or later). Never the other way
//      round: four quarters that sum to zero or less give NO multiple, and the annual row is not swapped in.
//   3. FORWARD P/E = price ÷ that EPS. No multiple when the EPS is not positive or the price is missing.
//   4. ONE CURRENCY. Estimates are stored in the company's REPORTING currency (TSMC's are in Taiwan dollars per ADR,
//      Alibaba's in yuan) and the price is in US dollars. The EPS is put in dollars at the supplier's own paired rate
//      (estFxPair: its dollar EPS estimate ÷ its local one for the same quarter, confirmed by revenue within FX_TOL).
//      No agreeing pair → the multiple is WITHHELD and says why. Converted or left out, never mixed.
//   5. A multiple under MIN_MULTIPLE is a wrong-basis estimate, not a price: withheld.
//
// WHAT IS ADDED HERE (the dashboard prints only the multiple; the comps system also needs growth):
//   · GROWTH INTO THE FOLLOWING YEAR = the four quarters after the next four ÷ the next four − 1. This is the growth
//     the PEG row and the growth credit use, so "P/E ÷ growth" is one number too (Alphabet 24× ÷ 15% = 1.56).
//   · BAD ROWS ARE FLAGGED, NEVER SILENTLY USED: an estimate of exactly zero; a fiscal year whose four quarterly
//     estimates do not add up to the year's own estimate within RECONCILE_TOL (Amazon's 2028 quarters add to 23.38
//     against a yearly 13.86); quarter ends that are not consecutive. When the following four quarters are bad or
//     missing, each is taken as a quarter of its fiscal year's own estimate instead, and the basis says so.
//   · THIN COVERAGE is said (a quarter resting on one analyst), never hidden.
//
// Used by: deliverables/20261001/comps-template/cohort.mjs (the COMPS tab, the cards, the knockout),
// supabase/functions/comps-feed (a byte-identical copy beside the function, pinned by tests/cp3-one-basis.test.mjs),
// deliverables/20261007/one-basis/tools. The dashboard's own inline code is pinned to this file by the same test.

export const VERSION = "forward-basis-1";
export const QUARTERS = 4;
export const WINDOW_MONTHS = 15;     // the dashboard reads the quarters ending within 15 months of today
export const MIN_MULTIPLE = 2.5;     // under this a forward multiple is a wrong-basis estimate
export const FX_TOL = 0.03;          // the paired rate: EPS ratio and revenue ratio must agree within 3%
export const Q_GAP = [80, 100];      // consecutive quarter ends, in days (the comps tab's rule)
export const RECONCILE_TOL = 0.25;   // a year's four quarterly estimates against the year's own estimate
export const THIN_ANALYSTS = 1;      // a quarter resting on this many analysts or fewer is thin

export const num = (x) => { if (x == null || x === "") return null; const n = Number(x); return Number.isFinite(n) ? n : null; };
const DAY = 86400e3;
const iso = (d) => String(d).slice(0, 10);
const daysBetween = (a, b) => (Date.parse(iso(a) + "T00:00:00Z") - Date.parse(iso(b) + "T00:00:00Z")) / DAY;
/** today + n months, as the dashboard counts it (plusMonthsISO). */
export function plusMonths(isoDate, months) { const d = new Date(isoDate + "T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() + months); return d.toISOString().slice(0, 10); }
const isQuarter = (r) => r && String(r.period) === "quarter";
const isAnnual = (r) => r && (r.period == null || String(r.period) === "annual");
const oldestFirst = (a, b) => iso(a.fiscal_date).localeCompare(iso(b.fiscal_date));
const sumOf = (rows, key) => (rows.some((r) => num(r[key]) == null) ? null : rows.reduce((s, r) => s + num(r[key]), 0));

/** The quarterly estimate rows from today on, oldest first (rows without an EPS figure are not estimates). */
export function futureQuarters(rows, today) {
  return (rows || []).filter((r) => isQuarter(r) && r.fiscal_date && iso(r.fiscal_date) >= today && num(r.est_eps_avg) != null).sort(oldestFirst);
}
/** The annual estimate rows from today on, oldest first. */
export function futureYears(rows, today) {
  return (rows || []).filter((r) => isAnnual(r) && r.fiscal_date && iso(r.fiscal_date) >= today).sort(oldestFirst);
}

/* a quarter end belongs to the fiscal year that ends on it or up to eleven months after it (a first quarter ends about
   270 to 280 days before its year end; the quarter before that, 360 or more) */
const inYear = (a, qDate) => { const g = daysBetween(a.fiscal_date, qDate); return g >= -5 && g < 340; };

/** Each future fiscal year that has its own estimate and all four quarterly estimates: do the quarters add up to it?
    Returns [{ fiscal_date, year_eps, quarters_eps, ratio, bad }] — bad when they differ by more than RECONCILE_TOL. */
export function reconcileYears(rows, today, tol = RECONCILE_TOL) {
  const qs = futureQuarters(rows, today), out = [];
  for (const a of futureYears(rows, today)) {
    const y = num(a.est_eps_avg); if (y == null) continue;
    const mine = qs.filter((q) => inYear(a, q.fiscal_date));
    if (mine.length !== QUARTERS) continue;
    const s = sumOf(mine, "est_eps_avg"), ratio = y !== 0 && s != null ? s / y : null;
    out.push({ fiscal_date: iso(a.fiscal_date), year_eps: y, quarters_eps: s, ratio, quarters: mine.map((q) => iso(q.fiscal_date)), bad: ratio == null || !(y > 0) ? false : Math.abs(ratio - 1) > tol });
  }
  return out;
}
const yearOf = (years, qDate) => years.find((a) => inYear(a, qDate)) || null;

/** THE ONE FORWARD EPS. rows: analyst_estimates rows of ONE company (period, fiscal_date, est_eps_avg and, when read,
    est_revenue_avg, num_analysts_eps, updated_ts) in its reporting currency. today: ISO date.
    Returns null when the company has no estimate at all, else:
      { eps, basis: "next four quarters" | "fiscal year", label, through, quarters: [{fiscal_date, eps, analysts}], at,
        revenue, growth: { pct, eps_following, basis, from } | null, rev_growth_pct, flags: [{ code, words }] } */
export function forwardBasis(rows, today, { annual = "nearest" } = {}) {
  const cap = plusMonths(today, WINDOW_MONTHS), qsAll = futureQuarters(rows, today), years = futureYears(rows, today);
  const q4 = qsAll.filter((q) => iso(q.fiscal_date) <= cap).slice(0, QUARTERS), flags = [];
  const recon = reconcileYears(rows, today), badYears = new Set(recon.filter((r) => r.bad).map((r) => r.fiscal_date));
  const inBadYear = (q) => { const y = yearOf(years, q.fiscal_date); return !!(y && badYears.has(iso(y.fiscal_date))); };
  const consecutive = (list) => list.every((q, i) => i === 0 || (daysBetween(q.fiscal_date, list[i - 1].fiscal_date) >= Q_GAP[0] && daysBetween(q.fiscal_date, list[i - 1].fiscal_date) <= Q_GAP[1]));
  for (const r of recon) if (r.bad) flags.push({ code: "quarters-do-not-add-up", year: r.fiscal_date, words: `the four quarterly estimates for the year to ${r.fiscal_date} add up to ${r.quarters_eps.toFixed(2)} against the year's own estimate of ${r.year_eps.toFixed(2)}` });
  if (q4.length === QUARTERS) {
    const eps = sumOf(q4, "est_eps_avg"), through = iso(q4[3].fiscal_date);
    const ats = q4.map((r) => +r.updated_ts || 0), at = Math.max.apply(null, ats) || null;
    if (q4.some((q) => num(q.est_eps_avg) === 0)) flags.push({ code: "zero-in-next-four", words: "one of the next four quarterly estimates is exactly zero — a blank written as a figure" });
    if (q4.some(inBadYear)) flags.push({ code: "next-four-in-a-bad-year", words: "one of the next four quarters belongs to a year whose quarters do not add up to the year's estimate" });
    if (!consecutive(q4)) flags.push({ code: "next-four-not-consecutive", words: "the next four quarter ends on file are not three months apart: a quarter is missing" });
    const thin = q4.filter((q) => num(q.num_analysts_eps) != null && num(q.num_analysts_eps) <= THIN_ANALYSTS);
    if (thin.length) flags.push({ code: "thin", words: `${thin.length} of the next four quarters rest${thin.length === 1 ? "s" : ""} on one analyst` });
    /* growth into the following year: quarters five to eight, each from its own row when the rows are sound, else a
       quarter of its fiscal year's own estimate */
    const next = qsAll.slice(QUARTERS, QUARTERS * 2), soundRows = next.length === QUARTERS && consecutive([q4[3], ...next]) && !next.some((q) => num(q.est_eps_avg) === 0) && !next.some(inBadYear);
    let growth = null;
    if (eps > 0 && soundRows) { const f = sumOf(next, "est_eps_avg"); growth = { pct: (f / eps - 1) * 100, eps_following: f, basis: `the four quarters after (to ${iso(next[3].fiscal_date)}) over the next four`, from: "quarters" }; }
    else if (eps > 0) {
      const ends = [3, 6, 9, 12].map((m) => plusMonths(through, m)), parts = ends.map((d) => yearOf(years, d)), ok = parts.every((a) => a && num(a.est_eps_avg) != null);
      if (ok) { const f = parts.reduce((s, a) => s + num(a.est_eps_avg) / QUARTERS, 0), names = [...new Set(parts.map((a) => "FY" + iso(a.fiscal_date).slice(0, 4)))].join(" and ");
        growth = { pct: (f / eps - 1) * 100, eps_following: f, basis: `the following four quarters taken from the yearly estimates (${names}), because ${next.length < QUARTERS ? "the quarterly rows stop short" : "the quarterly rows for that year are not sound"}`, from: "years" }; }
    }
    const rev = sumOf(q4, "est_revenue_avg"), revNext = next.length === QUARTERS && soundRows ? sumOf(next, "est_revenue_avg") : null;
    return { eps, basis: "next four quarters", label: "next four quarters to " + through, through, at, quarters: q4.map((q) => ({ fiscal_date: iso(q.fiscal_date), eps: num(q.est_eps_avg), analysts: num(q.num_analysts_eps) })),
      revenue: rev, growth, rev_growth_pct: rev > 0 && revNext > 0 ? (revNext / rev - 1) * 100 : null, flags, reconcile: recon };
  }
  const a1 = years[0] || null;
  if (!a1 || num(a1.est_eps_avg) == null) return qsAll.length || years.length ? { eps: null, basis: null, label: "no forward estimate", through: null, at: null, quarters: [], revenue: null, growth: null, rev_growth_pct: null, flags, reconcile: recon } : null;
  const eps = num(a1.est_eps_avg), a2 = years[1] || null, e2 = a2 ? num(a2.est_eps_avg) : null, a3 = years[2] || null, e3 = a3 ? num(a3.est_eps_avg) : null;
  /* annual: "blend" — ONLY for a company the supplier gives no quarterly estimates for at all (the comps-only reference
     peers, which are on no dashboard): the next twelve months taken from its two nearest fiscal years, each weighed by
     the share of the next twelve months that falls in it. A December year read on 7 October is 23% this year, 77% next. */
  if (annual === "blend" && e2 != null) {
    const w = Math.min(1, Math.max(0, daysBetween(a1.fiscal_date, today) / 365)), mix = (x, y) => (x == null || y == null ? null : w * x + (1 - w) * y);
    const e = mix(eps, e2), f = e3 != null ? mix(e2, e3) : null, r1 = mix(num(a1.est_revenue_avg), num(a2.est_revenue_avg)), r2 = a3 ? mix(num(a2.est_revenue_avg), num(a3.est_revenue_avg)) : null;
    const y = (a) => "FY" + iso(a.fiscal_date).slice(0, 4);
    flags.push({ code: "blended-years", words: `no quarterly estimates on file: the next twelve months are ${Math.round(w * 100)}% of ${y(a1)} and ${Math.round((1 - w) * 100)}% of ${y(a2)} (the year to ${iso(a1.fiscal_date)} alone gives ${eps.toFixed(2)}, the year after ${e2.toFixed(2)})` });
    return { eps: e, basis: "next twelve months, blended from two fiscal years", label: `next twelve months (${Math.round(w * 100)}% ${y(a1)}, ${Math.round((1 - w) * 100)}% ${y(a2)})`, through: plusMonths(today, 12), at: a1.updated_ts ?? null, quarters: [], weight_first_year: w,
      years: [{ fiscal_date: iso(a1.fiscal_date), eps }, { fiscal_date: iso(a2.fiscal_date), eps: e2 }], revenue: r1,
      growth: e > 0 && f != null ? { pct: (f / e - 1) * 100, eps_following: f, basis: `the twelve months after, blended the same way (${y(a2)} and ${y(a3)})`, from: "years" } : null,
      rev_growth_pct: r1 > 0 && r2 > 0 ? (r2 / r1 - 1) * 100 : null, flags, reconcile: recon };
  }
  flags.push({ code: "fiscal-year-basis", words: `fewer than four quarterly estimates on file (${q4.length}): the multiple rests on the fiscal year to ${iso(a1.fiscal_date)}` });
  return { eps, basis: "fiscal year", label: "FY" + iso(a1.fiscal_date).slice(2, 4) + " consensus (annual)", through: iso(a1.fiscal_date), at: a1.updated_ts ?? null, quarters: [],
    revenue: num(a1.est_revenue_avg), growth: eps > 0 && e2 != null ? { pct: (e2 / eps - 1) * 100, eps_following: e2, basis: `FY${iso(a2.fiscal_date).slice(0, 4)} over FY${iso(a1.fiscal_date).slice(0, 4)} consensus`, from: "years" } : null,
    rev_growth_pct: num(a1.est_revenue_avg) > 0 && a2 && num(a2.est_revenue_avg) > 0 ? (num(a2.est_revenue_avg) / num(a1.est_revenue_avg) - 1) * 100 : null, flags, reconcile: recon };
}

/** THE SUPPLIER'S OWN PAIRED RATE (the dashboard's estFxPair, unchanged): for the same quarter the supplier serves a
    dollar EPS and revenue estimate (earnings_events) and the local ones (analyst_estimates). The newest quarter whose
    two ratios agree within FX_TOL gives the rate; anything else (an ADR ratio, a stale row) gives none.
    events: [{ date, eps_estimate, revenue_estimate }] · quarters: [{ fiscal_date, est_eps_avg, est_revenue_avg }]. */
export function estFxPair(events, quarters, tol = FX_TOL) {
  const qs = (quarters || []).filter((q) => q && num(q.est_eps_avg) > 0 && num(q.est_revenue_avg) > 0).sort((a, b) => iso(b.fiscal_date).localeCompare(iso(a.fiscal_date)));
  const evs = (events || []).filter((e) => e && num(e.eps_estimate) > 0 && num(e.revenue_estimate) > 0).sort((a, b) => iso(b.date).localeCompare(iso(a.date)));
  for (const e of evs) {
    const d = Date.parse(iso(e.date) + "T12:00:00Z");
    const q = qs.find((x) => { const g = (d - Date.parse(iso(x.fiscal_date) + "T12:00:00Z")) / 864e5; return g >= 3 && g <= 110; });
    if (!q) continue;
    const fxE = num(e.eps_estimate) / num(q.est_eps_avg), fxR = num(e.revenue_estimate) / num(q.est_revenue_avg);
    if (Math.abs(fxE / fxR - 1) <= tol) return { f: fxE, q: iso(q.fiscal_date), fxE, fxR, on: iso(e.date) };
  }
  return null;
}

/** THE ONE FORWARD P/E. price: US dollars. basis: forwardBasis()'s answer. ccy: the reporting currency ("USD" or
    null = dollars). fx: estFxPair()'s answer for a foreign reporter, or a plain { f } rate; null = no rate.
    Returns { pe, eps, eps_usd, text, converted, withheld, why }. pe is null whenever no multiple can be printed. */
export function forwardMultiple(price, basis, { ccy = null, fx = null } = {}) {
  const c = ccy ? String(ccy).toUpperCase() : "USD", foreign = c !== "USD", rate = foreign ? (fx && num(fx.f) > 0 ? num(fx.f) : null) : 1;
  const none = (why, extra = {}) => ({ pe: null, eps: basis ? basis.eps : null, eps_usd: null, text: foreign && basis && basis.eps != null && rate == null ? "EPS " + c : "—", converted: false, withheld: true, why, ...extra });
  if (!basis || basis.eps == null) return none("no forward EPS estimate on file");
  if (foreign && rate == null) return none(`not comparable: EPS in ${c} and no agreeing rate on file`);
  const e = basis.eps * rate;
  if (!(basis.eps > 0)) return none("consensus EPS is not positive", { eps_usd: e });
  if (!(num(price) > 0)) return none("no price", { eps_usd: e });
  const pe = num(price) / e;
  if (pe < MIN_MULTIPLE) return none(`under ${MIN_MULTIPLE}×: the estimate is on the wrong basis`, { eps_usd: e });
  return { pe, eps: basis.eps, eps_usd: e, text: multipleText(pe, foreign), converted: foreign, withheld: false, why: null };
}
/** How a multiple is printed, everywhere: one decimal and ×; ≈ in front when the EPS was converted. */
export const multipleText = (pe, converted = false) => (pe == null || !Number.isFinite(pe) ? "—" : (converted ? "≈" : "") + pe.toFixed(1) + "×");

/** Everything one surface prints for one company. o: { price, rows, today, ccy, fx }.
    Returns forwardBasis() + forwardMultiple() + { growth_pct, peg, basis_words }. */
export function forwardRead({ price, rows, today, ccy = null, fx = null, annual = "nearest" }) {
  const b = forwardBasis(rows, today, { annual }), m = forwardMultiple(price, b, { ccy, fx });
  const g = b && b.growth ? b.growth.pct : null, foreign = !!ccy && String(ccy).toUpperCase() !== "USD", k = foreign ? (fx && num(fx.f) > 0 ? num(fx.f) : null) : 1, usd = (v) => (v == null || k == null ? null : v * k);
  return { ...m, basis: b ? b.basis : null, label: b ? b.label : null, through: b ? b.through : null, quarters: b ? b.quarters : [], at: b ? b.at : null,
    growth_pct: g, growth_basis: b && b.growth ? b.growth.basis : null, growth_from: b && b.growth ? b.growth.from : null, eps_following: b && b.growth ? b.growth.eps_following : null,
    rev_growth_pct: b ? b.rev_growth_pct : null, revenue: b ? b.revenue : null,
    eps_following_usd: b && b.growth ? usd(b.growth.eps_following) : null, revenue_usd: b ? usd(b.revenue) : null, revenue_following_usd: b && b.revenue > 0 && b.rev_growth_pct != null ? usd(b.revenue * (1 + b.rev_growth_pct / 100)) : null,
    following_through: b && b.through ? plusMonths(b.through, 12) : null, years: b && b.years ? b.years : null,
    peg: m.pe != null && g != null && g > 0 ? m.pe / g : null, flags: b ? b.flags : [], reconcile: b ? b.reconcile : [],
    rate: foreign && k != null ? { f: k, quarter: fx.q || null, on: fx.on || null, from: fx.from || "the supplier's own paired rate", currency: String(ccy).toUpperCase() } : null };
}

/** The PostgREST reads one surface needs for a list of tickers (without limit / offset: the caller pages them).
    estimates: both periods, today → today + 40 months, in a total order. events / pairQuarters: only for the foreign
    reporters among them (the paired rate), the dashboard's own two reads. */
export function forwardQueries(tickers, today, foreign = []) {
  const inq = (list) => "in.(" + list.map((s) => encodeURIComponent('"' + s + '"')).join(",") + ")";
  const until = plusMonths(today, 40), since = new Date(Date.parse(today + "T00:00:00Z") - 400 * DAY).toISOString().slice(0, 10);
  return {
    estimates: `analyst_estimates?select=ticker,period,fiscal_date,est_eps_avg,est_revenue_avg,num_analysts_eps,updated_ts&ticker=${inq(tickers)}&fiscal_date=gte.${today}&fiscal_date=lte.${until}&order=ticker.asc,period.asc,fiscal_date.asc`,
    events: foreign.length ? `earnings_events?select=ticker,date,eps_estimate,revenue_estimate&ticker=${inq(foreign)}&date=gte.${since}&order=ticker.asc,date.desc` : null,
    pairQuarters: foreign.length ? `analyst_estimates?select=ticker,fiscal_date,est_eps_avg,est_revenue_avg&period=eq.quarter&ticker=${inq(foreign)}&fiscal_date=gte.${since}&order=ticker.asc,fiscal_date.desc` : null,
  };
}

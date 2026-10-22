/* Scintilla · CW6 (22 Oct) · the comps engine. Pure: no fetch, no DOM; the browser tab and the node check run this file.
   A line-for-line port of CW3's compute.py (19 Oct) with CW4's additions (20 Oct), so the method Alan last saw is the one
   the COMPS tab runs:
   - ONE forward basis: NTM = w·FY1 + (1−w)·FY2 of FMP's annual consensus, w = days left in FY1 ÷ 365.25; FY2 missing →
     FY1 alone; no row → the peer goes in on trailing (T).
   - EV = market cap + total debt − cash and short-term investments (latest quarter), all in USD at the fetch date's FX.
   - Forward P/E = market cap ÷ NTM net income; PEG = forward P/E ÷ NTM net-income growth (%), priced only at 10–100%
     growth with three peers; EV/sales and EV/EBITDA on NTM; gross margin TTM; EBIT margin NTM; net debt ÷ TTM EBITDA.
   - Loss-maker (TTM or NTM net income ≤ 0, or no estimate): EV/sales (NTM; TTM when no estimate, labelled), EV/gross
     profit (TTM), EV/EBITDA only when NTM EBITDA > 0; never a P/E or PEG row. Cash runway beside it.
   - Not meaningful (struck, out of the median; a row needs three meaningful peers): P/E > 100, EV/sales > 60,
     EV/EBITDA > 60, PEG > 10, EV/gross profit > 150; CW4 adds P/E < 4, EV/EBITDA < 3, P/B > 30.
   - CW4 · balance-sheet businesses (banks, brokers, insurers): no EV rows; forward P/E, PEG and price/book, ROE beside.
   - CW4 · a consensus that does not fit its statements (NTM revenue outside 0.4–2.5× TTM) is dropped (T).
   - Implied price per row = peer median × the name's own figure (net debt out for EV rows) ÷ shares; midpoint = the
     geometric middle of the lowest and highest implied price; cheap ≤ −15%, rich ≥ +15%, fair between.
   CW6 adds, on every set: the ±10× size band (a peer under a tenth or over ten times the name's market value is struck
   and out of every median; the band is a control: ±3 · ±10 · ±30 · off); P/S (market cap ÷ NTM sales) and P/S per
   point of growth as columns (Alan, 20 Oct: "we have to consider price to sales"), not priced rows, so the centre stays
   CW3's; the farthest-peer swing per priced row (that peer set aside, the median re-taken, ≥15% flagged); the thin test
   (fewer than four peers carrying figures). */

export const RULES = {
  CW3: { key: "CW3", nm: { pe: 100, ev_sales: 60, ev_ebitda: 60, peg: 10, ev_gp: 150 }, nmLow: {}, financialRule: false, mismatch: false },
  CW4: { key: "CW4", nm: { pe: 100, ev_sales: 60, ev_ebitda: 60, peg: 10, ev_gp: 150, pb: 30 }, nmLow: { pe: 4, ev_ebitda: 3 }, financialRule: true, mismatch: true },
};
export const BAND_DEFAULT = 10, BANDS = [3, 10, 30, null];
export const THIN = 4, SWING_FLAG = 15, CHEAP = -15, RICH = 15, PEG_LO = 10, PEG_HI = 100;
export const COLS = ["pe", "ev_sales", "ev_ebitda", "peg", "pb", "ps", "ps_g", "rev_growth_ntm_pct", "gross_margin_ttm_pct", "ebit_margin_pct", "net_margin_pct", "roe_ttm_pct", "net_debt_ebitda", "ev_gp"];
const PREM = ["pe", "ev_sales", "ev_ebitda", "peg", "pb", "ps", "ps_g", "ev_gp"];
const DAY = 86400e3;

/* python's float(): None for null, NaN, ±inf and anything non-numeric */
export function num(x) { if (x == null || x === "" || typeof x === "boolean") return null; const v = Number(x); return Number.isFinite(v) ? v : null; }
const T_ = (v) => !!v;   // python truthiness for numbers (0 and None are false)
function first(d, ...keys) { for (const k of keys) if (d && typeof d === "object" && d[k] != null) return d[k]; return null; }
/* statistics.median: the mean of the two middle values on an even count */
export function median(a) { const s = a.slice().sort((x, y) => x - y), n = s.length; if (!n) return null; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; }
const isoDay = (s) => String(s || "").slice(0, 10);
const days = (a, b) => Math.round((Date.parse(isoDay(a) + "T00:00:00Z") - Date.parse(isoDay(b) + "T00:00:00Z")) / DAY);

/** FX: rate to USD per currency from batch-quote rows {USDKRW: {price}, GBPUSD: {price}} (CW3's rule; CW4's GBp guard). */
export function fxRates(fxraw, { cw3gbp = false } = {}) {
  const rates = { USD: 1.0 };
  for (const [sym, row] of Object.entries((fxraw && fxraw.rates) || {})) {
    const p = num(row && row.price); if (!p) continue;
    if (sym.startsWith("USD")) rates[sym.slice(3)] = 1.0 / p; else if (sym.endsWith("USD")) rates[sym.slice(0, 3)] = p;
  }
  if (cw3gbp || "GBP" in rates) rates.GBp = (rates.GBP || 0) / 100.0;
  return rates;
}

/** One company's figures from FMP's answers (CW3's raw shape: {path: {status, data}}). */
export function company(t, answers, { today, rates, financial = false, rules = RULES.CW3 }) {
  const ans = (p) => { const a = answers && answers[p]; return a && a.status === 200 ? a.data : null; };
  const c = { ticker: t, issues: [], financial: !!(rules.financialRule && financial) };
  const prof = (ans("profile") || [{}])[0] || {}, q = ans("quote") || {};
  c.name = prof.companyName || q.name || t; c.industry = prof.industry || null; c.sector = prof.sector || null; c.exchange = prof.exchange || null;
  c.country = prof.country || null; c.ipo_date = prof.ipoDate || null; c.is_adr = !!prof.isAdr;
  const tccy = prof.currency || "USD"; c.trading_ccy = tccy;
  c.price = num(q.price); c.quote_ts = q.timestamp || null;
  c.quote_utc = q.timestamp ? new Date(q.timestamp * 1000).toISOString().slice(0, 16) + "Z" : null;
  if (!Object.keys(q).length) c.issues.push("no quote on FMP");
  const mcapLocal = num(q.marketCap);
  let fxt = rates[tccy]; if (fxt == null) { c.issues.push(`no FX for trading currency ${tccy}`); fxt = null; }
  const mcapFx = tccy === "GBp" ? rates.GBP : fxt;
  c.mcap_usd = T_(mcapLocal) && T_(mcapFx) ? mcapLocal * mcapFx : null;
  c.price_usd = T_(c.price) && T_(fxt) ? c.price * fxt : null;
  c.fx_to_usd = fxt;
  const ttm = (ans("income-statement-ttm") || [{}])[0] || {};
  const rccy = ttm.reportedCurrency || tccy; c.reporting_ccy = rccy;
  let fxr = rates[rccy]; if (fxr == null) { c.issues.push(`no FX for reporting currency ${rccy}`); fxr = 0; }
  c.ttm_date = ttm.date || null;
  const usd = (v) => { v = num(v); return v != null ? v * fxr : null; };
  c.ttm = { revenue: usd(ttm.revenue), gross_profit: usd(ttm.grossProfit), ebit: usd(ttm.operatingIncome), ebitda: usd(ttm.ebitda), net_income: usd(ttm.netIncome), eps_diluted: num(ttm.epsDiluted), shares_diluted: num(ttm.weightedAverageShsOutDil) };
  if (c.ttm.revenue == null) c.issues.push("no TTM income statement");
  const bs = (ans("balance-sheet-statement") || [{}])[0] || {}, hasBs = Object.keys(bs).length > 0;
  c.bs_date = bs.date || null;
  let cash = usd(first(bs, "cashAndShortTermInvestments")); if (cash == null) cash = usd(bs.cashAndCashEquivalents);
  let debt = usd(bs.totalDebt); if (debt == null && hasBs) debt = (usd(bs.shortTermDebt) || 0) + (usd(bs.longTermDebt) || 0);
  c.cash_usd = cash; c.debt_usd = debt; c.cash_basis = first(bs, "cashAndShortTermInvestments") != null ? "cash and short-term investments" : bs.cashAndCashEquivalents != null ? "cash only" : null;
  c.net_debt_usd = hasBs && (cash != null || debt != null) ? (debt || 0) - (cash || 0) : null;
  if (!hasBs) c.issues.push("no balance sheet");
  c.equity_usd = usd(first(bs, "totalStockholdersEquity", "totalEquity"));
  c.ev_usd = c.mcap_usd != null && c.net_debt_usd != null ? c.mcap_usd + c.net_debt_usd : null;
  if (T_(c.price) && T_(c.ttm.shares_diluted) && T_(mcapLocal)) {
    const ratio = mcapLocal / (c.price * c.ttm.shares_diluted);
    c.mcap_vs_price_x_shares = Math.round(ratio * 100) / 100;
    if ((ratio > 1.3 || ratio < 0.7) && !c.is_adr && rccy === tccy) c.issues.push(`market cap is ${ratio.toFixed(2)}× price × diluted shares (FMP share count or quote mismatch)`);
  }
  /* estimates → NTM */
  const rows = (ans("analyst-estimates") || []).map((r) => [isoDay(r.date), r]).filter(([d]) => /^\d{4}-\d\d-\d\d$/.test(d)).sort((a, b) => a[0].localeCompare(b[0]));
  const fut = rows.filter(([d]) => d > today);
  const none = (basis = "no estimate") => ({ revenue: null, ebitda: null, ebit: null, net_income: null, eps: null, eps_spread_pct: null, basis, fy1: null, fy2: null, w: null, n_rev: null, n_eps: null });
  let ntm = none();
  if (fut.length) {
    const [d1, r1] = fut[0], r2 = fut.length > 1 ? fut[1][1] : null;
    const w = Math.min(1.0, Math.max(0.0, days(d1, today) / 365.25));
    const blend = (k) => { const a = num(r1[k]), b = r2 ? num(r2[k]) : null; if (a == null || a === 0) return null; if (b == null || b === 0) return a * fxr; return (w * a + (1 - w) * b) * fxr; };
    const ea = num(r1.epsAvg), eb = r2 ? num(r2.epsAvg) : null;
    const spread = (r) => { const a = num(r.epsAvg), h = num(r.epsHigh), l = num(r.epsLow); return T_(a) && h != null && l != null ? (h - l) / Math.abs(a) * 100 : null; };
    const s1 = spread(r1), s2 = r2 ? spread(r2) : null;
    ntm = { revenue: blend("revenueAvg"), ebitda: blend("ebitdaAvg"), ebit: blend("ebitAvg"), net_income: blend("netIncomeAvg"),
      eps: T_(ea) && T_(eb) ? w * ea + (1 - w) * eb : (T_(ea) ? ea : null), eps_spread_pct: s1 != null && s2 != null ? w * s1 + (1 - w) * s2 : (s1 != null ? s1 : s2),
      basis: r2 ? "NTM blend" : "FY1 only", fy1: d1, fy2: r2 ? fut[1][0] : null, w: Math.round(w * 1000) / 1000, n_rev: r1.numAnalystsRevenue ?? null, n_eps: r1.numAnalystsEps ?? null,
      fy1_row: r1, fy2_row: r2 };
  } else c.issues.push("no forward estimate on FMP");
  if (rules.mismatch) {
    const Tr = c.ttm.revenue, rr = T_(ntm.revenue) && T_(Tr) ? ntm.revenue / Tr : null;
    if (rr != null && !(rr >= 0.4 && rr <= 2.5)) { c.issues.push(`consensus does not fit the statements (NTM revenue ${rr.toFixed(2)}× TTM): a unit or currency mismatch in FMP's answers; consensus dropped, trailing used (T)`); c.ntm_dropped = ntm; ntm = none("no estimate (consensus dropped: mismatch)"); }
  }
  c.ntm = ntm;
  /* multiples */
  const m = {}, Tt = c.ttm, E = c.ev_usd, M = c.mcap_usd, fin = c.financial, fwd = ntm.revenue != null;
  c.forward_basis = fwd;
  const niF = ntm.net_income, niT = Tt.net_income;
  c.loss_maker = (niT != null && niT <= 0) || (niF != null && niF <= 0) || (niF == null && (niT == null || niT <= 0));
  m.pe = T_(M) && T_(niF) && niF > 0 ? M / niF : (T_(M) && !fwd && T_(niT) && niT > 0 ? M / niT : null);
  m.pe_basis = T_(niF) && niF > 0 ? "NTM" : (!fwd && T_(niT) && niT > 0 ? "TTM" : null);
  m.pe_ttm = T_(M) && T_(niT) && niT > 0 ? M / niT : null;
  const g = T_(niF) && T_(niT) && niF > 0 && niT > 0 ? (niF / niT - 1) * 100 : null;
  m.ni_growth_ntm_pct = g;
  m.peg = T_(m.pe) && m.pe_basis === "NTM" && T_(g) && g > 0 ? m.pe / g : null;
  m.pb = T_(M) && T_(c.equity_usd) && c.equity_usd > 0 ? M / c.equity_usd : null;
  m.roe_ttm_pct = niT != null && T_(c.equity_usd) && c.equity_usd > 0 ? niT / c.equity_usd * 100 : null;
  const revB = fwd ? ntm.revenue : Tt.revenue;
  m.net_margin_pct = fwd && niF != null && T_(ntm.revenue) ? niF / ntm.revenue * 100 : (niT != null && T_(Tt.revenue) ? niT / Tt.revenue * 100 : null);
  if (fin) {
    m.ev_sales = m.ev_ebitda = m.net_debt_ebitda = m.ev_gp = null; m.ev_sales_basis = m.ev_ebitda_basis = "n/a (balance-sheet business)"; m.ev_sales_ttm = m.ev_ebitda_ttm = null;
  } else {
    m.ev_sales = E != null && T_(revB) && revB > 0 ? E / revB : null; m.ev_sales_basis = fwd ? "NTM" : "TTM";
    m.ev_sales_ttm = E != null && T_(Tt.revenue) ? E / Tt.revenue : null;
    const ebB = fwd && T_(ntm.ebitda) ? ntm.ebitda : (!fwd ? Tt.ebitda : null);
    m.ev_ebitda = E != null && T_(ebB) && ebB > 0 ? E / ebB : null; m.ev_ebitda_basis = fwd && T_(ntm.ebitda) ? "NTM" : (!fwd ? "TTM" : null);
    m.ev_ebitda_ttm = E != null && T_(Tt.ebitda) && Tt.ebitda > 0 ? E / Tt.ebitda : null;
    m.ev_gp = E != null && T_(Tt.gross_profit) && Tt.gross_profit > 0 ? E / Tt.gross_profit : null;
    m.net_debt_ebitda = c.net_debt_usd != null && T_(Tt.ebitda) && Tt.ebitda > 0 ? c.net_debt_usd / Tt.ebitda : null;
  }
  if (fin && fwd && ntm.fy1_row && ntm.fy2_row && T_(num(ntm.fy1_row.revenueAvg)) && T_(num(ntm.fy2_row.revenueAvg))) { m.rev_growth_ntm_pct = (num(ntm.fy2_row.revenueAvg) / num(ntm.fy1_row.revenueAvg) - 1) * 100; m.rev_growth_basis = "FY2/FY1 consensus"; }
  else { m.rev_growth_ntm_pct = fwd && T_(Tt.revenue) && !fin ? (ntm.revenue / Tt.revenue - 1) * 100 : null; m.rev_growth_basis = m.rev_growth_ntm_pct != null ? "NTM/TTM" : null; }
  m.gross_margin_ttm_pct = Tt.gross_profit != null && T_(Tt.revenue) && !fin ? Tt.gross_profit / Tt.revenue * 100 : null;
  m.ebit_margin_pct = fwd && ntm.ebit != null && T_(ntm.revenue) ? ntm.ebit / ntm.revenue * 100 : (Tt.ebit != null && T_(Tt.revenue) ? Tt.ebit / Tt.revenue * 100 : null);
  m.ebit_margin_basis = fwd && ntm.ebit != null ? "NTM" : "TTM";
  /* CW6 · P/S on the same basis as EV/sales, and P/S per point of revenue growth (display only, never priced) */
  m.ps = T_(M) && T_(revB) && revB > 0 ? M / revB : null; m.ps_basis = fwd ? "NTM" : "TTM";
  m.ps_g = m.ps != null && T_(m.rev_growth_ntm_pct) && m.rev_growth_ntm_pct >= 10 ? m.ps / (m.rev_growth_ntm_pct / 100) : null;   /* P/S ÷ growth (100% = 1), read only at 10% growth or more, as a PEG */
  c.m = m;
  return c;
}

const LABEL = { pe: "Fwd P/E", ev_sales: "EV/sales NTM", ev_ebitda: "EV/EBITDA NTM", peg: "PEG", pb: "Price/book", ev_gp: "EV/gross profit TTM" };

/** The read of one name against its peers. peers: [{t, why, c}]. opts: rules, band (null = off), set words. */
export function readName(subj, peers, { rules = RULES.CW3, band = BAND_DEFAULT, today, answers = {} } = {}) {
  const c = subj, NM = rules.nm, LO = rules.nmLow || {};
  const meaningful = (k, v) => v != null && (!(k in NM) || v <= NM[k]) && (!(k in LO) || v >= LO[k]);
  /* CW6 · the size band on every set */
  const all = peers.map((p) => { const r = p.c && c.mcap_usd ? p.c.mcap_usd / c.mcap_usd : null; const out = band != null && r != null && (r > band || r < 1 / band); return { ...p, size_ratio: r, struck: out ? (r > band ? `${r >= 100 ? Math.round(r) : r.toFixed(1)}× the size, outside ±${band}×` : `${(1 / r) >= 100 ? Math.round(1 / r) : (1 / r).toFixed(1)}× smaller, outside ±${band}×`) : null }; });
  const rows = all.filter((p) => !p.struck && p.c);
  const med = {}, cnt = {}, nm = {};
  for (const k of COLS) {
    const vals = rows.map((r) => r.c.m[k]).filter((v) => meaningful(k, v));
    med[k] = vals.length >= (k in NM ? 3 : 1) ? median(vals) : null; cnt[k] = vals.length;
    for (const r of rows) (nm[r.t] ||= {})[k] = r.c.m[k] != null && !meaningful(k, r.c.m[k]);
  }
  const prem = Object.fromEntries(PREM.map((k) => [k, c.m[k] != null && T_(med[k]) ? (c.m[k] / med[k] - 1) * 100 : null]));
  const shares = T_(c.mcap_usd) && T_(c.price_usd) ? c.mcap_usd / c.price_usd : null;
  const nd = c.net_debt_usd || 0, N = c.ntm, Tt = c.ttm;
  const eqToPx = (eq) => T_(shares) && eq != null && eq > 0 ? eq / shares : null;
  const imp = {}; let pegNote = null;
  const g = c.m.ni_growth_ntm_pct;
  const pegRow = () => {
    if (T_(med.peg) && T_(g) && g >= PEG_LO && g <= PEG_HI && cnt.peg >= 3 && T_(N.net_income)) imp.peg = { label: LABEL.peg, median: med.peg, n: cnt.peg, price: eqToPx(med.peg * g * N.net_income), fig: g * N.net_income };
    else if (g != null) pegNote = `PEG not priced: NTM net-income growth ${g.toFixed(0)}% is outside the 10–100% band where a PEG means anything` + (cnt.peg >= 3 ? "" : ` (and only ${cnt.peg} peers carry one)`);
    else pegNote = "PEG not priced: no positive net-income growth to divide by";
  };
  const evRow = (k, fig, label) => { if (T_(med[k]) && T_(fig)) imp[k] = { label: label || LABEL[k], median: med[k], n: cnt[k], price: eqToPx(med[k] * fig - nd), fig, ev: true }; };
  if (c.financial) {
    if (T_(med.pe) && T_(N.net_income)) imp.pe = { label: LABEL.pe, median: med.pe, n: cnt.pe, price: eqToPx(med.pe * N.net_income), fig: N.net_income };
    pegRow();
    if (T_(med.pb) && T_(c.equity_usd)) imp.pb = { label: LABEL.pb, median: med.pb, n: cnt.pb, price: eqToPx(med.pb * c.equity_usd), fig: c.equity_usd };
  } else if (!c.loss_maker) {
    if (T_(med.pe) && T_(N.net_income)) imp.pe = { label: LABEL.pe, median: med.pe, n: cnt.pe, price: eqToPx(med.pe * N.net_income), fig: N.net_income };
    evRow("ev_sales", N.revenue);
    if (T_(N.ebitda) && N.ebitda > 0) evRow("ev_ebitda", N.ebitda);
    pegRow();
  } else {
    if (T_(med.ev_sales) && T_(N.revenue)) evRow("ev_sales", N.revenue);
    else if (T_(med.ev_sales) && T_(Tt.revenue)) evRow("ev_sales", Tt.revenue, "EV/sales (TTM, no estimate)");
    if (T_(Tt.gross_profit) && Tt.gross_profit > 0) evRow("ev_gp", Tt.gross_profit);
    if (T_(N.ebitda) && N.ebitda > 0) evRow("ev_ebitda", N.ebitda);
  }
  for (const k of Object.keys(imp)) if (!T_(imp[k].price)) delete imp[k];
  /* CW6 · the farthest-peer swing on every priced row */
  for (const [k, r] of Object.entries(imp)) {
    const vals = rows.map((p) => ({ t: p.t, v: p.c.m[k] })).filter((x) => meaningful(k, x.v));
    if (vals.length < 3 || !(r.median > 0)) continue;
    const far = vals.filter((x) => x.v > 0).sort((a, b) => Math.abs(Math.log(b.v / r.median)) - Math.abs(Math.log(a.v / r.median)))[0];
    if (!far) continue;
    const m2 = median(vals.filter((x) => x !== far).map((x) => x.v));
    const px2 = r.ev ? eqToPx(m2 * r.fig - nd) : eqToPx(m2 * (k === "peg" ? r.fig : r.fig));
    r.swing = { peer: far.t, value: far.v, median_without: m2, swing_pct: (m2 / r.median - 1) * 100, price_without: px2, price_swing_pct: px2 && r.price ? (px2 / r.price - 1) * 100 : null };
    r.swing.flag = Math.abs(r.swing.swing_pct) >= SWING_FLAG;
  }
  const pxs = Object.values(imp).map((v) => v.price);
  const mid = pxs.length ? Math.sqrt(Math.min(...pxs) * Math.max(...pxs)) : null;
  const dist = T_(mid) && T_(c.price) ? (c.price / mid - 1) * 100 : null;
  const read = dist == null ? null : dist <= CHEAP ? "cheap" : dist >= RICH ? "rich" : "fair";
  const carrying = rows.filter((p) => p.c.mcap_usd && (p.c.m.pe != null || p.c.m.ev_sales != null || p.c.m.pb != null)).length;
  /* analysts */
  const ansOf = (p) => { const a = answers[p]; return a && a.status === 200 ? a.data : null; };
  const ptc = (ansOf("price-target-consensus") || [{}])[0] || {}, pts = (ansOf("price-target-summary") || [{}])[0] || {};
  const analysts = { low: num(ptc.targetLow), median: num(ptc.targetMedian), high: num(ptc.targetHigh), consensus: num(ptc.targetConsensus), last_quarter_n: pts.lastQuarterCount ?? null, last_quarter_avg: num(pts.lastQuarterAvgPriceTarget), last_year_n: pts.lastYearCount ?? null };
  /* pre-profit facts */
  let pp = null;
  if (c.loss_maker) {
    const cf = ansOf("cash-flow-statement") || [], sf = (ansOf("shares-float") || [{}])[0] || {};
    const fcf = cf.slice(0, 4).map((r) => num(r.freeCashFlow)), have = fcf.filter((v) => v != null);
    const fcfSum = fcf.length ? have.reduce((a, b) => a + b, 0) * (c.fx_to_usd || 1) : null;
    const burnQ = fcfSum != null && fcfSum < 0 ? -fcfSum / have.length : null;
    const latest = fcf.length && fcf[0] != null ? fcf[0] * (c.fx_to_usd || 1) : null, burnL = latest != null && latest < 0 ? -latest : null;
    let lock = null; if (c.ipo_date && today) { const dd = days(today, c.ipo_date); if (dd <= 365) lock = new Date(Date.parse(isoDay(c.ipo_date) + "T00:00:00Z") + 180 * DAY).toISOString().slice(0, 10); }
    pp = { cash_usd: c.cash_usd, debt_usd: c.debt_usd, fcf_4q_usd: fcfSum, quarters_on_file: have.length, burn_per_quarter_usd: burnQ, runway_quarters: T_(burnQ) && T_(c.cash_usd) ? c.cash_usd / burnQ : null,
      burn_latest_quarter_usd: burnL, runway_quarters_latest_basis: T_(burnL) && T_(c.cash_usd) ? c.cash_usd / burnL : null, not_burning: fcfSum != null && fcfSum >= 0, ipo_date: c.ipo_date, lockup_end: lock,
      float_pct: num(sf.freeFloat), cf_on_file: cf.length > 0 };
  }
  return { ticker: c.ticker, company: c, peers: all, rows: rows.map((r) => r.t), median: med, n: cnt, nm, premium_pct: prem, implied: imp, peg_note: pegNote, midpoint: mid, distance_pct: dist, read,
    band, struck: all.filter((p) => p.struck).map((p) => ({ t: p.t, why: p.struck })), carrying, thin: carrying < THIN, analysts, pre_profit: pp,
    peer_median_growth: med.rev_growth_ntm_pct, peer_median_ebit_margin: med.ebit_margin_pct, peer_median_net_margin: med.net_margin_pct, rules: rules.key };
}

/** The through-the-cycle line (CW5): today's trailing multiples at today's price against the name's own ten years. */
export function cycleLine(cy, price, { ntmNetIncome = null, ntmEps = null } = {}) {
  if (!cy || !T_(price)) return null;
  const t = cy.ttm, mcap = t.shares ? price * t.shares : null, ev = mcap != null ? mcap + (t.net_debt || 0) : null;
  const now = { pe: T_(t.eps) && t.eps > 0 ? price / t.eps : null, ev_sales: ev != null && T_(t.revenue) ? ev / t.revenue : null, ev_ebitda: ev != null && T_(t.ebitda) && t.ebitda > 0 ? ev / t.ebitda : null, pb: mcap != null && T_(t.equity) && t.equity > 0 ? mcap / t.equity : null };
  const pct = (k) => { const d = cy.dist[k]; if (!d || !d.sorted.length || now[k] == null) return null; const below = d.sorted.filter((v) => v < now[k]).length; return Math.round(below / d.sorted.length * 1000) / 10; };
  const out = {};
  for (const k of ["pe", "ev_sales", "ev_ebitda", "pb"]) out[k] = { now: now[k], percentile: pct(k), median: cy.dist[k] ? cy.dist[k].median : null, low: cy.dist[k] ? cy.dist[k].low : null, high: cy.dist[k] ? cy.dist[k].high : null, n: cy.dist[k] ? cy.dist[k].n : 0 };
  const medPe = out.pe.median;
  out.eps_paid_for = T_(medPe) ? price / medPe : null;   // the EPS today's price buys at the name's own median trailing P/E
  out.eps_ttm = t.eps; out.ntm_eps = ntmEps; out.vs_ntm_pct = T_(out.eps_paid_for) && T_(ntmEps) ? (out.eps_paid_for / ntmEps - 1) * 100 : null;
  out.months = cy.months; out.short = cy.months < 60; out.facts = cy.facts;
  return out;
}

/** The words: one verdict line, then the loss-maker / thin / cycle lines. Plain numbers, no plus signs on prices. */
const usd0 = (v) => v == null ? "—" : "$" + (Math.abs(v) >= 100 ? Math.round(v).toLocaleString("en-US") : v.toFixed(2));
const x1 = (v) => v == null ? "—" : (Math.abs(v) >= 100 ? Math.round(v) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2)) + "×";
const rel = (d) => d == null ? "—" : `${Math.abs(d).toFixed(0)}% ${d >= 0 ? "over" : "under"}`;
const pc = (v) => v == null ? "—" : (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(0) + "%";
const bn = (v) => v == null ? "—" : Math.abs(v) >= 1e12 ? "$" + (v / 1e12).toFixed(2) + "T" : Math.abs(v) >= 1e9 ? "$" + (v / 1e9).toFixed(1) + "B" : "$" + (v / 1e6).toFixed(0) + "M";
export const FMT = { usd0, x1, pc, bn };

export function verdictWords(R, { setWords, refuse = null } = {}) {
  const c = R.company, m = c.m, md = R.median, w = [];
  const priced = Object.values(R.implied);
  if (R.thin) w.push(`Thin set: ${R.carrying} peer${R.carrying === 1 ? "" : "s"} carr${R.carrying === 1 ? "ies" : "y"} figures${R.band ? ` inside ±${R.band}×` : ""} — read with care, no single upside.`);
  else if (refuse) w.push(refuse);
  else if (R.midpoint != null) w.push(`${c.ticker} is ${R.read}: ${usd0(c.price)} against a ${usd0(R.midpoint)} midpoint of its peers' implied prices, ${rel(R.distance_pct)} it; ${priced.length} row${priced.length === 1 ? "" : "s"} priced on ${setWords}.`);
  else w.push(`${c.ticker}: no row could be priced on ${setWords} (a row needs three meaningful peers).`);
  const parts = [];
  if (c.loss_maker) parts.push(`loss-making: priced on sales only — ${x1(m.ev_sales)} EV/sales ${m.ev_sales_basis === "NTM" ? "NTM" : "trailing (no estimate)"} against ${x1(md.ev_sales)} for the set; no P/E or PEG on a negative figure`);
  else if (c.financial) { if (m.pe != null) parts.push(`${x1(m.pe)} NTM earnings against ${x1(md.pe)}`); if (m.pb != null) parts.push(`${x1(m.pb)} book against ${x1(md.pb)}`); }
  else { if (m.pe != null) parts.push(`${x1(m.pe)} NTM earnings against ${x1(md.pe)}`); if (m.ev_sales != null) parts.push(`EV/sales ${x1(m.ev_sales)} against ${x1(md.ev_sales)}`); }
  if (m.ps != null && md.ps != null) parts.push(`P/S ${x1(m.ps)} against ${x1(md.ps)}`);
  if (m.rev_growth_ntm_pct != null && R.peer_median_growth != null) parts.push(`growing ${m.rev_growth_ntm_pct.toFixed(0)}% against ${R.peer_median_growth.toFixed(0)}%`);
  if (parts.length) w.push(parts.join(", ") + ".");
  if (m.ps != null && md.ps != null && m.rev_growth_ntm_pct != null && R.peer_median_growth != null) {
    const sp = (m.ps / md.ps - 1) * 100, gd = m.rev_growth_ntm_pct - R.peer_median_growth;
    if (sp >= 25) w.push(`On price to sales it is ${sp.toFixed(0)}% over the set while growing ${Math.abs(gd).toFixed(0)} points ${gd >= 0 ? "faster" : "slower"}${m.ps_g != null && md.ps_g != null ? ` (P/S ÷ growth ${x1(m.ps_g)} against ${x1(md.ps_g)})` : ""}${gd < 0 || (m.ps_g != null && md.ps_g != null && m.ps_g > md.ps_g * 1.15) ? ": rich on sales even counting the growth" : ": the growth carries the sales premium"}.`);
  }
  const a = R.analysts;
  if (a.median != null && c.price) w.push(`Analysts ${usd0(a.low)} · ${usd0(a.median)} · ${usd0(a.high)} (low · median · high${a.last_quarter_n != null ? `, ${a.last_quarter_n} in the last quarter` : ""}); the median is ${rel((a.median / c.price - 1) * 100)} today's price.`);
  return w;
}

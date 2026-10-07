/* Scintilla · CP2 (7 Oct 2026) · THE BUSINESS BLOCK of a decision card. Pure: no fetch, no DOM.

   Alan, 7 Oct: "FMP segment and margin data, data-centre share of revenue — we should express it somewhere, when we
   expand the ticker selection on the dashboard, in pie charts … One has a higher percentage of data-centre revenue, the
   other one has higher margin. How would you blend that?"

   Input: one company's facts as tools/business-facts-fmp.mjs prints them (FMP /stable/: the revenue splits, the income
   and cash-flow statements by year and by quarter, FMP's own trailing-twelve-month cash flow, the profile).
   Output: the record a card carries under `business` — two pies, five chips, the blend.

   THE RULES, each stated once here and tested in tests/cards-tab-cp2.test.mjs:

   1. THE PIES are FMP's newest FISCAL-YEAR split, by business line and by region. A row that is negative or zero is
      dropped (hedging, reconciling items). Shares are of what the split adds to; when that is not within 5% of the
      year's revenue on the income statement, the pie says how much it covers. Past six slices the smallest fold into
      "Other". Labels are in plain words (LABELS, then a tidy-up); FMP's own label stays on the slice.
   2. THE PERIOD of the margins and the cash is the last four reported quarters. When FMP's fiscal-year statement
      covers those same twelve months it is used (one filed row instead of four added); otherwise the four quarters
      are added. If four consecutive quarters are not on file, the fiscal year is used and marked as older.
   3. FREE CASH FLOW = cash from operations less capital spending, as FMP forms it. A reading counts only when its
      capital-spending line is there: for the fiscal year, the property-and-equipment line must not be empty (an
      empty one marks a provisional row, taken from the earnings release before the annual report is parsed); by
      quarter, no quarter may show capital spending as a positive number (a sign slip). Same twelve months: the
      fiscal-year reading first, then the four quarters. Different twelve months: the four quarters first, then the
      fiscal year, marked older. No reading: no figure, with the reason. When both readings cover the same twelve
      months and sit more than 5% apart, the card marks it and carries both.
   4. BANKS AND LANDLORDS: gross margin, operating margin and free cash flow are not their yardsticks (a bank's
      "gross profit" and a REIT's capital spending are filed differently from quarter to year), so those chips are
      left empty for FMP industry "Banks …" and sector "Real Estate". The pies and the data-centre share stay.
   5. DATA-CENTRE SHARE: the slices of the business-line pie whose FMP label says data centre (DC_WORD), plus the
      hand list DC_HAND (each with its reason). Where the split has no such line and the company states the share on
      its own earnings call, that statement is used and marked approximate (data/data-centre-stated.json: the
      sentence, the call, the quarter it covers). Otherwise there is no figure.
   6. THE BLEND, both per dollar of stock, in cents:
        data-centre profit = data-centre share × the period's revenue × the company's gross margin ÷ market value
        cash               = free cash flow ÷ market value            (the free-cash-flow yield, in the same unit)
      Segment margins are not reported, so the COMPANY's gross margin is applied to the data-centre revenue.
   7. ONE CURRENCY: a figure is formed only when the statements and the market value are in the same currency. */

export const RULES = Object.freeze({ cover: 0.05, slicesMax: 6, differs: 0.05, quarterGapDays: [75, 110] });
export const DC_WORD = /data\s?cent(er|re)s?|datacenter/i;

/* The hand list: FMP labels that are the company's data-centre business although the label does not say so. */
export const DC_HAND = Object.freeze({
  WDC: { labels: ["Cloud"], why: "Western Digital's name for drives sold to cloud and enterprise data centres" },
  AMZN: { labels: ["Amazon Web Services"], why: "its cloud business: it sells data-centre computing" },
  GOOGL: { labels: ["Google Cloud"], why: "its cloud business: it sells data-centre computing" },
  IREN: { labels: ["AI Cloud"], why: "its AI cloud (rented graphics processors); the rest is bitcoin mining" },
  EQIX: { all: true, why: "a data-centre landlord: all of its revenue is data-centre space, power and connections" },
  DLR: { all: true, why: "a data-centre landlord: all of its revenue is data-centre rent and services" },
  CRWV: { all: true, why: "it rents data-centre computing and reports one business" },
});
/* Why a company has no data-centre figure, where the reason is worth saying. */
export const DC_NONE = Object.freeze({
  AVGO: "Broadcom reports chips and software; data centre is not split out",
  ORCL: "Oracle reports its cloud together with its licences",
  NBIS: "FMP carries no split by business line",
});

/* Plain words for FMP's labels. Keyed by ticker for the business lines; regions are shared. */
export const LABELS = Object.freeze({
  WDC: { "Cloud": "Data centre (cloud customers)", "Client Devices": "PCs and devices", "Retail Products": "Retail (consumer drives)" },
  SNDK: { "Edge": "Phones, PCs and devices", "Datacenter": "Data centre", "Consumer": "Consumer (retail)", "Client Devices": "PCs and devices", "Cloud": "Data centre" },
  MU: { "DRAM Products": "DRAM (working memory)", "NAND Products": "NAND (flash storage)" },
  NVDA: { "Data Center": "Data centre", "Gaming": "Gaming", "Professional Visualization": "Workstation graphics", "Automotive": "Cars", "OEM And Other": "Other" },
  AVGO: { "Semiconductor Solutions": "Chips", "Infrastructure Software": "Software" },
  GOOGL: { "Google Search & other": "Search", "Google Cloud": "Cloud", "Google subscriptions, platforms, and devices": "Subscriptions and devices", "YouTube ads": "YouTube ads", "Google Network": "Ad network", "Other Bets": "Other bets" },
  AMZN: { "Online Stores": "Online stores", "Third-Party Seller Services": "Seller services", "Amazon Web Services": "AWS (cloud)", "Advertising Services": "Advertising", "Subscription Services": "Subscriptions (Prime)", "Physical Stores": "Physical stores", "Other Services": "Other" },
  VST: { "Retail Segment": "Retail electricity", "East Segment": "Power plants, East", "Texas Segment": "Power plants, Texas", "West Segment": "Power plants, West", "Revenue From Other Wholesale Contracts": "Other wholesale" },
  BE: { "Product": "Fuel-cell systems", "Service": "Service", "Installation": "Installation", "Electricity": "Electricity sales" },
  IREN: { "Bitcoin Mining": "Bitcoin mining", "AI Cloud": "AI cloud" },
  EQIX: { "Recurring Revenues": "Recurring (space, power, connections)", "Non-Recurring Revenues": "One-off (installation)" },
  DLR: { "Rental And Other Services": "Rent and services", "Fee Income And Other": "Fees and other" },
  IRM: { "Global Records and Information Management Business": "Records storage", "Global Data Center Business": "Data centres" },
  LRCX: { "System": "New equipment", "Customer Support and Other": "Service, spares and upgrades" },
  CRDO: { "Reportable Segment": "One reported business" },
  COHR: { "Datacenter & Communications": "Data centre and communications", "Industrial": "Industrial" },
  AMAT: { "Semiconductor Systems": "Chip-making equipment", "Applied Global Services": "Service", "Corporate And Reconciling Items": "Corporate and other" },
  CEG: { "Constellation Mid Atlantic": "Mid-Atlantic", "Constellation Midwest": "Midwest", "Constellation Other Regions": "Other regions", "Constellation New York": "New York", "Constellation ERCOT": "Texas" },
  LLY: { "Product": "Medicines", "Collaboration and Other Revenue": "Partnerships and other" },
  JPM: { "Commercial And Investment Bank": "Commercial and investment bank", "Consumer & Community Banking": "Consumer banking", "Asset and Wealth Management Segment": "Asset and wealth management", "Segment Reporting, Reconciling Item, Corporate Nonsegment": "Corporate" },
  BAC: { "Consumer Banking Segment": "Consumer banking", "Global Wealth and Investment Management Segment": "Wealth management", "Global Banking Segment": "Corporate banking", "Global Markets Segment": "Markets (trading)" },
  ORCL: { "Cloud And License Business": "Cloud and licences", "Services Business": "Services", "Hardware Business": "Hardware" },
  AME: { "Electronic Instruments Group": "Electronic instruments", "Electromechanical Group": "Electromechanical" },
});
const REGION = Object.freeze({
  "UNITED STATES": "United States", "US": "United States", "TAIWAN, PROVINCE OF CHINA": "Taiwan", "TAIWAN": "Taiwan", "KOREA, REPUBLIC OF": "South Korea",
  "CHINA": "China", "HONG KONG": "Hong Kong", "JAPAN": "Japan", "SINGAPORE": "Singapore", "NETHERLANDS": "Netherlands", "AUSTRALIA": "Australia",
  "CANADA": "Canada", "UNITED KINGDOM": "United Kingdom", "EMEA": "Europe, Middle East & Africa", "E M E A": "Europe, Middle East & Africa",
  "Europe Middle East And Africa": "Europe, Middle East & Africa", "Asia Pacific": "Asia-Pacific", "Other Asia Pacific": "Rest of Asia-Pacific",
  "South East Asia": "South-east Asia", "Southeast Asia": "South-east Asia", "Others": "Rest of the world", "Other Countries": "Rest of the world",
  "Other Geographical": "Rest of the world", "Other Foreign Countries": "Rest of the world", "REST OF THE WORLD": "Rest of the world",
  "Non-US": "Outside the United States", "Americas Excluding United States": "Americas outside the US", "Other Americas": "Rest of the Americas",
  "North America Segment": "North America (stores)", "International Segment": "International (stores)", "Amazon Web Services Segment": "AWS (cloud)",
});
const tidy = (s) => {
  let t = String(s).replace(/\s+(Segment|Business|Group)$/i, "").replace(/\s+/g, " ").trim();
  if (t.length > 3 && t === t.toUpperCase()) t = t.toLowerCase().replace(/(^|[\s,/-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  return t;
};
/** FMP's label in plain words. kind: "product" | "geo". */
export function plainLabel(kind, raw, ticker) {
  const own = LABELS[ticker] || {};
  if (own[raw] != null) return own[raw];
  if (kind === "geo" && REGION[raw] != null) return REGION[raw];
  return tidy(raw);
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const pct = (a, b) => (num(a) != null && num(b) != null && b !== 0 ? (a / b) * 100 : null);
const r1 = (v, d = 1) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);
const days = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 86400e3);

/** One pie: FMP's newest fiscal-year split, in plain words. `dcLabels`: the FMP labels that count as data centre. */
export function pie(rows, kind, ticker, incomeRows = [], dcLabels = []) {
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || !row.data) return null;
  const kept = Object.entries(row.data).filter(([, v]) => num(v) != null && v > 0);
  const dropped = Object.entries(row.data).filter(([, v]) => !(num(v) != null && v > 0)).map(([k]) => k);
  if (!kept.length) return null;
  const total = kept.reduce((s, [, v]) => s + v, 0);
  let slices = kept.map(([k, v]) => ({ label: plainLabel(kind, k, ticker), fmp: k, revenue: v, share: r1((v / total) * 100), dc: kind === "product" && dcLabels.includes(k) }));
  /* two FMP labels that are the same thing in plain words (three "rest of the world" rows) are one slice */
  const byLabel = new Map();
  for (const s of slices) {
    const m = byLabel.get(s.label);
    if (!m) byLabel.set(s.label, { ...s, fmp_all: [s.fmp] });
    else { m.revenue += s.revenue; m.share = r1((m.revenue / total) * 100); m.dc = m.dc || s.dc; m.fmp_all.push(s.fmp); m.fmp = m.fmp_all.join(" + "); }
  }
  slices = [...byLabel.values()].map(({ fmp_all, ...s }) => s);
  slices.sort((a, b) => (b.dc ? 1 : 0) - (a.dc ? 1 : 0) || b.revenue - a.revenue);   // the data-centre slice first, then by size
  if (slices.length > RULES.slicesMax) {
    const head = slices.slice(0, RULES.slicesMax - 1), tail = slices.slice(RULES.slicesMax - 1);
    const rev = tail.reduce((s, x) => s + x.revenue, 0);
    slices = [...head, { label: "Other (" + tail.length + " smaller)", fmp: tail.map((x) => x.fmp).join(" + "), revenue: rev, share: r1((rev / total) * 100), dc: false, folded: tail.length }];
  }
  const inc = incomeRows.find((r) => String(r.fiscalYear) === String(row.fy)) || null;
  const cover = inc && num(inc.revenue) ? total / inc.revenue : null;
  const newest = incomeRows[0] || null;
  return {
    fy: Number(row.fy), date: row.date, currency: row.currency || null, total, slices,
    covers_pct: cover == null ? null : r1(cover * 100, 0),
    partial: cover != null && Math.abs(cover - 1) > RULES.cover,
    behind: !!(newest && String(newest.fiscalYear) !== String(row.fy)),   // the split is an older fiscal year than the newest statement
    newest_fy: newest ? Number(newest.fiscalYear) : null,
    dropped,
  };
}

/** The twelve months the margins and the cash are read on. */
export function period(income = [], incomeQ = []) {
  const fy = income[0] || null, q = (incomeQ || []).slice(0, 4);
  const lo = RULES.quarterGapDays[0], hi = RULES.quarterGapDays[1];
  const consecutive = q.length === 4 && q.every((r, i) => i === 0 || (days(q[i - 1].date, r.date) >= lo && days(q[i - 1].date, r.date) <= hi)) && q.every((r) => num(r.revenue) != null);
  const sum = (k) => q.reduce((s, r) => s + (num(r[k]) || 0), 0);
  if (fy && q.length && q[0].date === fy.date)
    return { basis: "fy", end: fy.date, fy: Number(fy.fiscalYear), currency: fy.reportedCurrency || null, revenue: num(fy.revenue), gross_profit: num(fy.grossProfit), operating_income: num(fy.operatingIncome) };
  if (consecutive)
    return { basis: "q4", end: q[0].date, fy: fy ? Number(fy.fiscalYear) : null, currency: q[0].reportedCurrency || (fy && fy.reportedCurrency) || null, revenue: sum("revenue"), gross_profit: sum("grossProfit"), operating_income: sum("operatingIncome") };
  if (fy)
    return { basis: "fy_older", end: fy.date, fy: Number(fy.fiscalYear), currency: fy.reportedCurrency || null, revenue: num(fy.revenue), gross_profit: num(fy.grossProfit), operating_income: num(fy.operatingIncome) };
  return null;
}

/** Rule 4. */
export function notItsYardstick(profile) {
  const ind = String((profile && profile.industry) || ""), sec = String((profile && profile.sector) || "");
  if (/^Banks/i.test(ind)) return "a bank: margins and free cash flow are not its yardsticks";
  if (/^Real Estate$/i.test(sec)) return "a landlord: valued on funds from operations, not on margins or free cash flow";
  return null;
}

export function margins(per, profile) {
  const why = notItsYardstick(profile);
  if (why) return { gross: null, operating: null, why };
  if (!per || !num(per.revenue)) return { gross: null, operating: null, why: "no income statement on file" };
  return { gross: r1(pct(per.gross_profit, per.revenue)), operating: r1(pct(per.operating_income, per.revenue)), why: null };
}

/** Rule 3. Returns the reading used, the other one when it exists, and whether they disagree. */
export function freeCashFlow(cash = [], cashQ = [], per, profile) {
  const why4 = notItsYardstick(profile);
  if (why4) return { fcf: null, basis: null, why: why4 };
  const fyRow = cash[0] || null, q = (cashQ || []).slice(0, 4);
  const ocf = (r) => num(r.netCashProvidedByOperatingActivities) ?? num(r.operatingCashFlow);
  const fy = fyRow && num(fyRow.freeCashFlow) != null && ocf(fyRow) != null
    ? { basis: "fy", end: fyRow.date, fcf: fyRow.freeCashFlow, ocf: ocf(fyRow), capex: num(fyRow.capitalExpenditure),
        ok: !!num(fyRow.investmentsInPropertyPlantAndEquipment) && !!num(fyRow.capitalExpenditure),
        bad: !num(fyRow.investmentsInPropertyPlantAndEquipment) ? "the fiscal-year row has no property-and-equipment line yet" : null }
    : null;
  const lo = RULES.quarterGapDays[0], hi = RULES.quarterGapDays[1];
  const consecutive = q.length === 4 && q.every((r, i) => i === 0 || (days(q[i - 1].date, r.date) >= lo && days(q[i - 1].date, r.date) <= hi));
  let q4 = null;
  if (consecutive && q.every((r) => num(r.freeCashFlow) != null && ocf(r) != null)) {
    const slip = q.filter((r) => (num(r.capitalExpenditure) || 0) > 0).map((r) => r.date);
    const none = q.every((r) => !num(r.capitalExpenditure));
    q4 = { basis: "q4", end: q[0].date, fcf: q.reduce((s, r) => s + r.freeCashFlow, 0), ocf: q.reduce((s, r) => s + ocf(r), 0), capex: q.reduce((s, r) => s + (num(r.capitalExpenditure) || 0), 0),
      ok: !slip.length && !none, bad: slip.length ? "capital spending is filed as a positive number in the quarter to " + slip.join(", ") : none ? "no capital-spending line in the quarters" : null };
  }
  const same = !!(fy && q4 && fy.end === q4.end);
  const order = same || !q4 ? [fy, q4] : [q4, fy];
  const used = order.find((x) => x && x.ok) || null, other = [fy, q4].find((x) => x && x !== used) || null;
  if (!used) {
    const noLine = !(fy && num(fy.capex)) && !(q4 && num(q4.capex));
    return { fcf: null, basis: null, end: null, why: noLine ? "FMP carries no capital-spending line for this company" : ([fy && fy.bad, q4 && q4.bad].filter(Boolean)[0] || "no cash-flow statement on file") };
  }
  const out = { fcf: used.fcf, ocf: used.ocf, capex: used.capex, basis: used.basis, end: used.end,
    older: !!(per && used.end !== per.end),            // the reading is an older twelve months than the margins
    why: null, note: null, other: other ? { basis: other.basis, end: other.end, fcf: other.fcf, ok: other.ok, bad: other.bad } : null, differs_pct: null, differs: false };
  if (other && same && used.fcf) {
    out.differs_pct = r1((other.fcf / used.fcf - 1) * 100);
    out.differs = Math.abs(other.fcf / used.fcf - 1) > RULES.differs;
  }
  if (used.basis === "fy" && !same && q4 && !q4.ok) out.note = "the newer four quarters are not used: " + q4.bad;
  return out;
}

/** Rule 5. `lines`: the business-line pie (or null). `stated`: the company's own statement (or undefined). */
export function dcLabelsFor(ticker, productRows) {
  const row = Array.isArray(productRows) ? productRows[0] : null, hand = DC_HAND[ticker];
  if (!row || !row.data) return [];
  const keys = Object.keys(row.data).filter((k) => num(row.data[k]) != null && row.data[k] > 0);
  if (hand && hand.all) return keys;
  return keys.filter((k) => DC_WORD.test(k) || (hand && hand.labels && hand.labels.includes(k)));
}
export function dataCentre(ticker, lines, stated) {
  const hand = DC_HAND[ticker];
  if (hand && hand.all)
    return { share: 100, basis: "hand", approx: false, counts: lines ? lines.slices.map((s) => s.fmp) : [], why: hand.why, fy: lines ? lines.fy : null };
  const hit = lines ? lines.slices.filter((s) => s.dc) : [];
  if (hit.length) {
    const share = r1(hit.reduce((s, x) => s + x.revenue, 0) / lines.total * 100);
    const byHand = hand && hand.labels && hit.some((s) => hand.labels.some((l) => s.fmp.split(" + ").includes(l)));
    const mixed = hit.some((s) => /&|\band\b/i.test(s.fmp) && !/^data\s?cent(er|re)s?$/i.test(s.fmp.trim()) && !byHand);
    return { share, basis: byHand ? "hand" : "segments", approx: false, counts: hit.map((s) => s.fmp), why: byHand ? hand.why : null, fy: lines.fy,
      note: mixed ? "FMP's line is " + hit.map((s) => s.fmp).join(" + ") + ": it carries more than data centre" : null };
  }
  if (stated && num(stated.share) != null)
    return { share: stated.share, basis: "stated", approx: true, counts: [], why: stated.reading || null, quote: stated.quote, call: stated.call, covers: stated.covers || null, fy: null };
  return { share: null, basis: null, approx: false, counts: [], why: DC_NONE[ticker] || (lines ? "no data-centre line in FMP's split" : "FMP carries no split by business line") };
}

/** Rules 6 and 7. Cents per dollar of stock. */
export function blend(dc, per, mar, cash, profile) {
  const mv = profile && num(profile.marketCap), sameCcy = !!(per && profile && per.currency && profile.currency && per.currency === profile.currency);
  const out = { dc_profit_per_dollar: null, cash_per_dollar: null, dc_revenue: null, gross_margin: mar ? mar.gross : null, market_value: mv, approx: !!(dc && dc.approx), why_dc: null, why_cash: null };
  if (!mv) { out.why_dc = out.why_cash = "no market value on file"; return out; }
  if (!sameCcy) { out.why_dc = out.why_cash = "the statements and the market value are not in the same currency"; return out; }
  if (cash && num(cash.fcf) != null) out.cash_per_dollar = r1((cash.fcf / mv) * 100, 2); else out.why_cash = (cash && cash.why) || "no free-cash-flow figure";
  if (!dc || dc.share == null) out.why_dc = (dc && dc.why) || "no data-centre figure";
  else if (!mar || mar.gross == null) out.why_dc = (mar && mar.why) || "no gross margin";
  else if (!per || !num(per.revenue)) out.why_dc = "no revenue on file";
  else { out.dc_revenue = (dc.share / 100) * per.revenue; out.dc_profit_per_dollar = r1(((out.dc_revenue * mar.gross) / 100 / mv) * 100, 2); }
  return out;
}

/** Everything a card carries under `business`. */
export function businessOf(ticker, facts, stated) {
  if (!facts) return null;
  const dcl = dcLabelsFor(ticker, facts.product);
  const lines = pie(facts.product, "product", ticker, facts.income || [], dcl);
  const regions = pie(facts.geo, "geo", ticker, facts.income || [], []);
  const per = period(facts.income || [], facts.income_q || []);
  const mar = margins(per, facts.profile);
  const cash = freeCashFlow(facts.cash || [], facts.cash_q || [], per, facts.profile);
  const dc = dataCentre(ticker, lines, stated);
  const mv = facts.profile && num(facts.profile.marketCap);
  const sameCcy = !!(per && facts.profile && per.currency && facts.profile.currency === per.currency);
  if (cash && num(cash.fcf) != null) {
    /* the margin is over the revenue of the SAME twelve months as the cash */
    const fyRow = (facts.income || []).find((r) => r.date === cash.end);
    const rev = per && cash.end === per.end ? per.revenue : fyRow ? fyRow.revenue : null;
    cash.margin = r1(pct(cash.fcf, rev));
    cash.yield = mv && sameCcy ? r1(pct(cash.fcf, mv), 2) : null;
  }
  return {
    lines, regions, period: per, margins: mar, cash, data_centre: dc, blend: blend(dc, per, mar, cash, facts.profile),
    market_value: mv, price: facts.profile ? num(facts.profile.price) : null, currency: facts.profile ? facts.profile.currency : null,
    sector: facts.profile ? facts.profile.sector : null, industry: facts.profile ? facts.profile.industry : null,
  };
}

/* TREASURY AUCTIONS — what one TreasuryDirect row becomes in public.treasury_auctions.
   HM2, 7 Oct 2026. No imports, so the edge function, the loader script and the offline tests share ONE mapping.

   SOURCE: TreasuryDirect's own web service, free, no key:
     https://www.treasurydirect.gov/TA_WS/securities/search?format=json&type=Note|Bond&startDate=&endDate=&dateFieldName=auctionDate
   WHAT IS KEPT: nominal notes and bonds only (no TIPS, no floating-rate notes, no bills), in the seven terms Alan named.
   A REOPENING is filed by Treasury under its remaining life ("9-Year 10-Month"); its `originalSecurityTerm` is the
   term everyone calls it by ("10-Year"), and that is the bucket every comparison uses. */

export const TERMS = Object.freeze(["2-Year", "3-Year", "5-Year", "7-Year", "10-Year", "20-Year", "30-Year"]);
export const SOURCE = "TreasuryDirect TA_WS";
export const SEARCH_URL = "https://www.treasurydirect.gov/TA_WS/securities/search";
/* Treasury's own one-page documents for an auction: the announcement (A_…) and the results (R_…). The web service
   gives the file name; the folder is the year in the name. Checked 7 Oct 2026: R_20261007_2.pdf answers 200. */
export const PDF_BASE = "https://www.treasurydirect.gov/instit/annceresult/press/preanre/";
const pdfName = (v) => (typeof v === "string" && /^[A-Z]{1,3}_\d{8}_\d+\.pdf$/.test(v.trim()) ? v.trim() : null);
export function officialPdfUrl(file) { const f = pdfName(file); return f ? PDF_BASE + f.slice(f.indexOf("_") + 1, f.indexOf("_") + 5) + "/" + f : null; }

const num = (v) => { if (v === null || v === undefined || String(v).trim() === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const day = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const pct = (part, whole) => (part == null || !whole ? null : Math.round((part / whole) * 100000) / 1000);

/** One TreasuryDirect security → one table row, or null when it is not one of the seven nominal coupon terms. */
export function auctionRow(r) {
  if (!r || typeof r !== "object") return null;
  if (r.tips === "Yes" || r.floatingRate === "Yes") return null;
  const type = r.securityType || r.type;
  if (type !== "Note" && type !== "Bond") return null;
  const term = r.originalSecurityTerm || r.securityTerm;
  if (!TERMS.includes(term)) return null;
  const auction_date = day(r.auctionDate), cusip = String(r.cusip || "").trim();
  if (!auction_date || !cusip) return null;
  const competitive = num(r.competitiveAccepted), high_yield = num(r.highYield);
  const indirect = num(r.indirectBidderAccepted), direct = num(r.directBidderAccepted), dealer = num(r.primaryDealerAccepted);
  return {
    cusip, auction_date, term,
    security_term: r.securityTerm || null, security_type: type,
    reopening: r.reopening === "Yes" ? true : r.reopening === "No" ? false : null,
    announcement_date: day(r.announcementDate), issue_date: day(r.issueDate), maturity_date: day(r.maturityDate),
    closing_time_et: r.closingTimeCompetitive || null,
    offering_amount: num(r.offeringAmount),
    high_yield, median_yield: num(r.averageMedianYield), low_yield: num(r.lowYield), coupon: num(r.interestRate),
    bid_to_cover: num(r.bidToCoverRatio),
    competitive_accepted: competitive, indirect_accepted: indirect, direct_accepted: direct, dealer_accepted: dealer,
    total_accepted: num(r.totalAccepted), total_tendered: num(r.totalTendered), soma_accepted: num(r.somaAccepted),
    /* the takedown: each bidder class's share of what the public competitive bidders were awarded */
    indirect_pct: pct(indirect, competitive), direct_pct: pct(direct, competitive), dealer_pct: pct(dealer, competitive),
    /* a result exists once Treasury has printed the stop; before that the row is the announcement */
    announcement_pdf: pdfName(r.pdfFilenameAnnouncement), results_pdf: pdfName(r.pdfFilenameCompetitiveResults),
    status: high_yield != null ? "auctioned" : "announced",
    source: SOURCE, source_updated_at: typeof r.updatedTimestamp === "string" ? r.updatedTimestamp : null,
  };
}

/** Many TreasuryDirect rows → table rows, one per (cusip, auction date), newest first. */
export function auctionRows(list) {
  const seen = new Map();
  for (const r of list || []) { const row = auctionRow(r); if (row) seen.set(row.cusip + "|" + row.auction_date, row); }
  return [...seen.values()].sort((a, b) => (a.auction_date < b.auction_date ? 1 : a.auction_date > b.auction_date ? -1 : a.term.localeCompare(b.term)));
}

/** The comparison the page prints: this auction against the average of the SIX auctions of the same term before it. */
export function againstLastSix(rows, row, n = 6) {
  const prior = (rows || []).filter((x) => x.term === row.term && x.status === "auctioned" && x.auction_date < row.auction_date)
    .sort((a, b) => (a.auction_date < b.auction_date ? 1 : -1)).slice(0, n);
  const avg = (k) => { const v = prior.map((x) => x[k]).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  return { n: prior.length, prior, bid_to_cover: avg("bid_to_cover"), indirect_pct: avg("indirect_pct"), direct_pct: avg("direct_pct"),
    dealer_pct: avg("dealer_pct"), high_yield: avg("high_yield") };
}

export function searchUrl(type, from, to) {
  return SEARCH_URL + "?format=json&type=" + encodeURIComponent(type) + "&startDate=" + from + "&endDate=" + to + "&dateFieldName=auctionDate";
}

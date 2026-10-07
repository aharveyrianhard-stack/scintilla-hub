/* Scintilla · comps C5 (3 Oct) · THE METHOD, written down first. Pure: no fetch, no DOM.

   1. BUSINESS SIMILARITY DECIDES MEMBERSHIP; SIZE ONLY RANKS WITHIN IT (Alan, 3 Oct: "you're kicking them all out
      because of size, so Amazon just sits with the mega caps").
   Every served company carries a LINE VECTOR: shares of revenue by business line, adding to one.
     - the default line is the company's FMP industry (INDUSTRY_LINES maps every served industry to a line and a family);
     - where FMP's revenue-by-product segments exist (segments-<date>.json, pulled on Fly), a segment moves its share
       to another line only through the stated KEYWORDS (cloud, advertising, e-commerce, physical stores, investment
       banking, wealth, payments, upstream, downstream …), each keyword limited to the families it makes sense in
       (Western Digital's "Cloud" is disk drives, not AWS); a segment that matches nothing stays on the default line;
       reconciling / eliminations / other rows and negative rows are dropped before the shares are taken;
     - HAND fixes the default line for a few names FMP files under a misleading industry (AMZN, BABA, JD, PDD, MELI are
       "Specialty Retail" to FMP; they are e-commerce) — each says "hand" as its source.
   SIMILARITY of two companies = Σ over lines of min(share_a, share_b)   (the revenue they make in the same line)
                              + ½ · Σ over families of the residual overlap (the same family, a different line).
   MEMBER if similarity ≥ SIM_MIN (0.15: at least fifteen cents of every revenue dollar in a shared business).
   SEATS: every line the company has at ≥ LINE_MIN (0.15) of revenue seats its two best peers first (so Amazon's cloud
   line seats cloud peers even when the retail peers outscore them), then the rest fill to N by score.
   SCORE = similarity − SIZE_WEIGHT · |log10(peer market value ÷ own)| (a 10× size gap costs 0.06; never a gate)
         + NAMED_BONUS when FMP's peers or Massive's related companies also name it (0.03: evidence, not admission).
   One share class per company (GOOG / GOOGL, BRK-B / BRK.A).
   2. The reason per peer is the shared lines with both shares, the source that decided it (segments / industry / hand),
      the size ratio and who else named it.

   CP1 (6 Oct) · FIXES PROPOSED INSIDE THIS METHOD. Each is a named switch, OFF until Alan says (CP1_DEFAULT below is the
   one line that takes them live); with every switch off this file answers exactly as C5 left it.
     memoryStorage  Micron, SanDisk, Western Digital, Seagate: the universe holds two memory makers and two disk-drive
                    makers, so "memory" and "storage" are ONE business line ("memory & storage", family SEMIS — the
                    tree's MEMORY & STORAGE cohort hangs from AI and SEMIS). FormFactor leaves the line by hand: its
                    "DRAM" and "Flash" segments are probe cards sold TO memory makers (10-K), which the memory keyword
                    read as memory revenue (and its "Foundry & Logic" probe cards as a foundry).
     dcReit         Data-centre landlords are their own line, "data-centre reit", by hand: Equinix and Digital Realty
                    (their segments read "recurring revenues" and "rental", which name no business) and Iron Mountain,
                    seated with them by instruction (Alan and the tree's DATACENTER PROPERTY cohort) although its FY2025
                    revenue is 13% data centres and 87% records storage — said on its row, never hidden.
     complement     "Complement it, not destroy it" (Alan, 6 Oct): the kept set stays as it is; when it carries fewer
                    than SAME_MIN same-business peers (at least SIM_MIN of revenue in a line shared exactly), the
                    remaining same-business companies are ADDED, best score first, until it has SAME_MIN or the line
                    runs out — and then the set says how many the universe holds. Never beyond N_MAX.
     reference      Comps-only reference peers (REFERENCE_PEERS): leaders of a line that the Hub does not serve
                    (SK hynix, Samsung Electronics, Kioxia). They join a set only through `complement`, only for a
                    company whose main line is the one they are listed for, are never ranked on the board, and are
                    priced only when the dated facts file carries their figures (comps-c5/reference.mjs). A caller
                    that reads figures for a set leaves out a reference row without them (`reference && !has_figures`),
                    as decision-cards/tools/comps-run.mjs does: it has no row in any table. */

export const SIM_MIN = 0.15, LINE_MIN = 0.15, SIZE_WEIGHT = 0.06, NAMED_BONUS = 0.03, N_DEFAULT = 12, NS = [8, 10, 12, 15, 20], SEATS_PER_LINE = 2;
export const DUAL = { GOOG: "GOOGL", "BRK.A": "BRK-B" };   // the class dropped → the class kept
/* CP1 · the switches (see the header). OFF = C5 exactly. */
export const SAME_MIN = 6, N_MAX = 20;
export const CP1_LINES_OFF = Object.freeze({ memoryStorage: false, dcReit: false, complement: false, reference: false });
export const CP1_LINES_ON = Object.freeze({ memoryStorage: true, dcReit: true, complement: true, reference: true });
/* CP3 (7 Oct) · STATED SAME-BUSINESS SETS — `stated`, one more switch of the same kind (off = CP1 exactly).
   Alan, 7 Oct: "I need to see Google, Amazon and Broadcom — what the comps would look like … full treatment, comps,
   everything measured against the other leaders, critiquing our comps processes." The four sources still vote and the
   kept set is still shown whole, but for the names below THE PRICE COMES FROM THE PEERS THAT DO THE SAME BUSINESS, stated
   here by name and dated. A stated peer that is not in the kept set is added to it (never one removed); a kept peer that
   is not stated is shown and not priced. The line vectors could not say these by themselves: every chip company files as
   "Semiconductors" (designers, equipment makers and foundries alike), a utility's industry does not say whether its
   prices are regulated, and Alphabet and Amazon are each two businesses.
   `from` says whose words the set is: the coordinator's brief of 7 Oct quoting Alan, or this lane's own proposal. */
export const CP3_STATED = {
  GOOGL: { line: "search and advertising, with a cloud", peers: ["META", "MSFT", "AMZN", "PINS", "RDDT", "SNAP", "APP"], not_served: ["TTD"], from: "the 7 Oct brief: search/ads + cloud — Meta, Microsoft, Amazon and the ad platforms",
    why: "Meta is the other advertising giant, Microsoft and Amazon the other two clouds; Pinterest, Reddit, Snap and AppLovin are the ad platforms we serve. Out: Netflix, Spotify and Baidu, which shared its FMP industry and not its business" },
  AMZN: { line: "retail and e-commerce, with a cloud", peers: ["WMT", "COST", "TGT", "MELI", "SHOP", "BABA", "JD", "PDD", "MSFT", "GOOGL", "ORCL"], legs: { "retail and e-commerce": ["WMT", "COST", "TGT", "MELI", "SHOP", "BABA", "JD", "PDD"], cloud: ["MSFT", "GOOGL", "ORCL"] }, from: "the 7 Oct brief: retail + cloud, as a split view; Alan, 7 Oct ~11:20: \"ratios are ratios — do the currency, and the Chinese names should be included for Amazon\"",
    why: "two businesses, so two legs: Walmart, Costco, Target, MercadoLibre, Shopify, Alibaba, JD and PDD for the store, Microsoft, Alphabet and Oracle for the cloud. The three Chinese names report in yuan: their earnings are put in dollars at the supplier's own rate and they price Amazon like any other peer" },
  AVGO: { line: "chip designers", peers: ["NVDA", "AMD", "MRVL", "QCOM", "ARM"], from: "the 7 Oct brief: chip designers — Nvidia, AMD, Marvell, Qualcomm, Arm; equipment makers out",
    why: "companies that design chips and have them made by a foundry. Out: the equipment makers (Lam, Applied, KLA, ASML), which sell to the fabs and are priced on a different cycle" },
  NVDA: { line: "chip designers", peers: ["AVGO", "AMD", "MRVL", "QCOM", "ARM"], from: "the 7 Oct brief: chip designers — Broadcom, AMD, Marvell, Qualcomm, Arm; equipment makers out",
    why: "companies that design chips and have them made by a foundry. Out: the equipment makers, and Palantir, which the kept set carried on 120 times earnings" },
  TSM: { line: "foundry, and the customers it makes chips for", peers: ["GFS", "TSEM", "NVDA", "AMD", "AVGO", "QCOM", "MRVL", "AAPL"], legs: { foundries: ["GFS", "TSEM"], "its customers": ["NVDA", "AMD", "AVGO", "QCOM", "MRVL", "AAPL"] }, not_served: ["UMC", "SMIC"], from: "the 7 Oct brief: foundry and its customers' multiples",
    why: "only two other foundries are served (GlobalFoundries, Tower) and neither is at the leading edge, so its customers' multiples stand beside them: TSMC's earnings are the other side of theirs" },
  VST: { line: "independent power", peers: ["CEG", "TLN", "NRG"], from: "the 7 Oct brief: independent power — Constellation, Talen, NRG; regulated utilities out",
    why: "they sell power at market prices, as Vistra does. Out: the regulated utilities, whose prices and returns are set by a regulator and which grow in single digits" },
  MU: { line: "memory & storage", peers: ["SNDK", "WDC", "STX", "000660.KS", "005930.KS", "285A.T"], from: "Alan, 6 Oct: memory companies — SanDisk, SK hynix; the 7 Oct brief adds Samsung and Kioxia",
    why: "memory and storage makers, with the three foreign memory leaders as comps-only reference peers" },
  ORCL: { line: "cloud and enterprise software", peers: ["MSFT", "GOOGL", "AMZN", "IBM", "CRM", "NOW", "SNOW", "MDB"], not_served: ["SAP", "WDAY"], from: "this lane's proposal (the brief names no set for Oracle)",
    why: "the three clouds it now competes with for AI capacity, and the enterprise software and database companies it has always sold beside" },
};
export const CP3_LINES_ON = Object.freeze({ memoryStorage: true, dcReit: true, complement: true, reference: true, stated: true });
export const CP1_DEFAULT = CP1_LINES_OFF;   // ← change to CP1_LINES_ON to take the four line fixes live (Hub comps + the allocation knockout read this file)
/** memoryStorage: the lines that count as one. */
export const ONE_LINE = { memory: "memory & storage", storage: "memory & storage" };
const canonLines = (lines, fx) => { if (!(fx && fx.memoryStorage)) return lines; const o = {}; for (const [l, w] of Object.entries(lines)) { const c = ONE_LINE[l] || l; o[c] = (o[c] || 0) + w; } return o; };
/** Hand rules and keywords that exist only under a CP1 switch. */
export const CP1_HAND = {
  memoryStorage: { FORM: { lines: { "semiconductor equipment": 1 }, from: "hand rule (10-K): probe cards for chip makers; its DRAM and Flash segments are test equipment, not memory" } },
  dcReit: { EQIX: { lines: { "data-centre reit": 1 }, from: "hand rule (10-K): data-centre landlord" }, DLR: { lines: { "data-centre reit": 1 }, from: "hand rule (10-K): data-centre landlord" },
    IRM: { lines: { "data-centre reit": 1 }, from: "hand rule: seated with the data-centre landlords by instruction (6 Oct) and the tree's DATACENTER PROPERTY cohort; by FY2025 revenue it is 13% data centres, 87% records storage" } },
};
/** Comps-only reference peers: not served on the Hub, never on the board. `lines` are hand vectors (annual reports;
    Samsung's is approximate and is replaced by FMP's revenue segments when the facts file carries them). */
export const REFERENCE_PEERS = {
  "000660.KS": { name: "SK hynix", for_line: "memory & storage", country: "KR", currency: "KRW", lines: { memory: 1 }, also: ["SKHY", "SKHYV"], note: "DRAM and NAND; the US line is SKHY (Nasdaq ADS, 10 ADS = 1 share)" },
  "005930.KS": { name: "Samsung Electronics", for_line: "memory & storage", country: "KR", currency: "KRW", lines: { memory: 0.3, "consumer electronics": 0.55, "electronic components": 0.15 }, also: ["SSNLF"], note: "memory is about three-tenths of revenue (approximate) and most of the profit" },
  "285A.T": { name: "Kioxia Holdings", for_line: "memory & storage", country: "JP", currency: "JPY", lines: { memory: 1 }, also: [], note: "NAND flash" },
};

/** Every served FMP industry → [line, family]. A line is a business; a family is the neighbourhood a line sits in. */
export const INDUSTRY_LINES = {
  "Specialty Retail": ["specialty retail", "RETAIL"], "Discount Stores": ["discount stores", "RETAIL"], "Apparel - Retail": ["apparel retail", "RETAIL"], "Home Improvement": ["home improvement retail", "RETAIL"], "Grocery Stores": ["grocery", "RETAIL"], "Apparel - Footwear & Accessories": ["apparel & footwear", "CONSUMER"],
  "Software - Application": ["application software", "SOFTWARE"], "Software - Infrastructure": ["infrastructure software", "SOFTWARE"], "Information Technology Services": ["it services", "SOFTWARE"], "Technology Distributors": ["it distribution", "HARDWARE"],
  "Internet Content & Information": ["internet platforms", "INTERNET"], "Entertainment": ["entertainment", "INTERNET"], "Electronic Gaming & Multimedia": ["gaming", "INTERNET"], "Advertising Agencies": ["ad agencies", "INTERNET"], "Publishing": ["publishing", "INTERNET"],
  "Semiconductors": ["semiconductors", "SEMIS"], "Semiconductor Equipment & Materials": ["semiconductor equipment", "SEMIS"],
  "Computer Hardware": ["computer hardware", "HARDWARE"], "Communication Equipment": ["networking equipment", "HARDWARE"], "Consumer Electronics": ["consumer electronics", "HARDWARE"], "Hardware, Equipment & Parts": ["electronic components", "HARDWARE"], "Electronic Components": ["electronic components", "HARDWARE"], "Scientific & Technical Instruments": ["instruments", "HARDWARE"],
  "Banks - Diversified": ["diversified banking", "BANKS"], "Banks - Regional": ["regional banking", "BANKS"], "Financial - Capital Markets": ["capital markets", "BANKS"], "Investment - Banking & Investment Services": ["capital markets", "BANKS"], "Asset Management": ["asset management", "BANKS"], "Financial - Credit Services": ["payments & credit", "PAYMENTS"], "Financial - Data & Stock Exchanges": ["exchanges & data", "PAYMENTS"], "Financial - Mortgages": ["mortgages", "BANKS"],
  "Insurance - Property & Casualty": ["p&c insurance", "INSURANCE"], "Insurance - Diversified": ["diversified insurance", "INSURANCE"], "Insurance - Brokers": ["insurance brokers", "INSURANCE"], "Insurance - Life": ["life insurance", "INSURANCE"],
  "Drug Manufacturers - General": ["pharma", "PHARMA"], "Drug Manufacturers - Specialty & Generic": ["specialty pharma", "PHARMA"], "Biotechnology": ["biotech", "PHARMA"],
  "Medical - Devices": ["medical devices", "MEDTECH"], "Medical - Instruments & Supplies": ["medical instruments", "MEDTECH"], "Medical - Diagnostics & Research": ["diagnostics & research", "MEDTECH"], "Medical - Healthcare Plans": ["health plans", "HEALTH SERVICES"], "Medical - Care Facilities": ["care facilities", "HEALTH SERVICES"], "Medical - Distribution": ["medical distribution", "HEALTH SERVICES"], "Medical - Healthcare Information Services": ["health it", "HEALTH SERVICES"], "Medical - Pharmaceuticals": ["pharma", "PHARMA"],
  "Oil & Gas Integrated": ["integrated oil", "ENERGY"], "Oil & Gas Exploration & Production": ["upstream", "ENERGY"], "Oil & Gas Refining & Marketing": ["downstream", "ENERGY"], "Oil & Gas Midstream": ["midstream", "ENERGY"], "Oil & Gas Equipment & Services": ["oilfield services", "ENERGY"], "Oil & Gas Drilling": ["oilfield services", "ENERGY"], "Uranium": ["uranium", "ENERGY"], "Coal": ["coal", "ENERGY"],
  "Regulated Electric": ["regulated electric", "UTILITIES"], "Regulated Gas": ["regulated gas", "UTILITIES"], "Diversified Utilities": ["diversified utility", "UTILITIES"], "Independent Power Producers": ["power producers", "UTILITIES"], "Solar": ["solar", "UTILITIES"], "Renewable Utilities": ["renewables", "UTILITIES"], "Regulated Water": ["water utility", "UTILITIES"],
  "Aerospace & Defense": ["aerospace & defense", "AERO"], "Industrial - Machinery": ["machinery", "INDUSTRIALS"], "Electrical Equipment & Parts": ["electrical equipment", "INDUSTRIALS"], "Conglomerates": ["conglomerate", "INDUSTRIALS"], "Engineering & Construction": ["engineering & construction", "INDUSTRIALS"], "Industrial - Distribution": ["industrial distribution", "INDUSTRIALS"], "Construction Materials": ["construction materials", "MATERIALS"], "Building Materials": ["construction materials", "MATERIALS"], "Waste Management": ["waste", "INDUSTRIALS"], "Rental & Leasing Services": ["rental & leasing", "INDUSTRIALS"], "Specialty Business Services": ["business services", "INDUSTRIALS"], "Manufacturing - Metal Fabrication": ["metal fabrication", "INDUSTRIALS"], "Packaging & Containers": ["packaging", "MATERIALS"], "Agricultural - Machinery": ["farm & construction machinery", "INDUSTRIALS"], "Industrial - Pollution & Treatment Controls": ["environmental equipment", "INDUSTRIALS"], "Security & Protection Services": ["security services", "INDUSTRIALS"], "Staffing & Employment Services": ["staffing", "INDUSTRIALS"],
  "Railroads": ["railroads", "TRANSPORT"], "Trucking": ["trucking", "TRANSPORT"], "Airlines, Airports & Air Services": ["airlines", "TRANSPORT"], "Integrated Freight & Logistics": ["logistics", "TRANSPORT"], "Marine Shipping": ["shipping", "TRANSPORT"],
  "Auto - Manufacturers": ["auto manufacturing", "AUTOS"], "Auto - Parts": ["auto parts", "AUTOS"], "Auto - Dealerships": ["auto dealers", "AUTOS"],
  "Chemicals": ["commodity chemicals", "MATERIALS"], "Chemicals - Specialty": ["specialty chemicals", "MATERIALS"], "Steel": ["steel", "MATERIALS"], "Copper": ["copper", "MATERIALS"], "Gold": ["gold", "MATERIALS"], "Silver": ["silver", "MATERIALS"], "Other Precious Metals": ["precious metals", "MATERIALS"], "Industrial Materials": ["critical minerals", "MATERIALS"], "Agricultural Inputs": ["agricultural inputs", "MATERIALS"], "Aluminum": ["aluminum", "MATERIALS"], "Paper, Lumber & Forest Products": ["forest products", "MATERIALS"],
  "Beverages - Non-Alcoholic": ["beverages", "STAPLES"], "Beverages - Alcoholic": ["alcohol", "STAPLES"], "Household & Personal Products": ["household products", "STAPLES"], "Tobacco": ["tobacco", "STAPLES"], "Packaged Foods": ["packaged foods", "STAPLES"], "Food Confectioners": ["packaged foods", "STAPLES"], "Food Distribution": ["food distribution", "STAPLES"], "Agricultural Farm Products": ["farm products", "STAPLES"],
  "Restaurants": ["restaurants", "CONSUMER"], "Travel Services": ["travel", "CONSUMER"], "Travel Lodging": ["lodging", "CONSUMER"], "Gambling, Resorts & Casinos": ["casinos & betting", "CONSUMER"], "Leisure": ["leisure", "CONSUMER"], "Personal Products & Services": ["personal services", "CONSUMER"], "Luxury Goods": ["luxury", "CONSUMER"], "Furnishings, Fixtures & Appliances": ["home furnishings", "CONSUMER"],
  "REIT - Specialty": ["specialty reit", "REAL ESTATE"], "REIT - Industrial": ["industrial reit", "REAL ESTATE"], "REIT - Retail": ["retail reit", "REAL ESTATE"], "REIT - Healthcare Facilities": ["healthcare reit", "REAL ESTATE"], "REIT - Residential": ["residential reit", "REAL ESTATE"], "REIT - Hotel & Motel": ["hotel reit", "REAL ESTATE"], "REIT - Diversified": ["diversified reit", "REAL ESTATE"], "REIT - Office": ["office reit", "REAL ESTATE"], "Real Estate - Services": ["real estate services", "REAL ESTATE"], "Residential Construction": ["homebuilding", "REAL ESTATE"],
  "Telecommunications Services": ["telecom", "TELECOM"],
};
export const FAMILY_OF = (line) => { for (const [, [l, f]] of Object.entries(INDUSTRY_LINES)) if (l === line) return f; return EXTRA_FAMILY[line] || "OTHER"; };
/** Lines that only keywords or hand rules create. */
export const EXTRA_FAMILY = { "e-commerce": "RETAIL", "physical stores": "RETAIL", "auto parts retail": "RETAIL", "cloud": "SOFTWARE", "consulting": "SOFTWARE", "advertising": "INTERNET", "streaming": "INTERNET", "data-center chips": "SEMIS", "memory": "SEMIS", "foundry": "SEMIS", "storage": "HARDWARE", "consumer banking": "BANKS", "corporate banking": "BANKS", "investment banking & markets": "BANKS", "wealth & asset management": "BANKS", "payments": "PAYMENTS", "crypto exchange": "CRYPTO", "crypto treasury": "CRYPTO", "bitcoin mining": "CRYPTO", "ai cloud & hosting": "SOFTWARE", "medical devices": "MEDTECH", "animal health": "PHARMA", "energy storage": "UTILITIES", "mobility": "INTERNET", "delivery": "INTERNET", "memory & storage": "SEMIS", "data-centre reit": "REAL ESTATE" };

/** The keywords that move a segment's revenue to another line; each limited to the families it makes sense in. */
export const KEYWORDS = [
  { re: /\b(aws|amazon web services|cloud (and|&) license|server products and cloud|google cloud|cloud services|public cloud|intelligent cloud)\b/i, line: "cloud", fam: ["RETAIL", "SOFTWARE", "INTERNET"] },
  { re: /\b(online store|third-party seller|marketplace|customer management|online marketing|sales of goods|logistics services|e-?commerce|delivery)\b/i, line: "e-commerce", fam: ["RETAIL"] },
  { re: /\b(advertis|search (&|and) other|youtube ads|google network|online marketing|ad-supported)/i, line: "advertising", fam: ["RETAIL", "SOFTWARE", "INTERNET"] },
  { re: /\b(online store|third-party seller|marketplace|e-?commerce|delivery)\b/i, line: "e-commerce", fam: ["INTERNET", "SOFTWARE"] },
  { re: /\bphysical store/i, line: "physical stores", fam: ["RETAIL"] },
  { re: /\b(consulting|outsourcing)\b/i, line: "consulting", fam: ["SOFTWARE"] },
  { re: /\b(ai cloud|high performance computing|hosting|colocation)\b/i, line: "ai cloud & hosting", fam: ["CRYPTO", "SOFTWARE", "BANKS"] },
  { re: /\bbitcoin mining|mining segment\b/i, line: "bitcoin mining", fam: ["CRYPTO", "SOFTWARE", "BANKS"] },
  { re: /\bdata ?cent(er|re)\b/i, line: "data-center chips", fam: ["SEMIS"] },
  { re: /\b(dram|nand|memory|flash)\b/i, line: "memory", fam: ["SEMIS", "HARDWARE"] },
  { re: /\bfoundry\b/i, line: "foundry", fam: ["SEMIS"] },
  { re: /\b(consumer (&|and) community|consumer banking|retail banking|consumer and small business)/i, line: "consumer banking", fam: ["BANKS"] },
  { re: /\b(corporate (&|and) (investment|institutional)|commercial and investment bank|global banking|institutional securities|global markets|trading and investment banking|investment bank)/i, line: "investment banking & markets", fam: ["BANKS"] },
  { re: /\b(wealth|asset management|investment management|fiduciary|asset and wealth)/i, line: "wealth & asset management", fam: ["BANKS"] },
  { re: /\b(payment|card|merchant|interchange)/i, line: "payments", fam: ["BANKS", "PAYMENTS"] },
  { re: /\bupstream\b/i, line: "upstream", fam: ["ENERGY"] },
  { re: /\b(energy products|refining|downstream)\b/i, line: "downstream", fam: ["ENERGY"] },
  { re: /\bchemical/i, line: "specialty chemicals", fam: ["ENERGY"] },
  { re: /\bmidstream|pipeline/i, line: "midstream", fam: ["ENERGY"] },
  { re: /\bmedtech|medical devices?\b/i, line: "medical devices", fam: ["PHARMA"] },
  { re: /\banimal health/i, line: "animal health", fam: ["PHARMA"] },
  { re: /\benergy generation and storage/i, line: "energy storage", fam: ["AUTOS"] },
  { re: /\bmobility\b/i, line: "mobility", fam: ["SOFTWARE", "INTERNET"] },
  { re: /\bsoftware\b/i, line: "infrastructure software", fam: ["SEMIS", "SOFTWARE", "HARDWARE", "INDUSTRIALS"] },
];
/** Segment rows that are not a business. */
export const SKIP_SEGMENT = /reconcil|eliminat|corporate|non-?segment|hedging|intersegment|^other|^total|unallocated|equity affiliates|^segment$/i;

/** Hand rules: the default line (and, when given, the whole vector) for names FMP files under a misleading industry.
    Source "hand" on the row; the 10-K is the reference. */
export const HAND = {
  AMZN: { default: "e-commerce" }, BABA: { default: "e-commerce" }, JD: { default: "e-commerce" }, PDD: { default: "e-commerce" }, MELI: { default: "e-commerce" },
  SHOP: { lines: { "e-commerce": 0.7, "application software": 0.3 } }, ORLY: { lines: { "auto parts retail": 1 } },
  META: { lines: { advertising: 0.98, "internet platforms": 0.02 } }, DASH: { lines: { delivery: 1 } }, UBER: { lines: { mobility: 0.57, delivery: 0.33, logistics: 0.1 } },
  NFLX: { lines: { streaming: 1 } }, SPOT: { lines: { streaming: 0.88, advertising: 0.12 } },
  SNDK: { lines: { memory: 1 } }, WDC: { lines: { storage: 1 } }, STX: { lines: { storage: 1 } }, TSM: { lines: { foundry: 1 } }, GFS: { lines: { foundry: 1 } },
  MSTR: { lines: { "crypto treasury": 0.8, "application software": 0.2 } }, COIN: { lines: { "crypto exchange": 1 } }, HOOD: { lines: { "capital markets": 1 } },
  AAPL: { lines: { "consumer electronics": 0.75, "infrastructure software": 0.25 } }, "BRK-B": { lines: { "diversified insurance": 1 } },
  V: { lines: { payments: 1 } }, MA: { lines: { payments: 1 } }, PYPL: { lines: { payments: 1 } }, AXP: { lines: { payments: 0.6, "consumer banking": 0.4 } }, COF: { lines: { "consumer banking": 0.6, payments: 0.4 } }, SOFI: { lines: { "consumer banking": 1 } }, AFRM: { lines: { payments: 1 } }, GPN: { lines: { payments: 1 } },
  IREN: { lines: { "bitcoin mining": 0.82, "ai cloud & hosting": 0.18 } }, APLD: { lines: { "ai cloud & hosting": 1 } }, CRWV: { lines: { "ai cloud & hosting": 1 } }, NBIS: { lines: { "ai cloud & hosting": 1 } }, CORZ: { lines: { "ai cloud & hosting": 1 } },
};

const norm = (o) => { const s = Object.values(o).reduce((a, b) => a + b, 0); const out = {}; for (const [k, v] of Object.entries(o)) if (v > 0) out[k] = v / s; return s > 0 ? out : null; };

/** The line vector of one company. profile: { industry }; segments: the fixture row ({ product: { data } }) or null.
    Returns { lines: { line: share }, family: the default line's family, source: "segments" | "industry" | "hand", from } */
export function linesOf(ticker, profile, segments, fx = CP1_DEFAULT) {
  const L = linesRaw(ticker, profile, segments, fx);
  if (!(fx && fx.memoryStorage) || !Object.keys(L.lines).some((l) => ONE_LINE[l])) return L;
  const lines = canonLines(L.lines, fx);   /* CP1 memoryStorage: memory and storage are one line */
  return { ...L, lines, family: FAMILY_OF(Object.entries(lines).sort((a, b) => b[1] - a[1])[0][0]), from: L.from + " · memory and storage counted as one line (CP1)" };
}
function linesRaw(ticker, profile, segments, fx) {
  const T = String(ticker).toUpperCase(), ind = profile && profile.industry, map = INDUSTRY_LINES[ind] || null;
  const cp1 = (fx && fx.memoryStorage && CP1_HAND.memoryStorage[T]) || (fx && fx.dcReit && CP1_HAND.dcReit[T]) || null, hand = cp1 || HAND[T] || null;
  if (hand && hand.lines) return { lines: norm(hand.lines), family: FAMILY_OF(Object.keys(hand.lines)[0]), source: "hand", from: hand.from || "hand rule (10-K)" };
  const dflt = hand && hand.default ? hand.default : map ? map[0] : (ind ? String(ind).toLowerCase() : "unknown");
  const fam = FAMILY_OF(dflt);
  const data = segments && segments.product && segments.product.data;
  if (!data) return { lines: { [dflt]: 1 }, family: fam, source: hand ? "hand" : "industry", from: hand ? "hand rule (10-K)" : `FMP industry: ${ind || "unknown"}` };
  const rows = Object.entries(data).filter(([k, v]) => v > 0 && !SKIP_SEGMENT.test(k.trim()));
  if (!rows.length) return { lines: { [dflt]: 1 }, family: fam, source: "industry", from: `FMP industry: ${ind || "unknown"} (segments carry no business rows)` };
  const acc = {}, moved = [];
  for (const [name, v] of rows) {
    const kw = KEYWORDS.find((k) => k.re.test(name) && k.fam.includes(fam));
    const line = kw ? kw.line : dflt; acc[line] = (acc[line] || 0) + v; if (kw) moved.push(name + " → " + kw.line);
  }
  return { lines: norm(acc), family: fam, source: "segments", from: `FMP revenue segments FY${segments.product.fy}${moved.length ? " (" + moved.join(", ") + ")" : ""}`, segments: rows.map(([k, v]) => [k, v]) };
}

/** Similarity of two line vectors: shared lines in full, the same family's residual at half. */
export function similarity(a, b) {
  let exact = 0; const famA = {}, famB = {};
  for (const [l, w] of Object.entries(a.lines)) { const f = FAMILY_OF(l); famA[f] = (famA[f] || 0) + w; if (b.lines[l]) exact += Math.min(w, b.lines[l]); }
  for (const [l, w] of Object.entries(b.lines)) { const f = FAMILY_OF(l); famB[f] = (famB[f] || 0) + w; }
  let fam = 0;
  for (const f of Object.keys(famA)) if (famB[f]) { let ex = 0; for (const [l, w] of Object.entries(a.lines)) if (FAMILY_OF(l) === f && b.lines[l]) ex += Math.min(w, b.lines[l]); fam += 0.5 * Math.max(0, Math.min(famA[f] - ex, famB[f] - ex)); }
  const shared = Object.keys(a.lines).filter((l) => b.lines[l]).map((l) => ({ line: l, own: a.lines[l], peer: b.lines[l] })).sort((x, y) => Math.min(y.own, y.peer) - Math.min(x.own, x.peer));
  const sameFamily = Object.keys(famA).filter((f) => famB[f] && !shared.some((s) => FAMILY_OF(s.line) === f));
  return { sim: exact + fam, exact, family: fam, shared, sameFamily };
}

/** The set for one company. inp: { profiles, segments: { T: row }, fmpRows, srcRows } (C4's reads + the segments fixture). */
export function buildSet(ticker, inp, { n = N_DEFAULT, fx = CP1_DEFAULT } = {}) {
  if (fx && fx.complement) return complementSet(ticker, inp, { n, fx });
  const T = String(ticker).toUpperCase(), me = inp.profiles[T]; if (!me) throw new Error(`${T} has no profile`);
  const own = Number(me.market_cap) || null, L = linesOf(T, me, inp.segments && inp.segments[T], fx);
  const named = {}; for (const r of inp.fmpRows || []) if (r.ticker === T) (named[r.peer] ||= new Set()).add("FMP"); for (const r of inp.srcRows || []) if (r.ticker === T) (named[r.peer] ||= new Set()).add(r.source === "massive" ? "MASSIVE" : "FMP");
  const rows = [];
  for (const [S, p] of Object.entries(inp.profiles)) {
    if (S === T || p.is_etf || !p.industry) continue;
    if (DUAL[S] && inp.profiles[DUAL[S]]) continue;
    const PL = linesOf(S, p, inp.segments && inp.segments[S], fx), sm = similarity(L, PL), mcap = Number(p.market_cap) || null, ratio = own > 0 && mcap > 0 ? mcap / own : null;
    const sizePenalty = ratio != null ? SIZE_WEIGHT * Math.abs(Math.log10(ratio)) : SIZE_WEIGHT * 2, src = [...(named[S] || [])].sort();
    const score = sm.sim - sizePenalty + (src.length ? NAMED_BONUS : 0);
    const why = sm.shared.length ? sm.shared.slice(0, 2).map((s) => `${s.line} (${T} ${Math.round(s.own * 100)}% · ${S} ${Math.round(s.peer * 100)}%)`).join(", ") : sm.sameFamily.length ? `same family (${sm.sameFamily[0].toLowerCase()}): ${Object.entries(PL.lines).filter(([l]) => FAMILY_OF(l) === sm.sameFamily[0]).sort((a, b) => b[1] - a[1])[0][0]}` : `no shared business (${Object.keys(PL.lines)[0]})`;
    rows.push({ ticker: S, sim: sm.sim, exact: sm.exact, family: sm.family, shared: sm.shared, sameFamily: sm.sameFamily, lines: PL.lines, line_source: PL.source, line_from: PL.from, market_cap: mcap, ratio, size_penalty: sizePenalty, score, sources: src, why, member: sm.sim >= SIM_MIN });
  }
  const members = rows.filter((r) => r.member).sort((a, b) => b.score - a.score || a.ticker.localeCompare(b.ticker));
  /* seats: every line at ≥ LINE_MIN seats its two best peers (the peers that share THAT line, by score) */
  const seated = [], seatWhy = {};
  for (const [line, w] of Object.entries(L.lines).sort((a, b) => b[1] - a[1])) {
    if (w < LINE_MIN) continue;
    let k = 0; for (const r of members) { if (k >= SEATS_PER_LINE) break; if (r.lines[line] && r.lines[line] >= LINE_MIN / 2 && !seated.includes(r.ticker)) { seated.push(r.ticker); seatWhy[r.ticker] = line; k++; } }
  }
  const kept = [...seated.map((t) => members.find((r) => r.ticker === t)), ...members.filter((r) => !seated.includes(r.ticker))].slice(0, n).map((r, i) => ({ ...r, rank: i + 1, seat: seatWhy[r.ticker] || null }));
  const keptT = new Set(kept.map((r) => r.ticker));
  const dropped = rows.filter((r) => !keptT.has(r.ticker)).map((r) => ({ ...r, why: r.member ? `beyond the ${n} kept (score ${r.score.toFixed(2)})` : r.why }));
  return {
    ticker: T, n, own_market_cap: own, own_industry: me.industry || null, own_lines: L, lines_source: L.source, lines_from: L.from,
    counts: { served: rows.length, members: members.length, kept: kept.length, named: Object.keys(named).length },
    kept, dropped, members: members.map((r) => r.ticker),
    named_not_in: Object.keys(named).filter((p) => !keptT.has(p)).map((p) => { const r = rows.find((x) => x.ticker === p); return { ticker: p, sources: [...named[p]], why: DUAL[p] && inp.profiles[DUAL[p]] ? `the same company as ${DUAL[p]} (one share class)` : !inp.profiles[p] ? "not served on the Hub (no figures)" : r ? (r.member ? `beyond the ${n} kept (score ${r.score.toFixed(2)})` : `${r.why} · similarity ${r.sim.toFixed(2)}`) : "no profile" }; }),
    rule: `business first: a peer is in when at least ${Math.round(SIM_MIN * 100)}¢ of each revenue dollar sits in a line it shares with ${T} (FMP revenue segments where they exist, else the FMP industry); every line ${T} has at ≥${Math.round(LINE_MIN * 100)}% seats its ${SEATS_PER_LINE} best peers; the rest by similarity less a soft size term (${SIZE_WEIGHT} per 10× of market value); the ${n} best kept`,
  };
}

/** CP1 complement · the set the method keeps today, with the same-business companies it lacks ADDED (never a peer
    removed). `base` is this method with every switch off; `fixed` is the same method on the fixed lines, which says
    who shares the business. Returns the fixed set's shape plus: kept = base's kept (each marked same_business) + added
    (+ reference peers), `base_kept`, `added`, `reference`, and `same` = { n, need, line, pool, short }. */
export function complementSet(ticker, inp, { n = N_DEFAULT, fx = CP1_LINES_ON } = {}) {
  const T = String(ticker).toUpperCase();
  const base = buildSet(T, inp, { n, fx: CP1_LINES_OFF }), fixed = buildSet(T, inp, { n: N_MAX, fx: { ...fx, complement: false } });
  const all = [...fixed.kept, ...fixed.dropped], rowOf = Object.fromEntries(all.map((r) => [r.ticker, r]));
  const isSame = (t) => !!(rowOf[t] && rowOf[t].exact >= SIM_MIN);
  const kept = base.kept.map((r) => ({ ...r, same_business: isSame(r.ticker), exact: rowOf[r.ticker] ? rowOf[r.ticker].exact : r.exact, exact_before: r.exact, why: rowOf[r.ticker] && isSame(r.ticker) ? rowOf[r.ticker].why : r.why, added: false, reference: false }));
  const line = Object.entries(fixed.own_lines.lines).sort((a, b) => b[1] - a[1])[0][0];
  const pool = all.filter((r) => r.exact >= SIM_MIN).sort((a, b) => b.score - a.score || a.ticker.localeCompare(b.ticker));
  let have = kept.filter((r) => r.same_business).length; const added = [];
  for (const r of pool) { if (have >= SAME_MIN || kept.length + added.length >= N_MAX) break; if (kept.some((k) => k.ticker === r.ticker)) continue; added.push({ ...r, rank: kept.length + added.length + 1, seat: r.shared[0] ? r.shared[0].line : line, same_business: true, added: true, reference: false, why: r.shared.slice(0, 2).map((s) => `${s.line} (${T} ${Math.round(s.own * 100)}% · ${r.ticker} ${Math.round(s.peer * 100)}%)`).join(", ") }); have++; }
  const reference = [];
  if (fx.reference) for (const [S, ref] of Object.entries(REFERENCE_PEERS)) {
    if (have >= SAME_MIN || kept.length + added.length + reference.length >= N_MAX) break;
    const PL = { lines: canonLines(norm(ref.lines), fx) }, sm = similarity(fixed.own_lines, PL); if (sm.exact < SIM_MIN || ref.for_line !== line) continue;   /* only for a company whose own main line is the one the reference peer is listed for */
    const facts = inp.reference && inp.reference[S], mcap = facts && Number(facts.market_cap_usd) > 0 ? Number(facts.market_cap_usd) : null, ratio = fixed.own_market_cap > 0 && mcap > 0 ? mcap / fixed.own_market_cap : null;
    reference.push({ ticker: S, name: ref.name, sim: sm.sim, exact: sm.exact, family: sm.family, shared: sm.shared, sameFamily: sm.sameFamily, lines: PL.lines, line_source: "hand", line_from: "reference peer, hand vector (annual report)", market_cap: mcap, ratio, size_penalty: ratio != null ? SIZE_WEIGHT * Math.abs(Math.log10(ratio)) : null, score: null, sources: [], rank: kept.length + added.length + reference.length + 1, seat: sm.shared[0] ? sm.shared[0].line : line, member: true, same_business: true, added: true, reference: true, has_figures: !!facts, currency: ref.currency, note: ref.note, also: ref.also,
      why: sm.shared.slice(0, 2).map((s) => `${s.line} (${T} ${Math.round(s.own * 100)}% · ${ref.name} ${Math.round(s.peer * 100)}%)`).join(", ") + " · comps-only reference peer, not served on the Hub" });
    have++;
  }
  /* CP3 stated: the stated peers that the set lacks are added; every row then says whether it is stated (and so priced) */
  const st = fx.stated && CP3_STATED[T] ? CP3_STATED[T] : null, statedAdded = [];
  if (st) {
    const inSet = new Set([...kept, ...added, ...reference].map((r) => r.ticker));
    for (const S of st.peers) { const r = rowOf[S]; if (inSet.has(S) || !r) continue; statedAdded.push({ ...r, rank: kept.length + added.length + reference.length + statedAdded.length + 1, seat: st.line, same_business: true, added: true, reference: false, why: `${st.line} — a stated peer${r.shared && r.shared.length ? " · " + r.shared.slice(0, 1).map((x) => `${x.line} (${T} ${Math.round(x.own * 100)}% · ${S} ${Math.round(x.peer * 100)}%)`).join("") : ""}` }); }
  }
  const stMark = (r) => (st ? { ...r, stated: st.peers.includes(r.ticker), same_business_by_lines: !!r.same_business, same_business: st.peers.includes(r.ticker) } : r);
  const served = pool.length, short = have < SAME_MIN ? `the Hub serves ${served} other compan${served === 1 ? "y" : "ies"} on the ${line} line${reference.length ? ` and the reference list adds ${reference.length}` : ""}: ${have} same-business peers, not ${SAME_MIN}` : null;
  return { ...fixed, n: kept.length + added.length + reference.length + statedAdded.length, kept: [...kept, ...added, ...reference, ...statedAdded].map(stMark), dropped: fixed.dropped.filter((r) => !kept.some((k) => k.ticker === r.ticker) && !added.some((k) => k.ticker === r.ticker) && !statedAdded.some((k) => k.ticker === r.ticker)),
    stated: st ? { line: st.line, peers: st.peers, legs: st.legs || null, why: st.why, from: st.from, not_served: st.not_served || [], added: statedAdded.map((r) => r.ticker), missing: st.peers.filter((S) => !rowOf[S] && !reference.some((r) => r.ticker === S)) } : null,
    counts: { ...fixed.counts, kept: kept.length + added.length + reference.length + statedAdded.length, base: kept.length, added: added.length + statedAdded.length, reference: reference.length },
    base_kept: base.kept.map((r) => r.ticker), base_lines: base.own_lines, added: added.map((r) => r.ticker), reference: reference.map((r) => r.ticker), same: { n: have, need: SAME_MIN, line, pool: pool.map((r) => r.ticker), short },
    rule: base.rule + ` · CP1: the kept set stays; same-business companies it lacks are added until it carries ${SAME_MIN} (or the line runs out), reference peers last, never beyond ${N_MAX}` };
}

/** CP1 · the four sources' votes for one peer of one company (C4's circles: FMP peers · Massive related · same
    industry · shared industry fund). inp: C4's inputs (profiles with sic, fmpRows, srcRows, funds: [{ticker, holdings,
    all: [[sym, weight]…] when the holdings file names unserved rows}]). An unserved peer has no profile: its industry
    vote is "unknown" until the facts file carries one. Returns { fmp, massive, industry, fund, n, words }. */
export function votesFor(ticker, peer, inp, { also = [], broad = new Set(["SPY", "VTI", "ITOT", "VT", "IWV", "RSP", "VTV", "VUG", "QQQ", "QQEW", "MTUM", "QUAL", "SPLV", "IWM", "MGK", "MDY", "IJR", "DIA", "SCHD", "VXUS"]), fundMax = 60 } = {}) {
  const T = String(ticker).toUpperCase(), ids = [String(peer).toUpperCase(), ...also.map((x) => String(x).toUpperCase())], me = inp.profiles[T] || {}, p = inp.profiles[ids[0]] || (inp.reference && inp.reference[ids[0]]) || null;
  const named = (src) => [...(inp.fmpRows || []).filter((r) => src === "fmp" && r.ticker === T), ...(inp.srcRows || []).filter((r) => r.ticker === T && r.source === src)].some((r) => ids.includes(String(r.peer).toUpperCase()));
  const fmp = named("fmp"), massive = named("massive");
  const industry = !p ? null : !!((p.industry && me.industry && p.industry === me.industry) || (p.sic && me.sic && String(p.sic) === String(me.sic)));
  const funds = (inp.funds || []).filter((f) => !broad.has(f.ticker) && (f.count || (f.holdings || []).length) <= fundMax).filter((f) => { const rows = (f.all || f.holdings || []).map(([s]) => String(s).toUpperCase()); return rows.includes(T) && ids.some((x) => rows.includes(x)); }).map((f) => f.ticker);
  const n = [fmp, massive, industry === true, funds.length > 0].filter(Boolean).length;
  return { fmp, massive, industry, fund: funds.length > 0, funds, n, words: [fmp ? "FMP peers" : null, massive ? "Massive related" : null, industry === true ? "same industry" : industry === null ? "industry not on file" : null, funds.length ? "same fund (" + funds.join(", ") + ")" : null].filter(Boolean).join(" · ") || "no source names it" };
}

/** The plain words of one company's lines, for the page: "e-commerce 64% · cloud 18% · advertising 10% …" */
export const lineWords = (L) => Object.entries(L.lines).sort((a, b) => b[1] - a[1]).map(([l, w]) => `${l} ${Math.round(w * 100)}%`).join(" · ");

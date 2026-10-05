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
   K1 (5 Oct) — OWN BUSINESS SEATS FIRST, FILL-INS NEVER LEAD (Alan: MU priced at $4,479 against $1,069 because its
   peers were chip designers; "a company's own industry peers always seat first"):
     tier OWN        a peer that shares one of the company's lines for at least OWN_MIN (5¢) of the revenue dollar —
                     all of them seat before anyone else (the two best per line first, as before, then by score);
     tier NEIGHBOUR  a peer in a line declared next door (NEIGHBOURS: memory ↔ storage — both sell bits by the
                     gigabyte into the same cycle); counted at NEIGHBOUR_SIM of the overlap;
     tier FILL       the same family only (chip designers for a memory maker). Fill-ins are capped: never more than
                     the own + neighbour peers less one, except to bring a thin set up to MIN_PACK (5, the fewest
                     peers that can define a pack for the outlier test). With no own or neighbour peer at all the set
                     is filled to N as before, and says so.
   One share class per company (GOOG / GOOGL, BRK-B / BRK.A).
   2. The reason per peer is the shared lines with both shares, the source that decided it (segments / industry / hand),
      the size ratio and who else named it. */

export const SIM_MIN = 0.15, LINE_MIN = 0.15, SIZE_WEIGHT = 0.06, NAMED_BONUS = 0.03, N_DEFAULT = 12, NS = [8, 10, 12, 15, 20], SEATS_PER_LINE = 2;
export const NEIGHBOUR_SIM = 0.75, MIN_PACK = 5, OWN_MIN = 0.05;
/** Lines that are next door to each other: not the same business, but priced off the same cycle. */
export const NEIGHBOURS = { memory: ["storage"], storage: ["memory"] };
export const DUAL = { GOOG: "GOOGL", "BRK.A": "BRK-B" };   // the class dropped → the class kept

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
export const EXTRA_FAMILY = { "e-commerce": "RETAIL", "physical stores": "RETAIL", "auto parts retail": "RETAIL", "cloud": "SOFTWARE", "consulting": "SOFTWARE", "advertising": "INTERNET", "streaming": "INTERNET", "data-center chips": "SEMIS", "memory": "SEMIS", "foundry": "SEMIS", "storage": "HARDWARE", "consumer banking": "BANKS", "corporate banking": "BANKS", "investment banking & markets": "BANKS", "wealth & asset management": "BANKS", "payments": "PAYMENTS", "crypto exchange": "CRYPTO", "crypto treasury": "CRYPTO", "bitcoin mining": "CRYPTO", "ai cloud & hosting": "SOFTWARE", "medical devices": "MEDTECH", "animal health": "PHARMA", "energy storage": "UTILITIES", "mobility": "INTERNET", "delivery": "INTERNET" };

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
  /* K1 — notDefault: an equipment maker's segments are named after its CUSTOMERS' markets (FormFactor: "DRAM", "Flash",
     "Foundry & Logic"); they are not its business, so these three keywords never move an equipment maker's revenue */
  { re: /\bdata ?cent(er|re)\b/i, line: "data-center chips", fam: ["SEMIS"], notDefault: ["semiconductor equipment"] },
  { re: /\b(dram|nand|memory|flash)\b/i, line: "memory", fam: ["SEMIS", "HARDWARE"], notDefault: ["semiconductor equipment"] },
  { re: /\bfoundry\b/i, line: "foundry", fam: ["SEMIS"], notDefault: ["semiconductor equipment"] },
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
  SNDK: { lines: { memory: 1 } }, MU: { lines: { memory: 1 } }, SKHY: { lines: { memory: 1 } }, WDC: { lines: { storage: 1 } }, STX: { lines: { storage: 1 } }, TSM: { lines: { foundry: 1 } }, GFS: { lines: { foundry: 1 } },
  FORM: { lines: { "semiconductor equipment": 1 } },   // K1: FormFactor makes probe cards (test equipment); FMP files it under "Semiconductors" and its segments are named after its customers' markets (DRAM, Flash, Foundry & Logic)
  MSTR: { lines: { "crypto treasury": 0.8, "application software": 0.2 } }, COIN: { lines: { "crypto exchange": 1 } }, HOOD: { lines: { "capital markets": 1 } },
  AAPL: { lines: { "consumer electronics": 0.75, "infrastructure software": 0.25 } }, "BRK-B": { lines: { "diversified insurance": 1 } },
  V: { lines: { payments: 1 } }, MA: { lines: { payments: 1 } }, PYPL: { lines: { payments: 1 } }, AXP: { lines: { payments: 0.6, "consumer banking": 0.4 } }, COF: { lines: { "consumer banking": 0.6, payments: 0.4 } }, SOFI: { lines: { "consumer banking": 1 } }, AFRM: { lines: { payments: 1 } }, GPN: { lines: { payments: 1 } },
  IREN: { lines: { "bitcoin mining": 0.82, "ai cloud & hosting": 0.18 } }, APLD: { lines: { "ai cloud & hosting": 1 } }, CRWV: { lines: { "ai cloud & hosting": 1 } }, NBIS: { lines: { "ai cloud & hosting": 1 } }, CORZ: { lines: { "ai cloud & hosting": 1 } },
};

const norm = (o) => { const s = Object.values(o).reduce((a, b) => a + b, 0); const out = {}; for (const [k, v] of Object.entries(o)) if (v > 0) out[k] = v / s; return s > 0 ? out : null; };

/** The line vector of one company. profile: { industry }; segments: the fixture row ({ product: { data } }) or null.
    Returns { lines: { line: share }, family: the default line's family, source: "segments" | "industry" | "hand", from } */
export function linesOf(ticker, profile, segments) {
  const T = String(ticker).toUpperCase(), ind = profile && profile.industry, map = INDUSTRY_LINES[ind] || null, hand = HAND[T] || null;
  if (hand && hand.lines) return { lines: norm(hand.lines), family: FAMILY_OF(Object.keys(hand.lines)[0]), source: "hand", from: "hand rule (10-K)" };
  const dflt = hand && hand.default ? hand.default : map ? map[0] : (ind ? String(ind).toLowerCase() : "unknown");
  const fam = FAMILY_OF(dflt);
  const data = segments && segments.product && segments.product.data;
  if (!data) return { lines: { [dflt]: 1 }, family: fam, source: hand ? "hand" : "industry", from: hand ? "hand rule (10-K)" : `FMP industry: ${ind || "unknown"}` };
  const rows = Object.entries(data).filter(([k, v]) => v > 0 && !SKIP_SEGMENT.test(k.trim()));
  if (!rows.length) return { lines: { [dflt]: 1 }, family: fam, source: "industry", from: `FMP industry: ${ind || "unknown"} (segments carry no business rows)` };
  const acc = {}, moved = [];
  for (const [name, v] of rows) {
    const kw = KEYWORDS.find((k) => k.re.test(name) && k.fam.includes(fam) && !(k.notDefault && k.notDefault.includes(dflt)));
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
  /* K1 — next-door lines (NEIGHBOURS): the overlap of a line of a with its neighbour line in b, at NEIGHBOUR_SIM */
  let neighbour = 0; const next = [];
  for (const [l, w] of Object.entries(a.lines)) for (const nb of NEIGHBOURS[l] || []) if (b.lines[nb]) { const o = Math.min(w, b.lines[nb]); neighbour += NEIGHBOUR_SIM * o; next.push({ line: l, peer_line: nb, own: w, peer: b.lines[nb] }); }
  return { sim: Math.min(1, exact + fam + neighbour), exact, family: fam, neighbour, next, shared, sameFamily };
}

/** The set for one company. inp: { profiles, segments: { T: row }, fmpRows, srcRows } (C4's reads + the segments fixture). */
export function buildSet(ticker, inp, { n = N_DEFAULT } = {}) {
  const T = String(ticker).toUpperCase(), me = inp.profiles[T]; if (!me) throw new Error(`${T} has no profile`);
  const own = Number(me.market_cap) || null, L = linesOf(T, me, inp.segments && inp.segments[T]);
  const named = {}; for (const r of inp.fmpRows || []) if (r.ticker === T) (named[r.peer] ||= new Set()).add("FMP"); for (const r of inp.srcRows || []) if (r.ticker === T) (named[r.peer] ||= new Set()).add(r.source === "massive" ? "MASSIVE" : "FMP");
  const rows = [];
  for (const [S, p] of Object.entries(inp.profiles)) {
    if (S === T || p.is_etf || !p.industry) continue;
    if (DUAL[S] && inp.profiles[DUAL[S]]) continue;
    const PL = linesOf(S, p, inp.segments && inp.segments[S]), sm = similarity(L, PL), mcap = Number(p.market_cap) || null, ratio = own > 0 && mcap > 0 ? mcap / own : null;
    const sizePenalty = ratio != null ? SIZE_WEIGHT * Math.abs(Math.log10(ratio)) : SIZE_WEIGHT * 2, src = [...(named[S] || [])].sort();
    const score = sm.sim - sizePenalty + (src.length ? NAMED_BONUS : 0);
    const why = sm.shared.length ? sm.shared.slice(0, 2).map((s) => `${s.line} (${T} ${Math.round(s.own * 100)}% · ${S} ${Math.round(s.peer * 100)}%)`).join(", ") : sm.next.length ? `next-door business: ${sm.next[0].peer_line} (${T} is ${sm.next[0].line})` : sm.sameFamily.length ? `same family (${sm.sameFamily[0].toLowerCase()}): ${Object.entries(PL.lines).filter(([l]) => FAMILY_OF(l) === sm.sameFamily[0]).sort((a, b) => b[1] - a[1])[0][0]}` : `no shared business (${Object.keys(PL.lines)[0]})`;
    rows.push({ ticker: S, sim: sm.sim, exact: sm.exact, family: sm.family, neighbour: sm.neighbour, tier: sm.exact >= OWN_MIN ? "OWN" : sm.neighbour >= SIM_MIN ? "NEIGHBOUR" : "FILL", shared: sm.shared, sameFamily: sm.sameFamily, lines: PL.lines, line_source: PL.source, line_from: PL.from, market_cap: mcap, ratio, size_penalty: sizePenalty, score, sources: src, why, member: sm.sim >= SIM_MIN });
  }
  const members = rows.filter((r) => r.member).sort((a, b) => b.score - a.score || a.ticker.localeCompare(b.ticker));
  /* seats: every line at ≥ LINE_MIN seats its two best peers (the peers that share THAT line, by score) */
  const seated = [], seatWhy = {};
  for (const [line, w] of Object.entries(L.lines).sort((a, b) => b[1] - a[1])) {
    if (w < LINE_MIN) continue;
    let k = 0; for (const r of members) { if (k >= SEATS_PER_LINE) break; if (r.lines[line] && r.lines[line] >= LINE_MIN / 2 && !seated.includes(r.ticker)) { seated.push(r.ticker); seatWhy[r.ticker] = line; k++; } }
  }
  /* K1 — own business first, then next door, then the capped fill (see the method at the top) */
  const rest = members.filter((r) => !seated.includes(r.ticker));
  const core = [...seated.map((t) => members.find((r) => r.ticker === t)), ...rest.filter((r) => r.tier === "OWN"), ...rest.filter((r) => r.tier === "NEIGHBOUR")].slice(0, n);
  const nCore = core.filter((r) => r.tier !== "FILL").length;
  const fillCap = nCore === 0 ? n : Math.max(MIN_PACK - core.length, nCore - 1, 0);
  const fill = rest.filter((r) => r.tier === "FILL").slice(0, Math.min(fillCap, n - core.length));
  const kept = [...core, ...fill].map((r, i) => ({ ...r, rank: i + 1, seat: seatWhy[r.ticker] || null }));
  const keptT = new Set(kept.map((r) => r.ticker));
  const dropped = rows.filter((r) => !keptT.has(r.ticker)).map((r) => ({ ...r, why: r.member ? `beyond the ${n} kept (score ${r.score.toFixed(2)})` : r.why }));
  return {
    ticker: T, n, own_market_cap: own, own_industry: me.industry || null, own_lines: L, lines_source: L.source, lines_from: L.from,
    counts: { served: rows.length, members: members.length, kept: kept.length, named: Object.keys(named).length, own: kept.filter((r) => r.tier === "OWN").length, neighbour: kept.filter((r) => r.tier === "NEIGHBOUR").length, fill: kept.filter((r) => r.tier === "FILL").length, fill_cap: fillCap },
    kept, dropped, members: members.map((r) => r.ticker),
    named_not_in: Object.keys(named).filter((p) => !keptT.has(p)).map((p) => { const r = rows.find((x) => x.ticker === p); return { ticker: p, sources: [...named[p]], why: DUAL[p] && inp.profiles[DUAL[p]] ? `the same company as ${DUAL[p]} (one share class)` : !inp.profiles[p] ? "not served on the Hub (no figures)" : r ? (r.member ? `beyond the ${n} kept (score ${r.score.toFixed(2)})` : `${r.why} · similarity ${r.sim.toFixed(2)}`) : "no profile" }; }),
    rule: `business first: a peer is in when at least ${Math.round(SIM_MIN * 100)}¢ of each revenue dollar sits in a line it shares with ${T} (FMP revenue segments where they exist, else the FMP industry); every line ${T} has at ≥${Math.round(LINE_MIN * 100)}% seats its ${SEATS_PER_LINE} best peers; ${T}'s own-business peers seat first, then next-door businesses, then same-family fill-ins — never more fill-ins than own + next-door peers less one (except to reach ${MIN_PACK}); inside a tier by similarity less a soft size term (${SIZE_WEIGHT} per 10× of market value); at most ${n} kept`,
  };
}

/** The plain words of one company's lines, for the page: "e-commerce 64% · cloud 18% · advertising 10% …" */
export const lineWords = (L) => Object.entries(L.lines).sort((a, b) => b[1] - a[1]).map(([l, w]) => `${l} ${Math.round(w * 100)}%`).join(" · ");

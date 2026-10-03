// SCINTILLA · analyst-revisions — quality.ts: is this analyst row what it says it is? (A4, 3 Oct 2026). Pure: no network, no keys.
//
// Why: FMP's price-target-news / grades-news attach a firm and a number to a news link, and some links are not the note they
// claim (AMZN 17 Sep: "FTC announces additional payments to consumers from Amazon Prime settlement" filed as UBS $200; NVDA
// 2 Oct: "Morgan Stanley Renames NVIDIA (NVDA) to Top Pick" filed as Wells Fargo $210). Those rows set the consensus low.
// Rows are never deleted: each gets quality = 'ok' | 'quarantine' and quality_reason = the named causes, ';'-joined.
// Readers that want clean rows read quality <> 'quarantine'.
//
// One rule set, used by: the collector on the way in (index.ts), the one-off fill of the stored rows
// (deliverables/20261003/a4-analyst-quality/tools/classify.mjs), and the tests (tests/a4-analyst-quality-20261003.test.mjs).
//
// Hard causes (→ quarantine):
//   not_about_target / not_about_rating  the headline has no analyst words at all (FTC settlement, "Why The Price Went Down Today")
//   firm_mismatch(<firm>)                the headline names another research firm and never this row's firm (aliases allowed)
//   number_mismatch($X)                  the headline states the new target and it is not this row's target (nor its split-adjusted one)
//   price_not_this_stock                 the headline does not name the firm and the price when posted is >30% away from the same
//                                        stock's other notes within 2 days: another stock's note (multi-stock roundups)
//   (split_mismatch is a soft note: FMP's adj_target ≠ target ÷ the splits after the note; the row is kept, adj_target_checked carries ours)
//   target_vs_price(xR)                  adj_target_checked / price when posted outside [1/3, 3] — [1/5, 5] when the headline
//                                        names the firm — unless the headline states that very number
//   jump_vs_firm_prior(xR)               (adj_target_checked / the same firm's previous kept target, ≤ 365 days before) ÷ (the
//                                        stock's own move between the two notes) outside
//                                        [1/2, 2] — [1/4, 4] when the headline names the firm — unless the headline states the number
//   duplicate                            the same firm, stock and target (±0.5%) — or the same rating — within 3 days of a kept row:
//                                        the same note from a second publisher; the first kept one stays
// Soft notes (kept, written to quality_reason only): roundup, firm_unverified, headline_confirms, split_mismatch.

export type QRow = {
  ticker: string; published_utc: string; kind: "TARGET" | "GRADE"; firm: string;
  target?: number | string | null; adj_target?: number | string | null; new_grade?: string | null;
  price_when_posted?: number | string | null; title?: string | null; url?: string | null;
};
export type Split = { ticker: string; date: string; numerator: number | string; denominator: number | string };
export type QResult = { quality: "ok" | "quarantine"; quality_reason: string | null };

export const BAND_PRICE: [number, number] = [1 / 3, 3];            // headline does not name the firm
export const BAND_PRICE_VERIFIED: [number, number] = [1 / 5, 5];   // headline names the firm (MSTR at H.C. Wainwright: 3.5×, real)
export const BAND_PRIOR: [number, number] = [0.5, 2];              // headline does not name the firm
export const BAND_PRIOR_VERIFIED: [number, number] = [0.25, 4];    // headline names the firm (upgrades / downgrades move a lot)
export const PRIOR_DAYS = 365, DUP_DAYS = 3, NEIGHBOUR_DAYS = 2, PRICE_TOL = 0.3, NUM_TOL = 0.015;

/* ── the firm-alias table: FMP's firm name → how headlines write it (case-sensitive, word-bounded). Derived from the stored
 *    rows on 3 Oct 2026 (the "at <firm>" / "<firm> Raises …" tallies against FMP's firm field), then read by hand. ── */
export const FIRM_ALIASES: Record<string, string[]> = {
  "Morgan Stanley": ["Morgan Stanley"], "UBS": ["UBS"], "Barclays": ["Barclays"], "Wells Fargo": ["Wells Fargo", "Wells"],
  "Citigroup": ["Citi", "Citigroup"], "RBC Capital": ["RBC"], "Jefferies": ["Jefferies"], "Goldman Sachs": ["Goldman"],
  "Piper Sandler": ["Piper"], "BMO Capital": ["BMO"], "Evercore ISI": ["Evercore"], "Deutsche Bank": ["Deutsche"],
  "Bernstein": ["Bernstein"], "Cowen & Co.": ["Cowen"], "Raymond James": ["Raymond James"], "KeyBanc": ["KeyBanc", "Key Banc"],
  "Oppenheimer": ["Oppenheimer"], "Mizuho Securities": ["Mizuho"], "Truist Financial": ["Truist", "SunTrust"],
  "Susquehanna": ["Susquehanna", "SIG"], "Cantor Fitzgerald": ["Cantor"], "Scotiabank": ["Scotiabank", "Scotia"],
  "Needham": ["Needham"], "Bank of America Securities": ["BofA", "Bank of America", "BofA Securities", "Merrill"],
  "Stifel Nicolaus": ["Stifel"], "BTIG": ["BTIG"], "Wolfe Research": ["Wolfe"], "Guggenheim": ["Guggenheim"],
  "Robert W. Baird": ["Baird"], "HSBC": ["HSBC"], "Loop Capital Markets": ["Loop Capital", "Loop"], "Roth Capital": ["Roth"],
  "Wedbush": ["Wedbush", "Dan Ives"], "Canaccord Genuity": ["Canaccord"], "Benchmark": ["Benchmark"], "Benchmark Co.": ["Benchmark"],
  "Seaport Global": ["Seaport"], "Credit Suisse": ["Credit Suisse"], "Argus Research": ["Argus"],
  "D.A. Davidson": ["DA Davidson", "D.A. Davidson", "Davidson"], "H.C. Wainwright": ["Wainwright"], "CFRA": ["CFRA"],
  "B. Riley": ["B. Riley", "B.Riley", "B Riley"], "B.Riley Financial": ["B. Riley", "B.Riley", "B Riley"],
  "B. Riley Securities": ["B. Riley", "B.Riley", "B Riley"], "Stephens": ["Stephens"], "Craig-Hallum": ["Craig-Hallum", "Craig Hallum"],
  "Macquarie": ["Macquarie"], "Exane BNP Paribas": ["Exane", "BNP"], "BNP Paribas": ["BNP", "Exane"],
  "Northland Securities": ["Northland"], "Tigress Financial": ["Tigress"], "JMP Securities": ["JMP"], "Daiwa": ["Daiwa"],
  "Rosenblatt Securities": ["Rosenblatt"], "Leerink Partners": ["Leerink"], "SVB Leerink": ["Leerink"],
  "J.P. Morgan": ["JPMorgan", "JP Morgan", "J.P. Morgan", "J.P.Morgan", "J.P Morgan"], "William Blair": ["William Blair", "Blair"],
  "New Street": ["New Street"], "Redburn Partners": ["Redburn"], "National Bank": ["National Bank"], "CIBC": ["CIBC"],
  "Compass Point": ["Compass Point"], "Telsey Advisory": ["Telsey"], "CLSA": ["CLSA"], "MoffettNathanson": ["MoffettNathanson", "Moffett"],
  "KGI Securities": ["KGI"], "Vertical Research": ["Vertical Research"], "GLJ Research": ["GLJ"], "Melius Research": ["Melius"],
  "Berenberg Bank": ["Berenberg"], "Williams Trading": ["Williams Trading"], "Pivotal Research": ["Pivotal"], "Arete Research": ["Arete"],
  "Lake Street": ["Lake Street"], "Monness": ["Monness"], "TD Securities": ["TD Securities"], "Atlantic Equities": ["Atlantic Equities"],
  "Capital One Financial": ["Capital One", "CapitalOne"], "Industrial Alliance Securities": ["Industrial Alliance", "iA Capital", "iA Securities"],
  "Maxim Group": ["Maxim"], "CICC": ["CICC"], "Johnson Rice": ["Johnson Rice"], "Fox Advisors": ["Fox Advisors"],
  "US Tiger Securities": ["US Tiger", "Tiger Securities"], "FBN Securities": ["FBN"], "Janney Montgomery": ["Janney"],
  "Alliance Global Partners": ["Alliance Global", "A.G.P."], "Coker Palmer": ["Coker"], "OTR Global": ["OTR Global"],
  "Keefe, Bruyette & Woods": ["KBW", "Keefe"], "KBW": ["KBW", "Keefe"], "Edward Jones": ["Edward Jones"],
  "Societe Generale": ["Societe Generale", "SocGen", "Société Générale"], "Summit Insights Group": ["Summit Insights"],
  "Alembic Global": ["Alembic"], "Chardan Capital": ["Chardan"], "MKM Partners": ["MKM"], "Nomura": ["Nomura", "Instinet"],
  "Itau BBA": ["Itau"], "DBS Bank": ["DBS"], "Gordon Haskett Capital Corporation": ["Gordon Haskett", "Haskett"],
  "US Capital Advisors": ["US Capital Advisors"], "Santander": ["Santander"], "Northcoast Research": ["Northcoast"],
  "Prescience Point": ["Prescience"], "BWS Financial": ["BWS"], "LightShed Partners": ["LightShed"], "Oddo BHF": ["Oddo", "ODDO"],
  "ATB Capital": ["ATB"], "SMBC Nikko": ["SMBC", "Nikko"], "Noble Capital Markets": ["Noble Capital"], "Tudor Pickering": ["Tudor Pickering", "Pickering"],
  "Fermium Research": ["Fermium"], "Danske Bank": ["Danske"], "CMB International Securities": ["CMB International", "CMBI", "CMB Int'l"],
  "Hovde Group": ["Hovde"], "CBRE": ["CBRE"], "National Securities Corporation": ["National Securities"], "Sandler O'Neil": ["Sandler O'Neil", "Piper Sandler"],
  "Keefe Bruyette & Woods": ["KBW", "Keefe"], "Williams Capital": ["Williams Capital"], "Wellington Shields": ["Wellington Shields"],
  "Williams Financial": ["Williams Financial"], "First Shanghai": ["First Shanghai"], "Kepler Capital": ["Kepler"],
  "Evercore Partners": ["Evercore"], "Siebert Williams Shank & Co": ["Siebert Williams", "Siebert"], "86Research": ["86Research"],
  "Norddeutsche Landesbank": ["NORD/LB", "Norddeutsche"], "Cross Research": ["Cross Research"], "Panmure": ["Panmure"],
  "Summit Redstone Partners": ["Summit Redstone"],
};
/** Names a headline may use for a firm FMP never files under that name — used only to spot "the headline names another firm". */
const OTHER_FIRM_NAMES = ["Citizens", "Freedom Capital", "Lucid Capital", "TD Cowen", "Siebert Williams", "Erste", "Zacks", "Morningstar",
  "Bank of America", "Ladenburg", "Wainwright", "Mizuho", "Rothschild", "StoneX", "Bernstein SocGen",
  "Phillip Securities", "Freedom Broker", "BWG Global", "Clear Street", "DZ Bank", "Brookline Capital", "WestPark", "CL King", "SEB Equities"];
/** A bank's own name is the company, not the analyst, on its own stock (WFC: "Wells Fargo price target raised … at Barclays"). */
const ISSUER_FIRM: Record<string, string[]> = {
  WFC: ["Wells Fargo"], GS: ["Goldman"], MS: ["Morgan Stanley"], C: ["Citi", "Citigroup"], BAC: ["BofA", "Bank of America", "Merrill"],
  JPM: ["JPMorgan", "JP Morgan", "J.P. Morgan"], UBS: ["UBS"], DB: ["Deutsche"], BCS: ["Barclays"], RJF: ["Raymond James"], SF: ["Stifel"],
  JEF: ["Jefferies"], PIPR: ["Piper"], EVR: ["Evercore"], TFC: ["Truist"], KEY: ["KeyBanc"], BMO: ["BMO"], RY: ["RBC"], TD: ["TD Securities", "TD Cowen"],
  HSBC: ["HSBC"], MFG: ["Mizuho"], NMR: ["Nomura"], COF: ["Capital One"], CFG: ["Citizens"], OPY: ["Oppenheimer"], BNS: ["Scotiabank", "Scotia"],
  CM: ["CIBC"], CS: ["Credit Suisse"], MQG: ["Macquarie"], SCHW: [], LAZ: [], HLI: [],
};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (a: string) => new RegExp("(^|[^A-Za-z0-9])" + esc(a) + "(?![A-Za-z0-9])");
const RE_CACHE = new Map<string, RegExp>();
const has = (title: string, alias: string) => {
  let r = RE_CACHE.get(alias);
  if (!r) { r = wordRe(alias); RE_CACHE.set(alias, r); }
  return r.test(title);
};
const ALL_NAMES: [string, string][] = (() => {   // [alias, canonical firm]
  const out: [string, string][] = [];
  for (const [f, as] of Object.entries(FIRM_ALIASES)) for (const a of as) out.push([a, f]);
  for (const a of OTHER_FIRM_NAMES) out.push([a, a]);
  return out;
})();

/** The aliases of a firm: the table's, else the firm's own name and its first word (≥ 4 letters). */
export function aliasesOf(firm: string): string[] {
  if (FIRM_ALIASES[firm]) return FIRM_ALIASES[firm];
  const f = (firm || "").trim();
  if (!f) return [];
  const first = f.split(/[\s,]+/)[0].replace(/[^\w&.-]/g, "");
  return first.length >= 4 && first !== f ? [f, first] : [f];
}

/** Firms a headline names, by alias (minus the issuer itself on a bank's own stock). Returns canonical names. */
export function firmsNamed(title: string, ticker = ""): string[] {
  const own = ISSUER_FIRM[ticker] || [];
  const out = new Set<string>();
  for (const [a, f] of ALL_NAMES) if (!own.includes(a) && has(title, a)) out.add(f);
  return [...out];
}

const ANALYST_WORDS = /\b(price target|target|targets|PT|PTs|rating|ratings|rated|upgrade[sd]?|downgrade[sd]?|initiat\w*|reiterat\w*|maintain\w*|coverage|cover|overweight|underweight|equal[- ]?weight|outperform|underperform|market perform|sector perform|peer perform|in[- ]line|neutral|buy|sell|hold|accumulate|reduce|top pick|conviction|analysts?|estimates?|forecasts?|raises?|raised|lowers?|lowered|cuts?|boosts?|lifts?|trims?|bullish|bearish|bulls?|bears?|calls?|price objective|fair value|sees|upside|downside|starts?|perform|positive|negative|constructive|cautious|top picks?|ideas? list|says)\b/i;
const MULTI_STOCK = /(top \d+\b|\b\d+ (other |top |more )?(analyst|stock|wall street)\b|top ratings|most important|upgrades (and|&|,) downgrades|upgrades, downgrades|stock calls|analyst calls|here are|wall street's top|biggest analyst|analyst actions|this week's|benzinga's top|today's|for (monday|tuesday|wednesday|thursday|friday)\b|roundup|movers|buy\/sell:)/i;
const SINGLE_STOCK_MULTI_FIRM = /\banalysts\b|\bthe street\b|\bwall street\b|\bwhat the big money\b/i;

/** "Is this headline about a price target / a rating at all?" */
export const aboutAnalyst = (title: string) => ANALYST_WORDS.test(title);
export const isMultiStockRoundup = (title: string) => MULTI_STOCK.test(title);

const money = (s: string) => Number(s.replace(/,/g, ""));
/** The new target a headline states, when it states one: "to $X from $Y" → X; "target … $X" / "PT … $X" → X; "$X price target" → X. */
export function headlineTarget(title: string): number | null {
  const t = title || "";
  let m = /\bto (?:US)?\$\s?([\d,]+(?:\.\d+)?)\s+from (?:US)?\$/i.exec(t);
  if (m) return money(m[1]);
  m = /\b(?:price target|target|PT|price objective)\b[^$]{0,40}?(?<!\bby\s)(?:US)?\$\s?([\d,]+(?:\.\d+)?)(?!\s?(?:[bmkBMK]\b|bn\b|billion|million|trillion|%))/i.exec(t);
  if (m) return money(m[1]);
  m = /(?<!\bby\s)(?:US)?\$\s?([\d,]+(?:\.\d+)?)\s*(?:price target|PT|target)\b/i.exec(t);
  if (m) return money(m[1]);
  return null;
}

const n = (v: unknown): number | null => { if (v == null || v === "") return null; const x = Number(v); return Number.isFinite(x) ? x : null; };
const t = (iso: string) => new Date(iso).getTime();
const DAY = 86400e3;
const near = (a: number, b: number, tol: number) => b !== 0 && Math.abs(a - b) / Math.abs(b) <= tol;

/** The splits after a note (not in the future), oldest first, as factors numerator/denominator. FMP's convention:
 *  adjusted = raw ÷ the product of the factors (NVDA 10:1 on 10 Jun 2024: a $1,200 target → $120). */
export function splitsAfter(splits: Split[], ticker: string, publishedIso: string, nowIso: string): number[] {
  const out: [string, number][] = [];
  for (const s of splits) {
    if (s.ticker !== ticker) continue;
    if (s.date + "T23:59:59Z" > publishedIso && s.date <= nowIso.slice(0, 10)) {
      const a = n(s.numerator), b = n(s.denominator);
      if (a && b) out.push([s.date, a / b]);
    }
  }
  return out.sort((x, y) => (x[0] < y[0] ? -1 : 1)).map((x) => x[1]);
}
export const splitFactorAfter = (splits: Split[], ticker: string, publishedIso: string, nowIso: string) =>
  splitsAfter(splits, ticker, publishedIso, nowIso).reduce((a, b) => a * b, 1);

export type QOut = QResult & { adj_target_checked: number | null };

/**
 * Classify a set of rows (one or many stocks; all the rows of a stock that bear on each other should be present together:
 * the neighbours for the price check, the firm's earlier notes, the earlier copy of a duplicate). Returns one result per row,
 * in the input order. Rows are processed per stock and kind, oldest first, so "the firm's previous kept target" and "the first
 * kept copy" are well defined. adj_target_checked = the raw target ÷ the splits after the note (from public.splits).
 */
export function classify(rows: QRow[], splits: Split[] = [], nowIso = new Date().toISOString()): QOut[] {
  const res: QOut[] = new Array(rows.length);
  const groups = new Map<string, number[]>();
  rows.forEach((r, i) => { const k = r.ticker + "|" + r.kind; (groups.get(k) || groups.set(k, []).get(k)!).push(i); });
  const byTicker = new Map<string, number[]>();   // price neighbours span both kinds
  rows.forEach((r, i) => { (byTicker.get(r.ticker) || byTicker.set(r.ticker, []).get(r.ticker)!).push(i); });
  const checkedOf = new Map<number, number | null>();

  for (const idx of groups.values()) {
    idx.sort((a, b) => t(rows[a].published_utc) - t(rows[b].published_utc) || (rows[a].firm < rows[b].firm ? -1 : 1));
    const lastKept = new Map<string, number>();   // firm → index of its latest kept row
    for (const i of idx) {
      const r = rows[i];
      const title = String(r.title || "").replace(/Member Login\s*$/, "");   // StreetInsider titles arrive as "… at JefferiesMember Login"
      const hard: string[] = [], soft: string[] = [];
      const isT = r.kind === "TARGET";
      const ts = t(r.published_utc);
      const steps = splitsAfter(splits, r.ticker, r.published_utc, nowIso);
      const F = steps.reduce((a, b) => a * b, 1);
      const prefixes = steps.reduce((acc, f) => [...acc, acc[acc.length - 1] * f], [1]);   // 1, f1, f1·f2, …
      const tgt = n(r.target), adj = n(r.adj_target), pwp = n(r.price_when_posted);

      // the firm: named by an alias, or another firm named instead
      const own = aliasesOf(r.firm);
      const ownNamed = !!title && own.some((a) => has(title, a));
      const roundup = isMultiStockRoundup(title);

      // 1 the headline is about a target / a rating at all (a headline that names the row's own firm counts: "Jefferies on NVIDIA: …")
      if (!title || (!aboutAnalyst(title) && !ownNamed)) hard.push(isT ? "not_about_target" : "not_about_rating");

      // 2 the firm
      if (roundup) soft.push("roundup");
      if (!ownNamed && title) {
        const others = firmsNamed(title, r.ticker).filter((f) => !own.includes(f) && f !== r.firm && !aliasesOf(f).some((a) => own.includes(a)));
        if (others.length && !roundup) hard.push("firm_mismatch(" + others[0] + ")");
        else if (!roundup) soft.push(SINGLE_STOCK_MULTI_FIRM.test(title) ? "firm_unverified(analysts)" : "firm_unverified");
      }

      // 3 the number the headline states; it also tells which raw target FMP meant when its own two numbers disagree
      let confirmed = false, raw = tgt;
      if (isT && tgt != null) {
        const ht = headlineTarget(title);
        if (ht != null) {
          const cands: number[] = [];
          for (const p of prefixes) for (const x of [tgt, adj]) if (x != null && x > 0) cands.push(x, x * p, x / p);
          if (cands.some((c) => near(c, ht, NUM_TOL))) { confirmed = true; raw = ht; soft.push("headline_confirms"); }
          else hard.push("number_mismatch($" + ht + ")");
        }
      }
      const checked = isT && raw != null ? Math.round((raw / F) * 1e4) / 1e4 : null;
      checkedOf.set(i, checked);

      // 4 the price when posted belongs to this stock — only asked when the headline does not name the firm (multi-stock roundups
      //   carry another stock's note and price); a verified note on an earnings day can sit far from the day before
      if (pwp != null && pwp > 0 && !ownNamed && !confirmed) {
        const nb: number[] = [];
        for (const j of byTicker.get(r.ticker) || []) {
          if (j === i) continue;
          const p = n(rows[j].price_when_posted);
          if (p != null && p > 0 && Math.abs(t(rows[j].published_utc) - ts) <= NEIGHBOUR_DAYS * DAY) nb.push(p);
        }
        if (nb.length >= 2) {
          nb.sort((a, b) => a - b);
          const med = nb[Math.floor(nb.length / 2)];
          if (![pwp, ...prefixes.map((p) => pwp / p), ...prefixes.map((p) => pwp * p)].some((p) => near(p, med, PRICE_TOL))) hard.push("price_not_this_stock");
        }
      }

      if (isT && checked != null) {
        // 5 split adjustment: FMP's adj_target against ours (kept, corrected — the note is real, FMP's adjusted number is stale)
        if (adj == null || !near(adj, checked, 0.02)) soft.push("split_mismatch(fmp " + adj + " → " + checked + ")");
        // 6 the target against the price when posted (FMP sends it adjusted or not, so either reading may pass)
        const band = ownNamed ? BAND_PRICE_VERIFIED : BAND_PRICE;
        if (pwp != null && pwp > 0 && !confirmed) {
          const ratios = prefixes.flatMap((p) => [checked / pwp, (checked * p) / pwp]);
          if (!ratios.some((x) => x >= band[0] && x <= band[1])) hard.push("target_vs_price(x" + (checked / pwp).toFixed(2) + ")");
        }
        // 7 the target against the same firm's previous kept target (≤ 365 days)
        const pj = lastKept.get(r.firm);
        if (pj != null && !confirmed && r.firm) {
          const pa = checkedOf.get(pj);
          const bandP = ownNamed ? BAND_PRIOR_VERIFIED : BAND_PRIOR;
          if (pa && ts - t(rows[pj].published_utc) <= PRIOR_DAYS * DAY) {
            // the move beyond the stock's own move: MU at New Street $190 → $1,250 (×6.6) while MU went $187 → $980 (×5.2) is ×1.26
            const pp = n(rows[pj].price_when_posted), stock = pwp != null && pp != null && pwp > 0 && pp > 0 ? pwp / pp : 1;
            const x = checked / pa / (stock > 0 && isFinite(stock) ? stock : 1);
            if (x < bandP[0] || x > bandP[1]) hard.push("jump_vs_firm_prior(x" + x.toFixed(2) + ")");
          }
        }
      }

      // 8 the same note again (a second publisher, a second copy): same firm, same target / same rating, within 3 days of a kept row
      if (!hard.length) {
        const pj = lastKept.get(r.firm);
        if (pj != null && r.firm) {
          const p = rows[pj];
          const within = ts - t(p.published_utc) <= DUP_DAYS * DAY;
          const same = isT ? (() => { const y = checkedOf.get(pj); return checked != null && y != null && near(checked, y, 0.005); })()
            : String(r.new_grade || "").toLowerCase() === String(p.new_grade || "").toLowerCase();
          if (within && same) hard.push("duplicate");
        }
      }

      if (!hard.length) lastKept.set(r.firm, i);
      res[i] = {
        quality: hard.length ? "quarantine" : "ok",
        quality_reason: [...hard, ...soft].join(";") || null,
        adj_target_checked: checked,
      };
    }
  }
  return res;
}

/** The first cause of a reason string, without its detail — what the counts are grouped by. */
export const causeOf = (reason: string | null) => (reason || "").split(";")[0].replace(/\(.*$/, "");

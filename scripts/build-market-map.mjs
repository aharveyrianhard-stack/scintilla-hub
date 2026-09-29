#!/usr/bin/env node
/* T1-MARKET-MAP-3D (27 Sep) — builds the ONE node list the 3D market map reads:
   deliverables/20260927/market-map/nodes.json

   market → regions / asset classes → sector funds (SPDR · iShares · Vanguard · Invesco equal-weight side by side)
          → industry / theme funds → names.

   Inputs (all read-only):
   - the served set: chart API /universe (live, Origin https://scintillahub.ai)
   - sector / industry / market cap of the 317 served companies: data/standard-tree-20260924.json (the tree work of 24 Sep)
   - fund holdings: FMP, 26 Sep, 51 funds — ~/Library/Application Support/scintilla/market-map/pplx-holdings.js
   - the admission list: _worktrees/provider-admission-v2-20260927/control/ADMISSION_V2_CANDIDATES.json
   - admission v3 (29 Sep sitting, 486 -> 590): _worktrees/provider-admission-v3-20260928/control/ADMISSION_V3_CANDIDATES.json
     (cohort, theme, funds per row), counted only for the 104 names on the S1 admit list
     (_archive/admission-v3-20260928/S1-admit-candidates.txt)
   - sector / industry / market cap of those 104: data/market-map-profiles-v3-20260929.json — FMP company profile, read on
     Fly, translated to GICS with the tree's own table (scripts/build-market-map-profiles.py). Never guessed: a served name
     with no profile stops the build.
   Nothing here carries a Geiger reading: the page reads those live. No number is invented.

   Usage: node scripts/build-market-map.mjs [--universe path/to/universe.json] */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "deliverables/20260927/market-map/nodes.json");
const HOLDINGS = join(homedir(), "Library/Application Support/scintilla/market-map/pplx-holdings.js");
const ADMISSION = "/Users/alanharvey/SCINTILLA 0.5/_worktrees/provider-admission-v2-20260927/control/ADMISSION_V2_CANDIDATES.json";
const ADMISSION_V3 = "/Users/alanharvey/SCINTILLA 0.5/_worktrees/provider-admission-v3-20260928/control/ADMISSION_V3_CANDIDATES.json";
const ADMIT_V3_S1 = "/Users/alanharvey/SCINTILLA 0.5/_archive/admission-v3-20260928/S1-admit-candidates.txt";
const PROFILES_V3 = join(ROOT, "data/market-map-profiles-v3-20260929.json");
const CHART_API = "https://scintilla-massive-chart-api.fly.dev";
const TOP_HOLDINGS = 10;

/* ---------- inputs ---------- */
const argU = process.argv.indexOf("--universe");
const universe = argU > 0
  ? JSON.parse(readFileSync(process.argv[argU + 1], "utf8"))
  : await (await fetch(CHART_API + "/universe", { headers: { Origin: "https://scintillahub.ai" } })).json();
const SERVED = new Set(universe.symbols);
// admission v2 (27 Sep sitting): /universe carries tiers.geiger_only — served, computed, shown only where Alan asks.
const SERVED_GEIGER_ONLY = new Set((universe.tiers && universe.tiers.geiger_only) || []);
const tree = JSON.parse(readFileSync(join(ROOT, "data/standard-tree-20260924.json"), "utf8"));
const { HOLD, NAMES, HOLD_SRC } = new Function(readFileSync(HOLDINGS, "utf8") + ";return {HOLD,NAMES,HOLD_SRC}")();
const adm = JSON.parse(readFileSync(ADMISSION, "utf8"));
const GEIGER_ONLY = new Map(adm.geiger_only.map((x) => [x.symbol, x]));
const FULL_CAND = new Map(adm.full.map((x) => [x.symbol, x]));
const OPTIONAL = new Set(Object.values(adm.optional_not_in_list).find(Array.isArray) || []);
// admission v3 (29 Sep): the candidates file has 119 rows; only the 104 on the S1 admit list were admitted and served
const adm3 = JSON.parse(readFileSync(ADMISSION_V3, "utf8"));
const ADMIT_V3 = readFileSync(ADMIT_V3_S1, "utf8").trim().split(",").map((s) => s.trim()).filter(Boolean);
const V3_ROW = new Map(adm3.full.filter((x) => ADMIT_V3.includes(x.symbol)).map((x) => [x.symbol, x]));
const PROF3 = JSON.parse(readFileSync(PROFILES_V3, "utf8"));

/* ---------- the fund skeleton (hand-kept: this IS the map's structure) ---------- */
const SECTORS = [
  // [id, label, SPDR, iShares, Vanguard, Invesco equal-weight, [industry / theme funds]]
  ["TECH", "Information Technology", "XLK", "IYW", "VGT", "RSPT", ["SMH", "SOXX", "XSD", "DRAM", "IGV", "SKYY", "CIBR", "IGM", "QTUM", "AGIX"]],
  ["FIN", "Financials", "XLF", "IYF", "VFH", "RSPF", ["KBE", "KRE", "IAT", "KIE", "IAK", "IAI", "IYG", "IPAY", "FINX"]],
  ["HLTH", "Health Care", "XLV", "IYH", "VHT", "RSPH", ["IBB", "XBI", "IHI", "XPH", "IHF", "IHE"]],
  ["ENGY", "Energy", "XLE", "IYE", "VDE", "RSPG", ["XOP", "IEO", "IEZ", "URA", "TAN"]],
  ["INDU", "Industrials", "XLI", "IYJ", "VIS", "RSPN", ["ITA", "IYT", "JETS", "PAVE", "ARKX", "BOTZ"]],
  ["STPL", "Consumer Staples", "XLP", "IYK", "VDC", "RSPS", []],
  ["DISC", "Consumer Discretionary", "XLY", "IYC", "VCR", "RSPD", ["XRT", "XHB", "ITB", "PEJ"]],
  ["UTIL", "Utilities", "XLU", "IDU", "VPU", "RSPU", []],
  ["MATL", "Materials", "XLB", "IYM", "VAW", "RSPM", ["GDX", "GDXJ", "SIL", "SILJ", "COPX", "LIT", "REMX"]],
  ["REIT", "Real Estate", "XLRE", "IYR", "VNQ", "RSPR", ["REZ"]],
  ["COMM", "Communication Services", "XLC", "IYZ", "VOX", "RSPC", ["FDN"]],
];
const ISSUER_OF_COLUMN = ["State Street SPDR", "iShares", "Vanguard", "Invesco (equal weight)"];
const REGIONS = [
  // [id, label, parent, funds]
  ["US", "US stocks", "MARKET", []],
  ["US_BROAD", "US broad market", "US", ["SPY", "VTI", "ITOT", "IWV", "RSP", "DIA", "QQQ", "QQEW", "QQQE", "MAGS", "MDY", "IWM", "IJR"]],
  ["US_STYLE", "US style and factor", "US", ["VUG", "VTV", "MGK", "SCHD", "SPLV", "QUAL", "MTUM"]],
  ["US_SECTORS", "US sectors", "US", []],
  ["WORLD", "The whole world", "MARKET", ["VT", "VXUS"]],
  ["INTL_DEV", "International developed", "WORLD", ["EFA", "EZU", "EWG", "EWU", "EWJ"]],
  ["EM", "Emerging markets", "WORLD", ["EEM", "FXI", "MCHI", "ASHR", "EWY"]],
  ["BONDS", "Bonds", "MARKET", ["AGG", "SHY", "IEF", "TLT", "LQD", "HYG"]],
  ["CMDTY", "Commodities", "MARKET", ["DBC", "GLD", "SLV", "USO"]],
  ["CRYPTO", "Crypto", "MARKET", ["IBIT"]],
  ["MACRO", "Dollar and volatility", "MARKET", ["UUP", "VXX"]],
];
const ISSUER_BY_PREFIX = [
  [/^XL|^SPY$|^DIA$|^MDY$|^RSP$|^XOP$|^XRT$|^XHB$|^XPH$|^KBE$|^KRE$|^KIE$|^XBI$|^XSD$|^GLD$|^SPLV$/, "State Street SPDR"],
  [/^I|^EF|^EZ|^EW|^EEM$|^MCHI$|^SLV$|^SOXX$|^TLT$|^IEF$|^SHY$|^LQD$|^HYG$|^AGG$|^QUAL$|^MTUM$|^REZ$/, "iShares"],
  [/^V|^MGK$/, "Vanguard"],
  [/^QQQ$|^QQEW$|^RSP.$|^DBC$|^UUP$|^PEJ$|^SPLV$/, "Invesco"],
];
const ISSUER_FIX = { RSP: "Invesco", SPLV: "Invesco", QQQE: "Direxion", MAGS: "Roundhill", GDX: "VanEck", GDXJ: "VanEck",
  SMH: "VanEck", SIL: "Global X", SILJ: "Amplify", COPX: "Global X", LIT: "Global X", REMX: "VanEck", URA: "Global X",
  TAN: "Invesco", ITA: "iShares", IYT: "iShares", JETS: "US Global", PAVE: "Global X", ARKX: "ARK", BOTZ: "Global X",
  FDN: "First Trust", SKYY: "First Trust", CIBR: "First Trust", QTUM: "Defiance", AGIX: "KraneShares", DRAM: "Roundhill",
  IPAY: "Amplify", FINX: "Global X", FXI: "iShares", ASHR: "Xtrackers", USO: "US Commodity Funds", SCHD: "Schwab",
  IBIT: "iShares", VXX: "iPath (Barclays)", ITB: "iShares", IGV: "iShares", IHI: "iShares", IBB: "iShares", ITOT: "iShares",
  IWV: "iShares", IWM: "iShares", IJR: "iShares", VT: "Vanguard", VTI: "Vanguard", VXUS: "Vanguard", MDY: "State Street SPDR" };
function issuerOf(t) {
  if (ISSUER_FIX[t]) return ISSUER_FIX[t];
  for (const [re, who] of ISSUER_BY_PREFIX) if (re.test(t)) return who;
  return null;
}

/* ---------- tier ---------- */
// FULL = served today (in /universe). GEIGER-ONLY = on the 27 Sep admission list for a Geiger only, not served yet.
// NOT_ADMITTED = everything else (named on the map, never admitted). `planned_tier` says what an admission would make it.
function tierOf(t) {
  if (SERVED.has(t) && SERVED_GEIGER_ONLY.has(t)) return { served: true, tier: "GEIGER-ONLY", planned_tier: null, admission: "served (Geiger only, admitted 27 Sep)" };
  if (SERVED.has(t) && V3_ROW.has(t)) return { served: true, tier: "FULL", planned_tier: null, admission: "served (admitted 29 Sep, admission v3)" };
  if (SERVED.has(t)) return { served: true, tier: "FULL", planned_tier: null, admission: "served" };
  if (GEIGER_ONLY.has(t)) return { served: false, tier: "GEIGER-ONLY", planned_tier: "GEIGER-ONLY", admission: "on the 27 Sep admission list (Geiger only)" };
  if (FULL_CAND.has(t)) return { served: false, tier: "NOT_ADMITTED", planned_tier: "FULL", admission: "on the 27 Sep admission list (full)" };
  if (OPTIONAL.has(t)) return { served: false, tier: "NOT_ADMITTED", planned_tier: "GEIGER-ONLY", admission: "proposed: iShares industry fund, not on the list yet" };
  if (/^RSP[A-Z]$/.test(t)) return { served: false, tier: "NOT_ADMITTED", planned_tier: "GEIGER-ONLY", admission: "proposed: Invesco equal-weight sector fund, not on the list yet" };
  return { served: false, tier: "NOT_ADMITTED", planned_tier: null, admission: "not admitted" };
}

/* ---------- holdings (FMP, 26 Sep) ---------- */
const CASHLIKE = /money market|treasury oblig|govt oblig|cash|usd\b|liquidity fund|margin/i;
// FMP writes BRK.B, the Hub BRK-B; but a line the Hub serves with the dot (MOG.A, admitted 29 Sep) keeps it
const usTicker = (t) => (SERVED.has(t) ? t : /^[A-Z]{1,5}\.[A-Z]$/.test(t) ? t.replace(".", "-") : t);
function topHoldings(fund) {
  const h = HOLD[fund];
  if (!h) return null;
  const rows = h.h
    .filter(([t]) => !CASHLIKE.test(NAMES[t] || "") && !/^CASH/.test(t) && !/XX$/.test(t))
    .slice(0, TOP_HOLDINGS)
    .map(([t, w]) => ({ ticker: usTicker(t), name: NAMES[t] || null, weight_pct: +w.toFixed(2) }));
  return { as_of: "2026-09-26", source: HOLD_SRC, count_in_fund: h.n, top: rows };
}

/* ---------- build ---------- */
const nodes = new Map();
function add(n) {
  if (nodes.has(n.id)) throw new Error("duplicate node " + n.id);
  nodes.set(n.id, n);
  return n;
}
function group(id, label, parent) {
  return add({ id, ticker: null, label, parents: parent ? [parent] : [], kind: "index", issuer: null,
    served: false, tier: null, planned_tier: null, admission: "a heading, not a tradable line: it has no Geiger of its own",
    market_value_usd: null, holdings: null });
}
function fund(t, parent, role) {
  const etf = tree.etfs[t];
  const tt = tierOf(t);
  return add({ id: t, ticker: t, label: (etf && etf.name) || null, parents: [parent], kind: "fund", role,
    issuer: issuerOf(t), ...tt, market_value_usd: null, holdings: topHoldings(t) });
}

group("MARKET", "The market", null);
for (const [id, label, parent, funds] of REGIONS) {
  group(id, label, parent);
  for (const t of funds) fund(t, id, "broad");
}
const SECTOR_OF = {}; // GICS sector label → group id
for (const [id, label, ...rest] of SECTORS) {
  const [spdr, ish, vg, inv, inds] = rest;
  group("SEC_" + id, label, "US_SECTORS");
  SECTOR_OF[label] = "SEC_" + id;
  [spdr, ish, vg, inv].forEach((t, i) => { const n = fund(t, "SEC_" + id, "sector"); n.issuer = ISSUER_OF_COLUMN[i]; });
  for (const t of inds) fund(t, "SEC_" + id, "industry");
}

// fund labels the tree file does not carry: take them from the holdings file's own names where possible, else a plain word
const LABEL_FIX = { IYW: "iShares U.S. Technology", IYF: "iShares U.S. Financials", IYH: "iShares U.S. Healthcare",
  IYE: "iShares U.S. Energy", IYJ: "iShares U.S. Industrials", IYK: "iShares U.S. Consumer Staples",
  IYC: "iShares U.S. Consumer Discretionary", IDU: "iShares U.S. Utilities", IYM: "iShares U.S. Basic Materials",
  IYR: "iShares U.S. Real Estate", IYZ: "iShares U.S. Telecommunications", VGT: "Vanguard Information Technology",
  VFH: "Vanguard Financials", VHT: "Vanguard Health Care", VDE: "Vanguard Energy", VIS: "Vanguard Industrials",
  VDC: "Vanguard Consumer Staples", VCR: "Vanguard Consumer Discretionary", VPU: "Vanguard Utilities",
  VAW: "Vanguard Materials", VNQ: "Vanguard Real Estate", VOX: "Vanguard Communication Services",
  RSPT: "Invesco S&P 500 Equal Weight Technology", RSPF: "Invesco S&P 500 Equal Weight Financials",
  RSPH: "Invesco S&P 500 Equal Weight Health Care", RSPG: "Invesco S&P 500 Equal Weight Energy",
  RSPN: "Invesco S&P 500 Equal Weight Industrials", RSPS: "Invesco S&P 500 Equal Weight Consumer Staples",
  RSPD: "Invesco S&P 500 Equal Weight Consumer Discretionary", RSPU: "Invesco S&P 500 Equal Weight Utilities",
  RSPM: "Invesco S&P 500 Equal Weight Materials", RSPR: "Invesco S&P 500 Equal Weight Real Estate",
  RSPC: "Invesco S&P 500 Equal Weight Communication Services", VT: "Vanguard Total World Stock", ITOT: "iShares Core S&P Total U.S. Stock Market",
  IWV: "iShares Russell 3000", VXUS: "Vanguard Total International Stock", AGG: "iShares Core U.S. Aggregate Bond",
  DBC: "Invesco DB Commodity Index Tracking", UUP: "Invesco DB US Dollar Index Bullish", QQEW: "First Trust NASDAQ-100 Equal Weighted",
  IJR: "iShares Core S&P Small-Cap", VXX: "iPath Series B S&P 500 VIX Short-Term Futures", VUG: "Vanguard Growth", VTV: "Vanguard Value",
  SCHD: "Schwab U.S. Dividend Equity", SPLV: "Invesco S&P 500 Low Volatility", QUAL: "iShares MSCI USA Quality Factor",
  MTUM: "iShares MSCI USA Momentum Factor", MGK: "Vanguard Mega Cap Growth", SKYY: "First Trust Cloud Computing",
  XRT: "SPDR S&P Retail", XHB: "SPDR S&P Homebuilders", XPH: "SPDR S&P Pharmaceuticals", IBB: "iShares Biotechnology",
  KBE: "SPDR S&P Bank", IPAY: "Amplify Digital Payments", XOP: "SPDR S&P Oil & Gas Exploration & Production",
  IBIT: "iShares Bitcoin Trust", XSD: "SPDR S&P Semiconductor", IGV: "iShares Expanded Tech-Software Sector",
  CIBR: "First Trust NASDAQ Cybersecurity", IGM: "iShares Expanded Tech Sector", QTUM: "Defiance Quantum",
  KRE: "SPDR S&P Regional Banking", IAT: "iShares U.S. Regional Banks", KIE: "SPDR S&P Insurance", IAK: "iShares U.S. Insurance",
  IAI: "iShares U.S. Broker-Dealers & Securities Exchanges", IYG: "iShares U.S. Financial Services", FINX: "Global X FinTech",
  XBI: "SPDR S&P Biotech", IHI: "iShares U.S. Medical Devices", IHF: "iShares U.S. Healthcare Providers",
  IHE: "iShares U.S. Pharmaceuticals", IEO: "iShares U.S. Oil & Gas Exploration & Production", IEZ: "iShares U.S. Oil Equipment & Services",
  URA: "Global X Uranium", TAN: "Invesco Solar", ITA: "iShares U.S. Aerospace & Defense", IYT: "iShares U.S. Transportation",
  JETS: "U.S. Global Jets", PAVE: "Global X U.S. Infrastructure Development", ARKX: "ARK Space & Defense Innovation",
  BOTZ: "Global X Robotics & Artificial Intelligence", ITB: "iShares U.S. Home Construction", PEJ: "Invesco Leisure and Entertainment",
  LIT: "Global X Lithium & Battery Tech", REMX: "VanEck Rare Earth and Strategic Metals", REZ: "iShares Residential and Multisector Real Estate",
  FDN: "First Trust Dow Jones Internet" };
for (const n of nodes.values()) if (n.kind === "fund" && !n.label) n.label = LABEL_FIX[n.ticker] || n.ticker;

/* names — every served company, under its GICS sector (from the 24 Sep tree) */
const sectorGroupOfFund = (t) => { const n = nodes.get(t); return n && n.parents[0].startsWith("SEC_") ? n.parents[0] : null; };
for (const nm of Object.values(tree.names)) {
  if (!SERVED.has(nm.ticker)) continue;
  const sec = SECTOR_OF[nm.gics_sector];
  if (!sec) throw new Error("no sector group for " + nm.ticker + " " + nm.gics_sector);
  add({ id: nm.ticker, ticker: nm.ticker, label: nm.name, parents: [sec], kind: "name", issuer: null,
    ...tierOf(nm.ticker), gics_industry: nm.gics_industry || null,
    market_value_usd: Number.isFinite(nm.cap) ? nm.cap : null, holdings: null });
}
/* the 104 names admission v3 served on 29 Sep: placed under their GICS sector from FMP's company profile (the same
   translation the tree uses), with their admission cohort / theme / funds kept on the node. No profile → stop, never guess. */
for (const t of ADMIT_V3) {
  if (!SERVED.has(t) || nodes.has(t)) continue;
  const p = PROF3.names[t], x = V3_ROW.get(t);
  if (!p || !p.gics_sector || !p.gics_industry) throw new Error("admission v3 name without an FMP sector / industry: " + t + " (run scripts/build-market-map-profiles.py)");
  const sec = SECTOR_OF[p.gics_sector];
  if (!sec) throw new Error("no sector group for " + t + " " + p.gics_sector);
  add({ id: t, ticker: t, label: p.name || t, parents: [sec], kind: "name", issuer: null,
    ...tierOf(t), gics_industry: p.gics_industry, placed_by: "FMP company profile (sector, industry), admitted 29 Sep",
    admission_v3: { cohort: x ? x.cohort : null, theme: x ? x.theme : null, funds: x ? x.funds : [] },
    market_value_usd: Number.isFinite(p.cap) ? p.cap : null, holdings: null });
}
/* candidate names on the admission list (FULL), placed by their cohort — approximate until admitted */
const COHORT_SECTOR = { AI_HARDWARE: "SEC_TECH", THEMATIC: "SEC_INDU", MATERIALS: "SEC_MATL", CRYPTO: "CRYPTO", BLUE_CHIP: "SEC_INDU" };
const URANIUM = new Set(["LEU", "UUUU"]);
for (const [t, x] of FULL_CAND) {
  if (nodes.has(t) || x.cohort === "FUNDS") continue;
  const parent = URANIUM.has(t) ? "SEC_ENGY" : COHORT_SECTOR[x.cohort];
  add({ id: t, ticker: t, label: NAMES[t] || NAMES[t.replace("-", ".")] || t, parents: [parent], kind: "name", issuer: null,
    ...tierOf(t), placed_by: "admission cohort " + x.cohort + " (approximate)", market_value_usd: null, holdings: null });
}
/* the biggest holdings of every sector / industry fund that the Hub does not serve yet — honest gaps, US lines only */
for (const n of [...nodes.values()]) {
  if (n.kind !== "fund" || !n.holdings || (n.role !== "sector" && n.role !== "industry")) continue;
  const sec = sectorGroupOfFund(n.ticker);
  for (const h of n.holdings.top.slice(0, 5)) {
    if (nodes.has(h.ticker) || !/^[A-Z]{1,5}(-[A-Z])?$/.test(h.ticker)) continue;
    add({ id: h.ticker, ticker: h.ticker, label: h.name || h.ticker, parents: [sec], kind: "name", issuer: null,
      ...tierOf(h.ticker), placed_by: "top holding of " + n.ticker, market_value_usd: null, holdings: null });
  }
}
/* "also held by" links: a name that sits in the top holdings of an industry / theme fund also hangs off that fund */
for (const n of nodes.values()) {
  if (n.kind !== "fund" || n.role !== "industry" || !n.holdings) continue;
  for (const h of n.holdings.top) {
    const nm = nodes.get(h.ticker);
    if (nm && nm.kind === "name" && !nm.parents.includes(n.id)) nm.parents.push(n.id);
  }
}
/* any served line the skeleton missed goes under a visible "other" heading, never dropped */
const missed = universe.symbols.filter((t) => !nodes.has(t));
if (missed.length) {
  group("OTHER", "Other served lines", "MARKET");
  for (const t of missed) {
    const nm = tree.names[t];
    add({ id: t, ticker: t, label: (nm && nm.name) || (tree.etfs[t] && tree.etfs[t].name) || t, parents: ["OTHER"],
      kind: tree.etfs[t] ? "fund" : "name", issuer: issuerOf(t), ...tierOf(t),
      market_value_usd: nm && Number.isFinite(nm.cap) ? nm.cap : null, holdings: topHoldings(t) });
  }
}

const list = [...nodes.values()];
const count = (f) => list.filter(f).length;
const out = {
  artifact_kind: "SCINTILLA_MARKET_MAP_NODES",
  built_utc: new Date().toISOString(),
  what: "One node list for the 3D market map. Structure only: no Geiger, price or change is stored here — the page reads those live.",
  provenance: {
    universe: { source: CHART_API + "/universe", count: universe.count, sha256: universe.universe_sha256, symbols: universe.symbols },
    names: "data/standard-tree-20260924.json (GICS sector and industry, market cap from company_profile)",
    holdings: { source: HOLD_SRC, as_of: "2026-09-26", funds_with_holdings: Object.keys(HOLD).length, top_kept: TOP_HOLDINGS },
    admission: { source: "provider-admission-v2-20260927/control/ADMISSION_V2_CANDIDATES.json", status: adm.status },
    admission_v3: { source: "provider-admission-v3-20260928/control/ADMISSION_V3_CANDIDATES.json", built: adm3.built,
      admitted: "_archive/admission-v3-20260928/S1-admit-candidates.txt", admitted_count: ADMIT_V3.length,
      profiles: { source: "data/market-map-profiles-v3-20260929.json", fetched_utc: PROF3.provenance.fetched_utc, translation: PROF3.provenance.translation } },
  },
  tiers: {
    "FULL": "served today: in /universe, so it has a live Geiger",
    "GEIGER-ONLY": "on the 27 Sep admission list for a Geiger only; not served yet, so drawn hollow",
    "NOT_ADMITTED": "named on the map but not served; planned_tier says what admission would make it",
  },
  counts: {
    nodes: list.length, headings: count((n) => n.kind === "index"), funds: count((n) => n.kind === "fund"),
    names: count((n) => n.kind === "name"), served: count((n) => n.served), waiting: count((n) => n.ticker && !n.served),
    universe_placed: universe.symbols.length - missed.length, universe_missed: missed,
  },
  nodes: list,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(OUT, JSON.stringify(out.counts));

/* U4b (3 Oct 2026) · SK Hynix, the dry run of what the Hub would hold — comps under C4 (live) and C5 (pushed), and the currency
   conversion the Hub would apply. Reads data/skhy-probe-20261003.json (FMP + Massive, read on a throw-away Fly machine),
   data/db-20261003.json and the two comps rules. Writes data/skhy-dryrun-20261003.json. Nothing live is read or written.
   Usage (from the Hub root):
     node deliverables/20261003/u4b-facts/skhy-dryrun.mjs [--c5 <dir with lines.mjs + segments-2026-10-03.json>] */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { inputs, buildSet as c4Set } from "../../20261001/comps-mechanic/read.mjs";

const DIR = dirname(fileURLToPath(import.meta.url)), ROOT = join(DIR, "../../..");
const J = (p) => JSON.parse(readFileSync(p, "utf8"));
const arg = (k) => { const i = process.argv.indexOf(k); return i < 0 ? null : process.argv[i + 1]; };
const DB = J(join(DIR, "data/db-20261003.json")), UNI = J(join(DIR, "data/universe-20261003.json")), P = J(join(DIR, "data/skhy-probe-20261003.json"));
const page = (rows, path) => { const m = path.match(/limit=(\d+)/), o = path.match(/offset=(\d+)/); const off = o ? +o[1] : 0, lim = m ? +m[1] : rows.length; return rows.slice(off, off + lim); };
const prof = P.skhy.fmp.profile_SKHY.row;
/* SKHY's profile row as the Hub's profile loader would write it from FMP /stable/profile (the fields the comps rules read) */
const skhyRow = { ticker: "SKHY", name: prof.companyName, industry: prof.industry, sector: prof.sector, market_cap: prof.marketCap, is_etf: "false", country: prof.country };
const pg = async (path) => {
  if (path.startsWith("company_profile")) return page([...DB.profile.map((r) => ({ ticker: r.ticker, name: r.name, industry: r.industry, sector: r.sector, market_cap: r.market_cap, is_etf: r.is_etf, country: r.country })), skhyRow].sort((a, b) => a.ticker.localeCompare(b.ticker)), path);
  if (path.startsWith("ticker_industry")) return DB.ticker_industry;
  if (path.startsWith("fmp_peers")) return page(DB.peers_fmp, path);
  if (path.startsWith("peer_sources")) return page(DB.peers_src, path);
  throw new Error("unexpected read " + path);
};
const inp = await inputs({ pg, fetchJson: async (url) => J(join(ROOT, url.replace(/^\//, ""))) });
const uni = new Set([...UNI.symbols, "SKHY"]);
const companies = Object.keys(inp.profiles).filter((t) => uni.has(t) && !inp.profiles[t].is_etf).sort();
const takers = (setOf) => companies.filter((t) => t !== "SKHY").filter((t) => { try { return setOf(t).kept.some((r) => r.ticker === "SKHY"); } catch { return false; } });

const out = { built_utc: new Date().toISOString(), what: "SK Hynix (SKHY) added to today's served companies: its own comps set and the companies whose set would keep it", profile_used: skhyRow };
const s4 = c4Set("SKHY", inp);
out.c4 = { set: s4.kept.map((r) => [r.ticker, r.match_word, r.ratio && +r.ratio.toFixed(2)]), counts: s4.counts, taken_by: takers((t) => c4Set(t, inp)) };
const c5dir = arg("--c5");
if (c5dir) {
  const { buildSet: c5Set } = await import(pathToFileURL(join(c5dir, "lines.mjs")).href);
  const inp5 = { ...inp, segments: J(join(c5dir, "segments-2026-10-03.json")).companies };
  const s5 = c5Set("SKHY", inp5);
  out.c5 = { set: s5.kept.map((r) => [r.ticker, +r.sim.toFixed(2), r.seat || null]), lines: s5.own_lines, counts: s5.counts, taken_by: takers((t) => c5Set(t, inp5)) };
}

/* the currency, the Hub's way (C3's reader: filer_currency + fx_rates): statements in KRW per ADS, converted at KRWUSD */
const inc = P.skhy.fmp.income_q_SKHY.rows, incK = P.skhy.fmp["income_q_000660_KS"].rows, fx = P.skhy.fmp.fx_KRWUSD.newest;
const prem = P.premium.rows.filter(([, a, k, f]) => a && k && f).map(([d, a, k, f]) => [d, +(a / (k * f / 10) - 1).toFixed(3)]);
out.currency = {
  filer_currency_row: { ticker: "SKHY", reported_currency: inc[0].reportedCurrency, listing_currency: prof.currency, is_adr: prof.isAdr, shares_dil: inc[0].weightedAverageShsOutDil, statement_date: inc[0].date, source: "fmp:income-statement" },
  ads_per_share: +(inc[0].weightedAverageShsOutDil / incK[0].weightedAverageShsOutDil).toFixed(3),
  ads_ratio_source: "SEC Form 424B4 (SK hynix, July 2026): ten ADSs represent one common share; FMP's SKHY statements carry the ADS-equivalent share count (7,134.8 M vs 713.5 M on 000660.KS)",
  krwusd_newest: fx, fx_rates_has_krw: false, fx_rates_pairs_today: ["CADUSD", "CNYUSD", "EURUSD", "GBPUSD", "TWDUSD"],
  eps_q2_2026_per_ads: { krw: inc[0].epsDiluted, usd: +(inc[0].epsDiluted * fx.price).toFixed(2) },
  premium_vs_korean_line: { method: "SKHY close ÷ (000660.KS close × KRWUSD ÷ 10), same calendar date, FMP EOD", last: prem.at(-1), min: prem.reduce((m, r) => (r[1] < m[1] ? r : m)), max: prem.reduce((m, r) => (r[1] > m[1] ? r : m)), sessions: prem.length },
};
writeFileSync(join(DIR, "data/skhy-dryrun-20261003.json"), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ c4: out.c4.set.map((r) => r[0]), c4_taken_by: out.c4.taken_by, c5: out.c5 && out.c5.set.map((r) => r[0]), c5_taken_by: out.c5 && out.c5.taken_by, ads: out.currency.ads_per_share, premium: out.currency.premium_vs_korean_line }));

/* U4b (3 Oct 2026) · how many companies use each name as a comps peer — C4's rule (live: deliverables/20261001/comps-mechanic)
   and, when given, C5's rule (hub/c5-comps-method-20261003, lines.mjs + its segments file). Runs both rules exactly as the
   Hub's tab does, over today's database snapshot (data/db-20261003.json) — no fetch, nothing written but the counts file.
   Every served company (today's universe, a profile row, not a fund) gets a set; a name's count = the sets that keep it.
   Usage (from the Hub root):
     node deliverables/20261003/u4b-facts/comps-counts.mjs [--c5 <dir with lines.mjs + segments-2026-10-03.json> --c5-sha <sha>] */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { inputs, buildSet as c4Set } from "../../20261001/comps-mechanic/read.mjs";

const DIR = dirname(fileURLToPath(import.meta.url)), ROOT = join(DIR, "../../..");
const J = (p) => JSON.parse(readFileSync(p, "utf8"));
const arg = (k) => { const i = process.argv.indexOf(k); return i < 0 ? null : process.argv[i + 1]; };
const DB = J(join(DIR, "data/db-20261003.json")), UNI = J(join(DIR, "data/universe-20261003.json"));

/* the PostgREST reads read.mjs makes, answered from the snapshot (the same columns, paged the same way) */
const page = (rows, path) => { const m = path.match(/limit=(\d+)/), o = path.match(/offset=(\d+)/); const off = o ? +o[1] : 0, lim = m ? +m[1] : rows.length; return rows.slice(off, off + lim); };
const pg = async (path) => {
  if (path.startsWith("company_profile")) return page([...DB.profile].sort((a, b) => a.ticker.localeCompare(b.ticker)).map((r) => ({ ticker: r.ticker, name: r.name, industry: r.industry, sector: r.sector, market_cap: r.market_cap, is_etf: r.is_etf, country: r.country })), path);
  if (path.startsWith("ticker_industry")) return DB.ticker_industry;
  if (path.startsWith("fmp_peers")) return page(DB.peers_fmp, path);
  if (path.startsWith("peer_sources")) return page(DB.peers_src, path);
  throw new Error("unexpected read " + path);
};
const fetchJson = async (url) => J(join(ROOT, url.replace(/^\//, "")));
const inp = await inputs({ pg, fetchJson });

const uni = new Set(UNI.symbols);
const companies = Object.keys(inp.profiles).filter((t) => uni.has(t) && !inp.profiles[t].is_etf).sort();
const count = (sets) => { const used = {}; for (const s of sets) for (const r of s.kept) (used[r.ticker] ||= []).push(s.ticker); return used; };

const c4 = companies.map((t) => { try { return c4Set(t, inp); } catch (e) { return { ticker: t, kept: [], error: e.message }; } });
const out = { built_utc: new Date().toISOString(), what: "comps peer counts per name — the sets every served company gets on each rule, over today's database snapshot", companies: companies.length,
  c4: { rule: "C4 (live, deliverables/20261001/comps-mechanic): four sources → same industry → market value within ÷10…×10 → the nearest 10", sets: Object.fromEntries(c4.map((s) => [s.ticker, s.kept.map((r) => r.ticker)])), used_by: count(c4), errors: c4.filter((s) => s.error).map((s) => [s.ticker, s.error]) } };

const c5dir = arg("--c5");
if (c5dir) {
  const { buildSet: c5Set } = await import(pathToFileURL(join(c5dir, "lines.mjs")).href);
  const seg = J(join(c5dir, "segments-2026-10-03.json"));
  const inp5 = { ...inp, segments: seg.companies };
  const c5 = companies.map((t) => { try { return c5Set(t, inp5); } catch (e) { return { ticker: t, kept: [], error: e.message }; } });
  out.c5 = { rule: "C5 (pushed, not live): business lines from FMP revenue segments, similarity ≥ 0.15, two seats per line, soft size term, the best 12", sha: arg("--c5-sha"), sets: Object.fromEntries(c5.map((s) => [s.ticker, s.kept.map((r) => r.ticker)])), used_by: count(c5), errors: c5.filter((s) => s.error).map((s) => [s.ticker, s.error]) };
}
writeFileSync(join(DIR, "data/comps-counts-20261003.json"), JSON.stringify(out));
console.log(JSON.stringify({ companies: out.companies, c4_names_used: Object.keys(out.c4.used_by).length, c4_errors: out.c4.errors.length, c5_names_used: out.c5 ? Object.keys(out.c5.used_by).length : null, c5_errors: out.c5 ? out.c5.errors.length : null }));

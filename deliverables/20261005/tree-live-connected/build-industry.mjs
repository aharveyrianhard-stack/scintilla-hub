#!/usr/bin/env node
/* T5 (2 Oct) · industry-20261002.json: per name, its FMP industry and sector (the standard's authority), its SIC code
   (the standard's tag) and the standard's disagreement note where the two differ. Built only from the dated local
   snapshots the U1 lane committed under deliverables/20261001/universe-standard (FMP profile, 1 Oct; the Massive
   reference probe, 1 Oct, 97 names; derived-20261001.json). Nothing live is read and nothing is written to a table. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, "../../..");
const U = join(ROOT, "deliverables/20261001/universe-standard");
const T = JSON.parse(readFileSync(join(HERE, "tree.json"), "utf8"));
const D = JSON.parse(readFileSync(join(U, "derived-20261001.json"), "utf8"));
const probe = JSON.parse(readFileSync(join(U, "data/sources-probe-20261001.json"), "utf8"));
/* 2 Oct (coordinator): the SIC codes for every served name, exported from public.ticker_industry (FMP profile + Massive reference,
   loaded 1 Oct by the peer-sources job); the 1 Oct probe stays the fallback for a name the table lacks. */
const tiPath = join(U, "data/ticker_industry-20261002.json");
const ti = existsSync(tiPath) ? Object.fromEntries(JSON.parse(readFileSync(tiPath, "utf8")).map((r) => [r.ticker, r])) : {};
const prof = Object.fromEntries(JSON.parse(readFileSync(join(U, "data/company_profile-20261001.json"), "utf8")).map((r) => [r.ticker, r]));
const dis = Object.fromEntries(D.authorities.industry_disagreements.map((x) => [x.ticker, x.note]));
const rows = {};
for (const n of T.nodes.filter((x) => x.kind === "name")) {
  const t = n.ticker, p = prof[t], r = ti[t] && ti[t].sic_code ? ti[t] : probe.ref[t];
  rows[t] = { fmp_industry: (p && p.industry) || (ti[t] && ti[t].fmp_industry) || null, fmp_sector: (p && p.sector) || (ti[t] && ti[t].fmp_sector) || null, sic_code: (r && r.sic_code) || null, sic_description: (r && r.sic_description) || null, disagreement: dis[t] || null };
}
const out = { what: "per name: FMP industry and sector (the authority), SIC code and description (the tag), and the standard's disagreement note where the two differ", built_utc: new Date().toISOString(),
  sources: { fmp_industry: "deliverables/20261001/universe-standard/data/company_profile-20261001.json (FMP /stable/profile, 1 Oct)", sic: "deliverables/20261001/universe-standard/data/ticker_industry-20261002.json (public.ticker_industry, exported 2 Oct) then deliverables/20261001/universe-standard/data/sources-probe-20261001.json (Massive /v3/reference/tickers, 1 Oct, the probed names only)", disagreement: "derived-20261001.json authorities.industry_disagreements (U1)" },
  counts: { names: Object.keys(rows).length, with_fmp_industry: Object.values(rows).filter((r) => r.fmp_industry).length, with_sic: Object.values(rows).filter((r) => r.sic_code).length, with_disagreement: Object.values(rows).filter((r) => r.disagreement).length },
  rows };
writeFileSync(join(HERE, "industry-20261002.json"), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.counts));

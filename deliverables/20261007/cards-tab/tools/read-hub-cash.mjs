/* CP2 (7 Oct 2026) · what the Hub's OWN table says for the newest fiscal year's cash flow of the card names, kept beside
   FMP's readings so the page can show the two side by side. Public read path (the address and the public key are taken
   from index.html at run time and never printed); GET only; writes data/hub-cashflow-2026-10-07.json.
     node deliverables/20261007/cards-tab/tools/read-hub-cash.mjs          (from the Hub repo root) */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../../.."), DATA = path.join(HERE, "..", "data");
const page = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const SB = page.match(/^const SB\s*=\s*"([^"]+)"/m)[1];
const at = page.indexOf("const ANON = "), seg = page.slice(at, at + 1200);
const key = (seg.match(/"(eyJ[A-Za-z0-9._-]+)"/) || seg.match(/"(sb_publishable_[A-Za-z0-9_-]+)"/) || [])[1];
if (!key) { console.error("no public key in the page"); process.exit(2); }
const pg = async (p) => { const r = await fetch(SB + "/rest/v1/" + p, { headers: { apikey: key, Authorization: "Bearer " + key } }); if (!r.ok) throw new Error(p.split("?")[0] + " → " + r.status); return r.json(); };
const names = Object.keys(JSON.parse(fs.readFileSync(path.join(DATA, "cards.json"), "utf8")).cards);
const rows = await pg("cashflow_history?ticker=in.(" + names.join(",") + ")&period=eq.FY&fiscal_year=gte.2024&select=ticker,fiscal_year,fiscal_date,operating_cf,capex,free_cf&order=ticker,fiscal_year.desc&limit=400");   // the last few years only: every name's newest row is inside the limit
if (rows.length >= 400) { console.error("the read was cut at its limit"); process.exit(2); }
const out = { what: "the Hub's table cashflow_history, newest fiscal year per card name (the row the FINANCIALS tab draws)", read_utc: new Date().toISOString(), names: {} };
for (const t of names) { const r = rows.find((x) => x.ticker === t); out.names[t] = r ? { fiscal_year: r.fiscal_year, fiscal_date: r.fiscal_date, operating_cf: r.operating_cf, capex: r.capex, free_cf: r.free_cf } : null; }
fs.writeFileSync(path.join(DATA, "hub-cashflow-2026-10-07.json"), JSON.stringify(out, null, 1) + "\n");
const B = (v) => (v == null ? "—" : (v / 1e9).toFixed(2) + "B");
for (const t of ["WDC", "SNDK", "MU", "STX"]) { const r = out.names[t]; console.log(t, r ? "FY" + r.fiscal_year + " " + r.fiscal_date + " · operations " + B(r.operating_cf) + " · capital spending " + B(r.capex) + " · free cash flow " + B(r.free_cf) : "no row"); }
console.log("names with a capital-spending figure of zero in the Hub's newest year:", names.filter((t) => out.names[t] && !Number(out.names[t].capex)).join(" ") || "none");

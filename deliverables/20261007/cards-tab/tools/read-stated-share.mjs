/* CP2 (7 Oct 2026) · the data-centre share a company STATES on its own earnings call, for the names whose FMP revenue
   split has no data-centre line (Micron: FMP splits it into DRAM and NAND; Seagate: FMP carries no split by business).
   Reads the Hub's own table earnings_call_transcripts through the public read path, exactly as the page does (the address
   and the public key are taken from index.html at run time and never printed); GET only; writes
   data/data-centre-stated.json. Every sentence is copied verbatim from the stored call.
     node deliverables/20261007/cards-tab/tools/read-stated-share.mjs          (from the Hub repo root)
   This is a hand-chosen reading, not a feed: RULES below says which sentence is looked for and how it is read. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../../.."), DATA = path.join(HERE, "..", "data");
const page = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const SB = page.match(/^const SB\s*=\s*"([^"]+)"/m)[1];
const at = page.indexOf("const ANON = "), seg = page.slice(at, at + 1200);
const key = (seg.match(/"(eyJ[A-Za-z0-9._-]+)"/) || seg.match(/"(sb_publishable_[A-Za-z0-9_-]+)"/) || [])[1];
if (!key) { console.error("no public key in the page"); process.exit(2); }
const pg = async (p) => { const r = await fetch(SB + "/rest/v1/" + p, { headers: { apikey: key, Authorization: "Bearer " + key } }); if (!r.ok) throw new Error(p.split("?")[0] + " → " + r.status); return r.json(); };
const facts = JSON.parse(fs.readFileSync(path.join(DATA, "business-facts-fmp-2026-10-07.json"), "utf8")).companies;

const RULES = {
  MU: {
    units: "Micron's two data-centre units are Cloud Memory and Core Data Center; Mobile & Client and Automotive & Embedded are the rest",
    /* newest first: the share of the two NON-data-centre units, stated as one figure */
    main: { re: /The AEBU and MCBU businesses.*?non-data center.*?almost (\d+)% of our company revenue/i, read: (m) => 100 - Number(m[1]), reading: (v) => "the two units that are not data centre are \"almost " + (100 - v) + "%\", so data centre is a little over " + v + "%" },
    /* earlier quarters: the two data-centre units, each stated (each sentence is matched on its own, so .*? stays inside it) */
    parts: [/Cloud Memory Business Unit revenue was.*?represented (\d+)% of total company revenue/i, /Core Data Center Business Unit revenue was.*?represented (\d+)% of total company revenue/i],
  },
  STX: {
    units: "Seagate reports two markets on its calls: data centre (nearline drives for cloud and enterprise) and edge",
    main: { re: /(?:The data center market accounted for.*?|data center revenue represented )(\d+)% of (?:our total |overall )?revenue/i, read: (m) => Number(m[1]), reading: (v) => "data centre stated as " + v + "% of revenue" },
    parts: [],
  },
};
const sentences = (t) => String(t || "").replace(/\s+/g, " ").split(/(?<=[.!?])\s+/);
const find = (text, re) => { for (const s of sentences(text)) { const m = s.match(re); if (m) return { s: s.trim(), m }; } return null; };
const quarterEnd = (t, callDate) => { const q = (facts[t] && facts[t].income_q) || []; const r = q.find((x) => x.date < callDate); return r ? r.date : null; };
const callWord = (r) => { const m = String(r.quarter || "").match(/Q(\d)\s+(\d{4})/); const d = new Date(r.call_date + "T12:00:00Z"); return (m ? "Q" + m[1] + " FY" + m[2] + " call, " : "call, ") + d.getUTCDate() + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()] + " " + d.getUTCFullYear(); };

const out = { what: "the data-centre share a company states on its own earnings call, for names whose FMP revenue split has no data-centre line; hand-chosen sentences, copied verbatim",
  source: "the Hub's table earnings_call_transcripts (public read), read " + new Date().toISOString().slice(0, 10), companies: {} };
for (const [t, rule] of Object.entries(RULES)) {
  const rows = await pg("earnings_call_transcripts?ticker=eq." + t + "&select=ticker,quarter,call_date,transcript&order=call_date.desc&limit=6");
  const stored = rows.map((r) => ({ call: callWord(r), date: r.call_date, chars: String(r.transcript || "").length }));
  let main = null; const earlier = [];
  for (const r of rows) {
    const hit = find(r.transcript, rule.main.re);
    if (hit && !main) { const v = rule.main.read(hit.m); main = { share: v, approx: true, quote: hit.s, call: callWord(r), call_date: r.call_date, covers: quarterEnd(t, r.call_date), reading: rule.main.reading(v) }; continue; }
    if (hit) { earlier.push({ call: callWord(r), share: rule.main.read(hit.m), quotes: [hit.s] }); continue; }
    const ps = rule.parts.map((re) => find(r.transcript, re)).filter(Boolean);
    if (rule.parts.length && ps.length === rule.parts.length) earlier.push({ call: callWord(r), share: ps.reduce((s, p) => s + Number(p.m[1]), 0), quotes: ps.map((p) => p.s) });
  }
  out.companies[t] = main ? { ...main, units: rule.units, earlier: earlier.slice(0, 3), calls_stored: stored } : { share: null, why: "no stored call states it", units: rule.units, calls_stored: stored };
}
fs.writeFileSync(path.join(DATA, "data-centre-stated.json"), JSON.stringify(out, null, 1) + "\n");
for (const [t, v] of Object.entries(out.companies)) console.log(t, v.share == null ? "— " + v.why : "≈" + v.share + "% · " + v.call + " · covers the quarter to " + v.covers + " · earlier: " + v.earlier.map((e) => e.share + "% (" + e.call + ")").join(", "));

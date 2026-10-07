// HM2 — the first fill of public.treasury_auctions, as one SQL file (the H8 pattern: a script prints SQL, the
// coordinator runs it with `supabase db query --linked -f`). Reads TreasuryDirect's free web service; no key.
//   node scripts/hm2-treasury-auctions-load.mjs [from=2018-01-01] > deliverables/20261007/hm2-macro/data/treasury-auctions-load.sql
// Also writes the same rows as JSON beside it (--json=<file>), which the pictures were taken from.
import fs from "node:fs";
import { auctionRows, searchUrl } from "../supabase/functions/treasury-auctions/auctions.mjs";
const args = process.argv.slice(2), from = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) || "2018-01-01";
const jsonOut = (args.find((a) => a.startsWith("--json=")) || "").slice(7);
const to = new Date(Date.now() + 45 * 86400e3).toISOString().slice(0, 10);
const read = [];
for (const type of ["Note", "Bond"]) {
  const r = await fetch(searchUrl(type, from, to), { headers: { "User-Agent": "ScintillaHub research research@scintillahub.ai" } });
  if (!r.ok) { console.error("TreasuryDirect answered " + r.status + " for " + type); process.exit(1); }
  read.push(...(await r.json()));
}
const rows = auctionRows(read);
if (!rows.length) { console.error("no rows mapped"); process.exit(1); }
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(rows));
const cols = Object.keys(rows[0]);
const lit = (v) => (v === null || v === undefined ? "null" : typeof v === "boolean" ? String(v) : typeof v === "number" ? String(v) : "'" + String(v).replace(/'/g, "''") + "'");
const out = ["-- HM2 · first fill of public.treasury_auctions · " + rows.length + " rows · " + rows[rows.length - 1].auction_date + " → " + rows[0].auction_date +
  " · read from TreasuryDirect " + new Date().toISOString(), "-- Additive: fills an empty table; a second run changes nothing but fetched_at and any result printed since.",
  "insert into public.treasury_auctions (" + cols.join(", ") + ") values"];
out.push(rows.map((r) => "  (" + cols.map((c) => lit(r[c])).join(", ") + ")").join(",\n"));
out.push("on conflict (cusip, auction_date) do update set " + cols.filter((c) => c !== "cusip" && c !== "auction_date").map((c) => c + " = excluded." + c).join(", ") + ", fetched_at = now();");
console.log(out.join("\n"));
console.error(rows.length + " rows · " + rows.filter((r) => r.status === "announced").length + " announced, not yet auctioned");

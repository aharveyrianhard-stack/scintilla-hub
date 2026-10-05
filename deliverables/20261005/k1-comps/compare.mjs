// old (3 Oct, C5b) against new (5 Oct, K1): the kept set, its tiers and the centre of the range (way C)
import fs from "node:fs"; import path from "node:path";
const dir = process.argv[2];
const { conclusion } = await import(path.join(dir, "field.mjs"));
const out = [];
for (const T of ["AMZN","NVDA","MU","JPM","META","TSM","XOM","LLY","COST"]) {
  const row = { ticker: T };
  for (const [k, d] of [["old", "2026-10-03"], ["new", "2026-10-05"]]) {
    const f = JSON.parse(fs.readFileSync(path.join(dir, `set-${T}-${d}.json`), "utf8"));
    const c = conclusion(f.snapshot, [], f.estimates, f.today, "C");
    row[k] = { price: f.snapshot.price, kept: f.set.kept.map((r) => r.ticker), tiers: f.set.kept.map((r) => (r.tier || "?")[0]).join(""), counts: f.set.counts, lo: c.band && Math.round(c.band.lo), mid: c.band && Math.round(c.band.mid), hi: c.band && Math.round(c.band.hi),
               upside: c.upside && Math.round(c.upside.mid), outliers: c.outliers.filter((o) => o.excluded).length };
  }
  out.push(row);
  console.log(T.padEnd(5), "price", String(row.new.price).padEnd(9), "OLD", row.old.kept.length, "centre", row.old.mid, `(${row.old.lo}–${row.old.hi})`, "| NEW", row.new.kept.length, row.new.tiers, "centre", row.new.mid, `(${row.new.lo}–${row.new.hi})`, "upside", row.new.upside + "%", "\n      new:", row.new.kept.join(" "));
}
fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1));

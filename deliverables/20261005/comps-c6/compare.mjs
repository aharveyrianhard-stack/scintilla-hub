/* C6 · before → after on the four names: node compare.mjs → four-names-before-after.json and a table on stdout.
   before = C5b as it stands on the branch (a cell leaves ONE measure's centre at 3 MAD); with = every peer in, nothing
   dropped; without = the C6 rule (outlier peers out of every median and the price). Same fixtures, same prices. */
import { readFileSync, writeFileSync } from "node:fs"; import { fileURLToPath } from "node:url"; import path from "node:path";
import { conclusion, ROWS } from "../../20261003/comps-c5/field.mjs";
import { conclusion6, COLUMNS } from "./outliers.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), NAMES = ["MU", "NVDA", "CRWV", "CBRS"], DAY = "2026-10-05";
const r1 = (v) => v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100;
const meds = (C) => Object.fromEntries(ROWS.map((k) => { const r = C.rows.find((x) => x.key === k); return [k, { median: r1(r.band && r.band.median), n: r.n, price: r1(r.ok && r.ends && r.ends.median ? r.ends.median.price : null) }]; }));
const out = { taken: new Date().toISOString(), day: DAY, names: {} };
for (const T of NAMES) {
  const F = JSON.parse(readFileSync(path.join(HERE, `set-${T}-${DAY}.json`), "utf8")), s = F.snapshot;
  const before = conclusion(s, [], F.estimates, F.today), after = conclusion6(s, [], F.estimates, F.today), wth = after.c6.withOutliers;
  const band = (C) => C.band ? { lo: r1(C.band.lo), centre: r1(C.band.mid), hi: r1(C.band.hi) } : null;
  out.names[T] = { price: s.price, peers: after.c6.peers,
    before: { band: band(before), medians: meds(before), cells_out: before.outliers.filter((o) => o.excluded).map((o) => ({ peer: o.ticker, key: o.key, multiple: r1(o.multiple) })) },
    with_outliers: { band: band(wth), medians: meds(wth) }, without_outliers: { band: band(after), medians: meds(after) },
    outliers: after.c6.outliers.map((t) => ({ peer: t, words: after.c6.score[t].words, flags: after.c6.score[t].flags.map((f) => ({ column: f.short, value: r1(f.v), distance: r1(f.d), group_median: r1(after.c6.cols[f.key].median) })) })),
    one_or_two_flags: after.c6.peers.filter((t) => after.c6.score[t].n && !after.c6.score[t].outlier).map((t) => ({ peer: t, words: after.c6.score[t].words, flags: after.c6.score[t].flags.map((f) => ({ column: f.short, value: r1(f.v), distance: r1(f.d), group_median: r1(after.c6.cols[f.key].median) })) })),
    multiples_only: (() => { const v = conclusion6(s, [], F.estimates, F.today, "C", { only: ROWS }); return { outliers: v.c6.outliers.map((t) => ({ peer: t, words: v.c6.score[t].words, flags: v.c6.score[t].flags.map((f) => f.short + " " + r1(f.v)) })), centre: r1(v.band && v.band.mid) }; })(),
    columns_judged: COLUMNS.filter((c) => after.c6.cols[c.key].judged).length };
  const o = out.names[T];
  console.log(`\n${T} $${s.price} · ${o.peers.length} peers · ${o.columns_judged}/16 columns judged`);
  console.log(`  centre  before(C5b) ${o.before.band?.centre}  with ${o.with_outliers.band?.centre}  without ${o.without_outliers.band?.centre}`);
  for (const k of ROWS) console.log(`  ${k.padEnd(10)} median ${String(o.before.medians[k].median).padStart(8)} → with ${String(o.with_outliers.medians[k].median).padStart(8)} → without ${String(o.without_outliers.medians[k].median).padStart(8)}   price ${o.before.medians[k].price} → ${o.with_outliers.medians[k].price} → ${o.without_outliers.medians[k].price}`);
  for (const x of o.outliers) console.log(`  OUTLIER ${x.peer}: ${x.words} — ${x.flags.map((f) => `${f.column} ${f.value} vs ${f.group_median} (${f.distance})`).join(", ")}`);
  console.log(`  WHAT-IF multiples only: centre ${o.multiples_only.centre} · out ${o.multiples_only.outliers.map((x) => x.peer + " [" + x.flags.join(", ") + "]").join("; ") || "none"}`);
  for (const x of o.one_or_two_flags) console.log(`  flag    ${x.peer}: ${x.flags.map((f) => `${f.column} ${f.value} vs ${f.group_median} (${f.distance})`).join(", ")}`);
}
writeFileSync(path.join(HERE, "four-names-before-after.json"), JSON.stringify(out, null, 1));

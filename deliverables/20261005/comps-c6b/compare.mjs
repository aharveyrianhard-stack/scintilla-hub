/* C6b · before → after on the four names: node compare.mjs → four-names-c5b-c6-c6b.json and a table on stdout.
   c5b = C5b as it stood (a cell leaves ONE measure's centre at 3 MAD) · c6 = C6 as first built (all sixteen columns
   vote, 40%) · c6b = the price-only rule (the multiples vote, trailing + forward P/E one vote, 50%). Same fixtures
   (C6's set-<T>-2026-10-05.json), same prices on every side. */
import { readFileSync, writeFileSync } from "node:fs"; import { fileURLToPath } from "node:url"; import path from "node:path";
import { conclusion, ROWS } from "../../20261003/comps-c5/field.mjs";
import { conclusion6, scorePeers, C6_RULE, VOTES, COLUMNS } from "../comps-c6/outliers.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), NAMES = ["MU", "NVDA", "CRWV", "CBRS"], DAY = "2026-10-05";
const r1 = (v) => v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100;
const meds = (C) => Object.fromEntries(ROWS.map((k) => { const r = C.rows.find((x) => x.key === k); return [k, { median: r1(r.band && r.band.median), n: r.n, price: r1(r.ok && r.ends && r.ends.median ? r.ends.median.price : null) }]; }));
const band = (C) => C.band ? { lo: r1(C.band.lo), centre: r1(C.band.mid), hi: r1(C.band.hi) } : null;
const fl = (c6, f) => ({ column: f.short, key: f.key, value: r1(f.v), distance: r1(f.d), group_median: r1(c6.cols[f.key].median) });
const who = (C) => C.c6.outliers.map((t) => ({ peer: t, words: C.c6.score[t].words, flags: C.c6.score[t].flags.map((f) => fl(C.c6, f)) }));
/* a what-if on the vote list only: EV/sales and P/S as one "sales" vote as well */
const SALES_ONE = [...VOTES.filter((v) => v.key !== "ev_sales" && v.key !== "ps"), { key: "sales", short: "EV/S · P/S", cols: ["ev_sales", "ps"] }];
const out = { taken: new Date().toISOString(), day: DAY, votes: VOTES, names: {} };
for (const T of NAMES) {
  const F = JSON.parse(readFileSync(path.join(HERE, `../comps-c6/set-${T}-${DAY}.json`), "utf8")), s = F.snapshot;
  const c5b = conclusion(s, [], F.estimates, F.today), c6 = conclusion6(s, [], F.estimates, F.today, "C", { rule: C6_RULE }), c6b = conclusion6(s, [], F.estimates, F.today, "C", { set: F.set });
  const sc = c6b.c6.score, so = scorePeers(c6b.c6.cols, c6b.c6.peers, { votes: SALES_ONE });
  out.names[T] = { price: s.price, peers: c6b.c6.peers, columns_judged: COLUMNS.filter((c) => c6b.c6.cols[c.key].judged).length,
    c5b: { band: band(c5b), medians: meds(c5b), cells_out: c5b.outliers.filter((o) => o.excluded).map((o) => ({ peer: o.ticker, key: o.key, multiple: r1(o.multiple) })) },
    c6: { with: band(c6.c6.withOutliers), without: band(c6), medians: meds(c6), outliers: who(c6) },
    c6b: { with: band(c6b.c6.withOutliers), without: band(c6b), medians_with: meds(c6b.c6.withOutliers), medians: meds(c6b), outliers: who(c6b), not_cut: c6b.c6.notCut, business: c6b.c6.business,
      marked: c6b.c6.peers.filter((t) => sc[t].marks).map((t) => ({ peer: t, outlier: sc[t].outlier, votes_have: sc[t].have, votes: sc[t].flags.map((f) => fl(c6b.c6, f)), info: sc[t].info.map((f) => fl(c6b.c6, f)) })) },
    sales_one_vote: c6b.c6.peers.filter((t) => so[t].outlier).map((t) => ({ peer: t, words: so[t].words })) };
  const o = out.names[T];
  console.log(`\n${T} $${s.price} · ${o.peers.length} peers · business: ${o.c6b.business.same.length} of ${o.c6b.business.n} share ${o.c6b.business.line}${o.c6b.business.mostlyDifferent ? " · MOSTLY DIFFERENT BUSINESS" : ""}`);
  console.log(`  centre  C5b ${o.c5b.band?.centre} · C6 ${o.c6.without?.centre} (out ${o.c6.outliers.map((x) => x.peer).join(" ") || "none"}) · C6b with ${o.c6b.with?.centre} without ${o.c6b.without?.centre} (out ${o.c6b.outliers.map((x) => x.peer).join(" ") || "none"})`);
  for (const k of ROWS) console.log(`  ${k.padEnd(10)} median C5b ${String(o.c5b.medians[k].median).padStart(8)} · C6 ${String(o.c6.medians[k].median).padStart(8)} · C6b ${String(o.c6b.medians[k].median).padStart(8)}`);
  for (const x of o.c6b.outliers) console.log(`  OUTLIER ${x.peer}: ${x.words} — ${x.flags.map((f) => `${f.column} ${f.value} vs ${f.group_median} (${f.distance})`).join(", ")}`);
  console.log(`  what-if EV/S and P/S as one vote: ${o.sales_one_vote.map((x) => x.peer + " " + x.words).join("; ") || "none"}`);
}
writeFileSync(path.join(HERE, "four-names-c5b-c6-c6b.json"), JSON.stringify(out, null, 1));

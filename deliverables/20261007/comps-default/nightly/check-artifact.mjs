/* THE NIGHTLY COMPS REBUILD · step 4 — THE GATE. Designed 7 Oct 2026; NOT INSTALLED (see DESIGN.md).
   A night's files are published only when they pass every check below; one failure stops the run and last night's files stay.
   The checks are about SHAPE and about a night-to-night MOVE no market explains — never about a level (no number is tuned).
     node check-artifact.mjs --new <data dir> [--old <last night's data dir>]          exit 0 = publish · exit 5 = keep last night's */
import fs from "node:fs"; import path from "node:path";
const argv = process.argv.slice(2), opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const NEW = opt("--new"), OLD = opt("--old"), J = (p) => JSON.parse(fs.readFileSync(p, "utf8")), fails = [], notes = [];
export const PRICED_SHARE = 0.95, BIG_MOVE = 0.25, QUIET_PRICE = 0.05, BIG_MOVE_SHARE = 0.10;
const idx = J(path.join(NEW, "comps.json")), cards = J(path.join(NEW, "cards.json")), ko = J(path.join(NEW, "knockout-comps.json")), ok = Object.entries(idx.names).filter(([, n]) => n.ok), priced = ok.filter(([, n]) => n.blend && n.blend.centre != null);
const need = (cond, words) => { if (!cond) fails.push(words); };
/* shape */
need(ok.length >= 400 && priced.length / ok.length >= 0.9, `too few names priced: ${priced.length} of ${ok.length}`);
for (const t of idx.twelve) need(idx.names[t] && idx.names[t].ok && idx.names[t].blend.centre > 0, `${t} (one of the twelve) has no centre`);
for (const [t, n] of priced) { const r = J(path.join(NEW, "names", t + ".json")), sum = Object.values(r.weights).reduce((a, b) => a + b, 0);
  need(Math.abs(sum - 1) < 0.02, `${t}: weights add to ${sum.toFixed(3)}`); need(r.blend.low <= r.blend.high, `${t}: low above high`);
  for (const c of r.outlier_cases || []) need(c.verdict === "kept" ? c.side === "below" : c.side === "above", `${t}: ${c.ticker} is ${c.verdict} on the wrong side`);
  const cap = idx.rule.growth_cap_pct, y = r.yardsticks.peg; if (cap != null && y && y.growth_counted_pct != null) need(y.growth_counted_pct <= cap + 1e-9, `${t}: the growth yardstick counts ${y.growth_counted_pct}% above the cap`);
  if (cards.cards[t]) need(cards.cards[t].comps.centre === n.blend.centre && cards.cards[t].comps.not_a_target === n.not_a_target, `${t}: its card does not carry the engine's number or line`);
  need(ko.names[t] && ko.names[t].after.band.centre === n.blend.centre, `${t}: the knockout's row does not carry the engine's centre`); }
/* against last night */
if (OLD && fs.existsSync(path.join(OLD, "comps.json"))) { const old = J(path.join(OLD, "comps.json")), oldPriced = Object.entries(old.names).filter(([, n]) => n.ok && n.blend && n.blend.centre != null);
  need(priced.length >= PRICED_SHARE * oldPriced.length, `${priced.length} names priced against ${oldPriced.length} last night`);
  let both = 0, big = 0; const movers = [];
  for (const [t, o] of oldPriced) { const n = idx.names[t]; if (!n || !n.ok || n.blend.centre == null) continue; both++; const dc = Math.abs(n.blend.centre / o.blend.centre - 1), dp = Math.abs(n.price / o.price - 1); if (dc > BIG_MOVE && dp < QUIET_PRICE) { big++; movers.push(`${t} ${Math.round(o.blend.centre)}→${Math.round(n.blend.centre)}`); } }
  notes.push(`${both} names on both nights; ${big} moved their centre more than ${BIG_MOVE * 100}% on a price move under ${QUIET_PRICE * 100}%${big ? ": " + movers.slice(0, 12).join(", ") : ""}`);
  need(big <= BIG_MOVE_SHARE * both, `${big} of ${both} centres jumped with no price move to explain it (a table or a rule changed): ${movers.slice(0, 8).join(", ")}`);
  notes.push("the twelve: " + idx.twelve.map((t) => `${t} ${old.names[t] && old.names[t].blend ? old.names[t].blend.upside_pct : "—"}→${idx.names[t].blend.upside_pct}%`).join(" · "));
} else notes.push("no earlier night to compare with");
console.log(JSON.stringify({ day: idx.today, built_utc: idx.built_utc, names: ok.length, priced: priced.length, cap: idx.rule.growth_cap_pct, counts: idx.counts, notes, fails }, null, 1));
process.exit(fails.length ? 5 : 0);

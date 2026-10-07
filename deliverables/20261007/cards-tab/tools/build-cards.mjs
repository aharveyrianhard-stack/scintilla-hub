/* CP2 (7 Oct 2026) · builds data/cards.json: CP1's card of each name, as it stands, plus three parts —
     business        the pies, the chips and the blend (business.mjs on data/business-facts-fmp-2026-10-07.json)
     zones           the confluence zones, nearest first (card-parts.mjs on data/zones-cz1-2026-10-06.json)
     estimates_flag  ER1's flag line (card-parts.mjs on data/estimates-flags-er1-2026-10-06.json)
   Nothing of CP1's record is changed. The file has the shape a row of public.decision_cards would hold in `card`
   (supabase/migrations/20261007_cp1_decision_cards.sql — proposed, not applied): jsonb, so the three parts need no
   new column.     node deliverables/20261007/cards-tab/tools/build-cards.mjs      (from the Hub repo root) */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { businessOf } from "../business.mjs";
import { flagLine, zonesNearestFirst, sideBySide } from "../card-parts.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../../.."), DATA = path.join(HERE, "..", "data");
const J = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const cp1 = J(path.join(ROOT, "deliverables/20261006/decision-cards/data/cards.json"));
const facts = J(path.join(DATA, "business-facts-fmp-2026-10-07.json")), stated = J(path.join(DATA, "data-centre-stated.json"));
const zones = J(path.join(DATA, "zones-cz1-2026-10-06.json")), flags = J(path.join(DATA, "estimates-flags-er1-2026-10-06.json"));

const cards = {};
for (const [t, c] of Object.entries(cp1.cards)) {
  const st = (stated.companies[t] && stated.companies[t].share != null) ? stated.companies[t] : undefined;
  const z = zones.names[t] || null;
  cards[t] = { ...c,
    business: businessOf(t, facts.companies[t], st),
    zones: z ? { as_of: z.as_of, price: z.price, pack: z.pack, list: zonesNearestFirst(z) } : null,
    estimates_flag: flagLine(flags.names[t]) };
}
for (const [t, c] of Object.entries(cards)) if (c.business) c.business.side_by_side = sideBySide(t, c.comps && c.comps.peers_priced, cards);
/* the four storage-and-memory names sit side by side whatever their own peer lists say: they are the example Alan asked about */
const FOUR = ["WDC", "SNDK", "MU", "STX"];
for (const t of FOUR) if (cards[t] && cards[t].business) cards[t].business.side_by_side = [t, ...FOUR.filter((x) => x !== t && cards[x])];

const out = {
  what: "one record per name: CP1's decision card (the facts and the levels, the plan fields empty for Alan) with the business block, the confluence zones and the estimates flag line added",
  as_of: { ...cp1.as_of, business_facts_utc: facts.taken_utc, zones_as_of: zones.as_of, zones_built_utc: zones.from.built_at, estimates_flag_utc: flags.from.estimates_generated_utc, built_utc: new Date().toISOString() },
  price_is: cp1.price_is, comps_code: cp1.comps_code, switches: cp1.switches,
  sources: { card: "hub/cp1-comps-cards-20261006 @f198dc6 · deliverables/20261006/decision-cards/data/cards.json", business: facts.source + " · read " + facts.taken_utc,
    data_centre_stated: stated.source, zones: zones.from.branch + " @" + zones.from.commit + " · " + zones.rule.zone + " · lines pack " + zones.lines_pack, estimates_flag: flags.from.branch + " @" + flags.from.commit },
  zones_rule: zones.rule, cards };
fs.writeFileSync(path.join(DATA, "cards.json"), JSON.stringify(out, null, 1) + "\n");

const B = (v) => v == null ? "—" : "$" + (Math.abs(v) >= 1e11 ? (v / 1e9).toFixed(0) : (v / 1e9).toFixed(2)) + "B";
const P = (v, d = 1) => v == null ? "—" : v.toFixed(d) + "%";
console.log("T      split        period              dc-share            gross   oper    fcf (basis)            fcf-m   yield   dc¢/$   cash¢/$  zones flag");
for (const [t, c] of Object.entries(cards)) {
  const b = c.business, dc = b.data_centre, k = b.cash;
  console.log([t.padEnd(6), ("FY" + (b.lines ? b.lines.fy : "—") + (b.lines && b.lines.behind ? "*" : "")).padEnd(12), ((b.period ? b.period.basis + " " + b.period.end : "—")).padEnd(19),
    ((dc.share == null ? "—" : (dc.approx ? "≈" : "") + dc.share + "% " + dc.basis)).padEnd(19), P(b.margins.gross).padEnd(7), P(b.margins.operating).padEnd(7),
    ((k.fcf == null ? "—" : B(k.fcf) + " " + k.basis + (k.older ? " older" : "") + (k.differs ? " ≠" + B(k.other.fcf) : ""))).padEnd(22), P(k.margin).padEnd(7), P(k.yield, 2).padEnd(7),
    (b.blend.dc_profit_per_dollar == null ? "—" : (b.blend.approx ? "≈" : "") + b.blend.dc_profit_per_dollar.toFixed(2)).padEnd(7), (b.blend.cash_per_dollar == null ? "—" : b.blend.cash_per_dollar.toFixed(2)).padEnd(8),
    String(c.zones ? c.zones.list.length : "—").padEnd(5), c.estimates_flag ? c.estimates_flag.chips.map((x) => x.word).join(" | ") : "—"].join(" "));
}

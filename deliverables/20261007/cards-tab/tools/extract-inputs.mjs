/* CP2 (7 Oct 2026) · the two inputs that live on other branches, copied small and dated, with the commit they came from:
     data/zones-cz1-2026-10-06.json            the confluence zones of the card names (CZ1's page data, as it stands)
     data/estimates-flags-er1-2026-10-06.json  the estimates flag of the six names ER1 studied
   Read with `git show <commit>:<file>` — nothing is merged, nothing is changed on those branches.
     node deliverables/20261007/cards-tab/tools/extract-inputs.mjs          (from the Hub repo root)
   From ER1 only NUMBERS and the rule's own flag texts are taken. Its quoted sentences and its "what it guides" lines are
   left behind: their dollar amounts were eaten by a shell on the way into the file ("$3.1B" reads ".1B", "$0.15" reads
   "/bin/zsh.15"), so they are not fit to show. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { execFileSync } from "node:child_process";
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../../.."), DATA = path.join(HERE, "..", "data");
const CZ1 = { commit: "cbe856c", branch: "hub/cz1-confluence-20261006", file: "deliverables/20261006/confluence-zones/data/confluence-page-20261006.js" };
const ER1 = { commit: "38f043b", branch: "hub/er1-estimates-guidance-20261006", flags: "deliverables/20261006/estimates-vs-guidance/data/flags.json", estimates: "deliverables/20261006/estimates-vs-guidance/data/estimates.json" };
const show = (commit, file) => execFileSync("git", ["show", commit + ":" + file], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const names = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, "deliverables/20261006/decision-cards/data/cards.json"), "utf8")).cards);

/* ---- zones */
const raw = show(CZ1.commit, CZ1.file), cz = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
const zones = { what: "confluence zones of the decision-card names, as CZ1 computed them: two or more levels within 1% of each other; members by the Lab's own labels",
  from: { ...CZ1, schema: cz.schema, built_at: cz.built_at, run_generated_at: cz.run_generated_at }, as_of: cz.as_of,
  rule: { zone: cz.rule.zone, zone_pct: cz.rule.zone_pct, multi_source: cz.rule.multi_source, averages: cz.rule.averages, lasts: cz.rule.paths.flat },
  lines_pack: cz.sources.extract.pack_version, names: {}, without: [] };
for (const t of names) {
  const n = cz.names[t];
  if (!n) { zones.without.push(t); continue; }
  zones.names[t] = { price: n.price, as_of: n.as_of, lines: n.lines, pack: n.pack,
    zones: n.zones.map((z) => ({ lo: z.lo, hi: z.hi, side: z.side, d: z.d, w: z.w, ms: z.ms, last: z.last, until: z.last > 0 && n.sessions[z.last] ? n.sessions[z.last] : null,
      members: z.m.map(([label, v, kind, tf]) => ({ label, v, kind: kind === "a" ? "average" : "line", tf })) })) };
}
fs.writeFileSync(path.join(DATA, "zones-cz1-2026-10-06.json"), JSON.stringify(zones, null, 1) + "\n");

/* ---- the estimates flag */
const fl = JSON.parse(show(ER1.commit, ER1.flags)), es = JSON.parse(show(ER1.commit, ER1.estimates));
const flags = { what: "ER1's estimate-against-guidance flag for the six names it studied: the rule's output and the numbers it compared; no quoted sentence is carried",
  from: { ...ER1, estimates_generated_utc: es.generated_utc }, names: {} };
const clean = (s) => typeof s === "string" && !/\/bin\/|\$\s|\s\.\d/.test(s) ? s : null;
for (const [t, f] of Object.entries(fl)) {
  const e = (es.names || {})[t] || {}, g = e.guidance || {}, nr = e.next_report || {};
  flags.names[t] = { flags: f.flags, basis: f.basis, guide_verdict: f.guideVerdict, one_off_per_share: f.oneOffPerShare, clean_fy0: f.cleanFy0, growth_shown: f.growthShown, growth_clean: f.growthClean,
    fy0: f.fy0, fy0_eps: f.fy0_eps, fy1: f.fy1, fy1_eps: f.fy1_eps, fy1_n: f.fy1_n,
    guide_eps: typeof g.eps_guide === "number" ? g.eps_guide : null, guide_pm: typeof g.eps_guide_pm === "number" ? g.eps_guide_pm : null, guide_call: clean(g.call),
    next_quarter_consensus: typeof nr.eps_est === "number" ? nr.eps_est : null, next_report: nr.date || null };
}
fs.writeFileSync(path.join(DATA, "estimates-flags-er1-2026-10-06.json"), JSON.stringify(flags, null, 1) + "\n");
console.log("zones:", Object.keys(zones.names).length, "names ·", Object.values(zones.names).reduce((s, n) => s + n.zones.length, 0), "zones · without:", zones.without.join(" "));
console.log("flags:", Object.entries(flags.names).map(([t, f]) => t + " " + f.guide_verdict + " [" + f.flags.map((x) => x.code).join(",") + "] call=" + f.guide_call).join(" | "));

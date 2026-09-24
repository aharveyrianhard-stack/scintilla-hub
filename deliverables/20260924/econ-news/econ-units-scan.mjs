/* M70 — how often the same-scale trio actually fires, measured on the live econ_calendar.
   Read-only: one windowed PostgREST read with the public anon key, no writes. The rule is imported
   from the detector the edge function runs, so the count is the rule's own, not a re-implementation. */
import { econUnify } from "../../../supabase/functions/scintillas-detect/detect.mjs";
const SB = "https://wadinxqplrggagkvrdag.supabase.co";
const ANON = process.argv[2] || process.env.SC_ANON_KEY;
const DAYS = Number(process.argv[3] || 30);
const to = Math.floor(Date.now() / 1000), from = to - DAYS * 86400;
const rows = [];
let after = from;
for (let page = 0; page < 12; page++) {
  const r = await fetch(SB + "/rest/v1/econ_calendar?select=event_ts,country,event,actual,estimate,previous,impact" +
    "&event_ts=gte." + after + "&event_ts=lte." + to + "&order=event_ts.asc&limit=1000",
    { headers: { apikey: ANON, Authorization: "Bearer " + ANON } });
  const body = await r.json();
  if (!Array.isArray(body)) { console.log("read stopped:", JSON.stringify(body).slice(0, 100)); break; }
  rows.push(...body);
  if (body.length < 1000) break;
  after = body[body.length - 1].event_ts + 1;
}
let fixed = 0, ambiguous = 0, withTwo = 0;
const examples = [];
for (const r of rows) {
  const present = ["actual", "estimate", "previous"].filter((k) => r[k] != null && +r[k] !== 0).length;
  if (present >= 2) withTwo++;
  const u = econUnify(r);
  if (u.unit_fix) {
    fixed++;
    if (examples.length < 8) examples.push({ when: new Date(r.event_ts * 1000).toISOString().slice(0, 16).replace("T", " "),
      country: r.country, event: r.event, raw: u.unit_fix.raw, moved: u.unit_fix.fixes.map((f) => f.field + " x" + (1 / f.factor)).join(", ") });
  } else if (u.unit_ambiguous) {
    ambiguous++;
    if (examples.length < 8) examples.push({ when: new Date(r.event_ts * 1000).toISOString().slice(0, 16).replace("T", " "),
      country: r.country, event: r.event, raw: { actual: r.actual, estimate: r.estimate, previous: r.previous }, moved: "AMBIGUOUS - nothing changed, no surprise computed" });
  }
}
console.log("ECON UNIT SCAN · last " + DAYS + " days · read " + new Date().toISOString());
console.log("  rows read                          : " + rows.length);
console.log("  rows with at least two values      : " + withTwo);
console.log("  rows the rule RESCALES             : " + fixed + "  (" + (100 * fixed / Math.max(withTwo, 1)).toFixed(2) + "% of those)");
console.log("  rows it refuses to judge (ambiguous): " + ambiguous);
console.log("  rows left exactly as supplied      : " + (withTwo - fixed - ambiguous));
for (const e of examples) console.log("   · " + e.when + " " + e.country + " " + e.event + "  raw=" + JSON.stringify(e.raw) + "  moved: " + e.moved);

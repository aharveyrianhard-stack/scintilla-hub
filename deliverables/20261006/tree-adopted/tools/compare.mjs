/* TR1 · sets the BEFORE and AFTER headless runs side by side and says, screen by screen, whether anything differs. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const D = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = { what: "Hub before (the two tables do not exist) vs after (the two tables present and filled by the loader). Structure is compared, not prices.", widths: {} };
let same = true;
for (const w of [1680, 390]) {
  const b = JSON.parse(fs.readFileSync(path.join(D, `facts-before-${w}.json`))), a = JSON.parse(fs.readFileSync(path.join(D, `facts-after-${w}.json`)));
  const screens = {};
  for (const k of Object.keys(b.screens)) {
    const x = b.screens[k], y = a.screens[k] || {};
    const eq = ["rows", "tickers_sha", "tickers_n", "cohortButtons_sha", "cohortButtons_n", "masterTabs", "absent"].every((f) => JSON.stringify(x[f]) === JSON.stringify(y[f]));
    screens[k] = { same: eq, names_on_screen: x.tickers_n, cohort_buttons: x.cohortButtons_n, before: eq ? undefined : x, after: eq ? undefined : y };
    if (!eq) same = false;
  }
  const cohsetsSame = JSON.stringify(b.cohsets) === JSON.stringify(a.cohsets); if (!cohsetsSame) same = false;
  if (a.hub_requests_to_new_tables || b.hub_requests_to_new_tables) same = false;
  out.widths[w] = { page_sha_same: b.page_sha === a.page_sha, cohort_map_before: b.cohsets, cohort_map_after: a.cohsets, cohort_map_same: cohsetsSame,
    live_database_today: b.live_probe, with_tables_present: a.live_probe,
    hub_requests_to_the_new_tables: { before: b.hub_requests_to_new_tables, after: a.hub_requests_to_new_tables },
    tables_the_hub_read: { before: b.rest_tables_read.length, after: a.rest_tables_read.length, same: JSON.stringify(b.rest_tables_read) === JSON.stringify(a.rest_tables_read), includes_new: a.rest_tables_read.filter((t) => /^cohort_tree/.test(t)) },
    page_errors: { before: b.errors.length, after: a.errors.length }, non_get_blocked: { before: b.writes, after: a.writes, which: b.writeList },
    screens_compared: Object.keys(screens).length, screens_different: Object.keys(screens).filter((k) => !screens[k].same), screens };
}
out.verdict = same ? "NO HUB SCREEN CHANGES" : "DIFFERENCE FOUND — read screens_different";
fs.writeFileSync(path.join(D, "hub-no-change.json"), JSON.stringify(out, null, 1));
console.log(out.verdict); for (const w of [1680, 390]) { const r = out.widths[w]; console.log(w, "screens", r.screens_compared, "different", r.screens_different, "cohort map same", r.cohort_map_same, "requests to new tables", JSON.stringify(r.hub_requests_to_the_new_tables), "tables read same", r.tables_the_hub_read.same, r.tables_the_hub_read.includes_new, "blocked", JSON.stringify(r.non_get_blocked)); }

// A4 (3 Oct 2026) · classify every stored analyst_target_news row with the collector's own rule set (quality.ts).
// In:  a JSON dump of the table (array of rows) and of public.splits — read-only SELECTs, no key.
// Out: counts per cause (JSON) and the fill SQL (UPDATE … FROM (VALUES …)) that writes quality / quality_reason /
//      adj_target_checked, in chunks.
// Usage: node classify.mjs <rows.json> <splits.json> <outdir> [nowIso]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { classify, causeOf } from "../../../../supabase/functions/analyst-revisions/quality.ts";

const [rowsPath, splitsPath, out, nowArg] = process.argv.slice(2);
const rows = JSON.parse(readFileSync(rowsPath, "utf8"));
const splits = JSON.parse(readFileSync(splitsPath, "utf8"));
const now = nowArg || new Date().toISOString();
const res = classify(rows, splits, now);
mkdirSync(out, { recursive: true });

const counts = { rows: rows.length, by_kind: {}, quarantined: 0, first_cause: {}, any_cause: {}, soft: {}, now };
res.forEach((q, i) => {
  const k = rows[i].kind;
  const bk = (counts.by_kind[k] ||= { rows: 0, quarantined: 0 });
  bk.rows++;
  const parts = (q.quality_reason || "").split(";").filter(Boolean).map((p) => p.replace(/\(.*$/, ""));
  if (q.quality === "quarantine") {
    bk.quarantined++; counts.quarantined++;
    const c = k + ":" + causeOf(q.quality_reason);
    counts.first_cause[c] = (counts.first_cause[c] || 0) + 1;
  }
  for (const p of parts) {
    const key = k + ":" + p;
    if (["roundup", "firm_unverified", "headline_confirms", "split_mismatch"].includes(p)) counts.soft[key] = (counts.soft[key] || 0) + 1;
    else counts.any_cause[key] = (counts.any_cause[key] || 0) + 1;
  }
});
writeFileSync(out + "/counts.json", JSON.stringify(counts, null, 1));
writeFileSync(out + "/classified.json", JSON.stringify(rows.map((r, i) => ({ ...r, ...res[i] }))));

// the fill: one UPDATE per 2,000 rows, matched on the table's unique key (ticker, published_utc, firm, kind)
const lit = (s) => (s == null ? "null" : "'" + String(s).replace(/'/g, "''") + "'");
const files = [];
for (let i = 0, c = 0; i < rows.length; i += 2000, c++) {
  const vals = rows.slice(i, i + 2000).map((r, j) => {
    const q = res[i + j];
    return `(${lit(r.ticker)},${lit(r.published_utc)}::timestamptz,${lit(r.firm)},${lit(r.kind)},${lit(q.quality)},${lit(q.quality_reason)},${q.adj_target_checked == null ? "null::numeric" : q.adj_target_checked})`;
  });
  const sql = `update public.analyst_target_news a set quality = v.q, quality_reason = v.r, adj_target_checked = v.c
from (values ${vals.join(",\n")}) as v(ticker, published_utc, firm, kind, q, r, c)
where a.ticker = v.ticker and a.published_utc = v.published_utc and a.firm = v.firm and a.kind = v.kind;\n`;
  const f = out + "/fill-" + String(c).padStart(2, "0") + ".sql";
  writeFileSync(f, sql); files.push(f);
}
console.log(JSON.stringify({ ...counts, fill_files: files.length }, null, 1));

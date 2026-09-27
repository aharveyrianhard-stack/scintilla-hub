// breadth-ingest — pure helpers (shared by the edge function and tests/breadth-ingest.test.mjs).
export const COLUMNS = ["session_date", "scope", "advancers", "decliners", "unchanged", "adv_volume", "dec_volume",
  "ad_line", "trin", "pct_above_50", "members_50", "pct_above_200", "members_200", "new_highs", "new_lows",
  "members_highlow", "members", "suspect_moves", "source", "computed_utc"];
export const SCOPES = ["US_COMMON", "SP500"];

/** keep only the table's columns; refuse a row without its key or with a wrong-shaped date */
export function toTableRow(r, scope) {
  const row = {};
  for (const c of COLUMNS) row[c] = r[c] === undefined ? null : r[c];
  row.scope = scope;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.session_date || ""))) throw new Error("row without a session date");
  if (row.advancers == null || row.decliners == null || row.ad_line == null) throw new Error("row " + row.session_date + " lacks its counts");
  return row;
}

/** the day after the newest stored row, re-reading one extra week so a corrected late row is replaced */
export function sinceFor(newestStored) {
  if (!newestStored) return null;
  const d = new Date(newestStored + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

/** FMP constituent rows → public.index_constituents rows (FMP writes BRK-B; the Hub and Massive write BRK.B) */
export function constituentRows(indexName, fmpRows, asOf, endpoint, nowTs) {
  if (!Array.isArray(fmpRows) || fmpRows.length < (indexName === "SP500" ? 400 : 80)) {
    throw new Error(indexName + ": FMP returned " + (Array.isArray(fmpRows) ? fmpRows.length : "no") + " rows — refusing a partial list");
  }
  const seen = new Set();
  const out = [];
  for (const r of fmpRows) {
    const t = String(r.symbol || "").trim().toUpperCase().replace(/-/g, ".");
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push({ index_name: indexName, ticker: t, weight: null, sector: r.sector || null, as_of: asOf,
      source: "FMP stable/" + endpoint, updated_ts: nowTs });
  }
  return out;
}

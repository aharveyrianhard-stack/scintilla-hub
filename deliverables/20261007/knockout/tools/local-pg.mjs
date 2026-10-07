/* KO1 · a local stand-in for the Hub's public table reads, so the comps reader can price every company from ONE
   snapshot of the tables instead of ten requests per company. It answers exactly the query shapes the comps reader
   sends (cohort.mjs, read.mjs, comps-run.mjs): filters eq / in / gte / gt / lte / lt, order, limit, offset, select.
   Pure: rows in, rows out. No network, no key. A query it cannot answer throws — it never guesses. */
const OPS = { eq: (a, b) => String(a) === b, gte: (a, b) => a != null && String(a) >= b, gt: (a, b) => a != null && String(a) > b, lte: (a, b) => a != null && String(a) <= b, lt: (a, b) => a != null && String(a) < b };
const cmp = (a, b) => (a == null && b == null ? 0 : a == null ? 1 : b == null ? -1 : typeof a === "number" && typeof b === "number" ? a - b : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);
/** tables: { name: rows[] } → pg(path) → Promise<rows>. `floors` (optional): { table: { column: lowest value the snapshot
    holds } } — a query that reaches below the snapshot's own floor throws, so a short snapshot can never pass as a full read. */
export function localPg(tables, { floors = {}, counter = null } = {}) {
  return async function pg(path) {
    const [table, qs = ""] = String(path).split("?");
    const rows0 = tables[table];
    if (!rows0) throw new Error(`${table} → not in the snapshot`);
    if (counter) counter[table] = (counter[table] || 0) + 1;
    let rows = rows0, select = null, order = null, limit = null, offset = 0;
    for (const part of qs.split("&").filter(Boolean)) {
      const i = part.indexOf("="), key = part.slice(0, i), val = decodeURIComponent(part.slice(i + 1));
      if (key === "select") { select = val === "*" ? null : val.split(","); continue; }
      if (key === "order") { order = val.split(",").map((o) => { const [c, d = "asc"] = o.split("."); return [c, d === "desc" ? -1 : 1]; }); continue; }
      if (key === "limit") { limit = Number(val); continue; }
      if (key === "offset") { offset = Number(val); continue; }
      const dot = val.indexOf("."), op = val.slice(0, dot), arg = val.slice(dot + 1);
      if (op === "in") { const set = new Set(arg.replace(/^\(|\)$/g, "").split(",").map((s) => s.replace(/^"|"$/g, ""))); rows = rows.filter((r) => set.has(String(r[key]))); continue; }
      if (!OPS[op]) throw new Error(`${table}: the filter ${key}=${val} is not one this stand-in answers`);
      if ((op === "gte" || op === "gt") && floors[table] && floors[table][key] != null && arg < floors[table][key]) throw new Error(`${table}: asked for ${key} from ${arg}, the snapshot starts at ${floors[table][key]}`);
      rows = rows.filter((r) => OPS[op](r[key], arg));
    }
    if (order) rows = rows.slice().sort((a, b) => { for (const [c, d] of order) { const x = cmp(a[c], b[c]); if (x) return x * d; } return 0; });
    if (offset || limit != null) rows = rows.slice(offset, limit != null ? offset + limit : undefined);
    if (select) { for (const c of select) if (rows.length && !(c in rows[0])) throw new Error(`${table}: column ${c} is not in the snapshot`); rows = rows.map((r) => Object.fromEntries(select.map((c) => [c, r[c]]))); }
    return rows;
  };
}

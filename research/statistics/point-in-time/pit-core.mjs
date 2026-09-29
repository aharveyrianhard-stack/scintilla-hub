/* Point-in-time index membership (N9, 28 Sep 2026). Pure: no network, no disk.
   The index's member list is rebuilt by starting from TODAY's list and undoing FMP's change log one
   effective date at a time, newest first: on a change date the added ticker leaves, the removed ticker
   comes back. The result is one interval per stretch of membership: { sym, from, to } where `from` is
   the first session as a member and `to` the last (null = still a member). Records that do not fit the
   walk (an "added" name that is not a member at that point, a "removed" name that already is one) are
   kept as anomalies, never silently fixed. */

/** FMP and the bar cache spell share classes differently (BRK.B / BRK-B). One spelling everywhere: a dot. */
export const normSym = (s) => String(s || "").trim().toUpperCase().replace(/[-/]/g, ".");

const prevDay = (d) => new Date(Date.parse(d + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);

/** changes: FMP historical-*-constituent rows ({date, symbol, removedTicker, ...}); current: today's tickers.
    floor: earliest date to rebuild to. Returns { intervals, anomalies, countByChangeDate }. */
export function buildMembership(current, changes, { floor = "2003-01-01", asOf } = {}) {
  const byDate = new Map();
  for (const c of changes) {
    const d = String(c.date || "").slice(0, 10);
    if (!d || d < floor) continue;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push({ add: normSym(c.symbol), rem: normSym(c.removedTicker), reason: c.reason || "", addedName: c.addedSecurity || "", removedName: c.removedSecurity || "" });
  }
  const open = new Map(); // sym -> `to` of the stretch being walked back (null = member today)
  for (const s of current) open.set(normSym(s), null);
  const intervals = [], anomalies = [], countByChangeDate = {};
  for (const d of [...byDate.keys()].sort().reverse()) {
    // everything on one date is applied together: a same-day add+remove of one ticker is a rename/class swap
    const adds = byDate.get(d).filter((c) => c.add).map((c) => c.add);
    const rems = byDate.get(d).filter((c) => c.rem).map((c) => c.rem);
    for (const a of adds) {
      if (open.has(a)) { intervals.push({ sym: a, from: d, to: open.get(a) }); open.delete(a); }
      else if (!rems.includes(a)) anomalies.push({ date: d, sym: a, kind: "added-but-not-a-member-after", note: "no later removal recorded; the stretch is unknown" });
    }
    for (const r of rems) {
      if (open.has(r) && !adds.includes(r)) { anomalies.push({ date: d, sym: r, kind: "removed-but-member-before", note: "a later re-add is missing; kept as one stretch" }); continue; }
      open.set(r, prevDay(d));
    }
    countByChangeDate[d] = open.size;
  }
  for (const [sym, to] of open) intervals.push({ sym, from: null, to }); // member on the floor date (joined earlier)
  intervals.sort((a, b) => a.sym.localeCompare(b.sym) || String(a.from).localeCompare(String(b.from)));
  return { intervals, anomalies, countByChangeDate, asOf: asOf ?? null, floor };
}

/** Members on date d (YYYY-MM-DD). */
export function membersOn(intervals, d) {
  const out = [];
  for (const iv of intervals) if ((iv.from == null || iv.from <= d) && (iv.to == null || iv.to >= d)) out.push(iv.sym);
  return [...new Set(out)].sort();
}

/** Was sym a member on d? */
export function isMember(intervals, sym, d) {
  const s = normSym(sym);
  return intervals.some((iv) => iv.sym === s && (iv.from == null || iv.from <= d) && (iv.to == null || iv.to >= d));
}

/** Every ticker that was a member at any time on or after `from`. */
export function everMembers(intervals, from) {
  return [...new Set(intervals.filter((iv) => iv.to == null || iv.to >= from).map((iv) => iv.sym))].sort();
}

/** Daily member list for each session in `sessions` — compact: a list of changes from the first session. */
export function dailyDelta(intervals, sessions) {
  let prev = new Set(); const rows = [];
  for (const d of sessions) {
    const now = new Set(membersOn(intervals, d));
    const add = [...now].filter((s) => !prev.has(s)), rem = [...prev].filter((s) => !now.has(s));
    if (add.length || rem.length || !rows.length) rows.push({ d, n: now.size, add: add.sort(), rem: rem.sort() });
    prev = now;
  }
  return rows;
}

/** Month-end values from a daily series [{date, v}] (any order) → [{m:'YYYY-MM', date, v}]. */
export function monthEnd(series) {
  const by = new Map();
  for (const r of series) { const m = r.date.slice(0, 7); const cur = by.get(m); if (!cur || r.date > cur.date) by.set(m, r); }
  return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([m, r]) => ({ m, date: r.date, v: r.v }));
}

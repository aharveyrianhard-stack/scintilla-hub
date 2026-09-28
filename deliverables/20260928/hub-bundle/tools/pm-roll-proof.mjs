/* N6 (28 Sep) — read-only check of the prediction-markets registry against Polymarket's public API. Writes NOTHING to any
   database. For every topic: which event the roll rule picks now, how many priced rows it gives; then the same with the
   clock set past the 28 Oct Fed meeting and past 1 Oct, to show the roll. node --experimental-strip-types … [--out f.json] */
import fs from "node:fs";
import * as L from "../../../../supabase/functions/prediction-markets/lib.ts";
const REG = JSON.parse(fs.readFileSync(new URL("../../../../supabase/functions/prediction-markets/topics.json", import.meta.url), "utf8"));
const PM = "https://gamma-api.polymarket.com";
const j = async (u) => { for (let k = 0; k < 3; k++) { const r = await fetch(u, { headers: { "User-Agent": "scintilla-prediction-markets/1.0" } }); if (r.ok) return r.json(); await new Promise((s) => setTimeout(s, 800)); } throw new Error("HTTP " + u); };
const series = new Map(), events = new Map();
for (const sid of new Set(REG.topics.map((t) => t.polymarket?.roll?.series_id).filter(Boolean))) series.set(sid, await j(`${PM}/events?series_id=${sid}&closed=false&limit=100`));
const ev = async (id) => { if (!events.has(id)) events.set(id, await j(`${PM}/events/${id}`)); return events.get(id); };
async function at(now) {
  const out = [];
  for (const t of REG.topics) {
    const pinned = t.polymarket?.events || [];
    if (!pinned.length) { out.push({ topic: t.id, polymarket: "none" }); continue; }
    const p0 = await ev(pinned[0]);
    const r = L.polymarketIdsFor(t, t.polymarket.roll ? series.get(t.polymarket.roll.series_id) : undefined, now, p0);
    let rows = 0, titles = [];
    for (const id of r.ids) { const e = await ev(id); titles.push(e.title + " (ends " + String(e.endDate).slice(0, 10) + ")"); rows += L.rowsFromPolymarketEvent(e, t, new Map(), REG.limits).length; }
    out.push({ topic: t.id, group: t.group, roll: t.polymarket.roll ? t.polymarket.roll.mode + (t.polymarket.roll.rank != null ? "#" + t.polymarket.roll.rank : "") : "-", reads: r.ids, rolled: r.rolled, rows, titles });
  }
  return out;
}
const now = await at(new Date());
const later = await at(new Date("2026-10-30T12:00:00Z"));
const res = { at: new Date().toISOString(), now, after_28_oct: later.filter((x) => x.rolled).map((x) => ({ topic: x.topic, reads: x.reads, titles: x.titles })) };
console.log(JSON.stringify(res, null, 1));
const i = process.argv.indexOf("--out"); if (i > 0) fs.writeFileSync(process.argv[i + 1], JSON.stringify(res, null, 1));

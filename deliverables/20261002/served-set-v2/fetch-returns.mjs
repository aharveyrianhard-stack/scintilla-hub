/* U3 (2 Oct 2026) · daily closes for the returns test. Reads the holdings snapshot, decides which symbols the measurement
   needs (every fund with holdings on file; the top 200 by weight of every fund; every holding of the equal-weight funds;
   every IWM name that another fund also holds), and asks the chart API for ~70 daily candles each. Writes
   data/daily-closes-20261002.json: { what, fetched_utc, dates, closes: { SYM: { d: [...], c: [...] } }, missing: [...] }.
   Read-only: GET only, the public chart API, no key. Usage: node deliverables/20261002/served-set-v2/fetch-returns.mjs */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const DIR = dirname(fileURLToPath(import.meta.url));
const HOLD = JSON.parse(readFileSync(join(DIR, "data/holdings-20260926.json"), "utf8"));
const norm = (t) => String(t || "").trim().toUpperCase().replace(/\./g, "-");
const EQUAL = new Set(["RSP", "QQEW", "XRT", "XHB", "KRE", "KBE", "XOP", "XPH", "SPLV"]);
const need = new Set(Object.keys(HOLD.funds).map(norm));
const heldBy = {};
for (const [f, { h }] of Object.entries(HOLD.funds)) for (const [t] of h) (heldBy[norm(t)] ||= new Set()).add(f);
for (const [f, { h }] of Object.entries(HOLD.funds)) {
  const sorted = h.slice().sort((a, b) => b[1] - a[1]);
  const take = EQUAL.has(f) ? sorted : f === "IWM" ? sorted.filter(([t]) => heldBy[norm(t)].size > 1) : sorted.slice(0, 200);
  for (const [t] of take) need.add(norm(t));
}
const syms = [...need].sort();
console.log("symbols to fetch:", syms.length);
const API = "https://scintilla-massive-chart-api.fly.dev/candles";
const out = {}, missing = [];
let done = 0;
async function one(s) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`${API}?symbol=${encodeURIComponent(s)}&tf=D&limit=70`, { headers: { Origin: "https://scintillahub.ai" }, signal: AbortSignal.timeout(20000) });
      if (r.status === 404) { missing.push(s); return; }
      if (!r.ok) throw new Error("http " + r.status);
      const j = await r.json();
      const ser = (j.series || []).filter((b) => b && Number.isFinite(b.c) && b.t);
      if (!ser.length) { missing.push(s); return; }
      out[s] = { d: ser.map((b) => new Date(b.t).toISOString().slice(0, 10)), c: ser.map((b) => b.c) };
      return;
    } catch (e) { if (attempt === 2) { missing.push(s + " (" + String(e.message || e).slice(0, 40) + ")"); } else await new Promise((r) => setTimeout(r, 400 * (attempt + 1))); }
  }
}
const queue = syms.slice();
await Promise.all(Array.from({ length: 10 }, async () => { while (queue.length) { const s = queue.shift(); await one(s); if (++done % 100 === 0) console.log("fetched", done); } }));
const allDates = new Set(); for (const v of Object.values(out)) for (const d of v.d) allDates.add(d);
const dates = [...allDates].sort();
writeFileSync(join(DIR, "data/daily-closes-20261002.json"), JSON.stringify({ what: "daily closes (split-adjusted) from the chart API /candles?tf=D&limit=70 for the symbols the U3 measurement needs; fetched " + new Date().toISOString(), fetched_utc: new Date().toISOString(), symbols: Object.keys(out).length, dates, closes: out, missing }));
console.log("done", Object.keys(out).length, "missing", missing.length, "dates", dates[0], "→", dates[dates.length - 1]);

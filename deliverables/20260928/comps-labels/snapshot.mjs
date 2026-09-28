/* Scintilla · comps labels · takes ONE dated snapshot of the MU "P/E, trailing" row, on the same
   arithmetic the live comps round-3 page uses (../../20260927/comps-r3/r3.mjs), so the labelled chart
   draws the same numbers the live page draws.

   Run on this Mac (no key on this machine is needed):
     node deliverables/20260928/comps-labels/snapshot.mjs [TICKER] [COHORT]
   · The Hub's public read key is discovered at run time from the Hub's own pages, exactly as the live
     comps pages do; it is used for the reads and is NEVER written to disk or printed.
   · The chart API only answers a request that carries the Hub's origin; this script sends that
     origin header for the /quotes read and says so in the snapshot (quotes_origin).
   Output: snapshot-<today>.json next to this file, with the row IN and OUT of outliers. */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildInputs, compsRead, cohortFor, fmt, row } from "../../20260927/comps-r3/r3.mjs";
import { num, tsToISO } from "../../20260925/knockout/field.mjs";

const HUB = "https://scintillahub.ai";
const SB = "https://wadinxqplrggagkvrdag.supabase.co";
const API = "https://scintilla-massive-chart-api.fly.dev";
const TICKER = (process.argv[2] || "MU").toUpperCase();
const ROW = "pe_ttm";
const TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const SIZE = ["MEGA_CAP", "MEGACAP", "LARGE_CAP", "MID_CAP", "SMALL_CAP", "BLUE_CHIP"];

let KEY = null;
async function readKey() {
  for (const page of ["/pip.html", "/index.html"]) {
    const t = await (await fetch(HUB + page)).text();
    const m = t.match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_.\-]+/);
    if (m) return (KEY = m[0]);
  }
  throw new Error("no read key could be found on the Hub's pages");
}
async function pg(p) {
  const r = await fetch(SB + "/rest/v1/" + p, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } });
  if (!r.ok) throw new Error(p.split("?")[0] + " → " + r.status);
  return r.json();
}

await readKey();
const own = await pg(`ticker_cohorts?select=ticker,cohort&ticker=eq.${TICKER}`);
const ownTags = [...new Set(own.map((x) => x.cohort))];
const cohort = cohortFor(TICKER, ownTags, process.argv[3]);
if (!cohort) throw new Error(TICKER + " carries no cohort tag");
const mem = await pg(`ticker_cohorts?select=ticker&cohort=eq.${encodeURIComponent(cohort)}&order=ticker.asc`);
const T = [...new Set([TICKER, ...mem.map((m) => m.ticker)])];
const inq = "in.(" + T.join(",") + ")";
const [fund, prof, quotesRes] = await Promise.all([
  pg(`fundamentals?select=ticker,price,market_cap,eps_ttm,revenue_ttm,trailing_pe,adjusted_pe,updated_ts&ticker=${inq}`),
  pg(`company_profile?select=ticker,name,industry,is_etf&ticker=${inq}`),
  fetch(`${API}/quotes?symbols=${encodeURIComponent(T.join(","))}`, { headers: { Origin: HUB } }).then((r) => r.ok ? r.json() : { quotes: {}, error: "quotes → " + r.status }).catch((e) => ({ quotes: {}, error: String(e.message || e) })),
]);
const qmap = quotesRes.quotes && typeof quotesRes.quotes === "object" ? quotesRes.quotes : {};
const first = (rows, t) => rows.find((r) => r.ticker === t) || null;
const srcOf = (t) => {
  const f = first(fund, t) || {};
  const q = qmap[t] && qmap[t].price != null ? qmap[t] : null;
  return {
    ticker: t, profile: first(prof, t) || {}, tags: [], fundamentals: { ...f, date: tsToISO(f.updated_ts) }, quote: q,
    price_date: q && q.price_observation_utc ? String(q.price_observation_utc).slice(0, 10) : tsToISO(f.updated_ts),
    estimates: [], incQ: [], incFY: [], cfQ: [], cfFY: [], balance: [], next_report: null, target: null, geiger: null, heartbeat: null,
  };
};
const inputs = T.map((t) => buildInputs(srcOf(t), TODAY)).filter((i) => i && i.ticker);
const me = inputs.find((i) => i.ticker === TICKER);
const nameOf = (t) => (first(prof, t) || {}).name || t;

/** The one row, both ways: peers named, every end priced. */
function take(outOut) {
  const read = compsRead(me, inputs, { outOut });
  const rd = read.rows.find((r) => r.key === ROW), bar = read.bars.find((b) => b.key === ROW);
  const peer = (x) => ({ ticker: x.ticker, name: nameOf(x.ticker), multiple: x.value, implied: bar.ends.min.price != null && me.eps_ttm > 0 ? x.value * me.eps_ttm : null,
    price: num(inputs.find((i) => i.ticker === x.ticker)?.price), eps: num(inputs.find((i) => i.ticker === x.ticker)?.eps_ttm) });
  return {
    outOut, n: rd.n, sets: rd.sets, band: rd.band,
    ends: Object.fromEntries(Object.entries(bar.ends).map(([k, e]) => [k, { multiple: e.m, who: e.who, price: e.price }])),
    peers: rd.sets.sorted ? rd.sets.sorted.map(peer) : [],
    outliers: { rule: rd.outliers.rule, fence: rd.outliers.fence, out: rd.outliers.out.map((x) => ({ ...peer(x), side: x.side })) },
    nm: rd.nm, missing: rd.missing, upside: bar.upside, ok: bar.ok, reason: bar.reason,
  };
}
const r = row(ROW);
const out = {
  taken: new Date().toISOString(), today: TODAY, ticker: TICKER, name: nameOf(TICKER), cohort, row: ROW, label: r.label, basis: r.basis, fmt: r.fmt,
  own: { multiple: compsRead(me, inputs).rows.find((x) => x.key === ROW).value, price: num(me.price), price_date: me.price_date, eps_ttm: num(me.eps_ttm), eps_date: srcOf(TICKER).fundamentals.date },
  in: take(false), out: take(true),
  sources: {
    "ticker_cohorts": "who is in the cohort " + cohort,
    "fundamentals": "each company's EPS over the last twelve months (eps_ttm), and the price on the same row when the chart API gives none",
    "company_profile": "company names",
    "chart API /quotes": quotesRes.error ? "NOT REACHED: " + quotesRes.error : "today's price for every name (the request carried the Hub's origin header, which the API requires)",
  },
  quotes_origin: HUB, arithmetic: "deliverables/20260927/comps-r3/r3.mjs (compsRead → rows[pe_ttm], bars[pe_ttm])",
};
const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, `snapshot-${TODAY}.json`);
writeFileSync(file, JSON.stringify(out, null, 1));
console.log(`${file}\n${TICKER} ${r.label}: own ${fmt("x", out.own.multiple)} · price $${out.own.price} (${out.own.price_date}) · EPS TTM $${out.own.eps_ttm} · ${out.in.n} peers`);
console.log(`IN : low ${fmt("x", out.in.band.min)} (${out.in.sets.low}) · q1 ${fmt("x", out.in.band.q1)} · median ${fmt("x", out.in.band.median)} (${out.in.sets.median.join("&")}) · q3 ${fmt("x", out.in.band.q3)} · high ${fmt("x", out.in.band.max)} (${out.in.sets.high}) · outliers ${out.in.outliers.out.map((o) => o.ticker + " " + fmt("x", o.multiple)).join(", ") || "none"}`);
console.log(`OUT: low ${fmt("x", out.out.band.min)} (${out.out.sets.low}) · q1 ${fmt("x", out.out.band.q1)} · median ${fmt("x", out.out.band.median)} (${out.out.sets.median.join("&")}) · q3 ${fmt("x", out.out.band.q3)} · high ${fmt("x", out.out.band.max)} (${out.out.sets.high}) · n ${out.out.n}`);
console.log(`peers: ${out.in.peers.map((p) => `${p.ticker} ${fmt("x", p.multiple)}`).join(" · ")} · NM: ${out.in.nm.map((x) => x.ticker).join(",") || "none"} · missing: ${out.in.missing.join(",") || "none"}`);

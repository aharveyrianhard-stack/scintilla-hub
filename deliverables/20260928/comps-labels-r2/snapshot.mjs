/* Scintilla · comps labels, round 2 · one dated snapshot of FOUR valuation rows for one company
   (P/E trailing, EV/EBITDA, P/S, P/E forward), on the arithmetic the live comps round-3 page uses
   (../../20260927/comps-r3/r3.mjs → compsRead), reading the same tables the live page reads.

   Run on this Mac (no key on this machine is needed):
     node deliverables/20260928/comps-labels-r2/snapshot.mjs [TICKER] [COHORT]
   · The Hub's public read key is discovered at run time from the Hub's own pages, exactly as the live
     comps pages do; it is used for the reads and is NEVER written to disk or printed.
   · The chart API only answers a request that carries the Hub's origin; this script sends that origin
     header for the /quotes read and says so in the snapshot (quotes_origin).
   · P/S is not a row of the live page (the live page carries EV/sales). It is computed here on the same
     inputs: market value ÷ revenue TTM, and the price it implies = multiple × revenue TTM ÷ shares.
   Output: snapshot-<today>.json next to this file. Outliers are left IN (Alan, 28 Sep: outliers come later). */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildInputs, compsRead, cohortFor, fmt, row, whoSets, outliers, peerBand, num } from "../../20260927/comps-r3/r3.mjs";
import { tsToISO } from "../../20260925/knockout/field.mjs";

const HUB = "https://scintillahub.ai";
const SB = "https://wadinxqplrggagkvrdag.supabase.co";
const API = "https://scintilla-massive-chart-api.fly.dev";
const TICKER = (process.argv[2] || "MU").toUpperCase();
const TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const daysAgo = (n) => new Date(Date.parse(TODAY + "T00:00:00Z") - n * 86400e3).toISOString().slice(0, 10);
const ROWS = ["pe_ttm", "ev_ebitda", "ps", "pe_fwd"];

let KEY = null;
for (const page of ["/pip.html", "/index.html"]) {
  const m = (await (await fetch(HUB + page)).text()).match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_.\-]+/);
  if (m) { KEY = m[0]; break; }
}
if (!KEY) throw new Error("no read key could be found on the Hub's pages");
const pg = async (p) => { const r = await fetch(SB + "/rest/v1/" + p, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } }); if (!r.ok) throw new Error(p.split("?")[0] + " → " + r.status); return r.json(); };

const own = await pg(`ticker_cohorts?select=ticker,cohort&ticker=eq.${TICKER}`);
const cohort = cohortFor(TICKER, [...new Set(own.map((x) => x.cohort))], process.argv[3]);
if (!cohort) throw new Error(TICKER + " carries no cohort tag");
const mem = await pg(`ticker_cohorts?select=ticker&cohort=eq.${encodeURIComponent(cohort)}&order=ticker.asc`);
const T = [...new Set([TICKER, ...mem.map((m) => m.ticker)])];
const inq = "in.(" + T.join(",") + ")";
const [fund, est, incH, bal, prof, quotesRes] = await Promise.all([
  pg(`fundamentals?select=ticker,price,market_cap,eps_ttm,revenue_ttm,trailing_pe,adjusted_pe,updated_ts&ticker=${inq}`),
  pg(`analyst_estimates?select=ticker,period,fiscal_date,est_eps_avg,est_revenue_avg,price_target_avg,updated_ts&period=eq.annual&ticker=${inq}&fiscal_date=gte.${TODAY}&order=ticker.asc,fiscal_date.asc`),
  pg(`fundamentals_history?select=ticker,period,fiscal_year,fiscal_date,revenue,gross_profit,operating_income,ebitda&ticker=${inq}&fiscal_date=gte.${daysAgo(1100)}&order=fiscal_date.desc`),
  pg(`balance_history?select=ticker,period,fiscal_date,net_debt,total_debt,cash_and_equiv&ticker=${inq}&fiscal_date=gte.${daysAgo(800)}&order=fiscal_date.desc`),
  pg(`company_profile?select=ticker,name,industry,is_etf&ticker=${inq}`),
  fetch(`${API}/quotes?symbols=${encodeURIComponent(T.join(","))}`, { headers: { Origin: HUB } }).then((r) => r.ok ? r.json() : { quotes: {}, error: "quotes → " + r.status }).catch((e) => ({ quotes: {}, error: String(e.message || e) })),
]);
const qmap = quotesRes.quotes && typeof quotesRes.quotes === "object" ? quotesRes.quotes : {};
const first = (rows, t) => rows.find((r) => r.ticker === t) || null;
const srcOf = (t) => {
  const f = first(fund, t) || {};
  const q = qmap[t] && qmap[t].price != null ? qmap[t] : null;
  const inc = incH.filter((r) => r.ticker === t);
  return {
    ticker: t, profile: first(prof, t) || {}, tags: [], fundamentals: { ...f, date: tsToISO(f.updated_ts) }, quote: q,
    price_date: q && q.price_observation_utc ? String(q.price_observation_utc).slice(0, 10) : tsToISO(f.updated_ts),
    estimates: est.filter((e) => e.ticker === t),
    incQ: inc.filter((r) => r.period !== "FY"), incFY: inc.filter((r) => r.period === "FY"),
    cfQ: [], cfFY: [], balance: bal.filter((r) => r.ticker === t), next_report: null, target: null, geiger: null, heartbeat: null,
  };
};
const inputs = T.map((t) => buildInputs(srcOf(t), TODAY)).filter((i) => i && i.ticker);
const me = inputs.find((i) => i.ticker === TICKER);
const nameOf = (t) => (first(prof, t) || {}).name || t;
const read = compsRead(me, inputs, { outOut: false });

/* P/S on the same inputs: market value ÷ revenue TTM; price implied = multiple × revenue ÷ shares. */
const revOf = (i) => i.rev?.now ?? i.revenue_ttm_on_file;
const psOf = (i) => (i.mcap > 0 && revOf(i) > 0) ? i.mcap / revOf(i) : null;
function psRow() {
  const peers = inputs.filter((p) => p.ticker !== TICKER && !p.is_etf).map((p) => ({ ticker: p.ticker, value: psOf(p) }));
  const usable = peers.filter((x) => x.value != null && x.value <= 50);           // the same cap the live page uses for EV/sales
  const o = outliers(usable), sets = whoSets(usable), band = peerBand(usable.map((x) => x.value));
  const sh = me.shares, rev = revOf(me);
  const price = (m) => (m != null && rev > 0 && sh > 0) ? m * rev / sh : null;
  const at = (m, who) => ({ multiple: m, who, price: price(m) });
  return {
    key: "ps", label: "P/S", basis: "market value ÷ revenue, TTM", fmt: "x",
    own: { multiple: psOf(me), price: num(me.price) },
    figure: { word: "revenue TTM", value: rev, fmt: "money", formula: "multiple × revenue ÷ shares" },
    n: band.n, band, ends: { min: at(band.min, sets.low ? [sets.low] : []), q1: at(band.q1, []), median: at(band.median, sets.median || []), q3: at(band.q3, []), max: at(band.max, sets.high ? [sets.high] : []) },
    peers: (sets.sorted || []).map((x) => ({ ticker: x.ticker, multiple: x.value })),
    nm: peers.filter((x) => x.value != null && x.value > 50), missing: peers.filter((x) => x.value == null).map((x) => x.ticker),
    outliers: { rule: o.rule, fence: o.fence, out: o.out.map((x) => ({ ticker: x.ticker, multiple: x.value, side: x.side })) },
    upside: price(band.median) != null && me.price > 0 ? (price(band.median) / me.price - 1) * 100 : null, ok: band.n >= 2 && price(band.min) != null, reason: null,
  };
}
function liveRow(key) {
  const rd = read.rows.find((r) => r.key === key), bar = read.bars.find((b) => b.key === key), r = row(key);
  return {
    key, label: r.label, basis: r.basis, fmt: r.fmt,
    own: { multiple: rd.value, price: num(me.price) }, figure: bar.figure,
    n: rd.n, band: rd.band, ends: Object.fromEntries(Object.entries(bar.ends).map(([k, e]) => [k, { multiple: e.m, who: e.who, price: e.price }])),
    peers: (rd.sets.sorted || []).map((x) => ({ ticker: x.ticker, multiple: x.value })),
    nm: rd.nm, missing: rd.missing, outliers: { rule: rd.outliers.rule, fence: rd.outliers.fence, out: rd.outliers.out.map((x) => ({ ticker: x.ticker, multiple: x.value, side: x.side })) },
    upside: bar.upside, ok: bar.ok, reason: bar.reason,
  };
}
const rows = ROWS.map((k) => (k === "ps" ? psRow() : liveRow(k)));
const out = {
  taken: new Date().toISOString(), today: TODAY, ticker: TICKER, name: nameOf(TICKER), cohort,
  price: num(me.price), price_date: me.price_date, shares: me.shares, mcap: me.mcap, net_debt: me.net_debt, net_debt_date: me.net_debt_date,
  eps_ttm: me.eps_ttm, eps_date: srcOf(TICKER).fundamentals.date, eps_fy1: me.eps_fy1, fy1_date: me.fy1_date, revenue_ttm: revOf(me), ebitda_ttm: me.ebitda?.now ?? null,
  rows,
  sources: {
    ticker_cohorts: "who is in the cohort " + cohort,
    fundamentals: "each company's EPS TTM, revenue TTM, market value and the price on the same row (→ shares)",
    analyst_estimates: "analysts' EPS for the current fiscal year → forward P/E",
    fundamentals_history: "revenue and EBITDA by quarter → TTM",
    balance_history: "net debt at the newest balance date → enterprise value",
    company_profile: "company names, fund or not",
    "chart API /quotes": quotesRes.error ? "NOT REACHED: " + quotesRes.error : "today's price for every name (the request carried the Hub's origin header, which the API requires)",
  },
  quotes_origin: HUB, arithmetic: "deliverables/20260927/comps-r3/r3.mjs (compsRead → rows, bars) · P/S computed here on the same inputs",
};
const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, `snapshot-${TODAY}.json`);
writeFileSync(file, JSON.stringify(out, null, 1));
console.log(`${file}\n${TICKER} · price $${out.price} (${out.price_date}) · EPS TTM $${out.eps_ttm} · EPS FY1 $${out.eps_fy1} (${out.fy1_date}) · shares ${out.shares && (out.shares / 1e6).toFixed(0)}M · net debt ${out.net_debt}`);
for (const r of rows) console.log(`${r.label.padEnd(14)} own ${fmt("x", r.own.multiple)} · n ${r.n} · low ${fmt("x", r.band.min)} q1 ${fmt("x", r.band.q1)} med ${fmt("x", r.band.median)} q3 ${fmt("x", r.band.q3)} high ${fmt("x", r.band.max)} · $ ${r.ends.min.price?.toFixed(0)} / ${r.ends.q1.price?.toFixed(0)} / ${r.ends.median.price?.toFixed(0)} / ${r.ends.q3.price?.toFixed(0)} / ${r.ends.max.price?.toFixed(0)} · ok ${r.ok}${r.reason ? " · " + r.reason : ""}`);

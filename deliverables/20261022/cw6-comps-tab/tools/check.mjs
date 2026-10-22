/* CW6 · the check. For the 23 RADAR names:
   A · engine identity: the tab's engine (../engine.mjs, the file the browser runs) fed CW3's own raw FMP answers of 19 Oct
       at CW3's prices and FX, size band off → each midpoint against COMPS-RADAR.json's.
   B · the tab against CW3 at the same prices: the tab's read on today's store (the answers it serves, 22 Oct) against
       CW3's raw answers recomputed at the tab's prices and FX (today's quotes put into CW3's raw). Band off and band ±10×.
   Writes CHECK.json and CHECK.md beside the page. usage: node tools/check.mjs <deliverable dir> */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { company, readName, fxRates, RULES, BAND_DEFAULT } from "../engine.mjs";

const D = process.argv[2] || ".";
const git = (ref) => JSON.parse(execFileSync("git", ["show", ref], { maxBuffer: 1 << 30 }).toString("utf8"));
const cw3 = git("9325a33:deliverables/20261019/cw3-comps/COMPS-RADAR.json");
const sets = JSON.parse(fs.readFileSync(path.join(D, "sets.json"), "utf8"));
const store = (t) => JSON.parse(fs.readFileSync(path.join(D, "store", t + ".json"), "utf8"));
const fxNow = JSON.parse(fs.readFileSync(path.join(D, "store", "_fx.json"), "utf8"));
const idx = JSON.parse(fs.readFileSync(path.join(D, "store", "_index.json"), "utf8"));
const TODAY_CW3 = cw3.today, TODAY = idx.fetch_utc_first.slice(0, 10);
const ratesCw3 = fxRates({ rates: cw3.fx.quotes }, { cw3gbp: true }), ratesNow = fxRates(fxNow);
const fin = new Set(sets.financial);

function run(t, answersOf, rates, today, band) {
  const n = sets.names[t], rules = RULES[n.set] || RULES.CW3;
  const mk = (x) => company(x, answersOf(x), { today, rates, financial: fin.has(x), rules });
  const subj = mk(t);
  const peers = n.peers.map((p) => ({ t: p.t, why: p.why, c: mk(p.t) }));
  return readName(subj, peers, { rules, band, today, answers: answersOf(t) });
}
const pct = (a, b) => a != null && b != null ? (a / b - 1) * 100 : null;
const f2 = (v) => v == null ? "—" : v.toFixed(2);
const radar = cw3.summary.map((s) => s.ticker).concat(cw3.unranked || []);
const rows = [];
for (const t of radar) {
  const ref = cw3.names[t];
  /* A · identity */
  const rawCw3 = (x) => cw3.raw[x] || {};
  const A = run(t, rawCw3, ratesCw3, TODAY_CW3, null);
  const A10 = run(t, rawCw3, ratesCw3, TODAY_CW3, BAND_DEFAULT);
  /* B · CW3's raw at today's prices: today's quote (price, market cap, time) in place of 19 Oct's */
  const atToday = (x) => { const r = { ...(cw3.raw[x] || {}) }; let q = null; try { q = store(x).answers.quote; } catch (_) {} if (q) r.quote = q; return r; };
  const B3 = run(t, atToday, ratesNow, TODAY, null), B3b = run(t, atToday, ratesNow, TODAY, BAND_DEFAULT);
  const storeOf = (x) => { try { return store(x).answers; } catch (_) { return {}; } };
  const Tab = run(t, storeOf, ratesNow, TODAY, null), Tab10 = run(t, storeOf, ratesNow, TODAY, BAND_DEFAULT);
  const why = [];
  const dId = pct(A.midpoint, ref.midpoint), dLive = pct(Tab.midpoint, B3.midpoint), dLive10 = pct(Tab10.midpoint, B3b.midpoint), dBand = pct(Tab10.midpoint, Tab.midpoint);
  if (dLive != null && Math.abs(dLive) > 1) {
    /* name the rows that moved and the figures under them */
    for (const k of Object.keys({ ...Tab.implied, ...B3.implied })) {
      const a = B3.implied[k], b = Tab.implied[k];
      if (!a || !b) { why.push(`${k}: priced ${a ? "on 19 Oct only" : "today only"}`); continue; }
      const dm = pct(b.median, a.median), df = pct(b.fig, a.fig);
      if (Math.abs(pct(b.price, a.price)) > 1) why.push(`${k} ${f2(pct(b.price, a.price))}% (peer median ${f2(dm)}%, own figure ${f2(df)}%)`);
    }
    const c0 = B3.company, c1 = Tab.company;
    if (c0.ttm_date !== c1.ttm_date) why.push(`${t} reported since 19 Oct: TTM ${c0.ttm_date} → ${c1.ttm_date}`);
    if (c0.ntm.fy1 !== c1.ntm.fy1) why.push(`${t}'s NTM window moved: FY1 ${c0.ntm.fy1} → ${c1.ntm.fy1}`);
    for (const [k, w] of [["net_income", "NTM net income"], ["revenue", "NTM revenue"], ["ebitda", "NTM EBITDA"]]) { const d = pct(c1.ntm[k], c0.ntm[k]); if (d != null && Math.abs(d) >= 0.5) why.push(`${t}'s ${w} consensus ${f2(d)}% since 19 Oct`); }
    { const d = pct(c1.ttm.net_income, c0.ttm.net_income); if (d != null && Math.abs(d) >= 0.5) why.push(`${t}'s trailing net income ${f2(d)}%`); }
    const moved = sets.names[t].peers.map((p) => p.t).filter((x) => { try { const a = (cw3.raw[x] || {})["income-statement-ttm"], b = store(x).answers["income-statement-ttm"]; return a && b && a.data && b.data && a.data[0] && b.data[0] && a.data[0].date !== b.data[0].date; } catch (_) { return false; } });
    if (moved.length) why.push(`peers reported since 19 Oct: ${moved.join(", ")}`);
  }
  rows.push({ ticker: t, cw3_midpoint: ref.midpoint, cw3_read: ref.read, engine_on_cw3_raw: A.midpoint, identity_pct: dId,
    band10_on_cw3_raw: A10.midpoint, band10_struck: A10.struck.map((s) => s.t), band10_thin: A10.thin,
    price_today: Tab.company.price, cw3_at_today_prices: B3.midpoint, tab_today: Tab.midpoint, live_pct: dLive, within_1pct: dLive != null ? Math.abs(dLive) <= 1 : null,
    cw3_at_today_prices_band10: B3b.midpoint, tab_today_band10: Tab10.midpoint, live_band10_pct: dLive10, band_effect_pct: dBand, tab_read_band10: Tab10.read, tab_read: Tab.read, thin_band10: Tab10.thin,
    why });
}
const out = { what: "CW6 check · the tab's engine against CW3's COMPS-RADAR.json", cw3_today: TODAY_CW3, store_fetch: [idx.fetch_utc_first, idx.fetch_utc_last], store_calls: idx.calls, rows,
  identity_max_abs_pct: Math.max(...rows.filter((r) => r.identity_pct != null).map((r) => Math.abs(r.identity_pct))),
  live_within_1pct: rows.filter((r) => r.within_1pct).length, live_n: rows.filter((r) => r.within_1pct != null).length };
fs.writeFileSync(path.join(D, "CHECK.json"), JSON.stringify(out, null, 1));
const P = (v) => v == null ? "—" : "$" + (v >= 100 ? Math.round(v).toLocaleString("en-US") : v.toFixed(2));
const S = (v) => v == null ? "—" : (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2) + "%";
let md = `# CW6 check — the COMPS tab against CW3 (23 RADAR names)\n\n`;
md += `A · **engine identity** (the tab's engine fed CW3's own raw answers of ${TODAY_CW3} at CW3's prices, band off): largest gap ${out.identity_max_abs_pct.toFixed(4)}% across ${rows.filter((r) => r.identity_pct != null).length} priced names.\n\n`;
md += `B · **the tab against CW3 at the same prices** (store fetched ${idx.fetch_utc_first}–${idx.fetch_utc_last}, ${idx.calls} FMP calls; CW3's 19 Oct figures repriced at the tab's quotes and FX): ${out.live_within_1pct} of ${out.live_n} centres within 1% with the band off.\n\n`;
md += `| name | CW3 19 Oct | engine on CW3 raw | identity | today's price | CW3 at today's prices | tab today | gap | within 1% | ±10× band: tab | band effect | why (when over 1%) |\n|---|---:|---:|---:|---:|---:|---:|---:|:-:|---:|---:|---|\n`;
for (const r of rows) md += `| ${r.ticker} | ${P(r.cw3_midpoint)} ${r.cw3_read || ""} | ${P(r.engine_on_cw3_raw)} | ${S(r.identity_pct)} | ${P(r.price_today)} | ${P(r.cw3_at_today_prices)} | ${P(r.tab_today)} | ${S(r.live_pct)} | ${r.within_1pct == null ? "—" : r.within_1pct ? "yes" : "**no**"} | ${r.thin_band10 ? "thin" : P(r.tab_today_band10)} | ${r.thin_band10 ? "thin" : S(r.band_effect_pct)} | ${r.why.join("; ")} |\n`;
fs.writeFileSync(path.join(D, "CHECK.md"), md);
console.log(md);

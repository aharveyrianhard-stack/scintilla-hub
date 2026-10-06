/* NQ1 · the comps pipeline headless for the in-scope names: C5 business-line set → C6b price-only outliers → the band (way C).
   Read-only: the Hub's public read key (from a private file), the chart API, the committed fixtures on the C6b branch. */
import { readFileSync, writeFileSync, existsSync } from "node:fs"; import path from "node:path";
const WT = "/Users/alanharvey/SCINTILLA 0.5/_worktrees/hub-c6b-outliers-price-only-20261005";
const { inputs: c4inputs, readSet, snapshotFromCohort } = await import(WT + "/deliverables/20261001/comps-mechanic/read.mjs");
const { buildSet, lineWords } = await import(WT + "/deliverables/20261003/comps-c5/lines.mjs");
const { conclusion6 } = await import(WT + "/deliverables/20261005/comps-c6/outliers.mjs");
const { ROWS } = await import(WT + "/deliverables/20261003/comps-c5/field.mjs");
const SB = "https://wadinxqplrggagkvrdag.supabase.co", API = "https://scintilla-massive-chart-api.fly.dev", HUB = "https://scintillahub.ai";
const KEY = readFileSync(".anon", "utf8").trim(); const TODAY = "2026-10-06";
const CACHE = new Map();
const pg = async (p) => { if (CACHE.has(p)) return CACHE.get(p); for (let a = 0; a < 4; a++) { try { const r = await fetch(SB + "/rest/v1/" + p, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } }); if (!r.ok) throw new Error(p.split("?")[0] + " → " + r.status); const j = await r.json(); if (p.startsWith("fx_rates") || p.startsWith("company_profile") || p.startsWith("fmp_peers") || p.startsWith("peer_sources") || p.startsWith("ticker_industry")) CACHE.set(p, j); return j; } catch (e) { if (a === 3) throw e; await new Promise((r) => setTimeout(r, 1500 * (a + 1))); } } };
const fetchJson = async (u) => JSON.parse(readFileSync(path.join(WT, u), "utf8"));
const quotes = async (T) => { const r = await fetch(`${API}/quotes?symbols=${encodeURIComponent(T.join(","))}`, { headers: { Origin: HUB } }); if (!r.ok) throw new Error("quotes → " + r.status); return r.json(); };
const fxStandin = JSON.parse(readFileSync(WT + "/deliverables/20261001/comps-template/fx-standin-ecb-2026-10-01.json", "utf8"));
fxStandin.reported = JSON.parse(readFileSync(WT + "/deliverables/20261003/comps-c5b/reporting-currency-fmp-2026-10-03.json", "utf8")).reported;
const inp = await c4inputs({ pg, fetchJson });
inp.segments = JSON.parse(readFileSync(WT + "/deliverables/20261003/comps-c5/segments-2026-10-03.json", "utf8")).companies;
console.log("inputs ready: profiles", Object.keys(inp.profiles).length, "fmp rows", inp.fmpRows.length, "src rows", inp.srcRows.length, "funds", inp.funds.length);
const syms = Object.keys(JSON.parse(readFileSync("scope-extra.json", "utf8"))).sort();
const out = existsSync("comps-upside.json") ? JSON.parse(readFileSync("comps-upside.json", "utf8")) : {};
const r1 = (v) => v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100;
async function one(T) {
  if (out[T] && out[T].ok) return;
  try {
    const set = buildSet(T, inp);
    const ctx = await readSet(T, set, { today: TODAY, pg, quotes, fxStandin });
    const snap = snapshotFromCohort(ctx, T);
    const estRows = await pg(`analyst_estimates?select=ticker,fiscal_date,est_eps_avg&period=eq.annual&ticker=in.(${ctx.members.map(encodeURIComponent).join(",")})&fiscal_date=gte.${TODAY}&order=ticker.asc,fiscal_date.asc`);
    const estimates = Object.fromEntries(ctx.inputs.map((i) => [i.ticker, { eps_ttm: i.eps_ttm ?? null, est: estRows.filter((e) => e.ticker === i.ticker).map((e) => ({ fiscal_date: e.fiscal_date, eps: e.est_eps_avg })) }]));
    const C = conclusion6(snap, [], estimates, TODAY, "C", { set });
    const w = C.c6.withOutliers;
    out[T] = { ok: true, price: snap.price, price_from: snap.price_from, lines: lineWords(set.own_lines), kept: set.kept.map((r) => r.ticker), peers_in: C.c6.peers.length,
      outliers: C.c6.outliers, business: C.c6.business ? { line: C.c6.business.line, same: C.c6.business.same.length, n: C.c6.business.n, mostlyDifferent: !!C.c6.business.mostlyDifferent } : null,
      band: C.band ? { lo: r1(C.band.lo), centre: r1(C.band.mid), hi: r1(C.band.hi) } : null, upside_pct: C.band && snap.price > 0 ? r1((C.band.mid / snap.price - 1) * 100) : null,
      band_with_outliers: w && w.band ? { lo: r1(w.band.lo), centre: r1(w.band.mid), hi: r1(w.band.hi) } : null, reason: C.reason || null,
      rows: Object.fromEntries(ROWS.map((k) => { const r = C.rows.find((x) => x.key === k); return [k, { own: r1(r.own && r.own.multiple), median: r1(r.band && r.band.median), n: r.n, price: r1(r.ok && r.ends && r.ends.median ? r.ends.median.price : null) }]; })),
      rows_ok: C.rows.filter((r) => r.ok).length };
    console.log(`${T.padEnd(5)} $${snap.price} → centre ${out[T].band ? out[T].band.centre : "—"} (${out[T].upside_pct ?? "—"}%) · ${out[T].rows_ok}/6 rows · out ${C.c6.outliers.join(" ") || "none"}${out[T].business && out[T].business.mostlyDifferent ? " · MOSTLY DIFFERENT BUSINESS" : ""}`);
  } catch (e) { out[T] = { ok: false, error: String(e && e.message || e) }; console.log(`${T.padEnd(5)} FAILED ${out[T].error}`); }
  writeFileSync("comps-upside.json", JSON.stringify(out, null, 1));
}
const q = [...syms]; await Promise.all([0, 1, 2, 3].map(async () => { while (q.length) await one(q.shift()); }));
console.log("DONE", Object.values(out).filter((o) => o.ok).length, "ok of", syms.length);

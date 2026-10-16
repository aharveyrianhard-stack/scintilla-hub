/* CW2 (15 Oct 2026) · the page and the JSON behind it, from the machine's own reads (runs/radar/*.json), the database reads
   (db/radar-db.json), PP1's file for the pre-profit names and the 10 Oct channel rails. Deterministic: same inputs, same page.
     S=<scratch> OUT=<dir> node build.mjs                                                                                   */
import fs from "node:fs"; import path from "node:path";
const S = process.env.S, OUT = process.env.OUT; fs.mkdirSync(path.join(OUT, "reads"), { recursive: true });
const J = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const DB = J(path.join(S, "db/radar-db.json")), RADAR = DB.radar;
const PP = J("/Users/alanharvey/AlanOS/Operating System/workspaces/scintilla/deliverables/20261013/PRE-PROFIT-NAMES.json");
const PPN = Object.fromEntries((Array.isArray(PP.names) ? PP.names : Object.values(PP.names)).map((n) => [n.ticker, n]));
const CH = J("/Users/alanharvey/AlanOS/Operating System/workspaces/scintilla/staging/channels/CHANNEL-ROOM-DATA.json");
const CHR = Object.fromEntries(CH.rows.map((r) => [r.sym, r]));
const RUN = J(path.join(S, "runs/radar/_run.json"));
const TODAY = "2026-10-15";
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const med = (a) => { const v = a.filter(fin).sort((x, y) => x - y); if (!v.length) return null; return v.length % 2 ? v[v.length >> 1] : (v[(v.length >> 1) - 1] + v[v.length >> 1]) / 2; };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const $ = (v) => !fin(v) ? "—" : "$" + (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-US") : Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2));
const $B = (v) => !fin(v) ? "—" : v >= 1e12 ? "$" + (v / 1e12).toFixed(2) + "T" : v >= 1e9 ? "$" + (v / 1e9).toFixed(0) + "B" : "$" + (v / 1e6).toFixed(0) + "M";
const SG = (v) => !fin(v) ? "—" : (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(Math.abs(v) >= 10 ? 0 : 1) + "%";
const X = (v, d) => !fin(v) ? "—" : (v < 0 ? "(" : "") + Math.abs(v).toFixed(d ?? (Math.abs(v) >= 100 ? 0 : Math.abs(v) < 10 ? 2 : 1)) + "x" + (v < 0 ? ")" : "");
const PC = (v, d = 0) => !fin(v) ? "—" : (v < 0 ? "(" : "") + Math.abs(v).toFixed(d) + "%" + (v < 0 ? ")" : "");
const dir = (v) => !fin(v) ? "" : v >= 0 ? "up" : "dn";
const KEYS = ["TIGHTEST", "HOME", "FMP", "LARGEST"], KW = { TIGHTEST: "tightest tag", HOME: "home cohort", FMP: "FMP peers", LARGEST: "largest 7" };
const ROWS = ["pe_ttm", "pe_fwd", "ev_ebitda", "ev_sales", "ps", "peg"], RW = { pe_ttm: "P/E trailing", pe_fwd: "P/E forward", ev_ebitda: "EV/EBITDA", ev_sales: "EV/sales", ps: "P/S", peg: "PEG" };
const EARN = new Set(["pe_ttm", "pe_fwd", "peg"]);
const FOREIGN = (t) => /\.[A-Z]{1,2}$/.test(t);
const prof = Object.fromEntries(DB.profiles.map((p) => [p.ticker, p]));
const NAME = (t) => (prof[t] && prof[t].name) || (PPN[t] && PPN[t].name) || t;
const daysOld = (iso) => iso ? Math.round((Date.parse(TODAY) - Date.parse(String(iso).slice(0, 10))) / 864e5) : null;

/* ---------- per name ---------- */
function analyse(T) {
  const f = path.join(S, "runs/radar", T + ".json"); const r = fs.existsSync(f) ? J(f) : null;
  const db = { profile: prof[T] || null, tags: DB.tags.filter((x) => x.ticker === T).map((x) => x.cohort), home: (DB.home.find((x) => x.ticker === T) || {}).cohort || null, fmp: DB.fmp_peers.filter((x) => x.ticker === T).map((x) => x.peer), fmp_fetched: (DB.fmp_peers.find((x) => x.ticker === T) || {}).fetched_at || null, served: DB.served[T], analysts: DB.analysts[T] || { n: 0 } };
  const pp = PPN[T] || null, ch = CHR[T] || null;
  const out = { ticker: T, name: NAME(T), db, pp: pp ? { class: pp.class, kind: pp.kind, rank: pp.rank, runway_quarters: pp.runway && pp.runway.quarters, growth_pct: pp.score && pp.score.growth_pct, score: pp.score && pp.score.score, flags: (pp.flags || []).map((x) => x.level + ": " + (x.words || "").slice(0, 160)), forward: pp.forward, analysts_verdict: pp.analysts && pp.analysts.verdict, dilution_d1_pct: pp.dilution && pp.dilution.d1_pct, liquidity_value: pp.liquidity && pp.liquidity.value } : null, channel: ch ? { low: ch.low, high: ch.high, read_at: ch.read.at, close_then: ch.price, set: ch.set } : null, read_utc: r && r.read_utc };
  if (!r) { out.none = "no run file"; return out; }
  if (!db.served) { out.none = "not served on the Hub: the name is in no cohort (ticker_cohorts), so the comps tab has nothing to open"; out.live = { error: r.live && r.live.error }; out.price = pp && pp.profile && fin(pp.profile.price) ? pp.profile.price : null; out.price_from = pp && pp.profile ? `the 13 Oct pre-profit page's copy of company_profile, stored ${pp.profile.stored_on}` : null; out.mcap = pp && pp.profile && fin(pp.profile.market_cap_m) ? pp.profile.market_cap_m * 1e6 : null; out.industry = pp && pp.profile ? pp.profile.industry : null; out.eps_ttm = null; out.pre_profit = !!(pp && /pre-/.test(pp.class)); out.pre_profit_why = out.pre_profit ? `the 13 Oct pre-profit page files it as ${pp.class} on the operating line` : null; out.sets = {}; out.flags = [{ code: "thin", words: "not served on the Hub: in no cohort, so no switch has a set and the live tab cannot open" }]; out.usable_n = 0; out.verdict = "broken"; out.sits = "unpriced"; out.analyst_distance_pct = fin(out.price) && db.analysts.n ? (db.analysts.median / out.price - 1) * 100 : null; return out; }
  const L = r.live || {}; out.live_error = L.error || null;
  const price = fin(L.price) ? L.price : (KEYS.map((k) => r.sets[k] && r.sets[k].snap && r.sets[k].snap.price).find(fin) ?? null);
  out.price = price;
  const sn = L.snap || (r.sets.TIGHTEST && r.sets.TIGHTEST.snap) || {};
  out.eps_ttm = fin(sn.eps_ttm) ? sn.eps_ttm : null; out.eps_date = sn.eps_date || null; out.mcap = fin(sn.mcap) ? sn.mcap : (db.profile && db.profile.market_cap) || null;
  out.industry = sn.industry || (db.profile && db.profile.industry) || null; out.sector = sn.sector || (db.profile && db.profile.sector) || null;
  out.pre_profit = (fin(out.eps_ttm) && out.eps_ttm <= 0) || !!(pp && /pre-/.test(pp.class));
  out.pre_profit_why = out.pre_profit ? [fin(out.eps_ttm) && out.eps_ttm <= 0 ? `trailing earnings per share ${out.eps_ttm.toFixed(2)} (to ${sn.eps_date || "—"})` : null, pp && /pre-/.test(pp.class) ? `the 13 Oct pre-profit page files it as ${pp.class} on the operating line` : null].filter(Boolean).join("; ") : null;
  /* the live tab */
  if (!L.error) {
    const rows = (L.rows || []).map((x) => ({ key: x.key, ok: !!x.ok, reason: x.reason || null, n: x.n, own: x.own && x.own.multiple, median: x.band && x.band.median, implied: x.ok && x.ends && x.ends.median ? x.ends.median.price : null, peers: (x.peers || []).map((p) => ({ ticker: p.ticker, multiple: p.multiple })), out: ((x.outliers && x.outliers.out) || []).map((o) => ({ ticker: o.ticker, side: o.side, multiple: o.multiple })), missing: x.missing || [] }));
    const wayC = (L.ways || []).find((w) => w.way === "C") || null;
    out.live = { pricedOn: L.c6 && L.c6.pricedOn, line: L.c6 && L.c6.business && L.c6.business.line, same: (L.c6 && L.c6.business && L.c6.business.same) || [], mostlyDifferent: !!(L.c6 && L.c6.business && L.c6.business.mostlyDifferent), kept: (L.kept || []).map((k) => ({ ticker: k.ticker, sim: k.sim, why: k.why, reference: !!k.reference, has_figures: k.has_figures, market_cap: k.market_cap, sources: k.sources || [] })), peersOn: L.peersOn || [], outliers: (L.c6 && L.c6.outliers) || [], band: L.band || null, upside: L.upside || null, reason: L.reason || null, ways: (L.ways || []).map((w) => ({ way: w.way, ok: w.ok, lo: w.lo, mid: w.mid, hi: w.hi })), weights: L.measureWeights && L.measureWeights.weights, rows, dates: sn.dates || null, peer_dates: sn.peer_dates || null, fwd: sn.fwd ? { through: sn.fwd.through, growth_pct: sn.fwd.growth_pct, quarters: (sn.fwd.quarters || []).map((q) => ({ fiscal_date: q.fiscal_date, eps: q.eps, analysts: q.analysts })) } : null, eps_fy1: sn.eps_fy1, fy1_date: sn.fy1_date, eps_fy2: sn.eps_fy2, table_company: sn.table && sn.table.company || null, table_peers_median: null };
    if (sn.table && sn.table.peers) { const on = out.live.peersOn.filter((t) => sn.table.peers[t]); out.live.table_peers_median = Object.fromEntries(["eps_g_fy", "rev_g_fy", "rev_g_ttm", "gm", "om", "fcfm", "nd_ebitda", "pe_fwd", "ev_sales", "capex_rev"].map((k) => [k, med(on.map((t) => sn.table.peers[t][k]))])); out.live.peers_mcap_median = med(out.live.peersOn.map((t) => { const k = (L.kept || []).find((x) => x.ticker === t); return k ? k.market_cap : null; })); }
  } else out.live = { error: L.error, text: L.text };
  /* the four switches */
  out.sets = {};
  for (const K of KEYS) {
    const s = r.sets[K]; if (!s || s.error) { out.sets[K] = { error: s ? s.error : "no read" }; continue; }
    const def = (s.sets || []).find((x) => x.key === K) || {};
    const peers = (s.members || []).filter((t) => t !== T);
    const inputs = Object.fromEntries((s.ctx.inputs || []).map((i) => [i.ticker, i]));
    const me = inputs[T] || {};
    const fellBack = K === "FMP" && !/FMP/.test(s.ctx.set_label || "");
    const rows = (s.C.rows || []).map((x) => ({ key: x.key, ok: !!x.ok, reason: x.reason || null, n: x.n, own: x.own && x.own.multiple, median: x.band && x.band.median, q1: x.band && x.band.q1, q3: x.band && x.band.q3, implied: x.ok && x.ends && x.ends.median ? x.ends.median.price : null, implied_q1: x.ok && x.ends && x.ends.q1 ? x.ends.q1.price : null, implied_q3: x.ok && x.ends && x.ends.q3 ? x.ends.q3.price : null, who: x.ends && x.ends.median ? x.ends.median.who : [], peers: (x.peers || []).map((p) => ({ ticker: p.ticker, multiple: p.multiple })), missing: x.missing || [] }));
    /* one peer moving the median: on each priced row, set aside the peer farthest from the median (log distance) and re-take the median */
    for (const row of rows) { row.swing = null; if (!row.ok || row.peers.length < 3) continue; const vals = row.peers.filter((p) => fin(p.multiple) && p.multiple > 0); if (vals.length < 3) continue; const m0 = med(vals.map((p) => p.multiple)); const far = vals.slice().sort((a, b) => Math.abs(Math.log(b.multiple / m0)) - Math.abs(Math.log(a.multiple / m0)))[0]; const m1 = med(vals.filter((p) => p !== far).map((p) => p.multiple)); if (fin(m0) && fin(m1) && m0 > 0) row.swing = { peer: far.ticker, multiple: far.multiple, median_before: m0, median_after: m1, pct: (m1 / m0 - 1) * 100 }; }
    const wayB = (s.C.ways || []).find((w) => w.way === "B") || null;
    const centres = (s.C.ways || []).filter((w) => w.ok).map((w) => w.mid);
    const peerRows = peers.map((t) => { const i = inputs[t] || null; const fwdRow = rows.find((x) => x.key === "pe_fwd"), ttmRow = rows.find((x) => x.key === "pe_ttm");
      const hasFwd = fwdRow ? fwdRow.peers.some((p) => p.ticker === t) : false, hasAny = rows.some((x) => x.peers.some((p) => p.ticker === t));
      const ratio = i && fin(i.mcap) && fin(me.mcap) && me.mcap > 0 ? i.mcap / me.mcap : null;
      const sameInd = i && i.industry && me.industry ? i.industry === me.industry : null;
      const sameBiz = out.live && !out.live.error ? out.live.same.includes(t) : null;
      const excluded = (s.ctx.excluded || []).find((e) => e.ticker === t);
      const why = []; if (excluded) why.push(excluded.why); if (!i) why.push("no figures on the Hub"); else { if (sameInd === false && sameBiz !== true) why.push(`different business (${i.industry || "industry unknown"})`); if (!hasAny) why.push("no multiple at all"); else if (!hasFwd) why.push("no forward estimate"); if (fin(ratio) && ratio < 0.1) why.push(`tiny (${(1 / ratio).toFixed(0)}× smaller)`); if (fin(ratio) && ratio > 10) why.push(`${ratio.toFixed(0)}× bigger`); if (FOREIGN(t) || (i.currency && i.currency !== "USD")) why.push("foreign filer" + (i.currency ? " (" + i.currency + ")" : "")); }
      return { ticker: t, name: i ? i.name : null, mcap: i ? i.mcap : null, ratio, industry: i ? i.industry : null, same_industry: sameInd, same_business: sameBiz, has_forward: hasFwd, has_any: hasAny, foreign: FOREIGN(t) || !!(i && i.currency && i.currency !== "USD"), belongs: why.length === 0, why }; });
    const withFigures = peerRows.filter((p) => p.has_any).length, sameShare = peerRows.length ? peerRows.filter((p) => p.same_industry === true || p.same_business === true).length / peerRows.length : 0;
    const pricedRows = rows.filter((x) => x.ok && (!out.pre_profit || !EARN.has(x.key)));
    const usable = !def.missing && !fellBack && withFigures >= 4 && sameShare >= 0.5 && pricedRows.length >= 2;
    const usable_why = def.missing ? "not on hand" : fellBack ? "the switch fell back to the home cohort" : withFigures < 4 ? `only ${withFigures} peer${withFigures === 1 ? "" : "s"} with figures` : sameShare < 0.5 ? `only ${Math.round(sameShare * 100)}% of the peers share its business` : pricedRows.length < 2 ? "fewer than two rows can be priced" : "usable";
    out.sets[K] = { label: s.ctx.set_label, source: def.source || null, missing: def.missing || null, fell_back: fellBack, fmp_all: def.all_peers || null, fmp_off_hub: def.off_hub || null, fmp_fetched: def.fetched_at || null, n_peers: peers.length, peers: peerRows, excluded: s.ctx.excluded || [], rows, band: wayB && wayB.ok ? { lo: wayB.lo, mid: wayB.mid, hi: wayB.hi } : null, ways: (s.C.ways || []).map((w) => ({ way: w.way, ok: w.ok, lo: w.lo, mid: w.mid, hi: w.hi, reason: w.reason })), ways_spread_pct: centres.length > 1 ? (Math.max(...centres) / Math.min(...centres) - 1) * 100 : null, disagreement: s.C.disagreement && s.C.disagreement.words, reason: s.C.reason || null, table_company: s.snap.table && s.snap.table.company || null, table_peers_median: s.snap.table && s.snap.table.peers ? Object.fromEntries(["eps_g_fy", "rev_g_fy", "rev_g_ttm", "gm", "om", "fcfm", "nd_ebitda", "pe_fwd", "ev_sales", "capex_rev"].map((k) => [k, med(peers.map((t) => s.snap.table.peers[t] ? s.snap.table.peers[t][k] : null))])) : null, peers_mcap_median: med(peerRows.map((p) => p.mcap)), with_figures: withFigures, same_share: sameShare, usable, usable_why,
      /* the centre this page uses for the switch: profitable names → the tab's way B centre; pre-profit → the EV/sales row's median-implied price (PP1's measure) */
      centre: out.pre_profit ? ((rows.find((x) => x.key === "ev_sales") || {}).implied ?? null) : (wayB && wayB.ok ? wayB.mid : null), centre_basis: out.pre_profit ? "EV/sales row (the pre-profit page's measure: P/E and PEG are meaningless on a loss)" : "way B, the middle-half band across the six rows" };
  }
  /* the comps midpoint and the distance */
  const centres = KEYS.map((K) => out.sets[K] && fin(out.sets[K].centre) && !out.sets[K].missing ? out.sets[K].centre : null).filter(fin);
  out.centres = Object.fromEntries(KEYS.map((K) => [K, out.sets[K] ? out.sets[K].centre ?? null : null]));
  out.midpoint = med(centres); out.midpoint_n = centres.length;
  out.distance_pct = fin(price) && fin(out.midpoint) && out.midpoint > 0 ? (price / out.midpoint - 1) * 100 : null;
  out.switch_spread_pct = centres.length > 1 ? (Math.max(...centres) / Math.min(...centres) - 1) * 100 : null;
  out.live_centre = out.live && !out.live.error && out.live.band ? (out.pre_profit ? ((out.live.rows.find((x) => x.key === "ev_sales") || {}).implied ?? null) : out.live.band.mid) : null;
  out.live_distance_pct = fin(price) && fin(out.live_centre) && out.live_centre > 0 ? (price / out.live_centre - 1) * 100 : null;
  out.usable_n = KEYS.filter((K) => out.sets[K] && out.sets[K].usable).length;
  out.verdict = out.usable_n >= 2 && (!fin(out.switch_spread_pct) || out.switch_spread_pct <= 40) ? "sound" : out.usable_n >= 1 ? "shaky" : "broken";
  out.sits = !fin(out.distance_pct) ? "unpriced" : out.distance_pct <= -15 ? "cheap" : out.distance_pct >= 15 ? "rich" : "fair";
  /* the analyst and channel distances */
  out.analyst_distance_pct = fin(price) && db.analysts.n ? (db.analysts.median / price - 1) * 100 : null;
  if (ch && fin(price)) { out.channel.pos_now = (price - ch.low) / (ch.high - ch.low) * 100; out.channel.up_now = (ch.high / price - 1) * 100; out.channel.down_now = (ch.low / price - 1) * 100; }
  /* the method-break flags, measured */
  const F = []; const add = (code, words, data) => F.push({ code, words, ...(data || {}) });
  for (const K of KEYS) { const s = out.sets[K]; if (!s || s.error) continue;
    if (s.missing) add("thin", `${KW[K]}: not on hand`);
    else if (s.fell_back) add("fallback", `${KW[K]}: FMP's ${(s.fmp_all || []).length} peers are not served, so the switch silently showed the home cohort (${s.label})`);
    else if (s.n_peers < 4 || s.with_figures < 4) add("thin", `${KW[K]}: ${s.n_peers} peer${s.n_peers === 1 ? "" : "s"}, ${s.with_figures} with figures${s.reason ? " — " + s.reason : ""}`);
    for (const row of s.rows) if (row.swing && Math.abs(row.swing.pct) >= 15 && !(out.pre_profit && EARN.has(row.key))) add("outlier", `${KW[K]} · ${RW[row.key]}: set ${row.swing.peer} (${X(row.swing.multiple)}) aside and the median moves ${SG(row.swing.pct)} (${X(row.swing.median_before)} → ${X(row.swing.median_after)}) — ${row.n} peers on the row`);
    const foreign = s.peers.filter((p) => p.foreign && p.has_any).map((p) => p.ticker); if (foreign.length && !s.missing) add("foreign", `${KW[K]}: ${foreign.join(", ")} priced through the stand-in exchange rates`);
    if (!s.missing && fin(s.ways_spread_pct) && s.ways_spread_pct > 40) add("ways", `${KW[K]}: the tab's own four ways disagree by ${s.ways_spread_pct.toFixed(0)}% (${s.disagreement})`);
  }
  if (out.live && !out.live.error) { const lf = out.live.peersOn.filter(FOREIGN); if (lf.length) add("foreign", `the live tab: ${lf.join(", ")} price it (reference peers from a dated facts file)`); if (out.live.mostlyDifferent) add("business", `the live tab: ${out.live.same.length} of ${out.live.kept.length} share its business (${out.live.line}); the rest are shown and left out`); if (out.live.peersOn.length < 4) add("thin", `the live tab: only ${out.live.peersOn.length} peer${out.live.peersOn.length === 1 ? "" : "s"} price it`);
    const pd = out.live.peer_dates || {}; const stale = Object.entries(pd).filter(([t, d]) => d && d.fundamentals && daysOld(d.fundamentals) > 60).map(([t, d]) => `${t} ${daysOld(d.fundamentals)} d`); if (stale.length) add("stale", `figures older than 60 days: ${stale.join(", ")}`); const noEst = Object.entries(pd).filter(([t, d]) => d && !d.estimate_fy).map(([t]) => t); if (noEst.length) add("stale", `no forward estimate on file: ${noEst.join(", ")}`); }
  if (out.pre_profit) add("preprofit", `${out.pre_profit_why}: the P/E and PEG rows are meaningless, yet the four-switch tab still prints a centre (${KEYS.map((K) => out.sets[K] && out.sets[K].band ? KW[K] + " " + $(out.sets[K].band.mid) : null).filter(Boolean).join(", ") || "none"})`);
  if (fin(out.switch_spread_pct) && out.switch_spread_pct > 40) add("switches", `the four switches' centres sit ${out.switch_spread_pct.toFixed(0)}% apart (${KEYS.map((K) => fin(out.centres[K]) ? KW[K] + " " + $(out.centres[K]) : null).filter(Boolean).join(" · ")})`);
  if (fin(out.live_centre) && fin(out.midpoint) && Math.abs(out.live_centre / out.midpoint - 1) > 0.4) add("live-vs-switches", `the live tab's centre ${$(out.live_centre)} is ${SG((out.live_centre / out.midpoint - 1) * 100)} from the four-switch midpoint ${$(out.midpoint)}`);
  out.flags = F;
  return out;
}

const names = RADAR.map(analyse);
const ranked = names.filter((n) => fin(n.distance_pct)).sort((a, b) => a.distance_pct - b.distance_pct), unranked = names.filter((n) => !fin(n.distance_pct));
const counts = { usable_by_switch: Object.fromEntries(KEYS.map((K) => [K, names.filter((n) => n.sets && n.sets[K] && n.sets[K].usable).length])), ran: names.filter((n) => !n.none).length, pre_profit: names.filter((n) => n.pre_profit).length, disagree40: names.filter((n) => fin(n.switch_spread_pct) && n.switch_spread_pct > 40).length, with_channel: names.filter((n) => n.channel).length, with_analysts: names.filter((n) => n.db.analysts.n).length };
/* where the method breaks: grouped by failure type with the names and the fix to the machine */
const BREAKS = [
  { code: "preprofit", title: "A loss-maker gets a P/E price", fix: "Gate the earnings rows on the sign of the figure: when trailing EPS ≤ 0, or forward EPS ≤ 0, the P/E and PEG rows print \"not meaningful\" and leave the band; the band is then EV/sales and EV/EBITDA only, labelled as such, with the pre-profit page's cash runway beside it." },
  { code: "thin", title: "Thin peer sets still print a range", fix: "A switch with fewer than four peers carrying figures is shown greyed with its count and no band; the tightest-tag rule should count served names with figures, not tag members, and skip a tag that leaves fewer than four." },
  { code: "fallback", title: "The FMP switch silently shows the home cohort", fix: "When none of FMP's peers is served, the switch says \"FMP peers: none served (8 names off the Hub)\" and cannot be chosen, instead of reading the home cohort under the FMP label." },
  { code: "outlier", title: "One peer moves a row's median by 15% or more", fix: "Print the swing on the row (median with and without the farthest peer) and, on rows with five peers or fewer, use the trimmed mean of the middle half rather than the median; the two-sided outlier rule stays off for the price, as Alan chose on 7 Oct." },
  { code: "switches", title: "The four switches disagree by more than 40%", fix: "Show the four centres on one line under the band (the C3b tab already computes them in the background) and refuse a single \"upside\" number when they sit more than 40% apart; the summary carries the spread, not the centre." },
  { code: "live-vs-switches", title: "The live tab and the four switches disagree by more than 40%", fix: "The live tab prices on the business lines it finds, the switches on tags and lists; when they disagree this far the page should say which peers differ (the live tab's same-business list against the tag) rather than show two numbers." },
  { code: "business", title: "The tag is not the business", fix: "Score each switch set on the live tab's business similarity and print the share of peers that share the name's lines; when under half do, the switch is marked \"mostly different business\" like the live tab does." },
  { code: "foreign", title: "Foreign peers' multiples ride on a stand-in exchange rate and a dated facts file", fix: "Carry the rate's date and the facts' date on the row and age them like the estimates; a foreign peer whose facts are older than a quarter drops out of the median." },
  { code: "stale", title: "Stale or missing estimates sit in the medians", fix: "Date every peer's figures on the row; a peer with fundamentals older than 60 days or no forward estimate is greyed and left out of the forward rows until refreshed." },
  { code: "ways", title: "The tab's own four ways disagree by more than 40% on one switch", fix: "When A, B, C-equal and C-weighted sit more than 40% apart the band is drawn as the envelope of the four and the centre is withheld." },
].map((b) => ({ ...b, hits: names.filter((n) => (n.flags || []).some((f) => f.code === b.code)).map((n) => ({ ticker: n.ticker, lines: n.flags.filter((f) => f.code === b.code).map((f) => f.words) })) }));
const data = { what: "CW2 · the RADAR list through the Hub's comps machine (15 Oct 2026): the live COMPS tab (C5/C6) and the four-switch tab (C3b) run headless on a local serve of hub/release-20260923 @7b66061 against the live database; the analyst targets, the channel rails (10 Oct) and PP1's pre-profit measures beside them. Nothing recomputed; nothing written.", built_utc: new Date().toISOString(), today: TODAY, run: RUN, db_read_utc: DB.read_utc, hub_commit: "7b66061", channel_asof: CH.asof, pp1_built: PP.meta && PP.meta.built_utc, rules: { sits: "cheap ≤ −15% from the four-switch midpoint, rich ≥ +15%, fair between", midpoint: "the median of the four switches' centres (way B); pre-profit names: the EV/sales row's implied price per switch", usable: "a switch is usable when it is on hand, did not fall back, has at least four peers with figures, at least half of them share the name's industry or (per the live tab) its business, and at least two rows can be priced", verdict: "sound = two or more usable switches and the switches within 40%; shaky = one usable switch, or a spread over 40%; broken = none usable", swing: "on each row, the peer farthest from the median (in log distance) is set aside and the median re-taken; a move of 15% or more is flagged" }, counts, ranked: ranked.map((n) => n.ticker), unranked: unranked.map((n) => ({ ticker: n.ticker, why: n.none || (n.pre_profit ? "no EV/sales price on any switch" : "no centre") })), breaks: BREAKS, names };
fs.writeFileSync(path.join(OUT, "RADAR-COMPS.json"), JSON.stringify(data, null, 1));
/* the raw reads beside the page, trimmed of the tab text and the peers' full tables */
for (const T of RADAR) { const f = path.join(S, "runs/radar", T + ".json"); if (!fs.existsSync(f)) continue; const r = J(f); if (r.live) { delete r.live.text; } for (const K of KEYS) if (r.sets && r.sets[K]) { delete r.sets[K].text; } fs.writeFileSync(path.join(OUT, "reads", T + ".json"), JSON.stringify(r)); }
fs.copyFileSync(path.join(S, "runs/radar/_run.json"), path.join(OUT, "reads/_run.json"));
console.log(JSON.stringify({ names: names.length, ranked: ranked.length, counts, verdicts: Object.fromEntries(names.map((n) => [n.ticker, [n.sits, n.verdict, fin(n.distance_pct) ? n.distance_pct.toFixed(0) : "—", n.flags ? n.flags.length : "-"].join("/")])) }, null, 1));
export { data };

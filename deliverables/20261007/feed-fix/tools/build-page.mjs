/* FD1 · the page for Alan: FEED-FIX.html, built from the data files beside it. No network, no key.
     node build-page.mjs
   Pictures first; every explaining sentence sits in PAGE SPECS at the bottom. Charts are plain HTML (rows, tracks and
   dots placed by percentage) so their text is the page's own text at every width — a scaled drawing shrank its
   letters to 4.5px on a phone once. One hue, two shades (the before / after pair passes the dataviz ordinal check on
   this panel: #8c8c92 5.6:1, #c8c8cc), and before / after also differ in shape: a ring and a dot. */
import { readFileSync, writeFileSync, existsSync } from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, ".."), WT = path.resolve(HERE, "../../../..");
const J = (p) => JSON.parse(readFileSync(p, "utf8"));
const KO = J(ROOT + "/data/knockout-feed-before-after.json"), RR = J(ROOT + "/data/comps-rerun-26.json"), RV = J(ROOT + "/data/revisions-26.json"), MV = J(ROOT + "/data/market-value-scan.json");
const FX = J(WT + "/tests/fixtures/fd1-comps-feed-20261007.json"), EC = J(WT + "/tests/fixtures/fd1-estimate-copies-20261007.json");
const NAME = { MU: "Micron", SNDK: "SanDisk", WDC: "Western Digital", STX: "Seagate", NVDA: "Nvidia", AVGO: "Broadcom", GOOGL: "Alphabet", AMZN: "Amazon", ORCL: "Oracle", VST: "Vistra", CEG: "Constellation", BE: "Bloom", NBIS: "Nebius", IREN: "IREN", CRWV: "CoreWeave", EQIX: "Equinix", DLR: "Digital Realty", IRM: "Iron Mountain", LRCX: "Lam", AMAT: "Applied", LLY: "Lilly", JPM: "JPMorgan", BAC: "Bank of America", CRDO: "Credo", COHR: "Coherent", AME: "Ametek", ABBV: "AbbVie", PFE: "Pfizer", MRK: "Merck", BMY: "Bristol", BIIB: "Biogen", JNJ: "J&J", AMGN: "Amgen", VRTX: "Vertex", REGN: "Regeneron", ARGX: "argenx", GILD: "Gilead", MRNA: "Moderna", COST: "Costco", CSCO: "Cisco", LITE: "Lumentum" };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const sgn = (v, d = 0) => (v == null || !Number.isFinite(v) ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(d) + "%");
const pct = (f, d = 0) => (f == null ? "—" : sgn(f * 100, d)), x1 = (v, d = 1) => (v == null || !Number.isFinite(v) ? "—" : (v < 0 ? "−" : "") + Math.abs(v).toFixed(d) + "×"), num = (v, d = 0) => (v == null ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }));
const up = (x) => (x && x.no_peer_set ? "no peer set" : x && x.upside_pct != null ? sgn(x.upside_pct, 0) : "—");
const day = (iso) => { const d = new Date(String(iso).slice(0, 10) + "T12:00:00Z"); return d.getUTCDate() + " " + d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }); };
const B = KO.before, A = KO.after;
/* the minute the live tool was read, in New York time (7 Oct is daylight time: UTC − 4) */
const ET = (iso) => { const d = new Date(Date.parse(iso) - 4 * 3600e3); return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0") + " ET"; }, TAKEN = ET(B.taken_utc);
const entrants = (R) => { const d = {}; for (const l of R.lines) for (const e of [...l.entrants, ...l.sitOut]) d[e.sym] = { ...e, champion: l.champion === e.sym, line: l.line }; return d; };
const EB = entrants(B), EA = entrants(A);

/* ---- chart pieces ------------------------------------------------------------------------------------ */
const pos = (v, lo, hi) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
function axis(ticks, lo, hi, fmt, thin = "") { return `<div class="ax"><span></span><div class="ax-t${thin ? " thin-" + thin : ""}">${ticks.map((t) => `<i style="left:${pos(t, lo, hi).toFixed(2)}%">${esc(fmt(t))}</i>`).join("")}</div><span></span></div>`; }
const grid = (ticks, lo, hi, zero = null) => ticks.map((t) => `<i class="gl${t === zero ? " z" : ""}" style="left:${pos(t, lo, hi).toFixed(2)}%"></i>`).join("");
/** One before → after row. marks: [{ v, cls }] left to right in time. */
function dbRow(label, sub, marks, lo, hi, ticks, zero, valueHtml, tip, cls = "") {
  const vs = marks.filter((m) => m.v != null && Number.isFinite(m.v)), ps = vs.map((m) => pos(m.v, lo, hi)), a = Math.min(...ps), z = Math.max(...ps);
  const link = vs.length > 1 && z > a ? `<i class="lk" style="left:${a.toFixed(2)}%;width:${(z - a).toFixed(2)}%"></i>` : "";
  return `<div class="row ${cls}" tabindex="0" data-tip="${esc(tip)}"><div class="nm"><b>${esc(label)}</b>${sub ? `<span>${esc(sub)}</span>` : ""}</div><div class="tr">${grid(ticks, lo, hi, zero)}${link}${vs.map((m) => `<i class="dot ${m.cls}" style="left:${pos(m.v, lo, hi).toFixed(2)}%"></i>`).join("")}</div><div class="vl">${valueHtml}</div></div>`;
}
const legend = (items) => `<div class="lg">${items.map(([cls, word]) => `<span><i class="dot ${cls}"></i>${esc(word)}</span>`).join("")}</div>`;
const tile = (label, before, after, note = "") => `<div class="tile"><div class="tl">${esc(label)}</div><div class="tv"><span class="was">${esc(before)}</span><span class="arr">→</span><b>${esc(after)}</b></div>${note ? `<div class="tn">${esc(note)}</div>` : ""}</div>`;
const fact = (label, value, note = "") => `<div class="tile"><div class="tl">${esc(label)}</div><div class="tv"><b>${esc(value)}</b></div>${note ? `<div class="tn">${esc(note)}</div>` : ""}</div>`;

/* ---- 1 · the feed ------------------------------------------------------------------------------------- */
const G = { lo: -100, hi: 520, ticks: [-100, 0, 100, 200, 300, 400, 500] }, S = { lo: 0, hi: 1, ticks: [0, 0.25, 0.5, 0.75, 1] };
const growthRows = KO.eighteen.map((t) => { const b = B.figures[t], a = A.figures[t], gb = b && b.rev_growth != null ? b.rev_growth * 100 : null, ga = a && a.rev_growth != null ? a.rev_growth * 100 : null;
  return dbRow(t, NAME[t], [{ v: gb, cls: "was" }, { v: ga, cls: "now" }], G.lo, G.hi, G.ticks, 0, `<span class="was">${sgn(gb)}</span><span class="arr">→</span><b>${sgn(ga)}</b>`, `${NAME[t] || t} · sales, a year on a year · the tool was told ${sgn(gb)} · the rows say ${sgn(ga)}`); }).join("");
const scoreRows = KO.eighteen.map((t) => { const b = EB[t], a = EA[t], sb = b ? b.score : null, sa = a ? a.score : null;
  return dbRow(t, a && a.champion ? "goes through" : a || b ? "" : "not a candidate", [{ v: sb, cls: "was" }, { v: sa, cls: "now" }], S.lo, S.hi, S.ticks, null, sb == null && sa == null ? `<span class="was">—</span>` : `<span class="was">${sb == null ? "—" : sb.toFixed(2)}</span><span class="arr">→</span><b>${sa == null ? "—" : sa.toFixed(2)}</b>`, `${NAME[t] || t} · fundamentals score in ${(a || b || {}).line || "no line"} · ${sb == null ? "—" : sb.toFixed(2)} on the live feed · ${sa == null ? "—" : sa.toFixed(2)} on the fixed feed${a && a.champion ? " · its line's champion" : ""}`); }).join("");
const cardRows = KO.cards.map((t) => { const b = B.figures[t] || {}, a = A.figures[t] || {}, sb = EB[t], sa = EA[t];
  return `<tr><td><b>${t}</b> <span class="dim">${esc(NAME[t] || "")}</span></td><td><span class="was">${pct(b.rev_growth)}</span> → ${pct(a.rev_growth)}</td><td><span class="was">${x1(b.fwd_pe)}</span> → ${x1(a.fwd_pe)}</td><td><span class="was">${x1(b.pe)}</span> → ${x1(a.pe)}</td><td><span class="was">${x1(b.ps)}</span> → ${x1(a.ps)}</td><td><span class="was">${pct(b.net_m)}</span> → ${pct(a.net_m)}</td><td>${sb || sa ? `<span class="was">${sb ? sb.score.toFixed(2) : "—"}</span> → ${sa ? sa.score.toFixed(2) : "—"}` : `<span class="dim">not in the eighteen</span>`}</td></tr>`; }).join("");
const mu = (p, d) => FX.tables.history.find((r) => r.ticker === "MU" && r.period === p && r.fiscal_date === d).revenue;
const q4 = mu("Q4", "2026-09-03"), fy26 = mu("FY", "2026-09-03"), fy25 = mu("FY", "2025-08-28"), bn = (v) => (v / 1e9).toFixed(1) + "bn";
const muEst = FX.v5.micron_estimates_as_v5_read_them, firstQ = muEst.find((r) => r.fiscal_date > FX.today && r.est_eps_avg != null), firstY = muEst.find((r) => r.period === "annual" && r.fiscal_date >= FX.today);
const muF = FX.tables.fundamentals.find((r) => r.ticker === "MU"), muP = FX.tables.profiles.find((r) => r.ticker === "MU");
const champions = (R) => R.lines.filter((l) => l.champion).map((l) => l.champion);
const podium = (R) => R.podium.map((p) => `${p.sym} ${p.score.toFixed(2)}`).join(" · ");

/* ---- 2 · the year join ------------------------------------------------------------------------------- */
const muRows = EC.rows.MU, fy27 = EC.forecast_years.MU[0], near = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) <= 45 * 86400e3;
const copies = [...new Set(muRows.map((r) => r.as_of_date))].sort().map((d) => muRows.filter((r) => r.as_of_date === d && near(r.fiscal_date, fy27)).sort((a, b) => Math.abs(Date.parse(a.fiscal_date) - Date.parse(fy27)) - Math.abs(Date.parse(b.fiscal_date) - Date.parse(fy27)))[0]).filter(Boolean);
const cLo = 145, cHi = 180, copyDots = copies.map((c, i) => { const x = (i + 0.5) / copies.length * 100, y = (c.eps_avg - cLo) / (cHi - cLo) * 100, old = c.fiscal_date !== fy27; return { x, y, c, old }; });
const copyFig = `<div class="cp"><svg class="cp-l" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="${copyDots.map((d) => `${d.x.toFixed(2)},${(100 - d.y).toFixed(2)}`).join(" ")}"/></svg>${copyDots.map((d) => `<i class="dot ${d.old ? "was" : "now"}" style="left:${d.x.toFixed(2)}%;bottom:${d.y.toFixed(2)}%"></i><span class="cp-v" style="left:${d.x.toFixed(2)}%;bottom:calc(${d.y.toFixed(2)}% + 12px)">$${d.c.eps_avg.toFixed(2)}</span>`).join("")}</div><div class="cp-x">${copyDots.map((d) => `<div tabindex="0" data-tip="${esc(`copy of ${day(d.c.as_of_date)} · Micron's fiscal 2027 EPS estimate $${d.c.eps_avg.toFixed(2)} · stored under the date ${day(d.c.fiscal_date)} 2027`)}"><b>${day(d.c.as_of_date)}</b><span>under ${day(d.c.fiscal_date)}</span></div>`).join("")}</div>`;
const revRow = (t) => ["fy1", "fy2"].filter((k) => RV.names[t].years[k]).map((k, i) => { const y = RV.names[t].years[k], f = (x) => (x ? `${sgn(x.pct, 1)} <span class="dim">· ${x.copies} copies since ${day(x.from)}</span>` : "—");
  return `<tr${i ? ' class="own"' : ""}><td>${i ? "" : `<b>${t}</b> <span class="dim">${esc(NAME[t] || "")}</span>`}</td><td>FY+${i + 1}</td><td>${y.keys.map((d) => day(d)).join(" → ")}</td><td><span class="was">${f(y.eps.on_the_date)}</span></td><td>${f(y.eps.on_the_fiscal_year)}</td></tr>`; }).join("");
const unmoved = KO.cards.filter((t) => !RV.names[t].key_moved).length;

/* ---- 3 · the memory names ---------------------------------------------------------------------------- */
const MEM = ["MU", "SNDK", "WDC", "STX"], M = RR.names.MU, mv = M.cp1_mv, st = M.cp1;
const P = { lo: 0, hi: 6600, ticks: [0, 1000, 2000, 3000, 4000, 5000, 6000] }, KEYW = { pe_ttm: "P/E trailing", pe_fwd: "P/E forward", ev_ebitda: "EV/EBITDA", peg: "PEG", ev_sales: "EV/sales", ps: "P/S" };
const seat = (t, label, sub) => { const pts = mv.points.filter((p) => p.peer === t), pp = mv.per_peer[t];
  const marks = `<i class="mk px" style="left:${pos(mv.price, P.lo, P.hi).toFixed(2)}%"></i><i class="mk ct" style="left:${pos(mv.band.centre, P.lo, P.hi).toFixed(2)}%"></i>`;
  if (!pts.length) return `<div class="row seat empty"><div class="nm"><b>${esc(label)}</b><span>${esc(sub)}</span></div><div class="tr">${grid(P.ticks, P.lo, P.hi)}${marks}<em>no figures yet</em></div><div class="vl"><span class="was">—</span></div></div>`;
  return `<div class="row seat" tabindex="0" data-tip="${esc(`${label} · what Micron would be worth on each of its multiples: ${pts.map((p) => `${KEYW[p.key]} ${p.multiple}× → $${num(p.price)} (${sgn(p.upside_pct)})`).join(" · ")} · on ${label} alone: $${num(pp.centre)} (${sgn(pp.upside_pct)})`)}"><div class="nm"><b>${esc(label)}</b><span>${esc(sub)}</span></div><div class="tr">${grid(P.ticks, P.lo, P.hi)}${marks}${pts.map((p) => `<i class="dot now" style="left:${pos(p.price, P.lo, P.hi).toFixed(2)}%"></i>`).join("")}<i class="dot alt" style="left:${pos(pp.centre, P.lo, P.hi).toFixed(2)}%"></i></div><div class="vl">alone <b>${sgn(pp.upside_pct)}</b></div></div>`; };
const memRows = MEM.map((t) => { const n = RR.names[t]; return `<tr><td><b>${t}</b> <span class="dim">${esc(NAME[t])}</span></td><td>${num(n.cp1.price, 2)}</td><td><span class="was">${up(n.before)}</span></td><td>${up(n.cp1)} <span class="dim">${n.cp1.band ? num(n.cp1.band.centre) : ""}</span></td><td><b>${up(n.cp1_mv)}</b> <span class="dim">${n.cp1_mv.band ? num(n.cp1_mv.band.centre) : ""}</span></td><td class="dim">${Math.round((n.market_value.stored_over_today - 1) * 100) > 0 ? "+" : "−"}${Math.abs(Math.round((n.market_value.stored_over_today - 1) * 100))}%</td><td>${(n.cp1_mv.business_peers || []).join(" ")} <span class="dim">· SK hynix, Samsung, Kioxia: no figures</span></td></tr>`; }).join("");
const KEYS = ["pe_ttm", "pe_fwd", "ev_ebitda", "ev_sales", "ps", "peg"];
const multRow = (t, src, cls = "") => `<tr class="${cls}"><td><b>${t}</b> <span class="dim">${esc(NAME[t] || "")}</span></td>${KEYS.map((k) => `<td>${src && src[k] != null ? (k === "peg" ? src[k].toFixed(2) : x1(src[k])) : "—"}</td>`).join("")}</tr>`;
const blankRow = (label) => `<tr><td><b>${esc(label)}</b></td>${KEYS.map(() => `<td class="dim">—</td>`).join("")}</tr>`;
const mvRows = KO.cards.map((t) => { const n = RR.names[t]; return `<tr><td><b>${t}</b> <span class="dim">${esc(NAME[t] || "")}</span></td><td class="dim">${Math.round((n.market_value.stored_over_today - 1) * 100) >= 0 ? "+" : "−"}${Math.abs(Math.round((n.market_value.stored_over_today - 1) * 100))}%</td><td><span class="was">${up(n.before)}</span> → ${up(n.before_mv)}</td><td><span class="was">${up(n.cp1)}</span> → <b>${up(n.cp1_mv)}</b></td></tr>`; }).join("");

/* ---- 4 · growth --------------------------------------------------------------------------------------- */
const L = RR.names.LLY, V = RR.names.VST, GR = { lo: -20, hi: 100, ticks: [-20, 0, 20, 40, 60, 80, 100] };
const peers = ["LLY", ...Object.keys(L.cp1.growth).filter((t) => t !== "LLY")].filter((t) => { const g = L.cp1.growth[t]; return g.trailing != null || g.forecast != null || g.last_year != null; });
const grRows = peers.map((t) => { const g = L.cp1.growth[t];
  return dbRow(t, NAME[t], [{ v: g.trailing, cls: "was" }, { v: g.forecast, cls: "now" }, { v: g.last_year, cls: "alt" }].sort((a, b) => (a.cls === "alt") - (b.cls === "alt")), GR.lo, GR.hi, GR.ticks, 0, `<span class="was">${g.trailing == null ? "—" : sgn(g.trailing)}</span><span class="arr">→</span><b>${g.forecast == null ? "—" : sgn(g.forecast)}</b><span class="alt">${g.last_year == null ? "" : " · " + sgn(g.last_year)}</span>`, `${NAME[t] || t} · EPS growth a year · from reported earnings ${g.trailing == null ? "—" : sgn(g.trailing)} (${g.trailing_basis || "no figure"}) · from one forecast year to the next ${g.forecast == null ? "—" : sgn(g.forecast)} (${g.forecast_basis || "no figure"}) · from the year just reported ${g.last_year == null ? "—" : sgn(g.last_year)}`, t === "LLY" ? "self" : ""); }).join("");
const cr = (c) => (c ? `${c.own}% against ${c.peers == null ? "—" : c.peers + "%"} · ×${c.credit}` : "—");
const g2 = (n, t) => `<tr><td><b>${t}</b> <span class="dim">${esc(NAME[t])}</span></td><td><span class="was">${up(n.cp1)}</span><div class="dim">${cr(n.cp1.growth_credit)}</div></td><td><b>${up(n.fd1)}</b><div class="dim">${cr(n.fd1.growth_credit)}</div></td><td>${up(n.last)}<div class="dim">${cr(n.last.growth_credit)}</div></td></tr>`;
const allG = KO.cards.map((t) => { const n = RR.names[t]; return `<tr><td><b>${t}</b> <span class="dim">${esc(NAME[t] || "")}</span></td><td><span class="was">${up(n.cp1)}</span></td><td>${up(n.fd1)}</td><td>${up(n.last)}</td><td class="dim">${n.cp1.growth[t] ? `${n.cp1.growth[t].trailing ?? "—"} · ${n.cp1.growth[t].forecast ?? "—"} · ${n.cp1.growth[t].last_year ?? "—"}` : "—"}</td></tr>`; }).join("");

/* ---- the page ------------------------------------------------------------------------------------------ */
const css = `:root{color-scheme:dark}*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:#0a0a0c;color:#c8c8cc;font:12px/1.5 ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace;-webkit-font-smoothing:antialiased;padding:0 24px 60px}
header.top{padding:16px 0 18px;border-bottom:1px solid #26262b;margin-bottom:8px}header.top .scnav{margin-bottom:16px}
.ttl{font-size:24px;letter-spacing:.24em;color:#c8c8cc;font-weight:700}.sub{color:#8c8c92;font-size:11px;letter-spacing:.06em;margin:6px 0 0}
h2{font-size:12px;letter-spacing:.22em;font-weight:700;color:#c8c8cc;margin:34px 0 12px;padding-top:14px;border-top:1px solid #26262b}
.dim{color:#8c8c92}.was{color:#8c8c92}.arr{color:#5a5a60;margin:0 5px}.alt{color:#8c8c92}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,520px),1fr));gap:14px;align-items:start;margin-top:14px}.grid2>*{min-width:0}
.panel{background:#111114;border:1px solid #26262b;border-radius:6px;padding:14px 16px;min-width:0;margin-bottom:14px}.grid2>.panel{margin-bottom:0}
.ph{font-size:11px;letter-spacing:.18em;color:#8c8c92;font-weight:700;margin-bottom:10px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}
.tile{background:#111114;border:1px solid #26262b;border-radius:6px;padding:12px 14px;min-width:0}
.tl{font-size:11px;letter-spacing:.08em;color:#8c8c92}.tv{font:600 20px/1.3 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;margin-top:4px;color:#c8c8cc}.tv .was{font-weight:400}.tv b{font-weight:600}.tn{font-size:11px;color:#8c8c92;margin-top:4px}
.lg{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:11px;color:#8c8c92;margin:0 0 8px}.lg span{display:inline-flex;align-items:center;gap:8px}.lg .dot{position:static;transform:none;flex:none}.lg .dot.alt{transform:rotate(45deg)}.lg .mk{position:static;display:inline-block;height:12px;flex:none}
.ch .row,.ch .ax{display:grid;grid-template-columns:var(--c1,116px) minmax(0,1fr) var(--c3,122px);column-gap:10px;align-items:center}
.ch.seats{--c1:150px;--c3:96px}.ch.g3{--c3:150px}
.ch .row{min-height:28px;border-bottom:1px solid #1a1a1e;outline:none}.ch .row:hover,.ch .row:focus-visible{background:#17171b}
.ch .row.self{border-bottom:1px solid #5a5a60}
.nm{min-width:0;line-height:1.2}.nm b{display:block;font-size:12px}.nm span{display:block;font-size:11px;color:#8c8c92;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tr{position:relative;height:28px;min-width:0}
.gl{position:absolute;top:0;bottom:0;width:1px;background:#1e1e23}.gl.z{background:#3a3a40}
.lk{position:absolute;top:13px;height:2px;background:#5a5a60;border-radius:1px}
.dot{position:absolute;top:50%;width:10px;height:10px;border-radius:50%;transform:translate(-50%,-50%)}
.dot.now{background:#c8c8cc;box-shadow:0 0 0 2px #111114}.dot.was{background:#111114;border:2px solid #8c8c92}.dot.alt{background:#8c8c92;border-radius:1px;width:8px;height:8px;transform:translate(-50%,-50%) rotate(45deg);box-shadow:0 0 0 2px #111114}
.vl{font-size:12px;white-space:nowrap;text-align:right;font-variant-numeric:tabular-nums;min-width:0;overflow:hidden;text-overflow:ellipsis}
.ax{height:20px;margin-bottom:2px}.ax-t{position:relative;height:20px}.ax-t i{position:absolute;top:2px;transform:translateX(-50%);font-style:normal;font-size:11px;color:#5a5a60;white-space:nowrap}
.mk{position:absolute;top:0;bottom:0;width:2px}.mk.px{background:#8c8c92}.mk.ct{background:#c8c8cc}
.seat.empty .tr em{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-style:normal;font-size:11px;letter-spacing:.14em;color:#5a5a60;background:#111114;padding:0 8px;white-space:nowrap}
.cp{position:relative;height:120px;margin:22px 0 0;border-bottom:1px solid #26262b}.cp-l{position:absolute;inset:0;width:100%;height:100%;overflow:visible}.cp-l polyline{fill:none;stroke:#5a5a60;stroke-width:2;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}
.cp .dot{top:auto;transform:translate(-50%,50%)}.cp-v{position:absolute;transform:translateX(-50%);font-size:12px;white-space:nowrap;font-variant-numeric:tabular-nums}
.cp-x{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin-top:6px}.cp-x div{text-align:center;outline:none;padding:4px 2px;border-radius:3px}.cp-x div:hover,.cp-x div:focus-visible{background:#17171b}.cp-x b{display:block;font-size:12px}.cp-x span{display:block;font-size:11px;color:#8c8c92}
.scroll{overflow-x:auto}table.t{width:100%;border-collapse:collapse;margin:4px 0 4px}
table.t th{font-size:11px;font-weight:400;letter-spacing:.08em;color:#5a5a60;text-align:right;padding:3px 8px;border-bottom:1px solid #26262b;white-space:nowrap}
table.t td{text-align:right;padding:4px 8px;border-bottom:1px solid #1a1a1e;font-size:12px;vertical-align:top;white-space:nowrap;font-variant-numeric:tabular-nums}
table.t th:first-child,table.t td:first-child{text-align:left;padding-left:0}table.t td.wrap{white-space:normal;text-align:left}
tr.own td{border-bottom:1px solid #5a5a60}
table.t.w1 td:first-child,table.t.w1 th:first-child{white-space:normal}table.t.w1 td,table.t.w1 th{padding-left:6px;padding-right:6px}
details.tv2{margin-top:10px}details.tv2 summary{cursor:pointer;font-size:11px;letter-spacing:.16em;color:#8c8c92}
.cmd{background:#0a0a0c;border:1px solid #26262b;border-radius:4px;padding:10px 12px;font-size:12px;white-space:pre-wrap;word-break:break-word;color:#c8c8cc;margin:6px 0 0}
#tip{position:fixed;z-index:50;max-width:min(420px,calc(100vw - 24px));background:#1a1a1e;border:1px solid #5a5a60;border-radius:4px;padding:8px 10px;font-size:12px;line-height:1.45;color:#c8c8cc;pointer-events:none;display:none}
details.sc-pagespecs{margin-top:40px;border-top:1px solid #26262b;padding-top:14px;max-width:1100px}
details.sc-pagespecs summary{cursor:pointer;font-size:12px;letter-spacing:.22em;color:#8c8c92;font-weight:700}
details.sc-pagespecs h4{font-size:11px;letter-spacing:.2em;color:#c8c8cc;margin:22px 0 6px}
details.sc-pagespecs p,details.sc-pagespecs li{font:13px/1.65 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;color:#c8c8cc;margin:6px 0}
details.sc-pagespecs code{font:12px ui-monospace,Menlo,monospace;color:#c8c8cc;background:#17171b;padding:1px 4px;border-radius:3px;word-break:break-word}
@media (max-width:640px){body{padding:0 12px 48px}.ttl{font-size:17px;letter-spacing:.16em}.panel{padding:12px 10px}.ch{--c1:50px;--c3:100px}.ch.g3{--c3:128px}.ch .row,.ch .ax{column-gap:6px}.tv{font-size:18px}.nm span{display:none}
.ax-t.thin-odd i:nth-child(odd),.ax-t.thin-even i:nth-child(even){display:none}
.ch.seats .row{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"nm vl" "tr tr";row-gap:2px;padding:6px 0 2px}.ch.seats .nm{grid-area:nm}.ch.seats .vl{grid-area:vl}.ch.seats .tr{grid-area:tr}
.ch.seats .nm b,.ch.seats .nm span{display:inline}.ch.seats .nm span{margin-left:8px}.ch.seats .ax{grid-template-columns:minmax(0,1fr)}.ch.seats .ax>span{display:none}.ch.seats .ax-t i:first-child{transform:none}}`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The feed fix · 7 Oct 2026 · Scintilla</title><style>${css}</style></head><body>
<header class="top"><span data-scnav-slot></span><div class="ttl">THE FEED FIX</div><div class="sub">7 Oct 2026 · the feed the allocation tool reads · the fiscal-year join · the foreign memory peers · growth from one forecast year to the next · a branch: nothing here is live</div></header>

<h2>1 · THE FEED THE KNOCKOUT READS</h2>
<div class="tiles">
${tile("Names given a forward P/E", num(B.counts.fwd_pe_positive), num(A.counts.fwd_pe_positive), `of ${num(B.comps_n)} asked · the rest have no estimate on file`)}
${tile("Forward P/E printed as 0", num(B.counts.fwd_pe_zero), num(A.counts.fwd_pe_zero), "a blank was printed as zero")}
${tile("Sales growth printed as exactly 0%", num(B.counts.growth_zero), num(A.counts.growth_zero), "names with no statements on file")}
${tile("P/S above 40×", num(B.counts.ps_above_40), num(A.counts.ps_above_40), "one quarter's sales under a full market value")}
${fact("Stored market value more than 10% from today's", `${MV.stored_over_today.more_than_10pct_off} of ${MV.dollar_reporters}`, `${MV.stored_over_today.more_than_25pct_off} are more than 25% off`)}
</div>
<div class="grid2">
<div class="panel"><div class="ph">ALAN'S EIGHTEEN · SALES GROWTH, A YEAR ON A YEAR</div>
${legend([["was", `as the live tool was told, 7 Oct ${TAKEN}`], ["now", "what the same rows say, on the fixed feed"]])}
<div class="ch">${axis(G.ticks, G.lo, G.hi, (t) => (t > 0 ? "+" : "") + t + "%", "odd")}${growthRows}</div></div>
<div class="panel"><div class="ph">ALAN'S EIGHTEEN · THE KNOCKOUT'S FUNDAMENTALS SCORE</div>
${legend([["was", "the live tool, live feed"], ["now", "the same tool, fixed feed"]])}
<div class="ch">${axis(S.ticks, S.lo, S.hi, (t) => t.toFixed(2).replace(/\.?0+$/, "") || "0")}${scoreRows}</div>
<table class="t" style="margin-top:12px"><tr><th>podium</th><th style="text-align:left">champions by score</th></tr><tr><td class="was">live feed</td><td class="wrap was">${esc(podium(B))}</td></tr><tr><td>fixed feed</td><td class="wrap">${esc(podium(A))}</td></tr></table></div>
</div>
<div class="panel scroll"><div class="ph">THE 26 CARD NAMES · WHAT THE FEED SAID → WHAT IT SAYS FIXED</div>
<table class="t"><tr><th>name</th><th>sales growth</th><th>forward P/E</th><th>trailing P/E</th><th>P/S</th><th>net margin</th><th>knockout score</th></tr>${cardRows}</table></div>
<div class="grid2">
<div class="panel scroll"><div class="ph">THE CAUSE, ON MICRON'S OWN ROWS · SALES</div>
<table class="t w1"><tr><th>row in the statements table</th><th>dated</th><th>sales</th></tr>
<tr><td>the quarter (Q4)</td><td>3 Sep 2026</td><td>${bn(q4)}</td></tr><tr><td>the fiscal year (FY2026)</td><td>3 Sep 2026</td><td>${bn(fy26)}</td></tr><tr><td>the fiscal year before (FY2025)</td><td>28 Aug 2025</td><td>${bn(fy25)}</td></tr>
<tr><td class="was">the feed: the quarter ÷ the year</td><td></td><td class="was">${sgn((q4 / fy26 - 1) * 100)}</td></tr><tr><td class="was">the feed, the other way round</td><td></td><td class="was">${sgn((fy26 / q4 - 1) * 100)}</td></tr><tr class="own"><td><b>a year on a year</b></td><td></td><td><b>${sgn((fy26 / fy25 - 1) * 100)}</b></td></tr></table></div>
<div class="panel scroll"><div class="ph">THE CAUSE, ON MICRON'S OWN ROWS · FORWARD P/E</div>
<table class="t w1"><tr><th>row in the estimates table</th><th>for</th><th>EPS</th><th>price ÷ EPS</th></tr>
<tr><td class="was">the next QUARTER — what the feed took</td><td class="was">${day(firstQ.fiscal_date)} 2026</td><td class="was">${firstQ.est_eps_avg.toFixed(2)}</td><td class="was">${x1(muF.price / firstQ.est_eps_avg)}</td></tr>
<tr class="own"><td><b>the fiscal YEAR in progress</b></td><td>${day(firstY.fiscal_date)} 2027</td><td>${firstY.est_eps_avg.toFixed(2)}</td><td><b>${x1(muP.price / firstY.est_eps_avg)}</b></td></tr>
<tr><td>estimate rows in one batch of 60 names</td><td></td><td></td><td>${num(FX.v5.estimate_rows_in_batch60)}</td></tr><tr><td>rows the database serves a request</td><td></td><td></td><td>${num(FX.v5.first_page.rows)}</td></tr>
<tr><td>newest year among those, oldest first</td><td></td><td></td><td>${FX.v5.first_page.newest_fiscal_date.slice(0, 4)}</td></tr><tr><td class="was">names of the batch left with no estimate → printed 0</td><td></td><td></td><td class="was">${FX.v5.forward_pe_zero_in_batch60} of ${FX.v5.batch60_names}</td></tr></table></div>
</div>

<h2>2 · THE FISCAL-YEAR JOIN · MICRON'S MOVED KEY</h2>
<div class="tiles">
${fact("The Hub's ESTIMATES box, Micron FY+1", "+12%", "joined: it has matched the nearest year-end within 45 days since 2 Oct")}
${tile("Micron's decision card, FY27 EPS revision", "+1.7%", "+12.4%", "3 copies since 2 Oct → 4 copies since 11 Aug")}
${tile("Micron's decision card, FY28 EPS revision", "+1.2%", "+24.5%", "the August copy was kept under another date")}
${fact("Names whose key moved", `${Object.values(RV.names).filter((n) => n.key_moved).length} of 455`, "Micron by six days; Costco, Cisco, Lumentum by one")}
</div>
<div class="grid2">
<div class="panel"><div class="ph">MICRON · FISCAL 2027 EPS ESTIMATE IN THE FOUR STORED COPIES</div>
${legend([["was", "kept under 28 Aug 2027"], ["now", "kept under 3 Sep 2027"]])}${copyFig}</div>
<div class="panel scroll"><div class="ph">THE REVISION LINE · JOINED ON THE DATE → ON THE FISCAL YEAR</div>
<table class="t"><tr><th>name</th><th>year</th><th>kept under</th><th>EPS estimate, joined on the date</th><th>joined on the fiscal year</th></tr>${["MU", "COST", "CSCO", "LITE"].map(revRow).join("")}
<tr><td class="wrap dim" colspan="5">the other ${unmoved} card names: one key, the same reading both ways</td></tr></table></div>
</div>

<h2>3 · THE MEMORY NAMES · THE FOREIGN PEERS HAVE NO FIGURES YET</h2>
<div class="tiles">
${fact("SK hynix · Samsung · Kioxia", "no figures", "FMP could not be reached from this lane")}
${tile("Micron's comps, CP1's rule on", sgn(st.upside_pct), sgn(mv.upside_pct), "the same code and closes, on today's market values")}
${fact("Micron on SanDisk alone", sgn(mv.per_peer.SNDK.upside_pct), "the one other memory maker we hold figures for")}
${fact("Micron on the two drive makers alone", `${sgn(mv.per_peer.WDC.upside_pct)} · ${sgn(mv.per_peer.STX.upside_pct)}`, "Western Digital · Seagate")}
</div>
<div class="panel"><div class="ph">MICRON · THE TWELVE READINGS BEHIND THE CENTRE · WHAT IT WOULD BE WORTH ON EACH PEER'S MULTIPLES</div>
<div class="lg"><span><i class="mk px"></i>price $${num(mv.price, 2)}</span><span><i class="mk ct"></i>centre $${num(mv.band.centre)} (${sgn(mv.upside_pct)})</span><span><i class="dot now"></i>one multiple of one peer</span><span><i class="dot alt"></i>that peer alone</span></div>
<div class="ch seats">${axis(P.ticks, P.lo, P.hi, (t) => "$" + (t / 1000) + "k")}
${seat("SNDK", "SanDisk", "memory")}${seat("WDC", "Western Digital", "disk drives")}${seat("STX", "Seagate", "disk drives")}${seat("000660.KS", "SK hynix", "memory · Seoul")}${seat("005930.KS", "Samsung", "memory & more · Seoul")}${seat("285A.T", "Kioxia", "memory · Tokyo")}</div></div>
<div>
<div class="panel scroll"><div class="ph">THE FOUR MEMORY AND STORAGE NAMES · COMPS UPSIDE</div>
<table class="t"><tr><th>name</th><th>close 6 Oct</th><th>as it stands</th><th>CP1's rule on</th><th>CP1's rule, today's market values</th><th>share count as read, against today's</th><th style="text-align:left">priced on</th></tr>${memRows}</table></div>
<div class="panel scroll"><div class="ph">MULTIPLES SIDE BY SIDE · TODAY'S MARKET VALUES</div>
<table class="t"><tr><th>company</th>${KEYS.map((k) => `<th>${KEYW[k]}</th>`).join("")}</tr>${MEM.map((t, i) => multRow(t, mv.multiples[t] || RR.names[t].cp1_mv.multiples[t], i === 0 ? "own" : "")).join("")}${blankRow("SK hynix")}${blankRow("Samsung")}${blankRow("Kioxia")}</table></div>
</div>
<div class="panel"><div class="ph">THE TWO WAYS TO BRING THE THREE IN · READY TO RUN</div>
<div class="cmd">A · the coordinator's FMP connector: save each answer as it comes, one JSON file each, any name, in
    workspaces/scintilla/staging/fmp-foreign-peers-20261007/
  then:
node deliverables/20261007/feed-fix/tools/reference-facts-from-raw.mjs "/Users/alanharvey/AlanOS/Operating System/workspaces/scintilla/staging/fmp-foreign-peers-20261007" deliverables/20261003/comps-c5/reference-peers-facts-20261007.json

B · the job that exists, on a throw-away Fly machine. The key must be the machine's own FMP_API_KEY (it copies the app's secrets; never on this Mac):
fly machine run registry.fly.io/scintilla-massive-stocks-batch:live-112d10c sleep 1500 -a scintilla-massive-stocks-batch --rm --restart no --region iad -e SERVICE=none --file-local /app/fx-multiples-check.mjs=scripts/fx-multiples-check.mjs --detach
fly ssh console -a scintilla-massive-stocks-batch --machine &lt;id&gt; -C "node /app/fx-multiples-check.mjs 000660.KS 005930.KS 285A.T SKHY" &gt; deliverables/20261003/comps-c5/reference-peers-facts-20261007.json
fly machine stop &lt;id&gt; -a scintilla-massive-stocks-batch

then, from a folder holding the read key (.anon) and CP1's closes (quotes-all-raw.json):
node deliverables/20261007/feed-fix/tools/comps-rerun.mjs --out memory.json MU SNDK WDC STX</div></div>
<details class="tv2"><summary>ALL 26 NAMES ON TODAY'S MARKET VALUES</summary><div class="panel scroll" style="margin-top:10px"><table class="t"><tr><th>name</th><th>share count as read, against today's</th><th>as it stands: stored → today's market values</th><th>CP1's rule on: stored → today's market values</th></tr>${mvRows}</table></div></details>

<h2>4 · GROWTH FROM ONE FORECAST YEAR TO THE NEXT</h2>
<div class="tiles">
${tile("Lilly's comps", sgn(L.cp1.upside_pct), sgn(L.fd1.upside_pct), `growth credit ×${L.cp1.growth_credit.credit} → ×${L.fd1.growth_credit.credit}`)}
${tile("Vistra's comps", sgn(V.cp1.upside_pct), sgn(V.fd1.upside_pct), `growth credit ×${V.cp1.growth_credit.credit} → ×${V.fd1.growth_credit.credit}`)}
${tile("AbbVie's growth a year, as measured", sgn(L.cp1.growth.ABBV.trailing), sgn(L.cp1.growth.ABBV.forecast), "from a written-down year → from a forecast year")}
${tile("Micron's own growth a year, as measured", sgn(M.cp1.growth.MU.trailing), sgn(M.cp1.growth.MU.forecast), "the year in progress is the starting point, so it is not seen")}
</div>
<div class="grid2">
<div class="panel"><div class="ph">LILLY AND ITS PEERS · EPS GROWTH A YEAR, MEASURED THREE WAYS</div>
${legend([["was", "from reported earnings (as built)"], ["now", "from one forecast year to the next (approved)"], ["alt", "from the year just reported (proposal)"]])}
<div class="ch g3">${axis(GR.ticks, GR.lo, GR.hi, (t) => (t > 0 ? "+" : "") + t + "%", "odd")}${grRows}</div></div>
<div class="panel scroll"><div class="ph">LILLY AND VISTRA · COMPS UPSIDE, AND THE GROWTH CREDIT BEHIND IT</div>
<table class="t"><tr><th>name</th><th>as built</th><th>forecast year to the next</th><th>from the year just reported</th></tr>${g2(L, "LLY")}${g2(V, "VST")}${g2(M, "MU")}${g2(RR.names.SNDK, "SNDK")}${g2(RR.names.GOOGL, "GOOGL")}</table>
<details class="tv2"><summary>ALL 26 NAMES, THE THREE WAYS</summary><table class="t" style="margin-top:8px"><tr><th>name</th><th>as built</th><th>forecast to the next</th><th>from the year just reported</th><th>own growth: the three ways, % a year</th></tr>${allG}</table></details></div>
</div>

<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
@@SPECS@@
</details>
<div id="tip" role="status"></div>
<script>(function(){var tip=document.getElementById("tip");function show(el,x,y){tip.textContent=el.getAttribute("data-tip");tip.style.display="block";var w=tip.offsetWidth,h=tip.offsetHeight,vw=window.innerWidth,vh=window.innerHeight;var left=Math.min(Math.max(8,x+14),vw-w-8),top=y+18+h>vh?Math.max(8,y-h-12):y+18;tip.style.left=left+"px";tip.style.top=top+"px"}function hide(){tip.style.display="none"}
document.querySelectorAll("[data-tip]").forEach(function(el){el.addEventListener("pointermove",function(e){show(el,e.clientX,e.clientY)});el.addEventListener("pointerleave",hide);el.addEventListener("focus",function(){var r=el.getBoundingClientRect();show(el,r.left+20,r.bottom-6)});el.addEventListener("blur",hide)});})();</script>
</body></html>`;
/* the BACK / CLOSE pair, carried by the builder exactly as scripts/inject-scnav.py places it (so that script finds it
   already in place and rewrites nothing) */
const specs = readFileSync(HERE + "/page-specs.fragment", "utf8").replace(/@@TAKEN@@/g, TAKEN), scnav = readFileSync(WT + "/scripts/scnav-snippet.html", "utf8").trim();
const tests = existsSync(ROOT + "/data/tests.json") ? J(ROOT + "/data/tests.json").words : "The test counts are written here after the last run.";
writeFileSync(ROOT + "/FEED-FIX.html", html.replace("@@SPECS@@", specs.replace("@@TESTS@@", tests)).replace("</body>", scnav + "\n</body>"));
console.log("FEED-FIX.html", (html.length + specs.length) + " chars · eighteen", KO.eighteen.length, "· cards", KO.cards.length, "· Micron on today's market values", mv.upside_pct, "· Lilly", L.cp1.upside_pct, "→", L.fd1.upside_pct);

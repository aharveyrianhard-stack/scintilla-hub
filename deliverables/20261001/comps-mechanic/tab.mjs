/* Scintilla · comps, the mechanic (C4, 1 Oct) · the tab, one clean screen.
   Order: the header line (industry · the set in one line · the band and N controls) · the peer set (ticker, sources,
   market value, on/off) · the conclusion drawn (a small football field, low – centre – high, the price as the overlay,
   the upside) with the A · B · C switch and C's weights in one line · the summary field (one bar per valuation measure on
   the dollar axis, the blended band under them) · the field, going down: the six valuation rows as price ranges, then
   growth, margins, balance sheet and capex as positions among the peers (16 rows, grouped) · the full table, closed.
   Out: status chips, repeated prices, the word median on every mark, "log axis". Plain numbers: no plus signs,
   negatives in parentheses. One mark for the company: a cyan line. Hub tokens only. */
import { inputs, buildSet, readSet, snapshotFromCohort, BAND_DEFAULT, N_DEFAULT } from "./read.mjs";
import { BANDS, NS, SOURCE_WORDS } from "./peers.mjs";
import { ROWS, SHORT, TABLE } from "../comps-template/cohort.mjs";
import { conclusion, wayOf, WAY_WORDS } from "../comps-template/template.mjs";
import { decisionRow, isOff, flags, FLAG_WORDS, FAR_K } from "../../20260930/comps-tab/comps-tab.mjs";
import { median } from "../../20260928/comps-r3-labels/labels-r3.mjs";
import { fmt } from "../../20260927/comps-r3/r3.mjs";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const SVG = "http://www.w3.org/2000/svg";
const el = (tag, a = {}, t) => { const e = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); if (t != null) e.textContent = t; return e; };
const widthOf = (t, f) => { try { const w = t.getComputedTextLength(); if (w > 0) return w; } catch (_) {} return f; };
/* plain numbers: no plus signs, negatives in parentheses */
const X = (v) => v == null ? "—" : (v < 0 ? "(" : "") + Math.abs(v).toFixed(Math.abs(v) >= 100 ? 0 : 1) + "x" + (v < 0 ? ")" : "");
const PCT = (v) => v == null ? "—" : (v < 0 ? "(" : "") + Math.abs(v).toFixed(Math.abs(v) >= 10 ? 0 : 1) + "%" + (v < 0 ? ")" : "");
const USD = (v) => v == null ? "—" : (v < 0 ? "(" : "") + "$" + Math.abs(v).toFixed(2) + (v < 0 ? ")" : "");
const P0 = (v) => v == null || !Number.isFinite(v) ? "—" : "$" + Math.round(v).toLocaleString("en-US");
const CAP = (v) => v == null ? "—" : v >= 1e12 ? "$" + (v / 1e12).toFixed(2) + "T" : v >= 1e9 ? "$" + (v / 1e9).toFixed(0) + "B" : "$" + (v / 1e6).toFixed(0) + "M";
const F = (kind, v) => v == null ? "—" : kind === "x" ? X(v) : kind === "x2" ? (v < 0 ? "(" : "") + Math.abs(v).toFixed(2) + "x" + (v < 0 ? ")" : "") : kind === "pct" ? PCT(v) : kind === "usd2" ? USD(v) : String(v);
const UP = (v) => v == null ? "—" : (v >= 0 ? "" : "(") + Math.abs(v).toFixed(Math.abs(v) >= 10 ? 0 : 1) + "%" + (v >= 0 ? "" : ")");
const dirCls = (v) => v == null ? "" : v >= 0 ? " up" : " dn";
const LS = "sc_comps_decisions", WAYS3 = ["A", "B", "CW"];
const GROUPS = [["valuation", "Valuation · what a dollar of earnings, sales or EBITDA costs · each row prices the company at its peers' multiples"], ["growth", "Growth"], ["margins", "Margins · what is kept of each sales dollar"], ["balance sheet", "Balance sheet"], ["capex", "CapEx"]];
const BETTER = { rev_g_ttm: 1, rev_g_fy: 1, eps_g_fy: 1, gm: 1, om: 1, fcfm: 1, nd_ebitda: -1, capex_rev: 0, capex_g: 0, rev_per_capex: 1 };

export const CSS = `
.cm{font-family:var(--mono);color:var(--ink2);font-size:11px;line-height:1.5;letter-spacing:.02em;text-transform:none}
.cm *{box-sizing:border-box;min-width:0}
.cm .up{color:var(--bull)}.cm .dn{color:var(--bear)}
.cm .cm-sec{border:.8px solid rgba(0,212,255,.22);background:var(--panel);padding:10px 12px;margin-bottom:8px;overflow:hidden}
.cm{overflow:hidden}
.cm .cm-h{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:baseline;font-size:10px;color:var(--ink3);letter-spacing:.06em;margin-bottom:6px}
.cm .cm-h b{color:var(--ink);font-weight:600;letter-spacing:.14em;text-transform:uppercase;font-size:9px}
.cm .cm-h .ctl{display:inline-flex;flex-wrap:wrap;gap:2px;align-items:center;margin-left:auto}
.cm .cm-h .ctl span{font-size:8px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);margin:0 4px 0 8px}
.cm .cm-h .ctl button{font:inherit;font-size:9px;padding:2px 6px;background:none;border:.8px solid var(--line2);color:var(--ink3);cursor:pointer}
.cm .cm-h .ctl button.on{color:var(--crk);border-color:rgba(0,212,255,.55)}
.cm .cm-rule{font-size:10px;color:var(--ink3);line-height:1.5}
.cm .cm-rule b{color:var(--ink2);font-weight:600}
/* the peer set */
.cm table.p{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:10.5px;margin-top:6px}
.cm table.p th{font-size:8px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);font-weight:400;padding:4px 6px;text-align:left;border-bottom:.8px solid rgba(0,212,255,.22);white-space:nowrap}
.cm table.p td{padding:4px 6px;border-bottom:.5px solid var(--line);color:var(--ink2);white-space:nowrap;vertical-align:middle}
.cm table.p th.r,.cm table.p td.r{text-align:right}
.cm table.p td.tk{color:var(--ink);font-weight:600;letter-spacing:.04em}
.cm table.p tr.me td{color:var(--ink);background:rgba(0,212,255,.06)}.cm table.p tr.me td.tk{color:var(--crk)}
.cm table.p tr.off td{color:var(--mute)}.cm table.p tr.off td.tk{text-decoration:line-through;color:var(--mute)}
.cm .src{display:inline-block;font-size:7.5px;letter-spacing:.1em;padding:1px 4px;margin-right:3px;border:.5px solid var(--line2);color:var(--ink3);text-transform:uppercase}
.cm .tog{background:none;border:0;cursor:pointer;font-size:12px;line-height:1;width:14px;padding:0;color:#4A4A52}.cm .tog.on{color:#C9C9CE}.cm .tog:hover{color:var(--crk)}
.cm .cm-dropped{font-size:9.5px;color:var(--dim);margin-top:6px;line-height:1.5}
.cm .cm-dropped b{color:var(--ink3);font-weight:400}
/* the conclusion */
.cm .cm-concl{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 18px;align-items:center}
.cm.narrow .cm-concl{grid-template-columns:1fr}
.cm .cm-concl svg{display:block;width:100%;height:auto;overflow:visible}
.cm .cm-up{text-align:right}
.cm .cm-up .big{font-size:24px;font-weight:700;line-height:1.1;white-space:nowrap}
.cm .cm-up .k{font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:var(--dim)}
.cm .cm-sw{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-top:8px}
.cm .cm-sw .k{font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:var(--dim);margin-right:4px}
.cm .cm-sw button{font:inherit;font-size:9px;letter-spacing:.1em;padding:3px 8px;background:none;border:.8px solid var(--line2);color:var(--ink3);cursor:pointer;white-space:nowrap}
.cm .cm-sw button.on{color:var(--crk);border-color:rgba(0,212,255,.55);background:rgba(0,212,255,.06)}
.cm .cm-line{font-size:9.5px;color:var(--ink3);margin-top:5px;line-height:1.45}
.cm .cm-line b{color:var(--ink2);font-weight:600}
/* fields */
.cm .cm-grp{font-size:8.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--dim);padding:10px 0 4px;border-bottom:.5px solid var(--line);margin-bottom:2px}
.cm .cm-grp small{text-transform:none;letter-spacing:.02em;color:var(--mute);margin-left:8px;font-size:9.5px}
.cm .cm-row{display:grid;grid-template-columns:120px minmax(0,1fr) 70px;gap:0 12px;align-items:center;padding:5px 0;border-bottom:.5px solid var(--line)}
.cm.narrow .cm-row{grid-template-columns:88px minmax(0,1fr) 58px}
.cm .cm-row .lb{font-size:10.5px;color:var(--ink);font-weight:600;line-height:1.25}
.cm .cm-row .lb small{display:block;font-size:8px;color:var(--mute);letter-spacing:.08em;font-weight:400;text-transform:uppercase;margin-top:1px}
.cm .cm-row svg{display:block;width:100%;height:auto;overflow:visible}
.cm .cm-row .v{font-size:13px;font-weight:700;text-align:right;white-space:nowrap;color:var(--ink)}
.cm .cm-row .v small{display:block;font-size:7.5px;font-weight:400;letter-spacing:.14em;color:var(--mute);text-transform:uppercase}
.cm .cm-row .v.no{font-size:9px;font-weight:400;color:var(--mute);white-space:normal;line-height:1.3}
.cm .cm-sum svg{display:block;width:100%;height:auto;overflow:visible}
.cm .wh{stroke:var(--ink3);stroke-width:1.2}
.cm .box{fill:rgba(0,212,255,.10);stroke:rgba(0,212,255,.30);stroke-width:.8}
.cm .box.band{fill:rgba(0,212,255,.22);stroke:var(--crk)}
.cm .med{stroke:var(--ink2);stroke-width:2}
.cm .n{font-size:9px;fill:var(--ink3)}
.cm .n.k{fill:var(--ink);font-weight:600}
.cm .lab{font-size:8px;letter-spacing:.12em;fill:var(--dim)}
.cm .me{stroke:var(--crk);stroke-width:1.6}
.cm .me-n{font-size:10.5px;font-weight:700;fill:var(--crk);paint-order:stroke;stroke:var(--panel);stroke-width:3px;stroke-linejoin:round}
.cm .me-t{font-size:8px;letter-spacing:.1em;fill:var(--crk)}
/* the table */
.cm details.cm-d{border:.8px solid rgba(0,212,255,.22);margin-top:2px}
.cm details.cm-d > summary{list-style:none;cursor:pointer;display:flex;gap:10px;align-items:center;padding:8px 12px;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink3)}
.cm details.cm-d > summary::-webkit-details-marker{display:none}
.cm details.cm-d > summary::before{content:"+";color:var(--crk);font-size:12px;width:10px;display:inline-block}
.cm details.cm-d[open] > summary::before{content:"−"}
.cm details.cm-d > summary small{color:var(--mute);letter-spacing:.06em;text-transform:none;font-size:9.5px;margin-left:auto}
.cm details.cm-d > .body{padding:4px 12px 10px;border-top:.5px solid var(--line)}
.cm .tw{overflow-x:auto;scrollbar-width:thin}
.cm .tw table.p th:nth-child(1),.cm .tw table.p td:nth-child(1),.cm .tw table.p th:nth-child(2),.cm .tw table.p td:nth-child(2){position:static}
.cm .tw table.t th:nth-child(1),.cm .tw table.t td:nth-child(1){position:sticky;left:0;background:var(--panel);z-index:2}
.cm .tw table.t th:nth-child(2),.cm .tw table.t td:nth-child(2){position:sticky;left:20px;background:var(--panel);z-index:2;box-shadow:inset -1px 0 0 var(--line2)}
.cm table.t{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:10.5px}
.cm table.t th{font-size:8px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);font-weight:400;padding:6px 5px 4px;text-align:right;border-bottom:.8px solid rgba(0,212,255,.22);white-space:nowrap}
.cm table.t th.l,.cm table.t td.l{text-align:left}.cm table.t th.grp{text-align:center;color:var(--ink3);border-bottom:.5px solid var(--line);letter-spacing:.2em}
.cm table.t td{padding:3px 5px;text-align:right;border-bottom:.5px solid var(--line);color:var(--ink2);white-space:nowrap}
.cm table.t td.tk{color:var(--ink);font-weight:600}.cm table.t tr.me td{color:var(--ink);background:rgba(0,212,255,.07)}.cm table.t tr.me td.tk{color:var(--crk)}
.cm table.t tr.me td:nth-child(1),.cm table.t tr.me td:nth-child(2){background:#0f1a22}
.cm table.t tr.off td{color:var(--mute)}.cm table.t tr.off td.tk{text-decoration:line-through}
.cm table.t tr.stat td{color:var(--ink3);font-size:10px}.cm table.t tr.stat td.l{letter-spacing:.12em;text-transform:uppercase;font-size:8px;color:var(--dim)}
.cm .cell{background:none;border:0;padding:0;margin:0;font:inherit;color:inherit;cursor:pointer}.cm .cell:hover{color:var(--crk)}.cm .cell.off{color:var(--mute);text-decoration:line-through}.cm .cell.none{color:var(--mute);cursor:default;text-decoration:none}
.cm .flag{display:inline-block;font-size:7px;letter-spacing:.1em;padding:0 3px;margin-left:3px;border:.5px solid var(--line2);color:var(--mute);vertical-align:middle;text-decoration:none}
.cm .reason td{padding:5px 6px 7px;white-space:normal;background:rgba(0,212,255,.03)}
.cm .chips{display:flex;flex-wrap:wrap;gap:5px;align-items:center}
.cm .chip,.cm .btn{font:inherit;font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;padding:4px 8px;background:none;border:.8px solid var(--line2);color:var(--ink3);cursor:pointer}
.cm .chip:hover,.cm .btn:hover{color:var(--ink);border-color:var(--ink3)}.cm .btn.on{color:var(--crk);border-color:rgba(0,212,255,.5)}
.cm .in{font:inherit;font-size:10.5px;background:var(--panel2);color:var(--ink);border:.8px solid var(--line2);padding:4px 7px;min-width:160px;flex:1 1 160px}
.cm .words{font-size:10px;color:var(--ink3);line-height:1.55;margin:6px 0 0}
.cm .err{border:.8px solid var(--bear);padding:8px 10px;color:var(--ink);font-size:10.5px}
.cm .loading{color:var(--ink3);font-size:10px;padding:12px 2px;letter-spacing:.2em}`;

function ensureCSS() { if (!document.getElementById("cm-css")) { const s = document.createElement("style"); s.id = "cm-css"; s.textContent = CSS; document.head.appendChild(s); } }
const localRows = () => { try { return JSON.parse(localStorage.getItem(LS) || "[]"); } catch (_) { return []; } };
async function loadDecisions(opts, companies) {
  if (opts.read) { try { const rows = await opts.read(`comps_decisions?select=id,company,peer,measure,off,reason,set_by,set_at&company=in.(${companies.map(encodeURIComponent).join(",")})&order=set_at.asc`); return { rows: Array.isArray(rows) ? rows : [], mode: "db" }; } catch (e) { return { rows: localRows(), mode: "local" }; } }
  return { rows: localRows(), mode: "local" };
}
async function storeDecision(S, row) {
  S.decisions.push(row);
  if (S.mode === "db" && S.opts.write) { try { await S.opts.write("comps_decisions", [row]); return; } catch (_) { S.mode = "local"; } }
  try { const all = localRows(); all.push(row); localStorage.setItem(LS, JSON.stringify(all)); } catch (_) {}
}
let INPUTS = null, INPUTS_AT = 0, STANDIN = null;
const TTL = 10 * 60e3, CTX = new Map();
async function standin() { if (STANDIN !== null) return STANDIN; try { STANDIN = await (await fetch("/deliverables/20261001/comps-template/fx-standin-ecb-2026-10-01.json", { cache: "no-store" })).json(); } catch (_) { STANDIN = false; }
  /* C5b — FMP's statement currency for every served company rides with the stand-in: a foreign reporter is never read as a dollar filer */
  try { const r = await (await fetch("/deliverables/20261003/comps-c5b/reporting-currency-fmp-2026-10-03.json", { cache: "no-store" })).json(); if (r && r.reported) STANDIN = { ...(STANDIN || {}), reported: r.reported }; } catch (_) {} return STANDIN; }
const fetchJson = (u) => fetch(u, { cache: "no-store" }).then((r) => { if (!r.ok) throw new Error(u + " → " + r.status); return r.json(); });

export async function mountCompsTab(root, opts) {
  ensureCSS();
  const T = String(opts.ticker).toUpperCase();
  root.classList.add("cm"); root.classList.toggle("narrow", root.clientWidth < 520); root.dataset.mounted = T;
  root.innerHTML = `<div class="loading">BUILDING THE COMPARABLE SET OF ${esc(T)}…</div>`;
  const S = { root, opts, T, band: opts.band || BAND_DEFAULT, n: opts.n || N_DEFAULT, way: "B", reasonFor: null, open: {} };
  try {
    if (!INPUTS || Date.now() - INPUTS_AT > TTL) { INPUTS = await inputs({ pg: opts.pg, fetchJson }); INPUTS_AT = Date.now(); }
    S.inp = INPUTS;
    await loadSet(S);
  } catch (e) { root.innerHTML = `<div class="err"><b>${esc(T)}</b>: the comparable set could not be built — ${esc(e && e.message || e)}.</div>`; return; }
  if (root.dataset.mounted !== T) return;
  root._cm = S;
  render(S);
  const fit = () => root.classList.toggle("narrow", root.clientWidth < 520);
  fit(); new ResizeObserver(fit).observe(root);
}
async function loadSet(S) {
  S.set = buildSet(S.T, S.inp, { band: S.band, n: S.n });
  const key = S.T + "|" + [S.T, ...S.set.kept.map((r) => r.ticker)].join(",");
  const hit = CTX.get(key);
  if (hit && Date.now() - hit.at < TTL) S.ctx = hit.ctx;
  else { const fx = await standin(); S.ctx = await readSet(S.T, S.set, { today: S.opts.today, pg: S.opts.pg, quotes: S.opts.quotes, livePrices: S.opts.livePrices || {}, fxStandin: fx || null }); CTX.set(key, { ctx: S.ctx, at: Date.now() }); }
  S.members = S.ctx.members.filter((t) => !S.ctx.excluded.some((e) => e.ticker === t));
  S.snap = snapshotFromCohort(S.ctx, S.T);
  const dec = await loadDecisions(S.opts, S.members); S.decisions = dec.rows; S.mode = dec.mode;
}

function render(S) {
  const { snap, T, set } = S;
  const C = conclusion(snap, S.decisions, S.way === "CW" ? "CW" : S.way); S.C = C;
  const w = wayOf(C.ways, S.way), peers = S.members.filter((t) => t !== T), cw = wayOf(C.ways, "CW");
  const h = [];
  /* the set, one stated rule */
  const ctl = (k, label, list, cur) => `<span>${label}</span>${list.map((v) => `<button type="button" data-cm="${k}" data-v="${v}" class="${cur === v ? "on" : ""}">${k === "band" ? (v >= 1000 ? "any" : "×" + v) : v}</button>`).join("")}`;
  const srcState = set.source_state;
  h.push(`<div class="cm-sec"><div class="cm-h"><b>comparables</b><span>${esc(set.own_industry || "industry unknown")}${snap.sector ? " · " + esc(snap.sector) : ""} · ${esc(CAP(set.own_market_cap))}</span><span class="ctl">${ctl("band", "size band", BANDS, S.band)}${ctl("n", "keep", NS, S.n)}</span></div>
    <div class="cm-rule">${set.counts.candidates} candidates from FMP (${srcState.fmp === "table" ? set.sources.fmp.length : srcState.fmp.startsWith("probed") ? set.sources.fmp.length + ", probed 1 Oct" : esc(srcState.fmp)}), Massive (${srcState.massive === "table" ? set.sources.massive.length : srcState.massive.startsWith("probed") ? set.sources.massive.length + ", probed 1 Oct" : esc(srcState.massive)}), the same industry and the industry funds that hold ${esc(T)} (${esc(srcState.fund)}) → <b>${set.counts.same_industry}</b> in the same industry → <b>${set.counts.in_band}</b> between ÷${S.band >= 1000 ? "∞" : S.band} and ×${S.band >= 1000 ? "∞" : S.band} of its market value → the nearest <b>${set.counts.kept}</b> kept, industry first, then size.</div>
    ${setTableHTML(S)}</div>`);
  /* the conclusion, drawn */
  h.push(`<div class="cm-sec"><div class="cm-h"><b>the range</b><span>way ${esc(w ? w.short : S.way)} · ${peers.length - C.off} of ${peers.length} peers in</span></div>
    <div class="cm-concl"><div id="cmConcl"><svg></svg></div><div class="cm-up"><div class="k">to the centre</div><div class="big${C.upside ? dirCls(C.upside.mid.pct) : ""}">${C.upside ? esc(UP(C.upside.mid.pct)) : "—"}</div>${C.band ? `<div class="k">${esc(UP(C.upside.lo.pct))} low · ${esc(UP(C.upside.hi.pct))} high</div>` : ""}</div></div>
    <div class="cm-sw"><span class="k">way</span>${WAYS3.map((k) => { const ww = wayOf(C.ways, k); return `<button type="button" data-cm="way" data-w="${k}" class="${S.way === k ? "on" : ""}" title="${esc(ww ? ww.plain : "")}">${k === "CW" ? "C" : k}${ww && ww.ok ? " " + esc(P0(ww.mid)) : ""}</button>`; }).join("")}</div>
    <div class="cm-line">${WAY_WORDS.A.short} ${esc(WAY_WORDS.A.plain)} · B ${esc(WAY_WORDS.B.plain)} · C ${cw && cw.ok ? "weighted: " + ROWS.filter((k) => cw.weights[k] > 0).map((k) => esc(SHORT[k]) + " " + Math.round(cw.weights[k] * 100) + "%").join(" · ") + " (sector prior × coverage × tightness × pricing fit)" : "cannot be computed"}${C.disagreement.ok ? ` · <b>${esc(C.disagreement.words.split(":")[0])}</b>: the centres sit ${C.disagreement.spread.toFixed(0)}% of the price apart` : ""}</div>
    <div class="cm-sum" id="cmSum"><svg></svg></div></div>`);
  /* the field, going down */
  h.push(`<div class="cm-sec" id="cmField"></div>`);
  /* the full table, closed */
  h.push(`<details class="cm-d" data-d="table"${S.open.table ? " open" : ""}><summary>the table<small>${peers.length} peers · ${TABLE.length} columns · on / off per cell</small></summary><div class="body">${S.open.table ? tableHTML(S) : ""}</div></details>`);
  S.root.innerHTML = h.join("");
  drawConclusion(S); drawSummary(S); drawField(S);
  wire(S);
}

/* ---- the peer set: ticker · sources · market value · on/off ------------------------------------------ */
function setTableHTML(S) {
  const { set, T, C } = S, sel = C.sel, names = S.snap.names || {};
  const row = (r) => { const off = sel.peers.has(r.ticker); return `<tr class="${off ? "off" : ""}"><td><button type="button" class="tog${off ? "" : " on"}" data-cm="peer" data-t="${esc(r.ticker)}" title="${off ? "put back" : "turn off"}">${off ? "□" : "■"}</button></td><td class="tk" title="${esc(names[r.ticker] || "")}">${esc(r.ticker)}</td><td>${r.sources.map((s) => `<span class="src" title="${esc(SOURCE_WORDS[s])}${s === "FUND" ? ": " + esc(r.funds.join(", ")) : ""}">${s === "INDUSTRY" ? "ind" : s === "MASSIVE" ? "mas" : s.toLowerCase()}</span>`).join("")}</td><td>${esc(r.match_word)}</td><td class="r">${esc(CAP(r.market_cap))}</td><td class="r">${r.ratio != null ? esc((r.ratio >= 1 ? "×" + r.ratio.toFixed(1) : "÷" + (1 / r.ratio).toFixed(1))) : "—"}</td></tr>`; };
  const dropped = set.dropped.filter((d) => d.served).slice(0, 14);
  return `<div class="tw"><table class="p"><thead><tr><th></th><th>peer</th><th>named by</th><th>why it is in</th><th class="r">market value</th><th class="r">size vs ${esc(T)}</th></tr></thead><tbody>
    <tr class="me"><td></td><td class="tk">${esc(T)}</td><td></td><td>${esc(set.own_industry || "")}</td><td class="r">${esc(CAP(set.own_market_cap))}</td><td class="r">1×</td></tr>
    ${set.kept.map(row).join("")}</tbody></table></div>
    ${set.dropped.length ? `<div class="cm-dropped">Not in: ${dropped.map((d) => `<b>${esc(d.ticker)}</b> ${esc(d.why)}`).join(" · ")}${set.dropped.length > dropped.length ? ` · and ${set.dropped.length - dropped.length} not served on the Hub` : ""}.</div>` : ""}`;
}

/* ---- the conclusion: a small football field, the price as the overlay ----------------------------------- */
function drawConclusion(S) {
  const box = S.root.querySelector("#cmConcl"); if (!box) return;
  const svg = box.querySelector("svg"), C = S.C, price = S.snap.price;
  const d = () => {
    const W = Math.max(200, box.clientWidth || 300); while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (!C.band) { svg.setAttribute("height", 24); svg.appendChild(el("text", { class: "n", x: 0, y: 14 }, C.reason || "no range: no row can be priced")); return; }
    const b = C.band, vals = [b.lo, b.hi, price]; let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * 0.12 || 1; lo -= pad; hi += pad;
    const H = 58, y = 30, bh = 16, x = (p) => Math.round((8 + ((p - lo) / (hi - lo)) * (W - 16)) * 10) / 10;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H);
    svg.appendChild(el("rect", { class: "box band", x: x(b.lo), y: y - bh / 2, width: Math.max(1, x(b.hi) - x(b.lo)), height: bh }));
    svg.appendChild(el("line", { class: "med", x1: x(b.mid), x2: x(b.mid), y1: y - bh / 2 - 3, y2: y + bh / 2 + 3 }));
    const lab = (p, word, anchor, yy, cls = "n") => { const t = el("text", { class: cls, x: x(p), y: yy, "text-anchor": anchor }, word); svg.appendChild(t); return t; };
    lab(b.lo, "low " + P0(b.lo), "start", y + bh / 2 + 14); lab(b.hi, "high " + P0(b.hi), "end", y + bh / 2 + 14); lab(b.mid, "centre " + P0(b.mid), "middle", y - bh / 2 - 7, "n k");
    const px = x(price);
    svg.appendChild(el("line", { class: "me", x1: px, x2: px, y1: 2, y2: H - 4 }));
    const t = el("text", { class: "me-n", y: 10, "text-anchor": px < 60 ? "start" : px > W - 60 ? "end" : "middle" }, P0(price)); svg.appendChild(t); t.setAttribute("x", px < 60 ? px + 4 : px > W - 60 ? px - 4 : px);
  };
  new ResizeObserver(d).observe(box); requestAnimationFrame(d);
}

/* ---- the summary field: one bar per valuation measure on the dollar axis, the blended band under them ------ */
function drawSummary(S) {
  const box = S.root.querySelector("#cmSum"); if (!box) return;
  const svg = box.querySelector("svg"), C = S.C, price = S.snap.price, rows = C.rows.filter((r) => r.ok && r.ends && r.ends.q1 && r.ends.q3);
  const d = () => {
    const W = Math.max(200, box.clientWidth || 300); while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (!rows.length) { svg.setAttribute("height", 4); return; }
    const vals = [price, ...rows.flatMap((r) => [r.ends.q1.price, r.ends.q3.price])]; if (C.band) vals.push(C.band.lo, C.band.hi);
    let lo = Math.min(...vals), hi = Math.max(...vals); const useLog = lo > 0 && hi / lo > 50, L = Math.log10;
    const padL = 64, padR = 10, inner = W - padL - padR, x = (p) => Math.round((padL + (useLog ? (L(p) - L(lo)) / (L(hi) - L(lo)) : (p - lo) / (hi - lo)) * inner) * 10) / 10;
    const laneH = 15, top = 14, H = top + (rows.length + 1) * laneH + 22;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H);
    svg.appendChild(el("text", { class: "lab", x: 0, y: 9 }, "HOW THE RANGE IS BUILT · EACH MEASURE'S MIDDLE HALF OF THE PEERS, THEN THE BLEND"));
    rows.forEach((r, i) => {
      const y = top + i * laneH + 7;
      svg.appendChild(el("text", { class: "lab", x: 0, y: y + 3 }, SHORT[r.key]));
      svg.appendChild(el("rect", { class: "box", x: x(r.ends.q1.price), y: y - 4, width: Math.max(1, x(r.ends.q3.price) - x(r.ends.q1.price)), height: 8 }));
      svg.appendChild(el("line", { class: "med", x1: x(r.ends.median.price), x2: x(r.ends.median.price), y1: y - 6, y2: y + 6 }));
    });
    const yb = top + rows.length * laneH + 10;
    if (C.band) { svg.appendChild(el("text", { class: "lab", x: 0, y: yb + 3, fill: "var(--crk)" }, "WAY " + (S.way === "CW" ? "C" : S.way))); svg.appendChild(el("rect", { class: "box band", x: x(C.band.lo), y: yb - 5, width: Math.max(1, x(C.band.hi) - x(C.band.lo)), height: 10 })); svg.appendChild(el("line", { class: "med", x1: x(C.band.mid), x2: x(C.band.mid), y1: yb - 7, y2: yb + 7 })); }
    const px = x(price); svg.appendChild(el("line", { class: "me", x1: px, x2: px, y1: top - 4, y2: yb + 9 }));
    for (const [p, word, a] of [[lo, P0(lo), "start"], [hi, P0(hi), "end"]]) svg.appendChild(el("text", { class: "n", x: x(p), y: H - 4, "text-anchor": a }, word));
  };
  new ResizeObserver(d).observe(box); requestAnimationFrame(d);
}

/* ---- the field: 16 measures, going down, grouped --------------------------------------------------------- */
function drawField(S) {
  const box = S.root.querySelector("#cmField"); if (!box) return;
  const { snap, C, T } = S, sel = C.sel, peersOn = S.members.filter((t) => t !== T && !sel.peers.has(t));
  box.innerHTML = `<div class="cm-h"><b>the field</b><span>16 measures · ${esc(T)} is the cyan line · the peers run from the lowest to the highest, the box is their middle half</span></div>`;
  for (const [g, title] of GROUPS) {
    const cols = TABLE.filter((c) => c.group === g);
    const grp = document.createElement("div"); grp.className = "cm-grp"; grp.innerHTML = `${esc(g)}<small>${esc(title.split(" · ").slice(1).join(" · "))}</small>`; box.appendChild(grp);
    for (const c of cols) {
      const div = document.createElement("div"); div.className = "cm-row";
      if (ROWS.includes(c.key)) {
        const r = C.rows.find((x) => x.key === c.key), up = r.ok && r.own && r.own.price > 0 && r.ends && r.ends.median && r.ends.median.price != null ? (r.ends.median.price / r.own.price - 1) * 100 : null;
        div.innerHTML = `<div class="lb">${esc(c.label)}<small>${r.n} peers · own ${esc(X(r.own ? r.own.multiple : null))}</small></div><div><svg></svg></div><div class="v${up == null ? " no" : dirCls(up)}">${up != null ? esc(UP(up)) + "<small>vs mid</small>" : esc(r.own_why || r.reason || "—")}</div>`;
        box.appendChild(div);
        const svg = div.querySelector("svg"), host = svg.parentElement;
        if (r.ok && r.band && r.band.n) { const dr = () => drawPriceRow(svg, r, host.clientWidth || 300); new ResizeObserver(dr).observe(host); requestAnimationFrame(dr); } else svg.setAttribute("height", 6);
      } else {
        const own = snap.table.company[c.key], vals = peersOn.map((t) => snap.table.peers[t] ? snap.table.peers[t][c.key] : null).filter((v) => v != null && Number.isFinite(v)).sort((a, b) => a - b);
        const med = vals.length ? median(vals) : null, rank = own != null && vals.length ? vals.filter((v) => v < own).length : null;
        const where = own == null ? "—" : !vals.length ? "no peers" : BETTER[c.key] === 0 ? `${rank} of ${vals.length} below` : (BETTER[c.key] > 0 ? rank : vals.length - rank) >= vals.length * 0.75 ? "top quarter" : (BETTER[c.key] > 0 ? rank : vals.length - rank) >= vals.length / 2 ? "upper half" : (BETTER[c.key] > 0 ? rank : vals.length - rank) >= vals.length / 4 ? "lower half" : "bottom quarter";
        div.innerHTML = `<div class="lb">${esc(c.label)}<small>${vals.length} peers · mid ${esc(F(c.fmt, med))}</small></div><div><svg></svg></div><div class="v${own == null ? " no" : ""}">${own != null ? esc(F(c.fmt, own)) + "<small>" + esc(where) + "</small>" : esc("no figure")}</div>`;
        box.appendChild(div);
        const svg = div.querySelector("svg"), host = svg.parentElement;
        if (vals.length >= 2) { const dr = () => drawPosRow(svg, vals, own, c, host.clientWidth || 300); new ResizeObserver(dr).observe(host); requestAnimationFrame(dr); } else svg.setAttribute("height", 6);
      }
    }
  }
}
function axis(vals, W, pad = 8) {
  let lo = Math.min(...vals), hi = Math.max(...vals); if (!(hi > lo)) { lo = lo - Math.abs(lo) * 0.1 - 1; hi = hi + Math.abs(hi) * 0.1 + 1; }
  const useLog = lo > 0 && hi / lo > 50, L = Math.log10, inner = W - 2 * pad;
  return { lo, hi, useLog, x: (m) => Math.round((pad + (useLog ? (L(m) - L(lo)) / (L(hi) - L(lo)) : (m - lo) / (hi - lo)) * inner) * 10) / 10 };
}
function drawPriceRow(svg, r, width) {
  const W = Math.max(160, Math.floor(width)); while (svg.firstChild) svg.removeChild(svg.firstChild);
  const b = r.band, own = r.own ? r.own.multiple : null, a = axis([b.min, b.max, own].filter((v) => v != null && v > 0), W), x = a.x;
  const H = 36, y = 20, bh = 9;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H);
  svg.appendChild(el("line", { class: "wh", x1: x(b.min), x2: x(b.max), y1: y, y2: y }));
  for (const v of [b.min, b.max]) svg.appendChild(el("line", { class: "wh", x1: x(v), x2: x(v), y1: y - 3, y2: y + 3 }));
  svg.appendChild(el("rect", { class: "box", x: x(b.q1), y: y - bh / 2, width: Math.max(1, x(b.q3) - x(b.q1)), height: bh }));
  svg.appendChild(el("line", { class: "med", x1: x(b.median), x2: x(b.median), y1: y - bh / 2 - 2, y2: y + bh / 2 + 2 }));
  const tl = el("text", { class: "n", x: x(b.min), y: y + 13, "text-anchor": "start" }, X(b.min)); svg.appendChild(tl);
  const th = el("text", { class: "n", x: x(b.max), y: y + 13, "text-anchor": "end" }, X(b.max)); svg.appendChild(th);
  const tm = el("text", { class: "n k", y: y + 13, "text-anchor": "middle" }, X(b.median)); svg.appendChild(tm);
  const wl = widthOf(tl, 28), wh = widthOf(th, 28), wm = widthOf(tm, 32);
  tm.setAttribute("x", Math.max(x(b.min) + wl + wm / 2 + 6, Math.min(x(b.max) - wh - wm / 2 - 6, x(b.median))));
  if (own != null && own > 0) { const px = x(own); svg.appendChild(el("line", { class: "me", x1: px, x2: px, y1: 2, y2: H - 2 })); const t = el("text", { class: "me-n", y: 8, "text-anchor": "middle" }, X(own)); svg.appendChild(t); const tw = widthOf(t, 30); t.setAttribute("x", Math.max(tw / 2 + 1, Math.min(W - tw / 2 - 1, px))); }
}
function drawPosRow(svg, vals, own, c, width) {
  const W = Math.max(160, Math.floor(width)); while (svg.firstChild) svg.removeChild(svg.firstChild);
  const all = own != null ? [...vals, own] : vals, canLog = all.every((v) => v > 0), lo0 = Math.min(...all), hi0 = Math.max(...all);
  const a = axis(all, W), x = a.x, n = vals.length, q = (p) => { const pos = (n - 1) * p, i = Math.floor(pos); return vals[i] + (vals[Math.min(n - 1, i + 1)] - vals[i]) * (pos - i); };
  const q1 = q(0.25), q3 = q(0.75), med = median(vals), H = 36, y = 20, bh = 9;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H);
  svg.appendChild(el("line", { class: "wh", x1: x(vals[0]), x2: x(vals[n - 1]), y1: y, y2: y }));
  for (const v of [vals[0], vals[n - 1]]) svg.appendChild(el("line", { class: "wh", x1: x(v), x2: x(v), y1: y - 3, y2: y + 3 }));
  svg.appendChild(el("rect", { class: "box", x: x(q1), y: y - bh / 2, width: Math.max(1, x(q3) - x(q1)), height: bh }));
  svg.appendChild(el("line", { class: "med", x1: x(med), x2: x(med), y1: y - bh / 2 - 2, y2: y + bh / 2 + 2 }));
  svg.appendChild(el("text", { class: "n", x: x(vals[0]), y: y + 13, "text-anchor": "start" }, F(c.fmt, vals[0])));
  svg.appendChild(el("text", { class: "n", x: x(vals[n - 1]), y: y + 13, "text-anchor": "end" }, F(c.fmt, vals[n - 1])));
  const tm = el("text", { class: "n k", y: y + 13, "text-anchor": "middle" }, F(c.fmt, med)); svg.appendChild(tm);
  tm.setAttribute("x", Math.max(x(vals[0]) + 36, Math.min(x(vals[n - 1]) - 36, x(med))));
  if (own != null) { const px = x(own); svg.appendChild(el("line", { class: "me", x1: px, x2: px, y1: 2, y2: H - 2 })); }
  void canLog; void lo0; void hi0;
}

/* ---- the full table (closed) ---------------------------------------------------------------------------- */
function tableHTML(S) {
  const { snap, T, C } = S, sel = C.sel, FL = flags(snap), peers = S.members.filter((t) => t !== T);
  const groups = [...new Set(TABLE.map((c) => c.group))];
  const head1 = `<tr><th class="l"></th><th class="l">peer</th>${groups.map((g) => `<th class="grp" colspan="${TABLE.filter((c) => c.group === g).length}">${esc(g)}</th>`).join("")}<th class="l"></th></tr>`;
  const head2 = `<tr><th></th><th class="l"></th>${TABLE.map((c) => `<th>${esc(c.label)}</th>`).join("")}<th class="l">reason</th></tr>`;
  const val = (c, v) => v == null ? "—" : F(c.fmt, v);
  const cell = (t, c) => {
    const v = snap.table.peers[t] ? snap.table.peers[t][c.key] : null;
    if (!ROWS.includes(c.key)) return `<td>${esc(val(c, v))}</td>`;
    const row = snap.rows.find((r) => r.key === c.key), vv = row.values[t] || { multiple: null }, f = FL[c.key].cells[t] || {}, off = isOff(sel, t, c.key), peerOff = sel.peers.has(t);
    if (vv.multiple == null) return `<td><span class="cell none" title="${esc(vv.why || "")}">—</span><span class="flag" title="${esc(FLAG_WORDS.nm)}: ${esc(vv.why || "")}">nm</span></td>`;
    const far = f.flag === "far" ? `<span class="flag" title="${esc(FLAG_WORDS.far)}: ${f.gaps.toFixed(1)} typical gaps from the median (threshold ${FAR_K})">far</span>` : "";
    return `<td><button type="button" class="cell${off || peerOff ? " off" : ""}" data-cm="cell" data-t="${esc(t)}" data-k="${c.key}" title="${off ? "put back" : "turn off on " + esc(SHORT[c.key]) + " only"}">${esc(X(vv.multiple))}</button>${far}</td>`;
  };
  const meRow = `<tr class="me"><td></td><td class="tk l">${esc(T)}</td>${TABLE.map((c) => `<td>${esc(val(c, snap.table.company[c.key]))}</td>`).join("")}<td class="l"></td></tr>`;
  const body = peers.map((t) => { const off = sel.peers.has(t), d = sel.list.filter((x) => x.peer === t); const reason = d.map((x) => (x.measure === "ALL" ? "" : SHORT[x.measure] + ": ") + (x.reason || "no reason yet")).join(" · ");
    const r = `<tr class="${off ? "off" : ""}" data-peer="${esc(t)}"><td><button type="button" class="tog${off ? "" : " on"}" data-cm="peer" data-t="${esc(t)}">${off ? "□" : "■"}</button></td><td class="tk l">${esc(t)}</td>${TABLE.map((c) => cell(t, c)).join("")}<td class="l">${esc(reason)}</td></tr>`;
    return S.reasonFor && S.reasonFor.peer === t ? r + reasonRowHTML(S, t) : r; }).join("");
  const stat = (label, k) => `<tr class="stat"><td></td><td class="l">${label}</td>${TABLE.map((c) => ROWS.includes(c.key) ? `<td>${esc(X(C.rows.find((r) => r.key === c.key).band[k]))}</td>` : "<td></td>").join("")}<td></td></tr>`;
  return `<div class="tw"><table class="t"><thead>${head1}${head2}</thead><tbody>${meRow}${body}${stat("median", "median")}${stat("25th", "q1")}${stat("75th", "q3")}</tbody></table></div>
    ${decisionsHTML(S)}<div class="words"><span class="flag">nm</span> no number on that measure · <span class="flag">far</span> more than ${FAR_K} typical gaps from the peer median · both only suggest; a switch is yours.</div>`;
}
function reasonRowHTML(S, t) {
  const R = S.reasonFor, chips = [FLAG_WORDS.op, FLAG_WORDS.far, FLAG_WORDS.nm];
  return `<tr class="reason"><td></td><td colspan="${TABLE.length + 2}" class="l"><div class="chips"><span style="font-size:8.5px;letter-spacing:.14em;color:var(--dim)">WHY IS ${esc(t)}${R.measure !== "ALL" ? " · " + esc(SHORT[R.measure]) : ""} OFF?</span>${chips.map((c) => `<button type="button" class="chip" data-cm="chip" data-r="${esc(c)}">${esc(c)}</button>`).join("")}<input class="in" data-cm="reason" placeholder="or your own words" value="${esc(R.reason || "")}"><button type="button" class="btn on" data-cm="savereason">Save</button><button type="button" class="btn" data-cm="closereason">Later</button></div></td></tr>`;
}
function decisionsHTML(S) {
  const L = S.C.sel.list; if (!L.length) return "";
  return `<div style="font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);margin:6px 0 3px">off · ${L.length} · <button type="button" class="btn" data-cm="putall">Put all back</button></div>${L.map((d) => `<div class="words" style="margin:1px 0"><b style="color:var(--ink)">${esc(d.peer)}</b> ${d.measure === "ALL" ? "every measure" : esc(SHORT[d.measure])} · ${esc(d.reason || "no reason yet")} <button type="button" class="btn" data-cm="putback" data-t="${esc(d.peer)}" data-k="${esc(d.measure)}">Put back</button></div>`).join("")}`;
}

/* ---- events ---------------------------------------------------------------------------------------------- */
function wire(S) {
  const det = S.root.querySelector('details[data-d="table"]');
  if (det) det.addEventListener("toggle", () => { S.open.table = det.open; const b = det.querySelector(".body"); if (det.open && !b.innerHTML.trim()) b.innerHTML = tableHTML(S); });
  S.root.onclick = async (e) => {
    const b = e.target.closest("[data-cm]"); if (!b) return;
    const a = b.dataset.cm;
    if (a === "peer" || a === "cell" || a === "putback") {
      const t = b.dataset.t, measure = a === "peer" ? "ALL" : b.dataset.k, sel = S.C.sel, off = a === "putback" ? false : !isOff(sel, t, measure);
      if (a === "cell" && sel.peers.has(t)) return;
      await storeDecision(S, decisionRow({ company: S.T, peer: t, measure, off, reason: off ? "" : "put back" }));
      S.reasonFor = off && a === "cell" ? { peer: t, measure, reason: "" } : null; if (S.reasonFor) S.open.table = true; render(S);
    } else if (a === "putall") { for (const d of S.C.sel.list) await storeDecision(S, decisionRow({ company: S.T, peer: d.peer, measure: d.measure, off: false, reason: "put back" })); S.reasonFor = null; render(S); }
    else if (a === "chip") { const inp = S.root.querySelector('[data-cm="reason"]'); if (inp) inp.value = b.dataset.r; }
    else if (a === "savereason") { const inp = S.root.querySelector('[data-cm="reason"]'), R = S.reasonFor; if (!R) return; await storeDecision(S, decisionRow({ company: S.T, peer: R.peer, measure: R.measure, off: true, reason: inp ? inp.value.trim() : "" })); S.reasonFor = null; render(S); }
    else if (a === "closereason") { S.reasonFor = null; render(S); }
    else if (a === "way") { S.way = b.dataset.w; render(S); }
    else if (a === "band" || a === "n") { S[a] = +b.dataset.v; b.textContent = "…"; try { await loadSet(S); } catch (e) { S.root.innerHTML = `<div class="err">${esc(e.message || e)}</div>`; return; } render(S); }
  };
  S.root.onkeydown = (e) => { if (e.key === "Enter" && e.target.matches('[data-cm="reason"]')) { e.preventDefault(); const s = S.root.querySelector('[data-cm="savereason"]'); if (s) s.click(); } };
}

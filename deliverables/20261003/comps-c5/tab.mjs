/* Scintilla · comps C5 (3 Oct) · the tab. Reads: C4's inputs (profiles, FMP peers, Massive related, the tree's funds)
   plus the revenue-segments fixture (or public.revenue_segments when the Hub serves it); the set by lines.mjs; the
   figures by C3's reader; the field by field.mjs; the edits in public.comps_decisions (anon insert + read), one row per
   edit, latest wins, shared by every screen.
   Order: the set (the company's lines as a cyan Geiger bar · KEEP control · the peers with why and who named them · the
   named candidates not in) · THE RANGE (one bold band: low – centre – high, today's price, the upside; WEIGH A / B / C
   beside it with the minimized field) · the weights as a row of numbers · THE FIELD going down (16 cyan bars, no frames;
   outliers hollow at the edge with an arrow and their value, one click keeps one) · the table, closed · PAGE SPECS.
   No descriptions in the content: labels, units and numbers only; every sentence sits in PAGE SPECS.
   C6 (5 Oct): outliers across the columns (outliers.mjs). A cell far from its column's median carries a small mark and
   still counts; a peer marked in 3+ columns (or 40% of its columns) is an OUTLIER: greyed at the bottom of the set and
   of the table with its count, out of every median and of the price, one click keeps it; the range prints the centre
   with / without outliers.
   C6b (5 Oct): only the valuation multiples vote (trailing and forward P/E as one vote; 3+ votes, or half the votes the
   peer has and at least two). Growth, margin, capex and leverage marks are information: a fainter cell, never a vote.
   Under the set's header: how many peers share the company's business; when fewer than half do, the set is named
   "mostly different business" and the rule does not cut the peers that share it. */
import { inputs as c4inputs, readSet, snapshotFromCohort } from "../../20261001/comps-mechanic/read.mjs";
import { SOURCE_WORDS } from "../../20261001/comps-mechanic/peers.mjs";
import { ROWS, SHORT, TABLE } from "../../20261001/comps-template/cohort.mjs";
import { decisionRow, FLAG_WORDS } from "../../20260930/comps-tab/comps-tab.mjs";
import { buildSet, lineWords, N_DEFAULT, NS, SIM_MIN, LINE_MIN, SIZE_WEIGHT, SEATS_PER_LINE, REFERENCE_PEERS } from "./lines.mjs";
import { isOff, isKept, median, quantile, WAY_WORDS, wayOf, PEG_YEARS_MAX } from "./field.mjs";
import { conclusion6, isFlagged, isVote, VOTES, CUT, MIN_N, MIN_FLAGS, SHARE, SHARE_MIN_FLAGS, LIVE_FX } from "../../20261005/comps-c6/outliers.mjs";
import { referenceOf, withReference, withReferenceQuotes } from "./reference.mjs";   /* RL1: the comps-only reference peers (SK hynix, Samsung, Kioxia), priced from their dated facts file as the cards price them */

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const SVG = "http://www.w3.org/2000/svg";
const el = (tag, a = {}, t) => { const e = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); if (t != null) e.textContent = t; return e; };
const widthOf = (t, f) => { try { const w = t.getComputedTextLength(); if (w > 0) return w; } catch (_) {} return f; };
const X = (v) => v == null || !Number.isFinite(v) ? "—" : (v < 0 ? "(" : "") + Math.abs(v).toFixed(Math.abs(v) >= 100 ? 0 : Math.abs(v) < 10 ? 2 : 1) + "x" + (v < 0 ? ")" : "");
const PCT = (v) => v == null || !Number.isFinite(v) ? "—" : (v < 0 ? "(" : "") + Math.abs(v).toFixed(Math.abs(v) >= 10 ? 0 : 1) + "%" + (v < 0 ? ")" : "");
const USD = (v) => v == null || !Number.isFinite(v) ? "—" : (v < 0 ? "(" : "") + "$" + Math.abs(v).toFixed(2) + (v < 0 ? ")" : "");
const P0 = (v) => v == null || !Number.isFinite(v) ? "—" : "$" + Math.round(v).toLocaleString("en-US");
const CAP = (v) => v == null ? "—" : v >= 1e12 ? "$" + (v / 1e12).toFixed(2) + "T" : v >= 1e9 ? "$" + (v / 1e9).toFixed(0) + "B" : "$" + (v / 1e6).toFixed(0) + "M";
const F = (kind, v) => v == null || !Number.isFinite(v) ? "—" : kind === "x" ? X(v) : kind === "x2" ? (v < 0 ? "(" : "") + Math.abs(v).toFixed(2) + "x" + (v < 0 ? ")" : "") : kind === "pct" ? PCT(v) : kind === "usd2" ? USD(v) : String(v);
const UP = (v) => v == null || !Number.isFinite(v) ? "—" : (v >= 0 ? "" : "(") + Math.abs(v).toFixed(Math.abs(v) >= 10 ? 0 : 1) + "%" + (v >= 0 ? "" : ")");
const dirCls = (v) => v == null ? "" : v >= 0 ? " up" : " dn";
const RATIO = (r) => r == null ? "—" : r >= 1 ? "×" + r.toFixed(1) : "÷" + (1 / r).toFixed(1);
const LS = "sc_comps_decisions", WAYS3 = ["A", "B", "C"];
const GROUPS = ["valuation", "growth", "margins", "balance sheet", "capex"];
const BETTER = { rev_g_ttm: 1, rev_g_fy: 1, eps_g_fy: 1, gm: 1, om: 1, fcfm: 1, nd_ebitda: -1, capex_rev: 0, capex_g: 0, rev_per_capex: 1 };
const SEG_URL = "/deliverables/20261003/comps-c5/segments-2026-10-03.json";

export const CSS = `
.cm5{font-family:var(--mono);color:var(--ink2);font-size:11px;line-height:1.5;letter-spacing:.02em;text-transform:none;overflow:hidden}
.cm5 *{box-sizing:border-box;min-width:0}
.cm5 .up{color:var(--bull)}.cm5 .dn{color:var(--bear)}
.cm5 .sec{background:var(--panel);padding:10px 12px;margin-bottom:6px;overflow:hidden}
.cm5 .hd{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:baseline;font-size:10px;color:var(--ink3);letter-spacing:.06em;margin-bottom:6px}
.cm5 .hd b{color:var(--ink);font-weight:600;letter-spacing:.14em;text-transform:uppercase;font-size:9px}
.cm5 .hd .ctl{display:inline-flex;flex-wrap:wrap;gap:2px;align-items:center;margin-left:auto}
.cm5 .hd .ctl span{font-size:8px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);margin:0 4px 0 8px}
.cm5 .hd .ctl button,.cm5 .sw button{font:inherit;font-size:9px;padding:2px 7px;background:rgba(0,212,255,.05);border:0;color:var(--ink3);cursor:pointer;letter-spacing:.08em}
.cm5 .hd .ctl button.on,.cm5 .sw button.on{color:#061015;background:var(--crk);font-weight:700}
/* the company's lines: a cyan Geiger bar */
.cm5 .lines{display:flex;height:14px;gap:2px;margin:4px 0 2px}
.cm5 .lines i{display:block;height:100%;background:rgba(0,212,255,.78);min-width:2px}
.cm5 .lines i:nth-child(2){background:rgba(0,212,255,.55)}.cm5 .lines i:nth-child(3){background:rgba(0,212,255,.4)}.cm5 .lines i:nth-child(n+4){background:rgba(0,212,255,.28)}
.cm5 .linew{font-size:9px;color:var(--ink3);letter-spacing:.06em;margin-bottom:6px}.cm5 .linew b{color:var(--crk);font-weight:600}
/* the peer set */
.cm5 table.p{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:10.5px;margin-top:4px}
.cm5 table.p th{font-size:8px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);font-weight:400;padding:4px 6px;text-align:left;white-space:nowrap}
.cm5 table.p td{padding:3px 6px;color:var(--ink2);white-space:nowrap;vertical-align:middle}
.cm5 table.p tbody tr:nth-child(odd) td{background:rgba(0,212,255,.03)}
.cm5 table.p th.r,.cm5 table.p td.r{text-align:right}
.cm5 table.p td.tk{color:var(--ink);font-weight:600;letter-spacing:.04em}
.cm5 table.p tr.me td{color:var(--ink);background:rgba(0,212,255,.09)}.cm5 table.p tr.me td.tk{color:var(--crk)}
.cm5 table.p tr.off td{color:var(--mute)}.cm5 table.p tr.off td.tk{text-decoration:line-through;color:var(--mute)}
.cm5 .sim{display:inline-block;width:46px;height:8px;background:rgba(0,212,255,.1);vertical-align:middle;margin-right:6px}.cm5 .sim i{display:block;height:100%;background:var(--crk)}
.cm5 .src{display:inline-block;font-size:7.5px;letter-spacing:.1em;padding:1px 4px;margin-right:3px;background:rgba(0,212,255,.1);color:var(--ink3);text-transform:uppercase}
.cm5 .seat{display:inline-block;font-size:7.5px;letter-spacing:.1em;padding:1px 4px;margin-left:4px;background:rgba(0,212,255,.22);color:var(--crk);text-transform:uppercase}
.cm5 .tog{background:none;border:0;cursor:pointer;font-size:12px;line-height:1;width:14px;padding:0;color:#4A4A52}.cm5 .tog.on{color:var(--crk)}.cm5 .tog:hover{color:var(--ink)}
.cm5 .notin{font-size:9.5px;color:var(--dim);margin-top:6px;line-height:1.5}.cm5 .notin b{color:var(--ink3);font-weight:400}
/* the range */
.cm5 .rg{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(220px,1fr);gap:10px 22px;align-items:start}
.cm5.narrow .rg{grid-template-columns:1fr}
.cm5 .rg svg{display:block;width:100%;height:auto;overflow:visible}
.cm5 .big{font-size:30px;font-weight:700;line-height:1;color:var(--ink);letter-spacing:-.01em}
.cm5 .k{font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:var(--dim)}
.cm5 .sw{display:flex;flex-wrap:wrap;gap:3px;align-items:center;margin:0 0 8px}
.cm5 .sw .k{margin-right:6px}
.cm5 .mini .mr{display:grid;grid-template-columns:62px minmax(0,1fr) 40px;gap:0 8px;align-items:center;height:13px}
.cm5 .mini .mr .l{font-size:7.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);white-space:nowrap;overflow:hidden}
.cm5 .mini .mr .v{font-size:8px;color:var(--ink3);text-align:right;white-space:nowrap}
.cm5 .mini .mr .v.up{color:var(--bull)}.cm5 .mini .mr .v.dn{color:var(--bear)}
.cm5 .mini .g{font-size:7px;letter-spacing:.2em;text-transform:uppercase;color:var(--mute);margin:5px 0 1px}
.cm5 .mini svg{display:block;width:100%;height:9px;overflow:visible}
.cm5 .wrow{display:grid;grid-template-columns:repeat(16,minmax(0,1fr));gap:2px;margin-top:10px}
.cm5 .wrow div{text-align:center;font-size:8px;color:var(--dim);letter-spacing:.04em;line-height:1.25;overflow:hidden;white-space:nowrap}
.cm5 .wrow div b{display:block;font-size:11px;font-weight:700;color:var(--crk)}.cm5 .wrow div.f b{color:var(--ink2)}
.cm5 .wrow div i{display:block;height:3px;background:rgba(0,212,255,.15);margin-top:3px}.cm5 .wrow div i em{display:block;height:100%;background:var(--crk)}.cm5 .wrow div.f i em{background:var(--ink3)}
.cm5 .wk{font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:var(--dim);margin-top:8px}
/* the field */
.cm5 .grp{font-size:8.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--dim);padding:10px 0 3px}
.cm5 .row{display:grid;grid-template-columns:118px minmax(0,1fr) 74px;gap:0 12px;align-items:center;padding:4px 0}
.cm5.narrow .row{grid-template-columns:84px minmax(0,1fr) 60px}
.cm5 .row .lb{font-size:10.5px;color:var(--ink);font-weight:600;line-height:1.25}
.cm5 .row .lb small{display:block;font-size:8px;color:var(--mute);letter-spacing:.08em;font-weight:400;text-transform:uppercase;margin-top:1px}
.cm5 .row svg{display:block;width:100%;height:auto;overflow:visible}
.cm5 .row .v{font-size:13px;font-weight:700;text-align:right;white-space:nowrap;color:var(--ink)}
.cm5 .row .v small{display:block;font-size:7.5px;font-weight:400;letter-spacing:.14em;color:var(--mute);text-transform:uppercase}
.cm5 .row .v.no{color:var(--mute);font-weight:400}
.cm5 .bar{fill:rgba(0,212,255,.22)}.cm5 .mid{fill:rgba(0,212,255,.62)}.cm5 .med{stroke:var(--crk);stroke-width:2}
.cm5 .band{fill:rgba(0,212,255,.26)}.cm5 .band2{fill:rgba(0,212,255,.55)}
.cm5 .n{font-size:9px;fill:var(--ink3)}.cm5 .n.k{fill:var(--ink);font-weight:600}
.cm5 .me{stroke:var(--ink);stroke-width:1.6}.cm5 .me-n{font-size:10.5px;font-weight:700;fill:var(--ink);paint-order:stroke;stroke:var(--panel);stroke-width:3px;stroke-linejoin:round}
.cm5 .out{fill:none;stroke:var(--crk);stroke-width:1.2;cursor:pointer;pointer-events:all}.cm5 .out.kept{fill:var(--crk)}.cm5 .out-n{font-size:8px;fill:var(--crk);cursor:pointer}
.cm5 .lab{font-size:8px;letter-spacing:.12em;fill:var(--dim)}
/* the table */
.cm5 details.d{margin-top:4px;background:var(--panel)}
.cm5 details.d > summary{list-style:none;cursor:pointer;display:flex;gap:10px;align-items:center;padding:8px 12px;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink3)}
.cm5 details.d > summary::-webkit-details-marker{display:none}
.cm5 details.d > summary::before{content:"+";color:var(--crk);font-size:12px;width:10px;display:inline-block}
.cm5 details.d[open] > summary::before{content:"−"}
.cm5 details.d > summary small{color:var(--mute);letter-spacing:.06em;text-transform:none;font-size:9.5px;margin-left:auto}
.cm5 details.d > .body{padding:4px 12px 10px}
.cm5 .tw{overflow-x:auto;scrollbar-width:thin}
.cm5 table.t{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:10.5px}
.cm5 table.t th{font-size:8px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);font-weight:400;padding:6px 5px 4px;text-align:right;white-space:nowrap}
.cm5 table.t th.l,.cm5 table.t td.l{text-align:left}.cm5 table.t th.grp{text-align:center;color:var(--ink3);letter-spacing:.2em}
.cm5 table.t td{padding:3px 5px;text-align:right;color:var(--ink2);white-space:nowrap}
.cm5 table.t tbody tr:nth-child(odd) td{background:rgba(0,212,255,.03)}
.cm5 table.t td.tk{color:var(--ink);font-weight:600}.cm5 table.t tr.me td{color:var(--ink);background:rgba(0,212,255,.09)}.cm5 table.t tr.me td.tk{color:var(--crk)}
.cm5 .tw table.t th:nth-child(1),.cm5 .tw table.t td:nth-child(1){position:sticky;left:0;background:var(--panel);z-index:2}
.cm5 .tw table.t th:nth-child(2),.cm5 .tw table.t td:nth-child(2){position:sticky;left:20px;background:var(--panel);z-index:2}
.cm5 table.t tr.off td{color:var(--mute)}.cm5 table.t tr.off td.tk{text-decoration:line-through}
.cm5 table.t tr.stat td{color:var(--ink3);font-size:10px}.cm5 table.t tr.stat td.l{letter-spacing:.12em;text-transform:uppercase;font-size:8px;color:var(--dim)}
.cm5 .cell{background:none;border:0;padding:0;margin:0;font:inherit;color:inherit;cursor:pointer}.cm5 .cell:hover{color:var(--crk)}.cm5 .cell.off{color:var(--mute);text-decoration:line-through}.cm5 .cell.none{color:var(--mute);cursor:default;text-decoration:none}.cm5 .cell.o{color:var(--crk);text-decoration:line-through}.cm5 .cell.o.kept{text-decoration:none}
.cm5 .flag{display:inline-block;font-size:7px;letter-spacing:.1em;padding:0 3px;margin-left:3px;background:rgba(0,212,255,.1);color:var(--ink3);vertical-align:middle;text-decoration:none}
.cm5 .reason td{padding:5px 6px 7px;white-space:normal;background:rgba(0,212,255,.05)}
.cm5 .chips{display:flex;flex-wrap:wrap;gap:5px;align-items:center}
.cm5 .chip,.cm5 .btn{font:inherit;font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;padding:4px 8px;background:rgba(0,212,255,.06);border:0;color:var(--ink3);cursor:pointer}
.cm5 .chip:hover,.cm5 .btn:hover{color:var(--ink)}.cm5 .btn.on{color:#061015;background:var(--crk)}
.cm5 .in{font:inherit;font-size:10.5px;background:var(--panel2);color:var(--ink);border:0;padding:4px 7px;min-width:160px;flex:1 1 160px}
.cm5 table.t td.fl,.cm5 table.t td.fl .cell{color:var(--crk);font-weight:600}.cm5 table.t td.fl{background:rgba(0,212,255,.12)}.cm5 .fl i{font-style:normal;font-size:8px;margin-left:3px;vertical-align:1px}
.cm5 table.p tr.o6 td,.cm5 table.t tr.o6 td{color:var(--dim);background:rgba(134,138,170,.07)}.cm5 table.p tr.o6 td.tk,.cm5 table.t tr.o6 td.tk{color:var(--ink3)}
.cm5 table.p tr.o6 .sim i{background:var(--dim)}.cm5 table.t tr.o6 td.fl{color:var(--crk);background:rgba(0,212,255,.08)}
.cm5 .o6n{display:inline-block;font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);margin-left:6px}.cm5 .o6n b{color:var(--crk);font-weight:600}
.cm5 .o6n.s{display:none}.cm5.narrow .o6n.s{display:inline-block}.cm5 .o6n.l{margin-left:0}
.cm5 .tog.o6{color:var(--dim)}
.cm5 table.t td.fl.inf,.cm5 table.t td.fl.inf .cell{font-weight:400}.cm5 table.t td.fl.inf,.cm5 table.t tr.o6 td.fl.inf{background:rgba(0,212,255,.04)}
.cm5 .biz{font-size:10px;color:var(--ink3);letter-spacing:.06em;margin:0 0 8px;text-transform:uppercase}.cm5 .biz b{color:var(--ink);font-weight:700}.cm5 .biz.warn b{color:var(--crk)}.cm5 .biz span{margin-right:14px}
.cm5 .wwo{font-size:10px;color:var(--ink3);letter-spacing:.06em;margin:0 0 8px}.cm5 .wwo b{color:var(--ink);font-weight:700;font-size:12px}.cm5 .wwo span{margin-right:14px;white-space:nowrap}
.cm5 .words{font-size:10px;color:var(--ink3);line-height:1.55;margin:6px 0 0}
.cm5 .err{padding:8px 10px;color:var(--bear);font-size:10.5px}
.cm5 .loading{color:var(--ink3);font-size:10px;padding:12px 2px;letter-spacing:.2em}
/* PAGE SPECS: V1 styles .sc-pagespecs globally; this fallback applies until then */
.cm5 details.sc-pagespecs{margin-top:10px;background:var(--panel2);font-size:10.5px;line-height:1.6;color:var(--ink3)}
.cm5 details.sc-pagespecs > summary{cursor:pointer;padding:8px 12px;font-size:9px;letter-spacing:.24em;text-transform:uppercase;color:var(--dim);list-style:none}
.cm5 details.sc-pagespecs > summary::-webkit-details-marker{display:none}
.cm5 details.sc-pagespecs > div{padding:2px 14px 12px}.cm5 details.sc-pagespecs p{margin:6px 0}.cm5 details.sc-pagespecs b{color:var(--ink2);font-weight:600}`;

function ensureCSS() { if (!document.getElementById("cm5-css")) { const s = document.createElement("style"); s.id = "cm5-css"; s.textContent = CSS; document.head.appendChild(s); } }
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
/* RL1 (7 Oct) — the tab prices on LIVE_FX (comps-c6/outliers.mjs), the switches the cards, the knockout and the allocation tool
   were built on. With `reference` on, the three foreign memory makers are read from the same dated facts file the cards read
   (the newest one on file); when it cannot be read they carry no figures and are left out of the price, as a card does. */
const REF_FACTS_URL = "/deliverables/20261003/comps-c5/reference-peers-facts-20261007.json";
let REF_FACTS = null;
async function refFacts() { if (!LIVE_FX.reference) return false; if (REF_FACTS !== null) return REF_FACTS; try { REF_FACTS = await fetchJson(REF_FACTS_URL); } catch (_) { REF_FACTS = false; } return REF_FACTS; }
/** The segments: public.revenue_segments when the Hub serves it, else the dated fixture. */
async function segments(pg) {
  try {
    const rows = []; for (let off = 0; off < 20000; off += 1000) { const page = await pg(`revenue_segments?select=ticker,kind,segment,revenue,fiscal_year,fiscal_date,reported_currency&limit=1000&offset=${off}`); rows.push(...page); if (page.length < 1000) break; }
    if (rows.length) { const out = {}; for (const r of rows) { const o = out[r.ticker] ||= {}; const k = o[r.kind] ||= { fy: r.fiscal_year, date: r.fiscal_date, currency: r.reported_currency, data: {} }; k.data[r.segment] = Number(r.revenue); } return { companies: out, from: "public.revenue_segments" }; }
  } catch (_) {}
  try { const f = await fetchJson(SEG_URL); return { companies: f.companies || {}, from: f.source || "fixture", taken: f.taken }; } catch (_) { return { companies: {}, from: "none" }; }
}

export async function mountCompsTab(root, opts) {
  /* CP4 (7 Oct 2026): THE ARTIFACT FIRST. The one comps engine's reading of this name is drawn when it exists; this in-browser
     reader runs only for a name the artifact does not carry, and says so. */
  try { const ce = await import("/deliverables/20261007/comps-engine/tab.mjs"); root.dataset.mounted = String(opts.ticker).toUpperCase(); if (await ce.mountFromArtifact(root, opts)) { root.dataset.source = "comps-engine"; return; } } catch (_) {}
  root.dataset.source = "in-browser (not in the engine's artifact)";
  ensureCSS();
  const T = String(opts.ticker).toUpperCase();
  root.classList.add("cm5"); root.classList.toggle("narrow", root.clientWidth < 560); root.dataset.mounted = T;
  root.innerHTML = `<div class="loading">NOT IN THE ENGINE'S ARTIFACT — BUILDING THE COMPARABLE SET OF ${esc(T)} IN THE BROWSER…</div>`;
  const S = { root, opts, T, n: opts.n || N_DEFAULT, way: "C", reasonFor: null, open: {} };
  try {
    if (!INPUTS || Date.now() - INPUTS_AT > TTL) { const [inp, seg] = await Promise.all([c4inputs({ pg: opts.pg, fetchJson }), segments(opts.pg)]); inp.segments = seg.companies; inp.segments_from = seg.from; const facts = await refFacts(); if (facts) inp.reference = referenceOf(facts).peers; INPUTS = inp; INPUTS_AT = Date.now(); }
    S.inp = INPUTS;
    await loadSet(S);
  } catch (e) { root.innerHTML = `<div class="err"><b>${esc(T)}</b>: the comparable set could not be built — ${esc(e && e.message || e)}.</div>`; return; }
  if (root.dataset.mounted !== T) return;
  root._cm = S;
  render(S);
  const fit = () => root.classList.toggle("narrow", root.clientWidth < 560);
  fit(); new ResizeObserver(fit).observe(root);
}
async function loadSet(S) {
  S.set = buildSet(S.T, S.inp, { n: S.n, fx: LIVE_FX });
  const served = { ...S.set, kept: S.set.kept.filter((r) => !r.reference || r.has_figures) };   /* RL1: a reference peer with no figures is shown in the set and never read (the cards' rule) */
  const facts = await refFacts(), pg = facts ? withReference(S.opts.pg, facts) : S.opts.pg, quotes = facts ? withReferenceQuotes(S.opts.quotes, facts) : S.opts.quotes;
  const key = S.T + "|" + [S.T, ...served.kept.map((r) => r.ticker)].join(",");
  const hit = CTX.get(key);
  if (hit && Date.now() - hit.at < TTL) { S.ctx = hit.ctx; S.estimates = hit.estimates; }
  else {
    let fx = await standin();
    if (fx && facts && facts.fx) { const ref = referenceOf(facts).peers, rates = { ...(fx.rates || {}) }, reported = { ...(fx.reported || {}) };   /* RL1: the won and yen rates and the reference peers' currencies ride with the stand-in, as in the cards' run */
      for (const [c, rows] of Object.entries(facts.fx)) if (rows && rows.length && !(rates[c] && rates[c].length)) rates[c] = rows;
      for (const [t, c] of Object.entries(ref)) reported[t] = c.currency; fx = { ...fx, rates, reported }; }
    S.ctx = await readSet(S.T, served, { today: S.opts.today, pg, quotes, livePrices: S.opts.livePrices || {}, fxStandin: fx || null });
    let est = []; try { est = await pg(`analyst_estimates?select=ticker,fiscal_date,est_eps_avg&period=eq.annual&ticker=in.(${S.ctx.members.map(encodeURIComponent).join(",")})&fiscal_date=gte.${S.opts.today}&order=ticker.asc,fiscal_date.asc`); } catch (_) { est = []; }
    S.estimates = Object.fromEntries(S.ctx.inputs.map((i) => [i.ticker, { eps_ttm: i.eps_ttm ?? null, est: (est || []).filter((e) => e.ticker === i.ticker).map((e) => ({ fiscal_date: e.fiscal_date, eps: e.est_eps_avg })) }]));
    CTX.set(key, { ctx: S.ctx, estimates: S.estimates, at: Date.now() });
  }
  S.members = S.ctx.members.filter((t) => !S.ctx.excluded.some((e) => e.ticker === t));
  S.snap = snapshotFromCohort(S.ctx, S.T);
  const dec = await loadDecisions(S.opts, S.members); S.decisions = dec.rows; S.mode = dec.mode;
}

function render(S) {
  const { T, set } = S;
  const C = conclusion6(S.snap, S.decisions, S.estimates, S.opts.today, S.way, { set: S.set, fx: LIVE_FX }); S.C = C;
  const snap = C.snap, w = wayOf(C.ways, S.way), peers = S.members.filter((t) => t !== T);
  const h = [];
  /* the set */
  const L = set.own_lines, linesBar = Object.entries(L.lines).sort((a, b) => b[1] - a[1]);
  h.push(`<div class="sec"><div class="hd"><b>comparables</b><span>${esc(set.own_industry || "industry unknown")}${snap.sector ? " · " + esc(snap.sector) : ""} · ${esc(CAP(set.own_market_cap))}</span><span class="ctl"><span>keep</span>${NS.map((v) => `<button type="button" data-cm="n" data-v="${v}" class="${S.n === v ? "on" : ""}">${v}</button>`).join("")}</span></div>
    <div class="lines" title="${esc(L.from)}">${linesBar.map(([l, v]) => `<i style="flex:${Math.max(0.02, v)}" title="${esc(l)} ${Math.round(v * 100)}%"></i>`).join("")}</div>
    <div class="linew">${linesBar.map(([l, v]) => `<b>${esc(l)}</b> ${Math.round(v * 100)}%`).join(" · ")} <span style="color:var(--mute)">· ${esc(L.source)}</span></div>
    ${bizHTML(C.c6.business, C.c6)}${setTableHTML(S)}</div>`);
  /* the range */
  const lw = (ww) => ww && ww.ok ? esc(P0(ww.mid)) : "—";
  h.push(`<div class="sec"><div class="hd"><b>the range</b><span>way ${esc(S.way)} · ${C.peersOn.length} of ${peers.length} peers in · ${C.c6.outliers.length} outlier${C.c6.outliers.length === 1 ? "" : "s"} out · ${C.c6.flaggedCells} cells marked</span></div>
    <div class="wwo" id="cm5Wwo"><span>with outliers <b>${esc(P0(C.c6.centre.with))}</b></span><span>without outliers <b>${esc(P0(C.c6.centre.without))}</b></span></div>
    <div class="rg"><div><div id="cm5Band"><svg></svg></div></div>
    <div><div class="sw"><span class="k">weigh</span>${WAYS3.map((k) => `<button type="button" data-cm="way" data-w="${k}" class="${S.way === k ? "on" : ""}" title="${esc(WAY_WORDS[k].plain)}">${k} ${lw(wayOf(C.ways, k))}</button>`).join("")}</div><div class="mini" id="cm5Mini"></div></div></div>
    ${weightsHTML(S)}</div>`);
  /* the field */
  h.push(`<div class="sec" id="cm5Field"></div>`);
  /* the table */
  h.push(`<details class="d" data-d="table"${S.open.table ? " open" : ""}><summary>the table<small>${peers.length} peers · ${TABLE.length} columns · on / off per cell · keep per outlier</small></summary><div class="body">${S.open.table ? tableHTML(S) : ""}</div></details>`);
  h.push(pageSpecsHTML(S));
  S.root.innerHTML = h.join("");
  drawBand(S); drawMini(S); drawField(S);
  wire(S);
}

/* ---- the set ------------------------------------------------------------------------------------------ */
/* C6b 4 · how many peers share the company's business; under half, the set is named (labels only, the sentence is in PAGE SPECS) */
/* RL1: a comps-only reference peer is shown by its name (SK hynix), never by its home listing's code (000660.KS) */
const peerName = (t) => (REFERENCE_PEERS[t] && REFERENCE_PEERS[t].name) || t;
function bizHTML(b, c6) {
  if (!b) return "";
  /* RL1: when the price comes from the peers that share the business (LIVE_FX), the line says that — the others are shown, not priced */
  if (c6 && c6.pricedOn === "business") return `<div class="biz" id="cm5Biz"><span><b>the ${c6.businessPeers.length} peers that price it</b> — ${esc(b.line || "the same business")}</span><span>${c6.notPriced.length} more shown, not priced</span></div>`;   /* the allocation tool's own words for the same line (step 5b) */
  const n = `<span><b>${b.same.length} of ${b.n}</b> peers share ${esc(b.line || "the business")}</span>`;
  return b.mostlyDifferent ? `<div class="biz warn" id="cm5Biz"><span><b>peer set mostly different business</b></span>${n}<span>fix the peers, not the outliers</span></div>` : `<div class="biz" id="cm5Biz">${n}</div>`;
}
function setTableHTML(S) {
  const { set, T, C } = S, sel = C.sel, names = S.snap.names || {}, c6 = C.c6, sc = c6.score;
  const row = (r) => { const o6 = c6.ruleOff.has(r.ticker), k6 = c6.kept.includes(r.ticker), n6 = c6.notCut.includes(r.ticker), off = !o6 && sel.peers.has(r.ticker), top = r.shared.slice(0, 2), w6 = o6 ? "outlier" : k6 ? "kept" : "same business · not cut";
    const mark = o6 || k6 || n6 ? `<span class="o6n s" title="${esc(sc[r.ticker].flags.map((f) => f.short + " " + Math.abs(f.d).toFixed(1) + " spreads " + (f.side === "high" ? "above" : "below")).join(" · "))}"><b>${w6}</b> · ${sc[r.ticker].n} of ${sc[r.ticker].have}</span>` : "", long = o6 || k6 || n6 ? `<span class="o6n l"><b>${w6}</b> · ${esc(sc[r.ticker].words)}</span>` : "";
    const tog = o6 || k6 ? `<button type="button" class="tog${o6 ? " o6" : " on"}" data-cm="keeppeer" data-t="${esc(r.ticker)}" title="${o6 ? "keep in the medians and the price" : "let the rule leave it out again"}">${o6 ? "◇" : "◆"}</button>` : `<button type="button" class="tog${off ? "" : " on"}" data-cm="peer" data-t="${esc(r.ticker)}" title="${off ? "put back" : "turn off"}">${off ? "□" : "■"}</button>`;
    return `<tr class="${o6 ? "o6" : off ? "off" : ""}"${o6 ? ` data-o6="${esc(r.ticker)}"` : ""}><td>${tog}</td><td class="tk" title="${esc(names[r.ticker] || peerName(r.ticker))}">${esc(peerName(r.ticker))}${mark}</td><td><span class="sim" title="similarity ${r.sim.toFixed(2)}"><i style="width:${Math.round(Math.min(1, r.sim) * 100)}%"></i></span>${r.sim.toFixed(2)}</td><td>${long ? long : top.length ? top.map((s) => `${esc(s.line)} <span style="color:var(--mute)">${Math.round(s.own * 100)}·${Math.round(s.peer * 100)}%</span>`).join(", ") : esc(r.why.replace(/^same family \(([^)]+)\): (.*)$/, "$2 · $1 family"))}${r.seat ? `<span class="seat">seat</span>` : ""}</td><td><span class="src" title="${esc(r.line_from)}">${esc(r.line_source)}</span>${r.sources.map((s) => `<span class="src" title="${esc(SOURCE_WORDS[s] || s)}">${s === "MASSIVE" ? "mas" : s.toLowerCase()}</span>`).join("")}</td><td class="r">${esc(CAP(r.market_cap))}</td><td class="r">${esc(RATIO(r.ratio))}</td></tr>`; };
  const notin = set.named_not_in.filter((d) => !/not served|same company/.test(d.why)).slice(0, 12), unserved = set.named_not_in.filter((d) => /not served/.test(d.why)).length;
  return `<div class="tw"><table class="p"><thead><tr><th></th><th>peer</th><th>shares</th><th>the business they share · ${esc(T)}·peer</th><th>decided by · named by</th><th class="r">market value</th><th class="r">size vs ${esc(T)}</th></tr></thead><tbody>
    <tr class="me"><td></td><td class="tk">${esc(T)}</td><td></td><td>${esc(lineWords(set.own_lines))}</td><td><span class="src">${esc(set.lines_source)}</span></td><td class="r">${esc(CAP(set.own_market_cap))}</td><td class="r">1×</td></tr>
    ${[...set.kept.filter((r) => !c6.ruleOff.has(r.ticker)), ...c6.outliers.map((t) => set.kept.find((r) => r.ticker === t)).filter(Boolean)].map(row).join("")}</tbody></table></div>
    ${notin.length || unserved ? `<div class="notin">Not in: ${notin.map((d) => `<b>${esc(d.ticker)}</b> ${esc(d.why)}`).join(" · ")}${unserved ? ` · ${unserved} named but not served on the Hub` : ""}.</div>` : ""}`;
}

/* ---- the range: one bold band --------------------------------------------------------------------------- */
function drawBand(S) {
  const box = S.root.querySelector("#cm5Band"); if (!box) return;
  const svg = box.querySelector("svg"), C = S.C, price = S.snap.price, w = wayOf(C.ways, S.way);
  const d = () => {
    const W = Math.max(240, box.clientWidth || 320); while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (!C.band) { svg.setAttribute("height", 30); svg.appendChild(el("text", { class: "n", x: 0, y: 16 }, "—")); return; }
    const b = C.band, vals = [b.lo, b.hi, price]; let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * 0.14 || 1; lo -= pad; hi += pad;
    const H = 150, y = 84, bh = 34, x = (p) => Math.round((10 + ((p - lo) / (hi - lo)) * (W - 20)) * 10) / 10;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H);
    const defs = el("defs"); const g = el("linearGradient", { id: "cm5g", x1: 0, x2: 1, y1: 0, y2: 0 }); g.appendChild(el("stop", { offset: "0", "stop-color": "#00D4FF", "stop-opacity": ".18" })); g.appendChild(el("stop", { offset: ".5", "stop-color": "#00D4FF", "stop-opacity": ".62" })); g.appendChild(el("stop", { offset: "1", "stop-color": "#00D4FF", "stop-opacity": ".18" })); defs.appendChild(g); svg.appendChild(defs);
    svg.appendChild(el("rect", { x: 10, y: y - 3, width: W - 20, height: 6, fill: "rgba(0,212,255,.08)" }));
    svg.appendChild(el("rect", { x: x(b.lo), y: y - bh / 2, width: Math.max(2, x(b.hi) - x(b.lo)), height: bh, fill: "url(#cm5g)" }));
    svg.appendChild(el("line", { x1: x(b.mid), x2: x(b.mid), y1: y - bh / 2 - 10, y2: y + bh / 2 + 10, stroke: "#00D4FF", "stroke-width": 3 }));
    const lab = (p, word, anchor, yy, cls = "n", dx = 0) => { const t = el("text", { class: cls, x: x(p) + dx, y: yy, "text-anchor": anchor }, word); svg.appendChild(t); return t; };
    lab(b.lo, "LOW", "start", y + bh / 2 + 22, "lab"); lab(b.lo, P0(b.lo), "start", y + bh / 2 + 36, "n k");
    lab(b.hi, "HIGH", "end", y + bh / 2 + 22, "lab"); lab(b.hi, P0(b.hi), "end", y + bh / 2 + 36, "n k");
    const cx = Math.max(x(lo) + 70, Math.min(x(hi) - 70, x(b.mid)));
    const tc = el("text", { class: "lab", x: cx, y: 12, "text-anchor": "middle", fill: "#00D4FF" }, (S.way === "C" ? "CENTRE · WEIGHTED MEDIAN" : "CENTRE · MEDIAN OF THE MEDIANS")); svg.appendChild(tc);
    const tb = el("text", { x: cx, y: 40, "text-anchor": "middle", fill: "#F2F2F8", "font-size": "26", "font-weight": "700" }, P0(b.mid)); svg.appendChild(tb);
    const tm = el("text", { class: "n", x: cx, y: 55, "text-anchor": "middle" }, `midpoint ${P0(b.midpoint)} · ${UP(C.upside.mid.pct)} to the centre`); svg.appendChild(tm); tm.setAttribute("fill", C.upside.mid.pct >= 0 ? "var(--bull)" : "var(--bear)");
    const px = x(price);
    svg.appendChild(el("line", { class: "me", x1: px, x2: px, y1: y - bh / 2 - 6, y2: y + bh / 2 + 16 }));
    svg.appendChild(el("polygon", { points: `${px - 5},${y + bh / 2 + 16} ${px + 5},${y + bh / 2 + 16} ${px},${y + bh / 2 + 10}`, fill: "var(--ink)" }));
    const tp = el("text", { class: "me-n", y: y + bh / 2 + 36 + 14, "text-anchor": px < 70 ? "start" : px > W - 70 ? "end" : "middle" }, `TODAY ${P0(price)}`); svg.appendChild(tp); tp.setAttribute("x", px < 70 ? px + 2 : px > W - 70 ? px - 2 : px);
  };
  new ResizeObserver(d).observe(box); requestAnimationFrame(d);
}

/* ---- the minimized field beside WEIGH ------------------------------------------------------------------ */
function drawMini(S) {
  const box = S.root.querySelector("#cm5Mini"); if (!box) return;
  const { C, T } = S, snap = C.snap; box.innerHTML = "";
  for (const g of GROUPS) {
    const gl = document.createElement("div"); gl.className = "g"; gl.textContent = g; box.appendChild(gl);
    for (const c of TABLE.filter((x) => x.group === g)) {
      const d = document.createElement("div"); d.className = "mr";
      let vals = [], own = null, fmt = c.fmt, up = null;
      if (ROWS.includes(c.key)) { const r = C.rows.find((x) => x.key === c.key); vals = (r.peers || []).map((p) => p.multiple).filter((v) => v != null); own = r.own ? r.own.multiple : null; up = r.ok && r.own && r.own.price > 0 && r.ends && r.ends.median && r.ends.median.price != null ? (r.ends.median.price / r.own.price - 1) * 100 : null; }
      else { own = snap.table.company[c.key]; vals = C.peersOn.map((t) => snap.table.peers[t] ? snap.table.peers[t][c.key] : null).filter((v) => v != null && Number.isFinite(v)); }
      d.innerHTML = `<div class="l">${esc(SHORT[c.key] || c.label)}</div><div><svg></svg></div><div class="v${ROWS.includes(c.key) ? dirCls(up) : ""}">${ROWS.includes(c.key) ? (up != null ? esc(UP(up)) : "—") : esc(F(fmt, own))}</div>`;
      box.appendChild(d);
      const svg = d.querySelector("svg"), host = svg.parentElement, dr = () => miniBar(svg, vals, own, host.clientWidth || 120); new ResizeObserver(dr).observe(host); requestAnimationFrame(dr);
    }
  }
}
function miniBar(svg, vals, own, width) {
  const W = Math.max(60, Math.floor(width)), H = 9; while (svg.firstChild) svg.removeChild(svg.firstChild);
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H);
  const s = vals.slice().sort((a, b) => a - b); if (s.length < 2) { svg.appendChild(el("rect", { x: 0, y: 3, width: W, height: 3, fill: "rgba(0,212,255,.06)" })); return; }
  const all = own != null ? [...s, own] : s, a = axis(all, W, 2), x = a.x, q1 = quantile(s, 0.25), q3 = quantile(s, 0.75), med = median(s);
  svg.appendChild(el("rect", { class: "bar", x: x(s[0]), y: 3, width: Math.max(1, x(s[s.length - 1]) - x(s[0])), height: 3 }));
  svg.appendChild(el("rect", { class: "mid", x: x(q1), y: 1, width: Math.max(1, x(q3) - x(q1)), height: 7 }));
  svg.appendChild(el("line", { class: "med", x1: x(med), x2: x(med), y1: 0, y2: 9 }));
  if (own != null && Number.isFinite(own)) svg.appendChild(el("line", { class: "me", x1: x(own), x2: x(own), y1: -1, y2: 10 }));
}
function weightsHTML(S) {
  const { C } = S, mw = C.measureWeights, pw = C.peerWeights;
  const cells = TABLE.map((c) => { const v = ROWS.includes(c.key) ? mw.weights[c.key] || 0 : pw.rowWeights[c.key] || 0; return `<div class="${ROWS.includes(c.key) ? "" : "f"}" title="${esc(c.label)}">${esc(SHORT[c.key] || c.label)}<b>${Math.round(v * 100)}</b><i><em style="width:${Math.round(v * 100)}%"></em></i></div>`; });
  return `<div class="wk">weights % · measures → price · fundamentals → peer match</div><div class="wrow">${cells.join("")}</div>`;
}

/* ---- the field: 16 cyan Geiger bars, outliers at the edge ----------------------------------------------- */
function drawField(S) {
  const box = S.root.querySelector("#cm5Field"); if (!box) return;
  const { C, T } = S, snap = C.snap, peersOn = C.peersOn;
  box.innerHTML = `<div class="hd"><b>the field</b><span>16 measures · ${esc(T)} is the white line · ${peersOn.length} peers</span></div>`;
  for (const g of GROUPS) {
    const cols = TABLE.filter((c) => c.group === g);
    const grp = document.createElement("div"); grp.className = "grp"; grp.textContent = g; box.appendChild(grp);
    for (const c of cols) {
      const div = document.createElement("div"); div.className = "row";
      if (ROWS.includes(c.key)) {
        const r = C.rows.find((x) => x.key === c.key), up = r.ok && r.own && r.own.price > 0 && r.ends && r.ends.median && r.ends.median.price != null ? (r.ends.median.price / r.own.price - 1) * 100 : null;
        const ex = r.outliers ? r.outliers.excluded.length : 0;
        div.innerHTML = `<div class="lb">${esc(c.label)}<small>${r.n} peers${ex ? " · " + ex + " out" : ""} · own ${esc(X(r.own ? r.own.multiple : null))}</small></div><div><svg></svg></div><div class="v${up == null ? " no" : dirCls(up)}">${up != null ? esc(UP(up)) + "<small>vs mid</small>" : "—"}</div>`;
        box.appendChild(div);
        const svg = div.querySelector("svg"), host = svg.parentElement;
        if (r.band && r.band.n >= 2) { const dr = () => drawPriceRow(S, svg, r, host.clientWidth || 300); new ResizeObserver(dr).observe(host); requestAnimationFrame(dr); } else svg.setAttribute("height", 6);
      } else {
        const own = snap.table.company[c.key], vals = peersOn.map((t) => ({ ticker: t, v: snap.table.peers[t] ? snap.table.peers[t][c.key] : null })).filter((x) => x.v != null && Number.isFinite(x.v)).sort((a, b) => a.v - b.v);
        const vs = vals.map((x) => x.v), med = vs.length ? median(vs) : null, rank = own != null && vs.length ? vs.filter((v) => v < own).length : null;
        const where = own == null ? "—" : !vs.length ? "no peers" : BETTER[c.key] === 0 ? `${rank} of ${vs.length} below` : (BETTER[c.key] > 0 ? rank : vs.length - rank) >= vs.length * 0.75 ? "top quarter" : (BETTER[c.key] > 0 ? rank : vs.length - rank) >= vs.length / 2 ? "upper half" : (BETTER[c.key] > 0 ? rank : vs.length - rank) >= vs.length / 4 ? "lower half" : "bottom quarter";
        div.innerHTML = `<div class="lb">${esc(c.label)}<small>${vs.length} peers · mid ${esc(F(c.fmt, med))}</small></div><div><svg></svg></div><div class="v${own == null ? " no" : ""}">${own != null ? esc(F(c.fmt, own)) + "<small>" + esc(where) + "</small>" : "—"}</div>`;
        box.appendChild(div);
        const svg = div.querySelector("svg"), host = svg.parentElement;
        if (vs.length >= 2) { const dr = () => drawPosRow(svg, vs, own, c, host.clientWidth || 300); new ResizeObserver(dr).observe(host); requestAnimationFrame(dr); } else svg.setAttribute("height", 6);
      }
    }
  }
}
function axis(vals, W, pad = 8) {
  let lo = Math.min(...vals), hi = Math.max(...vals); if (!(hi > lo)) { lo = lo - Math.abs(lo) * 0.1 - 1; hi = hi + Math.abs(hi) * 0.1 + 1; }
  const useLog = lo > 0 && hi / lo > 50, L = Math.log10, inner = W - 2 * pad;
  return { lo, hi, useLog, x: (m) => Math.round((pad + (useLog ? (L(m) - L(lo)) / (L(hi) - L(lo)) : (m - lo) / (hi - lo)) * inner) * 10) / 10 };
}
/** A valuation row: the peers' range as a filled cyan bar, the middle half brighter, the median a cyan tick, the company a
    white line; the scale WITHOUT the excluded outliers, which sit at the edge, hollow, with an arrow and their value. */
function drawPriceRow(S, svg, r, width) {
  const W = Math.max(160, Math.floor(width)); while (svg.firstChild) svg.removeChild(svg.firstChild);
  const b = r.band, own = r.own ? r.own.multiple : null, flagged = (r.outliers && r.outliers.flagged) || [], excluded = new Set((r.outliers && r.outliers.excluded) || []), keptSet = new Set((r.outliers && r.outliers.kept) || []);
  const H = 36, y = 20, bh = 10, padL = 8, padR = flagged.some((o) => excluded.has(o.ticker) && o.side === "high") ? 70 : 8, padLL = flagged.some((o) => excluded.has(o.ticker) && o.side === "low") ? 70 : padL;
  const a = axis([b.min, b.max, own].filter((v) => v != null && v > 0), W - padLL - padR + 16, 8), x = (m) => a.x(m) + padLL - 8;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H);
  svg.appendChild(el("rect", { class: "bar", x: x(b.min), y: y - 3, width: Math.max(1, x(b.max) - x(b.min)), height: 6 }));
  svg.appendChild(el("rect", { class: "mid", x: x(b.q1), y: y - bh / 2, width: Math.max(1, x(b.q3) - x(b.q1)), height: bh }));
  svg.appendChild(el("line", { class: "med", x1: x(b.median), x2: x(b.median), y1: y - bh / 2 - 3, y2: y + bh / 2 + 3 }));
  const tl = el("text", { class: "n", x: x(b.min), y: y + 14, "text-anchor": "start" }, X(b.min)); svg.appendChild(tl);
  const th = el("text", { class: "n", x: x(b.max), y: y + 14, "text-anchor": "end" }, X(b.max)); svg.appendChild(th);
  const tm = el("text", { class: "n k", y: y + 14, "text-anchor": "middle" }, X(b.median)); svg.appendChild(tm);
  const wl = widthOf(tl, 28), wh = widthOf(th, 28), wm = widthOf(tm, 32);
  tm.setAttribute("x", Math.max(x(b.min) + wl + wm / 2 + 6, Math.min(x(b.max) - wh - wm / 2 - 6, x(b.median))));
  if (own != null && own > 0) { const px = x(own); svg.appendChild(el("line", { class: "me", x1: px, x2: px, y1: 2, y2: H - 2 })); const t = el("text", { class: "me-n", y: 8, "text-anchor": "middle" }, X(own)); svg.appendChild(t); const tw = widthOf(t, 30); t.setAttribute("x", Math.max(tw / 2 + 1, Math.min(W - tw / 2 - 1, px))); }
  /* the outliers: excluded ones sit at the edge with an arrow; kept ones are drawn filled inside the scale */
  const hi = flagged.filter((o) => excluded.has(o.ticker) && o.side === "high"), lo = flagged.filter((o) => excluded.has(o.ticker) && o.side === "low");
  hi.forEach((o, i) => { const cx = W - padR + 14 + i * 4; const c = el("circle", { class: "out", cx, cy: y, r: 4, "data-t": o.ticker, "data-k": r.key }); c.appendChild(el("title", {}, `${o.ticker} ${X(o.multiple)} · ${o.z.toFixed(1)} MAD above · click to keep`)); svg.appendChild(c); if (i === 0) { svg.appendChild(el("text", { class: "out-n", x: W - padR + 22, y: y + 3, "data-t": o.ticker, "data-k": r.key }, `→ ${X(o.multiple)} ${o.ticker}${hi.length > 1 ? " & " + (hi.length - 1) + " more" : ""}`)); } });
  lo.forEach((o, i) => { const cx = 10 + i * 4; const c = el("circle", { class: "out", cx, cy: y, r: 4, "data-t": o.ticker, "data-k": r.key }); c.appendChild(el("title", {}, `${o.ticker} ${X(o.multiple)} · ${Math.abs(o.z).toFixed(1)} MAD below · click to keep`)); svg.appendChild(c); if (i === 0) { svg.appendChild(el("text", { class: "out-n", x: 18, y: y + 3, "data-t": o.ticker, "data-k": r.key }, `${o.ticker} ${X(o.multiple)}${lo.length > 1 ? " & " + (lo.length - 1) + " more" : ""} ←`)); } });
  for (const o of flagged.filter((k) => keptSet.has(k.ticker))) { const c = el("circle", { class: "out kept", cx: Math.max(6, Math.min(W - 6, x(o.multiple))), cy: y, r: 4, "data-t": o.ticker, "data-k": r.key }); c.appendChild(el("title", {}, `${o.ticker} ${X(o.multiple)} · kept · click to let the rule exclude it again`)); svg.appendChild(c); }
}
function drawPosRow(svg, vals, own, c, width) {
  const W = Math.max(160, Math.floor(width)); while (svg.firstChild) svg.removeChild(svg.firstChild);
  const all = own != null ? [...vals, own] : vals, a = axis(all, W), x = a.x, n = vals.length, q1 = quantile(vals, 0.25), q3 = quantile(vals, 0.75), med = median(vals), H = 36, y = 20, bh = 10;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H);
  svg.appendChild(el("rect", { class: "bar", x: x(vals[0]), y: y - 3, width: Math.max(1, x(vals[n - 1]) - x(vals[0])), height: 6 }));
  svg.appendChild(el("rect", { class: "mid", x: x(q1), y: y - bh / 2, width: Math.max(1, x(q3) - x(q1)), height: bh }));
  svg.appendChild(el("line", { class: "med", x1: x(med), x2: x(med), y1: y - bh / 2 - 3, y2: y + bh / 2 + 3 }));
  svg.appendChild(el("text", { class: "n", x: x(vals[0]), y: y + 14, "text-anchor": "start" }, F(c.fmt, vals[0])));
  svg.appendChild(el("text", { class: "n", x: x(vals[n - 1]), y: y + 14, "text-anchor": "end" }, F(c.fmt, vals[n - 1])));
  const tm = el("text", { class: "n k", y: y + 14, "text-anchor": "middle" }, F(c.fmt, med)); svg.appendChild(tm);
  tm.setAttribute("x", Math.max(x(vals[0]) + 36, Math.min(x(vals[n - 1]) - 36, x(med))));
  if (own != null) { const px = x(own); svg.appendChild(el("line", { class: "me", x1: px, x2: px, y1: 2, y2: H - 2 })); }
}

/* ---- the full table (closed) ---------------------------------------------------------------------------- */
function tableHTML(S) {
  const { T, C } = S, snap = C.snap, sel = C.sel, c6 = C.c6, sc = c6.score, all = S.members.filter((t) => t !== T), peers = [...all.filter((t) => !c6.ruleOff.has(t)), ...c6.outliers.filter((t) => all.includes(t))];
  const fl = (t, c) => { if (!isFlagged(c6, t, c.key)) return ""; const x = c6.cols[c.key].cells[t]; return `<i title="${esc(Math.abs(x.d).toFixed(1))} spreads ${x.side === "high" ? "above" : "below"} the column's median ${esc(F(c.fmt, c6.cols[c.key].median))}${isVote(c.key) ? " · counts toward outlier" : " · information only"}">${x.side === "high" ? "▲" : "▼"}</i>`; };
  const groups = [...new Set(TABLE.map((c) => c.group))];
  const head1 = `<tr><th class="l"></th><th class="l">peer</th>${groups.map((g) => `<th class="grp" colspan="${TABLE.filter((c) => c.group === g).length}">${esc(g)}</th>`).join("")}<th class="l"></th></tr>`;
  const head2 = `<tr><th></th><th class="l"></th>${TABLE.map((c) => `<th>${esc(c.label)}</th>`).join("")}<th class="l">reason</th></tr>`;
  const val = (c, v) => v == null ? "—" : F(c.fmt, v);
  const cell = (t, c) => {
    const v = snap.table.peers[t] ? snap.table.peers[t][c.key] : null;
    const mark = fl(t, c);
    if (!ROWS.includes(c.key)) return `<td${mark ? ` class="fl${isVote(c.key) ? "" : " inf"}"` : ""}>${esc(val(c, v))}${mark}</td>`;
    const row = C.rows.find((r) => r.key === c.key), vv = (row.values || {})[t] || { multiple: null }, o6 = c6.ruleOff.has(t), off = !o6 && isOff(sel, t, c.key), peerOff = !o6 && sel.peers.has(t);
    if (vv.multiple != null && (mark || o6)) return `<td${mark ? ' class="fl"' : ""}>${o6 ? esc(X(vv.multiple)) : `<button type="button" class="cell${off || peerOff ? " off" : ""}" data-cm="cell" data-t="${esc(t)}" data-k="${c.key}" title="${off ? "put back" : "turn off on " + esc(SHORT[c.key]) + " only"}">${esc(X(vv.multiple))}</button>`}${mark}</td>`;
    if (vv.multiple == null) return `<td><span class="cell none" title="${esc(vv.why || "")}">—</span></td>`;
    const o = (row.outliers && row.outliers.flagged || []).find((f) => f.ticker === t), kept = o && isKept(C.kept, t, c.key);
    const flag = o ? `<span class="flag" title="${esc(Math.abs(o.z).toFixed(1))} MAD ${o.side === "high" ? "above" : "below"} the pack${kept ? " · kept" : " · out of the centre"}">${kept ? "kept" : "out"}</span>` : "";
    return `<td><button type="button" class="cell${off || peerOff ? " off" : ""}${o ? " o" + (kept ? " kept" : "") : ""}" data-cm="${o ? "keep" : "cell"}" data-t="${esc(t)}" data-k="${c.key}" title="${o ? (kept ? "let the rule exclude it again" : "keep this outlier in the centre") : off ? "put back" : "turn off on " + esc(SHORT[c.key]) + " only"}">${esc(X(vv.multiple))}</button>${flag}</td>`;
  };
  const meRow = `<tr class="me"><td></td><td class="tk l">${esc(T)}</td>${TABLE.map((c) => `<td>${esc(val(c, snap.table.company[c.key]))}</td>`).join("")}<td class="l"></td></tr>`;
  const body = peers.map((t) => { const o6 = c6.ruleOff.has(t), k6 = c6.kept.includes(t), off = !o6 && sel.peers.has(t), d = sel.list.filter((x) => x.peer === t); const reason = o6 || k6 ? (o6 ? "outlier · " : "kept · ") + sc[t].words : d.map((x) => (x.measure === "ALL" ? "" : SHORT[x.measure] + ": ") + (x.reason || "no reason yet")).join(" · ");
    const tog = o6 || k6 ? `<button type="button" class="tog${o6 ? " o6" : " on"}" data-cm="keeppeer" data-t="${esc(t)}" title="${o6 ? "keep in the medians and the price" : "let the rule leave it out again"}">${o6 ? "◇" : "◆"}</button>` : `<button type="button" class="tog${off ? "" : " on"}" data-cm="peer" data-t="${esc(t)}">${off ? "□" : "■"}</button>`;
    const r = `<tr class="${o6 ? "o6" : off ? "off" : ""}" data-peer="${esc(t)}"${o6 ? ` data-o6="${esc(t)}"` : ""}><td>${tog}</td><td class="tk l">${esc(peerName(t))}</td>${TABLE.map((c) => cell(t, c)).join("")}<td class="l">${esc(reason)}</td></tr>`;
    return S.reasonFor && S.reasonFor.peer === t ? r + reasonRowHTML(S, t) : r; }).join("");
  const stat = (label, k) => `<tr class="stat"><td></td><td class="l">${label}</td>${TABLE.map((c) => ROWS.includes(c.key) ? `<td>${esc(X(C.rows.find((r) => r.key === c.key).band[k]))}</td>` : "<td></td>").join("")}<td></td></tr>`;
  const fmed = (CC, c) => { if (ROWS.includes(c.key)) return CC.rows.find((r) => r.key === c.key).band.median; const vs = CC.peersOn.map((t) => snap.table.peers[t] ? snap.table.peers[t][c.key] : null).filter((v) => v != null && Number.isFinite(v)); return vs.length ? median(vs) : null; };
  const medRow = (label, CC, cls) => `<tr class="stat" data-med="${cls}"><td></td><td class="l">${label}</td>${TABLE.map((c) => `<td>${esc(val(c, fmed(CC, c)))}</td>`).join("")}<td></td></tr>`;
  const meds = c6.outliers.length ? medRow("median · without outliers", C, "without") + medRow("median · with outliers", c6.withOutliers, "with") : medRow("median", C, "without");
  return `<div class="tw"><table class="t"><thead>${head1}${head2}</thead><tbody>${meRow}${body}${meds}${stat("25th", "q1")}${stat("75th", "q3")}</tbody></table></div>${decisionsHTML(S)}`;
}
function reasonRowHTML(S, t) {
  const R = S.reasonFor, chips = [FLAG_WORDS.op, FLAG_WORDS.far, FLAG_WORDS.nm];
  return `<tr class="reason"><td></td><td colspan="${TABLE.length + 2}" class="l"><div class="chips"><span style="font-size:8.5px;letter-spacing:.14em;color:var(--dim)">WHY IS ${esc(t)}${R.measure !== "ALL" ? " · " + esc(SHORT[R.measure]) : ""} OFF?</span>${chips.map((c) => `<button type="button" class="chip" data-cm="chip" data-r="${esc(c)}">${esc(c)}</button>`).join("")}<input class="in" data-cm="reason" placeholder="or your own words" value="${esc(R.reason || "")}"><button type="button" class="btn on" data-cm="savereason">Save</button><button type="button" class="btn" data-cm="closereason">Later</button></div></td></tr>`;
}
function decisionsHTML(S) {
  const L = S.C.sel.list, K = [...S.C.kept]; if (!L.length && !K.length) return "";
  return `${L.length ? `<div class="wk" style="margin-top:6px">off · ${L.length} · <button type="button" class="btn" data-cm="putall">Put all back</button></div>${L.map((d) => `<div class="words" style="margin:1px 0"><b style="color:var(--ink)">${esc(d.peer)}</b> ${d.measure === "ALL" ? "every measure" : esc(SHORT[d.measure])} · ${esc(d.reason || "no reason yet")} <button type="button" class="btn" data-cm="putback" data-t="${esc(d.peer)}" data-k="${esc(d.measure)}">Put back</button></div>`).join("")}` : ""}
  ${K.length ? `<div class="wk" style="margin-top:6px">outliers kept · ${K.length}</div>${K.map((k) => { const [p, m] = k.split("|"); return `<div class="words" style="margin:1px 0"><b style="color:var(--ink)">${esc(p)}</b> ${esc(SHORT[m] || m)} <button type="button" class="btn" data-cm="keep" data-t="${esc(p)}" data-k="${esc(m)}">Let the rule exclude it</button></div>`; }).join("")}` : ""}`;
}

/* ---- PAGE SPECS: every sentence of the tab lives here --------------------------------------------------- */
function pageSpecsHTML(S) {
  const { set, T, C } = S, mw = C.measureWeights, pw = C.peerWeights, segFrom = S.inp.segments_from || "fixture";
  const wlist = ROWS.map((k) => `${SHORT[k]} ${Math.round((mw.weights[k] || 0) * 100)}%`).join(" · ");
  const c6 = C.c6, biz = c6.business, fw = (t) => [...c6.score[t].flags, ...c6.score[t].info].map((f) => `${f.short} ${F(c6.cols[f.key].fmt, f.v)} against a median of ${F(c6.cols[f.key].fmt, c6.cols[f.key].median)}`).join(", ");
  const flaggedPeers = [...c6.outliers, ...c6.kept], outs = flaggedPeers.length ? flaggedPeers.map((t) => `${t}, ${c6.score[t].words} (${fw(t)})${c6.kept.includes(t) ? ", kept by you" : ""}`).join("; ") : "no outlier";
  const one = c6.peers.filter((t) => c6.score[t].marks && !c6.score[t].outlier).map((t) => `${t} (${fw(t)})`).join("; ");
  return `<details class="sc-pagespecs"><summary>PAGE SPECS</summary><div>
<p><b>Edits are saved for every screen.</b> Every switch on this tab (a peer off, a cell off, an outlier kept, a put-back) writes one dated row to <b>public.comps_decisions</b> in the Hub's database${S.mode === "db" ? " (connected now)" : " (this browser only right now: the database could not be reached, the rows are kept locally and sent when it can)"}; the latest row per peer and measure wins and nothing is erased, so the same set shows on every device.</p>
<p><b>The set.</b> Business similarity decides membership; size only ranks within it. ${esc(T)}'s revenue lines come from ${esc(set.lines_from)} (${esc(segFrom === "public.revenue_segments" ? "the Hub's revenue_segments table" : "FMP's revenue-by-segment, pulled on Fly 3 Oct 2026, served as a dated file until the revenue_segments table is loaded")}); a segment moves to another line only through a stated keyword (cloud, advertising, e-commerce, physical stores, consulting, data-center chips, memory, foundry, consumer banking, investment banking &amp; markets, wealth, payments, upstream, downstream, chemicals, midstream, medical devices), everything else stays on the company's FMP industry line. A peer is in when at least ${Math.round(SIM_MIN * 100)} cents of each revenue dollar sit in a line it shares with ${esc(T)} (a line in the same family counts half). Every line ${esc(T)} has at ${Math.round(LINE_MIN * 100)}% or more of revenue seats its ${SEATS_PER_LINE} best peers first (marked SEAT), then the rest fill the ${set.n} by similarity less a soft size term: ${SIZE_WEIGHT} for every 10× of market value, never a gate; a name FMP's peers or Massive's related companies also list earns 0.03. "Decided by" says what set each peer's lines: <b>segments</b> (FMP revenue by product), <b>industry</b> (FMP industry only), <b>hand</b> (a stated rule where FMP's industry misleads, e.g. Amazon and Alibaba as e-commerce, not "Specialty Retail"). The shares column is the similarity, 0 to 1. ${set.counts.members} of ${set.counts.served} served companies pass; the named candidates that do not are listed with their reason. One share class per company.</p>
<p><b>Outliers, on price only.</b> An outlier is a peer whose price is strange next to the group, not a peer that grows fast. In each of the sixteen columns a peer's distance from the column's median is measured in units of the column's typical spread (the median absolute deviation; the six multiples on a log scale), and a cell further than ${CUT} such units is marked ▲ or ▼ and still counts. Only the valuation multiples vote — ${esc(VOTES.map((v) => v.short).join(", "))}, with trailing and forward P/E as one vote — and a peer marked on ${MIN_FLAGS} or more of them, or on at least ${Math.round(SHARE * 100)}% of the ones it has (and at least ${SHARE_MIN_FLAGS}), is an outlier: greyed at the bottom of the set and of the table with its count, left out of every median and of the price, never deleted, and one click on its ◇ keeps it in. Marks on growth, margins, balance sheet and capex are information (the fainter cells) and never count. A column needs at least ${MIN_N} peers to judge anyone. The line above the range gives the centre with every peer in and without the outliers; the band is drawn without them. In this set: ${esc(outs)}.${one ? " Marked, still counted: " + esc(one) + "." : ""}</p>
<p><b>Same business?</b> ${biz ? `${biz.same.length} of ${biz.n} peers have at least ${Math.round(SIM_MIN * 100)}% of their revenue in a line they share exactly with ${esc(T)} (${esc(biz.line || "")}); the rest are in only as the same family. ` : ""}When fewer than half do, the set is named "mostly different business": that is a problem with the peers, not with outliers, so the outlier rule does not cut the peers that do share the business${c6.notCut.length ? ` (here: ${esc(c6.notCut.join(", "))})` : ""} — the fix is the peer set.</p>
<p><b>The range (way C, the default).</b> Every peer's implied price on every measure that prices ${esc(T)} is one point, weighted by its measure's weight and its peer's weight. The <b>centre is the weighted median</b> of all those points, low and high the weighted 25th and 75th; the midpoint of low and high is printed beside the centre so the two are never confused. Way A is the range of the six measure medians (centre = the median of those medians); way B the middle-half band (centre = the same median of medians). The upside is from today's price to the centre.</p>
<p><b>The weights, measured here.</b> Measures → price: ${esc(wlist)} — each measure's weight is a sector prior (${esc(mw.cls)}: the practitioner literature, forward earnings first, EV multiples little for a bank) × coverage (the share of peers carrying the multiple) × fit (1 ÷ (1 + the median pricing error of the measure inside this set: each peer priced at the peers' median is off by |median ÷ own − 1|)). Fundamentals → peer match: ${esc(pw.basis)}; a peer whose growth, margins, balance sheet and capex sit close to ${esc(T)}'s in percentile rank counts more (weight = exp(−½ (gap ÷ 0.5)²)). Nothing better is measured yet for the fundamentals; when a history of which measure explained this industry's prices exists, it replaces the prior.</p>
<p><b>PEG.</b> Forward P/E ÷ forward EPS growth, the growth being the compound annual rate from trailing EPS to the FMP consensus EPS three fiscal years out (the furthest year inside ${PEG_YEARS_MAX} years; consensus to consensus for a foreign filer whose statements are not in dollars) — the same analyst_estimates rows the ESTIMATES tab draws. When it cannot be computed the cell shows "—".</p>
<p><b>The field.</b> Sixteen measures in five groups. Valuation rows price ${esc(T)} at its peers' multiples: the filled cyan bar runs from the lowest peer to the highest (outlier peers excluded), the brighter block is the middle half, the cyan tick the median, the white line ${esc(T)} today; the figure on the right is the move from today's price to the price at the peers' median. Growth, margins, balance sheet and capex rows place ${esc(T)} among the peers the same way, with the median and ${esc(T)}'s own figure. The minimized field beside WEIGH is the same sixteen rows, small. Plain numbers throughout: negatives in parentheses, no plus signs. Prices from the chart API (${esc(S.snap.price_from || "quotes")}); figures from the Hub's fundamentals, estimates, history and balance tables; foreign filers converted to USD from filer_currency and fx_rates.</p>
</div></details>`;
}

/* ---- events ---------------------------------------------------------------------------------------------- */
function wire(S) {
  const det = S.root.querySelector('details[data-d="table"]');
  if (det) det.addEventListener("toggle", () => { S.open.table = det.open; const b = det.querySelector(".body"); if (det.open && !b.innerHTML.trim()) b.innerHTML = tableHTML(S); });
  S.root.onclick = async (e) => {
    const o = e.target.closest && e.target.closest(".out, .out-n");
    if (o && o.dataset.t) { const t = o.dataset.t, k = o.dataset.k, kept = isKept(S.C.kept, t, k); await storeDecision(S, decisionRow({ company: S.T, peer: t, measure: k, off: false, reason: kept ? "unkeep: back to the rule" : "keep: outlier on " + SHORT[k] })); render(S); return; }
    const b = e.target.closest("[data-cm]"); if (!b) return;
    const a = b.dataset.cm;
    if (a === "peer" || a === "cell" || a === "putback") {
      const t = b.dataset.t, measure = a === "peer" ? "ALL" : b.dataset.k, sel = { peers: S.C.sel.userPeers, cells: S.C.sel.cells }, off = a === "putback" ? false : !isOff(sel, t, measure);
      if (a === "cell" && sel.peers.has(t)) return;
      await storeDecision(S, decisionRow({ company: S.T, peer: t, measure, off, reason: off ? "" : "put back" }));
      S.reasonFor = off && a === "cell" ? { peer: t, measure, reason: "" } : null; if (S.reasonFor) S.open.table = true; render(S);
    } else if (a === "keep") { const t = b.dataset.t, k = b.dataset.k, kept = isKept(S.C.kept, t, k); await storeDecision(S, decisionRow({ company: S.T, peer: t, measure: k, off: false, reason: kept ? "unkeep: back to the rule" : "keep: outlier on " + SHORT[k] })); S.open.table = true; render(S); }
    else if (a === "keeppeer") { const t = b.dataset.t, kept = S.C.c6.kept.includes(t); await storeDecision(S, decisionRow({ company: S.T, peer: t, measure: "ALL", off: false, reason: kept ? "unkeep: back to the rule" : "keep: outlier, " + S.C.c6.score[t].words })); render(S); }
    else if (a === "putall") { for (const d of S.C.sel.list) await storeDecision(S, decisionRow({ company: S.T, peer: d.peer, measure: d.measure, off: false, reason: "put back" })); S.reasonFor = null; render(S); }
    else if (a === "chip") { const inp = S.root.querySelector('[data-cm="reason"]'); if (inp) inp.value = b.dataset.r; }
    else if (a === "savereason") { const inp = S.root.querySelector('[data-cm="reason"]'), R = S.reasonFor; if (!R) return; await storeDecision(S, decisionRow({ company: S.T, peer: R.peer, measure: R.measure, off: true, reason: inp ? inp.value.trim() : "" })); S.reasonFor = null; render(S); }
    else if (a === "closereason") { S.reasonFor = null; render(S); }
    else if (a === "way") { S.way = b.dataset.w; render(S); }
    else if (a === "n") { S.n = +b.dataset.v; b.textContent = "…"; try { await loadSet(S); } catch (e) { S.root.innerHTML = `<div class="err">${esc(e.message || e)}</div>`; return; } render(S); }
  };
  S.root.onkeydown = (e) => { if (e.key === "Enter" && e.target.matches('[data-cm="reason"]')) { e.preventDefault(); const s = S.root.querySelector('[data-cm="savereason"]'); if (s) s.click(); } };
}

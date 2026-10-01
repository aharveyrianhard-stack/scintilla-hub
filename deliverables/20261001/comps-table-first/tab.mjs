/* Scintilla · comps template (C3, 1 Oct) · the COMPS tab after Alan's review. Hub look only (tokens, mono type, hairlines).
   Order on the tab: the CONCLUSION CARD (range · today · upside · the way switch · one disagreement line), the SIX ROWS
   (the company drawn as an overlay: its own shape, weight, colour and a rule through the row; the peers as a quiet line,
   box and median tick; one upside number per row), then four CLOSED disclosures: the detail (25th / 75th, both sets),
   THE TABLE (the original comps table, every column, on/off per peer and per valuation cell), HOW IT IS BUILT (the
   ladder), COHORT. No legend sentences; the marks carry their labels. */
/* C3b (1 Oct, Alan 08:40): "The table has to be at the top of the section. On the table is the only place that I can really
   see the outliers" · the peer set is a switch (tightest tag · home cohort · FMP peers · largest 7) · the four ways as
   pictures beside the switch. Everything else (the company as an overlay, one upside per row, no instruction lists,
   outliers parked) is C3's, imported from ../comps-template. */
import { ROWS, SHORT, TABLE } from "../comps-template/cohort.mjs";
import { conclusion, rowSummaries, cohortTable, sortCohort, WAYS, WAY_WORDS, wayOf, upsideTo } from "../comps-template/template.mjs";
import { resolveSets, readSet, snapshotFromCohort, largestDiffers, SET_WORDS } from "./sets.mjs";
import { decisionRow, isOff, flags, FLAG_WORDS, FAR_K } from "../../20260930/comps-tab/comps-tab.mjs";
import { ladder } from "../../20260929/comps-live/ladder.mjs";
const STANDIN_URL = "/deliverables/20261001/comps-template/fx-standin-ecb-2026-10-01.json";
import { fmt } from "../../20260927/comps-r3/r3.mjs";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const X = (v) => v == null ? "—" : fmt("x", v), F = (kind, v) => v == null ? "—" : fmt(kind === "x2" ? "x2" : kind, v);
const P0 = (v) => v == null || !Number.isFinite(v) ? "—" : "$" + Math.round(v).toLocaleString("en-US");
const P = (v) => v == null ? "—" : "$" + (v >= 1000 ? Math.round(v).toLocaleString("en-US") : v.toFixed(2));
const PCT = (v) => v == null ? "—" : (v >= 0 ? "+" : "(") + Math.abs(v).toFixed(Math.abs(v) >= 10 ? 0 : 1) + "%" + (v >= 0 ? "" : ")");
const G = (v) => v == null ? "—" : (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2);
const dirCls = (v) => v == null ? "" : v >= 0 ? " up" : " dn";
const LS = "sc_comps_decisions", SVG = "http://www.w3.org/2000/svg";
const el = (tag, a = {}, t) => { const e = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); if (t != null) e.textContent = t; return e; };
const widthOf = (t, f) => { try { const w = t.getComputedTextLength(); if (w > 0) return w; } catch (_) {} return f; };

export const CSS = `
.ct{font-family:var(--mono);color:var(--ink2);font-size:11px;line-height:1.45;letter-spacing:.02em;text-transform:none}
.ct *{box-sizing:border-box;min-width:0}
.ct .up{color:var(--bull)}.ct .dn{color:var(--bear)}
/* the conclusion card */
.ct .ct-card{border:.8px solid rgba(0,212,255,.30);padding:6px 10px 5px;background:rgba(0,212,255,.03);margin-bottom:5px}
.ct .ct-card .ct-h{display:flex;flex-wrap:wrap;gap:2px 10px;align-items:baseline;font-size:10px;color:var(--ink3);letter-spacing:.06em}
.ct .ct-card .ct-h b{color:var(--crk);font-size:13px;font-weight:700;letter-spacing:.08em}
.ct .ct-card .ct-h .nm{color:var(--ink2)}
.ct .ct-card .ct-main{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,.8fr) minmax(0,.9fr);gap:2px 10px;align-items:end;margin:4px 0 3px}
.ct.narrow .ct-card .ct-main{grid-template-columns:1fr 1fr}
.ct.narrow .ct-card .range{white-space:normal;font-size:14px}
.ct.narrow .ct-card .ct-main > div:first-child{grid-column:1/-1}
.ct .ct-card .k{font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:var(--dim)}
.ct .ct-card .range{font-size:15px;font-weight:600;color:var(--ink);white-space:nowrap;line-height:1.2}
.ct .ct-card .range small{font-size:10px;font-weight:400;color:var(--ink3);letter-spacing:.1em;margin:0 3px}
.ct .ct-card .range i{font-style:normal;color:var(--mute);font-weight:400;margin:0 4px}
.ct .ct-card .today{font-size:15px;font-weight:600;color:var(--ink);white-space:nowrap;line-height:1.2}
.ct .ct-card .upside{font-size:19px;font-weight:700;white-space:nowrap;line-height:1.1}
.ct .ct-card .upside small{font-size:9px;font-weight:400;letter-spacing:.14em;color:var(--dim);margin-left:4px;text-transform:uppercase}
.ct .ct-sw{display:flex;flex-wrap:nowrap;gap:3px;align-items:center;margin-top:3px;overflow-x:auto;scrollbar-width:none}
.ct .ct-sw .k{margin-right:5px;flex:0 0 auto}
.ct .ct-sw button{font:inherit;font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;padding:2px 6px;white-space:nowrap;flex:0 0 auto;background:none;border:.8px solid var(--line2);color:var(--ink3);cursor:pointer}
.ct .ct-sw button:hover{color:var(--ink);border-color:var(--ink3)}
.ct .ct-sw button.on{color:var(--crk);border-color:rgba(0,212,255,.55);background:rgba(0,212,255,.06)}
.ct .ct-line{font-size:9.5px;color:var(--ink3);margin-top:3px;line-height:1.35}
.ct .ct-line b{color:var(--ink2);font-weight:600}
.ct .ct-fx{font-size:9px;color:var(--ink3);margin-top:2px;letter-spacing:.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ct .ct-fx.warn{color:var(--sv3)}
.ct .ct-store{font-size:8px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
.ct .ct-store.local{color:var(--sv3)}
/* the six rows */
.ct .ct-row{display:grid;grid-template-columns:104px minmax(0,1fr) 60px;gap:0 8px;align-items:center;padding:1px 0 0;border-bottom:.5px solid var(--line)}
.ct .ct-row:last-child{border-bottom:0}
.ct.narrow .ct-row{grid-template-columns:84px minmax(0,1fr) 56px}
.ct .ct-row .lb{font-size:10.5px;color:var(--ink);font-weight:600;line-height:1.2}
.ct .ct-row .lb small{display:block;font-size:8px;color:var(--mute);letter-spacing:.1em;font-weight:400;text-transform:uppercase;margin-top:1px}
.ct .ct-row svg{display:block;width:100%;height:auto;overflow:visible}
.ct .ct-row .u{font-size:14px;font-weight:700;text-align:right;white-space:nowrap}
.ct .ct-row .u small{display:block;font-size:7.5px;font-weight:400;letter-spacing:.14em;color:var(--mute);text-transform:uppercase}
.ct .ct-row .u.no{font-size:9px;font-weight:400;color:var(--mute);white-space:normal;line-height:1.3}
.ct .ct-rows{border:.8px solid rgba(0,212,255,.22);padding:2px 10px 4px}
.ct .wh{stroke:var(--ink3);stroke-width:1.2}
.ct .box{fill:rgba(0,212,255,.10);stroke:rgba(0,212,255,.30);stroke-width:.8}
.ct .medl{stroke:var(--ink2);stroke-width:2}
.ct .peerw{font-size:7.5px;letter-spacing:.08em;fill:var(--dim)}
.ct .peern{font-size:9.5px;fill:var(--ink3)}
.ct .medn{font-size:9.5px;fill:var(--ink);font-weight:600}
/* the company: its own shape (a filled circle with a ring), its own weight, its own colour, and a rule through the row */
.ct .me-rule{stroke:var(--crk);stroke-width:1.2;stroke-dasharray:none}
.ct .me-dot{fill:var(--crk);stroke:var(--bg);stroke-width:1.5}
.ct .me-ring{fill:none;stroke:var(--crk);stroke-width:1.2}
.ct .me-n{font-size:11px;font-weight:700;fill:var(--crk);paint-order:stroke;stroke:var(--panel);stroke-width:3px;stroke-linejoin:round}
.ct .me-w{font-size:7px;letter-spacing:.12em;fill:var(--crk);font-weight:600}
.ct .tie{stroke:var(--line2);stroke-width:.8}
/* disclosures */
.ct details.ct-d{border:.8px solid rgba(0,212,255,.22);margin-top:6px}
.ct details.ct-d > summary{list-style:none;cursor:pointer;display:flex;gap:10px;align-items:center;padding:7px 10px;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink3)}
.ct details.ct-d > summary::-webkit-details-marker{display:none}
.ct details.ct-d > summary::before{content:"+";color:var(--crk);font-size:12px;width:10px;display:inline-block}
.ct details.ct-d[open] > summary::before{content:"−"}
.ct details.ct-d > summary small{color:var(--mute);letter-spacing:.06em;text-transform:none;font-size:9.5px;margin-left:auto}
.ct details.ct-d > .body{padding:4px 10px 10px;border-top:.5px solid var(--line)}
/* tables */
.ct .tw{overflow-x:auto;scrollbar-width:thin;position:relative}
.ct .tw.frozen table.t th:nth-child(1),.ct .tw.frozen table.t td:nth-child(1){position:sticky;left:0;background:var(--panel);z-index:2}
.ct .tw.frozen table.t th:nth-child(2),.ct .tw.frozen table.t td:nth-child(2){position:sticky;left:20px;background:var(--panel);z-index:2;box-shadow:inset -1px 0 0 var(--line2)}
.ct .tw.frozen table.t tr.me td:nth-child(1),.ct .tw.frozen table.t tr.me td:nth-child(2){background:#0f1a22}
.ct .tw.frozen table.t tr:hover td:nth-child(1),.ct .tw.frozen table.t tr:hover td:nth-child(2){background:#101620}
.ct .ct-top{border:.8px solid rgba(0,212,255,.30);padding:5px 10px 6px;background:rgba(0,212,255,.03);margin-bottom:5px}
.ct .ct-top .ct-h{display:flex;flex-wrap:wrap;gap:2px 10px;align-items:baseline;font-size:10px;color:var(--ink3);letter-spacing:.06em}
.ct .ct-top .ct-h b{color:var(--crk);font-size:13px;font-weight:700;letter-spacing:.08em}
.ct .ct-sets{display:flex;flex-wrap:wrap;gap:3px 4px;align-items:center;margin-top:3px}
.ct .ct-sets .k{font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:var(--dim);margin-right:3px}
.ct .ct-sets button{font:inherit;font-size:8.5px;letter-spacing:.08em;padding:2px 6px;background:none;border:.8px solid var(--line2);color:var(--ink3);cursor:pointer;white-space:nowrap}
.ct .ct-sets button:hover{color:var(--ink);border-color:var(--ink3)}
.ct .ct-sets button.on{color:var(--crk);border-color:rgba(0,212,255,.55);background:rgba(0,212,255,.06)}
.ct .ct-sets button.miss{color:var(--mute);border-style:dashed;cursor:default}
.ct .ct-sets button small{color:var(--mute);margin-left:4px;letter-spacing:0}
.ct .ct-moves{font-size:9.5px;color:var(--ink3);margin-top:3px;line-height:1.35}
.ct .ct-moves b{color:var(--ink2);font-weight:600}
.ct .ct-cardgrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(170px,.9fr);gap:4px 12px;align-items:start}
.ct.narrow .ct-cardgrid{grid-template-columns:1fr}
.ct .ct-bands svg{display:block;width:100%;height:auto;overflow:visible}
.ct .bd-lane{font-size:8px;letter-spacing:.1em;fill:var(--dim)}
.ct .bd-lane.on{fill:var(--crk);font-weight:700}
.ct .bd-box{fill:rgba(0,212,255,.10);stroke:rgba(0,212,255,.30);stroke-width:.8}
.ct .bd-box.on{fill:rgba(0,212,255,.22);stroke:var(--crk)}
.ct .bd-mid{stroke:var(--ink);stroke-width:2}
.ct .bd-n{font-size:9px;fill:var(--ink2)}.ct .bd-n.on{fill:var(--ink);font-weight:700}
.ct .bd-today{stroke:var(--crk);stroke-width:1;stroke-dasharray:3 2}
.ct table.t{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:10.5px}
.ct table.t th{font-size:8px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);font-weight:400;padding:6px 5px 4px;text-align:right;border-bottom:.8px solid rgba(0,212,255,.22);white-space:nowrap}
.ct table.t th.l,.ct table.t td.l{text-align:left}
.ct table.t th.grp{text-align:center;color:var(--ink3);border-bottom:.5px solid var(--line);padding-top:4px;padding-bottom:2px;letter-spacing:.2em}
.ct table.t th.s{cursor:pointer}.ct table.t th.s:hover{color:var(--ink2)}.ct table.t th.s.is-sorted{color:var(--crk);box-shadow:inset 0 -2px 0 var(--crk)}
.ct table.t td{padding:3px 5px;text-align:right;border-bottom:.5px solid var(--line);color:var(--ink2);white-space:nowrap;vertical-align:middle}
.ct table.t tr:hover td{background:rgba(0,212,255,.04)}
.ct table.t td.tk{color:var(--ink);font-weight:600;letter-spacing:.04em}
.ct table.t tr.me td{color:var(--ink);background:rgba(0,212,255,.07);border-bottom:.8px solid rgba(0,212,255,.35);border-top:.8px solid rgba(0,212,255,.35)}
.ct table.t tr.me td.tk{color:var(--crk)}
.ct table.t tr.me td.tk::before{content:"● ";font-size:8px}
.ct table.t tr.off td{color:var(--mute)}.ct table.t tr.off td.tk{text-decoration:line-through;color:var(--mute)}
.ct table.t tr.stat td{color:var(--ink3);font-size:10px}.ct table.t tr.stat td.l{letter-spacing:.12em;text-transform:uppercase;font-size:8px;color:var(--dim)}
.ct table.t tr.stat.sel td{color:var(--ink)}.ct table.t tr.stat.head td{border-top:.8px solid rgba(0,212,255,.22);padding-top:5px}
.ct table.t td.chg{color:var(--crk)}
.ct .cell{background:none;border:0;padding:0;margin:0;font:inherit;color:inherit;cursor:pointer;letter-spacing:inherit}
.ct .cell:hover{color:var(--crk)}.ct .cell.off{color:var(--mute);text-decoration:line-through}.ct .cell.none{color:var(--mute);cursor:default;text-decoration:none}
.ct .flag{display:inline-block;font-size:7px;letter-spacing:.1em;padding:0 3px;margin-left:3px;border:.5px solid var(--line2);color:var(--mute);vertical-align:middle;text-decoration:none}
.ct .flag.far{color:var(--ink3)}
.ct .tog{background:none;border:0;cursor:pointer;font-size:12px;line-height:1;width:14px;padding:0;color:#4A4A52}.ct .tog.on{color:#C9C9CE}.ct .tog:hover{color:var(--crk)}
.ct .reason td{padding:5px 6px 7px;white-space:normal;background:rgba(0,212,255,.03)}
.ct .chips{display:flex;flex-wrap:wrap;gap:5px;align-items:center}
.ct .chip,.ct .btn{font:inherit;font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;padding:4px 8px;background:none;border:.8px solid var(--line2);color:var(--ink3);cursor:pointer;border-radius:0}
.ct .chip:hover,.ct .btn:hover{color:var(--ink);border-color:var(--ink3)}.ct .btn.on{color:var(--crk);border-color:rgba(0,212,255,.5)}
.ct .in{font:inherit;font-size:10.5px;background:var(--panel2);color:var(--ink);border:.8px solid var(--line2);padding:4px 7px;min-width:160px;flex:1 1 160px}
.ct .dec{display:grid;grid-template-columns:auto auto 1fr auto auto;gap:3px 12px;font-size:10px;align-items:center;padding:2px 0}
.ct .dec span{color:var(--ink3)}.ct .dec b{color:var(--ink);font-weight:600}.ct .dec i{font-style:normal;color:var(--dim);font-size:9px}
.ct .words{font-size:10px;color:var(--ink3);line-height:1.55;margin:4px 0}.ct .words b{color:var(--ink2);font-weight:600}
.ct .link{background:none;border:0;padding:0;font:inherit;color:var(--ink);font-weight:600;cursor:pointer}.ct .link:hover{color:var(--crk)}
.ct .err{border:.8px solid var(--bear);padding:8px 10px;color:var(--ink);font-size:10.5px}
.ct .loading{color:var(--ink3);font-size:10px;padding:12px 2px;letter-spacing:.2em}
/* the ladder */
.ct .step{border-top:.5px solid var(--line);padding:6px 0}
.ct .step .sn{display:inline-block;font-size:9px;font-weight:700;color:var(--ink);border:.6px solid var(--ink3);padding:1px 5px;margin-right:8px}
.ct .step .st{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink)}
.ct .step p{margin:3px 0;font-size:10px;color:var(--ink3)}`;

function ensureCSS() { if (!document.getElementById("ct-css")) { const s = document.createElement("style"); s.id = "ct-css"; s.textContent = CSS; document.head.appendChild(s); } }
const localRows = () => { try { return JSON.parse(localStorage.getItem(LS) || "[]"); } catch (_) { return []; } };
async function loadDecisions(opts, companies) {
  if (opts.read) { try { const rows = await opts.read(`comps_decisions?select=id,company,peer,measure,off,reason,set_by,set_at&company=in.(${companies.map(encodeURIComponent).join(",")})&order=set_at.asc`); return { rows: Array.isArray(rows) ? rows : [], mode: "db" }; } catch (e) { return { rows: localRows(), mode: "local", why: String(e && e.message || e) }; } }
  return { rows: localRows(), mode: "local", why: "no read function" };
}
async function storeDecision(S, row) {
  S.decisions.push(row);
  if (S.mode === "db" && S.opts.write) { try { await S.opts.write("comps_decisions", [row]); return; } catch (e) { S.mode = "local"; S.why = String(e && e.message || e); } }
  try { const all = localRows(); all.push(row); localStorage.setItem(LS, JSON.stringify(all)); } catch (_) {}
}
const CTX = new Map(), TTL = 10 * 60e3;
let STANDIN = null;
async function standin() { if (STANDIN !== null) return STANDIN; try { STANDIN = await (await fetch(STANDIN_URL, { cache: "no-store" })).json(); } catch (_) { STANDIN = false; } return STANDIN; }

export async function mountCompsTab(root, opts) {
  ensureCSS();
  const T = String(opts.ticker).toUpperCase();
  root.classList.add("ct"); root.classList.toggle("narrow", root.clientWidth < 520); root.dataset.mounted = T;
  root.innerHTML = `<div class="loading">READING THE PEER SETS OF ${esc(T)}…</div>`;
  let sets, ctx;
  const cache = (CTX.get("__sets__" + T) || {}).cache || new Map();
  try {
    const hit = CTX.get("__sets__" + T);
    sets = hit && Date.now() - hit.at < TTL ? hit.sets : await resolveSets({ ticker: T, pg: opts.pg });
    CTX.set("__sets__" + T, { sets, at: Date.now(), cache });
    const fx = await standin();
    const want = opts.set || (hit && hit.set) || "TIGHTEST";
    ctx = await readSet({ ticker: T, set: want, sets, today: opts.today, pg: opts.pg, quotes: opts.quotes, livePrices: opts.livePrices || {}, fxStandin: fx || null, cache });
  } catch (e) { root.innerHTML = `<div class="err"><b>${esc(T)}</b>: the comps could not be read — ${esc(e && e.message || e)}.</div>`; return; }
  if (root.dataset.mounted !== T) return;
  const members = ctx.members.filter((t) => !ctx.excluded.some((e) => e.ticker === t));
  const snap = snapshotFromCohort(ctx, T);
  const dec = await loadDecisions(opts, members);
  const S = { root, opts, ctx, sets, set: ctx.set, cache, snap, T, members, decisions: dec.rows, mode: dec.mode, why: dec.why || null, way: "B", sort: { key: "sel.mid", dir: -1 }, reasonFor: null, open: {}, moves: {} };
  root._ct = S;
  render(S);
  const fit = () => root.classList.toggle("narrow", root.clientWidth < 520);
  fit(); new ResizeObserver(fit).observe(root);
  movesLoad(S);
}
/* the other sets, read in the background, so the card can say how far the answer moves between them */
async function movesLoad(S) {
  const fx = await standin();
  for (const s of S.sets.sets) {
    if (s.missing || s.key === S.set) continue;
    try {
      const ctx = await readSet({ ticker: S.T, set: s.key, sets: S.sets, today: S.opts.today, pg: S.opts.pg, quotes: S.opts.quotes, livePrices: S.opts.livePrices || {}, fxStandin: fx || null, cache: S.cache });
      const snap = snapshotFromCohort(ctx, S.T), C = conclusion(snap, S.decisions, S.way), w = wayOf(C.ways, S.way);
      S.moves[s.key] = { label: ctx.set_label, n: ctx.members.length - 1, upside: w && w.ok ? w.upside.mid.pct : null, mid: w && w.ok ? w.mid : null };
    } catch (e) { S.moves[s.key] = { label: s.label, error: String(e && e.message || e) }; }
    if (S.root.dataset.mounted !== S.T) return;
    const el = S.root.querySelector("#ctMoves"); if (el) el.innerHTML = movesHTML(S);
  }
}
async function switchSet(S, key) {
  const s = S.sets.sets.find((x) => x.key === key); if (!s || s.missing) return;
  const fx = await standin();
  const ctx = await readSet({ ticker: S.T, set: key, sets: S.sets, today: S.opts.today, pg: S.opts.pg, quotes: S.opts.quotes, livePrices: S.opts.livePrices || {}, fxStandin: fx || null, cache: S.cache });
  S.ctx = ctx; S.set = key; S.members = ctx.members.filter((t) => !ctx.excluded.some((e) => e.ticker === t)); S.snap = snapshotFromCohort(ctx, S.T); S.cohortRows = null; S.snaps = null;
  const hit = CTX.get("__sets__" + S.T); if (hit) hit.set = key;
  const dec = await loadDecisions(S.opts, S.members); S.decisions = dec.rows; S.mode = dec.mode;
  render(S); movesLoad(S);
}
function movesHTML(S) {
  const here = S.C && S.C.upside ? S.C.upside.mid.pct : null;
  const parts = S.sets.sets.filter((s) => !s.missing).map((s) => {
    if (s.key === S.set) return `<b>${esc(SET_WORDS[s.key].name)}</b> ${here != null ? esc(PCT(here)) : "—"}`;
    const m = S.moves[s.key]; if (!m) return `${esc(SET_WORDS[s.key].name)} …`;
    return `${esc(SET_WORDS[s.key].name)} ${m.error ? "—" : esc(PCT(m.upside))}`;
  });
  const vals = Object.values(S.moves).map((m) => m.upside).filter((v) => v != null).concat(here != null ? [here] : []);
  const spread = vals.length > 1 ? Math.max(...vals) - Math.min(...vals) : null;
  return `to the centre by peer set: ${parts.join(" · ")}${spread != null ? ` · <b>${spread.toFixed(0)} points apart</b>` : ""}${S.sets.sets.filter((s) => s.missing).map((s) => ` · ${esc(SET_WORDS[s.key].name)}: ${esc(s.missing.split(":")[0])}`).join("")}`;
}
function render(S) {
  const { snap, T } = S;
  const C = conclusion(snap, S.decisions, S.way); S.C = C;
  const rows = rowSummaries(C.rows, T); S.rowsNow = C.rows;
  const w = wayOf(C.ways, S.way), peers = S.members.filter((t) => t !== T);
  const h = [];
  /* the peer set, a switch */
  const setBtn = (s) => s.missing ? `<button type="button" class="miss" title="${esc(s.missing)}">${esc(SET_WORDS[s.key].name)}<small>not on hand</small></button>`
    : `<button type="button" data-ct="set" data-s="${s.key}" class="${S.set === s.key ? "on" : ""}" title="${esc(SET_WORDS[s.key].plain)} · ${esc(s.source || "")}">${esc(SET_WORDS[s.key].name)}<small>${esc(s.label)}${s.members ? " · " + (s.members.length - 1) : ""}</small></button>`;
  h.push(`<div class="ct-top"><div class="ct-h"><b>${esc(T)}</b><span title="${esc(snap.name)}">${peers.length} peers · ${esc(S.ctx.peer_source || "")}</span><span class="ct-store${S.mode === "local" ? " local" : ""}" title="${esc(S.why || "")}">${S.mode === "db" ? "decisions saved" : "decisions in this browser only"}</span></div>
    <div class="ct-sets"><span class="k">peers</span>${S.sets.sets.filter((s) => s.key !== "LARGEST" || largestDiffers(S.sets) || !s.members).map(setBtn).join("")}</div>
    <div class="ct-moves" id="ctMoves">${movesHTML(S)}</div>${fxLine(snap)}</div>`);
  /* THE TABLE, open, first */
  h.push(`<details class="ct-d" data-d="table" open><summary>the table<small>${peers.length} peers · ${TABLE.length} columns · on / off</small></summary><div class="body">${tableHTML(S)}</div></details>`);
  /* the conclusion card, with the four ways as pictures beside the switch */
  h.push(`<div class="ct-card">
    <div class="ct-cardgrid"><div>
    <div class="ct-main">
      <div><div class="k">comps price range · way ${esc(w ? w.short : S.way)}</div>${C.band ? `<div class="range"><small>low</small>${esc(P0(C.band.lo))}<i>·</i><small>centre</small>${esc(P0(C.band.mid))}<i>·</i><small>high</small>${esc(P0(C.band.hi))}</div>` : `<div class="range" style="font-size:11px;color:var(--ink3)">${esc(C.reason || "no range: no row can be priced")}</div>`}</div>
      <div><div class="k">today</div><div class="today">${esc(P(snap.price))}</div></div>
      <div><div class="k">to the centre</div>${C.upside ? `<div class="upside${dirCls(C.upside.mid.pct)}">${esc(PCT(C.upside.mid.pct))}<small>${esc((C.upside.mid.dollars >= 0 ? "+" : "−") + P0(Math.abs(C.upside.mid.dollars)))}</small></div>` : `<div class="upside" style="color:var(--mute)">—</div>`}</div>
    </div>
    <div class="ct-sw"><span class="k">way</span>${WAYS.map((k) => { const ww = wayOf(C.ways, k); return `<button type="button" data-ct="way" data-w="${k}" class="${S.way === k ? "on" : ""}" title="${esc(ww ? ww.plain : "")}">${esc(WAY_WORDS[k].short)}</button>`; }).join("")}</div>
    <div class="ct-line">${esc(C.disagreement.words)}${C.band ? ` · low ${esc(PCT(C.upside.lo.pct))} · high ${esc(PCT(C.upside.hi.pct))}` : ""}</div>
    </div><div class="ct-bands" id="ctBands"><svg></svg></div></div>
  </div>`);
  /* the six rows */
  h.push(`<div class="ct-rows" id="ctRows"></div>`);
  /* closed disclosures */
  h.push(disclosure(S, "detail", `the detail · 25th and 75th`, `both sets · the words behind the switch`, detailHTML(S, rows, C)));
  h.push(disclosure(S, "ladder", "how it is built", "seven steps", S.open.ladder ? ladderHTML(S) : ""));
  h.push(disclosure(S, "cohort", "cohort", `${S.members.length} companies · way ${esc(w ? w.short : S.way)}`, S.open.cohort ? cohortHTML(S) : ""));
  S.root.innerHTML = h.join("");
  drawRows(S, rows); drawBands(S);
  wire(S);
}
/* the four ways as pictures: four lanes on one $ axis, each band with its centre and its upside */
function drawBands(S) {
  const box = S.root.querySelector("#ctBands"); if (!box) return;
  const svg = box.querySelector("svg"), C = S.C, price = S.snap.price;
  const d = () => {
    const W = Math.max(150, box.clientWidth || 200); while (svg.firstChild) svg.removeChild(svg.firstChild);
    const ok = C.ways.filter((w) => w.ok); if (!ok.length) { svg.setAttribute("height", 10); return; }
    const vals = [price, ...ok.flatMap((w) => [w.lo, w.hi])]; let lo = Math.min(...vals), hi = Math.max(...vals); if (!(hi > lo)) { lo *= 0.9; hi *= 1.1; }
    const padL = 22, padR = 66, inner = W - padL - padR, x = (p) => Math.round((padL + ((p - lo) / (hi - lo)) * inner) * 10) / 10;
    const laneH = 17, H = 4 * laneH + 14;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H);
    svg.appendChild(el("line", { class: "bd-today", x1: x(price), x2: x(price), y1: 2, y2: H - 12 }));
    svg.appendChild(el("text", { class: "bd-lane", x: x(price), y: H - 2, "text-anchor": "middle" }, "today " + P0(price)));
    C.ways.forEach((w, i) => {
      const y = 6 + i * laneH, on = w.way === S.way;
      svg.appendChild(el("text", { class: "bd-lane" + (on ? " on" : ""), x: 0, y: y + 8 }, w.way === "CE" ? "C=" : w.way === "CW" ? "Cw" : w.way));
      if (!w.ok) { svg.appendChild(el("text", { class: "bd-n", x: padL, y: y + 8 }, "—")); return; }
      svg.appendChild(el("rect", { class: "bd-box" + (on ? " on" : ""), x: x(w.lo), y: y, width: Math.max(1, x(w.hi) - x(w.lo)), height: 10 }));
      svg.appendChild(el("line", { class: "bd-mid", x1: x(w.mid), x2: x(w.mid), y1: y - 1, y2: y + 11 }));
      const t = el("text", { class: "bd-n" + (on ? " on" : ""), x: W - padR + 4, y: y + 8 }, `${P0(w.mid)} ${PCT(w.upside.mid.pct)}`);
      if (w.upside.mid.pct < 0) t.setAttribute("fill", "var(--bear)"); else if (on) t.setAttribute("fill", "var(--bull)");
      svg.appendChild(t);
    });
  };
  new ResizeObserver(d).observe(box); requestAnimationFrame(d);
}
function fxLine(snap) {
  const fx = snap.fx; if (!fx || !fx.currency || fx.currency === "USD") return "";
  const full = `${fx.why || ""}${fx.adr && fx.adr.basis ? " · " + fx.adr.basis : ""}`;
  if (!fx.converted) return `<div class="ct-fx warn" title="${esc(full)}">statements in ${esc(fx.currency)} · not converted: ${esc(fx.why || "no rate")}</div>`;
  const nr = fx.rates && fx.rates.length ? fx.rates[fx.rates.length - 1] : null;
  const rateWords = fx.implied ? `at ${esc(Number(nr.rate).toPrecision(4))}, one rate implied by FMP's market values, a stand-in` : nr ? `at ${esc(Number(nr.rate).toPrecision(4))} (${esc(nr.date)}) · ${fx.standin ? "ECB reference rates, a stand-in" : "FMP rates"}` : "";
  return `<div class="ct-fx" title="${esc(full)}">statements in ${esc(fx.currency)} → USD ${rateWords} · per US share</div>`;
}
const disclosure = (S, id, title, meta, body) => `<details class="ct-d" data-d="${id}"${S.open[id] ? " open" : ""}><summary>${esc(title)}<small>${meta}</small></summary><div class="body">${body}</div></details>`;

/* ---- the six rows: the company as an overlay -------------------------------------------------------------- */
function drawRows(S, rows) {
  const box = S.root.querySelector("#ctRows"); if (!box) return;
  box.innerHTML = "";
  for (const r of rows) {
    const div = document.createElement("div"); div.className = "ct-row";
    const up = r.upside;
    div.innerHTML = `<div class="lb">${esc(r.label)}<small>${r.n} peers${r.dropped.length ? " · " + r.dropped.length + " off" : ""}</small></div><div><svg></svg></div>
      <div class="u${up == null ? " no" : dirCls(up)}">${up != null ? esc(PCT(up)) + "<small>to median</small>" : esc(r.own_why || r.reason || "—")}</div>`;
    box.appendChild(div);
    const svg = div.querySelector("svg"), host = svg.parentElement;
    if (r.n >= 1 && r.median != null) { const d = () => drawRow(svg, r, S.T, host.clientWidth || 300); new ResizeObserver(d).observe(host); requestAnimationFrame(d); }
    else svg.setAttribute("height", 6);
  }
}
function drawRow(svg, r, T, width) {
  const W = Math.max(160, Math.floor(width)); while (svg.firstChild) svg.removeChild(svg.firstChild);
  const vals = [r.min, r.max, r.own].filter((v) => v != null && v > 0);
  let lo = Math.min(...vals), hi = Math.max(...vals); if (!(hi > lo)) { lo *= 0.9; hi = hi * 1.1 || 1; }
  const useLog = lo > 0 && hi / lo > 50, L = Math.log10, pad = 8, inner = W - 2 * pad;
  const x = (m) => Math.round((pad + (useLog ? (L(m) - L(lo)) / (L(hi) - L(lo)) : (m - lo) / (hi - lo)) * inner) * 10) / 10;
  const H = 40, y = 24, boxH = 9, capH = 6;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H);
  // the peers: a quiet line, the middle half, the median
  const d = r.detail;
  svg.appendChild(el("line", { class: "wh", x1: x(r.min), x2: x(r.max), y1: y, y2: y }));
  for (const v of [r.min, r.max]) svg.appendChild(el("line", { class: "wh", x1: x(v), x2: x(v), y1: y - capH / 2, y2: y + capH / 2 }));
  if (d && d.q1 && d.q3 && d.q1.multiple != null) svg.appendChild(el("rect", { class: "box", x: x(d.q1.multiple), y: y - boxH / 2, width: Math.max(1, x(d.q3.multiple) - x(d.q1.multiple)), height: boxH }));
  svg.appendChild(el("line", { class: "medl", x1: x(r.median), x2: x(r.median), y1: y - boxH / 2 - 2, y2: y + boxH / 2 + 2 }));
  // the marks carry their labels: lowest and highest under the ends, the median under its tick
  const tl = el("text", { class: "peern", x: x(r.min), y: y + 13, "text-anchor": "start" }, X(r.min)); svg.appendChild(tl);
  const th = el("text", { class: "peern", x: x(r.max), y: y + 13, "text-anchor": "end" }, X(r.max)); svg.appendChild(th);
  const tm = el("text", { class: "medn", y: y + 13, "text-anchor": "middle" }, "median " + X(r.median)); svg.appendChild(tm);
  const wm = widthOf(tm, 70), mx = x(r.median);
  // keep the median label clear of the end labels
  const wl = widthOf(tl, 30), wh = widthOf(th, 30);
  let mxl = Math.max(pad + wl + wm / 2 + 6, Math.min(W - pad - wh - wm / 2 - 6, mx)); tm.setAttribute("x", mxl);
  if (Math.abs(mxl - mx) > 3) svg.appendChild(el("line", { class: "tie", x1: mx, x2: mxl, y1: y + boxH / 2 + 3, y2: y + 6 }));
  // the company: its own shape, weight and colour, and a rule through the row, its number above
  if (r.own != null && r.own > 0) {
    const px = x(r.own);
    svg.appendChild(el("line", { class: "me-rule", x1: px, x2: px, y1: 11, y2: H - 1 }));
    svg.appendChild(el("circle", { class: "me-ring", cx: px, cy: y, r: 6.5 }));
    svg.appendChild(el("circle", { class: "me-dot", cx: px, cy: y, r: 3.6 }));
    const t = el("text", { class: "me-n", y: 9, "text-anchor": "middle" }, X(r.own)); svg.appendChild(t);
    const tw = widthOf(t, 30); t.setAttribute("x", Math.max(tw / 2 + 1, Math.min(W - tw / 2 - 1, px)));
  }
  if (useLog) svg.appendChild(el("text", { class: "peerw", x: W - pad, y: 9, "text-anchor": "end" }, "LOG AXIS"));
}

/* ---- the detail: 25th / 75th for both sets, the words behind the switch ------------------------------------ */
function detailHTML(S, rows, C) {
  const all = rowSummaries(S.snap.rows, S.T);
  const cell = (d, k) => d && d[k] && d[k].price != null ? esc(P0(d[k].price)) : "—";
  const pct = (d, k) => d && d.up && d.up[k] ? `<span class="${dirCls(d.up[k].pct)}">${esc(PCT(d.up[k].pct))}</span>` : "—";
  const line = (r, a, which) => `<tr${which === "sel" && C.off ? ' class="sel"' : ""}><td class="l tk">${esc(r.label)}</td><td class="l">${which}</td><td>${r.n}</td><td>${esc(X(r.own))}</td><td>${cell(r.detail, "q1")} ${pct(r.detail, "q1")}</td><td class="tk">${cell(r.detail, "median")} ${pct(r.detail, "median")}</td><td>${cell(r.detail, "q3")} ${pct(r.detail, "q3")}</td></tr>`;
  const body = rows.map((r) => { const a = all.find((x) => x.key === r.key); return (C.off ? line(a, a, "all peers") : "") + line(r, a, C.off ? "your selection" : "all peers"); }).join("");
  const rel = C.reliability, parts = rel.parts;
  const wline = ROWS.map((k) => `${esc(SHORT[k])} ${(rel.weights[k] * 100).toFixed(0)}%`).join(" · ");
  const fx = S.snap.fx, fxWords = fx && fx.currency && fx.currency !== "USD" ? `<div class="words"><b>Currency.</b> ${esc(fx.why || "")}${fx.adr && fx.adr.basis ? ". " + esc(fx.adr.basis) : ""}${fx.rates && fx.rates.length ? ". Rates used: " + fx.rates.map((r) => esc(r.date) + " " + esc(Number(r.rate).toPrecision(5))).join(", ") : ""}.</div>` : "";
  return `${fxWords}<div class="tw"><table class="t"><thead><tr><th class="l">Row</th><th class="l">Set</th><th>Peers</th><th>${esc(S.T)}</th><th>At the 25th</th><th>At the median</th><th>At the 75th</th></tr></thead><tbody>${body}</tbody></table></div>
    <div class="words"><b>The four ways.</b> ${WAYS.map((k) => `<b>${esc(WAY_WORDS[k].short)}</b> ${esc(WAY_WORDS[k].plain)}`).join(". ")}.</div>
    <div class="words"><b>C weighted, in this cohort (${esc(rel.cls)} prior):</b> ${wline}. <b>C equal:</b> ${ROWS.filter((k) => wayOf(C.ways, "CE") && wayOf(C.ways, "CE").weights[k]).map((k) => esc(SHORT[k])).join(" · ")} at ${wayOf(C.ways, "CE") && wayOf(C.ways, "CE").ok ? (100 / Object.keys(wayOf(C.ways, "CE").weights).length).toFixed(0) : "—"}% each.</div>
    <div class="tw"><table class="t"><thead><tr><th class="l">Row</th><th>Sector prior</th><th>Coverage</th><th>Tightness</th><th>Pricing fit</th><th>Median error</th><th>Weight</th></tr></thead><tbody>${ROWS.map((k) => { const p = parts[k]; return p ? `<tr><td class="l tk">${esc(SHORT[k])}</td><td>${p.prior.toFixed(1)}×</td><td>${(p.coverage * 100).toFixed(0)}%</td><td>${p.tightness.toFixed(2)}</td><td>${p.fit.toFixed(2)}</td><td>${p.median_error != null ? (p.median_error * 100).toFixed(0) + "%" : "—"}</td><td class="tk">${p.priced ? (rel.weights[k] * 100).toFixed(0) + "%" : "not priced"}</td></tr>` : ""; }).join("")}</tbody></table></div>
    <div class="words">coverage = the share of peers with a meaningful value; tightness = 1 ÷ (1 + middle half ÷ median); pricing fit = 1 ÷ (1 + the median error when each peer is priced at the peer median) — the Liu–Nissim–Thomas pricing error; weight ∝ prior × coverage × tightness × fit.</div>`;
}

/* ---- the table: the original comps table, every column, on / off ---------------------------------------------- */
function tableHTML(S) {
  const { snap, T, C } = S, sel = C.sel, FL = flags(snap), names = snap.names || {}, peers = S.members.filter((t) => t !== T);
  const groups = [...new Set(TABLE.map((c) => c.group))];
  const head1 = `<tr><th class="l"></th><th class="l">Peer</th>${groups.map((g) => `<th class="grp" colspan="${TABLE.filter((c) => c.group === g).length}">${esc(g)}</th>`).join("")}<th class="l"></th></tr>`;
  const head2 = `<tr><th></th><th class="l">name</th>${TABLE.map((c) => `<th>${esc(c.label)}</th>`).join("")}<th class="l">reason</th></tr>`;
  const val = (c, v) => v == null ? "—" : F(c.fmt, v);
  const cell = (t, c) => {
    const v = snap.table.peers[t] ? snap.table.peers[t][c.key] : null;
    if (!ROWS.includes(c.key)) return `<td>${esc(val(c, v))}</td>`;
    const row = snap.rows.find((r) => r.key === c.key), vv = row.values[t] || { multiple: null }, f = FL[c.key].cells[t] || {}, off = isOff(sel, t, c.key), peerOff = sel.peers.has(t);
    if (vv.multiple == null) return `<td><span class="cell none" title="${esc(vv.why || "")}">—</span><span class="flag" title="${esc(FLAG_WORDS.nm)}: ${esc(vv.why || "")}">nm</span></td>`;
    const far = f.flag === "far" ? `<span class="flag far" title="${esc(FLAG_WORDS.far)}: ${f.gaps.toFixed(1)} typical gaps from the median (threshold ${FAR_K})">far</span>` : "";
    return `<td><button type="button" class="cell${off || peerOff ? " off" : ""}" data-ct="cell" data-t="${esc(t)}" data-k="${c.key}" title="${off ? "put back" : "turn off on " + esc(SHORT[c.key]) + " only"}">${esc(X(vv.multiple))}</button>${far}</td>`;
  };
  const meRow = `<tr class="me"><td></td><td class="tk l" title="${esc(snap.name)}">${esc(T)}</td>${TABLE.map((c) => `<td>${esc(val(c, snap.table.company[c.key]))}</td>`).join("")}<td class="l"></td></tr>`;
  const body = peers.map((t) => {
    const off = sel.peers.has(t), d = sel.list.filter((x) => x.peer === t);
    const reason = d.map((x) => (x.measure === "ALL" ? "" : SHORT[x.measure] + ": ") + (x.reason || "no reason yet")).join(" · ");
    const r = `<tr class="${off ? "off" : ""}" data-peer="${esc(t)}"><td><button type="button" class="tog${off ? "" : " on"}" data-ct="peer" data-t="${esc(t)}" aria-pressed="${!off}" title="${off ? "put " + esc(t) + " back" : "turn " + esc(t) + " off"}">${off ? "□" : "■"}</button></td><td class="tk l" title="${esc(names[t] || t)}">${esc(t)}</td>${TABLE.map((c) => cell(t, c)).join("")}<td class="l">${esc(reason)}</td></tr>`;
    return S.reasonFor && S.reasonFor.peer === t ? r + reasonRowHTML(S, t) : r;
  }).join("");
  const rowsAll = snap.rows, rowsSel = C.rows;
  const stat = (label, rows, cls, k) => `<tr class="stat ${cls}"><td></td><td class="l">${label}</td>${TABLE.map((c) => { if (!ROWS.includes(c.key)) return "<td></td>"; const a = rowsAll.find((r) => r.key === c.key).band[k], s = rowsSel.find((r) => r.key === c.key).band[k]; const diff = cls.includes("sel") && a != null && s != null && Math.abs(a - s) > 1e-9; return `<td class="${diff ? "chg" : ""}">${esc(X(rows.find((r) => r.key === c.key).band[k]))}</td>`; }).join("")}<td></td></tr>`;
  const stats = [stat("all peers · median", rowsAll, "head", "median"), stat("25th", rowsAll, "", "q1"), stat("75th", rowsAll, "", "q3")].concat(C.off ? [stat("your selection · median", rowsSel, "head sel", "median"), stat("25th", rowsSel, "sel", "q1"), stat("75th", rowsSel, "sel", "q3")] : []).join("");
  const fxRows = peers.filter((t) => snap.fx_peers[t] && snap.fx_peers[t].currency && snap.fx_peers[t].currency !== "USD");
  return `<div class="tw frozen"><table class="t"><thead>${head1}${head2}</thead><tbody>${meRow}${body}${stats}</tbody></table></div>
    ${decisionsHTML(S)}
    ${fxRows.length ? `<div class="words"><b>Foreign filers in this cohort:</b> ${fxRows.map((t) => `${esc(t)} ${esc(snap.fx_peers[t].currency)}${snap.fx_peers[t].converted ? " → USD" : " · " + esc(snap.fx_peers[t].why || "not converted")}`).join("; ")}.</div>` : ""}
    <div class="words"><span class="flag">nm</span> ${esc(FLAG_WORDS.nm)}: no number on that measure. <span class="flag far">far</span> ${esc(FLAG_WORDS.far)}: more than ${FAR_K} typical gaps from the peer median. Both only suggest; a switch is yours.</div>`;
}
function reasonRowHTML(S, t) {
  const R = S.reasonFor, chips = [FLAG_WORDS.op, FLAG_WORDS.far, FLAG_WORDS.nm];
  return `<tr class="reason"><td></td><td colspan="${TABLE.length + 2}" class="l"><div class="chips"><span style="font-size:8.5px;letter-spacing:.14em;color:var(--dim)">WHY IS ${esc(t)}${R.measure !== "ALL" ? " · " + esc(SHORT[R.measure]) : ""} OFF?</span>${chips.map((c) => `<button type="button" class="chip" data-ct="chip" data-r="${esc(c)}">${esc(c)}</button>`).join("")}<input class="in" data-ct="reason" placeholder="or your own words" value="${esc(R.reason || "")}"><button type="button" class="btn on" data-ct="savereason">Save</button><button type="button" class="btn" data-ct="closereason">Later</button></div></td></tr>`;
}
function decisionsHTML(S) {
  const L = S.C.sel.list;
  if (!L.length) return "";
  return `<div style="font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);margin:6px 0 3px">Saved decisions · ${L.length} · <button type="button" class="btn" data-ct="putall">Put all back</button></div>
    ${L.map((d) => `<div class="dec"><b>${esc(d.peer)}</b><span>${d.measure === "ALL" ? "every measure" : esc(SHORT[d.measure])}</span><span>${esc(d.reason || "no reason yet")}</span><i>${d.set_at ? esc(new Date(d.set_at).toLocaleString("en-GB", { timeZone: "America/New_York", hour12: false })) + " ET" : ""}</i><button type="button" class="btn" data-ct="putback" data-t="${esc(d.peer)}" data-k="${esc(d.measure)}">Put back</button></div>`).join("")}`;
}

/* ---- how it is built: the ladder, slim ------------------------------------------------------------------------ */
function ladderHTML(S) {
  const Lr = ladder({ ...S.snap, rows: S.C.rows }), [s1, s2, s3, s4, s5, s6, s7] = Lr.steps;
  const step = (s, body) => `<div class="step"><span class="sn">${s.n}</span><span class="st">${esc(s.title)}</span>${body}</div>`;
  return step(s1, `<p>${esc(s1.rule)}. ${s1.peers.map((p) => esc(p.ticker)).join(" · ")}${s1.excluded.length ? ` · out: ${s1.excluded.map((e) => esc(e.ticker) + " (" + esc(e.why) + ")").join(", ")}` : ""}.</p>`) +
    step(s2, `<p>${esc(s2.source)}.</p>`) +
    step(s3, `<div class="tw"><table class="t"><thead><tr><th class="l">Row</th><th>n</th><th>Lowest</th><th>25th</th><th>Median</th><th>75th</th><th>Highest</th></tr></thead><tbody>${s3.rows.map((r) => r.n ? `<tr><td class="l tk">${esc(r.label)}</td><td>${r.n}</td><td>${esc(X(r.band.min))}</td><td>${esc(X(r.band.q1))}</td><td class="tk">${esc(X(r.band.median))}</td><td>${esc(X(r.band.q3))}</td><td>${esc(X(r.band.max))}</td></tr>` : "").join("")}</tbody></table></div>`) +
    step(s4, `<p>${esc(S.T)} ${esc(P(s4.price))} · shares ${s4.shares ? esc((s4.shares / 1e6).toFixed(0)) + "M" : "—"} · net debt ${s4.net_debt != null ? esc(fmt("money", s4.net_debt)) : "—"}.</p>${s4.rows.map((r) => `<p><b>${esc(r.label)}</b> ${r.denominator.value != null ? esc(r.denominator.word) + " " + esc(fmt(r.denominator.fmt === "money" ? "money" : "usd2", r.denominator.value)) + " · " + esc(r.denominator.formula) : "blank — " + esc(r.denominator.why)}: ${r.lines.map((l) => `${esc(l.word.toLowerCase())} ${l.multiple != null ? esc(X(l.multiple)) : "—"} → ${esc(P0(l.price))}`).join(" · ")}</p>`).join("")}`) +
    step(s5, s5.band ? `<p>${esc(s5.rule)}. 25ths: ${s5.q1s.map((p) => esc(SHORT[p.key]) + " " + esc(P0(p.price))).join(" · ")} → <b>${esc(P0(s5.band.lo))}</b>; medians: ${s5.medians.map((p) => esc(SHORT[p.key]) + " " + esc(P0(p.price))).join(" · ")} → <b>${esc(P0(s5.band.mid))}</b>; 75ths: ${s5.q3s.map((p) => esc(SHORT[p.key]) + " " + esc(P0(p.price))).join(" · ")} → <b>${esc(P0(s5.band.hi))}</b>.${s5.left_out.length ? " Left out: " + s5.left_out.map((r) => esc(r.label) + " (" + esc(r.why) + ")").join(", ") + "." : ""}</p>` : `<p>${esc(s5.reason || "")}</p>`) +
    step(s6, s5.band ? `<p>${["lo", "mid", "hi"].map((k) => s6[k] ? `${k === "lo" ? "low" : k === "mid" ? "centre" : "high"} ${esc(P0(s6[k].dollars + s6.price))} ÷ ${esc(P(s6.price))} − 1 = <b class="${dirCls(s6[k].pct)}">${esc(PCT(s6[k].pct))}</b>` : "").join(" · ")}</p>` : "") +
    step(s7, `<p><b>${esc(s7.sentence)}</b> (way B)</p>`);
}

/* ---- the cohort ------------------------------------------------------------------------------------------------ */
function cohortHTML(S) {
  if (!S.cohortRows) { const snaps = S.members.map((t) => { try { return snapshotFromCohort(S.ctx, t); } catch (_) { return null; } }).filter(Boolean); S.snaps = snaps; }
  S.cohortRows = cohortTable(S.snaps, S.decisions, S.way).rows;
  const rows = sortCohort(S.cohortRows, S.sort.key, S.sort.dir);
  const th = (k, label, l) => `<th class="s${l ? " l" : ""}${S.sort.key === k ? " is-sorted" : ""}" data-ct="sort" data-k="${k}">${label}${S.sort.key === k ? (S.sort.dir < 0 ? " ▼" : " ▲") : ""}</th>`;
  const c = (v) => `<td class="${dirCls(v)}">${esc(PCT(v))}</td>`;
  return `<div class="tw"><table class="t"><thead><tr>${th("ticker", "Ticker", true)}${th("price", "Today")}${th("geiger", "Geiger")}<th>All · low</th>${th("all.mid", "All · centre")}<th>All · high</th><th>Sel · low</th>${th("sel.mid", "Sel · centre")}<th>Sel · high</th>${th("off", "Off")}<th class="l">Currency</th></tr></thead><tbody>
    ${rows.map((r) => `<tr class="${r.ticker === S.T ? "me" : ""}"><td class="tk l"><button type="button" class="link" data-ct="open" data-t="${esc(r.ticker)}" title="${esc(r.name)}">${esc(r.ticker)}</button></td><td>${esc(P(r.price))}</td><td class="${dirCls(r.geiger)}">${esc(G(r.geiger))}</td>${r.all ? c(r.all.lo) + c(r.all.mid) + c(r.all.hi) : `<td colspan="3">no band · ${r.rows_priced} of 6</td>`}${r.sel ? c(r.sel.lo) + c(r.sel.mid) + c(r.sel.hi) : `<td colspan="3">no band</td>`}<td>${r.off || ""}</td><td class="l">${esc(r.fx || "")}</td></tr>`).join("")}</tbody></table></div>`;
}

/* ---- events ------------------------------------------------------------------------------------------------------- */
function wire(S) {
  S.root.querySelectorAll("details.ct-d").forEach((d) => d.addEventListener("toggle", () => { S.open[d.dataset.d] = d.open; if (d.open && !d.querySelector(".body").innerHTML.trim()) { d.querySelector(".body").innerHTML = d.dataset.d === "ladder" ? ladderHTML(S) : d.dataset.d === "cohort" ? cohortHTML(S) : ""; } }));
  S.root.onclick = async (e) => {
    const b = e.target.closest("[data-ct]"); if (!b) return;
    const a = b.dataset.ct;
    if (a === "peer" || a === "cell" || a === "putback") {
      const t = b.dataset.t, measure = a === "peer" ? "ALL" : b.dataset.k, sel = S.C.sel;
      const off = a === "putback" ? false : !isOff(sel, t, measure);
      if (a === "cell" && sel.peers.has(t)) return;
      await storeDecision(S, decisionRow({ company: S.T, peer: t, measure, off, reason: off ? "" : "put back" }));
      S.reasonFor = off ? { peer: t, measure, reason: "" } : null; S.cohortRows = null; render(S); movesLoad(S);
    } else if (a === "putall") { for (const d of S.C.sel.list) await storeDecision(S, decisionRow({ company: S.T, peer: d.peer, measure: d.measure, off: false, reason: "put back" })); S.reasonFor = null; S.cohortRows = null; render(S); }
    else if (a === "chip") { const inp = S.root.querySelector('[data-ct="reason"]'); if (inp) inp.value = b.dataset.r; }
    else if (a === "savereason") { const inp = S.root.querySelector('[data-ct="reason"]'), R = S.reasonFor; if (!R) return; await storeDecision(S, decisionRow({ company: S.T, peer: R.peer, measure: R.measure, off: true, reason: inp ? inp.value.trim() : "" })); S.reasonFor = null; render(S); }
    else if (a === "closereason") { S.reasonFor = null; render(S); }
    else if (a === "way") { S.way = b.dataset.w; S.cohortRows = null; render(S); movesLoad(S); }
    else if (a === "set") { if (b.dataset.s !== S.set) { b.textContent = "reading…"; await switchSet(S, b.dataset.s); } }
    else if (a === "sort") { const k = b.dataset.k; S.sort = S.sort.key === k ? { key: k, dir: -S.sort.dir } : { key: k, dir: k === "ticker" ? 1 : -1 }; const d = S.root.querySelector('details[data-d="cohort"] .body'); if (d) d.innerHTML = cohortHTML(S); }
    else if (a === "open") { if (S.opts.open) S.opts.open(b.dataset.t); }
  };
  S.root.onkeydown = (e) => { if (e.key === "Enter" && e.target.matches('[data-ct="reason"]')) { e.preventDefault(); const s = S.root.querySelector('[data-ct="savereason"]'); if (s) s.click(); } };
}

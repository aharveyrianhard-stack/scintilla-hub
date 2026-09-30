/* Scintilla · COMPS tab (C2, 30 Sep) · the tab itself, in the Hub's own look: its colour tokens (--panel, --line2, --ink,
   --ink3, --dim, --mute, --crk hairlines, --bull / --bear for direction), its mono type and sizes (section heads like the
   ESTIMATES tab's, header cells like the board's), quiet lines, no white. Nothing is imported from the deliverable pages'
   styling. The arithmetic is comps-tab.mjs; the label placement is the approved round-3 stagger. */
import { readCohort, snapshotFromCohort, ROWS, SHORT } from "./cohort.mjs";
import { selectionOf, isOff, decisionRow, applySelection, flags, ways, wayOf, cohortTable, sortCohort, FLAG_WORDS, WAY_WORDS, FAR_K } from "./comps-tab.mjs";
import { rowMarks, rowScale, stagger, upsideTo } from "../../20260928/comps-r3-labels/labels-r3.mjs";
import { fmt } from "../../20260927/comps-r3/r3.mjs";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const X = (v) => v == null ? "—" : fmt("x", v), P0 = (v) => v == null || !Number.isFinite(v) ? "—" : "$" + Math.round(v).toLocaleString("en-US");
const P = (v) => v == null ? "—" : "$" + (v >= 1000 ? Math.round(v).toLocaleString("en-US") : v.toFixed(2));
const PCT = (v) => v == null ? "—" : (v >= 0 ? "+" : "(") + Math.abs(v).toFixed(Math.abs(v) >= 10 ? 0 : 1) + "%" + (v >= 0 ? "" : ")");
const G = (v) => v == null ? "—" : (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2);
const dirCls = (v) => v == null ? "" : v >= 0 ? " up" : " dn";
const LS = "sc_comps_decisions";
const SVG = "http://www.w3.org/2000/svg";
const el = (tag, a = {}, t) => { const e = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); if (t != null) e.textContent = t; return e; };
const widthOf = (t, f) => { try { const w = t.getComputedTextLength(); if (w > 0) return w; } catch (_) {} return f; };

export const CSS = `
.cp{font-family:var(--mono);color:var(--ink2);font-size:11px;line-height:1.5;letter-spacing:.02em}
.cp *{box-sizing:border-box;min-width:0}
.cp .up{color:var(--bull)}.cp .dn{color:var(--bear)}
.cp .cp-head{font-size:10px;color:var(--ink3);letter-spacing:.08em;padding:6px 2px 4px;display:flex;flex-wrap:wrap;gap:4px 14px}
.cp .cp-head b{color:var(--ink);font-weight:600}
.cp .cp-store{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);border:.8px solid rgba(0,212,255,.22);padding:2px 7px}
.cp .cp-store.local{color:var(--sv3)}
.cp .cp-zone{border:.8px solid rgba(0,212,255,.22);padding:8px 10px;margin-bottom:6px}
.cp .cp-words{font-size:10.5px;color:var(--ink3);line-height:1.6;margin:4px 0}
.cp .cp-words b{color:var(--ink2);font-weight:600}
/* the comps table: the board's row track — header cells like sc-hcell, quiet hairlines */
.cp .cp-tw{overflow-x:auto;scrollbar-width:thin}
.cp table.cp-tbl{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:11px}
.cp table.cp-tbl th{font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);font-weight:400;padding:7px 6px 5px;text-align:right;border-bottom:.8px solid rgba(0,212,255,.22);white-space:nowrap}
.cp table.cp-tbl th:first-child,.cp table.cp-tbl th.l,.cp table.cp-tbl td.l{text-align:left}
.cp table.cp-tbl td{padding:4px 6px;text-align:right;border-bottom:.5px solid var(--line);color:var(--ink2);white-space:nowrap;vertical-align:middle}
.cp table.cp-tbl tr:hover td{background:rgba(0,212,255,.04)}
.cp table.cp-tbl td.tk{color:var(--ink);font-weight:600;letter-spacing:.04em}
.cp table.cp-tbl td.nm{color:var(--ink3);font-size:10px}
.cp.narrow table.cp-tbl td.nmc,.cp.narrow table.cp-tbl th.nmc,.cp.narrow table.cp-tbl td.rsn,.cp.narrow table.cp-tbl th.rsn{display:none}
.cp.narrow table.cp-tbl td,.cp.narrow table.cp-tbl th{padding-left:3px;padding-right:3px;font-size:10.5px}
.cp.narrow .cp-flag{display:none}
.cp.narrow .cp-cell.far{color:var(--sv4)}.cp.narrow .cp-cell.nmf{color:var(--mute)}
.cp .cp-row .bs.lanes{color:var(--mute);font-size:8.5px;letter-spacing:.1em;text-transform:uppercase}
.cp table.cp-tbl tr.me td{color:var(--ink);background:rgba(0,212,255,.05)}
.cp table.cp-tbl tr.me td.tk{color:var(--crk)}
.cp table.cp-tbl tr.off td{color:var(--mute)}
.cp table.cp-tbl tr.off td.tk{color:var(--mute);text-decoration:line-through}
.cp table.cp-tbl tr.stat td{color:var(--ink3);border-bottom:.5px solid var(--line);font-size:10.5px}
.cp table.cp-tbl tr.stat td.l{letter-spacing:.12em;text-transform:uppercase;font-size:8.5px;color:var(--dim)}
.cp table.cp-tbl tr.stat.sel td{color:var(--ink)}
.cp table.cp-tbl tr.stat.head td{border-top:.8px solid rgba(0,212,255,.22);padding-top:6px}
.cp table.cp-tbl tr.stat.diff td.chg{color:var(--crk)}
.cp .cp-cell{background:none;border:0;padding:0;margin:0;font:inherit;color:inherit;cursor:pointer;letter-spacing:inherit}
.cp .cp-cell:hover{color:var(--crk)}
.cp .cp-cell.off{color:var(--mute);text-decoration:line-through}
.cp .cp-cell.none{color:var(--mute);cursor:default;text-decoration:none}
.cp .cp-flag{display:inline-block;font-size:7.5px;letter-spacing:.12em;padding:1px 4px;margin-left:4px;border:.6px solid var(--line2);color:var(--dim);vertical-align:middle;text-decoration:none}
.cp .cp-flag.far{color:var(--sv4);border-color:rgba(255,138,0,.4)}
.cp .cp-flag.nm{color:var(--mute)}
.cp .cp-flag.op{color:var(--crk);border-color:rgba(0,212,255,.4)}
.cp .cp-tog{background:none;border:0;cursor:pointer;font-size:12px;line-height:1;width:14px;padding:0;color:#4A4A52}
.cp .cp-tog.on{color:#C9C9CE}
.cp .cp-tog:hover{color:var(--crk)}
.cp .cp-reason{background:rgba(0,212,255,.03)}
.cp .cp-reason td{padding:5px 6px 7px;white-space:normal}
.cp .cp-chips{display:flex;flex-wrap:wrap;gap:5px;align-items:center}
.cp .cp-chip,.cp .cp-btn{font:inherit;font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;padding:4px 8px;background:none;border:.8px solid var(--line2);color:var(--ink3);cursor:pointer;border-radius:0}
.cp .cp-chip:hover,.cp .cp-btn:hover{color:var(--ink);border-color:var(--ink3)}
.cp .cp-chip.on,.cp .cp-btn.on{color:var(--crk);border-color:rgba(0,212,255,.5)}
.cp .cp-in{font:inherit;font-size:10.5px;background:var(--panel2,#0F0F1A);color:var(--ink);border:.8px solid var(--line2);padding:4px 7px;min-width:180px;flex:1 1 180px}
.cp .cp-dec{display:grid;grid-template-columns:auto auto 1fr auto auto;gap:3px 12px;font-size:10.5px;align-items:center;padding:2px 0}
.cp .cp-dec span{color:var(--ink3)}.cp .cp-dec b{color:var(--ink);font-weight:600}.cp .cp-dec i{font-style:normal;color:var(--dim);font-size:9.5px}
/* the field: two lanes per row, ALL PEERS over YOUR SELECTION */
.cp .cp-row{display:grid;grid-template-columns:150px minmax(0,1fr) 190px;gap:0 12px;align-items:center;padding:8px 0;border-bottom:.5px solid var(--line)}
.cp .cp-row:last-child{border-bottom:0}
.cp.narrow .cp-row{grid-template-columns:1fr}
.cp .cp-row .nm{font-size:11px;color:var(--ink);font-weight:600}
.cp .cp-row .bs{font-size:9.5px;color:var(--dim);margin-top:1px}
.cp .cp-row svg{display:block;width:100%;height:auto;overflow:visible}
.cp .cp-row .ups{display:grid;grid-template-columns:auto 1fr 1fr;gap:1px 8px;font-size:10px;font-variant-numeric:tabular-nums}
.cp .cp-row .ups span{color:var(--dim);letter-spacing:.1em;font-size:8px;text-transform:uppercase}
.cp .cp-row .ups b{font-weight:400;color:var(--ink2);text-align:right;white-space:nowrap}
.cp .cp-row .ups b.k{color:var(--ink);font-weight:600}
.cp .cp-row .ups .h{color:var(--dim);font-size:8px;letter-spacing:.12em;text-transform:uppercase;text-align:right}
.cp .lane{font-size:7.5px;letter-spacing:.16em;fill:var(--dim)}
.cp .wh{stroke:var(--ink3);stroke-width:1.5}
.cp .box{fill:rgba(0,212,255,.10);stroke:rgba(0,212,255,.35);stroke-width:.8}
.cp .box.sel{fill:rgba(0,212,255,.18);stroke:var(--crk)}
.cp .medl{stroke:var(--ink);stroke-width:2}
.cp .own-line{stroke-width:1;stroke-dasharray:3 3}
.cp .up-stroke{stroke:var(--bull)}.cp .dn-stroke{stroke:var(--bear)}
.cp .up-fill{fill:var(--bull)}.cp .dn-fill{fill:var(--bear)}
.cp .tie{stroke:var(--line2);stroke-width:.8}.cp .tick{stroke:var(--ink3);stroke-width:.8}
.cp .word{font-size:7px;letter-spacing:.12em;fill:var(--dim)}.cp .word.own{font-weight:700}
.cp .num{font-size:9.5px;fill:var(--ink2)}.cp .num.bold{font-weight:700;fill:var(--ink)}
.cp .uptext{font-size:9px;font-weight:600;paint-order:stroke;stroke:var(--panel);stroke-width:3px;stroke-linejoin:round}
/* the ways */
.cp .cp-ways{display:flex;gap:6px;flex-wrap:wrap;margin:2px 0 6px}
.cp .cp-way{flex:1 1 200px;border:.8px solid var(--line2);padding:6px 8px;cursor:pointer;background:none;text-align:left;font:inherit;color:var(--ink3)}
.cp .cp-way.on{border-color:rgba(0,212,255,.5);color:var(--ink2)}
.cp .cp-way b{display:block;font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);margin-bottom:2px}
.cp .cp-way.on b{color:var(--crk)}
.cp .cp-way small{font-size:10px;line-height:1.5;color:var(--ink3);display:block}
.cp .cp-way i{font-style:normal;font-size:8px;letter-spacing:.14em;color:var(--dim);text-transform:uppercase}
/* the upside */
.cp .cp-up{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.cp.narrow .cp-up{grid-template-columns:1fr}
.cp .cp-upbox{border:.8px solid var(--line2);padding:6px 10px}
.cp .cp-upbox .h{font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim)}
.cp .cp-upbox .big{font-size:22px;font-weight:600;color:var(--ink);line-height:1.2;margin:2px 0}
.cp .cp-upbox .big small{font-size:11px;font-weight:400;color:var(--ink3);margin-left:6px}
.cp .cp-upbox .edges{display:grid;grid-template-columns:auto 1fr 1fr;gap:1px 10px;font-size:10.5px;font-variant-numeric:tabular-nums}
.cp .cp-upbox .edges span{color:var(--dim);font-size:8px;letter-spacing:.12em;text-transform:uppercase}
.cp .cp-upbox .edges b{font-weight:400;text-align:right;color:var(--ink2)}
/* the cohort table */
.cp table.cp-tbl th.s{cursor:pointer}.cp table.cp-tbl th.s:hover{color:var(--ink2)}.cp table.cp-tbl th.s.is-sorted{color:var(--crk);box-shadow:inset 0 -2px 0 var(--crk)}
.cp table.cp-tbl td.g{font-weight:600}
.cp .cp-link{background:none;border:0;padding:0;font:inherit;color:var(--ink);font-weight:600;cursor:pointer;letter-spacing:.04em}
.cp .cp-link:hover{color:var(--crk)}
.cp .cp-err{border:.8px solid var(--bear);padding:8px 10px;color:var(--ink);font-size:10.5px}
.cp .cp-loading{color:var(--ink3);font-size:10px;padding:12px 2px;letter-spacing:.2em}`;

const sechead = (n, t, meta) => `<div class="sc-est-sechead"><span class="n">${n}</span><span class="t">${t}</span><span class="rule"></span>${meta ? `<span class="meta">${meta}</span>` : ""}</div>`;
function ensureCSS() { if (!document.getElementById("cp-css")) { const s = document.createElement("style"); s.id = "cp-css"; s.textContent = CSS; document.head.appendChild(s); } }

/* ---- storage: the table when it exists, this browser when it does not ------------------------------ */
async function loadDecisions(opts, company) {
  const local = () => { try { return JSON.parse(localStorage.getItem(LS) || "[]"); } catch (_) { return []; } };
  if (opts.read) {
    try { const rows = await opts.read(`comps_decisions?select=id,company,peer,measure,off,reason,set_by,set_at&company=eq.${encodeURIComponent(company)}&order=set_at.asc`); return { rows: Array.isArray(rows) ? rows : [], mode: "db" }; }
    catch (e) { return { rows: local(), mode: "local", why: String(e && e.message || e) }; }
  }
  return { rows: local(), mode: "local", why: "no read function" };
}
async function loadAllDecisions(opts, companies) {
  const local = () => { try { return JSON.parse(localStorage.getItem(LS) || "[]"); } catch (_) { return []; } };
  if (opts.read) { try { const rows = await opts.read(`comps_decisions?select=id,company,peer,measure,off,reason,set_by,set_at&company=in.(${companies.map(encodeURIComponent).join(",")})&order=set_at.asc`); return Array.isArray(rows) ? rows : []; } catch (_) { return local(); } }
  return local();
}
async function storeDecision(S, opts, row) {
  S.decisions.push(row);
  if (S.mode === "db" && opts.write) { try { await opts.write("comps_decisions", [row]); return; } catch (e) { S.mode = "local"; S.why = String(e && e.message || e); } }
  try { const all = JSON.parse(localStorage.getItem(LS) || "[]"); all.push(row); localStorage.setItem(LS, JSON.stringify(all)); } catch (_) {}
}

/* ---- mount ------------------------------------------------------------------------------------------ */
const CTX = new Map(), TTL = 10 * 60e3;
export async function mountCompsTab(root, opts) {
  ensureCSS();
  const T = String(opts.ticker).toUpperCase();
  root.classList.add("cp"); root.dataset.mounted = T;
  root.innerHTML = `<div class="cp-loading">READING THE PEERS OF ${esc(T)}…</div>`;
  let ctx;
  try {
    const hit = CTX.get(T);
    if (hit && Date.now() - hit.at < TTL) ctx = hit.ctx;
    else { ctx = await readCohort({ ticker: T, today: opts.today, pg: opts.pg, quotes: opts.quotes, livePrices: opts.livePrices || {} }); for (const m of ctx.members) CTX.set(m, { ctx, at: Date.now() }); }
  } catch (e) { root.innerHTML = `<div class="cp-err"><b>${esc(T)}</b>: the comps could not be read — ${esc(e && e.message || e)}.</div>`; return; }
  if (root.dataset.mounted !== T) return;
  const snap = snapshotFromCohort(ctx, T);
  const dec = await loadDecisions(opts, T);
  const S = { root, opts, ctx, snap, T, decisions: dec.rows, mode: dec.mode, why: dec.why || null, way: "B", sort: { key: "sel.mid", dir: -1 }, reasonFor: null, cohortRows: null, allDecisions: null };
  root._cp = S;
  render(S);
  const fit = () => root.classList.toggle("narrow", root.clientWidth < 900);
  fit(); new ResizeObserver(fit).observe(root);
  cohortLoad(S);
}

function render(S) {
  const { snap, T } = S, sel = selectionOf(S.decisions, T);
  const rowsAll = snap.rows, rowsSel = applySelection(snap, sel), F = flags(snap);
  const WA = ways(rowsAll, snap.price), WS = ways(rowsSel, snap.price);
  S.rowsAll = rowsAll; S.rowsSel = rowsSel; S.sel = sel; S.F = F; S.WA = WA; S.WS = WS;
  const peers = snap.members.filter((t) => t !== T && !snap.excluded.some((e) => e.ticker === t));
  const h = [];
  h.push(`<div class="cp-head"><span><b>${esc(T)}</b> · ${esc(snap.name)}</span><span>cohort <b>${esc(snap.cohort)}</b> · ${peers.length} peers${snap.excluded.length ? " · funds out: " + esc(snap.excluded.map((e) => e.ticker).join(", ")) : ""}</span><span>today <b>${esc(P(snap.price))}</b> · ${esc(snap.price_from || "?")}</span><span>read ${esc(new Date(snap.taken).toLocaleTimeString("en-GB", { timeZone: "America/New_York", hour12: false }))} ET</span>
    <span class="cp-store${S.mode === "local" ? " local" : ""}" title="${esc(S.why || "")}">${S.mode === "db" ? "decisions saved to comps_decisions" : "decisions kept in this browser only · comps_decisions not applied yet"}</span>${snap.quotes_error ? `<span class="dn">peers' prices not reached: ${esc(snap.quotes_error)} · dated prices stand in</span>` : ""}</div>`);
  // 01 the table
  h.push(sechead("01", "Comps table", `${peers.length} peers · click a cell or a peer to turn it off · flags only suggest`));
  h.push(`<div class="cp-zone">${tableHTML(S, peers)}${decisionsHTML(S)}</div>`);
  // 02 the field
  h.push(sechead("02", "The field", "all peers over your selection · same axis per row"));
  h.push(`<div class="cp-zone"><div id="cpField"></div><div class="cp-words">Each row: the peers from the lowest to the highest, the box is the middle half (25th to 75th), the thick tick the median, the diamond ${esc(T)} today (green below the median, red above). Top lane ALL PEERS, bottom lane YOUR SELECTION, on one axis; the column on the right is the price each mark implies for ${esc(T)}.</div></div>`);
  // 03 the ways
  h.push(sechead("03", "Three ways to one range", "a proposal · B pre-selected · nothing settled"));
  h.push(`<div class="cp-zone"><div class="cp-ways">${["A", "B", "C"].map((w) => `<button type="button" class="cp-way${S.way === w ? " on" : ""}" data-cp="way" data-w="${w}"><b>${w} · ${esc(WAY_WORDS[w].name)}</b><small>${esc(WAY_WORDS[w].plain)}</small>${w === "B" ? `<i>proposed</i>` : ""}</button>`).join("")}</div><div id="cpWays"></div>${waysTableHTML(S)}</div>`);
  // 04 the upside
  h.push(sechead("04", "Upside", `way ${S.way} · from ${esc(P(snap.price))} today`));
  h.push(`<div class="cp-zone">${upsideHTML(S)}</div>`);
  // 05 the cohort table
  h.push(sechead("05", "Cohort", `every company in ${esc(snap.cohort)} · way ${S.way} · sortable`));
  h.push(`<div class="cp-zone" id="cpCohort">${S.cohortRows ? cohortHTML(S) : `<div class="cp-loading">COMPUTING EVERY MEMBER'S BAND…</div>`}</div>`);
  S.root.innerHTML = h.join("");
  drawField(S); drawWays(S);
  wire(S);
}

/* ---- 01 the table ----------------------------------------------------------------------------------- */
function tableHTML(S, peers) {
  const { snap, sel, F, T, rowsAll, rowsSel } = S;
  const names = snap.names || {};
  const cell = (t, key) => {
    const v = snap.rows.find((r) => r.key === key).values[t] || { multiple: null };
    const f = F[key].cells[t] || {}, off = isOff(sel, t, key), peerOff = sel.peers.has(t);
    if (v.multiple == null) return `<td><span class="cp-cell none" title="${esc(v.why || "")}">—</span><span class="cp-flag nm" title="${esc(FLAG_WORDS.nm)}: ${esc(v.why || "")}">NM</span></td>`;
    const far = f.flag === "far" ? `<span class="cp-flag far" title="${esc(FLAG_WORDS.far)}: ${f.gaps.toFixed(1)} typical gaps from the median (threshold ${FAR_K})">FAR</span>` : "";
    return `<td><button type="button" class="cp-cell${off || peerOff ? " off" : ""}${f.flag === "far" ? " far" : ""}" data-cp="cell" data-t="${esc(t)}" data-k="${key}" title="${off ? "put " + esc(t) + " back on " + esc(SHORT[key]) : "turn " + esc(t) + " off on " + esc(SHORT[key]) + " only"}${f.gaps != null ? " · " + f.gaps.toFixed(1) + " typical gaps from the median" : ""}">${esc(X(v.multiple))}</button>${far}</td>`;
  };
  const head = `<tr><th class="l" style="width:14px"></th><th class="l">Peer</th><th class="l nmc">Name</th>${ROWS.map((k) => `<th>${esc(SHORT[k])}</th>`).join("")}<th class="l rsn">Reason</th></tr>`;
  const me = snap.rows;
  const meRow = `<tr class="me"><td></td><td class="tk">${esc(T)}</td><td class="nm l nmc">${esc(snap.name)} · today</td>${ROWS.map((k) => `<td>${esc(X(me.find((r) => r.key === k).own.multiple))}</td>`).join("")}<td class="l rsn"></td></tr>`;
  const body = peers.map((t) => {
    const off = sel.peers.has(t), d = sel.list.filter((x) => x.peer === t);
    const reason = d.map((x) => (x.measure === "ALL" ? "" : SHORT[x.measure] + ": ") + (x.reason || "(no reason yet)")).join(" · ");
    const opFlag = d.length ? `<span class="cp-flag op" title="${esc(FLAG_WORDS.op)} — the operator's decision">${d.some((x) => x.measure === "ALL") ? "OFF" : "CELL OFF"}</span>` : "";
    const r = `<tr class="${off ? "off" : ""}" data-peer="${esc(t)}"><td><button type="button" class="cp-tog${off ? "" : " on"}" data-cp="peer" data-t="${esc(t)}" aria-pressed="${!off}" title="${off ? "put " + esc(t) + " back" : "turn " + esc(t) + " off on every measure"}">${off ? "□" : "■"}</button></td><td class="tk">${esc(t)}${opFlag}</td><td class="nm l nmc" title="${esc(names[t] || t)}">${esc((names[t] || t).slice(0, 26))}</td>${ROWS.map((k) => cell(t, k)).join("")}<td class="l nm rsn">${esc(reason)}</td></tr>`;
    if (S.reasonFor && S.reasonFor.peer === t) return r + reasonRowHTML(S, t);
    return r;
  }).join("");
  const stat = (label, rows, cls, k) => `<tr class="stat ${cls}"><td></td><td class="l" colspan="2">${label}</td>${ROWS.map((key) => { const a = rowsAll.find((r) => r.key === key).band[k], s = rowsSel.find((r) => r.key === key).band[k]; const diff = cls.includes("sel") && a != null && s != null && Math.abs(a - s) > 1e-9; return `<td class="${diff ? "chg" : ""}">${esc(X(rows.find((r) => r.key === key).band[k]))}</td>`; }).join("")}<td></td></tr>`;
  const nrow = (label, rows, cls) => `<tr class="stat ${cls}"><td></td><td class="l" colspan="2">${label}</td>${ROWS.map((key) => `<td>${rows.find((r) => r.key === key).n}</td>`).join("")}<td></td></tr>`;
  const stats = [
    nrow("ALL PEERS · in the count", rowsAll, "head"), stat("lowest", rowsAll, "", "min"), stat("25th", rowsAll, "", "q1"), stat("median", rowsAll, "", "median"), stat("75th", rowsAll, "", "q3"), stat("highest", rowsAll, "", "max"),
    nrow("YOUR SELECTION · in the count", rowsSel, "head sel"), stat("lowest", rowsSel, "sel diff", "min"), stat("25th", rowsSel, "sel diff", "q1"), stat("median", rowsSel, "sel diff", "median"), stat("75th", rowsSel, "sel diff", "q3"), stat("highest", rowsSel, "sel diff", "max"),
    `<tr class="stat head"><td></td><td class="l" colspan="2">FAR FROM THE PACK · typical gap</td>${ROWS.map((k) => `<td title="the median distance of the peers from their median ${esc(X(F[k].median))}">${esc(X(F[k].typical))}</td>`).join("")}<td class="l nm">median |peer − median|</td></tr>`,
    `<tr class="stat"><td></td><td class="l" colspan="2">threshold · ${FAR_K} × typical gap</td>${ROWS.map((k) => `<td>${F[k].threshold != null ? "±" + esc(X(F[k].threshold)) : "—"}</td>`).join("")}<td class="l nm">from the median ${ROWS.map((k) => esc(X(F[k].median))).join(" · ")}</td></tr>`,
  ].join("");
  return `<div class="cp-tw"><table class="cp-tbl"><thead>${head}</thead><tbody>${meRow}${body}${stats}</tbody></table></div>
    <div class="cp-words"><b>Flags are proposals, never removals.</b> <span class="cp-flag nm">NM</span> ${esc(FLAG_WORDS.nm)}: a negative or undefined multiple on that measure — no number to rank. <span class="cp-flag far">FAR</span> ${esc(FLAG_WORDS.far)}: more than ${FAR_K} typical gaps from the peer median on that measure (the typical gap is the median distance of the peers from their median; both numbers are in the last two rows). <span class="cp-flag op">OFF</span> ${esc(FLAG_WORDS.op)}: your own toggle, with a reason. Turning a peer or a cell off recomputes the percentiles, the band and the upside at once; the ALL PEERS rows never change.</div>`;
}
function reasonRowHTML(S, t) {
  const R = S.reasonFor, chips = [FLAG_WORDS.op, FLAG_WORDS.far, FLAG_WORDS.nm];
  return `<tr class="cp-reason"><td></td><td colspan="${ROWS.length + 3}" class="l"><div class="cp-chips"><span style="font-size:8.5px;letter-spacing:.14em;color:var(--dim)">WHY IS ${esc(t)}${R.measure !== "ALL" ? " · " + esc(SHORT[R.measure]) : ""} OFF?</span>${chips.map((c) => `<button type="button" class="cp-chip" data-cp="chip" data-r="${esc(c)}">${esc(c)}</button>`).join("")}<input class="cp-in" data-cp="reason" placeholder="or your own words" value="${esc(R.reason || "")}"><button type="button" class="cp-btn on" data-cp="savereason">Save reason</button><button type="button" class="cp-btn" data-cp="closereason">Later</button></div></td></tr>`;
}
function decisionsHTML(S) {
  const L = S.sel.list;
  if (!L.length) return `<div class="cp-words" id="cpDecisions">No peer or cell is off for ${esc(S.T)}: YOUR SELECTION equals ALL PEERS.</div>`;
  return `<div id="cpDecisions"><div style="font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);margin:6px 0 3px">Saved decisions · ${L.length} · <button type="button" class="cp-btn" data-cp="putall">Put all back</button></div>
    ${L.map((d) => `<div class="cp-dec"><b>${esc(d.peer)}</b><span>${d.measure === "ALL" ? "every measure" : esc(SHORT[d.measure])}</span><span>${esc(d.reason || "no reason yet")}</span><i>${d.set_at ? esc(new Date(d.set_at).toLocaleString("en-GB", { timeZone: "America/New_York", hour12: false })) + " ET" : ""}</i><button type="button" class="cp-btn" data-cp="putback" data-t="${esc(d.peer)}" data-k="${esc(d.measure)}">Put back</button></div>`).join("")}</div>`;
}

/* ---- 02 the field ------------------------------------------------------------------------------------ */
function drawField(S) {
  const box = S.root.querySelector("#cpField"); if (!box) return;
  box.innerHTML = "";
  for (const key of ROWS) {
    const a = S.rowsAll.find((r) => r.key === key), s = S.rowsSel.find((r) => r.key === key);
    const div = document.createElement("div"); div.className = "cp-row";
    const pr = (r, k) => r.ends && r.ends[k] ? P0(r.ends[k].price) : "—";
    const span = a.band && a.band.n && a.band.min > 0 && a.band.max / a.band.min > 50;
    div.innerHTML = `<div><div class="nm">${esc(a.label)}</div><div class="bs">${esc(a.basis || "")}</div><div class="bs">${esc(S.T)} today ${esc(X(a.own.multiple))} · ${a.n} peers${s.n !== a.n ? " → " + s.n + " selected" : ""}</div><div class="bs lanes">top lane ALL PEERS · bottom lane YOUR SELECTION${span ? " · log axis (the peers span over 50×)" : ""}</div></div><div><svg></svg></div>
      <div class="ups"><span></span><b class="h">all peers</b><b class="h">selection</b>${[["25th", "q1"], ["median", "median"], ["75th", "q3"]].map(([w, k]) => `<span>${w} →</span><b class="${k === "median" ? "k" : ""}">${a.ok ? pr(a, k) : "—"}</b><b class="${k === "median" ? "k" : ""}">${s.ok ? pr(s, k) : "—"}</b>`).join("")}<span>to median</span><b class="${dirCls(a.upside)}">${a.ok ? PCT(a.upside) : "—"}</b><b class="${dirCls(s.upside)}">${s.ok ? PCT(s.upside) : "—"}</b></div>`;
    box.appendChild(div);
    const svg = div.querySelector("svg"), host = svg.parentElement;
    if (a.band && a.band.n) { const d = () => drawTwoLanes(svg, a, s, S.T, host.clientWidth || 500); new ResizeObserver(d).observe(host); requestAnimationFrame(d); }
    else svg.setAttribute("height", 4);
  }
}
function drawTwoLanes(svg, a, s, T, width) {
  const W = Math.max(200, Math.floor(width));
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const vals = [a.band.min, a.band.max, s.band.min, s.band.max, a.own.multiple].filter((v) => v != null && v > 0);
  let lo = Math.min(...vals), hi = Math.max(...vals); if (!(hi > lo)) { lo *= 0.9; hi = hi * 1.1 || 1; }
  /* a row that spans more than 50× (AXTI at 3000x beside TSM at 1x) is drawn on a log axis, as the live comps page draws
     its size rows: each tick is then ten times the one before, and the header says so */
  const useLog = lo > 0 && hi / lo > 50, L = Math.log10;
  const pad = 10, inner = W - 2 * pad;
  const x = (m) => Math.round((pad + (useLog ? (L(m) - L(lo)) / (L(hi) - L(lo)) : (m - lo) / (hi - lo)) * inner) * 10) / 10;
  svg.dataset.log = useLog ? "1" : "0";
  const wordH = 9, numH = 11, boxH = 12, capH = 8, laneGap = 14;
  const marks = (r) => rowMarks(r, T);
  const mkTexts = (r, own) => marks(r).filter((m) => own || !m.own).map((m) => { const g = el("g"); const w = el("text", { class: "word" + (m.own ? " own" : ""), y: 0 }, m.word); const n = el("text", { class: "num" + (m.own ? " bold" : ""), y: 0 }, X(m.multiple)); g.appendChild(w); g.appendChild(n); svg.appendChild(g); return { m, w, n, width: Math.max(widthOf(w, m.word.length * 5.4), widthOf(n, 5 * 6)) }; });
  const topT = mkTexts(a, true), botT = mkTexts(s, false);
  const topRes = stagger(topT.map((t) => ({ id: t.m.id, x: x(t.m.multiple), w: t.width, anchor: t.m.anchor })), { width: W, gap: 8 });
  const botRes = stagger(botT.map((t) => ({ id: t.m.id, x: x(t.m.multiple), w: t.width, anchor: t.m.anchor })), { width: W, gap: 8 });
  const tT = Math.max(...topRes.map((r) => r.tier)) + 1, bT = botT.length ? Math.max(...botRes.map((r) => r.tier)) + 1 : 0, tierH = wordH + numH + 3;
  const yTop0 = 2 + (tT - 1) * tierH, lane1 = yTop0 + wordH + numH + 8 + boxH / 2, lane2 = lane1 + boxH + laneGap;
  const yBot0 = lane2 + boxH / 2 + 6 + wordH, H = yBot0 + numH + (bT - 1) * tierH + 4;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H);
  const lane = (r, y, cls, name) => {
    if (!r.band || !r.band.n) { svg.appendChild(el("text", { class: "lane", x: pad, y: y + 3 }, name + " · " + (r.reason || "nothing to draw"))); return; }
    const b = r.band;
    svg.appendChild(el("line", { class: "wh", x1: x(b.min), x2: x(b.max), y1: y, y2: y }));
    for (const v of [b.min, b.max]) svg.appendChild(el("line", { class: "wh", x1: x(v), x2: x(v), y1: y - capH / 2, y2: y + capH / 2 }));
    if (b.n >= 2) svg.appendChild(el("rect", { class: "box" + cls, x: x(b.q1), y: y - boxH / 2, width: Math.max(1, x(b.q3) - x(b.q1)), height: boxH }));
    svg.appendChild(el("line", { class: "medl", x1: x(b.median), x2: x(b.median), y1: y - boxH / 2, y2: y + boxH / 2 }));
  };
  lane(a, lane1, "", "ALL PEERS"); lane(s, lane2, " sel", "YOUR SELECTION");
  const place = (res, texts, y0, tierDir, laneY, boxEdge) => res.forEach((r, i) => {
    const t = texts[i], m = t.m, cx = m.anchor === "start" ? r.left : m.anchor === "end" ? r.right : (r.left + r.right) / 2;
    const yWord = y0 + tierDir * r.tier * tierH, yNum = yWord + numH;
    const anchor = m.anchor === "start" ? "start" : m.anchor === "end" ? "end" : "middle", ax = anchor === "start" ? r.left : anchor === "end" ? r.right : cx;
    for (const e of [t.w, t.n]) { e.setAttribute("text-anchor", anchor); e.setAttribute("x", ax); }
    t.w.setAttribute("y", yWord); t.n.setAttribute("y", yNum);
    const px = x(m.multiple); if (m.own) return;
    const yFrom = tierDir < 0 ? yNum + 2 : yWord - wordH - 1, yTo = boxEdge;
    if (Math.abs(cx - px) > 3 || r.tier > 0) svg.appendChild(el("polyline", { class: "tie", fill: "none", points: `${cx},${yFrom} ${cx},${(yFrom + yTo) / 2} ${px},${(yFrom + yTo) / 2} ${px},${yTo}` }));
    else svg.appendChild(el("line", { class: "tick", x1: px, x2: px, y1: Math.min(yFrom, yTo), y2: Math.max(yFrom, yTo) }));
  });
  place(topRes, topT, yTop0 + wordH - 2, -1, lane1, lane1 - boxH / 2 - 1);
  place(botRes, botT, yBot0, 1, lane2, lane2 + boxH / 2 + 1);
  const own = a.own && a.own.multiple;
  if (own > 0) {
    const px = x(own), up = own <= a.band.median, dir = up ? "up" : "dn";
    svg.appendChild(el("line", { class: `own-line ${dir}-stroke`, x1: px, x2: px, y1: yTop0 + wordH + numH, y2: lane2 + boxH / 2 + 4 }));
    for (const y of [lane1, lane2]) svg.appendChild(el("polygon", { class: `${dir}-fill`, points: `${px},${y - 4} ${px + 4},${y} ${px},${y + 4} ${px - 4},${y}` }));
    const t = el("text", { class: "uptext", fill: `var(--${dir === "up" ? "bull" : "bear"})`, y: lane1 + boxH / 2 + 10 }, (a.upside != null ? PCT(a.upside) + " to the median" : ""));
    svg.appendChild(t); const tw = widthOf(t, 20 * 5.5); t.setAttribute("x", Math.max(2, Math.min(W - tw - 2, (px + x(a.band.median)) / 2 - tw / 2)));
  }
}

/* ---- 03 the ways ------------------------------------------------------------------------------------- */
function waysTableHTML(S) {
  const row = (w, which) => w && w.ok ? `<tr class="${w.way === S.way ? "me" : ""}"><td class="tk">${w.way} · ${which}</td><td>${esc(P0(w.lo))}</td><td class="g">${esc(P0(w.mid))}</td><td>${esc(P0(w.hi))}</td><td class="${dirCls(w.upside.lo.pct)}">${esc(PCT(w.upside.lo.pct))}</td><td class="g${dirCls(w.upside.mid.pct)}">${esc(PCT(w.upside.mid.pct))}</td><td class="${dirCls(w.upside.hi.pct)}">${esc(PCT(w.upside.hi.pct))}</td></tr>` : `<tr><td class="tk">${w ? w.way : "?"} · ${which}</td><td colspan="6" class="nm l">${esc(w ? w.reason : "")}</td></tr>`;
  return `<div class="cp-tw"><table class="cp-tbl"><thead><tr><th class="l">Way · set</th><th>Low</th><th>Centre</th><th>High</th><th>To low</th><th>To centre</th><th>To high</th></tr></thead><tbody>
    ${["A", "B", "C"].map((l) => row(wayOf(S.WA, l), "all peers") + row(wayOf(S.WS, l), "your selection")).join("")}</tbody></table></div>
    <div class="cp-words">One axis in dollars per ${esc(S.T)} share, YOUR SELECTION: A as a line from the lowest implied median to the highest, B and C as boxes; ALL PEERS as the faint lane above each. The diamond is ${esc(S.T)} today. Pick the way to feed the upside and the cohort table below; B is only a proposal.</div>`;
}
function drawWays(S) {
  const box = S.root.querySelector("#cpWays"); if (!box) return;
  box.innerHTML = `<svg></svg>`;
  const svg = box.querySelector("svg");
  const d = () => {
    const W = Math.max(200, box.clientWidth || 500); while (svg.firstChild) svg.removeChild(svg.firstChild);
    const price = S.snap.price, vals = [price];
    for (const w of [...S.WA, ...S.WS]) if (w.ok) vals.push(w.lo, w.hi);
    let lo = Math.min(...vals), hi = Math.max(...vals); if (!(hi > lo)) { lo *= 0.9; hi *= 1.1; }
    const pad = 10, inner = W - 2 * pad, x = (p) => Math.round((pad + ((p - lo) / (hi - lo)) * inner) * 10) / 10;
    const rowH = 62, H = 3 * rowH + 24;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H);
    const clampX = (px, w, anchor) => anchor === "end" ? Math.max(w + 2, Math.min(W - 2, px)) : anchor === "start" ? Math.max(2, Math.min(W - w - 2, px)) : Math.max(w / 2 + 2, Math.min(W - w / 2 - 2, px));
    ["A", "B", "C"].forEach((l, i) => {
      const y = 22 + i * rowH, wa = wayOf(S.WA, l), ws = wayOf(S.WS, l), on = S.way === l;
      svg.appendChild(el("text", { class: "lane", x: pad, y: y - 12 }, `${l} · ${WAY_WORDS[l].name.toUpperCase()}${on ? " · CHOSEN" : ""} · faint line = all peers`));
      if (wa && wa.ok) { svg.appendChild(el("line", { class: "wh", x1: x(wa.lo), x2: x(wa.hi), y1: y - 5, y2: y - 5, "stroke-dasharray": "2 3", "stroke-width": 1 })); svg.appendChild(el("line", { class: "tick", x1: x(wa.mid), x2: x(wa.mid), y1: y - 8, y2: y - 2 })); }
      if (ws && ws.ok) {
        if (l === "A") { svg.appendChild(el("line", { class: "wh", x1: x(ws.lo), x2: x(ws.hi), y1: y + 5, y2: y + 5 })); for (const v of [ws.lo, ws.hi]) svg.appendChild(el("line", { class: "wh", x1: x(v), x2: x(v), y1: y, y2: y + 10 })); }
        else svg.appendChild(el("rect", { class: "box" + (on ? " sel" : ""), x: x(ws.lo), y: y, width: Math.max(1, x(ws.hi) - x(ws.lo)), height: 10 }));
        svg.appendChild(el("line", { class: "medl", x1: x(ws.mid), x2: x(ws.mid), y1: y - 1, y2: y + 11 }));
        const tl = el("text", { class: "num", y: y + 24, "text-anchor": "start" }, P0(ws.lo)); svg.appendChild(tl); tl.setAttribute("x", clampX(x(ws.lo), widthOf(tl, 40), "start"));
        const th = el("text", { class: "num", y: y + 24, "text-anchor": "end" }, P0(ws.hi)); svg.appendChild(th); th.setAttribute("x", clampX(x(ws.hi), widthOf(th, 40), "end"));
        const tm = el("text", { class: "num bold", y: y + 37, "text-anchor": "middle" }, P0(ws.mid)); svg.appendChild(tm); tm.setAttribute("x", clampX(x(ws.mid), widthOf(tm, 40), "middle"));
      } else svg.appendChild(el("text", { class: "lane", x: pad, y: y + 8 }, ws ? ws.reason : "—"));
    });
    const px = x(price), up = S.WS.some((w) => w.ok && w.way === S.way && price <= w.mid);
    svg.appendChild(el("line", { class: `own-line ${up ? "up" : "dn"}-stroke`, x1: px, x2: px, y1: 2, y2: H - 12 }));
    const tt = el("text", { class: "word own", y: H - 3, fill: `var(--${up ? "bull" : "bear"})` }, `${S.T} TODAY ${P0(price)}`); svg.appendChild(tt);
    const tw = widthOf(tt, 80); const anchor = px < tw / 2 + 4 ? "start" : px > W - tw / 2 - 4 ? "end" : "middle"; tt.setAttribute("text-anchor", anchor); tt.setAttribute("x", anchor === "start" ? 2 : anchor === "end" ? W - 2 : px);
  };
  new ResizeObserver(d).observe(box); requestAnimationFrame(d);
}

/* ---- 04 the upside ----------------------------------------------------------------------------------- */
function upsideHTML(S) {
  const box = (w, title) => w && w.ok ? `<div class="cp-upbox"><div class="h">${title} · way ${w.way}</div><div class="big${dirCls(w.upside.mid.pct)}">${esc(PCT(w.upside.mid.pct))}<small>to the centre ${esc(P0(w.mid))}</small></div><div class="edges"><span>low</span><b>${esc(P0(w.lo))}</b><b class="${dirCls(w.upside.lo.pct)}">${esc(PCT(w.upside.lo.pct))}</b><span>centre</span><b>${esc(P0(w.mid))}</b><b class="${dirCls(w.upside.mid.pct)}">${esc(PCT(w.upside.mid.pct))}</b><span>high</span><b>${esc(P0(w.hi))}</b><b class="${dirCls(w.upside.hi.pct)}">${esc(PCT(w.upside.hi.pct))}</b></div></div>` : `<div class="cp-upbox"><div class="h">${title}</div><div class="cp-words">${esc(w ? w.reason : "no band")}</div></div>`;
  return `<div class="cp-up">${box(wayOf(S.WA, S.way), "ALL PEERS")}${box(wayOf(S.WS, S.way), "YOUR SELECTION")}</div><div class="cp-words">Upside = implied price ÷ today's price − 1. The analysts' price target on the ESTIMATES tab is a different measure and never enters this.</div>`;
}

/* ---- 05 the cohort ------------------------------------------------------------------------------------ */
async function cohortLoad(S) {
  const members = S.ctx.members.filter((t) => !S.ctx.excluded.some((e) => e.ticker === t));
  const snaps = members.map((t) => { try { return snapshotFromCohort(S.ctx, t); } catch (_) { return null; } }).filter(Boolean);
  S.allDecisions = await loadAllDecisions(S.opts, members);
  S.snaps = snaps;
  cohortRecompute(S);
  const box = S.root.querySelector("#cpCohort"); if (box) box.innerHTML = cohortHTML(S);
}
function cohortRecompute(S) {
  if (!S.snaps) return;
  const own = S.decisions.filter((d) => !(S.allDecisions || []).includes(d));
  S.cohortRows = cohortTable(S.snaps, [...(S.allDecisions || []), ...own], S.way).rows;
}
function cohortHTML(S) {
  const rows = sortCohort(S.cohortRows, S.sort.key, S.sort.dir);
  const th = (k, label, l) => `<th class="s${l ? " l" : ""}${S.sort.key === k ? " is-sorted" : ""}" data-cp="sort" data-k="${k}">${label}${S.sort.key === k ? (S.sort.dir < 0 ? " ▼" : " ▲") : ""}</th>`;
  const c = (v) => `<td class="${dirCls(v)}">${esc(PCT(v))}</td>`;
  return `<div class="cp-tw"><table class="cp-tbl"><thead><tr>${th("ticker", "Ticker", true)}${th("price", "Today")}${th("geiger", "Geiger")}<th>All · low</th>${th("all.mid", "All · centre")}<th>All · high</th><th>Sel · low</th>${th("sel.mid", "Sel · centre")}<th>Sel · high</th>${th("off", "Off")}</tr></thead><tbody>
    ${rows.map((r) => `<tr class="${r.ticker === S.T ? "me" : ""}"><td class="tk l"><button type="button" class="cp-link" data-cp="open" data-t="${esc(r.ticker)}" title="${esc(r.name)}">${esc(r.ticker)}</button></td><td>${esc(P(r.price))}</td><td class="g${dirCls(r.geiger)}">${esc(G(r.geiger))}</td>${r.all ? c(r.all.lo) + c(r.all.mid) + c(r.all.hi) : `<td colspan="3" class="nm">no band · ${r.rows_priced} of 6 rows price it</td>`}${r.sel ? c(r.sel.lo) + c(r.sel.mid) + c(r.sel.hi) : `<td colspan="3" class="nm">no band</td>`}<td>${r.off || ""}</td></tr>`).join("")}</tbody></table></div>
    <div class="cp-words">Every company of ${esc(S.snap.cohort)} against the others, the same arithmetic, way ${S.way}: today's price, the Geiger (composite, daily), and the upside to the band's low / centre / high for ALL PEERS and for that company's own saved selection (OFF = how many of its peers or cells are off). This is the feed for the knockout step; sort by any column. Click a ticker to open it.</div>`;
}

/* ---- events -------------------------------------------------------------------------------------------- */
function wire(S) {
  S.root.onclick = async (e) => {
    const b = e.target.closest("[data-cp]"); if (!b) return;
    const a = b.dataset.cp;
    if (a === "peer" || a === "cell" || a === "putback") {
      const t = b.dataset.t, measure = a === "peer" ? "ALL" : b.dataset.k;
      const off = a === "putback" ? false : !isOff(S.sel, t, measure);
      if (a === "cell" && S.sel.peers.has(t)) return;   // the whole peer is off: put the peer back first
      const row = decisionRow({ company: S.T, peer: t, measure, off, reason: off ? "" : "put back" });
      await storeDecision(S, S.opts, row);
      S.reasonFor = off ? { peer: t, measure, reason: "" } : null;
      cohortRecompute(S); render(S);
    } else if (a === "putall") {
      for (const d of S.sel.list) await storeDecision(S, S.opts, decisionRow({ company: S.T, peer: d.peer, measure: d.measure, off: false, reason: "put back" }));
      S.reasonFor = null; cohortRecompute(S); render(S);
    } else if (a === "chip") { const inp = S.root.querySelector('[data-cp="reason"]'); if (inp) inp.value = b.dataset.r; }
    else if (a === "savereason") {
      const inp = S.root.querySelector('[data-cp="reason"]'), R = S.reasonFor; if (!R) return;
      await storeDecision(S, S.opts, decisionRow({ company: S.T, peer: R.peer, measure: R.measure, off: true, reason: inp ? inp.value.trim() : "" }));
      S.reasonFor = null; render(S);
    } else if (a === "closereason") { S.reasonFor = null; render(S); }
    else if (a === "way") { S.way = b.dataset.w; cohortRecompute(S); render(S); }
    else if (a === "sort") { const k = b.dataset.k; S.sort = S.sort.key === k ? { key: k, dir: -S.sort.dir } : { key: k, dir: k === "ticker" ? 1 : -1 }; const box = S.root.querySelector("#cpCohort"); if (box) box.innerHTML = cohortHTML(S); }
    else if (a === "open") { if (S.opts.open) S.opts.open(b.dataset.t); }
  };
  S.root.onkeydown = (e) => { if (e.key === "Enter" && e.target.matches('[data-cp="reason"]')) { e.preventDefault(); const s = S.root.querySelector('[data-cp="savereason"]'); if (s) s.click(); } };
}

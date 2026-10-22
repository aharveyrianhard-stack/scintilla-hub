/* Scintilla · COMPS tab · CW6 (22 Oct). The method Alan last saw (CW3, 19 Oct; CW4, 20 Oct; CW5, 20 Oct), for any name.
   Order: the name and its peer set (which set, how sound) · the verdict in words · the football field (one bar per priced
   multiple from today's price to the implied price, analysts low · median · high, today, the midpoint) · the cycle line
   (memory names, CW5) · the peer table (every peer with its reason, struck with why when it does not count) · the dated
   read written by hand (folded) · the broad set (the 1 Oct switches, folded, never blended) · PAGE SPECS.
   Peer sets: CW3/CW4 reviewed sets first (sets.json); any other name: C5's business-lines set (comps-c5/lines.mjs, the
   live switches), with CW2's guards. The ±10× size band applies to every set (a control on the card).
   Numbers: engine.mjs (CW3's compute, ported; checked to 0.0000% on CW3's own answers). Sources: sources.mjs. */
import { company, readName, fxRates, cycleLine, verdictWords, RULES, BAND_DEFAULT, BANDS, THIN, FMT } from "./engine.mjs";
import { fromStore, fromHub, storeFx, storeIndex, withLivePrices, isUSListing } from "./sources.mjs";

const HERE = "/deliverables/20261022/cw6-comps-tab/";
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fetchJson = (u) => fetch(u, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(u + " → " + r.status); return r.json(); });
const { usd0, x1, bn } = FMT;
const PX = (v) => v == null || !Number.isFinite(v) ? "—" : "$" + (v >= 1000 ? Math.round(v).toLocaleString("en-US") : v >= 100 ? v.toFixed(0) : v.toFixed(2));
const X = (v, nm) => v == null || !Number.isFinite(v) ? "—" : (v < 0 ? "(" : "") + (Math.abs(v) >= 100 ? Math.abs(v).toFixed(0) : Math.abs(v) >= 10 ? Math.abs(v).toFixed(1) : Math.abs(v).toFixed(2)) + "x" + (v < 0 ? ")" : "");
const PCT = (v) => v == null || !Number.isFinite(v) ? "—" : (v < 0 ? "(" : "") + Math.abs(v).toFixed(Math.abs(v) >= 10 ? 0 : 1) + "%" + (v < 0 ? ")" : "");
const rel = (d) => d == null ? "—" : `${Math.abs(d).toFixed(0)}% ${d >= 0 ? "over" : "under"}`;
const ORD = (v) => { if (v == null) return "—"; const n = Math.round(v), t = n % 100, u = n % 10; return n + (t >= 11 && t <= 13 ? "th" : u === 1 ? "st" : u === 2 ? "nd" : u === 3 ? "rd" : "th"); };
const SIZE = (r) => r == null ? "—" : r >= 1 ? "×" + (r >= 10 ? r.toFixed(0) : r.toFixed(1)) : "÷" + (1 / r >= 10 ? (1 / r).toFixed(0) : (1 / r).toFixed(1));
const SET_KEYS = { CW3: "the RADAR comps (CW3, 19 Oct)", CW4: "the Dow 30 comps (CW4, 20 Oct)" };
const BLUE = "#3987e5", ORANGE = "#d95926", CYAN = "#00d4ff";

export const CSS = `
.cw6{font-family:var(--mono);color:var(--ink2);font-size:11px;line-height:1.5;letter-spacing:.02em;text-transform:none;overflow:hidden}
.cw6 *{box-sizing:border-box;min-width:0}
.cw6 .sec{background:var(--panel);padding:10px 12px;margin-bottom:6px;overflow:hidden}
.cw6 .hd{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:baseline;font-size:10px;color:var(--ink3);letter-spacing:.06em;margin-bottom:6px}
.cw6 .hd b{color:var(--ink);font-weight:600;letter-spacing:.14em;text-transform:uppercase;font-size:9px}
.cw6 .hd .ctl{display:inline-flex;flex-wrap:wrap;gap:2px;align-items:center;margin-left:auto}
.cw6 .hd .ctl span{font-size:8px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);margin:0 4px 0 8px}
.cw6 .hd .ctl button{font:inherit;font-size:9px;padding:2px 7px;background:rgba(0,212,255,.05);border:0;color:var(--ink3);cursor:pointer;letter-spacing:.08em}
.cw6 .hd .ctl button.on{color:#061015;background:var(--crk);font-weight:700}
.cw6 .name{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline}
.cw6 .name .tk{font-size:20px;font-weight:700;color:var(--ink);letter-spacing:.02em}
.cw6 .name .co{font-size:11px;color:var(--ink2)}.cw6 .name .px{font-size:13px;color:var(--ink);font-weight:600;margin-left:auto}
.cw6 .biz{font-size:10.5px;color:var(--ink3);margin:2px 0 6px}
.cw6 .setl{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;font-size:9.5px;color:var(--ink3);letter-spacing:.04em}
.cw6 .tag{display:inline-block;font-size:8px;letter-spacing:.14em;text-transform:uppercase;padding:2px 6px;background:rgba(0,212,255,.1);color:var(--ink2)}
.cw6 .tag.ok{background:rgba(57,135,229,.22);color:var(--ink)}.cw6 .tag.warn{background:rgba(217,89,38,.22);color:var(--ink)}.cw6 .tag.grey{background:rgba(134,138,170,.16);color:var(--ink3)}
.cw6 .verdict{font-size:12px;line-height:1.6;color:var(--ink2);margin:2px 0 0}
.cw6 .verdict b{color:var(--ink);font-weight:700}.cw6 .verdict .cheap{color:var(--bull)}.cw6 .verdict .rich{color:var(--bear)}.cw6 .verdict .fair{color:var(--ink)}
.cw6 .verdict p{margin:0 0 4px}
.cw6 .alan{margin-top:6px;font-size:10.5px;color:var(--ink3);border-left:2px solid ${ORANGE};padding:2px 0 2px 8px}
.cw6 .alan b{color:var(--ink2);font-weight:600}
.cw6 .wob{margin-top:6px;font-size:10.5px;color:var(--ink3)}.cw6 .wob b{color:var(--ink2)}
.cw6 .field{display:block;width:100%;overflow:visible}
.cw6 .field text{font-family:var(--mono)}
.cw6 .grey .field{opacity:.45}
.cw6 .swing{font-size:9.5px;color:var(--ink3);margin-top:4px;line-height:1.55}.cw6 .swing .fl{color:var(--bear);font-weight:600}
.cw6 .cyc{font-size:10.5px;color:var(--ink2);line-height:1.6}.cw6 .cyc b{color:var(--ink)}
.cw6 .cyc table{border-collapse:collapse;margin-top:6px;font-variant-numeric:tabular-nums;font-size:10px}
.cw6 .cyc th{font-size:8px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);font-weight:400;padding:3px 8px;text-align:right}
.cw6 .cyc td{padding:2px 8px;text-align:right;color:var(--ink2)}.cw6 .cyc td.l,.cw6 .cyc th.l{text-align:left}
.cw6 .tw{overflow-x:auto;scrollbar-width:thin}
.cw6 table.t{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:10.5px}
.cw6 table.t th{font-size:8px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);font-weight:400;padding:5px 6px 4px;text-align:right;white-space:nowrap}
.cw6 table.t th.l,.cw6 table.t td.l{text-align:left}
.cw6 table.t td{padding:3px 6px;text-align:right;color:var(--ink2);white-space:nowrap}
.cw6 table.t tbody tr:nth-child(odd) td{background:rgba(0,212,255,.03)}
.cw6 table.t td.tk{color:var(--ink);font-weight:600;letter-spacing:.03em}
.cw6 table.t td.why{white-space:normal;min-width:170px;max-width:300px;color:var(--ink3);font-size:9.5px}
.cw6 table.t tr.me td{color:var(--ink);background:rgba(0,212,255,.09)}.cw6 table.t tr.me td.tk{color:var(--crk)}
.cw6 table.t tr.off td{color:var(--mute)}.cw6 table.t tr.off td.tk{text-decoration:line-through}
.cw6 table.t tr.stat td{color:var(--ink3);font-size:10px}.cw6 table.t tr.stat td.l{letter-spacing:.12em;text-transform:uppercase;font-size:8px;color:var(--dim)}
.cw6 table.t td .nm{text-decoration:line-through;color:var(--mute)}.cw6 table.t td .tm{font-size:7.5px;color:var(--dim);margin-left:2px;vertical-align:1px}
.cw6 table.t td.up{color:var(--bull)}.cw6 table.t td.dn{color:var(--bear)}
.cw6 details.d{margin-bottom:6px;background:var(--panel)}
.cw6 details.d > summary{list-style:none;cursor:pointer;display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;padding:8px 12px;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink3)}
.cw6 details.d > summary::-webkit-details-marker{display:none}
.cw6 details.d > summary::before{content:"+";color:var(--crk);font-size:12px;width:10px;display:inline-block}
.cw6 details.d[open] > summary::before{content:"−"}
.cw6 details.d > summary small{color:var(--ink2);letter-spacing:.04em;text-transform:none;font-size:10px;margin-left:auto}
.cw6 details.d > .body{padding:2px 12px 10px}
.cw6 .read p{margin:0 0 6px;font-size:10.5px;line-height:1.6;color:var(--ink2)}.cw6 .read .bl{color:var(--ink3);font-style:italic}
.cw6 .pp{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:10.5px;color:var(--ink2);margin-top:6px}.cw6 .pp b{color:var(--ink)}
.cw6 .note{font-size:9.5px;color:var(--dim);margin-top:6px;line-height:1.55}
.cw6 .err{padding:8px 10px;color:var(--bear);font-size:10.5px}
.cw6 .loading{color:var(--ink3);font-size:10px;padding:12px 2px;letter-spacing:.2em}
.cw6 details.sc-pagespecs{margin-top:4px;background:var(--panel2);font-size:10.5px;line-height:1.6;color:var(--ink3)}
.cw6 details.sc-pagespecs > summary{cursor:pointer;padding:8px 12px;font-size:9px;letter-spacing:.24em;text-transform:uppercase;color:var(--dim);list-style:none}
.cw6 details.sc-pagespecs > summary::-webkit-details-marker{display:none}
.cw6 details.sc-pagespecs > div{padding:2px 14px 12px}.cw6 details.sc-pagespecs p{margin:6px 0}.cw6 details.sc-pagespecs b{color:var(--ink2);font-weight:600}`;

function ensureCSS() { if (!document.getElementById("cw6-css")) { const s = document.createElement("style"); s.id = "cw6-css"; s.textContent = CSS; document.head.appendChild(s); } }
let DATA = null;
async function data() {
  if (DATA) return DATA;
  const [sets, cycle, fx, idx] = await Promise.all([fetchJson(HERE + "sets.json"), fetchJson(HERE + "cycle.json").catch(() => ({ names: {} })), storeFx(fetchJson), storeIndex(fetchJson)]);
  DATA = { sets, cycle, fx, idx, rates: fxRates(fx) };
  return DATA;
}
/* C5's inputs (the universe, the named peers, the funds, the segments), read once per ten minutes, as the C5 tab reads them */
let C5 = null, C5_AT = 0;
async function c5Inputs(opts) {
  if (C5 && Date.now() - C5_AT < 600e3) return C5;
  const [{ inputs }, lines, out, ref] = await Promise.all([import("../../20261001/comps-mechanic/read.mjs"), import("../../20261003/comps-c5/lines.mjs"), import("../../20261005/comps-c6/outliers.mjs"), import("../../20261003/comps-c5/reference.mjs")]);
  const inp = await inputs({ pg: opts.pg, fetchJson });
  try { const f = await fetchJson("/deliverables/20261003/comps-c5/segments-2026-10-03.json"); inp.segments = f.companies || {}; inp.segments_from = f.source || "fixture"; } catch (_) { inp.segments = {}; inp.segments_from = "none"; }
  try { const facts = await fetchJson("/deliverables/20261003/comps-c5/reference-peers-facts-20261007.json"); inp.reference = ref.referenceOf(facts).peers; } catch (_) {}
  C5 = { inp, lines, out }; C5_AT = Date.now();
  return C5;
}
const FIN_INDUSTRY = /^Banks|^Insurance|Capital Markets|Mortgage/i;

export async function mountCompsTab(root, opts) {
  ensureCSS();
  const T = String(opts.ticker).toUpperCase();
  root.classList.add("cw6"); root.dataset.mounted = T;
  root.innerHTML = `<div class="loading">READING THE PEERS OF ${esc(T)}…</div>`;
  const S = { root, opts, T, band: BAND_DEFAULT, open: {}, reads: { pg: 0, files: 0, chart: 0, fmp: 0 } };
  const pg = (p) => { S.reads.pg++; return opts.pg(p); };
  const fj = (u) => { S.reads.files++; return fetchJson(u); };
  try {
    const D = await data(); S.D = D;
    const cur = D.sets.names[T];
    if (cur) {
      S.path = "curated"; S.rules = RULES[cur.set] || RULES.CW3; S.cur = cur;
      /* coordinator, 22 Oct: a reviewed set was picked by hand, by business, and Alan read it that way on 20 Oct; the size
         band starts off on it (one click turns it on) and stays on by default for the machine-built business-lines sets. */
      S.band = null;
      S.peerList = cur.peers.map((p) => ({ t: p.t, why: p.why }));
      const tick = [T, ...S.peerList.map((p) => p.t)];
      const st = await fromStore(tick, { fetchJson: fj, read: opts.read ? (p) => { S.reads.pg++; return opts.read(p); } : null });
      S.answers = st.answers; S.from = st.from; S.missing = st.missing;
      if (st.missing.length) { const h = await fromHub(st.missing, { pg, today: opts.today, subject: st.missing.includes(T) ? T : null }); Object.assign(S.answers, h.answers); for (const t of Object.keys(h.answers)) S.from[t] = "Hub tables"; S.hubNotes = h.notes; }
      S.setWords = SET_KEYS[cur.set] || cur.set_words; S.business = cur.business;
    } else {
      S.path = "c5"; S.rules = RULES.CW4;
      const { inp, lines, out } = await c5Inputs({ pg });
      if (!inp.profiles[T]) throw new Error(`${T} is not in the Hub's company profiles, so no peer set can be built`);
      const set = lines.buildSet(T, inp, { n: lines.N_DEFAULT, fx: out.LIVE_FX });
      S.c5 = set; S.business = lines.lineWords(set.own_lines);
      S.biz = out.businessOf(set, set.kept.map((r) => r.ticker));
      S.peerList = set.kept.map((r) => ({ t: r.ticker, why: (r.why || "").replace(/^same family \(([^)]+)\): (.*)$/, "$2 · $1 family") + (r.seat ? " · seat" : ""), sim: r.sim, exact: r.exact, reference: !!r.reference }));
      const onHub = [T, ...S.peerList.filter((p) => !p.reference).map((p) => p.t)], ref = S.peerList.filter((p) => p.reference).map((p) => p.t);
      const h = await fromHub(onHub, { pg, today: opts.today, subject: T });
      S.answers = h.answers; S.hubNotes = h.notes; S.from = Object.fromEntries(Object.keys(h.answers).map((t) => [t, "Hub tables"]));
      if (ref.length || h.missing.length) { const st = await fromStore([...ref, ...h.missing], { fetchJson: fj, read: null }); Object.assign(S.answers, st.answers); Object.assign(S.from, st.from); S.missing = st.missing; } else S.missing = [];
      S.setWords = "the business-lines set (C5)";
      S.financial = FIN_INDUSTRY.test(inp.profiles[T].industry || "");
    }
    const lp = await withLivePrices(S.answers, { quotes: (syms) => { S.reads.chart++; return opts.quotes(syms); }, livePrices: opts.livePrices || {} });
    S.live = lp;
    compute(S);
  } catch (e) { root.innerHTML = `<div class="err"><b>${esc(T)}</b>: the comps could not be built — ${esc(e && e.message || e)}.</div>`; return; }
  if (root.dataset.mounted !== T) return;
  root._cw6 = S;
  render(S);
  broad(S).then(() => { if (root.dataset.mounted === T && root._cw6 === S) renderBroad(S); }).catch((e) => { S.broadErr = String(e && e.message || e); if (root.dataset.mounted === T) renderBroad(S); });
}

function compute(S) {
  const { T, D } = S, fin = new Set(D.sets.financial);
  const mk = (t) => S.answers[t] ? company(t, S.answers[t], { today: S.opts.today, rates: D.rates, financial: S.path === "curated" ? fin.has(t) : (t === S.T ? S.financial : FIN_INDUSTRY.test(((S.answers[t].profile || {}).data || [{}])[0].industry || "")), rules: S.rules }) : null;
  S.subj = mk(T);
  if (!S.subj || S.subj.price == null) throw new Error(`no price or figures for ${T} in ${S.path === "curated" ? "the store" : "the Hub's tables"}`);
  S.peers = S.peerList.map((p) => ({ ...p, c: mk(p.t) }));
  S.R = readName(S.subj, S.peers.filter((p) => p.c), { rules: S.rules, band: S.band, today: S.opts.today, answers: S.answers[T] });
  S.R0 = S.band == null ? S.R : readName(S.subj, S.peers.filter((p) => p.c), { rules: S.rules, band: null, today: S.opts.today, answers: S.answers[T] });
  const cy = D.cycle.names && D.cycle.names[T];
  S.cyc = cy ? cycleLine(cy, S.subj.price, { ntmEps: S.subj.ntm.eps }) : null;
  if (T === "MU" && S.cyc) S.prem = muPremium(S);
}
/* Micron against SK hynix and Samsung at today's prices: the ten-year median US premium (CW5) applied to their forward multiples */
function muPremium(S) {
  const P = S.D.cycle.micron_premium || {}, out = [];
  for (const k of ["000660.KS", "005930.KS"]) {
    const p = S.peers.find((x) => x.t === k); if (!p || !p.c || !p.c.m.pe || !P[k]) continue;
    const ni = S.subj.ntm.net_income, sh = S.subj.mcap_usd / S.subj.price_usd;
    const flat = ni && sh ? p.c.m.pe * ni / sh : null, medPrem = P[k].pe ? P[k].pe.median : null;
    out.push({ t: k, name: k === "000660.KS" ? "SK hynix" : "Samsung", pe: p.c.m.pe, flat, withPrem: flat && medPrem != null ? flat * (1 + medPrem / 100) : null, medPrem, todayPremAtCw5: P[k].pe ? P[k].pe.today_at_cw5 : null, fwdPremAtCw5: P[k].pe_fwd_today_at_cw5 });
  }
  return out;
}

/* ---- the card ------------------------------------------------------------------------------------------- */
function soundness(S) {
  const R = S.R, tags = [];
  if (S.path === "curated") tags.push({ cls: "ok", w: `reviewed set · ${S.cur.set} ${S.cur.set_date.slice(5).replace("-", "/")}` });
  else if (S.biz) tags.push(S.biz.mostlyDifferent ? { cls: "warn", w: `mostly different business · ${S.biz.same.length} of ${S.biz.n} share ${S.biz.line || "the line"}` } : { cls: "ok", w: `${S.biz.same.length} of ${S.biz.n} share ${S.biz.line || "the business"}` });
  if (R.thin) tags.push({ cls: "warn", w: `thin · ${R.carrying} peer${R.carrying === 1 ? "" : "s"} with figures` });
  if (R.struck.length) tags.push({ cls: "grey", w: `${R.struck.length} outside ±${R.band}×` });
  const sw = Object.values(R.implied).filter((r) => r.swing && r.swing.flag).length;
  if (sw) tags.push({ cls: "warn", w: `${sw} row${sw === 1 ? "" : "s"} moved 15%+ by one peer` });
  if (S.subj.loss_maker) tags.push({ cls: "warn", w: "loss-maker · sales only" });
  if (S.subj.financial) tags.push({ cls: "grey", w: "balance-sheet business · P/E · PEG · book" });
  return tags;
}
function verdictHTML(S) {
  const R = S.R, refuse = S.refuse || null;
  const w = verdictWords(R, { setWords: S.setWords, refuse });
  let first = esc(w[0]);
  if (R.read && !R.thin && !refuse) first = first.replace(new RegExp("is " + R.read), `is <b class="${R.read}">${R.read}</b>`);
  return `<div class="verdict"><p>${first}</p>${w.slice(1).map((s) => `<p>${esc(s)}</p>`).join("")}</div>`;
}
function wobHTML(S) {
  if (S.band == null || !S.R.struck.length) return "";
  const R0 = S.R0, mid = R0.midpoint;
  return `<div class="wob">Without the size band (${esc(S.R.struck.map((s) => s.t).join(", "))} back in${S.path === "curated" ? ", the set as reviewed" : ""}): ${mid != null ? `midpoint <b>${esc(PX(mid))}</b>, <b>${esc(R0.read || "")}</b>, ${esc(rel(R0.distance_pct))} it` : "no row prices"}${R0.thin ? " · thin" : ""}.</div>`;
}
function render(S) {
  const { T, R, subj } = S, h = [];
  const bandCtl = `<span class="ctl"><span>size band</span>${BANDS.map((b) => `<button type="button" data-cw6="band" data-v="${b == null ? "off" : b}" class="${S.band === b ? "on" : ""}">${b == null ? "off" : "±" + b + "×"}</button>`).join("")}</span>`;
  const priceFrom = subj.price != null && S.live.moved.includes(T) ? `today ${esc(S.live.at.slice(11, 16))} UTC` : `at ${esc((subj.quote_utc || "").replace("T", " "))}`;
  h.push(`<div class="sec${R.thin ? " grey" : ""}"><div class="hd"><b>comps · ${esc(S.path === "curated" ? "the reviewed method" : "the method, on the business-lines set")}</b>${bandCtl}</div>
    <div class="name"><span class="tk">${esc(T)}</span><span class="co">${esc(subj.name)}</span><span class="px">${esc(PX(subj.price))} <small style="color:var(--dim);font-weight:400">${priceFrom}</small></span></div>
    <div class="biz">${esc(S.business || "")}</div>
    <div class="setl"><span>peers: <b style="color:var(--ink2)">${esc(S.setWords)}</b></span>${soundness(S).map((t) => `<span class="tag ${t.cls}">${esc(t.w)}</span>`).join("")}</div>
  </div>`);
  h.push(`<div class="sec">${verdictHTML(S)}${S.cur && S.cur.alan ? `<div class="alan"><b>Alan, ${esc(S.cur.alan.date.slice(8))} Oct:</b> ${esc(S.cur.alan.words)}</div>` : ""}${wobHTML(S)}${ppHTML(S)}</div>`);
  h.push(`<div class="sec${R.thin ? " grey" : ""}" id="cw6Field"><div class="hd"><b>the football field</b><span>implied price per multiple (peer median × ${esc(T)}'s own NTM figure) · analysts · today · log axis</span></div><svg class="field"></svg>${swingHTML(S)}</div>`);
  if (S.cyc) h.push(cycleHTML(S));
  h.push(`<div class="sec"><div class="hd"><b>the peers</b><span>${R.rows.length} counted of ${S.peers.length}${R.struck.length ? ` · ${R.struck.length} outside ±${R.band}×` : ""} · medians of the meaningful values · T = trailing (no estimate)</span></div>${tableHTML(S)}</div>`);
  if (S.cur && S.cur.reads && S.cur.reads.length) h.push(readsHTML(S));
  h.push(`<details class="d" data-d="broad"${S.open.broad ? " open" : ""}><summary>the broad set · the 1 Oct switches<small id="cw6BroadSum">reading the Hub's tag sets…</small></summary><div class="body" id="cw6Broad"></div></details>`);
  h.push(pageSpecsHTML(S));
  S.root.innerHTML = h.join("");
  drawField(S);
  if (S.B) renderBroad(S);
  wire(S);
}
function ppHTML(S) {
  const p = S.R.pre_profit; if (!p) return "";
  const q = (v) => v == null ? "—" : v.toFixed(1);
  return `<div class="pp"><span>cash <b>${esc(bn(p.cash_usd))}</b></span><span>debt <b>${esc(bn(p.debt_usd))}</b></span>${p.not_burning ? `<span><b>not burning cash</b> over the last ${p.quarters_on_file} quarters</span>` : `<span>free cash flow, last ${p.quarters_on_file} quarters <b>${esc(bn(p.fcf_4q_usd))}</b></span><span>runway <b>${esc(q(p.runway_quarters))} quarters</b> at the average burn${p.runway_quarters_latest_basis != null ? ` · ${esc(q(p.runway_quarters_latest_basis))} at the latest quarter's` : ""}</span>`}${p.lockup_end ? `<span>lock-up ends <b>${esc(p.lockup_end)}</b></span>` : ""}${p.cf_on_file ? "" : `<span style="color:var(--dim)">no quarterly cash flow on file</span>`}</div>`;
}
function swingHTML(S) {
  const rows = Object.entries(S.R.implied).filter(([, r]) => r.swing);
  if (!rows.length) return S.R.peg_note ? `<div class="swing">${esc(S.R.peg_note)}.</div>` : "";
  return `<div class="swing">The farthest peer on each row, set aside: ${rows.map(([k, r]) => `<span class="${r.swing.flag ? "fl" : ""}">${esc(r.label)} — ${esc(r.swing.peer)} at ${esc(X(r.swing.value))} moves the median ${esc(PCT(r.swing.swing_pct))}${r.swing.flag ? " (one peer carries the row)" : ""}</span>`).join(" · ")}.${S.R.peg_note ? " " + esc(S.R.peg_note) + "." : ""}</div>`;
}
function cycleHTML(S) {
  const c = S.cyc, cy = S.D.cycle.names[S.T], pe = c.pe, P = ORD;
  const lines = [];
  lines.push(`Through the cycle (CW5, ${cy.months} months of ${esc(cy.company)}${c.short ? " — a short history, read with care" : ""}): trailing P/E <b>${esc(X(pe.now))}</b> sits at the <b>${esc(P(pe.percentile))} percentile</b> of its own history (median ${esc(X(pe.median))}, low ${esc(X(pe.low))}, high ${esc(X(pe.high))}); EV/sales ${esc(X(c.ev_sales.now))} at the ${esc(P(c.ev_sales.percentile))}, price/book ${esc(X(c.pb.now))} at the ${esc(P(c.pb.percentile))}.`);
  if (c.eps_paid_for != null) lines.push(`At its own median trailing P/E today's price pays for <b>${esc(usd0(c.eps_paid_for))}</b> of EPS, against ${esc(usd0(c.eps_ttm))} trailing and ${esc(usd0(c.ntm_eps))} for the next twelve months, ${esc(rel(c.vs_ntm_pct))} the consensus: the market prices a fall from the peak, not the consensus.`);
  if (S.prem && S.prem.length) lines.push(`The US listing (CW5, ten years): ${S.prem.map((p) => `${p.name} at ${esc(X(p.pe))} forward is ${esc(PX(p.flat))} for Micron's consensus year; with the ten-year median premium of ${esc(PCT(p.medPrem))}, ${esc(PX(p.withPrem))}`).join("; ")} — against ${esc(PX(S.subj.price))}.`);
  const row = (k, l) => `<tr><td class="l">${l}</td><td>${esc(X(c[k].now))}</td><td>${esc(P(c[k].percentile))}</td><td>${esc(X(c[k].median))}</td><td>${esc(X(c[k].low))}</td><td>${esc(X(c[k].high))}</td><td>${c[k].n}</td></tr>`;
  return `<div class="sec cyc"><div class="hd"><b>the cycle line</b><span>beside the NTM line · the name's own history, monthly, from ${esc(cy.first_month || "")} · trailing figures to ${esc(cy.latest_quarter)}</span></div><div>${lines.map((l) => `<p style="margin:0 0 4px">${l}</p>`).join("")}</div>
    <table><thead><tr><th class="l">trailing</th><th>today</th><th>percentile</th><th>median</th><th>low</th><th>high</th><th>months</th></tr></thead><tbody>${row("pe", "P/E")}${row("ev_sales", "EV/sales")}${row("ev_ebitda", "EV/EBITDA")}${row("pb", "price/book")}</tbody></table></div>`;
}
function tableHTML(S) {
  const R = S.R, c = S.subj, fin = c.financial, md = R.median;
  const cols = fin ? [["pe", "fwd P/E", "x"], ["peg", "PEG", "x"], ["pb", "P/B", "x"], ["roe_ttm_pct", "ROE", "%"], ["net_margin_pct", "net margin", "%"], ["rev_growth_ntm_pct", "growth", "%"], ["ps", "P/S", "x"]]
    : [["pe", "fwd P/E", "x"], ["ev_sales", "EV/sales", "x"], ["ev_ebitda", "EV/EBITDA", "x"], ["peg", "PEG", "x"], ["ps", "P/S", "x"], ["ps_g", "P/S ÷ growth", "x"], ["rev_growth_ntm_pct", "growth", "%"], ["ebit_margin_pct", "EBIT margin", "%"], ["gross_margin_ttm_pct", "gross margin", "%"], ["ev_gp", "EV/gross profit", "x"], ["net_debt_ebitda", "net debt/EBITDA", "x"]];
  const v = (cc, k, f, t) => { const val = cc.m[k]; if (val == null) return "—"; const s = f === "%" ? PCT(val) : X(val); const nm = t && R.nm[t] && R.nm[t][k]; const tm = !cc.forward_basis && ["pe", "ev_sales", "ev_ebitda", "ps"].includes(k) ? '<span class="tm">T</span>' : ""; return nm ? `<span class="nm" title="not meaningful: out of the median">${esc(s)}</span>` : esc(s) + tm; };
  const peerRow = (p) => { const struck = R.struck.find((s) => s.t === p.t), off = struck || !p.c; const nmz = p.c && p.c.name ? p.c.name : p.t;
    const why = struck ? struck.why : !p.c ? "no figures on file" : (p.c.issues.length ? p.c.issues[0] : "");
    return `<tr class="${off ? "off" : ""}"><td class="tk l" title="${esc(nmz)}">${esc(p.t)}</td><td class="why l">${esc(p.why || "")}${why ? `<br><span style="color:var(--dim)">${esc(why)}</span>` : ""}</td><td>${esc(p.c ? bn(p.c.mcap_usd) : "—")}</td><td>${esc(p.c && c.mcap_usd ? SIZE(p.c.mcap_usd / c.mcap_usd) : "—")}</td>${cols.map(([k, , f]) => `<td>${p.c ? v(p.c, k, f, p.t) : "—"}</td>`).join("")}</tr>`; };
  const prem = (k) => { const p = R.premium_pct[k]; return p == null ? "<td>—</td>" : `<td class="${p > 15 ? "dn" : p < -15 ? "up" : ""}">${esc(PCT(p))}</td>`; };
  const PREMK = new Set(["pe", "ev_sales", "ev_ebitda", "peg", "pb", "ps", "ps_g", "ev_gp"]);
  return `<div class="tw"><table class="t"><thead><tr><th class="l">name</th><th class="l">why it is a peer</th><th>market value</th><th>size</th>${cols.map(([, l]) => `<th>${esc(l)}</th>`).join("")}</tr></thead><tbody>
    <tr class="me"><td class="tk l">${esc(S.T)}</td><td class="why l">${esc(c.name)}${c.issues.length ? `<br><span style="color:var(--dim)">${esc(c.issues.join(" · "))}</span>` : ""}</td><td>${esc(bn(c.mcap_usd))}</td><td>1×</td>${cols.map(([k, , f]) => `<td>${v(c, k, f, null)}</td>`).join("")}</tr>
    ${S.peers.map(peerRow).join("")}
    <tr class="stat"><td class="l">median</td><td class="l">${R.rows.length} counted</td><td></td><td></td>${cols.map(([k, , f]) => `<td>${md[k] == null ? "—" : esc(f === "%" ? PCT(md[k]) : X(md[k]))}</td>`).join("")}</tr>
    <tr class="stat"><td class="l">${esc(S.T)} vs median</td><td></td><td></td><td></td>${cols.map(([k]) => PREMK.has(k) ? prem(k) : "<td></td>").join("")}</tr>
  </tbody></table></div>`;
}
function readsHTML(S) {
  const rs = S.cur.reads;
  return `<details class="d" data-d="reads"${S.open.reads ? " open" : ""}><summary>the read written by hand<small>${rs.map((r) => `${esc(r.by)} · ${esc(r.date)}`).join(" and ")} · its numbers are that night's</small></summary><div class="body read">${rs.map((r) => `<p><b style="color:var(--ink)">${esc(r.by)}, ${esc(r.date)}.</b> ${r.s.map(esc).join(" ")}</p><p class="bl">What a peer table cannot see: ${esc(r.blind)}</p>`).join("")}</div></details>`;
}

/* ---- the football field (SVG, log axis) ------------------------------------------------------------------- */
const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, a = {}, t) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); if (t != null) e.textContent = t; return e; };
function drawField(S) {
  const box = S.root.querySelector("#cw6Field"); if (!box) return;
  const svg = box.querySelector("svg.field"), R = S.R, px = S.subj.price, a = R.analysts;
  const rows = Object.entries(R.implied).map(([k, r]) => ({ k, label: r.label, sub: `${X(r.median)} median of ${r.n}`, v: r.price }));
  const an = a.low != null && a.high != null ? { lo: a.low, mid: a.median ?? a.consensus, hi: a.high, n: a.last_quarter_n } : null;
  const d = () => {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const W = Math.max(320, box.clientWidth - 24), padL = Math.min(210, Math.max(132, W * 0.22)), padR = 34, rowH = 42, top = 30;
    const vals = [px, ...rows.map((r) => r.v), ...(an ? [an.lo, an.hi, an.mid].filter((v) => v > 0) : [])].filter((v) => v > 0);
    if (!vals.length) { svg.setAttribute("height", 24); svg.appendChild(svgEl("text", { x: 0, y: 16, fill: "var(--ink3)", "font-size": 10 }, "nothing to draw")); return; }
    let lo = Math.min(...vals), hi = Math.max(...vals); const span = Math.max(hi / lo, 2.5); lo = lo / Math.pow(span, 0.12); hi = hi * Math.pow(span, 0.12);
    const L = Math.log, x = (v) => padL + (L(v) - L(lo)) / (L(hi) - L(lo)) * (W - padL - padR);
    const n = rows.length + (an ? 1 : 0), H = top + n * rowH + 40;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H);
    for (const m of (hi / lo < 4 ? [1, 1.5, 2, 3, 5, 7] : [1, 2, 5])) for (let e = -1; e <= 6; e++) { const t = m * Math.pow(10, e); if (t < lo || t > hi) continue; svg.appendChild(svgEl("line", { x1: x(t), x2: x(t), y1: top - 6, y2: H - 30, stroke: "rgba(154,163,178,.14)", "stroke-width": 1 })); svg.appendChild(svgEl("text", { x: x(t), y: H - 16, fill: "var(--dim)", "font-size": 9, "text-anchor": "middle" }, t >= 10 ? "$" + Math.round(t).toLocaleString("en-US") : "$" + t)); }
    if (R.midpoint && !R.thin && !S.refuse) { const mx = x(R.midpoint); svg.appendChild(svgEl("line", { x1: mx, x2: mx, y1: top - 6, y2: H - 30, stroke: "var(--ink3)", "stroke-width": 1, "stroke-dasharray": "3 3" })); svg.appendChild(svgEl("text", { x: Math.min(W - 4, Math.max(padL, mx)), y: H - 2, fill: "var(--ink3)", "font-size": 9.5, "text-anchor": mx > W - 120 ? "end" : mx < padL + 120 ? "start" : "middle" }, `midpoint ${PX(R.midpoint)} · ${R.read}, ${rel(R.distance_pct)} it`)); }
    rows.forEach((r, i) => {
      const y = top + i * rowH + rowH / 2, a1 = Math.min(px, r.v), b1 = Math.max(px, r.v);
      svg.appendChild(svgEl("text", { x: padL - 14, y: y - 1, fill: "var(--ink2)", "font-size": 10, "text-anchor": "end" }, r.label));
      svg.appendChild(svgEl("text", { x: padL - 14, y: y + 11, fill: "var(--dim)", "font-size": 8.5, "text-anchor": "end" }, r.sub));
      svg.appendChild(svgEl("line", { x1: x(a1), x2: x(b1), y1: y, y2: y, stroke: BLUE, "stroke-width": 7, "stroke-linecap": "round", "stroke-opacity": .55 }));
      svg.appendChild(svgEl("circle", { cx: x(r.v), cy: y, r: 5, fill: BLUE, stroke: "var(--panel)", "stroke-width": 1.5 }));
      const lx = Math.min(W - padR + 20, Math.max(padL + 30, x(r.v)));
      svg.appendChild(svgEl("text", { x: lx, y: y + 17, fill: "var(--ink)", "font-size": 10, "font-weight": 700, "text-anchor": "middle" }, `${PX(r.v)} · ${PCT((r.v / px - 1) * 100)}`));
    });
    if (an) {
      const y = top + rows.length * rowH + rowH / 2;
      svg.appendChild(svgEl("text", { x: padL - 14, y: y - 1, fill: "var(--ink2)", "font-size": 10, "text-anchor": "end" }, an.n != null ? `analysts · ${an.n}` : "analysts"));
      svg.appendChild(svgEl("text", { x: padL - 14, y: y + 11, fill: "var(--dim)", "font-size": 8.5, "text-anchor": "end" }, "low · median · high"));
      svg.appendChild(svgEl("line", { x1: x(an.lo), x2: x(an.hi), y1: y, y2: y, stroke: ORANGE, "stroke-width": 7, "stroke-linecap": "round", "stroke-opacity": .55 }));
      if (an.mid) { const mx = x(an.mid); svg.appendChild(svgEl("polygon", { points: `${mx},${y - 6} ${mx + 6},${y} ${mx},${y + 6} ${mx - 6},${y}`, fill: ORANGE, stroke: "var(--panel)", "stroke-width": 1.2 })); svg.appendChild(svgEl("text", { x: mx, y: y + 17, fill: "var(--ink)", "font-size": 9.5, "font-weight": 700, "text-anchor": "middle" }, PX(an.mid))); }
      svg.appendChild(svgEl("text", { x: x(an.lo), y: y - 8, fill: "var(--ink3)", "font-size": 9, "text-anchor": "middle" }, PX(an.lo)));
      svg.appendChild(svgEl("text", { x: x(an.hi), y: y - 8, fill: "var(--ink3)", "font-size": 9, "text-anchor": "middle" }, PX(an.hi)));
    }
    const tx = x(px);
    svg.appendChild(svgEl("line", { x1: tx, x2: tx, y1: top - 8, y2: H - 30, stroke: CYAN, "stroke-width": 1.6 }));
    svg.appendChild(svgEl("text", { x: Math.min(W - 4, Math.max(4, tx)), y: top - 12, fill: CYAN, "font-size": 10, "font-weight": 700, "text-anchor": tx > W - 80 ? "end" : tx < 80 ? "start" : "middle" }, `today ${PX(px)}`));
  };
  d(); if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => d()).observe(box);
}

/* ---- the broad set: the 1 Oct switches, on the Hub's tables, the same arithmetic ------------------------------ */
async function broad(S) {
  const { resolveSets, LARGEST_N, SET_WORDS } = await import("../../20261001/comps-table-first/sets.mjs");
  const pg = (p) => { S.reads.pg++; return S.opts.pg(p); };
  const sets = await resolveSets({ ticker: S.T, pg });
  const all = [...new Set(sets.sets.flatMap((s) => s.members || []).concat((sets.sets.find((s) => s.key === "HOME") || {}).members || []))].filter((t) => t !== S.T);
  const h = await fromHub(all, { pg, today: S.opts.today });
  await withLivePrices(h.answers, { quotes: (syms) => { S.reads.chart++; return S.opts.quotes(syms); }, livePrices: S.opts.livePrices || {} });
  const fin = new Set(S.D.sets.financial), mk = (t) => h.answers[t] ? company(t, h.answers[t], { today: S.opts.today, rates: S.D.rates, financial: fin.has(t) || FIN_INDUSTRY.test(((h.answers[t].profile || {}).data || [{}])[0].industry || ""), rules: S.rules }) : null;
  S.Bdata = { sets, C: Object.fromEntries(all.map((t) => [t, mk(t)])), notes: h.notes, n: all.length, LARGEST_N, SET_WORDS };
  broadCompute(S);
}
/** The switches priced from what broad() read: re-run on a band change without reading again. */
function broadCompute(S) {
  const { sets, C, LARGEST_N, SET_WORDS } = S.Bdata, out = [];
  for (const s of sets.sets) {
    let members = (s.members || []).filter((t) => t !== S.T);
    if (s.key === "LARGEST") { const home = (sets.sets.find((x) => x.key === "HOME") || {}).members || []; members = home.filter((t) => t !== S.T && C[t] && C[t].mcap_usd).sort((a, b) => C[b].mcap_usd - C[a].mcap_usd).slice(0, LARGEST_N); }
    const row = { key: s.key, label: s.label, words: SET_WORDS[s.key] ? SET_WORDS[s.key].name : s.key, n: members.length, missing: s.missing || null, off_hub: s.off_hub || [], all_peers: s.all_peers || null };
    if (s.key === "FMP" && !s.missing && !members.length) row.missing = `none of FMP's ${(s.all_peers || []).length} peers is served on the Hub`;
    if (!row.missing) {
      const peers = members.map((t) => ({ t, why: "", c: C[t] })).filter((p) => p.c);
      row.R = readName(S.subj, peers, { rules: S.rules, band: S.band, today: S.opts.today, answers: {} });
      const pxs = Object.values(row.R.implied).map((r) => r.price);
      row.lo = pxs.length ? Math.min(...pxs) : null; row.hi = pxs.length ? Math.max(...pxs) : null;
      row.usable = !row.R.thin && row.R.midpoint != null;
    }
    out.push(row);
  }
  const used = out.filter((r) => r.usable);
  const centres = used.map((r) => r.R.midpoint);
  const spread = centres.length >= 2 ? (Math.max(...centres) / Math.min(...centres) - 1) * 100 : null;
  S.B = { sets: out, spread, envelope: centres.length ? [Math.min(...used.map((r) => r.lo)), Math.max(...used.map((r) => r.hi))] : null, hubNotes: S.Bdata.notes, n: S.Bdata.n };
  S.refuse = null;
  /* CW2's guard on the business-lines set (C5): when the centres sit more than 40% apart, no single upside */
  if (S.path === "c5" && S.R.midpoint != null && !S.R.thin && centres.length) {
    const cs = [S.R.midpoint, ...centres], sp = (Math.max(...cs) / Math.min(...cs) - 1) * 100;
    if (sp > 40) S.refuse = `No single upside: the peer sets disagree by ${Math.round(sp)}% — ${PX(S.R.midpoint)} on the business-lines set, ${PX(Math.min(...centres))}–${PX(Math.max(...centres))} on the Hub's tag sets; ${S.T} is at ${PX(S.subj.price)}.`;
  }
}
function renderBroad(S) {
  const box = S.root.querySelector("#cw6Broad"), sum = S.root.querySelector("#cw6BroadSum"); if (!box || !sum) return;
  if (S.broadErr) { sum.textContent = "could not be read"; box.innerHTML = `<div class="err">${esc(S.broadErr)}</div>`; return; }
  if (!S.B) return;
  const B = S.B, used = B.sets.filter((r) => r.usable);
  const cs = used.map((r) => r.R.midpoint);
  sum.textContent = used.length ? `${used.length} usable switch${used.length === 1 ? "" : "es"} · ${used.length === 1 ? "centre " + PX(cs[0]) : "centres " + PX(Math.min(...cs)) + "–" + PX(Math.max(...cs))}${B.spread != null && B.spread > 40 ? ` · ${Math.round(B.spread)}% apart: no single number` : ""}` : "no usable switch";
  const row = (r) => {
    if (r.missing) return `<tr class="off"><td class="l">${esc(r.words)}</td><td class="l">${esc(r.label)}</td><td>—</td><td>—</td><td>—</td><td>—</td><td class="why l">${esc(r.missing)}</td></tr>`;
    const R = r.R, st = R.thin ? `thin: ${R.carrying} with figures` : R.midpoint == null ? "no row prices" : "usable";
    return `<tr class="${r.usable ? "" : "off"}"><td class="l">${esc(r.words)}</td><td class="l">${esc(r.label)}</td><td>${r.n}</td><td>${R.rows.length}${R.struck.length ? ` <span style="color:var(--dim)">(${R.struck.length} outside ±${R.band}×)</span>` : ""}</td><td>${r.usable ? esc(PX(R.midpoint)) : "—"}</td><td>${r.usable ? `${esc(PX(r.lo))}–${esc(PX(r.hi))}` : "—"}</td><td class="why l">${esc(st)}${r.usable ? ` · ${esc(R.read)} (${esc(PCT(R.distance_pct))})` : ""}${r.off_hub && r.off_hub.length ? ` · ${r.off_hub.length} of FMP's peers off the Hub` : ""}</td></tr>`;
  };
  const tight = S.R.midpoint != null && !S.R.thin ? `The tight set (${esc(S.setWords)}) centres at <b>${esc(PX(S.R.midpoint))}</b>${B.envelope ? `; the usable tag sets span ${esc(PX(B.envelope[0]))}–${esc(PX(B.envelope[1]))}` : ""}. Both are shown; they are never averaged into one number.` : "";
  box.innerHTML = `<div class="note" style="margin:0 0 6px">${tight}${B.spread != null && B.spread > 40 ? ` The switches' centres sit ${Math.round(B.spread)}% apart, so the broad set gives no single upside.` : ""}</div>
    <div class="tw"><table class="t"><thead><tr><th class="l">switch</th><th class="l">set</th><th>names</th><th>counted</th><th>centre</th><th>low–high</th><th class="l">status</th></tr></thead><tbody>${B.sets.map(row).join("")}</tbody></table></div>
    <div class="note">The Hub's tags, cohorts and FMP's peer list (the 1 Oct machine's four switches), read from the Hub's own tables, priced with the same arithmetic as the tight set against ${esc(S.T)}'s own figures; the ±${S.band == null ? "∞" : S.band}× band applies; a switch with fewer than ${THIN} peers carrying figures is greyed with its count and gives no band.</div>`;
  if (S.path === "c5" && S.refuse && !S.refusedDrawn) { S.refusedDrawn = true; render(S); }   /* the refusal arrives with the broad set: redraw the verdict and the field without a centre */
}

/* ---- PAGE SPECS -------------------------------------------------------------------------------------------- */
function pageSpecsHTML(S) {
  const idx = S.D.idx || {}, R = S.R, fromCount = {};
  for (const t of [S.T, ...S.peers.map((p) => p.t)]) { const f = (S.from[t] || "none").replace(/ \d{4}-.*$/, ""); fromCount[f] = (fromCount[f] || 0) + 1; }
  const live = S.live.moved.length;
  return `<details class="sc-pagespecs"><summary>PAGE SPECS</summary><div>
<p><b>The method (CW3, 19 Oct; CW4's rules for its names, 20 Oct).</b> Peers chosen by business. One forward basis: the next twelve months, a time-weighted blend of the two fiscal-year consensus rows that straddle them (FMP analyst estimates). Forward P/E = market value ÷ NTM net income; EV/sales and EV/EBITDA on NTM; PEG = forward P/E ÷ NTM net-income growth, priced only at 10–100% growth with three peers carrying one. Implied price per row = the peers' median × ${esc(S.T)}'s own figure (net debt taken out on the EV rows) ÷ shares; the midpoint is the geometric middle of the lowest and highest implied price; cheap when the price is more than 15% under it, rich when more than 15% over. A multiple over 100× P/E, 60× EV/sales or EV/EBITDA, 10 PEG or 150× EV/gross profit${S.rules.key === "CW4" ? ", under 4× P/E or 3× EV/EBITDA, or over 30× book" : ""} is struck and left out of the median; a row needs three meaningful peers.</p>
<p><b>Loss-makers</b> (trailing or NTM net income at or under zero) are priced on EV/sales (NTM; trailing when no estimate exists, labelled), EV/gross profit and, only when NTM EBITDA is positive, EV/EBITDA — never a P/E or PEG on a negative figure; the cash runway sits beside them. ${S.rules.key === "CW4" ? "<b>Balance-sheet businesses</b> (banks, brokers, insurers) are priced on forward P/E, PEG and price/book, with ROE beside them; no EV rows. " : ""}<b>P/S</b> (market value ÷ NTM sales) and P/S per point of growth are columns, not priced rows (Alan, 20 Oct: "we have to consider price to sales").</p>
<p><b>Added on 22 Oct (CW6).</b> The ±10× size band starts on for the business-lines sets and off for the reviewed sets (picked by hand, by business; one click turns it on): with it on, a peer under a tenth or over ten times ${esc(S.T)}'s market value is struck and out of every median (the control above: ±3 · ±10 · ±30 · off); when it changes the set, the read without it is printed under the verdict. The farthest peer on each priced row is set aside and the median re-taken; a move of 15% or more is printed in red. A set with fewer than ${THIN} peers carrying figures is thin: greyed, no single upside. ${S.path === "c5" ? "For a name no lane reviewed, the set is the business-lines set (C5: FMP revenue segments, else the industry; the live switches), checked for how many peers share the business, and when its centre and the Hub's tag sets' centres sit more than 40% apart the card refuses a single upside." : `${esc(S.T)}'s set is ${esc(S.setWords)}, as reviewed: ${esc(S.D.sets.sources[S.cur.set] ? S.D.sets.sources[S.cur.set].branch + " @" + S.D.sets.sources[S.cur.set].commit : "")}.`}</p>
<p><b>Where the numbers come from.</b> ${Object.entries(fromCount).map(([f, n]) => `${n} compan${n === 1 ? "y" : "ies"} from ${esc(f)}`).join(" · ")}. The store holds FMP's answers fetched through the project's fmp-proxy door ${esc(idx.fetch_utc_first || "")}–${esc((idx.fetch_utc_last || "").slice(11))} (${idx.calls || "—"} calls for ${(idx.tickers || []).length} companies, all GET), statements and estimates as of that fetch; the browser makes <b>no FMP call</b>: fmp-proxy sends no Access-Control-Allow-Origin header, so a page cannot read it, and every figure is served as a file or read from the Hub's tables. Today's price for ${live} US listing${live === 1 ? "" : "s"} comes from the chart API (not FMP) and the market value moves with it; foreign listings stay at the store's quote and FX (${esc((S.D.fx.fetched_utc || "").replace("T", " "))}). The Hub's tables differ from FMP's answers in two ways, printed on the rows they touch: cash without short-term investments, and the trailing year as the four newest quarters on file. This name took ${S.reads.files} file reads, ${S.reads.pg} table reads and ${S.reads.chart} chart-API price reads.</p>
<p><b>Analysts</b> low · median · high are FMP's price-target consensus${S.path === "c5" ? " (the Hub's price_target_consensus table)" : ""}; the count is the last quarter's. ${R.analysts.median == null ? "None on file for this name." : ""}</p>
<p><b>The broad set</b> is the 1 Oct machine's four switches (tightest tag, home cohort, FMP's peers, the largest seven of the home cohort), read from the Hub's tables and priced with the same arithmetic against ${esc(S.T)}'s own figures; it is folded and never averaged with the tight set.${S.cyc ? " <b>The cycle line</b> is CW5's (20 Oct): ten years of monthly multiples, today's trailing multiple at today's price placed among them." : ""}</p>
</div></details>`;
}

/* ---- events ------------------------------------------------------------------------------------------------ */
function wire(S) {
  S.root.querySelectorAll("details.d").forEach((d) => d.addEventListener("toggle", () => { S.open[d.dataset.d] = d.open; }));
  S.root.onclick = (e) => {
    const b = e.target.closest && e.target.closest("[data-cw6]"); if (!b) return;
    if (b.dataset.cw6 === "band") {
      const v = b.dataset.v; S.band = v === "off" ? null : +v; S.refuse = null; S.refusedDrawn = false; compute(S);
      if (S.Bdata) broadCompute(S);
      render(S);
    }
  };
}

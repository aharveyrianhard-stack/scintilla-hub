/* CW2 · the page, built from RADAR-COMPS.json. Pictures first: every card opens on its football field.   OUT=<dir> node page.mjs */
import fs from "node:fs"; import path from "node:path";
const OUT = process.env.OUT; const D = JSON.parse(fs.readFileSync(path.join(OUT, "RADAR-COMPS.json"), "utf8"));
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const $ = (v) => !fin(v) ? "—" : "$" + (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-US") : Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2));
const $B = (v) => !fin(v) ? "—" : v >= 1e12 ? "$" + (v / 1e12).toFixed(2) + "T" : v >= 1e9 ? "$" + (v / 1e9).toFixed(0) + "B" : "$" + (v / 1e6).toFixed(0) + "M";
const SG = (v) => !fin(v) ? "—" : (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(Math.abs(v) >= 10 ? 0 : 1) + "%";
const X = (v) => !fin(v) ? "—" : (v < 0 ? "(" : "") + Math.abs(v).toFixed(Math.abs(v) >= 100 ? 0 : Math.abs(v) < 10 ? 2 : 1) + "x" + (v < 0 ? ")" : "");
const PC = (v, d = 0) => !fin(v) ? "—" : (v < 0 ? "(" : "") + Math.abs(v).toFixed(d) + "%" + (v < 0 ? ")" : "");
const dir = (v) => !fin(v) ? "" : v >= 0 ? "up" : "dn";
const KEYS = ["TIGHTEST", "HOME", "FMP", "LARGEST"], KW = { TIGHTEST: "tightest tag", HOME: "home cohort", FMP: "FMP peers", LARGEST: "largest 7" };
const ROWS = ["pe_ttm", "pe_fwd", "ev_ebitda", "ev_sales", "ps", "peg"], RW = { pe_ttm: "P/E trailing", pe_fwd: "P/E forward", ev_ebitda: "EV/EBITDA", ev_sales: "EV/sales", ps: "P/S", peg: "PEG" };
const EARN = new Set(["pe_ttm", "pe_fwd", "peg"]);
const ny = (iso) => iso ? new Intl.DateTimeFormat("en-GB", { timeZone: "America/New_York", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)) + " ET" : "—";
const FLAGW = { preprofit: "loss-maker", thin: "thin set", fallback: "FMP fell back", outlier: "one peer moves the median", switches: "switches > 40% apart", "live-vs-switches": "live tab vs switches > 40%", business: "tag ≠ business", foreign: "foreign peers", stale: "stale figures", ways: "the tab's ways disagree" };
const byName = Object.fromEntries(D.names.map((n) => [n.ticker, n]));

/* ---------- the football field ---------- */
function field(n) {
  const p = n.price; if (!fin(p)) return `<div class="nofield">no price on the Hub, so no field</div>`;
  if (n.none) { const sets = n.sets || {}; n = { ...n, sets: Object.fromEntries(KEYS.map((K) => [K, sets[K] || { missing: "not served on the Hub" }])), live: { error: "not served on the Hub" } }; }
  const W = 1000, L = 300, R = 745, rowH = 22, lo = p / 4, hi = p * 8;
  const SL = (K, s) => K === "FMP" ? `FMP peers · ${s.n_peers}` : K === "LARGEST" ? `largest 7 · ${String(s.label).replace(/^largest 7 of /, "")}` : `${KW[K]} · ${s.label} · ${s.n_peers}`;
  const px = (v) => L + (Math.log(v / lo) / Math.log(hi / lo)) * (R - L);
  const clamp = (v) => Math.max(L, Math.min(R, px(v)));
  const bars = [];
  for (const K of KEYS) { const s = n.sets[K]; if (!s || s.error) { bars.push({ kind: "none", label: KW[K], note: "no read" }); continue; } if (s.missing) { bars.push({ kind: "none", label: KW[K], note: "not on hand" }); continue; }
    if (n.pre_profit) { const r = s.rows.find((x) => x.key === "ev_sales"); bars.push(r && r.ok ? { kind: "band", cls: "sw", label: SL(K, s), lo: r.implied_q1, hi: r.implied_q3, mid: r.implied, note: "EV/sales, 25th–75th", dim: !s.usable } : { kind: "none", label: SL(K, s), note: "EV/sales cannot be priced" }); }
    else bars.push(s.band ? { kind: "band", cls: "sw", label: SL(K, s), lo: s.band.lo, hi: s.band.hi, mid: s.band.mid, note: "way B", dim: !s.usable } : { kind: "none", label: SL(K, s), note: s.reason || "no range" }); }
  const Lv = n.live; if (Lv && !Lv.error) { if (n.pre_profit) { const r = Lv.rows.find((x) => x.key === "ev_sales"); bars.push(r && r.ok ? { kind: "ticks", cls: "mx", label: `the live tab · ${Lv.line || Lv.pricedOn} · ${Lv.peersOn.length}`, lo: r.implied, hi: r.implied, pts: [{ K: "LIVE", v: r.implied }], note: "EV/sales median" } : { kind: "none", label: "the live tab", note: "EV/sales cannot be priced" }); } else bars.push(Lv.band ? { kind: "band", cls: "lv", label: `the live tab · ${Lv.line || Lv.pricedOn} · ${Lv.peersOn.length}`, lo: Lv.band.lo, hi: Lv.band.hi, mid: Lv.band.mid, note: "way C, the whole field" } : { kind: "none", label: "the live tab", note: Lv.reason || "no range" }); } else bars.push({ kind: "none", label: "the live tab", note: (Lv && Lv.error) || "no read" });
  bars.push({ kind: "gap" });
  for (const k of ROWS) { if (n.pre_profit && EARN.has(k)) { bars.push({ kind: "none", label: RW[k], note: "not meaningful on a loss" }); continue; }
    const pts = KEYS.map((K) => { const s = n.sets[K]; const r = s && !s.error && s.rows ? s.rows.find((x) => x.key === k) : null; return r && r.ok && fin(r.implied) ? { K, v: r.implied } : null; }).filter(Boolean);
    const lv = Lv && !Lv.error ? Lv.rows.find((x) => x.key === k) : null; if (lv && lv.ok && fin(lv.implied)) pts.push({ K: "LIVE", v: lv.implied });
    if (!pts.length) { bars.push({ kind: "none", label: RW[k], note: "no switch prices this row" }); continue; }
    const vs = pts.map((x) => x.v); bars.push({ kind: "ticks", cls: "mx", label: RW[k], lo: Math.min(...vs), hi: Math.max(...vs), pts }); }
  bars.push({ kind: "gap" });
  const a = n.db.analysts; bars.push(a && a.n ? { kind: "band", cls: "an", label: `analysts · ${a.n} firm${a.n === 1 ? "" : "s"}`, lo: a.low, hi: a.high, mid: a.median, note: "median" } : { kind: "none", label: "analysts", note: "no checked target in 90 days" });
  const c = n.channel; bars.push(c ? { kind: "band", cls: "ch", label: `his LT channel · read 10 Oct`, lo: c.low, hi: c.high, mid: null, note: "bottom – top rail" } : { kind: "none", label: "his LT channel", note: "not on the capture table" });
  const H = 36 + bars.length * rowH + 10;
  let g = `<svg class="ff" viewBox="0 0 ${W} ${H}" role="img" aria-label="comps football field for ${esc(n.ticker)}">`;
  for (const m of [0.25, 0.5, 1, 2, 4, 8]) { const x = px(p * m); g += `<line x1="${x}" x2="${x}" y1="28" y2="${H - 10}" class="${m === 1 ? "today" : "grid"}"/><text x="${x}" y="22" class="tick${m === 1 ? " strong" : ""}" text-anchor="middle">${m === 1 ? "today " + $(p) : $(p * m)}</text>`; }
  g += `<text x="${R}" y="10" class="tick" text-anchor="end">log scale · ¼× to 8× today's price</text>`;
  let y = 36;
  for (const b of bars) { if (b.kind === "gap") { y += 6; continue; } const cy = y + rowH / 2;
    g += `<text x="${L - 8}" y="${cy + 3.5}" class="lab${b.dim ? " dim" : ""}" text-anchor="end">${esc(b.label)}</text>`;
    if (b.kind === "none") { g += `<text x="${L + 6}" y="${cy + 3.5}" class="note">${esc(b.note)}</text>`; y += rowH; continue; }
    const x1 = clamp(b.lo), x2 = clamp(b.hi), cutL = b.lo < lo, cutR = b.hi > hi;
    if (b.kind === "band") { g += `<rect x="${x1}" y="${cy - 6}" width="${Math.max(2, x2 - x1)}" height="12" rx="3" class="bar ${b.cls}${b.dim ? " dim" : ""}"/>`; if (fin(b.mid) && b.mid >= lo && b.mid <= hi) g += `<line x1="${px(b.mid)}" x2="${px(b.mid)}" y1="${cy - 9}" y2="${cy + 9}" class="mid"/>`; }
    else { g += `<line x1="${x1}" x2="${x2}" y1="${cy}" y2="${cy}" class="rng ${b.cls}"/>`; for (const t of b.pts) { if (t.v < lo || t.v > hi) continue; const x = px(t.v); g += t.K === "LIVE" ? `<rect x="${x - 4}" y="${cy - 4}" width="8" height="8" transform="rotate(45 ${x} ${cy})" class="pt lv"/>` : `<circle cx="${x}" cy="${cy}" r="4" class="pt sw"/>`; } }
    if (cutL) g += `<text x="${L + 2}" y="${cy + 3.5}" class="cut">«</text>`; if (cutR) g += `<text x="${R - 2}" y="${cy + 3.5}" class="cut" text-anchor="end">»</text>`;
    const words = b.kind === "band" ? (fin(b.mid) ? `${$(b.lo)} – ${$(b.hi)} · ${b.note} ${$(b.mid)} · ${SG((b.mid / p - 1) * 100)}` : `${$(b.lo)} – ${$(b.hi)} · ${b.note}`) : `${$(b.lo)} – ${$(b.hi)} · ${b.pts.map((t) => (t.K === "LIVE" ? "live" : KW[t.K].split(" ")[0]) + " " + $(t.v)).join(" · ")}`;
    const short = b.kind === "band" ? `${$(b.lo)} – ${$(b.hi)}${fin(b.mid) ? " · " + $(b.mid) + " · " + SG((b.mid / p - 1) * 100) : ""}` : b.pts.length === 1 ? `${$(b.lo)} · ${SG((b.lo / p - 1) * 100)}` : `${$(b.lo)} – ${$(b.hi)}`;
    g += `<text x="${R + 10}" y="${cy + 3.5}" class="val" text-anchor="start">${esc(short)}</text>`;
    g += `<title>${esc(b.label + ": " + words)}</title>`;
    y += rowH; }
  g += `</svg>`;
  /* the words beside each bar, in a list the eye can read (the svg carries only the first figure) */
  const legend = bars.filter((b) => b.kind !== "gap" && b.kind !== "none").map((b) => `<li><i class="sw-${b.cls}"></i><b>${esc(b.label)}</b> ${esc(b.kind === "band" ? (fin(b.mid) ? `${$(b.lo)} – ${$(b.hi)}, ${b.note} ${$(b.mid)} (${SG((b.mid / p - 1) * 100)} from today)` : `${$(b.lo)} – ${$(b.hi)} (${b.note})`) : `${$(b.lo)} – ${$(b.hi)}: ${b.pts.map((t) => (t.K === "LIVE" ? "the live tab" : KW[t.K]) + " " + $(t.v)).join(", ")}`)}</li>`).join("");
  return g + `<ul class="legend">${legend}</ul>`;
}

/* ---------- the three sentences ---------- */
function sentences(n) {
  const p = n.price, mid = n.midpoint, d = n.distance_pct;
  const sw = KEYS.filter((K) => n.sets[K] && fin(n.sets[K].centre)).map((K) => `${KW[K]} ${$(n.sets[K].centre)}`).join(", ");
  const live = n.live && !n.live.error && fin(n.live_centre) ? `the live tab's own set (${n.live.line || n.live.pricedOn}, ${n.live.peersOn.length} peers) says ${$(n.live_centre)}, and today sits ${SG(n.live_distance_pct)} from that` : "the live tab gives no centre";
  const usableK = KEYS.filter((K) => n.sets[K] && n.sets[K].usable);
  const against = usableK.length ? usableK.map((K) => KW[K] + " (" + n.sets[K].label + ")").join(" and ") : "no switch that passes the peer-set test";
  const s1 = !fin(d) ? `No comps position: ${n.none || (n.pre_profit ? "no switch can price it on sales" : "no switch prints a centre")}.` : `<b>${n.sits.toUpperCase()}</b> against ${against}: today's ${$(p)} sits ${SG(d)} from the four-switch midpoint ${$(mid)} (${sw})${n.pre_profit ? ", on EV/sales only" : ""}; ${live}.`;
  /* the gap: growth, margin, size, from the first usable switch's table (or the tightest) */
  const K0 = usableK[0] || "TIGHTEST", s = n.sets[K0]; let s2 = "What drives the gap cannot be read: the table has no figures.";
  if (s && !s.error && s.table_company && s.table_peers_median) { const c = s.table_company, m = s.table_peers_median; const bits = [];
    if (fin(c.eps_g_fy) && fin(m.eps_g_fy)) bits.push(`earnings growth into next year ${PC(c.eps_g_fy)} against the peers' ${PC(m.eps_g_fy)}`); else if (fin(c.rev_g_fy) && fin(m.rev_g_fy)) bits.push(`revenue growth into next year ${PC(c.rev_g_fy)} against ${PC(m.rev_g_fy)}`);
    if (fin(c.om) && fin(m.om)) bits.push(`operating margin ${PC(c.om)} against ${PC(m.om)}`);
    if (fin(n.mcap) && fin(s.peers_mcap_median) && s.peers_mcap_median > 0) { const r = n.mcap / s.peers_mcap_median; bits.push(r >= 1 ? `${r.toFixed(1)}× the median peer's size` : `${(1 / r).toFixed(1)}× smaller than the median peer`); }
    const growthGap = fin(c.eps_g_fy) && fin(m.eps_g_fy) ? c.eps_g_fy - m.eps_g_fy : fin(c.rev_g_fy) && fin(m.rev_g_fy) ? c.rev_g_fy - m.rev_g_fy : null, marginGap = fin(c.om) && fin(m.om) ? c.om - m.om : null;
    const lead = n.pre_profit ? "On the ${KW} set the gap is size and the loss, not a multiple" : fin(growthGap) && Math.abs(growthGap) >= 10 && (!fin(marginGap) || Math.abs(growthGap) >= Math.abs(marginGap)) ? (growthGap > 0 ? "The gap is growth the peers do not have" : "The gap is growth the peers have and it does not") : fin(marginGap) && Math.abs(marginGap) >= 10 ? (marginGap > 0 ? "The gap is margin" : "The gap is a thinner margin") : "Neither growth nor margin explains much of the gap; the peer set does";
    s2 = `${lead.replace("${KW}", KW[K0])} — on the ${KW[K0]} set (${s.label}), ${bits.join(", ")}.`; }
  /* what a buyer pays for */
  let s3 = "";
  if (n.pre_profit) { const pp = n.pp; const es = s && !s.error ? s.rows.find((x) => x.key === "ev_sales") : null; s3 = `A buyer at ${$(p)} pays ${es && fin(es.own) ? X(es.own) : "—"} trailing sales${es && fin(es.median) ? ` against the peers' ${X(es.median)}` : ""} for a company with no trailing profit (${n.pre_profit_why}); the 13 Oct pre-profit page's measures: ${pp ? `${fin(pp.runway_quarters) ? pp.runway_quarters.toFixed(1) + " quarters of cash at the current burn" : "runway missing"}, trailing revenue growth ${PC(pp.growth_pct)}, ${pp.rank ? pp.rank.list + ", " + pp.rank.position + " of " + pp.rank.of : "unranked"}${pp.forward && fin(pp.forward.vs_last_four_quarters_pct) ? ", this year's consensus " + SG(pp.forward.vs_last_four_quarters_pct) + " on the last four quarters" : ""}` : "not in the 13 Oct pre-profit set (no pre-profit measures on file)"}.`; }
  else if (s && !s.error) { const pf = s.rows.find((x) => x.key === "pe_fwd"), es = s.rows.find((x) => x.key === "ev_sales"); const c = s.table_company || {}, m = s.table_peers_median || {};
    const what = fin(c.eps_g_fy) && fin(m.eps_g_fy) && c.eps_g_fy > m.eps_g_fy + 10 ? "growth above the set" : fin(c.om) && fin(m.om) && c.om > m.om + 10 ? "a margin above the set" : fin(c.eps_g_fy) && fin(m.eps_g_fy) && c.eps_g_fy < m.eps_g_fy - 10 ? "less growth than the set, so the discount is earned, not a bargain" : "nothing the set does not already have";
    s3 = `A buyer at ${$(p)} pays ${pf && fin(pf.own) ? X(pf.own) : "—"} forward earnings (the ${KW[K0]} peers' median ${pf && fin(pf.median) ? X(pf.median) : "—"}) and ${es && fin(es.own) ? X(es.own) : "—"} sales (${es && fin(es.median) ? X(es.median) : "—"}): that is paying for ${what}${n.db.analysts.n ? `; the analysts' median ${$(n.db.analysts.median)} is ${SG(n.analyst_distance_pct)} away` : ""}.`; }
  else s3 = "What a buyer pays for cannot be read without a set.";
  return [s1, s2, s3];
}

/* ---------- a card ---------- */
function card(n) {
  const T = n.ticker; const h = [];
  h.push(`<section class="card" id="c-${esc(T)}"><h3>${esc(T)} <small>${esc(n.name)}</small></h3>`);
  if (n.none) { const pp = n.pp; h.push(`<div class="sub">${esc(n.industry || "industry unknown")} · market value ${$B(n.mcap)} · price <b>${$(n.price)}</b> (${esc(n.price_from || "missing")}; not the Hub's live price) · tags none · home ${esc(n.db.home || "—")}</div>`); h.push(field(n)); h.push(`<p class="why"><b>The machine could not run.</b> ${esc(n.none)}.${pp ? ` the 13 Oct pre-profit page holds it: ${pp.rank ? esc(pp.rank.list) + ", " + pp.rank.position + " of " + pp.rank.of : esc(pp.class) + ", unranked"}; ${fin(pp.runway_quarters) ? pp.runway_quarters.toFixed(1) + " quarters of cash" : "runway missing"}; trailing growth ${PC(pp.growth_pct)}; analysts ${n.db.analysts.n ? $(n.db.analysts.median) + " (" + n.db.analysts.n + " firms)" : "none"}; price on 13 Oct ${pp && pp.forward ? "" : ""}missing on the Hub.` : ""}</p>`);
    h.push(`<p class="kv"><span class="k">the fix</span>Admit the name to a cohort (it carries ${n.db.tags.length} tags tonight; FMP names ${n.db.fmp.length} peers for it) and the tab opens.</p></section>`); return h.join(""); }
  h.push(`<div class="sub">${esc(n.industry || "industry unknown")}${n.sector ? " · " + esc(n.sector) : ""} · market value ${$B(n.mcap)} · today <b>${$(n.price)}</b> (the Hub's price, read ${esc(ny(n.read_utc))}) · trailing EPS ${fin(n.eps_ttm) ? (n.eps_ttm < 0 ? "−$" + Math.abs(n.eps_ttm).toFixed(2) : "$" + n.eps_ttm.toFixed(2)) : "missing"}${n.eps_date ? " to " + esc(n.eps_date) : ""}${n.pre_profit ? ` · <b class="dn">PRE-PROFIT</b> — ${esc(n.pre_profit_why)}; valued on EV/sales only, the pre-profit page's method` : ""} · tags ${esc(n.db.tags.join(", ") || "none")} · home ${esc(n.db.home || "—")}</div>`);
  h.push(field(n));
  const [s1, s2, s3] = sentences(n); h.push(`<div class="three"><p>${s1}</p><p>${esc(s2)}</p><p>${esc(s3)}</p></div>`);
  /* the peer sets */
  const setRow = (K) => { const s = n.sets[K]; if (!s || s.error) return `<tr><td><b>${KW[K]}</b></td><td colspan="6" class="dim">no read: ${esc(s && s.error)}</td></tr>`; if (s.missing) return `<tr class="off"><td><b>${KW[K]}</b></td><td colspan="6" class="dim">${esc(s.missing)}</td></tr>`;
    const peers = s.peers.map((p) => p.belongs ? `<span class="pr">${esc(p.ticker)}</span>` : `<span class="pr no" title="${esc(p.why.join("; "))}">${esc(p.ticker)}<small>${esc(p.why[0].replace(/ \(.*\)$/, ""))}</small></span>`).join(" ");
    return `<tr class="${s.usable ? "" : "off"}"><td><b>${KW[K]}</b><br><span class="dim small">${esc(s.label)}${s.fell_back ? " · fell back to the home cohort" : ""}</span></td><td class="peers">${peers}${s.fmp_off_hub && s.fmp_off_hub.length ? `<div class="dim small">FMP also names ${esc(s.fmp_off_hub.join(", "))}: not served on the Hub</div>` : ""}</td><td class="n">${s.n_peers} / ${s.with_figures} / ${PC(s.same_share * 100)}</td><td class="n"><b>${$(s.centre)}</b><br><span class="dim small">${esc(s.centre_basis.split(" (")[0].split(",")[0])}</span></td><td class="n small">${s.band ? `${$(s.band.lo)} – ${$(s.band.hi)}` : esc(s.reason || "—")}<br><span class="dim">${fin(s.ways_spread_pct) ? "ways " + s.ways_spread_pct.toFixed(0) + "% apart" : ""}</span></td><td>${s.usable ? `<b class="up">usable</b>` : `<b class="dn">not usable</b> <span class="dim small">${esc(s.usable_why)}</span>`}</td></tr>`; };
  const Lv = n.live; const liveRow = Lv && !Lv.error ? `<tr class="live"><td><b>the live tab</b><br><span class="dim small">${esc(Lv.line || Lv.pricedOn)}${Lv.mostlyDifferent ? " · mostly different business" : ""}</span></td><td class="peers">${Lv.kept.map((k) => Lv.peersOn.includes(k.ticker) ? `<span class="pr">${esc(k.ticker)}<small>${k.sim.toFixed(2)}${k.reference ? " ref" : ""}</small></span>` : `<span class="pr no" title="${esc(k.why)}">${esc(k.ticker)}<small>${Lv.outliers.includes(k.ticker) ? "outlier" : "shown, not priced"}</small></span>`).join(" ")}</td><td class="n">${Lv.kept.length} / ${Lv.peersOn.length} price it</td><td class="n"><b>${$(n.live_centre)}</b><br><span class="dim small">${n.pre_profit ? "EV/sales row" : "way C"}</span></td><td class="n small">${Lv.band ? `${$(Lv.band.lo)} – ${$(Lv.band.hi)}` : esc(Lv.reason || "—")}</td><td><span class="dim small">what the Hub shows tonight</span></td></tr>` : `<tr class="live"><td><b>the live tab</b></td><td colspan="5" class="dim">${esc(Lv && Lv.error)}${Lv && Lv.text ? " — " + esc(Lv.text.slice(0, 160)) : ""}</td></tr>`;
  h.push(`<div class="wrap"><table class="sets"><thead><tr><th>peer set</th><th>members (struck = does not belong, and why)</th><th class="n">peers / with figures / same business</th><th class="n">centre</th><th class="n">range</th><th>verdict</th></tr></thead><tbody>${KEYS.map(setRow).join("")}${liveRow}</tbody></table></div>`);
  /* the implied prices */
  const cell = (r, pre) => !r ? `<td class="n dim">—</td>` : pre && EARN.has(r.key) ? `<td class="n dim">loss</td>` : r.ok ? `<td class="n"><b>${$(r.implied)}</b><br><span class="dim small">${X(r.median)} · ${r.n}${r.swing && Math.abs(r.swing.pct) >= 15 ? ` · <span class="dn">${esc(r.swing.peer)} moves it ${SG(r.swing.pct)}</span>` : ""}</span></td>` : `<td class="n dim small">${esc((r.reason || "—").replace(/^.*?cannot be priced on this row: /, "").slice(0, 60))}</td>`;
  h.push(`<div class="wrap"><table class="mx"><thead><tr><th>multiple</th><th class="n">${esc(T)} today</th>${KEYS.map((K) => `<th class="n">${KW[K]}</th>`).join("")}<th class="n">the live tab</th></tr></thead><tbody>${ROWS.map((k) => { const own = KEYS.map((K) => n.sets[K] && !n.sets[K].error ? (n.sets[K].rows.find((x) => x.key === k) || {}).own : null).find(fin); const lr = Lv && !Lv.error ? Lv.rows.find((x) => x.key === k) : null; return `<tr><td><b>${RW[k]}</b></td><td class="n">${X(own)}</td>${KEYS.map((K) => cell(n.sets[K] && !n.sets[K].error ? n.sets[K].rows.find((x) => x.key === k) : null, n.pre_profit)).join("")}${cell(lr, n.pre_profit)}</tr>`; }).join("")}</tbody></table><div class="dim small">each cell: the implied price, then the peers' median multiple and how many peers carry it; "loss" = meaningless on negative earnings</div></div>`);
  /* the peer-set check in words */
  const missing = (() => { const inAny = new Set(KEYS.flatMap((K) => n.sets[K] && !n.sets[K].error ? n.sets[K].peers.map((p) => p.ticker) : [])); const same = Lv && !Lv.error ? Lv.same.filter((t) => !inAny.has(t)) : []; const off = [...new Set(KEYS.flatMap((K) => n.sets[K] && n.sets[K].fmp_off_hub || []))]; return { same, off }; })();
  h.push(`<div class="kv"><span class="k">the peer-set check</span>Usable switches: <b>${n.usable_n} of 4</b> (${KEYS.map((K) => n.sets[K] && n.sets[K].usable ? KW[K] : null).filter(Boolean).join(", ") || "none"}). ${missing.same.length ? `Obvious peers missing from every switch: <b>${esc(missing.same.join(", "))}</b> (the live tab finds they share its business line).` : "Every same-business name the live tab finds sits in at least one switch."} ${missing.off.length ? `FMP names ${esc(missing.off.join(", "))}, not served on the Hub.` : ""} ${n.pp ? `coverage verdict on the 13 Oct pre-profit page: ${esc(n.pp.analysts_verdict || "—")}.` : ""}</div>`);
  if (n.flags.length) h.push(`<div class="kv"><span class="k">where the method broke on this name</span><ul class="fl">${n.flags.map((f) => `<li><b>${esc(FLAGW[f.code] || f.code)}</b> — ${esc(f.words)}</li>`).join("")}</ul></div>`);
  h.push(`</section>`); return h.join("");
}

/* ---------- the summary ---------- */
function summary() {
  const row = (T, i) => { const n = byName[T]; return `<tr><td class="n">${i + 1}</td><td><a href="#c-${esc(T)}"><b>${esc(T)}</b></a> <span class="dim">${esc(n.name).slice(0, 28)}</span>${n.pre_profit ? ' <i class="tag">pre-profit</i>' : ""}</td><td class="n">${$(n.price)}</td><td class="n"><b>${$(n.midpoint)}</b> <span class="dim small">${n.midpoint_n}/4</span></td><td class="n ${dir(-n.distance_pct)}"><b>${SG(n.distance_pct)}</b></td><td class="n">${fin(n.live_centre) ? `${$(n.live_centre)} <span class="dim small">${SG(n.live_distance_pct)}</span>` : "—"}</td><td class="n">${n.db.analysts.n ? `${$(n.db.analysts.median)} <span class="dim small">${SG(n.analyst_distance_pct)} · ${n.db.analysts.n}</span>` : "—"}</td><td class="n">${n.channel ? PC(n.channel.pos_now) : "—"}</td><td class="n ${fin(n.switch_spread_pct) && n.switch_spread_pct > 40 ? "dn" : ""}">${fin(n.switch_spread_pct) ? n.switch_spread_pct.toFixed(0) + "%" : "—"}</td><td class="n">${n.usable_n}/4</td><td><b class="${n.verdict === "sound" ? "up" : n.verdict === "broken" ? "dn" : ""}">${n.verdict}</b> <span class="dim small">${n.sits}</span></td><td class="small">${[...new Set(n.flags.map((f) => FLAGW[f.code]))].join(" · ")}</td></tr>`; };
  const un = D.unranked.map((u) => { const n = byName[u.ticker]; return `<tr class="pend"><td class="n">—</td><td><a href="#c-${esc(u.ticker)}"><b>${esc(u.ticker)}</b></a> <span class="dim">${esc(n.name).slice(0, 28)}</span></td><td class="n">${$(n.price)}</td><td colspan="9" class="small">${esc(u.why)}</td></tr>`; }).join("");
  return `<div class="wrap"><table class="rank"><thead><tr><th class="n">#</th><th>name</th><th class="n">today</th><th class="n">comps midpoint</th><th class="n">distance</th><th class="n">the live tab</th><th class="n">analysts</th><th class="n">channel pos.</th><th class="n">switch spread</th><th class="n">usable</th><th>peer-set verdict</th><th>where the method broke</th></tr></thead><tbody>${D.ranked.map(row).join("")}${un}</tbody></table></div>
  <p class="sub">Distance = today's price against the four-switch midpoint (negative = the price is below the comps, "cheap"; positive = above, "rich"); the midpoint is the median of the switches' centres, way B on the tab, or the EV/sales row for a loss-maker. Usable counts the switches that pass the peer-set test written under PAGE SPECS. Switch spread = how far apart the four centres sit. Channel position = where today's price sits between his approved rails as read 10 Oct.</p>`;
}

/* ---------- the peer-set check table ---------- */
function peerCheck() {
  const c = D.counts.usable_by_switch;
  const rows = D.names.filter((n) => !n.none).map((n) => `<tr><td><b>${esc(n.ticker)}</b></td>${KEYS.map((K) => { const s = n.sets[K]; if (!s || s.error) return `<td class="dim">no read</td>`; if (s.missing) return `<td class="dim">not on hand</td>`; const bad = s.peers.filter((p) => !p.belongs); return `<td class="${s.usable ? "" : "offc"}"><b>${s.usable ? "usable" : "not usable"}</b> <span class="dim small">${esc(s.label)} · ${s.n_peers}${s.usable ? "" : " · " + esc(s.usable_why)}</span>${bad.length ? `<div class="small">out of place: ${bad.length} of ${s.n_peers} — ${esc(bad.slice(0, 6).map((p) => p.ticker).join(", "))}${bad.length > 6 ? "…" : ""}</div>` : ""}</td>`; }).join("")}</tr>`).join("");
  return `<p class="sub">Usable under each switch, of the ${D.counts.ran} names the machine could run: <b>tightest tag ${c.TIGHTEST} · home cohort ${c.HOME} · FMP peers ${c.FMP} · largest 7 ${c.LARGEST}</b>. A set is usable when it is on hand, did not fall back, has at least four peers with figures, at least half of them share the name's industry or business, and two or more rows can be priced. "Out of place" counts the peers that fail one of: different business, no forward estimate, a tenth of the name's size or ten times it, a foreign filer.</p><div class="wrap"><table class="pc"><thead><tr><th>name</th>${KEYS.map((K) => `<th>${KW[K]}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

/* ---------- where the method breaks ---------- */
function breaks() {
  return D.breaks.filter((b) => b.hits.length).map((b) => `<div class="brk"><h3>${esc(b.title)} <small>${b.hits.length} of ${D.counts.ran} names</small></h3><ul>${b.hits.map((h) => `<li><b>${esc(h.ticker)}</b> — ${esc(h.lines.slice(0, 2).join(" · "))}${h.lines.length > 2 ? ` <span class="dim">(+${h.lines.length - 2} more on its card)</span>` : ""}</li>`).join("")}</ul><p class="fix"><span class="k">the fix to the machine</span>${esc(b.fix)}</p></div>`).join("");
}

const specs = `<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<p><b>What ran.</b> Two of the Hub's own comps modules were driven headless on a local serve of the release branch hub/release-20260923 at ${esc(D.hub_commit)} (the same files the live Hub serves), reading the live database the Hub's own way (GET through its public route). (1) The LIVE COMPS tab, C5 with the C6 outlier rule — the company view, COMPS, as it opens tonight: the set from business lines, the price from the whole field (way C), the figures from the statements and estimates on file. (2) The four-switch tab of 1 Oct (C3b, deliverables/20261001/comps-table-first: tightest tag · home cohort · FMP peers · largest 7, the 16-column table), mounted once per switch; its default way B (the middle-half band across the six rows) is the band drawn, its way A / C-equal / C-weighted are reported as "the tab's ways". Nothing was recomputed here; every figure on the page is copied off the tab's state. Every non-GET request was answered locally and counted: ${D.run.writes_blocked} writes blocked, ${D.run.errors.length} page errors. Read ${esc(ny(D.run.at))}; the database reads for the lists, profiles, tags and analyst targets at ${esc(ny(D.db_read_utc))}.</p>
<p><b>The RADAR list.</b> station_lists where list = radar, ${D.names.length} names as read tonight. FAVORITES and LIKED are other lists and not on this page.</p>
<p><b>Rules this page adds (none of them live).</b> Sits: ${esc(D.rules.sits)}. Midpoint: ${esc(D.rules.midpoint)}. Usable switch: ${esc(D.rules.usable)}. Verdict: ${esc(D.rules.verdict)}. One peer moving the median: ${esc(D.rules.swing)}. "Does not belong": a peer in a different FMP industry that the live tab does not list as sharing the business line; or without any multiple, or without a forward estimate; or under a tenth of the name's market value or over ten times it; a foreign filer is marked but not struck. Pre-profit: trailing EPS at or under zero on the tab's snapshot, or PP1 (13 Oct) filing the name as pre-profit or pre-revenue; such a name is valued on the EV/sales row only, PP1's measure, and its P/E and PEG cells say "loss".</p>
<p><b>Analysts.</b> analyst_target_news as the allocation tool reads it: checked TARGET notes, quality ok, last 90 days, one per firm (the newest), the median, the low and the high. <b>His LT channel.</b> The 10 Oct read of the capture chart (staging/channels/CHANNEL-ROOM-DATA.json, ${esc(D.channel_asof)}): the bottom and top rails of the approved set; position recomputed on tonight's price, so a sloped rail may have moved a few dollars. ${D.counts.with_channel} of the ${D.names.length} names have a read. <b>PP1.</b> PRE-PROFIT-NAMES.json (built ${esc(D.pp1_built || "13–14 Oct")}): class, rank, quarters of cash, trailing growth, coverage verdict.</p>
<p><b>The football field.</b> One axis per name on a log scale from a quarter of today's price to eight times it, so a distance reads the same in percent on every card; a bar that runs past the edge carries « or ». Bars: the four switches (blue; a greyed bar is a switch that fails the peer-set test), the live tab (orange), then the six multiples as the spread of implied prices across the switches (dots) and the live tab (a diamond), the analysts' low–high with the median (green), his channel rails (yellow). Today's price is the cyan line. Labels carry identity; colour follows the row, never the rank.</p>
<p><b>Missing.</b> Where a figure is missing the cell says so; nothing is filled in. AAOI is not in any cohort, so the tab cannot open it. BTCUSD is a coin: no earnings, no sales, no peers with multiples. No FMP call was made (lanes hold no working key); every figure is what the Hub stores, with its date on the card where the tab carries one.</p>
<p><b>Files.</b> RADAR-COMPS.json (everything on the page, with the rules and counts); reads/&lt;TICKER&gt;.json (the tab states as copied, tab text removed); reads/_run.json (the run receipt). Tools in the return package.</p>
</details>`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RADAR through comps</title>
<meta name="description" content="The 23 RADAR names run through the Hub's comps machine on 15 Oct 2026: a football field per name against each of its peer sets, where each sits, whether its peer sets make sense, and where the method breaks.">
<style>
:root{--ground:#0A0A0F;--panel:#0D0D14;--ink:#F2F2F8;--ink2:#C6C8DE;--ink3:#9A9AB6;--line:#1A1A26;--line2:#262636;--up:#00FFA3;--dn:#FF2D55;--mute:#6E6E88;--neon:#00D4FF;--grey:#3A3A4E;--s-sw:#3987e5;--s-lv:#d95926;--s-an:#199e70;--s-ch:#c98500}
*{box-sizing:border-box;min-width:0}html{background:var(--ground)}body{margin:0;background:var(--ground);color:var(--ink2);font-family:"SF Mono",ui-monospace,Menlo,monospace;font-size:13px;line-height:1.55;padding:22px 16px 60px}
main{max-width:1640px;margin:0 auto}
h1{font-size:18px;letter-spacing:.22em;font-weight:600;margin:0;color:var(--ink);line-height:1.4}h1 small{display:block;font-size:11px;letter-spacing:.08em;color:var(--ink3);font-weight:400;margin-top:6px;text-transform:none}
.sub{color:var(--ink3);font-size:11px;letter-spacing:.03em;margin-top:8px;line-height:1.6;max-width:1400px}
h2{font-size:12px;letter-spacing:.22em;color:var(--ink);margin:34px 0 6px;font-weight:600}h2 small{color:var(--ink3);letter-spacing:.04em;font-weight:400;font-size:11px;display:block;margin-top:3px}
h3{font-size:13px;letter-spacing:.14em;color:var(--ink);margin:0 0 4px;font-weight:600}h3 small{color:var(--ink3);letter-spacing:.04em;font-weight:400;font-size:11px;margin-left:8px}
.up{color:var(--up)}.dn{color:var(--dn)}.dim{color:var(--ink3)}.small{font-size:11px}small{font-size:11px}
.tag{font-style:normal;font-size:10px;letter-spacing:.14em;padding:1px 5px;border:1px solid var(--line2);border-radius:3px;color:var(--ink3);vertical-align:middle;margin-left:3px}
.wrap{overflow-x:auto;max-width:100%;margin-top:8px}table{border-collapse:collapse;width:100%;font-size:12px}th{color:var(--ink3);text-align:left;font-weight:400;font-size:10px;letter-spacing:.14em;text-transform:uppercase;padding:6px 8px;border-bottom:1px solid var(--line2);white-space:nowrap}td{padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
tr.pend td{color:var(--ink3)}tr.off td{color:var(--ink3)}tr.live td{background:#0E1016}td.offc{color:var(--ink3)}
table.rank{min-width:1200px}table.rank a{color:var(--ink);text-decoration:none}table.rank a:hover{color:var(--neon)}
table.sets{min-width:1000px}table.sets td.peers{max-width:760px}.pr{display:inline-block;margin:1px 6px 1px 0;color:var(--ink2);white-space:nowrap}.pr small{color:var(--ink3);margin-left:3px;font-size:10px}.pr.no{text-decoration:line-through;color:var(--mute)}.pr.no small{text-decoration:none;color:var(--mute)}
table.mx{min-width:900px}table.pc{min-width:1100px}table.pc td{font-size:11.5px}
.card{border:1px solid var(--line2);border-radius:8px;padding:14px 16px;margin-top:16px;background:var(--panel)}
.three{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:8px 0 6px;font-size:12.5px;color:var(--ink2)}.three p{margin:0}.three b{color:var(--ink)}@media(max-width:900px){.three{grid-template-columns:1fr}}
.kv{margin:10px 0 2px;font-size:12px;color:var(--ink2);line-height:1.6;max-width:1500px}.kv .k,.fix .k{color:var(--ink3);font-size:10px;letter-spacing:.14em;text-transform:uppercase;display:block;margin-bottom:2px}.kv ul.fl{margin:2px 0 0;padding-left:18px}.kv ul.fl li{margin:2px 0}
.brk{border:1px solid var(--line2);border-radius:8px;padding:12px 14px;margin-top:12px}.brk ul{margin:6px 0 0;padding-left:18px}.brk li{margin:3px 0;font-size:12px}.brk .fix{margin:10px 0 0;color:var(--ink2);font-size:12px}
svg.ff{width:100%;max-width:1400px;height:auto;display:block;margin:10px 0 2px;font-family:inherit}svg.ff .grid{stroke:var(--line2);stroke-width:1}svg.ff .today{stroke:var(--neon);stroke-width:1.5}svg.ff .tick{fill:var(--ink3);font-size:10px}svg.ff .tick.strong{fill:var(--ink);font-weight:600}
svg.ff .lab{fill:var(--ink2);font-size:11px}svg.ff .lab.dim{fill:var(--mute)}svg.ff .note{fill:var(--mute);font-size:10.5px}svg.ff .val{fill:var(--ink3);font-size:10.5px}svg.ff .cut{fill:var(--ink);font-size:12px;font-weight:600}
svg.ff .bar.sw{fill:var(--s-sw)}svg.ff .bar.lv{fill:var(--s-lv)}svg.ff .bar.an{fill:var(--s-an)}svg.ff .bar.ch{fill:var(--s-ch)}svg.ff .bar.dim{opacity:.35}svg.ff .mid{stroke:var(--ink);stroke-width:2}
svg.ff .rng.mx{stroke:var(--s-sw);stroke-width:2;opacity:.5}svg.ff .pt.sw{fill:var(--s-sw);stroke:var(--ground);stroke-width:2}svg.ff .pt.lv{fill:var(--s-lv);stroke:var(--ground);stroke-width:2}
ul.legend{list-style:none;margin:4px 0 0;padding:0;columns:2;column-gap:28px;font-size:11px;color:var(--ink3);max-width:1400px}ul.legend li{break-inside:avoid;margin:1px 0}ul.legend b{color:var(--ink2);font-weight:500}ul.legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px;vertical-align:middle}
i.sw-sw{background:var(--s-sw)}i.sw-lv{background:var(--s-lv)}i.sw-an{background:var(--s-an)}i.sw-ch{background:var(--s-ch)}i.sw-mx{background:var(--s-sw);opacity:.5}
.nofield{color:var(--mute);font-size:11px;margin:8px 0}.why{color:var(--ink2);margin:6px 0 2px}
details.sc-pagespecs{margin-top:28px;border:1px solid var(--line);border-radius:10px;padding:10px 14px;color:var(--ink3);font-size:11px;line-height:1.6}details.sc-pagespecs summary{cursor:pointer;letter-spacing:.2em;color:var(--ink2);font-size:11px}details.sc-pagespecs p{max-width:1400px}
@media(max-width:600px){body{padding:14px 16px 40px}ul.legend{columns:1}.card{padding:10px}}
</style></head><body><main>
<h1>THE RADAR LIST THROUGH THE COMPS MACHINE<small>${D.names.length} names on watch · the Hub's live COMPS tab and its four-switch tab run headless on ${esc(ny(D.run.at))} · release ${esc(D.hub_commit)} · nothing recomputed, nothing written · a study page on a branch, not live</small></h1>
<p class="sub">Every RADAR name was opened on the Hub's own comps machine, twice: the live COMPS tab (the set from business lines) and the 1 Oct four-switch tab (tightest tag · home cohort · FMP peers · largest 7, the 16-column table). Each card opens on one football field: the four switches' ranges, the live tab's range, the six multiples' implied prices across the switches, the analysts' range and his long-term channel rails, with today's price as the line. Three sentences say where it sits, what drives the gap and what a buyer pays for. The peer-set check and the list of where the method breaks follow the cards.</p>
<h2>1 · THE ${D.names.length} NAMES, CHEAPEST FIRST<small>ranked by distance from the comps midpoint; ${D.counts.ran} of ${D.names.length} could be run; ${D.counts.pre_profit} are loss-makers valued on sales only; ${D.counts.disagree40} have their four switches more than 40% apart</small></h2>
${summary()}
<h2>2 · THE CARDS<small>one football field per name, then its peer sets, the implied price per multiple per set, and three plain sentences</small></h2>
${D.names.map(card).join("")}
<h2>3 · THE PEER-SET CHECK<small>does each switch's set make sense for the name?</small></h2>
${peerCheck()}
<h2>4 · WHERE THE METHOD BREAKS<small>the concrete failures from the ${D.counts.ran} runs, each with the names it happened on and the fix to the machine, not to the name</small></h2>
<div id="breaks">${breaks()}</div>
${specs}
<script>window.CW2_PAGE_READY=true;</script>
</main></body></html>`;
fs.writeFileSync(path.join(OUT, "RADAR-COMPS.html"), html);
console.log("page", (html.length / 1024).toFixed(0), "KB; fields", (html.match(/<svg class="ff"/g) || []).length, "; cards", (html.match(/<section class="card"/g) || []).length);

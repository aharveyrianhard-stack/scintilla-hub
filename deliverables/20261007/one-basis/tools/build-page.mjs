/* CP3 · the page for Alan: ONE-BASIS.html, from data/one-basis.json and data/cards.json. Static: no script fetches
   anything; the pictures are drawn in HTML and CSS so their words stay readable on a phone. Greys only, plus the Hub's
   green and red for direction. Sentences that explain live in PAGE SPECS at the foot (tools/page-specs.fragment).
     node tools/build-page.mjs                                                                                       */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "..");
const D = JSON.parse(readFileSync(ROOT + "/data/one-basis.json", "utf8")), CARDS = JSON.parse(readFileSync(ROOT + "/data/cards.json", "utf8")).cards;
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const NICE = { "000660.KS": "SK HYNIX", "005930.KS": "SAMSUNG", "285A.T": "KIOXIA" }, tk = (t) => NICE[t] || t;
const x1 = (v) => (v == null || !Number.isFinite(+v) ? "—" : (+v).toFixed(1) + "×"), x2 = (v) => (v == null || !Number.isFinite(+v) ? "—" : (+v).toFixed(2));
const pc = (v, d = 0) => (v == null || !Number.isFinite(+v) ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(+v).toFixed(d) + "%");
const sg = (v, d = 0) => (v == null || !Number.isFinite(+v) ? '<span class="dim">—</span>' : `<span class="${v > 0 ? "up" : v < 0 ? "dn" : ""}">${pc(v, d)}</span>`);
const px = (v) => (v == null ? "—" : (+v >= 1000 ? Math.round(+v).toLocaleString("en-US") : (+v).toFixed(2)));
const SHORT = { "Taiwan Semiconductor Manufacturing Company Limited": "TSMC", "Amazon.com, Inc.": "Amazon", "Digital Realty Trust, Inc.": "Digital Realty", "Samsung Electronics Co., Ltd.": "Samsung", "SK hynix Inc.": "SK hynix", "Eli Lilly and Company": "Eli Lilly" };
const short = (name) => SHORT[name] || String(name || "").replace(/,? (Inc\.?|Corporation|Corp\.?|Incorporated|Company|Co\.|plc|Limited|Ltd\.?|N\.V\.|Holdings?|Technologies|Technology|Platforms|\.com)\b.*$/i, "").replace(/ Semiconductor Manufacturing.*$/, "").trim();
/* every cell's content is ONE box: on a phone a cell is a two-column grid (its label, its value), and a value made of two pieces would otherwise fall into two rows */
const td = (label, html, cls = "") => `<td data-l="${esc(label)}"${cls ? ` class="${cls}"` : ""}><div class="cv">${html}</div></td>`;
const CORE = Object.keys(D.core), L = Object.fromEntries(D.leaders.map((r) => [r.ticker, r]));
const votes = (n) => `<span class="vt" title="${n} of the four sources name it">${[0, 1, 2, 3].map((i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</span>`;

/* ---- the first screen ------------------------------------------------------------------------------------------------ */
const g = D.test30.find((r) => r.ticker === "GOOGL"), mu = D.core.MU, K = D.knockout;
const kpi = (big, small) => `<div class="kpi"><b>${big}</b><span>${small}</span></div>`;
const first = `<section id="first"><div class="kpis">
${kpi(`${D.test30_agree} of ${D.test30.length}`, "NAMES PRINT ONE FORWARD P/E ON THE DASHBOARD, THE COMPS TAB, THE CARD AND THE FEED")}
${kpi(`${g.dashboard}`, `ALPHABET, EVERYWHERE · IT WAS ${g.was_fiscal_year} IN THE COMPS AND ${g.was_card} ON ITS CARD`)}
${kpi(pc(mu.runs.cp3.upside_pct), `MICRON AGAINST SIX MEMORY MAKERS · IT READ ${pc(mu.runs.live.upside_pct)} AGAINST CHIP NAMES`)}
${kpi(`${K.moved_5} of ${K.priced_both}`, "COMPS READINGS MOVE MORE THAN FIVE POINTS ON THE ONE BASIS")}
${kpi(`${K.champions_changed.length} of ${K.reproduced.of}`, "BRANCH CHAMPIONS CHANGE IN THE KNOCKOUT")}
</div></section>`;

/* ---- the one-basis table ---------------------------------------------------------------------------------------------- */
const cell = (v, ref) => `<span class="mx${v === ref ? " same" : " diff"}">${esc(v)}</span>`;
const wasCell = (v, now) => (v == null ? '<span class="faint">no card</span>' : `<span class="mx was${v === now ? " same" : ""}">${esc(v)}</span>`);
const table30 = `<section id="table30"><h2>ONE FORWARD P/E · THIRTY NAMES · THE 6 OCT CLOSE</h2><div class="panel"><table class="r t30"><thead><tr><th>NAME</th><th class="n">CLOSE</th><th class="n">DASHBOARD</th><th class="n">COMPS TAB</th><th class="n">CARD</th><th class="n">FEED</th><th class="n">TOOL</th><th class="n">BEFORE · COMPS</th><th class="n">BEFORE · CARD</th><th>EARNINGS BEHIND IT</th></tr></thead><tbody>
${D.test30.map((r) => `<tr>${td("", `<span class="tk">${esc(tk(r.ticker))}</span> <span class="dim">${esc(short(r.name))}</span>`)}${td("CLOSE", px(r.price), "n")}${td("DASHBOARD", cell(r.dashboard, r.dashboard), "n")}${td("COMPS TAB", cell(r.comps_tab, r.dashboard), "n")}${td("CARD", cell(r.card, r.dashboard), "n")}${td("FEED", cell(r.feed, r.dashboard), "n")}${td("TOOL", cell(r.tool, r.dashboard), "n")}${td("BEFORE · COMPS", wasCell(r.was_fiscal_year, r.dashboard), "n")}${td("BEFORE · CARD", wasCell(r.was_card, r.dashboard), "n")}${td("EARNINGS", `<span class="small">${esc(r.eps == null ? "no estimate" : (r.converted ? "≈$" + x2(r.eps_usd) + " (" + r.rate.currency + " " + x2(r.eps) + ")" : "$" + x2(r.eps)) + " · " + (r.basis === "next four quarters" ? r.label.replace("next four quarters to ", "four quarters to ") : r.label))}${r.why && r.eps != null && r.dashboard === "—" ? " · " + esc(r.why) : ""}</span>`)}</tr>`).join("\n")}
</tbody></table></div></section>`;

/* ---- the leaders against each other ----------------------------------------------------------------------------------- */
const PE_LO = 3, PE_HI = 130, lpos = (v) => Math.max(0, Math.min(100, ((Math.log(v) - Math.log(PE_LO)) / (Math.log(PE_HI) - Math.log(PE_LO))) * 100));
/* one peers' median on a panel: the blend's own (the yardstick table), which leaves out a peer too far from the others;
   where that differs from the plain median over every peer, the strip says both */
const blendRow = (n, k) => { const r = n.runs && n.runs.cp3 && n.runs.cp3.rows ? n.runs.cp3.rows[k] : null; return r && r.median != null ? r : null; };
const medOf = (n, k) => { const r = blendRow(n, k); return r ? r.median : (n.sits[k] ? n.sits[k].median : null); };
const peTrack = (n) => { const dots = n.peers.filter((p) => p.pe_fwd > 0).map((p) => `<i class="d${p.priced ? " pr" : ""}" style="left:${lpos(p.pe_fwd).toFixed(1)}%" title="${esc(tk(p.ticker))} ${esc(p.pe_fwd_text)}${p.priced ? "" : " · shown, not priced"}"></i>`).join("");
  const med = n.sits.pe_fwd ? `<i class="md" style="left:${lpos(medOf(n, "pe_fwd")).toFixed(1)}%" title="the peers' median, as in the blend ${x1(medOf(n, "pe_fwd"))}"></i>` : "";
  const own = n.own.pe_fwd > 0 ? `<i class="own" style="left:${lpos(n.own.pe_fwd).toFixed(1)}%" title="${esc(n.forward.text)}"></i>` : "";
  return `<div class="trk pe">${[5, 10, 20, 40, 80].map((v) => `<u style="left:${lpos(v).toFixed(1)}%"><b>${v}×</b></u>`).join("")}${dots}${med}${own}</div>`; };
const FF_LO = -75, FF_HI = 175, fpos = (v) => Math.max(0, Math.min(100, ((v - FF_LO) / (FF_HI - FF_LO)) * 100));
const field = (c, price) => { if (!c || c.low == null) return '<div class="trk ff none"><span class="dim">no range</span></div>'; const lo = (c.low / price - 1) * 100, mid = (c.centre / price - 1) * 100, hi = (c.high / price - 1) * 100;
  return `<div class="trk ff" title="low ${px(c.low)} · centre ${px(c.centre)} · high ${px(c.high)} · price ${px(price)}"><span class="band" style="left:${fpos(lo).toFixed(1)}%;width:${(fpos(hi) - fpos(lo)).toFixed(1)}%"></span><i class="ctr" style="left:${fpos(mid).toFixed(1)}%"></i><i class="prc" style="left:${fpos(0).toFixed(1)}%"></i></div>`; };
const debtCell = (d) => (d.word === "net cash" ? '<span class="tag">NET CASH</span>' : d.word === "not read" ? '<span class="dim">not read</span>' : d.net_debt_ebitda == null ? `<span class="dim">${esc(d.word || "—")}</span>` : `<b>${x1(d.net_debt_ebitda)}</b> <span class="dim">${esc(d.word)}</span>`);
const flagWords = (r) => [r.comps.thin ? "THIN" : null, r.comps.fragile ? "FRAGILE" : null, r.flags.includes("quarters-do-not-add-up") ? "BAD ROWS" : null, r.flags.includes("thin") ? "ONE ANALYST" : null].filter(Boolean).map((w) => `<span class="tag">${w}</span>`).join("");
const leaders = `<section id="leaders"><h2>THE LEADERS AGAINST EACH OTHER</h2><div class="panel"><table class="r lead"><thead><tr><th>NAME</th><th class="n">CLOSE</th><th class="n">FORWARD P/E</th><th class="n">EARNINGS GROWTH · FOLLOWING YEAR</th><th class="n">P/E ÷ GROWTH</th><th class="n">EV / EBITDA</th><th class="n">OPERATING MARGIN</th><th class="n">NET DEBT ÷ EBITDA</th><th class="w">COMPS RANGE AGAINST THE PRICE <span class="faint">−75% … price … +175%</span></th><th class="n">TO THE CENTRE</th><th class="n">GEIGER · ITS OWN YEAR</th></tr></thead><tbody>
${D.leaders.map((r) => `<tr>${td("", `<span class="tk">${esc(r.ticker)}</span> <span class="dim">${esc(short(r.name))}</span>${flagWords(r)}`)}${td("CLOSE", px(r.price), "n")}${td("FORWARD P/E", `<b>${esc(r.pe_fwd_text)}</b> <span class="small">was ${x1(r.was_fiscal_year)}</span>`, "n")}${td("GROWTH", sg(r.growth) + (r.growth_from === "years" ? ' <span class="small">yearly est.</span>' : "") + `<span class="small blk">${pc(r.growth_reported_to_next)} reported → next four</span>`, "n wrap")}${td("P/E ÷ GROWTH", `<b>${x2(r.peg)}</b>`, "n")}${td("EV / EBITDA", x1(r.ev_ebitda), "n")}${td("OP. MARGIN", r.om == null ? "—" : Math.round(r.om) + "%", "n")}${td("NET DEBT ÷ EBITDA", debtCell(r.debt), "n")}${td("COMPS RANGE", field(r.comps, r.price), "w")}${td("TO THE CENTRE", r.comps.no_peer_set ? '<span class="dim">no peer set</span>' : sg(r.comps.upside), "n")}${td("GEIGER", r.technicals ? `${r.technicals.geiger == null ? "—" : (r.technicals.geiger > 0 ? "+" : "") + (+r.technicals.geiger).toFixed(2)} <span class="dim">· ${r.technicals.pctl == null ? "—" : r.technicals.pctl + ordinal(r.technicals.pctl)}</span>` : "—", "n")}</tr>`).join("\n")}
</tbody></table></div></section>`;
function ordinal(n) { const v = n % 100; return v > 10 && v < 14 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"; }

/* ---- each core candidate in full ---------------------------------------------------------------------------------------- */
const step = (label, v, extra = "") => `<div class="st"><span>${label}</span><b>${v == null ? '<span class="dim">no peer set</span>' : sg(v)}</b>${extra}</div>`;
const coreBlock = (t) => { const n = D.core[t], r = L[t], c = n.runs.cp3, st = n.sets.stated, own = n.own;
  const order = [...n.peers].sort((a, b) => (b.priced - a.priced) || ((a.pe_fwd ?? 1e9) - (b.pe_fwd ?? 1e9)));
  const rows = order.map((p) => `<tr class="${p.priced ? "" : "np"}">${td("", `<span class="tk">${esc(tk(p.ticker))}</span> <span class="dim">${esc(short(p.name))}</span>${p.reference ? '<span class="tag">COMPS ONLY</span>' : ""}${p.added && !p.reference ? '<span class="tag">ADDED</span>' : ""}`)}${td("PRICES IT", p.priced ? "●" : p.has_figures === false ? '<span class="dim">no figures</span>' : p.outlier ? '<span class="dim">outlier</span>' : '<span class="dim">shown</span>', "n")}${td("SOURCES", votes(p.votes ? p.votes.n : 0), "n")}${td("FORWARD P/E", `<b>${esc(p.pe_fwd_text || "—")}</b>`, "n")}${td("GROWTH", sg(p.growth_eps), "n")}${td("P/E ÷ GROWTH", x2(p.peg), "n")}${td("EV / EBITDA", x1(p.ev_ebitda), "n")}${td("OP. MARGIN", p.om == null || Math.abs(p.om) > 999 ? "—" : Math.round(p.om) + "%", "n")}${td("NET DEBT ÷ EBITDA", p.debt ? debtCell(p.debt) : "—", "n")}</tr>`).join("\n");
  const ownRow = `<tr class="ownr">${td("", `<span class="tk">${esc(t)}</span> <span class="dim">${esc(short(n.name))}</span>`)}${td("PRICES IT", "", "n")}${td("SOURCES", "", "n")}${td("FORWARD P/E", `<b>${esc(n.forward.text)}</b>`, "n")}${td("GROWTH", sg(n.forward.growth_pct), "n")}${td("P/E ÷ GROWTH", `<b>${x2(n.forward.peg)}</b>`, "n")}${td("EV / EBITDA", x1(own.ev_ebitda), "n")}${td("OP. MARGIN", own.om == null ? "—" : Math.round(own.om) + "%", "n")}${td("NET DEBT ÷ EBITDA", debtCell(own.debt), "n")}</tr>`;
  const bl = blendRow(n, "pe_fwd"), leftOut = bl && n.sits.pe_fwd ? n.sits.pe_fwd.of - 1 - bl.n : 0;
  const sit = n.sits.pe_fwd ? `${n.sits.pe_fwd.place}${ordinal(n.sits.pe_fwd.place)} cheapest of ${n.sits.pe_fwd.of} · peers' median ${x1(medOf(n, "pe_fwd"))}${leftOut > 0 ? ` — as in the blend: ${leftOut} peer${leftOut > 1 ? "s" : ""} too far from the others ${leftOut > 1 ? "are" : "is"} left out (${x1(n.sits.pe_fwd.median)} with every peer in)` : ""}` : "—";
  const gsit = n.sits.growth_eps ? `${n.sits.growth_eps.place}${ordinal(n.sits.growth_eps.place)} fastest of ${n.sits.growth_eps.of} · peers' median ${pc(n.sits.growth_eps.median)}` : "—";
  const legs = n.legs ? `<div class="legs">${Object.entries(n.legs).map(([leg, v]) => `<div class="leg"><span>${esc(leg.toUpperCase())}</span><b>${x1(v.pe_fwd)}</b><small>forward P/E · ${v.peers.map(tk).join(" ")}</small><small>growth ${pc(v.growth_eps)} · EV/EBITDA ${x1(v.ev_ebitda)} · margin ${v.om == null ? "—" : Math.round(v.om) + "%"}</small><small>${esc(t)} on this leg's P/E: <b>${px(v.price_on_pe)}</b> ${sg(v.upside_on_pe)}</small></div>`).join("")}</div>` : "";
  const flags = [c.thin ? `<span class="tag wait">THIN · ${n.sets.priced.length} PEERS</span>` : "", c.fragile ? '<span class="tag wait">FRAGILE CENTRE</span>' : "", ...n.forward.flags.map((f) => `<span class="tag" title="${esc(f.words)}">${esc(f.code === "thin" ? "ONE ANALYST ON SOME QUARTERS" : f.code === "quarters-do-not-add-up" ? "A YEAR'S QUARTERS DO NOT ADD UP" : f.code.toUpperCase().replace(/-/g, " "))}</span>`), c.reit ? '<span class="tag">PROPERTY TRUST · PRICED ON P/FFO</span>' : "", own.debt.warn ? `<span class="tag" title="${esc(own.debt.warn)}">EBITDA FLATTERED?</span>` : ""].join("");
  /* THE BLEND FIRST (Alan, 7 Oct: "do we only use P/E? We did a whole football field … a blend of metrics"): the range from every
     yardstick together, then each yardstick's own row — the company's multiple, its peers' median, the price that median implies,
     and the weight it carries in the blend */
  const YL = { pe_ttm: "P/E · LAST 12 MONTHS", pe_fwd: "P/E · NEXT FOUR QUARTERS", ev_ebitda: "EV / EBITDA", ev_sales: "EV / SALES", ps: "PRICE / SALES", peg: "P/E ÷ GROWTH", p_ffo: "PRICE / FUNDS FROM OPERATIONS" };
  const yard = Object.entries(c.rows || {}).map(([k, y]) => `<tr class="${y.weight > 0 ? "" : "np"}">${td("", `<span class="small">${YL[k] || esc(y.label)}</span>`)}${td(t, k === "peg" ? x2(y.own) : x1(y.own), "n")}${td("PEERS' MEDIAN", k === "peg" ? x2(y.median) : x1(y.median), "n")}${td("PRICE AT THAT", y.price == null ? '<span class="dim">—</span>' : `<b>${px(y.price)}</b> ${sg((y.price / n.price - 1) * 100)}`, "n")}${td("WEIGHT", y.weight > 0 ? Math.round(y.weight * 100) + "%" + (y.credit ? ' <span class="small">growth credit ×' + y.credit + "</span>" : "") : `<span class="dim">${y.off ? "left out: margins too far apart" : "not priced"}</span>`, "n")}</tr>`).join("\n");
  const tw = n.three_ways, twBox = (label, v) => (v ? `<div class="st"><span>${label}</span><b>${sg(v.upside_pct)}</b><small>centre ${px(v.band && v.band.centre)} · peers' forward P/E ${x1(v.pe_fwd_median)}</small></div>` : "");
  const three = tw ? `<div class="ph" style="margin-top:14px">THREE WAYS · WHO PRICES IT</div><div class="steps three">${twBox("US-LISTED PEERS ONLY", tw.us_listed_only)}${twBox("+ SK HYNIX", tw.plus_sk_hynix)}${twBox("+ SK HYNIX, SAMSUNG, KIOXIA", tw.all_three)}</div>` : "";
  const checks = ((n.set_check && n.set_check.words) || []).map((w) => `<div class="chk">${esc(w.replace(/^set check: /, "SET CHECK · "))}</div>`).join("");
  const g2 = own.growth_reported_to_next;
  const chan = CARDS[t] && CARDS[t].technicals && CARDS[t].technicals.long_term_channel, chanLine = chan ? `<div class="chk">LONG-TERM CHANNEL · ${esc(chan.words)}</div>` : "";
  return `<section id="core-${t}" class="core"><h2>${esc(t)} · ${esc(short(n.name).toUpperCase())}</h2>
<div class="grid2"><div class="panel"><div class="ph">${esc(t)} · ${px(n.price)} · EVERY YARDSTICK TOGETHER</div>
<div class="blend"><div><span>COMPS RANGE · PER SHARE</span><b>${c.no_peer_set ? "no peer set" : px(c.band && c.band.lo) + " · " + px(c.band && c.band.centre) + " · " + px(c.band && c.band.hi)}</b><small>low · centre · high</small></div><div><span>TO THE CENTRE</span><b>${c.no_peer_set ? "—" : sg(c.upside_pct)}</b><small>${n.sets.priced.length} peers price it</small></div></div>
${field(r.comps, n.price)}
<table class="r yard"><thead><tr><th>YARDSTICK</th><th class="n">${esc(t)}</th><th class="n">PEERS' MEDIAN</th><th class="n">PRICE AT THAT</th><th class="n">WEIGHT IN THE BLEND</th></tr></thead><tbody>${yard}</tbody></table>
<div class="steps">${step("AS THE COMPS STAND", n.runs.live.upside_pct)}${step("6 OCT FIXES, FISCAL-YEAR BASIS", n.runs.cp1.upside_pct)}${step("THE ONE BASIS", n.runs.one.upside_pct)}${step("SAME-BUSINESS PEERS", c.upside_pct)}</div>
${three}
<div class="big4" style="margin-top:16px"><div><span>FORWARD P/E</span><b>${esc(n.forward.text)}</b><small>was ${x1(n.forward.fiscal_year.pe)} on the fiscal year${r.was_card != null ? " · " + x1(r.was_card) + " on its card" : ""}</small></div><div><span>EARNINGS GROWTH · TWO WAYS</span><b>${pc(g2)}</b><small>last twelve months, as reported → next four quarters</small><b class="b2">${pc(n.forward.growth_pct)}</b><small>next four quarters → the four after · ${esc(gsit)}</small></div><div><span>P/E ÷ GROWTH</span><b>${x2(n.forward.peg)}</b><small>peers' median ${medOf(n, "peg") != null ? x2(medOf(n, "peg")) : "—"}</small><small>${esc((n.growth_credit_words || "").replace(/^growth credit/, "growth credit"))}</small></div><div><span>NET DEBT ÷ EBITDA</span><b>${own.debt.word === "net cash" ? "net cash" : x1(own.debt.net_debt_ebitda)}</b><small>${esc(own.debt.word === "net cash" ? "more cash than debt" : own.debt.word)}${own.debt.debt_fcf_years != null ? " · debt = " + own.debt.debt_fcf_years + " years of free cash flow" : ""}</small></div></div>
<div class="ph" style="margin-top:14px">WHERE IT SITS · FORWARD P/E <span class="faint">${esc(sit)}</span></div>${peTrack(n)}
<div class="lgd"><span><i class="own"></i>${esc(t)}</span><span><i class="d pr"></i>prices it</span><span><i class="d"></i>shown, not priced</span><span><i class="md"></i>median</span></div>
<div class="fl">${flags}</div>${checks}${chanLine}${legs}</div>
<div class="panel"><div class="ph">${esc(st ? st.line.toUpperCase() : n.sets.rule.toUpperCase())} · ${n.sets.priced.length} PRICE IT · ${n.peers.length - n.sets.priced.length} SHOWN</div>
<table class="r peers"><thead><tr><th>PEER</th><th class="n">PRICES IT</th><th class="n">SOURCES</th><th class="n">FORWARD P/E</th><th class="n">GROWTH</th><th class="n">P/E ÷ GROWTH</th><th class="n">EV / EBITDA</th><th class="n">OP. MARGIN</th><th class="n">NET DEBT ÷ EBITDA</th></tr></thead><tbody>${ownRow}\n${rows}</tbody></table></div></div></section>`; };

/* ---- old against new peer sets ------------------------------------------------------------------------------------------ */
const WHY = { GOOGL: "the other ad giant, the other two clouds, the ad platforms · Netflix, Spotify, Disney shown only", AMZN: "two legs: stores and e-commerce (Alibaba, JD and PDD converted from yuan), and the cloud", AVGO: "chip designers · equipment makers shown only", NVDA: "chip designers · equipment makers and Palantir shown only", TSM: "the two other foundries and the customers it makes chips for", VST: "power sold at market prices · regulated utilities shown only", MU: "memory and storage makers, three of them foreign", ORCL: "the three clouds and enterprise software · security and design-tool names shown only", DLR: "data-centre landlords · towers and malls shown only", EQIX: "data-centre landlords · towers and malls shown only" };
const chips = (list, cls = "") => list.map((p) => `<span class="chip ${cls}">${esc(tk(p))}</span>`).join("");
const sets = `<section id="sets"><h2>PEER SETS · OLD BESIDE NEW</h2><div class="panel"><table class="r sets"><thead><tr><th>NAME</th><th class="w">THE SET AS IT STOOD <span class="faint">bright = still prices it</span></th><th class="w">ADDED</th><th class="w">PRICED ON NOW</th><th class="w">WHY</th><th class="n">SOURCES ON THE NEW ONES</th></tr></thead><tbody>
${CORE.map((t) => { const n = D.core[t], pr = new Set(n.sets.priced), added = n.peers.filter((p) => !p.in_old_set);
  return `<tr>${td("", `<span class="tk">${esc(t)}</span>`)}${td("AS IT STOOD", n.sets.old.map((p) => `<span class="chip ${pr.has(p) ? "" : "off"}">${esc(tk(p))}</span>`).join(""), "w")}${td("ADDED", added.length ? chips(added.map((p) => p.ticker), "add") : '<span class="dim">none</span>', "w")}${td("PRICED ON", chips(n.sets.priced), "w")}${td("WHY", `<span class="small">${esc(WHY[t] || n.sets.rule)}</span>`, "w")}${td("SOURCES", added.length ? added.map((p) => `<span class="vrow">${esc(tk(p.ticker))} ${votes(p.votes ? p.votes.n : 0)}</span>`).join("") : "", "n")}</tr>`; }).join("\n")}
</tbody></table></div></section>`;

/* ---- debt ------------------------------------------------------------------------------------------------------------------ */
const DMAX = 8, dbar = (d) => (d.word === "net cash" ? '<div class="trk db"><span class="nc">net cash</span></div>' : d.net_debt_ebitda == null ? `<div class="trk db"><span class="nc dim">${esc(d.word || "—")}</span></div>` : `<div class="trk db"><span class="bar${d.points > 0 ? " hv" : ""}" style="width:${Math.min(100, (d.net_debt_ebitda / DMAX) * 100).toFixed(1)}%"></span>${[2.5, 4, 6].map((v) => `<u style="left:${(v / DMAX) * 100}%"></u>`).join("")}</div>`);
const cardRows = Object.values(CARDS).sort((a, b) => ((b.debt.net_debt_ebitda ?? -99) - (a.debt.net_debt_ebitda ?? -99)));
const debt = `<section id="debt"><h2>DEBT ON EVERY CARD</h2><div class="grid2"><div class="panel"><div class="ph">NET DEBT ÷ EBITDA · 27 CARDS <span class="faint">marks at 2.5×, 4× and 6×</span></div><table class="r debt"><thead><tr><th>NAME</th><th class="w">NET DEBT ÷ EBITDA</th><th class="n">READING</th><th class="n">DEBT ÷ FREE CASH FLOW</th><th class="n">INTEREST COVER</th><th class="n">OFF IN A DEBATE</th></tr></thead><tbody>
${cardRows.map((c) => `<tr>${td("", `<span class="tk">${esc(c.ticker)}</span>`)}${td("NET DEBT ÷ EBITDA", dbar(c.debt), "w")}${td("READING", c.debt.net_debt_ebitda == null || c.debt.word === "net cash" ? `<span class="dim">${esc(c.debt.word)}</span>` : `<b>${x1(c.debt.net_debt_ebitda)}</b> <span class="dim">${esc(c.debt.word)}</span>`, "n")}${td("DEBT ÷ FCF", c.debt.debt_fcf_years == null ? '<span class="dim">—</span>' : c.debt.debt_fcf_years + " yrs", "n")}${td("INTEREST COVER", '<span class="dim">not on file</span>', "n")}${td("OFF IN A DEBATE", c.debt.points > 0 ? `<b>${c.debt.points.toFixed(2)}</b>` : '<span class="dim">0</span>', "n")}</tr>`).join("\n")}
</tbody></table></div>
<div class="panel"><div class="ph">THE KNOCKOUT'S DEBATE · ${K.debt_moved.length} BRANCHES REORDERED · ${K.penalised.length} NAMES LOSE POINTS</div><table class="r dm"><thead><tr><th>BRANCH</th><th class="w">FINALISTS BEFORE</th><th class="w">FINALISTS WITH DEBT</th><th class="w">WHO LOST POINTS</th></tr></thead><tbody>
${K.debt_moved.map((b) => `<tr>${td("", `<span class="small">${esc(b.branch)}</span>`)}${td("BEFORE", chips(b.order_before), "w")}${td("WITH DEBT", chips(b.order_after), "w")}${td("LOST POINTS", Object.entries(b.penalties).map(([t, p]) => `<span class="vrow"><span class="tk">${esc(t)}</span> <span class="dim">${esc(p.words.replace(/: [\d.]+ off in the debate/, ""))}</span> −${p.points.toFixed(2)}</span>`).join(""), "w")}</tr>`).join("\n")}
</tbody></table></div></div></section>`;

/* ---- the knockout re-run -------------------------------------------------------------------------------------------------- */
const cause = (c) => [c.by_basis ? "the basis" : null, c.by_sets ? "the peer sets" : null, c.by_debt ? "debt" : null].filter(Boolean).join(" + ") || "today's tables";
const fn = K.funnel, yn = (v) => (v == null ? '<span class="dim">not judged</span>' : v ? "passes" : '<span class="dim">fails</span>');
const knock = `<section id="knockout"><h2>THE KNOCKOUT ON THE ONE BASIS</h2><div class="kpis">
${kpi(`${K.reproduced.same_champions} of ${K.reproduced.of}`, "PUBLISHED CHAMPIONS REPRODUCED ON THE OLD BASIS FIRST")}${kpi(`${K.moved_20}`, "READINGS MOVE MORE THAN TWENTY POINTS ON THE BASIS ALONE")}${kpi(`${K.priced_on_business.before} → ${K.priced_on_business.now}`, "COMPANIES PRICED ON SAME-BUSINESS PEERS")}${kpi(`${K.pass_flips.length}`, "NAMES CHANGE SIDE IN THE FUNDAMENTALS ROUND")}</div>
<div class="grid2"><div class="panel"><div class="ph">CHAMPIONS THAT CHANGE · ${K.champions_changed.length}</div><table class="r ch"><thead><tr><th>BRANCH</th><th class="n">WAS</th><th class="n">NOW</th><th>WHAT MOVED IT</th><th class="w">FINALISTS NOW</th></tr></thead><tbody>
${K.champions_changed.map((c) => `<tr>${td("", `<span class="small">${esc(c.branch)}</span>`)}${td("WAS", `<span class="tk dim">${esc(c.was || "—")}</span>`, "n")}${td("NOW", `<span class="tk">${esc(c.now || "—")}</span>`, "n")}${td("WHAT MOVED IT", `<span class="small">${esc(cause(c))}</span>`)}${td("FINALISTS NOW", chips(c.finalists_now), "w")}</tr>`).join("\n")}
</tbody></table></div>
<div class="panel"><div class="ph">THE RADAR LIST · COMPS READING AND THE FUNDAMENTALS ROUND</div><table class="r rad"><thead><tr><th>NAME</th><th class="n">FORWARD P/E</th><th class="n">COMPS WAS</th><th class="n">COMPS NOW</th><th class="n">ROUND WAS</th><th class="n">ROUND NOW</th><th class="n">NET DEBT ÷ EBITDA</th></tr></thead><tbody>
${K.radar.filter((r) => r.comps_was != null || r.comps_now != null || r.passes_now != null).map((r) => `<tr>${td("", `<span class="tk">${esc(r.ticker)}</span>`)}${td("FORWARD P/E", x1(r.pe_fwd), "n")}${td("COMPS WAS", sg(r.comps_was), "n")}${td("COMPS NOW", sg(r.comps_now), "n")}${td("ROUND WAS", yn(r.passes_was), "n")}${td("ROUND NOW", r.passes_was !== r.passes_now ? `<b>${yn(r.passes_now)}</b>` : yn(r.passes_now), "n")}${td("NET DEBT ÷ EBITDA", r.debt == null ? '<span class="dim">—</span>' : r.debt <= 0 ? '<span class="dim">net cash</span>' : x1(r.debt), "n")}</tr>`).join("\n")}
</tbody></table></div></div></section>`;

/* ---- the rows the rule flags ------------------------------------------------------------------------------------------------ */
const R = D.dry_run, C = R.counts;
const flagsSec = `<section id="flags"><h2>ESTIMATE ROWS THE RULE FLAGS · A REPORT, NOTHING WRITTEN</h2><div class="kpis">
${kpi(C.zero_rows, "ESTIMATES OF EXACTLY ZERO")}${kpi(`${C.years_that_do_not_add_up}`, `YEARS WHOSE QUARTERS DO NOT ADD UP · ${C.companies_with_such_a_year} COMPANIES`)}${kpi(C.next_four_touched, "COMPANIES WHERE THE NEXT FOUR QUARTERS ARE TOUCHED")}${kpi(C.on_fiscal_year, "COMPANIES ON THE FISCAL-YEAR FALLBACK")}${kpi(`${C.foreign - C.foreign_withheld} of ${C.foreign}`, "FOREIGN REPORTERS CONVERTED · THE REST WITHHELD")}${kpi(C.reits, "PROPERTY TRUSTS ON EARNINGS, NOT FFO")}</div>
<div class="grid2"><div class="panel"><div class="ph">YEARS THAT DO NOT ADD UP · THE WIDEST</div><table class="r"><thead><tr><th>NAME</th><th class="n">YEAR TO</th><th class="n">QUARTERS ADD TO</th><th class="n">THE YEAR'S OWN</th><th class="n">IN THE NEXT FOUR?</th></tr></thead><tbody>
${[...R.worst_years.filter((r) => r.ticker !== "AMZN").slice(0, 11), ...R.worst_years.filter((r) => r.ticker === "AMZN").slice(0, 1), { ticker: "AMZN", year: "2028-12-31", quarters_add_to: 23.38, year_estimate: 13.86, in_next_four: false, pin: true }].filter((r, i, a) => a.findIndex((x) => x.ticker === r.ticker && x.year === r.year) === i).slice(0, 12).map((r) => `<tr>${td("", `<span class="tk">${esc(r.ticker)}</span>`)}${td("YEAR TO", esc(r.year), "n")}${td("QUARTERS ADD TO", x2(r.quarters_add_to), "n")}${td("THE YEAR'S OWN", x2(r.year_estimate), "n")}${td("IN THE NEXT FOUR?", r.in_next_four ? "<b>yes</b>" : '<span class="dim">no</span>', "n")}</tr>`).join("\n")}
</tbody></table></div>
<div class="panel"><div class="ph">ESTIMATES IN ANOTHER CURRENCY</div><table class="r"><thead><tr><th>NAME</th><th class="n">CURRENCY</th><th class="n">RATE TO DOLLARS</th><th class="n">PRINTS</th></tr></thead><tbody>
${R.foreign.sort((a, b) => a.ticker.localeCompare(b.ticker)).map((r) => `<tr>${td("", `<span class="tk">${esc(r.ticker)}</span>`)}${td("CURRENCY", esc(r.currency), "n")}${td("RATE", r.rate == null ? '<span class="dim">no agreeing rate</span>' : String(r.rate), "n")}${td("PRINTS", `<b>${esc(r.prints)}</b>`, "n")}</tr>`).join("\n")}
</tbody></table>
<div class="ph" style="margin-top:14px">ON THE FISCAL-YEAR FALLBACK</div><div>${R.on_fiscal_year.map((r) => `<span class="chip">${esc(r.ticker)}</span>`).join("")}</div>
<div class="ph" style="margin-top:14px">NEXT FOUR QUARTERS TOUCHED</div><div>${R.next_four_touched.map((r) => `<span class="chip" title="${esc(r.why)}">${esc(r.ticker)}</span>`).join("")}</div></div></div></section>`;

/* ---- in the allocation tool -------------------------------------------------------------------------------------------------- */
const toolShots = existsSync(ROOT + "/shots") ? readdirSync(ROOT + "/shots").filter((f) => /^tool-\d+-.*\.png$/.test(f)).sort() : [];
const cap = (f) => f.replace(/^tool-\d+-\d+-/, "").replace(/\.png$/, "").replace(/-/g, " ").toUpperCase();
const tool = toolShots.length ? `<section id="tool"><h2>IN THE ALLOCATION TOOL · ON ITS BRANCH</h2><div class="grid2">${toolShots.filter((f) => f.startsWith("tool-1680")).map((f) => `<div class="panel"><div class="ph">${esc(cap(f))} · 1680</div><img src="shots/${esc(f)}" alt="${esc(cap(f))}" loading="lazy"></div>`).join("")}</div><div class="grid3">${toolShots.filter((f) => f.startsWith("tool-390")).map((f) => `<div class="panel"><div class="ph">${esc(cap(f))} · PHONE</div><img src="shots/${esc(f)}" alt="${esc(cap(f))}" loading="lazy"></div>`).join("")}</div></section>` : "";

const CSS = readFileSync(HERE + "/page.css", "utf8"), SPECS = readFileSync(HERE + "/page-specs.fragment", "utf8")
  .replace(/\{\{(\w+)\}\}/g, (_, k) => ({ agree: `${D.test30_agree} of ${D.test30.length}`, moved5: K.moved_5, moved20: K.moved_20, priced: K.priced_both, zero: C.zero_rows, years: C.years_that_do_not_add_up, yearsCo: C.companies_with_such_a_year, touched: C.next_four_touched, fallback: R.on_fiscal_year.map((r) => r.ticker).join(", "), champs: K.champions_changed.length, branches: K.reproduced.of, debtMoved: K.debt_moved.length, penalised: K.penalised.length, built: D.built_utc.slice(0, 16).replace("T", " ") + " UTC", estRead: (D.tables.analyst_estimates.read_utc || "").slice(0, 16).replace("T", " ") + " UTC", refTaken: (D.reference.taken || "").slice(0, 16).replace("T", " ") + " UTC", muLive: pc(mu.runs.live.upside_pct), muNow: pc(mu.runs.cp3.upside_pct), flips: K.pass_flips.length }[k] ?? "{{" + k + "}}"));
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>One forward P/E everywhere · 7 Oct 2026 · Scintilla</title><style>${CSS}</style></head><body>
<header class="top"><div data-scnav-slot></div><div class="ttl">ONE FORWARD P/E</div><div class="sub">7 OCT 2026 · PRICES: THE 6 OCT CLOSE · A PROPOSAL ON A BRANCH — NOTHING HERE IS LIVE</div></header>
${first}
${table30}
${leaders}
${CORE.map(coreBlock).join("\n")}
${sets}
${debt}
${knock}
${flagsSec}
${tool}
${SPECS}
</body></html>`;
/* the BACK / CLOSE pair, carried by the builder exactly as scripts/inject-scnav.py places it (so that script finds it already there) */
const scnav = readFileSync(path.resolve(ROOT, "../../../scripts/scnav-snippet.html"), "utf8").trim();
writeFileSync(ROOT + "/ONE-BASIS.html", html.replace("</body>", scnav + "\n</body>"));
console.log("ONE-BASIS.html", html.length, "bytes ·", CORE.length, "core panels ·", toolShots.length, "tool pictures");

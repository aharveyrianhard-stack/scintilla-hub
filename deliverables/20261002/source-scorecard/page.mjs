/* C5 · SOURCE-SCORECARD.html, written for Alan's eyes: pictures first, plain words, every number from scorecard-2026-10-02.json.
   Static page: no fetch, no script, no key. Monochrome (greys whose channels are equal, none above 210); no colour. */
import { SOURCES, PAIRS, pairKey } from "./scorecard.mjs";

const WORDS = { FMP: "FMP's peer list", MASSIVE: "Massive's related companies", INDUSTRY: "the same industry (the authority)", FUND: "a shared industry fund" };
const SHORT = { FMP: "FMP list", MASSIVE: "Massive related", INDUSTRY: "same industry", FUND: "shared fund" };
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pc = (x, d = 0) => (x == null ? "—" : (x * 100).toFixed(d) + "%");
const n = (x) => (x == null ? "—" : Number(x).toLocaleString("en-US"));
const f1 = (x) => (x == null ? "—" : Number(x).toFixed(1));
const money = (v) => v == null ? "—" : v >= 1e12 ? "$" + (v / 1e12).toFixed(2) + " T" : v >= 1e9 ? "$" + (v / 1e9).toFixed(0) + " B" : "$" + (v / 1e6).toFixed(0) + " M";
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const CSS = `
:root{color-scheme:dark;--bg:#0e0e0e;--panel:#141414;--line:#2a2a2a;--line2:#383838;--ink:#cfcfcf;--ink2:#acacac;--dim:#8c8c8c;--mute:#6c6c6c;--mono:"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace}
*{box-sizing:border-box;min-width:0}html,body{margin:0;background:var(--bg);color:var(--ink2)}
body{font-family:var(--mono);font-size:13px;line-height:1.6;letter-spacing:.02em;-webkit-font-smoothing:antialiased}
.wrap{max-width:1240px;margin:0 auto;padding:0 20px 90px;overflow-x:hidden}
.top{padding:18px 0 12px;border-bottom:1px solid var(--line);display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.brand{font:400 12px/1.4 var(--mono);letter-spacing:.2em;color:var(--dim)}.brand b{color:var(--ink);font-weight:600}
.stamp{margin-left:auto;font:400 11px/1.5 var(--mono);color:var(--dim);letter-spacing:.06em;text-align:right}
.mark{display:inline-block;border:1px solid var(--line2);padding:1px 8px;font-size:10px;letter-spacing:.2em;color:var(--ink);margin-left:8px;vertical-align:middle}
h1{font:600 15px/1.4 var(--mono);letter-spacing:.24em;color:var(--ink);margin:26px 0 6px;text-transform:uppercase}
h2{font:600 12px/1.4 var(--mono);letter-spacing:.22em;color:var(--ink);margin:36px 0 8px;text-transform:uppercase;border-bottom:1px solid var(--line);padding-bottom:6px}
h2 small{font-weight:400;letter-spacing:.06em;color:var(--dim);text-transform:none;margin-left:10px;font-size:12px}
h3{font:600 12px/1.4 var(--mono);letter-spacing:.14em;color:var(--ink);margin:22px 0 6px;text-transform:uppercase}
.panel{border:1px solid var(--line);background:var(--panel);margin:10px 0}
.words{padding:12px 16px 14px;font-size:12.5px;line-height:1.7}.words b{color:var(--ink);font-weight:600}.words a{color:var(--ink)}
.words ul,.words ol{margin:4px 0 8px;padding-left:22px}.words li{margin:5px 0}.words li::marker{color:var(--mute)}
.words q{quotes:"\\201C" "\\201D";color:var(--ink)}code{font-size:12px;color:var(--ink)}
.lead{font-size:13.5px;color:var(--ink);max-width:1000px}
.tiles{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}.tile{border:1px solid var(--line);background:var(--panel);padding:8px 14px;min-width:120px;flex:1 1 150px}
.tile b{display:block;font-size:22px;color:var(--ink);font-variant-numeric:tabular-nums;font-weight:600}.tile span{font-size:10px;color:var(--dim);letter-spacing:.12em;text-transform:uppercase}
table.t{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}
table.t th,table.t td{padding:5px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
table.t th{font:400 10px/1.4 var(--mono);letter-spacing:.14em;color:var(--mute);text-transform:uppercase;white-space:nowrap}
table.t td{color:var(--ink2)}table.t td.k,table.t th.k{color:var(--ink)}table.t td.r,table.t th.r{text-align:right;white-space:nowrap}
table.t tr.thin td{color:var(--dim)}table.t tr.hi td{color:var(--ink)}
.tw{overflow-x:auto;padding:0 16px 10px}
.bars{display:grid;grid-template-columns:max-content minmax(120px,1fr) max-content;gap:7px 12px;align-items:center;padding:10px 16px 14px;font-size:12px}
.bars .l{color:var(--ink);white-space:nowrap}.bars .v{color:var(--ink2);text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.bars .bar{height:12px;background:#1a1a1a;border:1px solid var(--line)}.bars .bar i{display:block;height:100%;background:#8c8c8c}.bars .bar i.hi{background:#cfcfcf}.bars .bar i.lo{background:#4e4e4e}
.bars .cap{grid-column:1/-1;font-size:11px;color:var(--dim);padding-top:2px}
.names{padding:0 16px 12px;font-size:12px;line-height:2}.names .nm{display:inline-block;border:1px solid var(--line);padding:0 7px;margin:0 4px 4px 0;white-space:nowrap}
.names .kept{color:var(--ink);border-color:var(--ink2);font-weight:600}.names .pass{color:var(--ink2)}.names .out{color:var(--dim)}.names .none{color:var(--mute);border-style:dashed}
.names small{font-size:10px;color:var(--mute);letter-spacing:.04em}
.shot{padding:12px 16px 14px}.shot img{display:block;width:100%;height:auto;border:1px solid var(--line2)}
.shot .clip{max-height:900px;overflow:hidden;border:1px solid var(--line2)}.shot .clip img{border:0}.shot .clip.phone{width:390px;max-width:100%}
.shot small{display:block;margin-top:6px;font-size:11px;color:var(--dim)}
.two{display:grid;grid-template-columns:1fr 1fr;gap:0}.two > div + div{border-left:1px solid var(--line)}
.toc{columns:2;column-gap:30px;font-size:12px;padding:10px 16px}.toc a{color:var(--ink2);text-decoration:none;display:block;padding:2px 0}.toc a:hover{color:var(--ink)}
@media(max-width:760px){.wrap{padding:0 12px 60px}.two{grid-template-columns:1fr}.two > div + div{border-left:0;border-top:1px solid var(--line)}.stamp{margin-left:0;text-align:left}.toc{columns:1}table.t{min-width:720px}.tiles .tile{min-width:92px}.bars{grid-template-columns:max-content 1fr;gap:4px 8px;padding:10px 12px}.bars .l{font-size:11px}.bars .v{grid-column:1/-1;text-align:left;white-space:normal;font-size:11px;color:var(--dim);margin:-2px 0 6px;line-height:1.4}.bars .cap{padding-top:0}}
`;

/** A picture: one bar per row. rows: [{ label, value (0..1 or any), text, cls }], max: the full-width value. */
function bars(rows, { max = 1, caption = null } = {}) {
  const top = max || Math.max(...rows.map((r) => r.value || 0)) || 1;
  return `<div class="bars">${rows.map((r) => `<div class="l">${esc(r.label)}</div><div class="bar"><i class="${r.cls || ""}" style="width:${Math.max(0, Math.min(100, ((r.value || 0) / top) * 100)).toFixed(1)}%"></i></div><div class="v">${esc(r.text)}</div>`).join("")}${caption ? `<div class="cap">${esc(caption)}</div>` : ""}</div>`;
}
const hiLo = (vals) => { const mx = Math.max(...vals), mn = Math.min(...vals); return (v) => (v === mx ? "hi" : v === mn ? "lo" : ""); };

export function pageHTML(SC, { shotExists = () => false } = {}) {
  const M = SC.measures, P = M.precision, AG = M.agreement, R = M.reach, PR = M.provenance, AU = M.authority, BI = M.by_industry, V = SC.verdict, U = SC.universe;
  const shot = (f, capt, { phone = false, clip = true } = {}) => shotExists(f) ? `<div class="shot"><div class="clip${phone ? " phone" : ""}"${clip ? "" : ' style="max-height:none"'}><img src="shots/${f}" alt="${esc(capt)}"></div><small>${esc(capt)} — shots/${f}</small></div>` : `<div class="shot"><small>(shot not taken yet) ${esc(capt)}</small></div>`;

  /* 1 · the scorecard */
  const keptServed = SOURCES.map((S) => P[S].kept_of_served);
  const cls1 = hiLo(keptServed);
  const scoreTable = `<div class="tw"><table class="t"><tr><th>source</th><th class="r">companies covered</th><th class="r">names offered per company</th><th class="r">of them with figures</th><th class="r">pass the cuts</th><th class="r">kept share</th><th class="r">agreement with the others</th></tr>${SOURCES.map((S) => `<tr><td class="k">${WORDS[S]}</td><td class="r">${R[S].covered} of ${R[S].companies}</td><td class="r">${f1(R[S].mean_offered)}</td><td class="r">${f1(R[S].mean_served)}</td><td class="r">${pc(P[S].eligible_of_served)}</td><td class="r"><b>${pc(P[S].kept_of_served)}</b></td><td class="r">${pc(M.per_source[S].corroborated_share)}</td></tr>`).join("")}</table></div>`;
  const pic1 = bars(SOURCES.map((S) => ({ label: SHORT[S], value: P[S].kept_of_served, text: `${pc(P[S].kept_of_served)} kept · ${n(P[S].kept)} of ${n(P[S].served)} names with figures`, cls: cls1(P[S].kept_of_served) })), { caption: "Of the names a source offers that have figures on the Hub, the share that ends in the kept ten. Pooled over all " + n(U.with_set) + " companies with a comp set." });
  const pic1b = bars(SOURCES.map((S) => ({ label: SHORT[S], value: P[S].kept_of_offered, text: `${pc(P[S].kept_of_offered)} of everything offered (${n(P[S].offered)} names)` })), { caption: "The same, counting every name offered — including the ones with no figures on the Hub, which can never be kept. This is the honest cost of a list that reaches outside the Hub." });

  /* 2 · agreement */
  const pairRows = PAIRS.map(([a, b]) => AG[pairKey(a, b)]);
  const pic2 = bars(pairRows.map((p) => ({ label: `${SHORT[p.a]} × ${SHORT[p.b]}`, value: p.pooled_jaccard, text: `${pc(p.pooled_jaccard)} overlap · same names ${pc(p.mean_jaccard)} on a typical company` })), { max: Math.max(...pairRows.map((p) => p.pooled_jaccard)) * 1.15, caption: "Overlap = of all the names either source offers (with figures), the share both offer. Pooled over the companies both sources cover." });
  const pic2b = bars(pairRows.map((p) => ({ label: `${SHORT[p.a]} × ${SHORT[p.b]}`, value: p.kept_of_named_by_both, text: `${pc(p.kept_of_named_by_both)} kept · ${n(p.named_by_both_kept)} of ${n(p.named_by_both)} names both offer`, cls: hiLo(pairRows.map((x) => x.kept_of_named_by_both))(p.kept_of_named_by_both) })), { caption: "When two sources name the same company, how often it ends in the kept ten." });
  const pairTable = `<div class="tw"><table class="t"><tr><th>pair</th><th class="r">companies both cover</th><th class="r">overlap, pooled</th><th class="r">overlap, typical company</th><th class="r">names both offer</th><th class="r">of them kept</th></tr>${pairRows.map((p) => `<tr><td class="k">${WORDS[p.a]} × ${WORDS[p.b]}</td><td class="r">${p.companies_both}</td><td class="r">${pc(p.pooled_jaccard)}</td><td class="r">${pc(p.median_jaccard)} median · ${pc(p.mean_jaccard)} mean</td><td class="r">${n(p.named_by_both)}</td><td class="r"><b>${pc(p.kept_of_named_by_both)}</b></td></tr>`).join("")}</table></div>`;

  /* 3 · reach */
  const pic3 = bars(SOURCES.map((S) => ({ label: SHORT[S], value: R[S].covered / R[S].companies, text: `${R[S].covered} of ${R[S].companies} companies · empty for ${R[S].empty}` })), { caption: "Companies for which the source offers at least one name." });
  const pic3b = bars(SOURCES.map((S) => ({ label: SHORT[S], value: R[S].mean_offered, text: `${f1(R[S].mean_offered)} names per company · ${f1(R[S].mean_served)} with figures` })), { max: Math.max(...SOURCES.map((S) => R[S].mean_offered)) * 1.1, caption: "How many names each source offers for a company, on average (all companies, empties counted as zero)." });
  const reachTable = `<div class="tw"><table class="t"><tr><th>source</th><th class="r">companies covered</th><th class="r">empty for</th><th class="r">names per company</th><th class="r">with figures</th><th class="r">when it has names</th><th>served funds</th></tr>${SOURCES.map((S) => `<tr><td class="k">${WORDS[S]}</td><td class="r">${R[S].covered} of ${R[S].companies}</td><td class="r">${R[S].empty}${R[S].empty && R[S].empty <= 3 ? " (" + R[S].empty_names.join(", ") + ")" : ""}</td><td class="r">${f1(R[S].mean_offered)}</td><td class="r">${f1(R[S].mean_served)}</td><td class="r">${f1(R[S].mean_offered_when_covered)}</td><td>${R[S].funds.note ? R[S].funds.note : `${R[S].funds.covered} of ${R[S].funds.count} covered, ${R[S].funds.empty} empty`}</td></tr>`).join("")}</table></div>`;
  const massiveEmpty = R.MASSIVE.empty_names;

  /* 4 · provenance */
  const bv = PR.by_votes, bs = PR.by_source;
  const pic4 = bars([4, 3, 2, 1].map((v) => ({ label: v === 1 ? "1 source names it" : `${v} sources agree`, value: bv[v].kept_share, text: `${pc(bv[v].kept_share)} kept · ${n(bv[v].kept)} of ${n(bv[v].served_candidates)} such names`, cls: v === 4 ? "hi" : v === 1 ? "lo" : "" })), { caption: "The rings of the cone, Hub-wide: of the served names on each ring, the share that ends in the kept ten." });
  const pic4b = bars([4, 3, 2, 1].map((v) => ({ label: v === 1 ? "1 source names it" : `${v} sources agree`, value: bv[v].share_of_kept, text: `${pc(bv[v].share_of_kept)} of all kept names · ${n(bv[v].kept)}` })), { caption: "Read the other way: of the " + n(PR.kept_total) + " kept names across the Hub, how many came from each ring." });
  const pic4c = bars(SOURCES.map((S) => ({ label: SHORT[S], value: bs[S].share_of_kept, text: `names ${pc(bs[S].share_of_kept)} of the kept · found alone ${n(bs[S].found_alone)}`, cls: S === "INDUSTRY" ? "hi" : "" })), { caption: "Which source names the kept ten. 'Found alone' = kept names only this source offered; without it they would not exist as candidates." });
  const provTable = `<div class="tw"><table class="t"><tr><th>ring</th><th class="r">served names on it</th><th class="r">kept</th><th class="r">kept share</th><th class="r">share of all kept</th></tr>${[4, 3, 2, 1].map((v) => `<tr><td class="k">${v === 1 ? "1 source names it" : v + " sources agree"}</td><td class="r">${n(bv[v].served_candidates)}</td><td class="r">${n(bv[v].kept)}</td><td class="r"><b>${pc(bv[v].kept_share)}</b></td><td class="r">${pc(bv[v].share_of_kept)}</td></tr>`).join("")}<tr><td class="k">all rings</td><td class="r">${n([1, 2, 3, 4].reduce((s, v) => s + bv[v].served_candidates, 0))}</td><td class="r">${n(PR.kept_total)}</td><td class="r">${pc(PR.kept_total / [1, 2, 3, 4].reduce((s, v) => s + bv[v].served_candidates, 0))}</td><td class="r">100%</td></tr></table></div>`;

  /* 5 · authority */
  const pic5 = bars(SOURCES.map((S) => ({ label: SHORT[S], value: AU[S].outside_share, text: `${pc(AU[S].outside_share)} in another industry · ${n(AU[S].outside_industry)} of ${n(AU[S].served_with_industry)} names with figures`, cls: hiLo(SOURCES.map((X) => AU[X].outside_share))(AU[S].outside_share) === "hi" ? "lo" : "" })), { caption: "Of the names a source offers with figures on the Hub, the share whose industry is not the company's own (by the authority: FMP industry, or the same SIC). The industry cut removes exactly these." });
  const pic5b = bars(["FMP", "MASSIVE"].map((S) => ({ label: SHORT[S], value: AU[S].unserved_share, text: `${pc(AU[S].unserved_share)} with no figures on the Hub · ${n(AU[S].unserved)} of ${n(AU[S].offered)} names` })), { caption: "The two provider lists also reach outside the Hub: these names have no figures here, so they drop before any cut. (The industry and fund sources only ever offer served names.)" });
  const authTable = `<div class="tw"><table class="t"><tr><th>source</th><th class="r">names offered</th><th class="r">no figures on the Hub</th><th class="r">with figures</th><th class="r">in another industry</th><th class="r">share</th><th class="r">companies with at least one</th></tr>${SOURCES.map((S) => `<tr><td class="k">${WORDS[S]}</td><td class="r">${n(AU[S].offered)}</td><td class="r">${n(AU[S].unserved)} (${pc(AU[S].unserved_share)})</td><td class="r">${n(AU[S].served_with_industry)}</td><td class="r">${n(AU[S].outside_industry)}</td><td class="r"><b>${pc(AU[S].outside_share)}</b></td><td class="r">${AU[S].companies_with_an_outsider} of ${U.with_set}</td></tr>`).join("")}</table></div>`;

  /* 6 · by industry */
  const thin = BI.filter((g) => g.thin);
  const indTable = `<div class="tw"><table class="t"><tr><th>FMP industry</th><th class="r">companies</th><th class="r">served in it</th><th class="r">kept per company</th><th class="r">band widened</th><th class="r">FMP list kept</th><th class="r">Massive kept</th><th class="r">same industry kept</th><th class="r">shared fund kept</th><th class="r">Massive empty</th></tr>${BI.map((g) => `<tr class="${g.thin ? "thin" : ""}"><td class="k">${esc(g.industry)}${g.thin ? ' <span style="color:var(--mute);font-size:10px;letter-spacing:.12em">THIN</span>' : ""}</td><td class="r">${g.companies}</td><td class="r">${g.served_in_industry}</td><td class="r">${g.mean_kept.toFixed(1)}</td><td class="r">${g.band_widened || "—"}</td><td class="r">${pc(g.sources.FMP.kept_of_served)}</td><td class="r">${pc(g.sources.MASSIVE.kept_of_served)}</td><td class="r">${pc(g.sources.INDUSTRY.kept_of_served)}</td><td class="r">${pc(g.sources.FUND.kept_of_served)}</td><td class="r">${g.sources.MASSIVE.empty || "—"}</td></tr>`).join("")}</table></div>`;
  const top12 = BI.slice(0, 12);
  const pic6 = bars(top12.map((g) => ({ label: `${g.industry.length > 30 ? g.industry.slice(0, 29) + "…" : g.industry} (${g.companies})`, value: g.sources.FMP.kept_of_served, text: `FMP list ${pc(g.sources.FMP.kept_of_served)} · Massive ${pc(g.sources.MASSIVE.kept_of_served)} · industry ${pc(g.sources.INDUSTRY.kept_of_served)} · fund ${pc(g.sources.FUND.kept_of_served)}` })), { caption: "The twelve deepest industries on the Hub: the bar is FMP's kept share inside that industry; the text carries all four. A deep industry (many served names) lets the industry source offer far more than ten, which lowers its kept share by arithmetic, not by quality." });
  const thinKept = thin.length ? thin.reduce((s, g) => s + g.kept_total, 0) / thin.reduce((s, g) => s + g.companies, 0) : null;
  const deepKept = BI.filter((g) => !g.thin).length ? BI.filter((g) => !g.thin).reduce((s, g) => s + g.kept_total, 0) / BI.filter((g) => !g.thin).reduce((s, g) => s + g.companies, 0) : null;

  /* 7 · worked */
  const worked = (T) => {
    const c = SC.worked[T]; if (!c) return "";
    const chip = (s) => { const x = c.names[s] || {}; const cls = x.kept ? "kept" : !x.served ? "none" : x.outside ? "out" : x.eligible ? "pass" : "pass"; const why = x.kept ? `#${x.rank} · ${x.votes} vote${x.votes > 1 ? "s" : ""}` : !x.served ? "no figures on the Hub" : x.outside ? (x.industry || "other industry") : x.eligible ? "passes, beyond the nearest ten" : "same industry, outside the band"; return `<span class="nm ${cls}">${s} <small>${esc(why)}</small></span>`; };
    const srcTable = `<div class="tw"><table class="t"><tr><th>source</th><th class="r">offers</th><th class="r">with figures</th><th class="r">pass the cuts</th><th class="r">kept</th><th class="r">kept share</th><th class="r">in another industry</th></tr>${SOURCES.map((S) => { const s = c.sources[S]; return `<tr><td class="k">${WORDS[S]}</td><td class="r">${s.offered}</td><td class="r">${s.served}</td><td class="r">${s.eligible}</td><td class="r">${s.kept}</td><td class="r"><b>${pc(s.served ? s.kept / s.served : null)}</b></td><td class="r">${s.outside_industry}</td></tr>`; }).join("")}</table></div>`;
    const pairs = PAIRS.map(([a, b]) => c.pairs[pairKey(a, b)]).map((p, i) => `${SHORT[PAIRS[i][0]]} × ${SHORT[PAIRS[i][1]]} ${p.jaccard == null ? "—" : pc(p.jaccard)}`).join(" · ");
    return `<h3>${T} · ${esc(c.name)}</h3><div class="panel"><div class="words"><b>The record says:</b> industry <b>${esc(c.industry)}</b>, SIC <b>${c.sic || "none"}</b>, market value <b>${money(c.market_cap)}</b>, industry funds <b>${c.my_funds.join(", ") || "none"}</b>. Candidates ${c.counts.candidates} → with figures ${c.counts.served} → same industry ${c.counts.same_industry} → inside the band ${c.band_used}${c.band_widened ? " (widened)" : ""} ${c.counts.in_band} → <b>kept ${c.counts.kept}</b>: ${c.kept.map((k) => `${k.ticker} (${k.votes})`).join(", ")}.<br><b>Overlap between the sources for ${T}:</b> ${pairs}.</div>${srcTable}${SOURCES.map((S) => `<div class="words" style="padding-bottom:2px"><b>${cap(WORDS[S])}</b> offers ${c.sources[S].offered} name${c.sources[S].offered === 1 ? "" : "s"}${c.sources[S].offered ? ":" : "."}</div><div class="names">${c.sources[S].names.slice(0, 60).map(chip).join("")}${c.sources[S].names.length > 60 ? `<span class="nm out">… and ${c.sources[S].names.length - 60} more</span>` : ""}</div>`).join("")}<div class="words" style="padding-top:0;font-size:11.5px;color:var(--dim)">bright = kept (rank · votes) · plain = passes the cuts or same industry outside the band · dim = another industry (named) · dashed = no figures on the Hub.</div></div>`;
  };

  /* the page */
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Source Scorecard</title><style>${CSS}</style></head><body><div class="wrap">
<div class="top"><div data-scnav-slot></div><div class="brand"><b>SCINTILLA</b> · COMPS · THE SOURCE SCORECARD <span class="mark">MEASURED</span></div><div class="stamp">the four comp-set sources on every served company · read-only · snapshots of ${SC.as_of.peer_sources} (lists), ${SC.as_of.ticker_industry} (industry), ${SC.as_of.company_profile} (market value) · built ${SC.built_utc.slice(0, 16).replace("T", " ")}Z</div></div>

<h1>Which comp-set source is better?</h1>
<div class="words lead">Alan, 2 Oct: <q>I read it: one source, two, three, four. Is there any gauge of which sources are better — which get to the same things, better or worse?</q> This page is that gauge. The four sources that feed a comp set were measured on all <b>${n(U.with_set)}</b> served companies that have a comp set, against the ten names the rule keeps. Nothing was changed: not the rule, not a table, not the tree.</div>
<div class="words lead"><b>The answer.</b> ${esc(V.sentence)}</div>
<div class="tiles"><div class="tile"><b>${n(U.companies)}</b><span>served companies</span></div><div class="tile"><b>${n(U.with_set)}</b><span>with a comp set</span></div><div class="tile"><b>${n(PR.kept_total)}</b><span>kept names in all</span></div><div class="tile"><b>${n(U.with_sic)}</b><span>with a SIC code</span></div><div class="tile"><b>${n(U.funds)}</b><span>served funds (no comp set)</span></div><div class="tile"><b>${BI.length}</b><span>FMP industries · ${thin.length} thin</span></div></div>
<div class="panel"><div class="toc"><a href="#s1">1 · The scorecard</a><a href="#s2">2 · Where the sources agree</a><a href="#s3">3 · Reach</a><a href="#s4">4 · Where the kept ten come from</a><a href="#s5">5 · Against the authority</a><a href="#s6">6 · By industry</a><a href="#s7">7 · Worked: LRCX and JPM</a><a href="#s8">8 · The method in plain words</a><a href="#s9">9 · What could be wrong</a><a href="#s10">10 · What was not done</a><a href="#s11">11 · Proof and files</a></div></div>

<h2 id="s1">1 · The scorecard <small>source · companies covered · names offered · kept share · agreement with the others</small></h2>
<div class="panel">${scoreTable}${pic1}${pic1b}
<div class="words"><b>How to read it.</b> <b>Kept share</b> is precision: of the names a source offers for a company (counting only names with figures on the Hub, because a name without figures can never be kept), the share that ends in the kept ten. <b>Pass the cuts</b> is the share that is in the company's industry and inside the size band — what survives before the nearest-ten cut. <b>Agreement with the others</b> is the share of a source's names that at least one other source also offers. The industry source offers every served name in the industry; where an industry has forty names on the Hub it can keep at most ten of them, so its kept share is capped by arithmetic — read its <b>pass the cuts</b> column (${pc(P.INDUSTRY.eligible_of_served)}) as its quality.</div></div>

<h2 id="s2">2 · Where the sources agree <small>for each pair: how often they offer the same names, and how often a name both offer is kept</small></h2>
<div class="panel">${pic2}${pic2b}${pairTable}
<div class="words"><b>What it says.</b> No two sources overlap much on the names they offer (the largest overlap is ${SHORT[pairRows.slice().sort((a, b) => b.pooled_jaccard - a.pooled_jaccard)[0].a]} × ${SHORT[pairRows.slice().sort((a, b) => b.pooled_jaccard - a.pooled_jaccard)[0].b]} at ${pc(Math.max(...pairRows.map((p) => p.pooled_jaccard)))}), which is why the votes matter: each one adds names the others miss. But when two sources do name the same company, that name is usually kept — ${pc(AG[pairKey("FMP", "INDUSTRY")].kept_of_named_by_both)} when FMP's list and the industry agree, ${pc(AG[pairKey("FMP", "MASSIVE")].kept_of_named_by_both)} when the two provider lists agree, ${pc(AG[pairKey("MASSIVE", "INDUSTRY")].kept_of_named_by_both)} when Massive and the industry agree. A fund vote on top of another source is weaker: ${pc(AG[pairKey("FMP", "FUND")].kept_of_named_by_both)} with FMP, ${pc(AG[pairKey("MASSIVE", "FUND")].kept_of_named_by_both)} with Massive, ${pc(AG[pairKey("INDUSTRY", "FUND")].kept_of_named_by_both)} with the industry — the fund mostly repeats names that are already in the industry, plus names that are not.</div></div>

<h2 id="s3">3 · Reach <small>how many companies each source covers at all, how many names it offers, where it is empty</small></h2>
<div class="panel">${pic3}${pic3b}${reachTable}
<div class="words"><b>What it says.</b> FMP's list is there for ${R.FMP.covered} of ${R.FMP.companies} companies${R.FMP.empty ? " (empty for " + R.FMP.empty_names.join(", ") + ")" : ""} and for ${R.FMP.funds.covered} of the ${R.FMP.funds.count} served funds. Massive's related list is missing for ${R.MASSIVE.empty} companies and for ${R.MASSIVE.funds.empty} of the ${R.MASSIVE.funds.count} funds — Massive relates stocks, not funds. The industry source is empty for the ${R.INDUSTRY.empty} companies that are alone in their industry on the Hub (${R.INDUSTRY.empty_names.join(", ")}): they are the ${U.without_set.length} companies with no comp set at all, because the rule cannot keep a name from another industry. The fund source is empty for ${R.FUND.empty} companies that no industry fund on the tree holds. <b>Massive is empty for:</b> ${massiveEmpty.join(", ")}.</div></div>

<h2 id="s4">4 · Where the kept ten come from <small>the ${n(PR.kept_total)} kept names across the Hub, by how many sources named them</small></h2>
<div class="panel">${pic4}${pic4b}${provTable}${pic4c}
<div class="words"><b>What it says.</b> Agreement is the strongest signal there is: a name all four sources offer is kept ${pc(bv[4].kept_share)} of the time, three sources ${pc(bv[3].kept_share)}, two ${pc(bv[2].kept_share)}, one ${pc(bv[1].kept_share)}. Read the other way, the kept ten are mostly two- and three-vote names (${pc(bv[2].share_of_kept)} and ${pc(bv[3].share_of_kept)}); ${pc(bv[1].share_of_kept)} of the kept names were offered by one source only, and that one source is always the industry (the only source that can offer a name on its own and still pass the industry gate). Neither provider list nor the fund ever finds a kept name alone — by construction, because the rule keeps same-industry names only and the industry source offers every one of them. So the honest reading is: <b>the industry test decides what can be kept; FMP, Massive and the fund decide the order</b>.</div></div>

<h2 id="s5">5 · Against the authority <small>names a list offers outside the company's own industry — what the industry cut removes</small></h2>
<div class="panel">${pic5}${pic5b}${authTable}
<div class="words"><b>What it says.</b> FMP against itself: ${pc(AU.FMP.outside_share)} of the names FMP's peer list offers (with figures) are outside the FMP industry FMP gives the company; ${AU.FMP.companies_with_an_outsider} of ${U.with_set} companies have at least one such name. Massive: ${pc(AU.MASSIVE.outside_share)}. The shared fund: ${pc(AU.FUND.outside_share)} — a sector fund holds many industries, so most of what it offers is cut by the industry test. The industry source cannot disagree with itself. On top of that, FMP's list reaches outside the Hub for ${pc(AU.FMP.unserved_share)} of its names and Massive's for ${pc(AU.MASSIVE.unserved_share)}: those names have no figures here and drop first. (Decision 2 of the standard — admitting the names the screener finds — would turn some of those into candidates.)</div></div>

<h2 id="s6">6 · By industry <small>the same kept shares inside each FMP industry, so a thin industry's weakness shows · THIN = fewer than five served names</small></h2>
<div class="panel">${pic6}
<div class="words"><b>What it says.</b> ${BI.length} FMP industries carry the ${n(U.with_set)} companies; ${thin.length} of them are thin (fewer than five served names), holding ${thin.reduce((s, g) => s + g.companies, 0)} companies. A thin industry keeps ${thinKept == null ? "—" : thinKept.toFixed(1)} names per company on average against ${deepKept == null ? "—" : deepKept.toFixed(1)} in the deeper ones — the rule says so rather than reaching into a neighbouring industry. In a thin industry the provider lists do most of the work (they still offer ten names each, but most are outside the industry or off the Hub); in a deep one the industry source offers more than the rule can keep.</div>${indTable}</div>

<h2 id="s7">7 · Worked: LRCX and JPM <small>a deep industry and a thin one, every name each source offered and what became of it</small></h2>
${worked("LRCX")}${worked("JPM")}

<h2 id="s8">8 · The method in plain words</h2>
<div class="panel"><div class="words"><ol>
<li><b>The companies.</b> The ${n(U.served)} names the Hub serves, less the ${n(U.funds)} funds (a fund has no industry and no comp set) = ${n(U.companies)} companies; ${n(U.with_set)} of them end with at least one kept name.</li>
<li><b>The four sources, as C4 names them.</b> FMP's peer list (<code>public.peer_sources</code>, source fmp, plus <code>public.fmp_peers</code>); Massive's related companies (<code>public.peer_sources</code>, source massive); the same industry (<code>public.ticker_industry</code>: every served company with the same FMP industry, or the same SIC code); a shared industry fund (the tree's fund nodes with at most 60 holdings — broad and style funds do not count — every served holding of a fund that holds the company). All read-only, all dated snapshots committed beside this page.</li>
<li><b>The rule, unchanged.</b> ${esc(SC.rule)}. It is the standard's own selection from <code>derive.mjs</code>, re-stated in <code>scorecard.mjs</code> and tested to reproduce the standard's six worked sets exactly.</li>
<li><b>Kept share (precision).</b> For one company and one source: the names it offers that have figures on the Hub, and of those, the share in the kept ten. Pooled over all companies: total kept ÷ total offered. The median per company is in the JSON.</li>
<li><b>Overlap (agreement).</b> For a pair of sources on one company: of all the names either offers (with figures), the share both offer — the Jaccard index, in plain words. Pooled over the companies both cover, and the typical (median) company. "Kept of names both offer" counts the names both sources offered and how many were kept.</li>
<li><b>Reach.</b> A company is covered by a source when the source offers at least one name for it. Names per company counts every name offered, empties as zero.</li>
<li><b>Provenance.</b> Every kept name across the Hub, with how many of the four sources offered it (its ring on the cone) and which ones. "Found alone" = kept names only one source offered.</li>
<li><b>Against the authority.</b> A name with figures that a source offers whose FMP industry is not the company's and whose SIC is not the company's. The industry cut removes exactly these.</li>
<li><b>By industry.</b> The pooled kept shares again, inside each FMP industry; thin = fewer than five served names in the industry.</li>
</ol></div></div>

<h2 id="s9">9 · What could be wrong</h2>
<div class="panel"><div class="words"><ul>
<li><b>The measure rewards agreement with the rule, not truth.</b> "Kept" means the rule kept it. If the rule is wrong somewhere, a source that agrees with the rule looks better than one that is right. The rule was decided on 2 Oct and this page does not question it.</li>
<li><b>The industry source cannot lose.</b> Every kept name is in it by construction. Its kept share is capped by the size of the industry on the Hub (at most ten of forty); compare sources on <b>pass the cuts</b> and on <b>found alone</b>, not on kept share alone.</li>
<li><b>The provider lists are penalised for reaching outside the Hub.</b> FMP offers ${pc(AU.FMP.unserved_share)} names with no figures here; these may be excellent peers. Admitting them (the standard's decision 2) would change the lists' scores.</li>
<li><b>The SIC is on ${n(U.with_sic)} of ${n(U.companies)} companies.</b> Where it is missing, "same industry" is the FMP industry alone; where it is present it widens the industry test. Loading the rest changes a few sets at the edges.</li>
<li><b>One day's snapshots.</b> Lists of ${SC.as_of.peer_sources}, industry of ${SC.as_of.ticker_industry}, market values of ${SC.as_of.company_profile}, fund holdings of 26 Sep. Market value moves the band; the lists change when the providers refresh them.</li>
<li><b>Massive's reach is partial.</b> It is missing for ${R.MASSIVE.empty} companies; its kept share is measured on the companies it does cover, which may be the easier ones.</li>
<li><b>Fund membership depends on the tree's fund list.</b> Only funds on the tree with at most 60 served holdings count as industry funds; a missing fund lowers the fund source's reach, not its quality.</li>
</ul></div></div>

<h2 id="s10">10 · What was not done</h2>
<div class="panel"><div class="words"><ul>
<li>No source's vote was re-weighted and the rule was not changed; this page measures, it does not decide. A weak source's vote counting less is a decision for Alan (the recommendation is: not yet — measure first, which this is).</li>
<li>Nothing was written to a table, nothing deployed, no key used: the lists came by read-only SQL into a dated snapshot beside this page.</li>
<li>The screener's unserved names (decision 2) were not admitted or scored.</li>
<li>The measures were not repeated on an older snapshot, so there is no "before" to compare against; this page is the first reading.</li>
</ul></div></div>

<h2 id="s11">11 · Proof and files</h2>
<div class="panel">${shot("scorecard-1680.png", "This page at 1680 wide (headless Chromium), the top")}${shot("scorecard-390.png", "This page at 390 wide (phone), the top", { phone: true })}${shot("scorecard-lrcx-1680.png", "The LRCX worked case at 1680: every name each source offered, bright where kept")}
<div class="words"><b>Files.</b> <code>SOURCE-SCORECARD.html</code> (this page) · <code>scorecard-2026-10-02.json</code> (every number, per company too) · <code>scorecard.mjs</code> (the maths, pure) · <code>build.mjs</code> (reads the snapshots, writes the JSON and this page) · <code>page.mjs</code> (this page's words) · <code>data/peer_sources-20261002.json</code> (the lists, pulled 2 Oct) · <code>shots/</code> · <code>tests/source-scorecard.test.mjs</code>. The cone and the ladder (<code>../../20261001/universe-standard/agreement-3d.html</code>, <code>agreement-ladder.html</code>) carry the small scorecard and the ring shares, written by the standard's <code>build-page.mjs</code> from the same JSON.</div></div>
</div></body></html>`;
}

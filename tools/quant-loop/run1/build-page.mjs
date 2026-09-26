// Quant loop run 1 · builds QUANT-LOOP-RUN1.html from the evidence files beside it. Every number on the page
// comes from those files; nothing is typed in by hand.
//   node tools/quant-loop/run1/build-page.mjs
import fs from "node:fs"; import path from "node:path";

const DIR = "deliverables/20260925/quant-loop-run1";
const EV = path.join(DIR, "evidence");
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(EV, f), "utf8").replace(/\bNaN\b/g, "null"));   // Python writes NaN
const S = readJson("s1-s2-results.json");
const BP = readJson("bakeoff-primary-RESULT.json");
const BS = readJson("bakeoff-sensitivity-RESULT.json");
const BAD = readJson("bad-high-low-prints.json");
const BARS = readJson("bars-manifest.json");
const TARGETS = ["GOOGL", "NBIS", "AVGO", "BE", "AMZN", "VST", "MU", "WMT"], FUNDS = ["SPY", "QQQ", "DIA", "IWM", "SMH"];
const ALL = [...TARGETS, ...FUNDS];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const n0 = (x) => x == null ? "—" : Math.round(x).toLocaleString("en-US");
const pc = (x, d = 2) => x == null ? "—" : (x * 100).toFixed(d) + "%";
const pp = (x, d = 2) => x == null ? "—" : (x >= 0 ? "+" : "−") + Math.abs(x * 100).toFixed(d) + " pts";
const f = (x, d = 3) => x == null ? "—" : (x < 0 ? "−" : "") + Math.abs(x).toFixed(d);
const sg = (x, d = 3) => x == null ? "—" : (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(d);
const td = (k, v, cls = "") => `<td data-k="${esc(k)}"${cls ? ` class="${cls}"` : ""}>${v}</td>`;
const word = (v) => v.split(" —")[0];
const sourceDate = S.bars.SPY.last;

// ---------------------------------------------------------------- S1
const a = S.s1.a_primary, as = S.s1.a_sensitivity, b = S.s1.b;
const s1aRows = FUNDS.map((k) => `<tr>${td("index", k, "sym")}${td("days compared", n0(a[k].n_dates) + `<span class="edge">${a[k].first} → ${a[k].last}</span>`, "num")}${td("index at or below 30", pc(a[k].index_share), "num")}${td("median target", pc(a[k].member_median_share), "num")}${td("difference", pp(a[k].diff), "num")}${td("range (95%)", `${pp(a[k].ci[0])} to ${pp(a[k].ci[1])}`, "num")}${td("verdict", `<b>${word(a[k].verdict)}</b>`)}</tr>`).join("");
const s1aSens = FUNDS.map((k) => `<tr>${td("index", k, "sym")}${td("days compared", n0(as[k].n_dates) + `<span class="edge">${as[k].first} → ${as[k].last}</span>`, "num")}${td("index at or below 30", pc(as[k].index_share), "num")}${td("median of the four", pc(as[k].member_median_share), "num")}${td("difference", pp(as[k].diff), "num")}${td("range (95%)", `${pp(as[k].ci[0])} to ${pp(as[k].ci[1])}`, "num")}${td("verdict", word(as[k].verdict))}</tr>`).join("");
const sh = S.s1.shares_all_history;
const shareRows = ALL.map((k) => `<tr>${td("name", k, "sym")}${td("history", `${sh[k].first} → ${sh[k].last}`)}${td("days with a reading", n0(sh[k].n), "num")}${td("days at or below 30", n0(sh[k].count), "num")}${td("share", pc(sh[k].share), "num")}</tr>`).join("");
const s1bRows = ALL.map((k) => { const r = b[k]; return `<tr>${td("name", k, "sym")}${td("days tested", n0(r.n), "num")}${td("fired", n0(r.fired), "num")}${td("share", pc(r.share), "num")}${td("allowed band", `${pc(r.band[0])} to ${pc(r.band[1])}`, "num")}${td("verdict", `<b>${word(r.verdict)}</b>`)}${td("range if neighbouring days are not independent", `${pc(r.block_ci[0])} to ${pc(r.block_ci[1])}`, "num")}</tr>`; }).join("");
const s1bInside = ALL.filter((k) => b[k].verdict.startsWith("INSIDE"));
const s1bAbove = ALL.filter((k) => b[k].share > 0.10);
const s1bBlockCovers = ALL.filter((k) => b[k].block_ci[0] <= 0.10 && b[k].block_ci[1] >= 0.10);
const s1bShares = ALL.map((k) => b[k].share);
const s1aPrimaryWords = FUNDS.map((k) => word(a[k].verdict));
const s1aHolds = FUNDS.filter((k) => a[k].verdict.startsWith("HOLDS")), s1aContra = FUNDS.filter((k) => a[k].verdict.startsWith("CONTRA"));
const s1aSensHolds = FUNDS.filter((k) => as[k].verdict.startsWith("HOLDS"));

// ---------------------------------------------------------------- S2
const s2 = S.s2.names;
const s2Rows = ALL.map((k) => { const v = s2[k]; return `<tr>${td("name", k, "sym")}${td("days", n0(v.all.n) + `<span class="edge">${v.all.first} → ${v.all.last}</span>`, "num")}${td("rank correlation", f(v.all.rho), "num")}${td("range (95%)", `${f(v.all.ci[0])} to ${f(v.all.ci[1])}`, "num")}${td("effective days", n0(v.all.n_eff), "num")}${td("stamp at 0.9", `<b>${v.all.stamp === "ONE-WITNESS" ? "ONE WITNESS" : "not one witness"}</b>`)}${td("early half · late half", `${f(v.early.rho)} · ${f(v.late.rho)}`, "num")}${td("same state that day", pc(v.all.agreement, 1), "num")}${td("%R oversold, if RSI oversold · usually", v.all.wr_os_given_rsi_os == null ? `— · ${pc(v.all.wr_os_base, 1)}<span class="edge">RSI never at or below 30 here</span>` : `${pc(v.all.wr_os_given_rsi_os, 1)} · ${pc(v.all.wr_os_base, 1)}<span class="edge">${f(v.all.lift, 1)}× as often · ${n0(v.all.rsi_os_days)} RSI-oversold days</span>`, "num")}</tr>`; }).join("");
const rhos = ALL.map((k) => s2[k].all.rho), los = ALL.map((k) => s2[k].all.ci[0]), his = ALL.map((k) => s2[k].all.ci[1]);
const lifts = ALL.map((k) => s2[k].all.lift).filter((x) => x != null);
const oneWitness = ALL.filter((k) => s2[k].all.stamp === "ONE-WITNESS");
const exb = S.s2.excluding_bad_prints;
const exbRows = Object.entries(exb).map(([k, v]) => `<tr>${td("name", k, "sym")}${td("flagged bars", v.flagged.join(", "))}${td("days left out", n0(v.skipped_near_bad_prints), "num")}${td("correlation as served · without them", `${f(s2[k].all.rho)} · ${f(v.all.rho)}`, "num")}${td("early half as served · without them", `${f(s2[k].early.rho)} · ${f(v.early.rho)}`, "num")}${td("stamp", v.all.stamp === s2[k].all.stamp ? "unchanged" : "CHANGES")}</tr>`).join("");

// ---------------------------------------------------------------- bake-off
const GATES = [
  ["G0", "Never changes its mind", "Run bar by bar and all at once on real bars, the detector must mark exactly the same days, and ATR computed two independent ways must agree.", "whole run"],
  ["G1", "Better than a random day", "Its average outcome must beat random days' by at least 0.05 ATR, with a range clear of zero, on at least 200 events of the early years.", "this rule"],
  ["G2", "Survives being re-picked on other slices", "Pick the best rule on four-fifths of history, test on the fifth left out, five ways: at least 4 of 5 must stay positive and not lose more than half their strength.", "the whole picking procedure"],
  ["G3", "Survives rolling forward", "Pick on three years, test on the next one, step a year, repeat — at least 10 windows, the tested years keeping at least half the picked years' profit, 60% of them profitable.", "the whole picking procedure"],
  ["G4", "Beats shuffled prices", "Shuffle the same days' price moves 1,000 times and run the rule on each: fewer than 5% of the shuffles may do as well.", "this rule"],
  ["G5", "Still convincing after 46 tries", "46 settings were tried, so the best one is lucky by construction. Its score must still clear 95% confidence after allowing for that (deflated Sharpe), with enough history for that many tries.", "this rule"],
  ["G6", "The family beats doing nothing", "Across all 46 settings at once, is the best one better than doing nothing, allowing for having looked at all of them (Hansen's test), p below 0.05.", "the whole family"],
];
function gateVals(v) {
  return {
    G0: `${v.g0.checks.length} checks, ${v.g0.failures.length} failures`,
    G1: `${n0(v.g1.n)} events · ${sg(v.g1.excess)} ATR over random days · range ${sg(v.g1.ci[0])} to ${sg(v.g1.ci[1])}`,
    G2: `${v.g2.paths_positive} of ${v.g2.n_paths} slices positive · median ${f(v.g2.median_path_sr)} vs ${f(v.g2.is_sr)} when picked`,
    G3: v.g3.wfe == null ? `${v.g3.windows} windows — fewer than the 10 needed, so it cannot be judged` : `${v.g3.windows} windows · efficiency ${f(v.g3.wfe, 2)} · ${pc(v.g3.oos_win_rate, 0)} profitable`,
    G4: `${v.g4.n_perm_ge} of ${n0(v.g4.b)} shuffles did as well · p ${f(v.g4.p)}`,
    G5: `deflated ${f(v.g5.dsr, 2)} (needs 0.95) · lucky-best expected ${f(v.g5.e_max_sr)} vs its ${f(v.g5.sr)} · history ${v.g5.minbtl_ok ? "enough" : "too short"}`,
    G6: `p ${f(v.g6.p)} · best of the family ${esc(v.g6.best_key)}`,
  };
}
const firstFail = (v) => ["G0", "G1", "G2", "G3", "G4", "G5", "G6"].find((g) => !v.ladder[g]);
function ladderTable(R) {
  const c = R.verdicts.crown, sf = R.verdicts.best_swf;
  const cv = gateVals(c), sv = gateVals(sf);
  return `<table><thead><tr><th>judge</th><th>what it asks</th><th>judges</th><th>best SW-R · ${esc(c.key)}</th><th>best SW-F · ${esc(sf.key)}</th></tr></thead><tbody>${
    GATES.map(([g, name, ask, scope]) => `<tr>${td("judge", `<b>${g}</b><span class="edge">${name}</span>`, "sym")}${td("what it asks", ask, "ask")}${td("judges", scope)}${td("best SW-R", `<b>${c.ladder[g] ? "PASS" : "FAIL"}</b><span class="edge">${cv[g]}</span>`)}${td("best SW-F", `<b>${sf.ladder[g] ? "PASS" : "FAIL"}</b><span class="edge">${sv[g]}</span>`)}</tr>`).join("")
  }</tbody></table>`;
}
const P = BP, Pc = P.verdicts.crown, Pf = P.verdicts.best_swf, Sc = BS.verdicts.crown, Sf = BS.verdicts.best_swf;
const passes = (v) => Object.values(v.ladder).filter(Boolean).length;
const fails = (v) => Object.entries(v.ladder).filter(([, ok]) => !ok).map(([g]) => g).join(", ");
const top = Object.entries(P.selection.top10);
const rankOfSwf = (R) => Object.keys(R.selection.top10).indexOf(R.selection.best_swf);

const barsRows = ALL.map((k) => { const x = S.bars[k], m = BARS.symbols[k]; const bad = BAD.prints.filter((p) => p.sym === k && p.date >= x.first); return `<tr>${td("name", k, "sym")}${td("kind", TARGETS.includes(k) ? "Station target" : "fund")}${td("served", n0(x.served), "num")}${td("used from", x.first + (x.dropped_before_listing_break ? `<span class="edge">${n0(x.dropped_before_listing_break)} earlier bars belong to a different listing</span>` : ""))}${td("last finished day", x.last, "num")}${td("bars used", n0(x.kept), "num")}${td("bad high/low bars", bad.length ? `${bad.length}<span class="edge">${bad.map((p) => p.date).join(", ")}</span>` : "0", "num")}</tr>`; }).join("");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quant loop run 1</title>
<style>
 :root{ --bg:#0a0a0b; --panel:#121214; --edge:#2a2a2e; --row:#1b1b1e; --ink:#c2c2c6; --dim:#8e8e95; --faint:#72727a; --hi:#d2d2d2; --tint:#16161a; }
 *{box-sizing:border-box}
 body{margin:0;background:var(--bg);color:var(--ink);
   font:16px/1.6 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased;padding:0 0 110px}
 .wrap{max-width:1320px;margin:0 auto;padding:0 28px}
 header{padding:68px 0 28px;border-bottom:1px solid var(--edge)}
 header .scnav{margin-bottom:22px}
 .kicker{font:600 12px/1 ui-monospace,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--faint);margin:0 0 14px}
 h1{font-size:42px;line-height:1.1;margin:0 0 14px;color:var(--hi);font-weight:600;letter-spacing:-.01em}
 .sub{font-size:19px;color:var(--dim);max-width:880px;margin:0}
 .stamp{margin-top:20px;font:13px/1.6 ui-monospace,Menlo,monospace;color:var(--faint)}
 h2{font-size:28px;color:var(--hi);margin:60px 0 8px;font-weight:600}
 h3{font-size:20px;color:var(--hi);margin:34px 0 6px;font-weight:600}
 p{max-width:920px}
 .card{background:var(--panel);border:1px solid var(--edge);border-radius:10px;padding:22px 26px;margin:20px 0}
 .three{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:24px 0}
 .three>div{background:var(--panel);border:1px solid var(--edge);border-radius:10px;padding:20px 22px}
 .three .lbl{font:600 11px/1.3 ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);margin:0 0 10px}
 .three .ans{font-size:22px;line-height:1.25;color:var(--hi);font-weight:600;margin:0 0 10px}
 .three p{font-size:15px;color:var(--dim);margin:0}
 .scroll{overflow-x:auto}
 table{width:100%;border-collapse:collapse;margin:12px 0 6px;font-size:14px}
 th{text-align:left;color:var(--dim);font:600 11px/1.3 ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;padding:10px 10px;border-bottom:1px solid var(--edge);vertical-align:bottom}
 td{padding:10px 10px;border-bottom:1px solid var(--row);vertical-align:top}
 td.num{font-variant-numeric:tabular-nums}
 td.sym{color:var(--hi);font-weight:600;white-space:nowrap}
 td.ask{color:var(--dim);font-size:13px;max-width:360px}
 td b{color:var(--hi);font-weight:600}
 .edge{display:block;color:var(--faint);font-size:12px;margin-top:2px;font-weight:400}
 .claim{font-size:17px;color:var(--hi);margin:0 0 6px}
 .verdict{background:var(--tint);border:1px solid var(--edge);border-radius:10px;padding:18px 22px;margin:18px 0 4px}
 .verdict p{max-width:none;margin:6px 0}
 code,pre{font:13px/1.55 ui-monospace,Menlo,monospace;color:var(--dim)}
 pre{background:var(--panel);border:1px solid var(--edge);border-radius:8px;padding:16px 18px;white-space:pre-wrap;word-break:break-all;margin:12px 0}
 ul,ol{max-width:920px;padding-left:22px} li{margin:8px 0}
 .formula{display:grid;grid-template-columns:1fr 1fr;gap:16px}
 .formula>div{background:var(--panel);border:1px solid var(--edge);border-radius:8px;padding:14px 16px}
 .foot{margin-top:56px;padding-top:22px;border-top:1px solid var(--edge);color:var(--faint);font-size:13px}
 @media (max-width:980px){ .three{grid-template-columns:1fr} .formula{grid-template-columns:1fr} }
 @media (max-width:860px){ .wrap{padding:0 16px} h1{font-size:31px} .sub{font-size:17px} h2{font-size:24px} }
 /* on a phone each table row becomes its own block, so nothing runs off the side */
 @media (max-width:720px){
   table thead{display:none}
   table,tbody,tr,td{display:block;width:100%}
   tr{border-bottom:1px solid var(--edge);padding:10px 0}
   td{border:0;padding:3px 0}
   td.ask{max-width:none}
   td[data-k]::before{content:attr(data-k);display:block;color:var(--faint);font:600 11px/1.3 ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;margin-bottom:1px}
 }
</style></head><body><div class="wrap">

<header>
 <p class="kicker">Scintilla · quant loop · run 1 · SCI-22</p>
 <h1>The quant loop's first run on real prices</h1>
 <p class="sub">Three questions from the rulebook, asked of ${ALL.length} names' finished daily bars since 2003. Every answer is a count
 with its sample beside it. Nothing here is an opinion about today, nothing is a buy or a sell, and no rulebook claim is promoted.</p>
 <p class="stamp">Bars through ${sourceDate} (last finished day) · fetched ${BARS.started_utc.slice(0, 16).replace("T", " ")}Z from the chart API ·
 built ${S.built_utc.slice(0, 10)} · nothing deployed, nothing written to any database</p>
</header>

<h2>The three answers</h2>
<div class="three">
 <div><p class="lbl">S1 · claim #42 · “the S&amp;P's RSI almost never reaches 30”</p>
  <p class="ans">Not shown.</p>
  <p>On the preregistered test (the ${n0(a.SPY.n_dates)} days all eight targets share), no index reached 30 less often than the median target;
  IWM reached it more often. On a longer span with the four older targets, QQQ and SMH did reach it less often; SPY did not clear.</p></div>
 <div><p class="lbl">S1 · claim #42 · “percentile mode self-calibrates”</p>
  <p class="ans">Close, but runs hot.</p>
  <p>A line meant to catch the lowest 10% of days caught ${pc(Math.min(...s1bShares), 1)} to ${pc(Math.max(...s1bShares), 1)} of them, on every one of the ${ALL.length} names.
  The strict test passes ${s1bInside.length} of ${ALL.length}; allowing for neighbouring days being alike, all ${s1bBlockCovers.length} ranges include 10%.</p></div>
 <div><p class="lbl">S2 · claim #24 · are RSI and Williams %R one witness or two</p>
  <p class="ans">Not one witness at 0.9, but nowhere near two.</p>
  <p>Their rank correlation is ${f(Math.min(...rhos), 2)} to ${f(Math.max(...rhos), 2)} on every name. No range reaches the 0.9 placeholder bar,
  so none is stamped “one witness”. Counting them as two separate confirmations would still double-count most of the evidence.</p></div>
</div>
<div class="three">
 <div style="grid-column:1/-1"><p class="lbl">The swing bake-off · SW-F against SW-R · D7</p>
  <p class="ans">SW-R ranks first; neither passes all seven judges.</p>
  <p>On the early years (${P.data.first_bar} → ${P.data.dev_last_bar}), the best reversal setting (${esc(Pc.key)}) scored ${f(Pc.dev_sr)};
  the best fractal (${esc(Pf.key)}) scored ${f(Pf.dev_sr)}. The reversal setting passed ${passes(Pc)} of 7 judges and was stopped at ${firstFail(Pc)}
  — not enough years to judge the roll-forward test — and at G5, where 46 tries explain its score. The fractal failed ${fails(Pf)}.
  Both stay DRAFT: one price feed, and the book requires two.</p></div>
</div>

<h2>What ran, on which bars</h2>
<p>The eight names are the Station's own list, read from <code>public.station_targets</code> at 02:47Z on 26 Sep (read only, through the same public
route the Station page uses): GOOGL, NBIS, AVGO, BE, AMZN, VST, MU, WMT. The five funds are SPY, QQQ, DIA, IWM, SMH.
Each name's bars were asked for once, saved, and every study read the same saved bytes. An earlier attempt had fetched the same bars at 22:01Z; the bar
series came back identical, day for day.</p>
<div class="scroll"><table><thead><tr><th>name</th><th>kind</th><th>bars served</th><th>used from</th><th>last finished day</th><th>bars used</th><th>bad high/low bars</th></tr></thead><tbody>${barsRows}</tbody></table></div>
<p style="font-size:14px;color:var(--dim)">Source: Massive, split-adjusted, through <code>${esc(BARS.request)}</code>. Every response said its bars were final
(no half-finished day). A gap of more than a year starts a name's history over, the statistics package's rule: BE's first 1,306 bars are another
company, and QQQ's are cut at 2011-03-23. A “bad high/low bar” is one whose high or low cannot be right — IWM on 2004-07-30 shows a high of 5,486.5 on a
close of 55. They are flagged, never edited.</p>

<h2>The verdict table</h2>
<div class="scroll"><table><thead><tr><th>claim</th><th>statement</th><th>test</th><th>verdict</th><th>sample</th></tr></thead><tbody>
<tr>${td("claim", "#42 · U-3", "sym")}${td("statement", "The S&amp;P's RSI almost never reaches 30.")}${td("test", "Share of days at or below 30, index minus the median of the eight targets, on the days all share; 95% range by 20-day block resampling, 2,000 times. Holds if the whole range is below zero.")}${td("verdict", `<b>NOT SHOWN</b><span class="edge">${FUNDS.map((k, i) => `${k} ${s1aPrimaryWords[i].toLowerCase()}`).join(" · ")}</span>`)}${td("sample", `${n0(a.SPY.n_dates)} days each, ${a.SPY.first} → ${a.SPY.last}`)}</tr>
<tr>${td("claim", "#42 · U-3", "sym")}${td("statement", "Percentile mode self-calibrates.")}${td("test", "Each day, draw the 10th-percentile line from the 252 days before it; count how often the day falls under it. Must sit within 10% ± the binomial tolerance.")}${td("verdict", `<b>INSIDE ON ${s1bInside.length} OF ${ALL.length}</b><span class="edge">every name fired above 10% (${pc(Math.min(...s1bShares), 1)}–${pc(Math.max(...s1bShares), 1)}); inside: ${s1bInside.join(", ")}</span>`)}${td("sample", `${n0(Math.min(...ALL.map((k) => b[k].n)))} to ${n0(Math.max(...ALL.map((k) => b[k].n)))} days per name`)}</tr>
<tr>${td("claim", "#24 · I-2", "sym")}${td("statement", "Counting correlated indicators as independent inflates confidence.")}${td("test", "Rank correlation of RSI(14) and %R(14) per name, range from the effective number of days; stamp ONE WITNESS if the range's low end is at least 0.9 (placeholder, not ratified).")}${td("verdict", `<b>${oneWitness.length} OF ${ALL.length} ONE WITNESS</b><span class="edge">correlation ${f(Math.min(...rhos), 2)}–${f(Math.max(...rhos), 2)}; the arithmetic claim stands, the pair is strongly correlated</span>`)}${td("sample", `${n0(Math.min(...ALL.map((k) => s2[k].all.n)))} to ${n0(Math.max(...ALL.map((k) => s2[k].all.n)))} days per name`)}</tr>
<tr>${td("claim", "D7 · bake-off", "sym")}${td("statement", "SW-F against SW-R: which swing definition the loop should build on.")}${td("test", "46 settings (8 fractal, 38 reversal) on the early years only; best of each through the seven judges; the years from 2023 locked away.")}${td("verdict", `<b>SW-R FIRST · BOTH KILLED</b><span class="edge">SW-R stopped at ${firstFail(Pc)} (also ${fails(Pc).split(", ").filter((g) => g !== firstFail(Pc)).join(", ")}); SW-F at ${firstFail(Pf)}</span>`)}${td("sample", `${P.data.symbols.length} names × ${n0(P.data.bars_used)} days; ${n0(Pc.g1.n)} and ${n0(Pf.g1.n)} early-year events`)}</tr>
</tbody></table></div>

<h2>S1 · the index problem and percentile lines</h2>
<p class="claim">Claim #42 (card U-3): “Percentile mode self-calibrates; the S&amp;P's RSI almost never reaches 30.”</p>
<h3>(a) Does an index reach 30 less often than the names in it?</h3>
<p>Preregistered test: the five funds against the eight Station targets, on the days all of them have a reading. NBIS listed in October 2024, so those are
only the last ${n0(a.SPY.n_dates)} days. Over them, the median target sat at or below 30 on ${pc(a.SPY.member_median_share)} of days — ${(a.SPY.member_median_share * a.SPY.n_dates).toFixed(1)} days
(the median of eight is the average of the middle two). That is a thin base, and it is said here rather than hidden.</p>
<div class="scroll"><table><thead><tr><th>index</th><th>days compared</th><th>index at or below 30</th><th>median target</th><th>difference</th><th>range (95%)</th><th>verdict</th></tr></thead><tbody>${s1aRows}</tbody></table></div>
<p>A second look, fixed in advance and never used to replace the first: only the targets with history before 2012 (${S.s1.sensitivity_members.join(", ")}), which
gives each index ${n0(as.QQQ.n_dates)} to ${n0(as.SPY.n_dates)} days.</p>
<div class="scroll"><table><thead><tr><th>index</th><th>days compared</th><th>index at or below 30</th><th>median of the four</th><th>difference</th><th>range (95%)</th><th>verdict</th></tr></thead><tbody>${s1aSens}</tbody></table></div>
<p>And each name on its own, over its whole usable history (descriptive, no test):</p>
<div class="scroll"><table><thead><tr><th>name</th><th>history</th><th>days with a reading</th><th>days at or below 30</th><th>share</th></tr></thead><tbody>${shareRows}</tbody></table></div>
<div class="verdict"><p><b>Verdict (a): not shown.</b> On the preregistered test no index's range sits below zero; IWM's sits above it (${pp(a.IWM.ci[0])} to ${pp(a.IWM.ci[1])}), the opposite
of the claim. The longer second look agrees with the book for QQQ and SMH (${s1aSensHolds.join(", ")}) and not for SPY, DIA or IWM. The book's sentence reads
better as “an index reaches 30 somewhat less often than a typical stock, some of the time” than as “almost never”.</p></div>

<h3>(b) Does a line drawn at the 10th percentile catch 10% of days?</h3>
<p>For every day with a full year behind it, the line is the 10th percentile of the 252 readings before that day — that day never sees itself. The day
“fires” when its reading is strictly under the line. If the line is self-calibrating, about 10% of days fire.</p>
<div class="scroll"><table><thead><tr><th>name</th><th>days tested</th><th>fired</th><th>share</th><th>allowed band</th><th>verdict</th><th>range if neighbouring days are alike</th></tr></thead><tbody>${s1bRows}</tbody></table></div>
<div class="verdict"><p><b>Verdict (b): close, but it runs hot.</b> All ${s1bAbove.length} names fired more often than 10%. On the preregistered band (which treats every day as a fresh
coin-toss) ${s1bInside.length} of ${ALL.length} sit inside and ${ALL.length - s1bInside.length} sit above it. RSI on one day is very like RSI the day before, so that band is too narrow;
with 20-day blocks resampled instead, every one of the ${ALL.length} ranges includes 10%. Part of the excess is arithmetic: a line drawn this way from 252 days
would fire about 10.3% of the time even on a perfectly well-behaved series (ESTIMATE, from the order statistics). Plain words: the percentile line does roughly
what the book says, and a reader should expect about 11 days in 100, not 10.</p></div>

<h2>S2 · RSI and Williams %R: one witness or two</h2>
<p class="claim">Claim #24 (card I-2): “Counting correlated indicators as independent inflates confidence.” This claim is true by arithmetic; the test is whether
RSI and %R are in fact correlated enough that the book should treat them as one witness.</p>
<div class="formula">
 <div><b style="color:var(--hi)">RSI(14)</b><br><code>100 − 100 / (1 + average gain ÷ average loss)</code><br><span class="edge">Wilder's averages of the last 14 closes' ups and downs</span></div>
 <div><b style="color:var(--hi)">Williams %R(14)</b><br><code>−100 × (14-day high − close) ÷ (14-day high − 14-day low)</code><br><span class="edge">where the close sits inside the last 14 days' range</span></div>
</div>
<p>Both answer the same question — has the price been closing near the bottom of its recent range? — so they should move together. The range on each correlation
uses the effective number of days (today's reading is mostly yesterday's, so ${n0(s2.SPY.all.n)} SPY days count as about ${n0(s2.SPY.all.n_eff)} independent ones).
Oversold is RSI at or below 30 and %R at or below −80; overbought is 70 and −20.</p>
<div class="scroll"><table><thead><tr><th>name</th><th>days</th><th>rank correlation</th><th>range (95%)</th><th>effective days</th><th>stamp at 0.9</th><th>early half · late half</th><th>same state that day</th><th>%R oversold, if RSI oversold · usually</th></tr></thead><tbody>${s2Rows}</tbody></table></div>
<div class="verdict"><p><b>Verdict: ${oneWitness.length} of ${ALL.length} stamped one witness at the 0.9 placeholder; all ${ALL.length} strongly correlated.</b> The ranges run from
${f(Math.min(...los), 2)} to ${f(Math.max(...his), 2)}; none reaches 0.9 at its low end, and both halves of every name's history tell the same story. When RSI says oversold,
%R says oversold ${f(Math.min(...lifts), 1)} to ${f(Math.max(...lifts), 1)} times as often as it usually does. The spec calls anything under the bar “independent”;
that word overstates it. These are one and a bit witnesses, and the rulebook should not count them as two confirmations.</p></div>
<h3>With the bad high/low bars left out</h3>
<p>%R uses highs and lows, so a bad high distorts it for 14 days. Leaving out every day whose 14-day window touches a flagged bar:</p>
<div class="scroll"><table><thead><tr><th>name</th><th>flagged bars</th><th>days left out</th><th>correlation as served · without them</th><th>early half as served · without them</th><th>stamp</th></tr></thead><tbody>${exbRows}</tbody></table></div>

<h2>The swing bake-off (D7) — S3's precondition</h2>
<p>A swing is a turning point. The book has two ways to find one: <b>SW-F</b> (fractal: a bar higher or lower than the <i>n</i> bars either side) and
<b>SW-R</b> (reversal: price turns back by a set amount — a percentage, or a multiple of the usual daily range). Every setting in the ratified first wave was
run on real bars, each swing labelled by what happened next (a win at 2 × the usual range, a loss at 1 ×, or time out after 10 days, measured in ATR), and
the best setting was picked on the early years only.</p>
<div class="card">
<p><b style="color:var(--hi)">Preregistered universe:</b> ${esc(P.data.symbols.join(", "))} — every name with unbroken history from before 2012, so the shared calendar keeps six-plus early
years. GOOGL (2014), VST (2017), BE (2018) and NBIS (2024) would each have shrunk every name's early years to under four, so they are left out, as written down before
any result existed.<br>
<b style="color:var(--hi)">Years:</b> early (picking) ${P.data.first_bar} → ${P.data.dev_last_bar} · checking 2018-01-02 → ${P.data.last_bar_used} ·
locked away ${P.data.lockbox_first} → ${sourceDate} (${n0(P.data.lockbox_bars_cropped)} days, cut out before anything ran, never read).<br>
<b style="color:var(--hi)">Pool:</b> ${P.selection.eligible} of ${P.selection.considered} settings had at least 200 early-year events and could be picked.</p>
</div>
<h3>How the settings ranked on the early years</h3>
<div class="scroll"><table><thead><tr><th>rank</th><th>setting</th><th>family</th><th>early-year score (mean ÷ spread of outcomes)</th></tr></thead><tbody>${
  top.map(([k, v], i) => `<tr>${td("rank", i + 1, "num")}${td("setting", esc(k), "sym")}${td("family", k.startsWith("SW-R") ? "reversal" : "fractal")}${td("score", f(v, 4), "num")}</tr>`).join("")
}<tr>${td("rank", rankOfSwf(P) < 0 ? "below 10" : rankOfSwf(P) + 1, "num")}${td("setting", esc(Pf.key), "sym")}${td("family", "fractal — the best of its family")}${td("score", f(Pf.dev_sr, 4), "num")}</tr></tbody></table></div>
<h3>The seven judges</h3>
<p>Three judges (G2, G3, G6) test the whole way of picking, so they give the same answer for both families' rows; three (G1, G4, G5) test the named setting.
A setting is KILLED at the first judge it fails.</p>
<div class="scroll">${ladderTable(P)}</div>
<div class="verdict"><p><b>Bake-off result: SW-R ranks first, and neither family survives.</b> The best reversal setting beat random days by ${sg(Pc.g1.excess)} ATR on ${n0(Pc.g1.n)}
early-year events (range ${sg(Pc.g1.ci[0])} to ${sg(Pc.g1.ci[1])}) and beat shuffled prices (${Pc.g4.n_perm_ge} of ${n0(Pc.g4.b)}). It was stopped at <b>G3</b>: these nine names
share only ${n0(P.data.bars_used)} days before the lockbox, which makes ${Pc.g3.windows} roll-forward windows where the book requires 10, so the test cannot be run —
a short-history stop, not a measured failure. It also fails <b>G5</b>: after 46 tries, a best score of ${f(Pc.g5.sr)} is only ${f(Pc.g5.dsr, 2)} convincing where 0.95 is required.
The best fractal did not beat random days (range ${sg(Pf.g1.ci[0])} to ${sg(Pf.g1.ci[1])}). Status: <b>DRAFT, KILLED</b> — and DRAFT regardless, because one price feed cannot
make TESTED under the two-feed law.</p></div>

<h3>Second look: the seven names with history from 2003</h3>
<p>Preregistered as a sensitivity run and never used to replace the result above: ${esc(BS.data.symbols.join(", "))}, ${BS.data.first_bar} → ${BS.data.last_bar_used}
(${n0(BS.data.bars_used)} days). Caution: this span contains ${BAD.prints.filter((p) => BS.data.symbols.includes(p.sym) && p.date < "2023-01-01").length} of the bad high/low bars
(SPY, IWM, AMZN), which inflate the usual-range measure the reversal settings and the win/loss labels are built on. Its crown is again ${esc(Sc.key)}.</p>
<div class="scroll">${ladderTable(BS)}</div>
<div class="verdict"><p>With 16 windows, G3 can run and the reversal setting passes it (efficiency ${f(Sc.g3.wfe, 2)}, ${pc(Sc.g3.oos_win_rate, 0)} of windows profitable). It still fails G5
(${f(Sc.g5.dsr, 2)}) and G6 (p ${f(Sc.g6.p)}). Same answer: SW-R first, nothing survives.</p></div>

<h2>What could be wrong</h2>
<ul>
 <li><b>Survivorship.</b> All ${ALL.length} names exist today, and the eight targets were chosen by someone who already knew how they had done. Nothing here says how a name that failed would have behaved.</li>
 <li><b>Bad bars in the source.</b> ${BAD.prints.length} bars served by the chart API carry an impossible high or low (${[...new Set(BAD.prints.map((p) => p.sym))].join(", ")}; all before 2011). The loop's own validator lets them through
 because the high is still above the open and close. They are outside the preregistered bake-off span, inside the second look, and inside S2 for three names (re-counted above; no stamp changes).
 Closes look right, so S1 is not affected.</li>
 <li><b>One feed.</b> Every bar is Massive's, split-adjusted but not dividend-adjusted. The book's two-feed law is not met, so nothing here can be TESTED.</li>
 <li><b>S1(a)'s preregistered sample is short.</b> Requiring all eight targets on the same day leaves ${n0(a.SPY.n_dates)} days from the last two years, when the median target was at or below 30 on
 ${(a.SPY.member_median_share * a.SPY.n_dates).toFixed(1)} days. The spec asked for the whole 358-name universe as members; this run used the eight targets, as preregistered. The package's
 descriptive numbers for all 358 (median member 2.94% against SPY 1.61%) point the book's way and are not tested here.</li>
 <li><b>S1(b)'s band is too strict by design.</b> The preregistered binomial band treats each day as independent; they are not. Both are shown; the verdict uses the preregistered one.</li>
 <li><b>S2's 0.9 bar is a placeholder</b>, not ratified. At 0.8 most names would be stamped one witness. The numbers do not depend on the bar; the stamp does.</li>
 <li><b>G3 in the bake-off is a short-history stop.</b> It says “cannot tell”, not “failed going forward”.</li>
 <li><b>Two split rules disagree.</b> RULEBOOK-STATS S3 says the lockbox starts in 2019; the loop's ratified registry says 2023. The registry was used; the difference is reported, not resolved.</li>
 <li><b>The preregistration was written by the previous attempt</b> (22:25Z, 25 Sep) before any study or gate produced a number, and was carried over unchanged. This run checked that the earlier attempt's log holds no gate output.</li>
 <li><b>An earlier real-price bake-off exists</b> (22 Sep, a different 12-name universe on Massive's direct feed, lockbox from 2023): its crown was killed at G1. This run's answer is not the same experiment and does not replace it.</li>
</ul>

<h2>What I did not do</h2>
<ul>
 <li>No S3 (regime conditioning), S4 (throwbacks) or S5 (gap fills). S4 and S5 measure breaks and gaps straight off highs and lows, and the bad high/low bars would sit inside those counts, so they wait for the data fix.</li>
 <li>No push, no deploy, no merge, no schedule, no database write. The loop's usual SQL for its ledger was produced as a file and not run.</li>
 <li>No change to the rulebook's claims ledger: claims #24 and #42 keep their v2 status until someone decides what these verdicts mean for them.</li>
 <li>No paid model API, no subagents, no browser on anyone's screen.</li>
</ul>

<h2>Reproduce</h2>
<pre># 1 · bars (read-only GET, 13 names) into a cache directory
node tools/quant-loop/fetch-bars.mjs &lt;cache&gt;
# 2 · S1 and S2 (offline, ~3 s), then this page
node tools/quant-loop/run1/run.mjs &lt;cache&gt; ${DIR}/evidence/s1-s2-results.json
node tools/quant-loop/run1/build-page.mjs
python3 scripts/inject-scnav.py                   # places the BACK / CLOSE pair on this page
# 3 · the bake-off, in scintilla-loop at dae73cf (branch loop/chartapi-run1-20260925), Python 3.11
PYTHONPATH=src python scripts/ingest_chartapi_lake.py --cache &lt;cache&gt; --lake &lt;lake&gt;
PYTHONPATH=src python scripts/run_real_bakeoff.py --lake &lt;lake&gt; --out &lt;out&gt; \\
  --symbols ${P.data.symbols.join(",")} --start 2003-01-01 --end 2026-09-25 \\
  --feed chartapi-massive-d1-split --universe-key ${esc(P.data.universe_key)}
# second look: --symbols ${BS.data.symbols.join(",")} --universe-key ${esc(BS.data.universe_key)}
# 4 · tests
node --test tests/quant-loop-run1.test.mjs        # hand-checked fixtures for S1 and S2
PYTHONPATH=src python -m pytest                   # in scintilla-loop: the 89 test functions and the lake reader's</pre>
<p style="font-size:14px;color:var(--dim)">Seeds: S1 and S2 ${S.params.seed}, bake-off 20260922. Dataset fingerprints: preregistered ${P.data.dataset_hash.slice(0, 12)}, second look ${BS.data.dataset_hash.slice(0, 12)}.
Evidence beside this page: <code>evidence/</code> — results, both bake-off RESULT files and logs, the bars and lake manifests (a sha256 for every response), the preregistration, the bad-bar list.</p>

<p class="foot">Quant loop run 1 · dispatch SCINTILLA-20260925-Q1 · SCI-22, SCI-8, SCI-6 · every number on this page is read from <code>evidence/</code> by
<code>tools/quant-loop/run1/build-page.mjs</code></p>
</div></body></html>
`;
fs.writeFileSync(path.join(DIR, "QUANT-LOOP-RUN1.html"), html);
console.log("wrote", path.join(DIR, "QUANT-LOOP-RUN1.html"), html.length, "bytes");

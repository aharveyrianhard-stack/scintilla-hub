/* PG1 — turns the measurements into a ranked list and a page a non-technical reader can use.
   rank(): every number past its limit becomes one finding; red first, then by how far past the limit it is.
   writeReport(): index.html (pictures first), README.md (the same report in a form GitHub shows as a page when the
   folder is opened — a branch cannot show an HTML file), WORST-FIVE.md, ISSUE.md (the GitHub issue on a red night). */
import fs from "node:fs";
import path from "node:path";

const secs = (ms) => (ms >= 10000 ? (ms / 1000).toFixed(0) : (ms / 1000).toFixed(1)) + " s";
const mb = (kb) => (kb >= 1024 ? (kb / 1024).toFixed(1) + " MB" : kb + " KB");
const age = (min) => (min >= 2880 ? Math.round(min / 1440) + " days" : min >= 120 ? Math.round(min / 60) + " hours" : min + " min");
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* metric → how it is judged and worded. `get` returns the number or null (not measured). */
const CHECKS = [
  { key: "firstDataMs", problem: "slow to show its numbers", number: (v) => secs(v) + " until the first numbers appeared", was: secs },
  { key: "weightKB", problem: "heavy to download", number: (v) => mb(v) + " downloaded", was: mb },
  { key: "layoutShift", problem: "things jump around while it loads", number: (v) => "layout shift " + v.toFixed(2) + " (good is under 0.10)", was: (v) => v.toFixed(2) },
  { key: "longestFreezeMs", problem: "the screen freezes", number: (v, s) => "longest freeze " + secs(v) + " (" + s.longTasks + " stall" + (s.longTasks === 1 ? "" : "s") + ", " + secs(s.frozenMs) + " frozen in all)", was: secs },
  { key: "consoleErrors", problem: "errors in the browser's log", number: (v, s) => v + " error" + (v === 1 ? "" : "s") + (s.pageErrors ? ", " + s.pageErrors + " of them script crashes" : ""), was: (v) => v + "" },
  { key: "failedCalls", problem: "data calls that failed", number: (v, s) => v + " failed call" + (v === 1 ? "" : "s") + (s.failedCallSamples && s.failedCallSamples[0] ? " (most often: " + s.failedCallSamples[0].text + ")" : ""), was: (v) => v + "" },
  { key: "placeholders", problem: "dashes where numbers should be", number: (v) => v + " empty readouts (“—”) on screen", was: (v) => v + "" },
  { key: "blankPanels", problem: "blank panels", number: (v, s) => v + " empty box" + (v === 1 ? "" : "es") + (s.blankPanelSamples && s.blankPanelSamples[0] ? " (largest " + s.blankPanelSamples[0].w + "×" + s.blankPanelSamples[0].h + " px)" : ""), was: (v) => v + "" },
  { key: "staleBadges", problem: "old, stale or fallback data on show", number: (v, s) => {
      const o = Math.max(0, ...(s.staleSamples || []).map((x) => x.minutes || 0)), eg = (s.staleSamples || []).find((x) => x.flag) || (s.staleSamples || [])[0];
      return v + " label" + (v === 1 ? "" : "s") + (o ? " (oldest " + age(o) + ")" : "") + (eg ? " — e.g. “" + eg.text.slice(0, 44) + "”" : "");
    }, was: (v) => v + "" },
  { key: "picChangedPct", problem: "the picture changed a lot since the last run", number: (v) => v.toFixed(0) + " % of the screen looks different", was: (v) => v.toFixed(0) + " %" },
  { key: "sidewaysScrollPx", problem: "scrolls sideways on a phone", number: (v) => v + " px wider than the phone screen", was: (v) => v + " px", limit: { amber: 8, red: 100 } },
];

export function rank(result, prev) {
  const L = result.limits, findings = [];
  const prevOf = (id) => prev && (prev.screens || []).find((s) => s.id === id);
  for (const s of result.screens) {
    const p = prevOf(s.id);
    const add = (level, severity, problem, number, key, value) => {
      const f = { level, severity: +severity.toFixed(3), screenId: s.id, screen: s.name, problem, number, key, value };
      if (p && key && typeof p[key] === "number") f.lastRun = p[key];
      findings.push(f);
    };
    if (!s.ok) { add("red", 9, "did not load", s.notes.join("; ") || "the review could not open it", null, null); continue; }
    if (s.firstDataMs == null && s.parked) add("amber", 0.2, "the room is parked — it shows no data", "a notice instead of numbers", "firstDataMs", null);
    else if (s.firstDataMs == null) add("red", 8, "never showed any numbers", "nothing within 30 seconds", "firstDataMs", null);
    if (s.pageErrors) add(s.pageErrors >= 5 ? "red" : "amber", 0.5 + s.pageErrors / 10, "a script crashed on the page", s.pageErrors + " crash" + (s.pageErrors === 1 ? "" : "es") + (s.pageErrorSamples[0] ? " (“" + s.pageErrorSamples[0].text.slice(0, 90) + "”)" : ""), "pageErrors", s.pageErrors);
    const fiveHundreds = (s.failedCallSamples || []).filter((x) => /^5\d\d /.test(x.text)).reduce((n, x) => n + x.n, 0);
    for (const c of CHECKS) {
      const v = s[c.key]; if (typeof v !== "number") continue;
      const lim = c.limit || L[c.key]; if (!lim || v < lim.amber) continue;
      let level = v >= lim.red ? "red" : "amber";
      if (c.key === "failedCalls" && fiveHundreds) level = "red";      // a server error is never just amber
      add(level, v / lim.red, c.problem, c.number(v, s), c.key, v);
    }
    const lh = s.lighthouse;
    if (lh && typeof lh.performance === "number" && lh.performance <= L.lighthousePerf.amber) {
      const f = { level: lh.performance <= L.lighthousePerf.red ? "red" : "amber", severity: +((100 - lh.performance) / (100 - L.lighthousePerf.red)).toFixed(3), screenId: s.id, screen: s.name, problem: "low Lighthouse speed score", number: lh.performance + " out of 100 on a phone (biggest paint at " + secs(lh.largestPaintMs || 0) + ")", key: "lighthouse.performance", value: lh.performance };
      if (p && p.lighthouse && typeof p.lighthouse.performance === "number") f.lastRun = p.lighthouse.performance;
      findings.push(f);
    }
    /* Lighthouse loads the page as a slow phone would; content that arrives late there shoves the page about
       even when a fast desk machine sees nothing move */
    if (lh && typeof lh.layoutShift === "number" && lh.layoutShift >= L.layoutShift.amber) {
      const f = { level: lh.layoutShift >= L.layoutShift.red ? "red" : "amber", severity: +(lh.layoutShift / L.layoutShift.red).toFixed(3), screenId: s.id, screen: s.name, problem: "things jump around on a slow phone", number: "layout shift " + lh.layoutShift.toFixed(2) + " in Lighthouse's slow-phone load (good is under 0.10)", key: "lighthouse.layoutShift", value: lh.layoutShift };
      if (p && p.lighthouse && typeof p.lighthouse.layoutShift === "number") f.lastRun = p.lighthouse.layoutShift;
      findings.push(f);
    }
  }
  findings.sort((a, b) => (a.level === b.level ? b.severity - a.severity : a.level === "red" ? -1 : 1));
  /* the worst five: the top of the list, at most two per page (wide and phone width count as one page) so one bad page cannot fill it */
  const worstFive = [], per = {};
  const seen = new Set();
  for (const f of findings) {
    const base = f.screenId.replace(/-phone$/, "");                  // the phone-width pass of a page is the same page
    if (seen.has(base + "|" + f.key)) continue;
    if ((per[base] = (per[base] || 0) + 1) > 2) continue;
    seen.add(base + "|" + f.key); worstFive.push(f); if (worstFive.length === 5) break;
  }
  const verdict = findings.some((f) => f.level === "red") ? "red" : findings.length ? "amber" : "green";
  return { verdict, findings, worstFive };
}

const wasText = (f) => {
  if (f.lastRun == null || f.value == null) return "";
  if (f.key === "lighthouse.performance") return "last run " + f.lastRun;
  if (f.key === "lighthouse.layoutShift") return "last run " + f.lastRun.toFixed(2);
  const c = CHECKS.find((c) => c.key === f.key);
  return c ? "last run " + c.was(f.lastRun) : "last run " + f.lastRun;
};

export function writeReport(r, OUT, HERE) {
  const when = r.dateET + " " + r.startedET + " ET";
  const reds = r.findings.filter((f) => f.level === "red").length, ambers = r.findings.length - reds;
  const five = r.worstFive.map((f, i) => (i + 1) + ". " + f.screen + " · " + f.problem + " · " + f.number + (wasText(f) ? " · " + wasText(f) : "")).join("\n");
  fs.writeFileSync(path.join(OUT, "WORST-FIVE.md"),
    "# Worst five — " + when + " (" + r.slot + " run)\n\nResult: **" + r.verdict.toUpperCase() + "** — " + reds + " red, " + ambers + " amber, across " + r.screens.length + " screens.\n\n" + (five || "Nothing past its limit.") + "\n\nFull page: `index.html` beside this file. Numbers: `glitch-review.json`.\n" + (r.runUrl ? "Run: " + r.runUrl + "\n" : ""));
  fs.writeFileSync(path.join(OUT, "ISSUE.md"),
    "Result of the slowness-and-glitch review of " + when + " (" + r.slot + " run): **" + r.verdict.toUpperCase() + "** — " + reds + " red, " + ambers + " amber, across " + r.screens.length + " screens.\n\n" +
    "**Worst five (screen · problem · number)**\n\n" + (five || "Nothing past its limit.") + "\n\n" +
    "**Every red**\n\n" + (r.findings.filter((f) => f.level === "red").map((f) => "- " + f.screen + " · " + f.problem + " · " + f.number).join("\n") || "- none") + "\n\n" +
    (r.runUrl ? "Run: " + r.runUrl + "\n" : "") + "This review only measures and ranks; it fixes nothing. Switch it off: Actions → “Glitch review” → ⋯ → Disable workflow.\n");

  /* README.md — GitHub renders it, pictures and all, when the report folder is opened in the browser */
  const cellMd = (x) => String(x == null ? "" : x).replace(/\|/g, "\\|").replace(/\n/g, " ");
  const lvlMd = (s) => (r.findings.some((f) => f.screenId === s.id && f.level === "red") ? "RED" : r.findings.some((f) => f.screenId === s.id) ? "amber" : "ok");
  const numMd = (v, f) => (typeof v === "number" ? f(v) : "·");
  fs.writeFileSync(path.join(OUT, "README.md"),
    "# Slowness and glitch review — " + when + " (" + r.slot + " run)\n\n" +
    "**" + r.verdict.toUpperCase() + " — " + reds + " red · " + ambers + " amber** across " + r.screens.length + " screens · " + r.ranOn + (r.runUrl ? " · [the run](" + r.runUrl + ")" : "") +
    (r.comparedWith ? " · compared with " + r.comparedWith.dateET + " " + r.comparedWith.startedET + " ET" : " · first run, nothing to compare with yet") + "\n\n" +
    "It measures and ranks; it fixes nothing. What each number means and when it is listed: PAGE SPECS at the foot of `index.html` (same folder).\n\n" +
    "## Worst five\n\n" + (five || "Nothing past its limit.") + "\n\n" +
    "## The numbers\n\n| screen | result | first numbers | weight | layout shift | longest freeze | log errors | failed calls | dashes | blank boxes | old labels | picture changed | Lighthouse speed |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n" +
    r.screens.map((s) => "| " + [cellMd(s.name), lvlMd(s), s.ok ? (typeof s.firstDataMs === "number" ? secs(s.firstDataMs) : "never") : "failed", numMd(s.weightKB, mb), numMd(s.layoutShift, (v) => v.toFixed(2)), numMd(s.longestFreezeMs, secs), numMd(s.consoleErrors, String), numMd(s.failedCalls, String), numMd(s.placeholders, String), numMd(s.blankPanels, String), numMd(s.staleBadges, String), numMd(s.picChangedPct, (v) => v.toFixed(0) + " %"), s.lighthouse && typeof s.lighthouse.performance === "number" ? String(s.lighthouse.performance) : "·"].join(" | ") + " |").join("\n") + "\n\n" +
    "## The full ranked list (" + r.findings.length + ")\n\n" + (r.findings.map((f, i) => (i + 1) + ". " + (f.level === "red" ? "**RED** " : "amber ") + f.screen + " · " + f.problem + " · " + f.number + (wasText(f) ? " · " + wasText(f) : "")).join("\n") || "Nothing past its limit.") + "\n\n" +
    "## Every screen, as the review saw it\n\n" +
    r.screens.map((s) => "### " + s.name + " — " + lvlMd(s) + "\n\n" + (s.shot ? "![" + s.name + "](" + s.shot + ")\n\n" : "No picture — " + s.notes.join("; ") + "\n\n") +
      (r.findings.filter((f) => f.screenId === s.id).map((f) => "- " + (f.level === "red" ? "**RED** " : "amber ") + f.problem + " — " + f.number + (wasText(f) ? " (" + wasText(f) + ")" : "")).join("\n") || "- nothing past its limit") +
      (s.moved ? "\n- what moved since the last run: " + (s.picChangedPct == null ? "·" : s.picChangedPct.toFixed(1) + " % of the screen") + " — [the difference picture](" + s.moved + ")" : "") + "\n").join("\n"));

  const tag = (lvl) => '<span class="t t-' + lvl + '">' + (lvl === "red" ? "RED" : lvl === "amber" ? "AMBER" : "OK") + "</span>";
  const lvlOf = (s) => (r.findings.some((f) => f.screenId === s.id && f.level === "red") ? "red" : r.findings.some((f) => f.screenId === s.id) ? "amber" : "ok");
  const cell = (s, key, text) => { const f = r.findings.find((f) => f.screenId === s.id && f.key === key); return '<td class="' + (f ? "c-" + f.level : "") + '">' + text + "</td>"; };
  const n = (v, f) => (typeof v === "number" ? f(v) : "·");
  const cards = r.screens.map((s) => {
    const fs_ = r.findings.filter((f) => f.screenId === s.id);
    return '<figure class="card" id="' + esc(s.id) + '"><figcaption>' + tag(lvlOf(s)) + " <b>" + esc(s.name) + "</b></figcaption>" +
      (s.shot ? '<a href="' + esc(s.shot) + '"><img loading="lazy" src="' + esc(s.shot) + '" alt="picture of ' + esc(s.name) + '"></a>' : '<div class="nopic">no picture — ' + esc(s.notes.join("; ")) + "</div>") +
      (s.moved ? '<a class="moved" href="' + esc(s.moved) + '">what moved since the last run: ' + (s.picChangedPct == null ? "·" : s.picChangedPct.toFixed(1) + " % of the screen") + "</a>" : '<span class="moved">no earlier picture to compare with</span>') +
      "<ul>" + (fs_.length ? fs_.map((f) => "<li>" + tag(f.level) + " " + esc(f.problem) + " — " + esc(f.number) + (wasText(f) ? ' <i>(' + esc(wasText(f)) + ")</i>" : "") + "</li>").join("") : "<li>" + tag("ok") + " nothing past its limit</li>") +
      (s.notes.length && s.ok ? "<li>note: " + esc(s.notes.join("; ")) + "</li>" : "") + "</ul></figure>";
  }).join("\n");
  const rows = r.screens.map((s) => "<tr><th>" + tag(lvlOf(s)) + ' <a href="#' + esc(s.id) + '">' + esc(s.name) + "</a></th>" +
    cell(s, "firstDataMs", s.ok ? n(s.firstDataMs, secs) === "·" ? "never" : secs(s.firstDataMs) : "failed") +
    cell(s, "weightKB", n(s.weightKB, mb)) + cell(s, "layoutShift", n(s.layoutShift, (v) => v.toFixed(2))) +
    cell(s, "longestFreezeMs", n(s.longestFreezeMs, secs)) + cell(s, "consoleErrors", n(s.consoleErrors, String)) +
    cell(s, "failedCalls", n(s.failedCalls, String)) + cell(s, "placeholders", n(s.placeholders, String)) +
    cell(s, "blankPanels", n(s.blankPanels, String)) + cell(s, "staleBadges", n(s.staleBadges, String)) +
    cell(s, "picChangedPct", n(s.picChangedPct, (v) => v.toFixed(0) + " %")) +
    cell(s, "lighthouse.performance", s.lighthouse && typeof s.lighthouse.performance === "number" ? String(s.lighthouse.performance) : "·") + "</tr>").join("\n");
  const detail = r.screens.map((s) => {
    const list = (title, arr, f) => (arr && arr.length ? "<p><b>" + title + "</b></p><ul>" + arr.map((x) => "<li>" + esc(f(x)) + "</li>").join("") + "</ul>" : "");
    const body = list("Most common errors in the browser's log", s.consoleErrorSamples, (x) => x.n + "× " + x.text) +
      list("Script crashes", s.pageErrorSamples, (x) => x.n + "× " + x.text) +
      list("Failed calls", s.failedCallSamples, (x) => x.n + "× " + x.text) +
      list("Where the page jumped (largest first)", s.shiftSources, (x) => x.value + " at " + secs(x.at) + " — " + (x.what.join(", ") || "?") + (x.frame !== "page" ? " [in the frame " + x.frame + "]" : "")) +
      list("Where the dashes are", s.placeholderSamples, (x) => x.n + "× " + x.text) +
      list("Blank boxes", s.blankPanelSamples, (x) => x.w + "×" + x.h + " px — " + x.where) +
      list("Old age labels", s.staleSamples, (x) => "“" + x.text + "” — " + x.where) +
      (s.lighthouse && !s.lighthouse.error ? "<p><b>Lighthouse (phone, slowed connection)</b>: speed " + s.lighthouse.performance + " · accessibility " + s.lighthouse.accessibility + " · good practice " + s.lighthouse.bestPractices + " · first paint " + n(s.lighthouse.firstPaintMs, secs) + " · biggest paint " + n(s.lighthouse.largestPaintMs, secs) + " · layout shift " + s.lighthouse.layoutShift + " · weight " + n(s.lighthouse.weightKB, mb) + "</p>" : s.lighthouse ? "<p>Lighthouse could not run: " + esc(s.lighthouse.error) + "</p>" : "");
    return body ? "<details><summary>" + esc(s.name) + " — the details</summary>" + body + "</details>" : "";
  }).join("\n");
  let scnav = ""; try { scnav = fs.readFileSync(path.join(HERE, "..", "..", "scripts", "scnav-snippet.html"), "utf8"); } catch { scnav = ""; }
  const L = r.limits;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Glitch review · ${esc(when)}</title>
<style>
:root{color-scheme:dark}
body{margin:0;padding:14px 22px 60px;background:#0a0b0d;color:#a9adb2;font:13px/1.55 ui-monospace,"SF Mono",Menlo,Consolas,monospace}
h1{font-size:15px;letter-spacing:.18em;text-transform:uppercase;color:#c8cbcf;margin:0 0 4px}
h2{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#c8cbcf;margin:34px 0 10px;border-top:1px solid #23262a;padding-top:16px}
p{margin:6px 0;max-width:980px} a{color:#c8cbcf} i{color:#7d8187;font-style:normal}
.sub{color:#7d8187}
.verdict{display:inline-block;margin:14px 0 4px;padding:8px 14px;border:1px solid #5c6066;letter-spacing:.16em;color:#d0d2d2}
.t{display:inline-block;min-width:44px;text-align:center;font-size:11px;letter-spacing:.12em;padding:1px 5px;border:1px solid #3a3d42;color:#7d8187}
.t-red{background:#c4c7cb;color:#0a0b0d;border-color:#c4c7cb;font-weight:700}
.t-amber{border-color:#9a9ea3;color:#c8cbcf}
ol.five{margin:10px 0;padding-left:22px;max-width:1100px} ol.five li{margin:5px 0;color:#c8cbcf}
ol.five li,.card li,p{overflow-wrap:anywhere}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(360px,100%),1fr));gap:16px}
.card{margin:0;background:#101215;border:1px solid #23262a;padding:10px}
.card img{display:block;width:100%;height:auto;border:1px solid #23262a;margin:8px 0 4px}
.card ul{margin:6px 0 0;padding:0;list-style:none} .card li{margin:4px 0;font-size:12px}
.moved{font-size:11px;color:#7d8187} .nopic{padding:40px 10px;border:1px dashed #3a3d42;margin:8px 0;font-size:12px}
.wrap{overflow-x:auto} table{border-collapse:collapse;font-size:12px;min-width:1100px}
th,td{border:1px solid #23262a;padding:5px 8px;text-align:right;white-space:nowrap} th{text-align:left;font-weight:400;color:#a9adb2}
thead th{color:#7d8187;font-size:11px;letter-spacing:.08em;text-transform:uppercase;white-space:normal;text-align:right}
td.c-red{background:#c4c7cb;color:#0a0b0d;font-weight:700} td.c-amber{outline:1px solid #9a9ea3;outline-offset:-2px;color:#d0d2d2}
details{margin:8px 0;max-width:1100px} summary{cursor:pointer;color:#c8cbcf} details ul{margin:4px 0 10px;padding-left:20px} details li{font-size:12px;word-break:break-word}
</style></head><body>
<span data-scnav-slot></span>
<h1 style="margin-top:16px">Slowness and glitch review</h1>
<p class="sub">${esc(when)} · ${esc(r.slot)} run · ${r.screens.length} screens · ${esc(r.ranOn)}${r.runUrl ? ' · <a href="' + esc(r.runUrl) + '">the run</a>' : ""}${r.comparedWith ? " · compared with " + esc(r.comparedWith.dateET + " " + r.comparedWith.startedET + " ET") : " · first run, nothing to compare with yet"}</p>
<div class="verdict">${r.verdict.toUpperCase()} — ${reds} red · ${ambers} amber</div>
<h2>Worst five</h2>
<ol class="five">${r.worstFive.map((f) => "<li>" + tag(f.level) + ' <a href="#' + esc(f.screenId) + '">' + esc(f.screen) + "</a> · " + esc(f.problem) + " · " + esc(f.number) + (wasText(f) ? " <i>(" + esc(wasText(f)) + ")</i>" : "") + "</li>").join("") || "<li>Nothing past its limit.</li>"}</ol>
<h2>Every screen, as the review saw it</h2>
<div class="grid">${cards}</div>
<h2>The numbers</h2>
<div class="wrap"><table><thead><tr><th style="text-align:left">screen</th><th>first numbers</th><th>weight</th><th>layout shift</th><th>longest freeze</th><th>log errors</th><th>failed calls</th><th>dashes</th><th>blank boxes</th><th>old labels</th><th>picture changed</th><th>Lighthouse speed</th></tr></thead><tbody>
${rows}
</tbody></table></div>
<h2>The full ranked list (${r.findings.length})</h2>
<ol class="five">${r.findings.map((f) => "<li>" + tag(f.level) + " " + esc(f.screen) + " · " + esc(f.problem) + " · " + esc(f.number) + (wasText(f) ? " <i>(" + esc(wasText(f)) + ")</i>" : "") + "</li>").join("")}</ol>
<h2>Details per screen</h2>
${detail}
<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<p><b>What this page shows.</b> A robot opened every Scintilla screen in a browser with no window, the way a visitor would, and wrote down how slow and how glitchy each one was. It fixes nothing; it ranks, so the fix lanes know where to start.</p>
<p><b>Where each number comes from.</b> <b>First numbers</b>: the time from opening the page (or, for a Hub tab or a company view, from the click) until at least 8 number readouts, 30 ticker labels, 20 short lines carrying a figure or a drawn chart are on screen. <b>Weight</b>: every byte the browser downloaded for that screen. <b>Layout shift</b>: the browser's own measure of how much of the screen jumped without being asked (Google's scale: under 0.10 good, over 0.25 poor). <b>Longest freeze</b>: the longest stretch the page could not respond (the browser reports every stall over 0.05 s). <b>Log errors / failed calls</b>: what the browser's error log and its network list recorded (a failed call is an answer of 400 or above, or no answer). <b>Dashes</b>: readouts showing only “—”, “…”, “NaN” or “loading”. <b>Blank boxes</b>: panels at least 160×90 px with no words, no picture and no drawn chart. <b>Old labels</b>: age labels on the page (“3 d ago”) over ${Math.round(L.staleBadgeAgeMin / 60)} hours, or anything the page itself marks stale, fallback or unavailable. <b>Picture changed</b>: the share of pixels that differ from the same screen's picture in the last run of the same kind. <b>Lighthouse speed</b>: Google's public scoring tool, on a simulated mid-range phone with a slowed connection — 0 to 100; its own layout-shift reading is listed too, because a page can sit still on a fast machine and jump on a slow phone.</p>
<p><b>When a number is listed.</b> Amber / red at: first numbers ${secs(L.firstDataMs.amber)} / ${secs(L.firstDataMs.red)} · weight ${mb(L.weightKB.amber)} / ${mb(L.weightKB.red)} · layout shift ${L.layoutShift.amber} / ${L.layoutShift.red} · freeze ${secs(L.longestFreezeMs.amber)} / ${secs(L.longestFreezeMs.red)} · log errors ${L.consoleErrors.amber} / ${L.consoleErrors.red} · failed calls ${L.failedCalls.amber} / ${L.failedCalls.red} (any server error is red) · dashes ${L.placeholders.amber} / ${L.placeholders.red} · blank boxes ${L.blankPanels.amber} / ${L.blankPanels.red} · old labels ${L.staleBadges.amber} / ${L.staleBadges.red} · picture ${L.picChangedPct.amber} % / ${L.picChangedPct.red} % · Lighthouse speed at or under ${L.lighthousePerf.amber} / ${L.lighthousePerf.red}.</p>
<p><b>What could be wrong.</b> The robot runs from a data centre, not from Alan's desk: its connection is faster and its computer slower, so times differ from his. A dash can be honest (a market that is closed, a name with no such figure) — the count is a lead, not a verdict. Prices move, so some picture change is normal; only large changes are listed. Every request that would write something is blocked, so a screen that needs to write before it shows data would look emptier here than it is (${r.screens.reduce((a, s) => a + (s.blockedWrites || 0), 0)} such requests were blocked in this run). Lighthouse scores wobble by a few points run to run.</p>
<p><b>What it does not do.</b> It does not log in, press buttons beyond the master tabs and opening three company views (NVDA, BRK-B, BTCUSD), or check that a number is correct — only that one is there, on time, and not jumping.</p>
</details>
${scnav}
</body></html>
`;
  fs.writeFileSync(path.join(OUT, "index.html"), html);
}

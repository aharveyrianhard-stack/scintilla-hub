/* builds the E1 job files: node e1-jobs.mjs <prefix> <target live|local> <hubRoot|-> <width> <height> */
import fs from "node:fs"; import path from "node:path";
const [prefix, target, hubRoot, W, H] = process.argv.slice(2);
const S = "/private/tmp/claude-501/-Users-alanharvey-SCINTILLA-0-5/fd3adf3c-9b73-4014-b745-3e7fcbb6d5d4/scratchpad";
const shots = path.join(S, "shots"); const w = +W, h = +H;
const f = (n) => path.join(shots, `${prefix}-${w}-${n}.png`);
const steps = [
  { do: "load", path: "/#earnings", ms: 70000 },
  { do: "wait", ms: 2500 },
  { do: "shot", file: f("today"), label: "the room as it opens (today)" },
  { do: "rect", sels: { daySquare: ".se-sq:nth-child(1) .se-sqbody", tsmRow: '.se-drow[data-t="TSM"]', weekSquare: ".se-sq:nth-child(2) .se-sqbody", list: "#evList", tape: "#ernTape", extras: "#evExtras" } },
  { do: "click", sel: '.se-sq:nth-child(1) .se-drow[data-t="TSM"]', ms: 1200, label: "TSM in the DAY square" },
  { do: "rect", sels: { card: ".se-card", tsmRow: '.se-drow[data-t="TSM"]', pick: "#ernPick .se-card, .se-pick .se-card" } },
  { do: "eval", js: "(()=>{const c=document.querySelector('.se-card'); if(!c) return null; const f=c.querySelector('.sc-ern__foot'); return {foot:(f&&f.innerText||'').replace(/\\s+/g,' '), links:[...c.querySelectorAll('.sc-ern__foot a')].map(a=>a.getAttribute('href'))};})()" },
  { do: "shot", file: f("tsm"), label: "TSM selected" },
  { do: "click", sel: '.se-sq:nth-child(1) .se-drow[data-t="TSM"]', ms: 700, label: "close TSM" },
  { do: "click", sel: '.se-sq:nth-child(2) .se-chip[data-t="JPM"]', ms: 1200, label: "JPM in the WEEK square" },
  { do: "rect", sels: { card: ".se-card", jpmChip: '.se-chip[data-t="JPM"]' } },
  { do: "eval", js: "(()=>{const c=document.querySelector('.se-card'); if(!c) return null; const f=c.querySelector('.sc-ern__foot'); return {foot:(f&&f.innerText||'').replace(/\\s+/g,' '), links:[...c.querySelectorAll('.sc-ern__foot a')].map(a=>a.getAttribute('href'))};})()" },
  { do: "shot", file: f("jpm"), label: "JPM selected" },
  { do: "click", sel: '.se-sq:nth-child(2) .se-chip[data-t="JPM"]', ms: 700, label: "close JPM" },
  { do: "click", sel: '.se-sq:nth-child(2) [data-act="ernspan"]', ms: 1500, label: "ENLARGE the week" },
  { do: "shot", file: f("week"), label: "the week view" },
  { do: "click", sel: '[data-act="ernday"][data-d="2026-10-13"]', ms: 1200, label: "go to Tue 13 Oct (US banks)" },
  { do: "click", sel: '.se-sq:nth-child(1) [data-act="ernspan"]', ms: 1500, label: "ENLARGE the day" },
  { do: "shot", file: f("usday"), label: "a US day, 13 Oct" },
  { do: "eval", js: "(()=>{const h=document.querySelector('.se-dhd'); const cols=[...document.querySelectorAll('.se-sq.is-max .se-dcol h5')].map(e=>e.innerText.replace(/\\s+/g,' ')); return {head:h?h.innerText.replace(/\\s+/g,' '):null, cols};})()" },
];
const job = { name: `${prefix}-${w}`, target, hubRoot: hubRoot !== "-" ? hubRoot : undefined, width: w, height: h, steps };
const jf = path.join(S, "tools", `job-${prefix}-${w}.json`); fs.writeFileSync(jf, JSON.stringify(job, null, 1)); console.log(jf);

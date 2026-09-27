/* D1 — screenshots of the two layout mockups in every state the report shows, with the board's column widths
   measured from the page itself (the column budget). Headless, one page at a time. node mock-shots.mjs [only] */
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const HERE = fileURLToPath(new URL(".", import.meta.url)); const OUT = HERE + "../screens/mock"; mkdirSync(OUT, { recursive: true });
const BASE = "http://127.0.0.1:8791/deliverables/20260926/hub-layout-tape/";
const only = process.argv[2];
const COLS = `(()=>{const h=document.querySelector('#rows .hdr');if(!h)return null;return [...h.children].map(e=>({t:e.innerText.replace(/\\s+/g,' ').trim(),w:Math.round(e.getBoundingClientRect().width)}))})()`;
const BOX = `(()=>{const r=s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return {x:Math.round(b.left),y:Math.round(b.top),w:Math.round(b.width),h:Math.round(b.height)}};return {board:r('#board'),side:r('#side'),tape:r('#tape'),co:r('.d1-co'),chart:r('#chartBox'),pane:r('#pane'),gw:document.querySelector('#board')?.dataset.gw||null,sw:document.documentElement.scrollWidth,vw:innerWidth,fs:[...new Set([...document.querySelectorAll('body *')].filter(e=>e.childElementCount===0&&e.innerText&&e.innerText.trim()).map(e=>getComputedStyle(e).fontSize))].sort()}})()`;
const states = [];
for (const L of ["a", "b"]) {
  states.push({ id: `${L}-1680-board`, L, w: 1680, h: 1050, q: "" }, { id: `${L}-1440-board`, L, w: 1440, h: 900, q: "" },
    { id: `${L}-1440-meta`, L, w: 1440, h: 900, q: "?t=META&tab=CHART" }, { id: `${L}-1440-geiger`, L, w: 1440, h: 900, q: "?t=META&tab=GEIGER" },
    { id: `${L}-1680-expanded`, L, w: 1680, h: 1050, q: "?t=META&view=expanded&tab=GEIGER" }, { id: `${L}-1680-expanded-fund`, L, w: 1680, h: 1050, q: "?t=META&view=expanded&tab=FUNDAMENTALS" },
    { id: `${L}-1680-fullscreen`, L, w: 1680, h: 1050, q: "?fs=1" }, { id: `${L}-1440-fullscreen`, L, w: 1440, h: 900, q: "?fs=1" },
    { id: `${L}-390-board`, L, w: 390, h: 844, q: "", m: 1 }, { id: `${L}-390-meta`, L, w: 390, h: 844, q: "?t=META&tab=GEIGER", m: 1 });
}
const res = {};
for (const s of states) {
  if (only && !s.id.startsWith(only)) continue;
  const job = { url: BASE + `layout-${s.L}.html` + s.q + (s.q ? "&" : "?") + "tapehide=0", width: s.w, height: s.h, mobile: !!s.m, timeout: 120,
    steps: [{ until: "document.querySelectorAll('#rows .d1-row').length>10", tries: 80 }, { until: "!document.querySelector('#pane .d1-note, #chart .d1-note')", tries: 30 },
      { until: "document.querySelector('#rows .rungs i')", tries: 30 }, { wait: 2500 }, { eval: COLS, as: "cols" }, { eval: BOX, as: "box" }, { shot: `${OUT}/${s.id}.png`, full: !!s.m }] };
  const jf = `${OUT}/${s.id}.job.json`; writeFileSync(jf, JSON.stringify(job));
  try { const r = JSON.parse(execFileSync("node", [HERE + "cdp-run.mjs", jf], { timeout: 150000 }).toString()); res[s.id] = { ...r.named, untils: r.untils, errors: r.console.filter((c) => /^EXC|^error/.test(c)) }; }
  catch (e) { res[s.id] = { error: String(e.message).slice(0, 200) }; }
  console.log(s.id, JSON.stringify(res[s.id]).slice(0, 240));
}
writeFileSync(`${OUT}/measure${only ? "-" + only : ""}.json`, JSON.stringify(res, null, 1));

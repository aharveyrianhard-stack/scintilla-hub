/* R4 — one headless run per (width, ticker): the dashboard, then the company view and each named tab.
   node shots.mjs <prefix> <width> <ticker|-> <tabs,comma|-> <live|local> [path] [exp]
   live  = https://scintillahub.ai as deployed; local = this worktree served under the real hostname (the harness), so the
   chart API sees its own origin and nothing is relaxed. Never a visible window. */
import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url";
const CLIP = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "clip.js"), "utf8");
const [prefix, width, t, tabs, target, startPath, mode, lsJson] = process.argv.slice(2);   /* lsJson: extra localStorage, e.g. {"hub.company.socview":"ALL"} */
const here = path.dirname(fileURLToPath(import.meta.url)), out = path.join(here, "..", "screens");
const w = +width, mobile = w < 500, tag = `${prefix}-${w}`;
const steps = [{ do: "wait", ms: 10000 }, { do: "shot", full: false, file: path.join(out, `${tag}-board.jpg`) }, { do: "eval", js: CLIP }];
if (t && t !== "-") {
  steps.push({ do: "open", t, clouds: true, rsi: true, ms: 45000 }, { do: "wait", ms: 4000 });
  for (const tab of (tabs && tabs !== "-" ? tabs.split(",") : ["_"])) {
    if (tab !== "_") steps.push({ do: "eval", js: `(()=>{const b=document.querySelector('[data-act="cotab"][data-tab="${tab}"]'); if(b){b.click();return "clicked"} return "no tab"})()` }, { do: "wait", ms: tab === "SOCIAL" ? 8000 : 3500 });
    steps.push({ do: "shot", full: mobile, file: path.join(out, `${tag}-${t}${mode === "exp" ? "-exp" : ""}-${tab === "_" ? "view" : tab}.jpg`) });
    steps.push({ do: "eval", js: CLIP });
  }
}
const job = { name: tag, target, path: startPath || "/", hubRoot: path.resolve(here, "../../../.."), width: w, height: mobile ? 844 : (w >= 1600 ? 1050 : 900), mobile,
  localStorage: Object.assign({ "hub.company.expanded": mode === "exp" ? "1" : "0" }, lsJson ? JSON.parse(lsJson) : {}), steps };
const jf = path.join(here, `.job-${tag}-${t}.json`); fs.writeFileSync(jf, JSON.stringify(job));
const res = execFileSync("node", [path.join(here, "harness.mjs"), jf], { maxBuffer: 1 << 26, timeout: 500000 }).toString();
fs.unlinkSync(jf);
const j = JSON.parse(res);
fs.writeFileSync(path.join(here, "..", "screens", `${tag}${t && t !== "-" ? "-" + t : ""}${mode === "exp" ? "-exp" : ""}.json`), JSON.stringify(j, null, 1));
for (const r of j.results) if (r.step !== "wait") console.log(JSON.stringify(r).slice(0, 300));
console.log("errors", JSON.stringify(j.errors || j.error), "writes", j.writes.length);

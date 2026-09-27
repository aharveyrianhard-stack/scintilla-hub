/* R3 — builds one harness job per (width, ticker) and shoots every company tab. node shots.mjs <prefix> <width> <ticker> <tabs,comma> [c|exp] [hubRoot|-] [startPath]
   The tab is chosen the way a person's browser remembers it (localStorage hub.company.tab) and then by clicking the tab. */
import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url";
const [prefix, width, t, tabs, mode, hubRoot, startPath] = process.argv.slice(2);   // mode: "exp" = EXPAND on; startPath: e.g. /preview/company-view/
const here = path.dirname(fileURLToPath(import.meta.url)), out = path.join(here, "..", "screens");
const w = +width, mobile = w < 500;
const steps = [{ do: "wait", ms: 9000 }, { do: "open", t, clouds: true, rsi: true, ms: 45000 }, { do: "wait", ms: 4000 }];
for (const tab of tabs.split(",")) {
  steps.push({ do: "eval", js: `(()=>{const b=document.querySelector('[data-act="cotab"][data-tab="${tab}"]'); if(b){b.click();return "clicked"} return "no tab"})()` });
  steps.push({ do: "wait", ms: tab === "SOCIAL" ? 6000 : 3500 });
  steps.push({ do: "shot", full: mobile, file: path.join(out, `${prefix}-${t}-${w}${mode === "exp" ? "-exp" : ""}-${tab}.jpg`) });
  steps.push({ do: "rects", sels: { cv: "#cv", chart: "#cvChart", side: ".cv-side", slot: "#coRailContent" } });
  steps.push({ do: "eval", js: `(()=>{const t=document.querySelector("#cvTabs"), s=document.querySelector("#coRailContent"); return {tabsFit: t ? t.scrollWidth <= t.clientWidth : null, slotScroll: s ? s.scrollHeight + "/" + s.clientHeight : null}})()` });
}
const job = { name: prefix + "-" + t + "-" + w, target: "local", path: startPath || "/", hubRoot: (hubRoot && hubRoot !== "-") ? hubRoot : path.resolve(here, "../../../.."), width: w, height: mobile ? 844 : 1050, mobile,
  localStorage: { "hub.company.tab": tabs.split(",")[0], "hub.company.expanded": mode === "exp" ? "1" : "0" }, steps };
const jf = path.join(here, `.job-${prefix}-${t}-${w}-${mode || "c"}.json`); fs.writeFileSync(jf, JSON.stringify(job));
const res = execFileSync("node", [path.join(here, "harness.mjs"), jf], { maxBuffer: 1 << 26, timeout: 400000 }).toString();
fs.unlinkSync(jf);
const j = JSON.parse(res);
for (const r of j.results) if (r.step !== "wait") console.log(JSON.stringify(r).slice(0, 700));
console.log("errors", JSON.stringify(j.errors || j.error), "writes", j.writes.length);

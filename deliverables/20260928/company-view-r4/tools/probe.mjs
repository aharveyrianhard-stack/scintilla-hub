/* R4 dev probe: node probe.mjs <width> <ticker|-> <jsfile> [live|local] — one headless page, evals the file's JS, prints the value */
import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url";
const [width, t, jsf, target] = process.argv.slice(2);
const here = path.dirname(fileURLToPath(import.meta.url)); const w = +width, mobile = w < 500;
const steps = [{ do: "wait", ms: 9000 }];
if (t && t !== "-") steps.push({ do: "open", t, clouds: false, ms: 1000 }, { do: "wait", ms: 5000 });
steps.push({ do: "eval", js: fs.readFileSync(jsf, "utf8") });
const job = { name: "probe", target: target || "local", path: "/", hubRoot: path.resolve(here, "../../../.."), width: w, height: mobile ? 844 : 1050, mobile, localStorage: {}, steps };
const jf = path.join(here, `.job-probe-${process.pid}.json`); fs.writeFileSync(jf, JSON.stringify(job));
const res = execFileSync("node", [path.join(here, "harness.mjs"), jf], { maxBuffer: 1 << 26, timeout: 300000 }).toString(); fs.unlinkSync(jf);
const j = JSON.parse(res); console.log(JSON.stringify(j.results.filter((r) => r.step === "eval").map((r) => r.value), null, 1)); console.log("errors", JSON.stringify(j.errors || j.error));

/* Mac-side runner: ships fmp-pull.mjs to the bar-service machine through `fly ssh console -C "node -e …"` and decodes the
   one base64 line it prints. The key never leaves the Fly machine; this side sees only data.
   node research/statistics/regime/fly-run.mjs <jobs.json> <out.json> */
import fs from "node:fs"; import path from "node:path"; import zlib from "node:zlib"; import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const [jobsFile, outFile] = process.argv.slice(2);
const jobs = fs.readFileSync(jobsFile, "utf8");
const src = fs.readFileSync(path.join(here, "fmp-pull.mjs"), "utf8");
const payload = Buffer.from(`globalThis.REGIME_JOBS=${JSON.stringify(jobs)};\n` + src).toString("base64");
const cmd = `node --input-type=module -e "eval(Buffer.from('${payload}','base64').toString())"`;
// eval cannot run top-level await in module code; wrap: write to a temp file on the machine instead
const cmd2 = `sh -c "echo ${payload} | base64 -d > /tmp/regime-pull.mjs && node /tmp/regime-pull.mjs && rm -f /tmp/regime-pull.mjs"`;
const txt = execFileSync("fly", ["ssh", "console", "-a", "scintilla-massive-stocks-batch", "--machine", "82d1d96a326548", "-C", cmd2], { maxBuffer: 512 * 1024 * 1024, encoding: "utf8" });
const line = txt.split(/\r?\n/).find((l) => l.startsWith("REGIMEB64:"));
if (!line) { console.error("no payload line; tail:", txt.slice(-400)); process.exit(1); }
const data = JSON.parse(zlib.gunzipSync(Buffer.from(line.slice(10).trim(), "base64")).toString());
fs.writeFileSync(outFile, JSON.stringify(data));
for (const d of data) console.log(d.kind, d.symbol || `${d.from}..${d.to}`, d.status, d.n, d.err || "", Array.isArray(d.rows) && d.rows.length ? JSON.stringify(d.rows.at(-1)).slice(0, 90) + " … " + JSON.stringify(d.rows[0]).slice(0, 60) : "");

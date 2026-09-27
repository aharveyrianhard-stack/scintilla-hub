/* D1 — the evaluation board's thumbnails and cost. For each proposal page: load it headless at 1680x1050,
   45 s to settle (the CPU used in that window is the load cost), a thumbnail, then 60 s steady (CPU-seconds
   per minute of the whole headless Chrome process tree, plus the page's own main-thread seconds per minute).
   The same method as context lens round 3's cpu-runs.json, so the numbers compare.
   node eval-measure.mjs list.json outdir  (runs one page at a time so pages do not slow each other) */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const [LIST, OUT] = process.argv.slice(2); mkdirSync(OUT, { recursive: true });
const list = JSON.parse(readFileSync(LIST, "utf8")); const results = [];
for (const p of list) {
  const job = { url: p.url, width: p.width || 1680, height: p.height || 1050, timeout: 200,
    steps: [{ mark: "start" }, { wait: 45000 }, { mark: "loaded" }, ...(p.pre || []), { shot: `${OUT}/${p.id}.png` }, { cpu: 60 }] };
  const jf = `${OUT}/${p.id}.job.json`; writeFileSync(jf, JSON.stringify(job));
  let r; try { r = JSON.parse(execFileSync("node", [fileURLToPath(new URL("./cdp-run.mjs", import.meta.url)), jf], { timeout: 230000 }).toString()); }
  catch (e) { r = { error: String(e.message).slice(0, 200) }; }
  const row = { id: p.id, url: p.url, loadCpuS: r.marks ? +(r.marks.loaded - r.marks.start).toFixed(2) : null,
    steadyCpuSPerMin: r.cpu?.processTreeSecPerMin ?? null, mainThreadSecPerMin: r.cpu?.mainThreadSecPerMin ?? null,
    jsHeapMB: r.cpu?.jsHeapMB ?? null, nodes: r.cpu?.nodes ?? null, errors: (r.console || []).filter((c) => /^EXC|^error/.test(c)).slice(0, 5),
    overflow: r.shots?.[0]?.overflow ?? null, measured_utc: new Date().toISOString(), error: r.error || null };
  results.push(row); console.log(JSON.stringify(row));
  writeFileSync(`${OUT}/cost.json`, JSON.stringify({ method: "headless Chrome (--headless=new) on this MacBook, 1680x1050, 45 s load window then 60 s steady; CPU from ps over the whole Chrome process tree; main-thread from Performance.getMetrics TaskDuration", results }, null, 1));
}

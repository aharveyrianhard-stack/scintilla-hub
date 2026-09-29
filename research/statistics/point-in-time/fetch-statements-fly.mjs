/* R4 · quarterly income statements for every company that was ever an S&P 500 member, pulled INSIDE Fly (the key
   lives only there) and printed as values — one JSON line per company: {"s":"AAPL","q":[[date, filingDate, revenue,
   netIncome], …]}. Never the key, never a URL that carries it. Read-only: nothing is written anywhere.
   How it runs (Common rules, "short checks"): the script is base64-packed and handed to node on the batch machine —
     node research/statistics/point-in-time/fetch-statements-fly.mjs --command   → prints the fly command to run
     bash -c "$(node …/fetch-statements-fly.mjs --command)" > statements.jsonl     (fly ssh console … -C "node -e …")
   Then research/statistics/point-in-time/pit-traits.mjs --fund statements.jsonl reads it. */
import fs from "node:fs"; import path from "node:path"; import zlib from "node:zlib"; import { fileURLToPath } from "node:url";
import { PIT_ROOT } from "./build-universe.mjs";
import { everMembers } from "./pit-core.mjs";

export function symbols() {
  const M = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(PIT_ROOT, "membership.json.gz"))).toString());
  return everMembers(M.membership.SP500.intervals, "2003-01-02");
}
/** The program that runs on the machine: only fetch, only values out. */
export function program(syms) {
  return `const K=process.env.FMP_API_KEY||process.env.FMP_KEY;if(!K){console.log(JSON.stringify({err:"no FMP key in the environment"}));process.exit(1)}
const S=${JSON.stringify(syms)};let i=0;const out=(o)=>process.stdout.write(JSON.stringify(o)+"\\n");
async function one(s){const r=await fetch("https://financialmodelingprep.com/stable/income-statement?symbol="+encodeURIComponent(s.replace(/\\./g,"-"))+"&period=quarter&limit=120&apikey="+encodeURIComponent(K),{signal:AbortSignal.timeout(30000)}).catch(()=>null);
if(!r)return out({s,err:"no response"});if(!r.ok)return out({s,err:"http "+r.status});const j=await r.json().catch(()=>null);if(!Array.isArray(j))return out({s,err:"not a list"});
out({s,q:j.map(x=>[x.date,x.filingDate||x.acceptedDate||null,x.revenue==null?null:+x.revenue,x.netIncome==null?null:+x.netIncome])})}
async function w(){while(i<S.length){const s=S[i++];await one(s)}}
(async()=>{await Promise.all([w(),w(),w(),w(),w(),w()]);out({done:S.length})})().catch(e=>{out({err:String(e&&e.message||e)});process.exit(1)})`;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const syms = symbols(), b64 = Buffer.from(program(syms)).toString("base64");
  if (process.argv.includes("--command")) console.log(`fly ssh console -a scintilla-massive-stocks-batch --machine 82d1d96a326548 -C "node -e \\"eval(Buffer.from('${b64}','base64').toString())\\""`);
  else if (process.argv.includes("--b64")) process.stdout.write(b64);
  else console.log("symbols", syms.length, "program bytes", program(syms).length);
}

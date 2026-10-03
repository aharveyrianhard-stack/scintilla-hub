/* U3 · the missing daily closes, for the coordinator to run on a throw-away Fly machine (the FMP key exists only there).
   Fetches FMP /stable/batch-eod?date=YYYY-MM-DD for the last ~70 sessions and prints ONE JSON line per date
   { date, rows: [[symbol, close], …] } to stdout — never the key, never a table write. Load the output into
   data/daily-closes-20261002.json (closes[SYM] = { d, c }) and re-run build.mjs + page.mjs.
   Run: fly machine run registry.fly.io/scintilla-massive-stocks-batch:live-112d10c sleep 1500 -a scintilla-massive-stocks-batch --rm --restart no --region iad -e SERVICE=none --file-local /app/fmp-batch-eod.mjs=deliverables/20261002/served-set-v2/fmp-batch-eod.mjs --detach
        fly ssh console -a scintilla-massive-stocks-batch --machine <id> -C "node /app/fmp-batch-eod.mjs" > data/fmp-batch-eod.jsonl
        fly machine stop <id> */
const KEY = process.env.FMP_API_KEY || process.env.FMP_KEY;
if (!KEY) { console.error("no FMP key in the environment"); process.exit(2); }
const days = []; for (let d = new Date(); days.length < 100; d.setUTCDate(d.getUTCDate() - 1)) { if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue; days.push(d.toISOString().slice(0, 10)); }
for (const date of days.slice(0, 72)) {
  const r = await fetch(`https://financialmodelingprep.com/stable/batch-eod?date=${date}&apikey=${KEY}`);
  if (!r.ok) { console.error(date, "http", r.status); continue; }
  const rows = (await r.json()).map((x) => [x.symbol, x.close]).filter(([s, c]) => s && Number.isFinite(c));
  console.log(JSON.stringify({ date, rows }));
}

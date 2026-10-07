/* RS1 (7 Oct 2026) — THE NIGHTLY FUNCTION, RUN HERE BEFORE IT RUNS ANYWHERE: its own handler, under Node, share by share.
     node deliverables/20261006/rs1-rsi-own-extremes/tools/night-shares-check.mjs        (Node 23.6 or newer: it reads the .ts file as it is)
   WHY. supabase/functions/rsi-own-daily has never run on the platform, and this lane does not deploy. This is the nearest
   honest thing: the function's real code, the chart API's real bars, and STAND-INS for the two things that are not here —
     Deno          a three-line stand-in (env + serve), so the handler can be called directly
     the database  every request to it is caught here, counted and answered "created"; NOTHING IS SENT. The address is
                   fake and the key is the words "stand-in-not-a-key".
   WHAT IT ANSWERS.
     1 · do the four shares the schedule asks for cover every name once and only once?
     2 · what does a share write, in how many writes — and does a dry call write nothing?
     3 · if the database refuses a write halfway, what was already saved?
     4 · how much CPU does one call use here, for a quarter of the night and for the whole night? (the platform allows 2 s)
   Writes rec-night-shares.json beside this file. */
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const COLD = process.argv.includes("--cold-whole-night");       // a fresh process whose FIRST call is the whole night
const FAKE_DB = "https://database.stand-in.invalid";
let writes = [], failOn = 0, bytes = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.startsWith(FAKE_DB)) {
    const rows = JSON.parse(init.body || "[]");
    writes.push({ method: init.method, path: u.slice(FAKE_DB.length), rows: rows.length, tickers: rows.map((r) => r.ticker),
      whole_rows: rows.every((r) => Array.isArray(r.grid) && r.grid.length === 101 && typeof r.computed_at === "string" && typeof r.as_of === "string") });
    if (failOn && writes.length === failOn) return new Response("stand-in refused this write", { status: 500 });
    return new Response("", { status: 201 });
  }
  if ((init.method || "GET") !== "GET") throw new Error("a non-GET left for somewhere that is not the stand-in: " + u);
  const r = await realFetch(url, init), t = await r.text(); bytes += t.length;
  return new Response(t, { status: r.status, headers: { "content-type": "application/json" } });
};
let handler = null;
globalThis.Deno = { env: { get: (k) => ({ SUPABASE_URL: FAKE_DB, SUPABASE_SERVICE_ROLE_KEY: "stand-in-not-a-key" }[k]) }, serve: (fn) => { handler = fn; } };
await import(new URL("../../../../supabase/functions/rsi-own-daily/index.ts", import.meta.url));
const { NIGHT_SHARES } = await import(new URL("../../../../supabase/functions/rsi-own-daily/rsi-own.mjs", import.meta.url));
const call = async (q, refuseWrite = 0) => {
  writes = []; failOn = refuseWrite; bytes = 0; const c0 = process.cpuUsage(), t0 = Date.now();
  const r = await handler(new Request("https://functions.stand-in.invalid/rsi-own-daily" + q)), j = await r.json(), c = process.cpuUsage(c0);
  return { query: q, status: r.status, answer: { ok: j.ok, dry: j.dry, names: j.symbols, listed: j.listed, part: j.part, of: j.of, bars_per_name: j.bars_per_name, rows: j.rows, written: j.written, eligible: j.eligible, under_one_year: j.under_one_year, no_bars: j.candle_failures, as_of: j.as_of, error: j.error },
    wall_s: +((Date.now() - t0) / 1000).toFixed(1), cpu_ms: Math.round((c.user + c.system) / 1000), json_read_mb: +(bytes / 1e6).toFixed(1),
    database_writes: writes.map((w) => ({ rows: w.rows, whole_rows: w.whole_rows, method: w.method, path: w.path })), _tickers: writes.flatMap((w) => w.tickers) };
};
if (COLD) { const x = await call("?dry=1"); console.log(JSON.stringify({ status: x.status, rows: x.answer.rows, cpu_ms: x.cpu_ms, wall_s: x.wall_s, json_read_mb: x.json_read_mb })); process.exit(0); }
const out = { made: new Date().toISOString(), machine: os.cpus()[0].model, node: process.version, platform_cpu_allowance_ms: 2000, shares: NIGHT_SHARES };
await call("?dry=1&part=1&of=" + NIGHT_SHARES);                                   // warm-up (a cold first call is measured again below)
/* 1 + 2 · each share, writing to the stand-in */
out.each_share = [];
const seen = [];
for (let k = 1; k <= NIGHT_SHARES; k++) { const x = await call(`?part=${k}&of=${NIGHT_SHARES}`); seen.push(x._tickers); delete x._tickers; out.each_share.push(x); }
const all = seen.flat();
out.cover = { names_listed: out.each_share[0].answer.listed, rows_written_across_shares: all.length, distinct: new Set(all).size, a_name_in_two_shares: all.length !== new Set(all).size,
  share_sizes: out.each_share.map((x) => x.answer.names), first_and_last_of_each: seen.map((s) => [...s].sort()).map((s) => s[0] + " … " + s[s.length - 1]) };
/* 2 · a dry call */
const dry = await call(`?dry=1&part=2&of=${NIGHT_SHARES}`); delete dry._tickers; out.dry_share = dry;
/* 3 · the database refuses the second write of a share */
const cut = await call(`?part=3&of=${NIGHT_SHARES}`, 2); out.refused_second_write = { status: cut.status, error: cut.answer.error, writes_attempted: cut.database_writes.length, rows_saved_before_the_refusal: cut.database_writes[0] ? cut.database_writes[0].rows : 0 };
/* 4 · the whole night in one call, dry — what the 6 Oct schedule would have asked for */
const whole = await call("?dry=1"); delete whole._tickers; out.whole_night_in_one_call = whole;
/* …and the same call as the first thing a fresh process does: the platform starts a call cold */
out.whole_night_in_one_call_cold = JSON.parse(execFileSync(process.execPath, ["--no-warnings", fileURLToPath(import.meta.url), "--cold-whole-night"], { encoding: "utf8" }).trim().split("\n").pop());
out.cpu = { a_share_ms: out.each_share.map((x) => x.cpu_ms), whole_night_ms: whole.cpu_ms, whole_night_cold_ms: out.whole_night_in_one_call_cold.cpu_ms, note: "CPU of this whole Node process (all threads), on the machine named above; the platform's cores are slower and its limit is per call" };
fs.writeFileSync(new URL("rec-night-shares.json", import.meta.url), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ machine: out.machine, cover: out.cover, share_writes: out.each_share.map((x) => x.database_writes.map((w) => w.rows).join("+")), share_status: out.each_share.map((x) => x.status), dry_share_writes: dry.database_writes.length, dry_rows: dry.answer.rows,
  refused_second_write: out.refused_second_write, cpu: out.cpu, whole_night: { status: whole.status, rows: whole.answer.rows, json_read_mb: whole.json_read_mb, wall_s: whole.wall_s } }, null, 1));

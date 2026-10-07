// HC1 — the FAVORITES cap, proven on a real Postgres engine that is NOT production.
//
// It builds public.station_lists exactly as the live catalog describes it (read 6 Oct, catalog SELECT only), loads the
// copy of the live rows saved in ../data/lists-as-read.json (read by GET), and then:
//   1. sends the write the Hub sent when Alan starred EQIX (the whole list, EQIX at position 65) → refused, as on live;
//   2. applies station_lists_cap_500.sql.txt (beside this file; NOT APPLIED to production) → the same write is accepted;
//   3. checks the new edges (500 accepted, 501 refused);
//   4. runs the ROLLBACK while FAVORITES holds 65 → it refuses and changes nothing;
//   5. takes the 65th name off and runs the ROLLBACK again → the cap is 64 again.
// Nothing here reaches the network. The engine is PGlite (Postgres compiled to run inside Node), installed outside the repo:
//   PGLITE=/path/to/node_modules/@electric-sql/pglite node deliverables/20261006/hc1-compare-one-screen/data/not-applied/migration-check.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));          // …/data/not-applied
const D = path.resolve(HERE, "..", "..");
const PGLITE = process.env.PGLITE;
if (!PGLITE) { console.error("set PGLITE to the folder of @electric-sql/pglite"); process.exit(2); }
const { PGlite } = await import(pathToFileURL(path.join(PGLITE, "dist", "index.js")).href);

const live = JSON.parse(fs.readFileSync(path.join(D, "data", "lists-as-read.json"), "utf8"));
const UP = fs.readFileSync(path.join(HERE, "station_lists_cap_500.sql.txt"), "utf8");
const DOWN = fs.readFileSync(path.join(HERE, "station_lists_cap_500_ROLLBACK.sql.txt"), "utf8");

const db = new PGlite();
const out = { engine: null, steps: [] };
const step = (name, ok, detail) => { out.steps.push({ name, ok, ...detail }); console.log((ok ? "PASS " : "FAIL ") + name + (detail && detail.note ? " — " + detail.note : "")); };
const capDef = async () => (await db.query("select pg_get_constraintdef(oid) as def from pg_constraint where conrelid = 'public.station_lists'::regclass and conname = 'station_lists_position_check'")).rows[0].def;
const count = async (list) => +(await db.query("select count(*)::int as n from public.station_lists where list = $1", [list])).rows[0].n;
/* the Hub's own write: one statement, every position of the list, merged on (list, position) — listStore() */
async function hubWrite(list, tickers) {
  const vals = tickers.map((_, i) => `($1, ${i + 1}, $${i + 2}, now())`).join(", ");
  try {
    await db.query(`insert into public.station_lists (list, position, ticker, updated_at) values ${vals}
                    on conflict (list, position) do update set ticker = excluded.ticker, updated_at = excluded.updated_at`, [list, ...tickers]);
    await db.query("delete from public.station_lists where list = $1 and position > $2", [list, tickers.length]);
    return { ok: true };
  } catch (e) { return { ok: false, code: e.code, message: e.message, constraint: e.constraint || null }; }
}

out.engine = (await db.query("select version() as v")).rows[0].v;
/* the table as the live catalog has it: columns, primary key and the three checks */
await db.exec(`
  create table public.station_lists (
    list text not null,
    position integer not null,
    ticker text not null,
    updated_at timestamptz not null default now(),
    constraint station_lists_pkey primary key (list, position),
    constraint station_lists_list_check check (list ~ '^[a-z_]{2,24}$'),
    constraint station_lists_position_check check (position >= 1 and position <= 64),
    constraint station_lists_ticker_check check (ticker ~ '^[A-Z0-9.\\-]{1,12}$')
  );`);
for (const r of live.station_lists) await db.query("insert into public.station_lists (list, position, ticker, updated_at) values ($1, $2, $3, $4)", [r.list, r.position, r.ticker, r.updated_at]);
const favs = live.station_lists.filter((r) => r.list === "favorites").sort((a, b) => a.position - b.position).map((r) => r.ticker);
step("the copy matches what was read from live", (await count("favorites")) === favs.length && favs.length === 64,
  { note: favs.length + " favorites, the last one " + favs[favs.length - 1] + "; cap is " + await capDef() });

/* 1 — the write that failed for Alan */
for (const t of ["EQIX", "CRWD", "NET", "OKTA"]) {
  const r = await hubWrite("favorites", favs.concat([t]));
  step("as on live: adding " + t + " as the 65th name is refused and nothing is written", !r.ok && r.code === "23514" && (await count("favorites")) === 64,
    { code: r.code, message: r.message, constraint: r.constraint, note: "SQLSTATE " + r.code + " · " + r.message });
}
const radar = live.station_lists.filter((r) => r.list === "radar").sort((a, b) => a.position - b.position).map((r) => r.ticker);
const rr = await hubWrite("radar", radar.concat(["EQIX"]));
step("RADAR (" + radar.length + " names) still takes a name under the old cap", rr.ok && (await count("radar")) === radar.length + 1, { note: "so it is the list's size, not the name" });
await hubWrite("radar", radar);

/* 2 — the fix */
await db.exec(UP);
step("the migration runs and the cap reads 500", /<= 500/.test(await capDef()), { note: await capDef() });
await db.exec(UP);
step("the migration can be run twice", /<= 500/.test(await capDef()), {});
const a = await hubWrite("favorites", favs.concat(["EQIX"]));
step("after the migration EQIX is stored as the 65th name", a.ok && (await count("favorites")) === 65, { note: "position " + (await db.query("select position from public.station_lists where list='favorites' and ticker='EQIX'")).rows[0].position });

/* 3 — the new edges */
const many = Array.from({ length: 500 }, (_, i) => "T" + i);
const e500 = await hubWrite("zz_edge", many), e501 = await hubWrite("zz_edge", many.concat(["T500"]));
step("500 names are accepted and the 501st is refused", e500.ok && !e501.ok && e501.code === "23514" && (await count("zz_edge")) === 500, { note: e501.message });
await db.query("delete from public.station_lists where list = 'zz_edge'");
const bad = await hubWrite("favorites", favs.concat(["EQIX", "ES=F"]));
step("the ticker rule is untouched (ES=F is still refused)", !bad.ok && /ticker_check/.test(bad.message) && (await count("favorites")) === 65, { note: bad.message });

/* 4 — the rollback refuses while a list is longer than 64 */
let refused = null;
try { await db.exec(DOWN); } catch (e) { refused = e.message; }
try { await db.exec("rollback"); } catch (_) {}
step("the rollback refuses while FAVORITES holds 65 names, and changes nothing", !!refused && /more than 64/.test(refused) && /<= 500/.test(await capDef()) && (await count("favorites")) === 65, { note: refused });

/* 5 — and runs once the list fits */
await hubWrite("favorites", favs);
await db.exec(DOWN);
step("with 64 names the rollback runs and the cap reads 64 again", /<= 64/.test(await capDef()) && (await count("favorites")) === 64, { note: await capDef() });
const again = await hubWrite("favorites", favs.concat(["EQIX"]));
step("…and the 65th name is refused again, as before the fix", !again.ok && again.code === "23514", {});

out.pass = out.steps.every((s) => s.ok);
fs.writeFileSync(path.join(HERE, "migration-check.json"), JSON.stringify(out, null, 1));
console.log(out.pass ? "ALL PASS" : "SOME FAILED", "·", out.engine.split(" on ")[0]);
await db.close();
process.exit(out.pass ? 0 : 1);

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
function fn(name) { const s = page.search(new RegExp("^(async )?function " + name + "\\b", "m")); assert.ok(s >= 0, name); const e = page.indexOf("\n}\n", s); return page.slice(s, e + 3); }
const consts = page.match(/const EST_TTL_MS = [^\n]*\n/)[0] + page.match(/const EST_CACHE = [^\n]*\n/)[0] + page.match(/const NTM_STORED_MAX_AGE_MS = [^\n]*\n/)[0] + page.match(/const estDate = [^\n]*\n/)[0];

test("estimates are read in full through pages of 1,000 (the annual read has 1,501 rows)", async () => {
  const calls = [];
  const pages = [Array.from({ length: 1000 }, (_, i) => ({ i })), Array.from({ length: 501 }, (_, i) => ({ i: 1000 + i }))];
  const pg = async (path) => { calls.push(path); const off = +(/offset=(\d+)/.exec(path)[1]); return pages[off / 1000] || []; };
  const pgAll = new Function("pg", consts + fn("pgAll") + "return pgAll;")(pg);
  const rows = await pgAll("analyst_estimates?select=x");
  assert.equal(rows.length, 1501);
  assert.deepEqual(calls.map((c) => /limit=1000&offset=(\d+)/.exec(c)[1]), ["0", "1000"]);
  assert.match(page, /loadEstimates\(\),   \/\/ FORWARD EPS/);
  assert.doesNotMatch(page, /scOpt\('analyst_estimates', pg\("analyst_estimates\?select=ticker,est_eps_avg,fiscal_date&period=eq\.annual/, "the capped single read is gone");
});

test("the board multiple is on the STATS tab's basis: NTM from four quarters, else annual; stale stored NTM is not used", () => {
  const env = { NTMLIVE: { A: 4.0, N: -0.4 }, NTMLIVE_META: { A: { through: "2027-06-30", at: 1789690620 }, N: { through: "2027-06-30", at: 1789690620 } },
    NTMEPS: { A: 3.0, B: 2.0, N: 0.0261 }, NTMEPS_AT: { A: 1783300000, B: 1783300000, N: 1783300000 },   // 2026-07-06: stale
    FEPS: { B: 5.0, C: 10 }, FEPS_META: { B: { fy: "2026-12-31", at: 1789690620 }, C: { fy: "2026-12-31", at: 1789690620 } }, PRICES: { A: 100, B: 100, N: 5, C: 100 } };
  const src = consts + fn("fpeBasis") + fn("fpeTitle") + fn("fpeVal") + "return { fpeBasis, fpeTitle, fpeVal };";
  const api = new Function("NTMLIVE", "NTMLIVE_META", "NTMEPS", "NTMEPS_AT", "FEPS", "FEPS_META", "PRICES", "cryptoSet", src)(env.NTMLIVE, env.NTMLIVE_META, env.NTMEPS, env.NTMEPS_AT, env.FEPS, env.FEPS_META, env.PRICES, new Set(["BTCUSD"]));
  assert.equal(api.fpeVal("A", 100), 25, "live NTM 4.0 wins over the frozen stored 3.0");
  assert.equal(api.fpeVal("B", 100), 20, "stale stored NTM (2026-07-06) is skipped → annual 5.0");
  assert.equal(api.fpeVal("N", 5), null, "negative live NTM → no multiple (NIO showed 138.7× on the frozen +0.0261)");
  assert.equal(api.fpeVal("C", 100), 10);
  assert.equal(api.fpeVal("BTCUSD", 100), null);
  assert.match(api.fpeTitle("A"), /NTM · next 4 quarters to 2027-06-30 · EPS 4\.00 · estimate as of 2026-09-18/);
  assert.match(api.fpeTitle("B"), /FY26 consensus \(annual\)/);
  assert.match(api.fpeTitle("N"), /consensus EPS is not positive/);
  assert.match(api.fpeTitle("ZZZ"), /no forward EPS estimate stored/);
  assert.match(page, /title="' \+ esc\(fpeTitle\(d\.t\)\) \+ '">' \+ \(d\.fpe != null/, "the cell carries its basis and source date");
});

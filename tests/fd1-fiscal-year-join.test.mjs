/* FD1 (7 Oct 2026) — the fiscal-year join, pinned on Micron's moved key.
   FMP dated Micron's fiscal 2027 "28 Aug 2027" in the 11 Aug copy and "3 Sep 2027" from 2 Oct on (its fiscal 2026 ended on
   3 Sep, a 53-week year). ER1 reported that the ESTIMATES tab's revision strip therefore could not join Micron's copies.
   Tested here on the database's own rows of 7 Oct (tests/fixtures/fd1-estimate-copies-20261007.json):
     · the Hub's strip DOES join them — it has matched "the nearest fiscal end within 45 days" since 2 Oct (R3);
     · the reader that did not is the decision cards' (card-data.py keyed the copies by the exact date): it is fixed;
     · one rule for every reader, lib/fiscal-year.mjs, with its Python twin for the card tool. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import * as FY from "../lib/fiscal-year.mjs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const FX = JSON.parse(read("tests/fixtures/fd1-estimate-copies-20261007.json")), TODAY = FX.today;
const near = (a, b, eps, msg) => assert.ok(a != null && Math.abs(a - b) <= eps, `${msg || ""} ${a} vs ${b}`);
const MOVED = { MU: ["2027-08-28", "2027-09-03"], COST: ["2027-08-30", "2027-08-31"], CSCO: ["2027-07-25", "2027-07-26"], LITE: ["2027-06-27", "2027-06-28"] };

/* the Hub page's own picker, lifted from index.html exactly as tests/r3-revisions-history-20261002.test.mjs lifts it */
const html = read("index.html");
const a = html.indexOf("/* R2C-REVISIONS:BEGIN"), b = html.indexOf("/* R2C-REVISIONS:END */"), a3 = html.indexOf("/* R3-REVISIONS:BEGIN"), b3 = html.indexOf("/* R3-REVISIONS:END */");
const escSrc = html.slice(html.indexOf("const esc = (s) =>"), html.indexOf("const el = (id) =>")), secSrc = html.slice(html.indexOf("const estSechead = (n, t, meta) =>"), html.indexOf("/* 01 FORECAST — one metric tile"));
const ctx = { todayISO: () => TODAY, pg: () => Promise.resolve([]) }; vm.createContext(ctx);
vm.runInContext(escSrc + secSrc + html.slice(a, b) + html.slice(a3, b3) + "; Object.assign(this, { revEstPick, revEstHTML });", ctx);

test("the key moved, in the database's own rows: Micron 28 Aug → 3 Sep; Costco, Cisco and Lumentum by one day", () => {
  assert.deepEqual(FX.copies_on_file.filter((d) => d >= "2026-08-01"), ["2026-08-11", "2026-10-02", "2026-10-05", "2026-10-06"]);
  for (const [t, [k1, k2]] of Object.entries(MOVED)) {
    const fy1 = FX.forecast_years[t][0], keys = FY.copiesOfFiscalYear(FX.rows[t], fy1).keys;
    assert.deepEqual(keys, [k1, k2], t); assert.ok(keys.includes(fy1));
    assert.equal(FY.fiscalYearOf(k1), 2027); assert.equal(FY.fiscalYearOf(k2), 2027); assert.ok(FY.sameFiscalYear(k1, k2));
  }
  const mu = FX.rows.MU, aug = mu.filter((r) => r.as_of_date === "2026-08-11").map((r) => r.fiscal_date.slice(5)), oct = mu.filter((r) => r.as_of_date === "2026-10-06").map((r) => r.fiscal_date.slice(5));
  assert.ok(aug.every((d) => d === "08-28") && oct.every((d) => d === "09-03"), "every Micron year carries the old key in August and the new one in October");
  for (const t of ["NVDA", "GOOGL"]) assert.equal(FY.copiesOfFiscalYear(FX.rows[t], FX.forecast_years[t][0]).keys.length, 1, t + " did not move");
});
test("joined on the date Micron's FY27 reads +1.7% over three copies; joined on the fiscal year, +12.4% over four — and FY28 +24.5%, not +1.2%", () => {
  const [fy27, fy28] = FX.forecast_years.MU; assert.equal(fy27, "2027-09-03"); assert.equal(fy28, "2028-09-03");
  const old = FY.revisionOnExactDate(FX.rows.MU, fy27, "eps_avg"), now = FY.revisionOf(FX.rows.MU, fy27, "eps_avg");
  assert.equal(old.copies, 3); assert.equal(old.from, "2026-10-02"); near(old.pct, 1.7, 0.06); assert.equal(old.key_moved, false);
  assert.equal(now.copies, 4); assert.equal(now.from, "2026-08-11"); assert.equal(now.to, "2026-10-06"); assert.equal(now.days, 56); assert.equal(now.then, 154.66622); assert.equal(now.now, 173.77169); near(now.pct, 12.35, 0.06); assert.equal(now.key_moved, true);
  near(FY.revisionOnExactDate(FX.rows.MU, fy28, "eps_avg").pct, 1.2, 0.06); near(FY.revisionOf(FX.rows.MU, fy28, "eps_avg").pct, 24.5, 0.06);
  near(FY.revisionOf(FX.rows.MU, fy27, "revenue_avg").pct, (276062638415 / 249491340729 - 1) * 100, 1e-6);
  /* the three that moved by a day lose their August copy the same way */
  for (const [t, was, is] of [["COST", 0, 0.5], ["CSCO", 0, 6.5], ["LITE", 0.2, 16.8]]) { const f = FX.forecast_years[t][0], x = FY.revisionOnExactDate(FX.rows[t], f, "eps_avg"), y = FY.revisionOf(FX.rows[t], f, "eps_avg"); assert.equal(x.copies, 3); assert.equal(y.copies, 4); near(x.pct, was, 0.06, t); near(y.pct, is, 0.06, t); }
  /* a company whose key did not move reads the same both ways */
  for (const t of ["NVDA", "GOOGL"]) for (const f of FX.forecast_years[t]) assert.deepEqual(FY.revisionOf(FX.rows[t], f, "eps_avg"), FY.revisionOnExactDate(FX.rows[t], f, "eps_avg"), t + " " + f);
});
test("the Hub's ESTIMATES strip already joins Micron's copies (R3's nearest fiscal end within 45 days) — on today's rows, FY+1 and FY+2", () => {
  for (const t of Object.keys(FX.rows)) {
    const P = ctx.revEstPick(FX.rows[t], TODAY);
    assert.equal(P.newest, "2026-10-06"); assert.deepEqual([...P.fy.map((f) => f.fiscal)], FX.forecast_years[t], t + ": FY+1 and FY+2 are the two forecast years");
    assert.deepEqual([...P.cols.map((c) => c.asOf)], [null, "2026-08-11", null], "the 60-day column is the 11 Aug copy (57 days back)");
    for (const f of P.fy) {
      const mine = FY.pickFiscalYear(FX.rows[t].filter((r) => r.as_of_date === "2026-08-11"), f.fiscal);
      assert.ok(f.past[1], t + " " + f.fiscal + ": the August copy is joined"); assert.equal(f.past[1].fiscal_date, mine.fiscal_date, "the strip's pick is the shared rule's pick"); assert.equal(f.past[1].eps_avg, mine.eps_avg);
      assert.ok(FY.sameFiscalYear(f.past[1].fiscal_date, f.fiscal));
    }
  }
  const P = ctx.revEstPick(FX.rows.MU, TODAY);
  assert.equal(P.fy[0].past[1].fiscal_date, "2027-08-28"); assert.equal(+P.fy[0].past[1].eps_avg, 154.66622); assert.equal(+P.fy[0].now.eps_avg, 173.77169);
  assert.equal(P.fy[1].past[1].fiscal_date, "2028-08-28"); assert.equal(+P.fy[1].past[1].eps_avg, 166.89347);
  const h = ctx.revEstHTML("MU", { rows: [], est: FX.rows.MU }, TODAY);
  assert.match(h, /\$173\.77/); assert.match(h, /\$154\.67/); assert.match(h, /<span class="up">\+12%<\/span>/, "what Alan sees: FY+1 EPS 154.67 → 173.77, +12%");
  assert.match(h, /<span class="up">\+24%<\/span>/, "FY+2 EPS 166.89 → 207.75");
  assert.match(html, /matched by the nearest fiscal end within 45 days \(FMP moves a year-end by days: Micron's FY27 was dated/);
  assert.match(html, /if \(off <= 45 && \(!b \|\| off < b\.off\)\) b = \{ r, off \};/, "the strip's reach is the shared rule's");
  assert.equal(FY.FY_MATCH_DAYS, 45);
});
test("the rule: one fiscal year whatever its key; never two different years; a 53-week year ending in January stays with its December neighbours", () => {
  assert.equal(FY.fiscalYearOf("2027-08-28"), 2027); assert.equal(FY.fiscalYearOf("2027-09-03"), 2027);
  assert.equal(FY.fiscalYearOf("2026-12-27"), 2026); assert.equal(FY.fiscalYearOf("2027-01-02"), 2026, "a year ending 2 Jan 2027 is fiscal 2026"); assert.ok(FY.sameFiscalYear("2026-12-27", "2027-01-02"));
  assert.equal(FY.fiscalYearOf("2028-01-25"), 2028, "Nvidia's year to late January"); assert.equal(FY.fiscalYearOf("2026-12-31"), 2026); assert.equal(FY.fiscalYearOf("not a date"), null); assert.equal(FY.fiscalYearOf(null), null);
  assert.ok(!FY.sameFiscalYear("2027-09-03", "2028-09-03")); assert.ok(!FY.sameFiscalYear("2027-09-03", "2026-09-03")); assert.ok(FY.sameFiscalYear("2027-09-03", "2027-10-18")); assert.ok(!FY.sameFiscalYear("2027-09-03", "2027-10-19"), "45 days, no more");
  assert.equal(FY.sameFiscalYear("2027-09-03", "x"), false);
  /* a year-end moved by months (a changed fiscal year) is left unjoined: the two years cover different months */
  assert.equal(FY.pickFiscalYear([{ fiscal_date: "2027-12-31", v: 1 }], "2027-09-30"), null);
  /* two rows of one year in ONE copy (FMP mid-move): the nearer date wins, and an exact date always wins */
  const both = [{ fiscal_date: "2027-08-28", v: "old" }, { fiscal_date: "2027-09-03", v: "new" }];
  assert.equal(FY.pickFiscalYear(both, "2027-09-03").v, "new"); assert.equal(FY.pickFiscalYear(both, "2027-08-28").v, "old"); assert.equal(FY.pickFiscalYear(both, "2027-09-01").v, "new");
  assert.equal(FY.pickFiscalYear([], "2027-09-03"), null); assert.equal(FY.pickFiscalYear(null, "2027-09-03"), null);
  assert.equal(FY.revisionOf([{ fiscal_date: "2027-09-03", as_of_date: "2026-10-06", eps_avg: 1 }], "2027-09-03", "eps_avg"), null, "one copy is no revision");
  assert.equal(FY.revisionOf([{ fiscal_date: "2027-09-03", as_of_date: "2026-10-05", eps_avg: -2 }, { fiscal_date: "2027-09-03", as_of_date: "2026-10-06", eps_avg: -1 }], "2027-09-03", "eps_avg").pct, null, "no percentage off a loss");
  assert.equal(FY.daysApart("2026-10-06", "2026-08-11"), 56);
});
test("the decision cards' reader is fixed: it finds a fiscal year's copies by the rule, not by the date; the Python twin answers as the JavaScript does", (t) => {
  const src = read("deliverables/20261006/decision-cards/tools/card-data.py");
  assert.match(src, /from fiscal_year import copies_of_fiscal_year/); assert.match(src, /copies_of_fiscal_year\(SNAP\.get\(t,\[\]\),f\['fiscal_date'\]\)/);
  assert.ok(!/SNAP\.(get|setdefault)\(\(/.test(src), "no (ticker, date) key is left");
  assert.match(src, /'keys':keys,'key_moved':len\(keys\)>1/);
  const py = read("deliverables/20261006/decision-cards/tools/fiscal_year.py");
  assert.match(py, /FY_MATCH_DAYS = 45/); assert.match(py, /FY_SHIFT_DAYS = 15/);
  const dir = fileURLToPath(new URL("../deliverables/20261006/decision-cards/tools/", import.meta.url)), fixture = fileURLToPath(new URL("./fixtures/fd1-estimate-copies-20261007.json", import.meta.url));
  const code = `import sys, json\nsys.path.insert(0, ${JSON.stringify(dir)})\nimport fiscal_year as F\nfx = json.load(open(${JSON.stringify(fixture)}))\nout = {}\nfor t, rows in fx["rows"].items():\n    for f in fx["forecast_years"][t]:\n        cp, keys = F.copies_of_fiscal_year(rows, f)\n        out[t + "|" + f] = {"copies": [[r["as_of_date"], r["fiscal_date"], r["eps_avg"]] for r in cp], "keys": keys, "fy": F.fiscal_year_of(f)}\nout["_"] = [F.fiscal_year_of("2027-01-02"), F.same_fiscal_year("2027-09-03", "2027-10-18"), F.same_fiscal_year("2027-09-03", "2027-10-19"), F.days_apart("2026-10-06", "2026-08-11")]\nprint(json.dumps(out))`;
  const r = spawnSync("python3", ["-c", code], { encoding: "utf8" });
  if (r.error || r.status !== 0) { t.diagnostic("python3 is not available here: the twin was checked by its text only — " + String((r.error && r.error.message) || r.stderr).slice(0, 120)); return; }
  const out = JSON.parse(r.stdout);
  assert.deepEqual(out._, [2026, true, false, 56]);
  for (const [tk, rows] of Object.entries(FX.rows)) for (const f of FX.forecast_years[tk]) {
    const js = FY.copiesOfFiscalYear(rows, f), p = out[tk + "|" + f];
    assert.deepEqual(p.copies, js.copies.map((x) => [x.as_of_date, x.fiscal_date, x.eps_avg]), tk + " " + f); assert.deepEqual(p.keys, js.keys); assert.equal(p.fy, FY.fiscalYearOf(f));
  }
  assert.equal(out["MU|2027-09-03"].copies.length, 4); assert.deepEqual(out["MU|2027-09-03"].copies[0], ["2026-08-11", "2027-08-28", 154.66622]);
});

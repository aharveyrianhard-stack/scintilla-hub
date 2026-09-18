import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fn = (re) => page.match(re)[0];
const split = new Function(fn(/function callDayWindow\(day, n\) \{[\s\S]*?\n\}\n/) + fn(/function splitPastEarnings\(past, all\) \{[\s\S]*?\n\}\n/) + "return splitPastEarnings;")();
const escSrc = fn(/const esc = \(s\) => String\(s == null \? "" : s\)\n[\s\S]*?"&#39;"\);/);
const groupHTML = new Function("fmtEvDate", escSrc + "\n" + fn(/function pastNoResultHTML\(list\) \{[\s\S]*?\n\}\n/) + "return pastNoResultHTML;")((d) => "D" + d);
const row = (ticker, date, eps_actual = null, revenue_actual = null) => ({ ticker, date, eps_actual, revenue_actual, eps_estimate: 1, revenue_estimate: 1 });

/* the stored rows of 2026-09-18 (read-only read, evidence/past-cards) */
const ORCL = [row("ORCL", "2026-09-10", 1.92, 19345000000), row("ORCL", "2026-09-08"), row("ORCL", "2026-06-10", 2.11, 19184000000)];
const SNPS = [row("SNPS", "2026-09-08"), row("SNPS", "2026-08-26", 3.91, 2476822000), row("SNPS", "2026-08-19"), row("SNPS", "2026-05-27", 3.35, 2275985000)];
const BABA = [row("BABA", "2026-09-04"), row("BABA", "2026-08-28"), row("BABA", "2026-08-20", 1.25, 39639000000), row("BABA", "2026-05-13", 0.09, 35273060000)];

test("the three cards Alan saw: a past date with no stored result is never among the reported, and says where that company's result is stored", () => {
  const all = [...ORCL, ...SNPS, ...BABA], s = split(all, all);
  assert.deepEqual(s.reported.map((r) => r.ticker + " " + r.date), ["ORCL 2026-09-10", "ORCL 2026-06-10", "SNPS 2026-08-26", "SNPS 2026-05-27", "BABA 2026-08-20", "BABA 2026-05-13"], "order kept, only rows with a stored result");
  assert.deepEqual(s.noResult.map((x) => [x.row.ticker, x.row.date, x.stored && x.stored.date, x.stored && x.stored.gap]), [
    ["ORCL", "2026-09-08", "2026-09-10", 2], ["SNPS", "2026-09-08", "2026-08-26", -13], ["SNPS", "2026-08-19", "2026-08-26", 7], ["BABA", "2026-09-04", "2026-08-20", -15], ["BABA", "2026-08-28", "2026-08-20", -8]]);
});

test("nothing is invented: no reported row of the same company within 45 days means the row only says it has no result", () => {
  const s = split([row("X", "2026-08-01")], [row("X", "2026-08-01"), row("X", "2026-05-01", 1, 1), row("Y", "2026-08-02", 1, 1)]);
  assert.equal(s.noResult[0].stored, null, "92 days away is another quarter; another company's result is not this company's");
  assert.deepEqual(split([row("X", "2026-08-01")], [row("X", "2026-09-15", 1, 1)]).noResult[0].stored, { date: "2026-09-15", gap: 45 });
  assert.equal(split([row("X", "2026-08-01")], [row("X", "2026-09-16", 1, 1)]).noResult[0].stored, null, "46 days is outside");
  assert.equal(split([row("X", "2026-08-01", null, 5)], []).reported.length, 1, "a stored revenue alone is a stored result");
  assert.equal(split([row("X", "2026-08-01", 0, null)], []).reported.length, 1, "a stored 0 is a stored result");
  assert.deepEqual(split([row("X", "not-a-day")], [row("X", "2026-08-01", 1, 1)]).noResult[0].stored, null);
  assert.doesNotThrow(() => split([null, {}, row(null, "2026-08-01")], [null, {}, row("X", "2026-13-40", 1, 1)]));
  assert.deepEqual(split(undefined, undefined), { reported: [], noResult: [] });
});

test("the group is closed by default, says plainly these are not reports, and escapes stored values", () => {
  const s = split([...ORCL], ORCL), h = groupHTML(s.noResult);
  assert.match(h, /^<details class="sc-ernnores-grp" title="[^"]*None of these is a report\."><summary>1 past date has no stored result — not reports<\/summary>/);
  assert.doesNotMatch(h, /<details[^>]* open/);
  assert.match(h, /<span class="tk" data-tkopen="ORCL">ORCL<\/span><span class="d">D2026-09-08<\/span><span class="t">no result stored for this date — this company's results are stored on <b>D2026-09-10<\/b> \(2 days later\)<\/span>/);
  assert.match(groupHTML(split(SNPS, SNPS).noResult), /<summary>2 past dates have no stored result/);
  assert.match(groupHTML(split(SNPS, SNPS).noResult), /\(13 days earlier\)/);
  assert.match(groupHTML([{ row: row("X", "2026-08-01"), stored: { date: "2026-08-02", gap: 1 } }]), /\(1 day later\)/);
  assert.match(groupHTML([{ row: row("X", "2026-08-01"), stored: null }]), /<span class="t">no result stored for this date<\/span>/);
  assert.equal(groupHTML([]), ""); assert.equal(groupHTML(null), "");
  const hostile = groupHTML([{ row: row('"><img src=x onerror=1>', "2026-08-01"), stored: null }]);
  assert.doesNotMatch(hostile, /<img/); assert.match(hostile, /&quot;&gt;&lt;img/);
  assert.match(groupHTML(Array.from({ length: 41 }, (_, i) => ({ row: row("T" + i, "2026-08-01"), stored: null }))), /<summary>41 past dates have no stored result — not reports \(first 40 listed\)<\/summary>/);
});

test("both views use it: REPORTED holds only stored results, the no-result dates stay on the page, and the streak reads real quarters", () => {
  assert.match(page, /const pastSplit = splitPastEarnings\(scopeItems\(EV_CACHE\.past, cohort, S\.tq, S\.fav, COHSETS\), EV_CACHE\.up\.concat\(EV_CACHE\.past\)\);\n  const pastS = pastSplit\.reported\.slice\(0, 60\);/, "master feed");
  assert.match(page, /const pastBlocks = pastNoResultHTML\(pastSplit\.noResult\) \+ \(pastS\.map\(toBlock\)/, "master feed keeps them visible");
  assert.match(page, /const pastEvs = pastSplit\.reported\.slice\(0, 24\);/, "company tab");
  assert.match(page, /\? pastNoResultHTML\(pastSplit\.noResult\) \+ pastEvs\.map\(toBlock\)\.map\(earningsBlockHTML\)\.join\(""\)/, "company tab keeps them visible");
  assert.match(page, /const streakClass = pastEvs\.slice\(0, 3\)\.map\(toBlock\)/, "the streak tag reads the three newest REPORTED quarters (BABA's two projected dates used to take two of the three)");
  assert.match(page, /const reported = known\.length > 0 \|\| epsAct != null \|\| revAct != null;/, "a stored actual with no estimate beside it is still a result");
  assert.doesNotMatch(fn(/function splitPastEarnings\(past, all\) \{[\s\S]*?\n\}\n/), /pg\(|fetch\(|innerHTML|delete /, "pure: reads nothing, removes nothing");
});

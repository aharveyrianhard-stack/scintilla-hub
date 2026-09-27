// 27 Sep: sector compare gets fund-family tabs (MEMBERS · SPDR · iSHARES · VANGUARD · EQUAL-WT).
// Each family lists its eleven sector funds in exactly the SECT order, so column i is the same sector in every family.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sect = [...src.match(/var SECT=\[([\s\S]*?)\];/)[1].matchAll(/\["([^"]+)","([A-Z]+)"\]/g)].map((m) => [m[1], m[2]]);
const famSrc = src.match(/var SECT_FAMILY_FUNDS=\{([\s\S]*?)\};/)[1];
const fam = Object.fromEntries([...famSrc.matchAll(/(\w+):\s*\[([^\]]+)\]/g)].map((m) => [m[1], m[2].match(/[A-Z]+/g)]));
test("every family has eleven distinct sector funds", () => {
  assert.equal(sect.length, 11);
  for (const [k, v] of Object.entries(fam)) { assert.equal(v.length, 11, k); assert.equal(new Set(v).size, 11, k); }
});
test("the SPDR family is exactly the SECT list, in order", () => {
  assert.deepEqual(fam.SPDR, sect.map((s) => s[1]));
});
test("column i is the same sector in every family (spot checks)", () => {
  const i = (name) => sect.findIndex((s) => s[0] === name);
  assert.deepEqual(["SPDR", "ISHARES", "VANGUARD", "EQWT"].map((f) => fam[f][i("TECH")]), ["XLK", "IYW", "VGT", "RSPT"]);
  assert.deepEqual(["SPDR", "ISHARES", "VANGUARD", "EQWT"].map((f) => fam[f][i("UTILITIES")]), ["XLU", "IDU", "VPU", "RSPU"]);
  assert.deepEqual(["SPDR", "ISHARES", "VANGUARD", "EQWT"].map((f) => fam[f][i("REAL EST")]), ["XLRE", "IYR", "VNQ", "RSPR"]);
  assert.deepEqual(["SPDR", "ISHARES", "VANGUARD", "EQWT"].map((f) => fam[f][i("COMMS")]), ["XLC", "IYZ", "VOX", "RSPC"]);
});
test("the family choice is remembered per browser, guarded", () => {
  assert.match(src, /try \{ var sf=localStorage\.getItem\("hub\.sector\.family"\)/);
  assert.match(src, /try \{ localStorage\.setItem\("hub\.sector\.family"/);
});
test("the strip header reads the published compare mode (CMP_MODE lives in a closure it cannot see)", () => {
  assert.match(src, /var CMP_MODE="COHORTS"; window\.CMP_MODE_PUBLIC=CMP_MODE;/);
  assert.equal((src.match(/CMP_MODE=b\.getAttribute\("data-gwxcmp"\); window\.CMP_MODE_PUBLIC=CMP_MODE;/g) || []).length, 2);
  assert.match(src, /window\.CMP_MODE_PUBLIC === "SECTORS" && typeof SECT_FAMILIES !== "undefined"/);
  assert.doesNotMatch(src, /typeof CMP_MODE !== "undefined" && CMP_MODE === "SECTORS"/);
});

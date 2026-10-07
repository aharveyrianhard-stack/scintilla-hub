// CZ1 — the confluence-zones page: its data says what the page claims, the page's own 1% rule gives the same zones
// as the engine, and the page keeps to the Hub's look (greys plus the two direction colours, nothing under 11 px,
// the BACK / CLOSE pair, PAGE SPECS at the bottom).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "deliverables", "20261006", "confluence-zones");
const html = fs.readFileSync(path.join(DIR, "CONFLUENCE-ZONES.html"), "utf8");
const dataFile = (/<script src="(data\/confluence-page-\d{8}\.js)"><\/script>/.exec(html) || [])[1];
const D = JSON.parse(fs.readFileSync(path.join(DIR, dataFile), "utf8").replace(/^\/\*[\s\S]*?\*\/\s*window\.CZ1 = /, "").replace(/;\s*$/, ""));
const labels = (z) => z.m.map((m) => m[0]);
const zoneWith = (n, ...want) => n.zones.find((z) => want.every((l) => labels(z).includes(l)));

test("the page loads its own data file, and the data is the 6 Oct close read from the installed V34 packs", () => {
  assert.ok(dataFile, "the page names its data script");
  assert.equal(D.as_of, "2026-10-06"); assert.equal(D.sources.extract.pack_version, "V34");
  assert.equal(D.sources.extract.installed_registry.state, "installed_saved");
  assert.equal(D.names_with_lines.length, 29); assert.equal(D.rule.zone_pct, 1); assert.equal(D.rule.horizon_sessions, 20);
  assert.equal(D.load.applied, false, "the loader receipt is a dry run");
  assert.equal(D.parity.summary.equal, D.parity.summary.native_labels, "every natively read label was reproduced");
});

test("Micron: the 21-day, the 2W D3 and the 3D P1 are one zone under the close; the 50/100-day never reach the 3D C3 or 1D D3", () => {
  const mu = D.names.MU, z = zoneWith(mu, "21-day", "2W D3", "3D P1");
  assert.equal(mu.price, 1045.56); assert.ok(z); assert.equal(z.side, "below"); assert.ok(z.w < 1); assert.equal(z.last, 3, "it lasts to Fri 9 Oct; on 12 Oct the 2W D3 steps away");
  assert.ok(zoneWith(mu, "50-day", "100-day")); assert.ok(zoneWith(mu, "1D D3", "3D C3"));
  assert.ok(!mu.levels.some((l) => l.label === "2W D1"), "the installed pack has no 2W D1 for Micron");
  for (const r of ["flat", "trend", "slope"]) for (const a of ["50-day", "100-day"]) for (const l of ["3D C3", "1D D3"]) {
    const m = mu.paths[r].meetings.find((x) => x.a === a && x.l === l); assert.ok(m, `${a} × ${l} on ${r}`); assert.equal(m.in, null); assert.ok(m.gH < m.g0, "the gap widens"); }
  const d3 = mu.levels.find((l) => l.label === "2W D3"); assert.equal(d3.next, "2026-10-12"); assert.ok(Math.abs(d3.nextv - 1131.9) < 0.01);
});

test("every zone on the page is inside 1% and names its members by label", () => {
  for (const [t, n] of Object.entries(D.names)) for (const z of n.zones) { assert.ok(z.w <= 1.0001, `${t} zone width`); assert.ok(z.m.length >= 2); assert.ok(z.m.every((m) => typeof m[0] === "string" && m[0] && m[1] > 0)); assert.ok(z.hi >= z.lo); }
});

test("the page's own 1% rule (used for the hover read) gives the engine's zones for Micron today", () => {
  const src = /function cluster\(levels\) \{[\s\S]*?\n\}/.exec(html);
  assert.ok(src, "the page carries its cluster function");
  const cluster = new Function("D", `${src[0]}; return cluster;`)(D);
  const mu = D.names.MU, today = mu.levels.map((l) => ({ label: l.label, v: l.f === "l" ? mu.line_paths[l.k][0] : mu.avg_paths[l.label.split("-")[0]].flat[0] }));
  const key = (ls) => ls.slice().sort().join(" + ");
  assert.deepEqual(cluster(today).map((z) => key(z.m.map((m) => m.label))).sort(), mu.zones.map((z) => key(labels(z))).sort());
});

test("parent and child: the five pairs the brief names lead, and Micron at its 21-day against DRAM at its 100-day reads mixed", () => {
  assert.deepEqual(D.pairs.slice(0, 5).map((p) => `${p.c}>${p.p}`), ["MU>DRAM", "DRAM>SMH", "MU>SMH", "SNDK>DRAM", "VST>XLU"]);
  const row = D.pairs[0].rows.find((r) => r.rung === "21-day + 2W D3 + 3D P1");
  assert.ok(row); assert.equal(row.mixed, true); assert.deepEqual(row.c.at_avg, ["21-day"]); assert.deepEqual(row.p.at_avg, ["100-day"]);
  assert.equal(row.c.to[0], "50-day + 100-day"); assert.equal(row.p.to[0], "50-day");
  assert.equal(D.names.DRAM.avg[200], null, "DRAM is too young for a 200-day, and the page says so");
  assert.ok(D.names.DRAM.zones.some((z) => z.side === "at" && labels(z).includes("100-day")), "DRAM is at its 100-day");
});

test("the page keeps the Hub's look: greys plus the two direction colours, nothing under 11 px, BACK / CLOSE, PAGE SPECS last", () => {
  const body = html.slice(0, html.indexOf("<!-- scnav ·")); // the injected BACK / CLOSE block is the Hub's own
  const direction = new Set(["#17a58c", "#e8623d"]);
  for (const hex of new Set((body.match(/#[0-9a-fA-F]{6}\b/g) || []).map((h) => h.toLowerCase()))) {
    if (direction.has(hex)) continue;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24 && Math.max(r, g, b) <= 210, `${hex} is a grey no brighter than 210`);
  }
  for (const m of body.matchAll(/font-size(?::|=")\s*(\d+)/g)) assert.ok(Number(m[1]) >= 11, `font size ${m[1]} is at least 11 px`);
  assert.match(html, /<span data-scnav-slot><\/span><h1>/); assert.match(html, /<!-- \/scnav -->\s*<\/body>/);
  assert.ok(html.indexOf('<details class="sc-pagespecs">') > html.lastIndexOf("</section>"), "PAGE SPECS sits after the last panel");
  assert.ok(!/\b(buy|sell)\b/i.test(body.replace(/<script[\s\S]*?<\/script>/g, "")), "the page lays out levels; it never says buy or sell");
});

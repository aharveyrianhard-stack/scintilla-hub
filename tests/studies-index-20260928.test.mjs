/* I2-HUB-STUDIES (28 Sep): the studies index and the workshop cards for today's pages. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = readFileSync(join(ROOT, "deliverables/20260928/studies-index/STUDIES.html"), "utf8");
const M = JSON.parse(readFileSync(join(ROOT, "workshop/manifest.json"), "utf8"));
const TODAY = [
  "comps-labels/COMPS-LABELS.html", "market-map-r3/index.html", "market-map-r3/MARKET-MAP-R3.html", "rsi-full-history/index.html",
  "rsi-ladder/index.html", "bottoms/BOTTOMS.html", "market-regime/MARKET-REGIME.html", "market-regime/PROPOSAL.html",
  "leaders/LEADERS.html", "stats-tab/index.html", "stats-tab/STATS-TAB.html", "scout/SCOUT-DESIGN.html",
  "scout-iwm/SCOUT-IWM.html", "etf-valuation/ETF-VALUATION.html", "putcall-audit/PUTCALL-AUDIT.html",
].map((p) => "/deliverables/20260928/" + p);

test("the studies index links every page from today, and every link is in the repo", () => {
  const links = [...PAGE.matchAll(/href="(\/[^"]+)"/g)].map((m) => m[1]);
  for (const p of TODAY) assert.ok(links.includes(p), `index lacks ${p}`);
  for (const l of links) assert.ok(existsSync(join(ROOT, l)), `broken link ${l}`);
});

test("the studies index carries the way back and stays monochrome", () => {
  assert.match(PAGE, /<!-- scnav · /);
  for (const [, hex] of PAGE.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24 && Math.max(r, g, b) <= 210, `#${hex} is not an allowed grey`);
  }
});

test("one workshop card per page from today, and the studies index has its own", () => {
  for (const p of [...TODAY, "/deliverables/20260928/studies-index/STUDIES.html"])
    assert.ok(M.items.some((i) => i.href === p && i.status !== "archive"), `no card opens ${p}`);
});

test("the comps labels and the stats-tab prototype wait on Alan's call", () => {
  const ask = (href) => M.items.find((i) => i.href === href);
  assert.equal(ask("/deliverables/20260928/comps-labels/COMPS-LABELS.html").status, "decision");
  assert.match(ask("/deliverables/20260928/comps-labels/COMPS-LABELS.html").ask, /AGREE THESE LABELS/i);
  assert.equal(ask("/deliverables/20260928/stats-tab/index.html").status, "decision");
});

test("the workshop's live map card opens the round-3 map, and the 27 Sep wheel card is archived", () => {
  const maps = M.items.filter((i) => i.area === "hub" && /market map/i.test(i.title) && i.status === "live");
  assert.deepEqual(maps.map((i) => i.href), ["/deliverables/20260928/market-map-r3/index.html"]);
  assert.equal(M.items.find((i) => i.id === "market-map-3d").status, "archive");
});

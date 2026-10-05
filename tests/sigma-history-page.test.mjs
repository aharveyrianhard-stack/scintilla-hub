/* M68 — the deliverable says what the rules file says, looks the way Alan asked, and keeps the
   way back. It is generated, so these tests guard the generator's output, not hand-written prose. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const PAGE = new URL("../deliverables/20260924/sigma-history/SIGMA-HISTORY.html", import.meta.url);
const html = fs.readFileSync(PAGE, "utf8");
const RULES = JSON.parse(fs.readFileSync(new URL("../data/scintilla-rules.json", import.meta.url), "utf8"));

test("the page answers Alan's four questions and works the example", () => {
  for (const heading of ["How a sigma is registered", "Against what it is computing",
                         "Where it is saved", "How it works going forward", "The worked example"]) {
    assert.ok(html.includes(heading), "missing: " + heading);
  }
  assert.match(html, /price_outlier\|EOSE\|2026-09-23/, "the worked example must show the stored key");
  assert.match(html, /public\.scintillas/);
  assert.match(html, /ticker_heartbeat_daily/);
});

test("every threshold it prints is the one in the rules file", () => {
  assert.ok(html.includes(RULES.version), "the page must name the rules version it read");
  for (const [name, p] of Object.entries(RULES.price)) {
    if (name === "crypto" || name === "futures") continue;       // named in the table, not measured here
    assert.ok(html.includes(">" + p.x_usual + "×</td>"), name + " x_usual missing");
    assert.ok(html.includes(">" + p.raw_move_pct + "%</td>"), name + " raw floor missing");
  }
});

test("it states the survivorship limit and that nothing was deployed", () => {
  assert.match(html, /Survivorship/i);
  assert.match(html, /today's<\/b> universe|today’s<\/b> universe/i);
  assert.match(html, /Nothing was deployed/i);
});

test("the way back is on the page", () => {
  assert.match(html, /data-scnav/);
  assert.ok(html.includes("BACK") && html.includes("CLOSE"));
});

test("the look: greys only, except the direction colours Alan asked for", () => {
  const root = html.slice(html.indexOf(":root{"), html.indexOf("}", html.indexOf(":root{")));
  const allowed = new Set(["--bull", "--bear"]);
  for (const m of root.matchAll(/(--[a-z0-9]+):#([0-9A-Fa-f]{6})/g)) {
    if (allowed.has(m[1])) continue;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[2].slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24, m[1] + " is not a grey: #" + m[2]);
    assert.ok(Math.max(r, g, b) <= 210, m[1] + " is brighter than 210: #" + m[2]);
  }
  assert.match(root, /--bull:#00FFA3/, "up stays green");
  assert.match(root, /--bear:#FF2D55/, "down stays red");
});

test("no text is smaller than 11px", () => {
  const sizes = [...html.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) => +m[1]);
  assert.ok(sizes.length > 5);
  assert.ok(Math.min(...sizes) >= 11, "smallest declared size is " + Math.min(...sizes) + "px");
});

test("the charts are drawn, not described", () => {
  const svgs = html.match(/<svg[\s\S]*?<\/svg>/g) || [];
  assert.equal(svgs.length, 2, "a breadth chart and a forward-return chart");
  for (const s of svgs) assert.match(s, /role="img"[\s\S]*?aria-label=/, "each chart needs a label");
  assert.ok((svgs[1].match(/<rect/g) || []).length > 300, "the breadth chart draws a bar per session");
  assert.ok(svgs[0].includes("var(--bull)") || svgs[0].includes("var(--mute)"));
  assert.ok(svgs[1].includes("var(--bull)") && svgs[1].includes("var(--bear)"), "up green, down red");
});

test("it does not claim a prediction it did not measure", () => {
  assert.match(html, /does not tell you what comes next/i);
  assert.ok(!/buy |sell |should trade/i.test(html.replace(/<[^>]+>/g, " ")), "no trading instruction");
});

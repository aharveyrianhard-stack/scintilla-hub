// G1 (3 Oct 2026) — the Hub shows how old the Geiger is. Alan: "I prefer to have it a little bit wrong than to have it a
// little bit old." The back end now publishes every cycle and puts the age in the data; this is the Hub's small display
// of it, and the one gate it relaxes (ranking no longer waits for every cell of every name).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SRC = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const CODE = SRC.slice(SRC.indexOf("<script>"), SRC.lastIndexOf("</script>"));

function pick(name) {
  const m = CODE.match(new RegExp("\\nfunction " + name + "\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}"));
  if (!m) throw new Error("function not found: " + name);
  return m[0];
}
const ctx = {};
vm.createContext(ctx);
vm.runInContext(["scGeigerAgo", "scGeigerClockET", "scGeigerAgeText", "scGeigerRowAgeTitle"].map(pick).join("\n") +
  "\nthis.scGeigerAgo = scGeigerAgo; this.scGeigerAgeText = scGeigerAgeText; this.scGeigerRowAgeTitle = scGeigerRowAgeTitle;", ctx);

test("the stamp line carries the Geiger age next to the feed stamp, in the same quiet grey, no colour of its own", () => {
  assert.match(SRC, /<span id="scFeedStamp">equities · MASSIVE<\/span> · <span id="scGeigerAge" class="sc-stamp__age"/);
  assert.match(SRC, /\.sc-stamp__age\{[^}]*tabular-nums/);
  assert.doesNotMatch(SRC, /\.sc-stamp__age\{[^}]*#[0-9a-f]{3,6}/i, "no colour literal of its own");
});

test("one age wording on this surface — scGeigerAgo — used by the stamp line and by the carried row's title", () => {
  assert.equal(ctx.scGeigerAgo(20 * 1000), "<1m");
  assert.equal(ctx.scGeigerAgo(7 * 60000), "7m");
  assert.equal(ctx.scGeigerAgo((16 * 60 + 30) * 60000), "16h 30m");
  assert.equal(ctx.scGeigerAgo(3 * 86400000), "3d 0h");
  const defs = CODE.match(/\nfunction scGeigerAgo\(/g) || [];
  assert.equal(defs.length, 1);
  assert.doesNotMatch(pick("scGeigerAgeText") + pick("scGeigerRowAgeTitle"), /ytAgo|socAgo|readAgeLabel/, "it does not borrow another surface's wording");
});

test("the line reads: as-of clock, how long ago, and how many names are fresh / carried (oldest named) / without a reading", () => {
  const now = Date.parse("2026-10-03T16:16:00Z");
  const fresh = ctx.scGeigerAgeText({ current_equalizer_validated: true, computed: "2026-10-03T16:14:00Z",
    freshness: { names_total: 590, names_fresh: 590, names_carried: 0, names_unavailable: 0, rungs_failed: 0, published_utc: "2026-10-03T16:14:00Z", carried: [] } }, now);
  assert.equal(fresh, "geiger as of 12:14 ET (2m ago) · 590 fresh");
  const held = ctx.scGeigerAgeText({ current_equalizer_validated: true, computed: "2026-10-03T16:14:00Z",
    freshness: { names_total: 590, names_fresh: 589, names_carried: 1, names_unavailable: 0, rungs_failed: 1, published_utc: "2026-10-03T16:14:00Z",
      carried: [{ symbol: "META", age_s: 59400, cause: "DAILY_REFRESH_UNAVAILABLE" }] } }, now);
  assert.equal(held, "geiger as of 12:14 ET (2m ago) · 589 fresh · 1 carried, oldest META 16h 32m · 1 rung missing");
  const old = ctx.scGeigerAgeText({ current_equalizer_validated: true, computed: "2026-10-02T20:00:00Z" }, now);
  assert.equal(old, "geiger as of 16:00 ET (20h 16m ago)", "an artifact without a freshness block (before G1) still shows its age");
  assert.equal(ctx.scGeigerAgeText({ current_equalizer_validated: false, validation_error: "GEIGER_EQUALIZER_DIGEST_MISMATCH" }, now),
    "geiger · not accepted · geiger equalizer digest mismatch");
  assert.equal(ctx.scGeigerAgeText(null, now), "geiger · not accepted");
});

test("a carried row's Geiger cell is marked and its title says when the value is from and why", () => {
  assert.match(SRC, /'<span class="sc-gcell' \+ \(d\.gl && d\.gl\.state === "CARRIED" \? " is-carried" : ""\)/);
  assert.match(SRC, /scGeigerRowAgeTitle\(d\.gl\)/);
  assert.match(SRC, /gl:\s+\(gg\[m\.ticker\] && gg\[m\.ticker\]\.sc_geiger_liveness\) \|\| null/);
  assert.match(SRC, /index\[t\]\.sc_geiger_liveness = v\.liveness \|\| null;/);
  assert.match(SRC, /\.sc-gcell\.is-carried > \.sc-gmini\{ opacity:\.68; \}/);
  const now = Date.parse("2026-10-03T16:16:00Z");
  assert.equal(ctx.scGeigerRowAgeTitle({ state: "CARRIED", carried_from_utc: "2026-10-02T20:00:00Z", cause: "DAILY_REFRESH_UNAVAILABLE" }, now),
    "carried from 16:00 ET (20h 16m old) — daily refresh unavailable");
  assert.equal(ctx.scGeigerRowAgeTitle({ state: "FRESH" }, now), "");
});

test("the age is painted when the artifact is accepted AND when it is retained, and ticks every 30 s", () => {
  const accept = CODE.indexOf("freshness: (j && j.freshness) || null, published: (j && j.published_utc) || null };");
  assert.ok(accept > 0);
  assert.match(CODE.slice(accept, accept + 200), /try \{ scPaintGeigerAge\(\); \} catch \(_\) \{\}/);
  assert.match(pick("scRetainCandidateGeiger"), /scPaintGeigerAge\(\)/);
  assert.match(pick("scPaintGeigerAge"), /setInterval\(function \(\) \{[^\n]*\}, 30000\)/);
  assert.match(pick("scPaintGeigerAge"), /data-sc-geiger-age-s/);
});

test("G1 gate: ranking no longer waits for every cell of every name — completeness is a label; the receipt, digest and a consistent accounting still gate", () => {
  const block = CODE.slice(CODE.indexOf("window.SC_RANK_READY = declaredSet.size === SC_EXPECTED_EQUITY_COUNT"), CODE.indexOf("try { scStampRoot(); } catch (_) {}"));
  assert.match(block, /SC_CG\.meta\.accounting\.failed === 0/);
  assert.match(block, /SC_CG\.meta\.accounting\.unexplained === 0\);/);
  assert.match(block, /SC_CG\.meta\.universe_digest === SC_EQUITY_UNIVERSE_DIGEST/);
  assert.doesNotMatch(block, /named_absent === 0/);
  assert.doesNotMatch(block, /coverage\.complete === true/);
  assert.doesNotMatch(block, /computed === SC_CG\.meta\.accounting\.expected_cells/);
  // the Hub's refusal of a truly broken artifact is untouched
  const contract = readFileSync(new URL("../geiger-authority-contract.js", import.meta.url), "utf8");
  assert.match(contract, /if \(failed !== 0 \|\| failures\.length !== 0\) throw new Error\("GEIGER_ACCOUNTING_FAILED"\);/);
  assert.match(SRC, /"geiger-names-carried": \(cg\.freshness && cg\.freshness\.names_carried\) \|\| 0/, "the root stamp says how many names are carried");
});

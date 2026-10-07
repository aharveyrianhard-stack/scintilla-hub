/* RL1 (7 Oct 2026) · the Hub's COMPS tab prices on the SAME switches as the decision cards, the universe knockout and the
   allocation tool. Before this the tab called the set builder and the pricer with no switches at all (C6b), so Micron read
   about +277% on the tab and +13% on its card. One named line says what is live: outliers.mjs LIVE_FX.
   Run: node --test tests/rl1-comps-tab-live-switches.test.mjs */
import test from "node:test"; import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = (p) => path.join(path.dirname(fileURLToPath(import.meta.url)), p);
const { LIVE_FX, CP3_ALL, CP1_NONE, conclusion6 } = await import(here("../deliverables/20261005/comps-c6/outliers.mjs"));
const { CP3_LINES_ON, CP3_STATED, REFERENCE_PEERS } = await import(here("../deliverables/20261003/comps-c5/lines.mjs"));
const TAB = readFileSync(here("../deliverables/20261003/comps-c5/tab.mjs"), "utf8"), CODE = TAB.replace(/\/\*[\s\S]*?\*\//g, "");
const OUT = readFileSync(here("../deliverables/20261005/comps-c6/outliers.mjs"), "utf8");

test("one line says what is live, and it is the bundle the cards were built on", () => {
  assert.deepEqual({ ...LIVE_FX }, { ...CP3_ALL }, "LIVE_FX is CP3_ALL");
  assert.equal((OUT.match(/^export const LIVE_FX = /gm) || []).length, 1, "the switch line is there once");
  assert.match(OUT, /^export const LIVE_FX = CP3_ALL;$/m);
  for (const k of ["stated", "priceOnBusiness", "priceOnEveryLine", "memoryStorage", "dcReit", "complement", "reference", "growthCredit", "reitYardstick", "marginGate"]) assert.equal(LIVE_FX[k], true, k + " is on");
  for (const k of Object.keys(CP3_LINES_ON)) assert.equal(LIVE_FX[k], CP3_LINES_ON[k], "the set builder reads the same line switches: " + k);
  const cards = JSON.parse(readFileSync(here("../deliverables/20261007/one-basis/data/cards.json"), "utf8"));
  assert.match(cards.comps_code, /CP3_ALL/, "the cards say which bundle priced them");
});

test("the tab builds its set and its price on LIVE_FX, and nowhere on a bare call", () => {
  assert.match(CODE, /S\.set = buildSet\(S\.T, S\.inp, \{ n: S\.n, fx: LIVE_FX \}\)/);
  assert.match(CODE, /conclusion6\(S\.snap, S\.decisions, S\.estimates, S\.opts\.today, S\.way, \{ set: S\.set, fx: LIVE_FX \}\)/);
  assert.equal((CODE.match(/buildSet\(/g) || []).length, 1, "one set builder call");
  assert.equal((CODE.match(/conclusion6\(/g) || []).length, 1, "one pricer call");
  assert.match(CODE, /import \{[^}]*\bLIVE_FX\b[^}]*\} from "\.\.\/\.\.\/20261005\/comps-c6\/outliers\.mjs"/);
});

test("the foreign memory makers reach the tab the way they reach a card: the newest dated facts file, through the reader", () => {
  const dir = here("../deliverables/20261003/comps-c5"), newest = readdirSync(dir).filter((f) => /^reference-peers-facts-.*\.json$/.test(f)).sort().pop();
  const m = /const REF_FACTS_URL = "\/deliverables\/20261003\/comps-c5\/(reference-peers-facts-[^"]+\.json)"/.exec(CODE);
  assert.ok(m, "the tab names its facts file"); assert.equal(m[1], newest, "and it is the newest on file (the one the cards' run picks)");
  assert.match(CODE, /inp\.reference = referenceOf\(facts\)\.peers/); assert.match(CODE, /withReference\(S\.opts\.pg, facts\)/); assert.match(CODE, /withReferenceQuotes\(S\.opts\.quotes, facts\)/);
  assert.match(CODE, /kept: S\.set\.kept\.filter\(\(r\) => !r\.reference \|\| r\.has_figures\)/, "a reference peer with no figures is never read");
  const facts = JSON.parse(readFileSync(path.join(dir, newest), "utf8"));
  for (const t of CP3_STATED.MU.peers.filter((p) => REFERENCE_PEERS[p])) assert.ok(facts.companies && (facts.companies[t] || (REFERENCE_PEERS[t].also || []).some((a) => facts.companies[a])), t + " is in the facts file");
});

test("the tab says what it does: priced on the same-business peers, the others shown; a reference peer by its name", () => {
  assert.match(CODE, /c6\.pricedOn === "business"/); assert.match(CODE, /the \$\{c6\.businessPeers\.length\} peers that price it/); assert.match(CODE, /more shown, not priced/);
  assert.match(CODE, /const peerName = \(t\) => \(REFERENCE_PEERS\[t\] && REFERENCE_PEERS\[t\]\.name\) \|\| t;/);
  assert.equal(REFERENCE_PEERS["000660.KS"].name, "SK hynix");
});

test("the way back is the one line: CP1_NONE is every switch off, which is what a caller with no switches gets", () => {
  for (const [k, v] of Object.entries(CP1_NONE)) assert.equal(v, false, k + " is off in CP1_NONE");
  assert.match(OUT, /X = fx \|\| CP1_OUT_OFF/, "the pricer's own default is still every switch off: the reports, the tools and the tests are not touched by LIVE_FX");
  assert.equal(typeof conclusion6, "function");
});

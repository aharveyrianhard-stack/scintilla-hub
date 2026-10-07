// HC2 — freeze what HC1's cards drew, so the test can hold the stacked cards to it.
// Reads the RELEASE this branch started from (b80c01e, the page live on 7 Oct) out of git, draws the nine cards on the
// stand-in page in every state a reader can put them in (tests/fixtures/hc2-compare-world.mjs), and writes what each card
// shows to tests/fixtures/hc1-cards-b80c01e.json. tests/hc2-compare-stacked.test.mjs draws the same states with the page
// as it stands and compares. Run once, from the repo root:
//   node deliverables/20261007/hc2-compare-stacked/tools/make-fixture.mjs
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { makeWorld, SCENARIOS, shown, digest } from "../../../../tests/fixtures/hc2-compare-world.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const SHA = "b80c01e";
const page = execFileSync("git", ["-C", REPO, "show", SHA + ":index.html"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const out = { from: SHA, what: "what each compare card showed on the release HC2 branched from, per state: its words, its first hover, and a fingerprint of all its hovers and of its markup (less the layout marks HC2 changed)", scenarios: {} };
for (const s of SCENARIOS) {
  const w = makeWorld(page, s.opts);
  out.scenarios[s.name] = shown(w.api.cmpxCardsHTML()).map(digest);
}
const f = path.join(REPO, "tests", "fixtures", "hc1-cards-" + SHA + ".json");
fs.writeFileSync(f, JSON.stringify(out, null, 1) + "\n");
console.log(path.relative(REPO, f), Object.keys(out.scenarios).length, "states ·", Object.values(out.scenarios).map((c) => c.length).join("/"), "cards ·", fs.statSync(f).size, "bytes");

/* M48 — SCINTILLATION IS THE FLASHING ON THE TOP TAPE.
   Alan, 24 Sep: "On the dashboard, events tape, on the one at the top, not the one at the bottom.
   The flashing when the event is upcoming — that is what I see as scintillation … It's just
   whatever it is flashes."
   What is pinned here is the timing itself — still until fifteen minutes out, a gentle pulse, a
   quicker one inside five, a hard flash at the minute, then one glow in the room's own colour when
   the number lands — that it all goes through the page's ONE primitive, that reduced motion turns
   it off, and that an earnings report standing in the same queue is treated identically. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

const SLICE = (() => {
  const a = page.indexOf("/* ── M48 · THE TOP TAPE IS THE SCINTILLATION");
  const b = page.indexOf("function scintPaint() {", a);
  assert.ok(a > 0 && b > a, "the M48 tape layer is where the test expects it");
  return page.slice(a, b);
})();
/* the page's OWN reading of a surprise, lifted with its helpers: the test must not invent the rule */
const DEPS = ["const EC_MONTH_TAG = /\\s*\\((Q[1-4]|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[^)]*\\)\\s*$/i;",
  page.match(/^const EC_INVERT = .*$/m)[0],
  page.match(/^const ecBase {2}= .*$/m)[0],
  page.match(/^const EC_TAPE_PRICE = .*$/m)[0],
  page.match(/^function ecNum\(v\) \{[\s\S]*?\n\}/m)[0],
  page.match(/^function ecTapeSurprise\(it\) \{[\s\S]*?\n\}/m)[0]].join("\n");

function el(opts = {}) {
  const n = { anims: [], classes: new Set(opts.classes || []), attrs: opts.attrs || {}, kids: opts.kids || {},
    animate: (frames, o) => { const a = { frames, opt: o, cancel() {} }; n.anims.push(a); return a; },
    classList: { add: (c) => n.classes.add(c), remove: () => {}, contains: (c) => n.classes.has(c) },
    getAttribute: (k) => (k in n.attrs ? n.attrs[k] : null), setAttribute: (k, v) => { n.attrs[k] = String(v); },
    querySelector: (q) => n.kids[q] || null, get offsetWidth() { return 1; } };
  return n;
}
/* the ident box as the page builds it: keyed nodes, each with its countdown cell */
function box(keys) {
  const nodes = keys.map((k) => el({ attrs: { "data-k": k }, kids: { ".mn-cd": el(), ".mn-nm": el(), ".mn-sur": el(), ".mn-res": el() } }));
  return { node: { querySelectorAll: () => nodes }, nodes, byKey: (k) => nodes[keys.indexOf(k)] };
}
function tape({ off = false, hidden = false } = {}) {
  const glows = [];
  const api = new Function("ECON_TAPE_ON", "SCINT_OFF", "document", "el", "scScint", "setInterval", "ecNudgeModel",
    DEPS + "\n" + SLICE + "\nreturn { mnScintPlan, mnScintPass, mnScintTarget, mnScintNode, mnScintArm, ecTapeSurprise," +
    " MS: { soon: MN_SCINT_SOON_MS, near: MN_SCINT_NEAR_MS, due: MN_SCINT_DUE_MS }, seen: MN_SCINT_AT };")(
    true, off, { visibilityState: hidden ? "hidden" : "visible" }, () => null,
    (node, tone) => { glows.push({ node, tone }); if (node && node.animate) node.animate([{ offset: 0 }], { duration: 520 }); },
    () => 1, () => []);
  return { api, glows };
}
const rel = Date.parse("2026-09-24T12:30:00Z") / 1000;            // a release at 8:30 ET
const item = (o = {}) => ({ key: "US|cpi", ts: rel, name: "Core CPI", event: "Core CPI (Aug)", cat: "INFLATION", ...o });

test("nothing flashes until the last fifteen minutes — silence is information", () => {
  const { api } = tape();
  assert.equal(api.mnScintPlan(item(), "soon", rel - 3600), null, "an hour out: still");
  assert.equal(api.mnScintPlan(item(), "soon", rel - 16 * 60), null, "sixteen minutes out: still");
  assert.equal(api.mnScintPlan(item(), "ahead", rel - 20 * 60), null);
  assert.equal(api.mnScintPlan({ ...item(), ts: rel + 3 * 86400 }, "cluster", rel), null, "a heavy day ahead never flashes");
});

test("T−15 pulses gently, T−5 pulses quicker, and the release minute flashes hard", () => {
  const { api } = tape();
  const at = (secs, st) => api.mnScintPlan(item(), st, rel - secs);
  const soon = at(15 * 60, "soon");
  assert.equal(soon.phase, "soon");
  assert.equal(soon.everyMs, api.MS.soon);
  assert.equal(soon.tone, "soon", "nothing has printed, so no direction is implied");
  assert.equal(at(6 * 60, "soon").everyMs, api.MS.soon);
  const near = at(5 * 60, "near");
  assert.equal(near.phase, "near");
  assert.equal(near.everyMs, api.MS.near);
  assert.ok(near.everyMs < soon.everyMs, "inside five minutes it is faster than inside fifteen");
  const due = at(0, "due");
  assert.equal(due.phase, "due");
  assert.equal(due.everyMs, api.MS.due);
  assert.ok(due.everyMs < near.everyMs, "the release itself is the fastest");
  assert.equal(at(-120, "due").phase, "due", "it keeps flashing for two minutes past the minute");
  assert.equal(at(-121, "due"), null, "and then it stops, rather than nagging");
});

test("once the number lands it glows ONCE, in the Economic room's own colour", () => {
  const { api } = tape();
  const hot = api.mnScintPlan(item({ actual: 3.4, estimate: 3.1 }), "landed", rel + 60);
  assert.equal(hot.tone, "hot", "hotter inflation than expected is the adverse side — the room's red");
  assert.equal(hot.once, true);
  const cool = api.mnScintPlan(item({ actual: 2.8, estimate: 3.1 }), "landed", rel + 60);
  assert.equal(cool.tone, "cool", "cooler than expected is the favourable side — the room's green");
  const flat = api.mnScintPlan(item({ actual: 3.1, estimate: 3.1 }), "landed", rel + 60);
  assert.equal(flat.tone, "soon", "in line implies no direction at all");
});

test("the pulse keeps its cadence: one glow per window, not one per tick", () => {
  const { api, glows } = tape();
  const b = box(["US|cpi"]);
  const model = [{ key: "US|cpi", it: item(), st: "near" }];
  const t0 = (rel - 4 * 60) * 1000;
  assert.equal(api.mnScintPass(t0, b.node, model), 1, "the first tick glows");
  assert.equal(api.mnScintPass(t0 + 2000, b.node, model), 0, "two seconds later it does not");
  assert.equal(api.mnScintPass(t0 + api.MS.near, b.node, model), 1, "a full window later it does");
  assert.equal(glows.length, 2);
  assert.equal(glows[0].node, b.byKey("US|cpi").kids[".mn-cd"], "the countdown is what pulses");
  assert.equal(b.byKey("US|cpi").kids[".mn-cd"].anims.length, 2, "through the page's own primitive");
});

test("a landed release glows once and then holds still", () => {
  const { api, glows } = tape();
  const b = box(["LUS|cpi"]);
  const model = [{ key: "LUS|cpi", it: item({ actual: 3.4, estimate: 3.1 }), st: "landed" }];
  const t0 = (rel + 90) * 1000;
  assert.equal(api.mnScintPass(t0, b.node, model), 1);
  assert.equal(api.mnScintPass(t0 + 60000, b.node, model), 0, "a landed number does not keep flashing");
  assert.equal(glows[0].tone, "hot");
  assert.equal(glows[0].node, b.byKey("LUS|cpi").kids[".mn-sur"], "the surprise itself carries the colour");
});

test("an earnings report on the top tape follows the same rule, with no extra code", () => {
  const { api } = tape();
  const ern = { key: "ERN|NVDA", ts: rel, name: "NVDA", event: "NVDA Q3 EPS" };
  assert.equal(api.mnScintPlan(ern, "soon", rel - 20 * 60), null);
  assert.equal(api.mnScintPlan(ern, "near", rel - 60).phase, "near");
  assert.equal(api.mnScintPlan({ ...ern, actual: 1.2, estimate: 1.0 }, "landed", rel + 60).tone, "cool",
    "a beat is the favourable side");
  assert.equal(api.mnScintPlan({ ...ern, actual: 0.8, estimate: 1.0 }, "landed", rel + 60).tone, "hot",
    "a miss is the adverse side");
});

test("prefers-reduced-motion: the queue still counts down, and nothing animates", () => {
  const { api, glows } = tape({ off: true });
  const b = box(["US|cpi"]);
  assert.equal(api.mnScintPass((rel - 60) * 1000, b.node, [{ key: "US|cpi", it: item(), st: "near" }]), 0);
  assert.equal(glows.length, 0);
  assert.equal(b.byKey("US|cpi").kids[".mn-cd"].anims.length, 0);
});

test("a hidden tab flashes nothing at all", () => {
  const { api, glows } = tape({ hidden: true });
  const b = box(["US|cpi"]);
  assert.equal(api.mnScintPass((rel - 60) * 1000, b.node, [{ key: "US|cpi", it: item(), st: "near" }]), 0);
  assert.equal(glows.length, 0);
});

test("an item that has left the queue is forgotten, so its next appearance starts clean", () => {
  const { api } = tape();
  const b = box(["US|cpi"]);
  const near = [{ key: "US|cpi", it: item(), st: "near" }];
  const t0 = (rel - 60) * 1000;
  api.mnScintPass(t0, b.node, near);
  assert.equal(api.seen.has("US|cpi"), true);
  api.mnScintPass(t0 + 1000, b.node, [{ key: "US|cpi", it: item(), st: "ahead" }]);
  assert.equal(api.seen.has("US|cpi"), false, "out of its window, the memory goes with it");
  assert.equal(api.mnScintPass(t0 + 2000, b.node, near), 1, "so the next approach glows immediately");
});

test("the flash is colour and shadow only — it can never move the tape", () => {
  const { api } = tape();
  const b = box(["US|cpi"]);
  api.mnScintPass((rel - 60) * 1000, b.node, [{ key: "US|cpi", it: item(), st: "near" }]);
  const frames = b.byKey("US|cpi").kids[".mn-cd"].anims[0].frames;
  for (const f of frames) for (const k of Object.keys(f))
    assert.ok(["offset", "color", "textShadow"].includes(k), "no geometry in the keyframe: " + k);
});

test("the tape's own states, colours and countdown are untouched by this layer", () => {
  assert.match(page, /\.mn-it\.s-soon\s+\.mn-dot\{[^}]*mn-breathe 2\.4s/, "the dot's own breathing is still there");
  assert.match(page, /\.mn-it\.s-due\s+\.mn-dot\{[^}]*mn-hard \.38s/);
  assert.ok(!/MN_SCINT[\s\S]{0,400}innerHTML/.test(SLICE), "the flash never writes markup");
  assert.ok(!/MN_SCINT[\s\S]{0,400}(style\.|classList\.add)/.test(SLICE), "and never restyles a node");
});

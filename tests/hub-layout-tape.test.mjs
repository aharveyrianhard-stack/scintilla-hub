/* deliverables/20260926/hub-layout-tape — D1: the dashboard reorganised and one tape (a proposal, nothing wired in).
   What is pinned: the write-up links every mockup; the house colours and the token set; the mockups only read and
   store no key; the master tabs are one element; the READ label is the Hub's own rule; every diagnosis mark sits on
   its picture and every one of Alan's fourteen points is marked; the evaluation board carries every proposal Alan
   named, with its cost; and the Hub's own page is untouched by this lane. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "deliverables", "20260926", "hub-layout-tape");
const read = (f) => fs.readFileSync(path.join(DIR, f), "utf8");
const PAGES = ["layout-a.html", "layout-b.html", "station-tape.html", "eval-board.html"];
const strip = (s) => s.replace(/<!-- scnav ·[\s\S]*?<!-- \/scnav -->/g, "");
const loadWin = (file, name) => { const js = read(file); const w = {}; new Function("window", js)(w); return w[name]; };

test("the write-up exists, links every mockup, and every page carries a title and the BACK / CLOSE pair", () => {
  const doc = read("HUB-LAYOUT-TAPE.html");
  for (const p of PAGES) assert.ok(doc.includes('href="' + p), "HUB-LAYOUT-TAPE.html links " + p);
  for (const p of ["HUB-LAYOUT-TAPE.html", ...PAGES]) {
    const s = read(p);
    assert.match(s, /<title>[^<]{3,40}<\/title>/, p + " has a short title");
    assert.ok(s.includes("<!-- scnav ·"), p + " carries the scnav pair");
  }
});

test("house colours: greys stay grey and under 210; the only hues are up, down and the market-status amber", () => {
  /* what is actually drawn: the stylesheet, the scripts, and the <style>/<script> blocks of each page — comments and prose
     (which quote Kimi's #F2F2F8 to say why it was replaced) are not colours */
  const code = (f) => f.endsWith(".html") ? [...strip(read(f)).matchAll(/<(style|script)[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => m[2]).join("\n") : read(f);
  const src = ["d1.css", "d1-live.js", "d1-hub.js", "HUB-LAYOUT-TAPE.html", ...PAGES].map(code).join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
  const HUES = new Set(["#00FFA3", "#FF2D55", "#FF8A00"]);
  for (const h of new Set(src.match(/#[0-9a-fA-F]{6}\b/g) || [])) {
    if (HUES.has(h.toUpperCase())) continue;
    const n = parseInt(h.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255];
    assert.ok(Math.max(...c) - Math.min(...c) <= 24, h + " is a grey");
    assert.ok(Math.max(...c) <= 210, h + " has no channel above 210");
  }
  for (const m of src.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)) {
    const c = [+m[1], +m[2], +m[3]], k = c.join(",");
    if (k === "0,255,163" || k === "255,45,85") continue;          // up / down, as a tint
    assert.ok(Math.max(...c) - Math.min(...c) <= 24 && Math.max(...c) <= 210, "rgba(" + k + ") is a grey");
  }
  assert.ok(!/#fff\b|#ffffff\b|:\s*white\b/i.test(src), "no white");
});

test("the token set: six sizes, the smallest 10 px, tabs and body at least 11 px, and d1.css sets no loose font size", () => {
  const css = read("d1.css");
  const sizes = [...css.matchAll(/--t-(micro|label|body|title|big|display):(\d+)px/g)].map((m) => [m[1], +m[2]]);
  assert.equal(sizes.length, 6, "six size tokens");
  const S = Object.fromEntries(sizes);
  assert.ok(S.micro >= 10 && S.label >= 11 && S.body >= 11, "micro >= 10, label and body >= 11");
  const loose = [...css.matchAll(/font-size:\s*([0-9.]+)px/g)];
  assert.equal(loose.length, 0, "every font-size in d1.css is a token");
  assert.match(css, /\.d1-tab\{[^}]*font-size:var\(--t-label\)/, "every tab row uses the 11 px label size");
});

test("the master tabs are one element: all buttons, centred, never underlined", () => {
  const js = read("d1-hub.js"), css = read("d1.css");
  assert.match(js, /'<button class="d1-mtab'/, "master tabs are buttons");
  assert.ok(!/<a[^>]*d1-mtab/.test(js), "no master tab is a link");
  assert.match(css, /\.d1-mtab\{[^}]*text-align:center[^}]*text-decoration:none/, "centred and not underlined");
  assert.ok(js.includes('"SCINTILLAS"'), "the SCINTILLAS master tab is there");
});

test("the mockups only read: every request is a GET, and no key is stored in the files", () => {
  const src = ["d1-live.js", "d1-hub.js", ...PAGES].map(read).join("\n");
  assert.ok(!/method\s*:\s*["'](POST|PATCH|PUT|DELETE)/i.test(src), "no write request");
  assert.ok(!/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\./.test(src), "no JWT stored");
  assert.match(read("d1-live.js"), /\/pip\.html", "\/index\.html"/, "the read key is discovered at run time from the Hub page");
  const serve = read("tools/serve.mjs");
  assert.match(serve, /req\.method !== "GET" && req\.method !== "HEAD"/, "the local proxy refuses anything but GET");
});

test("the READ label is the Hub's own rule, threshold for threshold", () => {
  const hub = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), mine = read("d1-live.js");
  const rules = [["T >= 0.5 && M >= 0.4", "aligned bull"], ["T <= -0.5 && M <= -0.4", "aligned bear"], ["T >= 0.4 && M <= -0.15", "pullback"],
    ["T <= -0.2 && M >= 0.35", "turning up"], ["Math.abs(T) < 0.25 && M >= 0.5", "mom leads"], ["T >= 0.5 && Math.abs(M) < 0.2", "stalling"],
    ["T >= 0.3 && M >= 0", "constructive"], ["T <= -0.3 && M <= 0", "broken"]];
  for (const [cond, label] of rules) {
    assert.ok(hub.includes("if (" + cond + ")") || hub.includes("else if (" + cond + ")"), "the Hub has: " + cond);
    assert.ok(mine.includes("if (" + cond + ') return "' + label + '"'), "D1 has: " + cond + " → " + label);
  }
});

test("every diagnosis mark sits on its picture, and all fourteen of Alan's points are marked", () => {
  const D = loadWin("diag-data.js", "DIAG");
  const seen = new Set();
  for (const s of D.shots) {
    assert.ok(fs.existsSync(path.join(DIR, s.img)), s.img + " exists");
    const buf = fs.readFileSync(path.join(DIR, s.img)); const W = buf.readUInt32BE(16), H = buf.readUInt32BE(20);
    assert.equal(W, s.w, s.img + " is " + s.w + " wide");
    for (const m of s.marks) {
      seen.add(m.n);
      assert.ok(m.x >= -6 && m.y >= -6 && m.x + m.w <= W + 6 && m.y + m.h <= H + 6, s.id + " mark " + m.n + " (" + m.label + ") is inside the picture");
      assert.ok(m.w > 0 && m.h > 0, s.id + " mark " + m.n + " has a size");
    }
  }
  for (let n = 1; n <= 14; n++) if (n !== 12) assert.ok(seen.has(n), "point " + n + " is marked");
  assert.ok(read("HUB-LAYOUT-TAPE.html").includes("<b>12</b>"), "point 12 (the outliers) is answered in the list; its strip is mark 10");
});

test("the evaluation board carries every proposal Alan named, each with a purpose, a home, a picture and a measured cost", () => {
  const E = loadWin("eval-data.js", "EVAL");
  const want = ["motion-a", "motion-b", "motion-c", "tab-a", "tab-b", "tab-c", "sentiment-feed", "context-lens-2", "context-lens-3", "knockout-cards", "d1-layout-a", "d1-layout-b", "d1-station-tape", "d1-company-expanded", "d1-geiger"];
  for (const id of want) {
    const i = E.items.find((x) => x.id === id);
    assert.ok(i, id + " is on the board");
    assert.ok(i.for && i.lives && i.url, id + " says what it is for and where it lives");
    assert.ok(i.thumb && fs.existsSync(path.join(DIR, i.thumb)), id + " has a picture");
    assert.equal(typeof i.steady, "number", id + " has a measured steady cost");
  }
  assert.ok(E.baseline && typeof E.baseline.steady === "number", "the empty-tab floor is measured");
  assert.match(read("eval-board.html"), /keep[\s\S]*change[\s\S]*drop/, "the score row offers keep / change / drop");
});

/* D2 (27 Sep) builds the company view on index.html, so the page itself is no longer frozen; the
   Indicator Lab still is (the 23 Sep rule: byte-identical). */
test("this lane leaves the Indicator Lab as it was", () => {
  let base;
  try { base = execFileSync("git", ["merge-base", "HEAD", "7c96a83"], { cwd: ROOT }).toString().trim(); } catch (_) { return; }   // not a git checkout: nothing to compare
  const diff = execFileSync("git", ["diff", "--name-only", base, "--", "prototypes/indicator-lab"], { cwd: ROOT }).toString().trim();
  assert.equal(diff, "", "prototypes/indicator-lab is unchanged");
});

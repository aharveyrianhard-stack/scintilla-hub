import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
const at = (p) => new URL("../prototypes/" + p, import.meta.url);
const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(at(p))).digest("hex");

/* September 19 (root review): the review home follows the shared navigation baseline v0.1 (Overview / Tools / Review / Work /
   Architecture / Page spec), groups tools as Markets & macro, Signals & context, Portfolio & valuation, Workspaces, Visual
   experiments and Systems, puts Context Lens under Signals & context, and labels a separate app "Existing tool" - never
   "Working" - because nothing here proves function. catalog.json and the Indicator Lab files are the owner's deposit and are
   NOT pinned here - the owner adds to them; the page must follow. */
test("the reviewed page and preview bytes; the lab's home is present", () => {
  assert.equal(sha("index.html"), "8f96eb94372159f5c947cd1e568b6f6e9712c74e87ff7b9501933fb8fc020ebc");
  assert.equal(sha("previews/signal-fanout-v2.html"), "8fd727c9d97178cc8226b509228f587d5ee0caf0954f62bb211b4f55c2a76f1d");
  assert.deepEqual(fs.readdirSync(at(".")).sort(), ["catalog.json", "index.html", "indicator-lab", "previews"]);
  assert.deepEqual(fs.readdirSync(at("previews")), ["signal-fanout-v2.html"]);
  assert.ok(fs.existsSync(at("indicator-lab/index.html")));
});

/* A catalog status says what an entry is; the page may only show one of these readiness words for it. An unknown status
   fails here rather than being painted with a guessed badge. */
const READINESS = { "Existing tool": "existing", "Existing preview": "preview", "Recovered local preview": "sample", "Review home": "review",
  "Latest artifact pending": "pending", "Recovery in progress": "pending" };
const BADGE = { existing: "Existing tool", preview: "Preview", sample: "Sample data", review: "Review home", pending: "Pending" };
const PURPOSES = ["markets", "signals", "portfolio", "workspaces", "visual"];
const escHtml = (s) => s.replace(/&/g, "&amp;");

function sections(page) {
  const out = {};
  for (const m of page.matchAll(/<section class="grp" data-purpose="([a-z]+)">([\s\S]*?)<\/section>/g)) out[m[1]] = m[2];
  return out;
}
function articles(html) {
  return [...html.matchAll(/<article ([^>]*)>([\s\S]*?)<\/article>/g)].map((m) => ({
    attrs: m[1], body: m[2],
    purpose: (m[1].match(/data-purpose="([a-z]+)"/) || [])[1], readiness: (m[1].match(/data-readiness="([a-z]+)"/) || [])[1],
    title: (m[2].match(/<h4>([\s\S]*?)<\/h4>/) || [])[1], desc: (m[2].match(/<\/h4><p>([\s\S]*?)<\/p>/) || [])[1],
    hrefs: [...m[2].matchAll(/href="([^"]+)"/g)].map((x) => x[1]) }));
}

test("every catalog entry appears exactly once, in a purpose group, with its truthful readiness and its own destination", () => {
  const page = fs.readFileSync(at("index.html"), "utf8"), cat = JSON.parse(fs.readFileSync(at("catalog.json"), "utf8"));
  const secs = sections(page);
  assert.deepEqual(Object.keys(secs), [...PURPOSES, "systems"], "the baseline's six Scintilla groups, in this order");
  assert.equal(articles(secs.systems).length, 0, "Systems holds the live products and Files, not catalog entries");
  const all = articles(page);
  assert.equal(all.length, cat.length, "one card per catalog entry");
  for (const p of PURPOSES) {
    const inSec = articles(secs[p]);
    assert.ok(inSec.length >= 1, p + " has at least one entry");
    for (const a of inSec) assert.equal(a.purpose, p, a.title + " sits in the section of its own purpose");
  }
  for (const e of cat) {
    const cards = all.filter((a) => a.title === escHtml(e.title));
    assert.equal(cards.length, 1, e.title + " appears exactly once");
    const c = cards[0], r = READINESS[e.status];
    assert.ok(r, e.title + ": status '" + e.status + "' has no readiness word - classify it before listing it");
    assert.equal(c.readiness, r, e.title + " readiness");
    assert.ok(c.body.includes('<span class="rd ' + r + '">' + BADGE[r] + "</span>"), e.title + " shows its readiness badge");
    assert.ok(c.desc.startsWith(escHtml(e.description)), e.title + " shows the catalog's own description");
    if (e.url) {
      assert.equal(c.hrefs[0], e.url, e.title + " opens its own destination first");
      for (const rel of e.related || []) assert.ok(c.hrefs.includes(rel.url), e.title + " keeps " + rel.label);
    } else {
      assert.equal(c.hrefs.length, 0, e.title + " is pending: named, not linked");
      assert.ok(c.body.includes('<span class="pending">' + e.status + "</span>"), e.title + " states its pending status");
    }
  }
  /* the readiness legend counts are the catalog's counts */
  const counts = {}; for (const e of cat) counts[READINESS[e.status]] = (counts[READINESS[e.status]] || 0) + 1;
  for (const [r, n] of Object.entries(counts)) assert.match(page, new RegExp('<li><b class="rd ' + r + '">' + BADGE[r] + "</b>" + n + " · "), r + " count " + n);
});

test("the Indicator Lab entry is the owner's: its link, status and card text are kept", () => {
  const page = fs.readFileSync(at("index.html"), "utf8"), cat = JSON.parse(fs.readFileSync(at("catalog.json"), "utf8"));
  const lab = cat.find((e) => e.title === "Indicator Lab");
  assert.ok(lab && lab.url === "/prototypes/indicator-lab/" && lab.status === "Review home");
  const card = articles(page).find((a) => a.title === "Indicator Lab");
  assert.equal(card.desc, "Cloud workshop, saved chart links, dated screenshots and the next indicator reviews. A home for the work, without keeping every chart open.");
  assert.deepEqual(card.hrefs, ["/prototypes/indicator-lab/"]);
  assert.doesNotMatch(page, /indicator-lab\/(downloads|captures)/, "the page links only the lab's home, never into its files");
});

test("links are real destinations only; the page is self-contained and stores nothing", () => {
  const page = fs.readFileSync(at("index.html"), "utf8"), cat = JSON.parse(fs.readFileSync(at("catalog.json"), "utf8"));
  const catUrls = new Set(cat.flatMap((e) => [e.url, ...(e.related || []).map((r) => r.url)]).filter(Boolean));
  const extra = ["https://scintillahub.ai/", "https://station.scintillahub.ai/",   // the two live products (header and Systems group)
    "https://app.notion.com/p/3e096edf91af816aa966eb2fe07ec9c5?pvs=204",               // Scintilla review page (navigation baseline review_url; sign-in required)
    "https://linear.app/alan-reply-desk/issue/REP-9", "https://linear.app/alan-reply-desk/issue/REP-18",   // assigned work (baseline "work"; sign-in required)
    "#overview", "#tools", "#review", "#work", "#architecture", "#page-spec"];         // in-page navigation
  for (const m of page.matchAll(/href="([^"]+)"/g)) assert.ok(catUrls.has(m[1]) || extra.includes(m[1]), "unlisted link " + m[1]);
  assert.deepEqual(cat.filter((e) => e.url && e.url.startsWith("/")).map((e) => e.url).sort(), ["/prototypes/indicator-lab/", "/prototypes/previews/signal-fanout-v2.html"]);
  const preview = fs.readFileSync(at("previews/signal-fanout-v2.html"), "utf8");
  for (const html of [page, preview, fs.readFileSync(at("indicator-lab/index.html"), "utf8")]) {
    assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
    assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=|<iframe|fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|document\.cookie/i, "self-contained: no external script or style, no request, no storage");
    assert.doesNotMatch(html, /eyJ[A-Za-z0-9_-]{10,}\.|apikey|service_role|Authorization|\/Users\//i, "no key, token or local path");
  }
  assert.match(preview, /Sample data, not live market values/);
});

test("navigation baseline v0.1: six sections in order, each anchor lands on its section", () => {
  const page = fs.readFileSync(at("index.html"), "utf8");
  const nav = (page.match(/<nav class="pn"[^>]*>([\s\S]*?)<\/nav>/) || [])[1] || "";
  const items = [...nav.matchAll(/<a href="#([a-z-]+)">([^<]+)<\/a>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(items, [["overview", "Overview"], ["tools", "Tools"], ["review", "Review"], ["work", "Work"], ["architecture", "Architecture"], ["page-spec", "Page spec"]]);
  const ids = [...page.matchAll(/<section class="part" id="([a-z-]+)">/g)].map((m) => m[1]);
  assert.deepEqual(ids, items.map((i) => i[0]), "one section per navigation item, in the same order");
});

test("Context Lens sits under Signals & context and stays pending - no artifact or validation is claimed", () => {
  const page = fs.readFileSync(at("index.html"), "utf8");
  const secs = sections(page);
  assert.ok(articles(secs.signals).some((a) => a.title === "Context Lens · v4"), "Context Lens is a Scintilla signals & context prototype");
  assert.ok(!articles(secs.visual).some((a) => /Context Lens/.test(a.title)), "not a visual/design item");
  const c = articles(page).find((a) => a.title === "Context Lens · v4");
  assert.equal(c.readiness, "pending"); assert.equal(c.hrefs.length, 0);
  assert.match(secs.signals, /<h3 class="gt">Signals &amp; context<\/h3>/);
  assert.doesNotMatch(page, /Working tool|data-readiness="working"|class="rd working"/, "no Working label anywhere without functional proof");
});

test("the page spec is public-safe and states purpose, owner, maturity, inputs, outputs, release and verification separately", () => {
  const page = fs.readFileSync(at("index.html"), "utf8");
  const spec = (page.match(/<section class="part" id="page-spec">([\s\S]*?)<\/section>/) || [])[1] || "";
  const terms = [...spec.matchAll(/<dt>([^<]+)<\/dt>/g)].map((m) => m[1]);
  assert.deepEqual(terms, ["Purpose", "Owner", "Maturity", "Inputs", "Outputs", "Release", "Verification", "Private material"]);
  assert.match(spec, /Being published is not the same as being verified/);
  /* generic patterns only: this test file is itself served publicly, so it must not name anyone or any private system */
  for (const re of [/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z.]{2,}/, /\/Users\/|~\//, /quota|utiliz|five.hour|weekly/i, /intake\b.*:|service.role|anon key/i])
    assert.doesNotMatch(page, re, "no private material on the public page: " + re);
  for (const m of page.matchAll(/<a href="(https:\/\/(?:linear\.app|app\.notion\.com)[^"]+)">[^<]*<\/a>(<span class="signin">sign-in required<\/span>)?/g))
    assert.ok(m[2], "a sign-in destination says so: " + m[1]);
});

test("the stylesheet is balanced: each @media block closes before the next rule set, so wide-screen rules are never trapped in a narrow query", () => {
  const page = fs.readFileSync(at("index.html"), "utf8");
  const css = (page.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || "";
  let depth = 0;
  for (let i = 0; i < css.length; i++) {
    if (css.startsWith("@media", i)) assert.equal(depth, 0, "an @media block opens inside another block at offset " + i);
    if (css[i] === "{") depth++;
    if (css[i] === "}") { depth--; assert.ok(depth >= 0, "unbalanced } at offset " + i); }
  }
  assert.equal(depth, 0, "every block is closed");
  for (const sel of ["nav.pn{", "section.part{", "h2.pt{", "dl.spec{", "table.arch{"]) {
    const at0 = css.indexOf(sel); assert.ok(at0 > 0, sel + " is styled");
    let d = 0; for (const ch of css.slice(0, at0)) { if (ch === "{") d++; if (ch === "}") d--; }
    assert.equal(d, 0, sel + " applies at every width, not only inside a media query");
  }
});

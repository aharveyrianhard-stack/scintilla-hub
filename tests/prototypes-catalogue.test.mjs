import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
const at = (p) => new URL("../prototypes/" + p, import.meta.url);
const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(at(p))).digest("hex");

/* September 19: the review home is grouped by what the work is for (markets, signals, portfolio, workspaces, design), shows
   each entry's readiness and where it lives, and keeps the Indicator Lab entry its owner deposited. catalog.json and the
   Indicator Lab files are the owner's deposit and are NOT pinned here - the owner adds to them; the page must follow. */
test("the reviewed page and preview bytes; the lab's home is present", () => {
  assert.equal(sha("index.html"), "eafb3ebdfc628ccf4776197cc99c06320f55b678a0b976218ae87b6198e88ea1");
  assert.equal(sha("previews/signal-fanout-v2.html"), "8fd727c9d97178cc8226b509228f587d5ee0caf0954f62bb211b4f55c2a76f1d");
  assert.deepEqual(fs.readdirSync(at(".")).sort(), ["catalog.json", "index.html", "indicator-lab", "previews"]);
  assert.deepEqual(fs.readdirSync(at("previews")), ["signal-fanout-v2.html"]);
  assert.ok(fs.existsSync(at("indicator-lab/index.html")));
});

/* A catalog status says what an entry is; the page may only show one of these readiness words for it. An unknown status
   fails here rather than being painted with a guessed badge. */
const READINESS = { "Existing tool": "working", "Existing preview": "preview", "Recovered local preview": "sample", "Review home": "review",
  "Latest artifact pending": "pending", "Recovery in progress": "pending" };
const BADGE = { working: "Working tool", preview: "Preview", sample: "Sample data", review: "Review home", pending: "Pending" };
const PURPOSES = ["markets", "signals", "portfolio", "workspaces", "design"];
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
    title: (m[2].match(/<h3>([\s\S]*?)<\/h3>/) || [])[1], desc: (m[2].match(/<\/h3><p>([\s\S]*?)<\/p>/) || [])[1],
    hrefs: [...m[2].matchAll(/href="([^"]+)"/g)].map((x) => x[1]) }));
}

test("every catalog entry appears exactly once, in a purpose group, with its truthful readiness and its own destination", () => {
  const page = fs.readFileSync(at("index.html"), "utf8"), cat = JSON.parse(fs.readFileSync(at("catalog.json"), "utf8"));
  const secs = sections(page);
  assert.deepEqual(Object.keys(secs), PURPOSES, "the five purpose groups, in this order");
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
  const extra = ["https://scintillahub.ai/", "https://station.scintillahub.ai/"];   // the two live products in the header and the destinations row
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

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
const at = (p) => new URL("../prototypes/" + p, import.meta.url);
const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(at(p))).digest("hex");

/* The static review catalogue root prepared and inspected (deliverable-homes/scintilla-prototypes, receipts beside it). It is
   copied byte for byte: these are root's recorded hashes, so an edit to any of the three files fails here. */
test("the three catalogue files are the bytes root inspected", () => {
  assert.equal(sha("index.html"), "a4b7c3ad4f242c1b23b24a90683523686e55fe3f832bc82b3b762d0766724f81");
  assert.equal(sha("catalog.json"), "29cf01c232cec74398d136b18aab0a881dca6b68160b5485b2dc4a36a41181e1");
  assert.equal(sha("previews/signal-fanout-v2.html"), "8fd727c9d97178cc8226b509228f587d5ee0caf0954f62bb211b4f55c2a76f1d");
  assert.deepEqual(fs.readdirSync(at(".")).sort(), ["catalog.json", "index.html", "previews"]);
  assert.deepEqual(fs.readdirSync(at("previews")), ["signal-fanout-v2.html"]);
});

test("twelve entries, the page and the data agree, pending work is named as pending, nothing is fetched or stored", () => {
  const page = fs.readFileSync(at("index.html"), "utf8"), cat = JSON.parse(fs.readFileSync(at("catalog.json"), "utf8")), preview = fs.readFileSync(at("previews/signal-fanout-v2.html"), "utf8");
  assert.equal(cat.length, 12); assert.equal((page.match(/<article data-topic=/g) || []).length, 12);
  for (const e of cat) { assert.ok(page.includes("<h2>" + e.title.replace(/&/g, "&amp;") + "</h2>"), e.title); if (e.url) assert.ok(page.includes('href="' + e.url + '"'), e.url); else assert.ok(page.includes('<span class="pending">' + e.status + "</span>"), e.title + " is shown as pending, not as a link"); }
  assert.deepEqual(cat.filter((e) => e.url && e.url.startsWith("/")).map((e) => e.url), ["/prototypes/previews/signal-fanout-v2.html"], "one local preview; every other entry is an existing public address or pending");
  for (const html of [page, preview]) {
    assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
    assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=|<iframe|fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|document\.cookie/i, "self-contained: no external script or style, no request, no storage");
    assert.doesNotMatch(html, /eyJ[A-Za-z0-9_-]{10,}\.|apikey|service_role|Authorization|\/Users\//i, "no key, token or local path");
  }
  assert.match(preview, /Sample data, not live market values/);
});

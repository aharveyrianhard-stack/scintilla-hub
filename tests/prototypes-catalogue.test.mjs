import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
const at = (p) => new URL("../prototypes/" + p, import.meta.url);
const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(at(p))).digest("hex");

/* The static review catalogue root prepared and inspected (deliverable-homes/scintilla-prototypes, receipts beside it).
   catalog.json and the preview are still root's bytes. index.html was restyled to the Scintilla identity (Alan: "the prototype home
   must look like Scintilla"): ONLY its <style> block changed - every byte after </style> (all markup, text, links and the filter
   script) is still root's inspected markup, pinned below, so any content edit still fails here. */
const MARKUP_AFTER_STYLE_ROOT_SHA256 = "e02ff3f12480ee96b5e068b4aa4db8310f8897835e6fe2ce5529e566cf44d046";   // of root's a4b7c3ad... bytes
test("the three catalogue files are the bytes root inspected (index.html: style restyled, markup unchanged)", () => {
  assert.equal(sha("index.html"), "cc8c27084fc452766ec50b4b4505dfb1338099d48aa3f230218f20c6c4153142");
  const page = fs.readFileSync(at("index.html"), "utf8");
  assert.equal(crypto.createHash("sha256").update(page.split("</style>")[1]).digest("hex"), MARKUP_AFTER_STYLE_ROOT_SHA256, "markup after the style block is root's");
  assert.match(page, /--crk:#00D4FF/, "Scintilla cyan"); assert.match(page, /--bg:#0A0A0F/, "Scintilla background");
  assert.match(page, /"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace/, "the Hub's mono stack, no web font fetched");
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

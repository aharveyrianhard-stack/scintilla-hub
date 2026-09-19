import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
const at = (p) => new URL("../prototypes/" + p, import.meta.url);
const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(at(p))).digest("hex");

/* September 19: add the requested Indicator Lab; preserve the original preview. */
test("catalogue bytes include the reviewed lab addition", () => {
  assert.equal(sha("index.html"), "a87fda7843d040ee4bb9f84b79014be0a18a06c6d93bc53cfd1141438f76ee23");
  assert.equal(sha("catalog.json"), "18dc1e21b0f63d86207d121470390c2aa2adf9cb831b7c5da24a2ba557ce4bd7");
  assert.equal(sha("previews/signal-fanout-v2.html"), "8fd727c9d97178cc8226b509228f587d5ee0caf0954f62bb211b4f55c2a76f1d");
  assert.deepEqual(fs.readdirSync(at(".")).sort(), ["catalog.json", "index.html", "indicator-lab", "previews"]);
  assert.deepEqual(fs.readdirSync(at("previews")), ["signal-fanout-v2.html"]);
});

test("thirteen entries agree, pending work is named as pending, nothing is fetched or stored", () => {
  const page = fs.readFileSync(at("index.html"), "utf8"), cat = JSON.parse(fs.readFileSync(at("catalog.json"), "utf8")), preview = fs.readFileSync(at("previews/signal-fanout-v2.html"), "utf8");
  assert.equal(cat.length, 13); assert.equal((page.match(/<article data-topic=/g) || []).length, 13);
  for (const e of cat) { assert.ok(page.includes("<h2>" + e.title.replace(/&/g, "&amp;") + "</h2>"), e.title); if (e.url) assert.ok(page.includes('href="' + e.url + '"'), e.url); else assert.ok(page.includes('<span class="pending">' + e.status + "</span>"), e.title + " is shown as pending, not as a link"); }
  assert.deepEqual(cat.filter((e) => e.url && e.url.startsWith("/")).map((e) => e.url), ["/prototypes/indicator-lab/", "/prototypes/previews/signal-fanout-v2.html"]);
  for (const html of [page, preview, fs.readFileSync(at("indicator-lab/index.html"), "utf8")]) {
    assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
    assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=|<iframe|fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|document\.cookie/i, "self-contained: no external script or style, no request, no storage");
    assert.doesNotMatch(html, /eyJ[A-Za-z0-9_-]{10,}\.|apikey|service_role|Authorization|\/Users\//i, "no key, token or local path");
  }
  assert.match(preview, /Sample data, not live market values/);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const vercel = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));

/* September 19: the Scintilla logo menu gains one plain link to the review home, beside Equalizer and Files. It is an <a>
   with a real href and NO data-act, so the menu controller's click switch never sees it (no script, no saved state), and
   every existing item keeps its place. */
const menu = (page.match(/<aside class="sc-menu" id="scMenu"[^>]*>([\s\S]*?)<\/aside>/) || [])[1] || "";

test("the logo menu lists its items in the same order, with Prototypes after Files", () => {
  assert.ok(menu, "the menu exists");
  const items = [...menu.matchAll(/<(button|a) class="sc-menu__item"([^>]*)>/g)].map((m) => (m[2].match(/data-act="([a-zA-Z]+)"/) || m[2].match(/data-menu-link="([a-z]+)"/))[1]);
  assert.deepEqual(items, ["menuChat", "menuEq", "menuFav", "menuCoh", "menuInbox", "prototypes", "menuSys"]);
  const secs = [...menu.matchAll(/<div class="sc-menu__sec">([^<]+)<\/div>/g)].map((m) => m[1]);
  assert.deepEqual(secs, ["Chat", "Operator Inputs", "Files", "Review", "Systems Operation"]);
});

test("Prototypes is a plain same-site link to /prototypes/ that the menu script cannot intercept", () => {
  const links = [...menu.matchAll(/<a class="sc-menu__item"([^>]*)>([\s\S]*?)<\/a>/g)];
  assert.equal(links.length, 1, "exactly one link item");
  const [, attrs, body] = links[0];
  assert.match(attrs, / href="\/prototypes\/"/);
  assert.doesNotMatch(attrs, /data-act=|target=|onclick=/, "no data-act (the controller only handles [data-act]), no new tab, no inline handler");
  assert.match(body, /<span class="sc-menu__iname">Prototypes <span class="sc-menu__ob">· page<\/span><\/span>/);
  assert.match(page, /a\.sc-menu__item\{text-decoration:none\}/, "the link looks like the other items");
  assert.equal((page.match(/href="\/prototypes\/"/g) || []).length, 1, "one entry point");
});

test("/prototypes/ is served by the static file, not rewritten or redirected", () => {
  assert.ok(fs.existsSync(new URL("../prototypes/index.html", import.meta.url)));
  for (const r of [...(vercel.rewrites || []), ...(vercel.redirects || [])]) assert.doesNotMatch(r.source, /^\/prototypes|^\/\(\.\*\)|^\/:path/, "no route captures /prototypes: " + r.source);
});

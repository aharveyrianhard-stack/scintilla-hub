/* The widget shelf (M71). This page is the exception to the self-contained rule: its whole job is to mount
   TradingView and Investing.com widgets live, so it loads vendor code by design. What these tests hold is that
   it stays honest and stays light: nothing loads before a click, it never claims to see inside a frame it cannot
   read, the measured refusals stay written down, and no Scintilla data or key is on the page. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const P = path.join(process.cwd(), "prototypes", "widget-scout", "index.html");
const html = fs.readFileSync(P, "utf8");

test("it carries the way back and stays out of search", () => {
  assert.match(html, /data-scnav-slot/, "the BACK / CLOSE pair has a slot in the header");
  assert.match(html, /id="scnav-css"/, "the pair's own styles are inlined by scripts/inject-scnav.py");
  assert.match(html, /data-go="back"[\s\S]*data-go="close"/, "both buttons are built");
  assert.match(html, /<meta name="robots" content="noindex">/);
});

test("nothing loads until a group is clicked", () => {
  assert.doesNotMatch(html, /<iframe/i, "no iframe sits in the markup");
  assert.doesNotMatch(html, /<script[^>]+src="https:\/\/s3\.tradingview/i, "no vendor script tag in the markup");
  assert.match(html, /addEventListener\("click"/, "groups mount on click");
  assert.match(html, /data-loaded/, "a group mounts once, not on every click");
});

test("it never claims to see inside a frame it cannot read", () => {
  assert.match(html, /CONTENTS NOT READABLE FROM THIS PAGE/,
    "cross-origin frames are reported as mounted, not as rendered");
  assert.match(html, /AN EMPTY BLACK PANEL MEANS THE VENDOR REFUSED/, "the legend says what a black panel means");
  const rendered = html.match(/"RENDERED"/g) || [];
  assert.ok(rendered.length > 0 && /len === -1 \? "MOUNTED"/.test(html),
    "RENDERED is reserved for the case where the content really is readable");
});

test("the measured Investing.com refusal is written on the page", () => {
  const warns = html.match(/warn:"Measured 24 Sep[^"]*403[^"]*"/g) || [];
  assert.equal(warns.length, 4, "all four Investing.com panels carry the measured 403");
});

test("the newer TradingView family is asked for its dark build", () => {
  const tvw = html.match(/fam:"tvw"/g) || [];
  const dark = html.match(/theme:"dark"/g) || [];
  assert.ok(tvw.length >= 11, "the new web components are all listed");
  assert.ok(dark.length >= tvw.length,
    'every new-family widget carries theme="dark" - without it they arrive on a white background');
});

test("no Scintilla data, key or local path is on the page", () => {
  assert.doesNotMatch(html, /eyJ[A-Za-z0-9_-]{10,}\.|apikey|service_role|Authorization|\/Users\//i);
  assert.doesNotMatch(html, /supabase|scintilla-massive-chart-api|postgrest/i,
    "the shelf shows other people's widgets only - no Scintilla source is read here");
});

test("iOS Stocks is described, not faked, and Apple's own page is linked", () => {
  assert.match(html, /Apple ships no embeddable widget|cannot be embedded|There is no web embed/i);
  assert.match(html, /support\.apple\.com/, "Apple's own page is linked");
  assert.doesNotMatch(html, /apple\.com\/.*\.(png|jpg|jpeg|webp)/i, "no Apple image is copied");
});

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
   NOT pinned here - the owner adds to them; the page must follow.

   September 22 (navigation rebuild): the owner could reach pages he could not leave - "I'm stuck, I can't close the page, I
   have to open a new window". Two rules now hold the page to that complaint, and are tested below: a destination on another
   address opens in a NEW TAB so this page is never consumed, and a destination on this site must carry a link back here.
   The page is generated from catalog.json, so the two can no longer drift. The Station dock concept was published under
   /prototypes/dock-concept/ in the same pass, because it had only ever been sent as a file.

   September 23: the company report library joins under /prototypes/report-library/ (see tests/report-library.test.mjs).

   September 23, overnight (cards): the owner found the page "very hard to navigate ... not very cardified or readable".
   The page is now a card grid that reflows from a phone to a TV (auto-fill columns, no fixed box), every card carries a
   DATE beside its readiness label, and a LATEST strip at the top lists what just shipped, newest first, generated from
   latest.json. The rules below hold the page to that: a date on every card, the strip in order and never a dead end,
   no fixed column count anywhere. */
test("the reviewed page and preview bytes; the lab's home is present", () => {
  assert.equal(sha("index.html"), "298dc2f067e51fede647bdeecfc7bd98ee712c873135f2570d3ddd85cb7c0ad7");   // rebuilt 23 Sep (M18): one scrolling page on the 3D-workshop model - picture band, chips, dates - in greys, no hidden tabs
  assert.equal(sha("previews/signal-fanout-v2.html"), "13b2c843f68af1b98c02e78f40ff68994ab383cd490e6e561b5584a0d0f2fb51");
  assert.equal(sha("dock-concept/index.html"), "0c2c682844c2cfff7227d162c9db5e12ea1cfe5c6f1f350930dcda775975aebc");
  assert.deepEqual(fs.readdirSync(at(".")).sort(), ["catalog.json", "dock-concept", "index.html", "indicator-lab", "latest.json", "previews", "report-library"]);
  assert.deepEqual(fs.readdirSync(at("previews")), ["signal-fanout-v2.html"]);
  assert.ok(fs.existsSync(at("indicator-lab/index.html")));
});

/* A catalog status says what an entry is; the page may only show one of these readiness words for it. An unknown status
   fails here rather than being painted with a guessed badge. */
const READINESS = { "Existing tool": "existing", "Existing preview": "preview", "Recovered local preview": "sample",
  "Concept study": "sample", "Review home": "review", "Latest artifact pending": "pending", "Recovery in progress": "pending" };
const BADGE = { existing: "Existing tool", preview: "Preview", sample: "Sample data", review: "Review home", pending: "Pending" };
const DATE_KIND = { updated: "Updated", checked: "Checked", named: "Named" };
const PURPOSES = ["markets", "signals", "portfolio", "workspaces", "visual"];
const escHtml = (s) => s.replace(/&/g, "&amp;");
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayLabel = (iso) => { const [y, m, d] = iso.split("-").map(Number); return d + " " + MONTH[m - 1]; };

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
    when: (m[2].match(/<span class="when" data-date="(\d{4}-\d\d-\d\d)">([^<]+)<\/span>/) || []),
    anchors: [...m[2].matchAll(/<a\b([^>]*)>/g)].map((x) => x[1]),
    hrefs: [...m[2].matchAll(/href="([^"]+)"/g)].map((x) => x[1]) }));
}
function latestItems(page) {
  const strip = (page.match(/<section class="latest"[^>]*>([\s\S]*?)<\/section>/) || [])[1] || "";
  return [...strip.matchAll(/<(a|div) class="li"([^>]*)>([\s\S]*?)<\/\1>/g)].map((m) => ({
    tag: m[1], attrs: m[2], body: m[3],
    when: (m[2].match(/data-when="([^"]+)"/) || [])[1], href: (m[2].match(/href="([^"]+)"/) || [])[1],
    title: (m[3].match(/<span class="lt">([\s\S]*?)<\/span>/) || [])[1], kind: (m[3].match(/<span class="lm"><b>([^<]+)<\/b>/) || [])[1] }));
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

/* THE DATE RULE. Every card says when it last moved and what kind of date that is: Updated (a page on this site changed),
   Checked (an address elsewhere answered) or Named (listed without an address). A catalog entry without a date is a build
   error, not a blank. */
test("every card carries its catalog date, labelled as updated, checked or named", () => {
  const page = fs.readFileSync(at("index.html"), "utf8"), cat = JSON.parse(fs.readFileSync(at("catalog.json"), "utf8"));
  const all = articles(page);
  for (const e of cat) {
    assert.match(e.date || "", /^\d{4}-\d\d-\d\d$/, e.title + " has an ISO date in the catalog");
    assert.ok(DATE_KIND[e.date_kind], e.title + " says what kind of date it carries");
    if (e.date_kind === "updated") assert.ok(!e.url || e.url.startsWith("/"), e.title + ": only a page on this site can be 'updated' here; elsewhere we can only check");
    const c = all.find((a) => a.title === escHtml(e.title));
    assert.equal(c.when[1], e.date, e.title + " card carries the catalog date");
    assert.equal(c.when[2], DATE_KIND[e.date_kind] + " " + dayLabel(e.date), e.title + " date reads as words");
    assert.match(c.body, /<div class="meta"><span class="rd [a-z]+">[^<]+<\/span><span class="when"/, e.title + ": the date sits beside the readiness label");
  }
});

/* THE LATEST RULE. The strip at the top is generated from latest.json: every item, newest first, with its kind and time,
   and the same exit rules as the cards (elsewhere -> new tab; this site -> the destination carries a way back). */
test("the latest strip lists every latest.json item, newest first, with a kind, a time and a safe exit", () => {
  const page = fs.readFileSync(at("index.html"), "utf8"), latest = JSON.parse(fs.readFileSync(at("latest.json"), "utf8"));
  const items = latestItems(page);
  assert.ok(latest.length >= 3 && latest.length <= 24, "a small feed: between 3 and 24 items");
  assert.equal(items.length, latest.length, "one strip item per latest.json entry");
  const expected = [...latest].sort((a, b) => (a.when < b.when ? 1 : a.when > b.when ? -1 : 0));
  assert.deepEqual(items.map((i) => i.when), expected.map((x) => x.when), "newest first");
  assert.deepEqual(items.map((i) => i.title), expected.map((x) => escHtml(x.title)));
  const KIND = { deploy: "Deployed", page: "Published", feed: "Feed" };
  for (const [i, x] of expected.entries()) {
    assert.match(x.when, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/, x.title + " has a UTC time");
    assert.ok(KIND[x.kind], x.title + " has a known kind");
    assert.equal(items[i].kind, KIND[x.kind]);
    assert.match(items[i].body, /<span class="lm"><b>[^<]+<\/b>(?:<span class="new">Newest<\/span>)?<span>\d{1,2} [A-Z][a-z]{2} · \d{1,2}:\d\d [ap]m ET<\/span><\/span>/, x.title + " shows its day and Eastern time");
    assert.equal(/<span class="new">Newest<\/span>/.test(items[i].body), i === 0, x.title + (i === 0 ? " is marked newest" : " is not marked newest"));
    assert.ok(x.what && x.what.length >= 20, x.title + " says what happened in a sentence");
    if (x.url) {
      assert.equal(items[i].tag, "a"); assert.equal(items[i].href, x.url);
      if (x.url.startsWith("http")) assert.match(items[i].attrs, /target="_blank" rel="noopener"/, x.title + " opens elsewhere in a new tab");
      else assert.doesNotMatch(items[i].attrs, /target=/, x.title + " opens here");
    } else assert.equal(items[i].tag, "div", x.title + " has no address and is not a link");
  }
  assert.match(page, new RegExp("<p>" + latest.length + " most recent · newest "), "the strip states its own count");
});

/* THE "I'M STUCK" RULE. Every card that goes somewhere must say where the owner ends up, and be built so he can get back:
   another address opens in a new tab (this page survives); this site opens in place and the destination carries a link home. */
test("no card is a dead end: another address opens in a new tab, this site carries a link back", () => {
  const page = fs.readFileSync(at("index.html"), "utf8"), cat = JSON.parse(fs.readFileSync(at("catalog.json"), "utf8"));
  const latest = JSON.parse(fs.readFileSync(at("latest.json"), "utf8"));
  const all = articles(page);
  for (const e of cat) {
    if (!e.url) { assert.ok(!e.exit, e.title + " is pending and needs no exit"); continue; }
    const c = all.find((a) => a.title === escHtml(e.title));
    const external = e.url.startsWith("http");
    assert.equal(e.exit, external ? "newtab" : "back", e.title + " declares how it is left");
    for (const a of c.anchors) {
      if (external) {
        assert.match(a, /target="_blank"/, e.title + ": an off-site link opens in a new tab");
        assert.match(a, /rel="noopener"/, e.title + ": a new-tab link is opened safely");
      } else assert.doesNotMatch(a, /target="_blank"/, e.title + ": a same-site link opens in place and carries a way back");
    }
    assert.match(c.body, external ? /Opens in a new tab/ : /carries a link back to this page/, e.title + " says how it is left");
  }
  /* every off-site anchor anywhere on the page - not only the cards - opens in a new tab */
  for (const m of page.matchAll(/<a\b([^>]*href="https?:[^"]*"[^>]*)>/g))
    assert.match(m[1], /target="_blank"[^>]*rel="noopener"|rel="noopener"[^>]*target="_blank"/, "off-site link opens in a new tab: " + m[1]);
  /* and every same-site destination this page names - card or latest item - really does carry a link home */
  const home = /href="\/prototypes\/"/;
  const sameSite = [...cat.map((e) => e.url), ...latest.map((x) => x.url)].filter((u) => u && u.startsWith("/"));
  for (const u of new Set(sameSite)) {
    const file = u.endsWith("/") ? u + "index.html" : u;
    const html = fs.readFileSync(new URL(".." + file, import.meta.url), "utf8");
    assert.match(html, home, u + " carries a link back to /prototypes/");
  }
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
  const latest = JSON.parse(fs.readFileSync(at("latest.json"), "utf8"));
  const catUrls = new Set(cat.flatMap((e) => [e.url, ...(e.related || []).map((r) => r.url)]).filter(Boolean));
  const OURS = /^(https:\/\/(scintillahub\.ai|station\.scintillahub\.ai|allocation\.scintillahub\.ai|sectorrotation\.scintillahub\.ai|scintilla-[a-z-]+\.vercel\.app)\/|\/)/;
  for (const x of latest) if (x.url) { assert.match(x.url, OURS, "a latest item may only open one of our own addresses: " + x.url); catUrls.add(x.url); }
  const extra = ["https://scintillahub.ai/", "https://station.scintillahub.ai/",   // the two live products (header and Systems group)
    "https://app.notion.com/p/3e096edf91af816aa966eb2fe07ec9c5?pvs=204",               // Scintilla review page (navigation baseline review_url; sign-in required)
    // assigned work, in the owning Scintilla workspace (the old alan-reply-desk links were the historical desk)
    "https://linear.app/aharvey-scintilla/issue/SCI-11/restore-scintilla-hub-and-station-to-working-screens",
    "https://linear.app/aharvey-scintilla/issue/SCI-10/context-lens-reconcile-latest-version-and-hosted-prototype",
    "https://linear.app/aharvey-scintilla/issue/SCI-28/station-indicator-lab-clouds-on-every-chart-apple-dock-top-controls",
    "#overview", "#tools", "#review", "#work", "#architecture", "#page-spec"];         // in-page navigation
  for (const m of page.matchAll(/href="([^"]+)"/g)) assert.ok(catUrls.has(m[1]) || extra.includes(m[1]), "unlisted link " + m[1]);
  assert.deepEqual(cat.filter((e) => e.url && e.url.startsWith("/")).map((e) => e.url).sort(),
    ["/lab.html", "/prototypes/dock-concept/", "/prototypes/indicator-lab/", "/prototypes/previews/signal-fanout-v2.html", "/prototypes/report-library/", "/visual-engine/"]);
  const preview = fs.readFileSync(at("previews/signal-fanout-v2.html"), "utf8");
  const dock = fs.readFileSync(at("dock-concept/index.html"), "utf8");
  for (const html of [page, preview, dock, fs.readFileSync(at("indicator-lab/index.html"), "utf8"), fs.readFileSync(at("report-library/index.html"), "utf8")]) {
    assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
    assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=|<iframe|fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|document\.cookie/i, "self-contained: no external script or style, no request, no storage");
    assert.doesNotMatch(html, /eyJ[A-Za-z0-9_-]{10,}\.|apikey|service_role|Authorization|\/Users\//i, "no key, token or local path");
  }
  /* latest.json is served publicly too: it may name commits and receipts, never a path, a person or a key */
  const feed = fs.readFileSync(at("latest.json"), "utf8");
  assert.doesNotMatch(feed, /\/Users\/|~\/|[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z.]{2,}|eyJ[A-Za-z0-9_-]{10,}\.|apikey|service_role/i, "latest.json is public-safe");
  assert.match(preview, /Sample data, not live market values/);
  assert.match(dock, /nothing here touches the live Station/, "the dock page still says it is a concept");
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
  for (const m of page.matchAll(/<a\b[^>]*href="(https:\/\/(?:linear\.app|app\.notion\.com)[^"]+)"[^>]*>[^<]*<\/a>(<span class="signin">sign-in required<\/span>)?/g))
    assert.ok(m[2], "a sign-in destination says so: " + m[1]);
});

/* THE REFLOW RULE. The owner judges on a phone, a laptop and a TV. A fixed column count in a fixed box wastes half of a
   1920 px screen and squeezes a phone; the grid must ask for as many ~300 px columns as fit, in a page that uses its width. */
test("the cards reflow: auto-fill columns, no fixed column count, no fixed narrow box, type that scales with the screen", () => {
  const page = fs.readFileSync(at("index.html"), "utf8");
  const css = (page.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || "";
  assert.match(css, /\.grid\{display:grid;grid-template-columns:repeat\(auto-fill,minmax\(min\(100%,3\d\dpx\),1fr\)\)/, "the card grid auto-fills ~300 px columns");
  assert.doesNotMatch(css, /grid-template-columns:repeat\([1-9],/, "no fixed column count anywhere");
  assert.doesNotMatch(css, /\.wrap\{max-width:1\d{3}px/, "no laptop-sized box: the page uses the screen it is given");
  assert.match(css, /font-size:clamp\(15px,[^)]+,19px\)/, "the base type scales between a phone and a TV");
  assert.match(css, /\.rail\{display:flex;[^}]*overflow-x:auto/, "the latest strip scrolls sideways instead of wrapping into a wall");
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
  for (const sel of ["nav.pn{", "section.part{", "h2.pt{", "dl.spec{", "table.arch{", ".grid{", ".latest{", ".when{"]) {
    const at0 = css.indexOf(sel); assert.ok(at0 > 0, sel + " is styled");
    let d = 0; for (const ch of css.slice(0, at0)) { if (ch === "{") d++; if (ch === "}") d--; }
    assert.equal(d, 0, sel + " applies at every width, not only inside a media query");
  }
});

/* House rule: the palette is monochrome and carries no white or near-white. The rebuilt page caps its brightest ink well
   below white and uses one accent hue at different opacities for readiness, rather than a second or third colour. */
test("the rebuilt page is monochrome: no white, no near-white, one accent hue", () => {
  const page = fs.readFileSync(at("index.html"), "utf8");
  const css = (page.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || "";
  for (const bad of ["#fff", "#ffffff", "#f2f2f8", "#c6c8de", "#e2e4f0"])
    assert.ok(!css.toLowerCase().includes(bad), "near-white in the palette: " + bad);
  /* the keyword, but not the `white-space` property that merely starts with it */
  assert.doesNotMatch(css, /(?:^|[;{\s])(?:color|background|background-color|border|border-color|fill|stroke)\s*:\s*[^;{}]*\bwhite\b(?!-)/i,
    "the colour keyword white is used");
  const hexes = [...css.matchAll(/#([0-9a-fA-F]{6})\b/g)].map((m) => m[1].toLowerCase());
  for (const h of hexes) {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    assert.ok(0.2126 * r + 0.7152 * g + 0.0722 * b < 205, "#" + h + " is too close to white for the Scintilla palette");
  }
  /* one accent hue only: no green, orange or red tokens survive from the old page */
  for (const bad of ["#00ffa3", "#ff8a00", "#ff2d55", "#ffe500", "#2d9cff", "#8b5cf6"])
    assert.ok(!css.toLowerCase().includes(bad), "a second accent hue is on the page: " + bad);
});

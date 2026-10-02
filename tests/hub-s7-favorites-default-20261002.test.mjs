// S7 (2 Oct) — THE BOARD OPENS ON ★ FAVORITES. BRIEF-20261002-S7 item 2.
// Alan, 2 Oct: "I need it to default to the FAVORITES from now on instead of LIKED. I've already started saving stuff to
// favorites. It's a cleaner list." Internal names: "FAVORITES" is the ★ tab, "FAV" the ♥ LIKED tab, "RADAR" the ⊙ tab.
// If FAVORITES is empty once the lists have loaded, the board falls back to ♥ LIKED, and to ALL if that is empty too — without
// ever painting an empty FAVORITES board first. The page's own functions are run here (extracted from index.html).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fn = (name) => page.match(new RegExp("(async )?function " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n"))[0];
const cohBootFor = new Function(fn("cohBootFor") + "return cohBootFor;")();

test("the boot state names ★ FAVORITES; the tab bar still has RADAR, FAVORITES, LIKED, ALL", () => {
  assert.match(page, /const S = \{\n  sec: scEntryRoom\(\) \|\| "DASHBOARD", coh: "FAVORITES",/);
  assert.match(page, /tab\("RADAR", "⊙ RADAR"[^)]*\) \+ tab\("FAVORITES", "★ FAVORITES"[^)]*\) \+ tab\("FAV", "♥ LIKED"[^)]*\) \+ tab\("ALL", "ALL"\)/);
});

test("the pick: FAVORITES while it has names or is not yet known; else LIKED; else ALL", () => {
  assert.equal(cohBootFor({ favorites: ["MU"], radar: [] }, ["MU", "NVDA"], true), "FAVORITES");
  assert.equal(cohBootFor({ favorites: [], radar: [] }, ["MU"], false), "FAVORITES", "not known yet: stay on FAVORITES, show 'reading FAVORITES …'");
  assert.equal(cohBootFor({ favorites: [], radar: ["AMD"] }, ["MU"], true), "FAV", "an empty FAVORITES: ♥ LIKED");
  assert.equal(cohBootFor({ favorites: [], radar: [] }, [], true), "ALL", "LIKED empty too: ALL");
  assert.equal(cohBootFor(null, null, true), "ALL");
});

/* the first server read, run with the page's own listsLoad against stubs */
function boot({ remembered, server, fav, picked }) {
  const ls = new Map(remembered ? [["sc_lists", JSON.stringify(remembered)]] : []);
  const calls = [];
  const S = { coh: "FAVORITES", fav: fav || [], tq: "" };
  const consts = page.match(/const LIST_COHS = [^\n]*\nconst SUB_LISTS = [^\n]*\nconst LISTS = [^\n]*\nlet LISTS_READ = [^\n]*\n/)[0] +
    page.match(/const LISTS_LS_KEY = [^\n]*\nlet COH_BOOT_PICK = [^\n]*\n/)[0] + page.match(/const LISTS_SEL = [^\n]*\n/)[0];
  const api = new Function("S", "lsGet", "lsSet", "pg", "restartFeed", "updateBoard", "coListsRepaint", "console",
    consts + fn("cohBootFor") + fn("listsRemember") + fn("listsRecall") + fn("listsFromRows") + fn("listsRepaint") + fn("listsLoad") +
    `/* the boot line, verbatim */
     const bootLine = () => { ${page.match(/try \{ const seen = listsRecall\(\);[^\n]*/)[0]} };
     return { bootLine, listsLoad, pickTab: () => { COH_BOOT_PICK = false; }, LISTS, state: () => ({ COH_BOOT_PICK, LISTS_READ }) };`)(
    S, (k) => (ls.has(k) ? ls.get(k) : null), (k, v) => ls.set(k, v),
    async () => server.flatMap((t, i) => t.map((x, j) => ({ list: i ? "radar" : "favorites", position: j + 1, ticker: x }))),
    () => calls.push("restartFeed:" + S.coh), () => calls.push("updateBoard:" + S.coh), () => calls.push("coListsRepaint"), console);
  return { api, S, calls, ls, picked };
}

test("first visit, favorites saved on the server: opens on FAVORITES ('reading …' until the read), then fills it", async () => {
  const b = boot({ remembered: null, server: [["MU", "NBIS"], []], fav: ["MU", "NBIS", "SNDK"] });
  b.api.bootLine();
  assert.equal(b.S.coh, "FAVORITES", "nothing remembered: FAVORITES, not yet known");
  await b.api.listsLoad();
  assert.equal(b.S.coh, "FAVORITES");
  assert.deepEqual(b.calls, ["restartFeed:FAVORITES", "coListsRepaint"], "the board fetches FAVORITES once the list is read");
  assert.deepEqual(JSON.parse(b.ls.get("sc_lists")), { favorites: ["MU", "NBIS"], radar: [] }, "remembered for the next visit");
});

test("first visit, FAVORITES empty: moves to LIKED on the first read, before an empty FAVORITES board is painted", async () => {
  const b = boot({ remembered: null, server: [[], ["AMD"]], fav: ["MU"] });
  b.api.bootLine();
  await b.api.listsLoad();
  assert.equal(b.S.coh, "FAV");
  assert.deepEqual(b.calls, ["restartFeed:FAV", "coListsRepaint"], "no repaint of an empty FAVORITES board on the way");
  const c = boot({ remembered: null, server: [[], []], fav: [] });
  c.api.bootLine(); await c.api.listsLoad();
  assert.equal(c.S.coh, "ALL", "LIKED empty too: ALL");
});

test("return visit: the remembered FAVORITES paints at once; an empty remembered list boots straight into LIKED (no flash)", async () => {
  const b = boot({ remembered: { favorites: ["MU"], radar: [] }, server: [["MU"], []], fav: ["MU", "NVDA"] });
  b.api.bootLine();
  assert.equal(b.S.coh, "FAVORITES"); assert.deepEqual(b.api.LISTS.favorites, ["MU"], "seeded before the first paint");
  assert.equal(b.api.state().LISTS_READ, false, "a remembered list is not a read one");
  await b.api.listsLoad();
  assert.equal(b.S.coh, "FAVORITES");
  const e = boot({ remembered: { favorites: [], radar: [] }, server: [[], []], fav: ["MU"] });
  e.api.bootLine();
  assert.equal(e.S.coh, "FAV", "remembered empty: LIKED from the very first paint");
  await e.api.listsLoad();
  assert.equal(e.S.coh, "FAV");
  /* names added on another device since: the first read takes the board back to FAVORITES */
  const f = boot({ remembered: { favorites: [], radar: [] }, server: [["NBIS"], []], fav: ["MU"] });
  f.api.bootLine(); await f.api.listsLoad();
  assert.equal(f.S.coh, "FAVORITES");
});

test("a tab the operator picks is never moved by the fallback", async () => {
  const b = boot({ remembered: null, server: [[], []], fav: ["MU"] });
  b.api.bootLine();
  b.api.pickTab(); b.S.coh = "FAVORITES";
  await b.api.listsLoad();
  assert.equal(b.S.coh, "FAVORITES", "chosen on purpose: the empty state is shown, with how to fill it");
  assert.match(page, /case "coh": \{\n\s+S\.coh = a\.dataset\.key; S\.tq = "";\n\s+COH_BOOT_PICK = false;/);
});

test("the remembered lists are a display seed only: cleaned on read, never written back to the server", () => {
  const recall = new Function("lsGet", "LISTS_LS_KEY", fn("listsRecall") + "return listsRecall;");
  assert.deepEqual(recall(() => JSON.stringify({ favorites: ["mu", "<x>", "BRK.B"], radar: ["amd"] }), "sc_lists")(), { favorites: ["MU", "BRK.B"], radar: ["AMD"] });
  assert.equal(recall(() => "{broken", "sc_lists")(), null);
  assert.equal(recall(() => JSON.stringify({ favorites: "MU" }), "sc_lists")(), null);
  assert.doesNotMatch(fn("listsRecall") + fn("listsRemember"), /listStore|operatorWrite|fetch\(/);
});

test("the map / rotation panels keep following the selected tab (their FAV label is for ♥ LIKED only)", () => {
  assert.match(page, /function l0RotScopeLbl\(set\) \{ return set === L0_SECTORS \? "sectors" : "names · " \+ \(COH_ABBR\[S\.coh\] \|\| \(S\.coh === "FAV" \? "LIKED" : S\.coh\)\); \}/);
});

// HC1 (6 Oct 2026) — "I CAN'T ADD FAVORITES." Alan, on the iMac: "Reload it. Nope … CrowdStrike … NET … OKTA … still nope"
// (LIKED works). The cause, read from the database's own catalog: public.station_lists has
//   station_lists_position_check  CHECK (position >= 1 AND position <= 64)
// and his FAVORITES reached 64 names at 16:51:00 ET (DLR). EQIX, twelve seconds later, asked for position 65: the whole
// write was refused (HTTP 400, SQLSTATE 23514) and the page re-read the stored 64 and un-starred the name without a word.
// It is not EQIX and it is not the iMac: any name is refused once the list holds 64.
//
// Two fixes. In the database: the coordinator raised the cap himself the same evening (64 → 256, ~19:40 ET) and appended
// the seven names Alan had tried; this lane changes no table. On the page (here): a refused write puts the screen
// straight back to what is stored and says why, in one plain line — so the next full list is never silent again.
// These run the page's own functions (lifted from index.html) against a stand-in table that follows the database's rules;
// the refusal's wording is the engine's own, recorded in deliverables/20261006/hc1-compare-one-screen/data/not-applied/migration-check.json.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const CAP_NOW = 256;                                    // the database's cap since 6 Oct ~19:40 ET (the coordinator's fix); 64 before
const fn = (name) => {
  const m = page.match(new RegExp("\\n(async )?function " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n"));
  assert.ok(m, name + " is a top-level function of the page");
  return m[0];
};
const SB = "https://db.test";
const FAVS_64 = ("MU NBIS AXTI SPCX SNDK GCUSD GOOGL CRWV AMZN IREN AVGO AAOI ASTS SLV CBRS MSFT MRVL ASML LRCX AGIX BE TSM AAPL NVTS TSLA VST LITE " +
  "BTCUSD CRDO COHR AMAT RDW CEG AMD APLD ANET INTC META MSTR NOW OKLO SNOW SOFI WDC WMT WULF NVDA ORCL ZETA FTNT CSCO NFLX JPM SNPS TEL ONDS ON STX KO CAT " +
  "NU MELI SHOP DLR").split(" ");                       // Alan's FAVORITES as stored on 6 Oct 2026 at 20:51:00Z
const RADAR_19 = "MU NBIS GOOGL AMZN IREN AVGO BE VST NVDA BTCUSD CRDO CBRS WMT WDC SNDK ORCL NFLX CAT AAOI".split(" ");
const REFUSAL = (which) => ({ code: "23514", details: "Failing row contains (…).", hint: null,
  message: 'new row for relation "station_lists" violates check constraint "station_lists_' + which + '_check"' });

/* public.station_lists as a stand-in: one statement checks every row before any is stored, as the database does */
function table({ favorites = FAVS_64, radar = RADAR_19, cap = 64, down = null } = {}) {
  let rows = [];
  [["favorites", favorites], ["radar", radar]].forEach(([l, a]) => a.forEach((t, i) => rows.push({ list: l, position: i + 1, ticker: t })));
  const calls = [];
  const answer = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => { if (body === undefined) throw new Error("no body"); return body; } });
  return {
    calls, cap: (n) => { cap = n; }, down: (v) => { down = v; },
    list: (l) => rows.filter((r) => r.list === l).sort((a, b) => a.position - b.position).map((r) => r.ticker),
    read: async () => { calls.push("GET"); if (down === "read") throw new Error("pg station_lists → 503"); return rows.map((r) => ({ ...r })); },
    fetch: async (url, opt = {}) => {
      const m = String(opt.method || "GET").toUpperCase();
      calls.push(m);
      assert.ok(String(url).startsWith(SB + "/rest/v1/station_lists?"), "list writes go to station_lists only");
      if (m === "POST") {
        if (down === "write") return answer(503, undefined);
        const body = JSON.parse(opt.body);
        for (const r of body) {
          if (!(r.position >= 1 && r.position <= cap)) return answer(400, REFUSAL("position"));
          if (!/^[A-Z0-9.\-]{1,12}$/.test(r.ticker)) return answer(400, REFUSAL("ticker"));
        }
        for (const r of body) { rows = rows.filter((x) => !(x.list === r.list && x.position === r.position)); rows.push({ list: r.list, position: r.position, ticker: r.ticker }); }
        return answer(201, undefined);
      }
      if (m === "DELETE") {
        if (down === "trim") return answer(503, undefined);
        const q = new URL(url).searchParams, l = q.get("list").replace("eq.", ""), gt = +q.get("position").replace("gt.", "");
        rows = rows.filter((x) => !(x.list === l && x.position > gt));
        return answer(204, undefined);
      }
      throw new Error("unexpected " + m);
    },
  };
}

/* the page's list code, verbatim, over that table */
function hub({ db, coh = "FAVORITES", liked = [] } = {}) {
  const S = { coh, fav: liked.slice(), tq: "" };
  const log = { repaint: [], errors: [], note: null, hidden: true, likes: [] };
  const node = { setAttribute() {}, set innerHTML(v) { log.note = v; }, get innerHTML() { return log.note; }, set hidden(v) { log.hidden = v; }, get hidden() { return log.hidden; } };
  let made = false;
  const consts = page.match(/const LIST_COHS = [^\n]*\nconst SUB_LISTS = [^\n]*\nconst LISTS = [^\n]*\nlet LISTS_READ = [^\n]*\n/)[0] +
    page.match(/const LISTS_LS_KEY = [^\n]*\nlet COH_BOOT_PICK = [^\n]*\n/)[0] + page.match(/const LISTS_SEL = [^\n]*\n/)[0] +
    page.match(/let LIST_WRITES = [^\n]*\n/)[0] + page.match(/const esc = \(s\) => String[\s\S]*?;\n/)[0];
  const names = ["cohBootFor", "listsRemember", "listsRecall", "listApply", "listRowsFor", "listsFromRows", "listsRepaint", "listsLoad",
    "listRefused", "listFailKind", "listFailLine", "listNoteShow", "listNoteClear", "listStore", "listIntent", "toggleList"];
  const api = new Function("S", "SB", "ANON", "fetch", "pg", "lsGet", "lsSet", "el", "document", "restartFeed", "updateBoard", "coListsRepaint", "toggleFav", "console",
    consts + names.map(fn).join("") +
    "return { LISTS, listIntent, toggleList, listsLoad, listFailKind, listFailLine, listNoteShow, listNoteClear, listRefused };")(
    S, SB, "public-key", db.fetch, async () => db.read(), () => null, () => {},
    (id) => (id === "listNote" && made ? node : null),
    { createElement: () => { made = true; return node; }, body: { appendChild() {} } },
    () => log.repaint.push("feed"), () => log.repaint.push("board"), () => log.repaint.push("co"),
    (t) => { S.fav = S.fav.includes(t) ? S.fav.filter((x) => x !== t) : S.fav.concat([t]); log.likes.push(t); },
    { error: (...a) => log.errors.push(a.map(String).join(" ")) });
  return { api, S, log, text: () => (log.hidden || !log.note ? null : log.note.replace(/<button[\s\S]*$/, "").replace(/<[^>]+>/g, "")) };
}
async function boot(opt) { const h = hub(opt); await h.api.listsLoad(); return h; }

test("the bug, as on live: with 64 names stored, the 65th is refused whatever the name — EQIX, CRWD, NET, OKTA", async () => {
  for (const t of ["EQIX", "CRWD", "NET", "OKTA"]) {
    const db = table(), h = await boot({ db });
    assert.equal(h.api.LISTS.favorites.length, 64);
    db.calls.length = 0;
    const done = h.api.toggleList("favorites", t);
    assert.ok(h.api.LISTS.favorites.includes(t), "the star lights at once (the screen moves first)");
    await done;
    assert.deepEqual(db.list("favorites"), FAVS_64, t + ": nothing was stored");
    assert.deepEqual(h.api.LISTS.favorites, FAVS_64, t + ": the star is off again — the screen shows what is stored");
    assert.ok(!db.calls.includes("DELETE"), "a refused write is never followed by the trim");
    assert.equal(h.text(), "FAVORITES is full: it holds 64 names and cannot take more. " + t + " was not added (it is on LIKED). Take a name off FAVORITES to make room.");
    assert.deepEqual(h.log.likes, [t], "the name was liked on the way (adding to a list likes it) — which is why LIKED 'works'");
    assert.match(h.log.errors[0], /station_lists write favorites → 400 · new row for relation "station_lists" violates check constraint "station_lists_position_check"/);
  }
});

test("before this fix the page said nothing: the old failure path only logged and re-read", () => {
  const old = 'catch (e) { console.error("list write failed", list, T, e); listsLoad(); }';
  assert.ok(!page.includes(old), "the silent path is gone");
  assert.match(fn("listIntent"), /listNoteShow\(listFailLine\(list, T, on, e, back\.length, S\.fav\.includes\(T\)\)\)/);
});

test("it is the list's size, not the name: RADAR (19 names) takes EQIX under the same rule", async () => {
  const db = table(), h = await boot({ db, coh: "RADAR" });
  await h.api.toggleList("radar", "EQIX");
  assert.equal(db.list("radar").length, 20); assert.equal(db.list("radar")[19], "EQIX");
  assert.ok(h.api.LISTS.radar.includes("EQIX")); assert.equal(h.text(), null);
});

test("with the cap raised (the coordinator's fix) the same four names stick, in order, and survive a re-read", async () => {
  const db = table({ cap: CAP_NOW }), h = await boot({ db });
  for (const t of ["EQIX", "CRWD", "NET", "OKTA"]) await h.api.toggleList("favorites", t);
  assert.deepEqual(db.list("favorites"), FAVS_64.concat(["EQIX", "CRWD", "NET", "OKTA"]));
  assert.equal(h.text(), null, "no line when the write is taken");
  const again = await boot({ db });                       // another device, or a reload
  assert.deepEqual(again.api.LISTS.favorites.slice(-4), ["EQIX", "CRWD", "NET", "OKTA"]);
});

test("the page carries no cap of its own: the same page fills a 256-name list and reports 256 when that one is full", async () => {
  assert.doesNotMatch(["listApply", "listRowsFor", "listStore", "listIntent", "toggleList", "listFailKind", "listFailLine"].map(fn).join(""), /\b64\b|\b256\b|\b500\b/);
  const many = Array.from({ length: CAP_NOW }, (_, i) => "T" + i);
  const db = table({ favorites: many, cap: CAP_NOW }), h = await boot({ db });
  await h.api.toggleList("favorites", "EQIX");
  assert.equal(db.list("favorites").length, CAP_NOW);
  assert.match(h.text(), /^FAVORITES is full: it holds 256 names and cannot take more\. EQIX was not added/);
});

test("taking a name off a full list works, and frees the place for the next one", async () => {
  const db = table(), h = await boot({ db, liked: FAVS_64 });
  await h.api.toggleList("favorites", "KO");
  assert.equal(db.list("favorites").length, 63); assert.ok(!db.list("favorites").includes("KO")); assert.equal(h.text(), null);
  await h.api.toggleList("favorites", "EQIX");
  assert.deepEqual(db.list("favorites").slice(-2), ["DLR", "EQIX"]); assert.equal(h.text(), null);
});

test("a refused tap's line is cleared by the next tap, and a tap that is taken leaves none", async () => {
  const db = table(), h = await boot({ db });
  await h.api.toggleList("favorites", "EQIX");
  assert.match(h.text(), /^FAVORITES is full/);
  db.cap(CAP_NOW);
  await h.api.toggleList("favorites", "EQIX");
  assert.equal(h.text(), null); assert.ok(db.list("favorites").includes("EQIX"));
});

test("any other refusal says so too, and the screen goes back", async () => {
  const db = table({ cap: CAP_NOW }), h = await boot({ db });
  db.down("write");
  await h.api.toggleList("favorites", "EQIX");
  assert.deepEqual(h.api.LISTS.favorites, FAVS_64);
  assert.equal(h.text(), "FAVORITES was not saved (the server answered 503). EQIX was not added. Try again.");
  db.down("read");
  await h.api.listIntent("favorites", "KO", false);
  assert.ok(h.api.LISTS.favorites.includes("KO"), "the read before the write failed: the tap is undone on screen");
  assert.equal(h.text(), "FAVORITES was not saved. KO was not taken off. Try again.");
});

test("a name the list cannot spell is refused in words", async () => {
  const db = table({ favorites: ["MU"], cap: CAP_NOW }), h = await boot({ db });
  await h.api.toggleList("favorites", "ES=F");
  assert.deepEqual(db.list("favorites"), ["MU"]);
  assert.equal(h.text(), "FAVORITES cannot store the ticker ES=F. ES=F was not added.");
});

test("a failed trim is not a failed save: the names are stored, the screen stays, no line", async () => {
  const db = table({ cap: CAP_NOW }), h = await boot({ db });
  db.down("trim");
  await h.api.toggleList("favorites", "EQIX");
  assert.ok(db.list("favorites").includes("EQIX")); assert.ok(h.api.LISTS.favorites.includes("EQIX")); assert.equal(h.text(), null);
  assert.match(h.log.errors[0], /station_lists trim favorites → 503/);
});

test("the reason is read from the server's answer alone", async () => {
  const h = hub({ db: table() });
  const e = await h.api.listRefused({ status: 400, json: async () => REFUSAL("position") }, "write", "favorites");
  assert.equal(e.status, 400); assert.equal(e.pgCode, "23514"); assert.equal(e.step, "write");
  assert.equal(h.api.listFailKind(e), "full");
  assert.equal(h.api.listFailKind({ pgCode: "23514", pgMessage: REFUSAL("ticker").message }), "ticker");
  assert.equal(h.api.listFailKind({ pgCode: "23505", pgMessage: "duplicate key value violates unique constraint" }), "other");
  assert.equal(h.api.listFailKind(new Error("network")), "other");
  const html = await h.api.listRefused({ status: 502, json: async () => { throw new Error("not json"); } }, "write", "radar");
  assert.equal(html.status, 502); assert.equal(html.pgCode, ""); assert.equal(h.api.listFailKind(html), "other");
  assert.equal(h.api.listFailLine("radar", "nvda", false, html, 19, true), "RADAR was not saved (the server answered 502). NVDA was not taken off. Try again.");
  assert.equal(h.api.listFailLine("favorites", "EQIX", true, e, 64, false), "FAVORITES is full: it holds 64 names and cannot take more. EQIX was not added. Take a name off FAVORITES to make room.");
});

test("the line is a status line with a way to dismiss it, drawn in the page's own failure ink", () => {
  const h = hub({ db: table() });
  h.api.listNoteShow('FAVORITES is full <b>"x"</b>');
  assert.match(h.log.note, /^<span class="sc-listnote__t">FAVORITES is full &lt;b&gt;&quot;x&quot;&lt;\/b&gt;<\/span><button type="button" class="sc-listnote__x" data-act="listnote-x" aria-label="Dismiss">✕<\/button>$/);
  assert.equal(h.log.hidden, false);
  h.api.listNoteClear(); assert.equal(h.log.hidden, true);
  assert.match(fn("listNoteShow"), /setAttribute\("role", "status"\)/);
  assert.match(page, /case "listnote-x": e\.preventDefault\(\); e\.stopPropagation\(\); listNoteClear\(\); break;/);
  const css = page.match(/\.sc-listnote\{[^}]*\}/)[0];
  assert.match(css, /position:fixed/); assert.match(css, /border:\.8px solid var\(--bear\)/); assert.match(css, /font-size:11px/);
  assert.match(css, /max-width:min\(640px,calc\(100vw - 24px\)\)/, "it fits a 390-wide phone");
  assert.match(page, /\.sc-listnote\[hidden\]\{display:none\}/);
});

test("the cap's neighbour on this page: both lists are read in one request and the write trims above what it read", () => {
  /* why the size of the cap matters HERE: the API answers at most 1,000 rows per request (measured 6 Oct), the Hub reads
     FAVORITES and RADAR together with no limit, and its write removes every position above what it read. A read cut
     short would therefore delete the tail of a list. Two lists at the cap must fit one answer whole. */
  const lists = page.match(/const LISTS_SEL = "station_lists\?select=list,position,ticker&list=in\.\(([a-z,]+)\)&order=/)[1].split(",");
  assert.deepEqual(lists, ["favorites", "radar"], "the Hub reads both lists in one request, with no limit");
  assert.ok(lists.length * CAP_NOW <= 1000, "two lists of 256 (512 rows) fit the API's 1,000-row answer");
  assert.match(fn("listStore"), /&position=gt\." \+ rows\.length/, "…which matters because the write trims above what it read");
});

test("this lane ships no change to the table: no station_lists migration is on the branch", () => {
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const mine = fs.readdirSync(dir).filter((f) => /station_lists/i.test(f) && /^2026100[67]/.test(f));
  assert.deepEqual(mine, [], "the coordinator fixed the table himself (64 → 256); the 500 draft is kept, unapplied, under the deliverable's data/not-applied/");
});

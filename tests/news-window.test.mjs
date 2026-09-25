// NEWS-WINDOW (Hub news room) - review regression. The first read is bounded to the last 7 days; a short answer falls back
// to the ORIGINAL unbounded query. Offline: the page's own pg() (with its 3-try retry), the NEWS constants, newsQueryFor and
// fillNews run against a simulated PostgREST news table; fetch is a stub, nothing leaves the process.
// SC_PAGE=<path to a copy of index.html> overrides the page under test.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(process.env.SC_PAGE || new URL("../index.html", import.meta.url), "utf8");
const NOW_S = 1789750000;                                  // fixed clock (2026-09-18 ~16:46Z)
const WINDOW_TAG = "published_ts=gte.";

function cut(from, to) { const a = page.indexOf(from); const b = page.indexOf(to, a); assert.ok(a >= 0 && b > a, "anchor " + from); return page.slice(a, b); }
function hubNews() {
  const pgStart = page.indexOf("async function pg(path, _tries) {");
  assert.ok(pgStart >= 0, "pg() present");
  const pgSrc = page.slice(pgStart, page.indexOf("\n}\n", pgStart) + 3);
  const a = page.indexOf("const NEWS_LIMIT") >= 0 ? page.indexOf("const NEWS_LIMIT") : page.indexOf("const NEWS_SEL = ");
  const b = page.indexOf("function newsItemInKey(");
  const c = page.indexOf("async function fillNews() {");
  const d = page.indexOf("\n}\n", c) + 3;
  assert.ok(a > 0 && b > a && c > b && d > c, "news anchors");
  /* H-FRONT — newsQueryFor asks the one list-scope helper which scopes are lists (LIKED/FAVORITES/RADAR) */
  const lists = page.slice(page.indexOf("const LIST_COHS = "), page.indexOf("/* apply one intent"));
  return pgSrc + lists + page.slice(a, b) + "\n" + page.slice(c, d) + "\nreturn { fillNews, newsQueryFor, NEWS_CACHE };";
}
const SRC = hubNews();

// ---- a small PostgREST over an in-memory news table (only the operators these pages use) ----
function serve(table, path) {
  const [res, qs] = path.split("?");
  assert.equal(res, "news");
  let rows = table.slice(), limit = Infinity, offset = 0, order = null;
  for (const part of qs.split("&")) {
    const i = part.indexOf("="); const k = part.slice(0, i), v = decodeURIComponent(part.slice(i + 1));
    if (k === "select") continue;
    if (k === "limit") { limit = +v; continue; }
    if (k === "offset") { offset = +v; continue; }
    if (k === "order") { order = v; continue; }
    const [op, ...rest] = v.split("."); const arg = rest.join(".");
    if (op === "in") { const set = new Set(arg.replace(/^\(|\)$/g, "").split(",")); rows = rows.filter((r) => set.has(r[k])); }
    else if (op === "eq") rows = rows.filter((r) => String(r[k]) === arg);
    else if (op === "like") { const p = arg.replace(/\*$/, ""); rows = rows.filter((r) => String(r[k] ?? "").startsWith(p)); }
    else if (op === "gte") rows = rows.filter((r) => r[k] != null && r[k] >= +arg);   // SQL: NULL >= x is not true
    else if (op === "is" && arg === "null") rows = rows.filter((r) => r[k] == null);
    else throw new Error("simulator: unsupported " + part);
  }
  if (order === "published_ts.desc.nullslast")                 // stable: equal keys keep table order in BOTH queries
    rows = rows.map((r, i) => [r, i]).sort((x, y) => (x[0].published_ts == null) - (y[0].published_ts == null) ||
      (y[0].published_ts ?? 0) - (x[0].published_ts ?? 0) || x[1] - y[1]).map((x) => x[0]);
  else if (order) throw new Error("simulator: unsupported order " + order);
  return rows.slice(offset, offset + limit);
}
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function table(seed, n = 900) {
  const r = rng(seed), out = [];
  const tk = ["NVDA", "NVTS", "AMD", "MU", "SNDK", "AAPL", "KVUE", "TSM", "SIUSD", "_MARKET"];
  const coh = ["MEGACAP", "AI_HARDWARE", "ASIA", "CRYPTO", null];
  for (let i = 0; i < n; i++) {
    const x = r(); let ts;
    if (x < 0.05) ts = null;                                   // undated row
    else if (x < 0.08) ts = NOW_S + Math.floor(r() * 3600);    // future-stamped row
    else if (x < 0.55) ts = NOW_S - Math.floor(r() * 7 * 86400);
    else ts = NOW_S - 7 * 86400 - Math.floor(r() * 400 * 86400);
    if (x > 0.97 && out.length) ts = out[out.length - 1].published_ts;   // ties
    const t = tk[Math.floor(r() * tk.length)];
    out.push({ ticker: t, cohort: coh[Math.floor(r() * coh.length)], title: "h" + i, snippet: "", site: "s", feed: "google", url: "https://x.example/" + i, published_ts: ts });
  }
  return out;
}

// ---- the page's own news code, wired to the simulator ----
function hub({ tbl, coh = "ALL", tq = "", fav = ["NVDA", "AMD"], fail = () => false }) {
  const calls = []; const list = { innerHTML: "" }; const S = { fav, coh, tq, sec: "NEWS" };
  let nowMs = NOW_S * 1000;
  const fetch = async (url) => {
    const path = String(url).split("/rest/v1/")[1]; const windowed = path.includes(WINDOW_TAG);
    calls.push({ path, windowed });
    if (fail(path, windowed, calls.filter((c) => c.windowed === windowed).length)) return { ok: false, status: 500, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => serve(tbl, path) };
  };
  const FixedDate = { now: () => nowMs };
  const api = new Function("S", "el", "renderNews", "setTimeout", "fetch", "SB", "ANON", "Date", SRC)(
    S, (id) => (id === "newsList" ? list : null), () => {}, (fn) => { fn(); return 0; }, fetch, "https://stub.invalid", "stub", FixedDate);
  return { ...api, calls, list, S, advance: (ms) => { nowMs += ms; } };
}
const key = (coh, tq) => (tq ? "TQ|" + tq : coh);
const original = (h, tbl) => serve(tbl, h.newsQueryFor(key(h.S.coh, h.S.tq)));

test("busy scope: ONE request, windowed; the cached rows are exactly the original query's rows", async () => {
  const tbl = table(7, 1500);
  for (const [coh, tq] of [["ALL", ""], ["FAV", ""], ["MEGACAP", ""], ["ALL", "NV"]]) {
    const h = hub({ tbl, coh, tq, fav: ["NVDA", "AMD", "MU", "SNDK", "AAPL"] });
    const want = original(h, tbl);
    assert.equal(want.length, 120, "fixture: the scope is busy (" + coh + tq + ")");
    await h.fillNews();
    assert.equal(h.calls.length, 1, coh + tq + ": one request");
    assert.ok(h.calls[0].windowed, coh + tq + ": the one request is bounded to the window");
    assert.deepEqual(h.NEWS_CACHE.get(key(coh, tq)).items, want);
  }
});

test("quiet scope with undated rows: exactly the original rows, undated rows kept at the end", async () => {
  const tbl = [
    ...Array.from({ length: 5 }, (_, i) => ({ ticker: "KVUE", cohort: "ASIA", title: "new" + i, url: "u/n" + i, published_ts: NOW_S - i * 3600 })),
    ...Array.from({ length: 30 }, (_, i) => ({ ticker: "KVUE", cohort: "ASIA", title: "old" + i, url: "u/o" + i, published_ts: NOW_S - 30 * 86400 - i * 86400 })),
    ...Array.from({ length: 4 }, (_, i) => ({ ticker: "KVUE", cohort: "ASIA", title: "undated" + i, url: "u/u" + i, published_ts: null })),
    ...table(3, 800).map((r) => Object.assign({}, r, { cohort: r.cohort === "ASIA" ? "MEGACAP" : r.cohort })),
  ];
  const h = hub({ tbl, coh: "ASIA" });
  await h.fillNews();
  const got = h.NEWS_CACHE.get("ASIA").items;
  assert.deepEqual(got, original(h, tbl));
  assert.equal(got.length, 39); assert.equal(got.filter((r) => r.published_ts == null).length, 4, "undated rows the original showed are still shown");
  assert.equal(h.calls.filter((c) => !c.windowed).length, 1, "the fallback is the original query");
  assert.equal(h.calls.at(-1).path, h.newsQueryFor("ASIA"), "byte for byte");
});

test("property: 200 random tables x 5 scopes - cached rows always equal the original query's rows", async () => {
  for (let seed = 1; seed <= 200; seed++) {
    const tbl = table(seed, 150 + (seed * 37) % 700);
    for (const [coh, tq] of [["ALL", ""], ["FAV", ""], ["ASIA", ""], ["CRYPTO", ""], ["ALL", "KV"]]) {
      const h = hub({ tbl, coh, tq, fav: seed % 2 ? ["KVUE"] : ["NVDA", "AMD", "MU"] });
      await h.fillNews();
      assert.deepEqual(h.NEWS_CACHE.get(key(coh, tq)).items, original(h, tbl), "seed " + seed + " " + coh + tq);
    }
  }
});

test("a quiet scope pays for ONE read per refresh after its first pull (it is not windowed again)", async () => {
  const tbl = table(11, 300);
  const h = hub({ tbl, coh: "ASIA" });
  await h.fillNews();
  const first = h.calls.length;
  assert.equal(first, 2, "first pull: window + original");
  h.advance(61000); await h.fillNews();                 // cache older than the 60 s TTL -> refresh
  h.advance(61000); await h.fillNews();
  assert.equal(h.calls.length - first, 2, "two refreshes = two reads (was four)");
  assert.ok(h.calls.slice(first).every((c) => !c.windowed && c.path === h.newsQueryFor("ASIA")));
});

test("worst case per pull, counting pg()'s 3 tries x fillNews' 3 attempts: at most 12 HTTP requests, the unbounded query at most 9 (= today)", async () => {
  const tbl = table(5, 1200);
  const cases = {
    "everything fails": () => true,
    "window answers short, original always fails": (p, w) => !w,
    "window fails twice per pull then answers short, original always fails": (p, w, n) => (w ? n % 3 !== 0 : true),
  };
  for (const [name, fail] of Object.entries(cases)) {
    const h = hub({ tbl: name.includes("short") ? tbl.filter((r) => r.cohort === "ASIA").slice(0, 20) : tbl, coh: "ASIA", fail });
    await h.fillNews();
    const unb = h.calls.filter((c) => !c.windowed).length;
    assert.ok(h.calls.length <= 12, name + ": " + h.calls.length + " requests");
    assert.ok(unb <= 9, name + ": unbounded query ran " + unb + " times");
    assert.match(h.list.innerHTML, /news pull failed/, name + ": nothing cached -> the failure line");
  }
});

test("a window read that keeps failing never turns a pull that works today into 'news pull failed'", async () => {
  const tbl = table(9, 1200);
  const h = hub({ tbl, coh: "ALL", fail: (p, w) => w });
  await h.fillNews();
  assert.deepEqual(h.NEWS_CACHE.get("ALL") && h.NEWS_CACHE.get("ALL").items, original(h, tbl));
  assert.doesNotMatch(h.list.innerHTML, /news pull failed/);
  assert.ok(h.calls.length <= 9, h.calls.length + " requests");
});

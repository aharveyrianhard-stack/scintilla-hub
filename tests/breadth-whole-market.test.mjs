/* Lane B1 (27 Sep). Alan: "% of names above their 50-day and 200-day… for the market at large"; 11 Aug:
   "my Hub is not the market". The Sentiment breadth table and /allocation now read public.breadth_daily
   (every US common stock + the S&P 500) and label anything measured on the Hub's own names "Hub list only". */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { toTableRow, sinceFor, constituentRows, COLUMNS } from "../supabase/functions/breadth-ingest/ingest.mjs";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const PAGE = read("index.html");
const ALLOC = read("allocation/index.html");
const slice = (src, from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a); assert.ok(a > 0 && b > a, "missing " + from); return src.slice(a, b); };

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const SENTI = new Function(slice(PAGE, "/* SENTI-MATH */", "/* /SENTI-MATH */") + "; return SENTI;")();
const M41 = new Function("esc", "SENTI", "S", "el", "pg", "NEWS_LEX_URL", "sentiSafe", "sentiBars", "SENTI_CACHE", "SENTI_TTL",
  slice(PAGE, "/* ═══ THE SENTIMENT SYSTEM (lane M41)", "/* ═══ THE HEADLINES, EACH ONE SCORED") + "; return { snBreadthHTML };",
)(esc, SENTI, {}, () => null, async () => [], "", async () => ({ ok: false }), async () => [], {}, 600000);

const row = (d, scope, o = {}) => ({ session_date: d, scope, advancers: 3000, decliners: 1800, unchanged: 100, ad_line: 51000, trin: 0.84,
  pct_above_50: 55.2, members_50: 4100, pct_above_200: 47.9, members_200: 3900, new_highs: 120, new_lows: 60, members_highlow: 3800, members: 4900, ...o });
const WB = { US_COMMON: [row("2026-09-24", "US_COMMON", { ad_line: 49000 }), row("2026-09-25", "US_COMMON")],
  SP500: [row("2026-09-24", "SP500"), row("2026-09-25", "SP500", { pct_above_200: 46.4, members: 503, advancers: 300, decliners: 200 })] };

test("Sentiment table: whole-market rows lead, name their scope and session, and carry the S&P 500 beside", () => {
  const html = M41.snBreadthHTML({ wb: WB, brd: null, inputs: [{ key: "eqwndx", val: "equal weight − cap weight, 20-day return: +0.4 pts", score: 60 }] }, 316);
  assert.match(html, /Above the 200-day average · whole market/);
  assert.match(html, /47\.9%<\/b> of 3900/);
  assert.match(html, /S&amp;P 500 <b>46\.4%/);
  assert.match(html, /session 2026-09-25/);
  assert.match(html, /4900 US common stocks/);
  assert.match(html, /Advancing \/ declining · whole market/);
  assert.match(html, /TRIN \(Arms index\)/);
  assert.match(html, /QQQE against QQQ/);
  assert.match(html, /Equal weight vs the index \(Nasdaq-100\)/);
  assert.ok(html.indexOf("whole market") < html.indexOf("Hub list only"), "the market comes before our list");
});

test("Sentiment table: an empty or absent breadth_daily says so, and the Hub rows say Hub list only", () => {
  const html = M41.snBreadthHTML({ wb: null, wbErr: "pg breadth_daily → 404", brd: { snap: { measured: 316, session_et: "2026-09-23",
    above50: { pct: 48, n: 152, of: 316 }, above200: { pct: 61, n: 193, of: 316 }, new_highs: 9, new_lows: 4, names_new_high: [], names_new_low: [] }, hist: [] }, inputs: [] }, 316);
  assert.match(html, /not filled yet/);
  assert.match(html, /404/);
  assert.match(html, /Above the 200-day average · Hub list only/);
  assert.doesNotMatch(html, /· whole market<\/td>/);
});

test("Sentiment inputs: QQQE/QQQ are read, shown, and kept out of the market gauge; fallbacks are labelled", () => {
  const run = slice(PAGE, "async function sentiComputeAllRun()", "const out = { now, inputs");
  assert.match(run, /sentiBars\("QQQE"\)/); assert.match(run, /sentiBars\("QQQ"\)/);
  assert.match(run, /key: "eqwndx"/);
  assert.equal(SENTI.MARKET_KEYS.has("eqwndx"), false, "the Nasdaq equal-weight row does not move the headline");
  assert.match(run, /name: "Above the 50-day average · Hub list only"|name: "Above the 50-day average \\u00b7 Hub list only"/);
  assert.match(run, /name: "52-week highs vs lows · Hub list only"|name: "52-week highs vs lows \\u00b7 Hub list only"/);
  assert.match(PAGE, /breadth_daily\?select=session_date,scope/);
});

test("/allocation: whole-market legs when a row exists, Hub list only otherwise; QQQE shown, not counted", () => {
  const src = slice(ALLOC, "function rspRatio(days, eq, cap) {", "/* ---- the tape, read only");
  const pct = (v) => v.toFixed(0) + "%", sg = (v) => (v > 0 ? "+" : "") + v.toFixed(1), clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const tape = (n, f) => Array.from({ length: n }, (_, i) => ({ t: i, c: f(i) }));
  const make = (D) => new Function("D", "T", "pct", "sg", "clamp", "mean", src + "; return breadthRead;")(D, { lookback: 60 }, pct, sg, clamp, mean);
  const D = { tape: { RSP: tape(100, (i) => 100 + i), SPY: tape(100, () => 100), QQQE: tape(100, () => 50), QQQ: tape(100, (i) => 50 + i * 0.1) },
    sma: { AAA: { s50: 1, s200: 1 } }, wb: { session_date: "2026-09-25", pct_above_50: 40, members_50: 4000, pct_above_200: 60, members_200: 3900, members: 4900 } };
  const eq = [{ t: "AAA", price: 2 }];
  const b = make(D)(eq);
  assert.equal(b.share50, 0.4); assert.equal(b.share200, 0.6);
  assert.match(b.parts[0].k, /whole market/); assert.match(b.parts[0].read, /US common stocks, session 2026-09-25/);
  assert.equal(b.parts.length, 3, "the reading is still the same three legs");
  assert.equal(b.shown.length, 1); assert.match(b.shown[0].read, /QQQE/);
  const hub = make({ ...D, wb: null })(eq);
  assert.equal(hub.share50, 1); assert.match(hub.parts[0].k, /Hub list only/);
  assert.match(ALLOC, /"SPY", "RSP", "QQQ", "QQQE"/);
});

test("breadth-ingest: rows keep only the table's columns and refuse a row without its counts", () => {
  const r = toTableRow({ session_date: "2026-09-25", advancers: 1, decliners: 2, ad_line: 3, extra: 9 }, "SP500");
  assert.deepEqual(Object.keys(r), COLUMNS); assert.equal(r.scope, "SP500"); assert.equal(r.trin, null);
  assert.throws(() => toTableRow({ session_date: "2026-9-25", advancers: 1, decliners: 1, ad_line: 0 }, "SP500"), /session date/);
  assert.throws(() => toTableRow({ session_date: "2026-09-25", advancers: 1 }, "SP500"), /counts/);
  assert.equal(sinceFor(null), null); assert.equal(sinceFor("2026-09-25"), "2026-09-18");
});

test("breadth-ingest: constituents normalise BRK-B, drop duplicates and refuse a partial list", () => {
  const fmp = Array.from({ length: 503 }, (_, i) => ({ symbol: i === 0 ? "BRK-B" : "T" + i, sector: "X" }));
  fmp.push({ symbol: "T1" });
  const rows = constituentRows("SP500", fmp, "2026-09-27", "sp500-constituent", 1);
  assert.equal(rows.length, 503); assert.equal(rows[0].ticker, "BRK.B"); assert.equal(rows[0].source, "FMP stable/sp500-constituent");
  assert.throws(() => constituentRows("SP500", fmp.slice(0, 20), "2026-09-27", "sp500-constituent", 1), /partial list/);
  assert.equal(constituentRows("NASDAQ100", fmp.slice(0, 101), "2026-09-27", "nasdaq-constituent", 1).length, 101);
});

test("migration is additive; the rollback removes exactly what it adds; the schedule holds no key", () => {
  const up = read("supabase/migrations/20260927_breadth_daily.sql");
  const code = up.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  assert.doesNotMatch(code, /\b(delete|truncate|drop table|alter table .* drop|rename)\b/i);
  assert.match(code, /create table if not exists public\.breadth_daily/);
  assert.match(code, /primary key \(session_date, scope\)/);
  for (const c of COLUMNS) assert.match(code, new RegExp("\\b" + c + "\\b"), "column " + c);
  const down = read("supabase/migrations/20260927_breadth_daily_ROLLBACK.sql");
  assert.match(down, /drop table if exists public\.breadth_daily/);
  assert.doesNotMatch(down.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n"), /index_constituents/);
  const cron = read("supabase/migrations/20260927_breadth_cron.sql");
  assert.match(cron, /vault\.decrypted_secrets/); assert.doesNotMatch(cron, /eyJ[A-Za-z0-9_-]{20,}/);
});

test("the Indicator Lab is byte-identical to this lane's base (f828ac6)", () => {
  try { execFileSync("git", ["cat-file", "-e", "f828ac6"], { cwd: new URL("..", import.meta.url) }); } catch (_) { return; }
  const diff = execFileSync("git", ["diff", "--name-only", "f828ac6", "--", "prototypes/indicator-lab"], { cwd: new URL("..", import.meta.url) }).toString().trim();
  assert.equal(diff, "");
});

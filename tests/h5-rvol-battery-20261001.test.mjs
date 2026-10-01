// H5 (1 Oct) — the RVOL battery back on every board row, the number beside it. BRIEF-20261001-H5-RVOL-BATTERY.
// Alan, 1 Oct ~10:50 ET: "relative volume… used to be a super sick battery… what you added was kind of shit."
// The page's own functions are run here (extracted from index.html), never re-typed copies.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fnSrc = (name) => page.match(new RegExp("function " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n"))[0];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v) => (v == null ? null : Number.isFinite(+v) ? +v : null);
const RB_SRC = page.match(/^const rb = [^\n]*/m)[0];
const K = new Function("esc", page.match(/^const RVOL_MAX_AGE_MS = [^\n]*/m)[0] + "\n" + RB_SRC + "\n" +
  fnSrc("rvolNoteHTML") + fnSrc("scRvolCurrent") + fnSrc("volCellHTML") + "return { rb, rvolNoteHTML, scRvolCurrent, volCellHTML };")(esc);
/* the board row's own two fields, run against a board_volume row */
const field = (name) => {
  const src = page.match(new RegExp("        " + name + ":\\s+\\(function \\(\\) \\{[\\s\\S]*?\\}\\)\\(\\),\\n"))[0];
  return (bv) => new Function("BOARDVOL", "m", "num", "scRvolCurrent", "return " + src.trim().replace(new RegExp("^" + name + ":\\s*"), "").replace(/,$/, ""))(
    { MU: bv }, { ticker: "MU" }, num, K.scRvolCurrent);
};
const rvOf = field("rv"), rvSOf = field("rvS");
const cellOf = (bv) => K.volCellHTML(rvOf(bv), rvSOf(bv), bv && bv.updated_ts);
const lit = (html) => (html.match(/<i class="on"><\/i>/g) || []).length;
const dots = (html) => (html.match(/<i( class="on")?><\/i>/g) || []).length;
const numberOf = (html) => (html.match(/<span class="sc-vol__n">([^<]*)<\/span>/) || [])[1];

test("the cell renders the five-dot battery (session_rvol) AND the number (rvol_at_time) from a board_volume row", () => {
  const now = new Date().toISOString();
  const row = { ticker: "MU", rvol_at_time: 1.43, session_rvol: 0.62, cum_rvol: 0.62, updated_ts: now };
  assert.equal(rvOf(row), 1.43, "the number is rvol_at_time");
  assert.equal(rvSOf(row), 0.62, "the battery is session_rvol");
  const html = cellOf(row);
  assert.equal(dots(html), 5, "five dots, always");
  assert.equal(lit(html), 1, "62% of a usual session → 1 dot on July's scale");
  assert.equal(numberOf(html), "1.4×", "the pace, beside the battery");
  assert.match(html, /<span class="sc-vol__dots" aria-hidden="true">(<i( class="on")?><\/i>){5}<\/span><span class="sc-vol__n">1\.4×<\/span>/, "battery first, number beside it");
  const by = new Date(now).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/New_York" });
  assert.match(html, new RegExp('title="today 62% of a usual session so far · 1\\.4× its usual pace by ' + by + ' ET"'), "both numbers in words on the cell");
  /* the battery charges through the day: same pace, more of the session done → more dots */
  assert.equal(lit(cellOf({ ...row, session_rvol: 1.3 })), 3);
  assert.equal(lit(cellOf({ ...row, session_rvol: 2.6 })), 5);
  assert.equal(numberOf(cellOf({ ...row, rvol_at_time: 12.34 })), "12×", "10× and up without the decimal, so the number is never wider than 4 characters");
  assert.match(cellOf({ ...row, rvol_at_time: 12.34 }), /12\.3× its usual pace/, "the tooltip keeps the decimal");
  /* one of the two missing: the other still shows, the missing one is a dash or an empty battery, never borrowed */
  const noAt = cellOf({ ...row, rvol_at_time: null });
  assert.equal(numberOf(noAt), "—"); assert.equal(lit(noAt), 1); assert.match(noAt, /no by-this-time figure yet/);
  const noSess = cellOf({ ...row, session_rvol: null });
  assert.equal(numberOf(noSess), "1.4×"); assert.equal(lit(noSess), 0); assert.match(noSess, /no whole-session figure yet/);
});

test("a stale row (older than scRvolCurrent allows) renders the EMPTY battery and a dash — never a stale charge", () => {
  const stale = { ticker: "MU", rvol_at_time: 2.9, session_rvol: 3.1, updated_ts: "2026-07-06T18:03:29Z" };
  assert.equal(K.scRvolCurrent(stale.updated_ts), false);
  assert.equal(rvOf(stale), null); assert.equal(rvSOf(stale), null);
  const html = cellOf(stale);
  assert.equal(dots(html), 5, "the battery is still drawn");
  assert.equal(lit(html), 0, "with no charge");
  assert.equal(numberOf(html), "—");
  assert.match(html, /class="sc-vol sc-vol--none"/);
  assert.match(html, /title="no reading yet — the newest relative-volume row for this name was written 2026-07-06, not this session"/);
  const none = cellOf(undefined);
  assert.equal(lit(none), 0); assert.equal(numberOf(none), "—"); assert.match(none, /no relative-volume row for this name yet/);
  /* the rule itself is unchanged */
  assert.match(page, /^const RVOL_MAX_AGE_MS = 36 \* 3600e3;$/m);
  assert.match(fnSrc("scRvolCurrent"), /Date\.now\(\) - at <= RVOL_MAX_AGE_MS/);
  assert.equal(K.scRvolCurrent(new Date(Date.now() - 3600e3).toISOString()), true);
});

test("the battery keeps July's scale and colour (commit 7b53b15) — reused, not reinvented", () => {
  assert.equal(RB_SRC, "const rb = (v) => (v < 0.8 ? 1 : v < 1.2 ? 2 : v < 1.8 ? 3 : v < 2.5 ? 4 : 5);");
  assert.deepEqual([0.1, 0.79, 0.8, 1.19, 1.2, 1.79, 1.8, 2.49, 2.5, 9].map(K.rb), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  assert.match(page, /\.sc-vol__dots\{ display:flex; gap:2px; flex:none; \}/);
  assert.match(page, /\.sc-vol__dots i\{ width:4px; height:10px; border-radius:1px; background:var\(--mute\); \}/);
  assert.match(page, /\.sc-vol__dots i\.on\{ background:var\(--crk\); box-shadow:0 0 4px rgba\(0,212,255,\.55\); \}/);
  assert.doesNotMatch(page, /\.sc-board__row \.sc-vol \.sc-vol__dots\{display:none\}/, "H3's hiding rule is gone");
});

test("the board's summary line keeps rvolNoteHTML and says once what the battery and the number are", () => {
  const all = K.rvolNoteHTML([{ t: "A", rv: 1.2, rvS: 0.5 }, { t: "B", rv: 0.8, rvS: 0.3 }]);
  assert.match(all, />RVOL: battery = today so far vs a usual full day · number = pace vs usual by now<\/span>$/);
  assert.match(K.rvolNoteHTML([{ t: "A", rv: 1.2, rvS: 0.5 }, { t: "B", rv: null, rvS: null }]), / · 1 of 2 read<\/span>$/);
  assert.match(K.rvolNoteHTML([{ t: "A", rv: null, rvS: null }]), / · no reading yet<\/span>$/);
  assert.match(K.rvolNoteHTML([{ t: "A", rv: null, rvS: 0.4 }]), /by now<\/span>$/, "a battery-only row counts as read");
  assert.equal(K.rvolNoteHTML([]), "");
  assert.equal((page.match(/rvolNoteHTML\(S\.rows\)/g) || []).length, 1, "said once: one call, on the cohort header's count line");
  assert.match(page, /\.sc-cohgeiger__n \.sc-rvnote\{display:block;margin-top:2px\}/, "its own line, so it never runs into the cohort's name");
  /* the row passes both values; the seed row whitelists the new field as empty */
  assert.match(page, /volCellHTML\(d\.rv, d\.rvS, d\.rvAsOf\)/);
  assert.match(page, /rv: null, rvS: null, rvAsOf: null,/);
});

test("the RVOL track is paid for by the Geiger: TICKER, LAST and CHG keep their share at every layout", () => {
  const tracks = (re) => { const m = page.match(re); assert.ok(m, String(re)); return [...m[1].matchAll(/minmax\(0,([\d.]+)fr\)/g)].map((x) => +x[1]); };
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  /* normal board ≥561 (11 drawn): ♥ TICKER LAST CHG F/PE MCAP REV RSI GEIGER RVOL MKT */
  const n = tracks(/body:not\(\.secfs\):not\(\.gwx-motion\) \.ch\{ grid-template-columns:([^!]*)!important; \}/);
  assert.deepEqual(n, [9, 10, 12, 12, 10, 9, 10, 7, 35, 16, 5]);
  assert.equal(sum(n), 135, "same total as H4 (46 + 5 = 35 + 16)");
  /* full screen ≥561 (14): RVOL is the 13th */
  const f = tracks(/body\.secfs \.sc-secfs \.ch\{ grid-template-columns:([^!]*)!important; column-gap:10px; \}/);
  assert.deepEqual(f.slice(0, 4), [6, 7, 8, 8]); assert.equal(f[11], 14); assert.equal(f[12], 8); assert.equal(sum(f), 116, "same total as H4 (17 + 5 = 14 + 8)");
  /* phone board: ♥ TICKER LAST CHG RSI GEIGER RVOL MKT */
  const p = tracks(/  \.ch\{grid-template-columns:(minmax\(0,3fr\) minmax\(0,8fr\) minmax\(0,9fr\) minmax\(0,9fr\)[^!]*)!important;gap:4px !important\}/);
  assert.deepEqual(p, [3, 8, 9, 9, 3.5, 5, 4.5, 2]); assert.equal(sum(p), 44, "same total as before (RSI 5 + GEIGER 8 = 3.5 + 5 + 4.5)");
  assert.match(page, /#boardPanel \.sc-board__row > \.sc-vol\{display:flex !important\}/, "RVOL drawn on the phone board");
  /* phone full screen: ♥ TICKER CHG TREND MOMENTUM GEIGER RVOL */
  const pf = tracks(/body\.secfs \.sc-secfs \.ch\{ grid-template-columns:(minmax\(0,3fr\) minmax\(0,8fr\) minmax\(0,10fr\)[^!]*)!important; gap:5px !important; \}/);
  assert.deepEqual(pf, [3, 8, 10, 12, 12, 6, 6]); assert.equal(sum(pf), 57);
});

test("DOM measure (headless harness, LIKED board, live data): every RVOL cell is at least as wide as its dots + number at 1680, 1280 and 390, normal and full screen", () => {
  for (const w of [1680, 1280, 390]) {
    const f = new URL("../deliverables/20261001/rvol-battery/shots/after-" + w + ".json", import.meta.url);
    assert.ok(fs.existsSync(f), "harness result for " + w);
    const r = JSON.parse(fs.readFileSync(f, "utf8"));
    assert.deepEqual(r.errors, [], w + ": harness ran clean"); assert.deepEqual(r.blocked, [], w + ": nothing was written");
    for (const [k, fs_] of [["normal", false], ["fullscreen", true]]) {
      const s = r.steps[k]; const at = w + " " + k;
      assert.equal(s.secfs, fs_, at + ": the right mode");
      assert.ok(s.rows >= 50, at + ": the LIKED board is drawn (" + s.rows + " rows)");
      assert.equal(s.shownCells, s.rows, at + ": the RVOL cell is drawn on every row");
      assert.ok(s.drawnHeader.includes("RVol"), at + ": the RVOL header is drawn");
      assert.deepEqual(s.cutCells, [], at + ": no RVOL cell cut");
      assert.deepEqual(s.otherCuts, [], at + ": no other header or cell cut");
      assert.ok(s.withReading >= s.rows * 0.8, at + ": most rows carry a current reading (" + s.withReading + ")");
      for (const c of s.cells) {
        assert.ok(c.cellW + 0.5 >= c.need, at + " " + c.t + ": " + c.cellW + " ≥ " + c.need);
        assert.ok(c.dotsW > 0, at + " " + c.t + ": the battery is drawn");
        assert.equal(c.lit, c.rvS == null ? 0 : K.rb(c.rvS), at + " " + c.t + ": the dots are session_rvol on July's scale");
        assert.equal(c.num, c.rvAt == null ? "—" : (c.rvAt >= 10 ? Math.round(c.rvAt) : c.rvAt.toFixed(1)) + "×", at + " " + c.t + ": the number is rvol_at_time");
        if (w === 390) assert.equal(c.stacked, true, at + ": the phone's upright battery, number under it");
      }
    }
  }
});

/* 29 Sep — P2-HUB-FIXES: the stuck REGIME view, USUAL DAY, one events structure, the board's columns, the bow tie. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fnSrc = (name) => { const s = page.search(new RegExp("^(async )?function " + name + "\\b", "m")); assert.ok(s >= 0, name); return page.slice(s, page.indexOf("\n}\n", s) + 3); };
const caseSrc = (name) => { const s = page.indexOf('case "' + name + '": {'); assert.ok(s >= 0, name); return page.slice(s, page.indexOf("\n    }\n", s) + 6); };

/* ── 1 · REGIME: always a way back ─────────────────────────────────────────────────────────────── */
function regimeHead(view) {
  const S = { econView: view };
  const f = new Function("S", "SECFS_BTN", fnSrc("econViewTabsHTML") + fnSrc("regimeRoomHTML") + "; return regimeRoomHTML();");
  return f(S, '<button class="sc-fsico" data-act="secfs">⛶</button>');
}

test("REGIME: the header carries ← RELEASES, ✕ CLOSE and the same RELEASES | REGIME switch as RELEASES", () => {
  const h = regimeHead("REGIME");
  assert.match(h, /class="rg-navb" data-act="ecview" data-v="RELEASES"[^>]*><i>←<\/i>RELEASES<\/button>/);
  assert.match(h, /class="rg-navb" data-act="rgclose"[^>]*><i>✕<\/i>CLOSE<\/button>/);
  assert.match(h, /data-act="ecview" data-v="RELEASES" role="button"/, "the switch itself has RELEASES");
  assert.match(h, /class="ec-sp on" data-act="ecview" data-v="REGIME"/);
  assert.match(fnSrc("econRoomHTML"), /econViewTabsHTML\(\) \+ SECFS_BTN/, "RELEASES draws the same switch");
});

test("REGIME: ✕ closes to the dashboard; the ECONOMIC master tab always opens on RELEASES", () => {
  assert.match(page, /case "rgclose": \{ S\.econView = "RELEASES"; go\("DASHBOARD"\); break; \}/);
  assert.match(caseSrc("mtab"), /if \(a\.dataset\.sec === "ECONOMIC"\) S\.econView = "RELEASES";/);
});

test("REGIME: Esc goes back to RELEASES only when nothing else (⛶, an overlay, a text field) owns that Esc", () => {
  const s = page.indexOf("const rgBack = ");
  assert.ok(s > 0);
  const handler = page.slice(page.lastIndexOf('document.addEventListener("keydown"', s), page.indexOf("\n});", s));
  assert.match(handler, /const rgBack = S\.sec === "ECONOMIC" && S\.econView === "REGIME" && !cvKeysBlocked\(e\);/);
  assert.ok(handler.indexOf("const rgBack") < handler.indexOf("closeTvModal(); clearSecFs()"), "measured before the ⛶ closes, so one Esc = one step");
  assert.match(handler, /if \(rgBack\) \{ S\.econView = "RELEASES"; sync\(\); \}/);
  assert.match(fnSrc("cvKeysBlocked"), /SECFS \|\| document\.fullscreenElement/, "an open ⛶ blocks it");
});

test("REGIME: the back pair is grey (channels within 24, none above 210) and wraps onto its own line on a phone", () => {
  const css = page.slice(page.indexOf(".rg-navb{"), page.indexOf(".rg-navb{") + 900);
  for (const hex of css.match(/#[0-9a-f]{6}/gi) || []) {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(Math.max(...c) - Math.min(...c) <= 24 && Math.max(...c) <= 210, hex);
  }
  assert.match(page, /\.rg-head\{ flex-wrap:wrap; row-gap:6px; \}/);
  assert.match(page, /@media \(max-width:900px\)\{ \.rg-nav\{ flex:1 0 100%; margin-right:0; \} \.rg-navb\{ height:32px; \} \}/);
});

/* ── 2 · USUAL DAY: sort, the lists as a column, the flash vs now ─────────────────────────────── */
const udSortWorld = () => new Function("S", fnSrc("udSortRows") + page.match(/const UD_SORT_DEF = \{[^}]*\};/)[0] + fnSrc("udSort") +
  "; return { udSortRows, udSort };");
const R = (t, move, x) => ({ t, move, x, flash: null, row: null });

test("USUAL DAY sort: × USUAL biggest first by default; MOVE and NAME on a tap; a second tap reverses; blanks sink", () => {
  const S = {}; const { udSortRows, udSort } = udSortWorld()(S);
  const rows = () => [R("MSFT", 1.2, 0.4), R("AAPL", -5, -2.5), R("ZM", null, null), R("BA", 3, 3.1)];
  assert.deepEqual(udSortRows(rows(), udSort()).map((r) => r.t), ["BA", "AAPL", "MSFT", "ZM"]);
  S.udSort = { k: "move", dir: -1 };
  assert.deepEqual(udSortRows(rows(), udSort()).map((r) => r.t), ["BA", "MSFT", "AAPL", "ZM"], "move vs previous close, highest first");
  S.udSort = { k: "move", dir: 1 };
  assert.deepEqual(udSortRows(rows(), udSort()).map((r) => r.t), ["AAPL", "MSFT", "BA", "ZM"], "reversed; the blank still last");
  S.udSort = { k: "name", dir: 1 };
  assert.deepEqual(udSortRows(rows(), udSort()).map((r) => r.t), ["AAPL", "BA", "MSFT", "ZM"], "A→Z");
  assert.match(page, /case "udsort": \{ const k = a\.dataset\.k, so = udSort\(\); S\.udSort = \{ k: k, dir: so\.k === k \? -so\.dir : UD_SORT_DEF\[k\] \}; udRender\(\); break; \}/);
});

test("USUAL DAY lists: the chips are gone; every name row carries the dashboard's own ⊙ ★ ♥ and repaints in place", () => {
  const day = fnSrc("udDayHTML");
  assert.doesNotMatch(day, /ud-sel|data-act="udlist"/);
  assert.match(day, /const lists = r\.isT \? listCtlHTML\(r\.t\) : "";/, "the same buttons as the board rows (data-act lst / star)");
  assert.match(day, /<th class="ud-lsth"[^>]*>LISTS<\/th>/);
  assert.match(fnSrc("coListsRepaint"), /if \(S\.sec === "USUAL" && typeof udRender === "function"\) udRender\(\);/);
  assert.match(fnSrc("toggleFav"), /coListsRepaint\(\);/, "a ♥ toggle reaches the repaint");
});

/* the exact GOOG row of 28 Sep, as stored */
const GOOG = { ts: "2026-09-28T20:50:01.605+00:00", kind: "price_outlier", subject: "GOOG", subject_kind: "ticker", direction: -1, magnitude: 2.08,
  detail: { fired: ["statistical"], price: 325.8864, n_days: 250, session: "2026-09-28", x_usual: 2.08, move_pct: -4.455, prev_close: 341.08,
    thresholds: { x_usual: 2, raw_move_pct: 8, needs_move_pct: 1 }, asset_class: "equity", daily_vol_pct: 2.142 } };
function flashWorld(prices) {
  const clock = page.slice(page.indexOf("function gsNyClock("), page.indexOf("function gsIsTradingDay("));
  const src = page.match(/const SCINT_CLOSE_MIN = [^\n]*/)[0] + "\n" + fnSrc("scintFlashAt") + fnSrc("scintNow") + fnSrc("scintNowSays");
  return new Function("PRICES", "prevClose", "todayISO", "fmtC",
    "const SCINT_OPEN_MIN = 570; const ET_HM = new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hour12:false});" +
    "const GS_NYSE_HOLIDAYS = []; function gsIsTradingDay(d){ const w = new Date(d + 'T12:00:00Z').getUTCDay(); return w >= 1 && w <= 5; }" +
    clock + src + "; return { scintFlashAt, scintNow, scintNowSays };")(
    prices, {}, () => "2026-09-28", (c) => (c >= 0 ? "+" + c.toFixed(2) + "%" : "(" + Math.abs(c).toFixed(2) + "%)"));
}

test("GOOG 28 Sep: the flash is 16:50 ET after hours; now is the latest price vs the SAME previous close ÷ the SAME usual day", () => {
  const w = flashWorld({ GOOG: 339.05 });
  assert.deepEqual(w.scintFlashAt(GOOG), { hm: "16:50", afterHours: true, off: "after hours" });
  const n = w.scintNow(GOOG);
  assert.equal(n.move.toFixed(2), "-0.60", "339.05 / 341.08 − 1");
  assert.equal(Math.abs(n.x).toFixed(1), "0.3", "−0.60 ÷ 2.142 — the 0.3 Alan saw");
  assert.equal(w.scintNowSays(GOOG), "now (0.60%), 0.3× usual — back inside 2×");
  assert.equal(w.scintFlashAt(Object.assign({}, GOOG, { ts: "2026-09-28T13:00:00Z" })).off, "pre-market", "09:00 ET");
  assert.equal(w.scintFlashAt(Object.assign({}, GOOG, { ts: "2026-09-28T15:00:00Z" })).off, "", "11:00 ET is the session");
  assert.equal(w.scintFlashAt(Object.assign({}, GOOG, { ts: "2026-09-27T15:00:00Z" })).off, "market closed", "a Sunday");
  assert.equal(flashWorld({}).scintNow(GOOG), null, "no live price → no NOW (the flash stays, labelled)");
  assert.equal(flashWorld({ GOOG: 339 }).scintNow(Object.assign({}, GOOG, { detail: Object.assign({}, GOOG.detail, { session: "2026-09-25" }) })), null,
    "an older session's flash is never set against today's price");
});

test("GOOG: every surface says which number it is — the strip, the board's title, the table's two columns", () => {
  assert.match(fnSrc("scintSays"), /" at the flash " \+ f\.hm \+ " ET" \+ \(f\.off \? ", " \+ f\.off : ""\)/);
  assert.match(fnSrc("scintSaysShort"), /\(now \? " · " \+ now : ""\)/);
  assert.match(page, /scSetTitle\(cell, "outlier of the day · " \+ scintSaysLive\(ev\)\);/);
  assert.match(fnSrc("scintNotifyItems"), /says: scintSays\(ev\)/, "the bell keeps no live price");
  const day = fnSrc("udDayHTML");
  assert.match(day, /th\("flash", '<span class="ud-long">AT THE <\/span>FLASH', "n"\)/);
  assert.match(day, /const nowLbl = open === today \? "NOW" : "AT THE CLOSE";/);
  assert.match(fnSrc("udRowsForDay"), /why: po && why0 \? "at the flash: " \+ why0 \+ \(now && now\.x != null && Math\.abs\(now\.x\) < now\.thr \? " · back inside " \+ now\.thr \+ "× now" : ""\) : why0,/);
});

/* ── 3 · ONE EVENTS STRUCTURE: the economic room opens on its own sliding tape, like EARNINGS ─────────── */
test("ECONOMIC room: tape in the EVENTS frame (NEXT at its right end) + the earnings rail's two lists; one switch", () => {
  assert.match(page, /const ECON_ROOM_TAPE_ON = true;/);
  const room = fnSrc("econRoomHTML");
  assert.match(room, /\(ECON_ROOM_TAPE_ON \? ecRoomTapeWrapHTML\(\) : ""\)/);
  assert.match(room, /\(ECON_ROOM_TAPE_ON \? "" : '<div class="ec-next" id="ecRoomQueue"><\/div>'\)/, "switch off = the M55 queue strip, as it was");
  assert.match(room, /id="ecRoomUp"/); assert.match(room, /id="ecRoomPast"/);
  assert.match(fnSrc("ecRoomTapeWrapHTML"), /class="sc-toptape sc-toptape--ec"><div class="sc-toptape__slot" id="ecRoomTapeSlot"><\/div>' \+\s+'<span class="sc-macronext sc-toptape__next" id="ecNext">/);
  assert.match(fnSrc("ecRoomWindow"), /ttWindow\(today\)/, "the same days as the earnings tape");
});

test("ECONOMIC room tape: the SAME items, states and colours as every other economic surface; nothing new is read", () => {
  const t = fnSrc("ecRoomTapeHTML");
  assert.match(t, /ecBandItemHTML\(it, ecBandState\(it, now\), today\)/, "the band's own item: category dot, High heavier, release states");
  assert.match(t, /ecTapeNowHTML\(/, "a NOW marker where the past ends");
  assert.match(fnSrc("ecRoomTapeItems"), /ecTapeItems\(MACRO_NEXT \|\| \[\]\)/, "the one shared US read");
  assert.match(fnSrc("ecNudgePaint"), /ecNudgePaintBox\(el\("ecNext"\), nowSec\);/, "NEXT is the header's own queue");
  assert.match(fnSrc("ecRoomScintPass"), /mnScintPass\(now, ecNextBox, ecNudgeModel\(nowSec\), "ecnext"\)/, "and flashes on the same clock");
  assert.match(fnSrc("ecTapePaint"), /renderEcRoomTape\(nowSec\)/, "repainted on the shared 15 s tick");
  const fill = fnSrc("fillEcon");
  assert.doesNotMatch(fill, /ecTapeRead|ecTapeArm/, "no read and no timer of its own");
});

test("ECONOMIC room lists: UPCOMING (est, prior, countdown) and PRINTED (actual vs est, the calendar's read), each row goes to its day", () => {
  const MACRO_NEXT = null;
  const L = fnSrc("ecRoomListsHTML");
  assert.match(L, /it\.actual == null && it\.ts > now - EC_NUDGE_DUE_S && it\.ts - now <= EC_TAPE_DAYS \* 86400/);
  assert.match(L, /it\.actual != null && it\.ts <= now/);
  assert.match(L, /ecTapeSurprise\(it\)/, "beat / miss read exactly as the calendar reads it");
  assert.match(L, /data-act="mngoto" data-day="/);
  assert.match(L, /it\.impact === "High" \? "ec-li-hi"/);
  void MACRO_NEXT;
});

test("room tapes on a phone: NEXT drops under the tape instead of disappearing (both rooms), overriding the r4-fit hide", () => {
  assert.match(page, /\.ec-roomtape \.sc-toptape__next\.sc-macronext, \.ern-roomtape \.sc-toptape__next\.sc-macronext\{ display:flex; flex:1 0 100%;/);
  const late = page.indexOf('<style id="r4-fit">');
  assert.match(page.slice(late), /\.sc-toptape__next\.sc-macronext\{display:none\}/, "the rule it outranks (0,2,0 < 0,3,0)");
});

/* ── 4 · THE BOARD: the race, TSM, the two column sets, the full-screen frame ───────────────────────── */
test("F P/E race: a late estimates answer is kept and repaints the cells; it is never read twice", () => {
  const L = fnSrc("loadEstimates");
  assert.match(L, /scOpt\('analyst_estimates_annual',  pA, null\)/);
  assert.match(L, /if \(!annual \|\| !quarter\) \{/);
  assert.match(L, /Promise\.all\(\[pA\.catch\(\(\) => null\), pQ\.catch\(\(\) => null\)\]\)\.then/, "the SAME promises, no second read");
  assert.match(page, /EST_LATE_HOOK = \(est\) => \{ try \{ applyEstimates\(est\); fpeRepaint\(\); \} catch \(_\) \{\} \};/);
  assert.match(fnSrc("fpeRepaint"), /const p = r\.price != null \? r\.price : \(PRICES\[r\.t\] != null \? PRICES\[r\.t\] : null\);/, "the latest known price");
  assert.match(page, /applyEstimates\(fpeEst\);/, "the pull uses the same fill");
});

test("TSM: the supplier's own paired rate is used only when the EPS and revenue ratios agree; the cell says ≈", () => {
  const pair = new Function("num", "EST_FX_TOL", fnSrc("estFxPair") + "; return estFxPair;")((x) => (x == null ? null : Number(x)), 0.03);
  /* TSM, as stored on 28 Sep */
  const ev = [{ date: "2026-10-15", eps_estimate: 4.39, revenue_estimate: 45287550000 }];
  const q = [{ fiscal_date: "2026-09-30", est_eps_avg: 139.57701, est_revenue_avg: 1439395000000 }, { fiscal_date: "2026-12-30", est_eps_avg: 153.04, est_revenue_avg: 1579925526117 }];
  const p = pair(ev, q);
  assert.equal(p.q, "2026-09-30");
  assert.equal(p.f.toFixed(5), "0.03145");
  assert.ok(Math.abs(p.fxR - 0.03146) < 0.00002);
  /* an ADR-ratio mismatch (EPS ratio 5× the revenue ratio) is refused */
  assert.equal(pair([{ date: "2026-10-15", eps_estimate: 21.95, revenue_estimate: 45287550000 }], q), null);
  assert.equal(pair(ev, [{ fiscal_date: "2026-03-30", est_eps_avg: 100, est_revenue_avg: 1e12 }]), null, "no quarter within 110 days of the report");
  assert.match(fnSrc("fpeVal"), /if \(estNonUsd\(t\) && !fx\) return null;/, "no pair → still no multiple");
  assert.match(fnSrc("fpeVal"), /if \(fx\) e = e \* fx\.f;/);
  assert.match(fnSrc("fpeCellText"), /"≈"/);
  assert.match(fnSrc("fpeTitle"), /the rate is the supplier's own for the quarter to/);
});

test("board v2 is folded away (H4, 1 Oct): one board, no ?board switch; the Geiger number now rides in full screen", () => {
  assert.doesNotMatch(page, /BOARD_V2_ON|READ_ICON|brd-v2|<style id="board-v2-20260929">/);
  assert.match(page, /localStorage\.removeItem\("sc_board_v2"\)/, "a device that tried v2 forgets it");
  assert.match(page, /geigerMiniHTML\(d\.g, 1, true\)\)/);   /* HC1 (6 Oct) — the bar is on the Geiger's fixed −1 … +1, no longer on the strongest row on screen */
  assert.match(page, /var gn=cell\.querySelector\("\.sc-gnum"\);/, "the number follows the bar in a rewind");
  assert.ok(page.indexOf('<style id="r4-fit">') > page.indexOf('<style id="board-h4-20261001">'), "r4-fit stays last");
});

test("full screen: the panel follows the header's drawn edges; clearing resets them; selectors wrap at 11px", () => {
  const t = fnSrc("toggleSecFs");
  assert.match(t, /const hb = head\.getBoundingClientRect\(\), pb = panel\.getBoundingClientRect\(\);/);
  assert.match(t, /innerWidth <= 900\)\) return;/, "phones keep their own inset");
  assert.match(fnSrc("clearSecFs"), /SECFS\.style\.left = ""; SECFS\.style\.right = "";/);
  assert.match(page, /body\.secfs \.sc-secfs \.cohtabstrip\{ flex-wrap:wrap !important; overflow:visible !important; row-gap:2px; \}/);
  assert.match(page, /body\.secfs \.sc-secfs \.cohtabstrip \.sc-coh\{ font-size:11px; \}/);
});

/* ── 5 · COHORT COMPARE: the cap-weight vs equal-weight BOW TIE ──────────────────────────────────── */
test("BOW TIE: 14 pairs (RSP/SPY, QQQE/QQQ, EQAL/IWB and the eleven RSP* vs XL*), each bar = equal-weight Geiger − cap-weight", () => {
  const pairs = new Function(page.match(/var BOWTIE_PAIRS=\[[\s\S]*?\]\];/)[0] + "; return BOWTIE_PAIRS;")();
  assert.equal(pairs.length, 14);
  assert.deepEqual(pairs.slice(0, 3).map((p) => p[0] + "/" + p[1]), ["RSP/SPY", "QQQE/QQQ", "EQAL/IWB"]);
  const eqwt = page.match(/EQWT:\s+\[([^\]]+)\]/)[1].replace(/"/g, "").split(",");
  const spdr = page.match(/SPDR:\s+\[([^\]]+)\]/)[1].replace(/"/g, "").split(",");
  assert.deepEqual(pairs.slice(3).map((p) => p[0]).sort(), eqwt.slice().sort(), "the eleven RSP* sector funds");
  for (const p of pairs.slice(3)) assert.equal(spdr.indexOf(p[1]), eqwt.indexOf(p[0]), p[0] + " pairs with its own sector's XL*");
  for (const p of pairs) assert.ok(p[3].length <= 4, p[3] + " fits a ~45 px column");
  const src = page.slice(page.indexOf('if(SECT_FAMILY==="BOWTIE"){'), page.indexOf('if(SECT_FAMILY==="INDEXES"){'));
  assert.match(src, /var ew=gAt\(p\[0\]\), cw=gAt\(p\[1\]\), tOnly=false;[\s\S]{0,260}var d=\(ew==null\|\|cw==null\)\?null:ew-cw;/, "the same Geiger reader (and rewind) as every family");
  /* BT1 (6 Oct) — the hover moved into scBowtieLine (Geiger points, "level" inside the flat floor, the limit note); same pair, same two Geigers */
  assert.match(src, /full:scBowtieLine\(p\[2\], p\[0\], p\[1\], ew, cw, tOf\(p\[0\]\), tOf\(p\[1\]\)\)/, "the pair and both Geigers on hover");   /* HC1 (6 Oct) — on a replayed day with no stored momentum for a fund, both are read on trend (like for like) and the hover says so */
  assert.match(fnSrc("scBowtieLine"), /name \+ " \\u00b7 " \+ ewSym \+ " \(equal-weight\) " \+ f2\(ew\) \+ " \\u2212 " \+ cwSym \+ " \(cap-weight\) " \+ f2\(cw\)/);
  assert.match(src, /\.sort\(function\(a,b\)\{return \(b\.mean==null\?-99:b\.mean\)-\(a\.mean==null\?-99:a\.mean\);\}\)/, "high to low: the bow tie");
  assert.match(page, /\["BOWTIE","BREADTH",/);   /* HC1 (6 Oct) — Alan: "change the title from bow tie to breadth"; the key and the number stay */
  assert.match(page, /if\(sf==="BOWTIE"\) window\.SECT_FAMILY=sf;/, "remembered like the other families");
  assert.match(fnSrc("cohortCompareStripHTML"), /if \(bowTie\) return '<div class="sc-cohstrip__hd">BREADTH · equal-weight Geiger minus cap-weight/);
});

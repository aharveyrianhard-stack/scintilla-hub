/* 28 Sep — L1-EARNINGS-USUALDAY: the earnings room and USUAL DAY, cleaned up, plus the reviewer's should-fix list. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { sigmaHistory, dayCounts, percentileOf, SIGMA_VERSION } from "../supabase/functions/heartbeat-daily/sigma.mjs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const rules = JSON.parse(fs.readFileSync(new URL("../data/scintilla-rules.json", import.meta.url), "utf8"));
const fnSrc = (name) => { const s = page.search(new RegExp("^(async )?function " + name + "\\b", "m")); assert.ok(s >= 0, name); return page.slice(s, page.indexOf("\n}\n", s) + 3); };

/* a synthetic daily series: alternating ±1% days, one 9% day, stamped the way the chart API stamps them */
function bars(n, spikeAt, spikePct, startMs = Date.UTC(2020, 0, 2, 5)) {
  const out = []; let c = 100;
  for (let i = 0; i < n; i++) {
    if (i) c = c * (1 + (i === spikeAt ? spikePct : (i % 2 ? 0.01 : -0.01)));
    out.push({ t: startMs + i * 864e5, c: +c.toFixed(4) });
  }
  return out;
}

test("EARNINGS: the EVENTS master tab reads EARNINGS; the room's key stays EVENTS", () => {
  assert.match(page, /const MTAB_LABEL = \{ USUAL: "USUAL DAY", EVENTS: "EARNINGS" \};/);
  assert.match(page, /\(MTAB_LABEL\[s\] \|\| s\)/);
  assert.match(page, /"EVENTS", "USUAL", "ECONOMIC"\]/, "the section key is unchanged, so addresses and handlers keep working");
  assert.match(page, /<span>earnings extras<\/span>/);
});

test("EARNINGS: PAST REPORTED and THE OLDER LIST tabs are gone; past results live once, on the right", () => {
  assert.match(page, /function ernTabsHTML\(\) \{ return ""; \}/);
  assert.match(page, /const ernTab = \(\) => "DASH";/);
  assert.match(page, /'<div id="ernTabs" hidden><\/div>' \+/);
  assert.match(page, /<h4>PAST · REPORTED<\/h4><div class="ev-pastwrap" id="evPastRail">/);
});

test("EARNINGS timeline: one fixed stretch per zoom, read by what is on screen, TODAY line in every zoom", () => {
  const Z = new Function(page.match(/const ERC_ZOOM = \{[\s\S]*?\n\};/)[0] + "; return ERC_ZOOM;")();
  for (const k of Object.keys(Z)) assert.ok(Z[k].back > 0 && Z[k].fwd > 0 && Z[k].win > 0, k);
  assert.ok(Z.DAYS.back >= 365 && Z.MONTHS.back >= 11000);
  assert.match(fnSrc("ercTlWant"), /const L = sc\.scrollLeft, R = L \+ sc\.clientWidth;/, "reads follow the screen");
  const x = fnSrc("ercTlTodayX");
  assert.match(x, /bar\.offsetWidth \* \(days === 1 \? 0\.5 : Math\.min\(1, \(into \+ 0\.5\) \/ days\)\)/, "today sits at its own share of a week, month, quarter or year bar");
  assert.match(fnSrc("ercTlOrient"), /lbl\.textContent = "ON SCREEN  "/, "the header says which dates are on screen");
  assert.match(fnSrc("ercTlToday"), /ercTlGlide\(sc, x - sc\.clientWidth \* 0\.6\)/, "TODAY glides back");
  assert.match(page, /\.se-tltoday b\{ position:absolute;/);
});

test("sigma history: every day measured close vs previous close against the 60 moves BEFORE it", () => {
  const h = sigmaHistory("ZZZZ", bars(120, 100, 0.09), rules);
  assert.equal(h.events.length, 1, "only the 9% day fires");
  const e = h.events[0];
  assert.equal(e.date, new Date(Date.UTC(2020, 0, 2, 5) + 100 * 864e5).toISOString().slice(0, 10));
  assert.ok(Math.abs(e.move_pct - 9) < 1e-6, "the move is close / previous close − 1");
  assert.ok(Math.abs(e.close / e.prev_close - 1.09) < 1e-3);
  assert.ok(e.usual_day_60 > 0.9 && e.usual_day_60 < 1.1, "the usual day is the ±1% days before it — the spike is not in its own divisor");
  assert.equal(e.usual_sessions, 60);
  assert.equal(e.direction, 1);
  assert.deepEqual(e.fired.sort(), ["raw", "statistical"]);
  assert.equal(e.version, SIGMA_VERSION);
  assert.equal(h.measured.length, 120 - 1 - 20, "a day needs 20 earlier moves before it is measured at all");
});

test("sigma history: a reused ticker is cut at the last long gap, as the stored usual day is", () => {
  const old = bars(60, 30, 0.5, Date.UTC(2010, 0, 4, 5));
  const now = bars(80, 70, -0.12, Date.UTC(2020, 0, 2, 5));
  const h = sigmaHistory("ZZZZ", old.concat(now), rules);
  assert.ok(h.joins_cut);
  assert.equal(h.from, "2020-01-02");
  assert.equal(h.events.length, 1, "the old security's 50% day is not this name's history");
  assert.equal(h.events[0].direction, -1);
});

test("sigma day counts and percentiles", () => {
  const a = sigmaHistory("AAAA", bars(120, 100, 0.09), rules), b = sigmaHistory("BBBB", bars(120, 100, -0.09), rules);
  const c = dayCounts([a, b]);
  const d = c.find((x) => x.date === a.events[0].date);
  assert.deepEqual([d.names_measured, d.n, d.up, d.dn], [2, 2, 1, 1]);
  assert.ok(c.filter((x) => x.n === 0).length > 50, "a quiet day is a stored zero, never a missing row");
  const hist = Array.from({ length: 100 }, (_, i) => i);
  assert.equal(percentileOf(99, hist), 100);
  assert.equal(percentileOf(0, hist), 1);
  assert.equal(percentileOf(5, hist.slice(0, 10)), null, "under 20 days there is no percentile");
  /* the page's own copy is the same rule */
  const pagePct = new Function(fnSrc("sigmaPercentile") + "; return sigmaPercentile;")();
  for (const v of [0, 17, 49.5, 99]) assert.equal(pagePct(v, hist), percentileOf(v, hist));
});

test("sigma backfill writes only its two new tables, additive, with a rollback", () => {
  const job = fs.readFileSync(new URL("../scripts/sigma-history-backfill.mjs", import.meta.url), "utf8");
  const writes = [...job.matchAll(/upsert\("([a-z_]+)"/g)].map((m) => m[1]);
  assert.deepEqual(writes.sort(), ["sigma_day_counts", "sigma_events_daily"]);
  assert.doesNotMatch(job, /scintillas\?|live_quotes|price_/, "never the detector's store, never a price table");
  assert.match(job, /if \(!DRY && \(!SB \|\| !SERVICE\)\)/, "keys only from the environment");
  const mig = fs.readFileSync(new URL("../supabase/migrations/20260928_sigma_history.sql", import.meta.url), "utf8");
  assert.doesNotMatch(mig.replace(/^--.*$/gm, ""), /\b(drop table|alter table (?!public\.sigma_)|delete from|truncate)\b/i);
  assert.match(mig, /grant select on public\.sigma_events_daily, public\.sigma_day_counts to anon, authenticated;/);
  const rb = fs.readFileSync(new URL("../supabase/migrations/20260928_sigma_history_ROLLBACK.sql", import.meta.url), "utf8");
  assert.match(rb, /drop table if exists public\.sigma_events_daily;/);
  assert.match(rb, /drop table if exists public\.sigma_day_counts;/);
});

test("USUAL DAY: moves vs the previous close (no TIME column), the lists selector, the registry folded away", () => {
  const day = fnSrc("udDayHTML");
  assert.doesNotMatch(day, /<th>TIME<\/th>/);
  assert.match(day, /<th class="n">MOVE vs PREV CLOSE<\/th><th class="n">PREV CLOSE<\/th>/);
  assert.match(day, /data-act="udlist" data-k="ALL"/);
  assert.match(page, /const UD_LISTS = \[\["RADAR", "⊙", "RADAR"\], \["FAVORITES", "★", "FAVORITES"\], \["FAV", "♥", "LIKED"\]\];/);
  assert.match(page, /case "udlist": \{ S\.udCohPick = a\.dataset\.k \|\| "ALL";/);
  assert.match(fnSrc("udLiveMove"), /\(p \/ pc - 1\) \* 100/, "today's move is the live price against the served previous close");
  assert.match(fnSrc("udRoomHTML"), /<details class="ud-reg" id="udReg"><summary>USUAL DAY · BY NAME/);
  assert.match(page, /\.body2--ud\{ grid-template-columns:1fr; \}/);
  assert.match(fnSrc("cohStripHTML"), /const on = active \|\| S\.coh;/, "the strip lights the room's own pick");
});

test("USUAL DAY: the history is read, dated and ranked; up/down count moves only", () => {
  assert.match(fnSrc("udCntRead"), /pg\("sigma_day_counts\?select=date,names_measured,n,up,dn&date=gt\."/);
  assert.match(fnSrc("udHistDayEnsure"), /sigma_events_daily\?select=/);
  const hero = fnSrc("udHeroHTML");
  assert.match(hero, /sigmaPercentile\(c\.dn \/ m, past\.map\(\(x\) => x\.dn \/ x\.names_measured\)\)/, "compared on share, since the universe was smaller in 2003");
  assert.match(hero, /x\.date < open/, "a day is ranked against the days BEFORE it");
  assert.match(fnSrc("udByDay"), /if \(r\.kind === "price_outlier"\) \{ if \(\+r\.direction > 0\) b\.up\+\+;/);
  assert.match(fnSrc("udTapeHTML"), /history from <b>/);
  assert.match(page, /<input type="date" id="udGo" min="/);
});

test("TODAY'S SCINTILLAS: the count opens USUAL DAY on today; the bell panel opens inside the window", () => {
  assert.match(page, /'<button class="sc-ss__n sc-ss__n--go" data-act="scintlast" data-day="' \+ esc\(todayISO\(\)\)/);
  assert.match(page, /case "scintlast": \{ S\.udCohPick = null; S\.udDay = a\.dataset\.day \|\| null; UD_JUMP = true; go\("USUAL"\); break; \}/);
  const open = page.slice(page.indexOf("  function openPanel(){"), page.indexOf("  function closePanel(){"));
  assert.ok(open.indexOf('panel.classList.add("is-open")') < open.indexOf("positionPanel();"), "placed after it is shown, at its real width");
  assert.match(page, /var left = Math\.max\(8, Math\.min\(r\.right - w, vw - w - 8\)\);/);
  assert.match(open, /udGoLine\(panel\);/);
});

test("reviewer: phone company view on screen; ⛶ below the tapes; Esc on COHORT ▾ closes the menu only", () => {
  assert.match(fnSrc("openCo"), /coBringIntoView\(\);/);
  assert.match(fnSrc("coBringIntoView"), /matchMedia\("\(max-width:900px\)"\)/);
  const fs1 = fnSrc("toggleSecFs");
  assert.match(fs1, /document\.querySelectorAll\("\.sc-toptape, \.sc-scintstrip"\)/);
  assert.match(fs1, /const drift = Math\.round\(panel\.getBoundingClientRect\(\)\.top\) - top;/);
  assert.match(page, /!!el\("tvModal"\) \|\|\n    !!\(document\.querySelector && document\.querySelector\("\.sc-cohwrap\.is-open"\)\);/);
  const blocked = new Function("el", "SECFS", "YT_IDX", "document", fnSrc("cvKeysBlocked") + "\nreturn cvKeysBlocked;");
  const doc = (open) => ({ fullscreenElement: null, body: { classList: { contains: () => false } }, querySelector: (q) => (open && q === ".sc-cohwrap.is-open" ? {} : null) });
  assert.equal(blocked(() => null, null, -1, doc(true))({ target: {} }), true, "the open COHORT ▾ menu owns Esc");
  assert.equal(blocked(() => null, null, -1, doc(false))({ target: {} }), false, "with it closed, Esc goes back to the board as before");
  assert.match(page, /if \(document\.querySelector\("\.sc-cohwrap\.is-open"\)\) return;   \/\* 28 Sep — the COHORT ▾ menu closes itself/);
});

test(".vercelignore keeps the proof tooling (local /Users paths) off the site", () => {
  const vi = fs.readFileSync(new URL("../.vercelignore", import.meta.url), "utf8");
  assert.match(vi, /^deliverables\/\*\*\/tools\/$/m);
  assert.match(vi, /^deliverables\/20260924\/allocation-4\/render-offline\.mjs$/m);
});

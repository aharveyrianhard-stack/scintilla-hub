import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("an open events view is re-read on a timer and on return to the tab, never while hidden, never right after a read", () => {
  assert.match(page, /setInterval\(\(\) => refreshOpenEvents\(false\), 300000\);/);
  assert.match(page, /document\.addEventListener\("visibilitychange", \(\) => \{ if \(document\.visibilityState === "visible"\) refreshOpenEvents\(true\); \}\);/);
  const src = page.match(/function refreshOpenEvents\(onResume\) \{[\s\S]*?\n\}\n/)[0];
  assert.match(src, /if \(document\.visibilityState === "hidden"\) return;/);
  assert.match(src, /if \(onResume && Date\.now\(\) - EV_READ_AT < 60000\) return;/);
  assert.match(src, /if \(S\.sec === "EVENTS" && el\("evList"\) && S\.calType !== "DIVIDENDS"\) \{\n[^\n]*#evList \.sc-trbubble[^\n]*style\.display === "block"\)\) return;[^\n]*\n    fillEvents\(true\);\n  \} else if \(S\.coData && S\.coTab === "EVENTS"\) refreshCompanyEvents\(\);/, "only the view that is open is re-read, and never while a call summary is open in it (review finding)");
});

test("a quiet re-read that finds the same rows touches nothing; one that finds a change redraws in place", () => {
  assert.match(page, /if \(EV_CACHE && !quiet\) renderEvents\(S\.coh\);/, "no repaint from the old read when the re-read is quiet");
  assert.match(page, /if \(!quiet\) loadCohSets\(\)\.then\(\(\) => \{ if \(S\.sec === "EVENTS"\) renderEvents\(S\.coh\); \}\)/, "nor from the cohort map arriving (measured: it reset the past column from 600px to 0)");
  assert.match(page, /if \(!quiet\) renderEvents\(S\.coh\);\n    else if \(changed\) redrawKeepingPlace\("#evList", "\.sc-evcol", \(\) => renderEvents\(S\.coh\)\);/);
  assert.match(page, /else if \(S\.sec === "EVENTS"\) fillEvents\(\);/, "entering the section still paints at once and reads, as before");
  const co = page.match(/async function refreshCompanyEvents\(\) \{[\s\S]*?\n\}\n/)[0];
  assert.match(co, /if \(sig === d\._evSig\) return;/);
  assert.match(co, /if \(token !== ROT_TOKEN \|\| S\.coData !== d \|\| S\.coTab !== "EVENTS"\) return;/, "an answer for a company that is no longer on screen is dropped");
  assert.match(co, /catch \(err\) \{ return; \}/, "a failed re-read changes nothing on screen");
  assert.doesNotMatch(co, /\.catch\(\(\) => \[\]\)/, "no sub-read failure is turned into an empty list (root 16:31Z)");
  assert.match(co, /if \(document\.querySelector\("#leftPanel \.sc-evtab\.tr-open"\)\) return;/, "a call summary being read is not redrawn from under the reader");
  assert.match(page, /_evSig: JSON\.stringify\(\[evs \|\| \[\], csum \|\| \[\], ckeys \|\| \[\]\]\),/, "the first load records what the tab was drawn from, so the first re-read is not a redraw");
  assert.equal((page.match(/pg\(coEventsPath\(e\)\)/g) || []).length, 2, "first load and re-read ask the identical question");
});

test("redrawKeepingPlace keeps each list where the reader left it and an opened group open", () => {
  const mk = (scroll, open) => ({ lists: scroll.map((v) => ({ scrollTop: v })), groups: open.map((v) => ({ open: v })) });
  let dom = mk([0, 480], [true]);
  const document = { querySelector: () => ({ querySelectorAll: (sel) => (/details/.test(sel) ? dom.groups : dom.lists) }) };
  const redraw = new Function("document", page.match(/function redrawKeepingPlace\(rootSel, scrollSel, draw\) \{[\s\S]*?\n\}\n/)[0] + "return redrawKeepingPlace;")(document);
  redraw("#evList", ".sc-evcol", () => { dom = mk([0, 0], [false]); });   // the draw replaces every node
  assert.deepEqual(dom.lists.map((x) => x.scrollTop), [0, 480]); assert.equal(dom.groups[0].open, true);
  redraw("#evList", ".sc-evcol", () => { dom = mk([0], []); });            // UPCOMING disappears (its only row reported): the one list left is PAST and gets PAST's place, not UPCOMING's (review finding)
  assert.deepEqual(dom.lists.map((x) => x.scrollTop), [480]);
  dom = mk([300], []); redraw("#evList", ".sc-evcol", () => { dom = mk([0, 0], []); });   // and the other way round: PAST keeps its place, the new UPCOMING starts at the top
  assert.deepEqual(dom.lists.map((x) => x.scrollTop), [0, 300]);
  assert.match(page, /EV_TRKEYS = tridx\.map\(\(r\) => r\.ticker \+ "\|" \+ r\.call_date\)\.join\(","\);/); assert.match(page, /\[\.\.\.CALLSUM_IDX\.entries\(\)\], EV_TRKEYS\]\), changed = sig !== EV_SIG;/, "the signature covers WHICH calls are stored, not how many (review finding + root 16:31Z)");
});

/* ROOT 16:31Z: "refreshCompanyEvents catches call-summary/key request errors as [] and then overwrites last-good _callsum/_callDays;
   transient failures would erase working controls on the refreshed screen." The REAL functions are run here with reads that reject. */
import vm from "node:vm";
const take = (re) => page.match(re)[0];
const PURE = take(/function callDayWindow\(day, n\) \{[\s\S]*?\n\}\n/) + take(/function matchCallSummaries\(events, calls\) \{[\s\S]*?\n\}\n/) + take(/function transcriptExists\(ticker, date, callDays\) \{[\s\S]*?\n\}\n/);

test("company tab: a quiet re-read whose call-key or call-summary read is REJECTED keeps the working Transcript / Call summary controls", async () => {
  const evs = [{ ticker: "FDX", date: "2026-06-23", eps_actual: 6.31, report_time: "AMC" }], keys = [{ ticker: "FDX", quarter: "Q4 2026", call_date: "2026-06-23" }];
  for (const failing of ["summary keys", "call keys", "events", "none"]) {
    let redraws = 0; const paths = { ev: "EV", cs: "CS", ck: "CK" };
    const ctx = vm.createContext({ S: { coTab: "EVENTS", coData: null }, ROT_TOKEN: 7, EV_READ_AT: 0, document: { querySelector: () => null }, el: () => ({}), encodeURIComponent, JSON, Date, Array, Promise,
      coEventsPath: () => paths.ev, coCallSumPath: () => paths.cs, coCallKeysPath: () => paths.ck, renderLeftPanel() {}, redrawKeepingPlace: () => { redraws++; },
      pg: (q) => (failing === "summary keys" && q === "CS") || (failing === "call keys" && q === "CK") || (failing === "events" && q === "EV") ? Promise.reject(new Error("503")) : Promise.resolve(q === "EV" ? [...evs, { ticker: "FDX", date: "2026-10-28", eps_actual: null }] : keys) });
    vm.runInContext(PURE + take(/async function refreshCompanyEvents\(\) \{[\s\S]*?\n\}\n/), ctx);
    const d = ctx.S.coData = { t: "FDX", events: evs, _evSig: "first", _callsum: vm.runInContext("matchCallSummaries", ctx)(evs, keys), _callDays: ["2026-06-23"] };
    await vm.runInContext("refreshCompanyEvents()", ctx);
    const hasControls = d._callsum.has("FDX|2026-06-23") && vm.runInContext("transcriptExists", ctx)("FDX", "2026-06-23", d._callDays);
    assert.equal(hasControls, true, failing + " failed: the Call summary and Transcript controls for FDX Jun 23 are still there");
    if (failing === "none") { assert.equal(redraws, 1, "a good re-read that found a new row redraws"); assert.equal(d.events.length, 2); }
    else { assert.equal(redraws, 0, failing + " failed: nothing is redrawn"); assert.equal(d._evSig, "first", "and nothing is recorded as read"); assert.equal(d.events.length, 1); }
  }
});

test("master feed: a quiet re-read whose index reads are REJECTED keeps the last good indexes - cards keep their controls", async () => {
  const src = take(/async function fillEvents\(quiet\) \{[\s\S]*?\n\}\n/);
  const up = [{ ticker: "COST", date: "2099-01-01", eps_actual: null }], past = [{ ticker: "FDX", date: "2026-06-23", eps_actual: 6.31, report_time: "AMC" }];
  const run = async (failIndexes) => { let redraws = 0, renders = 0;
    const ctx = vm.createContext({ S: { sec: "EVENTS", coh: "ALL", calType: "ALL" }, el: () => ({ innerHTML: "" }), UNIVERSE: new Set(["FDX", "COST"]), todayISO: () => "2026-09-18", EV_CACHE: { up: [], past: [] }, EV_SIG: "old", EV_READ_AT: 0, EV_TRKEYS: "FDX|2026-06-23", EV_CSKEYS: [{ ticker: "FDX", quarter: "Q4 2026", call_date: "2026-06-23" }],
      TRANSCRIPT_IDX: new Map([["FDX", ["2026-06-23"]]]), CALLSUM_IDX: new Map(), loadCohSets: () => Promise.resolve(), renderEvents: () => { renders++; }, redrawKeepingPlace: (a, b, draw) => { redraws++; draw(); }, JSON, Date, Array, Map, Set, Promise,
      pg: (q) => /^earnings_events/.test(q) ? Promise.resolve(/date=gte/.test(q) ? up : past) : (failIndexes ? Promise.reject(new Error("503")) : Promise.resolve(/ai_summary/.test(q) ? [] : [])) });
    vm.runInContext(PURE + src, ctx); await vm.runInContext("fillEvents(true)", ctx);
    return { transcript: vm.runInContext("transcriptExists('FDX', '2026-06-23')", ctx), callSummary: vm.runInContext("CALLSUM_IDX.has('FDX|2026-06-23')", ctx), redraws }; };
  assert.deepEqual(await run(true), { transcript: true, callSummary: true, redraws: 1 }, "both index reads rejected: the FDX card keeps Transcript and Call summary (the rows still redraw - they were read)");
  assert.deepEqual(await run(false), { transcript: false, callSummary: false, redraws: 1 }, "both index reads SUCCEEDED and returned no calls: that IS an answer, and the controls go");
});

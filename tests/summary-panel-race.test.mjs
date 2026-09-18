import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

/* The REAL handlers (fulltranscript → ernsumclose) run in a VM with deferred requests and a DOM small enough to model what
   matters: setting a host's innerHTML replaces the nodes inside it, and el(id) returns whatever node is on screen NOW.
   Root reproduced the fault on 2026-09-18 with the same construction (evidence/root-0915/summary-race-repro.mjs): a late
   FedEx answer replaced NIO's summary under NIO's title. Rows here carry their full identity, so nothing but the
   request/panel generation can be what stops a stale answer. */
const code = page.slice(page.indexOf('    case "fulltranscript": {'), page.indexOf('\n', page.indexOf('    case "ernsumclose": {')));
const helpers = page.match(/function callDayWindow\(day, n\) \{[\s\S]*?\n\}\n/)[0] + page.match(/function pickCall\(rows, ticker, quarter, day, exactDay\) \{[\s\S]*?\n\}\n/)[0];

function harness() {
  const nodes = {}, pending = [];
  const mkHost = (ids) => { const h = { _html: "" }; Object.defineProperty(h, "innerHTML", { get() { return h._html; }, set(v) { h._html = String(v); ids.forEach((id) => { const m = h._html.match(new RegExp('id="' + id + '"[^>]*>([^<]*)<')); if (m) nodes[id] = { id, innerHTML: "", textContent: m[1] }; else delete nodes[id]; }); } }); return h; };
  nodes.ernSumHost = mkHost(["ernSumBody", "ernSumKind"]); nodes.trFullHost = mkHost(["trFullBody", "trFullKind"]);
  const ctx = vm.createContext({ el: (id) => nodes[id] || null, document: { body: { appendChild() {} }, createElement: () => ({}) }, esc: String, fmtEvDate: String, summaryHTML: String,
    ernSummaryKind: () => ({ head: "EARNINGS SUMMARY", note: "note" }), pg: (q) => new Promise((resolve, reject) => pending.push({ q, resolve, reject })), encodeURIComponent, isFinite, e: { preventDefault() {}, stopPropagation() {} }, a: null, act: "" });
  vm.runInContext(helpers, ctx);
  const click = (act, dataset) => { ctx.act = act; ctx.a = { dataset }; vm.runInContext("switch (act) {" + code + "}", ctx); };
  const tick = () => new Promise((r) => setImmediate(r));
  return { nodes, pending, click, tick };
}
const FDX_CALL = { t: "FDX", d: "2026-06-23", kind: "call", cd: "2026-06-23", q: "Q4 2026" };
const NIO_EVENT = { t: "NIO", d: "2026-09-01" };
const fdxRow = { ticker: "FDX", quarter: "Q4 2026", call_date: "2026-06-23", ai_summary: "FDX STALE SUMMARY" };
const nioRow = { ticker: "NIO", date: "2026-09-01", release_summary: "NIO CURRENT SUMMARY", summary_source: "transcript" };

test("root's case: FedEx call summary opened, closed, NIO opened, FedEx answers late - NIO's text and title stay", async () => {
  const h = harness();
  h.click("ernsum", FDX_CALL); h.click("ernsumclose", {}); h.click("ernsum", NIO_EVENT);
  h.pending[1].resolve([nioRow]); await h.tick();
  const body = h.nodes.ernSumBody.innerHTML, title = h.nodes.ernSumKind.textContent;
  assert.match(body, /NIO CURRENT SUMMARY/); assert.equal(title, " · EARNINGS SUMMARY");
  h.pending[0].resolve([fdxRow]); await h.tick();
  assert.equal(h.nodes.ernSumBody.innerHTML, body, "the late FedEx answer changed nothing");
  assert.equal(h.nodes.ernSumKind.textContent, title);
  assert.doesNotMatch(h.nodes.ernSumBody.innerHTML, /FDX|fulltranscript/);
});

test("the same without a close in between, in both directions, and with the late answer arriving BEFORE the current one", async () => {
  let h = harness(); h.click("ernsum", FDX_CALL); h.click("ernsum", NIO_EVENT);
  h.pending[0].resolve([fdxRow]); await h.tick();
  assert.match(h.nodes.ernSumBody.textContent, /^loading/, "NIO's panel is still loading - FedEx's answer did not fill it");
  h.pending[1].resolve([nioRow]); await h.tick(); assert.match(h.nodes.ernSumBody.innerHTML, /NIO CURRENT SUMMARY/);
  h = harness(); h.click("ernsum", NIO_EVENT); h.click("ernsum", FDX_CALL);
  h.pending[1].resolve([fdxRow]); await h.tick(); h.pending[0].resolve([nioRow]); await h.tick();
  assert.match(h.nodes.ernSumBody.innerHTML, /FDX STALE SUMMARY/, "the panel on screen is FedEx's and shows FedEx's");
  assert.doesNotMatch(h.nodes.ernSumBody.innerHTML, /NIO/); assert.equal(h.nodes.ernSumKind.textContent, " · CALL SUMMARY · Q4 2026", "a late event answer must not retitle a call panel");
});

test("the failure path is guarded too: a late rejection never prints 'failed to load' into another panel", async () => {
  for (const first of [FDX_CALL, NIO_EVENT]) {
    const h = harness(); h.click("ernsum", first); h.click("ernsumclose", {}); h.click("ernsum", first === FDX_CALL ? NIO_EVENT : FDX_CALL);
    h.pending[1].resolve([first === FDX_CALL ? nioRow : fdxRow]); await h.tick(); const body = h.nodes.ernSumBody.innerHTML;
    h.pending[0].reject(new Error("503")); await h.tick();
    assert.equal(h.nodes.ernSumBody.innerHTML, body); assert.notEqual(h.nodes.ernSumBody.textContent, "failed to load.");
  }
  const h = harness(); h.click("ernsum", FDX_CALL); h.pending[0].reject(new Error("503")); await h.tick();
  assert.equal(h.nodes.ernSumBody.textContent, "failed to load.", "the CURRENT panel still reports its own failure");
});

test("an answer for a panel that was closed and not reopened writes nowhere and throws nothing", async () => {
  const h = harness(); h.click("ernsum", FDX_CALL); h.click("ernsumclose", {});
  h.pending[0].resolve([fdxRow]); await h.tick(); assert.equal(h.nodes.ernSumBody, undefined);
  h.click("fulltranscript", { t: "FDX", q: "Q4 2026", d: "2026-06-23" }); h.click("trfullclose", {});
  h.pending[1].reject(new Error("x")); await h.tick(); assert.equal(h.nodes.trFullBody, undefined);
});

test("the requested call only: an absent period is reported as absent, never replaced by another quarter's summary", async () => {
  const h = harness(); h.click("ernsum", { t: "FDX", d: "2026-03-19", kind: "call", cd: "2026-03-19", q: "Q3 2026" });
  assert.match(h.pending[0].q, /^earnings_call_transcripts\?ticker=eq\.FDX&call_date=eq\.2026-03-19&ai_summary=not\.is\.null&select=ticker,quarter,call_date,ai_summary&limit=4$/);
  h.pending[0].resolve([fdxRow]); await h.tick();   // a different quarter's row comes back (this used to be shown: rows[0])
  assert.equal(h.nodes.ernSumBody.textContent, "no call summary on file for this call (Q3 2026)."); assert.equal(h.nodes.ernSumBody.innerHTML, "");
  const g = harness(); g.click("ernsum", NIO_EVENT); g.pending[0].resolve([{ ticker: "KR", date: "2026-09-11", release_summary: "KR TEXT" }]); await g.tick();
  assert.equal(g.nodes.ernSumBody.textContent, "no summary on file.", "an event row for another company or date is not shown under this title");
});

test("the transcript panel: same guard, exact period or the card's own three days, no 'newest' fallback", async () => {
  const h = harness();
  h.click("fulltranscript", { t: "FDX", q: "Q4 2026", d: "2026-06-23" }); h.click("trfullclose", {}); h.click("fulltranscript", { t: "NIO", d: "2026-09-01" });
  assert.match(h.pending[0].q, /ticker=eq\.FDX&quarter=eq\.Q4%202026&select=ticker,transcript,quarter,call_date/);
  assert.match(h.pending[1].q, /ticker=eq\.NIO&call_date=gte\.2026-08-29&call_date=lte\.2026-09-04&select=/, "a card asks for the call within three days of its event, not for the 24 newest");
  h.pending[1].resolve([{ ticker: "NIO", quarter: "Q2 2026", call_date: "2026-09-01", transcript: "NIO CALL TEXT" }]); await h.tick();
  h.pending[0].resolve([{ ticker: "FDX", quarter: "Q4 2026", call_date: "2026-06-23", transcript: "FDX CALL TEXT" }]); await h.tick();
  assert.equal(h.nodes.trFullBody.textContent, "NIO CALL TEXT"); assert.equal(h.nodes.trFullKind.textContent, "Q2 2026 · call 2026-09-01", "and the title says which call it is");
  const g = harness(); g.click("fulltranscript", { t: "FDX", q: "Q2 2026", d: "" }); g.pending[0].resolve([{ ticker: "FDX", quarter: "Q4 2026", call_date: "2026-06-23", transcript: "WRONG QUARTER" }]); await g.tick();
  assert.equal(g.nodes.trFullBody.textContent, "transcript not stored for this call (Q2 2026).", "it used to open the newest call under this title");
  const k = harness(); k.click("fulltranscript", { t: "FDX", q: "", d: "" }); assert.equal(k.pending.length, 0, "no period and no day: no request at all"); assert.equal(k.nodes.trFullBody.textContent, "transcript not stored for this call.");
});

test("every write in both panels goes through the generation check, and closing ends the generation", () => {
  const thens = code.match(/\.then\(\(rows\) => \{\n\s+if \(!live\(\)\) return;/g) || [];
  assert.equal(thens.length, 3, "call summary, event summary, transcript: each answer checks first");
  assert.equal((code.match(/\.catch\(\(\) => \{ if \(live\(\)\) /g) || []).length, 3, "and so does each failure");
  assert.doesNotMatch(code, /\.then\(\(rows\) => \{\s*const b = el\(/, "no answer looks the node up again when it arrives");
  assert.match(code, /const live = \(\) => host\._gen === gen && el\("ernSumBody"\) === b;/);
  assert.match(code, /const live = \(\) => host\._gen === gen && el\("trFullBody"\) === body;/);
  assert.match(code, /case "ernsumclose": \{[^\n]*h\._gen = \(h\._gen \|\| 0\) \+ 1; h\.innerHTML = "";/);
  assert.match(code, /case "trfullclose": \{[^\n]*h\._gen = \(h\._gen \|\| 0\) \+ 1; h\.innerHTML = "";/);
});

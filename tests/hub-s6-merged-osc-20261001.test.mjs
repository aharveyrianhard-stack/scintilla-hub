/* S6 (1 Oct 2026) — the Hub's company chart shows the MERGED RSI + Williams oscillator, and the three stacked when EXPANDED.
   Alan: "wherever we have oscillators on Station and on Hub present the merged; as I expand into more real estate, present the
   individuals." The Station pane draws both (scintilla-widgets _indicators/station-osc-merge.js); the Hub only says which, by
   message, so EXPAND never reloads the chart. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const grab = (name) => {
  const i = html.indexOf("function " + name + "(");
  assert.ok(i >= 0, name);
  let depth = 0, j = html.indexOf("{", i);
  for (let k = j; k < html.length; k++) { if (html[k] === "{") depth++; else if (html[k] === "}" && --depth === 0) return html.slice(i, k + 1); }
  throw new Error("unclosed " + name);
};

test("the Hub tells its Station pane merged or three: on the frame's load and on every EXPAND / COLLAPSE, by message", () => {
  const posted = [];
  const frame = { contentWindow: { postMessage: (data, origin) => posted.push({ data, origin }) } };
  const body = { classList: { on: false, contains: (c) => c === "co-exp" && body.classList.on } };
  const ctx = { document: { body, getElementById: (id) => (id === "coChartFrame" ? frame : null) }, URL,
    STATION_CHART_URL: "https://station.scintillahub.ai/chart/" };
  vm.runInNewContext(grab("coOscTell") + ";this.coOscTell = coOscTell;", ctx);
  ctx.coOscTell();
  body.classList.on = true; ctx.coOscTell();
  assert.deepEqual(JSON.parse(JSON.stringify(posted)), [
    { data: { sc: "osc", split: false }, origin: "https://station.scintillahub.ai" },
    { data: { sc: "osc", split: true }, origin: "https://station.scintillahub.ai" }]);
  /* no frame (the board, a phone without the company view): nothing is sent, nothing throws */
  ctx.document.getElementById = () => null; assert.doesNotThrow(() => ctx.coOscTell());
});

test("wiring: coExpandApply speaks after it sets the class; the frame's load speaks; the chart src carries no osc (no reload)", () => {
  assert.match(grab("coExpandApply"), /classList\.toggle\("co-exp", on\);\n\s+if \(typeof coOscTell === "function"\) coOscTell\(\);/);
  assert.match(html, /document\.addEventListener\("load", \(e\) => \{ if \(e\.target && e\.target\.id === "coChartFrame"\) coOscTell\(\); \}, true\);/);
  assert.doesNotMatch(grab("coChartSrc"), /osc/);
  assert.match(grab("coChartSrc"), /&rsi=/, "the pane is still asked for the full fan (?rsi=1), which S6 draws as the merged set");
});

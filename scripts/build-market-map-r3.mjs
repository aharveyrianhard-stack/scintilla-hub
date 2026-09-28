#!/usr/bin/env node
/* MARKET-MAP r3 (28 Sep) — the node list the r3 tree reads: deliverables/20260928/market-map-r3/nodes.json

   Same structure as the 27 Sep map (deliverables/20260927/market-map/nodes.json, built by scripts/build-market-map.mjs, is
   copied node for node — no node is added, dropped or moved). One thing is added per fund that has a holdings file:
   `holdings.served_weights`, every holding the Hub serves (in /universe) with its weight in the fund, so the page can blend
   the holdings' live Geigers into ONE aggregate bar and say how much of the fund's weight that covers.

   Inputs (read-only): the 27 Sep node list; fund holdings from FMP, 26 Sep, 51 funds —
   ~/Library/Application Support/scintilla/market-map/pplx-holdings.js (a copy sits in the node list's provenance line).
   No Geiger, price or change is stored: the page reads those live.

   Usage: node scripts/build-market-map-r3.mjs */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "deliverables/20260927/market-map/nodes.json");
const OUT = join(ROOT, "deliverables/20260928/market-map-r3/nodes.json");
const HOLDINGS = join(homedir(), "Library/Application Support/scintilla/market-map/pplx-holdings.js");

const base = JSON.parse(readFileSync(SRC, "utf8"));
const { HOLD, HOLD_SRC } = new Function(readFileSync(HOLDINGS, "utf8") + ";return {HOLD,NAMES,HOLD_SRC}")();
const SERVED = new Set(base.provenance.universe.symbols);
const usTicker = (t) => (/^[A-Z]{1,5}\.[A-Z]$/.test(t) ? t.replace(".", "-") : t); // FMP writes BRK.B, the Hub BRK-B
const r4 = (x) => Math.round(x * 1e4) / 1e4;

let funds = 0;
const nodes = base.nodes.map((n) => {
  if (n.kind !== "fund" || !n.holdings || !HOLD[n.ticker]) return n;
  const rows = HOLD[n.ticker].h;
  const total = rows.reduce((s, [, w]) => s + w, 0);
  const served = new Map(); // a ticker listed twice (rare in FMP files) is one line with the summed weight
  for (const [t, w] of rows) { const u = usTicker(t); if (SERVED.has(u)) served.set(u, (served.get(u) || 0) + w); }
  const sw = [...served].map(([t, w]) => [t, r4(w)]).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  funds++;
  return {
    ...n,
    holdings: {
      ...n.holdings,
      rows_in_file: rows.length,
      total_weight_pct: r4(total),
      served_weights: sw,
      top: n.holdings.top.map((h) => ({ ...h, served: SERVED.has(h.ticker) })),
    },
  };
});

const out = {
  ...base,
  artifact_kind: "SCINTILLA_MARKET_MAP_NODES_R3",
  built_utc: new Date().toISOString(),
  what: "The 27 Sep node list, unchanged, plus each fund's served holdings with their weights (for the holdings aggregate bar). Structure only: no Geiger, price or change is stored here — the page reads those live.",
  provenance: {
    ...base.provenance,
    structure: { source: "deliverables/20260927/market-map/nodes.json", built_utc: base.built_utc },
    holdings: { ...base.provenance.holdings, served_weights_for_funds: funds, source_file: "~/Library/Application Support/scintilla/market-map/pplx-holdings.js", source_label: HOLD_SRC },
  },
  nodes,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(OUT, JSON.stringify({ nodes: nodes.length, funds_with_served_weights: funds }));

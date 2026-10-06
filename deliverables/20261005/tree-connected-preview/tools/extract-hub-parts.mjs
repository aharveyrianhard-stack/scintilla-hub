#!/usr/bin/env node
/* T13 (5 Oct 2026) · ONE SOURCE for the tree's atoms. Alan, 5 Oct: "'A · today' is boxy, pixelated, looks like 1970… The Hub bar
   looks so much better." So the tree page draws NO bar, type, cell, table head or tab row of its own: this script copies the Hub's
   exact CSS rules out of the Hub page (index.html at the repo root) into hub-parts.css, with the source line of every block, and
   the tree page links that file. Re-run it whenever the Hub's CSS changes; tests/tree-standard-t13.test.mjs checks that the file
   equals what this script would write now, so the copy can never drift from the Hub.
   What is copied (selector → the Hub part it is):
     :root { … }                          the Hub's design tokens (--bg --ink --dim --mute --crk --bull --bear --mono …)
     .ctabs / .ct / .ct.on                the cohort tab row (the open tab underlined in cyan) — the tree's view tabs and MY LISTS
     .sc-mtabs / .sc-mtab                 the master tab row (hairline cyan frame, 10 px .18em uppercase)
     .mytab …                             the ConsensusDetail table: 8.5 px uppercase heads, .6 px separators, tabular numbers
     .gsum .gs-comp .gs-cgr …             the company GEIGER tile's composite track (9 px, #15151d, a 1 px dim centre line)
     .gsum .gs-comp .gs-big / .gs-lab     the composite number (--gt-big 19 px) and its 8.5 px label
   node tools/extract-hub-parts.mjs            writes ../hub-parts.css
   node tools/extract-hub-parts.mjs --check    exits 1 when hub-parts.css differs from what the Hub says now */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url)), TREE = resolve(HERE, ".."), ROOT = resolve(TREE, "../../..");
export const HUB_PATH = resolve(ROOT, "index.html");
export const OUT_PATH = resolve(TREE, "hub-parts.css");
export const WANT = [":root", ".ctabs", ".ct", ".ct:last-child", ".ct.on", ".sc-mtabs", ".sc-mtab", ".sc-mtab:last-child", ".sc-mtab:hover",
  ".mytab", ".mytab th", ".mytab th:first-child,.mytab td:first-child", ".mytab th:first-child", ".mytab th.cur,.mytab td.cur", ".mytab td", ".mytab td:first-child", ".mytab td.neg",
  ".gsum .gs-comp .gs-lab", ".gsum .gs-comp .gs-cgr", ".gsum .gs-comp .gs-cgr::before", ".gsum .gs-comp .gs-cgr i", ".gsum .gs-comp .gs-big"];
/* the FIRST rule in the Hub's CSS whose selector list, with its spaces squeezed, equals the wanted selector; the whole `{ … }` block,
   verbatim (comments inside kept), with the line it starts on */
export function extract(hub) {
  const lines = hub.split("\n"), found = new Map();
  const squeeze = (s) => s.replace(/\s+/g, " ").replace(/\s*,\s*/g, ",").trim();
  let inStyle = false;
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (/<style/.test(L)) inStyle = true; if (/<\/style>/.test(L)) inStyle = false;
    if (!inStyle) continue;
    const m = L.match(/^\s*([^{}\/@][^{}]*?)\s*\{/); if (!m) continue;
    const sel = squeeze(m[1]); if (!WANT.includes(sel) || found.has(sel)) continue;
    // the block runs from this line to the line that closes it (depth counting from the first brace)
    let depth = 0, text = [], j = i, started = false;
    for (; j < lines.length; j++) { for (const ch of lines[j]) { if (ch === "{") { depth++; started = true; } else if (ch === "}") depth--; } text.push(lines[j]); if (started && depth === 0) break; }
    found.set(sel, { line: i + 1, css: text.join("\n") });
  }
  const missing = WANT.filter((s) => !found.has(s));
  const body = WANT.filter((s) => found.has(s)).map((s) => `/* ${s} · index.html:${found.get(s).line} */\n${found.get(s).css}`).join("\n\n");
  const css = `/* hub-parts.css — the Hub's own CSS for the tree's atoms, COPIED by tools/extract-hub-parts.mjs from the Hub page (index.html at the
   repo root). Do not edit by hand: re-run the script. T13 (5 Oct 2026), Alan: option A (the tree's own drawings) is rejected; the Hub's
   look is the standard for every flat part. Every block below is byte-for-byte the Hub's rule, with its source line. */\n\n${body}\n`;
  return { css, missing, found };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { css, missing } = extract(readFileSync(HUB_PATH, "utf8"));
  if (missing.length) { console.error("not found in the Hub page:", missing.join(" | ")); process.exit(2); }
  if (process.argv.includes("--check")) { const cur = (() => { try { return readFileSync(OUT_PATH, "utf8"); } catch { return ""; } })(); if (cur !== css) { console.error("hub-parts.css differs from the Hub's CSS now — re-run tools/extract-hub-parts.mjs"); process.exit(1); } console.log("hub-parts.css = the Hub's CSS"); }
  else { writeFileSync(OUT_PATH, css); console.log(`wrote hub-parts.css: ${WANT.length} blocks, ${css.length} bytes`); }
}

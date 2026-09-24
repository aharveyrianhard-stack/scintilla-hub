/* ONE RULES FILE, TWO READERS. data/scintilla-rules.json is the file Alan edits: the Hub fetches
   it straight from the site. A Supabase edge function is deployed with only its own folder, so it
   cannot fetch the site's file at start-up — it carries a generated copy instead, and
   tests/scintillas-rules.test.mjs fails if the two ever drift.

   Change a threshold:  edit data/scintilla-rules.json  ->  node scripts/build-scintilla-rules.mjs  */
import fs from "node:fs";

const src = new URL("../data/scintilla-rules.json", import.meta.url);
const out = new URL("../supabase/functions/scintillas-detect/rules.mjs", import.meta.url);
const rules = JSON.parse(fs.readFileSync(src, "utf8"));
fs.writeFileSync(out,
  "/* GENERATED from data/scintilla-rules.json by scripts/build-scintilla-rules.mjs — do not edit by hand.\n" +
  "   The rules file is the one Alan changes; this copy exists only because an edge function ships\n" +
  "   with its own folder and cannot read the site's file. A test pins the two together. */\n" +
  "export const RULES = Object.freeze(" + JSON.stringify(rules, null, 2) + ");\n" +
  "export const RULES_VERSION = " + JSON.stringify(rules.version) + ";\n");
console.log("rules " + rules.version + " -> " + out.pathname.split("/").slice(-4).join("/"));

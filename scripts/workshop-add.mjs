#!/usr/bin/env node
/* Add a leaf to the workshop's branch map, or check the manifest.
   The workshop page (/workshop/) draws itself from workshop/manifest.json and nothing else, so a lane that
   ships a page adds ONE entry here and the page is current. Nobody edits workshop/index.html by hand.

   node scripts/workshop-add.mjs --id ladder-20260927 --area statistics --title "Statistics · the ladder" \
        --href /deliverables/20260927/ladder/LADDER.html --status read --date 2026-09-27 \
        --blurb "If you bought at RSI level 5, 10 … 70, how did it go" [--ask "YES / NO"] [--lane S8] [--supersedes between-reports]
   node scripts/workshop-add.mjs --check          # validate only (the test runs the same checks)
   node scripts/workshop-add.mjs --status archive --id old-thing   # change one field on an existing leaf (any of the fields below)

   Fields: id (unique, kebab-case), area (one of the manifest's areas), title, blurb, href (site path or https URL; may be
   omitted while a thing is still being built), status (one of the manifest's statuses), date (YYYY-MM-DD, the day it landed
   or last changed), ask (the question on a decision card), lane (who built it), supersedes (id of the leaf this replaces:
   that leaf is set to archive automatically). */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "workshop", "manifest.json");
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith("--")) { const k = a.slice(2); const v = process.argv[i + 1]; if (v === undefined || v.startsWith("--")) args[k] = true; else { args[k] = v; i++; } } }

export function validate(m, root = ROOT) {
  const errs = [];
  if (m.artifact_kind !== "SCINTILLA_WORKSHOP_MANIFEST") errs.push("artifact_kind must be SCINTILLA_WORKSHOP_MANIFEST");
  const areas = new Set((m.areas || []).map((a) => a.id)), statuses = new Set(Object.keys(m.statuses || {}));
  if (!areas.size) errs.push("no areas"); if (!statuses.size) errs.push("no statuses");
  for (const a of m.areas || []) for (const k of ["id", "label", "blurb"]) if (!a[k]) errs.push(`area ${a.id || "?"} lacks ${k}`);
  const ids = new Set();
  for (const it of m.items || []) {
    const tag = `item ${it.id || "?"}`;
    if (!it.id || !/^[a-z0-9][a-z0-9-]*$/.test(it.id)) errs.push(`${tag}: id must be kebab-case`);
    if (ids.has(it.id)) errs.push(`${tag}: duplicate id`); ids.add(it.id);
    if (!areas.has(it.area)) errs.push(`${tag}: unknown area ${it.area}`);
    if (!statuses.has(it.status)) errs.push(`${tag}: unknown status ${it.status}`);
    for (const k of ["title", "blurb"]) if (!it[k] || typeof it[k] !== "string") errs.push(`${tag}: lacks ${k}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(it.date || "") || Number.isNaN(Date.parse(it.date))) errs.push(`${tag}: date must be YYYY-MM-DD`);
    if (it.status === "decision" && !it.ask) errs.push(`${tag}: a decision needs an ask`);
    if (it.supersedes && !(m.items || []).some((o) => o.id === it.supersedes)) errs.push(`${tag}: supersedes an unknown id ${it.supersedes}`);
    if (it.href != null) {
      if (typeof it.href !== "string" || !(it.href.startsWith("/") || it.href.startsWith("https://"))) errs.push(`${tag}: href must start with / or https://`);
      else if (it.href.startsWith("/")) {
        const path = it.href.split(/[?#]/)[0]; const local = join(root, path.endsWith("/") ? path + "index.html" : path);
        if (!existsSync(local)) errs.push(`${tag}: href ${path} is not in this repo (a Station or preview address should be a full https:// URL)`);
      }
    } else if (it.status !== "building") errs.push(`${tag}: only a leaf that is still being built may lack an href`);
  }
  return errs;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const m = JSON.parse(readFileSync(FILE, "utf8"));
  if (!args.check) {
    if (!args.id) { console.error("--id is required (or --check)"); process.exit(2); }
    let it = m.items.find((x) => x.id === args.id);
    const fields = ["area", "title", "blurb", "href", "status", "date", "ask", "lane", "supersedes"];
    if (!it) { it = { id: args.id }; m.items.push(it); }
    for (const k of fields) if (typeof args[k] === "string") it[k] = args[k];
    if (it.supersedes) { const old = m.items.find((x) => x.id === it.supersedes); if (old && old.status !== "archive") old.status = "archive"; }
    m.items.sort((a, b) => (b.date || "").localeCompare(a.date || "") || a.id.localeCompare(b.id));
  }
  const errs = validate(m);
  if (errs.length) { console.error("manifest problems:\n  " + errs.join("\n  ")); process.exit(1); }
  if (!args.check) { writeFileSync(FILE, JSON.stringify(m, null, 1) + "\n"); console.log(`ok · ${m.items.length} leaves · wrote workshop/manifest.json`); }
  else console.log(`ok · ${m.items.length} leaves · ${m.areas.length} branches`);
}

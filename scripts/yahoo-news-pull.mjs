#!/usr/bin/env node
/* SCINTILLA · M63 — the Yahoo headline pull. WRITTEN, NOT RUN in this unit.
 *
 * It reads Yahoo's per-ticker RSS (no key, no account, no scraping) and writes rows into
 * public.news with feed='yahoo'. Everything it decides lives in lib/yahoo-news.mjs, which is pure
 * and tested offline against a saved feed; this file only reads, waits politely and writes.
 *
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   read from the environment, never printed, never sent
 *                                             anywhere except the database itself
 *   node scripts/yahoo-news-pull.mjs AAPL BE NVDA          one pass over those names
 *   node scripts/yahoo-news-pull.mjs --favourites          the names in hub_favorites
 *   --dry                                                  parse and report, write nothing
 *
 * BOUNDED BY CONSTRUCTION: one request per name, at most MAX_NAMES names, GAP_MS apart. On a 429
 * or a 5xx it stops that pass rather than retrying in a loop — Yahoo is a courtesy, not a contract.
 */
import { yahooRows, YAHOO_URL } from "../lib/yahoo-news.mjs";

const SB = process.env.SUPABASE_URL || "";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const MAX_NAMES = 80, GAP_MS = 1200, UA = "SCINTILLA/1.0 (+news collector; contact: the hub owner)";
const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sb(path, init) {
  const r = await fetch(SB + "/rest/v1/" + path, {
    ...init,
    headers: { apikey: KEY, Authorization: "Bearer " + KEY, "content-type": "application/json", ...(init?.headers || {}) },
  });
  if (!r.ok) throw new Error("supabase -> " + r.status + " " + (await r.text()).slice(0, 160));
  return r.status === 204 ? null : r.json();
}

async function names() {
  const given = argv.filter((a) => !a.startsWith("--"));
  if (given.length) return given.map((s) => s.toUpperCase());
  if (!argv.includes("--favourites")) throw new Error("name the tickers, or pass --favourites");
  const rows = await sb("hub_favorites?select=ticker&limit=200");
  return [...new Set(rows.map((r) => String(r.ticker).toUpperCase()))];
}

const report = { asked: 0, rows: 0, written: 0, skipped: {}, errors: [] };

for (const tk of (await names()).slice(0, MAX_NAMES)) {
  try {
    const r = await fetch(YAHOO_URL(tk), { headers: { "user-agent": UA, accept: "application/rss+xml,application/xml" } });
    report.asked++;
    if (r.status === 429 || r.status >= 500) { report.errors.push(tk + ": " + r.status + " — pass stopped"); break; }
    if (!r.ok) { report.errors.push(tk + ": " + r.status); await sleep(GAP_MS); continue; }
    const { rows, skipped } = yahooRows({ ticker: tk, xml: await r.text() });
    report.rows += rows.length;
    for (const s of skipped) report.skipped[s.reason] = (report.skipped[s.reason] || 0) + 1;
    if (rows.length && !DRY) {
      /* (ticker, url) is the key: the same story from the Google collector is the same row, so a
         duplicate is ignored rather than counted twice or overwritten. */
      await sb("news?on_conflict=ticker,url", {
        method: "POST", body: JSON.stringify(rows),
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      });
      report.written += rows.length;
    }
  } catch (e) {
    report.errors.push(tk + ": " + String(e.message || e).slice(0, 120));
  }
  await sleep(GAP_MS);
}
console.log(JSON.stringify({ ...report, dry: DRY }, null, 1));

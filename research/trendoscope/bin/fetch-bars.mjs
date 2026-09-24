#!/usr/bin/env node
// Bar extraction for the pilot cohort at every packet timeframe, with provenance, content
// hashes and a bucket-anchor audit. Read-only GETs against the chart API. No price table is
// written. The full series go to extracts/bars/ ; the manifest pins each series' sha256 so a
// clean re-run can be verified byte-for-byte.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fetchBars, etParts, regularSessionBars } from "../lib/bars.mjs";
import { fileURLToPath } from "node:url";
import { sha256, canonicalJson } from "../lib/settings.mjs";

const OUT = fileURLToPath(new URL("../extracts/", import.meta.url));
const cohort = JSON.parse(readFileSync(`${OUT}cohort.json`, "utf8"));
const TFS = cohort.timeframes;
mkdirSync(`${OUT}bars`, { recursive: true });

const manifest = [];
for (const c of cohort.cohort) {
  for (const tf of TFS) {
    try {
      const ex = await fetchBars(c.symbol, tf, { limit: 5000 });
      writeFileSync(`${OUT}bars/${c.symbol}-${tf}.json`, JSON.stringify({
        symbol: ex.symbol, timeframe: ex.timeframe, api_tf: ex.api_tf, bar_count: ex.bar_count,
        bars_sha256: ex.bars_sha256, provenance: ex.provenance, session_mode: ex.session_mode,
        adjustment_mode: ex.adjustment_mode, fetched_utc: ex.fetched_utc, bars: ex.bars,
      }));
      // Which ET hours do bar opens land on? That is the bucket anchor, stated not assumed.
      const hours = new Map();
      for (const b of ex.bars) {
        const { hour, minute } = etParts(b.t);
        const k = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        hours.set(k, (hours.get(k) ?? 0) + 1);
      }
      const rth = regularSessionBars(ex.bars).length;
      manifest.push({
        symbol: c.symbol, cell: c.cell, timeframe: tf, api_tf: ex.api_tf,
        bar_count: ex.bar_count, bars_sha256: ex.bars_sha256,
        first_epoch: ex.bars[0]?.t ?? null, last_epoch: ex.bars.at(-1)?.t ?? null,
        first_et: ex.et_first, last_et: ex.et_last,
        et_open_hours: Object.fromEntries([...hours].sort()),
        bars_opening_inside_0930_1600_et: rth,
        bars_opening_outside_0930_1600_et: ex.bar_count - rth,
        full_series_count_upstream: ex.provenance.full_series_count,
        session_mode: ex.session_mode, adjustment_mode: ex.adjustment_mode,
        provenance: ex.provenance,
      });
      process.stderr.write(`${c.symbol} ${tf}: ${ex.bar_count} bars\n`);
    } catch (e) {
      manifest.push({ symbol: c.symbol, cell: c.cell, timeframe: tf, error: String(e.message).slice(0, 200) });
      process.stderr.write(`${c.symbol} ${tf}: FAILED ${e.message}\n`);
    }
  }
}
const payload = { generated_utc: new Date().toISOString(), seed: cohort.seed,
  universe_snapshot: cohort.universe_snapshot, cohort_sha256: cohort.cohort_sha256,
  api: "https://scintilla-massive-chart-api.fly.dev/candles (read-only GET, Origin https://scintillahub.ai)",
  session_note: "The API serves ONE stream and ignores session/extended/rth parameters; session_anchor is recorded verbatim. A regular-session-only run cannot be requested from this source.",
  series: manifest };
payload.manifest_sha256 = sha256(canonicalJson(manifest));
writeFileSync(`${OUT}bars-manifest.json`, JSON.stringify(payload, null, 1));
const ok = manifest.filter((m) => !m.error);
console.log(`series ok=${ok.length} failed=${manifest.length - ok.length} total bars=${ok.reduce((s, m) => s + m.bar_count, 0)}`);
console.log(`manifest_sha256 ${payload.manifest_sha256}`);

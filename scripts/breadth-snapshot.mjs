/* MARKET BREADTH, measured over our own 364 names (lane M30).
   Alan, 23 Sep: "This rally was really low breadth — we need to start considering
   market breadth more in our mix."

   Breadth cannot be read from one number on a screen: it needs a daily bar for every
   name we hold. That is 364 requests to the chart API, which is far too much for a
   page load, so it is measured here and written to data/breadth/ as a dated snapshot.
   The page reads the snapshot and always prints when it was measured, so a stale
   reading looks stale instead of looking current.

   Reads only. It never writes to a price table and never calls any other provider.
     node scripts/breadth-snapshot.mjs [--limit N] [--out data/breadth]
*/
import fs from "node:fs";
import path from "node:path";

const API = process.env.SC_CHART_API || "https://scintilla-massive-chart-api.fly.dev";
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const OUT = arg("--out", "data/breadth");
const LIMIT = +arg("--limit", 0) || 0;
const CONC = +arg("--concurrency", 8);

const sma = (a, n) => (a.length < n ? null : a.slice(-n).reduce((s, x) => s + x, 0) / n);

async function getJSON(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) { last = e; await new Promise((s) => setTimeout(s, 400 * (i + 1))); }
  }
  throw last;
}

/* one name: 260 daily bars is a year plus the 200-day average's run-up */
async function measure(sym) {
  const j = await getJSON(API + "/candles?symbol=" + encodeURIComponent(sym) + "&tf=1d&limit=260");
  const s = Array.isArray(j.series) ? j.series : [];
  if (s.length < 60) return { sym, state: "TOO_SHORT", bars: s.length };
  const closes = s.map((b) => +b.c).filter(Number.isFinite);
  const last = s[s.length - 1];
  const c = +last.c;
  const s50 = sma(closes, 50), s200 = sma(closes, 200);
  /* a 52-week extreme is measured against the 252 sessions BEFORE today, so today
     making a new high means today's high beat every one of them — not "equals its
     own high", which every bar does. */
  const prior = s.slice(-253, -1);
  const priorHigh = prior.length >= 200 ? Math.max(...prior.map((b) => +b.h)) : null;
  const priorLow = prior.length >= 200 ? Math.min(...prior.map((b) => +b.l)) : null;
  return {
    sym, state: "OK", bars: s.length,
    session: new Date(+last.t).toISOString().slice(0, 10),
    close: c,
    sma50: s50, sma200: s200,
    above50: s50 == null ? null : c > s50,
    above200: s200 == null ? null : c > s200,
    newHigh: priorHigh == null ? null : +last.h > priorHigh,
    newLow: priorLow == null ? null : +last.l < priorLow,
  };
}

async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch (e) { out[k] = { sym: items[k], state: "ERROR", error: String(e && e.message || e) }; } }
  }));
  return out;
}

const u = await getJSON(API + "/universe");
let syms = Array.isArray(u.symbols) ? u.symbols : [];
if (LIMIT) syms = syms.slice(0, LIMIT);
process.stderr.write("measuring " + syms.length + " names…\n");
const t0 = Date.now();
const rows = await pool(syms, CONC, measure);

const ok = rows.filter((r) => r && r.state === "OK");
/* the session the snapshot belongs to is the one MOST names closed on; names whose
   newest bar is older than that are counted as behind, never silently averaged in */
const tally = new Map();
for (const r of ok) tally.set(r.session, (tally.get(r.session) || 0) + 1);
const session = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
const cur = ok.filter((r) => r.session === session);
const behind = ok.length - cur.length;
const count = (k) => cur.filter((r) => r[k] === true).length;
const have = (k) => cur.filter((r) => r[k] !== null).length;

const snap = {
  measured_utc: new Date().toISOString(),
  measured_ms: Date.now() - t0,
  source: API + "/candles?tf=1d&limit=260 · one request per name",
  universe: u.count ?? syms.length,
  universe_sha256: u.universe_sha256 || null,
  session_et: session,
  measured: cur.length,
  behind_session: behind,
  failed: rows.filter((r) => r && r.state !== "OK").map((r) => ({ sym: r.sym, state: r.state, error: r.error || null })),
  above50: { n: count("above50"), of: have("above50"), pct: have("above50") ? Math.round((1000 * count("above50")) / have("above50")) / 10 : null },
  above200: { n: count("above200"), of: have("above200"), pct: have("above200") ? Math.round((1000 * count("above200")) / have("above200")) / 10 : null },
  new_highs: count("newHigh"), new_lows: count("newLow"), extremes_of: have("newHigh"),
  high_low_net: count("newHigh") - count("newLow"),
  names_new_high: cur.filter((r) => r.newHigh).map((r) => r.sym).sort(),
  names_new_low: cur.filter((r) => r.newLow).map((r) => r.sym).sort(),
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "latest.json"), JSON.stringify(snap, null, 1) + "\n");
const hp = path.join(OUT, "history.json");
const hist = fs.existsSync(hp) ? JSON.parse(fs.readFileSync(hp, "utf8")) : { readings: [] };
const row = { session_et: snap.session_et, measured_utc: snap.measured_utc, measured: snap.measured,
  above50_pct: snap.above50.pct, above200_pct: snap.above200.pct, new_highs: snap.new_highs, new_lows: snap.new_lows };
hist.readings = hist.readings.filter((r) => r.session_et !== row.session_et).concat([row]).sort((a, b) => String(a.session_et).localeCompare(String(b.session_et))).slice(-260);
fs.writeFileSync(hp, JSON.stringify(hist, null, 1) + "\n");
process.stderr.write("session " + snap.session_et + " · " + snap.measured + " names · above50 " + snap.above50.pct + "% · above200 " + snap.above200.pct + "% · " + snap.new_highs + " new highs / " + snap.new_lows + " new lows · " + Math.round(snap.measured_ms / 1000) + "s\n");

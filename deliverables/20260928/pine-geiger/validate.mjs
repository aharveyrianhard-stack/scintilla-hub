/* N8 · PINE GEIGER TABLE — validation. GET only (chart API); writes validation.json beside this file.
     node deliverables/20260928/pine-geiger/validate.mjs
   TradingView cannot be run from here, so the check has three parts, each on the chart API's own bars:
   A · BUCKETS  — rebuild 3h/4h/6h/12h from the API's 30-minute bars with the Pine script's New York clock
                  rule, and 3D/W from its D bars with the calendar rule; compare with the bars the API serves.
   B · DAILY    — does the API's D bar equal a regular-session (09:30–16:00) roll-up of its 30-minute bars?
                  (TradingView's daily bar is the regular session, so this says whether the two are built alike.)
   C · MATHS    — run a line-for-line port of the Pine rung maths and Equalizer mean on the served rung bars
                  (the forming bar dropped by the same clock rule) and compare with live /geiger, rung by rung. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { rungRead } from "./pine-port.mjs";

const API = "https://scintilla-massive-chart-api.fly.dev", HDR = { Origin: "https://scintillahub.ai" };
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SYMS = ["SPY", "QQQ", "IWM", "DIA", "RSP", "XLK", "XLE", "XLF", "XLV", "XLU"];
const W = { "3h": 1.235817, "4h": 2.278755, "6h": 3.178477, "12h": 3.172702, "1d": 3.178477, "3d": 2.576738, "1w": 0.987499 };
const TOK = { "3h": "180", "4h": "240", "6h": "6h", "12h": "12h", "1d": "D", "3d": "3D", "1w": "W" };

const DAY = 864e5;

async function get(url) {
  for (let a = 0; a < 4; a++) {
    try { const r = await fetch(url, { headers: HDR, signal: AbortSignal.timeout(60000) }); if (r.ok) return await r.json(); } catch (_) {}
    await new Promise((z) => setTimeout(z, 800 * (a + 1)));
  }
  throw new Error("GET failed " + url);
}
const candles = async (s, tf, limit = 230) => (await get(`${API}/candles?symbol=${s}&tf=${encodeURIComponent(tf)}&limit=${limit}&authority=provider`)).series || [];

/* ---------- New York clock helpers (the Pine script's year/month/dayofmonth/hour in "America/New_York") ---------- */
const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
function ny(t) { const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value])); return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute }; }
/** timestamp("America/New_York", y, mo, d, h, 0) */
function nyTs(y, mo, d, h) {
  let guess = Date.UTC(y, mo - 1, d, h + 5);
  for (let k = 0; k < 3; k++) { const p = ny(guess); guess += (Date.UTC(y, mo - 1, d, h) - Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi)); }
  return guess;
}
function clockBucket(t, nh) {
  const p = ny(t), k = Math.floor(p.h / nh), s = nyTs(p.y, p.mo, p.d, k * nh);
  const e = (k + 1) * nh >= 24 ? nyTs(p.y, p.mo, p.d, 0) + DAY : nyTs(p.y, p.mo, p.d, (k + 1) * nh);
  return { s, e };
}
const epochDay = (t) => { const p = ny(t); return Math.floor(Date.UTC(p.y, p.mo - 1, p.d) / DAY); };
const dkey = (t) => { const p = ny(t); return p.y * 10000 + p.mo * 100 + p.d; };

/* ---------- Pine port: rollRung over a bar list; returns completed buckets as of `now` ---------- */
function roll(bars, bidOf, doneOf) {
  const out = []; let cur = null;
  for (const b of bars) {
    const id = bidOf(b.t);
    if (!cur || id !== cur.id) { if (cur) out.push(cur); cur = { id, t: b.t, o: +b.o, h: +b.h, l: +b.l, c: +b.c }; }
    else { cur.h = Math.max(cur.h, +b.h); cur.l = Math.min(cur.l, +b.l); cur.c = +b.c; }
  }
  if (cur && doneOf(cur)) out.push(cur);
  return out;
}

const report = { run_utc: new Date().toISOString(), symbols: SYMS, buckets: {}, daily: {}, maths: {} };
const eq = (a, b) => Math.abs(a - b) < 1e-9;

for (const s of SYMS) {
  const now = Date.now();
  /* A · intraday buckets from the API's 30-minute bars (only the ~7 days the API serves at limit 230) */
  const m30 = await candles(s, "30");
  const bk = {};
  for (const [key, nh] of [["3h", 3], ["4h", 4], ["6h", 6], ["12h", 12]]) {
    const served = await candles(s, TOK[key]);
    const rebuilt = roll(m30, (t) => clockBucket(t, nh).s, (c) => now >= clockBucket(c.t, nh).e);
    const byT = new Map(served.map((b) => [b.t, b]));
    let cmp = 0, same = 0; const diffs = [];
    for (const r of rebuilt.slice(1)) {             // the first rebuilt bucket may start before the 30-minute data does
      const v = byT.get(r.id); if (!v) { diffs.push({ t: new Date(r.id).toISOString(), missing: true }); continue; }
      cmp++; if (eq(v.o, r.o) && eq(v.h, r.h) && eq(v.l, r.l) && eq(v.c, r.c)) same++; else diffs.push({ t: new Date(r.id).toISOString(), served: [v.o, v.h, v.l, v.c], rebuilt: [r.o, r.h, r.l, r.c] });
    }
    const lastServed = served.at(-1)?.t, lastRebuilt = rebuilt.at(-1)?.id;
    bk[key] = { compared: cmp, identical: same, newest_served: new Date(lastServed).toISOString(), newest_rebuilt: new Date(lastRebuilt).toISOString(), diffs: diffs.slice(0, 4) };
  }
  /* A · 3D and W from D (the served D history, 1,500 bars) */
  const d = await candles(s, "D", 1500);
  for (const [key, bidOf] of [["3d", (t) => Math.floor((epochDay(t) - 2) / 3)], ["1w", (t) => Math.floor((epochDay(t) + 4) / 7)]]) {
    const served = await candles(s, TOK[key]);
    const today = epochDay(now);
    const rebuilt = roll(d, bidOf, (c) => bidOf(c.t) < bidOf(today * DAY + DAY / 2));
    const tail = rebuilt.slice(1);  // skip the oldest (it may be cut by the 1,500-bar D window)
    const byT = new Map(served.map((b) => [bidOf(b.t), b]));   // served bars carry the bucket's first calendar day (W: Sunday)
    let cmp = 0, same = 0; const diffs = [];
    for (const r of tail) { const v = byT.get(r.id); if (!v) continue; cmp++;
      if (eq(v.h, r.h) && eq(v.l, r.l) && eq(v.c, r.c)) same++; else diffs.push({ t: new Date(r.t).toISOString().slice(0, 10), served: [v.h, v.l, v.c], rebuilt: [r.h, r.l, r.c] }); }
    bk[key] = { compared: cmp, identical_hlc: same, newest_served: new Date(served.at(-1).t).toISOString().slice(0, 10), newest_rebuilt: new Date(rebuilt.at(-1).t).toISOString().slice(0, 10), diffs: diffs.slice(0, 4) };
  }
  report.buckets[s] = bk;

  /* B · is D a regular-session bar? compare with a 09:30–16:00 roll-up of the 30-minute bars */
  const rth = new Map();
  for (const b of m30) { const p = ny(b.t), mins = p.h * 60 + p.mi; if (mins < 570 || mins >= 960) continue;
    const k = dkey(b.t), r = rth.get(k); if (!r) rth.set(k, { o: +b.o, h: +b.h, l: +b.l, c: +b.c }); else { r.h = Math.max(r.h, +b.h); r.l = Math.min(r.l, +b.l); r.c = +b.c; } }
  const dRows = [];
  for (const b of d.slice(-8)) { const r = rth.get(dkey(b.t)); if (!r) continue;
    dRows.push({ day: dkey(b.t), D: [b.o, b.h, b.l, b.c], rth30: [r.o, r.h, r.l, r.c], match: { o: eq(b.o, r.o), h: eq(b.h, r.h), l: eq(b.l, r.l), c: eq(b.c, r.c) } }); }
  report.daily[s] = dRows;
}

/* C · maths on the served rung bars vs live /geiger */
const g = await get(`${API}/geiger?symbols=${SYMS.join(",")}&detail=1`);
report.geiger_computed_utc = g.computed_utc; report.equalizer_receipt_sha256 = g.equalizer_receipt_sha256;
report.participating_rungs = g.participating_rungs;
for (const s of SYMS) {
  const live = g.symbols[s], rows = {}; let ws = 0, sc = 0, st = 0, sm = 0, wm = 0;
  const liveNewestD = live.rungs["1d"]?.newest;
  for (const key of Object.keys(W)) {
    const lr = live.rungs[key]; if (!lr || lr.availability === "ABSENT") { rows[key] = { live: "ABSENT" }; continue; }
    // the bars the publisher read: the served series cut at the same newest bar
    const bars = await candles(s, TOK[key]);
    const cut = bars.filter((b) => b.t <= Date.parse(lr.newest)).slice(-230);
    const r = rungRead(cut.map((x) => +x.c), cut.map((x) => +x.h), cut.map((x) => +x.l));
    rows[key] = { newest: lr.newest, bars: cut.length, pine: r && { trend: +r.trend.toFixed(6), mom: r.mom == null ? null : +r.mom.toFixed(6), comp: +r.comp.toFixed(6) },
      live: { trend: lr.trend_signed, mom: lr.momentum_signed, comp: lr.tf_composite } };
    if (r) { ws += W[key]; sc += W[key] * r.comp; st += W[key] * r.trend; if (r.mom != null) { sm += W[key] * r.mom; wm += W[key]; } }
  }
  report.maths[s] = { rungs: rows, pine: { composite: sc / ws, trend: st / ws, momentum: wm ? sm / wm : null },
    live: { composite: live.composite, trend: live.trend, momentum: live.momentum }, live_newest_1d: liveNewestD };
}

fs.writeFileSync(path.join(HERE, "validation.json"), JSON.stringify(report, null, 1));
for (const s of SYMS) {
  const m = report.maths[s], b = report.buckets[s];
  console.log(s.padEnd(4), "G pine", m.pine.composite.toFixed(4), "live", m.live.composite.toFixed(4), "Δ", (m.pine.composite - m.live.composite).toExponential(1),
    "| buckets", Object.entries(b).map(([k, v]) => `${k} ${v.identical ?? v.identical_hlc}/${v.compared}`).join(" "),
    "| D=RTH", report.daily[s].filter((r) => r.match.h && r.match.l && r.match.c).length + "/" + report.daily[s].length);
}

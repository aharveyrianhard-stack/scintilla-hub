/* CLAUDE CHECK BUILDS · M60 — the five small ideas from the deep pass, as pure functions.
   No fetch, no clock, no database: everything a row shows is passed in, so every number on the
   page can be recomputed by hand from what sits beside it. The fetching lives in
   scripts/claude-check-snapshot.mjs; the wording lives in data/claude-check-rules.json.

   THE RULE THAT RUNS THROUGH ALL FIVE. Nothing here invents a number. Too little history, a
   missing bar or a flat stretch returns null WITH A REASON, never a guess. Anything that is a
   rule of thumb rather than something we counted is tagged "estimate"; anything counted on our
   own bars is tagged "measured", with the count beside it. */

export const TAG = Object.freeze({ MEASURED: "measured", ESTIMATE: "estimate" });

const num = (v) => { const n = typeof v === "number" ? v : parseFloat(v); return Number.isFinite(n) ? n : null; };
const r2 = (n) => (n == null ? null : Math.round(n * 100) / 100);
const r3 = (n) => (n == null ? null : Math.round(n * 1000) / 1000);
export const median = (xs) => {
  const a = xs.filter(Number.isFinite).slice().sort((x, y) => x - y);
  if (!a.length) return null;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
export const quantile = (xs, q) => {
  const a = xs.filter(Number.isFinite).slice().sort((x, y) => x - y);
  if (!a.length) return null;
  const i = (a.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (i - lo);
};
export const sma = (a, n) => (a.length < n ? null : a.slice(-n).reduce((s, x) => s + x, 0) / n);

/* ---------- 1. ONE WORD PER MEASURE ------------------------------------------------------
   A band list turns a measure into one word. The list is data, not code, so Alan can change the
   wording or the cut-offs without touching this file. Bands are read in order: the first one
   whose floor the value reaches wins. A verdict never appears without the number that made it. */
export function verdictFor(value, rule, { basis = null, rows = [] } = {}) {
  const v = num(value);
  if (!rule || !Array.isArray(rule.bands) || !rule.bands.length) {
    return { word: null, reason: "NO_RULE", measure: rule?.measure ?? null, value: v, basis, rows };
  }
  if (v == null) {
    return { word: null, reason: "NO_VALUE", measure: rule.measure, value: null, basis, rows,
      says: rule.when_missing || "not measured yet" };
  }
  const bands = rule.bands.slice().sort((a, b) => (b.from ?? -Infinity) - (a.from ?? -Infinity));
  const hit = bands.find((b) => v >= (b.from ?? -Infinity)) ?? bands[bands.length - 1];
  return {
    word: hit.word, reason: null, measure: rule.measure, value: v, unit: rule.unit ?? "",
    band_from: hit.from ?? null, says: hit.says ?? null, basis, rows,
    rule_id: rule.id, tag: rule.tag ?? TAG.MEASURED,
  };
}

/* The same measure, read twice: once through Alan's saved settings and once through the plain
   baseline, so the card shows what his own choices are doing to the word. */
export function verdictPair(values, rule) {
  return {
    saved: verdictFor(values.saved, rule, { basis: values.saved_basis || "Alan's saved Equalizer" }),
    baseline: verdictFor(values.baseline, rule, { basis: values.baseline_basis || "baseline: every rung, equal weight" }),
    differs: num(values.saved) != null && num(values.baseline) != null &&
      verdictFor(values.saved, rule).word !== verdictFor(values.baseline, rule).word,
  };
}

/* ---------- 2. WAITING TIME PER RUNG -----------------------------------------------------
   The post's numbers are a rule of thumb. Ours are counted on our own bars when there are
   enough of them: a signal on that rung, then how many days until the move showed up. Anything
   we could not count keeps the rule of thumb and says so. */
export const RULE_OF_THUMB = Object.freeze({
  "4h": { low_days: 4, high_days: 10, source: "@asklivermore, 23 Sep bookmark" },
  "1d": { low_days: 8, high_days: 20, source: "@asklivermore, 23 Sep bookmark" },
  "1w": { low_days: 60, high_days: 150, source: "@asklivermore, 23 Sep bookmark (2–5 months)" },
});

export function waitFor(rung, measuredByRung = {}) {
  const m = measuredByRung[rung];
  if (m && Number.isFinite(m.n) && m.n >= (m.min_n ?? 30) && m.median_days != null) {
    return {
      rung, tag: TAG.MEASURED, n: m.n,
      median_days: r2(m.median_days), low_days: r2(m.p25_days), high_days: r2(m.p75_days),
      hit_rate: m.hit_rate == null ? null : r3(m.hit_rate),
      says: `${r2(m.p25_days)}–${r2(m.p75_days)} days, middle ${r2(m.median_days)}`,
      how: m.how, window: m.window,
    };
  }
  const t = RULE_OF_THUMB[rung];
  if (!t) {
    return { rung, tag: null, reason: "NOT_MEASURED_NO_RULE_OF_THUMB",
      says: "we have not counted this rung and the post gives no number for it",
      n: m?.n ?? 0, why: m?.why ?? null };
  }
  return { rung, tag: TAG.ESTIMATE, n: m?.n ?? 0, median_days: null,
    low_days: t.low_days, high_days: t.high_days,
    says: `${t.low_days}–${t.high_days} days`, source: t.source,
    why: m?.why || "not enough signals on our own bars to count this rung" };
}

/* The counting itself: a signal bar, then the first later bar that reached the move. Both the
   signal and the move are stated in the result, so a different definition can be tried without
   guessing what this one meant. */
export function measureWaits(bars, { signalAt, movePct = null, moveAtr = 1, atrWindow = 20, horizonBars = 40 }) {
  /* The move a rung is asked for is ITS OWN usual bar, not a fixed percentage. A 3% move is a
     fortnight's work on a weekly chart and an afternoon's on a two-hour one, so a fixed number
     would make the rungs look identical when they are not. Same rule as the scintilla detectors:
     divide by the subject's own usual movement. */
  const tr = trueRanges(bars);
  const waits = [], misses = [];
  for (let i = atrWindow; i < bars.length; i++) {
    if (!signalAt(bars, i)) continue;
    const from = bars[i], c = +from.c;
    const atr = tr.slice(i - atrWindow, i).reduce((s, x) => s + x, 0) / atrWindow;
    if (!(atr > 0)) continue;
    const target = movePct != null ? c * (1 + movePct / 100) : c + moveAtr * atr;
    let hit = null;
    for (let j = i + 1; j <= Math.min(i + horizonBars, bars.length - 1); j++) {
      if (+bars[j].h >= target) { hit = bars[j]; break; }
    }
    if (hit) waits.push((+hit.t - +from.t) / 86400000);
    else misses.push(+from.t);
  }
  const n = waits.length + misses.length;
  return {
    n, hits: waits.length, hit_rate: n ? waits.length / n : null,
    median_days: median(waits), p25_days: quantile(waits, 0.25), p75_days: quantile(waits, 0.75),
    days: waits,
    target_basis: movePct != null ? `a fixed ${movePct}% move` : `${moveAtr}x the rung's own usual bar (${atrWindow}-bar true range)`,
  };
}

/* ---------- 3. PARTICIPATION --------------------------------------------------------------
   The share of names trading above their own 50-day average, counted per session. A name only
   counts on a date once it has fifty bars of its own; a name that is short of history is left
   out and counted in `of`, never treated as a no. */
export function participationBySession(perSymbol, { window = 50 } = {}) {
  const tally = new Map();
  for (const { closes, sessions } of perSymbol) {
    for (let i = window - 1; i < closes.length; i++) {
      const avg = closes.slice(i - window + 1, i + 1).reduce((s, x) => s + x, 0) / window;
      const d = sessions[i];
      const t = tally.get(d) || { above: 0, of: 0 };
      t.of++; if (closes[i] > avg) t.above++;
      tally.set(d, t);
    }
  }
  return [...tally.entries()]
    .map(([session, t]) => ({ session, above: t.above, of: t.of, pct: t.of ? (100 * t.above) / t.of : null }))
    .sort((a, b) => String(a.session).localeCompare(String(b.session)));
}

/* One reading a week: the last session of each week, so a weekly chart never mixes a Wednesday
   with a Friday. `minOf` keeps a thin day (a holiday, or a fetch that half-failed) off the line. */
export function weekly(series, { minOf = 1 } = {}) {
  const byWeek = new Map();
  for (const row of series) {
    if (!row.session || (row.of ?? 0) < minOf) continue;
    const d = new Date(row.session + "T00:00:00Z");
    const th = new Date(d); th.setUTCDate(d.getUTCDate() + (3 - ((d.getUTCDay() + 6) % 7)));
    const key = th.toISOString().slice(0, 10);
    const prev = byWeek.get(key);
    if (!prev || String(row.session) > String(prev.session)) byWeek.set(key, row);
  }
  return [...byWeek.entries()].map(([week, row]) => ({ week, ...row }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

/* The peaks line. A peak is a reading higher than everything within `span` weeks either side.
   The line is a least-squares fit through those peaks only — it says whether each rally has
   topped out on more names or fewer. Fewer than three peaks: no line, and it says why. */
export function peakLine(weeklySeries, { span = 6, minPeaks = 3 } = {}) {
  const pts = weeklySeries.filter((r) => Number.isFinite(r.pct));
  const peaks = pts.filter((r, i) => {
    const lo = Math.max(0, i - span), hi = Math.min(pts.length - 1, i + span);
    for (let j = lo; j <= hi; j++) if (j !== i && pts[j].pct >= r.pct) return false;
    return true;
  });
  if (peaks.length < minPeaks) {
    return { peaks, line: null, reason: "TOO_FEW_PEAKS", says: `only ${peaks.length} peaks in this window` };
  }
  const xs = peaks.map((p) => Date.parse(p.week + "T00:00:00Z") / 86400000);
  const ys = peaks.map((p) => p.pct);
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length, my = ys.reduce((s, y) => s + y, 0) / ys.length;
  const den = xs.reduce((s, x) => s + (x - mx) * (x - mx), 0);
  if (!(den > 0)) return { peaks, line: null, reason: "PEAKS_ON_ONE_DATE" };
  const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / den;
  const at = (week) => my + slope * (Date.parse(week + "T00:00:00Z") / 86400000 - mx);
  return {
    peaks, line: { slope_per_year: r2(slope * 365.25), intercept_at: at(peaks[0].week), at },
    direction: slope < 0 ? "thinner" : slope > 0 ? "broader" : "flat",
    says: slope < 0 ? "each rally has been topping out on fewer names"
      : slope > 0 ? "each rally has been topping out on more names" : "flat",
    tag: TAG.MEASURED, n_peaks: peaks.length,
  };
}

/* ---------- 4. THE SQUEEZE ---------------------------------------------------------------
   Band width is the distance between the two Bollinger bands as a share of the middle line, so a
   $30 name and a $900 name can sit in the same list. Then the width is ranked against that same
   name's own past widths — never against another name's. */
export function bollWidth(closes, { n = 20, k = 2 } = {}) {
  const out = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < n - 1) { out.push(null); continue; }
    const w = closes.slice(i - n + 1, i + 1);
    const m = w.reduce((s, x) => s + x, 0) / n;
    const sd = Math.sqrt(w.reduce((s, x) => s + (x - m) * (x - m), 0) / n);
    out.push(m > 0 ? (2 * k * sd) / m : null);
  }
  return out;
}

export function squeezeState(widths, sessions, { lookback = 252, tightPct = 5, minRank = 120 } = {}) {
  const idx = widths.map((w, i) => ({ w, i })).filter((x) => Number.isFinite(x.w));
  if (idx.length < 40) return { width: null, reason: "TOO_LITTLE_HISTORY", have: idx.length, need: 40 };
  const last = idx[idx.length - 1];
  const hist = idx.slice(Math.max(0, idx.length - 1 - lookback), idx.length - 1);
  /* A name with half a year behind it can be at the bottom of its own short history and still be
     nothing special. Rank it only once there is enough past to rank against, and say so otherwise
     rather than printing a percentile that means less than it looks. */
  if (hist.length < minRank) {
    return { width: r3(last.w * 100), session: sessions[last.i], pctile: null, lookback: hist.length,
      reason: "TOO_SHORT_TO_RANK", need: minRank, candidate: false,
      says: `only ${hist.length} sessions of its own to compare with — not ranked`, tag: TAG.MEASURED };
  }
  const below = hist.filter((x) => x.w < last.w).length;
  const pct = hist.length ? (100 * below) / hist.length : null;
  let since = null, sinceIdx = null;
  for (let j = hist.length - 1; j >= 0; j--) if (hist[j].w <= last.w) { sinceIdx = hist[j].i; since = sessions[hist[j].i]; break; }
  return {
    width: r3(last.w * 100), pctile: r2(pct), lookback: hist.length,
    session: sessions[last.i],
    tightest_since: since, tightest_since_bars: sinceIdx == null ? null : last.i - sinceIdx,
    tightest_in_lookback: since == null,
    candidate: pct != null && pct <= tightPct,
    says: since == null
      ? `the tightest in all ${hist.length} sessions we hold`
      : `the tightest since ${since}`,
    tag: TAG.MEASURED,
  };
}

/* ---------- 5. UNFINISHED BUSINESS -------------------------------------------------------
   A wick far longer than the bar's recent usual range, whose ground price has not been walked
   back over since. Up-wick: price spiked above and left; it is unfinished while no later bar has
   traded back into the middle of that spike. Down-wick is the mirror. The test is stated on the
   row so it can be checked by eye against the chart. */
export function trueRanges(bars) {
  const out = [];
  for (let i = 0; i < bars.length; i++) {
    const h = +bars[i].h, l = +bars[i].l, pc = i ? +bars[i - 1].c : null;
    out.push(pc == null ? h - l : Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return out;
}

export function unfinishedWicks(bars, { lookback = 20, minWickAtr = 1.5, fillAt = 0.5, maxAgeBars = 260 } = {}) {
  const tr = trueRanges(bars), levels = [];
  for (let i = lookback; i < bars.length - 1; i++) {
    const b = bars[i], o = +b.o, c = +b.c, h = +b.h, l = +b.l;
    const atr = tr.slice(i - lookback, i).reduce((s, x) => s + x, 0) / lookback;
    if (!(atr > 0)) continue;
    const bodyTop = Math.max(o, c), bodyLow = Math.min(o, c);
    for (const side of ["up", "down"]) {
      const wick = side === "up" ? h - bodyTop : bodyLow - l;
      if (!(wick >= minWickAtr * atr)) continue;
      const level = side === "up" ? h : l;
      const test = side === "up" ? bodyTop + fillAt * wick : bodyLow - fillAt * wick;
      let tradedBack = null;
      for (let j = i + 1; j < bars.length; j++) {
        if (side === "up" ? +bars[j].h >= test : +bars[j].l <= test) { tradedBack = bars[j].t; break; }
      }
      if (tradedBack) continue;
      if (bars.length - 1 - i > maxAgeBars) continue;
      levels.push({
        t: b.t, session: b.session ?? null, side, level: r2(level), test: r2(test),
        wick_atr: r2(wick / atr), atr: r2(atr), bars_standing: bars.length - 1 - i,
        distance_pct: r2((100 * (level - +bars[bars.length - 1].c)) / +bars[bars.length - 1].c),
        says: side === "up"
          ? `spiked to ${r2(level)} and left; nothing has traded back up to ${r2(test)} since`
          : `spiked down to ${r2(level)} and left; nothing has traded back down to ${r2(test)} since`,
        tag: TAG.MEASURED,
      });
    }
  }
  return levels.sort((a, b) => b.t - a.t);
}

/* ---------- shared: the house indicator -------------------------------------------------
   RSI(14) the Wilder way, the same one data/how-unusual.json already uses, so a signal counted
   here means what a reading on the Hub means. */
export function rsiWilder(closes, n = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length <= n) return out;
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const d = closes[i] - closes[i - 1]; d >= 0 ? (g += d) : (l -= d); }
  let ag = g / n, al = l / n;
  out[n] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (n - 1) + Math.max(d, 0)) / n;
    al = (al * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return out;
}

/* The signal we count for waiting time: the reading leaves oversold — it was under 30 on the bar
   before and is over 30 now. One definition, used on every rung, so the rungs are comparable. */
export function oversoldExitSignals(bars, { n = 14, level = 30 } = {}) {
  const rsi = rsiWilder(bars.map((b) => +b.c), n);
  return (b, i) => rsi[i] != null && rsi[i - 1] != null && rsi[i - 1] < level && rsi[i] >= level;
}

/* ---------- the rails: each instrument's own state ---------------------------------------
   The Hub's macro rail is eight instruments. A rail says where it stands against its own
   averages and which way it closed — nothing borrowed from another name. */
export function railState(bars, { window50 = 50, window200 = 200 } = {}) {
  const closes = bars.map((b) => +b.c).filter(Number.isFinite);
  if (closes.length < window50 + 1) return { state: null, reason: "TOO_LITTLE_HISTORY", have: closes.length };
  const c = closes[closes.length - 1], prev = closes[closes.length - 2];
  const s50 = sma(closes, window50), s200 = closes.length >= window200 ? sma(closes, window200) : null;
  const pct50 = s50 ? (100 * (c - s50)) / s50 : null;
  return {
    close: c, day_pct: prev ? (100 * (c - prev)) / prev : null,
    sma50: s50, sma200: s200,
    above50: s50 == null ? null : c > s50, above200: s200 == null ? null : c > s200,
    distance50_pct: pct50 == null ? null : Math.round(pct50 * 100) / 100,
    bars: closes.length, tag: TAG.MEASURED,
  };
}

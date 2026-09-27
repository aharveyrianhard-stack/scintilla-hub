/* Scintilla · K1 knockout workshop · the arithmetic, stated once.
   Pure functions: no fetch, no clock, no DOM. The page and the tests import this same file.

   Definitions:
   · a metric row on the FIELD holds one value per name still in the round; the BAND is that
     row's lowest and highest value, the TICK is its median. A name off the field is out of
     the round and takes no part in the band or the median.
   · median of n values: the middle one, or the mean of the two middle ones. null values are
     not values; a row with no values has no band.
   · P/E on the FY estimate = price / the average analyst EPS for the first fiscal year that
     ends on or after today. Negative or zero EPS gives no multiple ("—"), never a negative one.
   · revenue growth, next FY = the analyst revenue estimate for the fiscal year after the first
     one that ends on or after today, over that first one, minus one.
   · sessions between two dates count weekdays after the first date up to and including the
     second. Exchange holidays are not subtracted; the page says so.
   · a sigma event is a finished daily bar whose move, as a multiple of the usual day,
     is at least 2 (the rules file's own bar: about one day in twenty).
   · cap class comes from the cohort tags (MEGA_CAP, LARGE_CAP, MID_CAP, SMALL_CAP) when there
     is one, otherwise from market value at the allocation tool's line: under $10B is small. */

export const METRICS = [
  /* better: which way a name WINS a round-robin game on this row. plays: in the round robin by default.
     Size rows (revenue, market value) describe, they do not judge, so they sit out unless the operator puts them in.
     The Geiger and the usual day are timing (round 3), so they sit out of the comps round robin too. */
  { key: "pe_ttm",        label: "P/E, trailing",                 unit: "x", fmt: "x",      low_is: "cheaper",  better: "low",  plays: true },
  { key: "pe_adj",        label: "P/E, adjusted",                 unit: "x", fmt: "x",      low_is: "cheaper",  better: "low",  plays: false },
  { key: "pe_fwd",        label: "P/E on the FY estimate",        unit: "x", fmt: "x",      low_is: "cheaper",  better: "low",  plays: true },
  { key: "eps_growth",    label: "EPS growth, next FY est",       unit: "%", fmt: "pct",    high_is: "faster",  better: "high", plays: true },
  { key: "rev_ttm",       label: "Revenue, TTM",                  unit: "$", fmt: "money",                      better: null,   plays: false },
  { key: "rev_growth",    label: "Revenue growth, next FY est",   unit: "%", fmt: "pct",    high_is: "faster",  better: "high", plays: true },
  { key: "target_upside", label: "Analyst target over price",     unit: "%", fmt: "pct",    high_is: "more room", better: "high", plays: true },
  { key: "mcap",          label: "Market value",                  unit: "$", fmt: "money",                      better: null,   plays: false },
  { key: "net_debt",      label: "Net debt, last FY",             unit: "$", fmt: "money",  low_is: "lighter",  better: "low",  plays: true },
  { key: "geiger",        label: "Geiger (board source)",         unit: "",  fmt: "signed", direction: true, low_is: "colder", better: "low", plays: false },
  { key: "usual",         label: "Usual day, 60 sessions",        unit: "%", fmt: "pct1",   low_is: "calmer",   better: "low",  plays: false },
];
export const metric = (key) => METRICS.find((m) => m.key === key);

export const CAP_TAGS = ["MEGA_CAP", "LARGE_CAP", "MID_CAP", "SMALL_CAP"];
export const CAP_LABEL = { MEGA_CAP: "mega cap", LARGE_CAP: "large cap", MID_CAP: "mid cap", SMALL_CAP: "small cap" };
export const SIGMA_X = 2;          // the rules file's bar, same as the board's heartbeat
export const SIGMA_LOOKBACK = 20;  // finished sessions looked back for sigma events
export const CAP_LINE_USD = 10e9;  // the allocation tool's small/large line (tickerCls)

/* Editable defaults for ROUND 1 · FIT. Alan's own reasons, in his words, are the seeds. */
export const DEFAULT_PREFS = {
  cap_floor_usd: 10e9,
  cap_floor_reason: "not comfortable going into small caps like those in this environment",
  needs_earnings: true,
  needs_earnings_reason: "a name has to earn something before its multiple means anything",
  themes_out: { URANIUM: "nuclear — its time will come, not right now" },
  themes_care: { UTILITIES: "utilities are super cheap, but rising rates are a bad environment for them — handle with care" },
  reports_within_sessions: 20,
  class_toggle: "LARGE_ONLY",   // the allocation tool's cap-class toggle, see CLASS_TOGGLE
  risk_level: "MEDIUM",         // the allocation tool's risk level, see RISK_LEVEL
  care_is_out: false,           // set by the risk level: at LOW, a handle-with-care theme is out
};

/* The allocation tool's two toggles, as the brief names them: which cap class may play, and how
   much risk. Here they are presets over the same editable rules — choosing one rewrites the rules
   it owns and nothing else, so the operator can still change any rule by hand afterwards. */
export const CLASS_TOGGLE = {
  LARGE_ONLY:      { cap_floor_usd: CAP_LINE_USD, label: "large cap only",  why: "the allocation tool's line: under $10B is small" },
  LARGE_AND_SMALL: { cap_floor_usd: 0,            label: "large and small", why: "no floor — a small cap may play" },
};
export const RISK_LEVEL = {
  LOW:    { needs_earnings: true,  care_is_out: true,  label: "low",    why: "a name must earn, and every handle-with-care theme is out" },
  MEDIUM: { needs_earnings: true,  care_is_out: false, label: "medium", why: "a name must earn; handle-with-care themes stay in, flagged" },
  HIGH:   { needs_earnings: false, care_is_out: false, label: "high",   why: "no earnings rule; every theme not marked out may play" },
};
export function applyToggles(prefs, { cls, risk } = {}) {
  const next = { ...prefs };
  if (cls && CLASS_TOGGLE[cls]) { next.cap_floor_usd = CLASS_TOGGLE[cls].cap_floor_usd; next.class_toggle = cls; }
  if (risk && RISK_LEVEL[risk]) { next.needs_earnings = RISK_LEVEL[risk].needs_earnings; next.care_is_out = RISK_LEVEL[risk].care_is_out; next.risk_level = risk; }
  return next;
}

export const num = (v) => (v == null || v === "" || !isFinite(Number(v))) ? null : Number(v);

export function median(values) {
  const v = values.map(num).filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Band + tick for one metric over the names still in. */
export function band(values) {
  const v = values.map(num).filter((x) => x != null);
  if (!v.length) return { min: null, max: null, median: null, n: 0 };
  return { min: Math.min(...v), max: Math.max(...v), median: median(v), n: v.length };
}

/** One FIELD row. names: [{ticker, value}], out: Set of tickers knocked out.
    Points for every name (in or out) with x in 0..1 across the band of the names IN. */
export function fieldRow(names, out = new Set()) {
  const inRows = names.filter((n) => !out.has(n.ticker));
  const b = band(inRows.map((n) => n.value));
  const span = (b.max != null && b.max !== b.min) ? b.max - b.min : null;
  const points = names.map((n) => {
    const v = num(n.value);
    let x = null;
    if (v != null && b.min != null) x = span ? Math.min(1, Math.max(0, (v - b.min) / span)) : 0.5;
    return { ticker: n.ticker, value: v, x, in: !out.has(n.ticker), off_band: v != null && b.min != null && (v < b.min || v > b.max) };
  });
  const tick = (b.median != null && b.min != null) ? (span ? (b.median - b.min) / span : 0.5) : null;
  return { ...b, tick, points };
}

/** Knock a name out, or bring it back. Returns a new Set; the old one is untouched. */
export function toggleOut(out, ticker) {
  const next = new Set(out);
  if (next.has(ticker)) next.delete(ticker); else next.add(ticker);
  return next;
}

/* ---- derived numbers ------------------------------------------------------------------- */

export function firstFY(estimates, todayISO) {
  const rows = (estimates || []).filter((e) => e.period === "annual" && e.fiscal_date >= todayISO)
    .sort((a, b) => a.fiscal_date.localeCompare(b.fiscal_date));
  return rows;
}

export function forwardPE(price, estimates, todayISO) {
  const p = num(price);
  const [fy] = firstFY(estimates, todayISO);
  if (p == null || !fy) return { value: null, fiscal_date: fy?.fiscal_date ?? null, eps: null, analysts: null, reason: fy ? "no price" : "no estimate on file" };
  const eps = num(fy.est_eps_avg);
  if (eps == null || eps <= 0) return { value: null, fiscal_date: fy.fiscal_date, eps, analysts: fy.num_analysts_eps ?? null, reason: "estimated EPS is not positive" };
  return { value: p / eps, fiscal_date: fy.fiscal_date, eps, analysts: fy.num_analysts_eps ?? null, reason: null };
}

export function revenueGrowth(estimates, todayISO) {
  const [a, b] = firstFY(estimates, todayISO);
  const ra = num(a?.est_revenue_avg), rb = num(b?.est_revenue_avg);
  if (ra == null || rb == null || ra <= 0) return { value: null, from: a?.fiscal_date ?? null, to: b?.fiscal_date ?? null, reason: "two revenue estimates are needed" };
  return { value: (rb / ra - 1) * 100, from: a.fiscal_date, to: b.fiscal_date, analysts: b.num_analysts_rev ?? null, reason: null };
}

export function epsGrowth(estimates, todayISO) {
  const [a, b] = firstFY(estimates, todayISO);
  const ea = num(a?.est_eps_avg), eb = num(b?.est_eps_avg);
  if (ea == null || eb == null) return { value: null, from: a?.fiscal_date ?? null, to: b?.fiscal_date ?? null, reason: "two EPS estimates are needed" };
  if (ea <= 0) return { value: null, from: a.fiscal_date, to: b.fiscal_date, reason: "the first-year estimate is not positive, so growth on it means nothing" };
  return { value: (eb / ea - 1) * 100, from: a.fiscal_date, to: b.fiscal_date, analysts: b.num_analysts_eps ?? null, reason: null };
}

/** The average analyst price target (carried on the estimates rows) against the price: room to the target, in %. */
export function targetUpside(price, estimates, todayISO) {
  const p = num(price);
  const [fy] = firstFY(estimates, todayISO);
  const t = num(fy?.price_target_avg);
  if (p == null || p <= 0 || t == null || t <= 0) return { value: null, target: t, reason: t == null ? "no target on file" : "no price" };
  return { value: (t / p - 1) * 100, target: t, reason: null };
}

export function capClass(tags, marketCap) {
  const t = (tags || []).find((x) => CAP_TAGS.includes(x));
  if (t) return { tag: t, label: CAP_LABEL[t], from: "cohort tag" };
  const m = num(marketCap);
  if (m == null) return { tag: null, label: "size unknown", from: "no market value on file" };
  return { tag: m < CAP_LINE_USD ? "SMALL_CAP" : "LARGE_CAP", label: m < CAP_LINE_USD ? "small cap" : "large cap", from: "market value against the $10B line" };
}

/** Weekdays after `fromISO`, up to and including `toISO`. Holidays are not subtracted. */
export function sessionsBetween(fromISO, toISO) {
  const a = new Date(fromISO + "T00:00:00Z"), b = new Date(toISO + "T00:00:00Z");
  if (!(a < b)) return 0;
  let n = 0;
  for (let d = new Date(a.getTime() + 86400e3); d <= b; d = new Date(d.getTime() + 86400e3)) {
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) n++;
  }
  return n;
}

export function calendarDays(fromISO, toISO) {
  return Math.round((Date.parse(toISO + "T00:00:00Z") - Date.parse(fromISO + "T00:00:00Z")) / 86400e3);
}

/** Sigma events over the last `lookback` finished bars. closes: oldest → newest. */
export function sigmaEvents(closes, usualPct, { k = SIGMA_X, lookback = SIGMA_LOOKBACK } = {}) {
  const u = num(usualPct);
  const c = (closes || []).map(num);
  if (u == null || u <= 0 || c.length < 2) return { count: null, events: [], checked: 0, reason: u == null ? "no usual day on file" : "not enough bars" };
  const moves = [];
  for (let i = 1; i < c.length; i++) if (c[i - 1] > 0 && c[i] != null) moves.push({ i, move: (c[i] / c[i - 1] - 1) * 100 });
  const window = moves.slice(-lookback);
  const events = window.filter((m) => Math.abs(m.move) / u >= k).map((m) => ({ ...m, x: Math.abs(m.move) / u }));
  return { count: events.length, events, checked: window.length, reason: null };
}

export function ageDays(dateISO, todayISO) {
  if (!dateISO) return null;
  const t = Date.parse(String(dateISO).slice(0, 10) + "T00:00:00Z");
  const n = Date.parse(todayISO + "T00:00:00Z");
  return isFinite(t) && isFinite(n) ? Math.floor((n - t) / 86400e3) : null;
}

/* ---- ROUND 1 · FIT, in full sentences ---------------------------------------------------- */

/** row: {ticker, mcap, mcap_date, eps_ttm, eps_date, tags[]}; prefs: DEFAULT_PREFS shape.
    Returns {in, care, why[]}: `why` holds one full sentence per rule that spoke. */
export function fit(row, prefs = DEFAULT_PREFS) {
  const why = [];
  let out = false;
  if (row.is_etf) {
    why.push(`${row.ticker} is a fund, not a company: it stays on the table as the group's reference and takes no part in the rounds.`);
    return { in: false, care: [], why };
  }
  const cap = num(row.mcap);
  if (prefs.cap_floor_usd > 0) {
    if (cap == null) {
      out = true;
      why.push(`${row.ticker} is out of this round: it has no market value on file, so it cannot clear the ${money(prefs.cap_floor_usd)} floor you set.`);
    } else if (cap < prefs.cap_floor_usd) {
      out = true;
      why.push(`${row.ticker} is out of this round: its market value is ${money(cap)} (measured ${dateWord(row.mcap_date)}), below the ${money(prefs.cap_floor_usd)} floor you set — ${prefs.cap_floor_reason}.`);
    }
  }
  if (prefs.needs_earnings) {
    const e = num(row.eps_ttm);
    if (e == null || e <= 0) {
      out = true;
      why.push(`${row.ticker} is out of this round: it has no trailing earnings yet (EPS ${e == null ? "not on file" : e.toFixed(2)}${row.eps_date ? ", measured " + dateWord(row.eps_date) : ""}), and you asked for names that earn — ${prefs.needs_earnings_reason}.`);
    }
  }
  const rowTags = row.all_tags || row.tags || [];
  for (const [theme, reason] of Object.entries(prefs.themes_out || {})) {
    if (rowTags.includes(theme)) {
      out = true;
      why.push(`${row.ticker} is out of this round: it is tagged ${themeWord(theme)}, and you marked that theme out — ${reason}.`);
    }
  }
  const care = [];
  for (const [theme, reason] of Object.entries(prefs.themes_care || {})) {
    if (!rowTags.includes(theme)) continue;
    if (prefs.care_is_out) {
      out = true;
      why.push(`${row.ticker} is out of this round: it is tagged ${themeWord(theme)}, which you marked handle with care — ${reason} — and at low risk, care means out.`);
    } else care.push(`${row.ticker} stays in, with care: it is tagged ${themeWord(theme)} — ${reason}.`);
  }
  if (!out && !care.length) why.push(`${row.ticker} stays in: ${money(cap)} of market value, trailing EPS ${num(row.eps_ttm)?.toFixed(2)}, no theme you marked out.`);
  return { in: !out, care, why: out ? why : why.concat(care) };
}

/* ---- words and numbers ------------------------------------------------------------------ */

export function money(v) {
  const n = num(v);
  if (n == null) return "—";
  const a = Math.abs(n), s = n < 0 ? "−" : "";
  if (a >= 1e12) return s + "$" + (a / 1e12).toFixed(2) + "T";
  if (a >= 1e9) return s + "$" + (a / 1e9).toFixed(a >= 1e11 ? 0 : 1) + "B";
  if (a >= 1e6) return s + "$" + (a / 1e6).toFixed(a >= 1e8 ? 0 : 1) + "M";
  return s + "$" + a.toFixed(0);
}
export function fmtMetric(metric, v) {
  const n = num(v);
  if (n == null) return "—";
  switch (metric.fmt) {
    case "x": return n.toFixed(1) + "x";
    case "money": return money(n);
    case "pct": return (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(0) + "%";
    case "pct1": return "±" + n.toFixed(1) + "%";
    case "signed": return (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(2);
    default: return String(n);
  }
}
export function themeWord(tag) { return String(tag || "").replace(/_/g, " ").replace(/&/g, "and").toLowerCase(); }
export function dateWord(iso) {
  if (!iso) return "date unknown";
  const d = new Date(String(iso).slice(0, 10) + "T00:00:00Z");
  if (!isFinite(d)) return String(iso);
  return d.getUTCDate() + " " + ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()];
}
export function tsToISO(ts) {
  if (ts == null) return null;
  const n = num(ts);
  const d = n != null && n < 1e12 ? new Date(n * 1000) : new Date(n != null ? n : ts);
  return isFinite(d) ? d.toISOString().slice(0, 10) : null;
}

/** Assemble one name's row from the raw Hub reads. Every number keeps its own date. */
export function buildRow(src, todayISO) {
  const f = src.fundamentals || {}, hb = src.heartbeat || {}, g = src.geiger || {}, p = src.profile || {};
  const bal = src.balance || {}, q = src.quote || {};
  const all_tags = [...new Set(src.cohorts || [])];
  const tags = all_tags.filter((c) => c !== src.cohort);   // for the chips: the group's own name is already the first chip
  const fwd = forwardPE(num(q.price) ?? f.price, src.estimates, todayISO);
  const growth = revenueGrowth(src.estimates, todayISO);
  const egrowth = epsGrowth(src.estimates, todayISO);
  const upside = targetUpside(num(q.price) ?? f.price, src.estimates, todayISO);
  const estDate = tsToISO((src.estimates || []).map((e) => e.updated_ts).filter(Boolean).sort().pop());
  const next = (src.earnings || []).filter((e) => e.date >= todayISO).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
  const fDate = tsToISO(f.updated_ts);
  return {
    ticker: src.ticker, name: p.name || null, industry: p.industry || null, tags, all_tags,
    is_etf: !!p.is_etf, position: src.position ?? null,
    cap: capClass(tags, f.market_cap),
    price: num(q.price) ?? num(f.price), price_date: q.price_observation_utc ? String(q.price_observation_utc).slice(0, 10) : fDate,
    price_from: q.price != null ? "chart API quote" : "fundamentals row",
    mcap: num(f.market_cap), mcap_date: fDate,
    eps_ttm: num(f.eps_ttm), eps_date: fDate,
    metrics: {
      pe_ttm: (num(f.trailing_pe) != null && f.trailing_pe > 0) ? num(f.trailing_pe) : null,
      pe_adj: (num(f.adjusted_pe) != null && f.adjusted_pe > 0) ? num(f.adjusted_pe) : null,
      pe_fwd: fwd.value,
      eps_growth: egrowth.value,
      rev_ttm: num(f.revenue_ttm),
      rev_growth: growth.value,
      target_upside: upside.value,
      mcap: num(f.market_cap),
      net_debt: num(bal.net_debt),
      geiger: num(g.composite),
      usual: num(hb.usual_day_60),
    },
    dates: {
      pe_ttm: fDate, pe_adj: fDate, pe_fwd: fwd.fiscal_date ? "FY " + fwd.fiscal_date.slice(0, 4) : null,
      eps_growth: egrowth.from && egrowth.to ? "FY" + egrowth.from.slice(0, 4) + "→" + egrowth.to.slice(0, 4) : null,
      rev_ttm: fDate, rev_growth: growth.from && growth.to ? "FY" + growth.from.slice(0, 4) + "→" + growth.to.slice(0, 4) : null,
      target_upside: estDate,
      mcap: fDate, net_debt: bal.fiscal_date || null, geiger: tsToISO(g.updated_ts), usual: hb.date || null,
    },
    fwd, growth, egrowth, upside, est_date: estDate,
    next_report: next ? { date: next.date, days: calendarDays(todayISO, next.date), sessions: sessionsBetween(todayISO, next.date), eps_estimate: num(next.eps_estimate) } : null,
  };
}

/* ---- two scenarios side by side --------------------------------------------------------- */

/** For each metric: the band of A and the band of B (names still in), so the write-up can say
    what differs between two groups without a third table. rows: buildRow() rows; out: Sets. */
export function compareBands(rowsA, rowsB, outA = new Set(), outB = new Set()) {
  const pick = (rows, out, key) => band(rows.filter((r) => !out.has(r.ticker)).map((r) => r.metrics[key]));
  return METRICS.map((m) => ({ key: m.key, label: m.label, a: pick(rowsA, outA, m.key), b: pick(rowsB, outB, m.key) }));
}

/** Station targets keep Alan's own order (position), everything else is alphabetical. */
export function orderRows(rows, scenario) {
  return [...rows].sort((x, y) => scenario === "STATION"
    ? (x.position ?? 99) - (y.position ?? 99)
    : String(x.ticker).localeCompare(String(y.ticker)));
}

/* ---- the client designer's mechanic, borrowed (Alan, 25 Sep 10:30 PM) --------------------
   In the Urth client designer the client states the THEME they want; the page then fills each
   spot under per-layer caps, and one property-wide rule (at most three colours) narrows the
   options as they go. For an existing property the order reverses: what is already there
   drives the theme. Here: the operator states the theme; the report fills each SLEEVE (large
   cap, small cap) under the allocation tool's per-sleeve caps; the one book-wide rule is the
   tool's hard cap on total names. The reverse direction starts from what is already liked. */

export const THEMES = [
  { key: "ANY",          label: "any theme",                              tags: null },
  { key: "AI_TRADE",     label: "the AI trade",                           tags: ["AI_HARDWARE", "AI_SOFTWARE", "SEMICONDUCTORS", "SOFTWARE___INFRASTRUCTURE", "AI_POWERTRAIN", "INDEPENDENT_POWER_PRODUCERS", "INTERNET_CONTENT_&_INFORMATION"] },
  { key: "POWER_FOR_AI", label: "power for AI",                           tags: ["AI_POWERTRAIN", "INDEPENDENT_POWER_PRODUCERS", "RENEWABLE_UTILITIES", "URANIUM", "ELECTRICAL_EQUIPMENT_&_PARTS"] },
  { key: "DEFENSIVE",    label: "defensive while the indexes are stretched", tags: ["UTILITIES", "REGULATED_ELECTRIC", "STAPLES", "DISCOUNT_STORES", "BLUE_CHIP"] },
  { key: "MEGA_EARNERS", label: "mega caps that already earn",            tags: ["MEGA_CAP", "MEGACAP"] },
];
export const themeByKey = (themes, key) => (themes || THEMES).find((t) => t.key === key) || THEMES[0];

/** Does this name belong to the stated theme? One full sentence either way. */
export function themeFit(row, theme) {
  const t = theme || THEMES[0];
  if (!t.tags || !t.tags.length) return { fits: true, why: `${row.ticker} plays: no theme is stated, so every name in the group may play.` };
  const tags = row.all_tags || row.tags || [];
  const hit = tags.filter((x) => t.tags.includes(x));
  if (hit.length) return { fits: true, why: `${row.ticker} fits the theme "${t.label}" through ${hit.map(themeWord).join(" and ")}.` };
  const own = tags.filter((x) => !CAP_TAGS.includes(x)).map(themeWord);
  return { fits: false, why: `${row.ticker} is greyed for this theme: it is tagged ${own.length ? own.join(", ") : "nothing but its size"}, and none of that is part of "${t.label}".` };
}

/* The allocation tool's sleeves and caps (its DEFAULTS at allocation.scintillahub.ai, read 26 Sep):
   nLC 4 and nSC 2 names per sleeve, maxTotal 12 as the hard cap on total names across the book —
   the tool's own words: "the number that caps how many PICKS the comps table lets you keep". */
export const SLEEVE_CAPS = { LC: 4, SC: 2, total: 12 };
export const sleeveOf = (row) => (row.cap && (row.cap.tag === "SMALL_CAP" || row.cap.tag === "MID_CAP") && num(row.mcap) != null && row.mcap < CAP_LINE_USD) ? "SC"
  : (row.cap && row.cap.tag === "SMALL_CAP") ? "SC" : "LC";

/** The theme analysis table: for each theme, how many names of this group fit it, per sleeve, with a verdict
    in the designer's own idiom ("fills every zone" / "thin in shade" / "cannot fill deep shade"). */
export function themeAnalysis(rows, themes = THEMES, caps = SLEEVE_CAPS, largeOnly = true) {
  return themes.filter((t) => t.tags).map((t) => {
    const fit = rows.filter((r) => !r.is_etf && themeFit(r, t).fits);
    const lc = fit.filter((r) => sleeveOf(r) === "LC").length, sc = fit.filter((r) => sleeveOf(r) === "SC").length;
    let verdict;
    if (largeOnly) verdict = lc >= caps.LC ? "fills the large-cap sleeve" : lc > 0 ? `thin: ${lc} large cap${lc === 1 ? "" : "s"} for a sleeve of ${caps.LC}` : "cannot fill the large-cap sleeve";
    else if (lc >= caps.LC && sc >= caps.SC) verdict = "fills both sleeves";
    else if (lc === 0 && sc === 0) verdict = "no name of this group fits";
    else if (sc === 0) verdict = "cannot fill the small-cap sleeve";
    else if (lc === 0) verdict = "cannot fill the large-cap sleeve";
    else verdict = `thin: ${lc} large and ${sc} small for sleeves of ${caps.LC} and ${caps.SC}`;
    return { key: t.key, label: t.label, lc, sc, n: fit.length, names: fit.map((r) => r.ticker), verdict, viable: largeOnly ? lc > 0 : (lc + sc) > 0 };
  });
}

/** The reverse direction: from the names already liked, which theme are they telling you? */
export function inferTheme(rows, likedTickers, themes = THEMES) {
  const liked = rows.filter((r) => likedTickers.has(r.ticker) && !r.is_etf);
  const ranked = themes.filter((t) => t.tags).map((t) => {
    const names = liked.filter((r) => themeFit(r, t).fits).map((r) => r.ticker);
    return { key: t.key, label: t.label, n: names.length, names, share: liked.length ? names.length / liked.length : 0 };
  }).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
  const top = ranked[0] && ranked[0].n ? ranked[0] : null;
  const sentence = !liked.length ? "None of these names is on your LIKED list, so the liked list says nothing about a theme here."
    : !top ? `You already like ${liked.map((r) => r.ticker).join(", ")}, but none of the themes on file covers them.`
    : `You already like ${liked.map((r) => r.ticker).join(", ")}; ${top.n} of ${liked.length} fit "${top.label}", so that is the theme the liked list is telling you.`;
  return { liked: liked.map((r) => r.ticker), ranked, top, sentence };
}

/** The tool's own split: LC share = 50% + (IWM geiger − SPY geiger) × 50%, capped 20–80%. */
export function lcSplit(gSPY, gIWM) {
  const s = num(gSPY), i = num(gIWM);
  if (s == null || i == null) return { lc: null, sc: null, reason: "SPY or IWM has no Geiger on file" };
  const lc = Math.min(80, Math.max(20, 50 + (i - s) * 50));
  return { lc, sc: 100 - lc, reason: null };
}

/** May this name be a PICK now? The sleeve cap and the book-wide hard cap are the narrowing rule.
    picks: [{ticker, sleeve, cohort}] already picked (every cohort, this browser). */
export function pickAllowed(row, picks, caps = SLEEVE_CAPS, scenario = null) {
  const others = picks.filter((p) => p.ticker !== row.ticker);
  const sl = sleeveOf(row);
  const inSleeve = others.filter((p) => p.sleeve === sl && (scenario == null || p.cohort === scenario));
  if (others.length >= caps.total) return { ok: false, why: `${row.ticker} cannot be a PICK yet: you already hold ${others.length} picks across every cohort, which is the hard cap of ${caps.total} the allocation tool sets. Pass or defer one to make room.` };
  if (inSleeve.length >= caps[sl]) return { ok: false, why: `${row.ticker} cannot be a PICK yet: the ${sl === "LC" ? "large" : "small"}-cap sleeve of this group already holds ${inSleeve.length} (${inSleeve.map((p) => p.ticker).join(", ")}), its cap of ${caps[sl]} names.` };
  return { ok: true, why: `${row.ticker} may be a PICK: the ${sl === "LC" ? "large" : "small"}-cap sleeve holds ${inSleeve.length} of ${caps[sl]}, and the book ${others.length} of ${caps.total}.` };
}

/* ---- ROUND 2 · the round robin --------------------------------------------------------------
   Every name still in plays every other name once on every metric still on the field. The better
   number wins the game (lower P/E, faster growth, lighter debt, more room to the target); equal
   numbers draw; a game where either side has no number is not played, and counts against nobody.
   Points: a win is 1, a draw ½. Standings order the elimination stage; they knock nobody out. */
export function roundRobin(rows, out = new Set(), metricsOn = null) {
  const alive = rows.filter((r) => !out.has(r.ticker));
  const ms = METRICS.filter((m) => m.better && (metricsOn ? metricsOn.has(m.key) : m.plays));
  const table = Object.fromEntries(alive.map((r) => [r.ticker, { ticker: r.ticker, wins: 0, draws: 0, losses: 0, played: 0, points: 0, byMetric: {} }]));
  const matrix = Object.fromEntries(alive.map((r) => [r.ticker, Object.fromEntries(alive.map((s) => [s.ticker, null]))]));
  for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
    const a = alive[i], b = alive[j];
    let aw = 0, bw = 0, dr = 0;
    for (const m of ms) {
      const va = num(a.metrics[m.key]), vb = num(b.metrics[m.key]);
      if (va == null || vb == null) continue;
      const res = va === vb ? 0 : ((m.better === "low") === (va < vb) ? 1 : -1);
      if (res === 0) dr++; else if (res > 0) aw++; else bw++;
      const ta = table[a.ticker].byMetric, tb = table[b.ticker].byMetric;
      ta[m.key] = (ta[m.key] || 0) + (res > 0 ? 1 : res === 0 ? 0.5 : 0);
      tb[m.key] = (tb[m.key] || 0) + (res < 0 ? 1 : res === 0 ? 0.5 : 0);
    }
    const played = aw + bw + dr;
    matrix[a.ticker][b.ticker] = { for: aw, against: bw, draws: dr, played };
    matrix[b.ticker][a.ticker] = { for: bw, against: aw, draws: dr, played };
    const A = table[a.ticker], B = table[b.ticker];
    A.wins += aw; A.losses += bw; A.draws += dr; A.played += played; A.points += aw + dr / 2;
    B.wins += bw; B.losses += aw; B.draws += dr; B.played += played; B.points += bw + dr / 2;
  }
  const standings = Object.values(table).map((t) => ({ ...t, pct: t.played ? t.points / t.played : null }))
    .sort((x, y) => (y.pct ?? -1) - (x.pct ?? -1) || y.points - x.points || y.wins - x.wins || x.ticker.localeCompare(y.ticker))
    .map((t, i) => ({ ...t, seed: i + 1 }));
  return { standings, matrix, metrics: ms.map((m) => m.key), games: standings.reduce((n, t) => n + t.played, 0) / 2 };
}

/* ---- the three scenarios --------------------------------------------------------------------- */
export const SCENARIOS = {
  UTILITIES:     { key: "UTILITIES",     kind: "cohort",  cohort: "UTILITIES",     label: "UTILITIES",     sub: "the cohort as it stands today" },
  AI_POWERTRAIN: { key: "AI_POWERTRAIN", kind: "cohort",  cohort: "AI_POWERTRAIN", label: "AI POWERTRAIN", sub: "the cohort as it stands today" },
  STATION:       { key: "STATION",       kind: "targets", cohort: "STATION",       label: "STATION TARGETS", sub: "Alan's eight, in position order" },
};
export function scenarioFor(key, cohortParam) {
  const k = String(key || "").toUpperCase();
  if (SCENARIOS[k]) return SCENARIOS[k];
  const c = String(cohortParam || k || "AI_POWERTRAIN").toUpperCase();
  return { key: c, kind: "cohort", cohort: c, label: c.replace(/_/g, " "), sub: "another cohort, one at a time" };
}

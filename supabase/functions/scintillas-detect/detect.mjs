/* SCINTILLA · M42 — the detectors. One scintilla = a subject moved further than ITS OWN history
   says it usually moves. Pure functions only: no fetch, no clock, no database. Everything they
   need is passed in, so every row they emit can be recomputed by hand from `detail`.

   Alan, 23 Sep: "how do we make earnings scintillate percentage price changes scintillate the
   outliers of the day"; "its a scintilla that can be part of a measure of criticality".

   THE ONE RULE THAT MAKES THESE COMPARABLE. A move is never judged against a fixed percentage.
   It is divided by the same subject's own usual movement, so a 2% day on a quiet name and a 9% day
   on a wild one can sit in the same list and be ranked honestly.

   WHAT IS DELIBERATELY NOT DONE. No detector invents a number. Too little history, a missing
   estimate or a flat history means NO scintilla and a stated reason — never a guess, and never a
   z-score computed from one observation. The reasons come back beside the events so the Hub (and
   this file's tests) can show why a quiet day was quiet. */

export const SCINT_KINDS = Object.freeze([
  "price_outlier", "earnings_surprise", "econ_surprise", "econ_imminent",
  "sentiment_spike", "breadth_thrust",
]);
export const MIN_ABS_Z = 2;              // Alan's brief: |z| >= 2
export const PRICE_MIN_HISTORY = 20;     // daily returns before a volatility is trustworthy
export const SURPRISE_MIN_HISTORY = 4;   // past prints before "its usual surprise" means anything
export const IMMINENT_MIN = 15;          // "imminent" = inside 15 minutes
/* The room's own reading of a macro surprise, kept letter-for-letter identical to index.html's
   EC_INVERT so a stored scintilla and the Economic room can never disagree about which way is
   hot. A test pins the two together. */
export const EC_INVERT = /(inflation|\bcpi\b|\bppi\b|producer price|consumer price|\bpce\b|price index|deflator|unemploy|jobless|job cuts|initial claims|continuing claims)/i;

const num = (v) => { const n = typeof v === "number" ? v : parseFloat(v); return Number.isFinite(n) ? n : null; };
const r3 = (n) => (n == null ? null : Math.round(n * 1000) / 1000);
const sign = (n) => (n > 0 ? 1 : n < 0 ? -1 : 0);

export function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; }
/* sample standard deviation (n-1): with 20 returns the population form understates the spread. */
export function stdev(xs) {
  if (xs.length < 2) return null;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) * (x - m), 0) / (xs.length - 1));
}
/* the usual z: how far from this subject's average, in its own standard deviations. */
export function zScore(x, history) {
  const s = stdev(history);
  if (s == null || !(s > 0)) return null;
  return (x - mean(history)) / s;
}
/* the brief's z for a price day: today's move over the name's own daily volatility. The centre is
   zero on purpose — "did it move a lot today", not "did it move more than it usually drifts". */
export function volZ(movePct, returnsPct) {
  const s = stdev(returnsPct);
  if (s == null || !(s > 0)) return null;
  return movePct / s;
}
/* closes ascending -> percentage day-over-day returns */
export function dailyReturnsPct(bars) {
  const out = [];
  for (let i = 1; i < bars.length; i++) {
    const p = num(bars[i - 1] && (bars[i - 1].c ?? bars[i - 1].close));
    const c = num(bars[i] && (bars[i].c ?? bars[i].close));
    if (p != null && c != null && p > 0) out.push((c / p - 1) * 100);
  }
  return out;
}
export function surprisePct(actual, estimate) {
  const a = num(actual), e = num(estimate);
  if (a == null || e == null || e === 0) return null;
  return ((a - e) / Math.abs(e)) * 100;
}
const base = (event) => String(event || "").replace(/\s*\((Q[1-4]|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[^)]*\)\s*$/i, "").trim();
export const econEventKey = (country, event) => String(country || "") + "|" + base(event).toLowerCase();
/* THE ROOM'S OWN READING, so a stored scintilla and the Economic room can never disagree.
   index.html's ecRowHTML computes exactly this: cls = (diff > 0) === hot ? "up" : "dn", where `hot`
   is EC_INVERT (inflation, unemployment). The room paints that "up" class RED and "dn" GREEN — its
   note says so: "red = hotter inflation / weaker labour than expected, green = the other way".
   So the class is kept as the room's word, and `reading` says in plain English what the colour
   means: ADVERSE (the red kind — hotter inflation, weaker labour, stronger-than-wanted) or
   FAVOURABLE (the green kind). A glow reads room_class and lights the room's own colour. */
export function econRoomClass(event, diff) {
  if (diff == null || Math.abs(diff) < 1e-9) return "flat";
  return (diff > 0) === EC_INVERT.test(base(event)) ? "up" : "dn";
}
export function econReading(event, diff) {
  const cls = econRoomClass(event, diff);
  return cls === "flat" ? "in line" : cls === "up" ? "adverse" : "favourable";
}

function ev(o) {
  return {
    ts: o.ts, kind: o.kind, subject: o.subject, subject_kind: o.subject_kind || "ticker",
    direction: o.direction, magnitude: o.magnitude == null ? null : r3(Math.abs(o.magnitude)),
    source: o.source, detail: o.detail, dedupe_key: o.dedupe_key,
  };
}


/* ── THE RULES FILE — data/scintilla-rules.json ─────────────────────────────────────────────
   M48. Alan, 24 Sep: "these are relative, pretty high percentages. But like raw, something above
   X percent on equities, above X percent on indexes … what kind of good rules for scintillation
   would be nice. Statistical analysis based rules."
   So there are TWO families and a day counts if EITHER fires:
     · STATISTICAL — the move against the NAME'S OWN usual day, with its own bar per asset class,
       plus a minimum move so a dead-flat name printing 4x a nothing-move is not a pointer;
     · RAW — a plain percentage floor per asset class, so a big move on a quiet name still counts.
   The thresholds live in ONE versioned file the detector and the Hub both read. These functions
   take that file as an argument and never load it themselves: pure in, pure out. With no rules
   passed they behave exactly as M42 did (|z| >= MIN_ABS_Z), so nothing already stored changes. */
export function assetClassOf(symbol, rules) {
  const s = String(symbol || "").toUpperCase();
  const classes = (rules && rules.classes) || null;
  if (!classes) return "equity";
  for (const name in classes) {
    const c = classes[name];
    if (c && Array.isArray(c.symbols) && c.symbols.indexOf(s) >= 0) return name;
  }
  for (const name in classes) if (classes[name] && classes[name].default) return name;
  return "equity";
}
export function priceRuleFor(symbol, rules) {
  const asset_class = assetClassOf(symbol, rules);
  const p = rules && rules.price && (rules.price[asset_class] || rules.price.equity);
  if (!p) return null;
  return { asset_class, x_usual: +p.x_usual, needs_move_pct: +p.x_usual_needs_move_pct, raw_move_pct: +p.raw_move_pct };
}
/* the verdict and WHICH family said so — both are reported, because a day that is both a big raw
   move AND far beyond the name's own history is a different thing from a day that is only one. */
export function priceVerdict(movePct, usualPct, rule) {
  const abs = Math.abs(movePct);
  const x = usualPct > 0 ? movePct / usualPct : null;
  const statistical = x != null && Math.abs(x) >= rule.x_usual && abs >= rule.needs_move_pct;
  const raw = abs >= rule.raw_move_pct;
  const fired = [];
  if (statistical) fired.push("statistical");
  if (raw) fired.push("raw");
  return { x, fired, hit: fired.length > 0 };
}
/* the sentence stored beside the row, in the words the strip uses */
export function priceRuleSentence(rule, verdict, version) {
  if (!rule) return "move / own daily volatility, |z| >= " + verdict.minAbsZ;
  const x = verdict.x == null ? null : Math.abs(verdict.x);
  const parts = [];
  if (verdict.fired.indexOf("statistical") >= 0)
    parts.push(x.toFixed(1) + "x its usual day (" + rule.asset_class + ": " + rule.x_usual +
               "x or more, and at least " + rule.needs_move_pct + "%)");
  if (verdict.fired.indexOf("raw") >= 0)
    parts.push("a raw move of at least " + rule.raw_move_pct + "% for " + rule.asset_class);
  return parts.join(" · ") + (version ? " · rules " + version : "");
}

/* ── OUTLIERS OF THE DAY ────────────────────────────────────────────────────────────────────
   quotes:           [{ symbol, price, prev_close }]      — today, as the board already has it
   historyBySymbol:  { SYM: [{ c }] ascending, ending BEFORE today }
   session:          the trading date these moves belong to (YYYY-MM-DD) */
export function detectPriceOutliers({ quotes, historyBySymbol, session, ts, minHistory = PRICE_MIN_HISTORY,
                                      minAbsZ = MIN_ABS_Z, rules = null, source = "chart-api:/candles",
                                      heartbeatBySymbol = null }) {
  const events = [], skipped = [];
  for (const q of quotes || []) {
    const sym = q && q.symbol;
    if (!sym) continue;
    const price = num(q.price), prev = num(q.prev_close);
    if (price == null || prev == null || prev <= 0) { skipped.push({ subject: sym, reason: "NO_PREV_CLOSE" }); continue; }
    const movePct = (price / prev - 1) * 100;
    const rets = dailyReturnsPct(historyBySymbol && historyBySymbol[sym] ? historyBySymbol[sym] : []);
    if (rets.length < minHistory) { skipped.push({ subject: sym, reason: "SHORT_HISTORY", n: rets.length }); continue; }
    /* M52 — THE USUAL DAY IS NOW A STORED NUMBER, NOT ONE THIS PASS INVENTS. When
       public.ticker_heartbeat_daily has a row for this name, its 60-session usual day is the
       divisor, so the strip on the dashboard and the column on the board are the same number
       by construction rather than by coincidence. With no stored row (a new listing, or the
       writer behind) it falls back to computing the spread from these bars exactly as before,
       and detail.usual_source says which of the two happened — never silently. */
    const hb = heartbeatBySymbol && heartbeatBySymbol[sym];
    const stored = hb && num(hb.usual_day_60) != null && num(hb.usual_day_60) > 0 ? num(hb.usual_day_60) : null;
    const usual = stored != null ? stored : stdev(rets);
    const usualSource = stored != null
      ? "ticker_heartbeat_daily:" + (hb.date || "") + " · 60 sessions"
      : "computed here from " + rets.length + " sessions";
    if (usual == null || !(usual > 0)) { skipped.push({ subject: sym, reason: "FLAT_HISTORY", n: rets.length }); continue; }
    const z = movePct / usual;
    const rule = rules ? priceRuleFor(sym, rules) : null;
    const verdict = rule ? priceVerdict(movePct, usual, rule)
      : { x: z, fired: Math.abs(z) >= minAbsZ ? ["statistical"] : [], hit: Math.abs(z) >= minAbsZ, minAbsZ };
    if (!verdict.hit) {
      skipped.push({ subject: sym, reason: "BELOW_THRESHOLD", z: r3(z), x_usual: r3(Math.abs(z)),
                     move_pct: r3(movePct), asset_class: rule ? rule.asset_class : null });
      continue;
    }
    events.push(ev({
      ts, kind: "price_outlier", subject: sym, subject_kind: "ticker", direction: sign(movePct), magnitude: z, source,
      detail: { session, move_pct: r3(movePct), daily_vol_pct: r3(usual),
                usual_source: usualSource, usual_sessions: stored != null ? 60 : rets.length,
                n_days: stored != null && hb.n != null ? +hb.n : rets.length,
                price, prev_close: prev, z: r3(z), x_usual: r3(Math.abs(z)),
                asset_class: rule ? rule.asset_class : "equity",
                fired: verdict.fired.slice(),
                thresholds: rule ? { x_usual: rule.x_usual, needs_move_pct: rule.needs_move_pct, raw_move_pct: rule.raw_move_pct }
                                 : { x_usual: minAbsZ },
                rules_version: (rules && rules.version) || null,
                rule: priceRuleSentence(rule, verdict, rules && rules.version) },
      dedupe_key: "price_outlier|" + sym + "|" + session,
    }));
  }
  return { events, skipped };
}

/* ── EARNINGS SURPRISE ──────────────────────────────────────────────────────────────────────
   rows:             today's reported rows from earnings_events
   historyByTicker:  { TICK: [past rows, any order] } — the same table, earlier dates
   A report fires when EPS **or** revenue came in further from estimate than that name's own past
   surprises usually land. The louder of the two is the scintilla; both are kept in detail. */
export function detectEarningsSurprises({ rows, historyByTicker, ts, minHistory = SURPRISE_MIN_HISTORY,
                                          minAbsZ = MIN_ABS_Z, source = "earnings_events" }) {
  const events = [], skipped = [];
  for (const r of rows || []) {
    const t = r && r.ticker;
    if (!t) continue;
    const hist = (historyByTicker && historyByTicker[t]) || [];
    const measures = [];
    for (const [name, aKey, eKey] of [["eps", "eps_actual", "eps_estimate"], ["revenue", "revenue_actual", "revenue_estimate"]]) {
      const sp = surprisePct(r[aKey], r[eKey]);
      if (sp == null) continue;
      const past = hist.map((h) => surprisePct(h[aKey], h[eKey])).filter((x) => x != null);
      if (past.length < minHistory) { measures.push({ name, surprise_pct: r3(sp), z: null, n: past.length, reason: "SHORT_HISTORY" }); continue; }
      const z = zScore(sp, past);
      if (z == null) { measures.push({ name, surprise_pct: r3(sp), z: null, n: past.length, reason: "FLAT_HISTORY" }); continue; }
      measures.push({ name, surprise_pct: r3(sp), z: r3(z), n: past.length, usual_pct: r3(mean(past)), spread_pct: r3(stdev(past)) });
    }
    if (!measures.length) { skipped.push({ subject: t, reason: "NO_ESTIMATE_OR_ACTUAL" }); continue; }
    const scored = measures.filter((m) => m.z != null);
    if (!scored.length) { skipped.push({ subject: t, reason: measures[0].reason || "NO_Z", measures }); continue; }
    const loudest = scored.slice().sort((a, b) => Math.abs(b.z) - Math.abs(a.z))[0];
    if (Math.abs(loudest.z) < minAbsZ) { skipped.push({ subject: t, reason: "BELOW_THRESHOLD", z: loudest.z, measure: loudest.name }); continue; }
    events.push(ev({
      ts, kind: "earnings_surprise", subject: t, subject_kind: "ticker",
      direction: sign(loudest.surprise_pct), magnitude: loudest.z, source,
      detail: { date: r.date, measure: loudest.name, measures, beat: loudest.surprise_pct > 0,
                rule: "surprise vs the name's own past surprises, |z| >= " + minAbsZ },
      dedupe_key: "earnings_surprise|" + t + "|" + String(r.date),
    }));
  }
  return { events, skipped };
}

/* ── ECONOMIC SURPRISE, AND THE ONE THAT HAS NOT PRINTED YET ────────────────────────────────
   rows:            econ_calendar rows in the window being examined
   historyByEvent:  { "US|core cpi": [past rows with actual+estimate] }
   nowSec:          the clock, passed in (these functions never read one) */
export function detectEconSurprises({ rows, historyByEvent, ts, minHistory = SURPRISE_MIN_HISTORY,
                                      minAbsZ = MIN_ABS_Z, source = "econ_calendar" }) {
  const events = [], skipped = [];
  for (const r of rows || []) {
    const a = num(r && r.actual), e = num(r && r.estimate);
    const subject = base(r && r.event);
    if (a == null || e == null) { skipped.push({ subject, reason: "NOT_PRINTED" }); continue; }
    const diff = a - e;
    const key = econEventKey(r.country, r.event);
    const past = ((historyByEvent && historyByEvent[key]) || [])
      .map((h) => { const ha = num(h.actual), he = num(h.estimate); return ha == null || he == null ? null : ha - he; })
      .filter((x) => x != null);
    if (past.length < minHistory) { skipped.push({ subject, reason: "SHORT_HISTORY", n: past.length }); continue; }
    const z = zScore(diff, past);
    if (z == null) { skipped.push({ subject, reason: "FLAT_HISTORY", n: past.length }); continue; }
    if (Math.abs(z) < minAbsZ) { skipped.push({ subject, reason: "BELOW_THRESHOLD", z: r3(z) }); continue; }
    events.push(ev({
      ts, kind: "econ_surprise", subject, subject_kind: "event", direction: sign(diff), magnitude: z, source,
      detail: { country: r.country, event: r.event, event_ts: r.event_ts, impact: r.impact,
                actual: a, estimate: e, surprise: r3(diff),
                reading: econReading(r.event, diff), room_class: econRoomClass(r.event, diff),
                n_prints: past.length, usual_surprise: r3(mean(past)), spread: r3(stdev(past)), z: r3(z),
                rule: "actual - estimate vs this release's own past surprises, |z| >= " + minAbsZ },
      dedupe_key: "econ_surprise|" + r.country + "|" + base(r.event).toLowerCase() + "|" + r.event_ts,
    }));
  }
  return { events, skipped };
}

export function detectEconImminent({ rows, nowSec, ts, windowMin = IMMINENT_MIN, impacts = ["High", "Medium"],
                                     source = "econ_calendar" }) {
  const events = [], skipped = [];
  for (const r of rows || []) {
    const subject = base(r && r.event);
    const at = r && r.event_ts != null ? Math.floor(new Date(r.event_ts).getTime() / 1000) : null;
    if (!Number.isFinite(at)) { skipped.push({ subject, reason: "NO_TIME" }); continue; }
    if (num(r.actual) != null) { skipped.push({ subject, reason: "ALREADY_PRINTED" }); continue; }
    const mins = (at - nowSec) / 60;
    if (mins <= 0) { skipped.push({ subject, reason: "DUE_OR_PAST", minutes: r3(mins) }); continue; }
    if (mins > windowMin) { skipped.push({ subject, reason: "NOT_YET_IMMINENT", minutes: r3(mins) }); continue; }
    if (impacts.indexOf(r.impact) < 0) { skipped.push({ subject, reason: "IMPACT_NOT_TRACKED", impact: r.impact }); continue; }
    events.push(ev({
      /* no number has printed, so there is NO z to state — magnitude stays null on purpose. */
      ts, kind: "econ_imminent", subject, subject_kind: "event", direction: 0, magnitude: null, source,
      detail: { country: r.country, event: r.event, event_ts: r.event_ts, impact: r.impact,
                minutes_to: r3(mins), estimate: num(r.estimate), previous: num(r.previous),
                rule: "high or medium impact release inside " + windowMin + " minutes, nothing printed yet" },
      dedupe_key: "econ_imminent|" + r.country + "|" + base(r.event).toLowerCase() + "|" + r.event_ts,
    }));
  }
  return { events, skipped };
}

/* ── DILUTION — M59 ─────────────────────────────────────────────────────────────────────────
   Alan, 23 Sep, on BYND's 8-K: "Convertible note… I love those."

   WHAT THIS IS. A company can hand out new shares. When it does, every share already held owns a
   little less of the company. That is the whole signal: HOW MANY MORE SHARES CAN EXIST, said as a
   percentage of the shares that exist today. It is not a price move and it is not a forecast — it
   is a number the company itself filed with the SEC.

   WHY IT IS NOT A z-SCORE. Every other detector here divides a move by that subject's own usual
   move. A company does not have a "usual" convertible note. So this one has NO magnitude — the
   column stays NULL, exactly as it does for a release that has not printed — and the size lives in
   detail.pct_of_shares_out, which is comparable across names on its own terms. The rules file
   calls that the RAW family: a plain floor, per the rules file, with no statistical twin.

   WHAT IT READS. One filing at a time, as the SEC published it: the form type, the 8-K item
   numbers, and the filing's own words. Nothing is inferred from a headline and no number is
   invented — if the filing does not say how many shares, the event says so and the percentage is
   null rather than a guess.

   THE FALSE POSITIVE THAT MATTERS MOST. A convertible note being REPAID or REDEEMED FOR CASH is
   the opposite of dilution: the notes go away and no shares are issued. The word "convertible"
   appears in both filings. So a match is never made on the word alone — an issuance pattern must
   say that securities are being sold or shares issued, and the exclusions below throw out the
   repayment, the resale by existing holders, the debt-for-debt exchange and the bank shelf. */

export const DILUTION_KIND = "dilution";
/* the forms that can carry one of these events. 424B2 is deliberately NOT here: it is the banks'
   medium-term-note shelf (9,054 of them in one 90-day window across this universe), which sells
   debt, not shares. */
export const DILUTION_FORMS = Object.freeze(["8-K", "8-K/A", "424B5", "424B3", "424B4", "S-3ASR", "S-3", "S-1", "S-1/A"]);

const RX = {
  convertible: /convertible\s+(senior\s+)?(secured\s+)?notes?\b/i,
  offering_sale: /\b(we|the\s+company|the\s+issuer)\s+(are|is)\s+offering\b|\bagreed\s+to\s+(sell|issue)\b|\bpurchase\s+agreement\b|\bunderwriting\s+agreement\b/i,
  atm: /at[-\s]the[-\s]market\s+(offering|program|sales|equity)|"at\s+the\s+market"\s+offerings?|\bsales\s+agreement\b/i,
  atm_rule415: /rule\s*415\s*\(\s*a\s*\)\s*\(\s*4\s*\)/i,
  registered_direct: /registered\s+direct\s+offering/i,
  pipe: /\bprivate\s+placement\b|\bsecurities\s+purchase\s+agreement\b|\bPIPE\b/,
  accredited: /accredited\s+investors?|section\s*4\s*\(\s*a\s*\)\s*\(\s*2\s*\)|regulation\s+d\b/i,
  /* TIGHTENED after reading real filings: bare "in exchange for" appears in a Duke Energy equity-unit
     prospectus and in an Amazon merger prospectus. A note-for-stock exchange names the agreement. */
  exchange_for_shares: /exchange\s+agreements?|exchange\s+transactions?/i,
  common_stock_sold: /shares\s+of\s+(?:our\s+)?common\s+stock/i,
  /* the security actually being sold is debt: IBM and KMI prospectuses are notes offerings */
  debt_offering: /description\s+of\s+the\s+notes\b|the\s+notes\s+offered\s+hereby|%\s+(?:senior\s+)?notes\s+due\s+20\d\d/i,
  /* a universal shelf lists every security type it MAY sell one day: Gilead's S-3ASR names
     "at the market offerings" as boilerplate while selling nothing */
  shelf_boilerplate: /may\s+offer\s+(?:and\s+sell\s+)?from\s+time\s+to\s+time|we\s+may\s+offer,?\s+from\s+time\s+to\s+time/i,
  atm_agent: /(sales|distribution|equity\s+distribution)\s+agreement\b/i,
  /* Amazon offering its stock for Globalstar's: real issuance, but an acquisition, not a raise */
  merger: /\bmergers?\b[^.]{0,120}\bagreement\b|merger\s+agreement|information\s+statement\/prospectus/i,
  purchase_agreement_equity: /securities\s+purchase\s+agreement/i,
  warrant_issue: /warrant\s+inducement|pre[-\s]funded\s+warrants?\s+to\s+purchase|exercise\s+of\s+(?:the\s+)?warrants?[^.]{0,80}(?:issued|issuance|shares)/i,
  shares_issued: /shares?\s+of\s+(our\s+)?common\s+stock\s+(will\s+be\s+|to\s+be\s+|were\s+)?issued|issue(d)?\s+[\d,]+\s+shares/i,
  /* "No shares of common stock were issued in connection with the repurchase" says the OPPOSITE of
     what the words alone suggest: a repayment filing that spells this out was being read as an
     issuance, which then skipped the repayment exclusion entirely. */
  no_shares_issued: /\bno\s+shares?\s+of\s+(?:our\s+)?common\s+stock\s+(?:were|was|will\s+be|are\s+to\s+be)\s+issued/i,
  warrants: /\bwarrant\s+(inducement|exercise)\b|\bpre[-\s]funded\s+warrants?\b|exercise\s+of\s+.{0,30}warrants?/i,
  reverse_split: /reverse\s+stock\s+split/i,
  /* the exclusions, each one a filing shape that contains the same words but adds no shares */
  /* "$200.0 million" and "0.50% Notes" put full stops INSIDE the sentence, so [^.] stops dead at
     the first number and the exclusion never reaches "for cash". A dot followed by a digit is part
     of a number, not the end of a sentence. */
  repaid_for_cash: /(repurchase|repurchased|redeem|redeemed|repay|repaid|retire[d]?)\b(?:[^.]|\.\d){0,240}?\b(in\s+cash|for\s+cash|cash\s+consideration|at\s+maturity)/i,
  resale_only: /will\s+not\s+receive\s+any\s+(of\s+the\s+)?proceeds\s+from\s+the\s+(sale|resale)/i,
  selling_holders: /selling\s+(stockholders?|shareholders?|securityholders?)/i,
  debt_for_debt: /in\s+exchange\s+for(?:[^.]|\.\d){0,160}\bnew\s+notes\b|exchange(?:[^.]|\.\d){0,80}notes\s+for\s+(?:[^.]|\.\d){0,40}notes/i,
  capped_call: /capped\s+call\s+transactions?/i,
  medium_term: /medium[-\s]term\s+notes|structured\s+notes|market[-\s]linked/i,
  cash_settle: /intends?\s+to\s+settle\s+(all\s+)?conversions?\s+in\s+cash|cash\s+settlement/i,
};

/* THE FILING AS THE SEC ACTUALLY PUBLISHES IT. A real 8-K writes "1,097,444&#160;shares" — the
   number and the word are joined by a non-breaking space entity, not a space. The first run of this
   detector against Beyond Meat's own filing therefore found only the second, smaller share count
   and called a 1.9% dilution 0.8%. Every text this detector is handed is normalised here, so no
   caller can reintroduce that bug: numeric entities become their characters, non-breaking spaces
   become spaces, and curly quotes become straight ones. */
export function normalizeFilingText(t) {
  return String(t || "")
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCharCode(+n); } catch (_) { return " "; } })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => { try { return String.fromCharCode(parseInt(h, 16)); } catch (_) { return " "; } })
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u00a0\u2007\u202f\s]+/g, " ");
}

const MULT = { thousand: 1e3, million: 1e6, billion: 1e9 };
/* "$15.0 million" -> 15000000 · "$500,000" -> 500000 · "approximately $1.2 billion" -> 1.2e9 */
export function moneyNear(text, re) {
  const m = String(text || "").match(re);
  if (!m) return null;
  return moneyFrom(m[0]);
}
export function moneyFrom(s) {
  const m = String(s || "").match(/\$\s*([\d,]+(?:\.\d+)?)\s*(thousand|million|billion)?/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return n * (m[2] ? MULT[m[2].toLowerCase()] : 1);
}
export function countFrom(s) {
  const m = String(s || "").match(/([\d,]{4,})\s*(?:shares|additional\s+shares)/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}
/* the price a share was actually sold at, never the par value printed beside the share class */
export function priceFrom(text) {
  const t = String(text || "");
  const named = [
    /public\s+offering\s+price\s+of\s+\$\s*([\d,.]+)\s+per\s+share/i,
    /offering\s+price\s+of\s+\$\s*([\d,.]+)\s+per\s+(?:share|unit)/i,
    /purchase\s+price\s+of\s+\$\s*([\d,.]+)\s+per\s+share/i,
    /price\s+of\s+\$\s*([\d,.]+)\s+per\s+share/i,
    /\$\s*([\d,.]+)\s+per\s+share(?!\s*,?\s*par)/i,
  ];
  for (const re of named) {
    const m = t.match(re);
    if (!m) continue;
    const before = t.slice(Math.max(0, m.index - 40), m.index).toLowerCase();
    if (/par\s+value|par\s*$/.test(before)) continue;
    const v = parseFloat(String(m[1]).replace(/,/g, ""));
    if (Number.isFinite(v) && v >= 0.01) return v;      /* a real offering is never a hundredth of a cent */
  }
  return null;
}
const firstMatch = (text, res) => { for (const re of res) { const m = String(text || "").match(re); if (m) return m; } return null; };
/* the sentence a match sits in, trimmed, so a stored row can be checked against the filing by eye */
export function quoteAround(text, m, span = 240) {
  if (!m) return "";
  const i = m.index == null ? String(text).indexOf(m[0]) : m.index;
  const from = Math.max(0, i - span / 3), to = Math.min(String(text).length, i + span);
  return String(text).slice(from, to).replace(/\s+/g, " ").trim();
}

/* ── THE PATTERNS ────────────────────────────────────────────────────────────────────────────
   Each one names the form it arrives on, the 8-K item numbers that carry it, the words that
   identify it, and how many shares it can add. `id` is stored on the row, so the Hub can say in
   plain words which kind of dilution this was. */
export function classifyDilution(filing) {
  const text = normalizeFilingText(filing && filing.text);
  const form = String((filing && filing.form) || "").toUpperCase();
  const items = String((filing && filing.items) || "").split(",").map((s) => s.trim()).filter(Boolean);
  const has = (re) => re.test(text);
  const item = (n) => items.indexOf(n) >= 0;

  /* ── exclusions first: these filings contain the same words and add no shares ─────────── */
  if (form === "424B2" || has(RX.medium_term))
    return { pattern: null, excluded_by: "structured_or_medium_term_notes",
             why: "a bank's medium-term note shelf sells debt, not shares" };
  if (has(RX.resale_only) || (has(RX.selling_holders) && !has(RX.offering_sale)))
    return { pattern: null, excluded_by: "resale_by_existing_holders",
             why: "shares that already exist changing hands: the company issues none and receives nothing" };
  if (has(RX.debt_for_debt))
    return { pattern: null, excluded_by: "debt_for_debt_exchange",
             why: "old notes exchanged for new notes — no shares are issued" };
  if (has(RX.merger))
    return { pattern: null, excluded_by: "merger_stock_consideration",
             why: "shares issued to buy another company: real new shares, but an acquisition, not money raised — it belongs to a different signal" };
  if (has(RX.debt_offering) && !has(RX.common_stock_sold))
    return { pattern: null, excluded_by: "plain_debt_offering",
             why: "the security being sold is notes, not shares" };
  const issuesShares = !has(RX.no_shares_issued) &&
    (has(RX.shares_issued) || has(RX.offering_sale) || has(RX.atm) || has(RX.warrant_issue));
  if (has(RX.repaid_for_cash) && !issuesShares)
    return { pattern: null, excluded_by: "repaid_or_redeemed_for_cash",
             why: "the notes are being paid off in cash — the opposite of dilution" };
  if (has(RX.capped_call) && !issuesShares)
    return { pattern: null, excluded_by: "capped_call_only",
             why: "a capped call is bought to REDUCE the dilution of notes already issued" };

  /* ── the patterns, most specific first ────────────────────────────────────────────────── */
  if (has(RX.convertible) && has(RX.exchange_for_shares) && has(RX.shares_issued))
    return { pattern: "note_exchange_for_shares", why: "convertible notes handed back in exchange for newly issued shares" };
  if (has(RX.convertible) && (item("1.01") || item("2.03") || form.startsWith("424")) && has(RX.offering_sale))
    return { pattern: "convertible_notes", why: "new convertible notes sold: every note can become shares" };
  if (has(RX.registered_direct) && has(RX.common_stock_sold))
    return { pattern: "registered_direct", why: "shares sold straight to investors off a shelf" };
  /* an at-the-market programme is a NAMED AGREEMENT with an agent and a size, not a shelf's list of
     things a company may one day sell. A registration statement that only lists the possibility is
     capacity, and capacity is not dilution. */
  if (has(RX.atm) && has(RX.atm_agent) && has(RX.common_stock_sold) && !(has(RX.shelf_boilerplate) && !form.startsWith("424")))
    return { pattern: "atm_program", why: "an at-the-market programme sells shares into the open market over time" };
  if (has(RX.atm) && !has(RX.atm_agent))
    return { pattern: null, excluded_by: "shelf_capacity_only",
             why: "a registration statement listing what the company MAY sell one day: nothing has been sold" };
  if (has(RX.purchase_agreement_equity) && has(RX.common_stock_sold) && (item("3.02") || item("1.01") || form.startsWith("424")))
    return { pattern: "pipe", why: "a private placement of shares to named investors" };
  if (has(RX.pipe) && has(RX.accredited) && !has(RX.common_stock_sold))
    return { pattern: null, excluded_by: "private_placement_of_debt",
             why: "the private-placement words are a selling restriction on a bond, not a sale of shares" };
  if (has(RX.warrant_issue) && (item("3.02") || item("8.01")) && form.startsWith("8-K"))
    return { pattern: "warrant_exercise", why: "warrants exercised or re-priced, which issues shares" };
  if (has(RX.reverse_split) && (item("5.03") || item("3.03")))
    return { pattern: "reverse_split", why: "a reverse split, which on its own removes shares — only a pointer when an offering follows" };
  return { pattern: null, excluded_by: "no_dilution_language", why: "nothing in this filing sells or issues shares" };
}

/* ── HOW MANY SHARES CAN THIS ADD ────────────────────────────────────────────────────────────
   Every route is the filing's own arithmetic, and each one says which sentence it came from.
   Nothing is estimated: a filing that does not give enough to compute shares returns null shares
   and the event still stores what it DOES say. */
export function dilutionTerms(filing, pattern, market) {
  const text = normalizeFilingText(filing && filing.text);
  const last = market && Number.isFinite(+market.last_close) && +market.last_close > 0 ? +market.last_close : null;
  const out = { pattern, principal_usd: null, gross_usd: null, price_per_share: null, conversion_price: null,
                price_is_floor: false, shares_added: null, shares_basis: null, quote: "" };

  const principalM = firstMatch(text, [
    /\$\s*[\d,.]+\s*(?:million|billion)?\s+(?:aggregate\s+)?principal\s+amount/i,
    /aggregate\s+principal\s+amount\s+of\s+\$\s*[\d,.]+\s*(?:million|billion)?/i,
  ]);
  if (principalM) out.principal_usd = moneyFrom(principalM[0]);

  const rateM = text.match(/conversion\s+rate\s+(?:of|is|will\s+be|shall\s+be)\s+(?:approximately\s+)?([\d,.]+)\s+shares[^.]{0,120}\$?\s?1,?000/i);
  const cpM = text.match(/conversion\s+price\s+of\s+(?:approximately\s+)?\$\s*([\d,.]+)/i);
  if (cpM) out.conversion_price = parseFloat(cpM[1].replace(/,/g, ""));

  /* THE PAR-VALUE TRAP. Nearly every filing says "common stock, $0.0001 par value per share".
     Read as a price, that makes a $7 stock look 99.99% discounted. So a price is only taken when
     the words around it say it is a PRICE, par value is never read as one, and anything under a
     cent is refused outright. */
  out.price_per_share = priceFrom(text);

  if (pattern === "note_exchange_for_shares") {
    /* an exchange has no "offering price": the shares are priced off a VWAP with a FLOOR, and the
       floor is the worst case for existing holders — the most shares the company can hand over.
       That is the number the screen quotes, and it says it is a floor, not a sale price. */
    const floorM = text.match(/floor\s+price\s+of\s+(?:approximately\s+)?\$\s*([\d,.]+)/i);
    if (floorM) { out.price_per_share = parseFloat(floorM[1].replace(/,/g, "")); out.price_is_floor = true; }
    const init = text.match(/([\d,]{4,})\s+shares\s+of\s+common\s+stock\s+will\s+be\s+issued/i);
    const extra = text.match(/(?:up\s+to\s+a\s+maximum\s+of\s+)?([\d,]{4,})\s+additional\s+shares/i);
    const a = init ? countFrom(init[0]) : null, b = extra ? countFrom(extra[0] + " shares") || parseFloat(extra[1].replace(/,/g, "")) : null;
    if (a != null || b != null) {
      out.shares_added = (a || 0) + (b || 0);
      out.shares_basis = "the filing's own share counts" + (b != null ? " (initial settlement plus the maximum true-up)" : "");
      out.quote = quoteAround(text, init || extra);
    }
  } else if (pattern === "convertible_notes") {
    if (out.principal_usd != null && rateM) {
      const rate = parseFloat(rateM[1].replace(/,/g, ""));
      out.shares_added = (out.principal_usd / 1000) * rate;
      out.shares_basis = "principal ÷ $1,000 × the filing's conversion rate of " + rate + " shares";
      out.quote = quoteAround(text, rateM);
    } else if (out.principal_usd != null && out.conversion_price) {
      out.shares_added = out.principal_usd / out.conversion_price;
      out.shares_basis = "principal ÷ the filing's conversion price of $" + out.conversion_price;
      out.quote = quoteAround(text, cpM);
    } else if (principalM) out.quote = quoteAround(text, principalM);
  } else if (pattern === "atm_program") {
    out.principal_usd = null;                 /* a programme sells shares; it borrows nothing */
    const upto = firstMatch(text, [
      /aggregate\s+offering\s+price\s+of\s+up\s+to\s+\$\s*[\d,.]+\s*(?:million|billion)?/i,
      /up\s+to\s+\$\s*[\d,.]+\s*(?:million|billion)?[^.]{0,60}(?:shares|common\s+stock)/i,
    ]);
    if (upto) { out.gross_usd = moneyFrom(upto[0]); out.quote = quoteAround(text, upto); }
    if (out.gross_usd != null && last) {
      out.shares_added = out.gross_usd / last;
      out.shares_basis = "the programme's maximum dollars ÷ the last close ($" + last + "), because an at-the-market sale has no fixed price";
    }
  } else {
    const sharesM = firstMatch(text, [
      /(?:we\s+are\s+offering|agreed\s+to\s+(?:sell|issue|purchase))\s+(?:an\s+aggregate\s+of\s+)?([\d,]{4,})\s+shares/i,
      /([\d,]{4,})\s+shares\s+of\s+(?:our\s+)?common\s+stock/i,
    ]);
    if (sharesM) {
      out.shares_added = parseFloat(String(sharesM[1]).replace(/,/g, ""));
      out.shares_basis = "the share count the filing states";
      out.quote = quoteAround(text, sharesM);
    }
    const grossM = firstMatch(text, [/gross\s+proceeds\s+of\s+(?:approximately\s+)?\$\s*[\d,.]+\s*(?:million|billion)?/i]);
    if (grossM) out.gross_usd = moneyFrom(grossM[0]);
  }
  if (out.gross_usd == null && out.principal_usd != null) out.gross_usd = out.principal_usd;
  return out;
}

/* the discount a buyer got, against the last close the board already shows. A NEGATIVE number is
   what dilution usually looks like: shares sold below where the stock trades. */
export function discountPct(price, lastClose) {
  if (!(price > 0) || !(lastClose > 0)) return null;
  return (price / lastClose - 1) * 100;
}

/* ── WHICH SHARE COUNT THE PERCENTAGE IS MEASURED AGAINST ───────────────────────────────────
   This is where a dilution number goes quietly wrong, and it did here first. Beyond Meat's newest
   FILED share count is 515,818,978, as of 5 August 2026. On 13 August the company did a 1-for-30
   REVERSE SPLIT: thirty old shares became one. The filed number was never restated, so dividing
   the shares from its 23 September filing by it makes an 11% dilution read as 0.4% — under any
   sensible bar, and invisible.

   So the count is chosen, and the choice is stored beside the number:
     1. an explicit reverse split, when the caller knows one (ratio and effective date): the filed
        count is divided by the ratio, and the row says so;
     2. otherwise, a cross-check against the market: shares implied by market value ÷ last close.
        A disagreement of MORE THAN 3x means the filed count belongs to a different share base —
        the implied one is used and the row says which;
     3. otherwise the filed count, as filed.
   When nothing is usable there is NO percentage. A dilution row may say "the filing does not give
   a share count" but it never divides by a number it does not trust. */
export function shareBase(mk, lastClose) {
  const filed = Number.isFinite(+(mk && mk.shares_out)) && +mk.shares_out > 0 ? +mk.shares_out : null;
  const asof = (mk && mk.shares_out_asof) || null;
  const rs = mk && mk.reverse_split;
  if (filed != null && rs && +rs.ratio > 1 && (!asof || !rs.effective_date || String(asof) < String(rs.effective_date))) {
    return { shares_out: filed / +rs.ratio, asof, filed, source: "filed count ÷ the reverse split",
             note: "the company's last filed share count is from " + (asof || "before the split") +
                   ", before its 1-for-" + (+rs.ratio) + " reverse split on " + (rs.effective_date || "a later date") +
                   ", so it is divided by " + (+rs.ratio) + ". Shares issued since then are not in it, so the percentage is if anything a little high." };
  }
  const mcap = Number.isFinite(+(mk && mk.market_cap)) && +mk.market_cap > 0 ? +mk.market_cap : null;
  const implied = mcap != null && lastClose ? mcap / lastClose : null;
  if (filed != null && implied != null) {
    const ratio = filed / implied;
    if (ratio >= 3 || ratio <= 1 / 3) {
      return { shares_out: implied, asof: "today's market value", filed,
               source: "market value ÷ last close",
               note: "the filed share count (" + Math.round(filed).toLocaleString("en-US") + " as of " + (asof || "an earlier date") +
                     ") is " + (ratio >= 3 ? ratio.toFixed(1) + "x larger" : (1 / ratio).toFixed(1) + "x smaller") +
                     " than what the company is worth today implies, which is what a split looks like. The market's number is used." };
    }
    return { shares_out: filed, asof, filed, source: "the company's own cover page",
             note: "the market implies " + Math.round(implied).toLocaleString("en-US") + " shares, which agrees with the filed count." };
  }
  if (filed != null) return { shares_out: filed, asof, filed, source: "the company's own cover page", note: "" };
  if (implied != null) return { shares_out: implied, asof: "today's market value", filed: null,
                                source: "market value ÷ last close", note: "no share count has been filed that this detector could read." };
  return { shares_out: null, asof: null, filed: null, source: null, note: "no share count available, so no percentage is claimed." };
}

/* ── THE DETECTOR ───────────────────────────────────────────────────────────────────────────
   filings:   [{ ticker, form, items, filed_date, accession, url, text }]  — as filed
   marketBy:  { SYM: { last_close, shares_out, shares_out_asof } }
   rules:     data/scintilla-rules.json; rules.dilution carries the floors */
export function detectDilution({ filings, marketBy, ts, rules = null, source = "sec:edgar" }) {
  const events = [], skipped = [];
  const R = (rules && rules.dilution) || null;
  const minPct = R && Number.isFinite(+R.min_pct_of_shares_out) ? +R.min_pct_of_shares_out : 1;
  const minUsd = R && Number.isFinite(+R.min_gross_usd) ? +R.min_gross_usd : 0;
  for (const f of filings || []) {
    const sym = f && f.ticker;
    if (!sym) continue;
    if (DILUTION_FORMS.indexOf(String(f.form || "").toUpperCase()) < 0) {
      skipped.push({ subject: sym, reason: "FORM_NOT_TRACKED", form: f.form }); continue;
    }
    const cls = classifyDilution(f);
    if (!cls.pattern) { skipped.push({ subject: sym, reason: "NOT_DILUTION", excluded_by: cls.excluded_by, form: f.form, accession: f.accession }); continue; }
    const mk = (marketBy && marketBy[sym]) || {};
    const terms = dilutionTerms(f, cls.pattern, mk);
    const last = Number.isFinite(+mk.last_close) && +mk.last_close > 0 ? +mk.last_close : null;
    const sob = shareBase(mk, last);
    const sharesOut = sob.shares_out;
    const pct = terms.shares_added != null && sharesOut ? (terms.shares_added / sharesOut) * 100 : null;
    /* what one new share costs the people already holding them. For notes that is the conversion
       price (or the exchange's floor); for an offering it is the offering price. */
    const at = (cls.pattern === "convertible_notes" && terms.conversion_price != null) ? terms.conversion_price
      : terms.price_per_share != null ? terms.price_per_share : terms.conversion_price;
    const disc = discountPct(at, last);

    /* the size bar. A filing whose own words do not give a share count cannot be measured, so it
       is reported as unmeasured rather than dropped silently or waved through. */
    if (pct == null && terms.gross_usd == null) {
      skipped.push({ subject: sym, reason: "NO_SIZE_IN_FILING", pattern: cls.pattern, accession: f.accession }); continue;
    }
    if (pct != null && pct < minPct && !(terms.gross_usd != null && minUsd > 0 && terms.gross_usd >= minUsd)) {
      skipped.push({ subject: sym, reason: "BELOW_THRESHOLD", pattern: cls.pattern, pct_of_shares_out: r3(pct) }); continue;
    }
    if (pct == null && !(terms.gross_usd != null && minUsd > 0 && terms.gross_usd >= minUsd)) {
      skipped.push({ subject: sym, reason: "NO_SHARE_COUNT", pattern: cls.pattern, gross_usd: terms.gross_usd }); continue;
    }

    events.push(ev({
      ts, kind: DILUTION_KIND, subject: sym, subject_kind: "ticker",
      /* a share count going up is bad news for every share already held: the direction is down.
         magnitude stays NULL on purpose — see the note at the top of this block. */
      direction: -1, magnitude: null, source,
      detail: {
        pattern: cls.pattern, what_it_is: cls.why,
        form: f.form, items: f.items || "", filed_date: f.filed_date, accession: f.accession, url: f.url || null,
        principal_usd: terms.principal_usd, gross_usd: terms.gross_usd,
        price_per_share: terms.price_per_share, conversion_price: terms.conversion_price,
        priced_at: at == null ? null : at, price_is_floor: !!terms.price_is_floor, last_close: last,
        discount_pct: disc == null ? null : r3(disc),
        shares_added: terms.shares_added == null ? null : Math.round(terms.shares_added),
        shares_basis: terms.shares_basis,
        shares_out: sharesOut, shares_out_asof: sob.asof,
        shares_out_source: sob.source, shares_out_filed: sob.filed, shares_out_note: sob.note,
        pct_of_shares_out: pct == null ? null : r3(pct),
        quote: terms.quote || "",
        fired: ["raw"],
        thresholds: { min_pct_of_shares_out: minPct, min_gross_usd: minUsd || null },
        rules_version: (rules && rules.version) || null,
        rule: "a filing that sells or issues shares, worth at least " + minPct + "% of the shares outstanding",
      },
      dedupe_key: "dilution|" + sym + "|" + String(f.accession || f.filed_date),
    }));
  }
  return { events, skipped };
}

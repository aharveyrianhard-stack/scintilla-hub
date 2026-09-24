/* SCINTILLA · THE ONE MEASURING STICK for every sentiment voice (method "lm-v1").
   ────────────────────────────────────────────────────────────────────────────────
   This file is the single definition used by ALL FIVE callers, so a number on the
   screen can never be produced by a second, different arithmetic:
     · supabase/functions/sentiment-news     — scores headlines every 10 minutes
     · supabase/functions/sentiment-youtube  — scores clips / transcripts on its sweep
     · supabase/functions/sentiment-x        — scores the collector's published posts
     · lib/news-sentiment.mjs                — re-exports it for the Hub and the tests
     · jobs/news-sentiment/score_news.py     — mirrors it, pinned by shared fixtures
   Deno imports .mjs directly, so the functions and Node read the SAME bytes.

   THE STICK, written down (printed on the page as WEIGHTING):
     1. One item = one vote. A headline, a clip and a post all count once; no source
        is multiplied and no author is given extra weight.
     2. A score is the BALANCE of the words that fired, (pos - neg) / (pos + neg), in
        -1..+1. Never a raw count: the dictionary carries 2,355 negative words against
        354 positive, so counting hits alone would drift negative on ordinary text.
     3. An item with no word from the list gets NO score. Not a zero. Silence is not
        a neutral opinion, and it is reported separately as `unscored`.
     4. A question is scored and shown, and then LEFT OUT of every total.
     5. A negator in the three tokens before a match flips that match, and the flip is
        stored on the word so it can be checked.
     6. A ticker's day is the mean of that ticker's scored items for that day and source.
        Tickers are not equalised: a heavily covered name moves the market read more.
   WHAT IT CANNOT DO: it does not read the article, it cannot hear irony, sarcasm or a
   hedge, and a headline written to be clicked scores like one written to inform. */

export const METHOD = "lm-v1";
export const SCALE = "-1..+1 balance of the words that fired; null = nothing fired";
export const WEIGHTING =
  "one item one vote · score = (positive - negative) / (positive + negative) · an item with no listed word is not scored and never counted as zero · a question is scored but left out of totals · a negator in the three words before a match flips it · a ticker's day is the mean of its scored items, and tickers are not equalised";

/* feeds store HTML entities (BlackRock&#39;s, AT&amp;T). Turn them back into characters
   before scoring, or "amp" becomes a token and an apostrophe splits a word. */
export function decode(text) {
  return String(text == null ? "" : text)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

export function tokens(text) {
  return decode(text)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9'’\s-]/g, " ")
    .replace(/[’]/g, "'")
    .split(/[\s-]+/)
    .filter(Boolean);
}

/** build the lookup sets once from the shipped lexicon file */
export function prepare(lex) {
  const pos = new Set(lex.lm_positive), neg = new Set(lex.lm_negative);
  const sPos = new Set(lex.supplement_positive || []), sNeg = new Set(lex.supplement_negative || []);
  return { pos, neg, sPos, sNeg, unc: new Set(lex.lm_uncertainty || []), negators: new Set(lex.negators || []), method: lex.method || METHOD };
}

/* ── THE SENTENCE AROUND THE WORD ──────────────────────────────────────────────
   Alan asked for the words AND where they were said. A number nobody can open is a
   number nobody can argue with, so every hit carries the sentence it fired in. */
const SENT_SPLIT = /(?<=[.!?])\s+(?=[A-Z0-9"'(])|\s+[·—|]\s+|\n+/;
export function sentencesOf(text) {
  return decode(text).split(SENT_SPLIT).map((s) => s.trim()).filter(Boolean);
}
/** the sentence containing the nth (0-based) occurrence of `word`, trimmed to `max` */
export function sentenceAround(text, word, nth = 0, max = 240) {
  const parts = sentencesOf(text);
  const re = new RegExp("(^|[^a-z0-9'])" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9']|$)", "i");
  let seen = 0;
  for (const p of parts) {
    /* count every occurrence inside this part, so the nth hit lands in the right one */
    const hits = (p.toLowerCase().match(new RegExp("(^|[^a-z0-9'])" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9']|$)", "gi")) || []).length;
    if (hits && seen + hits > nth) return clip(p, word, max);
    seen += hits;
  }
  const whole = decode(text).trim();
  return re.test(whole) ? clip(whole, word, max) : null;
}
function clip(s, word, max) {
  if (s.length <= max) return s;
  const i = s.toLowerCase().indexOf(String(word).toLowerCase());
  if (i < 0) return s.slice(0, max - 1) + "…";
  const from = Math.max(0, i - Math.floor(max / 2));
  return (from ? "…" : "") + s.slice(from, from + max).trim() + (from + max < s.length ? "…" : "");
}

/**
 * Score ONE item (headline, title, transcript window or post).
 * Returns every word that fired, which list it came from, whether a negator flipped
 * it, and THE SENTENCE IT WAS SAID IN.
 */
export function scoreText(text, L, { sentences = true } = {}) {
  const raw = String(text == null ? "" : text);
  /* A QUESTION IS NOT A CLAIM. "Is NVDA about to crash?" carries the word crash and
     says nothing. The score is still computed and shown, but never totalled. */
  const question = /\?\s*$/.test(raw.split(".")[0].trim()) || /\?/.test(raw.split(".")[0]);
  const tk = tokens(text);
  const marks = [];
  const nth = new Map();
  let pos = 0, neg = 0, flips = 0, unc = 0;
  for (let i = 0; i < tk.length; i++) {
    const w = tk[i];
    if (L.unc.has(w)) unc++;
    let polarity = 0, list = "";
    if (L.pos.has(w)) { polarity = 1; list = "lm"; }
    else if (L.neg.has(w)) { polarity = -1; list = "lm"; }
    else if (L.sPos.has(w)) { polarity = 1; list = "headline-verb"; }
    else if (L.sNeg.has(w)) { polarity = -1; list = "headline-verb"; }
    if (!polarity) continue;
    let negated = false;
    for (let j = Math.max(0, i - 3); j < i; j++) if (L.negators.has(tk[j])) negated = true;
    const eff = negated ? -polarity : polarity;
    if (negated) flips++;
    if (eff > 0) pos++; else neg++;
    const k = nth.get(w) || 0;
    nth.set(w, k + 1);
    const mark = { i, w, list, polarity, negated, effect: eff };
    if (sentences) mark.s = sentenceAround(raw, w, k);
    marks.push(mark);
  }
  const hits = pos + neg;
  const strongest = marks.length ? marks.reduce((a, b) => (Math.abs(b.effect) > Math.abs(a.effect) ? b : a), marks[0]) : null;
  return {
    method: L.method || METHOD,
    score: hits ? (pos - neg) / hits : null,
    question,
    pos, neg, flips, unc, hits,
    marks, tokens: tk,
    sample: strongest ? strongest.s || null : null,
    reason: hits ? null : "no lexicon word in this item",
  };
}

/* ── ROLL-UP: ticker × day × source ───────────────────────────────────────────
   The stored daily row every timeline reads. Computed the same way for news,
   YouTube and X, so one tape can carry all three. */
export const DAY_TZ = "America/New_York";
/** the trading-day label an item belongs to, in New York, from epoch ms */
export function dayOf(ms) {
  const d = new Date(Number(ms));
  if (!isFinite(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: DAY_TZ });
}

/**
 * Roll scored items up into one row per ticker × day × source.
 * items: [{ticker, ms, score, question, marks}]
 */
export function dailyRollup(items, { source, method = METHOD, lexicon_sha = null, topN = 8 } = {}) {
  const by = new Map();
  for (const it of items) {
    const day = it.day || dayOf(it.ms);
    const tk = String(it.ticker || "").toUpperCase();
    if (!day || !tk) continue;
    const key = day + "|" + tk;
    let c = by.get(key);
    if (!c) { c = { day, ticker: tk, source, n: 0, scored: 0, bull: 0, bear: 0, unscored: 0, questions: 0, sum: 0, words: new Map() }; by.set(key, c); }
    c.n++;
    if (it.question) { c.questions++; continue; }
    if (typeof it.score !== "number" || !isFinite(it.score)) { c.unscored++; continue; }
    c.scored++; c.sum += it.score;
    if (it.score > 0) c.bull++; else if (it.score < 0) c.bear++;
    for (const m of it.marks || []) {
      const side = m.effect > 0 ? "bull" : "bear";
      const k = m.w + "|" + side;
      const w = c.words.get(k) || { w: m.w, side, n: 0, s: m.s || null };
      w.n++; if (!w.s && m.s) w.s = m.s;
      c.words.set(k, w);
    }
  }
  return [...by.values()].map((c) => ({
    day: c.day, ticker: c.ticker, source: c.source,
    score: c.scored ? +(c.sum / c.scored).toFixed(3) : null,
    n: c.n, scored: c.scored, bull: c.bull, bear: c.bear, unscored: c.unscored, questions: c.questions,
    top_keywords: [...c.words.values()].sort((a, b) => b.n - a.n || a.w.localeCompare(b.w)).slice(0, topN),
    method, lexicon_sha, weighting: WEIGHTING,
  })).sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : a.ticker.localeCompare(b.ticker)));
}

/** market-wide read for one day from the stored daily rows: the same stick, one level up */
export function marketRead(rows, { day = null } = {}) {
  const d = day || (rows.length ? rows.map((r) => r.day).sort().pop() : null);
  const today = rows.filter((r) => r.day === d && typeof r.score === "number" && isFinite(r.score));
  const items = today.reduce((a, r) => a + (r.scored || 0), 0);
  const score = items ? today.reduce((a, r) => a + r.score * r.scored, 0) / items : null;
  const bull = today.filter((r) => r.score > 0.08), bear = today.filter((r) => r.score < -0.08);
  const prevDay = [...new Set(rows.map((r) => r.day))].filter((x) => x < d).sort().pop() || null;
  const prev = rows.filter((r) => r.day === prevDay && typeof r.score === "number" && isFinite(r.score));
  const pItems = prev.reduce((a, r) => a + (r.scored || 0), 0);
  const pScore = pItems ? prev.reduce((a, r) => a + r.score * r.scored, 0) / pItems : null;
  return {
    day: d, prev_day: prevDay,
    score: score == null ? null : +score.toFixed(3),
    prev_score: pScore == null ? null : +pScore.toFixed(3),
    move: (score == null || pScore == null) ? null : +(score - pScore).toFixed(3),
    items, tickers: today.length,
    bull: bull.length, bear: bear.length,
    /* who moved it: item-weighted contribution, biggest absolute first */
    drivers: today.map((r) => ({ ticker: r.ticker, score: r.score, scored: r.scored, weight: items ? +(r.scored / items).toFixed(3) : 0,
        contribution: items ? +((r.score * r.scored) / items).toFixed(4) : 0,
        words: (r.top_keywords || []).slice(0, 3) }))
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)),
    weighting: WEIGHTING,
  };
}

/** words in plain English: "mood is mildly positive and firmer than yesterday" */
export function moodWords(read) {
  if (!read || read.score == null) return "no stored reading for this day yet";
  const s = read.score;
  const lean = s > 0.25 ? "positive" : s > 0.08 ? "mildly positive" : s < -0.25 ? "negative" : s < -0.08 ? "mildly negative" : "balanced";
  const mv = read.move == null ? null : read.move;
  const dir = mv == null ? "" : mv > 0.05 ? ", firmer than the day before" : mv < -0.05 ? ", softer than the day before" : ", about where it was the day before";
  return lean + dir;
}

/* ── IS IT A NEWS-DRIVEN MARKET? ───────────────────────────────────────────────
   Alan: "its a news driven market how do we parametrize that". One number, on the
   stored history only, with its sample size, and an honest refusal until there is
   enough history. pairs: [{day, ticker, score, ret}] — ret is that ticker's day move.  */
export const NEWSDRIVEN_MIN_DAYS = 10;
export const NEWSDRIVEN_MIN_PAIRS = 200;
export function newsDriven(pairs, { minDays = NEWSDRIVEN_MIN_DAYS, minPairs = NEWSDRIVEN_MIN_PAIRS } = {}) {
  const ok = pairs.filter((p) => typeof p.score === "number" && isFinite(p.score) && typeof p.ret === "number" && isFinite(p.ret));
  const days = [...new Set(ok.map((p) => p.day))].sort();
  const out = { pairs: ok.length, days: days.length, from: days[0] || null, to: days[days.length - 1] || null,
    minDays, minPairs, r: null, r2: null, explained_pct: null, enough: false, need: null };
  if (days.length < minDays || ok.length < minPairs) {
    out.need = "needs " + Math.max(0, minDays - days.length) + " more stored days and " +
      Math.max(0, minPairs - ok.length) + " more ticker-days before this number means anything";
    return out;
  }
  const n = ok.length;
  const mx = ok.reduce((a, p) => a + p.score, 0) / n, my = ok.reduce((a, p) => a + p.ret, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const p of ok) { const dx = p.score - mx, dy = p.ret - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  const r = (sxx > 0 && syy > 0) ? sxy / Math.sqrt(sxx * syy) : null;
  out.enough = true;
  out.r = r == null ? null : +r.toFixed(3);
  out.r2 = r == null ? null : +(r * r).toFixed(3);
  out.explained_pct = r == null ? null : Math.round(100 * r * r);
  return out;
}

/** 0..100 for the fear/greed dial: -1..+1 mapped linearly, clamped */
export function toScale(score) {
  if (typeof score !== "number" || !isFinite(score)) return null;
  return Math.round(50 + 50 * Math.max(-1, Math.min(1, score)));
}

/**
 * Roll scored headlines up the OLD way (kept so the Hub's 24-hour voice reading and
 * tests/news-sentiment.test.mjs keep their exact behaviour while the store fills).
 */
export function aggregate(rows, { now = Date.now(), windowMs = 3 * 86400e3 } = {}) {
  const inWin = rows.filter((r) => {
    const t = typeof r.published_ms === "number" ? r.published_ms : Number(r.published_ts) * 1000;
    return isFinite(t) && now - t <= windowMs && t <= now + 3600e3;
  });
  const questions = inWin.filter((r) => r.question).length;
  const scored = inWin.filter((r) => typeof r.score === "number" && isFinite(r.score) && !r.question);
  const byT = new Map();
  for (const r of scored) {
    const tk = String(r.ticker || "?").toUpperCase();
    const c = byT.get(tk) || { ticker: tk, sum: 0, n: 0, pos: 0, neg: 0 };
    c.sum += r.score; c.n++;
    if (r.score > 0) c.pos++; else if (r.score < 0) c.neg++;
    byT.set(tk, c);
  }
  const tickers = [...byT.values()].map((c) => ({ ticker: c.ticker, score: c.sum / c.n, n: c.n, pos: c.pos, neg: c.neg }))
    .sort((a, b) => b.n - a.n || a.ticker.localeCompare(b.ticker));
  return {
    score: scored.length ? scored.reduce((s, r) => s + r.score, 0) / scored.length : null,
    n: scored.length,
    unscored: inWin.length - scored.length - questions,
    questions,
    of: inWin.length,
    tickers,
    windowMs,
    weighting: "every scored headline counts once; questions are excluded; tickers are not equalised, so a heavily covered ticker moves it more",
  };
}

/* ── NEW YORK DAY BOUNDS ───────────────────────────────────────────────────────
   A stored item carries an epoch; a timeline carries a trading day. Both ends of the
   conversion live here so the function that writes a day and the page that reads it can
   never disagree by an hour. DST is read from the runtime, never assumed to be -4. */
export function etOffsetHours(dayISO) {
  const probe = new Date(String(dayISO) + "T17:00:00Z");   // 1pm ET either side of DST
  const s = new Intl.DateTimeFormat("en-US", { timeZone: DAY_TZ, timeZoneName: "shortOffset" }).format(probe);
  const m = /GMT([+-]\d{1,2})(?::(\d{2}))?/.exec(s);
  if (!m) return -5;
  return +m[1] + (m[2] ? (+m[1] < 0 ? -1 : 1) * (+m[2] / 60) : 0);
}
/** epoch SECONDS [from, to) covering one New York calendar day */
export function dayBounds(dayISO) {
  const off = etOffsetHours(dayISO);
  const midnightUTC = Date.parse(String(dayISO) + "T00:00:00Z");
  const from = Math.round((midnightUTC - off * 3600e3) / 1000);
  return { from, to: from + 86400, offset: off };
}

/* ── WHERE A TICKER WAS TALKED ABOUT ──────────────────────────────────────────
   A 40-minute transcript is not "about" one stock. The YouTube reading is taken over
   the words AROUND each mention, not over the whole video, so a bullish clip about one
   name cannot colour every ticker it happens to say. `radius` is words either side. */
export function mentionWindows(text, ticker, { radius = 40, names = [] } = {}) {
  const words = decode(text).split(/\s+/).filter(Boolean);
  const want = new Set([String(ticker || "").toLowerCase(), ...names.map((n) => String(n).toLowerCase())].filter(Boolean));
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i].toLowerCase().replace(/^[$#]/, "").replace(/[^a-z0-9'.-]/g, "");
    if (!want.has(w)) continue;
    out.push({ at: i, text: words.slice(Math.max(0, i - radius), i + radius + 1).join(" ") });
  }
  return out;
}
/** one reading for one (item, ticker): the mean of the windows that carried a word */
export function scoreMentions(text, ticker, L, opts = {}) {
  const wins = mentionWindows(text, ticker, opts);
  const scored = [];
  const marks = [];
  for (const w of wins) {
    const s = scoreText(w.text, L, { sentences: true });
    if (s.score != null) { scored.push(s.score); marks.push(...s.marks); }
  }
  const lean = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null;
  const pos = marks.filter((m) => m.effect > 0).length, neg = marks.filter((m) => m.effect < 0).length;
  const strongest = marks.length ? marks.reduce((a, b) => (Math.abs(b.effect) > Math.abs(a.effect) ? b : a), marks[0]) : null;
  return {
    mentions: wins.length, windows: scored.length,
    lean: lean == null ? null : +lean.toFixed(3),
    pos, neg, marks, sample: strongest ? strongest.s || null : null,
  };
}
/** the $TAGS a post names, uppercased and de-duplicated */
export function cashTags(text) {
  return [...new Set((String(text || "").match(/\$[A-Za-z]{1,6}\b/g) || []).map((t) => t.slice(1).toUpperCase()))];
}

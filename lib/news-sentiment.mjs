/* SCINTILLA · per-headline news sentiment (method "lm-v1").
   ONE definition of the reading, used by three callers:
     · jobs/news-sentiment/score_news.py   — writes news_headline_sentiment (the stored score)
     · index.html (SENTIMENT room)         — scores headlines in the browser until the table is filled
     · tests/news-sentiment.test.mjs       — fixtures both of the above are checked against
   The lexicon itself lives in data/news-lexicon/lm-headline-v1.json with its provenance, so the
   words can be read and argued with without reading any code.

   What it does NOT do: it does not read the article, it cannot hear irony or a question, and a
   headline with no lexicon word in it gets NO score — not a zero. Alan, 23 Sep: "The amount of
   headlines is not bullish or bearish until a transcript is reviewed." */

export const METHOD = "lm-v1";

/** tokenise the way both implementations must: lowercase words, apostrophes kept, URLs dropped */
export function decode(text) {
  /* feeds store HTML entities (BlackRock&#39;s, AT&amp;T). Turn them back into characters
     before scoring, or "amp" becomes a token and an apostrophe splits a word. */
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

/**
 * Score ONE headline (title, or title + snippet).
 * Returns every word that fired, which list it came from and whether a negator flipped it, so the
 * page can show the words underneath the number.
 */
export function scoreText(text, L) {
  const raw = String(text == null ? "" : text);
  /* A QUESTION IS NOT A CLAIM. "Is NVDA about to crash?" carries the word crash and says
     nothing. The score is still computed and shown, but a question never enters a total. */
  const question = /\?\s*$/.test(raw.split(".")[0].trim()) || /\?/.test(raw.split(".")[0]);
  const tk = tokens(text);
  const marks = [];
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
    marks.push({ i, w, list, polarity, negated, effect: eff });
  }
  const hits = pos + neg;
  return {
    method: L.method || METHOD,
    score: hits ? (pos - neg) / hits : null,   // balance, never a raw count; null = nothing fired
    question,
    pos, neg, flips, unc, hits,
    marks, tokens: tk,
    reason: hits ? null : "no lexicon word in this headline",
  };
}

/**
 * Roll scored headlines up. ONE weighting, stated on the page: every SCORED headline counts once.
 * A headline with no lexicon word is counted in `unscored` and never as a zero.
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

/** 0..100 for the fear/greed dial: -1..+1 mapped linearly, clamped */
export function toScale(score) {
  if (typeof score !== "number" || !isFinite(score)) return null;
  return Math.round(50 + 50 * Math.max(-1, Math.min(1, score)));
}

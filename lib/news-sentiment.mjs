/* SCINTILLA · per-headline news sentiment (method "lm-v1").
   THIS FILE NO LONGER HOLDS THE ARITHMETIC. Lane M41 moved the one definition to
   supabase/functions/_shared/sentiment-core.mjs, because the scorers now run as
   Supabase edge functions and Deno must read the SAME bytes the Hub and the tests
   read — two copies of a lexicon rule is how two screens end up disagreeing.
   Everything that imported this file keeps working: the names below are re-exported
   unchanged, and the stick is now written down in one place (WEIGHTING).
   Callers: index.html (SENTIMENT room), tests/news-sentiment.test.mjs, and
   jobs/news-sentiment/score_news.py which mirrors it against shared fixtures. */
export {
  METHOD, SCALE, WEIGHTING,
  decode, tokens, prepare, scoreText, aggregate, toScale,
  sentencesOf, sentenceAround,
  dayOf, dailyRollup, marketRead, moodWords,
  newsDriven, NEWSDRIVEN_MIN_DAYS, NEWSDRIVEN_MIN_PAIRS, DAY_TZ,
} from "../supabase/functions/_shared/sentiment-core.mjs";

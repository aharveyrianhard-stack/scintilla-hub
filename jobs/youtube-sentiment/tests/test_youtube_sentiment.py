#!/usr/bin/env python3
"""Offline tests for the YouTube sentiment job. No network, no YouTube, no database."""
import json, os, sys, tempfile, unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import youtube_sentiment as Y

WORDS = {"it", "on", "all", "app", "arm", "cat", "cost", "low", "now", "so", "well", "coin", "snow", "hood", "be"}
TICKERS = ["NVDA", "MU", "IT", "ON", "ALL", "APP", "AMD", "GOOGL", "COIN", "SPY", "TSM", "IREN"]
NAMES = {"NVDA": "NVIDIA Corp.", "MU": "Micron Technology, Inc.", "IT": "Gartner Inc.", "ON": "ON Semiconductor Corp.",
         "ALL": "Allstate Corp.", "APP": "AppLovin Corp.", "AMD": "Advanced Micro Devices, Inc.",
         "GOOGL": "Alphabet Inc.", "COIN": "Coinbase Global, Inc.", "SPY": "SPDR S&P 500 ETF Trust",
         "TSM": "Taiwan Semiconductor Manufacturing", "IREN": "IREN Ltd"}


def setup_aliases():
    Y.ALIAS = Y.build_aliases(TICKERS, NAMES, WORDS)
    return Y.alias_regex(Y.ALIAS), set(TICKERS)


class Disambiguation(unittest.TestCase):
    def test_english_word_tickers_need_context_or_cashtag(self):
        arx, tset = setup_aliases()
        f = Y.mentions_in_cased("IT is ON and ALL of this is APP-related", tset, WORDS, arx)
        self.assertEqual(sum(f.values()), 0, f)
        f = Y.mentions_in_cased("$IT $ON $ALL are my picks", tset, WORDS, arx)
        self.assertEqual(set(f), {"IT", "ON", "ALL"})
        f = Y.mentions_in_cased("ON stock breaks out; IT shares fall", tset, WORDS, arx)
        self.assertEqual(set(f), {"ON", "IT"})

    def test_plain_symbols_and_company_names(self):
        arx, tset = setup_aliases()
        f = Y.mentions_in_cased("NVDA earnings tonight, Micron next week, Alphabet and Coinbase too", tset, WORDS, arx)
        self.assertEqual(set(f), {"NVDA", "MU", "GOOGL", "COIN"})
        self.assertNotIn("COIN", Y.mentions_in_cased("a coin flip", tset, WORDS, arx))

    def test_transcript_spoken_symbols_need_finance_context(self):
        arx, tset = setup_aliases()
        spoken = {t for t in TICKERS if len(t) >= 3 and not Y.ambiguous(t, WORDS)}
        m = Y.mentions_in_transcript("so amd is a great company and nvidia keeps ripping", tset, WORDS, arx, spoken)
        self.assertEqual({t for t, _ in m}, {"AMD", "NVDA"})
        m = Y.mentions_in_transcript("amd went to the store", tset, WORDS, arx, spoken)
        self.assertEqual({t for t, _ in m}, {"AMD"}, "a token with no other meaning counts on its own")
        m = Y.mentions_in_transcript("the spy went to the theater wearing gold jewelry", tset, WORDS, arx, spoken)
        self.assertEqual({t for t, _ in m}, set(), "dictionary-word aliases need a finance word nearby")
        m = Y.mentions_in_transcript("spy is breaking out today", tset, WORDS, arx, spoken)
        self.assertEqual({t for t, _ in m}, {"SPY"})
        m = Y.mentions_in_transcript("micron is cheap and taiwan semi too", tset, WORDS, arx, spoken)
        self.assertEqual({t for t, _ in m}, {"MU", "TSM"})


class ChannelAndDictionary(unittest.TestCase):
    def test_own_channel_name_is_not_a_mention(self):
        names = dict(NAMES); names["ORLY"] = "O'Reilly Automotive, Inc."; names["TGT"] = "Target Corp."
        tickers = TICKERS + ["ORLY", "TGT"]
        Y.ALIAS = Y.build_aliases(tickers, names, WORDS | {"target"}); arx = Y.alias_regex(Y.ALIAS); tset = set(tickers)
        self.assertNotIn("target", Y.ALIAS, "single-word dictionary names are not aliases")
        self.assertIn("o'reilly", Y.ALIAS)
        f = Y.mentions_in_cased("Bill O'Reilly on the price target for NVDA", tset, WORDS, arx, channel="Bill O'Reilly")
        self.assertEqual(set(f), {"NVDA"})
        f = Y.mentions_in_cased("O'Reilly Automotive shares jump", tset, WORDS, arx, channel="TheStreet")
        self.assertEqual(set(f), {"ORLY"})


class Sentiment(unittest.TestCase):
    def test_lexicon_and_negation(self):
        self.assertEqual(Y.score_text("I am bullish, this is a breakout"), (2, 0))
        self.assertEqual(Y.score_text("this could crash, avoid it"), (0, 2))
        self.assertEqual(Y.score_text("I am not bullish here"), (0, 1), "negation flips the hit")
        self.assertEqual(Y.score_text("don't sell this"), (1, 0))
        self.assertEqual(Y.score_text("July 29 post market recap"), (0, 0), "neutral text scores nothing")
        self.assertEqual(Y.score_text("short squeeze incoming"), (1, 0), "phrase beats the bare word")
        self.assertEqual(Y.score_text("going short here"), (0, 1))

    def test_lean(self):
        self.assertIsNone(Y.lean(0, 0))
        self.assertEqual(Y.lean(3, 1), 0.5)
        self.assertEqual(Y.lean(1, 3), -0.5)
        self.assertIsNone(Y.lean(2, 0, min_hits=3))


class Aggregation(unittest.TestCase):
    def test_rows_from_injected_videos(self):
        tmp = tempfile.mkdtemp()
        Y.TR_DIR = os.path.join(tmp, "tr"); os.makedirs(Y.TR_DIR)
        vids = [
            {"video_id": "v1", "channel_title": "Chan A", "title": "NVDA breakout, buy the dip", "description": "",
             "published_at": "2026-09-22T10:00:00+00:00", "is_short": "False", "source": "subscription"},
            {"video_id": "v2", "channel_title": "Chan B", "title": "Market recap", "description": "",
             "published_at": "2026-09-21T10:00:00+00:00", "is_short": "False", "source": "subscription"},
            {"video_id": "v3", "channel_title": "Chan C", "title": "why I sold everything", "description": "",
             "published_at": "2026-09-20T10:00:00+00:00", "is_short": "True", "source": "subscription"},
        ]
        json.dump({"status": "ok", "chars": 60, "text": "nvidia stock looks weak and could crash, I am bearish on nvidia"},
                  open(os.path.join(Y.TR_DIR, "v2.json"), "w"))
        json.dump({"status": "ok", "chars": 40, "text": "micron is undervalued, strong buy, loading up on micron shares"},
                  open(os.path.join(Y.TR_DIR, "v3.json"), "w"))
        rows, vid_out, summary = Y.analyze(7, os.path.join(tmp, "out"), videos=vids, universe=(TICKERS, NAMES), words=WORDS)
        by = {r["ticker"]: r for r in rows}
        self.assertEqual(by["NVDA"]["posts"], 2)
        self.assertEqual(by["NVDA"]["bullish"], 1)
        self.assertEqual(by["NVDA"]["bearish"], 1)
        self.assertEqual(by["NVDA"]["last_video_id"], "v1", "latest mention wins")
        self.assertEqual(by["NVDA"]["last_channel"], "Chan A")
        self.assertEqual(by["MU"]["posts"], 1)
        self.assertEqual(by["MU"]["bullish"], 1)
        self.assertGreater(by["MU"]["score"], 0.2)
        self.assertEqual(summary["videos_with_transcript"], 2)
        self.assertEqual(summary["videos_without_transcript"], 1)
        for r in rows:
            for c in Y.BASE_COLS:
                self.assertIn(c, r)
            self.assertEqual(r["source"], "youtube")
        # a second analyze over the same inputs is byte-identical apart from timestamps
        rows2, _, _ = Y.analyze(7, os.path.join(tmp, "out2"), videos=vids, universe=(TICKERS, NAMES), words=WORDS)
        strip = lambda rs: [{k: v for k, v in r.items() if k != "updated_ts"} for r in rs]
        self.assertEqual(strip(rows), strip(rows2))


class ApplyShape(unittest.TestCase):
    def test_apply_refuses_without_key_and_never_prints_it(self):
        for k in ("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_KEY", "SUPABASE_ANON_KEY"):
            os.environ.pop(k, None)
        with self.assertRaises(SystemExit):
            Y.apply_rows([{"ticker": "NVDA"}], dry=True)

    def test_dry_run_touches_nothing(self):
        os.environ["SUPABASE_ANON_KEY"] = "test-key-not-real"
        calls = []
        Y.pg_write = lambda *a, **k: calls.append(a) or (400, "")
        res = Y.apply_rows([{"ticker": "NVDA", "bullish": 1, "bearish": 0, "posts": 1, "score": 0.5,
                             "updated_ts": 1, "source": "youtube"}], dry=True, with_extra=False)
        self.assertEqual(res.get("dry"), 1)
        self.assertEqual(calls, [], "dry run must not write")
        os.environ.pop("SUPABASE_ANON_KEY", None)


if __name__ == "__main__":
    unittest.main(verbosity=2)

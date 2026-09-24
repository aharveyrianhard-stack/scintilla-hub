/* GENERATED from data/scintilla-rules.json by scripts/build-scintilla-rules.mjs — do not edit by hand.
   The rules file is the one Alan changes; this copy exists only because an edge function ships
   with its own folder and cannot read the site's file. A test pins the two together. */
export const RULES = Object.freeze({
  "version": "2026-09-24.2",
  "what_this_is": "The rules that decide whether a day's move is a scintilla. Two families. STATISTICAL asks how the move compares with that name's OWN usual day; RAW asks whether the move is simply big. A move counts if EITHER family says so. Change a number here and both the detector and the Hub follow it — nothing else has to change.",
  "usual_day": {
    "sessions": 60,
    "how": "the spread (standard deviation) of the last 60 daily percentage moves, that name's own",
    "in_plain_words": "the size of a typical day for this name. About 1x is an ordinary day; 2x happens about 1 day in 20; 3x about 1 day in 370.",
    "min_sessions": 20,
    "why_min": "under twenty days a spread is a guess, so no scintilla is claimed at all"
  },
  "classes": {
    "index_etf": {
      "symbols": [
        "SPY",
        "QQQ",
        "QQQE",
        "DIA",
        "IWM",
        "MDY",
        "RSP",
        "VTI",
        "MAGS",
        "EEM",
        "EFA",
        "EWG",
        "EWJ",
        "EWU",
        "EWY",
        "EZU",
        "FXI",
        "MCHI",
        "ASHR",
        "TLT",
        "IEF",
        "SHY",
        "HYG",
        "LQD"
      ],
      "why": "whole markets, and the bond funds that behave like them: one name moving is a market event, not a company event"
    },
    "sector_etf": {
      "symbols": [
        "XLB",
        "XLC",
        "XLE",
        "XLF",
        "XLI",
        "XLK",
        "XLP",
        "XLRE",
        "XLU",
        "XLV",
        "XLY",
        "SMH",
        "SOXX",
        "GLD",
        "SLV",
        "USO",
        "GDX",
        "GDXJ",
        "COPX",
        "SIL",
        "SILJ"
      ],
      "why": "a slice of the market or one commodity: wider than an index, quieter than a single company"
    },
    "crypto": {
      "symbols": [
        "BTCUSD",
        "ETHUSD",
        "SOLUSD",
        "XRPUSD",
        "DOGEUSD",
        "ADAUSD",
        "LTCUSD"
      ],
      "why": "trades all week and its ordinary day is already large"
    },
    "futures": {
      "symbols": [
        "ESUSD",
        "NQUSD",
        "YMUSD",
        "RTYUSD",
        "CLUSD",
        "GCUSD",
        "SIUSD",
        "NGUSD",
        "HGUSD",
        "ZBUSD",
        "ZNUSD",
        "DXUSD"
      ],
      "why": "the index and commodity contracts the Station charts; they run overnight, so a day means the contract's own day"
    },
    "equity": {
      "default": true,
      "why": "anything not named above is a single company"
    }
  },
  "price": {
    "equity": {
      "x_usual": 2,
      "x_usual_needs_move_pct": 1,
      "raw_move_pct": 8,
      "why_x_usual": "2x its own usual day is about one day in twenty for that name",
      "why_needs_move": "a dead-flat name can print 4x its usual day on a 0.3% move; under 1% nothing is worth pointing at",
      "why_raw": "an 8% day on a single company is worth a look whatever its history says. MEASURED over the last 60 sessions: at 5% this floor alone fired about 15 times a day across a 125-name sample, at 8% about 4.8 — and it adds about 3.5 names a day the 2x rule misses"
    },
    "index_etf": {
      "x_usual": 2.5,
      "x_usual_needs_move_pct": 0.5,
      "raw_move_pct": 3,
      "why_x_usual": "a whole market wanders inside its own band most days, so the bar is higher than a single name's",
      "why_needs_move": "an index's usual day can be a third of a percent; below half a percent it is noise",
      "why_raw": "a whole market moving 3% in a day is a market event on its own. MEASURED: 1.5% fired about 3 a day across 24 funds, 3% about 0.6"
    },
    "sector_etf": {
      "x_usual": 2.5,
      "x_usual_needs_move_pct": 0.8,
      "raw_move_pct": 4,
      "why_x_usual": "a sector is a basket: one name inside it cannot carry the fund far, so far means something",
      "why_needs_move": "under 0.8% a sector fund has not really moved",
      "why_raw": "4% across a whole sector is a rotation, not a stock story. MEASURED: 2.5% fired about 4.3 a day across 21 funds, 4% about 1"
    },
    "crypto": {
      "x_usual": 3,
      "x_usual_needs_move_pct": 3,
      "raw_move_pct": 8,
      "why_x_usual": "crypto returns are fat-tailed: 2x its usual day happens often enough to be dull",
      "why_needs_move": "its ordinary day is already several percent",
      "why_raw": "8% is the size of move that changes the day's conversation. NOT MEASURED here: no crypto symbol is in the chart API universe yet"
    },
    "futures": {
      "x_usual": 2.5,
      "x_usual_needs_move_pct": 1,
      "raw_move_pct": 3.5,
      "why_x_usual": "index and commodity contracts behave like their underlying market",
      "why_needs_move": "under 1% a contract has not moved in any way worth a pointer",
      "why_raw": "3.5% in a session is a large move for a front-month contract. NOT MEASURED here: no futures symbol is in the chart API universe yet"
    }
  },
  "earnings": {
    "x_usual": 2,
    "min_past_reports": 4,
    "why": "the surprise is measured against that company's OWN past surprises; under four past reports there is nothing to measure against"
  },
  "econ": {
    "x_usual": 2,
    "min_past_prints": 4,
    "imminent_minutes": 15,
    "why": "actual minus estimate against that release's own past misses; imminent is the quarter of an hour before it prints"
  },
  "dilution": {
    "min_pct_of_shares_out": 1,
    "min_gross_usd": 100000000,
    "lookback_days": 3,
    "forms": [
      "8-K",
      "8-K/A",
      "424B5",
      "424B3",
      "424B4",
      "S-3",
      "S-3ASR",
      "S-1",
      "S-1/A"
    ],
    "patterns": [
      "convertible_notes",
      "note_exchange_for_shares",
      "registered_direct",
      "atm_program",
      "pipe",
      "warrant_exercise",
      "reverse_split"
    ],
    "why": "a company issuing shares makes every share already held own a little less of it. The size is the share count the filing itself gives, as a percentage of the shares outstanding — never a price move, so there is no 'usual' to divide by and no z-score is claimed.",
    "why_min_pct": "under 1% of the shares outstanding the arithmetic is real but the effect is inside an ordinary day's noise",
    "why_min_gross": "a filing that gives dollars but no share count (an at-the-market programme before any sale) still counts when it is large enough to matter to a big company: $100m",
    "why_lookback": "8-Ks are filed within four business days of the event, so a three-day window catches the filing on the morning it lands without re-reading the whole quarter",
    "excluded": {
      "structured_or_medium_term_notes": "form 424B2 and the banks' medium-term-note shelves: they sell debt, not shares",
      "resale_by_existing_holders": "a resale prospectus where the company says it will not receive any proceeds: the shares already exist",
      "repaid_or_redeemed_for_cash": "a convertible note paid off in cash is the OPPOSITE of dilution",
      "debt_for_debt_exchange": "old notes swapped for new notes issues no shares",
      "capped_call_only": "a capped call is bought to REDUCE the dilution of notes already issued"
    }
  },
  "measured": {
    "when": "2026-09-24",
    "how": "scripts/scintilla-rule-counts.mjs replays the last 60 sessions of daily bars from the chart API for every fund named here plus every 4th single name (125 of 364)",
    "per_day_on_that_sample": {
      "statistical": 3.47,
      "raw": 4.77,
      "either": 7.02,
      "median_either": 6,
      "busiest_day": 32
    },
    "note": "the sample is about a third of the universe, so expect roughly three times these counts across all 364 names"
  }
});
export const RULES_VERSION = "2026-09-24.2";

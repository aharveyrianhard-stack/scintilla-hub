#!/usr/bin/env python3
"""SCINTILLA · YouTube sentiment job (SCI-16 / SCI-26).

fetch    cache English transcripts for recent videos from the channels Alan subscribes to
         (youtube_videos.source = 'subscription'). Public timedtext track via
         youtube-transcript-api. ZERO YouTube Data API quota. A held transcript is never
         re-fetched.
analyze  per video: ticker mentions (disambiguated) + lexicon sentiment per ticker + overall
         tone. Per ticker over the window: videos, bullish/bearish counts, mean lean, latest
         mention. Writes rows.json / videos.json / summary.json.
apply    upsert per-ticker rows into public.social_sentiment through PostgREST. The write
         key is read from the ENVIRONMENT only (SUPABASE_SERVICE_ROLE_KEY, else SUPABASE_KEY,
         else SUPABASE_ANON_KEY). Never printed.
run      fetch -> analyze -> apply.

Python 3.9 compatible. Reads only: youtube_videos, cohorts, company_profile (anon).
Writes only: social_sentiment (and, once the migration exists, youtube_transcripts /
youtube_video_sentiment). Never a price table.
"""
import argparse, collections, datetime as dt, json, math, os, re, sys, time, urllib.error, urllib.request

SB_URL = os.environ.get("SUPABASE_URL", "https://wadinxqplrggagkvrdag.supabase.co")
HUB_URL = os.environ.get("HUB_URL", "https://scintillahub.ai/")
CACHE = os.environ.get("YT_SENT_CACHE", os.path.expanduser("~/Library/Application Support/scintilla/youtube-sentiment"))
TR_DIR = os.path.join(CACHE, "transcripts")
METHOD = "yt-lexicon-v1"
SOURCE = "youtube"
HERE = os.path.dirname(os.path.abspath(__file__))
ENV_FILE = os.environ.get("YT_SENT_ENV", os.path.expanduser("~/.config/scintilla/youtube-sentiment.env"))


def now_iso():
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def log(*a):
    print(now_iso(), *a, flush=True)


def load_env_file():
    """Optional env file for the scheduled run (root places the write key there once).
    Values are loaded into the process environment and never echoed."""
    if not os.path.exists(ENV_FILE):
        return
    for line in open(ENV_FILE):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


# ---------------------------------------------------------------- PostgREST
_ANON = None


def anon_key():
    """Read-only key. From the environment if set; otherwise the public key the Hub page
    itself serves to every browser (not a secret)."""
    global _ANON
    if _ANON:
        return _ANON
    k = os.environ.get("SUPABASE_ANON_KEY")
    if not k:
        html = urllib.request.urlopen(HUB_URL, timeout=30).read().decode("utf-8", "replace")
        m = re.search(r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}", html)
        if not m:
            raise SystemExit("anon key not found in hub page; set SUPABASE_ANON_KEY")
        k = m.group(0)
    _ANON = k
    return k


def pg_get(path, key=None, page=1000):
    key = key or anon_key()
    out, off = [], 0
    while True:
        req = urllib.request.Request(SB_URL + "/rest/v1/" + path, headers={
            "apikey": key, "Authorization": "Bearer " + key, "Range": "%d-%d" % (off, off + page - 1)})
        with urllib.request.urlopen(req, timeout=60) as r:
            chunk = json.load(r)
        out += chunk
        if len(chunk) < page:
            return out
        off += page


def pg_write(method, path, body, key, prefer):
    data = json.dumps(body).encode()
    req = urllib.request.Request(SB_URL + "/rest/v1/" + path, data=data, method=method, headers={
        "apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json", "Prefer": prefer})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            txt = r.read().decode("utf-8", "replace")
            return r.status, (json.loads(txt) if txt else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")[:300]


# ---------------------------------------------------------------- videos
def recent_videos(days, include_search=False):
    since = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    src = "" if include_search else "&source=eq.subscription"
    rows = pg_get("youtube_videos?select=video_id,channel_title,channel_id,title,description,published_at,"
                  "is_short,duration_sec,source,subscription_accounts,ticker&published_at=gte." + since + src +
                  "&order=published_at.desc")
    seen, out = set(), []
    for r in rows:
        if r["video_id"] in seen:
            continue
        seen.add(r["video_id"])
        out.append(r)
    return out


# ---------------------------------------------------------------- transcripts
NONE_ERRORS = {"NoTranscriptFound", "TranscriptsDisabled", "NotTranslatable", "VideoUnavailable",
               "AgeRestricted", "VideoUnplayable", "InvalidVideoId", "TranslationLanguageNotAvailable"}
BLOCK_ERRORS = {"IpBlocked", "RequestBlocked", "TooManyRequests"}


def transcript_path(vid):
    return os.path.join(TR_DIR, vid + ".json")


def held_transcript(vid):
    p = transcript_path(vid)
    if not os.path.exists(p):
        return None
    try:
        return json.load(open(p))
    except Exception:
        return None


def fetch_transcripts(videos, limit=None, pause=1.0, retry_after_h=24.0):
    from youtube_transcript_api import YouTubeTranscriptApi
    api = YouTubeTranscriptApi()
    os.makedirs(TR_DIR, exist_ok=True)
    stats, n = collections.Counter(), 0
    for v in videos:
        vid = v["video_id"]
        c = held_transcript(vid)
        if c:
            if c.get("status") == "ok":
                stats["held"] += 1
                continue
            if (time.time() - c.get("fetched_epoch", 0)) / 3600 < retry_after_h:
                stats["skip_recent_" + str(c.get("status"))] += 1
                continue
        if limit and n >= limit:
            break
        n += 1
        rec = {"video_id": vid, "fetched_at": now_iso(), "fetched_epoch": time.time(),
               "source": "youtube timedtext via youtube-transcript-api", "channel": v.get("channel_title")}
        try:
            tl = api.list(vid)
            tr = tl.find_transcript(["en", "en-US", "en-GB"])
            data = tr.fetch().to_raw_data()
            text = " ".join(s.get("text", "") for s in data)
            rec.update(status="ok", lang=tr.language_code, generated=bool(tr.is_generated),
                       segments=len(data), chars=len(text), text=text)
            stats["ok"] += 1
        except Exception as e:  # classify by exception class; never let one video stop the run
            name = type(e).__name__
            if name in NONE_ERRORS:
                rec.update(status="none", error=name)
                stats["none"] += 1
            else:
                rec.update(status="error", error=name + ": " + str(e)[:200])
                stats["error"] += 1
                if name in BLOCK_ERRORS:
                    json.dump(rec, open(transcript_path(vid), "w"))
                    log("STOP: YouTube is refusing requests (%s); ending this pass" % name)
                    break
        json.dump(rec, open(transcript_path(vid), "w"))
        log(vid, rec["status"], rec.get("chars", rec.get("error", "")), "|", v.get("channel_title"))
        time.sleep(pause)
    return dict(stats)


# ---------------------------------------------------------------- universe + aliases
GENERIC = set("""american united general first bank global advanced international national new the digital
energy capital financial group holdings trust health micro super alpha beta one two big best real true open
fast live blue gold silver oil air auto cloud data power solar star sun tech technology technologies systems
semiconductor semiconductors industries services resources partners pharma pharmaceuticals therapeutics
biosciences labs media entertainment motors materials mining metals royalty realty properties street point
mobile logistics world vanguard ishares spdr invesco direxion proshares select sector index fund etf
corporation company inc ltd plc co class common stock shares trust reit lp llc sa nv ag se limited
incorporated brands foods home city texas pacific atlantic southern northern western eastern central""".split())
SUFFIX = re.compile(r"\b(inc\.?|incorporated|corp\.?|corporation|co\.?|company|ltd\.?|limited|plc|holdings?|"
                    r"group|class [abc]|common stock|the|s\.?a\.?|n\.?v\.?|a\.?g\.?|s\.?e\.?|trust|lp|llc)\b", re.I)
CURATED = {
    "google": "GOOGL", "alphabet": "GOOGL", "nvidia": "NVDA", "micron": "MU", "tesla": "TSLA", "apple": "AAPL",
    "amazon": "AMZN", "microsoft": "MSFT", "meta": "META", "facebook": "META", "netflix": "NFLX", "tsmc": "TSM",
    "taiwan semi": "TSM", "taiwan semiconductor": "TSM", "intel": "INTC", "broadcom": "AVGO", "palantir": "PLTR",
    "coinbase": "COIN", "microstrategy": "MSTR", "s&p 500": "SPY", "s and p 500": "SPY", "s&p": "SPY",
    "spy": "SPY", "nasdaq 100": "QQQ", "the nasdaq": "QQQ", "qqq": "QQQ", "the q's": "QQQ", "nebius": "NBIS",
    "iris energy": "IREN", "iren": "IREN", "bitcoin": "BTCUSD", "btc": "BTCUSD", "gold": "GCUSD",
    "silver": "SIUSD", "crude oil": "USO", "crude": "USO", "the vix": "VIX", "vix": "VIX", "oracle": "ORCL",
    "amd": "AMD", "super micro": "SMCI", "supermicro": "SMCI", "arm holdings": "ARM", "uber": "UBER",
    "sofi": "SOFI", "robinhood": "HOOD", "salesforce": "CRM", "costco": "COST", "walmart": "WMT",
    "home depot": "HD", "boeing": "BA", "disney": "DIS", "paypal": "PYPL", "shopify": "SHOP",
    "snowflake": "SNOW", "crowdstrike": "CRWD", "datadog": "DDOG", "servicenow": "NOW", "applovin": "APP",
    "alibaba": "BABA", "caterpillar": "CAT", "john deere": "DE", "deere": "DE", "ford": "F",
    "general motors": "GM", "goldman sachs": "GS", "goldman": "GS", "lowe's": "LOW", "lowes": "LOW",
    "mastercard": "MA", "visa": "V", "altria": "MO", "southern company": "SO", "at&t": "T",
    "waste management": "WM", "welltower": "WELL", "fastenal": "FAST", "bloom energy": "BE",
    "cifr": "CIFR", "cipher mining": "CIFR", "core scientific": "CORZ", "marathon digital": "MARA",
    "riot platforms": "RIOT", "hut 8": "HUT", "eli lilly": "LLY", "lilly": "LLY", "novo nordisk": "NVO",
    "berkshire": "BRK.B", "jp morgan": "JPM", "jpmorgan": "JPM", "exxon": "XOM", "chevron": "CVX",
    "lockheed": "LMT", "rtx": "RTX", "raytheon": "RTX", "pfizer": "PFE", "moderna": "MRNA",
    "rocket lab": "RKLB", "rivian": "RIVN", "lucid": "LCID", "nio": "NIO", "sea limited": "SE", "spotify": "SPOT",
    "unitedhealth": "UNH", "united health": "UNH", "starbucks": "SBUX", "nike": "NKE", "mcdonald's": "MCD",
    "mcdonalds": "MCD", "chipotle": "CMG", "carvana": "CVNA", "gamestop": "GME", "amc": "AMC",
    "reddit": "RDDT", "cava": "CAVA", "hims": "HIMS", "oklo": "OKLO", "vistra": "VST", "constellation": "CEG",
    "arista": "ANET", "marvell": "MRVL", "qualcomm": "QCOM", "texas instruments": "TXN", "lam research": "LRCX",
    "applied materials": "AMAT", "kla": "KLAC", "asml": "ASML", "dell": "DELL", "ibm": "IBM", "cisco": "CSCO",
    "adobe": "ADBE", "intuit": "INTU", "workday": "WDAY", "zscaler": "ZS", "cloudflare": "NET", "okta": "OKTA",
    "mongodb": "MDB", "twilio": "TWLO", "unity": "U", "roblox": "RBLX", "draftkings": "DKNG", "airbnb": "ABNB",
    "doordash": "DASH", "block": "XYZ", "affirm": "AFRM", "upstart": "UPST", "lemonade": "LMND",
    "tempus": "TEM", "recursion": "RXRX", "soundhound": "SOUN", "bigbear": "BBAI", "c3": "AI", "c3.ai": "AI",
    "ionq": "IONQ", "rigetti": "RGTI", "d-wave": "QBTS", "quantum computing inc": "QUBT", "archer": "ACHR",
    "joby": "JOBY", "astera": "ALAB", "credo": "CRDO", "celestica": "CLS", "vertiv": "VRT", "coherent": "COHR",
    "lumentum": "LITE", "sandisk": "SNDK", "western digital": "WDC", "seagate": "STX", "pure storage": "PSTG",
    "nutanix": "NTNX", "gitlab": "GTLB", "confluent": "CFLT", "hubspot": "HUBS", "samsara": "IOT",
    "toast": "TOST", "duolingo": "DUOL", "sezzle": "SEZL", "dave": "DAVE", "root": "ROOT", "kinsale": "KNSL",
    "uranium energy": "UEC", "cameco": "CCJ", "energy fuels": "UUUU", "centrus": "LEU", "nuscale": "SMR",
    "lightbridge": "LTBR", "nano nuclear": "NNE", "ge vernova": "GEV", "ge aerospace": "GE", "eaton": "ETN",
    "quanta": "PWR", "first solar": "FSLR", "enphase": "ENPH", "tan": "TAN", "sqqq": "SQQQ", "tqqq": "TQQQ",
    "soxl": "SOXL", "smh": "SMH", "soxx": "SOXX", "iwm": "IWM", "the russell": "IWM", "russell 2000": "IWM",
    "dia": "DIA", "the dow": "DIA", "tlt": "TLT", "hyg": "HYG", "gld": "GLD", "slv": "SLV", "uso": "USO",
    "ung": "UNG", "natural gas": "UNG", "xle": "XLE", "xlf": "XLF", "xlk": "XLK", "arkk": "ARKK", "btc": "BTCUSD",
    "ethereum": "ETHUSD", "eth": "ETHUSD", "solana": "SOLUSD", "dollar index": "DXY", "the dollar": "DXY", "dxy": "DXY",
}
# aliases whose plain-English reading is common: these need a finance word nearby, like ambiguous symbols
RISKY_ALIASES = set("""gold silver crude block root unity dave spy tan arm snow hood coin app toast dash
constellation c3 key fast low cost well now be so visa affirm lucid credo quanta""".split()) | {"the dollar"}
FINANCE_CTX = set("""stock stocks share shares ticker calls puts options earnings buy bought buying sell sold
selling short long position price target pt chart breakout dip rally market cap valuation upgrade downgrade
trade trading hold holding portfolio investing invest bullish bearish rip dump pump squeeze etf index
company shareholders revenue guidance quarter breaking futures premarket afterhours resistance support
candle candles ath calls puts squeeze""".split())


def load_words():
    p = "/usr/share/dict/words"
    if not os.path.exists(p):
        return set()
    return set(w.strip().lower() for w in open(p, errors="ignore") if w.strip())


def build_universe():
    coh = pg_get("cohorts?select=ticker,cohort")
    prof = pg_get("company_profile?select=ticker,name")
    tickers = set(r["ticker"] for r in coh if r.get("ticker")) | set(r["ticker"] for r in prof if r.get("ticker"))
    names = {r["ticker"]: (r.get("name") or "") for r in prof}
    return sorted(tickers), names


def build_aliases(tickers, names, words):
    """alias(lowercase phrase) -> ticker. Company names from company_profile plus a curated
    colloquial list; generic first words and collisions are dropped."""
    tset = set(tickers)
    alias = {}
    first = collections.defaultdict(set)
    for t, nm in names.items():
        if t not in tset or not nm or nm.upper() == t:
            continue
        base = SUFFIX.sub(" ", nm.lower())
        base = re.sub(r"[^a-z0-9&'\.\- ]", " ", base)
        base = re.sub(r"\s+", " ", base).strip(" .-")
        # a one-word name that is also an English word ("target", "apple") is only allowed via CURATED
        if len(base) >= 4 and base not in GENERIC and (" " in base or base not in words):
            alias.setdefault(base, t)
        w = base.split(" ")[0] if base else ""
        if len(w) >= 5 and w not in GENERIC and w not in words:
            first[w].add(t)
    for w, ts in first.items():
        if len(ts) == 1:
            alias.setdefault(w, next(iter(ts)))
    for a, t in CURATED.items():
        if t in tset:
            alias[a] = t
    return alias


def alias_regex(alias):
    keys = sorted(alias, key=len, reverse=True)
    return re.compile(r"(?<![a-z0-9])(" + "|".join(re.escape(k) for k in keys) + r")(?![a-z0-9])", re.I)


def ambiguous(t, words):
    return len(t) <= 2 or t.lower() in words


# ---------------------------------------------------------------- sentiment lexicon
BULL = """bullish buy buying bought accumulate accumulating undervalued cheap breakout break out breaking out
rally rallying surge surging soar soaring moon mooning upgrade upgraded beat beats blowout strong strength
outperform record high all-time high all time high new high new highs higher high uptrend momentum recover
recovery rebound bounce bouncing green gains gain up big upside opportunity winner winning top pick going long
add adding load up short squeeze growth growing profitable profit profits cash flow tailwind tailwinds
optimistic confident catalyst catalysts explode exploding skyrocket rip ripping doubled tripled support held
holding support bottomed bottom is in oversold buy the dip best stock great company love this i like
favorite bull case""".split("\n")
BEAR = """bearish sell selling sold dump dumping overvalued expensive bubble crash crashing collapse collapsing
plunge plunging plummet tank tanking downgrade downgraded miss missed weak weakness underperform new low
new lows lower low downtrend breakdown break down breaking down correction selloff sell-off sell off losses
loss losing down big downside risky danger dangerous warning trouble worst loser avoid trap red flag disaster
panic fear slump sinks sinking falling fell drop dropping dropped decline declining shorting going short puts
headwind headwinds pessimistic worried worry concern concerned bankrupt bankruptcy fraud lawsuit layoffs
recession rejected rejection overbought top is in topped take profits taking profits bear case dilution
default""".split("\n")


def _phrases(block):
    # entries are space separated words, but multi-word phrases are listed as-is; split on
    # two-or-more spaces is not available, so we keep a curated explicit phrase list here.
    out = set()
    for line in block:
        out.update(w for w in line.split(" ") if w)
    return out


BULL_PHRASES = {"break out", "breaking out", "record high", "all-time high", "all time high", "new high",
                "new highs", "higher high", "up big", "top pick", "going long", "load up", "short squeeze",
                "cash flow", "support held", "holding support", "bottom is in", "buy the dip", "best stock",
                "great company", "love this", "i like", "bull case"}
BEAR_PHRASES = {"new low", "new lows", "lower low", "break down", "breaking down", "sell-off", "sell off",
                "down big", "red flag", "going short", "top is in", "take profits", "taking profits",
                "bear case"}
BULL_WORDS = (_phrases(BULL) - set(w for p in BULL_PHRASES for w in p.split())) | set()
BEAR_WORDS = (_phrases(BEAR) - set(w for p in BEAR_PHRASES for w in p.split())) | set()
# words that only exist inside phrases must not score alone
for _w in ("out", "record", "all", "time", "new", "high", "higher", "up", "big", "top", "pick", "going", "long",
           "load", "short", "cash", "flow", "support", "held", "holding", "bottom", "is", "in", "the", "dip",
           "best", "stock", "great", "company", "love", "this", "i", "like", "bull", "case", "low", "lows",
           "lower", "down", "red", "flag", "take", "taking", "profits", "bear", "sell", "off", "break",
           "breaking"):
    BULL_WORDS.discard(_w)
    BEAR_WORDS.discard(_w)
BULL_WORDS |= {"buy", "sell"} & set()  # placeholder to keep sets explicit
BEAR_WORDS |= {"sell", "selling", "sold"}
BULL_WORDS |= {"buy", "buying", "bought"}
NEG = {"not", "no", "never", "don't", "dont", "isn't", "isnt", "wasn't", "wasnt", "won't", "wont", "can't",
       "cant", "without", "hardly", "barely", "doesn't", "doesnt", "didn't", "didnt", "aren't", "arent"}
_LEX_RE = None


def lex_re():
    global _LEX_RE
    if _LEX_RE is None:
        items = sorted(BULL_PHRASES | BEAR_PHRASES | BULL_WORDS | BEAR_WORDS, key=len, reverse=True)
        _LEX_RE = re.compile(r"(?<![a-z])(" + "|".join(re.escape(i) for i in items) + r")(?![a-z])")
    return _LEX_RE


def score_text(text):
    """Return (bull_hits, bear_hits). Negation within the 3 preceding tokens flips a hit."""
    t = text.lower()
    bull = bear = 0
    for m in lex_re().finditer(t):
        hit = m.group(1)
        before = re.findall(r"[a-z']+", t[max(0, m.start() - 40):m.start()])[-3:]
        neg = any(b in NEG for b in before)
        is_bull = hit in BULL_PHRASES or hit in BULL_WORDS
        if neg:
            is_bull = not is_bull
        if is_bull:
            bull += 1
        else:
            bear += 1
    return bull, bear


def lean(bull, bear, min_hits=1):
    tot = bull + bear
    if tot < min_hits:
        return None
    return round((bull - bear) / tot, 3)


# ---------------------------------------------------------------- mention extraction
WORD_RE = re.compile(r"[A-Za-z0-9$&'\.\-]+")


def own_channel(alias, channel):
    return bool(channel) and alias in channel.lower()


def mentions_in_cased(text, tset, words, arx, channel=""):
    """Title/description keep case: cashtags always count; UPPER symbols count unless the
    symbol is an English word (then a finance word must sit within 3 tokens); aliases count."""
    found = collections.Counter()
    for m in re.finditer(r"\$([A-Za-z]{1,5})\b", text):
        t = m.group(1).upper()
        if t in tset:
            found[t] += 1
    toks = WORD_RE.findall(text)
    for i, tok in enumerate(toks):
        if tok in tset and tok.isupper() and tok.isalpha():
            if not ambiguous(tok, words):
                found[tok] += 1
            else:
                ctx = [x.lower() for x in toks[max(0, i - 3):i + 4]]
                if any(c.strip(".,") in FINANCE_CTX for c in ctx):
                    found[tok] += 1
    for m in arx.finditer(text):
        a = m.group(1).lower()
        if own_channel(a, channel):
            continue
        if a in RISKY_ALIASES:
            ctx = [x.lower().strip(".,") for x in WORD_RE.findall(text[max(0, m.start() - 40):m.end() + 40])]
            if not any(c in FINANCE_CTX for c in ctx):
                continue
        found[ALIAS[a]] += 1
    return found


def mentions_in_transcript(text, tset, words, arx, spoken, channel=""):
    """Auto-captions are uncased. Aliases count; spoken symbols (>=3 letters, not an English
    word) count only with a finance word within 6 tokens. Returns [(ticker, char_pos)]."""
    out = []
    low = text.lower()
    for m in arx.finditer(low):
        a = m.group(1)
        if own_channel(a, channel):
            continue
        if a in RISKY_ALIASES:
            ctx = re.findall(r"[a-z&'\.\-]+", low[max(0, m.start() - 60):m.end() + 60])
            if not any(c in FINANCE_CTX for c in ctx):
                continue
        out.append((ALIAS[a], m.start()))
    toks = [(m.group(0), m.start()) for m in re.finditer(r"[a-z0-9&'\.\-]+", low)]
    for i, (tok, pos) in enumerate(toks):
        up = tok.upper()
        if up in spoken:
            ctx = [x for x, _ in toks[max(0, i - 6):i + 7]]
            if any(c in FINANCE_CTX for c in ctx):
                out.append((up, pos))
    return out


ALIAS = {}


def analyze(days, out_dir, min_video_hits=1, videos=None, universe=None, words=None):
    """videos/universe/words may be injected for offline tests."""
    global ALIAS
    words = load_words() if words is None else words
    tickers, names = build_universe() if universe is None else universe
    tset = set(tickers)
    ALIAS = build_aliases(tickers, names, words)
    arx = alias_regex(ALIAS)
    spoken = set(t for t in tickers if len(t) >= 3 and t.isalpha() and not ambiguous(t, words))
    videos = recent_videos(days) if videos is None else videos
    per_ticker = collections.defaultdict(lambda: {"videos": [], "mentions": 0})
    vid_out = []
    for v in videos:
        title = v.get("title") or ""
        desc = v.get("description") or ""
        tr = held_transcript(v["video_id"]) or {}
        text = tr.get("text") if tr.get("status") == "ok" else ""
        cased = title + "\n" + desc
        found = collections.Counter()
        windows = collections.defaultdict(list)  # ticker -> [ (bull, bear) ]
        cb, cr = score_text(cased)
        chan = v.get("channel_title") or ""
        for t, n in mentions_in_cased(cased, tset, words, arx, chan).items():
            found[t] += n
            windows[t].append((cb, cr))
        if text:
            toks_pos = mentions_in_transcript(text, tset, words, arx, spoken, chan)
            for t, pos in toks_pos:
                found[t] += 1
                win = text[max(0, pos - 260):pos + 260]     # ~ +/- 40 words
                windows[t].append(score_text(win))
        tb, trr = score_text(cased + "\n" + (text or ""))
        tone = lean(tb, trr, min_hits=3)
        rec = {"video_id": v["video_id"], "channel": v.get("channel_title"), "title": title,
               "published_at": v.get("published_at"), "is_short": str(v.get("is_short")).lower() == "true",
               "transcript": tr.get("status", "absent"), "chars": tr.get("chars", 0),
               "tone": tone, "tone_hits": [tb, trr], "tickers": {}}
        for t, n in found.items():
            leans = [lean(b, r) for b, r in windows[t]]
            leans = [x for x in leans if x is not None]
            tl = round(sum(leans) / len(leans), 3) if leans else None
            rec["tickers"][t] = {"mentions": n, "lean": tl, "windows": len(windows[t])}
            per_ticker[t]["videos"].append({"video_id": v["video_id"], "channel": v.get("channel_title"),
                                            "published_at": v.get("published_at"), "title": title,
                                            "mentions": n, "lean": tl})
            per_ticker[t]["mentions"] += n
        vid_out.append(rec)
    rows = []
    ts = int(time.time())
    for t, d in per_ticker.items():
        vids = sorted(d["videos"], key=lambda x: x["published_at"] or "", reverse=True)
        leans = [x["lean"] for x in vids if x["lean"] is not None]
        bull = sum(1 for x in leans if x >= 0.2)
        bear = sum(1 for x in leans if x <= -0.2)
        score = round(sum(leans) / len(leans), 2) if leans else None
        latest = vids[0]
        rows.append({"ticker": t, "bullish": bull, "bearish": bear, "posts": len(vids), "score": score,
                     "updated_ts": ts, "source": SOURCE,
                     # extra columns: written only when the migration exists (see sql/)
                     "last_video_id": latest["video_id"], "last_channel": latest["channel"],
                     "last_published_at": latest["published_at"], "window_days": days, "method": METHOD,
                     "mentions": d["mentions"], "undetermined": len(vids) - len(leans)})
    rows.sort(key=lambda r: (-r["posts"], r["ticker"]))
    summary = {"computed_at": now_iso(), "window_days": days, "method": METHOD,
               "videos_in_window": len(videos),
               "videos_with_transcript": sum(1 for r in vid_out if r["transcript"] == "ok"),
               "videos_without_transcript": sum(1 for r in vid_out if r["transcript"] != "ok"),
               "videos_with_any_ticker": sum(1 for r in vid_out if r["tickers"]),
               "tickers_with_rows": len(rows), "universe": len(tickers), "aliases": len(ALIAS),
               "channels": sorted(set(v.get("channel_title") or "" for v in videos)),
               "how_sentiment_is_computed": (
                   "Keyword lexicon (finance-tuned bullish/bearish words and phrases) counted inside a "
                   "+/-40-word window around each ticker mention in the transcript, and over the title+"
                   "description for mentions found there. A negation word in the 3 tokens before a hit "
                   "flips it. Window lean = (bull-bear)/(bull+bear). Video lean per ticker = mean of its "
                   "window leans; a video is bullish at >= +0.2, bearish at <= -0.2. Per-ticker score = mean "
                   "video lean over the window. Not an AI read; no model call."),
               "what_would_make_it_wrong": [
                   "sarcasm, rhetorical questions and hedged language are read literally",
                   "a host quoting a bearish headline while being bullish scores bearish",
                   "auto-captions mishear names (e.g. 'micron' vs 'my crown'); missed or phantom mentions",
                   "company aliases only cover the profile names plus a curated list; a nickname not in it is missed",
                   "a mention window can contain talk about a different ticker",
                   "short videos with 1-2 lexicon hits get a strong lean from very little evidence",
                   "videos without an English transcript are scored on title+description only"]}
    os.makedirs(out_dir, exist_ok=True)
    json.dump(rows, open(os.path.join(out_dir, "rows.json"), "w"), indent=1)
    json.dump(vid_out, open(os.path.join(out_dir, "videos.json"), "w"), indent=1)
    json.dump(summary, open(os.path.join(out_dir, "summary.json"), "w"), indent=1)
    json.dump(ALIAS, open(os.path.join(out_dir, "aliases.json"), "w"), indent=1, sort_keys=True)
    log("analyze:", json.dumps({k: summary[k] for k in ("videos_in_window", "videos_with_transcript",
                                                        "videos_with_any_ticker", "tickers_with_rows")}))
    return rows, vid_out, summary


# ---------------------------------------------------------------- apply
BASE_COLS = ["ticker", "bullish", "bearish", "posts", "score", "updated_ts", "source"]
EXTRA_COLS = ["last_video_id", "last_channel", "last_published_at", "window_days", "method"]


def write_key():
    for k in ("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_KEY", "SUPABASE_ANON_KEY"):
        if os.environ.get(k):
            return os.environ[k], k
    return None, None


def apply_rows(rows, dry=False, with_extra=None):
    key, used = write_key()
    if not key:
        raise SystemExit("no write key in environment (SUPABASE_SERVICE_ROLE_KEY / SUPABASE_KEY / SUPABASE_ANON_KEY)")
    log("apply: using key from env var", used, "| rows", len(rows), "| dry" if dry else "")
    if with_extra is None:  # does the migration exist? probe one extra column read-only
        st, _ = pg_write("GET", "social_sentiment?select=" + ",".join(EXTRA_COLS) + "&limit=1", None, anon_key(), "")
        with_extra = st in (200, 206)
    cols = BASE_COLS + (EXTRA_COLS if with_extra else [])
    log("apply: columns", ",".join(cols))
    res = collections.Counter()
    for r in rows:
        payload = {c: r.get(c) for c in cols}
        if dry:
            res["dry"] += 1
            continue
        st, body = pg_write("PATCH", "social_sentiment?ticker=eq." + r["ticker"] + "&source=eq." + SOURCE,
                            payload, key, "return=representation")
        if st in (200,) and isinstance(body, list) and body:
            res["updated"] += 1
            continue
        if st in (200, 204) and not body:
            st, body = pg_write("POST", "social_sentiment", payload, key, "return=minimal")
            if st in (200, 201):
                res["inserted"] += 1
                continue
        res["failed"] += 1
        res["last_error"] = "%s %s" % (st, str(body)[:160])
        if st in (401, 403):
            log("apply STOP: write refused (%s) for key %s — %s" % (st, used, str(body)[:200]))
            break
    log("apply:", dict(res))
    return dict(res)



# ---------------------------------------------------------------- cli
def main(argv=None):
    load_env_file()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["fetch", "analyze", "apply", "run"])
    ap.add_argument("--days", type=int, default=7)
    ap.add_argument("--limit", type=int, default=None, help="max NEW transcript fetches this pass")
    ap.add_argument("--pause", type=float, default=1.0)
    ap.add_argument("--out", default=os.path.join(CACHE, "out"))
    ap.add_argument("--rows", default=None, help="rows.json to apply (default: <out>/rows.json)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-shorts", action="store_true", help="skip Shorts when fetching transcripts")
    a = ap.parse_args(argv)
    if a.cmd in ("fetch", "run"):
        vids = recent_videos(a.days)
        if a.no_shorts:
            vids = [v for v in vids if str(v.get("is_short")).lower() != "true"]
        log("fetch: %d videos in %d-day window" % (len(vids), a.days))
        log("fetch:", json.dumps(fetch_transcripts(vids, a.limit, a.pause)))
    if a.cmd in ("analyze", "run"):
        analyze(a.days, a.out)
    if a.cmd in ("apply", "run"):
        rows = json.load(open(a.rows or os.path.join(a.out, "rows.json")))
        apply_rows(rows, dry=a.dry_run)


if __name__ == "__main__":
    main()

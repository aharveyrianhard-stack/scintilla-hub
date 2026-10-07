# PF1 · downloads everything the study needs and writes compact panels under ../data/.
# Bars: the chart API's daily candles (public read, split-adjusted, no key). Dividends: the Hub's own public read of the
# `dividends` table (the page's own browser key, read from index.html at run time and never printed). Cash: the chart API's
# US3M (3-month Treasury bill yield). Nothing is written anywhere except ../data/ and the raw cache folder.
import json, os, re, sys, time, gzip, urllib.request, urllib.parse, datetime
from concurrent.futures import ThreadPoolExecutor
import numpy as np, pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "..", "data"); ROOT = os.path.join(HERE, "..", "..", "..", "..")
CACHE = os.environ.get("PF1_CACHE") or os.path.join(DATA, "_raw"); os.makedirs(CACHE, exist_ok=True)
API = "https://scintilla-massive-chart-api.fly.dev"; END = "2026-10-05"   # last settled close used everywhere

INDEX = ["SPY", "QQQ", "IWM", "RSP", "SMH"]
SECTORS = ["XLK", "XLV", "XLF", "XLY", "XLI", "XLB", "XLE", "XLP", "XLU", "XLRE", "XLC"]
BONDS = ["IEF", "TLT", "SHY"]
OTHER = ["EFA"]                                   # only for the classic Antonacci check (US vs non-US)
# "AI leaders" = the Hub's Magnificent 7 cohort + the AI names the Lab has reviewed lines for (LB1). Chosen from our own lists,
# and chosen TODAY: any test on them carries hindsight, which the page says wherever they appear.
LEADERS = ["NVDA", "MSFT", "AAPL", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "MU", "VST", "BE", "NBIS", "CRWV"]
MACRO = ["US3M", "VIX"]
SYMS = INDEX + SECTORS + BONDS + OTHER + LEADERS + MACRO

def fetch(sym):
    f = os.path.join(CACHE, sym + ".json")
    if os.path.exists(f): return sym, json.load(open(f))
    url = f"{API}/candles?symbol={urllib.parse.quote(sym)}&tf=D&limit=6000&authority=provider"; err = None
    for att in range(4):
        try:
            r = urllib.request.Request(url, headers={"Origin": "https://scintillahub.ai", "Accept-Encoding": "identity"})
            d = json.load(urllib.request.urlopen(r, timeout=90)); break
        except Exception as e: err = str(e)[:90]; d = None; time.sleep(2 + 3 * att)
    if d is None or not d.get("series"): return sym, {"error": err or (d or {}).get("error", "empty")}
    out = {"provider": d.get("provider"), "basis": d.get("price_basis"), "full": d.get("full_series_count"),
           "series": [[x["t"], x["o"], x["h"], x["l"], x["c"], x.get("v", 0)] for x in d["series"]]}
    json.dump(out, open(f, "w")); return sym, out

def day(t): return datetime.datetime.utcfromtimestamp(t / 1000 if t > 1e11 else t).strftime("%Y-%m-%d")

raw = {}
with ThreadPoolExecutor(4) as ex:
    for sym, d in ex.map(fetch, SYMS):
        raw[sym] = d; print(sym, "ERR " + str(d.get("error")) if "error" in d else (len(d["series"]), day(d["series"][0][0]), day(d["series"][-1][0]), d["basis"], d["provider"]), flush=True)
bad = [s for s in SYMS if "error" in raw[s]]
if bad: sys.exit("missing bars: " + ",".join(bad))

frames = {}
for sym in SYMS:
    df = pd.DataFrame(raw[sym]["series"], columns=["t", "o", "h", "l", "c", "v"]); df["d"] = df["t"].map(day)
    df = df[df["d"] <= END].drop_duplicates("d", keep="last").set_index("d"); frames[sym] = df
cal = frames["SPY"].index                                              # the session calendar is SPY's
panel = {k: pd.DataFrame({s: frames[s][k].reindex(cal) for s in SYMS}) for k in ["o", "h", "l", "c"]}

# ---- dividends (ex-date, amount) from the Hub's own public read ----
html = open(os.path.join(ROOT, "index.html"), encoding="utf8").read()
m = re.search(r"const ANON\s*=[^;]*?['\"]([A-Za-z0-9_.\-]{40,})['\"]\s*;", html, re.S); u = re.search(r"https://[a-z0-9]+\.supabase\.co", html)
if not (m and u): sys.exit("the Hub page's public read key was not found")
KEY, SB = m.group(1), u.group(0) + "/rest/v1"
def rest(path):
    r = urllib.request.Request(SB + path, headers={"apikey": KEY, "Authorization": "Bearer " + KEY, "Accept": "application/json"})
    return json.load(urllib.request.urlopen(r, timeout=60))
divs = {}
for sym in INDEX + SECTORS + BONDS + OTHER + LEADERS:
    f = os.path.join(CACHE, "div_" + sym + ".json")
    rows = json.load(open(f)) if os.path.exists(f) else rest(f"/dividends?select=date,amount,frequency&ticker=eq.{sym}&order=date.asc&limit=2000")
    json.dump(rows, open(f, "w")); divs[sym] = [(r["date"], float(r["amount"]), r.get("frequency")) for r in rows if r.get("amount") is not None and r["date"] <= END]
    print("div", sym, len(divs[sym]), divs[sym][0][0] if divs[sym] else "-", divs[sym][-1][0] if divs[sym] else "-", flush=True)
json.dump(divs, open(os.path.join(DATA, "dividends.json"), "w"))

# ---- corrections to the stored data, each found by the independent audit of this study and each proved by a number -------
# The provider's bars and the Hub's dividend table are left untouched; the repairs are made here, on the study's own copy,
# and every one is written to ../data/corrections.json so the page can list them.
corr = []
def scale_before(sym, date, k, scale_divs):
    for key in "ohlc": panel[key].loc[panel[key].index < date, sym] *= k
    if scale_divs: divs[sym] = [(d, a * k if d < date else a, f) for d, a, f in divs[sym]]
c = panel["c"]
# (1) EFA's 3-for-1 share split of 9 Jun 2005 is not adjusted in the bars (its dividends are).
a_, b_ = c["EFA"].loc[:"2005-06-08"].iloc[-1], c.at["2005-06-09", "EFA"]
if a_ / b_ > 2.0:
    scale_before("EFA", "2005-06-09", 1 / 3.0, False)
    corr.append({"symbol": "EFA", "what": "3-for-1 share split of 9 Jun 2005 not adjusted in the stored bars", "evidence": f"close {a_:.2f} then {b_:.2f}: a one-day fall of {100 * (b_ / a_ - 1):.1f}% that never happened", "repair": "bars before 9 Jun 2005 divided by 3"})
# (2) XLF handed each holder 0.139146 XLRE share on 19 Sep 2016. The earlier bars were scaled as if XLF shares had been handed out.
p0, p1, x1 = c["XLF"].loc[:"2016-09-16"].iloc[-1], c.at["2016-09-19", "XLF"], c.at["2016-09-19", "XLRE"]
if p1 / p0 - 1 < -0.05:
    true_ret = (p1 + 0.139146 * x1) / (p0 * 1.139146) - 1; k = (p1 / (1 + true_ret)) / p0
    scale_before("XLF", "2016-09-19", k, True)
    corr.append({"symbol": "XLF", "what": "the real-estate spin-off of 19 Sep 2016 (0.139146 XLRE share per XLF share) is under-adjusted in the stored bars", "evidence": f"stored one-day move {100 * (p1 / p0 - 1):.2f}%; the true total return that day was {100 * true_ret:+.2f}%",
                 "repair": f"bars and dividends before 19 Sep 2016 multiplied by {k:.4f}"})
# (3) SMH before VanEck took it over (21 Dec 2011) was a HOLDRS trust; its payouts are stored per OLD share while the bars are halved for the 2-for-1 split of May 2023.
n_smh = sum(1 for d, a, f in divs["SMH"] if d < "2011-12-21")
if n_smh:
    big = [(d, a) for d, a, f in divs["SMH"] if d in ("2007-10-12", "2011-10-04")]
    divs["SMH"] = [(d, a * 0.5 if d < "2011-12-21" else a, f) for d, a, f in divs["SMH"]]
    corr.append({"symbol": "SMH", "what": "payouts before 21 Dec 2011 are in pre-split dollars while the bars are halved for the May 2023 split", "evidence": "; ".join(f"{d}: {a} credited against a close near {c['SMH'].loc[:d].iloc[-2]:.2f}" for d, a in big) + " — twice what the price gap on those days shows",
                 "repair": f"{n_smh} payouts before 21 Dec 2011 halved"})
# (4) a missing bar inside a symbol's history: carry the last close forward so the move across the gap is not lost.
for sym in SYMS:
    first = c[sym].first_valid_index(); gap = [d for d in c.loc[first:].index if not np.isfinite(c.at[d, sym])]
    if gap:
        filled = c[sym].loc[first:].ffill(); c.loc[first:, sym] = filled
        for key in "ohl": panel[key].loc[gap, sym] = filled.loc[gap]
        corr.append({"symbol": sym, "what": f"{len(gap)} sessions with no bar inside its history", "evidence": ", ".join(gap), "repair": "last close carried forward on those sessions"})
# (5) payouts dated before a symbol's first stored bar cannot be credited to anything.
for sym in list(divs):
    first = c[sym].first_valid_index(); drop = [x for x in divs[sym] if x[0] < first]
    if drop: divs[sym] = [x for x in divs[sym] if x[0] >= first]
json.dump(divs, open(os.path.join(DATA, "dividends.json"), "w")); json.dump(corr, open(os.path.join(DATA, "corrections.json"), "w"), indent=1)
for x in corr: print("CORRECTED", x["symbol"], "|", x["what"], "|", x["repair"], flush=True)

for k, df in panel.items(): df.round(4).to_csv(os.path.join(DATA, f"bars_{k}.csv.gz"), compression={"method": "gzip", "mtime": 1})   # a fixed stamp inside the gzip, so the same bars give the same file
meta = {"end": END, "api": API, "symbols": {"index": INDEX, "sectors": SECTORS, "bonds": BONDS, "other": OTHER, "leaders": LEADERS, "macro": MACRO},
        "first_bar": {s: frames[s].index[0] for s in SYMS}, "last_bar": {s: frames[s].index[-1] for s in SYMS}, "basis": {s: raw[s]["basis"] for s in SYMS},
        "provider": {s: raw[s]["provider"] for s in SYMS}, "sessions": len(cal), "built_utc": datetime.datetime.utcnow().isoformat() + "Z",
        "dividend_rows": {s: len(v) for s, v in divs.items()}, "corrections": len(corr)}
json.dump(meta, open(os.path.join(DATA, "meta.json"), "w"), indent=1)
print("sessions", len(cal), cal[0], "->", cal[-1])

#!/usr/bin/env python3
"""Build the AI Chain report in pictures (reports/ai-chain-visual/index.html).

Alan, 28 Nov 2026: "scan through the report section ... it's a very detailed report, but it's hard to read. I need the
data charts ... more into scintilla ... for the companies that apply, what's in the report, and what we track of each ...
visuals with short descriptions, charts, graphs, widgets, pies".

Inputs (read only):
  1. story.json: the markets session's structured source of "The AI Chain (the report)", rebuilt daily by
     volume-pulse/scripts/story (we never edit it).
  2. scintilla_snapshot.json: what Scintilla tracks for the same companies (Hub membership, Geiger, analysts' target,
     sales growth, our earnings calendar), read from the Scintilla database.
Output: one self-contained page. Prices are not baked in: the page reads them live from the chart service.

Usage: python3 scripts/report-visuals/build.py [path/to/story.json]
"""
import json, os, re, sys
from datetime import date, datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
DEFAULT_STORY = "/Users/alanharvey/Claude/CLAUDE SET UP/volume-pulse/scripts/story/story.json"
STORY = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_STORY
OUT = os.path.join(ROOT, "reports", "ai-chain-visual", "index.html")

S = json.load(open(STORY))
SNAP = json.load(open(os.path.join(HERE, "scintilla_snapshot.json")))
TPL = open(os.path.join(HERE, "template.html"), encoding="utf-8").read()

MON = {m: i for i, m in enumerate(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}
REPORT_URL = "https://volume-pulse-pied.vercel.app/story.html"


def clean(x):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", str(x))).strip()


# ---------- companies: report name -> ticker, layer --------------------------------------------------------------
TICK = {
    "Micron": "MU", "SK hynix": "000660.KS", "Samsung": "005930.KS", "SanDisk": "SNDK", "Kioxia": "285A.T",
    "Western Digital": "WDC", "Seagate": "STX",
    "Apple": "AAPL", "Qualcomm": "QCOM", "MediaTek": "2454.TW", "Intel": "INTC", "Lenovo": "0992.HK", "HP": "HPQ", "Dell": "DELL",
    "Nvidia": "NVDA", "AMD": "AMD", "Broadcom": "AVGO", "TSMC": "TSM", "Marvell": "MRVL", "Arista": "ANET", "Arm": "ARM",
    "Supermicro": "SMCI", "Astera Labs": "ALAB",
    "Microsoft": "MSFT", "Alphabet": "GOOGL", "Amazon": "AMZN", "Meta": "META", "Oracle": "ORCL",
    "CoreWeave": "CRWV", "Nebius": "NBIS", "IREN": "IREN", "Applied Digital": "APLD", "Core Scientific": "CORZ",
    "Hut 8": "HUT", "TeraWulf": "WULF", "Cipher": "CIFR", "Cipher Digital": "CIFR", "Galaxy": "GLXY",
}
ALIAS = {"Cipher Digital": "Cipher", "SpaceX / xAI": "SpaceX/xAI", "Nscale (private)": "Nscale", "Lambda (private)": "Lambda",
         "Crusoe (private)": "Crusoe"}
LAYERS = [("MEM", "Memory and storage"), ("DEV", "Phones and PCs"), ("AI", "AI chips and hardware"),
          ("BUY", "Big buyers"), ("RENT", "GPU renters")]


def layer_of(group_label):
    g = group_label.lower()
    if g.startswith("memory"): return "MEM"
    if g.startswith("phones"): return "DEV"
    if g.startswith("ai chips"): return "AI"
    if g.startswith("big buyers"): return "BUY"
    if g.startswith("gpu renters"): return "RENT"
    return None


COMP = {}  # name -> {name, t, layer}


def comp(name, layer=None):
    name = ALIAS.get(name, name)
    c = COMP.setdefault(name, {"name": name, "t": TICK.get(name), "layer": layer})
    if layer and not c["layer"]: c["layer"] = layer
    return c


# ---------- table lookup by header shape (robust to the report adding sections) ----------------------------------
TABLES, CARDS = [], []
for ch in S["chapters"]:
    head = ""
    for b in ch["blocks"]:
        if b[0] == "h": head = clean(b[1])
        elif b[0] == "t": TABLES.append({"ch": ch["id"], "head": head, "rows": [[clean(c) for c in r] for r in b[1]]})
        elif b[0] == "cards": CARDS.append({"ch": ch["id"], "cards": b[1]})


def find(test, what):
    for t in TABLES:
        h = t["rows"][0]
        try:
            if test(h): return t
        except IndexError:
            continue
    raise SystemExit("report table not found: " + what)


def grouped(rows):
    """Yield (group_label, row) for tables whose group rows have only the first cell filled."""
    g = ""
    for r in rows[1:]:
        if all(not c for c in r[1:]):
            g = r[0]; continue
        yield g, r


# ---------- dates: "~24 Mar 27", "2 Nov 26 [~29 Apr 27]", "~22 Jul to ~27 Oct 27", "none", "never goes negative" ----
TOK = re.compile(r"(~)?(\d{1,2})(?:-(\d{1,2}))?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\s+(\d{2}))?\b")


def parse_when(s):
    s = (s or "").strip()
    if not s or s.lower().startswith("none"): return None
    if s.lower().startswith("never"): return {"never": True, "text": s}
    toks = list(TOK.finditer(s))
    if not toks: return {"text": s}
    years, yr = [], None
    for m in reversed(toks):
        if m.group(5): yr = int(m.group(5))
        years.append(yr)
    years.reverse()
    pts = []
    for m, y in zip(toks, years):
        if y is None: continue
        d = date(2000 + y, MON[m.group(4)], int(m.group(2)))
        pts.append((m, d))
    if not pts: return {"text": s}
    m0, d0 = pts[0]
    rec = {"d": d0.isoformat(), "est": bool(m0.group(1))}
    if m0.group(3):
        rec["end"] = date(d0.year, d0.month, int(m0.group(3))).isoformat()
    elif len(pts) > 1 and " to " in s:
        rec["end"] = pts[-1][1].isoformat()
    note = re.findall(r"\(([^)]*)\)", s)
    if note: rec["note"] = note[0]
    return rec


def parse_cell(cell):
    """'base [tougher path]' -> {'base':..., 'tough':...}"""
    cell = cell or ""
    m = re.match(r"^(.*?)\s*\[(.*)\]\s*$", cell)
    base, tough = (m.group(1), m.group(2)) if m else (cell, "")
    tnote = None
    if "," in tough and not TOK.search(tough.split(",", 1)[1]):
        tough, tnote = tough.split(",", 1)
    out = {"base": parse_when(base), "tough": parse_when(tough)}
    if tnote and out["tough"]: out["tough"]["note"] = tnote.strip()
    return out


EVENTS = {}  # name -> list


def add_event(name, kind, cell):
    p = parse_cell(cell)
    if not p["base"] and not p["tough"]: return
    ev = {"k": kind}
    if p["base"]: ev.update(p["base"])
    else: ev["none"] = True
    if p["tough"] and p["tough"].get("d"): ev["tough"] = {k: v for k, v in p["tough"].items() if k in ("d", "est", "end", "note")}
    EVENTS.setdefault(name, [])
    if not any(e["k"] == kind for e in EVENTS[name]): EVENTS[name].append(ev)


# timeline table A: lowest sales / margin / cash / turns up / sales rise / cash positive
TA = find(lambda h: h[0] == "Company" and h[1].startswith("Lowest sales reported") and "cash" in h[3].lower(), "company calendar A")
KA = ["lowest_sales", "lowest_margin", "worst_cash", "turns_up", "sales_rise", "cash_pos"]
for g, r in grouped(TA["rows"]):
    c = comp(r[0], layer_of(g))
    for k, cell in zip(KA, r[1:]): add_event(c["name"], k, cell)
# timeline table B: first bad outlook, sales peak (the other columns repeat table A)
TB = find(lambda h: h[0] == "Company" and h[1] == "First bad outlook", "company calendar B")
for g, r in grouped(TB["rows"]):
    c = comp(r[0], layer_of(g))
    add_event(c["name"], "first_bad", r[1])
    add_event(c["name"], "sales_peak", r[2])


# ---------- margins ----------------------------------------------------------------------------------------------
def pct_date(s):
    m = re.match(r"\s*(-?\d+(?:\.\d+)?)%\s*(adj)?,?\s*(.*)$", s or "")
    if not m: return None
    w = parse_when(m.group(3))
    return {"v": float(m.group(1)), "adj": bool(m.group(2)), "d": (w or {}).get("d")}


def guide(s):
    if not s or s.lower().startswith("none"): return None
    m = re.search(r"(-?\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?%", s)
    if not m: return {"text": s}
    lo = float(m.group(1)); hi = float(m.group(2)) if m.group(2) else lo
    return {"lo": lo, "hi": hi, "est": "estimate" in s or "~" in s, "text": s}


TM = find(lambda h: h[0] == "Gross margin" and h[1].startswith("High since 2019"), "margins")
MARGINS = []
for g, r in grouped(TM["rows"]):
    c = comp(r[0], layer_of(g))
    hi, la = pct_date(r[1]), pct_date(r[2])
    if not hi or not la: continue
    MARGINS.append({"name": c["name"], "layer": c["layer"], "high": hi, "latest": la, "next": guide(r[4]), "past": r[5]})
MARGIN_HEAD = TM["head"]

# ---------- big buyers -------------------------------------------------------------------------------------------
TQ = find(lambda h: h[0] == "Report date" and h[1] == "Quarter" and h[2].startswith("Sales"), "buyers by quarter")
BUY_Q = {}
for g, r in grouped(TQ["rows"]):
    name = ALIAS.get(g, g)
    yoy = re.search(r"(-?\+?\d+(?:\.\d+)?)%", r[3])
    w = parse_when(r[0]) or {}
    BUY_Q.setdefault(name, []).append({"d": w.get("d"), "est": w.get("est", False), "q": r[1],
                                        "sales": float(r[2]) if re.match(r"^-?\d+(\.\d+)?$", r[2]) else None,
                                        "yoy": float(yoy.group(1)) if yoy else None, "reported": r[5].lower().startswith("reported")})
TP = find(lambda h: h[0].startswith("Calendar year sales gr"), "buyers by path")
BUY_PATH = {}
for r in TP["rows"][1:]:
    name = r[0].split(",")[0]
    nums = lambda s: [float(x) for x in re.findall(r"([-+]?\d+(?:\.\d+)?)%", s)]
    BUY_PATH[name] = {"base": nums(r[1]), "fed": nums(r[2]), "up": nums(r[3])}
TC = find(lambda h: h[0] == "Company" and h[1].startswith("Cloud share of latest"), "cloud share")
CLOUD = {}
for r in TC["rows"][1:]:
    name = r[0].split(" (")[0]
    seg = re.search(r"\(([^)]*)\)", r[0])
    num = lambda s: float(re.search(r"(-?\d+(?:\.\d+)?)%", s).group(1)) if re.search(r"(-?\d+(?:\.\d+)?)%", s) else None
    CLOUD[name] = {"segment": seg.group(1) if seg else "", "share_sales": num(r[1]), "share_added": num(r[2]), "if_cloud_flat": r[5]}
BUY_HEAD = {"quarters": TQ["head"], "paths": TP["head"], "cloud": TC["head"]}

# ---------- GPU renters ------------------------------------------------------------------------------------------
TR = find(lambda h: h[0] == "Name" and h[1].startswith("Capital fully dries up"), "renter odds")
RENT = []
for r in TR["rows"][1:]:
    n = lambda s: float(s.rstrip("%")) if re.match(r"^\d+(\.\d+)?%$", s) else None
    name = ALIAS.get(r[0], r[0])
    RENT.append({"name": name, "t": TICK.get(name), "private": "private" in r[0].lower() or name in ("SpaceX/xAI", "Anthropic", "OpenAI"),
                 "dries": n(r[1]), "delays": n(r[2]), "restructure": n(r[3]), "restructure_fed": n(r[4])})
TF = find(lambda h: h[0] == "Name" and h[1].startswith("Base case"), "renter funding")


def status(s):
    s2 = s.lower()
    if "falls short" in s2: return "short"
    if "tight" in s2 or "must" in s2: return "tight"
    if "can do" in s2 or "paid for" in s2: return "ok"
    return "unknown"


FUND = {}
for r in TF["rows"][1:]:
    name = r[0].split(",")[0].replace(" and Together AI", "")
    name = ALIAS.get(name, name)
    FUND[name] = {"base": [status(r[1]), r[1]], "measured": [status(r[2]), r[2]], "fed": [status(r[3]), r[3]], "up": [status(r[4]), r[4]]}
RENT_HEAD = {"odds": TR["head"], "funding": TF["head"]}

# ---------- standing, next tests, paths ---------------------------------------------------------------------------
TS = find(lambda h: h[0] == "What" and h[1].startswith("Close"), "where we stand")
STAND = []
for r in TS["rows"][1:]:
    fh = re.search(r"(-?\d+(?:\.\d+)?)%", r[2])
    v2 = re.search(r"(\d+(?:\.\d+)?)% (below|above)", r[4])
    day = re.search(r"day (\d+)", r[4])
    STAND.append({"name": r[0], "close": r[1], "from_high": float(fh.group(1)) if fh else None, "high": r[3],
                  "vs200": (-1 if v2 and v2.group(2) == "below" else 1) * float(v2.group(1)) if v2 else None,
                  "day": int(day.group(1)) if day else None, "text200": r[4]})
AS_OF = date.fromisoformat(S["numbers_as_of"])
TN = find(lambda h: h[:3] == ["Date", "Report", "Why it matters"], "next tests")
NEXT = []
for r in TN["rows"][1:]:
    m = re.search(r"(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)", r[0])
    if not m: continue
    d = date(AS_OF.year, MON[m.group(2)], int(m.group(1)))
    if (d - AS_OF).days < -30: d = date(AS_OF.year + 1, d.month, d.day)
    who = r[1]
    NEXT.append({"d": d.isoformat(), "est": "estimate" in r[0].lower(), "label": r[0], "who": who, "why": r[2],
                 "t": TICK.get(who.split(" (")[0])})
TPR = find(lambda h: h[0] == "Path" and h[1].startswith("Nasdaq-100 range"), "path ranges")
RANGES = []
for r in TPR["rows"][1:]:
    m = re.match(r"([\d,]+)-([\d,]+)", r[1])
    RANGES.append({"label": r[0], "lo": int(m.group(1).replace(",", "")) if m else None,
                   "hi": int(m.group(2).replace(",", "")) if m else None, "text": r[1], "spx": r[2]})
ODDS, MARKET = [], []
for blk in CARDS:
    if blk["ch"] != "story": continue
    for cd in blk["cards"]:
        item = {"k": clean(cd["k"]), "v": clean(cd["v"]), "s": clean(cd["s"]), "c": cd.get("c")}
        (ODDS if item["v"].endswith("%") and not item["v"].startswith("-") and "/" not in item["v"] else MARKET).append(item)

# ---------- chapters (the way back to the full text) --------------------------------------------------------------
CHAPTERS = [{"id": c["id"], "title": clean(c["title"]), "lead": clean(c["lead"])} for c in S["chapters"] if c["id"] != "notes"]

# ---------- what Scintilla tracks ----------------------------------------------------------------------------------
F = SNAP["fields"]
TRACK = {}
for t, row in SNAP["rows"].items():
    d = dict(zip(F, row))
    d["tgt_at"] = datetime.fromtimestamp(d["tgt_at"], timezone.utc).date().isoformat() if d.get("tgt_at") else None
    for k in ("geiger", "g_trend", "g_mom"):
        d[k] = round(d[k] / 10000, 2) if d.get(k) is not None else None
    TRACK[t] = d
for t in SNAP.get("not_on_hub", []): TRACK[t] = {"active": False}

for name in list(COMP):
    COMP[name]["events"] = EVENTS.get(name, [])
for r in RENT:
    c = comp(r["name"], "RENT")
    c["private"] = r["private"]

DATA = {
    "built": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
    "report": {"title": clean(S["title"]), "updated": S["updated"], "as_of": S["numbers_as_of"], "built": S["built"],
               "url": REPORT_URL, "lead": clean(S["chapters"][0]["lead"])},
    "layers": LAYERS, "companies": list(COMP.values()), "margins": MARGINS, "margin_head": MARGIN_HEAD,
    "buy_q": BUY_Q, "buy_path": BUY_PATH, "cloud": CLOUD, "buy_head": BUY_HEAD,
    "renters": RENT, "funding": FUND, "rent_head": RENT_HEAD,
    "stand": STAND, "stand_head": TS["head"], "next": NEXT, "next_head": TN["head"], "ranges": RANGES,
    "odds": ODDS, "market": MARKET, "chapters": CHAPTERS,
    "track": TRACK, "track_read_at": SNAP["read_at"],
    "sources": {"calendar": [TA["head"], TB["head"]]},
}

html = TPL.replace("/*__DATA__*/null", json.dumps(DATA, ensure_ascii=False, separators=(",", ":")))
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w", encoding="utf-8").write(html)

# ---------- per-ticker file for the Hub's company pages (REPORT tab) ------------------------------------------------
# Alan, 28 Nov: "into the companies, like when you click on the ticker ... ticker specific pages". The Hub reads
# reports/ai-chain-visual/data.json (same site) and shows a REPORT tab on the page of every listed name the report covers.
SENT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"(])")


def report_lines(name, limit=3):
    """The report's own sentences that name the company, the most concrete first (numbers, dates), in report order."""
    pat = re.compile(r"(?<![A-Za-z])" + re.escape(name) + r"(?![A-Za-z])")
    found = []
    for ch in S["chapters"]:
        if ch["id"] == "notes": continue
        for b in ch["blocks"]:
            if b[0] not in ("p", "q", "b"): continue
            texts = b[1] if isinstance(b[1], list) else [b[1]]
            for tx in texts:
                for s in SENT.split(clean(tx)):
                    m0 = pat.search(s)
                    if not m0 or len(s) < 40 or m0.start() > 240: continue
                    first = m0.start()
                    if len(s) > 280: s = s[:277].rsplit(" ", 1)[0] + "…"
                    others = sum(1 for o in COMP if o != name and re.search(r"(?<![A-Za-z])" + re.escape(o) + r"(?![A-Za-z])", s))
                    score = (2 if re.search(r"\d", s) else 0) + (1 if re.search(r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)", s) else 0) \
                        + (2 if first < 40 else 0) - min(4, others)
                    if not any(f["t"] == s for f in found): found.append({"t": s, "ch": ch["id"], "score": score, "i": len(found)})
    best = sorted(found, key=lambda f: (-f["score"], f["i"]))[:limit]
    return [{"t": f["t"], "ch": f["ch"]} for f in sorted(best, key=lambda f: f["i"])]


BY_T = {}
for c in COMP.values():
    t = c.get("t")
    if not t or "." in t: continue                     # foreign listings are not Hub tickers
    m = next((x for x in MARGINS if x["name"] == c["name"]), None)
    st = next((x for x in STAND if x["name"] == c["name"]), None)
    nx = next((x for x in NEXT if x["who"] == c["name"]), None)
    rn = next((x for x in RENT if x["name"] == c["name"]), None)
    BY_T[t] = {"name": c["name"], "layer": c["layer"], "layer_name": dict(LAYERS).get(c["layer"]), "events": c["events"],
               "margin": m, "stand": st, "next": nx,
               "buyer": {"q": BUY_Q.get(c["name"]), "path": BUY_PATH.get(c["name"]), "cloud": CLOUD.get(c["name"])} if c["name"] in BUY_Q else None,
               "renter": rn, "funding": FUND.get(c["name"]), "says": report_lines(c["name"]),
               "ours_next": (TRACK.get(t) or {}).get("next_date")}
for m in MARGINS:   # names with a margin line but no dated marks (Astera Labs)
    t = TICK.get(m["name"])
    if t and "." not in t and t not in BY_T:
        BY_T[t] = {"name": m["name"], "layer": m["layer"], "layer_name": dict(LAYERS).get(m["layer"]), "events": [], "margin": m,
                   "stand": None, "next": None, "buyer": None, "renter": None, "funding": None, "says": report_lines(m["name"]),
                   "ours_next": (TRACK.get(t) or {}).get("next_date")}
PER = {"what": "The AI Chain report, per Hub ticker, for the company pages' REPORT tab. Built by scripts/report-visuals/build.py.",
       "built": DATA["built"], "as_of": S["numbers_as_of"], "report_built": S["built"], "report_url": REPORT_URL,
       "picture_url": "/reports/ai-chain-visual/", "kinds_order": ["first_bad", "lowest_sales", "worst_cash", "lowest_margin", "sales_peak", "turns_up", "sales_rise", "cash_pos"],
       "by_ticker": BY_T}
open(os.path.join(os.path.dirname(OUT), "data.json"), "w", encoding="utf-8").write(json.dumps(PER, ensure_ascii=False, separators=(",", ":")))

# ---------- what was read (printed so a rebuild can be checked at a glance) -----------------------------------------
n_ev = sum(len(v) for v in EVENTS.values())
print(f"report {S['numbers_as_of']} (built {S['built']}) -> {os.path.relpath(OUT, ROOT)} {len(html):,} bytes")
print(f"companies {len(COMP)} · events {n_ev} · margins {len(MARGINS)} · buyers {len(BUY_Q)} quarters {sum(len(v) for v in BUY_Q.values())}"
      f" · renters {len(RENT)} funding {len(FUND)} · stand {len(STAND)} · next {len(NEXT)} · ranges {len(RANGES)}"
      f" · odds {len(ODDS)} market {len(MARKET)} · tracked {sum(1 for v in TRACK.values() if v.get('active'))}")

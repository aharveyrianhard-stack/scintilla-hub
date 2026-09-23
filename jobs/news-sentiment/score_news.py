#!/usr/bin/env python3
"""SCINTILLA · per-headline news sentiment (SCI-5, lane M27).

score     read headlines from public.news, score each one with the finance lexicon in
          data/news-lexicon/lm-headline-v1.json, and print / save the result.
          With --apply, upsert one row per (url, ticker) into public.news_headline_sentiment.
selftest  run the shared fixtures (tests/fixtures/news-sentiment-cases.json). The browser and
          tests/news-sentiment.test.mjs score the same cases, so all three must agree.

Reads  : news (anon key, the same one the Hub serves to every browser).
Writes : news_headline_sentiment ONLY, and only with --apply. The write key is read from the
         ENVIRONMENT (SUPABASE_SERVICE_ROLE_KEY, else SUPABASE_KEY) and is never printed.
Python 3.9 compatible; standard library only.
"""
import argparse, hashlib, json, os, re, sys, time, urllib.error, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
LEXICON = os.environ.get("NEWS_LEXICON", os.path.join(REPO, "data", "news-lexicon", "lm-headline-v1.json"))
SB_URL = os.environ.get("SUPABASE_URL", "https://wadinxqplrggagkvrdag.supabase.co")
METHOD = "lm-v1"

_TOKEN_SPLIT = re.compile(r"[\s\-]+")
_URL = re.compile(r"https?://\S+")
_KEEP = re.compile(r"[^a-z0-9'\s\-]")


def log(*a):
    print(time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), *a, flush=True)


def load_lexicon(path=LEXICON):
    with open(path, "rb") as fh:
        raw = fh.read()
    lex = json.loads(raw.decode("utf-8"))
    lex["_sha256"] = hashlib.sha256(raw).hexdigest()
    lex["_sets"] = {
        "pos": set(lex["lm_positive"]),
        "neg": set(lex["lm_negative"]),
        "spos": set(lex.get("supplement_positive") or []),
        "sneg": set(lex.get("supplement_negative") or []),
        "unc": set(lex.get("lm_uncertainty") or []),
        "negators": set(lex.get("negators") or []),
    }
    return lex


def tokens(text):
    """Must match lib/news-sentiment.mjs exactly."""
    t = (text or "").lower().replace("’", "'")
    t = _URL.sub(" ", t)
    t = _KEEP.sub(" ", t)
    return [w for w in _TOKEN_SPLIT.split(t) if w]


def score_text(text, lex):
    S = lex["_sets"]
    raw = text or ""
    # A QUESTION IS NOT A CLAIM: scored and stored, never counted in a total.
    question = "?" in raw.split(".")[0]
    tk = tokens(text)
    marks, pos, neg, flips, unc = [], 0, 0, 0, 0
    for i, w in enumerate(tk):
        if w in S["unc"]:
            unc += 1
        if w in S["pos"]:
            polarity, lst = 1, "lm"
        elif w in S["neg"]:
            polarity, lst = -1, "lm"
        elif w in S["spos"]:
            polarity, lst = 1, "headline-verb"
        elif w in S["sneg"]:
            polarity, lst = -1, "headline-verb"
        else:
            continue
        negated = any(tk[j] in S["negators"] for j in range(max(0, i - 3), i))
        eff = -polarity if negated else polarity
        if negated:
            flips += 1
        if eff > 0:
            pos += 1
        else:
            neg += 1
        marks.append({"i": i, "w": w, "list": lst, "polarity": polarity, "negated": negated, "effect": eff})
    hits = pos + neg
    return {
        "method": METHOD,
        "score": round((pos - neg) / float(hits), 3) if hits else None,
        "question": question,
        "pos": pos, "neg": neg, "flips": flips, "unc": unc, "hits": hits,
        "marks": marks, "tokens": tk,
        "reason": None if hits else "no lexicon word in this headline",
    }


# ---------------------------------------------------------------- PostgREST
_ANON = None


def anon_key():
    """The public browser key (the Hub serves it to every visitor). Environment wins."""
    global _ANON
    if _ANON:
        return _ANON
    k = os.environ.get("SUPABASE_ANON_KEY")
    if not k:
        idx = os.path.join(REPO, "index.html")
        m = re.search(r'const ANON = \(typeof window[^"]*"([A-Za-z0-9._\-]+)"', open(idx, encoding="utf-8").read(), re.S)
        k = m.group(1) if m else ""
    _ANON = k
    return k


def rest(path, key=None, method="GET", body=None, prefer=None, timeout=60):
    k = key or anon_key()
    req = urllib.request.Request(SB_URL + "/rest/v1/" + path, method=method)
    req.add_header("apikey", k)
    req.add_header("Authorization", "Bearer " + k)
    req.add_header("Accept", "application/json")
    if prefer:
        req.add_header("Prefer", prefer)
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, data, timeout=timeout) as r:
        raw = r.read().decode("utf-8")
    return json.loads(raw) if raw.strip() else []


def write_key():
    for name in ("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_KEY"):
        v = os.environ.get(name)
        if v:
            return v, name
    return None, None


# ---------------------------------------------------------------- commands
def cmd_score(args):
    lex = load_lexicon()
    since = int(time.time()) - args.days * 86400
    log("reading news published since", since, "(%d days)" % args.days)
    rows, page, got = [], 1000, 0
    off = 0
    while len(rows) < args.limit:
        batch = rest("news?select=url,ticker,title,snippet,site,published_ts&published_ts=gte.%d&order=published_ts.desc&limit=%d&offset=%d"
                     % (since, min(page, args.limit - len(rows)), off))
        if not isinstance(batch, list) or not batch:
            break
        rows.extend(batch)
        got = len(batch)
        off += got
        if got < page:
            break
    log("headlines read:", len(rows))

    out, scored, unscored = [], 0, 0
    for r in rows:
        text = (r.get("title") or "") + ". " + (r.get("snippet") or "")
        s = score_text(r.get("title") or "", lex)   # the question mark belongs to the headline
        s2 = score_text(text, lex)
        s = dict(s2, question=s["question"])
        if s["score"] is None:
            unscored += 1
        else:
            scored += 1
        out.append({
            "url": r.get("url"), "ticker": (r.get("ticker") or "").upper(), "site": r.get("site"),
            "title": r.get("title"), "published_ts": r.get("published_ts"),
            "method": METHOD, "lexicon_sha": lex["_sha256"],
            "score": s["score"], "question": s["question"],
            "pos_n": s["pos"], "neg_n": s["neg"], "flip_n": s["flips"],
            "unc_n": s["unc"], "hits": s["marks"],
        })
    mean = None
    vals = [o["score"] for o in out if o["score"] is not None]
    if vals:
        mean = round(sum(vals) / len(vals), 4)
    log("scored:", scored, "· no scoring word:", unscored, "· mean of scored:", mean)

    if args.out:
        with open(args.out, "w") as fh:
            json.dump({"generated_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                       "method": METHOD, "lexicon_sha": lex["_sha256"], "days": args.days,
                       "headlines": len(out), "scored": scored, "unscored": unscored, "mean": mean,
                       "rows": out}, fh, indent=1)
        log("wrote", args.out)

    if not args.apply:
        log("DRY RUN — nothing written to the database. Add --apply (and a write key) to store these rows.")
        return 0

    key, name = write_key()
    if not key:
        log("REFUSING to write: no SUPABASE_SERVICE_ROLE_KEY / SUPABASE_KEY in the environment.")
        return 2
    log("writing with", name, "(value never printed)")
    payload = [{k: o[k] for k in ("url", "ticker", "published_ts", "method", "lexicon_sha",
                                  "score", "question", "pos_n", "neg_n", "flip_n", "unc_n", "hits")} for o in out if o["url"]]
    n = 0
    for i in range(0, len(payload), 500):
        chunk = payload[i:i + 500]
        rest("news_headline_sentiment?on_conflict=url,ticker", key=key, method="POST", body=chunk,
             prefer="resolution=merge-duplicates,return=minimal")
        n += len(chunk)
        log("upserted", n, "of", len(payload))
    return 0


def cmd_selftest(args):
    lex = load_lexicon()
    path = os.path.join(REPO, "tests", "fixtures", "news-sentiment-cases.json")
    cases = json.load(open(path))["cases"]
    bad = 0
    for c in cases:
        s = score_text(c["text"], lex)
        got = {"score": s["score"], "question": s["question"], "pos": s["pos"], "neg": s["neg"], "flips": s["flips"],
               "words": [m["w"] + ("!" if m["negated"] else "") for m in s["marks"]]}
        if got != c["expect"]:
            bad += 1
            print("MISMATCH", json.dumps(c["text"]))
            print("  expected", json.dumps(c["expect"]))
            print("  got     ", json.dumps(got))
    print("%d cases, %d mismatches" % (len(cases), bad))
    return 1 if bad else 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd")
    s = sub.add_parser("score", help="score recent headlines")
    s.add_argument("--days", type=int, default=3)
    s.add_argument("--limit", type=int, default=4000)
    s.add_argument("--out", default=None)
    s.add_argument("--apply", action="store_true", help="write the rows (needs a service key)")
    s.set_defaults(fn=cmd_score)
    t = sub.add_parser("selftest", help="run the shared fixtures")
    t.set_defaults(fn=cmd_selftest)
    a = ap.parse_args()
    if not getattr(a, "fn", None):
        ap.print_help()
        return 1
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())

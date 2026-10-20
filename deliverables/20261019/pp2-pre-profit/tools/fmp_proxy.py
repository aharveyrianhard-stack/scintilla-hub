#!/usr/bin/env python3
"""FMP through the project's own door: GET .../functions/v1/fmp-proxy?path=<stable path>&symbol=...

Read-only. The bearer is the Hub's public anon key, read from the Hub's index.html at run time; it is never printed.
Every answer is cached on disk (scratch folder) with its fetch time so a name is asked once; the call log is kept.
"""
import hashlib, json, os, re, sys, threading, time, urllib.error, urllib.parse, urllib.request

S = os.environ.get("PP2_SCRATCH", "/private/tmp/claude-501/-Users-alanharvey-SCINTILLA-0-5/1e272f46-f888-4f78-a5e2-b48697d9edb5/scratchpad")
CACHE = os.path.join(S, "fmp-cache")
HUB_INDEX = os.environ.get("PP2_HUB_INDEX", "/Users/alanharvey/SCINTILLA 0.5/_deploy/hub-deploy/index.html")
BASE = "https://wadinxqplrggagkvrdag.supabase.co/functions/v1/fmp-proxy"
_KEY = None
_lock = threading.Lock()
_last = [0.0]
MIN_GAP = 0.25
CALLS = {"network": 0, "cache": 0, "errors": 0}
LOG = []


def _key():
    global _KEY
    if _KEY is None:
        txt = open(HUB_INDEX, encoding="utf-8", errors="replace").read()
        m = re.search(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", txt)
        if not m:
            raise RuntimeError("anon key not found in the Hub's index.html")
        _KEY = m.group(0)
    return _KEY


def _scrub(s):
    s = str(s)
    if _KEY:
        s = s.replace(_KEY, "<anon>")
    return s


def _cache_path(path, params):
    pk = "&".join("%s=%s" % (k, params[k]) for k in sorted(params))
    name = re.sub(r"[^A-Za-z0-9_.-]+", "_", path + "__" + pk)[:150] + "__" + hashlib.sha1((path + "?" + pk).encode()).hexdigest()[:10] + ".json"
    return os.path.join(CACHE, name), pk


def get(path, cache=True, **params):
    """Return (status, body, fetched_utc)."""
    os.makedirs(CACHE, exist_ok=True)
    cp, pk = _cache_path(path, params)
    if cache and os.path.exists(cp):
        try:
            d = json.load(open(cp))
            CALLS["cache"] += 1
            return d["status"], d["body"], d.get("fetched_utc")
        except Exception:
            pass
    q = dict(params)
    q["path"] = path
    url = BASE + "?" + urllib.parse.urlencode(q)
    status, body = 0, None
    for attempt in range(3):
        with _lock:
            gap = MIN_GAP - (time.time() - _last[0])
            if gap > 0:
                time.sleep(gap)
            _last[0] = time.time()
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json", "Authorization": "Bearer " + _key(),
                                                       "User-Agent": "scintilla-pp2/1.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                status = r.status
                raw = r.read().decode("utf-8", "replace")
            try:
                body = json.loads(raw)
            except Exception:
                body = {"_raw": _scrub(raw[:400])}
            break
        except urllib.error.HTTPError as e:
            status = e.code
            try:
                raw = e.read().decode("utf-8", "replace")
            except Exception:
                raw = ""
            body = {"_error": _scrub(raw[:400])}
            if status in (429, 502, 503, 504):
                time.sleep(3 + 5 * attempt)
                continue
            break
        except Exception as e:
            status = 0
            body = {"_error": _scrub(type(e).__name__ + ": " + str(e))[:300]}
            time.sleep(1.5 + 2 * attempt)
    fetched = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    with _lock:
        CALLS["network"] += 1
        if status != 200:
            CALLS["errors"] += 1
        rows = len(body) if isinstance(body, list) else (1 if isinstance(body, dict) and "_error" not in body else 0)
        LOG.append({"utc": fetched, "path": path, "params": pk, "status": status, "rows": rows})
    if status in (200, 400, 402, 403, 404):
        json.dump({"status": status, "body": body, "fetched_utc": fetched, "path": path, "params": pk}, open(cp, "w"))
    return status, body, fetched


def save_log(fp):
    json.dump({"calls": CALLS, "log": LOG}, open(fp, "w"), indent=1)

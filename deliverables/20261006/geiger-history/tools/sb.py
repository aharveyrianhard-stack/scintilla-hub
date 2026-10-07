# Read-only helper for the Hub's PUBLIC tables: uses the same public read key the Hub page itself ships to every browser.
# The key is read from the page at run time, used only in request headers, and never printed or written anywhere.
import re, json, urllib.request, urllib.parse
SB = "https://wadinxqplrggagkvrdag.supabase.co"
_K = None
def _key():
    global _K
    if _K is None:
        src = open("/Users/alanharvey/SCINTILLA 0.5/_worktrees/gh1-geiger-history-20261006/index.html", encoding="utf8", errors="ignore").read()
        c = [m for m in re.findall(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}", src)]
        import base64
        for k in c:
            try:
                p = json.loads(base64.urlsafe_b64decode(k.split(".")[1] + "=="))
                if p.get("role") == "anon": _K = k; break
            except Exception: pass
        if _K is None: raise SystemExit("public read key not found in the Hub page")
    return _K
def pg(path, rng=None):
    out = []; start = 0
    while True:
        h = {"apikey": _key(), "Authorization": "Bearer " + _key(), "Range-Unit": "items", "Range": f"{start}-{start+999}"}
        r = urllib.request.Request(SB + "/rest/v1/" + path, headers=h)
        try: rows = json.load(urllib.request.urlopen(r, timeout=60))
        except urllib.error.HTTPError as e: raise SystemExit(f"{path.split('?')[0]} -> HTTP {e.code} {e.read()[:160]!r}")
        out += rows
        if len(rows) < 1000: return out
        start += 1000

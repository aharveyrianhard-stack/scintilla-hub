# GH1 · compile-only check of the .pine file against TradingView's public compiler endpoint, as Guest.
# Stateless: nothing is saved, no account is used, no chart or editor is touched (the same call the TradingView MCP's
# `pine_check` tool makes). It answers one question: does the file compile, and if not, on which line.
import json, sys, urllib.request, urllib.parse
src = open(sys.argv[1], encoding="utf8").read()
body = urllib.parse.urlencode({"source": src}).encode()
req = urllib.request.Request("https://pine-facade.tradingview.com/pine-facade/translate_light?user_name=Guest&pine_id=00000000-0000-0000-0000-000000000000",
                             data=body, headers={"Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded", "Referer": "https://www.tradingview.com/"})
try:
    res = json.load(urllib.request.urlopen(req, timeout=60))
except urllib.error.HTTPError as e:
    print("HTTP", e.code, e.read()[:300]); sys.exit(2)
inner = res.get("result") or {}
errs = inner.get("errors2") or []; warns = inner.get("warnings2") or []
out = {"success": res.get("success"), "errors": [{"line": (e.get("start") or {}).get("line"), "col": (e.get("start") or {}).get("column"), "message": e.get("message")} for e in errs],
       "warnings": [{"line": (w.get("start") or {}).get("line"), "message": w.get("message")} for w in warns], "error": res.get("error") if isinstance(res.get("error"), str) else None,
       "reason": res.get("reason"), "keys": sorted(res.keys()), "inner_keys": sorted(inner.keys())[:30]}
print(json.dumps(out, indent=1)[:6000])
json.dump(out, open("pine-compile-check.json", "w"), indent=1)

# GH1 · which 3-day calendar does the provider serve for each Hub name? (start day of its newest 3-day bars, mod 3)
# One small public read per name (tf=3D, 4 bars). The Pine script needs this: it builds 3-day bars itself.
import json, urllib.request, urllib.parse, time, collections
from concurrent.futures import ThreadPoolExecutor
A = "https://scintilla-massive-chart-api.fly.dev"
syms = sorted(json.load(open("geiger-live.json"))["symbols"].keys())
def one(s):
    url = f"{A}/candles?symbol={urllib.parse.quote(s)}&tf=3D&limit=4&authority=provider"
    for att in range(3):
        try:
            d = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"Origin": "https://scintillahub.ai", "Accept-Encoding": "identity"}), timeout=45))
            ser = d.get("series") or []
            if not ser: return s, None
            ph = {int((x["t"] + 12 * 3600000) // 86400000) % 3 for x in ser}
            return s, (ph.pop() if len(ph) == 1 else -1)
        except Exception as e:
            time.sleep(1 + att)
    return s, None
t0 = time.time(); out = {}
with ThreadPoolExecutor(3) as ex:
    for s, p in ex.map(one, syms): out[s] = p
c = collections.Counter(out.values()); print("names", len(out), "lattice counts", dict(c), round(time.time() - t0), "s")
json.dump({"as_of": "2026-10-07 ~00:50 ET", "what": "start day of each name's provider 3-day bars, mod 3 (days counted from 1 Jan 1970)", "phase": out}, open("lattice-survey.json", "w"), indent=0)
print("grid B (phase 1):", ",".join(s for s, p in out.items() if p == 1)); print("phase 0:", [s for s, p in out.items() if p == 0]); print("none/mixed:", [s for s, p in out.items() if p in (None, -1)])

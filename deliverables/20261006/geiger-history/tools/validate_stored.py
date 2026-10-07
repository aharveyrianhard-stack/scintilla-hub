# GH1 · the replay against the rows the Hub itself stored each evening (public.composite_history, source CHART_API_GEIGER,
# written about 20:22 ET by the nightly stamp). A second, independent evening for every name.
import sb, json, collections, pickle, numpy as np
rows = sb.pg("composite_history?select=ticker,snapshot_date,composite,trend,momentum,source,as_of&source=eq.CHART_API_GEIGER&snapshot_date=gte.2026-09-25&order=snapshot_date.asc")
RES = pickle.load(open("replay.pkl", "rb")); out = {}
for day in sorted({r["snapshot_date"] for r in rows}):
    gaps = []; worst = []
    for r in rows:
        if r["snapshot_date"] != day or r["ticker"] not in RES or r["composite"] is None: continue
        o = RES[r["ticker"]]
        if day not in o["date"]: continue
        i = o["date"].index(day)
        if not np.isfinite(o["g"][i]): continue
        g = abs(float(o["g"][i]) - float(r["composite"])); gaps.append(g); worst.append((g, r["ticker"], round(float(o["g"][i]), 4), float(r["composite"]), r["as_of"][11:16]))
    if not gaps: continue
    gaps = np.array(gaps); worst.sort(reverse=True)
    out[day] = {"names": int(len(gaps)), "exact_1e4": int((gaps < 1e-4).sum()), "median": float(np.median(gaps)), "p90": float(np.percentile(gaps, 90)), "max": float(gaps.max()),
                "worst": [{"s": w[1], "replay": w[2], "stored": w[3]} for w in worst[:6]], "stored_at_utc": worst[0][4]}
    print(day, "names", len(gaps), "| equal to 4 decimals:", int((gaps < 1e-4).sum()), "| median %.6f p90 %.6f max %.4f" % (np.median(gaps), np.percentile(gaps, 90), gaps.max()), "| worst", [(w[1], w[2], w[3]) for w in worst[:6]])
json.dump(out, open("validate-stored.json", "w"), indent=1)

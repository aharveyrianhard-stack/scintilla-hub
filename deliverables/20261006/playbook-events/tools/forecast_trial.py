#!/usr/bin/env python3
"""Open forecasting-model trial on our own bars: Kronos (candle foundation model, MIT) and Chronos-Bolt (Amazon, Apache-2.0),
both local, no API. Walk-forward: at each origin the model sees only the bars before it and forecasts the next 20 sessions.
Scored against what happened and against two do-nothing baselines (no change; the name's own average 20-session drift).
  run inside the scratch venv:  KRONOS_DIR=<clone> python forecast_trial.py
Writes data/models/forecast.json."""
import json, os, sys, time, warnings
warnings.filterwarnings("ignore")
import numpy as np, pandas as pd, torch
HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "..", "data"); OUT = os.path.join(DATA, "models"); os.makedirs(OUT, exist_ok=True)
NAMES = ["SPY", "MU", "AVGO", "SNDK", "XLV"]; H = 20; LOOK = 400; STEP = 10; ORIGINS = 50
sys.path.insert(0, os.environ.get("KRONOS_DIR", "Kronos"))

def load(sym):
    rows = json.load(open(os.path.join(DATA, "bars", sym + ".json"))); df = pd.DataFrame(rows)
    df["timestamps"] = pd.to_datetime(df["t"], unit="ms"); df = df[df["c"] > 0].drop_duplicates("timestamps").reset_index(drop=True)
    df = df.rename(columns={"o": "open", "h": "high", "l": "low", "c": "close", "v": "volume"}); df["volume"] = df["volume"].fillna(0.0); df["amount"] = df["volume"] * df["close"]
    return df

def origins(df):
    n = len(df); last = n - H - 1; first = max(min(LOOK, 150 if n < LOOK + 200 else LOOK), last - STEP * (ORIGINS - 1)); return list(range(first, last + 1, STEP))   # a short history (SNDK) starts after 150 bars

def score(rows):
    """rows: dicts with pred_ret, act_ret, pred_low, act_low, pred_high, act_high, drift"""
    R = pd.DataFrame(rows); d = {"n": int(len(R))}
    d["direction_hit"] = float((np.sign(R.pred_ret) == np.sign(R.act_ret)).mean()); d["always_up_hit"] = float((R.act_ret > 0).mean())
    d["mae_ret"] = float((R.pred_ret - R.act_ret).abs().mean()); d["mae_no_change"] = float(R.act_ret.abs().mean()); d["mae_own_drift"] = float((R.drift - R.act_ret).abs().mean())
    d["corr"] = float(np.corrcoef(R.pred_ret, R.act_ret)[0, 1]) if R.pred_ret.std() > 0 else None
    if "pred_low" in R and R.pred_low.notna().all():
        d["mae_low"] = float((R.pred_low - R.act_low).abs().mean()); d["corr_low"] = float(np.corrcoef(R.pred_low, R.act_low)[0, 1])
        d["mae_high"] = float((R.pred_high - R.act_high).abs().mean()); d["corr_high"] = float(np.corrcoef(R.pred_high, R.act_high)[0, 1])
    if "q10" in R:
        d["inside_10_90_band"] = float(((R.act_ret >= R.q10) & (R.act_ret <= R.q90)).mean())
    d["pred_up_share"] = float((R.pred_ret > 0).mean())
    return d

def actuals(df, o):
    c0 = df.close.iloc[o - 1]; fut = df.iloc[o:o + H]
    past = df.close.iloc[:o].values; dr = np.median(past[H:] / past[:-H] - 1) if len(past) > H + 50 else 0.0
    return c0, {"origin": str(df.timestamps.iloc[o - 1].date()), "act_ret": float(fut.close.iloc[-1] / c0 - 1), "act_low": float(fut.low.min() / c0 - 1), "act_high": float(fut.high.max() / c0 - 1), "drift": float(dr)}

def run_kronos(size):
    from model import Kronos, KronosTokenizer, KronosPredictor
    tok = KronosTokenizer.from_pretrained("NeoQuasar/Kronos-Tokenizer-base"); model = Kronos.from_pretrained(f"NeoQuasar/Kronos-{size}")
    dev = "mps" if torch.backends.mps.is_available() else "cpu"
    try: pred = KronosPredictor(model, tok, device=dev, max_context=512)
    except TypeError: pred = KronosPredictor(model, tok, max_context=512)
    res = {}; t0 = time.time()
    for sym in NAMES:
        df = load(sym); rows = []
        for o in origins(df):
            if o < 120: continue
            lo = max(0, o - LOOK); x = df.loc[lo:o - 1, ["open", "high", "low", "close", "volume", "amount"]].reset_index(drop=True)
            xt = df.loc[lo:o - 1, "timestamps"].reset_index(drop=True); yt = df.loc[o:o + H - 1, "timestamps"].reset_index(drop=True)
            p = pred.predict(df=x, x_timestamp=xt, y_timestamp=yt, pred_len=H, T=1.0, top_p=0.9, sample_count=5, verbose=False)
            c0, a = actuals(df, o); a.update({"pred_ret": float(p.close.iloc[-1] / c0 - 1), "pred_low": float(p.low.min() / c0 - 1), "pred_high": float(p.high.max() / c0 - 1)}); rows.append(a)
        res[sym] = {"score": score(rows), "rows": rows}; print(f"kronos-{size}", sym, res[sym]["score"], flush=True)
    allrows = [r for s in res for r in res[s]["rows"]]
    return {"model": f"NeoQuasar/Kronos-{size}", "device": dev, "seconds": round(time.time() - t0, 1), "per_name": res, "pooled": score(allrows)}

def run_chronos(name="amazon/chronos-bolt-base"):
    from chronos import BaseChronosPipeline
    pipe = BaseChronosPipeline.from_pretrained(name, device_map="cpu"); res = {}; t0 = time.time()
    for sym in NAMES:
        df = load(sym); rows = []
        for o in origins(df):
            if o < 120: continue
            ctx = torch.tensor(df.close.values[max(0, o - 512):o], dtype=torch.float32)
            q, mean = pipe.predict_quantiles(ctx, prediction_length=H, quantile_levels=[0.1, 0.5, 0.9])
            c0, a = actuals(df, o); q = q[0].numpy()
            a.update({"pred_ret": float(q[-1, 1] / c0 - 1), "q10": float(q[-1, 0] / c0 - 1), "q90": float(q[-1, 2] / c0 - 1), "pred_low": float("nan"), "pred_high": float("nan")}); rows.append(a)
        res[sym] = {"score": score(rows), "rows": rows}; print(name, sym, res[sym]["score"], flush=True)
    allrows = [r for s in res for r in res[s]["rows"]]
    return {"model": name, "device": "cpu", "seconds": round(time.time() - t0, 1), "per_name": res, "pooled": score(allrows)}

if __name__ == "__main__":
    out = {"design": {"names": NAMES, "horizon_sessions": H, "lookback": LOOK, "origins_per_name": ORIGINS, "step": STEP}}
    p = os.path.join(OUT, "forecast.json")
    if os.path.exists(p): out.update({k: v for k, v in json.load(open(p)).items() if k != "design"})
    for key, fn in (("chronos_bolt_base", run_chronos), ("kronos_small", lambda: run_kronos("small")), ("kronos_base", lambda: run_kronos("base"))):
        if len(sys.argv) > 1 and key not in sys.argv[1:]: continue
        try: out[key] = fn()
        except Exception as e:
            import traceback; traceback.print_exc(); out[key] = {"error": repr(e)[:500]}
        json.dump(out, open(p, "w"), indent=1)

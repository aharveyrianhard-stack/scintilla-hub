#!/usr/bin/env python3
"""Open toolkit trial for job (ii), event studies: vectorbt, TA-Lib and Microsoft Qlib on our own bars.
The point is an INDEPENDENT recount: does a public, maintained library reproduce the numbers our own script printed?
  run inside the scratch venv (vectorbt, TA-Lib, pyqlib, lightgbm installed).
Writes data/models/toolkits.json."""
import json, os, sys, time, warnings
warnings.filterwarnings("ignore")
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "..", "data"); OUT = os.path.join(DATA, "models"); os.makedirs(OUT, exist_ok=True)
sys.path.insert(0, HERE); import events as EV
NAMES = ["SPY", "MU", "AVGO", "SNDK", "XLV"]; res = {}

def ours(sym):
    df = EV.indicators(EV.load(sym)); up = [d for d, k in EV.cross_events(df, "sma200", "x200") if k.endswith("up")]; dn = [d for d, k in EV.cross_events(df, "sma200", "x200") if k.endswith("down")]
    return df, up, dn

def main():
    # Qlib starts worker processes that re-import this file, so everything below must sit behind the main guard
    # ---- TA-Lib: the same indicators from the reference C library ----
    try:
        import talib; t0 = time.time(); r = {}
        for s in NAMES:
            df, _, _ = ours(s); c = df["c"].values.astype(float); h = df["h"].values.astype(float); l = df["l"].values.astype(float)
            rsi = talib.RSI(c, 14); wr = talib.WILLR(h, l, c, 14); s200 = talib.SMA(c, 200); e21 = talib.EMA(c, 21)
            ok = ~np.isnan(rsi) & df["rsi"].notna().values; ok2 = ~np.isnan(wr) & df["wr"].notna().values; ok3 = ~np.isnan(s200) & df["sma200"].notna().values
            tail = slice(-500, None)   # TA-Lib seeds its EMA with an SMA; ours seeds with the first close, so compare once both have settled
            r[s] = {"rsi_max_abs_diff_last500": float(np.abs(rsi[tail] - df["rsi"].values[tail])[ok[tail]].max()), "willr_max_abs_diff": float(np.abs(wr - df["wr"].values)[ok2].max()),
                    "sma200_max_abs_diff": float(np.abs(s200 - df["sma200"].values)[ok3].max()), "ema21_max_pct_diff_last500": float(np.nanmax(np.abs(e21[tail] / df["ema21"].values[tail] - 1))),
                    "rsi_last_talib": float(rsi[-1]), "rsi_last_ours": float(df["rsi"].iloc[-1])}
        res["talib"] = {"version": talib.__version__, "seconds": round(time.time() - t0, 2), "per_name": r}; print("talib", r)
    except Exception as e: res["talib"] = {"error": repr(e)[:300]}; print("talib ERR", e)

    # ---- vectorbt: recount the 200-day crosses and the 60-session outcomes ----
    try:
        import vectorbt as vbt; t0 = time.time(); r = {}
        for s in NAMES:
            df, up, dn = ours(s); c = df["c"]; ma = vbt.MA.run(c, 200).ma
            above = c >= ma; valid = ma.notna() & ma.shift(1).notna()
            vup = valid & above & ~above.shift(1, fill_value=False) & ma.shift(1).notna(); vdn = valid & ~above & above.shift(1, fill_value=False)
            # 60-session outcomes through vectorbt's own portfolio engine: enter at the close of the cross day, leave 60 sessions later
            exits = vup.shift(60, fill_value=False)
            pf = vbt.Portfolio.from_signals(c, entries=vup, exits=exits, freq="1D", accumulate=False, fees=0.0)
            fwd = (c.shift(-60) / c - 1)[vup].dropna(); mine = pd.Series({d: c.shift(-60).get(d) / c.get(d) - 1 for d in up}).dropna()
            r[s] = {"x200_up_ours": len(up), "x200_up_vectorbt": int(vup.sum()), "x200_down_ours": len(dn), "x200_down_vectorbt": int(vdn.sum()), "same_dates_up": bool(set(up) == set(vup[vup].index)),
                    "ret_60_med_ours": float(mine.median()) if len(mine) else None, "ret_60_med_vectorbt": float(fwd.median()) if len(fwd) else None,
                    "ret_60_pos_vectorbt": float((fwd > 0).mean()) if len(fwd) else None, "portfolio_trades_non_overlapping": int(pf.trades.count()), "portfolio_win_rate": float(pf.trades.win_rate()) if pf.trades.count() else None}
        res["vectorbt"] = {"version": vbt.__version__, "seconds": round(time.time() - t0, 2), "per_name": r}; print("vectorbt", r)
    except Exception as e:
        import traceback; traceback.print_exc(); res["vectorbt"] = {"error": repr(e)[:300]}

    # ---- Qlib: load our bars into its store, build Alpha158, fit its stock LightGBM, read the rank correlation out of sample ----
    try:
        import qlib, subprocess, shutil, tempfile; t0 = time.time()
        work = os.environ.get("QLIB_WORK", tempfile.mkdtemp()); csv = os.path.join(work, "csv"); store = os.path.join(work, "store"); shutil.rmtree(csv, ignore_errors=True); shutil.rmtree(store, ignore_errors=True); os.makedirs(csv)
        UNIV = [f[:-5] for f in sorted(os.listdir(os.path.join(DATA, "bars"))) if f[:-5] not in ("VIX", "US10Y", "PCC", "BTCUSD", "CLUSD", "GCUSD", "SIUSD")]
        for s in UNIV:
            df = EV.load(s).reset_index(); o = pd.DataFrame({"date": df["date"].dt.strftime("%Y-%m-%d"), "open": df["o"], "high": df["h"], "low": df["l"], "close": df["c"], "volume": df["v"].fillna(0), "factor": 1.0}); o["symbol"] = s
            o.to_csv(os.path.join(csv, s + ".csv"), index=False)
        import qlib.utils; dump = os.path.join(os.environ.get("QLIB_SCRIPTS", ""), "dump_bin.py")
        subprocess.run([sys.executable, dump, "dump_all", "--data_path", csv, "--qlib_dir", store, "--include_fields", "open,high,low,close,volume,factor", "--date_field_name", "date", "--symbol_field_name", "symbol"], check=True, capture_output=True)
        assert os.path.isdir(os.path.join(store, "features")), "qlib store was not written"
        from qlib.constant import REG_US; qlib.init(provider_uri=store, region=REG_US, exp_manager={"class": "MLflowExpManager", "module_path": "qlib.workflow.expm", "kwargs": {"uri": "file://" + os.path.abspath(os.path.join(work, "mlruns")), "default_exp_name": "pb1"}})
        from qlib.contrib.data.handler import Alpha158; from qlib.data.dataset import DatasetH; import lightgbm as lgb
        seg = {"train": ("2005-01-01", "2019-12-31"), "valid": ("2020-01-01", "2022-12-31"), "test": ("2023-01-01", "2026-09-01")}
        hd = Alpha158(instruments="all", start_time="2004-06-01", end_time="2026-09-01", fit_start_time=seg["train"][0], fit_end_time=seg["train"][1], label=(["Ref($close, -20)/$close - 1"], ["LABEL0"]))
        ds = DatasetH(hd, seg)
        # Qlib supplies the data store and its 158 stock features; the trees are plain LightGBM (the model Qlib's own benchmark uses)
        X = {k: ds.prepare(k, col_set="feature", data_key="learn" if k != "test" else "infer") for k in seg}; Y = {k: ds.prepare(k, col_set="label", data_key="learn" if k != "test" else "infer").iloc[:, 0] for k in seg}
        ok = {k: Y[k].notna() for k in seg}
        model = lgb.LGBMRegressor(num_leaves=31, learning_rate=0.05, n_estimators=300, colsample_bytree=0.8, subsample=0.8, subsample_freq=1, verbosity=-1, random_state=7)
        model.fit(X["train"][ok["train"]], Y["train"][ok["train"]], eval_set=[(X["valid"][ok["valid"]], Y["valid"][ok["valid"]])], callbacks=[lgb.early_stopping(30, verbose=False)])
        raw_lab = ds.prepare("test", col_set="label", data_key="raw").iloc[:, 0]
        pred = pd.Series(model.predict(X["test"]), index=X["test"].index); lab = raw_lab; J = pd.concat([pred.rename("p"), lab.rename("y")], axis=1).dropna()
        ic = J.groupby(level="datetime").apply(lambda g: g["p"].corr(g["y"], method="spearman")).dropna()
        top = J.groupby(level="datetime").apply(lambda g: g.nlargest(5, "p")["y"].mean() - g["y"].mean())
        res["qlib"] = {"version": qlib.__version__, "seconds": round(time.time() - t0, 1), "universe": len(UNIV), "features": int(ds.prepare("train", col_set="feature").shape[1]), "train_rows": int(ds.prepare("train", col_set="feature").shape[0]),
                       "test": seg["test"], "label": "20-session forward return, ranked across our names each day", "test_days": int(len(ic)), "rank_ic_mean": float(ic.mean()), "rank_ic_std": float(ic.std()), "rank_ic_positive_days": float((ic > 0).mean()),
                       "top5_minus_universe_20d_mean": float(top.mean()), "top5_minus_universe_positive_days": float((top > 0).mean())}
        print("qlib", res["qlib"])
    except Exception as e:
        import traceback; traceback.print_exc(); res["qlib"] = {"error": repr(e)[:600]}
    json.dump(res, open(os.path.join(OUT, "toolkits.json"), "w"), indent=1)

if __name__ == "__main__":
    main()

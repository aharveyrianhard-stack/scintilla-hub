# PF1 · the shared rules every structure is measured by: total-return prices, the cash rate, one trade simulator, one set of
# metrics, and one scorecard for the last two years' pullbacks and breakouts. Every structure file imports this, so the
# comparison table compares like with like.
#
# CONVENTIONS (the page prints these in PAGE SPECS):
#   * Prices are the chart API's split-adjusted daily bars. Dividends from the Hub's `dividends` table are added back on the
#     ex-date, so every return here is a TOTAL return (price + dividends reinvested).
#   * Cash earns the 3-month Treasury bill yield (chart API US3M), accrued daily at yield / 252.
#   * A rule reads only what is known at a session's close. Its orders fill at the NEXT session's close (one-session lag).
#   * Every order pays a cost: 5 basis points of the amount traded for funds, 10 for single stocks (a basis point = 0.01%).
#   * No leverage, no shorting, no taxes. FULL window 2005-01-03 → 2026-10-05; LAST2 window 2024-10-03 → 2026-10-05.
#   * "A year" in every yearly rate is 252 sessions. By the calendar FULL is 21.75 years against 21.71 counted this way, so
#     each yearly rate here is about 0.02 points high at 10% a year (0.07 at 35%). Total returns are exact.
import json, os, math
import numpy as np, pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "..", "data")
FULL = ("2005-01-03", "2026-10-05"); LAST2 = ("2024-10-03", "2026-10-05")
STRESS = {"2008 crash": ("2007-10-09", "2009-03-09"), "2020 crash": ("2020-02-19", "2020-03-23"), "2022 bear": ("2022-01-03", "2022-10-12")}
INDEX = ["SPY", "QQQ", "IWM", "RSP", "SMH"]; SECTORS = ["XLK", "XLV", "XLF", "XLY", "XLI", "XLB", "XLE", "XLP", "XLU", "XLRE", "XLC"]
BONDS = ["IEF", "TLT", "SHY"]; LEADERS = ["NVDA", "MSFT", "AAPL", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "MU", "VST", "BE", "NBIS", "CRWV"]
STOCKLIKE = set(INDEX + SECTORS + LEADERS + ["EFA"]); FUNDS = set(INDEX + SECTORS + BONDS + ["EFA"])
COST_BPS_FUND, COST_BPS_STOCK = 5.0, 10.0


class Data:
    pass


def load():
    D = Data()
    for k in "ohlc": setattr(D, k, pd.read_csv(os.path.join(DATA, f"bars_{k}.csv.gz"), index_col=0))
    D.dates = list(D.c.index); D.ix = {d: i for i, d in enumerate(D.dates)}
    divs = json.load(open(os.path.join(DATA, "dividends.json")))
    dv = pd.DataFrame(0.0, index=D.c.index, columns=D.c.columns)
    for s, rows in divs.items():
        if s not in dv.columns: continue
        for d, a, _ in rows:
            if d in D.ix: dv.at[d, s] += a
            else:                                   # an ex-date that is not a session: credit it on the next session
                j = np.searchsorted(D.dates, d)
                if j < len(D.dates): dv.iat[j, dv.columns.get_loc(s)] += a
    D.div = dv
    prev = D.c.shift(1)
    D.ret = ((D.c + dv) / prev - 1.0)                # daily TOTAL return, NaN until the second bar of a symbol
    for s in ["US3M", "VIX"]: D.ret[s] = np.nan
    D.pret = D.c / prev - 1.0                        # price-only return (for the dividend check)
    y = D.c["US3M"].ffill()
    D.cash_ret = (y.shift(1) / 100.0 / 252.0).fillna(0.0)   # yesterday's bill yield accrues today
    D.vix = D.c["VIX"].ffill()
    D.tr = (1.0 + D.ret.fillna(0.0)).cumprod()       # total-return index, 1.0 at each symbol's first bar
    D.tr = D.tr.where(D.c.notna())
    D.meta = json.load(open(os.path.join(DATA, "meta.json")))
    return D


def sma(s, n): return s.rolling(n, min_periods=n).mean()
def ema(s, n): return s.ewm(span=n, adjust=False, min_periods=n).mean()
def month_ends(D, start, end):
    ds = [d for d in D.dates if start <= d <= end]
    return [d for i, d in enumerate(ds) if i + 1 == len(ds) or ds[i + 1][:7] != d[:7]]
def trailing_tr(D, sym, n):                          # total return over the last n sessions, known at each close
    return D.tr[sym] / D.tr[sym].shift(n) - 1.0
def cash_trailing(D, n): return (1.0 + D.cash_ret).cumprod() / (1.0 + D.cash_ret).cumprod().shift(n) - 1.0


def simulate(D, decide, start=FULL[0], end=FULL[1], initial=None, name="", lag=1):
    """Runs one rule. `decide(i, date, w)` is called at every close from `start` to `end` with i = the row number in D.dates
    and w = the portfolio's weights at that close ({symbol: share}, plus 'CASH'). It returns None for no action, or a full
    target {symbol: share}; shares sum to at most 1 and whatever is left is cash. The target is filled at the close `lag`
    sessions later. `initial` is the target filled at `start` itself (default all cash)."""
    i0, i1 = D.ix[start], D.ix[end]
    if lag < 1: raise ValueError("lag must be at least one session: a rule cannot trade on the close it reads")
    val = {}; cash = 1.0; pending = {}; eq = []; expo = []; bond = []; trades = []; decision_days = 0; turnover = 0.0; cost_paid = 0.0
    def rebalance(target, i):
        nonlocal cash, turnover, cost_paid
        for s, w in target.items():
            if not np.isfinite(w) or w < -1e-9: raise ValueError(f"bad share for {s} on {D.dates[i]}: {w}")
            if s != "CASH" and s not in STOCKLIKE and s not in BONDS: raise ValueError(f"{s} is not something this study can hold")
        total = cash + sum(val.values()); t = {s: w for s, w in target.items() if s != "CASH" and w > 1e-9}
        if sum(t.values()) > 1.0 + 1e-6: raise ValueError(f"target over 100% on {D.dates[i]}: {t}")
        for s in t:
            if not np.isfinite(D.c.iat[i, D.c.columns.get_loc(s)]): raise ValueError(f"{s} has no price on {D.dates[i]}")
        n = 0; c = 0.0; tv = 0.0
        for s in sorted(set(list(val) + list(t))):         # name order, so a re-run gives the same digits
            cur = val.get(s, 0.0); new = t.get(s, 0.0) * total; d = new - cur
            if abs(d) < 0.0025 * total: continue                  # ignore dust under a quarter of a percent
            bps = COST_BPS_FUND if s in FUNDS else COST_BPS_STOCK
            c += abs(d) * bps / 1e4; tv += abs(d); n += 1
            trades.append({"date": D.dates[i], "sym": s, "delta_pct": round(100 * d / total, 2)})
            if new <= 1e-12: val.pop(s, None)
            else: val[s] = new
            cash -= d
        cash -= c; turnover += tv / total; cost_paid += c / total
        if cash < 0 and val:                                      # the cost of a fully invested target comes out of the largest holding
            big = max(sorted(val), key=val.get); val[big] += cash; cash = 0.0
        return n
    if initial: rebalance(initial, i0)
    for i in range(i0, i1 + 1):
        if i > i0:
            for s in list(val):
                r = D.ret.iat[i, D.ret.columns.get_loc(s)]
                val[s] *= 1.0 + (r if np.isfinite(r) else 0.0)
            cash *= 1.0 + D.cash_ret.iat[i]
        if i in pending:
            if rebalance(pending.pop(i), i): decision_days += 1
        total = cash + sum(val.values())
        w = {s: v / total for s, v in val.items()}; w["CASH"] = cash / total
        eq.append(total); expo.append(sum(v for s, v in w.items() if s in STOCKLIKE)); bond.append(sum(v for s, v in w.items() if s in BONDS))
        if i + lag <= i1:
            tgt = decide(i, D.dates[i], w)
            if tgt is not None: pending[i + lag] = tgt
    idx = D.dates[i0:i1 + 1]
    return {"name": name, "equity": pd.Series(eq, index=idx), "stock": pd.Series(expo, index=idx), "bond": pd.Series(bond, index=idx),
            "trades": trades, "decision_days": decision_days, "turnover": turnover, "cost_paid": cost_paid}


def fixed_mix(D, mix, start=FULL[0], end=FULL[1], name="", monthly=True):
    """A constant mix, rebalanced at each month end (or never)."""
    me = set(month_ends(D, start, end))
    def decide(i, d, w): return dict(mix) if (monthly and d in me and any(abs(w.get(s, 0) - x) > 0.02 for s, x in mix.items())) else None
    return simulate(D, decide, start, end, initial=dict(mix), name=name)


def from_exposure(D, expo, asset="SPY", start=LAST2[0], end=LAST2[1], name="", band=0.02):
    """Holds `asset` at the share given by the series `expo` (a share known at each close), the rest in cash."""
    def decide(i, d, w):
        x = expo.get(d)
        return None if x is None or not np.isfinite(x) or abs(w.get(asset, 0.0) - x) < band else {asset: float(x)}
    x0 = expo.get(start); return simulate(D, decide, start, end, initial={asset: float(x0)} if x0 is not None and np.isfinite(x0) else None, name=name)


def _dd(eq):
    peak = eq.cummax(); dd = eq / peak - 1.0; t = dd.idxmin(); p = eq.loc[:t].idxmax()
    return float(dd.min()), p, t


def metrics(sim, start, end):
    eq = sim["equity"].loc[start:end]; st = sim["stock"].loc[start:end]; bd = sim["bond"].loc[start:end]
    n = len(eq); yrs = (n - 1) / 252.0; r = eq.pct_change().dropna()
    mdd, p, t = _dd(eq); tr = [x for x in sim["trades"] if start < x["date"] <= end]; months = yrs * 12.0
    m = {"start": start, "end": end, "sessions": n, "total_return_pct": round(100 * (eq.iloc[-1] / eq.iloc[0] - 1), 1),
            "cagr_pct": round(100 * ((eq.iloc[-1] / eq.iloc[0]) ** (1 / yrs) - 1), 2), "vol_pct": round(100 * r.std() * math.sqrt(252), 1),
            "max_dd_pct": round(100 * mdd, 1), "dd_peak": p, "dd_trough": t,
            "avg_stock_pct": round(100 * st.mean(), 1), "avg_bond_pct": round(100 * bd.mean(), 1), "avg_cash_pct": round(100 * (1 - st.mean() - bd.mean()), 1),
            "days_under_half_stock_pct": round(100 * (st < 0.5).mean(), 1), "days_out_of_stock_pct": round(100 * (st < 0.05).mean(), 1),
            "decision_days_per_month": round(len(set(x["date"] for x in tr)) / months, 2), "orders_per_month": round(len(tr) / months, 2),
            "return_over_maxdd": round(((eq.iloc[-1] / eq.iloc[0]) ** (1 / yrs) - 1) / abs(mdd), 2) if mdd < -0.0005 else None}
    return {k: (v + 0.0 if isinstance(v, float) else v) for k, v in m.items()}        # no "-0.0" on the page


def year_table(sim):
    eq = sim["equity"]; out = {}
    for y in sorted(set(d[:4] for d in eq.index)):
        e = eq[[d for d in eq.index if d[:4] == y]]; prev = eq.loc[:e.index[0]]
        base = prev.iloc[-2] if len(prev) > 1 else e.iloc[0]; out[y] = round(100 * (e.iloc[-1] / base - 1), 1)
    return out


def pullbacks(D, start=LAST2[0], end=LAST2[1], depth=0.05, sym="SPY"):
    """Every fall of `depth` or more in SPY's close from a high inside the window: peak, trough, depth, and the day it made a new high."""
    c = D.c[sym].loc[start:end]; out = []; peak_d = c.index[0]; peak = c.iloc[0]; trough = peak; trough_d = peak_d
    for d, v in c.items():
        if v > peak:
            if trough / peak - 1 <= -depth: out.append({"peak": peak_d, "trough": trough_d, "depth_pct": round(100 * (trough / peak - 1), 1), "recovered": d})
            peak, peak_d, trough, trough_d = v, d, v, d
        elif v < trough: trough, trough_d = v, d
    if trough / peak - 1 <= -depth: out.append({"peak": peak_d, "trough": trough_d, "depth_pct": round(100 * (trough / peak - 1), 1), "recovered": None})
    return out


def breakouts():
    r = json.load(open(os.path.join(DATA, "tool-replay.json")))
    return sorted(r["breaks"], key=lambda b: b["breakDate"])


def scorecard(sim, D):
    """How the rule handled the last two years: each SPY pullback of 5% or more, and each of HEAT1's 2-week-pivot breakouts."""
    eq, st = sim["equity"], sim["stock"]; spy = D.tr["SPY"]; pb = []; bo = []
    for p in pullbacks(D):
        a, b = p["peak"], p["trough"]; j = min(D.ix[b] + 40, D.ix[LAST2[1]]); c = D.dates[j]
        pb.append({**p, "stock_at_peak_pct": round(100 * st[a]), "stock_at_trough_pct": round(100 * st[b]),
                   "fall_pct": round(100 * (eq[b] / eq[a] - 1), 1), "spy_fall_pct": round(100 * (spy[b] / spy[a] - 1), 1),
                   "rebound40_pct": round(100 * (eq[c] / eq[b] - 1), 1), "spy_rebound40_pct": round(100 * (spy[c] / spy[b] - 1), 1),
                   "round_trip_pct": round(100 * (eq[c] / eq[a] - 1), 1), "spy_round_trip_pct": round(100 * (spy[c] / spy[a] - 1), 1), "rebound_to": c})
    for b in breakouts():
        d = b["breakDate"]
        if d not in eq.index: continue
        j = D.ix[d] + 20; f = D.tr[b["sym"]]
        row = {"sym": b["sym"], "date": d, "level": b["level"], "stock_on_break_pct": round(100 * st[d])}
        if j <= D.ix[LAST2[1]]:
            e = D.dates[j]; row.update({"next20_pct": round(100 * (eq[e] / eq[d] - 1), 1), "fund_next20_pct": round(100 * (f[e] / f[d] - 1), 1)})
        bo.append(row)
    return {"pullbacks": pb, "breakouts": bo}


def stress(sim):
    eq = sim["equity"]; return {k: round(100 * (eq[b] / eq[a] - 1), 1) for k, (a, b) in STRESS.items() if a in eq.index and b in eq.index}


def curve(sim, start=None, end=None, step=1):
    eq = sim["equity"].loc[start:end] if start else sim["equity"]; eq = eq / eq.iloc[0]
    st = sim["stock"].loc[eq.index[0]:eq.index[-1]]
    pts = list(range(0, len(eq), step));  pts = pts if pts[-1] == len(eq) - 1 else pts + [len(eq) - 1]
    return {"dates": [eq.index[i] for i in pts], "equity": [round(float(eq.iloc[i]), 4) for i in pts], "stock": [round(float(st.iloc[i]), 3) for i in pts]}


def report(sim, D, label, note=""):
    """The standard block every structure variant returns."""
    return {"label": label, "note": note, "full": metrics(sim, *FULL) if sim["equity"].index[0] <= FULL[0] else None,
            "last2": metrics(sim, *LAST2), "stress": stress(sim), "years": year_table(sim), "scorecard": scorecard(sim, D),
            "curve_full": curve(sim, step=5) if sim["equity"].index[0] <= FULL[0] else None, "curve_last2": curve(sim, *LAST2),
            "cost_paid_pct": round(100 * sim["cost_paid"], 2), "turnover_x": round(sim["turnover"], 1)}


def save(name, obj):
    p = os.path.join(DATA, name); json.dump(obj, open(p, "w"), separators=(",", ":")); return p

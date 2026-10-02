#!/usr/bin/env python3
"""Scintilla · H8 (2 Oct) · THE LOAD STEP, run on the Mac — turns the JSON that scripts/h8-fmp-facts.mjs printed on Fly into
SQL for public.company_profile (UPDATEs keyed by ticker, 100 names per transaction) and public.etf_info (INSERT … ON CONFLICT
DO NOTHING for the funds). It never talks to FMP and holds no key; the SQL is run with
    supabase db query --linked --project-ref wadinxqplrggagkvrdag "$(cat <batch>.sql)"
Rollback (written before the ALTER): /Users/alanharvey/SCINTILLA 0.5/_archive/backend-fix-20260928/ROLLBACK-company-profile-h8-20261002.sql
    python3 scripts/h8-load-facts.py <h8-out.json> <out dir>"""
import json, os, sys
src, out = sys.argv[1], sys.argv[2]
d = json.load(open(src)); rows = d["rows"]; ts = d["at"]
os.makedirs(out, exist_ok=True)
dp = lambda v: "NULL::double precision" if v is None else f"{float(v)!r}::double precision"
dt = lambda v: "NULL::date" if not v else f"'{v}'::date"
q = lambda v: "NULL" if v is None else "$h8$" + str(v).replace("$h8$", "") + "$h8$"
vals = []
for r in rows:
    t = r["ticker"].replace("'", "''")
    if r.get("dividend_per_share") is not None: dps, dy, exd = r["dividend_per_share"], r.get("dividend_yield"), r.get("ex_dividend_date")
    elif r.get("dividends_none"): dps, dy, exd = 0.0, 0.0, None      # FMP's dividend list for the name is empty: "none on record"
    else: dps = dy = exd = None                                       # no answer at all: stays "not stored"
    vals.append(f"('{t}',{dp(r.get('shares_outstanding'))},{dp(r.get('float_shares'))},{dp(dps)},{dp(dy)},{dt(exd)})")
for i in range(0, len(vals), 100):
    open(f"{out}/batch-{i // 100:02d}.sql", "w").write(
        "BEGIN;\nUPDATE public.company_profile p SET shares_outstanding=v.so, shares_out=COALESCE(p.shares_out, v.so), float_shares=v.fl, "
        f"dividend_per_share=v.dps, dividend_yield=v.dy, ex_dividend_date=v.exd, facts_as_of='{ts}'::timestamptz\nFROM (VALUES\n"
        + ",\n".join(vals[i:i + 100]) + "\n) AS v(ticker,so,fl,dps,dy,exd) WHERE p.ticker=v.ticker;\nCOMMIT;")
etf = []
for r in rows:
    e = r.get("etf")
    if not e: continue
    etf.append("(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,now())" % (
        q(r["ticker"]), q(e.get("name")), q(e.get("description")), q(e.get("website")), q(e.get("etf_company")),
        dp(e.get("expense_ratio")).replace("::double precision", "::double precision"), dp(e.get("aum")),
        "NULL" if e.get("avg_volume") is None else f"{int(e['avg_volume'])}::bigint",
        "NULL" if not e.get("inception_date") else f"'{e['inception_date']}'::date", dp(e.get("nav")),
        "NULL" if e.get("holdings_count") is None else f"{int(e['holdings_count'])}::integer", q(json.dumps(e.get("sectors") or []))))
if etf:
    open(f"{out}/etf-info-insert.sql", "w").write(
        "BEGIN;\nINSERT INTO public.etf_info (ticker,name,description,website,etf_company,expense_ratio,aum,avg_volume,inception_date,nav,holdings_count,sectors,updated_ts) VALUES\n"
        + ",\n".join(etf) + "\nON CONFLICT (ticker) DO NOTHING;\nCOMMIT;")
print(f"{len(vals)} names → {(len(vals) + 99) // 100} company_profile batches · {len(etf)} fund rows → etf-info-insert.sql · facts_as_of {ts}")

#!/usr/bin/env python3
"""M54 · fetch the index reference files the standard tree is anchored to.

These are EXTERNAL reference documents, not prices. Nothing here is served to a screen as a
quote, and none of it is written to any price table.

  · SPY holdings (State Street's own daily file)  -> every S&P 500 member and its index weight
  · DIA holdings (State Street's own daily file)  -> the Dow 30 members and their weights
  · Wikipedia's S&P 500 component table           -> the GICS sector and sub-industry per member

Writes data/reference/*.json with the source URL and the "as of" line each file carries.
Re-run it to refresh; the build script reads only the JSON.
"""
import json, os, re, sys, urllib.request, zipfile, datetime
from xml.etree import ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "reference")
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/129 Safari/537.36"}
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
SSGA = "https://www.ssga.com/us/en/intermediary/library-content/products/fund-data/etfs/us/holdings-daily-us-en-%s.xlsx"
WIKI = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"


def get(url, timeout=90):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return r.read()


def xlsx_rows(blob, path):
    open(path, "wb").write(blob)
    z = zipfile.ZipFile(path)
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS):
            shared.append("".join(t.text or "" for t in si.iter("{%s}t" % NS["m"])))
    rows = []
    for row in ET.fromstring(z.read("xl/worksheets/sheet1.xml")).findall(".//m:row", NS):
        vals = []
        for c in row.findall("m:c", NS):
            v = c.find("m:v", NS)
            vals.append("" if v is None else (shared[int(v.text)] if c.get("t") == "s" else v.text))
        rows.append(vals)
    return rows


def holdings(fund):
    rows = xlsx_rows(get(SSGA % fund.lower()), os.path.join(OUT, fund + "-holdings.xlsx"))
    asof = next((r[1] for r in rows if r and r[0].startswith("Holdings:")), "")
    head = next(i for i, r in enumerate(rows) if r and r[0] == "Name")
    cols = {c: i for i, c in enumerate(rows[head])}
    out = {}
    for r in rows[head + 1:]:
        if len(r) <= cols["Ticker"] or not r[cols["Ticker"]].strip():
            continue
        t = r[cols["Ticker"]].strip().replace(".", "-")
        try:
            w = float(r[cols["Weight"]])
        except (ValueError, IndexError):
            continue
        out[t] = {"name": r[cols["Name"]].strip(), "weight_pct": w}
    return {"fund": fund, "as_of": asof, "source": SSGA % fund.lower(), "n": len(out), "holdings": out}


def sp500_gics():
    html = get(WIKI).decode("utf-8", "ignore")
    rows = []
    for tbl in re.findall(r'<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>(.*?)</table>', html, re.S):
        for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", tbl, re.S):
            cells = [re.sub(r"<[^>]+>", "", c).strip().replace("&amp;", "&")
                     for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)]
            if cells:
                rows.append(cells)
    out = {}
    for r in rows:
        if len(r) >= 4 and re.fullmatch(r"[A-Z][A-Z.\-]{0,5}", r[0]) and r[2] and r[2][0].isupper():
            out[r[0].replace(".", "-")] = {"name": r[1], "gics_sector": r[2], "gics_sub_industry": r[3]}
    return {"source": WIKI, "fetched_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "n": len(out), "members": out}


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for fund in ("SPY", "DIA"):
        d = holdings(fund)
        json.dump(d, open(os.path.join(OUT, "%s-holdings.json" % fund.lower()), "w"), indent=1)
        print(fund, d["n"], d["as_of"])
    g = sp500_gics()
    json.dump(g, open(os.path.join(OUT, "sp500-gics.json"), "w"), indent=1)
    print("sp500 gics", g["n"])
    print("NOT OBTAINED: Nasdaq-100 and Russell 2000 member lists "
          "(Invesco and iShares serve a page, not a file, to this client; Wikipedia's Nasdaq-100 "
          "component table did not parse). The tree therefore anchors those two to QQQ and IWM only.")

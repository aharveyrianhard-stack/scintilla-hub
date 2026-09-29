#!/usr/bin/env python3
"""M1-MAP-590 (29 Sep) · sector, industry and market cap for the names admission v3 added (486 -> 590).

The 24 Sep standard tree (data/standard-tree-20260924.json) carries GICS sector / industry for the 317 companies served
then. The 104 names the 29 Sep sitting admitted are not in it, and the admission v3 candidates file only carries our own
cohort / theme / funds, not a sector. So each one is read from FMP's company profile — never guessed — and translated to
GICS with the SAME stated table the tree uses (IND and SECTOR_GICS in scripts/build-standard-tree.py), plus the few FMP
industries that table did not list yet (IND_EXTRA below, each a standard GICS home, listed in the output).

Where the name is an S&P 500 member, Wikipedia's component table (data/reference/sp500-gics.json) gives S&P's own GICS
sector; it is recorded beside the translation and the two are compared, so a disagreement is visible, not silent.

The FMP key lives only in the bar service's Fly secrets. `--fetch` reads the profiles from inside that machine
(read-only `fly ssh console`, key from process.env inside node, never printed; only name / sector / industry / cap come
back), in four batches of 26, paced. Without `--fetch` it re-translates the saved raw rows.

Usage:
  python3 scripts/build-market-map-profiles.py --fetch            # read FMP on Fly, save raw, translate
  python3 scripts/build-market-map-profiles.py --raw <raw.json>   # translate saved raw rows only
Output: data/market-map-profiles-v3-20260929.json
"""
import argparse, base64, datetime, importlib.util, json, os, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "market-map-profiles-v3-20260929.json")
S1 = "/Users/alanharvey/SCINTILLA 0.5/_archive/admission-v3-20260928/S1-admit-candidates.txt"
FLY_APP, FLY_MACHINE = "scintilla-massive-stocks-batch", "82d1d96a326548"

# FMP industries the tree's table did not list on 24 Sep (none of the 317 names carried them). Standard GICS homes.
IND_EXTRA = {
    "Trucking": ("Industrials", "Transportation", "Ground Transportation"),
    "Manufacturing - Metal Fabrication": ("Industrials", "Capital Goods", "Machinery"),
    "Residential Construction": ("Consumer Discretionary", "Consumer Durables & Apparel", "Household Durables"),
    "Technology Distributors": ("Information Technology", "Technology Hardware & Equipment", "Electronic Equipment, Instruments & Components"),
    "REIT - Hotel & Motel": ("Real Estate", "Equity Real Estate Investment Trusts", "Hotel & Resort REITs"),
    "Medical - Healthcare Information Services": ("Health Care", "Health Care Equipment & Services", "Health Care Technology"),
}

# runs inside node on the Fly machine: the key is read from its env and never leaves it
FETCH_JS = r"""
(async () => {
  const key = process.env.FMP_API_KEY || process.env.FMP_KEY || '';
  if (!key) { console.log('PROFILES_JSON ' + JSON.stringify({ error: 'no FMP key in env' })); return; }
  const out = [];
  for (const s of '__SYMS__'.split(',')) {
    const tries = s.includes('.') ? [s, s.replace('.', '-')] : [s];
    let row = null, status = null, used = null;
    for (const q of tries) {
      try {
        const r = await fetch('https://financialmodelingprep.com/stable/profile?symbol=' + encodeURIComponent(q) + '&apikey=' + key);
        status = r.status;
        if (r.status === 200) { const j = await r.json(); if (Array.isArray(j) && j.length) { row = j[0]; used = q; break; } }
      } catch (e) { status = 'err'; }
    }
    out.push(row ? { symbol: s, fmp_symbol: used, companyName: row.companyName, sector: row.sector, industry: row.industry,
      marketCap: row.marketCap, isEtf: row.isEtf, isFund: row.isFund, isAdr: row.isAdr, country: row.country,
      exchange: row.exchange, isActivelyTrading: row.isActivelyTrading } : { symbol: s, missing: true, status });
    await new Promise((res) => setTimeout(res, 120));
  }
  console.log('PROFILES_JSON ' + JSON.stringify(out));
})();
"""


def tree_table():
    spec = importlib.util.spec_from_file_location("bst", os.path.join(ROOT, "scripts", "build-standard-tree.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m.IND, m.SECTOR_GICS


def fetch(symbols):
    rows = []
    for i in range(0, len(symbols), 26):
        js = FETCH_JS.replace("__SYMS__", ",".join(symbols[i:i + 26]))
        b64 = base64.b64encode(js.encode()).decode()
        cmd = ["fly", "ssh", "console", "-a", FLY_APP, "--machine", FLY_MACHINE, "-C",
               "node -e \"eval(Buffer.from('%s','base64').toString())\"" % b64]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=240)
        line = next((l for l in res.stdout.splitlines() if l.startswith("PROFILES_JSON ")), None)
        if not line:
            sys.exit("batch %d: no PROFILES_JSON line (exit %d)" % (i // 26, res.returncode))
        got = json.loads(line[len("PROFILES_JSON "):])
        if isinstance(got, dict):
            sys.exit("batch %d: %s" % (i // 26, got.get("error")))
        rows += got
        time.sleep(2)
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fetch", action="store_true")
    ap.add_argument("--raw", default=None)
    a = ap.parse_args()
    symbols = open(S1).read().strip().split(",")
    if a.fetch:
        raw = {"fetched_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"), "rows": fetch(symbols)}
    elif a.raw:
        raw = json.load(open(a.raw))
        if isinstance(raw, list):
            raw = {"fetched_utc": None, "rows": raw}
    else:
        prev = json.load(open(OUT))  # re-translate what was saved last time
        raw = {"fetched_utc": prev["provenance"]["fetched_utc"], "rows": [r["fmp"] for r in prev["names"].values()]}

    IND, SECTOR_GICS = tree_table()
    official = json.load(open(os.path.join(ROOT, "data", "reference", "sp500-gics.json")))["members"]
    by = {r["symbol"]: r for r in raw["rows"]}
    missing = [s for s in symbols if s not in by or by[s].get("missing") or not by[s].get("sector") or not by[s].get("industry")]
    if missing:
        sys.exit("FMP gave no sector / industry for: " + " ".join(missing) + " — never guessed; stop here")

    names, extra_used, moved, disagree = {}, {}, [], []
    for s in symbols:
        p = by[s]
        ind = p["industry"]
        if ind in IND:
            gsec, group, industry, table = *IND[ind], "tree"
        elif ind in IND_EXTRA:
            gsec, group, industry, table = *IND_EXTRA[ind], "extra"
            extra_used.setdefault(ind, []).append(s)
        else:
            sys.exit("no GICS translation for FMP industry %r (%s) — add it to IND_EXTRA, stated" % (ind, s))
        fmp_gsec = SECTOR_GICS.get(p["sector"])
        if fmp_gsec != gsec:
            moved.append({"ticker": s, "from_sector": fmp_gsec, "to_sector": gsec, "fmp_industry": ind, "gics_industry": industry})
        off = official.get(s)
        if off and off["gics_sector"] != gsec:
            disagree.append({"ticker": s, "translated": gsec, "sp_official": off["gics_sector"], "fmp_industry": ind})
        names[s] = {
            "ticker": s, "name": p.get("companyName"), "cap": p.get("marketCap"),
            "gics_sector": gsec, "gics_group": group, "gics_industry": industry, "translated_by": table,
            "gics_sector_official": off["gics_sector"] if off else None,
            "gics_sub_official": off["gics_sub_industry"] if off else None,
            "fmp": p,
        }
    out = {
        "artifact_kind": "SCINTILLA_MARKET_MAP_PROFILES_V3",
        "built_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "what": "Sector, industry and market cap for the 104 names admission v3 added on 29 Sep, read from FMP's company profile "
                "and translated to GICS with the standard tree's stated table. Read by scripts/build-market-map.mjs.",
        "provenance": {
            "symbols": "S1 admit list, _archive/admission-v3-20260928/S1-admit-candidates.txt (%d names)" % len(symbols),
            "profiles": "FMP /stable/profile, read inside Fly machine %s/%s (key from its env, never printed)" % (FLY_APP, FLY_MACHINE),
            "fetched_utc": raw.get("fetched_utc"),
            "translation": "IND and SECTOR_GICS in scripts/build-standard-tree.py (the 24 Sep tree's table), plus IND_EXTRA in this script",
            "official_check": "data/reference/sp500-gics.json (Wikipedia's S&P 500 component table), for members only",
        },
        "ind_extra_used": extra_used,
        "moved_by_gics": moved,
        "official_disagreements": disagree,
        "counts": {"names": len(names), "sp500_members": sum(1 for n in names.values() if n["gics_sector_official"]),
                   "official_agree": sum(1 for n in names.values() if n["gics_sector_official"] == n["gics_sector"]),
                   "translated_by_extra": sum(len(v) for v in extra_used.values())},
        "names": names,
    }
    with open(OUT, "w") as f:
        json.dump(out, f, indent=1)
        f.write("\n")
    print(OUT, json.dumps(out["counts"]), "moved", len(moved), "disagree", [d["ticker"] for d in disagree])


if __name__ == "__main__":
    main()

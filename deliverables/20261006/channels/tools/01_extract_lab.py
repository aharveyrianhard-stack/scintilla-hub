# CHN1 step 1 - read the Indicator Lab's retained geometry for SPY and QQQ. READ-ONLY on INDICATOR_LAB/: this script only opens
# files there for reading and writes its output beside itself, in ../data/. Nothing here is approved by Scintilla; the Lab owns it.
#
# What it takes:
#   * LB1's extract of the V24 packs (provider repo, branch provider/lb1-reviewed-lines-20261006) - the six B lines per index.
#   * The V24, V25, V30, V31, V33 and V34 IndexesMacro packs - to prove the B geometry did not change after LB1's extract
#     (V24 is what LB1 read; V34 is what the Lab's registry names as installed today).
#   * The Lab's saved 1W / 2W / 1D source bars for SPY and QQQ (dividend-adjusted, the basis the lines live on) - used for the
#     two source clocks (which week / which two-week bar a day belongs to) and to measure the dividend adjustment. NOT a price source.
import json, hashlib, subprocess, re, os, datetime as dt

HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "..", "data")
LAB = "/Users/alanharvey/SCINTILLA 0.5/INDICATOR_LAB/sprints/2026-10-03-lenses"
PROVIDER = "/Users/alanharvey/SCINTILLA-PROVIDERS/scintilla-provider-massive"
LB1_REF = "origin/provider/lb1-reviewed-lines-20261006"
LB1_PATH = "evidence/lb1-reviewed-lines-20261006/reviewed-lines-extract.json"
PACKS = {"V24": "display-cleanup-20261006/SCINTILLA_Reviewed_V24_PACK_IndexesMacro.pine",
         "V25": "daily-integration-20261006/SCINTILLA_Reviewed_V25_PACK_IndexesMacro.pine",
         "V30": "review-expansion-20261006/SCINTILLA_Reviewed_V30_PACK_IndexesMacro.pine",
         "V31": "review-expansion-20261006/v31-cleanup-candidate/SCINTILLA_Reviewed_V31_PACK_IndexesMacro.pine",
         "V33": "review-expansion-20261006/v33-orphan-brackets-20261007/SCINTILLA_Reviewed_V33_PACK_IndexesMacro.pine",
         "V34": "review-expansion-20261006/v34-pivot-anchors-20261007/SCINTILLA_Reviewed_V34_PACK_IndexesMacro.pine"}
NEWEST = "V34"   # the pack the Lab's CURRENT-INSTALLED-REGISTRY.json names as installed and saved (7 Oct 02:32 UTC)
REGISTRY = "review-expansion-20261006/v34-pivot-anchors-20261007/CURRENT-INSTALLED-REGISTRY.json"
EVID = {"SPY": {"1W": "SPY-V37-EVIDENCE-1W-1791229959971.json", "2W": "SPY-V37-EVIDENCE-2W-1791309582142.json", "1D": "SPY-V37-EVIDENCE-1D-1791309281959.json"},
        "QQQ": {"1W": "QQQ-V37-EVIDENCE-1W-1791229918248.json", "2W": "QQQ-V37-EVIDENCE-2W-1791309595392.json", "1D": "QQQ-V37-EVIDENCE-1D-1791309299452.json"}}

def sha(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()
def iso(ms):
    return dt.datetime.utcfromtimestamp(ms / 1000).strftime("%Y-%m-%dT%H:%M:%SZ")

# ---- LB1's extract -------------------------------------------------------------------------------------------------------
lb1_commit = subprocess.check_output(["git", "-C", PROVIDER, "rev-parse", LB1_REF], text=True).strip()
raw = subprocess.check_output(["git", "-C", PROVIDER, "show", f"{LB1_REF}:{LB1_PATH}"])
ext = json.loads(raw)
out = {"schema": "scintilla.chn1.lab-channels.v1",
       "authority": "Indicator Lab (ChatGPT/Codex) owns this geometry. READ-ONLY copy of the six retained B lines per index; nothing here is approved by Scintilla.",
       "read_at": dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
       "sources": {"lb1_extract": {"repo": "scintilla-provider-massive", "branch": "provider/lb1-reviewed-lines-20261006", "commit": lb1_commit,
                                   "file": LB1_PATH, "sha256": hashlib.sha256(raw).hexdigest(), "generated_at": ext["generated_at"]},
                   "packs": {}, "evidence": {}},
       "symbols": {}}

# ---- the packs: the B constants must be the same in V24 (LB1's source), V25 and V30 (newest on disk) ----------------------------
PAT = ["const float B_SLOPE=", "const int B_SOURCE_BAR=", "const int D_SOURCE_BAR=", "float w_nativeSlope=", "float f_nativeSlope=", "float w_baseUpper=",
       "float w_baseLower=", "float f_baseUpper=", "float f_baseLower=", "int w_sourceBarSpan=", "float w_elapsedCalendarHours=", "int f_sourceBarSpan=",
       "float f_elapsedCalendarHours=", "bool slope2wApproved=", "bool slope1wApproved=", "bool context2wSelected=", "bool context1wSelected="]
consts = {}
for v, rel in PACKS.items():
    p = os.path.join(LAB, rel); s = open(p).read(); got = {}
    for k in PAT:
        m = re.search(re.escape(k) + r"(.*)", s); got[k.rstrip("=")] = m.group(1).strip() if m else None
    consts[v] = got
    out["sources"]["packs"][v] = {"file": rel, "sha256": sha(p), "bytes": os.path.getsize(p)}
def pick(expr, sym):  # the packs write "…:qqq?<QQQ value>:<SPY value>" - SPY is the trailing default
    if sym == "QQQ":
        return float(re.search(r"qqq\?([-0-9.e]+)", expr).group(1))
    return float(expr.rsplit(":", 1)[1])
same = all(consts["V24"][k] == consts[v][k] for v in PACKS for k in consts["V24"])
out["sources"]["packs"]["b_geometry_identical_in_every_pack"] = same
out["sources"]["packs"]["packs_compared"] = list(PACKS)
reg = json.load(open(os.path.join(LAB, REGISTRY)))
mine = next((p for p in reg["packs"] if "IndexesMacro" in p["name"]), None)
out["sources"]["installed_registry"] = {"file": REGISTRY, "sha256": sha(os.path.join(LAB, REGISTRY)), "state": reg.get("state"), "at": reg.get("at"), "chart": reg.get("chartId"),
                                        "indexes_pack_name": mine and mine["name"], "indexes_pack_sha256": mine and mine["sha256"],
                                        "matches_the_pack_file_read_here": bool(mine) and mine["sha256"] == out["sources"]["packs"][NEWEST]["sha256"],
                                        "visually_approved_by_alan_as_recorded": reg.get("visuallyApprovedByAlan")}
out["sources"]["packs"]["approval_flags_as_written"] = {k: consts[NEWEST][k] for k in ("bool slope2wApproved", "bool slope1wApproved", "bool context2wSelected", "bool context1wSelected")}
B_SOURCE_BAR = int(consts[NEWEST]["const int B_SOURCE_BAR"]); D_SOURCE_BAR = int(consts[NEWEST]["const int D_SOURCE_BAR"])

# ---- per symbol: the two channels ------------------------------------------------------------------------------------------
for sym in ("SPY", "QQQ"):
    lines = {l["native_id"]: l for l in ext["lines"] if l["ticker"] == sym and l["provenance"]["role"].startswith("RETAINED B")}
    strip = {s["native_id"]: s for s in ext["slope_strip"] if s["ticker"] == sym}
    S = {"feed": ext["symbols"][sym]["feed"], "pack": ext["symbols"][sym]["pack"],
         "basis": "dividend-adjusted prices, the pack's sourceTicker = ticker.modify(…, session.extended, adjustment.dividends)",
         "approval_flags": ext["symbols"][sym]["approval_flags"], "channels": {}}
    for tf, pfx, snap in (("1W", "w", B_SOURCE_BAR), ("2W", "f", D_SOURCE_BAR)):
        up, mid, lo = lines[f"{tf} B2"], lines[f"{tf} B4"], lines[f"{tf} B6"]
        ident = up["provenance"]["native_identity"]
        m = re.search(r"anchor span (\d+) source bars · elapsed calendar hours (\d+) · Origin (\d+) Endpoint (\d+) · base upper ([0-9.]+) lower ([0-9.]+) at source-bar offset (\d+)", ident)
        span, hours, origin, endpoint, bu, bl, off = int(m[1]), int(m[2]), int(m[3]), int(m[4]), float(m[5]), float(m[6]), int(m[7])
        slope = up["slope"]["per_source_bar"]
        # cross-check the extract against the pack's own constants
        chk = {"slope_equals_pack": slope == pick(consts[NEWEST][f"float {pfx}_nativeSlope"], sym),
               "upper_equals_pack": bu == pick(consts[NEWEST][f"float {pfx}_baseUpper"], sym),
               "lower_equals_pack": bl == pick(consts[NEWEST][f"float {pfx}_baseLower"], sym),
               "span_equals_pack": span == int(pick(consts[NEWEST][f"int {pfx}_sourceBarSpan"], sym)),
               "hours_equals_pack": hours == int(pick(consts[NEWEST][f"float {pfx}_elapsedCalendarHours"], sym)),
               "mid_is_mean_of_rails": abs(mid["anchors"][1]["price"] - (bu + bl) / 2) < 1e-9,
               "rails_share_one_slope": up["slope"]["per_source_bar"] == mid["slope"]["per_source_bar"] == lo["slope"]["per_source_bar"]}
        S["channels"][f"{tf} B"] = {
            "source_timeframe": tf, "role": up["provenance"]["role"], "record_hash": up["provenance"]["record_hash"], "native_identity": ident,
            "model": up["slope"]["model"], "snapshot_bar_ms": snap, "snapshot_bar": iso(snap),
            "slope_per_source_bar": slope, "slope_unit": f"USD per {tf} source bar",
            "upper": {"id": f"{tf} B2", "at_snapshot": bu}, "mid": {"id": f"{tf} B4", "at_snapshot": mid["anchors"][1]["price"]}, "lower": {"id": f"{tf} B6", "at_snapshot": bl},
            "height_usd": bu - bl,
            "origin_ms": origin, "origin": iso(origin), "origin_price_upper": up["anchors"][0]["price"],
            "endpoint_ms": endpoint, "endpoint": iso(endpoint), "anchor_span_bars": span, "elapsed_calendar_hours": hours, "base_offset_bars": off,
            "slope_usd_per_7d": slope * span * 168 / hours,  # the pack's own slope-strip rule: nativeSlope × sourceBarSpan × 168 / elapsedCalendarHours
            "approval": {"retained_in_installed_pack": up["approval"]["retained_in_installed_pack"], "slope_strip": up["approval"]["slope_strip"],
                         "attention_range": up["approval"]["attention_range"], "strip_modes": {k: strip[k]["mode"] for k in (f"{tf} B2", f"{tf} B4", f"{tf} B6")}},
            "evidence": up.get("evidence"), "checks": chk}
    out["symbols"][sym] = S

# ---- the Lab's source bars: clocks + the dividend-adjusted weekly closes (basis check only) ---------------------------------
bars_out = {"schema": "scintilla.chn1.lab-source-bars.v1",
            "note": "The Lab's own saved source bars for BATS:SPY / BATS:QQQ, dividend-adjusted. Used for the 1W and 2W source clocks and to measure the dividend adjustment between the Lab's basis and the chart API's split-adjusted bars. Not used as a price source.",
            "symbols": {}}
for sym in ("SPY", "QQQ"):
    bars_out["symbols"][sym] = {}
    for tf, f in EVID[sym].items():
        p = os.path.join(LAB, f); d = json.load(open(p)); ch = d["capture"]["snapshot"]["charts"][0]
        assert ch["symbol"] == f"BATS:{sym}" and ch["timeframe"] == tf and ch["dividendsAdjustment"] is True, (sym, tf)
        rows = [[int(b["values"][0]) * 1000] + [float(x) for x in b["values"][1:5]] for b in ch["bars"]]
        out["sources"]["evidence"][f"{sym} {tf}"] = {"file": f, "sha256": sha(p), "captured_at": d["capture"]["snapshot"]["capturedAt"], "bars": len(rows),
                                                      "first_bar": iso(rows[0][0]), "last_bar": iso(rows[-1][0]), "session": ch["session"], "dividends_adjustment": ch["dividendsAdjustment"]}
        bars_out["symbols"][sym][tf] = {"columns": ["t_ms", "o", "h", "l", "c"], "rows": rows}
        if tf == "1D":
            # The Lab's own daily indicator values, saved in the same capture: its 200-day (first plot of its Clouds study) and its daily
            # RSI and Williams+100 (the D columns of "SCINTILLA RSI + Williams MTF REVIEW V2"). Plot titles are not stored in the capture,
            # so the columns are named here by position and PROVED in step 3 by matching our own numbers day for day.
            st = {x["name"]: x for x in ch["studies"]}
            clouds = next(v for k, v in st.items() if "Clouds Numeric Labels" in k); osc = next(v for k, v in st.items() if "RSI + Williams" in k)
            cr = {int(r["values"][0]) * 1000: r["values"] for r in clouds["plotRows"]}; orr = {int(r["values"][0]) * 1000: r["values"] for r in osc["plotRows"]}
            bars_out["symbols"][sym]["1D_lab_indicators"] = {
                "columns": ["t_ms", "sma200", "rsi_d", "williams_plus100_d"], "studies": {"sma200": clouds["name"], "oscillators": osc["name"]},
                "rows": [[t, cr.get(t, [None] * 2)[1], orr.get(t, [None] * 31)[30], orr.get(t, [None] * 31)[16]] for t in [x[0] for x in rows]]}

os.makedirs(DATA, exist_ok=True)
json.dump(out, open(os.path.join(DATA, "lab-channels.json"), "w"), indent=1)
json.dump(bars_out, open(os.path.join(DATA, "lab-source-bars.json"), "w"), separators=(",", ":"))
print("LB1 commit", lb1_commit, "| B geometry identical in", list(PACKS), ":", same, "| installed registry:", json.dumps(out["sources"]["installed_registry"]))
for sym, S in out["symbols"].items():
    for name, c in S["channels"].items():
        print(sym, name, "| slope", c["slope_per_source_bar"], "| upper", c["upper"]["at_snapshot"], "mid", c["mid"]["at_snapshot"], "lower", c["lower"]["at_snapshot"],
              "| origin", c["origin"][:10], "endpoint", c["endpoint"][:10], "| USD/7d", round(c["slope_usd_per_7d"], 6), "| checks ok:", all(c["checks"].values()))

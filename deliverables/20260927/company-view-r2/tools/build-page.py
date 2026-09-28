#!/usr/bin/env python3
"""Builds COMPANY-VIEW-R2.html from the measured files next to it (measurements.json, runs.json) and notes.json
(what each screenshot shows, written after looking at it). python3 tools/build-page.py"""
import json, pathlib, html, statistics
HERE = pathlib.Path(__file__).resolve().parent.parent
M = json.loads((HERE / "measurements.json").read_text())
RUNS = json.loads((HERE / "runs.json").read_text())
NOTES = json.loads((HERE / "notes.json").read_text())
E = html.escape

def med(xs):
    xs = [x for x in xs if x is not None]
    return statistics.median(xs) if xs else None
def s(ms): return "—" if ms is None else f"{ms/1000:.1f} s"

cl = M["clouds"]
def row(tgt):
    r = [x for x in cl if x["target"] == tgt]
    return r, med([x["priceMs"] for x in r]), med([x["cloudsMs"] for x in r]), med([x["rsiMs"] for x in r])
bR, bP, bC, bS = row("live"); aR, aP, aC, aS = row("local")
clouds_rows = "".join(f"<tr><td>{'before (live Hub + live Station)' if x['target']=='live' else 'after (both branches)'}</td><td>run {x['run']+1}</td>"
                      f"<td class=r>{s(x['priceMs'])}</td><td class=r>{s(x['cloudsMs'])}</td><td class=r>{s(x['rsiMs']) if x['target']=='local' else 'no RSI pane'}</td></tr>" for x in cl)
cpu = {(x["target"], x["case"]): x["cpuSPerMin"] for x in M["cpu"]}
def c(t, k): v = cpu.get((t, k)); return "—" if v is None else f"{v:.1f}"

def fig(name, cap, big=True):
    f = f"screens/{name}.jpg"
    if not (HERE / f).exists(): return f"<p class=small>missing: {E(f)}</p>"
    note = NOTES.get(name, "")
    return (f'<figure class="{"big" if big else "sm"}"><a href="{f}"><img src="{f}" alt="{E(cap)}" loading="lazy"></a>'
            f"<figcaption><b>{E(cap)}.</b> {E(note)}</figcaption></figure>")

pairs = [("MU", "1680", "collapsed"), ("MU", "1680", "expanded"), ("NVDA", "1440", "collapsed"), ("NVDA", "1440", "expanded"), ("SPY", "390", "collapsed"), ("SPY", "1680", "expanded")]
pair_html = "".join(f"<h3>{t} · {w} wide · {st}</h3><div class=pair>" + fig(f"before-{t}-{w}-{st}", f"Before · {t} · {w} · {st} · GEIGER tab") +
                    fig(f"after-{t}-{w}-{st}", f"After · {t} · {w} · {st} · GEIGER tab") + "</div>" for t, w, st in pairs)
gallery = ""
for tgt in ("before", "after"):
    for t in ("MU", "NVDA", "SPY"):
        for w in ("1680", "1440", "390"):
            for st in ("collapsed", "expanded"):
                gallery += fig(f"{tgt}-{t}-{w}-{st}", f"{tgt} · {t} · {w} · {st}", big=False)
tf = "".join(fig(f"after-NVDA-1680-tf-{r}", f"After · NVDA · expanded · {r}", big=False) for r in ("1h", "4h", "3D", "1W"))
tfk = RUNS.get("tfkeys", {})

page = (HERE / "tools" / "page-template.html").read_text()
for k, v in {"{{PAIRS}}": pair_html, "{{GALLERY}}": gallery, "{{TF}}": tf, "{{CLOUDS_ROWS}}": clouds_rows,
             "{{B_PRICE}}": s(bP), "{{B_CLOUDS}}": s(bC), "{{A_PRICE}}": s(aP), "{{A_CLOUDS}}": s(aC), "{{A_RSI}}": s(aS),
             "{{CPU_LD}}": c("live", "dashboard"), "{{CPU_AD}}": c("local", "dashboard"), "{{CPU_LM}}": c("live", "MU-pinned"),
             "{{CPU_AM}}": c("local", "MU-pinned"), "{{CPU_AE}}": c("local", "MU-expanded"),
             "{{TFKEYS}}": E(json.dumps(tfk, indent=1))}.items():
    page = page.replace(k, v)
(HERE / "COMPANY-VIEW-R2.html").write_text(page)
print("written", len(page))

#!/usr/bin/env python3
"""RV1 — one scenario, two targets. live = https://scintillahub.ai as deployed (before); local = the worktree's index.html
served as scintillahub.ai (after). Writes tools/job-scenarios-<target>.json; run: node tools/rv1-harness.mjs <job>."""
import json, pathlib, sys
D = pathlib.Path(__file__).resolve().parents[1]
ROOT = D.parents[2]
RV = '#boardScroll .sc-hcell[data-key="rv"]'
for target, tag in (("live", "before"), ("local", "after")):
    shot = lambda name: str(D / "shots" / f"{tag}-{name}.png")
    steps = [
        {"do": "load", "path": "/"}, {"do": "ready", "ms": 90000}, {"do": "wait", "ms": 4000},
        {"do": "read", "label": "0 · FAVORITES as opened (default sort: Geiger)"},
        # A — the return to LIVE after a rewind
        {"do": "click", "label": "A1 · click RVol", "sel": RV, "ms": 1500},
        {"do": "read", "label": "A1 · after one click on RVol"}, {"do": "shot", "label": "A1", "file": shot("A1-click-rvol")},
        {"do": "drag", "label": "A2 · drag the REWIND bar's thumb a little left of LIVE (a real drag)", "sel": "#gwxRng", "fx0": 0.995, "fx1": 0.93, "ms": 3000},
        {"do": "read", "label": "A2 · rewound (the replay ranks by the Geiger: by design, 24 Sep)"}, {"do": "shot", "label": "A2", "file": shot("A2-rewound")},
        {"do": "click", "label": "A3 · ↻ LIVE", "sel": "#gwxLiveFab", "ms": 2500},
        {"do": "read", "label": "A3 · back to LIVE, header still RVol ▼, no other click"}, {"do": "shot", "label": "A3", "file": shot("A3-back-to-live")},
        {"do": "watch", "label": "A4 · 50 s later (a 45 s pull), no click", "ms": 50000, "every": 5000},
        # B — a replay (▶ PLAY, the rewind's own clock), then Esc back to live. While rewound the board shows only the ticker
        #     and the Geiger bar (motion mode), so the RVol header cannot be clicked there: the order comes back on the return.
        {"do": "read", "label": "B0 · still sorted by RVol, before PLAY"},
        {"do": "click", "label": "B1 · ▶ PLAY the rewind", "sel": "#gwxPlay", "ms": 3000},
        {"do": "read", "label": "B1 · replay playing (ranked by the replayed Geiger: by design, 24 Sep)"}, {"do": "shot", "label": "B1", "file": shot("B1-replay-playing")},
        {"do": "eval", "label": "B1 · the RVol header while the replay plays", "js": "(() => { const h = document.querySelector('#boardScroll .sc-hcell[data-key=\"rv\"]'); return { playing: document.getElementById('gwxPlay').classList.contains('is-on'), asof: window.SC_ASOF ? window.SC_ASOF() : null, rvHeaderDisplay: h ? getComputedStyle(h).display : null, motion: document.body.classList.contains('gwx-motion') }; })()"},
        {"do": "key", "label": "B2 · Esc (back to live from the replay)", "key": "Escape", "ms": 2500},
        {"do": "read", "label": "B2 · back to LIVE from the replay, header still RVol ▼, no other click"}, {"do": "shot", "label": "B2", "file": shot("B2-esc-from-replay")},
    ]
    job = {"name": f"RV1 scenarios on {target} ({tag})", "target": target, "hubRoot": str(ROOT), "width": 1680, "height": 1050, "log": True,
           "out": str(D / "evidence" / f"scenarios-{target}.json"), "steps": steps}
    (D / "tools" / f"job-scenarios-{target}.json").write_text(json.dumps(job, indent=1))
    print("wrote", f"job-scenarios-{target}.json", len(steps), "steps")

Result of the slowness-and-glitch review of 2026-10-05 23:26 ET (manual run): **RED** — 7 red, 46 amber, across 21 screens.

**Worst five (screen · problem · number)**

1. Hub · board · things jump around on a slow phone · layout shift 0.91 in Lighthouse's slow-phone load (good is under 0.10) · last run 0.89
2. Allocation tool · things jump around while it loads · layout shift 0.50 (good is under 0.10) · last run 0.49
3. Hub · board · low Lighthouse speed score · 10 out of 100 on a phone (biggest paint at 12 s) · last run 10
4. Allocation tool · low Lighthouse speed score · 29 out of 100 on a phone (biggest paint at 8.4 s) · last run 30
5. Hub · social · heavy to download · 6.2 MB downloaded · last run 6.2 MB

**Every red**

- Hub · board · things jump around on a slow phone · layout shift 0.91 in Lighthouse's slow-phone load (good is under 0.10)
- Allocation tool · things jump around while it loads · layout shift 0.50 (good is under 0.10)
- Hub · board · low Lighthouse speed score · 10 out of 100 on a phone (biggest paint at 12 s)
- Allocation tool · low Lighthouse speed score · 29 out of 100 on a phone (biggest paint at 8.4 s)
- Hub · social · heavy to download · 6.2 MB downloaded
- Allocation tool (phone width) · things jump around while it loads · layout shift 0.31 (good is under 0.10)
- Allocation tool · things jump around on a slow phone · layout shift 0.29 in Lighthouse's slow-phone load (good is under 0.10)

Run: https://github.com/aharveyrianhard-stack/scintilla-hub/actions/runs/37408912338
This review only measures and ranks; it fixes nothing. Switch it off: Actions → “Glitch review” → ⋯ → Disable workflow.

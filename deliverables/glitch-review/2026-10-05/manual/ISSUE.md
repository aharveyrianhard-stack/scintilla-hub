Result of the slowness-and-glitch review of 2026-10-05 23:15 ET (manual run): **RED** — 8 red, 46 amber, across 21 screens.

**Worst five (screen · problem · number)**

1. Hub · board · things jump around on a slow phone · layout shift 0.89 in Lighthouse's slow-phone load (good is under 0.10) · last run 0.91
2. Allocation tool · things jump around while it loads · layout shift 0.49 (good is under 0.10) · last run 0.86
3. Hub · board · low Lighthouse speed score · 10 out of 100 on a phone (biggest paint at 11 s) · last run 17
4. Allocation tool · low Lighthouse speed score · 30 out of 100 on a phone (biggest paint at 8.8 s) · last run 43
5. Hub · usual day · things jump around while it loads · layout shift 0.33 (good is under 0.10) · last run 0.02

**Every red**

- Hub · board · things jump around on a slow phone · layout shift 0.89 in Lighthouse's slow-phone load (good is under 0.10)
- Allocation tool · things jump around while it loads · layout shift 0.49 (good is under 0.10)
- Hub · board · low Lighthouse speed score · 10 out of 100 on a phone (biggest paint at 11 s)
- Allocation tool · low Lighthouse speed score · 30 out of 100 on a phone (biggest paint at 8.8 s)
- Hub · usual day · things jump around while it loads · layout shift 0.33 (good is under 0.10)
- Hub · social · heavy to download · 6.2 MB downloaded
- Allocation tool (phone width) · things jump around while it loads · layout shift 0.31 (good is under 0.10)
- Allocation tool · things jump around on a slow phone · layout shift 0.29 in Lighthouse's slow-phone load (good is under 0.10)

Run: https://github.com/aharveyrianhard-stack/scintilla-hub/actions/runs/37408021707
This review only measures and ranks; it fixes nothing. Switch it off: Actions → “Glitch review” → ⋯ → Disable workflow.

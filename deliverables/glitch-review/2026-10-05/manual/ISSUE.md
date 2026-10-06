Result of the slowness-and-glitch review of 2026-10-05 21:54 ET (manual run): **RED** — 7 red, 30 amber, across 21 screens.

**Worst five (screen · problem · number)**

1. Hub · board · things jump around on a slow phone · layout shift 0.91 in Lighthouse's slow-phone load (good is under 0.10) · last run 0.91
2. Allocation tool · things jump around while it loads · layout shift 0.86 (good is under 0.10) · last run 0.86
3. Hub · board · low Lighthouse speed score · 17 out of 100 on a phone (biggest paint at 11 s) · last run 10
4. Hub · social · heavy to download · 6.1 MB downloaded · last run 6.1 MB
5. Allocation tool · things jump around on a slow phone · layout shift 0.30 in Lighthouse's slow-phone load (good is under 0.10) · last run 0.30

**Every red**

- Hub · board · things jump around on a slow phone · layout shift 0.91 in Lighthouse's slow-phone load (good is under 0.10)
- Allocation tool · things jump around while it loads · layout shift 0.86 (good is under 0.10)
- Hub · board · low Lighthouse speed score · 17 out of 100 on a phone (biggest paint at 11 s)
- Allocation tool (phone width) · things jump around while it loads · layout shift 0.36 (good is under 0.10)
- Hub · social · heavy to download · 6.1 MB downloaded
- Allocation tool · things jump around on a slow phone · layout shift 0.30 in Lighthouse's slow-phone load (good is under 0.10)
- Allocation tool · low Lighthouse speed score · 43 out of 100 on a phone (biggest paint at 8.4 s)

Run: https://github.com/aharveyrianhard-stack/scintilla-hub/actions/runs/37401372993
This review only measures and ranks; it fixes nothing. Switch it off: Actions → “Glitch review” → ⋯ → Disable workflow.

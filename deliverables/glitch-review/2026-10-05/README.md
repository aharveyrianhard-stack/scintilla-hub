# Slowness and glitch review — 2026-10-05 23:15 ET (manual run)

**RED — 8 red · 46 amber** across 21 screens · GitHub Actions (cloud) run 37408021707 · [the run](https://github.com/aharveyrianhard-stack/scintilla-hub/actions/runs/37408021707) · compared with 2026-10-05 21:54 ET

It measures and ranks; it fixes nothing. What each number means and when it is listed: PAGE SPECS at the foot of `index.html` (same folder).

## Worst five

1. Hub · board · things jump around on a slow phone · layout shift 0.89 in Lighthouse's slow-phone load (good is under 0.10) · last run 0.91
2. Allocation tool · things jump around while it loads · layout shift 0.49 (good is under 0.10) · last run 0.86
3. Hub · board · low Lighthouse speed score · 10 out of 100 on a phone (biggest paint at 11 s) · last run 17
4. Allocation tool · low Lighthouse speed score · 30 out of 100 on a phone (biggest paint at 8.8 s) · last run 43
5. Hub · usual day · things jump around while it loads · layout shift 0.33 (good is under 0.10) · last run 0.02

## The numbers

| screen | result | first numbers | weight | layout shift | longest freeze | log errors | failed calls | dashes | blank boxes | old labels | picture changed | Lighthouse speed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Hub · board | RED | 1.0 s | 2.4 MB | 0.07 | 0.3 s | 0 | 0 | 5 | 0 | 1 | 0 % | 10 |
| Hub · news | amber | 0.8 s | 326 KB | 0.02 | 0.3 s | 0 | 0 | 0 | 0 | 0 | 8 % | · |
| Hub · social | RED | 0.8 s | 6.2 MB | 0.02 | 0.3 s | 0 | 0 | 0 | 0 | 1 | 32 % | · |
| Hub · sentiment | amber | 4.0 s | 4.8 MB | 0.02 | 0.9 s | 2 | 2 | 0 | 0 | 0 | 2 % | · |
| Hub · alerts | amber | never | 927 KB | 0.02 | 0.3 s | 0 | 0 | 0 | 0 | 0 | 0 % | · |
| Hub · screener | amber | never | 924 KB | 0.02 | 0.3 s | 0 | 0 | 0 | 0 | 0 | 0 % | · |
| Hub · earnings | amber | 0.7 s | 759 KB | 0.02 | 0.3 s | 0 | 0 | 3 | 0 | 0 | 0 % | · |
| Hub · usual day | RED | 1.5 s | 466 KB | 0.33 | 0.3 s | 0 | 0 | 0 | 0 | 0 | 0 % | · |
| Hub · economic | amber | 0.5 s | 271 KB | 0.02 | 0.3 s | 0 | 0 | 17 | 0 | 0 | 1 % | · |
| Hub · company view NVDA | amber | 0.5 s | 975 KB | 0.05 | 0.3 s | 0 | 0 | 5 | 0 | 0 | 0 % | · |
| Hub · company view BRK-B | amber | 0.6 s | 961 KB | 0.06 | 0.3 s | 0 | 0 | 5 | 0 | 0 | 0 % | · |
| Hub · company view BTCUSD | amber | 0.6 s | 696 KB | 0.05 | 0.3 s | 2 | 2 | 5 | 0 | 3 | 0 % | · |
| Station · deck | amber | 0.7 s | 2.6 MB | 0.04 | 0.1 s | 0 | 0 | 0 | 0 | 1 | 12 % | 93 |
| Station · chart | ok | 0.6 s | 190 KB | 0.00 | 0.0 s | 0 | 0 | 0 | 0 | 0 | 0 % | 96 |
| Allocation tool | RED | 8.2 s | 943 KB | 0.49 | 0.5 s | 1 | 1 | 0 | 0 | 4 | 7 % | 30 |
| Tree preview | ok | 1.3 s | 750 KB | 0.02 | 0.2 s | 0 | 0 | 0 | 0 | 0 | 0 % | 96 |
| Hub · board (phone width) | amber | 0.4 s | 2.5 MB | 0.02 | 0.3 s | 0 | 0 | 0 | 0 | 0 | 0 % | · |
| Station · deck (phone width) | amber | 0.8 s | 2.5 MB | 0.00 | 0.1 s | 0 | 0 | 0 | 0 | 1 | 0 % | · |
| Station · chart (phone width) | ok | 0.6 s | 190 KB | 0.00 | 0.0 s | 0 | 0 | 0 | 0 | 0 | 0 % | · |
| Allocation tool (phone width) | RED | 6.1 s | 945 KB | 0.31 | 0.5 s | 1 | 1 | 0 | 0 | 4 | 5 % | · |
| Tree preview (phone width) | ok | 0.6 s | 324 KB | 0.03 | 0.0 s | 0 | 0 | 0 | 0 | 0 | 0 % | · |

## The full ranked list (54)

1. **RED** Hub · board · things jump around on a slow phone · layout shift 0.89 in Lighthouse's slow-phone load (good is under 0.10) · last run 0.91
2. **RED** Allocation tool · things jump around while it loads · layout shift 0.49 (good is under 0.10) · last run 0.86
3. **RED** Hub · board · low Lighthouse speed score · 10 out of 100 on a phone (biggest paint at 11 s) · last run 17
4. **RED** Allocation tool · low Lighthouse speed score · 30 out of 100 on a phone (biggest paint at 8.8 s) · last run 43
5. **RED** Hub · usual day · things jump around while it loads · layout shift 0.33 (good is under 0.10) · last run 0.02
6. **RED** Hub · social · heavy to download · 6.2 MB downloaded · last run 6.1 MB
7. **RED** Allocation tool (phone width) · things jump around while it loads · layout shift 0.31 (good is under 0.10) · last run 0.36
8. **RED** Allocation tool · things jump around on a slow phone · layout shift 0.29 in Lighthouse's slow-phone load (good is under 0.10) · last run 0.30
9. amber Hub · sentiment · heavy to download · 4.8 MB downloaded · last run 4.8 MB
10. amber Hub · sentiment · the screen freezes · longest freeze 0.9 s (10 stalls, 2.3 s frozen in all) · last run 0.5 s
11. amber Allocation tool · slow to show its numbers · 8.2 s until the first numbers appeared · last run 6.6 s
12. amber Allocation tool · old, stale or fallback data on show · 4 labels (oldest 3 days) — e.g. “market_breadth · FALLBACK” · last run 4
13. amber Allocation tool (phone width) · old, stale or fallback data on show · 4 labels (oldest 3 days) — e.g. “market_breadth · FALLBACK” · last run 4
14. amber Allocation tool (phone width) · slow to show its numbers · 6.1 s until the first numbers appeared · last run 5.1 s
15. amber Hub · company view BTCUSD · old, stale or fallback data on show · 3 labels — e.g. “unavailable” · last run 3
16. amber Allocation tool · the screen freezes · longest freeze 0.5 s (1 stall, 0.5 s frozen in all) · last run 0.1 s
17. amber Allocation tool (phone width) · the screen freezes · longest freeze 0.5 s (1 stall, 0.5 s frozen in all) · last run 0.1 s
18. amber Station · deck · heavy to download · 2.6 MB downloaded · last run 2.6 MB
19. amber Hub · social · the picture changed a lot since the last run · 32 % of the screen looks different · last run 0 %
20. amber Station · deck (phone width) · heavy to download · 2.5 MB downloaded · last run 2.5 MB
21. amber Hub · board (phone width) · heavy to download · 2.5 MB downloaded · last run 2.5 MB
22. amber Hub · board · heavy to download · 2.4 MB downloaded · last run 2.5 MB
23. amber Hub · economic · dashes where numbers should be · 17 empty readouts (“—”) on screen · last run 17
24. amber Hub · sentiment · slow to show its numbers · 4.0 s until the first numbers appeared · last run 2.2 s
25. amber Hub · screener · the screen freezes · longest freeze 0.3 s (4 stalls, 0.5 s frozen in all) · last run 0.2 s
26. amber Hub · company view BRK-B · the screen freezes · longest freeze 0.3 s (7 stalls, 0.5 s frozen in all) · last run 0.2 s
27. amber Hub · board (phone width) · the screen freezes · longest freeze 0.3 s (7 stalls, 0.9 s frozen in all) · last run 0.2 s
28. amber Hub · alerts · the screen freezes · longest freeze 0.3 s (4 stalls, 0.5 s frozen in all) · last run 0.2 s
29. amber Hub · earnings · the screen freezes · longest freeze 0.3 s (10 stalls, 0.5 s frozen in all) · last run 0.2 s
30. amber Hub · company view BTCUSD · the screen freezes · longest freeze 0.3 s (4 stalls, 0.4 s frozen in all) · last run 0.2 s
31. amber Hub · social · the screen freezes · longest freeze 0.3 s (9 stalls, 0.6 s frozen in all) · last run 0.2 s
32. amber Hub · board · the screen freezes · longest freeze 0.3 s (7 stalls, 0.9 s frozen in all) · last run 0.2 s
33. amber Hub · company view NVDA · the screen freezes · longest freeze 0.3 s (7 stalls, 0.5 s frozen in all) · last run 0.2 s
34. amber Hub · usual day · the screen freezes · longest freeze 0.3 s (8 stalls, 0.5 s frozen in all) · last run 0.2 s
35. amber Hub · news · the screen freezes · longest freeze 0.3 s (4 stalls, 0.4 s frozen in all) · last run 0.2 s
36. amber Hub · economic · the screen freezes · longest freeze 0.3 s (6 stalls, 0.8 s frozen in all) · last run 0.2 s
37. amber Hub · board · old, stale or fallback data on show · 1 label — e.g. “equities · MASSIVE · market closed · 500 sta” · last run 1
38. amber Hub · social · old, stale or fallback data on show · 1 label — e.g. “· 185 channel feeds not answering” · last run 0
39. amber Hub · sentiment · data calls that failed · 2 failed calls (most often: 400 scintilla-massive-chart-api.fly.dev/quotes) · last run 2
40. amber Hub · alerts · the room is parked — it shows no data · a notice instead of numbers
41. amber Hub · screener · the room is parked — it shows no data · a notice instead of numbers
42. amber Hub · company view BTCUSD · data calls that failed · 2 failed calls (most often: 404 scintilla-massive-chart-api.fly.dev/candles) · last run 2
43. amber Station · deck · old, stale or fallback data on show · 1 label — e.g. “X source is offline” · last run 1
44. amber Station · deck (phone width) · old, stale or fallback data on show · 1 label — e.g. “X source is offline” · last run 1
45. amber Hub · board · dashes where numbers should be · 5 empty readouts (“—”) on screen · last run 5
46. amber Hub · company view NVDA · dashes where numbers should be · 5 empty readouts (“—”) on screen · last run 5
47. amber Hub · company view BRK-B · dashes where numbers should be · 5 empty readouts (“—”) on screen · last run 5
48. amber Hub · company view BTCUSD · dashes where numbers should be · 5 empty readouts (“—”) on screen · last run 5
49. amber Allocation tool · data calls that failed · 1 failed call (most often: 404 wadinxqplrggagkvrdag.supabase.co/rest/v1/market_breadth) · last run 1
50. amber Allocation tool (phone width) · data calls that failed · 1 failed call (most often: 404 wadinxqplrggagkvrdag.supabase.co/rest/v1/market_breadth) · last run 1
51. amber Hub · sentiment · errors in the browser's log · 2 errors · last run 2
52. amber Hub · company view BTCUSD · errors in the browser's log · 2 errors · last run 2
53. amber Allocation tool · errors in the browser's log · 1 error · last run 1
54. amber Allocation tool (phone width) · errors in the browser's log · 1 error · last run 1

## Every screen, as the review saw it

### Hub · board — RED

![Hub · board](shots/hub-dashboard.jpg)

- **RED** things jump around on a slow phone — layout shift 0.89 in Lighthouse's slow-phone load (good is under 0.10) (last run 0.91)
- **RED** low Lighthouse speed score — 10 out of 100 on a phone (biggest paint at 11 s) (last run 17)
- amber heavy to download — 2.4 MB downloaded (last run 2.5 MB)
- amber the screen freezes — longest freeze 0.3 s (7 stalls, 0.9 s frozen in all) (last run 0.2 s)
- amber old, stale or fallback data on show — 1 label — e.g. “equities · MASSIVE · market closed · 500 sta” (last run 1)
- amber dashes where numbers should be — 5 empty readouts (“—”) on screen (last run 5)
- what moved since the last run: 0.2 % of the screen — [the difference picture](shots/hub-dashboard.moved.png)

### Hub · news — amber

![Hub · news](shots/hub-news.jpg)

- amber the screen freezes — longest freeze 0.3 s (4 stalls, 0.4 s frozen in all) (last run 0.2 s)
- what moved since the last run: 7.9 % of the screen — [the difference picture](shots/hub-news.moved.png)

### Hub · social — RED

![Hub · social](shots/hub-social.jpg)

- **RED** heavy to download — 6.2 MB downloaded (last run 6.1 MB)
- amber the picture changed a lot since the last run — 32 % of the screen looks different (last run 0 %)
- amber the screen freezes — longest freeze 0.3 s (9 stalls, 0.6 s frozen in all) (last run 0.2 s)
- amber old, stale or fallback data on show — 1 label — e.g. “· 185 channel feeds not answering” (last run 0)
- what moved since the last run: 32.1 % of the screen — [the difference picture](shots/hub-social.moved.png)

### Hub · sentiment — amber

![Hub · sentiment](shots/hub-sentiment.jpg)

- amber heavy to download — 4.8 MB downloaded (last run 4.8 MB)
- amber the screen freezes — longest freeze 0.9 s (10 stalls, 2.3 s frozen in all) (last run 0.5 s)
- amber slow to show its numbers — 4.0 s until the first numbers appeared (last run 2.2 s)
- amber data calls that failed — 2 failed calls (most often: 400 scintilla-massive-chart-api.fly.dev/quotes) (last run 2)
- amber errors in the browser's log — 2 errors (last run 2)
- what moved since the last run: 2.2 % of the screen — [the difference picture](shots/hub-sentiment.moved.png)

### Hub · alerts — amber

![Hub · alerts](shots/hub-alerts.jpg)

- amber the screen freezes — longest freeze 0.3 s (4 stalls, 0.5 s frozen in all) (last run 0.2 s)
- amber the room is parked — it shows no data — a notice instead of numbers
- what moved since the last run: 0.0 % of the screen — [the difference picture](shots/hub-alerts.moved.png)

### Hub · screener — amber

![Hub · screener](shots/hub-screener.jpg)

- amber the screen freezes — longest freeze 0.3 s (4 stalls, 0.5 s frozen in all) (last run 0.2 s)
- amber the room is parked — it shows no data — a notice instead of numbers
- what moved since the last run: 0.0 % of the screen — [the difference picture](shots/hub-screener.moved.png)

### Hub · earnings — amber

![Hub · earnings](shots/hub-events.jpg)

- amber the screen freezes — longest freeze 0.3 s (10 stalls, 0.5 s frozen in all) (last run 0.2 s)
- what moved since the last run: 0.0 % of the screen — [the difference picture](shots/hub-events.moved.png)

### Hub · usual day — RED

![Hub · usual day](shots/hub-usual.jpg)

- **RED** things jump around while it loads — layout shift 0.33 (good is under 0.10) (last run 0.02)
- amber the screen freezes — longest freeze 0.3 s (8 stalls, 0.5 s frozen in all) (last run 0.2 s)
- what moved since the last run: 0.0 % of the screen — [the difference picture](shots/hub-usual.moved.png)

### Hub · economic — amber

![Hub · economic](shots/hub-economic.jpg)

- amber dashes where numbers should be — 17 empty readouts (“—”) on screen (last run 17)
- amber the screen freezes — longest freeze 0.3 s (6 stalls, 0.8 s frozen in all) (last run 0.2 s)
- what moved since the last run: 0.7 % of the screen — [the difference picture](shots/hub-economic.moved.png)

### Hub · company view NVDA — amber

![Hub · company view NVDA](shots/hub-company-nvda.jpg)

- amber the screen freezes — longest freeze 0.3 s (7 stalls, 0.5 s frozen in all) (last run 0.2 s)
- amber dashes where numbers should be — 5 empty readouts (“—”) on screen (last run 5)
- what moved since the last run: 0.2 % of the screen — [the difference picture](shots/hub-company-nvda.moved.png)

### Hub · company view BRK-B — amber

![Hub · company view BRK-B](shots/hub-company-brk-b.jpg)

- amber the screen freezes — longest freeze 0.3 s (7 stalls, 0.5 s frozen in all) (last run 0.2 s)
- amber dashes where numbers should be — 5 empty readouts (“—”) on screen (last run 5)
- what moved since the last run: 0.2 % of the screen — [the difference picture](shots/hub-company-brk-b.moved.png)

### Hub · company view BTCUSD — amber

![Hub · company view BTCUSD](shots/hub-company-btcusd.jpg)

- amber old, stale or fallback data on show — 3 labels — e.g. “unavailable” (last run 3)
- amber the screen freezes — longest freeze 0.3 s (4 stalls, 0.4 s frozen in all) (last run 0.2 s)
- amber data calls that failed — 2 failed calls (most often: 404 scintilla-massive-chart-api.fly.dev/candles) (last run 2)
- amber dashes where numbers should be — 5 empty readouts (“—”) on screen (last run 5)
- amber errors in the browser's log — 2 errors (last run 2)
- what moved since the last run: 0.3 % of the screen — [the difference picture](shots/hub-company-btcusd.moved.png)

### Station · deck — amber

![Station · deck](shots/station-deck.jpg)

- amber heavy to download — 2.6 MB downloaded (last run 2.6 MB)
- amber old, stale or fallback data on show — 1 label — e.g. “X source is offline” (last run 1)
- what moved since the last run: 11.8 % of the screen — [the difference picture](shots/station-deck.moved.png)

### Station · chart — ok

![Station · chart](shots/station-chart.jpg)

- nothing past its limit
- what moved since the last run: 0.0 % of the screen — [the difference picture](shots/station-chart.moved.png)

### Allocation tool — RED

![Allocation tool](shots/allocation.jpg)

- **RED** things jump around while it loads — layout shift 0.49 (good is under 0.10) (last run 0.86)
- **RED** low Lighthouse speed score — 30 out of 100 on a phone (biggest paint at 8.8 s) (last run 43)
- **RED** things jump around on a slow phone — layout shift 0.29 in Lighthouse's slow-phone load (good is under 0.10) (last run 0.30)
- amber slow to show its numbers — 8.2 s until the first numbers appeared (last run 6.6 s)
- amber old, stale or fallback data on show — 4 labels (oldest 3 days) — e.g. “market_breadth · FALLBACK” (last run 4)
- amber the screen freezes — longest freeze 0.5 s (1 stall, 0.5 s frozen in all) (last run 0.1 s)
- amber data calls that failed — 1 failed call (most often: 404 wadinxqplrggagkvrdag.supabase.co/rest/v1/market_breadth) (last run 1)
- amber errors in the browser's log — 1 error (last run 1)
- what moved since the last run: 7.2 % of the screen — [the difference picture](shots/allocation.moved.png)

### Tree preview — ok

![Tree preview](shots/tree.jpg)

- nothing past its limit
- what moved since the last run: 0.0 % of the screen — [the difference picture](shots/tree.moved.png)

### Hub · board (phone width) — amber

![Hub · board (phone width)](shots/hub-dashboard-phone.jpg)

- amber heavy to download — 2.5 MB downloaded (last run 2.5 MB)
- amber the screen freezes — longest freeze 0.3 s (7 stalls, 0.9 s frozen in all) (last run 0.2 s)
- what moved since the last run: 0.0 % of the screen — [the difference picture](shots/hub-dashboard-phone.moved.png)

### Station · deck (phone width) — amber

![Station · deck (phone width)](shots/station-deck-phone.jpg)

- amber heavy to download — 2.5 MB downloaded (last run 2.5 MB)
- amber old, stale or fallback data on show — 1 label — e.g. “X source is offline” (last run 1)
- what moved since the last run: 0.0 % of the screen — [the difference picture](shots/station-deck-phone.moved.png)

### Station · chart (phone width) — ok

![Station · chart (phone width)](shots/station-chart-phone.jpg)

- nothing past its limit
- what moved since the last run: 0.0 % of the screen — [the difference picture](shots/station-chart-phone.moved.png)

### Allocation tool (phone width) — RED

![Allocation tool (phone width)](shots/allocation-phone.jpg)

- **RED** things jump around while it loads — layout shift 0.31 (good is under 0.10) (last run 0.36)
- amber old, stale or fallback data on show — 4 labels (oldest 3 days) — e.g. “market_breadth · FALLBACK” (last run 4)
- amber slow to show its numbers — 6.1 s until the first numbers appeared (last run 5.1 s)
- amber the screen freezes — longest freeze 0.5 s (1 stall, 0.5 s frozen in all) (last run 0.1 s)
- amber data calls that failed — 1 failed call (most often: 404 wadinxqplrggagkvrdag.supabase.co/rest/v1/market_breadth) (last run 1)
- amber errors in the browser's log — 1 error (last run 1)
- what moved since the last run: 5.3 % of the screen — [the difference picture](shots/allocation-phone.moved.png)

### Tree preview (phone width) — ok

![Tree preview (phone width)](shots/tree-phone.jpg)

- nothing past its limit
- what moved since the last run: 0.0 % of the screen — [the difference picture](shots/tree-phone.moved.png)

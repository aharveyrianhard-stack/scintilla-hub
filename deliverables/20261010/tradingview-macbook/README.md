# TradingView on the MacBook — two small helpers (10 Oct 2026)

Versioned mirror. The copies that actually run live in the Scintilla workspace:
`/Users/alanharvey/AlanOS/Operating System/workspaces/scintilla/staging/channels/` (with the data files, which are not kept here).

## 1. Long-term rails painted over the capture layout
- **What it is:** Alan's approved long-term channel rails (two-week timeframe), painted as cyan lines over both charts of the
  TradingView layout "CAPTURE · Favorites", with each rail's value today and where price sits inside the channel.
- **Why painted and not an indicator or a drawing:** the Indicator Lab's Play box refuses to attach when any extra indicator is on
  that layout (it compares the exact list), and the layout has "hide drawings" switched on. A painted canvas is neither, so nothing
  is stored in TradingView and nothing in the Lab's tools changes.
- **Parts:** `rails-overlay.js` (the painter, runs inside the page) · `rails-overlay-keeper.mjs` (re-paints after a reload or when
  the rails file changes) · `LT-RAILS.json` (the rails; written by `build-room.py` from the approvals and the chart reads) ·
  `tvharvest.mjs` + `relabel.py` (read the rails off the Lab's channel study) · `railscheck.mjs` (visit every name and compare).
- **Runs as:** LaunchAgent `com.scintilla.lt-rails-overlay` (always on). Log: `~/Library/Logs/scintilla-lt-rails-overlay.log`.
- **Stop:** `launchctl bootout gui/$(id -u)/com.scintilla.lt-rails-overlay` then reload the layout (the lines are gone).

## 2. Daily in-place refresh of TradingView
- **What it is:** once a day, after ten quiet minutes, every TradingView layout on the MacBook is reloaded where it stands.
- **Why not close-and-reopen like the iMac:** here TradingView has several windows across desktops and the extended screen; a
  restart would bring them back on one desktop. Measured 10 Oct 2026: 5.82 GB -> 3.20 GB, all layouts back on the same charts.
- **Leaves a layout alone when:** unsaved changes, a rotation playing, the capture box open, a dialog or the code editor showing.
- **Runs as:** LaunchAgent `com.scintilla.tv-refresh` (04:15, 05:15, 06:15, 07:15, 12:45, 16:45, 20:45; first quiet one wins).
  Log: `~/Library/Logs/scintilla-tv-refresh.log`. Last result: `~/Library/Application Support/Scintilla/tv-refresh/LAST.txt`.
- **Stop:** `launchctl bootout gui/$(id -u)/com.scintilla.tv-refresh`.

## Things learned the hard way
- The Lab's Play box also refuses while the code editor panel is open in that tab: minimise it (`TradingView.bottomWidgetBar.close()`).
- Drawings on this account are shared across every layout unless created as "shared in layout"; the capture layout hides drawings anyway.
- Futures and yields open on Sunday evening: an anchor time must land inside its two-week bar, so compare against the bars' own times.

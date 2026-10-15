// brave-tabs.js - Brave's own windows and tabs, asked of Brave itself (Apple events). Needs the Automation consent "Scintilla Night
// Reload may control Brave Browser" - ONE click of Alan's, asked for by "gui.applescript ask-consent". gui.applescript runs this only
// after consent.js said "allowed", so it can never make macOS ask by itself.
//   osascript -l JavaScript brave-tabs.js <bundle id> list                      one line per window, front window first:
//                                                                              window <tab> <n> <tab> <active tab number, 1-based>
//                                                                              then one line per tab:  tab <tab> <n> <tab> <url>
//   osascript -l JavaScript brave-tabs.js <bundle id> active <window n> <tab n>    makes that tab the active one;  ok | error:...
// Web-app windows (the Station, X) are not in Brave's own window list; this only ever sees his ordinary windows.
function run(argv) {
  const bid = argv[0], verb = argv[1] || "list";
  if (!bid) return "error:no app named";
  const app = Application(bid);
  if (verb === "list") {
    const out = []; const ws = app.windows();
    for (let i = 0; i < ws.length; i++) {
      const w = ws[i]; let tabs = [];
      try { tabs = w.tabs(); } catch (e) { continue; }
      let active = 1; try { active = w.activeTabIndex(); } catch (e) {}
      out.push("window\t" + (i + 1) + "\t" + active);
      for (const t of tabs) { let u = ""; try { u = t.url(); } catch (e) {} out.push("tab\t" + (i + 1) + "\t" + u); }
    }
    return out.join("\n");
  }
  if (verb === "active") {
    const n = Number(argv[2]), k = Number(argv[3]);
    if (!(n >= 1 && k >= 1)) return "error:window and tab numbers needed";
    try { app.windows[n - 1].activeTabIndex = k; return "ok"; } catch (e) { return "error:" + e; }
  }
  return "error:unknown verb";
}

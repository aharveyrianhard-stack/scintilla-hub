// windows.js - what the WINDOW SERVER knows about one app's windows, on EVERY desktop. Read only; needs no permission.
//   osascript -l JavaScript windows.js <pid> [<pid> ...]
// One line per ordinary window:  on|off <tab> full|normal|strip <tab> <width>x<height>
//   on/off   = shown on the desktop in front now (a window on another desktop, minimised, or in native full screen on its own desktop is "off")
//   full     = its frame covers a whole screen: that is a window in macOS native full screen (which lives on a desktop of its own)
//   strip    = 16 Oct 2026: a window of thumbnail size (both sides 240 or less). With Stage Manager on, a window set aside in the strip at the
//              side of the desktop is reported by the window server as the app's own window, "on" screen, about 123 x 155 (TradingView's,
//              read on the iMac 16 Oct; X's was 124 x 134 on 15 Oct). It is on this desktop but not on the stage, so no key can reach it
//              and Accessibility does not list it: activating the app brings it onto the stage. Never trust the size alone as "reachable".
// Nothing else: window names need the screen-recording permission and are never asked for.
// 15 Oct 2026: Accessibility (the "windows" verb of gui.applescript) lists only the windows on the desktop in front, so a window in
// native full screen or on another desktop read as "0 windows" even while the Station was the app in front.
ObjC.import("CoreGraphics");
ObjC.import("AppKit");
function run(argv) {
  const pids = argv.map(Number).filter((n) => n > 0);
  if (!pids.length) return "error:no pid";
  const screens = [];
  const sc = $.NSScreen.screens; const ns = sc.count;
  for (let i = 0; i < ns; i++) { const f = sc.objectAtIndex(i).frame; screens.push({ w: Math.round(f.size.width), h: Math.round(f.size.height) }); }
  const arr = ObjC.castRefToObject($.CGWindowListCopyWindowInfo(0 /* kCGWindowListOptionAll */, 0 /* kCGNullWindowID */));
  const n = arr.count; const out = [];
  for (let i = 0; i < n; i++) {
    const d = ObjC.deepUnwrap(arr.objectAtIndex(i));
    if (d.kCGWindowLayer !== 0 || !pids.includes(d.kCGWindowOwnerPID)) continue;
    const b = d.kCGWindowBounds || {}; const w = Math.round(b.Width || 0), h = Math.round(b.Height || 0);
    if (w < 60 || h < 60) continue;                                   // tool strips, 1x1 helpers: not windows anyone can see
    if (h <= 60 && screens.some((s) => w >= s.w)) continue;           // a strip as wide as the screen (the hidden tab strip of full screen)
    const kind = screens.some((s) => w === s.w && h === s.h) ? "full" : (w <= 240 && h <= 240 ? "strip" : "normal");
    out.push((d.kCGWindowIsOnscreen ? "on" : "off") + "\t" + kind + "\t" + w + "x" + h);
  }
  return out.join("\n");
}

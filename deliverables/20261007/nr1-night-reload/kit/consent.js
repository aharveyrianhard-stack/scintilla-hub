// consent.js - has macOS already decided whether THIS app (the launcher, when run from it) may send Apple events to another app?
//   osascript -l JavaScript consent.js <bundle id>      allowed | denied | not-asked | not-running | error:<number>
// It never asks: macOS is told not to show its dialog (askUserIfNeeded = false), so this is a read. The dialog itself - the ONE
// click - only ever comes from "gui.applescript ask-consent", and only when the coordinator runs that with Alan.
ObjC.import("Cocoa");
ObjC.bindFunction("AEDeterminePermissionToAutomateTarget", ["int", ["void *", "unsigned int", "unsigned int", "bool"]]);
function run(argv) {
  const bid = argv[0]; if (!bid) return "error:no app named";
  const d = $.NSAppleEventDescriptor.descriptorWithBundleIdentifier(bid);
  const st = $.AEDeterminePermissionToAutomateTarget(d.aeDesc, 0x2A2A2A2A, 0x2A2A2A2A, false);   // any event ('****')
  if (st === 0) return "allowed";
  if (st === -1743) return "denied";       // errAEEventNotPermitted
  if (st === -1744) return "not-asked";    // errAEEventWouldRequireUserConsent
  if (st === -600) return "not-running";   // procNotFound: the question can only be asked of a running app
  return "error:" + st;
}

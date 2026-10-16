// spaces.js - what this Mac says about its desktops (Spaces) and the keys that move between them. Read only; needs no permission.
//   osascript -l JavaScript spaces.js              from this Mac's own settings
//   osascript -l JavaScript spaces.js --from <json>  from a file (the tests): {"hotkeys":{"79":...,"81":...},"spaces":{...},"stage":1,"swoosh":0}
// Prints, one per line, words separated by one space:
//   spaces <n>       desktops on the display that has the most (a full-screen window's own desktop counts), from com.apple.spaces; 1 when unreadable
//   stage on|off     Stage Manager (com.apple.WindowManager GloballyEnabled)
//   swoosh on|off    System Settings > Desktop & Dock > "When switching to an application, switch to a Space with open windows for the
//                    application" (com.apple.dock workspaces-auto-swoosh). OFF on the iMac on 16 Oct 2026: that is why activating an app
//                    (open -b) made it frontmost and changed no desktop, and the job walks the desktops with the keys below instead.
//   left <key code> <modifiers> [disabled]    Mission Control's "Move left a space"  (com.apple.symbolichotkeys 79; the default is 123 control)
//   right <key code> <modifiers> [disabled]   Mission Control's "Move right a space" (81; the default is 124 control)
//                    modifiers = control, shift, option, command joined by +, or "none"; "disabled" when Alan switched that shortcut off
ObjC.import("Foundation");
const DEFAULTS = { 79: 123, 81: 124 };
function suite(name, key) {
  try { return ObjC.deepUnwrap($.NSUserDefaults.alloc.initWithSuiteName(name).objectForKey(key)); } catch (e) { return undefined; }
}
function hotkey(all, id) {                 // -> { code, mods, enabled }
  const h = (all || {})[String(id)];
  let code = DEFAULTS[id], mods = 0x40000, enabled = true;
  if (h && typeof h === "object") {
    if (h.enabled === false || h.enabled === 0) enabled = false;
    const p = h.value && h.value.parameters;
    if (Array.isArray(p) && p.length >= 3 && Number(p[1]) >= 0 && Number(p[1]) < 256) { code = Number(p[1]); mods = Number(p[2]); }
  }
  const words = [];                        // the bits macOS uses for the four modifier keys; the device bits (0x800000...) are not keys
  if (mods & 0x40000) words.push("control"); if (mods & 0x20000) words.push("shift"); if (mods & 0x80000) words.push("option"); if (mods & 0x100000) words.push("command");
  return `${code} ${words.length ? words.join("+") : "none"}${enabled ? "" : " disabled"}`;
}
function spaceCount(cfg) {
  let n = 0;
  const mons = (((cfg || {})["Management Data"] || {}).Monitors) || [];
  for (const m of mons) { const k = Array.isArray(m.Spaces) ? m.Spaces.length : 0; if (k > n) n = k; }
  return n > 0 ? n : 1;
}
function describe(hotkeys, spaces, stage, swoosh) {
  const onoff = (v) => (v === true || v === 1 || v === "1" ? "on" : "off");
  return [`spaces ${spaceCount(spaces)}`, `stage ${onoff(stage)}`, `swoosh ${onoff(swoosh)}`, `left ${hotkey(hotkeys, 79)}`, `right ${hotkey(hotkeys, 81)}`].join("\n");
}
function run(argv) {
  if (argv[0] === "--from" && argv[1]) {
    const text = ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError($(argv[1]), $.NSUTF8StringEncoding, null));
    const j = JSON.parse(text || "{}");
    return describe(j.hotkeys, j.spaces, j.stage, j.swoosh);
  }
  return describe(suite("com.apple.symbolichotkeys", "AppleSymbolicHotKeys"), suite("com.apple.spaces", "SpacesDisplayConfiguration"),
    suite("com.apple.WindowManager", "GloballyEnabled"), suite("com.apple.dock", "workspaces-auto-swoosh"));
}

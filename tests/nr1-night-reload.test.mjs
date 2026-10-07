/* NR1 (7 Oct 2026) - the 4 am reload of the Station, X and the X extension.
   The job's decisions are tested here with stand-ins for the Mac: a stand-in clock, idle time, lock state, list of running web apps,
   X health answers, and a stand-in for the window helper that only writes down what it was asked to do. No real window, browser or
   network is touched, so this runs anywhere bash does. What it cannot prove - that macOS really reloads a window and really delivers
   Option+Shift+S - is the supervised test's job (see NIGHT-RELOAD.html). */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, chmodSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const KIT = join(dirname(fileURLToPath(import.meta.url)), "..", "deliverables", "20261007", "nr1-night-reload", "kit");
const JOB = join(KIT, "night-reload.sh");
const STATION = "com.brave.Browser.app.gdmjjlilbdmfgjomdbklfoihogfkcpbh";
const X = "com.brave.Browser.app.lodlkdfmihgonocnmddehnfgiljnadcf";
const HUB = "com.google.Chrome.app.hjliongcjdnfgpnodjphdimchcjddegd";
const CHANGES = /^(activate|raise|reload|shortcut) /;

function night(opts = {}) {
  const dir = opts.dir || mkdtempSync(join(tmpdir(), "nr1-"));
  const calls = join(dir, "calls.txt"), health = join(dir, "health.txt"), idle = join(dir, "idle.txt");
  if (!opts.dir) writeFileSync(calls, "");
  writeFileSync(health, (opts.health || ["working", "working"]).join("\n") + "\n");
  writeFileSync(idle, (opts.idle || ["900"]).join("\n") + "\n");
  /* the window helper's stand-in: writes down every request, answers what the test says */
  const gui = join(dir, "gui.sh");
  writeFileSync(gui, `#!/bin/bash
echo "$*" >> "${calls}"
case "$1" in
  trusted) echo "\${FAKE_TRUSTED:-true}" ;;
  front) echo com.apple.finder ;;
  windows) case "$2" in ${X}) printf '%b' "\${FAKE_X_WINDOWS:-Home / X\\topen\\n}" ;; *) printf 'SCINTILLA\\topen\\n' ;; esac ;;
  find-reload) echo "found:Reload This Page:enabled" ;;
  activate) case "$2" in ${X}) echo "\${FAKE_ACTIVATE_X:-ok}" ;; *) echo ok ;; esac ;;
  raise) echo ok ;;
  reload) case "$2" in ${X}) echo "\${FAKE_RELOAD_X:-ok:menu}" ;; *) echo ok:menu ;; esac ;;
  shortcut) echo "\${FAKE_SHORTCUT:-sent}" ;;
esac
`);
  chmodSync(gui, 0o755);
  /* answers are used up one per question; the last one repeats */
  const pop = join(dir, "pop.sh");
  writeFileSync(pop, `#!/bin/bash
f="$1"; n=$(grep -c . "$f"); line="$(sed -n '1p' "$f")"
[ "$n" -gt 1 ] && sed -i '' '1d' "$f"
case "$line" in sleep*) sleep "\${line#sleep}"; line="$(sed -n '1p' "$f")"; [ "$(grep -c . "$f")" -gt 1 ] && sed -i '' '1d' "$f" ;; esac
echo "$line"
`);
  chmodSync(pop, 0o755);
  const apps = opts.apps || [[STATION, "/a/SCINTILLA Station.app"], [X, "/a/X.app"], [HUB, "/a/SCINTILLA.app"], ["com.apple.finder", "/s/Finder.app"]];
  const env = {
    PATH: "/usr/bin:/bin:/usr/sbin:/sbin", HOME: dir,
    SCINTILLA_NIGHT_RELOAD_STATE: dir, NIGHT_RELOAD_LOG: join(dir, "log.txt"), SCINTILLA_NIGHT_RELOAD_GUI: gui,
    NR_FAKE_HHMM: opts.hhmm || "0400", NR_FAKE_LOCKED: opts.locked || "no", NR_NO_SLEEP: "1", NR_FAKE_MACHINE: "Alan's iMac",
    NR_FAKE_IDLE_CMD: `"${pop}" "${idle}"`, NR_FAKE_HEALTH_CMD: `"${pop}" "${health}"`,
    NR_FAKE_APPS_CMD: `printf '%b' '${apps.map((a) => a.join("\\t")).join("\\n")}\\n'`,
    NR_FAKE_SITE_CMD: `case "$1" in *Station.app) echo https://station.scintillahub.ai/ ;; */X.app) echo "https://x.com/?utm_source=homescreen&utm_medium=shortcut" ;; */SCINTILLA.app) echo https://scintillahub.ai/ ;; esac`,
    LOAD_WAIT: "0", HEALTH_WAIT: "0", HEALTH_POLL: "0", X_HEALTH_CLIENT: "58feb66c", ...(opts.env || {}),
  };
  const run = spawnSync("/bin/bash", [JOB, opts.mode || "run"], { env, encoding: "utf8" });
  const asked = readFileSync(calls, "utf8").split("\n").filter(Boolean);
  const read = (name) => (existsSync(join(dir, name)) ? readFileSync(join(dir, name), "utf8") : "");
  return { dir, run, asked, changed: asked.filter((c) => CHANGES.test(c)), note: (/^NOTE\t(.*)$/m.exec(run.stdout) || [])[1] || "",
    last: read("LAST-NIGHT.txt"), log: read("log.txt"), stamped: readdirSync(dir).some((f) => f.startsWith(".done-")) };
}

test("the full night: Station reloaded, X reloaded, the shortcut pressed in X, the Station brought back, X confirmed - in that order", () => {
  const n = night();
  assert.equal(n.run.status, 0, n.run.stderr);
  assert.deepEqual(n.changed, [
    `activate ${X}`, `activate ${STATION}`,          // both reached BEFORE anything is reloaded
    `activate ${STATION}`, `reload ${STATION}`,
    `activate ${X}`, `reload ${X}`,
    `activate ${X}`, `shortcut ${X}`,
    `activate ${STATION}`,                            // so its X box is on screen and can report
    "activate com.apple.finder",                      // what was in front goes back in front
  ]);
  assert.equal(n.note, "");
  assert.match(n.last, /X confirmed working \(first try\)/);
  assert.ok(n.stamped, "the night is marked done");
});

test("outside the night window the nightly job does nothing at all - a Mac waking at nine must never reload", () => {
  for (const hhmm of ["0359", "0530", "0915", "1545", "2359"]) {
    const n = night({ hhmm });
    assert.deepEqual(n.asked, [], `asked for windows at ${hhmm}`);
    assert.equal(n.stamped, false);
  }
});

test("while the Mac is in use (touched under ten minutes ago) nothing is asked of any window, and the night stays open for the next try", () => {
  const n = night({ idle: ["120"] });
  assert.deepEqual(n.asked, []);
  assert.equal(n.stamped, false);
  assert.match(n.log, /the Mac is in use/);
  const last = night({ idle: ["120"], hhmm: "0520" });
  assert.match(last.last, /not done tonight: the Mac was in use/);
  assert.equal(last.note, "", "no note for a night he was simply working");
});

test("a locked screen: nothing is reloaded and no key is sent; one line for Alan at the last try only", () => {
  const first = night({ locked: "yes" });
  assert.deepEqual(first.changed, []); assert.equal(first.note, "");
  const last = night({ locked: "yes", hhmm: "0520" });
  assert.deepEqual(last.changed, []); assert.match(last.note, /screen stayed locked/);
});

test("without the Accessibility permission nothing is touched and Alan is told where the switch is", () => {
  const n = night({ env: { FAKE_TRUSTED: "false" } });
  assert.deepEqual(n.changed, []);
  assert.match(n.note, /Privacy & Security > Accessibility/);
});

test("X does not come back: exactly ONE retry of the X half, then the note", () => {
  const twice = night({ health: ["working", "not-reporting", "working"] });
  assert.equal(twice.changed.filter((c) => c.startsWith("shortcut")).length, 2);
  assert.equal(twice.changed.filter((c) => c === `reload ${STATION}`).length, 1, "the Station is not reloaded a second time");
  assert.equal(twice.note, ""); assert.match(twice.last, /second try/);
  const never = night({ health: ["working", "not-reporting"] });
  assert.equal(never.changed.filter((c) => c.startsWith("shortcut")).length, 2, "one retry, not more");
  assert.match(never.note, /X did not come back after two tries.*Option\+Shift\+S/);
  assert.ok(never.stamped, "it does not start over at the next ten-minute try");
});

test("a wrong X picture (the whole X window) counts as not working", () => {
  const n = night({ health: ["working", "wrong:the X box shows the whole X window"] });
  assert.match(n.note, /whole X window/);
});

test("two X windows: it cannot tell which one feeds the Station, so it reloads nothing", () => {
  const n = night({ env: { FAKE_X_WINDOWS: "Home / X\\topen\\nLists / X\\topen\\n" } });
  assert.deepEqual(n.changed, []);
  assert.match(n.note, /2 windows open/);
});

test("a minimised X window cannot take the shortcut, so nothing is reloaded", () => {
  const n = night({ env: { FAKE_X_WINDOWS: "Home / X\\tmin\\n" } });
  assert.deepEqual(n.changed, []);
  assert.match(n.note, /minimised/);
});

test("X is working but not from an X web-app window: the Station is NOT reloaded", () => {
  const n = night({ apps: [[STATION, "/a/SCINTILLA Station.app"]] });
  assert.deepEqual(n.changed, []);
  assert.match(n.note, /not from an X web-app window/);
});

test("X closed and not working: only the Station is reloaded, no key is sent, no note", () => {
  const n = night({ apps: [[STATION, "/a/SCINTILLA Station.app"]], health: ["not-reporting"] });
  assert.deepEqual(n.changed.filter((c) => !c.startsWith("activate")), [`reload ${STATION}`]);
  assert.equal(n.note, "");
});

test("if X cannot be brought to the front, the Station is never reloaded", () => {
  const n = night({ env: { FAKE_ACTIVATE_X: "not-front" } });
  assert.equal(n.changed.filter((c) => c.startsWith("reload")).length, 0);
  assert.equal(n.changed.filter((c) => c.startsWith("shortcut")).length, 0);
  assert.match(n.note, /could not bring them to the front/);
});

test("the window helper refusing the shortcut is never reported as sent", () => {
  const n = night({ env: { FAKE_SHORTCUT: "refused:another app is in front (com.apple.TextEdit)" } });
  assert.match(n.note, /X did not come back/);
  assert.doesNotMatch(n.log, /Option\+Shift\+S sent/);
});

test("somebody comes back after the Station was reloaded: no key is sent, and Alan is told what to press", () => {
  /* idle answers: the window check, the look-again check, before the Station reload, then - four real seconds later - a touch */
  const n = night({ idle: ["900", "900", "900", "sleep4", "0"], health: ["working", "not-reporting"] });
  assert.equal(n.changed.filter((c) => c.startsWith("shortcut")).length, 0);
  assert.equal(n.changed.filter((c) => c === "activate com.apple.finder").length, 0, "focus is not moved again under his hands");
  assert.match(n.note, /stopped when somebody came back.*Option\+Shift\+S/);
});

test("the job's own key press is not mistaken for Alan coming back: the retry still happens", () => {
  /* idle answers: the window check, the look-again check, before the Station reload, after the load wait - and then 0 seconds,
     which is what the Mac reports right after the job itself pressed Option+Shift+S */
  const n = night({ idle: ["900", "900", "900", "900", "0"], health: ["working", "not-reporting", "working"] });
  assert.equal(n.changed.filter((c) => c.startsWith("shortcut")).length, 2, "it retried");
  assert.match(n.last, /second try/);
  assert.equal(n.note, "");
  assert.equal(n.changed[n.changed.length - 1], "activate com.apple.finder", "and put the front app back");
});

test("somebody comes back before anything was reloaded: nothing is reloaded, and the night stays open for the next try", () => {
  /* idle answers: the window check, the look-again check, then - four real seconds after X and the Station were brought forward - a touch */
  const first = night({ idle: ["900", "900", "sleep4", "0"] });
  assert.equal(first.changed.filter((c) => /^(reload|shortcut)/.test(c)).length, 0);
  assert.equal(first.stamped, false, "a later try may still do the job");
  assert.equal(first.note, "");
  const later = night({ dir: first.dir, hhmm: "0410" });
  assert.match(later.last, /X confirmed working \(first try\)/);
});

test("a locked screen stops the supervised test as well", () => {
  const n = night({ mode: "test", locked: "yes", env: { TEST_IDLE_SECONDS: "0" } });
  assert.deepEqual(n.changed, []);
});

test("if X itself cannot be reloaded the shortcut is still pressed: it is the shortcut that reconnects X", () => {
  const n = night({ env: { FAKE_RELOAD_X: "refused:the reload menu item is switched off" } });
  assert.equal(n.changed.filter((c) => c.startsWith("shortcut")).length, 1);
  assert.match(n.last, /X NOT reloaded, the extension run, X confirmed working \(first try\)/, "and the morning line does not claim a reload that did not happen");
});

test("the Hub is left to its own night reload unless RELOAD_HUB=yes", () => {
  assert.equal(night().changed.filter((c) => c.endsWith(HUB)).length, 0);
  const on = night({ env: { RELOAD_HUB: "yes" } });
  assert.deepEqual(on.changed.slice(0, 2), [`activate ${HUB}`, `reload ${HUB}`]);
});

test("once a night: the later ten-minute tries return at once", () => {
  const first = night();
  const again = night({ dir: first.dir, hhmm: "0410" });
  assert.equal(again.asked.length, first.asked.length, "the second try asked nothing");
});

test("the dry run looks and never changes anything, at any hour, with everything open", () => {
  for (const hhmm of ["0400", "1545"]) {
    const n = night({ mode: "dry-run", hhmm });
    assert.deepEqual(n.changed, []);
    assert.ok(n.asked.every((c) => /^(trusted|windows|find-reload) ?/.test(c)), n.asked.join(" | "));
    assert.match(n.run.stdout, /DRY RUN: this only looks/);
    assert.match(n.run.stdout, /press Option\+Shift\+S in the X window/);
    assert.match(n.run.stdout, /leave the Hub alone/);
    assert.equal(n.stamped, false);
  }
});

test("both browsers have the Station and X open and none was named: nothing is reloaded", () => {
  const n = night({ apps: [[STATION, "/a/SCINTILLA Station.app"], [X, "/a/X.app"],
    [STATION.replace("com.brave.Browser", "com.google.Chrome"), "/c/SCINTILLA Station.app"], [X.replace("com.brave.Browser", "com.google.Chrome"), "/c/X.app"]] });
  assert.deepEqual(n.changed, []);
  assert.match(n.note, /both Brave and Chrome/);
});

test("the kit carries no key, and the window helper types only after checking who is in front", () => {
  for (const f of readdirSync(KIT)) {
    const text = readFileSync(join(KIT, f), "utf8");
    assert.doesNotMatch(text, /sb_publishable_[A-Za-z0-9]|eyJ[A-Za-z0-9_-]{20,}|service_role/, `${f} carries a key`);
  }
  const lines = readFileSync(join(KIT, "gui.applescript"), "utf8").split("\n");
  const typed = lines.map((l, i) => (/^\s*tell application "System Events" to keystroke/.test(l) ? i : -1)).filter((i) => i >= 0);
  assert.equal(typed.length, 2, "Command-R (fallback) and Option+Shift+S, nothing else");
  for (const i of typed) assert.ok(lines.slice(i - 3, i).some((l) => /notReady\(p, bid\)/.test(l)), `line ${i + 1} types without the check`);
  const plist = readFileSync(join(KIT, "com.scintilla.night-reload.plist"), "utf8");
  assert.match(plist, /__HOME__/, "the timetable in the repo is a template and cannot run as it is");
  assert.doesNotMatch(plist, /<key>RunAtLoad<\/key>\s*<true\/>/);
  assert.match(plist, /<string>\/usr\/bin\/open<\/string>\s*<string>-W<\/string>\s*<string>-g<\/string>/, "started the way that was checked to work, in the background");
  assert.match(plist, /<string>SCINTILLA_NIGHT_RELOAD_MODE=run<\/string>/);
  const slots = [...plist.matchAll(/<key>Hour<\/key><integer>(\d+)<\/integer><key>Minute<\/key><integer>(\d+)<\/integer>/g)].map((m) => Number(m[1]) * 60 + Number(m[2]));
  assert.equal(slots.length, 9);
  assert.ok(slots.every((m) => m >= 240 && m < 330), "every try is inside 04:00-05:30, the window the job itself enforces");
});

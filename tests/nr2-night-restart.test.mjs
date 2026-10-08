/* NR2 (8 Oct 2026) - the 4 am RESTART: quit and reopen TradingView, the Hub app and Brave, then the 7 Oct reload and X reconnect.
   Everything here runs against a stand-in Mac (deliverables/20261008/nr2-night-restart/tools/fakemac.sh): a table of pretend processes
   with pretend "please quit", "open", "keep awake" and window-helper commands that only write down what they were asked. No real
   app, window, browser or network is touched, so this runs anywhere bash does. What it cannot prove - that the real TradingView, Hub
   app and Brave close when asked and come back with their windows - is the supervised test's job (kit/supervised-test.sh). */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, symlinkSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = join(HERE, "..", "deliverables", "20261008", "nr2-night-restart", "kit");
const NR1_KIT = join(HERE, "..", "deliverables", "20261007", "nr1-night-reload", "kit");
const FAKEMAC = join(KIT, "..", "tools", "fakemac.sh");
const STATION = "com.brave.Browser.app.gdmjjlilbdmfgjomdbklfoihogfkcpbh";
const X = "com.brave.Browser.app.lodlkdfmihgonocnmddehnfgiljnadcf";
const HUB_WEBAPP = "com.google.Chrome.app.hjliongcjdnfgpnodjphdimchcjddegd";
const TV = "com.tradingview.tradingviewapp.desktop";
const HUB_APP = "com.apple.Safari.WebApp.9257ED5B-FBF6-44EC-911A-8A8DD1CB2C9C";
const CHANGES = /^(activate|raise|reload|shortcut) /;
const ACTS = /^(CLOSE|OPEN|AWAKE|FORBIDDEN-SIGNAL|OPENED-BRAVE-ITSELF)/;
const PATH = "/usr/bin:/bin:/usr/sbin:/sbin";
/* what the reload stage asks the windows on a full night, exactly as on 7 Oct */
const RELOAD_STAGE = [`activate ${X}`, `activate ${STATION}`, `activate ${STATION}`, `reload ${STATION}`, `activate ${X}`, `reload ${X}`,
  `activate ${X}`, `shortcut ${X}`, `activate ${STATION}`, "activate com.apple.finder"];

function table(dir) {
  return readFileSync(join(dir, "procs.tsv"), "utf8").split("\n").filter(Boolean).map((l) => {
    const [pid, ppid, rss, foot, group, name, bid, kind, path, command, role] = l.split("\t");
    return { pid: Number(pid), ppid: Number(ppid), rss: Number(rss), foot: Number(foot), group, name, bid, kind, path, command, role };
  });
}
/* one run of the job on the stand-in Mac. opts.dir = go on with the Mac (and the night) an earlier run left */
function night(opts = {}) {
  const fresh = !opts.dir;
  const dir = opts.dir || mkdtempSync(join(tmpdir(), "nr2-"));
  const mac = { FAKEMAC_DIR: dir, FAKEMAC_HOME: dir, ...(opts.mac || {}) };
  if (fresh) {
    const made = spawnSync("/bin/bash", [FAKEMAC, "init"], { env: { PATH, ...mac }, encoding: "utf8" });
    assert.equal(made.status, 0, made.stderr);
    for (const n of ["kill", "open", "caffeinate", "gui"]) symlinkSync(FAKEMAC, join(dir, n));
  }
  if (opts.behave) writeFileSync(join(dir, "behave"), Object.entries(opts.behave).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
  const calls = join(dir, "calls.txt"), health = join(dir, "health.txt"), idle = join(dir, "idle.txt");
  writeFileSync(health, (opts.health || ["working", "working"]).join("\n") + "\n");
  writeFileSync(idle, (opts.idle || ["900"]).join("\n") + "\n");
  const already = readFileSync(calls, "utf8").split("\n").filter(Boolean).length;
  const start = table(dir);
  const fm = `"${FAKEMAC}"`;
  const env = {
    PATH, HOME: dir, ...mac,
    SCINTILLA_NIGHT_RELOAD_STATE: dir, NIGHT_RELOAD_LOG: join(dir, "log.txt"), SCINTILLA_NIGHT_RELOAD_GUI: join(dir, "gui"),
    NR_KILL: join(dir, "kill"), NR_OPEN: join(dir, "open"), NR_CAFFEINATE: join(dir, "caffeinate"),
    NR_FAKE_HHMM: opts.hhmm || "0400", NR_FAKE_LOCKED: opts.locked || "no", NR_NO_SLEEP: "1", NR_FAKE_MACHINE: "Alan's iMac",
    NR_FAKE_IDLE_CMD: `${fm} pop "${idle}"`, NR_FAKE_HEALTH_CMD: `${fm} pop "${health}"`,
    NR_FAKE_APPS_CMD: `${fm} apps`, NR_FAKE_PS_CMD: `${fm} ps`, NR_FAKE_TOP_CMD: `${fm} top`, NR_FAKE_REGISTRY_CMD: `${fm} registry`, NR_FAKE_SYSMEM_CMD: `${fm} sysmem`,
    NR_FAKE_SITE_CMD: `case "$1" in *Station.app) echo https://station.scintillahub.ai/ ;; */X.app) echo "https://x.com/?utm_source=homescreen&utm_medium=shortcut" ;; */SCINTILLA.app) echo https://scintillahub.ai/ ;; esac`,
    LOAD_WAIT: "0", HEALTH_WAIT: "0", HEALTH_POLL: "0", SETTLE_WAIT: "0", OPEN_WAIT: "3", X_HEALTH_CLIENT: "58feb66c", ...(opts.env || {}),
  };
  const run = spawnSync("/bin/bash", [join(opts.kit || KIT, "night-reload.sh"), opts.mode || "run"], { env, encoding: "utf8" });
  const asked = readFileSync(calls, "utf8").split("\n").filter(Boolean).slice(already);
  const read = (name) => (existsSync(join(dir, name)) ? readFileSync(join(dir, name), "utf8") : "");
  const files = readdirSync(dir);
  const stamp = files.find((f) => f.startsWith(".restarted-"));
  return { dir, run, asked, start, end: table(dir),
    gui: asked.filter((c) => !ACTS.test(c)), changed: asked.filter((c) => CHANGES.test(c)),
    acts: asked.filter((c) => ACTS.test(c) && !c.startsWith("AWAKE")), awake: asked.filter((c) => c.startsWith("AWAKE")),
    closed: asked.filter((c) => c.startsWith("CLOSE")).map((c) => c.split(" ")[1]), opened: asked.filter((c) => c.startsWith("OPEN ")),
    note: (/^NOTE\t(.*)$/m.exec(run.stdout) || [])[1] || "", last: read("LAST-NIGHT.txt"), log: read("log.txt"),
    stamped: files.some((f) => f.startsWith(".done-")), tried: stamp ? read(stamp).split("\n").filter(Boolean) : [] };
}
const shim = (n, name) => `OPEN -g -a ${n.dir}/Applications/Brave Browser Apps.localized/${name}.app`;
const running = (n, group) => n.end.some((p) => p.group === group && p.role === "main");
const noTime = (s) => s.replace(/[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2} \d{2}:\d{2}/g, "WHEN");
/* the memory of a group of pretend processes the way the job must count it: top's megabytes (it rounds each process down), added up */
const gbOf = (rows, key) => (rows.reduce((s, p) => s + (key === "foot" ? (p.foot >= 1024 ? Math.floor(p.foot / 1024) * 1024 : p.foot) : p.rss), 0) / 1048576).toFixed(2) + " GB";

/* ---------------------------------------------------------------------------------------------------------------------------------
   PART 1 - with the restart switched off, this job is the 7 Oct job. Each of the 7 Oct scenarios is run twice on identical stand-in
   Macs - once with the 7 Oct script itself, once with this one and RESTART_APPS=no - and what each asked of the Mac, said to Alan,
   wrote down and stamped must be the same. */
const SEVEN_OCT = [
  ["the full night", {}],
  ...["0359", "0530", "0915", "1545", "2359"].map((hhmm) => [`outside the night window (${hhmm})`, { hhmm }]),
  ["the Mac in use", { idle: ["120"] }],
  ["the Mac in use at the last try", { idle: ["120"], hhmm: "0520" }],
  ["a locked screen", { locked: "yes" }],
  ["a locked screen at the last try", { locked: "yes", hhmm: "0520" }],
  ["no Accessibility permission", { env: { FAKE_TRUSTED: "false" } }],
  ["X comes back at the second try", { health: ["working", "not-reporting", "working"] }],
  ["X never comes back", { health: ["working", "not-reporting"] }],
  ["a wrong X picture", { health: ["working", "wrong:the X box shows the whole X window"] }],
  ["two X windows", { env: { FAKE_X_WINDOWS: "Home / X\\topen\\nLists / X\\topen\\n" } }],
  ["a minimised X window", { env: { FAKE_X_WINDOWS: "Home / X\\tmin\\n" } }],
  ["X working but not from an X web app", { mac: { FAKEMAC_WITHOUT: "x" } }],
  ["X closed and not working", { mac: { FAKEMAC_WITHOUT: "x" }, health: ["not-reporting"] }],
  ["X cannot be brought to the front", { env: { FAKE_ACTIVATE_X: "not-front" } }],
  ["the shortcut is refused", { env: { FAKE_SHORTCUT: "refused:another app is in front (com.apple.TextEdit)" } }],
  ["somebody comes back after the Station was reloaded", { idle: ["900", "900", "900", "sleep4", "0"], health: ["working", "not-reporting"] }],
  ["the job's own key press is not Alan", { idle: ["900", "900", "900", "900", "0"], health: ["working", "not-reporting", "working"] }],
  ["somebody comes back before anything was reloaded, then a later try", { idle: ["900", "900", "sleep4", "0"], then: [{ hhmm: "0410" }] }],
  ["a locked screen in the supervised test", { mode: "test", locked: "yes", env: { TEST_IDLE_SECONDS: "0" } }],
  ["X itself cannot be reloaded", { env: { FAKE_RELOAD_X: "refused:the reload menu item is switched off" } }],
  ["the Hub page reload switched on", { env: { RELOAD_HUB: "yes" } }],
  ["once a night", { then: [{ hhmm: "0410" }] }],
  ["the dry run at 04:00", { mode: "dry-run" }],
  ["the dry run at 15:45", { mode: "dry-run", hhmm: "1545" }],
  ["both browsers have the Station and X", { mac: { FAKEMAC_CHROME_STATION_X: "1" } }],
];
for (const [name, opts] of SEVEN_OCT) {
  test(`restart switched off = the 7 Oct job: ${name}`, () => {
    const { then = [], ...first } = opts;
    const off = (o) => ({ ...o, env: { ...(o.env || {}), RESTART_APPS: "no" } });
    let a = night({ ...off(first), kit: NR1_KIT }), b = night(off(first));
    for (const step of [null, ...then]) {
      if (step) { a = night({ ...off(step), kit: NR1_KIT, dir: a.dir }); b = night({ ...off(step), dir: b.dir }); }
      assert.equal(b.run.status, a.run.status, b.run.stderr);
      assert.deepEqual(b.asked, a.asked, "asked the Mac something else");
      assert.deepEqual(b.acts.concat(b.awake), [], "nothing is closed, opened or kept awake");
      assert.equal(noTime(b.note), noTime(a.note));
      assert.equal(noTime(b.last), noTime(a.last));
      assert.equal(b.stamped, a.stamped);
      const lines = (r) => noTime(r.run.stdout).split("\n").filter((l) => !/^restart: switched off/.test(l) && !/^Full log:/.test(l));
      assert.deepEqual(lines(b), lines(a), "said something else");
    }
  });
}

/* ---------------------------------------------------------------------------------------------------------------------------------
   PART 2 - the restart. */
test("the full night: reach X and the Station, restart TradingView, the Hub app, then Brave through its web apps, and only then the 7 Oct reload", () => {
  const n = night();
  assert.equal(n.run.status, 0, n.run.stderr);
  assert.deepEqual(n.acts, [
    "CLOSE tv:main -TERM",
    "OPEN -g -a /Applications/TradingView.app --args --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1",
    "CLOSE hub:main -TERM", `OPEN -g -a ${n.dir}/Applications/SCINTILLA.app`,
    "CLOSE brave:main -TERM", shim(n, "SCINTILLA Station"), shim(n, "X"),
  ]);
  assert.deepEqual(n.changed, [`activate ${X}`, `activate ${STATION}`, ...RELOAD_STAGE],
    "X and the Station are reached BEFORE Brave is closed, and the reload stage is the 7 Oct one, whole");
  const at = (line) => n.asked.indexOf(line);
  assert.ok(at(`activate ${STATION}`) < at("CLOSE tv:main -TERM"), "nothing is closed before X and the Station were reached");
  assert.ok(at(shim(n, "X")) < at(`reload ${STATION}`), "the reload comes after the restart");
  assert.deepEqual(n.awake, ["AWAKE -d -t 1800"], "the screen is held awake once, and lets go by itself after 30 minutes");
  assert.ok(n.log.indexOf("holding the screen awake") < n.log.indexOf("asked TradingView to close"), "held awake before the first app closes");
  assert.equal(n.note, "");
  assert.match(n.last.split("\n")[0], /restarted: TradingView, the Hub app, Brave; the Station reloaded; X reloaded, the extension run, X confirmed working \(first try\)/);
  assert.ok(n.stamped, "the night is marked done");
  assert.deepEqual(n.tried, ["tv", "hub", "brave"]);
  for (const g of ["tv", "hub", "brave", "chrome", "youtube"]) assert.ok(running(n, g), `${g} is running at the end`);
  const brave = n.end.find((p) => p.group === "brave" && p.role === "main");
  assert.equal(brave.kind, "BackgroundOnly", "Brave came back the way it was: in the background, started by its web apps");
  assert.deepEqual(n.end.filter((p) => p.role === "shim" && p.group === "brave").map((p) => p.name), ["SCINTILLA Station", "X"]);
});

test("before and after: one line per app in LAST-NIGHT.txt and in the log, each the sum over that app's own processes", () => {
  const n = night();
  const of = (rows, g) => rows.filter((p) => p.group === g);
  const line = (label, g) => `${label}: ${gbOf(of(n.start, g), "foot")} before, ${gbOf(of(n.end, g), "foot")} after (in real memory at those moments: ${gbOf(of(n.start, g), "rss")}, then ${gbOf(of(n.end, g), "rss")})`;
  const lines = n.last.split("\n");
  assert.equal(lines[1], "Memory before and after the restart, as Activity Monitor counts it:");
  assert.equal(lines[2], line("TradingView", "tv"));
  assert.equal(lines[3], line("The Hub app", "hub"));
  assert.equal(lines[4], line("Brave with the Station and X", "brave"));
  assert.match(lines[5], /^The whole Mac: \d+\.\d\d GB of memory pushed out to disk before, \d+\.\d\d GB after; 25% of memory free before, 62% after$/);
  assert.equal(lines[2], "TradingView: 1.61 GB before, 1.05 GB after (in real memory at those moments: 0.26 GB, then 0.26 GB)", "worked by hand: 150 + 900 + 600 MB before, 97 + 585 + 390 MB after");
  assert.equal(of(n.start, "hub").length, 4, "the Hub app's page, network and picture helpers count as the Hub app");
  assert.equal(of(n.start, "brave").length, 5, "Brave's helpers and its two web-app icons count as Brave");
  for (const l of lines.slice(2, 5)) assert.ok(n.log.includes(l), "the same line is in the log");
  assert.match(n.log, /memory before - TradingView: 1\.61 GB as Activity Monitor counts it \(0\.26 GB in real memory now\), 3 processes/);
  assert.doesNotMatch(n.last, /YouTube|Chrome/);
});

test("only the main process of each app is asked to quit, only with the ordinary quit signal, and never Chrome or another web app", () => {
  for (const opts of [{}, { behave: { tv: "refuses" } }, { behave: { "open.tv": "fail" } }, { mac: { FAKEMAC_BRAVE_KIND: "Foreground" } }]) {
    const n = night(opts);
    assert.ok(n.closed.every((c) => /^(tv|hub|brave):main$/.test(c)), n.closed.join(" "));
    assert.ok(n.asked.filter((c) => c.startsWith("CLOSE")).every((c) => c.endsWith(" -TERM")));
    assert.equal(n.asked.filter((c) => /^FORBIDDEN-SIGNAL|OPENED-BRAVE-ITSELF/.test(c)).length, 0);
    assert.ok(running(n, "chrome") && running(n, "youtube"));
    assert.deepEqual(n.end.filter((p) => p.group === "chrome" || p.group === "youtube").map((p) => p.pid), n.start.filter((p) => p.group === "chrome" || p.group === "youtube").map((p) => p.pid), "the same processes as before");
  }
  const text = readFileSync(join(KIT, "night-reload.sh"), "utf8").split("\n").filter((l) => !/^\s*#/.test(l));
  const signals = text.filter((l) => /^\s*"\$NR_KILL" /.test(l));
  assert.equal(signals.length, 1, "one place in the whole job can end a process");
  assert.match(signals[0], /"\$NR_KILL" -TERM "\$1"/);
  assert.ok(text.every((l) => !/\bkill\s+-(9|KILL|s\s*KILL)|pkill|killall/.test(l)), "no stronger signal, no kill-by-name anywhere");
});

test("outside the night window, with the Mac in use, with the screen locked, or without the permission: no app is closed", () => {
  for (const opts of [{ hhmm: "0359" }, { hhmm: "0530" }, { hhmm: "0915" }, { hhmm: "1630" }, { idle: ["120"] }, { idle: ["599"] },
    { locked: "yes" }, { locked: "yes", hhmm: "0520" }, { env: { FAKE_TRUSTED: "false" } }]) {
    const n = night(opts);
    assert.deepEqual(n.acts.concat(n.awake), [], JSON.stringify(opts));
    assert.deepEqual(n.end.map((p) => p.pid), n.start.map((p) => p.pid));
  }
});

test("the dry run closes nothing and opens nothing, at any hour, and says what it would restart and how", () => {
  for (const hhmm of ["0400", "1630"]) {
    const n = night({ mode: "dry-run", hhmm });
    assert.deepEqual(n.acts.concat(n.awake, n.changed), []);
    assert.deepEqual(n.end.map((p) => p.pid), n.start.map((p) => p.pid));
    assert.match(n.run.stdout, /restart: TradingView is running \(3 processes, 1\.61 GB\) - it would be asked to close and opened again with the start-up options it has now: --remote-debugging-port=9222 --remote-debugging-address=127\.0\.0\.1/);
    assert.match(n.run.stdout, /restart: the Hub app "SCINTILLA" is running \(4 processes, 1\.51 GB\) - it would be closed and opened again \(it comes back on its first screen\)/);
    assert.match(n.run.stdout, /restart: Brave is running in the background with these web apps: SCINTILLA Station, X \(5 processes, 2\.\d\d GB\)/);
    assert.match(n.run.stdout, /1\. close TradingView and open it again\n\s+2\. close the Hub app and open it again\n\s+3\. check it can bring X and the Station to the front, then close Brave/);
    assert.match(n.run.stdout, /press Option\+Shift\+S in the X window/);
    assert.equal(n.stamped, false); assert.deepEqual(n.tried, []);
  }
});

test("an app that will not quit is left exactly as it is - nothing is forced - Alan is told, and the others go on", () => {
  const n = night({ behave: { tv: "refuses" } });
  assert.deepEqual(n.closed, ["tv:main", "hub:main", "brave:main"], "asked once, never again, never harder");
  assert.equal(n.opened.filter((o) => o.includes("TradingView")).length, 0, "an app that is still open is not opened a second time");
  assert.deepEqual(n.end.filter((p) => p.group === "tv").map((p) => p.pid), [7001, 7002, 7003], "the very same TradingView, untouched");
  assert.match(n.note, /TradingView did not close when it was asked to, so it was not restarted\. Nothing was forced; it was left as it was\./);
  assert.match(n.last, /restarted: the Hub app, Brave; the Station reloaded/);
  assert.match(n.last, /TradingView: .* - not restarted: it did not close when asked/);
  assert.match(n.log, /TradingView is still closing after 30s - giving it up to 60s more/);
});

test("an app that is slow to quit is waited for and then opened again - also when it only goes after the wait is over", () => {
  const slow = night({ behave: { tv: "slow:40" } });
  assert.deepEqual(slow.acts.slice(0, 2), ["CLOSE tv:main -TERM", "OPEN -g -a /Applications/TradingView.app --args --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1"]);
  assert.equal(slow.note, "");
  assert.match(slow.last, /restarted: TradingView, the Hub app, Brave/);
  /* 96 looks at the process list is past the 90 the job waits; it is gone by the time the job ends, so it is opened then */
  const late = night({ behave: { tv: "slow:96" } });
  assert.equal(late.opened.filter((o) => o.includes("TradingView")).length, 1);
  assert.ok(late.asked.indexOf(late.opened.find((o) => o.includes("TradingView"))) > late.asked.indexOf(`shortcut ${X}`), "found closed at the end of the job, and opened then");
  assert.ok(running(late, "tv"), "it is not left closed");
  assert.match(late.note, /TradingView closed late and was opened again/);
});

test("an app that does not come back: exactly ONE more try, then a line for Alan, and no further app is closed that night", () => {
  const twice = night({ behave: { "open.tv": "fail-once" } });
  assert.equal(twice.opened.filter((o) => o.includes("TradingView")).length, 2);
  assert.equal(twice.note, ""); assert.ok(running(twice, "tv"));
  assert.match(twice.last, /restarted: TradingView, the Hub app, Brave/);
  const never = night({ behave: { "open.tv": "fail" } });
  assert.equal(never.opened.filter((o) => o.includes("TradingView")).length, 2, "one retry, not more");
  assert.deepEqual(never.closed, ["tv:main"], "the Hub app and Brave are not closed after that");
  assert.match(never.note, /TradingView was closed for its nightly restart and did not open again after two tries\. Please open it by hand\. No other app was closed after that\./);
  assert.deepEqual(never.changed, [`activate ${X}`, `activate ${STATION}`, ...RELOAD_STAGE], "the reload of the Station and X still runs: Brave was never closed, so it is the 7 Oct night");
  assert.match(never.last, /Brave with the Station and X: .* - not restarted: an app before it did not open again, so nothing more was closed/);
  assert.ok(never.stamped, "it does not start over at the next ten-minute try");
});

test("a web app of Brave that does not come back: one more try, a line for Alan, and the reload stage follows its own 7 Oct rules", () => {
  const n = night({ behave: { "open.X": "fail" }, health: ["working", "not-reporting"] });
  assert.equal(n.opened.filter((o) => o.endsWith("/X.app")).length, 2, "one retry");
  assert.match(n.note, /Brave was closed for its nightly restart and did not open again after two tries/);
  assert.equal(n.changed.filter((c) => c.startsWith("shortcut")).length, 0, "no key is sent when there is no X window to send it to");
  assert.ok(n.changed.includes(`reload ${STATION}`), "X is not open and not working, so only the Station is reloaded - the 7 Oct rule");
  assert.ok(running(n, "brave"));
});

test("Brave with a window of its own is not restarted (it would come back empty); the other two are, and the reload runs as on 7 Oct", () => {
  const n = night({ mac: { FAKEMAC_BRAVE_KIND: "Foreground" } });
  assert.deepEqual(n.closed, ["tv:main", "hub:main"]);
  assert.deepEqual(n.changed, RELOAD_STAGE);
  assert.match(n.last, /restarted: TradingView, the Hub app; the Station reloaded/);
  assert.match(n.last, /Brave with the Station and X: .* - not restarted: Brave has a window of its own open, and Brave on this Mac is not set to bring its pages back/);
  assert.equal(n.note, "");
});

test("Brave is not closed on a night X could not be reconnected afterwards: two X windows, X minimised, X not reachable, reload switched off", () => {
  for (const [opts, why] of [
    [{ env: { FAKE_X_WINDOWS: "Home / X\\topen\\nLists / X\\topen\\n" } }, /X has 2 windows open/],
    [{ env: { FAKE_X_WINDOWS: "Home / X\\tmin\\n" } }, /the X window is minimised/],
    [{ env: { FAKE_ACTIVATE_X: "not-front" } }, /X and the Station could not be brought to the front/],
    [{ env: { RELOAD_STATION: "no" } }, /the Station reload is switched off/],
    [{ mac: { FAKEMAC_WITHOUT: "x" }, health: ["not-reporting"] }, /X is not open as a web app/],
  ]) {
    const n = night(opts);
    assert.deepEqual(n.closed, ["tv:main", "hub:main"], JSON.stringify(opts));
    assert.match(n.last, new RegExp(`Brave with the Station and X: .* - not restarted: .*${why.source}`));
    assert.ok(n.end.some((p) => p.pid === 9001), "the same Brave as before");
  }
});

test("a process number that now belongs to another program is never asked to quit", () => {
  /* TradingView goes away by itself after the job looked, and its number is given to something else before the job asks */
  const n = night({ behave: { "reuse.tv": "2" } });
  assert.deepEqual(n.closed, ["hub:main", "brave:main"], "nothing was sent to the stranger");
  assert.ok(n.end.some((p) => p.pid === 7001 && p.command === "/usr/libexec/somebody-else --serving"), "the other program is untouched");
  assert.match(n.log, /REFUSED: process 7001 is no longer TradingView - not touched/);
  assert.match(n.last, /TradingView: .* - not restarted: it could not be asked to close/);
});

test("an app that is not running is not started, and each app can be switched off by itself", () => {
  const none = night({ mac: { FAKEMAC_WITHOUT: "tv" } });
  assert.deepEqual(none.closed, ["hub:main", "brave:main"]);
  assert.equal(none.opened.filter((o) => o.includes("TradingView")).length, 0);
  assert.match(none.last, /TradingView: 0\.00 GB before, 0\.00 GB after .* - not restarted: it is not running/);
  const off = night({ env: { RESTART_HUB_APP: "no", RESTART_BRAVE: "no" } });
  assert.deepEqual(off.closed, ["tv:main"]);
  assert.match(off.last, /The Hub app: .* - not restarted: switched off in config\.env/);
});

test("TradingView is opened again with exactly the options it had - and with none when it had none", () => {
  const spaced = night({ mac: { FAKEMAC_TV_ARGS: "--remote-debugging-port=9222 --user-data-dir=/Users/a b/TV data --flag" } });
  assert.equal(spaced.end.find((p) => p.group === "tv" && p.role === "main").command,
    "/Applications/TradingView.app/Contents/MacOS/TradingView --remote-debugging-port=9222 --user-data-dir=/Users/a b/TV data --flag");
  const plain = night({ mac: { FAKEMAC_TV_ARGS: "" } });
  assert.equal(plain.opened[0], "OPEN -g -a /Applications/TradingView.app");
});

test("once a night: a later try does not restart anything again - it only finishes what is left", () => {
  /* the first try restarts all three; then somebody touches the Mac before the Station is reloaded, so the night stays open */
  const first = night({ idle: ["900", "900", "900", "900", "900", "900", "sleep4", "touch", "since"] });
  assert.deepEqual(first.closed, ["tv:main", "hub:main", "brave:main"]);
  assert.equal(first.changed.filter((c) => /^(reload|shortcut)/.test(c)).length, 0);
  assert.equal(first.stamped, false, "a later try may still reconnect X");
  assert.match(first.note, /Brave was restarted and somebody came back to the Mac before X was reconnected\. Click the X window and press Option\+Shift\+S/);
  const later = night({ dir: first.dir, hhmm: "0410" });
  assert.deepEqual(later.acts, [], "no app is closed or opened a second time");
  assert.deepEqual(later.changed, RELOAD_STAGE);
  assert.match(later.last, /X confirmed working \(first try\)/);
  assert.match(later.last, /TradingView: .* - not restarted: already done tonight/);
  assert.ok(later.stamped);
  const again = night({ dir: first.dir, hhmm: "0420" });
  assert.deepEqual(again.asked, [], "and after that the night is done");
});

test("somebody comes back before the first app is closed: nothing is closed, and the night stays open", () => {
  const n = night({ idle: ["900", "900", "sleep4", "touch", "since"] });
  assert.deepEqual(n.acts.concat(n.awake), []);
  assert.deepEqual(n.end.map((p) => p.pid), n.start.map((p) => p.pid));
  assert.equal(n.changed.filter((c) => /^(reload|shortcut)/.test(c)).length, 0);
  assert.equal(n.stamped, false); assert.equal(n.note, "");
});

test("somebody comes back while an app is closed: it is still opened again, and no further app is closed", () => {
  /* the touch lands while TradingView is being restarted; the next look at the keyboard is before the Hub app */
  const n = night({ idle: ["900", "900", "900", "900", "sleep4", "touch", "since"] });
  assert.deepEqual(n.acts, ["CLOSE tv:main -TERM", "OPEN -g -a /Applications/TradingView.app --args --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1"]);
  assert.ok(running(n, "tv"));
  assert.match(n.last, /The Hub app: .* - not restarted: somebody came back to the Mac, or the night window ended/);
});

test("X comes back on another page than it was on: the morning lines say so", () => {
  const n = night({ env: { FAKE_X_WINDOWS: "(3) Following / X\\topen\\n", FAKE_X_WINDOWS_AFTER: "Home / X\\topen\\n" } });
  assert.match(n.last, /X came back on its opening page \("Home \/ X"\); before the restart its window was called "Following \/ X"\./);
  const same = night({ env: { FAKE_X_WINDOWS: "(3) Home / X\\topen\\n", FAKE_X_WINDOWS_AFTER: "(12) Home / X\\topen\\n" } });
  assert.doesNotMatch(same.last, /came back on its opening page/, "the count of new posts in the title is not a different page");
});

test("an app that comes back without a window: Alan is told - unless it had none before either", () => {
  const n = night({ env: { FAKE_TV_WINDOWS_AFTER: "" } });
  assert.match(n.note, /TradingView is running again but shows no window\./);
  assert.match(n.last, /^For Alan: .*TradingView is running again but shows no window/m);
  const never = night({ env: { FAKE_TV_WINDOWS: "", FAKE_TV_WINDOWS_AFTER: "" } });
  assert.equal(never.note, "", "it had no window before the restart, so nothing changed");
});

test("X does not report after a Brave restart: the 7 Oct retry and note, and the restart is still written down", () => {
  const n = night({ health: ["working", "not-reporting"] });
  assert.equal(n.changed.filter((c) => c.startsWith("shortcut")).length, 2, "one retry of the X half");
  assert.match(n.note, /X did not come back after two tries.*Option\+Shift\+S/);
  assert.match(n.last, /Memory before and after the restart/);
  assert.match(n.last, /TradingView: 1\.61 GB before, 1\.05 GB after/);
});

test("the supervised test restarts now, whatever the clock says, and never stamps the night", () => {
  const n = night({ mode: "test", hhmm: "1630", idle: ["900"], env: { TEST_IDLE_SECONDS: "0" } });
  assert.deepEqual(n.closed, ["tv:main", "hub:main", "brave:main"]);
  assert.deepEqual(n.changed, [`activate ${X}`, `activate ${STATION}`, ...RELOAD_STAGE]);
  assert.equal(n.stamped, false); assert.deepEqual(n.tried, []);
  assert.match(n.run.stdout, /restarted: TradingView, the Hub app, Brave/);
  assert.match(n.run.stdout, /TradingView: 1\.61 GB before, 1\.05 GB after/);
});

test("a test Mac that is only half replaced by stand-ins can never reach a real app", () => {
  const dir = mkdtempSync(join(tmpdir(), "nr2-"));
  spawnSync("/bin/bash", [FAKEMAC, "init"], { env: { PATH, FAKEMAC_DIR: dir, FAKEMAC_HOME: dir } });
  symlinkSync(FAKEMAC, join(dir, "gui"));
  writeFileSync(join(dir, "q.txt"), "900\n"); writeFileSync(join(dir, "h.txt"), "working\n");
  const fm = `"${FAKEMAC}"`;
  /* the 7 Oct stand-ins only: no stand-in for the process list, for closing or for opening */
  const run = spawnSync("/bin/bash", [join(KIT, "night-reload.sh"), "run"], { encoding: "utf8", env: { PATH, HOME: dir, FAKEMAC_DIR: dir, FAKEMAC_HOME: dir,
    SCINTILLA_NIGHT_RELOAD_STATE: dir, NIGHT_RELOAD_LOG: join(dir, "log.txt"), SCINTILLA_NIGHT_RELOAD_GUI: join(dir, "gui"),
    NR_FAKE_HHMM: "0400", NR_FAKE_LOCKED: "no", NR_NO_SLEEP: "1", NR_FAKE_IDLE_CMD: `${fm} pop "${join(dir, "q.txt")}"`, NR_FAKE_HEALTH_CMD: `${fm} pop "${join(dir, "h.txt")}"`,
    NR_FAKE_APPS_CMD: `${fm} apps`, NR_FAKE_SITE_CMD: `case "$1" in *Station.app) echo https://station.scintillahub.ai/ ;; */X.app) echo https://x.com/ ;; esac`,
    LOAD_WAIT: "0", HEALTH_WAIT: "0", HEALTH_POLL: "0", X_HEALTH_CLIENT: "58feb66c" } });
  assert.equal(run.status, 0, run.stderr);
  assert.match(readFileSync(join(dir, "log.txt"), "utf8"), /restart: NOT done - this is a test with stand-ins/);
  assert.equal(readFileSync(join(dir, "calls.txt"), "utf8").split("\n").filter((c) => ACTS.test(c)).length, 0);
});

/* ---------------------------------------------------------------------------------------------------------------------------------
   PART 3 - the kit around the job. */
test("the kit: no key; the window helper, the timetable and switch-on are the 7 Oct files byte for byte; the launcher differs only in showing the end of a long record", () => {
  for (const f of readdirSync(KIT)) {
    const text = readFileSync(join(KIT, f), "utf8");
    assert.doesNotMatch(text, /sb_publishable_[A-Za-z0-9]|eyJ[A-Za-z0-9_-]{20,}|service_role|sk-[A-Za-z0-9_-]{20,}/, `${f} carries a key`);
  }
  for (const f of ["gui.applescript", "com.scintilla.night-reload.plist", "switch-on.sh"])
    assert.equal(readFileSync(join(KIT, f), "utf8"), readFileSync(join(NR1_KIT, f), "utf8"), `${f} differs from the 7 Oct kit`);
  const launcher = readFileSync(join(KIT, "launcher.applescript"), "utf8");
  const cut = launcher.indexOf("\n-- 8 Oct 2026: with the restart the record of a test");
  assert.ok(cut > 0 && /^on lastLines\(t, n\)$/m.test(launcher.slice(cut)), "the one addition is the handler that keeps the end of the record");
  assert.equal(launcher.slice(0, cut).replace("my lastLines(outText, 9)", "outText"), readFileSync(join(NR1_KIT, "launcher.applescript"), "utf8"), "everything else in the launcher is the 7 Oct file");
  const plist = readFileSync(join(KIT, "com.scintilla.night-reload.plist"), "utf8");
  const slots = [...plist.matchAll(/<key>Hour<\/key><integer>(\d+)<\/integer><key>Minute<\/key><integer>(\d+)<\/integer>/g)].map((m) => Number(m[1]) * 60 + Number(m[2]));
  assert.equal(slots.length, 9);
  assert.ok(slots.every((m) => m >= 240 && m < 330), "every try starts inside 04:00-05:30, the window the job itself enforces before it closes anything");
  const example = readFileSync(join(KIT, "config.example.env"), "utf8");
  for (const k of ["RESTART_APPS=yes", "RESTART_TRADINGVIEW=yes", "RESTART_HUB_APP=yes", "RESTART_BRAVE=yes", "QUIT_WAIT=30"]) assert.ok(example.includes(k), `config.example.env lacks ${k}`);
});

test("install.sh installs into a home folder without switching anything on; rollback.sh --reload-only brings back the 7 Oct behaviour", () => {
  const home = mkdtempSync(join(tmpdir(), "nr2-home-"));
  /* stand-ins for the three macOS tools install.sh uses to build the small app, so no app is built or signed on this Mac */
  const bin = join(home, "bin"); mkdirSync(bin);
  for (const [name, body] of [["osacompile", 'mkdir -p "$2/Contents"; printf \'<?xml version="1.0" encoding="UTF-8"?>\\n<plist version="1.0"><dict/></plist>\\n\' > "$2/Contents/Info.plist"'], ["codesign", "exit 0"], ["launchctl", 'echo "launchctl $*" >> "$HOME/launchctl.txt"; exit 1']])
    writeFileSync(join(bin, name), `#!/bin/bash\n${body}\n`, { mode: 0o755 });
  const env = { PATH, HOME: home, NR_TOOLS: bin };
  const inst = spawnSync("/bin/bash", [join(KIT, "install.sh")], { env, encoding: "utf8" });
  assert.equal(inst.status, 0, inst.stderr + inst.stdout);
  const dest = join(home, "Scintilla", "night-reload");
  for (const f of ["night-reload.sh", "gui.applescript", "supervised-test.sh", "rollback.sh", "switch-on.sh", "config.env", "com.scintilla.night-reload.plist"]) assert.ok(existsSync(join(dest, f)), `${f} was not installed`);
  assert.equal(existsSync(join(home, "Library", "LaunchAgents", "com.scintilla.night-reload.plist")), false, "install switches nothing on");
  assert.equal(existsSync(join(home, "launchctl.txt")), false, "install does not talk to the timetable at all");
  assert.match(inst.stdout, /Nothing is switched on/);
  assert.match(readFileSync(join(dest, "config.env"), "utf8"), /^RESTART_APPS=yes$/m);
  const back = spawnSync("/bin/bash", [join(dest, "rollback.sh"), "--reload-only"], { env, encoding: "utf8" });
  assert.equal(back.status, 0, back.stderr);
  const conf = readFileSync(join(dest, "config.env"), "utf8");
  assert.match(conf, /^RESTART_APPS=no$/m); assert.doesNotMatch(conf, /^RESTART_APPS=yes$/m);
  assert.match(back.stdout, /no longer closes any app/);
  assert.equal(existsSync(join(home, "launchctl.txt")), false, "--reload-only leaves the timetable as it is");
  assert.ok(existsSync(join(dest, "night-reload.sh")), "and deletes nothing");
  const on = spawnSync("/bin/bash", [join(dest, "rollback.sh"), "--restart-on"], { env, encoding: "utf8" });
  assert.equal(on.status, 0); assert.match(readFileSync(join(dest, "config.env"), "utf8"), /^RESTART_APPS=yes$/m);
});

test("the supervised test says what Alan should see - on success and on failure - before it does anything, and can be read without running it", () => {
  const home = mkdtempSync(join(tmpdir(), "nr2-home-"));
  const r = spawnSync("/bin/bash", [join(KIT, "supervised-test.sh"), "--explain"], { env: { PATH, HOME: home }, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  for (const want of [/WHAT YOU SHOULD SEE IF IT WORKS/, /TradingView closes/, /the Hub .* closes/i, /Option\+Shift\+S/, /IF IT DOES NOT WORK/, /hands off the keyboard and mouse/i, /Chrome/])
    assert.match(r.stdout, want);
  assert.doesNotMatch(r.stdout, /SIGTERM|RSS|pid\b/, "plain words only");
  const noKit = spawnSync("/bin/bash", [join(KIT, "supervised-test.sh"), "--yes"], { env: { PATH, HOME: home }, encoding: "utf8" });
  assert.notEqual(noKit.status, 0, "without an installed kit it stops");
  assert.match(noKit.stdout + noKit.stderr, /install\.sh/);
});

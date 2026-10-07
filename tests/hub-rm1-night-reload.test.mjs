/* RM1 (7 Oct 2026) — THE NIGHT RELOAD, and the two rules it stands beside.
   ============================================================================
   Alan, 7 Oct: "When I leave Scintilla open and the Station open, it takes a lot of RAM in Activity Monitor
   after a while. When I quit and come back, it's perfectly fine… at least a calendar of overnight quitting
   and restarting would be nice."
   The stopgap is a new schedule, so it is tested TOGETHER with its neighbours (Alan, 3 Oct: "something
   always new from one new rule bites us later"): K3's quiet-time self-update decides whether the page may
   reload at all, and the night rule only decides whether tonight's reload is due.
   Everything here is decided without a browser; the headless proof that a reload keeps the room, the list,
   the open company and the scroll is in deliverables/20261007/rm1-memory/. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const constLine = (name) => page.match(new RegExp("^const " + name + " = [^\\n]*\\n", "m"))[0];
const fn = (name) => { const s = page.search(new RegExp("^function " + name + "\\b", "m")); assert.ok(s >= 0, name + " is declared with `function` at column 0"); return page.slice(s, page.indexOf("\n}\n", s) + 3); };
const src = constLine("HUB_SELF_UPDATE_IDLE_MS") + constLine("HUB_SELF_UPDATE_EVERY_MS") + constLine("HUB_NIGHT_RELOAD_DEFAULT_ON") +
  constLine("HUB_NIGHT_RELOAD_RULE") + constLine("HUB_KEEP_PLACE_MAX_MS") +
  fn("hubSelfUpdatePlan") + fn("hubNightReloadDue") + fn("hubNightReloadSwitch") + fn("hubPlaceKept") + fn("hubNightHold") +
  "return { hubSelfUpdatePlan, hubNightReloadDue, hubNightReloadSwitch, hubPlaceKept, hubNightHold, HUB_NIGHT_RELOAD_RULE, HUB_NIGHT_RELOAD_DEFAULT_ON, HUB_KEEP_PLACE_MAX_MS, HUB_SELF_UPDATE_IDLE_MS, HUB_SELF_UPDATE_EVERY_MS };";
const { hubSelfUpdatePlan, hubNightReloadDue, hubNightReloadSwitch, hubPlaceKept, hubNightHold, HUB_NIGHT_RELOAD_RULE: RULE, HUB_NIGHT_RELOAD_DEFAULT_ON,
  HUB_KEEP_PLACE_MAX_MS, HUB_SELF_UPDATE_IDLE_MS, HUB_SELF_UPDATE_EVERY_MS } = new Function(src)();
const H = 3600000;

test("the rule is 3 to 5 in the morning, after four hours open; thirty hours open is overdue", () => {
  assert.deepEqual({ ...RULE }, { fromHour: 3, toHour: 5, minOpenMs: 4 * H, overdueMs: 30 * H });
  assert.equal(HUB_NIGHT_RELOAD_DEFAULT_ON, true);
});

test("due only in the night hours, and only for a page that has been open a while", () => {
  assert.equal(hubNightReloadDue(true, 5 * H, 3, RULE).due, true, "3 am, open five hours");
  assert.equal(hubNightReloadDue(true, 5 * H, 4, RULE).due, true, "4 am");
  assert.equal(hubNightReloadDue(true, 5 * H, 5, RULE).due, false, "5 am is past the window");
  assert.equal(hubNightReloadDue(true, 5 * H, 2, RULE).due, false, "2 am is before it");
  assert.equal(hubNightReloadDue(true, 5 * H, 14, RULE).due, false, "never in the working day");
  assert.equal(hubNightReloadDue(true, 3 * H, 3, RULE).due, false, "opened at midnight: left alone tonight");
  assert.equal(hubNightReloadDue(true, 0, 4, RULE).due, false, "a page that has just loaded is never due - this is what makes it once a night");
});

test("a Mac that slept through its night still gets its reload, at any hour, once thirty hours old", () => {
  assert.equal(hubNightReloadDue(true, 29 * H, 14, RULE).due, false);
  assert.equal(hubNightReloadDue(true, 30 * H, 14, RULE).due, true);
  assert.match(hubNightReloadDue(true, 31 * H, 9, RULE).why, /slept/);
});

test("switched off is off, whatever the clock says", () => {
  for (const hour of [0, 3, 4, 12, 23]) for (const open of [0, 5 * H, 40 * H])
    assert.deepEqual(hubNightReloadDue(false, open, hour, RULE), { due: false, why: "switched off" });
});

test("the switch: the address says it once and the browser remembers; nothing said means on", () => {
  assert.deepEqual(hubNightReloadSwitch("?nightreload=0", null, true), { on: false, remember: "0" });
  assert.deepEqual(hubNightReloadSwitch("?a=1&nightreload=1", "0", true), { on: true, remember: "1" }, "the address wins over what was remembered");
  assert.deepEqual(hubNightReloadSwitch("", "0", true), { on: false, remember: null }, "remembered off stays off");
  assert.deepEqual(hubNightReloadSwitch("", "1", false), { on: true, remember: null });
  assert.deepEqual(hubNightReloadSwitch("", null, true), { on: true, remember: null }, "the default");
  assert.deepEqual(hubNightReloadSwitch("?nightreloads=0", null, true), { on: true, remember: null }, "another parameter is not this one");
});

/* ---- with its neighbours ------------------------------------------------------------------ */
/* What the page does on each of K3's three-minute checks, written out as the page writes it. */
const CLEAR = { playerOpen: false, playerState: -1, sectionFull: false, browserFull: false, overlay: false };
const decide = ({ seen, etag, ok, idleMs, video, typing, on, openMs, hour, up = CLEAR }) => {
  const plan = hubSelfUpdatePlan(seen, etag, idleMs, video, typing);
  if (plan.adopt) return "adopt";
  if (plan.reload) return "reload: new build";
  if (ok && hubNightReloadDue(on, openMs, hour, RULE).due && hubSelfUpdatePlan("open", "night", idleMs, video, typing).reload && !hubNightHold(up)) return "reload: night";
  return "nothing";
};
const quiet = { seen: "v1", etag: "v1", ok: true, idleMs: 10 * 60000, video: false, typing: false, on: true, openMs: 8 * H, hour: 3 };

test("the page's own wiring is the decision tested here", () => {
  const k3 = page.slice(page.indexOf("/* K3 — QUIET-TIME SELF-UPDATE."));
  assert.match(k3, /const plan = hubSelfUpdatePlan\(SC_ETAG_SEEN, etag, Date\.now\(\) - lastActive, videoPlaying, typing\);\n\s+if \(plan\.adopt\) SC_ETAG_SEEN = etag;\n\s+else if \(plan\.reload\) location\.reload\(\);/,
    "K3's own three lines are exactly as they were");
  assert.match(k3, /else if \(r\.ok && hubNightReloadDue\(HUB_NIGHT_RELOAD_ON, Date\.now\(\) - HUB_LOADED_AT, new Date\(\)\.getHours\(\), HUB_NIGHT_RELOAD_RULE\)\.due &&\s+hubSelfUpdatePlan\("open", "night", Date\.now\(\) - lastActive, videoPlaying, typing\)\.reload && !hubNightHoldNow\(\)\) \{\s+hubKeepPlace\(\); location\.reload\(\);/,
    "the night reload: server answered, due, K3's rule allows it, and nothing is open over the page; the place is kept first");
  assert.equal((page.match(/setInterval\(\(\) => \{\s+try \{\s+fetch\("\/", \{ method: "HEAD", cache: "no-store" \}\)/g) || []).length, 1, "no second poll was added: it rides K3's");
});

test("a quiet night: it reloads; a new build at the same moment takes its own path", () => {
  assert.equal(decide(quiet), "reload: night");
  assert.equal(decide({ ...quiet, etag: "v2" }), "reload: new build");
  assert.equal(decide({ ...quiet, seen: null }), "adopt", "the first sample is adopted, as before");
});

test("the night reload never happens where K3 would not reload: in use, a video playing, typing", () => {
  for (const idleMs of [0, 60000, HUB_SELF_UPDATE_IDLE_MS - 1, HUB_SELF_UPDATE_IDLE_MS, 10 * 60000])
    for (const video of [false, true]) for (const typing of [false, true]) {
      const k3Would = hubSelfUpdatePlan("v1", "v2", idleMs, video, typing).reload;
      assert.equal(decide({ ...quiet, idleMs, video, typing }) === "reload: night", k3Would,
        `idle ${idleMs} ms, video ${video}, typing ${typing}: the same answer K3 gives for a new build`);
    }
  assert.equal(decide({ ...quiet, video: true }), "nothing", "a video being watched is never cut off");
  assert.equal(decide({ ...quiet, typing: true }), "nothing");
  assert.equal(decide({ ...quiet, idleMs: 30000 }), "nothing", "a hand on the page thirty seconds ago");
});

test("the server must have just answered: a Hub is never reloaded into an error page", () => {
  assert.equal(decide({ ...quiet, ok: false, etag: null }), "nothing");
  assert.equal(decide({ ...quiet, ok: false }), "nothing");
});

test("one night, one reload: three days of three-minute checks on a Hub nobody touches", () => {
  /* the page is loaded at 09:00 on day one and checked every HUB_SELF_UPDATE_EVERY_MS; a reload starts it again */
  let loadedAt = 9 * H; const reloads = [];
  for (let now = 9 * H; now < 9 * H + 72 * H; now += HUB_SELF_UPDATE_EVERY_MS) {
    const hour = Math.floor(now / H) % 24;
    if (decide({ ...quiet, openMs: now - loadedAt, hour }) === "reload: night") { reloads.push(now); loadedAt = now; }
  }
  assert.equal(reloads.length, 3, "three nights, three reloads");
  for (const at of reloads) assert.equal(Math.floor(at / H) % 24, 3, "each at the first check after 3 am");
});

test("a MacBook asleep every night from 23:00 to 08:00 reloads once it is thirty hours old, then waits again", () => {
  let loadedAt = 9 * H; const reloads = [];
  for (let now = 9 * H; now < 9 * H + 96 * H; now += HUB_SELF_UPDATE_EVERY_MS) {
    const hour = Math.floor(now / H) % 24;
    if (hour >= 23 || hour < 8) continue;                                  // asleep: no timers fire
    if (decide({ ...quiet, openMs: now - loadedAt, hour }) === "reload: night") { reloads.push(now - loadedAt); loadedAt = now; }
  }
  assert.ok(reloads.length >= 2 && reloads.length <= 3, "about one every day and a quarter");
  for (const open of reloads) assert.ok(open >= 30 * H && open < 30 * H + 10 * H, "never before thirty hours");
});

test("it waits for what K3 cannot see: the Hub's own video player, a full-screen section, anything open over the page", () => {
  assert.equal(hubNightHold(CLEAR), "", "nothing up: no hold");
  assert.match(hubNightHold({ ...CLEAR, playerOpen: true }), /video player/, "the player is open, even paused");
  assert.match(hubNightHold({ ...CLEAR, playerState: 1 }), /video player/, "playing");
  assert.match(hubNightHold({ ...CLEAR, playerState: 3 }), /video player/, "buffering");
  assert.equal(hubNightHold({ ...CLEAR, playerState: 2 }), "", "a player that was closed while paused holds nothing");
  assert.equal(hubNightHold({ ...CLEAR, playerState: 0 }), "", "nor one that ended");
  assert.match(hubNightHold({ ...CLEAR, sectionFull: true }), /full screen/);
  assert.match(hubNightHold({ ...CLEAR, browserFull: true }), /full screen/, "a browser cannot be put back in full screen without a hand");
  assert.match(hubNightHold({ ...CLEAR, overlay: true }), /open over the page/);
  for (const up of [{ playerOpen: true }, { playerState: 1 }, { sectionFull: true }, { browserFull: true }, { overlay: true }])
    assert.equal(decide({ ...quiet, up: { ...CLEAR, ...up } }), "nothing", JSON.stringify(up) + ": the night reload waits");
  assert.equal(decide({ ...quiet, etag: "v2", up: { ...CLEAR, overlay: true } }), "reload: new build", "K3 itself is not changed by the hold");
});

test("the hold reads the page's own state: the player, the full-screen section, the open panels", () => {
  const now = fn("hubNightHoldNow");
  for (const piece of ["YT_PLYR.getPlayerState()", "YT_IDX >= 0", "!!SECFS", "document.fullscreenElement", '"tvmodal-open"', "GPOP_T", '"trFullHost"', '"ernSumHost"', 'open("chatPop", "open")',
    'open("alertPanel", "is-open")', 'open("fViewer", "on")', 'el("tvModal")', ".sc-cohwrap.is-open"])
    assert.ok(now.includes(piece), piece + " is looked at");
  assert.doesNotMatch(now, /fetch\(|localStorage|sessionStorage/, "it only looks; it keeps and sends nothing");
});

/* ---- the place that is kept --------------------------------------------------------------- */
test("a kept place is read back only if it is fresh and plain", () => {
  const now = 1_800_000_000_000;
  const saved = { at: now - 5000, sec: "NEWS", coh: "LIKED", pinned: "NVDA", expanded: true, socTab: "YOUTUBE", sentiTab: "GAUGE", econView: "REGIME",
    pageY: 240, scroll: [["#board", 1200, 0], ["#leftBody > div:nth-of-type(2)", 80, 0]] };
  assert.deepEqual(hubPlaceKept(saved, now), { sec: "NEWS", coh: "LIKED", pinned: "NVDA", expanded: true, socTab: "YOUTUBE", sentiTab: "GAUGE", econView: "REGIME",
    pageY: 240, scroll: [["#board", 1200, 0], ["#leftBody > div:nth-of-type(2)", 80, 0]] });
  assert.equal(hubPlaceKept({ ...saved, at: now - HUB_KEEP_PLACE_MAX_MS }, now), null, "two minutes old: it belongs to an earlier load");
  assert.equal(hubPlaceKept(null, now), null);
  assert.equal(hubPlaceKept("NEWS", now), null);
  assert.equal(hubPlaceKept({ sec: "NEWS" }, now), null, "no time on it: dropped");
});

test("a kept place cannot carry anything but short plain names into a selector", () => {
  const now = 1_800_000_000_000;
  const odd = hubPlaceKept({ at: now, sec: 'NEWS"],[x', coh: "LIKED] , body", pinned: "BRK.B", expanded: "yes", socTab: 7, sentiTab: "", econView: "A".repeat(40),
    pageY: -5, scroll: [["#a", 0, 0], "nope", ["#b", 10], [42, 10, 0], ["#" + "c".repeat(400), 10, 0]].concat(Array.from({ length: 40 }, (_, i) => ["#p" + i, 5, 0])) }, now);
  assert.equal(odd.sec, null); assert.equal(odd.coh, null); assert.equal(odd.pinned, "BRK.B", "a dotted ticker is a plain name");
  assert.equal(odd.expanded, false); assert.equal(odd.socTab, null); assert.equal(odd.sentiTab, null); assert.equal(odd.econView, null);
  assert.equal(odd.pageY, 0);
  assert.ok(odd.scroll.length <= 16, "at most sixteen panels");
  assert.deepEqual(odd.scroll[0], ["#b", 10, 0], "a panel that was not scrolled, a row that is not a row and an address that is not text are dropped");
});

test("the place is restored by pressing the Hub's own controls, and kept in this window only", () => {
  const block = page.slice(page.indexOf("function hubRestorePlace()"), page.indexOf("/* R19 — PWA SELF-UPDATE"));
  for (const control of ['[data-act="coh"][data-key="', '[data-act="mtab"][data-sec="', '[data-act="soctab"][data-tab="', '[data-act="sentitab"][data-tab="', '[data-act="ecview"][data-v="', '[data-act="coexpand"]'])
    assert.ok(block.includes(control), control + " is pressed, not re-implemented");
  assert.match(block, /openCo\(kept\.pinned\)/, "the open company comes back through openCo, like a click on its row");
  assert.match(block, /if \(home && S\.sec !== "DASHBOARD" && S\.sec !== "COMPANY"\) press\('\[data-act="mtab"\]\[data-sec="DASHBOARD"\]'\);/, "a #room in the address does not take the dashboard's place");
  assert.match(block, /sessionStorage\.removeItem\(HUB_KEEP_PLACE_KEY\)/, "used once");
  const keep = page.slice(page.indexOf("function hubKeepPlace()"), page.indexOf("function hubRestorePlace()"));
  assert.match(keep, /sessionStorage\.setItem\(HUB_KEEP_PLACE_KEY/); assert.doesNotMatch(keep, /localStorage/, "nothing about a place outlives the window");
  assert.doesNotMatch(keep + block, /fetch\(|operatorWrite|\.insert\(|\.upsert\(/, "keeping a place never talks to the server");
});

test("a panel is put back when it is long enough, again if a late repaint moves it, and never once a hand touches the page", () => {
  const block = page.slice(page.indexOf("function hubRestorePlace()"), page.indexOf("/* R19 — PWA SELF-UPDATE"));
  assert.match(block, /if \(touched \|\| !n \|\| !\(n\.scrollHeight - n\.clientHeight >= it\.top && n\.scrollWidth - n\.clientWidth >= it\.x\)\) continue;/, "only a panel long enough to be there, and only while nobody has touched the page");
  assert.match(block, /if \(Math\.abs\(n\.scrollTop - it\.top\) > 2 \|\| Math\.abs\(n\.scrollLeft - it\.x\) > 2\) \{ n\.scrollTop = it\.top; n\.scrollLeft = it\.x; it\.heldAt = now; \}/, "moved by a repaint: put back, and the 8 s start again");
  assert.match(block, /if \(touched \|\| \+\+tries >= 120 \|\| left\.every\(\(it\) => it\.heldAt && now - it\.heldAt >= 8000\)\) \{\n\s+clearInterval\(timer\);/, "it ends: a touch, a minute, or every panel still for 8 s");
  assert.match(block, /const kinds = \["pointerdown", "wheel", "keydown", "touchstart"\];/);
  assert.match(block, /kinds\.forEach\(\(kind\) => \{ try \{ window\.removeEventListener\(kind, touch, \{ capture: true \}\); \} catch \(_\) \{\} \}\);/, "and takes its own listeners away when it does");
});

test("R19 and K3 are as they were: the resume check and the quiet poll", () => {
  assert.match(page, /if \(et && SC_ETAG_SEEN && et !== SC_ETAG_SEEN\) \{ location\.reload\(\); return; \}/, "R19");
  assert.match(page, /\}, HUB_SELF_UPDATE_EVERY_MS\);/, "K3's cadence");
  assert.equal(HUB_SELF_UPDATE_IDLE_MS, 120000); assert.equal(HUB_SELF_UPDATE_EVERY_MS, 180000);
});

// HC1 — the FAVORITES walk: add CRWD, NET, OKTA and EQIX to ★ FAVORITES from SEARCH and from the BOARD STAR, three times over:
//   before    the Hub as deployed today, the list table following today's rule (64 names at most)
//   after     this branch's page, the same rule                → the refusal is said in words
//   after256  this branch's page, the rule as the coordinator set it on 6 Oct ~19:40 ET (256) → the names stick, and survive a reload
// Headless; no request other than a GET leaves the browser; the list table is the stand-in of rig.mjs (a copy, read by GET).
//   node deliverables/20261006/hc1-compare-one-screen/tools/favorites-walk.mjs [before|after|after256] [1680|390]
import fs from "fs";
import path from "path";
import { openHub, standInLists, sleep, D, REPO, sha12 } from "./rig.mjs";

const WHICH = process.argv[2] || "before", W = +(process.argv[3] || 1680);
const NAMES = ["CRWD", "NET", "OKTA", "EQIX"];
const SHOTS = path.join(D, "shots"), OUT = path.join(D, "data", `favorites-walk-${WHICH}-${W}.json`);
fs.mkdirSync(SHOTS, { recursive: true });
const lists = standInLists({ cap: WHICH === "after256" ? 256 : 64 });
const h = await openHub({ width: W, local: WHICH === "before" ? null : REPO, lists });
const { page, count } = h;
const rec = { which: WHICH, width: W, at: new Date().toISOString(), rule: "positions 1–" + lists.getCap(), steps: [] };
const shot = async (name, clip) => { const f = `fav-${WHICH}-${W}-${name}.png`; await page.screenshot({ path: path.join(SHOTS, f), ...(clip ? { clip } : {}) }); return f; };
const state = (t) => page.evaluate((t) => {
  const b = Array.from(document.querySelectorAll('.sc-lst--favorites[data-t="' + t + '"]')).filter((x) => x.offsetParent !== null)[0];
  const n = document.getElementById("listNote");
  return { onScreenStar: b ? b.classList.contains("is-on") : null, inPageList: LISTS.favorites.includes(t), pageListN: LISTS.favorites.length, liked: S.fav.includes(t),
    line: n && !n.hidden ? (n.querySelector(".sc-listnote__t") || n).textContent : null, tabCount: (document.querySelector(".sc-cohgeiger__hd, .sc-cg__hd") || {}).textContent || null };
}, t);
const rowClip = async (t) => page.evaluate((t) => {
  const b = Array.from(document.querySelectorAll('.sc-lst--favorites[data-t="' + t + '"]')).filter((x) => x.offsetParent !== null)[0];
  if (!b) return null; const row = b.closest(".sc-board__row") || b.parentElement; const z = +getComputedStyle(document.body).zoom || 1;
  const r = row.getBoundingClientRect(); return { x: Math.max(0, r.x - 6), y: Math.max(0, r.y - 44), width: Math.min(innerWidth - Math.max(0, r.x - 6), r.width + 12), height: r.height + 90, zoom: z };
}, t);
/* the header's search box folds away when the pointer leaves it; ⌕ opens it again (pressing ⌕ while it is open would clear it) */
async function searchBox() {
  if (!(await page.locator("#cohSearchInput").isVisible())) { await page.click("#headSearchBtn"); await page.waitForSelector("#cohSearchInput", { state: "visible", timeout: 8000 }); }
}
async function search(t) {
  await searchBox();
  await page.fill("#cohSearchInput", "");
  await page.fill("#cohSearchInput", t);
  await page.waitForFunction((t) => Array.from(document.querySelectorAll('.sc-board__row .sc-lst--favorites[data-t="' + t + '"]')).some((x) => x.offsetParent !== null), t, { timeout: 20000 });
  await sleep(900);
}
async function clearSearch() { await searchBox(); await page.fill("#cohSearchInput", ""); await sleep(1200); }
async function tapStar(t) { await page.click('.sc-board__row .sc-lst--favorites[data-t="' + t + '"]', { timeout: 15000 }); await sleep(120); }

try {
  rec.pageSha = await page.evaluate(async () => { const b = await (await fetch(location.href)).arrayBuffer(); const d = await crypto.subtle.digest("SHA-256", b); return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 12); });
  await page.waitForFunction(() => typeof LISTS_READ !== "undefined" && LISTS_READ && document.querySelectorAll(".sc-board__row").length > 5, null, { timeout: 90000 });
  await sleep(6000);
  rec.start = await page.evaluate(() => ({ coh: S.coh, favorites: LISTS.favorites.length, radar: LISTS.radar.length, liked: S.fav.length, last: LISTS.favorites[LISTS.favorites.length - 1] }));
  rec.startShot = await shot("0-start");

  /* A — FROM SEARCH: type the name, tap its ☆, look again, clear the search, search again */
  for (const t of NAMES.slice(0, W < 500 ? 0 : 4)) {
    const s = { name: t, from: "search" };
    await search(t);
    s.before = await state(t);
    await tapStar(t);
    s.atTap = await state(t);
    s.shotAtTap = await shot(`search-${t}-1-at-tap`);
    await sleep(3500);
    s.settled = await state(t);
    s.shotSettled = await shot(`search-${t}-2-settled`);
    await clearSearch(); await search(t);
    s.searchedAgain = await state(t);
    s.shotAgain = await shot(`search-${t}-3-searched-again`);
    s.stored = lists.list("favorites").includes(t);
    rec.steps.push(s);
    await clearSearch();
    if (WHICH === "after256") {                                   // take it off again so the board-star pass starts from the same 64
      await search(t); await tapStar(t); await sleep(2500); await clearSearch();
      s.takenOffAgain = !lists.list("favorites").includes(t);
    }
  }

  /* B — FROM THE BOARD STAR: the ♥ LIKED tab (all four are liked — the ☆ tap itself liked them), tap the row's ☆ */
  if (W >= 500) {
    await page.click('[data-act="coh"][data-key="FAV"]'); await sleep(5000);
    for (const t of NAMES) {
      const s = { name: t, from: "board star (♥ LIKED tab)" };
      const sel = '.sc-board__row .sc-lst--favorites[data-t="' + t + '"]';
      await page.waitForSelector(sel, { timeout: 30000 });
      await page.locator(sel).first().scrollIntoViewIfNeeded();
      s.before = await state(t);
      await tapStar(t);
      s.atTap = await state(t);
      s.shotAtTap = await shot(`board-${t}-1-at-tap`);
      await sleep(3500);
      s.settled = await state(t);
      s.shotSettled = await shot(`board-${t}-2-settled`);
      s.stored = lists.list("favorites").includes(t);
      rec.steps.push(s);
    }
  }

  /* C — THE PHONE: board rows carry only ♥ there; ★ lives in the company view. Open EQIX and tap its ★. */
  if (W < 500) {
    for (const t of ["EQIX", "CRWD"]) {
      const s = { name: t, from: "company view ★ (phone)" };
      await page.evaluate((t) => openCo(t), t);
      const sel = '.cv-facts .sc-lst--favorites[data-t="' + t + '"], #coLists .sc-lst--favorites[data-t="' + t + '"]';
      await page.waitForFunction((sel) => Array.from(document.querySelectorAll(sel)).some((x) => x.offsetParent !== null), sel, { timeout: 30000 });
      await sleep(2500);
      const b = page.locator(sel).filter({ visible: true }).first();
      await b.scrollIntoViewIfNeeded();
      s.before = await state(t);
      await b.click();
      s.atTap = await state(t);
      s.shotAtTap = await shot(`phone-${t}-1-at-tap`);
      await sleep(3500);
      s.settled = await state(t);
      s.shotSettled = await shot(`phone-${t}-2-settled`);
      s.stored = lists.list("favorites").includes(t);
      rec.steps.push(s);
    }
  }

  /* D — A RELOAD: what the next visit shows */
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof LISTS_READ !== "undefined" && LISTS_READ && document.querySelectorAll(".sc-board__row").length > 5, null, { timeout: 90000 });
  await sleep(5000);
  rec.afterReload = await page.evaluate((names) => ({ favorites: LISTS.favorites.length, has: Object.fromEntries(names.map((t) => [t, LISTS.favorites.includes(t)])), tail: LISTS.favorites.slice(-5) }), NAMES);
  rec.reloadShot = await shot("9-after-reload");
} catch (e) { rec.error = String(e && e.stack || e).slice(0, 900); console.error(rec.error); }
finally {
  rec.storedFavorites = lists.list("favorites").length; rec.storedTail = lists.list("favorites").slice(-6);
  rec.listTable = lists.log;
  rec.requests = { stoppedNonGet: count.blocked, stoppedWhat: Array.from(new Set(count.blockedList)), listTableAnsweredHere: count.answeredHere, branchFilesServed: count.servedLocal };
  rec.consoleErrors = count.consoleErrors.filter((x) => /list write failed|station_lists/.test(x)).slice(0, 12);
  rec.localIndexSha = WHICH === "before" ? null : sha12(fs.readFileSync(path.join(REPO, "index.html")));
  fs.writeFileSync(OUT, JSON.stringify(rec, null, 1));
  await h.close();
}
const t = rec.steps.map((s) => `${s.from.slice(0, 12).padEnd(12)} ${s.name.padEnd(5)} tap:${s.atTap && s.atTap.onScreenStar} settled:${s.settled && s.settled.onScreenStar} stored:${s.stored} line:${s.settled && s.settled.line ? JSON.stringify(s.settled.line.slice(0, 70)) : "—"}`);
console.log([`${WHICH} @${W} page ${rec.pageSha} rule ${rec.rule}`, ...t, `reload: ${JSON.stringify(rec.afterReload)}`, `stopped non-GET: ${count.blocked} ${JSON.stringify(rec.requests.stoppedWhat)} · list table answered here: ${count.answeredHere}`, rec.error ? "ERROR " + rec.error.slice(0, 300) : "ok"].join("\n"));

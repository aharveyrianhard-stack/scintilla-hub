/* X1 (2 Oct) — the inventory, measured from the LIVE Hub. HEADLESS ONLY (never a window on Alan's screen).
   The page is https://scintillahub.ai/ exactly as deployed; every read goes to the live services; EVERY non-GET
   request is aborted, so nothing here can write a like, a list, a setting or a row. Each control of the right
   panel (COHORT COMPARE · MAP · ROTATION · RELATIVE and their sub-selections) and the board's scope tabs is clicked
   in turn and photographed; the page's own header text for each view is recorded beside the picture, and the
   board state (Alan's lists, the rows' Geigers) is dumped once as data for the mock pages.
   usage: node inventory-shots.mjs <width> <outdir>            → <outdir>/<width>-NN-name.png, facts-<width>.json, state-<width>.json */
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const EXE = process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [W, OUT] = process.argv.slice(2);
const width = +W || 1680, phone = width < 600, H = phone ? 844 : 1050;
fs.mkdirSync(OUT, { recursive: true });
const result = { width, at: new Date().toISOString(), url: "https://scintillahub.ai/", blocked: [], errors: [], shots: [] };
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
let n = 0;
try {
  const context = await browser.newContext({ viewport: { width, height: H }, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { result.blocked.push(req.method() + " " + u.host + u.pathname); return route.abort(); }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => result.errors.push(String(e).slice(0, 240)));
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof S !== "undefined" && window.SC_RANK_READY && document.querySelectorAll("#boardPanel .sc-board__row[data-t]").length > 5, null, { timeout: 120000 });
  await sleep(5000);
  /* the board state, once: the data the mock pages are built on */
  const state = await page.evaluate(() => {
    const rows = (S.rows || []).map((r) => ({ t: r.t, name: r.name || null, g: r.g ?? null, tr: r.tr ?? null, mo: r.mo ?? null, chg: r.chg ?? null, price: r.price ?? null, rv: r.rv ?? null, state: r.state || null }));
    const coh = {}; if (typeof COHSETS !== "undefined" && COHSETS) for (const k in COHSETS) coh[k] = Array.from(COHSETS[k]);
    const gc = {}; if (typeof GCOMP !== "undefined") for (const k in GCOMP) gc[k] = GCOMP[k];
    return { coh_active: S.coh, liked: S.fav.slice(), lists: typeof LISTS !== "undefined" ? LISTS : null, rows, rows_n: rows.length,
      cohsets: coh, gcomp: gc, gcomp_n: Object.keys(gc).length, cohorts: typeof COHORTS !== "undefined" ? COHORTS : null,
      l0: { tab: LAYER0_TAB, tf: L0_TF, map_mode: L0_MAP_MODE, heat_mode: HEAT_MODE, rel_i: L0_REL_I, cmp_mode: window.SC_CMP_MODE, sect_family: window.SECT_FAMILY,
            tabs: L0_TABS, tf_def: L0_TF_DEF, rel_win: L0_REL_WIN, map_modes: L0_MAP_MODES, map_tip: L0_MAP_TIP, sectors: L0_SECTORS, families: window.SECT_FAMILIES, index_funds: window.SC_INDEX_FUNDS },
      scope_tabs: [...document.querySelectorAll('#cohTabsHead .sc-coh')].map((b) => ({ key: b.dataset.key, label: b.textContent.trim(), active: b.classList.contains("is-active") })) };
  });
  fs.writeFileSync(OUT + "/state-" + width + ".json", JSON.stringify(state, null, 1));
  const facts = () => page.evaluate(() => {
    const q = (s) => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, " ").trim() : null; };
    return { tab: LAYER0_TAB, tf: L0_TF, map_mode: L0_MAP_MODE, heat_mode: HEAT_MODE, cmp_mode: window.SC_CMP_MODE, sect_family: window.SECT_FAMILY, scope: S.coh, sec: S.sec,
      tabs_row: q("#layer0 .sc-soctabs"), ctl_row: q("#l0ctl"), view_head: q("#l0body .sc-heathead__lbl") || q("#l0body .sc-cohstrip__hd"),
      strip_cols: document.querySelectorAll("#l0body .sc-cohstrip__col").length, tiles: document.querySelectorAll("#l0body .sc-heattile").length, cards: document.querySelectorAll("#l0body .sc-l0card").length,
      canvas: [...document.querySelectorAll("#l0body canvas")].map((c) => c.id + " " + c.width + "x" + c.height), note: q("#l0body .sc-l0note"),
      board_head: q("#cohTabsHead"), board_rows: document.querySelectorAll("#boardPanel .sc-board__row[data-t]").length, cohgeiger: q("#cohGeiger .sc-cohgeiger__hd") };
  });
  const shot = async (name, sel, extra) => {
    const box = await page.evaluate((s) => { const b = document.querySelector(s); if (!b) return null; const r = b.getBoundingClientRect(); return { x: Math.max(0, r.left), y: Math.max(0, r.top), w: Math.min(r.width, innerWidth - Math.max(0, r.left)), h: Math.min(r.height, innerHeight - Math.max(0, r.top)) }; }, sel);
    await sleep(500);
    const file = width + "-" + String(++n).padStart(2, "0") + "-" + name + ".png";
    if (box && box.w > 20 && box.h > 20) await page.screenshot({ path: OUT + "/" + file, clip: { x: box.x, y: box.y, width: box.w, height: box.h } });
    else await page.screenshot({ path: OUT + "/" + file });
    const f = await facts(); result.shots.push({ file, sel, box, ...f, ...(extra || {}) }); console.log(file, JSON.stringify({ head: f.view_head, ctl: f.ctl_row, cols: f.strip_cols, tiles: f.tiles, cards: f.cards, canvas: f.canvas, note: f.note }));
  };
  const click = async (sel, wait = 1200) => { const ok = await page.evaluate((s) => { const b = document.querySelector(s); if (!b) return false; b.click(); return true; }, sel); if (!ok) result.errors.push("no element " + sel); await sleep(wait); return ok; };
  const hoverCentre = async () => { const c = await page.evaluate(() => { const e = document.querySelector("#l0body canvas, #l0body .sc-l0tilt"); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width * 0.42, y: r.top + r.height * 0.5 }; }); if (c) { await page.mouse.move(c.x, c.y); await sleep(700); } };
  const waitSeries = async () => { try { await page.waitForFunction(() => !document.querySelector("#l0body .sc-l0note") || /unavailable/.test(document.querySelector("#l0body .sc-l0note").textContent), null, { timeout: 45000 }); } catch (_) {} await sleep(1500); };

  /* 0 · the whole dashboard as it opens */
  await page.screenshot({ path: OUT + "/" + width + "-00-dashboard-open.png" }); result.shots.push({ file: width + "-00-dashboard-open.png", ...(await facts()) });
  /* 1 · the board's scope tabs */
  await shot("board-scope-strip", "#cohTabsHead");
  for (const k of ["RADAR", "FAVORITES", "FAV", "ALL", "AI_HARDWARE"]) { await click('#cohTabsHead .sc-coh[data-key="' + k + '"]', 2500); await shot("board-scope-" + k, "#boardPanel"); }
  await click('#cohTabsHead .sc-coh[data-key="FAV"]', 2000);
  /* 2 · COHORT COMPARE and its modes */
  await click('#layer0 .sc-soctab[data-tab="COHORT"]');
  await shot("cohort-compare-COHORTS", "#layer0");
  await click('[data-gwxcmp="SECTORS"]');
  for (const f of ["SPDR", "ISHARES", "VANGUARD", "EQWT", "INDEXES", "BOWTIE", "MEMBERS"]) { await click('[data-gwxfam="' + f + '"]'); await shot("cohort-compare-SECTORS-" + f, "#layer0"); }
  await click('[data-gwxfam="SPDR"]'); await click('[data-gwxcmp="COHORTS"]');
  /* 3 · MAP, its TF row and its six modes (GRID with its three fills) */
  await click('#layer0 .sc-soctab[data-tab="MAP"]', 2500);
  for (const m of ["GRID"]) { await click('[data-act="l0fmode"][data-m="' + m + '"]'); for (const hm of ["GRAIN", "FILL", "LEVEL"]) { await click('[data-act="heatmode"][data-mode="' + hm + '"]'); await shot("map-GRID-" + hm, "#layer0"); } await click('[data-act="heatmode"][data-mode="GRAIN"]'); }
  for (const m of ["TREEMAP", "FISHEYE", "DOCK", "BUBBLES", "TILT"]) { await click('[data-act="l0fmode"][data-m="' + m + '"]', 1800); await hoverCentre(); await shot("map-" + m, "#layer0"); }
  await click('[data-act="l0fmode"][data-m="GRID"]');
  for (const tf of ["60", "D", "W"]) { await click('[data-act="l0tf"][data-tf="' + tf + '"]', 3500); await shot("map-GRID-tf" + tf, "#layer0"); }
  await click('[data-act="l0tf"][data-tf="240"]', 1500);
  /* 4 · ROTATION: scope follows the board (LIKED here), TF row, the transport */
  await click('#layer0 .sc-soctab[data-tab="ROTATION"]', 1500); await waitSeries(); await shot("rotation-4H-liked", "#layer0");
  await click('[data-act="l0tf"][data-tf="D"]', 1500); await waitSeries(); await shot("rotation-1D-liked", "#layer0");
  await click('[data-act="l0play"]', 1800); await shot("rotation-1D-playing", "#layer0"); await click('[data-act="l0play"]', 500); await click('[data-act="l0live"]', 800);
  await click('#cohTabsHead .sc-coh[data-key="ALL"]', 2500); await waitSeries(); await shot("rotation-1D-ALL-sectors", "#layer0");
  /* 5 · RELATIVE and its windows */
  await click('#layer0 .sc-soctab[data-tab="RELATIVE"]', 1500); await waitSeries(); await shot("relative-1D-3M-ALL-sectors", "#layer0");
  for (const i of [0, 2]) { await click('[data-act="l0rng"][data-i="' + i + '"]', 1200); await shot("relative-1D-win" + i + "-ALL", "#layer0"); }
  await click('[data-act="l0rng"][data-i="1"]', 600);
  await click('#cohTabsHead .sc-coh[data-key="FAVORITES"]', 2500); await waitSeries(); await shot("relative-1D-3M-favorites", "#layer0");
  await click('#layer0 .sc-soctab[data-tab="MAP"]', 2500); await shot("map-GRID-favorites", "#layer0");
  /* 6 · the SCENES room: the same views full width */
  if (!phone) { await page.evaluate(() => { S.sec = "SCENES"; sync(); }); await sleep(3000); await shot("scenes-room", "body"); await page.evaluate(() => { S.sec = "DASHBOARD"; sync(); }); await sleep(1500); }
  await click('#cohTabsHead .sc-coh[data-key="FAV"]', 1500);
} finally {
  await browser.close();
  fs.writeFileSync(OUT + "/facts-" + width + ".json", JSON.stringify(result, null, 1));
  console.log("shots", result.shots.length, "blocked", result.blocked.length, [...new Set(result.blocked)].slice(0, 6).join(" | "), "errors", result.errors.length, result.errors.slice(0, 3).join(" / "));
}

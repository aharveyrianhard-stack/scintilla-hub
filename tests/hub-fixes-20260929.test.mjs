/* 29 Sep — P2-HUB-FIXES: the stuck REGIME view, USUAL DAY, one events structure, the board's columns, the bow tie. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fnSrc = (name) => { const s = page.search(new RegExp("^(async )?function " + name + "\\b", "m")); assert.ok(s >= 0, name); return page.slice(s, page.indexOf("\n}\n", s) + 3); };
const caseSrc = (name) => { const s = page.indexOf('case "' + name + '": {'); assert.ok(s >= 0, name); return page.slice(s, page.indexOf("\n    }\n", s) + 6); };

/* ── 1 · REGIME: always a way back ─────────────────────────────────────────────────────────────── */
function regimeHead(view) {
  const S = { econView: view };
  const f = new Function("S", "SECFS_BTN", fnSrc("econViewTabsHTML") + fnSrc("regimeRoomHTML") + "; return regimeRoomHTML();");
  return f(S, '<button class="sc-fsico" data-act="secfs">⛶</button>');
}

test("REGIME: the header carries ← RELEASES, ✕ CLOSE and the same RELEASES | REGIME switch as RELEASES", () => {
  const h = regimeHead("REGIME");
  assert.match(h, /class="rg-navb" data-act="ecview" data-v="RELEASES"[^>]*><i>←<\/i>RELEASES<\/button>/);
  assert.match(h, /class="rg-navb" data-act="rgclose"[^>]*><i>✕<\/i>CLOSE<\/button>/);
  assert.match(h, /data-act="ecview" data-v="RELEASES" role="button"/, "the switch itself has RELEASES");
  assert.match(h, /class="ec-sp on" data-act="ecview" data-v="REGIME"/);
  assert.match(fnSrc("econRoomHTML"), /econViewTabsHTML\(\) \+ SECFS_BTN/, "RELEASES draws the same switch");
});

test("REGIME: ✕ closes to the dashboard; the ECONOMIC master tab always opens on RELEASES", () => {
  assert.match(page, /case "rgclose": \{ S\.econView = "RELEASES"; go\("DASHBOARD"\); break; \}/);
  assert.match(caseSrc("mtab"), /if \(a\.dataset\.sec === "ECONOMIC"\) S\.econView = "RELEASES";/);
});

test("REGIME: Esc goes back to RELEASES only when nothing else (⛶, an overlay, a text field) owns that Esc", () => {
  const s = page.indexOf("const rgBack = ");
  assert.ok(s > 0);
  const handler = page.slice(page.lastIndexOf('document.addEventListener("keydown"', s), page.indexOf("\n});", s));
  assert.match(handler, /const rgBack = S\.sec === "ECONOMIC" && S\.econView === "REGIME" && !cvKeysBlocked\(e\);/);
  assert.ok(handler.indexOf("const rgBack") < handler.indexOf("clearSecFs()"), "measured before the ⛶ closes, so one Esc = one step");
  assert.match(handler, /if \(rgBack\) \{ S\.econView = "RELEASES"; sync\(\); \}/);
  assert.match(fnSrc("cvKeysBlocked"), /SECFS \|\| document\.fullscreenElement/, "an open ⛶ blocks it");
});

test("REGIME: the back pair is grey (channels within 24, none above 210) and wraps onto its own line on a phone", () => {
  const css = page.slice(page.indexOf(".rg-navb{"), page.indexOf(".rg-navb{") + 900);
  for (const hex of css.match(/#[0-9a-f]{6}/gi) || []) {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(Math.max(...c) - Math.min(...c) <= 24 && Math.max(...c) <= 210, hex);
  }
  assert.match(page, /\.rg-head\{ flex-wrap:wrap; row-gap:6px; \}/);
  assert.match(page, /@media \(max-width:900px\)\{ \.rg-nav\{ flex:1 0 100%; margin-right:0; \} \.rg-navb\{ height:32px; \} \}/);
});

// NR6 (27 Oct 2026) - TradingView comes back on its own layouts.
// When TradingView closes it writes down its windows and their tabs (TVUserStorage/id-*/settings.json) and opens exactly those again.
// On 26 Oct 04:00 and 27 Oct 04:10 it did reopen all three of the iMac's windows, then, three seconds after loading FOCUS (D0N4w0QG),
// it moved that tab itself to the layout the third window was loading (vXFNJ5tr, "combined auto diagonals and pivots"): FOCUS was
// gone, the FOCUS keeper had nothing to put the rotation into, and Alan woke to "something else" in place of his template with no
// play/pause. TradingView still gives the moved tab the boxes it had (its symbols), so that tab can be told from the real one.
//   node tv-layouts.mjs snapshot <TradingView support folder> <out.json>   - right after TradingView closed: what it will open again
//   node tv-layouts.mjs check <snapshot.json> <port> [fix]                  - after it opened again: every tab on its own layout?
// Reads through TradingView's local debug port only (127.0.0.1). "fix" moves back a tab TradingView moved, and nothing else.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const LAYOUT = /\/chart\/([A-Za-z0-9]{8})\//;
// TradingView names the same box differently in its notes and on the chart (NASDAQ:NVDA / BATS:NVDA), so boxes are compared by ticker
export const ticker = (s) => String(s).split("/").map((p) => p.replace(/^[^:]*:/, "")).join("/");
const sameBoxes = (a, b) => a.length > 0 && a.length === b.length && [...a].map(ticker).sort().join("|") === [...b].map(ticker).sort().join("|");

// the tabs TradingView wrote down, window by window (a tab that is not a chart, like an empty new tab, is not counted)
export function savedTabs(settings) {
  const out = [];
  for (const w of (settings && settings.app && settings.app.chartWindows) || []) {
    for (const t of w.tabs || []) {
      const m = LAYOUT.exec(t.url || ""); if (!m) continue;
      out.push({ win: w.persistentId, tab: t.persistentId, layout: m[1], title: t.title || "", syms: ((t.symbol && t.symbol.charts) || []).map((c) => c.symbol) });
    }
  }
  return out;
}

// saved: what TradingView wrote down; open: what its pages show now ({ id, layout, name, syms, unsaved, dialog }).
// 1. a tab is home when a page shows its layout with its boxes; 2. a tab that is not home is the page that carries exactly its boxes under
// another layout - only when exactly one page does; 3. a tab is home when a page shows its layout with other boxes (a rotation moved them).
export function plan(saved, open) {
  const used = new Set(), home = new Set(), out = { ok: [], fix: [], left: [] };
  const take = (s, p) => { used.add(p.id); home.add(s); };
  for (const s of saved) { const p = open.find((q) => !used.has(q.id) && q.layout === s.layout && sameBoxes(q.syms, s.syms)); if (p) { take(s, p); out.ok.push({ ...s, page: p.id }); } }
  for (const s of saved) {
    if (home.has(s)) continue;
    const pages = open.filter((q) => !used.has(q.id) && q.layout !== s.layout && sameBoxes(q.syms, s.syms));
    if (pages.length !== 1) continue;
    const p = pages[0]; take(s, p);
    if (p.unsaved || p.dialog) out.left.push({ ...s, page: p.id, from: p.layout, fromName: p.name, why: p.unsaved ? "that window has unsaved changes" : "that window has a dialog open" });
    else out.fix.push({ ...s, page: p.id, from: p.layout, fromName: p.name });
  }
  for (const s of saved) {
    if (home.has(s)) continue;
    const p = open.find((q) => !used.has(q.id) && q.layout === s.layout);
    if (p) { take(s, p); out.ok.push({ ...s, page: p.id }); continue; }
    const n = open.filter((q) => !used.has(q.id) && sameBoxes(q.syms, s.syms)).length;
    out.left.push({ ...s, why: n > 1 ? `${n} windows show its charts, so it cannot tell which one was moved` : "no window shows it or its charts" });
  }
  // 4. the same move the other way round: a tab that wrote down no boxes (the third window on 27 Oct) moved onto a layout that is already
  // home elsewhere. One tab missing and one second copy of a home layout open: that copy is that tab - nothing else can be.
  const missing = out.left.filter((l) => !l.page && l.why === "no window shows it or its charts");
  const spare = open.filter((q) => !used.has(q.id) && out.ok.some((o) => o.layout === q.layout));
  if (missing.length === 1 && spare.length === 1) {
    const s = missing[0], p = spare[0];
    out.left = out.left.filter((l) => l !== s);
    if (p.unsaved || p.dialog) out.left.push({ ...s, page: p.id, from: p.layout, fromName: p.name, why: p.unsaved ? "that window has unsaved changes" : "that window has a dialog open" });
    else out.fix.push({ ...s, page: p.id, from: p.layout, fromName: p.name });
  }
  return out;
}

const READ = `(() => { try { const a = window.TradingViewApi; if (!a || !a.chartsCount || a.chartsCount() < 1) return null;
  const o = { layout: a.layoutId(), name: a.layoutName(), syms: Array.from({ length: a.chartsCount() }, (_, i) => a.chart(i).symbol()) };
  try { const s = a._saveChartService; o.unsaved = !!(s && s.hasChanges && s.hasChanges()); } catch (e) {}
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  o.dialog = [...document.querySelectorAll('[role="dialog"]')].some(vis); return o; } catch (e) { return null; } })()`;

function cdp(wsUrl, method, params, wait = 15000) {
  return new Promise((res) => {
    let ws; try { ws = new WebSocket(wsUrl); } catch (e) { res(null); return; }
    const to = setTimeout(() => { try { ws.close(); } catch (e) {} res(null); }, wait);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method, params }));
    ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id === 1) { clearTimeout(to); try { ws.close(); } catch (e) {} res(d.result || null); } };
    ws.onerror = () => { clearTimeout(to); res(null); };
  });
}
async function pages(port) {
  let list; try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(5000) })).json(); } catch (e) { return null; }
  const out = [];
  for (const t of list.filter((x) => x.type === "page" && LAYOUT.test(x.url))) {
    const ws = t.webSocketDebuggerUrl.replace(/^(ws:\/\/[^/:]+):\d+\//, `$1:${port}/`);    // the port asked for (the same one on the Mac itself)
    const r = await cdp(ws, "Runtime.evaluate", { expression: READ, returnByValue: true });
    const v = r && r.result ? r.result.value : null;
    out.push(v ? { id: t.id, ws, ...v } : { id: t.id, ws, layout: LAYOUT.exec(t.url)[1], loading: true, syms: [] });
  }
  return out;
}
const nap = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (s) => console.log(s);

async function check(snapFile, port, fix) {
  let saved; try { saved = JSON.parse(readFileSync(snapFile, "utf8")).tabs; } catch (e) { say("TradingView's windows were not written down before it closed, so they are not checked"); return 2; }
  const wait = Number(process.env.TV_LAYOUTS_WAIT || 120) * 1000, t0 = Date.now();
  let open = null;
  for (;;) {           // TradingView opens the front tab of each window first and the others one by one: wait until every tab has drawn
    open = await pages(port);
    const ready = open ? open.filter((p) => !p.loading).length : 0;
    if (open && ready >= saved.length) break;
    if (Date.now() - t0 > wait) { say(`TradingView has ${ready} of its ${saved.length} chart tabs drawn after ${Math.round(wait / 1000)}s - checking what is there`); break; }
    await nap(3000);
  }
  if (!open) { say(`TradingView's debug port ${port} did not answer, so its windows are not checked`); return 2; }
  const p = plan(saved, open.filter((q) => !q.loading));
  let unconfirmed = 0;
  for (const f of p.fix) {
    if (!fix) { say(`TradingView moved one window from ${f.layout} to "${f.fromName}" (${f.from}) - it would be put back`); continue; }
    await cdp(open.find((q) => q.id === f.page).ws, "Page.navigate", { url: `https://www.tradingview.com/chart/${f.layout}/` });
    let back = null;
    for (let i = 0; i < 20 && !back; i++) { await nap(1500); back = ((await pages(port)) || []).find((q) => q.id === f.page && q.layout === f.layout && !q.loading); }
    if (back) say(`TradingView had moved one window from "${back.name}" (${f.layout}) to "${f.fromName}" (${f.from}) - put back`);
    else { unconfirmed++; say(`TradingView had moved one window from ${f.layout} to "${f.fromName}" (${f.from}) - asked back, not confirmed after 30s`); }
  }
  for (const l of p.left) say(`TradingView: one window is not back on its layout ${l.layout}${l.title ? ` ("${l.title}")` : ""} - ${l.why}`);
  if (!p.fix.length && !p.left.length) say(`TradingView: all ${p.ok.length} chart tabs came back on their own layouts`);
  return p.left.length || unconfirmed || (!fix && p.fix.length) ? 1 : 0;
}

function snapshot(support, out) {
  const base = join(support, "TVUserStorage");
  let best = null;
  for (const d of existsSync(base) ? readdirSync(base) : []) {
    const f = join(base, d, "settings.json");
    if (/^id-/.test(d) && existsSync(f) && (!best || statSync(f).mtimeMs > statSync(best).mtimeMs)) best = f;
  }
  if (!best) { say("TradingView's list of windows was not found"); return 2; }
  const tabs = savedTabs(JSON.parse(readFileSync(best, "utf8")));
  writeFileSync(out, JSON.stringify({ from: best, at: new Date().toISOString(), tabs }, null, 1));
  say(`TradingView wrote down ${tabs.length} chart tabs in ${new Set(tabs.map((t) => t.win)).size} windows: ${tabs.map((t) => t.layout).join(" ")}`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [cmd, a, b, c] = process.argv.slice(2);
  if (cmd === "snapshot") process.exit(snapshot(a, b));
  else if (cmd === "check") process.exit(await check(a, b || "9222", c === "fix"));
  else { say("usage: tv-layouts.mjs snapshot <TradingView support folder> <out.json> | check <snapshot.json> <port> [fix]"); process.exit(2); }
}

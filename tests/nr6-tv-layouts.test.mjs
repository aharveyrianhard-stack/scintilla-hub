/* NR6 (27 Oct 2026) - kit/tv-layouts.mjs, the night job's check that TradingView came back on its own layouts. The data is the iMac's on
   27 Oct: what TradingView wrote down when the job closed it at 04:10:25 (TVUserStorage/id-<n>/settings.json, three windows, eight chart
   tabs) and what its pages showed at 04:20:38 - FOCUS (D0N4w0QG) gone, its window's tab showing "combined auto diagonals and pivots"
   (vXFNJ5tr) with FOCUS's six boxes. The last two tests run the real command against a stand-in TradingView on a local debug port. */
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TVL = join(HERE, "..", "deliverables", "20261008", "nr2-night-restart", "kit", "tv-layouts.mjs");
const { plan, savedTabs, ticker } = await import(TVL);

const tab = (id, layout, title, syms) => ({ persistentId: id, active: false, pinned: false, title, url: `https://www.tradingview.com/chart/${layout}/`, fullscreen: false, symbol: { charts: syms.map((symbol) => ({ symbol, interval: "5" })) } });
const SETTINGS = { app: { chartWindows: [
  { persistentId: "0c57eec0-6766-4d48-8954-f304d46fedb5", tabs: [
    tab("a0c53785-4112-4064-9a18-d6a12a0679b2", "D0N4w0QG", "NVDA", ["CME_MINI_DL:ES1!", "BATS:IWM", "TVC:USOIL", "NASDAQ:NVDA", "BATS:NBIS", "TVC:US10Y"]),
    tab("83df0c55-7ce6-4c45-a877-7b36129b4ffc", "ic90TC1n", "NQ1!", ["CME_MINI_DL:ES1!", "BATS:ES/SEED_ALEXDRAYM_SHORTINTEREST2:NQ", "CME_MINI:NQ1!", "TVC:USOIL", "KRX:KOSPI", "SPREADEX:NIKKEI"])] },
  { persistentId: "9c12c5ad-14e1-4e51-b556-e9a232c6b1ad", tabs: [
    tab("d770eba1-4145-4920-8d0e-4b73862b3022", "N7OPXJy3", "NBIS", ["BATS:QQQ", "BATS:SMH", "TVC:US10Y", "TVC:USOIL", "BATS:MU", "NASDAQ:NBIS"]),
    tab("cc0010c4-4509-4ae9-b86f-2dfc82a47c3f", "B2I8l1CJ", "QQQ", ["USI:PCC", "NASDAQ:QQQ"]),
    tab("d5643bfe-a87e-4530-b713-d71348bc07ac", "U0J48Wlk", "US03MY", ["TVC:US03MY", "FRED:BAMLC0A0CM", "TVC:USOIL", "TVC:US10Y"]),
    tab("35e52201-c94c-449a-a931-fba6ccba04a6", "Ib4bi7Oh", "NBIS", ["NASDAQ:NBIS", "BATS:NBIS", "BATS:NBIS", "BATS:NBIS"]),
    tab("65932849-0000-0000-0000-000000000000", "JHHbXcC5", "USDCNH", ["KRX_DLY:K2I1!", "KRX_DLY:402340", "KRX:KOSDAQ", "TSE_DLY:285A", "COMEX_DL:HG1!", "FX:USDCNH"])] },
  { persistentId: "47159475-8fd2-4fa9-bbf7-dac4967ba3fb", tabs: [{ ...tab("cf985a77-ca33-4c19-bd96-c1ae6b1032cc", "vXFNJ5tr", "SPY", []), symbol: undefined },
    { persistentId: "f50854fe", title: "New tab", url: "tvd://new-tab" }] }] },
  tabs: { default: { "b6b04cd4": { tabs: [tab("29902d53", "vXFNJ5tr", "GOOGL", ["BATS:GOOGL"])] } } } };   // a group of no window: not opened, not counted
const page = (id, layout, name, syms, more = {}) => ({ id, layout, name, syms, unsaved: false, dialog: false, ...more });
const AT_0420 = [
  page("E01D7950", "JHHbXcC5", "CLAUDE · ASIA NIGHT iMac", ["KRX_DLY:K2I1!", "KRX_DLY:402340", "KRX:KOSDAQ", "TSE_DLY:285A", "COMEX_DL:HG1!", "FX:USDCNH"]),
  page("B4E00F87", "vXFNJ5tr", "combined auto diagonals and pivots", ["BATS:SPY", "BATS:BE", "BATS:XLF", "BATS:TSLA", "TVC:USOIL"]),
  page("F702D7D3", "vXFNJ5tr", "combined auto diagonals and pivots", ["CME_MINI_DL:ES1!", "BATS:IWM", "TVC:USOIL", "BATS:NVDA", "BATS:NBIS", "TVC:US10Y"]),
  page("A6879646", "ic90TC1n", "CLAUDE · FOCUS overniht", ["CME_MINI_DL:ES1!", "BATS:ES/SEED_ALEXDRAYM_SHORTINTEREST2:NQ", "CME_MINI_DL:NQ1!", "TVC:USOIL", "KRX:KOSPI", "SPREADEX:NIKKEI"]),
  page("3FE72B0C", "Ib4bi7Oh", "CLAUDE · LEVELS LAB", ["BATS:NBIS", "BATS:NBIS", "BATS:NBIS", "BATS:NBIS"]),
  page("B2BFE9FD", "U0J48Wlk", "SCINTILLA · Clean Cyan · 4 Views", ["TVC:US03MY", "FRED:BAMLC0A0CM", "TVC:USOIL", "TVC:US10Y"]),
  page("364BA4C5", "B2I8l1CJ", "SCINTILLA · Clean Cyan · 2 Views", ["USI:PCC", "BATS:QQQ"]),
  page("25E924A3", "N7OPXJy3", "SCINTILLA · iPad · Clean Cyan · 6 Views", ["BATS:QQQ", "BATS:SMH", "TVC:US10Y", "TVC:USOIL", "BATS:MU", "BATS:NBIS"])];
const swap = (pages, id, over) => pages.map((p) => (p.id === id ? { ...p, ...over } : p));

test("NR6 · boxes are compared by ticker: TradingView's notes say NASDAQ:NVDA where the chart says BATS:NVDA; a ratio keeps both sides", () => {
  assert.equal(ticker("NASDAQ:NVDA"), ticker("BATS:NVDA"));
  assert.equal(ticker("BATS:ES/SEED_ALEXDRAYM_SHORTINTEREST2:NQ"), "ES/NQ");
  assert.equal(ticker("AMEX:RSP/BATS:SPY"), "RSP/SPY");
  assert.equal(ticker("TVC:US10Y"), "US10Y");
});

test("NR6 · what TradingView wrote down: the tabs of its windows only - 8 chart tabs in 3 windows; an empty new tab and a group with no window are not counted", () => {
  const s = savedTabs(SETTINGS);
  assert.equal(s.length, 8);
  assert.equal(new Set(s.map((t) => t.win)).size, 3);
  assert.deepEqual(s.map((t) => t.layout), ["D0N4w0QG", "ic90TC1n", "N7OPXJy3", "B2I8l1CJ", "U0J48Wlk", "Ib4bi7Oh", "JHHbXcC5", "vXFNJ5tr"]);
  assert.deepEqual(s[7].syms, [], "the third window's tab wrote down no boxes");
  assert.deepEqual(savedTabs({}), []); assert.deepEqual(savedTabs(null), []);
});

test("NR6 · 27 Oct 04:20: FOCUS is found in the window that shows its six boxes under vXFNJ5tr, and only that tab is put back; the real vXFNJ5tr stays", () => {
  const p = plan(savedTabs(SETTINGS), AT_0420);
  assert.equal(p.fix.length, 1);
  assert.deepEqual({ page: p.fix[0].page, to: p.fix[0].layout, from: p.fix[0].from, fromName: p.fix[0].fromName },
    { page: "F702D7D3", to: "D0N4w0QG", from: "vXFNJ5tr", fromName: "combined auto diagonals and pivots" });
  assert.equal(p.ok.length, 7); assert.deepEqual(p.left, []);
  assert.equal(p.ok.find((t) => t.layout === "vXFNJ5tr").page, "B4E00F87", "the third window keeps its own layout");
});

test("NR6 · every window home - also when FOCUS's rotation has already changed its boxes: nothing to do", () => {
  const home = swap(AT_0420, "F702D7D3", { layout: "D0N4w0QG", name: "CLAUDE · FOCUS iMac", syms: ["BATS:SMH", "BATS:IWM", "TVC:USOIL", "BATS:NFLX", "BATS:NBIS", "TVC:DXY"] });
  const p = plan(savedTabs(SETTINGS), home);
  assert.equal(p.ok.length, 8); assert.deepEqual(p.fix, []); assert.deepEqual(p.left, []);
});

test("NR6 · never a guess: two pages carrying FOCUS's boxes, changed boxes, unsaved changes or a dialog - nothing is moved and the reason is given", () => {
  const two = AT_0420.concat(page("ZZ000001", "U0J48Wlk", "SCINTILLA · Clean Cyan · 4 Views", ["CME_MINI_DL:ES1!", "BATS:IWM", "TVC:USOIL", "BATS:NVDA", "BATS:NBIS", "TVC:US10Y"]));
  let p = plan(savedTabs(SETTINGS), two);
  assert.deepEqual(p.fix, []); assert.match(p.left.find((t) => t.layout === "D0N4w0QG").why, /2 windows show its charts/);
  p = plan(savedTabs(SETTINGS), swap(AT_0420, "F702D7D3", { syms: ["BATS:SPY"] }));
  assert.deepEqual(p.fix.map((f) => [f.page, f.layout]), [["F702D7D3", "D0N4w0QG"]], "its boxes changed, but it is the one second copy while FOCUS is the one tab missing");
  p = plan(savedTabs(SETTINGS), swap(AT_0420, "F702D7D3", { syms: ["BATS:SPY"] }).concat(page("ZZ000003", "U0J48Wlk", "SCINTILLA · Clean Cyan · 4 Views", ["TVC:DXY"])));
  assert.deepEqual(p.fix, []); assert.equal(p.left.find((t) => t.layout === "D0N4w0QG").why, "no window shows it or its charts", "two second copies: nothing moved");
  p = plan(savedTabs(SETTINGS), swap(AT_0420, "F702D7D3", { unsaved: true }));
  assert.deepEqual(p.fix, []); assert.equal(p.left.find((t) => t.layout === "D0N4w0QG").why, "that window has unsaved changes");
  p = plan(savedTabs(SETTINGS), swap(AT_0420, "F702D7D3", { dialog: true }));
  assert.deepEqual(p.fix, []); assert.equal(p.left.find((t) => t.layout === "D0N4w0QG").why, "that window has a dialog open");
});

test("NR6 · the same move the other way round: the third window (no boxes written down) shows a second FOCUS - by elimination it is put back on vXFNJ5tr; FOCUS itself stays", () => {
  const mirror = swap(swap(AT_0420, "F702D7D3", { layout: "D0N4w0QG", name: "CLAUDE · FOCUS iMac" }), "B4E00F87", { layout: "D0N4w0QG", name: "CLAUDE · FOCUS iMac" });
  const p = plan(savedTabs(SETTINGS), mirror);
  assert.deepEqual(p.fix.map((f) => [f.page, f.layout, f.from]), [["B4E00F87", "vXFNJ5tr", "D0N4w0QG"]]);
  assert.equal(p.ok.find((t) => t.layout === "D0N4w0QG").page, "F702D7D3", "the FOCUS window keeps FOCUS (its boxes)");
  assert.deepEqual(p.left, []);
  const two = mirror.concat(page("ZZ000002", "JHHbXcC5", "CLAUDE · ASIA NIGHT iMac", ["FX:USDJPY"]));
  assert.deepEqual(plan(savedTabs(SETTINGS), two).fix, [], "two spare copies: no elimination, nothing moved");
});

/* ---- the real command against a stand-in TradingView: /json/list and the debug socket, answering from a table of pages ---------------- */
function fakeTradingView(pages, names) {
  const navigations = [];
  const server = createServer((req, res) => {
    if (req.url !== "/json/list") { res.writeHead(404); res.end(); return; }
    const port = server.address().port;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(pages.map((p) => ({ id: p.id, type: "page", url: `https://www.tradingview.com/chart/${p.layout}/`, webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/${p.id}` }))));
  });
  server.on("upgrade", (req, sock) => {
    const accept = createHash("sha1").update(req.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
    sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    const id = req.url.split("/").pop(); let buf = Buffer.alloc(0);
    const send = (o) => { const b = Buffer.from(JSON.stringify(o)); sock.write(Buffer.concat([b.length < 126 ? Buffer.from([0x81, b.length]) : Buffer.from([0x81, 126, b.length >> 8, b.length & 255]), b])); };
    sock.on("data", (d) => {
      buf = Buffer.concat([buf, d]);
      while (buf.length >= 2) {
        const op = buf[0] & 15; let len = buf[1] & 127, at = 2;
        if (len === 126) { len = buf.readUInt16BE(2); at = 4; } else if (len === 127) { len = Number(buf.readBigUInt64BE(2)); at = 10; }
        if (buf.length < at + 4 + len) return;
        const mask = buf.subarray(at, at + 4), body = Buffer.from(buf.subarray(at + 4, at + 4 + len).map((x, i) => x ^ mask[i % 4]));
        buf = buf.subarray(at + 4 + len);
        if (op === 8) { sock.end(Buffer.from([0x88, 0])); return; }
        if (op !== 1) continue;
        const msg = JSON.parse(body.toString()), p = pages.find((q) => q.id === id);
        if (msg.method === "Runtime.evaluate") send({ id: msg.id, result: { result: { type: "object", value: p ? { layout: p.layout, name: p.name, syms: p.syms, unsaved: p.unsaved, dialog: p.dialog } : null } } });
        else if (msg.method === "Page.navigate") {
          navigations.push({ id, url: msg.params.url }); const to = /\/chart\/(\w{8})\//.exec(msg.params.url)[1];
          Object.assign(p, { layout: to, name: names[to] || to }); send({ id: msg.id, result: { frameId: "f" } });
        } else send({ id: msg.id, result: {} });
      }
    });
    sock.on("error", () => {});
  });
  return new Promise((res) => server.listen(0, "127.0.0.1", () => res({ server, port: server.address().port, navigations })));
}
const run = (args, env = {}) => new Promise((res) => {
  const c = spawn(process.execPath, [TVL, ...args], { env: { ...process.env, TV_LAYOUTS_WAIT: "5", ...env } }); let out = "";
  c.stdout.on("data", (d) => (out += d)); c.stderr.on("data", (d) => (out += d)); c.on("close", (code) => res({ code, out: out.trim() }));
});
function snapshotOf(settings) {
  const dir = mkdtempSync(join(tmpdir(), "nr6-")), sup = join(dir, "TradingView"), user = join(sup, "TVUserStorage", "id-13026810");
  mkdirSync(user, { recursive: true }); writeFileSync(join(user, "settings.json"), JSON.stringify(settings));
  return { dir, sup, snap: join(dir, "tv-windows-before.json") };
}

test("NR6 · the command, 27 Oct replayed: snapshot, then a look-only check says what it would do and moves nothing; 'fix' moves exactly that tab back and confirms it", async () => {
  const s = snapshotOf(SETTINGS);
  const snap = await run(["snapshot", s.sup, s.snap]);
  assert.equal(snap.code, 0, snap.out);
  assert.equal(snap.out, "TradingView wrote down 8 chart tabs in 3 windows: D0N4w0QG ic90TC1n N7OPXJy3 B2I8l1CJ U0J48Wlk Ib4bi7Oh JHHbXcC5 vXFNJ5tr");
  assert.equal(JSON.parse(readFileSync(s.snap, "utf8")).tabs.length, 8);
  const tv = await fakeTradingView(AT_0420.map((p) => ({ ...p })), { D0N4w0QG: "CLAUDE · FOCUS iMac" });
  try {
    const look = await run(["check", s.snap, String(tv.port)]);
    assert.equal(look.out, 'TradingView moved one window from D0N4w0QG to "combined auto diagonals and pivots" (vXFNJ5tr) - it would be put back');
    assert.equal(look.code, 1); assert.deepEqual(tv.navigations, [], "a look moves nothing");
    const fix = await run(["check", s.snap, String(tv.port), "fix"]);
    assert.equal(fix.out, 'TradingView had moved one window from "CLAUDE · FOCUS iMac" (D0N4w0QG) to "combined auto diagonals and pivots" (vXFNJ5tr) - put back');
    assert.equal(fix.code, 0);
    assert.deepEqual(tv.navigations, [{ id: "F702D7D3", url: "https://www.tradingview.com/chart/D0N4w0QG/" }], "one tab, the moved one, to its own layout");
    const again = await run(["check", s.snap, String(tv.port), "fix"]);
    assert.equal(again.out, "TradingView: all 8 chart tabs came back on their own layouts"); assert.equal(again.code, 0);
    assert.equal(tv.navigations.length, 1, "nothing more once every window is home");
  } finally { tv.server.close(); }
});

test("NR6 · the command when it cannot look: no list written down, no debug port answering - it says so and moves nothing", async () => {
  const s = snapshotOf({});
  assert.equal((await run(["snapshot", join(s.dir, "nowhere"), s.snap])).out, "TradingView's list of windows was not found");
  const none = await run(["check", join(s.dir, "missing.json"), "1"]);
  assert.equal(none.code, 2); assert.equal(none.out, "TradingView's windows were not written down before it closed, so they are not checked");
  await run(["snapshot", s.sup, s.snap]);
  const port = await run(["check", s.snap, "1"]);
  assert.equal(port.code, 2); assert.match(port.out, /TradingView's debug port 1 did not answer, so its windows are not checked/);
});

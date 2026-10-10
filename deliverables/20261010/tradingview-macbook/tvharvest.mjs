import { connectPage } from './cdp.mjs'
import fs from 'node:fs'
const to = (p, ms, w) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout ' + w)), ms))])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const OUT = process.argv[2], WANT = process.argv.slice(3)
const list = await (await fetch('http://127.0.0.1:9222/json/list')).json()
const t = list.find(x => x.url.includes('/chart/uTCpSmag/')); if (!t) { console.log('STOP: no capture tab'); process.exit(2) }
const p = await to(connectPage(t.id), 5000, 'connect'); const ev = (s, ms = 25000, aw = false) => to(p.eval(s, aw), ms, 'eval')
const READ = `(() => { const cw = TradingViewApi.chart(0)._chartWidget, m = cw.model().model(), ser = m.mainSeries(); const s = m.dataSources().find(x => x.metaInfo && /Channels Roles/.test(x.metaInfo().shortDescription || '')); if (!s) return { err: 'no Channels study' };
  const g = s.graphics(), pc = g._primitivesCollection, idx = Array.from(g._indexes || []); const bars = ser.bars(), li = bars.lastIndex(); const lastBar = li != null ? bars.valueAt(li) : null;
  const lines = [], labels = [], seen = new Set();
  const walk = (v, depth) => { if (v == null || depth > 6 || (typeof v === 'object' && seen.has(v))) return; if (typeof v === 'object') seen.add(v); if (v instanceof Map || v instanceof Set) { for (const x of v.values()) walk(x, depth + 1); return } if (Array.isArray(v)) { for (const x of v) walk(x, depth + 1); return } if (typeof v !== 'object') return; const d = v._data || v.data || v;
    if (typeof d === 'object' && d !== null) { if ('x1' in d && 'y1' in d && 'x2' in d) { lines.push({ id: d.id, x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2, ex: d.ex }); return } if (('x' in d) && ('y' in d) && ('t' in d || 'text' in d)) { labels.push({ x: d.x, y: d.y, t: String(d.t ?? d.text).trim() }); return } } for (const k of Object.keys(v)) if (typeof v[k] === 'object') walk(v[k], depth + 1) };
  walk(pc.dwglines, 0); walk(pc.dwglabels, 0);
  const bi = (x) => (idx.length && x < idx.length ? idx[x] : x), tAt = (b) => { const v = bars.valueAt(b); return v ? v[0] : null };
  const named = labels.filter(L => /^[A-D]\\d( \\(M\\))?$/.test(L.t)).map(L => ({ ...L, b: bi(L.x) }));
  const out = []; const seenId = new Set();
  for (const l of lines) { if (seenId.has(l.id)) continue; seenId.add(l.id); const b1 = bi(l.x1), b2 = bi(l.x2); if (b1 >= li && b2 >= li) continue; if (b1 === b2) continue; const k = (l.y2 - l.y1) / (b2 - b1), now = l.y2 + k * (li - b2);
    out.push({ id: l.id, label: null, b1, b2, t1: tAt(b1), t2: tAt(b2), y1: +l.y1.toFixed(4), y2: +l.y2.toFixed(4), slopePerBar: +k.toFixed(6), now: +now.toFixed(4), ex: l.ex }) }
  return { symbol: ser.symbol(), lastIndex: li, lastClose: lastBar && lastBar[4], lastTime: lastBar && lastBar[0], labels: named.map(L => ({ t: L.t, b: L.b, y: L.y })), lines: out } })()`
/* label the lines by pattern: lines sharing the same two anchor bars are one pattern; within it, top to bottom = 1..n; the letter is the one whose label set (same count) sits nearest in price */
function labelLines(r) { const groups = {}; for (const l of r.lines) (groups[l.b1 + '>' + l.b2] ||= []).push(l); const byLetter = {}; const seenL = new Set(); for (const L of r.labels) { const key = L.t; if (seenL.has(key + '@' + L.y.toFixed(3))) continue; seenL.add(key + '@' + L.y.toFixed(3)); const m = /^([A-D])(\d)/.exec(L.t); if (m) (byLetter[m[1]] ||= []).push({ ...L, n: +m[2] }) }
  const used = new Set(); const gs = Object.values(groups).sort((a, b) => b.length - a.length);
  for (const g of gs) { g.sort((a, b) => b.y2 - a.y2); let best = null; for (const [letter, labs] of Object.entries(byLetter)) { if (used.has(letter) || labs.length !== g.length) continue; const sorted = labs.slice().sort((a, b) => b.y - a.y); let score = 0; for (let i = 0; i < g.length; i++) { const l = g[i], L = sorted[i]; const yAt = l.y2 + l.slopePerBar * (L.b - l.b2); score += Math.abs(yAt - L.y) / Math.max(1e-9, Math.abs(L.y)) } score /= g.length; if (!best || score < best.score) best = { letter, score, sorted } }
    const sameCount = Object.entries(byLetter).filter(([letter, labs]) => !used.has(letter) && labs.length === g.length); if (best && (sameCount.length === 1 || best.score < 0.08)) { used.add(best.letter); g.forEach((l, i) => { l.label = best.sorted[i].t; l.labelScore = +best.score.toFixed(4); l.labelBy = sameCount.length === 1 ? 'count' : 'price' }) } }
  return r }
const rot = await ev(`(() => { const r = window.SCINTILLA_REVIEW_ROTATION, st = typeof r.state === 'function' ? r.state() : r.state; return { playing: !!(st.playing ?? st.running), current: st.current && st.current.symbol, cursor: st.cursor } })()`)
const sym0 = await ev(`TradingViewApi.chart(0).symbol()`), sym1 = await ev(`TradingViewApi.chart(1).symbol()`)
console.log('rotation before:', JSON.stringify(rot), '| chart symbols:', sym0, sym1)
await ev(`(() => { try { window.SCINTILLA_REVIEW_ROTATION.pause(); return 'paused' } catch (e) { return 'pause failed ' + e.message } })()`).then(r => console.log(r))
const roster = await ev(`(() => { const r = window.SCINTILLA_REVIEW_ROTATION.roster; const a = typeof r === 'function' ? r() : r; const arr = Array.isArray(a) ? a : (a.symbols || a.entries || Object.values(a)); const m = {}; for (const x of arr) if (x && x.name) m[x.name] = x.symbol; return m })()`)
const summary = []
for (const name of WANT) { const full = roster[name] || roster[name.replace('!', '')] || null; if (!full) { console.log(name, ': not on the roster'); summary.push({ name, err: 'not on roster' }); continue }
  await ev(`(() => { TradingViewApi.chart(0).setSymbol(${JSON.stringify(full)}, () => {}); try { TradingViewApi.chart(1).setSymbol(${JSON.stringify(full)}, () => {}) } catch (e) {} return 'set' })()`)
  let r = null; for (let i = 0; i < 60; i++) { await sleep(1000); r = await ev(READ).catch(() => null); if (r && r.symbol && r.symbol.split(':').pop() === full.split(':').pop() && r.lines && r.lines.length) { await sleep(1500); const r2 = await ev(READ).catch(() => null); if (r2 && r2.lines.length === r.lines.length) { r = r2; break } } }
  if (!r || !r.symbol || r.symbol.split(':').pop() !== full.split(':').pop()) { console.log(name, ': no read (chart shows', r && r.symbol, ', lines', r && r.lines && r.lines.length, ')'); summary.push({ name, full, err: 'no read' }); continue }
  labelLines(r)
  const png = await ev(`(async () => { const c = await TradingViewApi.takeClientScreenshot(); return c && c.toDataURL ? c.toDataURL('image/png') : null })()`, 25000, true).catch(() => null)
  if (png) fs.writeFileSync(OUT + '/' + name.replace('!', '') + '.png', Buffer.from(png.split(',')[1], 'base64'))
  r.readAt = new Date().toISOString(); r.name = name; fs.writeFileSync(OUT + '/' + name.replace('!', '') + '.json', JSON.stringify(r, null, 1))
  const lab = r.lines.filter(l => l.label).map(l => l.label + '=' + l.now.toFixed(2)); console.log(name, full, 'close', r.lastClose, '| labelled lines:', lab.join(' '), '| unlabelled:', r.lines.filter(l => !l.label).length); summary.push({ name, full, close: r.lastClose, lines: r.lines.filter(l => l.label).map(l => ({ label: l.label, now: l.now })) }) }
await ev(`(() => { TradingViewApi.chart(0).setSymbol(${JSON.stringify(sym0)}, () => {}); try { TradingViewApi.chart(1).setSymbol(${JSON.stringify(sym1)}, () => {}) } catch (e) {} return 'restored' })()`).then(r => console.log(r, sym0))
if (rot.playing) await ev(`(() => { try { window.SCINTILLA_REVIEW_ROTATION.play(); return 'play resumed' } catch (e) { return 'play failed ' + e.message } })()`).then(r => console.log(r))
fs.writeFileSync(OUT + '/_summary-' + Date.now() + '.json', JSON.stringify(summary, null, 1)); process.exit(0)

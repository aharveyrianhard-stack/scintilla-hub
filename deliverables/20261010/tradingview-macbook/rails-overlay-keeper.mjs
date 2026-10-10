// Keeps Alan's approved long-term rails painted over the two charts of the capture layout (TradingView Desktop on this Mac, layout uTCpSmag).
// It stores nothing in TradingView: it re-paints rails-overlay.js into the page whenever the page was reloaded or LT-RAILS.json changed.
// Run by the LaunchAgent com.scintilla.lt-rails-overlay.   Stop: launchctl bootout gui/$(id -u)/com.scintilla.lt-rails-overlay
// One look and exit: node rails-overlay-keeper.mjs --once
import fs from 'node:fs'
import crypto from 'node:crypto'
import { connect } from './cdp.mjs'
const HERE = new URL('.', import.meta.url).pathname.replace(/%20/g, ' ')
const ONCE = process.argv.includes('--once'), LAYOUT = 'uTCpSmag', PORT = 9222, EVERY = 4000
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const to = (p, ms, w) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout ' + w)), ms))])
let lastNote = ''
const note = (s) => { if (s === lastNote) return; lastNote = s; console.log(new Date().toISOString(), s) }
let conn = null, connId = null
const drop = () => { try { conn && conn.ws.close() } catch (e) {} conn = null; connId = null }
const once = async () => {
  let list; try { list = await (await to(fetch(`http://127.0.0.1:${PORT}/json/list`), 3000, 'list')).json() } catch (e) { drop(); return note('TradingView is not answering on this Mac - waiting') }
  const t = list.find((x) => x.type === 'page' && x.url.includes('/chart/' + LAYOUT + '/')); if (!t) { drop(); return note('the capture layout is not open - waiting') }
  if (connId !== t.id || !conn || conn.ws.readyState !== 1) { drop(); conn = await to(connect(t.webSocketDebuggerUrl), 4000, 'connect'); connId = t.id }
  const code = fs.readFileSync(HERE + 'rails-overlay.js', 'utf8'), rails = JSON.parse(fs.readFileSync(HERE + 'LT-RAILS.json', 'utf8'))
  const stamp = crypto.createHash('sha1').update(code).update(JSON.stringify(rails)).digest('hex').slice(0, 12)
  const cur = await to(conn.eval(`(() => { try { if (typeof TradingViewApi !== 'object' || !TradingViewApi.chartsCount || TradingViewApi.chartsCount() < 1) return 'loading'; return (window.__SC_LT_RAILS && window.__SC_LT_RAILS.stamp) || 'none' } catch (e) { return 'loading' } })()`), 5000, 'peek')
  if (cur === 'loading') return note('the capture layout is loading - waiting')
  if (cur === stamp) return note(`rails painted (${Object.keys(rails).length} names, ${stamp})`)
  const res = await to(conn.eval(`window.__SC_LT_RAILS_DATA = ${JSON.stringify({ stamp, rails })};\n${code}`), 8000, 'paint')
  note(`painted again after ${cur === 'none' ? 'a reload' : 'new approvals'}: ${res} (${Object.keys(rails).length} names)`)
}
for (;;) { try { await once() } catch (e) { drop(); note('retrying: ' + String(e.message || e).slice(0, 140)) } if (ONCE) break; await sleep(EVERY) }
process.exit(0)

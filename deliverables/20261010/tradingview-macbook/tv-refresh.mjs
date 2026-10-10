// MacBook: once a day, at a quiet moment, reload every TradingView layout IN PLACE to give its memory back.
// Why reload and not close-and-reopen (the iMac's way): on this Mac TradingView has several windows spread over desktops and the
// extended screen; closing the app would bring them all back on one desktop. A reload keeps every window where it is.
// Measured 10 Oct 2026: 5.82 GB -> 3.20 GB, every layout back on the same charts.
// A layout is left alone when it has unsaved changes, a rotation playing, the capture box open or a dialog showing.
// Run by the LaunchAgent com.scintilla.tv-refresh.   Stop: launchctl bootout gui/$(id -u)/com.scintilla.tv-refresh
//   node tv-refresh.mjs          the scheduled way: once a day, only after 10 quiet minutes
//   node tv-refresh.mjs --dry    only look
//   node tv-refresh.mjs --now    do it now (still leaves busy layouts alone)
import fs from 'node:fs'
import os from 'node:os'
import { execSync } from 'node:child_process'
import { connect } from './cdp.mjs'
const DRY = process.argv.includes('--dry'), NOW = process.argv.includes('--now'), QUIET = 600, PORT = 9222
const STATE = os.homedir() + '/Library/Application Support/Scintilla/tv-refresh'; fs.mkdirSync(STATE, { recursive: true })
const day = new Date().toLocaleDateString('en-CA'), stamp = `${STATE}/done-${day}`
const say = (s) => console.log(new Date().toLocaleString('en-GB', { hour12: false }).replace(',', ''), s)
const to = (p, ms, w) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout ' + w)), ms))]); const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const idle = () => { try { return Math.floor(Number(execSync(`/usr/sbin/ioreg -c IOHIDSystem -d 4 | awk '/HIDIdleTime/ {print $NF; exit}'`).toString().trim()) / 1e9) } catch (e) { return 0 } }
const memGB = () => { try { const out = execSync(`/usr/bin/top -l 1 -stats mem,command 2>/dev/null | grep -i tradingview`).toString(); let kb = 0, n = 0; for (const line of out.split('\n')) { const m = line.trim().match(/^([\d.]+)([KMG])/); if (!m) continue; n++; kb += Number(m[1]) * { K: 1, M: 1024, G: 1048576 }[m[2]] } return { gb: +(kb / 1048576).toFixed(2), n } } catch (e) { return { gb: null, n: 0 } } }
if (!DRY && !NOW) { if (fs.existsSync(stamp)) process.exit(0); const i = idle(); if (i < QUIET) { say(`in use (last touched ${Math.floor(i / 60)} min ago, needs 10) - nothing done, next try at the next slot`); process.exit(0) } }
let list; try { list = await (await to(fetch(`http://127.0.0.1:${PORT}/json/list`), 4000, 'list')).json() } catch (e) { say('TradingView is not running (or not answering) - nothing to do'); process.exit(0) }
const tabs = list.filter((x) => x.type === 'page' && x.url.includes('/chart/')); const before = memGB()
say(`---- ${DRY ? 'look only' : NOW ? 'now' : 'scheduled'}: ${tabs.length} layouts, TradingView holds ${before.gb} GB in ${before.n} processes`)
const PRE = `(() => { const o = { name: null, heap: Math.round(performance.memory.usedJSHeapSize / 1048576), busy: [] }; try { o.name = TradingViewApi.layoutName() } catch (e) {} try { const s = TradingViewApi._saveChartService; if (s && s.hasChanges && s.hasChanges()) o.busy.push('unsaved changes') } catch (e) {} for (const k of ['SCINTILLA_REVIEW_ROTATION', 'SCINTILLA_CLEAN_ROTATION']) { try { const R = window[k]; if (R) { const s = typeof R.state === 'function' ? R.state() : R.state; if (s.running || s.playing || s.busy) o.busy.push('a rotation is playing') } } catch (e) {} } try { const b = window.SCINTILLA_CAPTURE_BOX && window.SCINTILLA_CAPTURE_BOX.state(); if (b && (b.open || b.loading || b.pendingRequestId)) o.busy.push('the capture box is open') } catch (e) {} const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }; if ([...document.querySelectorAll('[role="dialog"]')].some(vis)) o.busy.push('a dialog is open'); if ([...document.querySelectorAll('.monaco-editor')].some(vis)) o.busy.push('the code editor is open'); o.syms = Array.from({ length: TradingViewApi.chartsCount() }, (_, i) => TradingViewApi.chart(i).symbol() + '@' + TradingViewApi.chart(i).resolution()).join(','); return o })()`
const POST = `(() => { const n = TradingViewApi.chartsCount(); const ok = Array.from({ length: n }, (_, i) => TradingViewApi.chart(i)._chartWidget.model().model().mainSeries().bars().size() > 5).every(Boolean); return ok ? { heap: Math.round(performance.memory.usedJSHeapSize / 1048576), syms: Array.from({ length: n }, (_, i) => TradingViewApi.chart(i).symbol() + '@' + TradingViewApi.chart(i).resolution()).join(',') } : null })()`
let done = 0, left = 0, failed = 0
for (const t of tabs) { let p = null
  try { p = await to(connect(t.webSocketDebuggerUrl), 5000, 'connect'); const pre = await to(p.eval(PRE), 8000, 'look')
    if (pre.busy.length) { say(`  ${pre.name}: left alone - ${pre.busy.join(', ')}`); left++; continue }
    if (DRY) { say(`  ${pre.name}: would be reloaded (its page holds ${pre.heap} MB)`); continue }
    if (!NOW && idle() < QUIET) { say('  somebody is back at the Mac - stopping here'); break }
    await p.send('Page.reload', {}); await sleep(5000); let post = null
    for (let k = 0; k < 75 && !post; k++) { try { post = await to(p.eval(POST), 4000, 'after') } catch (e) {} if (!post) await sleep(1000) }
    if (!post) { say(`  ${pre.name}: reloaded but its charts were not back after 80 s - LOOK`); failed++; continue }
    say(`  ${pre.name}: reloaded, page ${pre.heap} -> ${post.heap} MB${post.syms === pre.syms ? '' : ' (came back on its saved charts: ' + post.syms.replace(/[A-Z_]+:/g, '') + ')'}`); done++
  } catch (e) { say(`  ${(t.url.match(/chart\/([^/]+)/) || [])[1]}: ${String(e.message || e).slice(0, 120)}`); failed++ } finally { try { p && p.ws.close() } catch (e) {} } }
if (!DRY) { await sleep(40000); const after = memGB(); const line = `TradingView ${before.gb} GB -> ${after.gb} GB; ${done} layouts reloaded, ${left} left alone, ${failed} to look at`; say('done: ' + line); if (done && !failed) fs.writeFileSync(stamp, line + '\n'); fs.writeFileSync(`${STATE}/LAST.txt`, new Date().toString() + '\n' + line + '\n') }
process.exit(0)

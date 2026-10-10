// Minimal CDP client for this test. Usage: import { connect, browser } from './cdp.mjs'
import fs from 'node:fs'

export async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let id = 0
  const pending = new Map()
  const events = []
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data)
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) rej(new Error(JSON.stringify(msg.error)))
      else res(msg.result)
    } else if (msg.method) {
      events.push(msg)
    }
  }
  return {
    ws,
    events,
    send(method, params = {}) {
      const mid = ++id
      return new Promise((res, rej) => {
        pending.set(mid, { res, rej })
        ws.send(JSON.stringify({ id: mid, method, params }))
      })
    },
    async eval(expr, awaitPromise = false) {
      const r = await this.send('Runtime.evaluate', {
        expression: expr, awaitPromise, returnByValue: true, userGesture: true,
      })
      if (r.exceptionDetails) throw new Error('page exception: ' + JSON.stringify(r.exceptionDetails).slice(0, 800))
      return r.result ? r.result.value : undefined
    },
    async shot(path) {
      const r = await this.send('Page.captureScreenshot', { format: 'png' })
      fs.writeFileSync(path, Buffer.from(r.data, 'base64'))
      return path
    },
    sleep(ms) { return new Promise(r => setTimeout(r, ms)) },
    async waitFor(expr, timeoutMs = 30000, poll = 500) {
      const t0 = Date.now()
      while (Date.now() - t0 < timeoutMs) {
        try { if (await this.eval(expr)) return true } catch {}
        await this.sleep(poll)
      }
      throw new Error('timeout waiting for: ' + expr)
    },
  }
}

export async function connectPage(targetId) {
  const list = await (await fetch('http://127.0.0.1:9222/json/list')).json()
  const t = list.find(t => t.id === targetId)
  if (!t) throw new Error('target not found: ' + targetId)
  return connect(t.webSocketDebuggerUrl)
}

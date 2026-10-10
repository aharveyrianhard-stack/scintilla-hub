// Painted over the capture layout's two charts by rails-overlay-keeper.mjs. Read-only towards TradingView:
// it creates no drawing, no indicator and saves nothing; it only reads the chart's scales and paints on its own canvases.
// window.__SC_LT_RAILS_DATA = { stamp, rails: { TICKER: [{ tag, t1, y1, t2, y2 }] } } is set by the keeper before this runs.
(() => {
  const D = window.__SC_LT_RAILS_DATA; if (!D) return 'no data'
  if (window.__SC_LT_RAILS && window.__SC_LT_RAILS.destroy) { try { window.__SC_LT_RAILS.destroy() } catch (e) {} }
  const CYAN = '#00D4FF', INK = 'rgba(8,12,20,0.86)', DIM = 'rgba(0,212,255,0.55)'
  const canvases = [], state = { stamp: D.stamp, alive: true, lastSig: '', painted: 0, err: null, now: [null, null] }
  const tick = (sym) => String(sym || '').split(':').pop()
  const mk = () => { const c = document.createElement('canvas'); c.setAttribute('data-sc-lt-rails', '1'); c.style.cssText = 'position:fixed;pointer-events:none;z-index:3;left:0;top:0;width:0;height:0'; document.body.appendChild(c); canvases.push(c); return c }
  const cv = [mk(), mk()]
  // index of the bar that holds time t (bars' own times; exact on the two-week chart the rails were read from)
  const indexFor = (bars, t) => { let lo = bars.firstIndex(), hi = bars.lastIndex(); if (lo == null || hi == null) return null; const T = (i) => { const v = bars.valueAt(i); return v ? v[0] : null }
    if (t >= T(hi)) return hi; if (t <= T(lo)) return lo; while (hi - lo > 1) { const mid = (lo + hi) >> 1, v = T(mid); if (v == null) { lo = mid; continue } if (v <= t) lo = mid; else hi = mid } return lo }
  const chip = (g, text, x, y, align, strong) => { g.font = (strong ? '600 ' : '') + '12px -apple-system, "SF Pro Text", Helvetica, Arial, sans-serif'; const w = Math.ceil(g.measureText(text).width) + 12, h = 20; const left = align === 'right' ? x - w : x; g.fillStyle = INK; g.fillRect(left, y - h / 2, w, h); g.strokeStyle = strong ? CYAN : DIM; g.lineWidth = 1; g.strokeRect(left + 0.5, y - h / 2 + 0.5, w - 1, h - 1); g.fillStyle = CYAN; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(text, left + 6, y + 0.5); return { left, w, h } }
  const fmt = (v) => { const a = Math.abs(v); return a >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : a >= 100 ? v.toFixed(1) : v.toFixed(2) }
  const paint = () => {
    if (!state.alive) return
    try {
      let sig = ''; const jobs = []
      for (let i = 0; i < 2 && i < TradingViewApi.chartsCount(); i++) {
        const cw = TradingViewApi.chart(i)._chartWidget, m = cw.model().model(), ser = m.mainSeries(), ts = m.timeScale(), ps = ser.priceScale(), bars = ser.bars()
        const pw = (cw.paneWidgets() || []).find(w => { try { return w.state().containsMainSeries() } catch (e) { return false } }); const el = pw && pw.canvasElement && pw.canvasElement(); if (!el) continue
        const r = el.getBoundingClientRect(), li = bars.lastIndex(), last = li != null && bars.valueAt(li) ? bars.valueAt(li)[4] : null, fv = ser.firstValue(), sym = tick(TradingViewApi.chart(i).symbol())
        const lr = ts.logicalRange ? ts.logicalRange() : null
        sig += [i, sym, Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height), li, last, fv, ts.barSpacing(), ts.rightOffset(), ps.priceToCoordinate(100, fv), ps.priceToCoordinate(200, fv), ser.interval && ser.interval()].join(',') + ';'
        jobs.push({ i, r, ts, ps, bars, li, last, fv, sym })
      }
      if (sig === state.lastSig) return; state.lastSig = sig
      for (const j of jobs) {
        const c = cv[j.i], dpr = window.devicePixelRatio || 1; c.style.left = j.r.left + 'px'; c.style.top = j.r.top + 'px'; c.style.width = j.r.width + 'px'; c.style.height = j.r.height + 'px'
        if (c.width !== Math.round(j.r.width * dpr) || c.height !== Math.round(j.r.height * dpr)) { c.width = Math.round(j.r.width * dpr); c.height = Math.round(j.r.height * dpr) }
        const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, j.r.width, j.r.height)
        const rails = D.rails[j.sym]; const W = j.r.width, H = j.r.height; state.now[j.i] = { sym: j.sym, rails: [] }
        if (!rails || j.li == null || j.fv == null) { if (j.i === 1 && j.sym) chip(g, 'LT rails · not approved yet', W - 8, 16, 'right', false); continue }
        const now = []; const nice = (tag) => tag.replace(/^LT /, '2W ')
        for (const rail of rails) { const i1 = indexFor(j.bars, rail.t1), i2 = indexFor(j.bars, rail.t2); if (i1 == null || i2 == null || i1 === i2) continue
          const x1 = j.ts.indexToCoordinate(i1), x2 = j.ts.indexToCoordinate(i2), y1 = j.ps.priceToCoordinate(rail.y1, j.fv), y2 = j.ps.priceToCoordinate(rail.y2, j.fv); if (![x1, x2, y1, y2].every(Number.isFinite)) continue
          const k = (y2 - y1) / (x2 - x1), yAt = (x) => y1 + k * (x - x1)
          g.strokeStyle = CYAN; g.lineWidth = 2; g.beginPath(); g.moveTo(x1, y1); g.lineTo(W, yAt(W)); g.stroke()
          const xl = j.ts.indexToCoordinate(j.li), priceNow = rail.y2 + (rail.y2 - rail.y1) / (i2 - i1) * (j.li - i2); const bt = (i) => { const v = j.bars.valueAt(i); return v ? v[0] : null }; now.push({ tag: rail.tag, price: priceNow, y: yAt(xl + 16), x: xl + 16, exact: bt(i1) === rail.t1 && bt(i2) === rail.t2 }) }
        // labels at the right edge, on the rail
        for (const n of now) { const yr = Math.max(12, Math.min(H - 12, n.y)); chip(g, nice(n.tag) + '  ' + fmt(n.price), Math.min(n.x, W - 110), yr, 'left', false) }
        // where price sits inside the approved channel (top rail = lowest rail number, bottom rail = highest)
        if (j.i === 0) state.now[0] = { sym: j.sym, last: j.last, rails: now.map(n => ({ tag: n.tag, price: +n.price.toFixed(4), exact: n.exact })) }
        if (j.i === 1 && now.length >= 2 && j.last != null) { const pair = now.slice().sort((a, b) => b.price - a.price), top = pair[0], bot = pair[pair.length - 1]; if (top.price > bot.price) { const pos = (j.last - bot.price) / (top.price - bot.price) * 100, up = (top.price / j.last - 1) * 100, dn = (bot.price / j.last - 1) * 100
            const sg = (v) => (v >= 0 ? '+' : '\u2212') + Math.abs(v).toFixed(1) + '%'; chip(g, `Long-term channel ${nice(top.tag)}\u2013${bot.tag.replace('LT ', '')} · ${pos.toFixed(0)}% up · top ${sg(up)} · bottom ${sg(dn)}`, W - 8, 16, 'right', true); state.now[j.i] = { sym: j.sym, pos: +pos.toFixed(1), up: +up.toFixed(2), dn: +dn.toFixed(2), last: j.last, rails: now.map(n => ({ tag: n.tag, price: +n.price.toFixed(4), exact: n.exact })) } } }
        else if (j.i === 1 && now.length === 0) chip(g, 'LT rails · approved, not on this timeframe', W - 8, 16, 'right', false)
      }
      state.painted++; state.err = null
    } catch (e) { state.err = String(e && e.message || e) }
  }
  const loop = () => { if (!state.alive) return; paint(); state.raf = requestAnimationFrame(() => setTimeout(loop, 120)) }
  loop()
  window.__SC_LT_RAILS = { stamp: D.stamp, state, repaint: () => { state.lastSig = ''; paint() }, destroy: () => { state.alive = false; for (const c of canvases) c.remove() } }
  return 'installed ' + D.stamp
})()

/* GH1 · the Pine oscillator's rung state machine, line for line (pine/SCINTILLA-GEIGER-OSCILLATOR.pine → rungRead + rung).
   The script keeps running state and folds in one bar at a time instead of re-reading 230 bars; this port lets the tests
   prove that the running version gives the publisher's windowed reading. Equalizer family and momentum mix: the saved values. */
export const FAM = { T: 0.5, M: 0.5 }, MIX = { R: 0.6, W: 0.4 }, WINDOW = 230;
const K5 = 2 / 6, K8 = 2 / 9, K13 = 2 / 14, K21 = 2 / 22, K34 = 2 / 35;
const clamp1 = (x) => Math.max(-1, Math.min(1, x));
export class Rung {
  constructor() {
    this.cl = []; this.hi = []; this.lo = []; this.n = 0;
    this.e5 = this.e8 = this.e13 = this.e21 = this.e34 = NaN;
    this.s50 = this.s100 = this.s150 = this.s200 = 0;
    this.ag = this.al = NaN; this.sumG = this.sumL = 0; this.prevC = NaN;
    this.curId = null; this.curH = this.curL = this.curC = NaN;
  }
  // reading from the finished bars held in state, optionally with one more bar (h, l, c) placed after them
  read(plus, h, l, c) {
    const n = this.n, m = Math.min(n + (plus ? 1 : 0), WINDOW); let trend = null, mom = null, lines = 0;
    if (m >= 8) {
      const sz = this.cl.length;
      const x5 = plus ? c * K5 + this.e5 * (1 - K5) : this.e5, x8 = plus ? c * K8 + this.e8 * (1 - K8) : this.e8;
      const x13 = plus ? c * K13 + this.e13 * (1 - K13) : this.e13, x21 = plus ? c * K21 + this.e21 * (1 - K21) : this.e21;
      const x34 = plus ? c * K34 + this.e34 * (1 - K34) : this.e34;
      let pairs = 1, inOrd = x5 > x8 ? 1 : 0, prev = x8;
      for (const [need, x] of [[13, x13], [21, x21], [34, x34]]) if (m >= need) { pairs += 1; inOrd += prev > x ? 1 : 0; prev = x; }
      for (const [need, s] of [[50, this.s50], [100, this.s100], [150, this.s150], [200, this.s200]]) if (m >= need) {
        const a = plus ? (s - (n >= need ? this.cl[sz - need] : 0) + c) / need : s / need;
        pairs += 1; inOrd += prev > a ? 1 : 0; prev = a;
      }
      trend = (2 * inOrd - pairs) / pairs; lines = pairs + 1;
      if (m >= 15) {
        let g = this.ag, ls = this.al;
        if (plus) {
          const dlt = c - this.prevC, up = dlt > 0 ? dlt : 0, dn = dlt < 0 ? -dlt : 0;
          if (n >= 15) { g = (this.ag * 13 + up) / 14; ls = (this.al * 13 + dn) / 14; } else { g = (this.sumG + up) / 14; ls = (this.sumL + dn) / 14; }
        }
        const rsi = 100 - 100 / (1 + (ls === 0 ? 1e9 : g / ls));
        let hh = plus ? h : -1e18, ll = plus ? l : 1e18; const kk = plus ? 13 : 14, hs = this.hi.length;
        for (let j = 0; j < kk; j++) { hh = Math.max(hh, this.hi[hs - 1 - j]); ll = Math.min(ll, this.lo[hs - 1 - j]); }
        const last = plus ? c : this.prevC, wr = hh > ll ? (hh - last) / (hh - ll) * -100 : -50;
        mom = (clamp1((rsi - 23) / 54 * 2 - 1) * MIX.R + clamp1((wr + 90) / 80 * 2 - 1) * MIX.W) / (MIX.R + MIX.W);
      }
    }
    return { trend, mom, lines };
  }
  // one incoming bar: bid = the rung bar it belongs to; doneNow = that rung bar is finished at this bar's close
  step(bid, doneNow, high, low, close) {
    if (this.curId === null || bid !== this.curId) {
      if (this.curId !== null) {
        const c = this.curC, n = this.n;
        if (n === 0) this.e5 = this.e8 = this.e13 = this.e21 = this.e34 = c;
        else {
          this.e5 = c * K5 + this.e5 * (1 - K5); this.e8 = c * K8 + this.e8 * (1 - K8); this.e13 = c * K13 + this.e13 * (1 - K13);
          this.e21 = c * K21 + this.e21 * (1 - K21); this.e34 = c * K34 + this.e34 * (1 - K34);
        }
        const sz = this.cl.length;
        this.s50 += c - (n >= 50 ? this.cl[sz - 50] : 0); this.s100 += c - (n >= 100 ? this.cl[sz - 100] : 0);
        this.s150 += c - (n >= 150 ? this.cl[sz - 150] : 0); this.s200 += c - (n >= 200 ? this.cl[sz - 200] : 0);
        this.cl.push(c); if (this.cl.length > 200) this.cl.shift();
        if (n >= 1) {
          const dlt = c - this.prevC, up = dlt > 0 ? dlt : 0, dn = dlt < 0 ? -dlt : 0;
          if (n <= 13) { this.sumG += up; this.sumL += dn; }
          else if (n === 14) { this.ag = (this.sumG + up) / 14; this.al = (this.sumL + dn) / 14; }
          else { this.ag = (this.ag * 13 + up) / 14; this.al = (this.al * 13 + dn) / 14; }
        }
        this.prevC = c; this.hi.push(this.curH); this.lo.push(this.curL);
        if (this.hi.length > 14) { this.hi.shift(); this.lo.shift(); }
        this.n += 1;
      }
      this.curId = bid; this.curH = high; this.curL = low; this.curC = close;
    } else { this.curH = Math.max(this.curH, high); this.curL = Math.min(this.curL, low); this.curC = close; }
    const dev = this.read(true, this.curH, this.curL, this.curC), fin = this.read(false, this.curH, this.curL, this.curC);
    return { dev, cmp: doneNow ? dev : fin, n: this.n };
  }
}
export const rungVal = (r) => (r.trend == null ? null : r.mom == null ? r.trend : (FAM.T * r.trend + FAM.M * r.mom) / (FAM.T + FAM.M));
// the calendar rules of the script: next NYSE session by rule (weekends + the ten regular holidays)
const ymd = (ed) => { const d = new Date(ed * 86400000 + 43200000); return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]; };
export function easterDay(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), dd = ((h + l - 7 * m + 114) % 31) + 1;
  return Math.floor(Date.UTC(y, mo - 1, dd) / 86400000);
}
export function isHoliday(ed) {
  const [y, mo, d] = ymd(ed), wd = (ed + 4) % 7;
  return (mo === 1 && (d === 1 || (d === 2 && wd === 1))) || (mo === 1 && wd === 1 && d >= 15 && d <= 21) || (mo === 2 && wd === 1 && d >= 15 && d <= 21) ||
    ed === easterDay(y) - 2 || (mo === 5 && wd === 1 && d >= 25) || (y >= 2022 && mo === 6 && (d === 19 || (d === 18 && wd === 5) || (d === 20 && wd === 1))) ||
    (mo === 7 && (d === 4 || (d === 3 && wd === 5) || (d === 5 && wd === 1))) || (mo === 9 && wd === 1 && d <= 7) || (mo === 11 && wd === 4 && d >= 22 && d <= 28) ||
    (mo === 12 && (d === 25 || (d === 24 && wd === 5) || (d === 26 && wd === 1)));
}
export function nextSession(ed) { let nx = ed + 1; for (let i = 0; i < 8; i++) { const wd = (nx + 4) % 7; if (wd === 0 || wd === 6 || isHoliday(nx)) nx += 1; else break; } return nx; }

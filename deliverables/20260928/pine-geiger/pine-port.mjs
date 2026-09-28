/* N8 · the Pine script's rung maths, line for line (SCINTILLA-GEIGER-TABLE.pine → rungRead). Used by
   validate.mjs and mock-data.mjs. Equalizer family and momentum mix: today's saved values. */
export const FAM = { T: 0.5, M: 0.5 }, MIX = { R: 0.6, W: 0.4 };
const clamp1 = (x) => Math.max(-1, Math.min(1, x));
export function rungRead(c, h, l) {
  const n = c.length; if (n < 8) return null;
  let e5 = c[0], e8 = c[0], e13 = c[0], e21 = c[0], e34 = c[0];
  for (let i = 1; i < n; i++) { const x = c[i];
    e5 = x * (2 / 6) + e5 * (1 - 2 / 6); e8 = x * (2 / 9) + e8 * (1 - 2 / 9); e13 = x * (2 / 14) + e13 * (1 - 2 / 14);
    e21 = x * (2 / 22) + e21 * (1 - 2 / 22); e34 = x * (2 / 35) + e34 * (1 - 2 / 35); }
  const fan = [e5, e8]; if (n >= 13) fan.push(e13); if (n >= 21) fan.push(e21); if (n >= 34) fan.push(e34);
  for (const len of [50, 100, 150, 200]) if (n >= len) { let s = 0; for (let j = n - len; j < n; j++) s += c[j]; fan.push(s / len); }
  const pairs = fan.length - 1; let io = 0; for (let i = 0; i < pairs; i++) if (fan[i] > fan[i + 1]) io++;
  const trend = (2 * io - pairs) / pairs; let mom = null, comp = trend;
  if (n >= 15) {
    let g = 0, ls = 0; for (let i = 1; i <= 14; i++) { const d = c[i] - c[i - 1]; if (d > 0) g += d; else ls -= d; } g /= 14; ls /= 14;
    for (let i = 15; i < n; i++) { const d = c[i] - c[i - 1]; g = (g * 13 + (d > 0 ? d : 0)) / 14; ls = (ls * 13 + (d < 0 ? -d : 0)) / 14; }
    const rsi = 100 - 100 / (1 + (ls === 0 ? 1e9 : g / ls));
    let hh = -1e18, ll = 1e18; for (let j = n - 14; j < n; j++) { hh = Math.max(hh, h[j]); ll = Math.min(ll, l[j]); }
    const wr = hh > ll ? (hh - c[n - 1]) / (hh - ll) * -100 : -50;
    mom = (clamp1((rsi - 23) / 54 * 2 - 1) * MIX.R + clamp1((wr + 90) / 80 * 2 - 1) * MIX.W) / (MIX.R + MIX.W);
    comp = (FAM.T * trend + FAM.M * mom) / (FAM.T + FAM.M);
  }
  return { trend, mom, comp, lines: fan.length };
}


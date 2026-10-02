/* X1 mock pages · shared drawing on window.MOCK (data/mock-data.js). Static: nothing is fetched, nothing is written. */
const M = window.MOCK, L = M.ladder;
const $ = (s, r = document) => r.querySelector(s);
const fG = (g) => g == null ? "—" : (g > 0 ? "+" : "") + g.toFixed(2);
const fP = (p) => p == null ? "—" : (p > 0 ? "+" : "") + p.toFixed(2) + "%";
const fCap = (v) => v == null ? "" : v >= 1e12 ? "$" + (v / 1e12).toFixed(1) + "T" : v >= 1e9 ? "$" + (v / 1e9).toFixed(0) + "B" : "$" + (v / 1e6).toFixed(0) + "M";
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const short = (r) => r.ticker || r.t || (r.label || r.id || "").replace(/^NONE YET · /, "∅ ").replace(/Information Technology/, "TECH").replace(/Communication Services/, "COMMS").replace(/Consumer Discretionary/, "DISCRET").replace(/Consumer Staples/, "STAPLES").replace(/Health Care/, "HEALTH").replace(/Real Estate/, "REAL EST").replace(/Dollar and volatility/, "DOLLAR·VIX").replace(/The whole world/, "WORLD").replace(/US stocks/, "US");
const gOf = (r) => r.g != null ? r.g : r.g_close != null ? r.g_close : r.agg_close;
/* the children rows for a node on the path (what the data file carries) */
const CHILDREN = { MARKET: L.L0.children, US: L.L1.children, US_SECTORS: L.L2.children, SEC_TECH: L.L3.children, SEC_FIN: L.L3_fin.children, SMH: L.L4.children,
  COHORT_AI_ACCELERATORS: L.L5.names, XLF: L.L5_banks.names, US_BROAD: L.L1_funds.children };
const BENCH = { MARKET: "VT", US: "SPY", US_SECTORS: "SPY", SEC_TECH: "XLK", SEC_FIN: "XLF", SMH: "SMH", COHORT_AI_ACCELERATORS: "SMH", XLF: "XLF", US_BROAD: "SPY" };
const LEVEL = { MARKET: "L0 market", US: "L1 asset class", US_SECTORS: "L2 sectors", SEC_TECH: "L3 industry funds", SEC_FIN: "L3 industry funds", SMH: "L4 cohorts", COHORT_AI_ACCELERATORS: "L5 names", XLF: "L5 names", US_BROAD: "L1 broad funds" };
const PARENT = { US: "MARKET", US_SECTORS: "US", SEC_TECH: "US_SECTORS", SEC_FIN: "US_SECTORS", SMH: "SEC_TECH", COHORT_AI_ACCELERATORS: "SMH", XLF: "SEC_FIN", US_BROAD: "US" };
const ID_OF = (r) => r.id || r.t;
function crumbsHTML(node) { const path = []; for (let n = node; n; n = PARENT[n]) path.unshift(n); return path.map((n, i) => (i ? '<span class="arrow">▸</span>' : "") + '<span class="c' + (n === node ? " here" : "") + '" data-node="' + n + '">' + esc(M.path_labels[n] || n) + "</span>").join(""); }
function bowtieHTML(rows, { sub = "n", span = null, live = false } = {}) {
  const vals = rows.map(gOf).filter((v) => v != null); const S = span || Math.max(0.2, ...vals.map(Math.abs));
  return '<div class="bt" style="--n:' + rows.length + '">' + rows.map((r) => {
    const g = gOf(r), up = g != null && g >= 0, h = g == null ? 0 : Math.min(50, 50 * Math.abs(g) / S);
    const name = '<span class="name" title="' + esc(r.label || r.t) + '">' + esc(short(r)) + "</span>", val = '<span class="val ' + (up ? "up" : "dn") + '">' + fG(g) + "</span>";
    const liveG = live && r.g_live != null ? '<span class="tick" style="' + (r.g_live >= 0 ? "bottom:calc(50% + " + Math.min(50, 50 * Math.abs(r.g_live) / S) + "%)" : "top:calc(50% + " + Math.min(50, 50 * Math.abs(r.g_live) / S) + "%)") + '" title="live Hub reading ' + fG(r.g_live) + '"></span>' : "";
    const subTxt = sub === "n" ? (r.agg_n ? r.agg_n + (r.kind === "fund" ? " holdings" : r.kind === "index" ? " lines" : " names") : r.members ? r.members + " names" : r.kind === "fund" ? "own" : "") : sub === "chg" ? fP(r.chg1d) : sub === "rel" ? (r.rel21 == null ? "" : "1M " + fP(r.rel21)) : sub === "quad" ? (r.rrg ? r.rrg.quadrant.toLowerCase() : "") : "";
    return '<div class="col" data-node="' + ID_OF(r) + '"><div class="slot">' + (up ? name + val : "") + '</div><div class="track">' + (g == null ? "" : '<div class="bar ' + (up ? "up" : "dn") + '" style="height:' + h + '%"></div>') + liveG + '</div><div class="slot b">' + (up ? "" : val + name) + '</div><div class="sub">' + esc(subTxt) + "</div></div>";
  }).join("") + "</div>";
}
function gridHTML(rows, { text = "chg" } = {}) {
  const sorted = rows.slice().sort((a, b) => (b.mcap || 0) - (a.mcap || 0));
  return '<div class="grid">' + sorted.map((r) => { const g = gOf(r), a = g == null ? 0 : Math.min(1, Math.abs(g)); const col = g == null ? "transparent" : (g >= 0 ? "rgba(53,176,106," : "rgba(209,72,63,") + (0.18 + 0.72 * a).toFixed(2) + ")";
    return '<div class="tile" data-node="' + ID_OF(r) + '" style="background:' + col + '"><b>' + esc(short(r)) + "</b><span>" + (text === "chg" ? fP(r.chg1d) : fG(g)) + "</span>" + (r.mcap ? "<i>" + fCap(r.mcap) + "</i>" : "") + "</div>"; }).join("") + "</div>";
}
function rrgSVG(rows, bench) {
  const R = 3.2, W = 600, H = 420, pl = 36, pr = 16, pt = 14, pb = 26, PW = W - pl - pr, PH = H - pt - pb;
  const X = (v) => pl + ((v - (100 - R)) / (2 * R)) * PW, Y = (v) => pt + PH - ((v - (100 - R)) / (2 * R)) * PH, cx = pl + PW / 2, cy = pt + PH / 2;
  const greys = ["#c8c8c8", "#a9a9a9", "#8e8e8e", "#d2d2d2", "#b5b5b5", "#9b9b9b", "#c0c0c0", "#a0a0a0", "#8a8a8a", "#cdcdcd", "#aeaeae", "#949494", "#bcbcbc"];
  let s = '<svg class="rrg" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="rotation vs ' + esc(bench) + '">';
  s += '<rect x="' + pl + '" y="' + pt + '" width="' + PW + '" height="' + PH + '" fill="#111" stroke="#272727"/>';
  s += '<line x1="' + pl + '" x2="' + (pl + PW) + '" y1="' + cy + '" y2="' + cy + '" stroke="#333"/><line y1="' + pt + '" y2="' + (pt + PH) + '" x1="' + cx + '" x2="' + cx + '" stroke="#333"/>';
  const lab = (t, x, y, a) => '<text x="' + x + '" y="' + y + '" fill="#6a6a6a" font-size="9" font-family="ui-monospace,Menlo,monospace" text-anchor="' + (a || "start") + '">' + t + "</text>";
  s += lab("IMPROVING", pl + 6, pt + 12) + lab("LEADING", pl + PW - 6, pt + 12, "end") + lab("LAGGING", pl + 6, pt + PH - 6) + lab("WEAKENING", pl + PW - 6, pt + PH - 6, "end") + lab("RS-RATIO →", cx + 6, H - 8) + '<text transform="translate(' + (pl - 12) + " " + (cy - 6) + ') rotate(-90)" fill="#6a6a6a" font-size="9" font-family="ui-monospace,Menlo,monospace">RS-MOM →</text>';
  rows.forEach((r, i) => { if (!r.rrg) return; const c = r.rrg.quadrant === "LEADING" || r.rrg.quadrant === "IMPROVING" ? (r.rrg.mom >= 100 ? "#35b06a" : greys[i % greys.length]) : (r.rrg.quadrant === "LAGGING" ? "#d1483f" : greys[i % greys.length]);
    const pts = r.rrg.tail.map(([a, b]) => [X(a), Y(b)]);
    for (let k = 1; k < pts.length; k++) s += '<line x1="' + pts[k - 1][0].toFixed(1) + '" y1="' + pts[k - 1][1].toFixed(1) + '" x2="' + pts[k][0].toFixed(1) + '" y2="' + pts[k][1].toFixed(1) + '" stroke="' + c + '" stroke-width="1.6" opacity="' + (0.15 + 0.6 * k / (pts.length - 1)).toFixed(2) + '"/>';
    const [hx, hy] = pts[pts.length - 1]; s += '<circle cx="' + hx.toFixed(1) + '" cy="' + hy.toFixed(1) + '" r="5" fill="' + c + '"/><text x="' + (hx + 8).toFixed(1) + '" y="' + (hy + 3).toFixed(1) + '" fill="#cdcdcd" font-size="10" font-weight="700" font-family="ui-monospace,Menlo,monospace">' + esc(short(r)) + "</text>"; });
  return s + "</svg>";
}
function relSVG(syms, bench, bars) {
  const T = M.closes_tail; if (!T[bench]) return '<div class="note">no close series</div>';
  const W = 600, H = 300, pl = 44, pr = 60, pt = 10, pb = 18, PW = W - pl - pr, PH = H - pt - pb;
  const b = T[bench].slice(-bars - 1); const t0 = b[0][0]; const lines = [];
  for (const s of syms) { const c = (T[s] || []).filter(([t]) => t >= t0); if (c.length < 10) continue; const base = c[0][1]; lines.push({ s, v: c.map(([t, x]) => 100 * (x / base - 1)) }); }
  const all = lines.flatMap((l) => l.v); const lo = Math.min(...all, 0), hi = Math.max(...all, 0);
  const X = (i, n) => pl + (i / (n - 1)) * PW, Y = (v) => pt + PH - ((v - lo) / (hi - lo || 1)) * PH;
  let s = '<svg class="rrg" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid meet"><rect x="' + pl + '" y="' + pt + '" width="' + PW + '" height="' + PH + '" fill="#111" stroke="#272727"/>';
  s += '<line x1="' + pl + '" x2="' + (pl + PW) + '" y1="' + Y(0) + '" y2="' + Y(0) + '" stroke="#333"/>';
  s += '<text x="' + (pl - 4) + '" y="' + (pt + 9) + '" text-anchor="end" fill="#6a6a6a" font-size="9" font-family="ui-monospace,Menlo,monospace">' + hi.toFixed(1) + '%</text><text x="' + (pl - 4) + '" y="' + (pt + PH) + '" text-anchor="end" fill="#6a6a6a" font-size="9" font-family="ui-monospace,Menlo,monospace">' + lo.toFixed(1) + "%</text>";
  for (const l of lines) { const last = l.v[l.v.length - 1], col = last >= 0 ? "#35b06a" : "#d1483f"; s += '<polyline fill="none" stroke="' + col + '" stroke-width="' + (l.s === bench ? 2.2 : 1.2) + '" opacity="' + (l.s === bench ? 1 : 0.8) + '" points="' + l.v.map((v, i) => X(i, l.v.length).toFixed(1) + "," + Y(v).toFixed(1)).join(" ") + '"/>';
    s += '<text x="' + (pl + PW + 4) + '" y="' + (Y(last) + 3).toFixed(1) + '" fill="' + col + '" font-size="9" font-family="ui-monospace,Menlo,monospace">' + esc(l.s) + " " + fP(last) + "</text>"; }
  return s + "</svg>";
}
function gmini(g, span = 1) { if (g == null) return '<span class="gm"></span>'; const w = Math.min(50, 50 * Math.abs(g) / span); return '<span class="gm"><i style="' + (g >= 0 ? "left:50%;background:var(--up)" : "right:50%;background:var(--dn)") + ";width:" + w + '%"></i></span>'; }
Object.assign(window, { M, L, $, fG, fP, fCap, esc, short, gOf, CHILDREN, BENCH, LEVEL, PARENT, crumbsHTML, bowtieHTML, gridHTML, rrgSVG, relSVG, gmini });

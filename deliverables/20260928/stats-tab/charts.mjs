/* charts.mjs — the one drawing module for Statistics findings cards.
   Pure functions: data in, an SVG string out. The same function draws the saved .svg file next to the page and the
   inline copy on the page, so the picture Alan sees is the picture that persists. Rules baked in (28 Sep standard):
   · dark surface, mono labels, no white;
   · every grey has channels within 24 of each other and none above 210;
   · NO GREY MARKS: a share is green above its own any-day line and red below it; a gain is green, a loss is red;
     a fear measure (VIX, a drop) is drawn in the down colour; nothing neutral;
   · two series are told apart by TEXTURE (solid vs striped), never by hue — hue is reserved for direction;
   · text is 12px or larger at the size the chart is shown; the phone variant redraws, it does not shrink;
   · the title, the sample and the build date live INSIDE the file, so the picture stands alone in a folder. */

export const PAL = {
  bg: "#07070C", panel: "#0F0F18", hair: "#2A2A36", ink: "#C8C8D2", muted: "#8A8A9E", faint: "#5C5C6C",
  up: "#00FFA3", dn: "#FF2D55",
};
const FONT = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";
const BODY = "-apple-system,'Helvetica Neue',Arial,sans-serif";
const HALO = `paint-order="stroke" stroke="${PAL.bg}" stroke-width="4" stroke-linejoin="round"`;

export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const pct = (v, d = 1) => (v == null || !Number.isFinite(+v) ? "—" : (+v).toFixed(d) + "%");
export const signed = (v, d = 1) => (v == null || !Number.isFinite(+v) ? "—" : (v > 0 ? "+" : "") + (+v).toFixed(d) + "%");
export const thousands = (n) => (n == null ? "—" : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","));

/* The grey rule, as a function, so a test can hold every colour in this file to it. */
export function isScintillaGrey(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return false;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
  return Math.max(r, g, b) <= 210 && Math.max(r, g, b) - Math.min(r, g, b) <= 24;
}

/* Colour of a mark. mode "vsRef": green at/above its reference line, red below. mode "down": the down colour (fear,
   drops). mode "up": the up colour (gains). mode "sign": by the sign of the value. A "vsRef" mark with no
   reference is a fault, never a grey. */
export function markColour(value, ref, mode = "vsRef") {
  if (mode === "down") return PAL.dn;
  if (mode === "up") return PAL.up;
  if (mode === "sign") return value >= 0 ? PAL.up : PAL.dn;
  if (ref == null || !Number.isFinite(+ref)) throw new Error("vsRef mark without a reference line");
  return value >= ref ? PAL.up : PAL.dn;
}

/* Round axis ticks: a step of 1, 2, 5, 10, 20, 25, 50 … so the axis reads 40, 50, 60 and never 53, 65, 78. */
export function niceTicks(min, max, want = 5) {
  const span = max - min, raw = span / Math.max(1, want - 1), mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= want) || 10 * mag;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

/* Word-wrap for SVG text: greedy on a character budget (mono ≈ 0.62em per char, body ≈ 0.52em). */
export function wrap(text, maxChars) {
  const words = String(text || "").split(/\s+/).filter(Boolean), lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

const defs = (id) =>
  `<defs><pattern id="${id}-stripe" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
  `<rect width="7" height="7" fill="rgba(7,7,12,0)"/><rect width="3.5" height="7" fill="rgba(7,7,12,.72)"/></pattern></defs>`;

/* One panel of grouped bars. groups: [{label, sub, bars:[{value, n, series, ref, mode, opacity, tip}]}].
   refs: [{value, label, dash}] reference lines (the any-day lines), drawn dashed in ink; their labels go in the
   legend, never on the plot, so they cannot collide with a value. A bar's own ref decides its colour. */
export function barsPanel({ id, x, y, w, h, groups, refs = [], yMax, yMin = 0, unit = "%", mode = "vsRef", compact = false, valueFmt }) {
  const fmt = valueFmt || ((v) => (unit === "%" ? pct(v) : String(v)));
  const fs = compact ? 13 : 12;
  const labelFor = (g) => (compact && g.short ? g.short : g.label);
  const gW0 = (w - (compact ? 40 : 46) - 10) / groups.length;
  const wide = (t) => t.length * fs * 0.62 > gW0 - 4;
  /* phone rule: when any label is wider than its slot, every label hangs at 38° (the counts move to the tip) */
  const rot = compact && groups.some((g) => wide(labelFor(g)));
  const top = 12, bottom = rot ? 66 : 40, left = compact ? 40 : 46, right = 10;
  const pw = w - left - right, ph = h - top - bottom;
  const scale = (v) => top + ph - ((v - yMin) / (yMax - yMin)) * ph;
  const gW = pw / groups.length;
  const nSeries = Math.max(...groups.map((g) => g.bars.length));
  const gap = 2, inner = Math.min(gW * 0.74, (compact ? 46 : 64) * nSeries);
  const bW = (inner - gap * (nSeries - 1)) / nSeries;
  /* crowded bars (under 40px) print the value rounded; the exact value stays in the tip */
  const crowded = bW < 40;
  const vfmt = (v) => (crowded && unit === "%" ? Math.round(v) + "%" : crowded && !valueFmt ? String(Math.round(v)) : fmt(v));
  let s = `<g transform="translate(${x},${y})" font-family="${FONT}">`;
  for (const v of niceTicks(yMin, yMax, compact ? 4 : 5)) {
    const yy = scale(v);
    s += `<line x1="${left}" x2="${left + pw}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" stroke="${PAL.hair}" stroke-width="1"/>`;
    s += `<text x="${left - 6}" y="${(yy + 4).toFixed(1)}" text-anchor="end" font-size="${fs - 1}" fill="${PAL.faint}">${esc(unit === "%" ? v + "%" : v)}</text>`;
  }
  refs.forEach((r) => {
    if (r == null || !Number.isFinite(+r.value)) return;
    const yy = scale(r.value);
    s += `<line x1="${left}" x2="${left + pw}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" stroke="${PAL.ink}" stroke-width="1.2" stroke-dasharray="${r.dash || "5 4"}"/>`;
  });
  groups.forEach((g, gi) => {
    const gx = left + gi * gW + (gW - inner) / 2;
    g.bars.forEach((b, bi) => {
      const bx = gx + bi * (bW + gap), r = b.ref != null ? b.ref : refs[bi] ? refs[bi].value : refs[0] && refs[0].value;
      const col = markColour(b.value, r, b.mode || mode);
      const y0 = scale(Math.min(yMax, Math.max(b.value, yMin))), y1 = scale(yMin), hh = Math.max(y1 - y0, 1.5);
      /* a second bar's value label that would sit on the first's is lifted above it */
      const prevY = bi > 0 ? scale(Math.min(yMax, Math.max(g.bars[bi - 1].value, yMin))) : null;
      const labelY = prevY != null && Math.abs(prevY - y0) < 13 && bW < 30 ? Math.min(prevY, y0) - 5 - 13 : y0 - 5;
      const op = b.opacity != null ? b.opacity : 0.9;
      const tip = b.tip || `${g.label}${b.series ? " · " + b.series : ""}: ${fmt(b.value)}${b.n != null ? " · n " + thousands(b.n) : ""}`;
      s += `<g class="mark" data-tip="${esc(tip)}"><title>${esc(tip)}</title>`;
      s += `<rect x="${bx.toFixed(1)}" y="${y0.toFixed(1)}" width="${bW.toFixed(1)}" height="${hh.toFixed(1)}" rx="3" ry="3" fill="${col}" fill-opacity="${op}"/>`;
      if (bi === 1) s += `<rect x="${bx.toFixed(1)}" y="${y0.toFixed(1)}" width="${bW.toFixed(1)}" height="${hh.toFixed(1)}" rx="3" ry="3" fill="url(#${id}-stripe)"/>`;
      /* the value on top in ink with a dark halo; never a number in the series colour */
      s += `<text x="${(bx + bW / 2).toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" font-size="${fs}" fill="${PAL.ink}" ${HALO}>${esc(vfmt(b.value))}</text>`;
      s += `</g>`;
    });
    const lx = left + gi * gW + gW / 2, ly = top + ph + 16;
    const label = labelFor(g);
    if (rot) {
      s += `<text x="${(lx + 5).toFixed(1)}" y="${ly - 2}" transform="rotate(-38 ${(lx + 5).toFixed(1)} ${ly - 2})" text-anchor="end" font-size="${fs}" fill="${PAL.ink}">${esc(label)}</text>`;
      return;
    }
    s += `<text x="${lx.toFixed(1)}" y="${ly}" text-anchor="middle" font-size="${fs}" fill="${PAL.ink}">${esc(label)}</text>`;
    if (g.sub) {
      /* a sub-label that would run into its neighbour keeps only its first word (the count) */
      const fits = g.sub.length * (fs - 1) * 0.62 <= gW - 6, sub = fits ? g.sub : g.sub.split(" ")[0];
      s += `<text x="${lx.toFixed(1)}" y="${ly + fs + 2}" text-anchor="middle" font-size="${fs - 1}" fill="${PAL.muted}">${esc(sub)}</text>`;
    }
  });
  s += `</g>`;
  return s;
}

/* The document: a titled dark panel; the header wraps, the legend sits under it, then the body, then the footer.
   body is a function of the y where the plot may start and the height it may use. */
export function svgDoc({ id, w, h, title, subtitle, footer, body, legend = [], compact = false }) {
  const pad = 18;
  const tl = wrap(title, compact ? 40 : 110), sl = wrap(subtitle || "", compact ? 46 : 150), fl = wrap(footer || "", compact ? 46 : 150);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}" data-chart="${esc(id)}" font-family="${BODY}">`;
  s += defs(id);
  s += `<rect width="${w}" height="${h}" fill="${PAL.bg}"/>`;
  let y = pad + 14;
  tl.forEach((t, i) => { s += `<text x="${pad}" y="${y}" font-size="16" font-weight="700" fill="${PAL.ink}">${esc(t)}</text>`; y += 20; });
  sl.forEach((t) => { s += `<text x="${pad}" y="${y}" font-size="12" fill="${PAL.muted}" font-family="${FONT}">${esc(t)}</text>`; y += 16; });
  if (legend.length) {
    let lx = pad;
    legend.forEach((l) => {
      const lw = l.label.length * 7.4 + 24;
      if (lx > pad && lx + lw > w - pad) { lx = pad; y += 18; }   // an entry that would run off the edge starts a new row
      s += `<g transform="translate(${lx.toFixed(1)},${y - 2})">`;
      if (l.line) s += `<line x1="0" x2="18" y1="6" y2="6" stroke="${PAL.ink}" stroke-width="1.2" stroke-dasharray="${l.dash || "5 4"}"/>`;
      else { s += `<rect x="0" y="0" width="16" height="12" rx="2" fill="${l.colour || PAL.ink}" fill-opacity=".9"/>`; if (l.stripe) s += `<rect x="0" y="0" width="16" height="12" rx="2" fill="url(#${id}-stripe)"/>`; }
      s += `<text x="24" y="10" font-size="12" fill="${PAL.ink}" font-family="${FONT}">${esc(l.label)}</text></g>`;
      lx += lw + 16;
    });
    y += 18;
  }
  const footH = fl.length ? fl.length * 15 + 8 : 6;
  s += body(y + 4, h - y - 4 - footH);
  let fy = h - footH + 12;
  fl.forEach((t) => { s += `<text x="${pad}" y="${fy}" font-size="11.5" fill="${PAL.muted}" font-family="${FONT}">${esc(t)}</text>`; fy += 15; });
  s += `</svg>`;
  return s;
}

/* ── the card charts ─────────────────────────────────────────────────────────────────────────────────── */

/* Grouped shares by step with one or two series (second series striped). Each series has its own any-day line. */
export function stepsChart({ id, title, subtitle, footer, steps, series, refs, compact = false, yMax = 90, yMin = 40, unit = "%" }) {
  const w = compact ? 390 : 1200, h = compact ? 430 : 440;
  const groups = steps.map((st) => ({
    label: st.label, short: st.short, sub: st.sub || (st.n ? st.n.map(thousands).join(compact ? "·" : " · ") : ""),
    bars: series.map((se, i) => ({ value: st.values[i], n: st.n ? st.n[i] : null, series: se.label, ref: refs[i] ? refs[i].value : null,
      tip: `${st.label} · ${se.label}: ${pct(st.values[i])} of ${thousands(st.n ? st.n[i] : null)} (any day ${pct(refs[i] ? refs[i].value : null)})` })),
  }));
  const dashes = ["5 4", "2 4"];
  const legend = [...series.map((se, i) => ({ label: se.label, colour: PAL.ink, stripe: i === 1 })), ...refs.map((r, i) => ({ label: r.label, line: true, dash: dashes[i] }))];
  const body = (y, hh) => barsPanel({ id, x: 0, y, w, h: hh, groups, refs: refs.map((r, i) => ({ ...r, dash: dashes[i] })), yMax, yMin, unit, compact });
  return svgDoc({ id, w, h, title, subtitle, footer, body, legend, compact });
}

/* Two panels one above the other sharing the same groups (the 200-day band: up-after-60 and the 10%-drop share). */
export function twoPanelChart({ id, title, subtitle, footer, groups, panels, compact = false }) {
  const w = compact ? 390 : 1200, h = compact ? 640 : 660;
  const legend = panels.filter((p) => p.ref).map((p) => ({ label: p.ref.label, line: true }));
  const body = (y0, hh) => {
    const ph = hh / panels.length;
    let s = "";
    panels.forEach((p, i) => {
      const y = y0 + i * ph;
      s += `<text x="18" y="${y + 12}" font-size="13" fill="${PAL.ink}" font-family="${FONT}" font-weight="700">${esc(p.label)}</text>`;
      s += barsPanel({ id: id + i, x: 0, y: y + 8, w, h: ph - 8, groups: groups.map((g) => ({ label: g.label, short: g.short, sub: g.sub, bars: [{ value: g[p.key], n: g.days, mode: p.mode, ref: p.ref ? p.ref.value : null, opacity: p.mode === "down" ? 0.35 + 0.6 * (g[p.key] / p.yMax) : 0.9, tip: `${g.label}: ${p.label} ${pct(g[p.key])} · ${thousands(g.days)} days` }] })), refs: p.ref ? [p.ref] : [], yMax: p.yMax, yMin: p.yMin || 0, mode: p.mode, compact });
    });
    return s;
  };
  return svgDoc({ id, w, h, title, subtitle, footer, body, legend, compact });
}

/* One row of bars, one series (depth buckets, halves of history). */
export function barsChart({ id, title, subtitle, footer, groups, ref, mode = "vsRef", yMax = 100, yMin = 0, unit = "%", compact = false, valueFmt, legend }) {
  const w = compact ? 390 : 1200, h = compact ? 360 : 440;
  const lg = legend || (ref ? [{ label: ref.label, line: true }] : []);
  const body = (y, hh) => barsPanel({ id, x: 0, y, w, h: hh, groups, refs: ref ? [ref] : [], yMax, yMin, unit, mode, compact, valueFmt });
  return svgDoc({ id, w, h, title, subtitle, footer, body, legend: lg, compact });
}

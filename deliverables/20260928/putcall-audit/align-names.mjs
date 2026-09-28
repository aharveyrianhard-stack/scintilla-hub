/* Put/call audit, 28 Sep 2026 — single names, IBKR against Cboe's free delayed option chain.
   The one method used for every cell of the page's table 3.3 and for the chart next to it.

   METHOD (call-matched). Cboe's delayed chain and IBKR's reader both count calls and puts on
   every exchange, so their running CALL totals are the same number at different moments.
   For each name and each check:
     1. find the moment IBKR's running call total equals Cboe's call total (straight line
        between the two IBKR readings either side, ~32 s apart);
     2. read IBKR's running put total at that same moment;
     3. gap = IBKR puts minus Cboe puts, as a share of Cboe puts. The calls agree by
        construction, so this is also the ratio gap.
   The time between that moment and Cboe's stamp is the name's own delay.

   ALIGNED OR NOT. All eight chains of one check were fetched within ~15 s from the same feed,
   so they share one delay: the median of the eight names' own delays. A name is compared
   only when its own delay sits within ALIGN_TOLERANCE_MIN of that shared delay. The
   tolerance is two IBKR reading intervals (2 × ~32 s), the finest timing the readings can
   resolve. A name outside it has call totals that disagree with Cboe's at the shared delay,
   so its put gap is not reported.

   node align-names.mjs   → rewrites single_names_aligned in putcall-audit.json, the chart
                            ibkr-vs-cboe-names.svg and the rows of table 3.3 in the page.
                            Reads only the saved JSON. */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const NAMES = ["AAPL", "NVDA", "TSLA", "AMZN", "MSFT", "SPY", "QQQ", "IWM"];
export const CHECKS = [["single_names_vs_cboe", "09:55 ET"], ["single_names_vs_cboe_pass2", "10:07 ET"]];
export const ALIGN_TOLERANCE_MIN = 1.0;

const r1 = (x) => Math.round(x * 10) / 10;
const r3 = (x) => Math.round(x * 1000) / 1000;
const stampMs = (s) => Date.parse(s.replace(" ", "T") + "Z");
const median = (xs) => { const v = [...xs].sort((a, b) => a - b), m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
const utc = (ms) => new Date(ms).toISOString().slice(11, 19);

/* rows: [[ms, call, put], ...] in time order. Returns the call-matched moment or null. */
export function callMatch(rows, cboe) {
  for (let i = 1; i < rows.length; i++) {
    const [ta, ca, pa] = rows[i - 1], [tb, cb, pb] = rows[i];
    if (ca <= cboe.call_vol && cboe.call_vol <= cb && cb > ca) {
      const w = (cboe.call_vol - ca) / (cb - ca);
      const t = ta + w * (tb - ta), put = pa + w * (pb - pa);
      return { t, put, bracket_s: (tb - ta) / 1000 };
    }
  }
  return null;
}

export function alignAll(data) {
  const out = { method: "call-matched: IBKR puts at the moment IBKR's running call total equals Cboe's chain call total",
    tolerance_min: ALIGN_TOLERANCE_MIN, checks: {} };
  for (const [key, label] of CHECKS) {
    const per = {};
    for (const s of NAMES) {
      const cboe = data[key][s].cboe;
      const m = callMatch(data.ibkr_series_since_open.rows[s], cboe);
      per[s] = m ? { cboe_stamp_utc: cboe.stamp.slice(11), cboe_pc: cboe.pc, cboe_call_vol: cboe.call_vol, cboe_put_vol: cboe.put_vol,
        call_matched_utc: utc(m.t), own_delay_min: (stampMs(cboe.stamp) - m.t) / 60000, bracket_s: m.bracket_s,
        ibkr_put_vol: Math.round(m.put), ibkr_pc: m.put / cboe.call_vol } : { no_match: true };
    }
    const shared = median(NAMES.filter((o) => !per[o].no_match).map((o) => per[o].own_delay_min));
    for (const s of NAMES) {
      const p = per[s]; if (p.no_match) continue;
      p.shared_delay_min = r1(shared);
      p.aligned = Math.abs(p.own_delay_min - shared) <= ALIGN_TOLERANCE_MIN + 1e-9;
      p.own_delay_min = r1(p.own_delay_min);
      p.put_gap_pct = r1(100 * (p.ibkr_put_vol - p.cboe_put_vol) / p.cboe_put_vol);
      p.ibkr_pc = r3(p.ibkr_pc);
    }
    out.checks[label] = per;
  }
  return out;
}

/* The words a table cell shows for one check: "−8%" or "not aligned". */
export function cell(p) {
  if (!p || p.no_match || !p.aligned) return "not aligned";
  const v = Math.round(p.put_gap_pct);
  return (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(v) + "%";
}

/* Plain words for one name across both checks. */
export function reading(a, b) {
  const v = [a, b].map((p) => (p.aligned ? p.put_gap_pct : null));
  if (v.every((x) => x === null)) return "not aligned either time: its call totals disagree with Cboe's at the shared delay";
  const word = (x) => (x === null ? "not aligned" : x <= -5 ? "IBKR puts low" : x >= 5 ? "IBKR puts high" : "close");
  const [w1, w2] = v.map(word);
  return w1 === w2 ? `${w1} both times` : `${w1}, then ${w2}`;
}

/* The rows of table 3.3, generated from the aligned data so the page cannot drift from it. */
export function tableRows(aligned) {
  const [l1, l2] = Object.keys(aligned.checks);
  return NAMES.map((s) => {
    const a = aligned.checks[l1][s], b = aligned.checks[l2][s];
    return `<tr><td data-l="Name">${s}</td><td data-l="Cboe">${a.cboe_pc.toFixed(3)} · ${b.cboe_pc.toFixed(3)}</td>` +
      `<td data-l="Own delay">${a.own_delay_min.toFixed(1)} · ${b.own_delay_min.toFixed(1)} min</td>` +
      `<td data-l="IBKR − Cboe puts">${cell(a)} · ${cell(b)}</td><td data-l="Reading">${reading(a, b)}</td></tr>`;
  }).join("\n");
}
export const TABLE_START = "<!-- names-table:start (generated by align-names.mjs) -->";
export const TABLE_END = "<!-- names-table:end -->";

/* ---------------------------------------------------------------- chart */
const BG = "#0b0c10", INK = "#c8c8c8", INK2 = "#a0a0a0", DIM = "#707070", LINE = "#2a2b30";
const UP = "#3fae6a", DOWN = "#d2524a", AMBER = "#c8953a";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const text = (x, y, s, size = 13, fill = INK, anchor = "start", weight = 600) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}">${esc(s)}</text>`;

export function chart(aligned) {
  const W = 1200, H = 520, top = 120, base = 420, zero = (top + base) / 2, span = 20;   // ±20%
  const yv = (v) => zero - (base - top) / 2 * Math.max(-span, Math.min(span, v)) / span;
  let b = text(40, 40, "SAME NAME, TWO SOURCES: IBKR PUTS vs CBOE'S OPTION CHAIN, WHEN THE CALLS AGREE", 16);
  b += text(40, 64, "bar = IBKR puts minus Cboe puts (share of Cboe) when IBKR's call total equals Cboe's, so also the ratio gap", 12, DIM);
  b += text(40, 82, "green = IBKR counts more puts, red = fewer · amber outline = not aligned (own delay > 1 min from the shared delay)", 12, DIM);
  b += text(40, 100, "two checks per name: left bar 09:55 ET, right bar 10:07 ET", 12, DIM);
  for (const v of [-20, -10, 10, 20]) b += `<line x1="60" x2="1160" y1="${yv(v).toFixed(1)}" y2="${yv(v).toFixed(1)}" stroke="${LINE}" stroke-dasharray="3 5"/>` + text(54, yv(v) + 4, (v > 0 ? "+" : "") + v + "%", 10, DIM, "end");
  b += `<line x1="60" x2="1160" y1="${zero}" y2="${zero}" stroke="${AMBER}" stroke-width="1.5"/>` + text(54, zero + 4, "0", 10, AMBER, "end");
  const gw = 1100 / NAMES.length, labels = Object.keys(aligned.checks);
  NAMES.forEach((s, i) => {
    const gx = 60 + i * gw;
    labels.forEach((lab, j) => {
      const p = aligned.checks[lab][s], bx = gx + 30 + j * 52;
      if (!p.aligned) {
        b += `<rect x="${bx}" y="${yv(12).toFixed(1)}" width="34" height="${(yv(-12) - yv(12)).toFixed(1)}" fill="none" stroke="${AMBER}" stroke-dasharray="4 3"/>`;
        b += text(bx + 17, zero + 4, "n/a", 11, AMBER, "middle", 500);
        b += text(bx + 17, base + 20, `${p.own_delay_min.toFixed(1)}m`, 10, AMBER, "middle", 500);
        return;
      }
      const v = p.put_gap_pct, y0 = yv(Math.max(v, 0)), h = Math.max(Math.abs(yv(v) - zero), 2);
      b += `<rect x="${bx}" y="${y0.toFixed(1)}" width="34" height="${h.toFixed(1)}" fill="${v >= 0 ? UP : DOWN}"/>`;
      b += text(bx + 17, v >= 0 ? yv(v) - 6 : yv(v) + 15, cell(p), 12, INK, "middle");
      b += text(bx + 17, base + 20, `${p.own_delay_min.toFixed(1)}m`, 10, DIM, "middle", 500);
    });
    b += text(gx + 56, base + 46, s, 14, INK, "middle");
  });
  b += text(40, 500, "small number under each bar = that name's own delay (Cboe stamp minus the call-matched IBKR moment)", 12, DIM);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="IBKR vs Cboe by name"><rect width="${W}" height="${H}" fill="${BG}"/><g font-family="${MONO}">${b}</g></svg>`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const DIR = dirname(fileURLToPath(import.meta.url));
  const path = join(DIR, "putcall-audit.json");
  const data = JSON.parse(readFileSync(path, "utf8"));
  data.single_names_aligned = alignAll(data);
  writeFileSync(path, JSON.stringify(data, null, 1) + "\n");
  writeFileSync(join(DIR, "ibkr-vs-cboe-names.svg"), chart(data.single_names_aligned));
  const hp = join(DIR, "PUTCALL-AUDIT.html"), html = readFileSync(hp, "utf8");
  const i = html.indexOf(TABLE_START), j = html.indexOf(TABLE_END);
  if (i < 0 || j < i) throw new Error("table markers missing in PUTCALL-AUDIT.html");
  writeFileSync(hp, html.slice(0, i + TABLE_START.length) + "\n" + tableRows(data.single_names_aligned) + "\n" + html.slice(j));
  for (const [lab, per] of Object.entries(data.single_names_aligned.checks))
    console.log(lab, NAMES.map((s) => `${s} ${cell(per[s])} (${per[s].own_delay_min}/${per[s].shared_delay_min}m)`).join(" · "));
}

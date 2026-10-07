/* Scintilla · CP2 (7 Oct 2026) · two more parts of a decision card. Pure: no fetch, no DOM.

   THE LEVELS (CZ1): the confluence zones of the name — two or more levels within 1% of each other — with their
   members by the Lab's own labels, NEAREST TO THE PRICE FIRST. Nothing is recomputed here: the zones are CZ1's.

   THE ESTIMATES FLAG LINE (ER1): three questions answered in a fixed order, then the numbers behind them.
     1  is there a one-off inside this year's EPS?      ONE-OFF IN THIS YEAR · ONE-OFF GAIN LEFT OUT · NO ONE-OFF
     2  the next quarter against the company's guide    IN LINE WITH GUIDANCE · ABOVE / BELOW GUIDANCE · NO EPS GUIDANCE
     3  how many analysts carry next year               THIN · n ANALYSTS (fewer than ten) · n ANALYSTS
   plus, when ER1's rule raised them: WIDE RANGE, REVISIONS NOT COMPARABLE, ESTIMATES COPY OLD.
   Only ER1's numbers and its rule's own flags are read; the wording is formed here. A part is a run of bits:
   { t } words and numbers · { pct } a signed, coloured percentage · { dot } a separator. */

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const f2 = (v) => (num(v) == null ? "—" : v.toFixed(2));
const fyWord = (d) => (d ? "FY" + String(d).slice(0, 4) : "—");
export const THIN_BELOW = 10;   // ER1's rule: fewer than ten analysts on next year is thin

/** Zones nearest first. `z`: one name's record from data/zones-cz1-*.json. */
export function zonesNearestFirst(z) {
  if (!z || !Array.isArray(z.zones)) return [];
  return z.zones.map((x) => ({ ...x, members: [...x.members].sort((a, b) => b.v - a.v) }))
    .sort((a, b) => Math.abs(a.d) - Math.abs(b.d) || a.lo - b.lo);
}

/** ER1's record for one name → { chips: [{ word, tone, code }], parts: [{ text, bits }], checked: true }. */
export function flagLine(f) {
  if (!f) return null;
  const codes = (f.flags || []).map((x) => x.code), has = (c) => codes.includes(c);
  const chips = [], parts = [];
  /* 1 · one-off */
  if (has("ONE-OFF")) {
    chips.push({ code: "ONE-OFF", word: "ONE-OFF IN THIS YEAR", tone: "warn" });
    parts.push({ k: "one-off", bits: [
      { t: fyWord(f.fy0) + " EPS " + f2(f.fy0_eps) + " holds ~" + f2(f.one_off_per_share) + " a share of one-off gains" }, { dot: true },
      { t: "clean " + f2(f.clean_fy0) }, { dot: true },
      { t: fyWord(f.fy1) + " " + f2(f.fy1_eps) + " =" }, { pct: num(f.growth_clean) == null ? null : f.growth_clean * 100 }, { t: "on the clean base," }, { pct: num(f.growth_shown) == null ? null : f.growth_shown * 100 }, { t: "as shown" } ] });
  } else if (has("GAAP-GAIN-OUTSIDE")) chips.push({ code: "GAAP-GAIN-OUTSIDE", word: "ONE-OFF GAIN LEFT OUT", tone: "quiet" });
  else chips.push({ code: "NO-ONE-OFF", word: "NO ONE-OFF", tone: "quiet" });
  /* 2 · guidance */
  const v = String(f.guide_verdict || "");
  if (v === "IN LINE") chips.push({ code: "IN-LINE", word: "IN LINE WITH GUIDANCE", tone: "ok" });
  else if (v === "ABOVE GUIDE") chips.push({ code: "ABOVE-GUIDE", word: "ABOVE GUIDANCE", tone: "warn" });
  else if (v === "BELOW GUIDE") chips.push({ code: "BELOW-GUIDE", word: "BELOW GUIDANCE", tone: "warn" });
  else chips.push({ code: "NO-EPS-GUIDE", word: "NO EPS GUIDANCE", tone: "quiet" });
  if (num(f.guide_eps) != null && num(f.next_quarter_consensus) != null) {
    const bits = [{ t: "next quarter · analysts " + f2(f.next_quarter_consensus) + " against the company's " + f2(f.guide_eps) + (num(f.guide_pm) != null ? " ± " + f2(f.guide_pm) : "") }];
    if (num(f.fy1_eps) != null) bits.push({ dot: true }, { t: fyWord(f.fy1) + " " + f2(f.fy1_eps) + " needs " + f2((f.fy1_eps - f.next_quarter_consensus) / 3) + " a quarter after that" });
    parts.push({ k: "guide", bits });
  } else parts.push({ k: "guide", bits: [{ t: "the company gives no EPS number" }] });
  /* 3 · thin */
  const n = num(f.fy1_n);
  if (n != null) chips.push(n < THIN_BELOW ? { code: "THIN", word: "THIN · " + n + " ANALYSTS", tone: "warn" } : { code: "ANALYSTS", word: n + " ANALYSTS", tone: "quiet" });
  /* the rest of ER1's flags */
  if (has("WIDE")) chips.push({ code: "WIDE", word: "WIDE RANGE", tone: "warn" });
  /* two notes about the Hub's own copy of the estimates, not about the company: quiet */
  if (has("KEY-CHANGED")) chips.push({ code: "KEY-CHANGED", word: "REVISIONS NOT COMPARABLE", tone: "quiet" });
  if (has("STALE")) chips.push({ code: "STALE", word: "ESTIMATES COPY OLD", tone: "quiet" });
  return { checked: true, chips, parts, next_report: f.next_report || null, guide_call: f.guide_call || null, basis: f.basis || null };
}

/** The names put side by side on a card: itself, then its same-business peers that have a card. At most `max`. */
export function sideBySide(ticker, peersPriced, cards, max = 5) {
  const out = [ticker];
  for (const p of peersPriced || []) if (p !== ticker && cards[p] && cards[p].business && !out.includes(p)) out.push(p);
  return out.slice(0, max);
}

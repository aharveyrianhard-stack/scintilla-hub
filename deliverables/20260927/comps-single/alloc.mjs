/* Scintilla · K2 · the greying default, proposed by the allocation read.
   Pure functions. The page and the tests import this same file.

   Alan, 27 Sep: "whatever determined the % invested should also propose the large/small blend,
   risk-averse in risky moments — toggles to manipulate, not just a button."

   The allocation tool's GROUND UP tab (scintilla-allocation, branch allocation/ground-up-20260926,
   574dbbe, ground-up-math.mjs) reads the market's CONDITION as a percentile of its own heat history
   and turns it into % invested (grid A) and a large-cap share (grid B + a rotation tilt). The grids
   and the interpolation below are copied from that file unchanged; the two repos do not share code,
   so a test pins the copy to the numbers GROUND UP printed on 26 Sep.

   What is new here, and is a default, not a finding:
   · the RISK LEVEL is proposed from the same condition — balanced at neutral or cooler, easing to
     conservative as the market gets stretched (risk-averse in risky moments). A washed-out market
     does NOT propose aggressive on its own: that step is the operator's, on the dial.
   · the GREYING follows from the blend and the risk level, through the K1 workshop's own rules
     (field.mjs applyToggles): a small-cap sleeve under SMALL_FLOOR_PCT of the book is too thin to
     hold a name, so small caps grey; conservative = LOW (names must earn, handle-with-care themes
     out), balanced = MEDIUM, aggressive = HIGH (no earnings rule). */

import { applyToggles } from "../../20260925/knockout/field.mjs";

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/* ---- copied from ground-up-math.mjs @574dbbe ---------------------------------------------- */
export const ANCHOR_X = [0, 0.25, 0.5, 0.75, 1];
export const GRID_A = { conservative: [75, 60, 40, 20, 10], balanced: [100, 80, 50, 30, 15], aggressive: [100, 100, 70, 40, 25] };
export const GRID_B = { conservative: [40, 50, 60, 75, 85], balanced: [20, 25, 30, 50, 60], aggressive: [10, 15, 20, 40, 50] };
export const RISK_LEVELS = ["conservative", "balanced", "aggressive"];
export const LC_CAP = [10, 90];
export function interp(x, xs, ys) {
  if (x == null) return null;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  for (let i = 1; i < xs.length; i++) if (x <= xs[i]) { const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return ys[i - 1] + t * (ys[i] - ys[i - 1]); }
  return ys[ys.length - 1];
}
export function gridAt(grid, x, R) {
  const r = clamp(+R, 0, 2), lo = Math.floor(r), hi = Math.min(2, lo + 1), t = r - lo;
  const a = interp(x, ANCHOR_X, grid[RISK_LEVELS[lo]]), b = interp(x, ANCHOR_X, grid[RISK_LEVELS[hi]]);
  return a + (b - a) * t;
}
export const TILT_COEF = 25;
/* ---- end of the copy ---------------------------------------------------------------------- */

/* GROUND UP's read on 26 Sep, on its defaults, as its own deliverable printed it
   (deliverables/20260926/allocation-ground-up/ALLOCATION-GROUND-UP.html in that repo).
   GROUND UP computes in the browser and stores nothing, so no Hub page can re-read it: this is
   carried as a dated input and the page says how old it is. */
export const GROUND_UP_READ = {
  date: "2026-09-26", heat: 0.01, pct: 0.25, condition: "OVERSOLD",
  gIWM: 0.19, gSPY: 0.18, invested: 80, lc: 25, risk: "balanced",
  stale: "the ten equity geigers it votes with were last written on 24 Aug (33 days old on 26 Sep)",
  source: "scintilla-allocation · allocation/ground-up-20260926 @574dbbe · its deliverable of 26 Sep",
};

/* Risk proposed from the condition (x: 0 washed out … 0.5 neutral … 1 stretched). */
export const RISK_BY_CONDITION = [1, 1, 1, 0.5, 0];
export const proposeRisk = (x) => x == null ? 1 : interp(x, ANCHOR_X, RISK_BY_CONDITION);
export function riskWord(R) {
  const r = clamp(+R, 0, 2);
  if (Math.abs(r - Math.round(r)) < 1e-9) return RISK_LEVELS[Math.round(r)];
  return r < 1 ? "between conservative and balanced" : "between balanced and aggressive";
}
/* The K1 workshop's three risk rules, reached from the continuous dial. */
export const toK1Risk = (R) => R <= 0.5 ? "LOW" : R < 1.5 ? "MEDIUM" : "HIGH";
export const SMALL_FLOOR_PCT = 20;

/** The whole proposal. x: condition percentile (0..1); spread: IWM geiger − SPY geiger;
    over: {R, lc} the operator's own dial positions (null = take the proposal). */
export function propose({ x, spread = null, over = {}, smallFloor = SMALL_FLOOR_PCT } = {}) {
  const Rp = proposeRisk(x);
  const R = over.R != null ? clamp(+over.R, 0, 2) : Rp;
  const invested = x == null ? null : gridAt(GRID_A, x, R);
  const base = x == null ? 50 : gridAt(GRID_B, x, R);
  const tilt = spread == null ? 0 : TILT_COEF * spread;
  const lcProposed = clamp(base + tilt, LC_CAP[0], LC_CAP[1]);
  const lc = over.lc != null ? clamp(+over.lc, 0, 100) : lcProposed;
  const sc = 100 - lc;
  const cls = sc < smallFloor ? "LARGE_ONLY" : "LARGE_AND_SMALL";
  const risk = toK1Risk(R);
  const why = [
    x == null ? "No condition read, so the proposal sits at balanced and 50 / 50."
      : `The condition sits at the ${Math.round(x * 100)}th percentile of the heat's own history, so the proposal is ${riskWord(Rp)}${Rp < 1 ? " — the market is stretched, so it leans risk-averse" : x < 0.5 ? " — a cool market is not a reason on its own to take more risk" : ""}.`,
    `${riskWord(R)[0].toUpperCase() + riskWord(R).slice(1)} at that condition: ${invested == null ? "—" : Math.round(invested) + "%"} invested, ${Math.round(lc)} / ${Math.round(sc)} large / small${over.lc != null ? " (your blend)" : spread != null ? ` (grid ${Math.round(base)} large, tilt ${tilt >= 0 ? "+" : "−"}${Math.abs(tilt).toFixed(1)} from IWM − SPY)` : ""}.`,
    cls === "LARGE_ONLY" ? `The small-cap sleeve is ${Math.round(sc)}% of the book, under the ${smallFloor}% floor, so small caps grey.` : `The small-cap sleeve is ${Math.round(sc)}% of the book, at or over the ${smallFloor}% floor, so small caps may play.`,
    risk === "LOW" ? "At conservative a name must earn and every handle-with-care theme is out." : risk === "MEDIUM" ? "At balanced a name must earn; handle-with-care themes stay in, flagged." : "At aggressive there is no earnings rule.",
  ];
  return { x, R, Rp, riskName: riskWord(R), invested, base, tilt, lcProposed, lc, sc, cls, risk, smallFloor, why, overridden: over.R != null || over.lc != null };
}

/** The K1 fit rules this proposal sets: the operator's own saved rules, with the two toggles rewritten. */
export const greyingPrefs = (prefs, prop) => applyToggles(prefs, { cls: prop.cls, risk: prop.risk });

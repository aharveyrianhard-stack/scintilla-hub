// SCINTILLA · THE DEBT READING (CP3, 7 Oct 2026) — pure: figures in, a reading out. No network, no key, no clock.
//
// Alan, 7 Oct: "are you considering debt levels in your comps eliminations? Once you reach a level when you're debating
// things, debt should matter." Every decision card now carries this reading, and the knockout takes points off a debated
// name for leverage (deliverables/20261007/knockout/tools/rounds.py debt_penalty — the same steps as DEBT_STEPS here;
// tests/cp3-one-basis.test.mjs holds the two to each other).
//
// WHAT IS READ, all from the statements the Hub already holds (balance_history, fundamentals_history, cashflow_history):
//   · net debt ÷ EBITDA      total debt less cash, over EBITDA of the last twelve months. The main reading.
//   · debt ÷ free cash flow  the years of today's free cash flow it would take to repay ALL the debt.
//   · net debt ÷ market value
//   · interest cover         operating income ÷ interest expense. NOT ON FILE: the statements we store carry no interest
//                            line (fundamentals_history holds revenue, gross profit, operating income, EBITDA and net
//                            income). The reading is computed the day the column exists
//                            (supabase/migrations/20261007_cp3_interest_expense.sql — additive, not applied) and until
//                            then says "not on file" — never an estimate.
//   · a warning when EBITDA is more than EBITDA_OVER_OI times operating income: heavy depreciation, or one-off gains
//     sitting inside the stored EBITDA (Alphabet and Amazon's paper gains on their stakes), which flatter the ratio.
//
// THE WORD AND THE DEBATE POINTS (net debt ÷ EBITDA):
//   net cash → "net cash", 0 · up to 1× "light", 0 · up to 2.5× "moderate", 0 · up to 4× "heavy", 0.03 ·
//   up to 6× "very heavy", 0.06 · above 6× "stretched", 0.10 · net debt with no positive EBITDA "nothing to carry it", 0.10.
//   A bank, insurer or asset manager is not read: its debt is its raw material.

export const DEBT_STEPS = [[2.5, 0], [4, 0.03], [6, 0.06]];
export const DEBT_TOP = 0.10;
export const EBITDA_OVER_OI = 2.5;
const n = (x) => { if (x == null || x === "") return null; const v = Number(x); return Number.isFinite(v) ? v : null; };

/** f: { net_debt, total_debt, cash, ebitda, operating_income, interest_expense, fcf, mcap, financial }. Twelve-month flows.
    Returns { net_debt_ebitda, interest_cover, interest_cover_why, debt_fcf_years, net_debt_pct_mcap, word, points, words, warn }. */
export function debtReading(f) {
  const nd = n(f.net_debt), td = n(f.total_debt), eb = n(f.ebitda), oi = n(f.operating_income), ie = n(f.interest_expense), fcf = n(f.fcf), mc = n(f.mcap);
  const out = { net_debt: nd, total_debt: td, cash: n(f.cash), ebitda: eb, net_debt_ebitda: null, interest_cover: null, interest_cover_why: null, debt_fcf_years: null, net_debt_pct_mcap: nd != null && mc > 0 ? (nd / mc) * 100 : null, word: null, points: 0, words: null, warn: null };
  if (ie != null && ie > 0 && oi != null) out.interest_cover = oi / ie;
  else out.interest_cover_why = ie == null ? "not on file: the statements we store carry no interest line" : "no interest expense";
  if (td != null && td > 0 && fcf != null && fcf > 0) out.debt_fcf_years = td / fcf;
  if (eb != null && oi != null && oi > 0 && eb > EBITDA_OVER_OI * oi) out.warn = `EBITDA is ${(eb / oi).toFixed(1)} times operating income: heavy depreciation, or one-off gains inside the stored EBITDA — the ratio may be flattered`;
  if (f.financial) { out.word = "not read"; out.words = "a financial company: its debt is its raw material"; return out; }
  if (nd == null) { out.word = "no reading"; out.words = "no balance sheet on file"; return out; }
  if (nd <= 0) { out.word = "net cash"; out.words = "more cash than debt"; out.net_debt_ebitda = eb > 0 ? nd / eb : null; return out; }
  if (!(eb > 0)) { out.word = "nothing to carry it"; out.points = DEBT_TOP; out.words = "net debt and no positive EBITDA"; return out; }
  const x = nd / eb; out.net_debt_ebitda = x;
  out.word = x <= 1 ? "light" : x <= 2.5 ? "moderate" : x <= 4 ? "heavy" : x <= 6 ? "very heavy" : "stretched";
  out.points = DEBT_TOP; for (const [top, p] of DEBT_STEPS) if (x <= top) { out.points = p; break; }
  if (out.interest_cover != null && out.interest_cover < 2) out.points = Math.max(out.points, out.interest_cover < 1 ? DEBT_TOP : 0.06);
  out.words = `net debt ${x.toFixed(1)}× EBITDA`;
  return out;
}

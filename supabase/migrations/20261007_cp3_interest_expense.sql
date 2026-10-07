-- CP3 (7 Oct 2026) · THE INTEREST LINE THE DEBT READING NEEDS.  NOT APPLIED — written for the coordinator to apply.
--
-- Alan, 7 Oct: "are you considering debt levels in your comps eliminations? Once you reach a level when you're debating
-- things, debt should matter." Every decision card now carries net debt ÷ EBITDA, and the knockout takes points off a
-- debated name for leverage. INTEREST COVER (operating income ÷ interest expense) cannot be read: fundamentals_history
-- holds revenue, gross profit, operating income, EBITDA and net income, and no interest line. Every card therefore says
-- "interest cover: not on file" rather than a guess.
--
-- ADDITIVE ONLY: one nullable column. No row is changed, nothing is renamed or deleted, and no page reads the column
-- until it is filled (lib/debt-reading.mjs takes interest_expense when it is given and says "not on file" when it is not).
-- The rollback is 20261007_cp3_interest_expense_ROLLBACK.sql.
--
-- TO FILL IT: supabase/functions/fmp-fundamentals/index.ts builds each fundamentals_history row from FMP's
-- income-statement answer (the fhRows line). The same answer carries `interestExpense`; adding
--   interest_expense: num(x.interestExpense)
-- to that row, and one run of the function, fills the column for every period it re-reads. Not done here: that function
-- holds the FMP key and writes tables, which this lane does not do.

alter table public.fundamentals_history
  add column if not exists interest_expense numeric;

comment on column public.fundamentals_history.interest_expense is
  'FMP income-statement interestExpense for the period, in the reporting currency. Null until fmp-fundamentals writes it. Interest cover = operating income / interest expense over the same twelve months (lib/debt-reading.mjs).';

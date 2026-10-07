-- CP3 (7 Oct 2026) · rollback of 20261007_cp3_interest_expense.sql. The column is read by nothing that fails without it:
-- lib/debt-reading.mjs answers "interest cover: not on file" when no interest figure is given.
alter table public.fundamentals_history
  drop column if exists interest_expense;

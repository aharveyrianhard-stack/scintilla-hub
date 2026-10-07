"""SCINTILLA · the fiscal-year join, for the decision cards (FD1, 7 Oct 2026). The rule is lib/fiscal-year.mjs, word for word.

An analyst estimate is keyed by the date its fiscal year ends, and FMP moves that date: Micron's fiscal 2027 was dated
28 Aug 2027 in the 11 Aug copy and 3 Sep 2027 since its 30 Sep report (Costco, Cisco and Lumentum moved by a day).
A join on the date loses the older copy. Two period-end dates name the same fiscal year when they are at most
FY_MATCH_DAYS apart; in one copy the row of a fiscal year is the row whose date is nearest the date asked for.
Pure: no network, no clock."""
import datetime as _d

FY_MATCH_DAYS = 45
FY_SHIFT_DAYS = 15


def _day(s):
    return _d.date.fromisoformat(str(s)[:10])


def days_apart(a, b):
    return (_day(a) - _day(b)).days


def fiscal_year_of(date):
    """The fiscal year a period-end date belongs to: the calendar year of the date fifteen days earlier."""
    return (_day(date) - _d.timedelta(days=FY_SHIFT_DAYS)).year


def same_fiscal_year(a, b):
    return abs(days_apart(a, b)) <= FY_MATCH_DAYS


def pick_fiscal_year(rows, date, key='fiscal_date'):
    best = None
    for r in rows or []:
        if not r or not r.get(key):
            continue
        off = abs(days_apart(r[key], date))
        if off <= FY_MATCH_DAYS and (best is None or off < best[0]):
            best = (off, r)
    return best[1] if best else None


def copies_of_fiscal_year(rows, date, key='fiscal_date', as_of='as_of_date'):
    """One row per stored copy (oldest first), each the row of the fiscal year `date` names; and the keys it was stored under."""
    by = {}
    for r in rows or []:
        if r and r.get(as_of):
            by.setdefault(str(r[as_of])[:10], []).append(r)
    copies = [x for x in (pick_fiscal_year(by[d], date, key) for d in sorted(by)) if x]
    return copies, sorted({str(r[key])[:10] for r in copies})

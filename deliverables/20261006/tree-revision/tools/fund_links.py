#!/usr/bin/env python3
"""TR2 (6 Oct 2026) - FUND LINKS: which topic cohorts each sector fund holds, by weight.

    python3 deliverables/20261006/tree-revision/tools/fund_links.py        # from the worktree root

Alan, 6 Oct: "the index layer should go between the other layers and the market ... sector funds are parents of
these things, and that's where you'll see the cross relationships". So each of the 11 sectors becomes a node between
THE MARKET and the theme headings, and a cohort may sit under several sector funds, by holdings weight.

LOCAL FILES ONLY. Reads four files, writes one (fund-links.json beside tools/). No network, no database.
  cohort-proposal/proposal.json              CO1's tree (the 63 topic cohorts TR1 loaded; IDX_ sets and QRVO left out)
  coverage-tree/data/holdings.json           fund holdings as [ticker, weight %] (FMP, 26 and 28 Sep 2026)
  cohort-proposal/data/universe-20261006.json   the 590 served symbols
  cohort-proposal/data/company_profile-20261006.json   FMP sector (the fallback when no US sector fund holds a name)

RULES
  held            = the fund lists the ticker with a weight above zero
  fund_weight_pct = sum of the fund's weights on the cohort's members (how much of the FUND the cohort is)
  sector parents  = ranked by names held by the sector's VANGUARD fund (it covers large, mid and small caps),
                    ties broken by the SPDR fund's weight, then the Vanguard fund's weight
  cross-sector    = the second sector's Vanguard fund holds at least a quarter of the cohort's names
  heading         = union of the cohorts whose FIRST parent is that heading, each ticker counted once
"""
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
CO1 = ROOT / 'deliverables/20261006/cohort-proposal'
HOLD = ROOT / 'deliverables/20260928/coverage-tree/data/holdings.json'
OUT = Path(__file__).resolve().parents[1] / 'fund-links.json'

RETIRING = ['QRVO']                       # same rule as scripts/cohort-tree-loader.mjs (stopped trading 5 Oct)
TR1_EXPECT = {'cohorts': 63, 'member_rows': 518}   # buildTree() in scripts/cohort-tree-loader.mjs, run 6 Oct

SECTORS = [  # sector, SPDR, Invesco equal weight, Vanguard, iShares
    ('technology', 'XLK', 'RSPT', 'VGT', 'IYW'),
    ('financials', 'XLF', 'RSPF', 'VFH', 'IYF'),
    ('energy', 'XLE', 'RSPG', 'VDE', 'IYE'),
    ('health care', 'XLV', 'RSPH', 'VHT', 'IYH'),
    ('industrials', 'XLI', 'RSPN', 'VIS', 'IYJ'),
    ('consumer discretionary', 'XLY', 'RSPD', 'VCR', 'IYC'),
    ('consumer staples', 'XLP', 'RSPS', 'VDC', 'IYK'),
    ('utilities', 'XLU', 'RSPU', 'VPU', 'IDU'),
    ('materials', 'XLB', 'RSPM', 'VAW', 'IYM'),
    ('real estate', 'XLRE', 'RSPR', 'VNQ', 'IYR'),
    ('communication services', 'XLC', 'RSPC', 'VOX', 'IYZ'),
]
FAMILIES = ['SPDR', 'EQUAL_WEIGHT', 'VANGUARD', 'ISHARES']
BROAD = ['SPY', 'QQQ', 'DIA', 'IWM', 'RSP', 'MDY', 'IJR', 'VTI']
FMP_TO_SECTOR = {
    'Technology': 'technology', 'Financial Services': 'financials', 'Energy': 'energy', 'Healthcare': 'health care',
    'Industrials': 'industrials', 'Consumer Cyclical': 'consumer discretionary', 'Consumer Defensive': 'consumer staples',
    'Utilities': 'utilities', 'Basic Materials': 'materials', 'Real Estate': 'real estate',
    'Communication Services': 'communication services',
}
CLASS_RE = re.compile(r'^([A-Z]+)[.\-]([AB])$')            # BRK.B / BRK-B / MOG.A / HEI-A: a share class
FOREIGN_RE = re.compile(r'^([A-Z0-9]+)\.([A-Z]{1,2})$')    # LIN.DE / SLB.PA / 0Y3K.L: a foreign listing code
PLAIN_RE = re.compile(r'^[A-Z]+$')
CROSS_MIN = 0.25


def canon(t):
    """One spelling for a share class: BRK-B, BRK.B -> BRK.B. Everything else upper-cased and left alone."""
    t = str(t).strip().upper()
    m = CLASS_RE.match(t)
    return f'{m.group(1)}.{m.group(2)}' if m else t


def r3(x):
    return round(float(x) + 0.0, 3)


def load_json(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def main():
    proposal = load_json(CO1 / 'proposal.json')
    holdings = load_json(HOLD)
    universe = load_json(CO1 / 'data/universe-20261006.json')
    profile = {r['ticker']: r for r in load_json(CO1 / 'data/company_profile-20261006.json')}
    served = {canon(s) for s in universe['symbols']}
    data = holdings['data']

    # ---- 1. the 63 topic cohorts, exactly as TR1 loaded them -------------------------------------------------------
    cohorts = []
    left_out = []
    for c in proposal['cohorts']:
        if c['id'].startswith('IDX_'):
            continue
        members = []
        for t in c['members']:
            if t in RETIRING:
                left_out.append(f"{t} ({c['id']})")
                continue
            members.append(t)
        cohorts.append({'id': c['id'], 'label': c['label'], 'parents': c['parents'], 'members': members,
                        'co1_home_sector': c.get('home_sector')})
    member_rows = sum(len(c['members']) for c in cohorts)
    spelled = {}                                # canonical -> the spelling the tree uses
    for c in cohorts:
        for t in c['members']:
            spelled[canon(t)] = t
    in_cohort = set(spelled)
    cohorts_of = defaultdict(list)
    for c in cohorts:
        for t in c['members']:
            cohorts_of[canon(t)].append(c['id'])

    # ---- 2. funds: sector, family, cleaned holdings ----------------------------------------------------------------
    fund_meta = {}
    for sector, *four in SECTORS:
        for fam, f in zip(FAMILIES, four):
            fund_meta[f] = {'sector': sector, 'family': fam}
    for f in BROAD:
        fund_meta[f] = {'sector': None, 'family': 'BROAD'}
    missing_funds = [f for f in fund_meta if f not in data]

    raw_plain = {}                              # fund -> set of plain US tickers it lists (for the alias evidence)
    for f in fund_meta:
        if f in data:
            raw_plain[f] = {canon(t) for t, w in data[f]['h'] if (w or 0) > 0}
    sector_evidence = {}                        # sector -> names its SPDR or Vanguard fund lists
    for sector, spdr, _eq, vg, _ish in SECTORS:
        sector_evidence[sector] = raw_plain.get(spdr, set()) | raw_plain.get(vg, set())

    held = {}                                   # fund -> {canonical ticker: weight}
    checks = {}
    aliases = []
    for f, meta in fund_meta.items():
        if f in missing_funds:
            continue
        rec = data[f]
        w_by = defaultdict(float)
        self_rows, zero_rows, class_forms, foreign_left, other_odd, dup = [], [], [], [], [], []
        seen = Counter()
        total = 0.0
        for t, w in rec['h']:
            w = float(w or 0)
            total += w
            raw = str(t).strip().upper()
            if raw == f:                         # the fund listing itself: cash and receivables
                self_rows.append([raw, r3(w)])
                continue
            if w <= 0:
                zero_rows.append([raw, r3(w)])
                continue
            key = canon(raw)
            if CLASS_RE.match(raw):
                class_forms.append(raw)
            elif not PLAIN_RE.match(raw):
                m = FOREIGN_RE.match(raw)
                base = m.group(1) if m else None
                # a US sector fund holds the US line; FMP sometimes labels it with a foreign listing. Take the base
                # ticker ONLY when this fund does not list it and the sector's SPDR or Vanguard fund does.
                if (m and meta['sector'] and PLAIN_RE.match(base) and base not in raw_plain[f]
                        and base in sector_evidence[meta['sector']]):
                    aliases.append({'fund': f, 'listed_as': raw, 'read_as': base, 'weight_pct': r3(w),
                                    'evidence': f"{f} lists no {base}; the {meta['sector']} SPDR or Vanguard fund does"})
                    key = base
                elif m:
                    foreign_left.append([raw, r3(w)])
                else:
                    other_odd.append([raw, r3(w)])
            seen[key] += 1
            w_by[key] += w
        dup = sorted(t for t, n in seen.items() if n > 1)
        held[f] = dict(w_by)
        n_rep, rows = rec.get('n'), rec.get('rows')
        checks[f] = {
            'family': meta['family'], 'sector': meta['sector'],
            'rows_in_file': len(rec['h']), 'holdings_reported_by_fund': n_rep,
            'weight_sum_pct': r3(total), 'sums_near_100': abs(total - 100) <= 1.0,
            'truncated': bool(n_rep and len(rec['h']) < n_rep),
            'self_rows_dropped': self_rows, 'zero_or_negative_rows': len(zero_rows),
            'share_class_spellings': sorted(set(class_forms)),
            'foreign_listing_codes_unmatched': foreign_left,
            'foreign_listing_codes_unmatched_weight_pct': r3(sum(w for _, w in foreign_left)),
            'other_non_ticker_rows': other_odd, 'duplicate_tickers_summed': dup,
            'source': rec.get('source'), 'fmp_updated': rec.get('updated'),
        }

    # ---- 3. links: every (fund, cohort) with at least one name held ------------------------------------------------
    def link(f, tickers):
        """(weight, names held, top three) of fund f over a list of tree tickers, each counted once."""
        h = held[f]
        got = []
        for t in dict.fromkeys(tickers):
            w = h.get(canon(t), 0.0)
            if w > 0:
                got.append((t, w))
        got.sort(key=lambda x: (-x[1], x[0]))
        return sum(w for _, w in got), len(got), [[t, r3(w)] for t, w in got[:3]]

    links = []
    by_fc = {}
    for f, meta in fund_meta.items():
        if f not in held:
            continue
        for c in cohorts:
            w, n, top = link(f, c['members'])
            by_fc[(f, c['id'])] = (w, n, top)
            if n:
                links.append({'fund': f, 'sector': meta['sector'], 'family': meta['family'], 'cohort': c['id'],
                              'fund_weight_pct': r3(w), 'names_held': n, 'cohort_names': len(c['members']),
                              'top_names': top})

    # ---- 4. sector parents ----------------------------------------------------------------------------------------
    def parents_of(tickers, getter):
        """Rank the 11 sectors for a set of names. getter(fund) -> (weight, names, top)."""
        names = len(dict.fromkeys(tickers))
        rows = []
        for sector, spdr, eq, vg, ish in SECTORS:
            fam = {}
            for label, f in zip(FAMILIES, (spdr, eq, vg, ish)):
                w, n, top = getter(f) if f in held else (0.0, 0, [])
                fam[label] = {'fund': f, 'fund_weight_pct': r3(w), 'names_held': n,
                              'share_of_names': r3(n / names) if names else 0.0, 'top_names': top}
            if not any(v['names_held'] for v in fam.values()):
                continue
            rows.append({'sector': sector,
                         'vanguard_names': fam['VANGUARD']['names_held'],
                         'vanguard_share_of_names': fam['VANGUARD']['share_of_names'],
                         'vanguard_fund': vg, 'vanguard_weight_pct': fam['VANGUARD']['fund_weight_pct'],
                         'spdr_names': fam['SPDR']['names_held'],
                         'spdr_share_of_names': fam['SPDR']['share_of_names'],
                         'spdr_fund': spdr, 'spdr_weight_pct': fam['SPDR']['fund_weight_pct'],
                         'equal_weight_weight_pct': fam['EQUAL_WEIGHT']['fund_weight_pct'],
                         'ishares_weight_pct': fam['ISHARES']['fund_weight_pct'],
                         'top_names_spdr': fam['SPDR']['top_names'], 'top_names_vanguard': fam['VANGUARD']['top_names']})
        rows.sort(key=lambda r: (-r['vanguard_names'], -r['spdr_weight_pct'], -r['vanguard_weight_pct'], r['sector']))
        for i, r in enumerate(rows):
            r['rank'] = i + 1
        return names, rows

    def fmp_fallback(tickers):
        cnt = Counter()
        for t in dict.fromkeys(tickers):
            s = (profile.get(t) or {}).get('sector')
            cnt[FMP_TO_SECTOR.get(s, f'(FMP: {s})')] += 1
        ranked = cnt.most_common()
        return {'sector': ranked[0][0] if ranked else None, 'names_by_fmp_sector': dict(ranked)}

    sector_fund_set = [f for f in fund_meta if fund_meta[f]['sector'] and f in held]
    any_sector_fund = set()
    for f in sector_fund_set:
        any_sector_fund |= set(held[f])

    def describe(tickers, getter):
        names, rows = parents_of(tickers, getter)
        uniq = list(dict.fromkeys(tickers))
        unheld = [t for t in uniq if canon(t) not in any_sector_fund]
        out = {'names': names, 'sector_parents': rows,
               'home_sector': rows[0]['sector'] if rows else None,
               'second_sector': rows[1]['sector'] if len(rows) > 1 and (rows[1]['vanguard_names'] or rows[1]['spdr_names']) else None,
               'names_held_by_a_vanguard_sector_fund': sum(r['vanguard_names'] for r in rows),
               'weak_evidence': bool(rows) and sum(r['vanguard_names'] for r in rows) * 2 < names,
               'names_in_no_sector_fund': unheld,
               'no_sector_fund_holds_a_name': not rows}
        if rows:
            out['home_rule'] = 'most names held by the sector Vanguard fund, ties by SPDR weight'
            if rows[0]['vanguard_names'] == 0:
                out['home_rule'] = 'no Vanguard sector fund holds a name; ranked by SPDR weight'
        else:
            fb = fmp_fallback(uniq)
            out['home_sector'] = fb['sector']
            out['home_rule'] = 'FALLBACK: FMP sector label (no US sector fund holds any of these names)'
            out['fmp_fallback'] = fb
        second = rows[1] if len(rows) > 1 else None
        out['cross_sector'] = bool(second and names and second['vanguard_names'] / names >= CROSS_MIN)
        out['sectors_with_a_name'] = len(rows)
        out['fmp_sector_view'] = fmp_fallback(uniq)
        return out

    cohort_parents = {}
    for c in cohorts:
        d = describe(c['members'], lambda f, cid=c['id']: by_fc[(f, cid)])
        d.update({'label': c['label'], 'tree_parents': c['parents'], 'co1_home_sector_fmp': c['co1_home_sector'],
                  'broad_fund_weight_pct': {f: r3(by_fc[(f, c['id'])][0]) for f in BROAD if f in held}})
        cohort_parents[c['id']] = d

    # ---- 5. headings: union of the cohorts whose FIRST parent is the heading --------------------------------------
    first = defaultdict(list)
    for c in cohorts:
        first[c['parents'][0]].append(c)
    heading_parents = {}
    heading_links = []
    for hid, cs in first.items():
        tickers = [t for c in cs for t in c['members']]
        cache = {}

        def getter(f, tickers=tickers, cache=cache):
            if f not in cache:
                cache[f] = link(f, tickers)
            return cache[f]
        d = describe(tickers, getter)
        d.update({'label': proposal['headings'][hid]['label'], 'cohorts': [c['id'] for c in cs],
                  'is_theme_heading': hid != 'MARKET',
                  'broad_fund_weight_pct': {f: r3(getter(f)[0]) for f in BROAD if f in held}})
        heading_parents[hid] = d
        for f, meta in fund_meta.items():
            if f not in held:
                continue
            w, n, top = getter(f)
            if n:
                heading_links.append({'fund': f, 'sector': meta['sector'], 'family': meta['family'], 'heading': hid,
                                      'fund_weight_pct': r3(w), 'names_held': n, 'heading_names': d['names'],
                                      'top_names': top})

    # ---- 6. each fund: cohorts ranked, coverage, biggest names in no cohort ----------------------------------------
    def fund_view(f):
        h = held[f]
        total = sum(h.values())
        cov = sum(w for t, w in h.items() if t in served)
        coh = sum(w for t, w in h.items() if t in in_cohort)
        ranked = sorted(({'cohort': c['id'], 'fund_weight_pct': r3(by_fc[(f, c['id'])][0]),
                          'names_held': by_fc[(f, c['id'])][1], 'cohort_names': len(c['members'])}
                         for c in cohorts if by_fc[(f, c['id'])][1]),
                        key=lambda r: (-r['fund_weight_pct'], r['cohort']))
        outside = sorted(((t, w) for t, w in h.items() if t not in in_cohort), key=lambda x: (-x[1], x[0]))
        return {'fund': f, 'family': fund_meta[f]['family'], 'sector': fund_meta[f]['sector'],
                'holdings_listed': len(h), 'weight_listed_pct': r3(total),
                'coverage_pct': r3(cov), 'names_served': sum(1 for t in h if t in served),
                'in_topic_cohort_pct': r3(coh), 'names_in_topic_cohort': sum(1 for t in h if t in in_cohort),
                'not_covered_pct': r3(total - cov),
                'cohorts_held': len(ranked), 'cohorts': ranked,
                'biggest_names_in_no_topic_cohort': [{'ticker': t, 'fund_weight_pct': r3(w), 'served': t in served}
                                                     for t, w in outside[:12]]}

    sector_funds = {}
    for sector, *four in SECTORS:
        sector_funds[sector] = {'funds': dict(zip(FAMILIES, four)),
                                **{fam: fund_view(f) for fam, f in zip(FAMILIES, four) if f in held}}
        home = [cid for cid, d in cohort_parents.items() if d['home_sector'] == sector and not d['no_sector_fund_holds_a_name']]
        second = [cid for cid, d in cohort_parents.items() if d['second_sector'] == sector and d['cross_sector']]
        sector_funds[sector]['cohorts_home_here'] = home
        sector_funds[sector]['cohorts_second_home_here'] = second
        sector_funds[sector]['headings_home_here'] = [h for h, d in heading_parents.items()
                                                      if d['home_sector'] == sector and d['is_theme_heading']]
    broad_funds = {f: fund_view(f) for f in BROAD if f in held}

    # ---- 7. the lists Alan asked for ------------------------------------------------------------------------------
    def pair(d, i):
        r = d['sector_parents'][i]
        return {'sector': r['sector'], 'vanguard_names': r['vanguard_names'],
                'vanguard_share_of_names': r['vanguard_share_of_names'],
                'spdr_fund': r['spdr_fund'], 'spdr_weight_pct': r['spdr_weight_pct'], 'spdr_names': r['spdr_names'],
                'vanguard_fund': r['vanguard_fund'], 'vanguard_weight_pct': r['vanguard_weight_pct']}

    cross = []
    for cid, d in cohort_parents.items():
        if d['cross_sector']:
            cross.append({'cohort': cid, 'label': d['label'], 'names': d['names'],
                          'home': pair(d, 0), 'second': pair(d, 1),
                          'others': [pair(d, i) for i in range(2, len(d['sector_parents']))
                                     if d['sector_parents'][i]['vanguard_names'] / d['names'] >= CROSS_MIN]})
    cross.sort(key=lambda r: (-r['second']['vanguard_share_of_names'], r['cohort']))
    none_held = [{'cohort': cid, 'label': d['label'], 'names': d['names'], 'fallback_home_sector': d['home_sector'],
                  'names_by_fmp_sector': d['fmp_fallback']['names_by_fmp_sector'],
                  'held_by_broad_funds': {f: v for f, v in d['broad_fund_weight_pct'].items() if v > 0}}
                 for cid, d in cohort_parents.items() if d['no_sector_fund_holds_a_name']]
    cross_headings = [{'heading': hid, 'label': d['label'], 'names': d['names'], 'home': pair(d, 0), 'second': pair(d, 1)}
                      for hid, d in heading_parents.items() if d['cross_sector']]

    # a Vanguard sector fund should hold a company in ONE sector only: prove it on our names
    vg_funds = [s[3] for s in SECTORS if s[3] in held]
    vg_twice = sorted(t for t in in_cohort if sum(1 for f in vg_funds if held[f].get(t, 0) > 0) > 1)
    spdr_funds = [s[1] for s in SECTORS if s[1] in held]
    spdr_twice = sorted(t for t in in_cohort if sum(1 for f in spdr_funds if held[f].get(t, 0) > 0) > 1)
    every = set()
    for f in held:
        every |= set(held[f])
    in_no_fund = sorted(spelled[t] for t in in_cohort if t not in every)
    served_not_in_cohort = sorted(t for t in served if t not in in_cohort and not (profile.get(t) or {}).get('is_etf')
                                  and (profile.get(t) or {}).get('sector') in FMP_TO_SECTOR)

    spy_check = None
    ref_path = ROOT / 'data/reference/spy-holdings.json'
    if ref_path.exists() and 'SPY' in held:
        ref = load_json(ref_path)
        both = [(canon(t), v['weight_pct']) for t, v in ref['holdings'].items() if canon(t) in held['SPY']]
        spy_check = {'reference': 'data/reference/spy-holdings.json (State Street, ' + str(ref.get('as_of')) + ')',
                     'names_in_both': len(both), 'names_in_reference': len(ref['holdings']),
                     'biggest_weight_gap_pct_points': r3(max(abs(w - held['SPY'][t]) for t, w in both)) if both else None}
    weak = [{'cohort': cid, 'names': d['names'], 'names_held_by_a_vanguard_sector_fund': d['names_held_by_a_vanguard_sector_fund'],
             'rule_says': d['home_sector'], 'fmp_says': d['fmp_sector_view']['sector']}
            for cid, d in cohort_parents.items() if d['weak_evidence']]

    dates = sorted({v['fmp_updated'][:10] for v in checks.values() if v['fmp_updated']})
    as_of = {
        'holdings_file': str(HOLD.relative_to(ROOT)),
        'file_says': holdings.get('what'),
        'pulls': {
            'FMP holdings file, 26 Sep 2026': sorted(f for f, v in checks.items() if '26 Sep' in (v['source'] or '')),
            'FMP /stable/etf/holdings, pulled 28 Sep 2026': sorted(f for f, v in checks.items() if '28 Sep' in (v['source'] or '')),
        },
        'fmp_updated_range_for_28_sep_pull': [dates[0], dates[-1]] if dates else None,
        'note': 'the 26 Sep file carries no per-fund date; the 28 Sep pull carries FMP\'s own "updated" stamp per fund',
        'tree': 'CO1 proposal.json built ' + str(proposal.get('built_utc')) + ', as TR1 loaded it (QRVO and IDX_ sets out)',
        'universe': {'count': universe.get('count'), 'digest': universe.get('universe_sha256')},
    }

    out = {
        'what': 'TR2 fund links: which topic cohorts each sector fund holds, by weight. Local files only; study output, '
                'nothing written to any table.',
        'built_utc': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'as_of': as_of,
        'method': {
            'held': 'the fund lists the ticker with a weight above zero',
            'fund_weight_pct': 'sum of the fund\'s weights on the cohort\'s members = how much of the FUND the cohort is',
            'sector_parent_rule': 'rank sectors by names held by the sector\'s Vanguard fund; ties by SPDR weight, then Vanguard weight',
            'cross_sector_rule': f'second sector\'s Vanguard fund holds at least {int(CROSS_MIN * 100)}% of the cohort\'s names',
            'heading': 'union of the cohorts whose FIRST parent is the heading, each ticker counted once',
            'coverage_pct': 'share of the fund\'s weight on tickers in the 590 served symbols, each ticker once',
            'weights': 'percent of fund, rounded to 3 decimals; not rescaled to 100',
        },
        'counts': {
            'topic_cohorts': len(cohorts), 'cohort_member_rows': member_rows, 'distinct_companies': len(in_cohort),
            'left_out_retiring': left_out, 'sectors': len(SECTORS), 'sector_funds': len(sector_fund_set),
            'broad_funds': len(broad_funds), 'links': len(links),
            'links_by_family': dict(Counter(r['family'] for r in links)),
            'heading_links': len(heading_links), 'headings_rolled_up': len(heading_parents),
            'theme_headings': sum(1 for d in heading_parents.values() if d['is_theme_heading']),
            'cross_sector_cohorts': len(cross), 'cohorts_no_sector_fund_holds': len(none_held),
        },
        'cross_sector_cohorts': cross,
        'cross_sector_headings': cross_headings,
        'cohorts_no_sector_fund_holds': none_held,
        'cohorts_weak_evidence': weak,
        'cohort_parents': cohort_parents,
        'heading_parents': heading_parents,
        'sector_funds': sector_funds,
        'broad_funds': broad_funds,
        'sanity': {
            'tree_matches_tr1': {'expected': TR1_EXPECT, 'got': {'cohorts': len(cohorts), 'member_rows': member_rows},
                                 'ok': len(cohorts) == TR1_EXPECT['cohorts'] and member_rows == TR1_EXPECT['member_rows']},
            'funds_missing_from_holdings_file': missing_funds,
            'spy_against_state_street_file': spy_check,
            'funds_not_summing_near_100': [f for f, v in checks.items() if not v['sums_near_100']],
            'funds_truncated_by_the_pull': {f: [v['rows_in_file'], v['holdings_reported_by_fund']]
                                            for f, v in checks.items() if v['truncated']},
            'share_class_spellings_in_tree': sorted(t for t in spelled.values() if not PLAIN_RE.match(t)),
            'share_class_spellings_by_fund': {f: v['share_class_spellings'] for f, v in checks.items() if v['share_class_spellings']},
            'foreign_listing_codes_read_as_us_ticker': aliases,
            'foreign_listing_codes_left_unmatched_pct': {f: v['foreign_listing_codes_unmatched_weight_pct']
                                                         for f, v in checks.items() if v['foreign_listing_codes_unmatched']},
            'our_names_in_two_vanguard_sector_funds': vg_twice,
            'our_names_in_two_spdr_sector_funds': spdr_twice,
            'cohort_names_in_no_fund_at_all': in_no_fund,
            'cohort_names_in_no_sector_fund': sorted(spelled[t] for t in in_cohort if t not in any_sector_fund),
            'served_companies_in_no_topic_cohort': served_not_in_cohort,
            'per_fund': checks,
        },
        'links': links,
        'heading_links': heading_links,
    }
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')

    # ---- plain-text summary ---------------------------------------------------------------------------------------
    print(f"wrote {OUT.relative_to(ROOT)}")
    print(json.dumps(out['counts'], indent=1))
    print('\nHEADING -> home / second sector (names held by Vanguard fund; SPDR weight; Vanguard weight)')
    for hid, d in heading_parents.items():
        bits = [f"{r['sector']} {r['vanguard_names']}/{d['names']} {r['spdr_fund']} {r['spdr_weight_pct']}% {r['vanguard_fund']} {r['vanguard_weight_pct']}%"
                for r in d['sector_parents'][:3]]
        print(f"  {hid:18s} {d['names']:3d} | " + ' | '.join(bits) + (f" | not in any sector fund: {len(d['names_in_no_sector_fund'])}"))
    print('\nSPDR FUND -> coverage, top five cohorts')
    for sector, v in sector_funds.items():
        s = v['SPDR']
        print(f"  {s['fund']:5s} coverage {s['coverage_pct']}% of {s['weight_listed_pct']}% ({s['names_served']}/{s['holdings_listed']} names) | "
              + ', '.join(f"{c['cohort']} {c['fund_weight_pct']}" for c in s['cohorts'][:5]))
        print('        outside: ' + ', '.join(f"{o['ticker']} {o['fund_weight_pct']}" for o in s['biggest_names_in_no_topic_cohort'][:6]))
    print('\nCROSS-SECTOR COHORTS')
    for r in cross:
        a, b = r['home'], r['second']
        print(f"  {r['cohort']:22s} {r['names']:2d} | {a['sector']} {a['vanguard_names']} ({a['spdr_fund']} {a['spdr_weight_pct']}%, {a['vanguard_fund']} {a['vanguard_weight_pct']}%)"
              f" + {b['sector']} {b['vanguard_names']} ({b['spdr_fund']} {b['spdr_weight_pct']}%, {b['vanguard_fund']} {b['vanguard_weight_pct']}%)"
              + ''.join(f" + {o['sector']} {o['vanguard_names']}" for o in r['others']))
    print('\nNO SECTOR FUND HOLDS A NAME')
    for r in none_held:
        print(f"  {r['cohort']:22s} {r['names']} names -> FMP fallback {r['fallback_home_sector']} {r['names_by_fmp_sector']}")
    print('\nWEAK EVIDENCE (fewer than half the names in any Vanguard sector fund)')
    for r in weak:
        print(f"  {r['cohort']:22s} {r['names_held_by_a_vanguard_sector_fund']}/{r['names']} | rule {r['rule_says']} | FMP {r['fmp_says']}")
    print('  spy check: ' + json.dumps(spy_check))
    print('\nSANITY')
    s = out['sanity']
    for k in ('tree_matches_tr1', 'funds_missing_from_holdings_file', 'funds_not_summing_near_100', 'funds_truncated_by_the_pull',
              'share_class_spellings_in_tree', 'foreign_listing_codes_left_unmatched_pct', 'our_names_in_two_vanguard_sector_funds',
              'our_names_in_two_spdr_sector_funds', 'cohort_names_in_no_fund_at_all', 'served_companies_in_no_topic_cohort'):
        print(f"  {k}: {json.dumps(s[k])}")
    print('  foreign codes read as US ticker: ' + ', '.join(f"{a['fund']} {a['listed_as']}->{a['read_as']} {a['weight_pct']}" for a in aliases))


if __name__ == '__main__':
    main()

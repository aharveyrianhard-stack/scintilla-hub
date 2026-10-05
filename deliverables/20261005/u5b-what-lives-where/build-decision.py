#!/usr/bin/env python3
"""U5b · what lives where — the decision package, computed from the 3 Oct lane returns.

Reads (all copied into ./data, nothing live is touched):
  u4b-facts-20261003.json          every served name × lists · funds · cohorts · comps · depth (U4b)
  lists-20261003.json              LIKED / FAVORITES / RADAR (3 Oct)
  t12-cohorts-measured-20261003.json  the Hub tabs and the candidate cohorts, measured (T12)
  closes-tree-names-20261003.json  the close Geiger of every tree name on the six closes 25 Sep – 2 Oct
  b1-market-bowtie-20261003.json   sectors / cohorts soundness + the names that make thin ones sound (B1)
  admission-groups-20261003.json   which batch each name came in with
  bars-r2-20261003.json            per name × width: bytes stored in R2 (storage per name)
  scout-geiger-cost-20261003.json  the close tier's measured cost per night
Writes decision.json beside this file. Rules are in the PAGE SPECS of WHAT-LIVES-WHERE.html.
"""
import json, math, collections, statistics, os
H = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(H, 'data')
J = lambda n: json.load(open(os.path.join(D, n)))

facts = J('u4b-facts-20261003.json'); lists = J('lists-20261003.json'); T12 = J('t12-cohorts-measured-20261003.json')
closes = J('closes-tree-names-20261003.json')['rows']; B1 = J('b1-market-bowtie-20261003.json'); groups = J('admission-groups-20261003.json')
bars = J('bars-r2-20261003.json'); scout = J('scout-geiger-cost-20261003.json')

rows = {r['ticker']: r for r in facts['rows'] if r['today'] != 'not served'}
assert len(rows) == 590, len(rows)
LIKED, FAV, RADAR = set(lists['LIKED']), set(lists['FAVORITES']), set(lists['RADAR'])
batch = {}
for b in groups['batches']:
    for s in b['symbols']: batch[s] = b['effective_date_et']
GEIGER_ONLY = set(groups['geiger_only'])
BATCH_NAME = {'2026-09-24': 'BOOKMARKS (24 Sep · Alan\'s X bookmarks, 56)', '2026-09-27': 'FUNDS (27 Sep · Geiger-only fund set, 66)',
              '2026-09-28': 'BATCH (29 Sep · admission v3, 104)'}
def batch_of(t):
    if t in GEIGER_ONLY: return 'FUNDS66'
    b = batch.get(t)
    return {'2026-09-24': 'BOOKMARK56', '2026-09-28': 'BATCH104'}.get(b, 'ORIGINAL364')

# six-close readings per ticker (close Geiger, the tree's reading)
six = collections.defaultdict(dict)
for r in closes: six[r['ticker']][r['date']] = float(r['c'])
DATES = sorted({r['date'] for r in closes})

def sound_on(members, dates=DATES):
    """T12's rule: n ≥ 8 with a reading · se ≤ 0.10 · on each of the six closes. Returns (sound, detail)."""
    worst = {'n': 10**6, 'se': 0.0, 'closes_pass': 0}
    for d in dates:
        xs = [six[t][d] for t in members if d in six.get(t, {})]
        n = len(xs)
        se = (statistics.pstdev(xs) / math.sqrt(n)) if n > 1 else 9.9
        ok = n >= 8 and se <= 0.10
        worst['n'] = min(worst['n'], n); worst['se'] = max(worst['se'], se); worst['closes_pass'] += 1 if ok else 0
    return worst['closes_pass'] == len(dates), worst

# --- cohorts that protect their members: the Hub tabs and the candidate cohorts T12 measured ------------------
cohorts = []
for grp in ('hub_tabs', 'candidates'):
    for c in T12[grp]:
        cohorts.append({'id': c['id'], 'label': c['label'], 'where': grp, 'tickers': [t for t in c['tickers'] if t in rows],
                        't12_sound': bool(c['measure']['sound']), 't12_n': c['measure']['n'], 't12_se': c['measure']['se'],
                        't12_closes': c['measure']['closes_pass'], 't12_weak': c['measure']['weak'], 't12_purity': c['measure'].get('purity')})
member_of = collections.defaultdict(list)
for c in cohorts:
    for t in c['tickers']: member_of[t].append(c['id'])
by_id = {c['id']: c for c in cohorts}

mcap = lambda t: ((rows[t].get('profile') or {}).get('market_cap') or 0)
# C5b's non-USD reporters (3 Oct) name the CNY reporters; U4b's profile rows carry country for some of them. SIMO (Silicon
# Motion, Taiwan) is excluded by name: the profile row says HK, the company reports from Taiwan.
CNY_REPORTERS = {'BABA', 'BIDU', 'EH', 'GDS', 'JD', 'LI', 'NIO', 'PDD', 'XPEV'}
def is_chinese(t):
    r = rows[t]; cur = r.get('currency') or {}; p = r.get('profile') or {}
    return t in CNY_REPORTERS or cur.get('reported') in ('CNY', 'HKD') or (p.get('country') in ('CN', 'HK') and t != 'SIMO')

# --- the per-name verdict -------------------------------------------------------------------------------------
# tiers: LIVE (streamed, Geiger every cycle, board row) ⊃ CLOSE (Geiger at the close, daily bars, on the tree)
#        ⊃ COMPS (fundamentals, estimates, daily bars; no Geiger)
decision = {}
reasons = {}
for t, r in rows.items():
    b = batch_of(t); on_lists = [n for n, s in (('LIKED', LIKED), ('FAVORITES', FAV), ('RADAR', RADAR)) if t in s]
    hp = r.get('hub_point_funds') or []; peer_of = r.get('comps_c5_peer_of') or 0
    kind = r['kind']; home = r['cohorts'].get('board_home')
    why = []
    if b == 'FUNDS66':
        tier = 'CLOSE'; why.append('Alan, 5 Oct: "we do not need 68 fund names on Hub" — a Geiger-only fund, shown on no tab today')
    elif b in ('ORIGINAL364', 'BOOKMARK56'):
        tier = 'LIVE'
        why.append('one of the original 364' if b == 'ORIGINAL364' else 'one of Alan\'s 56 bookmark names (24 Sep): stays FULL')
        if b == 'ORIGINAL364': why.append('Alan, 3 Oct: "none of those" leave')
    else:  # BATCH104 — study name by name
        if on_lists: tier = 'LIVE'; why.append('on ' + ' + '.join(on_lists) + ' — lists are a rule to be on the Hub')
        elif hp: tier = 'LIVE'; why.append('a live-tracking name of ' + ', '.join(hp) + ' (U3\'s Hub point: the fund\'s line needs it intraday)')
        else:
            tier = 'CLOSE'  # provisional; the cohort pass below may pull it back
            why.append('on no list · tracks no fund live')
    decision[t] = {'ticker': t, 'name': r['name'], 'kind': kind, 'batch': b, 'today': r['today'], 'lists': on_lists, 'hub_point_funds': hp,
                   'board_home': home, 'cohorts': member_of.get(t, []), 'comps_peer_of': peer_of, 'comps_set': r.get('comps_c5_set') or 0,
                   'chinese': is_chinese(t), 'market_cap': mcap(t), 'industry': (r.get('profile') or {}).get('industry'),
                   'tier_before': 'LIVE', 'tier_after': tier, 'why': why}

# --- the cohort pass: no sound cohort may lose its soundness because of a move ------------------------------
# A sound cohort (tab or candidate) keeps enough LIVE members to stay sound on all six closes; names are pulled
# back biggest first (they carry the value). A cohort that is not sound today protects nobody (its mean is off).
pulled_back = collections.defaultdict(list)
for c in sorted(cohorts, key=lambda c: -c['t12_n']):
    if not c['t12_sound']: continue
    live = [t for t in c['tickers'] if decision[t]['tier_after'] == 'LIVE']
    leaving = sorted([t for t in c['tickers'] if decision[t]['tier_after'] != 'LIVE' and decision[t]['batch'] == 'BATCH104'], key=lambda t: -mcap(t))
    ok, w = sound_on(live)
    c['after_live_n'] = len(live); c['after_sound'] = ok; c['after_worst'] = w
    while not ok and leaving:
        t = leaving.pop(0); decision[t]['tier_after'] = 'LIVE'; pulled_back[t].append(c['label']); live.append(t)
        ok, w = sound_on(live); c['after_live_n'] = len(live); c['after_sound'] = ok; c['after_worst'] = w
for t, cs in pulled_back.items():
    decision[t]['why'] = [decision[t]['why'][0], 'kept live: ' + ' / '.join(cs) + ' would stop being sound without it']
for c in cohorts:
    if 'after_live_n' not in c:
        live = [t for t in c['tickers'] if decision[t]['tier_after'] == 'LIVE']; ok, w = sound_on(live)
        c['after_live_n'] = len(live); c['after_sound'] = ok; c['after_worst'] = w

# comps: a leaver that is a peer of a Hub company is stored for comps (daily bars, fundamentals, estimates)
for t, d in decision.items():
    if d['tier_after'] == 'CLOSE' and d['batch'] == 'BATCH104':
        c_s = [by_id[c]['label'] for c in d['cohorts'] if by_id[c]['t12_sound']]
        if c_s: d['why'].append('its cohort(s) ' + ' / '.join(c_s) + ' stay sound without it live')
        if d['comps_peer_of']: d['why'].append('a C5 comps peer of %d Hub companies — stored for comps (fundamentals, estimates, daily bars)' % d['comps_peer_of'])
        else: d['why'].append('a comps peer of no Hub company')
        d['why'].append('its Geiger stays on the tree and in the sector compare (close tier)')
    if d['batch'] == 'FUNDS66':
        d['why'].append('its reading still lives: the tree (fund node, close Geiger) · the compare strip\'s ' + ('EQUAL-WEIGHT family and the BOW TIE pair' if t.startswith('RSP') else 'ISHARES / VANGUARD families' if t in ('IYM','IYE','IYF','IYJ','IYW','IYK','IYR','IDU','IYH','IYC','IYZ','VAW','VDE','VFH','VIS','VGT','VDC','VNQ','VPU','VHT','VCR','VOX') else 'fund set on the tree') + ' · its company page')
    if d['chinese']:
        d['why'].append('a Chinese security — Alan, 3 Oct: an off-Hub candidate "when we can do it with order"; not moved by this package')

# --- joining list -----------------------------------------------------------------------------------------------
need = B1['verdicts']['names_needed']
joining = [{'ticker': 'SKHY', 'tier': 'LIVE', 'why': 'SK Hynix reaches 60 sessions at today\'s close; admission tonight (Alan, 5 Oct); its comps peers (MU, SNDK) are live'}]
for t in need['sectors']:
    joining.append({'ticker': t, 'tier': 'CLOSE', 'why': 'B1: one of the 7 ADRs that make every sector aggregate sound (value covered ≥ 90 %) — close Geiger is enough'})
for t in sorted(set(need['industries']) - set(need['sectors'])):
    joining.append({'ticker': t, 'tier': 'CLOSE', 'why': 'B1: makes a thin industry sound (foreign listing the close job does not read today)'})

# --- counts -----------------------------------------------------------------------------------------------------
before = collections.Counter(d['tier_before'] for d in decision.values())
after = collections.Counter(d['tier_after'] for d in decision.values())
leaving = [d for d in decision.values() if d['tier_after'] != 'LIVE']
leave_funds = [d for d in leaving if d['batch'] == 'FUNDS66']; leave_batch = [d for d in leaving if d['batch'] == 'BATCH104']
live_after = after['LIVE'] + 1  # + SKHY
close_after = after['CLOSE'] + len([j for j in joining if j['tier'] == 'CLOSE'])

# --- cost per name, measured ------------------------------------------------------------------------------------
# LIVE: the publisher reads 7 rungs per name per cycle from the chart API (one /candles request per rung), cycle ≈ 4 min
#       (measured 5 Oct 15:37:35Z → 15:41:42Z on what it publishes), the stream subscribes every name once.
# CLOSE: the seven-rung scout: 69,378 calls · 2.63 GB · 157 s for 5,563 names, once a night (its own cost block).
# STORAGE: R2 bytes of the FULL object per width, summed per name (U4b's read-only walk).
# the publisher's cycle: read from what it publishes — /geiger computed_utc sampled every 20 s on 5 Oct (data/publisher-samples-20261005.txt);
# the gaps between consecutive distinct artifacts are the cycles (two chart-API machines serve alternately, so only forward steps count)
CYCLE_S = 247; CYCLES = []
try:
    seen = []
    for ln in open(os.path.join(D, 'publisher-samples-20261005.txt')):
        parts = ln.split()
        if len(parts) >= 2 and parts[1].endswith('Z') and parts[1] not in seen: seen.append(parts[1])
    import datetime as _dt
    ts = sorted(_dt.datetime.fromisoformat(x.replace('Z', '+00:00')) for x in seen)
    CYCLES = [round((b - a).total_seconds()) for a, b in zip(ts, ts[1:])]
    if CYCLES: CYCLE_S = round(sum(CYCLES) / len(CYCLES))
except FileNotFoundError: pass
store = collections.defaultdict(int); store_daily = collections.defaultdict(int)
for sym, width, *_, full_status, full_bytes, _m in bars['rows']:
    if full_bytes: store[sym] += full_bytes
    if width == 'D' and full_bytes: store_daily[sym] += full_bytes
per_name_mb = statistics.median([v for v in store.values()]) / 1e6
daily_mb = statistics.median([v for v in store_daily.values()]) / 1e6
sc = scout['seven']['cost']
cost = {
  'live': {'rungs_per_cycle': 7, 'cycle_s_measured': CYCLE_S, 'cycles_measured': CYCLES, 'cycles_per_day_if_always_on': round(86400 / CYCLE_S), 'requests_per_name_per_day': round(7 * 86400 / CYCLE_S),
           'storage_mb_per_name_median_24_widths': round(per_name_mb, 1), 'cycle_s_per_name_at_conc_6': round(CYCLE_S / 590, 3),
           'cycle_s_at_recommended': round(CYCLE_S / 590 * live_after)},
  'close': {'calls_per_name_per_night': round(sc['calls'] / sc['names_asked'], 1), 'kb_per_name_per_night': round(sc['bytes'] / sc['names_asked'] / 1e3),
            'machine_s_per_name_per_night': round(sc['elapsed_s'] / sc['names_asked'], 3), 'storage_mb_per_name_daily_object': round(daily_mb, 2), 'names_tonight': sc['names_asked']},
  'comps': {'requests_per_name_per_day': 'fundamentals weekly, estimates nightly (two FMP /stable routes); no Geiger, no bars beyond the daily object',
            'storage': 'rows in the Hub database: statements (median 56 quarters), estimates (60 periods), one profile row — kilobytes per name'}
}

out = {'built_from': 'U4b facts (3 Oct 14:47Z) · T12 cohorts (3 Oct) · B1 bow tie (2 Oct close) · lists (3 Oct) · bars walk (3 Oct)',
       'universe': {'count': 590, 'sha256': facts['scope']['universe_sha256']},
       'counts': {'before': {'LIVE': 590, 'CLOSE_tree_only': B1['counts']['computed_stocks'] - B1['counts']['live_hub'], 'COMPS_only': 0},
                  'after': {'LIVE': live_after, 'CLOSE_tree_only': B1['counts']['computed_stocks'] - B1['counts']['live_hub'] + len(leaving) + (close_after - after['CLOSE']), 'COMPS_only': 0},
                  'leaving': len(leaving), 'leaving_funds': len(leave_funds), 'leaving_batch': len(leave_batch), 'joining_live': 1, 'joining_close': close_after - after['CLOSE'],
                  'pulled_back_for_cohorts': len(pulled_back), 'chinese_candidates': sum(1 for d in decision.values() if d['chinese'])},
       'one_number': live_after, 'cost': cost, 'cohorts': cohorts, 'decision': sorted(decision.values(), key=lambda d: d['ticker']),
       'leaving': sorted(leaving, key=lambda d: (d['batch'], -d['market_cap'])), 'joining': joining, 'pulled_back': dict(pulled_back)}
json.dump(out, open(os.path.join(H, 'decision.json'), 'w'), indent=1)
print(json.dumps(out['counts'], indent=1)); print('one number', live_after); print('cost', json.dumps(cost, indent=1))
print('leaving batch', [d['ticker'] for d in leave_batch]); print('pulled back', dict(pulled_back))
print('chinese', [d['ticker'] for d in decision.values() if d['chinese']])
for c in cohorts:
    if c['t12_sound']: print('%-32s n %3d → live %3d sound after %s worst %s' % (c['label'], c['t12_n'], c['after_live_n'], c['after_sound'], c['after_worst']))

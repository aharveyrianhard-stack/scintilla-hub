import json,datetime as d
D=json.load(open('db-fundamentals-all.json')); Q=json.load(open('quotes.json'))
today=d.date(2026,10,6); P=lambda s: d.date.fromisoformat(s)
est={};hist={}
for e in D['estimates']: est.setdefault(e['ticker'],[]).append(e)
for h in D['history_fy']: hist.setdefault(h['ticker'],[]).append(h)
fund={f['ticker']:f for f in D['fundamentals']}; prof={p['ticker']:p for p in D['profile']}
G={}
for t,p in prof.items():
    if p.get('is_etf') in (True,'true'): continue
    f=fund.get(t,{}); price=(Q.get(t) or {}).get('price') or f.get('price') or p.get('price')
    E=sorted(est.get(t,[]),key=lambda e:e['fiscal_date']); Hs=sorted(hist.get(t,[]),key=lambda h:h['fiscal_date'],reverse=True)
    o={'name':p.get('name'),'sector':p.get('sector'),'industry':p.get('industry'),'mcap':p.get('market_cap') or f.get('market_cap'),'price':price,'pe_ttm':f.get('trailing_pe'),'eps_ttm':f.get('eps_ttm'),'ntm':None,'why':None}
    if not Hs: o['why']='no reported fiscal year on file'; G[t]=o; continue
    last=Hs[0]; fut=[e for e in E if e['fiscal_date']>last['fiscal_date']]
    if len(fut)<2: o['why']='fewer than two forward estimate years'; G[t]=o; continue
    f1,f2=fut[0],fut[1]; w=max(0,min(1,(P(f1['fiscal_date'])-today).days/365.0))
    bl=lambda a,b: None if a is None or b is None else w*a+(1-w)*b
    g=lambda a,b: None if a is None or b is None or b<=0 else (a/b-1)*100
    ntm_rev=bl(f1['est_revenue_avg'],f2['est_revenue_avg']); pr_rev=bl(last['revenue'],f1['est_revenue_avg'])
    ntm_eps=bl(f1['est_eps_avg'],f2['est_eps_avg']); pr_eps=bl(last['eps_diluted'],f1['est_eps_avg'])
    o['last_fy']=last['fiscal_date']; o['fy1']=f1['fiscal_date']; o['fy2']=f2['fiscal_date']
    o['ntm']={'w_fy1':round(w,2),'rev':ntm_rev,'eps':ntm_eps,'prior_rev':pr_rev,'prior_eps':pr_eps,'rev_g':g(ntm_rev,pr_rev),'eps_g':g(ntm_eps,pr_eps),
              'eps_g_note':('prior EPS not positive' if (pr_eps is None or pr_eps<=0) else None),'fwd_pe':(price/ntm_eps if (price and ntm_eps and ntm_eps>0) else None),
              'target_avg':f1.get('price_target_avg'),'est_updated':f1.get('updated_ts')}
    G[t]=o
json.dump(G,open('growth-all.json','w'),indent=1)
print(len(G),'companies;',sum(1 for o in G.values() if o['ntm']),'with NTM growth;', [t for t,o in G.items() if not o['ntm']][:20])

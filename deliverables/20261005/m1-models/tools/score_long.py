import json,sys,collections,re
S=sys.argv[1]
news=json.load(open(S+'/data/news100.json')); yt=json.load(open(S+'/data/yt20.json'))
NL=json.load(open(S+'/data/news100_labels.json')); YL=json.load(open(S+'/data/yt20_labels.json'))
gn=NL['labels']; gy=YL['labels']; notabout=set(NL['not_about_filed_ticker'])
enc=json.load(open(S+'/data/long_enc.json')); llm=json.load(open(S+'/data/long_llm.json'))
def f1(g,p,c):
    tp=sum(a==c and b==c for a,b in zip(g,p)); fp=sum(a!=c and b==c for a,b in zip(g,p)); fn=sum(a==c and b!=c for a,b in zip(g,p))
    return 2*tp/(2*tp+fp+fn) if tp else 0.0
def stats(g,p):
    p=p.replace('U','N').replace('?','N')
    return {'n':len(g),'accuracy':round(sum(a==b for a,b in zip(g,p))/len(g),3),'macro_f1':round(sum(f1(g,p,c) for c in 'BSN')/3,3),'opposite_calls':sum((a,b) in (('B','S'),('S','B')) for a,b in zip(g,p)),'calls':dict(collections.Counter(p))}
full=[r['i'] for r in news if r['article_chars']>800]
gfull=''.join(gn[i] for i in full)
out={'news_snippet':[], 'news_article':[], 'youtube':[], 'aboutness':[]}
short=lambda m:m.split('/')[-1]
for m,R in enc.items():
    out['news_snippet'].append({'method':short(m)+' · one pass, no ticker','ms':R['news_snippet_ms'],**stats(gn,R['news_snippet_argmax'])})
    out['news_article'].append({'method':short(m)+' · chunks averaged','ms':R['news_article_ms'],**stats(gfull,''.join(R['news_article_chunkmean'][str(i)] for i in full))})
    if 'news_article_whole8192' in R: out['news_article'].append({'method':short(m)+' · whole article in one pass (8,192 tokens)','ms':R['news_article_whole_ms'],**stats(gfull,''.join(R['news_article_whole8192'][str(i)] for i in full))})
    out['youtube'].append({'method':short(m)+' · first 512 tokens only','ms':R['yt_first512_ms'],**stats(gy,R['yt_first512'])})
    out['youtube'].append({'method':short(m)+' · all chunks averaged','ms':R['yt_chunkmean_ms'],**stats(gy,R['yt_chunkmean'])})
    out['youtube'].append({'method':short(m)+' · only passages naming the ticker, averaged','ms':R['yt_tickerwindows_ms'],**stats(gy,R['yt_tickerwindows'])})
    if 'yt_whole8192' in R: out['youtube'].append({'method':short(m)+' · whole transcript in one pass (8,192 tokens)','ms':R['yt_whole8192_ms'],**stats(gy,R['yt_whole8192'])})
for m,R in llm.items():
    out['news_snippet'].append({'method':short(m)+' · asked about the ticker','ms':R['news_snippet_ms'],**stats(gn,R['news_snippet'])})
    out['news_article'].append({'method':short(m)+' · reads whole article, asked about the ticker','ms':R['news_article_ms'],**stats(gfull,''.join(R['news_article'][str(i)] for i in full))})
    out['youtube'].append({'method':short(m)+' · reads whole transcript, asked about the ticker','ms':R['yt_whole_ms'],**stats(gy,R['yt_whole'])})
    p=R['news_snippet']; tp=sum(p[i]=='U' for i in notabout); fp=sum(p[i]=='U' for i in range(100) if i not in notabout)
    out['aboutness'].append({'method':short(m)+' · answers UNRELATED','caught_of_12':tp,'false_alarms_of_88':fp})
for m,R in json.load(open(S+'/data/long_llm_windows.json')).items():
    out['youtube'].append({'method':short(m)+' · reads only the passages naming the ticker (found by the name list)','ms':R['ms'],**stats(gy,R['yt_windows'])})
# gazetteer aboutness: ticker or company short name appears in title+snippet
gaz={r['ticker']:r['name'] for r in json.load(open(S+'/data/gaz_raw.json'))['rows']}
def short_name(name):
    n=re.sub(r'\b(Inc\.?|Corporation|Corp\.?|Company|Co\.?|Ltd\.?|Limited|Holdings?|Group|PLC|plc|N\.V\.|S\.A\.|Technologies|Technology|Platforms|Class [A-C]|Trust|ETF|Common Stock|Incorporated|,)\b','',name).strip(' ,.&')
    return n.split()[0] if n else name
tp=fp=0; miss=[]
for r in news:
    t=(r['title'] or '')+' '+(r['snippet'] or ''); tk=r['ticker']; nm=short_name(gaz.get(tk,tk))
    hit=bool(re.search(r'(?<![A-Za-z])'+re.escape(tk)+r'(?![A-Za-z])',t)) or (len(nm)>2 and nm.lower() in t.lower())
    if not hit:
        if r['i'] in notabout: tp+=1
        else: fp+=1; miss.append((r['i'],tk,nm))
out['aboutness'].append({'method':'ticker + company-name list (exact ticker or first word of the name appears)','caught_of_12':tp,'false_alarms_of_88':fp,'false_alarm_rows':miss})
for k in ['news_snippet','news_article','youtube']:
    out[k].sort(key=lambda r:(-r['accuracy'],r['ms']))
    print('\n##',k,'gold',dict(collections.Counter(gn if k=='news_snippet' else gfull if k=='news_article' else gy)))
    for r in out[k]: print(f"  {r['method'][:86]:86s} acc {r['accuracy']:.2f} mF1 {r['macro_f1']:.2f} opp {r['opposite_calls']} ms {r['ms']} {r['calls']}")
print('\n## aboutness'); [print('  ',r) for r in out['aboutness']]
out['gold']={'news':dict(collections.Counter(gn)),'news_article_subset':dict(collections.Counter(gfull)),'youtube':dict(collections.Counter(gy))}
json.dump(out,open(S+'/data/long_bakeoff.json','w'),indent=1)

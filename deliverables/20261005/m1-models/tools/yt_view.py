import json,sys,re
S=sys.argv[1]
g={r['ticker']:r['name'] for r in json.load(open(S+'/data/gaz_raw.json'))['rows']}
print('gazetteer',len(g))
def short(name):
    n=re.sub(r'\b(Inc\.?|Corporation|Corp\.?|Company|Co\.?|Ltd\.?|Limited|Holdings?|Group|PLC|plc|N\.V\.|S\.A\.|Technologies|Technology|Platforms|Class [A-C]|Trust|ETF|Common Stock|Incorporated|,)\b','',name).strip(' ,.&')
    return ' '.join(n.split()[:2]) if n else name
EXTRA={'GOOGL':['google','alphabet'],'SPY':['s&p','s and p','spy','sp500','s&p 500'],'QQQ':['nasdaq','qqq','triple q','cues'],'NBIS':['nebius','nebus','nbis'],'IREN':['iren','iris energy','i-ren','iron'],'CBRS':['cerebras','cbrs'],'BE':['bloom'],'WDC':['western digital','wdc'],'MU':['micron'],'NVDA':['nvidia','nvda'],'ORCL':['oracle'],'NFLX':['netflix']}
y=[r for r in json.load(open(S+'/data/yt_transcripts.json')) if r['status']=='ok']
out=[]
for r in y:
    al=set(EXTRA.get(r['ticker'],[]))|{short(g.get(r['ticker'],r['ticker'])).lower()}
    pat=re.compile('|'.join(re.escape(a) for a in sorted(al,key=len,reverse=True)),re.I)
    ms=[m.start() for m in pat.finditer(r['text'])]
    r['aliases']=sorted(al); r['mentions']=len(ms)
    wins=[]; last=-999
    for p in ms:
        if p-last<260: continue
        last=p; wins.append(r['text'][max(0,p-130):p+170])
    r['windows']=wins; out.append(r)
out=[r for r in out if r['mentions']>=3][:20]
json.dump(out,open(S+'/data/yt20.json','w'),ensure_ascii=False)
print(len(out))
lo,hi=int(sys.argv[2]),int(sys.argv[3])
for i,r in enumerate(out[lo:hi],lo):
    print(f"\n[{i}] {r['ticker']} | {r['channel_title']} | {r['title']} | {r['chars']} chars, {r['mentions']} mentions, auto={r['generated']}")
    k=max(1,len(r['windows'])//6)
    for w in r['windows'][::k][:6]: print('   …'+w+'…')

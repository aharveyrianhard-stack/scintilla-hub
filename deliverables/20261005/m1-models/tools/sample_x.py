import json,re,random,collections,statistics,sys
S=sys.argv[1]
j=json.load(open(S+"/data/xfeed.json"))
P=j['posts']
ct=re.compile(r'\$[A-Za-z]{1,6}\b')
def txt(p): return (str(p.get('text') or '')+' '+str((p.get('original') or {}).get('text') or '')).strip()
seen=set(); pool=[]
for p in sorted(P,key=lambda p:p['id']):
    t=txt(p)
    if not ct.search(t): continue
    k=re.sub(r'\s+',' ',t.lower())[:120]
    if k in seen: continue
    seen.add(k); pool.append(p)
print('posts',len(P),'with cashtag, deduped',len(pool))
L=[len(txt(p)) for p in pool]; print('len median',statistics.median(L),'p90',sorted(L)[int(.9*len(L))],'max',max(L))
print('dates',min(p['created_at'] for p in P),max(p['created_at'] for p in P))
print(collections.Counter(p.get('kind') for p in P).most_common(8))
random.seed(20261005)
samp=random.sample(pool,300)
out=[{'i':i,'id':p['id'],'handle':p.get('handle'),'created_at':p['created_at'],'kind':p.get('kind'),'text':txt(p)} for i,p in enumerate(samp)]
json.dump(out,open(S+"/data/x300.json",'w'),ensure_ascii=False,indent=0)
for r in out[:50]:
    print(f"[{r['i']}] @{r['handle']}: "+re.sub(r'\s+',' ',r['text'])[:420])

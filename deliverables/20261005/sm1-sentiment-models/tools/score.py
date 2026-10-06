import json,glob,collections,sys,importlib.util
sys.path.insert(0,'job'); import lf_ticker as T2
spec=importlib.util.spec_from_file_location('v1','data/lf_ticker_v1.py'); T1=importlib.util.module_from_spec(spec); spec.loader.exec_module(T1)
S=json.load(open('data/testset.json')); L=json.load(open('data/labels.json')); rows=json.load(open('data/gaz.json'))
g1=T1.Gazetteer(rows); g2=T2.Gazetteer(rows); known=set(g2.names)
ids={'news':[c['id'] for c in S if c['kind']=='news'],'speech':[c['id'] for c in S if c['kind']=='speech']}
def f1(pred,ids_):
    fs=[]
    for k in 'BSN':
        tp=sum(1 for i in ids_ if pred[i]==k and L[i]['stance']==k); fp=sum(1 for i in ids_ if pred[i]==k and L[i]['stance']!=k); fn=sum(1 for i in ids_ if pred[i]!=k and L[i]['stance']==k)
        fs.append(2*tp/(2*tp+fp+fn) if tp else 0.0)
    return sum(fs)/3
def stats(pred,ids_):
    n=len(ids_); sure=[i for i in ids_ if not L[i]['doubt_stance']]
    return {'acc':round(sum(pred[i]==L[i]['stance'] for i in ids_)/n,3),'macro_f1':round(f1(pred,ids_),3),
            'opposite':sum(1 for i in ids_ if {pred[i],L[i]['stance']}=={'B','S'}),
            'acc_sure':round(sum(pred[i]==L[i]['stance'] for i in sure)/len(sure),3),'n_sure':len(sure),'calls':dict(collections.Counter(pred[i] for i in ids_))}
preds={}; meta={}
for f in sorted(glob.glob('out/*.json')):
    if f.endswith('scoreboard.json'): continue
    d=json.load(open(f))
    if 'runs' in d:
        for rn,r in d['runs'].items():
            name=d['model']+(' · zero-shot'+(' told the ticker' if rn=='ticker' else '') if d['mode']=='nli' else '')
            preds[name]=r['labels']; meta[name]={'s_per_1000':r['s_per_1000'],'peak_rss_mb':d['peak_rss_mb'],'params_m':d['params_m'],'kind':d['mode'],'scores':r['scores']}
    else:
        name=d['gguf']+' · instruct, ticker-level (llama.cpp '+('CPU' if d.get('ngl','0')=='0' else 'Mac GPU')+')'
        preds[name]={i:o['stance'] for i,o in d['out'].items()}; meta[name]={'s_per_1000':d['s_per_1000'],'peak_rss_mb':d['peak_rss_mb'],'kind':'llm','tick':{i:o['ticker'] for i,o in d['out'].items()}}
preds['always neutral (the floor)']={c['id']:'N' for c in S}; meta['always neutral (the floor)']={'kind':'floor'}
# votes of two: agree -> that call; disagree -> neutral
def vote(a,b): return {i:(preds[a][i] if preds[a][i]==preds[b][i] else 'N') for i in preds[a]}
names=[n for n in preds if meta[n]['kind'] in('cls','nli','llm')]
board=[]
for n in preds: board.append({'model':n,**{k:v for k,v in meta[n].items() if k in('s_per_1000','peak_rss_mb','params_m','kind')},'news':stats(preds[n],ids['news']),'speech':stats(preds[n],ids['speech'])})
votes=[]
for i,a in enumerate(names):
    for b in names[i+1:]:
        v=vote(a,b); votes.append({'a':a,'b':b,'news':stats(v,ids['news']),'speech':stats(v,ids['speech']),'s_per_1000':round(meta[a]['s_per_1000']+meta[b]['s_per_1000'],1)})
# ---- ticker attribution
def norm(t): return {'GOOG':'GOOGL'}.get(t,t) if t else 'NONE'
def tick_stats(fn):
    out={}
    for k in ('news','speech'):
        named=[c for c in S if c['kind']==k and L[c['id']]['ticker'] in known and L[c['id']]['ticker'] not in('NONE','OTHER','MARKET')]
        rest=[c for c in S if c['kind']==k and c not in named]
        ok=sum(norm(fn(c))==norm(L[c['id']]['ticker']) for c in named)
        okr=sum((fn(c) in (None,'NONE','MARKET','OTHER')) or (fn(c) not in known) for c in rest)
        out[k]={'named_chunks':len(named),'named_right':ok,'named_acc':round(ok/len(named),3),'unnamed_chunks':len(rest),'unnamed_left_blank':okr,'all_acc':round((ok+okr)/(len(named)+len(rest)),3)}
    return out
tick={'name list v1 + filed fallback (as first written)':tick_stats(lambda c:g1.about(c['text'],c['filed'])[0]),
      'name list v2 + filed fallback (mis-heard names added, common words removed)':tick_stats(lambda c:g2.about(c['text'],c['filed'],c['kind'])[0]),
      'name list v2, no fallback':tick_stats(lambda c:(lambda r:r[0] if r[1]=='name' else None)(g2.about(c['text'],c['filed'],c['kind']))),
      'filed ticker only (what we do today)':tick_stats(lambda c:c['filed'])}
for n in names:
    if meta[n]['kind']=='llm': tick[n]=tick_stats(lambda c,n=n:meta[n]['tick'].get(c['id']))
# ---- per-video lean: roll the chunk calls up the way the job does, against the same roll-up of the hand labels
W={c['id']:len(c['text'].split()) for c in S}; DOC={c['id']:c['doc'] for c in S}
def lab(x,t=0.15): return 'B' if x>t else 'S' if x<-t else 'N'
def doc_lean(val,ids_):
    by=collections.defaultdict(list)
    for i in ids_: by[DOC[i]].append(i)
    return {d:lab(sum(val[i]*W[i] for i in v)/sum(W[i] for i in v)) for d,v in by.items() if len(v)>=4}
num={'B':1,'S':-1,'N':0}
ref_doc=doc_lean({i:num[L[i]['stance']] for i in L},ids['speech'])
for b in board:
    n=b['model']; sc=meta[n].get('scores') or {i:num[preds[n][i]] for i in preds[n]}
    pd=doc_lean(sc,ids['speech']); b['speech_video']={'n':len(ref_doc),'right':sum(pd[d]==ref_doc[d] for d in ref_doc),'opposite':sum({pd[d],ref_doc[d]}=={'B','S'} for d in ref_doc)}
# ---- does a wider neutral band help? pick the band on the odd chunks, report it on the even ones
for b in board:
    n=b['model']; sc=meta[n].get('scores')
    if not sc or meta[n]['kind']!='cls': continue
    b['band']={}
    for k in ('news','speech'):
        A=[i for j,i in enumerate(ids[k]) if j%2]; B_=[i for j,i in enumerate(ids[k]) if not j%2]
        best=max([x/20 for x in range(1,19)],key=lambda t:sum(lab(sc[i],t)==L[i]['stance'] for i in A))
        b['band'][k]={'band':best,'acc_other_half':round(sum(lab(sc[i],best)==L[i]['stance'] for i in B_)/len(B_),3),'argmax_other_half':round(sum(preds[n][i]==L[i]['stance'] for i in B_)/len(B_),3)}
json.dump({'board':board,'votes':votes,'ticker':tick,'ref_video_leans':dict(collections.Counter(ref_doc.values())),'gold':{k:dict(collections.Counter(L[i]['stance'] for i in ids[k])) for k in ids}},open('out/scoreboard.json','w'),indent=1)
print(f"{'model':78} {'news':>5} {'f1':>5} {'opp':>3} {'sure':>5} | {'spch':>5} {'f1':>5} {'opp':>3} {'sure':>5} | {'s/1k':>6} {'MB':>5}")
for b in sorted(board,key=lambda b:-(b['news']['acc']+b['speech']['acc'])):
    print(f"{b['model'][:78]:78} {b['news']['acc']:5.3f} {b['news']['macro_f1']:5.3f} {b['news']['opposite']:3d} {b['news']['acc_sure']:5.3f} | {b['speech']['acc']:5.3f} {b['speech']['macro_f1']:5.3f} {b['speech']['opposite']:3d} {b['speech']['acc_sure']:5.3f} | {b.get('s_per_1000',0):6.1f} {b.get('peak_rss_mb',0):5d}")
print('--- best votes of two (by news+speech accuracy)')
for v in sorted(votes,key=lambda v:-(v['news']['acc']+v['speech']['acc']))[:6]:
    print(f"{(v['a'][:36]+' + '+v['b'][:36]):78} {v['news']['acc']:5.3f} {v['news']['macro_f1']:5.3f} {v['news']['opposite']:3d} {v['news']['acc_sure']:5.3f} | {v['speech']['acc']:5.3f} {v['speech']['macro_f1']:5.3f} {v['speech']['opposite']:3d} {v['speech']['acc_sure']:5.3f} | {v['s_per_1000']:6.1f}")
print('--- ticker attribution'); 
for n,t in tick.items(): print(f"{n[:78]:78} news named {t['news']['named_right']}/{t['news']['named_chunks']} all {t['news']['all_acc']} | speech named {t['speech']['named_right']}/{t['speech']['named_chunks']} all {t['speech']['all_acc']}")

print('--- per-video lean (videos with >=4 sampled chunks):',dict(collections.Counter(ref_doc.values())))
for b in sorted(board,key=lambda b:-b['speech_video']['right']): print(f"{b['model'][:78]:78} {b['speech_video']['right']}/{b['speech_video']['n']} opposite {b['speech_video']['opposite']}", b.get('band',''))

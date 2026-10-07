import json,sys,collections
S=sys.argv[1]
gold=json.load(open(S+'/data/x100_labels.json'))['labels']
cls=json.load(open(S+'/data/x300_cls.json')); llm=json.load(open(S+'/data/x300_llm.json'))
lex=json.load(open(S+'/data/x300_lex.json'))
preds={'current word list (lm-v1)':''.join('N' if r['score'] in (None,0) else 'B' if r['score']>0 else 'S' for r in lex['res'])}
speed={'current word list (lm-v1)':lex['ms_per_item']}
for k,v in cls.items():
    if 'preds' in v: preds[k]=v['preds']; speed[k]=v['cpu_ms_per_item_4threads']
for k,v in llm.items():
    if 'preds' in v: preds[k]=v['preds']; speed[k]=v['metal_ms_per_item']
def f1(g,p,c):
    tp=sum(a==c and b==c for a,b in zip(g,p)); fp=sum(a!=c and b==c for a,b in zip(g,p)); fn=sum(a==c and b!=c for a,b in zip(g,p))
    return 2*tp/(2*tp+fp+fn) if tp else 0.0
out=[]
for k,p in preds.items():
    p100=p[:100]
    acc=sum(a==b for a,b in zip(gold,p100))/100
    opp=sum((a,b) in (('B','S'),('S','B')) for a,b in zip(gold,p100))
    row={'model':k,'accuracy_100':acc,'macro_f1_100':round(sum(f1(gold,p100,c) for c in 'BSN')/3,3),'f1_bull':round(f1(gold,p100,'B'),2),'f1_bear':round(f1(gold,p100,'S'),2),'f1_neutral':round(f1(gold,p100,'N'),2),'opposite_calls_100':opp,'ms_per_item':round(speed[k],2),'dist_300':dict(collections.Counter(p))}
    out.append(row)
out.sort(key=lambda r:-r['accuracy_100'])
for r in out: print(f"{r['model'][:62]:62s} acc {r['accuracy_100']:.2f} mF1 {r['macro_f1_100']:.2f} B/S/N f1 {r['f1_bull']}/{r['f1_bear']}/{r['f1_neutral']} opp {r['opposite_calls_100']} ms {r['ms_per_item']} {r['dist_300']}")
print('gold',collections.Counter(gold),'always-bullish baseline acc',gold.count('B')/100)
json.dump({'gold_distribution':dict(collections.Counter(gold)),'always_bullish_accuracy':gold.count('B')/100,'rows':out,'preds':preds},open(S+'/data/x_bakeoff.json','w'),indent=1)

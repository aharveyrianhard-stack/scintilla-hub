# One model per process so peak memory is that model's own. CPU only, 4 threads.
import json,sys,time,resource,os,torch
torch.set_num_threads(4)
m=sys.argv[1]; mode=sys.argv[2]  # cls | nli
S=json.load(open('data/testset.json')); names=json.load(open('data/names.json'))
from transformers import AutoTokenizer, AutoModelForSequenceClassification, BertTokenizer, BertForSequenceClassification
t0=time.time()
tok=BertTokenizer.from_pretrained(m) if 'finbert-tone' in m else AutoTokenizer.from_pretrained(m)
mod=(BertForSequenceClassification if 'finbert-tone' in m else AutoModelForSequenceClassification).from_pretrained(m).eval()
load_s=time.time()-t0; id2={int(k):v.lower() for k,v in mod.config.id2label.items()}
res={'model':m,'mode':mode,'load_s':round(load_s,1),'params_m':round(sum(p.numel() for p in mod.parameters())/1e6,1),'runs':{}}
def run(name,fn):
    fn(S[0]); t=time.time(); out=[fn(c) for c in S]; dt=time.time()-t
    res['runs'][name]={'labels':{c['id']:o[0] for c,o in zip(S,out)},'scores':{c['id']:round(o[1],3) for c,o in zip(S,out)},'s_per_1000':round(dt/len(S)*1000,1)}
    print(m,name,res['runs'][name]['s_per_1000'],flush=True)
if mode=='cls':
    if 'finbert-tone' in m: pi,ni=1,2          # the card: 0 neutral, 1 positive, 2 negative
    else:
        pi=[i for i,l in id2.items() if l.startswith('pos') or 'bull' in l][0]; ni=[i for i,l in id2.items() if l.startswith('neg') or 'bear' in l][0]
    def f(c):
        with torch.no_grad(): p=torch.softmax(mod(**tok(c['text'],return_tensors='pt',truncation=True,max_length=512)).logits[0],-1)
        a=int(p.argmax()); return ('B' if a==pi else 'S' if a==ni else 'N', float(p[pi]-p[ni]))
    run('plain',f)
else:
    ei=[i for i,l in id2.items() if l.startswith('entail')][0]
    def nli(text,hyps):
        with torch.no_grad():
            lg=mod(**tok([text]*len(hyps),hyps,return_tensors='pt',truncation='only_first',max_length=512,padding=True)).logits
        e=lg[:,ei]; p=torch.softmax(e,-1); a=int(p.argmax()); return ('BSN'[a], float(p[0]-p[1]))
    def plain(c): return nli(c['text'],["This is bullish for the stock: good news or a positive view.","This is bearish for the stock: bad news or a negative view.","This is neutral for the stock: no clear good or bad view."])
    def tick(c):
        t=c.get('gaz_about'); n=(names.get(t) or t) if t else 'the market'
        return nli(c['text'],[f"The view on {n} here is bullish: good news or a positive opinion.",f"The view on {n} here is bearish: bad news or a negative opinion.",f"The view on {n} here is neutral: no clear good or bad opinion."])
    run('plain',plain); run('ticker',tick)
res['peak_rss_mb']=round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/(1024*1024 if sys.platform=='darwin' else 1024))
json.dump(res,open('out/'+m.replace('/','__')+'.json','w'))

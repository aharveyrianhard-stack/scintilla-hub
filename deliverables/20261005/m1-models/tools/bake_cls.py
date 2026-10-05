import json,sys,time,os,re,torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
S=sys.argv[1]; inp=sys.argv[2]; out=sys.argv[3]; field=sys.argv[4] if len(sys.argv)>4 else 'text'
rows=json.load(open(inp))
MODELS=["ProsusAI/finbert","yiyanghkust/finbert-tone","cardiffnlp/twitter-roberta-base-sentiment-latest","StephanAkkerman/FinTwitBERT-sentiment","mrm8488/deberta-v3-ft-financial-news-sentiment-analysis","mrm8488/distilroberta-finetuned-financial-news-sentiment-analysis","tabularisai/ModernFinBERT","soleimanian/financial-roberta-large-sentiment"]
def norm(l):
    l=l.lower()
    if l.startswith('pos') or 'bull' in l: return 'B'
    if l.startswith('neg') or 'bear' in l: return 'S'
    return 'N'
def clean(t): return re.sub(r'https?://\S+','',t).strip()
torch.set_num_threads(4)
res={}
for m in MODELS:
    try:
        tok=AutoTokenizer.from_pretrained(m); mod=AutoModelForSequenceClassification.from_pretrained(m).eval()
        id2=mod.config.id2label; nparam=sum(p.numel() for p in mod.parameters())
        preds=[]; probs=[]
        t0=time.time()
        with torch.no_grad():
            for r in rows:
                x=tok(clean(r[field]),return_tensors='pt',truncation=True,max_length=512)
                p=torch.softmax(mod(**x).logits[0],-1)
                k=int(p.argmax()); preds.append(norm(id2[k])); probs.append({norm(id2[i]):round(float(p[i]),4) for i in range(len(p))})
        ms=(time.time()-t0)/len(rows)*1000
        res[m]={'labels':{str(k):v for k,v in id2.items()},'params_m':round(nparam/1e6,1),'cpu_ms_per_item_4threads':round(ms,1),'preds':''.join(preds),'probs':probs}
        print(m,'params',round(nparam/1e6),'M','ms/item',round(ms,1),id2,flush=True)
    except Exception as e:
        res[m]={'error':repr(e)[:300]}; print('FAIL',m,repr(e)[:300],flush=True)
json.dump(res,open(out,'w'))

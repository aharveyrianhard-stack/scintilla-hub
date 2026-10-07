import json,sys,time,torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
S=sys.argv[1]
d=json.load(open(f"{S}/fmp/er1-out.json"))
models={"ModernFinBERT":"tabularisai/ModernFinBERT","FinBERT (ProsusAI)":"ProsusAI/finbert"}
res={}
for label,mid in models.items():
    tok=AutoTokenizer.from_pretrained(mid); m=AutoModelForSequenceClassification.from_pretrained(mid); m.eval()
    id2=m.config.id2label
    for t,o in d['tickers'].items():
        heads=[(r.get('publishedDate'),r.get('title')) for r in o['news'] if isinstance(o['news'],list)][:40]
        rows=[]
        with torch.no_grad():
            for dt,h in heads:
                e=tok(h,return_tensors="pt",truncation=True,max_length=128)
                p=torch.softmax(m(**e).logits,-1)[0]
                i=int(p.argmax()); rows.append({"date":dt,"title":h,"label":id2[i].lower(),"p":round(float(p[i]),3)})
        res.setdefault(t,{})[label]=rows
        json.dump(res,open(f"{S}/finbert-out.json","w"),indent=1)
        print(label,t,{k:sum(1 for r in rows if r['label'].startswith(k)) for k in ['pos','neg','neu','bull','bear']},flush=True)
print("FINBERT_DONE")

import json,sys,time,torch
torch.set_num_threads(4)
from sentence_transformers import SentenceTransformer
S=sys.argv[1]; titles=[r['title'] for r in json.load(open(S+'/data/news_titles_raw.json'))['rows']][:1000]
out={}
for m in ["BAAI/bge-small-en-v1.5","BAAI/bge-m3","intfloat/e5-base-v2","thenlper/gte-base","Alibaba-NLP/gte-modernbert-base"]:
    mod=SentenceTransformer(m,device='cpu'); mod.max_seq_length=256; mod.encode(titles[:64],batch_size=32)
    t0=time.time(); mod.encode(titles,batch_size=32); out[m]=round(len(titles)/(time.time()-t0)); print(m,out[m],flush=True); del mod
d=json.load(open(S+'/data/embed_test.json'))
for r in d:
    if r['model'] in out: r['cpu_headlines_per_s']=out[r['model']]; r.pop('share_of_3000_headlines_with_a_twin_at_0.90',None)
json.dump(d,open(S+'/data/embed_test.json','w'),indent=1)

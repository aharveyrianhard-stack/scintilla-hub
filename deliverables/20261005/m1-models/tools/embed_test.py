import json,sys,time,re,random,numpy as np,torch
from sentence_transformers import SentenceTransformer
S=sys.argv[1]
P=json.load(open(S+'/data/xfeed.json'))['posts']
# real near-duplicate pairs: a repost's truncated "RT @x: ..." text vs the full original post
pairs=[]; seen=set()
for p in P:
    o=(p.get('original') or {}).get('text'); t=p.get('text') or ''
    if p.get('kind')=='repost' and o and t.startswith('RT @') and len(o)>200 and o not in seen:
        seen.add(o); pairs.append((re.sub(r'^RT @\w+:\s*','',t)[:110],o))
random.seed(7); random.shuffle(pairs); pairs=pairs[:500]
pool=[o for _,o in pairs]; ps=set(pool)
dis=[p['text'] for p in P if p.get('kind')=='original' and len(p.get('text') or '')>80 and p['text'] not in ps]
random.shuffle(dis); pool+=dis[:5000]
titles=[r['title'] for r in json.load(open(S+'/data/news_titles_raw.json'))['rows']][:3000]
print('pairs',len(pairs),'pool',len(pool),'titles',len(titles),flush=True)
out=[]
MODELS=[("BAAI/bge-small-en-v1.5",{}, '', ''),("BAAI/bge-m3",{}, '', ''),("intfloat/e5-base-v2",{}, 'query: ', 'passage: '),("thenlper/gte-base",{}, '', ''),("Alibaba-NLP/gte-modernbert-base",{}, '', ''),("nomic-ai/nomic-embed-text-v1.5",{'trust_remote_code':True}, 'search_query: ', 'search_document: ')]
for m,kw,qp,dp in MODELS:
    if kw.get('trust_remote_code') and '--allow-remote-code' not in sys.argv:
        out.append({'model':m,'skipped':'needs trust_remote_code (runs code from the model repo); not executed in this run'}); print(out[-1]); continue
    try:
        r={'model':m}
        for dev in ['cpu','mps']:
            mod=SentenceTransformer(m,device=dev,**kw); mod.max_seq_length=min(mod.max_seq_length or 512,512)
            if dev=='cpu': torch.set_num_threads(4)
            mod.encode(titles[:32]); t0=time.time(); E=mod.encode([dp+t for t in titles],batch_size=64,normalize_embeddings=True); el=time.time()-t0
            r[f'{dev}_headlines_per_s']=round(len(titles)/el); r['dim']=int(E.shape[1])
        Q=mod.encode([qp+q for q,_ in pairs],batch_size=64,normalize_embeddings=True); D=mod.encode([dp+d for d in pool],batch_size=32,normalize_embeddings=True)
        sim=Q@D.T; r['repost_to_original_recall_at_1']=round(float((sim.argmax(1)==np.arange(len(pairs))).mean()),3)
        # news near-duplicate rate at a fixed threshold (how many headlines have a twin >=0.9)
        T=mod.encode([dp+t for t in titles],batch_size=64,normalize_embeddings=True); s=T@T.T; np.fill_diagonal(s,0); r['share_of_3000_headlines_with_a_twin_at_0.90']=round(float((s.max(1)>=0.90).mean()),3)
        r['params_m']=round(sum(p.numel() for p in mod.parameters())/1e6)
        out.append(r); print(r,flush=True); del mod
    except Exception as e:
        out.append({'model':m,'error':repr(e)[:200]}); print(out[-1],flush=True)
json.dump(out,open(S+'/data/embed_test.json','w'),indent=1)

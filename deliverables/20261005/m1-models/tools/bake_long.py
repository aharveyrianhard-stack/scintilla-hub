# Long-form bake-off: news rows (title+snippet, and fetched full article) and YouTube transcripts.
import json,sys,time,re,os,torch
S=sys.argv[1]; MODE=sys.argv[2]   # enc | llm
gaz={r['ticker']:r['name'] for r in json.load(open(S+'/data/gaz_raw.json'))['rows']}
news=json.load(open(S+'/data/news100.json')); yt=json.load(open(S+'/data/yt20.json'))
OUT=S+'/data/long_'+MODE+'.json'
res=json.load(open(OUT)) if os.path.exists(OUT) else {}
def ntext(r): return (r['title'] or '')+'. '+(r['snippet'] or '')
def chunks(t,n=220):
    w=t.split(); return [' '.join(w[i:i+n]) for i in range(0,len(w),n)] or ['']
def lab(s,t=0.15): return 'B' if s>t else 'S' if s<-t else 'N'
if MODE=='enc':
    from transformers import AutoTokenizer, AutoModelForSequenceClassification, BertTokenizer, BertForSequenceClassification
    def TOK(m): return BertTokenizer.from_pretrained(m) if 'finbert-tone' in m else AutoTokenizer.from_pretrained(m)
    torch.set_num_threads(4)
    for m in (sys.argv[3:] or ["ProsusAI/finbert","tabularisai/ModernFinBERT","mrm8488/distilroberta-finetuned-financial-news-sentiment-analysis","yiyanghkust/finbert-tone","mrm8488/deberta-v3-ft-financial-news-sentiment-analysis"]):
        tok=TOK(m); mod=(BertForSequenceClassification if 'finbert-tone' in m else AutoModelForSequenceClassification).from_pretrained(m).eval(); id2=mod.config.id2label
        pi=[i for i,l in id2.items() if l.lower().startswith('pos') or 'bull' in l.lower()][0]; ni=[i for i,l in id2.items() if l.lower().startswith('neg') or 'bear' in l.lower()][0]
        def sc(t,maxlen=512):
            with torch.no_grad():
                p=torch.softmax(mod(**tok(t,return_tensors='pt',truncation=True,max_length=maxlen)).logits[0],-1)
            return float(p[pi]-p[ni]), ('B' if int(p.argmax())==pi else 'S' if int(p.argmax())==ni else 'N')
        R={}
        t0=time.time(); R['news_snippet_argmax']=''.join(sc(ntext(r))[1] for r in news); R['news_snippet_ms']=round((time.time()-t0)/len(news)*1000,1)
        full=[r for r in news if r['article_chars']>800]
        t0=time.time(); R['news_article_chunkmean']={str(r['i']):lab(sum(sc(c)[0] for c in chunks(r['article']))/len(chunks(r['article']))) for r in full}; R['news_article_ms']=round((time.time()-t0)/len(full)*1000,1)
        t0=time.time(); R['yt_first512']=''.join(sc(r['text'])[1] for r in yt); R['yt_first512_ms']=round((time.time()-t0)/len(yt)*1000,1)
        t0=time.time(); cm=[]
        for r in yt:
            cs=chunks(r['text']); cm.append(sum(sc(c)[0] for c in cs)/len(cs))
        R['yt_chunkmean']=''.join(lab(x) for x in cm); R['yt_chunkmean_scores']=[round(x,3) for x in cm]; R['yt_chunkmean_ms']=round((time.time()-t0)/len(yt)*1000,1)
        t0=time.time(); wm=[]
        for r in yt:
            ws=r['windows'] or ['']; wm.append(sum(sc(w)[0] for w in ws)/len(ws))
        R['yt_tickerwindows']=''.join(lab(x) for x in wm); R['yt_tickerwindows_scores']=[round(x,3) for x in wm]; R['yt_tickerwindows_ms']=round((time.time()-t0)/len(yt)*1000,1)
        if 'Modern' in m:
            t0=time.time(); R['yt_whole8192']=''.join(sc(r['text'],8192)[1] for r in yt); R['yt_whole8192_ms']=round((time.time()-t0)/len(yt)*1000,1)
            t0=time.time(); R['news_article_whole8192']={str(r['i']):sc(r['article'],8192)[1] for r in full}; R['news_article_whole_ms']=round((time.time()-t0)/len(full)*1000,1)
        res[m]=R; json.dump(res,open(OUT,'w')); print(m,{k:v for k,v in R.items() if k.endswith('_ms')},flush=True)
else:
    from mlx_lm import load, generate
    import mlx.core as mx
    def prompt(kind,ticker,text):
        name=gaz.get(ticker,'')
        return (f"You read a {kind} and judge its lean on ONE stock: {ticker}"+(f" ({name})" if name else "")+".\n"
        "Answer with exactly one word:\nBULLISH - plainly good for that name's price or the speaker is positive on it.\nBEARISH - plainly bad for it or the speaker is negative on it.\n"
        "NEUTRAL - routine, mixed, both sides, level maps, comparisons with no winner.\nUNRELATED - the text is not about that name at all.\n\n"
        f"Text:\n{text}\n\nLean on {ticker}, one word:")
    def run(model,tok,p):
        o=generate(model,tok,prompt=tok.apply_chat_template([{"role":"user","content":p}],add_generation_prompt=True,tokenize=False),max_tokens=6,verbose=False).strip().upper()
        return 'B' if 'BULL' in o else 'S' if 'BEAR' in o else 'U' if 'UNREL' in o else 'N' if 'NEUT' in o else '?'
    for m in sys.argv[3:]:
        model,tok=load(m); R={}
        t0=time.time(); R['news_snippet']=''.join(run(model,tok,prompt('news headline and summary',r['ticker'],ntext(r))) for r in news); R['news_snippet_ms']=round((time.time()-t0)/len(news)*1000,1)
        full=[r for r in news if r['article_chars']>800]
        t0=time.time(); R['news_article']={str(r['i']):run(model,tok,prompt('news article',r['ticker'],r['article'][:24000])) for r in full}; R['news_article_ms']=round((time.time()-t0)/len(full)*1000,1)
        t0=time.time(); R['yt_whole']=''.join(run(model,tok,prompt('YouTube video transcript (auto captions, names may be misspelled)',r['ticker'],r['title']+'\n'+r['text'][:60000])) for r in yt); R['yt_whole_ms']=round((time.time()-t0)/len(yt)*1000,1)
        R['yt_chars_total']=sum(min(60000,r['chars']) for r in yt); R['peak_mem_gb']=round(mx.get_peak_memory()/1e9,2)
        res[m]=R; json.dump(res,open(OUT,'w')); print(m,{k:v for k,v in R.items() if k.endswith('_ms') or k=='peak_mem_gb'},flush=True)
        del model,tok; mx.clear_cache(); mx.reset_peak_memory()

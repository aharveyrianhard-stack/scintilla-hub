import json,sys,time,re,os
from mlx_lm import load, generate
import mlx.core as mx
S,inp,out=sys.argv[1:4]; MODELS=sys.argv[4:]
rows=json.load(open(inp))
SYS=("You label the lean of a stock-market post on X. Answer with exactly one word: BULLISH, BEARISH or NEUTRAL.\n"
"BULLISH: the author says buy/long/breakout/strength, or reports plainly good price news (upgrade, beat, jump, new high).\n"
"BEARISH: sell/short/breakdown/weakness, or plainly bad news (downgrade, miss, insider selling, warning).\n"
"NEUTRAL: a chart or link with no words of direction, promotion, watch-lists, questions, conditional level maps, or one good and one bad thing about different names.")
def clean(t): return re.sub(r'https?://\S+','',t).strip()[:2400]
res=json.load(open(out)) if os.path.exists(out) else {}
for m in MODELS:
    try:
        t0=time.time(); model,tok=load(m); load_s=time.time()-t0
        preds=[]; t0=time.time(); ntok=0
        for r in rows:
            msgs=[{"role":"user","content":SYS+"\n\nPost:\n"+clean(r['text'])+"\n\nOne word:"}]
            p=tok.apply_chat_template(msgs,add_generation_prompt=True,tokenize=False)
            o=generate(model,tok,prompt=p,max_tokens=5,verbose=False).strip().upper()
            preds.append('B' if 'BULL' in o else 'S' if 'BEAR' in o else 'N' if 'NEUT' in o else '?')
        ms=(time.time()-t0)/len(rows)*1000
        res[m]={'load_s':round(load_s,1),'metal_ms_per_item':round(ms,1),'peak_mem_gb':round(mx.get_peak_memory()/1e9,2),'preds':''.join(preds)}
        print(m,'load',round(load_s,1),'s ms/item',round(ms,1),'peakGB',res[m]['peak_mem_gb'],'unparsed',preds.count('?'),flush=True)
        del model,tok; mx.clear_cache(); mx.reset_peak_memory()
    except Exception as e:
        res[m]={'error':repr(e)[:300]}; print('FAIL',m,repr(e)[:300],flush=True)
    json.dump(res,open(out,'w'))

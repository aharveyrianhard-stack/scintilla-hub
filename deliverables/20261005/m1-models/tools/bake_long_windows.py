# Extra arm: the instruct model reads only the passages that name the ticker (found by the name list), not the whole transcript.
import json,sys,time,os
from mlx_lm import load, generate
S=sys.argv[1]
gaz={r['ticker']:r['name'] for r in json.load(open(S+'/data/gaz_raw.json'))['rows']}
yt=json.load(open(S+'/data/yt20.json')); OUT=S+'/data/long_llm_windows.json'; res={}
for m in sys.argv[2:]:
    model,tok=load(m); t0=time.time(); p=''
    for r in yt:
        txt='\n'.join('- …'+w+'…' for w in r['windows'][:24])
        q=(f"These are the passages from a YouTube video transcript (auto captions, names may be misspelled) that mention {r['ticker']} ({gaz.get(r['ticker'],'')}). Video title: {r['title']}\n"
           "Judge the speaker's lean on that one stock. Answer with exactly one word:\nBULLISH - the speaker is plainly positive on it.\nBEARISH - plainly negative on it.\nNEUTRAL - level maps, both sides, recaps, news round-ups, mixed.\n\n"+txt+f"\n\nLean on {r['ticker']}, one word:")
        o=generate(model,tok,prompt=tok.apply_chat_template([{"role":"user","content":q}],add_generation_prompt=True,tokenize=False),max_tokens=6,verbose=False).strip().upper()
        p+='B' if 'BULL' in o else 'S' if 'BEAR' in o else 'N'
    res[m]={'yt_windows':p,'ms':round((time.time()-t0)/len(yt)*1000,1)}; print(m,res[m],flush=True); del model,tok
json.dump(res,open(OUT,'w'))

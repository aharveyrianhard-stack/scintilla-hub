import json,urllib.request,sys,time,re
S=sys.argv[1]
names=["GOOGL","AMZN","WDC","STX","MU","LRCX"]
def ask(prompt,max_tokens=900):
    body=json.dumps({"messages":[{"role":"system","content":"You are a careful equity analyst. Answer only from the transcript given. Quote exact sentences."},{"role":"user","content":prompt}],"temperature":0.1,"max_tokens":max_tokens}).encode()
    req=urllib.request.Request("http://127.0.0.1:8089/v1/chat/completions",data=body,headers={"Content-Type":"application/json"})
    r=json.load(urllib.request.urlopen(req,timeout=1800))
    return r["choices"][0]["message"]["content"],r.get("usage",{})
out={}
for n in names:
    txt=open(f"{S}/fmp/{n}-latest-transcript.txt").read()
    words=txt.split()
    body=" ".join(words[:9000])
    t0=time.time()
    p1=("Below is an earnings-call transcript for "+n+". List, as exact quotes, every sentence in which management gives forward guidance or an outlook: next-quarter revenue, EPS, gross margin, operating margin, capital expenditure (CapEx), full-year or next-year growth, and anything said about 2027 or the next fiscal year. Give at most 12 quotes, each on its own line starting with '- '. Then on a final line write 'TONE: ' followed by one of bullish / neutral / cautious and a 15-word reason.\n\nTRANSCRIPT:\n"+body)
    a,u=ask(p1)
    out[n]={"answer":a,"usage":u,"seconds":round(time.time()-t0,1),"words_fed":min(9000,len(words))}
    json.dump(out,open(f"{S}/qwen/qwen-out.json","w"),indent=1)
    print(n,"done",round(time.time()-t0,1),"s",u,flush=True)
print("QWEN_DONE")

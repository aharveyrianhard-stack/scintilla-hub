import json,sys,time,subprocess,os,urllib.request
sys.path.insert(0,'job'); import lf_llm as M, lf_ticker as T
gguf,tag,port=sys.argv[1],sys.argv[2],sys.argv[3]
NGL=sys.argv[4] if len(sys.argv)>4 else '0'; LIMIT=int(sys.argv[5]) if len(sys.argv)>5 else 0
S=json.load(open('data/testset.json'))
if LIMIT: S=S[::len(S)//LIMIT][:LIMIT]
gaz=T.Gazetteer(json.load(open('data/gaz.json')))
srv=subprocess.Popen(['llama/llama-b11430/llama-server','-m',gguf,'-ngl',NGL,'-t',os.environ.get('LF_T','4'),'-c','4096','--port',port,'--host','127.0.0.1','--no-webui','-np','1'],stdout=open(f'out/srv_{tag}.log','w'),stderr=subprocess.STDOUT)
url=f'http://127.0.0.1:{port}'
try:
    for _ in range(120):
        try:
            if urllib.request.urlopen(url+'/health',timeout=2).status==200: break
        except Exception: time.sleep(1)
    def cands(c):
        m=gaz.mentions(c['text']); ts=sorted(m,key=lambda t:-m[t])[:6]
        if c['filed'] and c['filed'] not in ts: ts.append(c['filed'])
        return [(t,gaz.names.get(t,'')) for t in ts]
    M.ask(url,S[0]['kind'],S[0]['doc_title'],S[0]['text'],cands(S[0]))
    t=time.time(); out={}
    for i,c in enumerate(S):
        out[c['id']]=M.ask(url,c['kind'],c['doc_title'],c['text'],cands(c))
        if i%50==49: print(tag,i+1,round(time.time()-t),flush=True)
    dt=time.time()-t
    rss=int(subprocess.check_output(['ps','-o','rss=','-p',str(srv.pid)]).strip())//1024
    json.dump({'model':tag,'gguf':os.path.basename(gguf),'s_per_1000':round(dt/len(S)*1000,1),'peak_rss_mb':rss,'ngl':NGL,'n':len(S),'out':out},open(f'out/llm_{tag}.json' if not LIMIT else f'out/cpu_sample_{tag}.jsonx','w'))
    print(tag,'done',round(dt),'s rss',rss,flush=True)
finally:
    srv.terminate(); srv.wait(timeout=20)

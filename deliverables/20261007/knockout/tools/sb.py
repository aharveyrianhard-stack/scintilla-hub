# Read-only reader for the Hub's public tables through its public read key (the key the Hub page itself uses).
# The key is read from a private file and is never printed. GET only.
import json,urllib.request,urllib.parse,time,os
SB="https://wadinxqplrggagkvrdag.supabase.co"; _K=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'.anon')).read().strip()
N_GET=0
def get(path,timeout=60):
    global N_GET
    for att in range(4):
        try:
            r=urllib.request.Request(SB+"/rest/v1/"+path,headers={"apikey":_K,"Authorization":"Bearer "+_K})
            N_GET+=1
            return json.load(urllib.request.urlopen(r,timeout=timeout))
        except urllib.error.HTTPError as e:
            body=e.read()[:300].decode('utf8','replace')
            if e.code in (400,401,403,404,406): raise RuntimeError(f"{path.split('?')[0]} -> {e.code} {body}")
            if att==3: raise RuntimeError(f"{path.split('?')[0]} -> {e.code} {body}")
            time.sleep(1.5*(att+1))
        except Exception as e:
            if att==3: raise
            time.sleep(1.5*(att+1))
def paged(path,page=1000,maxrows=400000):
    out=[];off=0
    while off<maxrows:
        j=get(path+("&" if "?" in path else "?")+f"limit={page}&offset={off}")
        out+=j
        if len(j)<page: break
        off+=page
    return out
def count(table,flt=""):
    global N_GET
    r=urllib.request.Request(SB+"/rest/v1/"+table+"?select=*"+("&"+flt if flt else ""),headers={"apikey":_K,"Authorization":"Bearer "+_K,"Prefer":"count=exact","Range":"0-0"},method="GET")
    N_GET+=1
    try:
        resp=urllib.request.urlopen(r,timeout=60); cr=resp.headers.get("Content-Range"); return cr
    except urllib.error.HTTPError as e:
        return f"ERR {e.code} {e.read()[:160].decode('utf8','replace')}"
inq=lambda L: "in.("+",".join(urllib.parse.quote(x) for x in L)+")"

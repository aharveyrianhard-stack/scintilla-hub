import json,sys,time,concurrent.futures as cf,urllib.request
import trafilatura
S=sys.argv[1]
rows=json.load(open(S+'/data/news100_raw.json'))['rows']
rows.sort(key=lambda r:(r['published_ts'],r['url']))
def get(r):
    t0=time.time(); txt=None; err=None
    try:
        req=urllib.request.Request(r['url'],headers={'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15','Accept':'text/html'})
        html=urllib.request.urlopen(req,timeout=15).read().decode('utf8','replace')
        txt=trafilatura.extract(html,include_comments=False,include_tables=False) or None
    except Exception as e: err=type(e).__name__
    return txt,err,round(time.time()-t0,2)
with cf.ThreadPoolExecutor(8) as ex: res=list(ex.map(get,rows))
out=[]
for i,(r,(txt,err,s)) in enumerate(zip(rows,res)):
    out.append({'i':i,**r,'article':(' '.join(txt.split()) if txt else None),'article_chars':len(txt) if txt else 0,'fetch_error':err,'fetch_s':s})
json.dump(out,open(S+'/data/news100.json','w'),ensure_ascii=False)
ok=[o for o in out if o['article_chars']>800]
import statistics
print('fetched full text for',len(ok),'of',len(out),'median chars',statistics.median([o['article_chars'] for o in ok]) if ok else 0)
for o in out[:50]: print(f"[{o['i']}] {o['ticker']} | {o['site']} | {o['title']} || {(o['snippet'] or '')[:300]}")

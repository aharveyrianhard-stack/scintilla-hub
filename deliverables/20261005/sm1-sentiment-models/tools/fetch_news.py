import json,time,concurrent.futures as cf,urllib.request,trafilatura,collections
rows=json.load(open('data/news_raw.json'))
seen=set(); rows=[r for r in rows if not (r['url'] in seen or seen.add(r['url']))]
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
def get(r):
    try:
        req=urllib.request.Request(r['url'],headers={'User-Agent':UA,'Accept':'text/html'})
        html=urllib.request.urlopen(req,timeout=15).read().decode('utf8','replace')
        txt=trafilatura.extract(html,include_comments=False,include_tables=False) or ''
        return txt,None
    except Exception as e: return '',type(e).__name__
with cf.ThreadPoolExecutor(12) as ex: res=list(ex.map(get,rows))
out=[]
for r,(t,e) in zip(rows,res): out.append({**r,'article':t,'article_chars':len(t),'fetch_error':e})
json.dump(out,open('data/news_full.json','w'),ensure_ascii=False)
ok=[o for o in out if o['article_chars']>1200]
print('rows',len(out),'full>1200',len(ok),'tickers',len({o['ticker'] for o in ok}))
print('ok by site',collections.Counter(o['site'] for o in ok).most_common(25))
print('errors',collections.Counter(o['fetch_error'] for o in out).most_common(8))

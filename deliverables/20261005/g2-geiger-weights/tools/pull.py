import json,urllib.request,sys
K=open("anon.txt").read().split()[0]; U="https://wadinxqplrggagkvrdag.supabase.co/rest/v1/"
def pull(t,q="select=*",order=None):
    out=[];off=0
    while True:
        url=U+t+"?"+q+(("&order="+order) if order else "")+f"&limit=1000&offset={off}"
        r=urllib.request.Request(url,headers={"apikey":K,"Authorization":"Bearer "+K})
        d=json.load(urllib.request.urlopen(r,timeout=60))
        out+=d; off+=1000
        if len(d)<1000: break
    return out
if __name__=="__main__":
    for t,o in [("bt_daily_signal","ticker,ts"),("weight_backtest_log","id"),("composite_history","snapshot_date,ticker,tf"),("composite_staged","ticker,tf"),("operator_weights","dim,key"),("cohorts",None)]:
        d=pull(t,order=o); json.dump(d,open(t+".json","w")); print(t,len(d))

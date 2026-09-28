import json,sys
target,name,pre=sys.argv[1],sys.argv[2],sys.argv[3] if len(sys.argv)>3 else "{}"
job={"name":name,"target":target,"path":"/","hubRoot":"/Users/alanharvey/SCINTILLA 0.5/_worktrees/hub-switch-on-20260928","width":1680,"height":1050,"apiLog":True,
 "localStorage":json.loads(pre),
 "steps":[{"do":"waitFor","sel":'.sc-board__row[data-t="MU"]',"ms":60000},{"do":"eval","js":"performance.now()"},
          {"do":"open","t":"MU","clouds":True,"rsi":True,"ms":70000},{"do":"eval","js":"(()=>{const f=document.getElementById('coChartFrame');return f&&f.getAttribute('src')})()"}]}
print(json.dumps(job))

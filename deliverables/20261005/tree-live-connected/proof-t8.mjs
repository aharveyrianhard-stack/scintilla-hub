/* T8 (2 Oct, night) · the headless walk for the tree with BIG Geigers, no aggregates, no black space, the podium as a
   staircase and MY LISTS — at 1920 × 1080 (device scale 1, the Apple TV), 1680 × 1000 (scale 2, the Retina Mac) and 390
   (phone, scale 1). Runs proof.mjs per run (headless Chrome, SwiftShader, never a window) and writes shots/t8-<tag>-*.png
   and shots/t8-<tag>-proof.json. The same walk runs against the live page for the BEFORE pictures and numbers.
   node proof-t8.mjs <base url> <tag: before|after>
   The Hub's list mirrors are planted under the Hub's own keys ("sc_lists" → {favorites, radar}; "sc_fav" → LIKED):
   30 served tickers as FAVORITES, 60 as LIKED, 30 as RADAR (the brief: "MY LISTS with RADAR planted (30 names)"). */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const base = process.argv[2] || "http://127.0.0.1:8766", tag = process.argv[3] || "after";
const url = (q) => `${base}/deliverables/20260929/tree-map/index.html?${q}`;
const T = JSON.parse(readFileSync("tree.json", "utf8"));
const served = T.nodes.filter((n) => n.kind === "name" && n.served && n.ticker).map((n) => n.ticker);
const FAVS = served.slice(0, 30), LIKED = served.slice(0, 60), RADAR = served.slice(100, 130);
const INIT = `try { localStorage.setItem("sc_lists", ${JSON.stringify(JSON.stringify({ favorites: FAVS, radar: RADAR }))}); localStorage.setItem("sc_fav", ${JSON.stringify(JSON.stringify(LIKED))}); } catch (e) {}`;
const run = (w, h, mobile, dpr, q, steps, init = INIT) => JSON.parse(execFileSync("node", ["proof.mjs", url(q), String(w), String(h), mobile ? "1" : "0", JSON.stringify(steps)], { env: { ...process.env, PROOF_DPR: String(dpr), PROOF_INIT: init }, maxBuffer: 64 << 20 }).toString());
// sizes on the screen: every box (bar) drawn, the label font sizes, and the overlaps — label on label, label on another thing's box
const SIZES = `(()=>{const B=__mm.boxes?__mm.boxes():[];const L=__mm.labelsNow?__mm.labelsNow():[];const q=(a,k)=>{const s=a.map(x=>x[k]).sort((p,r)=>p-r);return s.length?{min:+s[0].toFixed(1),med:+s[s.length>>1].toFixed(1),max:+s[s.length-1].toFixed(1)}:null};
const hit=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;let ll=0,lb=0;const lbs=[];for(let i=0;i<L.length;i++){for(let j=i+1;j<L.length;j++)if(hit(L[i],L[j]))ll++;for(const b of B)if(b.id!==L[i].id&&hit(L[i],b)){lb++;if(lbs.length<8)lbs.push([L[i].id,b.id])}}
let bb=0;for(let i=0;i<B.length;i++)for(let j=i+1;j<B.length;j++)if(hit(B[i],B[j]))bb++;
const fs=(sel)=>{const e=document.querySelector(sel);return e?parseFloat(getComputedStyle(e).fontSize):null};const fsAny=(cls)=>{const d=document.createElement("div");d.className=cls;document.getElementById("labels").appendChild(d);const v=parseFloat(getComputedStyle(d).fontSize),c=getComputedStyle(d).color;d.remove();return [v,c]};
const names=B.filter(b=>b.kind==="name"),funds=B.filter(b=>b.kind==="fund"),agg=B.filter(b=>b.kind==="index"||b.kind==="cohort"||b.kind==="list");
return {boxes:B.length,names:names.length,funds:funds.length,aggregate_boxes:agg.length,name_w:q(names,"w"),name_h:q(names,"h"),fund_w:q(funds,"w"),fund_h:q(funds,"h"),all_w:q(B,"w"),all_h:q(B,"h"),labels:L.length,label_on_label:ll,label_on_other_box:lb,label_on_other_box_sample:lbs,box_on_box:bb,font_name:fsAny("lb n onbox"),font_fund:fsAny("lb f onbox"),font_heading:fsAny("lb h"),font_name_shown:fs(".lb.n[style*='block']")||fs(".lb.n"),canvas:[Math.round(document.getElementById("graph").getBoundingClientRect().width),Math.round(document.getElementById("graph").getBoundingClientRect().height)],aside_w:Math.round(document.querySelector("aside").getBoundingClientRect().width),dpr:devicePixelRatio,detail:__mm.detail,area:__mm.cluster||null}})()`;
// the words on the page that must not be there (T8: the tree never says scout / aggregate / full)
const WORDS = `(()=>{const t=document.body.innerText;const bad=["scout","aggregate"].map(w=>[w,(t.match(new RegExp("\\\\b"+w+"\\\\b","gi"))||[]).length]);return {bad,clickAny:/Click any line/.test(t),howTo:/HOW TO READ A BAR/.test(t),card:(document.querySelector("#card h2")||{}).textContent||"",aside_display:getComputedStyle(document.querySelector("aside")).display,aside_w:Math.round(document.querySelector("aside").getBoundingClientRect().width),canvas_w:Math.round(document.getElementById("graph").getBoundingClientRect().width)}})()`;
// the podium: every place; neighbours' gap (standing: the columns' screen rectangles, consecutive places); the drop per step; the staircase order
const PODIUM = `(()=>{const P=__mm.coilPlaces();const R=P.filter(p=>p.v!=null);const B=__mm.boxes();const byId=new Map(B.map(b=>[b.id,b]));const hit=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;let ov=0;for(let i=0;i<B.length;i++)for(let j=i+1;j<B.length;j++)if(hit(B[i],B[j]))ov++;
const gaps=[];for(let i=1;i<P.length;i++){const a=byId.get(P[i-1].t),b=byId.get(P[i].t);if(a&&b){const gx=Math.max(0,Math.max(a.x,b.x)-Math.min(a.x+a.w,b.x+b.w));gaps.push(+gx.toFixed(1))}}
const drops=[];for(let i=1;i<R.length;i++)drops.push(+(((R[i-1].tread!=null?R[i-1].tread:R[i-1].tip)??R[i-1].y)-((R[i].tread!=null?R[i].tread:R[i].tip)??R[i].y)).toFixed(1));
const L=__mm.labelsNow?__mm.labelsNow():[];let ll=0;for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++)if(hit(L[i],L[j]))ll++;
const stand=R.length&&(R[0].ramp!=null||R[0].tread!=null);const key=R[0]&&R[0].tread!=null?"tread":"tip";
const G=__mm.stepGaps?__mm.stepGaps():null;const gw=G?{min:Math.min(...G),max:Math.max(...G),n:G.length,touching:G.filter(g=>g<=0.5).length}:null;
return {mode:__mm.podiumMode(),n:P.length,read:R.length,first:R[0],last:R[R.length-1],bars:B.length,overlaps:ov,gap_world:gw,neighbour_gap_px:gaps.length?{min:Math.min(...gaps),max:Math.max(...gaps),zero:gaps.filter(g=>g<=0.5).length,n:gaps.length}:null,step_drop:drops.length?{min:Math.min(...drops),max:Math.max(...drops),n:drops.length,key}:null,vMono:R.every((p,i)=>!i||p.v<=R[i-1].v),rMono:R.every((p,i)=>!i||p.r>=R[i-1].r),treadMono:R.every((p,i)=>!i||((p.tread??p.tip??p.y)<=(R[i-1].tread??R[i-1].tip??R[i-1].y))),labels:__mm.labelsShown,label_on_label:ll,params:__mm.podiumParams?__mm.podiumParams():null,count:__mm.clusterCount,bar:document.getElementById("areabar").innerText.replace(/\\s+/g," "),card:(document.querySelector("#card h2")||{}).textContent||"",cardHasTreeBtn:!!document.querySelector("#card [data-tree]"),focused:__mm.canvasFocused()}})()`;
const LISTS = `({lists:__mm.lists(),rows:[...document.querySelectorAll("#outline .row.list")].map(r=>r.innerText.replace(/\\s+/g," ").trim()),chips:[...document.querySelectorAll("#listbar button")].map(b=>[b.textContent,getComputedStyle(b).display!=="none"]),listbarText:(document.getElementById("listbar")||{}).innerText||"",mylists:!!document.querySelector("#mylists, #listbar .mylists"),cardTitle:(document.querySelector("#card h2")||{}).textContent||""})`;
const desktop = (t) => [
  { state: true }, { labels: true }, { probe: SIZES }, { probe: WORDS }, { probe: LISTS }, { shot: `shots/t8-${tag}-${t}-clean.png` },
  { shot: `shots/t8-${tag}-${t}-clean-zoom.png`, clip: [0, 120, 700, 420, 2] },
  // Technology opened (OPEN 3D)
  { eval: "__mm.openArea('SEC_TECH')" }, { wait: 2200 }, { state: true }, { labels: true }, { probe: SIZES }, { shot: `shots/t8-${tag}-${t}-area-tech.png` }, { key: "Escape" }, { wait: 800 },
  { eval: "__mm.openArea('SEC_FIN')" }, { wait: 2200 }, { probe: SIZES }, { shot: `shots/t8-${tag}-${t}-area-fin.png` }, { key: "Escape" }, { wait: 800 },
  // the Technology podium, standing and from above, a close crop of the staircase
  { eval: "__mm.openCoil('SEC_TECH')" }, { wait: 2400 }, { state: true }, { probe: PODIUM }, { labels: true }, { shot: `shots/t8-${tag}-${t}-podium-tech.png` },
  { shot: `shots/t8-${tag}-${t}-podium-tech-crop.png`, clip: [t === "1920" ? 560 : 440, 140, 560, 360, 2] },
  { eval: "__mm.setPodium('above')" }, { wait: 2000 }, { probe: PODIUM }, { shot: `shots/t8-${tag}-${t}-podium-tech-above.png` },
  { eval: "__mm.setPodium('3d')" }, { wait: 2000 },
  // a click on a step
  { click: "NVDA" }, { state: true }, { probe: PODIUM }, { probe: WORDS }, { shot: `shots/t8-${tag}-${t}-podium-click-nvda.png` },
  { clickSel: "#card [data-tree]" }, { state: true }, { shot: `shots/t8-${tag}-${t}-after-show-on-tree.png` },
  // MY LISTS: RADAR planted with 30 names
  { eval: "__mm.setDetail('clean')" }, { wait: 1200 }, { probe: LISTS },
  { eval: "__mm.openList && __mm.openList('LIST_RADAR')" }, { wait: 2400 }, { state: true }, { probe: PODIUM }, { probe: LISTS }, { shot: `shots/t8-${tag}-${t}-mylists-radar.png` }, { key: "Escape" }, { wait: 600 },
  { eval: "__mm.openList('LIST_FAVORITES')" }, { wait: 2400 }, { probe: PODIUM }, { shot: `shots/t8-${tag}-${t}-mylists-favorites.png` }, { key: "Escape" }, { wait: 600 },
  { view: "outline" }, { probe: WORDS }, { probe: LISTS }, { shot: `shots/t8-${tag}-${t}-outline.png` },
];
const phone = [
  { state: true }, { probe: WORDS }, { probe: LISTS }, { shot: `shots/t8-${tag}-390-outline.png` }, { view: "canvas" }, { state: true }, { probe: SIZES }, { shot: `shots/t8-${tag}-390-clean.png` },
  { eval: "__mm.openCoil('SEC_TECH')" }, { wait: 2400 }, { probe: PODIUM }, { shot: `shots/t8-${tag}-390-podium-tech.png` }, { key: "Escape" }, { wait: 600 },
];
const out = [];
out.push(run(1920, 1080, false, 1, "detail=clean&order=geiger", desktop("1920")));
out.push(run(1680, 1000, false, 2, "detail=clean&order=geiger", desktop("1680")));
out.push(run(390, 844, true, 1, "detail=clean&order=geiger", phone));
writeFileSync(`shots/t8-${tag}-proof.json`, JSON.stringify(out, null, 1));
for (const r of out) console.log(r.width, "@", r.dpr, "errors", r.page_errors.length, "steps", r.log.length);
for (const r of out) for (const x of r.log) if (x.probe && x.value) {
  const v = x.value;
  if ("boxes" in v) console.log(r.width, "SIZES", v.area || "whole", "boxes", v.boxes, "agg", v.aggregate_boxes, "name_h", JSON.stringify(v.name_h), "fund_h", JSON.stringify(v.fund_h), "font name/fund", v.font_name && v.font_name[0], v.font_fund && v.font_fund[0], "lab/lab", v.label_on_label, "lab/box", v.label_on_other_box, "box/box", v.box_on_box);
  if ("neighbour_gap_px" in v) console.log(r.width, "PODIUM", v.mode, v.count && v.count.list ? "list" : "tech", "n", v.n, "overlaps", v.overlaps, "gap(world)", JSON.stringify(v.gap_world), "gap(px)", JSON.stringify(v.neighbour_gap_px), "drop", JSON.stringify(v.step_drop), "labels", v.labels, "card", v.card);
  if ("bad" in v) console.log(r.width, "WORDS", JSON.stringify(v.bad), "clickAny", v.clickAny, "howTo", v.howTo, "aside", v.aside_w, "canvas", v.canvas_w);
}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../prototypes/indicator-lab/'+p,import.meta.url),'utf8');
const page=read('index.html'), checkpoint=read('checkpoint-20260924.html');
test('category anchors are unique, visible, and TradingView comes before experiments',()=>{
 for(const id of ['clouds','oscillators','patterns','levels','templates','workshops','research']){
  assert.equal(page.split(`id="${id}"`).length-1,1);
  assert.match(page,new RegExp(`href="#${id}"`));
 }
 assert.ok(page.indexOf('id="oscillators"')<page.indexOf('id="workshops"'));
 assert.match(page,/href="\/prototypes\/"/);
 assert.doesNotMatch(page,/<script|<iframe|localStorage|setInterval/);
});
test('saved review charts are direct and publication links are secondary',()=>{
 for(const id of ['K3Rgctld','eoKLEQLd','Co9sV1xl','tWoF5LXZ','RkwmLtwJ','99awrQQB','XMhDLRjG','LmUGaNim'])
  assert.equal(page.split(`https://www.tradingview.com/chart/${id}/`).length-1,1,id);
 assert.match(page,/Read original Trendoscope source publication/);
 assert.match(page,/current content has not been reverified/);
});
test('the formula relationship and disabled Williams default are explicit',()=>{
 for(const text of ['Williams off','Stochastic %K','eight-hour candles','not a fourth oscillator','not a blended score','14-bar range → SMA3','Recursive memory'])assert.ok(page.includes(text),text);
 assert.match(page,/raw Stochastic is 80 and Williams is −20/);
});
test('readiness does not turn a source candidate or snapshot into installed live work',()=>{
 for(const text of ['V3 visual and V4 screening candidates are locally compiled, not installed','not a continuously refreshed feed','not a performance backtest','No new Station integration','not identified yet','not a claim that the new TradingView arrangements are built'])assert.ok(page.includes(text),text);
 assert.match(page,/Clouds are closed/);
});
test('prior methods, licenses and history budget remain available in the checkpoint',()=>{
 for(const text of ['CC BY-NC-SA 4.0','not a clone of the protected pivot search','TradeSymbiotic APCh HTF','sunnywilson93 Auto Channel Detector v7','474 / 500','10 / 40','20 / 80','PpPsTrnJ','Lytlc97U','YMQcZAVD','BIWG0mAw'])assert.ok(checkpoint.includes(text),text);
 assert.match(page,/href="checkpoint-20260924.html"/);
 assert.match(checkpoint,/href="\.\/"/);
});

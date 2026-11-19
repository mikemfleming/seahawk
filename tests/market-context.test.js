import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {marketHTML} from '../scripts/render-weekly-context.js';
test('market data handles weekends, shutdowns, absent quotes and benchmark validation',()=>{
 execFileSync('python3',['-m','unittest','discover','-s','tests','-p','test_market_context.py'],{stdio:'pipe'});
});
test('every prepared stock snapshot uses actual closes at or before the journal and comparison dates',()=>{
 const weekly=JSON.parse(readFileSync('content/weekly-context.json'));
 for(const [day,snapshot]of Object.entries(weekly.snapshots)){
  const market=snapshot.market;assert(market);assert.equal(market.symbol,'^GSPC');assert.equal(market.as_of,day);assert(market.close_date<=day);assert(market.comparison_date<=market.comparison_target);
  assert.equal(Date.parse(day)-Date.parse(market.comparison_target),7*86400000);
  assert(Math.abs((market.close/market.comparison_close-1)*100-market.change_percent)<0.01);
 }
 const market=weekly.snapshots['1995-03-06'].market;assert.equal(market.close,485.63);assert.match(marketHTML('1995-03-06',market),/485.63/);
 assert.equal(marketHTML('1995-03-06',{...market,close_date:'1995-03-07'}),'');assert.equal(marketHTML('1995-03-06',{...market,change_percent:999}),'');
 const html=readFileSync('dist/index.html','utf8');assert.match(html,/S&amp;P 500/);assert.match(html,/excluding dividends/);
});

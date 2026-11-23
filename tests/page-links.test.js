import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync('web/gallery.js','utf8').split('function navigateTo(id)')[0];
function setup({local=true,hash='#page-042'}={}){
 const listeners={},frames=[],scrolls=[],jump={value:''},page={id:'page-042'};
 const target={id:'page-042',closest:()=>page,scrollIntoView:options=>scrolls.push(options)};
 const document={readyState:'loading',documentElement:{dataset:{}},getElementById:id=>id==='page-jump'?jump:id==='page-042'?target:null,querySelector:()=>local?{}:null,addEventListener:(name,fn)=>listeners[name]=fn};
 const window={addEventListener:(name,fn)=>listeners[name]=fn};
 runInNewContext(source,{document,window,location:{hash},requestAnimationFrame:fn=>frames.push(fn)});
 return {jump,scrolls,emit:name=>listeners[name]?.(),flush:()=>{while(frames.length)frames.shift()();}};
}
test('direct page links wait for both page load and local editor layout',()=>{
 const state=setup();assert.equal(state.jump.value,'page-042');state.emit('load');state.flush();assert.equal(state.scrolls.length,0);
 state.emit('journal-editor-ready');state.flush();assert.equal(state.scrolls.length,1);
 state.emit('journal-editor-ready');state.flush();assert.equal(state.scrolls.length,1);
});
test('public links and hash changes align targets, but late initialization never overrides user scrolling',()=>{
 const publicPage=setup({local:false,hash:'#page%2D042'});publicPage.emit('load');publicPage.flush();assert.equal(publicPage.scrolls.length,1);
 publicPage.emit('hashchange');assert.equal(publicPage.scrolls.length,2);
 const local=setup();local.emit('wheel');local.emit('load');local.emit('journal-editor-ready');local.flush();assert.equal(local.scrolls.length,0);
 const malformed=setup({local:false,hash:'#%invalid'});malformed.emit('load');malformed.flush();assert.equal(malformed.scrolls.length,0);
});

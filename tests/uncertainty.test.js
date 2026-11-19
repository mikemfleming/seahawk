import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {uncertaintySegments,renderUncertainty} from '../local/uncertainty.js';
test('edit highlighting preserves text and matches the PDF rules for questions and missing readings',()=>{
 const text='Name [Hudspeth?], [illegible], [incomplete], [hour? rest of passage!] and [diagram].\n[unclear]\n[missing word]\n<script>bad</script>';
 const segments=uncertaintySegments(text);assert.equal(segments.map(item=>item.text).join(''),text);
 assert.deepEqual(segments.filter(item=>item.uncertain).map(item=>item.text),['[Hudspeth?]','[illegible]','[incomplete]','[hour? rest of passage!]','[unclear]','[missing word]']);
 assert.equal(uncertaintySegments('Resolved name.').filter(item=>item.uncertain).length,0);
 assert.equal(uncertaintySegments('[still typing').filter(item=>item.uncertain).length,0);
});
test('highlight rendering creates text nodes rather than interpreting HTML in corrections',()=>{
 const node={ownerDocument:{createTextNode:text=>({textContent:text}),createElement:tag=>({tag})},replaceChildren(...children){this.children=children;}};
 const text='[<img src=x onerror=bad>?] and <script>unsafe</script>';
 renderUncertainty(node,text);assert.equal(node.children.map(child=>child.textContent).join(''),text);assert.equal(node.children[0].tag,'mark');assert.equal(node.children[0].className,'uncertain');
});
test('the public stylesheet keeps its original highlighting while yellow editor styling stays local',()=>{
 const css=readFileSync('local/editor.css','utf8');assert.match(css,/#fff176/);assert.match(css,/pointer-events:none/);assert(!readFileSync('dist/index.html','utf8').includes('/__local/uncertainty.js'));
});

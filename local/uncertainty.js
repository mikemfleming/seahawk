// Matches the PDF review copy: bracketed questions and explicit missing readings.
export function uncertaintySegments(text){
 const segments=[];let offset=0;
 for(const match of text.matchAll(/\[[^\]]*\]/g)){
  if(match.index>offset)segments.push({text:text.slice(offset,match.index),uncertain:false});
  segments.push({text:match[0],uncertain:match[0].includes('?')||/\b(?:illegible|unreadable|unclear|incomplete|missing)\b/i.test(match[0])});
  offset=match.index+match[0].length;
 }
 if(offset<text.length)segments.push({text:text.slice(offset),uncertain:false});
 return segments;
}
export function renderUncertainty(node,text){
 const document=node.ownerDocument;
 node.replaceChildren(...uncertaintySegments(text).map(segment=>{
  if(!segment.uncertain)return document.createTextNode(segment.text);
  const mark=document.createElement('mark');mark.className='uncertain';mark.textContent=segment.text;return mark;
 }));
}

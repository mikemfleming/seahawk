import {formatEntryUpdated} from '/entry-updated.js';
import {renderUncertainty} from './uncertainty.js';
document.body.classList.add('local-editing');
for(const paragraph of document.querySelectorAll('.entry-text .passage'))renderUncertainty(paragraph,paragraph.textContent);
const state=await fetch('/__local/entries').then(response=>response.json());
const badge=document.createElement('span');badge.className='local-mode';badge.textContent='Local editing';document.querySelector('.page-tools').append(badge);
const dialog=document.createElement('dialog');dialog.className='entry-editor';
dialog.innerHTML='<form><h2>Edit journal entry</h2><p class="edit-context"></p><p>Saved to this project. Publish separately to update the public site.</p><label>Transcription<div class="transcription-input"><div class="transcription-highlights" aria-hidden="true"><div></div></div><textarea name="text" required spellcheck="false"></textarea></div></label><p class="highlight-help">Yellow marks uncertain or incomplete readings.</p><label>Clarification or family note (optional)<textarea name="note" rows="3"></textarea></label><p role="status"></p><div><button type="button" class="cancel">Cancel</button><button type="submit">Save correction</button></div></form>';
document.body.append(dialog);const form=dialog.querySelector('form');let active;
const textarea=form.elements.text;
const highlightLayer=dialog.querySelector('.transcription-highlights');
const highlightContent=highlightLayer.firstElementChild;
function syncHighlights(){
 renderUncertainty(highlightContent,textarea.value+'\n');
 highlightLayer.style.width=textarea.clientWidth+'px';
 highlightContent.style.transform=`translate(${-textarea.scrollLeft}px,${-textarea.scrollTop}px)`;
}
textarea.addEventListener('input',syncHighlights);
textarea.addEventListener('scroll',syncHighlights,{passive:true});
window.addEventListener('resize',()=>{if(dialog.open)syncHighlights();});
dialog.querySelector('.cancel').onclick=()=>dialog.close();
for(const article of document.querySelectorAll('.entry-passage')){
 const button=document.createElement('button');button.type='button';button.className='edit-entry';const group=article.closest('.log-entry');const multiple=group.querySelectorAll('.entry-passage').length>1;button.textContent=multiple?'Edit passage':'Edit entry';
 button.onclick=()=>{active=article;form.querySelector('h2').textContent=multiple?'Edit passage':'Edit journal entry';form.querySelector('.edit-context').textContent=`Page ${article.dataset.sourcePage} · Part of ${group.dataset.entryTitle}${multiple?' · Source pages '+group.dataset.sourcePages.replaceAll(',',', '):''}`;const id=article.dataset.passageId;form.elements.text.value=state[id]?.text??article.querySelector('.entry-text').innerText;form.elements.note.value=state[id]?.note??'';form.querySelector('[role="status"]').textContent='';dialog.showModal();textarea.scrollTop=0;textarea.scrollLeft=0;syncHighlights();};article.append(button);
}
form.onsubmit=async event=>{
 event.preventDefault();const id=active.dataset.passageId;const submit=form.querySelector('[type="submit"]');submit.disabled=true;
 try{
  const response=await fetch('/__local/entries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,text:form.elements.text.value,note:form.elements.note.value,revision:state[id]?.updated_at||null})});const result=await response.json();if(!response.ok)throw Error(result.error);
  state[id]=result;active.querySelector('.entry-text').replaceChildren();
  for(const paragraph of result.text.split(/\n\s*\n/)){const p=document.createElement('p');p.className='passage';renderUncertainty(p,paragraph);active.querySelector('.entry-text').append(p);}
  active.querySelector('.entry-clarification')?.remove();if(result.note.trim()){const note=document.createElement('p');note.className='entry-clarification';note.textContent='Family note: '+result.note;active.querySelector('.entry-text').after(note);}
  const parentEntry=active.closest('.log-entry');
  let updated=parentEntry.querySelector('.entry-updated');
  if(!updated){updated=document.createElement('p');updated.className='entry-updated';parentEntry.append(updated);}
  const time=document.createElement('time');time.dateTime=result.updated_at;time.textContent=formatEntryUpdated(result.updated_at);
  updated.replaceChildren(document.createTextNode('Last updated '),time);
  dialog.close();
 }catch(error){form.querySelector('[role="status"]').textContent=error.message;}finally{submit.disabled=false;}
};

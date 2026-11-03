const state=await fetch('/__local/entries').then(response=>response.json());
const badge=document.createElement('span');badge.className='local-mode';badge.textContent='Local editing';document.querySelector('.page-tools').append(badge);
const dialog=document.createElement('dialog');dialog.className='entry-editor';
dialog.innerHTML='<form><h2>Edit journal entry</h2><p>Saved to this project. Publish separately to update the public site.</p><label>Transcription<textarea name="text" required></textarea></label><label>Clarification or family note (optional)<textarea name="note" rows="3"></textarea></label><p role="status"></p><div><button type="button" class="cancel">Cancel</button><button type="submit">Save correction</button></div></form>';
document.body.append(dialog);const form=dialog.querySelector('form');let active;
dialog.querySelector('.cancel').onclick=()=>dialog.close();
for(const article of document.querySelectorAll('.log-entry')){
 const button=document.createElement('button');button.type='button';button.className='edit-entry';button.textContent='Edit entry';
 button.onclick=()=>{active=article;const id=article.id.slice('context-'.length);form.elements.text.value=state[id]?.text??article.querySelector('.entry-text').innerText;form.elements.note.value=state[id]?.note??'';form.querySelector('[role="status"]').textContent='';dialog.showModal();};article.append(button);
}
form.onsubmit=async event=>{
 event.preventDefault();const id=active.id.slice('context-'.length);const submit=form.querySelector('[type="submit"]');submit.disabled=true;
 try{
  const response=await fetch('/__local/entries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,text:form.elements.text.value,note:form.elements.note.value,revision:state[id]?.updated_at||null})});const result=await response.json();if(!response.ok)throw Error(result.error);
  state[id]=result;active.querySelector('.entry-text').replaceChildren();
  for(const paragraph of result.text.split(/\n\s*\n/)){const p=document.createElement('p');p.className='passage';p.textContent=paragraph;active.querySelector('.entry-text').append(p);}
  active.querySelector('.entry-clarification')?.remove();if(result.note.trim()){const note=document.createElement('p');note.className='entry-clarification';note.textContent='Family note: '+result.note;active.querySelector('.entry-text').after(note);}
  dialog.close();
 }catch(error){form.querySelector('[role="status"]').textContent=error.message;}finally{submit.disabled=false;}
};

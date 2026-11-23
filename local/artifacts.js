const store=await fetch('/__local/artifacts').then(r=>r.json());
const modal=document.createElement('dialog');modal.className='entry-editor artifact-editor';
modal.innerHTML=`<form><h2>Add artifact</h2><p class="artifact-page-label"></p><p>Drag across the photograph to select an illustration or detail. Leave it unselected to use the whole page.</p><div class="crop-stage"><img alt="Original journal page" draggable="false"><div class="crop-selection" hidden></div></div><button type="button" class="reset-crop">Use whole page</button><label>Type<select name="type"><option value="illustration">Illustration</option><option value="map">Map or diagram</option><option value="clipping">Clipping</option><option value="photograph">Photograph</option><option value="specimen">Preserved object</option><option value="other">Artifact</option></select></label><label>Title<input name="title" required maxlength="240"></label><label>Caption (optional)<textarea name="caption" rows="3" maxlength="10000"></textarea></label><p>Saved locally. Publish separately to update the public site.</p><p role="status"></p><div><button type="button" class="cancel">Cancel</button><button type="submit">Save artifact</button></div></form>`;
document.body.append(modal);
const form=modal.querySelector('form'),stage=modal.querySelector('.crop-stage'),image=stage.querySelector('img'),selection=stage.querySelector('.crop-selection');
let page,existing,crop=null,start=null,returnFocus;
function draw(){selection.hidden=!crop;if(crop)Object.assign(selection.style,{left:crop.x*100+'%',top:crop.y*100+'%',width:crop.width*100+'%',height:crop.height*100+'%'});}
function point(event){const r=stage.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(event.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(event.clientY-r.top)/r.height))};}
stage.onpointerdown=event=>{if(event.button!==0)return;event.preventDefault();start=point(event);stage.setPointerCapture(event.pointerId);};
stage.onpointermove=event=>{if(!start)return;const end=point(event);crop={x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),width:Math.abs(end.x-start.x),height:Math.abs(end.y-start.y)};draw();};
function finish(){start=null;if(crop&&(crop.width<.005||crop.height<.005)){crop=null;draw();}}
stage.onpointerup=finish;stage.onpointercancel=finish;
modal.querySelector('.reset-crop').onclick=()=>{crop=null;draw();};
modal.querySelector('.cancel').onclick=()=>modal.close();
modal.addEventListener('close',()=>returnFocus?.focus({preventScroll:true}));
function edit(button,record){
 returnFocus=button;page=button.closest('.log-page');existing=record;crop=record?.crop?{...record.crop}:null;
 form.reset();form.elements.type.value=record?.type||'illustration';form.elements.title.value=record?.title||'';form.elements.caption.value=record?.caption||'';
 form.querySelector('h2').textContent=record?'Edit artifact':'Add artifact';modal.querySelector('.artifact-page-label').textContent='Page '+Number(page.id.slice(5));form.querySelector('[role="status"]').textContent='';
 image.src=page.querySelector('.photograph img').src;draw();modal.showModal();
}
function addEdit(figure){if(figure.querySelector('.edit-artifact'))return;const button=document.createElement('button');button.type='button';button.className='edit-artifact';button.textContent='Edit artifact';button.onclick=()=>edit(button,store.items.find(item=>item.id===figure.dataset.artifactId));figure.querySelector('figcaption').append(button);}
for(const section of document.querySelectorAll('.log-page')){
 let container=section.querySelector('.page-artifacts');if(!container){container=document.createElement('div');container.className='page-artifacts';section.append(container);}
 for(const figure of container.querySelectorAll('.page-artifact'))addEdit(figure);
 const button=document.createElement('button');button.type='button';button.className='add-artifact';button.textContent='Add artifact to page '+Number(section.id.slice(5));button.onclick=()=>edit(button,null);container.append(button);
}
form.onsubmit=async event=>{
 event.preventDefault();const button=form.querySelector('[type="submit"]');button.disabled=true;
 try{
  const response=await fetch('/__local/artifacts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:existing?.id,page:Number(page.id.slice(5)),type:form.elements.type.value,title:form.elements.title.value,caption:form.elements.caption.value,crop,revision:existing?.updated_at||null})});const result=await response.json();if(!response.ok)throw Error(result.error);
  const index=store.items.findIndex(item=>item.id===result.artifact.id);if(index<0)store.items.push(result.artifact);else store.items[index]=result.artifact;
  const figure=new DOMParser().parseFromString(result.html,'text/html').body.firstElementChild,container=page.querySelector('.page-artifacts');
  const old=container.querySelector(`[data-artifact-id="${result.artifact.id}"]`);if(old)old.replaceWith(figure);else container.querySelector('.add-artifact').before(figure);addEdit(figure);
  returnFocus=figure.querySelector('.edit-artifact');modal.close();
 }catch(error){form.querySelector('[role="status"]').textContent=error.message;}finally{button.disabled=false;}
};

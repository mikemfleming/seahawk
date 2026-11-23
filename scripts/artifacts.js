import {formatEntryUpdated} from '../web/entry-updated.js';
const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const artifactTypes={illustration:'Illustration',map:'Map or diagram',clipping:'Clipping',photograph:'Photograph',specimen:'Preserved object',other:'Artifact'};
export function validateArtifact(input,pages){
 if(!input||typeof input!=='object')return 'Invalid artifact data.';
 if(!Number.isInteger(input.page)||!pages.has(input.page))return 'Choose an existing photographed page.';
 if(!Object.hasOwn(artifactTypes,input.type))return 'Choose an artifact type.';
 if(typeof input.title!=='string'||!input.title.trim()||input.title.length>240)return 'Add a title of up to 240 characters.';
 if(typeof input.caption!=='string'||input.caption.length>10000)return 'Caption must be text of up to 10,000 characters.';
 if(input.crop!==null){
  const c=input.crop;
  if(!c||!['x','y','width','height'].every(key=>typeof c[key]==='number'&&Number.isFinite(c[key]))||c.x<0||c.y<0||c.width<0.005||c.height<0.005||c.x+c.width>1.000001||c.y+c.height>1.000001)return 'Choose an area within the page photograph.';
 }
 return null;
}
export function renderArtifact(item,page){
 const dimensions=page.section.match(/<img[^>]*width="(\d+)" height="(\d+)"/);
 if(!dimensions)throw Error('Artifact photo dimensions missing');
 const width=Number(dimensions[1]),height=Number(dimensions[2]),c=item.crop||{x:0,y:0,width:1,height:1};
 const box=[c.x*width,c.y*height,c.width*width,c.height*height].map(n=>Number(n.toFixed(3))).join(' ');
 const stem=String(item.page).padStart(3,'0');
 return `<figure class="page-artifact" id="artifact-${escape(item.id)}" data-artifact-id="${escape(item.id)}" data-source-page="${item.page}"><div class="artifact-image"><svg viewBox="${box}" width="${c.width*width}" height="${c.height*height}" role="img" aria-label="${escape(item.title)}" preserveAspectRatio="xMidYMid meet"><image href="photos/${stem}-large.jpg" width="${width}" height="${height}"/></svg></div><figcaption><span class="artifact-type">${escape(artifactTypes[item.type])} · Page ${item.page}</span><h3>${escape(item.title)}</h3>${item.caption?`<p class="artifact-caption">${escape(item.caption)}</p>`:''}<button type="button" class="source-photo" data-source-page="${item.page}" aria-label="View original page ${item.page}">View original page ↗</button><p class="entry-updated">Last updated <time datetime="${escape(item.updated_at)}">${escape(formatEntryUpdated(item.updated_at))}</time></p></figcaption></figure>`;
}
export function renderPageArtifacts(html,store,pages){
 const ids=new Set();
 for(const item of store?.items||[]){
  if(validateArtifact(item,pages)||!/^A-[a-zA-Z0-9-]+$/.test(item.id)||ids.has(item.id))throw Error('Invalid saved artifact: '+item.id);
  ids.add(item.id);
 }
 return html.replace(/<section class="log-page" id="page-(\d+)"[\s\S]*?<\/section>/g,(section,n)=>{
  const items=(store?.items||[]).filter(item=>item.page===Number(n));if(!items.length)return section;
  return section.replace(/\s*<\/section>$/,`<div class="page-artifacts" aria-label="Artifacts from page ${Number(n)}">${items.map(item=>renderArtifact(item,pages.get(Number(n)))).join('\n')}</div>\n</section>`);
 });
}

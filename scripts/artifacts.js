import {formatEntryUpdated} from '../web/entry-updated.js';
const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const artifactTypes={illustration:'Illustration',map:'Map or diagram',clipping:'Clipping',photograph:'Photograph',specimen:'Preserved object',other:'Artifact'};
export function validateArtifact(input,pages){
 if(!input||typeof input!=='object')return 'Invalid artifact data.';
 if(!Number.isInteger(input.page)||(!pages.has(input.page)&&!(Array.isArray(input.sourceDimensions)&&input.sourceDimensions.length===2&&input.sourceDimensions.every(n=>Number.isInteger(n)&&n>0))))return 'Choose an existing photographed page.';
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
 const dimensions=item.sourceDimensions||page?.section.match(/<img[^>]*width="(\d+)" height="(\d+)"/)?.slice(1);
 if(!dimensions)throw Error('Artifact photo dimensions missing');
 const width=Number(dimensions[0]),height=Number(dimensions[1]),c=item.crop||{x:0,y:0,width:1,height:1};
 const box=[c.x*width,c.y*height,c.width*width,c.height*height].map(n=>Number(n.toFixed(3))).join(' ');
 const stem=String(item.page).padStart(3,'0');
 const sourceLink=item.sourceDimensions
  ? `<a class="source-photo" href="photos/${stem}-full.jpg" target="_blank" rel="noopener">View original ${item.type==='clipping'?'clipping':'artifact'} ↗</a>`
  : `<button type="button" class="source-photo" data-source-page="${item.page}" aria-label="View original page ${item.page}">View original page ↗</button>`;
 return `<figure class="page-artifact" id="artifact-${escape(item.id)}" data-artifact-id="${escape(item.id)}" data-source-page="${item.page}"><div class="artifact-image"><svg viewBox="${box}" width="${c.width*width}" height="${c.height*height}" role="img" aria-label="${escape(item.title)}" preserveAspectRatio="xMidYMid meet"><image href="photos/${stem}-large.jpg" width="${width}" height="${height}"/></svg></div><figcaption><span class="artifact-type">${escape(artifactTypes[item.type])}${item.sourceDimensions?'':' · Page '+item.page}</span><h3>${escape(item.title)}</h3>${item.caption?`<p class="artifact-caption">${escape(item.caption)}</p>`:''}${sourceLink}<p class="entry-updated">Last updated <time datetime="${escape(item.updated_at)}">${escape(formatEntryUpdated(item.updated_at))}</time></p></figcaption></figure>`;
}
export function renderPageArtifacts(html,store,pages){
 const ids=new Set();
 for(const item of store?.items||[]){
  if(validateArtifact(item,pages)||!/^A-[a-zA-Z0-9-]+$/.test(item.id)||ids.has(item.id))throw Error('Invalid saved artifact: '+item.id);
  ids.add(item.id);
 }
 for(const item of (store?.items||[]).filter(item=>item.entryId)){
  const opening=` id="context-${escape(item.entryId)}">`;
  const start=html.indexOf(opening);
  if(start<0)continue;
  const end=html.indexOf('</article>',start);
  html=html.slice(0,end)+`<div class="page-artifacts entry-artifacts">${renderArtifact(item,pages.get(item.page))}</div>`+html.slice(end);
 }
 const loose=(store?.items||[]).filter(item=>!item.entryId&&!pages.has(item.page));
 if(loose.length){
  const figures=loose.map(item=>renderArtifact(item)).join('\n');
  html=html.replace('</main>',`<section class="loose-clippings" id="loose-clippings" aria-labelledby="loose-clippings-title"><h2 id="loose-clippings-title">Loose clippings</h2><div class="page-artifacts">${figures}</div></section>\n</main>`);
 }
 return html.replace(/<section class="log-page" id="page-(\d+)"[\s\S]*?<\/section>/g,(section,n)=>{
  const items=(store?.items||[]).filter(item=>!item.entryId&&item.page===Number(n));if(!items.length)return section;
  return section.replace(/\s*<\/section>$/,`<div class="page-artifacts" aria-label="Artifacts from page ${Number(n)}">${items.map(item=>renderArtifact(item,pages.get(Number(n)))).join('\n')}</div>\n</section>`);
 });
}

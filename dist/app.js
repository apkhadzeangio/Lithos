const grid=document.querySelector('#stone-grid'),search=document.querySelector('#search'),detail=document.querySelector('#detail'),contact=document.querySelector('#contact');
let filter='all',opener=null;
if(search)search.value=new URLSearchParams(location.search).get('q')||'';
function syncPageMeta(key){
const meta=publicPages[key]||publicPages.work;
document.title=meta.title;
document.querySelector('link[rel="canonical"]').href=meta.url;
document.querySelector('meta[name="description"]').content=meta.description;
document.querySelector('meta[property="og:title"]').content=meta.title;
document.querySelector('meta[property="og:description"]').content=meta.description;
document.querySelector('meta[property="og:url"]').content=meta.url;
}
function render(){
if(!grid||!search)return;
const view=catalogView(filter,search.value.trim(),{finish:document.querySelector('#finish-filter').value,thickness:document.querySelector('#thickness-filter').value});
grid.innerHTML=view.html;
document.querySelector('#result-count').textContent=view.countLabel;
document.querySelector('#catalog-kind').textContent=view.kind;
document.querySelector('#empty').hidden=view.count!==0;
document.querySelector('#catalog-title').innerHTML=view.heading;
document.querySelector('#catalog-eyebrow').textContent=view.eyebrow;
document.querySelector('#catalog-description').textContent=view.description;
document.querySelector('#catalog-note').textContent=view.note;
document.querySelector('#search-note').hidden=!/მარმარილო|marble/i.test(search.value);
}
function setFilter(value,{updateUrl=true}={}){
filter=value;
document.querySelectorAll('[data-filter]').forEach(button=>{const selected=button.dataset.filter===filter;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});
const key=['neolith','quartz'].includes(filter)?filter:'all';
if(updateUrl)history.replaceState(null,'',publicPages[key].path);
syncPageMeta(key);render();
}
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();setFilter(button.dataset.filter);}));
search?.addEventListener('input',render);
function clearFilters(){search.value='';document.querySelector('#finish-filter').value='';document.querySelector('#thickness-filter').value='';render();}
document.querySelectorAll('#finish-filter,#thickness-filter').forEach(s=>s.addEventListener('change',render));
document.querySelector('#clear-specs')?.addEventListener('click',clearFilters);
document.querySelector('#reset')?.addEventListener('click',()=>{clearFilters();search.focus();});
function openDialog(dialog,trigger){opener=trigger||document.activeElement;dialog.showModal();}
function closeDialog(dialog){dialog.close();opener?.focus();}
document.querySelectorAll('dialog').forEach(dialog=>{dialog.querySelector('.dialog-close').addEventListener('click',()=>closeDialog(dialog));dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const bounds=dialog.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)closeDialog(dialog);});});
grid?.addEventListener('click',event=>{
const trigger=event.target.closest('[data-material]');if(!trigger)return;const m=materials[Number(trigger.dataset.material)];
const image=`<div class="slab-view"><a class="slab-image-link" href="${esc(m.image)}" target="_blank" rel="noopener" aria-label="${esc(m.name)} — სრული ფოტოს გახსნა"><img class="detail-img full-slab" src="${esc(m.image)}" alt="${esc(m.brand||m.label)} ${esc(m.name)} — ფილის ფოტო"></a><a class="full-image-link" href="${esc(m.image)}" target="_blank" rel="noopener">ფოტოს გადიდება</a>${m.gallery?.length>1?`<div class="photo-options" role="group" aria-label="${esc(m.name)} — ფოტოები">${m.gallery.map((photo,i)=>`<button class="photo-option ${i===0?'selected':''}" data-photo="${i}" aria-label="ფოტო ${i+1}" aria-pressed="${i===0}"><img src="${esc(photo.thumbnail)}" alt="${esc(m.name)} — ფოტო ${i+1}" loading="lazy"></button>`).join('')}</div>`:''}</div>`;
const formats=`<div class="format-block"><span class="eyebrow muted">ფილის ზომა და შესაბამისი სისქე</span><ul>${m.formats?.length?m.formats.map(([width,height,thickness])=>`<li>${width} × ${height} მმ <span>· ${thickness?thickness+' მმ':'სისქე: დააზუსტეთ'}</span></li>`).join(''):'<li>დააზუსტეთ</li>'}</ul></div>`;
const credit=m.type==='neolith'?'<small class="image-credit">ფოტო: Neolith</small>':'';
document.querySelector('#detail-content').innerHTML=`<div class="detail-grid neolith-detail">${image}<div class="detail-copy"><span class="eyebrow muted">${esc(m.label)}${m.type==='neolith'?' · სინტერირებული ქვა':''}</span><h2 id="detail-heading">${esc(m.name)}</h2><dl><div><dt>მასალის ტიპი</dt><dd>${esc(m.label)}</dd></div>${m.brand?`<div><dt>მწარმოებელი</dt><dd>${esc(m.brand)}</dd></div>`:''}<div><dt>სისქე</dt><dd>${esc(thicknessText(m))}</dd></div><div><dt>დამუშავება</dt><dd>${esc(finishText(m))}</dd></div></dl>${formats}<p>ფორმატის, სისქისა და ხელმისაწვდომობის დასაზუსტებლად დაგვიკავშირდით. ფერი და ნახატის განაწილება შეადარეთ რეალურ ნიმუშს.</p><a class="dark-btn material-whatsapp" href="${esc(whatsappUrl(m.name))}" target="_blank" rel="noopener noreferrer">კონსულტაცია ამ მასალაზე ↗</a>${credit}</div></div>`;
document.querySelectorAll('[data-photo]').forEach(button=>button.addEventListener('click',()=>{const photo=m.gallery[Number(button.dataset.photo)];document.querySelector('.slab-image-link img').src=photo.image;document.querySelectorAll('.slab-image-link,.full-image-link').forEach(link=>link.href=photo.image);document.querySelectorAll('[data-photo]').forEach(item=>{const selected=item===button;item.classList.toggle('selected',selected);item.setAttribute('aria-pressed',String(selected));});}));
openDialog(detail,trigger);
});
let activeProject=null,projectPhotoIndex=0;
function showProjectPhoto(index){
if(!activeProject)return;
projectPhotoIndex=(index+activeProject.photos.length)%activeProject.photos.length;
const photo=activeProject.photos[projectPhotoIndex],image=document.querySelector('#project-photo');
image.src=photo.image;image.alt=photo.alt;image.width=photo.width;image.height=photo.height;
document.querySelector('#project-open-photo').href=photo.image;
document.querySelector('#project-gallery-count').textContent=`${projectPhotoIndex+1} / ${activeProject.photos.length}`;
document.querySelectorAll('[data-project-photo]').forEach(button=>{const selected=Number(button.dataset.projectPhoto)===projectPhotoIndex;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});
}
document.querySelectorAll('[data-project]').forEach(trigger=>trigger.addEventListener('click',()=>{
const project=lithosProjects.find(project=>project.id===trigger.dataset.project);if(!project)return;
activeProject=project;const photo=project.photos[0],multiple=project.photos.length>1;
document.querySelector('#detail-content').innerHTML=`<div class="project-detail"><div class="project-gallery"><div class="project-photo-stage"><img id="project-photo" src="${esc(photo.image)}" width="${photo.width}" height="${photo.height}" alt="${esc(photo.alt)}" decoding="async"></div><div class="project-gallery-controls">${multiple?'<button class="gallery-arrow" data-project-prev aria-label="წინა ფოტო">←</button>':''}<span id="project-gallery-count" aria-live="polite">1 / ${project.photos.length}</span>${multiple?'<button class="gallery-arrow" data-project-next aria-label="შემდეგი ფოტო">→</button>':''}</div>${multiple?`<div class="photo-options project-thumbnails" role="group" aria-label="პროექტის ფოტოები">${project.photos.map((item,index)=>`<button class="photo-option ${index===0?'selected':''}" data-project-photo="${index}" aria-label="ფოტო ${index+1}" aria-pressed="${index===0}"><img src="${esc(item.thumbnail)}" width="${item.thumbWidth}" height="${item.thumbHeight}" alt="${esc(project.title)} — ფოტო ${index+1}" loading="lazy" decoding="async"></button>`).join('')}</div>`:''}<a class="full-image-link" id="project-open-photo" href="${esc(photo.image)}" target="_blank" rel="noopener">ფოტოს გადიდება</a></div><div class="detail-copy project-detail-copy"><span class="eyebrow muted">LITHOS · შესრულებული ნამუშევარი</span><h2 id="detail-heading">${esc(project.title)}</h2><p class="project-subtitle">${esc(project.subtitle)}</p>${projectFacts(project)}<p>${esc(project.description)}</p><button class="dark-btn" data-project-contact>მსგავსი პროექტის განხილვა</button></div></div>`;
document.querySelectorAll('[data-project-photo]').forEach(button=>button.addEventListener('click',()=>showProjectPhoto(Number(button.dataset.projectPhoto))));
if(multiple){document.querySelector('[data-project-prev]').onclick=()=>showProjectPhoto(projectPhotoIndex-1);document.querySelector('[data-project-next]').onclick=()=>showProjectPhoto(projectPhotoIndex+1);}
document.querySelector('[data-project-contact]').onclick=()=>{detail.close();openDialog(contact,trigger);};
showProjectPhoto(0);openDialog(detail,trigger);
}));
detail.addEventListener('close',()=>{activeProject=null;});
detail.addEventListener('keydown',event=>{if(!activeProject)return;if(event.key==='ArrowRight'){event.preventDefault();showProjectPhoto(projectPhotoIndex+1);}else if(event.key==='ArrowLeft'){event.preventDefault();showProjectPhoto(projectPhotoIndex-1);}});
document.querySelectorAll('[data-contact]').forEach(trigger=>trigger.addEventListener('click',()=>openDialog(contact,trigger)));document.querySelector('.contact-dismiss').onclick=()=>closeDialog(contact);
function route(){
const hash=location.hash;
const legacy={'#materials':'all','#neolith':'neolith','#quartz':'quartz','#work':'work'};
const paths={'/materials/':'all','/neolith/':'neolith','/quartz/':'quartz'};
const normalizedPath=location.pathname.replace(/\/index\.html$/,'/').replace(/\/?$/,'/');
const key=legacy[hash]||paths[normalizedPath]||'work';
const page=key==='work'?'work':'materials';
if(!document.querySelector('#'+page)){location.replace(publicPages[key].path+(hash==='#projects'?'#projects':''));return;}
document.querySelectorAll('.page').forEach(section=>section.hidden=section.id!==page);
document.querySelectorAll('[data-nav]').forEach(link=>{const active=link.dataset.nav===page;link.classList.toggle('active',active);if(active&&!(link.getAttribute('href')||'').includes('#'))link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
if(legacy[hash])history.replaceState(null,'',publicPages[key].path);
if(page==='materials')setFilter(key,{updateUrl:false});else syncPageMeta('work');
if(hash&&!legacy[hash]&&document.getElementById(hash.slice(1)))requestAnimationFrame(()=>document.getElementById(hash.slice(1)).scrollIntoView());else window.scrollTo({top:0,behavior:'instant'});
}
window.addEventListener('hashchange',route);window.addEventListener('popstate',route);route();

const inquiry=document.querySelector('#consultation-form');
inquiry?.setAttribute('novalidate','');
inquiry?.addEventListener('submit',event=>{
event.preventDefault();
const name=inquiry.elements.namedItem('name'),phone=inquiry.elements.namedItem('phone'),status=document.querySelector('#form-status');
name.removeAttribute('aria-invalid');phone.removeAttribute('aria-invalid');
if(!name.value.trim()){name.setAttribute('aria-invalid','true');status.textContent='გთხოვთ, მიუთითოთ სახელი.';name.focus();return;}
const digits=phone.value.replace(/\D/g,'');
if(!/^\+?[\d\s().-]+$/.test(phone.value.trim())||digits.length<9||digits.length>15){phone.setAttribute('aria-invalid','true');status.textContent='გთხოვთ, მიუთითოთ სწორი ტელეფონის ნომერი.';phone.focus();return;}
const values=Object.fromEntries(['name','phone','material','dimensions','comment'].map(key=>[key,inquiry.elements.namedItem(key).value]));
const url=inquiryUrl(values),fallback=document.querySelector('#form-whatsapp-fallback');fallback.href=url;fallback.hidden=false;
window.open(url,'_blank','noopener,noreferrer');
status.textContent='შეტყობინება მზადაა WhatsApp-ში გასაგზავნად. თუ ახალი ჩანართი არ გაიხსნა, გამოიყენეთ ქვემოთ მოცემული ბმული.';
});

import {STYLES,MATERIALS,PALETTES,ENHANCEMENTS,INTENSITIES,cleanPreferences,preferenceSummary,validateContact} from './core.mjs';
const $=id=>document.getElementById(id);
const config=window.lithosExteriorConfig||{},apiBase=String(config.apiBase||'').replace(/\/$/,'');
const validApi=/^https:\/\/[^\s]+$/.test(apiBase)||apiBase.startsWith('/')&&!apiBase.startsWith('//');
let capabilities={generation:false,leads:false},preferences={style:'modern',material:'travertine',palette:'ivory',customColor:'',intensity:'facade',enhancements:[]};
let photo=null,photoUrl='',sample=false,photoRevision=0,result=null,resultUrl='',busy=false,controller=null,challengeToken='',reference='';
const feedback=(message,error=false)=>{ $('studio-status').textContent=message;$('studio-status').classList.toggle('error',error); };
const statusLead=(message,error=false)=>{$('lead-status').textContent=message;$('lead-status').classList.toggle('error',error);};
const sampleAsset=()=>new URL('assets/before.webp',import.meta.url).href;
const afterAsset=()=>new URL('assets/'+(preferences.style==='modern'?'after.webp':preferences.style+'.webp'),import.meta.url).href;
const revoke=url=>{if(url?.startsWith('blob:'))URL.revokeObjectURL(url);};
const saveBlob=(blob,name)=>{const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>revoke(url),10000);};
const dataUrl=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('ფოტოს წაკითხვა ვერ მოხერხდა.'));reader.readAsDataURL(blob);});
function projectRef(){const suffix=[...crypto.getRandomValues(new Uint8Array(6))].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();return 'LX-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+suffix;}
function setBusy(value){busy=value;for(const node of document.querySelectorAll('.controls-column button,.controls-column select,.controls-column input,#photo-actions button,#regenerate,#reset-project,#choose-photo,#use-sample,#open-camera'))node.disabled=value;$('generation-state').hidden=!value;$('generate').disabled=value;}
function invalidate(){result=null;reference='';revoke(resultUrl);resultUrl='';$('result-panel').hidden=true;feedback('');}
function renderStyles(){
 $('style-options').replaceChildren(...STYLES.map(style=>{
  const button=document.createElement('button');button.type='button';button.className='style-card'+(preferences.style===style.id?' selected':'');button.setAttribute('aria-pressed',String(preferences.style===style.id));button.title=style.description;
  const frame=document.createElement('div');frame.className='style-card-image';const img=document.createElement('img');img.src='assets/'+style.image;img.alt=style.name+' — სადემონსტრაციო არქიტექტურული სტილი';img.width=512;img.height=512;img.loading='lazy';frame.append(img);
  const name=document.createElement('span');name.className='style-name';name.textContent=style.name;const desc=document.createElement('span');desc.className='style-description';desc.textContent=style.description;
  const check=document.createElement('span');check.className='style-check';check.setAttribute('aria-hidden','true');check.textContent='✓';button.append(frame,name,desc,check);
  button.addEventListener('click',()=>{if(busy)return;preferences.style=style.id;invalidate();renderStyles();const selected=$('style-options').querySelector('[aria-pressed="true"]');selected?.focus({preventScroll:true});});return button;
 }));
}
function renderPalette(){
 $('palette-options').replaceChildren(...PALETTES.map(p=>{const b=document.createElement('button');b.type='button';b.className='palette-swatch';b.style.setProperty('--swatch',p.color);b.setAttribute('aria-label',p.name);b.setAttribute('aria-pressed',String(preferences.palette===p.id));b.title=p.name;b.addEventListener('click',()=>{if(busy)return;preferences.palette=p.id;preferences.customColor=p.id==='custom'?$('custom-color').value:'';invalidate();renderPalette();$('palette-options').querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});});return b;}));
 $('palette-name').textContent=PALETTES.find(p=>p.id===preferences.palette).name;$('custom-color-label').hidden=preferences.palette!=='custom';
}
function updateMaterialNote(){
 const note=$('material-catalog-note');note.replaceChildren();
 if(['porcelain','sintered'].includes(preferences.material)){
  note.append('ფაქტურების სანახავად: ');const a=document.createElement('a');a.href='../neolith/';a.textContent='NEOLITH-ის კოლექცია ↗';note.append(a,document.createElement('br'),'მარაგი და ფასადზე ვარგისიანობა სპეციალისტთან უნდა დაზუსტდეს.');
 }else note.textContent='მასალის შერჩევა კონცეპტუალურია; ფასადზე გამოყენებას სპეციალისტი შეაფასებს.';
}
for(const [element,items] of [[$('material-select'),MATERIALS.map(p=>[p.id,p.name])],[$('intensity-select'),INTENSITIES]])element.replaceChildren(...items.map(([id,name])=>new Option(name,id)));
$('material-select').value=preferences.material;$('intensity-select').value=preferences.intensity;
$('enhancement-options').replaceChildren(...ENHANCEMENTS.map(([id,text])=>{const label=document.createElement('label');label.className='check-label';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.value=id;const span=document.createElement('span');span.textContent=text;label.append(checkbox,span);checkbox.addEventListener('change',()=>{preferences.enhancements=[...$('enhancement-options').querySelectorAll(':checked')].map(n=>n.value);invalidate();});return label;}));
for(const [id,key] of [['material-select','material'],['intensity-select','intensity'],['custom-color','customColor']])$(id).addEventListener('change',event=>{preferences[key]=event.target.value;invalidate();if(key==='material')updateMaterialNote();});
renderStyles();renderPalette();
for(const comparison of document.querySelectorAll('[data-comparison]'))comparison.querySelector('input').addEventListener('input',event=>comparison.style.setProperty('--split',event.target.value+'%'));
for(const button of document.querySelectorAll('[data-close-dialog]'))button.addEventListener('click',()=>button.closest('dialog').close());
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}});
document.querySelectorAll('[data-open-privacy]').forEach(button=>button.addEventListener('click',()=>$('privacy-dialog').showModal()));
$('menu-button').addEventListener('click',()=>{const expanded=$('menu-button').getAttribute('aria-expanded')==='true';$('menu-button').setAttribute('aria-expanded',String(!expanded));$('mobile-nav').hidden=expanded;});
$('mobile-nav').querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{$('mobile-nav').hidden=true;$('menu-button').setAttribute('aria-expanded','false');}));
document.querySelectorAll('[data-focus-upload]').forEach(a=>a.addEventListener('click',()=>setTimeout(()=>$('choose-photo').focus({preventScroll:true}),350)));
for(const id of ['choose-photo','replace-photo'])$(id).addEventListener('click',()=>$('house-photo').click());
$('open-camera').addEventListener('click',()=>$('camera-photo').click());
async function preparePhoto(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>15*1024*1024)throw Error('აირჩიე JPEG, PNG ან WebP ფოტო, მაქსიმუმ 15 მბ.');
 let bitmap;try{bitmap=await createImageBitmap(file);}catch{throw Error('ფოტო ვერ გაიხსნა. სცადე სხვა ფაილი.');}
 try{
  if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>50_000_000)throw Error('ფოტოს გარჩევადობა ძალიან დიდია. აირჩიე შემცირებული ვერსია.');
  const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  let blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.86));if(blob?.size>2*1024*1024)blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.7));
  if(!blob||blob.size>2*1024*1024)throw Error('ფოტოს შემცირება ვერ მოხერხდა. სცადე სხვა ფოტო.');return blob;
 }finally{bitmap.close();}
}
function showPhoto(){
 $('upload-empty').hidden=!!photo;$('uploaded-photo').hidden=!photo;$('photo-actions').hidden=!photo;$('upload-zone').classList.toggle('has-photo',!!photo);
 if(photo){$('uploaded-photo').src=photoUrl;$('uploaded-photo').alt=sample?'სადემონსტრაციო სახლის ფოტო':'შენი სახლის საწყისი ფოტო';}else $('uploaded-photo').removeAttribute('src');
 $('canvas-label').textContent=sample?'სადემონსტრაციო სახლი':'შენი სახლის ფოტო';
}
async function acceptPhoto(file){
 if(busy)return;const rev=++photoRevision;feedback('მიმდინარეობს ფოტოს მომზადება…');
 try{const prepared=await preparePhoto(file);if(rev!==photoRevision||busy)return;revoke(photoUrl);photo=prepared;photoUrl=URL.createObjectURL(photo);sample=false;invalidate();showPhoto();feedback('ფოტო მზადაა · '+Math.round(photo.size/1024)+' კბ. აირჩიე სასურველი სტილი.');}
 catch(error){if(rev===photoRevision)feedback(error.message,true);}
}
for(const id of ['house-photo','camera-photo'])$(id).addEventListener('change',event=>{const file=event.target.files[0];if(file)acceptPhoto(file);event.target.value='';});
const drop=$('upload-zone');for(const type of ['dragenter','dragover'])drop.addEventListener(type,event=>{event.preventDefault();if(!busy)drop.classList.add('dragging');});for(const type of ['dragleave','drop'])drop.addEventListener(type,event=>{event.preventDefault();drop.classList.remove('dragging');if(type==='drop'&&event.dataTransfer.files[0])acceptPhoto(event.dataTransfer.files[0]);});
async function useSample(){
 if(busy)return;const rev=++photoRevision;
 try{const response=await fetch(sampleAsset());if(!response.ok)throw Error('სადემონსტრაციო ფოტო ვერ ჩაიტვირთა.');const blob=await preparePhoto(await response.blob());if(rev!==photoRevision)return;revoke(photoUrl);photo=blob;photoUrl=URL.createObjectURL(photo);sample=true;invalidate();showPhoto();feedback('არჩეულია სადემონსტრაციო სახლი. შეგიძლია დაათვალიერო სტილები.');}
 catch(error){feedback(error.message,true);}
}
$('use-sample').addEventListener('click',useSample);
function removePhoto(){if(busy)return;++photoRevision;invalidate();photo=null;sample=false;revoke(photoUrl);photoUrl='';showPhoto();}
$('remove-photo').addEventListener('click',removePhoto);
$('reset-project').addEventListener('click',()=>{if(busy)return;removePhoto();preferences={style:'modern',material:'travertine',palette:'ivory',customColor:'',intensity:'facade',enhancements:[]};$('material-select').value='travertine';$('intensity-select').value='facade';$('custom-color').value='#c9b596';$('enhancement-options').querySelectorAll('input').forEach(n=>n.checked=false);$('generation-consent').checked=false;$('lead-form').reset();statusLead('');$('advanced-controls')?.removeAttribute('open');document.querySelector('.advanced-controls').open=false;renderStyles();renderPalette();updateMaterialNote();feedback('შეგიძლია ახალი პროექტი დაიწყო.');});
function showResult(){
 $('result-kind').textContent=result.mode==='demo'?'სტილის დემონსტრაცია · AI კონცეფცია':'შენი სახლის AI ვიზუალიზაცია';
 $('result-title').textContent=STYLES.find(s=>s.id===result.preferences.style).name;
 const illustration=result.mode==='demo'&&result.preferences.style!=='modern';
 const comparison=$('result-panel').querySelector('.comparison');comparison.classList.toggle('style-example',illustration);comparison.querySelector('.after-label').textContent=illustration?'სტილის მაგალითი':'შემდეგ';
 $('result-disclosure').textContent=result.mode==='demo'?(result.preferences.style==='modern'?'ეს არის წინასწარ მომზადებული, ერთი სადემონსტრაციო სახლის გარდაქმნა.':'ეს არის არჩეული სტილის დამოუკიდებელი ილუსტრაცია და არა საწყისი სახლის გარდაქმნა.')+(sample?'':' შენი ატვირთული ფოტო არ გარდაქმნილა და არსად გაგზავნილა.')+' მასალა და ფერი ამ მაგალითს არ ცვლის.':'კონცეპტუალური შედეგი. გადაამოწმე, რომ შენობის კონსტრუქცია და ღიობები შენარჩუნებულია.';
 $('result-before').src=result.before;$('result-after').src=result.after;$('full-result').src=result.after;
 $('result-before').alt=result.mode==='demo'?'სადემონსტრაციო სახლი — ეს შენი ატვირთული ფოტო არ არის':'შენი სახლის საწყისი ფოტო';
 $('result-after').alt=result.mode==='demo'?'წინასწარ მომზადებული სტილის კონცეფცია':'შენი სახლის AI ვიზუალიზაცია';
 $('result-summary').textContent=(result.mode==='demo'?'არჩეული პარამეტრები მომავალი გენერაციისთვის: ':'პროექტის პარამეტრები: ')+preferenceSummary(result.preferences).join(' · ');
 $('result-panel').hidden=false;$('result-panel').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'});
}
async function generate(){
 if(busy)return;
 if(!photo){feedback('ჯერ ატვირთე სახლის ფოტო ან აირჩიე სადემონსტრაციო სახლი.',true);$('choose-photo').focus({preventScroll:true});return;}
 if(!capabilities.generation){
  invalidate();reference=projectRef();result={mode:'demo',before:sampleAsset(),after:afterAsset(),preferences:cleanPreferences(preferences),reference,createdAt:new Date().toISOString()};showResult();feedback('სტილის დემო მზადაა. ეს არის წინასწარ მომზადებული მაგალითი.');return;
 }
 if(!$('generation-consent').checked){feedback('ფოტოს AI სერვისისთვის გაგზავნისთვის დაადასტურე თანხმობა.',true);$('generation-consent').focus();return;}
 if(!challengeToken){feedback('გთხოვ, დაასრულე უსაფრთხოების შემოწმება.',true);return;}
 invalidate();setBusy(true);controller=new AbortController();$('generation-message').textContent='მიმდინარეობს ფოტოს დამუშავება';
 const timeout=setTimeout(()=>controller?.abort('timeout'),150000);let timedOut=false;
 try{
  const bitmap=await createImageBitmap(photo);const scale=Math.min(1,500/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const aiBlob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));if(!aiBlob)throw Error('ფოტოს მომზადება ვერ მოხერხდა.');
  const prepared=await dataUrl(aiBlob);$('generation-message').textContent='იქმნება ახალი ექსტერიერი';
  const response=await fetch(apiBase+'/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:{mime_type:'image/jpeg',data:prepared.split(',')[1]},preferences:cleanPreferences(preferences),consent:true,turnstileToken:challengeToken}),signal:controller.signal});
  const body=await response.json();if(!response.ok)throw Error(body.error||'ვიზუალიზაცია ვერ შეიქმნა. სცადე მოგვიანებით.');
  if(!['image/jpeg','image/png','image/webp'].includes(body.image?.mime_type)||typeof body.image.data!=='string'||body.image.data.length>16*1024*1024)throw Error('სერვისმა გამოსადეგი ფოტო ვერ დააბრუნა.');
  const bytes=Uint8Array.from(atob(body.image.data),c=>c.charCodeAt(0));const blob=new Blob([bytes],{type:body.image.mime_type});resultUrl=URL.createObjectURL(blob);reference=body.reference;
  result={mode:'live',before:photoUrl,after:resultUrl,blob,receipt:body.receipt,reference,preferences:cleanPreferences(preferences),createdAt:body.createdAt||new Date().toISOString()};showResult();feedback('ვიზუალიზაცია მზადაა. შეადარე საწყის ფოტოს.');
 }catch(error){timedOut=controller?.signal.reason==='timeout';feedback(error.name==='AbortError'||controller?.signal.aborted?(timedOut?'დრო ამოიწურა. ახალი ცდის წინ გაითვალისწინე: წინა მოთხოვნა შესაძლოა უკვე დამუშავდა.':'მოთხოვნის ლოდინი გაუქმდა. დაწყებული AI დამუშავება შესაძლოა გაგრძელდეს.'):error.message,true);}
 finally{clearTimeout(timeout);controller=null;setBusy(false);challengeToken='';window.turnstile?.reset();}
}
$('generate').addEventListener('click',generate);$('regenerate').addEventListener('click',generate);$('cancel-generation').addEventListener('click',()=>controller?.abort('user'));
$('expand-result').addEventListener('click',()=>{if(result)$('image-dialog').showModal();});
$('download-result').addEventListener('click',async()=>{if(!result)return;try{const blob=result.blob||await(await fetch(result.after)).blob();saveBlob(blob,'lithos-'+result.reference+(result.mode==='demo'?'-DEMO':'')+'.'+(blob.type==='image/png'?'png':blob.type==='image/jpeg'?'jpg':'webp'));feedback('ვიზუალიზაციის ჩამოტვირთვა დაწყებულია.');}catch{feedback('ჩამოტვირთვა ვერ მოხერხდა. სცადე ხელახლა.',true);}});
async function draft(contact=null){
 const ref=result?.reference||projectRef();
 return {version:1,reference:ref,createdAt:result?.createdAt||new Date().toISOString(),mode:result?.mode||'draft',submitted:false,contact,preferences:result?.preferences||cleanPreferences(preferences),photos:{original:photo?await dataUrl(photo):null,generated:result?.mode==='live'?await dataUrl(result.blob):null,demoPreview:result?.mode==='demo'?{url:result.after,label:'წინასწარ მომზადებული სტილის მაგალითი; ატვირთული ფოტო არ გარდაქმნილა.'}:null},note:'ეს ფაილი ინახება შენს მოწყობილობაზე; LITHOS-ს ავტომატურად არ გაგზავნია.'};
}
$('save-project').addEventListener('click',async()=>{try{const data=await draft();saveBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),'lithos-'+data.reference+'.json');feedback('პროექტის ფაილის ჩამოტვირთვა დაწყებულია.');}catch{feedback('შენახვა ვერ მოხერხდა.',true);}});
for(const button of document.querySelectorAll('[data-open-lead]'))button.addEventListener('click',()=>{
 const text=result?preferenceSummary(result.preferences).join(' · '):preferenceSummary(preferences).join(' · ');
 $('lead-attachment-summary').textContent=(photo?'დაერთვება: საწყისი ფოტო. ':'ფოტო ჯერ არ არის არჩეული. ')+(result?.mode==='live'?'დაერთვება AI ვიზუალიზაციაც. ':result?.mode==='demo'?'დემო მაგალითი ცალკე მოინიშნება. ':'')+text;statusLead('');$('lead-dialog').showModal();
});
$('lead-form').addEventListener('submit',async event=>{
 event.preventDefault();const button=$('submit-lead');button.disabled=true;statusLead('');
 try{
  const raw=Object.fromEntries(new FormData(event.target));const contact=validateContact({...raw,consent:raw.consent==='on'});
  if(!capabilities.leads){const data=await draft(contact);saveBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),'lithos-request-'+data.reference+'.json');statusLead('მონახაზის ჩამოტვირთვა დაწყებულია. მოთხოვნა LITHOS-ში არ გაგზავნილა. კონსულტაციისთვის შეგიძლია დაგვირეკო.');return;}
  if(!photo)throw Error('მოთხოვნის გაგზავნამდე ატვირთე სახლის ფოტო.');
  if(result?.mode!=='live'||!result.receipt)throw Error('მოთხოვნის გასაგზავნად ჯერ შექმენი შენი სახლის AI ვიზუალიზაცია.');
  const [original,generated]=await Promise.all([dataUrl(photo),dataUrl(result.blob)]);
  const response=await fetch(apiBase+'/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contact,preferences:result.preferences,receipt:result.receipt,reference:result.reference,original,generated}),signal:AbortSignal.timeout(45000)});
  const data=await response.json();if(!response.ok)throw Error(data.error||'მოთხოვნის გაგზავნა ვერ მოხერხდა.');statusLead('მოთხოვნა მიღებულია. შენი პროექტის ნომერია '+data.reference+'. LITHOS-ის გუნდი დაგიკავშირდება.');event.target.reset();
 }catch(error){statusLead(error.name==='TimeoutError'?'დრო ამოიწურა. განმეორებით გაგზავნამდე დაგვიკავშირდი პროექტის ნომრით.':error.message,true);}
 finally{button.disabled=false;}
});
async function configure(){
 if(!validApi)return;
 try{
  const response=await fetch(apiBase+'/capabilities',{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!response.ok)return;const data=await response.json();capabilities={generation:data.generation===true&&!!config.turnstileSiteKey,leads:data.leads===true};
  if(capabilities.generation){
   $('mode-badge').lastChild.textContent=' AI ვიზუალიზაცია';$('generate').innerHTML='დააგენერირე ჩემი სახლის ექსტერიერი <span aria-hidden="true">✧</span>';$('mode-note').textContent='ფოტო AI სერვისს მხოლოდ შენი თანხმობით გადაეცემა. შენარჩუნდება არსებული შენობის ძირითადი ფორმა.';$('generation-caption').textContent='რეგისტრაციის გარეშე · გენერაციაზე მოქმედებს დღიური ლიმიტი';$('generation-consent-label').hidden=false;$('privacy-inline-text').textContent='შენი ფოტო AI სერვისს გადაეცემა მხოლოდ თანხმობის შემდეგ.';
   window.lithosExteriorChallengeReady=()=>window.turnstile.render('#turnstile-container',{sitekey:config.turnstileSiteKey,callback:token=>challengeToken=token,'expired-callback':()=>challengeToken='','error-callback':()=>challengeToken=''});
   const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?onload=lithosExteriorChallengeReady&render=explicit';script.async=true;script.defer=true;document.head.append(script);
  }
  if(capabilities.leads){$('lead-intro').textContent='გაგვიზიარე საკონტაქტო ინფორმაცია. შენს მოთხოვნას ავტომატურად დაერთვება საწყისი ფოტო, AI ვიზუალიზაცია და არჩეული პარამეტრები.';$('submit-lead').innerHTML='გაგზავნე მოთხოვნა <span aria-hidden="true">↗</span>';}
 }catch{/* A failed capability check keeps the explicit demo; never imply a live integration. */}
}
configure();
window.addEventListener('pagehide',()=>{controller?.abort('pagehide');++photoRevision;revoke(photoUrl);revoke(resultUrl);photo=null;result=null;photoUrl='';resultUrl='';reference='';sample=false;$('lead-form').reset();$('result-panel').hidden=true;showPhoto();});

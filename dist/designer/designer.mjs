import {designPrompt,dimensions,dimensionsSummary} from './core.mjs';
const $=id=>document.getElementById(id);
const list=materials,form=$('design-form'),choice=$('material-choice');
let selected=list.find(m=>m.id==='calacatta-gold')||list[0],photo=null,photoUrl='',resultUrl='',photoRevision=0;
const endpoint=window.lithosDesignerConfig?.endpoint||'';
const values=()=>Object.fromEntries(new FormData(form));
function status(text,error=false){$('form-status').textContent=text;$('form-status').classList.toggle('error',error);}
function invalidate(){ $('prompt-panel').hidden=true;$('result-panel').hidden=true;status(''); }
function selectMaterial(){
  selected=list.find(m=>m.type+':'+m.id===choice.value)||selected;
  $('stone-photo').src='/'+selected.image;
  $('stone-photo').alt=selected.name+' — არჩეული ქვის რეალური ფოტო';
  $('stone-caption').textContent=selected.name+' — '+selected.label+'; '+finishText(selected);
  $('download-stone').href='/'+selected.image;
  $('download-stone').download=selected.type+'-'+selected.id+'.webp';
  invalidate();
}
function filterMaterials(){
  const tokens=$('material-search').value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const found=list.filter(m=>{const text=normalize([m.name,m.label,...(m.aliases||[]),...(m.searchKeywords||[])].join(' '));return tokens.every(t=>text.includes(normalize(t))||phonetic(text).includes(phonetic(t)));});
  choice.replaceChildren(...found.map(m=>new Option(m.name+' — '+m.label,m.type+':'+m.id)));
  $('material-count').textContent=found.length+' მასალა';
  if(!found.length){choice.disabled=true;$('stone-photo').hidden=true;$('stone-caption').textContent='შესაბამისი მასალა ვერ მოიძებნა. შეცვალეთ საძიებო სიტყვა.';$('download-stone').hidden=true;invalidate();return;}
  choice.disabled=false;$('stone-photo').hidden=false;$('download-stone').hidden=false;
  if(found.includes(selected))choice.value=selected.type+':'+selected.id;
  selectMaterial();
}
function saveBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
async function preparePhoto(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('აირჩიეთ JPG, PNG ან WebP ფოტო, მაქსიმუმ 10 მბ.');
  const bitmap=await createImageBitmap(file);
  try{
    if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>50_000_000)throw Error('ფოტო ძალიან დიდია. აირჩიეთ შემცირებული ვერსია.');
    const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
    const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.86));
    if(!blob||blob.size>2*1024*1024)throw Error('ფოტოს შემცირება ვერ მოხერხდა. სცადეთ სხვა ფოტო.');
    return blob;
  }finally{bitmap.close();}
}
$('kitchen-photo').addEventListener('change',async()=>{
  const revision=++photoRevision;
  photo=null;$('save-photo').disabled=true;invalidate();$('kitchen-preview').hidden=true;$('photo-preview').querySelector('.preview-empty').hidden=false;
  if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl='';
  const file=$('kitchen-photo').files[0];if(!file){$('photo-state').textContent='ფოტო არ არის არჩეული';return;}
  $('photo-state').textContent='ფოტო მზადდება…';
  try{const prepared=await preparePhoto(file);if(revision!==photoRevision)return;photo=prepared;photoUrl=URL.createObjectURL(photo);$('kitchen-preview').src=photoUrl;$('kitchen-preview').hidden=false;$('photo-preview').querySelector('.preview-empty').hidden=true;$('save-photo').disabled=false;$('photo-state').textContent=Math.round(photo.size/1024)+' კბ — მომზადებულია';}
  catch(error){if(revision!==photoRevision)return;$('photo-state').textContent='ფოტო ვერ გაიხსნა';status(error.message,true);}
});
form.addEventListener('input',event=>{if(event.target.id!=='material-search'&&event.target.id!=='access-code'&&event.target.id!=='consent')invalidate();});
$('material-search').addEventListener('input',filterMaterials);choice.addEventListener('change',selectMaterial);
form.addEventListener('submit',event=>{
  event.preventDefault();
  if(!photo){status('ჯერ აირჩიეთ სამზარეულოს ფოტო.',true);$('kitchen-photo').focus();return;}
  if(choice.disabled){status('აირჩიეთ მასალა კატალოგიდან.',true);return;}
  try{$('prompt-text').value=designPrompt(selected,values());$('prompt-panel').hidden=false;status('ინსტრუქცია მზადაა. დაურთეთ ჯერ სამზარეულოს ფოტო, შემდეგ — არჩეული ქვის ფოტო.');}
  catch(error){status(error.message,true);}
});
$('save-photo').addEventListener('click',()=>{if(photo)saveBlob(photo,'lithos-kitchen.jpg');});
$('download-prompt').addEventListener('click',()=>saveBlob(new Blob([$ ('prompt-text').value],{type:'text/plain;charset=utf-8'}),'lithos-ai-studio.txt'));
$('copy-prompt').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('prompt-text').value);status('ინსტრუქცია დაკოპირებულია.');}catch{$('prompt-text').focus();$('prompt-text').select();status('მონიშნული ინსტრუქცია ხელით დააკოპირეთ.');}});
if(endpoint&&/^https:\/\//.test(endpoint)){
  $('automatic-panel').hidden=false;
  $('connection-note').textContent='ავტომატური გენერაცია ხელმისაწვდომია საცდელი წვდომის კოდით. ფოტო იგზავნება მხოლოდ თქვენი თანხმობით.';
}
async function aiReference(blob){
  // Workers AI reference images must be smaller than 512x512.
  const bitmap=await createImageBitmap(blob);
  try{
    const scale=Math.min(1,500/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));
    canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const output=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.85));
    if(!output||output.size>1024*1024)throw Error('AI საცნობარო სურათის მომზადება ვერ მოხერხდა.');
    return output;
  }finally{bitmap.close();}
}
const toBase64=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});
$('generate').addEventListener('click',async()=>{
  if(!photo||choice.disabled){status('აირჩიეთ სივრცის ფოტო და მასალა.',true);return;}
  if(!$('consent').checked){status('გენერაციისთვის დაადასტურეთ ფოტოს Cloudflare Workers AI-სთვის გაგზავნა.',true);return;}
  if(!$('access-code').value){status('მიუთითეთ საცდელი წვდომის კოდი.',true);return;}
  let dims;try{dims=dimensions(values());}catch(error){status(error.message,true);return;}
  const requestMaterial=selected,requestPhoto=photo;
  const button=$('generate');button.disabled=true;status('ვიზუალიზაცია იქმნება…');
  try{
    const stoneResponse=await fetch('/'+requestMaterial.image);
    if(!stoneResponse.ok)throw Error('ქვის საცნობარო ფოტო ვერ ჩაიტვირთა.');
    const [kitchenRef,stoneRef]=await Promise.all([aiReference(requestPhoto),aiReference(await stoneResponse.blob())]);
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+$('access-code').value},body:JSON.stringify({materialId:requestMaterial.type+':'+requestMaterial.id,dimensions:dims,image:{mime_type:'image/jpeg',data:await toBase64(kitchenRef)},stoneImage:{mime_type:'image/jpeg',data:await toBase64(stoneRef)}}),signal:AbortSignal.timeout(150000)});
    const data=await response.json();if(!response.ok)throw Error(data.error||'გენერაცია ვერ დასრულდა.');
    if(!['image/png','image/jpeg','image/webp'].includes(data.image?.mime_type)||typeof data.image.data!=='string')throw Error('სერვისმა გამოსადეგი ფოტო ვერ დააბრუნა.');
    const bytes=Uint8Array.from(atob(data.image.data),c=>c.charCodeAt(0));
    if(resultUrl)URL.revokeObjectURL(resultUrl);resultUrl=URL.createObjectURL(new Blob([bytes],{type:data.image.mime_type}));
    $('result-image').src=resultUrl;$('result-image').alt='AI ვიზუალიზაცია — '+requestMaterial.name;$('download-result').href=resultUrl;$('download-result').download='lithos-visualization.'+({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[data.image.mime_type]);
    $('consultation').href='https://wa.me/995551044013?text='+encodeURIComponent('გამარჯობა! მაინტერესებს სამზარეულოს ზედაპირი: '+requestMaterial.name+' ('+requestMaterial.label+').\n'+dimensionsSummary(dims)+'\nვიზუალიზაციის ფოტოს ცალკე გიგზავნით.');
    $('result-panel').hidden=false;status(selected!==requestMaterial||photo!==requestPhoto?'შედეგი მიღებულია წინა ფოტოსა და მასალისთვის: '+requestMaterial.name+'.':'ვიზუალიზაცია მზადაა. შეადარეთ საწყის ფოტოსა და ქვის ნიმუშს.');
  }catch(error){status(error.name==='TimeoutError'?'მოთხოვნის დრო ამოიწურა. შედეგი არ მიგვიღია; ხელახლა ცდამდე გადაამოწმეთ გამოყენება.':error.message,true);}
  finally{button.disabled=false;}
});
filterMaterials();

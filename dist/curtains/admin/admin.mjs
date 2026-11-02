import {STATUSES,preferenceSummary} from '../core.mjs';
const $=id=>document.getElementById(id),base=String(window.lithosCurtainConfig?.apiBase||'').replace(/\/$/,'');
let token='',leads=[],selected='',revision=0,images=[];
const status=(message,error=false)=>{$('status').textContent=message;$('status').classList.toggle('error',error);};
const purgeImages=()=>{images.forEach(url=>URL.revokeObjectURL(url));images=[];};
const api=async(path,options={})=>{const response=await fetch(base+path,{...options,headers:{...options.headers,Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok){if(response.status===401)logout();const data=await response.json().catch(()=>({}));throw Error(data.error||'მოქმედება ვერ შესრულდა.');}return response;};
function logout(){revision++;token='';leads=[];selected='';purgeImages();$('detail').replaceChildren();$('leads').replaceChildren();$('admin-token').value='';$('dashboard').hidden=true;$('logout').hidden=true;$('login-form').hidden=false;status('სესია დასრულებულია.');}
$('logout').addEventListener('click',logout);window.addEventListener('pagehide',logout);
STATUSES.forEach(text=>$('status-filter').append(new Option(text,text)));
function render(){
 const found=leads.filter(lead=>!$('status-filter').value||lead.status===$('status-filter').value);$('list-note').textContent=found.length?'ბოლო 100 მოქმედი მოთხოვნიდან ნაჩვენებია '+found.length:'მოთხოვნები არ მოიძებნა.';
 $('leads').replaceChildren(...found.map(lead=>{const li=document.createElement('li'),b=document.createElement('button');b.type='button';b.className='lead-button'+(lead.reference===selected?' selected':'');b.textContent=lead.contact.name+' · '+lead.reference;const line=document.createElement('span');line.textContent=lead.contact.city+' · '+lead.status+' · '+new Date(lead.created_at).toLocaleDateString('ka-GE');b.append(line);b.addEventListener('click',()=>showDetail(lead));li.append(b);return li;}));
}
async function refresh(){const rev=revision;const data=await(await api('/admin/orders')).json();if(rev!==revision||!token)return;leads=data.orders;render();status('მოთხოვნები განახლებულია.');}
$('login-form').addEventListener('submit',async event=>{event.preventDefault();if(!base){status('შიდა სერვისი ამ სამუშაო ვერსიაში ჯერ არ არის დაკავშირებული.',true);return;}token=$('admin-token').value;$('admin-token').value='';revision++;try{await refresh();if(!token)return;$('login-form').hidden=true;$('dashboard').hidden=false;$('logout').hidden=false;}catch(error){token='';status(error.message,true);}});
$('refresh').addEventListener('click',()=>refresh().catch(error=>status(error.message,true)));$('status-filter').addEventListener('change',render);
async function showDetail(lead){
 selected=lead.reference;render();purgeImages();const rev=++revision,box=$('detail');box.replaceChildren();
 const title=document.createElement('h2');title.textContent=lead.contact.name;box.append(title);
 for(const [label,value] of [['პროექტი',lead.reference],['ტელეფონი',lead.contact.phone],['მდებარეობა',lead.contact.city],['ფართობი',lead.contact.area],['ბიუჯეტი',lead.contact.budget],['კომენტარი',lead.contact.comment],['პარამეტრები',preferenceSummary(lead.preferences).join(' · ')]])if(value){const p=document.createElement('p');p.textContent=label+': '+value;box.append(p);}
 const photoBox=document.createElement('div');photoBox.className='admin-images';box.append(photoBox);
 for(const kind of ['original','preview']){
  try{const response=await api('/admin/orders/'+lead.reference+'/'+kind);const blob=await response.blob();if(rev!==revision||!token)return;const url=URL.createObjectURL(blob);images.push(url);const img=document.createElement('img');img.src=url;img.alt=kind==='original'?'საწყისი ფოტო':'2D ესკიზი';photoBox.append(img);}catch(error){if(rev===revision)status(error.message,true);}
 }
 if(rev!==revision||!token)return;
 const select=document.createElement('select');select.setAttribute('aria-label','მოთხოვნის სტატუსი');STATUSES.forEach(text=>select.append(new Option(text,text)));select.value=lead.status;const notes=document.createElement('textarea');notes.rows=4;notes.maxLength=5000;notes.value=lead.notes;notes.setAttribute('aria-label','შიდა შენიშვნები');notes.placeholder='შიდა შენიშვნები';const actions=document.createElement('div');actions.className='admin-actions';const save=document.createElement('button');save.className='button dark';save.textContent='შენახვა';const remove=document.createElement('button');remove.className='text-button';remove.textContent='მოთხოვნისა და ფოტოების წაშლა';
 save.addEventListener('click',async()=>{save.disabled=true;try{await api('/admin/orders/'+lead.reference,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:select.value,notes:notes.value})});if(rev!==revision)return;lead.status=select.value;lead.notes=notes.value;render();status('ცვლილებები შენახულია.');}catch(error){status(error.message,true);}finally{save.disabled=false;}});
 remove.addEventListener('click',async()=>{if(!confirm('წაიშლება მოთხოვნა და ორივე ფოტო. გააგრძელებ?'))return;try{await api('/admin/orders/'+lead.reference,{method:'DELETE'});if(rev!==revision)return;box.replaceChildren();purgeImages();selected='';await refresh();status('მოთხოვნა და ფოტოები წაიშალა.');}catch(error){status(error.message,true);}});
 actions.append(save,remove);box.append(select,notes,actions);
}

import {cleanPreferences,validateContact,STATUSES} from '../../dist/exterior/core.mjs';
import {editExterior,bytesFromBase64,imageMime,jpegSize} from './provider.mjs';
const encoder=new TextEncoder(),MAX_BODY=16*1024*1024,RETENTION_DAYS=30;
const jsonHeaders={'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Vary':'Origin'};
const ready=env=>!!(env.AI&&env.QUOTA&&env.TURNSTILE_SECRET_KEY&&String(env.RECEIPT_SECRET||'').length>=32&&String(env.QUOTA_SECRET||'').length>=32);
const leadsReady=env=>ready(env)&&!!(env.DB&&env.PRIVATE_IMAGES&&env.RETENTION_ENABLED==='true'&&String(env.ADMIN_TOKEN||'').length>=48);
async function hash(value){const data=typeof value==='string'?encoder.encode(value):value;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;const [x,y]=await Promise.all([hash(a),hash(b)]);let d=0;for(let i=0;i<x.length;i++)d|=x.charCodeAt(i)^y.charCodeAt(i);return d===0;}
async function hmac(secret,message){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(message)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function signReceipt(env,payload){const encoded=btoa(JSON.stringify(payload));return encoded+'.'+await hmac(env.RECEIPT_SECRET,encoded);}
export async function verifyReceipt(env,receipt){
 if(typeof receipt!=='string'||receipt.length>4096)throw Error('receipt');const [data,signature,...extra]=receipt.split('.');
 if(extra.length||!signature||!await equal(signature,await hmac(env.RECEIPT_SECRET,data)))throw Error('receipt');
 const payload=JSON.parse(atob(data));if(!Number.isFinite(payload.issued)||Date.now()-payload.issued>86400000||payload.issued>Date.now()+60000||!/^LX-\d{8}-[A-F0-9]{12}$/.test(payload.reference))throw Error('receipt');return payload;
}
export async function limitedJson(request){
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw Error('მოთხოვნის ფორმატი არასწორია.');
 if(Number(request.headers.get('Content-Length'))>MAX_BODY)throw Error('მოთხოვნა ძალიან დიდია.');
 const reader=request.body?.getReader();if(!reader)throw Error('მოთხოვნა ცარიელია.');const chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY){await reader.cancel();throw Error('მოთხოვნა ძალიან დიდია.');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let index=0;for(const chunk of chunks){bytes.set(chunk,index);index+=chunk.length;}return JSON.parse(new TextDecoder().decode(bytes));
}
export function validateImage(image,max=2*1024*1024){
 if(!image||image.mime_type!=='image/jpeg'||typeof image.data!=='string'||!image.data.length||image.data.length>Math.ceil(max/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(image.data))throw Error('აირჩიე სწორი JPG ფოტო.');
 const bytes=bytesFromBase64(image.data);if(bytes.byteLength>max||imageMime(bytes)!=='image/jpeg')throw Error('აირჩიე სწორი JPG ფოტო.');return bytes;
}
function storedImage(url,max){
 if(typeof url!=='string')throw Error('ფოტო არ არის მითითებული.');
 const match=url.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);if(!match||match[2].length>Math.ceil(max/3)*4)throw Error('ფოტოს ფორმატი ან ზომა არასწორია.');
 const bytes=bytesFromBase64(match[2]);if(bytes.byteLength>max||imageMime(bytes)!==match[1])throw Error('ფოტოს ფორმატი არასწორია.');return {bytes,mime:match[1]};
}
async function authorizeChallenge(request,env,token,fetcher){
 if(typeof token!=='string'||token.length>2048||!token)return false;
 const form=new FormData();form.append('secret',env.TURNSTILE_SECRET_KEY);form.append('response',token);const ip=request.headers.get('CF-Connecting-IP');if(ip)form.append('remoteip',ip);
 const response=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:form,signal:AbortSignal.timeout(10000)});if(!response.ok)return false;const data=await response.json();
 const hosts=(env.TURNSTILE_HOSTNAMES||'').split(',').map(s=>s.trim()).filter(Boolean);
 return data.success===true&&hosts.includes(data.hostname);
}
async function reserve(request,env){
 const ip=request.headers.get('CF-Connecting-IP');if(!ip)return false;
 const subject=await hmac(env.QUOTA_SECRET,ip);const response=await env.QUOTA.get(env.QUOTA.idFromName('exterior-global')).fetch('https://quota/reserve',{method:'POST',body:JSON.stringify({subject})});return response.ok;
}
export function createHandler({fetcher=fetch,provider=editExterior}={}){return async(request,env)=>{
 const url=new URL(request.url),path=url.pathname,origin=request.headers.get('Origin')||'';
 const origins=(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean),allowed=origins.includes(origin);
 const headers={...jsonHeaders,...(allowed?{'Access-Control-Allow-Origin':origin}:{})};const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 // curl and server callers without Origin can use authenticated admin routes only.
 const isAdmin=path.startsWith('/admin/');
 if(!allowed&&!(isAdmin&&!origin))return reply({error:'წვდომა შეზღუდულია.'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, PATCH, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600'}});
 if(path==='/capabilities'&&request.method==='GET')return reply({generation:ready(env),leads:leadsReady(env),retentionDays:RETENTION_DAYS,provider:'Cloudflare Workers AI'});
 if(isAdmin){
  if(!leadsReady(env))return reply({error:'მოთხოვნების სერვისი ჯერ არ არის გააქტიურებული.'},503);
  const authorization=request.headers.get('Authorization')||'';
  if(authorization.length>512||!authorization.startsWith('Bearer ')||!await equal(authorization.slice(7),env.ADMIN_TOKEN))return reply({error:'საჭიროა ადმინისტრატორის ავტორიზაცია.'},401);
  try{return await adminRoute(request,env,path,reply,headers);}catch{return reply({error:'ადმინისტრირების მოქმედება ვერ შესრულდა.'},500);}
 }
 if(path==='/generate'&&request.method==='POST'){
  if(!ready(env))return reply({error:'AI სერვისი ჯერ არ არის გააქტიურებული. ხელმისაწვდომია დემო.'},503);
  let input;
  try{const body=await limitedJson(request);const bytes=validateImage(body.image,1024*1024),size=jpegSize(bytes);if(Math.max(size.width,size.height)>500||Math.max(size.width,size.height)/Math.min(size.width,size.height)>3)throw Error('ფოტოს პროპორციები ან ზომა არ შეესაბამება AI სერვისს. აირჩიე ფასადის ჩვეულებრივი ფოტო.');if(body.consent!==true)throw Error('ფოტოს დამუშავებისთვის საჭიროა თანხმობა.');input={image:body.image,preferences:cleanPreferences(body.preferences),token:body.turnstileToken};}
  catch(error){return reply({error:error instanceof SyntaxError?'მონაცემები ვერ გაიხსნა.':error.message},400);}
  try{
   if(!await authorizeChallenge(request,env,input.token,fetcher))return reply({error:'უსაფრთხოების შემოწმება ვერ დასრულდა. სცადე ხელახლა.'},403);
   if(!await reserve(request,env))return reply({error:'გენერაციის ლიმიტი ამოიწურა ან ძალიან სწრაფად იმეორებ მოთხოვნას.'},429);
   const image=await provider(env,input);const reference='LX-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase();
   const issued=Date.now();const receipt=await signReceipt(env,{reference,issued,resultHash:await hash(bytesFromBase64(image.data)),preferencesHash:await hash(JSON.stringify(input.preferences))});
   return reply({reference,createdAt:new Date(issued).toISOString(),image,receipt});
  }catch{return reply({error:'ვიზუალიზაციის შექმნა ვერ დასრულდა. ახალი ცდის წინ გადაამოწმე სერვისის გამოყენება.'},502);}
 }
 if(path==='/leads'&&request.method==='POST'){
  if(!leadsReady(env))return reply({error:'მოთხოვნების გაგზავნა ჯერ არ არის გააქტიურებული.'},503);
  let data,receipt;
  try{
   const body=await limitedJson(request);receipt=await verifyReceipt(env,body.receipt);const contact=validateContact(body.contact),preferences=cleanPreferences(body.preferences);
   const original=storedImage(body.original,2*1024*1024),generated=storedImage(body.generated,8*1024*1024);
   if(original.mime!=='image/jpeg'||receipt.reference!==body.reference||receipt.resultHash!==await hash(generated.bytes)||receipt.preferencesHash!==await hash(JSON.stringify(preferences)))throw Error('ვიზუალიზაცია ან პარამეტრები არ ემთხვევა პროექტს.');
   data={contact,preferences,original,generated};
  }catch(error){return reply({error:error.message==='receipt'?'პროექტის სესია ვადაგასულია ან არასწორია. შექმენი ახალი ვიზუალიზაცია.':error instanceof SyntaxError?'მონაცემები ვერ გაიხსნა.':error.message},400);}
  const ref=receipt.reference,folder='leads/'+ref+'/',originalKey=folder+'original.jpg',generatedKey=folder+'generated.'+({ 'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[data.generated.mime]);
  try{
   const prior=await env.DB.prepare('SELECT reference, expires_at, ready FROM exterior_leads WHERE reference = ?').bind(ref).first();
   if(prior)return prior.expires_at<=Date.now()?reply({error:'პროექტის სესია ვადაგასულია.'},410):prior.ready?reply({reference:ref,accepted:true}):reply({error:'მოთხოვნა ჯერ მუშავდება. ცოტა ხანში გადაამოწმე.'},409);
   // An atomic D1 uniqueness reservation prevents repeated submissions from producing duplicate leads.
   const now=Date.now();const insert=await env.DB.prepare('INSERT OR IGNORE INTO exterior_leads (reference,contact,preferences,original_key,generated_key,created_at,expires_at,status,notes,consent_version,ready) VALUES (?,?,?,?,?,?,?,?,?,?,0)').bind(ref,JSON.stringify(data.contact),JSON.stringify(data.preferences),originalKey,generatedKey,now,now+RETENTION_DAYS*86400000,STATUSES[0],'','2026-11-02').run();
   if(!insert.meta?.changes)return reply({error:'მოთხოვნა უკვე მუშავდება. ცოტა ხანში გადაამოწმე პროექტის ნომრით.'},409);
   try{
    await env.PRIVATE_IMAGES.put(originalKey,data.original.bytes,{httpMetadata:{contentType:data.original.mime}});
    await env.PRIVATE_IMAGES.put(generatedKey,data.generated.bytes,{httpMetadata:{contentType:data.generated.mime}});
    await env.DB.prepare('UPDATE exterior_leads SET ready = 1 WHERE reference = ?').bind(ref).run();
   }catch{
    await env.PRIVATE_IMAGES.delete([originalKey,generatedKey]);await env.DB.prepare('DELETE FROM exterior_leads WHERE reference = ? AND ready = 0').bind(ref).run();throw Error('storage');
   }
   return reply({reference:ref,accepted:true},201);
  }catch{return reply({error:'მოთხოვნის შენახვა ვერ დასრულდა. სცადე მოგვიანებით.'},503);}
 }
 return reply({error:'გვერდი ან მეთოდი ვერ მოიძებნა.'},404);
};}
async function adminRoute(request,env,path,reply,headers){
 if(path==='/admin/leads'&&request.method==='GET'){
  const result=await env.DB.prepare('SELECT reference,contact,preferences,created_at,expires_at,status,notes FROM exterior_leads WHERE ready = 1 AND expires_at > ? ORDER BY created_at DESC LIMIT 100').bind(Date.now()).all();
  return reply({leads:result.results.map(row=>({...row,contact:JSON.parse(row.contact),preferences:JSON.parse(row.preferences)}))});
 }
 const match=path.match(/^\/admin\/leads\/(LX-\d{8}-[A-F0-9]{12})(?:\/(original|generated))?$/);
 if(!match)return reply({error:'მოთხოვნა ვერ მოიძებნა.'},404);
 const [,ref,image]=match;
 const row=await env.DB.prepare('SELECT * FROM exterior_leads WHERE reference = ? AND expires_at > ? AND ready = 1').bind(ref,Date.now()).first();
 if(!row)return reply({error:'მოთხოვნა ვერ მოიძებნა.'},404);
 if(image&&request.method==='GET'){
  const object=await env.PRIVATE_IMAGES.get(image==='original'?row.original_key:row.generated_key);if(!object)return reply({error:'ფოტო ვერ მოიძებნა.'},404);
  return new Response(object.body,{headers:{...headers,'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','Content-Disposition':'inline'}});
 }
 if(!image&&request.method==='PATCH'){
  const body=await limitedJson(request);if(!STATUSES.includes(body.status)||typeof body.notes!=='string'||body.notes.length>5000)return reply({error:'სტატუსი ან შენიშვნა არასწორია.'},400);
  await env.DB.prepare('UPDATE exterior_leads SET status = ?, notes = ? WHERE reference = ?').bind(body.status,body.notes,ref).run();return reply({updated:true,reference:ref});
 }
 if(!image&&request.method==='DELETE'){
  await env.PRIVATE_IMAGES.delete([row.original_key,row.generated_key]);await env.DB.prepare('DELETE FROM exterior_leads WHERE reference = ?').bind(ref).run();return reply({deleted:true,reference:ref});
 }
 return reply({error:'მეთოდი დაუშვებელია.'},405);
}
export async function deleteExpired(env){
 if(!env.DB||!env.PRIVATE_IMAGES)return;
 for(let page=0;page<10;page++){
  const batch=await env.DB.prepare('SELECT reference, original_key, generated_key FROM exterior_leads WHERE expires_at <= ? OR (ready = 0 AND created_at < ?) LIMIT 100').bind(Date.now(),Date.now()-3600000).all();
  if(!batch.results.length)return;
  for(const row of batch.results){await env.PRIVATE_IMAGES.delete([row.original_key,row.generated_key]);await env.DB.prepare('DELETE FROM exterior_leads WHERE reference = ?').bind(row.reference).run();}
 }
}
export class ExteriorQuota {
 constructor(state,env){this.state=state;this.env=env;}
 async fetch(request){
  let subject;try{subject=(await request.json()).subject;}catch{return new Response(null,{status:400});}
  if(!/^[a-f0-9]{64}$/.test(subject||''))return new Response(null,{status:400});
  const now=Date.now(),day=new Date(now).toISOString().slice(0,10),globalLimit=Math.max(1,Math.min(1000,Number(this.env.GLOBAL_DAILY_LIMIT)||50)),visitorLimit=Math.max(1,Math.min(20,Number(this.env.VISITOR_DAILY_LIMIT)||3));
  const accepted=await this.state.storage.transaction(async storage=>{
   const previous=await storage.get('usage');const record=previous?.day===day?previous:{day,total:0,visitors:{}};const visitor=record.visitors[subject]||{attempts:0,last:0};
   if(record.total>=globalLimit||visitor.attempts>=visitorLimit||now-visitor.last<30000)return false;
   record.total++;record.visitors[subject]={attempts:visitor.attempts+1,last:now};await storage.put('usage',record);return true;
  });return new Response(null,{status:accepted?204:429});
 }
}
export default {fetch:createHandler(),scheduled:(_event,env,ctx)=>ctx.waitUntil(deleteExpired(env))};

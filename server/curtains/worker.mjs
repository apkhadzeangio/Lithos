import {createOrder,STATUSES} from '../../dist/curtains/core.mjs';
const headersBase={'Content-Type':'application/json;charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
const ready=e=>!!(e.DB&&e.PRIVATE_IMAGES&&e.QUOTA&&e.TURNSTILE_SECRET_KEY&&e.QUOTA_SECRET?.length>=32&&e.ADMIN_TOKEN?.length>=48&&e.RETENTION_ENABLED==='true');
const refPattern=/^LC-\d{8}-[A-F0-9]{12}$/;
async function digest(value){return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));}
async function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;const [x,y]=await Promise.all([digest(a),digest(b)]);let difference=0;for(let i=0;i<x.length;i++)difference|=x[i]^y[i];return difference===0;}
export async function limitedJson(request){
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw Error('მოთხოვნის ფორმატი არასწორია.');const limit=7*1024*1024;
 if(Number(request.headers.get('Content-Length'))>limit)throw Error('ფოტოები ძალიან დიდია.');
 const reader=request.body?.getReader();if(!reader)throw Error('მოთხოვნა ცარიელია.');let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('ფოტოები ძალიან დიდია.');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const value of chunks){bytes.set(value,offset);offset+=value.length;}return JSON.parse(new TextDecoder().decode(bytes));
}
export function jpegData(value){
 const match=typeof value==='string'&&value.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/);
 if(!match||match[1].length>Math.ceil(2*1024*1024/3)*4)throw Error('საჭიროა მომზადებული JPG ფოტო, მაქსიმუმ 2 მბ.');
 const bytes=Uint8Array.from(atob(match[1]),c=>c.charCodeAt(0));if(bytes.length<10||bytes.length>2*1024*1024||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw Error('ფოტოს ფორმატი არასწორია.');return bytes;
}
async function verifyChallenge(request,env,token,fetcher){
 if(typeof token!=='string'||!token||token.length>2048)return false;
 const data=new FormData();data.append('secret',env.TURNSTILE_SECRET_KEY);data.append('response',token);const ip=request.headers.get('CF-Connecting-IP');if(ip)data.append('remoteip',ip);
 const response=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:data,signal:AbortSignal.timeout(10000)});if(!response.ok)return false;
 const result=await response.json();return result.success===true&&(env.TURNSTILE_HOSTNAMES||'').split(',').map(s=>s.trim()).includes(result.hostname);
}
async function reserve(request,env){
 const ip=request.headers.get('CF-Connecting-IP');if(!ip)return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.QUOTA_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const hash=[...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(ip)))].map(v=>v.toString(16).padStart(2,'0')).join('');
 return (await env.QUOTA.get(env.QUOTA.idFromName('curtain-orders')).fetch('https://quota/reserve',{method:'POST',body:JSON.stringify({subject:hash})})).ok;
}
export function createHandler(fetcher=fetch){return async(request,env)=>{
 const path=new URL(request.url).pathname,origin=request.headers.get('Origin')||'',allowed=(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).includes(origin)&&!!origin;
 const admin=path.startsWith('/admin/'),headers={...headersBase,...(allowed?{'Access-Control-Allow-Origin':origin}:{})},reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
 if(!allowed&&!(admin&&!origin))return reply({error:'წვდომა შეზღუდულია.'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, PATCH, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'}});
 if(path==='/capabilities'&&request.method==='GET')return reply({orders:ready(env),retentionDays:30});
 if(!ready(env))return reply({error:'შეკვეთების სერვისი ჯერ არ არის დაკავშირებული. გამოიყენე WhatsApp.'},503);
 if(admin){
  const auth=request.headers.get('Authorization')||'';if(auth.length>512||!auth.startsWith('Bearer ')||!await equal(auth.slice(7),env.ADMIN_TOKEN))return reply({error:'საჭიროა ადმინისტრატორის ავტორიზაცია.'},401);
  try{return await adminRoute(request,env,path,reply,headers);}catch{return reply({error:'მოქმედება ვერ შესრულდა.'},500);}
 }
 if(path!=='/orders'||request.method!=='POST')return reply({error:'გვერდი ან მეთოდი ვერ მოიძებნა.'},404);
 let order,original,preview,challenge;
 try{const body=await limitedJson(request);if(!refPattern.test(body.reference))throw Error('პროექტის ნომერი არასწორია.');order=createOrder(body.preferences,body.contact,body.reference);original=jpegData(body.original);preview=jpegData(body.preview);challenge=body.turnstileToken;}
 catch(error){return reply({error:error instanceof SyntaxError?'მონაცემები ვერ გაიხსნა.':error.message},400);}
 try{
  if(!await verifyChallenge(request,env,challenge,fetcher))return reply({error:'უსაფრთხოების შემოწმება ვერ დასრულდა.'},403);
  if(!await reserve(request,env))return reply({error:'მოთხოვნის ლიმიტი ამოიწურა. სცადე მოგვიანებით.'},429);
  const reference=order.reference,now=Date.now(),originalKey='curtains/'+reference+'/original.jpg',previewKey='curtains/'+reference+'/preview.jpg';
  const prior=await env.DB.prepare('SELECT reference,ready,expires_at FROM curtain_orders WHERE reference = ?').bind(reference).first();
  if(prior)return prior.ready&&prior.expires_at>now?reply({accepted:true,reference}):reply({error:'მოთხოვნა მუშავდება ან ვადა გასულია.'},409);
  const inserted=await env.DB.prepare('INSERT OR IGNORE INTO curtain_orders (reference,contact,preferences,fabric,created_at,expires_at,original_key,preview_key,status,notes,ready) VALUES (?,?,?,?,?,?,?,?,?,?,0)').bind(reference,JSON.stringify(order.contact),JSON.stringify(order.preferences),JSON.stringify(order.fabric),now,now+30*86400000,originalKey,previewKey,STATUSES[0],'').run();
  if(!inserted.meta?.changes)return reply({error:'მოთხოვნა უკვე მუშავდება.'},409);
  try{await env.PRIVATE_IMAGES.put(originalKey,original,{httpMetadata:{contentType:'image/jpeg'}});await env.PRIVATE_IMAGES.put(previewKey,preview,{httpMetadata:{contentType:'image/jpeg'}});await env.DB.prepare('UPDATE curtain_orders SET ready = 1 WHERE reference = ?').bind(reference).run();}
  catch{await env.PRIVATE_IMAGES.delete([originalKey,previewKey]);await env.DB.prepare('DELETE FROM curtain_orders WHERE reference = ? AND ready = 0').bind(reference).run();throw Error('storage');}
  return reply({accepted:true,reference},201);
 }catch{return reply({error:'მოთხოვნა ვერ შეინახა. სცადე მოგვიანებით.'},503);}
};}
async function adminRoute(request,env,path,reply,headers){
 if(path==='/admin/orders'&&request.method==='GET'){
  const result=await env.DB.prepare('SELECT reference,contact,preferences,fabric,created_at,status,notes FROM curtain_orders WHERE ready = 1 AND expires_at > ? ORDER BY created_at DESC LIMIT 100').bind(Date.now()).all();
  return reply({orders:result.results.map(row=>({...row,contact:JSON.parse(row.contact),preferences:JSON.parse(row.preferences),fabric:JSON.parse(row.fabric)}))});
 }
 const match=path.match(/^\/admin\/orders\/(LC-\d{8}-[A-F0-9]{12})(?:\/(original|preview))?$/);if(!match)return reply({error:'მოთხოვნა ვერ მოიძებნა.'},404);
 const [,reference,image]=match,row=await env.DB.prepare('SELECT * FROM curtain_orders WHERE reference = ? AND ready = 1 AND expires_at > ?').bind(reference,Date.now()).first();if(!row)return reply({error:'მოთხოვნა ვერ მოიძებნა.'},404);
 if(image&&request.method==='GET'){const object=await env.PRIVATE_IMAGES.get(image==='original'?row.original_key:row.preview_key);return object?new Response(object.body,{headers:{...headers,'Content-Type':'image/jpeg'}}):reply({error:'ფოტო ვერ მოიძებნა.'},404);}
 if(!image&&request.method==='PATCH'){const body=await limitedJson(request);if(!STATUSES.includes(body.status)||typeof body.notes!=='string'||body.notes.length>5000)return reply({error:'სტატუსი ან შენიშვნა არასწორია.'},400);await env.DB.prepare('UPDATE curtain_orders SET status = ?, notes = ? WHERE reference = ?').bind(body.status,body.notes,reference).run();return reply({updated:true,reference});}
 if(!image&&request.method==='DELETE'){await env.PRIVATE_IMAGES.delete([row.original_key,row.preview_key]);await env.DB.prepare('DELETE FROM curtain_orders WHERE reference = ?').bind(reference).run();return reply({deleted:true,reference});}
 return reply({error:'მეთოდი დაუშვებელია.'},405);
}
export async function cleanup(env){if(!env.DB||!env.PRIVATE_IMAGES)return;for(let i=0;i<10;i++){const rows=await env.DB.prepare('SELECT reference,original_key,preview_key FROM curtain_orders WHERE expires_at <= ? OR (ready = 0 AND created_at < ?) LIMIT 100').bind(Date.now(),Date.now()-3600000).all();if(!rows.results.length)return;for(const row of rows.results){await env.PRIVATE_IMAGES.delete([row.original_key,row.preview_key]);await env.DB.prepare('DELETE FROM curtain_orders WHERE reference = ?').bind(row.reference).run();}}}
export class CurtainQuota{
 constructor(state,env){this.state=state;this.env=env;}
 async fetch(request){let subject;try{subject=(await request.json()).subject;}catch{return new Response(null,{status:400});}if(!/^[a-f0-9]{64}$/.test(subject||''))return new Response(null,{status:400});
  const now=Date.now(),day=new Date(now).toISOString().slice(0,10),limit=Math.max(1,Math.min(100,Number(this.env.VISITOR_DAILY_LIMIT)||10)),global=Math.max(1,Math.min(1000,Number(this.env.GLOBAL_DAILY_LIMIT)||100));
  const accepted=await this.state.storage.transaction(async storage=>{let record=await storage.get('usage');if(record?.day!==day)record={day,total:0,visitors:{}};const visitor=record.visitors[subject]||{count:0,last:0};if(visitor.count>=limit||record.total>=global||now-visitor.last<5000)return false;record.visitors[subject]={count:visitor.count+1,last:now};record.total++;await storage.put('usage',record);return true;});return new Response(null,{status:accepted?204:429});
 }
}
export default {fetch:createHandler(),scheduled:(_event,env,ctx)=>ctx.waitUntil(cleanup(env))};

// Cloudflare-native AI image editing for LITHOS. No Google API key required.
// This is a prepared module: do not publish until test-access secret, quota binding and configuration are ready.
import catalog from './catalog.mjs';
import {designPrompt, dimensions} from '../../dist/designer/core.mjs';
const MODEL='@cf/black-forest-labs/flux-2-klein-4b';
const MAX_BODY=3*1024*1024;
const MAX_IMAGE=1024*1024;
const b64ToBytes=(b64)=>Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
function isJpeg(image){
  if(!image||image.mime_type!=='image/jpeg'||typeof image.data!=='string'
    ||image.data.length>Math.ceil(MAX_IMAGE/3)*4
    ||!(/^[A-Za-z0-9+/]+={0,2}$/).test(image.data)) return false;
  try{
    const data=b64ToBytes(image.data);
    return data.byteLength>10&&data.byteLength<=MAX_IMAGE
      &&data[0]===255&&data[1]===216&&data[2]===255;
  }catch{return false;}
}
function safeEqual(a,b){
  if(typeof a!=='string'||typeof b!=='string')return Promise.resolve(false);
  const encode=new TextEncoder();
  return Promise.all([crypto.subtle.digest('SHA-256',encode.encode(a)),crypto.subtle.digest('SHA-256',encode.encode(b))])
    .then(([x,y])=>{const l=new Uint8Array(x),r=new Uint8Array(y);let v=0;for(let i=0;i<l.length;i++)v|=l[i]^r[i];return v===0;});
}
async function parseBody(request){
  const len=Number(request.headers.get('content-length')||'0');
  if(len>MAX_BODY)throw Error('მოთხოვნა ძალიან დიდია.');
  const reader=request.body?.getReader();
  if(!reader)throw Error('მონაცემები არ არის გამოგზავნილი.');
  let count=0;const parts=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;count+=value.byteLength;if(count>MAX_BODY){await reader.cancel();throw Error('მოთხოვნა ძალიან დიდია.');}parts.push(value);}}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(count);let i=0;
  for(const part of parts){bytes.set(part,i);i+=part.length;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
function jpegBytes(image,label){
  if(!isJpeg(image))throw Error(label+' — ფოტო არასწორი ფორმატითაა.');
  return b64ToBytes(image.data);
}
function mimeFromBytes(bytes){
  if(bytes.length>8&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)return 'image/png';
  if(bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if(bytes.length>12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
  return null;
}
export function createHandler(){return async (request,env)=>{
  const origin=request.headers.get('Origin')||'';
  const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
  const headers={'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  if(allowed.includes(origin))headers['Access-Control-Allow-Origin']=origin;
  const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(!allowed.includes(origin))return reply({error:'წვდომა შეზღუდულია.'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600'}});
  if(new URL(request.url).pathname!=='/generate')return reply({error:'გვერდი ვერ მოიძებნა.'},404);
  if(request.method!=='POST')return reply({error:'მეთოდი დაუშვებელია.'},405);
  if(!env.AI||!env.TEST_ACCESS_TOKEN||env.TEST_ACCESS_TOKEN.length<32||!env.QUOTA)return reply({error:'Cloudflare AI გენერაცია ჯერ არ არის გააქტიურებული.'},503);
  const authorization=request.headers.get('Authorization')||'';
  if(authorization.length>512||!authorization.startsWith('Bearer ')||!await safeEqual(authorization.slice(7),env.TEST_ACCESS_TOKEN))return reply({error:'საცდელი წვდომის კოდი არასწორია.'},401);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply({error:'მოთხოვნის ფორმატი არასწორია.'},415);
  let input;
  try{
    const body=await parseBody(request);
    if(!body||!Object.hasOwn(catalog,body.materialId))throw Error('აირჩიეთ LITHOS-ის კატალოგის მასალა.');
    const dims=dimensions(body.dimensions||{});
    input={material:catalog[body.materialId],dims,kitchen:jpegBytes(body.image,'სამზარეულოს'),stone:jpegBytes(body.stoneImage,'ქვის ნიმუშის')};
  }catch(error){return reply({error:error instanceof SyntaxError?'მონაცემები ვერ გაიხსნა.':error.message},400);}
  try{
    // Reserve before inference; no paid/fallback retries.
    const quota=await env.QUOTA.get(env.QUOTA.idFromName('all-designer-attempts')).fetch('https://quota/reserve',{method:'POST'});
    if(!quota.ok)return reply({error:'დღიური ლიმიტი ამოწურულია ან ახალი მოთხოვნა ძალიან სწრაფად გაიგზავნა.'},429);
    const form=new FormData();
    form.append('prompt',designPrompt(input.material,input.dims));
    form.append('input_image_0',new Blob([input.kitchen],{type:'image/jpeg'}),'kitchen.jpg');
    form.append('input_image_1',new Blob([input.stone],{type:'image/jpeg'}),'stone.jpg');
    form.append('width','1024');form.append('height','768');
    const serialized=new Response(form);
    const result=await env.AI.run(MODEL,{multipart:{body:serialized.body,contentType:serialized.headers.get('content-type')}});
    if(typeof result?.image!=='string'||result.image.length>12*1024*1024)return reply({error:'მოდელმა გამოსადეგი გამოსახულება ვერ დააბრუნა.'},502);
    const raw=b64ToBytes(result.image);
    const mime=mimeFromBytes(raw);
    if(!mime)return reply({error:'მოდელის პასუხის ფორმატი ვერ დადასტურდა.'},502);
    return reply({image:{mime_type:mime,data:result.image},material:input.material.name,model:MODEL});
  }catch{
    return reply({error:'Cloudflare AI გენერაცია ვერ დასრულდა. გადაამოწმეთ მოდელის ხელმისაწვდომობა და ლიმიტი.'},502);
  }
};}
export default {fetch:createHandler()};
export class DesignerQuota{
  constructor(state,env){this.state=state;this.env=env;}
  async fetch(){
    const limit=Math.min(20,Math.max(1,Number(this.env.DAILY_ATTEMPT_LIMIT)||5));
    const now=Date.now(),day=new Date(now).toISOString().slice(0,10);
    const ok=await this.state.storage.transaction(async storage=>{
      const prev=await storage.get('count')||{},record=prev.day===day?prev:{day,attempts:0,last:0};
      if(record.attempts>=limit||now-record.last<30000)return false;
      await storage.put('count',{day,attempts:record.attempts+1,last:now});return true;
    });
    return new Response(null,{status:ok?204:429});
  }
}

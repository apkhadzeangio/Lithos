import catalog from './catalog.mjs';
import {designPrompt,dimensions} from '../../dist/designer/core.mjs';
const API='https://generativelanguage.googleapis.com/v1beta/interactions';
const MODEL='gemini-nano-banana-2.1';
const SKETCH_MODEL='gemini-2.5-flash';   /* override with the SKETCH_MODEL variable when Google retires it */
const MAX_BODY=3*1024*1024,MAX_IMAGE=2*1024*1024;
const safeImage=part=>part?.type==='image'&&['image/png','image/jpeg','image/webp'].includes(part.mime_type)&&typeof part.data==='string'&&part.data.length>0;
export function outputImage(data){
  if(data.status!=='completed')return null;
  return (data.steps||[]).filter(step=>step.type==='model_output').flatMap(step=>step.content||[]).find(safeImage)||null;
}
export function validateInput(body){
  if(!body||typeof body!=='object'||!Object.hasOwn(catalog,body.materialId))throw Error('აირჩიეთ მასალა LITHOS-ის კატალოგიდან.');
  const d=dimensions(body.dimensions||{}),image=body.image;
  if(!image||image.mime_type!=='image/jpeg'||typeof image.data!=='string'||!image.data.length||image.data.length>Math.ceil(MAX_IMAGE/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(image.data))throw Error('აირჩიეთ მომზადებული სამზარეულოს ფოტო.');
  let decoded;try{decoded=atob(image.data);}catch{throw Error('ფოტო ვერ გაიხსნა.');}
  if(decoded.length>MAX_IMAGE||decoded.charCodeAt(0)!==255||decoded.charCodeAt(1)!==216||decoded.charCodeAt(2)!==255)throw Error('აირჩიეთ სწორი JPG ფოტო.');
  return {material:catalog[body.materialId],dimensions:d,image:{type:'image',mime_type:'image/jpeg',data:image.data}};
}
/* ---- photo of one wall → draft sketch features. Dimensions are estimates scaled from the wall length the user measured. ---- */
const SKETCH_TYPES=['window','door','column','beam','radiator','water','gas','vent'];
const SKETCH_WALLS=['back','left','right'];
const SKETCH_SCHEMA={type:'OBJECT',properties:{features:{type:'ARRAY',items:{type:'OBJECT',properties:{type:{type:'STRING',enum:SKETCH_TYPES},x:{type:'NUMBER'},w:{type:'NUMBER'},d:{type:'NUMBER'},h:{type:'NUMBER'},sill:{type:'NUMBER'},confidence:{type:'NUMBER'}},required:['type','x','confidence']}},notes:{type:'STRING'}},required:['features']};
export function sketchPrompt(len,height){
  return ['You are helping a kitchen designer draft a room plan from a photo.',
    `The photo shows ONE wall of the room, corner to corner. That wall is ${len} cm long${height?`, the ceiling is ${height} cm high`:''}. Use this length to scale everything you measure.`,
    'List only these elements that are really visible on THIS wall: window, door, column (a vertical pilaster or column protruding from the wall), beam (a ceiling beam running along or across the wall), radiator, water (water supply or drain pipe outlet), gas (gas pipe or valve), vent (ventilation duct opening).',
    'For every element give: type; x = distance in cm from the LEFT end of the wall as seen in the photo to the element\'s left edge (for water, gas and vent: to its centre); w = width in cm.',
    'Windows: sill = height of the sill above the floor, h = opening height. Doors: h = opening height. Columns: d = how far it protrudes from the wall. Beams: d = protrusion from the wall, h = how far it hangs below the ceiling. Radiators: h = height, d = thickness.',
    'confidence = 0 to 1. Do not invent elements, do not report furniture or appliances. Put any doubt in notes, in one short sentence.'].join('\n');
}
export function validateSketch(body){
  if(!body||typeof body!=='object'||!SKETCH_WALLS.includes(body.wall))throw Error('აირჩიეთ კედელი.');
  const len=Number(body.wallLen),height=body.roomH==null?null:Number(body.roomH);
  if(!Number.isFinite(len)||len<100||len>1500)throw Error('ჩაწერეთ კედლის სიგრძე (100–1500 სმ).');
  if(height!=null&&(!Number.isFinite(height)||height<200||height>450))throw Error('ჭერის სიმაღლე არასწორია.');
  const image=body.image;
  if(!image||image.mime_type!=='image/jpeg'||typeof image.data!=='string'||!image.data.length||image.data.length>Math.ceil(MAX_IMAGE/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(image.data))throw Error('აირჩიეთ კედლის ფოტო.');
  let decoded;try{decoded=atob(image.data);}catch{throw Error('ფოტო ვერ გაიხსნა.');}
  if(decoded.length>MAX_IMAGE||decoded.charCodeAt(0)!==255||decoded.charCodeAt(1)!==216||decoded.charCodeAt(2)!==255)throw Error('აირჩიეთ სწორი JPG ფოტო.');
  return {wall:body.wall,len:Math.round(len),height:height==null?null:Math.round(height),image:image.data};
}
/* never trust model output: whitelist types, clamp every number into the wall, cap the count */
export function cleanSketch(raw,len){
  const num=(v,lo,hi,def)=>{const n=Number(v);return Number.isFinite(n)?Math.min(hi,Math.max(lo,Math.round(n))):def;};
  const list=Array.isArray(raw?.features)?raw.features:[];
  const features=[];
  for(const f of list.slice(0,24)){
    if(!f||!SKETCH_TYPES.includes(f.type))continue;
    const point=['water','gas','vent'].includes(f.type),g={t:f.type,x:num(f.x,0,len,0),conf:Math.min(1,Math.max(0,Number(f.confidence)||0))};
    if(!point){g.w=num(f.w,10,len,f.type==='door'?90:f.type==='window'?120:40);if(g.x+g.w>len)g.x=Math.max(0,len-g.w);}
    if(f.type==='window'){g.sill=num(f.sill,0,250,105);g.h=num(f.h,20,300,140);}
    if(f.type==='door')g.h=num(f.h,150,300,210);
    if(f.type==='column')g.d=num(f.d,5,200,30);
    if(f.type==='beam'){g.d=num(f.d,5,300,40);g.h=num(f.h,5,120,30);}
    if(f.type==='radiator'){g.h=num(f.h,20,120,60);g.d=num(f.d,5,25,10);}
    features.push(g);
    if(features.length>=16)break;
  }
  return {features,notes:typeof raw?.notes==='string'?raw.notes.slice(0,300):''};
}
async function equalSecret(a,b){
  const encoder=new TextEncoder(),hash=async value=>new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
  const [x,y]=await Promise.all([hash(a),hash(b)]);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;
}
async function limitedBody(request){
  if(Number(request.headers.get('Content-Length'))>MAX_BODY)throw Error('ფოტო ძალიან დიდია.');
  const reader=request.body?.getReader();if(!reader)throw Error('მონაცემები არ არის გამოგზავნილი.');
  let total=0;const chunks=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_BODY){await reader.cancel();throw Error('ფოტო ძალიან დიდია.');}chunks.push(value);}}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
export function createHandler(fetcher=fetch){return async(request,env)=>{
  const origin=request.headers.get('Origin')||'',allowed=(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim());
  const headers={'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin','Access-Control-Allow-Origin':allowed.includes(origin)?origin:'https://lithos.ge'};
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
  if(!allowed.includes(origin))return reply({error:'წვდომა შეზღუდულია.'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600'}});
  const path=new URL(request.url).pathname;
  if(path!=='/generate'&&path!=='/sketch')return reply({error:'გვერდი ვერ მოიძებნა.'},404);
  if(request.method!=='POST')return reply({error:'მოთხოვნის მეთოდი დაუშვებელია.'},405);
  if(!env.GEMINI_API_KEY||!env.TEST_ACCESS_TOKEN||env.TEST_ACCESS_TOKEN.length<32||!env.QUOTA)return reply({error:'ავტომატური გენერაცია ჯერ ჩართული არ არის.'},503);
  const authorization=request.headers.get('Authorization')||'';
  if(authorization.length>512||!authorization.startsWith('Bearer ')||!await equalSecret(authorization.slice(7),env.TEST_ACCESS_TOKEN))return reply({error:'საცდელი წვდომის კოდი არასწორია.'},401);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply({error:'მოთხოვნის ფორმატი არასწორია.'},415);
  if(path==='/sketch'){
    let input;try{input=validateSketch(await limitedBody(request));}catch(error){return reply({error:error instanceof SyntaxError?'მონაცემები ვერ გაიხსნა.':error.message},400);}
    try{
      const quota=await env.QUOTA.get(env.QUOTA.idFromName('all-designer-attempts')).fetch('https://quota/reserve',{method:'POST'});
      if(!quota.ok)return reply({error:'საცდელი მოთხოვნების ლიმიტი ამოიწურა ან ძალიან სწრაფად იმეორებთ. მოგვიანებით სცადეთ.'},429);
      const model=env.SKETCH_MODEL||SKETCH_MODEL;
      const body={contents:[{role:'user',parts:[{text:sketchPrompt(input.len,input.height)},{inline_data:{mime_type:'image/jpeg',data:input.image}}]}],generationConfig:{responseMimeType:'application/json',responseSchema:SKETCH_SCHEMA,temperature:0.1}};
      const upstream=await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
      if(!upstream.ok)return reply({error:upstream.status===429?'AI სერვისის ლიმიტი ამოიწურა. მოგვიანებით სცადეთ.':'AI სერვისმა ფოტო ვერ დაამუშავა.'},502);
      const data=await upstream.json(),text=(data.candidates?.[0]?.content?.parts||[]).map(p=>typeof p.text==='string'?p.text:'').join('');
      let raw;try{raw=JSON.parse(text);}catch{return reply({error:'AI-ს პასუხი ვერ წავიკითხეთ. სცადეთ სხვა ფოტო.'},502);}
      return reply({wall:input.wall,wallLen:input.len,...cleanSketch(raw,input.len),model});
    }catch{return reply({error:'ფოტოს ამოცნობა ვერ დასრულდა.'},502);}
  }
  let input;try{input=validateInput(await limitedBody(request));}catch(error){return reply({error:error instanceof SyntaxError?'მონაცემები ვერ გაიხსნა.':error.message},400);}
  try{
    // Atomic reservation is made before the paid request, including failed attempts.
    const quota=await env.QUOTA.get(env.QUOTA.idFromName('all-designer-attempts')).fetch('https://quota/reserve',{method:'POST'});
    if(!quota.ok)return reply({error:'საცდელი გენერაციების ლიმიტი ამოიწურა ან ძალიან სწრაფად იმეორებთ მოთხოვნას. მოგვიანებით სცადეთ.'},429);
    const slab=await fetcher('https://lithos.ge/'+input.material.image,{signal:AbortSignal.timeout(20000)});
    if(!slab.ok)throw Error('reference');
    const bytes=new Uint8Array(await slab.arrayBuffer());if(bytes.length>MAX_IMAGE)throw Error('reference-size');
    let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    const body={model:MODEL,store:false,input:[{type:'text',text:designPrompt(input.material,input.dimensions)},input.image,{type:'image',mime_type:'image/webp',data:btoa(binary)}],response_format:{type:'image',mime_type:'image/png',image_size:'1K'},generation_config:{thinking_level:'minimal'}};
    const upstream=await fetcher(API,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},body:JSON.stringify(body),signal:AbortSignal.timeout(120000)});
    // No automatic retries. Do not expose upstream bodies, secrets, prompts or images in logs.
    if(!upstream.ok)return reply({error:upstream.status===429?'AI სერვისის ლიმიტი ამოიწურა. მოგვიანებით სცადეთ.':'AI სერვისმა მოთხოვნა ვერ შეასრულა. გადაამოწმეთ API-ზე წვდომა და გადახდის პარამეტრები.'},502);
    const image=outputImage(await upstream.json());
    if(!image)return reply({error:'AI სერვისმა გამოსადეგი ვიზუალიზაცია ვერ დააბრუნა. ავტომატური განმეორებითი ცდა არ შესრულებულა.'},502);
    return reply({image:{mime_type:image.mime_type,data:image.data},material:input.material.name,model:MODEL});
  }catch{return reply({error:'გენერაცია ვერ დასრულდა. ხელახლა ცდამდე გადაამოწმეთ სერვისის გამოყენება.'},502);}
};}
export default {fetch:createHandler()};
export class DesignerQuota{
  constructor(state,env){this.state=state;this.env=env;}
  async fetch(){
    const limit=Math.min(100,Math.max(1,Number(this.env.DAILY_ATTEMPT_LIMIT)||20));
    const now=Date.now(),day=new Date(now).toISOString().slice(0,10);
    const ok=await this.state.storage.transaction(async storage=>{
      const old=await storage.get('count')||{},record=old.day===day?old:{day,attempts:0,last:0};
      if(record.attempts>=limit||now-record.last<30000)return false;
      await storage.put('count',{day,attempts:record.attempts+1,last:now});return true;
    });
    return new Response(null,{status:ok?204:429});
  }
}

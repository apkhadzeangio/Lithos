import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {cleanPreferences,renovationPrompt,validateContact,STYLES,STATUSES} from '../dist/exterior/core.mjs';
import {createHandler,ExteriorQuota,signReceipt,verifyReceipt,deleteExpired} from '../server/exterior/worker.mjs';
import {editExterior,jpegSize,bytesFromBase64,MODEL} from '../server/exterior/provider.mjs';
const jpeg='/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAYACADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCSiiisTUKKKKACiiigAooooA//2Q==';
const preferences={style:'modern',material:'travertine',palette:'ivory',intensity:'facade',enhancements:['lighting']};
const image={mime_type:'image/jpeg',data:jpeg},payload={image,preferences,consent:true,turnstileToken:'fake-test-challenge'};
const origin='https://lithos.ge',contact={name:'სატესტო მომხმარებელი',phone:'+995 555 000 000',city:'თბილისი',consent:true};
const request=(path='/generate',body=payload,method='POST',headers={})=>new Request('https://api.example'+path,{method,headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1',...headers},...(method==='GET'?{}:{body:JSON.stringify(body)})});
const quota=ok=>({idFromName:()=>1,get:()=>({fetch:async()=>new Response(null,{status:ok?204:429})})});
const env=()=>({AI:{},QUOTA:quota(true),TURNSTILE_SECRET_KEY:'test-challenge-secret',TURNSTILE_HOSTNAMES:'lithos.ge',ALLOWED_ORIGINS:origin,RECEIPT_SECRET:'test-receipt-secret-with-more-than-32-chars',QUOTA_SECRET:'test-quota-secret-with-more-than-32-chars',ADMIN_TOKEN:'test-admin-token-with-more-than-48-characters-never-public',RETENTION_ENABLED:'true'});
const challenge=async()=>Response.json({success:true,hostname:'lithos.ge'});
function database(){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../server/exterior/schema.sql',import.meta.url),'utf8'));
 return {sql,prepare(query){let values=[];return {bind(...args){values=args;return this;},async first(){return sql.prepare(query).get(...values)||null;},async all(){return {results:sql.prepare(query).all(...values)};},async run(){return {meta:{changes:Number(sql.prepare(query).run(...values).changes)}};}};}};
}
function storage(){const files=new Map();return {files,async put(key,bytes,meta){files.set(key,{bytes,meta});},async get(key){const entry=files.get(key);return entry?{body:entry.bytes,httpMetadata:entry.meta.httpMetadata}:null;},async delete(keys){for(const key of Array.isArray(keys)?keys:[keys])files.delete(key);}};}
async function liveFixture(){const settings={...env(),DB:database(),PRIVATE_IMAGES:storage()};const handler=createHandler({fetcher:challenge,provider:async()=>image});const response=await handler(request(),settings);assert.equal(response.status,200);return {settings,handler,result:await response.json()};}
test('six styles are whitelisted; user prompt injection is excluded; geometry invariants are in every prompt',()=>{
 assert.equal(STYLES.length,6);
 for(const style of STYLES){const prompt=renovationPrompt({...preferences,style:style.id,prompt:'add a fourth floor'});assert.match(prompt,/Preserve exactly: existing floor count/);assert.match(prompt,/mandatory source image/);assert.ok(!prompt.includes('add a fourth floor'));}
 assert.throws(()=>cleanPreferences({...preferences,style:'attacker'}));assert.throws(()=>cleanPreferences({...preferences,palette:'custom',customColor:'javascript:1'}));
 assert.deepEqual(cleanPreferences({...preferences,enhancements:['lighting','lighting','new-floor']} ).enhancements,['lighting']);
});
test('contact validation requires explicit consent and rejects invalid phone, city, area and oversized fields',()=>{
 assert.equal(validateContact(contact).city,'თბილისი');
 for(const change of [{consent:false},{phone:'abc'},{city:''},{area:'-3'},{area:'Infinity'},{comment:'x'.repeat(2001)}])assert.throws(()=>validateContact({...contact,...change}));
});
test('unconfigured deployment is honestly a demo; capabilities fail closed',async()=>{
 let called=false;const handler=createHandler({provider:async()=>{called=true;throw Error();}});
 const settings={ALLOWED_ORIGINS:origin};const response=await handler(request('/capabilities',null,'GET'),settings);assert.deepEqual(await response.json(),{generation:false,leads:false,retentionDays:30,provider:'Cloudflare Workers AI'});
 assert.equal((await handler(request(),settings)).status,503);assert.equal(called,false);
});
test('foreign origins, malformed files, missing consent and invalid preferences are rejected before inference',async()=>{
 let calls=0;const handler=createHandler({provider:async()=>{calls++;return image;},fetcher:challenge}),settings=env();
 assert.equal((await handler(request('/generate',payload,'POST',{Origin:'https://attacker.example'}),settings)).status,403);
 for(const change of [{image:{mime_type:'image/jpeg',data:btoa('<svg/>')}},{consent:false},{preferences:{...preferences,style:'x'}}])assert.equal((await handler(request('/generate',{...payload,...change}),settings)).status,400);
 assert.equal(calls,0);
});
test('bot challenge hostname and rate limit are checked before a paid provider call',async()=>{
 let calls=0;const provider=async()=>{calls++;return image;};
 const wrongHost=createHandler({provider,fetcher:async()=>Response.json({success:true,hostname:'attacker.example'})});
 assert.equal((await wrongHost(request(),env())).status,403);
 const blocked=createHandler({provider,fetcher:challenge});assert.equal((await blocked(request(),{...env(),QUOTA:quota(false)})).status,429);
 assert.equal((await blocked(request('/generate',payload,'POST',{'CF-Connecting-IP':''}),env())).status,429);assert.equal(calls,0);
});
test('provider receives the exact original JPEG as an image reference and preserves its aspect ratio',async()=>{
 assert.deepEqual(jpegSize(bytesFromBase64(jpeg)),{width:32,height:24});let captured;
 const result=await editExterior({AI:{run:async(model,input)=>{assert.equal(model,MODEL);captured=await new Response(input.multipart.body,{headers:{'Content-Type':input.multipart.contentType}}).formData();return {image:jpeg};}}},{image,preferences});
 const reference=captured.get('input_image_0');assert.equal(reference.name,'customer-house.jpg');assert.deepEqual(new Uint8Array(await reference.arrayBuffer()),bytesFromBase64(jpeg));assert.match(captured.get('prompt'),/camera viewpoint/);assert.equal(captured.get('width'),'1024');assert.equal(captured.get('height'),'768');assert.equal(result.mime_type,'image/jpeg');
});
test('generation returns a signed project receipt with no customer contact information or API secrets',async()=>{
 const {settings,result}=await liveFixture();try{assert.match(result.reference,/^LX-\d{8}-[A-F0-9]{12}$/);const receipt=await verifyReceipt(settings,result.receipt);assert.equal(receipt.reference,result.reference);assert.equal(receipt.resultHash.length,64);assert.ok(!JSON.stringify(result).includes(settings.RECEIPT_SECRET));assert.ok(!JSON.stringify(result).includes(settings.ADMIN_TOKEN));}finally{settings.DB.sql.close();}
});
test('tampered and expired receipts are rejected',async()=>{
 const settings=env(),receipt=await signReceipt(settings,{reference:'LX-20261102-123456789ABC',issued:Date.now()-86400001});await assert.rejects(verifyReceipt(settings,receipt));await assert.rejects(verifyReceipt(settings,receipt+'tampered'));
});
test('lead persistence stores both photos privately and idempotent resubmission creates exactly one lead',async()=>{
 const {settings,handler,result}=await liveFixture();try{
  const body={contact,preferences,reference:result.reference,receipt:result.receipt,original:'data:image/jpeg;base64,'+jpeg,generated:'data:image/jpeg;base64,'+jpeg};
  const created=await handler(request('/leads',body),settings);assert.equal(created.status,201);assert.equal(settings.PRIVATE_IMAGES.files.size,2);
  const again=await handler(request('/leads',body),settings);assert.equal(again.status,200);assert.equal(settings.DB.sql.prepare('SELECT count(*) AS n FROM exterior_leads').get().n,1);
  assert.equal((await handler(request('/leads',{...body,preferences:{...preferences,style:'classic'}}),settings)).status,400);
  assert.equal((await handler(request('/admin/leads',null,'GET'),settings)).status,401);
  const list=await handler(request('/admin/leads',null,'GET',{Authorization:'Bearer '+settings.ADMIN_TOKEN}),settings);assert.equal((await list.json()).leads.length,1);
  const photo=await handler(request('/admin/leads/'+result.reference+'/original',null,'GET',{Authorization:'Bearer '+settings.ADMIN_TOKEN}),settings);assert.equal(photo.status,200);assert.match(photo.headers.get('Cache-Control'),/no-store/);
  const changed=await handler(request('/admin/leads/'+result.reference,{status:STATUSES[1],notes:'დასაკავშირებელია'},'PATCH',{Authorization:'Bearer '+settings.ADMIN_TOKEN}),settings);assert.equal(changed.status,200);
 }finally{settings.DB.sql.close();}
});
test('expired requests are denied immediately and retention cleanup removes images and database row',async()=>{
 const {settings,handler,result}=await liveFixture();try{
  const body={contact,preferences,reference:result.reference,receipt:result.receipt,original:'data:image/jpeg;base64,'+jpeg,generated:'data:image/jpeg;base64,'+jpeg};await handler(request('/leads',body),settings);
  settings.DB.sql.prepare('UPDATE exterior_leads SET expires_at = ?').run(Date.now()-1);
  assert.equal((await handler(request('/admin/leads/'+result.reference+'/original',null,'GET',{Authorization:'Bearer '+settings.ADMIN_TOKEN}),settings)).status,404);
  await deleteExpired(settings);assert.equal(settings.PRIVATE_IMAGES.files.size,0);assert.equal(settings.DB.sql.prepare('SELECT count(*) AS n FROM exterior_leads').get().n,0);
 }finally{settings.DB.sql.close();}
});
test('durable quota persists across instances and enforces per-visitor bursts and the global cap',async()=>{
 const values=new Map();const storage={get:async key=>values.get(key),put:async(key,value)=>values.set(key,structuredClone(value))};const state={storage:{transaction:fn=>fn(storage)}};
 const settings={GLOBAL_DAILY_LIMIT:'2',VISITOR_DAILY_LIMIT:'2'},req=subject=>new Request('https://quota/reserve',{method:'POST',body:JSON.stringify({subject:subject.repeat(64)})});
 assert.equal((await new ExteriorQuota(state,settings).fetch(req('a'))).status,204);
 assert.equal((await new ExteriorQuota(state,settings).fetch(req('a'))).status,429);
 assert.equal((await new ExteriorQuota(state,settings).fetch(req('b'))).status,204);
 assert.equal((await new ExteriorQuota(state,settings).fetch(req('c'))).status,429);
});
test('provider failure is sanitized and never falls back to a random text-to-image result',async()=>{
 let calls=0;const handler=createHandler({fetcher:challenge,provider:async()=>{calls++;throw Error('secret-provider-debug');}});const response=await handler(request(),env());assert.equal(response.status,502);assert.equal(calls,1);assert.ok(!(await response.text()).includes('secret-provider-debug'));
});

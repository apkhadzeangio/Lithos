import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {readFile,rm,stat} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {FABRICS,DESIGNS,DEFAULTS,normalizePreferences,estimate,createOrder,orderMessage,curtainPrompt} from '../dist/curtains/core.mjs';
import {createHandler,CurtainQuota,cleanup} from '../server/curtains/worker.mjs';
import {editCurtainImage} from '../server/curtains/image-provider.mjs';
import {buildFarda} from '../scripts/build-farda.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),origin='https://farda.lithos.ge';
const contact={name:'სატესტო მომხმარებელი',phone:'+995 555 000 000',city:'თბილისი',consent:true};
const reference='LC-20261102-123456ABCDEF';
const jpeg='data:image/jpeg;base64,'+btoa('\xff\xd8\xff\xe0'+'test-image-bytes');
const body={reference,preferences:DEFAULTS,contact,original:jpeg,preview:jpeg,turnstileToken:'test-token'};
const request=(path='/orders',data=body,method='POST',headers={})=>new Request('https://api.example'+path,{method,headers:{Origin:origin,'CF-Connecting-IP':'192.0.2.1','Content-Type':'application/json',...headers},...(method==='GET'?{}:{body:JSON.stringify(data)})});
const quota=ok=>({idFromName:()=>1,get:()=>({fetch:async()=>new Response(null,{status:ok?204:429})})});
function settings(){const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(resolve(root,'server/curtains/schema.sql'),'utf8'));const files=new Map();return {sql,files,ALLOWED_ORIGINS:origin,TURNSTILE_HOSTNAMES:'farda.lithos.ge',TURNSTILE_SECRET_KEY:'test-secret',QUOTA_SECRET:'test-quota-secret-at-least-32-characters',ADMIN_TOKEN:'test-admin-token-with-at-least-48-characters-not-real',RETENTION_ENABLED:'true',QUOTA:quota(true),DB:{prepare(query){let args=[];return {bind(...values){args=values;return this;},async first(){return sql.prepare(query).get(...args)||null;},async all(){return {results:sql.prepare(query).all(...args)};},async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}};}};}},PRIVATE_IMAGES:{async put(key,data){files.set(key,data);},async get(key){return files.has(key)?{body:files.get(key)}:null;},async delete(keys){for(const key of Array.isArray(keys)?keys:[keys])files.delete(key);}}};}
const challenge=async()=>Response.json({success:true,hostname:'farda.lithos.ge'});
test('eight real model records retain supplier IDs, source links and photographs without invented stock or price',()=>{
 assert.equal(FABRICS.length,8);assert.equal(new Set(FABRICS.map(f=>f.productId)).size,8);
 for(const f of FABRICS){assert.match(f.productId,/^\d+$/);assert.equal(new URL(f.sourceUrl).hostname,'mefarde.ge');assert.equal(f.price,null);assert.equal(f.availability,'confirm-with-supplier');assert.ok(existsSync(resolve(root,'dist/curtains',f.image)));}
});
test('all six designs normalize and invalid dimensions, fabricated products and out-of-image placement are rejected',()=>{
 assert.equal(DESIGNS.length,6);for(const d of DESIGNS)assert.equal(normalizePreferences({...DEFAULTS,design:d.id}).design,d.id);
 for(const change of [{fabric:'invented'},{design:'x'},{widthCm:-1},{heightCm:'Infinity'},{fullness:100},{box:{x:.9,y:0,w:.9,h:1}}])assert.throws(()=>normalizePreferences({...DEFAULTS,...change}));
 assert.equal(normalizePreferences({...DEFAULTS,widthCm:'280,5'}).widthCm,280.5);
});
test('material estimate reports spread width, never a price, and flags supplier height limitations',()=>{
 assert.deepEqual(estimate({...DEFAULTS,fabric:'basel',heightCm:300}),{spreadWidthM:6.16,heightWarning:true,fabricMaxHeightCm:280,price:null});
});
test('order message carries actual model identity, consented contact, selections and a clear confirmation requirement',()=>{
 const order=createOrder({...DEFAULTS,design:'layered',colorWish:'ზეთისხილისფერი'},contact,reference),message=orderMessage(order);
 assert.equal(order.status,'draft');assert.equal(order.visualization,'2d-concept');assert.ok(order.sheer);assert.ok(message.includes(order.fabric.productId));assert.ok(message.includes('დასადასტურებელია'));assert.ok(message.includes('ზეთისხილისფერი'));
 for(const c of [{...contact,consent:false},{...contact,phone:'abc'},{...contact,city:''}])assert.throws(()=>createOrder(DEFAULTS,c,reference));
});
test('optional image provider requires two image references and uses canonical geometry-preserving instructions',async()=>{
 let form;const env={AI:{run:async(_model,input)=>{form=await new Response(input.multipart.body,{headers:{'Content-Type':input.multipart.contentType}}).formData();return {image:'test'};}}};
 await assert.rejects(editCurtainImage(env,{windowPhoto:new Blob(['window']),preferences:DEFAULTS}));
 await editCurtainImage(env,{windowPhoto:new Blob(['window']),fabricPhoto:new Blob(['fabric']),preferences:DEFAULTS});assert.equal(await form.get('input_image_0').text(),'window');assert.equal(await form.get('input_image_1').text(),'fabric');assert.match(form.get('prompt'),/Preserve the exact room/);assert.ok(!curtainPrompt({...DEFAULTS,prompt:'replace the whole room'}).includes('replace the whole room'));
});
test('disabled and foreign-origin order services fail closed before storing data',async()=>{
 const handler=createHandler(challenge);assert.equal((await handler(request(),{ALLOWED_ORIGINS:origin})).status,503);assert.equal((await handler(request(),{})).status,403);
 const response=await handler(request('/capabilities',null,'GET'),{ALLOWED_ORIGINS:origin});assert.equal((await response.json()).orders,false);
});
test('malformed photos, missing consent and wrong challenge host are rejected before persistence',async()=>{
 const env=settings(),handler=createHandler(challenge);try{
  for(const invalid of [{...body,original:'data:image/svg+xml;base64,AA=='},{...body,contact:{...contact,consent:false}}])assert.equal((await handler(request('/orders',invalid),env)).status,400);
  const wrong=createHandler(async()=>Response.json({success:true,hostname:'attacker.example'}));assert.equal((await wrong(request(),env)).status,403);assert.equal(env.files.size,0);
 }finally{env.sql.close();}
});
test('rate limits reject requests before any photo is stored',async()=>{const env=settings();try{env.QUOTA=quota(false);assert.equal((await createHandler(challenge)(request(),env)).status,429);assert.equal(env.files.size,0);}finally{env.sql.close();}});
test('private order persistence is idempotent, photos require admin auth, and expiration deletes both photos',async()=>{
 const env=settings(),handler=createHandler(challenge);try{
  assert.equal((await handler(request(),env)).status,201);assert.equal((await handler(request(),env)).status,200);assert.equal(env.files.size,2);assert.equal(env.sql.prepare('SELECT count(*) AS n FROM curtain_orders').get().n,1);
  assert.equal((await handler(request('/admin/orders',null,'GET'),env)).status,401);
  const adminHeaders={Authorization:'Bearer '+env.ADMIN_TOKEN};const list=await handler(request('/admin/orders',null,'GET',adminHeaders),env);assert.equal((await list.json()).orders.length,1);
  const image=await handler(request('/admin/orders/'+reference+'/preview',null,'GET',adminHeaders),env);assert.equal(image.status,200);assert.match(image.headers.get('Cache-Control'),/no-store/);
  env.sql.prepare('UPDATE curtain_orders SET expires_at = ?').run(Date.now()-1);assert.equal((await handler(request('/admin/orders/'+reference+'/preview',null,'GET',adminHeaders),env)).status,404);await cleanup(env);assert.equal(env.files.size,0);assert.equal(env.sql.prepare('SELECT count(*) AS n FROM curtain_orders').get().n,0);
 }finally{env.sql.close();}
});
test('atomic quota persists across instances and blocks rapid or global excess requests',async()=>{
 const map=new Map(),storage={get:async k=>map.get(k),put:async(k,v)=>map.set(k,structuredClone(v))},state={storage:{transaction:fn=>fn(storage)}},env={GLOBAL_DAILY_LIMIT:'2'};
 const req=c=>new Request('https://quota/reserve',{method:'POST',body:JSON.stringify({subject:c.repeat(64)})});
 assert.equal((await new CurtainQuota(state,env).fetch(req('a'))).status,204);assert.equal((await new CurtainQuota(state,env).fetch(req('a'))).status,429);assert.equal((await new CurtainQuota(state,env).fetch(req('b'))).status,204);assert.equal((await new CurtainQuota(state,env).fetch(req('c'))).status,429);
});
test('dedicated farda root build resolves every local HTML resource, canonical URL and admin navigation',async()=>{
 const output=resolve(root,'out-farda-test-'+process.pid);try{await buildFarda(output);
  for(const page of ['index.html','admin/index.html']){const html=await readFile(resolve(output,page),'utf8');for(const [,url] of html.matchAll(/(?:href|src)="([^"#]+)"/g)){if(/^[a-z]+:|^\/\//i.test(url))continue;const target=resolve(resolve(output,page,'..'),url.split(/[?#]/)[0]);assert.ok(target===output||target.startsWith(output+'/'));const item=await stat(target);assert.ok(item.isDirectory()?(await stat(resolve(target,'index.html'))).isFile():item.isFile());}}
  assert.match(await readFile(resolve(output,'index.html'),'utf8'),/canonical" href="https:\/\/farda\.lithos\.ge/);assert.match(await readFile(resolve(output,'config.js'),'utf8'),/apiBase:''/);
 }finally{await rm(output,{recursive:true,force:true});}await assert.rejects(buildFarda(resolve(root,'src')));
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,validateSketch,cleanSketch,sketchPrompt} from '../server/designer/worker.mjs';
const token='test-only-access-code-with-32-characters';
const jpeg=btoa('\xff\xd8\xff\xe0fake-jpeg-test');
const body={wall:'back',wallLen:420,roomH:270,image:{mime_type:'image/jpeg',data:jpeg}};
const request=(b=body,headers={},path='/sketch')=>new Request('https://worker.example'+path,{method:'POST',headers:{Origin:'https://lithos.ge','Content-Type':'application/json',Authorization:'Bearer '+token,...headers},body:JSON.stringify(b)});
const okQuota={idFromName:()=>1,get:()=>({fetch:async()=>new Response(null,{status:204})})};
const env={ALLOWED_ORIGINS:'https://lithos.ge',GEMINI_API_KEY:'test-not-a-real-key',TEST_ACCESS_TOKEN:token,QUOTA:okQuota};
const gemini=obj=>async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(obj)}]}}]}),{status:200,headers:{'Content-Type':'application/json'}});
test('sketch input is validated before anything is spent',()=>{
  assert.throws(()=>validateSketch({...body,wall:'ceiling'}));
  assert.throws(()=>validateSketch({...body,wallLen:50}));
  assert.throws(()=>validateSketch({...body,image:{mime_type:'image/jpeg',data:btoa('<svg/>')}}));
  assert.deepEqual(validateSketch(body).len,420);
  assert.match(sketchPrompt(420,270),/420 cm long/);
});
test('model output is whitelisted and clamped to the wall',()=>{
  const out=cleanSketch({features:[{type:'window',x:-20,w:900,sill:2,h:140,confidence:0.9},{type:'sofa',x:10,confidence:1},{type:'water',x:9999,confidence:'x'},{type:'column',x:300,w:40,d:'35',confidence:0.7}],notes:'n'.repeat(500)},420);
  assert.equal(out.features.length,3);
  assert.deepEqual(out.features[0],{t:'window',x:0,conf:0.9,w:420,sill:2,h:140});
  assert.equal(out.features[1].x,420); assert.equal(out.features[1].conf,0);
  assert.equal(out.features[2].d,35);
  assert.equal(out.notes.length,300);
});
test('unauthorized or over-quota sketch requests never reach the model',async()=>{
  const handler=createHandler(()=>{throw Error('Must not fetch');});
  assert.equal((await handler(request(body,{Authorization:'Bearer wrong'}),env)).status,401);
  const blocked={idFromName:()=>1,get:()=>({fetch:async()=>new Response(null,{status:429})})};
  assert.equal((await handler(request(),{...env,QUOTA:blocked})).status,429);
  assert.equal((await handler(request({...body,wallLen:'abc'}),env)).status,400);
});
test('a good photo returns cleaned features and the key stays server-side',async()=>{
  const calls=[];
  const fetcher=async(url,options)=>{calls.push({url,options});return gemini({features:[{type:'door',x:300,w:90,h:205,confidence:0.8}],notes:'ok'})();};
  const res=await createHandler(fetcher)(request(),env);
  assert.equal(res.status,200);
  const data=await res.json();
  assert.deepEqual(data.features,[{t:'door',x:300,conf:0.8,w:90,h:205}]);
  assert.equal(calls.length,1);
  assert.match(calls[0].url,/models\/gemini-2\.5-flash:generateContent$/);
  const sent=JSON.parse(calls[0].options.body);
  assert.equal(sent.contents[0].parts[1].inline_data.data,body.image.data);
  assert.equal(sent.generationConfig.responseMimeType,'application/json');
  assert.ok(!JSON.stringify(data).includes('test-not-a-real-key'));
  const bad=await createHandler(async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:'not json'}]}}]}),{status:200}))(request(),env);
  assert.equal(bad.status,502);
});

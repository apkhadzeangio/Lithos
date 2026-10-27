import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import assert from 'node:assert/strict';

const html=readFileSync(new URL('../dist/lab/index.html',import.meta.url),'utf8');
const script=id=>html.split(`<script id="${id}">`)[1].split('</script>')[0];
const data=script('arena-data'),app=script('arena-app');
const context=vm.createContext({document:{getElementById(){}},window:{matchMedia(){return {matches:false}}},URL,URLSearchParams,setTimeout,clearTimeout});
vm.runInContext(data+'\n'+app.slice(0,app.indexOf('const sampleStyles='))+'\nglobalThis.api={database,modules,profiles,sources,score,verdictFor,sanitizeState};',context);
const {database,modules,profiles,sources,score,verdictFor,sanitizeState}=context.api;

test('one portable HTML embeds its font, Chart.js, CSS and application scripts',()=>{
 for(const id of ['chartjs-library','arena-data','arena-app'])new vm.Script(script(id));
 assert.match(html,/data:font\/woff2;base64,/);
 assert.match(html,/tailwindcss v3\.4\.17/);
 assert.match(script('chartjs-library'),/Chart\.js v4\.4\.8/);
 assert.doesNotMatch(html,/<script[^>]+src=/);
 assert.doesNotMatch(html,/FONT_DATA|ARENA_DATA|ARENA_APP|MARBLE_DATA|SINTER_DATA/);
 assert.match(html,/prefers-reduced-motion/);
});
test('six modules cover eight relevant comparison groups with complete scenario outcomes',()=>{
 assert.equal(modules.length,6);assert.equal(Object.keys(database).length,8);
 for(const [key,group] of Object.entries(database)){
  assert.equal(group.axes.length,6,key);assert.equal(group.tests.length,3,key);
  assert(group.items.length>=2,key);assert.equal(new Set(group.items.map(p=>p.id)).size,group.items.length,key);
  for(const profile of profiles){assert.equal(group.weights[profile.id].length,6);assert(group.weights[profile.id].some(w=>w>0));}
  for(const p of group.items){
   assert.equal(p.scores.length,6,p.id);assert(p.scores.every(s=>s>=1&&s<=10),p.id);
   assert(p.description.length>40&&p.caution.length>20&&p.specs.length>=3,p.id);
   assert(p.refs.every(ref=>sources[ref]),p.id);
   for(const t of group.tests){assert(['good','warn','bad'].includes(p.tests[t.id]?.status),`${key}/${p.id}/${t.id}`);assert(p.tests[t.id].text.length>30);}
  }
 }
});
test('family and premium priorities produce a reasoned change for quartz versus marble',()=>{
 const g=database.stone,a=g.items.find(p=>p.id==='quartz'),b=g.items.find(p=>p.id==='marble');
 const family=verdictFor(g,a,b,'family'),premium=verdictFor(g,a,b,'premium');
 assert.equal(family.winner,'a');assert.equal(family.tie,false);
 assert.equal(premium.winner,'b');assert.equal(premium.tie,false);
});
test('recommendations remain symmetric when sides swap and respect equal premium hardware',()=>{
 for(const group of Object.values(database))for(let i=0;i<group.items.length;i++)for(let j=i+1;j<group.items.length;j++)for(const profile of profiles){
  const a=group.items[i],b=group.items[j],x=verdictFor(group,a,b,profile.id),y=verdictFor(group,b,a,profile.id);
  assert.equal(x.aScore,y.bScore);assert.equal(x.bScore,y.aScore);assert.equal(x.tie,y.tie);
  assert(x.aScore>=1&&x.aScore<=10);if(!x.tie)assert.notEqual(x.winner,y.winner);
 }
 const g=database.hardware;for(const profile of profiles)assert(verdictFor(g,g.items[0],g.items[1],profile.id).tie);
 assert.equal(score({scores:[1,2,3,4,5,6]},[1,1,1,1,1,1]),3.5);
});
test('malformed or unknown saved choices cannot enter a category or inject IDs',()=>{
 const clean=sanitizeState({group:'__proto__',pairs:{stone:['quartz','quartz'],hob:['induction','<script>']},profile:'admin',test:'oops'});
 assert.equal(clean.group,'stone');assert.equal(clean.profile,null);assert.equal(clean.test,null);assert.equal(Object.keys(clean.pairs).length,0);
 const valid=sanitizeState({group:'edge',pairs:{edge:['pur','eva']},profile:'family',test:'water'});
 assert.equal(valid.group,'edge');assert.equal(valid.test,'water');assert.equal(valid.pairs.edge[1],'eva');
 for(const value of [null,42,[],{group:'constructor'}])assert.equal(sanitizeState(value).group,'stone');
});
test('mounting, hardware and brands are compared within meaningful groups',()=>{
 assert.deepEqual(Array.from(database.edge.items,p=>p.id),['pur','eva']);
 const ids=database.facade.items.map(p=>p.id);for(const id of ['egger','agt','kastamonu','cleaf','fenix','painted','veneer','laminate'])assert(ids.includes(id));
 assert.equal(database.hob.items.find(p=>p.id==='induction').tests.child.status,'warn');
 assert.equal(database.stone.items.find(p=>p.id==='sintered').tests.knife.status,'warn');
});

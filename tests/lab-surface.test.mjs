import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../dist/lab/surface.js',import.meta.url),'utf8').replace('export function createSurface','function createSurface');
function fixture({webgl=true}={}){
 const statuses={},events={},callbacks=new Map(),uniforms={},elements={};let next=0,draws=0,intersection;
 const element=()=>({hidden:true,disabled:true,events:{},setAttribute(name,value){this[name]=value},addEventListener(name,fn){this.events[name]=fn}});
 const slab=element();slab.getBoundingClientRect=()=>({left:0,top:0,width:640,height:480});
 const canvas=element(),buttons=['polished','silk','satin'].map(value=>({...element(),dataset:{finish:value}})),instruction={textContent:''};
 const gl=new Proxy({getProgramParameter:()=>true,getError:()=>0,NO_ERROR:0,getAttribLocation:()=>0,getUniformLocation:(_,name)=>name,uniform1f:(name,value)=>uniforms[name]=value,uniform2f:(name,...value)=>uniforms[name]=value,drawArrays:()=>draws++},{get(target,key){if(key in target)return target[key];if(String(key).toUpperCase()===key)return 1;return()=>({});}});
 canvas.getContext=()=>webgl?gl:null;
 Object.assign(elements,{'#slab':slab,'#surface-canvas':canvas,'#surface-instruction':instruction});
 const document={hidden:false,querySelector:key=>elements[key],querySelectorAll:()=>buttons,addEventListener:(name,fn)=>events[name]=fn};
 const preference={matches:false},staticToggle={checked:false};
 const ctx=vm.createContext({document,window:{devicePixelRatio:3,ResizeObserver:true,addEventListener(){}},performance:{mark(){}},Float32Array,Math,IntersectionObserver:class{constructor(fn){intersection=fn}observe(){}},ResizeObserver:class{observe(){}},requestAnimationFrame:fn=>{const id=++next;callbacks.set(id,fn);return id},cancelAnimationFrame:id=>callbacks.delete(id)});
 vm.runInContext(source+'\nglobalThis.make=createSurface;',ctx);
 const renderer=ctx.make({photo:{naturalWidth:1234,naturalHeight:1800},text:(name,value)=>statuses[name]=value,preference,staticToggle});
 const flush=()=>{let count=0;while(callbacks.size){assert(count++<150,'Animation must settle');const entries=[...callbacks];callbacks.clear();for(const [,fn]of entries)fn()}return count};
 return{renderer,slab,canvas,buttons,statuses,uniforms,preference,staticToggle,document,events,flush,visible:value=>intersection([{isIntersecting:value}]),queued:()=>callbacks.size,draws:()=>draws};
}
const f=fixture();assert(f.renderer);assert.equal(f.draws(),0,'Never render before surface is visible');f.visible(true);f.flush();assert.equal(f.queued(),0,'Idle rendering must stop');assert.equal(f.statuses['dpr-status'],'2.00','DPR cap must be respected');
for(const [index,roughness,specular]of[[0,.14,.34],[1,.56,.16],[2,.82,.085]]){f.buttons[index].events.click();f.flush();assert.equal(f.uniforms.u_roughness,roughness);assert.equal(f.uniforms.u_specular,specular);assert.equal(f.buttons[index]['aria-pressed'],'true')}
f.slab.events.pointermove({clientX:590,clientY:40});assert(f.queued());f.visible(false);const offscreen=f.draws();f.flush();assert.equal(f.draws(),offscreen,'Offscreen surface must not render');
f.visible(true);f.flush();f.slab.events.pointermove({clientX:20,clientY:400});assert(f.queued());f.document.hidden=true;f.events.visibilitychange();f.flush();assert.equal(f.queued(),0,'Hidden tabs cancel queued rendering');f.document.hidden=false;f.events.visibilitychange();f.flush();
f.renderer.setStatic(true);assert.equal(f.canvas.hidden,true);assert(f.buttons.every(b=>b.disabled));const paused=f.draws();f.slab.events.pointermove({clientX:300,clientY:200});f.flush();assert.equal(f.draws(),paused,'Static mode must not render');f.renderer.setStatic(false);f.flush();assert.equal(f.canvas.hidden,false);
let prevented=false;f.slab.events.keydown({key:'ArrowRight',preventDefault(){prevented=true}});f.flush();assert(prevented,'Arrow keys must control lighting');
f.preference.matches=true;const reduced=f.draws();f.slab.events.pointermove({clientX:200,clientY:50});f.flush();assert.equal(f.draws(),reduced,'Reduced motion must not render');f.preference.matches=false;
f.canvas.events.webglcontextlost({preventDefault(){}});assert(f.canvas.hidden);assert(f.buttons.every(b=>b.disabled));const lost=f.draws();f.renderer.setStatic(false);assert(f.canvas.hidden,'Context loss remains a photo even after a toggle');f.visible(true);f.flush();assert.equal(f.draws(),lost,'Context loss must retain static fallback');
const unsupported=fixture({webgl:false});assert.equal(unsupported.renderer,null);assert(unsupported.statuses['render-status'].includes('WebGL'));
console.log('Surface lifecycle passed: finish uniforms, pointer/keyboard, idle/offscreen/hidden/reduced-motion/static pauses, DPR cap and context-loss/unsupported fallbacks.');

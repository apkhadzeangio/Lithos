import {FABRICS,normalizePreferences} from './core.mjs';
function panel(ctx,x,y,w,h,fabric,texture,design,alpha=1,side=0){
 if(w<1||h<1)return;ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.globalAlpha=alpha;ctx.fillStyle=fabric.referenceColor;ctx.fillRect(x,y,w,h);
 if(texture){const [sx,sy,sw,sh]=fabric.textureCrop;ctx.globalAlpha=alpha*.28;ctx.drawImage(texture,sx*texture.width,sy*texture.height,sw*texture.width,sh*texture.height,x,y,w,h);}
 ctx.globalAlpha=alpha;
 const folds=design==='pencil'?Math.max(9,Math.round(w/14)):design==='pinch'?Math.max(5,Math.round(w/24)):Math.max(4,Math.round(w/28));const step=w/folds;
 for(let i=0;i<folds;i++){
  const xx=x+i*step,g=ctx.createLinearGradient(xx,0,xx+step,0);g.addColorStop(0,'rgba(0,0,0,.26)');g.addColorStop(.23,'rgba(255,255,255,.18)');g.addColorStop(.55,'rgba(255,255,255,.03)');g.addColorStop(.84,'rgba(0,0,0,.18)');g.addColorStop(1,'rgba(0,0,0,.3)');ctx.fillStyle=g;ctx.fillRect(xx,y,step+1,h);
  if(design==='pinch'){ctx.strokeStyle='#463e3440';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(xx+step*.5,y);ctx.lineTo(xx+step*.3,y+Math.min(40,h*.08));ctx.lineTo(xx+step*.7,y+Math.min(40,h*.08));ctx.closePath();ctx.stroke();}
 }
 const shade=ctx.createLinearGradient(0,y,0,y+h);shade.addColorStop(0,'rgba(0,0,0,.15)');shade.addColorStop(.12,'rgba(255,255,255,.05)');shade.addColorStop(1,'rgba(0,0,0,.14)');ctx.fillStyle=shade;ctx.fillRect(x,y,w,h);
 ctx.strokeStyle='#3b352b50';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,w-1,h-1);
 if(design==='eyelet')for(let i=0;i<folds;i++){ctx.beginPath();ctx.ellipse(x+step*(i+.5),y+7,4,6,0,0,Math.PI*2);ctx.fillStyle='#544c40';ctx.fill();ctx.strokeStyle='#b6aa91';ctx.stroke();}
 ctx.restore();
}
export function drawCurtains(canvas,photo,raw,textures=new Map(),show=true){
 const p=normalizePreferences(raw),ctx=canvas.getContext('2d');canvas.width=photo.width;canvas.height=photo.height;ctx.drawImage(photo,0,0,canvas.width,canvas.height);if(!show)return;
 const b=p.box,x=b.x*canvas.width,y=b.y*canvas.height,w=b.w*canvas.width;let h=b.h*canvas.height;if(p.length==='sill')h*=.68;if(p.length==='puddle')h=Math.min(canvas.height-y,h*1.04);
 const fabric=FABRICS.find(f=>f.id===p.fabric),texture=textures.get(fabric.id),opacity=fabric.kind==='sheer'?.55:.96;
 ctx.save();ctx.fillStyle=p.mount==='wall'?'#756750':'#d4cbbb';ctx.shadowColor='#0003';ctx.shadowBlur=5;ctx.shadowOffsetY=3;ctx.fillRect(x-5,y-5,w+10,p.mount==='wall'?5:3);ctx.restore();
 if(p.design==='roman'){
  const hh=h*(1-p.opening*.007);panel(ctx,x,y,w,hh,fabric,texture,'pencil',opacity);
  for(let i=1;i<=5;i++){const yy=y+hh*i/6;ctx.strokeStyle='#332d2755';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(x+w,yy);ctx.stroke();}
 }else{
  if(p.design==='layered'){const sheer=FABRICS.find(f=>f.id===p.sheer);panel(ctx,x,y,w,h,sheer,textures.get(sheer.id),'wave',.32);}
  const coverage=1-p.opening*.0077,pw=w*coverage/2;
  panel(ctx,x,y,pw,h,fabric,texture,p.design,opacity,0);panel(ctx,x+w-pw,y,pw,h,fabric,texture,p.design,opacity,1);
 }
}

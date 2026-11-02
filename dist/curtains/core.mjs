import {FABRICS} from './catalog.mjs';
export {FABRICS};
export const DESIGNS=[
 {id:'wave',name:'რბილი ტალღა',description:'თანაბარი, მსუბუქი ტალღები',fullness:2.2,icon:'wave'},
 {id:'pencil',name:'კლასიკური ნაკეცი',description:'წვრილი, თავისუფალი ნაკეცები',fullness:2,icon:'pencil'},
 {id:'pinch',name:'შეკრული ნაკეცი',description:'მკაფიო, შეკრული ზედა ნაწილი',fullness:2.5,icon:'pinch'},
 {id:'eyelet',name:'რგოლებზე',description:'გამოკვეთილი, ღრმა ნაკეცები',fullness:2,icon:'eyelet'},
 {id:'roman',name:'რომაული',description:'ჰორიზონტალური, შეკეცილი ფორმა',fullness:1.15,icon:'roman'},
 {id:'layered',name:'ორი ფენა',description:'თხელი ფარდა და გვერდითი ქსოვილი',fullness:2.2,icon:'layered'}
];
export const STATUSES=['ახალი მოთხოვნა','დასაზუსტებელია','აზომვა შეთანხმებულია','შეთავაზება გაგზავნილია','შეკვეთა დადასტურებულია','დასრულებულია'];
export const DEFAULTS={fabric:'wiens',sheer:'elegant',design:'wave',opening:62,mount:'ceiling',length:'floor',widthCm:280,heightCm:270,fullness:2.2,colorWish:'',box:{x:.21,y:.07,w:.63,h:.73}};
const numeric=(value,min,max,label)=>{const number=Number(String(value).replace(',','.'));if(!Number.isFinite(number)||number<min||number>max)throw Error(label+' — მიუთითე '+min+'–'+max+' ფარგლებში.');return number;};
export function normalizePreferences(raw){
 if(!raw||typeof raw!=='object')throw Error('პარამეტრები არ არის მითითებული.');
 if(!FABRICS.some(f=>f.id===raw.fabric))throw Error('აირჩიე ქსოვილი კატალოგიდან.');
 if(!FABRICS.some(f=>f.id===raw.sheer&&f.kind==='sheer'))throw Error('აირჩიე თხელი ფენა კატალოგიდან.');
 if(!DESIGNS.some(d=>d.id===raw.design))throw Error('აირჩიე ფარდის დიზაინი.');
 if(!['ceiling','wall'].includes(raw.mount)||!['floor','sill','puddle'].includes(raw.length))throw Error('სამაგრი ან სიგრძე არასწორია.');
 const box=raw.box||{};const normalizedBox={x:numeric(box.x,0,.95,'მდებარეობა'),y:numeric(box.y,0,.95,'მდებარეობა'),w:numeric(box.w,.1,1,'სიგანე'),h:numeric(box.h,.1,1,'სიმაღლე')};
 if(normalizedBox.x+normalizedBox.w>1.001||normalizedBox.y+normalizedBox.h>1.001)throw Error('ფარდის მონიშნული არე ფოტოს საზღვრებს სცდება.');
 const colorWish=String(raw.colorWish||'').trim();if(colorWish.length>200)throw Error('ფერის აღწერა ძალიან გრძელია.');
 return {fabric:raw.fabric,sheer:raw.sheer,design:raw.design,opening:numeric(raw.opening,0,100,'გაშლა'),mount:raw.mount,length:raw.length,widthCm:numeric(raw.widthCm,20,1500,'კარნიზის სიგანე'),heightCm:numeric(raw.heightCm,20,600,'ფარდის სიმაღლე'),fullness:numeric(raw.fullness,1,3.5,'შეკრების კოეფიციენტი'),colorWish,box:normalizedBox};
}
export function estimate(raw){const p=normalizePreferences(raw),fabric=FABRICS.find(f=>f.id===p.fabric);return {spreadWidthM:Math.round(p.widthCm/100*p.fullness*100)/100,heightWarning:p.heightCm>fabric.maxHeightCm,fabricMaxHeightCm:fabric.maxHeightCm,price:null};}
export function preferenceSummary(raw){const p=normalizePreferences(raw),fabric=FABRICS.find(f=>f.id===p.fabric);return [fabric.name,DESIGNS.find(d=>d.id===p.design).name,p.widthCm+' × '+p.heightCm+' სმ',p.mount==='ceiling'?'ჭერის კარნიზი':'კედლის კარნიზი',p.length==='floor'?'იატაკამდე':p.length==='sill'?'რაფამდე':'იატაკზე დაშვებით'];}
export function validateContact(raw){
 const c=Object.fromEntries(['name','phone','city','comment'].map(k=>[k,String(raw?.[k]||'').trim()]));
 if(c.name.length<2||c.name.length>100)throw Error('მიუთითე სახელი (2–100 სიმბოლო).');
 if(!/^[+\d ()-]{7,30}$/.test(c.phone)||c.phone.replace(/\D/g,'').length<7)throw Error('მიუთითე სწორი ტელეფონის ნომერი.');
 if(c.city.length<2||c.city.length>120)throw Error('მიუთითე ქალაქი ან მდებარეობა.');
 if(c.comment.length>2000)throw Error('კომენტარი ძალიან გრძელია.');
 if(raw.consent!==true)throw Error('შეკვეთის მოსამზადებლად დაადასტურე მონაცემების დამუშავებაზე თანხმობა.');
 return {...c,consent:true};
}
export function createOrder(raw,contact,reference){
 const p=normalizePreferences(raw),fabric=FABRICS.find(f=>f.id===p.fabric),tulle=FABRICS.find(f=>f.id===p.sheer);
 return {version:1,reference,createdAt:new Date().toISOString(),type:'curtain-quotation-request',status:'draft',visualization:'2d-concept',contact:validateContact(contact),preferences:p,fabric:{id:fabric.id,productId:fabric.productId,name:fabric.name,sourceUrl:fabric.sourceUrl,verifiedAt:fabric.verifiedAt,variantStatus:fabric.variantStatus},sheer:p.design==='layered'?{id:tulle.id,productId:tulle.productId,name:tulle.name,sourceUrl:tulle.sourceUrl}:null,estimate:estimate(p),commercialNote:'ქსოვილის მარაგი, ფერი, დიზაინის შესაბამისობა და საბოლოო ფასი დასადასტურებელია.'};
}
export function orderMessage(order){return ['გამარჯობა! მსურს ფარდის შეკვეთის დაზუსტება.','პროექტი: '+order.reference,'სახელი: '+order.contact.name,'ტელეფონი: '+order.contact.phone,'მდებარეობა: '+order.contact.city,...preferenceSummary(order.preferences),'შეკრების კოეფიციენტი: '+order.preferences.fullness,'გაშლილი ქსოვილის სავარაუდო სიგანე: '+order.estimate.spreadWidthM+' მ','ფარდის გაშლა: '+order.preferences.opening+'%','ქსოვილის მოდელი: '+order.fabric.productId,'წყარო: '+order.fabric.sourceUrl,order.sheer?'თხელი ფენა: '+order.sheer.name+' · მოდელი '+order.sheer.productId+' · '+order.sheer.sourceUrl:'',order.preferences.colorWish?'სასურველი ფერი: '+order.preferences.colorWish:'',order.contact.comment?'კომენტარი: '+order.contact.comment:'','ვიზუალი არის 2D ესკიზი. ფოტოებს ცალკე ვურთავ. საბოლოო ფასი და მარაგი დასადასტურებელია.'].filter(Boolean).join('\n');}
export function curtainPrompt(raw){const p=normalizePreferences(raw),fabric=FABRICS.find(f=>f.id===p.fabric);return ['Edit only the curtain installation in the attached actual window photograph. Preserve the exact room, window count, opening positions, wall geometry, camera angle, furniture and lighting.','Use the second image as the mandatory reference for the selected real fabric: '+fabric.name+', supplier product '+fabric.productId+'. Do not replace it with a different pattern.','Curtain heading: '+p.design+'; mounting: '+p.mount+'; length: '+p.length+'; opening '+p.opening+'%.','If the fabric photograph includes several colors, use its referenced sample tone only as a concept; do not invent a purchasable variant or color code.','Do not add windows or structural alterations. Photorealistic textile folds; no text, watermark, price or engineering claims.'].join('\n');}

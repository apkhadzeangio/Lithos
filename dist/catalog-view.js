const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
const georgianLetters={'ა':'a','ბ':'b','გ':'g','დ':'d','ე':'e','ვ':'v','ზ':'z','თ':'t','ი':'i','კ':'k','ლ':'l','მ':'m','ნ':'n','ო':'o','პ':'p','ჟ':'zh','რ':'r','ს':'s','ტ':'t','უ':'u','ფ':'f','ქ':'k','ღ':'gh','ყ':'k','შ':'sh','ჩ':'ch','ც':'ts','ძ':'dz','წ':'ts','ჭ':'ch','ხ':'kh','ჯ':'j','ჰ':'h'};
const phonetic=value=>normalize(value).replace(/[ა-ჰ]/g,c=>georgianLetters[c]||c).replace(/c/g,'k').replace(/q/g,'k').replace(/([a-z])\1+/g,'$1');
const finishLabels={'Satin':'სატინისებრი','Silk':'აბრეშუმისებრი','Riverwashed':'რელიეფური','Slate':'ფიქალისებრი','Natural Touch':'ბუნებრივი შეხება','Ultrasoft':'ულტრა რბილი','Décor Polished':'დეკორატიული პრიალა','Steel Touch':'ფოლადის ეფექტი','Polished':'პრიალა','Leather':'ტყავისებრი'};
function finishOptions(m){if(!m.finish)return [];return m.finish.split(' / ').map(f=>f==='პრიალა (Polished)'?'პრიალა':finishLabels[f]||f);}
const finishText=m=>finishOptions(m).join(' / ')||'დააზუსტეთ';
const thicknessText=m=>m.thicknesses?.length?m.thicknesses.join(' / ')+' მმ':'დააზუსტეთ';
const materials=[...neolithMaterials,...quartzMaterials];
const summary=m=>'დამუშავება: '+finishText(m)+' · სისქე: '+thicknessText(m);


function materialCard(m,index){
return `<button class="stone-card" data-material="${index}" aria-label="${esc(m.name)} — ${esc(m.label)}; დეტალების ნახვა"><div class="stone-image"><img src="${esc(m.thumbnail||m.image)}" alt="${esc(m.name)} — ${esc(m.label)} — ფილის ფოტო" loading="lazy" decoding="async"><span class="circle-arrow" aria-hidden="true">→</span></div><div class="stone-type">${esc(m.label)}</div><h3>${esc(m.name)}</h3>${m.brand?`<span class="manufacturer">მწარმოებელი: ${esc(m.brand)}</span>`:''}<p>${esc(summary(m))}</p></button>`;
}

const catalogText={
all:{heading:'იპოვეთ თქვენი<br><span class="text-accent">სივრცის ხასიათი.</span>',eyebrow:'ტექსტურების კოლექცია',kind:'მასალების კოლექცია',description:'დაათვალიერეთ მასალები ტიპის მიხედვით. გახსენით ნიმუში და ახლოდან შეისწავლეთ ტექსტურა.',note:'103 მასალა — NEOLITH და კვარცი, ორიგინალი ფოტოებითა და კატალოგის მონაცემებით. მარმარილო, გრანიტი და აკრილის ქვა ხელმისაწვდომია მოთხოვნით.'},
neolith:{heading:'ქვის ხასიათი.<br><span class="text-accent">72 განსხვავებული არჩევანი.</span>',eyebrow:'NEOLITH',kind:'NEOLITH',description:'დაათვალიერეთ ორიგინალი ტექსტურები, გახსენით ფილის სრული ფოტო და შეადარეთ ზომები, სისქე და ზედაპირის დამუშავება.',note:'ფოტოები: Neolith და მისი დისტრიბუტორების კატალოგები. ფერები და ტექსტურა შეადარეთ რეალურ ნიმუშს. კონკრეტული ფორმატისა და დამუშავების ხელმისაწვდომობა დააზუსტეთ ჩვენთან.'},
quartz:{heading:'კვარცის კოლექცია.<br><span class="text-accent">31 განსხვავებული არჩევანი.</span>',eyebrow:'COANTE & GRADO · კვარცი',kind:'COANTE & GRADO · კვარცის კოლექცია',description:'დაათვალიერეთ ორიგინალი ტექსტურები, გახსენით ფილის სრული ფოტო და შეადარეთ ზომები, სისქე და ზედაპირის დამუშავება.',note:'Coante-სა და Grado-ს 31 მოდელი ორიგინალი ფოტოებით. ფერი და ტექსტურა შეადარეთ რეალურ ნიმუშს. სასურველი ზომა, სისქე, დამუშავება და ხელმისაწვდომობა დააზუსტეთ LITHOS-თან.'}
};
function catalogView(filter='all',query='',options={}){
const tokens=normalize(query).trim().split(/\s+/).filter(Boolean);let count=0;
const html=materials.map((m,index)=>{
const searchable=normalize([m.name,m.label,m.brand,m.color,m.finish,...(m.aliases||[]),...(m.searchKeywords||[]),...(m.thicknesses||[]),m.type==='neolith'?'ნეოლითი ნეოლითის ფილები':m.type==='quartz'?'კვარცი კვარცის ფილები quartz':''].join(' '));
if((filter!=='all'&&m.type!==filter)||!tokens.every(token=>searchable.includes(token)||phonetic(searchable).includes(phonetic(token))))return '';
if(options.finish&&!finishOptions(m).includes(options.finish))return '';
if(options.thickness&&!(m.thicknesses||[]).includes(Number(options.thickness)))return '';count++;
return materialCard(m,index);
}).join('');
return {...(catalogText[filter]||catalogText.all),html,count,countLabel:`${count} ${['neolith','quartz'].includes(filter)?'მოდელი':'მასალა'}`};
}

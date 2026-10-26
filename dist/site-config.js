// Fill confirmed business details here, then run: node scripts/build-public-pages.mjs
const siteConfig={
name:'LITHOS — ლითოსი',phone:'+995551044013',phoneDisplay:'+995 551 04 40 13',
email:'Lithos13LTD@gmail.com',
facebook:'https://www.facebook.com/lithos.ge',
warranty:'',timeline:{measurement:'',fabrication:'',installation:''},workshop:'',
serviceArea:[],seoCity:'',address:'',mapsUrl:'',geo:null,priceCalculation:'',measurementTerms:'',careInstructions:''
};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const realValue=value=>typeof value==='string'&&value.trim()&&!value.includes('[შესავსები]')?value.trim():'';
const whatsappUrl=name=>'https://wa.me/'+siteConfig.phone.replace(/\D/g,'')+'?text='+encodeURIComponent('გამარჯობა, მსურს კონსულტაცია მასალაზე: '+name+'.');
function inquiryMessage(values){return ['გამარჯობა, მსურს ქვის ზედაპირის ღირებულების დაზუსტება.',...Object.entries({სახელი:values.name,ტელეფონი:values.phone,მასალა:values.material,ზომები:values.dimensions,კომენტარი:values.comment}).filter(([,value])=>String(value||'').trim()).map(([label,value])=>label+': '+String(value).trim())].join('\n');}
const inquiryUrl=values=>'https://wa.me/'+siteConfig.phone.replace(/\D/g,'')+'?text='+encodeURIComponent(inquiryMessage(values));
const publicPages={
work:{path:'/',url:'https://lithos.ge/',title:'სამზარეულოს ქვის ზედაპირები — დამზადება და მონტაჟი'+(realValue(siteConfig.seoCity)?' — '+siteConfig.seoCity:'')+' | LITHOS',description:'სამზარეულოს ქვის ზედაპირების დამზადება და მონტაჟი. NEOLITH და კვარცი სამზარეულოსა და აბაზანისთვის.'+(realValue(siteConfig.seoCity)?' მომსახურება: '+siteConfig.seoCity+'.':'')+' დაგვიკავშირდით: '+siteConfig.phoneDisplay+'.'},
all:{path:'/materials/',url:'https://lithos.ge/materials/',title:'მასალების კატალოგი — LITHOS',description:'LITHOS-ის მასალების კატალოგი — NEOLITH და კვარცის ფილები ორიგინალი ფოტოებით. შეადარეთ ტექსტურები, ზომები და დამუშავება.'},
neolith:{path:'/neolith/',url:'https://lithos.ge/neolith/',title:'NEOLITH-ის კოლექცია — LITHOS',description:'NEOLITH-ის 72 მოდელი LITHOS-ში. ორიგინალი ფოტოები, ფილის ზომები, სისქე და ზედაპირის დამუშავება. კონსულტაცია: '+siteConfig.phoneDisplay+'.'},
quartz:{path:'/quartz/',url:'https://lithos.ge/quartz/',title:'კვარცის კოლექცია — LITHOS',description:'Coante-სა და Grado-ს კვარცის 31 მოდელი LITHOS-ში. ფოტოები, ზომები და ტექნიკური მონაცემები. კონსულტაცია: '+siteConfig.phoneDisplay+'.'}
};

export const shapes={straight:'სწორი',corner:'კუთხის',u:'U-ს ფორმის',island:'კუნძულით'};
export function dimensions(values){
  const result={shape:values.shape||'straight'};
  if(!Object.hasOwn(shapes,result.shape))throw Error('აირჩიეთ სამზარეულოს ფორმა.');
  for(const key of ['a','b','c','depth']){
    const raw=String(values[key]??'').trim();
    if(!raw)continue;
    const value=Number(raw.replace(',','.'));
    if(!Number.isFinite(value)||value<20||value>2000)throw Error('ზომა მიუთითეთ სანტიმეტრებში, 20-დან 2000-მდე.');
    result[key]=value;
  }
  return result;
}
export function designPrompt(material,values){
  const d=dimensions(values);
  const sizes=[['a','პირველი მონაკვეთი'],['b','მეორე მონაკვეთი'],['c','მესამე მონაკვეთი ან კუნძული'],['depth','ზედაპირის სიღრმე']].filter(([key])=>d[key]).map(([key,label])=>`${label}: ${d[key]} სმ`).join('; ');
  return `შექმენი სამზარეულოს ერთი ფოტორეალისტური ვიზუალიზაცია LITHOS-ისთვის.
პირველი თანდართული სურათი მომხმარებლის სამზარეულოა. მეორე — მასალის რეალური ფოტო: ${material.name} (${material.label}).
შეცვალე მხოლოდ არსებული სამუშაო ზედაპირის ქვა. ზუსტად შეინარჩუნე კარადები, ტექნიკა, ნიჟარა, კედლები, ფანჯრები, განათება, კამერის კუთხე და სივრცის განლაგება. კუნძულის ზედაპირიც შეცვალე მხოლოდ მაშინ, თუ ის საწყის ფოტოში ჩანს. კედლის მოპირკეთება უცვლელი დატოვე.
ქვის ფერი, ვენების ხასიათი და ფაქტურა აიღე მეორე ფოტოდან. არ ჩაანაცვლო სხვა ქვით. დაიცავი პერსპექტივა და ბუნებრივი ჩრდილები. არ დაამატო წარწერა, ლოგო, წყლის ნიშანი ან ახალი ავეჯი.
მითითებული ფორმა: ${shapes[d.shape]}.${sizes?' საორიენტაციო ზომები: '+sizes+'.':''}
ზომები მხოლოდ კონტექსტია. მათ გამო არ შეცვალო საწყის ფოტოში არსებული გეომეტრია. ეს ვიზუალიზაციაა და არა ტექნიკური ნახაზი. თუ მოთხოვნა საწყის ფოტოს ეწინააღმდეგება, შეინარჩუნე საწყისი სივრცე.`;
}
export function dimensionsSummary(values){
  const d=dimensions(values);
  return ['ფორმა: '+shapes[d.shape],...Object.entries({a:'პირველი მონაკვეთი',b:'მეორე მონაკვეთი',c:'მესამე მონაკვეთი ან კუნძული',depth:'სიღრმე'}).filter(([key])=>d[key]).map(([key,label])=>label+': '+d[key]+' სმ')].join('\n');
}

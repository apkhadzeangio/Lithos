# fasadi.lithos.ge — გამოქვეყნების მომზადებული ვერსია

სამიზნე მისამართი: **https://fasadi.lithos.ge/**

სტუდია სუბდომენის მთავარ გვერდზე იხსნება. საწყისი კოდი რჩება `apkhadzeangio/Lithos` რეპოზიტორიაში, ბრენჩზე `feat/exterior-studio`. არსებული მთავარი საიტის `dist/` გამოცემა და სამზარეულოს ფუნქციები საკუთარი სამუშაო პროცესით გრძელდება.

## დადასტურებამდე

GitHub PR-ში განიხილე ცვლილება. დომენის გააქტიურება და PR-ის გაერთიანება მომხმარებლის დადასტურებას ელოდება. ასაწყობი ფაილი ქვემოთ მოცემული პარამეტრებით Cloudflare Pages-ზე დამოუკიდებლად ქვეყნდება.

## Cloudflare Pages-ის ზუსტი პარამეტრები

| ველი | მნიშვნელობა |
| --- | --- |
| Repository | `apkhadzeangio/Lithos` |
| Branch, პირველადი შემოწმება | `feat/exterior-studio` |
| Branch, შემდგომი მუდმივი გამოცემა | `main`, PR-ის გაერთიანების შემდეგ |
| Framework preset | `None` |
| Root directory | რეპოზიტორიის ძირი; ველი ცარიელი |
| Build command | `node scripts/build-fasadi.mjs` |
| Build output directory | `out-fasadi` |
| Custom domain | `fasadi.lithos.ge` |

გამოიყენე ექსტერიერისთვის გამოყოფილი Pages პროექტი. მოქმედი LITHOS Pages პროექტის build output არ შეცვალო, რადგან ის ძირითად საიტს ემსახურება. ახალი frontend სერვისი იმავე რეპოზიტორიიდან იგება.

Cloudflare-ში: **Workers & Pages → შესაბამისი Pages პროექტი → Custom domains → Set up a domain → `fasadi.lithos.ge` → Continue**. დადასტურების ეკრანზე შეამოწმე დომენი და Pages-ის სამიზნე. არსებული `lithos.ge` და სხვა სუბდომენების ჩანაწერები არ შეცვალო. Cloudflare-ის ავტორიზებული სესიის გარეშე დომენის მიბმას შესრულებულად არ მივიჩნევთ.

## ხელით ატვირთვა

`node scripts/build-fasadi.mjs` ქმნის მზა `out-fasadi` საქაღალდეს. Direct Upload-ისთვის ატვირთე ამ საქაღალდის შიგთავსი ან მისგან შექმნილი ZIP, რომელშიც `index.html` არქივის ძირეულ დონეზეა. ZIP არ შეიცავს მომხმარებლის ფოტოებს, საკონტაქტო მონაცემებს, API გასაღებებს ან ადმინისტრატორის წვდომის კოდს.

## შემოწმება დომენის გააქტიურების შემდეგ

- `https://fasadi.lithos.ge/` ხსნის სტუდიას პირდაპირ.
- ლოგო, ექვსი სტილი და შედარების ფოტოები იტვირთება.
- მასალებისა და სამზარეულოს ბმულები მიდის `lithos.ge`-ზე.
- `/admin/` საკონტაქტო მონაცემებს ავტორიზაციის გარეშე არ აჩვენებს.
- ფოტოს ატვირთვა და დემო მუშაობს; დემო მკაფიოდ არის მონიშნული.

რეალური AI და მოთხოვნების მიღება ცალკე გასააქტიურებელია, როგორც აღწერილია `docs/EXTERIOR_STUDIO.md`-ში. `fasadi.lithos.ge` უკვე დამატებულია სერვერის ნებადართულ წარმომავლობებსა და Turnstile-ის ჰოსტებს შორის. საჯარო frontend ფაილში საიდუმლო მონაცემები არ ჩაწერო.

ოფიციალური მითითებები:

- https://developers.cloudflare.com/pages/configuration/build-configuration/
- https://developers.cloudflare.com/pages/configuration/custom-domains/

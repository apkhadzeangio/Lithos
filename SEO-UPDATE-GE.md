# LITHOS — საძიებო სისტემებისთვის წვდომის განახლება

ეს ცვლილებები გამოქვეყნებულია მიმდინარე Sites პროექტზე, რომელიც ემსახურება lithos.ge-ს.

## რა შეიცვალა

- `dist/robots.txt` ყველა ბოტს ყველა მისამართზე წვდომას აძლევს და sitemap-ის URL-ს უთითებს.
- `dist/sitemap.xml` შეიცავს ოთხ საჯარო, კანონიკურ მისამართს: `/`, `/materials/`, `/neolith/`, `/quartz/`.
- კატალოგები სტატიკურ HTML-შიც შეიცავს მოდელების ბარათებს. მათი წაკითხვა JavaScript-ის გარეშეც შეიძლება.
- თითოეულ გვერდს აქვს საკუთარი title, description და canonical URL.
- ძველი `#materials`, `#neolith`, `#quartz` და `#work` ბმულები JavaScript-ით შესაბამის ახალ მისამართზე გადადის.
- გვერდებზე robots-ის მეტამონაცემია `index, follow`.
- მიმდინარე წყაროში და ჰოსტინგის პასუხებში `X-Robots-Tag: noindex` არ აღმოჩნდა. სერვერის სათაურების დამატებითი კონფიგურაცია არ შეცვლილა.

## ფაილების განთავსება

ამავე მოქმედ საიტზე ხელით ატვირთვა საჭირო არ არის: განახლება უკვე გამოქვეყნებულია.

სხვა სტატიკურ ჰოსტინგზე გადატანისას ZIP-ის `dist/` საქაღალდის **შიგთავსი** განათავსეთ ვებგვერდის საჯარო ძირეულ საქაღალდეში, მაგალითად `public_html/` ან `www/`. შეინარჩუნეთ ქვესაქაღალდეები. `robots.txt` უნდა გაიხსნას `https://lithos.ge/robots.txt`-ზე, ხოლო `sitemap.xml` — `https://lithos.ge/sitemap.xml`-ზე.

განახლების ZIP შეიცავს შეცვლილ ფაილებს სრულად. არსებული `assets/`, `neolith-data.js` და `quartz-data.js` საჭიროა საიტის მუშაობისთვის და ადგილზე უნდა დარჩეს; ისინი ამ განახლებაში არ შეცვლილა.

`src/page.html` და `scripts/build-public-pages.mjs` პროექტის წყაროს ფაილებია. მათ საჯარო ვებძირში ატვირთვა არ სჭირდებათ. პროექტში HTML-ის ან კატალოგის შემდგომი ცვლილების შემდეგ გაუშვით:

```sh
node scripts/build-public-pages.mjs
```

Sites-ის მიმდინარე ჰოსტინგის მანიფესტი `.openai/hosting.json` უცვლელია და ემსახურება `dist/` საქაღალდეს. Domenebi.ge-ის NS/DNS მართვის პანელში ამ ფაილებს არ ტვირთავთ — ფაილები თავსდება საიტის ჰოსტინგზე.

## შეცვლილი და დამატებული ფაილები

```text
dist/robots.txt
dist/sitemap.xml
dist/index.html
dist/materials/index.html
dist/neolith/index.html
dist/quartz/index.html
dist/app.js
dist/catalog-view.js
dist/style.css
src/page.html
scripts/build-public-pages.mjs
SEO-UPDATE-GE.md
```

## Google-ში დამატება

Google Search Console-ის Sitemaps განყოფილებაში მიუთითეთ `https://lithos.ge/sitemap.xml`. შემდეგ მთავარი გვერდისა და კატალოგების URL Inspection-ში შეგიძლიათ მოითხოვოთ ინდექსაცია. ეს ფაილები ხსნის საიტის მხარეს არსებულ ტექნიკურ დაბრკოლებებს; Google-ში გამოჩენის ვადასა და ინდექსაციას Google განსაზღვრავს.

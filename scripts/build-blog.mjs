import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
const jsonLd = value => JSON.stringify(value).replaceAll('<', '\\u003c');
const articlePath = article => `/blog/${article.slug}/`;
const dateLabel = date => new Intl.DateTimeFormat('ka-GE', {day:'numeric', month:'long', year:'numeric', timeZone:'Asia/Tbilisi'}).format(new Date(`${date}T12:00:00+04:00`));
const readingTime = article => Math.max(2, Math.ceil([article.intro, ...article.sections.flatMap(section => section.paragraphs), article.tip, ...article.checklist].join(' ').split(/\s+/).length / 180));

export async function loadArticles() {
  return JSON.parse(await readFile(resolve(root, 'content/blog.json'), 'utf8'));
}

export function articleCard(article, {featured = false, index = 0} = {}) {
  const path = articlePath(article);
  return `<article class="blog-card${featured ? ' blog-card-featured' : ''}" data-category="${escape(article.category)}">
    <a class="blog-card-image" href="${path}" tabindex="-1" aria-hidden="true"><img src="${article.image.replace('.webp', '.thumb.webp')}" width="720" height="540" alt="" loading="lazy" decoding="async"></a>
    <div class="blog-card-copy"><div class="blog-meta"><span>${escape(article.category)}</span><span>${readingTime(article)} წუთი</span></div>
    <h2><a href="${path}">${escape(article.title)}</a></h2><p>${escape(article.excerpt)}</p>
    <div class="blog-card-bottom"><span>${String(index + 1).padStart(2, '0')} / გზამკვლევი</span><a href="${path}" aria-label="${escape(article.title)} — სტატიის წაკითხვა">წაიკითხეთ <span aria-hidden="true">↗</span></a></div></div>
  </article>`;
}

export function blogTeaser(articles) {
  return `<section class="wrap blog-teaser" aria-labelledby="blog-teaser-title"><div class="section-top"><div><span class="eyebrow muted">რჩევები თქვენი სივრცისთვის</span><h2 id="blog-teaser-title">სასარგებლო საკითხავი</h2></div><a class="blog-text-link" href="/blog/">ყველა სტატია <span aria-hidden="true">↗</span></a></div><div class="blog-teaser-grid">${articles.slice(0, 3).map((article, index) => articleCard(article, {index})).join('')}</div></section>`;
}

export async function buildBlog({config, homepage, articles}) {
  const template = await readFile(resolve(root, 'src/blog.html'), 'utf8');
  const contactUrl = `https://wa.me/${config.phone.replace(/\D/g, '')}`;
  const header = homepage.match(/<header>[\s\S]*?<\/header>/)[0]
    .replace('data-nav="blog"', 'data-nav="blog" class="active" aria-current="page"')
    .replace(/<button class="contact-btn" data-contact>([\s\S]*?)<\/button>/, `<a class="contact-btn" href="${contactUrl}" target="_blank" rel="noopener noreferrer">$1</a>`);
  const footer = homepage.match(/<footer>[\s\S]*?<\/footer>/)[0]
    .replace(/<button class="footer-contact" data-contact>([\s\S]*?)<\/button>/, `<a class="footer-contact" href="${contactUrl}" target="_blank" rel="noopener noreferrer">$1</a>`);
  const mobileContact = homepage.match(/<nav class="mobile-contact-bar"[\s\S]*?<\/nav>/)[0];
  const render = ({title, description, path, body, schema, image = 'assets/lithos-og-real.jpg', imageAlt = 'LITHOS — ქვის ზედაპირები', article = false}) => {
    const values = {PATH:path, TITLE:escape(title), DESCRIPTION:escape(description), URL:`https://lithos.ge${path}`, IMAGE:`https://lithos.ge/${image}`, IMAGE_ALT:escape(imageAlt), TYPE:article ? 'article' : 'website', JSONLD:`<script type="application/ld+json">${jsonLd(schema)}</script>`, HEADER:header, FOOTER:footer, MOBILE_CONTACT:mobileContact, BODY:body, SCRIPTS:article ? '' : '<script src="blog/blog.js" defer></script>'};
    return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => values[key]);
  };
  const categories = [...new Set(articles.map(article => article.category))];
  const indexBody = `<section class="wrap blog-intro"><span class="eyebrow muted">LITHOS / ბლოგი</span><div class="blog-intro-grid"><h1>პატარა რჩევები.<br><span class="text-accent">თქვენი სივრცისთვის.</span></h1><p>ქვის შერჩევიდან ყოველდღიურ მოვლამდე — პრაქტიკული სტატიები, რომლებიც სამზარეულოს დაგეგმვასა და მოწყობაში დაგეხმარებათ.</p></div></section>
  <section class="wrap blog-library" aria-labelledby="articles-heading"><h2 id="articles-heading" class="visually-hidden">სტატიები</h2>
    <form class="blog-tools" role="search" hidden data-blog-tools><label class="blog-search" for="blog-search"><span>მოძებნეთ სტატია</span><input type="search" id="blog-search" placeholder="მაგ.: ნიჟარა, მოვლა, კვარცი" autocomplete="off" aria-controls="blog-grid"></label>
    <fieldset class="blog-categories"><legend class="visually-hidden">სტატიის თემა</legend>${['ყველა', ...categories].map((category, index) => `<button type="button" data-blog-category="${index ? escape(category) : ''}" aria-pressed="${!index}" aria-controls="blog-grid">${escape(category)}</button>`).join('')}</fieldset></form>
    <p class="blog-result-count" id="blog-result-count" role="status" aria-live="polite">${articles.length} სტატია</p>
    <div class="blog-grid" id="blog-grid">${articles.map((article, index) => articleCard(article, {featured:index === 0, index})).join('')}</div>
    <div class="blog-empty" id="blog-empty" hidden><h2>სტატია ვერ მოიძებნა</h2><p>სცადეთ სხვა სიტყვა ან თემა.</p><button class="dark-btn" id="blog-reset" type="button">ძებნის გასუფთავება</button></div>
  </section>`;
  const blogDirectory = resolve(root, 'dist/blog');
  await mkdir(blogDirectory, {recursive:true});
  await writeFile(resolve(blogDirectory, 'index.html'), render({title:'ბლოგი — ქვისა და სამზარეულოს პრაქტიკული რჩევები | LITHOS', description:'ქვის შერჩევა, სამზარეულოს დაგეგმვა, აზომვა, მონტაჟი და მოვლა — LITHOS-ის 5 პრაქტიკული გზამკვლევი თქვენი სივრცისთვის.', path:'/blog/', body:indexBody, schema:{'@context':'https://schema.org', '@type':'Blog', name:'LITHOS ბლოგი', url:'https://lithos.ge/blog/', inLanguage:'ka-GE', blogPost:articles.map(article => ({'@type':'BlogPosting', headline:article.title, url:`https://lithos.ge${articlePath(article)}`}))}}));
  for (const article of articles) {
    const path = articlePath(article);
    const related = articles.filter(item => item.slug !== article.slug).sort((a, b) => Number(b.category === article.category) - Number(a.category === article.category)).slice(0, 2);
    const body = `<div class="wrap article-breadcrumbs"><nav aria-label="სანავიგაციო ჯაჭვი"><a href="/">მთავარი</a><span aria-hidden="true">/</span><a href="/blog/">ბლოგი</a></nav></div>
    <article class="blog-article"><div class="wrap article-heading"><div class="blog-meta"><span>${escape(article.category)}</span><span>${readingTime(article)} წუთი</span></div><h1>${escape(article.title)}</h1><p class="article-summary">${escape(article.excerpt)}</p><div class="article-byline"><span>LITHOS · გზამკვლევი</span><time datetime="${article.date}">${dateLabel(article.date)}</time></div></div>
    <figure class="wrap article-cover"><img src="${article.image}" width="1536" height="1024" alt="${escape(article.imageAlt)}" fetchpriority="high" decoding="async"><figcaption>LITHOS-ის შესრულებული ნამუშევარი · ფოტო საილუსტრაციოდ</figcaption></figure>
    <div class="wrap article-layout"><aside class="article-toc" aria-label="სტატიის სარჩევი"><p>ამ სტატიაში</p><ol>${article.sections.map(section => `<li><a href="${path}#${section.id}">${escape(section.heading.replace(/^\d+\. /, ''))}</a></li>`).join('')}</ol></aside>
    <div class="article-body"><p class="article-lead">${escape(article.intro)}</p>${article.sections.map(section => `<section id="${section.id}"><h2>${escape(section.heading)}</h2>${section.paragraphs.map(paragraph => `<p>${escape(paragraph)}</p>`).join('')}</section>`).join('')}
    <aside class="article-tip" aria-label="მარტივი ხრიკი"><span class="eyebrow">მარტივი ხრიკი</span><p>${escape(article.tip)}</p></aside>
    <section class="article-checklist" aria-labelledby="checklist-heading"><h2 id="checklist-heading">მოკლე სია თქვენთვის</h2><ul>${article.checklist.map(item => `<li>${escape(item)}</li>`).join('')}</ul></section>
    ${article.sources.length ? `<section class="article-sources" aria-labelledby="sources-heading"><h2 id="sources-heading">დამატებით წასაკითხად</h2><p>მასალის მოვლის წესები გადაამოწმეთ კონკრეტული მოდელისა და დამუშავების მიხედვით.</p><ul>${article.sources.map(source => `<li><a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.label)} ↗</a></li>`).join('')}</ul></section>` : ''}
    <div class="article-cta"><h2>გაქვთ თქვენი პროექტის იდეა?</h2><p>აირჩიეთ სასურველი მაგალითი და გაგვიზიარეთ სივრცის ფოტო — ერთად განვიხილოთ დეტალები.</p><div><a class="dark-btn" href="${contactUrl}" target="_blank" rel="noopener noreferrer">პროექტის განხილვა ↗</a><a class="blog-text-link" href="/materials/">მასალების ნახვა →</a></div></div><a class="blog-text-link article-back" href="/blog/">← ყველა სტატია</a></div></div></article>
    <section class="wrap blog-related" aria-labelledby="related-heading"><div class="section-top"><div><span class="eyebrow muted">გააგრძელეთ კითხვა</span><h2 id="related-heading">ესეც დაგაინტერესებთ</h2></div></div><div class="blog-related-grid">${related.map((item, index) => articleCard(item, {index})).join('')}</div></section>`;
    const directory = resolve(root, 'dist', path.slice(1));
    await mkdir(directory, {recursive:true});
    await writeFile(resolve(directory, 'index.html'), render({title:`${article.title} | LITHOS ბლოგი`, description:article.excerpt, path, body, image:article.image, imageAlt:article.imageAlt, article:true, schema:{'@context':'https://schema.org', '@graph':[{'@type':'BlogPosting', headline:article.title, description:article.excerpt, image:`https://lithos.ge/${article.image}`, datePublished:`${article.date}T12:00:00+04:00`, dateModified:`${article.date}T12:00:00+04:00`, author:{'@type':'Organization', name:'LITHOS', url:'https://lithos.ge/'}, publisher:{'@type':'Organization', name:'LITHOS', logo:{'@type':'ImageObject', url:'https://lithos.ge/assets/lithos-logo-v1.webp'}}, mainEntityOfPage:`https://lithos.ge${path}`, inLanguage:'ka-GE', articleSection:article.category, isPartOf:{'@type':'Blog', url:'https://lithos.ge/blog/'}}, {'@type':'BreadcrumbList', itemListElement:[{'@type':'ListItem', position:1, name:'მთავარი', item:'https://lithos.ge/'}, {'@type':'ListItem', position:2, name:'ბლოგი', item:'https://lithos.ge/blog/'}, {'@type':'ListItem', position:3, name:article.title, item:`https://lithos.ge${path}`}]}]}}));
  }
  return ['/blog/', ...articles.map(articlePath)];
}

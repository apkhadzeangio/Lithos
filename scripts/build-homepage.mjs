import {readFile, writeFile} from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));

export async function buildHomepage({config, articles, homepage, projects}) {
  const head = homepage.slice(0, homepage.indexOf('</head>') + 7)
    .replace('<link rel="stylesheet" href="blog/blog.css">', '')
    .replace('<link rel="stylesheet" href="site.css">', '');
  const dialogs = homepage.match(/<dialog id="detail"[\s\S]*?<\/dialog><dialog id="contact"[\s\S]*?<\/dialog>/)?.[0];
  if (!dialogs) throw new Error('Homepage requires the existing project and consultation dialogs.');
  const topics = [
    ['rogor-shevirchiot-kvis-zedapiri', 'ქვის ზედაპირის შერჩევა'],
    ['patara-samzareulos-dagegmva', 'პატარა სამზარეულოს ხრიკები'],
    ['kvis-zedapiris-movla', 'ყოველდღიური მოვლა']
  ];
  const journal = topics.map(([slug, label], index) => {
    if (!articles.some(article => article.slug === slug)) throw new Error(`Unknown article: ${slug}`);
    return `<article class="blog-card atelier-journal-row"><span>${String(index + 1).padStart(2, '0')}</span><h3><a href="/blog/${slug}/">${label}<span aria-hidden="true"> →</span></a></h3></article>`;
  }).join('');
  const businessDetails = ['why-lithos', 'location'].map(id => homepage.match(new RegExp(`<section\\b[^>]*id="${id}"[\\s\\S]*?<\\/section>`))?.[0] || '').join('');
  const times = ['measurement', 'fabrication', 'installation'].map(key => config.timeline?.[key]).filter(value => typeof value === 'string' && value.trim() && !value.includes('[შესავსები]'));
  const timeline = times.length ? `<p class="step-time atelier-confirmed-times">${times.map(value => 'ვადა: ' + escape(value)).join(' · ')}</p>` : '';
  const values = {HEAD:head, DIALOGS:dialogs, EMAIL:escape(config.email), PROJECTS:projects, JOURNAL:journal, BUSINESS_DETAILS:businessDetails, TIMELINE:timeline};
  const html = (await read('src/home.html')).replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => values[key]);
  await writeFile(new URL('dist/index.html', root), html);
}

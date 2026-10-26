import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = path => readFileSync(resolve(root, path), 'utf8');
const articles = JSON.parse(read('content/blog.json'));
execFileSync(process.execPath, ['scripts/build-public-pages.mjs'], {cwd:root});

test('all five articles are statically readable, share navigation and have matching metadata', () => {
  assert.equal(articles.length, 5);
  assert.equal(new Set(articles.map(article => article.slug)).size, 5);
  const sitemap = read('dist/sitemap.xml');
  for (const article of articles) {
    const path = `/blog/${article.slug}/`;
    const html = read(`dist${path}index.html`);
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    assert(html.includes(article.title));
    for (const section of article.sections) {
      assert(html.includes(`id="${section.id}"`));
      for (const paragraph of section.paragraphs) assert(html.includes(paragraph));
    }
    assert(html.includes(`href="${path}#main-content"`));
    assert(html.includes('data-nav="blog" class="active" aria-current="page"'));
    assert(html.includes(`rel="canonical" href="https://lithos.ge${path}"`));
    assert(!html.includes('src="app.js"'), 'catalog routing must not redirect article pages');
    assert(!html.includes('{{'));
    const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(schema['@graph'][0].headline, article.title);
    assert.equal(schema['@graph'][0].mainEntityOfPage, `https://lithos.ge${path}`);
    assert.equal(schema['@graph'][0].datePublished, `${article.date}T12:00:00+04:00`);
    assert(sitemap.includes(`<loc>https://lithos.ge${path}</loc>`));
  }
  const index = read('dist/blog/index.html');
  assert.equal((index.match(/<article class="blog-card/g) || []).length, 5);
  assert(index.includes('hidden data-blog-tools'), 'hide JS-only controls until initialized');
  const homepage = read('dist/index.html');
  assert.equal((homepage.match(/<article class="blog-card/g) || []).length, 3);
  for (const page of ['index.html','materials/index.html','neolith/index.html','quartz/index.html']) {
    assert(read(`dist/${page}`).includes('href="/blog/" data-nav="blog"'));
  }
});

test('local links, fragments and images resolve on both root and GitHub Pages subpaths', () => {
  const paths = ['/blog/', ...articles.map(article => `/blog/${article.slug}/`)];
  const decode = value => value.replaceAll('&amp;', '&').replaceAll('&#39;', "'").replaceAll('&quot;', '"');
  for (const base of ['', '/Lithos']) {
    for (const path of paths) {
      let html = read(`dist${path}index.html`);
      // The existing Pages workflow applies this rewrite to every generated HTML page.
      html = html.replace(/((?:href|src|action)=["'])\/(?!\/)/g, (_, open) => open + base + '/');
      const baseHref = html.match(/<base href="([^"]+)"/)[1];
      for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
        const url = new URL(decode(match[1]), `https://preview.example${baseHref}`);
        if (url.origin !== 'https://preview.example') continue;
        assert(url.pathname.startsWith(base + '/'), `${path}: missing deployment base in ${url}`);
        const relative = url.pathname.slice(base.length).replace(/^\//, '');
        const target = `dist/${relative}${url.pathname.endsWith('/') ? 'index.html' : ''}`;
        assert(existsSync(resolve(root, target)), `${path}: missing ${target}`);
        if (url.hash) assert(read(target).includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), `${path}: missing fragment ${url}`);
      }
    }
  }
});

test('search combines words with category and restores all articles after an empty result', () => {
  const element = (extra = {}) => ({hidden:false, value:'', attributes:{}, events:{}, addEventListener(type, callback) {this.events[type] = callback;}, setAttribute(key, value) {this.attributes[key] = value;}, focus() {this.focused = true;}, ...extra});
  const cards = articles.map(article => element({dataset:{category:article.category}, textContent:`${article.title} ${article.excerpt} ${article.category}`}));
  const buttons = ['', ...new Set(articles.map(article => article.category))].map(category => element({dataset:{blogCategory:category}}));
  const tools = element({hidden:true}), search = element(), count = element(), empty = element(), reset = element();
  const elements = {'[data-blog-tools]':tools, '#blog-search':search, '#blog-result-count':count, '#blog-empty':empty, '#blog-reset':reset};
  vm.runInNewContext(read('dist/blog/blog.js'), {document:{querySelector:selector => elements[selector], querySelectorAll:selector => selector === '[data-blog-category]' ? buttons : cards}});
  assert.equal(tools.hidden, false);
  assert.equal(count.textContent, '5 სტატია');
  const installation = buttons.find(button => button.dataset.blogCategory === 'აზომვა და მონტაჟი');
  installation.events.click();
  assert.equal(cards.filter(card => !card.hidden).length, 2);
  assert.equal(installation.attributes['aria-pressed'], 'true');
  search.value = 'ნიჟარა შეკვეთამდე'; search.events.input();
  assert.equal(cards.filter(card => !card.hidden).length, 1);
  search.value = '<script>no-match</script>'; search.events.input();
  assert.equal(count.textContent, '0 სტატია');
  assert.equal(empty.hidden, false);
  reset.events.click();
  assert.equal(count.textContent, '5 სტატია');
  assert.equal(empty.hidden, true);
  assert.equal(search.focused, true);
  search.value = 'NEOLITH'; search.events.input();
  assert.equal(cards.filter(card => !card.hidden).length, 1);
});

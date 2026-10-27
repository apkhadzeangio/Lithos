import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

// Every public page uses the approved home-page header, navigation and footer.
const root = fileURLToPath(new URL('..', import.meta.url));
const read = path => readFileSync(resolve(root, path), 'utf8');
execFileSync(process.execPath, ['scripts/build-public-pages.mjs'], {cwd:root});
const articles = readdirSync(resolve(root, 'dist/blog'), {withFileTypes:true}).filter(d => d.isDirectory()).map(d => `blog/${d.name}/index.html`);
const inner = ['materials/index.html', 'neolith/index.html', 'quartz/index.html', 'blog/index.html', ...articles, '404.html'];
const navOf = html => [...html.match(/<nav class="atelier-nav"[\s\S]*?<\/nav>/)[0].matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map(m => [m[1], m[2]]);

test('every page has the same header, navigation and footer as the home page', () => {
  const home = read('dist/index.html'), nav = navOf(home);
  assert.deepEqual(nav, [['/#projects', 'ნამუშევრები'], ['/materials/', 'მასალები'], ['/kitchen/', 'სამზარეულოს დიზაინერი'], ['/blog/', 'ჟურნალი']]);
  for (const page of inner) {
    const html = read(`dist/${page}`);
    assert.equal((html.match(/<header class="atelier-header">/g) || []).length, 1, page);
    assert.deepEqual(navOf(html), nav, page);
    assert.ok(html.includes('id="mobile-menu"') && html.includes('class="atelier-menu"'), `${page}: phone menu`);
    assert.equal((html.match(/<footer class="atelier-footer/g) || []).length, 1, page);
    assert.ok(!/<header>|class="contact-btn"|class="footer-contact"/.test(html), `${page}: old header or footer left`);
    assert.match(html, /<body class="site[ "]/, page);
    assert.ok(html.includes('site.css') && html.includes('architectural.js'), `${page}: shared styles and menu script`);
  }
  assert.match(home, /<body class="architectural">/);
  assert.ok(!home.includes('site.css') && !home.includes('blog/blog.css'), 'the approved home page keeps its own two stylesheets');
});

test('pages without the contact window open WhatsApp from the footer instead', () => {
  for (const page of ['blog/index.html', ...articles, '404.html']) {
    const footer = read(`dist/${page}`).match(/<footer class="atelier-footer[\s\S]*?<\/footer>/)[0];
    assert.ok(!footer.includes('data-contact'), page);
    assert.match(footer, /class="atelier-action atelier-action-light" href="https:\/\/wa\.me\/995551044013"/, page);
  }
});

test('header and footer styles for inner pages are mirrored from the approved stylesheet', () => {
  const approved = read('dist/architectural.css'), site = read('dist/site.css');
  for (const rule of ['.atelier-header{', '.atelier-nav{', '.atelier-footer{', '.atelier-footer h2{', '.atelier-action{', '.atelier-action-light{']) {
    assert.ok(approved.includes('.architectural ' + rule) && site.includes('.site ' + rule), rule);
  }
  assert.ok(site.includes('.site.js-ready .atelier-nav{display:none}'), 'phone menu replaces the navigation');
  assert.ok(!/\.site (h1|h2|h3|p|figure),/.test(site), 'the home page margin reset is not copied to content pages');
  for (const f of ['dist/site.css', 'dist/architectural.js', 'src/site.css']) assert.ok(existsSync(resolve(root, f)), f);
});

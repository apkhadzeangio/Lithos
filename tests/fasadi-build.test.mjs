import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,rm,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildFasadi} from '../scripts/build-fasadi.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
test('dedicated subdomain build resolves all local resources at root and admin routes',async()=>{
  const output=resolve(root,'out-fasadi-test-'+process.pid);
  try{
    await buildFasadi(output);
    for(const page of ['index.html','admin/index.html']){
      const html=await readFile(resolve(output,page),'utf8');
      for(const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)){
        const url=match[1];if(/^[a-z]+:|^\/\//i.test(url))continue;
        const target=resolve(dirname(resolve(output,page)),url.split(/[?#]/)[0]);
        assert.ok(target===output||target.startsWith(output+'/'),`${page}: resource escapes output: ${url}`);
        const resource=await stat(target);
        assert.ok(resource.isDirectory()?(await stat(resolve(target,'index.html'))).isFile():resource.isFile(),`${page}: ${url}`);
      }
      assert.ok(html.includes('href="https://lithos.ge/"'));
    }
    const html=await readFile(resolve(output,'index.html'),'utf8');
    assert.match(html,/rel="canonical" href="https:\/\/fasadi\.lithos\.ge\/"/);
    assert.ok(html.includes('href="https://lithos.ge/materials/"'));
    assert.ok(html.includes('href="https://lithos.ge/kitchen/"'));
    assert.ok((await readFile(resolve(output,'studio.mjs'),'utf8')).includes("a.href='https://lithos.ge/neolith/'"));
    assert.match(await readFile(resolve(output,'robots.txt'),'utf8'),/Disallow: \/admin\//);
    assert.match(await readFile(resolve(output,'config.js'),'utf8'),/apiBase:''/);
  }finally{await rm(output,{recursive:true,force:true});}
});
test('build cleanup cannot delete the repository root or source directories',async()=>{
  await assert.rejects(buildFasadi(root));
  await assert.rejects(buildFasadi(resolve(root,'src')));
  await assert.rejects(buildFasadi(resolve(root,'..','out-fasadi')));
});

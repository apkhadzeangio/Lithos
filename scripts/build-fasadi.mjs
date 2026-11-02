import {cp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function buildFasadi(output=resolve(root,'out-fasadi')){
  output=resolve(output);
  // Only delete a task-owned build directory; never the source or repository root.
  const relation=relative(root,output);
  if(!relation||relation.startsWith('..')||relation.split(/[\\/]/).length!==1||!relation.startsWith('out-fasadi'))throw Error('Use a top-level out-fasadi build directory.');
  await rm(output,{recursive:true,force:true});
  await mkdir(output,{recursive:true});
  await cp(resolve(root,'dist/exterior'),output,{recursive:true});
  for(const path of ['assets/lithos-logo-v1.webp','assets/neolith/rapolano.webp','favicon.ico']){
    await mkdir(dirname(resolve(output,path)),{recursive:true});
    await cp(resolve(root,'dist',path),resolve(output,path));
  }
  const page=resolve(output,'index.html');
  await writeFile(page,(await readFile(page,'utf8'))
    .replaceAll('href="../favicon.ico"','href="favicon.ico"')
    .replaceAll('src="../assets/','src="assets/')
    .replaceAll('href="../"','href="https://lithos.ge/"')
    .replaceAll('href="../materials/"','href="https://lithos.ge/materials/"')
    .replaceAll('href="../kitchen/"','href="https://lithos.ge/kitchen/"'));
  const admin=resolve(output,'admin/index.html');
  await writeFile(admin,(await readFile(admin,'utf8'))
    .replaceAll('href="../../"','href="https://lithos.ge/"')
    .replaceAll('src="../../assets/','src="../assets/'));
  const client=resolve(output,'studio.mjs');
  await writeFile(client,(await readFile(client,'utf8')).replaceAll("a.href='../neolith/'","a.href='https://lithos.ge/neolith/'"));
  await writeFile(resolve(output,'robots.txt'),'User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: https://fasadi.lithos.ge/sitemap.xml\n');
  await writeFile(resolve(output,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://fasadi.lithos.ge/</loc></url></urlset>\n');
  await writeFile(resolve(output,'_headers'),'/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n\n/admin/*\n  Cache-Control: no-store\n  X-Robots-Tag: noindex, nofollow\n\n/config.js\n  Cache-Control: no-cache\n\n/assets/*\n  Cache-Control: public, max-age=86400\n');
  return output;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log('Built fasadi.lithos.ge static root: '+await buildFasadi());

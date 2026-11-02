import {cp,mkdir,rm,writeFile} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function buildFarda(output=resolve(root,'out-farda')){
 output=resolve(output);const rel=relative(root,output);if(!rel||rel.startsWith('..')||rel.split(/[\\/]/).length!==1||!rel.startsWith('out-farda'))throw Error('Use a top-level out-farda output directory.');
 await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});await cp(resolve(root,'dist/curtains'),output,{recursive:true});
 await writeFile(resolve(output,'robots.txt'),'User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: https://farda.lithos.ge/sitemap.xml\n');
 await writeFile(resolve(output,'sitemap.xml'),'<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://farda.lithos.ge/</loc></url></urlset>\n');
 await writeFile(resolve(output,'_headers'),'/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n\n/admin/*\n  Cache-Control: no-store\n  X-Robots-Tag: noindex, nofollow\n\n/config.js\n  Cache-Control: no-cache\n');return output;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(await buildFarda());

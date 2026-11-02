// Cloudflare Workers AI reference-image adapter. The customer photo is mandatory.
import {renovationPrompt} from '../../dist/exterior/core.mjs';
export const MODEL='@cf/black-forest-labs/flux-2-klein-4b';
export const bytesFromBase64=data=>Uint8Array.from(atob(data),c=>c.charCodeAt(0));
export function imageMime(bytes){
 if(bytes.length>8&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)return 'image/png';
 if(bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.length>12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
export function jpegSize(bytes){
 let offset=2;
 while(offset+9<bytes.length){
  if(bytes[offset++]!==255)throw Error('invalid-jpeg');while(bytes[offset]===255)offset++;
  const marker=bytes[offset++];if(marker===217||marker===218)break;
  if(marker===1||marker>=208&&marker<=215)continue;
  const length=bytes[offset]*256+bytes[offset+1];if(length<2||offset+length>bytes.length)throw Error('invalid-jpeg');
  if([192,193,194].includes(marker)){const width=bytes[offset+5]*256+bytes[offset+6],height=bytes[offset+3]*256+bytes[offset+4];if(!width||!height)break;return {width,height};}
  offset+=length;
 }throw Error('invalid-jpeg');
}
export async function editExterior(env,{image,preferences}){
 const input=bytesFromBase64(image.data),size=jpegSize(input),scale=1024/Math.max(size.width,size.height);
 const form=new FormData();form.append('prompt',renovationPrompt(preferences));
 // Never omit this field or fall back to text-to-image on failure.
 form.append('input_image_0',new Blob([input],{type:'image/jpeg'}),'customer-house.jpg');
 form.append('width',String(Math.max(256,Math.round(size.width*scale/16)*16)));form.append('height',String(Math.max(256,Math.round(size.height*scale/16)*16)));
 const multipart=new Response(form);
 const output=await env.AI.run(MODEL,{multipart:{body:multipart.body,contentType:multipart.headers.get('content-type')}});
 if(typeof output?.image!=='string'||output.image.length>12*1024*1024)throw Error('invalid-image');
 const bytes=bytesFromBase64(output.image),mime=imageMime(bytes);if(!mime)throw Error('invalid-image');
 return {mime_type:mime,data:output.image};
}

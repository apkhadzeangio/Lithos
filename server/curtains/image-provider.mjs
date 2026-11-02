import {curtainPrompt,FABRICS,normalizePreferences} from '../../dist/curtains/core.mjs';
// Optional future image-editing adapter; not invoked by the working 2D studio.
// Both actual window and canonical fabric photograph are mandatory references.
export async function editCurtainImage(env,{windowPhoto,fabricPhoto,preferences}){
 const p=normalizePreferences(preferences);if(!(windowPhoto instanceof Blob)||!(fabricPhoto instanceof Blob)||!windowPhoto.size||!fabricPhoto.size)throw Error('Both image references are required.');
 if(windowPhoto.size>1024*1024||fabricPhoto.size>1024*1024)throw Error('Prepare image references below 1 MiB and 500 pixels before inference.');
 const form=new FormData();form.append('prompt',curtainPrompt(p));form.append('input_image_0',windowPhoto,'window.jpg');form.append('input_image_1',fabricPhoto,FABRICS.find(f=>f.id===p.fabric).id+'.jpg');form.append('width','1024');form.append('height','768');
 const body=new Response(form);return env.AI.run('@cf/black-forest-labs/flux-2-klein-4b',{multipart:{body:body.body,contentType:body.headers.get('content-type')}});
}

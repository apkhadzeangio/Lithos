// One textured quad. No framework, generated imagery, video or autonomous loop.
const vertex = `
attribute vec2 a_position;
varying vec2 v_uv;
void main(){v_uv=a_position*.5+.5;gl_Position=vec4(a_position,0.,1.);}`;
const fragment = `
precision mediump float;
uniform sampler2D u_photo;
uniform vec2 u_cover;
uniform vec2 u_texel;
uniform vec2 u_pointer;
uniform float u_aspect;
uniform float u_roughness;
uniform float u_specular;
varying vec2 v_uv;
float luminance(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
void main(){
  vec2 uv=(v_uv-.5)*u_cover+.5;
  vec3 stone=texture2D(u_photo,uv).rgb;
  float center=luminance(stone);
  vec2 gradient=vec2(luminance(texture2D(u_photo,uv+vec2(u_texel.x,0.)).rgb)-center,
                     luminance(texture2D(u_photo,uv+vec2(0.,u_texel.y)).rgb)-center);
  vec3 normal=normalize(vec3(-gradient*1.2,1.));
  vec2 point=(v_uv-u_pointer)*vec2(u_aspect,1.);
  float distanceToStrip=abs(dot(point,normalize(vec2(.82,.57))));
  float width=mix(.038,.26,u_roughness*u_roughness);
  float strip=exp(-distanceToStrip*distanceToStrip/(width*width));
  vec3 halfVector=normalize(vec3(point*.15,1.));
  float exponent=mix(180.,12.,u_roughness*u_roughness);
  float highlight=pow(max(dot(normal,halfVector),0.),exponent)*strip*u_specular;
  vec3 color=stone*.965+vec3(highlight);
  gl_FragColor=vec4(clamp(color,0.,1.),1.);
}`;
const finishes = {
  polished:{label:'Polished', roughness:.14, specular:.34},
  silk:{label:'Silk', roughness:.56, specular:.16},
  satin:{label:'Satin', roughness:.82, specular:.085}
};

export function createSurface({photo, text, preference, staticToggle}) {
  const slab = document.querySelector('#slab');
  const canvas = document.querySelector('#surface-canvas');
  const buttons = [...document.querySelectorAll('[data-finish]')];
  const instruction = document.querySelector('#surface-instruction');
  const gl = canvas.getContext('webgl', {alpha:true, antialias:false, depth:false, stencil:false, preserveDrawingBuffer:false, powerPreference:'low-power'});
  if (!gl) {text('render-status','სტატიკური ფოტო — WebGL მიუწვდომელია');return null;}
  let program, buffer, texture;
  try {
    program = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source); gl.compileShader(shader); gl.attachShader(program, shader); gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Shader: '+gl.getProgramInfoLog(program));
    gl.useProgram(program);
    buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, photo);
    const error=gl.getError();if (error !== gl.NO_ERROR) throw new Error('Texture: '+error);
  } catch(error) {
    text('render-status','სტატიკური ფოტო — '+error.message);
    if(texture)gl.deleteTexture(texture);if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);
    return null;
  }
  performance.mark('lab-webgl-ready');
  const uniforms = Object.fromEntries(['u_photo','u_cover','u_texel','u_pointer','u_aspect','u_roughness','u_specular'].map(name=>[name,gl.getUniformLocation(program,name)]));
  gl.uniform1i(uniforms.u_photo,0);
  gl.uniform2f(uniforms.u_texel,1/photo.naturalWidth,1/photo.naturalHeight);
  let visible=false, disabled=false, lost=false, raf=0, frames=0;
  let current=[.48,.56], target=[.48,.56], finish=finishes.polished, aspect=1;
  const canRender=()=>visible&&!document.hidden&&!disabled&&!lost&&!preference.matches&&!staticToggle.checked;
  function stop(reason){cancelAnimationFrame(raf);raf=0;text('activity-status',reason);}
  function request(){if(canRender()&&!raf)raf=requestAnimationFrame(draw);}
  function resize(){
    if(lost)return;
    const {width,height}=slab.getBoundingClientRect();
    if(!width||!height)return;
    const dpr=Math.min(window.devicePixelRatio||1,2,Math.sqrt(2000000/(width*height)));
    const w=Math.max(1,Math.round(width*dpr)),h=Math.max(1,Math.round(height*dpr));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
    aspect=width/height;
    const imageAspect=photo.naturalWidth/photo.naturalHeight;
    gl.uniform2f(uniforms.u_cover,aspect<imageAspect?aspect/imageAspect:1,aspect>imageAspect?imageAspect/aspect:1);
    gl.uniform1f(uniforms.u_aspect,aspect);
    text('dpr-status',dpr.toFixed(2));request();
  }
  function draw(){
    raf=0;if(!canRender())return;
    current=current.map((value,i)=>value+(target[i]-value)*.22);
    gl.uniform2f(uniforms.u_pointer,current[0],current[1]);
    gl.uniform1f(uniforms.u_roughness,finish.roughness);
    gl.uniform1f(uniforms.u_specular,finish.specular);
    gl.drawArrays(gl.TRIANGLES,0,6);
    frames++;text('frame-status',String(frames));
    canvas.hidden=false;
    if(Math.hypot(target[0]-current[0],target[1]-current[1])>.0004){text('activity-status','სინათლე მოძრაობს');request();}
    else text('activity-status','მზადაა — უწყვეტი რენდერი გამორთულია');
  }
  function point(event){
    if(!canRender())return;
    const rect=slab.getBoundingClientRect();
    target=[Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),Math.max(0,Math.min(1,1-(event.clientY-rect.top)/rect.height))];
    request();
  }
  slab.addEventListener('pointerdown',point,{passive:true});
  slab.addEventListener('pointermove',point,{passive:true});
  slab.addEventListener('keydown',event=>{
    const steps={ArrowLeft:[-.08,0],ArrowRight:[.08,0],ArrowUp:[0,.08],ArrowDown:[0,-.08]};
    if(!steps[event.key]||!canRender())return;
    event.preventDefault();target=target.map((v,i)=>Math.max(0,Math.min(1,v+steps[event.key][i])));request();
  });
  for(const button of buttons)button.addEventListener('click',()=>{
    if(disabled||lost)return;
    finish=finishes[button.dataset.finish];
    for(const item of buttons)item.setAttribute('aria-pressed',String(item===button));
    text('finish-status',finish.label);text('material-status',finish.roughness+' / '+finish.specular);request();
  });
  const intersection=new IntersectionObserver(entries=>{
    visible=entries[0].isIntersecting;
    if(visible){resize();request();}else stop('პაუზა — ზედაპირი ეკრანს მიღმაა');
  },{threshold:0});intersection.observe(slab);
  const onVisibility=()=>{if(document.hidden)stop('პაუზა — ჩანართი დაფარულია');else request();};
  document.addEventListener('visibilitychange',onVisibility);
  if('ResizeObserver' in window)new ResizeObserver(()=>{if(visible&&!lost)resize();}).observe(slab);
  else window.addEventListener('resize',()=>{if(visible&&!lost)resize();},{passive:true});
  canvas.addEventListener('webglcontextlost',event=>{
    event.preventDefault();lost=true;stop('სტატიკური ფოტო — WebGL შეწყდა');canvas.hidden=true;
    for(const button of buttons)button.disabled=true;
    text('render-status','სტატიკური ფოტო');instruction.textContent='ნაჩვენებია რეალური ფილის ფოტო. ინტერაქტიული ხედი შეჩერებულია.';
  });
  for(const button of buttons)button.disabled=false;
  text('render-status','სუფთა WebGL');text('material-status',finish.roughness+' / '+finish.specular);
  instruction.textContent='გადაატარე კურსორი ან თითი. კლავიატურით გამოიყენე მიმართულების ღილაკები.';
  resize();
  return {setStatic(value){
    disabled=value;canvas.hidden=value||lost;
    for(const button of buttons)button.disabled=value||lost;
    text('render-status',value||lost?'სტატიკური ფოტო':'სუფთა WebGL');
    if(value)stop('სტატიკური ფოტო — მოძრაობა გამორთულია');else{resize();request();}
  }};
}

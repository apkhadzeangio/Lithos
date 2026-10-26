(() => {
  'use strict';
  const photo = document.querySelector('#slab-photo');
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const staticToggle = document.querySelector('#static-mode');
  const instruction = document.querySelector('#surface-instruction');
  let renderer, loading = false, photoPainted = false;
  const text = (id, value) => { document.getElementById(id).textContent = value; };
  const staticReason = () => preference.matches ? 'მოძრაობის შემცირება ჩართულია.' : navigator.connection?.saveData ? 'მონაცემების დაზოგვა ჩართულია.' : 'ნაჩვენებია რეალური ფილის ფოტო.';
  const shouldStayStatic = () => preference.matches || staticToggle.checked || navigator.connection?.saveData;
  if (new URLSearchParams(location.search).has('static')) staticToggle.checked = true;
  if ('PerformanceObserver' in window) {
    try { new PerformanceObserver(list => {
      const entry = list.getEntries().at(-1);
      if (entry) text('lcp-status', (entry.startTime / 1000).toFixed(2) + ' წმ');
    }).observe({type:'largest-contentful-paint', buffered:true}); } catch {}
  }
  async function enhance() {
    if (!photoPainted || loading || renderer) return;
    if (shouldStayStatic() || !('IntersectionObserver' in window)) {
      instruction.textContent = staticReason(); return;
    }
    loading = true;
    try {
      const {createSurface} = await import('/lab/surface.js');
      if (shouldStayStatic()) return;
      renderer = createSurface({photo, text, preference, staticToggle});
      if (!renderer) instruction.textContent = 'ნაჩვენებია რეალური ფილის ფოტო. ამ მოწყობილობაზე ინტერაქტიული ხედი მიუწვდომელია.';
    } catch {
      instruction.textContent = 'ნაჩვენებია რეალური ფილის ფოტო. ინტერაქტიული ხედი ვერ ჩაირთო.';
    } finally { loading = false; }
  }
  function updatePreference() {
    renderer?.setStatic(shouldStayStatic());
    if (shouldStayStatic()) instruction.textContent = staticReason();
    else if (renderer) instruction.textContent = 'გადაატარე კურსორი ან თითი. კლავიატურით გამოიყენე მიმართულების ღილაკები.';
    else enhance();
  }
  preference.addEventListener?.('change', updatePreference);
  staticToggle.addEventListener('change', updatePreference);
  async function afterPhoto() {
    if (!photo.naturalWidth) { instruction.textContent = 'ფოტო ვერ ჩაიტვირთა. განაახლე გვერდი ან დაგვიკავშირდი.'; return; }
    try { await photo.decode(); } catch {}
    requestAnimationFrame(() => requestAnimationFrame(() => {
      photoPainted = true;
      performance.mark('lab-photo-painted');
      text('photo-status', (performance.now() / 1000).toFixed(2) + ' წმ');
      const start = () => enhance();
      if ('requestIdleCallback' in window) requestIdleCallback(start, {timeout:700});
      else setTimeout(start, 80);
    }));
  }
  if (photo.complete) afterPhoto();
  else { photo.addEventListener('load', afterPhoto, {once:true}); photo.addEventListener('error', () => {instruction.textContent='ფოტო ვერ ჩაიტვირთა. განაახლე გვერდი ან დაგვიკავშირდი.';}, {once:true}); }
})();

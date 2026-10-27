/* Progressive enhancement: navigation and a subtle, pointer-lit material study. */
document.body.classList.add('js-ready');
/* Shared by every page: the menu always exists; the gallery and the stone study only on the home page. */
const menuButton = document.querySelector('.atelier-menu');
const mobileMenu = document.querySelector('#mobile-menu');
if (menuButton && mobileMenu) {
  menuButton.hidden = false;
  const closeMenu = () => { menuButton.setAttribute('aria-expanded', 'false'); mobileMenu.hidden = true; };
  menuButton.addEventListener('click', () => {
    const expanded = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!expanded)); mobileMenu.hidden = expanded;
  });
  mobileMenu.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !mobileMenu.hidden) { closeMenu(); menuButton.focus(); } });
}
const galleryButton = document.querySelector('[data-gallery-toggle]');
galleryButton?.addEventListener('click', () => {
  const gallery = document.querySelector('#all-projects');
  gallery.hidden = !gallery.hidden;
  galleryButton.setAttribute('aria-expanded', String(!gallery.hidden));
  galleryButton.textContent = gallery.hidden ? 'ყველა ნამუშევარი →' : 'არქივის დახურვა −';
});
const slab = document.querySelector('[data-stone-study]');
const stage = slab?.parentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
let frame;
stage?.addEventListener('pointermove', event => {
  if (reducedMotion.matches || !finePointer.matches) return;
  const bounds = stage.getBoundingClientRect();
  const x = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width - .5) * 2));
  const y = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height - .5) * 2));
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => { slab.style.transform = `rotate(6deg) rotateX(${-y * 3}deg) rotateY(${x * 4}deg)`; });
});
stage?.addEventListener('pointerleave', () => { cancelAnimationFrame(frame); slab.style.transform = ''; });
reducedMotion.addEventListener('change', () => { cancelAnimationFrame(frame); if (slab) slab.style.transform = ''; });

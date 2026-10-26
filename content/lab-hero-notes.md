# LITHOS /lab/ — Surface hero experiment

This stage adds only `/lab/`. All existing home, catalog, contact and SEO files are unchanged. `/lab/` has `noindex, nofollow`, has no link from the main navigation, and is not added to the sitemap. Main-page promotion requires the owner's explicit approval.

## Design and implementation

- Cold stone palette: #24282B, #F1F1EE, #4E5356, #9A9C98; #8B6B43 only for the primary CTA and focus rings. White CTA text is used for 4.90:1 contrast against bronze; Pietra body text on Calacatta is 6.88:1. Pale vein gray is used for decorative rules, not small body text.
- One self-hosted variable family: Noto Sans Georgian, wght 100–900, with Georgian, Mtavruli and Latin glyphs. The original Google Fonts font has been subset and the wdth axis fixed at 100. SIL OFL license is included. The hero uses regular Georgian forms; Mtavruli is not applied elsewhere.
- Existing real photo: `/assets/neolith/calacatta-gold.webp`, 1234×1800, 156,980 bytes. Original file unchanged. No AI images. The logo is a technical size/format conversion of the existing transparent artwork, confined to `/lab/assets/`.
- Plain image is loaded eagerly at high priority. A decoded photo is given two animation frames to paint; the WebGL module is then loaded in idle time. No Three.js or OGL dependency.
- One textured WebGL quad. Polished / Silk / Satin use different roughness and specular uniforms. Values are visual simulation parameters, not manufacturer specifications or new catalog data.
- Pointer and touch input move a diagonal light strip. `touch-action: pan-y` preserves vertical page scrolling. Arrow keys on the surface provide keyboard control.
- IntersectionObserver and page visibility pause rendering. Frames are requested only while light position is settling or the material/size changes; there is no permanent render loop. DPR ≤2 with an additional 2-million-pixel buffer budget.
- Reduced motion, Save Data, no IntersectionObserver, no WebGL, initialization errors and context loss keep the original static image. Explicit static mode is available in the technical panel; `?static` also selects it.
- No other animation, catalog changes, view transitions, magnifier, scroll-timeline or main-site identity changes are included in this hero-only stage.

## Verification

- `node --check dist/lab/boot.js` and `node --check dist/lab/surface.js` pass.
- `node tests/lab-surface.test.mjs` passes: finish uniforms, pointer/keyboard updates, idle/offscreen/hidden/reduced-motion/static pauses, DPR cap and unsupported/context-loss fallbacks.
- The exact vertex/fragment shaders compile and link in native Mesa OpenGL ES. The actual existing WebP texture uploads without errors; all three modes produce distinct renders; moving the pointer changes the render. This is native software GL verification, not a browser visual test.
- The cloud browser does not provide WebGL. The static fallback has been visually verified in that browser. The interactive effect therefore still needs visual review on a WebGL-capable device.
- 360px CSS viewport check: no horizontal overflow; all visible buttons/links ≥44px; actual font family confirmed. Georgian and “Calacatta Gold” were inspected together.
- Initial resource payload is approximately 220KB before HTTP compression; surface.js is deferred and <10KB. Cold 4G LCP <2.5s is a target, not a measured guarantee in this environment. The page reports its current-load LCP for review, without representing that result as a throttled 4G measurement.

## Files

- dist/lab/index.html
- dist/lab/lab.css
- dist/lab/boot.js
- dist/lab/surface.js
- dist/lab/assets/noto-sans-georgian-variable.woff2
- dist/lab/assets/lithos-logo.webp
- dist/lab/assets/OFL.txt
- tests/lab-surface.test.mjs
- content/lab-hero-notes.md

Font source: https://github.com/google/fonts/tree/main/ofl/notosansgeorgian
Font license: included at dist/lab/assets/OFL.txt
The existing photo and all existing public pages remain in their original paths.

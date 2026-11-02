# LITHOS — ფარდის სტუდია

New, independent curtain studio prepared for `farda.lithos.ge`. The existing LITHOS homepage, material catalog and kitchen designer are preserved. The source lives in `dist/curtains/`; it works at `/curtains/` within the existing static site or at the root of a separate domain after the dedicated build.

## Working customer journey

1. Upload a JPEG, PNG or WebP window photo (up to 15 MB), or use the mobile camera input. A demonstration window is available for exploring the tool; orders require an uploaded customer photo.
2. Select one of eight real supplier catalog models, filter thick/thin curtains, and choose one of six curtain designs: wave, pencil, pinch, eyelet, Roman or two layers. A second sheer fabric can be selected for the layered design.
3. Adjust the curtain area on the actual photo using handles or keyboard accessible sliders. Change opening, mounting, length, dimensions, fullness and a desired color note. Compare the original with the rendered result.
4. Download the 2D sketch or a JSON project containing both prepared images and canonical fabric information. Enter contact details and explicit consent to prepare a quotation request in LITHOS's WhatsApp composer. The customer confirms sending and attaches the photos, or uses the device share sheet where supported.

The current visualization is a functional Canvas 2D concept using representative sample tones and texture from supplier photographs. It preserves the uploaded room and window. It does not predict exact fabric drape, color, installation feasibility or a purchasable shade variant. Site copy labels this throughout. Dimension calculations give an approximate spread width, not a price or cutting plan.

## Commercial data

The catalog was checked against MeFarde.ge's public product pages and Shopify JSON on 2026-11-02. Each item records the supplier's product ID, original product URL, original photograph URL, composition and stated height. No stock feed, exact color variant, supplier partnership or procurement integration is implied. Prices are intentionally `null`; stock, variant, sewing compatibility and final quotation require confirmation.

| Local ID | Supplier model | Supplier product ID | Type | Stated maximum height |
| --- | --- | --- | --- | --- |
| wiens | სქელი მოხარშული ტილო - Wiens | 7965407478017 | Thick | 300 cm |
| tivit | სქელი ტილოს ფარდა Tivit | 7982290993409 | Thick | 300 cm |
| soft-velvet | ფრანგული ხავერდი Soft Micro Valvet | 8284284027137 | Thick | 300 cm |
| basel | სქელი ფარდა Basel | 7983458943233 | Thick | 280 cm |
| elegant | თხელი ტილო Elegant | 7982315077889 | Sheer | 300 cm |
| crepe | კლასიკური კრეპი | 7754925211905 | Sheer | 300 cm |
| romilda | წული Romilda | 7758139818241 | Sheer | 300 cm |
| royal | ხავერდი Royal Valvet | 7965432447233 | Thick | 300 cm |

Exact links and image provenance are in `dist/curtains/catalog.mjs`. Supplier photographs retain their watermarks. They are public reference material, not LITHOS original photography. Confirm commercial image permission before wider launch. Refresh the source data and physical shade samples before offering confirmed stock or prices. The supplier describes the selected models as polyester; their Georgian marketing names do not establish natural linen composition. The six visual designs are studio options; specialist sewing and hardware compatibility must be confirmed separately.

## Data handling and ordering

Photo preparation happens in the browser: maximum 50 megapixels on input, resized to a 1600 pixel long edge, re-encoded as JPEG and limited to 2 MB. Canvas re-encoding removes original file metadata. The app uses no localStorage, analytics or persistent browser contact store. Leaving the page clears in-memory photos/contact data; explicit downloads remain on the customer's device.

The configured public LITHOS WhatsApp destination is `995551044013`, matching the existing site. Verify operational routing before launch. WhatsApp receives the prepared text only when the customer opens its composer; photos are attached separately. The studio never reports a draft as sent or received. The JSON includes `submitted: false`. This is a quotation request and has no checkout or payment.

## Prepared integrations, currently inactive

`server/curtains/worker.mjs` provides an optional private order service using Cloudflare D1, private R2, Turnstile, durable quotas and administrator authentication. It is not deployed or wired to the public submit form. The shipped customer journey uses WhatsApp. Merely setting `apiBase` does not enable direct customer API submissions; that setting currently serves the prepared admin panel only.

The optional backend validates and canonicalizes all preferences, requires consent and two JPEGs, fails closed without configured storage/challenge/secrets/retention, limits requests before storage, supports idempotent references and keeps images private. It exposes authenticated order status, notes, photo retrieval and deletion. Expired orders cannot be read; the scheduled job removes expired and incomplete uploads. Intended retention is 30 days. No production data has been collected.

`server/curtains/image-provider.mjs` is a future AI editing adapter requiring both the actual window photo and the selected fabric photograph. It is covered by mocked contract tests only. It has no live route, UI trigger, cost provisioning or production inference verification. Photorealistic AI output is not part of the working 2D preview. Layered AI rendering would additionally need a second canonical fabric reference and evaluation before activation.

## Assets and design

Warm ivory, olive and taupe layout, existing LITHOS logo and Georgian product copy. Local assets require no third-party image hotlink or font request at runtime.

- `hero.webp`: AI-created illustrative warm living room with floor-to-ceiling curtains, soft sunlight and a Tbilisi view. Not presented as a supplier SKU.
- `sample-window.webp`: AI-created frontal bare window in a neutral living room, used only as the explicit demo photo.
- Eight named fabric WebPs: resized supplier photographs; original URLs remain in the catalog.
- `logo.webp` and `favicon.ico`: copied from the existing LITHOS brand assets.

Generation brief for the hero: editorial interior photograph, warm contemporary Georgian living room, beige curtains with translucent sheers, expansive garden/city view, natural morning light, restrained neutral palette, generous composition for a premium curtain studio, no text or invented branding. Generation brief for the demo: frontal large bare three-pane window, neutral interior with the full window and floor visible, no curtains, consistent architectural geometry, no text.

## Local build and verification

```sh
node scripts/build-farda.mjs
node --test tests/curtains.test.mjs
```

The dependency-free build creates `out-farda/` with root-relative deployment behavior, canonical URLs, robots/sitemap and static response headers. It does not overwrite the main site's `dist/` or `.openai/hosting.json`. Only top-level `out-farda*` build directories can be removed by the builder.

See `FARDA_DEPLOY_GE.md` for domain publication and `CURTAIN_QA.md` for verification and remaining limits.

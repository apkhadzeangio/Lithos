# Curtain studio verification — 2026-11-02

## Automated coverage

`node --test tests/curtains.test.mjs`: 11 passing tests. Uses Node's in-memory SQLite and mocked platform bindings; no production order, third-party message or AI inference is created.

- Eight canonical supplier records, source URLs and local images; no invented prices or stock.
- Six designs; bounded positions, normalized measurements and fullness; quote calculations and height warning.
- Required consent/contact fields and canonical supplier identity in the prepared order.
- Optional AI adapter requires both reference images and a server-composed prompt.
- Backend fails closed without provisioning or for a foreign origin; malformed files, missing consent and wrong challenge hostname are rejected.
- Durable request quota precedes storage; repeat reference is idempotent.
- Real SQLite storage flow, admin authentication, private photo retrieval, expiry and deletion.
- Durable quota across instances, burst and global limits.
- Dedicated root build, resource paths, canonical domain and output-directory guard.

## Browser evidence

Desktop browser with the actual built app:

- Initial demo loads with fabric photographs, live canvas, eight fabric cards and six design choices.
- Demo cannot be used for an order. Invalid file format is rejected.
- A real file chooser upload of the generated bare-window test fixture is accepted as a customer-photo input; the studio changes to the uploaded-photo state.
- Changing to Tivit and two layers redraws curtains on the uploaded image. Original/design comparison, opening slider and placement sliders respond.
- Search empty state and the three-item sheer filter work.
- Order dialog carries the selected design, dimensions and supplier identity. Invalid phone is rejected. Valid synthetic contact prepares the WhatsApp composer/fallback link; no message was sent.
- Project download emits a browser download event. The cloud browser's returned download path did not materialize in the shared filesystem, so the exported file's bytes could not be independently inspected through this environment.
- Responsive iframes at 360 and 768 outer pixels show no horizontal overflow: document widths equal scroll widths (345 and 753 pixels after browser scrollbars). Mobile design selection updates Roman fullness to 1.15.
- No application console error observed during these paths; browser extension metadata errors are unrelated to the app.

## Remaining production checks

Actual phone camera behavior, mobile file share availability, successful local download persistence, WhatsApp delivery and manual attachment are device/service checks to perform before public launch. The studio truthfully reports preparation only. Optional Cloudflare storage/admin/retention and AI are prepared source, not live services. Prices, exact shade variants and stock require supplier confirmation. Custom domain activation is pending access to the user's DNS/hosting account.

The repository has one known unrelated pre-existing failure in `tests/review-fixes.test.mjs`, which references paths at historical commit `68c9c6ae`. It was reproduced on unchanged base `5679cb6` during the preceding exterior task. The full current run is 96 passing / 97 total, with only that same historical fixture failure. This change does not edit that test or the existing application.

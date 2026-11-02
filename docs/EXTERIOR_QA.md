# Exterior Studio validation — 2 November 2026

Base: `5679cb6d7b143b45dc234ad8fb05c0345f287c84`, branch `feat/exterior-studio`.

## Automated

`node --test tests/exterior.test.mjs`: **12 passed**. Tests cover canonical preferences and prompt invariants; consent and contact validation; disabled-service disclosure; foreign-origin and malformed-file rejection; Turnstile hostname validation; inference quotas; transport of the exact uploaded image to the provider; signed receipts and tamper/expiry rejection; actual in-memory SQLite lead persistence and duplicate submission handling; authenticated private photo access; status updates; retention deletion; durable quota persistence; sanitized provider errors with no fallback/retry.

`node --test tests/*.test.mjs`: **97 passed, 1 pre-existing failure**. The failing historical regression script reads catalog files from a commit where those paths do not exist. The exact same failure was reproduced on the unchanged base in a separate detached worktree. Catalog data and that historical regression script are unchanged by this work.

Syntax checks for the new client, admin, core and Worker modules passed. `git diff --check` passed.

## Browser checks

Performed in Chrome through the managed preview, with generated non-customer photographs and synthetic contact data:

- Homepage retains the existing kitchen entry and adds an exterior entry that opens `/exterior/`.
- Hero photographs load, and comparison uses a native labelled range control.
- Missing-photo generation shows a Georgian error and focuses the upload control.
- Non-image uploads are rejected with format/size guidance.
- An actual WebP file uploads, is recompressed to JPEG, and displays a preview and processed size.
- The sample-house shortcut loads successfully; uploaded photo replacement/removal controls are visible.
- Modern Luxury demo shows the aligned sample-house before/after result.
- Uploaded-photo demo explicitly says the visitor photo was neither transformed nor transmitted.
- Range control responds to keyboard movement and updates the comparison CSS position.
- Selecting a different style invalidates the old result. A Mediterranean style example is explicitly independent and has no comparison slider.
- Advanced controls expand; intensity, lighting and material selections update correctly.
- Selecting porcelain exposes the existing NEOLITH catalog link with a suitability/stock qualification.
- Project JSON downloads successfully. Its bytes were inspected: original photo is embedded, mode is `demo`, `submitted` is false, and no fabricated generated photo is attached.
- Consultation form opens with an attachment summary, demo disclosure and consent control.
- Invalid phone input is rejected. Synthetic valid contact data produces a downloadable draft with consent and `submitted: false`; the UI states it has not been sent to LITHOS.
- Responsive rendering was checked inside real browser iframe viewports at 360 and 768 pixels. A mobile upload-canvas overflow was fixed. At 360 pixels the rendered viewport/content widths both measure 345 pixels after the scrollbar, with one workbench column; tablet uses two columns without overflow.
- Mobile navigation opens, and the complete sample-to-result flow succeeds in the 360-pixel viewport without horizontal overflow.

## Limits

No paid/live model request, Cloudflare deployment of the API, production database write, customer notification or production-domain release has been performed. The image adapter and private backend are validated with mocks and SQLite, and need configured services plus live smoke testing. Responsive browser viewport checks do not substitute for testing a physical phone's camera and touch input.

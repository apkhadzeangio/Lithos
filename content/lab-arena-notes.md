# LITHOS LAB / VS arena

The application is `dist/lab/index.html`. It runs directly as a local HTML file and at `/lab/`. Tailwind CSS 3.4.17 (compiled), Chart.js 4.4.8, the Georgian font, material illustrations, data and application code are embedded. Opening the arena does not request a CDN or use WebGL. A lightweight SVG radar is available when the canvas chart cannot start.

## Editing

Edit the clearly marked `arena-data` script for the database, sources, criteria, scenarios and profile weights. Edit `arena-app` for behavior. The custom stylesheet follows the compiled `tailwind-css` stylesheet. Third-party notices are at the end of the file. No app build is required.

The six visible modules contain eight comparison groups and 29 options. Sink / backsplash and hardware / edging use separate subgroups so that criteria compare equivalent decisions. Brand families are represented by explicit example construction types, not universal brand-wide test claims.

Scores are editorial comparisons, not laboratory measurements or current Georgian prices. Profile recommendations use a weighted mean; differences below 0.25 are treated as a practical tie. The boiling-water example is explicitly theoretical (1 L, 20–100°C, 2 kW, stated efficiencies), not a device benchmark. Technical source links are displayed in the application. Validate exact product series, samples, local quotations and installation drawings before quoting a project.

## Integration and verification

`src/home.html` and `src/page.html` add LAB immediately after Journal in desktop, mobile and footer links. `scripts/build-public-pages.mjs` regenerates public pages and includes `/lab/` in the sitemap. The earlier surface-lighting experiment remains at `/lab/surface/` with its existing assets and lifecycle tests.

Run:

```sh
node --test tests/lab-arena.test.mjs tests/blog.test.mjs tests/designer.test.mjs tests/kitchen-state.test.mjs tests/lab-surface.test.mjs tests/site-chrome.test.mjs tests/sketch.test.mjs
```

91 checks passed. The unrelated historical-commit fixture in `tests/review-fixes.test.mjs` already fails on the unchanged baseline and is not included in the command above.

Browser QA covered all six modules, both additional subgroups, product selection, swapping, scenario outputs, profile recommendations including equal hardware, share links, and a 390 px iframe viewport (375 px content after scrollbar), with no horizontal page overflow. This is a responsive layout check, not a physical-device certification. Printing uses the browser's standard Print / Save as PDF flow.

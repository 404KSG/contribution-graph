# Roam Minimal Year Stack Design

## Goal

Replace the two-column annual card wall with a continuous one-column history that matches Roam's restrained, document-like visual rhythm. Keep the dialog at a fixed viewport height and scroll only the history body. Export the complete one-column history regardless of the current scroll position.

## On-screen history

Every year remains a complete 365/366-day SVG. The year label moves into the same SVG baseline as the month labels, removing the separate year header and annual card chrome. Years are ordered newest first and separated only by compact vertical rhythm. There are no rounded year cards, shadows, tinted panels, or hover elevation.

The modal uses one readable desktop width instead of stretching across the screen. Header controls and the compact summary rail remain fixed while the annual history scrolls beneath them. All text inherits the font active in Roam. Blueprint supplies icons, controls, intent color, focus behavior, and dark-mode conventions.

## Complete screenshot

The screenshot layout also uses exactly one year per row. Its logical width is fixed and its height grows with the number of years. The PNG renderer therefore captures every year even though the interactive dialog has a fixed height and scrollable body. Canvas text uses Roam's computed body font when available, with the Blueprint system stack only as a fallback.

## Verification

Update layout tests to require one column for both short and long histories and verify image height grows once per year. Retain the full Canvas render test, delivery fallback test, all data-correctness tests, the 500,000-row benchmark, reproducible build check, Depot CI, and live developer-extension reload.

## Detail refinement

Scope and Share Screenshot use an identical 32-pixel Blueprint control height. Refresh is an icon-only Blueprint button with accessible label and tooltip. The metadata row contains only scope and year coverage; explanatory prose and cache/block details are removed.

Screenshot progress is communicated in the initiating button: Preparing, Shared, Copied, Downloaded, Canceled, or Try again. Feedback clears after a short delay and timers are disposed on extension unload.

Annual SVGs display at their native dimensions instead of being fractionally scaled to container width. Labels inherit Roam's font, use normal weight and quieter color, and cells use crisp-edge rendering. PNG export increases to 3× resolution and disables image smoothing.

The final type hierarchy uses Roam and Blueprint's macOS-first UI sans-serif stack with high-contrast Blueprint dark gray: year labels are bold, calendar labels semibold, and secondary UI text semibold. Screenshot rendering uses that same fixed UI stack instead of reading Roam's page-body font, because graph themes may assign a serif face to body content. `@RoamResearch` follows the subtitle as plain text without badge chrome or shadow and appears at the end of the screenshot subtitle. The screenshot footer contains only one right-aligned Less-to-More legend, with explicit spacing between its cells and labels. The decorative dialog icon is removed so the title aligns directly with the content rail.

Add `Days in Roam` as elapsed calendar days from the first dated block through today, inclusive. Keep active-day calculation internally for annual tooltips and streak logic, but remove it from the summary rail and shared image to reduce competing metrics. Expose the first block date as the metric tooltip and include the elapsed duration in shared images.

Use an 11-pixel cell with a 3-pixel integer gap. This fills the desktop content rail without stretching the SVG, preserves crisp square geometry, and removes the unused right-side strip while retaining horizontal scrolling on constrained viewports.

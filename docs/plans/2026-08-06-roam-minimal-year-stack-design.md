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

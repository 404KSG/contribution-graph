# Roam-Native Sharing Design

## Direction

The extension should look like a first-party Roam surface, not a separate branded dashboard. Reuse the Blueprint classes and icon font already shipped by Roam. Use `heat-grid` for the extension, `camera` for screenshot sharing, `refresh` for refresh, and `cross` for close. Typography, buttons, focus rings, blue intent color, borders, and dark-mode behavior should inherit from Roam and Blueprint wherever possible.

Keep the dense two-column annual archive because it makes complete history scannable, but remove the custom serif type, green brand badge, tinted controls, and atmospheric effects. The dialog should use Blueprint-compatible white/gray surfaces, restrained spacing, and familiar button hierarchy.

## Share Screenshot

`Share Screenshot` exports the complete active dataset, not the visible scroll viewport. A dedicated Canvas renderer draws a deterministic light-background PNG containing the title, active scope, full year range, four summary metrics, every annual heatmap, annual totals, a legend, and attribution. Two years are laid out per row, so long histories remain compact while every day remains present.

The image is rendered at 3× resolution for sharp text and cells. Sharing follows a progressive browser-native path:

1. Use Web Share with a PNG file when supported.
2. Otherwise copy the PNG to the clipboard.
3. Otherwise download the PNG.

The button is disabled until history has loaded and while an image is being generated. Cancellation is reported without treating it as an extension failure. No graph data is uploaded by the extension; sharing only occurs through the user-initiated browser or operating-system action.

## Verification

Add pure layout tests proving that screenshot output includes every year and grows predictably for long histories. Retain duplicate-timestamp, complete-year, lifecycle, performance, build, and security tests. Update the existing Draft Depot preview to a fixed verified commit and reload it through the official Roam CLI.

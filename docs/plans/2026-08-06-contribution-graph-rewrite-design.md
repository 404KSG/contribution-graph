# Contribution Graph Rewrite Design

## Goal

Preserve the extension's defining feature: render the graph's complete Roam creation history, one GitHub-style calendar per year. Improve correctness, startup performance, refresh behavior, current Roam compatibility, lifecycle cleanup, accessibility, and testability without turning the extension into a general analytics dashboard.

## Product Decisions

- Count entities that have both `:block/string` and `:create/time`; pages and unrelated entities are excluded.
- Render every year from the earliest matching block through the current year. There is no rolling-window truncation.
- Default to all authors. When `roamAlphaAPI.user.uid()` is available, offer a current-user-only scope for multiplayer graphs.
- State the metric honestly: API-created, imported, and automated blocks can count as activity when they carry the selected creator. The extension does not claim to measure knowledge quality or distinguish human typing from an Agent acting as the same user.
- Keep the command-palette entry as the stable access path. Retain an optional topbar button, but make it resilient to topbar remounts and harmless when the topbar is unavailable.

## Architecture And Data Flow

The extension uses browser-native DOM and SVG APIs and has no runtime dependencies. Opening the dialog schedules a paint, then runs the Roam Datalog query. Timestamp rows are aggregated into local calendar dates in batches, yielding between batches so large histories do not monopolize JavaScript after the synchronous Roam query returns. Results are cached in memory for a short interval per scope; reopening after the interval or pressing Refresh performs a full authoritative scan.

Each year is rendered as its own accessible SVG. The calendar begins on the Sunday before January 1 and ends on the Saturday after December 31, while out-of-year cells remain empty. Fixed levels preserve comparability across years: 1-9, 10-24, 25-49, and 50+ blocks. The dialog also reports total blocks, active days, current streak, and longest streak.

## Error Handling And Lifecycle

Missing Roam APIs, unavailable current-user identity, empty graphs, and query failures produce visible states instead of uncaught exceptions. A generation token prevents stale async aggregation from updating a closed or refreshed dialog. Unload removes the modal, topbar button, observers, document listeners, and command registration. No block text, timestamps, or counts leave the browser, and daily counts are not logged to the console.

## Verification

Node's built-in test runner covers timestamp normalization, complete-year calendar boundaries, fixed color levels, author-scoped query selection, totals, and streak calculations. The build is a deterministic copy of the reviewed source plus CSS and uses only Node standard-library code. Verification includes `npm test`, syntax checks, build repeatability, Depot artifact checks, lifecycle smoke tests with a mocked DOM, and a real Roam developer-extension reload when the local runtime permits it.

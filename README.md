# Contribution Graph for Roam Research

Contribution Graph turns your **complete Roam block creation history** into a GitHub-style calendar heatmap. It renders every year from your earliest block through the current year; history is never truncated to a rolling window.

This fork is a ground-up, dependency-free rewrite of [Dagulf795/contribution-graph](https://github.com/Dagulf795/contribution-graph), originally created by Felix Stocker.

## What It Shows

- One full calendar graph per year, newest first
- Fixed activity levels that remain comparable across years:
  - 1-9 blocks
  - 10-24 blocks
  - 25-49 blocks
  - 50+ blocks
- Total blocks, elapsed days in Roam since the first dated block, current streak, and longest streak
- Clear calendar periods: future dates are blank, dates before the first block use a faint outline, and true zero-activity history uses the lightest filled level
- Entire graph by default
- Optional current-Roam-user scope for multiplayer graphs
- A complete-history PNG export through **Share Screenshot**

The metric counts entities with both `:block/string` and `:create/time`, so pages are excluded. Imports and Agents acting as the selected Roam user may still contribute to the count; this is an activity view, not a claim about knowledge quality or exclusively human typing.

## Performance And Privacy

- No query runs during normal Roam startup.
- The complete-history query runs only when you open an uncached or expired scope, or when you press **Refresh**. Returning to a recently loaded scope reuses its one-minute in-memory cache.
- Timestamp aggregation yields between large batches so rendering many years remains responsive after Roam returns the query result.
- There are no runtime dependencies, servers, analytics, tokens, or extension-initiated network requests.
- Block text is not read. Daily counts are not written to the console or sent anywhere.
- Screenshot sharing is user-initiated: the extension uses the operating-system share sheet when available, then clipboard copy, then a local PNG download.

## Use

Open the Command Palette and run:

```text
Contribution Graph: Open complete history
```

A topbar grid button is enabled by default. It can be hidden under **Settings → Contribution Graph** without disabling the command.

Inside the dialog:

- switch between **Entire graph** and **Current Roam user** when Roam exposes the current user UID;
- press **Share Screenshot** to export every rendered year, including years below the visible scroll area;
- exported metrics stay unit-free and the header uses a stable date-only label;
- press the Blueprint **refresh icon** to bypass the short memory cache;
- hover a cell to see its exact date and block count;
- press `Escape`, the close button, or the backdrop to close.

The dialog keeps Scope, Share Screenshot, Refresh, and Close available on narrow screens. Keyboard focus stays inside the open modal and returns to the control that opened it when the modal closes.

## Developer Installation

Until this fork is accepted into Roam Depot:

```bash
git clone https://github.com/404KSG/contribution-graph.git
cd contribution-graph
npm run build
```

Then load the repository directory as a Roam developer extension. The build produces `extension.js` and `extension.css` at the repository root.

## Development

The project requires only Node.js; `package.json` has no dependencies.

```bash
npm test
npm run build
npm run check
```

The build copies the reviewed ES module and CSS into the two files expected by Roam. Core aggregation, calendar, scope-query, threshold, and streak behavior is covered by Node's built-in test runner.

## Design

The rewrite rationale, data flow, lifecycle boundary, and verification plan are documented in [the rewrite design](docs/plans/2026-08-06-contribution-graph-rewrite-design.md), [the compact-history design](docs/plans/2026-08-06-compact-full-history-design.md), and [the Roam-native sharing design](docs/plans/2026-08-06-roam-native-sharing-design.md).

## License

MIT. See [LICENSE](LICENSE).

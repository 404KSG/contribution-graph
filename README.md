# Contribution Graph

See your complete Roam block creation history as a contribution heatmap, from your earliest block through today. Every year stays visible in one compact view.

| Roam view | Complete PNG export |
| :---: | :---: |
| ![Contribution Graph displayed inside Roam Research](https://raw.githubusercontent.com/404KSG/contribution-graph/b81ebd3bd972ab9840137df8deffcbd49bc6fc5c/docs/images/contribution-graph-dialog.png) | ![Complete contribution history exported as a PNG](https://raw.githubusercontent.com/404KSG/contribution-graph/b81ebd3bd972ab9840137df8deffcbd49bc6fc5c/docs/images/contribution-graph-share.png) |

## Highlights

- View the entire graph or only blocks created by the current Roam user.
- Track Days in Roam, longest streak, current streak, and total blocks.
- Tell future dates, pre-history dates, and inactive historical days apart at a glance.
- Export the complete history as a crisp 3× PNG with **Share Screenshot**.
- Use a Roam- and Blueprint-style interface with responsive controls and keyboard support.

## Use

Open **Contribution Graph: Open complete history** from the Command Palette or use the topbar grid button. Choose a scope, refresh when needed, or share the complete graph as an image.

## Privacy and performance

The extension reads block creation timestamps, never block text. It has no analytics, external service, runtime dependency, or extension-initiated network request.

History loads only when the graph is opened or refreshed, then stays in a short in-memory cache. Imported and Agent-created blocks may be included in the selected creator's activity.

## Development

```bash
npm test
npm run build
npm run check
```

The rewrite is based on [Felix Stocker's original extension](https://github.com/Dagulf795/contribution-graph) and remains MIT licensed. Implementation notes are available in [docs/plans](docs/plans).
